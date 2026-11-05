import { facingToward, type Cell } from './movement.ts';
import { pathTo } from './follower.ts';

/**
 * Someone in the world who leads the party somewhere (Haru, from Cardedeu station to Nuria's door,
 * docs/quests/nuria.md § Converge check): it walks the way ahead of Gerard, stops and looks back
 * when he falls behind, goes on when he comes close, and sits at the end. A cat as a guide, no
 * arrow. Pure: the game draws it.
 */
export interface Guide { position: Cell; facing: number; walking: boolean; waiting: boolean; arrived: boolean; path: Cell[]; speed: number }
/**
 * Cells per second walking and hurrying (Gerard pressing on), how far behind Gerard can fall
 * before it stops to wait, how close he must come for it to go on, how close counts as right
 * behind, how far to one side he can walk level with it and still press it on, and how many
 * seconds it takes to change pace.
 */
export const GUIDE = { walk: 3.4, hurry: 5.8, wait: 7, resume: 4.5, close: 2.4, side: 4, ease: .25 } as const;

/** A guide at `from` that will walk to `to` (it stays put if there is no way). */
export function createGuide(grid: readonly string[], from: Cell, to: Cell): Guide {
  return { position: { ...from }, facing: 0, walking: false, waiting: true, arrived: false, path: pathTo(grid, from, to), speed: GUIDE.walk };
}

/** Moves the guide on by `dt` seconds with Gerard at `leader`; says `arrived` the moment it gets there. */
export function updateGuide(guide: Guide, dt: number, leader: Cell): 'arrived' | undefined {
  guide.walking = false;
  const dx = leader.x - guide.position.x, dz = leader.z - guide.position.z, apart = Math.hypot(dx, dz);
  const lookBack = () => { if (apart > .3) guide.facing = facingToward(dx, dz); };
  if (guide.arrived) { lookBack(); return undefined; }
  // Waiting: it turns to Gerard until he comes close; left too far behind, it stops and waits.
  if (guide.waiting ? apart > GUIDE.resume : apart > GUIDE.wait) { guide.waiting = true; lookBack(); return undefined; }
  guide.waiting = false;
  // Gerard presses it on from right behind, and also walking level with it or ahead of it to one
  // side: only when he trails it does it keep its own pace. The pace eases, never jumps.
  const next = guide.path[0], hx = next ? next.x - guide.position.x : 0, hz = next ? next.z - guide.position.z : 0, ahead = Math.hypot(hx, hz);
  const along = ahead ? (dx * hx + dz * hz) / ahead : -apart, side = ahead ? Math.abs(dx * hz - dz * hx) / ahead : 0;
  const pressed = apart < GUIDE.close || (along > -GUIDE.close && side < GUIDE.side);
  const step = Math.min(Math.max(dt, 0), .1);
  guide.speed += ((pressed ? GUIDE.hurry : GUIDE.walk) - guide.speed) * (1 - Math.exp(-step / GUIDE.ease));
  let budget = guide.speed * step;
  while (budget > 0 && guide.path.length) {
    const target = guide.path[0];
    const tx = target.x - guide.position.x, tz = target.z - guide.position.z, d = Math.hypot(tx, tz);
    if (d <= budget) { guide.position = { ...target }; guide.path.shift(); budget -= d; continue; }
    guide.position = { x: guide.position.x + tx / d * budget, z: guide.position.z + tz / d * budget };
    guide.facing = facingToward(tx, tz);
    guide.walking = true;
    budget = 0;
  }
  if (guide.path.length) return undefined;
  guide.arrived = true; lookBack();
  return 'arrived';
}
