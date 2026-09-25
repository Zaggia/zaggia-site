// Foto: se in src/assets/foto c'è il file giusto (es. "supli.webp") lo usa,
// altrimenti chiede al worker un'illustrazione coerente con lo stile.
// In entrambi i casi l'elemento è una normale <img>: leggera da scorrere.

import { getArtURL } from './lib/art-client.js';

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

// Le illustrazioni si chiedono al worker solo quando lo slot si avvicina alla
// vista: niente raffica di disegni all'avvio che ruba CPU a scroll e 3D.
const pendingArt = new WeakMap();
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        pendingArt.get(e.target)?.();
        pendingArt.delete(e.target);
      }
    }, { rootMargin: '150% 60% 150% 60%' })
  : null;

// shape: "p" verticale, "l" orizzontale (solo per le illustrazioni).
export function createMedia({ photo, fallback, alt = '', eager = false, shape = 'p' }) {
  const img = new Image();
  img.alt = alt;
  img.decoding = 'async';
  img.draggable = false;
  img.className = 'media-img';
  if (!alt) img.setAttribute('aria-hidden', 'true');
  const ready = () => img.classList.add('is-ready');
  img.addEventListener('load', ready, { once: true });
  const url = PHOTOS[photo];
  if (url) {
    img.loading = eager ? 'eager' : 'lazy';
    img.src = url;
  } else {
    const load = () => getArtURL(fallback || 'slice:margherita', shape).then((u) => (img.src = u));
    if (eager || !io) load();
    else {
      pendingArt.set(img, load);
      // L'osservazione parte quando l'immagine è nel documento.
      requestAnimationFrame(() => (img.isConnected ? io.observe(img) : load()));
    }
  }
  return img;
}

// Dopo l'intro: prepara in sottofondo, una alla volta, le illustrazioni non
// ancora richieste (in ordine di pagina), così nessuna cornice resta vuota.
export function prefetchArt() {
  const queue = [...document.querySelectorAll('img.media-img')].filter((im) => pendingArt.has(im));
  const next = () => {
    const img = queue.shift();
    if (!img) return;
    const load = pendingArt.get(img);
    if (!load) return next();
    pendingArt.delete(img);
    io?.unobserve(img);
    load().then(next, next);
  };
  next();
}

export function hydrateMedia(root = document) {
  root.querySelectorAll('[data-media]').forEach((el) => {
    if (el.dataset.hydrated) return;
    el.dataset.hydrated = '1';
    const shape = el.dataset.shape || (el.clientHeight > el.clientWidth ? 'p' : 'l');
    el.prepend(createMedia({ photo: el.dataset.photo, fallback: el.dataset.fallback, alt: el.dataset.alt || '', shape }));
  });
}
