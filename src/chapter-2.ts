/**
 * Chapter 2 (docs/chapter-2.md): Barcelona. The TV news, Gerard and Aitor's lines, where things
 * are, the hidden clues and the ways of waking up. `src/story.ts` decides when each one plays.
 */
import type { Dialogue, DialogueLine } from './dialogue';
import type { EnvironmentId } from './environments';

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const both = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const alone = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', lines });

/** Where chapter 2's story things are. Cells must be walkable (see tests). */
export const PLACES_2 = {
  /** Walking this close to the TV turns the news on (it switched itself on when Gerard woke up). */
  tv: { environment: 'meridiana' as EnvironmentId, cell: { x: 16, z: 3 }, radius: 3 },
  /** The guards stand before the gum curtain; talking to them is crossing it. */
  guards: { environment: 'palacio' as EnvironmentId, cells: [{ x: 14, z: 8 }, { x: 16, z: 8 }, { x: 18, z: 8 }], challenge: { x: 16, z: 10 } },
  /** Where the guards' fight is staged: the south of the hall, clear of the fountain. */
  guardStage: { x: 16, z: 17 },
  /** In front of the school door, where the palace lets them out. */
  school: { environment: 'rec-comtal' as EnvironmentId, door: 'enter-school' },
} as const;

/** The broadcast (src/news-ui.ts). The ticker hides the chapter's first clue among ordinary news. */
export const NEWS = {
  channel: 'B35 NOTÍCIES',
  kicker: 'ÚLTIMA HORA',
  headline: 'Aparece un castillo rosa encima de la escuela Rec Comtal',
  sub: 'Todos los alumnos estaban dentro · Trinitat Vella, Barcelona',
  live: 'EN DIRECTO · TRINITAT VELLA',
  shots: ['IMÁGENES AÉREAS', 'TRINITAT VELLA · VIA DE BÀRCINO'],
  ticker: [
    'Los Mossos piden a los vecinos que no se acerquen a la escuela',
    'Rodalies: la R4 se amplía desde La Sagrera hasta Cardedeu, primer tren esta mañana',
    'Tráfico: colas en la Meridiana en dirección norte; los conductores paran a mirar',
    'El tiempo: cielo despejado, con nubes de color rosa sobre Sant Andreu',
    'Los quioscos de la ciudad agotan los chicles de fresa',
  ],
} as const;

export const LINES_2 = {
  /** After the news, the first time. */
  news: both(
    gerard('Aitor… ese castillo.'),
    aitor('¿Lo has visto? Es en Trinitat Vella. La escuela entera, tapada de… ¿eso es chicle?'),
    gerard('Es el castillo de mi sueño. El de la Reina Bubbaloo. Lo he visto por dentro.'),
    aitor('Gerard. Has soñado con un castillo rosa y sale en las noticias un castillo rosa.'),
    aitor('…Vale. Eso no es normal.'),
    gerard('Hay niños dentro. Tengo que ir.'),
    aitor('Tenemos. La L1 nos deja al lado, en Trinitat Vella. Coge las llaves.'),
  ),
  /** Watching it again. */
  newsAgain: both(aitor('Siguen poniendo lo mismo en todos los canales.')),
  /** The front door before the news: the TV switched itself on. */
  doorBeforeNews: both(
    aitor('Espera. ¿Oyes eso?'),
    aitor('La tele del salón se ha encendido sola. Y no para de pitar.'),
  ),
  /** The first time they come down into the metro: the city opens. */
  metroFirst: both(
    gerard('Fabra i Puig. Cuántas mañanas habré bajado estas escaleras medio dormido.'),
    aitor('Hoy vas bien despierto. Venga, la L1 hasta Trinitat Vella son cuatro paradas.'),
  ),
  /** Coming up at Trinitat Vella the first time: the castle over the school. */
  recComtalFirst: both(
    aitor('Madre mía.'),
    gerard('Está encima de la escuela. Como si hubiera crecido del tejado.'),
    aitor('Y no hay nadie. Ni policía, ni vecinos. Solo mochilas en el suelo.'),
    gerard('Se oye cantar a los niños, ¿lo oyes? Están bien. Creo.'),
    aitor('La puerta de la escuela está abierta. Bueno… «abierta». Es una pompa.'),
  ),
  /** Inside the palace for the first time in chapter 2. */
  castleFirst: both(
    gerard('Es igual que en el sueño. El vestíbulo, la fuente, la cortina de chicle…'),
    aitor('Huele a fresa. Muchísimo. ¿Esto lo soñaste tú?'),
    gerard('Lo soñó Bernat. Hace veinticinco años. Y yo estaba dentro.'),
    aitor('Detrás de esa cortina hay algo. Y esas cosas enormes la están vigilando.'),
  ),
  /** Before the guards' fight. */
  guards: both(
    gerard('Tenemos que pasar.'),
    aitor('Gerard, son como armarios. De chicle.'),
    gerard('Por los niños.'),
  ),
  /** Guards beaten (only with ánimas). */
  guardsBeaten: both(
    aitor('¡Lo hemos hecho! Se han derretido.'),
    gerard('La cortina se mueve. Arriba hay alguien.'),
  ),
  /** Waking up after falling, the first time. */
  wakeFirst: both(
    gerard('¡NO!'),
    aitor('Ey, ey. Estás en casa. Otra vez gritando.'),
    gerard('El castillo… los guardianes… nos han aplastado.'),
    aitor('¿Nos? Yo también lo he soñado. El puño de chicle, y luego todo rosa.'),
    aitor('Si hemos soñado lo mismo, no ha sido un sueño.'),
    gerard('Son demasiado fuertes. Así no podemos.'),
    aitor('Pues no vayamos así. Busquemos ayuda. Tú tienes amigos para dar y regalar.'),
  ),
  /** Waking up after falling again: Aitor's line changes. */
  wakeAgain: [
    both(gerard('¡NO!'), aitor('Lo sé, lo sé. Los guardianes. Yo también estaba.')),
    both(gerard('¡NO!'), aitor('Tercera vez que me despiertas así. Empiezo a acostumbrarme.'), aitor('Igual no es cuestión de insistir, sino de ir con más gente.')),
    both(gerard('¡NO!'), aitor('Buenos días otra vez, cabezota. Ni un rasguño, ¿eh? Solo el orgullo.')),
  ],
  /** Talking to Aitor in chapter 2, by how far they have got. */
  aitor: {
    beforeNews: both(aitor('Feliz cumpleaños, dormilón. ¿Qué es ese pitido? Viene del salón.')),
    afterNews: both(aitor('Trinitat Vella. La L1, en Fabra i Puig, aquí mismo. ¿Vamos?')),
    afterFall: both(aitor('Si esos guardianes son tan fuertes, necesitamos a alguien más. ¿A quién llamarías tú?')),
    clue: both(aitor('¿No decían en la tele que la R4 ahora llega hasta Cardedeu? Allí viven Nuria y Uri.')),
  },
  /** The bus shelter on the Meridiana: the same clue, a second time. */
  clueR4Marquesina: alone(
    gerard('Un cartel de Rodalies en la marquesina: «R4 · Nuevo: ahora de La Sagrera a Cardedeu».'),
    gerard('Cardedeu… Hace siglos que no subo.'),
  ),
  /** The palace's things, seen at 35 (chapter 1's looks speak with Bernat's voice). */
  curtain: both(gerard('La cortina de chicle. Detrás está la escalera del trono.'), aitor('Y delante, ellos.')),
} as const;
