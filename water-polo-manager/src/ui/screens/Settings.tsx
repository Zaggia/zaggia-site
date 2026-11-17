import { useRef, useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Button, Field, Kv, Modal, PageHeader, Panel } from '../components/ui';
import { DIFFICULTIES } from '../../engine/data/config';
import { formatDate, seasonLabel } from '../format';
import { saveCareer } from '../../db/saves';
import type { CareerMeta, World } from '../../engine/types';

export function SettingsScreen() {
  const world = useWorld();
  const meta = useGame((s) => s.meta);
  const lastSaved = useGame((s) => s.lastSaved);
  const saveError = useGame((s) => s.saveError);
  const s = useGame.getState();
  const [name, setName] = useState(meta?.name ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(world)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(meta?.name ?? 'carriera').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${world.season}.wpm.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importJson = async (f: File) => {
    try {
      const w = JSON.parse(await f.text()) as World;
      if (!w.clubs || !w.userClubId || !w.players) throw new Error('File non valido');
      const club = w.clubs[w.userClubId];
      const m: CareerMeta = { id: w.careerId, name: `${club.name} (importata)`, clubName: club.name, season: w.season, day: w.day, division: club.division, createdAt: Date.now(), updatedAt: Date.now(), crest: club.crest, difficulty: w.difficulty };
      await saveCareer(w, m);
      await s.openCareer(m.id);
      s.toast('Carriera importata.', 'ok');
    } catch (e) {
      s.toast(`Importazione non riuscita: ${(e as Error).message}`, 'err');
    }
  };
  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader title="Salvataggi" subtitle="La carriera si salva automaticamente nel browser dopo ogni azione." />
      <Panel title="Carriera attuale">
        <Kv k="Nome" v={meta?.name} />
        <Kv k="Data di gioco" v={<span className="capitalize">{formatDate(world.season, world.day, true)}</span>} />
        <Kv k="Stagione" v={seasonLabel(world.season)} />
        <Kv k="Difficoltà" v={DIFFICULTIES[world.difficulty].label} />
        <Kv k="Ultimo salvataggio" v={lastSaved ? new Date(lastSaved).toLocaleTimeString('it-IT') : '—'} />
        {saveError && <p className="text-bad text-sm mt-2">Errore di salvataggio: {saveError}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={() => void s.saveNow().then(() => s.toast('Partita salvata.', 'ok'))}>Salva ora</Button>
          <Button variant="outline" onClick={() => void s.closeCareer()}>Torna al menu principale</Button>
        </div>
      </Panel>
      <Panel title="Rinomina">
        <div className="flex gap-2">
          <input className="flex-1" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="outline" onClick={() => meta && void s.renameCareer(meta.id, name.trim() || meta.name).then(() => s.toast('Carriera rinominata.', 'ok'))}>Rinomina</Button>
        </div>
      </Panel>
      <Panel title="Backup" subtitle="Esporta la carriera in un file per conservarla o spostarla su un altro dispositivo.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>Esporta file</Button>
          <Button variant="outline" onClick={() => file.current?.click()}>Importa file</Button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
        </div>
      </Panel>
      <Panel title="Elimina carriera">
        <Button variant="danger" onClick={() => setConfirmDel(true)}>Elimina questa carriera</Button>
      </Panel>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Eliminare la carriera?"
        footer={<><Button variant="ghost" onClick={() => setConfirmDel(false)}>Annulla</Button><Button variant="danger" onClick={() => { if (meta) { const id = meta.id; void s.closeCareer().then(() => s.removeCareer(id)); } setConfirmDel(false); }}>Elimina</Button></>}>
        <p className="text-sm text-mute">Tutti i dati di questa carriera verranno cancellati definitivamente.</p>
        <Field label="Carriera"><span className="text-sm">{meta?.name}</span></Field>
      </Modal>
    </div>
  );
}
