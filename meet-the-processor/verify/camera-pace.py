"""Camera speed in world units per SECOND, sampled the way a viewer sees it.

camera-continuity.py samples evenly in t and catches the camera stopping. This
catches the opposite fault: the camera sprinting. Speed in t is not speed on
screen, because a leg maps its duration onto t through a smoothstep, so this
walks the wall clock and converts.

What matters is the ratio of the fastest moment in a leg to its median. A leg
that dives ten units in two seconds and then orbits four units over nine is not
one move, it is a lunge followed by a drift, however smooth each part is.

    python verify/camera-pace.py
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
STOPS = [0.000, 0.398, 0.512, 0.800, 0.888, 0.976]
# Read from source rather than copied here: a stale duration in the harness
# silently reports the wrong speeds, which is worse than not measuring.
import os, re
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scene.js"),
            encoding="utf-8").read()
LEG_MS = [int(x) for x in
          re.search(r"const LEG_MS = \[([^\]]+)\]", _src).group(1).split(",")]
N = 600

ss = lambda x: x * x * (3 - 2 * x)

# Position alone is not the measure. The opening leg moves 32 world units a
# second and looks stately; the dive into a core moves 4 and looks like a lunge.
# The difference is standoff: the same travel 90 units from the subject barely
# shifts the frame, and 3 units from it sweeps across the whole of it. So divide
# by the distance to the look-at point and compare RADIANS per second, which is
# roughly what the eye is actually judging.
SAMPLE = """
(ts) => ts.map((t) => { const s = window.__die.probe(t); return [s.p, s.l]; })
"""

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                 "--enable-unsafe-swiftshader"])
    pg = br.new_page(viewport={"width": 800, "height": 500})
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    keys = pg.evaluate("window.__die.keyTimes")

    print(f'{"leg":>14} {"dur":>6} {"med rad/s":>10} {"peak":>8} {"peak/med":>9}   where')
    worst = 0
    for i, (a, b) in enumerate(zip(STOPS, STOPS[1:])):
        dur = LEG_MS[i]
        ts = [a + (b - a) * ss(j / N) for j in range(N + 1)]
        rows = pg.evaluate(SAMPLE, ts)
        dt = dur / N / 1000.0
        sp = []
        for (pu, lu), (pv, _) in zip(rows, rows[1:]):
            d = sum((pv[k] - pu[k]) ** 2 for k in range(3)) ** 0.5
            standoff = max(0.4, sum((pu[k] - lu[k]) ** 2 for k in range(3)) ** 0.5)
            sp.append(d / standoff / dt)      # radians/sec, near enough
        srt = sorted(sp)
        med = srt[len(srt) // 2]
        peak = srt[-1]
        j = sp.index(peak)
        at = ts[j]
        near = min(keys, key=lambda k: abs(k - at))
        ratio = peak / med if med else 0
        worst = max(worst, ratio)
        print(f"{a:6.3f}->{b:5.3f} {dur:6} {med:10.3f} {peak:8.3f} {ratio:9.2f}   "
              f"t={at:.3f} near key {near:.3f}")
    print(f"\nworst peak/median across all legs: {worst:.2f}"
          f"   ({'FAIL - a lunge' if worst > 2.2 else 'pass'})")
    br.close()
