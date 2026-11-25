import type { BattleState, Circuit } from '../battle';
import { ORBIT, screenAxes, type V3 } from '../dual-fx';
import type { GpuKind, GpuLattice } from '../fight-particles';
import { FIGURE_LOOKS, neonCircle, neonCurve } from '../math-figures';
import { stringSound } from '../sfx';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Corriente alterna (Cortocircuito + Crescendo): Cortocircuito's blow, then a circuit between two foes
 * that strikes one of them every 5 s, in turn and harder each time (`runCircuits`, src/battle.ts).
 *
 * - **Start**: Gerard's dial opens in yellow and a resistor is drawn in it; a comet of nácar from
 *   Sincopante's wearer writes a crescendo hairpin (<) over the two poles. A string of light draws tight between the two poles, from
 *   its middle out to each chest (three `string` lattices of 400 members: a yellow core in a gold neon body, a faint nácar rim),
 *   while the resistor flies to the target.
 * - **Contact**: the resistor lies across the target's chest and snaps, as Cortocircuito's always does:
 *   a flash, sparks and arcs over the foe, and the blow plucks the string.
 * - **Hold** (`alterna`, while the circuit runs): the string trembles between the poles, more each
 *   beat. A little before each beat it is plucked at the far end and a d'Alembert pulse runs towards
 *   the pole the beat is for, so what comes is read on the string; it flips over at that end, and the
 *   beat (`pulsed`) is a bolt from above onto that foe, brighter each time, its string a tone higher.
 * - **Last beat**: the string snaps in the middle and each half whips back onto its own pole, coming apart in motes as it goes.
 *
 * Matemágico's yellow and gold, Sincopante's nácar and seafoam; never violet nor pink (docs/visual-style.md).
 */
const C = { bolt: '#ffe45c', hot: '#fff6c8', gold: '#f3cf78', body: '#e3a43a', amber: '#eb9a26', core: '#fff09a', nacar: ORBIT.nacar, foam: ORBIT.foam } as const;
const BOLT_FLASH = [1, .94, .55] as const;
const timing = { contact: .9, end: 2.4 };
/** When the dial is drawn, when the resistor is (it flies from then to the contact), and when the string draws tight (fight seconds from the start). */
const T = { dial: .26, resistor: .14, grow: [.22, .72] as const };
/** How long before a beat the string is plucked: the pulse runs the string's length in that time. */
const LEAD = .8;
const NACRE_LOOK = { core: '#ffffff', halo: ORBIT.foam };

const KINDS = {
  // The string's members: the fight's `thread`, deaf to the air, so a burning pole's updraft does not curl its end away. Its
  // hot core, its gold body (a neon tube's glass, brighter) and a faint wide rim of nácar round both.
  'alterna-thread': {
    drag: .2, gravity: 0, curl: 0, response: 0, size: [.011, .008], shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.7, 1.4, .6], middle: .5, fadeIn: .08, fadeOut: .35, additive: 1, flicker: .1,
  },
  'alterna-tube': {
    drag: .2, gravity: 0, curl: 0, response: 0, size: [.011, .009], shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.5, 1.25, .5], middle: .5, fadeIn: .08, fadeOut: .35, additive: 1, flicker: .08,
  },
  'alterna-rim': {
    drag: .2, gravity: 0, curl: 0, response: 0, size: [.012, .01], shape: 'strand', blur: [.4, .9],
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [.35, .28, .1], middle: .5, fadeIn: .1, fadeOut: .4, additive: 1, flicker: .05,
  },
  // The bolt of a beat: crisp white-hot dots along its way, gone in a blink, and the glow round them.
  'alterna-bolt': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.034, .016], sizeJitter: .3,
    colours: ['#ffffff', '#fff3a0', '#ffd23a'], intensity: [9, 5.5, 2.4], middle: .25, fadeIn: 0, fadeOut: .5, additive: 1, flicker: .35, core: .85,
  },
  'alterna-halo': {
    shape: 'dot', blur: [.3, .8], drag: 14, gravity: 0, size: [.09, .05], sizeJitter: .3,
    colours: ['#fff6c8', '#ffe45c', '#f3cf78'], intensity: [3.2, 2, .7], middle: .3, fadeIn: 0, fadeOut: .6, additive: 1, core: .2,
  },
} satisfies Record<string, GpuKind>;
const FALLBACK: Record<string, string> = { 'alterna-thread': 'thread', 'alterna-tube': 'thread', 'alterna-rim': 'thread', 'alterna-bolt': 'glyph', 'alterna-halo': 'glyph' };
function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) try { g.define(name, kind); } catch { /* falls back (`kindOf`) */ }
}
const kindOf = (stage: DuoStage, name: string) => stage.effects.gpu?.get(name) ? name : FALLBACK[name] ?? name;

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const dist = (a: V3, b: V3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const UP: V3 = { x: 0, y: 1, z: 0 };
const xy = (x: number, y: number): V3 => ({ x, y, z: 0 });
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };

/** A jagged way from `a` to `b` (midpoint displacement, `depth` times), its kinks off the line by up to `rough` of each piece, sideways along `side`. */
function jag(a: V3, b: V3, rough: number, depth: number, side: V3): V3[] {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next: V3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], off = dist(p, q) * rough * rand(-1, 1);
      next.push(add(mix(p, q, .5), side, off), q);
    }
    pts = next;
  }
  return pts;
}
/** Draws a way as dots of `kind`, all at once. */
function trace(stage: DuoStage, pts: readonly V3[], kind: string, colour: string, o: { density: number; life: number; size?: number }) {
  for (let i = 1; i < pts.length; i++) stage.fx.burst(kindOf(stage, kind), { at: pts[i - 1], to: pts[i], shape: 'line', count: Math.max(2, Math.round(dist(pts[i - 1], pts[i]) * o.density)), life: [o.life * .75, o.life], colour, size: o.size ?? 1 });
}

// ── The string between the poles ──
/** A string of light between a circuit's poles: its three lattices (yellow core, gold body, nácar rim), the pulses plucked so far and where its ends were last. */
interface Wire {
  key: string; poles: [string, string]; alone: boolean;
  body: GpuLattice; core: GpuLattice; rim: GpuLattice;
  /** Fight seconds (this module's clock) it was made, and when it draws tight. */
  born: number; grow: readonly [number, number];
  /** Beats plucked for (the next pluck is for beat `plucked`), and the circuit's beats as last seen. */
  plucked: number; beat: number;
  ends: [V3, V3];
  snapped?: number; seen: number;
}
const wires = new Map<string, Wire>();
let clock = 0, startedAt = -99;
const keyOf = (poles: readonly [string, string]) => `${poles[0]}|${poles[1]}`;

/** Where a pole holds the string: its chest, a little to the camera's side so its body does not hide it; on the floor once it has fallen. */
function anchor(stage: DuoStage, f: DuoFighter | undefined, fallback: V3): V3 {
  if (!f) return fallback;
  const { facing } = screenAxes(stage.view), flat = Math.hypot(facing.x, facing.z) || 1, toward = { x: facing.x / flat, y: 0, z: facing.z / flat };
  if (f.hp <= 0) return add({ ...f.feet, y: f.feet.y + .06 }, toward, f.radius * .3);
  return add(add(f.chest, UP, .12), toward, f.radius * .3 + .05);
}
/** The string's two ends now: from the first pole to the second; a foe alone holds it upright beside it, from its knee to over its head. */
function endsOf(stage: DuoStage, w: Pick<Wire, 'poles' | 'alone' | 'ends'>): [V3, V3] {
  const a = stage.fighter(w.poles[0]), b = stage.fighter(w.poles[1]);
  if (w.alone && a) {
    const { right } = screenAxes(stage.view), side = add(anchor(stage, a, w.ends[0]), right, a.radius + .35);
    return [{ ...side, y: a.feet.y + a.height * .3 }, { ...side, y: a.feet.y + a.height + .55 }];
  }
  return [anchor(stage, a, w.ends[0]), anchor(stage, b, w.ends[1])];
}
/** A string spun between `ends`, plucked by nothing yet. */
function spin(stage: DuoStage, poles: [string, string], growFrom: number): Wire | undefined {
  const g = stage.effects.gpu;
  if (!g) return;
  const alone = poles[0] === poles[1], placeholder = stage.fighter(poles[1])?.chest ?? { x: 0, y: 0, z: 0 };
  const ends = endsOf(stage, { poles, alone, ends: [placeholder, placeholder] }), mid = mix(ends[0], ends[1], .5);
  const make = (kind: string, colour: string, scale: number, glow: number) => g.lattice(kind, {
    grid: [400, 1, 1], size: { x: .01, y: 0, z: 0 }, shape: 'string', life: 1.4, hold: .35, colour, scale,
    rigidity: 600, bonds: 200, damping: 12, viscosity: 2, glow, rim: 1.2, breakInto: 'spark',
    wave: { height: .004, length: .35, speed: 2.4 }, between: [mix(mid, ends[0], .02), mix(mid, ends[1], .02)],
  });
  try {
    ensure(stage);
    const body = make(kindOf(stage, 'alterna-tube'), C.amber, 5.2, .3), core = make(kindOf(stage, 'alterna-thread'), C.core, .75, .15), rim = make(kindOf(stage, 'alterna-rim'), C.foam, 6.5, 0);
    const w: Wire = { key: keyOf(poles), poles, alone, body, core, rim, born: clock, grow: [growFrom, growFrom + (T.grow[1] - T.grow[0])], plucked: 0, beat: 0, ends, seen: clock };
    wires.set(w.key, w);
    return w;
  } catch { return undefined; }
}
/** Each frame: the string on its poles' chests (from its middle out while it draws tight), trembling more each beat. */
function stretch(stage: DuoStage, w: Wire) {
  const ends = endsOf(stage, w);
  w.ends = ends;
  if (w.snapped !== undefined) { for (const s of strands(w)) s.span(ends[0], ends[1]); return; }
  const open = smooth((clock - w.born - w.grow[0]) / (w.grow[1] - w.grow[0])), mid = mix(ends[0], ends[1], .5);
  const a = mix(mid, ends[0], Math.max(.01, open)), b = mix(mid, ends[1], Math.max(.01, open));
  const tremble = .004 + .008 * clamp01(w.beat / 4);
  for (const s of strands(w)) { s.span(a, b); s.wave.height = tremble; s.wave.speed = 2.4 + w.beat * .5; }
}
/** The pulse for beat `k` (from 0), plucked at the far end, to reach the end of the pole it goes to in `seconds`. */
function pluck(stage: DuoStage, w: Wire, k: number, toward: 1 | -1, seconds: number) {
  const L = dist(w.ends[0], w.ends[1]), from = -toward * .9, metres = Math.abs(toward - from) * L / 2;
  const speed = Math.max(1.2, metres / Math.max(.2, seconds)), height = .12 + .04 * Math.min(k, 3), shine = 2 + .6 * Math.min(k, 3);
  const there = toward > 0 ? w.ends[1] : w.ends[0], origin = mix(w.ends[0], w.ends[1], (from + 1) / 2);
  w.body.travel({ toward, from, height, speed, width: .24 + .03 * k, decay: 2.2, shine, onReflect: (_end, n) => {
    if (n > 0) return;
    // It flips over at that end: a flash of yellow there, the beat a breath after.
    stage.fx.burst('bloom', { at: there, count: 1, spread: .02, life: [.12, .18], colour: C.bolt, size: .5 + .1 * k, light: { intensity: 2 + k, range: 3, colour: C.bolt } });
    stage.fx.burst('spark', { at: there, count: 26 + 10 * k, spread: .05, speed: 2.4 + k * .6, life: [.2, .45], colour: C.hot });
  } });
  w.core.travel({ toward, from, height, speed, width: .2 + .03 * k, decay: 2.2, shine: shine + .8 });
  w.rim.travel({ toward, from, height, speed, width: .3 + .03 * k, decay: 2.2, shine: shine * .6 });
  // Where it is plucked: a spark of gold and a ring of nácar, Sincopante's beat.
  stage.fx.burst('spark', { at: origin, count: 14 + 6 * k, spread: .04, speed: 1.6, life: [.15, .3], colour: C.gold });
  stage.fx.ring(origin, sub(w.ends[1], w.ends[0]), .08 + .02 * k, C.nacar, { count: 28, outward: 1.4, life: .35, size: 1.1 });
  stage.cue(stringSound(k + 1), { volume: .55 + .1 * Math.min(k, 3), pan: stage.pan(origin) });
}
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** A string's three lattices. */
const strands = (w: Wire) => [w.body, w.core, w.rim];
/** The string snaps in its middle: each half recoils onto its own pole and comes apart in motes. */
function snap(stage: DuoStage, w: Wire) {
  if (w.snapped !== undefined) return;
  w.snapped = clock;
  // Its glow goes at once (bunched on a pole it would pile up into a knot of light); the halves whip back slowly enough to be seen.
  for (const s of strands(w)) { s.snap({ at: 0, seconds: .9, whip: .34 }); s.glow = 0; }
  const mid = mix(w.ends[0], w.ends[1], .5);
  stage.fx.burst('bloom', { at: mid, count: 1, spread: .02, life: [.16, .24], colour: C.hot, size: .7, light: { intensity: 3, range: 3.5, colour: C.bolt } });
  stage.fx.burst('spark', { at: mid, count: 60, spread: .05, speed: 3.4, up: .8, life: [.25, .55], colour: C.hot });
  stage.fx.burst('nacre', { at: mid, count: 24, spread: .1, speed: .5, life: [.6, 1.1] });
  stage.cue('crack', { volume: .6, pan: stage.pan(mid) });
}

// ── Gerard's dial, the resistor and Sincopante's crescendo ──
function dial(stage: DuoStage, at: V3) {
  const axes = screenAxes(stage.view), fig = stage.figure('Dial', { look: FIGURE_LOOKS.bolt, frame: { at, ...axes } });
  const ring = fig.stroke(neonCircle(.3, 48), { radius: .016 });
  const inner = fig.stroke(neonCircle(.2, 36), { radius: .008, look: FIGURE_LOOKS.gold });
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, r0 = i % 3 ? .25 : .22; return fig.stroke([xy(Math.cos(a) * r0, Math.sin(a) * r0), xy(Math.cos(a) * .29, Math.sin(a) * .29)], { radius: .008 }); });
  stage.draw(fig, [ring], T.dial * .6);
  stage.draw(fig, [inner, ...ticks], T.dial * .5, { delay: T.dial * .45, pen: false, done: () => fig.glow(1.3, .6) });
  fig.animate(timing.contact, t => fig.place({ at, ...axes, scale: .85 + .25 * smooth(t / T.dial) }));
  fig.fade(.45, timing.contact - .1);
}
/** Cortocircuito's resistor: drawn in the dial, it flies to `to` and lies across its chest, and snaps in two at the contact. */
function resistor(stage: DuoStage, from: V3, to: V3, shorts: boolean) {
  const axes = screenAxes(stage.view), w = .4, amp = .085;
  const zig = (a: number, b: number) => { const pts: V3[] = []; for (let k = a; k <= b; k++) pts.push(xy(-w / 2 + k / 8 * w, k === 0 || k === 8 ? 0 : (k % 2 ? amp : -amp))); return pts; };
  const halves = [-1, 1].map(side => {
    const fig = stage.figure(side < 0 ? 'Resistencia, mitad izquierda' : 'Resistencia, mitad derecha', { look: FIGURE_LOOKS.bolt, frame: { at: from, ...axes } });
    const pts = side < 0 ? [xy(-w, 0), ...zig(0, 4)] : [...zig(4, 8), xy(w, 0)];
    return { fig, side, stroke: fig.stroke(pts, { radius: .022 }) };
  });
  const start = T.resistor, land = timing.contact, gone = land + .35;
  for (const h of halves) stage.draw(h.fig, [h.stroke], .16, { delay: start - .14, pen: h.side < 0 });
  const end = add(to, axes.facing, .25);
  for (const h of halves) h.fig.animate(gone, t => {
    const k = smooth((t - start - .1) / (land - start - .1 - .05)), snapK = clamp01((t - land) / .2);
    const at = add(mix(from, end, k), UP, Math.sin(k * Math.PI) * .45);
    // Snapped: each half turns away about its outer end and drops a little.
    const turn = -h.side * .7 * snapK, c = Math.cos(turn), s = Math.sin(turn), right = axes.right, up = axes.up;
    const r = { x: right.x * c + up.x * s, y: right.y * c + up.y * s, z: right.z * c + up.z * s };
    const u = { x: up.x * c - right.x * s, y: up.y * c - right.y * s, z: up.z * c - right.z * s };
    h.fig.place({ at: add(add(at, axes.right, h.side * snapK * .2), UP, -snapK * snapK * .12), right: r, up: u, scale: 1 + .4 * k });
    h.fig.glow(1 - clamp01((t - land) / .35), t > land && t < land + .07 ? 1 : 0);
  }, () => h.fig.destroy());
  stage.fx.after(land, () => {
    stage.fx.burst('bloom', { at: end, count: 1, spread: .03, life: [.14, .22], colour: C.hot, size: 1, light: { intensity: 6, range: 5, colour: C.bolt } });
    stage.fx.burst('spark', { at: end, count: 90, spread: .05, speed: 4.4, up: 1.4, life: [.25, .6], colour: C.hot });
    stage.fx.burst('bipzap', { at: end, count: 40, spread: .06, speed: 3, life: [.2, .45], colour: C.bolt });
    const arcs = shorts ? 14 : 5;
    for (let i = 0; i < arcs; i++) stage.fx.after(i * .04, () => {
      const a = Math.random() * Math.PI * 2, on = add(to, { x: Math.cos(a) * .45, y: rand(-.45, .55), z: Math.sin(a) * .45 });
      stage.fx.burst('arc', { at: i < 3 ? end : to, to: on, shape: 'line', count: 18, chain: 9, speed: .5, life: [.07, .14], colour: C.hot });
    });
  });
}
/** Sincopante's half: a crescendo hairpin drawn in nácar over the circuit it marks, that opens wider as it glows. */
function crescendo(stage: DuoStage, over: V3) {
  const axes = screenAxes(stage.view), fig = stage.figure('Crescendo', { look: NACRE_LOOK, frame: { at: over, ...axes } });
  const hairpin = [-1, 1].map(s => fig.stroke(neonCurve(14, u => xy(-.3 + .6 * u, s * .14 * u)), { radius: .016 }));
  stage.draw(fig, hairpin, .3, { delay: .28, colour: '#ffffff' });
  fig.animate(timing.contact, t => fig.place({ at: add(over, UP, .12 * smooth(t / .8)), ...axes, scale: 1.3 + .45 * smooth((t - .55) / .4) }));
  stage.fx.after(.6, () => { fig.glow(1.4, .8); stage.fx.burst('nacre', { at: over, count: 30, spread: .25, speed: .4, life: [.6, 1.1] }); });
  fig.fade(.5, timing.contact - .15);
}

// ── The beats ──
/** A beat on `target`: a bolt from above, brighter with each beat (`k` from 1), where the pulse has just flipped over. */
function beat(stage: DuoStage, target: DuoFighter, k: number) {
  ensure(stage);
  const { right, facing } = screenAxes(stage.view), strength = 1 + .35 * (Math.min(k, 4) - 1);
  const chest = target.chest, top = add(add(chest, UP, 2.4 + .3 * k), right, rand(-.5, .5));
  const way = jag(top, add(chest, facing, .1), .2, 4, right);
  trace(stage, way, 'alterna-halo', C.gold, { density: 26, life: .3 + .05 * k, size: 1 + .2 * k });
  trace(stage, way, 'alterna-bolt', C.hot, { density: 70, life: .22 + .04 * k, size: .9 + .15 * k });
  for (let f = 0; f < 1 + k; f++) {
    const from = way[2 + Math.floor(Math.random() * (way.length - 5))], out = add(add(from, right, rand(-.7, .7)), UP, -rand(.3, .8));
    trace(stage, jag(from, out, .3, 2, right), 'alterna-bolt', C.bolt, { density: 50, life: .14, size: .7 });
  }
  stage.fx.burst('arc', { at: top, to: chest, shape: 'line', count: 3 * 16, chain: 16, speed: .6, life: [.08, .16], colour: C.hot });
  stage.fx.burst('bloom', { at: chest, count: 1, spread: .05, life: [.14, .22], colour: C.hot, size: .8 + .2 * k, light: { intensity: 4 * strength, range: 5 + k, colour: C.bolt } });
  stage.fx.burst('spark', { at: chest, count: Math.round(50 * strength), spread: .1, speed: 3 + k * .5, up: 1, life: [.25, .55], colour: C.hot });
  // Under where it is now (a foe on the move is not over its home).
  const floor = { x: chest.x, y: stage.ground(chest.x, chest.z) + .04, z: chest.z };
  stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.4, .5], colour: C.bolt, size: .45 + target.radius * .4 + .1 * k });
  stage.fx.after(.07, () => stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.4, .5], colour: C.nacar, size: .35 + target.radius * .4 + .1 * k }));
  for (let i = 0; i < 3 + k; i++) stage.fx.after(.03 + i * .04, () => {
    const a = Math.random() * Math.PI * 2, r = Math.max(.3, target.radius);
    stage.fx.burst('arc', { at: chest, to: add(chest, { x: Math.cos(a) * r, y: rand(-.5, .4), z: Math.sin(a) * r }), shape: 'line', count: 16, chain: 8, speed: .4, life: [.06, .12], colour: C.bolt });
  });
  stage.hit(target.id, BOLT_FLASH, .7 + .15 * k);
  stage.shake(.12 + .07 * k); stage.pulse(.15 + .08 * k, .25 + .1 * k, .04 * k);
  stage.cue('zap', { volume: .5 + .1 * k, pan: stage.pan(chest) }); stage.cue('crack', { delay: .03, volume: .3 + .1 * k, pan: stage.pan(chest) });
}

/** Which end of the string a beat goes to: the second pole's (1) or the first's (−1); a foe alone takes them all at the top. */
function endFor(state: BattleState, c: Circuit): 1 | -1 {
  if (c.poles[0] === c.poles[1]) return 1;
  const standing = (id: string) => (state.foes.find(f => f.id === id)?.hp ?? 0) > 0;
  const aimed = c.beat % 2, to = standing(c.poles[aimed]) ? aimed : 1 - aimed;
  return to === 0 ? -1 : 1;
}

export const staging: DuoStaging = {
  timing,
  start(stage, e) {
    ensure(stage);
    startedAt = clock;
    const target = e.target ? stage.fighter(e.target) : undefined;
    if (!target) return;
    const math = stage.wearer('matemagico'), sinc = stage.wearer('sincopante'), axes = screenAxes(stage.view);
    // Gerard's dial, a hand in front of him; the resistor drawn in it.
    // His dial stands a step out from him towards the target and over his head, clear of the party.
    const centre = math ? add(add(mix(math.chest, target.chest, .42), UP, .95), axes.facing, .3) : add(target.chest, UP, 1.2);
    dial(stage, centre);
    resistor(stage, centre, target.chest, !!e.shorted && e.shorted.why !== 'again');
    // Sincopante's crescendo over its wearer.
    // Sincopante's crescendo, written over the circuit it marks: above the poles' heads, between them, a comet of nácar from its wearer to it.
    const poleFighters = (e.circuit ?? [target.id]).map(id => stage.fighter(id)).filter((f): f is DuoFighter => !!f), over = poleFighters.length ? poleFighters : [target];
    const marking = add(add(over.reduce((s, f) => add(s, f.chest, 1 / over.length), { x: 0, y: 0, z: 0 }), UP, Math.max(...over.map(f => f.height)) * .6 + .55), axes.facing, .3);
    if (sinc) stage.effects.trails.comet(sinc.chest, marking, ['#ffffff', C.foam], .3, { arc: .35, width: .05, life: .35, intensity: 2.4, core: .5 });
    crescendo(stage, marking);
    // The string draws tight between the poles, from its middle out, a thread of gold from the dial to it first.
    const poles = (e.circuit ?? [target.id, target.id]) as [string, string];
    const old = wires.get(keyOf(poles));
    if (old) { for (const s of strands(old)) s.remove(); wires.delete(old.key); }
    const w = spin(stage, poles, T.grow[0]);
    if (w) {
      const mid = mix(w.ends[0], w.ends[1], .5);
      stage.effects.trails.comet(centre, mid, ['#fff6c8', C.gold], T.grow[0], { arc: .25, width: .05, life: .3, intensity: 2.6, core: .5 });
      stage.fx.after(T.grow[0], () => {
        stage.fx.burst('bloom', { at: mid, count: 1, spread: .02, life: [.12, .18], colour: C.gold, size: .5, light: { intensity: 2, range: 3, colour: C.gold } });
        stage.cue(stringSound(1), { volume: .4, pan: stage.pan(mid) });
      });
      // The blow plucks it from the target's end: a small pulse towards the other pole, which is where the first beat goes.
      stage.fx.after(timing.contact + .02, () => {
        if (w.snapped !== undefined) return;
        const toward = (w.alone ? 1 : -1) as 1 | -1;
        for (const s of strands(w)) s.travel({ toward, from: -toward * .85, height: .05, speed: 3.2, width: .16, decay: .9, shine: 1.8 });
      });
    }
    stage.cue('charge', { delay: .1, volume: .6 });
  },
  land(stage, e) {
    const target = e.target ? stage.fighter(e.target) : undefined;
    if (target) stage.hit(target.id, BOLT_FLASH, e.shorted && e.shorted.why !== 'again' ? 1.5 : 1.1);
    stage.shake(.4); stage.punch(.3); stage.pulse(.45, .4, .08);
  },
  hold(stage, dt, state) {
    clock += dt;
    const circuits = state.circuits ?? [], over = state.phase !== 'player' && state.phase !== 'enemy';
    // A circuit with no string (the dual went off unseen, or the fight was reloaded): spun at once.
    if (!over) for (const c of circuits) if (!wires.has(keyOf(c.poles)) && clock - startedAt > timing.contact) spin(stage, c.poles, -1);
    for (const w of [...wires.values()]) {
      if (!w.body.alive) { wires.delete(w.key); continue; }
      const c = circuits.find(x => keyOf(x.poles) === w.key);
      stretch(stage, w);
      if (w.snapped !== undefined) {
        const t = clock - w.snapped;
        // The halves come apart as they whip back, so the recoil is what is seen, never two knots of light on the poles.
        if (t > .05) for (const s of strands(w)) s.dissolve = smooth((t - .05) / .45);
        if (t > .7) { for (const s of strands(w)) s.remove(); wires.delete(w.key); }
        continue;
      }
      if (c) {
        w.seen = clock; w.beat = c.beat;
        // A little before its beat, the string is plucked at the far end towards the pole it goes to.
        if (w.plucked <= c.beat && c.next <= LEAD && c.left + 1e-6 >= c.next && clock - w.born > T.grow[1]) {
          w.plucked = c.beat + 1;
          pluck(stage, w, c.beat, endFor(state, c), c.next);
        }
        const poles = c.poles.map(id => state.foes.find(f => f.id === id));
        if (poles.every(p => !p || p.hp <= 0) || over) snap(stage, w);
      } else if (clock - w.seen > .3 && clock - w.born > timing.contact + .3) snap(stage, w);
    }
  },
  pulsed(stage, status, target) {
    if (status !== 'alterna') return;
    const w = [...wires.values()].find(x => x.poles.includes(target.id) && x.snapped === undefined);
    // The beat is the one the string has just been plucked for (its count was read before the clock moved on).
    beat(stage, target, Math.max(1, w ? w.plucked : 4));
    // The other pole's end lights a moment: the current came from there.
    if (w && !w.alone) {
      const from = w.poles[0] === target.id ? w.ends[1] : w.ends[0];
      stage.fx.burst('bloom', { at: from, count: 1, spread: .02, life: [.1, .16], colour: C.gold, size: .35 });
    }
  },
};
