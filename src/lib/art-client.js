// Lato pagina del worker di disegno. Se il worker non è disponibile
// (browser vecchi, anteprime in sandbox) si ripiega sul thread principale,
// ma solo nei momenti davvero liberi: mai durante lo scroll.

import ArtWorker from './art.worker.js?worker&inline';
import { renderSliceArt, renderPlaceholderArt, renderTegliaArt, drawDough, renderSauce } from './pizza-art.js';

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
    if (typeof OffscreenCanvas === 'undefined' || !OffscreenCanvas.prototype.convertToBlob) throw new Error('no OffscreenCanvas');
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

function call(msg) {
  const w = getWorker();
  if (!w) return Promise.reject(new Error('worker non disponibile'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
  });
}

/* ---------- Riserva sul thread principale, solo a pagina ferma ---------- */
const idleQueue = [];
let idleScheduled = false;
function pumpIdle(deadline) {
  idleScheduled = false;
  // Un disegno costa ~50 ms: parte solo se il browser è davvero inattivo.
  if (deadline && deadline.timeRemaining() < 40 && !deadline.didTimeout) return scheduleIdle();
  const job = idleQueue.shift();
  if (job) job();
  if (idleQueue.length) scheduleIdle();
}
function scheduleIdle() {
  if (idleScheduled) return;
  idleScheduled = true;
  if ('requestIdleCallback' in window) requestIdleCallback(pumpIdle);
  else setTimeout(() => pumpIdle(null), 200);
}

function renderOnMain(key, w, h) {
  return new Promise((resolve) => {
    idleQueue.push(() => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const [kind, name] = key.split(':');
      if (kind === 'slice') renderSliceArt(c, name);
      else if (kind === 'teglia') renderTegliaArt(c);
      else renderPlaceholderArt(c, name);
      c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : c.toDataURL('image/jpeg', 0.9)), 'image/webp', 0.9);
    });
    scheduleIdle();
  });
}

/* ---------- API ---------- */
const artCache = new Map();
const SIZES = { p: [720, 900], l: [1200, 820] };

// URL (blob:) dell'illustrazione `key` ("slice:diavola", "art:forno") in formato
// verticale ("p") o orizzontale ("l"). Ogni combinazione si disegna una volta sola.
export function getArtURL(key, shape = 'p') {
  const id = `${key}|${shape}`;
  if (!artCache.has(id)) {
    const [w, h] = SIZES[shape] || SIZES.p;
    artCache.set(id, call({ type: 'art', key, w, h })
      .then((r) => URL.createObjectURL(r.blob))
      .catch(() => renderOnMain(key, w, h)));
  }
  return artCache.get(id);
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
