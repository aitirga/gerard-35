import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { AGUA } from '../freatica-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Marea (Vasos comunicantes + Recarga), dúo mayor: every foe's water rises to the highest's and a
 * mark more, and for 20 s what rises in one rises in all.
 *
 * - **Start**: Gerard throws a chalk-gold stroke over the foes and draws the communicating vessels
 *   on the field itself: a tube of two gold uprights round each foe, one floor line under all of
 *   them and a pipe joining each tube to the next, and a gold `=` between each pair at the height
 *   the water will reach. Freática's water then comes up under every foe at once: teal beads well
 *   up and settle at one height, a surface rises in each tube from that foe's own level to the
 *   shared one (the driest rises most), and current runs along the pipe from the fullest foe out.
 * - **Land**: the surfaces meet as one tide line through every tube, white and teal; each foe is
 *   splashed, a gold `1` and a tick mark the new level (one mark more), the `=` signs flash and
 *   sift down as chalk, and the cells rise to it.
 * - **Hold** (`marea`): a faint tide line joins the water of every foe under Marea at its level,
 *   with a thread of current running along it; when water rises on one of them a bright pulse runs
 *   the whole line and a ring opens on each foe's surface.
 *
 * Matemágico's chalk-gold and Freática's teal; no pink, no violet (docs/visual-style.md).
 */

const C = { gold: '#f3cf78', chalk: '#fff1cc', deep: '#e0b45a', teal: '#27c2a0', foam: '#dffcf6', sea: '#5fd9c0', blue: '#2f7fd8' } as const;

// Few kinds of its own (the engine holds 128 in all): Gerard's chalk, the beads that come to rest at
// one height, and the drops. The rest is the fight's own, tinted (`glyph` for water lines, `gale` for
// current, `fleck` for chalk dust, `floorring`, `bloom`, `flare`).
const KINDS = {
  // Gerard's chalk: dots of gold light that stay where drawn, flickering a little, like chalk on a board.
  'marea-chalk': {
    shape: 'dot', drag: 14, gravity: .5, curl: .05, response: 0, size: [.016, .012], sizeJitter: .35,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.1, 1.7, 1.1], middle: .35, fadeIn: .04, fadeOut: .3, additive: .85, flicker: .1, core: .2,
  },
  // Water welling up: beads of teal glass sent up from the floor with drag, so they come to rest at one height.
  'marea-rise': {
    shape: 'dot', glass: .45, drag: 4, gravity: 0, curl: .22, response: .2, size: [.02, .03], sizeJitter: .5,
    colours: ['#f2fffb', '#7fe6c6', '#27c2a0'], intensity: [2.2, 1.7, 1.1], middle: .35, fadeIn: .06, fadeOut: .4, additive: .7, opacity: .95, core: .35,
  },
  // Drops thrown off as the surfaces meet.
  'marea-drop': {
    shape: 'dot', glass: .35, drag: .5, gravity: 9, collide: true, bounce: 0, friction: 1, size: [.022, .012], sizeJitter: .6,
    colours: ['#ffffff', '#c6f3ea', '#4fcfb4'], intensity: [1.8, 1.4, 1], fadeOut: .3, additive: .4, opacity: .9, core: .6,
  },
} satisfies Record<string, GpuKind>;
/** What each of its kinds falls back to if the engine has no room left for it. */
const FALLBACK: Record<keyof typeof KINDS, string> = { 'marea-chalk': 'glyph', 'marea-rise': 'glyph', 'marea-drop': 'fleck' };
const K: Record<string, string> = { ...Object.fromEntries(Object.keys(KINDS).map(k => [k, k])), line: 'glyph', flow: 'gale', dust: 'fleck', ring: 'floorring' };

function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) {
    if (g.get(name)) continue;
    try { g.define(name, kind); } catch { K[name] = FALLBACK[name as keyof typeof KINDS]; }
  }
}

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const dist = (a: V3, b: V3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

/** How high a foe's water stands over its feet with `marks` (its top mark `left` of the way full), as its cell draws it (src/freatica-fx.ts). */
export function mareaLevel(f: DuoFighter, marks: number, left = 1) {
  if (marks <= 0) return 0;
  const m = Math.min(3, Math.round(marks)), ticks = [AGUA.ticks[0], AGUA.ticks[1], Math.max(AGUA.ticks[2], f.height + .1)];
  return ticks[m - 1] + AGUA.bands[m - 1] * Math.max(0, Math.min(1, left));
}

const UP: V3 = { x: 0, y: 1, z: 0 };
const lift = (p: V3, h: number): V3 => ({ ...p, y: p.y + h });

/** A chalk line drawn from `a` to `b` over `seconds` from `start`, a stroke at a time, all gone at `until`. */
function chalk(stage: DuoStage, a: V3, b: V3, start: number, seconds: number, until: number, o: { colour?: string; size?: number } = {}) {
  const n = Math.max(2, Math.round(dist(a, b) / .25));
  for (let i = 0; i < n; i++) {
    const at = start + seconds * i / n;
    stage.fx.after(at, () => stage.fx.line(mix(a, b, i / n), mix(a, b, (i + 1) / n), o.colour ?? C.gold, { kind: K['marea-chalk'], life: Math.max(.2, until - at), size: o.size ?? 1 }));
  }
}
/** A level circle of chalk round `centre`, drawn round from the camera's side over `seconds`. */
function circle(stage: DuoStage, centre: V3, R: number, start: number, seconds: number, until: number, o: { colour?: string; size?: number; from?: number } = {}) {
  const n = 18, a0 = o.from ?? 0;
  const at = (k: number): V3 => ({ x: centre.x + Math.cos(a0 + k / n * Math.PI * 2) * R, y: centre.y, z: centre.z + Math.sin(a0 + k / n * Math.PI * 2) * R });
  for (let k = 0; k < n; k++) {
    const t = start + seconds * k / n;
    stage.fx.after(t, () => stage.fx.line(at(k), at(k + 1), o.colour ?? C.gold, { kind: K['marea-chalk'], life: Math.max(.2, until - t), size: o.size ?? 1 }));
  }
}

/** The vessel round a foe: a cylinder of `R` on its floor, its two outline walls left and right on the screen. */
function vessel(f: DuoFighter, right: V3) {
  const R = Math.max(.45, f.radius * .8 + .22);
  return { f, R, l: add(f.feet, right, -R), r: add(f.feet, right, R) };
}
type Vessel = ReturnType<typeof vessel>;
/** The pipe between two vessels, along the floor from the rim of one to the rim of the next (none when they touch). */
function pipe(a: Vessel, b: Vessel) {
  const dx = b.f.feet.x - a.f.feet.x, dz = b.f.feet.z - a.f.feet.z, d = Math.hypot(dx, dz) || 1, u = { x: dx / d, y: 0, z: dz / d };
  const p = add(a.f.feet, u, a.R), q = add(b.f.feet, u, -b.R);
  return { p, q, side: { x: -u.z, y: 0, z: u.x }, open: d > a.R + b.R + .1 };
}
/** The foes in order across the screen. */
function inRow<T>(list: T[], feet: (x: T) => V3, right: V3) {
  return list.sort((a, b) => (feet(a).x - feet(b).x) * right.x + (feet(a).z - feet(b).z) * right.z);
}

let clock = 0, startedAt = -99;
const timing = { contact: 1.05, end: 2.1 };

export const staging: DuoStaging = {
  timing,
  start(stage, e, reached) {
    ensure(stage);
    startedAt = clock;
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length) return;
    const { right, facing } = screenAxes(stage.view), T = timing.contact, fade = T + .5;
    inRow(foes, f => f.feet, right);
    // Each foe's water before and after: the shared level is the highest's and a mark more.
    const from = new Map<string, number>(), to = new Map<string, number>();
    for (const w of e.water ?? []) {
      from.set(w.target, Math.min(from.get(w.target) ?? 9, w.from));
      to.set(w.target, Math.max(to.get(w.target) ?? 0, w.to));
    }
    const top = Math.max(1, ...to.values(), ...foes.map(f => (from.get(f.id) ?? 0) + 1));
    const was = (f: DuoFighter) => mareaLevel(f, from.get(f.id) ?? (to.has(f.id) ? 0 : top)), end = (f: DuoFighter) => mareaLevel(f, top);
    const fullest = foes.reduce((best, f) => (from.get(f.id) ?? top) > (from.get(best.id) ?? top) ? f : best, foes[0]);
    const vessels = foes.map(f => ({ ...vessel(f, right), H: Math.max(end(f) + .32, .75) }));
    // Each circle starts on the camera's side, so it is seen being drawn.
    const near = Math.atan2(facing.z, facing.x);
    const gold = stage.wearer('matemagico'), water = stage.wearer('freatica');

    // Gerard's stroke: from his hand up over the middle of the foes, and the chalk shaken off it.
    const mid = mix(vessels[0].f.feet, vessels[vessels.length - 1].f.feet, .5), apex = lift(mid, Math.max(...vessels.map(v => v.H)) + .45);
    if (gold?.hand) stage.effects.trails.comet(gold.hand, apex, [C.chalk, C.gold], .26, { arc: .9, width: .06, life: .4, intensity: 2.6, core: .4 });
    stage.fx.after(.26, () => {
      stage.fx.burst(K.dust, { colour: C.gold, at: apex, count: 30, spread: .12, speed: 1.2, life: [.5, 1] });
      stage.fx.burst('flare', { at: apex, count: 1, spread: .02, life: [.12, .2], colour: C.gold, light: { intensity: 1.4, range: 3 } });
    });

    // The vessels, chalked on the field: a circle on the floor round each foe, its two walls up, its rim; a pipe from each to the next.
    vessels.forEach((v, i) => {
      const s = .28 + i * .07;
      circle(stage, lift(v.f.feet, .03), v.R, s, .2, fade, { from: near });
      chalk(stage, lift(v.l, .03), lift(v.l, v.H), s + .12, .16, fade);
      chalk(stage, lift(v.r, .03), lift(v.r, v.H), s + .14, .16, fade);
      circle(stage, lift(v.f.feet, v.H), v.R, s + .26, .16, fade, { from: near, size: .9 });
      const next = vessels[i + 1];
      if (!next) return;
      const { p, q, side, open } = pipe(v, next);
      if (open) for (const k of [-1, 1]) chalk(stage, add(lift(p, .04), side, k * .08), add(lift(q, .04), side, k * .08), .42 + i * .06, .14, fade, { size: .9 });
      // `=`: this water will stand where that one does.
      const eq = lift(mix(p, q, .5), (end(v.f) + end(next.f)) / 2), bar = .12, { up } = screenAxes(stage.view);
      stage.fx.after(.52 + i * .06, () => {
        for (const dy of [.04, -.04]) stage.fx.line(add(add(eq, up, dy), right, -bar), add(add(eq, up, dy), right, bar), C.chalk, { kind: K['marea-chalk'], life: T - .52 - i * .06 + .12, size: 1.5 });
      });
    });

    // Freática's water: it wells up under every foe at once, beads coming to rest at the one height they will share.
    const bubbles = !!stage.effects.gpu?.get('agua-burbuja');
    for (let k = 0; k < 4; k++) stage.fx.after(.42 + k * .1, () => {
      for (const v of vessels) {
        const h = end(v.f), floor = lift(v.f.feet, .05);
        stage.fx.burst(K['marea-rise'], { at: floor, count: 22, shape: 'ring', spread: v.R * .8, velocity: { x: 0, y: (h - .05) * 4, z: 0 }, speed: .05, life: [.9, 1.3] });
        if (bubbles) stage.fx.burst('agua-burbuja', { at: floor, count: 8, spread: v.R * .6, speed: .2, up: .8, life: [.3, .3 + h * .9] });
      }
    });
    // The surface in each vessel rises from that foe's own level to the shared one: the driest the most.
    const steps = 16, rise0 = .5;
    for (let i = 0; i <= steps; i++) stage.fx.after(rise0 + (T - rise0) * i / steps, () => {
      const k = ease(i / steps);
      for (const v of vessels) {
        const h = was(v.f) + (end(v.f) - was(v.f)) * k;
        const surface = lift(v.f.feet, Math.max(.04, h));
        stage.fx.ring(surface, UP, v.R * .97, C.teal, { kind: K.line, count: Math.round(v.R * 80), life: .09, size: 1.4 });
        stage.fx.ring(lift(surface, -.06), UP, v.R * .95, C.blue, { kind: K.line, count: Math.round(v.R * 50), life: .09, size: 1.1 });
      }
    });
    // Current along the pipes, from the fullest foe out to the others.
    if (foes.length > 1) for (let k = 0; k < 5; k++) stage.fx.after(.5 + k * .09, () => {
      for (const v of vessels) {
        if (v.f === fullest) continue;
        const a = lift(fullest.feet, .08), b = lift(v.f.feet, .08), life = .45;
        stage.fx.burst(K.flow, { colour: C.sea, at: a, count: 5, spread: .04, velocity: { x: (b.x - a.x) / life, y: 0, z: (b.z - a.z) / life }, speed: .1, life: [life * .9, life] });
      }
    });
    // Freática's own hand: a teal thread along the floor to the fullest, where the water is drawn from.
    if (water?.feet) stage.effects.trails.comet(lift(water.feet, .05), lift(fullest.feet, .08), ['#e8fff8', C.teal], .32, { arc: .05, width: .05, life: .45, intensity: 2.4, core: .5, delay: .36 });
  },
  land(stage, e, reached) {
    ensure(stage);
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length) return;
    const { right, up, facing } = screenAxes(stage.view);
    inRow(foes, f => f.feet, right);
    let top = 1;
    for (const w of e.water ?? []) top = Math.max(top, w.to);
    const vessels = foes.map(f => ({ ...vessel(f, right), h: mareaLevel(f, top) }));
    // One body: a surface at the one level in every vessel, joined along the pipes, white over teal.
    vessels.forEach((v, i) => {
      const surface = lift(v.f.feet, v.h);
      stage.fx.ring(surface, UP, v.R, C.foam, { kind: K.line, count: Math.round(v.R * 90), life: .85, size: 1.3 });
      stage.fx.ring(lift(surface, -.05), UP, v.R * .98, C.teal, { kind: K.line, count: Math.round(v.R * 70), life: .7, size: 1.1 });
      const next = vessels[i + 1];
      if (next) {
        const { p, q, side } = pipe(v, next), a = lift(p, v.h), b = lift(q, next.h), n = Math.round(dist(a, b) * 30);
        for (const k of [-1, 1]) stage.fx.line(add(a, side, k * .07), add(b, side, k * .07), C.foam, { kind: K.line, count: n, life: .8, size: 1.2 });
        // A wash of light runs along it.
        stage.fx.burst(K.flow, { colour: C.sea, at: a, count: Math.round(dist(a, b) * 10), spread: .05, velocity: { x: (b.x - a.x) / .35, y: (b.y - a.y) / .35, z: (b.z - a.z) / .35 }, speed: .2, life: [.3, .38] });
        // The `=` let go: its chalk sifts down into the water.
        const eq = lift(mix(p, q, .5), (v.h + next.h) / 2);
        stage.fx.burst('flare', { at: eq, count: 1, spread: .02, life: [.12, .2], colour: C.gold, light: { intensity: 1.2, range: 2 } });
        stage.fx.burst(K.dust, { colour: C.gold, at: eq, count: 24, spread: .12, speed: .7, life: [.6, 1.1] });
      }
      stage.fx.burst(K.ring, { colour: C.teal, at: surface, count: 1, spread: .01, life: [.5, .65], size: .5 + v.R * .45 });
      stage.fx.burst(K['marea-drop'], { at: surface, count: 40, shape: 'ring', spread: v.R * .9, outward: 1.4, up: 2.2, speed: .6, life: [.5, .9] });
      // One mark more: a gold tick on each wall at the new level, and his `1` over it.
      for (const s of [-1, 1]) stage.fx.line(add(surface, right, s * (v.R - .05)), add(surface, right, s * (v.R + .14)), C.gold, { kind: K['marea-chalk'], life: .9, size: 1.6 });
      stage.fx.after(.06, () => stage.fx.digit(add(add(surface, up, .24), facing, v.R * .5), 1, .2, C.gold, stage.view, .8));
      stage.hit(v.f.id, [.45, .95, .85], 1);
    });
    stage.shake(.45); stage.punch(.45); stage.pulse(.4, .8, .1);
    stage.cue('splash'); stage.cue('mark-set', { delay: .08 });
  },
  hold(stage, dt, state, playing) {
    clock += dt;
    holdMarea(stage, dt, state, playing);
  },
};

// ── The hold: Marea's joined water ──
const lastMarks = new Map<string, number>();
let nextDraw = 0, nextFlow = 0;

function holdMarea(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  const under = state.foes.filter(f => f.hp > 0 && f.timed?.marea);
  const seen = new Set(under.map(f => f.id));
  for (const id of [...lastMarks.keys()]) if (!seen.has(id)) lastMarks.delete(id);
  if (!under.length) { nextDraw = nextFlow = 0; return; }
  // Its own start still drawing.
  const own = playing?.dual?.id === 'marea' && clock - startedAt < timing.end;
  const { right } = screenAxes(stage.view);
  const joined = inRow(under.flatMap(u => { const f = stage.fighter(u.id); return f && f.hp > 0 ? [{ u, v: vessel(f, right) }] : []; }), x => x.v.f.feet, right);
  // Water rose on one of them, so on all.
  let rose = false;
  for (const x of joined) {
    const m = x.u.timed?.agua?.level ?? 0, before = lastMarks.get(x.u.id);
    if (before !== undefined && m > before) rose = true;
    lastMarks.set(x.u.id, m);
  }
  if (own || !joined.length) return;
  ensure(stage);
  const levelOf = (x: typeof joined[number]) => Math.max(.05, mareaLevel(x.v.f, x.u.timed?.agua?.level ?? 0, (x.u.timed?.agua?.left ?? 0) / AGUA.mark));
  const pipes = joined.slice(1).map((x, i) => { const prev = joined[i], { p, q, side } = pipe(prev.v, x.v); return { a: lift(p, levelOf(prev)), b: lift(q, levelOf(x)), side }; });
  if (rose) {
    // A pulse along the whole of it: every surface and every pipe lights at once.
    for (const x of joined) {
      const surface = lift(x.v.f.feet, levelOf(x));
      stage.fx.ring(surface, UP, x.v.R, C.foam, { kind: K.line, count: Math.round(x.v.R * 70), life: .6, size: 1.2 });
      stage.fx.burst(K.ring, { colour: C.teal, at: surface, count: 1, spread: .01, life: [.45, .55], size: .4 + x.v.R * .4 });
      stage.fx.burst(K['marea-drop'], { at: surface, count: 12, shape: 'ring', spread: x.v.R, outward: 1, up: 1.4, speed: .4, life: [.4, .7] });
    }
    for (const { a, b } of pipes) {
      stage.fx.line(a, b, C.foam, { kind: K.line, count: Math.round(dist(a, b) * 26), life: .6, size: 1.2 });
      stage.fx.burst(K.flow, { colour: C.sea, at: a, count: Math.round(dist(a, b) * 8), spread: .04, velocity: { x: (b.x - a.x) / .4, y: (b.y - a.y) / .4, z: (b.z - a.z) / .4 }, speed: .15, life: [.34, .42] });
    }
    nextDraw = .5;
  }
  // The faint tide line between them: drawn every half second, each drawing living a little longer, so it never goes out.
  if ((nextDraw -= dt) <= 0) {
    nextDraw = .5;
    for (const { a, b } of pipes) stage.fx.line(a, b, C.sea, { kind: K.line, count: Math.max(6, Math.round(dist(a, b) * 18)), life: .75, size: .8 });
    // A faint tide mark round each, at its water.
    if (pipes.length) for (const x of joined) stage.fx.ring(lift(x.v.f.feet, levelOf(x)), UP, x.v.R, C.teal, { kind: K.line, count: Math.round(x.v.R * 26), life: .7, size: .6 });
    // Where each pipe meets its vessel, a point of chalk-gold: the figure is still there, faintly.
    for (const { a, b } of pipes) for (const p of [a, b]) stage.fx.burst(K['marea-chalk'], { colour: C.gold, at: p, count: 1, spread: .005, life: [.6, .75], size: 1.6 });
  }
  // A thread of current running along it, now and then.
  if (pipes.length && (nextFlow -= dt) <= 0) {
    nextFlow = .3 + Math.random() * .3;
    const { a, b } = pipes[Math.floor(Math.random() * pipes.length)], forward = Math.random() < .5, from = forward ? a : b, to = forward ? b : a, life = Math.max(.25, dist(a, b) / 2);
    stage.fx.burst(K.flow, { colour: C.sea, at: from, count: 2, spread: .02, velocity: { x: (to.x - from.x) / life, y: (to.y - from.y) / life, z: (to.z - from.z) / life }, speed: .03, life: [life * .95, life] });
  }
}
