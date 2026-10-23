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
  /** Secundaria: what skills spend. */
  sec: number;
  /** Physical hits: Atacar and the dogs' pushes. */
  fuerza: number;
  /** Magic hits and healing: No-ta, Cardioide. */
  magia: number;
  /** Takes away from physical hits. */
  defensa: number;
  /** Takes away from magic hits. */
  espiritu: number;
  /** Who acts first in the party's half of the round. */
  velocidad: number;
}
export const STAT_LABELS: Record<keyof Stats, string> = {
  pv: 'PV', sec: 'Secundaria', fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', velocidad: 'Velocidad',
};
export const AVERAGE = 10;
const base = (pv: number, sec: number, fuerza = AVERAGE, magia = AVERAGE, defensa = AVERAGE, espiritu = AVERAGE, velocidad = AVERAGE): Stats =>
  ({ pv, sec, fuerza, magia, defensa, espiritu, velocidad });

/**
 * Who a fighter is underneath any class. Gerard has two: the boy of chapter 1 and the man of 35.
 * `gerard35` thinks and talks his way through (Magia, Espíritu); Aitor is the solid one (PV, Fuerza, Defensa).
 */
export const PROFILES = {
  gerard: base(100, 30),
  bernat: base(85, 24),
  gerard35: base(120, 36, 11, 13, 10, 12, 11),
  aitor: base(135, 30, 13, 10, 12, 11, 10),
  dog: base(54, 0),
  minion: base(40, 0),
  /** The palace guards of chapter 2: the stats of a wall. Their PV and hit depend on the party's ánimas (battle.ts). */
  guardian: base(220, 0, 14, 10, 14, 12, 8),
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
