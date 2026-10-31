import * as pc from 'playcanvas';
import { createParticles, type ParticleAttractor, type ParticleBody, type ParticleEmitter, type ParticleKind, type ParticleWorld, type Vec } from './particles.ts';
import { propCells, type Environment } from './environments.ts';
import { createTrails, type CometOptions } from './trails.ts';

/**
 * What the game's particles look like and how they behave (the engine is src/particles.ts):
 * one-off kinds anyone can `emit`, battle moments built from several of them, and each scene's
 * air, which drifts, swirls around people and settles on the floor (docs/graphics.md).
 */
const KINDS = {
  // Footfalls and landings: little lit puffs that roll out low and settle on the floor.
  dust: { shape: 'puff', colour: ['#d8ccae', '#c9bb98'], opacity: .9, life: [.6, 1.1], size: [.06, .11], sizeEnd: 1.7, growIn: .15, fadeOut: .5, speed: [.25, .6], rise: [.15, .45], gravity: .7, drag: 2.6, wander: .08, wanderRate: 2, flow: .05, collide: true, friction: .5, bodies: .5 },
  // Someone leaving a fight, or arriving: soft smoke that swells, turns and rises.
  poof: { shape: 'smoke', colour: ['#f1e9d4', '#d7d0bf'], glow: .15, life: [.8, 1.3], size: [.16, .28], sizeEnd: 2.3, growIn: .12, fadeOut: .6, speed: [.8, 1.6], rise: [.5, 1], gravity: -.35, drag: 3.2, wander: .15, flow: .25, spin: [20, 80], collide: true, bodies: .4 },
  // Contact: hot streaks that fly out, fall and skip on the floor.
  spark: { shape: 'spark', orient: 'velocity', colour: ['#fff1c8', '#ffad42'], additive: 1, glow: 1, intensity: 3, life: [.28, .55], size: [.022, .04], fadeOut: .4, speed: [3, 6], rise: [1, 2.6], gravity: 9, drag: 1.2, collide: true, bounce: .45, friction: .3, stretch: .06 },
  // Cardioide and other cures: green light rising in loose spirals, twinkling.
  heal: { shape: 'glow', colour: ['#d8ffb0', '#62c447'], additive: 1, glow: 1, intensity: 1.8, life: [.9, 1.5], size: [.08, .15], fadeIn: .1, fadeOut: .5, speed: [.2, .5], rise: [.9, 1.6], gravity: -.3, drag: 1.5, wander: .25, wanderRate: 3, flow: .2, flicker: .3, flickerRate: 4 },
  // La Reina Bubbaloo: gum drops that fly, fall and stay stuck where they land as splats…
  goo: { shape: 'puff', colour: ['#ff5fa2', '#ff4f98'], glow: .25, life: [1.6, 2.4], size: [.06, .12], speed: [1.4, 2.6], rise: [2, 3.2], gravity: 9, drag: .5, collide: true, pop: true, onLand: { kind: 'splat', count: 1, inherit: true } },
  splat: { shape: 'splat', orient: 'ground', colour: '#ff5fa2', glow: .2, life: [2.6, 3.6], size: [.1, .18], growIn: .1, fadeOut: .3, gravity: 30, collide: true, stick: true },
  // …and her glowing pink motes, which wander and part around whoever walks through them.
  spore: { shape: 'glow', colour: ['#ff9bd0', '#ff5fa8'], additive: .8, glow: 1, intensity: 1.6, life: [1.4, 2.2], size: [.06, .1], fadeIn: .15, fadeOut: .45, speed: [.2, .45], rise: [.4, .9], gravity: -.15, drag: 1.2, wander: .3, wanderRate: 1.5, flow: .35, flicker: .35, flickerRate: 2.5, bodies: .6 },
  // Battle accents.
  flash: { shape: 'glow', colour: '#fff4da', additive: 1, glow: 1, intensity: 1.6, life: [.12, .16], size: [.55, .7], sizeEnd: 1.6, fadeOut: 1 },
  shock: { shape: 'ring', orient: 'ground', colour: ['#fff1c8', '#ffc861'], additive: 1, glow: 1, intensity: 2, life: [.38, .46], size: [.3, .34], sizeEnd: 5, fadeOut: .8 },
  ward: { shape: 'ring', colour: ['#e4f5ff', '#8fc8ff'], additive: 1, glow: 1, intensity: 2, life: [.32, .4], size: [.75, .8], sizeEnd: 1.25, fadeOut: .7 },
  star: { shape: 'star', colour: ['#fff6cf', '#ffd76a'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .9], size: [.1, .17], growIn: .1, fadeOut: .5, speed: [.4, 1.2], rise: [.6, 1.4], gravity: 1.5, drag: 2, spin: [60, 180], flicker: .4, flickerRate: 6 },
  ember: { shape: 'glow', colour: ['#fff2c4', '#ffb84a'], additive: 1, glow: 1, intensity: 2.5, life: [.8, 1.4], size: [.055, .1], fadeOut: .5, speed: [.6, 1.2], rise: [1, 2.2], gravity: -.4, drag: 1.4, wander: .25, flow: .3, flicker: .2, flickerRate: 5 },
  ink: { shape: 'puff', colour: '#c8323c', glow: .1, life: 2, size: [.035, .07], speed: [1.5, 3], rise: [1.5, 3], gravity: 9, drag: .4, collide: true, pop: true, onLand: { kind: 'splat', count: 1, inherit: true } },
  confetti: { shape: 'confetti', colour: '#f3cf78', glow: .2, life: [3.5, 5], size: [.05, .07], fadeOut: .2, speed: [1.5, 3.2], rise: [3.5, 5.5], gravity: 4, drag: 1.7, wander: .5, wanderRate: 2.5, flow: .3, spin: [90, 300], tumble: 1.6, collide: true, stick: true, bodies: .3 },
  bubble: { shape: 'bubble', colour: ['#ffd0e6', '#ff8cc4'], additive: .35, glow: .6, life: [2.5, 4], size: [.07, .15], growIn: .3, fadeIn: .1, rise: [.25, .55], gravity: -.25, drag: 1, wander: .2, wanderRate: 1, flow: .3, collide: true, bounce: .5, bodies: .8, onDeath: { kind: 'pop', count: 5, inherit: true } },
  pop: { shape: 'glow', colour: '#ffd0e6', additive: 1, glow: 1, intensity: 2, life: [.2, .35], size: [.018, .03], fadeOut: .6, speed: [.6, 1.2], drag: 3 },
  // Elements, for skills and states: fire…
  flame: { shape: 'flame', colour: ['#ffe08a', '#ff3a12'], additive: 1, glow: 1, intensity: 1.7, life: [.6, 1], size: [.17, .3], aspect: [.8, 1.35], sizeEnd: .4, growIn: .15, fadeOut: .35, speed: [.2, .6], rise: [1, 1.8], gravity: -2, drag: 2, wander: .25, wanderRate: 4, flow: .45 },
  cinder: { shape: 'glow', colour: ['#ffd27a', '#ff5a1f'], additive: 1, glow: 1, intensity: 3, life: [.7, 1.3], size: [.035, .06], fadeOut: .5, speed: [.3, .9], rise: [1.5, 3], gravity: -.6, drag: 1.2, wander: .35, wanderRate: 5, flow: .4, flicker: .5, flickerRate: 8 },
  soot: { shape: 'smoke', colour: ['#4a3d38', '#2a2422'], opacity: .55, life: [1, 1.6], size: [.15, .25], sizeEnd: 2.6, fadeIn: .2, fadeOut: .6, speed: [.1, .3], rise: [.8, 1.4], gravity: -.8, drag: 1.5, flow: .4, spin: [20, 60] },
  // …ice…
  shard: { shape: 'spark', orient: 'velocity', colour: ['#f4fdff', '#9fdcff'], additive: .6, glow: .8, life: [.6, 1.1], size: [.035, .06], fadeOut: .3, speed: [3, 5.5], rise: [1.5, 3], gravity: 9, drag: .8, collide: true, bounce: .3, friction: .6, stretch: .08 },
  flake: { shape: 'flake', colour: '#eaf8ff', additive: .5, glow: .7, life: [2, 3.5], size: [.05, .1], fadeOut: .25, speed: [.3, .8], rise: [.5, 1.5], gravity: .45, drag: 1.5, wander: .25, wanderRate: 1.5, flow: .25, spin: [20, 90], collide: true, stick: true, bodies: .5 },
  frost: { shape: 'smoke', colour: ['#e8f7ff', '#bfe6ff'], glow: .4, opacity: .5, life: [1.2, 2], size: [.2, .35], sizeEnd: 2.2, fadeIn: .15, fadeOut: .6, speed: [.5, 1.2], rise: [0, .15], gravity: .05, drag: 2, flow: .15, collide: true },
  rime: { shape: 'ring', orient: 'ground', colour: ['#ffffff', '#9fdcff'], additive: .8, glow: 1, intensity: 1.8, life: [.55, .7], size: [.3, .35], sizeEnd: 3.5, fadeOut: .7 },
  // …air…
  gust: { shape: 'spark', orient: 'velocity', colour: '#f4fbff', additive: .7, glow: .6, opacity: .75, life: [.6, 1.1], size: [.025, .045], fadeIn: .2, fadeOut: .4, speed: [2, 3.5], rise: [.2, .8], drag: .4, flow: .3, stretch: .14 },
  leaf: { shape: 'confetti', colour: ['#9cc96b', '#6d9a48'], glow: .1, life: [1.8, 2.8], size: [.05, .08], fadeOut: .3, speed: [1.5, 3], rise: [1.5, 3], gravity: 1.2, drag: 1.2, wander: .4, flow: .4, spin: [90, 240], tumble: 1.2, collide: true },
  // …energy…
  zap: { shape: 'zap', orient: 'velocity', colour: ['#ffffff', '#9db8ff'], additive: 1, glow: 1, intensity: 4, life: [.12, .22], size: [.09, .13], speed: [2, 4], stretch: .3, flicker: .6, flickerRate: 25 },
  orb: { shape: 'glow', colour: ['#f2ecff', '#8a6cff'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .8], size: [.07, .12], fadeOut: .4, speed: [1.5, 2.5], drag: 2, flicker: .3, flickerRate: 10 },
  // …water…
  drop: { shape: 'puff', colour: ['#cdeeff', '#5fb6e8'], glow: .3, opacity: .9, life: [.8, 1.4], size: [.04, .07], speed: [1.5, 3], rise: [2, 3.5], gravity: 9, drag: .3, collide: true, pop: true, onLand: { kind: 'ripple', count: 1, inherit: true } },
  ripple: { shape: 'ring', orient: 'ground', colour: '#cdeeff', additive: .5, glow: .6, life: [.5, .7], size: [.06, .1], sizeEnd: 4, fadeOut: 1, gravity: 30, collide: true, stick: true },
  // …earth…
  rock: { shape: 'splat', colour: ['#8a7560', '#6b5a4a'], life: [1.2, 2], size: [.05, .1], fadeOut: .2, speed: [2, 3.5], rise: [2, 4], gravity: 12, drag: .3, spin: [90, 360], collide: true, bounce: .35, friction: .5 },
  // …light and shadow.
  ray: { shape: 'spark', orient: 'velocity', colour: ['#fffbe6', '#ffe08a'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .8], size: [.03, .05], fadeIn: .1, fadeOut: .5, speed: [2, 3], drag: 1, stretch: .25 },
  shade: { shape: 'smoke', colour: ['#3a2050', '#160c22'], glow: .35, opacity: .8, life: [1, 1.6], size: [.18, .3], sizeEnd: 1.8, fadeIn: .15, fadeOut: .5, speed: [.6, 1.2], rise: [.2, .6], drag: 2, wander: .3, flow: .5, spin: [20, 80] },
  wisp: { shape: 'glow', colour: ['#d9b8ff', '#7a3cc8'], additive: 1, glow: 1, intensity: 2, life: [.7, 1.2], size: [.07, .12], fadeOut: .5, speed: [.8, 1.6], rise: [.3, .8], drag: 1.5, wander: .4, wanderRate: 3, flow: .3, flicker: .4, flickerRate: 6 },
  // The air of each scene: dust in the light indoors, pollen outside, fireflies at night, and her gloom.
  mote: { shape: 'glow', colour: '#fff1d2', additive: .7, glow: .6, opacity: .55, life: [6, 10], size: [.03, .05], fadeIn: .2, fadeOut: .3, gravity: .01, drag: .5, wander: .05, wanderRate: .5, flow: .05, flicker: .25, flickerRate: .6, collide: true, bodies: .9 },
  pollen: { shape: 'glow', colour: '#fff8dc', additive: .6, glow: .6, opacity: .7, life: [6, 9], size: [.03, .055], fadeIn: .2, fadeOut: .3, drag: .3, wind: .6, wander: .12, flow: .25, collide: true, bodies: .7 },
  firefly: { shape: 'glow', colour: ['#ecff96', '#b8f060'], additive: 1, glow: 1, intensity: 2, life: [6, 10], size: [.07, .12], fadeIn: .15, fadeOut: .2, drag: 1, wander: .45, wanderRate: .8, flow: .2, flicker: .85, flickerRate: .35, collide: true, bounce: .6, bodies: .5 },
  gloom: { shape: 'glow', colour: ['#ffa6d2', '#ff6fb2'], additive: .9, glow: 1, intensity: 1.05, opacity: .75, life: [6, 10], size: [.03, .06], fadeIn: .25, fadeOut: .35, rise: [.05, .2], gravity: -.05, drag: .6, wander: .2, flow: .3, flicker: .5, flickerRate: .6, collide: true, bodies: .8 },
} satisfies Record<string, ParticleKind>;
export type EffectKind = keyof typeof KINDS;

/** What a skill or a state can be made of; each has a hit (`element`) and a lasting `aura`. */
export type Element = 'fire' | 'ice' | 'air' | 'energy' | 'water' | 'earth' | 'light' | 'shadow' | 'gum';
/** Each element's flash and ring colours, light first. */
const ELEMENT_COLOURS: Record<Element, [string, string]> = {
  fire: ['#fff1c4', '#ff6a2a'], ice: ['#ffffff', '#8fd4ff'], air: ['#ffffff', '#cfe9e4'], energy: ['#f4f0ff', '#8a6cff'],
  water: ['#e6f7ff', '#4fa8e0'], earth: ['#f1e2c8', '#a0805a'], light: ['#fffbe6', '#ffd76a'], shadow: ['#d9b8ff', '#5a2a8a'], gum: ['#ffe0f0', '#ff5fa2'],
};
/** What keeps coming off someone while an element's state lasts: kinds and how many a second. */
const AURAS: Record<Element, [EffectKind, number][]> = {
  fire: [['flame', 34], ['cinder', 10], ['soot', 3]], ice: [['flake', 10], ['frost', 4]], air: [['gust', 26], ['leaf', 2]],
  energy: [['zap', 22], ['orb', 5]], water: [['drop', 8]], earth: [['dust', 10], ['rock', 2]], light: [['ray', 8], ['star', 4]],
  shadow: [['shade', 6], ['wisp', 8]], gum: [['spore', 8], ['goo', 2]],
};

/** How each scene's air feels: what floats in it (alive per 100 m² in view), the wind and how much it swirls. */
interface Air { kinds: { kind: EffectKind; density: number; low: number; high: number; bubbaloo?: boolean }[]; wind: [number, number, number]; turbulence: number }
const INDOORS: Air = { kinds: [{ kind: 'mote', density: 12, low: .3, high: 2.4 }], wind: [0, 0, 0], turbulence: .4 };
const OUTDOORS: Air = { kinds: [{ kind: 'pollen', density: 4, low: .4, high: 3 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.35, 0, .12], turbulence: 1 };
const AIR: Partial<Record<string, Air>> = {
  patio: { kinds: [{ kind: 'firefly', density: 7, low: .3, high: 2 }], wind: [.05, 0, .02], turbulence: .6 },
  palacio: { kinds: [{ kind: 'gloom', density: 9, low: .1, high: 3 }, { kind: 'bubble', density: 2, low: 0, high: .4 }], wind: [0, .04, 0], turbulence: .7 },
  // Chapter 2's zones: chalk dust drifting over the yard, dust in the gym's tube light; her gloom only a little.
  'palacio-patio': { kinds: [{ kind: 'mote', density: 5, low: .2, high: 2.4 }, { kind: 'gloom', density: 2, low: .1, high: 2.6 }], wind: [.2, 0, .08], turbulence: .8 },
  'palacio-gimnasio': { kinds: [{ kind: 'mote', density: 14, low: .3, high: 4 }, { kind: 'gloom', density: 1, low: .1, high: 2 }], wind: [0, .02, 0], turbulence: .4 },
};
/** Ambient particles stop growing past this, however far the camera pulls back. */
const AMBIENT_CAP = 1600;

// ── Weather ─────────────────────────────────────────────────────────────────────────────────────
/** What falls from the sky over a scene with one (never indoors or in her palace). */
export type Weather = 'clear' | 'rain' | 'snow';
const WEATHER_KINDS = {
  // Rain: fast streaks leaning with the wind that burst into a ripple and a little spray where they land…
  rain: { shape: 'spark', orient: 'velocity', colour: ['#eef5fb', '#c4d8e8'], additive: .3, glow: .45, opacity: .75, life: [1.6, 1.8], size: [.02, .028], stretch: .09, collide: true, pop: true, onLand: [{ kind: 'ripplet', count: 1 }, { kind: 'spray', count: 1 }] },
  ripplet: { shape: 'ring', orient: 'ground', colour: '#eef7ff', additive: .4, glow: .5, opacity: .9, life: [.35, .5], size: [.045, .065], sizeEnd: 3.5, fadeOut: 1, gravity: 30, collide: true, stick: true },
  spray: { shape: 'spark', orient: 'velocity', colour: '#f2f9ff', additive: .5, glow: .6, opacity: .9, life: [.14, .22], size: [.012, .016], fadeOut: .5, speed: [.4, .8], rise: [1, 1.6], gravity: 9, stretch: .07 },
  // …and in heavy rain a low mist.
  haze: { shape: 'smoke', colour: ['#c9d5de', '#aebfcc'], glow: .2, opacity: .2, life: [5, 8], size: [.8, 1.3], fadeIn: .3, fadeOut: .4, drag: .5, wind: .4, flow: .2 },
  // Snow: flakes drifting down on the random walk and the eddies, leaving a soft patch where they land.
  snow: { shape: 'flake', colour: '#ffffff', additive: .2, glow: .7, life: [11, 12], size: [.065, .1], fadeOut: .05, wander: .3, wanderRate: 1, flow: .35, wind: .5, spin: [20, 70], collide: true, pop: true, onLand: { kind: 'drift', count: 1 }, bodies: .4 },
  drift: { shape: 'smoke', orient: 'ground', colour: '#ffffff', glow: .45, opacity: .75, life: [90, 120], size: [.22, .36], fadeIn: .01, fadeOut: .04, gravity: 30, collide: true, stick: true },
} satisfies Record<string, ParticleKind>;
/**
 * How hard each weather falls at full intensity: landings per 100 m² of view a second, and the most a
 * second however wide the view. Snow also keeps at most `settled` patches on the ground (oldest
 * melt first), so a long snowfall never grows the pool: under ~2400 particles for rain, ~3200 for snow.
 */
const WEATHER = {
  rain: { density: 90, most: 1400, low: 2, high: 12, speed: 9 },
  snow: { density: 10, most: 220, low: .3, high: 9, speed: .85, settled: 2000 },
};
/** Seconds weather takes to come in or clear up. */
const WEATHER_RAMP = 4;
/** Average seconds a weather particle takes to reach the floor, to fill the view as it would be. */
const fallTime = (w: { low: number; high: number; speed: number }) => (w.low + w.high) / 2 / w.speed;

// ── Marks ───────────────────────────────────────────────────────────────────────────────────────
/** What a hit leaves on the ground: scorch after fire, frost after ice, a gum puddle, a wet patch, dust. */
export type Mark = 'scorch' | 'frost' | 'gum' | 'wet' | 'dust';
/**
 * Marks are their own small pool of flat particles, drawn before every other particle so flames and
 * dust stay on top of them. Sizes are half-widths for a mark of size 1 (the soft `smoke` patches are
 * drawn wider, since they fade from a third of the way out); lives are long because marks
 * leave by budget or when the fight ends (`clear`), except `brief` layers (embers dying out).
 */
const MARK_KINDS = {
  scorch: { shape: 'smoke', orient: 'ground', colour: '#1c1511', life: 1200, size: [1.3, 1.5], fadeOut: .01 },
  char: { shape: 'splat', orient: 'ground', colour: ['#1a1411', '#2e231c'], opacity: .9, life: 1200, size: [.22, .36], fadeOut: .01 },
  ash: { shape: 'smoke', orient: 'ground', colour: '#8a817a', opacity: .6, life: 1200, size: [.35, .55], fadeOut: .01 },
  glowing: { shape: 'glow', orient: 'ground', colour: ['#ffb056', '#ff5a1f'], additive: 1, glow: 1, intensity: 2.2, life: [5, 9], size: [.06, .12], fadeOut: .5, flicker: .5, flickerRate: 1.5 },
  rimefloor: { shape: 'smoke', orient: 'ground', colour: '#dff3ff', additive: .3, glow: .55, opacity: .85, life: 1200, size: [1.3, 1.5], fadeOut: .01 },
  crystal: { shape: 'flake', orient: 'ground', colour: '#ffffff', additive: .6, glow: .85, life: 1200, size: [.1, .17], fadeOut: .01 },
  puddle: { shape: 'splat', orient: 'ground', colour: '#ff5fa2', glow: .25, opacity: .95, life: 1200, size: [.75, .9], fadeOut: .01 },
  blob: { shape: 'splat', orient: 'ground', colour: ['#ff5fa2', '#ff7ab4'], glow: .25, life: 1200, size: [.15, .26], fadeOut: .01 },
  damp: { shape: 'smoke', orient: 'ground', colour: '#33506a', opacity: .5, life: 1200, size: [1.3, 1.5], fadeOut: .01 },
  sheen: { shape: 'splat', orient: 'ground', colour: '#b4dcf5', additive: .7, glow: .7, opacity: .7, life: 1200, size: [.2, .35], fadeOut: .01 },
  dirt: { shape: 'smoke', orient: 'ground', colour: '#9c8662', opacity: .85, life: 1200, size: [1.3, 1.5], fadeOut: .01 },
  pebble: { shape: 'splat', orient: 'ground', colour: ['#6e5a47', '#8a7560'], life: 1200, size: [.06, .1], fadeOut: .01 },
} satisfies Record<string, ParticleKind>;
type MarkKind = keyof typeof MARK_KINDS;
/** Each mark's layers: a kind, how many, how far out they scatter and how big (× the mark's size). */
const MARKS: Record<Mark, { kind: MarkKind; count: number; spread: number; size: number; brief?: boolean }[]> = {
  scorch: [{ kind: 'ash', count: 6, spread: .85, size: 1 }, { kind: 'scorch', count: 1, spread: 0, size: 1 }, { kind: 'char', count: 5, spread: .6, size: 1 }, { kind: 'glowing', count: 10, spread: .6, size: 1, brief: true }],
  frost: [{ kind: 'rimefloor', count: 1, spread: 0, size: 1 }, { kind: 'crystal', count: 7, spread: .7, size: 1 }],
  gum: [{ kind: 'puddle', count: 1, spread: 0, size: 1 }, { kind: 'blob', count: 4, spread: .85, size: 1 }],
  wet: [{ kind: 'damp', count: 1, spread: 0, size: 1 }, { kind: 'damp', count: 2, spread: .6, size: .55 }, { kind: 'sheen', count: 2, spread: .4, size: 1 }],
  dust: [{ kind: 'dirt', count: 1, spread: 0, size: 1 }, { kind: 'pebble', count: 7, spread: .8, size: 1 }],
};
/** The mark each element leaves where it hits (the rest leave none). */
const ELEMENT_MARKS: Partial<Record<Element, Mark>> = { fire: 'scorch', ice: 'frost', gum: 'gum', water: 'wet', earth: 'dust' };
/** Lasting mark layers alive at once; past it the oldest marks fade out. */
const MARK_BUDGET = 320;
/** Outside a fight a mark fades after this long; in one, it stays until the fight ends. */
const MARK_SECONDS = 40;
/** How long a mark takes to fade out. */
const MARK_FADE = 2.5;
/** The kinds a mark lasts as, which the budget counts. */
const LASTING = [...new Set(Object.values(MARKS).flat().filter(layer => !layer.brief).map(layer => layer.kind))];

/** Linear sRGB, like the engine's light colours. */
const toLinear = (v: number) => v ** 2.2;

export function createEffects(app: pc.Application) {
  const particles = createParticles(app, 6000);
  const trails = createTrails(app);
  for (const [name, kind] of Object.entries({ ...KINDS, ...WEATHER_KINDS })) particles.define(name, kind as ParticleKind);
  // Marks: their own pool, sorted behind every other transparent thing so they lie under it all.
  const marks = createParticles(app, 512);
  for (const [name, kind] of Object.entries(MARK_KINDS)) marks.define(name, kind as ParticleKind);
  marks.meshInstance.calculateSortDistance = () => 1e7;
  /** Lasting marks, oldest first: how many layers each left and how long it has left outside a fight. */
  const placed: { layers: number; left: number }[] = [];
  let fighting = false;
  /** Fades the oldest `count` marks out (all of them by default). */
  const fadeMarks = (count = placed.length) => {
    placed.splice(0, count);
    marks.retire(LASTING, placed.reduce((n, m) => n + m.layers, 0), MARK_FADE);
  };
  // Weather: the falling emitters, how much of each is wanted and how much falls now.
  const sky = { rain: 0, snow: 0 }, wanted = { rain: 0, snow: 0 };
  let falls: { rain: ParticleEmitter; snow: ParticleEmitter; haze: ParticleEmitter; settle: ParticleEmitter } | undefined;
  let outdoors = false, settleCheck = 0;
  /** Fill the view with the weather at once (a new scene, or weather set `now`). */
  let fill = false;
  /** The rain's fall, read by its emitter at every drop, so leaning it with the wind is enough. */
  const rainFall = { x: 0, y: -WEATHER.rain.speed, z: 0 };
  let air: { emitter: ParticleEmitter; kind: Air['kinds'][number] }[] = [];
  let bounds: ParticleWorld | undefined;
  let sun: pc.LightComponent | undefined;
  let tone = 0, animate = true;
  const auras: { at: pc.Vec3; height: number; left: number; streams: { above: boolean; emitter: ParticleEmitter }[]; twirl?: ParticleAttractor }[] = [];
  /** The air of a new scene starts full rather than filling up. */
  let warm = false;
  const groundAt = (x: number, z: number) => Math.max(particles.groundAt(x, z), -1);
  const at = (p: Vec, y = p.y) => ({ x: p.x, y, z: p.z });
  /** A short aura where a hit landed: what is left burning or crackling. */
  const linger = (element: Element, where: Vec, seconds: number) => { effects.aura(element, new pc.Vec3(where.x, where.y, where.z), seconds, 1); };

  const effects = {
    particles,
    /** Ribbons of light behind swings and spells (src/trails.ts): `follow`, `comet`, `spiral`. */
    trails,
    /** A plain puff of one kind; `spread` is the radius it appears over. */
    emit(kind: EffectKind, at: Vec, count = 6, spread = .25) { particles.burst(kind, at, count, { spread }); },
    /**
     * A blow lands at `at`, thrown from `from`: a flash, sparks flying on through, a ring on the
     * floor and dust at the feet. `strength` 1 is a plain hit; guarded hits spark less and ring blue.
     */
    impact(target: Vec, from: Vec, strength = 1, options: { guarded?: boolean; gum?: boolean; feet?: Vec } = {}) {
      const dx = target.x - from.x, dz = target.z - from.z, d = Math.hypot(dx, dz) || 1;
      const direction = { x: dx / d, y: .45, z: dz / d };
      const k = options.guarded ? .4 : strength;
      particles.burst('flash', target, 1, { size: .45 + k * .35 });
      particles.burst('spark', target, Math.round(6 + 12 * k), { direction, cone: .95, spread: .1 });
      if (options.guarded) particles.burst('ward', target, 1);
      const feet = options.feet ?? { x: target.x, y: groundAt(target.x, target.z), z: target.z };
      particles.burst('shock', { x: feet.x, y: feet.y + .03, z: feet.z }, 1, { size: .6 + k * .5 });
      particles.burst('dust', { x: feet.x, y: feet.y + .05, z: feet.z }, Math.round(4 + 5 * k), { spread: .35, flat: true, speed: 1.3 });
      if (options.gum) { effects.mark('gum', feet, .25 + .1 * k); particles.burst('goo', target, Math.round(4 + 5 * k), { spread: .2, direction, cone: 1.1 }); particles.burst('spore', target, 8, { spread: .3 }); }
    },
    /** Cardioide: light rises from a heart-shaped curve round the feet and spirals up the body. */
    heal(target: Vec, height = 1.6) {
      const floor = groundAt(target.x, target.z), size = .32;
      particles.burst('heal', { x: target.x, y: floor + .1, z: target.z }, 36, {
        place: (i, n, out) => {
          // The cardioid r = 2a(1 − cos θ), centred on whoever is healed.
          const t = i / n * Math.PI * 2, r = 2 * size * (1 - Math.cos(t));
          out.set(r * Math.cos(t) + size * 1.4, 0, r * Math.sin(t));
        },
        speed: .4,
      });
      particles.attract({ at: { x: target.x, y: floor + height * .6, z: target.z }, pull: 1.2, swirl: 3.2, lift: 1.4, radius: 1.8, life: 1.3 });
      particles.burst('star', { x: target.x, y: floor + height, z: target.z }, 6, { spread: .35 });
    },
    /** Análisis Parálisis: gold sparks of ideas circling over a head. */
    insight(head: Vec) {
      particles.burst('star', head, 9, { spread: .45, ring: true, speed: .3, life: 1.3 });
      particles.burst('ember', head, 10, { spread: .35, ring: true, speed: .2, colour: ['#fff6cf', '#f3cf78'] });
      particles.attract({ at: head, pull: .8, swirl: 3.5, radius: 1, life: 1.2 });
    },
    /** No-ta lands: a shockwave of dust, red ink spattered round the print and a ring of sparks. */
    stamp(feet: Vec) {
      const floor = { x: feet.x, y: groundAt(feet.x, feet.z) + .04, z: feet.z };
      particles.burst('shock', floor, 1, { size: 1.6, colour: ['#fff1e8', '#ff8a7a'] });
      particles.burst('dust', floor, 26, { spread: .9, ring: true, speed: 3.4 });
      particles.burst('ink', { x: feet.x, y: floor.y + .3, z: feet.z }, 12, { spread: .6, flat: true, speed: 1.2 });
      particles.burst('spark', { x: feet.x, y: floor.y + .4, z: feet.z }, 20, { spread: .7, ring: true });
    },
    /** An ánima wakes (`big`) or is swapped in: its colour swirls up around the body and rings out. */
    anima(body: Vec, colour: string, big = false) {
      const floor = groundAt(body.x, body.z), n = big ? 2 : 1;
      const light: [string, string] = [tint(colour, .45), colour];
      if (big) particles.burst('flash', { x: body.x, y: floor + 1, z: body.z }, 1, { size: 2.2, colour: light });
      particles.burst('shock', { x: body.x, y: floor + .04, z: body.z }, n, { size: big ? 1.5 : 1, colour: light });
      particles.burst('ember', { x: body.x, y: floor + .15, z: body.z }, 22 * n, { spread: .75, ring: true, speed: .4, colour: light });
      particles.burst('star', { x: body.x, y: floor + 1.2, z: body.z }, 6 * n, { spread: .4, colour: light });
      particles.attract({ at: { x: body.x, y: floor + .9, z: body.z }, pull: .6, swirl: 6, lift: 2.4, radius: 1.4, life: big ? 1.6 : 1.1 });
      if (big) particles.burst('spark', { x: body.x, y: floor + 1.1, z: body.z }, 24, { spread: .3, colour: light });
      // Strands of its light wind up round the body, three when it wakes, two when it is swapped in.
      for (let i = 0; i < n + 1; i++) {
        trails.spiral({ x: body.x, y: floor + .1, z: body.z }, light, big
          ? { radius: .95, narrow: .35, height: 2.5, turns: 1.6, phase: i * Math.PI * 2 / 3, seconds: 1.05, width: .13, intensity: 3, core: .35 }
          : { radius: .75, narrow: .4, height: 1.9, turns: 1.3, phase: i * Math.PI, seconds: .75, width: .1, intensity: 2.6, core: .35 });
      }
    },
    /**
     * A spell flying from `from` to `to` in `seconds` (arcing over the straight line, see
     * `CometOptions`), flaring where it lands.
     */
    comet(from: Vec, to: Vec, colour: string, seconds = .35, options: CometOptions = {}) {
      const light: [string, string] = [tint(colour, .5), colour];
      return trails.comet(from, to, light, seconds, {
        ...options,
        onArrive() { particles.burst('flash', to, 1, { size: .35, colour: light }); particles.burst('ember', to, 6, { spread: .12, colour: light }); options.onArrive?.(); },
      });
    },
    /**
     * An element hits `target` (thrown from `from`): every element has its own burst on top of a
     * flash and a ring at the feet. `strength` 1 is a normal skill.
     */
    element(element: Element, target: Vec, options: { from?: Vec; strength?: number; feet?: Vec } = {}) {
      const k = options.strength ?? 1, n = (count: number) => Math.round(count * k);
      const feet = options.feet ?? { x: target.x, y: groundAt(target.x, target.z), z: target.z };
      const floor = { x: feet.x, y: feet.y + .04, z: feet.z }, colours = ELEMENT_COLOURS[element];
      const dx = options.from ? target.x - options.from.x : 0, dz = options.from ? target.z - options.from.z : 0, d = Math.hypot(dx, dz);
      const onward = d > 1e-3 ? { x: dx / d, y: .5, z: dz / d } : undefined;
      particles.burst('flash', target, 1, { size: .45 + k * .35, colour: colours });
      particles.burst(element === 'ice' ? 'rime' : 'shock', floor, 1, { size: .7 + k * .5, colour: colours });
      const mark = ELEMENT_MARKS[element];
      if (mark) effects.mark(mark, feet, .5 + .25 * k);
      switch (element) {
        case 'fire':
          linger('fire', feet, .9);
          particles.burst('flame', floor, n(30), { spread: .45, flat: true, speed: .6 });
          particles.burst('flame', target, n(12), { spread: .3 });
          particles.burst('cinder', target, n(18), { spread: .3, speed: 1.6 });
          particles.burst('soot', { x: target.x, y: target.y + .3, z: target.z }, n(6), { spread: .3 });
          break;
        case 'ice':
          particles.burst('shard', target, n(18), onward ? { direction: onward, cone: 1, spread: .15 } : { spread: .15 });
          particles.burst('frost', floor, n(14), { spread: .5, ring: true, speed: .8 });
          particles.burst('flake', { x: target.x, y: target.y + 1, z: target.z }, n(20), { spread: .8, speed: .5 });
          break;
        case 'air':
          particles.burst('gust', floor, n(40), { place: (i, count, out) => { const a = i * 2.4, r = .5 + (i % 5) * .08; out.set(Math.cos(a) * r, (i / count) * 1.8, Math.sin(a) * r); }, speed: .8 });
          particles.burst('leaf', floor, n(12), { spread: .6, flat: true });
          particles.burst('dust', floor, n(14), { spread: .6, ring: true, speed: 1.8 });
          particles.attract({ at: { x: feet.x, y: feet.y + .9, z: feet.z }, pull: 2, swirl: 11, lift: 3, radius: 1.6, life: 1.2 });
          break;
        case 'energy':
          linger('energy', { x: target.x, y: target.y - .5, z: target.z }, .7);
          particles.burst('zap', target, n(16), { spread: .35 });
          particles.burst('orb', target, n(12), { spread: .2 });
          particles.attract({ at: target, pull: -6, swirl: 5, radius: 1.4, life: .25 });
          particles.attract({ at: target, pull: 9, swirl: 5, radius: 1.6, life: .9 });
          break;
        case 'water':
          particles.burst('drop', target, n(26), onward ? { direction: { x: onward.x, y: 1.2, z: onward.z }, cone: 1.1, spread: .2 } : { spread: .2 });
          particles.burst('ripple', floor, 3, { spread: .3, flat: true });
          particles.burst('frost', floor, n(6), { spread: .35, ring: true, colour: ['#e6f7ff', '#9fd2f0'] });
          break;
        case 'earth':
          particles.burst('rock', floor, n(16), { spread: .4, flat: true });
          particles.burst('dust', floor, n(24), { spread: .8, ring: true, speed: 2.6, size: 1.4 });
          break;
        case 'light':
          particles.burst('ray', floor, n(18), { spread: .5, ring: true, direction: { x: 0, y: 1, z: 0 }, cone: .25 });
          particles.burst('star', target, n(10), { spread: .5 });
          particles.burst('heal', floor, n(14), { spread: .5, ring: true, colour: colours });
          break;
        case 'shadow':
          particles.burst('shade', floor, n(16), { spread: .9, ring: true, speed: .4 });
          particles.burst('wisp', target, n(22), { spread: .6 });
          particles.attract({ at: target, pull: 3.5, swirl: 4, radius: 1.8, life: 1 });
          break;
        case 'gum':
          particles.burst('goo', target, n(10), onward ? { direction: onward, cone: 1.1, spread: .2 } : { spread: .2 });
          particles.burst('spore', target, n(14), { spread: .4 });
          break;
      }
    },
    /**
     * A mark left on the ground at `at` (its floor is found below it), `size` metres across its middle
     * layer. It stays while a fight lasts and fades when it ends (`clear`); outside a fight it fades
     * after `MARK_SECONDS`, and past `MARK_BUDGET` the oldest marks fade first.
     */
    mark(kind: Mark, at: Vec, size = .6) {
      let layers = 0;
      for (const layer of MARKS[kind]) {
        // Each layer lies on its own patch of floor, so steps and kerbs keep their marks, 3 cm up so
        // painted planes the floor height does not know about (the street's name) stay underneath.
        marks.burst(layer.kind, at, layer.count, { size: size * layer.size, place: (_, __, out) => {
          const a = Math.random() * Math.PI * 2, r = size * layer.spread * Math.sqrt(Math.random()), x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
          const floor = marks.groundAt(x, z);
          out.set(x - at.x, (floor > -Infinity ? floor : at.y) + .03 - at.y, z - at.z);
        } });
        if (!layer.brief) layers += layer.count;
      }
      placed.push({ layers, left: MARK_SECONDS });
      let over = 0;
      for (let n = placed.reduce((sum, m) => sum + m.layers, 0); n > MARK_BUDGET && over < placed.length - 1; over++) n -= placed[over].layers;
      if (over) fadeMarks(over);
    },
    /** The lasting marks, for tests and debugging. */
    marks,
    /**
     * What falls over scenes with a sky: `clear`, `rain` or `snow`, `intensity` 0–1. It comes in and
     * clears up over a few seconds, or at once with `now`; a new scene starts with it already falling.
     */
    setWeather(kind: Weather, intensity = 1, now = false) {
      const k = kind === 'clear' ? 0 : Math.min(1, Math.max(0, intensity));
      wanted.rain = kind === 'rain' ? k : 0; wanted.snow = kind === 'snow' ? k : 0;
      if (now) { sky.rain = wanted.rain; sky.snow = wanted.snow; fill = true; }
    },
    /** What falls now and how hard (0–1), ramps included. */
    get weather() { return { rain: sky.rain, snow: sky.snow }; },
    /**
     * An element clings to someone for `seconds` (burning, frozen, charged…): it keeps coming off
     * them wherever `at` (kept up to date by the caller) goes. `stop()` ends it early.
     */
    aura(element: Element, at: pc.Vec3, seconds = 2, height = 1.5) {
      // Flakes drift down from above the head; everything else rises from the body.
      const streams = AURAS[element].map(([kind, rate]) => ({ above: kind === 'flake', emitter: particles.emitter(kind, at, { rate, spread: .35, ...(kind === 'flake' ? { velocity: { x: 0, y: -.6, z: 0 } } : {}) }) }));
      const twirl = element === 'air' || element === 'energy' ? particles.attract({ at, pull: 1, swirl: element === 'air' ? 8 : 4, lift: element === 'air' ? 1.5 : 0, radius: 1.2 }) : undefined;
      const aura = { at, height, left: seconds, streams, twirl };
      auras.push(aura);
      return { stop() { aura.left = 0; } };
    },
    /** Out of the fight in a puff of smoke and a few stars. */
    poof(where: Vec) {
      particles.burst('poof', where, 14, { spread: .35 });
      particles.burst('star', at(where, where.y + .3), 5, { spread: .3 });
    },
    /** The fight is won: confetti in the party's colours over the field, settling where it falls. */
    confetti(centre: Vec, colours: readonly string[]) {
      colours.forEach(colour => particles.burst('confetti', centre, 18, { spread: 2.2, flat: true, colour }));
    },
    /**
     * A new scene: floors, walls and whatever stands on its cells become what particles collide
     * with, its sun lights them, and its air starts drifting.
     */
    setScene(environment: Environment, scenery: { root: pc.Entity; groundHeight(x: number, z: number): number; toWorld(x: number, z: number): pc.Vec3; houses: readonly { x0: number; x1: number; z0: number; z1: number; top: number }[] }) {
      bounds = sceneWorld(environment, scenery);
      particles.setWorld(bounds); marks.setWorld(bounds);
      sun = (scenery.root.findComponents('light') as pc.LightComponent[]).filter(l => l.type === 'directional').sort((a, b) => b.intensity - a.intensity)[0];
      air.forEach(a => a.emitter.remove());
      auras.forEach(aura => { aura.left = 0; });
      particles.clear(true); marks.clear(true); placed.length = 0;
      const mood = AIR[environment.id] ?? (environment.plan ? INDOORS : OUTDOORS);
      particles.wind.set(...mood.wind); particles.turbulence = mood.turbulence;
      air = mood.kinds.map(kind => ({ kind, emitter: particles.emitter(kind.kind, { x: 0, y: 0, z: 0 }, { rate: 0, ambient: true, area: { x: 1, z: 1, low: kind.low, high: kind.high } }) }));
      // Weather only falls where there is a sky; a new scene starts with it already falling.
      outdoors = !environment.plan && !environment.palace;
      sky.rain = wanted.rain; sky.snow = wanted.snow; fill = true;
      if (!falls) {
        const sheet = (kind: string, w: { low: number; high: number }, velocity?: Vec) => particles.emitter(kind, { x: 0, y: 0, z: 0 }, { rate: 0, ambient: true, area: { x: 1, z: 1, low: w.low, high: w.high }, velocity });
        falls = {
          rain: sheet('rain', WEATHER.rain, rainFall), snow: sheet('snow', WEATHER.snow, { x: 0, y: -WEATHER.snow.speed, z: 0 }),
          haze: sheet('haze', { low: .1, high: .9 }), settle: sheet('drift', { low: .01, high: .03 }),
        };
      }
      warm = true;
    },
    /** People particles part around this frame: who, where, how wide and how tall. */
    setBodies(bodies: readonly ParticleBody[]) { particles.setBodies(bodies); },
    /** How far into La Reina Bubbaloo's light the scene is (0–1): her gloom thickens with it. */
    setTone(value: number) { tone = value; },
    /**
     * `focus` is what the camera looks at and `reach` how far it sees around it; the air fills
     * that area. `animate` false (reduced motion) stills the air; `paused` freezes everything.
     */
    update(dt: number, view: { focus: Vec; reach: number; animate: boolean; paused: boolean; fight?: boolean }) {
      animate = view.animate;
      // Covering particles take the scene's light: its ambient plus part of the sun.
      const ambientLight = app.scene.ambientLight, s = sun ? sun.intensity * .45 : 0, c = sun?.color;
      // Under rain the sky is heavier: covering particles (and marks) take a little less of it.
      const dim = 1 - .3 * (outdoors ? sky.rain : 0);
      const lit = [ambientLight.r, ambientLight.g, ambientLight.b].map((v, i) => Math.min(1.3, toLinear(v) + (c ? toLinear([c.r, c.g, c.b][i]) * s : 0)) * dim);
      particles.setLight(lit[0], lit[1], lit[2]); marks.setLight(lit[0], lit[1], lit[2]);
      // The air fills what the camera sees, but only over the scene itself.
      const x0 = Math.max(view.focus.x - view.reach, bounds?.x0 ?? -Infinity), x1 = Math.min(view.focus.x + view.reach, bounds?.x1 ?? Infinity);
      const z0 = Math.max(view.focus.z - view.reach, bounds?.z0 ?? -Infinity), z1 = Math.min(view.focus.z + view.reach, bounds?.z1 ?? Infinity);
      const area = Math.max(0, x1 - x0) * Math.max(0, z1 - z0) / 100;
      for (const { emitter, kind } of air) {
        const k = KINDS[kind.kind] as ParticleKind, life = typeof k.life === 'number' ? k.life : (k.life[0] + k.life[1]) / 2;
        // Pollen and fireflies hide from rain and snow.
        const wanted = Math.min(AMBIENT_CAP, kind.density * area * (kind.bubbaloo ? tone : 1 - .8 * (outdoors ? Math.max(sky.rain, sky.snow) : 0)));
        emitter.at.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
        emitter.area!.x = Math.max(0, x1 - x0) / 2; emitter.area!.z = Math.max(0, z1 - z0) / 2;
        emitter.rate = wanted / life;
        emitter.enabled = animate;
        if (warm && animate) emitter.warm();
      }
      if (falls) weather(dt, view.paused, x0, x1, z0, z1, area);
      warm = false;
      // Marks stay while a fight lasts and fade once it is over; outside one they fade after a while.
      if (fighting && !view.fight) fadeMarks();
      fighting = !!view.fight;
      if (!fighting && !view.paused && placed.length) {
        for (const m of placed) m.left -= dt;
        let old = 0;
        while (old < placed.length && placed[old].left <= 0) old++;
        if (old) fadeMarks(old);
      }
      for (let i = auras.length - 1; i >= 0; i--) {
        const aura = auras[i];
        if (!view.paused) aura.left -= dt;
        for (const { above, emitter } of aura.streams) emitter.at.set(aura.at.x, aura.at.y + (above ? aura.height + .3 : aura.height * .35), aura.at.z);
        aura.twirl?.at.set(aura.at.x, aura.at.y + aura.height * .5, aura.at.z);
        if (aura.left <= 0) { aura.streams.forEach(stream => stream.emitter.remove()); aura.twirl?.remove(); auras.splice(i, 1); }
      }
      particles.update(view.paused ? 0 : dt);
      trails.enabled = animate;
      trails.update(view.paused ? 0 : dt);
      marks.update(view.paused ? 0 : dt);
    },
    /** Ends every effect, aura and trail in flight; the scene's air and weather stay, and marks fade out. */
    clear() { auras.forEach(aura => { aura.left = 0; }); particles.clear(); trails.clear(); fadeMarks(); },
    destroy() { particles.destroy(); trails.destroy(); marks.destroy(); },
  };

  /**
   * Weather over the part of the scene in view (`x0`…`z1`, `area` in 100 m²): ramps towards what was
   * asked, leans the rain with the wind and keeps settled snow under its budget. With reduced motion
   * nothing falls: snow is only a still dusting on the floor, and rain only the dimmer light.
   */
  function weather(dt: number, paused: boolean, x0: number, x1: number, z0: number, z1: number, area: number) {
    const f = falls!, step = paused ? 0 : dt / WEATHER_RAMP;
    for (const w of ['rain', 'snow'] as const) sky[w] += Math.max(-step, Math.min(step, wanted[w] - sky[w]));
    const rain = outdoors ? sky.rain : 0, snow = outdoors ? sky.snow : 0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = Math.max(0, x1 - x0) / 2, hz = Math.max(0, z1 - z0) / 2;
    for (const e of [f.rain, f.snow, f.haze, f.settle]) { e.at.set(cx, 0, cz); e.area!.x = hx; e.area!.z = hz; }
    // Rain leans with the scene's wind, and a little more, so it reads as slanting.
    rainFall.x = particles.wind.x * 2.5; rainFall.z = particles.wind.z * 2.5;
    f.rain.rate = Math.min(WEATHER.rain.most, WEATHER.rain.density * area * rain);
    f.snow.rate = Math.min(WEATHER.snow.most, WEATHER.snow.density * area * snow);
    // Past half intensity, up to 3 patches of mist per 100 m² hang low (each lives ~6.5 s).
    f.haze.rate = 3 * area * Math.max(0, rain - .5) * 2 / 6.5;
    const drift = WEATHER_KINDS.drift.life, driftLife = (drift[0] + drift[1]) / 2;
    f.settle.rate = animate ? 0 : WEATHER.snow.settled * .5 * snow / driftLife;
    for (const e of [f.rain, f.snow, f.haze]) e.enabled = animate;
    f.settle.enabled = !animate;
    if (fill) {
      fill = false;
      // A scene that opens mid-storm: the air full of what is falling and the ground already white.
      if (animate) for (const [e, w] of [[f.rain, WEATHER.rain], [f.snow, WEATHER.snow]] as const) {
        const rate = e.rate, k = WEATHER_KINDS[e === f.rain ? 'rain' : 'snow'].life;
        e.rate = rate * fallTime(w) / ((k[0] + k[1]) / 2); e.warm(); e.rate = rate;
      }
      if (animate) f.haze.warm();
      if (snow) { const rate = f.settle.rate; f.settle.rate = WEATHER.snow.settled * .7 * snow / driftLife; f.settle.warm(); f.settle.rate = rate; }
    }
    // Settled snow keeps to its budget, the oldest patches melting first, and rain melts it all.
    if ((settleCheck -= dt) <= 0 && !paused) { settleCheck = .25; particles.retire(['drift'], Math.round(WEATHER.snow.settled * Math.max(0, 1 - rain * 2)), 2); }
  }
  return effects;
}

/** `hex` mixed towards white by `k`, for the bright edge of a coloured light. */
export function tint(hex: string, k: number) {
  const c = new pc.Color().fromString(hex);
  return new pc.Color(c.r + (1 - c.r) * k, c.g + (1 - c.g) * k, c.b + (1 - c.b) * k).toString(false);
}
export type Effects = ReturnType<typeof createEffects>;

/** How tall whatever stands on a solid cell is, by what the plan draws there (metres). */
const PLAN_TOPS: Record<string, number> = { '#': 2.6, W: 2.6, D: 2.6, G: 2.6, ' ': 2.6, o: .8, '=': 1, '/': 1.2 };
/** The scene as particles feel it: its floors from the scenery, its walls and things from the grid. */
export function sceneWorld(environment: Environment, scenery: { groundHeight(x: number, z: number): number; toWorld(x: number, z: number): pc.Vec3; houses: readonly { x0: number; x1: number; z0: number; z1: number; top: number }[] }): ParticleWorld {
  const rows = environment.grid.length, cols = environment.grid[0].length;
  const origin = scenery.toWorld(0, 0);
  const top = new Float32Array(cols * rows).fill(-Infinity);
  const props = new Set(environment.props.flatMap(propCells).map(c => `${c.x},${c.z}`));
  const plan = environment.plan ?? environment.palace?.plan;
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    if (environment.grid[z][x] !== '#') continue;
    const p = scenery.toWorld(x, z);
    const house = scenery.houses.find(h => p.x >= h.x0 && p.x <= h.x1 && p.z >= h.z0 && p.z <= h.z1);
    top[z * cols + x] = house ? house.top : props.has(`${x},${z}`) ? 1 : plan ? (environment.palace ? 3 : PLAN_TOPS[plan[z]?.[x]] ?? 2.6) : 2.3;
  }
  return {
    x0: origin.x - .5, z0: origin.z - .5, x1: origin.x + cols - .5, z1: origin.z + rows - .5,
    // Past the edge of the model is the backdrop far below.
    outside: -.95,
    ground: (x, z) => scenery.groundHeight(x, z),
    cells: { x: origin.x, z: origin.z, cols, rows, top },
  };
}
