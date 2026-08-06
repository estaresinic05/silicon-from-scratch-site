"""Elevation and azimuth at every camera key, with spikes flagged.

Exists because the floorplan sweep spent a long time doing the opposite of what
its own comment claimed: the elevations ran 21, 46, 19, so the camera climbed to
near birds-eye right as the first regions bloomed and then dropped back. That is
hard to see while scrubbing a scroll and obvious in motion.

A jump of more than ~12 degrees between neighbouring keys is worth a look; inside
a stage it is almost always a mistake. Deliberate rises exist (the run into the
core, and the lift off it at the end) and are annotated as such below.
"""
import math, re, io
SRC = r'C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\meet-the-processor\scene.js'
s_src = io.open(SRC, encoding='utf-8').read()
s = s_src
DIE_W, DIE_H = 9.07, 7.78
PKG = 40.0
DIE_OFF_X, DIE_OFF_Z = 4.82, 8.80
PCX, PCZ = -DIE_OFF_X, -DIE_OFF_Z
# Turned, as scene.js turns it: the die shot goes down a half turn round, which
# carries the core to the die's far-right corner. See "The half turn" in
# ../README.md.
CORE_U, CORE_V = (1-0.350, 1-0.015), (1-0.8176, 1-0.6193)
coreCX = -DIE_W/2 + (CORE_U[0]+CORE_U[1])/2*DIE_W
coreCZ = -DIE_H/2 + (CORE_V[0]+CORE_V[1])/2*DIE_H
env = {'PCX': PCX, 'PCZ': PCZ, 'coreCX': coreCX, 'coreCZ': coreCZ}
blk = s[s.index('const KEYS = ['):s.index('\n];', s.index('const KEYS = ['))]
rows = re.findall(r'\{ t: ([\d.]+), p: \[(.*?)\], l: \[(.*?)\], f: (\d+) \}', blk)
def vec(txt):
    return [eval(x.strip(), {'__builtins__': {}}, env) for x in txt.split(',')]
keys = [(float(t), vec(p), vec(l), int(f)) for t, p, l, f in rows]
# Parsed from scene.js, never duplicated here. A hardcoded copy went stale the
# moment a stage boundary moved and started reporting cross-stage transitions as
# jumps WITHIN a stage, which is exactly the distinction this script exists to make.
STAGES = [(float(a), b) for a, b in
          re.findall(r"\{ t: ([\d.]+), num: '(\d+)'", s_src)]
def stage(t):
    n = '01'
    for st, num in STAGES:
        if t >= st: n = num
    return n
print(f"{'t':>7} {'stg':>4} {'elev':>7} {'d elev':>7} {'azim':>7} {'dist':>7}")
prev = None
worst = []
for t, p, l, f in keys:
    dy = p[1]-l[1]; dh = math.hypot(p[0]-l[0], p[2]-l[2])
    el = math.degrees(math.atan2(dy, dh))
    az = math.degrees(math.atan2(p[0]-l[0], p[2]-l[2]))
    d = math.hypot(dy, dh)
    flag = ''
    if prev is not None:
        de = el - prev[1]
        same = stage(t) == stage(prev[0])
        if abs(de) > 12:
            flag = f'  <-- {abs(de):.0f} deg jump' + (' WITHIN stage ' + stage(t) if same else '')
            if same: worst.append((t, de))
        print(f"{t:7.3f} {stage(t):>4} {el:6.1f}° {de:+6.1f}° {az:6.1f}° {d:7.2f}{flag}")
    else:
        print(f"{t:7.3f} {stage(t):>4} {el:6.1f}°        {az:6.1f}° {d:7.2f}")
    prev = (t, el)
print()
if worst:
    print("jumps INSIDE a single stage (suspicious):")
    for t, de in worst: print(f"   t={t:.3f}  {de:+.0f} deg")
else:
    print("no elevation jump over 12 degrees inside any single stage")
