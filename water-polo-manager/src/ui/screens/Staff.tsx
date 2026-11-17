import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Badge, Bar, Button, DataTable, Empty, Field, Flag, Kv, Modal, PageHeader, Panel, Tabs } from '../components/ui';
import { COACH_ATTR_LABELS, PHILOSOPHY_DESC, PHILOSOPHY_LABELS, STAFF_EFFECTS, STAFF_LABELS, STAFF_ROLES, coachRating } from '../../engine/staff/coach';
import { coachDemand, coachInterest, coachSeverance, fireCoach, fireStaff, hireCoach, hireStaff, renewCoach, staffDemand, staffInterest } from '../../engine/club/manage';
import type { Coach, CoachAttributes, StaffMember, StaffRole } from '../../engine/types';
import { fmtMoney, ratingColor } from '../format';
import { Ovr } from '../components/ui';

export function StaffScreen() {
  const world = useWorld();
  const [tab, setTab] = useState<'allenatore' | 'staff' | 'mercatoAll' | 'mercatoStaff'>('allenatore');
  const club = world.clubs[world.userClubId];
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  return (
    <div>
      <PageHeader title="Allenatore e staff" subtitle="Sei il presidente: scegli chi guida la squadra e con quali collaboratori." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'allenatore', label: 'Allenatore' },
        { id: 'staff', label: 'Staff tecnico' },
        { id: 'mercatoAll', label: 'Allenatori liberi' },
        { id: 'mercatoStaff', label: 'Collaboratori liberi' },
      ]} />
      {tab === 'allenatore' && (coach ? <CoachCard coach={coach} /> : (
        <Panel><Empty>Nessun allenatore: la squadra è guidata dal vice. <Button size="sm" onClick={() => setTab('mercatoAll')}>Scegli un allenatore</Button></Empty></Panel>
      ))}
      {tab === 'staff' && <StaffGrid onHire={() => setTab('mercatoStaff')} />}
      {tab === 'mercatoAll' && <CoachMarket />}
      {tab === 'mercatoStaff' && <StaffMarket />}
    </div>
  );
}

function CoachCard({ coach }: { coach: Coach }) {
  const world = useWorld();
  const s = useGame.getState();
  const [fire, setFire] = useState(false);
  const age = world.season - coach.birthYear;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5">
      <Panel title="Profilo">
        <div className="flex items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-panel-2 border border-line flex items-center justify-center font-display text-2xl font-bold">{coach.firstName[0]}{coach.lastName[0]}</div>
          <div>
            <div className="font-display text-2xl font-bold">{coach.firstName} {coach.lastName}</div>
            <div className="text-sm text-mute flex items-center gap-1"><Flag code={coach.nationality} /> {age} anni · {coach.trophies} trofei</div>
          </div>
          <div className="ml-auto"><Ovr v={coachRating(coach)} size="lg" /></div>
        </div>
        <Kv k="Filosofia" v={<Badge tone="aqua">{PHILOSOPHY_LABELS[coach.philosophy]}</Badge>} />
        <p className="text-xs text-mute py-2">{PHILOSOPHY_DESC[coach.philosophy]}</p>
        <Kv k="Contratto" v={coach.contract ? `${fmtMoney(coach.contract.wage)} / anno fino al ${coach.contract.endSeason + 1}` : '—'} />
        <Kv k="Fiducia dell’ambiente" v={<div className="w-32"><Bar value={coach.security} color={coach.security < 30 ? '#ef4444' : '#22c55e'} /></div>} />
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => s.act((w) => renewCoach(w, w.clubs[w.userClubId], 2), 'Contratto dell’allenatore rinnovato per due stagioni.')}>Rinnova (2 anni)</Button>
          <Button variant="danger" onClick={() => setFire(true)}>Esonera</Button>
        </div>
        {coach.history.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase text-mute mb-1">Carriera</div>
            {[...coach.history].reverse().slice(0, 8).map((h, i) => <div key={i} className="text-xs text-mute">{h.season}/{(h.season + 1) % 100} · {h.clubName} ({h.division}){h.position ? ` · ${h.position}°` : ''}</div>)}
          </div>
        )}
      </Panel>
      <Panel title="Competenze" subtitle="Un buon allenatore migliora la squadra, ma non trasforma una rosa mediocre in una squadra di campioni.">
        <CoachAttrs attrs={coach.attrs} />
        <div className="mt-4 text-xs text-mute space-y-1">
          <p><b className="text-ink">Competenza tattica</b>: efficacia delle tattiche e capacità organizzativa (sblocco dei sistemi avanzati).</p>
          <p><b className="text-ink">Preparazione atletica</b>: meno fatica in partita. <b className="text-ink">Sviluppo dei giovani</b>: crescita degli under 21.</p>
          <p><b className="text-ink">Gestione dello spogliatoio</b>: morale. <b className="text-ink">Motivazione</b>: rendimento nelle partite importanti. <b className="text-ink">Adattabilità</b>: cambi tattici azzeccati durante la gara.</p>
        </div>
      </Panel>
      <Modal open={fire} onClose={() => setFire(false)} title="Esonerare l’allenatore?"
        footer={<><Button variant="ghost" onClick={() => setFire(false)}>Annulla</Button><Button variant="danger" onClick={() => { s.act((w) => fireCoach(w, w.clubs[w.userClubId]), 'Allenatore esonerato: scegline uno nuovo.'); setFire(false); }}>Esonera</Button></>}>
        <p className="text-sm text-mute">Buonuscita da pagare: <b className="text-ink">{fmtMoney(coachSeverance(world, coach))}</b>. L’affiatamento della squadra calerà con il cambio di guida e alcune tattiche potrebbero non essere più disponibili.</p>
      </Modal>
    </div>
  );
}

function CoachAttrs({ attrs }: { attrs: CoachAttributes }) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
      {(Object.keys(COACH_ATTR_LABELS) as (keyof CoachAttributes)[]).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-sm text-mute flex-1">{COACH_ATTR_LABELS[k]}</span>
          <span className="w-24"><Bar value={attrs[k]} height={5} /></span>
          <span className="w-6 text-right font-bold num text-sm" style={{ color: ratingColor(attrs[k]) }}>{attrs[k]}</span>
        </div>
      ))}
    </div>
  );
}

function StaffGrid({ onHire }: { onHire: () => void }) {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {STAFF_ROLES.map((role) => {
        const m = club.staff[role] ? world.staff[club.staff[role]!] : null;
        return (
          <Panel key={role} title={STAFF_LABELS[role]}>
            <p className="text-xs text-mute min-h-[48px]">{STAFF_EFFECTS[role]}</p>
            {m ? (
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <div><div className="font-semibold">{m.firstName} {m.lastName}</div><div className="text-xs text-mute">{m.contract ? `${fmtMoney(m.contract.wage)} / anno` : ''}</div></div>
                  <Ovr v={m.rating} />
                </div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => s.act((w) => fireStaff(w, w.clubs[w.userClubId], role), 'Collaboratore licenziato.')}>Licenzia</Button>
              </div>
            ) : (
              <div className="mt-2">
                <Badge tone="warn">Ruolo vacante</Badge>
                <Button size="sm" className="mt-2 w-full" onClick={onHire}>Assumi</Button>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function CoachMarket() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const [pick, setPick] = useState<Coach | null>(null);
  const [wage, setWage] = useState(0);
  const [years, setYears] = useState(2);
  const list = Object.values(world.coaches).filter((c) => !c.clubId).sort((a, b) => coachRating(b) - coachRating(a));
  const cols = [
    { key: 'n', label: 'Allenatore', render: (c: Coach) => <span className="font-medium">{c.firstName} {c.lastName} <Flag code={c.nationality} /></span>, sort: (c: Coach) => c.lastName },
    { key: 'r', label: 'Valutazione', render: (c: Coach) => <Ovr v={coachRating(c)} size="sm" />, sort: (c: Coach) => coachRating(c) },
    { key: 'p', label: 'Filosofia', render: (c: Coach) => <span className="text-xs">{PHILOSOPHY_LABELS[c.philosophy]}</span> },
    { key: 't', label: 'Tattica', render: (c: Coach) => c.attrs.tattica, sort: (c: Coach) => c.attrs.tattica, hideOnMobile: true },
    { key: 'g', label: 'Giovani', render: (c: Coach) => c.attrs.giovani, sort: (c: Coach) => c.attrs.giovani, hideOnMobile: true },
    { key: 'a', label: 'Età', render: (c: Coach) => world.season - c.birthYear, sort: (c: Coach) => -c.birthYear, hideOnMobile: true },
    { key: 'i', label: 'Interesse', render: (c: Coach) => { const v = coachInterest(world, c, club); return <Badge tone={v >= 60 ? 'good' : v >= 30 ? 'warn' : 'bad'}>{v}%</Badge>; } },
    { key: 'w', label: 'Richiesta', render: (c: Coach) => fmtMoney(coachDemand(world, c, club)), sort: (c: Coach) => coachDemand(world, c, club) },
    { key: 'b', label: '', render: (c: Coach) => <Button size="sm" onClick={() => { setPick(c); setWage(coachDemand(world, c, club)); }}>Tratta</Button> },
  ];
  return (
    <Panel title="Allenatori senza squadra" subtitle={club.coachId ? 'Per assumere un nuovo tecnico devi prima esonerare quello attuale.' : 'Scegli il nuovo allenatore.'}>
      <DataTable rows={list} columns={cols} rowKey={(c) => c.id} initialSort="r" dense />
      {pick && (
        <Modal open onClose={() => setPick(null)} title={`Contratto per ${pick.firstName} ${pick.lastName}`} wide
          footer={<><Button variant="ghost" onClick={() => setPick(null)}>Annulla</Button><Button onClick={() => { if (s.act((w) => hireCoach(w, w.clubs[w.userClubId], pick.id, wage, years), `${pick.lastName} è il nuovo allenatore!`)) setPick(null); }}>Firma</Button></>}>
          <CoachAttrs attrs={pick.attrs} />
          <p className="text-xs text-mute my-3">{PHILOSOPHY_LABELS[pick.philosophy]}: {PHILOSOPHY_DESC[pick.philosophy]}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stipendio annuo (€)" hint={`Richiesta: ${fmtMoney(coachDemand(world, pick, club))}`}><input type="number" className="w-full" value={wage} step={500} onChange={(e) => setWage(Number(e.target.value))} /></Field>
            <Field label="Durata"><select className="w-full" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3].map((y) => <option key={y} value={y}>{y} stagion{y > 1 ? 'i' : 'e'}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function StaffMarket() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const [role, setRole] = useState<StaffRole>('vice');
  const list = Object.values(world.staff).filter((m) => !m.clubId && m.role === role).sort((a, b) => b.rating - a.rating);
  const cols = [
    { key: 'n', label: 'Nome', render: (m: StaffMember) => <span className="font-medium">{m.firstName} {m.lastName} <Flag code={m.nationality} /></span> },
    { key: 'r', label: 'Valutazione', render: (m: StaffMember) => <Ovr v={m.rating} size="sm" />, sort: (m: StaffMember) => m.rating },
    { key: 'a', label: 'Età', render: (m: StaffMember) => world.season - m.birthYear },
    { key: 'i', label: 'Interesse', render: (m: StaffMember) => { const v = staffInterest(m, club); return <Badge tone={v >= 60 ? 'good' : v >= 30 ? 'warn' : 'bad'}>{v}%</Badge>; } },
    { key: 'w', label: 'Stipendio', render: (m: StaffMember) => fmtMoney(staffDemand(m, club)), sort: (m: StaffMember) => staffDemand(m, club) },
    { key: 'b', label: '', render: (m: StaffMember) => <Button size="sm" disabled={!!club.staff[role]} onClick={() => s.act((w) => hireStaff(w, w.clubs[w.userClubId], m.id, 2), `${m.lastName} entra nello staff.`)}>Assumi</Button> },
  ];
  return (
    <Panel title="Collaboratori disponibili" actions={
      <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
        {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_LABELS[r]}</option>)}
      </select>
    }>
      <p className="text-xs text-mute mb-3">{STAFF_EFFECTS[role]} {club.staff[role] ? 'Il ruolo è già coperto: licenzia l’attuale collaboratore per sostituirlo.' : ''}</p>
      <DataTable rows={list} columns={cols} rowKey={(m) => m.id} initialSort="r" dense />
    </Panel>
  );
}
