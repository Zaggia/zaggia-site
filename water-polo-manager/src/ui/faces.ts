// Volti dei giocatori e dello staff: 108 ritratti generati con un motore AI di immagini (nessuno disegnato a mano).
// Ogni giocatore ha sempre lo stesso volto (scelto in modo deterministico dal suo id), coerente per
// provenienza ed età; con rose da migliaia di giocatori qualche volto può ripetersi.

const URLS = import.meta.glob('../assets/faces/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const BY_GROUP: Record<string, string[]> = {};
for (const [path, url] of Object.entries(URLS)) {
  const m = /\/([a-z])(\d+)\.webp$/.exec(path);
  if (!m) continue;
  (BY_GROUP[m[1]] ??= []).push(url);
}
for (const g of Object.keys(BY_GROUP)) BY_GROUP[g].sort();

// a = misti · b = mediterranei · c = veterani · d = balcanici · e = giovani talenti
// f = internazionali · g = italiani/francesi · h = spagnoli/greci/rumeni · s = staff
const NATION_GROUPS: Record<string, string[]> = {
  ITA: ['g', 'g', 'b', 'a'],
  FRA: ['g', 'a'],
  ESP: ['h', 'h', 'b'],
  GRE: ['h', 'h', 'b'],
  ROU: ['h', 'a'],
  MLT: ['h', 'b'],
  ARG: ['h', 'b', 'a'],
  ISR: ['h', 'b'],
  TUR: ['h', 'b'],
  HUN: ['d', 'd', 'a'],
  SRB: ['d', 'd', 'a'],
  CRO: ['d', 'd', 'a'],
  MNE: ['d', 'd', 'a'],
  SVK: ['d', 'a'],
  SVN: ['d', 'a'],
  UKR: ['d', 'a'],
  RUS: ['d', 'a'],
  BLR: ['d', 'a'],
  BUL: ['d', 'a'],
  ARM: ['d', 'h'],
  CZE: ['d', 'a'],
  AUT: ['d', 'a'],
  GER: ['d', 'a', 'g'],
  NED: ['a', 'f', 'd'],
  GBR: ['a', 'f'],
  USA: ['f', 'a'],
  AUS: ['f', 'a'],
  BRA: ['f', 'b'],
  GEO: ['f', 'd'],
  JPN: ['f'],
  CAN: ['f', 'a'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Volto di un giocatore: stesso id → stesso volto, sempre. */
export function faceFor(id: string, nationality: string, birthYear: number): string {
  const h = hash(id);
  const groups = NATION_GROUPS[nationality] ?? ['a', 'f', 'g'];
  let g = groups[h % groups.length];
  const r = (h >>> 8) % 100;
  if (birthYear >= 2004 && r < 55) g = 'e';
  else if (birthYear <= 1992 && r < 45) g = 'c';
  const list = BY_GROUP[g] ?? BY_GROUP.a;
  return list[(h >>> 16) % list.length];
}

/** Volto di un allenatore o di un membro dello staff. */
export function staffFaceFor(id: string): string {
  const list = BY_GROUP.s;
  return list[hash(id) % list.length];
}

export const FACE_COUNT = Object.values(BY_GROUP).reduce((n, l) => n + l.length, 0);
