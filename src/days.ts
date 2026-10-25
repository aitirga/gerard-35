/**
 * Days in Barcelona (docs/chapter-2.md § The Queen's advance): an unspoken countdown. Each day runs
 * from 08:00 to 22:00 and what the party does spends hours (a trip, a fight, a piano piece). Every
 * morning La Reina Bubbaloo's power has spread a little further; each friend's ánima pushes it
 * back. If it reaches the end, Gerard wakes up in a flat that is already part of her castle, and
 * the only way on is back to the morning before. Nothing on screen counts: the light, the TV,
 * Aitor and the castle tell it. Pure: no DOM, no engine.
 */
/** When a day starts and when it is over (hours). */
export const DAY_START = 8, DAY_END = 22;
/** When Aitor notices the evening, and when he wants to go home. */
export const EVENING = 18, LATE = 20;
/** Hours each kind of thing takes. */
export const COSTS = { metro: 1, fight: 2, piano: 2, cafe: 1 } as const;
export type Activity = keyof typeof COSTS;
/** Days without any help before the Queen covers everything, and how many days each ánima wins back. */
export const GRACE_DAYS = 6, DAYS_PER_ANIMA = 3;

export interface Clock { day: number; hour: number }
/** A morning's saved story, to come back to. */
export interface Morning { day: number; story: string[] }
/**
 * Saved with the story. `epoch` grows with each rewind, so the server knows a rewind may take
 * flags away (any other save only adds them). `mornings` keeps the last two mornings.
 */
export interface Days { epoch: number; clock: Clock; mornings: Morning[] }
export const freshDays = (): Days => ({ epoch: 0, clock: { day: 1, hour: DAY_START }, mornings: [] });

/**
 * How far her power has spread on `day` with `animas` gathered and `lights` used (each light let
 * out of the jar at home wins back one day): 0 the first morning, 1 the end.
 */
export function spread(day: number, animas: number, lights = 0) {
  return Math.max(0, day - 1 - DAYS_PER_ANIMA * animas - lights) / GRACE_DAYS;
}
/** The same, as a stage for lines and headlines: 0 (it has just appeared) to 4 (the last day). */
export function stage(value: number) { return Math.max(0, Math.min(4, Math.floor(value * 5))); }
/** How far into the evening it is: 0 until EVENING, 1 at DAY_END. */
export function dusk(hour: number) { return Math.max(0, Math.min(1, (hour - EVENING) / (DAY_END - EVENING))); }

/** A well-formed Days from saved data, or undefined. */
export function readDays(value: unknown): Days | undefined {
  const d = value as Days;
  const int = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  if (!d || typeof d !== 'object' || !int(d.epoch, 0, 1e6) || !d.clock || !int(d.clock.day, 1, 999) || !int(d.clock.hour, 0, 24) || !Array.isArray(d.mornings)) return undefined;
  const mornings = d.mornings.filter(m => m && int(m.day, 1, 999) && Array.isArray(m.story) && m.story.every(f => typeof f === 'string')).slice(-2);
  return { epoch: d.epoch, clock: { day: d.clock.day, hour: d.clock.hour }, mornings: mornings.map(m => ({ day: m.day, story: [...m.story] })) };
}
