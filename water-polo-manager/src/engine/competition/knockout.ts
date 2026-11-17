// Turni a eliminazione diretta: gara secca, andata/ritorno, serie al meglio delle N partite.

import type { Rng } from '../rng';
import type { Competition, Fixture, KnockoutRound, Phase, Tie, TieFormat, World } from '../types';
import { newId } from '../world/context';
import { busyDays, createFixture, freeDay, markBusy } from './schedule';

export function roundNameForSize(teams: number): string {
  switch (teams) {
    case 2: return 'Finale';
    case 4: return 'Semifinali';
    case 8: return 'Quarti di finale';
    case 16: return 'Ottavi di finale';
    case 32: return 'Sedicesimi di finale';
    case 64: return 'Primo turno';
    default: return 'Turno preliminare';
  }
}

export function winsNeeded(format: TieFormat): number {
  return format.kind === 'series' ? Math.floor(format.bestOf / 2) + 1 : 1;
}

/** Ordine standard del tabellone: 1-8, 4-5, 2-7, 3-6 ... */
export function bracketPairs(n: number): [number, number][] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, size + 1 - s);
    order = next;
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

export function makeTie(world: World, homeId: string | null, awayId: string | null, format: TieFormat): Tie {
  return { id: newId(world, 't'), homeId, awayId, fixtureIds: [], format, wins: [0, 0] };
}

const SERIES_OFFSETS = [0, 3, 7, 10, 14];

/** Crea le partite di tutti i confronti di un turno. */
export function scheduleRound(
  world: World, comp: Competition, phaseIdx: number, roundIdx: number, startDay: number, importance: number,
) {
  const phase = comp.phases[phaseIdx];
  const round = phase.rounds[roundIdx];
  const plan = phase.plan?.[roundIdx];
  const neutral = !!plan?.neutral;
  const busy = busyDays(world);
  round.dates = [];
  for (const tie of round.ties) {
    if (!tie.homeId || !tie.awayId) {
      // Passaggio del turno automatico (bye).
      tie.winnerId = tie.homeId ?? tie.awayId ?? undefined;
      continue;
    }
    const clubs = [tie.homeId, tie.awayId];
    const label = `${comp.name} · ${round.name}`;
    const base = { compId: comp.id, phase: phaseIdx, tieId: tie.id, round: roundIdx, neutral, importance, label };
    const first = Math.max(startDay, plan?.dates[0] ?? startDay);
    if (tie.format.kind === 'single') {
      const d = freeDay(busy, clubs, first, 6);
      markBusy(busy, clubs, d);
      const f = createFixture(world, { ...base, day: d, homeId: tie.homeId, awayId: tie.awayId });
      tie.fixtureIds.push(f.id);
      round.dates.push(d);
    } else if (tie.format.kind === 'twoLegs') {
      const d1 = freeDay(busy, clubs, first, 6);
      markBusy(busy, clubs, d1);
      const d2 = freeDay(busy, clubs, Math.max(d1 + 4, plan?.dates[1] ?? d1 + 7), 6);
      markBusy(busy, clubs, d2);
      const f1 = createFixture(world, { ...base, day: d1, homeId: tie.awayId, awayId: tie.homeId, label: `${label} (andata)` });
      const f2 = createFixture(world, { ...base, day: d2, homeId: tie.homeId, awayId: tie.awayId, label: `${label} (ritorno)` });
      tie.fixtureIds.push(f1.id, f2.id);
      round.dates.push(d1, d2);
    } else {
      const need = winsNeeded(tie.format);
      let prev = -10;
      for (let g = 0; g < tie.format.bestOf; g++) {
        const target = Math.max(first + SERIES_OFFSETS[g], prev + 3);
        const d = freeDay(busy, clubs, target, 8);
        markBusy(busy, clubs, d);
        prev = d;
        const higherHome = g % 2 === 0;
        const f = createFixture(world, {
          ...base,
          day: d,
          homeId: higherHome || neutral ? tie.homeId : tie.awayId,
          awayId: higherHome || neutral ? tie.awayId : tie.homeId,
          ifNeeded: g >= need,
          label: tie.format.bestOf > 1 ? `${label} · gara ${g + 1}` : label,
        });
        tie.fixtureIds.push(f.id);
        round.dates.push(d);
      }
    }
  }
}

function fixtureWinner(f: Fixture): string | null {
  if (f.hg > f.ag) return f.homeId;
  if (f.ag > f.hg) return f.awayId;
  if (f.pens) return f.pens[0] > f.pens[1] ? f.homeId : f.awayId;
  return null;
}

/** Aggiorna un confronto dopo una partita. Restituisce true se il confronto è deciso. */
export function updateTie(world: World, tie: Tie, f: Fixture): boolean {
  if (tie.winnerId) return true;
  const fx = tie.fixtureIds.map((id) => world.fixtures[id]);
  if (tie.format.kind === 'single') {
    const w = fixtureWinner(f);
    if (w) setWinner(tie, w);
  } else if (tie.format.kind === 'twoLegs') {
    if (fx.every((x) => x.played)) {
      const [l1, l2] = fx;
      const homeTot = l2.hg + l1.ag;
      const awayTot = l1.hg + l2.ag;
      if (homeTot > awayTot) setWinner(tie, tie.homeId!);
      else if (awayTot > homeTot) setWinner(tie, tie.awayId!);
      else if (l2.pens) setWinner(tie, l2.pens[0] > l2.pens[1] ? l2.homeId : l2.awayId);
      else setWinner(tie, tie.homeId!);
    }
  } else {
    const w = fixtureWinner(f);
    if (w === tie.homeId) tie.wins[0]++;
    else if (w === tie.awayId) tie.wins[1]++;
    const need = winsNeeded(tie.format);
    if (tie.wins[0] >= need) setWinner(tie, tie.homeId!);
    else if (tie.wins[1] >= need) setWinner(tie, tie.awayId!);
    else {
      // Attiva la prossima gara "se necessaria".
      const next = fx.find((x) => !x.played && x.ifNeeded && !x.cancelled);
      if (next) next.ifNeeded = false;
    }
    if (tie.winnerId) for (const x of fx) if (!x.played) x.cancelled = true;
  }
  return !!tie.winnerId;
}

function setWinner(tie: Tie, w: string) {
  tie.winnerId = w;
  tie.loserId = w === tie.homeId ? tie.awayId ?? undefined : tie.homeId ?? undefined;
}

export function roundDone(round: KnockoutRound): boolean {
  return round.ties.every((t) => !!t.winnerId);
}

export function lastDay(world: World, round: KnockoutRound): number {
  let d = 0;
  for (const t of round.ties) for (const id of t.fixtureIds) {
    const f = world.fixtures[id];
    if (f && !f.cancelled) d = Math.max(d, f.day);
  }
  return d;
}

/** Costruisce il turno successivo (tabellone o sorteggio). Restituisce false se la fase è conclusa. */
export function buildNextRound(world: World, comp: Competition, phaseIdx: number, rng: Rng, importance: number): boolean {
  const phase = comp.phases[phaseIdx];
  const cur = phase.rounds[phase.rounds.length - 1];
  const nextIdx = phase.rounds.length;
  const plan = phase.plan?.[nextIdx];
  if (!plan) return false;
  const winners = cur.ties.map((t) => t.winnerId!).filter(Boolean);
  const entering = phase.entrants?.[nextIdx] ?? [];
  const teams = [...winners, ...entering];
  if (teams.length < 2) return false;
  const seed = (id: string) => phase.seeds?.[id] ?? 999;
  const ties: Tie[] = [];
  if (phase.drawMode === 'random') {
    rng.shuffle(teams);
    for (let i = 0; i + 1 < teams.length; i += 2) {
      // In gara secca ospita la squadra di categoria inferiore (o la peggiore testa di serie);
      // nei confronti doppi la migliore gioca il ritorno in casa.
      const worseFirst = seed(teams[i]) >= seed(teams[i + 1]);
      const better = worseFirst ? teams[i + 1] : teams[i];
      const worse = worseFirst ? teams[i] : teams[i + 1];
      ties.push(plan.format.kind === 'single' ? makeTie(world, worse, better, plan.format) : makeTie(world, better, worse, plan.format));
    }
  } else {
    for (let i = 0; i + 1 < winners.length; i += 2) {
      const a = winners[i];
      const b = winners[i + 1];
      const [h, aw] = seed(a) <= seed(b) ? [a, b] : [b, a];
      ties.push(makeTie(world, h, aw, plan.format));
    }
  }
  const round: KnockoutRound = { name: plan.name, ties, dates: [], format: plan.format };
  phase.rounds.push(round);
  const start = Math.max(lastDay(world, cur) + 3, plan.dates[0] ?? 0);
  scheduleRound(world, comp, phaseIdx, nextIdx, start, importance);
  return true;
}

export function phaseWinner(phase: Phase): string | null {
  const last = phase.rounds[phase.rounds.length - 1];
  if (!last || last.ties.length !== 1) return null;
  return last.ties[0].winnerId ?? null;
}
