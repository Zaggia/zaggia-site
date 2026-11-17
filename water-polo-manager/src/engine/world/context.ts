import { Rng } from '../rng';
import type { World } from '../types';

/** Contesto minimo per la generazione: generatore casuale, stagione e id progressivi. */
export interface GenCtx {
  rng: Rng;
  season: number;
  newId: (prefix: string) => string;
}

export function ctxOf(world: World): GenCtx {
  return {
    rng: new Rng(world),
    season: world.season,
    newId: (prefix: string) => `${prefix}${(world.nextId++).toString(36)}`,
  };
}

export function worldRng(world: World): Rng {
  return new Rng(world);
}

export function newId(world: World, prefix: string): string {
  return `${prefix}${(world.nextId++).toString(36)}`;
}
