// Piramide dei livelli: ogni categoria ha una sua fascia di forza e i giocatori di una società non si discostano troppo dal
// livello della società. Così un titolare di una squadra di A1 (anche l'ultima) vale più di un titolare di Serie B, e un
// fuoriclasse di B non supera i giocatori delle squadre di categoria superiore.

import { teamStrength } from '../club/lineup';
import { computeOverall } from '../player/attributes';
import { refreshValue } from '../player/value';
import type { Player, World } from '../types';
import { clamp } from '../util';
import { shiftClub } from './migrate';
import { tuneOverall } from '../player/generate';
import { REAL_FOREIGN, FOREIGN_CITY_SIZE } from '../data/realClubs';
import { NATIONS } from '../data/names';
import { TOP_CLUB_LEVELS } from '../data/playerRatings';

/** Fasce di forza di squadra per categoria (le stesse delle regole delle nuove carriere). */
export const PYRAMID_BANDS: Record<string, [number, number]> = { A1: [68, 94], A2: [58, 78], B: [48, 68], C: [38, 58] };
/** Quanto un giocatore può stare sotto/sopra il livello della propria squadra. */
export const BELOW = 8;
export const ABOVE = 7;

function shiftPlayer(world: World, p: Player, delta: number) {
  for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = clamp(Math.round(p.attrs[k] + delta), 1, 99);
  p.overall = computeOverall(p.attrs, p.role);
  p.potential = Math.max(p.potential, p.overall);
  refreshValue(p, world.season);
}

/** Forza media delle società (tranne la tua) in ogni categoria: è quella di una carriera appena creata e si mantiene nel tempo. */
export const DIVISION_MEAN: Record<string, number> = { A1: 78, A2: 66, B: 56, C: 46 };

/** Quanto i club europei sono stati alzati rispetto al livello base, perché le coppe non le vincano sempre le italiane. */
export const FOREIGN_BOOST = 8;
/** Anche i club europei di seconda fascia (quelli delle coppe minori) sono più forti di prima. */
export const FOREIGN_MID_BOOST = 16;
export const FOREIGN_TARGET_MAX = 95;
/** Overall massimo dei giocatori non famosi dei club esteri. */
export const FOREIGN_PLAYER_MAX = 92;

/** Forza di riferimento di ogni club estero (per nome): dipende dalla scuola della nazione, dalla posizione nel campionato e dai grandi club. */
export function foreignTargets(): Record<string, number> {
  const rank = new Map<string, number>();
  const out: Record<string, number> = {};
  for (const fc of REAL_FOREIGN) {
    const r = rank.get(fc.nation) ?? 0;
    rank.set(fc.nation, r + 1);
    const size = FOREIGN_CITY_SIZE[fc.city] ?? 2;
    const base = 62 + (NATIONS[fc.nation]?.school ?? 0) * 2.4 - r * 2.4 + size * 0.8 + (fc.bonus ?? 0) * 2;
    const top = TOP_CLUB_LEVELS[fc.name] != null ? TOP_CLUB_LEVELS[fc.name] + 2 : 0;
    out[fc.name] = top
      ? clamp(Math.round(Math.max(base, top) + FOREIGN_BOOST), 52, FOREIGN_TARGET_MAX)
      : clamp(Math.round(base + FOREIGN_MID_BOOST), 52, FOREIGN_TARGET_MAX - 6);
  }
  return out;
}

/**
 * I club europei restano forti: senza questo la loro forza calava stagione dopo stagione (i campioni invecchiano e vengono
 * sostituiti da giocatori normali) e le coppe europee finivano quasi sempre alle italiane. Ogni stagione tornano verso il loro livello.
 */
export function stabilizeForeign(world: World, maxStep = 5): number {
  const targets = foreignTargets();
  let changed = 0;
  for (const club of Object.values(world.clubs)) {
    if (club.country === 'ITA') continue;
    const target = targets[club.name];
    if (target == null) continue;
    const s = teamStrength(world, club);
    if (Math.abs(target - s) >= 1) {
      shiftClub(world, club.id, Math.round(s + clamp(target - s, -maxStep, maxStep)));
      changed++;
      // Un club forte non produce fuoriclasse: i giocatori non famosi restano sotto i campioni veri (il migliore del mondo ha 97).
      for (const id of club.playerIds) {
        const p = world.players[id];
        if (p && !p.rated && p.overall > FOREIGN_PLAYER_MAX) shiftPlayer(world, p, -(p.overall - FOREIGN_PLAYER_MAX));
      }
    }
    if (club.chemistry < 62) { club.chemistry = 62; changed++; }
    // Anche l'allenatore è all'altezza della squadra (prima quelli esteri erano molto più scarsi di quelli italiani di pari livello).
    const coach = club.coachId ? world.coaches[club.coachId] : null;
    if (coach) {
      const floor = clamp(Math.round(target - 6), 45, 88);
      for (const k of Object.keys(coach.attrs) as (keyof typeof coach.attrs)[]) {
        if (coach.attrs[k] < floor) { coach.attrs[k] = Math.min(floor, coach.attrs[k] + 6); changed++; }
      }
    }
  }
  return changed;
}

/**
 * Impedisce l'inflazione: mercato e sviluppo fanno salire piano piano il livello medio dei club gestiti dal computer
 * (in 12 stagioni la media della A2 passava da 55 a 61), così chi gioca da anni si trova avversari sempre più forti
 * senza che questo dipenda dalle sue scelte. A ogni stagione la media di ogni categoria torna a quella di partenza.
 * Le differenze tra i club restano: si sposta in blocco la forza di tutti.
 */
export function stabilizeLevels(world: World, maxStep = 5): number {
  let changed = 0;
  for (const [div, target] of Object.entries(DIVISION_MEAN)) {
    const clubs = Object.values(world.clubs).filter((c) => c.country === 'ITA' && c.division === div && !c.isUser);
    if (clubs.length < 4) continue;
    const strengths = clubs.map((c) => teamStrength(world, c));
    const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    const delta = clamp(target - mean, -maxStep, maxStep);
    if (Math.abs(target - mean) < 0.6) continue;
    clubs.forEach((c, i) => { shiftClub(world, c.id, Math.round(strengths[i] + delta)); changed++; });
  }
  return changed;
}

/**
 * Quanti giocatori forti devono esserci sempre nel mondo (overall minimo, quanti): senza ricambio i campioni invecchiano, si ritirano
 * e dopo qualche anno il migliore in circolazione è un 84. Ogni stagione i migliori giovani e giocatori nel pieno della carriera
 * salgono di qualche punto fino a riempire la scala: così nascono nuovi fuoriclasse e il mercato ha sempre giocatori da sogno.
 */
export const TALENT_TARGETS: [number, number][] = [[93, 5], [91, 10], [89, 20], [87, 36], [84, 70], [80, 130]];

export function sustainTalent(world: World, maxStep = 4): number {
  const user = world.userClubId;
  const active = () => Object.values(world.players).filter((p) => !p.retired && !p.youth && p.clubId && !p.loan && p.clubId !== user);
  let changed = 0;
  for (const [thr, need] of TALENT_TARGETS) {
    const pool = active();
    let have = pool.filter((p) => p.overall >= thr).length;
    if (have >= need) continue;
    const age = (p: Player) => world.season - p.birthYear;
    const cands = pool
      .filter((p) => p.overall < thr && p.overall >= thr - maxStep && age(p) <= 32)
      .sort((a, b) => (b.overall + (b.potential - b.overall) * 0.5 - Math.max(0, age(b) - 27)) - (a.overall + (a.potential - a.overall) * 0.5 - Math.max(0, age(a) - 27)));
    for (const p of cands) {
      if (have >= need) break;
      tuneOverall(p.attrs, p.role, thr);
      p.overall = computeOverall(p.attrs, p.role);
      p.potential = Math.max(p.potential, p.overall);
      p.rated = true;
      refreshValue(p, world.season);
      have++;
      changed++;
    }
  }
  return changed;
}

/** Riporta ogni società italiana (tranne la tua) nella fascia della sua categoria e avvicina i giocatori al livello di squadra. */
export function balancePyramid(world: World, maxStep = 5): number {
  let changed = stabilizeLevels(world, maxStep) + stabilizeForeign(world, Math.max(maxStep, 12));
  for (const club of Object.values(world.clubs)) {
    if (club.isUser || club.country !== 'ITA') continue;
    const band = PYRAMID_BANDS[club.division];
    if (!band) continue;
    let s = teamStrength(world, club);
    const target = clamp(s, band[0], band[1]);
    if (target !== s) {
      shiftClub(world, club.id, target);
      s = teamStrength(world, club);
      changed++;
    }
    for (const id of club.playerIds) {
      const p = world.players[id];
      if (!p || p.retired || p.loan || p.rated) continue;
      // I giovani del vivaio crescono con lo sviluppo: la finestra riguarda solo la prima squadra.
      if (p.overall < s - BELOW) { shiftPlayer(world, p, Math.ceil(s - BELOW - p.overall)); changed++; }
      else if (p.overall > s + ABOVE) { shiftPlayer(world, p, -Math.ceil(p.overall - (s + ABOVE))); changed++; }
    }
  }
  return changed;
}
