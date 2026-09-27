(function () {
  'use strict';
  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(pointer: fine)').matches;
  const LITE = window.matchMedia('(max-width: 900px), (hover: none)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const root = document.documentElement;
  if (RM) root.classList.add('no-motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  const fmtNum = (v, dec) => v.toFixed(dec || 0).replace('.', ',');
  const euro = v => '€ ' + Math.round(v).toLocaleString('it-IT');

  /* ---------- Images: real photo when available, illustration generated lazily otherwise ---------- */
  const INLINE = window.__PHOTOS__ || {};
  const BUNDLED = !!window.__PHOTOS_BUNDLED__;
  $$('img[data-k][src]').forEach(i => { INLINE[i.dataset.k] = INLINE[i.dataset.k] || i.getAttribute('src'); });
  const resolved = {};
  const photoSrc = k => INLINE[k] || (BUNDLED ? null : S.photos[k]) || null;
  const plateSrc = k => Plates.src(S.fallback[k] || k, 600, 800);
  const srcOf = k => resolved[k] || photoSrc(k) || plateSrc(k);
  function imgTag(k, alt, attrs) {
    const src = photoSrc(k);
    return `<img ${src ? `src="${src}"` : ''} data-k="${k}" alt="${alt}" decoding="async" draggable="false" ${attrs || ''}>`;
  }
  const plateQueue = [];
  let plateBusy = false;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60));
  function queuePlate(img) {
    if (img.dataset.plate) return;
    img.dataset.plate = '1';
    plateQueue.push(img);
    if (!plateBusy) { plateBusy = true; idle(drainPlates); }
  }
  function drainPlates() {
    const img = plateQueue.shift();
    if (!img) { plateBusy = false; return; }
    const k = img.dataset.k;
    resolved[k] = resolved[k] || plateSrc(k);
    $$(`img[data-k="${k}"]`).forEach(i => { if (!i.getAttribute('src') || i.dataset.plate) { i.dataset.plate = '1'; i.src = resolved[k]; } });
    idle(drainPlates);
  }
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.k || img.dataset.plate) return;
    const slide = img.closest('.arch__slide');
    if (slide) { dropSlide(slide); return; }
    queuePlate(img);
  }, true);
  function fillMissing() { $$('img[data-k]:not([src])').forEach(queuePlate); }

  /* ---------- Text splitting ---------- */
  function split(el, mode) {
    const out = [];
    const walk = (node, target) => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'word';
            if (mode === 'chars') {
              Array.from(part).forEach(c => { const i = document.createElement('span'); i.textContent = c; w.appendChild(i); out.push(i); });
            } else {
              const i = document.createElement('span'); i.textContent = part; w.appendChild(i); out.push(i);
            }
            target.appendChild(w);
          });
        } else if (ch.nodeType === 1) {
          const clone = ch.cloneNode(false); target.appendChild(clone); walk(ch, clone);
        }
      });
    };
    const frag = document.createDocumentFragment();
    walk(el, frag);
    el.textContent = ''; el.appendChild(frag);
    return out;
  }

  /* ---------- Build: rooms ---------- */
  function buildRooms() {
    const track = $('#roomsTrack');
    track.innerHTML = S.rooms.map((r, i) => `
      <article class="room" data-room="${r.id}">
        <div class="room__card" tabindex="0" role="button" aria-label="Scegli ${r.name}, da ${r.price} euro a notte" data-cursor-label="Scegli">
          <div class="room__media">${imgTag(r.img, r.name, 'loading="lazy"')}<div class="room__glare"></div></div>
          <div class="room__price">da<strong>€ ${r.price}</strong>a notte</div>
          <div class="room__body">
            <div class="room__tag">${r.tag}</div>
            <h3 class="room__name">${r.name}</h3>
            <p class="room__text">${r.text}</p>
            <ul class="room__feats">${r.feats.map(f => `<li>${f}</li>`).join('')}</ul>
            <div class="room__foot"><span>${r.guests === 1 ? '1 ospite' : 'Fino a ' + r.guests + ' ospiti'} · ${r.bed}</span><span class="room__pick">Scegli</span></div>
          </div>
        </div>
      </article>`).join('') + `
      <div class="rooms__end"><p>Bagno privato, lenzuola di qualità e <em>silenzio</em> in ogni camera.</p>
      <a class="btn btn--gold magnetic" href="#prenota"><span>Verifica disponibilità</span></a></div>`;

    $$('.room', track).forEach(room => {
      const card = $('.room__card', room);
      if (!RM && FINE && hasGsap) gsap.set(card, { transformPerspective: 1100 });
      const choose = () => { selectRoom(room.dataset.room); goTo('#prenota'); };
      card.addEventListener('click', choose);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      if (!RM && FINE && hasGsap) {
        const rx = gsap.quickTo(card, 'rotateX', { duration: 0.7, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotateY', { duration: 0.7, ease: 'power3.out' });
        card.addEventListener('pointermove', e => {
          const b = card.getBoundingClientRect();
          const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
          rx((0.5 - y) * 10); ry((x - 0.5) * 12);
          card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%');
        });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      }
    });
  }

  /* ---------- Build: amenities ---------- */
  const ICONS = {
    ac: 'M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5',
    wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
    terrace: 'M12 2v2M5.6 4.6L7 6M18.4 4.6L17 6M8 10a4 4 0 0 1 8 0M3 12h18M3 21h18M5 12v9M9 12v9M15 12v9M19 12v9',
    lift: 'M5 3h14v18H5zM12 3v18M7.5 10l1.5-2 1.5 2M13.5 14l1.5 2 1.5-2',
    clean: 'M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    shower: 'M4 21V7a3 3 0 0 1 6 0v1M7 8h7a3.5 3.5 0 0 0-7 0M8.5 12v1.5M11 12v1.5M13.5 12v1.5M9.7 16v1.5M12.3 16v1.5M11 20v1',
    fridge: 'M6 2h12v20H6zM6 10h12M9 5v2.5M9 13v3.5',
    safe: 'M3 4h18v15H3zM5.5 19v2M18.5 19v2M14.5 11.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM17.5 9v5',
    tv: 'M3 5h18v12H3zM8 21h8M12 17v4',
    laundry: 'M10 5.5a2 2 0 1 1 2 2v2L3 16.5h18L12 9.5',
    ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM14.5 6v2M14.5 11v2M14.5 16v2',
    key: 'M20 8.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM12.3 11.7L3 21M6 18l2.2 2.2M8.6 15.4l2.2 2.2'
  };
  function buildAmenities() {
    $('#amenGrid').innerHTML = S.amenities.map(([k, t, d]) => `
      <li class="amen__item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg><h3>${t}</h3><p>${d}</p></li>`).join('');
  }

  /* ---------- Lenis + scroll helpers ---------- */
  let lenis = null;
  function initScroll() {
    if (RM || !window.Lenis) return;
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1, syncTouch: false });
    window.__lenis = lenis;
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function goTo(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  }
  function bindAnchors() {
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = id === '#top' ? document.body : $(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      if (id === '#top') { lenis ? lenis.scrollTo(0, { duration: 1.8 }) : window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); }
      else goTo(el);
    }));
  }

  /* ---------- Hero: arched slideshow of the rooms ---------- */
  const hero = { i: 0, slides: [], dots: [], timer: null, visible: true };
  const SLIDE_MS = 5600;
  function initHero() {
    S.hero = S.hero.filter(h => !BUNDLED || photoSrc(h.img));
    const box = $('#heroSlides'), dots = $('#heroDots');
    const first = $('img', box);
    box.insertAdjacentHTML('beforeend', S.hero.slice(first ? 1 : 0).map((h, j) => `
      <div class="arch__slide${!first && j === 0 ? ' is-active' : ''}">${imgTag(h.img, h.cap, `style="object-position:${h.pos || '50% 50%'}" loading="lazy"`)}</div>`).join(''));
    dots.innerHTML = S.hero.map(h => `<button type="button" class="hero__dot" aria-label="Mostra ${h.cap}"><i></i></button>`).join('');
    hero.slides = $$('.arch__slide', box);
    hero.dots = $$('.hero__dot', dots);
    hero.dots.forEach((d, i) => d.addEventListener('click', () => showSlide(i, true)));
    $('#heroCap').textContent = S.hero[0].cap;
    hero.dots[0].classList.add('is-active');

    if (RM || !hasGsap) return;
    new IntersectionObserver(([en]) => {
      hero.visible = en.isIntersecting;
      $('#hero').classList.toggle('is-away', !en.isIntersecting);
      if (hero.timer) hero.visible ? hero.timer.play() : hero.timer.pause();
    }).observe($('#hero'));

    if (FINE) {
      const px = gsap.quickTo('.arch__slides', 'x', { duration: 1.2, ease: 'power3.out' });
      const py = gsap.quickTo('.arch__slides', 'y', { duration: 1.2, ease: 'power3.out' });
      const sx = gsap.quickTo('.seal', 'x', { duration: 1.4, ease: 'power3.out' });
      $('#hero').addEventListener('pointermove', e => {
        const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        px(nx * -18); py(ny * -14); sx(nx * 22);
      });
    }
    gsap.to('.arch', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__content', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
  function dropSlide(slide) {
    const i = hero.slides.indexOf(slide);
    if (i < 1) return;
    hero.dots[i].remove(); slide.remove();
    hero.slides.splice(i, 1); hero.dots.splice(i, 1); S.hero.splice(i, 1);
    if (hero.i >= hero.slides.length) showSlide(0, true);
  }
  function runTimer() {
    if (RM || !hasGsap) return;
    if (hero.timer) hero.timer.kill();
    const bar = $('i', hero.dots[hero.i]);
    hero.timer = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: SLIDE_MS / 1000, ease: 'none', onComplete: () => showSlide(hero.i + 1) });
    if (!hero.visible) hero.timer.pause();
  }
  function showSlide(n, user) {
    n = (n + hero.slides.length) % hero.slides.length;
    if (n === hero.i && !user) return;
    const prev = hero.slides[hero.i], next = hero.slides[n];
    hero.dots.forEach((d, i) => { d.classList.toggle('is-active', i === n); if (hasGsap) gsap.set($('i', d), { scaleX: 0 }); });
    hero.i = n;
    $('#heroCap').textContent = S.hero[n].cap;
    if (next !== prev) {
      if (RM || !hasGsap) { prev.classList.remove('is-active'); next.classList.add('is-active'); }
      else {
        hero.slides.forEach(s => s.style.zIndex = s === next ? 2 : s === prev ? 1 : 0);
        next.classList.add('is-active');
        gsap.fromTo(next, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut',
          onComplete: () => { if (hero.slides[hero.i] !== prev) prev.classList.remove('is-active'); } });
        gsap.fromTo($('img', next), { scale: 1.22 }, { scale: 1, duration: 7, ease: 'power2.out' });
        gsap.fromTo('#heroCap', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.5, ease: 'power3.out' });
      }
    }
    runTimer();
  }

  function heroIntro() {
    const chars = [];
    $$('.hero__line').forEach(l => chars.push(...split(l, 'chars')));
    if (RM || !hasGsap) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: runTimer });
    tl.timeScale(1.25);
    tl.from(chars, { yPercent: 115, rotateX: LITE ? 0 : -85, opacity: 0, duration: 1.2, stagger: 0.035, clearProps: 'transform' }, 0)
      .from('.hero__eyebrow', { y: 20, opacity: 0, duration: 1 }, 0.6)
      .from('.hero__lead', { y: 30, opacity: 0, duration: 1.2 }, 0.85)
      .from('.hero__ctas > *, .hero__addr', { y: 30, opacity: 0, duration: 1.1, stagger: 0.1 }, 1)
      .from('.seal', { scale: 0, rotate: -120, duration: 1.4 }, 1.1)
      .from('.hero__slidebar', { y: 20, opacity: 0, duration: 1 }, 1.2)
      .from('.hero__scroll > *', { opacity: 0, y: -10, duration: 1 }, 1.3)
      .from('.nav > *', { y: -30, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.6);
  }

  /* ---------- Reveals ---------- */
  function reveals() {
    $$('[data-split]').forEach(el => {
      if (el.closest('.hero')) return;
      const parts = split(el, el.closest('.foot__word') ? 'chars' : 'words');
      if (RM || !hasGsap) return;
      gsap.from(parts, {
        yPercent: 110, rotateX: LITE ? 0 : -70, transformPerspective: 800, duration: LITE ? 0.9 : 1.2, ease: 'expo.out', clearProps: 'transform', stagger: el.closest('.foot__word') ? 0.04 : 0.07,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
    if (RM || !hasGsap) return;
    $$('.eyebrow').forEach(el => { if (!el.closest('.hero')) gsap.from(el, { x: -20, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }); });
    [['.rooms__hint', 0], ['.hood__text', 0], ['.book__intro > p:not(.eyebrow), .phone, .book__intro .link-arrow', 0.08], ['.quotes', 0], ['.hours__item', 0.1], ['.foot__grid > div', 0.08]]
      .forEach(([sel, st]) => {
        const els = $$(sel); if (!els.length) return;
        gsap.from(els, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform', stagger: st, scrollTrigger: { trigger: els[0], start: 'top 90%', once: true } });
      });
    gsap.from('.amen__item', {
      rotateX: LITE ? 0 : -80, y: LITE ? 24 : 40, opacity: 0, transformOrigin: '50% 0%', transformPerspective: 900, duration: LITE ? 0.7 : 1, ease: 'expo.out', clearProps: 'transform',
      stagger: { each: 0.06, grid: 'auto', from: 'start' }, scrollTrigger: { trigger: '#amenGrid', start: 'top 85%', once: true }
    });
    gsap.from('.place', { x: -30, opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform', stagger: 0.07, scrollTrigger: { trigger: '#places', start: 'top 88%', once: true } });
    gsap.from('.map', LITE ? { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: '#map', start: 'top 95%', once: true } } : { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut', scrollTrigger: { trigger: '#map', start: 'top 85%', once: true } });
    gsap.from('.panel', { y: LITE ? 30 : 60, rotateX: LITE ? 0 : 12, transformPerspective: 1200, opacity: 0, clearProps: 'transform', duration: LITE ? 0.8 : 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.panel', start: 'top 85%', once: true } });
    gsap.from('.facts > div', { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.facts', start: 'top 88%', once: true } });
  }

  /* ---------- Manifesto: words light up with scroll ---------- */
  function manifesto() {
    const el = $('[data-fill]');
    const words = split(el, 'words');
    words.forEach(w => w.classList.add('fw'));
    if (RM || !hasGsap) return;
    el.classList.add('is-armed');
    let lit = -1;
    ScrollTrigger.create({
      trigger: el, start: 'top 78%', end: 'bottom 50%', scrub: true,
      onUpdate: s => {
        const n = Math.round(s.progress * words.length);
        if (n === lit) return;
        words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
        lit = n;
      }
    });
  }

  /* ---------- Counters & gauges ---------- */
  function counters() {
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
      const holder = el.children.length && !el.firstElementChild.dataset.count ? null : el;
      if (!holder || RM || !hasGsap) return;
      const o = { v: 0 };
      const txt = () => {
        const first = [...holder.childNodes].find(n => n.nodeType === 3);
        if (first) first.textContent = fmtNum(o.v, dec); else holder.textContent = fmtNum(o.v, dec);
      };
      txt();
      gsap.to(o, { v: end, duration: 1.2, ease: 'power3.out', onUpdate: txt, scrollTrigger: { trigger: holder, start: 'top 92%', once: true } });
    });
    $$('.gauge').forEach(g => {
      const val = parseFloat(g.dataset.value) / 10;
      if (RM || !hasGsap) { g.style.setProperty('--v', val); return; }
      const o = { v: 0 }; g.style.setProperty('--v', 0);
      gsap.to(o, { v: val, duration: 1.4, ease: 'expo.out', onUpdate: () => g.style.setProperty('--v', o.v), scrollTrigger: { trigger: g, start: 'top 90%', once: true } });
    });
  }

  /* ---------- Rooms horizontal scroll (same pinned scrollytelling at every width) ---------- */
  function roomsScroll() {
    if (RM || !hasGsap) return;
    const rail = $('.rooms__rail span');
    const track = $('#roomsTrack');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#camere', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => { rail.style.transform = `scaleX(${s.progress})`; }
      }
    });
    gsap.from('.room', { y: 80, opacity: 0, rotateY: -20, clearProps: 'transform', duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '#camere', start: 'top 70%', once: true } });
  }

  /* ---------- 3D ring gallery ---------- */
  const ring = { angle: 0, step: 0, R: 0, n: 0, items: [], idx: 0 };
  function buildRing() {
    const spin = $('#ringSpin');
    ring.n = S.gallery.length; ring.step = 360 / ring.n;
    spin.innerHTML = S.gallery.map((g, i) => `
      <div class="ring__item" data-i="${i}"><figure>${imgTag(g.img, g.cap, 'loading="lazy"')}<figcaption>${g.cap}</figcaption></figure></div>`).join('');
    ring.items = $$('.ring__item', spin);
    $('#ring').insertAdjacentHTML('beforeend', '<div class="ring__floor" aria-hidden="true"></div>');
    $('#ring').dataset.cursorLabel = 'Trascina';
    sizeRing(); applyRing();
    window.addEventListener('resize', () => { sizeRing(); applyRing(); });

    const el = $('#ring');
    let down = false, sx = 0, sa = 0, lastX = 0, lastT = 0, vel = 0, moved = 0;
    el.addEventListener('pointerdown', e => {
      down = true; moved = 0; sx = lastX = e.clientX; sa = ring.angle; lastT = performance.now(); vel = 0;
      if (hasGsap) gsap.killTweensOf(ring);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      const now = performance.now();
      const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      ring.angle = sa - dx * 0.28;
      vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
      applyRing();
    });
    const up = e => {
      if (!down) return; down = false;
      if (moved < 6) {
        const item = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ring__item');
        if (item) { const i = +item.dataset.i; i === ring.idx ? openLightbox(i) : rotateTo(i); }
        return;
      }
      const target = Math.round((ring.angle - vel * 260) / ring.step) * ring.step;
      tweenAngle(target, 1.4);
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); rotateTo(ring.idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); rotateTo(ring.idx - 1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(ring.idx); }
    });
    $('#ringNext').addEventListener('click', () => rotateTo(ring.idx + 1));
    $('#ringPrev').addEventListener('click', () => rotateTo(ring.idx - 1));

    if (!RM && hasGsap) {
      gsap.fromTo('.ring__stage', { rotateX: 24, scale: 0.8, y: 60 }, { rotateX: -4, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '#ring', start: 'top bottom', end: 'center 55%', scrub: true } });
      gsap.fromTo(ring, { angle: 120 }, { angle: 0, ease: 'none', onUpdate: applyRing, scrollTrigger: { trigger: '#ring', start: 'top bottom', end: 'center 55%', scrub: 1 } });
    }
  }
  function sizeRing() {
    const vw = window.innerWidth;
    const iw = Math.round(Math.min(300, Math.max(190, vw * (vw < 700 ? 0.52 : 0.2))));
    $('#ringSpin').style.setProperty('--iw', iw + 'px');
    ring.R = Math.round((iw / 2) / Math.tan(Math.PI / ring.n) + (vw < 700 ? 16 : 46));
    ring.items.forEach((it, i) => { it.style.transform = `rotateY(${i * ring.step}deg) translateZ(${ring.R}px)`; });
  }
  function applyRing() {
    $('#ringSpin').style.transform = `translateZ(${-ring.R}px) rotateY(${-ring.angle}deg)`;
    const idx = ((Math.round(ring.angle / ring.step) % ring.n) + ring.n) % ring.n;
    ring.items.forEach((it, i) => {
      let rel = ((i * ring.step - ring.angle) % 360 + 540) % 360 - 180;
      it.style.setProperty('--dim', Math.min(0.85, Math.abs(rel) / 150).toFixed(3));
    });
    if (idx !== ring.idx || !$('#ringCaption').textContent) { ring.idx = idx; $('#ringCaption').textContent = S.gallery[idx].cap; }
  }
  function tweenAngle(target, d) {
    if (!hasGsap || RM) { ring.angle = target; applyRing(); return; }
    gsap.to(ring, { angle: target, duration: d || 1, ease: 'expo.out', onUpdate: applyRing, overwrite: true });
  }
  function rotateTo(i) {
    const cur = Math.round(ring.angle / ring.step);
    let diff = ((i - cur) % ring.n + ring.n) % ring.n;
    if (diff > ring.n / 2) diff -= ring.n;
    tweenAngle((cur + diff) * ring.step, 1.1);
  }

  /* ---------- Lightbox ---------- */
  let lbIdx = 0;
  function openLightbox(i) {
    lbIdx = (i + ring.n) % ring.n;
    const g = S.gallery[lbIdx];
    $('#lbImg').src = srcOf(g.img); $('#lbImg').alt = g.cap; $('#lbCap').textContent = g.cap;
    const d = $('#lightbox');
    if (!d.open) {
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      lenis && lenis.stop();
      if (!RM && hasGsap) gsap.fromTo('#lightbox figure', { scale: 0.9, rotateX: 12, opacity: 0, transformPerspective: 1200 }, { scale: 1, rotateX: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
    } else if (!RM && hasGsap) gsap.fromTo('#lbImg', { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' });
  }
  function closeLightbox() { const d = $('#lightbox'); if (d.close) d.close(); else d.removeAttribute('open'); }
  function initLightbox() {
    const d = $('#lightbox');
    d.addEventListener('close', () => { lenis && lenis.start(); rotateTo(lbIdx); });
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbNext').addEventListener('click', () => openLightbox(lbIdx + 1));
    $('#lbPrev').addEventListener('click', () => openLightbox(lbIdx - 1));
    d.addEventListener('click', e => { if (e.target === d) closeLightbox(); });
    d.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') openLightbox(lbIdx + 1);
      if (e.key === 'ArrowLeft') openLightbox(lbIdx - 1);
    });
  }

  /* ---------- Map ---------- */
  function initMap() {
    const NS = 'http://www.w3.org/2000/svg';
    const routes = $('#routes'), pins = $('#pins'), list = $('#places');
    let walker = null, walkTween = null;
    S.places.forEach(p => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M400 300 Q ${p.c[0]} ${p.c[1]} ${p.x} ${p.y}`);
      path.setAttribute('class', 'route'); path.dataset.id = p.id;
      routes.appendChild(path);
      const left = p.x < 400 || p.x > 620;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'pin'); g.setAttribute('transform', `translate(${p.x} ${p.y})`); g.dataset.id = p.id;
      g.innerHTML = `<circle r="7"/><text x="${left ? -14 : 14}" y="5" text-anchor="${left ? 'end' : 'start'}">${p.name}</text>
        <text class="pin__walk" x="${left ? -14 : 14}" y="26" text-anchor="${left ? 'end' : 'start'}">${p.walk} a piedi</text>`;
      g.addEventListener('click', () => select(p.id));
      pins.appendChild(g);
      const li = document.createElement('li');
      li.innerHTML = `<button class="place" type="button" aria-pressed="false" data-id="${p.id}"><strong>${p.name}</strong><small>${p.sub}</small><span>${p.walk}</span></button>`;
      list.appendChild(li);
      const btn = li.firstElementChild;
      btn.addEventListener('click', () => select(p.id));
      if (FINE) btn.addEventListener('mouseenter', () => select(p.id));
    });
    walker = document.createElementNS(NS, 'circle');
    walker.setAttribute('r', '5'); walker.setAttribute('class', 'route__walker');
    routes.appendChild(walker);

    function fitLabel(g) {
      const px = +g.getAttribute('transform').match(/translate\(([\d.]+)/)[1];
      const texts = $$('text', g);
      texts.forEach((t, i) => { t.setAttribute('text-anchor', 'middle'); t.setAttribute('x', 0); t.setAttribute('y', i ? 44 : -20); });
      const w = Math.max(...texts.map(t => t.getBBox().width));
      const shift = Math.min(0, 792 - (px + w / 2)) + Math.max(0, 8 - (px - w / 2));
      texts.forEach(t => t.setAttribute('x', shift));
    }
    let current = null, live = false;
    new IntersectionObserver(([en]) => {
      live = en.isIntersecting;
      $('#map').classList.toggle('is-live', live);
      if (walkTween) live ? walkTween.resume() : walkTween.pause();
    }).observe($('#map'));
    function select(id) {
      if (id === current) return; current = id;
      $$('.place', list).forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'));
      $$('.pin', pins).forEach(g => g.classList.toggle('is-on', g.dataset.id === id));
      if (window.matchMedia('(max-width: 600px)').matches) fitLabel($(`.pin[data-id="${id}"]`, pins));
      $$('.route', routes).forEach(r => {
        const on = r.dataset.id === id;
        r.classList.toggle('route--on', on);
        if (hasGsap) gsap.killTweensOf(r);
        if (on) {
          const L = r.getTotalLength();
          r.style.strokeDasharray = L; r.style.strokeDashoffset = RM || !hasGsap ? 0 : L;
          if (!RM && hasGsap) gsap.to(r, { strokeDashoffset: 0, duration: 1, ease: 'power3.inOut' });
          if (walkTween) walkTween.kill();
          if (hasGsap && !RM) {
            const o = { t: 0 };
            walkTween = gsap.to(o, { t: 1, duration: 2.6, ease: 'none', repeat: -1, repeatDelay: 0.4, onUpdate: () => {
              const pt = r.getPointAtLength(o.t * L); walker.setAttribute('cx', pt.x); walker.setAttribute('cy', pt.y);
              walker.setAttribute('opacity', o.t < 0.05 ? o.t * 20 : o.t > 0.9 ? (1 - o.t) * 10 : 1);
            } });
            if (!live) walkTween.pause();
          } else { const pt = r.getPointAtLength(L); walker.setAttribute('cx', pt.x); walker.setAttribute('cy', pt.y); }
        } else { r.style.strokeDasharray = ''; r.style.strokeDashoffset = ''; }
      });
    }
    select('sanpietro');
  }

  /* ---------- Reviews deck ---------- */
  function initDeck() {
    const deck = $('#deck'), n = S.quotes.length;
    deck.innerHTML = S.quotes.map(q => `
      <article class="qcard"><div class="qcard__mark" aria-hidden="true">“</div><p class="qcard__text">${q.t}</p>
      <div class="qcard__foot"><span>${q.k} · Ospite verificato</span><span class="qcard__stars" aria-hidden="true">★★★★★</span></div></article>`).join('');
    const cards = $$('.qcard', deck);
    let cur = 0, timer = null, busy = false, fly = null;
    const varsFor = k => ({ y: -k * 22, z: -k * 60, scale: 1 - k * 0.05, opacity: k > 2 ? 0 : 1 - k * 0.28, rotateX: k * 4, zIndex: n - k, x: 0, rotateZ: 0, rotateY: 0 });
    function layout(instant, skip) {
      cards.forEach((c, i) => {
        const k = (i - cur + n) % n;
        c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true');
        if (c === skip) return;
        if (!hasGsap) { c.style.zIndex = n - k; c.style.opacity = k === 0 ? 1 : 0; return; }
        if (instant || RM) gsap.set(c, varsFor(k));
        else gsap.to(c, { ...varsFor(k), duration: 0.9, ease: 'expo.out', overwrite: true });
      });
      $('#deckCount').textContent = `${cur + 1} / ${n}`;
    }
    function go(dir) {
      if (busy && fly) fly.progress(1);
      const front = cards[cur];
      cur = (cur + dir + n) % n;
      if (RM || !hasGsap) { layout(true); return; }
      if (dir > 0) {
        busy = true;
        gsap.set(front, { zIndex: n + 1 });
        fly = gsap.to(front, { x: '-70%', rotateZ: -10, rotateY: 35, opacity: 0, duration: 0.55, ease: 'power3.in', overwrite: true,
          onComplete: () => { busy = false; gsap.set(front, varsFor((cards.indexOf(front) - cur + n) % n)); } });
        layout(false, front);
      } else layout();
    }
    layout(true);
    $('#deckNext').addEventListener('click', () => { go(1); restart(); });
    $('#deckPrev').addEventListener('click', () => { go(-1); restart(); });
    let sx = null;
    deck.addEventListener('pointerdown', e => { sx = e.clientX; });
    deck.addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); restart(); } });
    function restart() { clearInterval(timer); if (!RM) timer = setInterval(() => { if (inView) go(1); }, 6000); }
    let inView = false;
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; }).observe(deck);
    restart();
  }

  /* ---------- Booking ---------- */
  const book = { guests: 2 };
  function iso(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
  function parse(v) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); }
  function selectRoom(id) {
    $('#fRoom').value = id;
    $$('.room').forEach(r => r.classList.toggle('is-selected', r.dataset.room === id));
    updateBooking();
  }
  function initBooking() {
    const sel = $('#fRoom');
    sel.innerHTML = S.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const a = new Date(today); a.setDate(a.getDate() + 14);
    const b = new Date(a); b.setDate(b.getDate() + 3);
    $('#fIn').value = iso(a); $('#fOut').value = iso(b);
    $('#fIn').min = iso(today); $('#fOut').min = iso(new Date(today.getTime() + 864e5));
    ['#fIn', '#fOut', '#fRoom'].forEach(s => $(s).addEventListener('change', updateBooking));
    $('#fIn').addEventListener('change', () => {
      const i = parse($('#fIn').value), o = parse($('#fOut').value);
      const next = new Date(i); next.setDate(next.getDate() + 1);
      $('#fOut').min = iso(next);
      if (!(o > i)) { const d = new Date(i); d.setDate(d.getDate() + 2); $('#fOut').value = iso(d); updateBooking(); }
    });
    $('#gMinus').addEventListener('click', () => { book.guests--; updateBooking(); });
    $('#gPlus').addEventListener('click', () => { book.guests++; updateBooking(); });
    $('#bookForm').addEventListener('submit', e => {
      e.preventDefault();
      const r = updateBooking();
      if (!r) return;
      const f = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
      $('#doneText').textContent = `${r.room.name}, dal ${f(r.i)} al ${f(r.o)}, ${book.guests} ${book.guests === 1 ? 'ospite' : 'ospiti'}: stima ${euro(r.total)}. In questa anteprima la richiesta non viene inviata; sul sito finale arriverà direttamente alla struttura.`;
      $('#formDone').hidden = false;
      if (!RM && hasGsap) {
        gsap.fromTo('#formDone', { clipPath: 'circle(0% at 50% 100%)' }, { clipPath: 'circle(150% at 50% 100%)', duration: 1, ease: 'expo.inOut' });
        gsap.fromTo('#formDone path', { strokeDasharray: 40, strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.8, delay: 0.5, ease: 'power3.out' });
      }
    });
    $('#formBack').addEventListener('click', () => { $('#formDone').hidden = true; });
    $('#copyPhone').addEventListener('click', e => {
      const btn = e.currentTarget, txt = $('#phoneNum').textContent;
      const ok = () => { btn.textContent = 'Copiato'; setTimeout(() => { btn.textContent = 'Copia'; }, 1800); };
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#phoneNum')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selezionato'; setTimeout(() => { btn.textContent = 'Copia'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
    });
    selectRoom(S.rooms[0].id);
  }
  let shown = { nights: 0, rate: 0, total: 0 };
  function updateBooking() {
    const room = S.rooms.find(r => r.id === $('#fRoom').value) || S.rooms[0];
    book.guests = Math.max(1, Math.min(room.guests, book.guests));
    $('#gVal').textContent = book.guests;
    $('#gMinus').disabled = book.guests <= 1;
    $('#gPlus').disabled = book.guests >= room.guests;
    $$('.room').forEach(r => r.classList.toggle('is-selected', r.dataset.room === room.id));
    const i = parse($('#fIn').value || iso(new Date())), o = parse($('#fOut').value || iso(new Date()));
    const nights = Math.round((o - i) / 864e5);
    const err = $('#formError');
    const bad = !$('#fIn').value || !$('#fOut').value || nights < 1;
    $('#fOut').setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (bad) { err.textContent = 'La data di partenza deve essere successiva a quella di arrivo.'; err.hidden = false; return null; }
    err.hidden = true;
    const target = { nights, rate: room.price, total: nights * room.price };
    const paint = () => {
      $('#sNights').textContent = Math.round(shown.nights);
      $('#sRate').textContent = euro(shown.rate);
      $('#sTotal').textContent = euro(shown.total);
    };
    if (RM || !hasGsap) { shown = target; paint(); }
    else gsap.to(shown, { ...target, duration: 0.8, ease: 'power3.out', onUpdate: paint, overwrite: true });
    return { room, i, o, total: target.total };
  }

  /* ---------- Nav, menu, progress ---------- */
  function initNav() {
    const nav = $('#nav');
    let lastY = 0;
    let max = 1;
    const measure = () => { max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
    measure();
    window.addEventListener('resize', measure);
    if (hasGsap) ScrollTrigger.addEventListener('refresh', measure);
    const bar = $('#progressBar');
    const onScroll = y => {
      nav.classList.toggle('is-scrolled', y > 40);
      if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > window.innerHeight * 2.4 && y > lastY + 2);
      if (y < lastY - 2) nav.classList.remove('is-hidden');
      lastY = y;
      bar.style.transform = `scaleX(${Math.min(1, y / max)})`;
    };
    if (lenis) lenis.on('scroll', e => onScroll(e.scroll)); else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    onScroll(window.scrollY);
    if (hasGsap) {
      $$('.nav__links a').forEach(a => {
        const sec = $(a.getAttribute('href'));
        if (sec) ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: s => a.classList.toggle('is-active', s.isActive) });
      });
    }
    $('#burger').addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }
  function openMenu() {
    const m = $('#menu'); m.hidden = false; document.body.classList.add('menu-open');
    $('#burger').setAttribute('aria-expanded', 'true'); $('#burger').setAttribute('aria-label', 'Chiudi il menu');
    lenis && lenis.stop();
    if (!RM && hasGsap) {
      gsap.to(m, { clipPath: 'circle(150% at calc(100% - 44px) 44px)', duration: 0.9, ease: 'expo.inOut' });
      gsap.fromTo('#menu nav a', { yPercent: 100, opacity: 0, rotateX: -40 }, { yPercent: 0, opacity: 1, rotateX: 0, stagger: 0.06, duration: 0.9, delay: 0.25, ease: 'expo.out' });
    } else m.style.clipPath = 'none';
    $('#menu nav a').focus();
  }
  function closeMenu() {
    if (!document.body.classList.contains('menu-open')) return;
    const m = $('#menu'); document.body.classList.remove('menu-open');
    $('#burger').setAttribute('aria-expanded', 'false'); $('#burger').setAttribute('aria-label', 'Apri il menu');
    lenis && lenis.start();
    if (!RM && hasGsap) gsap.to(m, { clipPath: 'circle(0% at calc(100% - 44px) 44px)', duration: 0.7, ease: 'expo.inOut', onComplete: () => { m.hidden = true; } });
    else m.hidden = true;
  }

  /* ---------- Cursor & magnetic buttons ---------- */
  function initCursor() {
    if (!FINE || RM || !hasGsap) return;
    document.body.classList.add('has-cursor');
    const c = $('.cursor'), dot = $('.cursor__dot'), ringEl = $('.cursor__ring'), label = $('.cursor__label');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12 }), dy = gsap.quickTo(dot, 'y', { duration: 0.12 });
    const rx = gsap.quickTo(ringEl, 'x', { duration: 0.45, ease: 'power3.out' }), ry = gsap.quickTo(ringEl, 'y', { duration: 0.45, ease: 'power3.out' });
    window.addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor-label]');
      const link = e.target.closest('a, button, select, input, label, .pin');
      c.classList.toggle('is-label', !!lab); c.classList.toggle('is-link', !lab && !!link);
      if (lab) label.textContent = lab.dataset.cursorLabel;
    });
    document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0, duration: 0.3 }));
    document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1, duration: 0.3 }));
  }
  function initMagnetic() {
    if (!FINE || RM || !hasGsap) return;
    $$('.magnetic').forEach(el => {
      const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }), y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', e => { const b = el.getBoundingClientRect(); x((e.clientX - b.left - b.width / 2) * 0.28); y((e.clientY - b.top - b.height / 2) * 0.35); });
      el.addEventListener('pointerleave', () => { gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .4)' }); });
    });
  }

  /* ---------- Golden thread: drawn once, revealed by moving two composited layers (no repaint while scrolling) ---------- */
  function initThread() {
    const NS = 'http://www.w3.org/2000/svg';
    const wrap = document.createElement('div');
    wrap.className = 'thread'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg class="thread__svg thread__svg--ghost"><path/></svg><div class="thread__clip"><div class="thread__inner"><svg class="thread__svg thread__svg--gold"><path/></svg></div></div><div class="thread__tip"></div>';
    document.body.prepend(wrap);
    const ghostSvg = $('.thread__svg--ghost', wrap), goldSvg = $('.thread__svg--gold', wrap);
    const ghost = $('path', ghostSvg), gold = $('path', goldSvg);
    const clip = $('.thread__clip', wrap), inner = $('.thread__inner', wrap), tipEl = $('.thread__tip', wrap);
    const STEP = 12;
    let px = [], ymax = [], H = 0, cur = 0, tgt = 0, running = false;
    // offsetLeft/offsetTop reflect the element's static layout position, unaffected by any
    // CSS `transform` an intro/reveal animation may have applied — getBoundingClientRect would
    // report the animated (in-flight) position instead, throwing the thread off if measured mid-tween.
    const docRect = el => {
      let x = 0, y = 0, node = el;
      while (node) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    };

    function build() {
      const W = document.documentElement.clientWidth;
      H = document.documentElement.scrollHeight;
      const start = docRect($('.hero__eyebrow'));
      const contentX = docRect($('#manifesto .eyebrow')).x;
      const x0 = Math.max(6, Math.round(contentX * 0.45));
      const amp = Math.min(22, x0 * 0.45);
      const ties = ['#manifesto', '#servizi', '#quartiere', '#recensioni', '#prenota']
        .map(id => docRect($(id + ' .eyebrow'))).map(r => ({ x: r.x, y: r.y + r.h / 2 }));
      const endEl = docRect($('.foot__bottom'));
      const end = { x: endEl.x, y: endEl.y };

      let y = start.y + start.h / 2, flip = 1;
      let d = `M${start.x} ${y} C${start.x - 30} ${y} ${x0} ${y + 10} ${x0} ${y + 90}`;
      y += 90;
      const wander = toY => {
        const dist = toY - y;
        if (dist <= 0) return;
        const n = Math.max(1, Math.round(dist / 420)), seg = dist / n;
        for (let i = 0; i < n; i++) {
          const a = y + seg * i, b = a + seg;
          d += ` C${x0 + amp * flip} ${a + seg * 0.33} ${x0 + amp * flip} ${a + seg * 0.66} ${x0} ${b}`;
          flip = -flip;
        }
        y = toY;
      };
      ties.forEach(t => {
        wander(t.y - 110);
        d += ` C${x0} ${t.y - 50} ${t.x - 34} ${t.y} ${t.x} ${t.y}`;
        d += ` C${t.x - 26} ${t.y + 4} ${x0} ${t.y + 44} ${x0} ${t.y + 110}`;
        y = t.y + 110;
      });
      wander(end.y - 90);
      d += ` C${x0} ${end.y - 30} ${end.x - 30} ${end.y} ${end.x} ${end.y}`;

      const TW = Math.min(W, Math.ceil(Math.max(start.x, end.x, ...ties.map(t => t.x)) + 24));
      wrap.style.width = TW + 'px';
      wrap.style.height = clip.style.height = inner.style.height = H + 'px';
      [ghostSvg, goldSvg].forEach(s => { s.setAttribute('viewBox', `0 0 ${TW} ${H}`); s.setAttribute('width', TW); s.setAttribute('height', H); });
      ghost.setAttribute('d', d); gold.setAttribute('d', d);

      const total = ghost.getTotalLength();
      px = []; ymax = [];
      let m = -Infinity;
      for (let l = 0; l <= total; l += STEP) {
        const p = ghost.getPointAtLength(l);
        px.push(p.x); m = Math.max(m, p.y); ymax.push(m);
      }
      tgt = targetY(); cur = tgt;
      paint();
    }

    function targetY() {
      if (RM) return H;
      const vh = window.innerHeight, maxS = H - vh;
      const tail = Math.min(1, Math.max(0, (window.scrollY - (maxS - vh)) / vh));
      // The "lead" is capped by how far the page has actually been scrolled, so on a fresh
      // load (scrollY 0) the thread starts fully undrawn at the dash instead of jumping ahead.
      const lead = Math.min(window.scrollY, vh * (0.62 + 0.4 * tail));
      return window.scrollY + lead;
    }
    function xAt(y) {
      let lo = 0, hi = ymax.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (ymax[mid] < y) lo = mid + 1; else hi = mid; }
      if (lo === 0) return px[0];
      const y0 = ymax[lo - 1], y1 = ymax[lo], t = y1 > y0 ? (y - y0) / (y1 - y0) : 1;
      return px[lo - 1] + (px[lo] - px[lo - 1]) * Math.min(1, Math.max(0, t));
    }
    function paint() {
      const y = Math.min(H, Math.max(0, cur));
      clip.style.transform = `translate3d(0, ${y - H}px, 0)`;
      inner.style.transform = `translate3d(0, ${H - y}px, 0)`;
      const done = y >= ymax[ymax.length - 1] - 1 || y <= ymax[0];
      tipEl.style.opacity = done || RM ? 0 : 1;
      tipEl.style.transform = `translate3d(${xAt(y)}px, ${y}px, 0)`;
    }
    function loop() {
      const diff = tgt - cur;
      cur += Math.abs(diff) < 0.4 ? diff : diff * 0.22;
      paint();
      if (cur !== tgt) requestAnimationFrame(loop); else running = false;
    }
    const onScroll = () => { tgt = targetY(); if (!running) { running = true; requestAnimationFrame(loop); } };
    if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
    if (hasGsap) ScrollTrigger.addEventListener('refresh', build);
    else { window.addEventListener('resize', build); window.addEventListener('load', build); }
    build();
  }

  /* ---------- Boot ---------- */
  function boot() {
    buildRooms(); buildAmenities(); buildRing(); initLightbox(); initMap(); initDeck(); initBooking();
    initScroll(); initHero(); manifesto(); reveals(); counters(); roomsScroll();
    bindAnchors(); initNav(); initCursor(); initMagnetic(); initThread();
    root.classList.remove('intro');
    heroIntro();
    if (hasGsap) {
      ScrollTrigger.refresh();
      window.addEventListener('load', () => ScrollTrigger.refresh());
      if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    fillMissing();
  }

  boot();
})();
