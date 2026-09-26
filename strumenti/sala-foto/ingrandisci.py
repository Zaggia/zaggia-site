import sys, time, torch, numpy as np
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(4)
model_path, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
tile = int(sys.argv[4]) if len(sys.argv) > 4 else 256
m = ModelLoader().load_from_file(model_path).eval()
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
x = torch.from_numpy(img).permute(2, 0, 1)[None]
s = m.scale
_, _, H, W = x.shape
pad = 16
res = torch.zeros(1, 3, H * s, W * s)
t0 = time.time()
with torch.no_grad():
    for y0 in range(0, H, tile):
        for x0 in range(0, W, tile):
            y1, x1 = min(y0 + tile, H), min(x0 + tile, W)
            ya, xa = max(y0 - pad, 0), max(x0 - pad, 0)
            yb, xb = min(y1 + pad, H), min(x1 + pad, W)
            o = m(x[:, :, ya:yb, xa:xb])
            res[:, :, y0*s:y1*s, x0*s:x1*s] = o[:, :, (y0-ya)*s:(y0-ya)*s+(y1-y0)*s, (x0-xa)*s:(x0-xa)*s+(x1-x0)*s]
o = (res[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
Image.fromarray(o).save(out)
print(out, o.shape, f'{time.time()-t0:.1f}s', m.architecture.name)
