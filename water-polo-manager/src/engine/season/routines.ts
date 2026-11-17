// Routine giornaliere, settimanali e mensili del mondo di gioco.

import { rosterLimit, trimRoster } from '../club/roster';
import { DIFFICULTIES } from '../data/config';
import { overdraftLimit } from '../economy/finance';
import { addMessage, addNews, fmtMoney } from '../news';
import type { Rng } from '../rng';
import type { Club, Player, World } from '../types';
import { clamp } from '../util';
import { developWeekly, devContext, type DevContext } from '../player/development';
import { updateFamiliarity } from '../tactics/tactics';
import { injuryFor } from '../match/apply';
import { academyMean, generateYouth } from '../club/generate';
import { youthTalentEvent } from '../events/events';
import { ageOf } from '../player/value';
import { fullName } from '../player/generate';
import { leagueComp, userClub } from '../world/queries';
import { EXPECTED_TIME, teamStrength } from '../club/lineup';
import { releasePlayer, removeFromClub } from '../transfer/contracts';
import { worldRng } from '../world/context';
import { dayOf } from '../calendar';

/** Ogni giorno: recupero fisico, decorso degli infortuni, squalifiche lunghe. */
export function dailyPlayers(world: World) {
  const clubRecovery = new Map<string, number>();
  for (const c of Object.values(world.clubs)) {
    const med = 1 + c.facilities.medico.level * 0.04;
    const fit = c.staff.atletico ? 1 + (world.staff[c.staff.atletico]?.rating ?? 0) / 500 : 1;
    const inten = c.training.focus === 'recupero' ? 1.3 : c.training.intensity === 'alta' ? 0.8 : c.training.intensity === 'bassa' ? 1.2 : 1;
    clubRecovery.set(c.id, med * fit * inten);
  }
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const f = p.clubId ? clubRecovery.get(p.clubId) ?? 1 : 1;
    if (p.condition < 100) p.condition = Math.min(100, p.condition + 12 * (0.6 + p.attrs.recupero / 150) * f);
    if (p.injury) {
      p.injury.daysLeft -= 1;
      if (p.injury.daysLeft <= 0) {
        if (p.clubId === world.userClubId) addMessage(world, 'infortuni', `${fullName(p)} è guarito`, 'Il giocatore è di nuovo a disposizione.', { link: { view: 'player', id: p.id } });
        p.injury = undefined;
        p.condition = Math.min(p.condition, 90);
      } else {
        p.condition = Math.min(p.condition, 75);
      }
    }
  }
}

/** Ogni lunedì: allenamento, sviluppo, familiarità tattica, preparazione atletica, infortuni in allenamento. */
export function weeklyTraining(world: World, rng: Rng) {
  const ctxCache = new Map<string, DevContext>();
  const freeCtx = devContext(world, null);
  const preseason = world.day < dayOf(world.season, '10-01');
  for (const club of Object.values(world.clubs)) {
    ctxCache.set(club.id, devContext(world, club));
    updateFamiliarity(world, club);
    const fisico = club.training.focus === 'fisico';
    const alta = club.training.intensity === 'alta';
    if (preseason) club.fitnessPrep = clamp(club.fitnessPrep + (fisico ? 4 : 1.5) * (alta ? 1.3 : club.training.intensity === 'bassa' ? 0.6 : 1), 0, 100);
    else club.fitnessPrep = clamp(club.fitnessPrep + (fisico ? 0.6 : -0.5), 0, 100);
    if (club.training.focus === 'tattico') club.chemistry = clamp(club.chemistry + 0.4, 0, 100);
  }
  for (const p of Object.values(world.players)) {
    if (p.retired) continue;
    const ctx = p.clubId ? ctxCache.get(p.clubId) ?? freeCtx : freeCtx;
    developWeekly(world, p, ctx, rng);
    if (!p.clubId || p.injury) continue;
    const club = world.clubs[p.clubId];
    const risk = 0.0003 * (club.training.intensity === 'alta' ? 1.6 : club.training.intensity === 'bassa' ? 0.6 : 1) *
      (1.25 - club.facilities.palestra.level * 0.06) * (p.condition < 70 ? 1.5 : 1);
    if (rng.chance(risk)) injuryFor(world, p, rng, 0.7);
  }
}


/** Morale settimanale: minutaggio rispetto alle aspettative, stipendi, allenatore. */
export function weeklyMorale(world: World) {
  const sens = DIFFICULTIES[world.difficulty].moraleSensitivity;
  const inSeason = world.day > dayOf(world.season, '10-15') && world.day < dayOf(world.season, '05-31');
  for (const club of Object.values(world.clubs)) {
    const coach = club.coachId ? world.coaches[club.coachId] : null;
    const target = 55 + (coach ? coach.attrs.spogliatoio / 6 : 0) + (club.chemistry - 50) / 10;
    for (const id of club.playerIds) {
      const p = world.players[id];
      if (!p) continue;
      let d = (target - p.morale) * 0.08;
      if (club.isUser && inSeason && p.contract && !p.injury) {
        const exp = EXPECTED_TIME[p.contract.status] ?? 0.3;
        d += clamp((p.playingTime - exp) * 10, -4, 2.5) * sens;
      }
      if (club.finances.unpaidWeeks > 0) d -= 3 * sens;
      if (p.wantsToLeave) d -= 0.8;
      p.morale = clamp(p.morale + d, 5, 100);
      if (!club.isUser) continue;
      p.unhappyWeeks = p.morale < 30 ? p.unhappyWeeks + 1 : 0;
      if (p.unhappyWeeks >= 5 && !p.wantsToLeave) {
        p.wantsToLeave = true;
        addMessage(world, 'contratti', `${fullName(p)} chiede la cessione`, 'Da settimane è scontento: vuole lasciare la società.', { link: { view: 'player', id: p.id }, important: true });
      }
    }
  }
}

/** Ogni primo del mese: tifosi e reputazione. */
export function monthlyClubs(world: World) {
  for (const club of Object.values(world.clubs)) {
    const recent = club.recent.slice(-6);
    const wins = recent.filter((r) => r === 'W').length;
    const losses = recent.filter((r) => r === 'L').length;
    const div = world.rules.leagues.find((l) => l.key === club.division);
    const fanTarget = div ? (div.fans[0] + (div.fans[1] - div.fans[0]) * (club.reputation - div.reputation[0]) / Math.max(1, div.reputation[1] - div.reputation[0])) : club.fans;
    club.fans = Math.max(30, Math.round(club.fans + (fanTarget - club.fans) * 0.02 + club.fans * (wins - losses) * 0.004));
    if (div) {
      const mid = (div.reputation[0] + div.reputation[1]) / 2;
      club.reputation = clamp(club.reputation + (mid - club.reputation) * 0.015 + (wins - losses) * 0.06, 1, 100);
    }
  }
}

/** Ingresso dei nuovi giovani (a marzo) per tutte le società. */
export function youthIntake(world: World, rng: Rng) {
  const ctx = { rng, season: world.season, newId: (p: string) => `${p}${(world.nextId++).toString(36)}` };
  for (const club of Object.values(world.clubs)) {
    const lvl = club.facilities.giovanile.level;
    const dir = club.staff.giovanili ? world.staff[club.staff.giovanili]?.rating ?? 0 : 0;
    const count = club.isUser ? 2 + lvl : rng.int(2, 3 + Math.floor(lvl / 2));
    const youth = generateYouth(ctx, club.id, academyMean(lvl, dir, club.reputation), count, lvl);
    for (const p of youth) {
      world.players[p.id] = p;
      club.youthIds.push(p.id);
    }
    if (club.isUser) {
      const list = youth.map((p) => `${fullName(p)} (${ageOf(p, world.season)} anni, ${p.role})`).join(', ');
      addMessage(world, 'giovani', 'Nuovi talenti nel settore giovanile', `Sono arrivati ${youth.length} ragazzi: ${list}.`, { link: { view: 'giovani' } });
      const gem = youth.filter((p) => p.potential >= 78).sort((a, b) => b.potential - a.potential)[0];
      if (gem) youthTalentEvent(world, gem);
    }
    // Il vivaio non può crescere all'infinito: si salutano i ragazzi meno promettenti.
    if (club.youthIds.length > 14) {
      const sorted = club.youthIds.map((id) => world.players[id]).sort((a, b) => a.potential - b.potential);
      for (const p of sorted.slice(0, club.youthIds.length - 14)) {
        removeFromClub(world, p);
        p.clubId = null;
        p.contract = null;
        p.youth = false;
      }
    }
  }
}

/** Controllo della licenza nazionale (iscrizione al campionato). */
export function licenseCheck(world: World) {
  for (const club of Object.values(world.clubs)) {
    if (club.country !== 'ITA') continue;
    const comp = leagueComp(world, club.division);
    if (!comp) continue;
    let pen = 0;
    if (club.finances.balance < -overdraftLimit(club)) pen += 3;
    if (club.finances.unpaidWeeks > 0) pen += 2;
    if (club.pendingPenalty) { pen += club.pendingPenalty; club.pendingPenalty = 0; }
    if (!pen) continue;
    comp.penalties[club.id] = (comp.penalties[club.id] ?? 0) + pen;
    if (club.isUser) {
      addMessage(world, 'finanze', `Licenza nazionale: ${pen} punti di penalizzazione`, 'La situazione debitoria non rispetta i parametri federali: la squadra parte con una penalizzazione.', { important: true, link: { view: 'finanze' } });
    } else if (pen >= 3) {
      addNews(world, `${club.name} penalizzato`, `${pen} punti di penalizzazione per irregolarità amministrative.`, 'societa');
    }
  }
}

/** Conseguenze dei debiti: penalizzazioni, giocatori in mora, fallimento. */
export function debtConsequences(world: World, rng: Rng) {
  for (const club of Object.values(world.clubs)) {
    const f = club.finances;
    if (f.unpaidWeeks === 0) continue;
    const comp = club.country === 'ITA' ? leagueComp(world, club.division) : undefined;
    if (f.unpaidWeeks >= 8 && f.unpaidWeeks % 4 === 0 && comp && !comp.finished) {
      comp.penalties[club.id] = (comp.penalties[club.id] ?? 0) + 1;
      if (club.isUser) addMessage(world, 'finanze', 'Penalizzazione per stipendi non pagati', 'La federazione toglie un punto in classifica.', { important: true });
    }
    if (f.unpaidWeeks >= 6) {
      // Un giocatore mette in mora la società e se ne va a parametro zero.
      const p = rng.pick(club.playerIds.map((id) => world.players[id]).filter((x) => x && x.overall >= 30));
      if (p && rng.chance(0.35)) {
        const name = fullName(p);
        f.arrears = Math.max(0, f.arrears - (p.contract?.wage ?? 0) / 10);
        removeFromClub(world, p);
        p.clubId = null;
        p.contract = null;
        if (club.isUser) addMessage(world, 'contratti', `${name} lascia il club`, 'Ha messo in mora la società per gli stipendi arretrati ed è libero di firmare altrove.', { important: true });
      }
    }
    if (!club.isUser && f.unpaidWeeks >= 10) {
      // Nuova proprietà: si azzerano gli arretrati, a costo di reputazione e giocatori.
      const top = [...club.playerIds].map((id) => world.players[id]).sort((a, b) => (b.contract?.wage ?? 0) - (a.contract?.wage ?? 0)).slice(0, 2);
      for (const p of top) releasePlayer(world, p, 'svincolato per la crisi societaria');
      f.balance = -overdraftLimit(club) * 0.3;
      f.arrears = 0;
      f.unpaidWeeks = 0;
      club.reputation = clamp(club.reputation - 8, 1, 100);
      club.pendingPenalty += 3;
      addNews(world, `Crisi societaria a ${club.city}`, `${club.name} cambia proprietà dopo mesi di stipendi non pagati.`, 'societa');
    }
  }
}

/** Il presidente rischia il fallimento: verifica condizioni di game over. */
export function bankruptcyCheck(world: World): boolean {
  const club = userClub(world);
  const f = club.finances;
  const severe = f.balance < -overdraftLimit(club) * 4;
  if (f.unpaidWeeks === 12) {
    addMessage(world, 'finanze', 'Ultimo avviso prima del fallimento', 'Il tribunale minaccia di dichiarare il fallimento: servono soldi subito (cessioni, prestito, investimento personale).', { important: true, link: { view: 'finanze' } });
  }
  if (f.unpaidWeeks >= 16 || severe) {
    world.phase = 'gameover';
    world.gameOverReason = severe
      ? `Il debito di ${fmtMoney(-f.balance)} è insostenibile: il tribunale dichiara il fallimento di ${club.name}.`
      : `Dopo ${f.unpaidWeeks} settimane di stipendi non pagati il tribunale dichiara il fallimento di ${club.name}.`;
    return true;
  }
  return false;
}

/** Giovani troppo grandi per il vivaio a inizio stagione. */
export function youthAgeOut(world: World, club: Club) {
  for (const id of [...club.youthIds]) {
    const p = world.players[id];
    if (!p) continue;
    if (ageOf(p, world.season) < 20) continue;
    const room = club.playerIds.length < rosterLimit(world);
    if (!club.isUser && p.potential >= teamStrength(world, club) - 2 && (room || p.potential >= teamStrength(world, club) + 2)) {
      club.youthIds = club.youthIds.filter((x) => x !== id);
      club.playerIds.push(id);
      p.youth = false;
      p.contract = { wage: 800, endSeason: world.season + 1, status: 'giovane' };
      trimRoster(world, club, id);
    } else {
      removeFromClub(world, p);
      p.clubId = null;
      p.contract = null;
      p.youth = false;
      if (club.isUser) addMessage(world, 'giovani', `${fullName(p)} lascia il vivaio`, 'Ha superato l’età per il settore giovanile senza essere promosso in prima squadra.');
    }
  }
}

export function rngOf(world: World): Rng {
  return worldRng(world);
}

export type { Player };
