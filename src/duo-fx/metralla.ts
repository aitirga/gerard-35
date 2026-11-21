import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Metralla (Explosión + Zarpazo sangriento, dúo mayor). Bip dives into the middle of the foes while
 * Haru's claws are thrown into it, and it locks every foe in its cyan sights; the core packs tight,
 * and it goes off as shrapnel: a ball of Haru's claws, orange and hot, with Bip's cyan bits, that
 * tears through every foe and lodges in them. While Metralla holds (`timed.metralla`), the fragments
 * stay in the wounds and glint; a physical blow that cashes the wound in (and leaves it open) makes
 * them flare and the cut pulls wider instead of closing. Field-wide and heavy, never a dome nor a
 * fall from above (Sobrecalentamiento, Bombardeo orbital).
 */
const C = { cyan: '#4fe0ff', ice: '#e8fbff', orange: '#f0954a', hot: '#ffc27a', cream: '#fff1dc', wound: '#c8301e', smoke: '#5b524c' } as const;

const KINDS = {
  // A fragment lodged in a foe: a still splinter that catches the light now and then. First, so it
  // is the one the engine takes if it has room for only one more kind.
  'metralla-glint': {
    shape: 'shard', drag: 30, gravity: 0, curl: 0, response: 0, size: [.034, .026], sizeJitter: .35, spin: 40,
    colours: ['#ffd9a8', '#ff9a40', '#e0702a'], intensity: [5, 3.6, 2.2], middle: .3, fadeIn: .05, fadeOut: .45, additive: .9, flicker: .45, core: .3,
  },
  // Haru's claws as shrapnel: thin hooked slivers, hot as they leave, cooling to dark iron; they
  // stretch out with their speed, hit hard, glance off the floor and lodge in whoever they meet.
  'metralla-shard': {
    shape: 'shard', drag: .3, gravity: 8, curl: .06, response: .2, collide: true, bounce: .25, friction: .6, stick: .6, stickTime: 2,
    size: [.028, .02], sizeJitter: .55, stretch: .065, aspect: .3, spin: 700,
    colours: ['#ffd6a0', C.orange, '#4a2010'], intensity: [3.6, 2, .7], middle: .15, fadeOut: .3, additive: .25, core: .4, life: [.7, 1.2],
  },
} satisfies Record<string, GpuKind>;

const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const flat = (a: V3, b: V3) => { const x = b.x - a.x, z = b.z - a.z, d = Math.hypot(x, z) || 1; return { x: x / d, y: 0, z: z / d, d }; };

type Name = keyof typeof KINDS;
/** Which of its kinds each fight engine took (it holds a fixed number of kinds, shared by every look). */
const taken = new WeakMap<object, Set<Name>>();
function ensure(stage: DuoStage): Set<Name> {
  const g = stage.effects.gpu;
  if (!g) return new Set();
  let have = taken.get(g);
  if (!have) {
    have = new Set();
    for (const [name, kind] of Object.entries(KINDS) as [Name, GpuKind][]) {
      try { if (!g.get(name)) g.define(name, kind); have.add(name); } catch { /* the engine's kinds are full: `FALLBACK` draws it */ }
    }
    taken.set(g, have);
  }
  return have;
}
/** The nearest shared kind, tinted, for one of its own the engine had no room for: never a burst of a kind it does not know. */
const FALLBACK: Record<Name, { kind: string; colour: string }> = { 'metralla-shard': { kind: 'needle', colour: C.orange }, 'metralla-glint': { kind: 'glyph', colour: C.hot } };
function shards(stage: DuoStage, name: Name, o: Parameters<DuoStage['fx']['burst']>[1]) {
  if (ensure(stage).has(name)) { stage.fx.burst(name, o); return; }
  const f = FALLBACK[name];
  stage.fx.burst(f.kind, { ...o, colour: o.colour ?? f.colour });
}
/** Blood flung along `dir` from `at`: the statuses' own spray if it is defined, dark flecks if not. */
function blood(stage: DuoStage, at: V3, dir: V3, count: number) {
  const g = stage.effects.gpu, spray = !!g?.get('bloodspray');
  stage.fx.burst(spray ? 'bloodspray' : 'fleck', { at, count, spread: .08, velocity: { x: dir.x * 3.6, y: 2.1, z: dir.z * 3.6 }, cone: .7, speed: 1.6, life: [.7, 1.2], ...spray ? {} : { colour: '#8a0d16' } });
}
/** Where the blast goes off: in among the foes, a little up and towards the camera. */
function blastPoint(stage: DuoStage, foes: readonly DuoFighter[]): V3 {
  const n = Math.max(1, foes.length), mid = foes.reduce((s, f) => add(s, f.chest, 1 / n), { x: 0, y: 0, z: 0 });
  const { facing } = screenAxes(stage.view);
  return add(add(mid, UP, .35), facing, .9);
}
/** Bip's cut corners round a foe: its sights, locked. */
function lock(stage: DuoStage, f: DuoFighter, life: number) {
  const { right, up, facing } = screenAxes(stage.view), c = add(f.chest, facing, f.radius * .5 + .2);
  const w = Math.max(.35, f.radius * .7 + .15), h = Math.max(.45, f.height * .42);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const corner = add(add(c, right, sx * w), up, sy * h);
    stage.fx.line(corner, add(corner, right, -sx * .2), C.cyan, { count: 12, life, size: 1.6 });
    stage.fx.line(corner, add(corner, up, -sy * .2), C.cyan, { count: 12, life, size: 1.6 });
  }
  stage.fx.burst('bipzap', { at: c, count: 8, spread: .2, speed: .8, life: [.2, .4] });
}

const timing = { contact: 1, end: 2.2 };
/** Where this dual's blast went off, for its landing. */
let blastAt: V3 | undefined;

function start(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  ensure(stage);
  const foes = reached.filter(f => !f.party);
  if (!foes.length || !stage.fx.on) return;
  const B = blastPoint(stage, foes), { facing } = screenAxes(stage.view), T = timing.contact;
  blastAt = B;
  const tech = stage.wearer('tecnopata'), cat = stage.wearer('papagato');
  const bip = stage.bip() ?? (tech ? add(tech.chest, UP, .9) : add(B, { x: 0, y: 2.4, z: 0 }));
  // Bip dives into the middle of them, throwing off sparks.
  stage.effects.trails.comet(bip, B, ['#ffffff', C.cyan], .45, { arc: .5, width: .09, life: .45, intensity: 3, core: .6 });
  for (let i = 1; i <= 6; i++) stage.fx.after(.45 * i / 6, () => {
    const u = 1 - (1 - i / 6) ** 1.6, p = { x: bip.x + (B.x - bip.x) * u, y: bip.y + (B.y - bip.y) * u + Math.sin(u * Math.PI) * .5, z: bip.z + (B.z - bip.z) * u };
    stage.fx.burst('bipzap', { at: p, count: 8, spread: .05, speed: 1.2, life: [.2, .45] });
  });
  // Haru's claws are thrown in after it: three orange slashes arcing into the core.
  const from = cat?.hand ?? cat?.chest;
  if (from) [0, 1, 2].forEach(i => stage.effects.trails.comet(from, add(B, UP, (i - 1) * .12), [C.cream, C.orange], .36, { arc: .6 + i * .3, bend: (i - 1) * .4, width: .06, life: .4, intensity: 2.6, core: .5, delay: .12 + i * .05 }));
  // Its sights on every foe.
  foes.forEach((f, j) => stage.fx.after(.22 + j * .06, () => lock(stage, f, T - .22 - j * .06)));
  // The core packs tight: the claws and the bits wound round it, closing in, faster each beat.
  [.45, .62, .76, .86].forEach((at, k) => stage.fx.after(at, () => {
    stage.fx.ring(B, facing, .95 - k * .18, k % 2 ? C.orange : C.cyan, { count: 70, outward: -1.8 - k * .6, around: (k % 2 ? -1 : 1) * (2 + k), life: .22, size: 1.4 });
    stage.fx.burst('bloom', { at: B, count: 1, spread: .02, life: [.16, .22], colour: k % 2 ? C.hot : C.cyan, size: .22 + k * .1, light: { intensity: 1.5 + k, range: 2.5 + k * .5, colour: C.cyan } });
    shards(stage, 'metralla-shard', { at: B, count: 14, shape: 'ring', axis: facing, spread: .5 - k * .08, outward: -1.4, around: 4, life: [.18, .24], size: .8 });
  }));
  stage.fx.after(.92, () => stage.fx.ring(B, facing, .25, '#ffffff', { count: 60, outward: -2.6, life: .1, size: 1.6 }));
  // It goes off just before the numbers: a ball of claws and bits, a ring of air, dark dust along the floor.
  stage.fx.after(T - .04, () => {
    const floor = { x: B.x, y: stage.ground(B.x, B.z) + .06, z: B.z };
    stage.fx.burst('bloom', { at: B, count: 1, spread: .02, life: [.2, .28], colour: C.cyan, size: 1, light: { intensity: 5, range: 7, colour: C.ice } });
    stage.fx.burst('flare', { at: B, count: 2, spread: .1, life: [.14, .22], colour: C.hot });
    shards(stage, 'metralla-shard', { at: B, count: 150, spread: .12, speed: 12, up: .6, life: [.7, 1.2] });
    stage.fx.burst('bipzap', { at: B, count: 180, spread: .1, speed: 8, life: [.35, .8] });
    stage.fx.burst('needle', { at: B, count: 60, spread: .1, speed: 6, life: [.4, .8], colour: C.cream });
    stage.fx.ring(B, facing, .3, C.ice, { count: 140, outward: 9, life: .26, size: 1.3 });
    stage.fx.ring(B, UP, .3, C.cyan, { count: 120, outward: 7, life: .35, size: 1.3 });
    stage.fx.burst('grit', { at: { ...floor, y: floor.y + .1 }, count: 150, shape: 'ring', spread: .5, outward: 6, up: .9, speed: .5, life: [.6, 1.1] });
    stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.4, .55], colour: C.cyan, size: 2.2 });
    // A fistful aimed straight at each foe, so every one of them is struck through.
    for (const f of foes) {
      const d = flat(B, f.chest), dy = (f.chest.y - B.y) / (d.d || 1);
      shards(stage, 'metralla-shard', { at: B, count: 40, spread: .08, velocity: { x: d.x * 16, y: dy * 16 + .6, z: d.z * 16 }, cone: .18, speed: 2, life: [.9, 1.4] });
      stage.fx.burst('bipzap', { at: B, count: 30, spread: .06, velocity: { x: d.x * 12, y: dy * 12, z: d.z * 12 }, cone: .25, speed: 2, life: [.25, .5] });
    }
  });
  // The dust settling after it.
  stage.fx.after(T + .35, () => {
    const floor = { x: B.x, y: stage.ground(B.x, B.z) + .2, z: B.z };
    stage.fx.burst('grit', { at: floor, count: 70, shape: 'ring', spread: 1.2, outward: 1.2, up: .4, speed: .3, life: [.8, 1.3], colour: C.smoke });
  });
  stage.cue('charge'); stage.cue('claw', { delay: .14 }); [.45, .62, .76, .86].forEach(at => stage.cue('clink', { delay: at }));
}

function land(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const foes = reached.filter(f => !f.party), B = blastAt ?? blastPoint(stage, foes), { right, up, facing } = screenAxes(stage.view);
  for (const f of foes) {
    const d = flat(B, f.chest), front = add(f.chest, facing, f.radius * .45 + .2), size = Math.min(1.4, Math.max(.7, f.height * .5));
    // Torn through: two of Haru's claws across them at odd angles, as shrapnel tears, not as a paw strikes.
    for (let k = 0; k < 2; k++) {
      const a = (Math.random() - .5) * 1.6 + k * 1.3, c = Math.cos(a), s = Math.sin(a);
      const axes = { right: add({ x: right.x * c, y: right.y * c, z: right.z * c }, up, s), up: add({ x: up.x * c, y: up.y * c, z: up.z * c }, right, -s) };
      stage.fx.after(k * .05, () => stage.effects.claw(add(front, up, (k - .5) * .2 * size), axes, size * (k ? .75 : 1)));
    }
    stage.hit(f.id, [1, .55, .3], 1.5);
    blood(stage, f.chest, d, 46);
    shards(stage, 'metralla-shard', { at: f.chest, count: 16, spread: f.radius * .5, velocity: { x: d.x * 3, y: 1.2, z: d.z * 3 }, cone: .9, speed: 2, life: [.7, 1.2] });
    stage.fx.burst('flare', { at: front, count: 1, spread: .05, life: [.14, .22], colour: C.hot, light: { intensity: 2.5, range: 2.5, colour: C.orange } });
    // The splinters bite into their body where it is, all over it.
    if (f.index >= 0) shards(stage, 'metralla-glint', { at: f.chest, count: 26, shape: 'surface', fighter: f.index, above: .2, outward: .02, speed: .02, life: [.5, .9], size: 1.2 });
  }
  stage.shake(.65); stage.pulse(.8, .8, .15); stage.punch(.7);
  stage.cue('crack'); stage.cue('claw-deep', { delay: .04 }); stage.cue('bleed', { delay: .12 });
}

// ── The hold: the shrapnel lodged in everyone it struck ──

/** Each foe's lodged fragments (offsets across and up its front, −1 to 1), and when they next glint. */
const lodged = new Map<string, { bits: { x: number; y: number }[]; next: number; turn: number; twinkle: number }>();
let seen: BattleEffect | undefined;
let since = 0;

function bitAt(stage: DuoStage, f: DuoFighter, b: { x: number; y: number }): V3 {
  const { right, up, facing } = screenAxes(stage.view), w = Math.max(.18, f.radius * .6), h = Math.max(.25, f.height * .3);
  return add(add(add(f.chest, right, b.x * w), up, b.y * h), facing, f.radius * .55 + .08 - Math.abs(b.x) * f.radius * .2);
}
/** The blow lands on a foe Metralla holds open: its fragments flare, pull in towards the wound, and it opens wider. */
function flare(stage: DuoStage, id: string, bled: number) {
  const f = stage.fighter(id), l = lodged.get(id);
  if (!f || f.hp <= 0) return;
  const { right, up, facing } = screenAxes(stage.view), wound = add(f.chest, facing, f.radius * .5 + .12);
  // Every splinter in them lights at once, over their whole body.
  if (f.index >= 0) shards(stage, 'metralla-glint', { at: f.chest, count: 30, shape: 'surface', fighter: f.index, above: .2, outward: .03, speed: .05, life: [.35, .55], size: 1.6 });
  for (const b of l?.bits ?? []) {
    const p = bitAt(stage, f, b);
    shards(stage, 'metralla-glint', { at: p, count: 3, spread: .02, life: [.45, .6], size: 2.6 });
    stage.fx.burst('spark', { at: p, count: 6, spread: .02, speed: 1.6, life: [.2, .4], colour: C.hot });
    stage.fx.line(p, wound, C.orange, { count: 10, life: .3, size: 1.3 });
  }
  // The cut pulls wider instead of closing: its two lips drawn apart.
  const s = Math.min(.5, .25 + bled * .03), h = Math.max(.3, f.height * .22);
  for (let k = 0; k < 3; k++) stage.fx.after(k * .05, () => {
    const off = (k + 1) * .035;
    for (const side of [-1, 1]) stage.fx.line(add(add(wound, right, side * off - s * .25), up, h), add(add(wound, right, side * off + s * .25), up, -h), k === 2 ? C.wound : C.hot, { count: 24, life: .9 - k * .15, size: 1.8 - k * .3 });
  });
  stage.fx.ring(wound, facing, .2, C.cyan, { count: 40, outward: 2.4, life: .25, size: 1.2 });
  blood(stage, wound, { x: facing.x, y: 0, z: facing.z }, 18 + Math.min(10, bled) * 4);
  stage.hit(id, [1, .6, .3], .7);
  stage.cue('clink', { delay: .02 });
}
/**
 * Any blow lands (`struck`, at its exact contact): on each foe it reached that Metralla holds open
 * (its fragments are `lodged`) and whose wound it cashed in (`bled`, or `hits[].bled` for a blow on
 * several), the fragments flare.
 */
function struck(stage: DuoStage, e: BattleEffect, reached: DuoFighter[]) {
  if (e.dual?.id === 'metralla') return;
  for (const f of reached) {
    if (f.party || !lodged.has(f.id)) continue;
    const bled = e.hits?.find(h => h.target === f.id)?.bled ?? (e.target === f.id ? e.bled : undefined);
    if (bled) flare(stage, f.id, bled);
  }
}

function hold(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  if (playing !== seen) { seen = playing; since = 0; } else since += dt;
  const ownStart = playing?.dual?.id === 'metralla' && since < timing.contact + .25;
  for (const unit of state.foes) {
    const l = lodged.get(unit.id);
    if (!unit.timed?.metralla || unit.hp <= 0) {
      if (l) {
        // Metralla is over: the fragments work loose and drop out.
        const f = stage.fighter(unit.id);
        if (f && unit.hp > 0) for (const b of l.bits) shards(stage, 'metralla-shard', { at: bitAt(stage, f, b), count: 2, spread: .02, speed: .6, life: [.8, 1.2], size: .6 });
        lodged.delete(unit.id);
      }
      continue;
    }
    const f = stage.fighter(unit.id);
    if (!f) continue;
    const mine = l ?? { bits: Array.from({ length: 5 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 1.6 - .8 })), next: 0, turn: 0, twinkle: .6 + Math.random() };
    if (!l) lodged.set(unit.id, mine);
    if (ownStart) continue;
    // One fragment a moment, round them all, so each is lit again before it fades (one burst a frame at most).
    if ((mine.next -= dt) <= 0) {
      mine.next = .045;
      const i = mine.turn = (mine.turn + 1) % mine.bits.length;
      shards(stage, 'metralla-glint', { at: bitAt(stage, f, mine.bits[i]), count: 1, spread: .004, life: [.26, .32], size: 1 + (i % 2) * .2, ...i === 0 ? { colour: '#bff4ff' } : {} });
    }
    // Now and then one catches the light.
    if ((mine.twinkle -= dt) <= 0) {
      mine.twinkle = 1 + Math.random() * .8;
      const b = mine.bits[Math.floor(Math.random() * mine.bits.length)];
      stage.fx.burst('twinkle', { at: bitAt(stage, f, b), count: 1, spread: .01, life: [.3, .4], colour: Math.random() < .5 ? C.cyan : C.hot, size: .7 });
    }
  }
}

export const staging: DuoStaging = { timing, start, land, hold, struck };
