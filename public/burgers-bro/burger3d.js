/* Burger's Bró – hamburger 3D nell'hero: si monta all'apertura e si scompone scorrendo.
   Modello: "Ultimate Food Pack" di Quaternius (CC0), convertito in GLB con un nodo per ogni pezzo. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const host = document.getElementById('burger3d');
const hero = document.getElementById('hero');
const labelsEl = document.getElementById('burgerLabels');
const copyEl = hero && hero.querySelector('.hero__copy');
const words = hero ? Array.from(hero.querySelectorAll('.hero__word')) : [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Strati del Burger's Bró del menu (triplo hamburger, cheddar, insalata iceberg, pomodoro…)
// pick: quale dei due strati uguali del modello (sopra o sotto) indicare con l'etichetta
const LAYERS = [
  { mat: 'LightYellow', pick: 'top', text: 'Panino' },
  { mat: 'LightGreen', pick: 'top', text: 'Insalata Iceberg' },
  { mat: 'Yellow', pick: 'top', text: 'Cheddar' },
  { mat: 'Red', pick: 'bottom', text: 'Pomodoro' },
  { mat: 'Brown', pick: 'bottom', text: 'Hamburger' }
];
const COLORS = { LightYellow: 0xd99848, White: 0xfff2d6, Brown: 0x5a321d, Yellow: 0xf7b51c, Red: 0xd63f2b, LightGreen: 0x79c043 };
const ROUGH = { LightYellow: 0.55, White: 0.6, Brown: 0.72, Yellow: 0.32, Red: 0.28, LightGreen: 0.45 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (host && hero && webgl()) init().catch(err => { console.warn('Burger 3D non disponibile:', err); host.classList.remove('is-3d'); });

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.62, 4.9);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffe0b0, 2.4); key.position.set(2.5, 3.2, 2.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf4c21b, 3.2); rim.position.set(-2.8, 1.2, -2.4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd63a2a, 0.9); fill.position.set(-3, -1, 2); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1a10, 0.55));

  const gltf = await new GLTFLoader().loadAsync('models/burger.glb');
  const model = gltf.scene;
  const pieces = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    const name = o.material.name;
    o.material = new THREE.MeshStandardMaterial({ color: COLORS[name] ?? 0xcccccc, roughness: ROUGH[name] ?? 0.6, metalness: 0, flatShading: true });
    o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new THREE.Vector3());
    pieces.push({ mesh: o, mat: name, cy: c.y, y0: o.position.y, spin: (Math.random() - 0.5) * 0.5 });
  });
  // i semi di sesamo seguono il panino di sopra
  const buns = pieces.filter(p => p.mat === 'LightYellow');
  const topBun = buns.reduce((a, b) => (b.cy > a.cy ? b : a), buns[0]);
  pieces.forEach(p => { if (p.mat === 'White') { p.cy = topBun.cy; p.spin = topBun.spin; } });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.y = -size.y / 2; // centro verticale (il modello va da y=0 a y=1)

  const tilt = new THREE.Group(); // inclinazione verso la camera e parallasse
  const spin = new THREE.Group(); // rotazione continua
  const rig = new THREE.Group();  // posizione e scala
  spin.add(model); tilt.add(spin); rig.add(tilt); scene.add(rig);

  // ombra morbida
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const g = sc.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  rig.add(shadow);

  // etichette degli strati
  const layers = LAYERS.map((L, i) => {
    const all = pieces.filter(p => p.mat === L.mat);
    if (!all.length) return null;
    const ys = all.map(p => p.cy);
    const lim = L.pick === 'top' ? Math.max(...ys) - 0.08 : Math.min(...ys) + 0.08;
    const ps = all.filter(p => (L.pick === 'top' ? p.cy >= lim : p.cy <= lim));
    const cy = ps.reduce((a, p) => a + p.cy, 0) / ps.length;
    const li = document.createElement('li');
    li.innerHTML = `<span>${L.text}</span>`;
    labelsEl.appendChild(li);
    return { ...L, cy, li, side: i % 2 ? -1 : 1 };
  }).filter(Boolean);

  host.appendChild(renderer.domElement);
  host.classList.add('is-3d');

  const K = 1.6; // quanto si allontanano gli strati
  let W = 1, H = 1, narrow = false, visH = 1, visW = 1;
  // posa a riposo (r) e scomposta (x): scala e posizione verticale/orizzontale in unità del mondo
  const pose = { rs: 1, xs: 1, ry: 0, xy: 0, xx: 0 };
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    narrow = window.innerWidth < 720;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    const tall = 1 + K * 0.75; // altezza da scomposto rispetto a quella da montato
    if (narrow) {
      // telefono: a riposo sotto i pulsanti, scomposto al centro e spostato a sinistra per le etichette
      const vh = H; // la tela copre tutta l'altezza dello schermo dell'hero
      const cta = copyEl && copyEl.querySelector('.hero__cta');
      const ctaBottom = cta ? copyEl.offsetTop + cta.offsetTop + cta.offsetHeight : vh * 0.55;
      const free = Math.max(0.2, (vh - ctaBottom) / vh - 0.07);
      pose.rs = Math.min(0.66 * visW / size.x, (free * 0.8) * visH / size.y);
      pose.ry = (0.5 - (ctaBottom / vh + free * 0.5 + 0.02)) * visH;
      pose.xs = Math.min(0.5 * visW / size.x, 0.64 * visH / (size.y * tall));
      pose.xy = (0.5 - 0.47) * visH;
      pose.xx = -visW * 0.22;
    } else {
      pose.rs = Math.min(1.05, 0.52 * visW / size.x, 0.42 * visH / size.y);
      pose.ry = 0;
      pose.xs = Math.min(pose.rs * 0.85, 0.8 * visH / (size.y * tall));
      pose.xy = -0.04 * visH;
      pose.xx = 0;
    }
  }
  resize();
  new ResizeObserver(resize).observe(host);
  if (document.fonts) document.fonts.ready.then(resize);

  // input
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let progress = 0;
  const readScroll = () => {
    const r = hero.getBoundingClientRect();
    progress = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  const t0 = performance.now();
  let last = t0, running = false, explodeS = 0, angle = 0.6;
  const v = new THREE.Vector3();
  const stageEl = hero.querySelector('.hero__stage');

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    const intro = reduce ? 0 : 1 - smooth(0.15, 1.5, t);              // si monta all'apertura
    const target = Math.max(smooth(0.06, 0.55, progress), intro);
    explodeS += (target - explodeS) * Math.min(1, dt * 7);
    const e = explodeS;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    if (!reduce) angle += dt * (0.32 - e * 0.18);
    spin.rotation.y = angle;
    tilt.rotation.x = 0.18 + e * 0.12 + pointer.y * 0.12;
    tilt.rotation.z = -pointer.x * 0.06;
    rig.rotation.y = pointer.x * 0.25;
    const k = K;
    pieces.forEach(p => {
      p.mesh.position.y = p.y0 + (p.cy - 0.5) * k * e;
      p.mesh.rotation.y = p.spin * e;
    });
    const s = pose.rs + (pose.xs - pose.rs) * e;
    rig.scale.setScalar(s);
    rig.position.x = pose.xx * smooth(0.1, 0.7, e);
    rig.position.y = pose.ry + (pose.xy - pose.ry) * e + (reduce ? 0 : Math.sin(t * 1.3) * 0.02 * s);
    shadow.position.y = -size.y / 2 - 0.03 - e * k * 0.5;
    shadow.material.opacity = 1 - e * 0.55;

    // testo dell'hero e scritte di sfondo
    if (copyEl) {
      const fade = smooth(0.05, 0.4, progress);
      copyEl.style.opacity = String(1 - fade * 0.92);
      copyEl.style.transform = `translateY(${-fade * 40}px)`;
      copyEl.style.pointerEvents = fade > 0.6 ? 'none' : '';
    }
    words.forEach((w, i) => { w.style.transform = `translateX(${(i ? 1 : -1) * progress * 12}vw)`; });
    hero.classList.toggle('is-exploded', progress > 0.45);

    renderer.render(scene, camera);

    // etichette: posizione proiettata a fianco di ogni strato
    const show = smooth(0.45, 0.75, e) * (progress > 0.04 ? 1 : 0);
    const hr = host.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    const radius = size.x * 0.5 * 1.08;
    layers.forEach(L => {
      model.localToWorld(v.set(0, L.cy + (L.cy - 0.5) * k * e, 0)); // centro dello strato, già spostato
      const side = narrow ? 1 : L.side;
      v.x = rig.position.x + side * radius * s;
      v.project(camera);
      const x = hr.left - sr.left + (v.x + 1) / 2 * W;
      const y = hr.top - sr.top + (1 - v.y) / 2 * H;
      L.li.classList.toggle('is-left', side < 0);
      L.li.style.transform = `translate(${x}px, ${y}px) translate(${side < 0 ? '-100%' : '0'}, -50%)`;
      L.li.style.opacity = String(show);
    });

    if (visible && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  function loop() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  loop();
}
