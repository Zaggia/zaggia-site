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
import { PYRAMID_BANDS, balancePyramid, sustainTalent } from './pyramid';
import { ensureLuxuryFreeAgents } from '../season/start';
import { worldRng } from './context';
import { REAL_FOREIGN } from '../data/realClubs';
import { crestFor } from '../club/crest';
import { addForeignClub } from './generate';
import { ctxOf } from './context';
import { assignRealRosters } from './migrateReal';
import { TOP_CLUB_LEVELS, starRating } from '../data/playerRatings';
import { tuneOverall } from '../player/generate';
import { stretchOverall } from '../player/scale';

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
  if (from < 6) {
    // v6: piramide dei livelli: fasce di forza per categoria e giocatori vicini al livello della propria squadra.
    for (const lg of world.rules.leagues) {
      const band = PYRAMID_BANDS[lg.key];
      if (band) lg.strength = [...band];
    }
    balancePyramid(world);
  }
  if (from < 7) {
    // v7: coppe europee reali (Champions League con Final Four, Euro Cup, Conference Cup, Super Cup) e club europei veri.
    world.rules.continental = JSON.parse(JSON.stringify(DEFAULT_RULES.continental));
    const eusc = DEFAULT_RULES.cups.find((c) => c.key === 'EUSC');
    if (eusc && !world.rules.cups.some((c) => c.key === 'EUSC')) world.rules.cups.unshift(JSON.parse(JSON.stringify(eusc)));
    addEuropeanClubs(world);
  }
  if (from < 8) {
    // v8: stop all'inflazione dei club del computer: in una carriera lunga i livelli medi vanno riportati a quelli di partenza.
    balancePyramid(world, 8);
  }
  if (from < 9) {
    // v9: overall precisi per i giocatori famosi (Granados & co.) e rose più forti per i club di vertice.
    applyStarRatings(world);
    for (const lg of world.rules.leagues) if (lg.key === 'A1') lg.strength = [...DEFAULT_RULES.leagues[0].strength];
  }
  if (from < 10) {
    // v10: niente più squalifiche (una al massimo all'anno non vale una regola): si cancellano quelle in corso.
    for (const p of Object.values(world.players)) delete (p as unknown as { suspension?: number }).suspension;
  }
  if (from < 11) {
    // v11: ricambio dei campioni e mercato più ricco: tornano i giocatori forti (in una carriera lunga restava un 84 al massimo)
    // e sul mercato degli svincolati ci sono giocatori di alto livello.
    sustainTalent(world, 14);
    ensureLuxuryFreeAgents(world, ctxOf(world), worldRng(world));
  }
  if (from < 12) {
    // v12: giocatori di Serie A1 più forti (+4 a tutti, i campioni con valore fisso restano come sono) e nuova fascia di forza.
    for (const lg of world.rules.leagues) if (lg.key === 'A1') lg.strength = [...DEFAULT_RULES.leagues[0].strength];
    for (const club of Object.values(world.clubs)) {
      if (club.country !== 'ITA' || club.division !== 'A1' || club.isUser) continue;
      for (const id of club.playerIds) {
        const p = world.players[id];
        if (!p || p.retired || starRating(`${p.firstName} ${p.lastName}`) != null) continue;
        tuneOverall(p.attrs, p.role, Math.min(94, p.overall + 4));
        p.overall = computeOverall(p.attrs, p.role);
        p.potential = Math.max(p.potential, p.overall);
        refreshValue(p, world.season);
      }
    }
  }
  if (from < 13) {
    // v13: bilanciamento dei livelli: A2, B e C sono più alte (A2 intorno a 66, B 56, C 46; A1 78) e i giocatori delle categorie minori
    // salgono di conseguenza. Stipendi e valori restano quelli di prima (sono tarati sulla scala economica).
    for (const lg of world.rules.leagues) {
      const def = DEFAULT_RULES.leagues.find((l) => l.key === lg.key);
      if (def) lg.strength = [...def.strength];
    }
    stretchWorldLevels(world);
    balancePyramid(world, 10);
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
  let moved = 0;
  for (let pass = 0; pass < 4; pass++) {
    const delta = target - teamStrength(world, club);
    if (Math.abs(delta) < 0.6) break;
    // I giocatori famosi con overall fissato non si spostano: se la squadra è piena di campioni lo spostamento ha un limite.
    moved += delta;
    if (Math.abs(moved) > 24 && club.playerIds.some((id) => world.players[id]?.rated)) break;
    for (const id of club.playerIds) {
      const p = world.players[id];
      if (!p || p.rated) continue;
      for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = clamp(Math.round(p.attrs[k] + delta), 1, 99);
      p.overall = computeOverall(p.attrs, p.role);
      p.potential = Math.max(p.potential, p.overall);
      refreshValue(p, world.season);
    }
  }
}

/** Aggiunge i club europei mancanti, rinomina quelli cambiati e porta i giocatori veri nelle rose dei club esteri. */
export function addEuropeanClubs(world: World): number {
  const clubs = Object.values(world.clubs);
  // VK Šibenik è oggi VK Solaris.
  const old = clubs.find((c) => c.name === 'VK Šibenik');
  if (old && !clubs.some((c) => c.name === 'VK Solaris')) {
    old.name = 'VK Solaris';
    old.crest = crestFor(old.name, old.short, old.colors);
  }
  const names = new Set(Object.values(world.clubs).map((c) => c.name));
  const usedShort = new Set(Object.values(world.clubs).map((c) => c.short));
  const ctx = ctxOf(world);
  const rankInNation = new Map<string, number>();
  let added = 0;
  for (const fc of REAL_FOREIGN) {
    const rank = rankInNation.get(fc.nation) ?? 0;
    rankInNation.set(fc.nation, rank + 1);
    if (names.has(fc.name)) continue;
    addForeignClub(world, ctx, fc, rank, usedShort);
    added++;
  }
  // I grandi club europei sono più forti degli altri.
  for (const fc of REAL_FOREIGN) {
    if (!fc.bonus) continue;
    const club = Object.values(world.clubs).find((c) => c.name === fc.name);
    if (club) shiftClub(world, club.id, teamStrength(world, club) + fc.bonus);
  }
  for (const club of Object.values(world.clubs)) if (club.country !== 'ITA') capForeignStrength(world, club.id);
  assignRealRosters(world);
  return added;
}

/** Nessun club estero supera la forza dei migliori club di A1 (i giocatori veri delle rose pubbliche gonfiano la stima). */
export const FOREIGN_MAX_STRENGTH = 88;
export function capForeignStrength(world: World, clubId: string): void {
  const club = world.clubs[clubId];
  if (club && teamStrength(world, club) > FOREIGN_MAX_STRENGTH) shiftClub(world, clubId, FOREIGN_MAX_STRENGTH);
}

/**
 * Dà ai giocatori famosi il loro overall preciso (anche se gioca nella tua squadra) e porta i club di vertice
 * almeno al livello previsto: tutti i loro giocatori non famosi salgono insieme.
 */
export function applyStarRatings(world: World): { stars: number; clubs: number } {
  let stars = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const base = starRating(`${p.firstName} ${p.lastName}`);
    if (base == null) continue;
    const age = world.season - p.birthYear;
    const r = Math.round(base - (age > 34 ? (age - 34) * 1.3 : 0));
    tuneOverall(p.attrs, p.role, r);
    p.overall = computeOverall(p.attrs, p.role);
    p.potential = Math.max(p.potential, p.overall);
    p.rated = true;
    refreshValue(p, world.season);
    stars++;
  }
  let clubs = 0;
  for (const club of Object.values(world.clubs)) {
    const level = TOP_CLUB_LEVELS[club.name];
    if (level == null || club.isUser) continue;
    const want = level + 2;
    if (teamStrength(world, club) < want) { shiftClub(world, club.id, want); clubs++; }
    // Da qui i giocatori veri di questi club hanno un overall fisso (non lo tocca il bilanciamento dei livelli).
    for (const id of club.playerIds) if (world.players[id]?.real) world.players[id].rated = true;
  }
  return { stars, clubs };
}

/**
 * Porta i giocatori delle categorie minori (A2, B, C, club esteri non di vertice, svincolati e vivai) sulla scala nuova degli overall.
 * I campioni con valore fisso e i giocatori di A1 (già alzati dalla v12) non si toccano; se sei in A1 la tua squadra prende i +4 che
 * gli altri club di A1 hanno già avuto. Il potenziale sale con l'overall.
 */
export function stretchWorldLevels(world: World): number {
  const user = world.clubs[world.userClubId];
  const userInA1 = !!user && user.division === 'A1';
  let changed = 0;
  for (const p of Object.values(world.players)) {
    if (p.retired || p.rated || starRating(`${p.firstName} ${p.lastName}`) != null) continue;
    const club = p.clubId ? world.clubs[p.clubId] : null;
    let target: number;
    if (club?.division === 'A1' && !club.isUser) continue;
    if (club?.isUser && userInA1) target = Math.min(94, p.overall + 4);
    else if (!club) {
      if (p.overall >= 66) continue;
      target = stretchOverall(p.overall);
    } else target = stretchOverall(p.overall);
    target = Math.round(target);
    if (target === p.overall) continue;
    tuneOverall(p.attrs, p.role, target);
    p.overall = computeOverall(p.attrs, p.role);
    p.potential = Math.max(Math.round(club?.isUser && userInA1 ? p.potential + 4 : stretchOverall(p.potential)), p.overall);
    refreshValue(p, world.season);
    changed++;
  }
  return changed;
}
