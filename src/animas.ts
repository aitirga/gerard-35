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
  // Nuria and Uri's mission is one (docs/quests/nuria.md): one household, one ánima.
  nuria: { id: 'nuria', friend: 'Nuria y Uri', name: 'Ánima de Nuria y Uri', colour: '#9fb4c8', bonus: { magia: 1, espiritu: 1, pv: 10 }, note: 'Cardedeu. Por diseñar con su historia.' },
  // The university friends (docs/quests/universidad.md): one mission, one ánima, still to design with /anima.
  universidad: { id: 'universidad', friend: 'Los amigos de la uni', name: 'Ánima de los amigos de la uni', colour: '#a8a89a', bonus: { fuerza: 1, espiritu: 1, pv: 10 }, note: 'La Barceloneta y el Càmping Eurosport. Por diseñar.' },
  // Marta (docs/quests/marta.md): her voice back. The wearable ánima is still to design with /anima.
  marta: { id: 'marta', friend: 'Marta', name: 'Ánima de Marta', colour: '#9fb8b4', bonus: { espiritu: 1, defensa: 1, pv: 10 }, note: 'Alegia y Las cuerdas. Por diseñar.' },
  // Emilie (docs/quests/emilie.md): the why back. Freática is its wearable form (docs/animas/freatica/README.md).
  emilie: { id: 'emilie', friend: 'Emilie', name: 'Ánima de Emilie', colour: '#a3aea2', bonus: { magia: 1, defensa: 1, pv: 10 }, note: 'Poble Sec y su modelo. Freática.' },
  // Luca (docs/quests/luca.md): his colours back. Colorista is its wearable form (docs/animas/prismatico/README.md).
  luca: { id: 'luca', friend: 'Luca', name: 'Ánima de Luca', colour: '#b3aea6', bonus: { magia: 1, defensa: 1, pv: 10 }, note: 'La Sagrada Família. Colorista.' },
} as const satisfies Record<string, Anima>;
export type AnimaId = keyof typeof ANIMAS;
export const ANIMA_IDS = Object.keys(ANIMAS) as AnimaId[];

/**
 * How the party's attributes grow with the ánimas it has gathered, on top of each one's own `bonus`
 * (docs/fight-sim.md § Progression): `scale` multiplies every listed bonus, and each ánima adds
 * `pv` PV and `stat` to Fuerza, Magia, Defensa and Espíritu. Each friend freed is a point of all
 * four (2026-11-21, it was 0): with blows that add and subtract attributes, five friends are five
 * more on every blow and five less on every one taken, which is what makes the first missions' foes
 * fall in a round or two by the end and the castle ask for ánimas (docs/fight-sim.md § Power and
 * the castle). Tunable (`--tune growth.rules.scale=0:1:2`, `growth.rules.stat=0:1`).
 */
export const ANIMA_GROWTH = { scale: 1, pv: 0, stat: 1 };
const GROWN: (keyof StatBonus)[] = ['fuerza', 'magia', 'defensa', 'espiritu'];
/** Everything the party's ánimas add up to. */
export function animaBonus(ids: readonly AnimaId[]): StatBonus {
  const total: StatBonus = {};
  const add = (key: keyof StatBonus, value: number) => { if (value) total[key] = (total[key] ?? 0) + value; };
  for (const id of ids) {
    for (const [key, value] of Object.entries(ANIMAS[id].bonus) as [keyof StatBonus, number][]) add(key, value * ANIMA_GROWTH.scale);
    add('pv', ANIMA_GROWTH.pv);
    for (const key of GROWN) add(key, ANIMA_GROWTH.stat);
  }
  for (const key of Object.keys(total) as (keyof StatBonus)[]) total[key] = Math.round(total[key]!);
  return total;
}

/**
 * How threatening La Reina Bubbaloo's castle is, from 1 (every tower up, a storm over it) down to
 * a floor it never goes below: each ánima the party gathers takes some of her power away.
 */
export const THREAT_PER_ANIMA = .15;
export function castleThreat(animas: number) { return Math.max(.1, 1 - animas * THREAT_PER_ANIMA); }
