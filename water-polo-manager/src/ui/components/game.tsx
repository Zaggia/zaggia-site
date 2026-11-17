// Componenti specifici del gioco riutilizzati in più schermate.

import type { ReactNode } from 'react';
import type { Club, Competition, Fixture, Player, World } from '../../engine/types';
import { useGame } from '../../store/game';
import { computeStandings } from '../../engine/competition/standings';
import { leagueRules } from '../../engine/data/config';
import { ROLE_SHORT, ROLE_LABELS } from '../../engine/player/attributes';
import { ageOf } from '../../engine/player/value';
import { knowledgeOf, overallRange, potentialRange } from '../../engine/world/queries';
import { STATUS_LABELS } from '../../engine/transfer/contracts';
import { Crest } from './Crest';
import { Avatar } from './Avatar';
import { Badge, Bar, DataTable, Flag, Ovr, type Column } from './ui';
import { cls, fmtK, formatShortDate } from '../format';

export function ClubName({ club, size = 22, link = true, short }: { club: Club; size?: number; link?: boolean; short?: boolean }) {
  const go = useGame((s) => s.go);
  const content = (
    <span className="inline-flex items-center gap-2 min-w-0 max-w-full align-middle">
      {size > 0 && <span className="shrink-0"><Crest spec={club.crest} size={size} /></span>}
      <span className={cls('truncate min-w-0', club.isUser && 'text-aqua font-semibold')}>{short ? club.short : club.name}</span>
    </span>
  );
  if (!link) return content;
  return (
    <button className="min-w-0 max-w-full hover:underline text-left inline-flex" onClick={(e) => { e.stopPropagation(); go('club', club.id); }}>
      {content}
    </button>
  );
}

export function PlayerName({ p, world, avatar }: { p: Player; world: World; avatar?: boolean }) {
  const go = useGame((s) => s.go);
  const club = p.clubId ? world.clubs[p.clubId] : null;
  return (
    <button className="inline-flex items-center gap-2 min-w-0 hover:underline text-left" onClick={(e) => { e.stopPropagation(); go('player', p.id); }}>
      {avatar && <Avatar player={p} color={club?.colors[0] ?? '#334155'} size={28} />}
      <span className="truncate font-medium">{p.firstName[0]}. {p.lastName}</span>
    </button>
  );
}

export function StatusBadges({ p, world }: { p: Player; world: World }) {
  const out: ReactNode[] = [];
  if (p.injury) out.push(<Badge key="i" tone="bad" title={`${p.injury.name}: ${p.injury.daysLeft} giorni`}>✚ {p.injury.daysLeft}g</Badge>);
  if (p.suspension > 0) out.push(<Badge key="s" tone="bad" title="Squalificato">Squal. {p.suspension}</Badge>);
  if (p.transferListed) out.push(<Badge key="t" tone="warn">In vendita</Badge>);
  if (p.loanListed) out.push(<Badge key="l" tone="warn">Prestito</Badge>);
  if (p.wantsToLeave) out.push(<Badge key="w" tone="bad">Vuole andare</Badge>);
  if (p.loan) out.push(<Badge key="lo" tone="violet" title={`Di proprietà di ${world.clubs[p.loan.fromClubId]?.name ?? ''}`}>In prestito</Badge>);
  if (p.contract && p.contract.endSeason <= world.season && p.clubId === world.userClubId) out.push(<Badge key="c" tone="warn">Scadenza</Badge>);
  if (world.clubs[world.userClubId].lineup.captainId === p.id) out.push(<Badge key="cap" tone="gold">C</Badge>);
  return <span className="inline-flex flex-wrap gap-1">{out}</span>;
}

export function playerColumns(world: World, opts: { own?: boolean; showClub?: boolean } = {}): Column<Player>[] {
  const own = opts.own ?? false;
  const cols: Column<Player>[] = [
    { key: 'n', label: '#', render: (p) => <span className="text-faint num">{p.capNumber || '—'}</span>, sort: (p) => p.capNumber, className: 'w-8' },
    { key: 'name', label: 'Giocatore', render: (p) => <PlayerName p={p} world={world} avatar />, sort: (p) => p.lastName },
    { key: 'role', label: 'Ruolo', render: (p) => <span title={ROLE_LABELS[p.role]} className="text-mute font-semibold">{ROLE_SHORT[p.role]}{p.hand === 'L' ? <span className="text-faint text-[10px] ml-1">mancino</span> : ''}</span>, sort: (p) => p.role },
    { key: 'age', label: 'Età', render: (p) => <span className="num">{ageOf(p, world.season)}</span>, sort: (p) => ageOf(p, world.season) },
    { key: 'nat', label: 'Naz.', render: (p) => <Flag code={p.nationality} />, sort: (p) => p.nationality, hideOnMobile: true },
  ];
  if (opts.showClub) {
    cols.push({ key: 'club', label: 'Club', render: (p) => (p.clubId ? <ClubName club={world.clubs[p.clubId]} size={18} /> : <span className="text-faint">Svincolato</span>), sort: (p) => (p.clubId ? world.clubs[p.clubId].name : 'zzz') });
  }
  cols.push(
    { key: 'ovr', label: 'OVR', render: (p) => <Ovr v={p.overall} size="sm" range={own ? undefined : overallRange(world, p)} />, sort: (p) => p.overall },
    {
      key: 'pot', label: 'POT', title: 'Potenziale stimato dagli osservatori',
      render: (p) => { const r = potentialRange(world, p); return <span className="num text-mute text-xs">{r[0] === r[1] ? r[0] : `${r[0]}–${r[1]}`}</span>; },
      sort: (p) => potentialRange(world, p)[1],
    },
  );
  if (own) {
    cols.push(
      { key: 'cond', label: 'Cond.', render: (p) => <div className="w-14"><Bar value={p.condition} height={5} /></div>, sort: (p) => p.condition, hideOnMobile: true },
      { key: 'mor', label: 'Morale', render: (p) => <div className="w-14"><Bar value={p.morale} height={5} color={p.morale < 35 ? '#ef4444' : p.morale < 55 ? '#f59e0b' : '#22c55e'} /></div>, sort: (p) => p.morale, hideOnMobile: true },
    );
  }
  cols.push(
    { key: 'val', label: 'Valore', render: (p) => <span className="num text-xs">{fmtK(p.value)}</span>, sort: (p) => p.value, hideOnMobile: true },
    { key: 'wage', label: 'Ingaggio', render: (p) => <span className="num text-xs text-mute">{p.contract ? fmtK(p.contract.wage) : '—'}</span>, sort: (p) => p.contract?.wage ?? 0, hideOnMobile: true },
  );
  if (own) {
    cols.push(
      { key: 'end', label: 'Scad.', render: (p) => <span className="num text-xs">{p.contract ? `${p.contract.endSeason + 1}` : '—'}</span>, sort: (p) => p.contract?.endSeason ?? 0, hideOnMobile: true },
      { key: 'st', label: 'Status', render: (p) => <span className="text-xs text-mute">{p.contract ? STATUS_LABELS[p.contract.status] : '—'}</span>, sort: (p) => p.contract?.status ?? '', hideOnMobile: true },
    );
  }
  cols.push({ key: 'badges', label: '', render: (p) => <StatusBadges p={p} world={world} /> });
  return cols;
}

export function PlayerTable({ world, players, own, showClub, initialSort = 'ovr' }: { world: World; players: Player[]; own?: boolean; showClub?: boolean; initialSort?: string }) {
  const go = useGame((s) => s.go);
  return (
    <DataTable
      rows={players}
      columns={playerColumns(world, { own, showClub })}
      rowKey={(p) => p.id}
      onRow={(p) => go('player', p.id)}
      initialSort={initialSort}
      dense
      empty="Nessun giocatore."
    />
  );
}

/** Zone della classifica in base al regolamento (promozione, playoff, playout, retrocessione). */
export function zoneFor(world: World, comp: Competition, pos: number, size: number): { color: string; label: string } | null {
  if (comp.kind === 'continental') return pos <= 2 ? { color: '#22d3ee', label: 'Qualificata alla fase finale' } : null;
  if (comp.kind !== 'league') return null;
  const r = leagueRules(world.rules, comp.key);
  if (pos <= r.directPromotion) return { color: '#22c55e', label: 'Promozione diretta' };
  if (pos > size - r.directRelegation) return { color: '#ef4444', label: 'Retrocessione diretta' };
  for (const ps of r.postseason) {
    if (ps.positions.includes(pos)) {
      if (ps.purpose === 'title') return { color: '#f5c518', label: ps.name };
      if (ps.purpose === 'promotion') return { color: '#22d3ee', label: ps.name };
      if (ps.purpose === 'playout') return { color: '#f59e0b', label: ps.name };
    }
  }
  if (comp.key === 'A1') {
    const slots = world.rules.continental.flatMap((c) => c.italySlots.map((s) => ({ s, name: c.name })));
    const e = slots.find((x) => x.s === pos);
    if (e) return { color: '#a78bfa', label: e.name };
  }
  return null;
}

export function StandingsTable({ world, comp, group, compact, highlight }: { world: World; comp: Competition; group: number; compact?: boolean; highlight?: string }) {
  const rows = computeStandings(world, comp, 0, group);
  const zones = rows.map((_, i) => zoneFor(world, comp, i + 1, rows.length));
  const legend = new Map<string, string>();
  zones.forEach((z) => z && legend.set(z.label, z.color));
  return (
    <div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-faint">
              <th className="text-left px-2 py-2 border-b border-line w-8">#</th>
              <th className="text-left px-2 py-2 border-b border-line">Squadra</th>
              <th className="px-1.5 py-2 border-b border-line" title="Partite giocate">G</th>
              <th className="px-1.5 py-2 border-b border-line" title="Vittorie">V</th>
              <th className="px-1.5 py-2 border-b border-line" title="Pareggi">N</th>
              <th className="px-1.5 py-2 border-b border-line" title="Sconfitte">P</th>
              {!compact && <th className="px-1.5 py-2 border-b border-line hidden sm:table-cell" title="Gol fatti">GF</th>}
              {!compact && <th className="px-1.5 py-2 border-b border-line hidden sm:table-cell" title="Gol subiti">GS</th>}
              <th className="px-1.5 py-2 border-b border-line" title="Differenza reti">DR</th>
              <th className="px-2 py-2 border-b border-line">Pt</th>
              {!compact && <th className="px-2 py-2 border-b border-line hidden md:table-cell">Forma</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const club = world.clubs[r.clubId];
              const z = zones[i];
              const pen = comp.penalties[r.clubId];
              return (
                <tr key={r.clubId} className={cls(club.isUser && 'bg-aqua/[0.07]', highlight === r.clubId && 'bg-gold/10')}>
                  <td className="px-2 py-1.5 border-b border-line/40">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1 h-5 rounded" style={{ background: z?.color ?? 'transparent' }} />
                      <span className="num text-mute">{i + 1}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border-b border-line/40 max-w-[220px]"><ClubName club={club} size={20} short={compact} /></td>
                  <td className="text-center num px-1.5 border-b border-line/40">{r.p}</td>
                  <td className="text-center num px-1.5 border-b border-line/40">{r.w}</td>
                  <td className="text-center num px-1.5 border-b border-line/40">{r.d}</td>
                  <td className="text-center num px-1.5 border-b border-line/40">{r.l}</td>
                  {!compact && <td className="text-center num px-1.5 border-b border-line/40 hidden sm:table-cell">{r.gf}</td>}
                  {!compact && <td className="text-center num px-1.5 border-b border-line/40 hidden sm:table-cell">{r.ga}</td>}
                  <td className="text-center num px-1.5 border-b border-line/40 text-mute">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                  <td className="text-center num px-2 border-b border-line/40 font-bold">{r.pts}{pen ? <span className="text-bad text-[10px] ml-0.5" title={`Penalizzazione di ${pen} punti`}>*</span> : null}</td>
                  {!compact && (
                    <td className="px-2 border-b border-line/40 hidden md:table-cell">
                      <span className="inline-flex gap-0.5">
                        {r.form.map((f, k) => <span key={k} className={cls('w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center', f === 'W' ? 'bg-good/80 text-abyss' : f === 'L' ? 'bg-bad/80' : 'bg-white/20')}>{f === 'W' ? 'V' : f === 'L' ? 'S' : 'P'}</span>)}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact && legend.size > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-mute">
          {[...legend].map(([l, c]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</span>)}
        </div>
      )}
    </div>
  );
}

export function FixtureLine({ world, f, onClick }: { world: World; f: Fixture; onClick?: () => void }) {
  const h = world.clubs[f.homeId];
  const a = world.clubs[f.awayId];
  const user = world.userClubId;
  let tone = '';
  if (f.played && (f.homeId === user || f.awayId === user)) {
    const us = f.homeId === user ? f.hg : f.ag;
    const them = f.homeId === user ? f.ag : f.hg;
    const pw = f.pens ? (f.homeId === user ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]) : null;
    tone = us > them || pw === true ? 'border-l-good' : us < them || pw === false ? 'border-l-bad' : 'border-l-mute';
  }
  return (
    <button onClick={onClick} className={cls('w-full text-left grid grid-cols-[48px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] border-l-2 border-transparent', tone)}>
      <span className="text-[11px] text-mute num">{formatShortDate(world.season, f.day)}</span>
      <span className="flex justify-end min-w-0 overflow-hidden"><ClubName club={h} size={18} link={false} /></span>
      <span className={cls('font-display font-bold num text-center min-w-[52px] rounded px-1.5', f.played ? 'bg-white/[0.06]' : 'text-faint')}>
        {f.played ? `${f.hg}–${f.ag}` : 'vs'}
        {f.pens && <span className="block text-[9px] text-mute font-sans">rig. {f.pens[0]}–{f.pens[1]}</span>}
      </span>
      <span className="min-w-0 overflow-hidden"><ClubName club={a} size={18} link={false} /></span>
      <span className="col-span-4 -mt-1 text-[10px] text-faint truncate pl-[56px]">{f.label}{f.neutral ? ' · campo neutro' : ''}</span>
    </button>
  );
}

export function KnowledgeNote({ world, p }: { world: World; p: Player }) {
  const k = knowledgeOf(world, p);
  if (k >= 100) return null;
  return <span className="text-[11px] text-faint">Conoscenza degli osservatori: {k}%</span>;
}
