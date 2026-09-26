import torch, numpy as np, cv2
torch.set_num_threads(4)
m = torch.jit.load('models/big-lama.pt', map_location='cpu').eval()
img = cv2.cvtColor(cv2.imread('up/clean.png'), cv2.COLOR_BGR2RGB)
x0, y0 = 1198 - 256, 632 - 256
crop = img[y0:y0 + 512, x0:x0 + 512].copy()
mask = np.zeros((512, 512), np.uint8)
cv2.ellipse(mask, (256, 258), (40, 20), 0, 0, 360, 1, -1)
x = torch.from_numpy(crop).permute(2, 0, 1)[None].float() / 255
mk = torch.from_numpy(mask.astype(np.float32))[None, None]
with torch.no_grad():
    out = m(x, mk)
o = (out[0].permute(1, 2, 0).numpy().clip(0, 1) * 255).astype(np.uint8)
a = np.clip(cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 4)[..., None] * 1.6, 0, 1)
crop2 = (crop * (1 - a) + o * a).astype(np.uint8)
img[y0:y0 + 512, x0:x0 + 512] = crop2
cv2.imwrite('up/clean2.png', cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
cv2.imwrite('up/sconce-cmp.jpg', cv2.cvtColor(cv2.resize(np.hstack([crop, crop2]), (1024, 512)), cv2.COLOR_RGB2BGR))
print('ok')
