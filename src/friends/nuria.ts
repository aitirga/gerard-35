/**
 * Nuria's mission (docs/quests/nuria.md): where things are in Cardedeu and in Uri's maze, the
 * fights that jump out of it, and every line. `src/story.ts` decides when each one plays; this
 * file is data only, as the one-file-per-friend convention asks (docs/barcelona.md § Architecture).
 */
import type { Dialogue, DialogueLine } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const nuria = (text: string): DialogueLine => ({ speaker: 'nuria', text });
const uri = (text: string): DialogueLine => ({ speaker: 'uri', text });
const both = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const withNuria = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'nuria', lines });
const withUri = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'uri', lines });

export const STREET: EnvironmentId = 'cardedeu';
export const MAZE: EnvironmentId = 'cardedeu-laberinto';

/** The fights that jump out of the maze, one per level, and the boss on the roof. */
export type FearEncounter = 'cebollon' | 'plato' | 'game-over' | 'uri-vertigo';

/** Where things are. Cells must be walkable (tests/nuria.test.mjs). */
export const PLACES_NURIA = {
  /** Nuria waits at her door, on the long block of Carrer de Jacint Verdaguer. */
  nuria: { environment: STREET, cell: { x: 107, z: 68 } },
  /** Haru waits at the station's door and leads the way, looking back. */
  haru: { environment: STREET, cell: { x: 32, z: 185 }, radius: 4 },
  /** Round the corner of Doctor Daurella, the street closes into Uri's maze. */
  corner: { environment: STREET, cell: { x: 141, z: 74 } },
  /** Where the maze lets them in, and back out to the street. */
  mazeIn: { environment: MAZE, cell: { x: 4, z: 41 } },
  streetBack: { environment: STREET, cell: { x: 136, z: 74 } },
  /** Uri, Nil in his arms, waits at the end of each level; reaching him sends him on. */
  uri: [
    { environment: MAZE, cell: { x: 29, z: 43 }, radius: 3 },
    { environment: MAZE, cell: { x: 62, z: 6 }, radius: 3 },
    { environment: MAZE, cell: { x: 89, z: 40 }, radius: 3 },
  ],
} as const;

/**
 * The ambushes (docs/quests/nuria.md § The maze): each place warns before (`tell`), and walking
 * into it starts the fight; going round it does not.
 */
export const AMBUSHES: readonly { id: string; level: number; cell: Cell; radius: number; encounter: Exclude<FearEncounter, 'uri-vertigo'>; tell: Dialogue }[] = [
  {
    id: 'ambush-cebollon', level: 0, cell: { x: 18, z: 10 }, radius: 2, encounter: 'cebollon',
    tell: both(gerard('Ese contenedor tiembla.'), aitor('Huele… a cebolla. Mucho.')),
  },
  {
    id: 'ambush-plato', level: 1, cell: { x: 47, z: 9 }, radius: 2, encounter: 'plato',
    tell: both(aitor('¿Una mesa puesta en medio del patio?'), gerard('Con la campana tapada. No pienso levantarla.')),
  },
  {
    id: 'ambush-game-over', level: 2, cell: { x: 80, z: 24 }, radius: 2, encounter: 'game-over',
    tell: both(gerard('Esa tele se ha encendido sola.'), aitor('«PRESS START». No me gusta nada.')),
  },
];

export const LINES_NURIA = {
  /** First time out of Cardedeu station. */
  arrive: both(
    aitor('Cardedeu. Qué tranquilo.'),
    aitor('Espera. ¿Esa no es Haru?'),
  ),
  /** Haru at the station's door: she looks back and trots off up the street. */
  haru: both(
    gerard('¡Haru! ¿Qué haces tan lejos de casa?'),
    aitor('Nos mira. Y se va. Quiere que la sigamos.'),
  ),
  /** Nuria at her door, before anything. */
  nuriaFirst: withNuria(
    nuria('¡Gerard! ¡Aitor! Menos mal.'),
    nuria('Es Uri. Se ha levantado raro. Hablando. Sin parar. Uri, ¡hablando!'),
    gerard('¿Uri? ¿Nuestro Uri?'),
    nuria('Se ha puesto a jugar a pillar con Nil en brazos y ha salido corriendo. Dobló la esquina de Doctor Daurella y… la calle ya no es la calle.'),
    nuria('Tenía los ojos de color violeta.'),
    gerard('Violeta… es ella. La Reina.'),
    nuria('Llevaos a Haru y a Yuki. Siempre han sido un poco vuestras. Y ellas a Uri le encuentran donde sea.'),
    nuria('Yo no puedo ir: alguien tiene que estar aquí si vuelve.'),
  ),
  /** Nuria again, while they look for Uri. */
  nuriaWaiting: withNuria(
    nuria('Por la esquina de Doctor Daurella. Daos prisa, por favor.'),
  ),
  /** Nuria when they come back without Uri (they gave up or fell). */
  nuriaAgain: withNuria(
    nuria('Haru y Yuki volvieron solas. ¿Lo intentáis otra vez?'),
    nuria('Llevadlas. Uri sigue ahí dentro.'),
  ),
  /** Into the maze, the first time. */
  mazeIn: both(
    gerard('Esto no estaba aquí.'),
    aitor('Setos. Paredes. Coches donde no caben coches.'),
    uri('¡NIVEL UNO! ¡Si me pilláis, gano yo! ¡No, espera, si me pilláis ganáis vosotros! ¡Da igual, corred!'),
  ),
  /** At the station with the cats: Aitor asks before they go. */
  leaveWarn: both(
    aitor('¿Nos vamos y dejamos a Uri así?'),
    aitor('Si cogemos el tren, Haru y Yuki se vuelven con Nuria. Habrá que empezar de cero.'),
  ),
  /** Reaching Uri at the end of each level: he runs on. */
  uri: [
    withUri(
      uri('¡Casi! ¡Casi me pilláis! Nil también se ríe, ¿le oís? ¡Nil se ríe!'),
      gerard('Uri, para un momento.'),
      uri('¡No! ¡Nivel dos! ¡Ahora salen más!'),
    ),
    withUri(
      uri('¿Sabéis que nunca había hablado tanto? ¡Me encanta! ¡Tengo un montón de cosas guardadas!'),
      aitor('Uri, tus ojos…'),
      uri('¡Nivel tres! ¡El último! ¡Hacia arriba!'),
    ),
    withUri(
      uri('Arriba. Al tejado. Desde ahí se ve todo Cardedeu.'),
      gerard('A ti no te gustan las alturas.'),
      uri('…'),
    ),
  ],
  /** Up the ladder: Uri frozen on the ridge, and El Vértigo rising from the drop. */
  roof: both(
    gerard('¡Uri!'),
    aitor('Está en el caballete, con Nil en brazos. No se mueve.'),
    gerard('Algo sube por el borde del tejado…'),
  ),
  /** El Vértigo is gone: Uri on the ridge, then all of them back down at the door. */
  won: withUri(
    uri('Pues no está tan alto.'),
    uri('…Gerard. Aitor. ¿Qué hacemos en el tejado?'),
    gerard('Bajar. Despacito. Nuria te espera.'),
  ),
  home: withNuria(
    nuria('¡Uri! ¡Nil!'),
    uri('Perdona. No sé qué me ha pasado. Solo quería… jugar.'),
    nuria('Ya. Pues mira, igual deberíamos jugar más.'),
    nuria('Gerard, quedaos a Haru y a Yuki un tiempo. Os han echado de menos.'),
  ),
} as const;
