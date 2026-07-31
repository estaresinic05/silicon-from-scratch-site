"""Drives the stage arrows with a real mouse and checks the contract.

Deliberately does NOT call __die.seek: the point is to exercise the same path a
visitor takes. Checks, per leg:
  - the forward arrow lands t EXACTLY on the next stop, not near it
  - both arrows are disabled while a leg is in flight
  - the scene is NOT pickable in flight and IS pickable once parked
  - the caption counter matches the stop
  - the page never scrolls
Then walks all the way back to prove reverse lands on the same stops.
"""
import re, sys, pathlib
from playwright.sync_api import sync_playwright

URL = "http://localhost:8777/meet-the-processor/"
SRC = pathlib.Path(__file__).resolve().parent.parent / "scene.js"

# the source is the authority on where the stops are; don't duplicate them here
STOPS = [float(x) for x in re.search(
    r"const STOPS = \[([^\]]+)\]", SRC.read_text(encoding="utf-8")).group(1).split(",")]

bad = []


def note(msg):
    bad.append(msg)
    print("  FAIL " + msg)


with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu",
                                 "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__die !== undefined", timeout=60000)
    pg.evaluate("window.__die.drift = false")

    n = len(STOPS)
    if pg.evaluate("window.__die.stops.length") != n:
        note(f"scene reports {pg.evaluate('window.__die.stops.length')} stops, source has {n}")

    # the page must not be a scroller at all
    if pg.evaluate("document.documentElement.scrollHeight > innerHeight + 2"):
        note("document is still taller than the viewport — it can be scrolled")

    print(f"{n} stops: {STOPS}")
    print("\nforward:")
    for i in range(1, n):
        pg.click("#nav-next")
        pg.wait_for_timeout(320)                     # mid-flight
        st = pg.evaluate("({f: window.__die.flying,"
                         " p: document.getElementById('nav-prev').disabled,"
                         " x: document.getElementById('nav-next').disabled})")
        if st["f"]:
            if not (st["p"] and st["x"]):
                note(f"leg {i}: arrows still enabled in flight")
            # a click on the canvas must do nothing while flying
            pg.mouse.click(720, 450)
            if not pg.evaluate("document.getElementById('sheet').hidden"):
                note(f"leg {i}: canvas click opened a sheet in flight")
        pg.wait_for_function("!window.__die.flying", timeout=30000)
        t = pg.evaluate("window.__die.t")
        cnt = pg.inner_text("#nav-count").strip()
        num = pg.inner_text("#cap-num").strip()
        ok = abs(t - STOPS[i]) < 1e-9
        print(f"  stop {i+1}  t={t:.6f}  want {STOPS[i]:.6f}  "
              f"nav={cnt!r} cap={num!r}  {'ok' if ok else 'OFF'}")
        if not ok:
            note(f"stop {i+1} parked at {t!r}, not exactly {STOPS[i]!r}")
        if cnt != f"{i+1} / {n}":
            note(f"stop {i+1}: counter reads {cnt!r}")
        if num != f"{i+1:02d}":
            note(f"stop {i+1}: caption number reads {num!r}")

    if not pg.evaluate("document.getElementById('nav-next').disabled"):
        note("forward arrow still enabled at the last stop")

    print("\nback:")
    for i in range(n - 2, -1, -1):
        pg.click("#nav-prev")
        pg.wait_for_function("!window.__die.flying", timeout=30000)
        t = pg.evaluate("window.__die.t")
        ok = abs(t - STOPS[i]) < 1e-9
        print(f"  stop {i+1}  t={t:.6f}  {'ok' if ok else 'OFF'}")
        if not ok:
            note(f"reverse to stop {i+1} parked at {t!r}")
    if not pg.evaluate("document.getElementById('nav-prev').disabled"):
        note("back arrow still enabled at the first stop")

    # picking must be live at a stop: go to the floorplan stop and hover a region
    print("\npickable at a stop:")
    for _ in range(3):
        pg.click("#nav-next")
        pg.wait_for_function("!window.__die.flying", timeout=30000)
    pg.wait_for_timeout(200)
    hit = None
    for x in range(360, 1200, 40):
        for y in range(220, 760, 40):
            pg.mouse.move(x, y)
            pg.wait_for_timeout(30)
            if pg.evaluate("window.__die.state.hover") is not None:
                hit = (x, y)
                break
        if hit:
            break
    if hit:
        print(f"  hover live at {hit}: {pg.evaluate('window.__die.state.hover.label')}")
        pg.mouse.click(*hit)
        pg.wait_for_timeout(250)
        if pg.evaluate("document.getElementById('sheet').hidden"):
            note("click at a stop did not open the sheet")
        else:
            print(f"  sheet opened: {pg.inner_text('#sheet-title')!r}")
            if not pg.evaluate("document.getElementById('nav-next').disabled"):
                note("arrows still enabled while the sheet is open")
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(200)
            if not pg.evaluate("document.getElementById('nav-next').disabled"):
                print("  arrows re-enabled after close: ok")
            else:
                note("arrows still disabled after the sheet closed")
    else:
        note("nothing hoverable anywhere at the floorplan stop")

    if errs:
        note(f"console: {errs[:4]}")
    b.close()

print("\nissues:", "none" if not bad else f"{len(bad)}")
sys.exit(1 if bad else 0)
