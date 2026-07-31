"""How fast can frames come out? Two things decide it: whether headless gets the
real GPU, and whether we can skip the damped-scroll settle.

prefers-reduced-motion makes the scroll lerp instant (current jumps to target)
and stops the camera drift, so t can be set and shot with no convergence wait —
which is also exactly what we want for a deterministic frame sequence."""
import sys, time
from playwright.sync_api import sync_playwright
MODE = sys.argv[1] if len(sys.argv) > 1 else 'gpu'
ARGS = {
 'gpu':  ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
 'soft': ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}[MODE]
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 960, "height": 540},
                    reduced_motion="reduce")
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    info = pg.evaluate("""() => {
      const c=document.createElement('canvas');
      const gl=c.getContext('webgl2')||c.getContext('webgl');
      const d=gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
    }""")
    print(f"mode={MODE}  renderer: {info}")
    # does t snap without a settle?
    pg.evaluate("(t)=>window.__die.seek(t)", 0.62)
    pg.wait_for_timeout(120)
    got = pg.evaluate("window.__die.t")
    print(f"asked for t=0.620, got {got:.4f}  -> settle needed: {abs(got-0.62)>0.004}")
    times=[]
    for i in range(10):
        t=0.55+i*0.01
        s=time.time()
        pg.evaluate("(t)=>window.__die.seek(t)", t)
        pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        pg.screenshot(path=f"_ft{i}.png")
        times.append(time.time()-s)
    b.close()
times.sort()
med=times[len(times)//2]
print(f"median {med*1000:.0f} ms/frame  ->  {med*900:.0f}s for a 30s clip at 30fps")
