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
import CALLE_SCENE from '../geo/cardedeu-calle.json' with { type: 'json' };

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
/** Jacint Verdaguer once Uri has run down it: one way, straight on, to the bubble (§ La calle que no acaba). */
export const CALLE: EnvironmentId = 'cardedeu-calle';

/** The fights that jump out of the maze, one per level, and the boss on the roof. */
export type FearEncounter = 'cebollon' | 'cebolla' | 'plato' | 'escolta' | 'uri-vertigo' | 'crias-1' | 'crias-2' | 'crias-3';

/**
 * A spot on Nuria's street, named in `anchors` of assets/geo/cardedeu/zone.json in metres, as the
 * cell it falls on: rebuilding or reframing the map keeps the mission where it belongs.
 */
function street(anchor: string, scene: GeoScene = CARDEDEU_SCENE as GeoScene): Cell {
  const at = scene.anchors?.[anchor];
  if (!at) throw new Error(`${scene.name} has no anchor «${anchor}»`);
  return { x: Math.round(at.x), z: Math.round(at.z) };
}
const calle = (anchor: string) => street(anchor, CALLE_SCENE as GeoScene);

/** Where things are. Cells must be walkable (tests/nuria.test.mjs). */
export const PLACES_NURIA = {
  /** Nuria waits at her door, on the long block of Carrer de Jacint Verdaguer; Uri, the cats and the way home stand round her. */
  nuria: { environment: STREET, cell: street('nuria-door') },
  /** Haru waits by the station on platform 1 and leads the way, looking back. */
  haru: { environment: STREET, cell: street('haru-station'), radius: 4 },
  /** Towards the corner of Doctor Daurella, where Uri ran: the street goes on without them. */
  corner: { environment: STREET, cell: street('maze-corner') },
  streetBack: { environment: STREET, cell: street('maze-back') },
  /**
   * La calle que no acaba: in at its start, and the bubble at its end into Uri's fears. They talk
   * about it from `radius`; `through` cells past it (anywhere across the street, so nobody walks
   * round it) they are through it, with nothing to press.
   */
  calleIn: { environment: CALLE, cell: calle('calle-inici') },
  portal: { environment: CALLE, cell: calle('calle-portal'), radius: 7, through: 1.5 },
  /** Out of the tower, back in front of the bubble. */
  calleBack: { environment: CALLE, cell: { x: calle('calle-portal').x, z: calle('calle-portal').z + 4 } },
  /** Where the tower lets them in. */
  mazeIn: { environment: MAZE, cell: { x: 25, z: 54 } },
  /**
   * The way up out of each ring (the gap in its inner wall, src/tower.ts): going through it, Uri
   * shouts down from the top, where he waits from the start, ever easier to make out.
   */
  uri: [
    { environment: MAZE, cell: { x: 21, z: 47 }, radius: 2.5 },
    { environment: MAZE, cell: { x: 25, z: 41 }, radius: 2.5 },
    { environment: MAZE, cell: { x: 21, z: 35 }, radius: 2.5 },
  ],
  /**
   * The platform on top: walking onto it with Uri up there starts the boss, fought round `stage`,
   * the middle of the platform where Vertitrón stands (src/tower.ts `TOWER.centre`).
   */
  summit: { environment: MAZE, cell: { x: 27, z: 30 }, radius: 3, stage: { x: 27, z: 27 } },
} as const;

/**
 * Nuria's street turning into La calle que no acaba (docs/quests/nuria.md, src/street-shift.ts), in
 * her street's cells. Once she has lent them the cats, walking up from her door makes houses rise out
 * of the ground (`closers`, each once Gerard is north of its row `at`, `levels` storeys, her house's
 * look or the row's opposite) until every way but on is shut: behind her door, the gardens, both
 * sides of Doctor Daurella. Then the corner unrolls into the street's own start (`over`: La calle's
 * cell x, z laid on x + dx, z + dz here), its houses rising one after another away from them, and
 * past `swap` they are in La calle itself, at the same spot, with no cut.
 */
export const SHIFT = {
  calle: { dx: 38, dz: -55 },
  /** What La calle covers here: from the map's north edge down to the crossing, wall to wall. */
  over: { x: 36, z: 1, w: 49, d: 56 },
  /** The corner unrolls once Gerard is at the crossing, north of this row, and every closer has started to rise. */
  unroll: 63,
  /** Past this row (well inside, the crossing out of sight) the party is in La calle itself. */
  swap: 30,
  /** The first houses rise once Gerard has been at Nuria's door, this close, in this visit. */
  door: 7,
  closers: [
    { id: 'detras', x: 57, z: 101, w: 8, d: 8, levels: 2, look: 'nuria', at: 93 },
    { id: 'jardines', x: 65, z: 73, w: 12, d: 9, levels: 2, look: 'fila', at: 89 },
    { id: 'daurella-oeste', x: 36, z: 60, w: 13, d: 9, levels: 3, look: 'nuria', at: 68 },
    { id: 'placa', x: 36, z: 57, w: 19, d: 3, levels: 3, look: 'fila', at: 68 },
    { id: 'daurella-est', x: 65, z: 57, w: 20, d: 3, levels: 3, look: 'fila', at: 68 },
  ],
} as const;

/**
 * Uri's fears on the ramp (docs/quests/nuria.md § The maze): each walks its stretch, and if it
 * sees Gerard it runs at him (src/chasers.ts); when it reaches him the fight starts after its line.
 */
export const FEARS: readonly {
  id: string; encounter: Exclude<FearEncounter, 'uri-vertigo'>; patrol: readonly Cell[]; sight: number; walk: number; run: number;
  /** Its line as it reaches them; the young jump in without a word. */
  tell?: Dialogue;
  /** The young come back a while after they are beaten (src/game.ts): the climb never gets quiet. */
  respawn?: boolean;
}[] = [
  {
    id: 'fear-cebollon', encounter: 'cebollon', sight: 8, walk: 1.6, run: 4.4,
    patrol: [{ x: 50, z: 46 }, { x: 50, z: 6 }],
    tell: both(aitor('¡Esa cebolla viene a por nosotros!'), gerard('Me pican los ojos solo de verla.'), aitor('Tiene capas para rato. Así, golpe a golpe, no la pelamos ni en una semana.')),
  },
  {
    id: 'fear-plato', encounter: 'plato', sight: 9, walk: 1.8, run: 4.6,
    patrol: [{ x: 12, z: 10 }, { x: 42, z: 10 }],
    tell: both(gerard('Una campana de plato… corriendo.'), aitor('No la levantes. No la levantes.')),
  },
  {
    // Ring 3's fear (it stays at index 2: the rings below are beaten by slicing this list): La Cebolla
    // y los suyos, a cebolla half peeled with a fantasmita and a cebollita clearing the way for it.
    id: 'fear-escolta', encounter: 'escolta', sight: 10, walk: 1.7, run: 4.5,
    // Round three sides and back: the fourth has the short wall across it.
    patrol: [{ x: 16, z: 38 }, { x: 16, z: 16 }, { x: 38, z: 16 }, { x: 38, z: 38 }, { x: 38, z: 16 }, { x: 16, z: 16 }],
    tell: both(aitor('Esa cebolla no viene sola.'), gerard('Trae a toda la familia detrás.')),
  },
  // Their young, three packs a ring (src/battle.ts BROOD): one along each side the climb goes round,
  // and one by the ring's way up. Quick to see, quick to run, and back a while after they fall.
  ...([
    ['brood-1a', 'crias-1', [{ x: 6, z: 4 }, { x: 48, z: 4 }]],
    ['brood-1b', 'crias-1', [{ x: 4, z: 48 }, { x: 4, z: 6 }]],
    ['brood-1c', 'crias-1', [{ x: 6, z: 50 }, { x: 21, z: 50 }]],
    ['brood-2a', 'crias-2', [{ x: 10, z: 42 }, { x: 10, z: 12 }]],
    ['brood-2b', 'crias-2', [{ x: 44, z: 12 }, { x: 44, z: 42 }]],
    ['brood-2c', 'crias-2', [{ x: 42, z: 44 }, { x: 25, z: 44 }]],
    ['brood-3a', 'crias-3', [{ x: 38, z: 36 }, { x: 38, z: 18 }]],
    ['brood-3b', 'crias-3', [{ x: 18, z: 16 }, { x: 36, z: 16 }]],
    ['brood-3c', 'crias-3', [{ x: 17, z: 38 }, { x: 21, z: 38 }]],
  ] as const).map(([id, encounter, patrol]) => ({ id, encounter, patrol, sight: 7, walk: 1.9, run: 4.9, respawn: true })),
  // La Cebolla: slower than the young, but it weighs. Better seen coming, and back too after it falls.
  ...([
    ['onion-1', [{ x: 48, z: 50 }, { x: 26, z: 50 }]],
    ['onion-2', [{ x: 42, z: 12 }, { x: 12, z: 12 }]],
  ] as const).map(([id, patrol]) => ({ id, encounter: 'cebolla' as const, patrol, sight: 7, walk: 1.5, run: 4.2, respawn: true })),
];

/** Ids of fears that were renamed, as an old run may still name them: ring 3's was Game Over. */
const RENAMED_FEARS: Record<string, string> = { 'fear-game-over': 'fear-escolta' };
/** The fears a run has beaten, under the names they have now. */
export const migrateBeaten = (beaten: readonly string[]) => [...new Set(beaten.map(id => RENAMED_FEARS[id] ?? id))];

/**
 * La calle que no acaba (docs/quests/nuria.md): what Aitor notices as they go up it, said over his
 * head when they first get that far (`at` is how far along the street, 0 at its start, 1 at the bubble).
 */
export const STREET_MARKS: readonly { at: number; text: string }[] = [
  { at: .1, text: 'Esa casa es igual que la de Nuria.' },
  { at: .26, text: 'Y esa. Y esa. Todas tienen un 1 en la puerta.' },
  { at: .44, text: 'No se oye nada. Ni un pájaro.' },
  { at: .6, text: '¿Las casas crecen, o la calle se estrecha?' },
  { at: .78, text: 'Gerard… detrás ya no se ve por dónde hemos venido.' },
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
  /**
   * Nuria at her door, before anything: what Uri has been like since he woke up, told by someone
   * who is still trying not to be scared (docs/quests/nuria.md § Beats).
   */
  nuriaFirst: withNuria(
    nuria('¡Gerard! ¡Aitor! Menos mal que habéis venido.'),
    nuria('Es Uri. Se ha despertado hablando. Y no ha parado. Uri. Hablando.', 'preocupado'),
    gerard('¿Uri? ¿Nuestro Uri?'),
    nuria('Me ha llamado «señora». Me ha preguntado si mi hijo podía bajar a jugar.', 'preocupado'),
    nuria('Se ha pasado una hora en la ventana contando coches. Rojo, rojo, blanco, rojo. Riéndose solo.'),
    nuria('Luego ha cogido a Nil como quien coge un muñeco y ha dicho: «Vamos a jugar a que no volvemos».', 'preocupado'),
    aitor('…'),
    nuria('Ha bajado la calle descalzo. Y la calle… se ha ido alargando detrás de él. Lo he visto desde arriba.'),
    nuria('Tenía los ojos de color violeta.', 'preocupado'),
    gerard('Violeta… Es ella. La Reina.'),
    nuria('Llevaos a Haru y a Yuki. Siempre han sido un poco vuestras, y a Uri le encuentran donde sea.'),
    nuria('Yo me quedo en la puerta. Si vuelve y no hay nadie… no sé si sabrá entrar.', 'preocupado'),
  ),
  /** Nuria again, while they look for Uri. */
  nuriaWaiting: withNuria(
    nuria('Calle arriba, por donde se fue. No os paréis.', 'preocupado'),
    nuria('Y no miréis los números de las puertas.', 'preocupado'),
  ),
  /** The corner has gone and her street runs on, straight: the first time it unrolls before them. */
  calle: both(
    gerard('Aquí había una esquina. Doctor Daurella.'),
    aitor('Ya no. Solo calle. Recta, hacia delante.'),
    uri('¡A que no me pilláis! ¡Hasta donde se acaba la calle!', 'crio'),
  ),
  /** In sight of the bubble at the end of the street, the first time. */
  portal: both(
    gerard('Una pompa. Como las de la Reina… pero por dentro está oscura.'),
    aitor('Se oye a Uri ahí dentro. Se está riendo.'),
    uri('¡Aquí dentro está todo lo que me da miedo! ¡Es divertidísimo!', 'crio'),
  ),
  /** Nuria when they come back without Uri (they gave up or fell). */
  nuriaAgain: withNuria(
    nuria('Haru y Yuki volvieron solas. ¿Lo intentáis otra vez?', 'preocupado'),
    nuria('Las cebollas grandes ni las toquéis todavía. Haru se suelta con las pequeñas, y cuando aprende a dar zarpazos no hay capa que le dure.'),
    nuria('Llevadlas. Uri sigue ahí dentro.'),
  ),
  /** Through the bubble into the tower's ground, the first time: Uri shouts down from the top (a `shout`). */
  mazeIn: '¡NIVEL UNO! ¡Estoy arriba del todo! ¡Si me pilláis, ganáis!',
  /** At the station with the cats: Aitor asks before they go. */
  leaveWarn: both(
    aitor('¿Nos vamos y dejamos a Uri así?'),
    aitor('Si cogemos el tren, Haru y Yuki se vuelven con Nuria. Habrá que empezar de cero.'),
  ),
  /**
   * Up out of each ring: Uri shouts down from the top, where he has been all along, in a shout
   * bubble over him while they keep climbing (nothing stops; `shout` in story.ts).
   */
  shouts: ['¡Nivel dos! ¡Más arriba!', '¡Nivel tres! ¡El último!', '¡Arriba del todo! ¡Desde aquí se ve todo Cardedeu!'],
  /** Onto the platform at the top: Uri shouts for his boss, and Vertitrón's fight starts (a `shout`). */
  roof: '¡Jefe final! ¡Vertitrón, a por ellos!',
  /** Vertitrón is beaten: Uri on the ridge, then all of them back down at the door. */
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
