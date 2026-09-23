export type Direction = 'up' | 'right' | 'down' | 'left';
export interface Cell { x: number; z: number }

import { COURTYARD } from './environments.ts';

export const LEVEL = COURTYARD.grid;
export const VECTORS: Record<Direction, Cell> = {
  up: { x: 0, z: -1 }, right: { x: 1, z: 0 },
  down: { x: 0, z: 1 }, left: { x: -1, z: 0 },
};
export const SPAWN: Cell = { x: 6, z: 9 };
export function isOccupied(cell: Cell, occupied: readonly Cell[]): boolean {
  return occupied.some(other => other.x === cell.x && other.z === cell.z);
}
export function canWalk(cell: Cell, grid: readonly string[] = LEVEL): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z)
    && cell.x >= 0 && cell.z >= 0 && cell.z < grid.length
    && cell.x < grid[cell.z].length && grid[cell.z][cell.x] !== '#';
}
export function stickDirection(x: number, y: number, previous: Direction | null = null): Direction | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.max(Math.abs(x), Math.abs(y)) < (previous ? 0.22 : 0.3)) return null;
  // Keep the current sector through small diagonal/dead-zone fluctuations.
  if (previous) {
    const vector = VECTORS[previous];
    const along = x * vector.x + y * vector.z;
    const across = vector.x ? Math.abs(y) : Math.abs(x);
    if (along > 0 && across < along + 0.12) return previous;
  }
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}
export interface Stick { x: number; y: number }
/** The isometric camera sits at +x/+z, so grid axes appear as screen diagonals. */
export function screenToGrid(x: number, y: number): Cell {
  return { x: (x + y) * Math.SQRT1_2, z: (y - x) * Math.SQRT1_2 };
}
/** Yaw that faces a grid-space vector: +z is 0°, +x is 90°. */
export function facingToward(x: number, z: number) { return Math.atan2(x, z) * 180 / Math.PI; }
/** Screen-space unit vectors for keys, the D-pad and on-screen buttons. */
export const SCREEN_VECTORS: Record<Direction, Stick> = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
/** Walking speed in tiles per second. */
export const WALK_SPEED = 5.2;
/** Radius of the player's round collider, in tiles. */
export const RADIUS = 0.3;
const HOP_SECONDS = 0.28;
/** How far off a corner the player can be and still be nudged around it, in tiles. */
const CORNER_ASSIST = 0.4;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Free movement over a tile map. Walls and occupied tiles are solid boxes; the player is a
 * circle, so it slides along walls and rounds corners. `cell` is the tile underneath.
 */
export class FreeMovement {
  grid: readonly string[];
  /** Logical position; during a hop it is already the destination. */
  at: Cell;
  private tile: Cell;
  private hopFrom: Cell;
  progress = 1;
  steps = 0;
  bouncing = false;
  /** Whether the last `drive` actually moved, so pushing into a wall does not animate a walk. */
  walking = false;
  constructor(grid: readonly string[] = LEVEL, spawn: Cell = SPAWN) {
    if (!canWalk(spawn, grid)) throw new Error('Spawn must be on a walkable cell');
    this.grid = grid;
    this.at = { ...spawn };
    this.tile = { ...spawn };
    this.hopFrom = { ...spawn };
  }
  get cell(): Cell { return { ...this.tile }; }
  get position(): Cell {
    if (!this.bouncing) return { ...this.at };
    const p = this.progress, t = p * p * (3 - 2 * p);
    return { x: this.hopFrom.x + (this.at.x - this.hopFrom.x) * t, z: this.hopFrom.z + (this.at.z - this.hopFrom.z) * t };
  }
  /** Tiles the collider touches, for keeping others from walking into the player. */
  get footprint(): Cell[] {
    const cells = this.touched(this.at);
    if (!isOccupied(this.tile, cells)) cells.push(this.cell);
    return cells;
  }
  teleport(grid: readonly string[], cell: Cell) {
    if (!canWalk(cell, grid)) throw new Error('Destination must be on a walkable cell');
    this.grid = grid;
    this.at = { ...cell };
    this.tile = { ...cell };
    this.progress = 1;
    this.bouncing = false;
    this.walking = false;
  }
  /**
   * Moves by a grid-space direction whose length (≤ 1) scales the speed.
   * Returns true when the player enters a new tile, which counts as a step.
   */
  drive(vx: number, vz: number, dt: number, occupied: readonly Cell[] = [], running = false): boolean {
    this.walking = false;
    const length = Math.hypot(vx, vz);
    if (this.bouncing || !Number.isFinite(length) || length < 1e-6) return false;
    const distance = WALK_SPEED * (running ? 2 : 1) * clamp(dt, 0, 0.05) * Math.min(1, length);
    // Substeps keep a long frame from tunnelling through a wall.
    const substeps = Math.max(1, Math.ceil(distance / (RADIUS / 2)));
    const start = { ...this.at };
    for (let i = 0; i < substeps; i++) this.advance({ x: vx / length * distance / substeps, z: vz / length * distance / substeps }, occupied);
    this.walking = Math.hypot(this.at.x - start.x, this.at.z - start.z) > distance * 0.1;
    // Switch tiles a little past the border so walking along a seam does not count steps twice.
    if (Math.abs(this.at.x - this.tile.x) <= 0.6 && Math.abs(this.at.z - this.tile.z) <= 0.6) return false;
    this.tile = { x: Math.round(this.at.x), z: Math.round(this.at.z) };
    this.steps += 1;
    return true;
  }
  /** Hop to the nearest free tile if something ended up overlapping the player. */
  resolveOverlap(occupied: readonly Cell[], animate = true): boolean {
    this.walking = false;
    if (!this.overlaps(this.at, occupied)) return false;
    const queue = [this.cell];
    const seen = new Set([`${this.tile.x},${this.tile.z}`]);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (canWalk(cell, this.grid) && !isOccupied(cell, occupied)) {
        this.hopFrom = this.position;
        this.at = { ...cell };
        this.tile = { ...cell };
        this.progress = animate ? 0 : 1;
        this.bouncing = animate;
        return true;
      }
      for (const delta of Object.values(VECTORS)) {
        const next = { x: cell.x + delta.x, z: cell.z + delta.z };
        const key = `${next.x},${next.z}`;
        if (canWalk(next, this.grid) && !seen.has(key)) { seen.add(key); queue.push(next); }
      }
    }
    return false;
  }
  /** Advances a separation hop. */
  update(dt: number) {
    if (!this.bouncing) return;
    this.progress = Math.min(1, this.progress + clamp(dt, 0, 0.05) / HOP_SECONDS);
    if (this.progress >= 1) this.bouncing = false;
  }
  private touched(p: Cell): Cell[] {
    const cells: Cell[] = [];
    // Only tiles the collider reaches into; merely touching a neighbour's edge does not count.
    const r = RADIUS - 1e-6;
    for (let z = Math.round(p.z - r); z <= Math.round(p.z + r); z++)
      for (let x = Math.round(p.x - r); x <= Math.round(p.x + r); x++) cells.push({ x, z });
    return cells;
  }
  private solid(cell: Cell, occupied: readonly Cell[]) { return !canWalk(cell, this.grid) || isOccupied(cell, occupied); }
  private overlaps(p: Cell, occupied: readonly Cell[]) {
    return this.touched(p).some(cell => this.solid(cell, occupied)
      && Math.hypot(p.x - clamp(p.x, cell.x - .5, cell.x + .5), p.z - clamp(p.z, cell.z - .5, cell.z + .5)) < RADIUS - 1e-9);
  }
  /** Moves one substep; when a corner blocks it head-on, sidesteps around it instead of snagging. */
  private advance(delta: Cell, occupied: readonly Cell[]) {
    const length = Math.hypot(delta.x, delta.z);
    const along = (from: Cell, to: Cell) => ((to.x - from.x) * delta.x + (to.z - from.z) * delta.z) / length;
    const next = this.collide({ x: this.at.x + delta.x, z: this.at.z + delta.z }, occupied);
    if (along(this.at, next) > length * 0.5) { this.at = next; return; }
    const side = { x: -delta.z / length, z: delta.x / length };
    for (let offset = 0.1; offset <= CORNER_ASSIST + 1e-9; offset += 0.1) for (const sign of [1, -1]) {
      const probe = { x: this.at.x + side.x * offset * sign, z: this.at.z + side.z * offset * sign };
      if (this.overlaps(probe, occupied)) continue;
      // The lane beside the corner must be clear a full radius ahead; a flat wall never is.
      if (this.overlaps({ x: probe.x + delta.x / length * RADIUS, z: probe.z + delta.z / length * RADIUS }, occupied)) continue;
      this.at = this.collide({ x: this.at.x + side.x * length * sign, z: this.at.z + side.z * length * sign }, occupied);
      return;
    }
    this.at = next;
  }
  /** Pushes the circle out of every solid tile box it overlaps. */
  private collide(p: Cell, occupied: readonly Cell[]): Cell {
    let { x, z } = p;
    for (let pass = 0; pass < 3; pass++) {
      let pushed = false;
      for (const cell of this.touched({ x, z })) {
        if (!this.solid(cell, occupied)) continue;
        const nearX = clamp(x, cell.x - .5, cell.x + .5), nearZ = clamp(z, cell.z - .5, cell.z + .5);
        const d = Math.hypot(x - nearX, z - nearZ);
        if (d >= RADIUS) continue;
        if (d > 1e-9) {
          x = nearX + (x - nearX) / d * RADIUS;
          z = nearZ + (z - nearZ) / d * RADIUS;
        } else {
          // The centre is on or inside the box: leave through the closest face.
          const dx = x - cell.x, dz = z - cell.z;
          if (Math.abs(dx) >= Math.abs(dz)) x = cell.x + (dx < 0 ? -1 : 1) * (.5 + RADIUS);
          else z = cell.z + (dz < 0 ? -1 : 1) * (.5 + RADIUS);
        }
        pushed = true;
      }
      if (!pushed) break;
    }
    return { x, z };
  }
}
