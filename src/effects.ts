import * as pc from 'playcanvas';
import { createParticles, type ParticleAttractor, type ParticleBody, type ParticleEmitter, type ParticleKind, type ParticleWorld, type Vec } from './particles.ts';
import { propCells, type Environment } from './environments.ts';
import { createTrails, type CometOptions } from './trails.ts';
import { createFlames, type Flame, type Shell } from './flames.ts';
import { createReflections, glassMaterial, glassMesh, type ReflectionProbe } from './reflections.ts';
import { MAX_VOLUMES, canSimulate, createFightParticles, type GpuEmitter, type GpuField, type GpuKind, type GpuLattice, type GpuVolume } from './fight-particles.ts';
import type { LatticeShape } from './lattice.ts';

/**
 * What the game's particles look like and how they behave (the engine is src/particles.ts):
 * one-off kinds anyone can `emit`, battle moments built from several of them, and each scene's
 * air, which drifts, swirls around people and settles on the floor (docs/graphics.md).
 */
const KINDS = {
  // Footfalls and landings: little lit puffs that roll out low and settle on the floor.
  dust: { shape: 'puff', colour: ['#d8ccae', '#c9bb98'], opacity: .9, life: [.6, 1.1], size: [.06, .11], sizeEnd: 1.7, growIn: .15, fadeOut: .5, speed: [.25, .6], rise: [.15, .45], gravity: .7, drag: 2.6, wander: .08, wanderRate: 2, flow: .05, collide: true, friction: .5, bodies: .5 },
  // A train passing under a street: its draught breathing out of a vent grate, pale and slow.
  draught: { shape: 'smoke', colour: ['#ecebe6', '#cfcdc6'], opacity: .4, life: [1.4, 2.2], size: [.16, .26], sizeEnd: 2.6, fadeIn: .2, fadeOut: .6, speed: [.2, .5], rise: [.8, 1.4], gravity: -.15, drag: 1.6, wander: .2, flow: .4 },
  // Someone leaving a fight, or arriving: soft smoke that swells, turns and rises.
  poof: { shape: 'smoke', colour: ['#f1e9d4', '#d7d0bf'], glow: .15, life: [.8, 1.3], size: [.16, .28], sizeEnd: 2.3, growIn: .12, fadeOut: .6, speed: [.8, 1.6], rise: [.5, 1], gravity: -.35, drag: 3.2, wander: .15, flow: .25, spin: [20, 80], collide: true, bodies: .4, front: .5 },
  // Contact: hot streaks that fly out, fall and skip on the floor.
  spark: { shape: 'spark', orient: 'velocity', colour: ['#fff1c8', '#ffad42'], additive: 1, glow: 1, intensity: 3, life: [.28, .55], size: [.022, .04], fadeOut: .4, speed: [3, 6], rise: [1, 2.6], gravity: 9, drag: 1.2, collide: true, bounce: .45, friction: .3, stretch: .06, bodies: 1, front: .8 },
  // Cardioide and other cures: green light rising in loose spirals, twinkling.
  heal: { shape: 'glow', colour: ['#d8ffb0', '#62c447'], additive: 1, glow: 1, intensity: 1.8, life: [.9, 1.5], size: [.08, .15], fadeIn: .1, fadeOut: .5, speed: [.2, .5], rise: [.9, 1.6], gravity: -.3, drag: 1.5, wander: .25, wanderRate: 3, flow: .2, flicker: .3, flickerRate: 4, front: .25 },
  // La Reina Bubbaloo: gum drops that fly, fall and stay stuck where they land as splats…
  goo: { shape: 'puff', colour: ['#ff5fa2', '#ff4f98'], glow: .25, life: [1.6, 2.4], size: [.06, .12], speed: [1.4, 2.6], rise: [2, 3.2], gravity: 9, drag: .5, collide: true, pop: true, onLand: { kind: 'splat', count: 1, inherit: true }, bodies: 1, front: .5 },
  splat: { shape: 'splat', orient: 'ground', colour: '#ff5fa2', glow: .2, life: [2.6, 3.6], size: [.1, .18], growIn: .1, fadeOut: .3, gravity: 30, collide: true, stick: true },
  // …and her glowing pink motes, which wander and part around whoever walks through them.
  spore: { shape: 'glow', colour: ['#ff9bd0', '#ff5fa8'], additive: .8, glow: 1, intensity: 1.6, life: [1.4, 2.2], size: [.06, .1], fadeIn: .15, fadeOut: .45, speed: [.2, .45], rise: [.4, .9], gravity: -.15, drag: 1.2, wander: .3, wanderRate: 1.5, flow: .35, flicker: .35, flickerRate: 2.5, bodies: .6 },
  // Battle accents.
  flash: { shape: 'glow', colour: '#fff4da', additive: 1, glow: 1, intensity: 1.6, life: [.12, .16], size: [.55, .7], sizeEnd: 1.6, fadeOut: 1, front: 1 },
  shock: { shape: 'ring', orient: 'ground', colour: ['#fff1c8', '#ffc861'], additive: 1, glow: 1, intensity: 2, life: [.38, .46], size: [.3, .34], sizeEnd: 5, fadeOut: .8 },
  ward: { shape: 'ring', colour: ['#e4f5ff', '#8fc8ff'], additive: 1, glow: 1, intensity: 2, life: [.32, .4], size: [.75, .8], sizeEnd: 1.25, fadeOut: .7, front: .9 },
  star: { shape: 'star', colour: ['#fff6cf', '#ffd76a'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .9], size: [.1, .17], growIn: .1, fadeOut: .5, speed: [.4, 1.2], rise: [.6, 1.4], gravity: 1.5, drag: 2, spin: [60, 180], flicker: .4, flickerRate: 6, front: .6 },
  ember: { shape: 'glow', colour: ['#fff2c4', '#ffb84a'], additive: 1, glow: 1, intensity: 2.5, life: [.8, 1.4], size: [.055, .1], fadeOut: .5, speed: [.6, 1.2], rise: [1, 2.2], gravity: -.4, drag: 1.4, wander: .25, flow: .3, flicker: .2, flickerRate: 5, front: .5 },
  ink: { shape: 'puff', colour: '#c8323c', glow: .1, life: 2, size: [.035, .07], speed: [1.5, 3], rise: [1.5, 3], gravity: 9, drag: .4, collide: true, pop: true, onLand: { kind: 'splat', count: 1, inherit: true }, front: .5 },
  confetti: { shape: 'confetti', colour: '#f3cf78', glow: .2, life: [3.5, 5], size: [.05, .07], fadeOut: .2, speed: [1.5, 3.2], rise: [3.5, 5.5], gravity: 4, drag: 1.7, wander: .5, wanderRate: 2.5, flow: .3, spin: [90, 300], tumble: 1.6, collide: true, stick: true, bodies: .3 },
  bubble: { shape: 'bubble', colour: ['#ffd0e6', '#ff8cc4'], additive: .35, glow: .6, life: [2.5, 4], size: [.07, .15], growIn: .3, fadeIn: .1, rise: [.25, .55], gravity: -.25, drag: 1, wander: .2, wanderRate: 1, flow: .3, collide: true, bounce: .5, bodies: .8, onDeath: { kind: 'pop', count: 5, inherit: true } },
  pop: { shape: 'glow', colour: '#ffd0e6', additive: 1, glow: 1, intensity: 2, life: [.2, .35], size: [.018, .03], fadeOut: .6, speed: [.6, 1.2], drag: 3 },
  // Elements, for skills and states: fire. Its flames are drawn whole (src/flames.ts, `FIRE` below);
  // only its sparks fly as particles, riding the heat up and wandering.
  fleck: { shape: 'spark', orient: 'velocity', stretch: .06, colour: ['#fff2b8', '#ff9a2e', '#ff4a12'], additive: 1, glow: 1, intensity: 4, life: [1, 2.2], size: [.008, .014], fadeOut: .35, speed: [.2, .6], rise: [1.4, 2.6], gravity: -.5, drag: 1.1, wander: .6, wanderRate: 3, flow: .6, wind: 1, flicker: .55, flickerRate: 7 },
  cinder: { shape: 'glow', colour: ['#ffd27a', '#ff5a1f'], additive: 1, glow: 1, intensity: 3, life: [.7, 1.3], size: [.035, .06], fadeOut: .5, speed: [.3, .9], rise: [1.5, 3], gravity: -.6, drag: 1.2, wander: .35, wanderRate: 5, flow: .4, flicker: .5, flickerRate: 8, bodies: .6, front: .6 },
  soot: { shape: 'smoke', colour: ['#4a3d38', '#2a2422'], opacity: .55, life: [1, 1.6], size: [.15, .25], sizeEnd: 2.6, fadeIn: .2, fadeOut: .6, speed: [.1, .3], rise: [.8, 1.4], gravity: -.8, drag: 1.5, flow: .4, spin: [20, 60] },
  // …ice…
  shard: { shape: 'spark', orient: 'velocity', colour: ['#f4fdff', '#9fdcff'], additive: .6, glow: .8, life: [.6, 1.1], size: [.035, .06], fadeOut: .3, speed: [3, 5.5], rise: [1.5, 3], gravity: 9, drag: .8, collide: true, bounce: .3, friction: .6, stretch: .08, bodies: 1, front: .7 },
  flake: { shape: 'flake', colour: '#eaf8ff', additive: .5, glow: .7, life: [2, 3.5], size: [.05, .1], fadeOut: .25, speed: [.3, .8], rise: [.5, 1.5], gravity: .45, drag: 1.5, wander: .25, wanderRate: 1.5, flow: .25, spin: [20, 90], collide: true, stick: true, bodies: .5 },
  frost: { shape: 'smoke', colour: ['#e8f7ff', '#bfe6ff'], glow: .4, opacity: .5, life: [1.2, 2], size: [.2, .35], sizeEnd: 2.2, fadeIn: .15, fadeOut: .6, speed: [.5, 1.2], rise: [0, .15], gravity: .05, drag: 2, flow: .15, collide: true },
  rime: { shape: 'ring', orient: 'ground', colour: ['#ffffff', '#9fdcff'], additive: .8, glow: 1, intensity: 1.8, life: [.55, .7], size: [.3, .35], sizeEnd: 3.5, fadeOut: .7 },
  // …air…
  gust: { shape: 'spark', orient: 'velocity', colour: '#f4fbff', additive: .7, glow: .6, opacity: .75, life: [.6, 1.1], size: [.025, .045], fadeIn: .2, fadeOut: .4, speed: [2, 3.5], rise: [.2, .8], drag: .4, flow: .3, stretch: .14, front: .4 },
  leaf: { shape: 'confetti', colour: ['#9cc96b', '#6d9a48'], glow: .1, life: [1.8, 2.8], size: [.05, .08], fadeOut: .3, speed: [1.5, 3], rise: [1.5, 3], gravity: 1.2, drag: 1.2, wander: .4, flow: .4, spin: [90, 240], tumble: 1.2, collide: true },
  // …energy…
  zap: { shape: 'zap', orient: 'velocity', colour: ['#ffffff', '#9db8ff'], additive: 1, glow: 1, intensity: 4, life: [.12, .22], size: [.09, .13], speed: [2, 4], stretch: .3, flicker: .6, flickerRate: 25, front: .8 },
  orb: { shape: 'glow', colour: ['#f2ecff', '#8a6cff'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .8], size: [.07, .12], fadeOut: .4, speed: [1.5, 2.5], drag: 2, flicker: .3, flickerRate: 10, front: .6 },
  // …water…
  drop: { shape: 'puff', colour: ['#cdeeff', '#5fb6e8'], glow: .3, opacity: .9, life: [.8, 1.4], size: [.04, .07], speed: [1.5, 3], rise: [2, 3.5], gravity: 9, drag: .3, collide: true, pop: true, onLand: { kind: 'ripple', count: 1, inherit: true }, bodies: 1, front: .5 },
  ripple: { shape: 'ring', orient: 'ground', colour: '#cdeeff', additive: .5, glow: .6, life: [.5, .7], size: [.06, .1], sizeEnd: 4, fadeOut: 1, gravity: 30, collide: true, stick: true },
  // …earth…
  rock: { shape: 'splat', colour: ['#8a7560', '#6b5a4a'], life: [1.2, 2], size: [.05, .1], fadeOut: .2, speed: [2, 3.5], rise: [2, 4], gravity: 12, drag: .3, spin: [90, 360], collide: true, bounce: .35, friction: .5, bodies: 1, front: .4 },
  // …light and shadow.
  ray: { shape: 'spark', orient: 'velocity', colour: ['#fffbe6', '#ffe08a'], additive: 1, glow: 1, intensity: 2.5, life: [.5, .8], size: [.03, .05], fadeIn: .1, fadeOut: .5, speed: [2, 3], drag: 1, stretch: .25, front: .3 },
  shade: { shape: 'smoke', colour: ['#3a2050', '#160c22'], glow: .35, opacity: .8, life: [1, 1.6], size: [.18, .3], sizeEnd: 1.8, fadeIn: .15, fadeOut: .5, speed: [.6, 1.2], rise: [.2, .6], drag: 2, wander: .3, flow: .5, spin: [20, 80] },
  wisp: { shape: 'glow', colour: ['#d9b8ff', '#7a3cc8'], additive: 1, glow: 1, intensity: 2, life: [.7, 1.2], size: [.07, .12], fadeOut: .5, speed: [.8, 1.6], rise: [.3, .8], drag: 1.5, wander: .4, wanderRate: 3, flow: .3, flicker: .4, flickerRate: 6, front: .5 },
  // The air of each scene: dust in the light indoors, pollen outside, fireflies at night, and her gloom.
  mote: { shape: 'glow', colour: '#fff1d2', additive: .7, glow: .6, opacity: .55, life: [6, 10], size: [.03, .05], fadeIn: .2, fadeOut: .3, gravity: .01, drag: .5, wander: .05, wanderRate: .5, flow: .05, flicker: .25, flickerRate: .6, collide: true, bodies: .9 },
  pollen: { shape: 'glow', colour: '#fff8dc', additive: .6, glow: .6, opacity: .7, life: [6, 9], size: [.03, .055], fadeIn: .2, fadeOut: .3, drag: .3, wind: .6, wander: .12, flow: .25, collide: true, bodies: .7 },
  // October on the Meridiana: dry plane leaves drifting down the avenue and lying on the panot a while.
  dryleaf: { shape: 'confetti', colour: ['#d0a85c', '#8f6a3a'], glow: .12, life: [7, 10], size: [.07, .1], fadeIn: .1, fadeOut: .15, gravity: .3, drag: 1.4, wind: .7, wander: .35, wanderRate: .8, flow: .3, spin: [40, 140], tumble: 1, collide: true, stick: true, bodies: .5 },
  firefly: { shape: 'glow', colour: ['#ecff96', '#b8f060'], additive: 1, glow: 1, intensity: 2, life: [6, 10], size: [.07, .12], fadeIn: .15, fadeOut: .2, drag: 1, wander: .45, wanderRate: .8, flow: .2, flicker: .85, flickerRate: .35, collide: true, bounce: .6, bodies: .5 },
  // Alegia's txirimiri: a fine drizzle that drifts more than it falls, ringing the puddles, and low cloud.
  drizzle: { shape: 'spark', orient: 'velocity', colour: ['#eef4f7', '#cdd9df'], additive: .25, glow: .35, opacity: .5, life: [2.4, 3.2], size: [.011, .015], fadeIn: .15, fadeOut: .2, gravity: 4.5, drag: 2, wind: .7, wander: .1, wanderRate: 1.5, stretch: .05, collide: true, pop: true, onLand: { kind: 'ripplet', count: 1 } },
  mist: { shape: 'smoke', colour: ['#e3e9ea', '#c9d1d3'], glow: .3, opacity: .12, life: [9, 14], size: [1.1, 1.8], sizeEnd: 1.5, fadeIn: .35, fadeOut: .4, drag: .5, wind: .5, wander: .06, wanderRate: .4, flow: .1 },
  // The beach's sea breeze picks up dry sand: fine grains streaking low over it, gone in a second.
  sand: { shape: 'spark', orient: 'velocity', colour: ['#f1e3c2', '#dcc79c'], opacity: .6, life: [.9, 1.6], size: [.012, .02], fadeIn: .25, fadeOut: .45, drag: .2, wind: 2.5, wander: .25, wanderRate: 2, flow: .4, stretch: .05, collide: true },
  gloom: { shape: 'glow', colour: ['#ffa6d2', '#ff6fb2'], additive: .9, glow: 1, intensity: 1.05, opacity: .75, life: [6, 10], size: [.03, .06], fadeIn: .25, fadeOut: .35, rise: [.05, .2], gravity: -.05, drag: .6, wander: .2, flow: .3, flicker: .5, flickerRate: .6, collide: true, bodies: .8 },
} satisfies Record<string, ParticleKind>;
export type EffectKind = keyof typeof KINDS;

// ── Fire ────────────────────────────────────────────────────────────────────────────────────────
/** How big a fire is: a small flicker, a campfire or a blaze (`effects.fire`). */
export type FireLevel = 'light' | 'medium' | 'high';
/**
 * Each level of fire: half the width of its flames and how tall they stand (m), how much taller its
 * smoke rises (× height), how white-hot it burns (past 0 its heart blooms), its sparks a second, the
 * light it throws, and how often it crackles (seconds between flares, and the sparks each throws).
 * Wrapping someone, its flames reach `wrap` times their height and a quarter of `height` more; on
 * their own body (`model`) its shell burns this strongly.
 */
const FIRE: Record<FireLevel, { width: number; height: number; wrap: number; shell: number; smoke: number; heat: number; sparks: number; light: { intensity: number; range: number }; crackle?: { every: [number, number]; sparks: number } }> = {
  // A small flicker, ankle-high, with a thread of smoke (a singed sleeve, a lit bin).
  light: { width: .2, height: .45, wrap: .45, shell: .75, smoke: .6, heat: .2, sparks: 1.5, light: { intensity: 1, range: 1.6 } },
  // A campfire, knee-high: a steady body of flame, sparks rising and grey smoke over it.
  medium: { width: .42, height: 1, wrap: .85, shell: 1, smoke: .9, heat: .6, sparks: 7, light: { intensity: 2.4, range: 3 }, crackle: { every: [1, 2.5], sparks: 6 } },
  // A blaze taller than a person, roaring and flaring, spitting sparks into a column of dark smoke.
  high: { width: .75, height: 2.2, wrap: 1.35, shell: 1.05, smoke: 1.1, heat: .7, sparks: 22, light: { intensity: 4.5, range: 5 }, crackle: { every: [.4, 1.2], sparks: 16 } },
};
// ── Fight particles (GPU) ───────────────────────────────────────────────────────────────────────
/**
 * What fights throw on the GPU (src/fight-particles.ts): hot sparks that bounce off fighters, slide
 * along them and cling a moment; embers that ride the heat and the swirl; tongues of flame licking
 * off whoever burns; and smoke. Colours run white-hot → orange → deep red over their lives.
 */
const FIGHT_KINDS = {
  spark: {
    drag: .5, gravity: 9, curl: .15, response: .3, collide: true, bounce: .42, friction: .28, stick: .22, stickTime: .45, settle: false,
    colours: ['#ffffff', '#ffd27a', '#ff5a14'], intensity: [7, 4, 2], middle: .3, size: [.016, .01], sizeJitter: .6, stretch: .07, shape: 'streak',
    fadeIn: 0, fadeOut: .35, additive: 1, opacity: 1, flicker: .15,
  },
  // Crisp little lines: chips of a blow, snapped off and skittering (thin, hard-edged, every size).
  needle: {
    drag: .8, gravity: 7, curl: .1, response: .3, collide: true, bounce: .5, friction: .2, size: [.03, .018], sizeJitter: .7, stretch: .035, aspect: .12, shape: 'line',
    colours: ['#ffffff', '#ffe2a8', '#ff8a3a'], intensity: [5, 3, 1.5], middle: .25, fadeOut: .4, additive: 1, spin: 720,
  },
  // Embers riding the heat: tiny sparks, white-hot at the head, cooling to deep red down the tail,
  // pointing the way the swirl carries them.
  ember: {
    blur: [0, .6],
    drag: .9, gravity: -.3, curl: 1.3, response: 1, collide: true, bounce: .45, friction: .3, stick: .35, stickTime: .9, settle: true,
    colours: ['#fff4c8', '#ff9a2e', '#b8320c'], intensity: [7, 4, 1.8], middle: .3, size: [.011, .005], sizeJitter: .6, stretch: .05, aspect: .3, shape: 'spark',
    fadeIn: .04, fadeOut: .3, additive: 1, opacity: 1, flicker: .35,
  },
  // A fire's crackle: pinpricks spat out in arcs that fall back, skip off bodies and the floor and die fast.
  crackle: {
    drag: .7, gravity: 4.5, curl: .3, response: .5, collide: true, bounce: .35, friction: .3, stick: .1, stickTime: .4, settle: false,
    colours: ['#ffffff', '#ffc861', '#ff5a14'], intensity: [9, 5, 2], middle: .25, size: [.009, .004], sizeJitter: .6, stretch: .06, aspect: .25, shape: 'spark',
    fadeOut: .4, additive: 1, opacity: 1, flicker: .2,
  },
  // Ice: shards that glance off bodies, spinning, and leave frost where they land.
  shard: {
    drag: .4, gravity: 9, curl: .1, response: .3, collide: true, bounce: .45, friction: .35, stick: .08, stickTime: 1.2, size: [.075, .05], sizeJitter: .6, stretch: .02, spin: 540, shape: 'shard',
    colours: ['#ffffff', '#cdf0ff', '#7cc8ff'], intensity: [2.6, 1.6, 1.1], middle: .3, fadeOut: .25, additive: .55, onLand: 'frost',
  },
  frost: {
    blur: [0, .4],
    drag: 4, gravity: 9, collide: true, bounce: 0, friction: .9, settle: true, size: [.035, .02], sizeJitter: .5, shape: 'dot',
    colours: ['#ffffff', '#d6f3ff', '#9fd8ff'], intensity: [2, 1.4, 1], middle: .4, fadeIn: .1, fadeOut: .5, additive: .5, life: [1.2, 2.2],
  },
  // Energy: chains of light that crackle on the turbulence, drawn as one line each.
  arc: {
    drag: 1.5, gravity: 0, curl: 3.5, response: 1, follow: 22, size: [.022, .012], shape: 'strand',
    colours: ['#ffffff', '#c8d4ff', '#6a58ff'], intensity: [6, 3.5, 2], middle: .3, fadeOut: .5, additive: 1, flicker: .5,
  },
  // Any colour (tint a burst): motes that spin on a vortex and twinkle out as they die…
  mote: {
    blur: [0, .9],
    drag: 1.2, gravity: -.3, curl: .6, response: 1, size: [.028, .012], sizeJitter: .6, shape: 'dot',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3.5, 2.5, 1.5], middle: .3, fadeIn: .1, fadeOut: .3, additive: 1, flicker: .3, onDeath: 'twinkle',
  },
  twinkle: {
    blur: [0, .7],
    drag: 3, size: [.05, .01], spin: 200, shape: 'star', colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5, 3, 1], fadeOut: .7, additive: 1, life: [.25, .5],
  },
  // …and trails: a head with a chain behind it, for comets and fireworks; it bursts into embers.
  trail: {
    drag: .6, gravity: 3, curl: .4, response: 1, follow: 14, size: [.03, .006], shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5, 3, 1.4], middle: .3, fadeOut: .35, additive: 1, onDeath: 'ember',
  },
  // Shadow: a swarm that sees itself, keeping apart, closing ranks and flying as one.
  swarm: {
    blur: [0, .5],
    drag: .8, gravity: 0, curl: .5, response: 1, separation: 3, cohesion: 2.2, alignment: 2.6, radius: .45, size: [.03, .02], sizeJitter: .5, stretch: .06, aspect: .35, shape: 'line',
    colours: ['#e6ccff', '#9a5ad8', '#3a1660'], intensity: [2.4, 1.6, .8], middle: .35, fadeIn: .15, fadeOut: .35, additive: .6,
  },
  // Gum: blobs that stick to whoever they hit and splat where they land (her pink).
  goo: {
    drag: .3, gravity: 9, collide: true, bounce: .1, friction: .8, stick: .9, stickTime: 2.5, size: [.03, .026], sizeJitter: .7, shape: 'dot',
    colours: ['#ffd0e6', '#ff5fa2', '#e0407f'], intensity: [1.3, 1.1, 1], middle: .2, fadeOut: .2, additive: .1, onLand: 'splat',
  },
  splat: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, size: [.07, .09], sizeJitter: .5, shape: 'dot',
    colours: ['#ff7ab4', '#ff5fa2', '#c8346e'], intensity: [1.1, 1, .9], fadeOut: .3, additive: .05, life: [1.5, 2.5],
  },
  // Cures: green light that gathers as it rises and twinkles out.
  heal: {
    blur: [.1, .8],
    drag: 1, gravity: -1.2, curl: .5, response: 1, separation: .8, cohesion: 1.2, alignment: .8, radius: .4, size: [.03, .015], sizeJitter: .5, shape: 'dot',
    colours: ['#f2ffe0', '#9cf07a', '#3fa83a'], intensity: [3, 2.2, 1.2], middle: .3, fadeIn: .15, fadeOut: .3, additive: 1, flicker: .25, onDeath: 'twinkle',
  },
  // Light that lives in a crystal: no drag to speak of, so it keeps bouncing off the inside of its
  // walls, spinning and twinkling; any colour (tint it).
  prism: {
    drag: .05, gravity: 0, curl: .25, response: 1, size: [.03, .022], sizeJitter: .5, spin: 300, shape: 'star',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5, 3.5, 2], middle: .3, fadeIn: .08, fadeOut: .25, additive: 1, flicker: .35,
  },
  // Warm lights that wander round someone, seeing each other so they keep a little apart.
  firefly: {
    blur: .6,
    drag: 1.4, gravity: -.05, curl: 1.3, response: 1, separation: 1.2, radius: .35, size: [.035, .03], sizeJitter: .4, shape: 'glow',
    colours: ['#fff6c8', '#ffd36a', '#ff9a3c'], intensity: [4, 3.5, 2], middle: .4, fadeIn: .2, fadeOut: .3, additive: 1, flicker: .55,
  },
  // A meteor's head and its trail (a chain), and the flare it ends in.
  meteor: {
    drag: .05, gravity: 14, curl: .1, response: .2, follow: 26, collide: true, bounce: 0, size: [.06, .04], shape: 'strand',
    colours: ['#ffffff', '#ffc46a', '#ff4a12'], intensity: [7, 4.5, 2], middle: .25, fadeOut: .15, additive: 1, onLand: 'flare',
  },
  flare: {
    blur: .5,
    drag: 6, size: [.22, .5], shape: 'glow', colours: ['#ffffff', '#ffd27a', '#ff6a1f'], intensity: [8, 4, 1.5], middle: .2, fadeOut: .8, additive: 1, life: [.25, .4],
  },
  // Lattices (src/lattice.ts): the members of a shape that holds together. A node of light, a little
  // heavy, so the shape sags a touch and what breaks loose falls, bounces and skitters; any colour.
  node: {
    drag: .2, gravity: 6, curl: .05, response: 1, collide: true, bounce: .35, friction: .35, size: [.02, .015], sizeJitter: .25, shape: 'dot',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3, 2.4, 1.2], middle: .5, fadeIn: .08, fadeOut: .35, additive: .85,
  },
  // Glass: the shield's dots of light, but see-through in the middle with a bright edge and a glint
  // (a lattice of them, with `fresnel`, reads as a body of glass); any colour.
  pane: {
    drag: .2, gravity: 6, curl: .05, response: 1, collide: true, bounce: .35, friction: .35, size: [.02, .015], sizeJitter: .2, shape: 'dot',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3, 2.4, 1.2], middle: .5, fadeIn: .08, fadeOut: .35, additive: .9, glass: .8,
  },
  // Glass facets: flat diamonds of see-through light that fill between a lattice's bands, catching the
  // light at their edge; any colour.
  facet: {
    drag: .2, gravity: 0, curl: .03, response: 1, size: [.05, .045], sizeJitter: .3, shape: 'shard', stretch: 0,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.1, .9, .5], middle: .5, fadeIn: .1, fadeOut: .35, additive: .75, opacity: .6, glass: .6,
  },
  // A lattice drawn as its rows: each member a ribbon to the one before it, so a shape reads as threads.
  thread: {
    drag: .2, gravity: 0, curl: .05, response: 1, size: [.011, .008], shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3.4, 2.8, 1.2], middle: .5, fadeIn: .08, fadeOut: .35, additive: 1, flicker: .1,
  },
  // Cloth of light: it falls, drapes over whoever it lands on and lies on the floor (woven in threads).
  veil: {
    drag: .4, gravity: 3, curl: .1, response: 1, collide: true, bounce: 0, friction: .6, size: [.012, .009], shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.8, 2.2, 1], middle: .5, fadeIn: .1, fadeOut: .35, additive: .9,
  },
  // What a lattice breaks into: sharp chips that spin, glance off bodies and fade.
  chip: {
    drag: .4, gravity: 9, curl: .1, response: .3, collide: true, bounce: .4, friction: .35, size: [.032, .02], sizeJitter: .5, stretch: .02, spin: 540, shape: 'shard',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3.2, 2, 1.2], middle: .3, fadeOut: .3, additive: .7, life: [.9, 1.6],
  },
} satisfies Record<string, GpuKind>;
/** The fight effects to explore and give to skills (`effects.fightFx`, `window.gerard.game.fx`). */
export const FIGHT_FX = ['shatter', 'arc', 'vortex', 'swarm', 'goo', 'heal', 'fireworks', 'needles', 'prison', 'orbit', 'gather', 'meteor', 'fireflies', 'ward', 'morph', 'current', 'veil', 'forge', 'shield', 'bubble', 'globe', 'orb'] as const;
export type FightFx = typeof FIGHT_FX[number];
/**
 * What each level of fire throws off a fighter in a fight: embers and crackle a second, and the vortex
 * round them (m/s²). Its flames are drawn whole (the shell on their body, the flame behind them),
 * never as flame-shaped particles: particles are only sparks.
 */
const FIRE_GPU: Record<FireLevel, { embers: number; crackle: number; swirl: number; lift: number }> = {
  light: { embers: 5, crackle: 4, swirl: 3, lift: 1.5 },
  medium: { embers: 16, crackle: 14, swirl: 6, lift: 3 },
  high: { embers: 40, crackle: 36, swirl: 10, lift: 5 },
};

/** Someone an effect is on: how wide (m from their middle) and how tall they stand. */
export interface Body { radius: number; height: number }
/** How wide and tall `model` stands over `feet`, from its parts' bounds. */
export function bodyOf(model: pc.Entity, feet: Vec): Body {
  const box = new pc.BoundingBox();
  let first = true;
  for (const r of model.findComponents('render') as pc.RenderComponent[]) for (const m of r.meshInstances) {
    if (first) { box.copy(m.aabb); first = false; } else box.add(m.aabb);
  }
  if (first) return { radius: .35, height: 1.5 };
  const min = box.getMin(), max = box.getMax();
  return { radius: Math.max(.15, Math.max(max.x - min.x, max.z - min.z) / 2 * .8), height: Math.max(.3, max.y - feet.y) };
}
/**
 * Fire lights at once: every light costs each lit pixel near it (a burning fight measured 0.3–0.8 ms
 * a light at twice the pixels), so fires within `FIRE_SHARE` metres of a brighter one add to its
 * light instead of casting their own, and past this many the rest add to the nearest.
 */
const FIRE_LIGHTS = 2, FIRE_SHARE = 2.5;
/** Hit lights alive at once. */
const GLINTS = 6;
/** Seconds a fire takes to die down once stopped, or to grow into a new level. */
const FIRE_FADE = .6;
/** The colour of the light a fire throws. */
const FIRE_LIGHT = new pc.Color().fromString('#ff9a3c');

/** What a skill or a state can be made of; each has a hit (`element`) and a lasting `aura`. */
export type Element = 'fire' | 'ice' | 'air' | 'energy' | 'water' | 'earth' | 'light' | 'shadow' | 'gum';
/** Each element's flash and ring colours, light first. */
const ELEMENT_COLOURS: Record<Element, [string, string]> = {
  fire: ['#fff1c4', '#ff6a2a'], ice: ['#ffffff', '#8fd4ff'], air: ['#ffffff', '#cfe9e4'], energy: ['#f4f0ff', '#8a6cff'],
  water: ['#e6f7ff', '#4fa8e0'], earth: ['#f1e2c8', '#a0805a'], light: ['#fffbe6', '#ffd76a'], shadow: ['#d9b8ff', '#5a2a8a'], gum: ['#ffe0f0', '#ff5fa2'],
};
/** What keeps coming off someone while an element's state lasts: kinds and how many a second (fire burns them, `effects.fire`). */
const AURAS: Record<Exclude<Element, 'fire'>, [EffectKind, number][]> = {
  ice: [['flake', 10], ['frost', 4]], air: [['gust', 26], ['leaf', 2]],
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
  // Pollen and the plane trees' falling leaves, on a light wind along the avenue.
  'meridiana-calle': { kinds: [{ kind: 'pollen', density: 3, low: .4, high: 3 }, { kind: 'dryleaf', density: 1.2, low: .4, high: 4 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.45, 0, .05], turbulence: .9 },
  alegia: { kinds: [{ kind: 'drizzle', density: 18, low: .5, high: 7 }, { kind: 'mist', density: .5, low: .2, high: 1.6 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.3, 0, .2], turbulence: .8 },
  // The Búnkers del Carmel at sunset: gusts over the top, dust glinting in the low sun.
  'bunkers-carmel': { kinds: [{ kind: 'mote', density: 6, low: .3, high: 3 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.9, 0, .35], turbulence: 1.4 },
  // The sea breeze blows in from the water (+z) and along the shore; it lifts sand, not pollen.
  barceloneta: { kinds: [{ kind: 'sand', density: 5, low: .03, high: .45 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.5, 0, -.9], turbulence: 1.2 },
  // Carrer de Blai: warm motes hanging in the still air under the terraces' bulbs.
  'poble-sec': { kinds: [{ kind: 'mote', density: 5, low: .4, high: 4 }, { kind: 'gloom', density: 7, low: .1, high: 2.6, bubbaloo: true }], wind: [.05, 0, .02], turbulence: .5 },
  // The Sagrada Família inside: dust hanging high in the light from the glass.
  'sagrada-familia-interior': { kinds: [{ kind: 'mote', density: 16, low: .3, high: 5 }], wind: [0, .02, 0], turbulence: .3 },
  // Chapter 2's zones: chalk dust drifting over the yard, dust in the gym's tube light; her gloom only a little.
  'palacio-patio': { kinds: [{ kind: 'mote', density: 5, low: .2, high: 2.4 }, { kind: 'gloom', density: 2, low: .1, high: 2.6 }], wind: [.2, 0, .08], turbulence: .8 },
  'palacio-gimnasio': { kinds: [{ kind: 'mote', density: 14, low: .3, high: 4 }, { kind: 'gloom', density: 1, low: .1, high: 2 }], wind: [0, .02, 0], turbulence: .4 },
  // Paper dust under the office's tubes; in the throne room, stage haze and her bubbles rising slowly.
  'palacio-secretaria': { kinds: [{ kind: 'mote', density: 8, low: .3, high: 2.8 }, { kind: 'gloom', density: 1, low: .1, high: 2 }], wind: [0, .01, 0], turbulence: .3 },
  'palacio-trono': { kinds: [{ kind: 'mote', density: 10, low: .4, high: 4.5 }, { kind: 'bubble', density: 2, low: 0, high: .6 }, { kind: 'gloom', density: 3, low: .1, high: 2.4 }], wind: [0, .03, 0], turbulence: .5 },
};
/** What particles need of a scene's scenery: its floors, a sunk river's water, its grid and its houses' volumes. */
interface SceneShape {
  groundHeight(x: number, z: number): number;
  waterHeight?(x: number, z: number): number | undefined;
  toWorld(x: number, z: number): pc.Vec3;
  houses: readonly { x0: number; x1: number; z0: number; z1: number; top: number }[];
}
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
  const flames = createFlames(app);
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

  /**
   * Fires burning now: where, at what level, whom they wrap, how strong (0 out, 1 burning; it eases
   * between them), how long they have left, their flames (one standing alone; around someone, one
   * behind them and a see-through one in front), sparks and light, the size they are growing into,
   * their own phase, the time to their next crackle and how much they flare.
   */
  interface Fire {
    at: pc.Vec3; level: FireLevel; body?: Body; model?: pc.Entity; strength: number; left: number;
    behind: Flame; front?: Flame; shell?: Shell; sparks: ParticleEmitter; light: pc.Entity;
    /** Around someone, a vortex that spins its sparks round them as they rise. */
    swirl?: ParticleAttractor;
    /** In a fight, on someone's body: its tongues, embers and smoke on the GPU, and the vortex round them. */
    gpu?: { embers: GpuEmitter; crackle: GpuEmitter; vortex: GpuField };
    /** How brightly it burns this frame (0–~1.4), for whoever it heats. */
    glow: number;
    /** The light it would cast alone this frame: intensity and where. */
    lux: number; lightY: number;
    height: number; width: number; range: number; phase: number; crackle: number; flare: number;
  }
  const fires: Fire[] = [];
  /** Seconds the effects have run, unpaused (fires breathe on it). */
  let clock = 0;
  /** How much of its light a fire throws in this scene's light (1 at night, less by day). */
  let firelight = 1;
  const between = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
  /** How tall and wide a fire stands at its level, around whoever it wraps. */
  const fireSize = (level: FireLevel, body?: Body) => {
    const f = FIRE[level];
    // Around someone it grows with them, a quarter of its own height over what it climbs of theirs.
    return body ? { height: body.height * f.wrap + f.height * .25, width: Math.max(f.width * .6, body.radius * 1.5) } : { height: f.height, width: f.width };
  };
  function unGpu(fire: Fire) {
    if (!fire.gpu) return;
    const g = fire.gpu;
    g.embers.remove(); g.crackle.remove(); g.vortex.remove();
    fire.gpu = undefined;
  }
  function douse(fire: Fire) {
    unGpu(fire);
    fire.behind.remove(); fire.front?.remove(); fire.shell?.remove(); fire.swirl?.remove();
    fire.sparks.remove();
    fire.light.destroy();
  }
  /** Every fire: grows in or dies down, breathes, crackles, and its light flickers with it. */
  function burn(dt: number) {
    for (let i = fires.length - 1; i >= 0; i--) {
      const fire = fires[i], f = FIRE[fire.level];
      fire.left -= dt;
      const want = fire.left > 0 ? 1 : 0, ease = dt / FIRE_FADE;
      fire.strength += Math.max(-ease, Math.min(ease, want - fire.strength));
      if (!want && fire.strength <= 0) { douse(fire); fires.splice(i, 1); continue; }
      // A new level grows (or sinks) into its size and reach rather than jumping.
      const k = Math.min(1, ease * 2), size = fireSize(fire.level, fire.body);
      fire.height += (size.height - fire.height) * k; fire.width += (size.width - fire.width) * k; fire.range += (f.light.range - fire.range) * k;
      // It breathes: a slow swell and a quick flicker of its own.
      const t = clock + fire.phase;
      const swell = .85 + .15 * (Math.sin(t * 1.3) * .6 + Math.sin(t * 2.9 + 1.7) * .4);
      const flicker = .82 + .18 * (Math.sin(t * 11) * .5 + Math.sin(t * 17.3 + 2) * .3 + Math.sin(t * 29.1 + 4) * .2);
      // Now and then it crackles: it flares up, brighter and taller, and throws a spray of sparks.
      if (f.crackle && (fire.crackle -= dt) <= 0) {
        fire.crackle = between(f.crackle.every);
        if (fire.strength > .5) {
          const who = fire.gpu ? fighterIndex(fire.model) : -1;
          if (who >= 0) {
            // On the GPU it bursts off their body: a spray of embers and a gout of flame.
            gpu!.burst('crackle', { at: fire.at, count: f.crackle.sparks * 7, shape: 'surface', fighter: who, above: .3, outward: 2.2, up: 2.8, speed: 1.4, life: [.4, .9] });
            gpu!.burst('ember', { at: fire.at, count: f.crackle.sparks * 2, shape: 'surface', fighter: who, above: .3, outward: 1.2, up: 2.2, speed: 1, life: [.9, 2] });
          } else particles.burst('fleck', { x: fire.at.x, y: fire.at.y + fire.height * .35, z: fire.at.z }, f.crackle.sparks,
            { spread: fire.width * .5, flat: true, direction: { x: 0, y: 1, z: 0 }, cone: .7, speed: 1.6, front: fire.body ? fire.body.radius + .2 : 0 });
          fire.flare = 1;
        }
      }
      fire.flare = Math.max(0, fire.flare - dt * 4);
      const tall = fire.height * (.92 + .08 * swell + .12 * fire.flare);
      for (const flame of [fire.behind, fire.front]) {
        if (!flame) continue;
        flame.at.copy(fire.at);
        flame.strength = fire.strength * (.88 + .12 * swell);
        flame.heat = f.heat * (1 + .6 * fire.flare);
        // The layer in front licks up their lower half, wider; the one behind rises over their head.
        flame.height = flame === fire.front ? tall * .6 : tall;
        flame.width = flame === fire.front ? fire.width * 1.2 : fire.width;
      }
      if (fire.shell) {
        // Its own body burns, and its sparks fly off it: each from a part of it, wherever it is now.
        const shell = fire.shell, part = shell.parts[Math.floor(Math.random() * shell.parts.length)];
        shell.base = fire.at.y; shell.height = fire.body?.height ?? fire.height; shell.x = fire.at.x; shell.z = fire.at.z;
        // The bigger the fire, the faster it turns round them.
        shell.spin = 1.2 + f.shell * .8;
        shell.strength = fire.strength * f.shell * (.85 + .15 * swell + .15 * fire.flare); shell.heat = f.heat * .5 * (1 + .6 * fire.flare);
        if (part) { const box = part.aabb, c = box.center, e = box.halfExtents; fire.sparks.at.set(c.x + (Math.random() * 2 - 1) * e.x, c.y + Math.random() * e.y, c.z + (Math.random() * 2 - 1) * e.z); }
      } else fire.sparks.at.set(fire.at.x, fire.at.y + fire.height * .3, fire.at.z);
      fire.glow = fire.strength * swell * flicker * (1 + .35 * fire.flare) * f.shell;
      if (fire.swirl) {
        fire.swirl.at.set(fire.at.x, fire.at.y + fire.height * .5, fire.at.z);
        fire.swirl.swirl = (2 + 2.5 * f.shell) * fire.strength; fire.swirl.lift = .8 * fire.strength; fire.swirl.radius = fire.height * .9 + (fire.body?.radius ?? 0);
      }
      fire.sparks.rate = f.sparks * fire.strength * swell;
      // In a fight, on someone's body, its embers and crackle fly on the GPU and meet them.
      const who = gpuOn && fire.shell ? fighterIndex(fire.model) : -1;
      if (who >= 0) {
        const g = fire.gpu ??= {
          embers: gpu!.emitter('ember', { at: fire.at, rate: 0, shape: 'surface', above: .3, life: [1, 2.2], speed: .6, outward: .7, up: 1.1 }),
          crackle: gpu!.emitter('crackle', { at: fire.at, rate: 0, shape: 'surface', above: .25, life: [.3, .7], speed: 1, outward: 1.6, up: 2.2 }),
          vortex: gpu!.field({ at: fire.at, radius: 1 }),
        };
        const level = FIRE_GPU[fire.level], body = fire.body!, burning = fire.strength * swell;
        for (const e of [g.embers, g.crackle]) e.fighter = who;
        g.embers.rate = level.embers * burning; g.crackle.rate = level.crackle * burning * (1 + 2 * fire.flare);
        // The vortex: round them and up, drawing what drifts away back in.
        g.vortex.at.set(fire.at.x, fire.at.y + body.height * .45, fire.at.z);
        g.vortex.radius = body.height * 1.3 + 1; g.vortex.swirl = level.swirl * fire.strength; g.vortex.lift = level.lift * fire.strength;
        g.vortex.pull = 1.2 * fire.strength; g.vortex.turbulence = .5;
        fire.sparks.rate = 0;
      } else unGpu(fire);
      fire.lux = f.light.intensity * firelight * fire.strength * swell * flicker * (1 + .35 * fire.flare);
      fire.lightY = fire.at.y + fire.height * .45;
    }
    shareLights();
  }
  /** Fires close together cast one light between them, at their weighted middle, as bright as all of them. */
  const leading = new Map<Fire, { lux: number; x: number; y: number; z: number; range: number }>();
  function shareLights() {
    leading.clear();
    for (const fire of [...fires].sort((a, b) => b.lux - a.lux)) {
      let lead: Fire | undefined, best = Infinity;
      for (const l of leading.keys()) { const d = Math.hypot(l.at.x - fire.at.x, l.at.z - fire.at.z); if (d < best) { best = d; lead = l; } }
      if (!lead || (best > FIRE_SHARE && leading.size < FIRE_LIGHTS)) { leading.set(fire, { lux: fire.lux, x: fire.at.x * fire.lux, y: fire.lightY * fire.lux, z: fire.at.z * fire.lux, range: fire.range }); continue; }
      const sum = leading.get(lead)!;
      sum.lux += fire.lux; sum.x += fire.at.x * fire.lux; sum.y += fire.lightY * fire.lux; sum.z += fire.at.z * fire.lux;
      sum.range = Math.max(sum.range, fire.range + best * .5);
    }
    for (const fire of fires) {
      const sum = leading.get(fire);
      fire.light.enabled = !!sum && sum.lux > 0;
      if (!sum || sum.lux <= 0) continue;
      fire.light.setPosition(sum.x / sum.lux, sum.y / sum.lux, sum.z / sum.lux);
      fire.light.light!.intensity = sum.lux; fire.light.light!.range = sum.range;
    }
  }

  // Fight particles on the GPU, where the device can: only in fights, with motion (`gpuOn`).
  const gpu = canSimulate(app.graphicsDevice) ? createFightParticles(app, FIGHT_KINDS) : undefined;
  let gpuOn = false;
  /** Who is fighting (battle-scene `setFighters`): what fight particles meet. */
  let fightersNow: pc.Entity[] = [];
  /** Which fighter (`setFighters` order) a model is, or -1. */
  const fighterIndex = (model?: pc.Entity) => model ? fightersNow.indexOf(model) : -1;
  /** Force fields that last a moment (a fire hit sucking in, then blowing out), and what follows. */
  const pulses: { field: GpuField; left: number; then?: () => void }[] = [];
  /** Things that happen a moment later (a meteor landing, a crystal shattering). */
  const later: { left: number; then: () => void }[] = [];
  /** Lattices playing out (fight effects): each steps through its own timeline, then goes, its members fading as their kind. */
  const lattices: { lattice: GpuLattice; age: number; seconds: number; step: (age: number, dt: number) => void }[] = [];
  function updateLattices(dt: number) {
    for (let i = lattices.length - 1; i >= 0; i--) {
      const l = lattices[i];
      if (!l.lattice.alive) { lattices.splice(i, 1); continue; }
      l.age += dt;
      l.step(l.age, dt);
      if (l.age >= l.seconds) { l.lattice.remove(); lattices.splice(i, 1); }
    }
  }
  function dropLattices() { lattices.forEach(l => l.lattice.remove()); lattices.length = 0; }
  /** 0 before `from`, 1 after `to`, eased between. */
  const span = (t: number, from: number, to: number) => { const u = Math.min(1, Math.max(0, (t - from) / (to - from))); return u * u * (3 - 2 * u); };
  /**
   * Crystals: a faceted double pyramid of glass that particles meet (a GPU volume that follows it).
   * It grows in, turns, bobs and, at its end, shrinks away or shatters.
   */
  /**
   * Crystal geometry: quartz, a hexagonal prism (apothem `a`, half-length `h`) pointed at both ends
   * (each point `tip` long), flat-faced. With `cluster`, smaller points grow from round its foot,
   * tilted out, as quartz grows. Each crystal its own mesh: destroying an entity destroys the meshes
   * it was the last to use.
   */
  function quartzMesh(a: number, h: number, tip: number, cluster: boolean) {
    const triangles: { corners: [pc.Vec3, pc.Vec3, pc.Vec3]; hidden?: number }[] = [];
    const point = (m: pc.Mat4, a: number, h: number, tip: number) => {
      const r = a / Math.cos(Math.PI / 6), ring = (y: number) => Array.from({ length: 6 }, (_, k) => new pc.Vec3(Math.cos(k * Math.PI / 3) * r, y, Math.sin(k * Math.PI / 3) * r));
      const top = ring(h), bottom = ring(-h), apex = new pc.Vec3(0, h + tip, 0), nadir = new pc.Vec3(0, -h - tip, 0);
      // Each triangle outward-facing (away from the point's axis); `hidden` is the corner whose
      // opposite edge splits a flat face, so it is not drawn as an edge.
      const tri = (p: pc.Vec3, q: pc.Vec3, w: pc.Vec3, hidden?: number) => {
        const [x, y, z] = [p, q, w].map(v => m.transformPoint(v, new pc.Vec3()));
        const n = new pc.Vec3().cross(new pc.Vec3().sub2(y, x), new pc.Vec3().sub2(z, x));
        const centre = m.transformPoint(new pc.Vec3(0, (p.y + q.y + w.y) / 3, 0), new pc.Vec3());
        const out = new pc.Vec3().add2(x, y).add(z).mulScalar(1 / 3).sub(centre);
        if (n.dot(out) >= 0) triangles.push({ corners: [x, y, z], hidden });
        else triangles.push({ corners: [x, z, y], hidden: hidden === undefined ? undefined : [0, 2, 1][hidden] });
      };
      for (let k = 0; k < 6; k++) {
        const j = (k + 1) % 6;
        tri(bottom[k], top[k], top[j], 1); tri(bottom[k], top[j], bottom[j], 2);
        tri(top[k], apex, top[j]); tri(bottom[k], bottom[j], nadir);
      }
    };
    point(new pc.Mat4(), a, h, tip);
    if (cluster) {
      // Four smaller points round its foot, each leaning out and turned its own way.
      [[.55, 25, 20], [.42, 32, 115], [.5, 22, 200], [.38, 35, 290]].forEach(([k, lean, turn]) => {
        const m = new pc.Mat4().setTRS(
          new pc.Vec3(Math.cos(turn * Math.PI / 180) * a * .8, -h * .55, Math.sin(turn * Math.PI / 180) * a * .8),
          new pc.Quat().setFromEulerAngles(0, -turn, 0).mul(new pc.Quat().setFromEulerAngles(0, 0, -lean)), pc.Vec3.ONE);
        point(m, a * k, h * k * .9, tip * k);
      });
    }
    return glassMesh(app.graphicsDevice, triangles);
  }
  interface Crystal { entity: pc.Entity; light: pc.Entity; volume: GpuVolume; material: pc.Material; glass: ReturnType<typeof glassMaterial>; size: pc.Vec3; base: pc.Vec3; left: number; age: number; grow: number; spin: number; end: 'fade' | 'shatter'; colour: string }
  const crystals: Crystal[] = [];
  /** What crystals reflect of what is round them (src/reflections.ts): one probe, at the newest crystal. */
  const reflections = createReflections(app);
  let probe: ReflectionProbe | undefined;
  /** Told when glass appears or goes, so the post pass keeps the scene colour glass refracts (game.ts wires it). */
  let onGlass: ((on: boolean) => void) | undefined;
  /** Whether the post pass keeps the scene colour for glass: on from a fight's first crystal to its end (switching it rebuilds the post pass). */
  let glassOn = false;
  function glassChanged() {
    const any = crystals.length > 0;
    if (probe) probe.active = any;
    if (any && !glassOn) { glassOn = true; onGlass?.(true); }
  }
  function removeCrystal(c: Crystal) { c.volume.remove(); c.light.destroy(); c.entity.destroy(); c.material.destroy(); }
  function updateCrystals(dt: number) {
    for (let i = crystals.length - 1; i >= 0; i--) {
      const c = crystals[i];
      c.age += dt; c.left -= dt;
      const grow = Math.min(1, c.age / c.grow), shrink = Math.min(1, Math.max(0, c.left / .35));
      const scale = (1 - (1 - grow) ** 3) * (c.end === 'fade' ? shrink : 1) + 1e-4;
      c.entity.setPosition(c.base.x, c.base.y + Math.sin(c.age * 2.1) * .03, c.base.z);
      c.entity.setEulerAngles(0, c.age * c.spin, 0);
      c.entity.setLocalScale(scale, scale, scale);
      c.volume.size.set(c.size.x * scale, c.size.y * scale, c.size.z * scale);
      // Its key light, up and in front of it (towards the fight's camera), so its faces catch glints.
      const p = c.entity.getPosition(), reach = (c.size.y + c.size.z) * 2.2 + .4;
      c.light.setPosition(p.x + reach * .3, p.y + reach * .6, p.z + reach * .75);
      c.light.light!.intensity = 1.6 * scale * (.9 + .1 * Math.sin(c.age * 7.3));
      c.glass.set((c.size.x + c.size.z) * .5 * scale, 1, clock + c.age, Math.min(1, scale * 1.5));
      if (c.left > 0) continue;
      if (c.end === 'shatter' && gpu) {
        // It bursts: what it held is free, its shards fly and its light flashes.
        const at = c.entity.getPosition();
        gpu.burst('shard', { at, count: 90, spread: c.size.x * .6, speed: 4, life: [.7, 1.3], colour: tint(c.colour, .6), light: { intensity: 3, range: 3, colour: c.colour } });
        gpu.burst('needle', { at, count: 50, spread: .05, speed: 4.5, life: [.3, .6], colour: tint(c.colour, .5) });
        glint(at, c.colour, 3, 3.5, .35);
      }
      removeCrystal(c); crystals.splice(i, 1);
      glassChanged();
    }
    // The probe sees from the newest crystal's heart.
    const newest = crystals[crystals.length - 1];
    if (newest && probe) probe.at.copy(newest.entity.getPosition());
    reflections.update();
  }
  /** Every crystal gone at once (the fight ended, effects cleared), and nothing left to happen later. */
  function dropCrystals() {
    crystals.forEach(removeCrystal);
    crystals.length = 0; later.length = 0;
    glassChanged();
    if (glassOn) { glassOn = false; onGlass?.(false); }
  }
  /**
   * A crystal at `at`, quartz of `size` (apothem, half the prism's length, each point's length), that
   * particles meet as `mode` says (src/fight-particles.ts, `volume`). Its glass refracts what is behind
   * it, splitting the light at its edges (dispersion), and reflects what is round it (a probe), with a
   * faint sheen of colour on its faces; it is tinted `colour` by its thickness.
   */
  function crystalAt(at: Vec, o: { colour: string; size: { x: number; y: number; z: number }; seconds: number; mode: GpuVolume['mode']; cluster?: boolean; strength?: number; swirl?: number; range?: number; distance?: number; bounce?: number; spin?: number; end?: 'fade' | 'shatter' }) {
    // The GPU holds MAX_VOLUMES: the oldest crystal goes, glass and all, rather than staying visible but touching nothing.
    while (crystals.length >= MAX_VOLUMES) removeCrystal(crystals.shift()!);
    probe ??= reflections.probe(at);
    probe.at.set(at.x, at.y, at.z);
    const c = new pc.Color().fromString(o.colour);
    // Glass that refracts what is behind it, reflects the probe and lights its edges (src/reflections.ts).
    const glass = glassMaterial(o.colour, probe.cubemap), material = glass.material;
    const entity = new pc.Entity('Cristal');
    const instance = new pc.MeshInstance(quartzMesh(o.size.x, o.size.y, o.size.z, o.cluster ?? false), material);
    // On the glass layer: probes never see it (it samples their cubemap), the scene's camera does.
    entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false, layers: [reflections.glassLayer().id] });
    entity.setPosition(at.x, at.y, at.z);
    entity.setLocalScale(1e-4, 1e-4, 1e-4);
    app.root.addChild(entity);
    const light = new pc.Entity('Luz del cristal');
    light.addComponent('light', { type: 'omni', color: new pc.Color(.55 + c.r * .45, .55 + c.g * .45, .55 + c.b * .45), intensity: 0, range: (o.size.y + o.size.z) * 3 + 1.5, castShadows: false });
    app.root.addChild(light);
    const volume = gpu!.volume({ shape: 'quartz', mode: o.mode, strength: o.strength ?? 0, swirl: o.swirl ?? 0, range: o.range ?? 1, distance: o.distance ?? .1, bounce: o.bounce ?? .8, follow: entity, size: { x: 1e-3, y: 1e-3, z: 1e-3 } });
    const crystal: Crystal = { entity, light, volume, material, glass, size: new pc.Vec3(o.size.x, o.size.y, o.size.z), base: new pc.Vec3(at.x, at.y, at.z), left: o.seconds, age: 0, grow: .35, spin: o.spin ?? 40, end: o.end ?? 'fade', colour: o.colour };
    crystals.push(crystal);
    glassChanged();
    return crystal;
  }

  /** Brief lights where hits land, in their colour, so a blow lights up whoever it hits and around them. */
  const glints: { light: pc.Entity; age: number; seconds: number; intensity: number }[] = [];
  function glint(at: Vec, colour: string, intensity: number, range: number, seconds = .3) {
    // A storm of blows keeps only the newest few.
    while (glints.length >= GLINTS) glints.shift()!.light.destroy();
    const light = new pc.Entity('Destello');
    light.addComponent('light', { type: 'omni', color: new pc.Color().fromString(colour), intensity, range, castShadows: false });
    light.setPosition(at.x, at.y, at.z);
    app.root.addChild(light);
    glints.push({ light, age: 0, seconds, intensity });
  }
  function fadeGlints(dt: number) {
    for (let i = glints.length - 1; i >= 0; i--) {
      const g = glints[i];
      g.age += dt;
      if (g.age >= g.seconds) { g.light.destroy(); glints.splice(i, 1); continue; }
      g.light.light!.intensity = g.intensity * (1 - g.age / g.seconds) ** 2;
    }
  }

  const effects = {
    particles,
    /** Fire drawn whole (src/flames.ts), which `fire` burns. */
    flames,
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
      glint(target, options.guarded ? '#cfe6ff' : '#ffe6b8', .8 + k * .9, 2.6, .22);
      if (gpuOn) {
        // Hot streaks fly on into whoever was hit, glance off their head and back, slide along them
        // and some cling a moment, glowing; a few embers float off.
        const push = 3.5 + k * 2;
        gpu!.burst('spark', { at: target, count: 30 + 60 * k, spread: .05, velocity: { x: direction.x * push, y: 1.8 + k, z: direction.z * push }, speed: 2.4, cone: 1.15, life: [.35, .95] });
        gpu!.burst('needle', { at: target, count: 10 + 20 * k, spread: .05, velocity: { x: direction.x * push * .8, y: 2 + k, z: direction.z * push * .8 }, speed: 2, cone: 1.3, life: [.4, .9] });
        gpu!.burst('ember', { at: target, count: 8 + 16 * k, spread: .12, velocity: { x: direction.x * 1.2, y: 1.4, z: direction.z * 1.2 }, speed: 1.2, cone: 1.5, life: [.7, 1.6] });
      } else particles.burst('spark', target, Math.round(6 + 12 * k), { direction, cone: .95, spread: .1 });
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
     * flash, a ring at the feet and a light of its colour on whoever it hits. `strength` 1 is a
     * normal skill. With `body` (whoever is hit), fire is left burning around them; with their
     * `model`, on their own body too.
     */
    element(element: Element, target: Vec, options: { from?: Vec; strength?: number; feet?: Vec; body?: Body; model?: pc.Entity } = {}) {
      const k = options.strength ?? 1, n = (count: number) => Math.round(count * k);
      const feet = options.feet ?? { x: target.x, y: groundAt(target.x, target.z), z: target.z };
      const floor = { x: feet.x, y: feet.y + .04, z: feet.z }, colours = ELEMENT_COLOURS[element];
      const dx = options.from ? target.x - options.from.x : 0, dz = options.from ? target.z - options.from.z : 0, d = Math.hypot(dx, dz);
      const onward = d > 1e-3 ? { x: dx / d, y: .5, z: dz / d } : undefined;
      particles.burst('flash', target, 1, { size: .45 + k * .35, colour: colours });
      glint(target, colours[1], 1.4 + k * 1.2, 3.2, .45);
      particles.burst(element === 'ice' ? 'rime' : 'shock', floor, 1, { size: .7 + k * .5, colour: colours });
      const mark = ELEMENT_MARKS[element];
      if (mark) effects.mark(mark, feet, .5 + .25 * k);
      switch (element) {
        case 'fire':
          // It catches: what it leaves burning grows with the blow (a flicker, a campfire, a blaze),
          // around whoever it hit, and cinders and sparks fly on through.
          effects.fire(new pc.Vec3(feet.x, feet.y, feet.z), k < .8 ? 'light' : k < 1.3 ? 'medium' : 'high', { seconds: .6 + .5 * k, body: options.body, model: options.model });
          if (gpuOn) {
            // In a fight the heat gathers first: embers drawn in from a ring round them, spiralling,
            // then thrown out as it catches.
            const middle = { x: feet.x, y: feet.y + (options.body?.height ?? 1) * .5, z: feet.z };
            gpu!.burst('ember', { at: { x: feet.x, y: feet.y + .25, z: feet.z }, count: n(160), shape: 'ring', spread: 1.5, speed: .3, up: .6, life: [1, 1.8] });
            gpu!.burst('crackle', { at: middle, count: n(140), spread: .2, speed: 2.4, life: [.3, .7] });
            const field = gpu!.field({ at: middle, radius: 2.4, pull: 16 * k, swirl: 12 * k, lift: .5 });
            pulses.push({ field, left: .4, then: () => {
              const out = gpu!.field({ at: middle, radius: 2.2, pull: -22 * k, swirl: 6, lift: 3 });
              pulses.push({ field: out, left: .14 });
            } });
          } else {
            particles.burst('cinder', target, n(18), { spread: .3, speed: 1.6 });
            particles.burst('fleck', target, n(16), onward ? { direction: onward, cone: 1, spread: .2, speed: 1.4, front: .6 } : { spread: .25, front: .6 });
          }
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
      // Burning: a fire wrapping them, its flames behind them and in front of them.
      if (element === 'fire') { const fire = effects.fire(at, 'medium', { seconds, body: { radius: .35, height } }); return { stop() { fire.stop(); } }; }
      // Flakes drift down from above the head; everything else rises from the body.
      const streams = AURAS[element].map(([kind, rate]) => ({ above: kind === 'flake', emitter: particles.emitter(kind, at, { rate, spread: .35, ...(kind === 'flake' ? { velocity: { x: 0, y: -.6, z: 0 } } : {}) }) }));
      const twirl = element === 'air' || element === 'energy' ? particles.attract({ at, pull: 1, swirl: element === 'air' ? 8 : 4, lift: element === 'air' ? 1.5 : 0, radius: 1.2 }) : undefined;
      const aura = { at, height, left: seconds, streams, twirl };
      auras.push(aura);
      return { stop() { aura.left = 0; } };
    },
    /**
     * A fire burning on the floor at `at` (keep it updated to move it): `light` a small flicker,
     * `medium` a campfire, `high` a blaze. Its flames are drawn whole, never as sprites, and never
     * repeat. It grows in, breathes, crackles and throws a flickering light; set `level` while it
     * burns to grow or calm it, and `stop()` lets it die down (`seconds` stops it by itself). With
     * `body` it burns around someone standing at `at`: flames behind them and, see-through, in
     * front of them, reaching up them as its level says, and its light falls on them. With their
     * `model` too, their own body burns: flames crawl up its surfaces and sparks fly off it, moving
     * with it (src/flames.ts, `wrap`); `glow` says how much to heat it.
     */
    fire(at: pc.Vec3, level: FireLevel = 'medium', options: { seconds?: number; body?: Body; model?: pc.Entity } = {}) {
      const f = FIRE[level], body = options.body ?? (options.model ? bodyOf(options.model, at) : undefined), size = fireSize(level, body);
      const light = new pc.Entity('Luz del fuego');
      light.addComponent('light', { type: 'omni', color: FIRE_LIGHT, intensity: 0, range: f.light.range, castShadows: false });
      app.root.addChild(light);
      const fire: Fire = {
        at, level, body, model: options.model, strength: 0, left: options.seconds ?? Infinity, light, ...size, range: f.light.range,
        // Alone it stands where it is; around someone, behind them, and a see-through layer in front.
        behind: flames.add(at, { smoke: f.smoke, nearer: body ? -(body.radius + .05) : 0, strength: 0 }),
        // On their own body the shell burns in front of them; around someone without one, a layer does.
        front: body && !options.model ? flames.add(at, { smoke: 0, nearer: body.radius + .12, hollow: .35, strength: 0 }) : undefined,
        shell: options.model ? flames.wrap(options.model) : undefined,
        swirl: body ? particles.attract({ at, pull: .4, swirl: 0, radius: 1 }) : undefined,
        sparks: particles.emitter('fleck', at, { rate: 0, spread: options.model ? .04 : size.width * .6, flat: true, front: body ? body.radius + .2 : 0 }),
        phase: Math.random() * 100, crackle: f.crackle ? between(f.crackle.every) : 0, flare: 0, glow: 0, lux: 0, lightY: at.y,
      };
      fires.push(fire);
      return {
        at,
        get level() { return fire.level; },
        set level(value: FireLevel) { fire.level = value; },
        /** Still burning or dying down. */
        get burning() { return fires.includes(fire); },
        /** How brightly it burns now (0–~1.4), flickering: heat whoever it is on with it. */
        get glow() { return fires.includes(fire) ? fire.glow : 0; },
        stop() { fire.left = 0; },
      };
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
    setScene(environment: Environment, scenery: SceneShape & { root: pc.Entity }) {
      bounds = sceneWorld(environment, scenery);
      particles.setWorld(bounds); marks.setWorld(bounds);
      sun = (scenery.root.findComponents('light') as pc.LightComponent[]).filter(l => l.type === 'directional').sort((a, b) => b.intensity - a.intensity)[0];
      air.forEach(a => a.emitter.remove());
      auras.forEach(aura => { aura.left = 0; });
      fires.forEach(douse); fires.length = 0;
      particles.clear(true); marks.clear(true); placed.length = 0;
      const mood = AIR[environment.id] ?? (environment.plan ? INDOORS : OUTDOORS);
      particles.wind.set(...mood.wind); particles.turbulence = mood.turbulence;
      air = mood.kinds.map(kind => ({ kind, emitter: particles.emitter(kind.kind, { x: 0, y: 0, z: 0 }, { rate: 0, ambient: true, area: { x: 1, z: 1, low: kind.low, high: kind.high } }) }));
      // Weather only falls where there is a sky; a new scene starts with it already falling.
      outdoors = !environment.plan && !environment.palace && !environment.basilica;
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
    /** Called with true while there is glass to refract the scene (crystals), false once there is none (game.ts → post.glass). */
    onGlass(listener: (on: boolean) => void) { onGlass = listener; },
    /** Who is fighting, every frame of a fight: fight particles meet their parts (src/fight-particles.ts). */
    setFighters(models: readonly pc.Entity[]) { fightersNow = [...models]; gpu?.setFighters(models); },
    /**
     * A fight effect on `model` (a fighter), thrown from `from` (`FIGHT_FX`): built on the GPU
     * engine's kinds, fields, chains and neighbours. Returns false where it cannot play (no GPU
     * simulation, not in a fight, reduced motion).
     */
    fightFx(name: FightFx, o: { model: pc.Entity; from?: Vec; colour?: string; strength?: number }) {
      if (!gpu || !gpuOn) return false;
      // Where they stand: the scene's floor may not reach under the fight (it reads −1 there), so never below them.
      const p = o.model.getPosition(), feet = { x: p.x, y: Math.max(groundAt(p.x, p.z), p.y), z: p.z }, body = bodyOf(o.model, feet);
      const k = o.strength ?? 1, n = (count: number) => Math.round(count * k), who = fighterIndex(o.model);
      const chest = { x: feet.x, y: feet.y + body.height * .55, z: feet.z };
      const from = o.from ?? { x: chest.x - 2, y: chest.y + .3, z: chest.z };
      const dx = chest.x - from.x, dz = chest.z - from.z, d = Math.hypot(dx, dz) || 1, onward = { x: dx / d, y: .4, z: dz / d };
      const brief = (field: GpuField, seconds: number) => pulses.push({ field, left: seconds });
      switch (name) {
        case 'shatter':
          gpu.burst('shard', { at: chest, count: n(140), spread: .1, velocity: { x: onward.x * 4, y: 2.5, z: onward.z * 4 }, speed: 2.5, cone: 1.3, life: [.8, 1.6] });
          gpu.burst('frost', { at: { x: feet.x, y: feet.y + .05, z: feet.z }, count: n(120), shape: 'ring', spread: body.radius + .15, speed: .4, around: .6, life: [1.2, 2] });
          gpu.burst('needle', { at: chest, count: n(40), spread: .1, speed: 3, life: [.3, .6], colour: '#bfe8ff' });
          break;
        case 'arc':
          // Chains of light leap from above them, crackling on the turbulence and a quick swirl round them.
          gpu.burst('arc', { at: { x: chest.x, y: chest.y + body.height * .8, z: chest.z }, count: n(12) * 14, chain: 14, spread: .15, speed: 5, life: [.35, .7], light: { intensity: 3.5, range: 3 } });
          gpu.burst('arc', { at: chest, count: n(8) * 10, chain: 10, shape: 'surface', fighter: who, outward: 2.5, speed: 1.5, life: [.25, .5] });
          brief(gpu.field({ at: chest, radius: body.height + 1, swirl: 14, pull: 6, follow: o.model, offset: { x: 0, y: body.height * .55, z: 0 } }), .6);
          break;
        case 'vortex': {
          // Their colour spirals up round them: a ring of motes spun on a vortex, strands of it trailing.
          const colour = o.colour ?? '#e2483d';
          gpu.burst('mote', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, count: n(260), shape: 'ring', spread: body.radius + .35, around: 2.5, up: 1.4, speed: .2, life: [1, 1.8], colour, light: { intensity: 2.5, range: 2.8, colour } });
          gpu.burst('trail', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, count: n(10) * 16, chain: 16, shape: 'ring', spread: body.radius + .4, around: 3, up: 2.2, life: [1, 1.4], colour });
          brief(gpu.field({ at: chest, radius: body.height + 1.2, swirl: 12, pull: 3, lift: 2, follow: o.model, offset: { x: 0, y: body.height * .5, z: 0 } }), 1.6);
          break;
        }
        case 'swarm':
          // Shadow: a swarm gathers round them, circling as one, seeing itself.
          gpu.burst('swarm', { at: { x: chest.x, y: chest.y + .3, z: chest.z }, count: n(360), spread: 1.4, speed: 1.5, life: [2.2, 3] });
          brief(gpu.field({ at: chest, radius: 3, swirl: 6, pull: 4, follow: o.model, offset: { x: 0, y: body.height * .55, z: 0 } }), 2.4);
          break;
        case 'goo':
          gpu.burst('goo', { at: { x: chest.x - onward.x * .6, y: chest.y + .2, z: chest.z - onward.z * .6 }, count: n(90), spread: .1, velocity: { x: onward.x * 3.2, y: 1.6, z: onward.z * 3.2 }, speed: 1.4, cone: .7, life: [2, 3] });
          break;
        case 'heal':
          gpu.burst('heal', { at: { x: feet.x, y: feet.y + .05, z: feet.z }, count: n(220), shape: 'ring', spread: body.radius + .25, around: 1.2, up: 1, speed: .3, life: [1, 1.8], light: { intensity: 2.2, range: 2.5 } });
          brief(gpu.field({ at: chest, radius: body.height + .8, swirl: 4, lift: 1.5, pull: 1.5, follow: o.model, offset: { x: 0, y: body.height * .6, z: 0 } }), 1.5);
          break;
        case 'fireworks':
          // Rockets with a trail behind each, bursting into embers over them.
          gpu.burst('trail', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, count: n(12) * 20, chain: 20, spread: .2, velocity: { x: 0, y: 7.5, z: 0 }, speed: 1.8, cone: .5, life: [.8, 1.1], colour: o.colour ?? '#ffd27a', light: { intensity: 3, range: 3.5 } });
          break;
        case 'needles':
          gpu.burst('needle', { at: chest, count: n(160), spread: .05, velocity: { x: onward.x * 5, y: 2.2, z: onward.z * 5 }, speed: 2.8, cone: 1.2, life: [.5, 1.1] });
          break;
        case 'prison': {
          // A crystal closes round them: light caught inside bounces off its walls (and off them), lighting them from within.
          const colour = o.colour ?? '#9fd8ff', h = body.height * .75 + .25;
          crystalAt({ x: feet.x, y: feet.y + h * .55, z: feet.z }, { colour, size: { x: body.radius + .3, y: h * .7, z: .45 }, seconds: 3, mode: 'contain', bounce: .95, spin: 18 });
          later.push({ left: .25, then: () => gpu.burst('prism', { at: chest, count: n(160), spread: .2, speed: 3, life: [2.4, 2.9], colour, light: { intensity: 3, range: 2.6, colour } }) });
          break;
        }
        case 'orbit': {
          // A crystal over their head with light circling its faces, strands of it trailing.
          const colour = o.colour ?? '#ffd76a', at = { x: feet.x, y: feet.y + body.height + .55, z: feet.z };
          crystalAt(at, { colour, size: { x: .13, y: .16, z: .17 }, seconds: 3, mode: 'orbit', strength: 30, swirl: 14, range: 1.4, distance: .14, spin: 55 });
          gpu.burst('mote', { at, count: n(180), spread: .9, speed: .6, life: [2.2, 2.8], colour, light: { intensity: 2.6, range: 2.6, colour } });
          gpu.burst('trail', { at, count: n(6) * 12, chain: 12, spread: .7, speed: .8, life: [2, 2.6], colour });
          break;
        }
        case 'gather': {
          // A crystal draws sparks in from all round them; they settle on its faces and slide, until it bursts.
          const colour = o.colour ?? '#ff9a3c', at = { x: feet.x, y: feet.y + body.height + .6, z: feet.z };
          crystalAt(at, { colour, size: { x: .15, y: .2, z: .2 }, seconds: 2.1, mode: 'attract', strength: 34, swirl: 3, range: 3.2, spin: 70, end: 'shatter', cluster: true });
          gpu.burst('ember', { at: { x: feet.x, y: feet.y + .7, z: feet.z }, count: n(240), shape: 'ring', spread: 1.5, speed: .3, up: 1.2, life: [1.8, 2.4], light: { intensity: 2.4, range: 2.6 } });
          break;
        }
        case 'meteor': {
          // Meteors fall on them from high up, trailing, and flare where they land; the light comes down with them.
          const high = 7, fall = Math.sqrt(2 * high / 14);
          gpu.burst('meteor', { at: { x: feet.x - 1.2, y: feet.y + high, z: feet.z - .4 }, count: n(5) * 16, chain: 16, spread: .5, velocity: { x: 1.2 / fall, y: 0, z: .4 / fall }, speed: .3, cone: .3, life: [2, 2.2], light: { intensity: 4, range: 4 } });
          later.push({ left: fall, then: () => {
            gpu.burst('needle', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, count: n(120), spread: .3, velocity: { x: 0, y: 3, z: 0 }, speed: 3, cone: 1.3, life: [.5, 1], light: { intensity: 3, range: 3.5 } });
            gpu.burst('ember', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, count: n(80), shape: 'ring', spread: .3, speed: 2, up: 1.5, life: [.8, 1.6] });
            effects.mark('scorch', feet, .6);
          } });
          break;
        }
        case 'fireflies': {
          // Warm lights wander round them and light them as they pass.
          gpu.burst('firefly', { at: { x: chest.x, y: chest.y + .2, z: chest.z }, count: n(56), spread: body.radius + .5, speed: .5, life: [3.2, 4], light: { intensity: 2.2, range: 2.2 } });
          brief(gpu.field({ at: chest, radius: 2, swirl: 2, pull: 1, follow: o.model, offset: { x: 0, y: body.height * .6, z: 0 } }), 4);
          break;
        }
        // Lattices (src/lattice.ts): shapes made of particles that hold together.
        case 'ward': {
          // A wall of light between them and the blows: thrown sparks dent it, punch holes in it and knock
          // bits loose that fall; then it draws them back and mends, and at last crumbles from the top.
          const colour = o.colour ?? '#8fd8ff', away = body.radius + .85;
          // On the floor, its lowest row clear of it: a lattice started inside the floor is pushed out
          // row by row and tears (the scene's floor may not reach under the fight: then theirs).
          const wx = chest.x - onward.x * away, wz = chest.z - onward.z * away, mid = { x: wx, y: Math.max(groundAt(wx, wz), feet.y) + .78, z: wz };
          const rotation = new pc.Quat().setFromEulerAngles(0, Math.atan2(onward.x, onward.z) * 180 / Math.PI, 0);
          const ward = gpu.lattice('node', {
            grid: [36, 24, 1], size: { x: .8, y: .52, z: .02 }, shape: 'box', at: mid, rotation, life: 7, hold: .35, colour,
            rigidity: 260, bonds: 500, damping: 9, viscosity: 2, toughness: .5, glow: 2.5, hitRadius: .07, transfer: .55, bounce: .25,
            light: { intensity: 1.4, range: 2.2, colour },
          });
          const shoot = (count: number, left: number, speed: number) => later.push({ left, then: () => {
            if (!ward.alive) return;
            const dx = mid.x - from.x, dy = mid.y + .1 - from.y, dz = mid.z - from.z, dd = Math.hypot(dx, dy, dz) || 1;
            ward.hitBy(gpu.burst('spark', { at: from, count: n(count), spread: .06, velocity: { x: dx / dd * speed, y: dy / dd * speed, z: dz / dd * speed }, speed: 1, cone: .14, life: [.6, 1] }));
          } });
          shoot(30, .4, 6); shoot(60, .95, 10); shoot(90, 1.5, 13);
          lattices.push({ lattice: ward, age: 0, seconds: 4.6, step: t => {
            ward.reform = t > 2.2 && t < 3.6 ? 70 : 0;
            if (t > 3.6) { ward.breakInto = 'chip'; ward.dissolveFrom = 'top'; ward.dissolve = span(t, 3.6, 4.4); }
          } });
          break;
        }
        case 'morph': {
          // A ball of light over them becomes a crystal, a ring, a column and a ball again, every point
          // keeping its neighbours; a push shakes it like jelly, and it springs back.
          const colour = o.colour ?? '#ffd76a', at = { x: feet.x, y: feet.y + body.height + .8, z: feet.z };
          const shapes: LatticeShape[] = ['ball', 'crystal', 'ring', 'column', 'ball'];
          const sizes: Record<LatticeShape, [number, number, number]> = { ball: [.4, .4, .4], crystal: [.3, .55, .3], ring: [.48, .09, .13], column: [.18, .55, .18], box: [.35, .35, .35], shield: [.35, .45, .1], sphere: [.42, .42, .02] };
          const blob = gpu.lattice('node', {
            grid: [14, 14, 14], size: { x: .4, y: .4, z: .4 }, shape: 'ball', at, life: 8, hold: .4, colour, scale: .8,
            rigidity: 70, bonds: 200, damping: 5, viscosity: 1.5, glow: 1.2, light: { intensity: 2, range: 2.4, colour },
          });
          const each = .9;
          lattices.push({ lattice: blob, age: 0, seconds: 5.2, step: (t, dt) => {
            const seg = Math.min(shapes.length - 2, Math.floor(t / each)), u = span(t - seg * each, .3, .85);
            const a = shapes[seg], b = shapes[seg + 1];
            blob.shape = a; blob.morphTo = b; blob.morph = u;
            blob.size.set(...sizes[a].map((v, i) => v + (sizes[b][i] - v) * u) as [number, number, number]);
            blob.rotation.mul2(new pc.Quat().setFromEulerAngles(0, 35 * dt, 0), blob.rotation.clone());
            if (Math.abs(t - 1.55) < dt / 2) blob.push({ x: at.x + .2, y: at.y + .3, z: at.z }, .7, 2.5);
            if (Math.abs(t - 3.25) < dt / 2) blob.push({ x: at.x - .5, y: at.y, z: at.z + .2 }, .9, 3);
            if (t > 4.5) { blob.breakInto = 'mote'; blob.dissolveFrom = 'top'; blob.dissolve = span(t, 4.5, 5.1); }
          } });
          break;
        }
        case 'current': {
          // A ring of light round them, streaming round itself in waves: it tightens round them, runs
          // faster and faster, and breaks into motes.
          const colour = o.colour ?? '#7ff0d0', base = { x: feet.x, y: feet.y + body.height * .55, z: feet.z }, wide = body.radius + .55, tight = body.radius + .2;
          const ring = gpu.lattice('thread', {
            grid: [72, 3, 3], size: { x: wide, y: .05, z: .07 }, shape: 'ring', at: base, life: 7, hold: .4, colour,
            rigidity: 90, bonds: 120, damping: 6, viscosity: 1, glow: .4, flow: 20, wave: { height: .07, length: .9, speed: 1.6 },
            light: { intensity: 1.8, range: 2.4, colour },
          });
          lattices.push({ lattice: ring, age: 0, seconds: 3.9, step: t => {
            ring.size.x = wide + (tight - wide) * span(t, .6, 1.6);
            ring.at.set(base.x, base.y + .25 * span(t, 1.2, 2.6), base.z);
            ring.rotation.setFromEulerAngles(10 * Math.sin(t * 2.1), 0, 8 * Math.cos(t * 1.7));
            ring.flow = 20 + 50 * span(t, 2, 3);
            ring.wave.height = .07 + .08 * span(t, 2, 3);
            if (t > 3.2) { ring.breakInto = 'mote'; ring.dissolve = span(t, 3.2, 3.7); }
          } });
          break;
        }
        case 'veil': {
          // Cloth of light falls on them: it drapes over their back and head, settles on the floor round
          // them, then frays away from its edges.
          const colour = o.colour ?? '#e9dcff', half = body.radius + .55;
          const veil = gpu.lattice('veil', {
            grid: [30, 1, 30], size: { x: half, y: .01, z: half }, shape: 'box', at: { x: feet.x, y: feet.y + body.height + .8, z: feet.z },
            rotation: new pc.Quat().setFromEulerAngles(0, 20, 0), life: 7, hold: .45, colour,
            rigidity: 0, bonds: 900, damping: 0, viscosity: 3, glow: .8,
          });
          lattices.push({ lattice: veil, age: 0, seconds: 3.9, step: t => {
            if (t > 2.8) { veil.breakInto = 'mote'; veil.dissolveFrom = 'outside'; veil.dissolve = span(t, 2.8, 3.7); }
          } });
          break;
        }
        case 'forge': {
          // Embers fly in from all round them and build a crystal over them; it holds, turning and glowing,
          // then bursts from its heart into chips that rain on them.
          const colour = o.colour ?? '#ff9a3c', at = { x: feet.x, y: feet.y + body.height + .9, z: feet.z };
          const forge = gpu.lattice('node', {
            grid: [11, 15, 11], size: { x: .3, y: .5, z: .3 }, shape: 'crystal', at, life: 8, hold: .4, colour, scale: .85,
            from: { at: { x: feet.x, y: feet.y + .6, z: feet.z }, spread: 2.2, shape: 'ring', speed: .6 },
            reform: 16, rigidity: 160, bonds: 300, damping: 8, viscosity: 1.5, glow: 1.5, light: { intensity: 2.6, range: 3, colour },
          });
          lattices.push({ lattice: forge, age: 0, seconds: 3.4, step: (t, dt) => {
            forge.rotation.mul2(new pc.Quat().setFromEulerAngles(0, 50 * dt, 0), forge.rotation.clone());
            if (t > 2.6) {
              if (forge.reform > 0) {
                forge.reform = 0; forge.breakInto = 'chip'; forge.dissolveFrom = 'push';
                forge.push(at, 1.2, 4.5);
                glint(at, colour, 3, 3.5, .35);
              }
              forge.dissolve = span(t, 2.6, 2.9);
            }
          } });
          break;
        }
        case 'shield': {
          // An escutcheon of light raised between them and the blows, its rim bright and a boss at its
          // heart. It unfolds from its middle; sparks glance off it, dent it and knock bits loose; it
          // mends; and a last heavy volley shatters it from where it lands.
          const colour = o.colour ?? '#ffd27a', away = body.radius + .7, wx = chest.x - onward.x * away, wz = chest.z - onward.z * away;
          const centre = { x: wx, y: Math.max(groundAt(wx, wz), feet.y) + .8, z: wz };
          // Its face (+z, bent out) turned to whoever strikes, leaning back a little.
          const rotation = new pc.Quat().setFromEulerAngles(0, Math.atan2(-onward.x, -onward.z) * 180 / Math.PI, 0).mul(new pc.Quat().setFromEulerAngles(-8, 0, 0));
          const face = rotation.transformVector(new pc.Vec3(0, 0, 1));
          const full = { x: .42, y: .55, z: .1 };
          const shield = gpu.lattice('node', {
            grid: [30, 36, 2], size: { x: .02, y: .02, z: .005 }, shape: 'shield', at: centre, rotation, life: 7, hold: .35, colour, scale: .55,
            rigidity: 280, bonds: 500, damping: 9, viscosity: 2, toughness: 0, glow: 2.5, rim: 3, hitRadius: .07, transfer: .5, bounce: .35,
            light: { intensity: 1.6, range: 2.4, colour },
          });
          const bossAt = { x: centre.x + face.x * (full.z + .05), y: centre.y + face.y * (full.z + .05), z: centre.z + face.z * (full.z + .05) };
          const boss = gpu.lattice('node', {
            grid: [6, 6, 6], size: { x: .005, y: .005, z: .005 }, shape: 'ball', at: bossAt, rotation, life: 7, hold: .35, colour: '#fff2c4', scale: .7,
            rigidity: 320, bonds: 500, damping: 10, viscosity: 2, toughness: 0, glow: 2, hitRadius: .07, transfer: .4, bounce: .4,
          });
          const travel = Math.hypot(centre.x - from.x, centre.y - from.y, centre.z - from.z);
          const shoot = (count: number, left: number, speed: number) => later.push({ left, then: () => {
            if (!shield.alive) return;
            const dx = centre.x - from.x, dy = centre.y + .05 - from.y, dz = centre.z - from.z;
            const batch = gpu.burst('spark', { at: from, count: n(count), spread: .06, velocity: { x: dx / travel * speed, y: dy / travel * speed, z: dz / travel * speed }, speed: 1, cone: .15, life: [.6, 1] });
            shield.hitBy(batch); boss.hitBy(batch);
          } });
          shoot(25, .6, 6); shoot(50, 1, 10); shoot(70, 1.4, 12); shoot(140, 3, 16);
          const breaks = 3 + travel / 16;
          lattices.push({ lattice: shield, age: 0, seconds: 4.3, step: t => {
            const k = 1 - (1 - span(t, 0, .45)) ** 2;
            shield.size.set(full.x * k + .02, full.y * k + .02, full.z * k + .005);
            boss.size.set(.07 * k + .005, .07 * k + .005, .07 * k + .005);
            // Unfolding stretches every bond: it only gives way to blows once it stands whole.
            shield.toughness = t > .6 ? .5 : 0; boss.toughness = t > .6 ? .6 : 0;
            shield.reform = boss.reform = t > 2 && t < 2.9 ? 70 : 0;
            if (t > breaks) {
              if (shield.breakInto !== 'chip') {
                // The heavy volley lands: the shield gives way from where it struck.
                for (const l of [shield, boss]) { l.breakInto = 'chip'; l.dissolveFrom = 'push'; l.push(centre, .7, 4.5); }
                glint(centre, colour, 3, 3, .35);
              }
              shield.dissolve = boss.dissolve = span(t, breaks, breaks + .35);
            }
          } });
          lattices.push({ lattice: boss, age: 0, seconds: 4.3, step: () => {} });
          break;
        }
        case 'bubble':
        case 'globe':
        case 'orb': {
          // A sphere round them that rises as a disc from their feet and swells round them, turning.
          // Blows from every side glance off it and dent it, and it heals at once; at last it pops.
          // `bubble`: bands of light round it (its parallels) with glass facets between them; `globe`:
          // bands both ways (parallels and meridians) and the glass; `orb`: glass made of the shield's
          // dots alone. The glass is see-through where it faces you and bright round its outline.
          const colour = o.colour ?? '#8ff0ff', radius = Math.max(body.radius + .4, body.height * .62), middle = feet.y + body.height * .5;
          const base = { size: { x: radius, y: .02, z: .02 }, shape: 'sphere' as const, at: { x: feet.x, y: feet.y + .05, z: feet.z }, life: 7, hold: .4, colour,
            rigidity: 150, bonds: 250, damping: 7, viscosity: 1.5, toughness: .6, reform: 50, glow: 2, hitRadius: .08, transfer: .45, bounce: .4 };
          const light = { intensity: 1.6, range: 2.6, colour };
          const layers: GpuLattice[] = [];
          if (name === 'orb') layers.push(gpu.lattice('pane', { ...base, grid: [80, 34, 1], scale: .7, opacity: .6, fresnel: .85, wave: { height: .012, length: .7, speed: .8 }, light }));
          else {
            layers.push(gpu.lattice('thread', { ...base, grid: [56, 22, 1], wave: { height: .015, length: .7, speed: .8 }, light }));
            if (name === 'globe') layers.push(gpu.lattice('thread', { ...base, grid: [28, 48, 1], strands: 'y', wave: { height: .015, length: .7, speed: .8 } }));
            // The glass between the bands, a hair inside them.
            layers.push(gpu.lattice('facet', { ...base, size: { x: radius - .015, y: .02, z: .02 }, grid: [64, 28, 1], opacity: .45, fresnel: .9, glow: 1, wave: { height: .015, length: .7, speed: .8 } }));
          }
          const [outer] = layers;
          // Blows from the one who strikes and from either side of them.
          const heading = Math.atan2(onward.z, onward.x);
          const sides = [0, 1.2, -1.2].map(turn => ({ x: chest.x - Math.cos(heading + turn) * 2.4, y: chest.y + .25, z: chest.z - Math.sin(heading + turn) * 2.4 }));
          const shoot = (side: number, count: number, left: number, speed = 11) => later.push({ left, then: () => {
            if (!outer.alive) return;
            const at = side === 0 ? from : sides[side], dx = chest.x - at.x, dy = middle - at.y, dz = chest.z - at.z, d = Math.hypot(dx, dy, dz) || 1;
            const batch = gpu.burst('spark', { at, count: n(count), spread: .06, velocity: { x: dx / d * speed, y: dy / d * speed, z: dz / d * speed }, speed: 1, cone: .12, life: [.6, 1] });
            layers.forEach(l => l.hitBy(batch));
          } });
          shoot(0, 40, .9); shoot(1, 40, 1.3); shoot(2, 40, 1.7);
          // The bands pop; the orb, all glass, takes a last heavy volley and shatters from where it lands.
          const glass = name === 'orb', heart = { x: feet.x, y: middle, z: feet.z };
          const ox = from.x - heart.x, oy = from.y - heart.y, oz = from.z - heart.z, away = Math.hypot(ox, oy, oz) || 1;
          const struck = { x: heart.x + ox / away * radius, y: heart.y + oy / away * radius, z: heart.z + oz / away * radius };
          const breaks = glass ? 2.3 + Math.max(0, away - radius) / 16 : 2.8;
          if (glass) shoot(0, 140, 2.3, 16); else shoot(0, 70, 2.1);
          const turn = new pc.Quat();
          layers.forEach(layer => lattices.push({ lattice: layer, age: 0, seconds: 3.9, step: (t, dt) => {
            const rise = span(t, .15, .9);
            layer.size.y = .02 + (layer.size.x - .02) * rise;
            layer.at.y = feet.y + .05 + (middle - feet.y - .05) * rise;
            layer.rotation.mul2(turn.setFromEulerAngles(0, 20 * dt, 0), layer.rotation.clone());
            if (glass && t > breaks) {
              if (layer.reform > 0) {
                // The glass gives way where the volley lands: chips fly in from there, round the dog,
                // and the crack runs across the sphere to its far side.
                layer.reform = 0; layer.breakInto = 'chip'; layer.dissolveFrom = 'push';
                layer.push(struck, radius * 1.3, 5);
                glint(struck, colour, 3.5, 3.2, .4);
              }
              layer.dissolve = span(t, breaks, breaks + .5);
            } else if (t > breaks) {
              if (layer.reform > 0) {
                // It pops: out from its middle, into motes.
                layer.reform = 0; layer.breakInto = 'mote';
                layer.push(heart, radius * 1.6, 3.5);
                if (layer === outer) glint(heart, colour, 2.5, 3, .3);
              }
              layer.dissolve = span(t, breaks, breaks + .25);
            }
          } }));
          break;
        }
      }
      return true;
    },
    /** The GPU fight particles, when this device runs them (development and tests). */
    gpu,
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
      particles.setLight(lit[0], lit[1], lit[2]); marks.setLight(lit[0], lit[1], lit[2]); flames.setLight(lit[0], lit[1], lit[2]);
      // A fire's light shows at night and hardly by day, when the sun already floods the floor.
      firelight = Math.min(1, Math.max(.25, 1.45 - 1.4 * (lit[0] + lit[1] + lit[2]) / 3));
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
      // The GPU's fight particles: a fight starting bakes its floor; one ending empties them.
      const wantGpu = !!gpu && !!view.fight && animate;
      if (wantGpu && !gpuOn) gpu!.setFloor(view.focus, 16, (x, z) => groundAt(x, z));
      if (!wantGpu && gpuOn) { dropLattices(); dropCrystals();  fires.forEach(unGpu); pulses.forEach(p => p.field.remove()); pulses.length = 0; gpu!.clear(); fightersNow = []; }
      gpuOn = wantGpu;
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
      if (!view.paused) clock += dt;
      burn(view.paused ? 0 : dt);
      fadeGlints(view.paused ? 0 : dt);
      flames.update(view.paused ? 0 : dt);
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        if ((pulse.left -= view.paused ? 0 : dt) > 0) continue;
        pulse.field.remove(); pulses.splice(i, 1); pulse.then?.();
      }
      for (let i = later.length - 1; i >= 0; i--) {
        if ((later[i].left -= view.paused ? 0 : dt) > 0) continue;
        const then = later[i].then; later.splice(i, 1);
        if (gpuOn) then();
      }
      updateCrystals(view.paused ? 0 : dt);
      updateLattices(view.paused ? 0 : dt);
      if (gpu) { gpu.setLight(lit[0], lit[1], lit[2]); gpu.lightScale = firelight; gpu.update(view.paused ? 0 : dt, gpuOn); }
      particles.update(view.paused ? 0 : dt);
      trails.enabled = animate;
      trails.update(view.paused ? 0 : dt);
      marks.update(view.paused ? 0 : dt);
    },
    /** Ends every effect, aura, fire and trail in flight (fires go out at once, as the fight they burn in may be going); the scene's air and weather stay, and marks fade out. */
    clear() { dropLattices(); dropCrystals(); auras.forEach(aura => { aura.left = 0; }); fires.forEach(douse); fires.length = 0; glints.forEach(g => { g.age = g.seconds; }); particles.clear(); trails.clear(); fadeMarks(); },
    destroy() { dropCrystals(); reflections.destroy(); fires.forEach(douse); fires.length = 0; glints.forEach(g => g.light.destroy()); glints.length = 0; particles.destroy(); flames.destroy(); gpu?.destroy(); trails.destroy(); marks.destroy(); },
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
export function sceneWorld(environment: Environment, scenery: SceneShape): ParticleWorld {
  const rows = environment.grid.length, cols = environment.grid[0].length;
  const origin = scenery.toWorld(0, 0);
  const top = new Float32Array(cols * rows).fill(-Infinity);
  const props = new Set(environment.props.flatMap(propCells).map(c => `${c.x},${c.z}`));
  const plan = environment.plan ?? environment.palace?.plan;
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    if (environment.grid[z][x] !== '#') continue;
    const p = scenery.toWorld(x, z);
    // A river sunk below the street is a drop, not a block: what falls lands on the water.
    if (scenery.waterHeight?.(p.x, p.z) !== undefined) continue;
    const house = scenery.houses.find(h => p.x >= h.x0 && p.x <= h.x1 && p.z >= h.z0 && p.z <= h.z1);
    top[z * cols + x] = house ? house.top : props.has(`${x},${z}`) ? 1 : plan ? (environment.palace ? 3 : PLAN_TOPS[plan[z]?.[x]] ?? 2.6) : 2.3;
  }
  return {
    x0: origin.x - .5, z0: origin.z - .5, x1: origin.x + cols - .5, z1: origin.z + rows - .5,
    // Past the edge of the model is the backdrop far below.
    outside: -.95,
    ground: (x, z) => scenery.waterHeight?.(x, z) ?? scenery.groundHeight(x, z),
    cells: { x: origin.x, z: origin.z, cols, rows, top },
  };
}
