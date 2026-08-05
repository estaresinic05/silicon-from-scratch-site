"""Does everything in the phone top bar fit, at every width worth caring about.

Prints each bar child's box and the slack left over, plus the gap from the last
control to the screen edge. Two 44px targets are fixed, so the budget is mostly
spent before any type is placed — this is what says whether a change to the bar
has spent width it did not have.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
VIEWS = [(430, 932), (390, 844), (375, 812), (360, 800), (320, 690)]

PROBE = """
() => {
  const inner = document.querySelector('.sitebar__inner');
  const cs = getComputedStyle(inner);
  const kids = [...inner.children].filter(
    (e) => getComputedStyle(e).display !== 'none');
  return {
    padL: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight),
    gap: parseFloat(cs.columnGap) || 0,
    width: inner.getBoundingClientRect().width,
    kids: kids.map((e) => {
      const r = e.getBoundingClientRect();
      return { name: e.className || e.tagName.toLowerCase(),
               x: +r.left.toFixed(1), w: +r.width.toFixed(1),
               h: +r.height.toFixed(1) };
    }),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    for w, h in VIEWS:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_function("window.__die !== undefined", timeout=60000)
        r = pg.evaluate(PROBE)
        used = sum(k["w"] for k in r["kids"]) + r["gap"] * (len(r["kids"]) - 1)
        room = r["width"] - r["padL"] - r["padR"]
        last = r["kids"][-1]
        print(f"--- {w}x{h}   room {room:.1f}  used {used:.1f}  "
              f"slack {room - used:+.1f}   right edge gap "
              f"{r['width'] - (last['x'] + last['w']):.1f}")
        for k in r["kids"]:
            print(f"      {k['name'][:26]:26s} x {k['x']:6.1f}  w {k['w']:6.1f}"
                  f"  h {k['h']:5.1f}")
        pg.close()
    b.close()
