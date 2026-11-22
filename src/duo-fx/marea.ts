import type { BattleEffect, BattleState } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { AGUA, markHeights } from '../freatica-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Marea (Vasos comunicantes + Recarga), dúo mayor: every foe's water rises to the highest's and a
 * mark more, and for 20 s what rises in one rises in all. Drawn as the sea: one body of water, one
 * level for all of them.
 *
 * - **Start**: Gerard draws the level in chalk-gold, one long line across the field at the height the
 *   water will reach, a small `=` over its middle. The sea draws back first: water runs away along
 *   the floor from under the foes, the way the shore empties before a big wave. Then, behind them, a
 *   wave rises out of nothing and comes on, growing as it comes: a wall of teal glass, deep blue at its
 *   foot, its crest curling over in white foam, spray torn off its lip.
 * - **Land**: it breaks over every foe at once. Foam bursts up and over each, spray columns, sheets of
 *   foam race along the floor and drops fall back; the level line flashes gold and turns into the
 *   surface of one calm sea across all of them, rocking smaller until it is still.
 * - **Hold** (`marea`): the swell: every few seconds a low wave rolls across every foe under Marea, a
 *   lace of foam at each one's waterline; when water rises on one of them, a bigger wave runs through
 *   them all.
 *
 * Matemágico's chalk-gold and Freática's teal and deep blue; no pink, no violet (docs/visual-style.md).
 */

const C = { gold: '#f3cf78', chalk: '#fff1cc', teal: '#27c2a0', foam: '#eafffb', sea: '#5fd9c0', deep: '#1f5fd8', abyss: '#123e7a' } as const;

const KINDS = {
  // Gerard's chalk: dots of gold light that stay where drawn.
  'marea-chalk': {
    shape: 'dot', drag: 14, gravity: .5, curl: .05, response: 0, size: [.016, .012], sizeJitter: .35,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.1, 1.7, 1.1], middle: .35, fadeIn: .04, fadeOut: .3, additive: .85, flicker: .1, core: .2,
  },
  // The wave's body: beads of teal glass, lit at the top and deep blue at the foot (tinted per line).
  'marea-body': {
    shape: 'dot', glass: .3, blur: [.25, .45], drag: 7, gravity: 0, curl: .35, response: .3, size: [.019, .023], sizeJitter: .5,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.7, 1.45, 1.15], middle: .4, fadeIn: .15, fadeOut: .4, additive: .45, opacity: .85, core: .2,
  },
  // The wave's water, a fluid (src/fight-particles.ts § The fluid): beads of glass that push each other
  // apart where they crowd and are carried by the flow round them, so they rise, fall and spread as one body.
  'marea-water': {
    shape: 'glow', blur: [.55, .8], drag: .3, gravity: 9, curl: .1, response: .2, collide: true, bounce: .02, friction: .45,
    size: [.07, .075], sizeJitter: .35, colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.35, 1.2, .95], middle: .5,
    fadeIn: .06, fadeOut: .3, additive: .18, opacity: .8, core: 0, fluid: { pressure: 14, viscosity: 6, rest: 10 },
  },
  // Its foam, the same fluid but white and matte: the crest and what the crash throws up.
  'marea-froth': {
    shape: 'powder', blur: [.3, .6], drag: .5, gravity: 7, curl: .9, response: .6, collide: true, bounce: .05, friction: .45,
    size: [.05, .09], sizeJitter: .55, colours: ['#ffffff', '#f2fffc', '#cdeee8'], intensity: [1.4, 1.2, 1], middle: .35,
    fadeIn: .04, fadeOut: .35, additive: .2, opacity: .85, core: 0, fluid: { pressure: 10, viscosity: 5, rest: 10 },
  },
  // Foam: white matte froth, heavy, that tumbles and falls.
  'marea-foam': {
    shape: 'powder', blur: [.2, .6], drag: 2.2, gravity: 3.2, curl: 1.2, response: .8, size: [.05, .11], sizeJitter: .6,
    colours: ['#ffffff', '#f2fffc', '#cdeee8'], intensity: [1.5, 1.3, 1.05], middle: .3, fadeIn: .04, fadeOut: .45, additive: .25, opacity: .92, core: 0,
  },
  // Spray torn off the lip: fine white streaks.
  'marea-spray': {
    shape: 'streak', blur: [0, .4], drag: .9, gravity: 4, curl: .4, response: .3, size: [.012, .006], sizeJitter: .5, stretch: .06, aspect: .18,
    colours: ['#ffffff', '#e8fffb', '#9fe8d8'], intensity: [2.6, 1.9, 1.1], middle: .3, fadeOut: .4, additive: .8,
  },
  // Drops that fall back and are gone on the floor.
  'marea-drop': {
    shape: 'dot', glass: .35, drag: .5, gravity: 9, collide: true, bounce: 0, friction: 1, size: [.024, .012], sizeJitter: .6,
    colours: ['#ffffff', '#c6f3ea', '#4fcfb4'], intensity: [1.8, 1.4, 1], fadeOut: .3, additive: .4, opacity: .9, core: .6, onLand: 'marea-sheet',
  },
  // Foam lying on the floor and racing along it as the wave spends itself.
  'marea-sheet': {
    shape: 'dot', flat: true, drag: 2.6, gravity: 9, collide: true, bounce: 0, friction: .35, settle: true, size: [.06, .11], sizeJitter: .5,
    colours: ['#ffffff', '#dffcf6', '#5fd9c0'], intensity: [1.4, 1.15, .9], middle: .4, fadeOut: .5, additive: .3, opacity: .85, core: 0, life: [.7, 1.1],
  },
} satisfies Record<string, GpuKind>;
const FALLBACK: Record<keyof typeof KINDS, string> = { 'marea-water': 'agua-gota', 'marea-froth': 'fleck', 'marea-chalk': 'glyph', 'marea-body': 'glyph', 'marea-foam': 'fleck', 'marea-spray': 'gale', 'marea-drop': 'fleck', 'marea-sheet': 'fleck' };
const K: Record<string, string> = { ...Object.fromEntries(Object.keys(KINDS).map(k => [k, k])), flow: 'gale', ring: 'floorring' };

function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  // The sheet first: the drops become it when they land.
  for (const name of ['marea-sheet', ...Object.keys(KINDS).filter(k => k !== 'marea-sheet')]) {
    if (g.get(name)) continue;
    try { g.define(name, KINDS[name as keyof typeof KINDS]); } catch { K[name] = FALLBACK[name as keyof typeof KINDS]; }
  }
}

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const lift = (p: V3, h: number): V3 => ({ ...p, y: p.y + h });
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** How high a foe's water stands over its feet with `marks` (its top mark `left` of the way full), as its cell draws it (src/freatica-fx.ts). */
function levelOf(f: DuoFighter, marks: number, left = 1) {
  if (marks <= 0) return 0;
  const m = Math.min(3, Math.round(marks)), { ticks, bands } = markHeights(f.height);
  return ticks[m - 1] + bands[m - 1] * clamp01(left);
}

/**
 * The sea's frame over the foes: `front` runs along the line of them, `travel` the way the wave comes
 * (from behind them towards the party), `origin` the middle of their feet on the floor. `d` is where the
 * foes stand along `travel`, `width` how wide the wave is.
 */
function seaFrame(stage: DuoStage, foes: DuoFighter[]) {
  const party = stage.party(), facing = screenAxes(stage.view).facing;
  const centre = foes.reduce((s, f) => add(s, f.feet, 1 / foes.length), { x: 0, y: 0, z: 0 });
  const floorY = Math.min(...foes.map(f => f.feet.y));
  const toward = party.length ? party.reduce((s, f) => add(s, f.feet, 1 / party.length), { x: 0, y: 0, z: 0 }) : add(centre, facing, 3);
  let tx = toward.x - centre.x, tz = toward.z - centre.z;
  const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const travel: V3 = { x: tx, y: 0, z: tz }, front: V3 = { x: -tz, y: 0, z: tx };
  const origin: V3 = { ...centre, y: floorY };
  const along = foes.map(f => (f.feet.x - origin.x) * front.x + (f.feet.z - origin.z) * front.z);
  const margin = 1.1 + Math.max(...foes.map(f => f.radius));
  const s0 = Math.min(...along) - margin, s1 = Math.max(...along) + margin;
  const at = (s: number, d: number, h: number): V3 => ({ x: origin.x + front.x * s + travel.x * d, y: origin.y + h, z: origin.z + front.z * s + travel.z * d });
  return { travel, front, origin, s0, s1, width: s1 - s0, at, floorY };
}
type Sea = ReturnType<typeof seaFrame>;

/** A line along the whole front at (`d`, `h`): one burst, so a wave of many lines costs few. */
function rank(stage: DuoStage, sea: Sea, d: number, h: number, kind: string, colour: string, perMetre: number, life: number, o: { spread?: number; velocity?: V3; speed?: number; size?: number } = {}) {
  stage.fx.burst(kind, { at: sea.at(sea.s0, d, h), to: sea.at(sea.s1, d, h), shape: 'line', count: Math.round(sea.width * perMetre), spread: o.spread ?? .06, life: [life * .8, life], colour, size: o.size ?? 1, ...o.velocity ? { velocity: o.velocity, speed: o.speed ?? .2 } : {} });
}

/** The colour of the wave's water `k` up its body: abyss at the foot, deep blue, teal, sea, foam at the crest. */
function waterAt(k: number) {
  return k < .2 ? C.abyss : k < .45 ? C.deep : k < .75 ? C.teal : k < .97 ? C.sea : C.foam;
}

let clock = 0, startedAt = -99;
const timing = { contact: 1.55, end: 3.1 };
/** When the sea draws back, when the wave shows, and how far behind the foes it rises (m). */
const PLAN = { retreat: [.08, .4], wave: .42, behind: 3, layers: 15, settle: 1.1 } as const;

export const staging: DuoStaging = {
  timing,
  start(stage, e, reached) {
    ensure(stage);
    startedAt = clock;
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length) return;
    const sea = seaFrame(stage, foes), T = timing.contact;
    const dFoes = foes.reduce((s, f) => s + (f.feet.x - sea.origin.x) * sea.travel.x + (f.feet.z - sea.origin.z) * sea.travel.z, 0) / foes.length;
    // The one level they will share: the highest's and a mark more.
    let top = 1;
    for (const w of e.water ?? []) top = Math.max(top, w.to);
    const level = foes.reduce((s, f) => s + levelOf(f, top), 0) / foes.length;

    // Gerard's level: a chalk-gold line across the field at that height, just in front of them, and a small `=` over its middle.
    const gold = stage.wearer('matemagico'), dLine = dFoes + .9, mid = (sea.s0 + sea.s1) / 2;
    if (gold?.hand) stage.effects.trails.comet(gold.hand, sea.at(sea.s0, dLine, level), [C.chalk, C.gold], .2, { arc: .7, width: .06, life: .35, intensity: 2.6, core: .4 });
    const n = 24;
    for (let i = 0; i < n; i++) stage.fx.after(.2 + i * .012, () => {
      const a = sea.at(sea.s0 + sea.width * i / n, dLine, level), b = sea.at(sea.s0 + sea.width * (i + 1) / n, dLine, level);
      stage.fx.line(a, b, C.gold, { kind: K['marea-chalk'], life: T + .15 - (.2 + i * .012), size: 1.5 });
    });
    stage.fx.after(.52, () => {
      const { up, right } = screenAxes(stage.view), eq = sea.at(mid, dLine, level + .34);
      for (const dy of [.045, -.045]) stage.fx.line(add(add(eq, up, dy), right, -.13), add(add(eq, up, dy), right, .13), C.chalk, { kind: K['marea-chalk'], life: T - .4, size: 1.7 });
      stage.fx.burst('flare', { at: eq, count: 1, spread: .02, life: [.12, .2], colour: C.gold, light: { intensity: 1.4, range: 3 } });
    });

    // The sea draws back: water runs away along the floor from under them towards where the wave will rise.
    const water = stage.wearer('freatica');
    if (water?.feet) stage.effects.trails.comet(lift(water.feet, .05), sea.at(mid, dFoes, .06), ['#e8fff8', C.teal], .2, { arc: .05, width: .05, life: .4, intensity: 2.4, core: .5 });
    for (let k = 0; k < 6; k++) stage.fx.after(PLAN.retreat[0] + k * (PLAN.retreat[1] - PLAN.retreat[0]) / 6, () => {
      for (const f of foes) {
        const back = { x: -sea.travel.x * 4.5, y: 0, z: -sea.travel.z * 4.5 };
        stage.fx.burst(K.flow, { colour: C.sea, at: lift(f.feet, .05), count: 26, spread: f.radius + .3, velocity: back, speed: .6, life: [.45, .6] });
      }
      rank(stage, sea, dFoes + .3 - k * .5, .04, K['marea-body'], C.teal, 26, .35, { spread: .15, velocity: { x: -sea.travel.x * 3, y: 0, z: -sea.travel.z * 3 }, speed: .3 });
    });

    // The wave: a wall of water standing up out of the sea behind them, layer on layer to over two metres,
    // each higher layer on its way faster, so the wall leans, its top overtakes its foot and falls on
    // them; the fluid keeps it one mass as it comes, and when it lands it spreads out over the floor.
    const on = sea.travel;
    for (let j = 0; j < PLAN.layers; j++) {
      const k = j / (PLAN.layers - 1), at = PLAN.wave + j * .012, h = .12 + k * 2.1;
      stage.fx.after(at, () => {
        for (const back of [0, .32]) {
          rank(stage, sea, dFoes - PLAN.behind - back - k * .25, h, K['marea-water'], waterAt(k), 22, 2.2 + k * .5, {
            spread: .12, velocity: { x: on.x * (1 + 3 * k), y: .6 + 1.4 * k, z: on.z * (1 + 3 * k) }, speed: .2,
          });
        }
        // Its crest in foam.
        if (k > .85) rank(stage, sea, dFoes - PLAN.behind - .2, h + .08, K['marea-froth'], C.foam, 8, 2.2, { spread: .1, velocity: { x: on.x * (1.3 + 3 * k), y: .8 + 1.4 * k, z: on.z * (1.3 + 3 * k) }, speed: .25 });
      });
    }
    // Spray torn off the top as it climbs, back over it by the wind, and a mist off its foot.
    for (let i = 0; i < 9; i++) stage.fx.after(PLAN.wave + .15 + i * .08, () => {
      const u = i / 8, crest = dFoes - PLAN.behind + 3.2 * u, h = .4 + 1.7 * Math.sin(Math.PI * Math.min(1, u * .9));
      rank(stage, sea, crest, h, K['marea-spray'], C.foam, 7, .5, { spread: .2, velocity: { x: -on.x * 2, y: 2.4, z: -on.z * 2 }, speed: 1.1 });
      if (i % 2 === 0) rank(stage, sea, crest - .8, .1, K['marea-spray'], C.sea, 10, .45, { spread: .25, velocity: { x: on.x * 2, y: .5, z: on.z * 2 }, speed: .6 });
      stage.shake(.05 + .03 * i);
    });
    // A light that comes with it, teal, brightest as it stands over them.
    [.6, 1, 1.35].forEach((at, k) => stage.fx.after(at, () => {
      const u = (at - PLAN.wave) / (T - PLAN.wave), crest = dFoes - PLAN.behind + PLAN.behind * u;
      stage.fx.burst('bloom', { at: sea.at(mid, crest, 1 + k * .5), count: 1, spread: .02, life: [.3, .4], colour: C.sea, size: .7 + k * .4, light: { intensity: 1.5 + k, range: 5 + k * 2, colour: C.sea } });
    }));
    stage.cue('rise', { delay: PLAN.retreat[0] }); stage.cue('splash', { delay: PLAN.wave + .05 }); stage.cue('splash', { delay: 1.2 });

    // After it breaks: one calm sea across them at the level, rocking smaller until it is still.
    const settle = Math.round(PLAN.settle * 30);
    for (let i = 0; i <= settle; i++) {
      const t = T + .5 + i / 30, k = i / settle;
      stage.fx.after(t, () => {
        const amp = .14 * Math.exp(-k * 3.2), fade = 1 - k * .7;
        // Its surface round each of them at the one level, rocking smaller: rings of water and foam (the
        // water itself is in each foe's cell; lines across the field would stand up like poles in this view).
        for (const f of foes) {
          const h = Math.max(.05, levelOf(f, top) + amp * Math.sin(t * 9 + f.feet.x)), R = f.radius + .35 + amp * .8;
          stage.fx.burst(K['marea-body'], { at: lift(f.feet, h), shape: 'ring', spread: R, count: Math.round(70 * fade), life: [.07, .09], colour: C.sea, size: 1.1 });
          stage.fx.burst(K['marea-body'], { at: lift(f.feet, h + .03), shape: 'ring', spread: R * 1.08, count: Math.round(50 * fade), life: [.07, .09], colour: C.foam, size: 1 });
        }
        // Foam left on the floor, drifting back out.
        if (i % 3 === 0) rank(stage, sea, dFoes + 1.4, .03, K['marea-sheet'], C.foam, 10 * fade, .6, { spread: .5, velocity: { x: -sea.travel.x * .8, y: 0, z: -sea.travel.z * .8 }, speed: .2 });
      });
    }
  },
  land(stage, e, reached) {
    ensure(stage);
    const foes = (reached.length ? reached : stage.foes()).filter(f => !f.party);
    if (!foes.length) return;
    const sea = seaFrame(stage, foes);
    const dFoes = foes.reduce((s, f) => s + (f.feet.x - sea.origin.x) * sea.travel.x + (f.feet.z - sea.origin.z) * sea.travel.z, 0) / foes.length;
    let top = 1;
    for (const w of e.water ?? []) top = Math.max(top, w.to);
    const level = foes.reduce((s, f) => s + levelOf(f, top), 0) / foes.length, on = sea.travel;
    // The crash: spray thrown high along its whole length (the water itself lands by its own weight).
    rank(stage, sea, dFoes, 1.8, K['marea-spray'], C.foam, 40, .8, { spread: .4, velocity: { x: on.x * 1.5, y: 4.5, z: on.z * 1.5 }, speed: 2.2 });
    // Over each foe: a burst of foam, a column of spray, a ring on the water, teal light.
    for (const f of foes) {
      const head = lift(f.feet, f.height * .9);
      stage.fx.burst(K['marea-froth'], { at: head, count: 50, spread: f.radius + .2, velocity: { x: on.x * 1.4, y: 3.2, z: on.z * 1.4 }, speed: 2, life: [1.2, 1.8], colour: C.foam });
      stage.fx.burst(K['marea-water'], { at: lift(f.feet, .25), count: 70, shape: 'ring', spread: f.radius * .7, velocity: { x: 0, y: 5, z: 0 }, speed: 1.2, outward: 1.4, life: [1.4, 2], colour: C.sea });
      stage.fx.burst(K.ring, { colour: C.foam, at: lift(f.feet, Math.max(.05, levelOf(f, top))), count: 1, spread: .01, life: [.55, .7], size: .7 + f.radius * .6 });
      stage.fx.burst('bloom', { at: f.chest, count: 1, spread: .02, life: [.2, .3], colour: C.sea, size: .9, light: { intensity: 3, range: 4, colour: C.sea } });
      stage.hit(f.id, [.5, .95, 1], 1.4);
    }
    // The level flashes gold as the sea takes it.
    const mid = (sea.s0 + sea.s1) / 2, eq = sea.at(mid, dFoes + .9, level + .34);
    stage.fx.burst(K['marea-chalk'], { colour: C.gold, at: eq, count: 40, spread: .2, speed: .8, life: [.5, .9] });
    rank(stage, sea, dFoes + .9, level, K['marea-chalk'], C.gold, 60, .5, { spread: .02, size: 1.6 });
    stage.shake(.75); stage.punch(.6); stage.pulse(.6, 1, .25);
    stage.cue('splash'); stage.cue('crack', { delay: .02 }); stage.cue('mark-set', { delay: .25 });
  },
  hold(stage, dt, state, playing) {
    clock += dt;
    holdMarea(stage, dt, state, playing);
  },
};

// ── The hold: the swell over everyone under Marea ──
const lastMarks = new Map<string, number>();
/** Swells rolling across them now: when each started (the hold's clock) and how high. */
const swells: { at: number; height: number }[] = [];
let nextSwell = 0, nextLace = 0;
const SWELL = { every: 2.6, seconds: 1.4, height: .22, big: .55 } as const;

function holdMarea(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined) {
  const under = state.foes.filter(f => f.hp > 0 && f.timed?.marea);
  const seen = new Set(under.map(f => f.id));
  for (const id of [...lastMarks.keys()]) if (!seen.has(id)) lastMarks.delete(id);
  if (!under.length) { swells.length = 0; nextSwell = 0; return; }
  // Water rose on one of them, so on all: a bigger wave through them.
  let rose = false;
  for (const u of under) {
    const m = u.timed?.agua?.level ?? 0, before = lastMarks.get(u.id);
    if (before !== undefined && m > before) rose = true;
    lastMarks.set(u.id, m);
  }
  if (playing?.dual?.id === 'marea' && clock - startedAt < timing.end) return;
  const foes = under.flatMap(u => { const f = stage.fighter(u.id); return f && f.hp > 0 ? [{ u, f }] : []; });
  if (!foes.length) return;
  ensure(stage);
  if (rose) { swells.push({ at: clock, height: SWELL.big }); stage.cue('splash'); }
  if ((nextSwell -= dt) <= 0) { nextSwell = SWELL.every; swells.push({ at: clock, height: SWELL.height }); }
  const sea = seaFrame(stage, foes.map(x => x.f));
  const dOf = (f: DuoFighter) => (f.feet.x - sea.origin.x) * sea.travel.x + (f.feet.z - sea.origin.z) * sea.travel.z;
  const ds = foes.map(x => dOf(x.f)), dMin = Math.min(...ds), span = Math.max(.5, Math.max(...ds) - dMin);
  const level = (x: typeof foes[number]) => Math.max(.08, levelOf(x.f, x.u.timed?.agua?.level ?? 0, (x.u.timed?.agua?.left ?? 0) / AGUA.mark));
  // Each swell rolls through them from the back one to the front one: each one's water lifts and falls
  // in turn as a ring, foam on it at its top, the bigger swell throwing foam off.
  for (let i = swells.length - 1; i >= 0; i--) {
    const sw = swells[i], u = (clock - sw.at) / SWELL.seconds;
    if (u > 1.5) { swells.splice(i, 1); continue; }
    for (const x of foes) {
      const k = clamp01((u - (dOf(x.f) - dMin) / span * .5) / .9);
      if (k <= 0 || k >= 1) continue;
      const H = sw.height * Math.sin(Math.PI * k), R = x.f.radius + .3 + H * .6, at = lift(x.f.feet, level(x) + H);
      stage.fx.burst(K['marea-body'], { at, shape: 'ring', spread: R, count: Math.round(10 + 50 * Math.sin(Math.PI * k)), life: [.06, .08], colour: H > sw.height * .7 ? C.foam : C.sea, size: 1.1 });
      if (sw.height > SWELL.height && Math.abs(k - .5) < .04) stage.fx.burst(K['marea-foam'], { at, count: 60, shape: 'ring', spread: R, outward: 1.2, up: 1, speed: .5, life: [.4, .7], colour: C.foam });
    }
  }
  // A lace of foam at each one's waterline, now and then.
  if ((nextLace -= dt) <= 0) {
    nextLace = .7;
    // Beads that hang where they are born (the sheet would fall to the floor from up there).
    for (const x of foes) stage.fx.burst(K['marea-body'], { at: lift(x.f.feet, level(x) + .02), count: 8, shape: 'ring', spread: x.f.radius + .3, outward: .15, speed: .03, life: [.5, .8], colour: C.sea });
  }
}
