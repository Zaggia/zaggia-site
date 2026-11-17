// Calendario: ogni stagione inizia il 1° luglio (giorno 0) e termina il 30 giugno.

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_LONG = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const WEEKDAYS_LONG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

const DAY_MS = 86_400_000;

export function seasonStart(season: number): number {
  return Date.UTC(season, 6, 1);
}

export function seasonLength(season: number): number {
  return Math.round((Date.UTC(season + 1, 6, 1) - seasonStart(season)) / DAY_MS);
}

export function dateOf(season: number, day: number): Date {
  return new Date(seasonStart(season) + day * DAY_MS);
}

/** 'MM-DD' → giorno della stagione (luglio-dicembre nell'anno di inizio, gennaio-giugno nel successivo). */
export function dayOf(season: number, mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number);
  const year = m >= 7 ? season : season + 1;
  return Math.round((Date.UTC(year, m - 1, d) - seasonStart(season)) / DAY_MS);
}

export function weekday(season: number, day: number): number {
  return dateOf(season, day).getUTCDay();
}

/** Primo giorno ≥ day che cade nel giorno della settimana indicato (0 = domenica). */
export function nextWeekday(season: number, day: number, wd: number): number {
  const cur = weekday(season, day);
  return day + ((wd - cur + 7) % 7);
}

export function formatDate(season: number, day: number, long = false): string {
  const d = dateOf(season, day);
  if (long) return `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShortDate(season: number, day: number): string {
  const d = dateOf(season, day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function monthOf(season: number, day: number): { year: number; month: number } {
  const d = dateOf(season, day);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function monthName(month: number, long = true): string {
  return long ? MONTHS_LONG[month] : MONTHS[month];
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
}

export function inRange(season: number, day: number, start: string, end: string): boolean {
  const a = dayOf(season, start);
  const b = dayOf(season, end);
  return day >= a && day <= b;
}
