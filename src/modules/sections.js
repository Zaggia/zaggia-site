// Sezioni guidate dallo scroll: impasto 72h, galleria 3D, friggitoria,
// consegna, feste, anello fotografico, mappa.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { OPERE, FRITTI, BUSINESS } from '../content.js';
import { waLink } from './business.js';

const mm = gsap.matchMedia();

/* ═════════════ Impasto 72h ═════════════ */
export function initDough(reduced) {
  const sec = document.querySelector('[data-dough]');
  if (!sec) return;
  const hoursEl = sec.querySelector('[data-dough-hours]');
  const bar = sec.querySelector('[data-dough-bar]');
  const steps = [...sec.querySelectorAll('[data-dough-steps] li')];
  const bubblesC = sec.querySelector('[data-dough-bubbles]');
  const media = sec.querySelector('.dough__media');
  const bctx = bubblesC.getContext('2d');
  const bubbles = Array.from({ length: 46 }, () => ({
    x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 1, born: Math.random() * 0.9, sp: 0.2 + Math.random() * 0.8,
  }));
  let prog = 0;
  let bw = 0;
  let bh = 0;

  // Una bolla disegnata una volta, poi solo copiata e scalata: niente gradienti per frame.
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  {
    const c = sprite.getContext('2d');
    const g = c.createRadialGradient(22, 22, 3, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,248,230,0.55)');
    g.addColorStop(0.8, 'rgba(255,230,190,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0.4)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(32, 32, 31, 0, Math.PI * 2);
    c.fill();
  }
  const sizeBubbles = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    bw = bubblesC.width = Math.round(bubblesC.clientWidth * dpr);
    bh = bubblesC.height = Math.round(bubblesC.clientHeight * dpr);
  };
  new ResizeObserver(sizeBubbles).observe(bubblesC);
  sizeBubbles();

  function paintBubbles(t) {
    bctx.clearRect(0, 0, bw, bh);
    const unit = Math.min(bw, bh) * 0.04;
    for (const b of bubbles) {
      const life = (prog - b.born) / 0.35;
      if (life <= 0) continue;
      const r = Math.min(1, life) * b.r * unit;
      const x = b.x * bw + Math.sin(t * b.sp + b.x * 10) * 4;
      const y = b.y * bh - life * 10;
      bctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    }
  }

  function update(p) {
    prog = p;
    const hrs = Math.round(p * 72);
    hoursEl.textContent = String(hrs).padStart(2, '0');
    bar.style.transform = `scaleX(${p})`;
    steps.forEach((li, i) => li.classList.toggle('is-on', p >= i / 3 - 0.02));
  }

  if (reduced) {
    update(1);
    paintBubbles(0);
    return;
  }

  let visible = false;
  gsap.ticker.add((t) => visible && paintBubbles(t));

  mm.add('(min-width: 900px)', () => {
    const st = ScrollTrigger.create({
      trigger: sec.querySelector('[data-dough-pin]'),
      start: 'top top',
      end: '+=160%',
      pin: true,
      scrub: 0.4,
      onUpdate: (s) => update(s.progress),
      onToggle: (s) => (visible = s.isActive),
    });
    const zoom = gsap.fromTo(media, { scale: 1.12, rotate: -2 }, { scale: 1, rotate: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: '+=160%', scrub: true } });
    return () => { st.kill(); zoom.kill(); };
  });
  mm.add('(max-width: 899px)', () => {
    const st = ScrollTrigger.create({
      trigger: sec,
      start: 'top 70%',
      end: 'bottom 60%',
      scrub: 0.4,
      onUpdate: (s) => update(s.progress),
      onToggle: (s) => (visible = s.isActive),
    });
    return () => st.kill();
  });
}

/* ═════════════ Galleria delle opere ═════════════ */
export function initGallery(reduced, builder) {
  const sec = document.querySelector('[data-gallery]');
  if (!sec) return;
  const track = sec.querySelector('[data-gallery-track]');
  const idxEl = sec.querySelector('[data-gallery-index]');
  sec.querySelector('[data-gallery-total]').textContent = String(OPERE.length).padStart(2, '0');

  // Le carte sono già nell'HTML (scritte in build da content.js):
  // qui si aggiungono solo interazioni e 3D.
  track.querySelectorAll('.opera:not(.opera--cta)').forEach((li, i) => {
    const o = OPERE[i];
    if (!o) return;
    const frame = li.querySelector('.opera__frame');
    const btn = li.querySelector('.opera__btn');
    const pic = frame.querySelector('img');
    btn.addEventListener('click', () => openLightbox(o, builder, pic?.currentSrc || pic?.src));
    if (matchMedia('(hover: hover)').matches) {
      let r = null;
      btn.addEventListener('pointerenter', () => (r = frame.getBoundingClientRect()));
      btn.addEventListener('pointermove', (e) => {
        if (!r) r = frame.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        frame.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
        frame.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
        frame.style.setProperty('--gx', `${px * 100}%`);
        frame.style.setProperty('--gy', `${py * 100}%`);
      });
      btn.addEventListener('pointerleave', () => {
        frame.style.setProperty('--ry', '0deg');
        frame.style.setProperty('--rx', '0deg');
      });
    }
  });

  const cards = [...track.children];
  // Posizioni misurate una volta (e a ogni resize), mai durante lo scroll:
  // leggere offsetLeft dopo aver scritto transform forza un layout per carta.
  let centers = [];
  let vw = window.innerWidth;
  const measure = () => {
    vw = window.innerWidth;
    centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
  };
  let lastIdx = -1;
  function update3D() {
    const x = gsap.getProperty(track, 'x');
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const d = (centers[i] + x - vw / 2) / vw;
      const ad = Math.abs(d);
      const ry = Math.max(-50, Math.min(50, -d * 55));
      const z = -Math.min(1, ad) * 260;
      cards[i].style.transform = `translate3d(0, ${(ad * 30).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
      if (ad < bestD && i < OPERE.length) {
        bestD = ad;
        best = i;
      }
    }
    if (best !== lastIdx) {
      lastIdx = best;
      idxEl.textContent = String(best + 1).padStart(2, '0');
    }
  }
  measure();

  if (reduced) {
    const vp = sec.querySelector('[data-gallery-viewport]');
    vp.style.overflowX = 'auto';
    vp.style.scrollSnapType = 'x mandatory';
    cards.forEach((c) => (c.style.scrollSnapAlign = 'center'));
    return;
  }

  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    // onUpdate del tween (non del trigger): gira a ogni tick dello scrub,
    // così le carte ruotano in sincrono con lo scorrimento.
    onUpdate: update3D,
    scrollTrigger: {
      trigger: sec.querySelector('[data-gallery-pin]'),
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: true,
      scrub: 0.5,
      invalidateOnRefresh: true,
      onRefresh: () => {
        measure();
        update3D();
      },
    },
  });
  update3D();
}

function openLightbox(o, builder, src) {
  const prevFocus = document.activeElement;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', o.title);
  box.innerHTML = `
    <div class="lightbox__card">
      <button class="lightbox__close" type="button" aria-label="Chiudi">×</button>
      <div class="lightbox__media"></div>
      <div class="lightbox__text">
        <p class="eyebrow">Al taglio · a peso</p>
        <h3>${o.title}</h3>
        <p>${o.notes}</p>
        <div class="hero__cta">
          <a class="btn btn--red" href="${BUSINESS.phoneHref}"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>Ordina al telefono</a>
          <button class="btn btn--ghost" type="button" data-lb-build>Componila tu</button>
        </div>
      </div>
    </div>`;
  const pic = new Image();
  pic.alt = o.title;
  if (src) pic.src = src;
  box.querySelector('.lightbox__media').append(pic);
  document.body.append(box);
  window.__lenis?.stop();
  requestAnimationFrame(() => box.classList.add('is-open'));
  const close = () => {
    box.classList.remove('is-open');
    window.__lenis?.start();
    document.removeEventListener('keydown', onKey);
    setTimeout(() => box.remove(), 350);
    prevFocus?.focus?.({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('button, a')];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  box.addEventListener('click', (e) => e.target === box && close());
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.querySelector('[data-lb-build]').addEventListener('click', () => {
    close();
    const preset = { margherita: ['sugo', 'mozzarella', 'basilico'], bianca: ['rosmarino'], patate: ['mozzarella', 'patate', 'rosmarino'], diavola: ['sugo', 'mozzarella', 'salame'], fiori: ['mozzarella', 'fiori', 'alici'], mortadella: ['mozzarella', 'mortadella', 'pistacchio'] }[o.recipe];
    const target = document.querySelector('#componi');
    if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.6, onComplete: () => preset && builder?.applyPreset(preset) });
    else {
      target.scrollIntoView();
      if (preset) builder?.applyPreset(preset);
    }
  });
  box.querySelector('.lightbox__close').focus();
}

/* ═════════════ Friggitoria ═════════════ */
export function initFry() {
  const list = document.querySelector('[data-fry-list]');
  if (!list || list.children.length) return; // già scritta in build
  for (const f of FRITTI) {
    const li = document.createElement('li');
    li.setAttribute('data-reveal', '');
    li.innerHTML = `<strong>${f.name}</strong><span>${f.note}</span>`;
    list.append(li);
  }
}

/* ═════════════ Consegna ═════════════ */
export function initDelivery(reduced) {
  const svg = document.querySelector('[data-delivery-svg]');
  if (!svg) return;
  const route = svg.querySelector('[data-route]');
  const scooter = svg.querySelector('[data-scooter]');
  const NS = 'http://www.w3.org/2000/svg';
  const done = document.createElementNS(NS, 'path');
  done.setAttribute('d', route.getAttribute('d'));
  done.setAttribute('fill', 'none');
  done.setAttribute('stroke', '#f2b544');
  done.setAttribute('stroke-width', '4');
  done.setAttribute('stroke-linecap', 'round');
  route.after(done);
  const len = route.getTotalLength();
  done.style.strokeDasharray = `${len}`;
  done.style.strokeDashoffset = `${len}`;

  const place = (p) => {
    const pt = route.getPointAtLength(p * len);
    const ahead = route.getPointAtLength(Math.min(len, p * len + 2));
    const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
    const flip = Math.cos((ang * Math.PI) / 180) < 0;
    scooter.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${flip ? ang + 180 : ang}) scale(${flip ? -1 : 1} 1)`);
    done.style.strokeDashoffset = `${len * (1 - p)}`;
  };
  if (reduced) {
    place(0.35);
    return;
  }
  place(0);
  ScrollTrigger.create({
    trigger: '[data-delivery]',
    start: 'top 75%',
    end: 'bottom 35%',
    scrub: 0.6,
    onUpdate: (s) => place(s.progress * 0.999),
  });
}

/* ═════════════ Feste ═════════════ */
export function initParty(reduced) {
  const calc = document.querySelector('[data-calc]');
  if (!calc) return;
  const range = calc.querySelector('[data-calc-range]');
  const out = calc.querySelector('[data-calc-guests]');
  const traysEl = calc.querySelector('[data-calc-trays]');
  const word = calc.querySelector('[data-calc-word]');
  const stack = calc.querySelector('[data-calc-stack]');
  const wa = calc.querySelector('[data-calc-wa]');
  const modes = calc.querySelectorAll('[data-calc-mode]');
  let mode = 'aperitivo';
  let shown = 0;

  function update() {
    const g = Number(range.value);
    const perTray = mode === 'aperitivo' ? 8 : 4;
    const n = Math.max(1, Math.ceil(g / perTray));
    out.textContent = g;
    traysEl.textContent = n;
    word.textContent = n === 1 ? 'teglia' : 'teglie';
    range.style.setProperty('--p', `${((g - range.min) / (range.max - range.min)) * 100}%`);
    wa.href = waLink(`Ciao ${BUSINESS.name}! Organizzo ${mode === 'aperitivo' ? 'un aperitivo' : 'una cena'} per ${g} persone: pensavo a circa ${n} ${n === 1 ? 'teglia' : 'teglie'}. Mi consigliate voi gusti e tempi?`);
    const visible = Math.min(n, 9);
    while (shown < visible) {
      const t = document.createElement('div');
      t.className = 'calc__tray';
      t.style.top = `${60 - shown * 7}px`;
      t.style.zIndex = String(shown);
      stack.append(t);
      if (!reduced) gsap.from(t, { y: -40, opacity: 0, duration: 0.45, ease: 'back.out(2)' });
      shown++;
    }
    while (shown > visible) {
      stack.lastElementChild?.remove();
      shown--;
    }
  }
  range.addEventListener('input', update);
  modes.forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.calcMode;
    modes.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    update();
  }));
  calc.querySelector('.segmented').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const arr = [...modes];
    const i = arr.findIndex((x) => x.getAttribute('aria-checked') === 'true');
    const next = arr[(i + (e.key === 'ArrowRight' ? 1 : arr.length - 1)) % arr.length];
    next.click();
    next.focus();
  });
  update();

  const media = document.querySelector('[data-party-media]');
  if (media && !reduced) {
    gsap.fromTo(media, { clipPath: 'inset(18% 22% 18% 22% round 22px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 22px)',
      ease: 'none',
      scrollTrigger: { trigger: media, start: 'top 90%', end: 'center 55%', scrub: 0.6 },
    });
  }
}

/* ═════════════ Anello fotografico 3D ═════════════ */
export function initRing(reduced) {
  const sec = document.querySelector('[data-ring]');
  if (!sec) return;
  const spin = sec.querySelector('[data-ring-spin]');
  const stage = sec.querySelector('[data-ring-stage]');
  // Le foto sono già nell'HTML: qui si dispongono in cerchio.
  const items = [...spin.querySelectorAll('.ring3d__item')].map((el, i) => ({ el, i }));
  const N = items.length || 1;
  spin.classList.add('is-3d');

  let radius = 0;
  function layout() {
    const w = spin.offsetWidth;
    radius = Math.round((w / 2 / Math.tan(Math.PI / N)) * 1.08);
    items.forEach(({ el, i }) => {
      el.style.transform = `rotateY(${(360 / N) * i}deg) translateZ(${radius}px)`;
    });
  }
  layout();
  window.addEventListener('resize', layout);

  const rot = { scroll: 0, drag: 0, vel: 0 };
  const apply = () => {
    spin.style.transform = `translateZ(${-radius}px) rotateX(-6deg) rotateY(${rot.scroll + rot.drag}deg)`;
  };
  apply();

  if (!reduced) {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.8,
      onUpdate: (s) => {
        rot.scroll = (s.progress - 0.5) * -240;
        apply();
      },
    });
  }

  let down = false;
  let lastX = 0;
  stage.addEventListener('pointerdown', (e) => {
    down = true;
    lastX = e.clientX;
    rot.vel = 0;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rot.drag += dx * 0.3;
    rot.vel = dx * 0.3;
    apply();
  });
  const up = () => (down = false);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  gsap.ticker.add(() => {
    if (down || Math.abs(rot.vel) < 0.01) return;
    rot.vel *= 0.94;
    rot.drag += rot.vel;
    apply();
  });
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', 'Galleria fotografica circolare: usa le frecce per girarla');
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') rot.drag -= 360 / N;
    else if (e.key === 'ArrowRight') rot.drag += 360 / N;
    else return;
    e.preventDefault();
    apply();
  });
}

/* ═════════════ Mappa con consenso ═════════════ */
export function initMap() {
  const card = document.querySelector('[data-map]');
  if (!card) return;
  const consent = card.querySelector('[data-map-consent]');
  const load = () => {
    const f = document.createElement('iframe');
    f.src = BUSINESS.mapEmbed;
    f.title = `Mappa: ${BUSINESS.name}, ${BUSINESS.address}, ${BUSINESS.city}`;
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.allowFullscreen = true;
    card.append(f);
    consent.remove();
    try {
      localStorage.setItem('pizzaart-mappa', '1');
    } catch { /* ignora */ }
  };
  card.querySelector('[data-map-load]').addEventListener('click', load);
  try {
    if (localStorage.getItem('pizzaart-mappa') === '1') load();
  } catch { /* ignora */ }
}
