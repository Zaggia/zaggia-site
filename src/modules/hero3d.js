// Scena 3D dell'hero: una teglia romana vera, tagliata in 12 tranci.
// Lo scroll la "scompone", il mouse la inclina e sposta la luce,
// il click su un trancio lo fa saltare. Tutte le texture sono generate.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { renderPizza, renderHeight, renderCrumb, drawItem, RECIPES } from '../lib/pizza-art.js';
import { mulberry32 } from '../lib/noise.js';

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

export function createHero3D({ canvas, isMobile, reduced, state }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const camTarget = new THREE.Vector3(0, -0.1, 0);

  /* ---------- Texture procedurali ---------- */
  const TW = isMobile ? 1536 : 2048;
  const TH = Math.round((TW * D) / W);
  const cm = TW / 60;
  const colorC = canvas2d(TW, TH);
  renderPizza(colorC.getContext('2d'), { x: 0, y: 0, w: TW, h: TH }, cm, RECIPES.margherita, 11);
  const heightC = canvas2d(TW / 2, TH / 2);
  renderHeight(heightC.getContext('2d'), { x: 0, y: 0, w: TW / 2, h: TH / 2 }, cm / 2, RECIPES.margherita, 11);
  const crumbC = renderCrumb(512, 96, 3);

  const map = new THREE.CanvasTexture(colorC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bump = new THREE.CanvasTexture(heightC);
  const crumbTex = new THREE.CanvasTexture(crumbC);
  crumbTex.colorSpace = THREE.SRGBColorSpace;

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
  base.receiveShadow = true;
  tray.add(base);
  const wallH = 0.4;
  const wallGeoX = new THREE.BoxGeometry(W + 0.34, wallH, 0.05);
  const wallGeoZ = new THREE.BoxGeometry(0.05, wallH, D + 0.24);
  for (const s of [-1, 1]) {
    const wx = new THREE.Mesh(wallGeoX, steel);
    wx.position.set(0, wallH / 2, s * (D / 2 + 0.145));
    wx.castShadow = wx.receiveShadow = true;
    tray.add(wx);
    const wz = new THREE.Mesh(wallGeoZ, steel);
    wz.position.set(s * (W / 2 + 0.145), wallH / 2, 0);
    wz.castShadow = wz.receiveShadow = true;
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
      top.castShadow = true;
      const body = new THREE.Mesh(bodyGeo, [crumbMat, crumbMat, bottomMat, bottomMat, crumbMat, crumbMat]);
      body.castShadow = true;
      body.receiveShadow = true;
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
  const mozzMat = new THREE.MeshPhysicalMaterial({ color: 0xf8f1e3, roughness: 0.45, sheen: 0.4 });
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
    mesh.castShadow = false;
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
  key.castShadow = !isMobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
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

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
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
  function onMove(ev) {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (ev.clientY / window.innerHeight) * 2 - 1;
    if (ev.pointerType === 'mouse') {
      const p = pickPiece(ev);
      if (p !== hovered) {
        if (hovered) hovered.userData.hoverTarget = 0;
        hovered = p;
        if (p) p.userData.hoverTarget = 1;
        canvas.style.cursor = p ? 'pointer' : '';
        canvas.dispatchEvent(new CustomEvent('piecehover', { detail: !!p, bubbles: true }));
      }
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

  function tick(timestamp) {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;

    const e = easeInOut(clamp01(state.explode));
    root.position.set(layout.x - e * layout.shift, layout.y + state.introY + Math.sin(t * 0.8) * 0.05 + e * layout.lift, 0);
    root.rotation.y = layout.rotY + state.spin + state.introSpin + pointer.sx * 0.28;
    teglia.rotation.x = state.tilt + pointer.sy * 0.1;
    teglia.rotation.z = -pointer.sx * 0.04;

    for (const p of pieces) {
      const u = p.userData;
      const ex = Math.max(e, easeInOut(clamp01(u.intro)));
      u.hover += (u.hoverTarget - u.hover) * 0.15;
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
    if (on === running) return;
    running = on;
    if (on) timer.reset?.();
    renderer.setAnimationLoop(on ? tick : null);
  }

  const ready = new Promise((res) => (firstFrame = res));
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
      renderer.dispose();
    },
  };
}

// Senza WebGL: la stessa pizza disegnata in 2D, inclinata con CSS.
export function paintStaticHero(canvas) {
  const w = Math.min(window.innerWidth * (window.devicePixelRatio || 1), 1800);
  const h = Math.round((w * 2) / 3);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const m = w * 0.18;
  const pw = w - m * 2;
  const ph = (pw * 2) / 3;
  ctx.fillStyle = '#161616';
  ctx.fillRect(m - 12, (h - ph) / 2 - 12, pw + 24, ph + 24);
  renderPizza(ctx, { x: m, y: (h - ph) / 2, w: pw, h: ph }, pw / 60, RECIPES.margherita, 11);
  canvas.style.transform = 'perspective(1200px) rotateX(45deg) rotateZ(-12deg) scale(1.05)';
  canvas.style.objectFit = 'contain';
}
