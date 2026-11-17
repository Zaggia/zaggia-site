import { autoLineup } from '../engine/club/lineup';
import { resolveEvent } from '../engine/events/events';
import { simulateToEnd } from '../engine/match/engine';
import { beginNextSeason, blocker, continueGame, finishUserMatch, forfeitUserMatch, prepareUserMatch } from '../engine/season/advance';
import type { World } from '../engine/types';
import { worldRng } from '../engine/world/context';
import { acceptSponsorOffer } from '../engine/economy/sponsors';
import { defaultYears, negotiate, signContract, suggestedStatus, wageDemand } from '../engine/transfer/contracts';
import { signFreeAgent } from '../engine/transfer/market';
import { ensureMinimumSquad } from '../engine/ai/clubAI';

/** Un presidente "di base": rinnova chi serve e tessera svincolati se la rosa è corta. */
export function autoManageUser(world: World) {
  const user = world.clubs[world.userClubId];
  const squad = user.playerIds.map((id) => world.players[id]);
  if (world.day === 280) {
    const sorted = [...squad].sort((a, b) => b.overall - a.overall);
    for (const p of sorted.slice(0, 14)) {
      if (!p.contract || p.contract.endSeason > world.season) continue;
      const years = defaultYears(p, world.season + 1);
      const status = suggestedStatus(world, p, user);
      const wage = wageDemand(world, p, user, status, years);
      const r = negotiate(world, p, user, { wage, years, status });
      if (r.result === 'accept') signContract(world, p, user, { wage, years, status });
    }
  }
  if (world.day < 90 && squad.length < 16) {
    const free = Object.values(world.players).filter((p) => !p.clubId && !p.retired && !p.injury).sort((a, b) => b.overall - a.overall);
    for (const p of free) {
      if (user.playerIds.length >= 16) break;
      const years = 1;
      const status = suggestedStatus(world, p, user);
      const wage = wageDemand(world, p, user, status, years);
      if (wage > 6000) continue;
      const r = negotiate(world, p, user, { wage, years, status });
      if (r.result === 'accept') signFreeAgent(world, p, user, { wage, years, status });
    }
  }
  if (user.playerIds.length < 13) ensureMinimumSquad(world, user, worldRng(world));
}

/** Gioca automaticamente fino alla fine della stagione corrente (decisioni: prima scelta disponibile). */
export function autoplaySeason(world: World, onMatch?: (w: World) => void): void {
  const startSeason = world.season;
  let guard = 0;
  while (guard++ < 5000) {
    if (world.phase === 'gameover') return;
    if (world.phase === 'review') return;
    const b = blocker(world);
    if (b?.reason === 'event') {
      const ev = world.events.find((e) => !e.resolved && e.blocking)!;
      const choice = ev.choices.find((c) => !c.disabled) ?? ev.choices[0];
      resolveEvent(world, ev.id, choice.id, worldRng(world));
      continue;
    }
    if (b?.reason === 'match') {
      const user = world.clubs[world.userClubId];
      user.lineup = autoLineup(world, user);
      const prep = prepareUserMatch(world);
      if ('error' in prep) {
        const err = forfeitUserMatch(world);
        if (err) throw new Error(prep.error + ' / ' + err);
        continue;
      }
      simulateToEnd(prep.state);
      finishUserMatch(world, prep.fixture.id, prep.state);
      onMatch?.(world);
      continue;
    }
    // Sponsor: accetta la prima offerta disponibile per gli spazi liberi.
    for (const o of [...world.sponsorOffers]) acceptSponsorOffer(world, o.id);
    autoManageUser(world);
    continueGame(world, 'day', 1);
    if (world.season !== startSeason) return;
  }
  throw new Error('autoplay: troppe iterazioni');
}

export function autoplayToNextSeason(world: World) {
  autoplaySeason(world);
  if (world.phase === 'review') beginNextSeason(world);
}
