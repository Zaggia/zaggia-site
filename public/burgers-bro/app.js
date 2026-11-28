/* Burger's Bró – interfaccia: menu, ricerca, specialità, promo, galleria, mappa. */
(() => {
  'use strict';
  const M = window.BRO_MENU;
  if (!M) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const price = v => eur.format(v);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- dati ---------- */
  const AYCE = 'All You Can Eat € 15,00 per Persona';
  const HIDDEN = new Set(['Allergeni', 'November VEG']); // mostrati altrove nella pagina
  const SHORT = {
    [AYCE]: 'All You Can Eat', 'LIQUORI (Dopo Pasto)': 'Liquori',
    'Componi il Tuo Panino': 'Componi il panino', 'Componi il tuo Panino Veg': 'Componi Veg', 'Le nostre Birre': 'Birre'
  };
  const cats = M.cats.map((c, ci) => ({ ...c, ci, veg: /veg/i.test(c.n) }));
  const cat = name => cats.find(c => c.n === name);
  const item = (catName, itemName) => { const c = cat(catName); return c && c.items.find(i => i.n === itemName); };
  const priced = c => (c ? c.items.filter(i => i.p != null).length : 0);
  const isNote = it => it.p == null && /^(regole|per ogni)/i.test(it.n);
  const ingText = it => (it.i ? it.i.join(',').split(',').map(s => s.trim().replace(/\.$/, '')).filter(Boolean).join(', ') : '');
  const key = s => norm(s).replace(/[^a-z0-9]/g, '');
  function descText(it) {
    // righe spezzate a metà frase nel menu originale: si riuniscono
    const lines = (it.d || '').split('\n').reduce((acc, l) => {
      const prev = acc[acc.length - 1];
      if (prev && !/[.!?:;)]$/.test(prev) && /^[a-zà-ù(]/.test(l)) acc[acc.length - 1] = `${prev} ${l}`;
      else acc.push(l);
      return acc;
    }, []).filter(Boolean);
    let d = lines.join('\n');
    // elenchi "un ingrediente per riga" diventano una riga sola
    if (lines.length >= 3 && lines.every(l => l.length <= 44)) {
      d = lines.reduce((acc, l, i) => {
        const prev = lines[i - 1];
        const sep = i === 0 ? '' : /:$/.test(prev) ? ' ' : ', ';
        return acc + sep + l.replace(/[,;.]$/, '');
      }, '');
    }
    const ing = ingText(it);
    if (ing && !(d && key(d).includes(key(ing).slice(0, 20)))) d = d ? `${d}\n${ing}` : ing;
    return d;
  }
  const imgTag = (img, alt, cls = '', eager = false) => img
    ? `<img class="${cls}" src="${esc(img.src)}" width="${img.w}" height="${img.h}" alt="${esc(alt)}" ${eager ? '' : 'loading="lazy"'} decoding="async">`
    : '';
  const large = id => M.large[id] ? M.large[id] : null;
  const idOf = img => (img && img.src.match(/(\d+(?:_\d+)?)\.webp$/) || [])[1];

  /* ---------- navigazione ---------- */
  const nav = $('.nav');
  const toggle = $('#navToggle');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const setNav = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi il menu di navigazione' : 'Apri il menu di navigazione');
  };
  toggle.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => setNav(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

  /* ---------- numeri ---------- */
  const stats = [
    ['Panini Special', 'Panini special'], ['Zingare', 'Zingare'], ['Panini Vegan', 'Panini vegan'], ['Dolci', 'Dolci']
  ].map(([n, label]) => [priced(cat(n)), label]).filter(([n]) => n > 0);
  $('#stats').innerHTML = stats.map(([n, l]) => `<div><dt>${esc(l)}</dt><dd data-n="${n}">${n}</dd></div>`).join('');

  /* ---------- carte con foto ---------- */
  function card(catName, itemName, tag, veg) {
    const it = item(catName, itemName);
    if (!it || !it.img) return '';
    const ci = cat(catName).ci, ii = cat(catName).items.indexOf(it);
    const ing = ingText(it) || descText(it).replace(/\n/g, ', ');
    return `<button class="card" type="button" data-lb="${ci}:${ii}" aria-label="${esc(it.n)}${it.p != null ? `, ${price(it.p)}` : ''}: apri la scheda">
      ${imgTag(it.img, it.n)}
      ${it.p != null ? `<span class="card__price">${price(it.p)}</span>` : ''}
      <span class="card__body">
        <span class="card__tag${veg ? ' card__tag--veg' : ''}">${esc(tag)}</span>
        <span class="card__name">${esc(it.n)}</span>
        <span class="card__ing">${esc(ing)}</span>
      </span>
    </button>`;
  }
  $('#signature').innerHTML = [
    ['Panini Special', 'Burger’s Bró', 'Panino special'],
    ['Panini Special', 'Carrozzella', 'Panino special'],
    ['Panini Special', 'Steakhouse', 'Panino special'],
    ['Zingare', 'Pistacchione', 'Zingara · La classica'],
    ['Zingare', 'O Chiappariell', 'Zingara · La classica'],
    [AYCE, 'Panino Il Nero', 'Panino'],
    ['Zingare', 'Ischitana', 'Zingara · La classica'],
    ['Piadine', 'Apollon', 'Piadina special']
  ].map(([c, i, t]) => card(c, i, t)).join('');

  $('#vegGrid').innerHTML = [
    ['Panini Vegan', 'Crunchy Krave'], ['Panini Vegan', 'The Color'],
    ['Panini Vegan', 'PARMIGIANA GANG'], ['Panini Vegan', 'Bistecca umami Veg alla Griglia']
  ].map(([c, i]) => card(c, i, 'Veg', true)).join('');
  const vegCounts = [['Antipasti Vegan', 'antipasti'], ['Panini Vegan', 'panini'], ['Zingare Veg', 'zingare']]
    .map(([n, l]) => [priced(cat(n)), l]).filter(([n]) => n);
  if (vegCounts.length) {
    const list = vegCounts.map(([n, l]) => `${n} ${l}`);
    const last = list.pop();
    $('#vegLead').textContent = `Nel menu veg: ${list.length ? `${list.join(', ')} e ${last}` : last}, più piadina, tagliata e panino da comporre.`;
  }

  /* ---------- componi il tuo panino ---------- */
  const base = item('Componi il Tuo Panino', 'Carne + Contorno + Formaggio');
  const extra = item('Componi il Tuo Panino', 'Per ogni Ingrediente Aggiunto si Applicano i Seguenti Costi');
  const baseVeg = cat('Componi il tuo Panino Veg') && cat('Componi il tuo Panino Veg').items.find(i => i.p != null);
  if (base && base.v) {
    $('#buildPrice').textContent = `da ${price(base.p)}`;
    const parts = [];
    if (extra && extra.d) parts.push(`Ingredienti in più: ${extra.d.split('\n').join(' · ')}.`);
    if (baseVeg) parts.push(`Versione veg: ${price(baseVeg.p)}.`);
    $('#buildNote').textContent = parts.join(' ');
    $('#buildCols').innerHTML = base.v.map(g => `<div class="opt"><h3>${esc(g.n)}</h3><ul>${g.o.map(([n, d]) =>
      `<li>${esc(n.replace(/\.$/, ''))}${d ? `<b>+${price(d)}</b>` : ''}</li>`).join('')}</ul></div>`).join('');
  } else {
    $('#componi').remove();
  }

  /* ---------- promo ---------- */
  const promo = [];
  const ayce = cat(AYCE);
  if (ayce) {
    const rules = item(AYCE, 'REGOLE ALL YOU CAN EAT');
    const cost = (AYCE.match(/€\s*([\d,]+)/) || [])[1] || '15,00';
    const poster = large('1715100919');
    // Regole riassunte fedelmente dal testo del menu del locale
    promo.push(`<article class="pcard reveal">
      <div class="pcard__txt">
        <p class="pcard__when">${esc(rules && rules.b ? rules.b.toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Dal martedì al giovedì')}</p>
        <h2>All You Can Eat</h2>
        <p class="pcard__price">${esc(cost.replace(/,00$/, ''))} €<small>a persona</small></p>
        <ul>
          <li>Coperto incluso, bibite escluse. Partecipa tutto il tavolo, una consumazione a testa.</li>
          <li>A ogni giro: una patata a scelta più un panino, una zingara o una piadina a persona.</li>
          <li>Giri ad oltranza, il prezzo non cambia. I panini non si modificano.</li>
          <li>Dal secondo giro va finito tutto, altrimenti si paga quello che resta.</li>
        </ul>
      </div>
      <div class="pcard__img">${poster ? imgTag(poster, 'Locandina All You Can Eat di Burger’s Bró') : ''}</div>
    </article>`);
  }
  const nov = M.cats.find(c => c.n === 'November VEG');
  if (nov && new Date().getMonth() === 10) { // la promo è di novembre
    const it = nov.items[0];
    const poster = large('1793823865');
    promo.push(`<article class="pcard pcard--veg reveal">
      <div class="pcard__txt">
        <p class="pcard__when">${esc(it.b ? it.b.toLowerCase().replace(/^./, c => c.toUpperCase()) : '')}</p>
        <h2>November Veg</h2>
        <p class="pcard__price">${esc(price(it.p).replace(/,00/, ''))}<small>ogni panino veg</small></p>
        <ul><li>Tutti i panini veg a ${esc(price(it.p))}, tranne il Double Brò e il PokePanino.</li></ul>
      </div>
      <div class="pcard__img">${poster ? imgTag(poster, 'Locandina November Veg di Burger’s Bró') : ''}</div>
    </article>`);
  }
  if (promo.length) $('#promoGrid').innerHTML = promo.join(''); else $('#promo').remove();

  /* ---------- menu completo ---------- */
  const menuCats = cats.filter(c => !HIDDEN.has(c.n) && c.items.length);
  { // l'All You Can Eat ha già la sua sezione: nel menu va dopo i piatti, prima di liquori e bevande
    const a = menuCats.findIndex(c => c.n === AYCE);
    const before = menuCats.findIndex(c => /liquori/i.test(c.n));
    if (a > -1 && before > a) menuCats.splice(before - 1, 0, menuCats.splice(a, 1)[0]);
  }
  const chipsEl = $('#menuChips');
  const bodyEl = $('#menuBody');
  chipsEl.innerHTML = menuCats.map(c =>
    `<button class="chip${c.veg ? ' chip--veg' : ''}" type="button" data-c="${c.id}" aria-pressed="false" aria-controls="c-${c.id}">${esc(SHORT[c.n] || c.n)}</button>`).join('');

  function itemHTML(c, it, ii) {
    const d = descText(it);
    const search = norm([c.n, it.n, it.b, d, ...(it.v || []).flatMap(g => g.o.map(o => o[0]))].filter(Boolean).join(' '));
    if (isNote(it)) {
      return `<li class="mitem mitem--note" data-s="${esc(search)}">
        <div class="mitem__main">
          <h3 class="mitem__name">${esc(it.n)}</h3>
          ${it.b ? `<span class="mitem__tag">${esc(it.b)}</span>` : ''}
          ${d ? `<p class="mitem__desc">${esc(d)}</p>` : ''}
        </div></li>`;
    }
    const thumb = it.img ? `<button class="mitem__thumb" type="button" data-lb="${c.ci}:${ii}" aria-label="Foto: ${esc(it.n)}">${imgTag(it.img, it.n)}</button>` : '';
    const vars = it.v ? `<details><summary>Scegli tra ${it.v.reduce((a, g) => a + g.o.length, 0)} ingredienti</summary><div class="mvar">${it.v.map(g =>
      `<div><h4>${esc(g.n)}</h4><ul>${g.o.map(([n, dd]) => `<li>${esc(n.replace(/\.$/, ''))}${dd ? ` <b>+${price(dd)}</b>` : ''}</li>`).join('')}</ul></div>`).join('')}</div></details>` : '';
    return `<li class="mitem${it.img ? ' mitem--thumb' : ''}" data-s="${esc(search)}">
      ${thumb}
      <div class="mitem__main">
        <div class="mitem__top">
          <h3 class="mitem__name">${esc(it.n)}${it.f ? '<sup title="Potrebbe contenere ingredienti surgelati">*</sup>' : ''}</h3>
          ${it.p != null ? `<span class="mitem__dots" aria-hidden="true"></span><span class="mitem__price">${price(it.p)}</span>` : ''}
        </div>
        ${it.b ? `<span class="mitem__tag">${esc(it.b)}</span>` : ''}
        ${d ? `<p class="mitem__desc${d.length > 190 ? ' is-long' : ''}">${esc(d)}</p>${d.length > 190 ? '<button class="mitem__more" type="button" aria-expanded="false">Leggi tutto</button>' : ''}` : ''}
        ${vars}
      </div></li>`;
  }
  bodyEl.innerHTML = menuCats.map(c => {
    const n = priced(c);
    return `<section class="mcat" id="c-${c.id}" data-c="${c.id}" data-veg="${c.veg ? 1 : 0}" aria-labelledby="h-${c.id}">
      <header class="mcat__head">
        ${c.img ? imgTag(c.img, '', 'mcat__img') : ''}
        <h2 class="mcat__title" id="h-${c.id}">${esc(c.n)}</h2>
        ${c.veg ? '<span class="mcat__veg">Veg</span>' : ''}
        ${n ? `<span class="mcat__count">${n} ${n === 1 ? 'proposta' : 'proposte'}</span>` : ''}
      </header>
      <ul class="mlist">${c.items.map((it, ii) => itemHTML(c, it, ii)).join('')}</ul>
    </section>`;
  }).join('');
  $('#coverPrice').textContent = price(M.cover);

  // schede per categoria, ricerca su tutto il menu, filtro veg
  const search = $('#menuSearch');
  const vegBtn = $('#vegToggle');
  const empty = $('#menuEmpty');
  const sections = $$('.mcat', bodyEl);
  const chips = $$('.chip', chipsEl);
  let vegOnly = false;
  let current = menuCats[0] && String(menuCats[0].id);
  function render() {
    const q = norm(search.value.trim());
    let any = false;
    sections.forEach(sec => {
      const catOk = !vegOnly || sec.dataset.veg === '1';
      const showCat = catOk && (q ? true : sec.dataset.c === current);
      let shown = 0;
      $$('.mitem', sec).forEach(li => {
        const ok = showCat && (!q || li.dataset.s.includes(q));
        li.hidden = !ok;
        if (ok) shown++;
      });
      sec.hidden = shown === 0;
      if (shown) any = true;
    });
    chips.forEach(ch => {
      const sec = $(`#c-${ch.dataset.c}`);
      ch.hidden = vegOnly && sec.dataset.veg !== '1';
      const on = !q && ch.dataset.c === current;
      ch.classList.toggle('is-active', on);
      ch.setAttribute('aria-pressed', String(on));
    });
    empty.hidden = any;
    bodyEl.classList.toggle('is-search', !!q);
  }
  // rotella del mouse: scorre la barra delle categorie in orizzontale
  chipsEl.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || chipsEl.scrollWidth <= chipsEl.clientWidth) return;
    const max = chipsEl.scrollWidth - chipsEl.clientWidth;
    const next = Math.max(0, Math.min(max, chipsEl.scrollLeft + e.deltaY));
    if (next === chipsEl.scrollLeft) return; // ai bordi lascia scorrere la pagina
    e.preventDefault();
    chipsEl.scrollLeft = next;
  }, { passive: false });
  const centerChip = ch => chipsEl.scrollTo({ left: ch.offsetLeft - chipsEl.clientWidth / 2 + ch.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  const toMenuTop = () => { // riporta l'inizio della categoria sotto la barra, se l'utente è sceso
    const y = bodyEl.getBoundingClientRect().top + scrollY - chipsEl.offsetHeight - nav.offsetHeight - 8;
    if (scrollY > y + 4) scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  chipsEl.addEventListener('click', e => {
    const ch = e.target.closest('.chip');
    if (!ch) return;
    current = ch.dataset.c;
    if (search.value) search.value = '';
    render();
    centerChip(ch);
    toMenuTop();
  });
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 90); });
  vegBtn.addEventListener('click', () => {
    vegOnly = !vegOnly;
    vegBtn.setAttribute('aria-pressed', String(vegOnly));
    if (vegOnly && $(`#c-${current}`).dataset.veg !== '1') current = (sections.find(x => x.dataset.veg === '1') || sections[0]).dataset.c;
    render();
    const ch = $(`.chip[data-c="${current}"]`, chipsEl);
    if (ch) centerChip(ch);
    toMenuTop();
  });
  bodyEl.addEventListener('click', e => {
    const b = e.target.closest('.mitem__more');
    if (!b) return;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.previousElementSibling.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Mostra meno' : 'Leggi tutto';
  });
  render();

  /* ---------- galleria ---------- */
  const captions = {};
  cats.forEach(c => c.items.forEach(it => { const id = idOf(it.img); if (id && !captions[id]) captions[id] = it.n; }));
  const galleryIds = ['1735427478', '1721132391', '1721164930', '1721165109', '1721164847', '1746707657', '1731550508',
    '1721164993', '1794594639', '1721164881', '1731550423', '1773042915'];
  const thumbs = {};
  cats.forEach(c => c.items.forEach(it => { const id = idOf(it.img); if (id && !thumbs[id]) thumbs[id] = it.img; }));
  $('#gallery').innerHTML = galleryIds.filter(id => M.large[id]).map(id => {
    const name = captions[id] || 'Burger\u2019s Bró';
    return `<figure class="reveal"><button type="button" data-g="${id}" aria-label="Foto: ${esc(name)}">${imgTag(thumbs[id] || M.large[id], name)}</button>${captions[id] ? `<figcaption>${esc(captions[id])}</figcaption>` : ''}</figure>`;
  }).join('');

  /* ---------- scheda (lightbox) ---------- */
  const lb = $('#lightbox');
  const openLB = ({ img, cat: c, name, desc, p, f }) => {
    $('#lbImg').src = img.src;
    $('#lbImg').alt = name;
    $('#lbCat').textContent = c || '';
    $('#lbTitle').textContent = name;
    $('#lbDesc').textContent = desc || '';
    $('#lbPrice').textContent = p != null ? price(p) : '';
    $('#lbNote').hidden = !f;
    if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]');
    if (b) {
      const [ci, ii] = b.dataset.lb.split(':').map(Number);
      const c = M.cats[ci], it = c.items[ii];
      const big = large(idOf(it.img));
      openLB({ img: big || it.img, cat: [SHORT[c.n] || c.n, it.b].filter(Boolean).join(' · '), name: it.n, desc: descText(it), p: it.p, f: it.f });
      return;
    }
    const g = e.target.closest('[data-g]');
    if (g) {
      const id = g.dataset.g;
      let found = null;
      cats.some(c => c.items.some(it => (idOf(it.img) === id ? (found = { c, it }) : false)));
      openLB(found ? { img: M.large[id], cat: [SHORT[found.c.n] || found.c.n, found.it.b].filter(Boolean).join(' · '), name: found.it.n, desc: descText(found.it), p: found.it.p, f: found.it.f }
        : { img: M.large[id], name: 'Burger’s Bró' });
    }
  });
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => { $('#lbImg').removeAttribute('src'); });

  /* ---------- mappa (caricata solo su richiesta) ---------- */
  $('#mapLoad').addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.title = 'Mappa: Burger’s Bró, Via Santa Maria ai Monti 19, Napoli';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Burger’s Bró, Via Santa Maria ai Monti 19, 80141 Napoli') + '&output=embed';
    $('#map').replaceChildren(f);
  });

  /* ---------- nastro: contenuto duplicato per un giro senza scatti ---------- */
  const track = $('#tickerTrack');
  if (track) Array.from(track.children).forEach(n => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });

  /* ---------- didascalia hero ---------- */
  const sig = item('Panini Special', 'Burger’s Bró');
  if (sig) $('#heroCaption').innerHTML = `<b>${esc(sig.n)}</b>${esc(ingText(sig))} · ${price(sig.p)}`;

  /* ---------- comparse e contatori ---------- */
  const countUp = el => {
    const n = Number(el.dataset.n);
    if (reduceMotion || !n) return;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 1100);
      el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    if (e.target.matches('#stats')) $$('dd', e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  $$('.reveal').forEach(el => io.observe(el));
  io.observe($('#stats'));
})();
