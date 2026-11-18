// Aggiornamento dei salvataggi creati con versioni precedenti del gioco.

import type { Role, World } from '../types';
import { computeOverall } from '../player/attributes';
import { teamStrength } from '../club/lineup';
import { Rng } from '../rng';
import { refreshValue } from '../player/value';
import { clamp } from '../util';
import { trimRoster } from '../club/roster';
import { WORLD_VERSION } from './generate';
import { DEFAULT_RULES } from '../data/config';
import { realifyWorld } from './migrateReal';

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
  if (from < 3) rebalanceDivisions(world);
  if (from < 4) {
    // v4: società e giocatori reali anche nelle carriere create prima.
    realifyWorld(world);
    world.flags.guideSeen = true;
  }
  if (from < 5) {
    // v5: in Serie B la promozione si decide ai playoff (prime 4 di ogni girone), non più con la sola prima classificata.
    const b = world.rules.leagues.find((l) => l.key === 'B');
    const def = DEFAULT_RULES.leagues.find((l) => l.key === 'B');
    if (b && def && !b.postseason.some((p) => p.purpose === 'promotion')) {
      b.directPromotion = def.directPromotion;
      b.postseason = JSON.parse(JSON.stringify(def.postseason));
    }
  }
  world.version = WORLD_VERSION;
  return true;
}

/** Nuovi intervalli di forza per categoria (gli stessi di una carriera nuova). */
const NEW_STRENGTH: Record<string, [number, number]> = { A2: [47, 62], B: [34, 52], C: [24, 45] };
/** Quanto allargare la distribuzione delle forze rispetto a quella attuale. */
const STRETCH: Record<string, number> = { A2: 1.15, B: 1.4, C: 1.4 };

/**
 * v3: nelle carriere nate prima della correzione la forza delle società seguiva l'elenco geografico (un girone
 * tutto forte, uno tutto debole) e nelle serie minori i livelli erano troppo vicini, così le ultime battevano
 * spesso le prime. Si rimescolano le forze tra le società di ogni categoria (la tua resta com'è) e si allarga
 * la forbice, spostando le caratteristiche dei giocatori di ogni società verso il nuovo livello.
 */
export function rebalanceDivisions(world: World): void {
  const rng = Rng.fromSeed((world.seed ^ 0x5eed1234) | 0);
  for (const lg of world.rules.leagues) {
    const range = NEW_STRENGTH[lg.key];
    if (range) lg.strength = [...range];
  }
  for (const key of Object.keys(NEW_STRENGTH)) {
    const clubs = Object.values(world.clubs).filter((c) => c.country === 'ITA' && c.division === key && !c.isUser);
    if (clubs.length < 4) continue;
    const now = clubs.map((c) => teamStrength(world, c));
    const mean = now.reduce((a, b) => a + b, 0) / now.length;
    // Le forze attuali vengono assegnate a caso alle società, poi allargate attorno alla media.
    const pool = rng.shuffle([...now]);
    const [lo, hi] = NEW_STRENGTH[key];
    clubs.forEach((c, i) => {
      const target = clamp(Math.round(mean + (pool[i] - mean) * STRETCH[key]), lo - 2, hi + 2);
      shiftClub(world, c.id, target);
    });
  }
}

export function shiftClub(world: World, clubId: string, target: number): void {
  const club = world.clubs[clubId];
  for (let pass = 0; pass < 4; pass++) {
    const delta = target - teamStrength(world, club);
    if (Math.abs(delta) < 0.6) break;
    for (const id of club.playerIds) {
      const p = world.players[id];
      if (!p) continue;
      for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = clamp(Math.round(p.attrs[k] + delta), 1, 99);
      p.overall = computeOverall(p.attrs, p.role);
      p.potential = Math.max(p.potential, p.overall);
      refreshValue(p, world.season);
    }
  }
}
