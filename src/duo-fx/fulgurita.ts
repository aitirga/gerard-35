import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Fulgurita (Punto eléctrico + Puñado, dúo mayor): the glass a bolt leaves in sand. Colorista throws
 * its blue powder over every foe; Gerard's point of charge climbs above them and comes down as
 * lightning into each cloud, and where it strikes the powder fuses: branching tubes of glass run out
 * along the floor and up their bodies, the foes are left with a crust of glass, and a lattice of
 * glassy lightning joins them. While it lasts (`fulgurita`, 20 s) the crust glints on each and the
 * lattice shows faintly between them; a blow on one of them sends a crack of light along it to every
 * other, as their shards grow together.
 */
const T = { throw: .32, charge: .26, strike: .7, gap: .07, contact: 1.05, end: 2.2 };
/** Colorista's ultramarine, the glass it fuses into, and Matemágico's electric yellow. */
const C = { blue: '#617ce2', deep: '#3d5fe0', sand: '#7f93dc', glass: '#9fb4f2', rim: '#dde6ff', bolt: '#ffe45c', hot: '#fff6c8', gold: '#ffd27a' } as const;
const GLASS_FLASH = [.72, .82, 1] as const, BOLT_FLASH = [1, .94, .55] as const;

const KINDS: Record<string, GpuKind> = {
  // Colorista's handful in flight, and the matte blue cloud it bursts into over each foe.
  'fulgurita-throw': {
    shape: 'powder', drag: .25, gravity: 2.5, curl: .2, response: .2, size: [.06, .1], sizeJitter: .5,
    colours: ['#ffffff', '#f2f2f2', '#e0e0e0'], intensity: [1.15, 1.05, 1], fadeIn: .03, fadeOut: .12, additive: 0, opacity: .9, core: 0,
  },
  'fulgurita-sand': {
    shape: 'powder', drag: 6, gravity: .25, curl: .8, response: .7, size: [.09, .24], sizeJitter: .55,
    colours: ['#ffffff', '#f2f2f2', '#d8d8d8'], intensity: [1.15, 1.05, .95], middle: .3, fadeIn: .03, fadeOut: .35, additive: 0, opacity: .82, core: 0,
  },
  'fulgurita-grain': {
    shape: 'powder', drag: 2.4, gravity: 2, curl: 1, response: .8, collide: true, bounce: 0, friction: 1, size: [.014, .01], sizeJitter: .6,
    colours: ['#ffffff', '#f2f2f2', '#d8d8d8'], intensity: [1.2, 1.1, 1], fadeIn: .02, fadeOut: .3, additive: 0, opacity: 1, core: 0,
  },
  // The lightning: crisp dots of white-hot yellow that stay where they are drawn, and its glow.
  'fulgurita-bolt': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.032, .014], sizeJitter: .3,
    colours: ['#ffffff', '#fff3a0', '#ffd23a'], intensity: [8, 5, 2.4], middle: .25, fadeIn: 0, fadeOut: .5, additive: 1, flicker: .35, core: .8,
  },
  'fulgurita-glow': {
    shape: 'glow', blur: [.4, 1.1], drag: 0, gravity: 0, size: [.3, .9], colours: ['#ffffff', '#ffffff', '#ffffff'],
    intensity: [7, 3.6, 1], middle: .25, fadeIn: 0, fadeOut: .8, additive: 1, core: .5,
  },
  // The fulgurite: beads of glass along the way the bolt ran through the sand, see-through with a bright rim.
  'fulgurita-tube': {
    shape: 'shard', drag: 20, gravity: 0, curl: 0, response: 0, size: [.016, .022], sizeJitter: .45, stretch: 0, spin: 0,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.8, 1.15, .95], middle: .1, fadeIn: .03, fadeOut: .3, additive: .35, opacity: .95, flicker: .12, glass: .5, core: .2,
  },
  // The crust of glass on a crystallised foe: shards that cling to its parts and glint.
  'fulgurita-crust': {
    shape: 'shard', drag: 3, gravity: 4, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 5, size: [.02, .028], sizeJitter: .6, stretch: 0,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.6, 1.5, 1.25], middle: .1, fadeIn: .2, fadeOut: .25, additive: .3, opacity: .95, flicker: .4, glass: .5, core: .2,
  },
  // Glass knocked off: chips that spin, fall and skitter.
  'fulgurita-chip': {
    shape: 'shard', drag: .5, gravity: 8, curl: .1, response: .2, collide: true, bounce: .4, friction: .4, size: [.02, .014], sizeJitter: .6, stretch: .015, spin: 620,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3.4, 2, 1.2], middle: .2, fadeIn: 0, fadeOut: .3, additive: .5, glass: .5, core: .3,
  },
  // The lattice while it holds: faint glassy dots between the foes that come and go.
  'fulgurita-link': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.016, .012], sizeJitter: .3,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.2, 1.5, .6], middle: .4, fadeIn: .25, fadeOut: .55, additive: 1, flicker: .5, core: .4, glass: .4,
  },
  // A glint off the crust: a small four-point star.
  'fulgurita-glint': {
    shape: 'star', blur: [0, .5], drag: 3, size: [.06, .012], spin: 160, colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5, 3, 1], fadeOut: .7, additive: 1, core: .6,
  },
};
/** A shared kind to fall back on if one of ours could not be defined (the engine's kinds are full). */
const FALLBACK: Record<string, string> = { 'fulgurita-throw': 'pigmentthrow', 'fulgurita-sand': 'pigment', 'fulgurita-grain': 'grain', 'fulgurita-bolt': 'glyph', 'fulgurita-glow': 'bloom', 'fulgurita-tube': 'facet', 'fulgurita-crust': 'shardling', 'fulgurita-chip': 'chip', 'fulgurita-link': 'glyph', 'fulgurita-glint': 'twinkle' };
function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) try { g.define(name, kind); } catch { /* falls back (`kindOf`) */ }
}
/** Our kind if the engine has it, else its shared stand-in. */
const kindOf = (stage: DuoStage, name: string) => stage.effects.gpu?.get(name) ? name : FALLBACK[name] ?? name;
/** A burst of one of our kinds (or its stand-in). */
const burst = (stage: DuoStage, name: string, o: Parameters<DuoStage['fx']['burst']>[1]) => stage.fx.burst(kindOf(stage, name), o);

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const dist = (a: V3, b: V3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const UP: V3 = { x: 0, y: 1, z: 0 };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A jagged way from `a` to `b` (midpoint displacement, `depth` times), its kinks off the line by up to `rough` of each piece. */
function jag(a: V3, b: V3, rough: number, depth: number): V3[] {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next: V3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], len = dist(p, q) * rough;
      next.push({ x: (p.x + q.x) / 2 + rand(-len, len), y: (p.y + q.y) / 2 + rand(-len, len) * .6, z: (p.z + q.z) / 2 + rand(-len, len) }, q);
    }
    pts = next;
  }
  return pts;
}
/** Draws a way as dots of `kind`, piece by piece, `step` seconds apart (0: at once), from `delay`. */
function trace(stage: DuoStage, pts: readonly V3[], kind: string, colour: string, o: { delay?: number; step?: number; density?: number; life: number; size?: number; speed?: number }) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], at = (o.delay ?? 0) + (i - 1) * (o.step ?? 0);
    stage.fx.after(at, () => burst(stage, kind, { at: a, to: b, shape: 'line', count: Math.max(2, Math.round(dist(a, b) * (o.density ?? 60))), speed: o.speed ?? 0, life: [o.life * .8, o.life], colour, size: o.size ?? 1 }));
  }
}
/** Where on a foe the lattice runs: a little below its chest. */
const knot = (f: DuoFighter): V3 => mix(f.feet, f.chest, .7);
/** The lattice: each foe to the next across the picture, and round to the first when there are three or more. */
function links(foes: readonly DuoFighter[], view: V3): [DuoFighter, DuoFighter][] {
  if (foes.length < 2) return [];
  const { right } = screenAxes(view), side = (f: DuoFighter) => f.feet.x * right.x + f.feet.z * right.z;
  const row = [...foes].sort((a, b) => side(a) - side(b)), out: [DuoFighter, DuoFighter][] = [];
  for (let i = 1; i < row.length; i++) out.push([row[i - 1], row[i]]);
  if (row.length > 2) out.push([row[row.length - 1], row[0]]);
  return out;
}

/** The fulgurite on one foe: roots of glass running out along the floor from its feet, and up its body on the side we see. */
function fuse(stage: DuoStage, f: DuoFighter, at: number, life: number) {
  const { facing } = screenAxes(stage.view), r = Math.max(.3, f.radius), base = Math.random() * Math.PI * 2;
  const floor = (x: number, z: number): V3 => ({ x, y: stage.ground(x, z) + .03, z });
  const roots = 6;
  for (let k = 0; k < roots; k++) {
    let a = base + k / roots * Math.PI * 2 + rand(-.3, .3), p = floor(f.feet.x + Math.cos(a) * r * .55, f.feet.z + Math.sin(a) * r * .55);
    const pts = [p], forks: { from: V3; a: number; i: number }[] = [], steps = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      a += rand(-.55, .55);
      const len = rand(.15, .26) * (1 - i * .08);
      p = floor(p.x + Math.cos(a) * len, p.z + Math.sin(a) * len); pts.push(p);
      if (i > 0 && i < steps - 1 && Math.random() < .45) forks.push({ from: p, a: a + (Math.random() < .5 ? -1 : 1) * rand(.6, 1.1), i });
    }
    // The bolt runs through the sand first (white-hot), the glass is left behind it.
    trace(stage, pts, 'fulgurita-bolt', C.hot, { delay: at, step: .028, density: 55, life: .2, size: 1.1 });
    trace(stage, pts, 'fulgurita-tube', k % 2 ? C.glass : C.sand, { delay: at + .02, step: .028, density: 60, life: life - at, size: 1 });
    for (const fork of forks) {
      let q = fork.from, b = fork.a;
      const twig = [q];
      for (let j = 0; j < 2 + Math.floor(Math.random() * 2); j++) { b += rand(-.5, .5); const len = rand(.1, .18); q = floor(q.x + Math.cos(b) * len, q.z + Math.sin(b) * len); twig.push(q); }
      trace(stage, twig, 'fulgurita-tube', C.glass, { delay: at + .03 + fork.i * .028, step: .03, density: 55, life: life - at - .05, size: .8 });
    }
  }
  // Up its body, on our side: three tendrils of glass climbing to its chest.
  for (let k = 0; k < 3; k++) {
    const a = Math.atan2(facing.z, facing.x) + (k - 1) * .75 + rand(-.2, .2), out = { x: Math.cos(a) * r * .85, y: 0, z: Math.sin(a) * r * .85 };
    const foot = add(f.feet, out), top = add(add(f.feet, out, .7), UP, f.height * rand(.55, .8));
    trace(stage, jag(foot, top, .22, 3), 'fulgurita-tube', C.glass, { delay: at + .05, step: .03, density: 50, life: life - at - .1, size: .8 });
  }
}
/** The crust on a foe: shards born on its body, where they cling (without its slot, born inside it and put out on the surface of the part they are in). */
function crust(stage: DuoStage, f: DuoFighter, count: number, life: readonly [number, number]) {
  if (f.index >= 0) {
    burst(stage, 'fulgurita-crust', { at: f.feet, shape: 'surface', fighter: f.index, above: .08, outward: -.3, speed: .04, count, life, colour: Math.random() < .5 ? C.glass : C.rim });
    return;
  }
  const balls = Math.max(1, Math.round(count / 10));
  for (let i = 0; i < balls; i++) {
    const at = add(f.feet, UP, f.height * rand(.3, .8));
    burst(stage, 'fulgurita-crust', { at, spread: f.radius * .65, count: Math.round(count / balls), life, colour: Math.random() < .5 ? C.glass : C.rim });
  }
}
/** A crack of light along the lattice from `from` to every other foe it joins, a link at a time. */
function crack(stage: DuoStage, foes: readonly DuoFighter[], from: DuoFighter) {
  const joined = links(foes, stage.view), reached = new Set([from.id]);
  let wave = [from], delay = 0;
  stage.hit(from.id, GLASS_FLASH, .7);
  burst(stage, 'fulgurita-glint', { at: from.chest, count: 6, spread: f2(from), speed: .3, life: [.3, .55], colour: C.rim });
  while (wave.length) {
    const next: DuoFighter[] = [];
    for (const a of wave) for (const [p, q] of joined) {
      const b = p.id === a.id ? q : q.id === a.id ? p : undefined;
      if (!b || reached.has(b.id)) continue;
      reached.add(b.id); next.push(b);
      const pts = jag(knot(a), knot(b), .14, 3), seconds = .16;
      trace(stage, pts, 'fulgurita-bolt', C.rim, { delay, step: seconds / pts.length, density: 70, life: .3, size: 1.2 });
      trace(stage, pts, 'fulgurita-link', C.glass, { delay: delay + .04, step: seconds / pts.length, density: 40, life: .9, size: 1.3 });
      stage.fx.after(delay + seconds, () => {
        stage.hit(b.id, GLASS_FLASH, .8);
        burst(stage, 'fulgurita-chip', { at: b.chest, count: 16, spread: f2(b), speed: 2.2, up: 1.2, life: [.5, 1], colour: C.glass });
        burst(stage, 'fulgurita-glint', { at: b.chest, count: 5, spread: f2(b), speed: .3, life: [.3, .55], colour: C.rim });
        burst(stage, 'fulgurita-glow', { at: b.chest, count: 1, spread: .02, life: [.14, .2], colour: C.glass, size: .5, light: { intensity: 2, range: 2.4, colour: C.rim } });
      });
    }
    wave = next; delay += .16;
  }
  if (reached.size > 1) { stage.cue('glass-tick'); stage.cue('zap', { delay: .05 }); }
}
const f2 = (f: DuoFighter) => Math.max(.2, f.radius * .8);

/** What the hold remembers between frames: each foe's clocks, whether it was crystallised, and the last effect seen. */
const held = new Map<string, { crust: number; glint: number; left: number }>();
let link = 0, seen: BattleEffect | undefined, since = 0;
/** The fight as the hold last saw it: who is crystallised when a blow lands (`struck`). */
let latest: BattleState | undefined;

export const staging: DuoStaging = {
  timing: { contact: T.contact, end: T.end },
  start(stage, _e, reached) {
    if (!stage.fx.on) return;
    ensure(stage);
    const foes = reached.filter(f => !f.party);
    if (!foes.length) return;
    const painter = stage.wearer('prismatico'), math = stage.wearer('matemagico');
    const { right } = screenAxes(stage.view);
    // Colorista's handful for each foe, one after the other, and the blue cloud it bursts into over them.
    foes.forEach((f, i) => {
      const from = painter?.hand ?? painter?.chest ?? add(f.chest, right, -2), to = add(f.chest, UP, f.height * .25), t0 = i * .05, fly = T.throw;
      const g = 2.5, v = { x: (to.x - from.x) / fly, y: (to.y - from.y) / fly + g * fly / 2, z: (to.z - from.z) / fly };
      stage.fx.after(t0, () => burst(stage, 'fulgurita-throw', { at: from, count: 70, spread: .08, velocity: v, speed: .35, life: [fly * .95, fly * 1.05], colour: i % 2 ? C.blue : C.deep }));
      stage.fx.after(t0 + fly, () => {
        const top = add(f.feet, UP, f.height * .55);
        burst(stage, 'fulgurita-sand', { at: top, count: 110, spread: f.radius * .9 + .1, speed: 1.6, up: .4, life: [1, 1.5], colour: C.blue });
        burst(stage, 'fulgurita-sand', { at: add(f.feet, UP, .1), shape: 'ring', spread: f.radius + .2, outward: 1.4, count: 50, life: [.9, 1.3], colour: C.deep });
        burst(stage, 'fulgurita-grain', { at: top, count: 160, spread: f.radius + .1, speed: 1.3, up: .5, life: [.9, 1.6], colour: C.sand });
      });
    });
    stage.cue('gust', { delay: .05 });
    // Gerard's point of charge climbs above them all, crackling, with his digits turning round it.
    const mid = foes.reduce((m, f) => add(m, f.feet, 1 / foes.length), { x: 0, y: 0, z: 0 } as V3);
    const tall = Math.max(...foes.map(f => f.height)), point = add(mid, UP, tall + 1.4);
    const hand = math?.hand ?? math?.chest;
    if (hand) stage.effects.trails.comet(hand, point, ['#fffbe8', C.bolt], T.strike - T.charge - .1, { arc: .8, width: .06, life: .4, intensity: 3.4, core: .7, additive: 1, delay: T.charge });
    stage.fx.after(T.charge + .2, () => {
      burst(stage, 'fulgurita-glow', { at: point, count: 1, spread: .01, life: [T.strike - T.charge - .15, T.strike - T.charge - .1], colour: C.bolt, size: .55, light: { intensity: 3, range: 4, colour: C.bolt } });
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2, at = add(add(point, right, Math.cos(a) * .5), UP, Math.sin(a) * .5);
        stage.fx.digit(at, (k % 2) as 0 | 1, .16, C.gold, stage.view, .4);
      }
      stage.fx.burst('crackle', { at: point, count: 30, spread: .08, speed: 2.2, life: [.15, .35], colour: C.bolt });
    });
    stage.cue('charge', { delay: T.charge });
    // It comes down into each cloud, a breath apart: a bolt through them into the sand, and the sand fuses.
    foes.forEach((f, i) => {
      const at = T.strike + i * T.gap, ground = { ...f.feet, y: f.feet.y + .02 };
      const pts = jag(point, ground, .16, 4);
      trace(stage, pts, 'fulgurita-bolt', C.bolt, { delay: at, step: .006, density: 70, life: .28, size: 1.5 });
      // A fork or two off it, down and out.
      for (let n = 0; n < 2; n++) {
        const from = pts[4 + Math.floor(Math.random() * (pts.length - 8))], out = add(from, { x: rand(-1, 1), y: -rand(.4, .9), z: rand(-1, 1) }, .6);
        trace(stage, jag(from, out, .2, 2), 'fulgurita-bolt', C.hot, { delay: at + .03, density: 55, life: .2, size: 1 });
      }
      stage.fx.after(at + .04, () => {
        stage.hit(f.id, BOLT_FLASH, 1.2);
        burst(stage, 'fulgurita-glow', { at: ground, count: 1, spread: .02, life: [.16, .22], colour: C.bolt, size: .6, light: { intensity: 2.5, range: 3, colour: C.bolt } });
        stage.fx.burst('crackle', { at: ground, count: 50, spread: .15, speed: 2.6, up: 1.4, life: [.25, .55], colour: C.bolt });
        stage.shake(.2);
      });
      fuse(stage, f, at + .04, T.end + .4);
      stage.cue('zap', { delay: at });
    });
  },
  land(stage, _e, reached) {
    ensure(stage);
    const foes = reached.filter(f => !f.party);
    // The glass sets: a crust on each, chips off it, and the lattice of glassy lightning across them.
    for (const f of foes) {
      stage.hit(f.id, GLASS_FLASH, 1.3);
      crust(stage, f, 90, [2.6, 3.6]);
      burst(stage, 'fulgurita-chip', { at: f.chest, count: 40, spread: f2(f), speed: 2.6, up: 1.4, life: [.6, 1.2], colour: C.glass });
      burst(stage, 'fulgurita-glint', { at: f.chest, count: 10, spread: f2(f) + .1, speed: .4, life: [.35, .7], colour: C.rim });
      stage.fx.burst('floorring', { at: { ...f.feet, y: f.feet.y + .04 }, count: 1, spread: .01, life: [.45, .6], colour: C.glass, size: Math.max(.5, f.radius) });
    }
    for (const [a, b] of links(foes, stage.view)) {
      const pts = jag(knot(a), knot(b), .16, 4);
      trace(stage, pts, 'fulgurita-bolt', C.rim, { step: .004, density: 80, life: .32, size: 1.5 });
      trace(stage, pts, 'fulgurita-tube', C.glass, { delay: .03, step: .004, density: 40, life: 1.05, size: 1 });
      stage.fx.after(.35, () => trace(stage, pts, 'fulgurita-link', C.rim, { step: .01, density: 50, life: .7, size: 1.4 }));
    }
    stage.shake(.5); stage.pulse(.6, .9, .12); stage.punch(.5);
    stage.cue('crack'); stage.cue('glass-tick', { delay: .1 });
  },
  hold(stage, dt, state: BattleState, playing) {
    const g = stage.effects.gpu;
    if (!g || !stage.fx.on) return;
    ensure(stage);
    latest = state;
    if (playing !== seen) { seen = playing; since = 0; } else since += dt;
    // Its own start draws the crust and the lattice; the hold takes over once it has landed.
    const own = playing?.dual?.id === 'fulgurita' && since < T.contact;
    const under = state.foes.filter(u => u.hp > 0 && u.timed?.fulgurita);
    // A crust that comes off: whoever it ran out on sheds its glass (one gone another way, or a fight over, just goes).
    for (const [id, h] of held) {
      const unit = state.foes.find(u => u.id === id);
      if (unit?.timed?.fulgurita) continue;
      const f = unit && unit.hp > 0 && h.left < 1 ? stage.fighter(id) : undefined;
      if (f) burst(stage, 'fulgurita-chip', { at: f.chest, count: 30, spread: f2(f), speed: 1, up: .3, life: [.6, 1.1], colour: C.glass });
      held.delete(id);
    }
    if (!under.length || own) return;
    const fighters = under.map(u => stage.fighter(u.id)).filter((f): f is DuoFighter => !!f);
    for (const f of fighters) {
      const h = held.get(f.id) ?? { crust: 0, glint: rand(.2, .9), left: 20 };
      h.left = under.find(u => u.id === f.id)?.timed?.fulgurita?.left ?? 0;
      held.set(f.id, h);
      // The crust, kept up a few shards at a time.
      if ((h.crust -= dt) <= 0) { h.crust = .12; crust(stage, f, 4, [2.6, 3.4]); }
      // Now and then a glint off it.
      if ((h.glint -= dt) <= 0) {
        h.glint = rand(.5, 1.1);
        burst(stage, 'fulgurita-glint', { at: add(f.feet, UP, f.height * rand(.3, .85)), count: 1, spread: f.radius * .7, life: [.3, .5], colour: C.rim });
      }
    }
    // The lattice between them, faint, every second or so.
    if ((link -= dt) <= 0) {
      link = 1.1;
      for (const [a, b] of links(fighters, stage.view)) trace(stage, jag(knot(a), knot(b), .12, 3), 'fulgurita-link', C.glass, { density: 22, life: .9, size: 1 });
    }
  },
  // A blow lands on one of them, whoever dealt it: the crack runs along the lattice from it to all the others.
  struck(stage, e, struck) {
    if (!stage.fx.on || e.dual?.id === 'fulgurita' || !latest) return;
    ensure(stage);
    const joined = new Set(latest.foes.filter(u => u.hp > 0 && u.timed?.fulgurita).map(u => u.id));
    if (joined.size < 2) return;
    const now = stage.foes().filter(f => joined.has(f.id));
    for (const from of struck.filter(f => joined.has(f.id)).slice(0, 2)) crack(stage, now, from);
  },
};
