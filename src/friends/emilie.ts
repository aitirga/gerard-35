/**
 * Emilie's mission (docs/quests/emilie.md): where her door, her flat and her laptop are, where the
 * way out of her model is, and every line. `src/story.ts` decides when each one plays; this file is
 * data only, as the one-file-per-friend convention asks (docs/barcelona.md § Architecture). Poble
 * Sec's cells are in its grid (src/geo/poble-sec.json); the flat's come from its plan
 * (`PISO_EMILIE` in src/environments.ts); the model's from src/modelo.ts.
 *
 * Emilie keeps every fact and has lost the why: she cannot join a cause to its effect. She knows the
 * water runs downhill and that her flat is flooded, and cannot put the two together. She is not a
 * joke: she knows she used to know, and it frightens and shames her. The why comes back to her zone
 * by zone as the party goes down her model, and all of it when El que no converge falls.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';
import { GALLERY, SECTION, type ZoneId } from '../modelo.ts';

export const POBLE_SEC: EnvironmentId = 'poble-sec';
export const PISO: EnvironmentId = 'piso-emilie';
export const MODELO_PLACE: EnvironmentId = 'modelo';
/** Her figure's scale in the world: the cast's adults are all close to it. */
export const EMILIE_SCALE = 1.1;

/** Where things are in Poble Sec: her door on Margarit, where Gerard already looks at it (`poble-sec-emilie`). */
export const PLACES_EMILIE = {
  door: { x: 145, z: 79 },
} as const;
/** Where things are in her flat (`PISO_EMILIE`, after Aitor's sketch): the way in, where she stands, the desk with the computer. */
export const PLACES_PISO = {
  /** Just inside the door, coming up from the street or out of the model. */
  spawn: { x: 2, z: 14 },
  /** Out again: the landing behind the door. */
  exit: { x: 2, z: 14 },
  /** Emilie, standing in the water between the sofa and the bar. */
  emilie: { x: 5, z: 9 },
  /** The desk against the west wall, right over the sofa; the cell beside it is where the laptop is used from. */
  desk: [{ x: 1, z: 5 }, { x: 2, z: 5 }, { x: 1, z: 6 }, { x: 2, z: 6 }] as Cell[],
  laptop: { x: 3, z: 5 },
  /** The laptop's screen, for the prompt to sit on. */
  screen: { x: 1.6, z: 5.5, y: 1.05 },
} as const;
/** Where things are in her model: the way back out to the laptop, at the far end of El suelo behind where they land. */
export const PLACES_MODELO = {
  spawn: { x: SECTION.landing, z: GALLERY.row },
  exit: { x: SECTION.landing - 2, z: GALLERY.row },
} as const;

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const emilie = (text: string): DialogueLine => ({ speaker: 'emilie', text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });

export const LINES_EMILIE = {
  /** At her door on Margarit, the first time: water runs out under it. */
  door: group('emilie',
    gerard('Sale agua por debajo del portal.'),
    aitor('Emilie vive arriba del todo.'),
    emilie('¿Sí? Ah. Sois vosotros. Subid.'),
    emilie('Cuidado con el suelo, que está… mojado. Está mojado.'),
  ),
  /** At her door again, while the mission runs. */
  doorAgain: group('emilie', emilie('Está abierto. Creo que lo dejé abierto.')),
  /** At her door once she is herself. */
  doorAfter: group('emilie', emilie('¡Subid! Ya no hace falta que os descalcéis.')),
  /** In the flat, the first time they speak to her. */
  arrive: group('emilie',
    aitor('Emilie. Tienes el piso inundado.'),
    emilie('Ya. Ya lo sé. El agua baja. Eso lo sé.'),
    emilie('Y el piso está arriba. Y el agua está aquí. Y no sé qué tiene que ver una cosa con la otra.'),
    gerard('¿Has llamado a alguien?'),
    emilie('El teléfono está ahí. Sé que sirve para algo. Lo cojo y no sé para qué lo he cogido.'),
    emilie('Perdonad. Yo no soy así. Sé que no soy así.'),
    aitor('Lo sabemos.'),
    aitor('Gerard. El portátil de la mesa está encendido. Es su modelo.'),
  ),
  /** Speaking to her again before the laptop. */
  waiting: group('emilie',
    emilie('Lo dejé encendido porque… había un porqué. Estaba aquí hace un momento.'),
    aitor('Vamos a mirarlo.'),
  ),
  /** The laptop before they have spoken to her. */
  laptopBefore: group('aitor', aitor('Luego. Primero ella: está empapada y ni se ha sentado.')),
  /** The laptop, the first time: her model of the water under Poble Sec, and they connect to it. */
  laptop: group('emilie',
    aitor('El agua bajo Poble Sec, en corte. Lo tenía a medias.'),
    gerard('Abajo pone «no converge». Una línea detrás de otra.'),
    emilie('Eso lo hice yo. Sé que lo hice yo.'),
    aitor('Y esas estacas naranjas son suyas: donde quería medir.'),
    emilie('Medir. Sé que eso es importante. No sé por qué.'),
    aitor('Conéctate conmigo, Gerard. Vamos a verlo desde dentro.'),
  ),
  /** Inside the model, the first time. */
  inside: group('emilie',
    gerard('Estamos dentro. Es el suelo, cortado. Como un dibujo.'),
    aitor('Todo lo verde es lo que el modelo se inventa. No lo ha medido nadie.'),
    emilie('¿Me oís? Os veo en la pantalla. Sois dos puntos.'),
    aitor('La estaca de ahí. Era su plan.'),
  ),
  /** Back in after leaving. */
  insideAgain: group('aitor', aitor('Seguimos donde lo dejamos. Donde lo dejó ella.')),
  /** Emilie, from outside, the first time they reach each zone below: a little more of the why each time. */
  zones: {
    gravas: group('emilie',
      emilie('Las gravas. El agua corre ahí más deprisa que en ningún otro sitio.'),
      emilie('Y por eso se lo lleva todo. «Por eso». Lo he dicho yo.'),
    ),
    ciudad: group('emilie',
      emilie('Bajo la ciudad. El túnel de la L3: bombean día y noche para que no se inunde.'),
      emilie('Bombean, y el agua de alrededor baja. Por eso medía aquí. Por eso.'),
      aitor('Vuelve.'),
    ),
    fondo: group('emilie',
      emilie('Eso de abajo es lo que no me dejaba acabar.'),
      emilie('No converge porque le faltan datos. Cada estaca que medís es una cosa menos que tiene que adivinar.'),
      gerard('Pues hemos medido.'),
    ),
  } as Record<Exclude<ZoneId, 'suelo'>, Dialogue>,
  /** At the bottom, the first time they come near it, before its fight. */
  jefe: group('emilie',
    gerard('Ahí está. No se queda quieto.'),
    emilie('Nunca se queda. Por eso no acaba.'),
  ),
  /** El que no converge falls: everything comes back to her at once. */
  won: group('emilie',
    emilie('…'),
    emilie('Ya. Converge.'),
    emilie('El desagüe del balcón está tapado de hojas. Llovió anoche, el agua no tenía por dónde salir, y entró. Era eso.'),
    aitor('Ha vuelto.'),
    emilie('Llevo toda la mañana mirando un charco sin entenderlo.'),
  ),
  /** Back in the flat, herself. */
  home: group('emilie',
    emilie('El móvil sirve para llamar al administrador. Ya me acuerdo. Y para pediros perdón por el susto.'),
    gerard('No hay nada que perdonar.'),
    emilie('Os debo una cena. Y la explicación de por qué esto no tenía que haber pasado.'),
    aitor('La cena primero.'),
  ),
  /** After the mission, in the flat. */
  after: group('emilie', emilie('El modelo ya converge. El piso, mañana.'), aitor('Hecho.')),
  /** The laptop once she is herself. */
  laptopAfter: group('emilie', emilie('Ni se os ocurra tocar nada. Por fin cuadra.')),
};
