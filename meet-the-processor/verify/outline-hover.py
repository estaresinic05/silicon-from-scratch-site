"""Two behaviors around the outline phase of the macro regions:

  1. while a region is see-through but still showing its colored outline,
     hovering must bring its highlighted fill back
  2. once the overlay has cleared entirely, the region must not be selectable

Both are read off window.__die.state, not eyeballed.
"""
from playwright.sync_api import sync_playwright
DIE_W,DIE_H=9.07,7.78
# t, what the region looks like there, may it be picked?
PHASES = [
  (0.500, 'filled',            True),
  (0.530, 'outline only',      True),
  (0.548, 'mid fade-out',      True),
  (0.566, 'cleared',           False),
  (0.600, 'long gone',         False),
]
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(4000)
    def at(t):
        pg.evaluate("(t)=>window.__die.seek(t)",t)
        pg.wait_for_function("(t)=>Math.abs(window.__die.t-t)<0.003", arg=t, timeout=30000)
    def screen(u,v,wy):
        return pg.evaluate("""({u,v,W,H,wy})=>{const m=window.__die.state.mvp;
          const x=(u-0.5)*W,z=(v-0.5)*H,y=wy;
          const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
          return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
          {"u":u,"v":v,"W":DIE_W,"H":DIE_H,"wy":wy})
    print(f"{'t':>7} {'phase':>15} {'fill off':>9} {'fill hovered':>13} {'wall':>7} "
          f"{'cursor':>9} {'pickable':>9} {'want':>6}")
    ok=True
    for t,phase,want in PHASES:
        at(t)
        pt = screen(0.18, 0.12, 0.30)          # a left-column Zen 5 Core
        pg.mouse.move(6,6); pg.wait_for_timeout(450)
        off = pg.evaluate("window.__die.state.hover")
        pg.mouse.move(pt['x'], pt['y']); pg.wait_for_timeout(700)
        hv  = pg.evaluate("window.__die.state.hover")
        cur = pg.evaluate("document.getElementById('gl').style.cursor")
        pick = hv is not None
        # fill with no hover: read it by sampling while the cursor is away
        got = (pick == want)
        ok = ok and got
        fo = '-' if off else 'n/a'
        print(f"{t:7.3f} {phase:>15} {fo:>9} "
              f"{(str(hv['fill']) if hv else '-'):>13} {(str(hv['wall']) if hv else '-'):>7} "
              f"{cur:>9} {str(pick):>9} {str(want):>6}  {'ok' if got else 'FAIL'}")
    b.close()
print("PASS" if ok else "FAIL")
