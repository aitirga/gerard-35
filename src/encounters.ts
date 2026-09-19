import { canWalk, isOccupied, VECTORS, type Cell } from './movement.ts';

export const DOG_PROFILES = [
  { name: 'Canela', fur: '#c49464', collar: '#e99a70' },
  { name: 'Nube', fur: '#ded5bf', collar: '#91c5df' },
  { name: 'Trufa', fur: '#655048', collar: '#bcacd9' },
  { name: 'Chispa', fur: '#a87943', collar: '#c5d789' },
] as const;
export const STREET_ENCOUNTER = { stage: { x: 16, z: 24 } };
const SPAWNS: Cell[] = [{ x: 18, z: 24 }, { x: 16, z: 22 }, { x: 15, z: 25 }, { x: 17, z: 26 }];
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export interface WanderingDog {
  cell: Cell; from: Cell; progress: number; wait: number; yaw: number;
}

/** One visible pack; reserve both ends of each step so dogs never cross through anyone. */
export class WanderingPack {
  dogs: WanderingDog[] = [];
  cooldown = 0;
  armed = true;
  private respawning = false;
  private grid: readonly string[];
  private random: () => number;
  constructor(grid: readonly string[], random = Math.random) { this.grid = grid; this.random = random; this.spawn(); }
  private spawn() {
    this.dogs = SPAWNS.slice(0, 2 + Math.floor(this.random() * 3)).map(cell => ({
      cell: { ...cell }, from: { ...cell }, progress: 1, wait: .8 + this.random() * 2, yaw: 75,
    }));
  }
  get ready() { return this.cooldown === 0 && this.dogs.length > 0; }
  get occupied(): Cell[] { return this.dogs.flatMap(d => d.progress < 1 ? [d.cell, d.from] : [d.cell]); }
  position(dog: WanderingDog): Cell {
    const t = dog.progress * dog.progress * (3 - 2 * dog.progress);
    return { x: dog.from.x + (dog.cell.x - dog.from.x) * t, z: dog.from.z + (dog.cell.z - dog.from.z) * t };
  }
  near(cell: Cell, radius = 1) { return this.occupied.some(other => distance(cell, other) <= radius); }
  finish(won: boolean) {
    this.armed = false;
    this.cooldown = won ? 14 : 6;
    this.respawning = won;
    if (won) this.dogs = [];
  }
  update(dt: number, playerCells: readonly Cell[]) {
    dt = Math.max(0, Math.min(dt, .05));
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.respawning && this.cooldown === 0) {
      // Do not materialize a fresh pack under Gerard's feet.
      if (SPAWNS.some(cell => playerCells.some(player => distance(cell, player) <= 2))) return;
      this.spawn(); this.respawning = false;
    }
    if (this.ready && playerCells.every(cell => !this.near(cell, 2))) this.armed = true;
    for (const dog of this.dogs) {
      if (dog.progress < 1) { dog.progress = Math.min(1, dog.progress + dt / .7); continue; }
      dog.wait -= dt;
      if (dog.wait > 0) continue;
      dog.wait = .6 + this.random() * 2;
      const blocked = [...playerCells, ...this.occupied];
      const options = Object.values(VECTORS).map(delta => ({ x: dog.cell.x + delta.x, z: dog.cell.z + delta.z }))
        .filter(cell => cell.x >= 14 && cell.x <= 18 && cell.z >= 21 && cell.z <= 27
          && canWalk(cell, this.grid) && !isOccupied(cell, blocked));
      if (!options.length) continue;
      const next = options[Math.floor(this.random() * options.length)];
      dog.yaw = Math.atan2(next.x - dog.cell.x, next.z - dog.cell.z) * 180 / Math.PI;
      dog.from = dog.cell; dog.cell = next; dog.progress = 0;
    }
  }
}
