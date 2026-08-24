"""The Windows pointer, driven so it reads as a hand rather than a script.

This is the half of the backing-video harness that Playwright cannot do.
Playwright's mouse dispatches CDP input events; it never moves the OS cursor, so
a screen recording of a Playwright session shows a page operating itself with no
pointer in frame. Everything here goes through user32 instead, which means the
real cursor moves, the recording's `draw_mouse` draws it, and the browser
receives genuine hardware input -- so :hover fires for free.

Cost, and it is not small: the physical mouse and the script fight for the same
pointer. While a capture runs the machine belongs to the capture.

What makes a mouse path look human, in the order the eye notices it missing:

  1. SPEED CURVE. A hand accelerates, cruises, and decelerates into the target.
     Linear interpolation between two points is the single biggest tell, far
     ahead of the path being straight. Every move here is played on a
     minimum-jerk profile, which is the measured signature of human reaching.
  2. CURVATURE. Hands arc. Control points are thrown perpendicular to the
     straight line, and the sign alternates between moves so consecutive
     gestures do not all bow the same way.
  3. OVERSHOOT. Long throws land past the target and settle back. Short ones do
     not -- a hand only overshoots when it was moving fast enough to.
  4. NEVER PERFECTLY STILL. A held hand drifts by a pixel or two. A frozen
     cursor between actions is a tell, and a 5.6 second shot is a long time to
     hold a pixel exactly.

Emission runs at EMIT_HZ = 480, comfortably above the 60fps capture, so no
captured frame ever catches the pointer parked between two SetCursorPos calls.
The margin is deliberate rather than tuned to the capture rate: it costs almost
nothing, and it means changing CAPTURE_FPS never silently degrades the motion.
Windows will not schedule a 2ms sleep accurately, so the step loop spins on
perf_counter and asks the multimedia timer for 1ms resolution to keep the
spinning cheap.
"""
import ctypes
import math
import random
import time
from ctypes import wintypes

user32 = ctypes.WinDLL('user32', use_last_error=True)
winmm = ctypes.WinDLL('winmm')

EMIT_HZ = 480          # pointer updates per second, well above any capture rate
WHEEL_DELTA = 120      # one notch, per the Win32 contract

# Per-monitor DPI aware v2. Without this a process on a 150% display is fed
# virtualised coordinates and SetCursorPos lands 2/3 of the way to where it was
# asked. The capture calibrates the page->screen map empirically anyway, but it
# calibrates a *stable* map only if awareness is settled before the first move.
DPI_PER_MONITOR_AWARE_V2 = ctypes.c_void_p(-4)


def _set_dpi_awareness():
    try:
        user32.SetProcessDpiAwarenessContext(DPI_PER_MONITOR_AWARE_V2)
    except AttributeError:                      # pre-1703
        try:
            ctypes.WinDLL('shcore').SetProcessDpiAwareness(2)
        except Exception:
            pass


# --- SendInput plumbing ----------------------------------------------------
# mouse_event still works but has been deprecated since Vista and is documented
# as such; SendInput is the supported path and is what a real device driver's
# input looks like coming out of the other end.

ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG),
                ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
                ('time', wintypes.DWORD), ('dwExtraInfo', ULONG_PTR)]


class _INPUTunion(ctypes.Union):
    _fields_ = [('mi', MOUSEINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [('type', wintypes.DWORD), ('u', _INPUTunion)]


INPUT_MOUSE = 0
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_WHEEL = 0x0800

# Virtual-screen metrics, for the absolute-coordinate normalization below.
SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN = 76, 77
SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN = 78, 79


def _send(flags, data=0, dx=0, dy=0):
    inp = INPUT(type=INPUT_MOUSE,
                u=_INPUTunion(mi=MOUSEINPUT(dx, dy, data, flags, 0, 0)))
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))


class POINT(ctypes.Structure):
    _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]


# --- timing ----------------------------------------------------------------

def _spin_until(deadline):
    """Sleep to roughly `deadline`, then spin the last millisecond.

    time.sleep on Windows quantizes to the system timer, so a bare sleep(1/480)
    lands anywhere from 2ms to 16ms later. Sleeping the bulk and spinning the
    remainder costs a little CPU and buys a pointer that actually moves at the
    rate it claims to.
    """
    while True:
        left = deadline - time.perf_counter()
        if left <= 0:
            return
        if left > 0.0015:
            time.sleep(left - 0.0012)
        # else: spin


# --- easing and geometry ---------------------------------------------------

def min_jerk(u):
    """The minimum-jerk position profile: 10u^3 - 15u^4 + 6u^5.

    Zero velocity AND zero acceleration at both ends, which is why it reads as a
    limb rather than a slider. Any easing is better than none, but this one is
    the shape human reaching actually measures out to.
    """
    return u * u * u * (10.0 + u * (-15.0 + 6.0 * u))


def ease_in_out(u):
    return 0.5 - 0.5 * math.cos(math.pi * u)


def _bezier(p0, p1, p2, p3, u):
    v = 1.0 - u
    a, b, c, d = v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


class Hand:
    """A pointer that behaves like it is attached to someone.

    All coordinates are PHYSICAL screen pixels. Translating page coordinates
    into these is the caller's job -- capture.py calibrates that map against the
    live browser rather than deriving it from the DPI scale, because deriving it
    is exactly the kind of arithmetic that is right on one machine.
    """

    def __init__(self, seed=None, dry_run=False):
        self.rng = random.Random(seed)
        self.dry_run = dry_run
        self._arc_sign = 1          # flipped every move so arcs alternate
        self._tremor = (0.0, 0.0)   # low-passed, so it drifts instead of buzzing
        if not dry_run:
            _set_dpi_awareness()
            winmm.timeBeginPeriod(1)

    def close(self):
        if not self.dry_run:
            winmm.timeEndPeriod(1)

    # -- primitives --------------------------------------------------------

    def pos(self):
        if self.dry_run:
            return getattr(self, '_fake', (0, 0))
        p = POINT()
        user32.GetCursorPos(ctypes.byref(p))
        return (p.x, p.y)

    def _put(self, x, y):
        """Move the pointer by INJECTING an input event, not by SetCursorPos.

        This distinction cost an afternoon and is the single least obvious thing
        in this file. SetCursorPos relocates the cursor and updates what
        GetCursorPos reports, so it looks like it worked from the outside -- but
        it does not push anything through the input queue, and a Chromium window
        under the new position receives no WM_MOUSEMOVE and fires no mousemove.
        The page sees nothing at all while the cursor sits visibly on top of it.

        SendInput with MOUSEEVENTF_ABSOLUTE is a real injected event and behaves
        exactly like the physical mouse, which is the entire premise of this
        harness.

        Absolute coordinates are normalized to 0..65535 across the VIRTUAL
        desktop (all monitors), not the primary one -- hence VIRTUALDESK and the
        virtual-screen origin. On a 2560-wide desktop one unit is about 0.04px,
        so the quantization is far below the sub-pixel tremor.
        """
        if self.dry_run:
            self._fake = (int(round(x)), int(round(y)))
            return
        vx = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
        vy = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
        vw = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
        vh = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
        nx = int(round((x - vx) * 65535.0 / max(vw - 1, 1)))
        ny = int(round((y - vy) * 65535.0 / max(vh - 1, 1)))
        _send(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
              dx=max(0, min(65535, nx)), dy=max(0, min(65535, ny)))

    def _tremble(self):
        """A drifting sub-pixel wobble, not white noise.

        Fresh randomness every step buzzes; at 240fps that buzz is visible and
        reads as a broken cursor. Filtering it into a random walk gives the
        slow wander a resting hand has.
        """
        tx, ty = self._tremor
        tx = tx * 0.86 + self.rng.gauss(0, 0.30)
        ty = ty * 0.86 + self.rng.gauss(0, 0.30)
        tx, ty = max(-0.9, min(0.9, tx)), max(-0.9, min(0.9, ty))
        self._tremor = (tx, ty)
        return tx, ty

    # -- movement ----------------------------------------------------------

    def _duration_for(self, dist):
        """Fitts-flavored: distance costs logarithmically, not linearly.

        Doubling the distance does not double the time -- the hand just moves
        faster. Clamped at both ends so a nudge is not instant and a corner-to-
        corner throw does not crawl.
        """
        return max(0.35, min(1.4, 0.20 + 0.35 * math.log2(dist / 60.0 + 1.0)))

    def _leg(self, start, end, duration, arc=True):
        """One eased, arced, trembling traverse. The primitive everything uses."""
        dx, dy = end[0] - start[0], end[1] - start[1]
        dist = math.hypot(dx, dy)
        if dist < 1.0:
            self._put(*end)
            return

        if arc and dist > 40:
            # Perpendicular throw of 8-18% of the span. Alternating the sign
            # per move is what stops a sequence of gestures from all bowing the
            # same way, which is its own kind of robotic.
            k = self.rng.uniform(0.08, 0.18) * dist * self._arc_sign
            px, py = -dy / dist, dx / dist
            c1 = (start[0] + dx * 0.30 + px * k, start[1] + dy * 0.30 + py * k)
            c2 = (start[0] + dx * 0.68 + px * k * 0.55,
                  start[1] + dy * 0.68 + py * k * 0.55)
        else:
            c1 = (start[0] + dx * 0.30, start[1] + dy * 0.30)
            c2 = (start[0] + dx * 0.68, start[1] + dy * 0.68)

        steps = max(2, int(duration * EMIT_HZ))
        t0 = time.perf_counter()
        for i in range(1, steps + 1):
            u = min_jerk(i / steps)
            x, y = _bezier(start, c1, c2, end, u)
            tx, ty = self._tremble()
            # The tremor fades out as the pointer arrives, so the click lands on
            # the pixel that was aimed at rather than one nearby.
            fade = 1.0 - u * u
            self._put(x + tx * fade, y + ty * fade)
            _spin_until(t0 + duration * (i / steps))
        self._arc_sign *= -1

    def move_to(self, x, y, duration=None):
        start = self.pos()
        dist = math.hypot(x - start[0], y - start[1])
        if dist < 1.5:
            return
        duration = duration or self._duration_for(dist)

        # Overshoot only on throws long enough to have built speed. Below the
        # threshold a hand simply arrives, and faking a correction there looks
        # like a twitch.
        if dist > 400:
            over = self.rng.uniform(0.02, 0.05)
            ox = x + (x - start[0]) / dist * dist * over
            oy = y + (y - start[1]) / dist * dist * over
            self._leg(start, (ox, oy), duration * 0.85)
            time.sleep(self.rng.uniform(0.03, 0.06))     # the beat before the fix
            self._leg((ox, oy), (x, y), self.rng.uniform(0.10, 0.15), arc=False)
        else:
            self._leg(start, (x, y), duration)

    def wander(self, seconds):
        """Idle drift, for the beats between actions.

        A cursor that holds a pixel exactly is the giveaway that nothing is
        holding it. This is deliberately aimless: a couple of short, slow,
        nearby moves.
        """
        end = time.perf_counter() + seconds
        while time.perf_counter() < end:
            x, y = self.pos()
            left = end - time.perf_counter()
            if left < 0.12:
                _spin_until(end)
                return
            self._leg((x, y),
                      (x + self.rng.uniform(-6, 6), y + self.rng.uniform(-6, 6)),
                      min(left, self.rng.uniform(0.25, 0.55)), arc=False)

    # -- buttons -----------------------------------------------------------

    def click(self, x=None, y=None, settle=True):
        if x is not None:
            self.move_to(x, y)
        if settle:
            # The pause between arriving and pressing. Without it the click is
            # simultaneous with the arrival and reads as a teleport-and-fire.
            time.sleep(self.rng.uniform(0.08, 0.20))
        if not self.dry_run:
            _send(MOUSEEVENTF_LEFTDOWN)
            time.sleep(self.rng.uniform(0.06, 0.11))
            _send(MOUSEEVENTF_LEFTUP)
        else:
            time.sleep(0.08)

    def drag(self, x0, y0, x1, y1, duration=1.0):
        """Press, traverse, release -- with the traverse eased like any move.

        Used for the inverter-layout slider, whose track listens on pointerdown
        and captures the pointer, so the press must land on the track and the
        button must stay down for the whole sweep.
        """
        self.move_to(x0, y0)
        time.sleep(self.rng.uniform(0.10, 0.18))
        if not self.dry_run:
            _send(MOUSEEVENTF_LEFTDOWN)
        time.sleep(self.rng.uniform(0.05, 0.09))
        self._leg((x0, y0), (x1, y1), duration, arc=False)
        time.sleep(self.rng.uniform(0.08, 0.14))
        if not self.dry_run:
            _send(MOUSEEVENTF_LEFTUP)

    # -- wheel -------------------------------------------------------------

    def scroll(self, notches, duration=1.6, x=None, y=None):
        """Real wheel input, eased across `duration`.

        Deliberately not window.scrollTo. Wheel events drive ScrollTrigger
        exactly the way a visitor's do, and Chrome applies its own smooth-scroll
        animation on top -- which is the motion the site was tuned against. A
        scripted scrollTo produces a glide the page has never seen and the
        reveals fire at the wrong moments.

        Negative notches scroll up.
        """
        if x is not None:
            self.move_to(x, y)
        n = abs(int(notches))
        if n == 0:
            return
        sign = -1 if notches < 0 else 1
        t0 = time.perf_counter()
        for i in range(n):
            if not self.dry_run:
                _send(MOUSEEVENTF_WHEEL, ctypes.c_int32(-sign * WHEEL_DELTA).value)
            # Eased spacing: the gaps are widest at the start and end, so the
            # scroll ramps in and settles out instead of starting at full speed.
            _spin_until(t0 + duration * ease_in_out((i + 1) / n))
            self._tremble()
