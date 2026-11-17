import { fmtK } from '../format';

export function LineChart({ values, height = 140, color = '#22d3ee', labels }: { values: number[]; height?: number; color?: string; labels?: string[] }) {
  if (values.length < 2) return <div className="text-mute text-sm py-6 text-center">Dati insufficienti: il grafico si riempie settimana dopo settimana.</div>;
  const w = 600;
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (w - 40) + 36;
  const y = (v: number) => height - 18 - ((v - min) / range) * (height - 30);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const zero = y(0);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="lcg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[max, (max + min) / 2, min].map((v, i) => (
        <g key={i}>
          <line x1="36" x2={w - 4} y1={y(v)} y2={y(v)} stroke="#1d3557" strokeDasharray="3 4" />
          <text x="2" y={y(v) + 4} fontSize="10" fill="#5d7898">{fmtK(v)}</text>
        </g>
      ))}
      {min < 0 && <line x1="36" x2={w - 4} y1={zero} y2={zero} stroke="#ef4444" strokeOpacity="0.5" />}
      <path d={`${d} L${x(values.length - 1)} ${height - 18} L${x(0)} ${height - 18} Z`} fill="url(#lcg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      {labels && labels.map((l, i) => (i % Math.ceil(labels.length / 6) === 0 ? <text key={i} x={x(i)} y={height - 4} fontSize="10" fill="#5d7898" textAnchor="middle">{l}</text> : null))}
    </svg>
  );
}

export function HBars({ items, color = '#22d3ee' }: { items: { label: string; value: number; color?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-mute">{it.label}</span>
            <span className="font-semibold num">{fmtK(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.color ?? color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Radar({ values, labels, size = 220, color = '#22d3ee' }: { values: number[]; labels: string[]; size?: number; color?: string }) {
  const n = values.length;
  const c = size / 2;
  const r = c - 34;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const poly = values.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}>
      {[25, 50, 75, 100].map((g) => (
        <polygon key={g} points={values.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="#1d3557" />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#1d3557" />;
      })}
      <polygon points={poly} fill={color} fillOpacity="0.25" stroke={color} strokeWidth="2" />
      {labels.map((l, i) => {
        const [x, y] = pt(i, 122);
        return <text key={l} x={x} y={y + 3} fontSize="10" textAnchor="middle" fill="#8ea6c4">{l}</text>;
      })}
    </svg>
  );
}
