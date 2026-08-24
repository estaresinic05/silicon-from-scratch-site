#!/usr/bin/env python
"""Mobile-width screenshots for Silicon From Scratch.

Renders each page at phone/tablet widths and writes full-page PNGs into
.mobile-audit/ so the `mobile-guardian` agent can actually SEE how the
current markup/CSS behaves on a narrow screen before deciding what to fix.

The site reveals most content with GSAP ScrollTrigger (elements start hidden
when the `js` class is present). A plain screenshot would therefore capture
blank gaps, so this script scrolls each page top-to-bottom first to trigger
every reveal, then captures the full page.

Usage:
  python tools/mobile-shots.py                  # every page, every width
  python tools/mobile-shots.py index.html       # just one page (path or name)
  python tools/mobile-shots.py --widths 390     # override the widths
  python tools/mobile-shots.py --landscape      # add the 844x390 landscape phone
  python tools/mobile-shots.py --keep           # don't wipe old shots first

Output: .mobile-audit/<flattened-page>__<width>w.png
        .mobile-audit/<flattened-page>__844w-land.png   (with --landscape)

Phone fixes belong in styles/mobile.css and nowhere else — see the
`mobile-scheme` skill for why, and for how to prove desktop is unaffected.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit(
        "Playwright is not installed. Run:\n"
        "  python -m pip install playwright\n"
        "  python -m playwright install chromium"
    )

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / ".mobile-audit"
DEFAULT_WIDTHS = [390, 430, 768]  # standard phone, large phone, tablet portrait
TABLET_CUTOFF = 600              # >= this width is treated as a tablet, not a phone


def discover_pages() -> list[Path]:
    """All HTML pages in the project, deepest-first for stable ordering."""
    pages = [p for p in ROOT.rglob("*.html") if ".mobile-audit" not in p.parts]
    return sorted(pages, key=lambda p: str(p).lower())


def resolve_page(arg: str) -> Path | None:
    """Map a user-supplied page (name or relative path) to a real file."""
    direct = (ROOT / arg).resolve()
    if direct.is_file():
        return direct
    matches = [p for p in discover_pages() if p.name == arg or arg in str(p)]
    return matches[0] if matches else None


def flat_name(page: Path) -> str:
    """index.html -> index ; about/index.html -> about__index."""
    rel = page.relative_to(ROOT).with_suffix("")
    return "__".join(rel.parts)


def scroll_through(page) -> None:
    """Scroll the whole document so every ScrollTrigger reveal fires."""
    page.evaluate(
        """async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const step = Math.round(window.innerHeight * 0.8);
            let y = 0;
            const max = document.body.scrollHeight;
            while (y < max) {
                window.scrollTo(0, y);
                await sleep(120);
                y += step;
            }
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(300);
            window.scrollTo(0, 0);
            await sleep(200);
        }"""
    )


def shoot(pw, page_file: Path, width: int, landscape: bool = False) -> Path:
    is_tablet = width >= TABLET_CUTOFF
    browser = pw.chromium.launch()
    # Real device emulation, not just a narrow window. The device pixel ratio
    # matters because it is what makes hairlines and small type render the way
    # they actually do on a phone, and `is_mobile` is what makes the page use
    # the mobile user-agent and viewport behavior rather than a desktop one.
    # A resized desktop window passes tests a real phone fails.
    context = browser.new_context(
        viewport={"width": width, "height": 390 if landscape else 844},
        device_scale_factor=2 if is_tablet else 3,
        is_mobile=not is_tablet,
        has_touch=True,
    )
    page = context.new_page()
    page.goto(page_file.as_uri(), wait_until="load", timeout=45000)
    # Let CDN libs (GSAP / three.js) boot, then trigger all reveals.
    page.wait_for_timeout(800)
    try:
        scroll_through(page)
    except Exception:
        pass  # a JS hiccup shouldn't stop us getting a screenshot
    page.wait_for_timeout(300)
    # A full-page shot is stitched, and a `position: fixed` element is painted
    # wherever it stood during the capture — so the top bar lands in the middle
    # of the image and reads as a layout bug that isn't there. Pin it to the top
    # of the document for the shot, and drop the fixed scroll cue for the same
    # reason, so the PNG shows what a reader actually sees.
    try:
        page.evaluate(
            """() => {
                const bar = document.querySelector('.topbar');
                if (bar) {
                    bar.classList.remove('is-hidden');
                    bar.style.position = 'absolute';
                    bar.style.top = '0';
                    bar.style.transform = 'none';
                }
                const cue = document.querySelector('.hero__scroll');
                if (cue) cue.style.display = 'none';
                // The dark theme's purple corner glow is `position: fixed` so
                // it stays in the top-left of the SCREEN as you scroll. In a
                // stitched shot it lands mid-image and reads as a background
                // that starts halfway down the page. Re-anchor it to the top
                // of the document; a pseudo-element needs a stylesheet.
                const s = document.createElement('style');
                s.textContent =
                    'body::before{position:absolute!important;top:0!important;height:100vh!important}';
                document.head.appendChild(s);
                void document.body.offsetHeight;
            }"""
        )
        page.wait_for_timeout(120)
    except Exception:
        pass
    suffix = f"{width}w-land" if landscape else f"{width}w"
    out = OUT_DIR / f"{flat_name(page_file)}__{suffix}.png"
    page.screenshot(path=str(out), full_page=True)
    context.close()
    browser.close()
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Screenshot pages at mobile widths.")
    ap.add_argument("page", nargs="?", help="A single page (name or relative path).")
    ap.add_argument("--widths", type=int, nargs="+", default=DEFAULT_WIDTHS)
    ap.add_argument("--keep", action="store_true", help="Keep existing screenshots.")
    ap.add_argument(
        "--landscape",
        action="store_true",
        help="Also shoot 844x390, the landscape phone. Worst case for anything "
             "that assumes a tall viewport, and the least-checked size on the site.",
    )
    args = ap.parse_args()

    if args.page:
        target = resolve_page(args.page)
        if not target:
            print(f"No page matched '{args.page}'.")
            return 1
        pages = [target]
    else:
        pages = discover_pages()

    if not args.keep and OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(exist_ok=True)

    print(f"Rendering {len(pages)} page(s) at widths {args.widths}px ->  {OUT_DIR}")
    with sync_playwright() as pw:
        for page_file in pages:
            for width in args.widths:
                out = shoot(pw, page_file, width)
                print(f"  {out.relative_to(ROOT)}")
            if args.landscape:
                out = shoot(pw, page_file, 844, landscape=True)
                print(f"  {out.relative_to(ROOT)}")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
