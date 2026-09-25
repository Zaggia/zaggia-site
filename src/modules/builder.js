// "Componi la tua teglia": scegli gli ingredienti, cadono sulla teglia,
// poi l'ordine parte già scritto su WhatsApp.

import { gsap } from 'gsap';
import { generateItems, drawItem, INGREDIENTS, sortByLayer } from '../lib/pizza-art.js';
import { getBuilderLayers } from '../lib/art-client.js';
import { BUILDER_INGREDIENTS, BUILDER_PRESETS, BUSINESS } from '../content.js';
import { waLink } from './business.js';

const SWATCH = {
  sugo: '#c8361f', mozzarella: '#f6ecd6', basilico: '#3f8a33', patate: '#e9c778', salame: '#8e2419',
  funghi: '#b08962', olive: '#2a1f1c', fiori: '#f0a02c', alici: '#8a6a55', mortadella: '#e9a7a0',
  pistacchio: '#8db446', rosmarino: '#4a6b35',
};

const NAMES = [
  ['salame', 'Infernale'], ['mortadella', 'Bolognese de Roma'], ['fiori', 'Primavera Romana'],
  ['patate', 'Contadina'], ['funghi', 'Boscaiola'], ['alici', 'Marinara'], ['olive', 'Mediterranea'],
  ['pistacchio', 'Verde Bronte'], ['basilico', 'Regina'], ['rosmarino', 'Profumata'], ['mozzarella', 'Filante'], ['sugo', 'Rossa'],
];

function operaName(active) {
  if (!active.size) return 'Bianca, pura';
  const main = NAMES.find(([k]) => active.has(k))?.[1] ?? 'Libera';
  const extra = active.size >= 5 ? ' Esagerata' : '';
  return `La ${main}${extra}`;
}

export function initBuilder(reduced) {
  const canvas = document.querySelector('[data-builder-canvas]');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const chipsEl = document.querySelector('[data-builder-chips]');
  const presetsEl = document.querySelector('[data-builder-presets]');
  const nameEl = document.querySelector('[data-builder-name]');
  const live = document.querySelector('[data-builder-live]');
  const qtyEl = document.querySelector('[data-qty-value]');
  const waBtn = document.querySelector('[data-builder-wa]');
  const copyBtn = document.querySelector('[data-builder-copy]');

  const active = new Set();
  const progress = {}; // tipo -> 0..1
  let qty = 1;
  let W = 0;
  let H = 0;
  let cm = 1;
  let dough = null;
  let sauce = null;
  let items = {};
  let bakes = {};
  const dir = {};
  let dirty = true;
  let layoutId = 0;

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(Math.min(canvas.clientWidth * dpr, 1400));
    if (!w || w === W) return;
    W = w;
    H = Math.round((W * 2) / 3);
    cm = W / 60;
    const rect = { x: 0, y: 0, w: W, h: H };
    items = {};
    bakes = {};
    dough = null;
    for (const type of BUILDER_INGREDIENTS) {
      if (!INGREDIENTS[type].spread) items[type] = generateItems(type, rect, cm, 23);
    }
    // Impasto e pomodoro arrivano dal worker: il thread principale resta libero.
    const id = ++layoutId;
    getBuilderLayers(W, H).then((l) => {
      if (id !== layoutId) return;
      canvas.width = W;
      canvas.height = H;
      dough = l.dough;
      canvas.closest('.builder__tray')?.classList.add('is-live');
      sauce = l.sauce;
      dirty = true;
    });
  }

  // Un livello per ingrediente: i pezzi atterrati ci vengono disegnati una
  // volta sola (con l'ombra sfocata); a ogni frame si copia il livello intero.
  function bakeFor(type) {
    let b = bakes[type];
    if (!b) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      b = bakes[type] = { canvas: c, ctx: c.getContext('2d'), settled: new Uint8Array(items[type].length) };
    }
    return b;
  }

  function draw() {
    if (!dirty || !dough) return;
    dirty = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(dough, 0, 0);
    for (const type of sortByLayer(Object.keys(progress).filter((k) => k in INGREDIENTS))) {
      const p = progress[type];
      if (p <= 0) continue;
      if (type === 'sugo') {
        // Il pomodoro si stende a spirale dal centro, come col mestolo.
        ctx.save();
        ctx.beginPath();
        const R = Math.hypot(W, H) * 0.55 * p;
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const rr = R * (1 + Math.sin(a * 5 + p * 6) * 0.06);
          const x = W / 2 + Math.cos(a) * rr * 1.15;
          const y = H / 2 + Math.sin(a) * rr * 0.8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.clip();
        ctx.drawImage(sauce, 0, 0);
        ctx.restore();
        continue;
      }
      const list = items[type] || [];
      const n = list.length;
      const b = bakeFor(type);
      const settling = dir[type] === 1;
      let loose = false;
      for (let i = 0; i < n; i++) {
        const t = (p - (i / n) * 0.55) / 0.45;
        if (settling && t >= 1) {
          if (!b.settled[i]) {
            drawItem(b.ctx, list[i]);
            b.settled[i] = 1;
          }
        } else if (t > 0) loose = true;
      }
      ctx.drawImage(b.canvas, 0, 0);
      if (!loose) continue;
      // Pezzi non ancora "cotti": in volo mentre cadono, oppure (in uscita)
      // ancora appoggiati finché non tocca a loro ripartire.
      for (let i = 0; i < n; i++) {
        if (b.settled[i]) continue;
        const t = Math.min(1, (p - (i / n) * 0.55) / 0.45);
        if (t <= 0) continue;
        const eased = 1 - Math.pow(1 - t, 3);
        drawItem(ctx, list[i], { lift: 1 - eased, alpha: Math.min(1, t * 2.5), shadow: 'cheap' });
      }
    }
  }
  gsap.ticker.add(draw);

  function animateTo(type, on) {
    if (progress[type] === undefined) progress[type] = 0;
    dir[type] = on ? 1 : -1;
    // In uscita i pezzi tornano "in volo": svuota il livello cotto.
    if (!on && bakes[type]) {
      bakes[type].ctx.clearRect(0, 0, W, H);
      bakes[type].settled.fill(0);
    }
    gsap.to(progress, {
      [type]: on ? 1 : 0,
      duration: reduced ? 0.01 : on ? 1.1 : 0.45,
      ease: on ? 'none' : 'power2.in',
      onUpdate: () => (dirty = true),
    });
  }

  function message() {
    const list = [...active].map((k) => INGREDIENTS[k].label.toLowerCase());
    const ingr = list.length ? list.join(', ') : 'solo olio e sale (bianca)';
    const trays = qty === 1 ? '1 teglia' : `${qty} teglie`;
    return `Ciao ${BUSINESS.name}! Vorrei ordinare ${trays} "${operaName(active)}" con: ${ingr}. È possibile? Grazie!`;
  }

  function refresh() {
    nameEl.textContent = operaName(active);
    chipsEl.querySelectorAll('[data-ingredient]').forEach((b) => b.setAttribute('aria-pressed', String(active.has(b.dataset.ingredient))));
    qtyEl.textContent = qty;
    waBtn.href = waLink(message());
  }

  function toggle(type, force) {
    const on = force ?? !active.has(type);
    if (on === active.has(type)) return;
    if (on) active.add(type);
    else active.delete(type);
    animateTo(type, on);
    live.textContent = `${on ? 'Aggiunto' : 'Tolto'}: ${INGREDIENTS[type].label}`;
    refresh();
  }

  for (const type of BUILDER_INGREDIENTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.ingredient = type;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="chip__swatch" style="background:${SWATCH[type]}"></span>${INGREDIENTS[type].label}`;
    b.addEventListener('click', () => toggle(type));
    chipsEl.append(b);
  }
  for (const [name, list] of Object.entries(BUILDER_PRESETS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = name;
    b.addEventListener('click', () => applyPreset(list, { reveal: true }));
    presetsEl.append(b);
  }

  function applyPreset(list, { reveal = false } = {}) {
    for (const t of [...active]) if (!list.includes(t)) toggle(t, false);
    list.forEach((t, i) => gsap.delayedCall(reduced ? 0 : 0.15 + i * 0.28, () => toggle(t, true)));
    // Su mobile la teglia sta sopra ai bottoni: se è fuori schermo la riportiamo in vista.
    if (reveal && canvas.getBoundingClientRect().bottom < 80) {
      if (window.__lenis) window.__lenis.scrollTo(canvas, { offset: -100, duration: 0.8 });
      else canvas.scrollIntoView({ block: 'center' });
    }
  }

  document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
    qty = Math.min(20, Math.max(1, qty + Number(b.dataset.qty)));
    refresh();
  }));
  document.querySelector('[data-builder-reset]')?.addEventListener('click', () => {
    for (const t of [...active]) toggle(t, false);
    live.textContent = 'Teglia svuotata';
  });
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message());
      copyBtn.lastChild.textContent = 'Copiato!';
      live.textContent = 'Ordine copiato negli appunti';
    } catch {
      copyBtn.lastChild.textContent = 'Copia non riuscita';
    }
    setTimeout(() => (copyBtn.lastChild.textContent = 'Copia ordine'), 2000);
  });

  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  layout();
  refresh();

  // Quando entra in vista la prima volta, parte da sola una margherita.
  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (started || !entries.some((e) => e.isIntersecting)) return;
    started = true;
    io.disconnect();
    if (!active.size) applyPreset(BUILDER_PRESETS.Margherita);
  }, { threshold: 0.4 });
  io.observe(canvas);

  return { applyPreset };
}
