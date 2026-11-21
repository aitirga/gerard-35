import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Idea fija (Confusión + Ostinato): an eco lodged inside a foe that turns it on its own every 5 s
 * (`runClock` in src/battle.ts). Bip's signal goes in as a cyan sine wave, carried on Sincopante's
 * ostinato, four doubled rings of nácar stepping in on a steady beat; at the head it closes into a
 * loop, an oscilloscope's Lissajous figure. It stays: two pens trace that loop round and round in
 * front of its head, Bip's cyan and, a little behind it on the same path, its nácar echo. On each
 * beat the loop pulls tight and a doubled wave runs from it to whoever it is made to strike.
 * Cold on purpose: cyan, nácar and seafoam, never violet (fear's) or pink (the Queen's).
 */
const CYAN = '#4fe0ff', ICE = '#d8fbff', NACAR = '#eefbf6', FOAM = '#8fe3c4';
const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
const norm = (v: V3): V3 => { const d = len(v) || 1; return { x: v.x / d, y: v.y / d, z: v.z / d }; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const TIMING = { contact: .95, end: 1.8 };
/** The loop: seconds a pen takes round it, how many dots each pen lays a second, how long a dot shines. */
const LOOP = { period: 1.15, rate: 68, life: .55, lag: .3 };

/**
 * About where its head is: high on it, towards the party it faces (a dog's head is at its front),
 * and a little towards the camera so the loop reads in front of it rather than lost inside it.
 */
function headOf(f: DuoFighter, stage: DuoStage): V3 {
  const { facing } = screenAxes(stage.view), party = stage.party();
  const y = Math.min(f.feet.y + f.height * .82, f.chest.y + f.height * .2);
  let ahead: V3 = { x: 0, y: 0, z: 0 };
  if (party.length) {
    const to = party.reduce((s, p) => ({ x: s.x + p.feet.x / party.length, y: 0, z: s.z + p.feet.z / party.length }), { x: 0, y: 0, z: 0 });
    const d = Math.hypot(to.x - f.feet.x, to.z - f.feet.z) || 1;
    ahead = { x: (to.x - f.feet.x) / d, y: 0, z: (to.z - f.feet.z) / d };
  }
  return add(add({ x: f.chest.x, y, z: f.chest.z }, ahead, f.radius * .55), facing, Math.min(.4, f.radius * .45));
}
/** Half the loop's width on this foe. */
const loopSize = (f: DuoFighter) => Math.max(.16, Math.min(.36, .12 + f.radius * .22));
/** A point of the Lissajous loop (3 : 2), `phase` turning it as if it spun in depth. */
function lissajous(centre: V3, right: V3, up: V3, size: number, theta: number, phase: number): V3 {
  return add(add(centre, right, size * Math.sin(3 * theta + phase)), up, size * .72 * Math.sin(2 * theta));
}
/** A wave of dots from `a` to `b` across the screen, `cycles` of it, pinned at both ends; drawn over `seconds`. */
function wave(stage: DuoStage, a: V3, b: V3, o: { amp: number; cycles: number; colour: string; life: number; size: number; seconds?: number; phase?: number; segments?: number }) {
  const { facing } = screenAxes(stage.view), dir = norm(sub(b, a)), across = norm(cross(dir, facing));
  const n = o.segments ?? 32, at = (u: number) => add(mix(a, b, u), across, o.amp * Math.sin(Math.PI * u) * Math.sin(u * Math.PI * 2 * o.cycles + (o.phase ?? 0)));
  const step = len(sub(b, a)) / n;
  for (let i = 0; i < n; i++) stage.fx.after((o.seconds ?? 0) * i / n, () => stage.fx.line(at(i / n), at((i + 1) / n), o.colour, { count: Math.max(3, Math.round(step * 55)), life: o.life - (o.seconds ?? 0) * i / n, size: o.size }));
}
/** A tear in the picture across the head: a short horizontal line of cyan, gone at once. */
function tear(stage: DuoStage, at: V3, width: number) {
  const { right } = screenAxes(stage.view), shift = (Math.random() - .5) * width * .5;
  stage.fx.line(add(at, right, -width + shift), add(at, right, width + shift), Math.random() < .3 ? ICE : CYAN, { count: Math.round(width * 50), life: .1, size: 1.3 });
}

/** The fight's seconds as the hold has seen them, and until when a foe's loop is still the dual's own start. */
let now = 0;
const quiet = new Map<string, number>();
/** Each foe with the eco in it: where its two pens are on the loop, how tight it is, its clock as last seen. */
interface Lodged { theta: number; phase: number; tight: number; acc: number; pens: [V3 | undefined, V3 | undefined]; next: number; tearIn: number }
const lodged = new Map<string, Lodged>();

function start(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const foe = reached[0];
  if (!foe || !stage.fx.on) return;
  quiet.set(foe.id, now + TIMING.contact);
  const { right, up, facing } = screenAxes(stage.view), head = headOf(foe, stage), size = loopSize(foe), C = TIMING.contact;
  const tech = stage.wearer('tecnopata'), sinc = stage.wearer('sincopante');
  const signal = stage.bip() ?? tech?.hand ?? tech?.chest, voice = sinc?.hand ?? sinc?.chest;
  // Bip's signal: a cyan sine wave laid from it to the head, drawn as it goes.
  if (signal) {
    stage.fx.burst('bipzap', { at: signal, count: 14, spread: .05, speed: 1.6, life: [.15, .35] });
    wave(stage, signal, head, { amp: .12, cycles: 6, colour: CYAN, life: C + .05, size: 1.5, seconds: .42, segments: 40 });
    stage.fx.after(.2, () => wave(stage, signal, head, { amp: .07, cycles: 6, colour: ICE, life: C - .15, size: 1.1, seconds: .3, phase: Math.PI, segments: 32 }));
  }
  // The ostinato: four beats, a doubled ring of nácar each, stepping in to the head and closing as they go.
  const from = voice ?? add(head, right, -2.2), axis = norm(sub(head, from));
  [.18, .38, .58, .78].forEach((at, k) => stage.fx.after(at, () => {
    const c = mix(from, head, (k + 1) / 4), r = .5 - k * .09;
    stage.fx.ring(c, axis, r, NACAR, { count: 64, outward: -.5, life: .38, size: 1.5, ...k === 3 ? { light: 1.6 } : {} });
    stage.fx.ring(c, axis, r * 1.14, FOAM, { count: 44, outward: -.5, life: .32, size: 1.1 });
    stage.fx.burst('nacre', { at: c, count: 10, shape: 'ring', axis, spread: r, speed: .2, life: [.5, .9] });
  }));
  stage.cue('eco-la', { delay: .18 }); stage.cue('eco-do', { delay: .78 });
  // It gets in: the picture tears across the head, and the loop draws itself there, small and turning.
  for (let i = 0; i < 6; i++) stage.fx.after(.5 + i * .06, () => tear(stage, add(head, up, (Math.random() - .5) * size * 1.6), size * 1.3));
  const n = 54;
  for (let i = 0; i < n; i++) stage.fx.after(.66 + i * .0045, () => {
    const a = lissajous(head, right, up, size * .8, i / n * Math.PI * 2, .4), b = lissajous(head, right, up, size * .8, (i + 1) / n * Math.PI * 2, .4);
    stage.fx.line(a, b, i % 2 ? CYAN : FOAM, { count: 4, life: C - .66 + .15, size: 1.3 });
  });
  stage.fx.after(.7, () => stage.fx.burst('flare', { at: add(head, facing, .05), count: 1, spread: .01, life: [.2, .25], colour: CYAN, light: { intensity: 1.2, range: 1.6, colour: CYAN } }));
}

function land(stage: DuoStage, _e: BattleEffect, reached: DuoFighter[]) {
  const foe = reached[0];
  stage.pulse(.7, .5, .08); stage.punch(.3); stage.shake(.22); stage.cue('glitch');
  if (!foe || !stage.fx.on) return;
  // The foe jolts and the loop locks: a ring snaps shut on it, the figure flashes whole, the signal sparks.
  const { right, up, facing } = screenAxes(stage.view), head = headOf(foe, stage), size = loopSize(foe);
  stage.hit(foe.id, [.3, .85, 1], .75);
  stage.fx.ring(head, facing, size * 2.6, ICE, { count: 80, outward: -3.6, life: .26, size: 1.3 });
  stage.fx.ring(head, facing, size * 3, FOAM, { count: 56, outward: -3.2, life: .3, size: 1.1 });
  for (let i = 0; i < 40; i++) {
    const a = lissajous(head, right, up, size, i / 40 * Math.PI * 2, .9), b = lissajous(head, right, up, size, (i + 1) / 40 * Math.PI * 2, .9);
    stage.fx.line(a, b, i % 2 ? ICE : CYAN, { count: 4, life: .3, size: 1.7 });
  }
  stage.fx.burst('bipzap', { at: head, count: 28, spread: .08, speed: 2.6, up: .4, life: [.2, .45] });
  stage.fx.burst('nacre', { at: head, count: 24, shape: 'ring', axis: facing, spread: size * 1.4, speed: .3, life: [.6, 1.1] });
  for (let i = 0; i < 4; i++) stage.fx.after(i * .04, () => tear(stage, add(foe.chest, up, (Math.random() - .3) * foe.height * .5), Math.max(.3, foe.radius * 1.2)));
}

/** A beat of the eco: the loop pulls tight and a doubled wave runs from the one carrying it to whoever it strikes. */
function beat(stage: DuoStage, carrier: DuoFighter, victim: DuoFighter | undefined) {
  const { facing } = screenAxes(stage.view), head = headOf(carrier, stage), size = loopSize(carrier);
  stage.hit(carrier.id, [.55, 1, .95], .8);
  stage.fx.ring(head, facing, size * 1.9, CYAN, { count: 60, outward: -2.6, life: .22, size: 1.4, light: 1.4 });
  for (let i = 0; i < 3; i++) stage.fx.after(i * .03, () => tear(stage, add(head, UP, (Math.random() - .5) * size * 1.4), size * 1.2));
  stage.cue('glitch');
  if (!victim || victim.id === carrier.id) {
    // Alone: it turns on itself, the ring closing into its own chest.
    stage.fx.after(.1, () => {
      stage.fx.ring(carrier.chest, facing, Math.max(.4, carrier.radius), NACAR, { count: 70, outward: -2.4, life: .3, size: 1.5 });
      stage.fx.burst('bipzap', { at: carrier.chest, count: 24, spread: .1, speed: 2.2, life: [.2, .45] });
    });
    return;
  }
  const to = victim.chest;
  wave(stage, head, to, { amp: .1, cycles: 4, colour: CYAN, life: .38, size: 1.8, seconds: .1 });
  stage.fx.after(.04, () => wave(stage, head, to, { amp: .1, cycles: 4, colour: NACAR, life: .34, size: 1.3, seconds: .1, phase: Math.PI * .5 }));
  stage.fx.after(.12, () => {
    stage.hit(victim.id, [.6, 1, 1], 1);
    stage.fx.ring(to, facing, .22, ICE, { count: 60, outward: 3, life: .3, size: 1.4 });
    stage.fx.ring(to, facing, .28, FOAM, { count: 40, outward: 2.4, life: .34, size: 1.1 });
    stage.fx.burst('bipzap', { at: to, count: 22, spread: .08, speed: 2.6, up: .5, life: [.2, .45] });
    stage.shake(.14);
  });
}

function hold(stage: DuoStage, dt: number, state: BattleState) {
  now += dt;
  if (!stage.fx.on) return;
  const carriers = state.foes.filter(f => f.timed?.['idea-fija'] && f.hp > 0);
  // The eco runs out (or its foe falls): the loop comes undone, its dots let go.
  for (const id of lodged.keys()) if (!carriers.some(f => f.id === id)) {
    lodged.delete(id);
    const f = stage.fighter(id);
    if (f && f.hp > 0) {
      const head = headOf(f, stage), { facing } = screenAxes(stage.view);
      stage.fx.ring(head, facing, loopSize(f) * 1.2, NACAR, { count: 50, outward: 1.6, life: .45, size: 1.2 });
      stage.fx.burst('nacre', { at: head, count: 20, spread: loopSize(f), speed: .5, life: [.6, 1.1] });
    }
  }
  if (!carriers.length) return;
  const { right, up } = screenAxes(stage.view);
  for (const unit of carriers) {
    const on = unit.timed!['idea-fija']!;
    let l = lodged.get(unit.id);
    if (!l) { l = { theta: 0, phase: 0, tight: 0, acc: 0, pens: [undefined, undefined], next: on.next, tearIn: 1 }; lodged.set(unit.id, l); }
    const beaten = on.next > l.next + 1;
    l.next = on.next;
    // Its own start draws it until the blow lands.
    if ((quiet.get(unit.id) ?? 0) > now) continue;
    const f = stage.fighter(unit.id);
    if (!f) continue;
    // Its beat is drawn as the fight screen shows the pulse (`pulsed`), with whoever it made it strike.
    if (beaten) l.tight = 1;
    // The two pens go round the loop: tighter and faster just after a beat, easing back.
    l.tight = Math.max(0, l.tight - dt * 2.4);
    const squeeze = 1 - .55 * l.tight * l.tight, speed = Math.PI * 2 / LOOP.period * (1 + 1.6 * l.tight);
    l.theta += dt * speed; l.phase += dt * .55;
    const head = headOf(f, stage), size = loopSize(f) * squeeze;
    l.acc += dt * LOOP.rate;
    const n = Math.floor(l.acc);
    if (n > 0) {
      l.acc -= n;
      const pens: [V3, V3] = [lissajous(head, right, up, size, l.theta, l.phase), lissajous(head, right, up, size * 1.08, l.theta - LOOP.lag * Math.PI * 2, l.phase)];
      pens.forEach((p, k) => {
        const from = l!.pens[k] && len(sub(l!.pens[k]!, p)) < size * 1.5 ? l!.pens[k]! : p;
        stage.fx.burst('glyph', { at: from, to: p, shape: 'line', count: n, life: [LOOP.life * .8, LOOP.life], colour: k ? NACAR : CYAN, size: k ? 1.3 : 1.7 });
        l!.pens[k] = p;
      });
    }
    // Now and then the picture tears across its head.
    if ((l.tearIn -= dt) <= 0) { l.tearIn = .7 + Math.random() * 1.1; tear(stage, add(head, up, (Math.random() - .5) * size * 1.6), size * 1.1); }
  }
}

/** A pulse of the eco (`runClock`): `by` carries it, `target` is whom it made it strike (itself when alone). */
function pulsed(stage: DuoStage, status: string, target: DuoFighter, by?: DuoFighter) {
  if (status !== 'idea-fija' || !stage.fx.on) return;
  const carrier = by ?? target, l = lodged.get(carrier.id);
  if (l) l.tight = 1;
  beat(stage, carrier, target.id === carrier.id ? undefined : target);
}

export const staging: DuoStaging = { timing: TIMING, start, land, hold, pulsed };
