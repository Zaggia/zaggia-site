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
