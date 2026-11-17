// Sistema economico: entrate e uscite settimanali, giorno partita, abbonamenti,
// debiti, prestiti bancari, stipendi arretrati e rischio fallimento.

import { DIFFICULTIES } from '../data/config';
import { ITALIAN_CITIES } from '../data/cities';
import { FACILITIES, commercialFactor, poolCapacity } from '../club/facilities';
import type { Club, Fixture, World } from '../types';
import { clamp, niceMoney } from '../util';
import { expense, income } from './ledger';
import { newId } from '../world/context';

export const DIV_ECON: Record<string, { sponsorBase: number; attendRate: number; merch: number; admin: number; travel: number; contribution: number; ticket: number }> = {
  A1: { sponsorBase: 100_000, attendRate: 0.12, merch: 4, admin: 30_000, travel: 2500, contribution: 60_000, ticket: 10 },
  A2: { sponsorBase: 62_000, attendRate: 0.22, merch: 3, admin: 12_000, travel: 1100, contribution: 25_000, ticket: 7 },
  B: { sponsorBase: 38_000, attendRate: 0.3, merch: 3, admin: 6_000, travel: 450, contribution: 10_000, ticket: 5 },
  C: { sponsorBase: 18_000, attendRate: 0.35, merch: 2.5, admin: 3_000, travel: 220, contribution: 5_000, ticket: 3 },
  EST: { sponsorBase: 110_000, attendRate: 0.12, merch: 4, admin: 30_000, travel: 2500, contribution: 50_000, ticket: 8 },
};

export function econ(club: Club) {
  return DIV_ECON[club.division] ?? DIV_ECON.EST;
}

export function incomeMult(world: World, club: Club): number {
  return club.isUser ? DIFFICULTIES[world.difficulty].incomeMult : 1;
}

function citySize(club: Club): number {
  return ITALIAN_CITIES.find((c) => c.name === club.city)?.size ?? 3;
}

/** Scuola nuoto, corsi e attività di base: entrata tipica delle società di pallanuoto. */
export function baseActivityIncome(club: Club): number {
  return 14_000 + citySize(club) * 3_000 + club.facilities.piscina.level * 4_000 + club.facilities.giovanile.level * 1_500;
}

export function overdraftLimit(club: Club): number {
  return niceMoney(Math.max(10_000, projectRevenueTotal(club) * 0.22 * (0.6 + club.reputation / 100)));
}

/** Quota di stipendio dei giocatori prestati ad altri club, per club di proprietà. */
export function loanOutIndex(world: World): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of Object.values(world.players)) {
    if (p.loan && p.contract) m.set(p.loan.fromClubId, (m.get(p.loan.fromClubId) ?? 0) + p.contract.wage * (1 - p.loan.wageShare));
  }
  return m;
}

export function annualWages(world: World, club: Club, loanOut?: Map<string, number>): number {
  let t = 0;
  for (const id of [...club.playerIds, ...club.youthIds]) {
    const p = world.players[id];
    if (!p?.contract) continue;
    let w = p.contract.wage;
    if (p.loan) w *= p.loan.wageShare;
    t += w;
  }
  // Giocatori in prestito altrove: paghiamo la quota restante.
  if (loanOut) return t + (loanOut.get(club.id) ?? 0);
  for (const p of Object.values(world.players)) {
    if (p.loan && p.loan.fromClubId === club.id && p.contract) t += p.contract.wage * (1 - p.loan.wageShare);
  }
  return t;
}

export function annualStaffCost(world: World, club: Club): number {
  let t = 0;
  if (club.coachId) t += world.coaches[club.coachId]?.contract?.wage ?? 0;
  for (const id of Object.values(club.staff)) if (id) t += world.staff[id]?.contract?.wage ?? 0;
  return t;
}

export function sponsorIncome(club: Club): number {
  return club.sponsors.reduce((t, s) => t + s.annual, 0);
}

export function homeGamesEstimate(world: World, club: Club): number {
  const l = world.rules.leagues.find((x) => x.key === club.division);
  if (!l) return 10;
  return Math.round(((l.teamsPerGroup - 1) * l.legs) / 2) + 1;
}

export function projectRevenueTotal(club: Club): number {
  const e = econ(club);
  const tickets = club.fans * e.attendRate * e.ticket * 12;
  return e.sponsorBase * (0.6 + club.reputation / 100) * 1.4 + e.contribution + tickets + club.fans * e.merch + baseActivityIncome(club);
}

export interface Projection {
  income: { label: string; value: number }[];
  expense: { label: string; value: number }[];
  net: number;
}

/** Proiezione annuale di entrate e uscite (per la pianificazione del presidente e dell'AI). */
export function projectSeason(world: World, club: Club): Projection {
  const e = econ(club);
  const mult = incomeMult(world, club);
  const homeGames = homeGamesEstimate(world, club);
  const att = Math.min(poolCapacity(club.facilities.piscina.level), club.fans * e.attendRate);
  const inc = [
    { label: 'Sponsor', value: sponsorIncome(club) },
    { label: 'Biglietteria', value: Math.max(0, att - club.abbonati) * club.finances.ticketPrice * homeGames * mult },
    { label: 'Abbonamenti', value: (club.abbonati || club.fans * 0.08) * club.finances.seasonTicketPrice * mult },
    { label: 'Merchandising', value: club.fans * e.merch * commercialFactor(club) * mult },
    { label: 'Scuola nuoto e attività di base', value: baseActivityIncome(club) * mult },
    { label: 'Contributi', value: e.contribution * mult },
  ];
  let upkeep = 0;
  for (const k of Object.keys(FACILITIES) as (keyof typeof FACILITIES)[]) upkeep += FACILITIES[k].upkeep(club.facilities[k].level);
  const loans = club.finances.loans.reduce((t, l) => t + l.weeklyPayment * 52, 0);
  const exp = [
    { label: 'Stipendi giocatori', value: annualWages(world, club) },
    { label: 'Staff tecnico', value: annualStaffCost(world, club) },
    { label: 'Strutture e piscina', value: upkeep },
    { label: 'Trasferte', value: e.travel * homeGames },
    { label: 'Costi amministrativi', value: e.admin },
    { label: 'Rate dei prestiti', value: loans },
  ];
  const net = inc.reduce((t, x) => t + x.value, 0) - exp.reduce((t, x) => t + x.value, 0);
  return { income: inc, expense: exp, net };
}

/** Elaborazione economica settimanale (ogni lunedì). */
export function weeklyFinance(world: World, club: Club, loanOut?: Map<string, number>) {
  const f = club.finances;
  const e = econ(club);
  const mult = incomeMult(world, club);
  // Entrate ricorrenti.
  income(club, 'sponsor', sponsorIncome(club) / 52);
  income(club, 'contributi', (e.contribution * mult) / 52);
  income(club, 'merchandising', (club.fans * e.merch * commercialFactor(club) * mult) / 52);
  income(club, 'attivita', (baseActivityIncome(club) * mult) / 52);
  // Uscite ricorrenti.
  for (const k of Object.keys(FACILITIES) as (keyof typeof FACILITIES)[]) {
    const v = FACILITIES[k].upkeep(club.facilities[k].level) / 52;
    expense(club, k === 'piscina' ? 'piscina' : k === 'giovanile' ? 'giovanili' : 'manutenzione', v);
  }
  expense(club, 'amministrazione', e.admin / 52);
  expense(club, 'staff', annualStaffCost(world, club) / 52);
  // Rate dei prestiti.
  for (const loan of f.loans) {
    const pay = Math.min(loan.remaining, loan.weeklyPayment);
    loan.remaining -= pay;
    expense(club, 'interessi', pay);
  }
  f.loans = f.loans.filter((l) => l.remaining > 1);
  // Interessi sullo scoperto.
  if (f.balance < 0) expense(club, 'interessi', (-f.balance * 0.1) / 52);
  // Stipendi: pagati se c'è liquidità entro il fido, altrimenti arretrati.
  const wages = annualWages(world, club, loanOut) / 52;
  const limit = overdraftLimit(club);
  if (f.arrears > 0 && f.balance - f.arrears > -limit) {
    expense(club, 'stipendi', f.arrears);
    f.arrears = 0;
  }
  if (f.balance - wages >= -limit) {
    expense(club, 'stipendi', wages);
    f.unpaidWeeks = 0;
  } else {
    f.arrears += Math.round(wages);
    f.unpaidWeeks++;
  }
  f.weeklyBalance.push(Math.round(f.balance));
  if (f.weeklyBalance.length > 60) f.weeklyBalance.shift();
}

/** Spettatori di una partita casalinga. */
export function attendanceFor(world: World, fixture: Fixture): number {
  const home = world.clubs[fixture.homeId];
  const away = world.clubs[fixture.awayId];
  const e = econ(home);
  const cap = poolCapacity(home.facilities.piscina.level);
  const form = home.recent.slice(-5).reduce((t, r) => t + (r === 'W' ? 0.05 : r === 'L' ? -0.04 : 0), 0);
  const derby = home.region === away.region ? 0.2 : 0;
  const hype = 1 + form + derby + fixture.importance * 0.8 + (away.reputation - home.reputation) / 250;
  const refPrice = e.ticket;
  const priceF = Math.pow(refPrice / Math.max(1, home.finances.ticketPrice), 0.6);
  const seed = (fixture.id.charCodeAt(fixture.id.length - 1) % 10) / 50;
  const att = home.fans * e.attendRate * hype * priceF * (0.9 + seed) + home.abbonati * 0.85;
  if (fixture.neutral) return Math.round(clamp((home.fans + away.fans) * 0.1 + 300, 200, 5000));
  return Math.round(clamp(att, 30, cap));
}

/** Incassi e spese del giorno partita. */
export function matchdayFinance(world: World, fixture: Fixture, attendance: number) {
  const home = world.clubs[fixture.homeId];
  const away = world.clubs[fixture.awayId];
  const comp = world.competitions[fixture.compId];
  const continental = comp?.kind === 'continental';
  if (fixture.neutral) {
    const share = attendance * 10 * 0.35;
    income(home, 'biglietti', share);
    income(away, 'biglietti', share);
    for (const c of [home, away]) expense(c, 'trasferte', econ(c).travel * (continental ? 4 : 1.5));
    return;
  }
  const closed = home.poolClosedUntil != null && home.poolClosedUntil >= world.day;
  if (!closed) {
    const paying = Math.max(0, attendance - home.abbonati * 0.85);
    income(home, 'biglietti', paying * home.finances.ticketPrice * incomeMult(world, home) * (continental ? 1.6 : 1));
  }
  const travel = continental ? 5 * econ(away).travel : econ(away).travel;
  expense(away, 'trasferte', travel);
}

/** Campagna abbonamenti (1° settembre). */
export function sellSeasonTickets(world: World, club: Club) {
  const cap = poolCapacity(club.facilities.piscina.level);
  const e = econ(club);
  const priceF = Math.pow((e.ticket * 8) / Math.max(1, club.finances.seasonTicketPrice), 0.8);
  const ambition = club.objective === 'promozione' || club.objective === 'titolo' ? 1.15 : club.objective === 'salvezza' ? 0.9 : 1;
  const rate = clamp(0.07 + club.reputation / 1500, 0.05, 0.16) * priceF * ambition;
  club.abbonati = Math.round(clamp(club.fans * rate, 0, cap * 0.6));
  income(club, 'abbonamenti', club.abbonati * club.finances.seasonTicketPrice * incomeMult(world, club));
}

export function maxLoan(club: Club): number {
  const existing = club.finances.loans.reduce((t, l) => t + l.remaining, 0);
  return Math.max(0, niceMoney(projectRevenueTotal(club) * (0.4 + club.reputation / 200)) - existing);
}

export function loanRate(club: Club): number {
  const stress = club.finances.balance < 0 ? 0.03 : 0;
  return Math.round((0.045 + (100 - club.reputation) / 2500 + stress) * 1000) / 1000;
}

export function takeLoan(world: World, club: Club, amount: number, years: number): string | null {
  if (amount <= 0) return 'Importo non valido.';
  if (amount > maxLoan(club)) return 'La banca non concede un prestito così alto.';
  if (club.finances.unpaidWeeks > 0) return 'Con stipendi arretrati la banca rifiuta il prestito.';
  const rate = loanRate(club);
  const total = amount * (1 + rate * years);
  club.finances.loans.push({
    id: newId(world, 'b'), principal: amount, remaining: Math.round(total), weeklyPayment: Math.round(total / (years * 52)), rate,
    startSeason: world.season,
  });
  income(club, 'altro', amount);
  return null;
}

export function repayLoan(club: Club, loanId: string): string | null {
  const loan = club.finances.loans.find((l) => l.id === loanId);
  if (!loan) return 'Prestito non trovato.';
  // Estinzione anticipata con sconto sugli interessi residui.
  const cost = Math.round(loan.remaining * 0.92);
  if (club.finances.balance < cost) return 'Liquidità insufficiente per estinguere il prestito.';
  expense(club, 'interessi', cost);
  club.finances.loans = club.finances.loans.filter((l) => l !== loan);
  return null;
}

export function presidentInvest(world: World, amount: number): string | null {
  const club = world.clubs[world.userClubId];
  if (amount <= 0) return 'Importo non valido.';
  if (amount > world.presidentWealth) return 'Il tuo patrimonio personale non basta.';
  world.presidentWealth -= amount;
  income(club, 'investimenti', amount);
  return null;
}

export function financialHealth(world: World, club: Club): { label: string; level: 'ok' | 'warn' | 'bad' | 'critical' } {
  const f = club.finances;
  if (f.unpaidWeeks >= 6) return { label: 'Crisi: stipendi non pagati', level: 'critical' };
  if (f.unpaidWeeks > 0) return { label: 'Stipendi in ritardo', level: 'bad' };
  if (f.balance < -overdraftLimit(club) * 0.6) return { label: 'Al limite del fido', level: 'bad' };
  if (f.balance < 0) return { label: 'In rosso', level: 'warn' };
  return { label: 'Conti in ordine', level: 'ok' };
}
