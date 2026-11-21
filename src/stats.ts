/**
 * Character stats (docs/party.md). Provisional numbers, meant to be tuned: 10 is an ordinary
 * value, so chapter 1's kids and dogs fight exactly as before the stats existed, and every
 * formula below adds or takes away from a fixed base by how far a stat is from 10.
 * Campaign names adapt the generic combat formulas. Pure: no DOM or presentation engine.
 */
import { resolveDamage } from './combat/engine.ts';
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
  /**
   * The chance, in percent, that a blow is a golpe crítico (docs/animas/README.md § Golpe crítico):
   * 5 for the party, more from an ánima (Papagato). Foes have none: a foe's blow is one only if a
   * named move of its own says so.
   */
  critico: number;
}
export const STAT_LABELS: Record<keyof Stats, string> = {
  pv: 'PV', fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', critico: 'Crítico',
};
export const AVERAGE = 10;
/** The Crítico everyone in the party has before any ánima adds to it. */
export const PARTY_CRIT = 5;
const base = (pv: number, fuerza = AVERAGE, magia = AVERAGE, defensa = AVERAGE, espiritu = AVERAGE, critico = 0): Stats =>
  ({ pv, fuerza, magia, defensa, espiritu, critico });

/**
 * Who a fighter is underneath any class. Gerard has two: the boy of chapter 1 and the man of 35.
 * `gerard35` thinks and talks his way through (Magia, Espíritu); Aitor is the solid one (PV, Fuerza, Defensa).
 */
export const PROFILES = {
  gerard: base(100, AVERAGE, AVERAGE, AVERAGE, AVERAGE, PARTY_CRIT),
  bernat: base(85, AVERAGE, AVERAGE, AVERAGE, AVERAGE, PARTY_CRIT),
  gerard35: base(120, 11, 13, 10, 12, PARTY_CRIT),
  aitor: base(135, 13, 10, 12, 11, PARTY_CRIT),
  dog: base(54),
  minion: base(40),
  /** The palace guards of chapter 2: the stats of a wall. Their PV and hit depend on the party's ánimas (battle.ts). */
  guardian: base(220, 14, 10, 14, 12),
  /** Uri's fears in his maze (docs/quests/nuria.md): the onion, the covered dish and Vertitrón. */
  cebollon: base(150, 12, 10, 11, 10),
  /** La Cebolla: the same onion, between the little ones and El Cebollón (battle.ts ONIONS). */
  cebolla: base(110, 12, 10, 10, 10),
  plato: base(264, 12, 12, 11, 10),
  /**
   * Vertitrón and its eye (a part of it, an optional target: broken, no more Rayo; battle.ts VERTIGO).
   */
  vertigo: base(440, 18, 18, 10, 12),
  'vertigo-ojo': base(100, 10, 10, 9, 9),
  /** Their young, in twos and threes up the tower (docs/quests/nuria.md § The tower): little PV. The cebollitas are the easy ones. */
  cebollita: base(34, 11, 8, 9, 8),
  platito: base(68, 13, 12, 9, 9),
  fantasmita: base(71, 12, 13, 10, 9),
  /**
   * La Sobremesa's seven (docs/quests/universidad.md § Final boss), each a target of their own. Joan
   * and Soraya, who need each other, are the frailest; Nico, who shields the rest, the toughest.
   */
  'sobremesa-alvaro': base(78, 12, 10, 10, 10),
  'sobremesa-anna': base(72, 13, 10, 9, 10),
  'sobremesa-sarah': base(72, 10, 12, 10, 11),
  'sobremesa-miquel': base(81, 13, 10, 11, 10),
  'sobremesa-joan': base(62, 10, 13, 9, 9),
  'sobremesa-soraya': base(77, 10, 12, 9, 10),
  'sobremesa-nico': base(102, 10, 10, 13, 12),
  /**
   * Càmping Eurosport's foes (docs/quests/universidad.md § Càmping Eurosport): their rules do the work
   * (battle.ts CAMPING), so their stats stay near the average. El Campeón is the mini-boss.
   */
  mago: base(130, 10, 12, 9, 11),
  dado: base(48, 12, 8, 11, 9),
  agente: base(66, 12, 10, 10, 10),
  campeon: base(500, 14, 10, 13, 11),
  /**
   * Las cuerdas' foes (docs/quests/marta.md): their rules do the work (battle.ts MARTA). La Lealtad is
   * a wall, an Eco frail, Lo Cristalino has spirit to spare (magic does nothing to it anyway),
   * Lo Directo hits. La Voz is all of them, and hard to hit (only in her silences), but with little
   * Defensa and Espíritu: what finds her hurts (2026-11-21, `just fight-sim`).
   */
  lealtad: base(260, 12, 9, 15, 12),
  eco: base(50, 12, 12, 8, 8),
  cristalino: base(300, 10, 13, 10, 14),
  directo: base(440, 16, 10, 11, 10),
  voz: base(680, 12, 15, 5, 7),
  /**
   * The castle (docs/castle.md § Bestiary, docs/castle-bosses.md): the Queen's pupils in their first
   * year (src/castle.ts `CASTLE` scales the others), Aurelià and his lectern, one of Dirección, the
   * Queen and one of her hands. Their rules do the work (src/castle-fight.ts). First guesses.
   */
  repetidor: base(160, 14, 8, 12, 9),
  empollon: base(125, 11, 12, 10, 12),
  chivata: base(48, 9, 10, 8, 9),
  gemelo: base(62, 12, 9, 10, 10),
  delegada: base(150, 12, 12, 11, 12),
  // El Ausente reached one round in two; El Castigado broad, felled in one big blow after
  // what it could take; El Montón a lump that lasts: what it hits with is whatever the party shows it.
  ausente: base(140, 13, 9, 9, 9),
  castigado: base(160, 12, 9, 11, 10),
  monton: base(250, 12, 12, 10, 10),
  // 2026-11-21 (it was 420 PV, 14 Fuerza): it asks for ánimas. With Nuria's and one side mission's it is lost more
  // often than won; with two it can be won, and with all five it is won in some nine rounds (docs/fight-sim.md § Power and the castle).
  aurelia: base(500, 21, 11, 12, 12),
  atril: base(90, 1, 1, 10, 8),
  // Each of Mar, Montse and Pilar. 2026-11-21 (they were 160 PV, 13 Magia, 10 Defensa, 12 Espíritu): with three of the
  // four side missions' ánimas it is a coin, with fewer it is lost, with all of them it is won in some seven rounds.
  directiva: base(245, 10, 20, 12, 14),
  reina: base(620, 17, 17, 12, 13),
  mano: base(110, 12, 10, 11, 10),
  // La Pompa she blows: a thing to burst before it does. First guess.
  pompa: base(300, 1, 1, 9, 9),
  /**
   * The foes of Emilie's model (docs/quests/emilie.md § Fights): their rules do the work (battle.ts
   * MODELO). A Celda seca is a block; an Oscilación frail; El Átomo alone, heavy. El que
   * no converge is the boss.
   */
  'celda-seca': base(70, 10, 11, 11, 10),
  oscilacion: base(120, 10, 14, 9, 10),
  atomo: base(520, 11, 12, 10, 11),
  'no-converge': base(540, 12, 13, 11, 12),
  // Fran's salon (docs/quests/luca.md § Monsters): frail moths, patches of pattern and the restyled chaplains.
  polilla: base(52, 10, 8, 8, 8),
  'estampado-rojo': base(75, 12, 10, 11, 11),
  'estampado-azul': base(75, 12, 10, 11, 11),
  'estampado-oro': base(75, 12, 10, 11, 11),
  capellan: base(116, 12, 9, 9, 11),
  // Fran, under the Queen's hold, and the three lamps of the canopy he has made his chair's.
  fran: base(150, 13, 13, 12, 14),
  lampara: base(40, 8, 8, 8, 8),
} as const satisfies Record<string, Stats>;
export type ProfileId = keyof typeof PROFILES;

/** What a class adds on top of the fighter's own stats. */
export type StatBonus = Partial<Stats>;
export function withBonus(stats: Stats, bonus: StatBonus = {}): Stats {
  const out = { ...stats };
  // Crítico is a chance: it can be none at all, where every other stat never goes under 1.
  for (const key of Object.keys(bonus) as (keyof Stats)[]) out[key] = Math.max(key === 'critico' ? 0 : 1, out[key] + (bonus[key] ?? 0));
  return out;
}

/** Every attribute but Crítico (a chance) `share` larger: what the friends' ánimas do to the party (`ANIMA_GROWTH`, src/animas.ts). */
export function grown(stats: Stats, share = 0): Stats {
  if (!share) return stats;
  const out = { ...stats };
  for (const key of ['pv', 'fuerza', 'magia', 'defensa', 'espiritu'] as const) out[key] = Math.max(1, Math.round(out[key] * (1 + share)));
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
/**
 * A cure gives back a share of the PV of whoever gets it, whoever casts it (Aitor, 2026-11-21: «haz la
 * cura porcentual, un 50 %»): a skill of power `half` gives back half, and the rest in step with it
 * (leve about a quarter to a third, media about half, alta two thirds). A share and not points, so
 * that being cured is worth a turn at any point of the game: with few PV left, a cure is the margin.
 */
export const HEAL = { half: 30 };
export function healing(power: number, maxHp: number) {
  return Math.max(1, Math.round(maxHp * power / (2 * HEAL.half)));
}
