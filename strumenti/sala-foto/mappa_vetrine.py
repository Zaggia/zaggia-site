import numpy as np, cv2
from sala import *
def id_map(scale):
    w, h = IW * scale, IH * scale
    v, u = np.mgrid[0:h, 0:w] + 0.5
    u /= scale; v /= scale
    # raggi dalla camera della foto (profondita lungo -z = 1)
    o = np.array([CAMX, HC, ZC])
    d = np.stack([(u - VX) / F, -(v - VY) / F, -np.ones_like(u)], -1)
    best = np.full(u.shape, np.inf); ids = np.zeros(u.shape, np.int32)
    for i, b in enumerate(vitrines()):
        lo = np.array([b['x'][0], b['y'][0], b['z'][0]]); hi = np.array([b['x'][1], b['y'][1], b['z'][1]])
        with np.errstate(divide='ignore', invalid='ignore'):
            t1 = (lo - o) / d; t2 = (hi - o) / d
        tmin = np.nanmax(np.minimum(t1, t2), -1); tmax = np.nanmin(np.maximum(t1, t2), -1)
        hit = (tmax >= tmin) & (tmax > 0) & (tmin < best)
        best[hit] = tmin[hit]; ids[hit] = i + 1
    return ids
if __name__ == '__main__':
    ids = id_map(2)
    print('boxes', len(vitrines()), 'coverage', (ids > 0).mean().round(3))
    cv2.imwrite("up/ids.png", (ids * 5).astype(np.uint8))
    ids4 = id_map(4)
    np.save('up/ids4.npy', ids4)
