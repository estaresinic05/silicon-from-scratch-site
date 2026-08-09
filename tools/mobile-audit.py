#!/usr/bin/env python
"""Mobile audit + desktop baseline for Silicon From Scratch.

Renders every real page over HTTP (needed for the WebGL pages' import maps)
across a set of true device profiles -- DPR, touch and mobile UA included, not
just a resized desktop window -- and, for each one, walks the DOM to find every
element that actually sticks out past the viewport.

Usage:
  python audit.py --set desktop --out .audit/base     # baseline, before edits
  python audit.py --set mobile  --out .audit/before
  python audit.py --set desktop --out .audit/after    # prove desktop unmoved
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8791

# The 16 real pages. prototypes/ is archaeology and node_modules is not ours.
PAGES = [
    "index.html",
    "about/index.html",
    "coming-soon/index.html",
    "alu/logic-gates/index.html",
    "alu/full-adder/index.html",
    "alu/alu-slice/index.html",
    "alu/complete-alu/index.html",
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
    "pipelined-cpu/data-hazards/index.html",
    "meet-the-processor/index.html",
]

# name -> (width, height, dpr, is_mobile, has_touch)
PROFILES = {
    "desktop": {
        "d1280": (1280, 900, 1, False, False),
        "d1600": (1600, 1000, 1, False, False),
    },
    "mobile": {
        "p390": (390, 844, 3, True, True),     # iPhone 14/15 class, portrait
        "p430": (430, 932, 3, True, True),     # Pro Max
        "l844": (844, 390, 3, True, True),     # phone landscape -- never audited
        "t768": (768, 1024, 2, True, True),    # tablet portrait
    },
}

# Walk every element and report the ones genuinely wider than the viewport.
# documentElement.scrollWidth alone tells you THAT you overflow, not WHAT does.
OVERFLOW_JS = """
(vw) => {
  // `overflow-x: hidden` on html/body is a legitimate backstop, but it also
  // clamps scrollWidth -- so a page that genuinely lays out 200px too wide
  // reports as clean while its content is quietly clipped off the edge. Lift
  // it for the measurement so the audit sees the real layout, not the mask.
  const unmask = document.createElement('style');
  unmask.textContent = 'html,body{overflow-x:visible!important}';
  document.head.appendChild(unmask);
  void document.body.offsetHeight;

  const bad = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // Deliberately-scrollable strips are not layout bugs.
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const right = r.right + window.scrollX;
    const left = r.left + window.scrollX;
    if (right <= vw + 1 && left >= -1) continue;
    // Blame the outermost offender, not each of its children in turn.
    let p = el.parentElement, covered = false;
    while (p && p !== document.body) {
      if (seen.has(p)) { covered = true; break; }
      p = p.parentElement;
    }
    if (covered) continue;
    seen.add(el);
    bad.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 90)) || '',
      id: el.id || '',
      left: Math.round(left),
      right: Math.round(right),
      over: Math.round(right - vw),
    });
  }
  const sw = document.documentElement.scrollWidth;
  unmask.remove();
  return {
    scrollWidth: sw,
    clientWidth: document.documentElement.clientWidth,
    offenders: bad.slice(0, 25),
  };
}
"""

# Anything interactive that is too small to hit reliably with a thumb.
TAP_JS = """
() => {
  const small = [];
  const sel = 'a, button, input, select, textarea, [role=button], [onclick], [tabindex]';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    small.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 70)) || '',
      text: (el.textContent || '').trim().slice(0, 40),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  }
  return small.slice(0, 30);
}
"""

# A full-page screenshot is stitched, and a `position: fixed` element is painted
# wherever it happened to be during the capture -- so the top bar lands in the
# middle of the image, looking like a layout bug that does not exist. Pin it to
# the top of the DOCUMENT for the shot so the image shows what a reader sees.
# Applied immediately before the screenshot and never before a measurement.
PIN_CHROME_JS = """
() => {
  const bar = document.querySelector('.topbar');
  if (bar) {
    bar.classList.remove('is-hidden');
    bar.style.position = 'absolute';
    bar.style.top = '0';
    bar.style.transform = 'none';
  }
  // The scroll cue is fixed to the foot of the first screen for the same
  // reason and lands mid-image too.
  const cue = document.querySelector('.hero__scroll');
  if (cue) cue.style.display = 'none';

  // `body::before` is the dark theme's purple corner glow, and it is
  // `position: fixed; inset: 0` on purpose so the hue stays in the top-left
  // of the SCREEN at every scroll position. In a stitched full-page shot that
  // pins it to wherever the capture was, which puts a purple wash across the
  // middle of the image and reads as a background starting halfway down the
  // page. Re-anchor it to the top of the document for the shot. A
  // pseudo-element cannot be reached through .style, so this goes in as a
  // stylesheet.
  const s = document.createElement('style');
  s.textContent =
    'body::before{position:absolute!important;top:0!important;height:100vh!important}';
  document.head.appendChild(s);
  void document.body.offsetHeight;
}
"""

SCROLL_JS = """
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const step = Math.round(window.innerHeight * 0.8);
  const max = document.body.scrollHeight;
  for (let y = 0; y < max; y += step) { window.scrollTo(0, y); await sleep(110); }
  window.scrollTo(0, document.body.scrollHeight);
  await sleep(300);
  window.scrollTo(0, 0);
  await sleep(250);
}
"""


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def flat(page: str) -> str:
    return page.replace("/", "__").replace(".html", "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True, choices=["desktop", "mobile"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--pages", nargs="*", help="Subset of pages, by substring.")
    args = ap.parse_args()

    profiles = PROFILES[args.set]
    pages = PAGES
    if args.pages:
        pages = [p for p in PAGES if any(s in p for s in args.pages)]

    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    httpd = serve()
    report: dict = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for prof_name, (w, h, dpr, mob, touch) in profiles.items():
            ctx = browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=dpr,
                is_mobile=mob,
                has_touch=touch,
            )
            for page_path in pages:
                pg = ctx.new_page()
                url = f"http://127.0.0.1:{PORT}/{page_path}"
                try:
                    pg.goto(url, wait_until="load", timeout=45000)
                except Exception as exc:
                    print(f"  !! {page_path} @ {prof_name}: {exc}")
                    pg.close()
                    continue
                pg.wait_for_timeout(1000)
                try:
                    pg.evaluate(SCROLL_JS)
                except Exception:
                    pass
                pg.wait_for_timeout(250)

                key = f"{flat(page_path)}__{prof_name}"
                shot = out_dir / f"{key}.png"
                # meet-the-processor owns the viewport and never scrolls; a
                # full-page shot of it is meaningless.
                full = "meet-the-processor" not in page_path

                # MEASURE FIRST. Pinning the bar changes it from `fixed` to
                # `absolute`, which puts it into normal flow -- measuring after
                # that would report a layout nobody ever sees.
                try:
                    ov = pg.evaluate(OVERFLOW_JS, w)
                    tap = pg.evaluate(TAP_JS) if mob else []
                except Exception as exc:
                    ov, tap = {"error": str(exc)}, []

                if full:
                    try:
                        pg.evaluate(PIN_CHROME_JS)
                        pg.wait_for_timeout(120)
                    except Exception:
                        pass
                try:
                    pg.screenshot(path=str(shot), full_page=full)
                except Exception as exc:
                    print(f"  !! shot {key}: {exc}")
                report[key] = {"overflow": ov, "small_taps": tap}
                flag = ""
                if isinstance(ov, dict) and ov.get("scrollWidth", 0) > w + 1:
                    flag = f"  <-- OVERFLOW +{ov['scrollWidth'] - w}px"
                print(f"  {key}{flag}")
                pg.close()
            ctx.close()
        browser.close()

    httpd.shutdown()
    (out_dir / "report.json").write_text(json.dumps(report, indent=2))
    print(f"\nWrote {out_dir / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
