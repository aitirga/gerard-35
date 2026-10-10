/**
 * Chapter 1, block 1: Gerard's birthday morning in Sant Quirze. Lines, places and tutorials live
 * here; `src/story.ts` decides when each one plays. docs/chapter-1.md explains the design.
 */
import type { Dialogue, DialogueLine } from './dialogue';

const g = (text: string, expression?: string): DialogueLine => ({ speaker: 'gerard', text, expression });
const mama = (text: string): DialogueLine => ({ speaker: 'mama', text });
const jan = (text: string): DialogueLine => ({ speaker: 'jan', text });
const bernat = (text: string): DialogueLine => ({ speaker: 'bernat', text });
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
  /** Walking past this row with Bernat makes him stop: the dogs and the scarecrow are just below. */
  southRow: 30,
  scarecrow: { x: 16, z: 37 },
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
    bernat('Espera. Esos perros de ahí abajo… y el espantapájaros de al lado.'),
    bernat('Ayer estuve diseñando un juego. Empezaba así: un cumpleaños, unas zapatillas nuevas, dos amigos bajando la calle…'),
    g('¿Un déjà-vu?'),
    bernat('Peor. Es igual. Igualito. Hasta el último detalle.'),
    bernat('Gerard… creo que la he cagado.'),
  ),
  bernatAfter: withBernat(bernat('No me mires así. Esos perros no estaban ayer en la calle… estaban en mi libreta.')),
} satisfies Record<string, Dialogue>;

/**
 * Key hints: a key and a verb, shown the first time the action makes sense and gone once used.
 * They never say what to do or where to go; that comes from exploring and from people.
 */
export const HINTS = {
  move: { keys: 'W A S D', verb: 'Caminar' },
  run: { keys: 'Shift', verb: 'Correr' },
  items: { keys: 'I', verb: 'Objetos' },
  party: { keys: 'C', verb: 'Equipo' },
} as const;
export type HintId = keyof typeof HINTS;

export const CARDS = {
  intro: { kicker: 'CAPÍTULO 1 · SANT QUIRZE DEL VALLÈS', title: 'Una mañana de otoño', text: 'Hoy es tu cumpleaños.' },
  end: { kicker: 'FIN DEL PRIMER BLOQUE', title: 'Continuará…', text: 'El juego de Bernat está a punto de hacerse real.' },
} as const;
export type CardId = keyof typeof CARDS;

/** What Bernat mutters over his head while he stalls, one more line each time Gerard pulls away. */
export const BUBBLES = {
  stalled: ['¿Gerard…?', 'Espera.', 'Esto… ya lo he visto.'],
} as const;
