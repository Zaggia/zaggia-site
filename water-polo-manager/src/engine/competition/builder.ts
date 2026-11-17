// Creazione delle competizioni di una stagione a partire dai regolamenti configurati.

import { dayOf, nextWeekday } from '../calendar';
import type { Rng } from '../rng';
import type {
  Club, Competition, ContinentalRules, CupRules, LeagueRules, Phase, Tie, TieFormat, World,
} from '../types';
import { teamStrength } from '../club/lineup';
import { bracketPairs, makeTie, roundNameForSize, scheduleRound } from './knockout';
import { createFixture, roundRobin, weeklyDates } from './schedule';

export function emptyCompetition(world: World, key: string, name: string, kind: Competition['kind'], tier: number): Competition {
  return {
    id: `${key}-${world.season}`,
    key,
    name,
    kind,
    season: world.season,
    tier,
    phases: [],
    finished: false,
    penalties: {},
    promoted: [],
    relegated: [],
  };
}

/** Suddivisione geografica in gironi di dimensione bilanciata. */
export function geographicGroups(clubs: Club[], groups: number): string[][] {
  if (groups <= 1) return [clubs.map((c) => c.id)];
  const chunk = <T,>(arr: T[], n: number): T[][] => {
    const out: T[][] = [];
    let start = 0;
    for (let i = 0; i < n; i++) {
      const size = Math.floor(arr.length / n) + (i < arr.length % n ? 1 : 0);
      out.push(arr.slice(start, start + size));
      start += size;
    }
    return out;
  };
  const byLat = [...clubs].sort((a, b) => b.lat - a.lat || a.lon - b.lon);
  if (groups === 2) return chunk(byLat, 2).map((g) => g.map((c) => c.id));
  if (groups === 4) {
    const [north, south] = chunk(byLat, 2);
    const [nw, ne] = chunk([...north].sort((a, b) => a.lon - b.lon), 2);
    const [centre, sud] = chunk([...south].sort((a, b) => b.lat - a.lat), 2);
    return [nw, ne, centre, sud].map((g) => g.map((c) => c.id));
  }
  return chunk(byLat, groups).map((g) => g.map((c) => c.id));
}

export function createLeague(world: World, rules: LeagueRules, rng: Rng): Competition {
  const comp = emptyCompetition(world, rules.key, rules.name, 'league', rules.tier);
  const clubs = Object.values(world.clubs).filter((c) => c.division === rules.key);
  const groups = geographicGroups(clubs, rules.groups);
  const phase: Phase = { kind: 'groups', name: 'Stagione regolare', purpose: 'main', groups: [], rounds: [], done: false };
  comp.phases.push(phase);
  groups.forEach((ids, gi) => {
    const gname = rules.groupNames[gi] ?? `Girone ${gi + 1}`;
    const group = { name: gname, clubIds: ids, fixtureIds: [] as string[] };
    phase.groups.push(group);
    const first = roundRobin(ids, rng);
    const all: [string, string][][] = [];
    for (let leg = 0; leg < rules.legs; leg++) {
      for (const r of first) all.push(leg % 2 === 0 ? r : r.map(([h, a]) => [a, h] as [string, string]));
    }
    const dates = weeklyDates(world, rules.startDate, all.length);
    all.forEach((round, ri) => {
      for (const [h, a] of round) {
        const f = createFixture(world, {
          compId: comp.id, phase: 0, group: gi, round: ri, day: dates[ri], homeId: h, awayId: a, neutral: false,
          importance: 0.3, label: `${rules.name}${rules.groups > 1 ? ` · ${gname}` : ''} · ${ri + 1}ª giornata`,
        });
        group.fixtureIds.push(f.id);
      }
    });
  });
  return comp;
}

function cupDates(world: World, mmdd: string[], rounds: number): number[] {
  const days = mmdd.map((d) => dayOf(world.season, d));
  if (days.length >= rounds) return days.slice(days.length - rounds);
  const out = [...days];
  while (out.length < rounds) out.unshift(out[0] - 14);
  return out;
}

export function createNationalCup(world: World, rules: CupRules, rng: Rng): Competition | null {
  const tierOf = (c: Club) => world.rules.leagues.find((l) => l.key === c.division)?.tier ?? 9;
  const clubs = Object.values(world.clubs)
    .filter((c) => rules.eligible.includes(c.division))
    .sort((a, b) => tierOf(a) - tierOf(b) || b.reputation - a.reputation);
  if (clubs.length < 2) return null;
  const comp = emptyCompetition(world, rules.key, rules.name, 'cup', 0);
  const n = clubs.length;
  let P = 1;
  while (P < n) P *= 2;
  const rounds = Math.log2(P);
  const byes = P - n;
  const dates = cupDates(world, rules.dates, rounds);
  const seeds: Record<string, number> = {};
  clubs.forEach((c, i) => (seeds[c.id] = i + 1));
  const plan = Array.from({ length: rounds }, (_, r) => {
    const size = P / Math.pow(2, r);
    return {
      name: r === 0 && byes > 0 ? 'Turno preliminare' : roundNameForSize(size),
      format: { kind: 'single' } as TieFormat,
      dates: [dates[r]],
      neutral: rules.finalFourFrom != null && r >= rounds - 2,
    };
  });
  const phase: Phase = {
    kind: 'knockout', name: rules.name, purpose: 'main', groups: [], rounds: [], done: false, plan, drawMode: 'random', seeds,
    entrants: byes > 0 ? { 1: clubs.slice(0, byes).map((c) => c.id) } : {},
  };
  comp.phases.push(phase);
  const first = rng.shuffle(clubs.slice(byes).map((c) => c.id));
  const ties: Tie[] = [];
  for (let i = 0; i + 1 < first.length; i += 2) {
    const [a, b] = seeds[first[i]] >= seeds[first[i + 1]] ? [first[i], first[i + 1]] : [first[i + 1], first[i]];
    ties.push(makeTie(world, a, b, { kind: 'single' }));
  }
  phase.rounds.push({ name: plan[0].name, ties, dates: [], format: { kind: 'single' } });
  scheduleRound(world, comp, 0, 0, dates[0], 0.45);
  return comp;
}

export function createSupercup(world: World, rules: CupRules, champion: string | null, cupWinner: string | null, runnerUp: string | null): Competition | null {
  let a = champion;
  let b = cupWinner && cupWinner !== champion ? cupWinner : runnerUp;
  if (!a || !b || a === b) {
    const top = Object.values(world.clubs).filter((c) => c.division === 'A1').sort((x, y) => teamStrength(world, y) - teamStrength(world, x));
    a = a ?? top[0]?.id ?? null;
    b = top.find((c) => c.id !== a)?.id ?? null;
  }
  if (!a || !b) return null;
  const comp = emptyCompetition(world, rules.key, rules.name, 'supercup', 0);
  const day = nextWeekday(world.season, dayOf(world.season, rules.dates[0]), 6);
  const phase: Phase = {
    kind: 'knockout', name: rules.name, purpose: 'main', groups: [], rounds: [], done: false,
    plan: [{ name: 'Finale', format: { kind: 'single' }, dates: [day], neutral: true }], drawMode: 'bracket', seeds: { [a]: 1, [b]: 2 },
  };
  comp.phases.push(phase);
  phase.rounds.push({ name: 'Finale', ties: [makeTie(world, a, b, { kind: 'single' })], dates: [], format: { kind: 'single' } });
  scheduleRound(world, comp, 0, 0, day, 0.8);
  return comp;
}

/** Selezione delle squadre estere: classifica "nazionale" simulata in base alla forza. */
export function foreignRanking(world: World, rng: Rng): Record<string, string[]> {
  const byNation: Record<string, { id: string; v: number }[]> = {};
  for (const c of Object.values(world.clubs)) {
    if (c.country === 'ITA') continue;
    const v = teamStrength(world, c) + rng.gauss(0, 3);
    (byNation[c.country] ||= []).push({ id: c.id, v });
  }
  const out: Record<string, string[]> = {};
  for (const [n, list] of Object.entries(byNation)) {
    out[n] = list.sort((a, b) => b.v - a.v).map((x) => x.id);
    out[n].forEach((id, i) => (world.clubs[id].domesticRank = i + 1));
  }
  return out;
}

export function createContinental(
  world: World, rules: ContinentalRules, a1Ranking: string[], foreign: Record<string, string[]>, used: Set<string>, rng: Rng,
): Competition | null {
  const comp = emptyCompetition(world, rules.key, rules.name, 'continental', 0);
  const teams: string[] = [];
  for (const pos of rules.italySlots) {
    const id = a1Ranking[pos - 1];
    if (id && !used.has(id) && world.clubs[id]) { teams.push(id); used.add(id); }
  }
  for (const [nation, n] of Object.entries(rules.foreignSlots)) {
    const list = (foreign[nation] ?? []).filter((id) => !used.has(id));
    for (const id of list.slice(0, n)) { teams.push(id); used.add(id); }
  }
  const size = rules.format === 'groups+ko' ? rules.groupCount * 4 : Math.pow(2, rules.koRounds.length);
  if (teams.length < size) {
    const rest = Object.values(world.clubs)
      .filter((c) => c.country !== 'ITA' && !used.has(c.id))
      .sort((a, b) => teamStrength(world, b) - teamStrength(world, a));
    for (const c of rest) {
      if (teams.length >= size) break;
      teams.push(c.id);
      used.add(c.id);
    }
  }
  const ranked = teams.slice(0, size).sort((a, b) => teamStrength(world, world.clubs[b]) - teamStrength(world, world.clubs[a]));
  const seeds: Record<string, number> = {};
  ranked.forEach((id, i) => (seeds[id] = i + 1));
  const koPlan = rules.koRounds.map((r) => ({
    name: r.name,
    format: (r.format === 'twoLegs' ? { kind: 'twoLegs' } : { kind: 'single' }) as TieFormat,
    dates: r.dates.map((d) => dayOf(world.season, d)),
    neutral: r.format === 'single',
  }));
  if (rules.format === 'groups+ko') {
    // Sorteggio a fasce, evitando dove possibile due club della stessa nazione nello stesso girone.
    const pots: string[][] = [0, 1, 2, 3].map((p) => rng.shuffle(ranked.slice(p * rules.groupCount, (p + 1) * rules.groupCount)));
    const groups: string[][] = Array.from({ length: rules.groupCount }, () => []);
    for (const pot of pots) {
      const left = [...pot];
      for (const g of groups) {
        const nations = new Set(g.map((id) => world.clubs[id].country));
        let idx = left.findIndex((id) => !nations.has(world.clubs[id].country));
        if (idx < 0) idx = 0;
        g.push(left.splice(idx, 1)[0]);
      }
    }
    const phase: Phase = { kind: 'groups', name: 'Fase a gironi', purpose: 'main', groups: [], rounds: [], done: false, seeds };
    comp.phases.push(phase);
    const dates = rules.groupDates.map((d) => dayOf(world.season, d));
    groups.forEach((ids, gi) => {
      const group = { name: `Girone ${String.fromCharCode(65 + gi)}`, clubIds: ids, fixtureIds: [] as string[] };
      phase.groups.push(group);
      const first = roundRobin(ids, rng);
      const all = [...first, ...first.map((r) => r.map(([h, a]) => [a, h] as [string, string]))];
      all.forEach((round, ri) => {
        for (const [h, a] of round) {
          const f = createFixture(world, {
            compId: comp.id, phase: 0, group: gi, round: ri, day: dates[ri] ?? dates[dates.length - 1] + 7 * (ri - dates.length + 1),
            homeId: h, awayId: a, neutral: false, importance: 0.55, label: `${rules.name} · ${group.name} · ${ri + 1}ª giornata`,
          });
          group.fixtureIds.push(f.id);
        }
      });
    });
    comp.phases.push({ kind: 'knockout', name: 'Fase finale', purpose: 'ko', groups: [], rounds: [], done: false, plan: koPlan, drawMode: 'bracket', seeds });
  } else {
    const phase: Phase = { kind: 'knockout', name: rules.name, purpose: 'main', groups: [], rounds: [], done: false, plan: koPlan, drawMode: 'random', seeds };
    comp.phases.push(phase);
    // Teste di serie contro non teste di serie, evitando gli incroci tra club della stessa nazione.
    const top = ranked.slice(0, size / 2);
    const bottom = rng.shuffle(ranked.slice(size / 2));
    const ties: Tie[] = [];
    for (const h of top) {
      let idx = bottom.findIndex((id) => world.clubs[id].country !== world.clubs[h].country);
      if (idx < 0) idx = 0;
      const a = bottom.splice(idx, 1)[0];
      ties.push(makeTie(world, h, a, koPlan[0].format));
    }
    phase.rounds.push({ name: koPlan[0].name, ties, dates: [], format: koPlan[0].format });
    scheduleRound(world, comp, 0, 0, koPlan[0].dates[0], 0.55);
  }
  return comp;
}

/** Dopo la fase a gironi europea: quarti 1°A-2°B, 1°B-2°A, 1°C-2°D, 1°D-2°C. */
export function continentalKnockoutPairs(winners: string[], runners: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let g = 0; g < winners.length; g++) {
    const opp = g % 2 === 0 ? g + 1 : g - 1;
    out.push([winners[g], runners[opp] ?? runners[g]]);
  }
  return out;
}

export { bracketPairs };
