import { IGNITION_GAP, type BattleEffect, type BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { markHeights } from '../freatica-fx';
import { ELECTROLYSIS_DRAIN } from '../freatica-fight';
import type { GpuKind } from '../fight-particles';
import { neonCurve } from '../math-figures';
import { deflagrate } from '../deflagrate';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Electrólisis (Cubo acuático + Sondeo eléctrico): the current does not run through the foes' water, it splits it. What
 * is left over each of them is a cloud of gas, and the next fire on any of them sets them all off, one after another.
 *
 * - **0–0.5 s**: Gerard plants two electrodes at the ends of the foes' line, two bars of gold neon drawn by his pen of
 *   light, a «−» over the left one and a «+» over the right. Each foe's water lights up cyan from inside.
 * - **0.5–1 s**: Freática's Sondeo runs from − to +, jumping from foe to foe, a jagged bolt.
 * - **Contact**: the water boils into bubbles. Each cell fills with a body of real water (the fight's fluid), and two
 *   streams of bubbles rise through it, twice as many of hydrogen (cyan-white) on the cathode's side as of oxygen (pale
 *   gold) on the anode's: fast inside the water, slowly once out of it. The water sinks as it goes (src/freatica-fight.ts
 *   `drain`).
 * - **1.6–2.4 s**: the bubbles gather over each foe into a loose cloud of glass beads, as big as its gas; the hold keeps
 *   it breathing while the gas lasts.
 * - **Ignition** (`struck`, when a blow says `ignited`): a front of fire runs through each cloud (`ignite` on the GPU:
 *   each bead of gas catches from one burning near it), cloud after cloud, in the order the gas went up; each one a
 *   ring of pressure on the floor, a dry crack, and a fine drizzle after it (hydrogen and oxygen make water).
 *
 * Matemágico's gold, Freática's cyan and spark yellow, fire's orange; no pink, no violet (docs/visual-style.md).
 */

const C = {
  gold: '#f3cf78', chalk: '#fff4d6', cyan: '#7fe6f2', ice: '#dff8ff', spark: '#ffe24a', h2: '#e6fbff', o2: '#ffe9b8',
  flame: '#ff8a24', ember: '#ffd27a',
} as const;
const UP: V3 = { x: 0, y: 1, z: 0 };
const TIMING = { contact: 1, end: 2.4 } as const;
/** When each shot starts (fight seconds from the dual's start). */
const PLAN = { plant: .05, bars: .3, glyphs: .38, light: .2, bolt: .52, boltRun: .4, gather: 1.6 } as const;

const KINDS = {
  // The water's body inside each cell while it splits: soft cyan beads of a fluid that keeps its volume and sinks as it thins.
  'electro-agua': {
    shape: 'glow', drag: .4, gravity: 9, curl: .15, response: .2, collide: true, bounce: .02, friction: .5,
    size: [.075, .06], sizeJitter: .35, blur: [.6, .95], colours: ['#e8fdff', '#6fd8e8', '#2a8fc0'], intensity: [1.15, .95, .7], middle: .45,
    fadeIn: .1, fadeOut: .35, additive: .35, opacity: .32, core: 0, fluid: { pressure: 14, viscosity: 6, rest: 8 },
  },
  // Hydrogen: small beads of glass, cyan-white, that rise fast through the water and drift up out of it.
  'electro-h2': {
    shape: 'dot', glass: .92, drag: 2.2, gravity: -1.8, curl: .35, response: .3, size: [.011, .016], sizeJitter: .55,
    colours: ['#ffffff', '#e6fbff', '#a6ecf6'], intensity: [2, 1.6, 1.1], middle: .5, fadeIn: .05, fadeOut: .3, additive: .5, core: .2,
    bubble: { lift: 11, flow: 2 },
  },
  // Oxygen: fewer and a little bigger, pale gold.
  'electro-o2': {
    shape: 'dot', glass: .9, drag: 2.2, gravity: -1.6, curl: .3, response: .3, size: [.015, .021], sizeJitter: .5,
    colours: ['#ffffff', '#fff0c8', '#f3cf78'], intensity: [2, 1.6, 1.1], middle: .5, fadeIn: .05, fadeOut: .3, additive: .5, core: .2,
    bubble: { lift: 10, flow: 2 },
  },
  // The gas: beads of glass hanging in a loose cloud that draws itself together; within reach of fire, they catch.
  'electro-gas': {
    shape: 'glow', glass: .75, size: [.026, .03], sizeJitter: .5, gravity: 0, drag: 2.4, curl: .18, response: .2, cohesion: .5, radius: .3,
    colours: ['#ffffff', '#e8f8fb', '#bfe6ee'], intensity: [1.5, 1.25, 1], middle: .5, fadeIn: .25, fadeOut: .3, additive: .55, opacity: .85, core: .1,
    ignite: { into: 'electro-llama', delay: .07, radius: .24 },
  },
  // The gas's haze: big soft breaths of pale light round the beads, so the cloud has a body; it catches too.
  'electro-bruma': {
    shape: 'glow', size: [.16, .26], sizeJitter: .5, blur: 1.2, gravity: 0, drag: 2.6, curl: .25, response: .3,
    colours: ['#f2fcff', '#cfeff5', '#a9dce6'], intensity: [1, .85, .7], middle: .5, fadeIn: .35, fadeOut: .4, additive: .35, opacity: .16, core: 0,
    ignite: { into: 'electro-llama', delay: .07, radius: .3 },
  },
  // The gas burning: a puff that swells and rises, white-hot to orange to soot, and sets its neighbours alight.
  'electro-llama': {
    shape: 'glow', size: [.06, .2], sizeJitter: .45, gravity: -2.4, drag: 1.3, curl: .7, response: .5, blur: [.35, 1], life: [.4, .75],
    colours: ['#fff4d0', '#ff8a24', '#3a2a24'], intensity: [3.6, 2.3, .4], middle: .22, fadeIn: .02, fadeOut: .45, additive: .7, core: .35,
  },
  // Sondeo's bolt: short bright streaks along the jag.
  'electro-arco': {
    shape: 'streak', drag: 3, gravity: 0, curl: .2, size: [.02, .008], sizeJitter: .4, stretch: .03, aspect: .3,
    colours: ['#ffffff', '#fff6b0', '#ffe24a'], intensity: [4, 3, 1.6], middle: .3, fadeIn: .01, fadeOut: .5, additive: 1, core: .6,
  },
  // The water lit from inside: cyan beads that stay where they are born.
  'electro-luz': {
    shape: 'glow', drag: 6, gravity: 0, curl: .05, size: [.04, .02], sizeJitter: .4, blur: .3,
    colours: ['#ffffff', '#9ff0fa', '#3fbcd6'], intensity: [2.4, 1.8, 1], middle: .35, fadeIn: .05, fadeOut: .5, additive: .9, core: .2,
  },
} satisfies Record<string, GpuKind>;

function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  // What catches before what it catches into.
  for (const name of ['electro-llama', ...Object.keys(KINDS).filter(k => k !== 'electro-llama')]) if (!g.get(name)) g.define(name, KINDS[name as keyof typeof KINDS]);
}

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const lift = (p: V3, h: number): V3 => ({ ...p, y: p.y + h });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const lerp = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** How high a foe's water stands over its feet with `marks` (src/freatica-fx.ts `markHeights`, full). */
function levelOf(f: DuoFighter, marks: number) {
  if (marks <= 0) return 0;
  const m = Math.min(3, Math.round(marks)), { ticks, bands } = markHeights(f.height);
  return ticks[m - 1] + bands[m - 1];
}
/** The cloud of gas `level` makes over `f`: where its middle is and how big it is. Over where its body is now (its chest), so it goes with a foe that lunges. */
function cloudOf(f: DuoFighter, level: number) {
  const radius = .22 + .13 * Math.min(3, Math.max(1, level));
  return { at: { x: f.chest.x, y: f.feet.y + Math.min(f.height + .45, 2.6) + radius, z: f.chest.z }, radius };
}
/** How tall the electrodes stand over the floor, by the tallest foe. */
const tallFor = (foes: DuoFighter[]) => Math.max(1.6, Math.min(2.2, Math.max(...foes.map(f => f.height)) * 1.1));
/**
 * The foes from left to right as the camera sees them, and the two electrodes' feet just past the ends: a little behind
 * the line, and further back (and in) until the whole of each, its plate, its bar and its sign, stands clear of the
 * party's panels (`stage.clear`), so neither reads only by half.
 */
function line(stage: DuoStage, foes: DuoFighter[], tall: number) {
  const { right, facing } = screenAxes(stage.view);
  const sorted = [...foes].sort((a, b) => dot(a.feet, right) - dot(b.feet, right));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const floorY = Math.min(...foes.map(f => f.feet.y));
  const seen = (foot: V3) => [0, .5, 1, 1.15].every(k => stage.clear(lift(foot, .02 + k * tall)));
  const place = (from: DuoFighter, side: number) => {
    let foot = { ...add(add(from.feet, right, side * (from.radius + .35)), facing, -.4), y: floorY };
    for (let i = 0; i < 10 && !seen(foot); i++) foot = { ...add(add(foot, facing, -.35), right, -side * .08), y: floorY };
    return foot;
  };
  return { sorted, minus: place(first, -1), plus: place(last, 1), right, facing };
}
/** A jagged line from `a` to `b`: `n` bends, each a little off the straight way. */
function jag(a: V3, b: V3, n: number, off: number, up: V3, side: V3): V3[] {
  const out = [a];
  for (let i = 1; i < n; i++) {
    const k = i / n, w = Math.sin(Math.PI * k);
    out.push(add(add(lerp(a, b, k), up, (Math.random() - .5) * 2 * off * w), side, (Math.random() - .5) * off * w));
  }
  out.push(b);
  return out;
}

/** The fight's seconds as the hold sees them, when this dual last started, and each foe's cloud breathing. */
let clock = 0, startedAt = -99;
const nextPuff = new Map<string, number>();

export const staging: DuoStaging = {
  timing: TIMING,

  start(stage, e, reached) {
    ensure(stage);
    startedAt = clock;
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length || !stage.fx.on) return;
    const fx = stage.fx, g = stage.effects.gpu!;
    const tall = tallFor(foes);
    const { sorted, minus, plus, right, facing } = line(stage, foes, tall);
    const marksOf = (f: DuoFighter) => e.water?.find(w => w.target === f.id)?.from ?? 0;
    const gasOf = (f: DuoFighter) => e.gas?.find(x => x.target === f.id)?.level ?? 0;

    // Gerard plants the electrodes: two bars of gold neon, a plate at the foot of each, and their signs over them.
    const rods = stage.figure('Electrodos', { look: { core: '#ffd98a', halo: '#e0a640' } });
    const bar = (foot: V3) => rods.stroke(neonCurve(10, u => lift(foot, .02 + u * tall)), { radius: .045 });
    const plate = (foot: V3) => rods.stroke(neonCurve(8, u => lift(add(foot, right, (u - .5) * .44), .04)), { radius: .034 });
    const sign = (over: V3, plus: boolean) => {
      const at = lift(over, tall + .26), s = .13;
      const strokes = [rods.stroke([add(at, right, -s), add(at, right, s)], { radius: .034 })];
      if (plus) strokes.push(rods.stroke([add(at, UP, -s), add(at, UP, s)], { radius: .034 }));
      return strokes;
    };
    const bars = [bar(minus), bar(plus)], plates = [plate(minus), plate(plus)];
    const signs = [...sign(minus, false), ...sign(plus, true)];
    stage.draw(rods, bars, PLAN.bars, { delay: PLAN.plant, each: () => stage.cue('mark-set', { volume: .6 }) });
    stage.draw(rods, plates, .1, { delay: PLAN.plant + PLAN.bars - .05, pen: false });
    stage.draw(rods, signs, .14, { delay: PLAN.glyphs });
    for (const foot of [minus, plus]) fx.after(PLAN.plant + PLAN.bars, () => {
      fx.ring(lift(foot, .03), UP, .32, C.gold, { count: 60, outward: 1.2, life: .45, size: 1.4, light: 1.6 });
      fx.burst('flare', { at: lift(foot, .1), count: 1, spread: .02, life: [.18, .25], colour: C.gold, light: { intensity: 1.6, range: 2.5 } });
      stage.cue('glass-tick', { pan: stage.pan(foot) });
    });
    rods.glow(1);
    // The electrodes stay while the gas gathers, then go.
    rods.fade(.45, PLAN.gather + .35);

    // Each foe's water lights up cyan from inside (or the water on it, if it is only wet).
    for (const f of sorted) {
      const marks = marksOf(f), level = levelOf(f, marks), R = f.radius + .25;
      for (let k = 0; k < 4; k++) fx.after(PLAN.light + k * .07, () => {
        if (marks) {
          fx.burst('electro-luz', { at: lift(f.feet, .05 + level * (k + .5) / 4), count: 70, spread: R * .85, life: [.6, .9], colour: k % 2 ? C.cyan : C.ice });
          fx.ring(lift(f.feet, level), UP, R, C.cyan, { kind: 'electro-luz', count: 80, life: .7, size: 1.2 });
        } else if (gasOf(f) && f.index >= 0) {
          fx.burst('electro-luz', { at: f.chest, count: 60, shape: 'surface', fighter: f.index, life: [.5, .8], colour: C.cyan });
        }
      });
      if (marks || gasOf(f)) fx.after(PLAN.light, () => fx.burst('bloom', { at: lift(f.feet, Math.max(.3, level * .6)), count: 1, spread: .02, life: [.5, .7], colour: C.cyan, size: .8, light: { intensity: 2.2, range: 3, colour: C.cyan } }));
    }

    // Sondeo runs from − to +, foe to foe: a jagged bolt, twice over so it flickers.
    const stops = [lift(minus, tall), ...sorted.map(f => f.chest), lift(plus, tall)];
    const legs = stops.length - 1, legTime = PLAN.boltRun / legs;
    for (let i = 0; i < legs; i++) {
      const a = stops[i], b = stops[i + 1], n = Math.max(5, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / .14));
      for (const again of [0, .07]) fx.after(PLAN.bolt + i * legTime + again, () => {
        const path = jag(a, b, n, .16, UP, facing);
        for (let j = 0; j < path.length - 1; j++) fx.burst('electro-arco', { at: path[j], to: path[j + 1], shape: 'line', count: 26, spread: .012, speed: .2, life: [.12, .22], colour: j % 3 ? C.spark : '#ffffff' });
        if (!again) fx.burst('flare', { at: b, count: 1, spread: .02, life: [.1, .16], colour: C.spark, light: { intensity: 2.6, range: 3.5, colour: C.spark } });
      });
      const hitAt = PLAN.bolt + (i + 1) * legTime;
      const f = sorted[i];
      if (f && i < sorted.length) fx.after(hitAt, () => { fx.burst('electro-arco', { at: f.chest, count: 60, spread: f.radius * .5, speed: 2.4, life: [.1, .25], colour: C.spark }); stage.hit(f.id, [1, .95, .5], .7); });
    }
    stage.cue('crack', { delay: PLAN.bolt, volume: .5 });

    // Contact: the water boils. A body of water in each cell, two streams of bubbles through it, 2 : 1.
    fx.after(TIMING.contact, () => {
      for (const f of sorted) {
        const marks = marksOf(f), level = levelOf(f, marks), gas = gasOf(f);
        if (!gas) continue;
        const R = f.radius + .2, cathode = add(f.feet, right, -R * .55), anode = add(f.feet, right, R * .55);
        if (marks) {
          const box = g.volume({ shape: 'box', mode: 'contain', at: lift(f.feet, level / 2), size: { x: R, y: level / 2 + .02, z: R }, bounce: .05, kinds: ['electro-agua'] });
          fx.after(ELECTROLYSIS_DRAIN + .15, () => box.remove());
          const count = Math.round(Math.min(2600, 900 * R * R * level * 2.2));
          // Born staggered to die staggered: as it thins it sinks, as the cell does.
          for (const [k, life] of [[.5, [.35, .8]], [.3, [.8, 1.05]], [.2, [1.05, ELECTROLYSIS_DRAIN]]] as const) g.burst('electro-agua', { at: lift(f.feet, level * .5), count: Math.round(count * k), spread: R * .8, life, colour: C.cyan });
        }
        const top = Math.max(.25, level), out = cloudOf(f, gas).at.y - f.feet.y;
        const reach = (fast: number) => [Math.max(.5, top / fast + (out - top) / 1.6) * .8, Math.max(.6, top / fast + (out - top) / 1.6) * 1.05] as [number, number];
        const shown = .4 + .3 * gas;
        const h2 = g.emitter('electro-h2', { at: lift(cathode, .06), rate: 260 * shown, spread: .2, velocity: UP, speed: .3, life: reach(2.6) });
        const o2 = g.emitter('electro-o2', { at: lift(anode, .06), rate: 130 * shown, spread: .2, velocity: UP, speed: .3, life: reach(2.4) });
        fx.after(ELECTROLYSIS_DRAIN, () => { h2.remove(); o2.remove(); });
        // Off the body of a foe that was only wet.
        if (!marks && f.index >= 0) for (let k = 0; k < 8; k++) fx.after(k * .1, () => {
          fx.burst('electro-h2', { at: f.chest, count: 40, shape: 'surface', fighter: f.index, up: .6, speed: .2, life: [.8, 1.1] });
          fx.burst('electro-o2', { at: f.chest, count: 20, shape: 'surface', fighter: f.index, up: .6, speed: .2, life: [.8, 1.1] });
        });
      }
    });
    stage.cue('bubbles', { delay: TIMING.contact - .05 });
    stage.cue('bubbles', { delay: TIMING.contact + .7, volume: .7 });

    // 1.6–2.4 s: the bubbles gather over each foe into a cloud, as big as its gas.
    for (let k = 0; k < 8; k++) fx.after(PLAN.gather + k * .1, () => {
      for (const f of sorted) {
        const gas = gasOf(f);
        if (!gas) continue;
        const c = cloudOf(f, gas);
        g.burst('electro-gas', { at: c.at, count: Math.round(40 * gas), spread: c.radius * (1.7 - k * .08), outward: -.9, speed: .08, life: [1.3, 1.9], colour: k % 3 === 2 ? C.o2 : C.h2 });
        if (k % 2) g.burst('electro-bruma', { at: c.at, count: 4 + 3 * gas, spread: c.radius * .8, speed: .05, life: [1.4, 1.9] });
      }
    });
  },

  land(stage, _e, reached) {
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    for (const f of foes) stage.hit(f.id, [.6, .95, 1], 1.1);
    stage.shake(.35); stage.punch(.35); stage.pulse(.4, .8, .15);
  },

  hold(stage, dt, state, playing) {
    clock += dt;
    holdGas(stage, dt, state, playing);
  },

  struck(stage, e) {
    if (e.ignited) ignition(stage, e);
  },
};

/** The clouds breathe while the gas waits: a few puffs a second over each foe that carries it, its size by its level. */
function holdGas(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  // Every frame of every fight: nothing made unless some foe carries gas.
  const carries = (u: BattleState['foes'][number]) => u.hp > 0 && !!u.timed?.gas;
  if (!nextPuff.size && !state.foes.some(carries)) return;
  for (const id of nextPuff.keys()) if (!state.foes.some(u => u.id === id && carries(u))) nextPuff.delete(id);
  if (!stage.fx.on) return;
  if (playing?.dual?.id === 'electrolisis' && clock - startedAt < TIMING.end) return;
  ensure(stage);
  for (const u of state.foes) {
    if (!carries(u)) continue;
    const f = stage.fighter(u.id);
    if (!f) continue;
    const left = (nextPuff.get(u.id) ?? 0) - dt;
    if (left > 0) { nextPuff.set(u.id, left); continue; }
    nextPuff.set(u.id, .22);
    const level = u.timed!.gas!.level, c = cloudOf(f, level), breath = 1 + .14 * Math.sin(clock * 2.3 + f.feet.x);
    // Its last seconds, thinner.
    const fading = Math.min(1, u.timed!.gas!.left / 3);
    stage.fx.burst('electro-gas', { at: c.at, count: Math.round(34 * level * fading), spread: c.radius * breath, outward: -.25, speed: .06, life: [1.3, 1.8], colour: Math.random() < 1 / 3 ? C.o2 : C.h2 });
    stage.fx.burst('electro-bruma', { at: c.at, count: Math.round((2 + level) * fading), spread: c.radius * .75 * breath, speed: .04, life: [1.4, 1.9] });
  }
}

/**
 * The gas goes up: the front of fire through each cloud in the order the rule set them off, `IGNITION_GAP` apart. Each
 * cloud gets fresh gas (the front has something dense to run through), a point of fire that sweeps across it from the
 * side the last one was on, then its crack, a ring of pressure on the floor, a flash on the foe and a drizzle of water.
 */
function ignition(stage: DuoStage, e: BattleEffect) {
  ensure(stage);
  const g = stage.effects.gpu;
  if (!g || !stage.fx.on) return;
  const fx = stage.fx, clouds = e.ignited!.hits.flatMap(h => { const f = stage.fighter(h.target); return f ? [{ f, ...cloudOf(f, h.level), level: h.level }] : []; });
  // Fresh gas in every cloud at once, so the front has something to run through even where the hold's has thinned.
  for (const c of clouds) g.burst('electro-gas', { at: c.at, count: 90 * c.level, spread: c.radius, speed: .04, life: [1.8, 2.2], colour: C.h2 });
  // The front through each cloud in turn (src/deflagrate.ts, as Fin de fiesta's powder): where it reaches, the crack.
  deflagrate(g, fx.after, clouds, { start: .03, gap: IGNITION_GAP, sweep: .26, steps: 16, across: screenAxes(stage.view).right }, (c0, i, start) => {
    const c = clouds[i];
    fx.after(start + .02, () => {
      stage.cue('gas-crack', { pan: stage.pan(c.at), volume: .8 + .1 * c.level });
      stage.fluid.fireball(c.at, .25 + .12 * c.level, .45 + .2 * c.level, { smoke: false });
      fx.burst('bloom', { at: c.at, count: 1, spread: .02, life: [.25, .35], colour: C.flame, size: .7 + .25 * c.level, light: { intensity: 3 + c.level, range: 4 + c.level, colour: C.flame } });
    });
    fx.after(start + .12, () => {
      fx.burst('floorring', { at: lift(c.f.feet, .04), count: 1, spread: .01, life: [.4, .55], colour: C.ember, size: .9 + .35 * c.level });
      fx.ring(lift(c.f.feet, .05), UP, c.f.radius + .35, C.ember, { count: 90, outward: 3.2 + c.level, life: .4, size: 1.3 });
      stage.hit(c.f.id, [1, .62, .25], 1.2 + .2 * c.level);
      stage.shake(.18 + .1 * c.level); stage.pulse(.25, .6 + .15 * c.level, .08 * c.level);
    });
    // Hydrogen and oxygen make water: a fine drizzle out of where the cloud was (it wets nobody).
    fx.after(start + .26 + .15, () => stage.fluid.burst('fluido-agua', { at: c0.at, count: Math.round(110 * c.level), spread: c.radius * .9, speed: .25, life: [.7, 1.1], size: .45 }));
  });
  stage.punch(.3);
}
