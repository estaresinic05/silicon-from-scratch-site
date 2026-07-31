"""Time to first frame, measured inside the page against the resource timings,
so the numbers are the browser's own rather than the test harness's."""
from playwright.sync_api import sync_playwright

MBPS = 4
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    ctx = b.new_context(viewport={"width": 1200, "height": 760})
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    cdp.send("Network.enable")
    cdp.send("Network.emulateNetworkConditions", {
        "offline": False, "latency": 60,
        "downloadThroughput": int(MBPS * 1024 * 1024 / 8),
        "uploadThroughput": int(1024 * 1024 / 8)})
    pg.add_init_script("""
        window.__mark = null;
        (function poll() {
          const l = document.getElementById('loader');
          if (l && l.classList.contains('done')) { window.__mark = performance.now(); return; }
          requestAnimationFrame(poll);
        })();
    """)
    pg.goto("http://127.0.0.1:8777/meet-the-processor/")
    pg.wait_for_function("window.__mark !== null", timeout=180000)
    pg.wait_for_timeout(14000)          # let the deferred set finish
    out = pg.evaluate(r"""() => {
      const t = window.__mark;
      const rs = performance.getEntriesByType('resource')
        .filter(r => /\.(jpg|json|js)$/.test(r.name))
        .map(r => ({n: r.name.split('/').pop(),
                    end: +r.responseEnd.toFixed(0),
                    kb: Math.round((r.transferSize||r.encodedBodySize)/1024)}));
      return {mark: +t.toFixed(0), rs: rs.sort((a,b)=>a.end-b.end)};
    }""")
    m = out["mark"]
    print(f"loader cleared at {m/1000:.2f}s  (throttled to {MBPS} Mbps)\n")
    before = [r for r in out["rs"] if r["end"] <= m]
    after = [r for r in out["rs"] if r["end"] > m]
    print(f"BLOCKED first frame  ({sum(r['kb'] for r in before)} KB):")
    for r in before:
        print(f"   {r['end']/1000:6.2f}s  {r['kb']:5d} KB  {r['n']}")
    print(f"\nSTREAMED after       ({sum(r['kb'] for r in after)} KB):")
    for r in after:
        print(f"   {r['end']/1000:6.2f}s  {r['kb']:5d} KB  {r['n']}")
    b.close()
