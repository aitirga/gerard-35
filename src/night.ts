/**
 * Night in Barcelona and the way home (docs/chapter-2.md § Night and the way home). After a friend's
 * mission is won, or an afternoon spent at home, at the gym or at the choir, night falls outside
 * (never after her castle: a boss beaten is a flash back to bed). On the Meridiana at night the
 * castle's pupils climb out of the vent grates over the trains and hunt the party: the dark between
 * lamps hides, a lamp's light gives them away, stock-still behind the containers or the bus shelter
 * is out of sight, and the warm light of home's portal is where they never step. If one catches the
 * party, it is a fight with its group at the strength the castle has now: the street says how ready
 * the party is for her, where a fall costs a morning and not the day. How each pupil hunts is
 * src/night-pupils.ts. Pure: no DOM, no engine.
 */
import type { Cell } from './movement.ts';

/**
 * How hard the way home is, from how far her power has spread (`stage` in src/days.ts): more of
 * them, faster, seeing further, and more coming up with each train under the median.
 * Speeds in cells per second (Gerard walks 5.2, runs 7.8); sight in cells.
 */
export interface NightTier {
  id: string;
  /**
   * The avenue is theirs at night: a group of pupils (a room's group each, a body a pupil) is out
   * already every `every` cells of its length when night comes, on both pavements, the median and
   * the side streets (`postsAlong`). `hunters` more climb out of the grates by the party as it comes
   * out, and `perTrain` with each train that runs under it, up to `hunters` twice over. A place that
   * posts nobody (a floor of the castle, src/castle-pupils.ts) has no `every`.
   */
  every?: number; hunters: number; perTrain: number;
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
  { id: 'calma', every: 12, hunters: 2, perTrain: 0, walk: 1.4, run: 4.4, sightLit: 8, sightDark: 3, sightChasing: 5, trainEvery: 40, lampsOut: 0 },
  { id: 'tensa', every: 8, hunters: 3, perTrain: 1, walk: 1.6, run: 5.2, sightLit: 9, sightDark: 3, sightChasing: 6, trainEvery: 28, lampsOut: 0 },
  { id: 'dura', every: 6, hunters: 4, perTrain: 1, walk: 1.8, run: 6.2, sightLit: 10, sightDark: 4, sightChasing: 7, trainEvery: 22, lampsOut: 0 },
  { id: 'ultima', every: 4.5, hunters: 5, perTrain: 2, walk: 2, run: 7.2, sightLit: 12, sightDark: 4, sightChasing: 8, trainEvery: 18, lampsOut: 3 },
];
/** Development (the picker's «Cuántos», `?crowd=`): how many times as full of them the avenue is as its tier says, to try it fuller or emptier. */
export const NIGHT_DEV = { crowd: 1 };
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
/**
 * A fight on the way home over (won or walked away from, 2026-11-23): every pupil still out near the
 * party lights up a moment so they can be found, and none of them moves for AFTER_FIGHT seconds.
 */
export const AFTER_FIGHT = 2;

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

/** A hunter's round: a small loop round where it came up, kept on walkable cells (and, with `keep`, on those it allows: off the carriageways). */
export function roundAbout(at: Cell, grid: readonly string[], radius = 4, keep: (cell: Cell) => boolean = () => true): Cell[] {
  const free = (c: Cell) => grid[c.z]?.[c.x] !== undefined && grid[c.z][c.x] !== '#' && keep(c);
  const loop = [[radius, 0], [0, radius * .6], [-radius, 0], [0, -radius * .6]]
    .map(([dx, dz]) => ({ x: Math.round(at.x + dx), z: Math.round(at.z + dz) }))
    .filter(free);
  return [{ x: Math.round(at.x), z: Math.round(at.z) }, ...loop];
}
/**
 * Where the night's groups stand when it falls: one every `every` cells of the place's length, each
 * slice of it taking another band across (near pavement, median, far pavement and back), so they
 * fill the avenue instead of standing in a row. Only where the party can walk to and there is room
 * for a round (`keep`: off the carriageways), and never within `clear` of where it comes out.
 */
export function postsAlong(grid: readonly string[], every: number, from: Cell, keep: (cell: Cell) => boolean = () => true, clear = FIRST_CLEAR): Cell[] {
  const width = grid[0]?.length ?? 0, count = Math.max(1, Math.round(width / every));
  const walkable = (c: Cell) => grid[c.z]?.[c.x] !== undefined && grid[c.z][c.x] !== '#';
  // What can be walked to from where the party is: a yard nobody can reach is not a place to lurk.
  const start = { x: Math.round(from.x), z: Math.round(from.z) }, reached = new Set<number>(), queue: Cell[] = [];
  const mark = (c: Cell) => { const k = c.z * width + c.x; if (walkable(c) && !reached.has(k)) { reached.add(k); queue.push(c); } };
  mark(start);
  for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) mark({ x: queue[i].x + dx, z: queue[i].z + dz });
  const free = (c: Cell) => reached.has(c.z * width + c.x) && keep(c);
  const open = (c: Cell) => free(c) && [[2, 0], [-2, 0], [0, 1], [0, -1]].every(([dx, dz]) => free({ x: c.x + dx, z: c.z + dz }));
  const posts: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const x0 = Math.floor(i * width / count), x1 = Math.floor((i + 1) * width / count), cells: Cell[] = [];
    for (let x = x0; x < x1; x++) for (let z = 0; z < grid.length; z++) { const c = { x, z }; if (open(c) && dist(c, from) >= clear) cells.push(c); }
    if (!cells.length) continue;
    const across = cells.map(c => c.z).sort((a, b) => a - b), want = across[Math.floor(across.length * ((i * 2) % 5 + .5) / 5)], mid = (x0 + x1) / 2;
    const off = (c: Cell) => Math.abs(c.z - want) * 2 + Math.abs(c.x - mid);
    posts.push(cells.reduce((best, c) => off(c) < off(best) ? c : best));
  }
  return posts;
}
/** The avenue's own rows, a little over: from home's portal across to the last of its grates (the median's, the station's). */
export function avenueRows(grates: readonly Cell[], portal: Cell, over = 6): [number, number] {
  const rows = [...grates.map(g => g.z), portal.z];
  return [Math.min(...rows) - over, Math.max(...rows) + over];
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

/**
 * How much stronger than inside the castle its pupils are out here at night (src/castle.ts
 * `NightFight`): `start` times their PV and blows, less `perFriend` for each friend's ánima and
 * `perLevel` for each level its ánimas have grown, down to `floor`. Since 2026-11-22 (Aitor: «que el
 * castillo y la Meridiana de noche no escalen tanto con la progresión del jugador, para medir su
 * capacidad») they are a quarter stronger than inside whatever the party has, so the night measures
 * it: with Nuria's ánima only the first floor's elite cannot be beaten out here, with two or three
 * friends it can, and with all of them it is a place to farm a little (docs/fight-sim.md § The
 * yardstick and the side missions). Until that day they shoved instead of using their moves, and the
 * night got weaker as the party grew. Tunable (`just fight-sim`, book `night`).
 */
export const NIGHT_PUPILS = { start: 1.25, perFriend: 0, perLevel: 0, floor: 1 };
export function nightMight(friends: number, levels: Partial<Record<string, number>> = {}) {
  const grown = Object.values(levels).reduce((sum: number, level) => sum + Math.max(0, (level ?? 1) - 1), 0);
  return Math.max(NIGHT_PUPILS.floor, NIGHT_PUPILS.start - NIGHT_PUPILS.perFriend * friends - NIGHT_PUPILS.perLevel * grown);
}
/** The castle's floors as Aitor names their pupils. */
const FLOORS = { 1: 'los de primero', 2: 'los de segundo', 3: 'los de tercero' } as const;
/**
 * What Aitor says when they first see them: whose they are (the floor of the castle the party is on,
 * `phase`) and, by the friends' ánimas gathered, whether to stop and fight.
 */
export function sizeUp(animas: number, phase: 1 | 2 | 3 = 1) {
  const who = FLOORS[phase];
  return animas <= 0 ? `Son ${who} del castillo. Ni se te ocurra pararte a pelear.`
    : animas === 1 ? `Son ${who} del castillo… Con lo de Nuria igual podemos. Mejor no probarlo.`
    : `Son ${who} del castillo. Si aquí les podemos, dentro también.`;
}
