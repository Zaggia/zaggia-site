import type { Player } from '../../engine/types';
import { contrastOn } from '../format';

const SKIN = ['#f3d2b8', '#e9c09f', '#d9a77f', '#c18a63', '#9a6a48', '#7a4f33'];
const NATION_SKIN: Record<string, number[]> = { BRA: [2, 3, 4, 5], USA: [0, 1, 2, 4, 5], AUS: [0, 1], JPN: [1, 2], TUR: [1, 2, 3], GEO: [1, 2] };

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Avatar stilizzato con la calottina da pallanuoto (rossa per i portieri). */
export function Avatar({ player, color, size = 48 }: { player: Pick<Player, 'id' | 'role' | 'capNumber' | 'nationality'>; color: string; size?: number }) {
  const h = hash(player.id);
  const choices = NATION_SKIN[player.nationality] ?? [0, 1, 1, 2, 2, 3];
  const skin = SKIN[choices[h % choices.length]];
  const cap = player.role === 'POR' ? '#d62828' : color;
  const ink = contrastOn(cap);
  const brow = h % 3;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="shrink-0">
      <defs>
        <radialGradient id={`bg${h}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1b4a73" />
          <stop offset="100%" stopColor="#0a1a2e" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#bg${h})`} />
      <path d="M8 64 C10 50 20 46 32 46 C44 46 54 50 56 64 Z" fill={skin} opacity="0.9" />
      <ellipse cx="32" cy="32" rx="15" ry="17" fill={skin} />
      <g fill="#1b1b1b" opacity="0.85">
        <ellipse cx="26" cy="33" rx="1.8" ry="2.1" />
        <ellipse cx="38" cy="33" rx="1.8" ry="2.1" />
      </g>
      <path d={brow === 0 ? 'M23 29 L29 28.5 M35 28.5 L41 29' : brow === 1 ? 'M23 28.5 Q26 27 29 28.5 M35 28.5 Q38 27 41 28.5' : 'M23 29.5 L29 28 M35 28 L41 29.5'} stroke="#2a1a10" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M28 41 Q32 43.5 36 41" stroke="#7a3b2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M16 28 C16 14 24 10 32 10 C40 10 48 14 48 28 C44 24 38 22 32 22 C26 22 20 24 16 28 Z" fill={cap} />
      <circle cx="16.5" cy="33" r="5.2" fill={cap} />
      <circle cx="47.5" cy="33" r="5.2" fill={cap} />
      <circle cx="16.5" cy="33" r="2.8" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="47.5" cy="33" r="2.8" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="1" />
      <path d="M21 33 Q20 42 26 46" stroke={cap} strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M43 33 Q44 42 38 46" stroke={cap} strokeWidth="1.6" fill="none" opacity="0.8" />
      <text x="32" y="20" textAnchor="middle" fontSize="9" fontWeight="800" fill={ink} fontFamily="Barlow Condensed, Inter, sans-serif">
        {player.capNumber || ''}
      </text>
    </svg>
  );
}
