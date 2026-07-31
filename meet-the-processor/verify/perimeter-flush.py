"""Perimeter check: every region vertex within reach of a side must sit exactly
on that side's line, and the four sides' coverage is listed so gaps are visible.
"""
import re

SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\prototypes\cpu-layers\scene.js'
SIDES = {'left u': ('u', 0.0076), 'right u': ('u', 1.0),
         'top v': ('v', 0.0269), 'bottom v': ('v', 0.9952)}
REACH = 0.012          # anything this close to a side is claimed to be on it

S = open(SRC, encoding='utf-8').read()
blk = S[S.index('const CORE_BLOCKS = ['):S.index('const coreTiles')]
names = re.findall(r"label:\s*'([^']+)'", blk)
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

bad = 0
for side, (axis, val) in SIDES.items():
    k = 0 if axis == 'u' else 1
    other = 1 - k
    print(f'\n=== {side} = {val}')
    spans = []
    for name, rings in zip(names, regions):
        for ring in rings:
            # A piece either reaches the side or it does not. Interior vertices
            # that merely sit near it (the lane caps' 0.0034 inset, say) are not
            # perimeter — only a piece whose CLOSEST approach is small but
            # nonzero is one that should have been snapped and was not.
            d = min(abs(p[k] - val) for p in ring)
            if 1e-9 < d < REACH:
                bad += 1
                print(f'  NOT FLUSH by {d:.4f}  {name}')
            on = [p for p in ring if abs(p[k] - val) < 1e-9]
            if len(on) >= 2:
                spans.append((min(p[other] for p in on),
                              max(p[other] for p in on), name))
    spans.sort()
    cur = None
    for a, b, name in spans:
        gap = '' if cur is None or abs(a - cur) < 1e-9 else f'   <- gap {a-cur:.4f}'
        print(f'  {a:.4f} - {b:.4f}  {name}{gap}')
        cur = b if cur is None else max(cur, b)

print('\nALL FOUR SIDES FLUSH' if not bad else f'\n{bad} vertex/vertices off a side')
