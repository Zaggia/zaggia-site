import {
  ALL_ATTRS, GK_ATTRS, MENT_ATTRS, PHYS_ATTRS, TECH_ATTRS,
  type AttrGroup, type AttrKey, type Attributes, type Role,
} from '../types';
import { clamp } from '../util';

export const ATTR_LABELS: Record<AttrKey, string> = {
  tiro: 'Tiro',
  potenzaTiro: 'Potenza di tiro',
  precisione: 'Precisione',
  passaggio: 'Passaggio',
  visione: 'Visione di gioco',
  controlloPalla: 'Controllo palla',
  dribbling: 'Dribbling',
  smarcamento: 'Smarcamento',
  giocoCentro: 'Gioco al centro',
  marcatura: 'Marcatura',
  contrasto: 'Contrasto',
  superiorita: 'Superiorità numerica',
  inferiorita: 'Inferiorità numerica',
  velocita: 'Velocità di nuotata',
  accelerazione: 'Accelerazione',
  resistenza: 'Resistenza',
  forza: 'Forza',
  elevazione: 'Elevazione',
  agilita: 'Agilità',
  recupero: 'Recupero fisico',
  concentrazione: 'Concentrazione',
  leadership: 'Leadership',
  intelligenzaTattica: 'Intelligenza tattica',
  decisioni: 'Decision making',
  determinazione: 'Determinazione',
  freddezza: 'Freddezza',
  pressione: 'Gestione della pressione',
  riflessi: 'Riflessi',
  piazzamento: 'Piazzamento',
  uscite: 'Uscite (1 contro 1)',
  rinvio: 'Rinvio e lancio',
};

export const ATTR_GROUPS: Record<AttrGroup, readonly AttrKey[]> = {
  tecnica: TECH_ATTRS,
  fisico: PHYS_ATTRS,
  mentale: MENT_ATTRS,
  portiere: GK_ATTRS,
};

export const GROUP_LABELS: Record<AttrGroup, string> = {
  tecnica: 'Tecnica',
  fisico: 'Fisico',
  mentale: 'Mentale',
  portiere: 'Portiere',
};

export function attrGroupOf(key: AttrKey): AttrGroup {
  if ((TECH_ATTRS as readonly string[]).includes(key)) return 'tecnica';
  if ((PHYS_ATTRS as readonly string[]).includes(key)) return 'fisico';
  if ((MENT_ATTRS as readonly string[]).includes(key)) return 'mentale';
  return 'portiere';
}

export const ROLE_LABELS: Record<Role, string> = {
  POR: 'Portiere',
  CEN: 'Centroboa',
  DIF: 'Difensore',
  CVA: 'Centrovasca',
  MAN: 'Mancino',
  ALA: 'Ala',
  UNI: 'Universale',
};

/** Sigle dei ruoli della pallanuoto. */
export const ROLE_SHORT: Record<Role, string> = {
  POR: 'POR',
  CEN: 'BOA',
  DIF: 'DIF',
  CVA: 'CV',
  MAN: 'MAN',
  ALA: 'ALA',
  UNI: 'UNI',
};

/** Descrizione dei ruoli (in acqua le posizioni d'attacco sono numerate da 1 a 6). */
export const ROLE_DESC: Record<Role, string> = {
  POR: 'Difende la porta e lancia i contropiedi.',
  CEN: 'Gioca spalle alla porta in posizione 6: tira dai due metri e guadagna espulsioni.',
  DIF: 'Specialista della difesa: marca gli attaccanti più pericolosi e il centroboa; in attacco lavora sui lati.',
  CVA: 'Gioca in posizione 3 davanti al centroboa: imposta, tira da fuori e in difesa marca il boa avversario.',
  MAN: 'Tiratore mancino del lato destro (posizioni 1 e 2), decisivo in superiorità.',
  ALA: 'Gioca vicino ai pali (posizioni 1 e 5): tiri angolati e inserimenti.',
  UNI: 'Jolly capace di coprire tutte le posizioni di movimento.',
};

export const ROLES: Role[] = ['POR', 'CEN', 'DIF', 'CVA', 'MAN', 'ALA', 'UNI'];

/**
 * Pesi per il calcolo dell'overall: NON è la media di tutte le statistiche.
 * Ogni ruolo dà importanza alle caratteristiche che contano davvero in acqua.
 */
export const ROLE_WEIGHTS: Record<Role, Partial<Record<AttrKey, number>>> = {
  POR: {
    riflessi: 0.27, piazzamento: 0.21, uscite: 0.12, rinvio: 0.07, concentrazione: 0.08, agilita: 0.06,
    elevazione: 0.09, freddezza: 0.04, pressione: 0.03, leadership: 0.03,
  },
  CEN: {
    giocoCentro: 0.22, forza: 0.18, tiro: 0.1, precisione: 0.08, controlloPalla: 0.06, smarcamento: 0.06,
    freddezza: 0.05, superiorita: 0.06, determinazione: 0.04, resistenza: 0.04, intelligenzaTattica: 0.04,
    potenzaTiro: 0.04, agilita: 0.03,
  },
  DIF: {
    marcatura: 0.2, forza: 0.18, contrasto: 0.14, inferiorita: 0.08, intelligenzaTattica: 0.08, resistenza: 0.06,
    concentrazione: 0.06, elevazione: 0.05, agilita: 0.05, velocita: 0.04, determinazione: 0.04, passaggio: 0.02,
  },
  MAN: {
    tiro: 0.16, potenzaTiro: 0.12, precisione: 0.14, smarcamento: 0.08, superiorita: 0.1, velocita: 0.08, dribbling: 0.06,
    controlloPalla: 0.06, freddezza: 0.06, decisioni: 0.06, resistenza: 0.04, passaggio: 0.04,
  },
  CVA: {
    passaggio: 0.14, visione: 0.14, tiro: 0.1, potenzaTiro: 0.1, intelligenzaTattica: 0.1, decisioni: 0.08, controlloPalla: 0.08,
    marcatura: 0.06, resistenza: 0.06, superiorita: 0.06, leadership: 0.04, velocita: 0.04,
  },
  ALA: {
    tiro: 0.14, precisione: 0.14, smarcamento: 0.1, velocita: 0.12, accelerazione: 0.08, agilita: 0.06, dribbling: 0.08,
    superiorita: 0.08, controlloPalla: 0.06, freddezza: 0.06, resistenza: 0.04, elevazione: 0.04,
  },
  UNI: {
    tiro: 0.08, passaggio: 0.08, visione: 0.08, marcatura: 0.08, velocita: 0.08, resistenza: 0.08,
    intelligenzaTattica: 0.08, contrasto: 0.06, decisioni: 0.06, superiorita: 0.06, inferiorita: 0.06,
    controlloPalla: 0.06, forza: 0.06, smarcamento: 0.04, precisione: 0.04,
  },
};

/** Overall pesato per ruolo, con una leggera penalità per i punti deboli gravi. */
export function computeOverall(attrs: Attributes, role: Role): number {
  const w = ROLE_WEIGHTS[role];
  let total = 0;
  let wsum = 0;
  let weakest = 100;
  for (const k in w) {
    const key = k as AttrKey;
    const weight = w[key]!;
    total += attrs[key] * weight;
    wsum += weight;
    if (weight >= 0.08) weakest = Math.min(weakest, attrs[key]);
  }
  const base = total / wsum;
  // Un punto debole marcato in una caratteristica chiave abbassa leggermente il rendimento complessivo.
  const penalty = Math.max(0, base - weakest - 20) * 0.08;
  return clamp(Math.round(base - penalty), 1, 99);
}

/** Overall che il giocatore avrebbe in un altro ruolo (utile per adattamenti). */
export function overallInRole(attrs: Attributes, role: Role): number {
  return computeOverall(attrs, role);
}

/**
 * Posizioni in acqua (numerazione classica della pallanuoto): 0 portiere, 1 ala destra, 2 lato destro, 3 centrovasca,
 * 4 lato sinistro, 5 ala sinistra, 6 centroboa (al due metri).
 */
export const SLOT_LABELS = ['Portiere', 'Posizione 1 · ala destra', 'Posizione 2 · lato destro', 'Posizione 3 · centrovasca', 'Posizione 4 · lato sinistro', 'Posizione 5 · ala sinistra', 'Posizione 6 · centroboa'];
export const SLOT_SHORT = ['POR', '1', '2', '3', '4', '5', '6'];
export const SLOT_NAMES = ['Portiere', 'Ala destra', 'Lato destro', 'Centrovasca', 'Lato sinistro', 'Ala sinistra', 'Centroboa'];

const SUIT: Record<Role, number[]> = {
  //      P     1     2     3     4     5     6
  POR: [1.0, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
  CEN: [0.15, 0.7, 0.72, 0.8, 0.72, 0.7, 1.0],
  DIF: [0.15, 0.74, 0.88, 0.95, 0.88, 0.74, 0.82],
  CVA: [0.15, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7],
  MAN: [0.15, 1.0, 1.0, 0.86, 0.8, 0.76, 0.68],
  ALA: [0.15, 1.0, 0.88, 0.75, 0.88, 1.0, 0.68],
  UNI: [0.15, 0.92, 0.95, 0.95, 0.95, 0.92, 0.85],
};

/** Adattamento di un giocatore a una posizione in acqua (0-1), tenendo conto della mano preferita. */
export function slotSuitability(role: Role, hand: 'R' | 'L', slot: number): number {
  let s = SUIT[role][slot];
  if (slot === 1 || slot === 2) s *= hand === 'L' ? 1.03 : 0.95;
  if (slot === 4 || slot === 5) s *= hand === 'R' ? 1.0 : 0.94;
  return Math.min(1.03, s);
}

export function bestSlotsForRole(role: Role): number[] {
  return SUIT[role]
    .map((v, i) => [v, i] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
}

export function emptyAttributes(v = 1): Attributes {
  const a = {} as Attributes;
  for (const k of ALL_ATTRS) a[k] = v;
  return a;
}

export function attrAverage(attrs: Attributes, keys: readonly AttrKey[]): number {
  let s = 0;
  for (const k of keys) s += attrs[k];
  return s / keys.length;
}
