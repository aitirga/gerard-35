/**
 * Marta's mission (docs/quests/marta.md): where she and the piano stand in Alegia, where things are in
 * Las cuerdas, and every line. `src/story.ts` decides when each one plays; this file is data only, as
 * the one-file-per-friend convention asks (docs/barcelona.md § Architecture). Alegia's cells are in its
 * grid (src/geo/alegia.json); Las cuerdas' come from its plan (src/cuerdas.ts).
 *
 * Marta does not sound like herself until the very end: the Queen took her voice, and with it what
 * made her direct, clear and loyal. She hedges, shrugs and trails off. Everything comes back at once
 * when La Voz is beaten, and only then does she speak as she does.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';
import type { CuerdasEncounter } from '../battle';
import { CUERDAS, type PlatformId } from '../cuerdas.ts';

export const ALEGIA: EnvironmentId = 'alegia';
export const CUERDAS_PLACE: EnvironmentId = 'cuerdas';
/** Her figure's scale in the world: the cast's adults are all close to it. */
export const MARTA_SCALE = 1.12;

/**
 * Where things are in Alegia. Provisional (docs/quests/marta.md § Open): under the pergola of the
 * square by the town hall, until Aitor says where the piano really is and what Alegia is to her.
 */
export const PLACES_MARTA = {
  /** An upright piano under the pergola, its back to the north; `seat` is where Aitor sits to play. */
  piano: { cells: [{ x: 81, z: 52 }, { x: 82, z: 52 }] as Cell[], centre: { x: 81.5, z: 52 }, seat: { x: 81, z: 53 }, facing: 0 },
  /** Marta, standing beside it. */
  marta: { x: 84, z: 53 },
  /** Where the wrong note hangs and grows into the bubble. */
  bubble: { x: 82, z: 55 },
  /** Back out of Las cuerdas: in front of the piano. */
  back: { x: 82, z: 54 },
} as const;

const platform = (id: PlatformId) => CUERDAS.platforms.find(p => p.id === id)!;
/** The three qualities in the order they are met (south to north), each on its platform after its maze. */
export const QUALITIES: readonly { id: 'lealtad' | 'cristalino' | 'directo'; encounter: CuerdasEncounter; cell: Cell; radius: number }[] = [
  { id: 'lealtad', encounter: 'cuerdas-lealtad', cell: { ...platform('lealtad').centre }, radius: 4 },
  { id: 'cristalino', encounter: 'cuerdas-cristalino', cell: { ...platform('cristalino').centre }, radius: 4 },
  { id: 'directo', encounter: 'cuerdas-directo', cell: { ...platform('directo').centre }, radius: 4 },
];
/** Where things are in Las cuerdas. */
export const PLACES_CUERDAS = {
  spawn: { ...CUERDAS.spawn },
  /** The bubble they came in by, behind where they arrive: the way back out. */
  exit: { x: CUERDAS.spawn.x, z: CUERDAS.spawn.z + 2 },
  /** La Voz, where every string meets. */
  voz: { x: CUERDAS.centre.x, z: CUERDAS.centre.z, radius: 5.5 },
  /** Walking up to each maze, what Aitor notices about it (its `start` is the last solid cell before it). */
  mazes: CUERDAS.mazes.map(maze => ({ cell: { ...maze.start }, radius: 2.2 })),
  /**
   * Marta inside, beside the party but a step behind: at the way in, then on each platform once its
   * quality is beaten (by how many are), off the middle so she is never in the way.
   */
  marta: [
    { x: platform('entrada').centre.x + 3, z: platform('entrada').centre.z },
    ...QUALITIES.map(q => ({ x: q.cell.x + 4, z: q.cell.z + 3 })),
  ] as Cell[],
} as const;

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const marta = (text: string): DialogueLine => ({ speaker: 'marta', text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });

export const LINES_MARTA = {
  /** In Alegia, the first time: she is there, and she is not. */
  arrive: group('marta',
    aitor('Marta. Hemos venido en cuanto hemos podido.'),
    marta('Qué bien. Qué bien que hayáis venido. Supongo.'),
    gerard('¿Supones?'),
    marta('No sé. Puede que sí. Depende de cómo se mire.'),
    aitor('Tú no has dicho «depende» en tu vida.'),
    marta('Iba a cantarle algo a Gerard. Por el cumpleaños. Pero no sale.'),
    marta('Abro la boca y sale otra cosa. No es que desafine. Es que no es mía.'),
    aitor('Hay un piano ahí. Déjame probar una cosa.'),
  ),
  /** Talking to her again before the piano. */
  waiting: group('marta', marta('Sigo aquí. Creo.'), aitor('El piano, Gerard.')),
  /** The piano before they have spoken to her: Aitor will not play with her like that and not ask. */
  pianoBefore: group('aitor', aitor('Luego. Primero Marta: ni nos ha mirado.')),
  /** Aitor plays «Izana dena geroa»; it comes out wrong, and her note stays in the air. */
  piano: group('marta',
    aitor('«Izana dena geroa». Yo toco y tú entras cuando quieras, como siempre.'),
    gerard('Aitor. Suena fatal.'),
    aitor('No soy yo. Toco una tecla y suena la de al lado.'),
    marta('Yo entro aquí.'),
    gerard('Eso no ha sido una nota. Se ha quedado ahí, en el aire. Y crece.'),
    aitor('Marta, apártate.'),
    marta('No. Eso es mío.'),
  ),
  /** Inside, the first time. */
  inside: group('marta',
    aitor('No hay suelo. Hay cuerdas. Como dentro del piano.'),
    marta('Alguien canta. Muy lejos.'),
    gerard('Eres tú.'),
    marta('No lo sé. Puede.'),
    aitor('Todas las cuerdas suben hacia el mismo sitio. Por ahí.'),
  ),
  /** Back in after leaving. */
  insideAgain: group('aitor', aitor('Sigue cantando. Vamos.')),
  /** Her, inside, when spoken to: by how many of the three are beaten. */
  beside: [
    group('marta', marta('Id delante. Yo os sigo. Supongo que os sigo.')),
    group('marta', aitor('Se ha deshecho. ¿Notas algo?'), marta('No. Nada.')),
    group('marta', marta('Tampoco. Sigo igual.'), gerard('Queda camino.')),
    group('marta', aitor('Queda una.'), marta('Queda la que canta.')),
  ] as Dialogue[],
  /** What Aitor notices before each maze: what the floor does, never what to do. */
  mazes: [
    group('aitor', aitor('Las losas van y vienen con la voz. La ámbar está mientras suena la nota grave.'), gerard('Y cuando calla, se cae.')),
    group('aitor', aitor('Estas están rajadas.'), gerard('No aguantarán que pasemos dos veces.')),
    group('aitor', gerard('Aquí las filas no suenan cuando toca. No hay por dónde pasar.'), aitor('Clavijas. Como las del piano. Cada una afina su fila.')),
  ] as Dialogue[],
  /** Before each quality. */
  lealtad: group('marta', marta('Esa no se va a apartar.'), gerard('¿La conoces?'), marta('Yo tampoco me apartaba. Antes.')),
  cristalino: group('marta', marta('Se ve a través. Qué raro tiene que ser que te vean así.'), aitor('Así te hemos visto siempre.')),
  directo: group('marta', marta('Ese va recto.'), gerard('Como tú.'), marta('Si tú lo dices.')),
  /** At the centre, before La Voz. */
  voz: group('marta',
    aitor('Marta… eres tú.'),
    marta('No. Yo estoy aquí. Eso es lo que se llevó.'),
    gerard('Está cantando.'),
    marta('Pues que me lo devuelva.'),
  ),
  /** La Voz beaten: everything comes back at once, and she is herself. */
  won: group('marta',
    marta('…'),
    marta('Vale. Ya está. Ya estoy.'),
    aitor('¿Marta?'),
    marta('Habéis tardado. Y tú has tocado el principio fatal, que lo sepas.'),
    aitor('Ha vuelto.'),
  ),
  /** Back in Alegia, at the piano: the song as it should sound. */
  home: group('marta',
    marta('Siéntate. Desde el principio. Y esta vez no corras.'),
    aitor('No he corrido en mi vida.'),
    gerard('Suena como tiene que sonar.'),
    marta('Felicidades, Gerard. Esto era lo que te quería cantar.'),
  ),
  /** After the mission, by the piano. */
  after: group('marta', marta('Otro día la grabamos. Pero bien.'), aitor('Hecho.')),
};
