// Avatar del giocatore: il suo volto (immagine AI) in un cerchio con l'anello del colore del club
// e, per i formati più grandi, la calottina col numero (rossa per i portieri).

import type { Player } from '../../engine/types';
import { faceFor, staffFaceFor } from '../faces';
import { Cap, GK_CAP } from './Cap';

type AvatarPlayer = Pick<Player, 'id' | 'role' | 'capNumber' | 'nationality' | 'birthYear' | 'height' | 'weight'>;

export function Avatar({ player, color, size = 48, cap = true }: { player: AvatarPlayer; color: string; size?: number; cap?: boolean }) {
  const ring = player.role === 'POR' ? GK_CAP : color;
  const src = faceFor(player.id, player.nationality, player.birthYear, player.height, player.weight);
  const showCap = cap && size >= 40;
  const capSize = Math.round(size * (size >= 100 ? 0.4 : 0.62));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${ring}66 0%, ${ring}22 70%), var(--color-deep)`,
          boxShadow: `0 0 0 ${size >= 64 ? 3 : 2}px ${ring}, 0 4px 10px -4px rgba(2,8,20,0.7)`,
        }}
      >
        <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover object-top" style={{ transform: 'scale(1.04)' }} />
      </span>
      {showCap && (
        <span className="absolute -bottom-2 -right-3">
          <Cap color={ring} number={player.capNumber || undefined} size={capSize} />
        </span>
      )}
    </span>
  );
}

/** Volto di un allenatore o di un membro dello staff. */
export function StaffAvatar({ id, size = 48, color = '#2ad0e6' }: { id: string; size?: number; color?: string }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 35%, ${color}55 0%, ${color}18 70%), var(--color-deep)`,
        boxShadow: `0 0 0 2px ${color}, 0 4px 10px -4px rgba(2,8,20,0.7)`,
      }}
      aria-hidden
    >
      <img src={staffFaceFor(id)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover object-top" style={{ transform: 'scale(1.04)' }} />
    </span>
  );
}
