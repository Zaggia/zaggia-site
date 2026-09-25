// "Tira il filo": trascina metà supplì, la mozzarella si allunga, si assottiglia
// e prima o poi si spezza. Il record resta salvato nel browser.

import { gsap } from 'gsap';

const REST_X = 250;
const MAX_X = 560;
const CM_PER_PX = 60 / (MAX_X - REST_X);
const STRANDS = [
  { dy: -30, w: 5 }, { dy: -14, w: 7 }, { dy: 0, w: 9 }, { dy: 12, w: 6 }, { dy: 26, w: 5 }, { dy: 36, w: 3 },
];

function readRecord() {
  try {
    return Number(localStorage.getItem('pizzaart-filo')) || 0;
  } catch {
    return 0;
  }
}
function saveRecord(v) {
  try {
    localStorage.setItem('pizzaart-filo', String(v));
  } catch {
    /* navigazione privata: pazienza */
  }
}

export function initSupli(reduced) {
  const root = document.querySelector('[data-supli]');
  if (!root) return;
  const svg = root.querySelector('[data-supli-svg]');
  const right = root.querySelector('[data-supli-right]');
  const stringsG = root.querySelector('[data-supli-strings]');
  const handle = root.querySelector('[data-supli-handle]');
  const cmEl = root.querySelector('[data-supli-cm]');
  const recEl = root.querySelector('[data-supli-record]');
  const snapEl = root.querySelector('[data-supli-snap]');
  const NS = 'http://www.w3.org/2000/svg';

  const paths = STRANDS.map(() => {
    const p = document.createElementNS(NS, 'path');
    stringsG.append(p);
    return p;
  });

  const pos = { x: REST_X, y: 170, rot: 0 };
  const target = { x: REST_X, y: 170 };
  let dragging = false;
  let broken = false;
  let snapAt = 48 + Math.random() * 10;
  let record = readRecord();
  recEl.textContent = record;
  let velX = 0;
  let velY = 0;

  function draw() {
    right.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${pos.rot})`);
    const dist = Math.max(0, pos.x - REST_X);
    const cm = Math.round(dist * CM_PER_PX);
    cmEl.textContent = cm;
    handle.setAttribute('aria-valuenow', String(cm));
    handle.setAttribute('aria-valuetext', `${cm} centimetri`);
    const k = Math.min(1, dist / (MAX_X - REST_X));
    STRANDS.forEach((s, i) => {
      const p = paths[i];
      if (broken) {
        p.setAttribute('d', '');
        return;
      }
      const x1 = 236;
      const y1 = 170 + s.dy;
      const x2 = pos.x - 6;
      const y2 = pos.y + s.dy * (1 - k * 0.5);
      const midX = (x1 + x2) / 2;
      const sag = 8 + k * 40 + Math.abs(s.dy) * 0.3;
      p.setAttribute('d', `M${x1} ${y1} C${midX - dist * 0.15} ${y1 + sag}, ${midX + dist * 0.15} ${y2 + sag}, ${x2} ${y2}`);
      p.setAttribute('stroke-width', String(Math.max(0.6, s.w * Math.pow(1 - k, 0.8))));
      p.setAttribute('opacity', String(0.95 - k * 0.3));
    });
    placeHandle();
  }

  function placeHandle() {
    const r = svg.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const sx = r.width / 600;
    handle.style.left = `${r.left - rr.left + (pos.x + 55) * sx}px`;
    handle.style.top = `${r.top - rr.top + pos.y * sx}px`;
  }

  function toSvg(ev) {
    const r = svg.getBoundingClientRect();
    const s = 600 / r.width;
    return { x: (ev.clientX - r.left) * s - 55, y: (ev.clientY - r.top) * s };
  }

  function snap(cm) {
    broken = true;
    if (cm > record) {
      record = cm;
      recEl.textContent = record;
      saveRecord(record);
    }
    snapEl.textContent = cm >= record ? `Crack! ${cm} cm, record!` : `Crack! ${cm} cm`;
    gsap.fromTo(snapEl, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(3)' });
    gsap.to(snapEl, { opacity: 0, delay: 1.4, duration: 0.4 });
    release();
    setTimeout(() => {
      broken = false;
      snapAt = 48 + Math.random() * 10;
      draw();
    }, 1100);
  }

  function release() {
    dragging = false;
    root.classList.remove('is-dragging');
    gsap.to(pos, {
      x: REST_X, y: 170, rot: 0,
      duration: reduced ? 0.01 : 1.2,
      ease: 'elastic.out(1, 0.35)',
      onUpdate: draw,
    });
    target.x = REST_X;
    target.y = 170;
  }

  function follow() {
    if (!dragging) return;
    // Molla: la metà insegue il dito con un po' di ritardo e ruota con la velocità.
    velX = (velX + (target.x - pos.x) * 0.22) * 0.62;
    velY = (velY + (target.y - pos.y) * 0.22) * 0.62;
    pos.x += velX;
    pos.y += velY;
    pos.rot = Math.max(-18, Math.min(18, velY * 1.4 + velX * 0.3));
    draw();
    const cm = Math.round(Math.max(0, pos.x - REST_X) * CM_PER_PX);
    if (cm >= snapAt) snap(cm);
    else requestAnimationFrame(follow);
  }

  handle.addEventListener('pointerdown', (e) => {
    if (broken) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    gsap.killTweensOf(pos);
    dragging = true;
    root.classList.add('is-dragging', 'is-pulled');
    const p = toSvg(e);
    target.x = Math.min(MAX_X + 40, Math.max(REST_X, p.x));
    target.y = Math.min(250, Math.max(90, p.y));
    requestAnimationFrame(follow);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toSvg(e);
    target.x = Math.min(MAX_X + 40, Math.max(REST_X, p.x));
    target.y = Math.min(250, Math.max(90, p.y));
  });
  const end = () => dragging && release();
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  handle.addEventListener('keydown', (e) => {
    if (broken) return;
    const step = 5 / CM_PER_PX;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      root.classList.add('is-pulled');
      gsap.killTweensOf(pos);
      pos.x = Math.min(MAX_X, pos.x + step);
      draw();
      const cm = Math.round((pos.x - REST_X) * CM_PER_PX);
      if (cm >= snapAt) snap(cm);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      pos.x = Math.max(REST_X, pos.x - step);
      draw();
    } else if (e.key === 'Home' || e.key === 'Escape') {
      release();
    }
  });

  window.addEventListener('resize', placeHandle);
  draw();

  // Invito a giocare: un piccolo strattone finché nessuno lo tocca.
  if (!reduced) {
    const hint = gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 1 });
    hint.to(pos, { x: REST_X + 60, duration: 0.5, ease: 'power2.out', onUpdate: draw })
      .to(pos, { x: REST_X, duration: 0.9, ease: 'elastic.out(1, 0.4)', onUpdate: draw });
    const stop = () => hint.kill();
    handle.addEventListener('pointerdown', stop, { once: true });
    handle.addEventListener('keydown', stop, { once: true });
  }
}
