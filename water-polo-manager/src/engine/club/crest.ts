import type { CrestSpec } from '../types';
import type { Rng } from '../rng';

export const PALETTES: [string, string][] = [
  ['#0b3d91', '#ffffff'], ['#c8102e', '#ffffff'], ['#1d428a', '#f5c518'], ['#006847', '#ffffff'], ['#111827', '#e5e7eb'],
  ['#7a1f3d', '#f5c518'], ['#0ea5e9', '#0b1d3a'], ['#f97316', '#1f2937'], ['#14532d', '#fde047'], ['#581c87', '#ffffff'],
  ['#be123c', '#fcd34d'], ['#0f766e', '#ffffff'], ['#1e3a8a', '#ef4444'], ['#000000', '#facc15'], ['#2563eb', '#ffffff'],
  ['#991b1b', '#111827'], ['#065f46', '#f97316'], ['#334155', '#38bdf8'], ['#b45309', '#ffffff'], ['#4c1d95', '#fbbf24'],
  ['#0369a1', '#e0f2fe'], ['#9f1239', '#e2e8f0'], ['#166534', '#bbf7d0'], ['#1f2937', '#f43f5e'],
];

const SHAPES: CrestSpec['shape'][] = ['scudo', 'cerchio', 'esagono', 'rombo', 'scudoClassico'];
const PATTERNS: CrestSpec['pattern'][] = ['pieno', 'strisce', 'meta', 'banda', 'croce', 'onde', 'bordo'];
const SYMBOLS: CrestSpec['symbol'][] = ['palla', 'onda', 'tridente', 'stella', 'delfino', 'iniziali', 'corona', 'faro'];

export function randomCrest(rng: Rng, colors: [string, string], initials: string): CrestSpec {
  return {
    shape: rng.pick(SHAPES),
    pattern: rng.pick(PATTERNS),
    symbol: rng.pick(SYMBOLS),
    primary: colors[0],
    secondary: colors[1],
    initials: initials.slice(0, 3).toUpperCase(),
  };
}

export const CREST_SHAPES = SHAPES;
export const CREST_PATTERNS = PATTERNS;
export const CREST_SYMBOLS = SYMBOLS;

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stemma generato in modo stabile dal nome della società (nessun logo reale). */
export function crestFor(name: string, short: string, colors: [string, string]): CrestSpec {
  const h = hashName(name);
  const lower = name.toLowerCase();
  let symbol: CrestSpec['symbol'] = SYMBOLS[h % SYMBOLS.length];
  if (/canottieri|nautico|cn |marina|vela|marine/.test(lower)) symbol = 'onda';
  else if (/rari nantes|rn |nuoto/.test(lower) && h % 3 === 0) symbol = 'delfino';
  else if (/roma|imperium|olympic|real/.test(lower) && h % 2 === 0) symbol = 'corona';
  else if (/academy|giovani|cus /.test(lower)) symbol = 'iniziali';
  return {
    shape: SHAPES[(h >> 3) % SHAPES.length],
    pattern: PATTERNS[(h >> 6) % PATTERNS.length],
    symbol,
    primary: colors[0],
    secondary: colors[1],
    initials: short.slice(0, 3).toUpperCase(),
  };
}
