"""Shoot the same stops at a desktop and a phone viewport, so the narrow-viewport
camera fit can be judged against what the stop was composed to look like.

Usage:  python verify/fit-compare.py [tag] [t ...]
Writes  fit_<tag>_<w>x<h>_t<0888>.png next to this file.
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/meet-the-processor/"
TAG = sys.argv[1] if len(sys.argv) > 1 else "now"
TARGETS = [float(a) for a in sys.argv[2:]] or [0.888, 0.966, 0.990]
VIEWS = [(1440, 900), (390, 844)]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    for w, h in VIEWS:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_function("window.__die !== undefined", timeout=60000)
        # Drift off, or the same code shoots differently every run.
        pg.evaluate("window.__die.drift = false")
        for t in TARGETS:
            pg.evaluate("(t)=>window.__die.seek(t)", t)
            pg.wait_for_function(
                "(t) => Math.abs(window.__die.t - t) < 0.005", arg=t, timeout=90000)
            # Long enough for the caption swap AND stop 07's inverter assembly,
            # which is keyed off parkedAt and is still building at 900 ms.
            pg.wait_for_timeout(2600)
            out = f"fit_{TAG}_{w}x{h}_t{int(t*1000):04d}.png"
            pg.screenshot(path=out, timeout=120000)
            print(f"{w}x{h} t={t} -> {out}")
        pg.close()
    b.close()
