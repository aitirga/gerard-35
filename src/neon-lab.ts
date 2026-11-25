import type { createGame } from './game';
import { screenAxes, type V3 } from './dual-fx';
import type { DuoStage } from './duo-fx';
import { neonCircle, neonCurve, neonDashes } from './math-figures';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: Matemágico's neon as a dual's own look draws it (`DuoStage.figure` and `draw`,
 * src/duo-fx/types.ts), a section of the effects lab (`?fxlab`, just dev-fx, src/fx-lab.ts). Two
 * studies of what the API is for, not any dual's look: a board of pegs in the camera's plane over
 * the foes whose bell is drawn from the balls that fell, and a parabola with its focus and dashed
 * directrix that turns in the world until its focus sits on a foe. Only the look.
 */
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: V3): V3 => { const d = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / d, y: a.y / d, z: a.z / d }; };
const mean = (list: readonly V3[]) => list.reduce((s, p) => add(s, p, 1 / list.length), { x: 0, y: 0, z: 0 });
const ease = (k: number) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const xy = (x: number, y: number): V3 => ({ x, y, z: 0 });

/** Rows of pegs, and how many balls fall through them for the bell. */
const ROWS = 8, BALLS = 72;

/** A Galton board over the foes, in the camera's plane: its triangle, its pegs a tick of the pen each, the balls' histogram and the bell drawn from it. */
function galton(stage: DuoStage) {
  const foes = stage.foes();
  if (!foes.length) return 'Hace falta un combate con enemigos.';
  const axes = screenAxes(stage.view), centre = mean(foes.map(f => f.feet));
  const half = Math.max(1.1, ...foes.map(f => Math.abs(dot(sub(f.feet, centre), axes.right)) + f.radius + .3));
  const height = half * .85, dx = 2 * half * .86 / ROWS, dy = height * .8 / (ROWS + 1), depth = height * .6;
  // The bins' floor stands clear over the tallest foe's head; the board above it.
  const at = add(add(centre, { x: 0, y: 1, z: 0 }, Math.max(...foes.map(f => f.height)) + .3 + depth), axes.facing, .5);
  const board = stage.figure('Tablero de Galton', { frame: { at, ...axes } });
  // The triangle, apex up, its base on the frame's origin line.
  const apex = xy(0, height), left = xy(-half, 0), right = xy(half, 0);
  const sides = [board.stroke(neonCurve(12, u => xy(apex.x + (left.x - apex.x) * u, apex.y + (left.y - apex.y) * u)), { radius: .022 }), board.stroke(neonCurve(12, u => xy(apex.x + (right.x - apex.x) * u, apex.y + (right.y - apex.y) * u)), { radius: .022 })];
  const base = board.stroke(neonCurve(16, u => xy(-half + 2 * half * u, 0)), { radius: .018 });
  // The pegs, row by row from the top, each a small ring.
  const pegAt: V3[] = [];
  for (let r = 0; r < ROWS; r++) for (let j = 0; j <= r; j++) pegAt.push(xy((j - r / 2) * dx, height - (r + 1.4) * dy));
  const pegs = pegAt.map(p => board.stroke(neonCircle(.03, 10, p), { radius: .01 }));
  // Where each ball ends: how many times it went right.
  const bins = Array<number>(ROWS + 1).fill(0);
  for (let b = 0; b < BALLS; b++) { let k = 0; for (let r = 0; r < ROWS; r++) k += Math.random() < .5 ? 1 : 0; bins[k]++; }
  const tall = depth * .85 / Math.max(...bins), binX = (k: number) => (k - ROWS / 2) * dx;
  const floor = board.stroke(neonCurve(16, u => xy(-half * .9 + 1.8 * half * u, -depth)), { radius: .014 });
  const bars = bins.map((n, k) => board.stroke([xy(binX(k), -depth), xy(binX(k), -depth + Math.max(.02, n * tall))], { radius: .02, look: { core: '#fff8e6', halo: '#ff9a3c' } }));
  // The bell drawn from the balls: their own mean and spread, as tall as the histogram.
  const mu = bins.reduce((s, n, k) => s + n * k, 0) / BALLS, sigma = Math.sqrt(bins.reduce((s, n, k) => s + n * (k - mu) ** 2, 0) / BALLS) || 1;
  const peak = BALLS / (sigma * Math.sqrt(2 * Math.PI)) * tall;
  const bell = board.stroke(neonCurve(48, u => { const k = -.5 + (ROWS + 1) * u; return xy(binX(k), -depth + peak * Math.exp(-((k - mu) ** 2) / (2 * sigma * sigma))); }), { radius: .026, look: { core: '#ffffff', halo: '#f3cf78' } });

  stage.draw(board, [...sides, base, floor], .35);
  stage.draw(board, pegs, .55, { delay: .35, each: i => stage.cue('peg', { pan: stage.pan(board.world(pegAt[i])), volume: .7 }) });
  stage.cue('pachinko', { delay: .9 });
  stage.draw(board, bars, .5, { delay: 1, pen: false });
  stage.cue('chord-swell', { delay: 1.45 });
  stage.draw(board, [bell], .55, { delay: 1.5, done: () => {
    board.glow(1.2, .8);
    stage.fx.burst('flare', { at: board.world(xy(binX(mu), -depth + peak)), count: 1, spread: .02, life: [.16, .24], colour: '#f3cf78', light: { intensity: 2.4, range: 3, colour: '#f3cf78' } });
    stage.pulse(.2, .4);
  } });
  board.fade(.7, 2.6);
  return `Galton: ${BALLS} bolas, media ${mu.toFixed(2)}, σ ${sigma.toFixed(2)}`;
}

/** A parabola with its focus and dashed directrix, drawn facing the camera by the first of the party, that turns in the world until its focus sits on `target`'s chest. */
function parabola(stage: DuoStage, targetId?: string) {
  const foes = stage.foes(), target = (targetId && foes.find(f => f.id === targetId)) || foes[Math.floor(foes.length / 2)];
  const from = stage.wearer('matemagico') ?? stage.party()[0];
  if (!target || !from) return 'Hace falta un combate con un aliado y un enemigo.';
  const axes = screenAxes(stage.view), p = .2, reach = .62;
  const start = add(add(from.chest, { x: 0, y: 1, z: 0 }, .75), axes.facing, .3);
  const fig = stage.figure('Parábola', { frame: { at: start, ...axes } });
  const curve = fig.stroke(neonCurve(40, u => { const x = -reach + 2 * reach * u; return xy(x, x * x / (4 * p)); }), { radius: .024 });
  const focus = fig.stroke(neonCircle(.04, 14, xy(0, p)), { radius: .016, look: { core: '#ffffff', halo: '#ffe24a' } });
  const directrix = neonDashes([xy(-reach * 1.1, -p), xy(reach * 1.1, -p)], 9).map(d => fig.stroke(d, { radius: .012 }));
  stage.draw(fig, [curve], .4);
  stage.draw(fig, directrix, .25, { delay: .4 });
  stage.draw(fig, [focus], .12, { delay: .65 });
  // It rises and turns until its axis (its y) points at the foe and the focus lands on the chest, growing round it.
  const TURN = 1, way = norm(sub(target.chest, start));
  stage.cue('whine', { delay: .7, volume: .8, pan: stage.pan(start) });
  stage.fx.after(.8, () => fig.animate(TURN, t => {
    const k = ease(t / TURN), scale = 1 + 1.6 * k;
    const up = norm(add(axes.up, sub(way, axes.up), k));
    // Its focus goes from where it was drawn to the chest; the figure hangs off it.
    const focusAt = add(add(start, axes.up, p), sub(target.chest, add(start, axes.up, p)), k);
    fig.place({ at: add(focusAt, up, -p * scale), up, facing: axes.facing, scale });
  }, () => {
    stage.cue('snap', { pan: stage.pan(target.chest) });
    stage.hit(target.id, [1, .95, .55], 1.2);
    stage.shake(.35); stage.pulse(.5, .6, .2);
    fig.glow(1.4, 1);
    stage.fx.burst('spark', { at: target.chest, count: 60, spread: .1, speed: 4, up: 1, life: [.2, .5], colour: '#fff2a8' });
    fig.fade(.45, .1);
  }));
  return `Parábola hasta ${target.id}`;
}

export function mountNeonLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  section.innerHTML = `<h3>Matemágico · figuras de neón (dúos)</h3>
    <div class="fx-lab-grid"><button type="button" data-neon="galton" title="Tablero de clavos en el plano de la cámara; la campana sale de las bolas que cayeron">Galton y campana</button><button type="button" data-neon="parabola" title="Parábola con foco y directriz que gira en el mundo hasta que el foco cae en el enemigo elegido">Parábola y foco</button></div>
    <p class="fx-lab-note" data-neon-readout hidden></p>`;
  body.append(section);
  const readout = section.querySelector<HTMLElement>('[data-neon-readout]')!;
  const onClick = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-neon]');
    if (!button) return;
    const stage = game.duoStage(), target = document.querySelector<HTMLSelectElement>('.fx-lab [data-field="target"]')?.value;
    game.frame();
    const said = button.dataset.neon === 'galton' ? galton(stage) : parabola(stage, target);
    readout.textContent = said; readout.hidden = false;
  };
  section.addEventListener('click', onClick);
  return { destroy() { section.removeEventListener('click', onClick); section.remove(); } };
}
