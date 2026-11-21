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
  /** Luca, grey, on the pond's north bank where no tree stands over him, facing the Nativity facade. */
  luca: { x: 75, z: 158 },
  /** Where his reflection is looked at, and where it stands in the water (in colour). */
  reflejo: { x: 76, z: 158 },
  water: { x: 74.6, z: 158.9 },
  /** Back out of the basilica, in front of the door. */
  outside: { x: 73, z: 119 },
  /** The party comes out here after Fran: by Luca. */
  won: { x: 75, z: 157 },
  /** In through the door. */
  inside: { x: 36, z: 37 },
  /** The chaplain who keeps the presbytery, beside the guard, and Fran up its steps under the canopy. */
  capellan: { x: 40, z: 21 },
  fran: { x: 43, z: 20 },
} as const;

/**
 * The salon's zones (docs/quests/luca.md § La Sagrada peluquería), each with its fight, in the order the
 * way goes round the crossing: the Nativity arm by the door, the nave, the Passion arm. Then the apse
 * and the crossing are Fran's (APSE).
 */
export type ZoneId = 'recepcion' | 'sillones' | 'carta';
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
];
/**
 * The apse: Fran's zone, with no fight of its own (El Telescopio and La Laca were cut, Aitor 2026-11-20).
 * Its queue moves on once La carta is won; Luca's lenses and star charts stand there, lit by its own
 * windows, and the first time it is walked into Gerard and Aitor say whose they are.
 */
export const APSE = { name: 'El ábside', cell: { x: 56, z: 20 }, area: { x: 51, z: 6, w: 10, d: 29 }, walk: 'abside' as WalkId };
/** The side whose windows light `cell`, if any (the crossing and the hall are the nave's light). */
export const zoneAt = (cell: Cell) => [...ZONES, APSE].find(z => cell.x >= z.area.x && cell.x < z.area.x + z.area.w && cell.z >= z.area.z && cell.z < z.area.z + z.area.d);
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
/** How many of a queue's cells still stand at each end once it has moved on: the way opens in the middle, the rest wait on by the walls. */
export const QUEUE_LEFT = 3;
/** The cells of a queue that still keep Gerard out: all of them, or only its two ends once it has moved on. */
export const queueCells = (queue: { cells: Cell[] }, moved: boolean): Cell[] => moved ? [...queue.cells.slice(0, QUEUE_LEFT), ...queue.cells.slice(-QUEUE_LEFT)] : queue.cells;
/**
 * The mirrors in the nave (docs/quests/luca.md § Review C): three of the salon's mirrors, each
 * turned a quarter at a time (`\` 0, `/` 1). The light of a north window comes down the aisle at
 * x 8; brought to the chaplains' chairs it dazzles them before their fight. The beam's rules are in
 * src/espejos.ts.
 */
export const MIRRORS: readonly Cell[] = [{ x: 8, z: 12 }, { x: 20, z: 12 }, { x: 20, z: 20 }];
/**
 * How they stand when the salon opens: the first already sends the light along the north aisle, the
 * second throws it against the wall by the nave's mouth (where whoever comes in from the crossing
 * sees it), the third would send it out to the crossing. Two turns bring it to the chairs, each one
 * moving the light in sight of who turned it.
 */
export const MIRRORS_START: readonly (0 | 1)[] = [0, 1, 0];
/** Where the nave is come into from the crossing: the light against the wall is seen from here. */
export const MIRRORS_SEEN: Cell = { x: 22, z: 16 };
/**
 * The salon's furniture that stands on the floor (src/peluqueria-scenery.ts draws it at these cells;
 * the story keeps Gerard out of them): the reception desk by the Nativity door, three cells along x
 * with its front to the door; the dye bar along the Passion arm's end wall; Luca's lenses on brass
 * stands and his star charts on easels, in the apse.
 */
export const FURNITURE = {
  desk: { x: 41, z: 36 },
  bar: { from: 30, to: 42, z: 1 },
  lenses: [{ x: 53, z: 12 }, { x: 57, z: 16 }, { x: 57, z: 24 }, { x: 53, z: 28 }],
  charts: [{ x: 55, z: 9 }, { x: 59, z: 20 }, { x: 55, z: 31 }],
} as const;
export const SALON_SOLID: readonly Cell[] = [
  ...row(FURNITURE.desk.z, span(FURNITURE.desk.x - 1, FURNITURE.desk.x + 1)),
  ...row(FURNITURE.bar.z, span(FURNITURE.bar.from, FURNITURE.bar.to)),
  ...FURNITURE.lenses, ...FURNITURE.charts,
];
/**
 * What can be looked at in the salon, one thing a zone: the appointment book on the desk, the dye
 * bowls on the bar, one of Luca's lenses. Each says a little of what Fran has done with what was Luca's.
 */
export const LOOKS = [
  { id: 'luca-agenda', label: 'Mirar la agenda', cell: { x: 41, z: 37 } },
  { id: 'luca-tintes', label: 'Mirar los tintes', cell: { x: 32, z: 2 } },
  { id: 'luca-lente', label: 'Mirar la lente', cell: { x: 52, z: 28 } },
] as const;
export type LookId = typeof LOOKS[number]['id'];
/**
 * Coming in the first time, the mission in three looks, each held while its lines are said
 * (`LINES_LUCA.inside`, one dialogue a look): Fran under the canopy with his back to everyone, the
 * queue of grey visitors that keeps the way to him, and the moths by the desk, eating a colour.
 */
export const SALON_VIEWS = [
  { cell: { x: 42, z: 21 }, height: 7 },
  { cell: { x: 24, z: 22 }, height: 11 },
  { cell: { x: 36, z: 31 }, height: 5 },
] as const;
/** How close the camera comes to a zone's foes as its lines are said, before its fight. */
export const ZONE_VIEW = 6.5;
/** Where a colour won back leaves the basilica: the Nativity door, on its way to Luca. */
export const COLOUR_OUT: Cell = { x: 36, z: 39 };
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
    luca('Ja. Sempre.'),
    gerard('Luca, què hi fas aquí parat?'),
    luca('El Fran és a dins. Fa dies. Mesura les columnes. Diu que ho ha entès tot.'),
    luca('Entro a buscar-lo i… m\'apago. Cada vegada una mica més. Mira\'m.'),
    aitor('Estás gris, Luca.'),
    luca('Portava una camisa. No me\'n recordo de quin color era.'),
    gerard('Hi entrem nosaltres.'),
    luca('Us espero aquí. Aquí encara em queda alguna cosa.'),
  ),
  /** Talking to him again, by how many zones are won. */
  waiting: [
    group('luca', luca('Encara soc aquí.')),
    group('luca', luca('M\'ha tornat alguna cosa. Blau. Aquí, al coll.'), gerard('Anem bé.')),
    group('luca', luca('Mira, ja puc… perdona, et puc agafar del braç? És que feia dies.'), aitor('Las veces que quieras.')),
    group('luca', luca('Estic parlant més, oi? Això és bon senyal. Amb mi, sempre és bon senyal.')),
    group('luca', luca('Ja gairebé soc jo. Queda el Fran.'), luca('Aneu a buscar-lo. I no el deixeu parlar d\'hiperboloides.')),
  ] as Dialogue[],
  /** His reflection in the pond. */
  reflejo: group('aitor',
    gerard('En el agua, Luca está a todo color. Habla y mueve las manos. No se le oye.'),
    aitor('Fuera del agua, el mismo Luca. Gris. Quieto.'),
  ),
  reflejoAfter: group('aitor', gerard('En el agua y fuera de ella, el mismo color.')),
  /**
   * In through the door, the first time: what is going on, said in few words over three looks
   * (SALON_VIEWS): who, what keeps the way, and what there is to take back.
   */
  inside: [
    group('aitor', gerard('Fran. Bajo el baldaquino, de espaldas a todo.'), aitor('Huele a laca. Ha hecho de la basílica su peluquería.')),
    group('aitor', aitor('Y toda esa gente gris hace cola para él. Por ahí no se pasa.')),
    group('aitor',
      gerard('Polillas. Grises, como Luca.'),
      aitor('Se le están comiendo el color. Lo que le falta está aquí dentro, a trozos.'),
      gerard('Pues se lo sacamos. Trozo a trozo, hasta llegar a Fran.'),
    ),
  ] as Dialogue[],
  insideAgain: group('aitor', aitor('La luz sigue cambiando.')),
  /** Walking up to each zone's foes, what is there. */
  zones: {
    recepcion: group('aitor', aitor('Vienen hacia nosotros. Y la luz… no se está quieta.')),
    sillones: group('capellan',
      gerard('Sillones de peluquería, en fila, donde estaban las sillas. Y espejos.'),
      capellan('Siéntense. El señor estará con ustedes enseguida.'),
      aitor('Ese cura lleva el pelo azul. Y ese otro, de punta.'),
    ),
    carta: group('aitor', gerard('Esas camisas son de Luca.'), aitor('Sin nadie dentro. Y solo una tiene color: la de la luz que hay ahora.')),
  } satisfies Record<ZoneId, Dialogue>,
  /** The apse walked into the first time, once the way to Fran is open: Luca's things, there to look at. */
  apse: group('aitor', gerard('Lentes. Cartas de estrellas. Esto es de Luca.'), aitor('Y lo están usando contra él.')),
  /**
   * A zone won: its colour has just gone out of the door, seen (COLOUR_OUT), and the queue in front
   * moves on a step; by how many are won.
   */
  zoneWon: [
    group('aitor', aitor('Azul. Ha salido por la puerta, hacia Luca.'), gerard('Y la cola de la nave se ha movido. Ha pasado uno.')),
    group('aitor', aitor('Otro color para Luca.'), aitor('La cola de la Pasión avanza. Nos toca.')),
    group('aitor', gerard('Ya van tres.'), aitor('La cola del ábside se mueve. Y el capellán que guarda a Fran ya no está tan tranquilo.')),
  ] as Dialogue[],
  /** A queue looked at while it still keeps the way. */
  queue: group('aitor',
    gerard('Gente gris, en fila, detrás de una cinta. Esperan turno.'),
    aitor('Y no se mueven hasta que pase el de delante.'),
  ),
  /** The nave come into, the first time: the window's light goes from mirror to mirror and ends on a wall. */
  mirrors: group('aitor',
    aitor('La luz de esa vidriera va de espejo en espejo. Y acaba en la pared.'),
    gerard('Estos espejos giran. Son de peluquería.'),
  ),
  /** What is looked at in the salon (LOOKS). */
  looks: {
    'luca-agenda': group('aitor', gerard('La agenda de Fran. «Fran», «Fran», «Fran». Todas las horas, él.'), aitor('Ni un hueco para nadie más.')),
    'luca-tintes': group('aitor', gerard('Cuencos de tinte. Naranja, verde, azul. Sin estrenar.'), aitor('Los colores de Luca. Guardados como si fueran género.')),
    'luca-lente': group('aitor', gerard('Una lente de Luca. Apunta a las columnas, no al cielo.'), aitor('Para medir. Ya no para mirar.')),
  } satisfies Record<LookId, Dialogue>,
  /** The light brought to the chaplains' chairs. */
  dazzled: group('aitor',
    aitor('Ahí. La luz les cae en la cara, en los sillones.'),
    gerard('Se tapan los ojos. Ahora no nos van a ver venir.'),
  ),
  /** The chaplain before the presbytery, by how many zones are won; and once all three are. */
  capellan: [
    group('capellan', capellan('El señor está atendiendo. Hay que esperar turno.')),
    group('capellan', capellan('Hay que esperar turno. El señor está muy ocupado.')),
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
    luca('Gerard! Aitor! Veniu aquí. No, més a prop. Així.'),
    luca('Era taronja. La camisa. Taronja! Ho tenia a la punta de la llengua.'),
    gerard('El Fran ha sortit per l\'altre costat.'),
    luca('Ja. L\'he vist passar. Ni m\'ha mirat.'),
    luca('Bueno. Ara me\'n vaig a casa a posar-me el més horrible que tingui. El més horrible.'),
  ),
  /**
   * Before they go, Gerard and Aitor send him to the choir (docs/quests/coro.md § The choir room):
   * every mission ends with it, and it is why the people helped turn up there every morning after.
   */
  coro: group('luca',
    gerard('Luca, espera. Una cosa més.'),
    aitor('El coro ya tiene local: A cop de diapasó, en la Meridiana, al lado de casa.'),
    gerard('Passi el que passi, vés-hi. Recorda-ho sempre.'),
    luca('A cop de diapasó. Hi seré. Amb el més horrible que tingui.'),
  ),
  /** Talking to him after it all. */
  after: group('luca', luca('Oi que és horrible? M\'encanta. Vine, que et faig una altra abraçada.')),
} as const;
