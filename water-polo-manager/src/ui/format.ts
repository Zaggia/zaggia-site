import { fmtMoney } from '../engine/news';
import { formatDate, formatShortDate, seasonLabel } from '../engine/calendar';

export { fmtMoney, formatDate, formatShortDate, seasonLabel };

export function fmtK(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1).replace('.', ',')}M` : a >= 1000 ? `${Math.round(a / 1000)}k` : `${Math.round(a)}`;
  return `${v < 0 ? '−' : ''}${s} €`;
}

export function fmtNum(v: number, digits = 0): string {
  return v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Colore per un valore 1-100 (caratteristiche, overall). */
export function ratingColor(v: number): string {
  if (v >= 85) return '#22d3ee';
  if (v >= 75) return '#22c55e';
  if (v >= 62) return '#a3e635';
  if (v >= 50) return '#facc15';
  if (v >= 38) return '#f59e0b';
  return '#ef4444';
}

export function matchRatingColor(r: number): string {
  if (r >= 8) return '#22d3ee';
  if (r >= 7) return '#22c55e';
  if (r >= 6) return '#e8f1fb';
  if (r >= 5.5) return '#f59e0b';
  return '#ef4444';
}

export function moraleLabel(m: number): string {
  if (m >= 85) return 'Euforico';
  if (m >= 70) return 'Molto buono';
  if (m >= 55) return 'Buono';
  if (m >= 40) return 'Discreto';
  if (m >= 25) return 'Scontento';
  return 'Furioso';
}

export function personalityLabel(p: { professionalita: number; ambizione: number; lealta: number; temperamento: number }): string {
  if (p.professionalita >= 16 && p.temperamento <= 8) return 'Professionista modello';
  if (p.ambizione >= 16) return 'Molto ambizioso';
  if (p.lealta >= 16) return 'Leale';
  if (p.temperamento >= 16) return 'Irascibile';
  if (p.professionalita <= 6) return 'Poco professionale';
  if (p.ambizione <= 5) return 'Poco ambizioso';
  return 'Equilibrato';
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function contrastOn(hex: string): string {
  return luminance(hex) > 0.6 ? '#0b1220' : '#ffffff';
}

export function cls(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}
