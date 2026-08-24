"""Instantaneous camera speed along each leg, and the velocity dips in it.

camera-speed.py measures the AVERAGE speed of each segment, which says whether
two keys are too far apart for the time between them. It cannot see the problem
this checks for: the camera stopping dead AT a key and starting again.

Sampling the real sampleCamera through window.__die.seek and differencing the
position gives instantaneous speed. What matters is the ratio of the slowest
point inside a leg to that leg's median. Easing inside every segment drove that
ratio to ~0 at every interior key: eleven of them on the macro-to-core leg, which
is what read as the pan moving in little chunks. Interpolating the keys with a
C1 curve should leave no interior point near zero.

Run headless with the dev server up:  python verify/camera-continuity.py
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
# Read from source rather than copied here: a hardcoded stop list in a harness
# goes stale silently, reports the wrong legs, and is worse than not measuring.
# This one had been wrong since the tail was last retimed.
import os, re as _re
_stops_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "..", "scene.js"), encoding="utf-8").read()
STOPS = [float(x) for x in
         _re.search(r"const STOPS = \[([^\]]+)\]", _stops_src).group(1).split(",")]
N = 400          # samples per leg

SAMPLE = """
(arg) => {
  const [a, b, n] = arg;
  const out = [];
  for (let i = 0; i <= n; i++) {
    out.push(window.__die.probe(a + (b - a) * i / n).p);
  }
  return out;
}
"""

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader"])
    pg = br.new_page(viewport={"width": 800, "height": 500})
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.evaluate("window.__die.drift = false")     # drift would swamp the signal

    print(f'{"leg":>14} {"median":>8} {"min":>8} {"min/med":>8}   verdict')
    worst = 1.0
    for a, b in zip(STOPS, STOPS[1:]):
        cam = pg.evaluate(SAMPLE, [a, b, N])
        sp = []
        for u, v in zip(cam, cam[1:]):
            sp.append(sum((v[k] - u[k]) ** 2 for k in range(3)) ** 0.5)
        sp_sorted = sorted(sp)
        med = sp_sorted[len(sp_sorted) // 2]
        # ignore the two ends: the leg is MEANT to start and stop at rest there
        skip = len(sp) // 20
        inner = sp[skip:-skip]
        lo = min(inner)
        at = a + (b - a) * (skip + inner.index(lo)) / len(sp)
        # Slowing through a genuine corner is fine; slowing AT a key is the
        # artifact this exists to catch, so say which one it is.
        keys = pg.evaluate("window.__die.keyTimes")
        near = min(keys, key=lambda k: abs(k - at))
        where = f"t={at:.3f} {'AT KEY ' + format(near, '.3f') if abs(near - at) < (b - a) / 60 else '(mid-segment)'}"
        ratio = lo / med if med else 0
        worst = min(worst, ratio)
        print(f"{a:6.3f}->{b:5.3f} {med:8.4f} {lo:8.4f} {ratio:8.2f}   "
              f"{'STALLS' if ratio < 0.25 else 'ok':6}  {where}")
    print(f"\nworst interior speed ratio across all legs: {worst:.2f}"
          f"  ({'FAIL' if worst < 0.25 else 'pass'})")

    # --- overshoot -----------------------------------------------------
    # Rounding a corner means the curve leaves the box its two keys define. That
    # is intended, but it must stay small: this camera flies between tiers of the
    # metal stack about a unit apart, so a large bulge would put it inside one.
    keys = pg.evaluate("window.__die.keyTimes")
    print(f'\n{"segment":>16} {"overshoot":>10}   (world units outside the key box)')
    worst_over, worst_seg = 0.0, None
    for a, b in zip(keys, keys[1:]):
        pts = pg.evaluate(SAMPLE, [a, b, 120])
        ends = (pts[0], pts[-1])
        out = 0.0
        for q in pts:
            for k in range(3):
                lo = min(ends[0][k], ends[1][k])
                hi = max(ends[0][k], ends[1][k])
                out = max(out, lo - q[k], q[k] - hi)
        if out > worst_over:
            worst_over, worst_seg = out, (a, b)
        if out > 0.05:
            print(f"{a:7.3f}->{b:5.3f} {out:10.3f}")
    print(f"\nworst overshoot: {worst_over:.3f} units at {worst_seg}")
    br.close()
