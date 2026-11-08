/**
 * Night in Barcelona and the way home (docs/chapter-2.md § Night and the way home). After a friend's
 * mission is won or a milestone in her palace is reached, night falls outside. Coming back to the
 * Meridiana at night, the palace's own monsters climb out of the vent grates over the trains and
 * hunt the party from the Fabra i Puig station to home's door: the dark between lamps hides, a
 * lamp's light gives them away, stock-still behind the containers or the bus shelter is out of
 * sight, and the warm light of home's portal is where they never step. If one catches the party,
 * it is a fight with the palace's guard at the strength the palace has now: the walk home says, in
 * passing, how ready the party is for her. Pure: no DOM, no engine.
 */
import type { Cell } from './movement.ts';
import type { ChaserSpec } from './chasers.ts';

/**
 * How hard the way home is, from how far her power has spread (`stage` in src/days.ts): more of
 * them, faster, seeing further, and more coming up with each train under the median.
 * Speeds in cells per second (Gerard walks 5.2, runs 7.8); sight in cells.
 */
export interface NightTier {
  id: string;
  /** Monsters waiting when the party comes out onto the avenue, and more with each train that runs under it. */
  hunters: number; perTrain: number;
  /** Walking their round and running at Gerard. */
  walk: number; run: number;
  /** How far they see Gerard in a lamp's light, in the dark, and in the dark once they are after him. */
  sightLit: number; sightDark: number; sightChasing: number;
  /** Seconds between trains under the median while they hunt. */
  trainEvery: number;
  /** Lamps her pink puts out, one in so many (0: none). */
  lampsOut: number;
}
export const NIGHT_TIERS: readonly NightTier[] = [
  { id: 'calma', hunters: 2, perTrain: 0, walk: 1.4, run: 4.4, sightLit: 8, sightDark: 3, sightChasing: 5, trainEvery: 40, lampsOut: 0 },
  { id: 'tensa', hunters: 3, perTrain: 1, walk: 1.6, run: 5.2, sightLit: 9, sightDark: 3, sightChasing: 6, trainEvery: 28, lampsOut: 0 },
  { id: 'dura', hunters: 4, perTrain: 1, walk: 1.8, run: 6.2, sightLit: 10, sightDark: 4, sightChasing: 7, trainEvery: 22, lampsOut: 0 },
  { id: 'ultima', hunters: 5, perTrain: 2, walk: 2, run: 7.2, sightLit: 12, sightDark: 4, sightChasing: 8, trainEvery: 18, lampsOut: 3 },
];
/** The tier for her spread's stage (0–4, src/days.ts `stage`): the first two days are calm. */
export function nightTier(stage: number): NightTier {
  return NIGHT_TIERS[Math.max(0, Math.min(NIGHT_TIERS.length - 1, stage - 1))];
}

/** How far a lamp lights the pavement round it, in cells (1.5 m each). */
export const LAMP_REACH = 4;
/** How far round home's portal its light keeps them off, in cells. */
export const PORTAL_SAFE = 3.5;
/** How close to a shelter, a row of containers or a café terrace Gerard must stand still to be out of sight. */
export const HIDE_REACH = 1.6;
/** What one can stand still behind. */
export const HIDING_KINDS = ['containers', 'shelter', 'terrace'] as const;
/**
 * The closest a monster comes up out of a grate to Gerard, in cells: never in his face; the first
 * ones further off still, so coming out of the station there is a moment to look round. Climbing
 * out takes CLIMB seconds, while it sees nothing.
 */
export const RISE_CLEAR = 9, FIRST_CLEAR = 18, CLIMB = 2.5;

const dist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.z - b.z);

/** The lamps still lit: with `lampsOut`, every so many goes out (the same ones every night). */
export function litLamps(lamps: readonly Cell[], tier: NightTier): Cell[] {
  return tier.lampsOut ? lamps.filter((_, i) => i % tier.lampsOut !== 1) : [...lamps];
}
/** Whether a cell is in some lamp's light. */
export function isLit(cell: Cell, lamps: readonly Cell[]) {
  return lamps.some(l => dist(l, cell) <= LAMP_REACH);
}
/** How far a hunter sees Gerard right now: lit, dark, or dark with it already running after him. */
export function sightOf(tier: NightTier, lit: boolean, chasing: boolean) {
  return lit ? tier.sightLit : chasing ? tier.sightChasing : tier.sightDark;
}
/** Whether Gerard is out of their sight: in the portal's light, or still, in the dark, behind something. */
export function hiddenAt(cell: Cell, still: boolean, lit: boolean, hides: readonly Cell[], portal: Cell) {
  if (dist(cell, portal) <= PORTAL_SAFE) return true;
  return still && !lit && hides.some(h => dist(h, cell) <= HIDE_REACH);
}
/** The hunters' own grid: the portal's light is a wall to them. */
export function huntersGrid(grid: readonly string[], portal: Cell): string[] {
  return grid.map((row, z) => [...row].map((c, x) => dist({ x, z }, portal) <= PORTAL_SAFE ? '#' : c).join(''));
}

/** A hunter's round: a small loop round where it came up, kept on walkable cells. */
export function roundAbout(at: Cell, grid: readonly string[], radius = 4): Cell[] {
  const free = (c: Cell) => grid[c.z]?.[c.x] !== undefined && grid[c.z][c.x] !== '#';
  const loop = [[radius, 0], [0, radius * .6], [-radius, 0], [0, -radius * .6]]
    .map(([dx, dz]) => ({ x: Math.round(at.x + dx), z: Math.round(at.z + dz) }))
    .filter(free);
  return [{ x: Math.round(at.x), z: Math.round(at.z) }, ...loop];
}
/**
 * Where monsters come up: the grates (the median's vents over the trains, the station's under the
 * plaza) farthest along from `from` first, never closer than RISE_CLEAR. Each is used once per
 * `count`; with more wanted than grates, they come round again.
 */
export function risingAt(grates: readonly Cell[], from: Cell, count: number, clear = RISE_CLEAR): Cell[] {
  const away = grates.filter(g => dist(g, from) >= clear);
  const pool = (away.length ? away : [...grates]).sort((a, b) => dist(a, from) - dist(b, from));
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]).filter(Boolean);
}
/** A hunter's spec, its id numbered (`night-1`, `night-2`…). */
export function hunterSpec(n: number, at: Cell, grid: readonly string[], tier: NightTier): ChaserSpec {
  return { id: `night-${n}`, patrol: roundAbout(at, grid), sight: tier.sightDark, walk: tier.walk, run: tier.run };
}

/**
 * What Aitor says when they first see them, by the ánimas the party has gathered: the palace's
 * guards are as strong as those leave them (`palaceGuards` in src/battle.ts), and so are these.
 */
export function sizeUp(animas: number) {
  return animas <= 0 ? 'Son como los del castillo. Ni se te ocurra pararte a pelear.'
    : animas === 1 ? 'Los del castillo… Con lo de Nuria igual podemos. Mejor no probarlo.'
    : 'Esos ya no me dan tanto miedo. Creo que a estos les podemos.';
}
