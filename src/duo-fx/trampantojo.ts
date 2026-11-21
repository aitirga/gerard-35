import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Trampantojo (Confusión + Cortina): the cortina in front of an ally has a figure painted on it, and
 * the foe that breaks it is left confused (`cortinaSay` in src/battle.ts). A trompe-l'œil: Colorista
 * throws a handful of blue powder up a step beside the ally, and Bip projects their figure onto it,
 * a cyan bar sweeping down it row by row as each row of powder takes the shape: a double of them made
 * of horizontal lines of powder, like an image on a screen. While the cortina stands the double stays
 * there faintly, its rows renewed from the top down by the same rolling cyan bar, now and then a few
 * of them torn sideways. The foe that goes through the cortina gets the double thrown over it: it
 * comes apart into blue powder and cyan static, flying at whoever struck.
 */
const BLUE = '#617ce2', DEEP = '#3d5fe0', PALE = '#a9b8f4', CYAN = '#4fe0ff', ICE = '#d8fbff';
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
const flat = (v: V3): V3 => { const d = Math.hypot(v.x, v.z) || 1; return { x: v.x / d, y: 0, z: v.z / d }; };

const TIMING = { contact: .85, end: 1.6 };
/** Rows the figure is drawn in, and the double as it holds: seconds to renew it all, powder a metre of row. */
const ROWS = 28;
const HOLD = { sweep: 2.8, density: 32, life: 3.1 };

/**
 * The double's own powder: matte like Colorista's, faint and a little lit, so it reads as a picture
 * of someone and not someone. Defined the first time it is needed; if the engine has no room for one
 * more kind, the duals' own brush stands in.
 */
const GHOST: GpuKind = {
  shape: 'powder', drag: 9, gravity: 0, curl: .12, response: 1, size: [.034, .03], sizeJitter: .5,
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.9, 1.7, 1.45], fadeIn: .1, fadeOut: .4, additive: .4, opacity: .78, core: 0, flicker: .12,
  // It answers force fields: the shatter's pull (`shatter`) carries it off whole.
};
let ghost: string | undefined;
function ghostKind(stage: DuoStage) {
  if (ghost) return ghost;
  const g = stage.effects.gpu;
  try { if (g && !g.get('trampantojo-ghost')) g.define('trampantojo-ghost', GHOST); ghost = 'trampantojo-ghost'; } catch { ghost = 'brush'; }
  return ghost;
}

/** Where a standing figure `height` tall is filled at `h` (0 its feet, 1 the top of its head): spans across it, in its heights. */
function spans(h: number): [number, number][] {
  if (h > .855) { const d = .072 ** 2 - (h - .928) ** 2; return d > 0 ? [[-Math.sqrt(d), Math.sqrt(d)]] : []; }
  if (h > .82) return [[-.03, .03]];
  const out: [number, number][] = [];
  if (h > .5) {
    const k = Math.min(1, (h - .5) / .26), w = .088 + .042 * Math.sqrt(k) - (h > .79 ? (h - .79) * 1.4 : 0);
    out.push([-w, w]);
  } else if (h > .44) out.push([-.1, .1]);
  else { const w = .088 - (.44 - h) * .05; out.push([-w, -.012], [.012, w]); }
  // The arms, hanging a little apart from the body, shoulder to hand.
  if (h > .43 && h < .79) { const x = .145 + (.79 - h) * .04, w = .032 - Math.max(0, h - .74) * .2; out.push([-x - w, -x + w], [x - w, x + w]); }
  return out;
}

/** Each ally with the painted cortina: which side its double stands on, the row being renewed, and when it next tears. */
interface Double { side: number; row: number; clock: number; tearIn: number; breaking?: Breaking }
/** The cortina is gone from the fight's word: since when, and whether the blow that broke it is on screen (it shatters as that lands, `struck`). */
interface Breaking { since: number; coming?: boolean }
/**
 * Seconds to wait, once the cortina is gone, for the blow that broke it to show (the fight's word can
 * come a frame ahead of it); without one it was not broken (its rounds ran out) and it sifts down. And
 * how long a blow on screen may take to land before the double goes anyway.
 */
const GRACE = .35, LANDS = 1.4;
const doubles = new Map<string, Double>();
let now = 0, lastPlaying: BattleEffect | undefined, playingSince = 0;
/** Whether `e` is the blow through `id`'s painted cortina, and who dealt it. */
const breaker = (e: BattleEffect | undefined, id: string) => e && (e.fooled || e.cortina?.broke?.includes(id)) ? e.fooled ?? e.cortina?.rebufo ?? e.actor : undefined;
const quiet = new Map<string, number>();

/**
 * A step beside the ally, on the side away from the foes: the cortina itself stands between them and
 * the foes (src/powder-fx.ts `cortina`), so the double stands clear of it, where it can be seen.
 */
function sideOf(stage: DuoStage, ally: DuoFighter) {
  const right = flat(screenAxes(stage.view).right), across = (p: V3) => (p.x - ally.feet.x) * right.x + (p.z - ally.feet.z) * right.z;
  const lean = stage.foes().reduce((s, f) => s + across(f.feet), 0);
  return lean > 0 ? -1 : 1;
}
/** The double's frame: its feet, its right and up on the screen, how tall. */
function frameOf(stage: DuoStage, ally: DuoFighter, side: number) {
  const { right, up, facing } = screenAxes(stage.view), across = flat(right), height = Math.max(1, ally.height);
  const step = Math.max(.8, ally.radius * 1.4 + .5);
  // A little further from the camera than they are, so whoever stands in front of them does not hide it.
  const feet = add(add(add(ally.feet, across, side * step), flat(facing), -.35), { x: 0, y: 1, z: 0 }, .02);
  return { feet, right, up, height };
}
/** One row of the figure in powder (`density` grains a metre), and where it runs across. */
function row(stage: DuoStage, f: ReturnType<typeof frameOf>, j: number, o: { kind: string; density: number; life: number; colour?: string; shift?: number; size?: number }) {
  const h = (j + .5) / ROWS, y = add(f.feet, f.up, h * f.height);
  for (const [x0, x1] of spans(h)) {
    const a = add(y, f.right, (x0 + (o.shift ?? 0)) * f.height), b = add(y, f.right, (x1 + (o.shift ?? 0)) * f.height);
    stage.fx.burst(o.kind, { at: a, to: b, shape: 'line', count: Math.max(2, Math.round((x1 - x0) * f.height * o.density)), life: [o.life * .9, o.life], colour: o.colour ?? (j % 2 ? DEEP : BLUE), size: o.size ?? 1 });
  }
}
/** Bip's bar across the row being drawn: a thin line of cyan, wider than the figure. */
function scanBar(stage: DuoStage, f: ReturnType<typeof frameOf>, j: number, o: { count: number; life: number; size: number; colour?: string }) {
  const y = add(f.feet, f.up, (j + .5) / ROWS * f.height);
  stage.fx.line(add(y, f.right, -.24 * f.height), add(y, f.right, .24 * f.height), o.colour ?? CYAN, { count: o.count, life: o.life, size: o.size });
}

function start(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const ally = reached[0];
  if (!ally || !stage.fx.on) return;
  const side = sideOf(stage, ally), f = frameOf(stage, ally, side), kind = ghostKind(stage), C = TIMING.contact;
  doubles.set(ally.id, { side, row: 0, clock: 0, tearIn: 1.4 });
  quiet.set(ally.id, now + C);
  const chest = add(f.feet, f.up, f.height * .6);
  // Colorista's handful, thrown up to where the double will stand: it puffs and hangs.
  const painter = stage.wearer('prismatico'), from = painter?.hand ?? painter?.chest;
  if (from) {
    const d = sub(chest, from), t = .16;
    stage.fx.burst('paintthrow', { at: from, count: 50, spread: .06, velocity: { x: d.x / t, y: d.y / t + 1, z: d.z / t }, speed: .4 * len(d), cone: .05, life: [t, t * 1.1], colour: BLUE });
  }
  stage.fx.after(.16, () => {
    stage.fx.burst('brush', { at: chest, count: 90, spread: f.height * .22, speed: .5, life: [.55, .8], colour: BLUE, size: 1.2 });
    stage.fx.burst('brush', { at: add(chest, f.up, -f.height * .3), count: 50, spread: f.height * .2, speed: .4, life: [.5, .7], colour: DEEP, size: 1.1 });
  });
  stage.cue('poof', { delay: .14 });
  // Bip's projector: faint lines from it to the four corners of the picture, then its bar sweeping down,
  // each row of powder taking the figure's shape as the bar passes.
  const tech = stage.wearer('tecnopata'), lamp = stage.bip() ?? tech?.hand ?? tech?.chest;
  if (lamp) stage.fx.after(.24, () => {
    for (const [x, y] of [[-.26, 1.02], [.26, 1.02], [-.26, 0], [.26, 0]]) stage.fx.line(lamp, add(add(f.feet, f.right, x * f.height), f.up, y * f.height), CYAN, { count: 40, life: .56, size: .9 });
    stage.fx.burst('flare', { at: lamp, count: 1, spread: .01, life: [.4, .5], colour: CYAN, light: { intensity: 1.6, range: 2 } });
  });
  const sweep = .46;
  for (let j = ROWS - 1, i = 0; j >= 0; j--, i++) stage.fx.after(.28 + i * sweep / ROWS, () => {
    scanBar(stage, f, j, { count: 22, life: .09, size: 1.5 });
    row(stage, f, j, { kind, density: 58, life: C + 1.2 - .28 - i * sweep / ROWS });
  });
  stage.cue('glitch', { delay: .3 });
}

function land(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const ally = reached[0];
  stage.pulse(.45, .35, 0); stage.shake(.08); stage.punch(.12); stage.cue('mark-set');
  if (!ally || !stage.fx.on) return;
  const d = doubles.get(ally.id) ?? { side: sideOf(stage, ally), row: 0, clock: 0, tearIn: 1.4 };
  const f = frameOf(stage, ally, d.side);
  stage.hit(ally.id, [.6, .7, 1], .5);
  // The picture steadies: one bright sweep of the whole figure, top to bottom, and a pale outline of light on it.
  for (let j = ROWS - 1, i = 0; j >= 0; j--, i++) stage.fx.after(i * .005, () => {
    if (j % 2 === 0) scanBar(stage, f, j, { count: 16, life: .12, size: 1.3, colour: ICE });
    row(stage, f, j, { kind: 'glyph', density: 14, life: .3, colour: PALE, size: 1.2 });
  });
  stage.fx.burst('twinkle', { at: add(f.feet, f.up, f.height * .93), count: 6, spread: .1, life: [.3, .5], colour: CYAN });
}

/** The cortina is gone: the double comes apart over whoever went through it, or, if no one did, falls as dust. */
function shatter(stage: DuoStage, f: ReturnType<typeof frameOf>, striker: DuoFighter | undefined) {
  const chest = add(f.feet, f.up, f.height * .55);
  if (!striker) {
    // Nobody went through it: the picture slumps and sifts down as dust.
    const g = stage.effects.gpu;
    if (g?.active) { const field = g.field({ at: chest, axis: { x: 0, y: 1, z: 0 }, radius: f.height * .9, lift: -9, turbulence: 1.5 }); stage.fx.after(1.2, () => field.remove()); }
    for (let j = 0; j < ROWS; j += 2) row(stage, f, j, { kind: 'fleck', density: 14, life: 1.1 });
    return;
  }
  const to = striker.chest, d = sub(to, chest), dist = len(d) || 1, t = .4;
  /** Where whoever struck is now: it is still drawing back from its blow while the powder flies. */
  const target = () => stage.fighter(striker.id)?.chest ?? to;
  // The double itself is carried off: a pull gathers its powder a moment where it stands, then runs
  // with it to whoever struck, so the very figure that stood there is what lands on them.
  const g = stage.effects.gpu;
  if (g?.active) {
    const field = g.field({ at: chest, axis: { x: d.x / dist, y: d.y / dist, z: d.z / dist }, radius: f.height * 1.05, pull: 55, lift: 14, turbulence: 2 });
    const gather = .16;
    for (let i = 1; i <= 12; i++) stage.fx.after(gather + (t - gather) * i / 12, () => {
      const end = target(), p = add(chest, sub(end, chest), Math.min(1, (i / 12) ** .8));
      field.at.set(p.x, p.y, p.z); field.radius = f.height * (1.05 + .3 * i / 12); field.pull = 40; field.lift = 42;
    });
    stage.fx.after(t + .1, () => field.remove());
    // While it flies the powder lets go of the air (less drag), so none of the figure is left standing behind.
    if (ghost === 'trampantojo-ghost') {
      try { g.define(ghost, { ...GHOST, drag: 2.2 }); } catch { /* it keeps its drag */ }
      stage.fx.after(t + .25, () => { try { g.define('trampantojo-ghost', GHOST); } catch { /* as it was */ } });
    }
  }
  // Every row thrown at once, the bottom last, at whoever struck: matte blue, and Bip's static with it.
  for (let j = 0; j < ROWS; j++) stage.fx.after((ROWS - j) * .004, () => {
    const h = (j + .5) / ROWS, y = add(f.feet, f.up, h * f.height);
    for (const [x0, x1] of spans(h)) {
      const a = add(y, f.right, x0 * f.height), b = add(y, f.right, x1 * f.height), n = Math.max(2, Math.round((x1 - x0) * f.height * 34));
      stage.fx.burst('paintthrow', { at: a, to: b, shape: 'line', count: n, velocity: { x: d.x / t, y: d.y / t + 1.4, z: d.z / t }, speed: .3 * dist, cone: .32, life: [t * .9, t * 1.3], colour: j % 2 ? DEEP : BLUE });
      if (j % 3 === 0) stage.fx.burst('fleck', { at: a, to: b, shape: 'line', count: Math.ceil(n / 3), speed: 1, up: .5, life: [.8, 1.3], colour: BLUE });
    }
  });
  stage.fx.burst('bipzap', { at: chest, count: 40, spread: f.height * .2, velocity: { x: d.x / dist * 3, y: 1, z: d.z / dist * 3 }, speed: 2.2, life: [.2, .5] });
  for (let i = 0; i < 5; i++) stage.fx.after(i * .03, () => scanBar(stage, f, Math.floor(Math.random() * ROWS), { count: 22, life: .1, size: 1.6 }));
  // It lands on them: a cloud of blue, a flicker of cyan round their head.
  stage.fx.after(t, () => {
    const to = target(), { facing } = screenAxes(stage.view), head = add(to, { x: 0, y: 1, z: 0 }, Math.max(.2, striker.height * .3));
    stage.fx.burst('brush', { at: to, count: 70, spread: Math.max(.25, striker.radius * .7), speed: 1.4, life: [.5, .9], colour: BLUE, size: 1.2 });
    stage.fx.ring(head, { x: 0, y: 1, z: 0 }, Math.max(.3, striker.radius * .8), CYAN, { count: 60, around: 3, life: .6, size: 1.3, light: 1.6 });
    stage.fx.ring(to, facing, Math.max(.35, striker.radius), ICE, { count: 50, outward: 2.2, life: .3, size: 1.2 });
    stage.hit(striker.id, [.5, .85, 1], 1);
    stage.shake(.18);
  });
  stage.pulse(.5, .3, 0); stage.cue('glitch');
}

function hold(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  now += dt;
  if (playing !== lastPlaying) { lastPlaying = playing; playingSince = now; }
  if (!stage.fx.on) return;
  const kind = ghostKind(stage);
  for (const [id, d] of doubles) {
    const unit = state.allies.find(a => a.id === id), ally = stage.fighter(id);
    if (!ally || !unit) { doubles.delete(id); continue; }
    const f = frameOf(stage, ally, d.side);
    // Broken: the blow that went through it lands a moment after it starts; the double stands until then.
    if (!d.breaking && !(unit.decoy && unit.cortina !== undefined && unit.hp > 0)) d.breaking = { since: now };
    const b = d.breaking;
    if (b && !b.coming && breaker(playing, id)) b.coming = true;
    if (b && now - b.since > (b.coming ? LANDS : GRACE)) {
      doubles.delete(id);
      if (unit.hp > 0) shatter(stage, f, undefined);
      continue;
    }
    if ((quiet.get(id) ?? 0) > now) continue;
    // Its rows renewed from the top down, the bar rolling over them.
    d.clock += dt;
    const step = HOLD.sweep / ROWS;
    while (d.clock >= step) {
      d.clock -= step;
      const j = ROWS - 1 - d.row;
      row(stage, f, j, { kind, density: HOLD.density, life: HOLD.life });
      if (d.row % 3 === 0) scanBar(stage, f, j, { count: 10, life: .14, size: 1.1 });
      d.row = (d.row + 1) % ROWS;
    }
    // Now and then a few rows slip sideways, as a projection does.
    if ((d.tearIn -= dt) <= 0) {
      d.tearIn = 1.2 + Math.random() * 1.6;
      const j = 2 + Math.floor(Math.random() * (ROWS - 5)), shift = (Math.random() < .5 ? -1 : 1) * (.04 + Math.random() * .05);
      for (let k = 0; k < 3; k++) row(stage, f, j + k, { kind: 'glyph', density: 18, life: .14, colour: k === 1 ? ICE : CYAN, shift, size: 1.1 });
    }
  }
  // A painted cortina this scene did not see raised (a moment loaded straight into it) gets its double too.
  const raising = playing?.dual?.id === 'trampantojo' && now - playingSince < TIMING.contact ? playing.target : undefined;
  for (const a of state.allies) if (a.decoy && a.cortina !== undefined && a.hp > 0 && !doubles.has(a.id) && a.id !== raising) {
    const ally = stage.fighter(a.id);
    if (ally) doubles.set(a.id, { side: sideOf(stage, ally), row: 0, clock: 0, tearIn: 1 });
  }
}

/** A blow lands: if it went through a painted cortina, the double comes apart over whoever dealt it, now. */
function struck(stage: DuoStage, e: BattleEffect) {
  if (!stage.fx.on) return;
  for (const [id, d] of doubles) {
    const by = breaker(e, id), ally = stage.fighter(id);
    if (!by || !ally) continue;
    doubles.delete(id);
    const striker = stage.fighter(by);
    shatter(stage, frameOf(stage, ally, d.side), striker && !striker.party ? striker : undefined);
  }
}

export const staging: DuoStaging = { timing: TIMING, start, land, hold, struck };
