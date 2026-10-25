import { canWalk, facingToward, type Cell } from './movement.ts';
import { pathTo } from './follower.ts';

/**
 * A cat at home (docs/quests/nuria.md § Beats, 5): it walks a few cells to a spot nearby, sits
 * there a while, and picks another. Pure: the game draws it.
 */
export interface Wanderer { position: Cell; facing: number; walking: boolean; path: Cell[]; wait: number }
/** Cells per second, how far a stroll goes, and how long a cat sits between strolls (seconds). */
export const CAT_SPEED = 1.1, STROLL = 4, SIT = [2.5, 7] as const;

export function createWanderer(start: Cell, wait = 0): Wanderer {
  return { position: { ...start }, facing: 0, walking: false, path: [], wait };
}

/** A walkable cell within STROLL of `from` with a path to it, or nothing after a few tries. */
function pickSpot(grid: readonly string[], from: Cell, random: () => number, avoid: readonly Cell[]) {
  for (let tries = 0; tries < 12; tries++) {
    const to = { x: Math.round(from.x + (random() * 2 - 1) * STROLL), z: Math.round(from.z + (random() * 2 - 1) * STROLL) };
    if (!canWalk(to, grid)) continue;
    const path = pathTo(grid, from, to, avoid);
    if (path.length && path.length <= STROLL * 2) return path;
  }
  return [];
}

/** Moves the cat on by `dt` seconds; `avoid` are cells it should not stop on (Gerard, the other cat). */
export function wander(cat: Wanderer, dt: number, grid: readonly string[], random: () => number = Math.random, avoid: readonly Cell[] = []) {
  cat.walking = false;
  if (!cat.path.length) {
    cat.wait -= dt;
    if (cat.wait > 0) return cat;
    cat.path = pickSpot(grid, cat.position, random, avoid);
    if (!cat.path.length) { cat.wait = SIT[0]; return cat; }
  }
  let budget = CAT_SPEED * Math.min(Math.max(dt, 0), .1);
  while (budget > 0 && cat.path.length) {
    const target = cat.path[0];
    const dx = target.x - cat.position.x, dz = target.z - cat.position.z, d = Math.hypot(dx, dz);
    if (d <= budget) { cat.position = { ...target }; cat.path.shift(); budget -= d; continue; }
    cat.position = { x: cat.position.x + dx / d * budget, z: cat.position.z + dz / d * budget };
    cat.facing = facingToward(dx, dz);
    cat.walking = true;
    budget = 0;
  }
  if (!cat.path.length) cat.wait = SIT[0] + random() * (SIT[1] - SIT[0]);
  return cat;
}
