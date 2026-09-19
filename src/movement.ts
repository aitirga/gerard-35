export type Direction = 'up' | 'right' | 'down' | 'left';
export interface Cell { x: number; z: number }

import { COURTYARD } from './environments.ts';

export const LEVEL = COURTYARD.grid;
export const VECTORS: Record<Direction, Cell> = {
  up: { x: 0, z: -1 }, right: { x: 1, z: 0 },
  down: { x: 0, z: 1 }, left: { x: -1, z: 0 },
};
export const STEP_SECONDS = 0.19;
export const SPAWN: Cell = { x: 6, z: 9 };
export function isOccupied(cell: Cell, occupied: readonly Cell[]): boolean {
  return occupied.some(other => other.x === cell.x && other.z === cell.z);
}
export function canWalk(cell: Cell, grid: readonly string[] = LEVEL): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z)
    && cell.x >= 0 && cell.z >= 0 && cell.z < grid.length
    && cell.x < grid[cell.z].length && grid[cell.z][cell.x] !== '#';
}
export function stickDirection(x: number, y: number): Direction | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.3) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}
/** Logical cells stay integral; only the visual position is interpolated. */
export class GridMovement {
  cell: Cell;
  from: Cell;
  grid: readonly string[];
  constructor(grid: readonly string[] = LEVEL, spawn: Cell = SPAWN) {
    if (!canWalk(spawn, grid)) throw new Error('Spawn must be on a walkable cell');
    this.grid = grid;
    this.cell = { ...spawn };
    this.from = { ...spawn };
  }
  teleport(grid: readonly string[], cell: Cell) {
    if (!canWalk(cell, grid)) throw new Error('Destination must be on a walkable cell');
    this.grid = grid;
    this.cell = { ...cell };
    this.from = { ...cell };
    this.progress = 1;
    this.bouncing = false;
  }
  progress = 1;
  steps = 0;
  bouncing = false;
  get moving(): boolean { return this.progress < 1; }
  /** Reserve a free destination immediately, then gently hop out of an overlap. */
  resolveOverlap(occupied: readonly Cell[], animate = true): boolean {
    if (!isOccupied(this.cell, occupied)) return false;
    const queue = [{ ...this.cell }];
    const seen = new Set([`${this.cell.x},${this.cell.z}`]);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (!isOccupied(cell, occupied)) {
        this.from = this.position;
        this.cell = cell;
        this.progress = animate ? 0 : 1;
        this.bouncing = animate;
        return true;
      }
      for (const delta of Object.values(VECTORS)) {
        const next = { x: cell.x + delta.x, z: cell.z + delta.z };
        const key = `${next.x},${next.z}`;
        if (canWalk(next, this.grid) && !seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    return false;
  }
  tryStep(direction: Direction, occupied: readonly Cell[] = []): boolean {
    if (this.moving) return false;
    const delta = VECTORS[direction];
    const next = { x: this.cell.x + delta.x, z: this.cell.z + delta.z };
    if (!canWalk(next, this.grid) || isOccupied(next, occupied)) return false;
    this.from = { ...this.cell };
    this.cell = next;
    this.progress = 0;
    return true;
  }
  update(dt: number): boolean {
    if (!this.moving) return false;
    this.progress = Math.min(1, this.progress + Math.min(Math.max(dt, 0), 0.05) / (this.bouncing ? 0.28 : STEP_SECONDS));
    if (this.moving) return false;
    if (this.bouncing) { this.bouncing = false; return false; }
    this.steps += 1;
    return true;
  }
  get position(): Cell {
    const t = this.progress * this.progress * (3 - 2 * this.progress);
    return {
      x: this.from.x + (this.cell.x - this.from.x) * t,
      z: this.from.z + (this.cell.z - this.from.z) * t,
    };
  }
}
