// Avanzamento del tempo: un giorno alla volta, fermandosi quando serve una decisione.

import { rosterIssue, rosterLimit, trimRoster } from '../club/roster';
import { dayOf, seasonLength, weekday } from '../calendar';
import { weeklyFinance, sellSeasonTickets, loanOutIndex } from '../economy/finance';
import { refreshUserSponsorOffers } from '../economy/sponsors';
import { addMessage } from '../news';
import type { Fixture, World } from '../types';
import { simulateAiFixtures, userFixtureOn, applyMatch } from '../match/apply';
import { buildMatchSetup } from '../match/setup';
import { createMatch, type MatchState } from '../match/engine';
import { autoLineup, validateLineup } from '../club/lineup';
import { aiCoachReview, aiInterestInUserPlayers, aiMarketWeek, buildMarketPool, fillRoster } from '../ai/clubAI';
import { expireOffers, transferWindowOpen } from '../transfer/market';
import { checkPromises, expireEvents, pendingBlockingEvents, weeklyEvents } from '../events/events';
import { bankruptcyCheck, dailyPlayers, debtConsequences, licenseCheck, monthlyClubs, weeklyMorale, weeklyTraining, youthIntake } from './routines';
import { endSeason } from './end';
import { startSeason } from './start';
import { worldRng } from '../world/context';
import { dailyFacilities } from '../club/manage';
import { fullName } from '../player/generate';
import { ageOf } from '../player/value';

export type StopReason = 'match' | 'event' | 'review' | 'gameover' | 'offer' | 'day' | 'limit' | 'lineup' | 'roster';

export interface Blocker {
  reason: StopReason;
  text: string;
  fixtureId?: string;
}

/** Cosa impedisce di andare avanti (partita da giocare, decisione da prendere, ecc.). */
export function blocker(world: World): Blocker | null {
  if (world.phase === 'gameover') return { reason: 'gameover', text: world.gameOverReason ?? 'Fallimento.' };
  if (world.phase === 'review') return { reason: 'review', text: 'La stagione è finita: consulta il riepilogo e inizia la nuova stagione.' };
  const ev = pendingBlockingEvents(world)[0];
  if (ev) return { reason: 'event', text: `Decisione richiesta: ${ev.title}` };
  const f = userFixtureOn(world, world.day);
  if (f) {
    // Prima di ogni gara ufficiale la rosa deve avere esattamente il numero regolamentare di tesserati.
    const issue = rosterIssue(world, world.clubs[world.userClubId]);
    if (issue) return { reason: 'roster', text: issue.text, fixtureId: f.id };
    return { reason: 'match', text: 'Oggi si gioca!', fixtureId: f.id };
  }
  return null;
}

function processScouting(world: World) {
  for (const a of world.scouting) {
    a.daysLeft--;
    if (a.daysLeft <= 0) {
      world.knowledge[a.playerId] = 100;
      const p = world.players[a.playerId];
      if (p) addMessage(world, 'mercato', `Relazione dell’osservatore: ${fullName(p)}`, `Valutazione completa disponibile: ${ageOf(p, world.season)} anni, ruolo ${p.role}.`, { link: { view: 'player', id: p.id } });
    }
  }
  world.scouting = world.scouting.filter((a) => a.daysLeft > 0);
}

function keyDates(world: World) {
  const rng = worldRng(world);
  const d = world.day;
  if (d === dayOf(world.season, world.rules.licenseCheckDate)) licenseCheck(world);
  if (d === dayOf(world.season, '09-01')) for (const c of Object.values(world.clubs)) sellSeasonTickets(world, c);
  if (d === dayOf(world.season, world.rules.youthIntakeDate)) youthIntake(world, rng);
  if (d === dayOf(world.season, '01-02')) {
    const user = world.clubs[world.userClubId];
    const expiring = user.playerIds.map((id) => world.players[id]).filter((p) => p?.contract && p.contract.endSeason <= world.season);
    if (expiring.length) {
      addMessage(world, 'contratti', 'Contratti in scadenza', `A fine stagione scadono: ${expiring.map((p) => fullName(p)).join(', ')}. Rinnova chi vuoi tenere.`, { important: true, link: { view: 'rosa' } });
    }
  }
  for (const w of world.rules.windows) {
    if (d === dayOf(world.season, w.start)) addMessage(world, 'mercato', `${w.name}: si apre il mercato`, 'Puoi acquistare, vendere e prendere giocatori in prestito.', { link: { view: 'mercato' } });
    if (d === dayOf(world.season, w.end)) addMessage(world, 'mercato', `${w.name}: ultimo giorno`, 'Domani il mercato chiude: dopo potrai ingaggiare solo svincolati.', { important: true, link: { view: 'mercato' } });
  }
  if (d === dayOf(world.season, '12-01') || d === dayOf(world.season, '06-01')) refreshUserSponsorOffers(world, rng);
}

function weekly(world: World) {
  const rng = worldRng(world);
  weeklyTraining(world, rng);
  const loanOut = loanOutIndex(world);
  for (const club of Object.values(world.clubs)) weeklyFinance(world, club, loanOut);
  weeklyMorale(world);
  debtConsequences(world, rng);
  const pool = buildMarketPool(world);
  const window = transferWindowOpen(world).open;
  for (const club of Object.values(world.clubs)) {
    if (club.isUser) continue;
    if (window || club.playerIds.length !== rosterLimit(world)) aiMarketWeek(world, club, pool, rng, loanOut);
    aiCoachReview(world, club, rng);
  }
  aiInterestInUserPlayers(world, rng);
  checkPromises(world);
  weeklyEvents(world, rng);
  bankruptcyCheck(world);
}

/** Le società AI tornano subito a quota regolamentare se qualcuno è partito (o arrivato) in settimana. */
function enforceAiRosters(world: World) {
  const limit = rosterLimit(world);
  for (const club of Object.values(world.clubs)) {
    if (club.isUser || club.playerIds.length === limit) continue;
    if (club.playerIds.length > limit) trimRoster(world, club);
    else fillRoster(world, club);
  }
}

/** Avanza di un giorno: gioca le partite AI di oggi, poi passa al giorno successivo. */
export function advanceOneDay(world: World): void {
  if (world.phase !== 'regular') return;
  simulateAiFixtures(world, world.day);
  const len = seasonLength(world.season);
  if (world.day >= len - 1) {
    endSeason(world, worldRng(world));
    return;
  }
  world.day++;
  dailyPlayers(world);
  enforceAiRosters(world);
  for (const c of Object.values(world.clubs)) dailyFacilities(world, c);
  processScouting(world);
  expireOffers(world);
  expireEvents(world, worldRng(world));
  keyDates(world);
  if (weekday(world.season, world.day) === 1) weekly(world);
  if (new Date(Date.UTC(world.season, 6, 1 + world.day)).getUTCDate() === 1) monthlyClubs(world);
}

export interface ContinueResult {
  days: number;
  stop: Blocker | null;
}

/** "Continua": va avanti fino alla prossima cosa che richiede attenzione. */
export function continueGame(world: World, mode: 'day' | 'auto' | 'week' = 'auto', maxDays = 60): ContinueResult {
  let days = 0;
  const inboxBefore = world.inbox.filter((m) => m.important && !m.read).length;
  while (days < maxDays) {
    const b = blocker(world);
    if (b) return { days, stop: b };
    const startDay = world.day;
    advanceOneDay(world);
    days++;
    if (world.day === startDay && world.phase === 'regular') break;
    if (mode === 'day') break;
    if (mode === 'week' && days >= 7) break;
    const important = world.inbox.filter((m) => m.important && !m.read).length;
    if (mode === 'auto' && important > inboxBefore) return { days, stop: { reason: 'offer', text: 'Ci sono novità importanti nella posta.' } };
  }
  return { days, stop: blocker(world) ?? { reason: 'limit', text: '' } };
}

/** Prepara la partita dell'utente di oggi (la simulazione viene guidata dall'interfaccia). */
export function prepareUserMatch(world: World): { fixture: Fixture; state: MatchState } | { error: string } {
  const b = blocker(world);
  if (!b || b.reason !== 'match' || !b.fixtureId) return { error: 'Oggi non ci sono partite da giocare.' };
  const f = world.fixtures[b.fixtureId];
  const user = world.clubs[world.userClubId];
  const issues = validateLineup(world, user, user.lineup).filter((i) => i.level === 'error');
  if (issues.length) return { error: issues.map((i) => i.text).join(' ') };
  if (availableCount(world, user) < 7) return { error: 'Non hai 7 giocatori disponibili: tessera degli svincolati o promuovi dei giovani (altrimenti la partita sarà persa a tavolino).' };
  const setup = buildMatchSetup(world, f, user.lineup);
  return { fixture: f, state: createMatch(setup) };
}

export function availableCount(world: World, club: { playerIds: string[]; youthIds: string[] }): number {
  return [...club.playerIds, ...club.youthIds].filter((id) => {
    const p = world.players[id];
    return p && !p.injury;
  }).length;
}

/** Sconfitta a tavolino (0-5) se non si hanno abbastanza giocatori. */
export function forfeitUserMatch(world: World): string | null {
  const b = blocker(world);
  if (!b || b.reason !== 'match' || !b.fixtureId) return 'Nessuna partita da giocare.';
  const user = world.clubs[world.userClubId];
  if (availableCount(world, user) >= 7) return 'Hai abbastanza giocatori: non puoi rinunciare alla partita.';
  const f = world.fixtures[b.fixtureId];
  const setup = buildMatchSetup(world, f, autoLineupSafe(world));
  const st = createMatch(setup);
  st.finished = true;
  st.score = f.homeId === user.id ? [0, 5] : [5, 0];
  for (const s of st.sides) for (const p of s.p) p.line.seconds = 0;
  applyMatch(world, f, st);
  simulateAiFixtures(world, world.day);
  return null;
}

function autoLineupSafe(world: World) {
  return autoLineup(world, world.clubs[world.userClubId]);
}

/** Registra la partita dell'utente e gioca le altre partite del giorno. */
export function finishUserMatch(world: World, fixtureId: string, state: MatchState) {
  const f = world.fixtures[fixtureId];
  const report = applyMatch(world, f, state);
  simulateAiFixtures(world, world.day);
  return report;
}

export function beginNextSeason(world: World) {
  if (world.phase !== 'review') return;
  startSeason(world, worldRng(world), false);
}
