// Collega i dati di content.js all'HTML e calcola "aperto ora" sull'ora di Roma.

import { BUSINESS, HOURS, DELIVERY } from '../content.js';

const DATA = { ...BUSINESS, deliveryFrom: DELIVERY.from, deliveryTo: DELIVERY.to, ordersFrom: DELIVERY.ordersFrom };
const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function waLink(text) {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function bindContent() {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const v = DATA[el.dataset.bind];
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-bind-href]').forEach((el) => {
    const v = DATA[el.dataset.bindHref];
    if (v) el.setAttribute('href', v);
  });
  document.querySelectorAll('[data-wa-generic]').forEach((el) => {
    el.href = waLink(`Ciao ${BUSINESS.name}! Vorrei fare un ordine.`);
  });
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  if (BUSINESS.vat) document.querySelectorAll('[data-vat]').forEach((el) => (el.textContent = ` · P.IVA ${BUSINESS.vat}`));
  const credits = document.querySelector('[data-credits]');
  if (credits && BUSINESS.credits?.name) {
    credits.hidden = false;
    credits.innerHTML = 'Sito realizzato da ';
    const a = document.createElement(BUSINESS.credits.url ? 'a' : 'span');
    a.textContent = BUSINESS.credits.name;
    if (BUSINESS.credits.url) {
      a.href = BUSINESS.credits.url;
      a.target = '_blank';
      a.rel = 'noopener';
    }
    credits.append(a);
  }
}

function romeNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function openStatus() {
  const { day, minutes } = romeNow();
  const today = HOURS[day] || [];
  for (const [from, to] of today) {
    if (minutes >= toMin(from) && minutes < toMin(to)) {
      return { open: true, text: `Aperto · fino alle ${to}` };
    }
  }
  const later = today.find(([from]) => toMin(from) > minutes);
  if (later) return { open: false, text: `Chiuso · apre alle ${later[0]}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (HOURS[d]?.length) {
      const when = i === 1 ? 'domani' : DAY_NAMES[d].toLowerCase();
      return { open: false, text: `Chiuso · apre ${when} alle ${HOURS[d][0][0]}` };
    }
  }
  return { open: false, text: 'Chiuso' };
}

export function initHours() {
  const update = () => {
    const s = openStatus();
    document.querySelectorAll('[data-open-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
      el.querySelector('[data-open-text]').textContent = s.text;
    });
  };
  update();
  setInterval(update, 60_000);

  const body = document.querySelector('[data-hours-body]');
  if (!body) return;
  const { day } = romeNow();
  body.innerHTML = '';
  for (const d of WEEK_ORDER) {
    const tr = document.createElement('tr');
    if (d === day) tr.className = 'is-today';
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = DAY_NAMES[d] + (d === day ? ' (oggi)' : '');
    const td = document.createElement('td');
    td.textContent = HOURS[d]?.length ? HOURS[d].map(([a, b]) => `${a} – ${b}`).join(' · ') : 'Chiuso';
    tr.append(th, td);
    body.append(tr);
  }
}
