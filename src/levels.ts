import { MANA_LEVEL, PASSIVES, SKILLS, type BattleState, type ClassId, type FoeKind, type PassiveId, type SkillId } from './battle.ts';

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
/** The game's top level; an ánima's own top is `topOf` (the highest level its skills name). */
export const MAX_LEVEL = 7;
/**
 * EXP to reach levels 2 to 7, counted from zero. The first two are three times the first tuning
 * (2026-11-05), so an ánima grows slowly; 4 to 7 are a first guess (2026-11-20), each step some 150
 * EXP longer than the one before, left to the balance.
 */
export const LEVEL_XP = [180, 660, 1290, 2070, 3000, 4080] as const;
/**
 * Ánimas that grow by level: the shared ones. Matemágico and Tecnópata are someone's own and grow by
 * their tree at the jar instead (src/ecos.ts; docs/animas/README.md § Two ways to grow). Each grows
 * as far as it has been designed: Papagato, Dadista, Colorista, Sincopante and Freática to 7 (`topOf`).
 */
export const LEVELLED: readonly ClassId[] = ['papagato', 'dadaista', 'prismatico', 'sincopante', 'freatica'];
/**
 * Levels that teach nothing yet, on purpose: Dadista's 6 is empty since Estrella fugaz moved to 3,
 * and is not filled out of habit (docs/animas/dadaista/README.md § Skills per level).
 */
export const EMPTY_LEVELS: Partial<Record<ClassId, readonly number[]>> = { dadaista: [6] };
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
  // La Sobremesa: each friend freed is worth the same.
  'sobremesa-alvaro': 16, 'sobremesa-anna': 16, 'sobremesa-sarah': 16, 'sobremesa-miquel': 16,
  'sobremesa-joan': 16, 'sobremesa-soraya': 16, 'sobremesa-nico': 16,
  // Càmping Eurosport: the small fights of the dungeon, and its mini-boss.
  mago: 14, dado: 10, agente: 12, campeon: 70,
  // Las cuerdas: a quality each platform, and La Voz at the centre.
  lealtad: 40, eco: 12, cristalino: 45, directo: 50, voz: 110,
  // The castle: the Queen's pupils, and her bosses. A lectern and a hand are things: nothing of their own.
  repetidor: 22, empollon: 20, chivata: 14, gemelo: 14, delegada: 40, ausente: 18, castigado: 20, monton: 22,
  aurelia: 140, atril: 0, directiva: 60, reina: 0, mano: 0,
  // Emilie's model: the section's small fights, and El que no converge at the bottom.
  'celda-seca': 12, oscilacion: 18, atomo: 20, 'no-converge': 100,
  polilla: 6, 'estampado-rojo': 22, 'estampado-azul': 22, 'estampado-oro': 22, capellan: 16, fran: 120, lampara: 0,
};
export type Level = 2 | 3 | 4 | 5 | 6 | 7;
export type LevelFlag = `${ClassId}-${Level}`;
export const levelFlag = (id: ClassId, level: Level): LevelFlag => `${id}-${level}`;
export { MANA_LEVEL };
/** The top level of `id`: the highest its skills name (1 for an ánima that grows by its tree). */
export const topOf = (id: ClassId) => !LEVELLED.includes(id) ? 1
  : Math.min(MAX_LEVEL, Math.max(1, ...SKILLS.map(skill => skill.class === id && 'level' in skill && skill.level ? skill.level : 1)));
/**
 * How far `id` can grow now: its own top, or the castle's cap if that is lower (src/castle.ts
 * `levelCap`; docs/animas/README.md § Growth opens with the castle). A cap reached is not the top:
 * the EXP goes on being kept, and gives its levels once the cap rises.
 */
export const reachOf = (id: ClassId, cap: number = MAX_LEVEL) => Math.min(topOf(id), cap);
/** The level `id` has reached, from the flags it holds: the highest one, so a story event can grant any. */
export function levelOf(id: ClassId, has: (flag: LevelFlag) => boolean) {
  for (let level = MAX_LEVEL; level > 1; level--) if (has(levelFlag(id, level as Level))) return level;
  return 1;
}
/** The EXP a level starts at (0 for level 1). */
export const xpFloor = (level: number) => level <= 1 ? 0 : LEVEL_XP[Math.min(level, MAX_LEVEL) - 2];
/** The level `xp` EXP reach, never past `top`. */
export function levelForXp(xp: number, top: number = MAX_LEVEL) {
  return Math.min(top, 1 + LEVEL_XP.filter(needed => xp >= needed).length);
}
/** How far through its level `xp` is (0–1); 1 at the top level (`top`: the ánima's own). */
export function levelProgress(xp: number, top: number = MAX_LEVEL) {
  const level = levelForXp(xp, top);
  if (level >= top) return 1;
  const from = xpFloor(level), to = xpFloor(level + 1);
  return Math.max(0, Math.min(1, (xp - from) / (to - from)));
}
/** The skills `id` learns on reaching `level`. */
export const skillsAt = (id: ClassId, level: number): SkillId[] => SKILLS.filter(skill => skill.class === id && 'level' in skill && skill.level === level).map(skill => skill.id);
/** The passives that come with `level` of `id` (Colorista's Remolino), as far as the ánima grows. */
export const passivesAt = (id: ClassId, level: number): PassiveId[] => level > topOf(id) ? [] : (Object.keys(PASSIVES) as PassiveId[]).filter(passive => PASSIVES[passive].anima === id && PASSIVES[passive].level === level);

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
/**
 * How one ánima grew from a fight: its EXP and level before and after, what it learned, and how far
 * it could grow (`reach`: its top, or the castle's cap below it).
 */
export interface Growth { id: ClassId; xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number; reach: number; learned: SkillId[]; passives?: PassiveId[] }
/**
 * `gained` EXP for each of `ids`, starting from the EXP they have (`xp`) and never below the floor
 * of the level they hold (`levels`: a level granted by the story, or an old save). An ánima at its
 * top level keeps its EXP where it is; one held at the castle's `cap` goes on keeping what it earns,
 * so `gained` 0 with a higher cap gives the levels that EXP was already worth. Pure: the fight shows
 * it and the story keeps it.
 */
export function award(ids: readonly ClassId[], gained: number, xp: Partial<Record<ClassId, number>>, levels: Partial<Record<ClassId, number>>, cap: number = MAX_LEVEL): Growth[] {
  return [...new Set(ids)].filter(id => LEVELLED.includes(id)).map(id => {
    const top = topOf(id), reach = reachOf(id, cap), levelBefore = Math.max(1, Math.min(top, levels[id] ?? 1));
    const xpBefore = Math.max(xp[id] ?? 0, xpFloor(levelBefore));
    const xpAfter = levelBefore >= top ? xpBefore : Math.max(xpBefore, xpBefore + Math.max(0, gained));
    const levelAfter = Math.max(levelBefore, levelForXp(xpAfter, reach));
    const learned: SkillId[] = [], passives: PassiveId[] = [];
    for (let level = levelBefore + 1; level <= levelAfter; level++) { learned.push(...skillsAt(id, level)); passives.push(...passivesAt(id, level)); }
    return { id, xpBefore, xpAfter, levelBefore, levelAfter, reach, learned, ...passives.length ? { passives } : {} };
  });
}
/** Development: the EXP that takes `id` from where it is to its next level (0 at the top). */
export function toNextLevel(xp: number, level: number, top: number = MAX_LEVEL) {
  const from = Math.max(xp, xpFloor(level));
  return level >= top ? 0 : Math.max(0, xpFloor(level + 1) - from);
}
