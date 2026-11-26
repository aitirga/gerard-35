import type { TrackId } from './music';

export type ChoirTrack = Exclude<TrackId, 'reina'>;

/** The scores on the upright. Every playable track belongs here except the final battle. */
export const REPERTOIRE = {
  'intro-piano': ['Piano de Aitor', 'Piano y voz'],
  izana: ['Izana dena geroa', 'Piano y voz'],
  voz: ['La voz de Marta', 'Piano y voz'],
  'intro-triste': ['Piano de Aitor · Versión lenta', 'Piano y voz'],
  triste: ['Passatge Maresme', 'Lugares'],
  home: ['En casa', 'Lugares'],
  concrete: ['La Meridiana', 'Lugares'],
  'mazmorra-2': ['Barcelona de noche', 'Lugares'],
  'mazmorra-oscuro': ['La mazmorra', 'Lugares'],
  bubbaloo: ['El castillo de Bubbaloo', 'Lugares'],
  battle: ['Batalla', 'Combates'],
  'mazmorra-3': ['Los jefes de las ánimas', 'Combates'],
} as const satisfies Record<ChoirTrack, readonly [string, string]>;
