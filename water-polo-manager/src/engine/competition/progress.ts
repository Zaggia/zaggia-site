// Avanzamento delle competizioni dopo ogni partita: serie, turni successivi,
// postseason (playoff/playout), verdetti di promozione/retrocessione, premi.

import { nextWeekday } from '../calendar';
import { leagueRules } from '../data/config';
import { income } from '../economy/ledger';
import { addNews } from '../news';
import type { Rng } from '../rng';
import type { Competition, Fixture, Phase, Tie, TieFormat, World } from '../types';
import { continentalKnockoutPairs, dropInPairs, startContinentalStage2 } from './builder';
import { bracketPairs, buildNextRound, makeTie, phaseWinner, roundDone, scheduleRound, updateTie } from './knockout';
import { computeStandings } from './standings';

function cupRules(world: World, key: string) {
  return world.rules.cups.find((c) => c.key === key);
}
function contRules(world: World, key: string) {
  return world.rules.continental.find((c) => c.key === key);
}

export function importanceFor(comp: Competition, phase: Phase, roundIdx: number): number {
  if (comp.kind === 'league') {
    if (phase.purpose === 'main') return 0.3;
    const left = (phase.plan?.length ?? 1) - roundIdx;
    return phase.purpose === 'playout' ? 0.9 : left <= 1 ? 1 : left === 2 ? 0.85 : 0.7;
  }
  const left = (phase.plan?.length ?? 1) - roundIdx;
  const base = comp.kind === 'continental' ? 0.6 : 0.45;
  return Math.min(1, base + (left <= 1 ? 0.4 : left === 2 ? 0.3 : left === 3 ? 0.15 : 0));
}

export function afterFixture(world: World, f: Fixture, rng: Rng) {
  const comp = world.competitions[f.compId];
  if (!comp) return;
  const phase = comp.phases[f.phase];
  if (!phase) return;
  if (comp.kind === 'continental') {
    const rules = contRules(world, comp.key);
    if (rules) {
      const w = f.hg > f.ag ? f.homeId : f.ag > f.hg ? f.awayId : null;
      if (w) income(world.clubs[w], 'premi', rules.prizePerWin);
    }
  }
  if (phase.kind === 'knockout') {
    const round = phase.rounds[f.round];
    const tie = round?.ties.find((t) => t.id === f.tieId);
    if (!tie) return;
    const decided = !tie.winnerId && updateTie(world, tie, f);
    if (decided) onTieDecided(world, comp, phase, f.round, tie);
    if (roundDone(round) && f.round === phase.rounds.length - 1) {
      const more = buildNextRound(world, comp, f.phase, rng, importanceFor(comp, phase, f.round + 1));
      if (!more) {
        phase.done = true;
        onPhaseDone(world, comp, f.phase, rng);
      }
    }
  } else {
    const allPlayed = phase.groups.every((g) => g.fixtureIds.every((id) => world.fixtures[id]?.played));
    if (allPlayed && !phase.done) {
      phase.done = true;
      onPhaseDone(world, comp, f.phase, rng);
    }
  }
}

function onTieDecided(world: World, comp: Competition, phase: Phase, roundIdx: number, tie: Tie) {
  const loser = tie.loserId ? world.clubs[tie.loserId] : null;
  const isFinal = (phase.plan?.length ?? 0) - 1 === roundIdx;
  if (comp.kind === 'cup' || comp.kind === 'supercup') {
    const rules = cupRules(world, comp.key);
    if (rules && loser) {
      const prize = comp.kind === 'supercup' ? rules.prize[0] : rules.prize[Math.min(rules.prize.length - 2, roundIdx + 1)] ?? 0;
      if (prize) income(loser, 'premi', prize);
    }
  }
  if (comp.kind === 'continental') {
    const rules = contRules(world, comp.key);
    if (rules && loser) {
      const reached = koRoundIndex(comp, phase, roundIdx);
      income(loser, 'premi', rules.prizeByRound[Math.min(reached, rules.prizeByRound.length - 2)] ?? 0);
    }
  }
  if (isFinal && tie.winnerId && tie.loserId) {
    const w = world.clubs[tie.winnerId];
    const l = world.clubs[tie.loserId];
    if (comp.kind === 'league' && phase.purpose === 'promotion') {
      addNews(world, `${w.name} promosso!`, `${w.name} vince ${phase.name.toLowerCase()} superando ${l.name}.`, 'promozione');
    } else if (comp.kind === 'league' && phase.purpose === 'playout') {
      addNews(world, `${l.name} retrocede`, `${l.name} perde lo spareggio salvezza contro ${w.name}.`, 'retrocessione');
    }
  }
}

function koRoundIndex(comp: Competition, phase: Phase, roundIdx: number): number {
  // Premi: 0 = uscita dai gironi, 1 = uscita dalla seconda fase a gironi (se c'è), poi un livello per ogni turno a eliminazione.
  void phase;
  return comp.phases.filter((p) => p.kind === 'groups').length + roundIdx;
}

function onPhaseDone(world: World, comp: Competition, idx: number, rng: Rng) {
  if (comp.kind === 'league') {
    if (idx === 0) createPostseason(world, comp, rng);
    if (comp.phases.every((p) => p.done)) finalizeLeague(world, comp);
    return;
  }
  if (comp.kind === 'continental' && comp.phases[idx].kind === 'groups') {
    const phase = comp.phases[idx];
    const rules = contRules(world, comp.key);
    const winners: string[] = [];
    const runners: string[] = [];
    const dropped: string[] = [];
    phase.groups.forEach((_, g) => {
      const st = computeStandings(world, comp, idx, g);
      winners.push(st[0].clubId);
      runners.push(st[1].clubId);
      for (const r of st.slice(2)) {
        if (rules) income(world.clubs[r.clubId], 'premi', rules.prizeByRound[Math.min(idx, rules.prizeByRound.length - 2)]);
        dropped.push(r.clubId);
      }
    });
    // Chi esce dai gironi della Champions League scende in Euro Cup, direttamente agli ottavi.
    if (idx === 0 && rules?.dropTo) {
      const target = world.competitions[`${rules.dropTo}-${comp.season}`];
      const tko = target?.phases[target.phases.length - 1];
      if (tko?.pool) tko.pool.push(...dropped);
    }
    const next = comp.phases[idx + 1];
    // Seconda fase a gironi (quarti di finale della Champions League).
    if (rules?.stage2 && next?.kind === 'groups') {
      startContinentalStage2(world, comp, idx + 1, rules, winners, runners, rng);
      return;
    }
    const ko = next;
    const plan = ko.plan!;
    const seeds: Record<string, number> = {};
    winners.forEach((id, i) => (seeds[id] = i + 1));
    runners.forEach((id, i) => (seeds[id] = 10 + i));
    const pool = ko.pool ?? [];
    const withDrops = pool.length >= winners.length + runners.length;
    if (withDrops) pool.forEach((id, i) => (seeds[id] = 20 + i));
    ko.seeds = seeds;
    const pairs = withDrops ? dropInPairs(world, [...winners, ...runners], pool, rng) : continentalKnockoutPairs(winners, runners);
    const ties = pairs.map(([h, a]) => makeTie(world, h, a, plan[0].format));
    ko.rounds.push({ name: plan[0].name, ties, dates: [], format: plan[0].format });
    scheduleRound(world, comp, idx + 1, 0, plan[0].dates[0], importanceFor(comp, ko, 0));
    return;
  }
  // Coppe e fase finale europea: abbiamo il vincitore.
  const phase = comp.phases[idx];
  const winner = phaseWinner(phase);
  if (!winner) return;
  const last = phase.rounds[phase.rounds.length - 1].ties[0];
  comp.finished = true;
  comp.winnerId = winner;
  comp.runnerUpId = last.loserId;
  const w = world.clubs[winner];
  const r = last.loserId ? world.clubs[last.loserId] : null;
  if (comp.kind === 'cup' || comp.kind === 'supercup') {
    const rules = cupRules(world, comp.key);
    if (rules) {
      income(w, 'premi', rules.prize[rules.prize.length - 1]);
      w.reputation = Math.min(100, w.reputation + rules.reputationGain);
    }
  } else if (comp.kind === 'continental') {
    const rules = contRules(world, comp.key);
    if (rules) {
      income(w, 'premi', rules.prizeByRound[rules.prizeByRound.length - 1]);
      if (r) income(r, 'premi', rules.prizeByRound[rules.prizeByRound.length - 2]);
      w.reputation = Math.min(100, w.reputation + rules.reputationGain);
    }
  }
  w.honours.push({ season: world.season, comp: comp.key, label: comp.name });
  w.devPoints += comp.kind === 'continental' ? 220 : comp.kind === 'cup' ? 120 : 50;
  (world.rollOfHonour[comp.key] ||= []).unshift({ season: world.season, clubId: w.id, clubName: w.name, runnerUp: r?.name });
  addNews(world, `${w.name} vince ${comp.name}!`, `${w.name} conquista ${comp.name}${r ? ` battendo ${r.name} in finale` : ''}.`, 'trofeo');
}

/** Crea playoff e playout al termine della stagione regolare, secondo il regolamento. */
export function createPostseason(world: World, comp: Competition, rng: Rng) {
  const rules = leagueRules(world.rules, comp.key);
  const main = comp.phases[0];
  const lastRegular = Math.max(...main.groups.flatMap((g) => g.fixtureIds.map((id) => world.fixtures[id]?.day ?? 0)));
  const start = nextWeekday(world.season, lastRegular + 5, 6);
  for (const rule of rules.postseason) {
    const scopes = rule.scope === 'perGroup' ? main.groups.map((_, g) => g) : [-1];
    for (const g of scopes) {
      let teams: string[];
      if (g >= 0) {
        const st = computeStandings(world, comp, 0, g);
        teams = rule.positions.map((pos) => st[pos - 1]?.clubId).filter(Boolean);
      } else {
        // Tutti i gironi insieme: si prendono le posizioni da ogni girone e si ordinano per punti.
        const rows = main.groups.flatMap((_, gi) => {
          const st = computeStandings(world, comp, 0, gi);
          return rule.positions.map((pos) => st[pos - 1]).filter(Boolean);
        });
        teams = rows.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga)).map((r) => r.clubId);
      }
      if (teams.length < 2) continue;
      const seeds: Record<string, number> = {};
      teams.forEach((id, i) => (seeds[id] = i + 1));
      const suffix = g >= 0 && main.groups.length > 1 ? ` · ${main.groups[g].name}` : '';
      const plan = rule.rounds.map((r) => ({
        name: `${r.name}${suffix}`,
        format: (r.bestOf > 1 ? { kind: 'series', bestOf: r.bestOf } : { kind: 'single' }) as TieFormat,
        dates: [] as number[],
        neutral: false,
      }));
      const phase: Phase = {
        kind: 'knockout', name: `${rule.name}${suffix}`, purpose: rule.id, groups: [], rounds: [], done: false,
        sourceGroup: g >= 0 ? g : undefined, plan, drawMode: 'bracket', seeds,
      };
      let size = 1;
      while (size < teams.length) size *= 2;
      const pairs = bracketPairs(size);
      const ties = pairs.map(([a, b]) => makeTie(world, teams[a - 1] ?? null, teams[b - 1] ?? null, plan[0].format));
      phase.rounds.push({ name: plan[0].name, ties, dates: [], format: plan[0].format });
      comp.phases.push(phase);
      const pIdx = comp.phases.length - 1;
      scheduleRound(world, comp, pIdx, 0, start, importanceFor(comp, phase, 0));
      // Eventuali bye: se il turno è già completo si costruisce subito il successivo.
      if (roundDone(phase.rounds[0]) && !buildNextRound(world, comp, pIdx, rng, importanceFor(comp, phase, 1))) phase.done = true;
      const names = teams.map((id) => world.clubs[id].name).join(', ');
      addNews(world, `${comp.name}: al via ${phase.name.toLowerCase()}`, `Qualificate: ${names}.`, 'campionato');
    }
  }
}

/** Verdetti finali del campionato. */
export function finalizeLeague(world: World, comp: Competition) {
  if (comp.finished) return;
  const rules = leagueRules(world.rules, comp.key);
  const main = comp.phases[0];
  const ranking: string[][] = [];
  const promoted = new Set<string>();
  const relegated = new Set<string>();
  main.groups.forEach((group, g) => {
    const st = computeStandings(world, comp, 0, g).map((r) => r.clubId);
    let order = [...st];
    // Playoff scudetto: l'ordine finale segue l'esito dei playoff.
    const title = comp.phases.find((p) => p.purpose === 'title' && (p.sourceGroup == null || p.sourceGroup === g));
    if (title) {
      const champion = phaseWinner(title);
      const elim: string[][] = title.rounds.map((r) => r.ties.map((t) => t.loserId!).filter(Boolean));
      const head: string[] = [];
      if (champion) head.push(champion);
      for (let i = elim.length - 1; i >= 0; i--) head.push(...elim[i].sort((a, b) => st.indexOf(a) - st.indexOf(b)));
      order = [...head, ...st.filter((id) => !head.includes(id))];
      if (champion) {
        comp.winnerId = champion;
        comp.runnerUpId = elim[elim.length - 1]?.[0];
      }
    } else if (main.groups.length === 1) {
      comp.winnerId = st[0];
      comp.runnerUpId = st[1];
    }
    ranking.push(order);
    for (let i = 0; i < rules.directPromotion; i++) if (st[i]) promoted.add(st[i]);
    for (let i = 0; i < rules.directRelegation; i++) if (st[st.length - 1 - i]) relegated.add(st[st.length - 1 - i]);
    for (const ph of comp.phases.filter((p) => p.sourceGroup === g || (p.sourceGroup == null && p.purpose !== 'main'))) {
      if (ph.purpose === 'promotion') {
        const last = ph.rounds[ph.rounds.length - 1];
        for (const t of last?.ties ?? []) if (t.winnerId) promoted.add(t.winnerId);
      }
      if (ph.purpose === 'playout') {
        const last = ph.rounds[ph.rounds.length - 1];
        for (const t of last?.ties ?? []) if (t.loserId) relegated.add(t.loserId);
      }
    }
  });
  comp.finalRanking = ranking;
  comp.promoted = rules.promotesTo ? [...promoted] : [];
  comp.relegated = rules.relegatesTo ? [...relegated] : [];
  comp.finished = true;
  if (comp.winnerId) {
    const w = world.clubs[comp.winnerId];
    w.honours.push({ season: world.season, comp: comp.key, label: rules.tier === 1 ? 'Scudetto' : `Vittoria ${rules.name}` });
    (world.rollOfHonour[comp.key] ||= []).unshift({
      season: world.season, clubId: w.id, clubName: w.name, runnerUp: comp.runnerUpId ? world.clubs[comp.runnerUpId]?.name : undefined,
    });
    if (rules.tier === 1) {
      addNews(world, `${w.name} campione d’Italia!`, `${w.name} conquista lo scudetto ${world.season}/${(world.season + 1) % 100}.`, 'trofeo');
    }
  }
  // Vincitori dei gironi per le categorie con più gironi.
  if (main.groups.length > 1) {
    main.groups.forEach((gr, g) => {
      const first = ranking[g][0];
      if (first) {
        (world.rollOfHonour[`${comp.key}-${g}`] ||= []).unshift({ season: world.season, clubId: first, clubName: `${world.clubs[first].name} (${gr.name})` });
      }
    });
  }
  for (const id of comp.promoted) world.clubs[id].honours.push({ season: world.season, comp: comp.key, label: `Promozione da ${rules.name}` });
  if (comp.promoted.length) {
    addNews(world, `${rules.name}: i verdetti`, `Promosse: ${comp.promoted.map((id) => world.clubs[id].name).join(', ')}.${comp.relegated.length ? ` Retrocesse: ${comp.relegated.map((id) => world.clubs[id].name).join(', ')}.` : ''}`, 'campionato');
  } else if (comp.relegated.length) {
    addNews(world, `${rules.name}: i verdetti`, `Retrocesse: ${comp.relegated.map((id) => world.clubs[id].name).join(', ')}.`, 'campionato');
  }
}

/** Posizione finale di un club nel campionato concluso (1-based nel girone). */
export function finalPosition(comp: Competition, clubId: string): { group: number; pos: number } | null {
  if (!comp.finalRanking) return null;
  for (let g = 0; g < comp.finalRanking.length; g++) {
    const i = comp.finalRanking[g].indexOf(clubId);
    if (i >= 0) return { group: g, pos: i + 1 };
  }
  return null;
}
