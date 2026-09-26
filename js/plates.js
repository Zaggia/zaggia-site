/* Procedural illustrated plates used until real photos are dropped in assets/photos/. */
(function () {
  const C = {
    patina: '#1F3A34', deep: '#142824', trav: '#ECE5D6', trav2: '#D9CFBB',
    oro: '#C8A15A', porpora: '#7E2A1E', ochre: '#C98F4E', rosa: '#D9A38A', ink: '#1A1714'
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let noiseTile;
  function grain(ctx, w, h, a) {
    if (!noiseTile) {
      noiseTile = document.createElement('canvas');
      noiseTile.width = noiseTile.height = 180;
      const c = noiseTile.getContext('2d');
      const id = c.createImageData(180, 180);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = Math.random() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(noiseTile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function vignette(ctx, w, h, a) {
    ctx.fillStyle = rad(ctx, w / 2, h / 2, Math.min(w, h) * 0.3, Math.max(w, h) * 0.8,
      [[0, 'rgba(10,20,18,0)'], [1, `rgba(10,20,18,${a})`]]);
    ctx.fillRect(0, 0, w, h);
  }
  function archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.lineTo(x + w, y + h); ctx.closePath();
  }

  function dome(ctx, cx, by, s, col) {
    ctx.fillStyle = col;
    ctx.fillRect(cx - s * 1.7, by - s * 0.34, s * 3.4, s * 0.34);
    ctx.fillRect(cx - s * 0.78, by - s * 0.76, s * 1.56, s * 0.44);
    ctx.beginPath(); ctx.ellipse(cx, by - s * 0.76, s * 0.74, s * 0.86, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - s * 0.09, by - s * 1.84, s * 0.18, s * 0.26);
    ctx.beginPath(); ctx.ellipse(cx, by - s * 1.84, s * 0.11, s * 0.1, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - s * 0.013, by - s * 2.08, s * 0.026, s * 0.16);
    ctx.fillRect(cx - s * 0.05, by - s * 2.03, s * 0.1, s * 0.022);
    [-1.28, 1.28].forEach(k => {
      ctx.beginPath(); ctx.ellipse(cx + k * s, by - s * 0.34, s * 0.2, s * 0.26, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx + k * s - s * 0.03, by - s * 0.7, s * 0.06, s * 0.12);
    });
  }

  function pine(ctx, x, y, s, col, r) {
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.6, x - s * 0.04, y - s * 1.1); ctx.stroke();
    ctx.fillStyle = col;
    for (let i = 0; i < 11; i++) {
      const a = i / 10 - 0.5;
      ctx.beginPath();
      ctx.ellipse(x - s * 0.04 + a * s * 1.3 + (r() - 0.5) * s * 0.12,
        y - s * 1.14 - Math.cos(a * 2.6) * s * 0.24 + (r() - 0.5) * s * 0.08,
        s * 0.36, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function rooftops(ctx, w, by, r, col, winCol, scale) {
    let x = -10;
    while (x < w + 10) {
      const bw = (60 + r() * 120) * scale, bh = (60 + r() * 130) * scale;
      ctx.fillStyle = col;
      ctx.fillRect(x, by - bh, bw, bh + 400);
      if (r() > 0.55) {
        ctx.beginPath(); ctx.moveTo(x - 4, by - bh); ctx.lineTo(x + bw / 2, by - bh - 26 * scale);
        ctx.lineTo(x + bw + 4, by - bh); ctx.fill();
      }
      if (r() > 0.6) ctx.fillRect(x + bw * 0.7, by - bh - 22 * scale, 10 * scale, 22 * scale);
      if (winCol) {
        ctx.fillStyle = winCol;
        for (let wy = by - bh + 18 * scale; wy < by - 8; wy += 30 * scale)
          for (let wx = x + 12 * scale; wx < x + bw - 14 * scale; wx += 26 * scale)
            if (r() > 0.55) ctx.fillRect(wx, wy, 8 * scale, 13 * scale);
      }
      x += bw - 2;
    }
  }

  function sky(ctx, w, h, stops) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, h, stops);
    ctx.fillRect(0, 0, w, h);
  }

  function frameArt(ctx, x, y, w, h, hue) {
    ctx.fillStyle = C.oro; ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = lin(ctx, x, y, x + w, y + h, [[0, hue[0]], [1, hue[1]]]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(236,229,214,.55)';
    ctx.beginPath(); ctx.arc(x + w * 0.62, y + h * 0.38, Math.min(w, h) * 0.16, 0, Math.PI * 2); ctx.fill();
  }

  function bed(ctx, x, y, w, h, head, linen, throwCol) {
    ctx.fillStyle = head;
    archPath(ctx, x + w * 0.04, y - h * 1.15, w * 0.92, h * 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + h * 0.9, w, h * 0.18);
    ctx.fillStyle = linen;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = '#FBF7EF';
    ctx.beginPath(); ctx.roundRect(x + w * 0.08, y - h * 0.22, w * 0.38, h * 0.38, 18); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + w * 0.54, y - h * 0.22, w * 0.38, h * 0.38, 18); ctx.fill();
    ctx.fillStyle = throwCol; ctx.fillRect(x, y + h * 0.52, w, h * 0.22);
    ctx.strokeStyle = 'rgba(26,23,20,.08)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 4, y + 6); ctx.lineTo(x + w * i / 4 + 10, y + h * 0.5); ctx.stroke(); }
  }

  function lamp(ctx, x, y, s) {
    ctx.fillStyle = rad(ctx, x, y, 0, s * 3, [[0, 'rgba(255,214,150,.55)'], [1, 'rgba(255,214,150,0)']]);
    ctx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
    ctx.fillStyle = '#F4D9A8';
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x + s * 0.4, y - s * 0.8); ctx.lineTo(x - s * 0.4, y - s * 0.8); ctx.fill();
    ctx.fillStyle = C.oro; ctx.fillRect(x - 3, y, 6, s * 1.1);
  }

  function windowArch(ctx, x, y, w, h, skyStops) {
    ctx.fillStyle = '#CDBFA6'; archPath(ctx, x - 14, y - 14, w + 28, h + 28); ctx.fill();
    ctx.save(); archPath(ctx, x, y, w, h); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, y, 0, y + h, skyStops); ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = '#E9DFCB'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h * 0.45); ctx.lineTo(x + w, y + h * 0.45); ctx.stroke();
  }

  function lightShaft(ctx, x, y, w, h, dx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = lin(ctx, x, y, x + dx, y + h, [[0, 'rgba(255,226,180,.35)'], [1, 'rgba(255,226,180,0)']]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + dx * 1.3, y + h); ctx.lineTo(x + dx, y + h); ctx.fill();
    ctx.restore();
  }

  const scenes = {
    terrazza(ctx, w, h, r) {
      sky(ctx, w, h, [[0, '#2B4541'], [0.38, '#B9837A'], [0.62, '#F0C79E'], [1, '#F6DDB9']]);
      ctx.fillStyle = rad(ctx, w * 0.7, h * 0.55, 0, w * 0.5, [[0, 'rgba(255,232,190,.9)'], [1, 'rgba(255,232,190,0)']]);
      ctx.fillRect(0, 0, w, h);
      dome(ctx, w * 0.36, h * 0.6, w * 0.17, 'rgba(92,72,74,.75)');
      rooftops(ctx, w, h * 0.66, r, '#5A4540', 'rgba(255,214,150,.55)', w / 900);
      pine(ctx, w * 0.86, h * 0.64, w * 0.3, '#2A2B24', r);
      const fy = h * 0.72;
      ctx.fillStyle = lin(ctx, 0, fy, 0, h, [[0, '#D8C6A8'], [1, '#A88F70']]);
      ctx.fillRect(0, fy, w, h - fy);
      ctx.strokeStyle = 'rgba(60,45,35,.25)'; ctx.lineWidth = 2;
      for (let i = -8; i < 16; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 22, fy); ctx.lineTo(w / 2 + i * 150, h); ctx.stroke(); }
      for (let y = fy + 20, s = 20; y < h; s *= 1.35, y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.fillStyle = '#E9DDC6';
      ctx.fillRect(0, fy - h * 0.1, w, h * 0.022);
      for (let x = 10; x < w; x += w / 14) {
        ctx.beginPath(); ctx.ellipse(x + w / 34, fy - h * 0.045, w / 60, h * 0.036, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x + w / 34 - w / 90, fy - h * 0.085, w / 45, h * 0.085);
      }
      ctx.fillRect(0, fy - 4, w, h * 0.014);
      ctx.fillStyle = C.patina;
      ctx.beginPath(); ctx.ellipse(w * 0.42, h * 0.8, w * 0.11, h * 0.02, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(w * 0.415, h * 0.8, w * 0.01, h * 0.12);
      [[0.25, 1], [0.59, -1]].forEach(([cx, d]) => {
        ctx.fillRect(w * cx, h * 0.84, w * 0.08, h * 0.012);
        ctx.fillRect(w * cx + (d > 0 ? 0 : w * 0.07), h * 0.76, w * 0.01, h * 0.16);
        ctx.fillRect(w * cx + w * 0.005, h * 0.85, w * 0.006, h * 0.08);
        ctx.fillRect(w * cx + w * 0.07, h * 0.85, w * 0.006, h * 0.08);
      });
      ctx.fillStyle = C.porpora; ctx.fillRect(w * 0.06, h * 0.8, w * 0.09, h * 0.11);
      ctx.fillStyle = '#3E5B3A';
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(w * 0.105 + (r() - 0.5) * w * 0.12, h * 0.78 - r() * h * 0.08, w * 0.03, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#E8B84A';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(w * 0.105 + (r() - 0.5) * w * 0.1, h * 0.76 - r() * h * 0.06, w * 0.009, 0, Math.PI * 2); ctx.fill(); }
    },

    camera(ctx, w, h, r) {
      ctx.fillStyle = lin(ctx, 0, 0, w, 0, [[0, '#E8DCC7'], [1, '#D4C4AA']]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(31,58,52,.9)'; ctx.fillRect(0, h * 0.5, w, h * 0.012);
      windowArch(ctx, w * 0.08, h * 0.1, w * 0.26, h * 0.5, [[0, '#9DB6BD'], [0.7, '#F3D8B4'], [1, '#E9C49A']]);
      ctx.fillStyle = 'rgba(126,42,30,.85)'; ctx.fillRect(w * 0.035, h * 0.08, w * 0.05, h * 0.6);
      ctx.fillRect(w * 0.345, h * 0.08, w * 0.05, h * 0.6);
      const fy = h * 0.72;
      ctx.fillStyle = lin(ctx, 0, fy, 0, h, [[0, '#9A6D4D'], [1, '#6E4A33']]); ctx.fillRect(0, fy, w, h - fy);
      ctx.strokeStyle = 'rgba(40,25,15,.25)'; ctx.lineWidth = 2;
      for (let i = -6; i < 14; i++) { ctx.beginPath(); ctx.moveTo(w * 0.5 + i * 40, fy); ctx.lineTo(w * 0.5 + i * 140, h); ctx.stroke(); }
      lightShaft(ctx, w * 0.1, h * 0.35, w * 0.22, h * 0.6, w * 0.28);
      frameArt(ctx, w * 0.56, h * 0.16, w * 0.26, h * 0.17, ['#2B4541', '#C98F4E']);
      bed(ctx, w * 0.44, h * 0.62, w * 0.5, h * 0.14, C.patina, '#F6F1E7', C.oro);
      lamp(ctx, w * 0.39, h * 0.56, w * 0.035);
      ctx.fillStyle = '#5B4030'; ctx.fillRect(w * 0.35, h * 0.6, w * 0.08, h * 0.13);
    },

    twin(ctx, w, h, r) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#B7BFA7'], [1, '#A2AB90']]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(236,229,214,.5)'; ctx.fillRect(0, h * 0.46, w, h * 0.3);
      ctx.strokeStyle = 'rgba(236,229,214,.9)'; ctx.lineWidth = 3;
      for (let x = w * 0.04; x < w; x += w * 0.24) ctx.strokeRect(x, h * 0.48, w * 0.2, h * 0.24);
      const arts = [['#7E2A1E', '#D9A38A'], ['#1F3A34', '#C8A15A'], ['#C98F4E', '#ECE5D6'], ['#2B4541', '#9DB6BD'], ['#D9A38A', '#7E2A1E']];
      const pos = [[0.12, 0.1, 0.16, 0.2], [0.33, 0.07, 0.22, 0.14], [0.33, 0.25, 0.1, 0.08], [0.47, 0.25, 0.08, 0.08], [0.6, 0.1, 0.24, 0.23]];
      pos.forEach((p, i) => frameArt(ctx, w * p[0], h * p[1], w * p[2], h * p[3], arts[i]));
      const fy = h * 0.76;
      ctx.fillStyle = lin(ctx, 0, fy, 0, h, [[0, '#8E6547'], [1, '#5E402C']]); ctx.fillRect(0, fy, w, h - fy);
      bed(ctx, w * 0.06, h * 0.66, w * 0.36, h * 0.13, C.porpora, '#F7F2E8', '#C8A15A');
      bed(ctx, w * 0.56, h * 0.66, w * 0.36, h * 0.13, C.porpora, '#F7F2E8', '#C8A15A');
      ctx.fillStyle = '#4A3326'; ctx.fillRect(w * 0.45, h * 0.62, w * 0.09, h * 0.16);
      lamp(ctx, w * 0.495, h * 0.6, w * 0.03);
    },

    singola(ctx, w, h, r) {
      ctx.fillStyle = lin(ctx, 0, 0, w, 0, [[0, '#8C3526'], [1, '#6E251A']]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#E7DBC5'; ctx.fillRect(w * 0.52, 0, w * 0.48, h);
      ctx.fillStyle = '#D3C3A6'; ctx.fillRect(w * 0.58, h * 0.12, w * 0.34, h * 0.4);
      ctx.fillStyle = lin(ctx, 0, h * 0.12, 0, h * 0.52, [[0, '#A8C1C6'], [1, '#F2D6B0']]);
      ctx.fillRect(w * 0.6, h * 0.14, w * 0.3, h * 0.36);
      ctx.fillStyle = 'rgba(40,30,25,.35)';
      for (let y = h * 0.15; y < h * 0.5; y += h * 0.028) ctx.fillRect(w * 0.6, y, w * 0.3, h * 0.008);
      const fy = h * 0.74;
      ctx.fillStyle = lin(ctx, 0, fy, 0, h, [[0, '#A77955'], [1, '#6D4A32']]); ctx.fillRect(0, fy, w, h - fy);
      lightShaft(ctx, w * 0.6, h * 0.5, w * 0.3, h * 0.45, -w * 0.25);
      bed(ctx, w * 0.05, h * 0.64, w * 0.38, h * 0.13, C.patina, '#F6F1E7', C.oro);
      ctx.fillStyle = '#3E2B20'; ctx.fillRect(w * 0.6, h * 0.58, w * 0.3, h * 0.025);
      ctx.fillRect(w * 0.62, h * 0.6, w * 0.015, h * 0.16); ctx.fillRect(w * 0.87, h * 0.6, w * 0.015, h * 0.16);
      ctx.fillStyle = C.patina; ctx.beginPath(); ctx.roundRect(w * 0.68, h * 0.55, w * 0.12, h * 0.2, 10); ctx.fill();
      lamp(ctx, w * 0.84, h * 0.58, w * 0.03);
      frameArt(ctx, w * 0.14, h * 0.2, w * 0.2, h * 0.24, ['#ECE5D6', '#C98F4E']);
    },

    bagno(ctx, w, h, r) {
      ctx.fillStyle = '#E4DBCB'; ctx.fillRect(0, 0, w, h);
      const t = w / 9;
      for (let y = 0; y < h; y += t * 1.4) for (let x = 0; x < w; x += t) {
        const k = r() * 22;
        ctx.fillStyle = `rgb(${214 + k},${203 + k},${184 + k})`;
        ctx.fillRect(x + 1.5, y + 1.5, t - 3, t * 1.4 - 3);
      }
      ctx.fillStyle = 'rgba(160,140,110,.15)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 30 + r() * 80, 2 + r() * 4, r() * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#9B8F80'; ctx.fillRect(w * 0.55, h * 0.06, w * 0.02, h * 0.12);
      ctx.fillRect(w * 0.36, h * 0.06, w * 0.21, h * 0.015);
      ctx.fillStyle = '#B6AC9E'; ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.085, w * 0.13, h * 0.018, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const x = w * 0.24 + r() * w * 0.24, y = h * 0.12 + r() * h * 0.6;
        ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 20 + r() * 50); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(200,225,230,.18)'; ctx.fillRect(w * 0.62, h * 0.05, w * 0.02, h * 0.95);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(w * 0.64, h * 0.05, w * 0.2, h * 0.95);
      ctx.fillStyle = C.oro; ctx.fillRect(w * 0.7, h * 0.46, w * 0.22, h * 0.012);
      ctx.fillStyle = C.patina; ctx.beginPath(); ctx.roundRect(w * 0.72, h * 0.47, w * 0.16, h * 0.26, 8); ctx.fill();
      ctx.fillStyle = 'rgba(236,229,214,.35)'; ctx.fillRect(w * 0.72, h * 0.66, w * 0.16, h * 0.02);
      ctx.fillStyle = lin(ctx, 0, h * 0.84, 0, h, [[0, '#8C8274'], [1, '#6F6558']]); ctx.fillRect(0, h * 0.86, w, h * 0.14);
    },

    colazione(ctx, w, h, r) {
      ctx.fillStyle = '#EDE6D9'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,110,95,.18)';
      for (let i = 0; i < 18; i++) {
        ctx.lineWidth = 1 + r() * 3; ctx.beginPath(); let x = r() * w, y = 0; ctx.moveTo(x, y);
        while (y < h) { x += (r() - 0.5) * 80; y += 40 + r() * 60; ctx.lineTo(x, y); } ctx.stroke();
      }
      const cx = w * 0.42, cy = h * 0.46, s = w * 0.2;
      ctx.fillStyle = 'rgba(40,30,20,.14)'; ctx.beginPath(); ctx.arc(cx + 14, cy + 18, s * 1.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F8F4EC'; ctx.beginPath(); ctx.arc(cx, cy, s * 1.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.oro; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, s * 1.3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rad(ctx, cx, cy, 0, s * 0.8, [[0, '#F3E6D2'], [0.55, '#D9B48C'], [1, '#8A5A36']]);
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(138,90,54,.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4);
      ctx.bezierCurveTo(cx - s * 0.45, cy - s * 0.3, cx - s * 0.2, cy + s * 0.25, cx, cy + s * 0.35);
      ctx.bezierCurveTo(cx + s * 0.2, cy + s * 0.25, cx + s * 0.45, cy - s * 0.3, cx, cy - s * 0.4); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(cx + s * 0.9, cy - s * 0.14, s * 0.5, s * 0.28, 12); ctx.fill();
      ctx.save(); ctx.translate(w * 0.72, h * 0.78); ctx.rotate(-0.4);
      ctx.fillStyle = 'rgba(40,30,20,.15)'; ctx.beginPath(); ctx.ellipse(10, 14, s * 1.1, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = -3; i <= 3; i++) {
        const k = 1 - Math.abs(i) / 4.2;
        ctx.fillStyle = lin(ctx, 0, -s * 0.4 * k, 0, s * 0.4 * k, [[0, '#E3A55A'], [1, '#A0602A']]);
        ctx.beginPath(); ctx.ellipse(i * s * 0.27, 0, s * 0.19, s * 0.45 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = C.oro; ctx.save(); ctx.translate(w * 0.16, h * 0.78); ctx.rotate(0.5);
      ctx.fillRect(-s * 0.9, -4, s * 1.4, 8); ctx.beginPath(); ctx.ellipse(s * 0.6, 0, s * 0.2, s * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },

    dettaglio(ctx, w, h, r) {
      ctx.fillStyle = lin(ctx, 0, 0, w, h, [[0, '#2B4541'], [1, '#172C27']]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.3, h * 0.2, 0, w * 0.9, [[0, 'rgba(255,220,170,.35)'], [1, 'rgba(255,220,170,0)']]); ctx.fillRect(0, 0, w, h);
      const ty = h * 0.7;
      ctx.fillStyle = lin(ctx, 0, ty, 0, h, [[0, '#E9E0CF'], [1, '#C7B9A0']]); ctx.fillRect(0, ty, w, h - ty);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, ty, w, 6);
      ctx.strokeStyle = 'rgba(120,105,85,.3)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(r() * w, ty); ctx.bezierCurveTo(r() * w, ty + 60, r() * w, ty + 120, r() * w, h); ctx.stroke(); }
      ctx.strokeStyle = '#6B5A3E'; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath(); ctx.moveTo(w * 0.62, ty - h * 0.22);
        const ex = w * 0.62 + (r() - 0.5) * w * 0.55, ey = ty - h * 0.45 - r() * h * 0.2;
        ctx.quadraticCurveTo(w * 0.62 + (ex - w * 0.62) * 0.2, ey + h * 0.1, ex, ey); ctx.stroke();
        ctx.fillStyle = r() > 0.5 ? '#EDE6D8' : '#D9A38A';
        for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(ex + (r() - 0.5) * 40, ey + (r() - 0.5) * 40, 6 + r() * 7, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.fillStyle = lin(ctx, w * 0.54, 0, w * 0.7, 0, [[0, '#B98A48'], [0.5, '#E3C27E'], [1, '#8E6630']]);
      ctx.beginPath(); ctx.moveTo(w * 0.585, ty - h * 0.22);
      ctx.bezierCurveTo(w * 0.5, ty - h * 0.12, w * 0.54, ty, w * 0.58, ty);
      ctx.lineTo(w * 0.66, ty); ctx.bezierCurveTo(w * 0.7, ty, w * 0.74, ty - h * 0.12, w * 0.655, ty - h * 0.22); ctx.fill();
      const books = ['#7E2A1E', '#ECE5D6', '#C8A15A', '#1F3A34'];
      books.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(w * 0.14 - i * 4, ty - (i + 1) * h * 0.035, w * 0.28, h * 0.033); });
      ctx.fillStyle = C.oro; ctx.beginPath(); ctx.arc(w * 0.22, ty - h * 0.17, w * 0.028, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#172C27'; ctx.beginPath(); ctx.arc(w * 0.22, ty - h * 0.17, w * 0.013, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.oro; ctx.fillRect(w * 0.22 - 3, ty - h * 0.15, 6, h * 0.02);
      ctx.fillStyle = 'rgba(200,161,90,.9)';
      ctx.font = `italic 500 ${Math.round(w * 0.05)}px "Bodoni Moda", Didot, serif`;
      ctx.fillText('76', w * 0.26, ty - h * 0.145);
    },

    facciata(ctx, w, h, r) {
      sky(ctx, w, h, [[0, '#8DA7B0'], [1, '#EAD0AE']]);
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#D8A870'], [1, '#C18A55']]);
      ctx.fillRect(w * 0.04, h * 0.08, w * 0.92, h * 0.92);
      ctx.fillStyle = '#E8D9BD'; ctx.fillRect(w * 0.02, h * 0.06, w * 0.96, h * 0.03);
      for (let i = 0; i < 30; i++) ctx.fillRect(w * 0.03 + i * w * 0.032, h * 0.09, w * 0.018, h * 0.015);
      ctx.fillRect(w * 0.04, h * 0.66, w * 0.92, h * 0.012);
      const cols = 4, rows = 3, ww = w * 0.12, wh = h * 0.14;
      for (let rI = 0; rI < rows; rI++) for (let c = 0; c < cols; c++) {
        const x = w * 0.12 + c * w * 0.22, y = h * 0.16 + rI * h * 0.17;
        ctx.fillStyle = '#E8D9BD'; ctx.fillRect(x - 8, y - 8, ww + 16, wh + 12);
        ctx.beginPath();
        if (rI === 0) { ctx.moveTo(x - 14, y - 10); ctx.lineTo(x + ww / 2, y - 34); ctx.lineTo(x + ww + 14, y - 10); }
        else { ctx.ellipse(x + ww / 2, y - 10, ww / 2 + 14, 22, 0, Math.PI, 0); }
        ctx.fill();
        ctx.fillStyle = '#2F4E43'; ctx.fillRect(x, y, ww, wh);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
        for (let s = 6; s < wh; s += 8) { ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x + ww, y + s); ctx.stroke(); }
        ctx.fillStyle = '#E8D9BD'; ctx.fillRect(x + ww / 2 - 2, y, 4, wh);
        if (rI === 1) {
          ctx.fillStyle = '#E8D9BD'; ctx.fillRect(x - 16, y + wh, ww + 32, 10);
          ctx.strokeStyle = '#2A2521'; ctx.lineWidth = 2;
          for (let b = x - 12; b < x + ww + 16; b += 9) { ctx.beginPath(); ctx.moveTo(b, y + wh - 26); ctx.lineTo(b, y + wh); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(x - 14, y + wh - 26); ctx.lineTo(x + ww + 14, y + wh - 26); ctx.stroke();
        }
      }
      ctx.fillStyle = '#B98352';
      for (let y = h * 0.68; y < h; y += h * 0.035) ctx.fillRect(w * 0.04, y, w * 0.92, 2);
      const dx = w * 0.38, dw = w * 0.24, dy = h * 0.74;
      ctx.fillStyle = '#E8D9BD'; archPath(ctx, dx - 16, dy - 16, dw + 32, h - dy + 16); ctx.fill();
      ctx.fillStyle = '#3A2A20'; archPath(ctx, dx, dy, dw, h - dy); ctx.fill();
      ctx.strokeStyle = 'rgba(200,161,90,.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy + dw * 0.4); ctx.lineTo(dx + dw / 2, h); ctx.stroke();
      ctx.strokeRect(dx + dw * 0.1, dy + dw * 0.62, dw * 0.3, h * 0.08);
      ctx.strokeRect(dx + dw * 0.6, dy + dw * 0.62, dw * 0.3, h * 0.08);
      ctx.fillStyle = C.oro;
      ctx.font = `500 ${Math.round(w * 0.055)}px "Bodoni Moda", Didot, serif`;
      ctx.textAlign = 'center'; ctx.fillText('76', dx + dw / 2, dy - h * 0.035); ctx.textAlign = 'left';
      lamp(ctx, dx - w * 0.06, dy + h * 0.02, w * 0.02); lamp(ctx, dx + dw + w * 0.06, dy + h * 0.02, w * 0.02);
    },

    colonnato(ctx, w, h, r) {
      sky(ctx, w, h, [[0, '#6F8E9A'], [0.7, '#EBCFAB'], [1, '#F2DDBF']]);
      const vx = w * 0.82, vy = h * 0.52;
      ctx.fillStyle = lin(ctx, 0, vy, 0, h, [[0, '#CDBB9C'], [1, '#9C8A6C']]); ctx.fillRect(0, vy, w, h - vy);
      ctx.strokeStyle = 'rgba(80,65,45,.3)'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(-w * 0.5 + i * w * 0.2, h); ctx.stroke(); }
      for (let i = 0; i < 12; i++) {
        const t = Math.pow(0.8, i), x = vx - (vx + w * 0.1) * t, cw = w * 0.1 * t, top = vy - h * 0.5 * t, bot = vy + h * 0.46 * t;
        ctx.fillStyle = lin(ctx, x - cw / 2, 0, x + cw / 2, 0, [[0, '#8C7A60'], [0.4, '#EFE3CC'], [1, '#B5A283']]);
        ctx.fillRect(x - cw / 2, top, cw, bot - top);
        ctx.fillStyle = '#E4D6BC'; ctx.fillRect(x - cw * 0.7, top - cw * 0.3, cw * 1.4, cw * 0.3);
        ctx.fillRect(x - cw * 0.65, bot - cw * 0.2, cw * 1.3, cw * 0.2);
      }
      ctx.fillStyle = '#E4D6BC'; ctx.beginPath(); ctx.moveTo(0, h * 0.02); ctx.lineTo(vx, vy - h * 0.06); ctx.lineTo(vx, vy - h * 0.04); ctx.lineTo(0, h * 0.13); ctx.fill();
      ctx.fillStyle = 'rgba(70,60,50,.35)';
      for (let i = 0; i < 9; i++) { const t = Math.pow(0.8, i + 0.5), x = vx - (vx + w * 0.1) * t; ctx.beginPath(); ctx.ellipse(x, vy - h * 0.53 * t, w * 0.012 * t * 2, h * 0.03 * t, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(120,100,80,.8)'; ctx.fillRect(w * 0.9, vy - h * 0.2, w * 0.018, h * 0.2);
      ctx.beginPath(); ctx.moveTo(w * 0.9, vy - h * 0.2); ctx.lineTo(w * 0.909, vy - h * 0.23); ctx.lineTo(w * 0.918, vy - h * 0.2); ctx.fill();
    },

    castel(ctx, w, h, r) {
      sky(ctx, w, h, [[0, '#304A4A'], [0.5, '#C68B76'], [0.75, '#F1C99C'], [1, '#EEC393']]);
      const cx = w * 0.5, by = h * 0.58;
      ctx.fillStyle = '#5A4540';
      ctx.fillRect(cx - w * 0.34, by - h * 0.12, w * 0.68, h * 0.12);
      ctx.fillRect(cx - w * 0.22, by - h * 0.26, w * 0.44, h * 0.15);
      for (let x = cx - w * 0.22; x < cx + w * 0.22; x += w * 0.03) ctx.fillRect(x, by - h * 0.28, w * 0.018, h * 0.02);
      ctx.fillRect(cx - w * 0.08, by - h * 0.36, w * 0.16, h * 0.1);
      ctx.fillRect(cx - w * 0.012, by - h * 0.44, w * 0.024, h * 0.08);
      ctx.beginPath(); ctx.moveTo(cx - w * 0.06, by - h * 0.42); ctx.quadraticCurveTo(cx - w * 0.02, by - h * 0.47, cx, by - h * 0.44);
      ctx.quadraticCurveTo(cx + w * 0.02, by - h * 0.47, cx + w * 0.06, by - h * 0.42); ctx.lineTo(cx, by - h * 0.43); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,150,.6)';
      for (let i = 0; i < 9; i++) ctx.fillRect(cx - w * 0.19 + i * w * 0.045, by - h * 0.2, w * 0.012, h * 0.025);
      const ry = by + h * 0.06;
      ctx.fillStyle = '#4C3A35'; ctx.fillRect(0, by, w, h * 0.06);
      ctx.fillStyle = lin(ctx, 0, ry, 0, h, [[0, '#5E6F6A'], [1, '#2A3B37']]); ctx.fillRect(0, ry, w, h - ry);
      ctx.fillStyle = '#6A5249'; ctx.fillRect(0, ry - h * 0.02, w, h * 0.04);
      for (let i = 0; i < 5; i++) {
        const ax = w * 0.02 + i * w * 0.2;
        ctx.fillStyle = '#2E3E3A'; ctx.beginPath(); ctx.ellipse(ax + w * 0.08, ry + h * 0.1, w * 0.07, h * 0.08, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#6A5249'; ctx.fillRect(ax, ry + h * 0.02, w * 0.02, h * 0.1);
        ctx.fillStyle = '#EDE4D3'; ctx.fillRect(ax + w * 0.004, ry - h * 0.07, w * 0.012, h * 0.05);
      }
      ctx.strokeStyle = 'rgba(241,201,156,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const y = ry + h * 0.14 + r() * (h - ry - h * 0.14), x = r() * w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + r() * 60, y); ctx.stroke(); }
    },

    cupola(ctx, w, h, r) {
      sky(ctx, w, h, [[0, '#1B302C'], [0.45, '#51615B'], [0.72, '#D59A76'], [1, '#F2C592']]);
      ctx.fillStyle = 'rgba(236,229,214,.8)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.35, r() * 1.6, 0, Math.PI * 2); ctx.fill(); }
      dome(ctx, w * 0.5, h * 0.72, w * 0.22, '#2B2522');
      ctx.fillStyle = 'rgba(255,214,150,.75)';
      for (let i = 0; i < 16; i++) ctx.fillRect(w * 0.5 - w * 0.15 + i * w * 0.02, h * 0.66, w * 0.007, h * 0.018);
      rooftops(ctx, w, h * 0.8, r, '#211D1B', 'rgba(255,206,140,.7)', w / 800);
      pine(ctx, w * 0.12, h * 0.84, w * 0.34, '#161412', r);
      pine(ctx, w * 0.9, h * 0.86, w * 0.26, '#161412', r);
    }
  };

  const cache = {};
  function draw(key, w, h, seed) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const r = rng(seed || key.length * 977);
    (scenes[key] || scenes.camera)(ctx, w, h, r);
    vignette(ctx, w, h, 0.35);
    grain(ctx, w, h, 0.18);
    return cv;
  }

  window.Plates = {
    keys: Object.keys(scenes),
    canvas(key, w = 900, h = 1200) {
      const id = key + w + 'x' + h;
      if (!cache[id]) cache[id] = draw(key, w, h);
      return cache[id];
    },
    src(key, w, h) {
      const cv = this.canvas(key, w, h);
      if (!cv.__src) cv.__src = cv.toDataURL('image/jpeg', 0.86);
      return cv.__src;
    }
  };
})();
