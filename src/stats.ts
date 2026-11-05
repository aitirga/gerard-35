/**
 * Character stats (docs/party.md). Provisional numbers, meant to be tuned: 10 is an ordinary
 * value, so chapter 1's kids and dogs fight exactly as before the stats existed, and every
 * formula below adds or takes away from a fixed base by how far a stat is from 10.
 * Campaign names adapt the generic combat formulas. Pure: no DOM or presentation engine.
 */
import { resolveAmount, resolveDamage } from './combat/engine.ts';
export interface Stats {
  /** Puntos de vida. */
  pv: number;
  /** Physical hits: Atacar and the dogs' pushes. */
  fuerza: number;
  /** Magic hits and healing: Foc Binari. */
  magia: number;
  /** Takes away from physical hits. */
  defensa: number;
  /** Takes away from magic hits. */
  espiritu: number;
  /** Who acts first in the party's half of the round. */
  velocidad: number;
}
export const STAT_LABELS: Record<keyof Stats, string> = {
  pv: 'PV', fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', velocidad: 'Velocidad',
};
export const AVERAGE = 10;
const base = (pv: number, fuerza = AVERAGE, magia = AVERAGE, defensa = AVERAGE, espiritu = AVERAGE, velocidad = AVERAGE): Stats =>
  ({ pv, fuerza, magia, defensa, espiritu, velocidad });

/**
 * Who a fighter is underneath any class. Gerard has two: the boy of chapter 1 and the man of 35.
 * `gerard35` thinks and talks his way through (Magia, Espíritu); Aitor is the solid one (PV, Fuerza, Defensa).
 */
export const PROFILES = {
  gerard: base(100),
  bernat: base(85),
  gerard35: base(120, 11, 13, 10, 12, 11),
  aitor: base(135, 13, 10, 12, 11, 10),
  dog: base(54),
  minion: base(40),
  /** The palace guards of chapter 2: the stats of a wall. Their PV and hit depend on the party's ánimas (battle.ts). */
  guardian: base(220, 14, 10, 14, 12, 8),
  /** Uri's fears in his maze (docs/quests/nuria.md): the onion, the covered dish and Vertitrón. */
  cebollon: base(150, 12, 10, 11, 10, 8),
  /** La Cebolla: the same onion, between the little ones and El Cebollón (battle.ts ONIONS). */
  cebolla: base(110, 12, 10, 10, 10, 8),
  plato: base(260, 12, 12, 10, 10, 9),
  /**
   * Vertitrón and its eye (a part of it, an optional target: broken, no more Rayo; battle.ts VERTIGO).
   */
  vertigo: base(360, 13, 13, 12, 12, 9),
  'vertigo-ojo': base(100, 10, 10, 9, 9, 1),
  /** Their young, in twos and threes up the tower (docs/quests/nuria.md § The tower): little PV and quick. The cebollitas are the easy ones. */
  cebollita: base(34, 11, 8, 9, 8, 11),
  platito: base(68, 13, 12, 9, 9, 10),
  fantasmita: base(54, 12, 13, 8, 9, 13),
} as const satisfies Record<string, Stats>;
export type ProfileId = keyof typeof PROFILES;

/** What a class adds on top of the fighter's own stats. */
export type StatBonus = Partial<Stats>;
export function withBonus(stats: Stats, bonus: StatBonus = {}): Stats {
  const out = { ...stats };
  for (const key of Object.keys(bonus) as (keyof Stats)[]) out[key] = Math.max(1, out[key] + (bonus[key] ?? 0));
  return out;
}

/** A physical hit with `power` at average stats: Fuerza adds to it, the target's Defensa takes away. */
export function physical(power: number, attacker: Stats, target: Stats) {
  return resolveDamage({ base: power, actorStat: 'fuerza', targetStat: 'defensa', minimum: 1 }, { ...attacker }, { ...target });
}
/** A magic hit: Magia adds to it, the target's Espíritu takes away. */
export function magical(power: number, attacker: Stats, target: Stats) {
  return resolveDamage({ base: power, actorStat: 'magia', targetStat: 'espiritu', minimum: 1 }, { ...attacker }, { ...target });
}
/** Healing grows with Magia. */
export function healing(power: number, healer: Stats) {
  return resolveAmount({ base: power - AVERAGE, actorStat: 'magia', minimum: 1 }, { ...healer });
}
