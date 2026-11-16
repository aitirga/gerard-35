/**
 * Luca's mission (docs/quests/luca.md): where Luca waits outside the Sagrada Família, where each zone
 * of Fran's salon is inside it, and every line. `src/story.ts` decides when each one plays; this file
 * is data only, as the one-file-per-friend convention asks (docs/barcelona.md § Architecture). The
 * outside's cells are in its grid (src/geo/sagrada-familia.json); the inside's on BASILICA_PLAN
 * (src/environments.ts).
 *
 * Luca talks a lot, touches your arm, wears the loudest shirt in the room. Grey, he says little and
 * half of it; each zone won gives some of it back, and at the end he is all of it again. Fran is cold
 * and superior, never cartoon: nothing real of theirs is named.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';
import type { WalkId } from '../vidrieras';

export const SAGRADA: EnvironmentId = 'sagrada-familia';
export const INTERIOR: EnvironmentId = 'sagrada-familia-interior';
/** The Nativity door, outside, and the way back out, inside. */
export const DOOR = 'sagrada-familia-portal';
export const EXIT = 'sagrada-interior-salida';
/** The adults' scale in the world. */
export const LUCA_SCALE = 1.12;

/** Where things are outside, by the pond of Plaça de Gaudí, and in the salon inside. */
export const PLACES_LUCA = {
  /** Luca, grey, at the pond's north tip, facing the Nativity facade. */
  luca: { x: 71, z: 152 },
  /** Where his reflection is looked at, and where it stands in the water (in colour). */
  reflejo: { x: 69, z: 154 },
  water: { x: 69.4, z: 155.6 },
  /** Back out of the basilica, in front of the door. */
  outside: { x: 73, z: 119 },
  /** The party comes out here after Fran: by Luca. */
  won: { x: 72, z: 151 },
  /** In through the door. */
  inside: { x: 36, z: 37 },
  /** The chaplain who keeps the presbytery, beside the guard, and Fran up its steps under the canopy. */
  capellan: { x: 40, z: 21 },
  fran: { x: 43, z: 20 },
} as const;

/**
 * The salon's zones (docs/quests/luca.md § La Sagrada peluquería), in the order the way goes round
 * the crossing: the Nativity arm by the door, the nave, the Passion arm, the apse; then the crossing.
 */
export type ZoneId = 'recepcion' | 'sillones' | 'carta' | 'abside';
export interface Zone {
  id: ZoneId; name: string;
  /** Its fight, where its foes stand waiting, and how near walking up to them starts it (`trip`: crossing that rect starts it). */
  encounter: `luca-${ZoneId}`; cell: Cell; radius: number; trip?: { x: number; z: number; w: number; d: number };
  /** Its rect on the plan, for the walk-in light and the salon's dressing. */
  area: { x: number; z: number; w: number; d: number };
  /** Which windows light it (src/vidrieras.ts), and the colour it gives back to Luca. */
  walk: WalkId; colour: string;
}
export const ZONES: readonly Zone[] = [
  // Across the Nativity arm's mouth: nobody gets into the basilica without meeting them.
  { id: 'recepcion', name: 'La recepción', encounter: 'luca-recepcion', cell: { x: 36, z: 32 }, radius: 3, trip: { x: 27, z: 33, w: 19, d: 2 }, area: { x: 27, z: 29, w: 19, d: 11 }, walk: 'nacimiento', colour: '#3f8fe0' },
  { id: 'sillones', name: 'Los sillones', encounter: 'luca-sillones', cell: { x: 12, z: 20 }, radius: 3.5, area: { x: 1, z: 6, w: 22, d: 29 }, walk: 'nave', colour: '#e0503a' },
  { id: 'carta', name: 'La carta de colores', encounter: 'luca-carta', cell: { x: 36, z: 4 }, radius: 3, area: { x: 27, z: 1, w: 19, d: 4 }, walk: 'pasion', colour: '#f08a2c' },
  { id: 'abside', name: 'El ábside', encounter: 'luca-abside', cell: { x: 56, z: 20 }, radius: 3.5, area: { x: 51, z: 6, w: 10, d: 29 }, walk: 'abside', colour: '#f2c94c' },
];
/** The zone whose windows light `cell`, if any (the crossing and the hall are the nave's light). */
export const zoneAt = (cell: Cell) => ZONES.find(z => cell.x >= z.area.x && cell.x < z.area.x + z.area.w && cell.z >= z.area.z && cell.z < z.area.z + z.area.d);
const column = (x: number, zs: number[]) => zs.map(z => ({ x, z }));
const row = (z: number, xs: number[]) => xs.map(x => ({ x, z }));
const span = (a: number, b: number, skip: number[] = []) => Array.from({ length: b - a + 1 }, (_, i) => a + i).filter(n => !skip.includes(n));
/**
 * The queues that keep the way (docs/quests/luca.md § Review A): grey visitors behind queue belts,
 * *esperando turno*, across the nave, the Passion arm and the apse. Each moves on when the zone
 * before it is won. `look`: where the queue is looked at from.
 */
export const QUEUES: readonly { id: string; after: ZoneId; cells: Cell[]; look: Cell }[] = [
  { id: 'nave', after: 'recepcion', cells: column(23, span(6, 34)), look: { x: 24, z: 22 } },
  { id: 'pasion', after: 'sillones', cells: row(5, span(27, 45, [31, 41])), look: { x: 36, z: 6 } },
  { id: 'abside', after: 'carta', cells: column(50, span(7, 33, [15, 25])), look: { x: 50, z: 26 } },
];
/**
 * The mirrors in the nave (docs/quests/luca.md § Review C): three of the salon's mirrors, each
 * turned a quarter at a time (`\` 0, `/` 1). The light of a north window comes down the aisle at
 * x 8; brought to the chaplains' chairs it dazzles them before their fight. The beam's rules are in
 * src/espejos.ts.
 */
export const MIRRORS: readonly Cell[] = [{ x: 8, z: 12 }, { x: 20, z: 12 }, { x: 20, z: 20 }];
/** How they stand when the salon opens: every one sends the light somewhere else. */
export const MIRRORS_START: readonly (0 | 1)[] = [1, 1, 0];
/** Where the window's beam comes in, which way, and the chaplains' chairs it is for. */
export const BEAM = { from: { x: 8, z: 6 }, dir: { x: 0, z: 1 }, target: { x: 12, z: 20 } } as const;
/** Luca's own colours, back once Fran is beaten: the loud shirt, the trousers. */
export const LUCA_COLOURS = { shirt: '#f08a2c', trousers: '#2f8f7a' } as const;

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const luca = (text: string): DialogueLine => ({ speaker: 'luca', text });
const fran = (text: string): DialogueLine => ({ speaker: 'fran', text });
const capellan = (text: string): DialogueLine => ({ speaker: 'capellan', text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });

export const LINES_LUCA = {
  /** The photo in the flat, the first time: Luca has gone grey in it. */
  photo: group('aitor',
    gerard('Luca y yo, el primer año en el cole. Él con una camisa imposible.'),
    aitor('Gerard. Mírale bien.'),
    gerard('Está gris. Solo él. Todo lo demás tiene color.'),
    aitor('Como si se lo hubieran borrado con una goma.'),
  ),
  photoAgain: group('aitor', gerard('Sigue gris.')),
  /** Once he has his colours back. */
  photoAfter: group('aitor', gerard('La camisa imposible. Otra vez naranja.'), aitor('Nunca pensé que me alegraría tanto de verla.')),
  /** The tour poster on the Meridiana. */
  poster: group('aitor',
    gerard('«La luz de las vidrieras». Visitas guiadas a la Sagrada Família.'),
    aitor('A la vidriera le falta un trozo. Esa franja es gris.'),
  ),
  /** The photo and one of the Sagrada clues seen: Aitor puts them together. */
  linkTv: group('aitor',
    aitor('Ese hombre de la tele que no sale de la Sagrada Família, midiendo columnas…'),
    aitor('¿No será Fran?'),
    gerard('Si Fran está ahí, Luca no andará lejos.'),
  ),
  linkPoster: group('aitor',
    aitor('Luca gris en la foto. Una vidriera gris en el cartel.'),
    gerard('La Sagrada Família.'),
    aitor('Habrá que ir a mirar.'),
  ),
  /** The door, before they have seen Luca: Aitor sees him first. */
  doorBefore: group('aitor', aitor('Espera. Ese de allí, junto al estanque… ¿No es Luca?')),
  /** By the pond, the first time. */
  arrive: group('luca',
    luca('Gerard. Aitor.'),
    aitor('¿Ni un abrazo? Tú siempre nos abrazas. Siempre.'),
    luca('Ya. Siempre.'),
    gerard('Luca, ¿qué haces aquí parado?'),
    luca('Fran está dentro. Desde hace días. Mide las columnas. Dice que lo ha entendido todo.'),
    luca('Entro a buscarle y… me apago. Cada vez un poco más. Mírame.'),
    aitor('Estás gris, Luca.'),
    luca('Llevaba una camisa. No me acuerdo de qué color era.'),
    gerard('Entramos nosotros.'),
    luca('Os espero aquí. Aquí todavía me queda algo.'),
  ),
  /** Talking to him again, by how many zones are won. */
  waiting: [
    group('luca', luca('Sigo aquí.')),
    group('luca', luca('Me ha vuelto algo. Azul. Aquí, en el cuello.'), gerard('Vamos bien.')),
    group('luca', luca('Mira, ya puedo… perdona, ¿te puedo coger del brazo? Es que hacía días.'), aitor('Las veces que quieras.')),
    group('luca', luca('Estoy hablando más, ¿verdad? Eso es buena señal. Conmigo, siempre es buena señal.')),
    group('luca', luca('Ya casi soy yo. Queda Fran.'), luca('Id a por él. Y no le dejéis hablar de hiperboloides.')),
  ] as Dialogue[],
  /** His reflection in the pond. */
  reflejo: group('aitor',
    gerard('En el agua, Luca está a todo color. Habla y mueve las manos. No se le oye.'),
    aitor('Fuera del agua, el mismo Luca. Gris. Quieto.'),
  ),
  reflejoAfter: group('aitor', gerard('En el agua y fuera de ella, el mismo color.')),
  /** In through the door, the first time. */
  inside: group('aitor',
    aitor('Huele a laca.'),
    gerard('Aquí todavía es una iglesia. Al fondo, no.'),
    aitor('Y la luz… no se está quieta.'),
  ),
  insideAgain: group('aitor', aitor('La luz sigue cambiando.')),
  /** Walking up to each zone's foes, what is there. */
  zones: {
    recepcion: group('aitor', aitor('Un mostrador de peluquería, aquí. Y una agenda: «Fran. Todo el día ocupado».'), gerard('Polillas. Grises, como Luca.')),
    sillones: group('capellan',
      gerard('Sillones de peluquería, en fila, donde estaban las sillas. Y espejos.'),
      capellan('Siéntense. El señor estará con ustedes enseguida.'),
      aitor('Ese cura lleva el pelo azul. Y ese otro, de punta.'),
    ),
    carta: group('aitor', gerard('Las vidrieras son una carta de colores.'), aitor('Le faltan los de Luca. Los tienen esas cosas.')),
    abside: group('aitor', gerard('Lentes. Cartas de estrellas. Esto es de Luca.'), aitor('Y lo están usando contra él.')),
  } satisfies Record<ZoneId, Dialogue>,
  /** A zone won: a colour goes out of the door, and the queue in front moves on a step; by how many are won. */
  zoneWon: [
    group('aitor', aitor('¿Lo has visto? Algo ha salido por la puerta. Un color.'), gerard('Y la cola de la nave se ha movido. Ha pasado uno.')),
    group('aitor', aitor('Otro color, hacia fuera.'), aitor('La cola de la Pasión avanza. Nos toca.')),
    group('aitor', gerard('Ya van tres.'), aitor('La del ábside también se mueve. Es la última.')),
    group('aitor', aitor('El último. El capellán de la entrada ya no está tan tranquilo.')),
  ] as Dialogue[],
  /** A queue looked at while it still keeps the way. */
  queue: group('aitor',
    gerard('Gente gris, en fila, detrás de una cinta. Esperan turno.'),
    aitor('Y no se mueven hasta que pase el de delante.'),
  ),
  /** The nave's mirrors, walked up to the first time: the window's light lands on one and goes nowhere. */
  mirrors: group('aitor',
    aitor('La luz de esa vidriera cae en un espejo. Y rebota contra la pared.'),
    gerard('Estos espejos giran. Son de peluquería.'),
  ),
  /** The light brought to the chaplains' chairs. */
  dazzled: group('aitor',
    aitor('Ahí. La luz les cae en la cara, en los sillones.'),
    gerard('Se tapan los ojos. Ahora no nos van a ver venir.'),
  ),
  /** The chaplain before the presbytery, by how many zones are won; and once all four are. */
  capellan: [
    group('capellan', capellan('El señor está atendiendo. Hay que esperar turno.')),
    group('capellan', capellan('Hay que esperar turno. El señor está muy ocupado.')),
    group('capellan', capellan('Esperen. Esperen, por favor. No toquen nada.')),
    group('capellan', capellan('Ya casi. Ya casi les toca. Siéntense.')),
  ] as Dialogue[],
  ready: group('capellan', capellan('Ya les toca. Pasen.'), capellan('El señor no levanta la vista. No se ofendan.')),
  /** Fran, under the canopy, before the fight. */
  fran: group('fran',
    fran('Ah. Gerard. Aitor.'),
    fran('¿Sabéis qué es esto? Un hiperboloide. Solo rectas, y sale una curva.'),
    fran('Gaudí lo vio. Ahora lo veo yo. Todo encaja.'),
    aitor('Luca está fuera. Gris.'),
    fran('¿Luca? Luca siempre está fuera.'),
    fran('Siéntense. Les toca.'),
  ),
  /** Fran beaten: the violet goes, the cape comes off, and he walks out without a word. */
  won: group('aitor',
    gerard('Se le ha ido el violeta de los ojos.'),
    aitor('Se quita la capa. La mira como si no fuera suya.'),
    gerard('Y se va. Sin decir nada.'),
  ),
  /** Outside, Luca in full colour. */
  home: group('luca',
    luca('¡Gerard! ¡Aitor! Venid aquí. No, más cerca. Así.'),
    luca('Era naranja. La camisa. ¡Naranja! Lo tenía en la punta de la lengua.'),
    gerard('Fran ha salido por el otro lado.'),
    luca('Ya. Le he visto pasar. Ni me ha mirado.'),
    luca('Bueno. Ahora me voy a casa a ponerme lo más horrible que tenga. Lo más horrible.'),
  ),
  /** Talking to him after it all. */
  after: group('luca', luca('¿A que es horrible? Me encanta. Ven, que te dé otro abrazo.')),
} as const;
