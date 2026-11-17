import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Bar, Button, Panel, ResultDots, Stat } from '../components/ui';
import { ClubName, FixtureLine, StandingsTable } from '../components/game';
import { cls, fmtMoney, formatDate, formatShortDate, seasonLabel } from '../format';
import { clubPlayers, divisionOf, lastResult, leagueComp, nextFixture } from '../../engine/world/queries';
import { positionOf } from '../../engine/competition/standings';
import { teamStrength } from '../../engine/club/lineup';
import { clubLevel, clubLevelThresholds } from '../../engine/tactics/tactics';
import { OBJECTIVE_LABELS } from '../../engine/economy/sponsors';
import { blocker } from '../../engine/season/advance';
import { rosterLimit } from '../../engine/club/roster';
import { RosterNotice } from '../components/RosterNotice';
import { financialHealth } from '../../engine/economy/finance';
import { Icon } from '../components/icons';
import { HelpTip } from '../components/ui';
import { ART } from '../art';
import { todoList } from '../../engine/club/todo';

export function Dashboard() {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const club = world.clubs[world.userClubId];
  const comp = leagueComp(world, club.division);
  const pos = comp ? positionOf(world, comp, club.id) : null;
  const next = nextFixture(world, club.id);
  const last = lastResult(world, club.id);
  const players = clubPlayers(world, club);
  const injured = players.filter((p) => p.injury);
  const suspended = players.filter((p) => p.suspension > 0);
  const unhappy = players.filter((p) => p.wantsToLeave || p.morale < 35);
  const expiring = players.filter((p) => p.contract && p.contract.endSeason <= world.season);
  const avgMorale = players.reduce((t, p) => t + p.morale, 0) / Math.max(1, players.length);
  const avgCond = players.reduce((t, p) => t + p.condition, 0) / Math.max(1, players.length);
  const lvl = clubLevel(club);
  const th = clubLevelThresholds();
  const nextTh = th[lvl] ?? th[th.length - 1];
  const prevTh = th[lvl - 1] ?? 0;
  const unread = world.inbox.filter((m) => !m.read).slice(0, 5);
  const health = financialHealth(world, club);
  const b = blocker(world);
  const groupSize = comp && pos ? comp.phases[0].groups[pos.group].clubIds.length : 0;
  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden fade-in">
        <img src={ART.piscina} alt="" className="absolute inset-y-0 right-0 h-full w-full md:w-[65%] object-cover opacity-90" />
        <div className="absolute inset-0 art-fade-left" />
        <div className="absolute inset-0 bg-panel/60 sm:hidden" />
        <div className="absolute inset-0 opacity-30 mix-blend-soft-light" style={{ background: `linear-gradient(110deg, ${club.colors[0]} 0%, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 p-5 sm:p-7">
          <Crest spec={club.crest} size={88} />
          <div className="flex-1 min-w-[220px]">
            <div className="text-sm text-mute">{divisionOf(world, club)}{pos && comp && comp.phases[0].groups.length > 1 ? `, ${comp.phases[0].groups[pos.group].name}` : ''} · {seasonLabel(world.season)}</div>
            <h1 className="font-display text-[44px] font-extrabold leading-none mt-1 uppercase tracking-wide">{club.name}</h1>
            <div className="text-sm text-mute mt-2">{club.poolName}, {club.city}</div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge tone="aqua">Obiettivo: {OBJECTIVE_LABELS[club.objective]}</Badge>
              <Badge tone={health.level === 'ok' ? 'good' : health.level === 'warn' ? 'warn' : 'bad'}>{health.label}</Badge>
              {club.recent.length > 0 && <ResultDots recent={club.recent} />}
            </div>
          </div>
          <div className="w-full sm:w-60 rounded-xl bg-abyss/60 backdrop-blur-sm border border-line px-4 py-3">
            <div className="flex justify-between text-xs text-mute mb-1.5"><span className="flex items-center gap-1">Livello società {lvl} <HelpTip>Sale con promozioni, trofei, stagioni nelle categorie alte e strutture. Ogni livello sblocca strutture, tattiche e sponsor migliori.</HelpTip></span><span className="mono">{club.devPoints}/{nextTh}</span></div>
            <Bar value={club.devPoints - prevTh} max={Math.max(1, nextTh - prevTh)} color="#f2c230" />
          </div>
        </div>
      </section>

      {b?.reason === 'roster' && <RosterNotice />}
      {b?.reason === 'match' && (
        <div className="panel border-gold/40 p-4 flex flex-wrap items-center gap-3 fade-in">
          <Icon name="ball" className="text-gold" size={24} weight="fill" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold">Oggi si gioca</div>
            <div className="text-sm text-mute">Controlla formazione e tattiche, poi scendi in vasca.</div>
          </div>
          <Button variant="gold" onClick={() => go('partite')}>Vai alla partita</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5">
        <TodoPanel />
        <Panel title="Prossima partita" actions={next && <Button size="sm" variant="outline" onClick={() => go('partite')}>Prepara</Button>}>
          {next ? <NextMatch fixtureId={next.id} /> : <p className="text-mute text-sm">Nessuna partita in programma.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Posizione" value={pos && club.recent.length ? `${pos.pos}°` : '—'} sub={groupSize ? `su ${groupSize} squadre` : 'Stagione non iniziata'} tone="aqua" />
        <Stat label="Saldo" value={fmtMoney(club.finances.balance)} tone={club.finances.balance < 0 ? 'bad' : 'good'} sub={`Patrimonio personale ${fmtMoney(world.presidentWealth)}`} />
        <Stat label="Reputazione" value={Math.round(club.reputation)} sub="su 100" />
        <Stat label="Tifosi" value={club.fans.toLocaleString('it-IT')} sub={`Abbonati ${club.abbonati}`} />
        <Stat label="Forza squadra" value={teamStrength(world, club)} sub="media titolari e panchina" />
        <Stat label="Rosa" value={`${players.length}/${rosterLimit(world)}`} sub={`${injured.length} infortunati · ${suspended.length} squalificati`} tone={players.length !== rosterLimit(world) ? 'bad' : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Ultimo risultato" actions={last?.reportId && <Button size="sm" variant="ghost" onClick={() => go('report', last.reportId)}>Tabellino</Button>}>
          {last ? <FixtureLine world={world} f={last} onClick={() => last.reportId && go('report', last.reportId)} /> : <p className="text-mute text-sm">La stagione non è ancora iniziata.</p>}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div><div className="text-xs text-mute mb-1">Morale medio</div><Bar value={avgMorale} color={avgMorale < 45 ? '#f59e0b' : '#22c55e'} /></div>
            <div><div className="text-xs text-mute mb-1">Condizione media</div><Bar value={avgCond} /></div>
            <div><div className="text-xs text-mute mb-1">Affiatamento</div><Bar value={club.chemistry} color="#a78bfa" /></div>
            <div><div className="text-xs text-mute mb-1">Preparazione atletica</div><Bar value={club.fitnessPrep} color="#38bdf8" /></div>
          </div>
        </Panel>
        <Panel title="Stato della rosa" actions={<Button size="sm" variant="ghost" onClick={() => go('rosa')}>Rosa</Button>}>
          <ul className="space-y-1.5 text-sm">
            {injured.map((p) => <li key={p.id} className="flex justify-between"><button className="hover:underline" onClick={() => go('player', p.id)}>{p.firstName[0]}. {p.lastName}</button><Badge tone="bad">{p.injury!.name} · {p.injury!.daysLeft}g</Badge></li>)}
            {suspended.map((p) => <li key={p.id} className="flex justify-between"><span>{p.lastName}</span><Badge tone="bad">Squalificato</Badge></li>)}
            {unhappy.map((p) => <li key={p.id} className="flex justify-between"><button className="hover:underline" onClick={() => go('player', p.id)}>{p.firstName[0]}. {p.lastName}</button><Badge tone="warn">{p.wantsToLeave ? 'Vuole andarsene' : 'Scontento'}</Badge></li>)}
            {expiring.slice(0, 4).map((p) => <li key={p.id} className="flex justify-between"><button className="hover:underline" onClick={() => go('player', p.id)}>{p.firstName[0]}. {p.lastName}</button><Badge tone="warn">Contratto in scadenza</Badge></li>)}
            {!injured.length && !suspended.length && !unhappy.length && !expiring.length && <li className="text-mute">Tutti disponibili e sereni.</li>}
          </ul>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5">
        <Panel title={comp ? `Classifica · ${comp.name}${pos && comp.phases[0].groups.length > 1 ? ` · ${comp.phases[0].groups[pos.group].name}` : ''}` : 'Classifica'} actions={<Button size="sm" variant="ghost" onClick={() => go('classifica')}>Completa</Button>}>
          {comp && pos ? <StandingsTable world={world} comp={comp} group={pos.group} compact /> : <p className="text-mute text-sm">—</p>}
        </Panel>
        <div className="space-y-5 min-w-0">
          <Panel title="Posta" actions={<Button size="sm" variant="ghost" onClick={() => go('posta')}>Tutta</Button>}>
            {unread.length ? (
              <ul className="space-y-1">
                {unread.map((m) => (
                  <li key={m.id}>
                    <button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/[0.04]" onClick={() => go('posta', m.id)}>
                      <div className={cls('text-sm font-medium truncate', m.important && 'text-gold')}>{m.title}</div>
                      <div className="text-xs text-mute truncate">{formatShortDate(m.season, m.day)} · {m.body}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-mute text-sm">Nessun messaggio da leggere.</p>}
          </Panel>
          <Panel title="Obiettivi">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-3"><span className="text-mute">Stagione</span><span className="font-semibold text-right">{OBJECTIVE_LABELS[club.objective]}</span></li>
              {club.sponsors.map((s) => (
                <li key={s.id} className="flex justify-between gap-3"><span className="text-mute truncate">{s.name}</span><span className="text-right">{OBJECTIVE_LABELS[s.objective]} <span className="text-good">(+{fmtMoney(s.bonus)})</span></span></li>
              ))}
              {club.partner && <li className="flex justify-between gap-3"><span className="text-mute">{club.partner.name}</span><span className="text-right">{OBJECTIVE_LABELS[club.partner.objective]} entro il {club.partner.untilSeason + 1}</span></li>}
            </ul>
          </Panel>
          <Panel title="Notizie" actions={<Button size="sm" variant="ghost" onClick={() => go('notizie')}>Tutte</Button>}>
            <ul className="space-y-2">
              {world.news.slice(0, 4).map((n) => (
                <li key={n.id} className="text-sm"><div className="font-medium">{n.title}</div><div className="text-xs text-mute">{formatDate(n.season, n.day)} · {n.body}</div></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NextMatch({ fixtureId }: { fixtureId: string }) {
  const world = useWorld();
  const f = world.fixtures[fixtureId];
  const home = f.homeId === world.userClubId;
  const opp = world.clubs[home ? f.awayId : f.homeId];
  const daysTo = f.day - world.day;
  return (
    <div>
      <div className="text-xs text-mute">{f.label}</div>
      <div className="flex items-center gap-3 mt-3">
        <Crest spec={opp.crest} size={52} />
        <div className="min-w-0">
          <div className="font-display text-2xl font-bold leading-tight truncate"><ClubName club={opp} size={0} /></div>
          <div className="text-sm text-mute">{home ? 'In casa' : 'In trasferta'}{f.neutral ? ' · campo neutro' : ''} · forza {teamStrength(world, opp)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="capitalize">{formatDate(world.season, f.day, true)}</span>
        <Badge tone={daysTo === 0 ? 'gold' : 'aqua'}>{daysTo === 0 ? 'Oggi' : daysTo === 1 ? 'Domani' : `Tra ${daysTo} giorni`}</Badge>
      </div>
      {opp.recent.length > 0 && <div className="mt-3 flex items-center gap-2 text-xs text-mute">Forma avversario <ResultDots recent={opp.recent} /></div>}
    </div>
  );
}

function TodoPanel() {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const items = todoList(world);
  const dot = { urgent: 'bg-gold', normal: 'bg-aqua', tip: 'bg-faint' } as const;
  return (
    <Panel title="Da fare adesso" subtitle={items.length ? 'Le prossime mosse utili, in ordine di urgenza.' : undefined}>
      {items.length ? (
        <ul className="divide-y divide-line -mx-1">
          {items.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button className="w-full flex items-center gap-3 px-1 py-2.5 text-left rounded-lg hover:bg-white/[0.03] group" onClick={() => go(t.view as Parameters<typeof go>[0], t.param)}>
                <span className={cls('h-2 w-2 rounded-full shrink-0', dot[t.tone])} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{t.title}</span>
                  <span className="block text-xs text-mute truncate">{t.detail}</span>
                </span>
                <Icon name="next" size={16} className="text-faint group-hover:text-aqua shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute py-2">Tutto in ordine. Premi <span className="text-ink font-medium">Continua</span> per andare avanti fino alla prossima novità.</p>
      )}
    </Panel>
  );
}
