/**
 * Emilie's model (docs/quests/emilie.md § In the section): the dungeon's own rules, pure. A vertical
 * cross-section of the ground under Poble Sec, three zones one under the other and the bottom, where
 * El que no converge waits. The party walks along a zone; positions are metres along it (`x`).
 *
 * Each zone ends in a well (`WELLS`), a shaft through the clay with a lift in it, at the far end from
 * where the party came in: the wells alternate sides, so every zone is crossed. The lift has no power
 * of its own: the model's foes are what runs in it, and it only goes down once at least one of the
 * zone's patrols has been beaten (`charged`). Patrols walk their stretch in sight and go for the party
 * when they see it; nowhere is safe from them. Emilie's survey stakes are on the way, one a zone:
 * measuring one (*Medir*) makes the ground round it real and takes a mark of Error off the boss
 * (`calibration`), for whoever stops to do it with patrols about.
 */
import type { ModeloEncounter } from './battle.ts';

export const ZONE_IDS = ['suelo', 'gravas', 'ciudad', 'fondo'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];
/** The zones as the game names them where it has to (a line of Emilie's, the picker). */
export const ZONE_NAMES: Record<ZoneId, string> = { suelo: 'El suelo', gravas: 'Las gravas', ciudad: 'Bajo la ciudad', fondo: 'El fondo' };
export interface Stake { id: string; zone: ZoneId; x: number }
export interface PatrolSpec { id: string; zone: ZoneId; encounter: ModeloEncounter; from: number; to: number; start: number; dir: -1 | 1 }
/**
 * The section, tunable. A zone is `length` metres long and the party lands at `landing` in the first
 * one. A patrol walks at `walk` and, seeing the party within `sight` metres, comes at `chase`; it
 * reaches them at `touch`. One that the party got away from (a fight run from) stands still for `rest`
 * seconds. The well's lift is used within `reach` of it.
 */
export const SECTION = { length: 36, landing: 4, sight: 8, walk: 1.5, chase: 2.7, touch: .9, rest: 5, reach: 1.2 };
/** Where each zone's well is: at the far end from where the party came in, so the sides alternate. */
export const WELLS: Record<Exclude<ZoneId, 'fondo'>, number> = { suelo: 34, gravas: 3, ciudad: 34 };
/** Emilie's survey stakes: one a zone, on the way across, never where a lift comes down. */
export const STAKES: readonly Stake[] = [
  { id: 'suelo-1', zone: 'suelo', x: 24 }, { id: 'gravas-1', zone: 'gravas', x: 12 }, { id: 'ciudad-1', zone: 'ciudad', x: 25 },
];
/**
 * What roams each zone: its fight, the stretch it walks, and where and which way it starts. Two to a
 * zone, between where the party comes in and the well; the first one is already coming when they land.
 */
export const PATROLS: readonly PatrolSpec[] = [
  { id: 'celdas-1', zone: 'suelo', encounter: 'modelo-celdas', from: 6, to: 22, start: 16, dir: -1 },
  { id: 'celdas-2', zone: 'suelo', encounter: 'modelo-celdas', from: 18, to: 33, start: 28, dir: 1 },
  { id: 'oscilacion-1', zone: 'gravas', encounter: 'modelo-oscilacion', from: 14, to: 31, start: 22, dir: -1 },
  { id: 'oscilacion-2', zone: 'gravas', encounter: 'modelo-oscilacion', from: 4, to: 18, start: 9, dir: 1 },
  { id: 'atomo-1', zone: 'ciudad', encounter: 'modelo-atomo', from: 6, to: 20, start: 14, dir: 1 },
  { id: 'atomo-2', zone: 'ciudad', encounter: 'modelo-atomo', from: 16, to: 33, start: 26, dir: -1 },
];
export interface Patrol { x: number; dir: -1 | 1; chasing?: boolean; rest?: number }
export interface ModeloState {
  zone: ZoneId;
  /** Stakes measured, in the order they were. */
  placed: string[];
  /** Patrols beaten: gone for good, and their power in their zone's lift. */
  beaten: string[];
  /** Where each patrol still roaming is. */
  patrols: Record<string, Patrol>;
  /** El que no converge has fallen. */
  won?: boolean;
}
export function createModelo(): ModeloState {
  return { zone: 'suelo', placed: [], beaten: [], patrols: Object.fromEntries(PATROLS.map(p => [p.id, { x: p.start, dir: p.dir }])) };
}
export const stakeOf = (id: string) => STAKES.find(s => s.id === id);
export const stakesIn = (zone: ZoneId) => STAKES.filter(s => s.zone === zone);
/** The zone under `zone`, if there is one; and the one over it. */
export const below = (zone: ZoneId): ZoneId | undefined => ZONE_IDS[ZONE_IDS.indexOf(zone) + 1];
export const above = (zone: ZoneId): ZoneId | undefined => ZONE_IDS[ZONE_IDS.indexOf(zone) - 1];
/** Where the party is when it comes into `zone`: where it landed, or under the well it came down. */
export const arrival = (zone: ZoneId) => { const up = above(zone); return up ? WELLS[up as keyof typeof WELLS] : SECTION.landing; };
/** The stake of the party's zone within reach of `x`, if any. */
export const stakeAt = (state: ModeloState, x: number, reach = 1.2) => stakesIn(state.zone).find(s => Math.abs(s.x - x) <= reach);
/** The patrols of `zone`, and how many of them are beaten: the power in its lift. */
export const patrolsIn = (zone: ZoneId) => PATROLS.filter(p => p.zone === zone);
export const energy = (state: ModeloState, zone: ZoneId = state.zone) => patrolsIn(zone).filter(p => state.beaten.includes(p.id)).length;
/** Whether the lift of the party's zone can go down: one of its patrols beaten is enough. */
export const charged = (state: ModeloState, zone: ZoneId = state.zone) => energy(state, zone) > 0;
/** Medir: Emilie's stake at `id` measured; the ground round it is real from now on. Returns whether it could be. */
export function measure(state: ModeloState, id: string): boolean {
  const stake = stakeOf(id);
  if (!stake || stake.zone !== state.zone || state.placed.includes(id)) return false;
  state.placed.push(id);
  return true;
}
/** Whether the party at `x` stands at its zone's well. */
export const atWell = (state: ModeloState, x: number) => state.zone !== 'fondo' && Math.abs(WELLS[state.zone as keyof typeof WELLS] - x) <= SECTION.reach;
/**
 * Down the lift of the party's zone, through the clay, to the zone below: out at the same `x`. Only
 * with power in it. Returns where it lands, or nothing if it cannot go.
 */
export function descend(state: ModeloState): { zone: ZoneId; x: number } | undefined {
  const next = below(state.zone);
  if (!next || !charged(state)) return;
  const x = WELLS[state.zone as keyof typeof WELLS];
  state.zone = next;
  return { zone: next, x };
}
/** How well the model is calibrated when the party reaches the bottom: each stake measured takes a mark of Error off El que no converge (`calibrate` in src/battle.ts keeps its last one). */
export const calibration = (state: ModeloState) => state.placed.length;
/** Whether the party at `x` can be seen by the patrol: in its zone, within sight. */
const sees = (state: ModeloState, spec: PatrolSpec, patrol: Patrol, x: number) => spec.zone === state.zone && Math.abs(patrol.x - x) <= SECTION.sight;
/** How far a patrol going `dir` can get: the end of its stretch (while chasing, the whole zone is its stretch). */
const limit = (spec: PatrolSpec, dir: -1 | 1, chasing: boolean) => chasing ? (dir > 0 ? SECTION.length - 1 : 1) : dir > 0 ? spec.to : spec.from;
/**
 * `seconds` pass in the section with the party at `x` in its zone. Every patrol walks its stretch and
 * turns at its ends; one that sees the party comes for it. Returns the patrol that reached the party,
 * if one did: its fight starts.
 */
export function tick(state: ModeloState, seconds: number, x: number): PatrolSpec | undefined {
  if (!(seconds > 0)) return;
  let reached: PatrolSpec | undefined;
  for (const spec of PATROLS) {
    const patrol = state.patrols[spec.id];
    if (!patrol) continue;
    if (patrol.rest) { patrol.rest = Math.max(0, patrol.rest - seconds); if (!patrol.rest) delete patrol.rest; delete patrol.chasing; continue; }
    const seen = sees(state, spec, patrol, x);
    if (seen) { patrol.chasing = true; if (Math.abs(x - patrol.x) > 1e-6) patrol.dir = x > patrol.x ? 1 : -1; } else delete patrol.chasing;
    const speed = seen ? SECTION.chase : SECTION.walk, end = limit(spec, patrol.dir, seen);
    const step = speed * seconds, left = (end - patrol.x) * patrol.dir;
    // While it chases it never overshoots the party; walking, it turns where its way ends.
    if (seen) patrol.x += patrol.dir * Math.max(0, Math.min(step, left, Math.abs(x - patrol.x)));
    else if (step >= left) { patrol.x = end; patrol.dir = -patrol.dir as -1 | 1; }
    else patrol.x += patrol.dir * step;
    if (seen && !reached && Math.abs(patrol.x - x) <= SECTION.touch) reached = spec;
  }
  return reached;
}
/** A patrol's fight was won: it is gone, and its power is in its zone's lift. */
export function beat(state: ModeloState, id: string) {
  if (!state.beaten.includes(id)) state.beaten.push(id);
  delete state.patrols[id];
}
/** A patrol's fight was run from: it stands still a while. */
export function shake(state: ModeloState, id: string) {
  const patrol = state.patrols[id];
  if (patrol) { patrol.rest = SECTION.rest; delete patrol.chasing; }
}
/** The patrols roaming `zone`, for whoever draws them. */
export const roaming = (state: ModeloState, zone: ZoneId = state.zone) => PATROLS.filter(p => p.zone === zone && state.patrols[p.id]).map(p => ({ ...p, ...state.patrols[p.id] }));
/**
 * The section as a place to walk (src/environments.ts `MODELO`, src/modelo-scene.ts): seen from the
 * side, one gallery `depth` cells deep and `length` long. The party never changes cells to go down:
 * the section itself rises past them, a gallery every `drop` metres, each `height` tall under the clay.
 * A metre along a zone is a cell of the grid. El que no converge stands at `boss` in the bottom one, half
 * the gallery away from the lift that brings the party down, and its fight starts within `bossReach` of it.
 */
export const GALLERY = { depth: 3, row: 2, drop: 5, height: 3.2, boss: 18, bossReach: 3.5 };
/** The gallery's grid: a wall behind, the way, a wall before, closed at both ends. */
export const MODELO_GRID: string[] = [
  '#'.repeat(SECTION.length + 2),
  ...Array.from({ length: GALLERY.depth }, () => `#${'.'.repeat(SECTION.length)}#`),
  '#'.repeat(SECTION.length + 2),
];
/** The interaction of a stake (`estaca-<stake id>`), and the stake of an interaction. */
export const stakeInteraction = (id: string) => `estaca-${id}`;
export const interactionStake = (id: string) => id.startsWith('estaca-') ? stakeOf(id.slice('estaca-'.length)) : undefined;
/** The interaction of a zone's well (`pozo-<zone>`), and the zone of an interaction. */
export const wellInteraction = (zone: ZoneId) => `pozo-${zone}`;
export const interactionWell = (id: string) => id.startsWith('pozo-') ? id.slice('pozo-'.length) as ZoneId : undefined;
/** What the party can do at the stake they stand by: «Medir» it, if it is of their zone and still a guess. */
export function stakeVerb(state: ModeloState, id: string): 'Medir' | undefined {
  const stake = stakeOf(id);
  return stake && stake.zone === state.zone && !state.placed.includes(id) ? 'Medir' : undefined;
}
