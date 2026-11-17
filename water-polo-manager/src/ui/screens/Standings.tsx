import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Badge, Empty, PageHeader, Panel, Tabs } from '../components/ui';
import { ClubName, FixtureLine, StandingsTable } from '../components/game';
import { leagueComp } from '../../engine/world/queries';
import { positionOf } from '../../engine/competition/standings';
import type { Competition, Phase, Tie, World } from '../../engine/types';
import { cls } from '../format';

export function StandingsScreen() {
  const world = useWorld();
  const user = world.clubs[world.userClubId];
  const [key, setKey] = useState(user.division);
  const comp = leagueComp(world, key);
  const userPos = comp ? positionOf(world, comp, user.id) : null;
  const [group, setGroup] = useState(userPos?.group ?? 0);
  const g = comp && group < comp.phases[0].groups.length ? group : 0;
  return (
    <div>
      <PageHeader title="Classifica" subtitle={comp?.name} />
      <Tabs value={key} onChange={(k) => { setKey(k); const c = leagueComp(world, k); const p = c ? positionOf(world, c, user.id) : null; setGroup(p?.group ?? 0); }} tabs={world.rules.leagues.map((l) => ({ id: l.key, label: l.name }))} />
      {!comp ? <Empty>Campionato non disponibile.</Empty> : (
        <div className="space-y-5">
          {comp.phases[0].groups.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {comp.phases[0].groups.map((gr, i) => (
                <button key={gr.name} onClick={() => setGroup(i)} className={cls('px-3 py-1.5 rounded-lg text-sm font-semibold border', g === i ? 'border-aqua text-aqua bg-aqua/10' : 'border-line text-mute hover:text-ink')}>
                  {gr.name}{gr.clubIds.includes(user.id) ? ' (il tuo girone)' : ''}
                </button>
              ))}
            </div>
          )}
          <div className="grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5">
            <Panel title={comp.phases[0].groups[g].name}>
              <StandingsTable world={world} comp={comp} group={g} />
            </Panel>
            <div className="space-y-5">
              <TopScorers world={world} comp={comp} group={g} />
              <RoundResults world={world} comp={comp} group={g} />
            </div>
          </div>
          {comp.phases.slice(1).filter((p) => p.sourceGroup == null || p.sourceGroup === g).map((p, i) => (
            <Panel key={i} title={p.name}><Bracket world={world} phase={p} /></Panel>
          ))}
          {comp.finished && (
            <Panel title="Verdetti">
              <div className="flex flex-wrap gap-2">
                {comp.winnerId && <Badge tone="gold">Campione: {world.clubs[comp.winnerId].name}</Badge>}
                {comp.promoted.map((id) => <Badge key={id} tone="good">Promossa: {world.clubs[id].name}</Badge>)}
                {comp.relegated.map((id) => <Badge key={id} tone="bad">Retrocessa: {world.clubs[id].name}</Badge>)}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function TopScorers({ world, comp, group }: { world: World; comp: Competition; group: number }) {
  const go = useGame((s) => s.go);
  const ids = new Set(comp.phases[0].groups[group].clubIds);
  const list = Object.values(world.players)
    .filter((p) => p.clubId && ids.has(p.clubId) && p.stats[comp.key]?.goals)
    .sort((a, b) => b.stats[comp.key].goals - a.stats[comp.key].goals)
    .slice(0, 10);
  return (
    <Panel title="Classifica marcatori">
      {list.length ? (
        <ol className="space-y-1">
          {list.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-faint num">{i + 1}</span>
              <button className="flex-1 text-left truncate hover:underline" onClick={() => go('player', p.id)}>{p.firstName[0]}. {p.lastName}</button>
              <span className="text-xs text-mute truncate max-w-[120px]">{world.clubs[p.clubId!].short}</span>
              <span className="font-bold num w-8 text-right">{p.stats[comp.key].goals}</span>
            </li>
          ))}
        </ol>
      ) : <Empty>Nessun gol ancora segnato.</Empty>}
    </Panel>
  );
}

function RoundResults({ world, comp, group }: { world: World; comp: Competition; group: number }) {
  const go = useGame((s) => s.go);
  const fx = comp.phases[0].groups[group].fixtureIds.map((id) => world.fixtures[id]).filter(Boolean);
  const rounds = Math.max(0, ...fx.map((f) => f.round)) + 1;
  const lastPlayed = Math.max(0, ...fx.filter((f) => f.played).map((f) => f.round));
  const [round, setRound] = useState(lastPlayed);
  const list = fx.filter((f) => f.round === round);
  return (
    <Panel title={`${round + 1}ª giornata`} actions={
      <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
        {Array.from({ length: rounds }).map((_, i) => <option key={i} value={i}>{i + 1}ª giornata</option>)}
      </select>
    }>
      {list.map((f) => <FixtureLine key={f.id} world={world} f={f} onClick={() => f.reportId && go('report', f.reportId)} />)}
    </Panel>
  );
}

export function Bracket({ world, phase }: { world: World; phase: Phase }) {
  const plan = phase.plan ?? [];
  const cols = plan.map((p, i) => ({ name: p.name, round: phase.rounds[i] }));
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {cols.map((c, i) => (
        <div key={i} className="min-w-[230px]">
          <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">{c.name}</div>
          <div className="space-y-2">
            {c.round ? c.round.ties.map((t) => <TieBox key={t.id} world={world} tie={t} />) : <div className="text-xs text-faint">Da definire</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TieBox({ world, tie }: { world: World; tie: Tie }) {
  const go = useGame((s) => s.go);
  const fx = tie.fixtureIds.map((id) => world.fixtures[id]).filter((f) => f && !f.cancelled);
  const score = (clubId: string | null) => {
    if (!clubId) return '';
    if (tie.format.kind === 'series') return String(tie.wins[clubId === tie.homeId ? 0 : 1]);
    let g = 0;
    for (const f of fx) if (f.played) g += f.homeId === clubId ? f.hg : f.ag;
    return fx.some((f) => f.played) ? String(g) : '';
  };
  const row = (clubId: string | null) => {
    if (!clubId) return <div className="text-xs text-faint px-2 py-1">Bye</div>;
    const c = world.clubs[clubId];
    const win = tie.winnerId === clubId;
    return (
      <div className={cls('flex items-center justify-between gap-2 px-2 py-1 text-sm', win && 'font-bold', tie.winnerId && !win && 'opacity-50')}>
        <span className="min-w-0 truncate"><ClubName club={c} size={16} /></span>
        <span className="num">{score(clubId)}</span>
      </div>
    );
  };
  const report = fx.find((f) => f.reportId);
  return (
    <div className={cls('panel-flat', report && 'cursor-pointer hover:border-line-2')} onClick={() => report?.reportId && go('report', report.reportId)}>
      {row(tie.homeId)}
      <div className="border-t border-line/50" />
      {row(tie.awayId)}
      {fx.some((f) => f.pens) && <div className="text-[10px] text-gold px-2 pb-1">ai rigori</div>}
      {tie.format.kind === 'series' && <div className="text-[10px] text-faint px-2 pb-1">Serie al meglio di {tie.format.bestOf}</div>}
    </div>
  );
}
