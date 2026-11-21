// Calottine da pallanuoto: immagine generata con l'AI, colorata via CSS con i colori del club.
// Regolamento: una squadra in calottina scura, l'altra in chiara; i portieri sempre in rosso.

import capImg from '../../assets/art/cap.webp';
import { contrastOn } from '../format';

export const GK_CAP = '#d62828';

export function Cap({ color, number, size = 64, title }: { color: string; accent?: string; number?: number | string; size?: number; title?: string }) {
  const ink = contrastOn(color);
  const mask = `url(${capImg})`;
  return (
    <span
      className="relative inline-block shrink-0 align-middle"
      style={{ width: size, height: size, filter: 'drop-shadow(0 2px 2px rgba(2,8,20,0.55)) brightness(1.18) saturate(1.15)' }}
      role="img"
      aria-label={title ?? 'Calottina'}
      title={title}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: color,
          backgroundImage: mask,
          backgroundBlendMode: 'multiply',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      {number != null && (
        <span
          className="absolute left-[42%] top-[20%] -translate-x-1/2 font-display font-extrabold leading-none"
          style={{ fontSize: size * 0.36, color: ink, textShadow: ink === '#ffffff' ? '0 1px 1px rgba(0,0,0,0.6)' : '0 1px 0 rgba(255,255,255,0.5)' }}
        >
          {number}
        </span>
      )}
    </span>
  );
}

/** Le tre calottine della società: scura (casa), chiara (trasferta) e portiere. */
export function ClubCaps({ colors, size = 64 }: { colors: [string, string]; size?: number }) {
  const [primary, secondary] = colors;
  const lightIsSecondary = luminance(secondary) > luminance(primary);
  const dark = lightIsSecondary ? primary : secondary;
  const light = lightIsSecondary ? secondary : primary;
  const items = [
    { label: 'Calottina scura', color: luminance(dark) > 0.45 ? '#0b1f3a' : dark, n: 7 },
    { label: 'Calottina chiara', color: luminance(light) < 0.55 ? '#f4f7fb' : light, n: 7 },
    { label: 'Portiere', color: GK_CAP, n: 1 },
  ];
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((c) => (
        <div key={c.label} className="flex flex-col items-center gap-1">
          <Cap color={c.color} number={c.n} size={size} title={c.label} />
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
