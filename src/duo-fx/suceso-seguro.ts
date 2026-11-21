import type { BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { FACE_STROKES } from '../die-faces';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Suceso seguro (dúo mayor: Matemágico's Análisis + Dadista's Ases en dúo), the event of probability
 * one. Gerard chalks a distribution in gold in the air over the party, a bell on its baseline, while
 * Dadista throws one die of cold light up for each ally, tumbling. The bell narrows and grows taller
 * as the dice turn, until it is a single spike with «P = 1» written beside it; at that moment every
 * die stops dead in the air, all turned the same way and all showing the same face, the Comodín's
 * star in gold. Then each die drops into its ally and leaves a sharp mark of gold and ice on them,
 * and the spike runs down into the floor. While the certainty lasts (`state.certain`), a small gold
 * «1» turns slowly over each ally's head.
 */
const C = { gold: '#eab04a', pale: '#f3cf78', chalk: '#fff1cc', ice: '#bfe0ff', core: '#f4f9ff', halo: '#7fb4ff' } as const;
/** When the dice stop and the curve is a spike; when the dice drop; when the numbers land; when it is over. */
const FREEZE = .66, DROP = .14, CONTACT = 1.0, END = 2.0;

/** Chalk dust off Gerard's figure: matte-ish gold specks that fall slowly and drift. */
const CHALK: GpuKind = {
  shape: 'powder', drag: 3.2, gravity: .9, curl: .45, response: .4, size: [.018, .012], sizeJitter: .6,
  colours: ['#fff6dc', '#f3d892', '#c9a95a'], intensity: [1.9, 1.5, 1.1], middle: .35, fadeIn: .04, fadeOut: .45, additive: .35, opacity: .9, core: 0,
};

/** A die's edges: dots of cold light dimmer than a dual's glyphs, so the gold star on its face stands out. */
const EDGE: GpuKind = {
  shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.02, .014], sizeJitter: .2,
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.2, 1.7, 1], middle: .45, fadeIn: .04, fadeOut: .35, additive: 1, flicker: .08, core: .2,
};

const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** Defines one of this dual's own kinds on first use; the fallback where it cannot. */
function kind(stage: DuoStage, name: string, def: GpuKind, fallback: string) {
  const g = stage.effects.gpu;
  if (!g) return fallback;
  try { if (!g.get(name)) g.define(name, def); return name; } catch { return fallback; }
}

/** Three axes turned by angles about x, y and z (a die's tumble), in the frame of `right`, `up`, `facing`. */
function turned(ax: number, ay: number, az: number, right: V3, up: V3, facing: V3) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  // Rows of Rz·Ry·Rx, then into the world through the screen's axes.
  const m = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  const col = (j: number): V3 => add(add(add({ x: 0, y: 0, z: 0 }, right, m[0][j]), up, m[1][j]), facing, m[2][j]);
  return { ex: col(0), ey: col(1), ez: col(2) };
}

/** Where an ally's die stands: at their shoulder, on the screen's right of them, clear of what floats over their head. */
const sideOf = (f: DuoFighter, right: V3, facing: V3) => add(add(add(f.chest, right, f.radius + .3), UP, .42), facing, .2);
/** A cube's corners (±1 each way) and its twelve edges, as pairs of corners. */
const CORNERS = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z] as const)));
const EDGES = CORNERS.flatMap((a, i) => CORNERS.flatMap((b, j) => j > i && [0, 1, 2].filter(d => a[d] !== b[d]).length === 1 ? [[i, j] as const] : []));

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },
  start(stage, _e, reached) {
    const fx = stage.fx;
    if (!fx.on) return;
    const party = reached.length ? reached : stage.party();
    if (!party.length) return;
    const chalk = kind(stage, 'suceso-seguro-chalk', CHALK, 'glyph'), edge = kind(stage, 'suceso-seguro-edge', EDGE, 'glyph');
    const { right, up, facing } = screenAxes(stage.view);
    const mid = party.reduce((s, f) => add(s, f.chest, 1 / party.length), { x: 0, y: 0, z: 0 });
    const feet = party.reduce((s, f) => add(s, f.feet, 1 / party.length), { x: 0, y: 0, z: 0 });
    // The board stands beside the party, on the foes' side of them and a little towards the camera,
    // `W` wide, its baseline at about a waist's height; the bell rises off it.
    const foes = stage.foes(), there = foes.length ? foes.reduce((s, f) => add(s, f.feet, 1 / foes.length), { x: 0, y: 0, z: 0 }) : add(feet, right, 3);
    const way = (() => { const d = { x: there.x - feet.x, y: 0, z: there.z - feet.z }, n = Math.hypot(d.x, d.z) || 1; return { x: d.x / n, y: 0, z: d.z / n }; })();
    const W = 1.7, half = W / 2, Hmax = 1;
    const base = add(add({ ...feet, y: feet.y + .95 }, way, 1.8 + Math.max(...party.map(f => f.radius)) * .5), facing, .4);
    const at = (x: number, y: number) => add(add(base, right, x), up, y);
    const left = at(-half, 0), rightEnd = at(half, 0);

    // ── Gerard: the baseline in chalk-gold, its ticks, and the bell narrowing into a spike. ──
    const math = stage.wearer('matemagico'), dice = stage.wearer('dadaista');
    if (math?.hand) stage.effects.trails.comet(math.hand, left, ['#fff4cf', C.gold], .14, { arc: .5, width: .06, life: .3, intensity: 2.6, core: .5 });
    fx.after(.12, () => {
      fx.line(left, rightEnd, C.gold, { count: Math.round(W * 45), life: CONTACT + .1 - .12, size: 1.5 });
      for (let k = -4; k <= 4; k++) fx.line(at(k / 4 * half * .9, 0), at(k / 4 * half * .9, -.07 - (k % 2 ? 0 : .04)), C.chalk, { count: 5, life: CONTACT - .1, size: 1.2 });
    });
    // σ shrinks, the peak climbs (the area stays the same until it can climb no more).
    const sigmas = [.42, .28, .18, .11, .065, .035];
    sigmas.forEach((sigma, k) => {
      const s = sigma * half, peak = Math.min(Hmax, .3 * (.42 / sigma) ** .8);
      const t0 = .16 + k * .085, life = k === sigmas.length - 1 ? FREEZE - t0 + .06 : .12;
      // The core of the bell out to 3.2σ in 14 strokes, and straight baseline beyond it.
      const reach = Math.min(half, 3.2 * s), n = 14;
      const p = (i: number) => { const x = -reach + 2 * reach * i / n; return at(x, peak * Math.exp(-(x * x) / (2 * s * s))); };
      for (let i = 0; i < n; i++) fx.after(t0 + (i % 2) * .012, () => fx.line(p(i), p(i + 1), k > 3 ? C.pale : C.gold, { count: 7 + k, life, size: 1.5 + k * .1 }));
      // Chalk falls off each one as it is rubbed out for the next.
      fx.after(t0 + .03, () => fx.burst(chalk, { at: p(n / 2), to: p(n / 2 - 3), shape: 'line', count: 10, speed: .25, life: [.6, 1.1], colour: C.gold }));
    });
    // The spike: probability one. A line straight up off the baseline, «P = 1» written beside it.
    const spikeTop = at(0, Hmax + .25);
    fx.after(FREEZE - .05, () => {
      fx.line(at(0, 0), spikeTop, '#fff8ea', { count: 70, life: CONTACT - FREEZE + .1, size: 2.4 });
      fx.burst('flare', { at: spikeTop, count: 1, spread: .02, life: [.14, .22], colour: C.gold, light: { intensity: 2.6, range: 3, colour: C.gold } });
      fx.burst(chalk, { at: at(0, 0), to: spikeTop, shape: 'line', count: 24, speed: .2, life: [.7, 1.2], colour: C.gold });
      // «P = 1», a hand's width to the right of its top.
      const h = .2, o = add(add(spikeTop, right, .22), up, -.12);
      const q = (x: number, y: number) => add(add(o, right, x * h), up, y * h);
      fx.line(q(0, -.5), q(0, .5), C.gold, { count: 12, life: CONTACT - FREEZE + .05, size: 1.6 });
      for (let i = 0; i < 4; i++) {
        const a0 = Math.PI / 2 - i / 4 * Math.PI, a1 = Math.PI / 2 - (i + 1) / 4 * Math.PI;
        fx.line(q(Math.cos(a0) * .32, .25 + Math.sin(a0) * .25), q(Math.cos(a1) * .32, .25 + Math.sin(a1) * .25), C.gold, { count: 5, life: CONTACT - FREEZE + .05, size: 1.6 });
      }
      fx.line(q(.6, .1), q(1, .1), C.chalk, { count: 6, life: CONTACT - FREEZE + .05, size: 1.5 });
      fx.line(q(.6, -.12), q(1, -.12), C.chalk, { count: 6, life: CONTACT - FREEZE + .05, size: 1.5 });
      fx.digit(q(1.45, 0), 1, h, C.gold, stage.view, CONTACT - FREEZE + .05);
    });

    // ── Dadista: a die of cold light for each ally, thrown up tumbling, frozen all at once. ──
    const from = dice?.hand ?? dice?.chest ?? add(mid, UP, .3);
    const S = .14;
    const corners = CORNERS, edges = EDGES;
    const cube = (c: V3, axes: ReturnType<typeof turned>, colour: string, life: number, only?: (a: readonly number[], b: readonly number[]) => boolean) => {
      const v = (p: readonly number[]) => add(add(add(c, axes.ex, p[0] * S), axes.ey, p[1] * S), axes.ez, p[2] * S);
      for (const [i, j] of edges) if (!only || only(corners[i], corners[j])) fx.line(v(corners[i]), v(corners[j]), colour, { count: 6, life, size: 1.5, kind: edge });
    };
    // Frozen, every die turned the same way: the star face square to the camera, tipped a little so it reads as a cube.
    const still = turned(POSE.ax, POSE.ay, 0, right, up, facing);
    party.slice(0, 4).forEach((f, i) => {
      const hover = sideOf(f, right, facing);
      const apex = add(mix(from, hover, .5), UP, .9 + i * .15);
      const path = (u: number): V3 => mix(mix(from, apex, u), mix(apex, hover, u), u);
      const spin = [7 + i * 2.3, -9 + i * 1.7, 5.5 - i * 2.1];
      const t0 = .04 + i * .025, steps = Math.round((FREEZE - t0) / .06);
      for (let k = 0; k < steps; k++) {
        const t = t0 + k * .06, u = 1 - (1 - (t - t0) / (FREEZE - t0)) ** 1.8;
        fx.after(t + i * .011, () => {
          const c = path(u);
          cube(c, turned(spin[0] * t, spin[1] * t, spin[2] * t, right, up, facing), C.ice, .085);
          fx.burst('starfall', { at: c, count: 2, spread: .05, speed: .4, life: [.3, .6], colour: k % 2 ? C.ice : C.core });
        });
      }
      // Stopped dead: the cube in its one pose, the Comodín's star on its face in gold, a flash.
      const held = CONTACT - DROP - FREEZE + .04;
      fx.after(FREEZE, () => {
        const face = add(hover, still.ez, S * 1.01), k = S * 2 * .86 / 100;
        for (const stroke of FACE_STROKES.comodin) for (let s = 1; s < stroke.length; s++) {
          const p = (q: readonly [number, number]) => add(add(face, still.ex, (q[0] - 50) * k), still.ey, (50 - q[1]) * k);
          fx.line(p(stroke[s - 1]), p(stroke[s]), C.gold, { count: 6, life: held, size: 2 });
        }
        // The face first, then the rest of the cube on the next frames (a frame takes so many bursts).
        cube(hover, still, C.core, held, (a, b) => a[2] > 0 && b[2] > 0);
        fx.burst('flare', { at: hover, count: 1, spread: .02, life: [.1, .16], colour: C.ice, ...i ? {} : { light: { intensity: 2.4, range: 3, colour: C.ice } } });
      });
      fx.after(FREEZE + .02, () => cube(hover, still, C.ice, held - .02, (a, b) => !(a[2] > 0 && b[2] > 0)));
      // It drops into them, ice turning gold.
      fx.after(CONTACT - DROP, () => {
        stage.effects.trails.comet(hover, f.chest, [C.core, C.gold], DROP, { arc: 0, width: .09, life: .3, intensity: 3.2, core: .6 });
        fx.burst('starfall', { at: hover, count: 14, spread: .08, speed: 1.4, life: [.4, .8], colour: C.ice });
      });
    });

    stage.cue('think');
    [.2, .32, .44, .56].forEach(d => stage.cue('glass-tick', { delay: d }));
    stage.cue('clink', { delay: FREEZE });
  },
  land(stage, _e, reached) {
    const fx = stage.fx;
    const party = reached.length ? reached : stage.party();
    const { right, up, facing } = screenAxes(stage.view);
    for (const f of party) mark(stage, f, right, up, facing);
    if (fx.on && party.length) {
      // The spike runs down into the floor under them, and a ring of ice goes out from it.
      const mid = party.reduce((s, f) => add(s, f.feet, 1 / party.length), { x: 0, y: 0, z: 0 });
      const floor = { ...mid, y: stage.ground(mid.x, mid.z) + .05 };
      fx.line(add(floor, UP, 3.2), floor, '#fff8ea', { count: 80, life: .22, size: 2.2 });
      fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.45, .6], colour: C.ice, size: 1.2 });
      fx.ring(floor, UP, .5, C.gold, { count: 110, outward: 3.4, life: .5, size: 1.5 });
    }
    stage.shake(.22); stage.pulse(.35, .75, .18); stage.punch(.35);
    stage.cue('crit');
  },
  hold(stage, dt, state, playing) {
    hold(stage, dt, state, playing);
  },
};

/** The certainty settles on `f`: a long cut of gold up them crossed by one of ice, a ring closing on it, a «1» over their head, gold rising. */
function mark(stage: DuoStage, f: DuoFighter, right: V3, up: V3, facing: V3) {
  const fx = stage.fx;
  stage.hit(f.id, [1, .86, .5], .7);
  if (!fx.on) return;
  const c = add(f.chest, facing, .35), h = Math.max(.45, f.height * .34), w = h * .55;
  fx.line(add(c, up, -h), add(c, up, h), C.gold, { count: 44, life: .45, size: 2.2 });
  fx.line(add(c, right, -w), add(c, right, w), C.ice, { count: 26, life: .4, size: 1.9 });
  fx.line(add(add(c, right, -w * .3), up, -w * .3), add(add(c, right, w * .3), up, w * .3), C.core, { count: 10, life: .3, size: 1.4 });
  fx.line(add(add(c, right, -w * .3), up, w * .3), add(add(c, right, w * .3), up, -w * .3), C.core, { count: 10, life: .3, size: 1.4 });
  fx.ring(c, facing, h * .9, C.ice, { count: 70, outward: -2.4, life: .3, size: 1.4 });
  fx.burst('flare', { at: c, count: 1, spread: .02, life: [.12, .2], colour: C.gold, light: { intensity: 2.4, range: 2.6, colour: C.gold } });
  fx.burst('rise', { at: { ...f.feet, y: f.feet.y + .1 }, count: 36, shape: 'ring', spread: Math.max(.3, f.radius * .8), velocity: { x: 0, y: 2.4, z: 0 }, speed: .3, cone: .15, life: [.5, .9], colour: C.gold });
  fx.after(.08, () => fx.digit(add({ ...f.feet, y: f.feet.y + f.height + .32 }, facing, .3), 1, .26, C.gold, stage.view, .55));
}

/** A small die over each ally while every blow of theirs is sure to be critical: still, turned as the dice froze, the star on its face. */
const SMALL = .075, POSE = { ax: -.38, ay: .42 };
let clock = 0, wasOn = false;
const due = new Map<string, number>();
function hold(stage: DuoStage, dt: number, state: BattleState, playing: Parameters<NonNullable<DuoStaging['hold']>>[3]) {
  const on = (state.certain ?? 0) >= state.round && state.phase !== 'won' && state.phase !== 'lost';
  clock += dt;
  if (!on || playing?.dual?.id === 'suceso-seguro' || !stage.fx.on) { if (!on) { wasOn = false; due.clear(); } return; }
  const fx = stage.fx, { right, up, facing } = screenAxes(stage.view), axes = turned(POSE.ax, POSE.ay, 0, right, up, facing), edge = kind(stage, 'suceso-seguro-edge', EDGE, 'glyph');
  // Each ally's on a beat of its own, so no two are drawn on the same frame.
  if (!wasOn) { wasOn = true; state.allies.forEach((a, i) => due.set(a.id, i * .09)); }
  state.allies.forEach((a, i) => {
    if (a.hp <= 0) return;
    const left = (due.get(a.id) ?? i * .09) - dt;
    if (left > 0) { due.set(a.id, left); return; }
    due.set(a.id, .34);
    const f = stage.fighter(a.id);
    if (!f) return;
    const c = add(sideOf(f, right, facing), UP, Math.sin(clock * 1.4 + i) * .025);
    const v = (p: readonly number[]) => add(add(add(c, axes.ex, p[0] * SMALL), axes.ey, p[1] * SMALL), axes.ez, p[2] * SMALL);
    for (const [j, k] of EDGES) fx.line(v(CORNERS[j]), v(CORNERS[k]), C.ice, { count: 4, life: .4, size: 1.1, kind: edge });
    const face = add(c, axes.ez, SMALL * 1.01), u = SMALL * 2 * .8 / 100;
    for (const stroke of FACE_STROKES.comodin) for (let s = 1; s < stroke.length; s++) {
      const p = (q: readonly [number, number]) => add(add(face, axes.ex, (q[0] - 50) * u), axes.ey, (50 - q[1]) * u);
      fx.line(p(stroke[s - 1]), p(stroke[s]), C.gold, { count: 3, life: .4, size: 1.5 });
    }
  });
}
