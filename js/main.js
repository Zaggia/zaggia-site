/* ==========================================================================
   Residenza — interazioni e scene 3D
   Nessuna dipendenza obbligatoria: Lenis (smooth scroll) è opzionale.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;

  /* ---------- Utilità ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  function offTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }

  var reduced = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var VW = window.innerWidth, VH = window.innerHeight;

  var ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  function toRoman(n) {
    n = Math.floor(n);
    if (n <= 0) return '·';
    var s = '';
    for (var i = 0; i < ROMAN.length; i++) { while (n >= ROMAN[i][0]) { s += ROMAN[i][1]; n -= ROMAN[i][0]; } }
    return s;
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Immagini: locale -> remota -> segnaposto ---------- */
  function loadImg(img) {
    if (img._started) return;
    img._started = true;
    var list = (img.getAttribute('data-src') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    var box = img.closest ? img.closest('.media') : null;
    var i = 0;
    function next() {
      if (i >= list.length) {
        if (img._failed) return;
        img._failed = true;
        if (box) box.classList.add('is-fallback');
        img.removeAttribute('src');
        img.style.display = 'none';
        return;
      }
      img.src = list[i++];
    }
    img.addEventListener('error', next);
    img.addEventListener('load', function () { if (box) box.classList.add('is-loaded'); });
    img.decoding = 'async';
    next();
  }
  var imgs = $$('img[data-src]');
  if ('IntersectionObserver' in window) {
    var imgIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { loadImg(e.target); imgIO.unobserve(e.target); } });
    }, { rootMargin: '150% 0px 150% 0px' });
    imgs.forEach(function (img) { if (img.hasAttribute('data-eager')) loadImg(img); else imgIO.observe(img); });
  } else {
    imgs.forEach(loadImg);
  }

  /* ---------- Smooth scroll (Lenis, se disponibile) ---------- */
  var lenis = null;
  if (!reduced && typeof window.Lenis === 'function') {
    try { lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true }); } catch (e) { lenis = null; }
  }
  function scrollToEl(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.8 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ---------- Menu mobile ---------- */
  var menu = $('#menu'), toggle = $('#navToggle'), menuOpen = false;
  function setMenu(open) {
    if (!menu || !toggle) return;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    doc.classList.toggle('menu-open', open);
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
  }
  function closeMenu() { if (menuOpen) setMenu(false); }
  if (toggle) toggle.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* Link interni */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var t = document.getElementById(id.slice(1));
      if (!t) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(t);
    });
  });

  /* ---------- Suddivisione testi ---------- */
  function splitChars(el) {
    if (!el) return [];
    var txt = el.textContent;
    el.textContent = '';
    return Array.prototype.map.call(txt, function (ch, i) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
      return s;
    });
  }
  function splitWords(el) {
    var out = [];
    if (!el) return out;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            frag.appendChild(s);
            out.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    })(el);
    return out;
  }
  splitChars($('.hero-title .split'));
  splitChars($('.foot-word .split'));

  /* ---------- Preloader: il portone si apre ---------- */
  var doors = $('#doors');
  function startSite() {
    doc.classList.remove('is-loading');
    if (lenis) lenis.start();
    document.body.classList.add('is-ready');
  }
  function openDoors() {
    doors.classList.add('is-open');
    setTimeout(startSite, 380);
    setTimeout(function () { doors.classList.add('is-gone'); }, 1500);
    setTimeout(function () { if (doors.parentNode) doors.parentNode.removeChild(doors); }, 2400);
  }
  window.scrollTo(0, 0);
  if (!doors || reduced) {
    if (doors && doors.parentNode) doors.parentNode.removeChild(doors);
    startSite();
  } else {
    if (lenis) lenis.stop();
    var countEl = $('#doorsCount');
    var t0 = performance.now(), loaded = document.readyState === 'complete', val = 0;
    var MIN = 1500, MAX = 4500;
    window.addEventListener('load', function () { loaded = true; });
    (function tick(now) {
      var el = now - t0;
      var cap = (loaded || el > MAX) ? 100 : 88;
      var target = Math.min(cap, (el / MIN) * 100);
      val += (target - val) * 0.16;
      if (target >= 100 && val > 99.3) val = 100;
      if (countEl) countEl.textContent = toRoman(Math.max(1, Math.round(val)));
      if (val >= 100) { openDoors(); return; }
      requestAnimationFrame(tick);
    })(t0);
  }
  // Il preloader è partito: la rete di sicurezza nell'<head> non serve più.
  window.__residenzaReady = true;

  /* ---------- Rivelazioni ---------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var revIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); revIO.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Carte numeri romani ---------- */
  if (!finePointer) {
    $$('.stat').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('is-flipped'); }); });
  }

  var modules = [];

  /* ---------- Ingresso: si cammina attraverso sei archi ---------- */
  (function () {
    var sec = $('#top'), sticky = $('#heroSticky'), tunnel = $('#tunnel'), cam = $('#tunnelCam');
    var end = $('#tunnelEnd'), floor = $('#floor'), tiles = $('#floorTiles');
    var reveal = $('#heroReveal'), shade = $('#heroShade'), rtext = $('#heroRevealText'), copy = $('#heroCopy');
    if (!sec || !sticky || !tunnel || !cam || !end || !reveal || !copy) return;

    var arches = $$('.arch', cam).map(function (el) {
      return { el: el, i: +el.getAttribute('data-i'), z: 0, o: -1 };
    });
    var top = 0, H = 0, sw = 0, sh = 0, aw = 0, ah = 0, gap = 0, endZ = 0;
    var TILE = 140, PCAM = 0.8;
    var mx = 0, my = 0, tmx = 0, tmy = 0, revealOn = null, lastClip = '';

    function measure() {
      top = offTop(sec);
      H = sec.offsetHeight;
      sw = sticky.clientWidth;
      sh = sticky.clientHeight;
      aw = end.offsetWidth;
      ah = end.offsetHeight;
      tunnel.style.perspective = Math.round(clamp(sh, 640, 1000)) + 'px';
      gap = Math.max(240, aw * 0.85);
      arches.forEach(function (a) {
        a.z = -(a.i - 1) * gap;
        a.el.style.transform = 'translate(-50%, -50%) translate3d(0, 0, ' + a.z.toFixed(1) + 'px)';
      });
      endZ = -6 * gap;
      end.style.transform = 'translate(-50%, -50%) translate3d(0, 0, ' + endZ.toFixed(1) + 'px)';
      sticky.style.setProperty('--tw', sw + 'px');
      sticky.style.setProperty('--th', sh + 'px');
      if (floor) floor.style.transform = 'translate3d(0, ' + (ah / 2).toFixed(1) + 'px, 300px) rotateX(-90deg)';
      lastClip = '';
    }

    function update(y, now) {
      if (reduced) return;
      var s = y - top;
      if (s > H || s < -sh) return;
      var range = Math.max(1, H - 2 * sh);
      var p = clamp(s / range);
      var pc = clamp(p / PCAM);

      // Camera: avanza nel tunnel. A riposo "respira" leggermente.
      var idle = Math.sin(now * 0.0007) * 14 * (1 - pc);
      var camZ = easeInOut(pc) * (-endZ) + idle;
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      tunnel.style.perspectiveOrigin = (50 + mx * 6).toFixed(2) + '% ' + (46 + my * 5).toFixed(2) + '%';
      cam.style.transform = 'translate3d(0, 0, ' + camZ.toFixed(1) + 'px)';
      if (tiles) tiles.style.transform = 'translate3d(0, ' + (-(camZ % TILE)).toFixed(1) + 'px, 0)';

      // Ogni arco svanisce mentre lo si attraversa; i lontani sono velati.
      for (var k = 0; k < arches.length; k++) {
        var a = arches[k], ze = a.z + camZ, o = 1;
        if (ze > gap * 0.1) o = clamp(1 - (ze - gap * 0.1) / (gap * 0.75));
        o *= 1 - clamp(-ze / (6 * gap)) * 0.4;
        o = Math.round(o * 100) / 100;
        if (o !== a.o) {
          a.o = o;
          a.el.style.opacity = o;
          a.el.style.visibility = o <= 0 ? 'hidden' : 'visible';
        }
      }

      // Fine del tunnel: l'ultimo arco si apre a tutto schermo.
      var q = clamp((p - PCAM) / (1 - PCAM));
      var on = p >= PCAM;
      if (on !== revealOn) {
        revealOn = on;
        reveal.style.visibility = on ? 'visible' : 'hidden';
        tunnel.style.visibility = on ? 'hidden' : 'visible';
      }
      if (on) {
        var e = easeInOut(q);
        var ix = (sw - aw) / 2 * (1 - e), iy = (sh - ah) / 2 * (1 - e), r = aw / 2 * (1 - e);
        var clip = 'inset(' + iy.toFixed(1) + 'px ' + ix.toFixed(1) + 'px ' + iy.toFixed(1) + 'px ' + ix.toFixed(1) +
          'px round ' + r.toFixed(1) + 'px ' + r.toFixed(1) + 'px 0px 0px)';
        if (clip !== lastClip) {
          lastClip = clip;
          reveal.style.webkitClipPath = clip;
          reveal.style.clipPath = clip;
        }
      }

      // La sezione successiva scorre sopra la foto, che arretra.
      var ov = clamp((s - range) / sh);
      reveal.style.transform = ov > 0 ? 'scale(' + (1 - ov * 0.08).toFixed(4) + ')' : '';
      if (shade) shade.style.opacity = (ov * 0.55).toFixed(3);
      if (rtext) {
        rtext.style.opacity = (clamp((q - 0.45) / 0.4) * (1 - clamp(ov * 1.6))).toFixed(3);
        rtext.style.transform = 'translate3d(0, ' + ((1 - q) * 30 - ov * 60).toFixed(1) + 'px, 0)';
      }

      // Il titolo si allontana appena si inizia a scorrere.
      var c = clamp(p / 0.2);
      copy.style.opacity = (1 - c).toFixed(3);
      copy.style.transform = 'translate3d(0, ' + (-c * 70).toFixed(1) + 'px, 0)';
      copy.style.visibility = c >= 1 ? 'hidden' : 'visible';
    }

    if (finePointer && !reduced) {
      window.addEventListener('pointermove', function (e) {
        tmx = e.clientX / VW - 0.5;
        tmy = e.clientY / VH - 0.5;
      }, { passive: true });
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Frase che si accende parola per parola ---------- */
  (function () {
    var st = $('#statement');
    if (!st) return;
    var words = splitWords(st), n = words.length, top = 0, h = 0, lit = -1;
    if (reduced) { words.forEach(function (w) { w.classList.add('on'); }); return; }
    function measure() { top = offTop(st); h = st.offsetHeight; lit = -1; }
    function update(y) {
      if (y + VH < top - 50 || y > top + h + VH) return;
      var p = clamp((y + VH * 0.82 - top) / (h + VH * 0.3));
      var c = Math.round(p * n);
      if (c === lit) return;
      lit = c;
      for (var i = 0; i < n; i++) {
        var on = i < c;
        if (words[i]._on !== on) { words[i]._on = on; words[i].classList.toggle('on', on); }
      }
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Variabile --p legata allo scroll ---------- */
  (function () {
    var items = $$('[data-scrub]').map(function (el) {
      return { el: el, foot: el.classList.contains('foot-word'), top: 0, h: 0, last: -1 };
    });
    if (!items.length) return;
    function measure() { items.forEach(function (it) { it.top = offTop(it.el); it.h = it.el.offsetHeight; it.last = -1; }); }
    function update(y) {
      items.forEach(function (it) {
        if (y + VH < it.top - 100 || y > it.top + it.h + 100) return;
        var p = it.foot ? clamp((y + VH - it.top) / (it.h + 40)) : clamp((y + VH - it.top) / (VH * 0.85));
        if (reduced) p = 1;
        p = Math.round(p * 1000) / 1000;
        if (p !== it.last) { it.last = p; it.el.style.setProperty('--p', p); }
      });
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Le camere: anello 3D (scroll + trascinamento) ---------- */
  (function () {
    var sec = $('#camere'), stage = $('#ringStage'), ring = $('#ring');
    if (!sec || !stage || !ring) return;
    var cards = $$('.rcard', ring), n = cards.length, step = 360 / n;
    if (!n) return;
    var shades = cards.map(function (c) { return $('.rcard-shade', c); });
    var cap = $('#rcCap'), cNum = $('#rcNum'), cTitle = $('#rcTitle'), cDesc = $('#rcDesc');
    var dots = $$('.rdot', sec);
    var top = 0, H = 0, sh = 0, R = 300, rot = 0, drag = 0, base = 0, idx = -1;
    var dragging = false, px = 0;
    function mod(k) { return ((k % n) + n) % n; }

    function measure() {
      top = offTop(sec);
      H = sec.offsetHeight;
      sh = stage.clientHeight || VH;
      var cw = ring.offsetWidth || 260;
      R = (cw / 2) / Math.tan(Math.PI / n) + cw * 0.32;
      cards.forEach(function (c, i) { c.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + R.toFixed(1) + 'px)'; });
    }
    function snap() { var want = Math.round((base + drag) / step) * step; drag = want - base; }
    function go(k) {
      var cur = Math.round(-(base + drag) / step);
      var d = mod(k - cur);
      if (d > n / 2) d -= n;
      drag = -(cur + d) * step - base;
    }
    function setCaption(i) {
      var c = cards[i];
      if (cNum) cNum.textContent = toRoman(i + 1);
      if (cTitle) cTitle.textContent = c.getAttribute('data-title');
      if (cDesc) cDesc.textContent = c.getAttribute('data-desc');
      if (cap) { cap.classList.remove('rc-anim'); void cap.offsetWidth; cap.classList.add('rc-anim'); }
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      px = e.clientX;
      stage.classList.add('is-drag');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - px;
      px = e.clientX;
      drag += dx * 0.32;
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-drag');
      snap();
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    var prev = $('#ringPrev'), next = $('#ringNext');
    if (prev) prev.addEventListener('click', function () { go(mod(idx - 1)); });
    if (next) next.addEventListener('click', function () { go(mod(idx + 1)); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });

    function update(y) {
      var s = y - top;
      if (s < -sh * 1.5 || s > H + sh * 0.5) return;
      var p = clamp(s / Math.max(1, H - sh));
      base = -p * (n - 1) * step;
      var target = base + drag;
      rot += (target - rot) * (reduced ? 1 : 0.1);
      if (Math.abs(target - rot) < 0.01) rot = target;
      ring.style.transform = 'translateZ(' + (-R).toFixed(1) + 'px) rotateX(-7deg) rotateY(' + rot.toFixed(2) + 'deg)';
      for (var i = 0; i < n; i++) {
        var a = (i * step + rot) * Math.PI / 180;
        var o = ((1 - Math.cos(a)) / 2 * 0.82).toFixed(3);
        if (shades[i] && shades[i]._o !== o) { shades[i]._o = o; shades[i].style.opacity = o; }
      }
      var fi = mod(Math.round(-rot / step));
      if (fi !== idx) { idx = fi; setCaption(fi); }
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Il quartiere: linea B su un piano 3D ---------- */
  (function () {
    var box = $('#metro'), plane = $('#metroPlane');
    if (!box || !plane) return;
    var P = [
      { n: 'Residenza', s: 'Voi siete qui', x: 760, y: 190, home: true },
      { n: 'Bologna', s: 'Metro B · 5 min a piedi', x: 660, y: 290, major: true },
      { n: 'Policlinico', x: 580, y: 370 },
      { n: 'Castro Pretorio', x: 580, y: 480 },
      { n: 'Termini', s: '3ª fermata', x: 480, y: 580, major: true },
      { n: 'Cavour', x: 340, y: 580 },
      { n: 'Colosseo', s: '5ª fermata · senza cambi', x: 340, y: 710, major: true },
      { n: 'Circo Massimo', x: 240, y: 810 }
    ];
    var line = P.slice(1);
    var lineD = 'M' + line.map(function (p) { return p.x + ' ' + p.y; }).join('L');
    var walkD = 'M' + P[0].x + ' ' + P[0].y + 'L' + P[1].x + ' ' + P[1].y;
    var total = 0, cum = [];
    for (var i = 1; i < line.length; i++) {
      total += Math.sqrt(Math.pow(line[i].x - line[i - 1].x, 2) + Math.pow(line[i].y - line[i - 1].y, 2));
      cum.push(total);
    }
    var frac = [0, 0].concat(cum.map(function (c) { return c / total; }));

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('class', 'metro-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<circle class="m-pulse" cx="' + P[0].x + '" cy="' + P[0].y + '" r="80"/>' +
      '<path class="m-walk-bg" d="' + walkD + '"/>' +
      '<path class="m-walk" pathLength="1" d="' + walkD + '"/>' +
      '<path class="m-line-bg" d="' + lineD + '"/>' +
      '<path class="m-line" pathLength="1" d="' + lineD + '"/>' +
      P.map(function (p) {
        return '<circle class="m-dot' + (p.home ? ' is-home' : '') + (p.major ? ' is-major' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (p.home ? 14 : p.major ? 11 : 8) + '"/>';
      }).join('');
    plane.appendChild(svg);

    var dotEls = $$('.m-dot', svg), walk = $('.m-walk', svg), ln = $('.m-line', svg);
    var labels = P.map(function (p) {
      var st = document.createElement('div');
      st.className = 'st' + (p.home || p.major ? ' is-major' : ' is-minor') + (p.home ? ' is-home' : '');
      st.style.left = (p.x / 10) + '%';
      st.style.top = (p.y / 10) + '%';
      var bill = document.createElement('div');
      bill.className = 'st-bill';
      var inner = document.createElement('div');
      inner.className = 'st-in';
      var b = document.createElement('b');
      b.textContent = p.n;
      inner.appendChild(b);
      if (p.s) { var sm = document.createElement('small'); sm.textContent = p.s; inner.appendChild(sm); }
      bill.appendChild(inner);
      st.appendChild(bill);
      plane.appendChild(st);
      return st;
    });

    var top = 0, h = 0, last = -1;
    function measure() { top = offTop(box); h = box.offsetHeight; last = -1; }
    function update(y) {
      if (y + VH < top - 200 || y > top + h + 200) return;
      var pr = reduced ? 1 : clamp((y + VH * 0.85 - top) / (h * 0.55 + VH * 0.35));
      var r = Math.round(pr * 500) / 500;
      if (r === last) return;
      last = r;
      var w = clamp(r / 0.2), l = clamp((r - 0.2) / 0.8);
      walk.style.strokeDashoffset = String(1 - w);
      ln.style.strokeDashoffset = String(1 - l);
      plane.style.setProperty('--rz', (-38 + r * 10).toFixed(2) + 'deg');
      for (var k = 0; k < P.length; k++) {
        var on = k === 0 ? r > 0.02 : k === 1 ? w >= 0.98 : l >= frac[k] - 0.002;
        labels[k].classList.toggle('on', on);
        dotEls[k].classList.toggle('on', on);
      }
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Recensioni: mazzo di carte 3D ---------- */
  (function () {
    var box = $('#deck');
    if (!box) return;
    var cards = $$('.qcard', box), n = cards.length;
    if (!n) return;
    var order = cards.map(function (_, i) { return i; });
    var busy = false, hover = false, inView = false;
    var counter = $('#deckCount');
    var OUT = 'translate3d(0, 60px, 180px) rotateX(-78deg)';

    function place(c, k) {
      c.style.zIndex = String(n - k);
      c.style.opacity = k < 3 ? String(1 - k * 0.2) : '0';
      c.style.transform = 'translate3d(0, ' + (-k * 22) + 'px, ' + (-k * 80) + 'px) rotateX(' + (k * 2.5) + 'deg)';
      c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true');
    }
    function layout() {
      order.forEach(function (ci, k) { place(cards[ci], k); });
      if (counter) counter.textContent = toRoman(order[0] + 1) + ' / ' + toRoman(n);
    }
    function instant(c, fn) {
      c.style.transition = 'none';
      fn();
      void c.offsetWidth;
      c.style.transition = '';
    }
    function next() {
      if (busy) return;
      busy = true;
      var ci = order.shift();
      order.push(ci);
      var c = cards[ci];
      c.style.zIndex = String(n + 1);
      c.style.transform = OUT;
      c.style.opacity = '0';
      order.forEach(function (x, k) { if (x !== ci) place(cards[x], k); });
      if (counter) counter.textContent = toRoman(order[0] + 1) + ' / ' + toRoman(n);
      setTimeout(function () { instant(c, function () { place(c, n - 1); }); busy = false; }, 800);
    }
    function prev() {
      if (busy) return;
      busy = true;
      var ci = order.pop();
      order.unshift(ci);
      var c = cards[ci];
      instant(c, function () { c.style.zIndex = String(n + 1); c.style.transform = OUT; c.style.opacity = '0'; });
      layout();
      setTimeout(function () { busy = false; }, 800);
    }
    layout();
    var bNext = $('#deckNext'), bPrev = $('#deckPrev');
    if (bNext) bNext.addEventListener('click', next);
    if (bPrev) bPrev.addEventListener('click', prev);
    box.addEventListener('click', function () { next(); });
    box.addEventListener('mouseenter', function () { hover = true; });
    box.addEventListener('mouseleave', function () { hover = false; });
    var sx = null;
    box.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    box.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (dx > 50) { prev(); box._swiped = true; }
      else if (dx < -50) { next(); box._swiped = true; }
    });
    box.addEventListener('click', function (e) { if (box._swiped) { box._swiped = false; e.stopImmediatePropagation(); } }, true);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.4 }).observe(box);
    }
    if (!reduced) {
      setInterval(function () { if (inView && !hover && !document.hidden) next(); }, 6500);
    }
  })();

  /* ---------- La chiave: pendolo con molla ---------- */
  (function () {
    var scene = $('#fobScene'), piv = $('#fob');
    if (!scene || !piv) return;
    var az = 0, vz = 0, ay = 0, vy = 0, lastX = null, inView = false, t = 0;
    scene.addEventListener('pointermove', function (e) {
      if (lastX !== null) {
        var dx = e.clientX - lastX;
        vz += dx * 1.5;
        vy -= dx * 2.6;
      }
      lastX = e.clientX;
    });
    scene.addEventListener('pointerleave', function () { lastX = null; });
    scene.addEventListener('pointerdown', function () {
      vz += (Math.random() > 0.5 ? 1 : -1) * 110;
      vy += 260;
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0 }).observe(scene);
    } else { inView = true; }
    function update(y, now, dt, vel) {
      if (!inView) return;
      dt = Math.min(dt, 0.05);
      t += dt;
      vz += clamp(vel, -3000, 3000) * 0.002;
      var rest = reduced ? 0 : Math.sin(t * 1.2) * 2.4;
      vz += (-24 * (az - rest) - 1.3 * vz) * dt;
      vy += (-12 * ay - 1.0 * vy) * dt;
      vz = clamp(vz, -420, 420);
      vy = clamp(vy, -700, 700);
      az = clamp(az + vz * dt, -48, 48);
      ay = clamp(ay + vy * dt, -160, 160);
      piv.style.transform = 'rotateZ(' + az.toFixed(2) + 'deg) rotateY(' + ay.toFixed(2) + 'deg)';
    }
    modules.push({ update: update });
  })();

  /* ---------- Inclinazione 3D e bottoni magnetici ---------- */
  if (finePointer && !reduced) {
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-tilting');
        el.style.transform = 'perspective(900px) rotateX(' + (-y * 10).toFixed(2) + 'deg) rotateY(' + (x * 12).toFixed(2) + 'deg) translateZ(0)';
        el.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () { el.classList.remove('is-tilting'); el.style.transform = ''; });
    });
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate3d(' + (x * 0.2).toFixed(1) + 'px, ' + (y * 0.3).toFixed(1) + 'px, 0)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- Cursore ---------- */
  (function () {
    var cur = $('#cursor');
    if (!cur || !finePointer || reduced) return;
    doc.classList.add('has-cursor');
    var dot = $('.cursor-dot', cur), ringEl = $('.cursor-ring', cur), label = $('.cursor-label', cur);
    var x = -100, y = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; cur.classList.remove('is-out'); }, { passive: true });
    doc.addEventListener('mouseleave', function () { cur.classList.add('is-out'); });
    $$('iframe').forEach(function (f) { f.addEventListener('mouseenter', function () { cur.classList.add('is-out'); }); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      var btn = t ? t.closest('a, button') : null;
      var lab = t ? t.closest('[data-cursor]') : null;
      if (btn) {
        cur.classList.add('is-hover');
        cur.classList.remove('is-label');
      } else if (lab) {
        label.textContent = lab.getAttribute('data-cursor');
        cur.classList.add('is-label');
        cur.classList.remove('is-hover');
      } else {
        cur.classList.remove('is-hover', 'is-label');
      }
    });
    modules.push({
      update: function () {
        rx += (x - rx) * 0.2;
        ry += (y - ry) * 0.2;
        dot.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
        ringEl.style.transform = 'translate3d(' + rx.toFixed(1) + 'px, ' + ry.toFixed(1) + 'px, 0)';
      }
    });
  })();

  /* ---------- Nastro scorrevole (accelera con lo scroll) ---------- */
  (function () {
    var track = $('#marqueeTrack');
    if (!track) return;
    var kids = track.children, half = 0, x = 0, top = 0, h = 0;
    function measure() {
      var mid = Math.floor(kids.length / 2);
      half = kids[mid] ? kids[mid].offsetLeft - kids[0].offsetLeft : track.scrollWidth / 2;
      top = offTop(track.parentNode);
      h = track.parentNode.offsetHeight;
    }
    function update(y, now, dt, vel) {
      if (!half || y + VH < top || y > top + h) return;
      var speed = reduced ? 0 : 50 + Math.min(900, Math.abs(vel) * 0.35);
      x -= speed * dt;
      if (x <= -half) x += half;
      var sk = reduced ? 0 : clamp(vel / 140, -9, 9);
      track.style.transform = 'translate3d(' + x.toFixed(1) + 'px, 0, 0) skewX(' + (-sk).toFixed(2) + 'deg)';
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Barra di navigazione e indice laterale ---------- */
  (function () {
    var nav = $('#nav'), rail = $('#rail');
    var links = rail ? $$('a', rail) : [];
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('data-for')); });
    var tops = [], lastY = 0, active = -1, heroEnd = 0;
    function measure() {
      tops = secs.map(function (s) { return s ? offTop(s) : 1e9; });
      var hero = $('#top');
      heroEnd = hero ? offTop(hero) + hero.offsetHeight - VH * 1.5 : VH;
    }
    function update(y) {
      if (nav) {
        if (menuOpen || y < 140 || y < lastY - 4) nav.classList.remove('is-hidden');
        else if (y > lastY + 4) nav.classList.add('is-hidden');
      }
      lastY = y;
      if (!rail) return;
      rail.classList.toggle('is-on', y > heroEnd);
      var mid = y + VH * 0.45, a = -1;
      for (var i = 0; i < tops.length; i++) if (mid >= tops[i]) a = i;
      if (a !== active) {
        active = a;
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === a); });
      }
    }
    modules.push({ measure: measure, update: update });
  })();

  /* ---------- Misure e ciclo principale ---------- */
  function measureAll() {
    VW = window.innerWidth;
    VH = window.innerHeight;
    modules.forEach(function (m) {
      if (!m.measure) return;
      try { m.measure(); } catch (e) { if (window.console) console.warn(e); }
    });
  }
  var rt = null;
  function onResize() { clearTimeout(rt); rt = setTimeout(measureAll, 120); }
  window.addEventListener('resize', onResize);
  window.addEventListener('load', measureAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
  if ('ResizeObserver' in window) {
    var lastBodyH = 0;
    new ResizeObserver(function () {
      var hgt = document.body.offsetHeight;
      if (hgt !== lastBodyH) { lastBodyH = hgt; onResize(); }
    }).observe(document.body);
  }
  measureAll();

  var lastT = performance.now(), lastScroll = window.pageYOffset, vel = 0;
  function frame(now) {
    var dt = Math.min(0.064, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    if (lenis) lenis.raf(now);
    var y = window.pageYOffset || doc.scrollTop || 0;
    vel = lerp(vel, (y - lastScroll) / dt, 0.12);
    lastScroll = y;
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (!m.update || m.dead) continue;
      try { m.update(y, now, dt, vel); } catch (e) { m.dead = true; if (window.console) console.warn(e); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
