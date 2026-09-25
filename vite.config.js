import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { OPERE, FRITTI, RING, HOURS } from './src/content.js';

// Contenuti e immagini scritti direttamente nell'HTML al momento della build:
// il sito è completo anche dove JavaScript è bloccato (anteprime delle app,
// visualizzatori sul telefono). Le animazioni si aggiungono sopra, se possono.

const FOTO_DIR = 'src/assets/foto';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function photoFiles() {
  const map = {};
  if (!existsSync(FOTO_DIR)) return map;
  for (const f of readdirSync(FOTO_DIR)) {
    if (!/\.(jpe?g|png|webp|avif)$/i.test(f)) continue;
    map[f.replace(/\.[^.]+$/, '').toLowerCase()] = f;
  }
  return map;
}

// Foto vera se c'è in src/assets/foto, altrimenti l'illustrazione generata.
function mediaSrc(photos, photo, fallback) {
  if (photos[photo]) return `/src/assets/foto/${photos[photo]}`;
  return `/src/assets/art/${String(fallback).split(':').pop()}.webp`;
}

function img(src, alt, cls = 'media-img') {
  const a11y = alt ? `alt="${esc(alt)}"` : 'alt="" aria-hidden="true"';
  return `<img class="${cls}" src="${src}" ${a11y} loading="lazy" decoding="async" draggable="false">`;
}

const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function staticContent() {
  return {
    name: 'pizza-art-static-content',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const photos = photoFiles();

        // <figure data-media data-photo=".." data-fallback=".." data-alt=".."> → con <img> dentro
        html = html.replace(/<figure([^>]*\sdata-media\b[^>]*)>/g, (tag, attrs) => {
          const get = (n) => (attrs.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1] || '';
          return `${tag}${img(mediaSrc(photos, get('data-photo'), get('data-fallback')), get('data-alt'))}`;
        });

        const opere = OPERE.map((o, i) => `
            <li class="opera">
              <button class="opera__btn" type="button" data-cursor="Guarda" aria-label="${esc(o.title)}: apri i dettagli">
                <div class="opera__frame">${img(mediaSrc(photos, o.photo, o.recipe), `${o.title}: ${o.notes}`)}<span class="opera__glare"></span></div>
                <p class="opera__label"><small>Opera n° ${String(i + 1).padStart(2, '0')}</small><strong>${esc(o.title)}</strong><span>${esc(o.notes)}</span></p>
              </button>
            </li>`).join('') + `
            <li class="opera opera--cta">
              <a class="opera__btn" href="#componi" data-cursor="Crea"><div class="opera__frame"><span class="opera__cta"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>La prossima opera<br>la firmi tu</span></div><p class="opera__label"><small>Fuori catalogo</small><strong>Componi la tua</strong><span>Scegli gli ingredienti nel laboratorio.</span></p></a>
            </li>`;
        html = html.replace(/(<ul class="gallery__track"[^>]*>)(<\/ul>)/, `$1${opere}\n          $2`);

        const fritti = FRITTI.map((f) => `<li data-reveal><strong>${esc(f.name)}</strong><span>${esc(f.note)}</span></li>`).join('');
        html = html.replace(/(<ul class="fry__list"[^>]*>)(<\/ul>)/, `$1${fritti}$2`);

        const ring = RING.map((r) => `<div class="ring3d__item">${img(mediaSrc(photos, r.photo, r.fallback), r.alt)}</div>`).join('');
        html = html.replace(/(<div class="ring3d__spin"[^>]*>)(<\/div>)/, `$1${ring}$2`);

        const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
          const h = HOURS[d]?.length ? HOURS[d].map(([a, b]) => `${a} – ${b}`).join(' · ') : 'Chiuso';
          return `<tr><th scope="row">${DAYS[d]}</th><td>${h}</td></tr>`;
        }).join('');
        html = html.replace(/(<tbody data-hours-body>)(<\/tbody>)/, `$1${rows}$2`);

        html = html.replace('<!-- @hero-poster -->', img('/src/assets/art/teglia.webp', '', 'hero__poster'));
        html = html.replace('<!-- @builder-poster -->', img('/src/assets/art/teglia.webp', '', 'builder__poster'));
        return html;
      },
    },
  };
}

// base relativa: il sito funziona su qualsiasi hosting statico,
// anche in una sottocartella (GitHub Pages, Netlify, Aruba, ecc.).
export default defineConfig({
  base: './',
  plugins: [staticContent()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
