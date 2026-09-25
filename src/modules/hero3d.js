// Scena 3D dell'hero: una teglia romana vera, tagliata in 12 tranci.
// Lo scroll la "scompone", il mouse la inclina e sposta la luce,
// il click su un trancio lo fa saltare. Tutte le texture sono generate.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { renderPizza, renderHeight, renderCrumb, drawItem, RECIPES } from '../lib/pizza-art.js';
import { mulberry32 } from '../lib/noise.js';
import { getArtURL } from '../lib/art-client.js';

const COLS = 4;
const ROWS = 3;
const W = 6; // 60 cm
const D = 4; // 40 cm
const T = 0.22;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Ombre e dettagli costano: la qualità parte da un budget di pixel e scende
// da sola se il dispositivo non regge i 40 fps (0 = piena … 3 = versione statica).
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function createHero3D({ canvas, isMobile, reduced, state, textures, onStatic }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  let quality = 0;
  // ?qualita=alta forza il 3D pieno (demo su un computer potente, test).
  const forced = /[?&]qualita=alta\b/.test(location.search);
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '';
    if (SOFTWARE_GPU.test(name) && !forced) quality = 2;
  } catch {
    /* nessuna informazione: si parte dalla qualità piena */
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const camTarget = new THREE.Vector3(0, -0.1, 0);

  /* ---------- Texture procedurali ---------- */
  // Di norma arrivano già pronte dal worker (ImageBitmap capovolte);
  // altrimenti si disegnano qui.
  const tex = (img, srgb) => {
    const t = img instanceof ImageBitmap ? new THREE.Texture(img) : new THREE.CanvasTexture(img);
    if (img instanceof ImageBitmap) {
      t.flipY = false;
      t.needsUpdate = true;
    }
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  let src = textures;
  if (!src) {
    const TW = heroTextureWidth(isMobile);
    const TH = Math.round((TW * D) / W);
    const cm = TW / 60;
    const colorC = canvas2d(TW, TH);
    renderPizza(colorC.getContext('2d'), { x: 0, y: 0, w: TW, h: TH }, cm, RECIPES.margherita, 11);
    const heightC = canvas2d(TW / 2, TH / 2);
    renderHeight(heightC.getContext('2d'), { x: 0, y: 0, w: TW / 2, h: TH / 2 }, cm / 2, RECIPES.margherita, 11);
    src = { color: colorC, height: heightC, crumb: renderCrumb(512, 96, 3) };
  }
  const map = tex(src.color, true);
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bump = tex(src.height, false);
  const crumbTex = tex(src.crumb, true);

  const topMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.58, metalness: 0 });
  const crumbMat = new THREE.MeshStandardMaterial({ map: crumbTex, roughness: 0.85 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0x7a3f16, roughness: 0.9 });

  /* ---------- Teglia ---------- */
  const root = new THREE.Group();
  scene.add(root);
  const teglia = new THREE.Group();
  root.add(teglia);

  const steel = new THREE.MeshStandardMaterial({ color: 0x1c1c1f, metalness: 0.92, roughness: 0.34, transparent: true });
  const tray = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.05, D + 0.24), steel);
  base.position.y = 0.025;
  tray.add(base);
  const wallH = 0.4;
  const wallGeoX = new THREE.BoxGeometry(W + 0.34, wallH, 0.05);
  const wallGeoZ = new THREE.BoxGeometry(0.05, wallH, D + 0.24);
  for (const s of [-1, 1]) {
    const wx = new THREE.Mesh(wallGeoX, steel);
    wx.position.set(0, wallH / 2, s * (D / 2 + 0.145));
    tray.add(wx);
    const wz = new THREE.Mesh(wallGeoZ, steel);
    wz.position.set(s * (W / 2 + 0.145), wallH / 2, 0);
    tray.add(wz);
  }
  teglia.add(tray);

  // Ombra di contatto morbida sotto la teglia (più leggera di una shadow map).
  const shadowC = canvas2d(256, 256);
  {
    const g = shadowC.getContext('2d').createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    const sctx = shadowC.getContext('2d');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.7, D * 1.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowC), transparent: true, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.3;
  root.add(contact);

  /* ---------- Tranci ---------- */
  const rand = mulberry32(42);
  const pieces = [];
  const pw = W / COLS;
  const pd = D / ROWS;
  const bodyGeo = new THREE.BoxGeometry(pw * 0.996, T, pd * 0.996);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const g = new THREE.PlaneGeometry(pw * 0.996, pd * 0.996, 1, 1);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (c + uv.getX(i)) / COLS, 1 - (r + 1) / ROWS + uv.getY(i) / ROWS);
      }
      const top = new THREE.Mesh(g, topMat);
      top.rotation.x = -Math.PI / 2;
      top.position.y = T / 2 + 0.002;
      const body = new THREE.Mesh(bodyGeo, [crumbMat, crumbMat, bottomMat, bottomMat, crumbMat, crumbMat]);
      const piece = new THREE.Group();
      piece.add(body, top);
      const home = new THREE.Vector3(-W / 2 + (c + 0.5) * pw, 0.05 + T / 2, -D / 2 + (r + 0.5) * pd);
      piece.position.copy(home);
      const dir = new THREE.Vector3(home.x, 0, home.z * 1.35).normalize();
      piece.userData = {
        home,
        dir,
        spread: 0.8 + rand() * 0.8,
        lift: 0.5 + rand() * 1.6,
        rot: new THREE.Vector3((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.6, (rand() - 0.5) * 1.4),
        intro: reduced ? 0 : 1,
        hop: 0,
        hover: 0,
        hoverTarget: 0,
      };
      top.userData.piece = piece;
      body.userData.piece = piece;
      teglia.add(piece);
      pieces.push(piece);
    }
  }

  /* ---------- Ingredienti che fluttuano ---------- */
  const floats = [];
  const leafC = canvas2d(256, 128);
  drawItem(leafC.getContext('2d'), { type: 'basilico', x: 128, y: 64, rot: 0, s: 1, seed: 3, cm: 52 });
  const leafMat = new THREE.MeshStandardMaterial({
    map: new THREE.CanvasTexture(leafC), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55,
  });
  leafMat.map.colorSpace = THREE.SRGBColorSpace;
  const leafGeo = new THREE.PlaneGeometry(0.95, 0.475);
  const tomatoMat = new THREE.MeshPhysicalMaterial({ color: 0xd3321a, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
  const tomatoGeo = new THREE.SphereGeometry(0.2, 32, 20);
  const mozzMat = new THREE.MeshStandardMaterial({ color: 0xf8f1e3, roughness: 0.45 });
  const mozzGeo = new THREE.SphereGeometry(0.17, 32, 20);
  const fr = mulberry32(7);
  const floatCount = isMobile ? 12 : 18;
  for (let i = 0; i < floatCount; i++) {
    const kind = i % 3;
    const mesh = kind === 0 ? new THREE.Mesh(leafGeo, leafMat) : kind === 1 ? new THREE.Mesh(tomatoGeo, tomatoMat) : new THREE.Mesh(mozzGeo, mozzMat);
    if (kind === 2) mesh.scale.set(1, 0.82, 1);
    const a = (i / floatCount) * Math.PI * 2 + fr() * 0.4;
    const rad = 4.2 + fr() * 1.8;
    const base = new THREE.Vector3(Math.cos(a) * rad, -0.6 + fr() * 2.6, Math.sin(a) * rad * 0.7);
    mesh.position.copy(base);
    mesh.userData = { base, phase: fr() * Math.PI * 2, speed: 0.4 + fr() * 0.6, spin: (fr() - 0.5) * 0.8, scale: 0.7 + fr() * 0.6 };
    mesh.scale.multiplyScalar(mesh.userData.scale);
    root.add(mesh);
    floats.push(mesh);
  }

  // Farina nell'aria.
  const flourCount = isMobile ? 160 : 320;
  const flourGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(flourCount * 3);
  for (let i = 0; i < flourCount; i++) {
    fp[i * 3] = (fr() - 0.5) * 16;
    fp[i * 3 + 1] = (fr() - 0.3) * 7;
    fp[i * 3 + 2] = (fr() - 0.5) * 12;
  }
  flourGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const dotC = canvas2d(64, 64);
  {
    const dctx = dotC.getContext('2d');
    const g = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,245,225,1)');
    g.addColorStop(1, 'rgba(255,245,225,0)');
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, 64, 64);
  }
  const flour = new THREE.Points(flourGeo, new THREE.PointsMaterial({
    size: 0.06, map: new THREE.CanvasTexture(dotC), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  root.add(flour);

  /* ---------- Luci ---------- */
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x1a0e08, 0.55));
  const key = new THREE.DirectionalLight(0xffd6a8, 2.8);
  key.position.set(3.5, 7, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5530, 2.2);
  rim.position.set(-6, 2.5, -5);
  scene.add(rim);
  const hoverLight = new THREE.PointLight(0xffb070, 10, 9, 1.6);
  hoverLight.position.set(0, 2.2, 1);
  root.add(hoverLight);

  /* ---------- Stato guidato da scroll e intro ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, over: false };
  let layout = { x: 0, y: 0, dist: 11, rotY: -0.42 };

  let cssW = 1;
  let cssH = 1;
  function applyPixelRatio() {
    const budget = isMobile ? 1.1e6 : 2.4e6;
    let dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75, Math.sqrt(budget / (cssW * cssH)));
    if (quality === 1) dpr *= 0.75;
    if (quality >= 2) dpr = Math.min(dpr * 0.55, 0.8);
    renderer.setPixelRatio(Math.max(0.5, dpr));
    renderer.setSize(cssW, cssH, false);
  }
  function resize() {
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    applyPixelRatio();
    camera.aspect = cssW / cssH;
    const a = camera.aspect;
    if (a >= 1.15) {
      const x = Math.min(2.4, 0.9 + (a - 1.15) * 1.6);
      layout = { x, y: 0.2, dist: 12.2, rotY: -0.42, shift: x + 1.2, lift: 1.1 };
    } else {
      layout = { x: 0, y: 1.9, dist: (12.5 / Math.max(a, 0.46)) * 0.74, rotY: -0.3, shift: 0, lift: 0.6 };
    }
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------- Interazione ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  function pickPiece(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pieces, true)[0];
    return hit?.object.userData.piece || null;
  }
  // Il mouse può mandare centinaia di eventi al secondo: si registra solo
  // l'ultimo e il raycast si fa dentro il frame, una volta sola.
  let lastMouse = null;
  function onMove(ev) {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (ev.clientY / window.innerHeight) * 2 - 1;
    if (ev.pointerType === 'mouse') lastMouse = { clientX: ev.clientX, clientY: ev.clientY };
  }
  function updateHover() {
    if (!lastMouse) return;
    const p = pickPiece(lastMouse);
    lastMouse = null;
    if (p !== hovered) {
      if (hovered) hovered.userData.hoverTarget = 0;
      hovered = p;
      if (p) p.userData.hoverTarget = 1;
      canvas.style.cursor = p ? 'pointer' : '';
      canvas.dispatchEvent(new CustomEvent('piecehover', { detail: !!p, bubbles: true }));
    }
  }
  const hops = [];
  function onClick(ev) {
    const p = pickPiece(ev);
    if (!p || p.userData.hop > 0) return;
    hops.push({ piece: p, t: 0 });
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('click', onClick);

  /* ---------- Loop ---------- */
  const timer = new THREE.Timer();
  const tmp = new THREE.Vector3();
  let running = false;
  let firstFrame = null;
  let staticMode = false;

  // Monitor: media dei frame su finestre di 60; sotto i 40 fps si scende di livello.
  // warmup in secondi: i primi istanti (caricamento texture, shader) non contano.
  const perf = { frames: 0, sum: 0, warmup: 0.6 };
  function setQuality(q) {
    quality = q;
    if (q >= 3) return goStatic();
    flour.visible = q < 1;
    for (const f of floats) f.visible = q < 2;
    // Intensità a zero, non visible=false: cambiare il numero di luci
    // costringe a ricompilare tutti gli shader (scatto di centinaia di ms).
    hoverLight.intensity = q < 2 ? 10 : 0;
    applyPixelRatio();
    perf.frames = perf.sum = 0;
    perf.warmup = 0.3;
  }
  function watchPerf(rawDt) {
    if (forced) return;
    if (perf.warmup > 0) {
      perf.warmup -= rawDt;
      return;
    }
    perf.frames++;
    perf.sum += rawDt;
    // Giudizio dopo 60 frame, oppure dopo ~1 s se i frame sono lentissimi.
    if (perf.frames < 60 && !(perf.sum > 0.75 && perf.frames >= 3)) return;
    const avg = perf.sum / perf.frames;
    perf.frames = perf.sum = 0;
    if (avg > 1 / 12) setQuality(3);
    else if (avg > 1 / 40) setQuality(quality + 1);
  }
  function goStatic() {
    if (staticMode) return;
    staticMode = true;
    setRunning(false);
    onStatic?.();
  }

  function tick(timestamp) {
    timer.update(timestamp);
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const t = timer.getElapsed();
    watchPerf(rawDt);
    updateHover();
    const k = 1 - Math.exp(-dt * 3.6);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;

    const e = easeInOut(clamp01(state.explode));
    root.position.set(layout.x - e * layout.shift, layout.y + state.introY + Math.sin(t * 0.8) * 0.05 + e * layout.lift, 0);
    root.rotation.y = layout.rotY + state.spin + state.introSpin + pointer.sx * 0.28;
    teglia.rotation.x = state.tilt + pointer.sy * 0.1;
    teglia.rotation.z = -pointer.sx * 0.04;

    for (const p of pieces) {
      const u = p.userData;
      const ex = Math.max(e, easeInOut(clamp01(u.intro)));
      u.hover += (u.hoverTarget - u.hover) * (1 - Math.exp(-dt * 9));
      tmp.copy(u.dir).multiplyScalar(u.spread * ex * 1.05);
      p.position.set(u.home.x + tmp.x, u.home.y + u.lift * ex + u.hover * 0.18 + u.hop, u.home.z + tmp.z);
      p.rotation.set(u.rot.x * ex, u.rot.y * ex + u.hop * 2.2, u.rot.z * ex);
    }
    for (let i = hops.length - 1; i >= 0; i--) {
      const h = hops[i];
      h.t += dt / 0.9;
      h.piece.userData.hop = Math.sin(Math.min(h.t, 1) * Math.PI) * 1.2;
      if (h.t >= 1) {
        h.piece.userData.hop = 0;
        hops.splice(i, 1);
      }
    }

    tray.position.y = -e * 1.4;
    steel.opacity = 1 - e * 0.85;
    contact.material.opacity = 1 - e;

    for (const f of floats) {
      const u = f.userData;
      f.position.set(
        u.base.x * (1 + e * 0.5),
        u.base.y + Math.sin(t * u.speed + u.phase) * 0.25 + e * 1.2,
        u.base.z * (1 + e * 0.5),
      );
      f.rotation.x = t * u.spin + u.phase;
      f.rotation.y = t * u.spin * 0.7;
    }
    flour.rotation.y = t * 0.02;
    flour.position.y = Math.sin(t * 0.3) * 0.2;

    hoverLight.position.set(pointer.sx * 4, 2.2, pointer.sy * 3 + 1);

    const dist = layout.dist * (1 - state.zoom * 0.18);
    camera.position.set(0, dist * 0.62, dist * 0.78);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame();
      firstFrame = null;
    }
  }

  function setRunning(on) {
    if (staticMode) on = false;
    if (on === running) return;
    running = on;
    if (on) {
      timer.reset?.();
      perf.frames = perf.sum = 0;
      perf.warmup = 0.3;
    }
    renderer.setAnimationLoop(on ? tick : null);
  }

  const ready = new Promise((res) => (firstFrame = res));
  if (quality) setQuality(quality);
  setRunning(true);

  return {
    state,
    pieces,
    ready,
    setRunning,
    dispose() {
      setRunning(false);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      // Libera la GPU perdendo il contesto: nessuna chiamata GL dopo lo stop.
      renderer.forceContextLoss();
    },
  };
}

// Senza WebGL: la stessa pizza disegnata in 2D, inclinata con CSS.
export function heroTextureWidth(isMobile) {
  return isMobile ? 1536 : 2048;
}

// Senza WebGL (o su dispositivi troppo lenti): la stessa teglia come immagine,
// disegnata dal worker e inclinata con CSS. Nessun lavoro sul thread principale.
export function staticHeroImage() {
  const img = new Image();
  img.className = 'hero__canvas hero__static';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  getArtURL('teglia:margherita', 'l').then((u) => (img.src = u));
  return img;
}
