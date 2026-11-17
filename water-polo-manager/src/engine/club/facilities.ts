import type { Club, FacilityKey } from '../types';
import { clubLevel } from '../tactics/tactics';

export interface FacilityInfo {
  key: FacilityKey;
  name: string;
  desc: string;
  levels: string[];
  effect: (level: number) => string;
  /** Costo dell'ampliamento al livello indicato. */
  cost: (toLevel: number) => number;
  days: (toLevel: number) => number;
  /** Costo annuo di gestione/manutenzione per livello. */
  upkeep: (level: number) => number;
}

export const MAX_FACILITY_LEVEL = 5;

const costCurve = (base: number) => (lvl: number) => Math.round(base * Math.pow(2.6, lvl - 2) / 1000) * 1000;

export const FACILITIES: Record<FacilityKey, FacilityInfo> = {
  piscina: {
    key: 'piscina',
    name: 'Piscina principale',
    desc: 'Capienza delle tribune, qualità dell’impianto e possibilità di ospitare eventi.',
    levels: ['Vasca comunale (250 posti)', 'Impianto attrezzato (600 posti)', 'Piscina coperta moderna (1.500 posti)', 'Arena del nuoto (3.500 posti)', 'Stadio del nuoto (6.000 posti)'],
    effect: (l) => `${poolCapacity(l).toLocaleString('it-IT')} posti · fattore campo +${l * 2}% · eventi`,
    cost: costCurve(40_000),
    days: (l) => 60 + l * 30,
    upkeep: (l) => [6_000, 14_000, 30_000, 55_000, 100_000][l - 1],
  },
  allenamento: {
    key: 'allenamento',
    name: 'Centro di allenamento',
    desc: 'Corsie dedicate, video analisi, strumenti per la tattica.',
    levels: ['Due corsie in orari scomodi', 'Vasca dedicata', 'Centro con video analisi', 'Centro tecnico federale', 'Centro d’eccellenza'],
    effect: (l) => `Allenamento ×${(0.85 + l * 0.08).toFixed(2)} · capacità tattica +${(l - 1) * 3.75}`,
    cost: costCurve(30_000),
    days: (l) => 45 + l * 20,
    upkeep: (l) => [1_500, 5_000, 12_000, 24_000, 42_000][l - 1],
  },
  palestra: {
    key: 'palestra',
    name: 'Palestra',
    desc: 'Preparazione fisica, forza e prevenzione degli infortuni.',
    levels: ['Palestra comunale', 'Sala pesi', 'Palestra attrezzata', 'Centro di preparazione atletica', 'Laboratorio di performance'],
    effect: (l) => `Crescita fisica ×${(0.85 + l * 0.08).toFixed(2)} · infortuni −${(l - 1) * 6}%`,
    cost: costCurve(22_000),
    days: (l) => 30 + l * 15,
    upkeep: (l) => [1_000, 4_000, 9_000, 17_000, 30_000][l - 1],
  },
  medico: {
    key: 'medico',
    name: 'Centro medico',
    desc: 'Diagnosi, fisioterapia e riabilitazione.',
    levels: ['Medico a chiamata', 'Infermeria', 'Fisioterapia interna', 'Centro medico sportivo', 'Clinica di riabilitazione'],
    effect: (l) => `Recupero infortuni +${(l - 1) * 12}% · condizione +${l}`,
    cost: costCurve(25_000),
    days: (l) => 30 + l * 15,
    upkeep: (l) => [1_000, 4_000, 9_000, 17_000, 28_000][l - 1],
  },
  giovanile: {
    key: 'giovanile',
    name: 'Settore giovanile',
    desc: 'Squadre giovanili, allenatori dedicati e convenzioni con le scuole.',
    levels: ['Qualche ragazzo', 'Under 16 e Under 18', 'Vivaio strutturato', 'Accademia', 'Accademia d’élite'],
    effect: (l) => `${2 + l} giovani all’anno · qualità +${(l - 1) * 6}`,
    cost: costCurve(28_000),
    days: (l) => 45 + l * 20,
    upkeep: (l) => [2_500, 7_000, 16_000, 30_000, 52_000][l - 1],
  },
  scouting: {
    key: 'scouting',
    name: 'Centro scouting',
    desc: 'Rete di osservatori e database dei giocatori.',
    levels: ['Contatti locali', 'Rete regionale', 'Rete nazionale', 'Rete europea', 'Rete mondiale'],
    effect: (l) => `Precisione valutazioni +${(l - 1) * 10}% · ${['Italia', 'Italia', 'Italia ed Europa', 'Europa', 'Mondo'][l - 1]}`,
    cost: costCurve(18_000),
    days: (l) => 30 + l * 10,
    upkeep: (l) => [500, 3_000, 8_000, 15_000, 26_000][l - 1],
  },
  uffici: {
    key: 'uffici',
    name: 'Uffici societari',
    desc: 'Marketing, biglietteria, rapporti con gli sponsor.',
    levels: ['Segreteria volontaria', 'Ufficio stampa', 'Area marketing', 'Struttura manageriale', 'Holding sportiva'],
    effect: (l) => `Ricavi commerciali ×${(0.9 + l * 0.08).toFixed(2)} · slot sponsor ${sponsorSlots(l)}`,
    cost: costCurve(20_000),
    days: (l) => 30 + l * 10,
    upkeep: (l) => [1_000, 5_000, 11_000, 21_000, 38_000][l - 1],
  },
};

export const FACILITY_KEYS = Object.keys(FACILITIES) as FacilityKey[];

export function poolCapacity(level: number): number {
  return [250, 600, 1500, 3500, 6000][level - 1] ?? 250;
}

export function sponsorSlots(officeLevel: number): number {
  return officeLevel >= 4 ? 4 : officeLevel >= 2 ? 3 : 2;
}

/** Livello massimo costruibile in base al livello di sviluppo della società. */
export function maxFacilityLevel(club: Club): number {
  const lvl = clubLevel(club);
  return lvl >= 7 ? 5 : lvl >= 5 ? 4 : lvl >= 3 ? 3 : 2;
}

export function trainingFactor(club: Club): number {
  return 0.85 + club.facilities.allenamento.level * 0.08;
}

export function physicalFactor(club: Club): number {
  return 0.85 + club.facilities.palestra.level * 0.08;
}

export function commercialFactor(club: Club): number {
  return 0.9 + club.facilities.uffici.level * 0.08;
}

export function totalUpkeep(club: Club): number {
  let t = 0;
  for (const k of FACILITY_KEYS) t += FACILITIES[k].upkeep(club.facilities[k].level);
  return t;
}

export function upgradeCost(club: Club, key: FacilityKey): number {
  return FACILITIES[key].cost(club.facilities[key].level + 1);
}
