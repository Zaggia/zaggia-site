// Marchio del gioco: stemma + scritta "WATER POLO MANAGER — THE ROAD TO GLORY".

import { useId, useMemo } from 'react';
import { BRAND, logoMarkSvg } from '../brand';
import { cls } from '../format';

export function LogoMark({ size = 48, className }: { size?: number; className?: string }) {
  const raw = useId();
  const uid = 'wpm' + raw.replace(/[^a-zA-Z0-9]/g, '');
  const svg = useMemo(() => logoMarkSvg(uid), [uid]);
  return (
    <span
      className={cls('inline-block shrink-0 [&>svg]:w-full [&>svg]:h-full drop-shadow-[0_6px_18px_rgba(34,211,238,0.18)]', className)}
      style={{ width: size, height: (size * 128) / 120 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<LogoSize, { mark: number; title: string; tag: string; gap: string }> = {
  sm: { mark: 30, title: 'text-lg', tag: 'text-[8px] tracking-[0.28em]', gap: 'gap-2' },
  md: { mark: 46, title: 'text-2xl', tag: 'text-[9px] tracking-[0.32em]', gap: 'gap-3' },
  lg: { mark: 76, title: 'text-4xl sm:text-5xl', tag: 'text-[11px] tracking-[0.36em]', gap: 'gap-4' },
  xl: { mark: 120, title: 'text-5xl sm:text-7xl', tag: 'text-xs tracking-[0.4em]', gap: 'gap-5' },
};

/** Logo completo. `stacked` mette lo stemma sopra la scritta (splash), altrimenti affiancato. */
export function Logo({ size = 'md', stacked = false, tagline = true, className }: { size?: LogoSize; stacked?: boolean; tagline?: boolean; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={cls('flex items-center', stacked ? 'flex-col text-center' : '', s.gap, className)} aria-label={`${BRAND.name} — ${BRAND.tagline}`}>
      <LogoMark size={s.mark} />
      <div className="min-w-0">
        <div className={cls('font-display font-extrabold leading-[0.88] tracking-tight', s.title)}>
          WATER POLO <span className="text-aqua">MANAGER</span>
        </div>
        {tagline && <div className={cls('mt-1.5 font-bold uppercase text-gold', s.tag)}>{BRAND.tagline}</div>}
      </div>
    </div>
  );
}
