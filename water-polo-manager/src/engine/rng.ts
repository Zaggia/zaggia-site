// Generatore pseudo-casuale deterministico (mulberry32) con stato serializzabile.
// Lo stato vive in un oggetto "holder" (es. il mondo o lo stato di una partita),
// così che salvando il mondo si salva anche la posizione del generatore.

export interface RngHolder {
  rng: number;
}

export class Rng {
  constructor(private h: RngHolder) {}

  static fromSeed(seed: number): Rng {
    return new Rng({ rng: seed | 0 });
  }

  get state(): number {
    return this.h.rng;
  }

  next(): number {
    let t = (this.h.rng = (this.h.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Intero in [min, max] inclusi. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Scelta pesata: restituisce l'indice. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return Math.floor(this.next() * weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  weighted<T>(arr: readonly T[], weight: (x: T) => number): T {
    return arr[this.weightedIndex(arr.map(weight))];
  }

  /** Normale (Box-Muller). */
  gauss(mean = 0, sd = 1): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Hash FNV-1a per derivare seed riproducibili (es. seed partita = hash(seed mondo, id partita)). */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}
