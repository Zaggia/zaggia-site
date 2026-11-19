// Mercato: finestre, valutazioni, offerte dell'utente e dei club AI, prestiti, trasferimenti.

import { rosterFullError, trimRoster } from '../club/roster';
import { inRange } from '../calendar';
import { expense, income } from '../economy/ledger';
import { addMessage, addNews, fmtMoney } from '../news';
import type { Club, Negotiation, Player, TransferOffer, World } from '../types';
import { clamp, niceMoney } from '../util';
import { ageOf, refreshValue, yearsLeft } from '../player/value';
import { assignNumbers } from '../club/generate';
import { newId } from '../world/context';
import { interestIn, removeFromClub, signContract, suggestedStatus, wageDemand, defaultYears, type ContractOffer } from './contracts';
import { fullName } from '../player/generate';
import { divisionOf } from '../world/queries';

export function transferWindowOpen(world: World): { open: boolean; name?: string; endsDay?: number } {
  for (const w of world.rules.windows) {
    if (inRange(world.season, world.day, w.start, w.end)) {
      return { open: true, name: w.name };
    }
  }
  return { open: false };
}

/** Importanza del giocatore per la squadra (1 = marginale, fino a 1.7 = insostituibile). */
export function importanceInSquad(world: World, p: Player): number {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  if (!club) return 1;
  const squad = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const rank = squad.findIndex((x) => x.id === p.id);
  const sameRole = squad.filter((x) => x.role === p.role).length;
  let imp = rank < 3 ? 1.6 : rank < 7 ? 1.3 : rank < 12 ? 1.1 : 1;
  if (sameRole <= 1) imp += 0.25;
  return imp;
}

/** Prezzo richiesto dal club proprietario. */
export function askingPrice(world: World, p: Player): number {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  if (!club) return 0;
  let v = p.value * importanceInSquad(world, p);
  const yl = yearsLeft(p, world.season);
  if (yl >= 3) v *= 1.15;
  if (yl <= 1) v *= 0.75;
  if (club.finances.balance < 0) v *= 0.85;
  if (p.transferListed) v *= 0.8;
  if (p.wantsToLeave) v *= 0.9;
  if (p.youth) v *= 1.2;
  return niceMoney(Math.max(1000, v));
}

export interface BidResponse {
  result: 'accept' | 'counter' | 'reject';
  counterFee?: number;
  message: string;
}

export interface BidTerms {
  /** Prima richiesta del club (quella mostrata). */
  ask: number;
  /** Minimo a cui alla fine cederebbe. */
  reserve: number;
  /** Giri di trattativa prima che il club si stufi. */
  patience: number;
}

/** Condizioni del club venditore: parte dalla richiesta e, giro dopo giro, scende verso il suo minimo. */
export function bidTerms(world: World, p: Player, buyer: Club): BidTerms {
  const seller = p.clubId ? world.clubs[p.clubId] : null;
  const ask = askingPrice(world, p);
  const ds = buyer.staff.ds ? world.staff[buyer.staff.ds]?.rating ?? 0 : 0;
  const imp = importanceInSquad(world, p);
  let low = 0.8;
  if (seller && seller.finances.balance < 0) low -= 0.07;
  if (p.transferListed || p.wantsToLeave) low -= 0.06;
  if (ds > 0) low -= ds / 1500;
  let reserve = ask * low;
  // I giocatori insostituibili si cedono solo a cifre molto alte.
  if (imp >= 1.6 && !p.wantsToLeave) reserve = ask * 1.25;
  const patience = seller && seller.finances.balance < 0 ? 5 : imp >= 1.6 ? 3 : 4;
  return { ask, reserve: niceMoney(reserve), patience };
}

function bidDemand(t: BidTerms, round: number): number {
  const f = Math.min(1, Math.pow(round / t.patience, 0.85));
  return Math.max(t.reserve, niceMoney(t.ask - (t.ask - t.reserve) * f));
}

/**
 * Giro di trattativa dell'utente con il club venditore: la richiesta scende a ogni giro verso il minimo,
 * ma offerte troppo basse irritano il club e possono chiudere la trattativa.
 */
export function bidRound(world: World, p: Player, fee: number, buyer: Club): BidResponse & { roundsLeft?: number } {
  const seller = p.clubId ? world.clubs[p.clubId] : null;
  if (!seller) return { result: 'accept', message: 'Il giocatore è svincolato.' };
  if (seller.playerIds.length <= 14) return { result: 'reject', message: `${seller.name} ha la rosa troppo corta per cedere giocatori.` };
  const key = `bid:${p.id}`;
  let neg: Negotiation | undefined = world.negotiations[key];
  if (neg && neg.day != null && world.day - neg.day > 10) neg = undefined;
  if (neg?.irritation != null && neg.irritation >= 99) {
    return { result: 'reject', message: `${seller.name} non vuole più trattare per ora.` };
  }
  if (!neg) {
    neg = { playerId: p.id, rounds: 0, irritation: 0, day: world.day };
    world.negotiations[key] = neg;
  }
  neg.rounds++;
  neg.day = world.day;
  const t = bidTerms(world, p, buyer);
  const now = bidDemand(t, neg.rounds);
  const roundsLeft = Math.max(0, t.patience - neg.rounds);
  const stop = (message: string) => {
    neg!.irritation = 99;
    neg!.day = world.day + 5;
    return { result: 'reject' as const, message, roundsLeft: 0 };
  };
  if (fee >= now || (neg.rounds >= t.patience && fee >= t.reserve)) {
    delete world.negotiations[key];
    return { result: 'accept', message: `${seller.name} accetta l’offerta.`, roundsLeft };
  }
  if (fee < t.reserve * 0.7) {
    neg.irritation = (neg.irritation ?? 0) + 2;
    if (neg.irritation >= 3 || roundsLeft === 0) return stop(`${seller.name} considera l’offerta irrispettosa e chiude la trattativa.`);
    return { result: 'reject', message: `${seller.name} rifiuta: l’offerta è troppo bassa e il club si irrita. Un’altra così e si alza dal tavolo.`, roundsLeft };
  }
  if ((now - fee) / now > 0.12) neg.irritation = (neg.irritation ?? 0) + 1;
  if (roundsLeft === 0 || (neg.irritation ?? 0) >= 3) return stop(`${seller.name} ritiene le parti troppo distanti e chiude la trattativa.`);
  neg.lastFee = now;
  const gap = (now - fee) / now;
  const tone = gap < 0.04 ? 'Siamo vicinissimi' : gap < 0.12 ? 'Ci siamo quasi' : 'Siamo ancora distanti';
  const imp = importanceInSquad(world, p);
  const extra = imp >= 1.6 && !p.wantsToLeave ? ' È un giocatore su cui il club non vuole rinunciare.' : '';
  return {
    result: 'counter', counterFee: now, roundsLeft,
    message: `${tone}: ${seller.name} chiede ${fmtMoney(now)}.${extra}${roundsLeft <= 1 ? ' Il club non ha molta pazienza.' : ''}`,
  };
}

/** Risposta di un club AI a un'offerta per un suo giocatore. */
export function evaluateBid(world: World, p: Player, fee: number, buyer: Club, loan = false): BidResponse {
  const seller = p.clubId ? world.clubs[p.clubId] : null;
  if (!seller) return { result: 'accept', message: 'Il giocatore è svincolato.' };
  const squadSize = seller.playerIds.length;
  const imp = importanceInSquad(world, p);
  if (loan) {
    const age = ageOf(p, world.season);
    if (imp > 1.1 || age > 23) return { result: 'reject', message: `${seller.name} non vuole cedere in prestito il giocatore.` };
    return { result: 'accept', message: `${seller.name} accetta il prestito.` };
  }
  if (squadSize <= 14) return { result: 'reject', message: `${seller.name} ha la rosa troppo corta per cedere giocatori.` };
  const ask = askingPrice(world, p);
  const ds = buyer.staff.ds ? world.staff[buyer.staff.ds]?.rating ?? 0 : 0;
  const effAsk = ask * (1 - ds / 900);
  if (imp >= 1.6 && fee < effAsk * 1.3 && !p.wantsToLeave) {
    return { result: 'counter', counterFee: niceMoney(effAsk * 1.35), message: `${seller.name} considera il giocatore incedibile: servirebbe un’offerta irrinunciabile.` };
  }
  if (fee >= effAsk) return { result: 'accept', message: `${seller.name} accetta l’offerta.` };
  if (fee >= effAsk * 0.7) return { result: 'counter', counterFee: niceMoney(effAsk), message: `${seller.name} chiede ${fmtMoney(niceMoney(effAsk))}.` };
  return { result: 'reject', message: `${seller.name} rifiuta: l’offerta è troppo bassa.` };
}

/** Esegue il trasferimento (o il prestito) e aggiorna rose, bilanci e notizie. */
export function completeTransfer(
  world: World, p: Player, to: Club, fee: number, contract: ContractOffer | null, loan?: { wageShare: number; untilSeason: number },
) {
  const from = p.clubId ? world.clubs[p.clubId] : null;
  if (fee > 0) {
    expense(to, 'acquisti', fee);
    if (from) income(from, 'cessioni', fee);
  }
  removeFromClub(world, p);
  if (loan && from) {
    p.loan = { fromClubId: from.id, untilSeason: loan.untilSeason, wageShare: loan.wageShare };
  } else {
    p.loan = undefined;
    if (contract) signContract(world, p, to, contract);
  }
  p.clubId = to.id;
  p.youth = false;
  p.transferListed = false;
  p.loanListed = false;
  p.wantsToLeave = false;
  p.joinedSeason = world.season;
  p.playingTime = 0.5;
  p.morale = clamp(p.morale + 8, 0, 100);
  to.playerIds.push(p.id);
  to.chemistry = clamp(to.chemistry - 3, 0, 100);
  // Le società AI restano sempre a quota regolamentare: chi arriva prende il posto del meno utile.
  if (!to.isUser) trimRoster(world, to, p.id);
  assignNumbers(to.playerIds.map((id) => world.players[id]));
  refreshValue(p, world.season);
  world.offers = world.offers.filter((o) => !(o.playerId === p.id && o.status === 'pending'));
  world.shortlist = world.shortlist.filter((id) => id !== p.id || to.id !== world.userClubId);
  world.transfers.unshift({
    season: world.season, day: world.day, playerId: p.id, playerName: fullName(p), fromId: from?.id ?? null, toId: to.id,
    fromName: from?.name ?? 'Svincolato', toName: to.name, fee, loan: !!loan, overall: p.overall,
  });
  if (world.transfers.length > 400) world.transfers.length = 400;
  const notable = p.overall >= 70 || fee >= 100_000 || to.isUser || from?.isUser;
  if (notable) {
    const what = loan ? 'in prestito' : fee > 0 ? `per ${fmtMoney(fee)}` : 'a parametro zero';
    addNews(world, `${fullName(p)} passa a ${to.name}`, `${from ? `Da ${from.name}` : 'Da svincolato'} ${what}. Overall ${p.overall}, ${ageOf(p, world.season)} anni.`, 'mercato');
  }
}

/** Offerta dell'utente per un giocatore di un altro club (risposta immediata del club). */
export function userBid(world: World, playerId: string, fee: number, loan: boolean): { offer: TransferOffer; response: BidResponse } | { error: string } {
  const p = world.players[playerId];
  const user = world.clubs[world.userClubId];
  if (!p) return { error: 'Giocatore non trovato.' };
  if (p.clubId === user.id) return { error: 'Il giocatore è già tuo.' };
  if (!transferWindowOpen(world).open && p.clubId) return { error: 'Il mercato è chiuso: puoi ingaggiare solo svincolati.' };
  // La rosa piena non blocca l'offerta: il posto si libera al momento della firma.
  if (!loan && fee > user.finances.balance + 5000) return { error: 'Non hai abbastanza liquidità per questa offerta.' };
  const interest = interestIn(world, p, user);
  if (interest.value < 25) return { error: `${fullName(p)} non è interessato: ${interest.reason}` };
  const resp = loan ? evaluateBid(world, p, fee, user, true) : bidRound(world, p, fee, user);
  const offer: TransferOffer = {
    id: newId(world, 'o'), playerId, fromClubId: user.id, toClubId: p.clubId ?? '', fee, loan, day: world.day,
    expiresDay: world.day + 7, status: resp.result === 'accept' ? 'accepted' : resp.result === 'counter' ? 'countered' : 'rejected',
    counterFee: resp.counterFee, byUser: true, note: resp.message, wageShare: loan ? 0.7 : undefined,
  };
  world.offers = world.offers.filter((o) => !(o.byUser && o.playerId === playerId));
  world.offers.unshift(offer);
  return { offer, response: resp };
}

/** Dopo l'accordo con il club, l'utente firma il contratto con il giocatore. */
export function finalizeUserSigning(world: World, offerId: string, contract: ContractOffer): string | null {
  const offer = world.offers.find((o) => o.id === offerId);
  const user = world.clubs[world.userClubId];
  if (!offer || offer.status !== 'accepted') return 'Accordo con il club non trovato o scaduto.';
  const p = world.players[offer.playerId];
  if (!p) return 'Giocatore non trovato.';
  if (offer.fee > user.finances.balance + 5000) return 'Liquidità insufficiente per pagare il cartellino.';
  const full = rosterFullError(world, user);
  if (full) return full;
  if (offer.loan) {
    completeTransfer(world, p, user, 0, null, { wageShare: offer.wageShare ?? 0.7, untilSeason: world.season });
  } else {
    completeTransfer(world, p, user, offer.fee, contract);
  }
  offer.status = 'withdrawn';
  world.offers = world.offers.filter((o) => o.id !== offerId);
  return null;
}

export function signFreeAgent(world: World, p: Player, club: Club, contract: ContractOffer): string | null {
  if (club.isUser) {
    const full = rosterFullError(world, club);
    if (full) return full;
  }
  completeTransfer(world, p, club, 0, contract);
  return null;
}

/** Offerte dei club AI per i giocatori dell'utente. */
export function respondToIncoming(world: World, offerId: string, action: 'accept' | 'reject' | 'counter', counterFee?: number): string {
  const offer = world.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pending') return 'Offerta non più valida.';
  const p = world.players[offer.playerId];
  const buyer = world.clubs[offer.toClubId];
  if (!p || !buyer || p.clubId !== world.userClubId) {
    offer.status = 'expired';
    return 'Offerta non più valida.';
  }
  if (action === 'reject') {
    offer.status = 'rejected';
    if (p.wantsToLeave) p.morale = clamp(p.morale - 10, 0, 100);
    return 'Offerta rifiutata.';
  }
  if (action === 'counter') {
    const max = niceMoney(Math.max(offer.fee * 1.25, p.value * 1.3));
    if (!counterFee || counterFee <= offer.fee) return 'La controproposta deve essere superiore all’offerta.';
    if (counterFee <= max && counterFee <= buyer.finances.balance + buyer.finances.transferBudget) {
      offer.fee = counterFee;
      action = 'accept';
    } else {
      offer.status = 'rejected';
      return `${buyer.name} ritiene eccessiva la richiesta e si ritira.`;
    }
  }
  // Accettazione: il giocatore deve essere d'accordo.
  const interest = interestIn(world, p, buyer);
  if (interest.value < 30 && !offer.loan) {
    offer.status = 'rejected';
    return `${fullName(p)} rifiuta il trasferimento: ${interest.reason}`;
  }
  const status = suggestedStatus(world, p, buyer);
  const years = defaultYears(p, world.season);
  const contract = { wage: wageDemand(world, p, buyer, status, years), years, status };
  offer.status = 'accepted';
  if (offer.loan) completeTransfer(world, p, buyer, 0, null, { wageShare: offer.wageShare ?? 0.8, untilSeason: world.season });
  else completeTransfer(world, p, buyer, offer.fee, contract);
  return offer.loan ? `${fullName(p)} va in prestito a ${buyer.name}.` : `${fullName(p)} ceduto a ${buyer.name} per ${fmtMoney(offer.fee)}.`;
}

export function expireOffers(world: World) {
  for (const o of world.offers) {
    if ((o.status === 'pending' || o.status === 'accepted' || o.status === 'countered') && o.expiresDay < world.day) {
      o.status = 'expired';
    }
  }
  world.offers = world.offers.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'countered' || o.day > world.day - 30);
  if (world.offers.length > 200) world.offers.length = 200;
}

/** Il club AI propone un'offerta per un giocatore dell'utente. */
export function createIncomingOffer(world: World, p: Player, buyer: Club, fee: number, loan = false) {
  if (world.offers.some((o) => o.playerId === p.id && o.toClubId === buyer.id && o.status === 'pending')) return;
  const offer: TransferOffer = {
    id: newId(world, 'o'), playerId: p.id, fromClubId: world.userClubId, toClubId: buyer.id, fee: niceMoney(fee), loan,
    day: world.day, expiresDay: world.day + 6, status: 'pending', byUser: false, wageShare: loan ? 0.8 : undefined,
  };
  world.offers.unshift(offer);
  const div = divisionOf(world, buyer);
  addMessage(
    world, 'mercato',
    loan ? `Richiesta di prestito per ${fullName(p)}` : `Offerta per ${fullName(p)}`,
    loan
      ? `${buyer.name} (${div}) chiede ${fullName(p)} in prestito fino a fine stagione, pagando l’80% dell’ingaggio.`
      : `${buyer.name} (${div}) offre ${fmtMoney(offer.fee)} per ${fullName(p)} (overall ${p.overall}, valore ${fmtMoney(p.value)}).`,
    { offerId: offer.id, important: true, link: { view: 'mercato' } },
  );
}
