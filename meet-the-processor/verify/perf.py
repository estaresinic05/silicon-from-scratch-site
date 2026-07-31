"""Per-stage render cost, on the REAL GPU.

  python perf.py [deviceScaleFactor]

Two lessons are baked in, both learned the hard way:

* Run on the GPU (d3d11), not SwiftShader. Software frame times varied by 300% on
  stages that had not changed, which swamps any effect worth measuring.
* Pass a device scale factor. Headless reports devicePixelRatio 1, so anything
  gated on the pixel ratio — the antialias decision, for one — is never exercised
  at the value a real display would use.

Draw calls and triangles are hardware-independent. Frame times here are real, but
still compare medians across a run rather than against a previous run.
"""
import sys, statistics
from playwright.sync_api import sync_playwright
DSF = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
STAGES = [(0.02,'01 package'),(0.22,'03 delid'),(0.36,'05 bare silicon'),
          (0.46,'06 floorplan'),(0.50,'06 strip reveal'),(0.62,'07 core, few up'),
          (0.72,'07 core, most up'),(0.80,'07 core, all 29'),
          (0.88,'08 metal stack'),(0.96,'09 transistors')]
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=d3d11","--enable-gpu",
                                "--ignore-gpu-blocklist","--hide-scrollbars"])
    pg = b.new_page(viewport={"width":1440,"height":900},
                    device_scale_factor=DSF, reduced_motion="reduce")
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=120000)
    pg.wait_for_timeout(3000)
    pg.evaluate("window.__die.drift = false")
    h = pg.evaluate("JSON.parse(JSON.stringify(window.__die.state))")
    gpu = pg.evaluate("""() => {const c=document.createElement('canvas');
      const gl=c.getContext('webgl2'); const d=gl.getExtension('WEBGL_debug_renderer_info');
      return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';}""")
    print(f"{gpu}\npixelRatio {h['dpr']}  antialias {h['aa']}  programs {h['progs']}\n")
    print(f"{'stage':>18} {'draws':>6} {'triangles':>10} {'median ms':>10} {'p90':>7}")
    rows=[]
    for t,name in STAGES:
        pg.evaluate("(t)=>window.__die.seek(t)", t)
        pg.wait_for_timeout(150)
        ms = pg.evaluate("""async () => {
          for(let i=0;i<10;i++) await new Promise(r=>requestAnimationFrame(r)); // warm
          const ts=[]; for(let i=0;i<50;i++)
            await new Promise(r=>requestAnimationFrame(()=>{ts.push(performance.now());r();}));
          const d=[]; for(let i=1;i<ts.length;i++) d.push(ts[i]-ts[i-1]); return d;
        }""")
        ms.sort()
        med=statistics.median(ms); p90=ms[int(len(ms)*0.9)]
        s = pg.evaluate("JSON.parse(JSON.stringify(window.__die.state))")
        rows.append((name,s['draws'],s['tris'],med,p90))
    b.close()
worst=max(r[3] for r in rows)
for n,d,tr,med,p90 in rows:
    print(f"{n:>18} {d:6d} {tr:10,d} {med:10.2f} {p90:7.2f}  {'#'*round(med/worst*24)}")
print(f"\nslowest stage {worst:.2f} ms  ->  {1000/worst:.0f} fps if that were the whole frame")
print("(rAF is capped at the display refresh, so anything at ~16.7ms is vsync-limited, not the cost)")
