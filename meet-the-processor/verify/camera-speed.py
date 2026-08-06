import numpy as np, re
p=r"C:\Users\ellio\OneDrive\Documents\CPU\Silicon-From-Scratch-Website\meet-the-processor\scene.js"
s=open(p,encoding="utf-8").read()
blk=s[s.index("const KEYS = ["):s.index("const _p = new THREE.Vector3()")]
# resolve the two symbols the keys use. The core rect is TURNED, as scene.js
# turns it — see "The half turn" in ../README.md.
DIE_W,DIE_H=9.07,7.78
coreCX=-DIE_W/2+((1-0.350)+(1-0.015))/2*DIE_W
coreCZ=-DIE_H/2+((1-0.8176)+(1-0.6193))/2*DIE_H
PCX,PCZ=-4.82,-8.80
env={"coreCX":coreCX,"coreCZ":coreCZ,"PCX":PCX,"PCZ":PCZ}
rows=re.findall(r"\{\s*t:\s*([\d.]+),\s*p:\s*\[([^\]]+)\],\s*l:\s*\[([^\]]+)\]",blk)
prev=None
print(f'{"t":>7} {"dt":>7} {"dist":>7} {"speed":>8}   flag')
for t,pv,lv in rows:
    t=float(t); pos=np.array([eval(x,{},env) for x in pv.split(",")])
    if prev is not None:
        dt=t-prev[0]; d=float(np.linalg.norm(pos-prev[1])); sp=d/dt if dt else 0
        flag="<-- LURCH" if sp>520 else ""
        print(f"{t:7.3f} {dt:7.3f} {d:7.2f} {sp:8.0f}   {flag}")
    prev=(t,pos)
