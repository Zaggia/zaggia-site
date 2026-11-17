// Calottine da pallanuoto: l'elemento più riconoscibile dell'identità di una squadra in acqua.
// Regolamento: una squadra in calottina scura, l'altra in chiara; i portieri sempre in rosso.

import { useId } from 'react';
import { contrastOn } from '../format';

export const GK_CAP = '#d62828';

export function Cap({ color, accent, number, size = 64, title }: { color: string; accent?: string; number?: number | string; size?: number; title?: string }) {
  const raw = useId();
  const id = 'cap' + raw.replace(/[^a-zA-Z0-9]/g, '');
  const ink = contrastOn(color);
  const guard = accent ?? shade(color, -0.25);
  const holes = contrastOn(guard) === '#ffffff' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  return (
    <svg viewBox="0 0 100 96" width={size} height={(size * 96) / 100} role="img" aria-label={title ?? 'Calottina'}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(color, 0.18)} />
          <stop offset="1" stopColor={shade(color, -0.12)} />
        </linearGradient>
      </defs>
      <path d="M30 74 Q50 94 70 74" fill="none" stroke={guard} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M14 56 C14 26 31 8 50 8 C69 8 86 26 86 56 L86 62 C70 66 30 66 14 62 Z" fill={`url(#${id}-g)`} stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
      <path d="M22 26 C30 16 40 12 50 12" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
      {[22, 78].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={62} r={13} fill={guard} stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
          {[[-4, -4], [4, -4], [0, 0], [-4, 4], [4, 4]].map(([dx, dy], i) => <circle key={i} cx={cx + dx} cy={62 + dy} r={1.5} fill={holes} />)}
        </g>
      ))}
      {number != null && (
        <text x="50" y="45" textAnchor="middle" fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif" fontWeight="800" fontSize="26" fill={ink}>{number}</text>
      )}
    </svg>
  );
}

function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Le tre calottine della società: scura (casa), chiara (trasferta) e portiere. */
export function ClubCaps({ colors, size = 64 }: { colors: [string, string]; size?: number }) {
  const [primary, secondary] = colors;
  const lightIsSecondary = luminance(secondary) > luminance(primary);
  const dark = lightIsSecondary ? primary : secondary;
  const light = lightIsSecondary ? secondary : primary;
  const items = [
    { label: 'Calottina scura', color: luminance(dark) > 0.45 ? '#0b1f3a' : dark, accent: light, n: 7 },
    { label: 'Calottina chiara', color: luminance(light) < 0.55 ? '#f4f7fb' : light, accent: dark, n: 7 },
    { label: 'Portiere', color: GK_CAP, accent: dark, n: 1 },
  ];
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((c) => (
        <div key={c.label} className="flex flex-col items-center gap-1">
          <Cap color={c.color} accent={c.accent} number={c.n} size={size} title={c.label} />
          <span className="text-[11px] text-mute">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
