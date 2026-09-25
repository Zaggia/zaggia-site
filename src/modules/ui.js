// Interfaccia globale: preloader, header, menu, cursore, bottoni magnetici,
// marquee, titoli animati, rivelazioni, footer.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

export function runPreloader({ ready, reduced }) {
  const el = document.querySelector('.preloader');
  // Già aperta dalla sicura (vedi <head>): niente da animare.
  if (!el || window.__revealed) {
    document.body.classList.remove('is-loading');
    return Promise.resolve();
  }
  const count = el.querySelector('[data-preload-count]');
  const blob = el.querySelector('.preloader__blob');
  const bubbles = el.querySelectorAll('.preloader__bubbles circle');
  const curtain = el.querySelector('.preloader__curtain');
  const counter = { v: 0 };

  if (reduced) {
    return ready.then(() => {
      el.remove();
      document.body.classList.remove('is-loading');
    });
  }

  const rise = gsap.timeline();
  rise
    .fromTo(blob, { scaleY: 0.35, scaleX: 0.9 }, { scaleY: 1.35, scaleX: 1.05, duration: 1.8, ease: 'sine.inOut' }, 0)
    .fromTo(bubbles, { scale: 0 }, { scale: 1.6, duration: 0.9, stagger: 0.25, ease: 'back.out(3)' }, 0.2)
    .to(counter, {
      v: 72, duration: 1.8, ease: 'power2.inOut',
      onUpdate: () => (count.textContent = String(Math.round(counter.v)).padStart(2, '0')),
    }, 0);

  const minTime = new Promise((r) => rise.eventCallback('onComplete', r));
  const timeout = new Promise((r) => setTimeout(r, 6000));
  return Promise.all([minTime, Promise.race([ready, timeout])]).then(
    () => new Promise((resolve) => {
      gsap.timeline({
        onComplete: () => {
          el.remove();
        },
      })
        .to(el.querySelector('.preloader__inner'), { y: -40, opacity: 0, duration: 0.45, ease: 'power2.in' })
        .to(curtain, { scaleY: 1, duration: 0.55, ease: 'expo.inOut' }, '-=0.1')
        .add(() => {
          el.style.background = 'transparent';
          document.body.classList.remove('is-loading');
          resolve();
        })
        .to(curtain, { scaleY: 0, transformOrigin: 'top', duration: 0.7, ease: 'expo.inOut' });
    }),
  );
}

export function initHeader(lenis) {
  const header = document.querySelector('[data-header]');
  const bar = document.querySelector('[data-progress-bar]');
  const cutter = document.querySelector('[data-progress-cutter]');
  const menuEl = document.querySelector('[data-menu]');
  let lastY = 0;
  let vw = window.innerWidth;
  window.addEventListener('resize', () => (vw = window.innerWidth), { passive: true });
  const onScroll = (y, limit) => {
    header.classList.toggle('is-scrolled', y > 40);
    const menuOpen = menuEl?.classList.contains('is-open');
    header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 2);
    if (y < lastY - 2) header.classList.remove('is-hidden');
    lastY = y;
    const p = limit > 0 ? y / limit : 0;
    // Solo transform: niente "left", che costringerebbe a ricalcolare il layout.
    bar.style.transform = `scaleX(${p})`;
    cutter.style.transform = `translate3d(${(p * vw).toFixed(1)}px, 0, 0) rotate(${(y * 0.5) % 360}deg)`;
  };
  if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll, l.limit));
  else window.addEventListener('scroll', () => onScroll(window.scrollY, document.documentElement.scrollHeight - innerHeight), { passive: true });

  // Voce di menu attiva.
  const links = [...document.querySelectorAll('.nav a')];
  links.forEach((a) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (st) => a.classList.toggle('is-active', st.isActive),
    });
  });
}

export function initMenu(lenis) {
  const btn = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const items = menu.querySelectorAll('.menu__nav a');
  const open = () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    btn.setAttribute('aria-expanded', 'true');
    btn.querySelector('.visually-hidden').textContent = 'Chiudi il menu';
    lenis?.stop();
    gsap.fromTo(items, { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.7, ease: 'expo.out', delay: 0.15 });
    items[0]?.focus({ preventScroll: true });
  };
  const close = () => {
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.querySelector('.visually-hidden').textContent = 'Apri il menu';
    lenis?.start();
    setTimeout(() => {
      if (!menu.classList.contains('is-open')) menu.hidden = true;
    }, 700);
  };
  btn.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      close();
      btn.focus();
    }
  });
  menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', close));
}

export function initAnchors(lenis) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView({ behavior: 'auto' });
    try {
      history.replaceState(null, '', id);
    } catch {
      /* anteprime in sandbox: l'URL resta com'è */
    }
  });
}

export function initCursor() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;
  document.documentElement.classList.add('has-cursor');
  const cursor = document.querySelector('.cursor');
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');
  const label = cursor.querySelector('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  let shown = false;
  window.addEventListener('pointermove', (e) => {
    if (!shown) {
      shown = true;
      gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
      gsap.to(cursor, { opacity: 1, duration: 0.3 });
    }
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const withLabel = e.target.closest('[data-cursor]');
    const interactive = e.target.closest('a, button, [role="slider"], input, label');
    cursor.classList.toggle('is-label', !!withLabel);
    cursor.classList.toggle('is-hover', !withLabel && !!interactive);
    label.textContent = withLabel ? withLabel.dataset.cursor : '';
  });
  document.addEventListener('piecehover', (e) => {
    cursor.classList.toggle('is-label', e.detail);
    label.textContent = e.detail ? 'Assaggia' : '';
  });
  document.documentElement.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
  document.documentElement.addEventListener('pointerenter', () => shown && gsap.to(cursor, { opacity: 1, duration: 0.2 }));
}

export function initMagnetic() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    });
  });
}

export function initMarquee(lenis, reduced) {
  const track = document.querySelector('[data-marquee-track]');
  if (!track) return;
  track.innerHTML += track.innerHTML;
  if (reduced) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  let skew = 0;
  const setSkew = gsap.quickSetter(track, 'skewX', 'deg');
  lenis?.on('scroll', ({ velocity }) => {
    const v = Math.max(-40, Math.min(40, velocity));
    loop.timeScale(1 + Math.abs(v) * 0.12 * (v < 0 ? -1 : 1));
    skew = v * -0.25;
  });
  gsap.ticker.add(() => {
    skew *= 0.9;
    setSkew(skew);
    if (Math.abs(loop.timeScale() - 1) > 0.01) loop.timeScale(loop.timeScale() + (1 - loop.timeScale()) * 0.05);
  });
}

export function initSplits(reduced) {
  if (reduced) return;
  document.querySelectorAll('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      linesClass: 'split-line',
      wordsClass: 'split-word',
      onSplit(self) {
        return gsap.from(self.words, {
          yPercent: 115,
          rotate: 4,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      },
    });
  });
}

export function initReveals(reduced) {
  const els = gsap.utils.toArray('[data-reveal]');
  if (reduced) {
    gsap.set(els, { opacity: 1, y: 0 });
    return;
  }
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }),
  });
}

export function initParallax(reduced) {
  if (reduced) return;
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    let n = null;
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (st) => {
        n ||= el.querySelector('img');
        if (n) n.style.transform = `translate3d(0, ${((st.progress - 0.5) * 16).toFixed(2)}%, 0)`;
      },
    });
  });
}

export function initFooter(reduced) {
  const fill = document.querySelector('[data-footer-fill]');
  const inner = document.querySelector('[data-footer-fill-inner]');
  if (!fill || !inner) return;
  if (reduced) {
    gsap.set([fill, inner], { yPercent: 0 });
    return;
  }
  // Il riempimento sale dal basso: due transform opposti, nessun repaint del testo.
  gsap.timeline({ scrollTrigger: { trigger: '[data-footer]', start: 'top 70%', end: 'bottom bottom', scrub: 0.5 } })
    .fromTo(fill, { yPercent: 100 }, { yPercent: 0, ease: 'none' }, 0)
    .fromTo(inner, { yPercent: -100 }, { yPercent: 0, ease: 'none' }, 0);
}

export function initActionBar() {
  const bar = document.querySelector('.action-bar');
  if (!bar) return;
  ScrollTrigger.create({
    trigger: '[data-hero]',
    start: 'bottom 80%',
    endTrigger: '[data-footer]',
    end: 'top bottom',
    onToggle: (st) => bar.classList.toggle('is-visible', st.isActive),
  });
}
