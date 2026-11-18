// Contratti: richieste economiche dei giocatori, disponibilità a trasferirsi, rinnovi e svincoli.

import { expense } from '../economy/ledger';
import { addNews } from '../news';
import type { Club, Negotiation, Player, SquadStatus, World } from '../types';
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
    // Il nuovo ingaggio segue il valore attuale del giocatore, non quello vecchio: chi è migliorato chiede di più,
    // chi è calato o invecchiato accetta di meno. Chi è contento resta volentieri, chi è scontento alza le pretese.
    const mood = p.wantsToLeave ? 1.3 : p.morale > 65 ? 0.94 : p.morale < 40 ? 1.08 : 1;
    const loyal = 1 - Math.max(0, p.personality.lealta - 10) * 0.008;
    w *= mood * loyal;
    // Chi è pagato più del suo valore non scende subito al valore giusto: si ancora in parte al vecchio stipendio.
    const cur = p.contract.wage;
    if (cur > w) w += (cur - w) * (age >= 31 ? 0.12 : 0.3);
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
  /** Giri di trattativa ancora disponibili prima che il giocatore si stufi. */
  roundsLeft?: number;
  /** Quanto sono vicine le parti. */
  mood?: 'offeso' | 'distante' | 'vicino' | 'quasi';
}

export interface ContractTerms {
  /** Ingaggio "giusto" (quello che chiederebbe senza trattare). */
  fair: number;
  /** Prima richiesta. */
  ask: number;
  /** Minimo che alla fine accetterebbe. */
  reserve: number;
  /** Quanti giri di trattativa è disposto a fare. */
  patience: number;
}

/** Condizioni di trattativa di un giocatore: parte da una richiesta alta e, giro dopo giro, scende verso il suo minimo. */
export function contractTerms(world: World, p: Player, club: Club, offer: ContractOffer): ContractTerms {
  const interest = interestIn(world, p, club);
  const renewal = p.clubId === club.id;
  const pers = p.personality;
  const fair = wageDemand(world, p, club, offer.status, offer.years);
  const greed = clamp(0.07 + (pers.ambizione - 10) * 0.008 + (renewal && p.morale < 45 ? 0.05 : 0) + (interest.value < 50 ? 0.04 : 0), 0.04, 0.26);
  const slack = clamp(0.1 + (interest.value - 50) / 600 + (renewal ? (pers.lealta - 10) * 0.004 : 0), 0.04, 0.2);
  const patience = clamp(3 + (pers.professionalita >= 14 ? 1 : 0) + (interest.value >= 70 ? 1 : 0) - (pers.temperamento >= 15 ? 1 : 0), 2, 5);
  return { fair, ask: niceMoney(fair * (1 + greed)), reserve: niceMoney(fair * (1 - slack)), patience };
}

/** Quanto chiede in un dato giro: scende dalla prima richiesta al minimo. */
function demandAtRound(t: ContractTerms, round: number, bias: number): number {
  const f = Math.min(1, Math.pow(round / t.patience, 0.85));
  return Math.max(t.reserve, niceMoney((t.ask - (t.ask - t.reserve) * f) * (1 + bias)));
}

export function negotiate(world: World, p: Player, club: Club, offer: ContractOffer): NegotiationResult {
  const interest = interestIn(world, p, club);
  const renewal = p.clubId === club.id;
  if (!renewal && interest.value < 30) return { result: 'reject', message: interest.reason };
  if (renewal && p.wantsToLeave && p.morale < 25) return { result: 'reject', message: 'Ha deciso di cambiare aria e non vuole rinnovare.' };
  // Una trattativa ferma da settimane riparte da zero.
  let neg: Negotiation | undefined = world.negotiations[p.id];
  if (neg && neg.day != null && world.day - neg.day > 14) neg = undefined;
  if (!neg) {
    neg = { playerId: p.id, rounds: 0, irritation: 0, bias: (((p.id.length * 7 + world.day) % 9) - 4) / 200, day: world.day };
    world.negotiations[p.id] = neg;
  }
  neg.rounds++;
  neg.day = world.day;
  const t = contractTerms(world, p, club, offer);
  const bias = neg.bias ?? 0;
  const now = demandAtRound(t, neg.rounds, bias);
  const age = ageOf(p, world.season);
  const prefYears = age >= 31 ? 2 : 3;
  const roundsLeft = Math.max(0, t.patience - neg.rounds);
  const name = `${p.firstName} ${p.lastName}`;
  const end = (days: number, message: string): NegotiationResult => {
    delete world.negotiations[p.id];
    p.negotiationBlockedUntil = world.day + days;
    return { result: 'reject', message, roundsLeft: 0 };
  };
  // Accordo: l'offerta raggiunge quello che chiede in questo giro (o il suo minimo all'ultimo giro).
  if (offer.wage >= now || (neg.rounds >= t.patience && offer.wage >= t.reserve && (neg.irritation ?? 0) < 3)) {
    delete world.negotiations[p.id];
    return { result: 'accept', message: `${name} accetta l’offerta: accordo trovato.` };
  }
  // Offerta offensiva: lo irrita e può far saltare tutto.
  if (offer.wage < t.reserve * 0.82) {
    neg.irritation = (neg.irritation ?? 0) + 2;
    if ((neg.irritation ?? 0) >= 3 || roundsLeft === 0) return end(21, `${name} si sente preso in giro e interrompe la trattativa per tre settimane.`);
    return {
      result: 'reject', roundsLeft, mood: 'offeso',
      message: 'L’offerta è lontanissima dal suo valore: è offeso. Un’altra così e se ne va.',
      demand: { wage: now, years: Math.max(offer.years, prefYears) },
    };
  }
  const gap = (now - offer.wage) / now;
  if (gap > 0.08) neg.irritation = (neg.irritation ?? 0) + 1;
  if (roundsLeft === 0 || (neg.irritation ?? 0) >= 3) {
    return end(30, `Le parti sono rimaste troppo distanti: ${name} interrompe la trattativa per un mese.`);
  }
  neg.lastDemand = { wage: now, years: Math.max(offer.years, prefYears) };
  const mood = gap < 0.03 ? 'quasi' : gap < 0.08 ? 'vicino' : 'distante';
  const tone = mood === 'quasi' ? 'Siamo vicinissimi' : mood === 'vicino' ? 'Ci siamo quasi' : 'Siamo ancora distanti';
  return {
    result: 'counter', demand: neg.lastDemand, roundsLeft, mood,
    message: `${tone}: chiede ${now.toLocaleString('it-IT')} € l’anno per ${neg.lastDemand.years} stagioni.${roundsLeft <= 1 ? ' Non ha molta pazienza: questa è quasi l’ultima occasione.' : ''}`,
  };
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
