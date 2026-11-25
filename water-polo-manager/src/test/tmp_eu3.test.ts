import { it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { teamStrength } from '../engine/club/lineup';
import { coachRating } from '../engine/staff/coach';
it('eu3', () => {
  const w: any = createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 5,
  });
  const cs = Object.values(w.clubs) as any[];
  const rows = (f: (c: any) => boolean) => cs.filter(f).sort((a, b) => teamStrength(w, b) - teamStrength(w, a)).slice(0, 8).map((c) => ({ n: c.name, s: teamStrength(w, c), coach: c.coachId ? coachRating(w.coaches[c.coachId]) : null, chem: Math.round(c.chemistry), fit: Math.round(c.fitnessPrep), rep: Math.round(c.reputation), staff: Object.values(c.staff).filter(Boolean).length }));
  console.log('ITA', JSON.stringify(rows((c) => c.country === 'ITA' && c.division === 'A1')));
  console.log('EST', JSON.stringify(rows((c) => c.country !== 'ITA')));
});
