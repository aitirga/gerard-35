/**
 * Nuria's mission (docs/quests/nuria.md): where things are in Cardedeu and in Uri's maze, the
 * fights that jump out of it, and every line. `src/story.ts` decides when each one plays; this
 * file is data only, as the one-file-per-friend convention asks (docs/barcelona.md § Architecture).
 */
import type { Dialogue, DialogueLine } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { GeoScene } from '../geo';
import type { Cell } from '../movement';
import CARDEDEU_SCENE from '../geo/cardedeu.json' with { type: 'json' };

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const nuria = (text: string, expression?: 'preocupado' | 'riendo'): DialogueLine => ({ speaker: 'nuria', text, expression });
/** Uri talks like a kid (`crio`) while the Queen holds him. */
const uri = (text: string, expression?: 'crio' | 'riendo' | 'sorprendido'): DialogueLine => ({ speaker: 'uri', text, expression });
const both = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const withNuria = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'nuria', lines });
const withUri = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'uri', lines });

export const STREET: EnvironmentId = 'cardedeu';
export const MAZE: EnvironmentId = 'cardedeu-laberinto';

/** The fights that jump out of the maze, one per level, and the boss on the roof. */
export type FearEncounter = 'cebollon' | 'plato' | 'game-over' | 'uri-vertigo';

/**
 * A spot on Nuria's street, named in `anchors` of assets/geo/cardedeu/zone.json in metres, as the
 * cell it falls on: rebuilding or reframing the map keeps the mission where it belongs.
 */
function street(anchor: string): Cell {
  const at = (CARDEDEU_SCENE as GeoScene).anchors?.[anchor];
  if (!at) throw new Error(`Cardedeu has no anchor «${anchor}»`);
  return { x: Math.round(at.x), z: Math.round(at.z) };
}

/** Where things are. Cells must be walkable (tests/nuria.test.mjs). */
export const PLACES_NURIA = {
  /** Nuria waits at her door, on the long block of Carrer de Jacint Verdaguer; Uri, the cats and the way home stand round her. */
  nuria: { environment: STREET, cell: street('nuria-door') },
  /** Haru waits by the station on platform 1 and leads the way, looking back. */
  haru: { environment: STREET, cell: street('haru-station'), radius: 4 },
  /** Round the corner of Doctor Daurella, the street closes into Uri's maze. */
  corner: { environment: STREET, cell: street('maze-corner') },
  /** Where the maze lets them in, and back out to the street. */
  mazeIn: { environment: MAZE, cell: { x: 25, z: 54 } },
  streetBack: { environment: STREET, cell: street('maze-back') },
  /** Uri, Nil in his arms, waits at the end of each level; reaching him sends him on. */
  uri: [
    { environment: MAZE, cell: { x: 21, z: 49 }, radius: 2.5 },
    { environment: MAZE, cell: { x: 27, z: 45 }, radius: 2.5 },
    { environment: MAZE, cell: { x: 21, z: 41 }, radius: 2.5 },
  ],
  /** The platform on top: walking onto it with Uri up there starts the boss. */
  summit: { environment: MAZE, cell: { x: 27, z: 33 }, radius: 3 },
} as const;

/**
 * Uri's fears on the ramp (docs/quests/nuria.md § The maze): each walks its stretch, and if it
 * sees Gerard it runs at him (src/chasers.ts); when it reaches him the fight starts after its line.
 */
export const FEARS: readonly { id: string; encounter: Exclude<FearEncounter, 'uri-vertigo'>; patrol: readonly Cell[]; sight: number; walk: number; run: number; tell: Dialogue }[] = [
  {
    id: 'fear-cebollon', encounter: 'cebollon', sight: 8, walk: 1.6, run: 4.4,
    patrol: [{ x: 49, z: 45 }, { x: 49, z: 9 }],
    tell: both(aitor('¡Esa cebolla viene a por nosotros!'), gerard('Me pican los ojos solo de verla.')),
  },
  {
    id: 'fear-plato', encounter: 'plato', sight: 9, walk: 1.8, run: 4.6,
    patrol: [{ x: 9, z: 9 }, { x: 45, z: 9 }],
    tell: both(gerard('Una campana de plato… corriendo.'), aitor('No la levantes. No la levantes.')),
  },
  {
    id: 'fear-game-over', encounter: 'game-over', sight: 11, walk: 2.2, run: 5,
    patrol: [{ x: 13, z: 13 }, { x: 13, z: 41 }, { x: 41, z: 41 }, { x: 41, z: 13 }],
    tell: both(aitor('«PLAYER 1».'), gerard('Nos ha visto. ¡Corre!')),
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
    nuria('Es Uri. Se ha levantado raro. Hablando. Sin parar. Uri, ¡hablando!', 'preocupado'),
    gerard('¿Uri? ¿Nuestro Uri?'),
    nuria('Se ha puesto a jugar a pillar con Nil en brazos y ha salido corriendo. Dobló la esquina de Doctor Daurella y… la calle ya no es la calle.'),
    nuria('Tenía los ojos de color violeta.', 'preocupado'),
    gerard('Violeta… es ella. La Reina.'),
    nuria('Llevaos a Haru y a Yuki. Siempre han sido un poco vuestras. Y ellas a Uri le encuentran donde sea.'),
    nuria('Yo no puedo ir: alguien tiene que estar aquí si vuelve.', 'preocupado'),
  ),
  /** Nuria again, while they look for Uri. */
  nuriaWaiting: withNuria(
    nuria('Por la esquina de Doctor Daurella. Daos prisa, por favor.', 'preocupado'),
  ),
  /** Nuria when they come back without Uri (they gave up or fell). */
  nuriaAgain: withNuria(
    nuria('Haru y Yuki volvieron solas. ¿Lo intentáis otra vez?', 'preocupado'),
    nuria('Llevadlas. Uri sigue ahí dentro.'),
  ),
  /** Into the tower's ground, the first time. */
  mazeIn: both(
    gerard('Esto no estaba aquí.'),
    aitor('Una torre. En Cardedeu. Y una rampa que da vueltas y vueltas hacia arriba.'),
    gerard('Y arriba del todo… una escalera. Enorme.'),
    uri('¡NIVEL UNO! ¡Hasta arriba del todo! ¡Si me pilláis, ganáis! ¡Corred!', 'crio'),
  ),
  /** At the station with the cats: Aitor asks before they go. */
  leaveWarn: both(
    aitor('¿Nos vamos y dejamos a Uri así?'),
    aitor('Si cogemos el tren, Haru y Yuki se vuelven con Nuria. Habrá que empezar de cero.'),
  ),
  /** Reaching Uri at the end of each level: he runs on. */
  uri: [
    withUri(
      uri('¡Casi! ¡Casi me pilláis! Nil también se ríe, ¿le oís? ¡Nil se ríe!', 'crio'),
      gerard('Uri, para un momento.'),
      uri('¡No! ¡Nivel dos! ¡Más arriba!', 'crio'),
    ),
    withUri(
      uri('¿Sabéis que nunca había hablado tanto? ¡Me encanta! ¡Tengo un montón de cosas guardadas!', 'crio'),
      aitor('Uri, tus ojos…'),
      uri('¡Nivel tres! ¡El último! ¡Arriba del todo!', 'crio'),
    ),
    withUri(
      uri('Arriba. A lo más alto. Desde ahí se ve todo Cardedeu.', 'crio'),
      gerard('A ti no te gustan las alturas.'),
      uri('…'),
    ),
  ],
  /** On top: the giant ladder, Uri frozen at the very top of it with Nil, and the ladder opens its eye. */
  roof: both(
    gerard('¡Uri!'),
    aitor('Está arriba del todo de la escalera, con Nil en brazos. No se mueve.'),
    gerard('La escalera… tiene un ojo. Y nos está mirando.'),
  ),
  /** El Vértigo is gone: Uri on the ridge, then all of them back down at the door. */
  won: withUri(
    uri('Pues no está tan alto.', 'riendo'),
    uri('…Gerard. Aitor. ¿Qué hacemos aquí arriba?', 'sorprendido'),
    gerard('Bajar. Despacito. Nuria te espera.'),
  ),
  home: withNuria(
    nuria('¡Uri! ¡Nil!', 'riendo'),
    uri('Perdona. No sé qué me ha pasado. Solo quería… jugar.'),
    nuria('Ya. Pues mira, igual deberíamos jugar más.', 'riendo'),
    nuria('Gerard, quedaos a Haru y a Yuki un tiempo. Os han echado de menos.'),
  ),
} as const;
