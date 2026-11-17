import { useId } from 'react';
import type { CrestSpec } from '../../engine/types';
import { contrastOn } from '../format';

const SHAPES: Record<CrestSpec['shape'], string> = {
  scudo: 'M50 4 L92 16 V52 C92 80 72 98 50 106 C28 98 8 80 8 52 V16 Z',
  scudoClassico: 'M10 8 H90 V50 C90 78 70 96 50 104 C30 96 10 78 10 50 Z',
  cerchio: 'M50 8 A47 47 0 1 1 49.9 8 Z',
  esagono: 'M50 4 L92 28 L92 82 L50 106 L8 82 L8 28 Z',
  rombo: 'M50 2 L98 55 L50 108 L2 55 Z',
};

function Symbol({ spec, color, uid }: { spec: CrestSpec; color: string; uid: string }) {
  switch (spec.symbol) {
    case 'palla':
      // Pallone da pallanuoto: tre spicchi a spirale (stesso disegno del marchio del gioco).
      return (
        <g transform="translate(50 56) scale(0.74) translate(-60 -58)">
          <clipPath id={`b${uid}`}><circle cx="60" cy="58" r="27" /></clipPath>
          <g clipPath={`url(#b${uid})`} fill={color}>
            {[0, 120, 240].map((r) => <path key={r} transform={`rotate(${r} 60 58)`} d="M60 58 C60 44 70 32 92 28 L94 42 C78 44 68 50 60 58 Z" />)}
          </g>
          <circle cx="60" cy="58" r="27" fill="none" stroke={color} strokeWidth="4.6" />
        </g>
      );
    case 'onda':
      return (
        <g stroke={color} strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M24 46 Q32 38 40 46 T56 46 T72 46 T80 46" />
          <path d="M24 60 Q32 52 40 60 T56 60 T72 60 T80 60" />
          <path d="M24 74 Q32 66 40 74 T56 74 T72 74 T80 74" />
        </g>
      );
    case 'tridente':
      return (
        <g stroke={color} strokeWidth="4.5" fill="none" strokeLinecap="round">
          <path d="M50 32 V84" />
          <path d="M34 34 V48 C34 58 66 58 66 48 V34" />
          <path d="M30 38 L34 30 L38 38 M46 34 L50 26 L54 34 M62 38 L66 30 L70 38" />
        </g>
      );
    case 'stella':
      return <path d="M50 30 L57 48 L76 49 L61 61 L66 80 L50 69 L34 80 L39 61 L24 49 L43 48 Z" fill={color} />;
    case 'delfino':
      return (
        <path
          d="M24 66 C30 46 50 36 70 40 L78 34 L76 44 C82 48 82 54 80 58 C70 54 60 56 54 62 L60 74 L48 66 C40 70 30 70 24 66 Z"
          fill={color}
        />
      );
    case 'corona':
      return <path d="M28 70 L28 44 L40 56 L50 38 L60 56 L72 44 L72 70 Z M28 74 H72 V80 H28 Z" fill={color} />;
    case 'faro':
      return (
        <g fill={color}>
          <path d="M44 40 H56 L60 80 H40 Z" />
          <path d="M42 34 H58 V40 H42 Z" />
          <path d="M28 30 L42 36 V38 L28 44 Z M72 30 L58 36 V38 L72 44 Z" opacity="0.7" />
        </g>
      );
    case 'iniziali':
    default:
      return (
        <text x="50" y="66" textAnchor="middle" fontSize={spec.initials.length > 2 ? 26 : 32} fontWeight="800" fill={color} fontFamily="Barlow Condensed, Inter, sans-serif">
          {spec.initials}
        </text>
      );
  }
}

export function Crest({ spec, size = 40, className }: { spec: CrestSpec; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const p = spec.primary;
  const s = spec.secondary;
  const shape = SHAPES[spec.shape] ?? SHAPES.scudo;
  let bg;
  switch (spec.pattern) {
    case 'strisce':
      bg = (
        <g>
          <rect width="100" height="110" fill={p} />
          {[0, 1, 2, 3, 4].map((i) => (i % 2 === 1 ? <rect key={i} x={i * 20} width="20" height="110" fill={s} /> : null))}
        </g>
      );
      break;
    case 'meta':
      bg = (
        <g>
          <rect width="50" height="110" fill={p} />
          <rect x="50" width="50" height="110" fill={s} />
        </g>
      );
      break;
    case 'banda':
      bg = (
        <g>
          <rect width="100" height="110" fill={p} />
          <path d="M0 20 L80 110 H100 V90 L20 0 H0 Z" fill={s} />
        </g>
      );
      break;
    case 'croce':
      bg = (
        <g>
          <rect width="100" height="110" fill={p} />
          <rect x="40" width="20" height="110" fill={s} />
          <rect y="45" width="100" height="20" fill={s} />
        </g>
      );
      break;
    case 'onde':
      bg = (
        <g>
          <rect width="100" height="110" fill={p} />
          <path d="M0 80 Q12.5 72 25 80 T50 80 T75 80 T100 80 V110 H0 Z" fill={s} opacity="0.9" />
        </g>
      );
      break;
    case 'bordo':
    case 'pieno':
    default:
      bg = <rect width="100" height="110" fill={p} />;
  }
  const symColor = spec.pattern === 'pieno' || spec.pattern === 'bordo' || spec.pattern === 'onde' ? s : contrastOn(p) === '#ffffff' ? '#ffffff' : '#0b1220';
  const symbolBacking = spec.pattern === 'strisce' || spec.pattern === 'meta' || spec.pattern === 'croce' || spec.pattern === 'banda';
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} className={className} aria-hidden>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>{bg}</g>
      {symbolBacking && <circle cx="50" cy="56" r="25" fill={p} stroke={s} strokeWidth="3" />}
      <Symbol uid={id} spec={spec} color={symbolBacking ? (spec.symbol === 'iniziali' ? contrastOn(p) : s) : symColor} />
      <path d={shape} fill="none" stroke={spec.pattern === 'bordo' ? s : 'rgba(255,255,255,0.35)'} strokeWidth={spec.pattern === 'bordo' ? 7 : 2.5} />
    </svg>
  );
}
