"""What each fill actually looks like, and whether white type survives on it.

The overlay is drawn at globalAlpha 0.62 over the die photo, so the authored hex
is not what reaches the eye. Blend each region's colour over the real pixels it
covers and score the result against white with the WCAG contrast ratio. 4.5 is
the usual floor for body text, 3.0 for large text; these labels are large, so
treat under 3.0 as failing and 3.0-3.5 as marginal.
"""
import re
import numpy as np
from PIL import Image, ImageDraw

SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\prototypes\cpu-layers\scene.js'
IMG = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\prototypes\cpu-layers\assets\core-detail.jpg'
ALPHA = 0.62

S = open(SRC, encoding='utf-8').read()
blk = S[S.index('const CORE_BLOCKS = ['):S.index('const coreTiles')]
names = re.findall(r"label:\s*'([^']+)'", blk)
colors = re.findall(r"color:\s*'(#[0-9a-fA-F]{6})'", blk)

regions = []
for m in re.finditer(r'polys:\s*\[', blk):
    i, d = m.end() - 1, 0
    while True:
        if blk[i] == '[':
            d += 1
        elif blk[i] == ']':
            d -= 1
            if d == 0:
                break
        i += 1
    body, rings, j, dd, st = blk[m.end():i], [], 0, 0, None
    while j < len(body):
        if body[j] == '[':
            if dd == 0:
                st = j
            dd += 1
        elif body[j] == ']':
            dd -= 1
            if dd == 0:
                rings.append(body[st:j + 1])
        j += 1
    regions.append([[[float(a), float(b)] for a, b in
                     re.findall(r'\[([-\d.]+)\s*,\s*([-\d.]+)\]', r)] for r in rings])

im = np.asarray(Image.open(IMG).convert('RGB')).astype(float)
H, W = im.shape[:2]


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def ratio(rgb):
    L = float((lin(np.array(rgb)) * np.array([0.2126, 0.7152, 0.0722])).sum())
    return 1.05 / (L + 0.05)


rows = []
for name, hexc, rings in zip(names, colors, regions):
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    for ring in rings:
        d.polygon([(x * W, y * H) for x, y in ring], fill=255)
    m = np.asarray(mask) > 0
    if not m.any():
        continue
    under = im[m].mean(axis=0)
    fill = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)], float)
    blend = ALPHA * fill + (1 - ALPHA) * under
    rows.append((ratio(blend), name, hexc, blend))

rows.sort()
print(f'{"contrast":>8}  {"region":24s} {"hex":8s}  blended RGB   verdict')
for r, name, hexc, b in rows:
    verdict = 'FAILS' if r < 3.0 else ('marginal' if r < 3.5 else '')
    print(f'{r:8.2f}  {name:24s} {hexc}  '
          f'({b[0]:3.0f},{b[1]:3.0f},{b[2]:3.0f})  {verdict}')
