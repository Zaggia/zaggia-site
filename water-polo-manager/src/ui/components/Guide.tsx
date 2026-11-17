// Guida rapida: si apre alla prima partita della carriera e si può riaprire dal pulsante "?".

import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Button, Modal } from './ui';
import { Icon } from './icons';
import { ART } from '../art';
import { cls } from '../format';

const STEPS = [
  {
    title: 'Il tempo scorre con Continua',
    icon: 'forward',
    image: ART.piscina,
    text: 'Il pulsante in alto a destra fa avanzare i giorni. Si ferma da solo quando serve una tua scelta: una partita, una decisione, una novità importante.',
  },
  {
    title: 'Parti da "Da fare adesso"',
    icon: 'check',
    image: ART.uffici,
    text: 'Nella dashboard trovi le prossime mosse utili in ordine di urgenza: decisioni, contratti, sponsor, strutture. Un clic e sei nella schermata giusta.',
  },
  {
    title: 'Squadra: formazione e tattiche',
    icon: 'formazione',
    image: ART.allenamento,
    text: 'Scegli i 7 in acqua nelle posizioni da 1 a 6 più il portiere, poi la panchina. Le tattiche rendono di più quando la squadra le ha imparate.',
  },
  {
    title: 'Società: soldi e mercato',
    icon: 'finanze',
    image: ART.mercato,
    text: 'Sponsor, biglietti e abbonamenti pagano gli stipendi. La rosa è sempre di 15: per comprare un giocatore devi prima liberare un posto.',
  },
];

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <Modal open={open} onClose={onClose} title="Come si gioca"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Salta</Button>
        {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)}>Indietro</Button>}
        <Button onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Inizia' : 'Avanti'}</Button>
      </>}>
      <div className="-mx-5 -mt-4 mb-4 h-40 relative overflow-hidden">
        <img src={step.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 art-fade-bottom" />
      </div>
      <div className="flex items-center gap-2 text-aqua"><Icon name={step.icon} size={20} weight="bold" /><span className="text-xs text-mute">Passo {i + 1} di {STEPS.length}</span></div>
      <h3 className="font-display text-2xl font-bold uppercase tracking-wide mt-1">{step.title}</h3>
      <p className="text-sm text-mute leading-relaxed mt-2">{step.text}</p>
      <div className="flex gap-1.5 mt-5">
        {STEPS.map((_, k) => <span key={k} className={cls('h-1.5 flex-1 rounded-full', k <= i ? 'bg-aqua' : 'bg-white/10')} />)}
      </div>
    </Modal>
  );
}

/** Mostra la guida al primo ingresso nella carriera. */
export function FirstRunGuide() {
  const world = useWorld();
  const act = useGame((s) => s.act);
  const seen = !!world.flags.guideSeen;
  return <GuideModal open={!seen} onClose={() => act((w) => { w.flags.guideSeen = true; })} />;
}
