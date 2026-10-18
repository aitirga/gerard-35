/**
 * Chapter 1, block 1: Gerard's birthday morning in Sant Quirze. Lines, places and tutorials live
 * here; `src/story.ts` decides when each one plays. docs/chapter-1.md explains the design.
 */
import type { Dialogue, DialogueLine } from './dialogue';

const g = (text: string, expression?: string): DialogueLine => ({ speaker: 'gerard', text, expression });
const mama = (text: string): DialogueLine => ({ speaker: 'mama', text });
const jan = (text: string): DialogueLine => ({ speaker: 'jan', text });
const bernat = (text: string): DialogueLine => ({ speaker: 'bernat', text });
/** Chapter 2: Gerard at 35, and Aitor. */
const gerard35 = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const withAitor = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const solo = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', lines });
const withMama = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'mama', lines });
const withJan = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'jan', lines });
const withBernat = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'bernat', lines });

/** Where the people and loose things of block 1 stand. Cells must be walkable (see tests). */
export const PLACES = {
  /** Gerard wakes up beside his bed. */
  wake: { environment: 'home-floor-2', cell: { x: 3, z: 4 } },
  mama: { environment: 'home-floor-1', cell: { x: 18, z: 10 } },
  jan: { environment: 'home-floor-2', cell: { x: 17, z: 12 } },
  /** On Jan's desk; picked up from the floor next to it. */
  pocion: { environment: 'home-floor-2', cell: { x: 17, z: 10 } },
  /** Hanging by the front door in the recibidor. */
  mochila: { environment: 'home-floor-1', cell: { x: 5, z: 1 } },
  /** Bernat steps out of his front patio when he joins. */
  bernat: { environment: 'maresme', cell: { x: 9, z: 24 } },
  /** Walking past this row with Bernat makes him stop: the dogs are just below. */
  southRow: 30,
  /** La Reina Bubbaloo's minion lives in the manhole at the bottom of the street, among the dogs. */
  minion: { manhole: { x: 15, z: 38 } },
  /**
   * La Reina Bubbaloo's palace rises past the north end of the street (docs/bubbaloo-palace.md):
   * `gate` is the middle of La Pompa in street cells, `door` the cell in front of it.
   */
  palace: { gate: { x: 16, z: 0.6 }, door: { x: 16, z: 2 } },
  /** Inside the palace: where La Pompa lets them in, and the strawberry gum bowl in the gallery. */
  palaceEntry: { environment: 'palacio', cell: { x: 16, z: 18 } },
  chicle: { environment: 'palacio', cell: { x: 5, z: 9 } },
  /**
   * Chapter 2 opens in the Meridiana flat: Gerard and Aitor asleep in the double bed, heads on the
   * pillows against the south wall (`bed` is where each one's hips rest: Gerard east, Aitor west).
   * Gerard wakes with a start and gets out on his side (`wakeUp`); Aitor gets out on his (`aitor`).
   * The Bubbaloo wrapper lies on Gerard's nightstand (`spot`), picked up from the cell in front of it.
   */
  bed: { gerard: { x: 11.02, z: 15.6 }, aitor: { x: 9.92, z: 15.36 } },
  wakeUp: { environment: 'meridiana', cell: { x: 12, z: 14 } },
  aitor: { environment: 'meridiana', cell: { x: 9, z: 14 } },
  envoltorio: { environment: 'meridiana', cell: { x: 12, z: 15 }, spot: { x: 11.78, z: 16.45, y: .53 } },
  /** The drain in the wrapper room the second minion rises from. */
  drain: { x: 5, z: 16 },
  /** Past this row, on the way back south, Bernat reminds Gerard where the palace is. */
  awayRow: 24,
} as const satisfies Record<string, unknown>;

/** How far Gerard may wander from Bernat once he stops, in cells. */
export const LEASH = 4;

export const LINES = {
  wake: solo(g('¡Hoy es mi cumpleaños!'), g('Huele a tostadas… Mamá ya debe de estar en la cocina.')),
  jan: withJan(
    jan('Mira quién se ha despertado. ¡Felicidades, enano!'),
    g('¡Gracias! ¿Me has comprado algo?'),
    jan('Yo no, pero mamá lleva toda la semana escondiendo una caja de zapatos…'),
    jan('Y si ves un frasco raro en mi mesa, ni lo toques. Es… experimental.'),
  ),
  janAgain: withJan(jan('Venga, baja ya, que mamá te espera.')),
  janAfterPotion: withJan(jan('¿Has tocado mi mesa? …Da igual. Si te sale una cola, no me eches la culpa.')),
  pocion: solo(g('Un frasco con una etiqueta: «POCIÓ. NO TOCAR». Es la letra de Jan.'), g('…Me lo llevo. Por si acaso.')),
  mama: withMama(
    mama('Bon dia, campeón! Per molts anys, Gerard!'),
    g('¡Gracias, mamá!'),
    mama('Toma, ábrelo. Ya sé que no es una consola…'),
    g('¡Unas zapatillas de correr! ¡Son chulísimas!'),
    mama('Así llegarás a tiempo al cole, por una vez. Y no te olvides la mochila, que está en el recibidor.'),
    mama('Ah, y pasa a buscar a Bernat, que vais juntos.'),
  ),
  mamaWaiting: withMama(mama('¿Qué haces aún aquí? La mochila está en el recibidor. ¡Y a buscar a Bernat!')),
  mamaBye: withMama(mama('Venga, que llegáis tarde. ¡Que tengas un día precioso, cariño!')),
  mochila: solo(g('Mi mochila. Libros, estuche… y un bocadillo de fuet. Mamá piensa en todo.')),
  leaveBeforeBreakfast: solo(g('Huele a tostadas… Primero, a la cocina.')),
  leaveWithoutBackpack: withMama(mama('¡Gerard! ¿A dónde vas sin mochila? Está en el recibidor.')),
  bernatNotYet: solo(g('Aún no tengo la mochila. Mejor vuelvo a casa primero.')),
  bernatJoins: withBernat(
    g('Ding-dong… ¡Bernat! ¡Que llegamos tarde!'),
    bernat('¡Ya bajo, ya bajo!'),
    bernat('¡Ey! ¡Per molts anys, Gerard! ¿Zapatillas nuevas? Qué fuerte.'),
    g('¡Regalo de mamá! Venga, vamos al cole.'),
    bernat('Vamos. Aunque hoy tengo una sensación rara… Bah, será el sueño.'),
  ),
  bernatHere: withBernat(bernat('Que ya estoy aquí, hombre. ¡Calle abajo!')),
  dejavu: withBernat(
    g('¿Bernat? ¿Qué te pasa? Vamos, que llegamos tarde.'),
    bernat('Espera. Esos perros de ahí abajo… y esa alcantarilla, que no para de hacer burbujas.'),
    bernat('Ayer estuve diseñando un juego. Empezaba así: un cumpleaños, unas zapatillas nuevas, dos amigos bajando la calle…'),
    g('¿Un déjà-vu?'),
    bernat('Peor. Es igual. Igualito. Hasta el último detalle.'),
    bernat('Gerard… creo que la he cagado.'),
  ),
  /** After the minion's head pops its bubble and sinks; the dogs' eyes are pink and the fight starts right after. */
  minion: withBernat(
    g('¿Has visto eso? ¡Ha salido algo rosa de la alcantarilla!'),
    g('Parecía… un chicle. Con ojos.'),
    bernat('Un esbirro de la Reina Bubbaloo. La mala de mi juego. Me la inventé yo.'),
    bernat('Sus esbirros viven en las alcantarillas. Lo pringan todo… y lo que pringan, le obedece.'),
    g('Bernat… los perros. Mírales los ojos.'),
    bernat('¡Rosas! ¡Cuidado, Gerard, que vienen a por nosotros!'),
  ),
  /** The first fight is won: the light has turned. */
  afterFight: withBernat(
    g('Se han ido corriendo… ¿Y el chicle ese?'),
    bernat('Sigue ahí abajo, seguro. Escuchando.'),
    g('¿Soy yo, o se ha puesto todo… rosa? Y oscuro.'),
    bernat('No eres tú. En mi libreta, cuando alguien le gana a un esbirro, la Reina Bubbaloo se entera…'),
    bernat('…y tiñe el cielo de su color. Para que sepas que te está mirando.'),
    bernat('Gerard… mira las casas del fondo de la calle.'),
  ),
  /** The palace has risen at the north end of the street. */
  palaceRises: withBernat(
    g('¿Qué… qué es eso?'),
    bernat('Es justo como en mi sueño. El palacio de la Reina Bubbaloo.'),
    bernat('Se está volviendo real, Gerard. Todo.'),
    g('¿Y qué hacemos? ¿Ir al cole como si nada?'),
    bernat('En mi sueño entrábamos. Por la pompa de la puerta.'),
  ),
  bernatPalace: withBernat(bernat('La pompa de la puerta… En mi sueño se atravesaba sin más. Pegajosa, pero se atravesaba.')),
  /** Through La Pompa for the first time. */
  inPalace: withBernat(
    bernat('¡Puaj! Se me ha pegado chicle hasta en las orejas.'),
    g('Bernat… estamos dentro.'),
    bernat('Huele a fresa. Como en el sueño.'),
  ),
  leaveLocked: solo(g('La pompa se ha cerrado detrás de nosotros. Está dura como una pared.')),
  curtain: withBernat(
    g('Una cortina de chicle. Está pegajosa: no hay manera de pasar.'),
    bernat('En mi sueño la reina estaba arriba. Pero aún no… aún no.'),
  ),
  backDoorStuck: solo(g('Esta puerta está pegada con chicle. No se mueve ni un milímetro.')),
  portrait1: withBernat(g('«La coronación». Se pone la corona ella sola.'), bernat('Es que nadie más se atrevía.')),
  portrait2: solo(g('«En el trono». Sentada en una bola de chicle gigante… con cara de aburrirse muchísimo.')),
  portrait3: withBernat(g('«La gran pompa». El marco está abollado por la pompa.'), bernat('Esa la dibujé yo. Igualita.')),
  portrait4: solo(g('«Desde el balcón». Saluda a una ciudad de noche: una torre de colores, una avenida larguísima…'), g('No es Sant Quirze.')),
  portrait5: withBernat(g('Este es… un dibujo con rotuladores. Firmado: «Bernat».'), bernat('…Esto estaba en mi libreta.')),
  chicle: solo(g('Un bol de chicles de fresa. …Uno para el camino.')),
  /** Stepping into the wrapper room: the drain gurgles, then the minion rises. */
  drainGurgle: withBernat(g('¿Oyes eso? Viene del sumidero.')),
  drainRises: withBernat(bernat('Ese no se va a esconder.'), g('¡Bernat, atrás!')),
  /** No-ta has burst the minion. */
  afterNoista: withBernat(
    bernat('¿Qué… qué ha sido eso? ¿Le has dicho que no y ha reventado?'),
    g('No lo sé. Me ha salido solo.'),
    bernat('Siempre llevas la contraria. Siempre. Y hoy… hoy nos ha salvado.'),
    g('Bernat… ¿qué está pasando aquí? De verdad.'),
    bernat('Creo… creo que estamos en el castillo de la Reina. Mi sueño no era un sueño, Gerard.'),
    bernat('Ella es real. Y si nos ha traído hasta aquí, es porque quiere algo de nosotros. Quiere…'),
  ),
  /** Chapter 2: Gerard wakes up with a start in the Meridiana flat, and Aitor is there. */
  waking: withAitor(
    gerard35('¡NO!'),
    aitor('Ey, ey… tranquilo. Estás en casa. Soy yo.'),
    aitor('Estabas gritando «¡no!» en sueños. Llevándome la contraria hasta dormido.'),
    gerard35('He soñado con Bernat. Con la calle de mis padres… y unas manos de chicle enormes.'),
    aitor('¿Manos de chicle? Eso te pasa por cenar pizza a las once.'),
    aitor('Venga, despierta del todo. Que hoy es tu cumpleaños: treinta y cinco, ¿eh?'),
    gerard35('…Treinta y cinco. Sí.'),
    aitor('Y hoy no me despego de ti. Donde vayas tú, voy yo.'),
  ),
  aitorAgain: withAitor(aitor('Feliz cumpleaños, dormilón. El café está en la cocina… si te lo haces tú.')),
  aitorWrapper: withAitor(gerard35('Aitor… ¿esto es tuyo?'), aitor('¿Un chicle Bubbaloo? Yo no como de eso desde que tenía diez años.')),
  envoltorio: withAitor(
    gerard35('Un envoltorio de chicle. Bubbaloo, de fresa.'),
    gerard35('…Estaba en mi mesilla. Y huele igual que en el sueño.'),
  ),
  bernatInPalace: withBernat(bernat('No te separes. En mi sueño, este sitio no acababa nunca.')),
  bernatAfterNoista: withBernat(bernat('Noísta. Así te voy a llamar. El que siempre dice que no.')),
  bernatFight: withBernat(bernat('¡Gerard, los perros! ¡Hay que quitarles ese rosa de los ojos!')),
  bernatAfter: withBernat(bernat('No me mires así. Esos perros no estaban ayer en la calle… estaban en mi libreta.')),
  bernatAfterFight: withBernat(bernat('La Reina Bubbaloo era solo un dibujo. Un dibujo, Gerard. Con corona de chicle.')),
} satisfies Record<string, Dialogue>;

/** Said inside the palace fight, as speech over their heads (the rest of the HUD is shut during fights). */
export const BATTLE_LINES = {
  aboutToDie: { speaker: 'bernat', text: '¡Gerard, me va a matar!' },
  no: { speaker: 'gerard', text: '¡NO!' },
} as const satisfies Record<string, DialogueLine>;

/**
 * Key hints: a key and a verb, shown the first time the action makes sense and gone once used.
 * They never say what to do or where to go; that comes from exploring and from people.
 */
export const HINTS = {
  move: { keys: 'W A S D', verb: 'Caminar' },
  run: { keys: 'Shift', verb: 'Correr' },
  items: { keys: 'I', verb: 'Objetos' },
  party: { keys: 'C', verb: 'Equipo' },
  /** Chapter 2: Aitor walks with Gerard, and a second controller can take him. */
  duo: { keys: 'Mando 2', verb: 'Jugar como Aitor' },
} as const;
export type HintId = keyof typeof HINTS;

export const CARDS = {
  intro: { kicker: 'CAPÍTULO 1 · SANT QUIRZE DEL VALLÈS', title: 'Una mañana de otoño', text: 'Hoy es tu cumpleaños.' },
} as const;
export type CardId = keyof typeof CARDS;

/** What Bernat mutters over his head while he stalls, one more line each time Gerard pulls away. */
export const BUBBLES = {
  stalled: ['¿Gerard…?', 'Espera.', 'Esto… ya lo he visto.'],
  /** Heading back south once the palace has risen. */
  away: ['Es por el otro lado.'],
  /** Aitor, when two players pull apart further than the camera can follow. */
  tether: ['¡Eh, espérame!', '¿A dónde vas tan rápido?'],
} as const;
