import type { Competition, Fixture, StandingRow, World } from '../types';
import { leagueRules } from '../data/config';

/** Classifica di un girone (fase a gironi), con penalizzazioni e criteri di parità. */
export function computeStandings(world: World, comp: Competition, phaseIdx = 0, groupIdx = 0): StandingRow[] {
  const phase = comp.phases[phaseIdx];
  const group = phase?.groups[groupIdx];
  if (!group) return [];
  const pts = comp.kind === 'league' ? leagueRules(world.rules, comp.key).points : { win: 3, draw: 1, loss: 0 };
  const rows = new Map<string, StandingRow>();
  for (const id of group.clubIds) rows.set(id, { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  const played: Fixture[] = [];
  for (const fid of group.fixtureIds) {
    const f = world.fixtures[fid];
    if (!f || !f.played) continue;
    played.push(f);
  }
  played.sort((a, b) => a.day - b.day);
  for (const f of played) {
    const h = rows.get(f.homeId);
    const a = rows.get(f.awayId);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
    if (f.hg > f.ag) { h.w++; a.l++; h.pts += pts.win; a.pts += pts.loss; h.form.push('W'); a.form.push('L'); }
    else if (f.hg < f.ag) { a.w++; h.l++; a.pts += pts.win; h.pts += pts.loss; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts += pts.draw; a.pts += pts.draw; h.form.push('D'); a.form.push('D'); }
  }
  for (const r of rows.values()) {
    r.pts -= comp.penalties[r.clubId] ?? 0;
    r.form = r.form.slice(-5);
  }
  const list = [...rows.values()];
  // Punti negli scontri diretti tra squadre a pari punti.
  const h2h = (ids: Set<string>) => {
    const m = new Map<string, { pts: number; gd: number }>();
    for (const id of ids) m.set(id, { pts: 0, gd: 0 });
    for (const f of played) {
      if (!ids.has(f.homeId) || !ids.has(f.awayId)) continue;
      const h = m.get(f.homeId)!;
      const a = m.get(f.awayId)!;
      h.gd += f.hg - f.ag; a.gd += f.ag - f.hg;
      if (f.hg > f.ag) h.pts += 3; else if (f.hg < f.ag) a.pts += 3; else { h.pts++; a.pts++; }
    }
    return m;
  };
  const byPts = new Map<number, string[]>();
  for (const r of list) byPts.set(r.pts, [...(byPts.get(r.pts) ?? []), r.clubId]);
  const h2hScore = new Map<string, { pts: number; gd: number }>();
  for (const ids of byPts.values()) {
    if (ids.length < 2) continue;
    const m = h2h(new Set(ids));
    for (const [k, v] of m) h2hScore.set(k, v);
  }
  list.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const ha = h2hScore.get(a.clubId);
    const hb = h2hScore.get(b.clubId);
    if (ha && hb) {
      if (hb.pts !== ha.pts) return hb.pts - ha.pts;
      if (hb.gd !== ha.gd) return hb.gd - ha.gd;
    }
    const gd = b.gf - b.ga - (a.gf - a.ga);
    if (gd !== 0) return gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return (world.clubs[a.clubId]?.name ?? '').localeCompare(world.clubs[b.clubId]?.name ?? '');
  });
  return list;
}

/**
 * Posizione "affidabile" per il motore: finché il club ha giocato poche partite la classifica è quasi tutta a pari
 * punti e l'ordine dipende dal nome (chi inizia per A sarebbe "primo"), quindi non si deve usare per decidere nulla.
 */
export function reliablePosition(world: World, comp: Competition, clubId: string, minPlayed = 3): { group: number; pos: number } | null {
  const phase = comp.phases[0];
  if (!phase) return null;
  for (let g = 0; g < phase.groups.length; g++) {
    if (!phase.groups[g].clubIds.includes(clubId)) continue;
    const st = computeStandings(world, comp, 0, g);
    const i = st.findIndex((r) => r.clubId === clubId);
    return st[i] && st[i].p >= minPlayed ? { group: g, pos: i + 1 } : null;
  }
  return null;
}

export function positionOf(world: World, comp: Competition, clubId: string): { group: number; pos: number } | null {
  const phase = comp.phases[0];
  if (!phase) return null;
  for (let g = 0; g < phase.groups.length; g++) {
    if (!phase.groups[g].clubIds.includes(clubId)) continue;
    const st = computeStandings(world, comp, 0, g);
    return { group: g, pos: st.findIndex((r) => r.clubId === clubId) + 1 };
  }
  return null;
}
