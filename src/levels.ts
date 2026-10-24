import type { ClassId } from './battle';

/**
 * Ánima levels (docs/animas/README.md § Levels): the more an ánima is worn in fights that are won,
 * the more it learns. Fights won count per ánima (both wearers count, once per fight) and live in
 * the browser; each level reached is a story flag (`<ánima>-2`, `<ánima>-3`), so it is saved and
 * follows the player. A story event can also grant a level by setting its flag. Pure.
 */
export const MAX_LEVEL = 3;
/** Fights won wearing it to reach level 2 and level 3. */
export const LEVEL_WINS = [3, 8] as const;
/** Ánimas that grow so far; the others stay at level 1 until they have their own tables. */
export const LEVELLED: readonly ClassId[] = ['papagato'];
export type LevelFlag = `${ClassId}-${2 | 3}`;
export const levelFlag = (id: ClassId, level: 2 | 3): LevelFlag => `${id}-${level}`;
/** The level `id` has reached, from the flags it holds. */
export function levelOf(id: ClassId, has: (flag: LevelFlag) => boolean) {
  return has(levelFlag(id, 3)) ? 3 : has(levelFlag(id, 2)) ? 2 : 1;
}
/** The level `wins` fights won earn (never below what the flags already give). */
export function levelForWins(wins: number) {
  return 1 + LEVEL_WINS.filter(needed => wins >= needed).length;
}
