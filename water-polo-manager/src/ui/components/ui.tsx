import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NATIONS } from '../../engine/data/names';
import { cls, ratingColor } from '../format';
import { Icon, GameIcon } from './icons';
import type { GameIconName } from '../gameIcons';

/** Se un pulsante non ha un'icona, ne sceglie una dalla parola iniziale: ogni azione ha il suo simbolo riconoscibile. */
const AUTO_ICONS: [RegExp, string][] = [
  [/^(Annulla|Chiudi|Rifiuta|Elimina|Esonera|Licenzia|Svincola|Rinuncia|Estingui|Azzera)/i, 'cross'],
  [/^(Salva|Esporta|Importa)/i, 'save'],
  [/^(Firma|Conferma|Accetta|Applica|Assumi|Rinnova|Carica|Promuovi|Chiedi|Investi|Amplia|Invia|Scegli|Proponi|Controfferta|Fai |Tratta|Migliora|Sincronizza|Accedi|Crea)/i, 'check'],
  [/^(Avanti|Prosegui|Continua|Apri|Vai|Prepara|Completa|Tabellino|Tutt)/i, 'next'],
  [/^(Indietro|Torna)/i, 'back'],
  [/^(Gioca|Segui|Riprendi|Inizia|Simula)/i, 'play'],
  [/^Pausa/i, 'pause'],
  [/^(Rinomina|Nomina)/i, 'star'],
];
function iconForLabel(label: string): string | undefined {
  for (const [re, ic] of AUTO_ICONS) if (re.test(label)) return ic;
  return undefined;
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, title, className, type = 'button', icon,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'gold' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
  /** Nome di un'icona (vedi icons.tsx): rende il pulsante più riconoscibile a colpo d'occhio. */
  icon?: string | null;
}) {
  const autoIcon = icon === undefined && typeof children === 'string' ? iconForLabel(children) : undefined;
  const shownIcon = icon === null ? undefined : icon ?? autoIcon;
  const base = 'inline-flex items-center justify-center gap-2 font-bold tracking-tight disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-aqua';
  const sizes = { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-sm', lg: 'h-14 px-7 text-base' };
  const iconSize = { sm: 15, md: 18, lg: 22 }[size];
  const variants = {
    primary: 'btn bg-gradient-to-b from-[#5ae9fb] to-[#1fc3dd] text-[#032a3a] [--btn-edge:#0a7f97]',
    gold: 'btn bg-gradient-to-b from-[#ffdb6b] to-[#f5b11c] text-[#3a2600] [--btn-edge:#a56d00]',
    success: 'btn bg-gradient-to-b from-[#62ec9d] to-[#27c264] text-[#04301a] [--btn-edge:#12803f]',
    danger: 'btn bg-gradient-to-b from-[#ff8392] to-[#ee4257] text-white [--btn-edge:#98192b]',
    outline: 'btn bg-gradient-to-b from-[#2a5aa8] to-[#1d4488] text-ink [--btn-edge:#0d2655]',
    ghost: 'rounded-2xl bg-white/10 text-ink/90 border-2 border-white/10 hover:bg-white/20 hover:text-white transition-colors active:scale-[0.97]',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cls(base, sizes[size], variants[variant], className)}>
      {shownIcon && <Icon name={shownIcon} size={iconSize} weight="bold" />}
      {children}
    </button>
  );
}

export function Panel({ title, children, actions, className, pad = true, subtitle, icon }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; pad?: boolean; subtitle?: ReactNode; icon?: string }) {
  return (
    <section className={cls('panel fade-in min-w-0', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1 basis-[15rem]">
            {icon && <IconTile name={icon} size={36} />}
            <div className="min-w-0">
              {title && <h3 className="font-display text-[22px] font-bold uppercase tracking-wide leading-tight text-ink">{title}</h3>}
              {subtitle && <p className="text-[13px] text-mute mt-0.5 leading-relaxed">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

/** Icona dentro una tessera tonda colorata: usata per titoli, menu e statistiche. */
export function IconTile({ name, size = 40, tone = 'aqua', className }: { name: string; size?: number; tone?: 'aqua' | 'gold' | 'good' | 'bad' | 'violet' | 'warn'; className?: string }) {
  const tones = {
    aqua: 'from-[#5ae9fb] to-[#1fa9d6] text-[#04334a]',
    gold: 'from-[#ffdb6b] to-[#f5a51c] text-[#4a2e00]',
    good: 'from-[#62ec9d] to-[#22b95e] text-[#053a1f]',
    bad: 'from-[#ff8392] to-[#e63a52] text-white',
    violet: 'from-[#c9b0ff] to-[#8a63f0] text-[#2a1260]',
    warn: 'from-[#ffc16b] to-[#f08a1c] text-[#4a2400]',
  };
  return (
    <span
      className={cls('inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_3px_0_rgba(0,0,0,0.3)]', tones[tone], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon name={name} size={Math.round(size * 0.55)} weight="bold" />
    </span>
  );
}

const TITLE_ICONS: Record<string, GameIconName> = {
  Calendario: 'calendar', Classifica: 'standings', Finanze: 'finance', Sponsor: 'sponsor', 'Posta e decisioni': 'mail', Notizie: 'news',
  Tattiche: 'board', Salvataggi: 'save', Competizioni: 'world', Strutture: 'stadium', Mercato: 'market', Partite: 'match',
  'Settore giovanile': 'youth', 'Allenatore e staff': 'coach', Rosa: 'squad', Formazione: 'tactics',
};

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  const auto = typeof title === 'string' && TITLE_ICONS[title] ? <GameIcon name={TITLE_ICONS[title]} size={56} /> : null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon ?? auto}
        <div className="min-w-0">
          <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wide leading-none drop-shadow-[0_3px_0_rgba(4,14,36,0.5)]">{title}</h1>
          {subtitle && <p className="text-[15px] text-mute mt-2">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'aqua' | 'gold' | 'violet'; className?: string; title?: string }) {
  const tones = {
    neutral: 'bg-white/10 text-ink/80 border-white/15',
    good: 'bg-good/20 text-good border-good/40',
    bad: 'bg-bad/20 text-[#ff8f9c] border-bad/45',
    warn: 'bg-warn/20 text-warn border-warn/45',
    aqua: 'bg-aqua/20 text-aqua border-aqua/45',
    gold: 'bg-gold/20 text-gold border-gold/45',
    violet: 'bg-violet/20 text-violet border-violet/45',
  };
  return <span title={title} className={cls('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Ovr({ v, size = 'md', range }: { v: number; size?: 'sm' | 'md' | 'lg'; range?: [number, number] }) {
  const isRange = !!range && range[0] !== range[1];
  const s = isRange
    ? { sm: 'min-w-9 px-2 h-7 text-xs', md: 'min-w-11 px-2.5 h-9 text-sm', lg: 'min-w-16 px-3 h-14 text-xl' }[size]
    : { sm: 'w-9 h-7 text-[13px]', md: 'w-11 h-9 text-base', lg: 'w-16 h-14 text-3xl' }[size];
  const c = ratingColor(v);
  return (
    <span
      className={cls('inline-flex items-center justify-center rounded-xl font-display font-extrabold num whitespace-nowrap', s)}
      style={{ background: `linear-gradient(180deg, ${c}55 0%, ${c}22 100%)`, color: '#fff', border: `2px solid ${c}`, boxShadow: `0 2px 0 ${c}66`, textShadow: '0 1px 0 rgba(0,0,0,0.35)' }}
    >
      {range && range[0] !== range[1] ? `${range[0]}-${range[1]}` : Math.round(v)}
    </span>
  );
}

export function Bar({ value, max = 100, color, height = 6, className }: { value: number; max?: number; color?: string; height?: number; className?: string }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cls('w-full rounded-full bg-black/25 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]', className)} style={{ height: Math.max(height, 8) }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color ?? ratingColor(value) }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'aqua'; icon?: ReactNode }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-[#ff8f9c]' : tone === 'warn' ? 'text-warn' : tone === 'aqua' ? 'text-aqua' : 'text-ink';
  return (
    <div className="panel-flat px-4 py-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[13px] text-mute font-semibold">{icon}{label}</div>
      <div className={cls('font-display text-[32px] leading-tight font-extrabold num mt-0.5 truncate', color)}>{value}</div>
      {sub && <div className="text-xs text-faint mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cls('flex gap-2 overflow-x-auto mb-5 pb-1 -mx-1 px-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cls(
            'press px-4 h-10 rounded-full text-sm font-bold whitespace-nowrap transition-all',
            value === t.id
              ? 'bg-gradient-to-b from-[#5ae9fb] to-[#1fc3dd] text-[#032a3a] shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_3px_0_#0a7f97]'
              : 'bg-white/10 text-mute hover:bg-white/15 hover:text-ink border border-white/10',
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className={cls('ml-2 rounded-full px-2 text-[11px]', value === t.id ? 'bg-[#032a3a]/25' : 'bg-aqua/25 text-aqua')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  // Esc chiude la finestra e la pagina sotto non scorre mentre è aperta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  // Portale su <body>: un antenato con animazione o transform (come i pannelli) farebbe diventare
  // "fixed" relativo a lui, e la finestra finirebbe centrata su un pannello alto, fuori dallo schermo.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#020a1c]/70 backdrop-blur-sm fade-in" onClick={onClose}>
      <div
        className={cls('panel w-full max-h-[92vh] flex flex-col !rounded-b-none sm:!rounded-b-[24px]', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <header className="flex items-center justify-between px-6 py-4 border-b-2 border-white/10">
          <h2 className="font-display text-[28px] font-extrabold uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="press flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-ink hover:bg-bad/80 transition-colors" aria-label="Chiudi"><Icon name="cross" size={18} weight="bold" /></button>
        </header>
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
        {footer && <footer className="px-6 py-4 border-t-2 border-white/10 flex flex-wrap justify-end gap-2.5">{footer}</footer>}
      </div>
    </div>
  , document.body);
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-mute text-sm py-10 px-4 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03]">{children}</div>;
}

export function Flag({ code, withName }: { code: string; withName?: boolean }) {
  const n = NATIONS[code];
  return (
    <span className="inline-flex items-center gap-1" title={n?.name ?? code}>
      <span>{n?.flag ?? '🏳️'}</span>
      {withName && <span className="text-mute text-xs">{n?.name ?? code}</span>}
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  className?: string;
  hideOnMobile?: boolean;
  title?: string;
}

export function DataTable<T>({
  rows, columns, rowKey, onRow, initialSort, initialDir = 'desc', rowClass, dense, empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  onRow?: (r: T) => void;
  initialSort?: string;
  initialDir?: 'asc' | 'desc';
  rowClass?: (r: T) => string;
  dense?: boolean;
  empty?: ReactNode;
}) {
  const [sortKey, setSortKey] = useState(initialSort);
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const s = [...rows].sort((a, b) => {
      const va = col.sort!(a);
      const vb = col.sort!(b);
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return dir === 'desc' ? s.reverse() : s;
  }, [rows, columns, sortKey, dir]);
  if (!rows.length) return <Empty>{empty ?? 'Nessun dato.'}</Empty>;
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11.5px] uppercase tracking-wider text-faint">
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                className={cls('text-left font-bold px-3 py-2.5 border-b-2 border-white/10 whitespace-nowrap', c.sort && 'cursor-pointer hover:text-ink', c.hideOnMobile && 'hidden md:table-cell', c.className)}
                onClick={() => {
                  if (!c.sort) return;
                  if (sortKey === c.key) setDir(dir === 'asc' ? 'desc' : 'asc');
                  else { setSortKey(c.key); setDir('desc'); }
                }}
              >
                {c.label}
                {sortKey === c.key && <span className="ml-1 text-aqua">{dir === 'desc' ? '▼' : '▲'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRow ? () => onRow(r) : undefined}
              className={cls('border-b border-line/50 transition-colors', onRow && 'cursor-pointer hover:bg-aqua/10', rowClass?.(r))}
            >
              {columns.map((c) => (
                <td key={c.key} className={cls('px-3 border-b border-white/[0.07] whitespace-nowrap', dense ? 'py-2' : 'py-2.5', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-bold text-mute mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint mt-1">{hint}</span>}
    </label>
  );
}

export function Form({ form }: { form: number[] }) {
  if (!form.length) return <span className="text-faint text-xs">—</span>;
  return (
    <span className="inline-flex gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span key={i} className="w-7 text-center rounded-lg text-[11px] font-bold num py-0.5" style={{ background: r >= 7 ? '#22c55e33' : r >= 6 ? '#ffffff14' : '#ef444433', color: r >= 7 ? '#22c55e' : r >= 6 ? '#e8f1fb' : '#ef4444' }}>
          {r.toFixed(1)}
        </span>
      ))}
    </span>
  );
}

export function ResultDots({ recent }: { recent: string[] }) {
  return (
    <span className="inline-flex gap-1">
      {recent.slice(-5).map((r, i) => (
        <span key={i} className={cls('w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center', r === 'W' ? 'bg-good/80 text-abyss' : r === 'L' ? 'bg-bad/80 text-white' : 'bg-white/20 text-ink')}>
          {r === 'W' ? 'V' : r === 'L' ? 'S' : 'P'}
        </span>
      ))}
    </span>
  );
}

export function Kv({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-line/40 last:border-0 text-sm">
      <span className="text-mute">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}

/** Piccolo aiuto contestuale: icona "i" che mostra una spiegazione al passaggio del mouse o al tocco. */
export function HelpTip({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cls('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label="Spiegazione"
        className="text-faint hover:text-aqua transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-40 left-1/2 -translate-x-1/2 top-6 w-64 rounded-2xl border-2 border-line-2 bg-night px-3.5 py-2.5 text-xs font-normal normal-case tracking-normal text-mute leading-relaxed shadow-2xl">
          {children}
        </span>
      )}
    </span>
  );
}

/** Intestazione illustrata: immagine 2D a destra, testo a sinistra su sfumatura. */
export function ArtBanner({ image, title, children, actions, className, height = 'min-h-44 sm:min-h-52' }: { image: string; title: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string; height?: string }) {
  return (
    <section className={cls('panel relative overflow-hidden fade-in', height, className)}>
      <img src={image} alt="" className="absolute inset-y-0 right-0 h-full w-full sm:w-[72%] object-cover object-center" loading="lazy" />
      <div className="absolute inset-0 art-fade-left" />
      <div className="absolute inset-0 bg-panel/60 sm:hidden" />
      <div className="relative min-h-[inherit] flex flex-col justify-center gap-2 px-5 sm:px-7 py-5 max-w-xl">
        <h1 className="font-display text-[34px] sm:text-[40px] font-extrabold uppercase tracking-wide leading-none">{title}</h1>
        {children && <div className="text-sm text-mute leading-relaxed">{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 mt-2">{actions}</div>}
      </div>
    </section>
  );
}
