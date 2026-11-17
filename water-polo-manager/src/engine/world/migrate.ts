// Aggiornamento dei salvataggi creati con versioni precedenti del gioco.

import type { Role, World } from '../types';
import { computeOverall } from '../player/attributes';
import { trimRoster } from '../club/roster';
import { WORLD_VERSION } from './generate';

/** Porta un mondo salvato alla versione corrente. Restituisce true se è stato modificato. */
export function migrateWorld(world: World): boolean {
  const from = world.version ?? 1;
  if (from >= WORLD_VERSION) return false;
  if (from < 2) {
    // v2: ruoli della pallanuoto (mancino e centrovasca) e rose da 15 in ogni categoria.
    for (const p of Object.values(world.players)) {
      const old = p.role as string;
      if (old !== 'ESD' && old !== 'ESS') continue;
      let role: Role;
      if (old === 'ESD' && p.hand === 'L') role = 'MAN';
      else {
        const options: Role[] = ['CVA', 'ALA', 'UNI'];
        role = options.reduce((best, r) => (computeOverall(p.attrs, r) > computeOverall(p.attrs, best) ? r : best), options[0]);
      }
      p.role = role;
      p.overall = computeOverall(p.attrs, role);
      p.potential = Math.max(p.potential, p.overall);
    }
    world.rules.rosterSize = world.rules.rosterSize ?? 15;
    for (const club of Object.values(world.clubs)) if (!club.isUser) trimRoster(world, club);
  }
  world.version = WORLD_VERSION;
  return true;
}
