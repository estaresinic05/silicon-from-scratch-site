"""How much of stop 07's labeled cell is inside the frame, in NDC.

Pixel-peeping a phone screenshot cannot tell 'the OUT label just clears the edge'
from 'it just does not'. __die.cellFrame projects the four pin names through the
live camera; |x| and |y| under 1 are inside the frame. This is what the
narrow-viewport pull weight for stop 07 is tuned against.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
VIEWS = [(1440, 900), (430, 932), (390, 844), (360, 800), (320, 690)]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    for w, h in VIEWS:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_function("window.__die !== undefined", timeout=60000)
        pg.evaluate("window.__die.drift = false")
        pg.evaluate("window.__die.seek(0.99)")
        pg.wait_for_function("Math.abs(window.__die.t - 0.99) < 0.005", timeout=90000)
        pg.wait_for_timeout(2600)      # the cell assembles on arrival
        frame = pg.evaluate("JSON.parse(JSON.stringify(window.__die.cellFrame))")
        worst = max(v[0] for v in frame.values())
        print(f"--- {w}x{h}  aspect {w/h:.3f}   worst |x| {worst:.3f}"
              f"{'   CLIPPED' if worst > 1 else ''}")
        for word, (x, y) in sorted(frame.items()):
            print(f"      {word:4s} |x| {x:5.3f}   |y| {y:5.3f}")
        pg.close()
    b.close()
