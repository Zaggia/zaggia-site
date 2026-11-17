import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Empty, Kv, PageHeader, Panel, ResultDots, Stat } from '../components/ui';
import { PlayerTable } from '../components/game';
import { divisionOf, leagueComp } from '../../engine/world/queries';
import { positionOf } from '../../engine/competition/standings';
import { teamStrength } from '../../engine/club/lineup';
import { coachRating, PHILOSOPHY_LABELS } from '../../engine/staff/coach';
import { DEFENSE, OFFENSE, clubLevel } from '../../engine/tactics/tactics';
import { FACILITIES, FACILITY_KEYS } from '../../engine/club/facilities';
import { fmtMoney, seasonLabel } from '../format';

const PHIL: Record<string, string> = { giovani: 'Punta sui giovani', campioni: 'Compra campioni', prudente: 'Gestione prudente', equilibrata: 'Equilibrata', ambiziosa: 'Ambiziosa' };

export function ClubScreen() {
  const world = useWorld();
  const id = useGame((s) => s.param);
  const club = id ? world.clubs[id] : undefined;
  if (!club) return <Empty>Società non trovata.</Empty>;
  const comp = club.country === 'ITA' ? leagueComp(world, club.division) : undefined;
  const pos = comp ? positionOf(world, comp, club.id) : null;
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const players = club.playerIds.map((pid) => world.players[pid]).filter(Boolean);
  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden fade-in">
        <div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(120deg, ${club.colors[0]} 0%, transparent 60%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 p-5">
          <Crest spec={club.crest} size={80} />
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs uppercase tracking-[0.2em] text-mute">{divisionOf(world, club)} · {club.city}{club.country === 'ITA' ? ` (${club.region})` : ''}</div>
            <h1 className="font-display text-4xl font-extrabold leading-none mt-1">{club.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge>{PHIL[club.philosophy]}</Badge>
              <Badge tone="aqua">Livello {clubLevel(club)}</Badge>
              {club.isUser && <Badge tone="gold">La tua società</Badge>}
              {club.recent.length > 0 && <ResultDots recent={club.recent} />}
            </div>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Forza" value={teamStrength(world, club)} />
        <Stat label="Posizione" value={pos ? `${pos.pos}°` : '—'} />
        <Stat label="Reputazione" value={Math.round(club.reputation)} />
        <Stat label="Tifosi" value={club.fans.toLocaleString('it-IT')} />
        <Stat label="Saldo stimato" value={fmtMoney(Math.round(club.finances.balance / 10000) * 10000)} />
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-5">
        <div className="space-y-5">
          <Panel title="Società">
            <Kv k="Fondazione" v={club.founded} />
            <Kv k="Impianto" v={club.poolName} />
            <Kv k="Allenatore" v={coach ? `${coach.firstName} ${coach.lastName} (${coachRating(coach)})` : '—'} />
            {coach && <Kv k="Filosofia" v={PHILOSOPHY_LABELS[coach.philosophy]} />}
            <Kv k="Tattica" v={`${OFFENSE[club.tactics.offense].name} / ${DEFENSE[club.tactics.defense].name}`} />
            {FACILITY_KEYS.map((k) => <Kv key={k} k={FACILITIES[k].name} v={`Livello ${club.facilities[k].level}`} />)}
          </Panel>
          <Panel title="Albo">
            {club.honours.length ? club.honours.slice(-10).reverse().map((h, i) => <div key={i} className="text-sm">🏆 {h.label} <span className="text-faint">{seasonLabel(h.season)}</span></div>) : <Empty>Nessun trofeo recente.</Empty>}
            {club.history.length > 0 && (
              <div className="mt-3 space-y-0.5">
                {[...club.history].reverse().slice(0, 8).map((h) => <div key={h.season} className="text-xs text-mute">{seasonLabel(h.season)} · {h.division} · {h.outcome}</div>)}
              </div>
            )}
          </Panel>
        </div>
        <Panel title={`Rosa (${players.length})`}>
          <PlayerTable world={world} players={players} />
        </Panel>
      </div>
    </div>
  );
}

export { PageHeader };
