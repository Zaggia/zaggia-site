# Ricostruzione della sala della foto, in coordinate mondo (m):
# parete di fondo z=0, pavimento y=0, asse della sala x=0, camera guarda verso -z.
import numpy as np
F, VX, VY = 445.0, 299.3, 188.1          # focale e punto di fuga (px sull'immagine 600x337)
IW, IH = 600, 337
HC = 1.6                                  # altezza camera
ZC = F * HC / (206.2 - VY)                # distanza camera - parete di fondo
CAMX = -0.095
ROOM_W, ROOM_H = 7.9, HC + (VY - 141.0) / F * ZC
PED_H, GLASS_TOP = 0.95, 2.22
FRONTS = [5.0, 9.06, 13.59, 17.2, 20.7, 24.3, 27.9]   # distanza dalla camera del fronte
INNER = 2.665
SPECIAL = {(-1, 0): dict(inner=2.8), (1, 0): dict(inner=2.41)}   # le prime due non sono simmetriche
def vitrines():
    out = []
    for i, zm0 in enumerate(FRONTS):
        for s in (-1, 1):
            sp = SPECIAL.get((s, i), {})
            zm, inner = sp.get('zm', zm0), sp.get('inner', INNER)
            zf = ZC - zm
            out.append(dict(kind='ped', x=sorted([s * inner, s * (inner + 0.745)]), y=[0, PED_H], z=[zf - 0.6, zf]))
            out.append(dict(kind='glass', x=sorted([s * (inner + 0.015), s * (inner + 0.665)]), y=[PED_H, GLASS_TOP], z=[zf - 0.57, zf - 0.03]))
    # riflessi dei piedistalli nel pavimento lucido: lo stesso volume, specchiato sotto
    out += [dict(b, kind='mirror', y=[-PED_H, 0]) for b in list(out) if b['kind'] == 'ped']
    return out
def project(p):
    p = np.asarray(p, float)
    d = ZC - p[..., 2]
    u = VX + F * (p[..., 0] - CAMX) / d
    v = VY - F * (p[..., 1] - HC) / d
    return np.stack([u, v], -1)
if __name__ == '__main__':
    print(f'ZC={ZC:.3f} H={ROOM_H:.3f}')
