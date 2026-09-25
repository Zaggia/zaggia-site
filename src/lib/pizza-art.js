// Generatore procedurale di pizza al taglio su <canvas>.
// Serve a tre cose: la texture del modello 3D nell'hero, il configuratore
// "Componi la tua teglia" e le immagini di riserva quando una foto manca.
// Le misure sono in centimetri reali: `cm` = pixel per centimetro.

import { mulberry32, createNoise2D, fbm, hashString } from './noise.js';

export const INGREDIENTS = {
  sugo: { label: 'Pomodoro', layer: 1, spread: true },
  mozzarella: { label: 'Fior di latte', layer: 2 },
  patate: { label: 'Patate', layer: 3 },
  funghi: { label: 'Funghi', layer: 3 },
  salame: { label: 'Salame piccante', layer: 4 },
  mortadella: { label: 'Mortadella', layer: 4 },
  fiori: { label: 'Fiori di zucca', layer: 4 },
  alici: { label: 'Alici', layer: 5 },
  olive: { label: 'Olive', layer: 5 },
  burrata: { label: 'Burrata', layer: 6 },
  basilico: { label: 'Basilico', layer: 7 },
  rosmarino: { label: 'Rosmarino', layer: 7 },
  pistacchio: { label: 'Granella di pistacchio', layer: 8 },
  origano: { label: 'Origano', layer: 8 },
  sale: { label: 'Sale grosso', layer: 8 },
  olio: { label: "Olio a crudo", layer: 9, spread: true },
};

export const RECIPES = {
  margherita: ['sugo', 'mozzarella', 'basilico', 'olio'],
  rossa: ['sugo', 'origano', 'olio'],
  bianca: ['olio', 'rosmarino', 'sale'],
  patate: ['mozzarella', 'patate', 'rosmarino', 'olio'],
  diavola: ['sugo', 'mozzarella', 'salame', 'olio'],
  fiori: ['mozzarella', 'fiori', 'alici', 'olio'],
  mortadella: ['mortadella', 'burrata', 'pistacchio', 'olio'],
  funghi: ['sugo', 'mozzarella', 'funghi', 'basilico', 'olio'],
};

export function sortByLayer(list) {
  return [...list].sort((a, b) => INGREDIENTS[a].layer - INGREDIENTS[b].layer);
}

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// Forma irregolare chiusa e morbida (mozzarella, burrata, macchie):
// curve quadratiche che passano per i punti medi, quindi senza spigoli.
function blobPath(ctx, x, y, r, rand, wobble = 0.22, points = 14) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    const rr = r * (1 + (rand() * 2 - 1) * wobble);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[points - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < points; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % points]);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Impasto                                                              */
/* ------------------------------------------------------------------ */

export function drawDough(ctx, rect, cm, seed = 1, { rim = true, sides = [1, 1, 1, 1] } = {}) {
  const rand = mulberry32(seed);
  const noise = createNoise2D(rand);
  const { x, y, w, h } = rect;

  // Campo di colore a bassa risoluzione, poi scalato: veloce anche a 2K.
  const k = 0.25;
  const lw = Math.max(8, Math.ceil(w * k));
  const lh = Math.max(8, Math.ceil(h * k));
  const low = makeCanvas(lw, lh);
  const lctx = low.getContext('2d');
  const img = lctx.createImageData(lw, lh);
  const light = [236, 190, 112];
  const toast = [204, 138, 62];
  const deep = [140, 74, 30];
  const rimW = 1.7 * cm;
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++) {
      const px = i / k;
      const py = j / k;
      const n = fbm(noise, px / (6 * cm), py / (6 * cm), 4);
      const n2 = noise(px / (1.2 * cm), py / (1.2 * cm));
      let c = mix(light, toast, clamp01(0.45 + n * 0.9));
      if (rim) {
        const dl = sides[3] ? px : 1e9;
        const dr = sides[1] ? w - px : 1e9;
        const dt = sides[0] ? py : 1e9;
        const db = sides[2] ? h - py : 1e9;
        const d = Math.min(dl, dr, dt, db);
        const edge = 1 - smooth(0, rimW * (1 + n * 0.35), d);
        c = mix(c, toast, edge * 0.7);
        c = mix(c, deep, Math.pow(1 - smooth(0, rimW * 0.45, d), 2) * 0.75);
      }
      c = mix(c, deep, clamp01(n2 - 0.55) * 0.9);
      const o = (j * lw + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, x, y, w, h);

  // Alveoli: bolle chiare con bordo tostato.
  const bubbles = Math.round((w * h) / (cm * cm) * 0.09);
  for (let i = 0; i < bubbles; i++) {
    const bx = x + rand() * w;
    const by = y + rand() * h;
    const br = (0.25 + rand() * rand() * 1.1) * cm;
    const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
    g.addColorStop(0, 'rgba(250,215,150,0.55)');
    g.addColorStop(0.7, 'rgba(214,150,70,0.18)');
    g.addColorStop(1, 'rgba(120,60,20,0.35)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * (0.7 + rand() * 0.3), rand() * TAU, 0, TAU);
    ctx.fill();
  }

  // Leopardatura: puntini bruciacchiati, più fitti sul bordo.
  const spots = Math.round((w * h) / (cm * cm) * 0.12);
  for (let i = 0; i < spots; i++) {
    let sx = x + rand() * w;
    let sy = y + rand() * h;
    if (rim && rand() < 0.55) {
      const side = Math.floor(rand() * 4);
      if (!sides[side]) continue;
      const depth = rand() * rimW * 0.9;
      if (side === 0) sy = y + depth;
      if (side === 1) sx = x + w - depth;
      if (side === 2) sy = y + h - depth;
      if (side === 3) sx = x + depth;
    }
    const sr = (0.05 + rand() * rand() * 0.35) * cm;
    ctx.fillStyle = `rgba(${60 + rand() * 40},${28 + rand() * 20},${10},${0.35 + rand() * 0.45})`;
    blobPath(ctx, sx, sy, sr, rand, 0.4, 7);
    ctx.fill();
  }

  // Farina residua sul bordo.
  ctx.fillStyle = 'rgba(255,245,225,0.08)';
  for (let i = 0; i < spots * 0.6; i++) {
    ctx.fillRect(x + rand() * w, y + rand() * h, 0.08 * cm, 0.08 * cm);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Strati "stesi": pomodoro e olio                                     */
/* ------------------------------------------------------------------ */

export function renderSauce(rect, cm, seed = 2, inset = 1.6) {
  const { w, h } = rect;
  const rand = mulberry32(seed);
  const noise = createNoise2D(rand);
  const k = 0.35;
  const lw = Math.ceil(w * k);
  const lh = Math.ceil(h * k);
  const low = makeCanvas(lw, lh);
  const lctx = low.getContext('2d');
  const img = lctx.createImageData(lw, lh);
  const deep = [150, 28, 16];
  const bright = [214, 64, 36];
  const cooked = [168, 60, 24];
  const insetPx = inset * cm;
  for (let j = 0; j < lh; j++) {
    for (let i = 0; i < lw; i++) {
      const px = i / k;
      const py = j / k;
      const d = Math.min(px, py, w - px, h - py);
      const n = fbm(noise, px / (3 * cm), py / (3 * cm), 4);
      const edgeN = noise(px / (2.2 * cm), py / (2.2 * cm)) * 0.7 * cm;
      const a = insetPx > 0 ? smooth(insetPx - 0.2 * cm, insetPx + 0.5 * cm, d + edgeN) : 1;
      const holes = smooth(0.52, 0.62, noise(px / (0.9 * cm) + 40, py / (0.9 * cm)));
      let c = mix(deep, bright, clamp01(0.5 + n));
      c = mix(c, cooked, clamp01(1 - a) * 0.9);
      const o = (j * lw + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255 * a * (1 - holes * 0.55) * 0.97;
    }
  }
  lctx.putImageData(img, 0, 0);
  const out = makeCanvas(Math.ceil(w), Math.ceil(h));
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(low, 0, 0, w, h);
  // Grumi di pomodoro e semi.
  octx.globalCompositeOperation = 'source-atop';
  const lumps = Math.round((w * h) / (cm * cm) * 0.06);
  for (let i = 0; i < lumps; i++) {
    const lx = rand() * w;
    const ly = rand() * h;
    const lr = (0.2 + rand() * 0.5) * cm;
    octx.fillStyle = rand() < 0.5 ? 'rgba(120,16,10,0.35)' : 'rgba(236,98,58,0.28)';
    blobPath(octx, lx, ly, lr, rand, 0.35, 8);
    octx.fill();
  }
  return out;
}

export function drawOil(ctx, rect, cm, seed = 9, amount = 1) {
  const rand = mulberry32(seed);
  const { x, y, w, h } = rect;
  ctx.save();
  // Pozze dorate traslucide.
  const pools = Math.round((w * h) / (cm * cm) * 0.02 * amount);
  for (let i = 0; i < pools; i++) {
    const px = x + rand() * w;
    const py = y + rand() * h;
    ctx.fillStyle = 'rgba(214,168,40,0.16)';
    blobPath(ctx, px, py, (0.4 + rand() * 1.2) * cm, rand, 0.35, 9);
    ctx.fill();
  }
  // Riflessi speculari.
  ctx.globalCompositeOperation = 'lighter';
  const glints = Math.round((w * h) / (cm * cm) * 0.025 * amount);
  for (let i = 0; i < glints; i++) {
    const gx = x + rand() * w;
    const gy = y + rand() * h;
    const gr = (0.08 + rand() * 0.3) * cm;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 2);
    g.addColorStop(0, 'rgba(255,248,225,0.32)');
    g.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr * 2.2, gr, -0.6 + rand() * 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Condimenti a pezzi                                                   */
/* ------------------------------------------------------------------ */

const SPACING = {
  mozzarella: 5.4, patate: 3.6, funghi: 4.4, salame: 4.6, mortadella: 6.5,
  fiori: 8.5, alici: 7, olive: 4.2, burrata: 9, basilico: 6.5,
  rosmarino: 3.2, pistacchio: 2.1, origano: 1.1, sale: 1.6,
};

export function generateItems(type, rect, cm, seed, inset = 2.2) {
  const rand = mulberry32(seed ^ hashString(type));
  const items = [];
  const sp = SPACING[type] * cm;
  const ix = rect.x + inset * cm;
  const iy = rect.y + inset * cm;
  const iw = rect.w - inset * 2 * cm;
  const ih = rect.h - inset * 2 * cm;
  const cols = Math.max(1, Math.round(iw / sp));
  const rows = Math.max(1, Math.round(ih / sp));
  const cw = iw / cols;
  const ch = ih / rows;
  const skip = { burrata: 0.15, basilico: 0.2, fiori: 0.1, alici: 0.25, pistacchio: 0.1, origano: 0, sale: 0.3 }[type] ?? 0.05;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < skip) continue;
      items.push({
        type,
        x: ix + (c + 0.15 + rand() * 0.7) * cw,
        y: iy + (r + 0.15 + rand() * 0.7) * ch,
        rot: rand() * TAU,
        s: 0.8 + rand() * 0.4,
        seed: Math.floor(rand() * 1e9),
        cm,
      });
    }
  }
  return items;
}

function leafPath(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len * 0.2, -wid, len * 0.25, -wid * 0.9, len / 2, 0);
  ctx.bezierCurveTo(len * 0.25, wid * 0.9, -len * 0.2, wid, -len / 2, 0);
  ctx.closePath();
}

const DRAW = {
  mozzarella(ctx, it, rand) {
    const r = 2.2 * it.cm * it.s;
    ctx.fillStyle = 'rgba(246,234,208,0.5)';
    blobPath(ctx, 0, 0, r * 1.18, rand, 0.3, 11);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(0.65, '#f7ecd4');
    g.addColorStop(1, '#ecd6a8');
    ctx.fillStyle = g;
    blobPath(ctx, 0, 0, r, rand, 0.26, 11);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = rand() * TAU;
      const d = r * (0.35 + rand() * 0.5);
      const br = r * (0.12 + rand() * 0.18);
      const bg = ctx.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, br);
      bg.addColorStop(0, `rgba(206,140,60,${0.35 + rand() * 0.3})`);
      bg.addColorStop(1, 'rgba(206,140,60,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, br, 0, TAU);
      ctx.fill();
    }
  },
  burrata(ctx, it, rand) {
    const r = 2.8 * it.cm * it.s;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#f7f1e4');
    g.addColorStop(1, '#e9dfc9');
    ctx.fillStyle = g;
    blobPath(ctx, 0, 0, r, rand, 0.32, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.28, r * 0.12, -0.5, 0, TAU);
    ctx.fill();
  },
  basilico(ctx, it, rand) {
    const len = 4.2 * it.cm * it.s;
    const wid = len * 0.34;
    const g = ctx.createLinearGradient(0, -wid, 0, wid);
    g.addColorStop(0, '#5aa343');
    g.addColorStop(1, '#2b6a26');
    ctx.fillStyle = g;
    leafPath(ctx, len, wid);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(190,230,150,0.55)';
    ctx.lineWidth = len * 0.025;
    ctx.beginPath();
    ctx.moveTo(-len * 0.48, 0);
    ctx.quadraticCurveTo(0, -wid * 0.1, len * 0.45, 0);
    ctx.stroke();
    ctx.lineWidth = len * 0.012;
    for (let i = 1; i < 5; i++) {
      const vx = -len * 0.4 + (i / 5) * len * 0.8;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + len * 0.12, -wid * 0.6);
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + len * 0.12, wid * 0.6);
      ctx.stroke();
    }
    if (rand() < 0.6) {
      ctx.fillStyle = 'rgba(40,30,10,0.25)';
      leafPath(ctx, len * 0.35, wid * 0.4);
      ctx.fill();
    }
  },
  patate(ctx, it, rand) {
    const r = 2.1 * it.cm * it.s;
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#f6e4b0');
    g.addColorStop(0.75, '#e9c778');
    g.addColorStop(1, '#b8732e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * (0.82 + rand() * 0.15), 0, 0, TAU);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(150,84,30,${0.2 + rand() * 0.3})`;
      const a = rand() * TAU;
      blobPath(ctx, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.7, r * (0.08 + rand() * 0.15), rand, 0.4, 6);
      ctx.fill();
    }
  },
  funghi(ctx, it) {
    const s = 1.7 * it.cm * it.s;
    ctx.fillStyle = '#d7b58c';
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.bezierCurveTo(-s, -s * 1.3, s, -s * 1.3, s, 0);
    ctx.lineTo(s * 0.3, 0);
    ctx.lineTo(s * 0.35, s * 1.1);
    ctx.lineTo(-s * 0.35, s * 1.1);
    ctx.lineTo(-s * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#7b5433';
    ctx.lineWidth = s * 0.12;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,50,0.35)';
    ctx.lineWidth = s * 0.04;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.22, -s * 0.05);
      ctx.lineTo(i * s * 0.18, -s * 0.75);
      ctx.stroke();
    }
  },
  salame(ctx, it, rand) {
    const r = 2 * it.cm * it.s;
    ctx.fillStyle = 'rgba(226,90,34,0.3)';
    blobPath(ctx, 0, 0, r * 1.25, rand, 0.2, 10);
    ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#b8382a');
    g.addColorStop(0.8, '#8e2419');
    g.addColorStop(1, '#4e120c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 22; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r * 0.85;
      ctx.fillStyle = rand() < 0.75 ? 'rgba(246,214,190,0.75)' : 'rgba(30,8,4,0.6)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.03 + rand() * 0.05), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,6,2,0.8)';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0.4, 2.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,160,0.35)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 3.6, 5.2);
    ctx.stroke();
  },
  mortadella(ctx, it, rand) {
    const r = 3.1 * it.cm * it.s;
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#f3c2b8');
    g.addColorStop(1, '#d88e86');
    ctx.fillStyle = g;
    blobPath(ctx, 0, 0, r, rand, 0.3, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(150,70,70,0.35)';
    ctx.lineWidth = r * 0.04;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const a = rand() * TAU;
      ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * (0.3 + rand() * 0.4), a, a + 1.4);
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU;
      const d = rand() * r * 0.75;
      ctx.fillStyle = 'rgba(255,244,236,0.85)';
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, r * 0.08, r * 0.08);
    }
  },
  fiori(ctx, it, rand) {
    const len = 7.5 * it.cm * it.s;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i - 2) * 0.16);
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      g.addColorStop(0, '#7e9a3a');
      g.addColorStop(0.2, '#f0a02c');
      g.addColorStop(1, '#f7c64a');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.9;
      leafPath(ctx, len, len * 0.13);
      ctx.fill();
      ctx.restore();
      ctx.shadowColor = 'transparent';
    }
    ctx.strokeStyle = 'rgba(200,110,20,0.6)';
    ctx.lineWidth = len * 0.012;
    ctx.beginPath();
    ctx.moveTo(-len * 0.35, 0);
    ctx.lineTo(len * 0.45, (rand() - 0.5) * len * 0.1);
    ctx.stroke();
  },
  alici(ctx, it, rand) {
    const len = 6 * it.cm * it.s;
    const wid = 0.45 * it.cm * it.s;
    const g = ctx.createLinearGradient(0, -wid, 0, wid);
    g.addColorStop(0, '#6b4a3a');
    g.addColorStop(0.5, '#b89c86');
    g.addColorStop(1, '#5a3c2e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid * 2.2 - rand() * wid, len / 2, 0);
    ctx.quadraticCurveTo(0, wid * 0.2, -len / 2, 0);
    ctx.fill();
  },
  olive(ctx, it) {
    const r = 0.75 * it.cm * it.s;
    ctx.fillStyle = '#2a1f1c';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.arc(0, 0, r * 0.42, 0, TAU, true);
    ctx.fill('evenodd');
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = r * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 3.6, 4.8);
    ctx.stroke();
  },
  rosmarino(ctx, it, rand) {
    const n = 5 + Math.floor(rand() * 5);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = rand() < 0.5 ? '#3f5c2f' : '#557a3b';
      ctx.lineWidth = 0.17 * it.cm;
      const a = rand() * TAU;
      const l = (0.8 + rand() * 0.6) * it.cm;
      const ox = (rand() - 0.5) * 1.5 * it.cm;
      const oy = (rand() - 0.5) * 1.5 * it.cm;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * l, oy + Math.sin(a) * l);
      ctx.stroke();
    }
  },
  pistacchio(ctx, it, rand) {
    const n = 4 + Math.floor(rand() * 5);
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = ['#8db446', '#6f9a36', '#b7c963', '#a28a52'][Math.floor(rand() * 4)];
      blobPath(ctx, (rand() - 0.5) * it.cm, (rand() - 0.5) * it.cm, (0.1 + rand() * 0.16) * it.cm, rand, 0.45, 5);
      ctx.fill();
    }
  },
  origano(ctx, it, rand) {
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(70,80,30,0.85)' : 'rgba(110,100,40,0.8)';
      ctx.fillRect((rand() - 0.5) * it.cm, (rand() - 0.5) * it.cm, 0.1 * it.cm, 0.07 * it.cm);
    }
  },
  sale(ctx, it, rand) {
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 3; i++) {
      const s = (0.08 + rand() * 0.12) * it.cm;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect((rand() - 0.5) * it.cm, (rand() - 0.5) * it.cm, s, s);
    }
  },
};

// Disegna un singolo pezzo. `lift` (0 = appoggiato, 1 = in volo) allarga
// l'ombra e ingrandisce il pezzo: lo usa l'animazione di "caduta".
// shadow: true = ombra sfocata (bella, costosa), 'cheap' = ellisse piena
// (per i pezzi in movimento, ridisegnati a ogni frame).
export function drawItem(ctx, it, { lift = 0, alpha = 1, shadow = true } = {}) {
  const rand = mulberry32(it.seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow === 'cheap') {
    const r = it.cm * 1.7 * it.s * (1 + lift * 0.6);
    ctx.fillStyle = `rgba(20,8,2,${(0.22 * (1 - lift * 0.6)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(it.x, it.y + it.cm * (0.2 + lift * 1.2), r, r * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.translate(it.x, it.y - lift * it.cm * 2);
  ctx.rotate(it.rot);
  const sc = 1 + lift * 0.9;
  ctx.scale(sc, sc);
  if (shadow === true) {
    ctx.shadowColor = `rgba(20,8,2,${0.35 - lift * 0.15})`;
    ctx.shadowBlur = it.cm * (0.35 + lift * 1.6);
    ctx.shadowOffsetY = it.cm * (0.12 + lift * 2.4);
  }
  DRAW[it.type](ctx, it, rand);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Composizioni complete                                                */
/* ------------------------------------------------------------------ */

export function renderPizza(ctx, rect, cm, recipe, seed = 7, opts = {}) {
  drawDough(ctx, rect, cm, seed, opts);
  for (const type of sortByLayer(recipe)) {
    if (type === 'sugo') {
      const sauce = renderSauce(rect, cm, seed + 1, opts.sauceInset ?? 1.6);
      ctx.drawImage(sauce, rect.x, rect.y);
    } else if (type === 'olio') {
      drawOil(ctx, rect, cm, seed + 3, recipe.length <= 3 ? 1.8 : 1);
    } else {
      for (const it of generateItems(type, rect, cm, seed, opts.itemInset ?? 2.2)) drawItem(ctx, it);
    }
  }
}

// Mappa di rilievo in scala di grigi per il modello 3D (bordo alto, alveoli, condimenti).
export function renderHeight(ctx, rect, cm, recipe, seed = 7) {
  const rand = mulberry32(seed + 99);
  const { x, y, w, h } = rect;
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(x, y, w, h);
  const rimW = 1.9 * cm;
  const g = (x0, y0, x1, y1) => {
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, '#cfcfcf');
    lg.addColorStop(1, 'rgba(106,106,106,0)');
    return lg;
  };
  ctx.fillStyle = g(x, 0, x + rimW, 0);
  ctx.fillRect(x, y, rimW, h);
  ctx.fillStyle = g(x + w, 0, x + w - rimW, 0);
  ctx.fillRect(x + w - rimW, y, rimW, h);
  ctx.fillStyle = g(0, y, 0, y + rimW);
  ctx.fillRect(x, y, w, rimW);
  ctx.fillStyle = g(0, y + h, 0, y + h - rimW);
  ctx.fillRect(x, y + h - rimW, w, rimW);
  const bubbles = Math.round((w * h) / (cm * cm) * 0.08);
  for (let i = 0; i < bubbles; i++) {
    const bx = x + rand() * w;
    const by = y + rand() * h;
    const br = (0.3 + rand() * rand() * 1.2) * cm;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    rg.addColorStop(0, 'rgba(210,210,210,0.7)');
    rg.addColorStop(1, 'rgba(210,210,210,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
  }
  for (const type of recipe) {
    if (INGREDIENTS[type].spread) continue;
    for (const it of generateItems(type, rect, cm, seed)) {
      const r = (type === 'mozzarella' ? 2 : type === 'burrata' ? 2.8 : 1.4) * cm * it.s;
      const rg = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, r);
      rg.addColorStop(0, 'rgba(235,235,235,0.8)');
      rg.addColorStop(1, 'rgba(235,235,235,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(it.x, it.y, r, 0, TAU);
      ctx.fill();
    }
  }
}

// Fianco del trancio: mollica dorata con alveoli (usato dal 3D).
export function renderCrumb(w, h, seed = 5) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#c9873e');
  g.addColorStop(0.18, '#f0d6a0');
  g.addColorStop(0.8, '#ecd09a');
  g.addColorStop(1, '#8a4a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 60; i++) {
    const r = 1 + rand() * rand() * h * 0.12;
    ctx.fillStyle = `rgba(150,96,44,${0.25 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, h * 0.2 + rand() * h * 0.62, r * 1.4, r, 0, 0, TAU);
    ctx.fill();
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Immagini di riserva                                                  */
/* ------------------------------------------------------------------ */

function slateBackground(ctx, w, h, seed) {
  const rand = mulberry32(seed);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#221c18');
  bg.addColorStop(1, '#0e0b09');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 40; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

function warmLight(ctx, w, h) {
  const l = ctx.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 1.1);
  l.addColorStop(0, 'rgba(255,190,120,0.18)');
  l.addColorStop(0.5, 'rgba(255,150,80,0.05)');
  l.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, w, h);
}

// Trancio singolo visto dall'alto, su ardesia: "opera" per la galleria.
export function renderSliceArt(canvas, recipeKey, seed = hashString(recipeKey)) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  slateBackground(ctx, W, H, seed);
  const cm = W / 20;
  const sw = 13 * cm;
  const sh = 11.5 * cm;
  ctx.save();
  ctx.translate(W / 2, H / 2 + cm);
  ctx.rotate(-0.07);
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = cm * 2.2;
  ctx.shadowOffsetY = cm * 1.4;
  ctx.fillStyle = '#7a4318';
  ctx.fillRect(-sw / 2, -sh / 2 + cm * 0.9, sw, sh);
  ctx.shadowColor = 'transparent';
  const crumb = renderCrumb(Math.ceil(sw), Math.ceil(cm * 1.4), seed);
  ctx.drawImage(crumb, -sw / 2, sh / 2 - cm * 0.4);
  ctx.beginPath();
  ctx.rect(-sw / 2, -sh / 2, sw, sh);
  ctx.clip();
  // Il trancio è una finestra su una teglia più grande: i condimenti sono tagliati netti.
  const big = { x: -sw / 2 - 2 * cm, y: -sh / 2, w: sw + 4 * cm, h: sh + 6 * cm };
  renderPizza(ctx, big, cm, RECIPES[recipeKey] ?? RECIPES.margherita, seed, { sides: [1, 0, 0, 0], sauceInset: 1.6 });
  ctx.restore();
  warmLight(ctx, W, H);
}

// Teglia intera vista dall'alto su sfondo trasparente: hero senza WebGL.
export function renderTegliaArt(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const pw = W * 0.86;
  const ph = (pw * 2) / 3;
  const x = (W - pw) / 2;
  const y = (H - ph) / 2;
  const edge = pw * 0.012;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = pw * 0.05;
  ctx.shadowOffsetY = pw * 0.03;
  ctx.fillStyle = '#161618';
  ctx.fillRect(x - edge, y - edge, pw + edge * 2, ph + edge * 2);
  ctx.restore();
  renderPizza(ctx, { x, y, w: pw, h: ph }, pw / 60, RECIPES.margherita, 11);
}

// Riserva per le foto che non sono pizze: composizioni astratte a tema.
export function renderPlaceholderArt(canvas, key) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const seed = hashString(key);
  const rand = mulberry32(seed);
  if (key === 'impasto') {
    drawDough(ctx, { x: 0, y: 0, w: W, h: H }, W / 40, seed, { rim: false });
    ctx.fillStyle = 'rgba(255,248,235,0.18)';
    for (let i = 0; i < 900; i++) ctx.fillRect(rand() * W, rand() * H, 2, 2);
    warmLight(ctx, W, H);
    return;
  }
  if (key === 'feste') {
    slateBackground(ctx, W, H, seed);
    const keys = ['margherita', 'patate', 'diavola', 'fiori', 'mortadella', 'bianca'];
    const cm = W / 90;
    keys.forEach((k, i) => {
      const cx = (i % 3) * W / 3 + W / 6;
      const cy = Math.floor(i / 3) * H / 2 + H / 4;
      const w = 26 * cm;
      const h = 17 * cm;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rand() - 0.5) * 0.12);
      ctx.fillStyle = '#141414';
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = cm * 3;
      ctx.fillRect(-w / 2 - cm, -h / 2 - cm, w + 2 * cm, h + 2 * cm);
      ctx.shadowColor = 'transparent';
      renderPizza(ctx, { x: -w / 2, y: -h / 2, w, h }, cm, RECIPES[k], hashString(k));
      ctx.restore();
    });
    warmLight(ctx, W, H);
    return;
  }
  if (key === 'forno' || key === 'consegna') {
    const warm = key === 'forno';
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, warm ? '#1a0d06' : '#101427');
    bg.addColorStop(1, warm ? '#050302' : '#0b0908');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.55, H * 0.6, 0, W * 0.55, H * 0.6, W * 0.6);
    glow.addColorStop(0, warm ? 'rgba(255,140,40,0.85)' : 'rgba(255,170,90,0.35)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const r = (0.01 + rand() * 0.05) * W;
      const bx = rand() * W;
      const by = rand() * H * (warm ? 1 : 0.7);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, `rgba(255,${160 + rand() * 60},${80 + rand() * 60},${0.2 + rand() * 0.3})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    return;
  }
  // Fritti e supplì: sfere impanate dorate.
  slateBackground(ctx, W, H, seed);
  const n = key === 'supli' ? 2 : 7;
  for (let i = 0; i < n; i++) {
    const r = key === 'supli' ? W * 0.2 : W * (0.09 + rand() * 0.06);
    const cx = key === 'supli' ? W * (0.3 + i * 0.4) : W * (0.2 + rand() * 0.6);
    const cy = key === 'supli' ? H * 0.52 : H * (0.25 + rand() * 0.55);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rand() * TAU);
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = r * 0.4;
    ctx.shadowOffsetY = r * 0.2;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#f2b75a');
    g.addColorStop(0.7, '#c77a2a');
    g.addColorStop(1, '#6e3a12');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (key === 'supli' ? 1 : 1.4), r, 0, 0, TAU);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    for (let k = 0; k < 160; k++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,220,150,0.5)' : 'rgba(110,50,10,0.45)';
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r * 0.95;
      ctx.fillRect(Math.cos(a) * d * (key === 'supli' ? 1 : 1.4), Math.sin(a) * d, r * 0.04, r * 0.04);
    }
    if (key === 'supli') {
      ctx.fillStyle = '#c9451f';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fbf2dc';
      blobPath(ctx, 0, 0, r * 0.32, rand, 0.25, 9);
      ctx.fill();
    }
    ctx.restore();
  }
  if (key === 'supli') {
    ctx.strokeStyle = 'rgba(251,242,220,0.9)';
    ctx.lineCap = 'round';
    for (let s = 0; s < 4; s++) {
      ctx.lineWidth = W * (0.012 - s * 0.002);
      ctx.beginPath();
      ctx.moveTo(W * 0.36, H * (0.5 + s * 0.01));
      ctx.bezierCurveTo(W * 0.45, H * (0.58 + s * 0.02), W * 0.55, H * (0.58 + s * 0.02), W * 0.64, H * (0.5 + s * 0.01));
      ctx.stroke();
    }
  }
  warmLight(ctx, W, H);
}
