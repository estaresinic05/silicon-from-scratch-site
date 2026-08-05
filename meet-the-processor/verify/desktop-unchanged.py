"""The gate for any phone work on THIS page.

tools/desktop-unchanged.py toggles styles/mobile.css, which meet-the-processor
does not load, so it cannot say anything here. This measures instead: every
element's box plus the live camera position at each parked stop, at three
desktop sizes. Run it, `git stash` the changed files, run it again with a
different tag, and diff the two JSON files. Any difference is a regression.

    python verify/desktop-unchanged.py after
    git stash push meet-the-processor/style.css meet-the-processor/scene.js
    python verify/desktop-unchanged.py before
    git stash pop
    python verify/desktop-unchanged.py --diff before after

Animations are frozen first: drift off, and a long settle after each seek. The
caption's swap and the disclosure transitions make same-code repeats differ by
9 to 11px otherwise, which reads as a regression that is not there.
"""
import json
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
VIEWS = [(1280, 800), (1440, 900), (1600, 900)]
STOPS = [0.000, 0.398, 0.512, 0.800, 0.888, 0.966, 0.990]

BOXES = """
() => {
  const out = {};
  let n = 0;
  document.querySelectorAll('body *').forEach((e) => {
    if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return;
    const r = e.getBoundingClientRect();
    const key = (e.id || e.className || e.tagName) + '#' + (n++);
    out[String(key)] = [+r.x.toFixed(2), +r.y.toFixed(2),
                        +r.width.toFixed(2), +r.height.toFixed(2)];
  });
  return out;
}
"""


def measure(tag):
    data = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                    "--enable-unsafe-swiftshader"])
        for w, h in VIEWS:
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.goto(URL, wait_until="networkidle")
            pg.wait_for_function("window.__die !== undefined", timeout=60000)
            pg.evaluate("window.__die.drift = false")
            for t in STOPS:
                pg.evaluate("(t)=>window.__die.seek(t)", t)
                pg.wait_for_function(
                    "(t) => Math.abs(window.__die.t - t) < 0.005", arg=t,
                    timeout=90000)
                pg.wait_for_timeout(2600)
                key = f"{w}x{h}@{t:.3f}"
                data[key] = {
                    "boxes": pg.evaluate(BOXES),
                    "cam": pg.evaluate("window.__die.state.cam"),
                }
                print(f"  {key}")
            pg.close()
        b.close()
    path = f"desktop_{tag}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=1, sort_keys=True)
    print(f"-> {path}")


def diff(a, b):
    A = json.load(open(f"desktop_{a}.json"))
    B = json.load(open(f"desktop_{b}.json"))
    bad = 0
    for key in sorted(set(A) | set(B)):
        if key not in A or key not in B:
            print(f"{key}: present in only one run"); bad += 1; continue
        if A[key]["cam"] != B[key]["cam"]:
            print(f"{key}: camera {A[key]['cam']} -> {B[key]['cam']}"); bad += 1
        ba, bb = A[key]["boxes"], B[key]["boxes"]
        for el in sorted(set(ba) | set(bb)):
            if ba.get(el) != bb.get(el):
                print(f"{key}: {el}  {ba.get(el)} -> {bb.get(el)}"); bad += 1
    print("IDENTICAL" if not bad else f"{bad} DIFFERENCES")
    return bad


if __name__ == "__main__":
    if sys.argv[1:2] == ["--diff"]:
        sys.exit(1 if diff(sys.argv[2], sys.argv[3]) else 0)
    measure(sys.argv[1] if len(sys.argv) > 1 else "run")
