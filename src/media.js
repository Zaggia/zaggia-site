// Foto: se in src/assets/foto c'è il file giusto (es. "supli.webp") lo usa,
// altrimenti disegna al volo un'immagine procedurale coerente con lo stile.

import { renderSliceArt, renderPlaceholderArt } from './lib/pizza-art.js';

const files = import.meta.glob('./assets/foto/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const PHOTOS = {};
for (const [path, url] of Object.entries(files)) {
  const name = path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
  PHOTOS[name] = url;
}

const queue = [];
let scheduled = false;

function pump() {
  scheduled = false;
  const job = queue.shift();
  if (!job) return;
  job();
  if (queue.length) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // Un disegno per volta, nei momenti liberi: niente scatti durante lo scroll.
  if ('requestIdleCallback' in window) requestIdleCallback(pump, { timeout: 400 });
  else setTimeout(pump, 30);
}

function paintFallback(canvas) {
  const box = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(Math.min(Math.max(box.width, 320) * dpr, 1400));
  const ratio = box.width && box.height ? box.height / box.width : 1.25;
  canvas.width = w;
  canvas.height = Math.round(w * Math.min(Math.max(ratio, 0.4), 2));
  const [kind, key] = canvas.dataset.fallback.split(':');
  if (kind === 'slice') renderSliceArt(canvas, key);
  else renderPlaceholderArt(canvas, key);
  canvas.classList.add('is-painted');
}

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        queue.push(() => paintFallback(e.target));
        schedule();
      }
    }, { rootMargin: '800px 0px 800px 0px' })
  : null;

export function createMedia({ photo, fallback, alt = '', eager = false }) {
  const url = PHOTOS[photo];
  if (url) {
    const img = new Image();
    img.src = url;
    img.alt = alt;
    img.decoding = 'async';
    img.loading = eager ? 'eager' : 'lazy';
    img.draggable = false;
    return img;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'media-fallback';
  canvas.dataset.fallback = fallback || 'slice:margherita';
  if (alt) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', alt);
  } else {
    canvas.setAttribute('aria-hidden', 'true');
  }
  return canvas;
}

// Da chiamare dopo che l'elemento è nel DOM (serve la misura del contenitore).
export function observeMedia(node) {
  if (!(node instanceof HTMLCanvasElement) || node.classList.contains('is-painted')) return;
  if (io) io.observe(node);
  else paintFallback(node);
}

export function hydrateMedia(root = document) {
  root.querySelectorAll('[data-media]').forEach((el) => {
    if (el.dataset.hydrated) return;
    el.dataset.hydrated = '1';
    const node = createMedia({ photo: el.dataset.photo, fallback: el.dataset.fallback, alt: el.dataset.alt || '' });
    el.prepend(node);
    observeMedia(node);
  });
}
