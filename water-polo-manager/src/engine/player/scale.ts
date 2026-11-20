// Scala degli overall. Fino alla v12 le categorie minori stavano su valori bassi (A2 intorno a 55, B a 43, C a 35): ora sono
// più alte (A2 66, B 55, C 45, A1 78), ma i soldi (stipendi e valori) sono ancora quelli di prima, tarati sul bilancio dei club.
// `stretchOverall` porta un vecchio overall sulla scala nuova; `econOverall` fa il percorso inverso per calcolare stipendi e valori.

/** [vecchia scala, nuova scala]: interpolazione lineare tra i punti. */
const ANCHORS: [number, number][] = [[20, 29], [27, 36], [33, 45], [41, 55], [51, 66], [64, 72], [74, 78], [88, 90], [98, 99]];

function interp(x: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  const pts = ANCHORS;
  if (x <= pts[0][from]) return x + (pts[0][to] - pts[0][from]);
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][from]) {
      const [a, b] = [pts[i - 1], pts[i]];
      return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
    }
  }
  return x;
}

/** Vecchia scala → nuova scala (i valori alti non cambiano). */
export const stretchOverall = (old: number) => interp(old, 0);

/** Nuova scala → scala "economica" (quella con cui sono tarati stipendi e valori di mercato). */
export const econOverall = (now: number) => interp(now, 1);
