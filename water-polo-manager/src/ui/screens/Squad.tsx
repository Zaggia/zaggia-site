import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Button, DataTable, PageHeader, Panel, Tabs, type Column } from '../components/ui';
import { PlayerName, PlayerTable, PlayerCards, ROLE_COLOR } from '../components/game';
import { GameIcon } from '../components/icons';
import { ROLES, ROLE_DESC, ROLE_LABELS, ROLE_SHORT } from '../../engine/player/attributes';
import type { Player, Role } from '../../engine/types';
import { cls, fmtMoney, matchRatingColor } from '../format';
import { annualWages } from '../../engine/economy/finance';
import { emptyStatLine } from '../../engine/player/generate';
import { rosterLimit } from '../../engine/club/roster';
import { RosterNotice } from '../components/RosterNotice';

export function Squad() {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const club = world.clubs[world.userClubId];
  const [tab, setTab] = useState<'rosa' | 'stats' | 'prestiti'>('rosa');
  const [role, setRole] = useState<Role | 'ALL'>('ALL');
  const [mode, setMode] = useState<'carte' | 'tabella'>('carte');
  const players = club.playerIds.map((id) => world.players[id]).filter(Boolean);
  const filtered = role === 'ALL' ? players : players.filter((p) => p.role === role);
  const loanedOut = Object.values(world.players).filter((p) => p.loan?.fromClubId === club.id);
  return (
    <div>
      <PageHeader
        title="Rosa"
        subtitle={`${players.length}/${rosterLimit(world)} giocatori · monte ingaggi ${fmtMoney(annualWages(world, club))} l’anno`}
        icon={<GameIcon name="squad" size={56} />}
        actions={<><Button variant="primary" icon="formazione" onClick={() => go('formazione')}>Schiera la formazione</Button><Button variant="gold" icon="mercato" onClick={() => go('mercato')}>Vai al mercato</Button></>}
      />
      <RosterNotice />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'rosa', label: 'Prima squadra' }, { id: 'stats', label: 'Statistiche stagionali' }, { id: 'prestiti', label: 'In prestito altrove', count: loanedOut.length }]} />
      {tab !== 'prestiti' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['ALL', ...ROLES] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cls('press h-9 px-3.5 rounded-full text-[13px] font-bold border-2 transition-colors', role === r ? 'text-[#06223f] border-transparent' : 'border-white/15 bg-white/[0.06] text-mute hover:text-ink hover:bg-white/10')}
              style={role === r ? { background: r === 'ALL' ? '#34dcf2' : ROLE_COLOR[r] } : undefined}
            >
              {r === 'ALL' ? 'Tutti' : ROLE_LABELS[r]}
            </button>
          ))}
          {tab === 'rosa' && (
            <div className="ml-auto flex rounded-full bg-black/25 p-1 border border-white/10">
              {([['carte', 'Carte'], ['tabella', 'Tabella']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)} className={cls('h-8 px-4 rounded-full text-[13px] font-bold transition-colors', mode === k ? 'bg-aqua text-[#032a3a]' : 'text-mute hover:text-ink')}>{l}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'rosa' && mode === 'carte' ? (
        <PlayerCards world={world} players={filtered} own />
      ) : (
        <Panel pad>
          <div className="pt-1">
            {tab === 'rosa' && <PlayerTable world={world} players={filtered} own />}
            {tab === 'stats' && <SeasonStatsTable players={filtered} />}
            {tab === 'prestiti' && <PlayerTable world={world} players={loanedOut} showClub />}
          </div>
        </Panel>
      )}
      <Panel title="I ruoli della pallanuoto" subtitle="In attacco le posizioni sono numerate da 1 a 6; in difesa ognuno marca il suo uomo." className="mt-5">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-2xl bg-white/[0.05] border-2 border-white/10 p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex min-w-10 justify-center rounded-full text-[#06223f] text-xs font-extrabold px-2 py-0.5" style={{ background: ROLE_COLOR[r] }}>{ROLE_SHORT[r]}</span>
                <span className="font-semibold text-sm">{ROLE_LABELS[r]}</span>
                <span className="ml-auto text-xs text-faint num">{players.filter((p) => p.role === r).length}</span>
              </div>
              <p className="text-xs text-mute leading-snug">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function totals(p: Player) {
  const t = emptyStatLine();
  for (const s of Object.values(p.stats)) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s[k];
  return t;
}

export function SeasonStatsTable({ players }: { players: Player[] }) {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const cols: Column<Player>[] = [
    { key: 'name', label: 'Giocatore', render: (p) => <PlayerName p={p} world={world} />, sort: (p) => p.lastName },
    { key: 'role', label: 'R', render: (p) => <span className="text-mute">{ROLE_SHORT[p.role]}</span>, sort: (p) => p.role },
    { key: 'apps', label: 'Pres.', render: (p) => totals(p).apps, sort: (p) => totals(p).apps },
    { key: 'min', label: 'Min.', render: (p) => totals(p).minutes, sort: (p) => totals(p).minutes, hideOnMobile: true },
    { key: 'g', label: 'Gol', render: (p) => <b>{totals(p).goals}</b>, sort: (p) => totals(p).goals },
    { key: 'a', label: 'Assist', render: (p) => totals(p).assists, sort: (p) => totals(p).assists },
    { key: 'sup', label: 'Gol sup.', render: (p) => totals(p).manUpGoals, sort: (p) => totals(p).manUpGoals, hideOnMobile: true },
    { key: 'esp', label: 'Esp. sub.', render: (p) => totals(p).exclDrawn, sort: (p) => totals(p).exclDrawn, title: 'Espulsioni guadagnate', hideOnMobile: true },
    { key: 'espc', label: 'Esp. comm.', render: (p) => totals(p).exclCommitted, sort: (p) => totals(p).exclCommitted, hideOnMobile: true },
    { key: 'rec', label: 'Recuperi', render: (p) => totals(p).steals, sort: (p) => totals(p).steals, hideOnMobile: true },
    { key: 'par', label: 'Parate', render: (p) => totals(p).saves || '—', sort: (p) => totals(p).saves },
    {
      key: 'avg', label: 'Media voto',
      render: (p) => { const t = totals(p); const v = t.apps ? t.ratingSum / t.apps : 0; return v ? <span style={{ color: matchRatingColor(v) }} className="font-semibold num">{v.toFixed(2)}</span> : '—'; },
      sort: (p) => { const t = totals(p); return t.apps ? t.ratingSum / t.apps : 0; },
    },
    { key: 'mvp', label: 'MVP', render: (p) => totals(p).mvp || '—', sort: (p) => totals(p).mvp },
  ];
  return <DataTable rows={players} columns={cols} rowKey={(p) => p.id} onRow={(p) => go('player', p.id)} initialSort="g" dense />;
}
