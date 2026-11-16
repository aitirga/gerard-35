/**
 * The mirrors in the nave of Fran's salon (docs/quests/luca.md § Review C): a window's light comes
 * down an aisle, and each mirror it meets sends it a quarter turn to one side, as it stands. Pure:
 * where the beam goes over the plan, cell by cell, and whether it reaches what it is for.
 *
 * A mirror is `\` (0) or `/` (1), seen from above with +z towards the camera. Going south (+z), `\`
 * sends the light east (+x) and `/` west; going east, `\` sends it south and `/` north.
 */
import type { Cell } from './movement';

export type Facing = 0 | 1;
export interface Beam { from: Cell; dir: Cell; target: Cell }
export interface BeamPath {
  /** Every cell the light crosses, from the window to where it stops, the mirrors included. */
  path: Cell[];
  /** Whether it reaches the target (and stops there). */
  hit: boolean;
  /** Where the light ends: the target, or the last open cell before what stops it. */
  end: Cell;
  /** The cells where it turns, in order: the mirrors it was sent on by. */
  turns: Cell[];
}
/** The direction the light leaves a mirror facing `facing` in, coming in going `dir`. */
export function reflect(dir: Cell, facing: Facing): Cell {
  return facing === 0 ? { x: dir.z, z: dir.x } : { x: -dir.z, z: -dir.x };
}
/**
 * Follows the light from `beam.from` over `grid` (rows of `.` open, anything else stops it): through
 * open cells, turned at each of `mirrors` as it stands in `facings`, until it reaches the target or
 * something in the way. A mirror's own cell is open to it, whatever the plan says.
 */
export function trace(grid: readonly string[], mirrors: readonly Cell[], facings: readonly Facing[], beam: Beam): BeamPath {
  const at = { ...beam.from }, path: Cell[] = [{ ...at }], turns: Cell[] = [];
  let dir = { ...beam.dir };
  const mirrorAt = (c: Cell) => mirrors.findIndex(m => m.x === c.x && m.z === c.z);
  const open = (c: Cell) => mirrorAt(c) >= 0 || grid[c.z]?.[c.x] === '.';
  for (let steps = 0; steps < 400; steps++) {
    const next = { x: at.x + dir.x, z: at.z + dir.z };
    if (!open(next)) return { path, hit: false, end: { ...at }, turns };
    at.x = next.x; at.z = next.z; path.push({ ...at });
    if (at.x === beam.target.x && at.z === beam.target.z) return { path, hit: true, end: { ...at }, turns };
    const m = mirrorAt(at);
    if (m >= 0) { dir = reflect(dir, facings[m] ?? 0); turns.push({ ...at }); }
  }
  return { path, hit: false, end: { ...at }, turns };
}
/** A mirror turned a quarter: `\` becomes `/` and back. */
export const turned = (facings: readonly Facing[], index: number): Facing[] => facings.map((f, i) => (i === index ? (1 - f) as Facing : f));
