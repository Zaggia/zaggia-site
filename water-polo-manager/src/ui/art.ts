// Illustrazioni 2D del gioco, generate con l'AI di Canva (stile flat editoriale, palette del marchio).

import hero from '../assets/art/hero.webp';
import piscina from '../assets/art/piscina.webp';
import allenamento from '../assets/art/allenamento.webp';
import palestra from '../assets/art/palestra.webp';
import medico from '../assets/art/medico.webp';
import giovanile from '../assets/art/giovanile.webp';
import scouting from '../assets/art/scouting.webp';
import uffici from '../assets/art/uffici.webp';
import partita from '../assets/art/partita.webp';
import mercato from '../assets/art/mercato.webp';
import trofeo from '../assets/art/trofeo.webp';
import type { FacilityKey } from '../engine/types';

export const ART = { hero, piscina, allenamento, palestra, medico, giovanile, scouting, uffici, partita, mercato, trofeo };

export const FACILITY_ART: Record<FacilityKey, string> = {
  piscina,
  allenamento,
  palestra,
  medico,
  giovanile,
  scouting,
  uffici,
};
