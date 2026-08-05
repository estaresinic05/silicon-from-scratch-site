"""Where does the layout CHANGE as the window is dragged, and how?

The site is asked to be two modes with a hard line between them. This measures
whether it is: at every width in a sweep it records a fingerprint of the page,
then reports each width where the fingerprint moved and whether the move was a
STEP (a breakpoint doing its job) or a CREEP (a fluid value sliding, which is the
gradient the user can see).

A creep is any change smaller than STEP_PX between two adjacent sample widths.
A step is a big jump at one width, which is what a mode switch looks like.

    python tools/width-sweep.py                     # default pages, 320..1440
    python tools/width-sweep.py --lo 700 --hi 1000 --step 4
    python tools/width-sweep.py --pages / /about/
"""
import argparse
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8777"
PAGES = ["/", "/about/", "/alu/logic-gates/", "/single-cycle-cpu/control-unit/",
         "/introduction-to-physical-design/transistor-basics/"]
STEP_PX = 1.5          # a move smaller than this between samples is a creep

# The fingerprint: things a reader actually perceives. Root size drives every
# rem on the site, so it is the single biggest lever; the rest are the shapes
# most likely to be mid-slide.
FINGERPRINT = """
() => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const cs = (sel, prop) => {
    const e = document.querySelector(sel);
    return e ? px(getComputedStyle(e)[prop]) : null;
  };
  const out = {
    root:  px(getComputedStyle(document.documentElement).fontSize),
    h1:    cs('h1', 'fontSize'),
    h2:    cs('h2', 'fontSize'),
    body:  cs('p', 'fontSize'),
    lead:  cs('.lead', 'fontSize'),
    wrapW: cs('.wrap, .container, main', 'width'),
  };
  // section rhythm: the big spacing tokens, which mobile.css retunes
  const r = getComputedStyle(document.documentElement);
  for (const t of ['--space-5', '--space-6', '--space-7']) {
    const v = r.getPropertyValue(t).trim();
    out[t] = v || null;
  }
  return out;
}
"""


def sweep(pg, url, lo, hi, step):
    rows = []
    for w in range(lo, hi + 1, step):
        pg.set_viewport_size({"width": w, "height": 900})
        pg.goto(url, wait_until="domcontentloaded")
        pg.wait_for_timeout(60)
        rows.append((w, pg.evaluate(FINGERPRINT)))
    return rows


def report(page, rows):
    print(f"\n=== {page}")
    creeps, steps = {}, {}
    for (w0, a), (w1, b) in zip(rows, rows[1:]):
        for k in a:
            va, vb = a[k], b[k]
            if va is None or vb is None or va == vb:
                continue
            try:
                d = abs(float(str(vb).rstrip('remp x')) - float(str(va).rstrip('remp x')))
            except ValueError:
                steps.setdefault(k, []).append(w1)
                continue
            (creeps if d < STEP_PX else steps).setdefault(k, []).append(w1)
    for k in sorted(set(creeps) | set(steps)):
        c, s = creeps.get(k, []), steps.get(k, [])
        if c:
            print(f"  CREEP  {k:11s} slides across {min(c)}..{max(c)}px "
                  f"({len(c)} of the sampled widths)")
        if s:
            shown = ", ".join(str(x) for x in s[:8]) + (" ..." if len(s) > 8 else "")
            print(f"  step   {k:11s} at {shown}")
    if not creeps and not steps:
        print("  no change across the sweep")
    return creeps, steps


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lo", type=int, default=320)
    ap.add_argument("--hi", type=int, default=1440)
    ap.add_argument("--step", type=int, default=8)
    ap.add_argument("--pages", nargs="*", default=PAGES)
    ap.add_argument("--json", help="write the raw sweep here")
    a = ap.parse_args()

    raw = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for page in a.pages:
            rows = sweep(pg, BASE + page, a.lo, a.hi, a.step)
            raw[page] = rows
            report(page, rows)
        b.close()
    if a.json:
        with open(a.json, "w") as f:
            json.dump(raw, f, indent=1)
        print(f"\n-> {a.json}")
