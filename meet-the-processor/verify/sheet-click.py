"""Are the sheet's own buttons reachable with a REAL mouse click?

The earlier test dispatched .click() programmatically, which bypasses hit-testing
entirely — it would pass even if something were covering the button. If the X
cannot be clicked while the descent is frozen, the page really is stuck, which is
what "my screen freezes" would look like.
"""
from playwright.sync_api import sync_playwright
DIE_W,DIE_H=9.07,7.78
with sync_playwright() as b_:
    b=b_.chromium.launch(args=["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"])
    pg=b.new_page(viewport={"width":1440,"height":900}, reduced_motion="reduce")
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(3500); pg.evaluate("window.__die.drift=false")
    pg.evaluate("(t)=>window.__die.seek(t)",0.46)
    pg.wait_for_timeout(250)
    pt=pg.evaluate("""({W,H})=>{const m=window.__die.state.mvp;
      const x=(0.18-0.5)*W,z=(0.12-0.5)*H,y=0.30;
      const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
      return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
      {"W":DIE_W,"H":DIE_H})
    pg.mouse.click(pt['x'],pt['y']); pg.wait_for_timeout(400)
    print(f"sheet open: {not pg.evaluate('document.getElementById(\"sheet\").hidden')}")
    # what is actually on top of the X button?
    for sel in ('#sheet-close','#sheet-resume'):
        box = pg.evaluate(f"""() => {{
          const e=document.querySelector('{sel}'); const r=e.getBoundingClientRect();
          const cx=r.left+r.width/2, cy=r.top+r.height/2;
          const top=document.elementFromPoint(cx,cy);
          return {{cx,cy,top:top?top.id||top.className||top.tagName:'none',
                  hit: top===e||e.contains(top)}};
        }}""")
        print(f"  {sel}: centre ({box['cx']:.0f},{box['cy']:.0f})  topmost element "
              f"= {box['top']!r}  reachable={box['hit']}")
    # real click on the X
    pg.mouse.click(*pg.evaluate("""()=>{const r=document.getElementById('sheet-close')
        .getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];}"""))
    pg.wait_for_timeout(300)
    closed = pg.evaluate("document.getElementById('sheet').hidden")
    before = pg.evaluate("window.__die.t")
    pg.mouse.wheel(0, 2500); pg.wait_for_timeout(400)
    after = pg.evaluate("window.__die.t")
    print(f"  real click on X closed it: {closed}")
    print(f"  wheel scrolling works after: {after>before+0.001}  ({before:.4f} -> {after:.4f})")
    b.close()
