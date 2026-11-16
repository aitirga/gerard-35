/**
 * The light through the Sagrada Família's windows in Fran's salon (docs/quests/luca.md § La Sagrada
 * peluquería): it walks through its colours in a loop, a sun that goes too fast, from the cold morning
 * to the warm afternoon. While a colour is on, the party's blows of the element it carries do nothing
 * (src/battle.ts `annulled`); the foes are not touched by it. The salon's floor shows the same light
 * (src/basilica-scenery.ts). Pure: what is on at a moment, what is coming, what changed between two.
 */
export const LIGHTS = {
  // In the elements' own colours (src/battle.ts ELEMENTS), so a cancelled blow reads at once. No pink, no violet.
  azul: { name: 'Azul', colour: '#4f9fe8', cancels: 'agua' },
  verde: { name: 'Verde', colour: '#4fbf7a', cancels: undefined },
  naranja: { name: 'Naranja', colour: '#ff8f3f', cancels: 'fuego' },
  rojo: { name: 'Roja', colour: '#e8503a', cancels: 'fuego' },
  oro: { name: 'Oro', colour: '#ffd84f', cancels: 'electrico' },
} as const satisfies Record<string, { name: string; colour: string; cancels: 'fuego' | 'agua' | 'electrico' | undefined }>;
export type LightId = keyof typeof LIGHTS;
export const LIGHT_IDS = Object.keys(LIGHTS) as LightId[];
/** The element each light cancels, if any. */
export const cancels = (light: LightId) => LIGHTS[light].cancels;

/** One light of a walk and how long it stays, in seconds of fight. */
export interface Step { light: LightId; seconds: number }
/**
 * The sun's walks, in seconds of fight: about a round each light (a round runs 6–10 s), so a light
 * changes as the party plans, and the clock on their plates says what comes next. Each side of the
 * basilica walks through its own windows (docs/quests/luca.md § Review B): the nave and the crossing
 * see every colour; the Nativity arm its cold glass, until the sun comes in orange (the first fire
 * eaten, partway through the first fight, as a surprise); the Passion arm its warm glass, fire
 * eaten for a long stretch, then a green breath and a cold glimpse from the rose window; the apse its gold.
 */
export const WALKS = {
  nave: [{ light: 'azul', seconds: 8 }, { light: 'verde', seconds: 6 }, { light: 'naranja', seconds: 7 }, { light: 'rojo', seconds: 7 }, { light: 'oro', seconds: 7 }],
  nacimiento: [{ light: 'azul', seconds: 8 }, { light: 'verde', seconds: 6 }, { light: 'naranja', seconds: 7 }],
  pasion: [{ light: 'naranja', seconds: 6 }, { light: 'rojo', seconds: 6 }, { light: 'verde', seconds: 6 }, { light: 'oro', seconds: 6 }, { light: 'azul', seconds: 5 }],
  abside: [{ light: 'oro', seconds: 8 }, { light: 'naranja', seconds: 6 }, { light: 'oro', seconds: 7 }, { light: 'verde', seconds: 5 }],
} as const satisfies Record<string, readonly Step[]>;
export type WalkId = keyof typeof WALKS;
/** The nave's walk, every colour: the one a fight without a side of its own walks. */
export const CYCLE: readonly Step[] = WALKS.nave;
export const walkLength = (walk: WalkId = 'nave') => WALKS[walk].reduce((sum, step) => sum + step.seconds, 0);
export const CYCLE_LENGTH = walkLength('nave');

export interface LightMoment {
  light: LightId; index: number; loop: number;
  /** Seconds left of this light, and how far through it, 0 to 1. */
  left: number; k: number;
}
/** What light is on `t` seconds into the walk. */
export function lightAt(t: number, walk: WalkId = 'nave'): LightMoment {
  const steps: readonly Step[] = WALKS[walk], length = walkLength(walk);
  const time = Math.max(0, t), loop = Math.floor(time / length);
  let at = time - loop * length;
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (at < step.seconds || index === steps.length - 1) return { light: step.light, index, loop, left: Math.max(0, step.seconds - at), k: Math.min(1, at / step.seconds) };
    at -= step.seconds;
  }
  throw new Error('The walk needs a light');
}
/** The lights after the one on at `t`, in order, `count` of them. */
export function upcoming(t: number, count = 2, walk: WalkId = 'nave'): LightId[] {
  const steps: readonly Step[] = WALKS[walk], { index } = lightAt(t, walk);
  return Array.from({ length: count }, (_, i) => steps[(index + 1 + i) % steps.length].light);
}
/** The lights that came on after `from` and up to `to`, in order. */
export function changes(from: number, to: number, walk: WalkId = 'nave'): LightId[] {
  const out: LightId[] = [], steps: readonly Step[] = WALKS[walk], length = walkLength(walk);
  if (!(to > from)) return out;
  for (let loop = Math.max(0, Math.floor(from / length)); loop * length <= to; loop++) {
    let start = loop * length;
    for (const step of steps) {
      if (start > from && start <= to) out.push(step.light);
      start += step.seconds;
    }
  }
  return out;
}
/** Seconds from `t` until the next light that does not cancel `element` (0 if the one on now does not). */
export function untilFree(t: number, element: string, walk: WalkId = 'nave'): number {
  const steps: readonly Step[] = WALKS[walk], now = lightAt(t, walk);
  if (cancels(now.light) !== element) return 0;
  let wait = now.left;
  for (let step = 1; step < steps.length; step++) {
    const next = steps[(now.index + step) % steps.length];
    if (cancels(next.light) !== element) return wait;
    wait += next.seconds;
  }
  return wait;
}
