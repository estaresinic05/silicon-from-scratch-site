"""Screenshot the lid at a few scroll positions, waiting for the damped
scroll state (window.__die.t) to converge rather than on a fixed timeout."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
TARGETS = [float(a) for a in sys.argv[1:]] or [0.03, 0.14, 0.22]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: print("  console:", m.type, m.text[:200]))
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=60000); pg.evaluate("window.__die.drift = false")

    for t in TARGETS:
        pg.evaluate(
            "(t)=>window.__die.seek(t)", t)
        pg.wait_for_function(
            "(t) => Math.abs(window.__die.t - t) < 0.005", arg=t, timeout=90000)
        # 700ms, not 250. seek() is instant, where the old scroll-driven chase
        # took about a second to converge — long enough that the caption's 0.55s
        # swap animation was always over by capture time. Now it isn't, and a
        # short wait caught the caption mid-fade and rendered it invisible.
        pg.wait_for_timeout(700)
        out = f"lid_t{int(t*1000):04d}.png"
        pg.screenshot(path=out, timeout=120000)
        print(f"t={t} -> {out}  state={pg.evaluate('JSON.stringify(window.__die)')}")
    b.close()
