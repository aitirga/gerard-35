import type { GpuKind } from './fight-particles.ts';
import type { Trails } from './trails.ts';

/**
 * A fighter's stats going up or down, whatever the cause (docs/graphics.md § Trails): the one
 * animation for it. Three clear chevrons pass in front of them one after another, outlined so they
 * read on any floor: rising and pointing up in blue, sinking and pointing down in red
 * (`chevronPose`, drawn by src/stat-arrows.ts). A circle of light spins at their feet, with a second one that opens out
 * when a stat rises and closes in when one falls; then a sheaf of thin bars runs past them, each
 * its own width, length and speed: down in red when a stat falls, up in blue when one rises.
 * Particles go with it (`effects.statChange`, on the GPU): light rising off them, or red drops
 * falling and settling at their feet. It is sized to whoever it happens to.
 * What sets it off is the rules saying so (`BattleEffect.stats`, src/battle.ts), so a new skill that
 * changes stats gets it just by saying which. Its shape is pure, `playStatChange` draws the trails.
 */
export type StatWay = 'up' | 'down';
export const STAT_LOOKS: Record<StatWay, { ring: readonly [string, string]; bars: readonly [string, string]; glow: string; spark: string }> = {
  // Saturated heads: a pale head reads white on the fight's light floors.
  down: { ring: ['#ff4a32', '#a80c16'], bars: ['#ff4630', '#8f0a12'], glow: '#ff2a1c', spark: '#ff8a76' },
  up: { ring: ['#5fd0ff', '#1470d8'], bars: ['#4cc4ff', '#0a58c0'], glow: '#2fa8ff', spark: '#9fe0ff' },
};
/** The circle's seconds, and how far through it the first bar leaves. */
const RING_SECONDS = .32, BARS_AFTER = .65;
const BARS = 14, BAR_STAGGER = .03;
/** However small someone is (a peeled onion), it stays big enough to read from the fight's camera. */
const LEAST_RADIUS = .55, LEAST_HEIGHT = 1.5;
/** The golden angle: however many bars, they spread evenly round whoever it is, with no pattern. */
const SPREAD = Math.PI * (3 - Math.sqrt(5));
/** A fixed, even scatter in 0–1 for bar `i` (the golden ratio's), so the shape is pure and every bar differs. */
const scatter = (i: number, salt: number) => ((i + 1) * .6180339887 + salt * .7548776662) % 1;

export interface StatBar {
  x: number; z: number; from: number; to: number; delay: number; seconds: number;
  /** How wide the bar is and how long a tail it leaves (seconds of trail). */
  width: number; tail: number;
}
export interface StatRing { radius: number; seconds: number; turns: number; narrow: number; width: number; delay: number }
/** Where the circles and each bar go, round the feet at (0, 0), for someone `wide` wide and `tall` tall. */
export function statChangeShape(way: StatWay, wide: number, tall: number) {
  const radius = Math.max(LEAST_RADIUS, wide), height = Math.max(LEAST_HEIGHT, tall);
  const low = -.02, high = height * 1.15;
  const bars: StatBar[] = Array.from({ length: BARS }, (_, i) => {
    const angle = i * SPREAD, a = scatter(i, 1), b = scatter(i, 2), c = scatter(i, 3);
    // Two bands round them, the inner a little nearer.
    const r = radius * (i % 2 ? .9 + .1 * a : .62 + .16 * a);
    // Some start a little up their body (rising) or end a little short of the floor (falling).
    const near = low + height * .18 * b, far = high + height * .12 * c;
    const seconds = .3 + .2 * c;
    return {
      x: Math.cos(angle) * r, z: Math.sin(angle) * r,
      from: way === 'down' ? far : near, to: way === 'down' ? low : far,
      delay: RING_SECONDS * BARS_AFTER + i * BAR_STAGGER + .02 * b, seconds,
      width: .035 + .045 * a * a, tail: seconds * (.35 + .55 * b),
    };
  });
  // The main circle spins in place; the second opens out (up) or closes in (down) a moment after it.
  const ring: StatRing = { radius: radius * 1.05, seconds: RING_SECONDS, turns: 1.5, narrow: 1, width: .12, delay: 0 };
  const echo: StatRing = way === 'up'
    ? { radius: radius * .7, seconds: RING_SECONDS * 1.6, turns: 1.1, narrow: 2.1, width: .05, delay: .08 }
    : { radius: radius * 1.55, seconds: RING_SECONDS * 1.6, turns: 1.1, narrow: .42, width: .05, delay: .08 };
  return { ring, echo, bars };
}
/** Plays it at `feet`, `delay` seconds from now (a blow in a flurry that has not landed yet). */
export function playStatChange(trails: Pick<Trails, 'spiral' | 'comet'>, feet: { x: number; y: number; z: number }, way: StatWay, o: { radius: number; height: number; delay?: number }) {
  const { ring, echo, bars } = statChangeShape(way, o.radius, o.height), look = STAT_LOOKS[way], delay = o.delay ?? 0;
  // Colours that cover what is behind them more than they add to it: on a violet floor, added light turns red into pink.
  // Each circle is two strands half a turn apart, flat on the floor, so it reads as a whole circle at this speed.
  for (const circle of [ring, echo]) for (const phase of [0, Math.PI]) trails.spiral({ x: feet.x, y: feet.y + .05, z: feet.z }, look.ring, {
    radius: circle.radius, narrow: circle.narrow, height: 0, turns: circle.turns, phase, seconds: circle.seconds, delay: delay + circle.delay,
    life: circle.seconds * .8, width: circle.width, taper: .4, intensity: circle === ring ? 1.5 : 1.15, additive: .3, core: .25, normal: { x: 0, y: 1, z: 0 },
  });
  // Bars, not streaks: straight, with no arc, a thin bright core (not so hot it blooms white) and barely narrowing to the tail.
  for (const bar of bars) trails.comet({ x: feet.x + bar.x, y: feet.y + bar.from, z: feet.z + bar.z }, { x: feet.x + bar.x, y: feet.y + bar.to, z: feet.z + bar.z }, look.bars, bar.seconds, {
    arc: 0, delay: delay + bar.delay, life: bar.tail, width: bar.width, taper: .25, intensity: 1.5, additive: .25, core: .3,
  });
}

/**
 * The chevrons (src/stat-arrows.ts): three, one after another as the circle has spun, each popping
 * in a little big, gliding the way the stat went past someone `height` tall (from their knees to
 * over their head rising, the other way falling) and fading at the end. Where chevron `i` is
 * `t` seconds after it all started, or nothing before it shows or once it has gone.
 */
export const CHEVRONS = { count: 3, after: .12, stagger: .11, seconds: .6 } as const;
export function chevronPose(way: StatWay, i: number, t: number, height: number): { y: number; scale: number; alpha: number } | undefined {
  const local = (t - CHEVRONS.after - i * CHEVRONS.stagger) / CHEVRONS.seconds;
  if (local < 0 || local > 1) return undefined;
  const h = Math.max(LEAST_HEIGHT, height);
  const from = way === 'up' ? h * .2 : h * 1.15, to = way === 'up' ? h * 1.15 : h * .15;
  const glide = 1 - (1 - local) ** 2.2;
  const scale = local < .14 ? local / .14 * 1.2 : local < .26 ? 1.2 - (local - .14) / .12 * .2 : 1;
  const alpha = local < .08 ? local / .08 : local > .62 ? 1 - (local - .62) / .38 : 1;
  return { y: from + (to - from) * glide, scale, alpha };
}

/**
 * While a stat stays up or down (`statShifts`, src/battle.ts), tiny bright motes of energy leave the
 * fighter's head, on the GPU (src/stat-motes.ts): up, blue ones that drift up off it and wink out;
 * down, red ones that fall off it past their shoulders, dimming as they go. Someone with stats both
 * up and down gives off both. They start once the chevrons have passed (`delay`, seconds) and stop
 * when the change wears off, the last ones finishing their climb or fall. Each way: its particle
 * kind (`STAT_MOTE_KINDS`), so many a second, born on their parts above `above` of their height,
 * pushed off them by `outward` and up by `up` (m/s), with a kick of `speed`, living `life` seconds.
 */
export const STAT_MOTES = {
  delay: .45,
  up: { kind: 'boost', rate: 16, above: .82, outward: .25, up: .45, speed: .12, life: [1, 1.6] },
  down: { kind: 'drain', rate: 16, above: .82, outward: .45, up: .15, speed: .1, life: [.9, 1.4] },
} as const;
/**
 * The motes themselves: round dots of light, white-hot only in their middle so their colour reads,
 * tiny but bright enough to bloom. Red covers what is behind it more than it adds to it: on a
 * violet floor, added red light turns pink.
 */
export const STAT_MOTE_KINDS = {
  // Up: they rise slowly off the head, wandering a little, and twinkle as they fade.
  boost: {
    blur: [0, .6],
    drag: 1.4, gravity: -.9, curl: .45, response: .4, size: [.026, .012], sizeJitter: .45, shape: 'dot',
    colours: ['#8fdcff', '#2a9cff', '#1458d8'], intensity: [6, 4.6, 2.6], middle: .3, fadeIn: .12, fadeOut: .45, additive: .9, flicker: .45,
  },
  // Down: the same in red, falling off the head and dimming as they drop.
  drain: {
    blur: [0, .6],
    drag: 1.1, gravity: 1.6, curl: .2, response: .4, size: [.026, .012], sizeJitter: .45, shape: 'dot',
    colours: ['#ff6a4a', '#ff2a1c', '#a80c16'], intensity: [6, 4.6, 2.4], middle: .3, fadeIn: .1, fadeOut: .4, additive: .6, flicker: .3,
  },
} as const satisfies Record<string, GpuKind>;
