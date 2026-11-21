/**
 * Ánimas (docs/lore.md, docs/chapter-2.md): what makes a friend who they are, a small light that
 * goes with Gerard when he helps them. Each one makes the party stronger and weakens La Reina
 * Bubbaloo's palace. Pure data; the story owns them as `anima-<id>` flags.
 * Provisional: the friends' missions are still to design, so names and bonuses are placeholders.
 */
export interface Anima {
  id: string;
  /** Whose ánima it is. */
  friend: string;
  name: string;
  /** Its light: the colour it glows in Personaje (grey in the first round, docs/chapter-2.md). */
  colour: string;
  note: string;
}

export const ANIMAS = {
  // Nuria and Uri's mission is one (docs/quests/nuria.md): one household, one ánima.
  nuria: { id: 'nuria', friend: 'Nuria y Uri', name: 'Ánima de Nuria y Uri', colour: '#9fb4c8', note: 'Cardedeu. Por diseñar con su historia.' },
  // The university friends (docs/quests/universidad.md): one mission, one ánima, still to design with /anima.
  universidad: { id: 'universidad', friend: 'Los amigos de la uni', name: 'Ánima de los amigos de la uni', colour: '#a8a89a', note: 'La Barceloneta y el Càmping Eurosport. Por diseñar.' },
  // Marta (docs/quests/marta.md): her voice back. The wearable ánima is still to design with /anima.
  marta: { id: 'marta', friend: 'Marta', name: 'Ánima de Marta', colour: '#9fb8b4', note: 'Alegia y Las cuerdas. Por diseñar.' },
  // Emilie (docs/quests/emilie.md): the why back. Freática is its wearable form (docs/animas/freatica/README.md).
  emilie: { id: 'emilie', friend: 'Emilie', name: 'Ánima de Emilie', colour: '#a3aea2', note: 'Poble Sec y su modelo. Freática.' },
  // Luca (docs/quests/luca.md): his colours back. Colorista is its wearable form (docs/animas/prismatico/README.md).
  luca: { id: 'luca', friend: 'Luca', name: 'Ánima de Luca', colour: '#b3aea6', note: 'La Sagrada Família. Colorista.' },
} as const satisfies Record<string, Anima>;
export type AnimaId = keyof typeof ANIMAS;
export const ANIMA_IDS = Object.keys(ANIMAS) as AnimaId[];

/**
 * How the party grows with the ánimas it has gathered (docs/fight-sim.md § Progression): each
 * friend freed makes everyone `pct` larger in PV, Fuerza, Magia, Defensa and Espíritu, counted on
 * what each fighter is with the ánima worn (Aitor, 2026-11-21: «cada ánima da un X % más de los
 * atributos, así se notará más el cambio»; until then it was a point of each and ten PV). A share
 * and not points, so the fifth ánima is felt as much as the first. Tunable (`--tune growth.rules.pct=0:.12:.24`).
 */
export const ANIMA_GROWTH = { pct: .12 };
/** How much larger the party's attributes are with these ánimas: .24 is 24 % more. */
export function animaGrowth(ids: readonly AnimaId[]): number { return ids.length * ANIMA_GROWTH.pct; }

/**
 * How threatening La Reina Bubbaloo's castle is, from 1 (every tower up, a storm over it) down to
 * a floor it never goes below: each ánima the party gathers takes some of her power away.
 */
export const THREAT_PER_ANIMA = .15;
export function castleThreat(animas: number) { return Math.max(.1, 1 - animas * THREAT_PER_ANIMA); }
