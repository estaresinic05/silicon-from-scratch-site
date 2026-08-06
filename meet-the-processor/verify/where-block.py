"""Project a core block's top face to screen space through the real camera and
sample the render there. Answers 'is this block actually drawn' with pixels
instead of squinting."""
import sys, re, io
from playwright.sync_api import sync_playwright
T = float(sys.argv[1]) if len(sys.argv) > 1 else 0.800
WANT = sys.argv[2] if len(sys.argv) > 2 else 'Vector Execution'
SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\meet-the-processor\scene.js'
S = io.open(SRC, encoding='utf-8').read()
blk = S[S.index('const CORE_BLOCKS = ['):S.index('const coreTiles')]
labels = [(m.start(), m.group(1)) for m in re.finditer(r"label: '([^']+)'", blk)]
targets = []
for i, (pos, lab) in enumerate(labels):
    if lab != WANT: continue
    end = labels[i+1][0] if i+1 < len(labels) else len(blk)
    flat = blk[pos:end].replace('\n','').replace(' ','')
    col = re.search(r"color:'(#[0-9a-fA-F]{6})'", flat).group(1)
    for r in re.findall(r"\[\[[-\d.,\[\]]*?\]\]", flat):
        pts = [[float(a), float(b)] for a, b in re.findall(r'\[([-\d.]+),([-\d.]+)\]', r)]
        if len(pts) >= 3: targets.append((col, pts))
DIE_W, DIE_H = 9.07, 7.78
# The scene draws the die shot a half turn round — see "The half turn" in
# ../README.md. CORE_BLOCKS is parsed above in the photograph's published frame,
# so the core rect and every point taken from it are turned the same way here.
turn_span = lambda a, b: (1-b, 1-a)
CORE_U = turn_span(0.015, 0.350); CORE_V = turn_span(0.6193, 0.8176)
coreW = (CORE_U[1]-CORE_U[0])*DIE_W; coreH = (CORE_V[1]-CORE_V[0])*DIE_H
coreCX = -DIE_W/2 + (CORE_U[0]+CORE_U[1])/2*DIE_W
coreCZ = -DIE_H/2 + (CORE_V[0]+CORE_V[1])/2*DIE_H
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.evaluate("window.__die.drift = false")
    pg.evaluate("(t)=>window.__die.seek(t)", T)
    pg.wait_for_function("(t)=>Math.abs(window.__die.t-t)<0.005", arg=T, timeout=120000)
    pg.wait_for_timeout(400)
    st = pg.evaluate("JSON.parse(JSON.stringify(window.__die.state))")
    pg.screenshot(path=f"probe_{int(T*1000)}.png", timeout=180000)
    b.close()
from PIL import Image
im = Image.open(f"probe_{int(T*1000)}.png").convert('RGB'); W,H = im.size
m = st['mvp']   # column-major
def proj(x,y,z):
    o=[sum(m[c*4+r]*v for c,v in zip(range(4),(x,y,z,1))) for r in range(4)]
    if o[3] <= 0: return None
    return ((o[0]/o[3]*0.5+0.5)*W, (1-(o[1]/o[3]*0.5+0.5))*H)
print(f"t={st['t']}  core07={st.get('core07')}  cam={st['cam']}")
for col, pts in targets:
    ys = 0.008 + 0.344*0.20      # settled slab top: y0 + CORE_SCALE*TILE_REST
    xs=[];zs=[]
    for u,v in pts:
        u, v = 1-u, 1-v          # same half turn, applied to the traced point
        xs.append(coreCX+(u-0.5)*coreW); zs.append(coreCZ-(0.5-v)*coreH)
    cxw=sum(xs)/len(xs); czw=sum(zs)/len(zs)
    q = proj(cxw, ys+0.055, czw)
    if not q: print("  behind camera"); continue
    px,py = int(q[0]), int(q[1])
    print(f"\n  piece centre -> screen ({px}, {py})   authored colour {col}")
    if 0<=px<W and 0<=py<H:
        for dx,dy in ((0,0),(-12,0),(12,0),(0,-8),(0,8)):
            x,y = min(max(px+dx,0),W-1), min(max(py+dy,0),H-1)
            print(f"     px({x:4d},{y:4d}) = {im.getpixel((x,y))}")
    else:
        print("     OFF SCREEN")
