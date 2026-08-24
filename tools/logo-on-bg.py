"""Bake the site's dark background behind logo-transparent-dark.png.

    python tools/logo-on-bg.py

Produces assets/home/logo-dark-bg.png: the same mark, on the same background a
visitor sees, for the places a transparent PNG cannot go (social cards, README
headers, anywhere the surrounding surface is not ours to control).

THE GLOW IS THE SITE'S OWN, not an approximation. styles/main.css paints it on
`.theme-dark::before` as

    radial-gradient(56rem 40rem at 13% -6%,
                    color-mix(in srgb, var(--fill) 26%, transparent), transparent 64%)

over `--bg`. Every number below is read straight off that rule. The radii are
expressed as fractions of a 1440x900 desktop viewport at a 16px root, which is
what those rem values resolve to there, so the glow keeps the proportions it has
on screen rather than the ones a differently-shaped canvas would give it.

`transparent 64%` is the part worth not guessing at: color stops sit along the
gradient ray where 100% is the ellipse edge, so the glow has faded out entirely
by 64% of the radius. Ramping across the full radius instead makes it noticeably
larger and softer than the page's.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "home", "logo-transparent-dark.png")
OUT = os.path.join(ROOT, "assets", "home", "logo-dark-bg.png")

BG = (0x08, 0x08, 0x0b)          # --bg, dark theme
FILL = (0x6b, 0x2f, 0xc9)        # --fill
PEAK = 0.26                      # color-mix(... --fill 26%, transparent)
STOP = 0.64                      # transparent 64%
CX, CY = 0.13, -0.06             # at 13% -6%
RX, RY = 56 * 16 / 1440.0, 40 * 16 / 900.0   # 56rem x 40rem on a 1440x900 root-16 viewport


def build():
    logo = Image.open(SRC).convert("RGBA")
    w, h = logo.size
    cx, cy = CX * w, CY * h
    rx, ry = RX * w, RY * h

    canvas = Image.new("RGB", (w, h), BG)
    px = canvas.load()
    # One row of dx^2 terms, reused down the image. The whole thing is a few
    # million pixels and this keeps it to a couple of seconds without numpy.
    dxs = [((x - cx) / rx) ** 2 for x in range(w)]
    br, bg_, bb = BG
    fr, fg, fb = FILL
    for y in range(h):
        dy2 = ((y - cy) / ry) ** 2
        row = px
        for x in range(w):
            d = (dxs[x] + dy2) ** 0.5
            if d >= STOP:
                continue
            a = PEAK * (1.0 - d / STOP)
            row[x, y] = (int(br + (fr - br) * a + 0.5),
                         int(bg_ + (fg - bg_) * a + 0.5),
                         int(bb + (fb - bb) * a + 0.5))

    canvas.paste(logo, (0, 0), logo)          # alpha of the source is the mask
    canvas.save(OUT, "PNG")
    return OUT, canvas.size


if __name__ == "__main__":
    path, size = build()
    print("wrote %s  %dx%d" % (path, size[0], size[1]))
