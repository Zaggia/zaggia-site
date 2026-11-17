import { useEffect, useMemo, useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Bar, Button, Empty, Panel } from '../components/ui';
import { describe, clockLabel, type NameBook } from '../../engine/match/commentary';
import { callTimeout, energyOf, setAuto, setTactics, substitute, type MatchState } from '../../engine/match/engine';
import { DEFENSE, OFFENSE } from '../../engine/tactics/tactics';
import type { DefenseTactic, MatchEvent, OffenseTactic } from '../../engine/types';
import { SLOT_SHORT } from '../../engine/player/attributes';
import { cls } from '../format';
import { Icon } from '../components/icons';

const SPEEDS = [
  { label: 'Lenta', ms: 1600 },
  { label: 'Normale', ms: 900 },
  { label: 'Veloce', ms: 300 },
  { label: 'Turbo', ms: 60 },
];

export function MatchLive() {
  const world = useWorld();
  const live = useGame((s) => s.live);
  const s = useGame.getState();
  if (!live) {
    return (
      <Panel>
        <Empty>Nessuna partita in corso. <Button size="sm" variant="ghost" onClick={() => s.go('partite')}>Vai alle partite</Button></Empty>
      </Panel>
    );
  }
  return <LiveView key={live.fixtureId} worldSeason={world.season} />;
}

function LiveView({ worldSeason }: { worldSeason: number }) {
  const world = useWorld();
  const live = useGame((s) => s.live)!;
  const s = useGame.getState();
  const st = live.state;
  const userSide = st.setup.home.clubId === world.userClubId ? 0 : 1;
  const home = world.clubs[st.setup.home.clubId];
  const away = world.clubs[st.setup.away.clubId];
  const nb: NameBook = useMemo(() => {
    const names = new Map<string, string>();
    for (const t of [st.setup.home, st.setup.away]) for (const p of t.players) names.set(p.id, `${p.name} (${p.number})`);
    return { team: [home.name, away.name], player: (id?: string) => (id ? names.get(id) ?? '' : ''), userSide };
  }, [st, home, away, userSide]);
  // Avanzamento automatico
  useEffect(() => {
    if (live.paused || live.done) return;
    const t = setTimeout(() => {
      const before = st.events.length;
      useGame.getState().liveStep(1);
      // Pausa automatica nell'intervallo dei tempi per la cronaca lenta.
      const newEv = st.events.slice(before);
      if (live.mode === 'live' && newEv.some((e) => e.type === 'period_end' && e.period < 4)) {
        useGame.getState().liveUpdate({ paused: true });
      }
    }, live.speed);
    return () => clearTimeout(t);
  }, [live, st]);
  const last = st.events[st.events.length - 1];
  const period = last?.period ?? 1;
  const clock = last ? last.clock : st.setup.periodSeconds;
  const feed = st.events.map((e, i) => ({ e, i, d: describe(e, nb, i) })).filter((x) => x.d).reverse();
  const lastGoal = [...st.events].reverse().find((e) => e.type === 'goal');
  void worldSeason;
  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden">
        <div className="relative water-bg">
          <div className="absolute inset-0 bg-gradient-to-b from-abyss/30 to-abyss/90" />
          <div className="relative px-4 sm:px-6 py-5">
            <div className="flex justify-between text-xs text-mute">
              <span>{world.fixtures[live.fixtureId]?.label}</span>
              <span>{live.done ? 'FINALE' : `${period}° tempo`}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-3">
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-end text-center sm:text-right min-w-0">
                <div className="font-display text-lg sm:text-2xl font-bold truncate order-2 sm:order-1">{home.name}</div>
                <Crest spec={home.crest} size={54} className="order-1 sm:order-2" />
              </div>
              <div key={lastGoal ? st.events.indexOf(lastGoal) : -1} className="goal-flash rounded-2xl px-4 sm:px-6 py-2 text-center">
                <div className="font-display text-5xl sm:text-6xl font-extrabold num leading-none">{st.score[0]}<span className="text-mute mx-2">–</span>{st.score[1]}</div>
                {st.pens && <div className="text-xs text-gold mt-1">rigori {st.pens[0]}–{st.pens[1]}</div>}
                <div className="font-mono text-aqua text-lg mt-1">{live.done ? 'FINE' : `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`}</div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left min-w-0">
                <Crest spec={away.crest} size={54} />
                <div className="font-display text-lg sm:text-2xl font-bold truncate">{away.name}</div>
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-3 text-xs text-mute num">
              {st.periods.map((p, i) => <span key={i} className={cls(i + 1 === period && !live.done && 'text-aqua')}>{i + 1}°: {p[0]}–{p[1]}</span>)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-line">
          {!live.done ? (
            <>
              <Button size="sm" onClick={() => s.liveUpdate({ paused: !live.paused })}><Icon name={live.paused ? 'play' : 'pause'} size={16} />{live.paused ? 'Riprendi' : 'Pausa'}</Button>
              <div className="flex rounded-lg border border-line overflow-hidden">
                {SPEEDS.map((sp) => (
                  <button key={sp.label} onClick={() => s.liveUpdate({ speed: sp.ms })} className={cls('px-2.5 py-1 text-xs font-semibold', live.speed === sp.ms ? 'bg-aqua text-abyss' : 'text-mute hover:text-ink')}>{sp.label}</button>
                ))}
              </div>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => s.finishLive()}>Vai al risultato finale</Button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">Partita terminata.</span>
              <div className="flex-1" />
              <Button variant="gold" onClick={() => s.finishLive()}>Tabellino e statistiche</Button>
            </>
          )}
        </div>
      </section>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
        <Panel title="Cronaca">
          <div className="max-h-[560px] overflow-y-auto space-y-1.5 pr-1">
            {feed.map(({ e, i, d }) => <FeedItem key={i} e={e} d={d!} userSide={userSide} />)}
          </div>
        </Panel>
        <div className="space-y-4">
          {!live.done && <Bench st={st} side={userSide as 0 | 1} />}
          <LiveStats st={st} names={[home.short, away.short]} />
        </div>
      </div>
    </div>
  );
}

function FeedItem({ e, d, userSide }: { e: MatchEvent; d: { title?: string; text: string }; userSide: number }) {
  const goal = e.type === 'goal' || e.type === 'shootout_goal';
  const ours = e.side === userSide;
  return (
    <div className={cls(
      'rounded-lg px-3 py-2 border-l-2 fade-in',
      goal ? (ours ? 'bg-good/10 border-good' : 'bg-bad/10 border-bad') : e.tag === 'excl' ? 'bg-warn/5 border-warn/60' : e.tag === 'period' ? 'bg-aqua/5 border-aqua' : e.tag === 'tactic' ? 'bg-violet/5 border-violet' : e.tag === 'save' ? 'border-pool/60 bg-white/[0.02]' : 'border-line bg-white/[0.02]',
    )}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-faint whitespace-nowrap">{e.type === 'start' ? '' : clockLabel(e)}</span>
        {d.title && <span className={cls('font-display font-bold uppercase text-sm', goal ? (ours ? 'text-good' : 'text-bad') : 'text-ink')}>{d.title}</span>}
      </div>
      <div className="text-sm text-ink/90">{d.text}</div>
    </div>
  );
}

function Bench({ st, side }: { st: MatchState; side: 0 | 1 }) {
  const s = useGame.getState();
  const team = side === 0 ? st.setup.home : st.setup.away;
  const sd = st.sides[side];
  const [slot, setSlot] = useState<number | null>(null);
  const [off, setOff] = useState<OffenseTactic>(sd.tactics.offense);
  const [def, setDef] = useState<DefenseTactic>(sd.tactics.defense);
  const water = new Set(sd.slots);
  const doSub = (idx: number) => {
    if (slot == null) return;
    const ok = substitute(st, side, slot, idx);
    if (!ok) s.toast('Cambio non valido (in porta può entrare solo un portiere).', 'err');
    setSlot(null);
    s.liveUpdate({});
  };
  return (
    <Panel title="Panchina e tattica" subtitle="Tocca un giocatore in acqua e poi chi deve entrare.">
      <div className="space-y-1">
        {sd.slots.map((idx, k) => {
          if (idx < 0) return <div key={k} className="text-xs text-bad">{SLOT_SHORT[k]}: vuoto</div>;
          const p = team.players[idx];
          const ps = sd.p[idx];
          return (
            <button key={k} onClick={() => setSlot(slot === k ? null : k)} className={cls('w-full flex items-center gap-2 rounded-lg px-2 py-1 text-left', slot === k ? 'bg-gold/15 ring-1 ring-gold' : 'hover:bg-white/[0.04]')}>
              <span className="w-8 text-[10px] font-bold text-aqua">{SLOT_SHORT[k]}</span>
              <span className="flex-1 text-sm truncate">{p.name}</span>
              {ps.fouls > 0 && <Badge tone={ps.fouls >= 2 ? 'bad' : 'warn'}>{ps.fouls} f</Badge>}
              <span className="w-16"><Bar value={energyOf(st, side, idx) * 100} height={4} /></span>
            </button>
          );
        })}
      </div>
      <div className="text-xs text-mute uppercase tracking-wider mt-3 mb-1">In panchina</div>
      <div className="space-y-1">
        {team.players.map((p, idx) => {
          if (water.has(idx)) return null;
          const ps = sd.p[idx];
          return (
            <button key={p.id} disabled={ps.out || slot == null} onClick={() => doSub(idx)} className={cls('w-full flex items-center gap-2 rounded-lg px-2 py-1 text-left', slot != null && !ps.out ? 'hover:bg-aqua/10' : '', ps.out && 'opacity-40')}>
              <span className="w-8 text-[10px] text-faint">{p.role === 'POR' ? 'POR' : '#' + p.number}</span>
              <span className="flex-1 text-sm truncate">{p.name}{ps.out ? ' (fuori)' : ''}</span>
              <span className="w-16"><Bar value={ps.energy * 100} height={4} /></span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <select value={off} onChange={(e) => setOff(e.target.value as OffenseTactic)} aria-label="Attacco">
          {team.available.offense.map((t) => <option key={t} value={t}>{OFFENSE[t].name}</option>)}
        </select>
        <select value={def} onChange={(e) => setDef(e.target.value as DefenseTactic)} aria-label="Difesa">
          {team.available.defense.map((t) => <option key={t} value={t}>{DEFENSE[t].name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button size="sm" onClick={() => { setTactics(st, side, { ...sd.tactics, offense: off, defense: def }); s.liveUpdate({}); s.toast('Nuove istruzioni alla squadra.', 'ok'); }}>Applica tattica</Button>
        <Button size="sm" variant="outline" disabled={sd.timeouts <= 0} onClick={() => { callTimeout(st, side); s.liveUpdate({}); }}>Time-out ({sd.timeouts})</Button>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={team.autoSubs} onChange={(e) => { setAuto(st, side, e.target.checked, team.coachAdjusts); s.liveUpdate({}); }} /> Cambi automatici dell’allenatore</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={team.coachAdjusts} onChange={(e) => { setAuto(st, side, team.autoSubs, e.target.checked); s.liveUpdate({}); }} /> L’allenatore può cambiare tattica</label>
      </div>
    </Panel>
  );
}

export function LiveStats({ st, names }: { st: MatchState; names: [string, string] }) {
  const a = st.sides[0].stats;
  const b = st.sides[1].stats;
  const poss = a.possessionSeconds + b.possessionSeconds || 1;
  const rows: [string, number | string, number | string][] = [
    ['Possesso', `${Math.round((a.possessionSeconds / poss) * 100)}%`, `${Math.round((b.possessionSeconds / poss) * 100)}%`],
    ['Tiri', a.shots, b.shots],
    ['Tiri in porta', a.shotsOnTarget, b.shotsOnTarget],
    ['Parate', a.saves, b.saves],
    ['Espulsioni guadagnate', a.exclusionsDrawn, b.exclusionsDrawn],
    ['Superiorità (gol)', `${a.manUp} (${a.manUpGoals})`, `${b.manUp} (${b.manUpGoals})`],
    ['Rigori (gol)', `${a.penalties} (${a.penaltyGoals})`, `${b.penalties} (${b.penaltyGoals})`],
    ['Contropiedi (gol)', `${a.counters} (${a.counterGoals})`, `${b.counters} (${b.counterGoals})`],
    ['Palle recuperate', a.steals, b.steals],
    ['Palle perse', a.turnovers, b.turnovers],
    ['Tiri murati', a.blocked, b.blocked],
    ['Sprint vinti', a.sprintsWon, b.sprintsWon],
    ['Time-out', a.timeouts, b.timeouts],
  ];
  return (
    <Panel title="Statistiche">
      <div className="grid grid-cols-[1fr_auto_1fr] text-xs font-bold text-mute mb-1"><span>{names[0]}</span><span /><span className="text-right">{names[1]}</span></div>
      {rows.map(([l, x, y]) => (
        <div key={l} className="grid grid-cols-[48px_1fr_48px] items-center py-1 border-b border-line/40 text-sm">
          <span className="num font-semibold">{x}</span>
          <span className="text-center text-xs text-mute">{l}</span>
          <span className="num font-semibold text-right">{y}</span>
        </div>
      ))}
    </Panel>
  );
}
