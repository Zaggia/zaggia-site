// Avviso sulla rosa regolamentare (15 tesserati per squadra) con le azioni rapide per sistemarla.

import { useGame, useWorld } from '../../store/game';
import { rosterIssue } from '../../engine/club/roster';
import { fillRoster } from '../../engine/ai/clubAI';
import { Button } from './ui';
import { Icon } from './icons';

export function RosterNotice({ compact = false }: { compact?: boolean }) {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const club = world.clubs[world.userClubId];
  const issue = rosterIssue(world, club);
  if (!issue) return null;
  const complete = () =>
    useGame.getState().act((w) => {
      const added = fillRoster(w, w.clubs[w.userClubId]);
      return added.length ? null : 'Nessun giocatore disponibile da aggiungere: prova dal calciomercato.';
    }, 'Rosa completata con giovani del vivaio e svincolati.');
  return (
    <div className="panel border-warn/50 p-4 mb-4 flex flex-wrap items-center gap-3 fade-in" role="alert">
      <Icon name="warn" className="text-warn" size={22} />
      <div className="flex-1 min-w-[220px]">
        <div className="font-semibold">Rosa {issue.count}/{issue.limit}: {issue.kind === 'over' ? 'troppi tesserati' : 'rosa incompleta'}</div>
        {!compact && <div className="text-sm text-mute">{issue.text} Prima di ogni partita ufficiale la lista deve essere in regola.</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {issue.kind === 'under' && <Button variant="gold" onClick={complete}>Completa la rosa</Button>}
        <Button variant="outline" onClick={() => go(issue.kind === 'under' ? 'mercato' : 'rosa')}>{issue.kind === 'under' ? 'Calciomercato' : 'Gestisci la rosa'}</Button>
      </div>
    </div>
  );
}
