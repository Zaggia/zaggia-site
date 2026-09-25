import './styles/main.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { bindContent, initHours } from './modules/business.js';
import { hydrateMedia } from './media.js';
import {
  runPreloader, initHeader, initMenu, initAnchors, initCursor, initMagnetic, initMarquee,
  initSplits, initReveals, initParallax, initFooter, initActionBar,
} from './modules/ui.js';
import { initSupli } from './modules/supli.js';
import { initBuilder } from './modules/builder.js';
import { initDough, initGallery, initFry, initDelivery, initParty, initRing, initMap } from './modules/sections.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
document.documentElement.classList.add('js');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 899px), (pointer: coarse)').matches;

let lenis = null;
let hero = null;
// Stato condiviso dell'hero: la timeline di scroll esiste subito, la scena 3D lo legge quando è pronta.
const heroState = { explode: 0, spin: 0, tilt: 0, zoom: 0, introY: reduced ? 0 : -2.4, introSpin: reduced ? 0 : -0.9 };

function boot() {
  /* Scroll fluido (disattivato con "riduci movimento") */
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    window.__lenis = lenis;
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  bindContent();
  initHours();
  initFry();
  hydrateMedia();

  /* Hero 3D: caricato a parte, mentre il preloader lievita. */
  const heroCanvas = document.querySelector('[data-hero-canvas]');
  const heroReady = import('./modules/hero3d.js')
    .then(({ createHero3D, paintStaticHero }) => {
      try {
        hero = createHero3D({ canvas: heroCanvas, isMobile, reduced, state: heroState });
        return Promise.race([hero.ready, new Promise((r) => setTimeout(r, 3000))]);
      } catch (err) {
        console.warn('WebGL non disponibile, uso la versione statica.', err);
        document.querySelector('[data-hero]').classList.add('hero--static');
        paintStaticHero(heroCanvas);
        return null;
      }
    })
    .catch((err) => console.warn(err));

  const fontsReady = document.fonts?.ready ?? Promise.resolve();

  // L'ordine conta: i pin vanno creati dall'alto verso il basso.
  heroScroll();
  initHeader(lenis);
  initMenu(lenis);
  initAnchors(lenis);
  initCursor();
  initMagnetic();
  initMarquee(lenis, reduced);
  initDough(reduced);
  const builder = initBuilder(reduced);
  initGallery(reduced, builder);
  initSupli(reduced);
  initDelivery(reduced);
  initParty(reduced);
  initRing(reduced);
  initMap();
  initParallax(reduced);
  initFooter(reduced);
  initActionBar();

  runPreloader({ ready: Promise.all([heroReady, fontsReady]), reduced }).then(() => {
    lenis?.start();
    initSplits(reduced);
    initReveals(reduced);
    heroIntro();
    ScrollTrigger.refresh();
  });
}

// Si parte solo quando tutta la pagina è nel DOM, anche se lo script viene
// eseguito prima del contenuto (succede in alcune anteprime di file HTML).
let booted = false;
function tryBoot() {
  if (booted || !document.querySelector('.action-bar a:last-child')) return false;
  booted = true;
  boot();
  return true;
}
if (!tryBoot()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBoot, { once: true });
  } else {
    const mo = new MutationObserver(() => {
      if (document.querySelector('.action-bar a:last-child')) {
        mo.disconnect();
        setTimeout(tryBoot, 0);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function heroIntro() {
  const lines = document.querySelectorAll('[data-hero-split]');
  const fades = document.querySelectorAll('[data-hero-fade]');
  if (reduced) return;
  const split = SplitText.create(lines, { type: 'chars', mask: 'chars' });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(split.chars, { yPercent: 120, rotate: 8, duration: 1.3, stagger: 0.028 }, 0.1)
    .from(fades, { y: 30, opacity: 0, duration: 1, stagger: 0.12 }, 0.6);
  tl.to(heroState, { introY: 0, introSpin: 0, duration: 2.2, ease: 'expo.out' }, 0);
  if (hero) {
    hero.pieces.forEach((p, i) => {
      tl.to(p.userData, { intro: 0, duration: 1.5, ease: 'expo.out' }, 0.25 + (i % 4) * 0.06 + Math.floor(i / 4) * 0.08);
    });
  }
}

function heroScroll() {
  const stage = document.querySelector('[data-hero-stage]');
  const content = document.querySelector('.hero__content');
  const cut = document.querySelector('[data-hero-cut]');
  const others = document.querySelectorAll('.hero__scroll, .hero__hint');

  ScrollTrigger.create({
    trigger: '[data-hero]',
    start: 'top top',
    end: 'bottom top',
    onToggle: (s) => hero?.setRunning(s.isActive),
  });
  if (reduced) return;

  const tl = gsap.timeline({
    scrollTrigger: { trigger: stage, start: 'top top', end: '+=150%', pin: true, scrub: 1 },
  });
  tl.to(content, { y: -140, opacity: 0, ease: 'power2.in', duration: 0.4 }, 0)
    .to(others, { opacity: 0, duration: 0.15 }, 0);
  tl.to(heroState, { explode: 1, spin: 0.85, tilt: 0.28, zoom: 0.25, ease: 'none', duration: 1 }, 0);
  tl.fromTo(cut, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }, 0.35)
    .to(cut, { opacity: 0, y: -60, duration: 0.2 }, 0.85);
}
