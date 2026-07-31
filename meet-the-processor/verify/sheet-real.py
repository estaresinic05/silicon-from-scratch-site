"""Reproduce the way a real browser sees it: NO reduced-motion emulation, drift on,
nothing disabled. The passing tests all ran with reduced_motion="reduce", which
also switches off the entrance animations — so they could not have caught an
animation that leaves the sheet at opacity 0."""
from playwright.sync_api import sync_playwright
DIE_W,DIE_H=9.07,7.78
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"])
    pg=b.new_page(viewport={"width":1440,"height":900})     # <-- no reduced motion
    msgs=[]; pg.on("console", lambda m: msgs.append(f"{m.type}: {m.text[:160]}"))
    pg.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(4000)
    # scroll the real way, then wait for the damped value to settle
    pg.evaluate("(t)=>window.__die.seek(t)",0.46)
    pg.wait_for_function("()=>Math.abs(window.__die.t-0.46)<0.004", timeout=30000)
    pt=pg.evaluate("""({W,H})=>{const m=window.__die.state.mvp;
      const x=(0.18-0.5)*W,z=(0.12-0.5)*H,y=0.30;
      const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
      return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
      {"W":DIE_W,"H":DIE_H})
    pg.mouse.click(pt['x'],pt['y'])
    pg.wait_for_timeout(1200)                                # well past any animation
    r=pg.evaluate("""() => {
      const s=document.getElementById('sheet');
      const c=document.querySelector('.sheet-copy');
      const m=document.querySelector('.sheet-media');
      const cs=getComputedStyle(s), cc=getComputedStyle(c), cm=getComputedStyle(m);
      const rs=s.getBoundingClientRect(), rc=c.getBoundingClientRect();
      return {hidden:s.hidden, display:cs.display, opacity:cs.opacity,
              zIndex:cs.zIndex, position:cs.position,
              sheetRect:[rs.x|0,rs.y|0,rs.width|0,rs.height|0],
              copyOpacity:cc.opacity, copyRect:[rc.x|0,rc.y|0,rc.width|0,rc.height|0],
              mediaOpacity:cm.opacity,
              title:document.getElementById('sheet-title').textContent,
              stylesheetRules: [...document.styleSheets].map(x=>{try{return x.cssRules.length}catch(e){return 'blocked'}}),
      };
    }""")
    for k,v in r.items(): print(f"  {k}: {v}")
    pg.screenshot(path="real_click.png")
    b.close()
print("console:", msgs or "clean")
