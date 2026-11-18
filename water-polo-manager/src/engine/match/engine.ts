// ─────────────────────────────────────────────────────────────────────────────
// MOTORE DI SIMULAZIONE DELLA PARTITA
//
// Simulazione possesso per possesso, indipendente dall'interfaccia e deterministica
// (stato del generatore casuale salvato nello stato della partita). Ogni possesso
// passa per: transizione/contropiede → palla persa → fallo grave (espulsione o
// rigore) → tiro (murato, fuori, parato, gol). Le probabilità dipendono dalle
// caratteristiche dei giocatori in acqua, dalla loro energia, dalle tattiche
// (e dalla familiarità con esse), dall'allenatore, dal morale, dall'affiatamento,
// dal fattore campo e dall'importanza della partita.
// ─────────────────────────────────────────────────────────────────────────────

import { Rng } from '../rng';
import type {
  AttrKey, Attributes, DefenseTactic, MatchEvent, OffenseTactic, PlayerMatchLine, Role, TacticId, TacticsSetup,
  TeamMatchStats,
} from '../types';
import { clamp, logit, sigmoid } from '../util';
import { slotSuitability } from '../player/attributes';
import { DEFENSE, OFFENSE, type DefenseEffects, type OffenseEffects } from '../tactics/tactics';

export interface MatchPlayerInput {
  id: string;
  name: string;
  number: number;
  role: Role;
  hand: 'R' | 'L';
  attrs: Attributes;
  overall: number;
  condition: number;
  morale: number;
  formAvg: number;
  temperament: number;
}

export interface MatchCoachInput {
  tattica: number;
  motivazione: number;
  adattabilita: number;
  esperienza: number;
  preparazione: number;
}

export interface MatchTeamInput {
  clubId: string;
  name: string;
  short: string;
  /** Giocatori a referto: i primi 7 sono i titolari nell'ordine delle posizioni (0 = portiere). */
  players: MatchPlayerInput[];
  tactics: TacticsSetup;
  familiarity: Partial<Record<TacticId, number>>;
  coach: MatchCoachInput | null;
  chemistry: number;
  fitnessPrep: number;
  penaltyTakers: string[];
  /** Tattiche che l'allenatore può usare durante la partita. */
  available: { offense: OffenseTactic[]; defense: DefenseTactic[] };
  /** L'allenatore può cambiare tattica da solo durante la gara. */
  coachAdjusts: boolean;
  autoSubs: boolean;
  /** Minuti previsti (su tutta la gara) per i panchinari, per id giocatore. */
  minutesPlan?: Record<string, number>;
}

export interface MatchSetup {
  home: MatchTeamInput;
  away: MatchTeamInput;
  neutral: boolean;
  importance: number;
  allowDraw: boolean;
  /** Gol dell'andata [casa, ospiti] per i confronti a/r: i rigori decidono se il totale è in parità. */
  aggregate?: [number, number];
  periodSeconds: number;
  seed: number;
}

interface PState {
  energy: number;
  maxEnergy: number;
  fouls: number;
  out: boolean;
  mod: number;
  /** Valori compositi precalcolati (caratteristiche × morale/forma/pressione). */
  cm: Record<CompKey, number>;
  line: PlayerMatchLine;
}

interface SideState {
  slots: number[];
  tactics: TacticsSetup;
  stats: TeamMatchStats;
  timeouts: number;
  momentum: number;
  run: number;
  p: PState[];
  /** Adattamento alla posizione attuale di ogni giocatore (1 se fuori dall'acqua). */
  suit: number[];
  teamMod: number;
  tacticLog: { period: number; clock: number; offense: OffenseTactic; defense: DefenseTactic }[];
}

export interface MatchState {
  setup: MatchSetup;
  rng: number;
  period: number;
  clock: number;
  possession: 0 | 1;
  transition: 'start' | 'afterGoal' | 'rebound' | 'steal' | 'turnover';
  sides: [SideState, SideState];
  events: MatchEvent[];
  score: [number, number];
  periods: [number, number][];
  needSprint: boolean;
  finished: boolean;
  pens?: [number, number];
  /** Partita in pausa per il cambio di tempo (utile per la cronaca interattiva). */
  breakPending: boolean;
}

const PHYS = new Set<AttrKey>(['velocita', 'accelerazione', 'resistenza', 'forza', 'elevazione', 'agilita', 'recupero']);

type ShotType = 'distanza' | 'centro' | 'ala' | 'penetrazione' | 'controfuga' | 'superiorita' | 'rigore';

const SHOT_SKILL: Record<ShotType, Partial<Record<AttrKey, number>>> = {
  distanza: { tiro: 0.35, potenzaTiro: 0.4, precisione: 0.25 },
  centro: { giocoCentro: 0.35, tiro: 0.25, precisione: 0.2, forza: 0.2 },
  ala: { precisione: 0.45, tiro: 0.35, agilita: 0.2 },
  penetrazione: { tiro: 0.3, precisione: 0.3, dribbling: 0.2, accelerazione: 0.2 },
  controfuga: { tiro: 0.35, precisione: 0.35, freddezza: 0.3 },
  superiorita: { tiro: 0.3, precisione: 0.3, superiorita: 0.25, potenzaTiro: 0.15 },
  rigore: { tiro: 0.3, precisione: 0.3, freddezza: 0.4 },
};
const BASE_BLOCK: Record<ShotType, number> = { distanza: 0.17, centro: 0.05, ala: 0.08, penetrazione: 0.11, controfuga: 0.02, superiorita: 0.14, rigore: 0.001 };
const BASE_MISS: Record<ShotType, number> = { distanza: 0.3, centro: 0.17, ala: 0.26, penetrazione: 0.2, controfuga: 0.1, superiorita: 0.18, rigore: 0.06 };
const BASE_SAVE: Record<ShotType, number> = { distanza: 0.58, centro: 0.43, ala: 0.5, penetrazione: 0.47, controfuga: 0.37, superiorita: 0.47, rigore: 0.21 };
const ASSIST_P: Record<ShotType, number> = { distanza: 0.35, centro: 0.7, ala: 0.6, penetrazione: 0.3, controfuga: 0.5, superiorita: 0.75, rigore: 0 };

function emptyTeamStats(): TeamMatchStats {
  return {
    goals: 0, shots: 0, shotsOnTarget: 0, saves: 0, blocked: 0, exclusionsDrawn: 0, manUp: 0, manUpGoals: 0, penalties: 0,
    penaltyGoals: 0, counters: 0, counterGoals: 0, steals: 0, turnovers: 0, fouls: 0, possessionSeconds: 0, possessions: 0,
    timeouts: 0, sprintsWon: 0, goalsByPeriod: [0, 0, 0, 0], goalTypes: {},
  };
}

function emptyLine(p: MatchPlayerInput, started: boolean): PlayerMatchLine {
  return {
    id: p.id, name: p.name, number: p.number, role: p.role, started, seconds: 0, goals: 0, assists: 0, shots: 0,
    shotsOnTarget: 0, exclDrawn: 0, exclCommitted: 0, steals: 0, turnovers: 0, blocks: 0, saves: 0, goalsAgainst: 0,
    penGoals: 0, manUpGoals: 0, rating: 6, fouledOut: false, injured: false, redCard: false,
  };
}

function initSide(team: MatchTeamInput, importance: number, home: boolean, neutral: boolean): SideState {
  const coach = team.coach;
  const chem = 0.95 + (team.chemistry / 100) * 0.08;
  const motiv = coach ? ((coach.motivazione - 50) / 50) * 0.02 * (0.5 + importance) : -0.01;
  const homeF = !neutral && home ? 0.008 : 0;
  const teamMod = chem + motiv + homeF;
  const p = team.players.map((pl, i) => {
    const moraleF = 0.93 + (pl.morale / 100) * 0.14;
    const formF = clamp(1 + (pl.formAvg - 6.3) * 0.03, 0.96, 1.04);
    const pressF = 1 + importance * ((pl.attrs.pressione - 50) / 100) * 0.1;
    const maxEnergy = clamp(0.55 + (pl.condition / 100) * 0.45, 0.4, 1);
    const mod = moraleF * formF * pressF;
    const cm = {} as Record<CompKey, number>;
    for (const k of COMP_KEYS) {
      const w = COMPOSITES[k] as Partial<Record<AttrKey, number>>;
      let t = 0;
      for (const a in w) t += pl.attrs[a as AttrKey] * w[a as AttrKey]!;
      cm[k] = t * mod;
    }
    return {
      energy: maxEnergy,
      maxEnergy,
      fouls: 0,
      out: false,
      mod,
      cm,
      line: emptyLine(pl, i < 7),
    } satisfies PState;
  });
  const slots = [0, 1, 2, 3, 4, 5, 6].map((i) => (i < team.players.length ? i : -1));
  return {
    slots,
    suit: team.players.map((pl, i) => (i < 7 ? Math.pow(slotSuitability(pl.role, pl.hand, i), 0.6) : 1)),
    tactics: JSON.parse(JSON.stringify(team.tactics)),
    stats: emptyTeamStats(),
    timeouts: 2,
    momentum: 0,
    run: 0,
    p,
    teamMod,
    tacticLog: [],
  };
}

export function createMatch(setup: MatchSetup): MatchState {
  const st: MatchState = {
    setup,
    rng: setup.seed,
    period: 1,
    clock: setup.periodSeconds,
    possession: 0,
    transition: 'start',
    sides: [initSide(setup.home, setup.importance, true, setup.neutral), initSide(setup.away, setup.importance, false, setup.neutral)],
    events: [],
    score: [0, 0],
    periods: [[0, 0], [0, 0], [0, 0], [0, 0]],
    needSprint: true,
    finished: false,
    breakPending: false,
  };
  // Giornata di forma: ogni squadra ha una partita migliore o peggiore del solito (indipendente dal generatore di gioco).
  const day = Rng.fromSeed(setup.seed ^ 0x2f6e2b1);
  for (const s of [0, 1] as const) st.sides[s].teamMod *= 1 + clamp(day.gauss(0, DAY_FORM_SD), -3 * DAY_FORM_SD, 3 * DAY_FORM_SD);
  for (const s of [0, 1] as const) {
    st.sides[s].tacticLog.push({ period: 1, clock: setup.periodSeconds, offense: st.sides[s].tactics.offense, defense: st.sides[s].tactics.defense });
  }
  push(st, { type: 'start', side: -1, tag: 'period' });
  return st;
}

// ─── Utilità ────────────────────────────────────────────────────────────────

function team(st: MatchState, s: number): MatchTeamInput {
  return s === 0 ? st.setup.home : st.setup.away;
}

function push(st: MatchState, e: Omit<MatchEvent, 'period' | 'clock'>) {
  st.events.push({ period: st.period, clock: Math.max(0, Math.round(st.clock)), ...e });
}

function inWater(st: MatchState, s: number): number[] {
  return st.sides[s].slots.filter((i) => i >= 0);
}

function fieldIdx(st: MatchState, s: number): number[] {
  return st.sides[s].slots.slice(1).filter((i) => i >= 0);
}

/** Ricalcola l'adattamento alle posizioni dopo un cambio. */
function refreshSuit(st: MatchState, s: number) {
  const side = st.sides[s];
  const tm = team(st, s);
  for (let i = 0; i < side.suit.length; i++) side.suit[i] = 1;
  side.slots.forEach((idx, slot) => {
    if (idx >= 0) side.suit[idx] = Math.pow(slotSuitability(tm.players[idx].role, tm.players[idx].hand, slot), 0.6);
  });
}

/** Valore effettivo di una caratteristica: fatica, morale, forma, adattamento alla posizione. */
function eff(st: MatchState, s: number, idx: number, key: AttrKey): number {
  const side = st.sides[s];
  const ps = side.p[idx];
  const fat = PHYS.has(key) ? 0.62 + 0.38 * ps.energy : 0.8 + 0.2 * ps.energy;
  return team(st, s).players[idx].attrs[key] * fat * ps.mod * side.suit[idx] * side.teamMod;
}

/** Valore composito effettivo (precalcolato a inizio partita, corretto per fatica e posizione). */
function cv(st: MatchState, s: number, idx: number, key: CompKey): number {
  const side = st.sides[s];
  const ps = side.p[idx];
  const tired = 1 - ps.energy;
  const ph = PHYS_SHARE[key];
  const fat = 1 - tired * (0.38 * ph + 0.2 * (1 - ph));
  return ps.cm[key] * fat * side.suit[idx] * side.teamMod;
}

function avgField(st: MatchState, s: number, key: CompKey): number {
  const sl = st.sides[s].slots;
  let t = 0;
  let n = 0;
  for (let k = 1; k < 7; k++) {
    const i = sl[k];
    if (i < 0) continue;
    t += cv(st, s, i, key);
    n++;
  }
  return n ? t / n : 10;
}

function tacticEff(st: MatchState, s: number, id: TacticId): number {
  const fam = team(st, s).familiarity[id] ?? 25;
  const coach = team(st, s).coach;
  return (0.55 + 0.45 * (fam / 100)) * (0.85 + 0.3 * ((coach?.tattica ?? 30) / 100));
}

function scaleOff(fx: OffenseEffects, te: number): OffenseEffects {
  const sc = (v: number) => v * te;
  const sm = (v: number) => 1 + (v - 1) * te;
  return {
    tempo: sm(fx.tempo), turnover: sc(fx.turnover), exclusion: sc(fx.exclusion), penalty: sm(fx.penalty), counter: sc(fx.counter),
    counterAgainst: sc(fx.counterAgainst), energy: fx.energy, quality: sc(fx.quality), blockAgainst: sc(fx.blockAgainst),
    mix: { distanza: sm(fx.mix.distanza), centro: sm(fx.mix.centro), ala: sm(fx.mix.ala), penetrazione: sm(fx.mix.penetrazione) },
  };
}

function scaleDef(fx: DefenseEffects, te: number): DefenseEffects {
  const sc = (v: number) => v * te;
  const sm = (v: number) => 1 + (v - 1) * te;
  return {
    steal: sc(fx.steal), exclConceded: sc(fx.exclConceded), center: sm(fx.center), distance: sm(fx.distance), wing: sm(fx.wing),
    drive: sm(fx.drive), counterFor: sc(fx.counterFor), counterAgainst: sc(fx.counterAgainst), energy: fx.energy,
    speedSensitivity: fx.speedSensitivity, techSensitivity: fx.techSensitivity,
  };
}

interface Ratings {
  ballSecurity: number;
  speed: number;
  centerPower: number;
  tech: number;
  press: number;
  centerDef: number;
  block: number;
  gk: number;
  manUp: number;
  manDown: number;
  discipline: number;
}

function ratings(st: MatchState, s: number): Ratings {
  const side = st.sides[s];
  const f = fieldIdx(st, s);
  const speeds = f.map((i) => cv(st, s, i, 'speed')).sort((a, b) => b - a);
  const top4 = speeds.slice(0, 4);
  const cf = side.slots[6] >= 0 ? side.slots[6] : f[0];
  const cb = centreMarker(st, s);
  const gk = side.slots[0];
  const temper = f.length ? f.reduce((a, i) => a + team(st, s).players[i].temperament, 0) / f.length : 10;
  return {
    ballSecurity: avgField(st, s, 'ballSecurity'),
    speed: top4.length ? top4.reduce((a, b) => a + b, 0) / top4.length : 10,
    centerPower: cf != null && cf >= 0 ? cv(st, s, cf, 'centerPower') : 10,
    tech: avgField(st, s, 'tech'),
    press: avgField(st, s, 'press'),
    centerDef: cb != null && cb >= 0 ? cv(st, s, cb, 'centerDef') : 10,
    block: avgField(st, s, 'block'),
    gk: gk >= 0 ? cv(st, s, gk, 'gk') : 5,
    manUp: avgField(st, s, 'manUp'),
    manDown: avgField(st, s, 'manDown'),
    discipline: avgField(st, s, 'discipline') - (temper - 10) * 1.2,
  };
}

/**
 * Differenza di qualità tra due valori, in "decine di punti". SKILL_LINEAR e SKILL_CONVEX regolano quanto la qualità pesa sui risultati
 * (in pallanuoto la squadra migliore vince quasi sempre); la saturazione evita punteggi irreali con divari enormi.
 */
/** Variazione casuale della forma di una squadra da una partita all'altra: rende possibili le sorprese tra squadre vicine. */
export const DAY_FORM_SD = 0.06;
export const SKILL_LINEAR = 1.6;
/** Parte che cresce col divario: tra squadre vicine il risultato resta aperto, con grandi differenze la qualità decide. */
export const SKILL_CONVEX = 0.8;
const SKILL_SATURATION = 1.7;
/** Tetto all'effetto della qualità: anche con divari enormi i punteggi restano realistici (circa 18-6 al massimo), pur con vittoria quasi certa. */
const SKILL_CAP = 3.4;
const d10 = (a: number, b: number) => {
  const x = (a - b) / 10;
  const ax = Math.abs(x);
  const f = (x * (SKILL_LINEAR + SKILL_CONVEX * ax)) / (1 + ax / SKILL_SATURATION);
  return SKILL_CAP * Math.tanh(f / SKILL_CAP);
};

const COMPOSITES = {
  ballSecurity: { controlloPalla: 0.4, passaggio: 0.3, decisioni: 0.3 },
  speed: { velocita: 0.6, accelerazione: 0.4 },
  centerPower: { giocoCentro: 0.45, forza: 0.35, smarcamento: 0.2 },
  tech: { controlloPalla: 0.3, passaggio: 0.3, dribbling: 0.2, tiro: 0.2 },
  press: { marcatura: 0.35, contrasto: 0.3, velocita: 0.15, intelligenzaTattica: 0.2 },
  centerDef: { marcatura: 0.4, forza: 0.4, contrasto: 0.2 },
  block: { elevazione: 0.4, marcatura: 0.3, concentrazione: 0.3 },
  gk: { riflessi: 0.35, piazzamento: 0.3, uscite: 0.1, agilita: 0.1, elevazione: 0.1, concentrazione: 0.05 },
  manUp: { superiorita: 0.4, tiro: 0.2, precisione: 0.2, passaggio: 0.2 },
  manDown: { inferiorita: 0.45, elevazione: 0.2, marcatura: 0.2, concentrazione: 0.15 },
  discipline: { concentrazione: 0.6, intelligenzaTattica: 0.4 },
  posts: { precisione: 0.5, giocoCentro: 0.3, forza: 0.2 },
  flats: { potenzaTiro: 0.5, tiro: 0.3, precisione: 0.2 },
  gkPen: { riflessi: 0.5, piazzamento: 0.3, concentrazione: 0.2 },
  steal: { contrasto: 1, marcatura: 0.5 },
  passer: { passaggio: 1, visione: 1 },
  sh_distanza: SHOT_SKILL.distanza,
  sh_centro: SHOT_SKILL.centro,
  sh_ala: SHOT_SKILL.ala,
  sh_penetrazione: SHOT_SKILL.penetrazione,
  sh_controfuga: SHOT_SKILL.controfuga,
  sh_superiorita: SHOT_SKILL.superiorita,
  sh_rigore: SHOT_SKILL.rigore,
} satisfies Record<string, Partial<Record<AttrKey, number>>>;
type CompKey = keyof typeof COMPOSITES;
const COMP_KEYS = Object.keys(COMPOSITES) as CompKey[];
const PHYS_SHARE = Object.fromEntries(
  COMP_KEYS.map((k) => {
    const w = COMPOSITES[k] as Partial<Record<AttrKey, number>>;
    let tot = 0;
    let ph = 0;
    for (const a in w) { tot += w[a as AttrKey]!; if (PHYS.has(a as AttrKey)) ph += w[a as AttrKey]!; }
    return [k, tot ? ph / tot : 0];
  }),
) as Record<CompKey, number>;
const shotKey = (t: ShotType) => `sh_${t}` as CompKey;

// ─── Ciclo di gioco ─────────────────────────────────────────────────────────

/** Avanza la partita di un'azione (un possesso, uno sprint o un cambio di tempo). */
export function stepMatch(st: MatchState): void {
  if (st.finished) return;
  const rng = new Rng(st);
  if (st.breakPending) {
    st.breakPending = false;
  }
  if (st.needSprint) {
    sprint(st, rng);
    st.needSprint = false;
    return;
  }
  if (st.clock <= 0.5) {
    endPeriod(st, rng);
    return;
  }
  possession(st, rng);
  if (st.clock <= 0.5) endPeriod(st, rng);
}

export function simulateToEnd(st: MatchState): void {
  let guard = 0;
  while (!st.finished && guard++ < 2000) stepMatch(st);
}

function sprint(st: MatchState, rng: Rng) {
  const best = (s: number) => {
    let bi = fieldIdx(st, s)[0];
    let bv = -1;
    for (const i of fieldIdx(st, s)) {
      const v = cv(st, s, i, 'speed');
      if (v > bv) { bv = v; bi = i; }
    }
    return { i: bi, v: bv };
  };
  const a = best(0);
  const b = best(1);
  const won: 0 | 1 = rng.chance(sigmoid(0.45 * d10(a.v, b.v))) ? 0 : 1;
  st.sides[won].stats.sprintsWon++;
  st.possession = won;
  st.transition = 'start';
  if (st.period === 1) push(st, { type: 'kickoff', side: -1, tag: 'period' });
  push(st, { type: 'sprint', side: won, p1: team(st, won).players[won === 0 ? a.i : b.i].id, tag: 'info' });
  st.clock -= 3;
}

function endPeriod(st: MatchState, rng: Rng) {
  push(st, { type: 'period_end', side: -1, score: [...st.score] as [number, number], tag: 'period' });
  if (st.period >= 4) {
    const agg = st.setup.aggregate;
    const level = agg ? st.score[0] + agg[0] === st.score[1] + agg[1] : st.score[0] === st.score[1];
    if (level && !st.setup.allowDraw) {
      shootout(st, rng);
    }
    finish(st);
    return;
  }
  st.period++;
  st.clock = st.setup.periodSeconds;
  st.needSprint = true;
  st.breakPending = true;
  // Recupero nell'intervallo.
  for (const s of [0, 1]) {
    for (const ps of st.sides[s].p) ps.energy = Math.min(ps.maxEnergy, ps.energy + (st.period === 3 ? 0.1 : 0.05));
  }
  for (const s of [0, 1] as const) {
    if (team(st, s).autoSubs) autoSubs(st, s, rng, true);
    if (team(st, s).coachAdjusts) coachReview(st, s, rng);
  }
  push(st, { type: 'period_start', side: -1, tag: 'period' });
}

function finish(st: MatchState) {
  st.finished = true;
  st.period = Math.min(st.period, 4);
  st.clock = 0;
  computeRatings(st);
  push(st, { type: 'end', side: -1, score: [...st.score] as [number, number], tag: 'period' });
}

function tick(st: MatchState, seconds: number, attacker: 0 | 1, rng: Rng) {
  const t = Math.min(seconds, st.clock);
  st.clock -= t;
  st.sides[attacker].stats.possessionSeconds += t;
  for (const s of [0, 1] as const) {
    const side = st.sides[s];
    const tm = team(st, s);
    const off = s === attacker;
    const fxE = off ? OFFENSE[side.tactics.offense].fx.energy : DEFENSE[side.tactics.defense].fx.energy;
    const prep = 1.12 - tm.fitnessPrep / 400 - ((tm.coach?.preparazione ?? 40) / 100) * 0.12;
    const water = new Set(inWater(st, s));
    for (let i = 0; i < side.p.length; i++) {
      const ps = side.p[i];
      if (ps.out) continue;
      const pl = tm.players[i];
      if (water.has(i)) {
        ps.line.seconds += t;
        const isGk = side.slots[0] === i;
        const drain = 0.0072 * (t / 20) * (1.25 - pl.attrs.resistenza / 200) * fxE * prep * (isGk ? 0.3 : 1);
        ps.energy = Math.max(0.15, ps.energy - drain);
        // Infortunio: in pallanuoto è raro (sport senza impatti col terreno), un po' più probabile se stanchi.
        if (rng.chance(0.00005 * (t / 20) * (1.6 - ps.energy) * (isGk ? 0.4 : 1))) injure(st, s, i, rng);
      } else {
        ps.energy = Math.min(ps.maxEnergy, ps.energy + 0.02 * (t / 20) * (0.5 + pl.attrs.recupero / 100));
      }
    }
    side.momentum *= 0.85;
  }
}

function hasReplacement(st: MatchState, s: number, idx: number): boolean {
  const side = st.sides[s];
  const slot = side.slots.indexOf(idx);
  if (slot < 0) return true;
  return benchCandidates(st, s, slot).length > 0;
}

function injure(st: MatchState, s: number, idx: number, rng: Rng) {
  if (!hasReplacement(st, s, idx)) return;
  const ps = st.sides[s].p[idx];
  ps.out = true;
  ps.line.injured = true;
  push(st, { type: 'injury', side: s as 0 | 1, p1: team(st, s).players[idx].id, tag: 'bad' });
  replaceOut(st, s, idx, rng);
}

/** Sostituisce un giocatore uscito (espulso definitivamente o infortunato). */
function replaceOut(st: MatchState, s: number, idx: number, rng: Rng) {
  const side = st.sides[s];
  const slot = side.slots.indexOf(idx);
  if (slot < 0) return;
  const cand = benchCandidates(st, s, slot);
  if (cand.length) {
    const best = cand[0];
    side.slots[slot] = best;
    refreshSuit(st, s);
    push(st, { type: 'sub', side: s as 0 | 1, p1: team(st, s).players[best].id, p2: team(st, s).players[idx].id, tag: 'info', kind: 'forced' });
  } else if (slot === 0) {
    // Nessun portiere di riserva: un giocatore di movimento va in porta.
    const f = fieldIdx(st, s).filter((i) => i !== idx);
    if (f.length) {
      const pick = f[rng.int(0, f.length - 1)];
      side.slots[side.slots.indexOf(pick)] = -1;
      side.slots[0] = pick;
    }
    refreshSuit(st, s);
  } else {
    side.slots[slot] = -1;
    refreshSuit(st, s);
  }
}

function benchCandidates(st: MatchState, s: number, slot: number): number[] {
  const side = st.sides[s];
  const tm = team(st, s);
  const water = new Set(side.slots);
  const list: { i: number; v: number }[] = [];
  for (let i = 0; i < tm.players.length; i++) {
    if (water.has(i) || side.p[i].out) continue;
    const pl = tm.players[i];
    if (slot === 0 && pl.role !== 'POR') continue;
    if (slot !== 0 && pl.role === 'POR') continue;
    list.push({ i, v: pl.overall * slotSuitability(pl.role, pl.hand, slot) * (0.6 + 0.4 * side.p[i].energy) });
  }
  return list.sort((a, b) => b.v - a.v).map((x) => x.i);
}

/**
 * Rotazioni decise dall'allenatore per rispettare il minutaggio previsto dei panchinari.
 * A gioco fermo, chi è in ritardo sul suo programma entra al posto del compagno meno penalizzante;
 * chi ha superato il programma esce. Al massimo due cambi per interruzione.
 */
function rotationSubs(st: MatchState, s: number): number {
  const tm = team(st, s);
  const plan = tm.minutesPlan;
  if (!plan) return 0;
  const side = st.sides[s];
  const total = st.setup.periodSeconds * 4;
  const elapsed = (st.period - 1) * st.setup.periodSeconds + (st.setup.periodSeconds - st.clock);
  const frac = Math.min(1, Math.max(0, elapsed / total));
  const played = (i: number) => side.p[i].line.seconds / 60;
  const target = (i: number) => plan[tm.players[i].id];
  let done = 0;
  // 1) Esce chi ha già giocato più del suo programma.
  for (let slot = 0; slot <= 6 && done < 2; slot++) {
    const cur = side.slots[slot];
    if (cur < 0) continue;
    const t = target(cur);
    if (t == null || played(cur) < t * frac + 1.2) continue;
    const cand = benchCandidates(st, s, slot).filter((b) => {
      const tb = target(b);
      return tb == null || played(b) < tb * frac + 1.2;
    });
    if (!cand.length) continue;
    side.slots[slot] = cand[0];
    refreshSuit(st, s);
    done++;
    push(st, { type: 'sub', side: s as 0 | 1, p1: tm.players[cand[0]].id, p2: tm.players[cur].id, tag: 'info' });
  }
  // 2) Entra chi è in ritardo sul programma.
  const water = new Set(side.slots);
  const behind: { i: number; gap: number }[] = [];
  for (let i = 0; i < tm.players.length; i++) {
    if (water.has(i) || side.p[i].out) continue;
    const t = target(i);
    if (t == null || t <= 0) continue;
    const gap = t * frac - played(i);
    if (gap >= 0.8 || (frac >= 0.97 && played(i) < t - 0.5)) behind.push({ i, gap });
  }
  behind.sort((a, b) => b.gap - a.gap);
  for (const { i } of behind) {
    if (done >= 2) break;
    const pl = tm.players[i];
    const slots = pl.role === 'POR' ? [0] : [1, 2, 3, 4, 5, 6];
    let best: { slot: number; loss: number } | null = null;
    for (const slot of slots) {
      const cur = side.slots[slot];
      if (cur < 0) continue;
      const cp = tm.players[cur];
      if ((cp.role === 'POR') !== (pl.role === 'POR')) continue;
      // Non si toglie chi deve ancora giocare il suo programma.
      const tc = target(cur);
      if (tc != null && played(cur) < tc * frac) continue;
      const curV = cp.overall * slotSuitability(cp.role, cp.hand, slot) * (0.6 + 0.4 * side.p[cur].energy);
      const newV = pl.overall * slotSuitability(pl.role, pl.hand, slot) * (0.6 + 0.4 * side.p[i].energy);
      const loss = curV - newV;
      if (!best || loss < best.loss) best = { slot, loss };
    }
    if (!best) continue;
    const out = side.slots[best.slot];
    side.slots[best.slot] = i;
    refreshSuit(st, s);
    done++;
    push(st, { type: 'sub', side: s as 0 | 1, p1: pl.id, p2: tm.players[out].id, tag: 'info' });
  }
  return done;
}

/** Cambi automatici: si fanno a gioco fermo (dopo un gol, nell'intervallo, nei time-out). */
function autoSubs(st: MatchState, s: number, rng: Rng, interval = false) {
  const side = st.sides[s];
  const tm = team(st, s);
  let changes = rotationSubs(st, s);
  for (let slot = 1; slot <= 6 && changes < 3; slot++) {
    const cur = side.slots[slot];
    if (cur < 0) continue;
    const ps = side.p[cur];
    const threshold = interval ? 0.7 : 0.6;
    if (ps.energy >= threshold) continue;
    const cand = benchCandidates(st, s, slot);
    if (!cand.length) continue;
    const b = cand[0];
    const pl = tm.players[cur];
    const bp = tm.players[b];
    const curV = pl.overall * slotSuitability(pl.role, pl.hand, slot) * (0.55 + 0.45 * ps.energy);
    const newV = bp.overall * slotSuitability(bp.role, bp.hand, slot) * (0.55 + 0.45 * side.p[b].energy);
    if (newV > curV * 1.03 || ps.energy < 0.45) {
      side.slots[slot] = b;
      refreshSuit(st, s);
      changes++;
      push(st, { type: 'sub', side: s as 0 | 1, p1: bp.id, p2: pl.id, tag: 'info' });
    }
  }
  // Portiere: cambio solo se in giornata nera e c'è un'alternativa.
  const gk = side.slots[0];
  if (gk >= 0 && interval && side.p[gk].line.goalsAgainst >= 7 && side.p[gk].line.saves <= 3 && rng.chance(0.5)) {
    const cand = benchCandidates(st, s, 0);
    if (cand.length) {
      side.slots[0] = cand[0];
      refreshSuit(st, s);
      push(st, { type: 'sub', side: s as 0 | 1, p1: tm.players[cand[0]].id, p2: tm.players[gk].id, tag: 'info', kind: 'gk' });
    }
  }
}

/** L'allenatore valuta la partita e adatta le tattiche (nei limiti di quelle che conosce). */
function coachReview(st: MatchState, s: number, rng: Rng) {
  const tm = team(st, s);
  const side = st.sides[s];
  const opp = st.sides[1 - s];
  const adapt = (tm.coach?.adattabilita ?? 35) / 100;
  if (!rng.chance(0.35 + adapt * 0.55)) return;
  const diff = st.score[s] - st.score[1 - s];
  const late = st.period >= 3;
  const oppTypes = opp.stats.goalTypes;
  let off = side.tactics.offense;
  let def = side.tactics.defense;
  const canO = (t: OffenseTactic) => tm.available.offense.includes(t);
  const canD = (t: DefenseTactic) => tm.available.defense.includes(t);
  if (late && diff <= -3) {
    if (canO('aggressivo')) off = 'aggressivo';
    else if (canO('rapido')) off = 'rapido';
    if (canD('pressing')) def = 'pressing';
    else if (canD('aggressiva')) def = 'aggressiva';
  } else if (late && diff >= 4) {
    off = 'organizzato';
    def = canD('zona') ? 'zona' : 'prudente';
  } else {
    const center = (oppTypes['centro'] ?? 0) + (oppTypes['rigore'] ?? 0);
    const distance = oppTypes['distanza'] ?? 0;
    if (center >= 3 && !['zona', 'zonaM', 'raddoppio'].includes(def)) {
      def = canD('zonaM') ? 'zonaM' : canD('raddoppio') ? 'raddoppio' : canD('zona') ? 'zona' : def;
    } else if (distance >= 4 && ['zona', 'zonaM', 'raddoppio'].includes(def)) {
      def = canD('aggressiva') ? 'aggressiva' : 'uomo';
    }
    // Se l'avversario difende a zona si cerca il tiro da fuori o le ali.
    const oppDef = opp.tactics.defense;
    if (['zona', 'zonaM', 'raddoppio'].includes(oppDef) && off === 'centroboa') {
      off = canO('ali') ? 'ali' : canO('distanza') ? 'distanza' : 'organizzato';
    }
    if (['aggressiva', 'pressing'].includes(oppDef) && canO('espulsione') && rng.chance(adapt)) off = 'espulsione';
  }
  if (off !== side.tactics.offense || def !== side.tactics.defense) {
    side.tactics.offense = off;
    side.tactics.defense = def;
    side.tacticLog.push({ period: st.period, clock: st.clock, offense: off, defense: def });
    push(st, { type: 'tactic', side: s as 0 | 1, text: `${OFFENSE[off].name} · ${DEFENSE[def].name}`, tag: 'tactic' });
  }
}

function aiTimeout(st: MatchState, s: number, rng: Rng) {
  const side = st.sides[s];
  const tm = team(st, s);
  if (side.timeouts <= 0 || !tm.coachAdjusts) return;
  const opp = st.sides[1 - s];
  const diff = st.score[s] - st.score[1 - s];
  const crunch = st.period === 4 && st.clock < 60 && diff >= -1 && diff <= 0 && st.possession === s;
  if (opp.run >= 3 || crunch) {
    if (rng.chance(crunch ? 0.7 : 0.55)) callTimeout(st, s as 0 | 1, rng);
  }
}

export function callTimeout(st: MatchState, s: 0 | 1, rng?: Rng) {
  const side = st.sides[s];
  if (side.timeouts <= 0 || st.finished) return false;
  side.timeouts--;
  side.stats.timeouts++;
  st.sides[1 - s].run = 0;
  side.momentum = Math.max(side.momentum, 0.1);
  for (const i of inWater(st, s)) side.p[i].energy = Math.min(side.p[i].maxEnergy, side.p[i].energy + 0.03);
  push(st, { type: 'timeout', side: s, tag: 'tactic' });
  const r = rng ?? new Rng(st);
  if (team(st, s).autoSubs) autoSubs(st, s, r, true);
  if (team(st, s).coachAdjusts) coachReview(st, s, r);
  return true;
}

// ─── Possesso ───────────────────────────────────────────────────────────────

function possession(st: MatchState, rng: Rng) {
  const A = st.possession;
  const D = (1 - A) as 0 | 1;
  aiTimeout(st, A, rng);
  const sa = st.sides[A];
  const sd = st.sides[D];
  sa.stats.possessions++;
  const rA = ratings(st, A);
  const rD = ratings(st, D);
  const teA = tacticEff(st, A, sa.tactics.offense);
  const teD = tacticEff(st, D, sd.tactics.defense);
  const ofx = scaleOff(OFFENSE[sa.tactics.offense].fx, teA);
  const dfx = scaleDef(DEFENSE[sd.tactics.defense].fx, teD);
  // L'avversario che ha appena perso palla: quanto è esposto al contropiede.
  const prevOff = scaleOff(OFFENSE[sd.tactics.offense].fx, tacticEff(st, D, sd.tactics.offense));
  const homeEdge = st.setup.neutral ? 0 : A === 0 ? 0.03 : -0.01;
  const mom = 0.15 * (sa.momentum - sd.momentum);
  const famA = team(st, A).familiarity[sa.tactics.offense] ?? 25;
  const disorg = famA < 40 ? (40 - famA) / 100 : 0;

  // 1) Contropiede
  if (st.transition === 'rebound' || st.transition === 'steal' || st.transition === 'turnover') {
    const steal = st.transition === 'steal' ? 0.85 : st.transition === 'turnover' ? 0.4 : 0;
    const gkLaunch = st.transition === 'rebound' && sa.slots[0] >= 0 ? d10(eff(st, A, sa.slots[0], 'rinvio'), 50) * 0.15 : 0;
    const pC = sigmoid(logit(0.09) + 0.15 * d10(rA.speed, rD.speed) + ofx.counter + prevOff.counterAgainst + steal + gkLaunch + mom);
    if (rng.chance(pC)) {
      counterAttack(st, rng, A, D, rA, rD);
      return;
    }
  }

  const time = clamp(rng.gauss(28 * ofx.tempo, 4.5), 11, 33);
  const hurried = st.clock < 8;
  tick(st, Math.min(time * 0.6, st.clock), A, rng);

  // 2) Palla persa / recupero difensivo
  const speedTerm = -dfx.speedSensitivity * 0.12 * d10(rA.speed, rD.speed);
  const techTerm = dfx.techSensitivity * 0.1 * d10(rD.tech, rA.tech);
  const pTO = sigmoid(logit(0.13) + 0.13 * d10(rD.press, rA.ballSecurity) + ofx.turnover + dfx.steal + disorg + speedTerm + techTerm - mom * 0.5 + (hurried ? 0.6 : 0));
  if (rng.chance(pTO)) {
    turnover(st, rng, A, D);
    return;
  }

  // 3) Fallo grave: espulsione o rigore
  const centerPow = rA.centerPower * (0.6 + 0.4 * dfx.center);
  let interact = 0;
  if (sa.tactics.offense === 'espulsione' && (sd.tactics.defense === 'aggressiva' || sd.tactics.defense === 'pressing')) interact += 0.25 * teA;
  const pFoul = sigmoid(
    logit(0.26) + 0.12 * d10(centerPow, rD.centerDef) + ofx.exclusion + dfx.exclConceded + interact - 0.05 * d10(rD.discipline, 50) + (homeEdge > 0 ? 0.03 : 0),
  );
  if (!hurried && rng.chance(pFoul)) {
    const penP = clamp(0.08 * ofx.penalty * Math.sqrt(centerPow / Math.max(20, rD.centerDef)), 0.03, 0.14);
    if (rng.chance(penP)) {
      const fouler = pickDefender(st, D, rng, true);
      registerFoul(st, D, fouler, rng, 'penalty');
      penalty(st, rng, A, D);
    } else {
      const fouler = pickDefender(st, D, rng, true);
      const drawer = pickDrawer(st, A, rng);
      registerFoul(st, D, fouler, rng, 'exclusion', drawer);
      manUp(st, rng, A, D, 0);
    }
    return;
  }

  // 4) Tiro
  tick(st, Math.min(time * 0.4, st.clock), A, rng);
  const weights: [ShotType, number][] = [
    ['distanza', ofx.mix.distanza * Math.pow(dfx.distance, 1.5)],
    ['centro', ofx.mix.centro * Math.pow(dfx.center, 1.5) * clamp(rA.centerPower / 50, 0.5, 1.5)],
    ['ala', ofx.mix.ala * Math.pow(dfx.wing, 1.5)],
    ['penetrazione', ofx.mix.penetrazione * Math.pow(dfx.drive, 1.5)],
  ];
  const type = weights[rng.weightedIndex(weights.map((w) => w[1]))][0];
  const conc = type === 'distanza' ? dfx.distance : type === 'centro' ? dfx.center : type === 'ala' ? dfx.wing : dfx.drive;
  const qual = ofx.quality + 0.6 * Math.log(conc) + homeEdge + mom + (hurried ? -0.4 : 0) - disorg * 0.5;
  shoot(st, rng, A, D, type, qual, ofx.blockAgainst, rD, null);
}

/**
 * Marcatore del centroboa avversario: in difesa non conta la posizione d'attacco,
 * ma chi ha le doti per farlo (di solito il difensore). Si sceglie tra le posizioni 1-5.
 */
function centreMarker(st: MatchState, s: number): number {
  const side = st.sides[s];
  let best = -1;
  let bestV = -1;
  for (let k = 1; k <= 5; k++) {
    const i = side.slots[k];
    if (i == null || i < 0) continue;
    const v = cv(st, s, i, 'centerDef');
    if (v > bestV) { bestV = v; best = i; }
  }
  return best >= 0 ? best : side.slots[6];
}

function pickDefender(st: MatchState, s: number, rng: Rng, center: boolean): number {
  const side = st.sides[s];
  const f = fieldIdx(st, s);
  const marker = center ? centreMarker(st, s) : -1;
  const w = f.map((i) => {
    let v = 1;
    if (center && marker === i) v *= 3;
    if (center && side.slots[6] === i) v *= 1.3;
    v *= 0.7 + team(st, s).players[i].temperament / 25;
    return v;
  });
  return f[rng.weightedIndex(w)];
}

function pickDrawer(st: MatchState, s: number, rng: Rng): number {
  const side = st.sides[s];
  const f = fieldIdx(st, s);
  const w = f.map((i) => (side.slots[6] === i ? 4 : 1) * (0.5 + eff(st, s, i, 'smarcamento') / 100));
  return f[rng.weightedIndex(w)];
}

function registerFoul(st: MatchState, s: number, idx: number, rng: Rng, kind: 'exclusion' | 'penalty', drawer?: number) {
  const side = st.sides[s];
  const ps = side.p[idx];
  const pl = team(st, s).players[idx];
  ps.fouls++;
  ps.line.exclCommitted++;
  side.stats.fouls++;
  const att = (1 - s) as 0 | 1;
  if (kind === 'exclusion') {
    st.sides[att].stats.exclusionsDrawn++;
    if (drawer != null) st.sides[att].p[drawer].line.exclDrawn++;
    push(st, { type: 'exclusion', side: att, p1: pl.id, p2: drawer != null ? team(st, att).players[drawer].id : undefined, tag: 'excl' });
  } else {
    push(st, { type: 'penalty', side: att, p1: pl.id, tag: 'excl' });
  }
  // Brutalità (rarissima): rosso e squalifica.
  if (rng.chance(0.004 * (pl.temperament / 10))) {
    ps.out = true;
    ps.line.redCard = true;
    push(st, { type: 'red', side: s as 0 | 1, p1: pl.id, tag: 'bad' });
    replaceOut(st, s, idx, rng);
    return;
  }
  if (ps.fouls >= 3 && hasReplacement(st, s, idx)) {
    ps.out = true;
    ps.line.fouledOut = true;
    push(st, { type: 'fouled_out', side: s as 0 | 1, p1: pl.id, tag: 'bad' });
    replaceOut(st, s, idx, rng);
  }
}

function turnover(st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1) {
  const sa = st.sides[A];
  const sd = st.sides[D];
  sa.stats.turnovers++;
  const f = fieldIdx(st, A);
  const loser = f[rng.weightedIndex(f.map((i) => 1.5 - eff(st, A, i, 'controlloPalla') / 100))];
  sa.p[loser].line.turnovers++;
  const r = rng.next();
  if (r < 0.58) {
    const df = fieldIdx(st, D);
    const stealer = df[rng.weightedIndex(df.map((i) => cv(st, D, i, 'steal')))];
    sd.p[stealer].line.steals++;
    sd.stats.steals++;
    push(st, { type: 'steal', side: D, p1: team(st, D).players[stealer].id, p2: team(st, A).players[loser].id, tag: 'info' });
    st.transition = 'steal';
  } else if (r < 0.82) {
    push(st, { type: 'turnover', side: A, p1: team(st, A).players[loser].id, kind: 'pass', tag: 'info' });
    st.transition = 'turnover';
  } else if (r < 0.93) {
    push(st, { type: 'turnover', side: A, p1: team(st, A).players[loser].id, kind: 'foul', tag: 'info' });
    st.transition = 'turnover';
  } else {
    push(st, { type: 'turnover', side: A, kind: 'shotclock', tag: 'info' });
    st.transition = 'rebound';
  }
  st.possession = D;
}

function shooterFor(st: MatchState, s: number, type: ShotType, rng: Rng, prefer: string[] = [], avoid?: string): number {
  const side = st.sides[s];
  const tm = team(st, s);
  const f = fieldIdx(st, s);
  const slotW: Record<ShotType, number[]> = {
    //            -  1    2    3    4    5    6
    distanza: [0, 0.6, 2.0, 2.4, 2.0, 0.6, 0.3],
    centro: [0, 0.2, 0.2, 0.6, 0.2, 0.2, 5],
    ala: [0, 3, 0.6, 0.2, 0.6, 3, 0.3],
    penetrazione: [0, 1, 1.4, 1.4, 1.4, 1, 0.5],
    controfuga: [0, 1, 1, 1, 1, 1, 0.6],
    superiorita: [0, 1.5, 1.6, 1.2, 1.6, 1.5, 1.2],
    rigore: [0, 1, 1, 1, 1, 1, 1],
  };
  const w = f.map((i) => {
    const slot = side.slots.indexOf(i);
    const skill = cv(st, s, i, shotKey(type));
    let v = slotW[type][slot] * Math.pow(Math.max(5, skill), 1.5) / 100;
    if (prefer.includes(tm.players[i].id)) v *= 3;
    if (avoid && tm.players[i].id === avoid) v *= 0.35;
    return v;
  });
  return f[rng.weightedIndex(w)];
}

function shoot(
  st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1, type: ShotType, qual: number, blockAgainst: number, rD: Ratings,
  forcedShooter: number | null, prefer: string[] = [], saveAdj = 0, blockAdj = 0, avoid?: string,
) {
  const sa = st.sides[A];
  const sd = st.sides[D];
  const shooter = forcedShooter ?? shooterFor(st, A, type, rng, prefer, avoid);
  // Il giocatore marcato in modo speciale tira peggio.
  const marked = avoid != null && team(st, A).players[shooter].id === avoid ? -0.25 : 0;
  qual += marked;
  const pl = team(st, A).players[shooter];
  const line = sa.p[shooter].line;
  const skill = cv(st, A, shooter, shotKey(type));
  const clutch = st.period === 4 && st.clock < 120 && Math.abs(st.score[0] - st.score[1]) <= 2
    ? d10(eff(st, A, shooter, 'freddezza'), 50) * 0.12 : 0;
  sa.stats.shots++;
  line.shots++;
  // Muro difensivo
  const pBlock = sigmoid(logit(BASE_BLOCK[type]) + 0.1 * d10(rD.block, skill) + blockAgainst + blockAdj);
  if (type !== 'rigore' && rng.chance(pBlock)) {
    const df = fieldIdx(st, D);
    const blocker = df[rng.weightedIndex(df.map((i) => eff(st, D, i, 'elevazione')))];
    sd.p[blocker].line.blocks++;
    sa.stats.blocked++;
    push(st, { type: 'shot_blocked', side: A, p1: pl.id, p2: team(st, D).players[blocker].id, kind: type, tag: 'save' });
    if (rng.chance(0.35)) {
      // La palla torna all'attacco: nuovo possesso breve.
      st.transition = 'start';
      st.possession = A;
    } else {
      st.transition = 'rebound';
      st.possession = D;
    }
    return;
  }
  const acc = eff(st, A, shooter, 'precisione');
  const pMiss = sigmoid(logit(BASE_MISS[type]) - 0.06 * d10(acc, 50) - clutch);
  if (rng.chance(pMiss)) {
    push(st, { type: 'shot_missed', side: A, p1: pl.id, kind: type, tag: 'info' });
    st.transition = 'rebound';
    st.possession = D;
    return;
  }
  sa.stats.shotsOnTarget++;
  line.shotsOnTarget++;
  const gkIdx = sd.slots[0];
  const pSave = sigmoid(logit(BASE_SAVE[type]) + 0.15 * d10(rD.gk, skill) - qual - clutch + saveAdj);
  if (gkIdx >= 0 && rng.chance(pSave)) {
    sd.p[gkIdx].line.saves++;
    sd.stats.saves++;
    push(st, { type: 'shot_saved', side: A, p1: pl.id, p2: team(st, D).players[gkIdx].id, kind: type, tag: 'save' });
    if (rng.chance(0.14)) {
      st.transition = 'start';
      st.possession = A;
    } else {
      st.transition = 'rebound';
      st.possession = D;
    }
    return;
  }
  goal(st, rng, A, D, shooter, type);
}

function goal(st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1, shooter: number, type: ShotType) {
  const sa = st.sides[A];
  const sd = st.sides[D];
  const pl = team(st, A).players[shooter];
  st.score[A]++;
  st.periods[st.period - 1][A]++;
  sa.stats.goals++;
  sa.stats.goalsByPeriod[st.period - 1]++;
  sa.stats.goalTypes[type] = (sa.stats.goalTypes[type] ?? 0) + 1;
  sa.p[shooter].line.goals++;
  if (type === 'rigore') sa.p[shooter].line.penGoals++;
  if (type === 'superiorita') sa.p[shooter].line.manUpGoals++;
  const gk = sd.slots[0];
  if (gk >= 0) sd.p[gk].line.goalsAgainst++;
  let assist: number | undefined;
  if (rng.chance(ASSIST_P[type])) {
    const f = fieldIdx(st, A).filter((i) => i !== shooter);
    if (f.length) {
      assist = f[rng.weightedIndex(f.map((i) => cv(st, A, i, 'passer')))];
      sa.p[assist].line.assists++;
    }
  }
  sa.run++;
  sd.run = 0;
  sa.momentum = clamp(sa.momentum + 0.25, -1, 1);
  sd.momentum = clamp(sd.momentum - 0.15, -1, 1);
  push(st, {
    type: 'goal', side: A, p1: pl.id, p2: assist != null ? team(st, A).players[assist].id : undefined, kind: type,
    score: [...st.score] as [number, number], tag: 'goal',
  });
  st.transition = 'afterGoal';
  st.possession = D;
  tick(st, 5, A, rng);
  // Gioco fermo dopo il gol: cambi.
  for (const s of [0, 1] as const) if (team(st, s).autoSubs) autoSubs(st, s, rng);
}

function counterAttack(st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1, rA: Ratings, rD: Ratings) {
  const sa = st.sides[A];
  sa.stats.counters++;
  const f = fieldIdx(st, A);
  const runner = f[rng.weightedIndex(f.map((i) => Math.pow(cv(st, A, i, 'speed'), 2)))];
  const oneOnZero = rng.chance(sigmoid(-1.2 + 0.15 * d10(rA.speed, rD.speed)));
  push(st, { type: 'counter', side: A, p1: team(st, A).players[runner].id, kind: oneOnZero ? '1v0' : '2v1', tag: 'info' });
  tick(st, rng.int(6, 11), A, rng);
  // La difesa può fermare il contropiede con un fallo.
  if (rng.chance(0.26)) {
    const fouler = pickDefender(st, D, rng, false);
    if (oneOnZero && rng.chance(0.35)) {
      registerFoul(st, D, fouler, rng, 'penalty');
      penalty(st, rng, A, D);
    } else {
      registerFoul(st, D, fouler, rng, 'exclusion', runner);
      manUp(st, rng, A, D, 0);
    }
    return;
  }
  const qual = (oneOnZero ? 0.45 : 0.1) + 0.15 * (sa.momentum - st.sides[D].momentum);
  const before = sa.stats.goals;
  shoot(st, rng, A, D, 'controfuga', qual, -0.4, rD, oneOnZero ? runner : null);
  if (sa.stats.goals > before) sa.stats.counterGoals++;
}

function manUp(st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1, depth: number) {
  const sa = st.sides[A];
  const sd = st.sides[D];
  sa.stats.manUp++;
  push(st, { type: 'manup', side: A, tag: 'excl' });
  const rA = ratings(st, A);
  const rD = ratings(st, D);
  const mu = sa.tactics.manUp;
  const md = sd.tactics.manDown;
  const teMU = tacticEff(st, A, `mu_${mu.formation}`);
  const teMD = tacticEff(st, D, `md_${md.style}`);
  tick(st, rng.int(9, 16), A, rng);
  // Qualità specifica della formazione.
  let formFit = 0;
  if (mu.formation === '4-2') {
    const posts = [sa.slots[1], sa.slots[5], sa.slots[6]].filter((i) => i >= 0);
    formFit = posts.length ? posts.reduce((t, i) => t + cv(st, A, i, 'posts'), 0) / posts.length : 30;
  } else {
    const flats = [sa.slots[2], sa.slots[3], sa.slots[4]].filter((i) => i >= 0);
    formFit = flats.length ? flats.reduce((t, i) => t + cv(st, A, i, 'flats'), 0) / flats.length : 30;
  }
  const att = rA.manUp * 0.65 + formFit * 0.35;
  const def = rD.manDown;
  // Palla persa in superiorità
  let pTurn = logit(0.07) + (mu.circulation === 'veloce' ? 0.25 : -0.2) + 0.08 * d10(def, att);
  if (md.style === 'aggressiva') pTurn += 0.45 * teMD;
  if (rng.chance(sigmoid(pTurn))) {
    const f = fieldIdx(st, A);
    const loser = f[rng.int(0, f.length - 1)];
    sa.p[loser].line.turnovers++;
    sa.stats.turnovers++;
    push(st, { type: 'manup_lost', side: A, p1: team(st, A).players[loser].id, tag: 'bad' });
    st.transition = md.style === 'aggressiva' ? 'steal' : 'turnover';
    st.possession = D;
    return;
  }
  // Seconda espulsione o rigore (strategia "centro").
  const centro = mu.strategy === 'centro' ? 0.06 * teMU : 0;
  if (depth === 0 && rng.chance(0.045 + centro)) {
    const fouler = pickDefender(st, D, rng, true);
    if (rng.chance(0.4)) {
      registerFoul(st, D, fouler, rng, 'penalty');
      penalty(st, rng, A, D);
    } else {
      registerFoul(st, D, fouler, rng, 'exclusion', pickDrawer(st, A, rng));
      push(st, { type: 'double_manup', side: A, tag: 'excl' });
      // 6 contro 4: altissima probabilità di gol.
      const before = sa.stats.goals;
      shoot(st, rng, A, D, 'superiorita', 0.9, -0.3, rD, null, mu.shooters);
      if (sa.stats.goals > before) sa.stats.manUpGoals++;
    }
    return;
  }
  // Tiro in superiorità
  let qual = 0.14 * d10(att, def) * (0.7 + 0.3 * teMU);
  let saveAdj = 0;
  let blockAdj = mu.formation === '3-3' ? 0.25 : 0;
  if (mu.circulation === 'veloce') qual += 0.12 * teMU;
  if (mu.strategy === 'pali') qual += 0.12 * teMU;
  if (mu.strategy === 'perimetro') qual += 0.04 * teMU;
  if (md.style === 'compatta') { if (mu.strategy === 'pali') qual -= 0.2 * teMD; else if (mu.strategy === 'perimetro') qual += 0.1; }
  if (md.style === 'porta') { saveAdj += 0.12 * teMD; if (mu.strategy === 'pali') qual += 0.1; }
  if (md.style === 'blocco') blockAdj += 0.35 * teMD;
  if (md.style === 'aggressiva') qual += 0.2;
  // Marcatura speciale su un tiratore
  const avoid = md.focusPlayerId ?? undefined;
  const prefer = mu.shooters.filter((id) => id !== avoid);
  const before = sa.stats.goals;
  shoot(st, rng, A, D, 'superiorita', qual + 0.1 * (sa.momentum - sd.momentum), 0, rD, null, prefer, saveAdj, blockAdj, avoid);
  if (sa.stats.goals > before) sa.stats.manUpGoals++;
}

function penalty(st: MatchState, rng: Rng, A: 0 | 1, D: 0 | 1) {
  const sa = st.sides[A];
  const tm = team(st, A);
  sa.stats.penalties++;
  tick(st, 6, A, rng);
  const water = fieldIdx(st, A);
  let taker = water.find((i) => tm.penaltyTakers.includes(tm.players[i].id));
  if (taker == null) {
    taker = water.reduce((b, i) => (cv(st, A, i, 'sh_rigore') > cv(st, A, b, 'sh_rigore') ? i : b), water[0]);
  }
  const before = sa.stats.goals;
  const rD = ratings(st, D);
  shoot(st, rng, A, D, 'rigore', 0, 0, rD, taker);
  if (sa.stats.goals > before) sa.stats.penaltyGoals++;
}

function shootout(st: MatchState, rng: Rng) {
  push(st, { type: 'shootout_start', side: -1, tag: 'big' });
  const pens: [number, number] = [0, 0];
  const order = [0, 1].map((s) => {
    const tm = team(st, s);
    const avail = tm.players.map((_, i) => i).filter((i) => !st.sides[s].p[i].out && tm.players[i].role !== 'POR');
    return avail.sort((a, b) => {
      const ia = tm.penaltyTakers.indexOf(tm.players[a].id);
      const ib = tm.penaltyTakers.indexOf(tm.players[b].id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return (tm.players[b].attrs.tiro + tm.players[b].attrs.freddezza) - (tm.players[a].attrs.tiro + tm.players[a].attrs.freddezza);
    });
  });
  const kick = (s: number, n: number) => {
    const tm = team(st, s);
    const list = order[s];
    const idx = list[n % Math.max(1, list.length)];
    const o = 1 - s;
    const gk = st.sides[o].slots[0];
    const gkV = gk >= 0 ? cv(st, o, gk, 'gkPen') : 10;
    const sk = cv(st, s, idx, 'sh_rigore');
    const p = sigmoid(logit(0.74) + 0.3 * d10(sk, gkV));
    const ok = rng.chance(p);
    if (ok) pens[s]++;
    push(st, { type: ok ? 'shootout_goal' : 'shootout_miss', side: s as 0 | 1, p1: tm.players[idx].id, score: [...pens] as [number, number], tag: ok ? 'goal' : 'save' });
  };
  for (let n = 0; n < 5; n++) {
    kick(0, n);
    if (pens[0] > pens[1] + (5 - n)) break;
    kick(1, n);
    if (pens[1] > pens[0] + (4 - n) || pens[0] > pens[1] + (4 - n)) break;
  }
  let n = 5;
  while (pens[0] === pens[1] && n < 40) {
    kick(0, n);
    kick(1, n);
    n++;
  }
  st.pens = pens;
}

// ─── Valutazioni ────────────────────────────────────────────────────────────

function computeRatings(st: MatchState) {
  for (const s of [0, 1]) {
    const side = st.sides[s];
    const won = st.score[s] > st.score[1 - s] || (st.pens && st.score[0] === st.score[1] && st.pens[s] > st.pens[1 - s]);
    const lost = st.score[s] < st.score[1 - s] || (st.pens && st.score[0] === st.score[1] && st.pens[s] < st.pens[1 - s]);
    for (let i = 0; i < side.p.length; i++) {
      const l = side.p[i].line;
      if (l.seconds < 30) { l.rating = 0; continue; }
      const mins = l.seconds / 60;
      let r = 6.0;
      if (team(st, s).players[i].role === 'POR') {
        const faced = l.saves + l.goalsAgainst;
        const pct = faced ? l.saves / faced : 0.4;
        r += (pct - 0.4) * 4 + l.saves * 0.08 - l.goalsAgainst * 0.04;
      } else {
        r += l.goals * 0.42 + l.assists * 0.22 + l.exclDrawn * 0.18 + l.steals * 0.22 + l.blocks * 0.18;
        r -= l.exclCommitted * 0.2 + l.turnovers * 0.18 + (l.shots - l.shotsOnTarget) * 0.07;
        if (l.fouledOut) r -= 0.3;
      }
      if (l.redCard) r -= 1;
      r += won ? 0.3 : lost ? -0.3 : 0;
      // Chi gioca poco ha voti più vicini al 6.
      const w = clamp(mins / 20, 0.3, 1);
      r = 6 + (r - 6) * w;
      l.rating = Math.round(clamp(r, 4, 10) * 10) / 10;
    }
  }
}

export function mvpOf(st: MatchState): string | null {
  let best: { id: string; r: number } | null = null;
  for (const s of [0, 1]) {
    const won = st.score[s] >= st.score[1 - s];
    for (const p of st.sides[s].p) {
      const r = p.line.rating + (won ? 0.05 : 0);
      if (p.line.rating > 0 && (!best || r > best.r)) best = { id: p.line.id, r };
    }
  }
  return best?.id ?? null;
}

// ─── Comandi dall'esterno (cronaca interattiva) ─────────────────────────────

export function substitute(st: MatchState, s: 0 | 1, slot: number, playerIdx: number): boolean {
  const side = st.sides[s];
  const tm = team(st, s);
  if (playerIdx < 0 || playerIdx >= tm.players.length) return false;
  if (side.p[playerIdx].out) return false;
  const cur = side.slots[slot];
  const other = side.slots.indexOf(playerIdx);
  if (other >= 0) {
    // Scambio di posizione tra due giocatori in acqua.
    side.slots[other] = cur;
    side.slots[slot] = playerIdx;
    refreshSuit(st, s);
    return true;
  }
  if (slot === 0 && tm.players[playerIdx].role !== 'POR') return false;
  side.slots[slot] = playerIdx;
  refreshSuit(st, s);
  push(st, { type: 'sub', side: s, p1: tm.players[playerIdx].id, p2: cur >= 0 ? tm.players[cur].id : undefined, tag: 'info' });
  return true;
}

export function setTactics(st: MatchState, s: 0 | 1, tactics: TacticsSetup) {
  const side = st.sides[s];
  const changed = tactics.offense !== side.tactics.offense || tactics.defense !== side.tactics.defense;
  side.tactics = JSON.parse(JSON.stringify(tactics));
  if (changed) {
    side.tacticLog.push({ period: st.period, clock: st.clock, offense: tactics.offense, defense: tactics.defense });
    push(st, { type: 'tactic', side: s, text: `${OFFENSE[tactics.offense].name} · ${DEFENSE[tactics.defense].name}`, tag: 'tactic' });
  }
}

export function setAuto(st: MatchState, s: 0 | 1, autoSubsOn: boolean, coachAdjusts: boolean) {
  const tm = team(st, s);
  tm.autoSubs = autoSubsOn;
  tm.coachAdjusts = coachAdjusts;
}

export function energyOf(st: MatchState, s: number, idx: number): number {
  return st.sides[s].p[idx].energy;
}
