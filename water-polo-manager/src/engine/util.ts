export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));
export const round = (v: number, step = 1) => Math.round(v / step) * step;
export const sum = (arr: readonly number[]) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr: readonly number[]) => (arr.length ? sum(arr) / arr.length : 0);
export const topN = <T>(arr: readonly T[], n: number, key: (x: T) => number) =>
  [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);

/** Arrotonda una cifra in euro a un valore "da mercato" (es. 12.345 → 12.500). */
export function niceMoney(v: number): number {
  if (v <= 0) return 0;
  const mag = v < 10_000 ? 250 : v < 100_000 ? 1_000 : v < 1_000_000 ? 5_000 : 25_000;
  return Math.max(mag, Math.round(v / mag) * mag);
}

export function groupBy<T>(arr: readonly T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) (out[key(x)] ||= []).push(x);
  return out;
}
