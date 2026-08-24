"""Film the backing video: one clip per shot, with the real Windows cursor.

    python tools/backing-video/capture.py --probe          # no recording, just timing
    python tools/backing-video/capture.py                  # all 18 shots
    python tools/backing-video/capture.py --only quiz,alu-bits
    python tools/backing-video/assemble.py                 # cut them together

WHILE THIS RUNS THE MACHINE IS NOT YOURS. The browser owns the top-left
1920x1080 of the screen and a script is flying the physical pointer. Touching
the mouse corrupts the take in progress and nothing else -- re-shoot it with
--only.

Why the architecture is shaped like this
----------------------------------------
The brief asked for a visible mouse that moves like a hand. Playwright's mouse
dispatches CDP events and never moves the OS cursor, so a Playwright recording
has no pointer in it at all. So: pointer input goes through Win32 (human_mouse),
the desktop is screen-grabbed by ffmpeg with draw_mouse, and Playwright is
demoted to what it is genuinely good at -- navigation, waiting on real
conditions, and reading state out of the page.

The browser is EDGE, not Playwright's bundled Chromium, and that is not a
preference. Playwright's Chromium is built without proprietary codecs, so the
H.264 mp4s this video exists to show -- the three hero loops and Elliot's Zen 5
core explainer -- would not decode. Edge is Chromium with the codecs. Chrome
would do equally well; it is not installed on this machine.

--app mode is likewise load-bearing: no tab strip and no omnibox means
`127.0.0.1:8777` never appears in the finished video, and unlike --kiosk the
window can be sized so its content area IS the delivered 1920x1080 frame. That
matters because the capture is a CPU blit whose cost is per pixel -- see
config.py and the README for why this is not the GPU path it was meant to be.

Two traps that produce a plausible-looking but worthless capture
---------------------------------------------------------------
REDUCED MOTION. scripts/scroll.js strips `html.js` and cancels every GSAP
reveal under prefers-reduced-motion, and main.js:619 refuses to play the hero
clips. The result is a site that looks fine in a screenshot and is completely
static on film. emulate_media() is asserted, not assumed.

FRAME RATE. A page rendering slower than the capture target judders no matter
what the container claims. measure_fps counts rAF callbacks and refuses to
proceed if the page cannot keep ahead of the recorder.
"""
import argparse
import ctypes
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config as C
from human_mouse import Hand
from shots import SHOTS

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit('needs playwright:  pip install playwright')

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
EDGE_ALT = r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'

user32 = ctypes.WinDLL('user32')


def window_at(x, y):
    """The title of the top-level window under a screen point.

    Used to turn "the page saw no pointer" into "Windows Terminal is sitting on
    top of the browser", which is the actual problem every time.
    """
    import ctypes
    from ctypes import wintypes

    class POINT(ctypes.Structure):
        _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]

    u = ctypes.WinDLL('user32')
    root = u.GetAncestor(u.WindowFromPoint(POINT(int(x), int(y))), 2)  # GA_ROOT
    title = ctypes.create_unicode_buffer(300)
    u.GetWindowTextW(root, title, 300)
    return title.value or '<untitled>'


# --- browser ---------------------------------------------------------------

def browser_flags(profile_dir):
    return [
        # --app, not --kiosk. Kiosk goes fullscreen, which on this 2560x1600
        # panel would mean grabbing 2560x1600 -- and gdigrab manages ~34 fps at
        # that size. An --app window has no tab strip and no omnibox either, so
        # `127.0.0.1:8777` still never appears on camera, and it can be sized so
        # its content area IS the delivered 1920x1080 frame.
        f'--app={C.BASE}/',
        '--window-position=0,0',
        f'--window-size={C.FINAL_W},{C.FINAL_H + 120}',   # refined over CDP below
        f'--remote-debugging-port={C.CDP_PORT}',
        f'--user-data-dir={profile_dir}',
        '--no-first-run', '--no-default-browser-check',
        # Edge is enthusiastic about sign-in, sync and "welcome" surfaces, and
        # every one of them opens a real window that lands in the capture region
        # and confuses the page/window pairing. Suppress the lot.
        '--disable-sync', '--disable-signin-promo',
        '--no-service-autorun', '--disable-search-engine-choice-screen',
        '--ash-no-nudges', '--disable-session-crashed-bubble',
        '--disable-infobars', '--disable-notifications',
        '--disable-features=Translate,AutofillServerCommunication,'
        'msEdgeWelcomeExperience,msImplicitSignin,EdgeFollowFeature,'
        'ImprovedSigninUI,PrivacySandboxSettings4',
        # Scale factor 1: one CSS pixel is one captured pixel is one delivered
        # pixel. A 1920x1080 CSS viewport is a proper desktop width for the
        # site's 1400px rail, and nothing in the pipeline resamples it.
        '--force-device-scale-factor=1',
        '--hide-scrollbars',
        '--autoplay-policy=no-user-gesture-required',
        # The die scene should render on the 4080, not the Arc that drives the
        # panel. Without this the WebGL shots run at a fraction of the rate
        # everything else does.
        '--force_high_performance_gpu',
        '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
    ]


def pair_page_and_window(ctx, profile_dir):
    """Match the page we drive to the window we film. They must be the same one.

    Edge opens more than one window here (the --app window plus a small
    unnamed one), so "the first page" and "the biggest window" are not
    guaranteed to be the same object -- and if they are not, the harness sizes
    one window while measuring the other and nothing lines up.

    Each page is given a unique title, then the windows are enumerated and read
    back, which pairs them by identity rather than by hope. The largest matched
    pair wins, since the --app window is the big one.
    """
    tagged = {}
    for i, pg in enumerate(ctx.pages):
        tag = f'__bv{i}__'
        try:
            pg.evaluate(f'document.title = {tag!r}')
            tagged[tag] = pg
        except Exception:
            pass                       # a target that cannot run script is not ours
    time.sleep(0.4)

    best = None
    for hwnd, w, h, title in _candidate_windows(profile_dir):
        for tag, pg in tagged.items():
            if tag in title and (best is None or w * h > best[1]):
                best = (hwnd, w * h, pg)
    if not best:
        raise SystemExit('could not pair any browser window with a page')
    return best[2], best[0]


def _candidate_windows(profile_dir):
    """(hwnd, w, h, title) for every visible window of the browser we launched.

    Matched by process, not by title: title matching alone would pick up any
    other window showing the same page.
    """
    import ctypes
    from ctypes import wintypes

    r = subprocess.run(
        ['powershell', '-NoProfile', '-Command',
         "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
         f"Where-Object {{ $_.CommandLine -like '*{os.path.basename(profile_dir)}*' }} | "
         'Select-Object -ExpandProperty ProcessId'],
        capture_output=True, text=True)
    pids = {int(x) for x in r.stdout.split() if x.strip().isdigit()}
    if not pids:
        raise SystemExit('the browser process vanished before it could be sized')

    u = ctypes.WinDLL('user32')
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def visit(hwnd, _):
        if not u.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(64)
        u.GetClassNameW(hwnd, cls, 64)
        if cls.value != 'Chrome_WidgetWin_1':
            return True
        pid = wintypes.DWORD()
        u.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value in pids:
            rect = wintypes.RECT()
            u.GetWindowRect(hwnd, ctypes.byref(rect))
            title = ctypes.create_unicode_buffer(200)
            u.GetWindowTextW(hwnd, title, 200)
            found.append((hwnd, rect.right - rect.left,
                          rect.bottom - rect.top, title.value))
        return True

    u.EnumWindows(visit, 0)
    if not found:
        raise SystemExit('could not find the browser window')
    found.sort(key=lambda f: f[1] * f[2], reverse=True)
    return found


def fit_window(hwnd, page):
    """Size the window so the WEB VIEWPORT is exactly FINAL_W x FINAL_H.

    Win32 rather than CDP: Browser.getWindowForTarget answers "Browser window
    not found" for an --app window here.

    Driven off the page's innerWidth/innerHeight, deliberately, NOT off
    GetClientRect. An --app window draws its own slim title bar *inside* the
    Win32 client area -- 31px of it on this machine -- so sizing the client
    rectangle to 1920x1080 leaves a 1920x1049 viewport and the capture would be
    31 rows of browser chrome plus a cropped page. Total window overhead is
    measured and corrected rather than assumed, since it varies with theme and
    DPI. Two passes converge; the third is for the theme that needs it.
    """
    import ctypes
    from ctypes import wintypes

    u = ctypes.WinDLL('user32')
    SWP_NOZORDER, SWP_NOACTIVATE = 0x0004, 0x0010

    for _ in range(4):
        inner = page.evaluate('[innerWidth, innerHeight]')
        win = wintypes.RECT()
        u.GetWindowRect(hwnd, ctypes.byref(win))
        at_origin = (win.left, win.top) == (0, 0)
        if inner == [C.FINAL_W, C.FINAL_H] and at_origin:
            return
        u.SetWindowPos(hwnd, 0, 0, 0,
                       (win.right - win.left) + (C.FINAL_W - inner[0]),
                       (win.bottom - win.top) + (C.FINAL_H - inner[1]),
                       SWP_NOZORDER | SWP_NOACTIVATE)
        page.wait_for_timeout(400)

    inner = page.evaluate('[innerWidth, innerHeight]')
    if inner != [C.FINAL_W, C.FINAL_H]:
        raise SystemExit(f'could not size the viewport to {C.FINAL_W}x'
                         f'{C.FINAL_H}; got {inner[0]}x{inner[1]}')


def viewport_origin(hwnd, page):
    """A first guess at where the web viewport starts on screen.

    Only a guess: it assumes the browser's own chrome sits along the top of the
    client area and nowhere else. Stage.calibrate() then MEASURES the real
    mapping and overrides this. The guess exists so calibration has somewhere
    valid to put its probe points.
    """
    import ctypes
    from ctypes import wintypes

    class POINT(ctypes.Structure):
        _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]

    u = ctypes.WinDLL('user32')
    p, cli = POINT(0, 0), wintypes.RECT()
    u.ClientToScreen(hwnd, ctypes.byref(p))
    u.GetClientRect(hwnd, ctypes.byref(cli))
    inner = page.evaluate('[innerWidth, innerHeight]')
    return (p.x, p.y + (cli.bottom - cli.top) - inner[1])


def raise_window(hwnd):
    """Put the browser on top and keep it there.

    Not cosmetic: the client rectangle is the capture region, so any window
    overlapping it lands in the footage.
    """
    import ctypes
    u = ctypes.WinDLL('user32')
    HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE = -1, 0x0002, 0x0001
    u.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
    u.SetForegroundWindow(hwnd)


class DEVMODE(ctypes.Structure):
    _fields_ = [('dmDeviceName', ctypes.c_wchar * 32),
                ('dmSpecVersion', ctypes.c_ushort),
                ('dmDriverVersion', ctypes.c_ushort),
                ('dmSize', ctypes.c_ushort),
                ('dmDriverExtra', ctypes.c_ushort),
                ('dmFields', ctypes.c_ulong),
                ('dmPositionX', ctypes.c_long), ('dmPositionY', ctypes.c_long),
                ('dmDisplayOrientation', ctypes.c_ulong),
                ('dmDisplayFixedOutput', ctypes.c_ulong),
                ('dmColor', ctypes.c_short), ('dmDuplex', ctypes.c_short),
                ('dmYResolution', ctypes.c_short),
                ('dmTTOption', ctypes.c_short), ('dmCollate', ctypes.c_short),
                ('dmFormName', ctypes.c_wchar * 32),
                ('dmLogPixels', ctypes.c_ushort),
                ('dmBitsPerPel', ctypes.c_ulong),
                ('dmPelsWidth', ctypes.c_ulong), ('dmPelsHeight', ctypes.c_ulong),
                ('dmDisplayFlags', ctypes.c_ulong),
                ('dmDisplayFrequency', ctypes.c_ulong),
                ('dmICMMethod', ctypes.c_ulong), ('dmICMIntent', ctypes.c_ulong),
                ('dmMediaType', ctypes.c_ulong), ('dmDitherType', ctypes.c_ulong),
                ('dmReserved1', ctypes.c_ulong), ('dmReserved2', ctypes.c_ulong),
                ('dmPanningWidth', ctypes.c_ulong),
                ('dmPanningHeight', ctypes.c_ulong)]


def set_refresh_rate(hz):
    """Drop the display to `hz` for the capture. Returns the previous rate.

    This is the single biggest lever on capture smoothness, and it is not
    obvious. The panel is 240Hz, so Chromium's compositor vsyncs at 240 and
    renders the die scene up to FOUR TIMES for every frame we record. All of
    that work is thrown away, and it competes with a screen grabber that is
    already the bottleneck -- which is what produces the hitches: the grabber
    misses its slot, ffmpeg pads with duplicates, and motion judders.

    Matching the refresh rate to the capture rate makes every rendered frame one
    we actually keep, and aligns vsync with the grab.

    Restored in main()'s finally. Pass 0 to leave the display alone.
    """
    if not hz:
        return None
    dm = DEVMODE()
    dm.dmSize = ctypes.sizeof(DEVMODE)
    ENUM_CURRENT_SETTINGS = -1
    if not user32.EnumDisplaySettingsW(None, ENUM_CURRENT_SETTINGS, ctypes.byref(dm)):
        print('  !! could not read the display mode; leaving it alone')
        return None
    previous = int(dm.dmDisplayFrequency)
    if previous == hz:
        return None
    dm.dmDisplayFrequency = hz
    dm.dmFields = 0x400000                        # DM_DISPLAYFREQUENCY
    rc = user32.ChangeDisplaySettingsExW(None, ctypes.byref(dm), None, 0, None)
    if rc != 0:                                   # DISP_CHANGE_SUCCESSFUL
        print(f'  !! display would not switch to {hz}Hz (code {rc}); '
              'expect a less even capture')
        return None
    print(f'  display {previous}Hz -> {hz}Hz for the capture')
    return previous


def seed_profile(profile_dir):
    """Write the preferences that stop Edge drawing its own UI over the page.

    `smart_explore.on_image_hover` is the hover toolbar -- the little pill with
    the visual-search and translate icons that Edge floats over any image you
    point at. On a site made of hand-drawn diagrams it appears constantly, and
    it is browser UI, so no amount of page CSS removes it. There is no command
    line flag; it is a profile preference, which is why the profile is seeded
    before first launch rather than configured after.

    The rest suppress password and sign-in prompts, which open real windows.
    """
    d = os.path.join(profile_dir, 'Default')
    os.makedirs(d, exist_ok=True)
    prefs = {
        'smart_explore': {'on_image_hover': False},
        'credentials_enable_service': False,
        'profile': {'password_manager_enabled': False,
                    'default_content_setting_values': {'notifications': 2}},
    }
    with open(os.path.join(d, 'Preferences'), 'w', encoding='utf-8') as f:
        json.dump(prefs, f)


# Hovering a link makes Chromium show its target in a bubble at the bottom
# left -- which would put "127.0.0.1:8777/..." in the finished video, directly
# opposite the talking head. It is browser UI and cannot be styled away, so
# instead the hrefs are rewritten to the real production URLs: the bubble then
# reads siliconfromscratch.com, which is both true and better looking.
#
# Clicks on links are canceled to match. Nothing in the shot list navigates by
# clicking a link -- every page change goes through page.goto -- so this costs
# nothing and stops a stray click loading the live site mid-take.
LINK_REWRITE = """
(() => {
  const REAL = 'https://siliconfromscratch.com';
  const fix = () => document.querySelectorAll('a[href]').forEach(a => {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin === location.origin) a.href = REAL + u.pathname + u.search + u.hash;
    } catch (e) {}
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', fix);
  else fix();
  document.addEventListener('click', e => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a) e.preventDefault();
  }, true);
})();
"""


def port_is_busy(port):
    import socket
    with socket.socket() as s:
        s.settimeout(0.4)
        return s.connect_ex(('127.0.0.1', port)) == 0


def kill_browser(profile_dir):
    """Kill the browser by its profile directory, not by the handle we spawned.

    msedge.exe is a launcher: it hands off to an already-running or freshly
    detached browser process and exits, so the Popen handle we hold is usually
    dead within a second and terminating it kills nothing. Left alone, every run
    leaks a browser that keeps port 9222 open, and the NEXT run happily attaches
    to that corpse -- whose window is gone, which surfaces as the thoroughly
    unhelpful "Browser window not found" from Browser.getWindowForTarget.
    """
    subprocess.run(
        ['powershell', '-NoProfile', '-Command',
         "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
         f"Where-Object {{ $_.CommandLine -like '*{os.path.basename(profile_dir)}*' }} | "
         'ForEach-Object { Stop-Process -Id $_.ProcessId -Force '
         '-ErrorAction SilentlyContinue }'],
        capture_output=True)


def find_browser(override):
    for p in ([override] if override else []) + [EDGE, EDGE_ALT]:
        if p and os.path.exists(p):
            return p
    raise SystemExit('no Edge found; pass --browser <path to a chromium exe>. '
                     "Playwright's bundled Chromium will NOT work: no H.264, "
                     'so the hero clips and the Zen 5 video would not decode.')


# --- the recorder ----------------------------------------------------------

class Recorder:
    """One ffmpeg process per shot, so any single shot can be re-taken.

    Only the browser's content rectangle is grabbed, not the whole desktop:
    fewer pixels per frame is the single biggest lever on the achievable rate,
    and the region IS the delivered frame so nothing needs cropping later.

    Capture-path ladder, probed once at startup and reported loudly. A silent
    downgrade is the worst failure available here -- it yields a file that
    plays, claims 60fps, and is mostly duplicates.

      1. ddagrab (Desktop Duplication, GPU). Preferred everywhere it works.
         It does NOT work on this machine: DXGI reports no duplicatable output
         on either adapter. Kept because it is right on other machines and
         costs under a second to rule out.
      2. gdigrab (BitBlt, CPU). What actually runs here. Measures ~52 fps
         grabbing 1920x1080, so a 60fps target duplicates a few frames a
         second.

    NVENC is deliberately absent: this ffmpeg build requires nvenc API 13.1 and
    the installed driver offers 13.0, so every nvenc encoder fails to open.
    libx264 -preset ultrafast is not the bottleneck anyway -- grabbing with no
    encoder at all measures the same ~52 fps.
    """

    def __init__(self, region):
        self.region = region                    # (x, y, w, h) in screen pixels
        self.mode, self.args = self._pick()
        self.proc = None

    def _ladder(self):
        x, y, w, h = self.region
        size = f'{w}x{h}'
        return [
            ('ddagrab',
             ['-f', 'lavfi', '-i',
              f'ddagrab=output_idx=0:framerate={C.CAPTURE_FPS}:draw_mouse=1'
              f':offset_x={x}:offset_y={y}:video_size={size}',
              '-vf', 'hwdownload,format=bgra,format=yuv420p',
              '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '18']),
            ('gdigrab',
             ['-f', 'gdigrab', '-framerate', str(C.CAPTURE_FPS), '-draw_mouse', '1',
              '-offset_x', str(x), '-offset_y', str(y),
              '-video_size', size, '-i', 'desktop',
              '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '18']),
        ]

    def _pick(self):
        ladder = self._ladder()
        for name, args in ladder:
            probe = os.path.join(tempfile.gettempdir(), 'backing-probe.mp4')
            cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + args + \
                  ['-t', '0.5', '-pix_fmt', 'yuv420p', '-an', probe]
            try:
                r = subprocess.run(cmd, capture_output=True, timeout=45)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
            if r.returncode == 0 and os.path.exists(probe) and os.path.getsize(probe) > 1000:
                if name != ladder[0][0]:
                    print(f'  !! no GPU capture path; using {name} (CPU blit). '
                          f'Expect ~52 real fps against a {C.CAPTURE_FPS} target.')
                return name, args
        raise SystemExit('no working ffmpeg screen-capture path; tried '
                         + ', '.join(n for n, _ in ladder))

    def start(self, path):
        cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + self.args + \
              ['-pix_fmt', 'yuv420p', '-an', path]
        # Above-normal priority: the grabber is the bottleneck, and when it
        # loses its slot to the browser the missed frame is padded with a
        # duplicate and shows up as a hitch.
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                                     stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL,
                                     creationflags=0x00008000)  # ABOVE_NORMAL
        # Wait for the muxer to actually be writing. Starting the performance
        # against a fixed sleep loses the first beat of whichever shot happens
        # to be slowest to spin up.
        deadline = time.time() + 8
        while time.time() < deadline:
            if os.path.exists(path) and os.path.getsize(path) > 0:
                time.sleep(0.35)          # let the pipeline reach steady state
                return
            time.sleep(0.05)
        raise RuntimeError(f'recorder never started writing {path}')

    def stop(self):
        if not self.proc:
            return
        try:
            self.proc.stdin.write(b'q')   # clean shutdown: finalizes the mp4
            self.proc.stdin.flush()
            self.proc.wait(timeout=20)
        except Exception:
            self.proc.kill()
        self.proc = None


def clip_stats(path):
    """(frames, seconds) as the file actually reports them."""
    def q(entries, stream='v:0'):
        r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', stream,
                            '-show_entries', entries, '-of',
                            'default=nw=1:nk=1', path],
                           capture_output=True, text=True)
        return r.stdout.strip().splitlines()
    frames = q('stream=nb_frames')
    secs = q('format=duration', stream='v:0')
    try:
        return int(frames[0]), float(secs[0])
    except (ValueError, IndexError):
        return 0, 0.0


# --- the stage -------------------------------------------------------------

class Stage:
    """What a shot is handed: the page, the hand, and the map between them.

    Coordinate map. Page CSS pixels -> physical screen pixels is NOT derived
    from the DPI scale factor, because that arithmetic is right on one machine
    and subtly wrong on the next. It is measured: park the real cursor on three
    known screen points, ask the page what clientX/clientY it saw, and solve.
    Same discipline as meet-the-processor/verify -- never assume, poll and
    confirm.
    """

    def __init__(self, page, hand, origin):
        self.page = page
        self.hand = hand
        self.origin = origin        # content area's top-left, in screen pixels
        self.sx = self.sy = 1.0
        self.ox = self.oy = 0.0
        self._found = None

    # -- calibration ----------------------------------------------------

    def calibrate(self):
        # Every probe point must land INSIDE the browser's content area, or the
        # page never sees the move. The window is FINAL_W x FINAL_H at the top
        # left of the screen with a title bar above it, so these are safe.
        ox, oy = self.origin
        pts = [(ox + 300, oy + 300), (ox + 1500, oy + 300), (ox + 900, oy + 900)]
        seen = []
        for px, py in pts:
            self.page.evaluate("""() => { window.__cal = null;
                document.addEventListener('mousemove',
                    e => { window.__cal = [e.clientX, e.clientY]; }); }""")
            # Several nudges, not one: a single SetCursorPos can be coalesced
            # away, and the listener has to see at least one real move.
            for k in range(6):
                self.hand._put(px + (k % 2), py + (k % 3))
                time.sleep(0.04)
            try:
                self.page.wait_for_function('window.__cal !== null', timeout=4000)
            except Exception:
                geo = self.page.evaluate(
                    '({sx:screenX, sy:screenY, w:innerWidth, h:innerHeight})')
                # Distinguish "the listener is broken" from "OS input is not
                # reaching this window": a CDP move bypasses Windows entirely.
                self.page.evaluate('window.__cal = null')
                self.page.mouse.move(400, 400)
                time.sleep(0.4)
                synth = self.page.evaluate('window.__cal')
                print(f'    [diag] synthetic CDP move -> {synth}')
                raise SystemExit(
                    f'the page saw no pointer at screen ({px}, {py}), though the '
                    f'cursor went there.\n'
                    f'  window under that point: "{window_at(px, py)}"\n'
                    f'  browser content: {geo["w"]}x{geo["h"]} at screen '
                    f'({geo["sx"]}, {geo["sy"]})\n'
                    '  If the window named above is not the browser, it is '
                    'covering it -- and since the capture region is that same '
                    'rectangle, it would have been in the footage too. Move it '
                    'off the top-left of the screen and re-run.')
            seen.append(self.page.evaluate('window.__cal'))

        # client = screen * s + o, solved on the two axis-aligned pairs.
        self.sx = (seen[1][0] - seen[0][0]) / (pts[1][0] - pts[0][0])
        self.sy = (seen[2][1] - seen[0][1]) / (pts[2][1] - pts[0][1])
        self.ox = seen[0][0] - pts[0][0] * self.sx
        self.oy = seen[0][1] - pts[0][1] * self.sy
        if not (0.3 < self.sx < 3.0 and 0.3 < self.sy < 3.0):
            raise SystemExit(f'calibration is nonsense: sx={self.sx} sy={self.sy}')
        print(f'  pointer map: client = screen*{self.sx:.4f} + {self.ox:.1f} '
              f'(x), *{self.sy:.4f} + {self.oy:.1f} (y)')

        # Two origins, deliberately, and they are NOT interchangeable.
        #
        # The measured map aims the pointer, and it is right for that: it is
        # derived from where the page actually saw the cursor.
        #
        # The CAPTURE RECTANGLE comes from Win32 instead. The measured origin is
        # only accurate to about a pixel -- the page reports clientX 0 for the
        # cursor sitting on the window's border column as well as on the first
        # content column -- and one pixel is the difference between a clean
        # frame and a faint gray hairline down the left edge of every shot.
        # GetClientRect is exact by construction. This was a real defect in the
        # first cut; do not "simplify" it back to one origin.
        mx, my = self.to_screen(0, 0)
        if abs(mx - self.origin[0]) > 6 or abs(my - self.origin[1]) > 6:
            raise SystemExit(
                f'pointer map and window geometry disagree badly: map says the '
                f'viewport starts at ({mx:.0f}, {my:.0f}), Win32 says '
                f'{self.origin}. One of them is wrong; clicks or framing would '
                'be off.')

    def to_screen(self, cx, cy):
        return ((cx - self.ox) / self.sx, (cy - self.oy) / self.sy)

    def region(self):
        """The content rectangle in screen pixels: exactly what gets grabbed.

        Win32, not the measured pointer map -- see the note in calibrate(). One
        pixel of error here puts the window border in every frame.
        """
        return (self.origin[0], self.origin[1], C.FINAL_W, C.FINAL_H)

    # -- navigation and framing (off camera, mostly) ---------------------

    def goto(self, path):
        self.page.goto(C.BASE + path, wait_until='domcontentloaded')
        self.page.wait_for_timeout(400)

    def blank_on_site_bg(self):
        """Park on a blank page painted the site's own background color.

        Used only by the opening shot, which navigates ON camera so the hero's
        one-shot GSAP settle is actually filmed. Cutting from black to a white
        about:blank would flash; cutting from the site's own dark ground reads
        as the page loading.
        """
        bg = self.page.evaluate(
            "getComputedStyle(document.body).backgroundColor || '#0b0b0f'")
        self.page.goto('data:text/html,'
                       f'<body style="background:{bg};margin:0"></body>')
        self.page.wait_for_timeout(250)

    def eval(self, js):
        """Run a statement in the page. Always wrapped, so assignments and
        calls both work without the caller thinking about which it wrote."""
        return self.page.evaluate('() => { ' + js + ' }')

    def wait(self, ms):
        self.page.wait_for_timeout(ms)

    def wait_visible(self, sel, timeout=15000):
        self.page.wait_for_selector(sel, state='visible', timeout=timeout)

    def wait_for(self, js_expr, timeout=30000):
        self.page.wait_for_function('() => ' + js_expr, timeout=timeout)

    def center(self, sel):
        """Scroll the subject to the middle of the frame, off camera.

        Deliberately JS, not the wheel: this is framing, not performance, and it
        also fires whatever reveals sit between here and there so the shot opens
        on a settled page rather than on animations still arriving.
        """
        self.page.locator(sel).first.scroll_into_view_if_needed()
        self.page.evaluate("""(sel) => { const e = document.querySelector(sel);
            if (!e) return; const r = e.getBoundingClientRect();
            window.scrollBy(0, r.top + r.height/2 - window.innerHeight/2); }""", sel)
        self.page.wait_for_timeout(1200)      # let reveals finish arriving

    def bring_above(self, sel, margin=560):
        """Park the subject just below the fold, ready to be scrolled into."""
        self.page.evaluate("""([sel, m]) => { const e = document.querySelector(sel);
            if (!e) return; const r = e.getBoundingClientRect();
            window.scrollBy(0, r.top - window.innerHeight + m); }""", [sel, margin])
        self.page.wait_for_timeout(900)

    def js_click(self, sel):
        self.page.locator(sel).first.click()
        self.page.wait_for_timeout(200)

    def park(self, fx, fy):
        """Put the pointer at a fractional viewport position, instantly."""
        w = self.page.evaluate('innerWidth')
        h = self.page.evaluate('innerHeight')
        self.hand._put(*self.to_screen(w * fx, h * fy))

    # -- performance (on camera) -----------------------------------------

    def _center_of(self, sel, nth=0):
        loc = self.page.locator(sel).nth(nth)
        loc.scroll_into_view_if_needed()
        b = loc.bounding_box()
        if not b:
            raise RuntimeError(f'no box for {sel} [{nth}]')
        return self.to_screen(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)

    def hover(self, sel, nth=0):
        self.hand.move_to(*self._center_of(sel, nth))

    def click(self, sel, nth=0):
        # Resolved fresh every time on purpose: the waveform rebuilds its whole
        # SVG on each toggle and the ALU widget redraws, so a box cached a
        # second ago can point at a detached node.
        self.hand.click(*self._center_of(sel, nth))

    def drag_track(self, sel, t0, t1, duration):
        """Press-traverse-release along a track, in track fractions.

        .layout-fade__track listens on pointerdown and captures the pointer, so
        the button has to stay down for the whole sweep. A click at the far end
        would jump the slider and skip the cross-fade this shot exists for.
        """
        b = self.page.locator(sel).first.bounding_box()
        y = b['y'] + b['height'] / 2
        p0 = self.to_screen(b['x'] + b['width'] * t0, y)
        p1 = self.to_screen(b['x'] + b['width'] * t1, y)
        self.hand.drag(p0[0], p0[1], p1[0], p1[1], duration)

    def hover_at(self, fx, fy):
        """Move the pointer to a fractional viewport position, on camera.

        For the WebGL canvas, where there are no DOM boxes to aim at -- the
        regions are geometry, not elements. Hovering a few spread-out points
        lights whichever blocks happen to be under them, which is exactly what
        someone exploring the floorplan would do.
        """
        w = self.page.evaluate('innerWidth')
        h = self.page.evaluate('innerHeight')
        self.hand.move_to(*self.to_screen(w * fx, h * fy))

    def sweep(self, sel, t0, t1, duration, y=0.5):
        """Glide across an element with the button UP.

        Distinct from drag_track, which presses. The waveform widgets show a
        scrubber guide that follows a bare pointer, so pressing would be both
        wrong and invisible.
        """
        b = self.page.locator(sel).first.bounding_box()
        yy = b['y'] + b['height'] * y
        self.hand.move_to(*self.to_screen(b['x'] + b['width'] * t0, yy))
        time.sleep(0.25)
        self.hand._leg(self.hand.pos(),
                       self.to_screen(b['x'] + b['width'] * t1, yy),
                       duration, arc=False)

    def scroll_px(self, dy, duration=1.6):
        """Roughly `dy` CSS pixels of REAL wheel input.

        Approximate by design. Chrome's per-notch distance depends on settings
        and its own smooth-scroll curve is applied on top; framing is prep's job
        and this only has to land in the neighborhood.
        """
        self.hand.scroll(round(dy / 100.0), duration=duration)

    def wander(self, secs):
        self.hand.wander(secs)

    # -- the die scene ----------------------------------------------------

    def mtp_ready(self):
        self.page.goto(C.BASE + '/meet-the-processor/', wait_until='domcontentloaded')
        self.page.wait_for_function('window.__die !== undefined', timeout=120000)
        self.page.wait_for_timeout(5000)      # every texture in place first
        # Idle camera drift would wander the framing between takes and make two
        # shots of the same stop not match.
        self.page.evaluate('window.__die.drift = false')
        legs = self.page.evaluate('window.__die.stops.length')
        if legs != 7:
            raise SystemExit(f'die scene reports {legs} stops, expected 7 -- '
                             'the shot list and LEG_MS are out of date')

    def find_region(self, want):
        """Sweep the canvas until the raycast reports the wanted region.

        Not hardcoded pixels: the camera keys are tuned often enough that a
        baked-in coordinate would rot silently and click empty silicon. CDP
        pointer moves are used for the sweep because it is off camera and
        cheap; the filmed click uses the real hand.
        """
        w = self.page.evaluate('innerWidth')
        h = self.page.evaluate('innerHeight')
        for fy in [0.62, 0.55, 0.70, 0.48]:
            for fx in [0.38, 0.45, 0.32, 0.55, 0.62]:
                x, y = w * fx, h * fy
                self.page.mouse.move(x, y)
                self.page.wait_for_timeout(90)
                label = self.page.evaluate(
                    'window.__die.state.hover && window.__die.state.hover.label')
                if label and want.lower() in str(label).lower():
                    self._found = (x, y)
                    print(f'    found "{label}" at ({fx:.2f}, {fy:.2f})')
                    return
        raise RuntimeError(f'no region matching "{want}" found on the canvas')

    def hover_found(self):
        self.hand.move_to(*self.to_screen(*self._found))

    def click_found(self):
        self.hand.click(*self.to_screen(*self._found))

    def play_sheet_video(self):
        """Move to the player's play button and press it, for real.

        openSheet() sets the src and calls load() but never plays, so without
        this the shot is a poster frame. The JS fallback exists because the
        native control bar's geometry is Chromium's business, not ours, and it
        must not be the thing that costs us the shot.
        """
        b = self.page.locator('#sheet-video').bounding_box()
        # The CENTER, not the control bar. A Chromium video that has never
        # played draws a large central play overlay, and clicking the body of a
        # video with controls toggles playback anyway. Aiming at the little
        # button in the control bar missed, because the bar spans the element
        # box while the picture inside it is letterboxed.
        self.hand.click(*self.to_screen(b['x'] + b['width'] / 2,
                                        b['y'] + b['height'] / 2))
        self.page.wait_for_timeout(500)
        if self.page.evaluate('document.getElementById("sheet-video").paused'):
            print('    play button missed; falling back to video.play()')
            self.page.evaluate('document.getElementById("sheet-video").play()')
        # Step off the video once it is running. Edge floats a
        # video-translate/picture-in-picture toolbar over whatever media element
        # the pointer rests on, and it would sit on top of the explainer for the
        # rest of the shot.
        self.hand.move_to(*self.to_screen(max(b['x'] - 90, 60),
                                          b['y'] + b['height'] * 0.72))


# --- checks ----------------------------------------------------------------

def measure_fps(page):
    """Count rAF callbacks over a second.

    The floor check. The panel is 240Hz so a healthy compositor reports well
    above the 60fps capture target; anything at or under it means the page is
    rendering slower than we are filming, and the clip will judder no matter
    what the container says.
    """
    return page.evaluate("""() => new Promise(res => {
        let n = 0; const t0 = performance.now();
        (function tick() { n++;
            if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
            else res(Math.round(n * 1000 / (performance.now() - t0))); })(); })""")


def assert_motion_on(page):
    """Reduced motion kills every reveal and both video shots. Assert it off."""
    if page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"):
        raise SystemExit('prefers-reduced-motion is REDUCE. Every GSAP reveal '
                         'and both video shots would be dead. emulate_media '
                         'did not take.')


# --- main ------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated shot ids')
    ap.add_argument('--probe', action='store_true',
                    help='run the choreography with no recording')
    ap.add_argument('--browser', help='path to a chromium-family exe')
    ap.add_argument('--seed', type=int, default=7,
                    help='pointer RNG seed; same seed reproduces the same motion')
    # Default 0 -- MEASURED, do not "optimize" this back on. Matching the
    # display to the capture rate is the obvious move and it is wrong here:
    # dropping the panel from 240Hz to 60Hz took gdigrab from 41 fps to 31,
    # because a grab that cannot finish inside one 16.7ms frame lands on the
    # next vsync and halves. At 240Hz the desktop presents every 4.2ms and the
    # grabber is not quantized nearly as hard.
    ap.add_argument('--refresh', type=int, default=0,
                    help='drop the display to this refresh rate while filming '
                         '(0, the default, leaves it alone). Measured to make '
                         'things WORSE on this machine; kept for other setups.')
    args = ap.parse_args()

    wanted = [s.strip() for s in args.only.split(',')] if args.only else None
    shots = [s for s in SHOTS if not wanted or s.id in wanted]
    if wanted:
        missing = set(wanted) - {s.id for s in shots}
        if missing:
            raise SystemExit(f'unknown shot(s): {", ".join(sorted(missing))}')
    if not shots:
        raise SystemExit('no shots selected')

    exe = find_browser(args.browser)
    if port_is_busy(C.CDP_PORT):
        raise SystemExit(
            f'something is already listening on {C.CDP_PORT}. Attaching to it '
            'would drive the wrong browser -- usually a leaked one from an '
            'earlier run, whose window is gone.\n  Close it, or:  Get-Process '
            'msedge | Stop-Process -Force')
    os.makedirs(C.CLIPS, exist_ok=True)
    profile = tempfile.mkdtemp(prefix='backing-profile-')
    seed_profile(profile)

    server = subprocess.Popen(
        [sys.executable, os.path.join(C.ROOT, 'prototypes', 'cpu-layers', 'serve.py')],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)

    hand = Hand(seed=args.seed)
    # Before the browser starts, so it comes up already vsynced to the rate we
    # are going to film at.
    prev_hz = set_refresh_rate(args.refresh) if not args.probe else None
    proc = subprocess.Popen([exe] + browser_flags(profile))
    time.sleep(4.0)

    rec = None
    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f'http://127.0.0.1:{C.CDP_PORT}')
            ctx = browser.contexts[0]
            ctx.set_default_timeout(30000)
            page, hwnd = pair_page_and_window(ctx, profile)
            for other in ctx.pages:
                if other is not page:
                    try:
                        other.close()     # sign-in and welcome surfaces
                    except Exception:
                        pass
            page.emulate_media(reduced_motion='no-preference')
            ctx.add_init_script(LINK_REWRITE)
            page.goto(C.BASE + '/', wait_until='domcontentloaded')
            assert_motion_on(page)

            fit_window(hwnd, page)
            # Nothing may sit on top of the browser: that rectangle is the
            # capture region, so an overlapping window is not just a lost
            # pointer event, it is in the footage.
            raise_window(hwnd)
            time.sleep(0.8)
            origin = viewport_origin(hwnd, page)

            fps = measure_fps(page)
            print(f'  compositor: {fps} fps')
            # 0.9, not 1.0: with the display dropped to the capture rate the
            # compositor sits AT that rate, and rAF counting jitters a frame or
            # two either side of it. Demanding strictly more would fail every
            # correctly-configured run.
            if fps < C.CAPTURE_FPS * 0.9:
                msg = (f'the page is rendering at {fps} fps, below the '
                       f'{C.CAPTURE_FPS} fps capture target, so every clip will '
                       'judder regardless of what the file claims.')
                if args.probe:
                    print('  !! ' + msg)
                else:
                    raise SystemExit(msg + '\n  Re-run with --probe to debug.')

            stage = Stage(page, hand, origin)
            stage.calibrate()

            # The recorder needs the calibrated content rectangle, so it is
            # built here rather than before the browser exists.
            if not args.probe:
                rec = Recorder(stage.region())
                print(f'  capture path: {rec.mode}, region {stage.region()}')

            for i, shot in enumerate(SHOTS):
                if shot not in shots:
                    continue
                n = i + 1
                print(f'[{n:02d}/{len(SHOTS)}] {shot.id}'
                      + (f' -- {shot.note}' if shot.note else ''))
                t0 = time.time()
                shot.prep(stage)

                path = os.path.join(C.CLIPS, f'{n:02d}-{shot.id}.mp4')
                if rec:
                    rec.start(path)
                start = time.time()
                try:
                    shot.action(stage)
                except Exception as e:
                    print(f'    !! action failed: {e}')
                # Hold the frame out to the full recording length. The dissolve
                # eats the last 0.6s of every clip, so the tail is never dead.
                left = shot.record - (time.time() - start)

                if left > 0:
                    hand.wander(left)
                elif left < -0.5:
                    print(f'    !! action overran by {-left:.1f}s')

                if rec:
                    rec.stop()
                    frames, secs = clip_stats(path)
                    want = shot.record * C.CAPTURE_FPS
                    # 0.72: with the output off OneDrive the steady state is
                    # ~46-54 of 60. Flagging every clip would train the eye to
                    # ignore the flag, so this catches a real collapse -- the
                    # printed rate shows the ordinary shortfall anyway.
                    flag = '' if frames > want * 0.72 else '   !! DROPPED FRAMES'
                    print(f'    {secs:.2f}s, {frames} frames '
                          f'({frames/max(secs,0.01):.0f} fps){flag}')
                else:
                    print(f'    choreography ran {time.time()-t0:.1f}s '
                          f'(budget {shot.record:.1f}s)')

    finally:
        hand.close()
        if prev_hz:
            set_refresh_rate(prev_hz)     # always give the panel back
        proc.terminate()          # the launcher, which is usually already gone
        kill_browser(profile)     # the browser it actually left behind
        server.terminate()
        time.sleep(0.6)
        shutil.rmtree(profile, ignore_errors=True)

    if not args.probe:
        print(f'\nclips in {C.CLIPS}\nnow: python tools/backing-video/assemble.py')


if __name__ == '__main__':
    main()
