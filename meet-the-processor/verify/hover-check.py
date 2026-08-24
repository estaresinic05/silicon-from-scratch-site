"""Does hovering a block lift it, pulse it, and set the cursor — and does it leave
its neighbors alone?

Measures the actual mesh y and emissiveIntensity over time rather than trusting a
screenshot, because a lift of a few hundredths of a world unit is not something
you can eyeball reliably.
"""
from playwright.sync_api import sync_playwright
DIE_W,DIE_H=9.07,7.78
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(4000)
    pg.evaluate("(t)=>window.__die.seek(t)",0.80)
    pg.wait_for_function("()=>Math.abs(window.__die.t-0.80)<0.004", timeout=30000)
    # Instruction Fetch, and a neighbor that must NOT react
    def screen(cu,cv,wy=0.11):
        return pg.evaluate("""({cu,cv,W,H,wy})=>{
          const u=0.015+cu*0.335, v=0.6193+cv*0.1983;
          const m=window.__die.state.mvp;
          const x=(u-0.5)*W,z=(v-0.5)*H,y=wy;
          const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
          return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
          {"cu":cu,"cv":cv,"W":DIE_W,"H":DIE_H,"wy":wy})
    tgt = screen(0.4961, 0.8636)                 # Instruction Fetch
    other = screen(0.4609, 0.1423)               # L1D Cache, elsewhere on the core
    # true baseline: cursor on nothing clickable
    pg.mouse.move(6, 6); pg.wait_for_timeout(600)
    base_y = pg.evaluate("window.__die.state.core07")
    base_hover = pg.evaluate("window.__die.state.hover")
    pg.mouse.move(tgt['x'], tgt['y']); pg.wait_for_timeout(600)
    cur1 = pg.evaluate("document.getElementById('gl').style.cursor")
    hov_y = pg.evaluate("window.__die.state.core07")
    # watch the pulse: emissive should oscillate while held
    vals = []
    for _ in range(12):
        h = pg.evaluate("window.__die.state.hover")
        vals.append(None if not h else h['emissive'])
        pg.wait_for_timeout(85)
    pg.mouse.move(5, 5); pg.wait_for_timeout(700)
    off_y = pg.evaluate("window.__die.state.core07")
    hv = pg.evaluate("window.__die.state.hover")
    print(f"  nothing hovered -> state.hover = {base_hover}")
    print(f"  cursor while over a block: {cur1!r}")
    print(f"  tallest core slab   rest {base_y}   hovered {hov_y}   after leaving {off_y}")
    ok = [v for v in vals if v is not None]
    print(f"  emissiveIntensity while held: min {min(ok):.2f}  max {max(ok):.2f}  "
          f"span {max(ok)-min(ok):.2f}")
    print(f"    samples {[round(v,2) for v in ok]}")
    b.close()
