"""Does hovering one block of a SPLIT part raise the whole part?

Several things on the core are one part drawn as several blocks: the vector
regfile is four quarters, the FADD + FMAC lanes are four, Vector Execution is
two columns, L2 Cache is two halves plus its tag array. They all open the same
panel, so the lift
has to outline the part rather than the rectangle under the cursor.

Measures window.__die.state.hover.part / .lifted rather than a screenshot: the
question is how many blocks are off the die, and a rise of a few hundredths of a
world unit does not survive being eyeballed.

Also checks the converse — a block that is a part of one still lifts alone, and
its neighbors stay put — because "everything rises" would pass a naive count.
"""
from playwright.sync_api import sync_playwright

DIE_W, DIE_H = 9.07, 7.78
T = 0.80                       # the core standing complete

# label -> a core-local (u, v) inside one of its blocks, and how many blocks the
# part has. Coordinates are the `at` centers straight out of CORE_BLOCKS.
CASES = [
    ('Vector Regfile ¼', (0.0677, 0.1269), 4),
    ('FADD + FMAC',           (0.0677, 0.3145), 4),
    ('Vector Execution',      (0.0677, 0.5111), 2),
    # THREE, not two. The tag array opens the L2 Cache sheet, so it is part of
    # the same part and rises with the halves; hovered from either side.
    ('L2 Cache ½',       (0.8569, 0.1510), 3),
    ('L2 Cache Tags',    (0.9345, 0.4124), 3),
    ('Instruction Fetch',     (0.4961, 0.8636), 1),   # a part of one
]

fails = []
def check(ok, msg):
    print(('  PASS  ' if ok else '  FAIL  ') + msg)
    if not ok: fails.append(msg)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-angle=d3d11", "--enable-gpu",
                                 "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    pg.wait_for_timeout(3000)
    pg.evaluate("(t)=>window.__die.seek(t)", T)
    pg.wait_for_function("()=>Math.abs(window.__die.t-0.80)<0.004", timeout=30000)
    pg.wait_for_timeout(800)

    # The scene draws the die shot a half turn round, so the IFOP PHY faces the
    # I/O die -- see "The half turn" in ../README.md. Every uv below is written in
    # the photograph's published frame, exactly as scene.js writes them, and is
    # turned on the way to the click, the same as sheet-check.py does it. Without
    # the turn every point here projected off screen and every case in this file
    # failed as "aim missed the block", which reads like the page and was the
    # harness.
    def screen(cu, cv, wy=0.11):
        return pg.evaluate("""({cu,cv,W,H,wy})=>{
          const u=1-(0.015+cu*0.335), v=1-(0.6193+cv*0.1983);
          const m=window.__die.state.mvp;
          const x=(u-0.5)*W,z=(v-0.5)*H,y=wy;
          const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
          return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
          {"cu": cu, "cv": cv, "W": DIE_W, "H": DIE_H, "wy": wy})

    def hover(cu, cv):
        p = screen(cu, cv)
        pg.mouse.move(6, 6); pg.wait_for_timeout(250)
        # two moves: the first can land on the frame the raycast is throttled out of
        pg.mouse.move(p['x'], p['y']); pg.wait_for_timeout(80)
        pg.mouse.move(p['x'] + 1, p['y'] + 1)
        pg.wait_for_timeout(700)                 # long enough for HOVER_EASE
        return pg.evaluate("window.__die.state.hover")

    print("hovering a split part raises all of it:")
    for label, (cu, cv), n in CASES:
        h = hover(cu, cv)
        if not h:
            check(False, f"{label}: nothing hovered (aim missed the block)")
            continue
        check(h['label'] == label, f"{label}: cursor is on it (got {h['label']!r})")
        check(h['part'] == n, f"{label}: part has {n} block(s) (got {h['part']})")
        check(h['lifted'] == n,
              f"{label}: all {n} are lifted (got {h['lifted']}, hov {h['hovs']})")

    print("and it does not raise the rest of the core:")
    hover(0.4961, 0.8636)                        # Instruction Fetch, a part of one
    up = pg.evaluate("""()=>{
      const s = window.__die.state.hover;
      return s ? s.part : -1; }""")
    total = pg.evaluate("window.__die.state.core07")
    check(up == 1, f"one block up, not the whole core (part={up}, core={total})")

    pg.mouse.move(5, 5); pg.wait_for_timeout(700)
    check(pg.evaluate("window.__die.state.hover") is None, "and it all settles on leave")
    pg.screenshot(path="part_hover_core.png", timeout=120000)

    # --- the floorplan, where a part spans the whole die ------------------
    # Eight Zen 5 core regions, one panel between them. Different tiles, different
    # projection (die space, not core space), same rule.
    print("\nand on the floorplan, one core raises every core:")
    pg.evaluate("(t)=>window.__die.seek(t)", 0.512)
    pg.wait_for_function("()=>Math.abs(window.__die.t-0.512)<0.004", timeout=30000)
    pg.wait_for_timeout(900)

    def die_screen(u, v, wy=0.22):
        return pg.evaluate("""({u,v,W,H,wy})=>{
          u = 1-u; v = 1-v;                      // the half turn, as above
          const m=window.__die.state.mvp;
          const x=(u-0.5)*W,z=(v-0.5)*H,y=wy;
          const o=[0,1,2,3].map(r=>m[0*4+r]*x+m[1*4+r]*y+m[2*4+r]*z+m[3*4+r]);
          return {x:(o[0]/o[3]*0.5+0.5)*innerWidth,y:(1-(o[1]/o[3]*0.5+0.5))*innerHeight};}""",
          {"u": u, "v": v, "W": DIE_W, "H": DIE_H, "wy": wy})

    for name, u, v, n in [('a Zen 5 core', 0.1799, 0.1145, 8),
                          ('L3 Cache',     0.4985, 0.3200, 1)]:
        p = die_screen(u, v)
        pg.mouse.move(6, 6); pg.wait_for_timeout(250)
        pg.mouse.move(p['x'], p['y']); pg.wait_for_timeout(80)
        pg.mouse.move(p['x'] + 1, p['y'] + 1); pg.wait_for_timeout(700)
        h = pg.evaluate("window.__die.state.hover")
        if not h:
            check(False, f"{name}: nothing hovered (aim missed the region)")
            continue
        check(h['part'] == n, f"{name}: part has {n} region(s) (got {h['part']})")
        check(h['lifted'] == n,
              f"{name}: all {n} are lifted (got {h['lifted']}, hov {h['hovs']})")

    pg.screenshot(path="part_hover_floorplan.png", timeout=120000)
    b.close()

print(("\nFAILED: " + str(len(fails))) if fails else "\nall good")
