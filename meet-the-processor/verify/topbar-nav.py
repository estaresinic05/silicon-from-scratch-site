"""The chrome over the canvas: the top bar's link underline, and the forward
arrow's pulse.

Both exist because this page reproduces the site rather than inheriting it (it
loads none of styles/main.css), so anything the shared bar does has to be done
again here — and can silently fail to be. These are the two pieces that did.

Reads computed style rather than pixels: "does the underline animate" is a
question about transform and animation-name, and a screenshot of a 1px hairline
mid-transition answers nothing.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"

fails = []
def check(ok, msg):
    print(('  PASS  ' if ok else '  FAIL  ') + msg)
    if not ok: fails.append(msg)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu",
                                 "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text[:160]))
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:160]))
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(2500)

    print("top bar — hover is a color lift, with NO underline on any link:")
    # Asserted in the negative on purpose. The underline was added here once,
    # because the bar is a hand copy of the site's and the gap looked like a bug.
    # It is not wanted, so the test has to be able to catch it coming back.
    def after_of(label):
        return pg.evaluate("""(label)=>{
          const a=[...document.querySelectorAll('.sitenav a')]
                    .find(x=>x.textContent.trim()===label);
          if (!a) return null;
          const s=getComputedStyle(a,'::after');
          return {content:s.content, tf:s.transform, h:s.height};}""", label)

    for label in ("About", "Meet the Processor", "Project Directory"):
        rest = after_of(label)
        check(rest is not None, f"{label}: link is present")
        if rest is None:
            continue
        # content:none means the pseudo-element is not generated at all
        drawn = rest["content"] != "none" and rest["h"] not in ("0px", "auto")
        check(not drawn, f"{label}: no underline at rest (content={rest['content']})")

    about = pg.locator('.sitenav a', has_text="About").first
    color_rest = pg.evaluate("""()=>{const a=[...document.querySelectorAll('.sitenav a')]
      .find(x=>x.textContent.trim()==='About'); return getComputedStyle(a).color;}""")
    about.hover()
    pg.wait_for_timeout(400)
    hov = after_of("About")
    color_hov = pg.evaluate("""()=>{const a=[...document.querySelectorAll('.sitenav a')]
      .find(x=>x.textContent.trim()==='About'); return getComputedStyle(a).color;}""")
    check(hov["content"] == "none", f"About: still no underline while hovered ({hov['content']})")
    check(color_rest != color_hov,
          f"About: hover still lifts the color ({color_rest} -> {color_hov})")

    # The pill's padding is the regression to watch: any `.sitenav a { padding }`
    # rule outranks `.sitenav__pill`'s own — one class plus a type beats one class.
    pad = pg.evaluate("()=>getComputedStyle(document.querySelector('.sitenav__pill')).padding")
    check(pad == "8px 16px", f"the pill keeps its .5rem 1rem padding (got {pad})")

    print("the forward arrow pulses at every stop it can be pressed from:")
    def anim():
        return pg.evaluate("""()=>{
          const b=document.getElementById('nav-next');
          return {dis:b.disabled,
                  ring:getComputedStyle(b,'::after').animationName,
                  glyph:getComputedStyle(b.querySelector('svg')).animationName};}""")

    stops = pg.evaluate("window.__die.stops").__len__()
    for i in range(stops):
        pg.wait_for_function("()=>!window.__die.flying", timeout=40000)
        pg.wait_for_timeout(400)
        a = anim()
        label = pg.evaluate("()=>document.getElementById('nav-count').textContent").strip()
        last = i == stops - 1
        if last:
            # nothing to advance to, so the cue would be a lie
            ok = a["ring"] == "none" and a["dis"]
            check(ok, f"stop {label}: quiet and disabled at the end "
                      f"(ring={a['ring']} disabled={a['dis']})")
        else:
            ok = a["ring"] == "navRing" and a["glyph"] == "navNudge" and not a["dis"]
            check(ok, f"stop {label}: ring={a['ring']} glyph={a['glyph']}")
            pg.evaluate("()=>document.getElementById('nav-next').click()")
            pg.wait_for_timeout(600)

    check(not errs, f"console clean ({errs})")
    b.close()

print(("\nFAILED: " + str(len(fails))) if fails else "\nall good")
