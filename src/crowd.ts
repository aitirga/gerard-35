import { canWalk, type Cell } from './movement.ts';

/**
 * Keeping everyone on the street out of each other (docs/crowd.md): Gerard and his partner, the
 * companions walking with them, the cats, the fears hunting the tower, the people standing about.
 * Each kind of body is a circle on the ground that gives way to others as much as it `give`s; two
 * bodies that overlap are eased apart, a little each frame, never into a wall. Pure: the game says
 * who is where (`add`), and `separate` moves those who can be moved.
 *
 * Anything with a `position` in cells can take part: a Follower, a Guide, a Wanderer, a Chaser, the
 * player's movement (read only), or a small adapter for a person standing on a cell.
 */
export interface Positioned { position: Cell }

/**
 * What a body is like: its radius in cells; how readily it gives way (0 never moves: the players,
 * someone standing still for the story; more is pushed further, against a body that gives less); and
 * the kinds it passes through instead of keeping clear of.
 */
export interface BodySpec { kind: BodyKind; radius: number; give: number; passes?: readonly BodyKind[] }
export type BodyKind = 'player' | 'person' | 'cat' | 'monster' | 'figure';

/** The kinds of body, ready to assign (`crowd.add(BODIES.cat, …)`). */
export const BODIES = {
  /** Gerard, and Aitor when a second player drives him: only their own input moves them. */
  player: { kind: 'player', radius: .34, give: 0 },
  /** A companion walking with the party (Aitor following, Bernat). */
  person: { kind: 'person', radius: .34, give: 1 },
  /** Haru and Yuki: small, and the first to step aside. */
  cat: { kind: 'cat', radius: .28, give: 1.6 },
  /** A fear hunting the party: it keeps clear of the others but must reach Gerard to start its fight. */
  monster: { kind: 'monster', radius: .42, give: .35, passes: ['player'] },
  /** Someone the story stands on a cell (Nuria at her door, the street dogs): others go round them. */
  figure: { kind: 'figure', radius: .36, give: 0 },
} as const satisfies Record<string, BodySpec>;

/** Cells per second a body is eased aside at most: quick enough to clear, slow enough to read as a step. */
export const PUSH_SPEED = 3.2;
/** Passes over the pairs each frame, so a body squeezed between two settles. */
const PASSES = 2;

interface Group { spec: BodySpec; members: () => Iterable<Positioned> }

export function createCrowd() {
  const groups = new Set<Group>();
  return {
    /**
     * Makes everyone `members` lists (asked afresh each frame, so it can follow who is here now)
     * a body of this kind. Returns how to take them out again.
     */
    add(spec: BodySpec, members: () => Iterable<Positioned>) {
      const group = { spec, members };
      groups.add(group);
      return () => { groups.delete(group); };
    },
    /** Eases overlapping bodies apart for a frame of `dt` seconds on `grid`; returns how far each one moved. */
    separate(dt: number, grid: readonly string[]) {
      const bodies: { owner: Positioned; spec: BodySpec }[] = [];
      for (const { spec, members } of groups) for (const owner of members()) bodies.push({ owner, spec });
      return separate(bodies, dt, grid);
    },
  };
}
export type Crowd = ReturnType<typeof createCrowd>;

/** Whether two kinds keep clear of each other. */
export function keepApart(a: BodySpec, b: BodySpec) {
  return !a.passes?.includes(b.kind) && !b.passes?.includes(a.kind) && (a.give > 0 || b.give > 0);
}

/** One frame of separation over `bodies` (see `createCrowd`). */
export function separate(bodies: readonly { owner: Positioned; spec: BodySpec }[], dt: number, grid: readonly string[]) {
  const budget = PUSH_SPEED * Math.min(Math.max(dt, 0), .1);
  const moved = new Map<Positioned, Cell>();
  const spent = new Map<Positioned, number>();
  for (let pass = 0; pass < PASSES; pass++) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.owner === b.owner || !keepApart(a.spec, b.spec)) continue;
    const pa = a.owner.position, pb = b.owner.position;
    let dx = pb.x - pa.x, dz = pb.z - pa.z;
    const d = Math.hypot(dx, dz), overlap = a.spec.radius + b.spec.radius - d;
    if (overlap <= 0) continue;
    // Standing on the very same spot: part along a fixed direction, so it never flickers.
    if (d < 1e-6) { const turn = (i * 2.399 + j * .7) % (Math.PI * 2); dx = Math.cos(turn); dz = Math.sin(turn); } else { dx /= d; dz /= d; }
    const share = a.spec.give + b.spec.give;
    nudge(a.owner, -dx, -dz, overlap * a.spec.give / share);
    nudge(b.owner, dx, dz, overlap * b.spec.give / share);
  }
  return moved;

  function nudge(owner: Positioned, dx: number, dz: number, amount: number) {
    const left = budget - (spent.get(owner) ?? 0);
    const step = Math.min(amount, left);
    if (step <= 1e-6) return;
    const from = owner.position;
    // Never into a wall: slide along it instead, or stay.
    const to = [{ x: from.x + dx * step, z: from.z + dz * step }, { x: from.x + dx * step, z: from.z }, { x: from.x, z: from.z + dz * step }]
      .find(p => canWalk({ x: Math.round(p.x), z: Math.round(p.z) }, grid));
    if (!to) return;
    owner.position = to;
    spent.set(owner, (spent.get(owner) ?? 0) + step);
    const total = moved.get(owner) ?? { x: 0, z: 0 };
    moved.set(owner, { x: total.x + to.x - from.x, z: total.z + to.z - from.z });
  }
}
