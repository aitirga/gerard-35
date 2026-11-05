import { canWalk, type Cell } from './movement.ts';

/**
 * Where a fight is staged (docs/combat.md § Dónde se planta un combate). Everyone in it needs room: the
 * party on one side, the foes on the other, the cats by whoever wears Papagato, elbow room round
 * each of them and a clear way between the two sides for the blows. Where it starts on open ground,
 * or on a street wide enough to line up across, it is staged right there, as part of the place.
 * Where it does not fit (a passage, a corner, walls on every side, as on Uri's tower), it moves to a
 * pocket: the same stretch of the place, widened until the fight fits (`planPocket`, src/pocket.ts). Pure.
 *
 * Positions are in cells, which are also world units: offsets apply to world x and z alike.
 */
export interface Point { x: number; z: number }
/**
 * How the two sides line up: `open` ground with the party on the left of the screen and the foes
 * on the right; along a street that runs `x` the same way, closer together across it; along one
 * that runs `z` the party at the near end and the foes at the far one.
 */
export type Layout = 'open' | 'x' | 'z';
export type Stage = { pocket: false; layout: Layout; centre: Point } | { pocket: true };
/**
 * Who is in the fight: how many in the party, which of them wear Papagato (its cats come too), the
 * foes' kinds, and how far apart the two sides stand (`spread`, 1 as always; a pocket spreads them).
 */
export interface Cast { allies: number; cats?: readonly number[]; foes: readonly (string | undefined)[]; spread?: number }

/** Unit directions of a layout: `ahead` from the party towards the foes, `side` across the line. */
export function axes(layout: Layout): { ahead: Point; side: Point } {
  return layout === 'z' ? { ahead: { x: 0, z: -1 }, side: { x: 1, z: 0 } } : { ahead: { x: 1, z: 0 }, side: { x: 0, z: 1 } };
}
const at = (p: Point, ahead: Point, side: Point, along: number, across: number): Point =>
  ({ x: p.x + ahead.x * along + side.x * across, z: p.z + ahead.z * along + side.z * across });

/** How far ahead of the fight's centre the foes stand. */
export const FOE_AHEAD = 1.2;
/**
 * A big foe (more than BIG_FOE cells of radius, Vertitrón) stands further back, FOE_DEPTH for each
 * cell beyond it, so it never looms over the party; the rest keep their place, since small rooms
 * (the palace minion's) are measured for it.
 */
export const BIG_FOE = 1, FOE_DEPTH = 2;
/** A foe's radius in cells by its kind (a dog if it has none). */
export const foeSize = (kind?: string) => FOE_SIZE[kind ?? 'dog'] ?? FOE_SIZE.dog;
/**
 * A giant (GIANT cells of radius or more: Vertitrón, Uri on top) stands GIANT_BACK cells further back
 * still, and on open ground the fight's camera turns GIANT_TURN degrees round it towards the party's
 * back (`fightCamera`): the giant is seen whole and from the front, over their shoulders, instead
 * of side on and right next to them.
 */
export const GIANT = 1.5, GIANT_BACK = 1.5, GIANT_TURN = -60;
const giant = (kind?: string) => foeSize(kind) >= GIANT;
/**
 * Where each fighter stands, from the fight's centre: the party `along` behind it and the foes
 * ahead, side by side across the line (closer together along a street, where they stand further
 * apart along it instead), the two sides `spread` times as far apart as usual. `foes` is how many,
 * or their kinds: a big foe stands back by its size (BIG_FOE, FOE_DEPTH).
 */
export function formation(layout: Layout, allies: number, foes: number | readonly (string | undefined)[], spread = 1): { allies: Point[]; foes: Point[] } {
  const { ahead, side } = axes(layout), street = layout !== 'open';
  const kinds = typeof foes === 'number' ? Array.from({ length: foes }, () => undefined) : foes;
  const depth = (i: number) => Math.max(0, foeSize(kinds[i]) - BIG_FOE) * FOE_DEPTH + (giant(kinds[i]) ? GIANT_BACK : 0);
  // Before a giant on open ground the camera looks from behind the party (`fightCamera`): from there
  // a step back on the camera's side would hide one behind the other, so the party lines up the other way.
  const mirror = !street && kinds.some(giant) ? -1 : 1;
  const line = (n: number, party: boolean) => Array.from({ length: n }, (_, i) => {
    // Side by side with room between them (more in a pocket), every other one a step back, so seen
    // from the camera's side they stand apart on screen too, not one in front of the other.
    const room = 1 + (spread - 1) * .5;
    const across = ((i - (n - 1) / 2) * (party ? 2.2 : street ? 1.85 : 2.15) * room + (party ? .6 : -.6) * (street ? .15 : 1)) * (party ? mirror : 1);
    const along = (party ? -2.2 : FOE_AHEAD) * (street ? 1.3 : 1) * spread + (i % 2 ? (party ? -.9 : .7) : 0) + (party ? 0 : depth(i));
    return at({ x: 0, z: 0 }, ahead, side, along, across);
  });
  return { allies: line(allies, true), foes: line(kinds.length, false) };
}

/**
 * Haru and Yuki round Papagato's wearer (`wearer` is where they stand): Haru a step ahead,
 * towards the foes, on guard; Yuki a step behind, sitting, or pressed in behind the wearer when
 * she hides. `strike(target)` is where Haru lands to swat a foe, just short of it.
 */
export function catSpots(layout: Layout, wearer: Point) {
  const { ahead, side } = axes(layout);
  return {
    haru: at(wearer, ahead, side, .75, -.5),
    yuki: at(wearer, ahead, side, -.55, .5),
    hidden: at(wearer, ahead, side, -.4, .05),
    /** Where Haru looks back from on her way home: behind her, towards the party. */
    back: (from: Point) => at(from, ahead, side, -1, 0),
    strike: (target: Point) => at(target, ahead, side, -.55, .1),
  };
}

/** How wide each fighter is (radius in cells): the party, the cats, and each kind of foe (a dog if it has none). */
export const BODY = { party: .4, cat: .22 } as const;
export const FOE_SIZE: Record<string, number> = {
  dog: .45, minion: .7, guardian: 1.1, cebollon: 1.15, cebolla: .85, plato: .6, vertigo: 1.6, cebollita: .42, platito: .32, fantasmita: .32,
};
/** Elbow room every fighter needs round them, beyond their own size. */
export const ROOM = .35;
/**
 * Where the fight's camera stands for each layout, from the fight's centre (src/game.ts): on open
 * ground a little off the party's side, from the south; along a street from the party's end.
 */
export const CAMERA: Record<Layout, { x: number; y: number; z: number }> = {
  open: { x: 5, y: 9, z: 15 }, x: { x: -15, y: 10, z: 2 }, z: { x: 2, y: 10, z: 15 },
};
/** Where a fight's camera stands, from its centre: the layout's (`CAMERA`), turned round on open ground for a giant (GIANT_TURN). */
export function fightCamera(layout: Layout, foes: readonly (string | undefined)[] = []) {
  const c = CAMERA[layout];
  if (layout !== 'open' || !foes.some(giant)) return c;
  const turn = GIANT_TURN * Math.PI / 180;
  return { x: c.x * Math.cos(turn) + c.z * Math.sin(turn), y: c.y, z: c.z * Math.cos(turn) - c.x * Math.sin(turn) };
}
/**
 * How high on a fighter the camera must see. Most places' walls do not hide anyone from a fight's
 * camera (fences, props, low walls, facades it cuts away); a place whose walls do says how tall
 * they are (`Environment.walls`): Uri's tower.
 */
export const CHEST = 1;
/** How much ground in front of each fighter, towards the camera, must be clear to see them over walls `walls` tall (none if the walls hide nobody). */
export function viewRoom(layout: Layout, walls?: number) {
  if (walls === undefined) return 0;
  const c = CAMERA[layout];
  return Math.max(1, (walls - CHEST) / (c.y / Math.hypot(c.x, c.z)));
}
/** The narrowest street a fight lines up across where it starts: narrower, it goes to a pocket. */
export const STREET_WIDTH = 7;
/** How many steps from where it starts a fight may move to find its room. */
const SHIFT = 4;

/** Every cell a circle of `radius` round `p` touches is walkable. */
function clear(grid: readonly string[], p: Point, radius: number) {
  const points = [p, ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return { x: p.x + Math.cos(a) * radius, z: p.z + Math.sin(a) * radius }; })];
  return points.every(q => canWalk({ x: Math.round(q.x), z: Math.round(q.z) }, grid));
}
/** Nothing in the way along a straight line (a blow's run-up). */
function open(grid: readonly string[], a: Point, b: Point) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .3);
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    if (!canWalk({ x: Math.round(a.x + (b.x - a.x) * t), z: Math.round(a.z + (b.z - a.z) * t) }, grid)) return false;
  }
  return true;
}

/** Whether the whole cast fits a fight lined up `layout` round `centre`, with room to move and to be seen over walls `walls` tall. */
export function fits(grid: readonly string[], centre: Point, layout: Layout, cast: Cast, walls?: number): boolean {
  const slots = formation(layout, cast.allies, cast.foes, cast.spread);
  const allies = slots.allies.map(p => ({ x: centre.x + p.x, z: centre.z + p.z }));
  const foes = slots.foes.map(p => ({ x: centre.x + p.x, z: centre.z + p.z }));
  if (!allies.every(p => clear(grid, p, BODY.party + ROOM))) return false;
  if (!foes.every((p, i) => clear(grid, p, foeSize(cast.foes[i]) + ROOM))) return false;
  if (!allies.every(a => foes.every(f => open(grid, a, f)))) return false;
  const seen = [...allies, ...foes];
  for (const i of cast.cats ?? []) {
    const wearer = allies[i];
    if (!wearer) continue;
    const cats = catSpots(layout, wearer);
    if (!clear(grid, cats.haru, BODY.cat + ROOM / 2) || !clear(grid, cats.yuki, BODY.cat + ROOM / 2)) return false;
    if (!foes.every(f => open(grid, cats.haru, cats.strike(f)))) return false;
    seen.push(cats.haru, cats.yuki);
  }
  // Nothing stands right in front of anyone on the camera's side (a wall of Uri's tower would hide them), where the walls are that tall.
  const camera = fightCamera(layout, cast.foes), flat = Math.hypot(camera.x, camera.z), to = { x: camera.x / flat, z: camera.z / flat };
  const view = viewRoom(layout, walls);
  return !view || seen.every(p => open(grid, p, { x: p.x + to.x * view, z: p.z + to.z * view }));
}

/** The free cells through `at` along one axis: from the lowest to the highest reached without a wall. */
function run(grid: readonly string[], at: Cell, axis: 'x' | 'z', look = 12) {
  const step = (d: number) => {
    let n = 0;
    while (n < look && canWalk(axis === 'x' ? { x: at.x + d * (n + 1), z: at.z } : { x: at.x, z: at.z + d * (n + 1) }, grid)) n++;
    return n;
  };
  const from = (axis === 'x' ? at.x : at.z) - step(-1), to = (axis === 'x' ? at.x : at.z) + step(1);
  return { from, to, size: to - from + 1 };
}
/**
 * The street through `cell`, if it is in one (narrow one way, long the other) wide enough to line
 * up across: the fight's centre in the middle of it, kept far enough from its ends for both sides.
 */
function streetAt(grid: readonly string[], cell: Cell): { layout: 'x' | 'z'; centre: Point } | undefined {
  const x = run(grid, cell, 'x'), z = run(grid, cell, 'z');
  const layout = z.size > x.size ? 'z' : 'x';
  const along = layout === 'z' ? z : x, across = layout === 'z' ? x : z;
  if (across.size < STREET_WIDTH || along.size < 12) return undefined;
  const middle = (across.from + across.to) / 2, here = layout === 'z' ? cell.z : cell.x;
  // Party and foes stand up to 3.4 along from the middle, with room for a step behind each.
  const low = along.from + 3.5, high = along.to - 3.5;
  const spot = low <= high ? Math.min(high, Math.max(low, here)) : (along.from + along.to) / 2;
  return { layout, centre: layout === 'z' ? { x: middle, z: spot } : { x: spot, z: middle } };
}

/** The walkable cells up to SHIFT steps from `cell`, nearest first (never through a wall). */
function around(grid: readonly string[], cell: Cell): Cell[] {
  const seen = new Set([`${cell.x},${cell.z}`]), all = [cell];
  let ring = [cell];
  for (let steps = 0; steps < SHIFT && ring.length; steps++) {
    const next: Cell[] = [];
    for (const c of ring) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, z: c.z + dz }, key = `${n.x},${n.z}`;
      if (!seen.has(key) && canWalk(n, grid)) { seen.add(key); next.push(n); }
    }
    all.push(...next); ring = next;
  }
  return all;
}

/**
 * Where a fight that starts at `at` is staged: on the open ground there, or a few steps away;
 * else along the street it is in, if it is wide enough; else in a pocket.
 */
export function stageFight(grid: readonly string[], at: Point, cast: Cast, walls?: number): Stage {
  const cell = { x: Math.round(at.x), z: Math.round(at.z) };
  if (!canWalk(cell, grid)) return { pocket: true };
  const near = around(grid, cell);
  for (const c of near) if (fits(grid, c, 'open', cast, walls)) return { pocket: false, layout: 'open', centre: { ...c } };
  for (const c of near) {
    const street = streetAt(grid, c);
    if (street && fits(grid, street.centre, street.layout, cast, walls)) return { pocket: false, ...street };
  }
  return { pocket: true };
}


// ── The pocket ──────────────────────────────────────────────────────────────────────────────

/**
 * How far round where a fight starts a pocket copies the place (cells), how much further apart the
 * two sides stand in it than usual, and how much it is widened: at least `least` (a pocket always
 * has more room than the place had), at most `widest`.
 */
export const POCKET = { reach: 9, spread: 1.5, least: 4, widest: 16 } as const;
/** What each cell of a pocket is: the place's floor, one of its walls, one of its things (a lamp, a tree: drawn as itself), or nothing (the sky round it). */
export type PocketCell = 'floor' | 'wall' | 'prop' | 'void';
export interface PocketPlan {
  /** The pocket's cells, row by row (z then x). */
  cells: PocketCell[][];
  /** The place's cell its window starts at. */
  origin: Cell;
  /** Where it was widened (the row and column through where the fight started, in the pocket) and by how many copies of each. */
  rows: number; columns: number; at: Cell;
  /** The fight in it: its centre (in pocket cells) and how the sides line up. */
  stage: { layout: Layout; centre: Point };
}

/** The pocket's cells as a grid for staging: only its floor is walkable. */
export const pocketGrid = (cells: readonly PocketCell[][]) => cells.map(row => row.map(c => c === 'floor' ? '.' : '#').join(''));

/** The place's cell a cell of the pocket copies (a widened row or column copies the one it was made from). */
export function placeCell(plan: Pick<PocketPlan, 'origin' | 'rows' | 'columns' | 'at'>, c: Cell): Cell {
  const un = (v: number, at: number, by: number) => v <= at ? v : v <= at + by ? at : v - by;
  return { x: plan.origin.x + un(c.x, plan.at.x, plan.columns), z: plan.origin.z + un(c.z, plan.at.z, plan.rows) };
}
/** Where a cell of the place lands in the pocket (the first copy, if its row or column was widened). */
export function pocketCellOf(plan: Pick<PocketPlan, 'origin' | 'rows' | 'columns' | 'at'>, c: Cell): Cell {
  const to = (v: number, at: number, by: number) => v <= at ? v : v + by;
  return { x: to(c.x - plan.origin.x, plan.at.x, plan.columns), z: to(c.z - plan.origin.z, plan.at.z, plan.rows) };
}

/**
 * The pocket a fight that starts at `at` and has no room there moves to: the stretch of the place
 * round it (the ground it can walk to within POCKET.reach, the walls that bound it and the things
 * that stand on it, `props`), widened through where it started, across the way the ground runs (a
 * corridor along x gets more rows, one along z more columns, a corner or a room both), until the
 * fight fits with its two sides POCKET.spread times further apart. A corridor stays a corridor.
 */
export function planPocket(grid: readonly string[], at: Point, cast: Cast, props: ReadonlySet<string> = new Set()): PocketPlan {
  const R = POCKET.reach, size = R * 2 + 1;
  const spot = { x: Math.round(at.x), z: Math.round(at.z) }, origin = { x: spot.x - R, z: spot.z - R };
  const key = (x: number, z: number) => `${origin.x + x},${origin.z + z}`;
  const free = (x: number, z: number) => x >= 0 && z >= 0 && x < size && z < size && canWalk({ x: origin.x + x, z: origin.z + z }, grid);
  // The ground reachable from the spot within the window.
  const ground = new Set<string>();
  if (free(R, R)) {
    const queue: Cell[] = [{ x: R, z: R }]; ground.add(`${R},${R}`);
    for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: queue[i].x + dx, z: queue[i].z + dz }, k = `${n.x},${n.z}`;
      if (!ground.has(k) && free(n.x, n.z)) { ground.add(k); queue.push(n); }
    }
  } else ground.add(`${R},${R}`);
  const near = (x: number, z: number) => [-1, 0, 1].some(dx => [-1, 0, 1].some(dz => ground.has(`${x + dx},${z + dz}`)));
  const base: PocketCell[][] = Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) =>
    ground.has(`${x},${z}`) ? 'floor' : !near(x, z) ? 'void' : props.has(key(x, z)) ? 'prop' : 'wall'));
  // Nothing walled in shows the sky (the inside of a fountain): only what the window's edge reaches stays open.
  const outside = new Set<string>(), edge: Cell[] = [];
  for (let i = 0; i < size; i++) for (const c of [{ x: i, z: 0 }, { x: i, z: size - 1 }, { x: 0, z: i }, { x: size - 1, z: i }]) if (base[c.z][c.x] === 'void' && !outside.has(`${c.x},${c.z}`)) { outside.add(`${c.x},${c.z}`); edge.push(c); }
  for (let i = 0; i < edge.length; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = { x: edge[i].x + dx, z: edge[i].z + dz }, k = `${n.x},${n.z}`;
    if (base[n.z]?.[n.x] === 'void' && !outside.has(k)) { outside.add(k); edge.push(n); }
  }
  base.forEach((row, z) => row.forEach((c, x) => { if (c === 'void' && !outside.has(`${x},${z}`)) row[x] = 'wall'; }));
  // Which way the ground runs through the spot.
  const run = (dx: number, dz: number) => { let n = 0; for (const s of [1, -1]) for (let k = 1; k < size && base[R + dz * k * s]?.[R + dx * k * s] === 'floor'; k++) n++; return n + 1; };
  const along = run(1, 0), down = run(0, 1);
  const widen = along > down + 2 ? 'rows' : down > along + 2 ? 'columns' : 'both';
  for (let by = POCKET.least; by <= POCKET.widest; by++) {
    const rows = widen === 'columns' ? 0 : by, columns = widen === 'rows' ? 0 : by;
    // A widened row or column copies the one through the spot; a thing of the place is not copied, its ground is.
    const copy = (c: PocketCell) => c === 'prop' ? 'floor' : c;
    const stretched = base.map(row => [...row.slice(0, R + 1), ...Array.from({ length: columns }, () => copy(row[R])), ...row.slice(R + 1)]);
    const cells = [...stretched.slice(0, R + 1), ...Array.from({ length: rows }, () => stretched[R].map(copy)), ...stretched.slice(R + 1)];
    const middle = { x: R + columns / 2, z: R + rows / 2 };
    const stage = stageFight(pocketGrid(cells), middle, { ...cast, spread: POCKET.spread });
    if (!stage.pocket) return { cells, origin, rows, columns, at: { x: R, z: R }, stage: { layout: stage.layout, centre: stage.centre } };
  }
  // Never so cramped in practice; if it were, an open floor the fight surely fits.
  const open = 15, cells: PocketCell[][] = Array.from({ length: open }, (_, z) => Array.from({ length: open }, (_, x) => x && z && x < open - 1 && z < open - 1 ? 'floor' : 'wall'));
  return { cells, origin, rows: 0, columns: 0, at: { x: R, z: R }, stage: { layout: 'open', centre: { x: 7, z: 7 } } };
}
