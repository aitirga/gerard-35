import type { Effects } from './effects';
import type { GpuBurst, GpuKind } from './fight-particles';

/**
 * Fluids for any effect (docs/graphics.md § The fluid): what the fight's GPU fluid gives fire, lava and
 * smoke, beside water (Marea, Riada). Each kind feels the others of its own body through the grid: it is
 * pushed from where it crowds and carried by the flow round it, so a ball of fire swells under its own
 * pressure and rolls as one, lava runs and pools slowly, smoke billows. Fight clock only (`after`).
 *
 * Fire keeps to orange and gold, smoke to warm greys, nácar to white, sea foam and pale gold; no pink, no violet (docs/visual-style.md).
 */
export const FLUID_KINDS = {
  // Lava: heavy, very thick, white-gold where it is fresh, orange, cooling to a dark crust; it slides
  // and pools on the floor and round whoever it meets.
  'fluido-lava': {
    shape: 'glow', blur: [.3, .55], drag: .5, gravity: 9, curl: .08, response: .1, collide: true, bounce: 0, friction: .85,
    size: [.12, .1], sizeJitter: .3, colours: ['#ffb347', '#ff5a10', '#3a0c04'], intensity: [2.8, 2.1, .75], middle: .22,
    fadeIn: .03, fadeOut: .22, additive: .45, opacity: .95, core: .15, fluid: { pressure: 7, viscosity: 10, rest: 7 },
  },
  // A fireball's burning gas: it swells under its own pressure, rolls and rises, white-hot to orange to soot.
  'fluido-fuego': {
    shape: 'glow', blur: [.55, 1.05], drag: 1.1, gravity: -2.4, curl: .55, response: .5, size: [.11, .24], sizeJitter: .4,
    colours: ['#ffd89a', '#ff7a1e', '#3a2a26'], intensity: [3.2, 2.1, .5], middle: .22, fadeIn: .02, fadeOut: .45, additive: .6, opacity: .9, core: .15,
    fluid: { pressure: 28, viscosity: 4, rest: 6 },
  },
  // Water thrown up that falls back as a body and spreads (Géiser's column coming down).
  'fluido-agua': {
    shape: 'glow', blur: [.5, .8], drag: .3, gravity: 9, curl: .1, response: .2, collide: true, bounce: .02, friction: .45,
    size: [.06, .065], sizeJitter: .35, colours: ['#e8fffb', '#5fd9c0', '#1f5fd8'], intensity: [1.4, 1.2, .95], middle: .45,
    fadeIn: .05, fadeOut: .3, additive: .2, opacity: .78, core: 0, fluid: { pressure: 14, viscosity: 6, rest: 10 },
  },
  // Steam: white, light, it rushes up and billows out under its own push, then thins.
  'fluido-vapor': {
    shape: 'glow', blur: [.6, 1.2], drag: 1.2, gravity: -2.6, curl: .9, response: .8, size: [.12, .36], sizeJitter: .5,
    colours: ['#ffffff', '#eef6f6', '#cfdede'], intensity: [1.4, 1.1, .8], middle: .3, fadeIn: .06, fadeOut: .55, additive: .3, opacity: .32, core: 0,
    fluid: { pressure: 16, viscosity: 2.5, rest: 6 },
  },
  // Nácar (Da capo's wave, src/eco-fx.ts): a light body of white, sea foam and pale gold that rolls across the party under
  // its own push and thins as it goes, never landing.
  'fluido-nacar': {
    shape: 'glow', blur: [.5, .9], drag: .9, gravity: -.4, curl: .45, response: .5, size: [.07, .16], sizeJitter: .45,
    colours: ['#fffaf0', '#8fe3c4', '#f2e2a8'], intensity: [2.2, 1.5, .9], middle: .35, fadeIn: .08, fadeOut: .5, additive: .7, opacity: .7, core: .2,
    fluid: { pressure: 18, viscosity: 3, rest: 7 },
  },
  // What a fire leaves: warm dark smoke that billows up and spreads under its own push.
  'fluido-humo': {
    shape: 'smoke', blur: [.7, 1.2], drag: 1.3, gravity: -1.1, curl: .8, response: .6, size: [.15, .34], sizeJitter: .45,
    colours: ['#4a3f3b', '#302927', '#1c1817'], intensity: [.9, .85, .8], middle: .4, fadeIn: .1, fadeOut: .5, additive: 0, opacity: .5, core: 0,
    fluid: { pressure: 12, viscosity: 3, rest: 6 },
  },
} satisfies Record<string, GpuKind>;

interface V3 { x: number; y: number; z: number }

/** Defines the fluid kinds on the fight's engine if they are not there yet (for modules that burst them directly). */
export function ensureFluidKinds(g: { get(name: string): unknown; define(name: string, kind: GpuKind): void } | undefined) {
  if (g) for (const [name, kind] of Object.entries(FLUID_KINDS)) if (!g.get(name)) g.define(name, kind);
}

export function createFluidFx(effects: Effects, after: (seconds: number, run: () => void) => void) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const ensure = () => ensureFluidKinds(effects.gpu);
  const burst = (kind: keyof typeof FLUID_KINDS, o: GpuBurst) => { ensure(); gpu()?.burst(kind, o); };
  return {
    /** Whether the GPU engine is running (nothing is drawn otherwise). */
    get on() { return !!gpu(); },
    burst,
    /**
     * A fireball at `at`, `radius` metres when grown: a knot of burning gas born packed, which swells
     * under its own pressure into a rolling ball, rises, and leaves a billow of smoke over it. `k` scales it.
     */
    fireball(at: V3, radius: number, k = 1, o: { colour?: string; smoke?: boolean } = {}) {
      const n = Math.round(700 * k * Math.max(.6, radius));
      burst('fluido-fuego', { at, count: n, spread: radius * .3, speed: radius * 2.6, up: .4, life: [.6, 1.1], ...o.colour ? { colour: o.colour } : {} });
      // A flat ring of it thrown out low along the floor, the blast's skirt.
      burst('fluido-fuego', { at: { ...at, y: at.y - radius * .3 }, count: Math.round(n * .35), shape: 'ring', spread: radius * .3, outward: radius * 3.2, up: .3, speed: .4, life: [.4, .7], ...o.colour ? { colour: o.colour } : {} });
      if (o.smoke !== false) after(.22, () => burst('fluido-humo', { at: { ...at, y: at.y + radius * .4 }, count: Math.round(n * .55), spread: radius * .45, speed: radius * 1.2, up: 1, life: [1.4, 2.3] }));
    },
    /**
     * Lava poured from `at`, `count` of it, thrown along `velocity` (± `speed` in a `cone`), to run and
     * pool where it lands; `spread` how wide it is born.
     */
    lava(at: V3, count: number, o: { velocity?: V3; speed?: number; cone?: number; spread?: number; life?: [number, number]; shape?: GpuBurst['shape']; outward?: number; up?: number } = {}) {
      burst('fluido-lava', { at, count: Math.round(count), spread: o.spread ?? .15, velocity: o.velocity ?? { x: 0, y: 0, z: 0 }, speed: o.speed ?? .5, ...o.cone ? { cone: o.cone } : {}, ...o.shape ? { shape: o.shape } : {}, ...o.outward ? { outward: o.outward } : {}, ...o.up ? { up: o.up } : {}, life: o.life ?? [1.8, 2.8] });
    },
    /** A splash of lava where a bomb lands at `feet`: it bursts low and spreads into a pool round them. */
    lavaPool(feet: V3, radius: number, k = 1) {
      burst('fluido-lava', { at: { ...feet, y: feet.y + .15 }, count: Math.round(220 * k), shape: 'ring', spread: radius * .5, outward: 1.6, up: 1.4, speed: .6, life: [1.6, 2.6] });
    },
  };
}
export type FluidFx = ReturnType<typeof createFluidFx>;
