/**
 * Emilie's model (docs/quests/emilie.md § In the section): the dungeon's own rules, pure. A vertical
 * cross-section of the ground under Poble Sec, three zones one under the other and the bottom, where
 * El que no converge waits. The party walks along a zone; positions are metres along it (`x`).
 *
 * One verb, *Medir*: driving a piezometer at one of Emilie's survey stakes makes the ground round it
 * real. The model's foes live in what is still a guess: they patrol their zone in sight, go for the
 * party when they see it, and cannot enter measured ground. Inside a borehole the party is out of the
 * model and they pass by; and a borehole is the only way down through the clay. There are fewer
 * piezometers than stakes, so where to measure is each zone's decision, and every piezometer placed
 * beyond the one a zone needs to go down takes a mark of Error off the boss (`calibration`).
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
 * one. Measured ground reaches `safe` metres each side of a borehole. A patrol walks at `walk` and,
 * seeing the party within `sight` metres, comes at `chase`; it reaches them at `touch`. One that the
 * party got away from (a fight run from) stands still for `rest` seconds. The party starts with
 * `piezometers` and finds as many again on landing in each zone below.
 */
export const SECTION = { length: 36, landing: 4, safe: 3.2, sight: 8, walk: 1.5, chase: 2.7, touch: .9, rest: 5, piezometers: 2 };
/** Emilie's survey stakes: three in each zone, never one right under another, so each way down lands somewhere new. */
export const STAKES: readonly Stake[] = [
  { id: 'suelo-1', zone: 'suelo', x: 7 }, { id: 'suelo-2', zone: 'suelo', x: 19 }, { id: 'suelo-3', zone: 'suelo', x: 31 },
  { id: 'gravas-1', zone: 'gravas', x: 3 }, { id: 'gravas-2', zone: 'gravas', x: 13 }, { id: 'gravas-3', zone: 'gravas', x: 25 },
  { id: 'ciudad-1', zone: 'ciudad', x: 8 }, { id: 'ciudad-2', zone: 'ciudad', x: 19 }, { id: 'ciudad-3', zone: 'ciudad', x: 31 },
];
/** What roams each zone: its fight, the stretch it walks, and where and which way it starts. The first one is already coming when the party lands. */
export const PATROLS: readonly PatrolSpec[] = [
  { id: 'celdas-1', zone: 'suelo', encounter: 'modelo-celdas', from: 2, to: 22, start: 16, dir: -1 },
  { id: 'celdas-2', zone: 'suelo', encounter: 'modelo-celdas', from: 16, to: 34, start: 30, dir: 1 },
  { id: 'oscilacion-1', zone: 'gravas', encounter: 'modelo-oscilacion', from: 2, to: 20, start: 12, dir: 1 },
  { id: 'oscilacion-2', zone: 'gravas', encounter: 'modelo-oscilacion', from: 15, to: 34, start: 24, dir: -1 },
  { id: 'pluma-1', zone: 'ciudad', encounter: 'modelo-pluma', from: 2, to: 18, start: 6, dir: 1 },
  { id: 'pluma-2', zone: 'ciudad', encounter: 'modelo-pluma', from: 14, to: 34, start: 28, dir: -1 },
];
export interface Patrol { x: number; dir: -1 | 1; chasing?: boolean; rest?: number }
export interface ModeloState {
  zone: ZoneId;
  /** Piezometers in hand. */
  piezometers: number;
  /** Stakes measured, in the order they were (each one a borehole). */
  placed: string[];
  /** The borehole the party is inside, if it is: out of the model, unseen. */
  inside?: string;
  /** Patrols beaten: gone for good. */
  beaten: string[];
  /** Where each patrol still roaming is. */
  patrols: Record<string, Patrol>;
  /** El que no converge has fallen. */
  won?: boolean;
}
export function createModelo(): ModeloState {
  return { zone: 'suelo', piezometers: SECTION.piezometers, placed: [], beaten: [], patrols: Object.fromEntries(PATROLS.map(p => [p.id, { x: p.start, dir: p.dir }])) };
}
export const stakeOf = (id: string) => STAKES.find(s => s.id === id);
export const stakesIn = (zone: ZoneId) => STAKES.filter(s => s.zone === zone);
/** The boreholes of `zone`: its stakes already measured. */
export const boreholes = (state: ModeloState, zone: ZoneId = state.zone) => stakesIn(zone).filter(s => state.placed.includes(s.id));
/** Whether `x` in `zone` is measured ground: real, and no foe of the model can stand on it. */
export const measured = (state: ModeloState, zone: ZoneId, x: number) => boreholes(state, zone).some(s => Math.abs(s.x - x) <= SECTION.safe);
/** The zone under `zone`, if there is one. */
export const below = (zone: ZoneId): ZoneId | undefined => ZONE_IDS[ZONE_IDS.indexOf(zone) + 1];
/** The stake of the party's zone within reach of `x`, if any. */
export const stakeAt = (state: ModeloState, x: number, reach = 1.2) => stakesIn(state.zone).find(s => Math.abs(s.x - x) <= reach);
/** What can be done at a stake now: measure it, or (measured) go into its borehole; nothing if there is no piezometer left for it. */
export function stakeAction(state: ModeloState, id: string): 'medir' | 'entrar' | undefined {
  const stake = stakeOf(id);
  if (!stake || stake.zone !== state.zone || state.inside) return;
  return state.placed.includes(id) ? 'entrar' : state.piezometers > 0 ? 'medir' : undefined;
}
/**
 * Medir: a piezometer driven at `id`. The ground round it is real from now on: any patrol standing
 * there is put at its edge, on the side it was. Returns whether it could be.
 */
export function measure(state: ModeloState, id: string): boolean {
  if (stakeAction(state, id) !== 'medir') return false;
  const stake = stakeOf(id)!;
  state.piezometers--; state.placed.push(id);
  for (const spec of PATROLS) {
    const patrol = state.patrols[spec.id];
    if (!patrol || spec.zone !== stake.zone || Math.abs(patrol.x - stake.x) > SECTION.safe) continue;
    const side = patrol.x >= stake.x ? 1 : -1;
    patrol.x = stake.x + side * (SECTION.safe + .01); patrol.dir = side; delete patrol.chasing;
  }
  return true;
}
/** Into the borehole at `id`: out of the model. */
export function enter(state: ModeloState, id: string): boolean {
  if (stakeAction(state, id) !== 'entrar') return false;
  state.inside = id;
  return true;
}
/** Back out of the borehole, where it stands. Returns its `x`. */
export function leave(state: ModeloState): number | undefined {
  const stake = state.inside ? stakeOf(state.inside) : undefined;
  delete state.inside;
  return stake?.x;
}
/**
 * Down the borehole the party is in, through the clay, to the zone below: out at the same `x`, with
 * the piezometers left there. Returns where it lands, or nothing if it is not in a borehole.
 */
export function descend(state: ModeloState): { zone: ZoneId; x: number } | undefined {
  const stake = state.inside ? stakeOf(state.inside) : undefined, next = stake && below(stake.zone);
  if (!stake || !next) return;
  delete state.inside;
  state.zone = next;
  if (next !== 'fondo') state.piezometers += SECTION.piezometers;
  return { zone: next, x: stake.x };
}
/**
 * How well the model is calibrated when the party reaches the bottom: the piezometers placed beyond
 * the one each zone needs to go down. Each takes a mark of Error off El que no converge (`calibrate`
 * in src/battle.ts keeps its last one).
 */
export function calibration(state: ModeloState) {
  return (['suelo', 'gravas', 'ciudad'] as const).reduce((sum, zone) => sum + Math.max(0, boreholes(state, zone).length - 1), 0);
}
/** Whether the party at `x` can be seen by the patrol: in its zone, outside any borehole and off measured ground, within sight. */
function sees(state: ModeloState, spec: PatrolSpec, patrol: Patrol, x: number) {
  return spec.zone === state.zone && !state.inside && !measured(state, state.zone, x) && Math.abs(patrol.x - x) <= SECTION.sight;
}
/** How far a patrol at `x` going `dir` can get before measured ground or the end of its stretch (while chasing, the whole zone is its stretch). */
function limit(state: ModeloState, spec: PatrolSpec, x: number, dir: -1 | 1, chasing: boolean) {
  let end = chasing ? (dir > 0 ? SECTION.length - 1 : 1) : dir > 0 ? spec.to : spec.from;
  for (const s of boreholes(state, spec.zone)) {
    const edge = s.x - dir * SECTION.safe;
    if (dir > 0 ? edge >= x - 1e-6 && edge < end : edge <= x + 1e-6 && edge > end) end = edge;
  }
  return end;
}
/**
 * `seconds` pass in the section with the party at `x` in its zone. Every patrol walks its stretch and
 * turns at its ends and at the edge of measured ground; one that sees the party comes for it. Returns
 * the patrol that reached the party, if one did: its fight starts.
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
    const speed = seen ? SECTION.chase : SECTION.walk, end = limit(state, spec, patrol.x, patrol.dir, seen);
    const step = speed * seconds, left = (end - patrol.x) * patrol.dir;
    // While it chases it never overshoots the party; walking, it turns where its way ends.
    if (seen) patrol.x += patrol.dir * Math.max(0, Math.min(step, left, Math.abs(x - patrol.x)));
    else if (step >= left) { patrol.x = end; patrol.dir = -patrol.dir as -1 | 1; }
    else patrol.x += patrol.dir * step;
    if (seen && !reached && Math.abs(patrol.x - x) <= SECTION.touch) reached = spec;
  }
  return reached;
}
/** A patrol's fight was won: it is gone. */
export function beat(state: ModeloState, id: string) {
  if (!state.beaten.includes(id)) state.beaten.push(id);
  delete state.patrols[id];
}
/** A patrol's fight was run from: it stands still a while, so the party can get to measured ground. */
export function shake(state: ModeloState, id: string) {
  const patrol = state.patrols[id];
  if (patrol) { patrol.rest = SECTION.rest; delete patrol.chasing; }
}
/** The patrols roaming `zone`, for whoever draws them. */
export const roaming = (state: ModeloState, zone: ZoneId = state.zone) => PATROLS.filter(p => p.zone === zone && state.patrols[p.id]).map(p => ({ ...p, ...state.patrols[p.id] }));
