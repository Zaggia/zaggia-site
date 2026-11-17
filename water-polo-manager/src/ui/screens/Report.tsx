import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Button, Empty, Panel } from '../components/ui';
import { describe, clockLabel, type NameBook } from '../../engine/match/commentary';
import type { MatchReport, PlayerMatchLine, TeamMatchStats } from '../../engine/types';
import { cls, formatDate, matchRatingColor } from '../format';
import { ROLE_SHORT } from '../../engine/player/attributes';

export function ReportScreen() {
  const world = useWorld();
  const id = useGame((s) => s.param);
  const r = id ? world.reports[id] : undefined;
  if (!r) return <Panel><Empty>Tabellino non disponibile (i tabellini delle stagioni più vecchie non vengono conservati).</Empty></Panel>;
  return <ReportView r={r} />;
}

function ReportView({ r }: { r: MatchReport }) {
  const world = useWorld();
  const s = useGame.getState();
  const [showAll, setShowAll] = useState(false);
  const home = world.clubs[r.homeId];
  const away = world.clubs[r.awayId];
  const userSide = r.homeId === world.userClubId ? 0 : r.awayId === world.userClubId ? 1 : -1;
  const names = new Map<string, string>();
  for (const side of r.players) for (const p of side) names.set(p.id, p.name);
  const nb: NameBook = { team: [r.homeName, r.awayName], player: (pid?: string) => (pid ? names.get(pid) ?? '' : ''), userSide };
  const mvp = r.mvpId ? r.players.flat().find((p) => p.id === r.mvpId) : null;
  const scorers = (side: 0 | 1) => r.players[side].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals);
  const keyEvents = r.events.filter((e) => ['goal', 'exclusion', 'penalty', 'fouled_out', 'red', 'injury', 'timeout', 'tactic', 'period_end', 'shootout_goal', 'shootout_miss'].includes(e.type));
  const evs = (showAll ? r.events : keyEvents).map((e, i) => ({ e, d: describe(e, nb, i) })).filter((x) => x.d);
  const us = (userSide === 1 ? 1 : 0) as 0 | 1;
  const won = userSide >= 0 && (r.score[us] > r.score[1 - us] || (r.pens != null && r.pens[us] > r.pens[1 - us]));
  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden fade-in">
        <div className="relative water-bg">
          <div className="absolute inset-0 bg-gradient-to-b from-abyss/30 to-abyss/90" />
          <div className="relative px-5 py-6">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-mute">
              <span>{r.compName}</span>
              <span className="capitalize">{formatDate(r.season, r.day, true)} · {r.attendance.toLocaleString('it-IT')} spettatori</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-4">
              <div className="flex flex-col items-center text-center"><Crest spec={home.crest} size={64} /><div className="font-display text-xl font-bold mt-2">{r.homeName}</div></div>
              <div className="text-center">
                <div className="font-display text-6xl font-extrabold num">{r.score[0]}<span className="text-mute mx-2">–</span>{r.score[1]}</div>
                {r.pens && <div className="text-gold text-sm">dopo i rigori {r.pens[0]}–{r.pens[1]}</div>}
                <div className="text-xs text-mute num mt-1">{r.periods.map((p) => `${p[0]}-${p[1]}`).join(' · ')}</div>
                {userSide >= 0 && <Badge tone={won ? 'good' : r.score[0] === r.score[1] && !r.pens ? 'neutral' : 'bad'} className="mt-2">{won ? 'Vittoria' : r.score[0] === r.score[1] && !r.pens ? 'Pareggio' : 'Sconfitta'}</Badge>}
              </div>
              <div className="flex flex-col items-center text-center"><Crest spec={away.crest} size={64} /><div className="font-display text-xl font-bold mt-2">{r.awayName}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-4 text-sm">
              <div className="text-right text-mute">{scorers(0).map((p) => `${p.name}${p.goals > 1 ? ` ${p.goals}` : ''}`).join(', ') || '—'}</div>
              <div className="text-mute">{scorers(1).map((p) => `${p.name}${p.goals > 1 ? ` ${p.goals}` : ''}`).join(', ') || '—'}</div>
            </div>
          </div>
        </div>
        {mvp && (
          <div className="px-5 py-3 border-t border-line flex items-center gap-3 text-sm">
            <Badge tone="gold">★ Migliore in acqua</Badge>
            <span className="font-semibold">{mvp.name}</span>
            <span className="text-mute">voto {mvp.rating.toFixed(1)} · {mvp.goals} gol · {mvp.assists} assist{mvp.saves ? ` · ${mvp.saves} parate` : ''}</span>
          </div>
        )}
      </section>
      <div className="grid lg:grid-cols-2 gap-5">
        <PlayerRatings title={r.homeName} lines={r.players[0]} mvp={r.mvpId} />
        <PlayerRatings title={r.awayName} lines={r.players[1]} mvp={r.mvpId} />
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5">
        <Panel title="Cronaca" actions={<Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Solo eventi chiave' : 'Cronaca completa'}</Button>}>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {evs.map(({ e, d }, i) => (
              <div key={i} className={cls('rounded-lg px-3 py-1.5 border-l-2 text-sm', e.type === 'goal' ? (e.side === userSide ? 'border-good bg-good/5' : 'border-bad bg-bad/5') : 'border-line')}>
                <span className="font-mono text-[11px] text-faint mr-2">{e.type === 'start' ? '' : clockLabel(e)}</span>
                {d!.title && <b className="mr-1">{d!.title}</b>}{d!.text}
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-5">
          <StaticStats stats={r.stats} names={[home.short, away.short]} />
          <Panel title="Tattiche usate">
            <div className="text-sm space-y-2">
              <div><b>{home.short}</b>: {r.tactics[0].offense} · {r.tactics[0].defense}</div>
              <div><b>{away.short}</b>: {r.tactics[1].offense} · {r.tactics[1].defense}</div>
            </div>
          </Panel>
          <div className="flex gap-2">
            <Button onClick={() => s.go('dashboard')}>Dashboard</Button>
            <Button variant="outline" onClick={() => s.go('classifica')}>Classifica</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerRatings({ title, lines, mvp }: { title: string; lines: PlayerMatchLine[]; mvp: string | null }) {
  const go = useGame((s) => s.go);
  const played = lines.filter((l) => l.seconds > 0);
  return (
    <Panel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase text-faint">
              <th className="text-left py-1">Giocatore</th><th title="Minuti">Min</th><th title="Gol">G</th><th title="Assist">A</th><th title="Tiri">T</th><th title="Espulsioni guadagnate">EG</th><th title="Espulsioni commesse">EC</th><th title="Recuperi">Rec</th><th title="Parate">Par</th><th>Voto</th>
            </tr>
          </thead>
          <tbody>
            {played.map((l) => (
              <tr key={l.id} className="border-t border-line/40 text-center">
                <td className="text-left py-1.5">
                  <button className="hover:underline" onClick={() => go('player', l.id)}>
                    <span className="text-faint text-xs mr-1">{l.number}</span>{l.name}
                    <span className="text-faint text-[10px] ml-1">{ROLE_SHORT[l.role]}</span>
                    {l.id === mvp && <span className="text-gold ml-1">★</span>}
                    {l.fouledOut && <span className="text-bad text-[10px] ml-1">3F</span>}
                    {l.injured && <span className="text-bad ml-1">✚</span>}
                    {l.redCard && <span className="text-bad ml-1">■</span>}
                  </button>
                </td>
                <td className="num text-mute">{Math.round(l.seconds / 60)}</td>
                <td className="num font-semibold">{l.goals || ''}</td>
                <td className="num">{l.assists || ''}</td>
                <td className="num text-mute">{l.shots || ''}</td>
                <td className="num">{l.exclDrawn || ''}</td>
                <td className="num">{l.exclCommitted || ''}</td>
                <td className="num">{l.steals || ''}</td>
                <td className="num">{l.saves || ''}</td>
                <td className="num font-bold" style={{ color: matchRatingColor(l.rating) }}>{l.rating ? l.rating.toFixed(1) : 'sv'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function StaticStats({ stats, names }: { stats: [TeamMatchStats, TeamMatchStats]; names: [string, string] }) {
  const [a, b] = stats;
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
    ['Falli gravi', a.fouls, b.fouls],
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
