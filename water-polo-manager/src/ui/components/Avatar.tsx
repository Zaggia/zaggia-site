// Avatar del giocatore: la sua calottina (colore del club, rossa per i portieri) con il numero.
// Niente volti inventati: i giocatori sono reali e non vanno "ritratti".

import type { Player } from '../../engine/types';
import { Cap, GK_CAP } from './Cap';

export function Avatar({ player, color, size = 48 }: { player: Pick<Player, 'id' | 'role' | 'capNumber' | 'nationality'>; color: string; size?: number }) {
  const cap = player.role === 'POR' ? GK_CAP : color;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-deep"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Cap color={cap} number={player.capNumber || undefined} size={Math.round(size * 0.82)} />
    </span>
  );
}
