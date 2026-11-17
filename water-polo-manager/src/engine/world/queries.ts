// Interrogazioni di uso comune sul mondo di gioco (usate da motore e interfaccia).

import { NATIONS } from '../data/names';
import type { Club, Competition, Fixture, Player, World } from '../types';
import { clamp } from '../util';

export function userClub(world: World): Club {
  return world.clubs[world.userClubId];
}

export function divisionOf(world: World, club: Club): string {
  if (club.country !== 'ITA') return NATIONS[club.country]?.name ?? 'Estero';
  return world.rules.leagues.find((l) => l.key === club.division)?.name ?? club.division;
}

export function clubPlayers(world: World, club: Club): Player[] {
  return club.playerIds.map((id) => world.players[id]).filter(Boolean);
}

export function clubYouth(world: World, club: Club): Player[] {
  return club.youthIds.map((id) => world.players[id]).filter(Boolean);
}

export function leagueComp(world: World, key: string, season = world.season): Competition | undefined {
  return world.competitions[`${key}-${season}`];
}

export function clubCompetitions(world: World, club: Club): Competition[] {
  return Object.values(world.competitions).filter(
    (c) => c.season === world.season && c.phases.some((p) => p.groups.some((g) => g.clubIds.includes(club.id)) || p.rounds.some((r) => r.ties.some((t) => t.homeId === club.id || t.awayId === club.id)) || (p.entrants && Object.values(p.entrants).some((l) => l.includes(club.id)))),
  );
}

export function clubFixtures(world: World, clubId: string): Fixture[] {
  return Object.values(world.fixtures)
    .filter((f) => (f.homeId === clubId || f.awayId === clubId) && !f.cancelled && world.competitions[f.compId]?.season === world.season)
    .sort((a, b) => a.day - b.day);
}

export function nextFixture(world: World, clubId: string): Fixture | null {
  return clubFixtures(world, clubId).find((f) => !f.played && !f.ifNeeded) ?? null;
}

export function lastResult(world: World, clubId: string): Fixture | null {
  const played = clubFixtures(world, clubId).filter((f) => f.played);
  return played[played.length - 1] ?? null;
}

/** Conoscenza (0-100) che lo scouting dell'utente ha di un giocatore. */
export function knowledgeOf(world: World, p: Player): number {
  const user = userClub(world);
  if (p.clubId === user.id) return 100;
  const scouting = user.facilities.scouting.level;
  const obs = user.staff.osservatore ? world.staff[user.staff.osservatore]?.rating ?? 0 : 0;
  let base = 18 + scouting * 8 + obs / 5;
  if (p.nationality !== 'ITA' && (!p.clubId || world.clubs[p.clubId]?.country !== 'ITA')) base -= scouting >= 4 ? 0 : 15;
  if (p.clubId && world.clubs[p.clubId]?.division === user.division) base += 10;
  return clamp(Math.round(Math.max(base, world.knowledge[p.id] ?? 0)), 5, 100);
}

/** Scostamento stabile (−1…1) dell'osservatore per un giocatore: l'errore non è sempre centrato. */
function scoutBias(p: Player, salt: number): number {
  let h = salt;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 2001) / 1000) - 1;
}

/** Stima del potenziale mostrata all'utente (intervallo). */
export function potentialRange(world: World, p: Player): [number, number] {
  const k = knowledgeOf(world, p);
  if (k >= 100) {
    return [clamp(p.potential - 2, p.overall, 99), clamp(p.potential + 2, p.overall, 99)];
  }
  // Più il giocatore è maturo, meno incertezza c'è sul suo futuro.
  const age = world.season - p.birthYear;
  const ageF = age >= 28 ? 0.25 : age >= 25 ? 0.5 : age >= 22 ? 0.8 : 1;
  const err = Math.max(2, Math.round(((100 - k) / 7) * ageF));
  const mid = p.potential + scoutBias(p, 7) * err * 0.6;
  // Il limite inferiore è la stima dell'overall (non il valore vero, che l'osservatore non conosce).
  const floor = overallRange(world, p)[0];
  const lo = clamp(Math.round(mid - err), floor, 99);
  return [lo, clamp(Math.max(lo, Math.round(mid + err)), floor, 99)];
}

export function overallRange(world: World, p: Player): [number, number] {
  const k = knowledgeOf(world, p);
  if (k >= 100) return [p.overall, p.overall];
  const err = Math.round((100 - k) / 16);
  const mid = p.overall + scoutBias(p, 13) * err * 0.6;
  return [clamp(Math.round(mid - err), 1, 99), clamp(Math.round(mid + err), 1, 99)];
}

export function isUserPlayer(world: World, p: Player): boolean {
  return p.clubId === world.userClubId;
}

export function allPlayersList(world: World): Player[] {
  return Object.values(world.players).filter((p) => !p.retired);
}

export function freeAgents(world: World): Player[] {
  return Object.values(world.players).filter((p) => !p.clubId && !p.retired);
}

export function seasonStatsTotal(p: Player) {
  const t = { apps: 0, goals: 0, assists: 0, saves: 0, ratingSum: 0, mvp: 0, exclDrawn: 0, steals: 0, minutes: 0, goalsAgainst: 0 };
  for (const s of Object.values(p.stats)) {
    t.apps += s.apps; t.goals += s.goals; t.assists += s.assists; t.saves += s.saves; t.ratingSum += s.ratingSum; t.mvp += s.mvp;
    t.exclDrawn += s.exclDrawn; t.steals += s.steals; t.minutes += s.minutes; t.goalsAgainst += s.goalsAgainst;
  }
  return { ...t, avgRating: t.apps ? t.ratingSum / t.apps : 0 };
}
