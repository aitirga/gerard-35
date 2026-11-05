import { SKILLS, type BattleState, type ClassId, type FoeKind, type SkillId } from './battle.ts';

/**
 * Ánima levels (docs/animas/README.md § Levels): ánimas learn by fighting. Every foe beaten is worth
 * some experience (EXP, `FOE_XP`); when a fight is won, every ánima that took part in it (someone
 * acted wearing it, or was wearing it at the end) earns the fight's whole EXP: it is not split, so
 * changing ánima mid-fight never costs anyone anything. Enough EXP reaches the next level
 * (`LEVEL_XP`), and each level teaches the skills that name it (`level` in `SKILLS`).
 *
 * EXP per ánima lives in the browser; each level reached is a story flag (`<ánima>-2`,
 * `<ánima>-3`), so it is saved and follows the player, and a story event can grant a level by
 * setting its flag (the EXP then starts from that level's floor). Pure.
 */
export const MAX_LEVEL = 3;
/** EXP to reach level 2 and level 3, counted from zero: three times the first tuning (2026-11-05), so an ánima grows slowly. */
export const LEVEL_XP = [180, 660] as const;
/** Ánimas that grow; one without its own level table would stay at level 1. */
export const LEVELLED: readonly ClassId[] = ['matemagico', 'papagato'];
/**
 * What each foe is worth when it is beaten. Roughly how long it takes to bring down: some seven packs
 * of cebollitas (20 to 30 EXP each), or El Cebollón and five packs, teach Papagato Zarpazos.
 */
export const FOE_XP: Record<FoeKind, number> = {
  dog: 8, minion: 30, guardian: 40,
  cebollita: 10, platito: 14, fantasmita: 14,
  cebolla: 35, cebollon: 60, plato: 45, vertigo: 90,
  // The eye is part of Vertitrón: nothing of its own.
  'vertigo-ojo': 0,
};
export type LevelFlag = `${ClassId}-${2 | 3}`;
export const levelFlag = (id: ClassId, level: 2 | 3): LevelFlag => `${id}-${level}`;
/** The level `id` has reached, from the flags it holds. */
export function levelOf(id: ClassId, has: (flag: LevelFlag) => boolean) {
  return has(levelFlag(id, 3)) ? 3 : has(levelFlag(id, 2)) ? 2 : 1;
}
/** The EXP a level starts at (0 for level 1). */
export const xpFloor = (level: number) => level <= 1 ? 0 : LEVEL_XP[Math.min(level, MAX_LEVEL) - 2];
/** The level `xp` EXP reach. */
export function levelForXp(xp: number) {
  return 1 + LEVEL_XP.filter(needed => xp >= needed).length;
}
/** How far through its level `xp` is (0–1); 1 at the top level. */
export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const from = xpFloor(level), to = xpFloor(level + 1);
  return Math.max(0, Math.min(1, (xp - from) / (to - from)));
}
/** The skills `id` learns on reaching `level`. */
export const skillsAt = (id: ClassId, level: number): SkillId[] => SKILLS.filter(skill => skill.class === id && 'level' in skill && skill.level === level).map(skill => skill.id);

/** What a won fight is worth: every foe's EXP, plus whatever development adds (`extraXp`). */
export function fightXp(state: Pick<BattleState, 'foes' | 'extraXp'>) {
  return state.foes.reduce((sum, foe) => sum + (foe.kind ? FOE_XP[foe.kind] : 0), 0) + (state.extraXp ?? 0);
}
/**
 * The ánimas that took part in the fight, in the order they are unlocked, with who wore them:
 * whoever acted wearing one (`fought`), and whoever is still standing wearing one at the end.
 */
export function participants(state: Pick<BattleState, 'allies' | 'animas' | 'fought'>): { id: ClassId; wearers: string[] }[] {
  const wearers = new Map<ClassId, Set<string>>();
  const add = (id: ClassId, who: string) => { if (!wearers.has(id)) wearers.set(id, new Set()); wearers.get(id)!.add(who); };
  for (const [id, who] of Object.entries(state.fought ?? {}) as [ClassId, string[]][]) who.forEach(name => add(id, name));
  for (const ally of state.allies) if (ally.classId && ally.hp > 0) add(ally.classId, ally.id);
  const order = (id: ClassId) => { const i = state.animas.indexOf(id); return i < 0 ? Infinity : i; };
  return [...wearers].sort(([a], [b]) => order(a) - order(b)).map(([id, who]) => ({ id, wearers: state.allies.map(a => a.id).filter(name => who.has(name)) }));
}
/** How one ánima grew from a fight: its EXP and level before and after, and what it learned. */
export interface Growth { id: ClassId; xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number; learned: SkillId[] }
/**
 * `gained` EXP for each of `ids`, starting from the EXP they have (`xp`) and never below the floor
 * of the level they hold (`levels`: a level granted by the story, or an old save). An ánima at the
 * top level keeps its EXP where it is. Pure: the fight shows it and the story keeps it.
 */
export function award(ids: readonly ClassId[], gained: number, xp: Partial<Record<ClassId, number>>, levels: Partial<Record<ClassId, number>>): Growth[] {
  return [...new Set(ids)].filter(id => LEVELLED.includes(id)).map(id => {
    const levelBefore = Math.max(1, Math.min(MAX_LEVEL, levels[id] ?? 1));
    const xpBefore = Math.max(xp[id] ?? 0, xpFloor(levelBefore));
    const xpAfter = levelBefore >= MAX_LEVEL ? xpBefore : Math.max(xpBefore, xpBefore + Math.max(0, gained));
    const levelAfter = Math.max(levelBefore, Math.min(MAX_LEVEL, levelForXp(xpAfter)));
    const learned: SkillId[] = [];
    for (let level = levelBefore + 1; level <= levelAfter; level++) learned.push(...skillsAt(id, level));
    return { id, xpBefore, xpAfter, levelBefore, levelAfter, learned };
  });
}
/** Development: the EXP that takes `id` from where it is to its next level (0 at the top). */
export function toNextLevel(xp: number, level: number) {
  const from = Math.max(xp, xpFloor(level));
  return level >= MAX_LEVEL ? 0 : Math.max(0, xpFloor(level + 1) - from);
}
