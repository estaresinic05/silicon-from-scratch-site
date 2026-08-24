"""Render the three looping clips that live inside the home page's hero card.

  python tools/render-hero-loops.py            # all three, full render
  python tools/render-hero-loops.py probe      # 3 frames per clip, no encode
  python tools/render-hero-loops.py lid metal  # just those clips

Needs the site served over HTTP, because the scene is ES modules plus an import
map:

  python tools/serve.py

This is the sibling of prototypes/cpu-layers/render/render-video.py, which
renders the whole 75-second descent. Read that one first — every hazard it
documents applies here too. Three things differ:

  * it drives the SHIPPED scene at /meet-the-processor/, not the prototype,
    whose scene.js predates it;
  * it hides the page's 2D chrome, because a clip that is going to sit in a
    card must be canvas and nothing else;
  * t ramps LINEARLY inside a short window rather than following pace.py's
    whole-descent speed curve, which has nothing to say about a five-second
    excerpt.

Looping. A clip that cuts from its last frame back to its first is a visible
jolt, and these sit on a landing page where the jolt would repeat every few
seconds. The last XFADE frames are cross-dissolved into the first, which costs
those frames off the end and buys a seam nobody can see. The clip is therefore
shorter than the frames rendered for it, which is why FRAMES and the emitted
duration do not match.
"""
import sys, os, time, subprocess, shutil
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'assets', 'home')
TMP = os.path.join(os.environ.get('TEMP', '.'), 'mtp-hero-frames')
URL = 'http://127.0.0.1:8777/meet-the-processor/'

FPS = 60
SS = 1.5          # supersample, downscaled with lanczos at encode time
XFADE = 24        # frames of cross-dissolve closing the loop (0.4s at 60fps)

# Every 2D layer over the canvas. #stage and #gl stay.
CHROME = ('#loader, #sitebar, #caption, #rail, #hint, #pins, '
          '#credit, #nav, #sheet { display: none !important; }')

# The three durations are deliberately unequal, and that is the whole mechanism
# that keeps the card from beating in unison. Three five-second loops started
# together cut back to their first frame at the same instant, for ever, and the
# card reads as one flashing object rather than three windows onto one descent.
# Unequal lengths drift apart on their own with no JavaScript holding them
# there. An earlier version staggered currentTime from a script instead, which
# was worse in every way: it depended on metadata arriving before playback
# began, and when it did not, it jumped all three panels mid-loop.
# crf is per clip because the panels are not the same size on screen. The wide
# one draws about 570 CSS px across and gets the careful setting; the two small
# ones draw about 287 and are therefore already sampled at better than 2x, where
# the extra quantization has nowhere to show itself.
CLIPS = [
    # name     t0      t1     secs   W     H   crf   what it shows
    # Opens at 0.020 rather than 0.100 so the lid is still seated for the first
    # second or so and the viewer gets to read the package as a packaged chip
    # before it comes apart. A delid with nothing to delid is just a moving
    # object. The length grew in proportion to the widened span, so the lift
    # itself runs at the pace it always did.
    # 7.875s, which is 6.3 at 0.8x: the delid was still going by faster than the
    # panel deserved. The span is untouched, so this is the same shot read more
    # slowly, and the frame count rises with the duration rather than the clip
    # being retimed — every frame is still rendered at its own t.
    ('lid',   0.020, 0.400, 7.875, 1280,  560, 27),  # lid lifts, dies revealed
    # 11.2s, twice the 5.6 it ran at. The span is unchanged, so this is purely a
    # slower read of the same 22-beat reveal: at 5.6 the blocks arrived faster
    # than a viewer glancing at a 287px panel could follow, and the panel read as
    # motion rather than as a core being assembled. The frame count doubles with
    # the duration, so nothing is stretched or resampled — every frame is still
    # rendered at its own t.
    ('core',  0.580, 0.800, 11.2,  640,  480, 31),  # the core's blocks rising
    # 0.905 is the framing README.md warns off — the camera sits under a tier
    # and it fills the frame as unreadable brown. Stop while the tiers still
    # read as tiers.
    # Starting at 0.850 spent the first second of a five-second panel on a flat
    # unseparated plate, which in a 287px box is a brown rectangle. Start where
    # the tiers have already come apart.
    ('metal', 0.862, 0.888,  4.4,  640,  480, 31),  # copper tiers cascading
]


def frames_for(secs):
    return int(round(secs * FPS)) + XFADE


def render(page, name, t0, t1, secs, w, h, probe):
    """Screenshot the scene across [t0, t1] into TMP/<name>/f%05d.jpg."""
    n = 3 if probe else frames_for(secs)
    ts = np.linspace(t0, t1, n)
    d = os.path.join(TMP, name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        try:
            os.remove(os.path.join(d, f))
        except OSError:
            pass

    page.set_viewport_size({'width': w, 'height': h})
    page.wait_for_timeout(400)          # let the scene re-fit the new aspect
    start = time.time()
    print(f'  {name}: {n} frames, t {t0:.3f} -> {t1:.3f}, {w}x{h}', flush=True)
    for i, t in enumerate(ts):
        page.evaluate('(t)=>window.__die.seek(t)', float(t))
        # Self-animation — the copper stack's traveling pulse — must advance by
        # FRAME, not by wall clock, or it jitters by however long each frame
        # took to encode. Same hazard the camera drift has, same fix.
        page.evaluate('(ms)=>{window.__die.clock = ms;}', i / FPS * 1000.0)
        page.evaluate('()=>new Promise(r=>requestAnimationFrame('
                      '()=>requestAnimationFrame(r)))')
        page.screenshot(path=f'{d}/f{i:05d}.jpg', type='jpeg', quality=95)
        if i and i % 60 == 0:
            el = time.time() - start
            print(f'    {i}/{n}  {el/60:.1f}min elapsed, '
                  f'~{el/i*(n-i)/60:.1f}min left', flush=True)
    return d, n


def close_the_loop(d, n):
    """Cross-dissolve the tail back into the head, in place.

    Output is m = n - XFADE frames. Frame i < XFADE becomes a blend of itself
    with frame i + m, which is the tail frame that would otherwise have cut to
    it. Written to a second directory so a half-finished blend can never be
    read back as source.
    """
    m = n - XFADE
    out = d + '-loop'
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        try:
            os.remove(os.path.join(out, f))
        except OSError:
            pass
    for i in range(m):
        head = Image.open(f'{d}/f{i:05d}.jpg')
        if i < XFADE:
            tail = Image.open(f'{d}/f{i+m:05d}.jpg')
            # i/XFADE: at i=0 the tail is fully present, so the frame after the
            # last one is identical to the first. That is the seam, closed.
            head = Image.blend(tail, head, i / XFADE)
        head.save(f'{out}/f{i:05d}.jpg', quality=95)
    return out, m


def encode(src, name, w, h, crf):
    mp4 = os.path.join(OUTDIR, f'mtp-{name}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error',
                    '-framerate', str(FPS), '-i', f'{src}/f%05d.jpg',
                    '-vf', f'scale={w}:{h}:flags=lanczos',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf),
                    '-pix_fmt', 'yuv420p', '-an',
                    '-movflags', '+faststart', mp4], check=True)
    poster = os.path.join(OUTDIR, f'mtp-{name}-poster.jpg')
    Image.open(f'{src}/f00000.jpg').resize((w, h), Image.LANCZOS) \
         .save(poster, quality=80, optimize=True)
    return mp4, poster


def main():
    args = [a for a in sys.argv[1:]]
    probe = 'probe' in args
    wanted = [a for a in args if a != 'probe']
    clips = [c for c in CLIPS if not wanted or c[0] in wanted]
    if not clips:
        raise SystemExit(f'no clip matches {wanted}; known: '
                         + ', '.join(c[0] for c in CLIPS))

    os.makedirs(OUTDIR, exist_ok=True)
    # Open at the largest clip's size so the first viewport resize is a shrink.
    # Indices are into the CLIPS tuple: 4 and 5 are W and H.
    big = max(clips, key=lambda c: c[4] * c[5])
    start = time.time()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu',
                                    '--ignore-gpu-blocklist',
                                    '--hide-scrollbars'])
        pg = b.new_page(viewport={'width': big[4], 'height': big[5]},
                        device_scale_factor=SS, reduced_motion='reduce')
        pg.goto(URL, wait_until='networkidle')
        pg.wait_for_function('window.__die !== undefined', timeout=120000)
        pg.add_style_tag(content=CHROME)
        pg.wait_for_timeout(5000)        # every texture in place before frame 0
        pg.evaluate('window.__die.drift = false')
        st = pg.evaluate('JSON.parse(JSON.stringify(window.__die.state))')
        print(f"pixelRatio {st['dpr']}  antialias {st['aa']}")

        rendered = []
        for name, t0, t1, secs, w, h, crf in clips:
            d, n = render(pg, name, t0, t1, secs, w, h, probe)
            rendered.append((name, d, n, w, h, crf))
        b.close()

    if probe:
        print(f'probe frames under {TMP}')
        return

    for name, d, n, w, h, crf in rendered:
        src, m = close_the_loop(d, n)
        mp4, poster = encode(src, name, w, h, crf)
        print(f'  {name}: {os.path.getsize(mp4)/1e6:.2f} MB mp4, '
              f'{os.path.getsize(poster)/1e3:.0f} KB poster, '
              f'{m/FPS:.2f}s loop')
        shutil.rmtree(d, ignore_errors=True)
        shutil.rmtree(src, ignore_errors=True)
    print(f'done in {(time.time()-start)/60:.1f}min')


if __name__ == '__main__':
    main()
