// Costruzione degli input della simulazione a partire dal mondo di gioco.

import { hashSeed } from '../rng';
import type { Club, Fixture, Lineup, World } from '../types';
import { autoLineup, minutesPlan, repairLineup } from '../club/lineup';
import { availableTactics, chooseTactics } from '../ai/tactics';
import { ensureMinimumSquad } from '../ai/clubAI';
import { worldRng } from '../world/context';
import { shortName } from '../player/generate';
import { reliablePosition } from '../competition/standings';
import type { MatchPlayerInput, MatchSetup, MatchTeamInput } from './engine';

export function lineupFor(world: World, club: Club, opponent: Club): Lineup {
  if (club.isUser) {
    club.lineup = repairLineup(world, club);
    return club.lineup;
  }
  const avail = club.playerIds.filter((id) => !world.players[id].injury).length;
  if (avail < 10) ensureMinimumSquad(world, club, worldRng(world));
  const l = autoLineup(world, club, { rotate: true });
  club.lineup = l;
  club.tactics = chooseTactics(world, club, opponent);
  return l;
}

export function buildTeamInput(world: World, club: Club, opponent: Club, lineup?: Lineup): MatchTeamInput {
  const l = lineup ?? lineupFor(world, club, opponent);
  const ids = [...l.slots, ...l.bench].filter(Boolean) as string[];
  const players: MatchPlayerInput[] = ids.map((id) => {
    const p = world.players[id];
    const form = p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 6.3;
    return {
      id: p.id,
      name: shortName(p),
      number: p.capNumber,
      role: p.role,
      hand: p.hand,
      attrs: p.attrs,
      overall: p.overall,
      condition: p.condition,
      morale: p.morale,
      formAvg: form,
      temperament: p.personality.temperamento,
    };
  });
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  return {
    clubId: club.id,
    name: club.name,
    short: club.short,
    players,
    tactics: club.tactics,
    familiarity: club.tacticFamiliarity,
    coach: coach
      ? {
          tattica: coach.attrs.tattica, motivazione: coach.attrs.motivazione, adattabilita: coach.attrs.adattabilita,
          esperienza: coach.attrs.esperienza, preparazione: coach.attrs.preparazione,
        }
      : null,
    chemistry: club.chemistry,
    fitnessPrep: club.fitnessPrep,
    penaltyTakers: l.penaltyTakers,
    available: availableTactics(world, club),
    coachAdjusts: club.isUser ? world.flags.coachAdjusts !== false : true,
    autoSubs: true,
    minutesPlan: club.isUser ? minutesPlan(world, l) : undefined,
  };
}

/** Importanza dinamica: scontri al vertice, lotta salvezza, ultime giornate. */
export function dynamicImportance(world: World, f: Fixture): number {
  const comp = world.competitions[f.compId];
  if (!comp || comp.kind !== 'league' || f.phase !== 0) return f.importance;
  // Nelle prime giornate la classifica è a pari punti e in ordine alfabetico: non conta ancora.
  const ph = reliablePosition(world, comp, f.homeId);
  const pa = reliablePosition(world, comp, f.awayId);
  const groupSize = comp.phases[0].groups.find((g) => g.clubIds.includes(f.homeId))?.clubIds.length ?? 12;
  const totalRounds = (groupSize - 1) * 2;
  const late = f.round / Math.max(1, totalRounds);
  let imp = 0.25 + late * 0.25;
  if (ph && pa) {
    if (ph.pos <= 3 && pa.pos <= 3) imp += 0.2;
    if (ph.pos >= groupSize - 2 && pa.pos >= groupSize - 2) imp += 0.15;
  }
  if (world.clubs[f.homeId].region === world.clubs[f.awayId].region) imp += 0.05;
  return Math.min(0.9, imp);
}

export function allowsDraw(world: World, f: Fixture): boolean {
  const comp = world.competitions[f.compId];
  if (!comp) return true;
  const phase = comp.phases[f.phase];
  if (phase.kind === 'groups') return true;
  const round = phase.rounds[f.round];
  const tie = round?.ties.find((t) => t.id === f.tieId);
  if (tie?.format.kind === 'twoLegs') return tie.fixtureIds[0] === f.id;
  return false;
}

/** Gol dell'andata dal punto di vista della squadra di casa del ritorno. */
export function aggregateFor(world: World, f: Fixture): [number, number] | undefined {
  const comp = world.competitions[f.compId];
  const phase = comp?.phases[f.phase];
  if (!phase || phase.kind !== 'knockout') return undefined;
  const tie = phase.rounds[f.round]?.ties.find((t) => t.id === f.tieId);
  if (!tie || tie.format.kind !== 'twoLegs' || tie.fixtureIds[1] !== f.id) return undefined;
  const l1 = world.fixtures[tie.fixtureIds[0]];
  if (!l1?.played) return undefined;
  return [l1.ag, l1.hg];
}

export function buildMatchSetup(world: World, f: Fixture, userLineup?: Lineup): MatchSetup {
  const home = world.clubs[f.homeId];
  const away = world.clubs[f.awayId];
  const homeIn = buildTeamInput(world, home, away, home.isUser ? userLineup : undefined);
  const awayIn = buildTeamInput(world, away, home, away.isUser ? userLineup : undefined);
  return {
    home: homeIn,
    away: awayIn,
    neutral: f.neutral,
    importance: dynamicImportance(world, f),
    allowDraw: allowsDraw(world, f),
    aggregate: aggregateFor(world, f),
    periodSeconds: world.rules.periodSeconds,
    seed: hashSeed(world.seed, f.id, world.season),
  };
}
