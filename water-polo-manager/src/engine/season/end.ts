// Chiusura della stagione: verdetti, premi, reputazione, storia, contratti, ritiri.

import { leagueRules } from '../data/config';
import { income, expense, ledgerTotals } from '../economy/ledger';
import { settleSponsors } from '../economy/sponsors';
import { addMessage, addNews, fmtMoney } from '../news';
import type { Rng } from '../rng';
import type { Club, ClubSeasonRecord, Competition, Player, SeasonSummary, World } from '../types';
import { clamp } from '../util';
import { computeStandings } from '../competition/standings';
import { finalPosition, finalizeLeague } from '../competition/progress';
import { simulateFixture } from '../match/apply';
import { seasonEndDevelopment, retirementChance } from '../player/development';
import { ageOf } from '../player/value';
import { fullName } from '../player/generate';
import { aiRenewals } from '../ai/clubAI';
import { removeFromClub } from '../transfer/contracts';
import { leagueComp, seasonStatsTotal } from '../world/queries';
import { coachRating } from '../staff/coach';
import { OBJECTIVE_LABELS, objectiveMet } from '../economy/sponsors';

function forceFinish(world: World) {
  // Eventuali partite rimaste (non dovrebbe accadere): si giocano subito.
  for (let guard = 0; guard < 50; guard++) {
    const left = Object.values(world.fixtures).filter(
      (f) => !f.played && !f.cancelled && !f.ifNeeded && world.competitions[f.compId]?.season === world.season,
    );
    if (!left.length) break;
    for (const f of left.sort((a, b) => a.day - b.day)) if (!f.played) simulateFixture(world, f);
  }
  for (const c of Object.values(world.competitions)) {
    if (c.season === world.season && c.kind === 'league' && !c.finished && c.phases.every((p) => p.done || p.kind === 'groups')) {
      for (const p of c.phases) p.done = true;
      finalizeLeague(world, c);
    }
  }
}

interface Outcome {
  pos: number | null;
  groupSize: number;
  promoted: boolean;
  champion: boolean;
  cupSemi: boolean;
  europe: boolean;
  relegated: boolean;
  playoff: boolean;
}

function outcomeFor(world: World, club: Club): Outcome {
  const comp = leagueComp(world, club.division);
  const fp = comp ? finalPosition(comp, club.id) : null;
  const groupSize = comp && fp ? comp.finalRanking![fp.group].length : 12;
  const cup = Object.values(world.competitions).find((c) => c.season === world.season && c.key === 'COPPA');
  let cupSemi = false;
  if (cup) {
    const ph = cup.phases[0];
    const semi = ph.rounds.find((r) => r.ties.length === 2);
    cupSemi = !!semi?.ties.some((t) => t.homeId === club.id || t.awayId === club.id);
  }
  const playoff = !!comp?.phases.some((p) => p.purpose !== 'main' && p.purpose !== 'playout' && p.rounds[0]?.ties.some((t) => t.homeId === club.id || t.awayId === club.id));
  const a1Pos = club.division === 'A1' && fp ? fp.pos : 99;
  const europeSlots = world.rules.continental.flatMap((c) => c.italySlots);
  return {
    pos: fp?.pos ?? null,
    groupSize,
    promoted: !!comp?.promoted.includes(club.id),
    relegated: !!comp?.relegated.includes(club.id),
    champion: comp?.winnerId === club.id,
    cupSemi,
    europe: europeSlots.includes(a1Pos),
    playoff,
  };
}

function cupsWon(world: World, club: Club): string[] {
  return Object.values(world.competitions)
    .filter((c) => c.season === world.season && c.kind !== 'league' && c.winnerId === club.id)
    .map((c) => c.name);
}

function topScorer(world: World, club: Club): string | undefined {
  const ps = club.playerIds.map((id) => world.players[id]).filter(Boolean);
  const best = ps.sort((a, b) => seasonStatsTotal(b).goals - seasonStatsTotal(a).goals)[0];
  return best ? `${fullName(best)} (${seasonStatsTotal(best).goals})` : undefined;
}

export function endSeason(world: World, rng: Rng) {
  forceFinish(world);
  const summary: SeasonSummary = { season: world.season, champions: {}, promoted: {}, relegated: {}, userOutcome: '', awards: {} };
  const leagues = Object.values(world.competitions).filter((c) => c.season === world.season && c.kind === 'league');
  for (const comp of leagues) {
    if (comp.winnerId) summary.champions[comp.key] = { id: comp.winnerId, name: world.clubs[comp.winnerId].name };
    summary.promoted[comp.key] = comp.promoted.map((id) => world.clubs[id].name);
    summary.relegated[comp.key] = comp.relegated.map((id) => world.clubs[id].name);
  }
  for (const c of Object.values(world.competitions)) {
    if (c.season === world.season && c.kind !== 'league' && c.winnerId) summary.champions[c.key] = { id: c.winnerId, name: world.clubs[c.winnerId].name };
  }
  // Premi del campionato, reputazione, sviluppo societario, sponsor e storia.
  for (const club of Object.values(world.clubs)) {
    const o = outcomeFor(world, club);
    const comp = club.country === 'ITA' ? leagueComp(world, club.division) : undefined;
    let rules;
    try { rules = club.country === 'ITA' ? leagueRules(world.rules, club.division) : null; } catch { rules = null; }
    if (rules && o.pos) {
      income(club, 'premi', rules.prizeByPosition[o.pos - 1] ?? 0);
      if (o.promoted) income(club, 'premi', rules.promotionPrize);
    }
    // Reputazione: risultato rispetto al girone e verdetti.
    if (o.pos) {
      const rel = 1 - (o.pos - 1) / Math.max(1, o.groupSize - 1);
      club.reputation = clamp(club.reputation + (rel - 0.5) * 4, 1, 100);
    }
    if (o.promoted) club.reputation = clamp(club.reputation + 6, 1, 100);
    if (o.relegated) club.reputation = clamp(club.reputation - 6, 1, 100);
    if (o.champion && club.division === 'A1') club.reputation = clamp(club.reputation + 6, 1, 100);
    const tier = rules?.tier ?? 1;
    club.devPoints += [0, 70, 40, 22, 12][tier] ?? 30;
    if (o.promoted) club.devPoints += 60;
    if (o.champion) club.devPoints += tier === 1 ? 200 : 40;
    // Obiettivo stagionale dichiarato.
    if (club.isUser) {
      const met = objectiveMet(club.objective, o);
      const ambitious = ['promozione', 'titolo', 'europa', 'top4'].includes(club.objective);
      if (met) {
        club.fans = Math.round(club.fans * (ambitious ? 1.12 : 1.05));
        club.reputation = clamp(club.reputation + (ambitious ? 3 : 1), 1, 100);
      } else {
        club.fans = Math.round(club.fans * (ambitious ? 0.9 : 0.95));
        club.reputation = clamp(club.reputation - (ambitious ? 2.5 : 1.5), 1, 100);
      }
      addMessage(world, 'societa', met ? 'Obiettivo stagionale raggiunto!' : 'Obiettivo stagionale mancato',
        `${OBJECTIVE_LABELS[club.objective]}: ${met ? 'tifosi entusiasti, la reputazione cresce.' : 'i tifosi sono delusi.'}`, { important: true });
      // Socio di minoranza
      if (club.partner && club.partner.untilSeason <= world.season) {
        const ok = objectiveMet(club.partner.objective, o);
        if (!ok) {
          const repay = Math.round(((club.partner as any).amount ?? 0) * 0.4);
          expense(club, 'altro', repay);
          addMessage(world, 'societa', `${club.partner.name} esce dalla società`, `Obiettivo mancato: il socio esce e chiede la restituzione di ${fmtMoney(repay)}.`, { important: true });
        } else {
          addMessage(world, 'societa', `${club.partner.name} soddisfatto`, 'L’obiettivo concordato è stato raggiunto: il socio resta come partner silenzioso.');
        }
        club.partner = undefined;
      }
    }
    settleSponsors(world, club, o);
    const st = comp ? (() => {
      const fp = finalPosition(comp, club.id);
      if (!fp) return null;
      return computeStandings(world, comp, 0, fp.group).find((r) => r.clubId === club.id) ?? null;
    })() : null;
    const regPos = comp ? (() => {
      for (let g = 0; g < comp.phases[0].groups.length; g++) {
        const i = computeStandings(world, comp, 0, g).findIndex((r) => r.clubId === club.id);
        if (i >= 0) return { pos: i + 1, group: comp.phases[0].groups[g].name };
      }
      return null;
    })() : null;
    const outcome = o.champion && club.division === 'A1' ? 'Campione d’Italia'
      : o.promoted ? 'Promosso' : o.relegated ? 'Retrocesso' : o.champion ? 'Primo posto' : o.pos ? `${o.pos}° posto` : '—';
    const coach = club.coachId ? world.coaches[club.coachId] : null;
    const rec: ClubSeasonRecord = {
      season: world.season, division: club.division, group: regPos?.group, position: regPos?.pos ?? null, finalRank: o.pos,
      points: st?.pts ?? 0, w: st?.w ?? 0, d: st?.d ?? 0, l: st?.l ?? 0, gf: st?.gf ?? 0, ga: st?.ga ?? 0, outcome,
      cups: cupsWon(world, club), topScorer: topScorer(world, club), balance: club.finances.balance, reputation: Math.round(club.reputation),
      coach: coach ? `${coach.firstName} ${coach.lastName}` : undefined,
    };
    club.history.push(rec);
    if (coach) {
      coach.history.push({ season: world.season, clubName: club.name, division: club.division, position: o.pos });
      if (o.champion || cupsWon(world, club).length) coach.trophies++;
    }
    if (club.isUser) summary.userOutcome = outcome;
  }
  // Premi individuali (campionato dell'utente).
  const userDiv = world.clubs[world.userClubId].division;
  const divPlayers = Object.values(world.players).filter((p) => p.clubId && world.clubs[p.clubId]?.division === userDiv && p.stats[userDiv]);
  const mvp = divPlayers.filter((p) => p.stats[userDiv].apps >= 10).sort((a, b) => b.stats[userDiv].ratingSum / b.stats[userDiv].apps - a.stats[userDiv].ratingSum / a.stats[userDiv].apps)[0];
  const scorer = [...divPlayers].sort((a, b) => b.stats[userDiv].goals - a.stats[userDiv].goals)[0];
  const young = divPlayers.filter((p) => ageOf(p, world.season) <= 21 && p.stats[userDiv].apps >= 8).sort((a, b) => b.stats[userDiv].ratingSum / b.stats[userDiv].apps - a.stats[userDiv].ratingSum / a.stats[userDiv].apps)[0];
  if (mvp) summary.awards.mvp = `${fullName(mvp)} (${world.clubs[mvp.clubId!].name})`;
  if (scorer) summary.awards.topScorer = `${fullName(scorer)} (${world.clubs[scorer.clubId!].name}, ${scorer.stats[userDiv].goals} gol)`;
  if (young) summary.awards.bestYoung = `${fullName(young)} (${world.clubs[young.clubId!].name})`;
  world.seasonSummaries.push(summary);
  // Giocatori: storico, sviluppo di fine anno, rinnovi AI, scadenze, prestiti, ritiri.
  for (const club of Object.values(world.clubs)) if (!club.isUser) aiRenewals(world, club, rng);
  const toRetire: Player[] = [];
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const tot = seasonStatsTotal(p);
    if (p.clubId && tot.apps > 0) {
      const club = world.clubs[p.clubId];
      p.history.push({
        season: world.season, clubId: club.id, clubName: club.name, division: club.division, apps: tot.apps, goals: tot.goals,
        assists: tot.assists, saves: tot.saves, avgRating: Math.round(tot.avgRating * 100) / 100, overall: p.overall,
      });
      if (p.history.length > 25) p.history.shift();
    }
    seasonEndDevelopment(world, p, rng, tot.avgRating);
    if (rng.chance(retirementChance(p, world.season))) toRetire.push(p);
  }
  for (const p of toRetire) retire(world, p);
  // Prestiti che terminano.
  for (const p of Object.values(world.players)) {
    if (!p.loan || p.loan.untilSeason > world.season) continue;
    const parent = world.clubs[p.loan.fromClubId];
    removeFromClub(world, p);
    p.loan = undefined;
    if (parent) {
      p.clubId = parent.id;
      parent.playerIds.push(p.id);
      if (parent.isUser) addMessage(world, 'mercato', `${fullName(p)} rientra dal prestito`, 'Il giocatore torna a disposizione.', { link: { view: 'player', id: p.id } });
    } else {
      p.clubId = null;
    }
  }
  // Contratti scaduti: i giocatori si svincolano.
  for (const p of Object.values(world.players)) {
    if (!p.clubId || !p.contract || p.retired) continue;
    if (p.contract.endSeason > world.season) continue;
    const club = world.clubs[p.clubId];
    if (p.youth) { p.contract.endSeason = world.season + 1; continue; }
    if (club.isUser) addMessage(world, 'contratti', `${fullName(p)} lascia a parametro zero`, 'Il contratto è scaduto senza rinnovo.');
    removeFromClub(world, p);
    p.clubId = null;
    p.contract = null;
    p.transferListed = false;
  }
  // Allenatori e staff: scadenze e ritiri.
  for (const c of Object.values(world.coaches)) {
    const age = world.season - c.birthYear;
    if (c.contract && c.contract.endSeason <= world.season && c.clubId) {
      const club = world.clubs[c.clubId];
      const keep = !club.isUser && c.security > 45;
      if (keep) c.contract.endSeason = world.season + 1 + rng.int(0, 1);
      else if (!club.isUser) {
        club.coachId = null;
        c.clubId = null;
        c.contract = null;
      } else {
        // L'allenatore dell'utente resta finché non viene esonerato, ma chiede il rinnovo: contratto prorogato di un anno.
        c.contract.endSeason = world.season + 1;
        addMessage(world, 'staff', `Contratto dell’allenatore prorogato`, `${c.firstName} ${c.lastName} resta per un’altra stagione alle stesse condizioni.`);
      }
    }
    if (!c.clubId && age >= 68) delete world.coaches[c.id];
  }
  for (const s of Object.values(world.staff)) {
    if (s.contract && s.contract.endSeason <= world.season && s.clubId) {
      const club = world.clubs[s.clubId];
      if (club?.isUser || rng.chance(0.7)) s.contract.endSeason = world.season + 1;
      else {
        if (club) delete club.staff[s.role];
        s.clubId = null;
        s.contract = null;
      }
    }
  }
  // Riepilogo per l'utente.
  const user = world.clubs[world.userClubId];
  const led = ledgerTotals(user.finances.ledger);
  addMessage(world, 'societa', `Fine della stagione ${world.season}/${(world.season + 1) % 100}`,
    `${summary.userOutcome}. Bilancio della stagione: ${fmtMoney(led.net)}. Saldo in banca: ${fmtMoney(user.finances.balance)}.`, { important: true });
  world.phase = 'review';
}

function retire(world: World, p: Player) {
  const club = p.clubId ? world.clubs[p.clubId] : null;
  if (club?.isUser) {
    const apps = p.history.filter((h) => h.clubId === club.id).reduce((t, h) => t + h.apps, 0);
    const goals = p.history.filter((h) => h.clubId === club.id).reduce((t, h) => t + h.goals, 0);
    const seasons = p.history.filter((h) => h.clubId === club.id).map((h) => h.season);
    if (apps >= 20) {
      world.legends.push({ name: fullName(p), seasons: seasons.length ? `${Math.min(...seasons)}–${Math.max(...seasons) + 1}` : '', apps, goals });
    }
    addMessage(world, 'societa', `${fullName(p)} si ritira`, `A ${ageOf(p, world.season)} anni chiude la carriera.`);
  } else if (p.overall >= 78) {
    addNews(world, `Si ritira ${fullName(p)}`, `Chiude la carriera uno dei grandi della pallanuoto (${p.overall} di overall).`, 'giocatori');
  }
  removeFromClub(world, p);
  p.clubId = null;
  p.contract = null;
  p.retired = true;
}

export function coachRatingOf(world: World, id: string | null) {
  return id ? coachRating(world.coaches[id]) : 0;
}

export type { Competition };
