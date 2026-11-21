import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Staccato (Zarpazo sangriento + Ostinato). Over the foe Sincopante's eco opens, a small doubled ring
 * of nácar, and a metronome's arm ticks in it twice; on the third beat Haru's claw makes one clean
 * cut across the foe, and the eco takes it down like a note: the same stroke, small and bright, hangs
 * inside the ring. While Staccato holds (`timed.staccato`) the stroke waits there and the ring fills
 * round it with the seconds to the beat; on each beat (`next` jumps back to 5) the eco plays it again,
 * one short crisp cut on the foe with a tiny nácar ring. Precise, rhythmic and single: one line, one
 * foe, never a burst.
 */
const C = { nacar: '#eefbf6', foam: '#8fe3c4', gold: '#f2e2a8', orange: '#f0954a', cut: '#fff3e6', wound: '#c8301e' } as const;
const BEAT = 5;

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** The cut each foe carries: its slant (radians from the screen's diagonal), the same every time the eco plays it. */
const slants = new Map<string, number>();
const slantOf = (id: string) => { let a = slants.get(id); if (a === undefined) { a = (Math.random() - .5) * .5; slants.set(id, a); } return a; };

/** Where things are on a foe, for the view as it is now. */
function frame(stage: DuoStage, f: DuoFighter) {
  const { right, up, facing } = screenAxes(stage.view), a = slantOf(f.id), c = Math.cos(a), s = Math.sin(a);
  // The cut runs from up-left to down-right across their front, turned by its slant.
  const along = add({ x: right.x * c, y: right.y * c, z: right.z * c }, up, -.8 * c + s * .6);
  const front = add(f.chest, facing, f.radius * .55 + .22), half = Math.min(.75, Math.max(.32, f.radius * .75 + .1));
  // The eco hangs beside them, up and to the side (clear of their plate), a little to the camera.
  const eco = add(add(add(f.feet, up, f.height * .8 + .3), right, f.radius * .8 + .65), facing, .25);
  return { right, up, facing, front, eco, along, half, cut: [add(front, along, -half), add(front, along, half)] as const, note: [add(eco, along, -.15), add(eco, along, .15)] as const };
}
/**
 * The eco's doubled ring: an outer ring of seafoam, and inside it five arcs of nácar, one for each
 * second of the beat, the first `share` of them (0–1) lit from the top round the clock.
 */
function ring(stage: DuoStage, at: V3, axes: { right: V3; up: V3; facing: V3 }, share: number, life: number, bright = 1) {
  const n = BEAT, upto = Math.min(n, Math.floor(share * n + 1e-6)), r = .28;
  const p = (a: number) => add(add(at, axes.right, Math.cos(a) * r), axes.up, Math.sin(a) * r);
  stage.fx.ring(at, axes.facing, .34, C.foam, { count: 30, life: life * .9, size: .85 * bright });
  for (let i = 0; i < upto; i++) {
    const a0 = Math.PI / 2 - (i / n) * Math.PI * 2 - .1, a1 = Math.PI / 2 - ((i + 1) / n) * Math.PI * 2 + .1, am = (a0 + a1) / 2;
    stage.fx.line(p(a0), p(am), C.nacar, { count: 5, life, size: 1.2 * bright });
    stage.fx.line(p(am), p(a1), C.nacar, { count: 5, life, size: 1.2 * bright });
  }
}
/** The note: the cut as the eco keeps it, a short bright stroke with a gold head. */
function note(stage: DuoStage, o: ReturnType<typeof frame>, life: number, bright = 1) {
  stage.fx.line(o.note[0], o.note[1], C.nacar, { count: 12, life, size: 1.7 * bright });
  stage.fx.burst('glyph', { at: o.note[1], count: 1, spread: 0, life: [life, life], colour: C.gold, size: 2.4 * bright });
}
/** The metronome's arm in the eco, leaning to `side`. */
function tick(stage: DuoStage, o: ReturnType<typeof frame>, side: number, life: number) {
  const pivot = add(o.eco, o.up, -.2), tip = add(add(o.eco, o.up, .17), o.right, side * .13);
  stage.fx.line(pivot, tip, C.foam, { count: 12, life, size: 1.3 });
  stage.fx.burst('twinkle', { at: tip, count: 1, spread: .005, life: [.18, .24], colour: C.gold, size: .45 });
}
/**
 * One clean cut across them: a fast blade of light, its line left a moment, a few chips and the
 * blood. The eco's replay (`strength` under 1) is shorter, thinner and gone sooner: a staccato note.
 */
function slash(stage: DuoStage, f: DuoFighter, o: ReturnType<typeof frame>, strength: number) {
  const reach = Math.min(1, .45 + strength * .45), a = add(o.front, o.along, -o.half * reach), b = add(o.front, o.along, o.half * reach), mid = mix(a, b, .5);
  stage.effects.trails.comet(a, b, ['#ffffff', C.orange], .045, { arc: 0, width: .03 * strength + .015, life: .1 + .12 * strength, taper: .9, intensity: 3.6, core: .7 });
  stage.fx.after(.045, () => {
    stage.fx.line(a, b, C.cut, { count: Math.round(50 * strength), life: .12 + .2 * strength, size: 1.2 + strength * .6 });
    stage.fx.line(add(a, o.up, -.025), add(b, o.up, -.025), C.wound, { count: Math.round(30 * strength), life: .3 + .3 * strength, size: 1.1 });
    stage.fx.burst('needle', { at: b, count: Math.round(10 * strength), spread: .03, speed: 2.2, life: [.2, .4], colour: C.cut });
    const d = { x: b.x - a.x, z: b.z - a.z }, l = Math.hypot(d.x, d.z) || 1, g = stage.effects.gpu, spray = !!g?.get('bloodspray');
    stage.fx.burst(spray ? 'bloodspray' : 'fleck', { at: mid, count: Math.round(22 * strength), spread: .05, velocity: { x: d.x / l * 3 + o.facing.x, y: 1.4, z: d.z / l * 3 + o.facing.z }, cone: .5, speed: 1.2, life: [.6, 1], ...spray ? {} : { colour: '#8a0d16' } });
    stage.hit(f.id, [1, .62, .4], .8 * strength);
  });
}

const timing = { contact: .85, end: 1.9 };

function start(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const f = reached.find(r => !r.party);
  if (!f || !stage.fx.on) return;
  const o = frame(stage, f), T = timing.contact;
  // The eco opens over them, drawn round from the top.
  for (let k = 1; k <= BEAT; k++) stage.fx.after(k * .035, () => ring(stage, o.eco, o, k / BEAT, .12));
  stage.fx.after(.2, () => ring(stage, o.eco, o, 1, T - .1));
  stage.fx.burst('bloom', { at: o.eco, count: 1, spread: .02, life: [.2, .3], colour: C.foam, size: .35, light: { intensity: 1.6, range: 2.2, colour: C.foam } });
  // Two ticks of its arm, left and right, and on the third Haru cuts.
  stage.fx.after(.22, () => tick(stage, o, -1, .22));
  stage.fx.after(.5, () => tick(stage, o, 1, .22));
  stage.fx.after(T - .14, () => tick(stage, o, 0, .2));
  const cat = stage.wearer('papagato'), from = cat?.hand ?? cat?.chest;
  if (from) stage.effects.trails.comet(from, o.cut[0], [C.cut, C.orange], .26, { arc: .35, width: .035, life: .25, intensity: 2.2, core: .5, delay: T - .3 });
  stage.fx.after(T - .05, () => slash(stage, f, o, 1.3));
  // The eco takes it down: a line of nácar from the cut up to it, a ring closing on the note, and the note hung.
  stage.fx.after(T + .1, () => {
    const now = frame(stage, f);
    stage.fx.line(mix(now.cut[0], now.cut[1], .5), now.eco, C.nacar, { count: 22, life: .25, size: 1.1 });
    stage.fx.ring(now.eco, now.facing, .55, C.foam, { count: 50, outward: -1.5, life: .22, size: 1.2 });
  });
  stage.fx.after(T + .3, () => {
    const now = frame(stage, f);
    note(stage, now, .5, 1.3);
    ring(stage, now.eco, now, 1, .5);
    stage.fx.burst('glyph', { at: now.note[1], count: 6, spread: .05, speed: .4, life: [.2, .35], colour: C.gold, size: 1.2 });
  });
  stage.cue('clink', { delay: .22 }); stage.cue('clink', { delay: .5 }); stage.cue('clink', { delay: T - .14 });
  stage.cue('clink', { delay: T + .3 });
}

function land(stage: DuoStage) {
  stage.shake(.22); stage.pulse(.25, .5, .08); stage.punch(.35);
  stage.cue('claw'); stage.cue('bleed', { delay: .06 });
}

// ── The hold: the note waiting in the eco, and the cut again on each beat ──

/** Each foe's Staccato clock as last seen, and when its note is next drawn. */
const clocks = new Map<string, { next: number; draw: number; second: number }>();
let seen: BattleEffect | undefined;
let since = 0;

/** The eco plays the note again: it flashes, drops onto the foe and cuts there, a tiny ring of nácar where it lands. */
function replay(stage: DuoStage, f: DuoFighter, last: boolean) {
  const o = frame(stage, f), mid = mix(o.cut[0], o.cut[1], .5);
  note(stage, o, .14, 1.8);
  stage.effects.trails.comet(o.note[1], o.cut[0], [C.nacar, C.foam], .09, { arc: 0, width: .03, life: .16, intensity: 2.4, core: .6 });
  stage.fx.after(.09, () => {
    slash(stage, f, frame(stage, f), .6);
    stage.fx.ring(mid, o.facing, .12, C.nacar, { count: 36, outward: 2.2, life: .28, size: 1.2 });
    stage.fx.ring(mid, o.facing, .16, C.foam, { count: 28, outward: 2.2, life: .24, size: .9 });
  });
  stage.cue('claw', { delay: .09 }); stage.cue('clink');
  // The last one: the eco is spent, and goes up as motes.
  if (last) stage.fx.after(.25, () => {
    stage.fx.burst('nacre', { at: o.eco, count: 26, shape: 'ring', axis: o.facing, spread: .26, speed: .3, life: [.6, 1.1] });
    slants.delete(f.id);
  });
}

function hold(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  if (playing !== seen) { seen = playing; since = 0; } else since += dt;
  const ownStart = playing?.dual?.id === 'staccato' && since < timing.contact + .4;
  for (const unit of state.foes) {
    const on = unit.timed?.staccato, last = clocks.get(unit.id);
    if (!on || unit.hp <= 0) {
      if (last) {
        // Its last beat goes off as it ends.
        const f = stage.fighter(unit.id);
        if (f && unit.hp > 0 && last.next < 1.5) replay(stage, f, true);
        clocks.delete(unit.id);
      }
      continue;
    }
    const f = stage.fighter(unit.id);
    const mine = last ?? { next: on.next, draw: 0, second: Math.ceil(on.next) };
    if (!last) clocks.set(unit.id, mine);
    const beat = !!last && on.next > last.next + 1;
    mine.next = on.next;
    if (!f || ownStart) continue;
    if (beat) { replay(stage, f, false); mine.draw = .2; }
    // Between beats: the note waits in the eco, its ring filling round with the time to the next.
    if ((mine.draw -= dt) <= 0) {
      mine.draw = .28;
      const o = frame(stage, f);
      note(stage, o, .34);
      ring(stage, o.eco, o, Math.max(.05, 1 - on.next / BEAT), .34, .85);
    }
    // A tick of the arm each second, and the last second before the beat a little brighter.
    const second = Math.ceil(on.next);
    if (second !== mine.second) {
      mine.second = second;
      const o = frame(stage, f);
      tick(stage, o, second % 2 ? -1 : 1, second <= 1 ? .3 : .18);
    }
  }
}

export const staging: DuoStaging = { timing, start, land, hold };
