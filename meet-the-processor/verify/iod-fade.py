"""Walk the I/O die's exit and report whether it is still drawn and how opaque.

Exists because the die's fade was silently dead: iodGroup is a child of the
package group, whose visibility went false at t 0.455 while the die's own fade
did not start until 0.505. Every opacity below that was computed against an
object nothing was drawing. A cliff in this table is that failure.

Uses the same settle-on-window.__die.t pattern as shot.py — the scroll is
damped, so a fixed timeout samples the wrong frame.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
TS = [0.380 + i * 0.012 for i in range(23)]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 800, "height": 500})
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.evaluate("window.__die.drift = false")
    rows = []
    for t in TS:
        pg.evaluate("(t)=>window.__die.seek(t)", t)
        pg.wait_for_function("(t)=>Math.abs(window.__die.t-t)<0.004", arg=t, timeout=60000)
        s = pg.evaluate("JSON.parse(JSON.stringify(window.__die.state))")
        rows.append((s['t'], s['iodVisible'], s['iodAlpha']))
    b.close()

print(f"{'t':>7} {'drawn':>7} {'alpha':>7}   fade")
prev = None
bad = 0
for t, vis, a in rows:
    bar = '#' * round(a * 40)
    flag = ''
    if prev is not None and prev > 0.05 and (a < 0.005 or not vis):
        flag = '   <-- CUT OFF MID-FADE'; bad += 1
    if a > 0.005 and not vis:
        flag = '   <-- fading but not drawn'; bad += 1
    print(f"{t:7.3f} {str(vis):>7} {a:7.3f}   {bar}{flag}")
    prev = a
print(f"\n{'FAIL' if bad else 'OK'}: {bad} frame(s) where the fade and the visibility disagree")
