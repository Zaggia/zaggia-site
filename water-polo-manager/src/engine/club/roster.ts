// Regola delle rose: ogni società, in ogni categoria, tessera esattamente lo stesso
// numero di giocatori di prima squadra (15 di default, configurabile nelle regole del mondo).
// Le giovanili sono un elenco a parte e non contano nel limite.

import type { Club, Player, Role, World } from '../types';
import { releasePlayer } from '../transfer/contracts';

export function rosterLimit(world: World): number {
  return world.rules.rosterSize ?? 15;
}

export interface RosterIssue {
  kind: 'over' | 'under';
  count: number;
  limit: number;
  text: string;
}

/** Rosa diversa dal numero regolamentare (null se è in regola). */
export function rosterIssue(world: World, club: Club): RosterIssue | null {
  const limit = rosterLimit(world);
  const count = club.playerIds.length;
  if (count > limit) {
    return {
      kind: 'over', count, limit,
      text: `Hai ${count} giocatori in rosa: il regolamento ne prevede ${limit}. Cedi, presta, svincola o rimanda nel vivaio ${count - limit === 1 ? 'un giocatore' : `${count - limit} giocatori`}.`,
    };
  }
  if (count < limit) {
    return {
      kind: 'under', count, limit,
      text: `Hai ${count} giocatori in rosa: servono ${limit} tesserati. Ingaggia ${limit - count === 1 ? 'uno svincolato' : `${limit - count} svincolati`}, promuovi dei giovani oppure completa la rosa automaticamente.`,
    };
  }
  return null;
}

/** Errore da mostrare quando la rosa è già al completo e si prova ad aggiungere un giocatore. */
export function rosterFullError(world: World, club: Club): string | null {
  const limit = rosterLimit(world);
  if (club.playerIds.length < limit) return null;
  return `Rosa al completo (${club.playerIds.length}/${limit}): prima cedi, presta, svincola o rimanda nel vivaio un giocatore.`;
}

/** Numero minimo di giocatori per ruolo che una società AI non scende mai a liberare. */
const MIN_ROLE: Partial<Record<Role, number>> = { POR: 2, CEN: 1, DIF: 1 };

/** Il giocatore meno utile della rosa (escludendo quelli in prestito e un eventuale protetto). */
export function releaseCandidate(world: World, club: Club, protect?: string): Player | null {
  const squad = club.playerIds.map((id) => world.players[id]).filter((p): p is Player => !!p);
  const count = (r: Role) => squad.filter((p) => p.role === r).length;
  const score = (p: Player) => {
    const age = world.season - p.birthYear;
    let s = p.overall;
    if (age <= 21) s += Math.max(0, p.potential - p.overall) * 0.35;
    if (age >= 33) s -= 2;
    if (p.injury && p.injury.daysLeft > 60) s -= 4;
    return s;
  };
  const options = squad.filter((p) => p.id !== protect && !p.loan && count(p.role) > (MIN_ROLE[p.role] ?? 0));
  options.sort((a, b) => score(a) - score(b));
  return options[0] ?? null;
}

/** Riporta una rosa AI al numero regolamentare liberando i giocatori meno utili. */
export function trimRoster(world: World, club: Club, protect?: string): number {
  if (club.isUser) return 0;
  let n = 0;
  while (club.playerIds.length > rosterLimit(world)) {
    const p = releaseCandidate(world, club, protect);
    if (!p) break;
    releasePlayer(world, p, 'svincolato');
    n++;
  }
  return n;
}
