"""Overlap audit across every core block now placed.

Flush regions share boundary pixels by design, so rasterise each region and
erode by 1 px before intersecting — anything left is a real overlap, not a
shared edge. A region may be several disjoint pieces; each is rasterised into
the same mask.
"""
import re
import numpy as np
from PIL import Image, ImageDraw

SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\prototypes\cpu-layers\scene.js'
S = open(SRC, encoding='utf-8').read()
block = S[S.index('const CORE_BLOCKS = ['):S.index('const coreTiles')]

names = re.findall(r"label:\s*'([^']+)'", block)

# Walk each `polys:` value with a bracket counter so multi-piece regions parse
# as several rings instead of one run-together polygon.
regions = []
for m in re.finditer(r'polys:\s*\[', block):
    i, depth = m.end() - 1, 0
    while True:
        if block[i] == '[':
            depth += 1
        elif block[i] == ']':
            depth -= 1
            if depth == 0:
                break
        i += 1
    body = block[m.end():i]
    rings = []
    j, d, start = 0, 0, None
    while j < len(body):
        if body[j] == '[':
            if d == 0:
                start = j
            d += 1
        elif body[j] == ']':
            d -= 1
            if d == 0:
                rings.append(body[start:j + 1])
        j += 1
    regions.append([[[float(a), float(b)] for a, b in
                     re.findall(r'\[([-\d.]+)\s*,\s*([-\d.]+)\]', r)] for r in rings])

assert len(names) == len(regions), f'{len(names)} labels vs {len(regions)} polys'
print(f'{len(names)} regions')

R = 2048
masks = []
for rings in regions:
    im = Image.new('L', (R, R), 0)
    d = ImageDraw.Draw(im)
    for ring in rings:
        d.polygon([(x * R, y * R) for x, y in ring], fill=255)
    masks.append(np.asarray(im) > 0)


def erode(m):
    e = m.copy()
    e[1:, :] &= m[:-1, :]; e[:-1, :] &= m[1:, :]
    e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
    return e


er = [erode(m) for m in masks]
bad = 0
for i in range(len(masks)):
    for j in range(i + 1, len(masks)):
        n = int((er[i] & er[j]).sum())
        if n:
            bad += 1
            print(f'  OVERLAP  {names[i]!r} x {names[j]!r}: {n} px')
print('  no overlaps beyond shared boundaries' if not bad else f'  {bad} overlapping pair(s)')

print('\narea (as % of the core crop):')
for n, m, rings in zip(names, masks, regions):
    piece = f'  [{len(rings)} pieces]' if len(rings) > 1 else ''
    print(f'  {n:22s} {100*m.sum()/(R*R):6.2f}%{piece}')
tot = np.zeros((R, R), bool)
for m in masks:
    tot |= m
print(f'  {"TOTAL annotated":22s} {100*tot.sum()/(R*R):6.2f}%')
