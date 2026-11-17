import { useGame, useWorld } from '../../store/game';
import { Badge, Bar, PageHeader, Panel } from '../components/ui';
import {
  DEFENSE, MANDOWN_STYLES, MANUP_CIRCULATION, MANUP_FORMATIONS, MANUP_STRATEGY, OFFENSE, familiarity, organizationCapacity,
  type TacticInfo,
} from '../../engine/tactics/tactics';
import type { DefenseTactic, ManDownStyle, ManUpCirculation, ManUpFormation, ManUpStrategy, OffenseTactic, TacticId, TacticsSetup, TrainingFocus, TrainingIntensity } from '../../engine/types';
import { cls } from '../format';
import { nextFixture } from '../../engine/world/queries';
import { PHILOSOPHY_LABELS } from '../../engine/staff/coach';

const FOCUS: { id: TrainingFocus; name: string; desc: string }[] = [
  { id: 'bilanciato', name: 'Bilanciato', desc: 'Crescita uniforme di tutte le caratteristiche.' },
  { id: 'tecnico', name: 'Tecnico', desc: 'Tiro, passaggio, controllo: crescono di più le qualità tecniche.' },
  { id: 'fisico', name: 'Fisico', desc: 'Forza, nuoto e resistenza. In precampionato costruisce la preparazione atletica.' },
  { id: 'tattico', name: 'Tattico', desc: 'La squadra impara più in fretta le tattiche e cresce l’affiatamento.' },
  { id: 'speciali', name: 'Situazioni speciali', desc: 'Superiorità e inferiorità numeriche, rigori.' },
  { id: 'recupero', name: 'Recupero', desc: 'Carichi leggeri: la condizione fisica risale più in fretta.' },
];

const INTENSITY: { id: TrainingIntensity; name: string; desc: string }[] = [
  { id: 'bassa', name: 'Bassa', desc: 'Meno crescita, recupero rapido, pochissimi infortuni.' },
  { id: 'media', name: 'Media', desc: 'Equilibrio tra crescita e freschezza.' },
  { id: 'alta', name: 'Alta', desc: 'Più crescita, ma più fatica e rischio infortuni.' },
];

export function TacticsScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const cap = organizationCapacity(world, club);
  const t = club.tactics;
  const set = (fn: (t: TacticsSetup) => void, msg?: string) => s.act((w) => fn(w.clubs[w.userClubId].tactics), msg);
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const next = nextFixture(world, club.id);
  const opp = next ? world.clubs[next.homeId === club.id ? next.awayId : next.homeId] : null;
  const oppPlayers = opp ? opp.playerIds.map((id) => world.players[id]).filter((p) => p && p.role !== 'POR').sort((a, b) => b.overall - a.overall) : [];
  const squad = club.playerIds.map((id) => world.players[id]).filter((p) => p && p.role !== 'POR').sort((a, b) => b.attrs.tiro + b.attrs.superiorita - (a.attrs.tiro + a.attrs.superiorita));
  return (
    <div className="space-y-5">
      <PageHeader title="Tattiche" subtitle={`Capacità organizzativa ${cap.total}/100${coach ? ` · allenatore ${coach.firstName} ${coach.lastName} (${PHILOSOPHY_LABELS[coach.philosophy].toLowerCase()})` : ' · nessun allenatore'}`} />
      <Panel title="Capacità organizzativa" subtitle="Le tattiche più sofisticate richiedono una squadra capace di eseguirle: migliorano con allenatore, vice, centro di allenamento, intelligenza tattica dei giocatori ed esperienza della società.">
        <div className="grid md:grid-cols-[200px_1fr] gap-5 items-center">
          <div className="text-center">
            <div className="font-display text-6xl font-extrabold text-aqua num">{cap.total}</div>
            <div className="text-xs text-mute uppercase tracking-wider">su 100</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {cap.parts.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1"><span className="text-mute">{p.label}</span><span className="num">{p.value.toFixed(1)} / {p.max}</span></div>
                <Bar value={p.value} max={p.max} color="#22d3ee" height={5} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-faint mt-3">La familiarità (barra viola) indica quanto la squadra conosce un sistema: cresce usandolo in partita e con l’allenamento tattico. Un sistema poco conosciuto rende meno e causa più errori.</p>
      </Panel>

      <Panel title="Fase offensiva">
        <TacticGrid
          items={Object.values(OFFENSE)}
          selected={t.offense}
          cap={cap.total}
          fam={(id) => familiarity(club, id as TacticId)}
          onPick={(id) => set((x) => { x.offense = id as OffenseTactic; }, `Attacco: ${OFFENSE[id as OffenseTactic].name}`)}
        />
      </Panel>
      <Panel title="Fase difensiva">
        <TacticGrid
          items={Object.values(DEFENSE)}
          selected={t.defense}
          cap={cap.total}
          fam={(id) => familiarity(club, id as TacticId)}
          onPick={(id) => set((x) => { x.defense = id as DefenseTactic; }, `Difesa: ${DEFENSE[id as DefenseTactic].name}`)}
        />
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Superiorità numerica (uomo in più)">
          <SubPick label="Disposizione" items={Object.values(MANUP_FORMATIONS)} selected={t.manUp.formation} cap={cap.total} fam={(id) => familiarity(club, `mu_${id}` as TacticId)} onPick={(id) => set((x) => { x.manUp.formation = id as ManUpFormation; })} />
          <SubPick label="Circolazione della palla" items={Object.values(MANUP_CIRCULATION)} selected={t.manUp.circulation} cap={cap.total} onPick={(id) => set((x) => { x.manUp.circulation = id as ManUpCirculation; })} />
          <SubPick label="Strategia di tiro" items={Object.values(MANUP_STRATEGY)} selected={t.manUp.strategy} cap={cap.total} onPick={(id) => set((x) => { x.manUp.strategy = id as ManUpStrategy; })} />
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">Tiratori designati (max 2)</div>
            <div className="flex flex-wrap gap-1.5">
              {squad.slice(0, 12).map((p) => {
                const on = t.manUp.shooters.includes(p.id);
                return (
                  <button key={p.id} onClick={() => set((x) => { x.manUp.shooters = on ? x.manUp.shooters.filter((i) => i !== p.id) : [...x.manUp.shooters, p.id].slice(-2); })}
                    className={cls('px-2 py-1 rounded-md text-xs border', on ? 'border-aqua bg-aqua/15 text-aqua' : 'border-line text-mute hover:text-ink')}>
                    {p.lastName} <span className="text-faint">T{Math.round(p.attrs.tiro)} S{Math.round(p.attrs.superiorita)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>
        <Panel title="Inferiorità numerica">
          <SubPick label="Stile difensivo" items={Object.values(MANDOWN_STYLES)} selected={t.manDown.style} cap={cap.total} fam={(id) => familiarity(club, `md_${id}` as TacticId)} onPick={(id) => set((x) => { x.manDown.style = id as ManDownStyle; })} />
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">Giocatore da marcare con attenzione{opp ? ` (${opp.name})` : ''}</div>
            <select className="w-full" value={t.manDown.focusPlayerId ?? ''} onChange={(e) => set((x) => { x.manDown.focusPlayerId = e.target.value || null; })}>
              <option value="">Nessuno in particolare</option>
              {oppPlayers.slice(0, 10).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} · overall {p.overall} · tiro {Math.round(p.attrs.tiro)}</option>)}
            </select>
            <p className="text-[11px] text-faint mt-1">Il giocatore marcato tira meno e peggio in superiorità, ma gli altri trovano più spazio.</p>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Allenamento settimanale" subtitle="Applicato ogni lunedì a tutta la rosa.">
          <div className="grid sm:grid-cols-2 gap-2">
            {FOCUS.map((f) => (
              <button key={f.id} onClick={() => s.act((w) => { w.clubs[w.userClubId].training.focus = f.id; })} className={cls('text-left rounded-lg border p-2.5', club.training.focus === f.id ? 'border-aqua bg-aqua/10' : 'border-line hover:border-line-2')}>
                <div className="font-semibold text-sm">{f.name}</div>
                <div className="text-xs text-mute">{f.desc}</div>
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-mute mt-4 mb-1.5">Intensità</div>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITY.map((f) => (
              <button key={f.id} onClick={() => s.act((w) => { w.clubs[w.userClubId].training.intensity = f.id; })} className={cls('text-left rounded-lg border p-2.5', club.training.intensity === f.id ? 'border-aqua bg-aqua/10' : 'border-line hover:border-line-2')}>
                <div className="font-semibold text-sm">{f.name}</div>
                <div className="text-[11px] text-mute">{f.desc}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="In partita">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={world.flags.coachAdjusts !== false} onChange={(e) => s.act((w) => { w.flags.coachAdjusts = e.target.checked; })} />
            <span>
              <span className="font-semibold">L’allenatore può cambiare tattica durante la partita</span>
              <span className="block text-xs text-mute">Nelle simulazioni rapide e quando non intervieni tu, il tecnico adatta attacco e difesa all’andamento della gara (con efficacia legata alla sua adattabilità).</span>
            </span>
          </label>
          <div className="mt-4 text-sm text-mute space-y-1.5">
            <p><b className="text-ink">Vantaggi e svantaggi contano davvero:</b> la zona chiude il centroboa ma concede il tiro da fuori; il pressing recupera palloni ma stanca e concede contropiedi; la marcatura a uomo soffre gli avversari più veloci.</p>
            <p>Tattiche nuove vanno allenate: scegli il focus “Tattico” per impararle più in fretta.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TacticGrid({ items, selected, cap, fam, onPick }: { items: TacticInfo[]; selected: string; cap: number; fam: (id: string) => number; onPick: (id: string) => void }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map((it) => {
        const locked = it.complexity > cap;
        const on = selected === it.id;
        return (
          <button key={it.id} disabled={locked} onClick={() => onPick(it.id)} className={cls('text-left rounded-xl border p-3 transition-all relative', on ? 'border-aqua bg-aqua/10 shadow-[0_0_0_1px_#22d3ee]' : 'border-line hover:border-line-2', locked && 'opacity-45 cursor-not-allowed')}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm">{it.name}</div>
              {locked ? <Badge tone="warn">🔒 {it.complexity}</Badge> : on ? <Badge tone="aqua">In uso</Badge> : it.complexity > 0 ? <Badge>{it.complexity}</Badge> : null}
            </div>
            <p className="text-xs text-mute mt-1">{it.desc}</p>
            <div className="mt-2 space-y-0.5 text-[11px]">
              {it.pros.map((p) => <div key={p} className="text-good">＋ {p}</div>)}
              {it.cons.map((c) => <div key={c} className="text-bad">− {c}</div>)}
            </div>
            <div className="mt-2 flex items-center gap-2"><span className="text-[10px] text-faint w-16">Familiarità</span><Bar value={fam(it.id)} color="#a78bfa" height={4} /></div>
          </button>
        );
      })}
    </div>
  );
}

function SubPick({ label, items, selected, cap, onPick, fam }: { label: string; items: TacticInfo[]; selected: string; cap: number; onPick: (id: string) => void; fam?: (id: string) => number }) {
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{label}</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((it) => {
          const locked = it.complexity > cap;
          return (
            <button key={it.id} disabled={locked} onClick={() => onPick(it.id)} className={cls('text-left rounded-lg border p-2', selected === it.id ? 'border-aqua bg-aqua/10' : 'border-line hover:border-line-2', locked && 'opacity-45 cursor-not-allowed')}>
              <div className="flex justify-between gap-2"><span className="text-sm font-semibold">{it.name}</span>{locked && <Badge tone="warn">🔒 {it.complexity}</Badge>}</div>
              <div className="text-[11px] text-mute">{it.desc}</div>
              {fam && <div className="mt-1.5"><Bar value={fam(it.id)} color="#a78bfa" height={3} /></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
