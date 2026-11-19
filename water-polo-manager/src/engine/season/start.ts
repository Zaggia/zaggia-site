// Apertura di una nuova stagione: promozioni e retrocessioni, pulizia dei dati,
// nuovi giocatori, budget, sponsor e calendari di tutte le competizioni.

import { leagueRules } from '../data/config';
import { emptyLedger } from '../economy/ledger';
import { aiSponsors, refreshUserSponsorOffers } from '../economy/sponsors';
import { addMessage, addNews } from '../news';
import type { Rng } from '../rng';
import type { World } from '../types';
import { createContinental, createEuropeanSupercup, createLeague, createNationalCup, createSupercup, foreignRanking } from '../competition/builder';
import { generatePlayer } from '../player/generate';
import { aiHireCoach, aiSummerPlanning, ownerInvestment, setAiBudgets } from '../ai/clubAI';
import { autoLineup } from '../club/lineup';
import { chooseTactics } from '../ai/tactics';
import { objectiveEvent } from '../events/events';
import { youthAgeOut } from './routines';
import { generateCoach, generateStaff, STAFF_ROLES } from '../staff/coach';
import { ctxOf } from '../world/context';
import { expectedWage } from '../player/value';
import { clamp } from '../util';
import { sanitizeTactics } from '../tactics/tactics';
import { balancePyramid, sustainTalent } from '../world/pyramid';

/** Applica promozioni e retrocessioni della stagione appena conclusa. */
export function applyMovements(world: World) {
  const prev = world.season - 1;
  for (const rules of world.rules.leagues) {
    const comp = world.competitions[`${rules.key}-${prev}`];
    if (!comp) continue;
    for (const id of comp.promoted) if (rules.promotesTo) world.clubs[id].division = rules.promotesTo;
    for (const id of comp.relegated) if (rules.relegatesTo) world.clubs[id].division = rules.relegatesTo;
  }
}

/** Classifica finale della A1 della stagione precedente (per l'Europa e la Supercoppa). */
function previousA1(world: World): { ranking: string[]; champion: string | null; runnerUp: string | null; cup: string | null } {
  const prev = world.season - 1;
  const a1 = world.competitions[`A1-${prev}`];
  const cup = world.competitions[`COPPA-${prev}`];
  if (a1?.finalRanking) {
    return { ranking: a1.finalRanking[0], champion: a1.winnerId ?? null, runnerUp: a1.runnerUpId ?? null, cup: cup?.winnerId ?? null };
  }
  // Prima stagione: si usa la forza delle squadre di A1.
  const ranking = Object.values(world.clubs)
    .filter((c) => c.division === 'A1')
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);
  return { ranking, champion: ranking[0] ?? null, runnerUp: ranking[1] ?? null, cup: ranking[1] ?? null };
}

function cleanup(world: World) {
  // Si conservano solo le competizioni della stagione precedente (per la consultazione).
  const keep = new Set<string>();
  for (const c of Object.values(world.competitions)) {
    if (c.season < world.season - 1) delete world.competitions[c.id];
    else keep.add(c.id);
  }
  for (const f of Object.values(world.fixtures)) if (!keep.has(f.compId)) delete world.fixtures[f.id];
  for (const r of Object.values(world.reports)) if (r.season < world.season - 1) delete world.reports[r.id];
  // Giocatori ritirati non più utili.
  for (const p of Object.values(world.players)) {
    // Un buon giocatore senza squadra resta sul mercato finché non ha 41 anni (prima spariva a 37).
    if (p.retired || (!p.clubId && world.season - p.birthYear > (p.overall >= 62 ? 40 : 37))) {
      delete world.players[p.id];
      delete world.knowledge[p.id];
    }
  }
  world.shortlist = world.shortlist.filter((id) => world.players[id]);
  world.events = world.events.filter((e) => !e.resolved || e.season >= world.season - 1);
  world.transfers = world.transfers.filter((t) => t.season >= world.season - 2);
  world.offers = world.offers.filter((o) => o.status === 'pending');
  world.sponsorOffers = [];
  world.negotiations = {};
}

/**
 * Ogni estate sul mercato degli svincolati ci sono anche giocatori di alto livello (campioni a fine contratto, veterani, stranieri):
 * almeno 12 sopra 72, 4 sopra 80 e 1 sopra 86. Si pagano con l'ingaggio, non con il cartellino.
 */
export function ensureLuxuryFreeAgents(world: World, ctx: ReturnType<typeof ctxOf>, rng: Rng) {
  const free = () => Object.values(world.players).filter((p) => !p.clubId && !p.retired && !p.youth);
  for (const [min, need, lo, hi] of [[86, 1, 86, 90], [80, 4, 80, 86], [72, 12, 72, 80]] as const) {
    let have = free().filter((p) => p.overall >= min).length;
    for (; have < need; have++) {
      const level = lo + rng.float(0, hi - lo);
      const p = generatePlayer(ctx, { level, exactOverall: Math.round(level), age: rng.int(26, 34), foreignChance: 0.55, potential: Math.round(level) });
      world.players[p.id] = p;
    }
  }
}

/** Mantiene vivo il mercato degli svincolati e il ricambio generazionale. */
function replenishFreeAgents(world: World, rng: Rng) {
  const ctx = ctxOf(world);
  let free = Object.values(world.players).filter((p) => !p.clubId && !p.retired);
  // Chi resta troppo a lungo senza squadra abbandona l'attività: il mercato degli svincolati resta gestibile.
  if (free.length > 450) {
    // Si ritirano solo i più deboli: i giocatori buoni restano sul mercato e non "spariscono" l'anno dopo.
    const sorted = [...free].filter((p) => p.overall < 58 || (world.season - p.birthYear >= 34 && p.overall < 70)).sort((a, b) => a.overall - b.overall + (b.birthYear - a.birthYear) * 0.5);
    for (const p of sorted.slice(0, free.length - 450)) {
      p.retired = true;
      delete world.players[p.id];
      delete world.knowledge[p.id];
    }
    free = free.filter((p) => world.players[p.id]);
    world.shortlist = world.shortlist.filter((id) => world.players[id]);
  }
  const target = 220;
  for (let i = free.length; i < target; i++) {
    const level = clamp(rng.gauss(36, 11), 18, 72);
    const p = generatePlayer(ctx, { level, foreignChance: 0.3, age: rng.int(19, 32) });
    world.players[p.id] = p;
  }
  ensureLuxuryFreeAgents(world, ctx, rng);
  // Allenatori e staff senza squadra.
  const coaches = Object.values(world.coaches).filter((c) => !c.clubId).length;
  for (let i = coaches; i < 40; i++) {
    const c = generateCoach(ctx, clamp(rng.gauss(50, 16), 18, 92), null);
    world.coaches[c.id] = c;
  }
  for (const role of STAFF_ROLES) {
    const n = Object.values(world.staff).filter((s) => !s.clubId && s.role === role).length;
    for (let i = n; i < 10; i++) {
      const s = generateStaff(ctx, role, clamp(rng.gauss(48, 17), 12, 92), null);
      world.staff[s.id] = s;
    }
  }
}

export function createSeasonCompetitions(world: World, rng: Rng) {
  for (const rules of world.rules.leagues) {
    const comp = createLeague(world, rules, rng);
    world.competitions[comp.id] = comp;
  }
  const prev = previousA1(world);
  // Prima le coppe europee (date fisse), poi le nazionali che si adattano.
  const foreign = foreignRanking(world, rng);
  const used = new Set<string>();
  for (const cr of [...world.rules.continental].sort((a, b) => a.level - b.level)) {
    const comp = createContinental(world, cr, prev.ranking, foreign, used, rng);
    if (comp) world.competitions[comp.id] = comp;
  }
  for (const cup of world.rules.cups) {
    const comp = cup.key === 'EUSC'
      ? createEuropeanSupercup(world, cup)
      : cup.kind === 'supercup'
        ? createSupercup(world, cup, prev.champion, prev.cup, prev.runnerUp)
        : createNationalCup(world, cup, rng);
    if (comp) world.competitions[comp.id] = comp;
  }
}

export function startSeason(world: World, rng: Rng, first = false) {
  if (!first) {
    world.season++;
    world.day = 0;
    world.phase = 'regular';
    applyMovements(world);
    balancePyramid(world);
    sustainTalent(world);
    cleanup(world);
  }
  replenishFreeAgents(world, rng);
  for (const club of Object.values(world.clubs)) {
    // Contabilità della nuova stagione.
    if (!first) {
      club.finances.pastLedgers.push(club.finances.ledger);
      if (club.finances.pastLedgers.length > 12) club.finances.pastLedgers.shift();
      club.finances.ledger = emptyLedger(world.season);
      club.finances.weeklyBalance = [Math.round(club.finances.balance)];
    }
    club.abbonati = 0;
    club.recent = [];
    club.fitnessPrep = clamp(club.fitnessPrep * 0.5, 20, 60);
    for (const id of club.playerIds) {
      const p = world.players[id];
      if (!p) continue;
      p.stats = {};
      p.condition = Math.min(100, p.condition + 20);
    }
    for (const id of club.youthIds) if (world.players[id]) world.players[id].stats = {};
    youthAgeOut(world, club);
    if (club.isUser) continue;
    ownerInvestment(world, club, rng);
    if (!club.coachId) aiHireCoach(world, club, rng);
    aiSponsors(world, club, rng);
    setAiBudgets(world, club);
    aiSummerPlanning(world, club, rng);
    // Prezzi dei biglietti in base alla categoria.
    try {
      const r = leagueRules(world.rules, club.division);
      club.finances.ticketPrice = r.ticketPrice;
      club.finances.seasonTicketPrice = r.ticketPrice * 8;
    } catch { /* club estero */ }
  }
  for (const p of Object.values(world.players)) if (!p.clubId) p.stats = {};
  createSeasonCompetitions(world, rng);
  for (const club of Object.values(world.clubs)) {
    if (club.isUser) continue;
    club.lineup = autoLineup(world, club);
    club.tactics = chooseTactics(world, club);
  }
  // Utente
  const user = world.clubs[world.userClubId];
  sanitizeTactics(world, user);
  for (const id of user.playerIds) {
    const p = world.players[id];
    if (p?.contract && p.contract.wage < 300) p.contract.wage = expectedWage(p, world.season);
  }
  refreshUserSponsorOffers(world, rng, !first);
  // Alla prima stagione l'obiettivo è già stato scelto alla creazione del club.
  if (!first) objectiveEvent(world);
  if (!first) {
    const div = world.rules.leagues.find((l) => l.key === user.division)?.name ?? user.division;
    addMessage(world, 'societa', `Inizia la stagione ${world.season}/${(world.season + 1) % 100}`,
      `${user.name} è iscritta alla ${div}. Mercato estivo aperto fino al 30 settembre: è il momento di costruire la squadra e di preparare il fisico.`, { important: true });
    addNews(world, `Al via la stagione ${world.season}/${(world.season + 1) % 100}`, 'Calendari pubblicati per tutti i campionati e le coppe.', 'campionato');
  }
}
