// Account: accesso/registrazione, stato del cloud e risoluzione dei conflitti di salvataggio.

import { useState } from 'react';
import { useGame } from '../../store/game';
import { Badge, Button, Field, Modal } from './ui';
import { Icon } from './icons';
import { cls } from '../format';

export function AuthModal({ open, onClose, initial = 'login' }: { open: boolean; onClose: () => void; initial?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await useGame.getState().signIn(mode, email, password, consent);
    setBusy(false);
    if (err) setError(err);
    else {
      setPassword('');
      useGame.getState().toast(mode === 'register' ? 'Account creato: le tue carriere ora sono nel cloud.' : 'Accesso effettuato.', 'ok');
      onClose();
    }
  };
  const ready = email.includes('@') && password.length >= 8 && (mode === 'login' || consent);
  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? 'Accedi' : 'Crea il tuo account'}
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button><Button disabled={!ready || busy} onClick={() => void submit()}>{busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : 'Crea account'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void submit(); }}>
        <p className="text-sm text-mute leading-relaxed">
          Con un account le tue carriere vengono salvate anche online: giochi dal computer, riprendi dal telefono e non perdi nulla se cambi browser.
        </p>
        <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
              className={cls('flex-1 h-8 rounded-md text-sm font-medium transition-colors', mode === m ? 'bg-aqua text-abyss' : 'text-mute hover:text-ink')}>
              {m === 'login' ? 'Ho già un account' : 'Nuovo account'}
            </button>
          ))}
        </div>
        <Field label="Email"><input type="email" autoComplete="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
        <Field label="Password" hint={mode === 'register' ? 'Almeno 8 caratteri.' : undefined}>
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {mode === 'register' && (
          <label className="flex items-start gap-2 text-xs text-mute leading-relaxed cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Accetto che vengano salvati la mia email e le mie carriere di gioco, solo per farmi continuare a giocare da più dispositivi.
              La password non viene mai conservata in chiaro, non ricevo email e posso eliminare l’account e tutti i dati quando voglio.
            </span>
          </label>
        )}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Pulsante/chip dell'account: "Accedi" oppure l'email con menu. */
export function AccountButton({ className }: { className?: string }) {
  const account = useGame((s) => s.account);
  const [auth, setAuth] = useState<null | 'login' | 'register'>(null);
  const [menu, setMenu] = useState(false);
  const s = useGame.getState();
  if (!account) {
    return (
      <>
        <Button variant="outline" className={className} onClick={() => setAuth('login')}><Icon name="rosa" size={16} /> Accedi o crea account</Button>
        {auth && <AuthModal open onClose={() => setAuth(null)} initial={auth} />}
      </>
    );
  }
  return (
    <div className={cls('relative', className)}>
      <button onClick={() => setMenu(!menu)} className="press h-9 px-3 rounded-lg border border-line-2 bg-abyss/60 backdrop-blur-sm text-sm flex items-center gap-2 max-w-[260px]">
        <Icon name="check" size={14} className="text-good shrink-0" weight="bold" />
        <span className="truncate">{account.email}</span>
      </button>
      {menu && (
        <div className="absolute right-0 top-11 panel p-1 w-56 z-50" onMouseLeave={() => setMenu(false)}>
          <div className="px-3 py-2 text-xs text-mute">Le tue carriere sono salvate anche nel cloud.</div>
          <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-white/5" onClick={() => { setMenu(false); void s.signOut().then(() => s.toast('Sei uscito dall’account. Le carriere restano su questo dispositivo.', 'info')); }}>Esci</button>
        </div>
      )}
    </div>
  );
}

/** Stato del cloud per la carriera aperta (barra laterale). */
export function CloudStatus() {
  const account = useGame((s) => s.account);
  const cloud = useGame((s) => s.cloud);
  const conflict = useGame((s) => s.conflict);
  const paused = useGame((s) => s.cloudPaused);
  const s = useGame.getState();
  const [auth, setAuth] = useState(false);
  if (!account) {
    return (
      <>
        <button onClick={() => setAuth(true)} className="w-[calc(100%-16px)] mx-2 mb-2 flex items-center gap-2 px-3 h-8 rounded-lg text-xs text-mute hover:text-ink hover:bg-white/[0.04]">
          <Icon name="save" size={16} className="text-faint" /> Salva online con un account
        </button>
        {auth && <AuthModal open onClose={() => setAuth(false)} initial="register" />}
      </>
    );
  }
  const label = conflict ? 'Conflitto da risolvere' : paused ? 'Cloud in pausa' : cloud.status === 'syncing' ? 'Sincronizzo…' : cloud.status === 'error' ? 'Cloud non raggiungibile' : cloud.lastSync ? `Cloud aggiornato ${new Date(cloud.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Cloud collegato';
  const tone = conflict || paused || cloud.status === 'error' ? 'text-warn' : 'text-good';
  return (
    <button onClick={() => void s.syncNow()} title={cloud.error ?? 'Sincronizza ora'} className="w-[calc(100%-16px)] mx-2 mb-2 flex items-center gap-2 px-3 h-8 rounded-lg text-xs text-mute hover:text-ink hover:bg-white/[0.04]">
      <span className={cls('h-2 w-2 rounded-full shrink-0', conflict || paused || cloud.status === 'error' ? 'bg-warn' : cloud.status === 'syncing' ? 'bg-aqua animate-pulse' : 'bg-good')} aria-hidden />
      <span className={cls('truncate', tone)}>{label}</span>
    </button>
  );
}

/** Finestra mostrata quando la stessa carriera è stata giocata su due dispositivi. */
export function ConflictModal() {
  const conflict = useGame((s) => s.conflict);
  const meta = useGame((s) => s.meta);
  const s = useGame.getState();
  if (!conflict) return null;
  return (
    <Modal open onClose={() => { /* serve una scelta */ }} title="Due versioni della stessa carriera"
      footer={<>
        <Button variant="ghost" onClick={() => void s.resolveConflict('later')}>Decido dopo</Button>
        <Button variant="outline" onClick={() => void s.resolveConflict('local')}>Tieni questa e sovrascrivi il cloud</Button>
        <Button onClick={() => void s.resolveConflict('cloud')}>Usa la versione del cloud</Button>
      </>}>
      <p className="text-sm text-mute leading-relaxed">
        La carriera <b className="text-ink">{meta?.name}</b> è stata salvata da un altro dispositivo il{' '}
        <b className="text-ink">{new Date(conflict.cloudUpdatedAt).toLocaleString('it-IT')}</b>, e qui hai fatto altre modifiche.
        Scegli quale versione tenere: l’altra andrà persa. Se l’altro dispositivo è spento e non sai ancora cosa fare, scegli “Decido dopo”: continui a giocare qui e non te lo richiedo più.
      </p>
    </Modal>
  );
}

export function CloudBadge({ id }: { id: string }) {
  const account = useGame((s) => s.account);
  const list = useGame((s) => s.cloud.list);
  if (!account) return null;
  const inCloud = list.some((c) => c.id === id);
  return inCloud ? <Badge tone="good"><Icon name="check" size={11} weight="bold" /> Nel cloud</Badge> : <Badge title="Verrà caricata al prossimo salvataggio">Solo su questo dispositivo</Badge>;
}
