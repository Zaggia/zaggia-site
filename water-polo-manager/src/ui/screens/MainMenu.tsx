import { useMemo, useState } from 'react';
import { useGame } from '../../store/game';
import { Crest } from '../components/Crest';
import { ClubCaps } from '../components/Cap';
import { Logo } from '../components/Logo';
import { ART } from '../art';
import { Button, Field, Modal, Panel } from '../components/ui';
import { ITALIAN_CITIES, FANS_NAMES } from '../../engine/data/cities';
import { DIFFICULTIES } from '../../engine/data/config';
import { CREST_PATTERNS, CREST_SHAPES, CREST_SYMBOLS, PALETTES } from '../../engine/club/crest';
import type { CrestSpec, Difficulty, ObjectiveKind } from '../../engine/types';
import { cls, fmtMoney, formatDate, seasonLabel } from '../format';
import { OBJECTIVE_LABELS } from '../../engine/economy/sponsors';

export function MainMenu() {
  const careers = useGame((s) => s.careers);
  const [wizard, setWizard] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const s = useGame.getState();
  if (wizard) return <NewCareer onCancel={() => setWizard(false)} />;
  return (
    <div className="min-h-full flex flex-col">
      <section className="relative overflow-hidden border-b border-line">
        <img src={ART.hero} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-abyss via-abyss/85 to-abyss/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-abyss to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 min-h-[min(640px,88dvh)] flex flex-col justify-center">
          <h1 className="sr-only">Water Polo Manager, The Road to Glory</h1>
          <Logo size="xl" className="items-center" />
          <p className="text-ink/80 mt-6 max-w-md text-lg leading-relaxed">
            Prendi una società di Serie C e portala fino alla Champions League, contro i club e i campioni veri.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Button size="lg" onClick={() => setWizard(true)}>Nuova carriera</Button>
            {careers[0] && <Button size="lg" variant="outline" onClick={() => void s.openCareer(careers[0].id)}>Continua: {careers[0].name}</Button>}
          </div>
        </div>
      </section>
      <div className="max-w-5xl w-full mx-auto px-6 py-8">
        <Panel title="Carriere salvate" subtitle="I salvataggi restano nel browser anche dopo la chiusura del gioco.">
          {!careers.length && <p className="text-mute text-sm py-4">Nessuna carriera: creane una nuova per iniziare.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {careers.map((c) => (
              <div key={c.id} className="panel-flat p-3 flex items-center gap-3">
                <Crest spec={c.crest} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-mute truncate">{c.clubName} · {c.division === 'C' ? 'Serie C' : c.division === 'B' ? 'Serie B' : `Serie ${c.division}`} · {seasonLabel(c.season)}</div>
                  <div className="text-[11px] text-faint">{formatDate(c.season, c.day)} · {DIFFICULTIES[c.difficulty]?.label}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" onClick={() => void s.openCareer(c.id)}>Carica</Button>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: c.id, name: c.name })}>Rinomina</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(c.id)}>Elimina</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rinomina carriera"
        footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>Annulla</Button><Button onClick={() => { if (renaming) void s.renameCareer(renaming.id, renaming.name.trim() || 'Carriera'); setRenaming(null); }}>Salva</Button></>}>
        <input className="w-full" value={renaming?.name ?? ''} onChange={(e) => setRenaming(renaming && { ...renaming, name: e.target.value })} autoFocus />
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminare la carriera?"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Annulla</Button><Button variant="danger" onClick={() => { if (deleting) void s.removeCareer(deleting); setDeleting(null); }}>Elimina definitivamente</Button></>}>
        <p className="text-sm text-mute">La carriera e tutti i suoi dati verranno cancellati. L’operazione non si può annullare.</p>
      </Modal>
    </div>
  );
}

const OBJECTIVES: ObjectiveKind[] = ['salvezza', 'metaClassifica', 'playoff', 'promozione'];

function NewCareer({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const cities = useMemo(() => [...ITALIAN_CITIES].sort((a, b) => a.name.localeCompare(b.name)), []);
  const [city, setCity] = useState('Savona');
  const [name, setName] = useState('Aquatica Savona');
  const [short, setShort] = useState('AQS');
  const [colors, setColors] = useState<[string, string]>(['#0b3d91', '#f5c518']);
  const [shape, setShape] = useState<CrestSpec['shape']>('scudo');
  const [pattern, setPattern] = useState<CrestSpec['pattern']>('strisce');
  const [symbol, setSymbol] = useState<CrestSpec['symbol']>('palla');
  const [pool, setPool] = useState('');
  const [founded, setFounded] = useState(2025);
  const [fans, setFans] = useState('Delfini');
  const [objective, setObjective] = useState<ObjectiveKind>('metaClassifica');
  const [difficulty, setDifficulty] = useState<Difficulty>('normale');
  const [president, setPresident] = useState('');
  const [career, setCareer] = useState('');
  const cityObj = cities.find((c) => c.name === city)!;
  const crest: CrestSpec = { shape, pattern, symbol, primary: colors[0], secondary: colors[1], initials: short.toUpperCase().slice(0, 3) || 'WPM' };
  const valid = name.trim().length >= 3 && short.trim().length >= 2;
  const create = () => {
    void useGame.getState().newCareer({
      careerName: career.trim() || name.trim(),
      presidentName: president.trim() || 'Rossi',
      clubName: name.trim(),
      short: short.trim().toUpperCase().slice(0, 3),
      city,
      colors,
      crest,
      poolName: pool.trim() || `Piscina Comunale di ${city}`,
      founded,
      fansName: fans.trim() || 'Tifosi',
      objective,
      difficulty,
    });
  };
  const steps = ['Società', 'Stemma e colori', 'Presidenza'];
  return (
    <div className="min-h-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-aqua text-xs font-semibold uppercase tracking-[0.25em]">Nuova carriera</div>
          <h1 className="font-display text-4xl font-extrabold uppercase">Fonda la tua società</h1>
        </div>
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
      </div>
      <div className="flex gap-2 mb-6">
        {steps.map((t, i) => (
          <button key={t} onClick={() => setStep(i)} className={cls('flex-1 rounded-lg px-3 py-2 text-sm font-semibold border', i === step ? 'border-aqua text-aqua bg-aqua/10' : i < step ? 'border-line-2 text-ink' : 'border-line text-faint')}>
            {i + 1}. {t}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <Panel>
          <div className="pt-4">
            {step === 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nome del club"><input className="w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} /></Field>
                <Field label="Abbreviazione (3 lettere)"><input className="w-full uppercase" value={short} onChange={(e) => setShort(e.target.value.toUpperCase().slice(0, 3))} /></Field>
                <Field label="Città" hint={`Regione: ${cityObj.region}`}>
                  <select className="w-full" value={city} onChange={(e) => {
                    const c = e.target.value;
                    setCity(c);
                    if (name.endsWith(city)) setName(name.replace(city, c));
                  }}>
                    {cities.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.region})</option>)}
                  </select>
                </Field>
                <Field label="Anno di fondazione"><input type="number" className="w-full" value={founded} min={1890} max={2025} onChange={(e) => setFounded(Number(e.target.value) || 2025)} /></Field>
                <Field label="Nome della piscina"><input className="w-full" value={pool} placeholder={`Piscina Comunale di ${city}`} onChange={(e) => setPool(e.target.value)} /></Field>
                <Field label="Nome dei tifosi">
                  <input className="w-full" list="fans" value={fans} onChange={(e) => setFans(e.target.value)} />
                  <datalist id="fans">{FANS_NAMES.map((f) => <option key={f} value={f} />)}</datalist>
                </Field>
                <Field label="Obiettivo iniziale" hint="Influenza le attese dei tifosi e la campagna abbonamenti.">
                  <select className="w-full" value={objective} onChange={(e) => setObjective(e.target.value as ObjectiveKind)}>
                    {OBJECTIVES.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
                  </select>
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-mute uppercase tracking-wider mb-2">Colori sociali</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="color" value={colors[0]} onChange={(e) => setColors([e.target.value, colors[1]])} aria-label="Colore primario" />
                    <input type="color" value={colors[1]} onChange={(e) => setColors([colors[0], e.target.value])} aria-label="Colore secondario" />
                    <div className="flex flex-wrap gap-1.5">
                      {PALETTES.map((p) => (
                        <button key={p.join()} onClick={() => setColors(p)} className="w-8 h-8 rounded-md border border-line-2 overflow-hidden flex" title="Usa questi colori">
                          <span className="flex-1" style={{ background: p[0] }} /><span className="flex-1" style={{ background: p[1] }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Picker label="Forma dello stemma" options={CREST_SHAPES} value={shape} onChange={setShape} render={(o) => <Crest spec={{ ...crest, shape: o }} size={40} />} />
                <Picker label="Motivo" options={CREST_PATTERNS} value={pattern} onChange={setPattern} render={(o) => <Crest spec={{ ...crest, pattern: o }} size={40} />} />
                <Picker label="Simbolo" options={CREST_SYMBOLS} value={symbol} onChange={setSymbol} render={(o) => <Crest spec={{ ...crest, symbol: o }} size={40} />} />
              </div>
            )}
            {step === 2 && (
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Il tuo cognome (presidente)"><input className="w-full" value={president} placeholder="Rossi" onChange={(e) => setPresident(e.target.value)} /></Field>
                  <Field label="Nome della carriera"><input className="w-full" value={career} placeholder={name} onChange={(e) => setCareer(e.target.value)} /></Field>
                </div>
                <div>
                  <div className="text-xs font-semibold text-mute uppercase tracking-wider mb-2">Difficoltà</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.values(DIFFICULTIES).map((d) => (
                      <button key={d.key} onClick={() => setDifficulty(d.key)} className={cls('text-left panel-flat p-3 border-2 transition-colors', difficulty === d.key ? 'border-aqua' : 'border-transparent')}>
                        <div className="font-display text-xl font-bold">{d.label}</div>
                        <div className="text-xs text-mute mt-1">
                          Cassa iniziale {fmtMoney(d.startBalance)} · patrimonio personale {fmtMoney(d.presidentWealth)}<br />
                          Rosa iniziale con overall {d.squadLevel[0]}–{d.squadLevel[1]} · ricavi ×{d.incomeMult} · AI {d.aiAggression >= 1.15 ? 'aggressiva' : d.aiAggression <= 0.85 ? 'morbida' : 'standard'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Anteprima">
            <div className="flex flex-col items-center text-center py-3">
              <Crest spec={crest} size={120} />
              <div className="font-display text-2xl font-extrabold mt-3">{name || 'Il tuo club'}</div>
              <div className="text-mute text-sm">{city} · fondato nel {founded}</div>
              <div className="flex gap-1 mt-3">
                <span className="w-10 h-3 rounded" style={{ background: colors[0] }} />
                <span className="w-10 h-3 rounded" style={{ background: colors[1] }} />
              </div>
              <div className="mt-4"><ClubCaps colors={colors} size={48} /></div>
              <div className="text-xs text-faint mt-3">Partenza: Serie C · {pool || `Piscina Comunale di ${city}`}</div>
            </div>
          </Panel>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Indietro</Button>}
            {step < 2 ? (
              <Button className="flex-1" disabled={!valid} onClick={() => setStep(step + 1)}>Avanti</Button>
            ) : (
              <Button className="flex-1" variant="gold" disabled={!valid} onClick={create}>Inizia la carriera</Button>
            )}
          </div>
          {!valid && <p className="text-xs text-warn">Inserisci un nome (almeno 3 lettere) e un’abbreviazione.</p>}
        </div>
      </div>
    </div>
  );
}

function Picker<T extends string>({ label, options, value, onChange, render }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; render: (o: T) => React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-mute uppercase tracking-wider mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} title={o} className={cls('p-1.5 rounded-lg border-2 bg-white/[0.02]', value === o ? 'border-aqua' : 'border-line hover:border-line-2')}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
