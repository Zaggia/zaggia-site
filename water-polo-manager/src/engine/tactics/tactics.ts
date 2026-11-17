// Tattiche della pallanuoto: definizioni, effetti sulla simulazione, requisiti di sblocco
// e affiatamento (familiarità) della squadra con ogni sistema di gioco.

import type {
  Club, CoachPhilosophy, DefenseTactic, ManDownStyle, ManUpCirculation, ManUpFormation, ManUpStrategy, OffenseTactic,
  TacticId, TacticsSetup, World,
} from '../types';
import { avg, clamp, topN } from '../util';

export interface TacticInfo {
  id: string;
  name: string;
  desc: string;
  pros: string[];
  cons: string[];
  /** Capacità organizzativa richiesta (0-100). */
  complexity: number;
  affinity: CoachPhilosophy[];
}

export interface OffenseEffects {
  tempo: number;
  turnover: number;
  exclusion: number;
  penalty: number;
  counter: number;
  counterAgainst: number;
  energy: number;
  mix: { distanza: number; centro: number; ala: number; penetrazione: number };
  quality: number;
  blockAgainst: number;
}

export interface DefenseEffects {
  steal: number;
  exclConceded: number;
  /** Fattori di concessione per zona di tiro: >1 concede di più, <1 chiude quella soluzione. */
  center: number;
  distance: number;
  wing: number;
  drive: number;
  counterFor: number;
  counterAgainst: number;
  energy: number;
  speedSensitivity: number;
  techSensitivity: number;
}

export const OFFENSE: Record<OffenseTactic, TacticInfo & { fx: OffenseEffects }> = {
  organizzato: {
    id: 'organizzato', name: 'Attacco organizzato', complexity: 0, affinity: ['equilibrato', 'difensivo'],
    desc: 'Possesso paziente, schemi codificati, tiro solo a difesa mossa.',
    pros: ['Poche palle perse', 'Pochi contropiedi concessi'], cons: ['Pochi contropiedi a favore', 'Ritmo basso'],
    fx: { tempo: 1.05, turnover: -0.18, exclusion: 0, penalty: 1, counter: -0.2, counterAgainst: -0.25, energy: 1.0, mix: { distanza: 1, centro: 1, ala: 0.8, penetrazione: 0.7 }, quality: 0.05, blockAgainst: 0 },
  },
  centroboa: {
    id: 'centroboa', name: 'Gioco sul centroboa', complexity: 22, affinity: ['equilibrato', 'superiorita'],
    desc: 'Tutto passa dal centroboa: tiro dai due metri o espulsione guadagnata.',
    pros: ['Molte espulsioni guadagnate', 'Rigori'], cons: ['Soffre zona e raddoppio', 'Dipende da un solo giocatore'],
    fx: { tempo: 1.08, turnover: 0.05, exclusion: 0.35, penalty: 1.35, counter: -0.1, counterAgainst: 0, energy: 1.0, mix: { distanza: 0.6, centro: 2.2, ala: 0.6, penetrazione: 0.5 }, quality: 0, blockAgainst: -0.1 },
  },
  distanza: {
    id: 'distanza', name: 'Tiro dalla distanza', complexity: 25, affinity: ['offensivo'],
    desc: 'Si cerca il tiro dai 7-8 metri con i mancini e i tiratori migliori.',
    pros: ['Punisce la difesa a zona', 'Poche palle perse'], cons: ['Tiri più difficili', 'Poche espulsioni'],
    fx: { tempo: 0.9, turnover: -0.1, exclusion: -0.25, penalty: 0.8, counter: 0, counterAgainst: 0.15, energy: 0.95, mix: { distanza: 2.4, centro: 0.5, ala: 0.6, penetrazione: 0.4 }, quality: -0.08, blockAgainst: 0.2 },
  },
  rapido: {
    id: 'rapido', name: 'Attacco rapido', complexity: 35, affinity: ['offensivo', 'giovani'],
    desc: 'Si riparte appena recuperato il pallone: controfughe e tiri nei primi secondi.',
    pros: ['Molti contropiedi', 'Sfrutta i nuotatori veloci'], cons: ['Consuma energie', 'Più palle perse'],
    fx: { tempo: 0.75, turnover: 0.15, exclusion: -0.1, penalty: 1, counter: 0.6, counterAgainst: 0.2, energy: 1.2, mix: { distanza: 0.9, centro: 0.6, ala: 0.9, penetrazione: 1.4 }, quality: -0.04, blockAgainst: -0.1 },
  },
  ali: {
    id: 'ali', name: 'Gioco sulle ali', complexity: 45, affinity: ['offensivo', 'superiorita'],
    desc: 'Si allarga il gioco sulle posizioni 1 e 5 per tiri angolati e inserimenti.',
    pros: ['Efficace contro raddoppio e zona M', 'Valorizza i mancini'], cons: ['Angoli di tiro stretti', 'Richiede ali precise'],
    fx: { tempo: 1.0, turnover: 0, exclusion: 0.05, penalty: 1, counter: 0, counterAgainst: 0, energy: 1.0, mix: { distanza: 0.8, centro: 0.6, ala: 2.3, penetrazione: 0.8 }, quality: 0.04, blockAgainst: -0.15 },
  },
  aggressivo: {
    id: 'aggressivo', name: 'Attacco aggressivo', complexity: 50, affinity: ['offensivo'],
    desc: 'Penetrazioni continue, contatto fisico e tiro dopo l’uno contro uno.',
    pros: ['Molti tiri ed espulsioni', 'Mette pressione agli arbitri'], cons: ['Contropiedi concessi', 'Molto faticoso'],
    fx: { tempo: 0.85, turnover: 0.2, exclusion: 0.3, penalty: 1.2, counter: 0.2, counterAgainst: 0.3, energy: 1.18, mix: { distanza: 0.8, centro: 1.0, ala: 0.8, penetrazione: 2.0 }, quality: -0.08, blockAgainst: 0 },
  },
  circolazione: {
    id: 'circolazione', name: 'Circolazione veloce', complexity: 60, affinity: ['offensivo', 'equilibrato'],
    desc: 'Passaggi rapidi per spostare la difesa e trovare il tiro libero.',
    pros: ['Tiri puliti', 'Meno tiri respinti dal muro'], cons: ['Richiede ottimi passatori', 'Rischio di palle perse'],
    fx: { tempo: 0.95, turnover: 0.12, exclusion: 0.1, penalty: 1, counter: 0, counterAgainst: 0.05, energy: 1.08, mix: { distanza: 1.0, centro: 0.9, ala: 1.2, penetrazione: 1.0 }, quality: 0.22, blockAgainst: -0.35 },
  },
  espulsione: {
    id: 'espulsione', name: 'Ricerca dell’espulsione', complexity: 70, affinity: ['superiorita'],
    desc: 'Movimenti continui sul centro e tagli per costringere la difesa al fallo grave.',
    pros: ['Moltissime superiorità', 'Devastante contro le difese aggressive'], cons: ['Azioni lunghe', 'Pochi tiri dal perimetro'],
    fx: { tempo: 1.15, turnover: 0.05, exclusion: 0.6, penalty: 1.25, counter: -0.15, counterAgainst: -0.05, energy: 1.05, mix: { distanza: 0.5, centro: 1.6, ala: 0.7, penetrazione: 1.2 }, quality: 0, blockAgainst: 0 },
  },
};

export const DEFENSE: Record<DefenseTactic, TacticInfo & { fx: DefenseEffects }> = {
  uomo: {
    id: 'uomo', name: 'Marcatura a uomo', complexity: 0, affinity: ['equilibrato', 'difensivo'],
    desc: 'Ogni difensore segue il proprio uomo in pressing.',
    pros: ['Efficace contro avversari tecnicamente inferiori'], cons: ['Va in crisi contro nuotatori più veloci'],
    fx: { steal: 0.05, exclConceded: 0, center: 1, distance: 1, wing: 1, drive: 1, counterFor: 0, counterAgainst: 0, energy: 1.05, speedSensitivity: 1.6, techSensitivity: 1.5 },
  },
  prudente: {
    id: 'prudente', name: 'Difesa prudente', complexity: 0, affinity: ['difensivo'],
    desc: 'Si resta compatti davanti alla porta, senza rischiare il fallo.',
    pros: ['Poche espulsioni subite', 'Nessun contropiede concesso'], cons: ['Pochi recuperi', 'Tiri comodi per gli avversari'],
    fx: { steal: -0.3, exclConceded: -0.35, center: 0.95, distance: 1.15, wing: 1.05, drive: 0.9, counterFor: -0.15, counterAgainst: -0.25, energy: 0.88, speedSensitivity: 0.8, techSensitivity: 1 },
  },
  zona: {
    id: 'zona', name: 'Difesa a zona', complexity: 30, affinity: ['difensivo', 'equilibrato'],
    desc: 'La difesa si chiude sul centro e lascia il tiro da fuori.',
    pros: ['Limita il centroboa', 'Meno espulsioni'], cons: ['Concede tiri dalla distanza'],
    fx: { steal: -0.2, exclConceded: -0.3, center: 0.55, distance: 1.35, wing: 1.0, drive: 0.8, counterFor: 0, counterAgainst: -0.1, energy: 0.92, speedSensitivity: 0.7, techSensitivity: 1 },
  },
  aggressiva: {
    id: 'aggressiva', name: 'Difesa aggressiva', complexity: 40, affinity: ['difensivo', 'offensivo'],
    desc: 'Contatto continuo e anticipo sulle linee di passaggio.',
    pros: ['Molti palloni recuperati'], cons: ['Più espulsioni subite'],
    fx: { steal: 0.3, exclConceded: 0.3, center: 1.05, distance: 0.9, wing: 1, drive: 1, counterFor: 0.15, counterAgainst: 0.05, energy: 1.15, speedSensitivity: 1.2, techSensitivity: 1.2 },
  },
  raddoppio: {
    id: 'raddoppio', name: 'Raddoppio sul centroboa', complexity: 55, affinity: ['difensivo'],
    desc: 'Due uomini sul centroboa avversario: il centro sparisce, ma il perimetro resta libero.',
    pros: ['Annulla il centroboa avversario'], cons: ['Tiratori e ali liberi'],
    fx: { steal: 0.1, exclConceded: -0.2, center: 0.3, distance: 1.35, wing: 1.3, drive: 1, counterFor: 0.05, counterAgainst: 0, energy: 1.08, speedSensitivity: 1, techSensitivity: 1 },
  },
  pressing: {
    id: 'pressing', name: 'Pressing alto', complexity: 60, affinity: ['offensivo'],
    desc: 'Si attacca il portatore di palla già a metà vasca.',
    pros: ['Tanti recuperi e ripartenze'], cons: ['Consuma molte energie', 'Se saltato concede contropiedi'],
    fx: { steal: 0.45, exclConceded: 0.25, center: 0.95, distance: 0.9, wing: 1, drive: 1.12, counterFor: 0.3, counterAgainst: 0.25, energy: 1.3, speedSensitivity: 1.3, techSensitivity: 1.2 },
  },
  zonaM: {
    id: 'zonaM', name: 'Zona M (attenzione al centroboa)', complexity: 70, affinity: ['difensivo', 'superiorita'],
    desc: 'Zona evoluta con due difensori a protezione del centro e uscite coordinate sul tiratore.',
    pros: ['Centro chiuso senza lasciare troppo il perimetro'], cons: ['Soffre il gioco sulle ali', 'Richiede grande organizzazione'],
    fx: { steal: -0.08, exclConceded: -0.35, center: 0.42, distance: 1.12, wing: 1.28, drive: 0.85, counterFor: 0, counterAgainst: -0.1, energy: 0.96, speedSensitivity: 0.8, techSensitivity: 1 },
  },
};

export const MANUP_FORMATIONS: Record<ManUpFormation, TacticInfo> = {
  '4-2': { id: '4-2', name: '4-2 (due pali)', complexity: 0, affinity: ['equilibrato'], desc: 'Quattro uomini sul perimetro e due sui pali.', pros: ['Valorizza i giocatori sui pali'], cons: ['Prevedibile'] },
  '3-3': { id: '3-3', name: '3-3', complexity: 40, affinity: ['superiorita', 'offensivo'], desc: 'Tre tiratori alti e tre uomini sulla linea dei due metri.', pros: ['Ideale con grandi tiratori'], cons: ['Più tiri respinti dal muro'] },
};
export const MANUP_CIRCULATION: Record<ManUpCirculation, TacticInfo> = {
  paziente: { id: 'paziente', name: 'Paziente', complexity: 0, affinity: [], desc: 'Si fa girare la palla fino al tiro migliore.', pros: ['Poche palle perse'], cons: ['Il tempo dell’espulsione scorre'] },
  veloce: { id: 'veloce', name: 'Veloce', complexity: 35, affinity: ['superiorita'], desc: 'Esecuzione rapida prima che la difesa si sistemi.', pros: ['Tiri più puliti'], cons: ['Rischio di errori tecnici'] },
};
export const MANUP_STRATEGY: Record<ManUpStrategy, TacticInfo> = {
  equilibrata: { id: 'equilibrata', name: 'Equilibrata', complexity: 0, affinity: [], desc: 'Si sceglie la soluzione migliore di volta in volta.', pros: [], cons: [] },
  perimetro: { id: 'perimetro', name: 'Tiro dal perimetro', complexity: 20, affinity: [], desc: 'Conclusione dei tiratori designati dalle posizioni alte.', pros: ['Ottimo con tiratori potenti'], cons: ['Muro difensivo'] },
  pali: { id: 'pali', name: 'Gioco ai pali', complexity: 45, affinity: ['superiorita'], desc: 'Palla sul palo per il tiro ravvicinato o lo scarico.', pros: ['Tiri ad alta percentuale'], cons: ['Richiede precisione'] },
  centro: { id: 'centro', name: 'Ricerca del centro', complexity: 55, affinity: ['superiorita'], desc: 'Palla in mezzo per un’altra espulsione o un rigore.', pros: ['Doppie superiorità e rigori'], cons: ['Più lenta'] },
};
export const MANDOWN_STYLES: Record<ManDownStyle, TacticInfo> = {
  compatta: { id: 'compatta', name: 'Difesa compatta', complexity: 0, affinity: ['difensivo'], desc: 'Si chiudono le linee di passaggio verso i pali.', pros: ['Pochi gol da vicino'], cons: ['Tiratori liberi'] },
  porta: { id: 'porta', name: 'Protezione della porta', complexity: 0, affinity: [], desc: 'Tutti in linea con il portiere per coprire gli angoli.', pros: ['Il portiere vede meglio i tiri da fuori'], cons: ['Pali scoperti'] },
  blocco: { id: 'blocco', name: 'Priorità al blocco del tiro', complexity: 35, affinity: ['difensivo'], desc: 'Braccia alte sui tiratori per murare le conclusioni.', pros: ['Più tiri murati'], cons: ['Faticosa'] },
  aggressiva: { id: 'aggressiva', name: 'Inferiorità aggressiva', complexity: 50, affinity: ['difensivo', 'superiorita'], desc: 'Si va a disturbare il portatore per rubare palla.', pros: ['Palle recuperate'], cons: ['Se saltata, gol quasi certo'] },
};

export function tacticLabel(id: string): string {
  return (
    (OFFENSE as any)[id]?.name ??
    (DEFENSE as any)[id]?.name ??
    (MANUP_FORMATIONS as any)[id.replace('mu_', '')]?.name ??
    (MANDOWN_STYLES as any)[id.replace('md_', '')]?.name ??
    id
  );
}

export function defaultTactics(): TacticsSetup {
  return {
    offense: 'organizzato',
    defense: 'uomo',
    manUp: { formation: '4-2', circulation: 'paziente', strategy: 'equilibrata', shooters: [] },
    manDown: { style: 'compatta', focusPlayerId: null },
  };
}

export function defaultFamiliarity(level: number): Partial<Record<TacticId, number>> {
  const fam: Partial<Record<TacticId, number>> = {};
  const base = clamp(30 + level * 0.4, 30, 75);
  for (const [id, t] of Object.entries(OFFENSE)) fam[id as TacticId] = clamp(base - t.complexity * 0.35, 15, 90);
  for (const [id, t] of Object.entries(DEFENSE)) fam[id as TacticId] = clamp(base - t.complexity * 0.35, 15, 90);
  fam['mu_4-2'] = base;
  fam['mu_3-3'] = clamp(base - 14, 15, 90);
  for (const [id, t] of Object.entries(MANDOWN_STYLES)) fam[`md_${id}` as TacticId] = clamp(base - t.complexity * 0.35, 15, 90);
  return fam;
}

/** Livello di sviluppo della società (1-10): influenza capacità organizzativa e sblocchi. */
export function clubLevel(club: Club): number {
  const thresholds = [0, 60, 150, 280, 450, 680, 980, 1350, 1800, 2400];
  let lvl = 1;
  for (let i = 0; i < thresholds.length; i++) if (club.devPoints >= thresholds[i]) lvl = i + 1;
  return lvl;
}

export function clubLevelThresholds(): number[] {
  return [0, 60, 150, 280, 450, 680, 980, 1350, 1800, 2400];
}

export interface CapacityBreakdown {
  total: number;
  parts: { label: string; value: number; max: number }[];
}

/**
 * Capacità organizzativa: quanto la squadra è in grado di eseguire sistemi complessi.
 * Dipende da allenatore, vice, centro di allenamento, intelligenza tattica della rosa ed esperienza della società.
 */
export function organizationCapacity(world: World, club: Club): CapacityBreakdown {
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const vice = club.staff.vice ? world.staff[club.staff.vice] : null;
  const players = club.playerIds.map((id) => world.players[id]).filter(Boolean);
  const iq = avg(topN(players, 13, (p) => p.overall).map((p) => p.attrs.intelligenzaTattica));
  const parts = [
    { label: 'Competenza tattica dell’allenatore', value: (coach ? coach.attrs.tattica : 20) * 0.3, max: 30 },
    { label: 'Adattabilità dell’allenatore', value: (coach ? coach.attrs.adattabilita : 20) * 0.1, max: 10 },
    { label: 'Vice allenatore', value: (vice ? vice.rating : 10) * 0.12, max: 12 },
    { label: 'Centro di allenamento', value: (club.facilities.allenamento.level - 1) * 3.75, max: 15 },
    { label: 'Intelligenza tattica della rosa', value: iq * 0.18, max: 18 },
    { label: 'Esperienza della società', value: clubLevel(club) * 1.5, max: 15 },
  ];
  const total = Math.round(parts.reduce((s, p) => s + p.value, 0));
  return { total, parts };
}

export function isUnlocked(world: World, club: Club, complexity: number): boolean {
  return organizationCapacity(world, club).total >= complexity;
}

export function tacticIdsInUse(t: TacticsSetup): TacticId[] {
  return [t.offense, t.defense, `mu_${t.manUp.formation}`, `md_${t.manDown.style}`];
}

/** Corregge le tattiche selezionate se non più disponibili (es. cambio allenatore). */
export function sanitizeTactics(world: World, club: Club) {
  const cap = organizationCapacity(world, club).total;
  const t = club.tactics;
  if (OFFENSE[t.offense].complexity > cap) t.offense = 'organizzato';
  if (DEFENSE[t.defense].complexity > cap) t.defense = 'uomo';
  if (MANUP_FORMATIONS[t.manUp.formation].complexity > cap) t.manUp.formation = '4-2';
  if (MANUP_CIRCULATION[t.manUp.circulation].complexity > cap) t.manUp.circulation = 'paziente';
  if (MANUP_STRATEGY[t.manUp.strategy].complexity > cap) t.manUp.strategy = 'equilibrata';
  if (MANDOWN_STYLES[t.manDown.style].complexity > cap) t.manDown.style = 'compatta';
  t.manUp.shooters = t.manUp.shooters.filter((id) => club.playerIds.includes(id)).slice(0, 2);
}

/** Aggiornamento settimanale della familiarità con le tattiche. */
export function updateFamiliarity(world: World, club: Club) {
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const vice = club.staff.vice ? world.staff[club.staff.vice] : null;
  const learn = 0.6 + (coach ? coach.attrs.tattica / 100 : 0.2) * 0.6 + (vice ? vice.rating / 100 : 0.1) * 0.3 +
    (club.facilities.allenamento.level - 1) * 0.08;
  const tactical = club.training.focus === 'tattico';
  const inUse = new Set(tacticIdsInUse(club.tactics));
  const all: { id: TacticId; aff: CoachPhilosophy[] }[] = [
    ...Object.values(OFFENSE).map((t) => ({ id: t.id as TacticId, aff: t.affinity })),
    ...Object.values(DEFENSE).map((t) => ({ id: t.id as TacticId, aff: t.affinity })),
    ...Object.values(MANUP_FORMATIONS).map((t) => ({ id: `mu_${t.id}` as TacticId, aff: t.affinity })),
    ...Object.values(MANDOWN_STYLES).map((t) => ({ id: `md_${t.id}` as TacticId, aff: t.affinity })),
  ];
  for (const { id, aff } of all) {
    const cur = club.tacticFamiliarity[id] ?? 20;
    let d: number;
    if (inUse.has(id)) d = (tactical ? 3.2 : 1.6) * learn;
    else d = tactical ? 0.5 * learn : -0.35;
    if (coach && aff.includes(coach.philosophy)) d += 0.4;
    club.tacticFamiliarity[id] = clamp(cur + d, 10, 100);
  }
}

export function familiarity(club: Club, id: TacticId): number {
  return club.tacticFamiliarity[id] ?? 20;
}
