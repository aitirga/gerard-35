/**
 * Days in Barcelona (docs/chapter-2.md § The Queen's advance): an unspoken countdown. Each day runs
 * from 08:00 into the night (the clock stops at 22:00) and what the party does spends hours (a trip, a fight, a piano piece). Every
 * morning La Reina Bubbaloo's power has spread a little further; each friend's ánima, and each boss
 * of her castle beaten, pushes it back. If it reaches the end, Gerard wakes up in a flat that is already part of her castle, and
 * the only way on is back to the morning before. Nothing on screen counts: the light, the TV,
 * Aitor and the castle tell it. Pure: no DOM, no engine.
 */
/** When a day starts and when it is over (hours). */
export const DAY_START = 8, DAY_END = 22;
/** When Aitor notices the evening, and when he wants to go home. */
export const EVENING = 18, LATE = 20;
/**
 * When night has fallen (docs/chapter-2.md § Night and the way home): a friend's mission won or a
 * milestone in her palace brings it at once; otherwise the clock gets there. At night the day no
 * longer ends wherever they are: it ends when they get home, or fall.
 */
export const NIGHT = 21;
export const isNight = (hour: number) => hour >= NIGHT;
/**
 * An afternoon spent (docs/chapter-2.md § Spending the afternoon; decided with Aitor 2026-11-20): on
 * the bed, on the sofa, cooking, at the gym or rehearsing with the choir. Each brings the night at
 * once, so the Meridiana can be played after dark; and each but the bed leaves the party a little
 * something (`name`, `stats`; `effect` says it as a skill's description would) for that night and
 * the day after, one at a time: the last one spent. `label` is what the prompt offers, `place` where.
 */
export const EVENINGS = {
  cama: { label: 'Echarse un rato', place: 'home' },
  sofa: { label: 'Sentarse en el sofá', place: 'home', name: 'Tranquilos', stats: { espiritu: 2 }, effect: 'Sube un poco Espíritu de todo el equipo.' },
  cocina: { label: 'Cocinar', place: 'home', name: 'Bien cenados', stats: { critico: 10 }, effect: 'Sube un poco Crítico de todo el equipo.' },
  gimnasio: { label: 'Entrenar', place: 'street', name: 'En forma', stats: { fuerza: 2 }, effect: 'Sube un poco Fuerza de todo el equipo.' },
  coro: { label: 'Ensayar', place: 'street', name: 'Afinados', stats: { magia: 2 }, effect: 'Sube un poco Magia de todo el equipo.' },
} as const satisfies Record<string, { label: string; place: 'home' | 'street'; name?: string; stats?: Partial<Record<Stat, number>>; effect?: string }>;
type Stat = 'fuerza' | 'magia' | 'defensa' | 'espiritu' | 'critico';
export type EveningId = keyof typeof EVENINGS;
/** The afternoons that leave something. */
export type BoostId = { [K in EveningId]: (typeof EVENINGS)[K] extends { name: string } ? K : never }[EveningId];
export const isBoost = (id: unknown): id is BoostId => typeof id === 'string' && id in EVENINGS && 'name' in EVENINGS[id as EveningId];
/** What an afternoon left, and the last day it lasts (the day after it was spent). */
export interface Boost { id: BoostId; until: number }
/** What an afternoon leaves as it reads in a fight: its name and its points (`En forma`, Fuerza +2). */
export const boostOf = (id: BoostId): { name: string; stats: Partial<Record<Stat, number>>; effect: string } => EVENINGS[id];
/** When they wake after being beaten on the way home at night: the morning is gone. */
export const WOKE_LATE = 11;
/** Hours each kind of thing takes. */
/**
 * `castle`: a fight inside the castle, or a rest in its staff room (docs/castle.md § To settle: one hour, proposed).
 * `tren`: the long-distance train between Barcelona and Alegia, either way (proposed: three hours).
 */
export const COSTS = { metro: 1, fight: 2, piano: 2, cafe: 1, castle: 1, tren: 3 } as const;
export type Activity = keyof typeof COSTS;
/** Days without any help before the Queen covers everything, and how many days each ánima (or castle boss beaten) wins back. */
export const GRACE_DAYS = 6, DAYS_PER_ANIMA = 3;

export interface Clock { day: number; hour: number }
/** A morning's saved story, to come back to. */
export interface Morning { day: number; story: string[] }
/**
 * Saved with the story. `epoch` grows with each rewind, so the server knows a rewind may take
 * flags away (any other save only adds them). `mornings` keeps the last two mornings. `boost`: what
 * the last afternoon spent left (`EVENINGS`).
 */
export interface Days { epoch: number; clock: Clock; mornings: Morning[]; boost?: Boost }
export const freshDays = (): Days => ({ epoch: 0, clock: { day: 1, hour: DAY_START }, mornings: [] });

/**
 * How far her power has spread on `day` with `animas` gathered: 0 the first morning, 1 the end.
 */
export function spread(day: number, animas: number) {
  return Math.max(0, day - 1 - DAYS_PER_ANIMA * animas) / GRACE_DAYS;
}
/** The same, as a stage for lines and headlines: 0 (it has just appeared) to 4 (the last day). */
export function stage(value: number) { return Math.max(0, Math.min(4, Math.floor(value * 5))); }
/**
 * The first day her castle is at `wanted` stage with `animas` gathered (development: the picker's
 * way home at night chooses the castle's stage, and the day follows).
 */
export function dayForStage(wanted: number, animas: number) {
  const target = Math.max(0, Math.min(4, Math.round(wanted)));
  let day = 1;
  while (stage(spread(day, animas)) < target) day++;
  return day;
}
/** How far into the evening it is: 0 until EVENING, 1 at DAY_END. */
export function dusk(hour: number) { return Math.max(0, Math.min(1, (hour - EVENING) / (DAY_END - EVENING))); }

/** A well-formed Days from saved data, or undefined. */
export function readDays(value: unknown): Days | undefined {
  const d = value as Days;
  const int = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  if (!d || typeof d !== 'object' || !int(d.epoch, 0, 1e6) || !d.clock || !int(d.clock.day, 1, 999) || !int(d.clock.hour, 0, 24) || !Array.isArray(d.mornings)) return undefined;
  const mornings = d.mornings.filter(m => m && int(m.day, 1, 999) && Array.isArray(m.story) && m.story.every(f => typeof f === 'string')).slice(-2);
  const boost = d.boost && isBoost(d.boost.id) && int(d.boost.until, 1, 999) ? { boost: { id: d.boost.id, until: d.boost.until } } : {};
  return { epoch: d.epoch, clock: { day: d.clock.day, hour: d.clock.hour }, mornings: mornings.map(m => ({ day: m.day, story: [...m.story] })), ...boost };
}
