/* WebGL gallery corridor: the camera walks past the rooms, hung as framed works, towards the facade. */
(function () {
  const COL = { deep: 0x10211d, wall: 0x142a25, gold: 0xc8a15a, runner: 0x6e2419 };
  const SPACING = 4.4, START_Z = -3;

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 40, 0, 128, 110, 150);
    g.addColorStop(0, 'rgba(255,222,170,0.85)'); g.addColorStop(0.45, 'rgba(255,210,150,0.25)'); g.addColorStop(1, 'rgba(255,210,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function plaqueTexture(title, sub) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#E6DDCB'; x.fillRect(0, 0, 512, 160);
    x.fillStyle = '#1A1714';
    x.font = 'italic 500 52px "Bodoni Moda", Didot, serif'; x.fillText(title, 28, 72);
    x.font = '600 22px "Instrument Sans", Helvetica, sans-serif';
    x.fillStyle = '#6E5E48'; x.fillText(sub.toUpperCase(), 30, 120);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  function runnerTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#5E1F16'; x.fillRect(0, 0, 64, 512);
    x.fillStyle = '#C8A15A'; x.fillRect(4, 0, 3, 512); x.fillRect(57, 0, 3, 512);
    x.fillStyle = 'rgba(200,161,90,.25)';
    for (let y = 0; y < 512; y += 32) { x.beginPath(); x.moveTo(32, y); x.lineTo(40, y + 16); x.lineTo(32, y + 32); x.lineTo(24, y + 16); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); t.encoding = THREE.sRGBEncoding; return t;
  }

  function create(canvas, works, finale) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COL.deep);
    scene.fog = new THREE.Fog(COL.deep, 7, 30);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
    camera.position.set(0, 1.65, 6);

    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x0c1a17, 0.32));
    const keyA = new THREE.PointLight(0xffd9a8, 1.1, 12, 1.8);
    const keyB = new THREE.PointLight(0xffd9a8, 0.8, 12, 1.8);
    scene.add(keyA, keyB);

    const len = works.length * SPACING + 16;
    const midZ = START_Z - len / 2 + 8;
    const wallMat = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.92 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, len),
      new THREE.MeshStandardMaterial({ color: 0x0f1d1a, roughness: 0.28, metalness: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = midZ; scene.add(floor);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, len),
      new THREE.MeshStandardMaterial({ map: runnerTexture(), roughness: 0.95 }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.005, midZ); scene.add(runner);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, len), new THREE.MeshStandardMaterial({ color: 0x0c1916, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.4, midZ); scene.add(ceil);
    [-3.5, 3.5].forEach(x => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 4.4), wallMat);
      wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      wall.position.set(x, 2.2, midZ); scene.add(wall);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len),
        new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 0.9, roughness: 0.35 }));
      rail.position.set(x + (x < 0 ? 0.02 : -0.02), 0.95, midZ); scene.add(rail);
      const rail2 = rail.clone(); rail2.position.y = 3.6; scene.add(rail2);
    });
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffe6c2 });
    for (let z = 4; z > START_Z - len + 10; z -= 3) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.08), stripMat);
      s.position.set(0, 4.38, z); scene.add(s);
    }

    const glow = glowTexture();
    const goldMat = new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 0.85, roughness: 0.3 });
    const loader = new THREE.TextureLoader();

    function hang(work, pos, rotY, w, h) {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, h + 0.22, 0.08), goldMat);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1), new THREE.MeshBasicMaterial({ color: 0xe9e1d0 }));
      mat.position.z = 0.041;
      const artMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const setMap = t => { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; artMat.map = t; artMat.needsUpdate = true; };
      setMap(new THREE.CanvasTexture(work.canvas));
      if (work.photo) loader.load(work.photo, setMap, undefined, () => {});
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.position.z = 0.043;
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, h * 1.9),
        new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
      wash.position.set(0, h * 0.25, -0.02);
      const lampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, w * 0.6, 12), goldMat);
      lampBar.rotation.z = Math.PI / 2; lampBar.position.set(0, h / 2 + 0.22, 0.16);
      g.add(wash, frame, mat, art, lampBar);
      if (work.title) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.2),
          new THREE.MeshBasicMaterial({ map: plaqueTexture(work.title, work.sub || ''), toneMapped: false }));
        pl.position.set(w / 2 - 0.32, -h / 2 - 0.38, 0.01); g.add(pl);
      }
      g.position.copy(pos); g.rotation.y = rotY; scene.add(g);
      return g;
    }

    works.forEach((wk, i) => {
      const left = i % 2 === 0;
      const z = START_Z - i * SPACING;
      hang(wk, new THREE.Vector3(left ? -3.46 : 3.46, 2.15, z), left ? Math.PI / 2 : -Math.PI / 2, 1.5, 2.0);
    });
    const endZ = START_Z - works.length * SPACING - 3;
    const endWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4), wallMat);
    endWall.position.set(0, 2.2, endZ - 0.05); scene.add(endWall);
    hang(finale, new THREE.Vector3(0, 2.25, endZ), 0, 3.3, 2.48);

    const N = 380, pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 6.4;
      pts[i * 3 + 1] = Math.random() * 4.2;
      pts[i * 3 + 2] = 6 - Math.random() * (len - 4);
    }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8c98e, size: 0.028, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);

    const camEndZ = endZ + 4.4;
    const state = { p: 0, mx: 0, my: 0, tx: 0, ty: 0, running: false, z: 6 };
    const look = new THREE.Vector3();
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 68 : 52;
      camera.updateProjectionMatrix();
    }

    const clock = new THREE.Clock();
    function frame() {
      if (!state.running) return;
      const t = clock.getElapsedTime();
      state.mx += (state.tx - state.mx) * 0.05;
      state.my += (state.ty - state.my) * 0.05;
      const targetZ = 6 + (camEndZ - 6) * ease(state.p);
      state.z += (targetZ - state.z) * 0.08;
      const sway = Math.sin(t * 0.6) * 0.06;
      camera.position.set(state.mx * 0.5 + sway, 1.65 + state.my * 0.15 + Math.sin(t * 1.2) * 0.02, state.z);
      look.set(state.mx * 1.6 * (1 - state.p * 0.6), 1.8 + state.p * 0.45 + state.my * 0.5, state.z - 6);
      camera.lookAt(look);
      keyA.position.set(0, 3.2, state.z - 3);
      keyB.position.set(0, 3.2, state.z - 9);
      dust.rotation.y = Math.sin(t * 0.05) * 0.02;
      dust.position.y = Math.sin(t * 0.3) * 0.08;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    return {
      setProgress(p) { state.p = p; },
      setPointer(x, y) { state.tx = x; state.ty = y; },
      start() { if (!state.running) { state.running = true; clock.getDelta(); frame(); } },
      stop() { state.running = false; },
      renderOnce() { state.running = true; frame(); state.running = false; },
      resize
    };
  }

  window.Hero3D = { create };
})();
