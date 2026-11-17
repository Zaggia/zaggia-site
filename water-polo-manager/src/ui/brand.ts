// Identità visiva di "Water Polo Manager — The Road to Glory".
// Il marchio è generato da codice (SVG puro) così da essere identico nell'app, nella favicon
// e nei file del kit grafico in /brand (rigenerabili con `npm run brand`).

export const BRAND = {
  name: 'Water Polo Manager',
  tagline: 'The Road to Glory',
  colors: {
    abyss: '#050a14',
    navy: '#0b2a55',
    deep: '#10284a',
    aqua: '#22d3ee',
    pool: '#0369a1',
    gold: '#f5c518',
    goldLight: '#ffe680',
    goldDark: '#c99a00',
    blue: '#1747b8',
    foam: '#e0f7ff',
    ink: '#e8f1fb',
  },
  fonts: { display: 'Barlow Condensed', text: 'Inter', numbers: 'JetBrains Mono' },
} as const;

const C = BRAND.colors;
const SHIELD = 'M60 4 L112 16 V62 C112 94 88 114 60 124 C32 114 8 94 8 62 V16 Z';

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/**
 * Pallone da pallanuoto (centro 60,58 · raggio 27): giallo con tre spicchi blu a spirale
 * separati dai solchi, come i palloni ufficiali da gara.
 */
function ballSvg(id: (k: string) => string): string {
  const band = (rot: number) => `<g transform="rotate(${rot} 60 58)"><path d="M60 58 C60 44 70 32 92 28 L94 42 C78 44 68 50 60 58 Z" fill="${C.blue}"/><path d="M60 58 C60 44 70 32 92 28 M60 58 C68 50 78 44 94 42" fill="none" stroke="${C.navy}" stroke-width="1.3"/></g>`;
  return `<circle cx="60" cy="58" r="27" fill="url(#${id('ball')})"/>
<g clip-path="url(#${id('ballclip')})">${band(0)}${band(120)}${band(240)}</g>
<circle cx="60" cy="58" r="27" fill="url(#${id('shade')})"/>
<circle cx="60" cy="58" r="27" fill="none" stroke="${C.navy}" stroke-width="1.4"/>
<ellipse cx="48" cy="44" rx="7" ry="3.8" fill="#fff" fill-opacity="0.35" transform="rotate(-32 48 44)"/>`;
}

function ballDefs(id: (k: string) => string): string {
  return `<radialGradient id="${id('ball')}" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stop-color="${C.goldLight}"/><stop offset="0.55" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldDark}"/></radialGradient>
<radialGradient id="${id('shade')}" cx="0.38" cy="0.32" r="0.8"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/></radialGradient>
<clipPath id="${id('ballclip')}"><circle cx="60" cy="58" r="27"/></clipPath>`;
}

/** Onda ripetuta da x=0 a x=120 alla quota y, con ampiezza a. */
function wave(y: number, a: number): string {
  let d = `M0 ${y} Q10 ${y - a} 20 ${y}`;
  for (let x = 40; x <= 120; x += 20) d += ` T${x} ${y}`;
  return d;
}

/**
 * Stemma del gioco: scudo blu notte bordato d'oro, pallone da pallanuoto giallo con le cuciture blu
 * che emerge dall'acqua, tre stelle (la strada verso la gloria) e la corsia che converge all'orizzonte.
 */
export function logoMarkSvg(uid = 'wpm', opts: { title?: boolean } = {}): string {
  const id = (k: string) => `${uid}-${k}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 128" role="img" aria-label="${BRAND.name}">${opts.title ? `<title>${BRAND.name} — ${BRAND.tagline}</title>` : ''}
<defs>
<linearGradient id="${id('bg')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.deep}"/><stop offset="1" stop-color="${C.abyss}"/></linearGradient>
<linearGradient id="${id('water')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.aqua}"/><stop offset="1" stop-color="${C.pool}"/></linearGradient>
${ballDefs(id)}
<clipPath id="${id('clip')}"><path d="${SHIELD}"/></clipPath>
</defs>
<path d="${SHIELD}" fill="url(#${id('bg')})"/>
<g clip-path="url(#${id('clip')})">
<path d="M30 128 L56 76 M90 128 L64 76" stroke="${C.aqua}" stroke-opacity="0.22" stroke-width="2"/>
${ballSvg(id)}
<path d="${wave(80, 7)} V128 H0 Z" fill="url(#${id('water')})" fill-opacity="0.94"/>
<path d="${wave(94, 6)}" fill="none" stroke="${C.foam}" stroke-opacity="0.55" stroke-width="2.4"/>
<path d="${wave(107, 5)}" fill="none" stroke="${C.foam}" stroke-opacity="0.3" stroke-width="2"/>
</g>
<path d="${SHIELD}" fill="none" stroke="${C.gold}" stroke-width="3.5" stroke-linejoin="round"/>
<g fill="${C.gold}">
<path d="${star(41, 23, 4.2)}"/>
<path d="${star(60, 18, 5.4)}"/>
<path d="${star(79, 23, 4.2)}"/>
</g>
</svg>`;
}

/** Icona quadrata per favicon e app: pallone sull'acqua in un riquadro arrotondato. */
export function appIconSvg(): string {
  const id = (k: string) => `icon-${k}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<linearGradient id="${id('bg')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.deep}"/><stop offset="1" stop-color="${C.abyss}"/></linearGradient>
${ballDefs(id)}
<clipPath id="${id('c')}"><rect width="64" height="64" rx="14"/></clipPath>
</defs>
<g clip-path="url(#${id('c')})">
<rect width="64" height="64" fill="url(#${id('bg')})"/>
<g transform="translate(32 29) scale(0.66) translate(-60 -58)">${ballSvg(id)}</g>
<path d="M0 42 Q6 37 12 42 T24 42 T36 42 T48 42 T60 42 T72 42 V64 H0 Z" fill="${C.aqua}" fill-opacity="0.95"/>
<path d="M0 52 Q6 48 12 52 T24 52 T36 52 T48 52 T60 52 T72 52" fill="none" stroke="${C.foam}" stroke-opacity="0.6" stroke-width="2"/>
</g>
<rect x="1.5" y="1.5" width="61" height="61" rx="13" fill="none" stroke="${C.gold}" stroke-width="3"/>
</svg>`;
}

/** Logo orizzontale (stemma + scritta) per documenti e intestazioni. */
export function logoHorizontalSvg(): string {
  const mark = logoMarkSvg('h').replace('<svg ', '<svg x="0" y="4" width="112" height="120" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 128" role="img" aria-label="${BRAND.name}">
${mark}
<g font-family="${BRAND.fonts.display}, 'Arial Narrow', sans-serif" font-weight="800">
<text x="128" y="62" font-size="50" fill="${C.ink}" letter-spacing="1">WATER POLO</text>
<text x="128" y="104" font-size="44" fill="${C.aqua}" letter-spacing="1">MANAGER</text>
</g>
<text x="318" y="102" font-family="${BRAND.fonts.text}, sans-serif" font-weight="700" font-size="13" fill="${C.gold}" letter-spacing="3.5">THE ROAD TO GLORY</text>
</svg>`;
}
