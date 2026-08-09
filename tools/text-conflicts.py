"""Find text that collides with other text, at every width in a sweep.

mobile-audit.py finds elements wider than the viewport. This finds the other
failure: two pieces of text drawn on top of each other, or text spilling out of
the box that is supposed to hold it. Both look like "conflictions" and neither
shows up as overflow.

Only leaf text nodes are compared, and only pairs that are not ancestor and
descendant of each other, because a heading inside its own section overlaps it by
construction. Deliberate overlays are skipped by name.

    python tools/text-conflicts.py
    python tools/text-conflicts.py --lo 700 --hi 1100 --step 10 --pages /about/
"""
import argparse
import sys
from playwright.sync_api import sync_playwright

# The console here is cp1252; page text carries arrows and curly quotes.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8777"
PAGES = ["/", "/about/", "/alu/logic-gates/", "/alu/full-adder/",
         "/alu/alu-slice/", "/alu/complete-alu/", "/alu/testing/",
         "/single-cycle-cpu/basics-of-instructions/",
         "/single-cycle-cpu/fetch-decode-execute/",
         "/single-cycle-cpu/constructing-a-datapath/",
         "/single-cycle-cpu/control-unit/", "/single-cycle-cpu/testing/",
         "/pipelined-cpu/pipelining/", "/pipelined-cpu/pipelined-datapath/",
         "/pipelined-cpu/pipelined-control/",
         "/pipelined-cpu/data-hazards/",
         "/introduction-to-physical-design/transistor-basics/",
         "/introduction-to-physical-design/implementing-arbitrary-logic/"]

# Freeze the reveals, or an element caught mid-tween reports in-flight geometry
# and every measurement is fiction. Straight from the mobile-scheme skill.
FREEZE = """
() => {
  document.head.appendChild(Object.assign(document.createElement('style'),
    {textContent: `*,*::before,*::after{transition:none!important;animation:none!important}
                   html,body{overflow-x:visible!important}
                   [data-reveal],.reveal,.is-revealing{opacity:1!important;transform:none!important}`}));
  /* Zero EVERY transform, not just the ones on known reveal classes. The
     buildpath paragraphs animate in on a translate(12px,18px) under a class this
     did not name, and an element caught mid-tween reports its in-flight box --
     which read as a 12px overflow on five paragraphs that were laid out
     correctly. Measuring a reveal is measuring an animation, not a layout. */
  document.head.appendChild(Object.assign(document.createElement('style'),
    {textContent: `*{transform:none!important}`}));
  if (window.gsap) { gsap.globalTimeline.progress(1); gsap.globalTimeline.pause(); }
  document.querySelectorAll('*').forEach(e => {
    const s = getComputedStyle(e);
    if (s.opacity === '0' && e.getAttribute('aria-hidden') !== 'true') e.style.opacity = '1';
  });
}
"""

SCAN = """
() => {
  /* Two rules keep this from drowning in false positives, and both were learned
     the expensive way on the first run.

     ONLY BLOCK-LEVEL BOXES ARE COMPARED. An inline element that wraps across
     lines gets a bounding rect spanning the whole column, so two <strong>s in
     one paragraph "overlap" by construction. That produced 40-odd hits per page,
     every one of them a correctly-flowing sentence.

     ONLY SIBLINGS UNDER A COMMON POSITIONED/FLOW PARENT. Boxes in different
     stacking contexts are allowed to sit over each other, and a deliberate
     overlay (the code editor's highlight layer over its textarea, a figure
     caption over art) is a design, not a defect. */
  /* `reveal-hint` is absolutely positioned at `left: calc(100% + .6rem)` -- it
     lives in the gutter beside the figure ON PURPOSE, and an absolute descendant
     outside its parent's box still counts toward that parent's scrollWidth, so it
     reads as a 57px spill on a figure that is fine. `gate-card__face` is a flip
     card: the front and back faces are stacked by design and overlap 100%.
     Neither is a defect; both were verified by eye before being silenced. */
  const SKIP = /tooltip|popover|drawer|backdrop|sheet|overlay|modal|sr-only|visually-hidden|nav-toggle|scroll-cue|hero__scroll|code-editor|tok-|highlight|caret|cursor|reveal-hint|gate-card__face/i;
  const BLOCKISH = /^(block|flow-root|list-item|flex|grid|table|table-cell)$/;

  const vis = (e) => {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    if (s.position === 'fixed' || s.position === 'absolute') return false;
    return true;
  };
  const name = (e) => (e.id ? '#'+e.id : '') +
    (typeof e.className === 'string' && e.className.trim()
      ? '.'+e.className.trim().split(/\\s+/).slice(0,2).join('.') : '') || e.tagName;

  const boxes = [];
  document.querySelectorAll('body *').forEach(e => {
    if (SKIP.test((e.className||'') + ' ' + e.id)) return;
    let ok = true;
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      if (!vis(p) || SKIP.test((p.className||'') + ' ' + p.id)) { ok = false; break; }
    }
    if (!ok) return;
    const s = getComputedStyle(e);
    if (!BLOCKISH.test(s.display)) return;
    if (s.overflow !== 'visible' && s.overflow !== '') return;   // scrollers contain their own
    const txt = (e.textContent || '').trim();
    if (!txt) return;
    const r = e.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    boxes.push({e, r, txt: txt.slice(0, 40), n: name(e)});
  });

  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      // only boxes that share a parent chain in normal flow
      if (A.e.parentElement !== B.e.parentElement) continue;
      /* A FLOAT is supposed to have text flowing beside and under it -- that is
         the entire point of a float, and its box legitimately overlaps the
         paragraph's. Both remaining "overlaps" on the site were floats:
         .edge-card and .mode-switch, each `float: right`. */
      if (getComputedStyle(A.e).float !== 'none') continue;
      if (getComputedStyle(B.e).float !== 'none') continue;
      const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ox > 3 && oy > 3) {
        const frac = (ox*oy) / Math.min(A.r.width*A.r.height, B.r.width*B.r.height);
        if (frac > 0.20)
          hits.push({kind:'overlap', a:A.n, b:B.n, at:A.txt, bt:B.txt,
                     px: Math.round(Math.min(ox, oy)), frac: +frac.toFixed(2)});
      }
    }
  }
  /* Text spilling out of a box that is meant to hold it.

     Measured from IN-FLOW children only, not from scrollWidth. scrollWidth
     counts absolutely-positioned descendants that sit outside the box on
     purpose, and this site has two such patterns everywhere: `.reveal-hint`
     parks an affordance at `left: calc(100% + .6rem)` in the gutter, and the
     mobile scheme's 44px touch regions are centred `::after` boxes deliberately
     larger than the control they wrap. Both reported as 4-57px spills on
     elements that are perfectly fine. An absolute child is positioned, not
     overflowing. */
  document.querySelectorAll('body *').forEach(e => {
    if (SKIP.test((e.className||'') + ' ' + e.id) || !vis(e)) return;
    const s = getComputedStyle(e);
    if (s.overflow !== 'visible' || !BLOCKISH.test(s.display)) return;
    if (!(e.textContent || '').trim()) return;
    if ([...e.children].some(c => /pre|table|svg|canvas|img/i.test(c.tagName))) return;
    const box = e.getBoundingClientRect();
    let far = 0;
    for (const c of e.children) {
      const cs = getComputedStyle(c);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      far = Math.max(far, c.getBoundingClientRect().right - box.left);
    }
    /* With no element children, scrollWidth is NOT text-only: it also counts
       ::before/::after. The mobile scheme's 44px touch regions are exactly that
       -- a centred pseudo box deliberately wider than the control -- so every
       one of them reported as a 10px spill. Measure the text itself instead. */
    let over;
    if (e.children.length) {
      over = far - e.clientWidth;
    } else {
      const rg = document.createRange();
      rg.selectNodeContents(e);
      const tr = rg.getBoundingClientRect();
      over = tr.width - e.clientWidth;
      rg.detach();
    }
    if (e.clientWidth > 0 && over > 3)
      hits.push({kind:'spill', a: name(e), px: Math.round(over),
                 at: (e.textContent||'').trim().slice(0, 40)});
  });
  return hits;
}
"""


def key(h):
    return (h['kind'], h.get('a'), h.get('b'))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lo", type=int, default=320)
    ap.add_argument("--hi", type=int, default=1440)
    ap.add_argument("--step", type=int, default=40)
    ap.add_argument("--pages", nargs="*", default=PAGES)
    a = ap.parse_args()

    total = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for page in a.pages:
            found = {}
            for w in range(a.lo, a.hi + 1, a.step):
                pg.set_viewport_size({"width": w, "height": 1000})
                pg.goto(BASE + page, wait_until="domcontentloaded")
                pg.wait_for_timeout(120)
                pg.evaluate(FREEZE)
                pg.wait_for_timeout(60)
                # scroll the page so lazily-revealed content lays out
                pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                pg.wait_for_timeout(150)
                pg.evaluate("window.scrollTo(0, 0)")
                pg.wait_for_timeout(80)
                for h in pg.evaluate(SCAN):
                    found.setdefault(key(h), {"h": h, "w": []})["w"].append(w)
            if found:
                print(f"\n=== {page}")
                for v in sorted(found.values(), key=lambda v: -len(v["w"])):
                    h, ws = v["h"], v["w"]
                    span = f"{min(ws)}..{max(ws)}px" if len(ws) > 1 else f"{ws[0]}px"
                    if h["kind"] == "overlap":
                        print(f"  OVERLAP {span:16s} {h['a']}  x  {h['b']}")
                        print(f"          {h['px']}px deep, {int(h['frac']*100)}% of the smaller"
                              f"   [{h['at']!r} / {h['bt']!r}]")
                    else:
                        print(f"  SPILL   {span:16s} {h['a']}  +{h['px']}px  [{h['at']!r}]")
                    total += 1
        b.close()
    print(f"\n{total} distinct conflicts")
