"""Click the Branch Predictor block for real and prove the video is wired.

Wiring is one line in HAVE_VIDEO, which is exactly the kind of change that looks
right in the diff and opens the wrong sheet. So this clicks the block through the
real camera rather than trusting the map, the way the test/debug splice was
checked.

MUST run with the GPU flags. Picking reads the framebuffer, so under
--use-gl=swiftshader the click lands on the right screen point and returns the
WRONG block, which is indistinguishable from a mis-wired region.

  python tools/serve.py &
  python meet-the-processor/verify/bp-sheet.py
"""
import io, re, sys
from playwright.sync_api import sync_playwright

SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\meet-the-processor\scene.js'
WANT = 'Branch'
T = 0.800
DIE_W, DIE_H = 9.07, 7.78

S = io.open(SRC, encoding='utf-8').read()
blk = S[S.index('const CORE_BLOCKS = ['):S.index('const coreTiles')]
labels = [(m.start(), m.group(1)) for m in re.finditer(r"label: '([^']+)'", blk)]
pts = []
for i, (pos, lab) in enumerate(labels):
    if lab != WANT:
        continue
    end = labels[i + 1][0] if i + 1 < len(labels) else len(blk)
    flat = blk[pos:end].replace('\n', '').replace(' ', '')
    r = re.search(r"\[\[[-\d.,\[\]]*?\]\]", flat).group(0)
    pts = [[float(a), float(b)] for a, b in re.findall(r'\[([-\d.]+),([-\d.]+)\]', r)]
assert pts, f'no {WANT} block found'

turn_span = lambda a, b: (1 - b, 1 - a)
CORE_U = turn_span(0.015, 0.350); CORE_V = turn_span(0.6193, 0.8176)
coreW = (CORE_U[1] - CORE_U[0]) * DIE_W; coreH = (CORE_V[1] - CORE_V[0]) * DIE_H
coreCX = -DIE_W / 2 + (CORE_U[0] + CORE_U[1]) / 2 * DIE_W
coreCZ = -DIE_H / 2 + (CORE_V[0] + CORE_V[1]) / 2 * DIE_H
xs, zs = [], []
for u, v in pts:
    u, v = 1 - u, 1 - v
    xs.append(coreCX + (u - 0.5) * coreW); zs.append(coreCZ - (0.5 - v) * coreH)
cxw, czw = sum(xs) / len(xs), sum(zs) / len(zs)
ys = 0.008 + 0.344 * 0.20 + 0.055

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu",
                                "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900},
                    reduced_motion="reduce")
    msgs = []
    pg.on("console", lambda m: msgs.append(f"{m.type}: {m.text[:160]}"))
    pg.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.evaluate("window.__die.drift = false")
    pg.evaluate("(t)=>window.__die.seek(t)", T)
    pg.wait_for_function("(t)=>Math.abs(window.__die.t-t)<0.005", arg=T, timeout=120000)
    pg.wait_for_timeout(600)

    q = pg.evaluate("""({x,y,z})=>{const m=window.__die.state.mvp;
        const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
        return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,
                y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
        {"x": cxw, "y": ys, "z": czw})
    print(f"clicking ({q['x']:.0f}, {q['y']:.0f})")
    pg.mouse.click(q['x'], q['y'])
    pg.wait_for_timeout(1200)

    r = pg.evaluate("""() => {
        const v = document.getElementById('sheet-video');
        return {title: document.getElementById('sheet-title').textContent,
                sheetHidden: document.getElementById('sheet').hidden,
                hasVideo: document.querySelector('.sheet-media').classList.contains('has-video'),
                src: v.getAttribute('src'), readyState: v.readyState,
                duration: v.duration, w: v.videoWidth, h: v.videoHeight};
    }""")
    for k, v in r.items():
        print(f"  {k}: {v}")

    pg.evaluate("document.getElementById('sheet-video').play()")
    pg.wait_for_timeout(2500)
    t = pg.evaluate("document.getElementById('sheet-video').currentTime")
    print(f"  currentTime after play: {t:.2f}")
    pg.screenshot(path="verify/bp-sheet.png")
    b.close()

print("console:", msgs or "clean")
ok = (r['title'] == 'Branch Predictor'
      and r['src'] == './assets/video/branch-predictor.mp4'
      and r['readyState'] == 4 and abs(r['duration'] - 248.05) < 0.5
      and (r['w'], r['h']) == (1280, 720) and t > 0.5 and not msgs)
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
