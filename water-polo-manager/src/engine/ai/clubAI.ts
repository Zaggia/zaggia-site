// Intelligenza artificiale delle società: mercato, allenatori, strutture, budget e crisi.
// Ogni club decide in base alla propria filosofia, ai soldi disponibili e ai risultati.

import { DIFFICULTIES } from '../data/config';
import { annualWages, overdraftLimit, projectSeason } from '../economy/finance';
import { income } from '../economy/ledger';
import { addNews, fmtMoney } from '../news';
import type { Rng } from '../rng';
import type { Club, FacilityKey, Player, Role, StaffRole, World } from '../types';
import { clamp, niceMoney, topN } from '../util';
import { ageOf } from '../player/value';
import { teamStrength } from '../club/lineup';
import { interestIn, releasePlayer, suggestedStatus, wageDemand, defaultYears } from '../transfer/contracts';
import { askingPrice, completeTransfer, createIncomingOffer, evaluateBid, transferWindowOpen } from '../transfer/market';
import { coachDemand, coachInterest, fireCoach, hireCoach, startUpgrade, canUpgrade, staffDemand } from '../club/manage';
import { coachRating, STAFF_ROLES } from '../staff/coach';
import { expectedRank } from '../economy/sponsors';
import { positionOf } from '../competition/standings';
import { leagueComp } from '../world/queries';
import { FACILITIES, maxFacilityLevel, upgradeCost } from '../club/facilities';
import { promoteYouth } from '../club/manage';
import { releaseCandidate, rosterLimit, trimRoster } from '../club/roster';
import { fullName } from '../player/generate';

const PERIMETER: Role[] = ['MAN', 'CVA', 'ALA', 'UNI'];

function roleNeeds(squad: Player[]): Role[] {
  const count = (r: Role) => squad.filter((p) => p.role === r).length;
  const needs: Role[] = [];
  if (count('POR') < 2) needs.push('POR');
  if (count('CEN') < 2) needs.push('CEN');
  if (count('DIF') < 2) needs.push('DIF');
  const per = squad.filter((p) => PERIMETER.includes(p.role)).length;
  if (per < 8) needs.push('ALA', 'MAN', 'CVA');
  return needs;
}

/** Imposta i budget stagionali di un club AI (all'inizio della stagione). */
export function setAiBudgets(world: World, club: Club) {
  const proj = projectSeason(world, club);
  const revenue = proj.income.reduce((t, x) => t + x.value, 0) + Math.max(0, club.finances.ledger.income.investimenti);
  const otherCosts = proj.expense.filter((x) => x.label !== 'Stipendi giocatori').reduce((t, x) => t + x.value, 0);
  const share = club.philosophy === 'campioni' || club.philosophy === 'ambiziosa' ? 0.97 : club.philosophy === 'prudente' ? 0.85 : 0.92;
  // Riserva di sicurezza pari al 25% dei ricavi: il surplus oltre la riserva si investe gradualmente.
  const reserve = revenue * 0.25;
  const surplus = Math.max(0, club.finances.balance - reserve);
  const deficit = Math.min(0, club.finances.balance);
  club.finances.wageBudget = niceMoney(Math.max(12_000, (revenue - otherCosts) * share + surplus * 0.2 + deficit * 0.5));
  club.finances.transferBudget = niceMoney(Math.max(0, surplus * (club.philosophy === 'prudente' ? 0.25 : 0.5)));
}

/** Mecenati: i club più ambiziosi ricevono investimenti dalla proprietà. */
export function ownerInvestment(world: World, club: Club, rng: Rng) {
  if (club.isUser) return;
  const rich = club.philosophy === 'campioni' || club.philosophy === 'ambiziosa';
  if (club.reputation >= 65 && rich && club.finances.balance < projectSeason(world, club).income.reduce((t, x) => t + x.value, 0) * 0.5) {
    const amt = niceMoney((club.reputation - 60) * 15_000 * rng.float(0.7, 1.3));
    income(club, 'investimenti', amt);
  } else if (club.finances.balance < -overdraftLimit(club) * 0.7 && rng.chance(0.5)) {
    const amt = niceMoney(-club.finances.balance * rng.float(0.5, 1.0));
    income(club, 'investimenti', amt);
    addNews(world, `${club.name}: la proprietà ripiana i debiti`, `Un aumento di capitale di ${fmtMoney(amt)} salva i conti della società.`, 'societa');
  }
}

interface Pool {
  players: Player[];
}

export function buildMarketPool(world: World): Pool {
  const players = Object.values(world.players).filter(
    (p) => !p.retired && !p.youth && !p.loan && (!p.injury || p.injury.daysLeft < 30),
  );
  players.sort((a, b) => b.overall - a.overall);
  return { players };
}

function starters(world: World, club: Club): Player[] {
  return topN(club.playerIds.map((id) => world.players[id]).filter(Boolean), 7, (p) => p.overall);
}

/** Una mossa di mercato per un club AI (al massimo un acquisto e una cessione a settimana). */
export function aiMarketWeek(world: World, club: Club, pool: Pool, rng: Rng, loanOut?: Map<string, number>) {
  // Con la rosa corta si fanno più operazioni nella stessa settimana.
  const limit = rosterLimit(world);
  const moves = club.playerIds.length < limit - 2 ? 4 : club.playerIds.length < limit ? 2 : 1;
  for (let m = 0; m < moves; m++) {
    const before = club.playerIds.length;
    aiMarketMove(world, club, pool, rng, loanOut);
    if (club.playerIds.length === before) break;
  }
  ensureMinimumSquad(world, club, rng);
}

/**
 * Completa la rosa fino al numero regolamentare: prima i giovani del vivaio che meritano,
 * poi gli svincolati più utili con un ingaggio sostenibile. Restituisce i nomi dei nuovi arrivati.
 */
export function fillRoster(world: World, club: Club): string[] {
  const limit = rosterLimit(world);
  const added: string[] = [];
  let guard = 0;
  while (club.playerIds.length < limit && guard++ < limit + 2) {
    const squad = club.playerIds.map((id) => world.players[id]).filter(Boolean);
    const gkShort = squad.filter((p) => p.role === 'POR').length < 2;
    const needs = gkShort ? (['POR'] as Role[]) : roleNeeds(squad);
    const fits = (p: Player) => !needs.length || needs.includes(p.role) || (!gkShort && p.role === 'UNI');
    const st = starters(world, club);
    const avgSt = st.length ? st.reduce((t, p) => t + p.overall, 0) / st.length : 30;
    const youth = club.youthIds.map((id) => world.players[id])
      .filter((p) => p && !p.injury && (!gkShort || p.role === 'POR'))
      .sort((a, b) => b.overall - a.overall)[0];
    const cap = Math.max(2500, club.finances.wageBudget * 0.05);
    const free = Object.values(world.players)
      .filter((p) => !p.clubId && !p.retired && !p.injury && !p.youth && p.overall <= avgSt + 4)
      .sort((a, b) => b.overall - a.overall);
    let pick: Player | null = null;
    let wage = 0;
    for (const pool of [free.filter(fits), gkShort ? [] : free]) {
      for (const p of pool.slice(0, 60)) {
        const w = Math.round(wageDemand(world, p, club, 'riserva', 1) * 0.9);
        if (w <= cap) { pick = p; wage = w; break; }
      }
      if (pick) break;
    }
    if (!pick) {
      // Nessuno svincolato "giusto": si prende il più economico disponibile.
      const cheap = [...free].reverse().find((p) => !gkShort || p.role === 'POR') ?? null;
      if (cheap) { pick = cheap; wage = Math.round(wageDemand(world, cheap, club, 'riserva', 1) * 0.9); }
    }
    // Il giovane sale in prima squadra se è già all'altezza o se ha un futuro da titolare: il vivaio non va svuotato.
    const youthReady = youth && (!pick || youth.overall >= pick.overall + 1 || (youth.potential >= avgSt + 4 && youth.overall >= pick.overall - 4));
    if (youth && youthReady) {
      promoteYouth(world, club, youth);
      added.push(fullName(youth));
      continue;
    }
    if (!pick) break;
    completeTransfer(world, pick, club, 0, { wage, years: 1, status: 'riserva' });
    added.push(fullName(pick));
  }
  return added;
}

/** Rosa d'emergenza: rosa completa, almeno un portiere disponibile e abbastanza giocatori per scendere in acqua. */
export function ensureMinimumSquad(world: World, club: Club, rng: Rng) {
  const avail = () => club.playerIds.map((id) => world.players[id]).filter((p) => p && !p.injury);
  fillRoster(world, club);
  if (!club.isUser && !avail().some((p) => p.role === 'POR')) {
    const youthGk = club.youthIds.map((id) => world.players[id]).filter((p) => p && p.role === 'POR' && !p.injury).sort((a, b) => b.overall - a.overall)[0];
    if (youthGk) {
      promoteYouth(world, club, youthGk);
      trimRoster(world, club, youthGk.id);
    } else {
      const gk = Object.values(world.players).filter((p) => !p.clubId && !p.retired && !p.injury && p.role === 'POR').sort((a, b) => b.overall - a.overall)
        .find((p) => wageDemand(world, p, club, 'riserva', 1) <= Math.max(3000, club.finances.wageBudget * 0.06));
      if (gk) {
        completeTransfer(world, gk, club, 0, { wage: Math.round(wageDemand(world, gk, club, 'riserva', 1) * 0.9), years: 1, status: 'riserva' });
        trimRoster(world, club, gk.id);
      }
    }
  }
  // Troppi lungodegenti per completare la formazione: si rescinde con chi resterà fuori più a lungo.
  let guard = 0;
  while (!club.isUser && avail().length < 9 && guard++ < 4) {
    const out = club.playerIds.map((id) => world.players[id]).filter((p) => p.injury && p.injury.daysLeft > 21 && !p.loan)
      .sort((a, b) => b.injury!.daysLeft - a.injury!.daysLeft)[0];
    if (!out) break;
    releasePlayer(world, out, 'svincolato');
    fillRoster(world, club);
  }
  void rng;
  void releaseCandidate;
}

function aiMarketMove(world: World, club: Club, pool: Pool, rng: Rng, loanOut?: Map<string, number>) {
  let squad = club.playerIds.map((id) => world.players[id]).filter(Boolean);
  const window = transferWindowOpen(world).open;
  const aggression = DIFFICULTIES[world.difficulty].aiAggression;
  const limit = rosterLimit(world);
  // Rosa oltre il limite regolamentare: si libera il meno utile.
  if (squad.length > limit) {
    trimRoster(world, club);
    squad = club.playerIds.map((id) => world.players[id]).filter(Boolean);
  }
  // Crisi economica: si vende il giocatore con valore più alto rispetto all'utilità.
  const wages = annualWages(world, club, loanOut);
  const crisis = club.finances.balance < -overdraftLimit(club) * 0.5 || wages > club.finances.wageBudget * 1.25;
  if (crisis && window && squad.length > 14 && rng.chance(0.5)) {
    const sell = topN(squad.filter((p) => p.contract && p.clubId === club.id), 1, (p) => p.contract!.wage / Math.max(1, p.overall))[0];
    if (sell) sell.transferListed = true;
  }
  // Troppi stipendi: si libera chi pesa di più rispetto al rendimento (fuori dai titolari).
  if (wages > club.finances.wageBudget * 1.2 && squad.length >= limit && window) {
    const bench = [...squad].sort((a, b) => b.overall - a.overall).slice(9);
    const heavy = topN(bench.filter((p) => p.contract), 1, (p) => p.contract!.wage / Math.max(1, p.overall))[0];
    if (heavy) heavy.transferListed = true;
  }
  const needs = roleNeeds(squad);
  const shortSquad = squad.length < limit;
  if (shortSquad && signCheapFreeAgent(world, club, squad, rng)) return;
  const tryBuy = needs.length > 0 || shortSquad || (window && rng.chance(0.18 * aggression));
  if (!tryBuy) return;
  if (!window && squad.length >= limit && needs.length === 0) return;
  const st = starters(world, club);
  const avgStarter = st.length ? st.reduce((t, p) => t + p.overall, 0) / st.length : 30;
  const weakest = st.length ? st[st.length - 1] : null;
  const role: Role | null = needs.length ? rng.pick(needs) : shortSquad ? null : weakest?.role ?? null;
  const minOvr = needs.length || shortSquad ? avgStarter - 12 : (weakest?.overall ?? 30) + 2;
  const maxOvr = avgStarter + (club.philosophy === 'campioni' ? 10 : 6);
  const wageRoom = club.finances.wageBudget - wages;
  if (wageRoom < 500 && !needs.length) return;
  const youngPref = club.philosophy === 'giovani';
  let checked = 0;
  for (const p of pool.players) {
    if (p.overall > maxOvr) continue;
    if (p.overall < minOvr) break;
    if (p.clubId === club.id) continue;
    if (role && p.role !== role && !(role !== 'POR' && p.role === 'UNI')) continue;
    if (role == null && p.role === 'POR' && squad.filter((x) => x.role === 'POR').length >= 2) continue;
    const age = ageOf(p, world.season);
    if (youngPref && age > 25 && rng.chance(0.6)) continue;
    if (club.philosophy === 'prudente' && p.clubId && rng.chance(0.5)) continue;
    if (++checked > 60) break;
    const seller = p.clubId ? world.clubs[p.clubId] : null;
    if (seller && !window) continue;
    if (seller?.isUser) {
      if (rng.chance(0.25 * aggression) && club.reputation >= seller.reputation - 5) {
        const fee = askingPrice(world, p) * rng.float(0.8, 1.1);
        if (fee <= club.finances.transferBudget) createIncomingOffer(world, p, club, fee);
      }
      continue;
    }
    if (seller && seller.division === club.division && seller.country === club.country && rng.chance(0.5)) continue;
    const interest = interestIn(world, p, club);
    if (interest.value < 40) continue;
    const status = suggestedStatus(world, p, club);
    const years = defaultYears(p, world.season);
    const demand = wageDemand(world, p, club, status, years);
    if (demand > wageRoom * 1.1 + (needs.length ? 3000 : 0)) continue;
    if (seller) {
      const fee = askingPrice(world, p);
      if (fee > club.finances.transferBudget) continue;
      const resp = evaluateBid(world, p, fee, club);
      if (resp.result !== 'accept') continue;
      completeTransfer(world, p, club, fee, { wage: demand, years, status });
      club.finances.transferBudget -= fee;
    } else {
      completeTransfer(world, p, club, 0, { wage: demand, years, status });
    }
    return;
  }
}

/** Completa la rosa con lo svincolato più utile tra quelli a basso costo. */
function signCheapFreeAgent(world: World, club: Club, squad: Player[], rng: Rng): boolean {
  const needs = roleNeeds(squad);
  const st = starters(world, club);
  const avg = st.length ? st.reduce((t, p) => t + p.overall, 0) / st.length : 30;
  const cap = Math.max(2500, club.finances.wageBudget * 0.05);
  const free = Object.values(world.players)
    .filter((p) => !p.clubId && !p.retired && !p.injury && p.overall <= avg + 4 && (!needs.length || needs.includes(p.role)))
    .sort((a, b) => b.overall - a.overall);
  for (const p of free.slice(0, 40)) {
    const status = suggestedStatus(world, p, club);
    const years = rng.int(1, 2);
    const demand = wageDemand(world, p, club, status, years);
    if (demand > cap) continue;
    if (interestIn(world, p, club).value < 35) continue;
    completeTransfer(world, p, club, 0, { wage: demand, years, status });
    return true;
  }
  return false;
}

/** Offerte spontanee dei club AI per i migliori giocatori dell'utente e richieste di prestito. */
export function aiInterestInUserPlayers(world: World, rng: Rng) {
  if (!transferWindowOpen(world).open) return;
  const user = world.clubs[world.userClubId];
  const aggression = DIFFICULTIES[world.difficulty].aiAggression;
  const squad = user.playerIds.map((id) => world.players[id]).filter(Boolean);
  const candidates = squad.filter((p) => p.transferListed || p.wantsToLeave || rng.chance(0.05 * aggression));
  for (const p of candidates.slice(0, 3)) {
    if (!rng.chance(p.transferListed ? 0.5 : 0.3)) continue;
    const buyers = Object.values(world.clubs).filter(
      (c) => !c.isUser && c.reputation >= user.reputation - 10 && teamStrength(world, c) <= p.overall + 6 && c.finances.transferBudget > p.value * 0.6,
    );
    if (!buyers.length) continue;
    const b = rng.pick(buyers);
    const fee = askingPrice(world, p) * rng.float(p.transferListed ? 0.6 : 0.8, 1.15);
    createIncomingOffer(world, p, b, Math.min(fee, b.finances.transferBudget));
  }
  for (const p of squad.filter((x) => x.loanListed)) {
    if (!rng.chance(0.35)) continue;
    const lower = Object.values(world.clubs).filter((c) => !c.isUser && c.country === 'ITA' && teamStrength(world, c) <= p.overall + 3);
    if (!lower.length) continue;
    createIncomingOffer(world, p, rng.pick(lower), 0, true);
  }
}

/** Valutazione settimanale dell'allenatore: esonero se i risultati sono molto sotto le attese. */
export function aiCoachReview(world: World, club: Club, rng: Rng) {
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  if (!coach) {
    aiHireCoach(world, club, rng);
    return;
  }
  const comp = leagueComp(world, club.division);
  if (!comp || world.day < 100 || world.day > 300) return;
  const pos = positionOf(world, comp, club.id);
  if (!pos) return;
  const size = comp.phases[0].groups[pos.group].clubIds.length;
  const expected = 1 + expectedRank(world, club) * (size - 1);
  const gap = (pos.pos - expected) / size;
  coach.security = clamp(coach.security - gap * 6 + 0.5, 0, 100);
  const losing = club.recent.slice(-4).every((r) => r === 'L');
  if ((coach.security < 15 || (losing && coach.security < 30)) && rng.chance(0.35)) {
    fireCoach(world, club, 'esonerato');
    aiHireCoach(world, club, rng);
  }
}

export function aiHireCoach(world: World, club: Club, rng: Rng) {
  const budget = Math.max(5000, club.finances.wageBudget * 0.08);
  const options = Object.values(world.coaches)
    .filter((c) => !c.clubId && coachInterest(world, c, club) >= 40 && coachDemand(world, c, club) <= budget * 1.3)
    .sort((a, b) => coachRating(b) - coachRating(a));
  const pick = options[rng.int(0, Math.min(2, options.length - 1))];
  if (!pick) return;
  hireCoach(world, club, pick.id, coachDemand(world, pick, club), rng.int(1, 2));
}

/** Decisioni estive: strutture e staff. */
export function aiSummerPlanning(world: World, club: Club, rng: Rng) {
  // Staff mancante
  const allowed = club.division === 'A1' || club.country !== 'ITA' ? 8 : club.division === 'A2' ? 6 : club.division === 'B' ? 4 : 2;
  const missing = STAFF_ROLES.slice(0, allowed).filter((r) => !club.staff[r]);
  for (const role of missing) hireBestStaff(world, club, role, rng);
  // Strutture
  if (club.philosophy === 'prudente' && rng.chance(0.6)) return;
  const proj = projectSeason(world, club);
  // Si costruisce solo con i conti in ordine: ogni livello in più alza anche i costi di gestione.
  if (proj.net < 20_000 && club.finances.balance < 150_000) return;
  const prefs: FacilityKey[] = club.philosophy === 'giovani'
    ? ['giovanile', 'allenamento', 'scouting', 'palestra']
    : club.philosophy === 'campioni' ? ['allenamento', 'piscina', 'medico', 'palestra'] : ['allenamento', 'palestra', 'piscina', 'uffici', 'medico', 'giovanile'];
  for (const key of prefs) {
    if (club.facilities[key].level >= maxFacilityLevel(club)) continue;
    if (canUpgrade(world, club, key)) continue;
    const cost = upgradeCost(club, key);
    const upkeepDelta = FACILITIES[key].upkeep(club.facilities[key].level + 1) - FACILITIES[key].upkeep(club.facilities[key].level);
    if (club.finances.balance < cost * 2.5 || proj.net < upkeepDelta * 1.5) continue;
    if (rng.chance(0.5)) {
      startUpgrade(world, club, key);
      break;
    }
  }
}

function hireBestStaff(world: World, club: Club, role: StaffRole, rng: Rng) {
  const budget = Math.max(2000, club.finances.wageBudget * 0.03);
  const options = Object.values(world.staff)
    .filter((s) => !s.clubId && s.role === role && staffDemand(s, club) <= budget && s.rating <= club.reputation + 40)
    .sort((a, b) => b.rating - a.rating);
  const s = options[rng.int(0, Math.min(2, options.length - 1))];
  if (!s) return;
  s.clubId = club.id;
  s.contract = { wage: staffDemand(s, club), endSeason: world.season + rng.int(0, 2) };
  club.staff[role] = s.id;
}

/** Rinnovi a fine stagione: si tengono i giocatori utili, si lasciano andare gli altri. */
export function aiRenewals(world: World, club: Club, rng: Rng) {
  const squad = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  // Rinnovi in ordine di importanza, senza sforare il budget stipendi.
  let committed = squad.filter((p) => p.contract && p.contract.endSeason > world.season).reduce((t, p) => t + p.contract!.wage, 0);
  const budget = club.finances.wageBudget * 1.02;
  squad.forEach((p, rank) => {
    if (!p.contract || p.contract.endSeason > world.season) return;
    const age = ageOf(p, world.season);
    const useful = rank < rosterLimit(world) - 2 || (age <= 22 && p.potential > p.overall + 8);
    const tooOld = age >= 34 && rank > 6;
    if (!useful || tooOld || !rng.chance(0.9)) return;
    const years = defaultYears(p, world.season + 1);
    const status = suggestedStatus(world, p, club);
    const wage = wageDemand(world, p, club, status, years);
    if (committed + wage > budget && rank >= 4) return;
    committed += wage;
    p.contract = { wage, endSeason: world.season + years, status };
  });
}
