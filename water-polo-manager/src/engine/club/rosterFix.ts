// Sistemazione automatica della rosa dell'utente (usata dall'autoplay di debug e dai test).

import type { World } from '../types';
import { fillRoster } from '../ai/clubAI';
import { releasePlayer } from '../transfer/contracts';
import { releaseCandidate, rosterLimit } from './roster';

export function fixUserRoster(world: World): void {
  const club = world.clubs[world.userClubId];
  let guard = 0;
  while (club.playerIds.length > rosterLimit(world) && guard++ < 10) {
    const p = releaseCandidate(world, club);
    if (!p) break;
    releasePlayer(world, p, 'svincolato');
  }
  if (club.playerIds.length < rosterLimit(world)) fillRoster(world, club);
}
