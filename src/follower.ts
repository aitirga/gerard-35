import { VECTORS, WALK_SPEED, canWalk, facingToward, isOccupied, type Cell } from './movement.ts';

/** The shortest 4-way walk from `from` to `to` over the grid's centres, or nothing if there is none. */
export function pathTo(grid: readonly string[], from: Cell, to: Cell, blocked: readonly Cell[] = []): Cell[] {
  const key = (c: Cell) => `${c.x},${c.z}`;
  const start = { x: Math.round(from.x), z: Math.round(from.z) }, goal = { x: Math.round(to.x), z: Math.round(to.z) };
  const previous = new Map<string, Cell | null>([[key(start), null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (cell.x === goal.x && cell.z === goal.z) {
      const path: Cell[] = [];
      for (let at: Cell | null = cell; at; at = previous.get(key(at)) ?? null) path.unshift(at);
      return path.slice(1);
    }
    for (const delta of Object.values(VECTORS)) {
      const next = { x: cell.x + delta.x, z: cell.z + delta.z };
      if (previous.has(key(next)) || !canWalk(next, grid) || (isOccupied(next, blocked) && key(next) !== key(goal))) continue;
      previous.set(key(next), cell); queue.push(next);
    }
  }
  return [];
}

/** How far behind Gerard a companion walks, in cells. */
export const FOLLOW_GAP = 1.2;
const CRUMB = 0.25;
const MAX_TRAIL = 240;
const dist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * A companion who walks Gerard's own path a little behind him. Following breadcrumbs instead of
 * heading straight for him keeps the companion out of walls without a second collision check.
 */
export class Follower {
  position: Cell;
  facing = 0;
  walking = false;
  private trail: Cell[] = [];
  constructor(start: Cell) { this.position = { ...start }; }
  /** Jump next to `at`, e.g. after a scene change, forgetting the old path. */
  reset(at: Cell) { this.position = { ...at }; this.trail = []; this.walking = false; }
  /** Starts the trail with a walkable path, for a companion who starts away from Gerard (Aitor across the bed). */
  seed(path: readonly Cell[]) { this.trail = path.map(cell => ({ ...cell })); }
  update(dt: number, leader: Cell, stopped = false, running = false) {
    const last = this.trail[this.trail.length - 1];
    if (!last || dist(last, leader) >= CRUMB) {
      this.trail.push({ ...leader });
      if (this.trail.length > MAX_TRAIL) this.trail.shift();
    }
    this.walking = false;
    if (stopped || dist(this.position, leader) <= FOLLOW_GAP) return;
    // Hurry a little when left behind, so the companion never gets lost off-screen.
    let budget = WALK_SPEED * (running ? 1.5 : 1) * (dist(this.position, leader) > 3 ? 1.35 : 1) * Math.min(Math.max(dt, 0), 0.05);
    while (budget > 0 && dist(this.position, leader) > FOLLOW_GAP) {
      const target = this.trail[0] ?? leader;
      const d = dist(this.position, target);
      if (d < 1e-6) { if (!this.trail.shift()) break; continue; }
      const step = Math.min(budget, d);
      const dx = (target.x - this.position.x) / d, dz = (target.z - this.position.z) / d;
      this.position = { x: this.position.x + dx * step, z: this.position.z + dz * step };
      this.facing = facingToward(dx, dz);
      this.walking = true;
      budget -= step;
      if (step === d) this.trail.shift();
    }
  }
}
