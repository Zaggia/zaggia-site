// Worker: disegna illustrazioni e texture 3D fuori dal thread principale,
// così lo scroll e le animazioni non si bloccano mai mentre si generano.

import { renderSliceArt, renderPlaceholderArt, renderTegliaArt, renderPizza, renderHeight, renderCrumb, drawDough, renderSauce, RECIPES } from './pizza-art.js';

// WebGL con ImageBitmap ignora flipY: capovolgiamo qui, una volta sola.
function flippedBitmap(src) {
  const c = new OffscreenCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.translate(0, src.height);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0);
  return c.transferToImageBitmap();
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'art') {
      const { key, w, h } = e.data;
      const c = new OffscreenCanvas(w, h);
      const [kind, name] = key.split(':');
      if (kind === 'slice') renderSliceArt(c, name);
      else if (kind === 'teglia') renderTegliaArt(c);
      else renderPlaceholderArt(c, name);
      const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
      self.postMessage({ id, blob });
    } else if (type === 'hero') {
      const { tw, th } = e.data;
      const cm = tw / 60;
      const color = new OffscreenCanvas(tw, th);
      renderPizza(color.getContext('2d'), { x: 0, y: 0, w: tw, h: th }, cm, RECIPES.margherita, 11);
      const height = new OffscreenCanvas(tw / 2, th / 2);
      renderHeight(height.getContext('2d'), { x: 0, y: 0, w: tw / 2, h: th / 2 }, cm / 2, RECIPES.margherita, 11);
      const bitmaps = [flippedBitmap(color), flippedBitmap(height), flippedBitmap(renderCrumb(512, 96, 3))];
      self.postMessage({ id, color: bitmaps[0], height: bitmaps[1], crumb: bitmaps[2] }, bitmaps);
    } else if (type === 'builder') {
      const { w, h } = e.data;
      const rect = { x: 0, y: 0, w, h };
      const cm = w / 60;
      const dough = new OffscreenCanvas(w, h);
      drawDough(dough.getContext('2d'), rect, cm, 21);
      const sauceC = renderSauce(rect, cm, 22, 1.6);
      const bitmaps = [dough.transferToImageBitmap(), sauceC.transferToImageBitmap()];
      self.postMessage({ id, dough: bitmaps[0], sauce: bitmaps[1] }, bitmaps);
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
