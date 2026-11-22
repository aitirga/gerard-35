import type { BattleState } from '../battle';
import { screenAxes, ORBIT, type V3 } from '../dual-fx';
import { AGUA, markHeights } from '../freatica-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Seiche (Recarga + Ostinato): light water damage on every foe, and an eco that repeats the wave
 * every 5 s for 20 s, holding their water. A seiche is the slosh of water shut in a basin: a
 * standing wave, still in the middle, rising and falling at the ends.
 *
 * - **Start**: Sincopante's wearer lets a doubled ring of nácar go towards the foes and Freática's
 *   wearer runs a teal thread to the middle of them. The field becomes a basin: two faint walls of
 *   nácar at its ends and, between them, a surface of water in three lines (foam, teal, deep) with a
 *   haze of water under it, rocking about its still middle, a little in front of the foes. On each
 *   ostinato beat (each turn of the swing, 0.45 s apart) a doubled ring of nácar opens on the floor
 *   at the node, the rocking swings wider and the end that is up throws drops.
 * - **Land**: on the third turn, at the widest swing, the wave breaks on every foe at once: a column of spray, a
 *   doubled ring of nácar closing round each, teal light and a flash; then the surface keeps
 *   rocking, smaller and smaller, until it lies still.
 * - **Hold** (`seiche`): over each foe with it, a short line of water rocks quietly, two swings to
 *   each beat; when the eco sounds (its 5 s clock jumps back), it sloshes: the line swings wide,
 *   drops go off both ends and a doubled ring of nácar opens under the foe.
 *
 * Freática's teal and Sincopante's nácar and seafoam; no pink, no violet (docs/visual-style.md).
 */

const C = { teal: '#27c2a0', deep: '#1f8fb0', foam: '#dffcf6', nacar: ORBIT.nacar, sea: ORBIT.foam } as const;

// Two kinds of its own (the engine holds 128 in all): the drops and the body of the water. Its lines
// are the fight's `glyph`, its rings `floorring`, its motes Sincopante's `nacre`, all tinted.
const KINDS = {
  // Drops thrown off the end that is up: water, they fall and are gone on the floor.
  'seiche-drop': {
    shape: 'dot', glass: .35, drag: .6, gravity: 9, collide: true, bounce: 0, friction: 1, size: [.02, .011], sizeJitter: .6,
    colours: ['#ffffff', '#c6f3ea', '#3fc8aa'], intensity: [1.8, 1.4, 1], fadeOut: .3, additive: .4, opacity: .9, core: .6,
  },
  // The body of the water under the surface: soft, mostly covering what is behind it (water, not light),
  // so the basin reads as a mass that rocks, darker the deeper it is.
  'seiche-body': {
    shape: 'dot', glass: .45, drag: 8, gravity: 0, size: [.032, .036], sizeJitter: .45,
    colours: ['#d8fff6', '#4fd6bb', '#1f86a8'], intensity: [1.6, 1.3, 1.05], middle: .35, fadeIn: .1, fadeOut: .4, additive: .4, opacity: .85, core: .2,
  },
} satisfies Record<string, GpuKind>;
const FALLBACK: Record<keyof typeof KINDS, string> = { 'seiche-drop': 'fleck', 'seiche-body': 'glyph' };
const K: Record<string, string> = { 'seiche-drop': 'seiche-drop', 'seiche-body': 'seiche-body' };

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
const UP: V3 = { x: 0, y: 1, z: 0 };

/** Where a foe's water stands over its feet (its cell's surface), or a hand over the floor when it has none. */
function surfaceOf(f: DuoFighter, marks: number, left = 1) {
  if (marks <= 0) return .32;
  const m = Math.min(3, marks), { ticks, bands } = markHeights(f.height);
  return ticks[m - 1] + bands[m - 1] * Math.max(0, Math.min(1, left)) + .02;
}

const timing = { contact: 1, end: 2.05 };
/** The ostinato's beats, the swing's reversals: the wave is widest on each, and on the blow. */
const BEATS = [.1, .55];
const HALF = .45;
/** How far the basin's near and far lips stand from its surface line (m). */
const LIP = .22;

let clock = 0, startedAt = -99;

export const staging: DuoStaging = {
  timing,
  start(stage, _e, reached) {
    ensure(stage);
    startedAt = clock;
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length) return;
    const { right, facing } = screenAxes(stage.view), T = timing.contact;
    const along = (f: DuoFighter) => f.feet.x * right.x + f.feet.z * right.z;
    foes.sort((a, b) => along(a) - along(b));
    // The basin: from past the first foe to past the last, along the screen, on the lowest floor.
    const floorY = Math.min(...foes.map(f => f.feet.y));
    const first = foes[0], last = foes[foes.length - 1];
    let a = add({ ...first.feet, y: floorY }, right, -(first.radius + .75)), b = add({ ...last.feet, y: floorY }, right, last.radius + .75);
    if (dist(a, b) < 2.6) { const m = mix(a, b, .5); a = add(m, right, -1.3); b = add(m, right, 1.3); }
    // A little to the camera's side of them, so the water sloshes round their legs and is not lost behind them.
    const flat = Math.hypot(facing.x, facing.z) || 1, toward = { x: facing.x / flat, y: 0, z: facing.z / flat }, ahead = Math.max(...foes.map(f => f.radius)) * .7 + .25;
    a = add(a, toward, ahead); b = add(b, toward, ahead);
    const L = dist(a, b), mid = mix(a, b, .5), rest = .5;
    // How wide it swings at `t`: it grows on each beat to the blow, then dies away.
    const amp = (t: number) => t <= T ? .3 + .35 * Math.min(1, Math.max(0, (t - .05) / (T - .05))) : .65 * Math.exp(-(t - T) * 2);
    /** Where the surface is, `u` along the basin (0 → 1), at `t`: a standing wave, still at the middle. */
    const surface = (u: number, t: number, depth = 0): V3 => {
      const swing = Math.cos(Math.PI * (t - BEATS[0]) / HALF), y = rest - depth + amp(t) * Math.sin(Math.PI * (u - .5)) * swing;
      const p = mix(a, b, u);
      return { ...p, y: p.y + Math.max(.03, y) };
    };

    // Sincopante's ostinato: a doubled ring of nácar from its wearer's chest towards the foes, and one each beat.
    const marta = stage.wearer('sincopante'), water = stage.wearer('freatica');
    if (marta) BEATS.forEach((at, k) => stage.fx.after(at - .06, () => {
      stage.fx.ring(marta.chest, facing, .22 + k * .05, C.nacar, { count: 70, outward: 2.2, life: .45, size: 1.3 });
      stage.fx.after(.06, () => stage.fx.ring(marta.chest, facing, .22 + k * .05, C.sea, { count: 50, outward: 2.2, life: .4, size: 1 }));
    }));
    // Freática's thread along the floor to the middle of the basin, where the water comes from.
    if (water) stage.effects.trails.comet({ ...water.feet, y: water.feet.y + .05 }, { ...mid, y: mid.y + .05 }, ['#e8fff8', C.teal], .3, { arc: .05, width: .05, life: .4, intensity: 2.4, core: .5 });
    // The basin's two walls, faint.
    stage.fx.after(.08, () => {
      for (const end of [a, b]) {
        stage.fx.line({ ...end, y: end.y + .02 }, { ...end, y: end.y + rest + .75 }, C.nacar, { count: 30, life: timing.end - .1, size: 1 });
      }
    });
    // The beats: a doubled ring opens on the floor at the still middle, wider each time; the end that is up throws drops.
    BEATS.forEach((at, k) => stage.fx.after(at, () => {
      const floor = { ...mid, y: mid.y + .04 };
      stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.5, .6], colour: C.nacar, size: .45 + k * .2 });
      stage.fx.after(.07, () => stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.45, .55], colour: C.sea, size: .4 + k * .2 }));
      stage.fx.burst('nacre', { at: floor, count: 16 + k * 8, shape: 'ring', spread: .4 + k * .2, up: .5, speed: .2, life: [.6, 1] });
      const high = Math.cos(Math.PI * (at - BEATS[0]) / HALF) > 0 ? 1 : 0, end = surface(high ? .97 : .03, at);
      stage.fx.burst(K['seiche-drop'], { at: end, count: 18 + k * 12, spread: .12, velocity: { x: (high ? -right.x : right.x) * .6, y: 1.6 + k * .5, z: (high ? -right.z : right.z) * .6 }, speed: .7, life: [.5, .9] });
      stage.cue('clink');
    }));
    // The surface itself, drawn afresh thirty times a second: foam on top, teal under it, a deep line, and the water's haze.
    // Few bursts a frame: the fight's particles take `MAX_BATCHES` a frame in all, and the rest of the fight draws too.
    const steps = Math.round((timing.end - .14) * 30), n = 8, cols = 6;
    for (let i = 0; i <= steps; i++) {
      const t = .08 + i / 30;
      stage.fx.after(t, () => {
        for (let j = 0; j < n; j++) {
          const u0 = j / n, u1 = (j + 1) / n;
          const seg = dist(surface(u0, t), surface(u1, t));
          stage.fx.line(surface(u0, t), surface(u1, t), C.foam, { count: Math.round(seg * 36), life: .07, size: 1.9 });
          stage.fx.line(surface(u0, t, .07), surface(u1, t, .07), C.teal, { count: Math.round(seg * 22), life: .07, size: 1.5 });
        }
        stage.fx.line(surface(0, t, .16), surface(1, t, .16), C.deep, { count: Math.round(L * 9), life: .07, size: 1 });
        // Its near and far lips, a hand to each side of the surface: the water has width, not only a line.
        for (const k of [-1, 1]) for (let j = 0; j < n; j += 2) {
          const u0 = j / n, u1 = Math.min(1, (j + 2) / n), p0 = add(surface(u0, t, .02), toward, k * LIP), p1 = add(surface(u1, t, .02), toward, k * LIP);
          stage.fx.line(p0, p1, k < 0 ? C.teal : C.foam, { count: Math.round(dist(p0, p1) * 20), life: .07, size: k < 0 ? 1.2 : 1.5 });
        }
        // The body of the water under it: a curtain of soft teal from the floor to the surface every hand along, as deep as the water there.
        for (let j = 0; j <= cols; j++) {
          const top = surface(j / cols, t, .05), depth = top.y - floorY;
          stage.fx.burst(K['seiche-body'], { at: { ...top, y: floorY + .03 }, to: top, shape: 'line', count: Math.max(8, Math.round(depth * 60)), spread: L / cols * .45, life: [.2, .26], size: 1.3 });
        }
      });
    }
    // It breaks on every foe at once.
    stage.fx.after(T, () => {
      for (const f of foes) {
        const floor = { ...f.feet, y: f.feet.y + .04 };
        stage.fx.burst(K['seiche-drop'], { at: floor, count: 46, shape: 'ring', spread: f.radius * .7, velocity: { x: 0, y: 3.4, z: 0 }, speed: .7, outward: .6, life: [.5, .9] });
        stage.fx.ring(add(floor, UP, .05), UP, f.radius + .75, C.nacar, { count: 90, outward: -1.8, life: .35, size: 1.5 });
        stage.fx.after(.08, () => stage.fx.ring(add(floor, UP, .05), UP, f.radius + .75, C.sea, { count: 70, outward: -1.8, life: .3, size: 1.2 }));
        stage.fx.burst('bloom', { at: f.chest, count: 1, spread: .02, life: [.18, .26], colour: C.teal, size: .6, light: { intensity: 2.2, range: 3, colour: C.sea } });
      }
    });
    stage.cue('splash', { delay: .05 });
  },
  land(stage, _e, reached) {
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    for (const f of foes) stage.hit(f.id, [.5, .95, .85], .9);
    stage.shake(.3); stage.punch(.3); stage.pulse(.3, .75, .1);
    stage.cue('splash'); stage.cue('clink', { delay: .04 });
  },
  hold(stage, dt, state) {
    clock += dt;
    holdSeiche(stage, dt, state);
  },
};

// ── The hold: an eco rocking the water of each foe ──
/** Each foe's eco as last seen: its clock to the next beat, and how wide its water is sloshing now. */
const watch = new Map<string, { next: number; slosh: number }>();
let nextDraw = 0;
const PERIOD = 2.5;

function holdSeiche(stage: DuoStage, dt: number, state: BattleState) {
  const under = state.foes.filter(f => f.hp > 0 && f.timed?.seiche);
  const own = clock - startedAt < timing.end;
  // An eco gone on its last beat still sloshes once.
  for (const [id, w] of watch) if (!under.some(u => u.id === id)) {
    watch.delete(id);
    const u = state.foes.find(f => f.id === id), f = u && u.hp > 0 ? stage.fighter(id) : undefined;
    if (f && w.next < 1.5 && !own) { ensure(stage); slosh(stage, f, surfaceOf(f, u!.timed?.agua?.level ?? 0, (u!.timed?.agua?.left ?? 0) / AGUA.mark)); }
  }
  if (!under.length) { nextDraw = 0; return; }
  ensure(stage);
  const draw = (nextDraw -= dt) <= 0;
  if (draw) nextDraw = .11;
  const phase = Math.sin(2 * Math.PI * clock / PERIOD), turned = Math.floor(clock / (PERIOD / 2)) !== Math.floor((clock - dt) / (PERIOD / 2));
  for (const u of under) {
    const on = u.timed!.seiche!, w = watch.get(u.id) ?? { next: on.next, slosh: 0 };
    const beat = on.next > w.next + 1;
    w.next = on.next; w.slosh = Math.max(0, w.slosh - dt * .35);
    watch.set(u.id, w);
    if (own) continue;
    const f = stage.fighter(u.id);
    if (!f || f.hp <= 0) continue;
    const h = surfaceOf(f, u.timed?.agua?.level ?? 0, (u.timed?.agua?.left ?? 0) / AGUA.mark);
    if (beat) { w.slosh = .3; slosh(stage, f, h); }
    if (draw) {
      const { right } = screenAxes(stage.view), half = f.radius + .3, tilt = (.06 + w.slosh) * phase;
      const centre = front(stage, f, h);
      const l = add(add(centre, right, -half), UP, -tilt), r = add(add(centre, right, half), UP, tilt);
      stage.fx.line(l, r, w.slosh > .05 ? C.foam : C.sea, { count: w.slosh > .05 ? 20 : 15, life: .15, size: 1.1 + w.slosh * 2 });
    }
    // Two quiet swings to a beat: a faint ring of nácar on the floor as each turns.
    if (turned) stage.fx.burst('floorring', { at: { ...f.feet, y: f.feet.y + .04 }, count: 1, spread: .01, life: [.4, .5], colour: C.sea, size: .25 + f.radius * .2 });
  }
}

/** Over a foe's feet at `h`, a little to the camera's side of it, so its legs do not hide the water. */
function front(stage: DuoStage, f: DuoFighter, h: number): V3 {
  const { facing } = screenAxes(stage.view), flat = Math.hypot(facing.x, facing.z) || 1, k = f.radius * .45 + .1;
  return { x: f.feet.x + facing.x / flat * k, y: f.feet.y + h, z: f.feet.z + facing.z / flat * k };
}

/** The eco sounds on a foe: its water sloshes, drops off both ends, a doubled ring of nácar under it. */
function slosh(stage: DuoStage, f: DuoFighter, h: number) {
  const { right } = screenAxes(stage.view), half = f.radius + .3, centre = front(stage, f, h), floor = { ...f.feet, y: f.feet.y + .04 };
  for (const s of [-1, 1]) stage.fx.burst(K['seiche-drop'], { at: add(centre, right, s * half), count: 14, spread: .06, velocity: { x: right.x * s * .5, y: 1.8, z: right.z * s * .5 }, speed: .5, life: [.4, .8] });
  stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.5, .6], colour: C.nacar, size: .4 + f.radius * .35 });
  stage.fx.after(.08, () => stage.fx.burst('floorring', { at: floor, count: 1, spread: .01, life: [.45, .55], colour: C.sea, size: .35 + f.radius * .35 }));
  stage.fx.burst('nacre', { at: floor, count: 10, shape: 'ring', spread: f.radius * .8, up: .5, speed: .2, life: [.6, 1] });
  stage.hit(f.id, [.5, .95, .85], .4);
}
