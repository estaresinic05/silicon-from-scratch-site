"""Does clicking a block open the sheet, freeze the descent, and resume on close?

Closes via the X. There was a "Resume scrolling" button; it was removed, and this
test kept referencing it and started failing on a null element — the failure was
the test, not the page.

Projects a region's centre through the real camera (window.__die.state.mvp) to
find where to click, so it does not depend on guessing screen coordinates.
"""
from playwright.sync_api import sync_playwright
DIE_W, DIE_H = 9.07, 7.78
CORE_U, CORE_V = (0.015, 0.350), (0.6193, 0.8176)
def core_uv(cu, cv):          # a core block's own uv -> die uv
    return (CORE_U[0] + cu*(CORE_U[1]-CORE_U[0]),
            CORE_V[0] + cv*(CORE_V[1]-CORE_V[0]))
# (t, die uv, world y to aim at, expected sheet title)
# y matters: a risen floorplan slab sits at y 0.22-0.38 and a core slab at
# 0.08-0.13, and at these low camera angles aiming at the wrong height puts the
# screen point off the slab entirely.
CASES = [
  (0.46, (0.18, 0.12),   0.30, 'Zen 5 Core'),
  (0.52, (0.50, 0.845),  0.30, 'SMU / Power Management & I/O Interconnect'),
  (0.50, (0.50, 0.30),   0.30, 'L3 Cache'),
  (0.52, (0.17, 0.93),   0.30, 'Test / Debug'),
  (0.52, (0.82, 0.93),   0.30, 'IFOP PHY'),
  (0.80, core_uv(0.4961, 0.8636), 0.11, 'Instruction Fetch and Decode'),
  (0.80, core_uv(0.4609, 0.1423), 0.11, 'L1D Cache'),
  (0.80, core_uv(0.3882, 0.4837), 0.11, 'Integer Execution'),
  (0.80, core_uv(0.6514, 0.3683), 0.11, 'Load / Store'),
  (0.80, core_uv(0.8569, 0.1510), 0.11, 'L2 Cache'),
  (0.80, core_uv(0.9345, 0.4124), 0.11, 'L2 Cache Tags'),
  (0.80, core_uv(0.6926, 0.9289), 0.11, 'L1I Cache'),
]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width":1440,"height":900}, reduced_motion="reduce")
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(3500)
    pg.evaluate("window.__die.drift = false")
    def goto(t):
        pg.evaluate("(t)=>window.__die.seek(t)", t)
        pg.wait_for_timeout(250)
    def screen_of(u, v, wy):
        return pg.evaluate("""({u,v,W,H,wy}) => {
          const m = window.__die.state.mvp;
          const x = (u-0.5)*W, z = (v-0.5)*H, y = wy;
          const o = [0,1,2,3].map(r => m[0*4+r]*x + m[1*4+r]*y + m[2*4+r]*z + m[3*4+r]);
          if (o[3] <= 0) return null;
          return { x: (o[0]/o[3]*0.5+0.5)*innerWidth,
                   y: (1-(o[1]/o[3]*0.5+0.5))*innerHeight };
        }""", {"u":u,"v":v,"W":DIE_W,"H":DIE_H,"wy":wy})
    ok = True
    for t, uv, wy, expect in CASES:
        goto(t)
        pt = screen_of(uv[0], uv[1], wy)
        if not pt: print(f"  t={t} projects off screen"); ok=False; continue
        before = pg.evaluate("window.__die.t")
        pg.mouse.click(pt['x'], pt['y'])
        pg.wait_for_timeout(200)
        open_ = pg.evaluate("!document.getElementById('sheet').hidden")
        title = pg.evaluate("document.getElementById('sheet-title').textContent")
        # try to scroll while frozen
        pg.evaluate("scrollBy(0, 4000)")
        pg.wait_for_timeout(300)
        during = pg.evaluate("window.__die.t")
        pg.evaluate("document.getElementById('sheet-close').click()")
        pg.wait_for_timeout(200)
        closed = pg.evaluate("document.getElementById('sheet').hidden")
        # and that scrolling works again
        pg.evaluate("scrollBy(0, 3000)")
        pg.wait_for_timeout(300)
        after = pg.evaluate("window.__die.t")
        froze = abs(during - before) < 0.0005
        good = open_ and title == expect and froze and closed and after > before + 0.001
        ok = ok and good
        print(f"  t={t:.2f} ({pt['x']:.0f},{pt['y']:.0f})  {expect}")
        print(f"     open {open_}  froze {froze}  closed {closed}  "
              f"resumed {after > before + 0.001}  title {'OK' if title==expect else repr(title)}"
              f"   => {'PASS' if good else 'FAIL'}")
    # a click on empty space must NOT freeze anything
    goto(0.05)
    t0 = pg.evaluate("window.__die.t")
    pg.mouse.click(40, 700)
    pg.wait_for_timeout(150)
    stray = pg.evaluate("!document.getElementById('sheet').hidden")
    print(f"  click on empty space opens a sheet: {stray}  {'FAIL' if stray else 'OK'}")
    b.close()
print("PASS" if ok and not stray else "CHECK THE ABOVE")
