// "Da fare adesso": le prossime azioni utili per il presidente, in ordine di urgenza.
// Serve a rendere il gioco più intuitivo senza togliere profondità: suggerisce, non decide.

import type { World } from '../types';
import { rosterIssue } from './roster';
import { validateLineup } from './lineup';
import { canUpgrade } from './manage';
import { FACILITIES, FACILITY_KEYS, upgradeCost } from './facilities';
import { freeSlots } from '../economy/sponsors';
import { transferWindowOpen } from '../transfer/market';
import { dayOf } from '../calendar';
import { fmtMoney } from '../news';

export type TodoTone = 'urgent' | 'normal' | 'tip';

export interface TodoItem {
  id: string;
  title: string;
  detail: string;
  view: string;
  param?: string;
  tone: TodoTone;
}

export function todoList(world: World): TodoItem[] {
  const club = world.clubs[world.userClubId];
  const out: TodoItem[] = [];
  const players = club.playerIds.map((id) => world.players[id]).filter(Boolean);

  const decisions = world.events.filter((e) => !e.resolved);
  if (decisions.length) {
    out.push({ id: 'decisioni', title: decisions.length === 1 ? 'Una decisione ti aspetta' : `${decisions.length} decisioni ti aspettano`, detail: decisions[0].title, view: 'posta', param: 'decisioni', tone: 'urgent' });
  }
  const roster = rosterIssue(world, club);
  if (roster) out.push({ id: 'rosa', title: `Rosa a ${roster.count}/${roster.limit}`, detail: roster.kind === 'under' ? 'Servono 15 tesserati prima della prossima gara ufficiale.' : 'Hai più giocatori del limite: cedi o svincola qualcuno.', view: 'rosa', tone: 'urgent' });

  const lineupErrors = validateLineup(world, club, club.lineup).filter((i) => i.level === 'error');
  if (lineupErrors.length) out.push({ id: 'formazione', title: 'Formazione da sistemare', detail: lineupErrors[0].text, view: 'formazione', tone: 'urgent' });

  const incoming = world.offers.filter((o) => !o.byUser && o.status === 'pending' && o.fromClubId === club.id);
  if (incoming.length) out.push({ id: 'offerte', title: incoming.length === 1 ? 'Un’offerta per un tuo giocatore' : `${incoming.length} offerte per i tuoi giocatori`, detail: 'Accetta, rifiuta o rilancia prima che scadano.', view: 'mercato', tone: 'urgent' });

  if (!club.coachId) out.push({ id: 'allenatore', title: 'Manca l’allenatore', detail: 'Senza tecnico la squadra non impara le tattiche e rende meno.', view: 'staff', tone: 'urgent' });

  const slots = freeSlots(club);
  if (slots.length && world.sponsorOffers.length) out.push({ id: 'sponsor', title: 'Spazi sponsor liberi', detail: `${world.sponsorOffers.length} offerte disponibili: sono entrate garantite.`, view: 'sponsor', tone: 'normal' });

  const expiring = players.filter((p) => p.contract && p.contract.endSeason <= world.season && !p.youth);
  if (expiring.length && world.day > 120) out.push({ id: 'contratti', title: `${expiring.length} contratt${expiring.length === 1 ? 'o' : 'i'} in scadenza`, detail: `A fine stagione partono a zero: ${expiring.slice(0, 3).map((p) => p.lastName).join(', ')}${expiring.length > 3 ? '…' : ''}.`, view: 'rosa', tone: 'normal' });

  const unhappy = players.filter((p) => p.wantsToLeave || p.morale < 30);
  if (unhappy.length) out.push({ id: 'morale', title: unhappy.length === 1 ? `${unhappy[0].lastName} è scontento` : `${unhappy.length} giocatori scontenti`, detail: 'Parlaci dalla sua scheda: minutaggio, rinnovo o cessione.', view: 'player', param: unhappy[0].id, tone: 'normal' });

  if (world.day < dayOf(world.season, '09-01')) out.push({ id: 'biglietti', title: 'Prezzi di biglietti e abbonamenti', detail: 'La campagna abbonamenti chiude il 1° settembre: controlla i prezzi.', view: 'finanze', tone: 'tip' });

  const win = transferWindowOpen(world);
  if (win.open && world.day < 90) out.push({ id: 'mercato', title: `${win.name} aperto`, detail: 'Cerca rinforzi nei ruoli scoperti: ogni acquisto deve liberare un posto in rosa.', view: 'mercato', tone: 'tip' });

  const affordable = FACILITY_KEYS.filter((k) => !canUpgrade(world, club, k) && upgradeCost(club, k) * 2 < club.finances.balance);
  if (affordable.length) out.push({ id: 'strutture', title: 'Puoi migliorare una struttura', detail: `${FACILITIES[affordable[0]].name}: ${fmtMoney(upgradeCost(club, affordable[0]))}.`, view: 'strutture', tone: 'tip' });

  return out;
}
