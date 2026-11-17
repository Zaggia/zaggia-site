import { ART } from '../art';
import { Icon } from '../components/icons';
import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Button, Kv, Panel, Stat } from '../components/ui';
import { ledgerTotals } from '../../engine/economy/ledger';
import { fmtMoney, seasonLabel } from '../format';

export function ReviewScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  if (world.phase === 'gameover') {
    return (
      <div className="max-w-2xl mx-auto mt-10 panel p-8 text-center fade-in">
        <Crest spec={club.crest} size={90} className="mx-auto opacity-50 grayscale" />
        <h1 className="font-display text-4xl font-extrabold mt-4 text-bad">FALLIMENTO</h1>
        <p className="text-mute mt-3">{world.gameOverReason}</p>
        <p className="text-sm text-faint mt-2">La tua avventura da presidente finisce qui. Puoi ricominciare con una nuova società o caricare un altro salvataggio.</p>
        <div className="flex justify-center gap-2 mt-6">
          <Button onClick={() => void s.closeCareer()}>Torna al menu</Button>
        </div>
      </div>
    );
  }
  const summary = world.seasonSummaries[world.seasonSummaries.length - 1];
  const rec = club.history[club.history.length - 1];
  const led = ledgerTotals(club.finances.ledger);
  if (world.phase !== 'review' || !summary || !rec) {
    return <Panel><p className="text-mute text-sm">La stagione è ancora in corso.</p></Panel>;
  }
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <section className="panel relative overflow-hidden text-center p-8 fade-in">
        <img src={ART.trofeo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-panel/60 via-panel/85 to-panel" />
        <div className="relative">
          <div className="text-gold text-sm font-semibold">Fine della stagione {seasonLabel(summary.season)}</div>
          <Crest spec={club.crest} size={90} className="mx-auto mt-4" />
          <h1 className="font-display text-5xl font-extrabold mt-3">{rec.outcome}</h1>
          <p className="text-mute mt-2">{rec.division === 'C' ? 'Serie C' : rec.division === 'B' ? 'Serie B' : `Serie ${rec.division}`}{rec.group ? ` · ${rec.group}` : ''} · {rec.points} punti ({rec.w}V {rec.d}N {rec.l}P) · gol {rec.gf}-{rec.ga}</p>
          {rec.cups.length > 0 && <div className="mt-3 flex justify-center gap-2">{rec.cups.map((c) => <Badge key={c} tone="gold"><Icon name="competizioni" size={12} weight="fill" /> {c}</Badge>)}</div>}
        </div>
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Risultato economico" value={fmtMoney(led.net)} tone={led.net < 0 ? 'bad' : 'good'} />
        <Stat label="Saldo" value={fmtMoney(club.finances.balance)} tone={club.finances.balance < 0 ? 'bad' : undefined} />
        <Stat label="Reputazione" value={Math.round(club.reputation)} />
        <Stat label="Tifosi" value={club.fans.toLocaleString('it-IT')} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Albo d’oro della stagione">
          {Object.entries(summary.champions).map(([k, v]) => (
            <Kv key={k} k={world.rules.leagues.find((l) => l.key === k)?.name ?? world.rules.cups.find((c) => c.key === k)?.name ?? world.rules.continental.find((c) => c.key === k)?.name ?? k} v={v.name} />
          ))}
        </Panel>
        <Panel title="Premi individuali (tuo campionato)">
          <Kv k="Miglior giocatore" v={summary.awards.mvp ?? '—'} />
          <Kv k="Capocannoniere" v={summary.awards.topScorer ?? '—'} />
          <Kv k="Miglior giovane" v={summary.awards.bestYoung ?? '—'} />
          {rec.topScorer && <Kv k="Tuo capocannoniere" v={rec.topScorer} />}
        </Panel>
      </div>
      <Panel title="Promozioni e retrocessioni">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {Object.keys(summary.promoted).map((k) => (
            <div key={k}>
              <div className="font-semibold">{world.rules.leagues.find((l) => l.key === k)?.name}</div>
              {summary.promoted[k].length > 0 && <div className="text-good text-xs">Promosse: {summary.promoted[k].join(', ')}</div>}
              {summary.relegated[k].length > 0 && <div className="text-bad text-xs">Retrocesse: {summary.relegated[k].join(', ')}</div>}
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <p className="text-sm text-mute max-w-xl">Con la nuova stagione: contratti scaduti, ritiri, nuovi calendari, sponsor e mercato estivo. I giocatori invecchiano: alcuni cresceranno, altri caleranno.</p>
          <Button size="lg" variant="gold" onClick={() => s.nextSeason()}>Inizia la stagione {seasonLabel(world.season + 1)}</Button>
        </div>
      </Panel>
    </div>
  );
}
