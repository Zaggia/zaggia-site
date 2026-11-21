import { Icon } from '../components/icons';
import { ART } from '../art';
import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { ArtBanner, Badge, Button, Empty, Panel, ResultDots } from '../components/ui';
import { ClubName, FixtureLine } from '../components/game';
import { blocker, availableCount } from '../../engine/season/advance';
import { RosterNotice } from '../components/RosterNotice';
import { clubFixtures, nextFixture } from '../../engine/world/queries';
import { teamStrength, validateLineup } from '../../engine/club/lineup';
import { squadProfile } from '../../engine/ai/tactics';
import { DEFENSE, OFFENSE } from '../../engine/tactics/tactics';
import { formatDate } from '../format';
import type { Club, Fixture, World } from '../../engine/types';
import { Avatar } from '../components/Avatar';
import { ROLE_SHORT } from '../../engine/player/attributes';
import { seasonStatsTotal } from '../../engine/world/queries';

export function MatchesScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const b = blocker(world);
  const today = b?.reason === 'match' && b.fixtureId ? world.fixtures[b.fixtureId] : null;
  const next = nextFixture(world, club.id);
  const all = clubFixtures(world, club.id);
  const played = all.filter((f) => f.played).reverse();
  const upcoming = all.filter((f) => !f.played && !f.ifNeeded);
  const focus = today ?? next;
  return (
    <div className="space-y-5">
      <ArtBanner image={ART.partita} title="Partite">{played.length} giocate, {upcoming.length} da giocare in stagione.</ArtBanner>
      {b?.reason === 'roster' && <RosterNotice />}
      {focus ? <MatchPrep world={world} f={focus} isToday={!!today} /> : <Panel><Empty>Nessuna partita in programma: la stagione riprenderà presto.</Empty></Panel>}
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Prossimi impegni">
          {upcoming.length ? upcoming.slice(0, 12).map((f) => <FixtureLine key={f.id} world={world} f={f} />) : <Empty>Nessun impegno.</Empty>}
        </Panel>
        <Panel title="Risultati">
          {played.length ? played.map((f) => <FixtureLine key={f.id} world={world} f={f} onClick={() => f.reportId && s.go('report', f.reportId)} />) : <Empty>Ancora nessuna partita giocata.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

function MatchPrep({ world, f, isToday }: { world: World; f: Fixture; isToday: boolean }) {
  const s = useGame.getState();
  const user = world.clubs[world.userClubId];
  const home = world.clubs[f.homeId];
  const away = world.clubs[f.awayId];
  const opp = f.homeId === user.id ? away : home;
  const issues = validateLineup(world, user, user.lineup);
  const errors = issues.filter((i) => i.level === 'error');
  const enough = availableCount(world, user) >= 7;
  return (
    <section className="panel overflow-hidden fade-in">
      <div className="relative water-bg">
        <div className="absolute inset-0 bg-gradient-to-b from-abyss/40 to-abyss/90" />
        <div className="relative px-5 pt-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Badge tone={isToday ? 'gold' : 'aqua'}>{isToday ? 'OGGI SI GIOCA' : 'Prossima partita'}</Badge>
            <span className="text-mute capitalize">{formatDate(world.season, f.day, true)} · {f.label}{f.neutral ? ' · campo neutro' : ` · ${home.poolName}`}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-5">
            <TeamSide world={world} club={home} />
            <div className="font-display text-4xl font-extrabold text-mute">VS</div>
            <TeamSide world={world} club={away} />
          </div>
        </div>
      </div>
      <div className="p-5 grid lg:grid-cols-2 gap-5">
        <div>
          <h4 className="font-display uppercase font-bold text-sm tracking-wider text-mute mb-2">Rapporto sull’avversario</h4>
          <ScoutReport world={world} club={opp} />
        </div>
        <div>
          <h4 className="font-display uppercase font-bold text-sm tracking-wider text-mute mb-2">La tua squadra</h4>
          <div className="text-sm space-y-1">
            <div>Attacco: <b>{OFFENSE[user.tactics.offense].name}</b> · Difesa: <b>{DEFENSE[user.tactics.defense].name}</b></div>
            <div className="text-mute">Superiorità {user.tactics.manUp.formation} · inferiorità {user.tactics.manDown.style}</div>
          </div>
          {issues.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {issues.slice(0, 5).map((i, k) => <li key={k} className={i.level === 'error' ? 'text-bad' : 'text-warn'}><Icon name={i.level === 'error' ? 'cross' : 'warn'} size={14} className="inline align-[-2px] mr-1" />{i.text}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="outline" icon="formazione" onClick={() => s.go('formazione')}>Formazione</Button>
            <Button size="sm" variant="outline" icon="tattiche" onClick={() => s.go('tattiche')}>Tattiche</Button>
          </div>
          {isToday ? (
            <div className="mt-5">
              {!enough ? (
                <div className="space-y-2">
                  <p className="text-sm text-bad">Non hai 7 giocatori disponibili. Tessera degli svincolati, promuovi dei giovani oppure accetta la sconfitta a tavolino.</p>
                  <Button variant="danger" icon="cross" onClick={() => s.forfeit()}>Rinuncia alla partita (0–5)</Button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-2">
                  <Button variant="gold" size="lg" icon="play" title="Guarda la partita minuto per minuto e cambia tattica mentre si gioca" disabled={errors.length > 0} onClick={() => s.startMatch('live')}>Segui la cronaca</Button>
                  <Button size="lg" variant="primary" icon="forward" title="Simula la partita velocemente e mostra solo il tabellino" disabled={errors.length > 0} onClick={() => s.startMatch('fast')}>Simula veloce</Button>
                  <Button size="lg" variant="outline" icon="bolt" title="Vedi subito il risultato finale" disabled={errors.length > 0} onClick={() => s.startMatch('instant')}>Risultato immediato</Button>
                </div>
              )}
              <p className="text-[11px] text-faint mt-2">Nella cronaca puoi fare cambi, chiamare time-out e cambiare tattica in qualsiasi momento.</p>
            </div>
          ) : (
            <div className="mt-5">
              <Button variant="primary" size="lg" icon="forward" onClick={() => void s.continueGame('auto')}>Avanza fino alla partita</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TeamSide({ world, club }: { world: World; club: Club }) {
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <Crest spec={club.crest} size={72} />
      <div className="font-display text-xl sm:text-2xl font-extrabold mt-2 leading-tight max-w-full [&_.truncate]:whitespace-normal [&_.truncate]:overflow-visible [&_button]:max-w-full"><ClubName club={club} size={0} /></div>
      <div className="text-xs text-mute mt-1">Forza {teamStrength(world, club)} · reputazione {Math.round(club.reputation)}</div>
      {club.recent.length > 0 && <div className="mt-2"><ResultDots recent={club.recent} /></div>}
    </div>
  );
}

function ScoutReport({ world, club }: { world: World; club: Club }) {
  const prof = squadProfile(world, club);
  const stars = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall).slice(0, 4);
  const notes: string[] = [];
  if (prof.cf > prof.overall + 5) notes.push('Centroboa molto pericoloso: valuta zona o raddoppio.');
  if (prof.shooters > prof.overall + 5) notes.push('Tiratori dalla distanza temibili: la zona può costare cara.');
  if (prof.speed > prof.overall + 5) notes.push('Squadra veloce: attenzione ai contropiedi e alla marcatura a uomo.');
  if (prof.press > prof.overall + 4) notes.push('Difesa aggressiva: la ricerca dell’espulsione può pagare.');
  if (!notes.length) notes.push('Squadra senza punti di forza evidenti.');
  return (
    <div className="text-sm space-y-2">
      <div>Tattica abituale: <b>{OFFENSE[club.tactics.offense].name}</b> / <b>{DEFENSE[club.tactics.defense].name}</b></div>
      <ul className="text-mute text-xs space-y-0.5">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {stars.map((p) => (
          <button key={p.id} className="flex items-center gap-2 text-left rounded-lg hover:bg-white/[0.04] p-1" onClick={() => useGame.getState().go('player', p.id)}>
            <Avatar player={p} color={club.colors[0]} size={30} />
            <div className="min-w-0"><div className="text-xs font-semibold truncate">{p.lastName}</div><div className="text-[10px] text-mute">{ROLE_SHORT[p.role]} · {p.overall} · {seasonStatsTotal(p).goals} gol</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}
