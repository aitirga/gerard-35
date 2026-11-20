/**
 * Bernat at 35 (docs/quests/bernat.md, rounds 5 and 6): the confidant at El Nucli, his call after
 * the first fall at the Queen, and the model of the flat whose riddle sends the artilugio to the real
 * one. Data and the riddle's own rule only; `src/story.ts` decides when each line plays,
 * `src/portal-ui.ts` shows the riddle over the model. No ánima and no fight: he is the one who sees
 * that all this is a game.
 *
 * The riddle (Aitor): a sheet with no words, each lamp drawn as its name (the moon as a moon, the
 * table as a table: the bulbs are called so at home), joined by + − =; Gerard has to see that the
 * shape is the bulb and that the moon is the other two mixed. Their colours he sees on the model on
 * the table and on the real bulbs, which follow it. The answer is the moon (the `luna` lamp, real
 * and in the game) set to the colour of light that results, held 5 s. Four levels: a sum, a
 * subtraction, a harder sum with a subtraction, the three primaries at once.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import { NUCLI_BERNAT_SEAT } from '../environments.ts';
import { OFF, hex, white, type Lamp, type LightId } from '../home-lights.ts';
import type { Cell } from '../movement';

export const NUCLI: EnvironmentId = 'el-nucli';
/** Where things are in El Nucli (docs/places/nucli.md): his chair at the back room's round table, and his model of the flat. */
export const PLACES_BERNAT = {
  /** Where he stands, at the end of the round table by his chair (`NUCLI_BERNAT_SEAT` is the table's own cell). */
  seat: { x: NUCLI_BERNAT_SEAT.x - 1, z: NUCLI_BERNAT_SEAT.z } as Cell,
  /** Before the table, at the place's own `nucli-mesa`: where Gerard leans over the model. */
  portal: { x: 8, z: 4 } as Cell,
} as const;
/** The model of the Meridiana flat on his table: this much of the real one's size (it stands on a 1.3 m table). */
export const MAQUETA_SCALE = 1 / 22;
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
/**
 * How a lamp of that colour is lit, in the game and at home. The blue leans to the sky's side and
 * shines brighter: a deeper one read violet on the flat's warm floors (violet is possession's).
 */
export const LAMPS: Record<LightColour, Lamp> = {
  rojo: hex('#ff2a1f', .8), verde: hex('#2bd94a', .75), azul: hex('#2f7bff', .9), amarillo: hex('#ffd23a', .8),
  cian: hex('#2fe0e0', .75), magenta: hex('#ff3fe0', .75), blanco: white(5000, .9),
};
/** Where each colour sits on the lamps' wheel (degrees), to read what the moon shows. */
const HUES: [LightColour, number][] = [['rojo', 0], ['amarillo', 55], ['verde', 125], ['cian', 180], ['azul', 230], ['magenta', 300]];
/** What a lamp of the model goes through, press after press: off, round the wheel, then white. */
export const CYCLE: readonly (LightColour | undefined)[] = [undefined, 'rojo', 'amarillo', 'verde', 'cian', 'azul', 'magenta', 'blanco'];
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
/**
 * How the sheet draws each lamp of the sums: as its name, the way the bulbs are called at home
 * (`HOUSE_LIGHTS` labels): Luna a moon, Mesa a table, Cocina a pot, Sofá a sofa. Ink shapes on a
 * 24 × 24 box, no colour and no word.
 */
export const SHEET_ICONS: Partial<Record<LightId, string>> = {
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  mesa: '<path d="M1.8 8.2h20.4v2.3H1.8z"/><path d="M3.8 10.5h2.2v9.7H3.8zM18 10.5h2.2v9.7H18z"/><path d="M6 10.5h12v1.5H6z"/>',
  cocina: '<rect x="10.6" y="3.2" width="2.8" height="2.4" rx="1"/><path d="M3.8 9.4c0-2.3 3.7-3.7 8.2-3.7s8.2 1.4 8.2 3.7z"/>'
    + '<path d="M4.6 10.6h14.8v7a2.9 2.9 0 0 1-2.9 2.9H7.5a2.9 2.9 0 0 1-2.9-2.9z"/><rect x="1.4" y="11.8" width="3.6" height="1.9" rx=".95"/><rect x="19" y="11.8" width="3.6" height="1.9" rx=".95"/>',
  sofa: '<path d="M6 6.2h12a2 2 0 0 1 2 2v2.6H4V8.2a2 2 0 0 1 2-2z"/>'
    + '<path d="M1.4 10.6a1.8 1.8 0 0 1 3.6 0V13h14v-2.4a1.8 1.8 0 0 1 3.6 0V18h-1.7v2h-2.2v-2H6.3v2H4.1v-2H1.4z"/>',
};
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
/** A lamp `by` presses on along the cycle from the colour it shows (off keeps its colour for the next time). */
export function stepColour(lamp: Lamp, by: number): Lamp {
  const at = CYCLE.indexOf(lampColour(lamp)), next = CYCLE[(at + by + CYCLE.length * 4) % CYCLE.length];
  return next ? { ...LAMPS[next] } : { ...(lamp.on ? lamp : OFF), on: false };
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
  /** He shows them the model on his table, and the sheet that came with it. */
  box: group('bernat35',
    bernat('Esto apareció anoche en mi mesa. Es vuestro piso, Gerard. Entero, hasta el último cajón.'),
    bernat('Las luces se encienden si las tocas. Las de aquí y, creo, las de allí.'),
    bernat('Debajo había una hoja. Ni una palabra, solo dibujos. Es un acertijo, de los que hacía yo de crío. Pero no lo he hecho yo.'),
  ),
  /** Before the riddle is solved, at his table. */
  waiting: group('bernat35', bernat('La maqueta sigue en la mesa. La hoja, con ella.')),
  /** The portal solved: the performance has run, the artilugio is there. */
  solved: group('bernat35',
    bernat('Ya está. Ha cruzado.'),
    bernat('En vuestra habitación. La de verdad. Suena: seguidlo.'),
    aitor('Vamos a casa.'),
  ),
  /** At his table once it has crossed. */
  after: group('bernat35', bernat('Id. Y cuando lo tengas en la mano, Gerard, no le hagas caso a nadie. Ni a mí.')),
} as const;
