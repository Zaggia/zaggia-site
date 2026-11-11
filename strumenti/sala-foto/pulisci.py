import torch, numpy as np, cv2, time
torch.set_num_threads(4)
m = torch.jit.load('models/big-lama.pt', map_location='cpu').eval()
img = cv2.cvtColor(cv2.imread('up/swinir.png'), cv2.COLOR_BGR2RGB)
ids4 = np.load('up/ids4.npy')
mask4 = cv2.dilate((ids4 > 0).astype(np.uint8), np.ones((13, 13), np.uint8))   # ~3 px sorgente di margine
S = 2
H, W = img.shape[0] // S, img.shape[1] // S
small = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
msmall = (cv2.resize(mask4, (W, H), interpolation=cv2.INTER_AREA) > 0).astype(np.float32)
ph, pw = (8 - H % 8) % 8, (8 - W % 8) % 8
x = torch.from_numpy(np.pad(small, ((0, ph), (0, pw), (0, 0)), mode='reflect')).permute(2, 0, 1)[None].float() / 255
mk = torch.from_numpy(np.pad(msmall, ((0, ph), (0, pw)), mode='reflect'))[None, None]
t0 = time.time()
with torch.no_grad():
    out = m(x, mk)
print('lama', time.time() - t0, out.shape, out.min().item(), out.max().item())
o = out[0].permute(1, 2, 0).numpy()[:H, :W]
if o.max() > 2: o = o / 255.0
fill = cv2.resize((np.clip(o, 0, 1) * 255).astype(np.uint8), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
alpha = cv2.GaussianBlur(mask4.astype(np.float32), (0, 0), 2.0)[..., None]
clean = (img * (1 - alpha) + fill * alpha).astype(np.uint8)
cv2.imwrite('up/clean.png', cv2.cvtColor(clean, cv2.COLOR_RGB2BGR))
cv2.imwrite('up/clean-small.jpg', cv2.resize(cv2.cvtColor(clean, cv2.COLOR_RGB2BGR), (1200, 674)))
cv2.imwrite('up/mask4.png', mask4 * 255)
