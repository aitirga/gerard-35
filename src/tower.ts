import type { Cell } from './movement.ts';

/** The four ways to step (kept here: environments.ts imports this file, and movement.ts imports environments.ts). */
const STEPS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

/**
 * La torre de Uri (docs/quests/nuria.md § The maze): round the corner of Nuria's street a dark
 * tower rises, and a ramp winds up round it, ring inside ring. Each ring is walked all the way
 * round (a wall blocks the short way) before its gap lets you up to the next, and at the very
 * top, on a platform, El Vértigo waits with Uri and Nil on it. Pure: the cells that block, how
 * high each walkable cell stands, and where things are. The look is src/tower-scene.ts.
 */
export interface TowerSpec {
  /** The centre cell of the tower. */
  centre: Cell;
  /** Half-sizes in cells of each wall square, outside in; the corridors lie between them. */
  walls: readonly number[];
  /** Half-size of the platform on top. */
  top: number;
  /** How much each ring climbs, in scene units (a cell is one), up to the platform. */
  rise: number;
}
export const TOWER: TowerSpec = { centre: { x: 27, z: 27 }, walls: [24, 20, 16, 12, 8], top: 7, rise: 2.2 };
export const TOP_HEIGHT = (t: TowerSpec = TOWER) => t.rise * (t.walls.length - 1);

const key = (c: Cell) => `${c.x},${c.z}`;

/**
 * The cells the tower's walls block. Every wall has one gap on the camera's side (south), and in
 * each corridor a short wall stands across it right beside the gap, so whoever comes in must walk
 * the whole ring round to reach the next gap: the climb turns one way, then the other, ring after
 * ring, like a switchback up a tower.
 */
export function towerWalls(t: TowerSpec = TOWER): Set<string> {
  const blocked = new Set<string>();
  const { centre, walls } = t;
  const gap = (k: number) => k % 2 === 0 ? [centre.x - 2, centre.x - 1] : [centre.x - 5, centre.x - 4];
  walls.forEach((h, k) => {
    const open = gap(k);
    for (let x = centre.x - h; x <= centre.x + h; x++) for (let z = centre.z - h; z <= centre.z + h; z++) {
      if (Math.max(Math.abs(x - centre.x), Math.abs(z - centre.z)) !== h) continue;
      if (z === centre.z + h && open.includes(x)) continue;
      blocked.add(`${x},${z}`);
    }
  });
  // The short walls across each corridor's south side, between its way in and its way on.
  walls.slice(0, -1).forEach((outer, k) => {
    for (let z = centre.z + walls[k + 1] + 1; z < centre.z + outer; z++) blocked.add(`${centre.x - 3},${z}`);
  });
  return blocked;
}

/** Where the ramp starts: the gap in the outer wall, on the camera's side. */
export const towerEntrance = (t: TowerSpec = TOWER): Cell => ({ x: t.centre.x - 2, z: t.centre.z + t.walls[0] });

/** Cells inside the outer wall: the tower's footprint. */
export function inTower(c: Cell, t: TowerSpec = TOWER) {
  return Math.max(Math.abs(c.x - t.centre.x), Math.abs(c.z - t.centre.z)) <= t.walls[0];
}
/** The platform on top: inside the innermost wall. */
export function onTop(c: Cell, t: TowerSpec = TOWER) {
  return Math.max(Math.abs(c.x - t.centre.x), Math.abs(c.z - t.centre.z)) < t.walls.at(-1)!;
}

/** A scene grid with the tower's walls drawn in ('#'). */
export function towerGrid(grid: readonly string[], t: TowerSpec = TOWER): string[] {
  const blocked = towerWalls(t);
  return grid.map((row, z) => [...row].map((ch, x) => blocked.has(`${x},${z}`) ? '#' : ch).join(''));
}

/**
 * How high every walkable tower cell stands, in metres: the ramp climbs evenly with the walking
 * distance from the entrance, so it rises all the way round each ring, and the platform is flat
 * at the top.
 */
export function towerHeights(grid: readonly string[], t: TowerSpec = TOWER): Map<string, number> {
  const start = towerEntrance(t);
  const distance = new Map<string, number>([[key(start), 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const v of STEPS) {
      const n = { x: c.x + v.x, z: c.z + v.z };
      if (!inTower(n, t) || grid[n.z]?.[n.x] !== '.' || distance.has(key(n))) continue;
      distance.set(key(n), distance.get(key(c))! + 1); queue.push(n);
    }
  }
  const ramp = [...distance].filter(([k]) => { const [x, z] = k.split(',').map(Number); return !onTop({ x, z }, t); });
  const longest = Math.max(1, ...ramp.map(([, d]) => d));
  const top = TOP_HEIGHT(t);
  const heights = new Map<string, number>();
  for (const [k, d] of distance) {
    const [x, z] = k.split(',').map(Number);
    heights.set(k, onTop({ x, z }, t) ? top : top * Math.min(1, d / longest));
  }
  return heights;
}
