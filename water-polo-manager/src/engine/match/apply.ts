// Applicazione del risultato di una partita al mondo: classifiche, statistiche,
// forma, condizione, infortuni, squalifiche, morale, incassi, cronaca salvata.

import { INJURIES } from '../data/names';
import { attendanceFor, matchdayFinance } from '../economy/finance';
import { afterFixture } from '../competition/progress';
import { emptyStatLine } from '../player/generate';
import { refreshValue } from '../player/value';
import { addMessage } from '../news';
import { Rng } from '../rng';
import type { Fixture, MatchReport, Player, PlayerMatchLine, World } from '../types';
import { clamp } from '../util';
import { DEFENSE, OFFENSE } from '../tactics/tactics';
import { createMatch, mvpOf, simulateToEnd, type MatchState } from './engine';
import { buildMatchSetup } from './setup';
import { worldRng } from '../world/context';

export function statKey(world: World, f: Fixture): string {
  return world.competitions[f.compId]?.key ?? 'ALTRO';
}

function addLine(p: Player, key: string, l: PlayerMatchLine, mvp: boolean) {
  const s = (p.stats[key] ||= emptyStatLine());
  s.apps++;
  if (l.started) s.starts++;
  s.minutes += Math.round(l.seconds / 60);
  s.goals += l.goals;
  s.assists += l.assists;
  s.shots += l.shots;
  s.shotsOnTarget += l.shotsOnTarget;
  s.exclDrawn += l.exclDrawn;
  s.exclCommitted += l.exclCommitted;
  s.steals += l.steals;
  s.turnovers += l.turnovers;
  s.blocks += l.blocks;
  s.saves += l.saves;
  s.goalsAgainst += l.goalsAgainst;
  s.penGoals += l.penGoals;
  s.manUpGoals += l.manUpGoals;
  s.ratingSum += l.rating;
  if (mvp) s.mvp++;
}

export function injuryFor(world: World, p: Player, rng: Rng, severity = 1) {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const inj = rng.weighted(INJURIES, (i) => i.weight);
  let days = rng.int(inj.min, inj.max) * severity * 0.8;
  if (club) {
    const med = club.facilities.medico.level;
    const doc = club.staff.medico ? world.staff[club.staff.medico]?.rating ?? 0 : 0;
    days *= 1.12 - med * 0.06 - doc / 600;
  }
  days = Math.max(2, Math.round(days));
  p.injury = { name: inj.name, daysLeft: days, totalDays: days };
  if (club?.isUser) {
    addMessage(world, 'infortuni', `Infortunio: ${p.firstName} ${p.lastName}`, `${inj.name}. Tempo di recupero stimato: ${days} giorni.`, { link: { view: 'player', id: p.id } });
  }
}

/** Applica al mondo lo stato finale di una partita simulata. */
export function applyMatch(world: World, f: Fixture, st: MatchState): MatchReport | null {
  const rng = worldRng(world);
  f.played = true;
  f.hg = st.score[0];
  f.ag = st.score[1];
  if (st.pens) f.pens = st.pens;
  const key = statKey(world, f);
  const mvp = mvpOf(st);
  const scorers: [string, number][] = [];
  const clubsIds = [f.homeId, f.awayId];
  for (const s of [0, 1] as const) {
    const club = world.clubs[clubsIds[s]];
    const won = st.score[s] > st.score[1 - s] || (st.pens != null && st.score[0] === st.score[1] && st.pens[s] > st.pens[1 - s]);
    const lost = st.score[s] < st.score[1 - s] || (st.pens != null && st.score[0] === st.score[1] && st.pens[s] < st.pens[1 - s]);
    const res = won ? 'W' : lost ? 'L' : 'D';
    club.recent.push(res);
    if (club.recent.length > 10) club.recent.shift();
    const lines = st.sides[s].p.map((x) => x.line);
    const onSheet = new Set(lines.map((l) => l.id));
    for (const l of lines) {
      const p = world.players[l.id];
      if (!p) continue;
      for (let g = 0; g < l.goals; g++) scorers.push([p.id, s]);
      if (l.seconds > 0) {
        addLine(p, key, l, mvp === p.id);
        if (l.rating > 0) {
          p.form.push(l.rating);
          if (p.form.length > 6) p.form.shift();
        }
      }
      // Condizione fisica: il calo dipende dai minuti e dalla resistenza.
      const mins = l.seconds / 60;
      p.condition = clamp(p.condition - mins * 0.55 * (1.25 - p.attrs.resistenza / 220) * (1.1 - club.fitnessPrep / 500), 45, 100);
      p.experience = clamp(p.experience + mins * 0.01 * (0.5 + f.importance), 0, 100);
      p.playingTime = p.playingTime * 0.8 + 0.2 * clamp(mins / 24, 0, 1);
      // Morale: risultato, prestazione, premio di migliore in campo.
      let dm = won ? 2.5 : lost ? -2.5 : 0.5;
      if (l.rating >= 7.5) dm += 2;
      if (l.rating > 0 && l.rating < 5.5) dm -= 2;
      if (mvp === p.id) dm += 3;
      p.morale = clamp(p.morale + dm, 5, 100);
      if (l.injured) injuryFor(world, p, rng, 1);
      refreshValue(p, world.season);
    }
    // Chi è in rosa ma non è sceso in vasca perde minutaggio.
    for (const id of club.playerIds) {
      if (onSheet.has(id)) continue;
      const p = world.players[id];
      if (p) p.playingTime *= 0.85;
    }
    // Familiarità con le tattiche usate e affiatamento.
    const t = st.sides[s].tactics;
    for (const tid of [t.offense, t.defense]) club.tacticFamiliarity[tid] = clamp((club.tacticFamiliarity[tid] ?? 20) + 0.5, 0, 100);
    club.chemistry = clamp(club.chemistry + 0.4, 0, 100);
    // Fiducia nell'allenatore.
    if (club.coachId) {
      const c = world.coaches[club.coachId];
      if (c) c.security = clamp(c.security + (won ? 2 : lost ? -3 : 0), 0, 100);
    }
  }
  // I marcatori dettagliati si conservano solo per le partite dell'utente (il resto è nelle statistiche).
  if (f.homeId === world.userClubId || f.awayId === world.userClubId) f.scorers = scorers;
  const attendance = attendanceFor(world, f);
  matchdayFinance(world, f, attendance);
  let report: MatchReport | null = null;
  const userInvolved = f.homeId === world.userClubId || f.awayId === world.userClubId;
  if (userInvolved) {
    const comp = world.competitions[f.compId];
    report = {
      id: `r${f.id}`,
      fixtureId: f.id,
      season: world.season,
      day: f.day,
      compName: f.label || comp?.name || '',
      homeId: f.homeId,
      awayId: f.awayId,
      homeName: world.clubs[f.homeId].name,
      awayName: world.clubs[f.awayId].name,
      score: [...st.score] as [number, number],
      pens: st.pens,
      periods: st.periods,
      stats: [st.sides[0].stats, st.sides[1].stats],
      players: [st.sides[0].p.map((x) => x.line), st.sides[1].p.map((x) => x.line)],
      events: st.events,
      mvpId: mvp,
      attendance,
      tactics: [
        { offense: OFFENSE[st.sides[0].tactics.offense].name, defense: DEFENSE[st.sides[0].tactics.defense].name },
        { offense: OFFENSE[st.sides[1].tactics.offense].name, defense: DEFENSE[st.sides[1].tactics.defense].name },
      ],
    };
    world.reports[report.id] = report;
    f.reportId = report.id;
  }
  afterFixture(world, f, rng);
  return report;
}

/** Simula interamente una partita tra due squadre gestite dall'AI. */
export function simulateFixture(world: World, f: Fixture): MatchReport | null {
  const setup = buildMatchSetup(world, f);
  const st = createMatch(setup);
  simulateToEnd(st);
  return applyMatch(world, f, st);
}

export function fixturesOn(world: World, day: number): Fixture[] {
  return Object.values(world.fixtures).filter((f) => f.day === day && !f.played && !f.cancelled && !f.ifNeeded);
}

export function userFixtureOn(world: World, day: number): Fixture | null {
  return fixturesOn(world, day).find((f) => f.homeId === world.userClubId || f.awayId === world.userClubId) ?? null;
}

/** Simula tutte le partite AI del giorno (quella dell'utente esclusa). */
export function simulateAiFixtures(world: World, day: number) {
  // Si gioca in ordine di id per avere un risultato riproducibile.
  const list = fixturesOn(world, day)
    .filter((f) => f.homeId !== world.userClubId && f.awayId !== world.userClubId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const f of list) simulateFixture(world, f);
}

export { Rng };
