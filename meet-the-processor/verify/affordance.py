"""The affordance layer: hint lines, the block tag, the credit panel.

Asserts the thing the rewrite exists to fix — that the click hint is on screen
exactly where something is CLICKABLE, and not at stage 01 where nothing is —
then shoots the three states the tag can be in.

    python prototypes/cpu-layers/verify/affordance.py

Nothing here waits on the WALL CLOCK, and that is the whole reliability story.
On swiftshader a frame at the floorplan stop can take well over a second, so
"wait 2.2 s then look" is a coin toss on whether a single frame has run since
the seek — an earlier version of this file failed and passed on the same build
depending on the weather. Positive assertions poll for the class; negative ones
wait for a fixed number of RENDERED FRAMES, which is the thing that actually has
to happen before the state under test can be wrong.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
SETTLE_FRAMES = 4      # frames a negative assertion is given to be wrong in

# t, and whether the click hint should be up there
HINT = [(0.000, False), (0.398, False), (0.512, True),
        (0.800, True), (0.888, False), (0.944, False), (0.978, False)]

fails = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("console", lambda m: m.type == "error" and print("  console:", m.text[:200]))
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=60000)
    pg.evaluate("window.__die.drift = false")

    SHOWN = "(s) => document.querySelector(s).classList.contains('show')"

    def shown(sel):
        return pg.evaluate(SHOWN, sel)

    def wait_shown(sel, ms=9000):
        """True once the element carries .show, or False if it never does."""
        try:
            pg.wait_for_function(SHOWN, arg=sel, timeout=ms)
            return True
        except Exception:
            return False

    def seek(t):
        pg.evaluate("(t)=>window.__die.seek(t)", t)

    def frames(n=SETTLE_FRAMES):
        """Block until n more frames have actually rendered."""
        pg.evaluate("""(n) => new Promise((res) => {
          let i = 0;
          const f = () => (++i >= n ? res() : requestAnimationFrame(f));
          requestAnimationFrame(f);
        })""", n)

    print("click hint follows what is actually selectable:")
    for t, want in HINT:
        seek(t)
        if want:
            got = wait_shown(".hint-click")
        else:
            frames()
            got = shown(".hint-click")
        check(got == want, f"t={t:.3f} click hint {'up' if want else 'down'}")

    print("keyboard hint belongs to stage 01:")
    seek(0)
    check(wait_shown(".hint-keys"), "t=0.000 keyboard hint up")
    seek(0.512)
    frames()
    check(not shown(".hint-keys"), "t=0.512 keyboard hint down")

    print("the periodic jump:")
    # No chip and no ripple. Every block already carries its own name, so the
    # chip repeated the label beside it; the ripple that replaced it was dropped
    # in turn. What remains is the demonstration itself: one block, chosen at
    # random, rises out of the die every few seconds.
    check(not pg.evaluate("!!document.getElementById('tag')"),
          "no cursor chip in the DOM")

    seek(0.512)
    # Collect who jumps over a stretch. Sampled rather than awaited, because a
    # jump lasts JUMP_MS and the gap after it is longer than one poll.
    seen, lifts = [], []
    for _ in range(60):
        pg.wait_for_timeout(180)
        a = pg.evaluate("window.__die.attract")
        if a["tile"]:
            lifts.append(a["lift"])
            if not seen or seen[-1] != a["tile"]:
                seen.append(a["tile"])
    check(len(seen) >= 2, f"blocks jump periodically (saw {len(seen)} jumps)")
    check(len(set(seen)) >= 2,
          f"and the block is chosen at random, not fixed: {seen[:6]}")
    check(max(lifts or [0]) > 0.4,
          f"the lift is a real rise, not a twitch (peak {max(lifts or [0]):.2f})")
    check(all(seen[i] != seen[i + 1] for i in range(len(seen) - 1)),
          "and never picks the same block twice in a row")

    # A real hover takes precedence: the demo must not fight the thing it
    # is demonstrating.
    pg.mouse.move(700, 470)
    pg.wait_for_timeout(220)
    pg.mouse.move(702, 472)
    pg.wait_for_timeout(600)
    check(pg.evaluate("window.__die.attract.tile") is None,
          "and it stands down while the cursor is on a block")
    pg.mouse.move(60, 780)
    pg.wait_for_timeout(400)

    print("the credit panel:")
    check(pg.evaluate("document.getElementById('credit-panel').hidden"),
          "closed on load")
    pg.click("#credit-more")
    pg.wait_for_function("!document.getElementById('credit-panel').hidden", timeout=5000)
    check(not pg.evaluate("document.getElementById('credit-panel').hidden"),
          "opens on the toggle")
    check(pg.get_attribute("#credit-more", "aria-expanded") == "true",
          "aria-expanded tracks it")
    box = pg.evaluate("""() => {
      const r = document.getElementById('credit-panel').getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }""")
    check(box["l"] >= 0 and box["t"] >= 0 and box["r"] <= 1440 and box["b"] <= 900,
          f"stays inside the viewport: {box}")
    pg.screenshot(path="aff_credit.png", timeout=120000)
    pg.keyboard.press("Escape")
    frames()
    check(pg.evaluate("document.getElementById('credit-panel').hidden"),
          "Escape closes it")

    b.close()

print("\n" + ("all good" if not fails else f"{len(fails)} FAILED"))
for f in fails:
    print("  -", f)
