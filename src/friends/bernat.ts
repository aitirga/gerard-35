/**
 * Bernat at 35 (docs/quests/bernat.md, round 5): the confidant at El Nucli, his call after the first
 * fall at the Queen, and the portal whose puzzle sends the artilugio to the real flat. Data and the
 * puzzle's own rule only; `src/story.ts` decides when each line plays, `src/portal-ui.ts` shows the
 * puzzle. No ánima and no fight: he is the one who sees that all this is a game.
 *
 * The puzzle (decided by Aitor): his notebook draws a sum of the flat's lamps, *the moon = the table
 * in green + the kitchen in blue*; the game lights the lamps of the sum, and the answer is the moon
 * (the `luna` lamp, real and in the game) set to the colour of light that results, held 5 s. Four
 * levels: a sum, a subtraction, a harder sum with a subtraction, the three primaries at once.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import { NUCLI_BERNAT_SEAT } from '../environments.ts';
import { hex, white, type Lamp, type LightId } from '../home-lights.ts';
import type { Cell } from '../movement';

export const NUCLI: EnvironmentId = 'el-nucli';
/** Where things are in El Nucli (docs/places/nucli.md): his chair at the back room's round table, and the box he opens. */
export const PLACES_BERNAT = {
  /** Where he stands, at the end of the round table by his chair (`NUCLI_BERNAT_SEAT` is the table's own cell). */
  seat: { x: NUCLI_BERNAT_SEAT.x - 1, z: NUCLI_BERNAT_SEAT.z } as Cell,
  /** The box on the table, at the place's own `nucli-mesa`: once he opens it, the portal. */
  portal: { x: 8, z: 4 } as Cell,
} as const;
/**
 * His figure, a stand-in until his own (`just character-3d bernat`): a heavy-set man, a bit of a
 * geek look (docs/quests/bernat.md § Protagonist).
 */
export const BERNAT_STANDIN = 'joan';
export const BERNAT_SCALE = 1.12;

// ——— The puzzle: colours of light that mix ——————————————————————————————————————————————
export type LightColour = 'rojo' | 'verde' | 'azul' | 'amarillo' | 'cian' | 'magenta' | 'blanco';
/** Each colour as light: red, green and blue in or out. */
export const RGB: Record<LightColour, readonly [number, number, number]> = {
  rojo: [1, 0, 0], verde: [0, 1, 0], azul: [0, 0, 1], amarillo: [1, 1, 0], cian: [0, 1, 1], magenta: [1, 0, 1], blanco: [1, 1, 1],
};
/** How a lamp of that colour is lit, in the game and at home. */
export const LAMPS: Record<LightColour, Lamp> = {
  rojo: hex('#ff2a1f', .8), verde: hex('#2bd94a', .75), azul: hex('#3a5bff', .75), amarillo: hex('#ffd23a', .8),
  cian: hex('#2fe0e0', .75), magenta: hex('#ff3fe0', .75), blanco: white(5000, .9),
};
/** Where each colour sits on the lamps' wheel (degrees), to read what the moon shows. */
const HUES: [LightColour, number][] = [['rojo', 0], ['amarillo', 55], ['verde', 125], ['cian', 180], ['azul', 230], ['magenta', 300]];
/** Words for a colour on a lamp of either gender, as the notebook writes them. */
export const COLOUR_WORDS: Record<LightColour, { f: string; m: string }> = {
  rojo: { f: 'roja', m: 'rojo' }, verde: { f: 'verde', m: 'verde' }, azul: { f: 'azul', m: 'azul' }, amarillo: { f: 'amarilla', m: 'amarillo' },
  cian: { f: 'cian', m: 'cian' }, magenta: { f: 'magenta', m: 'magenta' }, blanco: { f: 'blanca', m: 'blanco' },
};
export interface PortalTerm { lamp: LightId; colour: LightColour; sign: 1 | -1 }
export interface PortalLevel { kind: string; terms: PortalTerm[]; answer: LightColour }
/** The four levels, in order (decided by Aitor; the colours are a proposal). */
export const PORTAL_LEVELS: readonly PortalLevel[] = [
  { kind: 'Una suma', terms: [{ lamp: 'mesa', colour: 'verde', sign: 1 }, { lamp: 'cocina', colour: 'azul', sign: 1 }], answer: 'cian' },
  { kind: 'Una resta', terms: [{ lamp: 'sofa', colour: 'blanco', sign: 1 }, { lamp: 'mesa', colour: 'azul', sign: -1 }], answer: 'amarillo' },
  { kind: 'Una suma y una resta', terms: [{ lamp: 'mesa', colour: 'amarillo', sign: 1 }, { lamp: 'cocina', colour: 'cian', sign: 1 }, { lamp: 'sofa', colour: 'verde', sign: -1 }], answer: 'magenta' },
  { kind: 'Las tres a la vez', terms: [{ lamp: 'mesa', colour: 'rojo', sign: 1 }, { lamp: 'cocina', colour: 'verde', sign: 1 }, { lamp: 'sofa', colour: 'azul', sign: 1 }], answer: 'blanco' },
];
/** The lamp the answer goes on. */
export const ANSWER_LAMP: LightId = 'luna';
/** Seconds the moon must hold a colour before the house answers. */
export const HOLD_SECONDS = 5;
/** The room where the artilugio is hidden in the real flat, and the light that marks it at the end. */
export const HIDING_LAMP: LightId = 'dormitorio';
export const HIDING_LIGHT: Lamp = hex('#ff6fae', .7, .85);

/** What a sum of lights makes: each channel added or taken away, kept between nothing and full. */
export function mix(terms: readonly PortalTerm[]): [number, number, number] {
  const out = [0, 0, 0];
  for (const term of terms) RGB[term.colour].forEach((v, i) => { out[i] = Math.max(0, Math.min(1, out[i] + term.sign * v)); });
  return out as [number, number, number];
}
/** The colour whose light that is, if it is one of the seven (black is none). */
export function colourOf([r, g, b]: readonly number[]): LightColour | undefined {
  return (Object.keys(RGB) as LightColour[]).find(c => RGB[c][0] === r && RGB[c][1] === g && RGB[c][2] === b);
}
/** The colour a lamp shows, read as one of the seven: off or too dim is none; a white, any white. */
export function lampColour(lamp: Lamp): LightColour | undefined {
  if (!lamp.on || lamp.brightness < .08) return undefined;
  if (lamp.saturation < .25) return 'blanco';
  const away = (h: number) => Math.abs(((lamp.hue - h + 540) % 360) - 180);
  return HUES.reduce((best, h) => away(h[1]) < away(best[1]) ? h : best)[0];
}

// ——— Lines ——————————————————————————————————————————————————————————————————————————————
const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const bernat = (text: string): DialogueLine => ({ speaker: 'bernat35', text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });

export const LINES_BERNAT = {
  /** The first time, before the Queen took Aitor: the confidant (round 4). */
  first: group('bernat35',
    bernat('Gerard. Sentaos. Aquí no mira nadie.'),
    gerard('Bernat. ¿Has visto lo de la escuela?'),
    bernat('Lo he visto. Es su castillo. El de la libreta: las torres, la cortina, el trono al fondo. Lo dibujé con diez años.'),
    aitor('¿Cómo que lo dibujaste?'),
    bernat('La Reina Bubbaloo me la inventé yo. Era un juego. Un juego de críos en una libreta.'),
    bernat('Y desde hace unos días la gente hace cosas raras por la calle y yo no. Como si a mí no me tocara.'),
    gerard('¿Y Nuria? ¿Nuria Mendoza? De pequeños la llamábamos así.'),
    bernat('No sé dónde está. No contesta. Nadie sabe nada de ella.'),
    bernat('Una cosa sí recuerdo de la libreta: la música la paraba. Cuando cantábamos, se quedaba quieta. No sé por qué lo puse.'),
  ),
  /** At his table again before the call, with nothing new. */
  again: group('bernat35', bernat('Sigo repasando la libreta. Si encuentro algo, os llamo.')),
  /** At El Nucli after the call: it is a game, and they look at us. The fourth wall breaks here, once. */
  game: group('bernat35',
    bernat('Sentaos. Esto va a sonar a locura.'),
    bernat('Estamos dentro de un juego. No como forma de hablar: un juego. Con sus reglas, sus días, sus combates.'),
    aitor('Bernat…'),
    bernat('Mira cómo caéis y os levantáis por la mañana como si nada. Mira cómo se cuentan los días. Alguien está jugando esto.'),
    bernat('Y desde dentro no se le gana. Se lleva a Aitor cada vez. Siempre va a poder.'),
    gerard('Entonces, ¿qué?'),
    bernat('La música. Ya lo habéis visto: le hace algo, la deja quieta. Pero desde aquí no llegamos. Hay que tocarla desde fuera.'),
    bernat('Hay un mando. Uno de verdad, en vuestra casa de verdad. No en esta.'),
  ),
  /** The look at the camera: said over the stare, then the box. */
  stare: group('bernat35', bernat('…Nos está mirando. ¿Lo notáis?'), gerard('Sí.'), aitor('Sí.')),
  box: group('bernat35',
    bernat('Esta caja la abrí anoche y dentro estaba vuestro piso. Las luces se encienden si las tocas.'),
    bernat('En la libreta hay cuatro sumas de luces. No sé quién las escribió. Mi letra no es.'),
  ),
  /** Before the box is solved, at his table. */
  waiting: group('bernat35', bernat('La caja sigue abierta. Las sumas, en la libreta.')),
  /** The portal solved: the performance has run, the artilugio is there. */
  solved: group('bernat35',
    bernat('Ya está. Ha cruzado.'),
    bernat('En vuestra habitación. La de verdad. Suena: seguidlo.'),
    aitor('Vamos a casa.'),
  ),
  /** At his table once it has crossed. */
  after: group('bernat35', bernat('Id. Y cuando lo tengas en la mano, Gerard, no le hagas caso a nadie. Ni a mí.')),
} as const;
