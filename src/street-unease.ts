import type { Cell } from './movement';

/**
 * La calle que no acaba (docs/quests/nuria.md): how far up the street the party is, and what that
 * does to it. The rules are pure (tested in tests/nuria.test.mjs); the portal at its end is drawn in
 * src/fear-portal.ts.
 */

/** 0 at the street's start, 1 at the bubble; only the way along the street counts. */
export function streetProgress(at: { x: number; z: number }, from: Cell, to: Cell): number {
  const dx = to.x - from.x, dz = to.z - from.z, length = dx * dx + dz * dz;
  if (!length) return 1;
  return Math.min(1, Math.max(0, ((at.x - from.x) * dx + (at.z - from.z) * dz) / length));
}

/**
 * How much of the Queen's light falls on the street: a little the moment they step in, most of it
 * at the bubble, never all (the tower is hers; here they still have to see where they walk). Eased,
 * so the first stretch still looks like Cardedeu and the last one does not.
 */
export function streetTone(progress: number) { return .12 + .58 * progress * progress * (3 - 2 * progress); }

/** The next of the street's lines that is due at this progress and not said yet, by index. */
export function dueMark(marks: readonly { at: number }[], progress: number, said: ReadonlySet<number>): number | undefined {
  const i = marks.findIndex((m, i) => !said.has(i) && progress >= m.at);
  return i < 0 ? undefined : i;
}
