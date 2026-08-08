#!/usr/bin/env python
"""Prove the mobile scheme cannot affect the desktop layout.

Pixel-diffing two separate renders is the wrong instrument here: the site
animates reveals with GSAP and renders a WebGL scene, so two runs of the same
unchanged page differ anyway. That noise hides the signal.

This measures the thing actually in question instead. In ONE page load it
walks every element and records its geometry, then disables the mobile
stylesheet in place, forces a reflow, and walks again. If the two passes are
identical, the stylesheet contributed nothing at that width -- deterministically,
with no animation or frame timing involved.

For meet-the-processor the mobile rules live inside the page's own stylesheet
and cannot be toggled as a file, so the proof there is the media query itself:
a query that does not match cannot apply.
"""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8797

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
    "pipelined-cpu/pipelined-control/index.html",
]

# Geometry + the properties the mobile scheme actually touches, for every
# element. Rounded to 2dp so sub-pixel float noise is not mistaken for change.
MEASURE = """
() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push([
      Math.round(r.x*100)/100, Math.round(r.y*100)/100,
      Math.round(r.width*100)/100, Math.round(r.height*100)/100,
      cs.fontSize, cs.lineHeight, cs.letterSpacing,
      cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft,
      cs.marginTop, cs.marginBottom, cs.minHeight, cs.minWidth,
      cs.overflowX, cs.maxWidth, cs.position, cs.display,
    ].join('|'));
  }
  return out;
}
"""

# The reveals are still easing while we measure, so the two passes catch the
# same element at two points of the same tween and its y differs by hundredths
# of a pixel. Freeze everything first: jump GSAP's timeline to the end, pause
# it, and kill CSS transitions. Applied identically before both passes, and it
# touches only animation -- never layout.
FREEZE = """
() => {
  if (window.gsap) {
    gsap.globalTimeline.progress(1, true);
    gsap.globalTimeline.pause();
  }
  if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.disable(false));
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(s);
  void document.body.offsetHeight;
}
"""

TOGGLE = """
(want) => {
  let found = 0;
  for (const s of document.styleSheets) {
    if (s.href && s.href.includes('mobile.css')) { s.disabled = !want; found++; }
  }
  // Force a synchronous layout so the next measure sees the new state.
  void document.body.offsetHeight;
  return found;
}
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main() -> int:
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (1280, 1600):
            ctx = browser.new_context(viewport={"width": width, "height": 1000})
            for page_path in PAGES:
                pg = ctx.new_page()
                pg.goto(f"http://127.0.0.1:{PORT}/{page_path}", wait_until="load", timeout=45000)
                pg.wait_for_timeout(700)

                pg.evaluate(FREEZE)
                pg.wait_for_timeout(120)
                n = pg.evaluate(TOGGLE, True)      # ensure enabled
                if n == 0:
                    failures.append(f"{page_path} @ {width}: mobile.css NOT LINKED")
                    pg.close()
                    continue
                with_sheet = pg.evaluate(MEASURE)
                pg.evaluate(TOGGLE, False)          # disable it
                pg.wait_for_timeout(60)
                without = pg.evaluate(MEASURE)

                if with_sheet != without:
                    diffs = [i for i, (a, b) in enumerate(zip(with_sheet, without)) if a != b]
                    failures.append(
                        f"{page_path} @ {width}: {len(diffs)} element(s) MOVED. "
                        f"first: {with_sheet[diffs[0]]}  vs  {without[diffs[0]]}"
                    )
                pg.close()
            ctx.close()

        # meet-the-processor: the proof is that the query cannot match.
        ctx = browser.new_context(viewport={"width": 1280, "height": 1000})
        pg = ctx.new_page()
        pg.goto(f"http://127.0.0.1:{PORT}/meet-the-processor/", wait_until="load", timeout=45000)
        pg.wait_for_timeout(900)
        for w in (769, 1280, 1600):
            pg.set_viewport_size({"width": w, "height": 1000})
            m = pg.evaluate("() => window.matchMedia('(max-width: 768px)').matches")
            print(f"  meet-the-processor @ {w}px -> mobile query matches: {m}")
            if m:
                failures.append(f"meet-the-processor: query matched at {w}px")
        ctx.close()
        browser.close()
    httpd.shutdown()

    print()
    if failures:
        print(f"FAILED -- {len(failures)} problem(s):")
        for f in failures:
            print("  ", f)
        return 1
    print(f"PASS -- mobile.css changes nothing at 1280px or 1600px, "
          f"across {len(PAGES)} pages (geometry + type + spacing identical "
          f"with the sheet enabled and disabled).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
