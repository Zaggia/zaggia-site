// Volti dei giocatori e dello staff: oltre 200 ritratti generati con un motore AI di immagini (nessuno disegnato a mano).
// Ogni giocatore ha sempre lo stesso volto per le stesse caratteristiche fisiche: si sceglie tra i volti compatibili
// con provenienza (tono della pelle), corporatura (peso e altezza → snello, medio, robusto) ed età, in modo
// deterministico dall'id. Con migliaia di giocatori qualche volto può ripetersi.

import { FACE_META } from './faceMeta';

const URLS = import.meta.glob('../assets/faces/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface FaceEntry { url: string; skin: number; build: number; age: number; sheet: string }

const ALL: FaceEntry[] = [];
const STAFF: string[] = [];
for (const [path, url] of Object.entries(URLS)) {
  const m = /\/([a-z])(\d+)\.webp$/.exec(path);
  if (!m) continue;
  if (m[1] === 's') { STAFF.push(url); continue; }
  const meta = FACE_META[m[1] + m[2]];
  if (!meta) continue;
  ALL.push({ url, skin: meta[0], build: meta[1], age: meta[2], sheet: m[1] });
}
ALL.sort((a, b) => (a.url < b.url ? -1 : 1));
STAFF.sort();

/** Probabilità (chiara, olivastra, scura) del tono della pelle per nazionalità. */
const NATION_SKIN: Record<string, [number, number, number]> = {
  ITA: [42, 54, 4], FRA: [45, 35, 20], ESP: [35, 62, 3], GRE: [35, 62, 3], ROU: [55, 43, 2], MLT: [30, 68, 2], ARG: [45, 50, 5],
  ISR: [20, 75, 5], TUR: [20, 75, 5], ARM: [30, 68, 2], GEO: [30, 68, 2], JPN: [20, 80, 0],
  HUN: [88, 12, 0], SRB: [85, 15, 0], CRO: [85, 15, 0], MNE: [80, 20, 0], SVK: [90, 10, 0], SVN: [90, 10, 0], UKR: [88, 12, 0],
  RUS: [90, 10, 0], BLR: [92, 8, 0], BUL: [75, 25, 0], CZE: [92, 8, 0], AUT: [92, 8, 0], GER: [85, 10, 5], NED: [85, 10, 5], GBR: [80, 12, 8],
  USA: [50, 25, 25], AUS: [65, 30, 5], BRA: [30, 35, 35], CAN: [60, 25, 15],
};
/** Provenienze per cui si preferiscono i volti dedicati (Asia e Medio Oriente). */
const EAST = new Set(['JPN', 'TUR', 'GEO', 'ARM', 'ISR']);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickSkin(nationality: string, h: number): number {
  const w = NATION_SKIN[nationality] ?? [60, 35, 5];
  const r = (h % 1000) / 10; // 0..100
  const total = w[0] + w[1] + w[2];
  const x = (r / 100) * total;
  return x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
}

/** Corporatura dal rapporto peso/altezza (IMC): in pallanuoto i valori vanno da circa 23 a 28. */
export function buildOf(height: number, weight: number): number {
  const bmi = weight / Math.pow(height / 100, 2);
  return bmi < 24.7 ? 0 : bmi > 26.4 ? 2 : 1;
}

function ageClass(birthYear: number): number {
  return birthYear >= 2004 ? 0 : birthYear <= 1992 ? 2 : 1;
}

/** Volto di un giocatore: stesse caratteristiche fisiche → stesso volto, sempre. */
export function faceFor(id: string, nationality: string, birthYear: number, height?: number, weight?: number): string {
  const h = hash(id);
  const skin = pickSkin(nationality, h);
  const build = height && weight ? buildOf(height, weight) : 1;
  const age = ageClass(birthYear);
  const east = EAST.has(nationality) && (h >>> 5) % 100 < 70;
  const pool = east ? ALL.filter((f) => f.sheet === 'q') : ALL;
  // Dal più preciso al più largo: pelle + corporatura + età, poi senza età, poi solo la pelle, infine tutti.
  const steps: ((f: FaceEntry) => boolean)[] = [
    (f) => f.skin === skin && f.build === build && f.age === age,
    (f) => f.skin === skin && f.build === build && Math.abs(f.age - age) <= 1,
    (f) => f.skin === skin && f.build === build,
    (f) => f.skin === skin && Math.abs(f.build - build) <= 1 && Math.abs(f.age - age) <= 1,
    (f) => f.skin === skin,
    () => true,
  ];
  for (const ok of steps) {
    const list = pool.filter(ok);
    if (list.length >= 3 || (ok === steps[steps.length - 1] && list.length)) return list[(h >>> 12) % list.length].url;
  }
  const all = ALL.length ? ALL : [{ url: '' }];
  return all[(h >>> 12) % all.length].url;
}

/** Volto di un allenatore o di un membro dello staff. */
export function staffFaceFor(id: string): string {
  return STAFF[hash(id) % STAFF.length];
}

export const FACE_COUNT = ALL.length + STAFF.length;
