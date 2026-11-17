import { useMemo, useState, type ReactNode } from 'react';
import { NATIONS } from '../../engine/data/names';
import { cls, ratingColor } from '../format';

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, title, className, type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'gold' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  const variants = {
    primary: 'bg-gradient-to-b from-aqua to-aqua-2 text-abyss hover:brightness-110 shadow-[0_6px_20px_-8px_#22d3ee]',
    ghost: 'text-mute hover:text-ink hover:bg-white/5',
    outline: 'border border-line-2 text-ink hover:border-aqua hover:text-aqua bg-white/[0.02]',
    danger: 'bg-bad/90 text-white hover:bg-bad',
    gold: 'bg-gradient-to-b from-gold to-amber-500 text-abyss hover:brightness-110',
    success: 'bg-good/90 text-abyss hover:bg-good',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cls(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

export function Panel({ title, children, actions, className, pad = true, subtitle }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; pad?: boolean; subtitle?: ReactNode }) {
  return (
    <section className={cls('panel fade-in min-w-0', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0">
            {title && <h3 className="font-display text-[15px] font-bold uppercase tracking-wider text-ink/90">{title}</h3>}
            {subtitle && <p className="text-xs text-mute mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'px-4 pb-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide leading-none">{title}</h1>
          {subtitle && <p className="text-sm text-mute mt-1.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'aqua' | 'gold' | 'violet'; className?: string; title?: string }) {
  const tones = {
    neutral: 'bg-white/5 text-mute border-white/10',
    good: 'bg-good/15 text-good border-good/30',
    bad: 'bg-bad/15 text-bad border-bad/30',
    warn: 'bg-warn/15 text-warn border-warn/30',
    aqua: 'bg-aqua/15 text-aqua border-aqua/30',
    gold: 'bg-gold/15 text-gold border-gold/30',
    violet: 'bg-violet/15 text-violet border-violet/30',
  };
  return <span title={title} className={cls('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Ovr({ v, size = 'md', range }: { v: number; size?: 'sm' | 'md' | 'lg'; range?: [number, number] }) {
  const s = { sm: 'w-8 h-6 text-xs', md: 'w-10 h-8 text-sm', lg: 'w-14 h-12 text-2xl' }[size];
  const c = ratingColor(v);
  return (
    <span className={cls('inline-flex items-center justify-center rounded-md font-display font-extrabold num', s)} style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
      {range && range[0] !== range[1] ? `${range[0]}-${range[1]}` : Math.round(v)}
    </span>
  );
}

export function Bar({ value, max = 100, color, height = 6, className }: { value: number; max?: number; color?: string; height?: number; className?: string }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cls('w-full rounded-full bg-white/[0.06] overflow-hidden', className)} style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color ?? ratingColor(value) }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'aqua'; icon?: ReactNode }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'aqua' ? 'text-aqua' : 'text-ink';
  return (
    <div className="panel-flat px-3.5 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mute font-semibold">{icon}{label}</div>
      <div className={cls('font-display text-2xl font-extrabold num mt-0.5 truncate', color)}>{value}</div>
      {sub && <div className="text-xs text-mute mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cls('flex gap-1 overflow-x-auto border-b border-line mb-4 -mx-1 px-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cls(
            'px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
            value === t.id ? 'border-aqua text-aqua' : 'border-transparent text-mute hover:text-ink',
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className="ml-1.5 rounded-full bg-aqua/20 text-aqua px-1.5 text-[10px]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
      <div
        className={cls('panel w-full max-h-[92vh] flex flex-col', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-mute hover:text-ink text-xl leading-none px-2" aria-label="Chiudi">×</button>
        </header>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-mute text-sm py-8 px-4">{children}</div>;
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
          <tr className="text-[11px] uppercase tracking-wider text-faint">
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                className={cls('text-left font-semibold px-2 py-2 border-b border-line whitespace-nowrap', c.sort && 'cursor-pointer hover:text-ink', c.hideOnMobile && 'hidden md:table-cell', c.className)}
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
              className={cls('border-b border-line/50 transition-colors', onRow && 'cursor-pointer hover:bg-white/[0.04]', rowClass?.(r))}
            >
              {columns.map((c) => (
                <td key={c.key} className={cls('px-2 border-b border-line/40 whitespace-nowrap', dense ? 'py-1.5' : 'py-2', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
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
      <span className="block text-xs font-semibold text-mute uppercase tracking-wider mb-1">{label}</span>
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
        <span key={i} className="w-6 text-center rounded text-[10px] font-bold num py-0.5" style={{ background: r >= 7 ? '#22c55e33' : r >= 6 ? '#ffffff14' : '#ef444433', color: r >= 7 ? '#22c55e' : r >= 6 ? '#e8f1fb' : '#ef4444' }}>
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
        <span key={i} className={cls('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', r === 'W' ? 'bg-good/80 text-abyss' : r === 'L' ? 'bg-bad/80 text-white' : 'bg-white/20 text-ink')}>
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
