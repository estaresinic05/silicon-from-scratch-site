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

    print("the tag:")
    # The attract pass demonstrates on its own, a beat after parking, and only
    # for ATTRACT_DWELL at a time. Polled across a whole ATTRACT_CYCLE rather
    # than sampled, since the gaps between slots are dead time by design.
    seek(0.512)
    check(wait_shown("#tag"), "attract pass raises the tag over a block")
    check(pg.evaluate("document.querySelector('#tag').classList.contains('pinned')"),
          "  ...and it is the pinned variant, not the cursor one")
    pg.screenshot(path="aff_attract.png")

    # A real hover wins over the demo and moves the chip to the cursor. Two moves
    # because the pick is throttled to one rAF and the first only primes it.
    pg.mouse.move(720, 470)
    pg.wait_for_timeout(200)
    pg.mouse.move(722, 472)
    ok = wait_shown("#tag")
    tag = pg.evaluate("""() => {
      const t = document.querySelector('#tag');
      return { show: t.classList.contains('show'),
               pinned: t.classList.contains('pinned'),
               name: t.querySelector('.tag-name').textContent };
    }""")
    check(ok and tag["show"] and not tag["pinned"],
          f"hover raises the cursor tag: {tag}")
    check(not shown(".hint-click"),
          "the generic click line stands down while the tag is up")
    pg.screenshot(path="aff_hover.png")

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
    pg.screenshot(path="aff_credit.png")
    pg.keyboard.press("Escape")
    frames()
    check(pg.evaluate("document.getElementById('credit-panel').hidden"),
          "Escape closes it")

    b.close()

print("\n" + ("all good" if not fails else f"{len(fails)} FAILED"))
for f in fails:
    print("  -", f)
