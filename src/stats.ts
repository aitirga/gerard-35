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
  vertigo: base(415, 13, 13, 12, 12, 9),
  'vertigo-ojo': base(100, 10, 10, 9, 9, 1),
  /** Their young, in twos and threes up the tower (docs/quests/nuria.md § The tower): little PV and quick. The cebollitas are the easy ones. */
  cebollita: base(34, 11, 8, 9, 8, 11),
  platito: base(68, 13, 12, 9, 9, 10),
  fantasmita: base(54, 12, 13, 8, 9, 13),
  /**
   * La Sobremesa's seven (docs/quests/universidad.md § Final boss), each a target of their own. Joan
   * and Soraya, who need each other, are the frailest; Nico, who shields the rest, the toughest.
   */
  'sobremesa-alvaro': base(91, 12, 10, 10, 10, 9),
  'sobremesa-anna': base(84, 13, 10, 9, 10, 10),
  'sobremesa-sarah': base(84, 10, 12, 10, 11, 9),
  'sobremesa-miquel': base(95, 13, 10, 11, 10, 9),
  'sobremesa-joan': base(72, 10, 13, 9, 9, 9),
  'sobremesa-soraya': base(77, 10, 12, 9, 10, 9),
  'sobremesa-nico': base(102, 10, 10, 13, 12, 8),
  /**
   * Càmping Eurosport's foes (docs/quests/universidad.md § Càmping Eurosport): their rules do the work
   * (battle.ts CAMPING), so their stats stay near the average. El Campeón is the mini-boss.
   */
  mago: base(130, 10, 12, 9, 11, 10),
  dado: base(44, 12, 8, 11, 9, 9),
  agente: base(66, 12, 10, 10, 10, 10),
  campeon: base(380, 14, 10, 12, 11, 9),
  /**
   * Las cuerdas' foes (docs/quests/marta.md): their rules do the work (battle.ts MARTA). La Lealtad is
   * a wall, an Eco frail and quick, Lo Cristalino has spirit to spare (magic does nothing to it anyway),
   * Lo Directo hits. La Voz is all of them.
   */
  lealtad: base(225, 12, 9, 14, 12, 7),
  eco: base(50, 12, 12, 8, 8, 12),
  cristalino: base(300, 10, 13, 10, 14, 10),
  directo: base(420, 14, 10, 11, 10, 11),
  voz: base(430, 12, 13, 12, 12, 10),
  /**
   * The castle (docs/castle.md § Bestiary, docs/castle-bosses.md): the Queen's pupils in their first
   * year (src/castle.ts `CASTLE` scales the others), Aurelià and his lectern, one of Dirección, the
   * Queen and one of her hands. Their rules do the work (src/castle-fight.ts). First guesses.
   */
  repetidor: base(110, 14, 8, 12, 9, 6),
  empollon: base(85, 11, 12, 10, 12, 10),
  chivata: base(48, 9, 10, 8, 9, 13),
  gemelo: base(62, 12, 9, 10, 10, 10),
  delegada: base(130, 12, 12, 11, 12, 10),
  aurelia: base(420, 14, 11, 12, 12, 10),
  atril: base(90, 1, 1, 10, 8, 1),
  directiva: base(160, 10, 13, 10, 12, 10),
  reina: base(620, 14, 14, 12, 13, 10),
  mano: base(110, 12, 10, 11, 10, 8),
  /**
   * The foes of Emilie's model (docs/quests/emilie.md § Fights): their rules do the work (battle.ts
   * MODELO). A Celda seca is a block, slow; an Oscilación quick and frail; La pluma only wets. El que
   * no converge is the boss.
   */
  'celda-seca': base(70, 10, 11, 11, 10, 8),
  oscilacion: base(110, 10, 12, 9, 10, 12),
  pluma: base(90, 9, 11, 9, 11, 10),
  'no-converge': base(520, 12, 13, 11, 12, 10),
  // Fran's salon (docs/quests/luca.md § Monsters): frail moths, patches of pattern, a brass telescope,
  // a cloud of hairspray and the restyled chaplains.
  polilla: base(28, 10, 8, 8, 8, 13),
  'estampado-rojo': base(100, 12, 10, 11, 11, 9),
  'estampado-azul': base(100, 12, 10, 11, 11, 9),
  'estampado-oro': base(100, 12, 10, 11, 11, 9),
  telescopio: base(300, 10, 13, 12, 12, 8),
  laca: base(120, 8, 12, 8, 10, 9),
  capellan: base(100, 12, 9, 10, 10, 10),
  // Fran, under the Queen's hold, and the three lamps of the canopy he has made his chair's.
  fran: base(260, 13, 13, 12, 12, 10),
  lampara: base(40, 8, 8, 8, 8, 1),
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
