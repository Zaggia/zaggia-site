/* Burger's Bró – hamburger 3D nell'hero: si monta all'apertura e si scompone scorrendo.
   Modello: "Exploding Cheeseburger" (Microsoft Remix 3D, CC0, raccolto nell'Open Asset Kit di Ethereal Engine),
   ottimizzato: texture a 1024 px in WebP e solo l'animazione "open", legata allo scorrimento della pagina. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const host = document.getElementById('burger3d');
const hero = document.getElementById('hero');
const labelsEl = document.getElementById('burgerLabels');
const copyEl = hero && hero.querySelector('.hero__copy');
const words = hero ? Array.from(hero.querySelectorAll('.hero__word')) : [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Strati indicati dalle etichette: osso del modello da seguire e nome in menu
const LAYERS = [
  { bone: 'Top_bread_jnt', text: 'Panino' },
  { bone: 'Onion_2_jnt', text: 'Cipolla' },
  { bone: 'Tomato_1_jnt', text: 'Pomodoro' },
  { bone: 'lettuce_1_1_jnt', text: 'Insalata' },
  { bone: 'cheese_mid_jnt', text: 'Formaggio' },
  { bone: 'Patty_jnt', text: 'Hamburger' }
];
const PEAK = 2.3; // secondo dell'animazione "open" in cui gli strati sono più distanziati
const K_TILT = 0.2;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (host && hero && webgl()) init().catch(err => { console.warn('Burger 3D non disponibile:', err); host.classList.remove('is-3d'); });

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.62, 4.9);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffe3b8, 1.9); key.position.set(2.5, 3.2, 2.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf4c21b, 2.6); rim.position.set(-2.8, 1.2, -2.4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd63a2a, 0.5); fill.position.set(-3, -1, 2); scene.add(fill);

  const gltf = await new GLTFLoader().loadAsync('models/burger.glb');
  const model = gltf.scene;
  const clip = gltf.animations[0];
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const skinned = [];
  model.traverse(o => {
    if (o.isSkinnedMesh) { o.frustumCulled = false; skinned.push(o); }
    if (o.isMesh && o.material) for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap']) if (o.material[k]) o.material[k].anisotropy = maxAniso;
  });

  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });

  // altezza e centro del panino chiuso (t = 0) e aperto (t = PEAK), in unità del modello
  function poseBox(t) {
    action.time = t; mixer.update(0); model.updateMatrixWorld(true);
    const b = new THREE.Box3();
    skinned.forEach(m => { m.computeBoundingBox(); b.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
    return b;
  }
  const bc = poseBox(0), bo = poseBox(PEAK);
  const szC = bc.getSize(new THREE.Vector3()), szO = bo.getSize(new THREE.Vector3());
  const ctC = bc.getCenter(new THREE.Vector3()), ctO = bo.getCenter(new THREE.Vector3());
  const unit = 1 / Math.max(szC.x, szC.z);           // il panino chiuso è largo 1
  const closedH = szC.y * unit, openH = szO.y * unit;
  model.scale.setScalar(unit);

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
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  rig.add(shadow);

  // etichette degli strati
  const layers = LAYERS.map((L, i) => {
    // i nomi nel file hanno un suffisso numerico (es. Top_bread_jnt.15): si cerca per prefisso
    const bone = Object.values(bones).find(b => b.name.startsWith(L.bone));
    if (!bone) return null;
    const li = document.createElement('li');
    li.innerHTML = `<span>${L.text}</span>`;
    labelsEl.appendChild(li);
    return { ...L, bone, li, side: i % 2 ? -1 : 1 };
  }).filter(Boolean);

  host.appendChild(renderer.domElement);
  host.classList.add('is-3d');

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
    if (narrow) {
      // telefono: a riposo sotto i pulsanti, scomposto al centro e spostato a sinistra per le etichette
      const vh = H;
      const cta = copyEl && copyEl.querySelector('.hero__cta');
      const ctaBottom = cta ? copyEl.offsetTop + cta.offsetTop + cta.offsetHeight : vh * 0.55;
      const free = Math.max(0.2, (vh - ctaBottom) / vh - 0.07);
      pose.rs = Math.min(0.66 * visW, (free * 0.8) * visH / closedH);
      pose.ry = (0.5 - (ctaBottom / vh + free * 0.5 + 0.02)) * visH;
      pose.xs = Math.min(0.5 * visW, 0.7 * visH / openH);
      pose.xy = (0.5 - 0.47) * visH;
      pose.xx = -visW * 0.22;
    } else {
      pose.rs = Math.min(1.2, 0.5 * visW, 0.42 * visH / closedH);
      pose.ry = 0;
      pose.xs = Math.min(pose.rs * 0.9, 0.76 * visH / openH);
      pose.xy = -0.03 * visH;
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
  let last = t0, running = false, explodeS = 0, angle = 0.5;
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
    if (!reduce) angle += dt * (0.3 - e * 0.16);
    spin.rotation.y = angle;
    tilt.rotation.x = K_TILT + e * 0.1 + pointer.y * 0.12;
    tilt.rotation.z = -pointer.x * 0.05;
    rig.rotation.y = pointer.x * 0.25;

    // animazione "open" guidata dallo scorrimento
    action.time = e * PEAK;
    mixer.update(0);
    // il panino resta centrato: si sposta il modello in base alla posa corrente
    const c = ctC.clone().lerp(ctO, e);
    model.position.set(-c.x * unit, -c.y * unit, -c.z * unit);

    const s = lerp(pose.rs, pose.xs, e);
    rig.scale.setScalar(s);
    rig.position.x = pose.xx * smooth(0.1, 0.7, e);
    rig.position.y = lerp(pose.ry, pose.xy, e) + (reduce ? 0 : Math.sin(t * 1.3) * 0.02 * s);
    const h = lerp(closedH, openH, e);
    shadow.position.y = -h / 2 - 0.02;
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
    const radius = 0.5 * 1.12;
    layers.forEach(L => {
      L.bone.getWorldPosition(v);
      const side = narrow ? 1 : L.side;
      // l'altezza segue l'osso; il lato è fisso a destra o a sinistra del panino
      rig.worldToLocal(v);
      v.x = side * radius; v.z = 0;
      rig.localToWorld(v);
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
