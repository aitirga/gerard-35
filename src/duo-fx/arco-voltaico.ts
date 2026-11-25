import * as pc from 'playcanvas';
import type { BattleEffect } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { GpuEmitter, GpuKind, GpuVolume } from '../fight-particles';
import { neonCircle, neonCurve, neonDashes, type NeonFigure, type NeonFrame, type NeonStroke } from '../math-figures';
import type { Trail } from '../trails';
import type { DuoStage, DuoStaging } from './types';

/**
 * Arco voltaico (∂Q/∂t Condensador + Acecho, docs/animas/README.md § Combined skills): Acecho with the condenser's
 * charge. Its turn, Gerard draws a parabola of gold neon in front of him, its focus a bead and its directrix dashed;
 * it rises and turns in the world until its axis stands over the prey and its focus sits just in front of its chest
 * (towards the camera, so the body never hides where the light meets): an arch of light over it, running down to the
 * floor on either side. While the cat waits charged (`Combatant.stalk`), sparks
 * rise out of the floor under the arch, parallel, strike a parabolic mirror on the GPU that stands along it (a
 * `paraboloid` volume in `mirror` mode, opening down) and converge for real on the focus, their small spread drawing
 * the caustic's bright seam; the cat crouches at her place, her fur standing with static. A foe that strikes her
 * first takes the charge: the arch swings its focus onto it and an arc leaves its vertex for it, and the mirror goes
 * dark. As the next round starts the cat runs the curve itself, the arch is her ballistic flight (`arcRun`), a
 * trail of plasma behind her, and drops down its axis onto the focus: a jagged bolt, the crítico, and the arch
 * bursts into gold splinters.
 */
const T = { draw: .46, directrix: .2, focus: .1, rise: .62, settle: 1.18, contact: 1.2, end: 1.9 } as const;
/**
 * The pounce along the arch, in fight seconds from its start: crouched till `spring`, a dash along the floor to the
 * arch's near foot by `foot`, the curve itself to its vertex by `apex` (its x even in time: a ballistic flight), down
 * the axis onto the focus at `contact`, on its back till `stay`, home by `home`; over at `end`.
 */
export const ARC_POUNCE = { spring: .2, foot: .42, apex: .78, contact: .9, stay: 1.14, home: 1.62, end: 1.95 } as const;
/** Matemágico's gold and the charge's yellow; white-hot for the bolt. Never pink or violet. */
const C = { gold: '#f3cf78', deep: '#d9a441', bolt: '#ffe45c', hot: '#fff6c8', white: '#ffffff', amber: '#ffb347' } as const;
const BOLT_FLASH = [1, .94, .55] as const, GOLD_FLASH = [1, .86, .5] as const;

const KINDS: Record<string, GpuKind> = {
  // A spark that sees the mirror: straight, weightless, losing nothing off it.
  'arco-chispa': {
    shape: 'spark', mirror: true, drag: 0, gravity: 0, curl: 0, response: 0, size: [.013, .007], sizeJitter: .4, stretch: .07, aspect: .25,
    colours: ['#ffffff', '#ffe45c', '#ffb347'], intensity: [6.5, 4.6, 2], middle: .55, fadeIn: .02, fadeOut: .2, additive: 1, flicker: .2, core: .8,
  },
  // The focus where they meet: a soft knot of light that flickers.
  'arco-foco': {
    shape: 'glow', blur: [.3, .9], drag: 0, gravity: 0, size: [.05, .16], sizeJitter: .4, colours: ['#ffffff', '#fff1a0', '#f3cf78'],
    intensity: [6, 3.4, 1], middle: .3, fadeIn: 0, fadeOut: .6, additive: 1, flicker: .4, core: .7,
  },
  // Static in the cat's fur: short chains that crackle and twist, thick enough to read at the fight's distance.
  'arco-estatica': {
    shape: 'strand', drag: 2.5, gravity: 0, curl: 3, response: 1, follow: 34, size: [.012, .006], sizeJitter: .4,
    colours: ['#ffffff', '#ffe45c', '#f3cf78'], intensity: [8, 5, 2], middle: .3, fadeIn: 0, fadeOut: .35, additive: 1, flicker: .6, core: .7,
  },
  // The bolt: crisp dots that stay where they are drawn, yellow rather than white so it reads as a line, not a bloom.
  'arco-rayo': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.026, .01], sizeJitter: .3,
    colours: ['#fff6c8', '#ffe45c', '#d9a441'], intensity: [5.5, 3.4, 1.6], middle: .25, fadeIn: 0, fadeOut: .5, additive: 1, flicker: .35, core: .85,
  },
  // Plasma shed along her flight: hot motes that hang and cool.
  'arco-plasma': {
    shape: 'glow', blur: [.2, .8], drag: 3, gravity: -.4, curl: .6, response: .4, size: [.03, .07], sizeJitter: .5,
    colours: ['#ffffff', '#ffe45c', '#d9a441'], intensity: [5, 2.6, .6], middle: .3, fadeIn: 0, fadeOut: .5, additive: 1, flicker: .3, core: .6,
  },
  // The arch breaking: splinters of gold that spin, fall and skitter (gold, not white: on the crítico's flash they must still read as pieces).
  'arco-esquirla': {
    shape: 'shard', drag: .6, gravity: 7.5, curl: .1, response: .2, collide: true, bounce: .35, friction: .5, size: [.024, .014], sizeJitter: .6, stretch: .012, spin: 640,
    colours: ['#fbe6a8', '#f3cf78', '#b8792a'], intensity: [2.8, 2, 1], middle: .3, fadeIn: 0, fadeOut: .3, additive: .4, glass: .3, core: .4,
  },
};
const FALLBACK: Record<string, string> = { 'arco-chispa': 'spark', 'arco-foco': 'bloom', 'arco-estatica': 'crackle', 'arco-rayo': 'glyph', 'arco-plasma': 'ember', 'arco-esquirla': 'chip' };
function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) try { g.define(name, kind); } catch { /* falls back (`kindOf`) */ }
}
const kindOf = (stage: DuoStage, name: string) => stage.effects.gpu?.get(name) ? name : FALLBACK[name] ?? name;
const burst = (stage: DuoStage, name: string, o: Parameters<DuoStage['fx']['burst']>[1]) => stage.fx.burst(kindOf(stage, name), o);

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const dist = (a: V3, b: V3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const norm = (v: V3): V3 => { const d = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / d, y: v.y / d, z: v.z / d }; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const ease = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const UP: V3 = { x: 0, y: 1, z: 0 };
const xy = (x: number, y: number): V3 => ({ x, y, z: 0 });

/**
 * The arch over a prey, from the side the cat comes from: in a vertical plane along her way to it, its axis straight
 * up, wide enough at the floor (`reach` each side) to stand clear of it. Its focus is the prey's chest, drawn a little
 * in front of it (`toward`, the camera's side) so the light meets where the body cannot hide it; the cat
 * still lands on the chest. Its focal length is what makes the curve meet the floor at `reach`: `f² + h·f = reach²/4`,
 * `h` the focus's height.
 */
export interface ArcGeometry {
  /** Where the arch's focus is drawn; `chest`: the prey's, where she lands. */
  focus: V3; chest: V3; dir: V3; f: number; reach: number; height: number;
  /** Where the arch is at `x` along it (metres from its axis, towards the cat negative). */
  at(x: number): V3;
  /** The figure's frame: x along `dir`, y up, its origin on the focus. */
  frame: NeonFrame;
}
export function arcGeometry(from: V3, target: { chest: V3; feet: V3; radius: number; height: number }, toward?: V3): ArcGeometry {
  let dir = { x: target.feet.x - from.x, y: 0, z: target.feet.z - from.z };
  if (Math.hypot(dir.x, dir.z) < .05) dir = { x: 1, y: 0, z: 0 };
  dir = norm(dir);
  const out = toward && Math.hypot(toward.x, toward.z) > .05 ? norm({ x: toward.x, y: 0, z: toward.z }) : { x: 0, y: 0, z: 0 };
  // Level with the chest, not over it: higher, a short foe's status chips would sit on the bead.
  const focus = add(target.chest, out, target.radius * .9 + .25);
  const h = Math.max(.35, focus.y - target.feet.y), reach = Math.max(1.15, target.radius + .95);
  const f = (-h + Math.sqrt(h * h + reach * reach)) / 2;
  const facing = cross(dir, UP);
  return {
    focus, chest: target.chest, dir, f, reach, height: target.height,
    at: x => add(add(focus, dir, x), UP, f - x * x / (4 * f)),
    frame: { at: focus, right: dir, up: UP, facing },
  };
}
/** The arch each waiting ally's cat runs, and over which prey: one source for the figure and the scene's run. */
const arches = new Map<string, { prey: string; geo: ArcGeometry }>();
/**
 * The arch `holder`'s cat runs onto `prey`: the one drawn for it, or, if she goes for another (it fell), one `make`s
 * once for both the scene and the figure, whichever asks first.
 */
export function arcFor(holder: string, prey: string, make: () => ArcGeometry): ArcGeometry {
  const known = arches.get(holder);
  if (known?.prey === prey) return known.geo;
  const geo = make();
  arches.set(holder, { prey, geo });
  return geo;
}
/**
 * Where the cat is `t` seconds into her pounce along `g` from `rest` (on the floor): the dash to the near foot, the
 * arch to its vertex at an even pace across (a thrown body's), down the axis onto the prey's back, and home.
 * `lift`: how far over the floor; `leap`: in the air (0–1) or undefined.
 */
export interface ArcPose { at: V3; lift: number; leap?: number; crouch: number }
/**
 * Where the cat is `t` seconds into her pounce along `g` from `rest` (on the floor): the dash to the near foot, the
 * arch to its vertex at an even pace across (a thrown body's), down onto the prey's back, and home. Written into
 * `out` (its `at` too), so a frame allocates nothing. `lift`: how far over the floor; `leap`: in the air (0–1) or undefined.
 */
export function arcRun(g: ArcGeometry, rest: V3, t: number, out: ArcPose = { at: { x: 0, y: 0, z: 0 }, lift: 0, crouch: 0 }): ArcPose {
  const P = ARC_POUNCE, vertex = g.at(0);
  // She lands on its back, on the chest under the drawn focus: never higher than the vertex, never lower than the chest.
  const backY = Math.min(vertex.y - .05, Math.max(g.chest.y, rest.y + g.height * .82));
  const put = (x: number, y: number, z: number, lift: number, leap: number | undefined, crouch: number) => {
    out.at.x = x; out.at.y = y; out.at.z = z; out.lift = lift; out.leap = leap; out.crouch = crouch;
    return out;
  };
  if (t < P.spring) return put(rest.x, rest.y, rest.z, 0, undefined, 1);
  if (t < P.foot) {
    const u = ease((t - P.spring) / (P.foot - P.spring)), foot = g.at(-g.reach);
    return put(rest.x + (foot.x - rest.x) * u, rest.y, rest.z + (foot.z - rest.z) * u, Math.sin(u * Math.PI) * .18, u, 0);
  }
  if (t < P.apex) { const p = g.at(-g.reach * (1 - (t - P.foot) / (P.apex - P.foot))); return put(p.x, rest.y, p.z, Math.max(0, p.y - rest.y), .5, 0); }
  if (t < P.contact) {
    const u = clamp01((t - P.apex) / (P.contact - P.apex)) ** 2, y = vertex.y + (backY - vertex.y) * u;
    return put(vertex.x + (g.chest.x - vertex.x) * u, rest.y, vertex.z + (g.chest.z - vertex.z) * u, Math.max(0, y - rest.y), .5, 0);
  }
  if (t < P.stay) return put(g.chest.x, rest.y, g.chest.z, Math.max(0, backY - rest.y), undefined, 1);
  const u = ease((t - P.stay) / (P.home - P.stay));
  return put(g.chest.x + (rest.x - g.chest.x) * u, rest.y, g.chest.z + (rest.z - g.chest.z) * u, Math.max(0, (backY - rest.y) * (1 - u) * (1 - u)) + Math.sin(u * Math.PI) * .35, u < 1 ? u : undefined, 0);
}

/** A jagged way from `a` to `b` (midpoint displacement), its kinks off the line by up to `rough` of each piece. */
function jag(a: V3, b: V3, rough: number, depth: number): V3[] {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next: V3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], len = dist(p, q) * rough;
      next.push({ x: (p.x + q.x) / 2 + rand(-len, len), y: (p.y + q.y) / 2 + rand(-len, len) * .5, z: (p.z + q.z) / 2 + rand(-len, len) }, q);
    }
    pts = next;
  }
  return pts;
}
/** A bolt along `pts`, piece by piece `step` seconds apart, with its glow. */
function bolt(stage: DuoStage, pts: readonly V3[], o: { delay?: number; step?: number; life?: number; size?: number; colour?: string } = {}) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    stage.fx.after((o.delay ?? 0) + (i - 1) * (o.step ?? 0), () => burst(stage, 'arco-rayo', { at: a, to: b, shape: 'line', count: Math.max(3, Math.round(dist(a, b) * 70)), life: [(o.life ?? .3) * .8, o.life ?? .3], colour: o.colour ?? C.bolt, size: o.size ?? 1.3 }));
  }
}

/** The arch over one prey, from the dual's contact until the cat lands or the moment is lost. */
interface Wait {
  target: string; figure: NeonFigure; strokes: NeonStroke[]; geo: ArcGeometry;
  mirror?: GpuVolume; rain: GpuEmitter[]; knot?: GpuEmitter; radius: number;
  charged: boolean; fur: number; knotted: number; gpu: unknown;
  /** The pounce playing now: its effect, how long it has played, its trail. */
  run?: { effect: BattleEffect; t: number; trail?: Trail; head: pc.Vec3; shed: number; rim: number };
}
/** Who waits (the ally whose cat crouches), and their arch. */
const waits = new Map<string, Wait>();
/** The jumps already shown (a foe's blow is answered once). */
const jumped = new WeakSet<BattleEffect>();
/** Scratch for the bursts on the cat each frame (a burst reads it at once). */
const spot: V3 = { x: 0, y: 0, z: 0 };
const over = (p: V3, up: number) => { spot.x = p.x; spot.y = p.y + up; spot.z = p.z; return spot; };

/** The mirror along the arch: a paraboloid opening down from its vertex, its focus the arch's, within the arch's feet. */
function raiseMirror(stage: DuoStage, w: Wait) {
  const g = stage.effects.gpu;
  if (!g) return;
  const flip = new pc.Quat().setFromAxisAngle(new pc.Vec3(w.geo.dir.x, 0, w.geo.dir.z), 180);
  w.mirror = g.volume({ shape: 'paraboloid', mode: 'mirror', at: w.geo.at(0), rotation: flip, size: { x: w.geo.f, y: w.geo.reach * .92, z: .03 } });
  // Sparks out of the floor under it, straight up and a few degrees off true (a cone of about 2.5°, so their meeting
  // draws the caustic's cusp, not one point); they die just past the focus.
  const floor = { ...w.geo.focus, y: stage.ground(w.geo.focus.x, w.geo.focus.z) + .02 };
  const rise = 6.5, life = (w.geo.focus.y - floor.y + 2 * w.geo.f) / rise + .1;
  try {
    // In rings round the focus, the inner one well outside the body, so the rising rays and the way they bend inwards
    // both show, in front of it.
    const rim = w.geo.reach * .9, inner = Math.min(rim * .85, w.radius + .3);
    w.rain = [0, .55, 1].map(k => g.emitter(kindOf(stage, 'arco-chispa'), { at: floor, shape: 'ring', axis: UP, spread: inner + (rim - inner) * k, velocity: { x: 0, y: rise, z: 0 }, speed: .15, cone: .044, life: [life * .9, life * 1.05], rate: 640, size: 1 }));
    w.knot = g.emitter(kindOf(stage, 'arco-foco'), { at: w.geo.focus, spread: .04, speed: .05, life: [.12, .2], rate: 40, size: .8, colour: C.bolt });
  } catch { /* the engine's kinds are full: the arch alone */ }
}
function lowerMirror(w: Wait) {
  w.mirror?.remove(); w.rain.forEach(e => e.remove()); w.knot?.remove();
  delete w.mirror; w.rain = []; delete w.knot;
}
function end(w: Wait, holder: string, seconds = .35) {
  lowerMirror(w);
  w.run?.trail?.stop();
  if (!w.figure.gone) w.figure.fade(seconds);
  waits.delete(holder);
}
/** The arch bursts: splinters of gold off every stroke, a bolt down its axis. */
function shatter(stage: DuoStage, w: Wait, holder: string) {
  const [arch, bead] = w.strokes;
  for (let k = 0; k <= 1.0001; k += 1 / 48) {
    const at = arch.tip(Math.min(1, k));
    burst(stage, 'arco-esquirla', { at, count: 5, spread: .025, speed: 1.6, up: .6, life: [.6, 1.1], colour: k % (2 / 48) < 1 / 48 ? C.gold : C.deep });
  }
  burst(stage, 'arco-esquirla', { at: bead.tip(0), count: 7, spread: .03, speed: 2, up: .4, life: [.5, .9], colour: C.hot });
  w.figure.glow(1.6, 1);
  end(w, holder, .12);
}

/** The parabola of `geo` as his neon: the arch, its focus a bead, its directrix and its axis dashed (all hidden until drawn). */
function drawArch(stage: DuoStage, geo: ArcGeometry, frame: NeonFrame) {
  const figure = stage.figure('Arco voltaico · parábola', { frame });
  const { f, reach } = geo;
  const arch = figure.stroke(neonCurve(72, u => { const x = -reach + 2 * reach * u; return xy(x, f - x * x / (4 * f)); }), { radius: .028 });
  const bead = figure.stroke(neonCircle(.055, 18), { radius: .02, look: { core: C.white, halo: C.bolt } });
  const directrix = neonDashes([xy(-reach * .8, 2 * f), xy(reach * .8, 2 * f)], 9).map(d => figure.stroke(d, { radius: .013 }));
  const axis = neonDashes([xy(0, f), xy(0, .08)], 4, .5).map(d => figure.stroke(d, { radius: .009 }));
  return { figure, arch, bead, directrix, axis, strokes: [arch, bead, ...directrix, ...axis] };
}

export const staging: DuoStaging = {
  timing: { contact: T.contact, end: T.end },
  start(stage, e, reached) {
    if (!stage.fx.on) return;
    ensure(stage);
    const target = reached.find(f => !f.party), holder = e.stalker ? stage.fighter(e.stalker) : stage.wearer('papagato');
    const math = stage.wearer('matemagico') ?? stage.party()[0];
    if (!target || !holder || !math) return;
    const old = waits.get(holder.id);
    if (old) end(old, holder.id, .1);
    // From where she rests (not where she is this frame: she may still be settling), as the scene's run is.
    const axes = screenAxes(stage.view), small = .42;
    const geo = arcGeometry(stage.catRest(holder.id) ?? holder.feet, target, axes.facing);
    arches.set(holder.id, { prey: target.id, geo });
    // Drawn small in front of Gerard, in the camera's plane, in the arch's own shape.
    const start: NeonFrame = { at: add(add(math.hand ?? math.chest, UP, .95), axes.facing, .5), right: axes.right, up: axes.up, facing: axes.facing, scale: small };
    const { figure, arch, bead, directrix, axis, strokes } = drawArch(stage, geo, start);
    stage.draw(figure, [arch], T.draw);
    stage.draw(figure, directrix, T.directrix, { delay: T.draw });
    stage.draw(figure, [...axis, bead], T.focus, { delay: T.draw + T.directrix, each: i => { if (i === axis.length) stage.cue('mark-set', { volume: .6 }); } });
    stage.cue('charge', { volume: .45 });
    const w: Wait = { target: target.id, figure, strokes, geo, charged: true, fur: 0, knotted: 0, gpu: stage.effects.gpu, rain: [], radius: target.radius };
    waits.set(holder.id, w);
    // It rises and turns until its axis stands over the prey and the focus sits on its chest, growing to its size.
    const goal = geo.frame, from = start.at, turn = T.settle - T.rise;
    stage.fx.after(T.rise, () => figure.animate(turn, t => {
      const k = ease(t / turn), lift = Math.sin(k * Math.PI) * .7;
      const right = norm(mix(axes.right, goal.right!, k)), up = norm(mix(axes.up, UP, k)), facing = norm(cross(right, up));
      figure.place({ at: add(mix(from, goal.at, k), UP, lift), right, up: cross(facing, right), facing, scale: small + (1 - small) * k });
    }));
    stage.cue('whine', { delay: T.rise, volume: .55, pan: stage.pan(target.chest) });
  },
  land(stage, e, reached) {
    const holder = e.stalker, w = holder ? waits.get(holder) : undefined, target = reached.find(f => !f.party);
    if (!w || !target) return;
    // It settles: a flash along the arch, the focus lights on the chest, and the mirror stands along it.
    w.figure.place(w.geo.frame); w.figure.glow(1.3, .8);
    stage.hit(target.id, GOLD_FLASH, .9); stage.shake(.18); stage.pulse(.25, .55, .1); stage.punch(.3);
    burst(stage, 'arco-foco', { at: w.geo.focus, count: 1, spread: .01, life: [.25, .32], size: 3, colour: C.white, light: { intensity: 3, range: 3, colour: C.bolt } });
    raiseMirror(stage, w);
    stage.cue('zap', { volume: .6, pan: stage.pan(target.chest) });
  },
  hold(stage, dt, state, playing) {
    if (!waits.size) return;
    // (Deleting the entry being visited, as `end` does, is safe in a Map's own iteration.)
    for (const [holder, w] of waits) {
      const ally = state.allies.find(a => a.id === holder);
      const running = playing?.pounceDual?.id === 'arco-voltaico' && playing.actor === holder ? playing : undefined;
      // Another fight, or the moment lost (the wearer fell, took Papagato off, the fight ended first), or the pounce come and gone.
      if (w.gpu !== stage.effects.gpu || (!ally?.stalk && !running && !w.run)) { end(w, holder); continue; }
      if (!ally?.stalk && w.run && w.run.effect !== playing) { end(w, holder); continue; }
      // The charge jumped (a foe's blow found her): the mirror is dark from now on (`struck` drew the jump).
      // (While the blow that finds her plays, the mirror stays up until the jump is shown.)
      const jumping = playing?.arcDischarge?.from === holder && !jumped.has(playing);
      if (ally?.stalk && ally.stalk.charged === false && w.charged && !jumping) { w.charged = false; lowerMirror(w); w.figure.glow(.5); }
      const cat = stage.cat(holder);
      // Her fur stands with static while she waits charged, and a faint knot of the charge sits on her back.
      if (cat && w.charged && !running && (w.fur -= dt) <= 0) {
        w.fur = .05;
        burst(stage, 'arco-estatica', { at: over(cat, .2), count: 10, chain: 3, spread: .17, speed: 1, life: [.1, .2], colour: Math.random() < .7 ? C.bolt : C.hot });
        if (++w.knotted % 3 === 0) burst(stage, 'arco-foco', { at: over(cat, .26), count: 1, spread: .01, life: [.16, .24], size: 1.1, colour: C.bolt });
      }
      if (!running) continue;
      // The pounce: she runs the arch (the scene moves her, `arcRun`), a trail of plasma behind her.
      if (!w.run || w.run.effect !== running) {
        lowerMirror(w);
        // Its prey fell: she goes for another, and the arch stands over that one at once (the same one the scene runs, `arcFor`).
        const prey = running.target ? stage.fighter(running.target) : undefined;
        if (prey && running.target !== w.target) {
          w.figure.fade(.15);
          w.geo = arcFor(holder, prey.id, () => arcGeometry(stage.catRest(holder) ?? cat ?? prey.feet, prey, screenAxes(stage.view).facing)); w.target = prey.id;
          const fresh = drawArch(stage, w.geo, w.geo.frame);
          for (const s of fresh.strokes) s.show(0, 1);
          w.figure = fresh.figure; w.strokes = fresh.strokes;
        }
        w.run = { effect: running, t: 0, head: new pc.Vec3(), shed: 0, rim: 0 };
        if (cat) w.run.head.set(cat.x, cat.y + .2, cat.z);
        // Wide and bright: at the fight's distance her flight is the trail as much as her body.
        w.run.trail = stage.effects.trails.follow(w.run.head, { colour: [C.hot, C.bolt], width: .16, life: .34, intensity: 5, additive: 1, core: .8, taper: 1.2 });
        w.figure.glow(running.pounceDual?.half ? .7 : 1.4, .4);
        stage.cue('whine', { volume: .7, pan: stage.pan(w.geo.focus) });
      }
      const run = w.run;
      run.t += dt;
      if (cat) run.head.set(cat.x, cat.y + .22, cat.z);
      const flying = cat && run.t > ARC_POUNCE.foot - .05 && run.t < ARC_POUNCE.contact;
      if (flying && (run.shed -= dt) <= 0) {
        run.shed = .016;
        burst(stage, 'arco-plasma', { at: over(cat, .2), count: 14, spread: .07, speed: .5, life: [.3, .55], colour: Math.random() < .3 ? C.white : C.bolt });
      }
      // A gold rim of light on her head as she flies, so she reads against the arch.
      if (flying && (run.rim -= dt) <= 0) {
        run.rim = .03;
        burst(stage, 'arco-foco', { at: over(cat, .3), count: 1, spread: .02, life: [.08, .12], size: 1.1, colour: C.gold });
      }
      if (run.t > ARC_POUNCE.contact + .15) run.trail?.stop();
    }
  },
  struck(stage, e) {
    // A foe's blow found the one waiting charged: the arch swings its focus onto it, and an arc leaves its vertex for it.
    const d = e.arcDischarge;
    if (d && !jumped.has(e)) {
      jumped.add(e);
      const w = waits.get(d.from), foe = stage.fighter(d.target);
      if (!w || !foe) return;
      // It swings about its vertex until its axis points at the foe: the focus goes to it, then comes back.
      const vertex = w.geo.at(0), aim = norm(sub(foe.chest, vertex)), away = { x: -aim.x, y: -aim.y, z: -aim.z }, f = w.geo.f;
      w.figure.animate(.6, t => {
        const k = Math.sin(clamp01(t / .6) * Math.PI) ** .6;
        const up = norm(mix(UP, away, k * .9)), r0 = w.geo.dir, along = r0.x * up.x + r0.y * up.y + r0.z * up.z;
        const right = norm(sub(r0, { x: up.x * along, y: up.y * along, z: up.z * along }));
        w.figure.place({ at: add(vertex, up, -f), right, up, facing: cross(right, up), scale: 1 });
      }, () => w.figure.place(w.geo.frame));
      stage.fx.after(.2, () => {
        const pts = jag(vertex, foe.chest, .18, 4);
        bolt(stage, pts, { step: .004, life: .32, size: 1.6 });
        stage.hit(foe.id, BOLT_FLASH, 1.3); stage.shake(.35); stage.pulse(.4, .6, .15);
        burst(stage, 'arco-foco', { at: foe.chest, count: 1, spread: .01, life: [.18, .24], size: 2.4, colour: C.hot, light: { intensity: 2.6, range: 2.6, colour: C.bolt } });
        stage.cue('snap', { pan: stage.pan(foe.chest) });
      });
      w.figure.glow(1.5, .9);
      w.charged = false;
      stage.fx.after(.25, () => { lowerMirror(w); w.figure.glow(.5); });
      return;
    }
    // The cat lands on the focus: a jagged bolt down the axis, and the arch bursts into splinters of gold.
    if (e.pounceDual?.id !== 'arco-voltaico') return;
    const w = waits.get(e.actor), target = e.target ? stage.fighter(e.target) : undefined;
    if (!target) { if (w) end(w, e.actor); return; }
    // The bolt comes down the axis onto the drawn focus, in front of the body, and on into the chest.
    const half = !!e.pounceDual.half, top = w ? w.geo.at(0) : add(target.chest, UP, 1.2), focus = w ? w.geo.focus : target.chest;
    bolt(stage, [...jag(add(top, UP, .25), focus, .2, 4), target.chest], { step: .002, life: .36, size: half ? 1.2 : 1.9 });
    for (let k = 0; k < 3; k++) bolt(stage, jag(focus, add(focus, { x: rand(-1, 1), y: rand(-.6, .2), z: rand(-1, 1) }, .7), .25, 2), { delay: .03, life: .22, size: .9, colour: C.bolt });
    // The contact is already loud (the pounce's own crítico, its shake, a reaction's flash): no white-out on top of
    // them, so the bolt and the splinters read in the very frame she lands.
    burst(stage, 'arco-foco', { at: focus, count: 1, spread: .01, life: [.12, .16], size: half ? 1.1 : 1.5, colour: C.hot, light: { intensity: half ? 1.3 : 1.8, range: 3, colour: C.bolt } });
    // Plasma thrown wide and late, after the frame she lands: a ball of it on the contact is only a white blur.
    stage.fx.after(.06, () => burst(stage, 'arco-plasma', { at: focus, count: half ? 40 : 80, spread: .1, speed: 4.2, life: [.25, .55], colour: C.bolt }));
    // The crítico already lights the prey white: a touch of the bolt's yellow over it, no more.
    stage.hit(target.id, BOLT_FLASH, half ? .35 : .5);
    if (!e.reaction) stage.pulse(.5, half ? .35 : .5, .04);
    stage.cue('snap', { pan: stage.pan(target.chest) }); stage.cue('zap', { delay: .03, volume: .8 });
    if (w) shatter(stage, w, e.actor);
  },
};
