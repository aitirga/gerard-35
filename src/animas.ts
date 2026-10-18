/**
 * Ánimas (docs/lore.md, docs/chapter-2.md): what makes a friend who they are, a small light that
 * goes with Gerard when he helps them. Each one makes the party stronger and weakens La Reina
 * Bubbaloo's palace. Pure data; the story owns them as `anima-<id>` flags.
 * Provisional: the friends' missions are still to design, so names and bonuses are placeholders.
 */
import type { StatBonus } from './stats';

export interface Anima {
  id: string;
  /** Whose ánima it is. */
  friend: string;
  name: string;
  /** Its light: the colour it glows in Personaje (grey in the first round, docs/chapter-2.md). */
  colour: string;
  /** What it adds to everyone in the party. */
  bonus: StatBonus;
  note: string;
}

export const ANIMAS = {
  nuria: { id: 'nuria', friend: 'Nuria', name: 'Ánima de Nuria', colour: '#9fb4c8', bonus: { magia: 1, espiritu: 1, pv: 10 }, note: 'Cardedeu. Por diseñar con su historia.' },
  uri: { id: 'uri', friend: 'Uri', name: 'Ánima de Uri', colour: '#b9c79f', bonus: { fuerza: 1, defensa: 1, pv: 10 }, note: 'Cardedeu. Por diseñar con su historia.' },
} as const satisfies Record<string, Anima>;
export type AnimaId = keyof typeof ANIMAS;
export const ANIMA_IDS = Object.keys(ANIMAS) as AnimaId[];

/** Everything the party's ánimas add up to. */
export function animaBonus(ids: readonly AnimaId[]): StatBonus {
  const total: StatBonus = {};
  for (const id of ids) for (const [key, value] of Object.entries(ANIMAS[id].bonus) as [keyof StatBonus, number][]) total[key] = (total[key] ?? 0) + value;
  return total;
}
