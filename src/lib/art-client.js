// Lato pagina del worker di disegno: texture della teglia 3D e livelli del
// configuratore si preparano fuori dal thread principale. Se il worker non è
// disponibile (browser vecchi, anteprime in sandbox) si ripiega qui.
// Le illustrazioni del sito invece sono già immagini nell'HTML (src/assets/art).

import ArtWorker from './art.worker.js?worker&inline';
import { drawDough, renderSauce } from './pizza-art.js';

let worker = null;
let seq = 0;
const pending = new Map();

function failAll(err) {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function getWorker() {
  if (worker !== null) return worker;
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no OffscreenCanvas');
    worker = new ArtWorker();
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    worker.onerror = (e) => {
      e.preventDefault?.();
      worker = false;
      failAll(new Error('worker non disponibile'));
    };
  } catch {
    worker = false;
  }
  return worker;
}

function call(msg, timeoutMs = 8000) {
  const w = getWorker();
  if (!w) return Promise.reject(new Error('worker non disponibile'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
    // Un worker che non risponde (visualizzatori limitati) non deve bloccare nulla.
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error('worker lento'));
    }, timeoutMs);
  });
}

// Texture della teglia 3D come ImageBitmap già capovolte (null se il worker non c'è).
export function getHeroTextures(tw, th) {
  return call({ type: 'hero', tw, th }).catch(() => null);
}

// Impasto e pomodoro del configuratore (ImageBitmap o canvas, sempre utilizzabili con drawImage).
export function getBuilderLayers(w, h) {
  return call({ type: 'builder', w, h }).catch(() => {
    const rect = { x: 0, y: 0, w, h };
    const dough = document.createElement('canvas');
    dough.width = w;
    dough.height = h;
    drawDough(dough.getContext('2d'), rect, w / 60, 21);
    return { dough, sauce: renderSauce(rect, w / 60, 22, 1.6) };
  });
}
