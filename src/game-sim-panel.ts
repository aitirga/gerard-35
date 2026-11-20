/**
 * The picker's Partida tab (docs/dev-tools.md § Partida): the last whole-game report (`just game-sim`,
 * src/game-sim.ts) drawn small, and a way to jump the real game to where the simulated player was.
 * It only reads `output/reports/game/data.json`, which the development server serves as it is.
 * Pure strings: src/jump-menu.ts puts them in the picker and handles the clicks.
 */
import type { GameSummary, PlayerSummary } from './game-sim.ts';
import type { AnimaId } from './animas.ts';
import { TIMELINE, isChapter2, stepOf } from './story-points.ts';
import { STORY_FLAGS, type StoryFlag } from './story.ts';

export const GAME_REPORT = './output/reports/game/data.json';
export const GAME_PAGE = './output/reports/game/index.html';
/** The mission each finishing flag closes: what a jump from the simulated game starts with done. */
const CLOSES: Partial<Record<StoryFlag, AnimaId>> = { 'nuria-uri': 'nuria', sobremesa: 'universidad', voz: 'marta', converge: 'emilie', fran: 'luca' };

const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const pc = (x: number | null | undefined) => x == null ? '–' : `${Math.round(x * 100)} %`;
const mn = (x: number | null | undefined) => x == null ? '–' : `${Math.round(x)} min`;

/** A key moment of the simulated game the real one can start at: the flag, its day and the missions done by then. */
export interface SimJump { flag: StoryFlag; day?: number; missions?: AnimaId[] }
/** The moments of `player`'s typical game worth jumping to: the timeline's key events and each mission's end, in order. */
export function simMoments(player: PlayerSummary): { minute: number; day: number; label: string; jump: SimJump; fights: number }[] {
  const castle = ['aurelia', 'direccion', 'aitor-poseido', 'artilugio', 'final-acabar', 'final-bajar'];
  const keys = new Set<string>([...TIMELINE.map(t => t.at).filter(at => at !== 'new'), ...Object.keys(CLOSES), 'palace-tried', 'cardedeu', 'camping', 'cuerdas', ...castle]);
  // Only what the picker can jump to: a story flag with its step (src/story-points.ts).
  const jumpable = (flag: string): flag is StoryFlag => { try { return STORY_FLAGS.includes(flag as StoryFlag) && !!stepOf(flag as StoryFlag); } catch { return false; } };
  const flags = player.sample.moments.filter(m => m.kind === 'flag' && m.flag && keys.has(m.flag) && jumpable(m.flag));
  return flags.map(m => {
    const done = player.sample.moments.filter(o => o.kind === 'flag' && o.t <= m.t && o.flag && CLOSES[o.flag]).map(o => CLOSES[o.flag!]!);
    const later = isChapter2(m.flag!);
    return {
      minute: Math.round(m.t / 60), day: m.day, label: stepOf(m.flag!).step.label,
      jump: later ? { flag: m.flag!, day: m.day, missions: [...new Set(done)] } : { flag: m.flag! },
      fights: player.sample.fights.filter(f => f.t <= m.t).length,
    };
  });
}

/** The difficulty curve of every player, small: a line each over the game's tenths. */
function curve(data: GameSummary) {
  const W = 300, H = 92, L = 4, T = 6, B = 14, colours = ['#7fb6ff', '#ff9a66', '#5fd6a8'];
  const x = (i: number) => L + (W - L * 2) * (i + .5) / 10, y = (v: number) => T + (H - T - B) * (1 - v);
  let svg = `<svg class="sim-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dificultad a lo largo de la partida">`;
  for (const v of [0, .5, 1]) svg += `<line x1="${L}" x2="${W - L}" y1="${y(v)}" y2="${y(v)}" stroke="#ffffff14"/>`;
  data.players.forEach((p, k) => {
    const pts = p.curve.map((c, i) => c.difficulty == null ? '' : `${x(i)},${y(c.difficulty)}`).filter(Boolean).join(' ');
    svg += `<polyline fill="none" stroke="${colours[k % 3]}" stroke-width="1.6" points="${pts}"/>`;
  });
  svg += `<text x="${L}" y="${H - 2}" font-size="8" fill="#ffffff80">inicio</text><text x="${W - L}" y="${H - 2}" font-size="8" fill="#ffffff80" text-anchor="end">final</text></svg>`;
  return `${svg}<div class="sim-legend">${data.players.map((p, k) => `<span><i style="background:${colours[k % 3]}"></i>${escape(p.name)}</span>`).join('')}</div>`;
}

/** The Partida page: the report's numbers per player, its curve, and the typical game of the one picked, to jump into. */
export function simPage(data: GameSummary | null | 'missing', picked: string | undefined): string {
  if (data === null) return '<p class="jump-note">Cargando el último informe…</p>';
  if (data === 'missing') return `<p class="jump-note">Aún no hay informe del juego entero. En un terminal: <code>just game-sim</code> (un par de minutos) y vuelve a abrir esta pestaña.</p>`;
  const player = data.players.find(p => p.id === picked) ?? data.players[0];
  const { made, names = {} } = data as GameSummary & { made?: string; names?: Record<string, string> };
  const moments = simMoments(player);
  return `
    <p class="jump-note">El juego entero jugado sin pantalla: ${data.runs} partidas${made ? ` · ${escape(new Date(made).toLocaleString('es-ES'))}` : ''} · <a href="${GAME_PAGE}" target="_blank" rel="noopener">el informe completo</a> · <code>just game-sim</code> lo rehace.</p>
    <section class="jump-group"><h3 class="eyebrow">DIFICULTAD A LO LARGO DE LA PARTIDA</h3>${curve(data)}</section>
    <div class="jump-row" role="group" aria-label="Jugador simulado"><span>Jugador</span>${data.players.map(p => `<button type="button" data-sim-player="${p.id}" aria-pressed="${p.id === player.id}">${escape(p.name)}</button>`).join('')}</div>
    <section class="jump-group sim-numbers">
      <div><b>${mn(player.minutes.p50)}</b><small>duración (p10 ${mn(player.minutes.p10)}, p90 ${mn(player.minutes.p90)})</small></div>
      <div><b>${player.days.mean ?? '–'}</b><small>días · ${player.rewinds.mean ?? 0} rebobinados</small></div>
      <div><b>${player.fights ?? '–'}</b><small>combates · ${player.losses ?? 0} perdidos</small></div>
      <div><b>${player.saturation ? pc(player.saturation.at) : 'no'}</b><small>se satura${player.saturation ? ` (min ${player.saturation.minute})` : ''}</small></div>
    </section>
    <p class="jump-note">${player.levels.filter(l => l.reached).map(l => `${escape(l.anima)} ${l.level}: min ${l.minute ?? '–'} (${pc(l.at)})`).join(' · ') || 'Ninguna ánima sube de nivel.'}${player.walls.length ? ` · Muros: ${player.walls.map(id => escape(names[id] ?? id)).join(', ')}` : ''}</p>
    <section class="jump-group"><h3 class="eyebrow">UNA PARTIDA TÍPICA · ${player.sample.minutes} MIN · SALTAR AQUÍ</h3>${moments.map(m => `
      <button type="button" class="jump-item" data-sim-jump='${escape(JSON.stringify(m.jump))}'>
        <strong>${escape(m.label)}</strong><small>min ${m.minute}${m.day ? ` · día ${m.day}` : ''} · ${m.fights} combates hasta aquí${m.jump.missions?.length ? ` · con ${m.jump.missions.join(', ')}` : ''}</small>
      </button>`).join('')}</section>`;
}
