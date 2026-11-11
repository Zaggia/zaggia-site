import sys, time, torch, numpy as np, cv2
sys.path.insert(0, 'midas')
from midas.model_loader import load_model
torch.set_num_threads(4)
dev = torch.device('cpu')
model, transform, net_w, net_h = load_model(dev, 'models/dpt_beit_large_512.pt', 'dpt_beit_large_512', optimize=False, height=None, square=False)
img = cv2.cvtColor(cv2.imread('up/swinir.png'), cv2.COLOR_BGR2RGB) / 255.0
t0 = time.time()
sample = transform({'image': img})['image']
print('input', sample.shape)
with torch.no_grad():
    pred = model(torch.from_numpy(sample).unsqueeze(0))
    pred = torch.nn.functional.interpolate(pred.unsqueeze(1), size=(337, 600), mode='bicubic', align_corners=False).squeeze().numpy()
np.save('up/disp.npy', pred)
print('done', time.time() - t0, pred.min(), pred.max())
v = (pred - pred.min()) / (pred.max() - pred.min())
cv2.imwrite('up/disp.png', cv2.resize((v * 255).astype(np.uint8), (1200, 674)))
