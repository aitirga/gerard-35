/**
 * Pica pared (docs/castle.md § The closed doors): the third floor's closed door. A great Castigado
 * stands against it, face to the wall, counting. While it counts, the room can be crossed; it turns
 * round with no more warning than its shoulders rising, and whoever it sees moving is put back at the
 * door they came in by. Whoever reaches the wall beside it has won, and it stops counting for good
 * (the story hears that: src/castle-story.ts). Running is heard: it turns at once.
 * Pure: the rules of the count, no engine here (src/game.ts stands it in the room and moves it).
 */
export const PICA = {
  /** How long it counts with its back to the room, in seconds (walking covers some five cells a second). */
  away: [.6, 1.25] as const,
  /** Its shoulders rise this long before it turns: the only warning. */
  tell: .4,
  /** How long it looks. */
  look: [1.3, 2.2] as const,
  /** Once it has turned, how long whoever was walking has to stop. */
  grace: .14,
  /** Somebody running is heard: it has no more than this left of its count. */
  heard: .12,
  /** It keeps looking this long after catching someone. */
  after: .7,
  /** Nobody is watched this near the door they came in by, in cells. */
  line: 1.6,
} as const;
export type PicaPhase = 'away' | 'tell' | 'look';
export interface Pica { phase: PicaPhase; left: number; since: number; seed: number; caught: number }
/** Whoever is in the room: whether they are past the line, moving, and running. */
export interface PicaWalker { watched: boolean; moving: boolean; running: boolean }

const roll = (pica: Pica) => { pica.seed = (Math.imul(pica.seed, 1664525) + 1013904223) >>> 0; return pica.seed / 4294967296; };
const between = (pica: Pica, [low, high]: readonly [number, number]) => low + (high - low) * roll(pica);
export function createPica(seed: number): Pica {
  const pica: Pica = { phase: 'away', left: 0, since: 0, seed: seed >>> 0, caught: 0 };
  pica.left = between(pica, PICA.away);
  return pica;
}
/**
 * One frame of the count. Returns the phase it has just turned to, if it has, and who it has caught
 * (their places in `walkers`): each of them goes back to the door.
 */
export function stepPica(pica: Pica, dt: number, walkers: readonly PicaWalker[]): { turned?: PicaPhase; caught: number[] } {
  const caught: number[] = [];
  let turned: PicaPhase | undefined;
  pica.since += dt; pica.left -= dt;
  if (pica.phase === 'away') {
    if (walkers.some(w => w.watched && w.moving && w.running)) pica.left = Math.min(pica.left, PICA.heard);
    if (pica.left <= 0) { pica.phase = turned = 'tell'; pica.left = PICA.tell; pica.since = 0; }
  } else if (pica.phase === 'tell') {
    if (pica.left <= 0) { pica.phase = turned = 'look'; pica.left = between(pica, PICA.look); pica.since = 0; }
  } else {
    if (pica.since >= PICA.grace) walkers.forEach((w, i) => { if (w.watched && w.moving) caught.push(i); });
    if (caught.length) { pica.caught += caught.length; pica.left = Math.min(pica.left, PICA.after); }
    if (pica.left <= 0) { pica.phase = turned = 'away'; pica.left = between(pica, PICA.away); pica.since = 0; }
  }
  return { ...turned ? { turned } : {}, caught };
}
