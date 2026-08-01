#!/usr/bin/env python
"""Tap-target audit that only counts controls a thumb can actually reach.

The naive version counts every interactive-looking element. On this site that
badly overcounts: the Verilog flip cards keep their hidden face in the DOM with
`pointer-events: none`, so a card contributes its back-face controls to the
tally even though nothing there can be tapped until the card is flipped.

This filters to elements that are genuinely hittable, and reports the effective
target size -- which, for a control whose hit area was expanded with a
pseudo-element, is larger than the element's own box.
"""

from __future__ import annotations

import collections
import functools
import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8807

PAGES = [
    "index.html", "about/index.html", "coming-soon/index.html",
    "alu/logic-gates/index.html", "alu/full-adder/index.html",
    "alu/alu-slice/index.html", "alu/complete-alu/index.html",
    "alu/testing/index.html",
    "introduction-to-physical-design/transistor-basics/index.html",
    "introduction-to-physical-design/implementing-arbitrary-logic/index.html",
    "single-cycle-cpu/basics-of-instructions/index.html",
    "single-cycle-cpu/constructing-a-datapath/index.html",
    "single-cycle-cpu/control-unit/index.html",
    "single-cycle-cpu/fetch-decode-execute/index.html",
    "single-cycle-cpu/testing/index.html",
    "pipelined-cpu/pipelining/index.html",
    "pipelined-cpu/pipelined-datapath/index.html",
    "meet-the-processor/index.html",
]

JS = """
() => {
  const small = [];
  const sel = 'a, button, input, select, textarea, [role=button], [onclick]';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // Inert by design -- the hidden face of a flip card. Not a tap target.
    if (cs.pointerEvents === 'none') continue;
    if (parseFloat(cs.opacity) === 0) continue;
    // Off-canvas until focused (the skip link) is a keyboard affordance.
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left + window.scrollX < -1000) continue;
    // An ancestor may be inert even when this element is not.
    let p = el.parentElement, inert = false;
    while (p) {
      const pcs = getComputedStyle(p);
      if (pcs.pointerEvents === 'none' || pcs.visibility === 'hidden'
          || pcs.display === 'none') { inert = true; break; }
      p = p.parentElement;
    }
    if (inert) continue;

    // Effective size includes a pseudo-element hit area, which is what the
    // finger actually lands on even though it is not in the element's box.
    let w = r.width, h = r.height;
    for (const which of ['::after', '::before']) {
      const ps = getComputedStyle(el, which);
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
      const pw = parseFloat(ps.width), ph = parseFloat(ps.height);
      const mw = parseFloat(ps.minWidth) || 0, mh = parseFloat(ps.minHeight) || 0;
      if (!isNaN(pw)) w = Math.max(w, pw, mw);
      if (!isNaN(ph)) h = Math.max(h, ph, mh);
    }
    if (w >= 44 && h >= 44) continue;
    small.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 46)) || '',
      text: (el.textContent || '').trim().slice(0, 30),
      w: Math.round(w), h: Math.round(h),
    });
  }
  return small;
}
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main() -> int:
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    counts: collections.Counter = collections.Counter()
    example: dict = {}
    per_page: dict = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3, is_mobile=True, has_touch=True,
        )
        for page_path in PAGES:
            pg = ctx.new_page()
            pg.goto(f"http://127.0.0.1:{PORT}/{page_path}", wait_until="load", timeout=45000)
            pg.wait_for_timeout(900)
            try:
                pg.evaluate("""async () => {
                    const s = ms => new Promise(r => setTimeout(r, ms));
                    const step = Math.round(innerHeight * 0.8);
                    for (let y = 0; y < document.body.scrollHeight; y += step) {
                        scrollTo(0, y); await s(80);
                    }
                    scrollTo(0, 0); await s(200);
                }""")
            except Exception:
                pass
            # Settle the reveals before measuring. A tween caught mid-flight
            # reports its scaled size -- a widget at scale(0.96) makes a 44px
            # button measure 42px and look like a failure it isn't.
            pg.evaluate("""() => {
                if (window.gsap) { gsap.globalTimeline.progress(1, true); gsap.globalTimeline.pause(); }
                const s = document.createElement('style');
                s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
                document.head.appendChild(s);
                void document.body.offsetHeight;
            }""")
            pg.wait_for_timeout(150)
            found = pg.evaluate(JS)
            per_page[page_path] = len(found)
            for t in found:
                key = (t["tag"], t["cls"])
                counts[key] += 1
                example.setdefault(key, t)
            pg.close()
        ctx.close()
        browser.close()
    httpd.shutdown()

    total = sum(counts.values())
    print(f"Tappable controls under 44px @390: {total}\n")
    for (tag, cls), n in counts.most_common(40):
        t = example[(tag, cls)]
        print(f"  {n:3d}x  {tag:8s} {t['w']:3d}x{t['h']:<3d}  .{cls[:46]:48s} {t['text'][:22]!r}")
    print("\nBy page:")
    for p, n in sorted(per_page.items(), key=lambda kv: -kv[1]):
        if n:
            print(f"  {n:3d}  {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
