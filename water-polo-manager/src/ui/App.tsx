import { Component, useEffect, useState, type ReactNode } from 'react';
import { useGame, type ViewName } from '../store/game';
import { MainMenu } from './screens/MainMenu';
import { Icon, GameIcon } from './components/icons';
import { Button, IconTile } from './components/ui';
import { NAV_GAME_ICON } from './gameIcons';
import { Crest } from './components/Crest';
import { cls, fmtMoney, formatDate, seasonLabel } from './format';
import { blocker } from '../engine/season/advance';
import { Logo, LogoMark } from './components/Logo';
import { FirstRunGuide, GuideModal } from './components/Guide';
import { CloudStatus, ConflictModal } from './components/Account';
import { transferWindowOpen } from '../engine/transfer/market';
import { Dashboard } from './screens/Dashboard';
import { Squad } from './screens/Squad';
import { LineupScreen } from './screens/Lineup';
import { TacticsScreen } from './screens/Tactics';
import { MatchesScreen } from './screens/Matches';
import { CalendarScreen } from './screens/Calendar';
import { StandingsScreen } from './screens/Standings';
import { MarketScreen } from './screens/Market';
import { StaffScreen } from './screens/Staff';
import { YouthScreen } from './screens/Youth';
import { FacilitiesScreen } from './screens/Facilities';
import { FinanceScreen } from './screens/Finance';
import { SponsorScreen } from './screens/Sponsors';
import { CompetitionsScreen } from './screens/Competitions';
import { HistoryScreen } from './screens/History';
import { InboxScreen, NewsScreen } from './screens/Inbox';
import { PlayerScreen } from './screens/Player';
import { ClubScreen } from './screens/Club';
import { MatchLive } from './screens/MatchLive';
import { ReportScreen } from './screens/Report';
import { ReviewScreen } from './screens/Review';
import { SettingsScreen } from './screens/Settings';
import { divisionOf } from '../engine/world/queries';

interface NavItem { view: ViewName; label: string; icon: string }
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [{ view: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    title: 'Squadra',
    items: [
      { view: 'rosa', label: 'Rosa', icon: 'rosa' },
      { view: 'formazione', label: 'Formazione', icon: 'formazione' },
      { view: 'tattiche', label: 'Tattiche', icon: 'tattiche' },
      { view: 'staff', label: 'Allenatore e staff', icon: 'staff' },
      { view: 'giovani', label: 'Settore giovanile', icon: 'giovani' },
    ],
  },
  {
    title: 'Gare',
    items: [
      { view: 'partite', label: 'Partite', icon: 'partite' },
      { view: 'calendario', label: 'Calendario', icon: 'calendario' },
      { view: 'classifica', label: 'Classifica', icon: 'classifica' },
      { view: 'competizioni', label: 'Competizioni', icon: 'competizioni' },
    ],
  },
  {
    title: 'Società',
    items: [
      { view: 'mercato', label: 'Mercato', icon: 'mercato' },
      { view: 'finanze', label: 'Finanze', icon: 'finanze' },
      { view: 'sponsor', label: 'Sponsor', icon: 'sponsor' },
      { view: 'strutture', label: 'Strutture', icon: 'strutture' },
      { view: 'storia', label: 'Storia del club', icon: 'storia' },
    ],
  },
];

export function App() {
  const world = useGame((s) => s.world);
  const busy = useGame((s) => s.busy);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const s = useGame.getState();
    void s.refreshCareers();
    // L'avvio non deve dipendere dalla rete: il controllo dell'account può continuare in background.
    const account = s.initAccount().catch(() => undefined);
    const wait = new Promise<void>((r) => setTimeout(r, 3500));
    void Promise.race([account, wait]).then(() => s.resumeLast()).catch(() => undefined).finally(() => setBooted(true));
  }, []);
  return (
    <ErrorBoundary>
      {!booted ? <Splash /> : world ? <Shell /> : <MainMenu />}
      {busy && <BusyOverlay text={busy} />}
      <Toasts />
    </ErrorBoundary>
  );
}

/** Se una schermata va in errore, invece di una pagina bianca mostra cosa fare: la carriera salvata resta al sicuro. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-full flex items-center justify-center p-5">
        <div className="panel max-w-md w-full p-6 text-center">
          <h1 className="font-display text-3xl font-extrabold uppercase">Ops, qualcosa non va</h1>
          <p className="text-sm text-mute mt-2">Si è verificato un errore in questa schermata. La tua carriera è salvata: non hai perso nulla.</p>
          <p className="text-xs text-faint mt-3 break-words">{this.state.error.message}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Button variant="success" icon="play" onClick={() => location.reload()}>Ricarica il gioco</Button>
            <Button variant="outline" icon="back" onClick={() => { this.setState({ error: null }); useGame.getState().go('dashboard'); }}>Torna alla dashboard</Button>
          </div>
        </div>
      </div>
    );
  }
}

function Splash() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Logo size="lg" stacked />
        <div className="wave h-3 mt-6 w-64 mx-auto" />
      </div>
    </div>
  );
}

function BusyOverlay({ text }: { text: string }) {
  const world = useGame((s) => s.world);
  useGame((s) => s.v);
  return (
    <div className="fixed inset-0 z-[60] bg-abyss/70 backdrop-blur-[2px] flex items-center justify-center">
      <div className="panel px-8 py-6 text-center min-w-[280px]">
        <div className="wave h-3 w-48 mx-auto mb-4" />
        <div className="font-semibold">{text}</div>
        {world && <div className="text-mute text-sm mt-1 num">{formatDate(world.season, world.day, true)}</div>}
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cls(
            'fade-in pointer-events-auto max-w-md rounded-2xl border-2 px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur',
            t.kind === 'err' ? 'bg-[#5b1a2a]/95 border-bad text-red-50' : t.kind === 'ok' ? 'bg-[#0f4a36]/95 border-good text-green-50' : 'bg-panel/95 border-line-2 text-ink',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const view = useGame((s) => s.view);
  const menuOpen = useGame((s) => s.menuOpen);
  const setMenu = useGame((s) => s.setMenu);
  return (
    <div className="min-h-full flex">
      <Sidebar />
      {menuOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMenu(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-[1500px] w-full mx-auto">
          <BackBar />
          <View view={view} />
        </main>
        <FirstRunGuide />
        <ConflictModal />
      </div>
    </div>
  );
}

const VIEW_NAMES: Partial<Record<ViewName, string>> = {
  dashboard: 'Dashboard', rosa: 'Rosa', formazione: 'Formazione', tattiche: 'Tattiche', partite: 'Partite', calendario: 'Calendario',
  classifica: 'Classifica', mercato: 'Mercato', staff: 'Allenatore e staff', giovani: 'Settore giovanile', strutture: 'Strutture',
  finanze: 'Finanze', sponsor: 'Sponsor', competizioni: 'Competizioni', storia: 'Storia del club', posta: 'Posta', notizie: 'Notizie',
  player: 'Scheda giocatore', club: 'Società', report: 'Tabellino', impostazioni: 'Salvataggi',
};

/** Freccia "Indietro" ben visibile (anche su telefono) nelle schede di dettaglio: giocatore, società, tabellino. */
function BackBar() {
  const view = useGame((s) => s.view);
  const stack = useGame((s) => s.stack);
  const back = useGame((s) => s.back);
  if (!['player', 'club', 'report'].includes(view)) return null;
  const prev = stack[stack.length - 1];
  const label = prev ? VIEW_NAMES[prev.view] ?? 'Indietro' : 'Dashboard';
  return (
    <button onClick={back} className="btn mb-4 inline-flex items-center gap-2 h-11 pl-3 pr-5 bg-gradient-to-b from-[#2a5aa8] to-[#1d4488] text-sm font-bold text-ink [--btn-edge:#0d2655]">
      <Icon name="back" size={20} weight="bold" />
      Torna a {label}
    </button>
  );
}

function View({ view }: { view: ViewName }) {
  switch (view) {
    case 'dashboard': return <Dashboard />;
    case 'rosa': return <Squad />;
    case 'formazione': return <LineupScreen />;
    case 'tattiche': return <TacticsScreen />;
    case 'partite': return <MatchesScreen />;
    case 'calendario': return <CalendarScreen />;
    case 'classifica': return <StandingsScreen />;
    case 'mercato': return <MarketScreen />;
    case 'staff': return <StaffScreen />;
    case 'giovani': return <YouthScreen />;
    case 'strutture': return <FacilitiesScreen />;
    case 'finanze': return <FinanceScreen />;
    case 'sponsor': return <SponsorScreen />;
    case 'competizioni': return <CompetitionsScreen />;
    case 'storia': return <HistoryScreen />;
    case 'posta': return <InboxScreen />;
    case 'notizie': return <NewsScreen />;
    case 'player': return <PlayerScreen />;
    case 'club': return <ClubScreen />;
    case 'match': return <MatchLive />;
    case 'report': return <ReportScreen />;
    case 'review': return <ReviewScreen />;
    case 'impostazioni': return <SettingsScreen />;
    default: return <Dashboard />;
  }
}

const NAV_TONE: Record<string, 'aqua' | 'gold' | 'good' | 'violet' | 'warn' | 'bad'> = {
  calendario: 'warn', classifica: 'gold', tattiche: 'violet', sponsor: 'good', storia: 'violet', posta: 'bad', notizie: 'aqua', save: 'aqua', dashboard: 'aqua',
};

function NavGlyph({ icon, size = 30 }: { icon: string; size?: number }) {
  const g = NAV_GAME_ICON[icon];
  if (g) return <GameIcon name={g} size={size} />;
  return <IconTile name={icon} size={size - 2} tone={NAV_TONE[icon] ?? 'aqua'} />;
}

function Sidebar() {
  const world = useGame((s) => s.world)!;
  useGame((s) => s.v);
  const view = useGame((s) => s.view);
  const go = useGame((s) => s.go);
  const menuOpen = useGame((s) => s.menuOpen);
  const club = world.clubs[world.userClubId];
  const unread = world.inbox.filter((m) => !m.read).length;
  const pending = world.events.filter((e) => !e.resolved).length;
  return (
    <aside
      className={cls(
        'fixed lg:sticky top-0 z-40 h-screen w-[17rem] shrink-0 flex flex-col border-r-2 border-white/10 bg-gradient-to-b from-[#0d2a63]/95 to-[#071a3a]/95 backdrop-blur transition-transform lg:translate-x-0',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <button className="m-3 mb-1 flex items-center gap-3 rounded-2xl bg-white/[0.07] border-2 border-white/10 px-3 py-3 text-left hover:bg-white/10 transition-colors" onClick={() => go('dashboard')}>
        <Crest spec={club.crest} size={44} />
        <div className="min-w-0">
          <div className="font-display font-extrabold text-xl leading-tight truncate">{club.name}</div>
          <div className="text-xs text-mute truncate">{divisionOf(world, club)} · {seasonLabel(world.season)}</div>
        </div>
      </button>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title || 'home'} className="mb-1.5">
            {g.title && <div className="px-3 pt-2.5 pb-1 text-[11.5px] font-bold uppercase tracking-wider text-faint">{g.title}</div>}
            {g.items.map((n) => (
              <NavButton key={n.view} active={view === n.view} onClick={() => go(n.view)} icon={n.icon} label={n.label} />
            ))}
          </div>
        ))}
        <div className="border-t-2 border-white/10 mx-3 my-2" />
        <SideLink view="posta" label="Posta e decisioni" icon="posta" badge={pending || unread} hot={pending > 0} />
        <SideLink view="notizie" label="Notizie" icon="notizie" />
        <SideLink view="impostazioni" label="Salvataggi" icon="impostazioni" />
      </nav>
      <CloudStatus />
      <div className="px-4 py-3 border-t-2 border-white/10 flex items-center gap-2.5">
        <LogoMark size={28} />
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[14px] font-extrabold tracking-wide">WATER POLO <span className="text-aqua">MANAGER</span></div>
          <div className="text-[11px] text-faint truncate">Presidente {world.presidentName}</div>
        </div>
      </div>
    </aside>
  );
}

function NavButton({ active, onClick, icon, label, badge, hot }: { active: boolean; onClick: () => void; icon: string; label: string; badge?: number; hot?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'group w-full flex items-center gap-3 pl-2 pr-3 h-10 my-px rounded-2xl text-[14.5px] font-bold transition-all active:scale-[0.98]',
        active
          ? 'text-[#032a3a] bg-gradient-to-b from-[#5ae9fb] to-[#1fc3dd] shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_3px_0_#0a7f97]'
          : 'text-ink/85 hover:text-ink hover:bg-white/10',
      )}
    >
      <span className={cls('flex w-8 shrink-0 items-center justify-center', active && 'drop-shadow-[0_2px_0_rgba(255,255,255,0.4)]')}><NavGlyph icon={icon} /></span>
      <span className="flex-1 text-left truncate">{label}</span>
      {!!badge && <span className={cls('rounded-full px-2 py-0.5 text-[11px] font-extrabold', hot ? 'bg-bad text-white' : 'bg-aqua/25 text-aqua')}>{badge}</span>}
    </button>
  );
}

function SideLink({ view, label, icon, badge, hot }: { view: ViewName; label: string; icon: string; badge?: number; hot?: boolean }) {
  const cur = useGame((s) => s.view);
  const go = useGame((s) => s.go);
  return <NavButton active={cur === view} onClick={() => go(view)} icon={icon} label={label} badge={badge} hot={hot} />;
}

function TopBar() {
  const world = useGame((s) => s.world)!;
  useGame((s) => s.v);
  const s = useGame.getState();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const club = world.clubs[world.userClubId];
  const b = blocker(world);
  const win = transferWindowOpen(world);
  const label = !b ? 'Continua' : b.reason === 'match' ? 'Giorno partita' : b.reason === 'roster' ? 'Sistema la rosa' : b.reason === 'event' ? 'Decisione richiesta' : b.reason === 'review' ? 'Fine stagione' : 'Game over';
  const shortLabel = !b ? 'Avanti' : b.reason === 'match' ? 'Partita' : b.reason === 'roster' ? 'Rosa' : b.reason === 'event' ? 'Decidi' : b.reason === 'review' ? 'Fine' : 'Fine';
  const onMain = () => {
    if (b?.reason === 'match') s.go('partite');
    else if (b?.reason === 'roster') { s.go('rosa'); s.toast(b.text, 'err'); }
    else if (b?.reason === 'event') s.go('posta', 'decisioni');
    else if (b?.reason === 'review' || b?.reason === 'gameover') s.go('review');
    else void s.continueGame('auto');
  };
  const grad = b
    ? 'bg-gradient-to-b from-[#ffdb6b] to-[#f5b11c] text-[#3a2600] [--btn-edge:#a56d00]'
    : 'bg-gradient-to-b from-[#62ec9d] to-[#27c264] text-[#04301a] [--btn-edge:#12803f]';
  return (
    <header className="sticky top-0 z-20 border-b-2 border-white/10 bg-[#071a3a]/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 sm:px-6 h-[72px] max-w-[1500px] mx-auto">
        <button className="lg:hidden flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-ink" onClick={() => s.setMenu(true)} aria-label="Menu">
          <Icon name="menu" size={24} weight="bold" />
        </button>
        {s.stack.length > 0 && (
          <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-ink hover:bg-white/20" onClick={() => s.back()} title="Indietro" aria-label="Indietro">
            <Icon name="back" size={22} weight="bold" />
          </button>
        )}
        <div className="min-w-0">
          <div className="font-display text-xl sm:text-2xl font-extrabold leading-none capitalize truncate"><span className="hidden sm:inline">{formatDate(world.season, world.day, true)}</span><span className="sm:hidden">{formatDate(world.season, world.day)}</span></div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-mute truncate">
            <span>Stagione {seasonLabel(world.season)}</span>
            <span className={cls('rounded-full px-2 py-0.5 text-[11px] font-bold', win.open ? 'bg-good/25 text-good' : 'bg-white/10 text-faint')}>{win.open ? `${win.name} aperto` : 'Mercato chiuso'}</span>
          </div>
        </div>
        <div className="flex-1" />
        <button className="flex h-11 items-center gap-1.5 rounded-2xl bg-white/10 px-3 text-sm font-bold text-ink hover:bg-white/20" onClick={() => setGuide(true)} title="Come si gioca" aria-label="Come si gioca">
          <Icon name="help" size={20} weight="bold" /><span className="hidden md:inline">Aiuto</span>
        </button>
        <GuideModal open={guide} onClose={() => setGuide(false)} />
        <div className="hidden md:flex items-center gap-2 rounded-2xl bg-black/25 border-2 border-white/10 pl-2 pr-4 h-12">
          <GameIcon name="finance" size={34} />
          <div className="leading-none">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">Saldo</div>
            <div className={cls('font-display text-xl font-extrabold num mt-0.5', club.finances.balance < 0 ? 'text-[#ff8f9c]' : 'text-good')}>{fmtMoney(club.finances.balance)}</div>
          </div>
        </div>
        <div className="relative flex">
          <button
            onClick={onMain}
            className={cls(
              'btn !rounded-r-none h-12 pl-4 sm:pl-5 pr-3 sm:pr-4 font-display text-lg sm:text-xl font-extrabold uppercase tracking-wide flex items-center gap-2 whitespace-nowrap',
              grad,
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
            <Icon name={b ? 'warn' : 'forward'} size={22} weight="fill" />
          </button>
          <button
            onClick={() => setOpen(!open)}
            disabled={!!b}
            className={cls('btn !rounded-l-none h-12 px-2.5 border-l-2 border-black/20 disabled:opacity-60', grad)}
            aria-label="Opzioni di avanzamento"
            title="Avanza di un giorno, una settimana o fino alla prossima novità"
          >
            <Icon name="next" size={16} weight="bold" className="rotate-90" />
          </button>
          {open && !b && (
            <div className="absolute right-0 top-14 panel p-2 w-64 z-50" onMouseLeave={() => setOpen(false)}>
              {[
                { m: 'day' as const, t: 'Avanza di un giorno', i: 'next' },
                { m: 'week' as const, t: 'Avanza di una settimana', i: 'forward' },
                { m: 'auto' as const, t: 'Fino alla prossima novità', i: 'bolt' },
              ].map((o) => (
                <button key={o.m} className="w-full flex items-center gap-3 text-left px-3 h-11 rounded-xl text-sm font-bold hover:bg-white/10" onClick={() => { setOpen(false); void s.continueGame(o.m); }}>
                  <Icon name={o.i} size={18} weight="bold" className="text-aqua" />{o.t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
