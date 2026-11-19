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

/** Fasce di forza di squadra per categoria (le stesse delle regole delle nuove carriere). */
export const PYRAMID_BANDS: Record<string, [number, number]> = { A1: [60, 88], A2: [47, 62], B: [34, 50], C: [24, 44] };
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
export const DIVISION_MEAN: Record<string, number> = { A1: 74, A2: 55, B: 43, C: 35 };

/**
 * Impedisce l'inflazione: mercato e sviluppo fanno salire piano piano il livello medio dei club gestiti dal computer
 * (in 12 stagioni la media della A2 passava da 55 a 61), così chi gioca da anni si trova avversari sempre più forti
 * senza che questo dipenda dalle sue scelte. A ogni stagione la media di ogni categoria torna a quella di partenza.
 * Le differenze tra i club restano: si sposta in blocco la forza di tutti.
 */
export function stabilizeLevels(world: World, maxStep = 3): number {
  let changed = 0;
  for (const [div, target] of Object.entries(DIVISION_MEAN)) {
    const clubs = Object.values(world.clubs).filter((c) => c.country === 'ITA' && c.division === div && !c.isUser);
    if (clubs.length < 4) continue;
    const strengths = clubs.map((c) => teamStrength(world, c));
    const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    const delta = clamp(target - mean, -maxStep, maxStep);
    if (Math.abs(target - mean) < 1) continue;
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
export function balancePyramid(world: World, maxStep = 3): number {
  let changed = stabilizeLevels(world, maxStep);
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
