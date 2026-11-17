import { Icon } from '../components/icons';
import { useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, DataTable, Empty, PageHeader, Panel, Stat } from '../components/ui';
import type { ClubSeasonRecord, Player } from '../../engine/types';
import { fmtMoney, seasonLabel } from '../format';
import { useGame } from '../../store/game';

export function HistoryScreen() {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const club = world.clubs[world.userClubId];
  const hist = [...club.history].reverse();
  const best = club.history.reduce<ClubSeasonRecord | null>((b, h) => {
    const rank = (x: ClubSeasonRecord) => ['A1', 'A2', 'B', 'C'].indexOf(x.division) * 100 + (x.finalRank ?? 99);
    return !b || rank(h) < rank(b) ? h : b;
  }, null);
  // Marcatori di sempre: dallo storico dei giocatori ancora nel mondo.
  const scorers = new Map<string, { p: Player; goals: number; apps: number }>();
  for (const p of Object.values(world.players)) {
    for (const h of p.history) {
      if (h.clubId !== club.id) continue;
      const e = scorers.get(p.id) ?? { p, goals: 0, apps: 0 };
      e.goals += h.goals;
      e.apps += h.apps;
      scorers.set(p.id, e);
    }
  }
  const allTime = [...scorers.values()].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const cols = [
    { key: 's', label: 'Stagione', render: (h: ClubSeasonRecord) => <span className="num">{seasonLabel(h.season)}</span>, sort: (h: ClubSeasonRecord) => h.season },
    { key: 'd', label: 'Categoria', render: (h: ClubSeasonRecord) => <span>{h.division === 'C' ? 'Serie C' : h.division === 'B' ? 'Serie B' : `Serie ${h.division}`}{h.group ? <span className="text-faint text-xs"> · {h.group}</span> : ''}</span> },
    { key: 'p', label: 'Pos.', render: (h: ClubSeasonRecord) => (h.position ? `${h.position}°` : '—') },
    { key: 'r', label: 'V-N-P', render: (h: ClubSeasonRecord) => <span className="num">{h.w}-{h.d}-{h.l}</span> },
    { key: 'g', label: 'Gol', render: (h: ClubSeasonRecord) => <span className="num">{h.gf}-{h.ga}</span>, hideOnMobile: true },
    { key: 'pt', label: 'Punti', render: (h: ClubSeasonRecord) => <b className="num">{h.points}</b> },
    { key: 'o', label: 'Esito', render: (h: ClubSeasonRecord) => <Badge tone={/Promosso|Campione/.test(h.outcome) ? 'good' : /Retrocesso/.test(h.outcome) ? 'bad' : 'neutral'}>{h.outcome}</Badge> },
    { key: 'c', label: 'Trofei', render: (h: ClubSeasonRecord) => (h.cups.length ? <span className="text-gold text-xs">{h.cups.join(', ')}</span> : '—'), hideOnMobile: true },
    { key: 't', label: 'Capocannoniere', render: (h: ClubSeasonRecord) => <span className="text-xs text-mute">{h.topScorer ?? '—'}</span>, hideOnMobile: true },
    { key: 'a', label: 'Allenatore', render: (h: ClubSeasonRecord) => <span className="text-xs text-mute">{h.coach ?? '—'}</span>, hideOnMobile: true },
    { key: 'b', label: 'Saldo', render: (h: ClubSeasonRecord) => <span className={`num text-xs ${h.balance < 0 ? 'text-bad' : 'text-mute'}`}>{fmtMoney(h.balance)}</span>, hideOnMobile: true },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Storia del club" subtitle={`Fondato nel ${club.founded} · ${club.city}`} icon={<Crest spec={club.crest} size={48} />} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Stagioni" value={club.history.length} sub={`dal ${world.startSeason}`} />
        <Stat label="Trofei" value={club.honours.length} tone="aqua" />
        <Stat label="Miglior risultato" value={best ? best.outcome : '—'} sub={best ? `${seasonLabel(best.season)} · ${best.division}` : 'La storia comincia ora'} />
        <Stat label="Leggende" value={world.legends.length} sub="giocatori ritirati con almeno 20 presenze" />
      </div>
      <Panel title="Bacheca">
        {club.honours.length ? (
          <div className="flex flex-wrap gap-2">
            {[...club.honours].reverse().map((h, i) => <Badge key={i} tone="gold"><Icon name="competizioni" size={12} weight="fill" /> {h.label} {seasonLabel(h.season)}</Badge>)}
          </div>
        ) : <Empty>La bacheca è ancora vuota: la prima promozione sarà il primo trofeo.</Empty>}
      </Panel>
      <Panel title="Stagione per stagione">
        <DataTable rows={hist} columns={cols} rowKey={(h) => String(h.season)} empty="La prima stagione è in corso." dense />
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Marcatori di sempre">
          {allTime.length ? (
            <ol className="space-y-1">
              {allTime.map((e, i) => (
                <li key={e.p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-faint num">{i + 1}</span>
                  <button className="flex-1 text-left hover:underline" onClick={() => go('player', e.p.id)}>{e.p.firstName} {e.p.lastName}</button>
                  <span className="text-xs text-mute">{e.apps} pres.</span>
                  <span className="font-bold num w-10 text-right">{e.goals}</span>
                </li>
              ))}
            </ol>
          ) : <Empty>Le statistiche si registrano a fine stagione.</Empty>}
        </Panel>
        <Panel title="Leggende del club">
          {world.legends.length ? (
            <ul className="space-y-1 text-sm">
              {world.legends.map((l, i) => <li key={i} className="flex justify-between"><span>{l.name} <span className="text-faint text-xs">{l.seasons}</span></span><span className="text-mute">{l.apps} pres. · {l.goals} gol</span></li>)}
            </ul>
          ) : <Empty>Nessuna leggenda per ora.</Empty>}
        </Panel>
      </div>
      {world.seasonSummaries.length > 0 && (
        <Panel title="Il mondo della pallanuoto">
          <div className="space-y-3">
            {[...world.seasonSummaries].reverse().slice(0, 10).map((s) => (
              <div key={s.season} className="text-sm">
                <div className="font-semibold">{seasonLabel(s.season)}</div>
                <div className="text-mute text-xs">
                  {Object.entries(s.champions).map(([k, v]) => `${k === 'A1' ? 'Scudetto' : k}: ${v.name}`).join(' · ')}
                  {s.awards.mvp && ` · MVP: ${s.awards.mvp}`}{s.awards.topScorer && ` · Capocannoniere: ${s.awards.topScorer}`}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
