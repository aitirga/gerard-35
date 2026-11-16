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

/**
 * The sun's walk, in seconds of fight: about a round each (a round runs 6–10 s), so a light changes
 * as the party plans, and the clock on their plates says what comes next. A fight starts at the
 * cold morning: the first fire cancelled comes partway through the first fight, as a surprise.
 */
export const CYCLE: readonly { light: LightId; seconds: number }[] = [
  { light: 'azul', seconds: 8 },
  { light: 'verde', seconds: 6 },
  { light: 'naranja', seconds: 7 },
  { light: 'rojo', seconds: 7 },
  { light: 'oro', seconds: 7 },
];
export const CYCLE_LENGTH = CYCLE.reduce((sum, step) => sum + step.seconds, 0);

export interface LightMoment {
  light: LightId; index: number; loop: number;
  /** Seconds left of this light, and how far through it, 0 to 1. */
  left: number; k: number;
}
/** What light is on `t` seconds into the walk. */
export function lightAt(t: number): LightMoment {
  const time = Math.max(0, t), loop = Math.floor(time / CYCLE_LENGTH);
  let at = time - loop * CYCLE_LENGTH;
  for (let index = 0; index < CYCLE.length; index++) {
    const step = CYCLE[index];
    if (at < step.seconds || index === CYCLE.length - 1) return { light: step.light, index, loop, left: Math.max(0, step.seconds - at), k: Math.min(1, at / step.seconds) };
    at -= step.seconds;
  }
  throw new Error('The walk needs a light');
}
/** The lights after the one on at `t`, in order, `count` of them. */
export function upcoming(t: number, count = 2): LightId[] {
  const { index } = lightAt(t);
  return Array.from({ length: count }, (_, i) => CYCLE[(index + 1 + i) % CYCLE.length].light);
}
/** The lights that came on after `from` and up to `to`, in order. */
export function changes(from: number, to: number): LightId[] {
  const out: LightId[] = [];
  if (!(to > from)) return out;
  for (let loop = Math.max(0, Math.floor(from / CYCLE_LENGTH)); loop * CYCLE_LENGTH <= to; loop++) {
    let start = loop * CYCLE_LENGTH;
    for (const step of CYCLE) {
      if (start > from && start <= to) out.push(step.light);
      start += step.seconds;
    }
  }
  return out;
}
/** Seconds from `t` until the next light that does not cancel `element` (0 if the one on now does not). */
export function untilFree(t: number, element: string): number {
  const now = lightAt(t);
  if (cancels(now.light) !== element) return 0;
  let wait = now.left;
  for (let step = 1; step < CYCLE.length; step++) {
    const next = CYCLE[(now.index + step) % CYCLE.length];
    if (cancels(next.light) !== element) return wait;
    wait += next.seconds;
  }
  return wait;
}
