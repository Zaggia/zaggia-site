// Contratti: richieste economiche dei giocatori, disponibilità a trasferirsi, rinnovi e svincoli.

import { expense } from '../economy/ledger';
import { addNews } from '../news';
import type { Club, Player, SquadStatus, World } from '../types';
import { clamp, niceMoney } from '../util';
import { ageOf, expectedWage, refreshValue, yearsLeft } from '../player/value';
import { leagueRules } from '../data/config';

export const STATUS_LABELS: Record<SquadStatus, string> = {
  fondamentale: 'Fondamentale',
  titolare: 'Titolare',
  rotazione: 'Rotazione',
  riserva: 'Riserva',
  giovane: 'Giovane promessa',
};

const STATUS_WAGE: Record<SquadStatus, number> = { fondamentale: 1.15, titolare: 1.05, rotazione: 1, riserva: 0.9, giovane: 0.85 };

export function tierOf(world: World, club: Club | null): number {
  if (!club) return 5;
  if (club.country !== 'ITA') return club.reputation >= 70 ? 1 : 2;
  return world.rules.leagues.find((l) => l.key === club.division)?.tier ?? 5;
}

/** Livello massimo "credibile" per un campionato: oltre, i giocatori non vogliono scendere di categoria. */
export function divisionCeiling(world: World, club: Club): number {
  if (club.country !== 'ITA') return 99;
  try {
    return leagueRules(world.rules, club.division).strength[1] + 10;
  } catch {
    return 99;
  }
}

export interface Interest {
  value: number;
  reason: string;
}

/** Categoria "naturale" per il livello di un giocatore (1 = A1 … 4 = C). */
export function levelTier(world: World, overall: number): number {
  const sorted = [...world.rules.leagues].sort((a, b) => a.tier - b.tier);
  for (const l of sorted) if (overall >= (l.strength[0] + l.strength[1]) / 2 - 3) return l.tier;
  return sorted[sorted.length - 1]?.tier ?? 4;
}

/** Quanto un giocatore è disposto a trasferirsi in un club (0-100). */
export function interestIn(world: World, p: Player, club: Club): Interest {
  const cur = p.clubId ? world.clubs[p.clubId] : null;
  const age = ageOf(p, world.season);
  let v = 60;
  let reason = 'È disposto ad ascoltare la proposta.';
  const repGap = club.reputation - (cur?.reputation ?? Math.max(5, p.reputation - 10));
  v += repGap * 0.5;
  const tierGap = tierOf(world, club) - tierOf(world, cur);
  if (cur && tierGap > 0) { v -= tierGap * 18; reason = 'Non vuole scendere di categoria.'; }
  if (tierGap < 0) v += -tierGap * 10;
  const ceiling = divisionCeiling(world, club);
  if (p.overall > ceiling && age < 33) { v -= (p.overall - ceiling) * 3; reason = 'Ritiene il campionato troppo basso per il suo livello.'; }
  // Un giocatore da categoria superiore scende solo malvolentieri (anche da svincolato).
  const natural = levelTier(world, p.overall);
  const down = tierOf(world, club) - natural;
  if (down > 0 && age < 32) { v -= down * 14; if (v < 45) reason = 'Si considera un giocatore da categoria superiore.'; }
  if (!cur) v += 15;
  if (p.wantsToLeave) v += 15;
  if (cur && p.personality.lealta >= 15 && !p.wantsToLeave) v -= 10;
  if (p.nationality === 'ITA' && club.country === 'ITA') v += 4;
  if (age >= 33) v += 10;
  if (p.personality.ambizione >= 15 && repGap < 0) v -= 10;
  if (p.negotiationBlockedUntil != null && p.negotiationBlockedUntil > world.day) { v = 0; reason = 'Ha interrotto le trattative con te.'; }
  v = clamp(Math.round(v), 0, 100);
  if (v >= 70) reason = 'È entusiasta dell’interesse del club.';
  else if (v >= 45 && reason === 'È disposto ad ascoltare la proposta.') reason = 'Valuterà la proposta con attenzione.';
  return { value: v, reason };
}

/** Stipendio annuo richiesto. */
export function wageDemand(world: World, p: Player, club: Club, status: SquadStatus, years: number): number {
  let w = expectedWage(p, world.season);
  const cur = p.clubId ? world.clubs[p.clubId] : null;
  const renewal = cur?.id === club.id;
  const age = ageOf(p, world.season);
  if (renewal && p.contract) {
    // Chi è contento accetta di restare alle stesse cifre; i veterani accettano un taglio.
    const floor = age >= 30 ? p.contract.wage * 0.8 : p.contract.wage * (p.morale > 60 ? 0.95 : 1.05);
    w = Math.max(w, floor);
  }
  w *= STATUS_WAGE[status];
  // Scendere di categoria costa: chi è da categoria superiore chiede di più.
  const down = tierOf(world, club) - levelTier(world, p.overall);
  if (down > 0 && !renewal) w *= 1 + down * 0.35;
  w *= 1 + Math.max(0, p.reputation - club.reputation) / 150;
  w *= 1 + (p.personality.ambizione - 10) / 100;
  if (!renewal && cur) w *= 1.05;
  // Gli svincolati abbassano le pretese con il passare dei mesi.
  if (!cur) w *= world.day > 75 && world.day < 300 ? 0.72 : 0.9;
  // I giovani accettano contratti lunghi, i veterani li chiedono.
  if (age >= 30) w *= years >= 2 ? 0.95 : 1.08;
  else if (age <= 23) w *= years >= 4 ? 1.06 : 1;
  const ds = club.staff.ds ? world.staff[club.staff.ds]?.rating ?? 0 : 0;
  w *= 1 - ds / 1000;
  if (p.wantsToLeave && renewal) w *= 1.3;
  return Math.max(500, niceMoney(w));
}

export interface ContractOffer {
  wage: number;
  years: number;
  status: SquadStatus;
}

export interface NegotiationResult {
  result: 'accept' | 'counter' | 'reject';
  demand?: { wage: number; years: number };
  message: string;
}

export function negotiate(world: World, p: Player, club: Club, offer: ContractOffer): NegotiationResult {
  const interest = interestIn(world, p, club);
  const renewal = p.clubId === club.id;
  if (!renewal && interest.value < 30) return { result: 'reject', message: interest.reason };
  if (renewal && p.wantsToLeave && p.morale < 25) return { result: 'reject', message: 'Ha deciso di cambiare aria e non vuole rinnovare.' };
  const neg = (world.negotiations[p.id] ||= { playerId: p.id, rounds: 0 });
  neg.rounds++;
  const demand = wageDemand(world, p, club, offer.status, offer.years);
  const age = ageOf(p, world.season);
  const prefYears = age >= 31 ? 2 : age <= 23 ? 3 : 3;
  const yearsOk = age >= 31 ? offer.years >= 1 : true;
  const tolerance = 0.97 - (interest.value - 50) / 500;
  if (offer.wage >= demand * tolerance && yearsOk) {
    delete world.negotiations[p.id];
    return { result: 'accept', message: `${p.firstName} ${p.lastName} accetta l’offerta.` };
  }
  if (neg.rounds >= 4) {
    delete world.negotiations[p.id];
    p.negotiationBlockedUntil = world.day + 30;
    return { result: 'reject', message: 'Le parti sono troppo lontane: il giocatore interrompe la trattativa per un mese.' };
  }
  if (offer.wage >= demand * 0.7) {
    const counter = niceMoney(demand * (1 + (neg.rounds - 1) * 0.02));
    neg.lastDemand = { wage: counter, years: Math.max(offer.years, prefYears) };
    return { result: 'counter', demand: neg.lastDemand, message: `Chiede ${counter.toLocaleString('it-IT')} € l’anno per ${neg.lastDemand.years} stagioni.` };
  }
  return { result: 'reject', message: 'L’offerta è lontanissima dalle sue richieste.' };
}

export function signContract(world: World, p: Player, club: Club, offer: ContractOffer) {
  p.contract = { wage: offer.wage, endSeason: world.season + offer.years - (world.day > 300 ? 0 : 1), status: offer.status };
  p.wantsToLeave = false;
  p.unhappyWeeks = 0;
  p.morale = clamp(p.morale + 10, 0, 100);
  delete world.negotiations[p.id];
  refreshValue(p, world.season);
  void club;
}

/** Svincolo: si paga una buonuscita pari a metà dell'ingaggio residuo. */
export function releaseCost(world: World, p: Player): number {
  if (!p.contract) return 0;
  return niceMoney(p.contract.wage * yearsLeft(p, world.season) * 0.5);
}

export function releasePlayer(world: World, p: Player, reason = 'svincolato') {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  if (!club) return;
  const cost = releaseCost(world, p);
  if (cost) expense(club, 'stipendi', cost);
  removeFromClub(world, p);
  p.contract = null;
  p.clubId = null;
  p.transferListed = false;
  p.loanListed = false;
  p.youth = false;
  if (club.isUser) addNews(world, `${p.firstName} ${p.lastName} ${reason}`, `Il giocatore lascia ${club.name}.`, 'mercato');
}

export function removeFromClub(world: World, p: Player) {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  if (!club) return;
  club.playerIds = club.playerIds.filter((id) => id !== p.id);
  club.youthIds = club.youthIds.filter((id) => id !== p.id);
  const l = club.lineup;
  l.slots = l.slots.map((id) => (id === p.id ? null : id));
  l.bench = l.bench.filter((id) => id !== p.id);
  l.penaltyTakers = l.penaltyTakers.filter((id) => id !== p.id);
  if (l.captainId === p.id) l.captainId = null;
  club.tactics.manUp.shooters = club.tactics.manUp.shooters.filter((id) => id !== p.id);
  for (const s of club.savedLineups) {
    s.lineup.slots = s.lineup.slots.map((id) => (id === p.id ? null : id));
    s.lineup.bench = s.lineup.bench.filter((id) => id !== p.id);
  }
}

export function defaultYears(p: Player, season: number): number {
  const age = ageOf(p, season);
  return age <= 23 ? 3 : age <= 29 ? 2 : 1;
}

export function suggestedStatus(world: World, p: Player, club: Club): SquadStatus {
  const squad = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const rank = squad.filter((x) => x.overall > p.overall).length;
  if (ageOf(p, world.season) <= 21 && rank >= 6) return 'giovane';
  return rank < 2 ? 'fondamentale' : rank < 7 ? 'titolare' : rank < 12 ? 'rotazione' : 'riserva';
}
