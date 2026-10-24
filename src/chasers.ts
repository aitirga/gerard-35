import { canWalk, facingToward, type Cell } from './movement.ts';

/**
 * Monsters that hunt the party through a scene (Uri's game, docs/quests/nuria.md § The maze):
 * each walks its round, and when it sees Gerard (close enough, nothing in between, and Gerard not
 * hiding) it runs at him. Lose it for a while and it gives up and walks back to its round; let it
 * reach you and the fight starts. Pure: the game moves the models and starts the fight.
 */
export interface ChaserSpec {
  id: string;
  /** Its round, in cells, walked in a loop. */
  patrol: readonly Cell[];
  /** How far it sees, in cells. */
  sight: number;
  /** Cells per second walking its round, and running after Gerard. */
  walk: number;
  run: number;
}
export type ChaserMode = 'patrol' | 'chase' | 'return' | 'resting';
export interface Chaser {
  spec: ChaserSpec;
  position: Cell;
  facing: number;
  mode: ChaserMode;
  /** The patrol point it is heading for. */
  next: number;
  /** Seconds it has not seen Gerard while chasing; seconds left resting. */
  timer: number;
}
/** What happened this frame, for the game to show. */
export type ChaserEvent = 'spotted' | 'lost' | 'caught' | undefined;

/** Seconds out of sight before a chaser gives up, and how long it rests after a fight it did not win. */
export const GIVE_UP = 2.6, REST = 5;
/** How close is caught, in cells. */
export const REACH = .9;

export function createChaser(spec: ChaserSpec): Chaser {
  return { spec, position: { ...spec.patrol[0] }, facing: 0, mode: 'patrol', next: 1 % spec.patrol.length, timer: 0 };
}

const dist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.z - b.z);
/** Whether nothing that blocks the way stands between `a` and `b` (walls, hedges, cabinets). */
export function clearLine(grid: readonly string[], a: Cell, b: Cell) {
  const d = dist(a, b), steps = Math.ceil(d / .3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!canWalk({ x: Math.round(a.x + (b.x - a.x) * t), z: Math.round(a.z + (b.z - a.z) * t) }, grid)) return false;
  }
  return true;
}
export function sees(chaser: Chaser, player: Cell, grid: readonly string[], hidden: boolean) {
  return !hidden && dist(chaser.position, player) <= chaser.spec.sight && clearLine(grid, chaser.position, player);
}
/** One step towards `target`, sliding along walls rather than stopping dead. */
function step(chaser: Chaser, target: Cell, speed: number, dt: number, grid: readonly string[]) {
  const d = dist(chaser.position, target);
  if (d < 1e-3) return;
  const move = Math.min(d, speed * dt), ux = (target.x - chaser.position.x) / d, uz = (target.z - chaser.position.z) / d;
  const free = (c: Cell) => canWalk({ x: Math.round(c.x), z: Math.round(c.z) }, grid);
  const both = { x: chaser.position.x + ux * move, z: chaser.position.z + uz * move };
  if (free(both)) chaser.position = both;
  else if (free({ x: both.x, z: chaser.position.z })) chaser.position = { x: both.x, z: chaser.position.z };
  else if (free({ x: chaser.position.x, z: both.z })) chaser.position = { x: chaser.position.x, z: both.z };
  chaser.facing = facingToward(ux, uz);
}

/**
 * Moves a chaser one frame. `hidden`: Gerard stands somewhere it cannot see him (the onion leaves,
 * under the tablecloth). Returns what changed, if anything.
 */
export function updateChaser(chaser: Chaser, dt: number, player: Cell, grid: readonly string[], hidden = false): ChaserEvent {
  const spec = chaser.spec;
  if (chaser.mode === 'resting') {
    chaser.timer -= dt;
    if (chaser.timer <= 0) chaser.mode = 'return';
    return undefined;
  }
  const seen = sees(chaser, player, grid, hidden);
  if (chaser.mode !== 'chase' && seen) { chaser.mode = 'chase'; chaser.timer = 0; return 'spotted'; }
  if (chaser.mode === 'chase') {
    chaser.timer = seen ? 0 : chaser.timer + dt;
    if (chaser.timer >= GIVE_UP) { chaser.mode = 'return'; return 'lost'; }
    step(chaser, player, spec.run, dt, grid);
    if (dist(chaser.position, player) <= REACH) return 'caught';
    return undefined;
  }
  // Back to its round, then round and round.
  const target = chaser.mode === 'return' ? spec.patrol.reduce((a, b) => dist(a, chaser.position) <= dist(b, chaser.position) ? a : b) : spec.patrol[chaser.next];
  step(chaser, target, spec.walk, dt, grid);
  if (dist(chaser.position, target) < .2) {
    if (chaser.mode === 'return') { chaser.mode = 'patrol'; chaser.next = (spec.patrol.indexOf(target) + 1) % spec.patrol.length; }
    else chaser.next = (chaser.next + 1) % spec.patrol.length;
  }
  return undefined;
}
/** After a fight the party walked away from: it stands still a while, then goes back to its round. */
export function rest(chaser: Chaser) { chaser.mode = 'resting'; chaser.timer = REST; }
