/**
 * The combat guide (docs/combat.md § La guía de estados): a card for each status and state a fighter
 * can carry in a fight, the party's or a foe's. The first time one shows on a plate the fight stops
 * and its card says what it does (battle-ui `showGuide`); «Cómo jugar» keeps every card found.
 *
 * Each card says what the status does, never what to do about it: no card tells a fight's answer
 * (AGENTS.md § Every fight asks a question). A boss's own rule shown as a status (La Voz's song,
 * Fran's light, an Encarnado…) has no card: that fight is read on its plate and found by trying.
 *
 * A card's version (`guideVersion`) is its words and the numbers it is built from (`rule`): when a
 * commit changes either, the card shows again the next time its status does.
 */
import { BITS, BLEED_BONUS, BOMBA, CEGADO, COMBUSTION, CONDENSADOR, CORTINA, CRECIDA, ELEMENT_RULES, FIRE_TOP, POWDER_RULES, RACHA, REACTION_RULES, STATUSES, TIMED, WEAK_SPOT, type TimedId } from './battle.ts';
import type { IconId } from './status-icons.ts';

/** Where a card stands in «Cómo jugar»: what weighs on whoever carries it, what helps them, and the fight's own signs. */
export type GuideGroup = 'contra' | 'favor' | 'combate';
export const GUIDE_GROUPS: Record<GuideGroup, string> = { contra: 'Estados alterados', favor: 'A favor', combate: 'Señales del combate' };
/** The signs that are not a status icon on a plate, drawn here on the same 16 × 16 box. */
export type SignId = 'sube' | 'baja' | 'debil' | 'resiste' | 'anuncio' | 'sutura' | 'mecha';
export const SIGN_ICONS: Record<SignId, string> = {
  // Two chevrons up, two down: a stat above or below its own.
  sube: '<path d="M3 8.6 8 3.6l5 5M3 13.4l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  baja: '<path d="M3 2.6l5 5 5-5M3 7.4l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  // A shield split by a crack, and a whole one.
  debil: '<path d="M8 1.2 13.6 3.4v4.4c0 3.4-2.4 5.8-5.6 7-3.2-1.2-5.6-3.6-5.6-7V3.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.6 3.4 6.8 7.2l2.4.8-1.8 4.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  resiste: '<path d="M8 1.2 13.6 3.4v4.4c0 3.4-2.4 5.8-5.6 7-3.2-1.2-5.6-3.6-5.6-7V3.4z"/>',
  // A blow called ahead: an arrow out of a mark.
  anuncio: '<circle cx="4" cy="8" r="2.4"/><path d="M7.4 8h6.4M10.8 4.8 14 8l-3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  // A stitch of light across a wound.
  sutura: '<path d="M2 12 14 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4.4 7.2 6.4 10.4M7.4 5.4l2 3.2M10.2 3.6l2 3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  // A fuse burning down to a spark.
  mecha: '<path d="M2 14c3-1 3-5 6-6s3-3 3-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 .6 12 2.4l1.8.2-1.4 1.2.4 1.8L11 4.6l-1.8 1 .4-1.8-1.4-1.2 1.8-.2z"/>',
};
export interface Guide {
  name: string; group: GuideGroup;
  /** Its icon: the plate's own, or a sign drawn for the guide. */
  icon: IconId | SignId;
  /** The colour the plate draws it in (style.css `--status`). */
  colour: string;
  /** What it does, in plain words: what, how much, how long. Never what to do about it. */
  text: string;
  /** The rule's numbers the words come from: a change in them is a change in the card. */
  rule?: unknown;
}
const percent = (share: number) => `${Math.round(share * 100)} %`;
const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);
/** «durante 20 segundos», for a status on the fight's clock. */
const lasts = (id: TimedId) => `Dura ${TIMED[id].seconds} segundos.`;

export const GUIDES = {
  // ——— Estados alterados: what weighs on whoever carries them ———
  sangrado: {
    name: 'Sangrado', group: 'contra', icon: 'sangrado', colour: '#ff6b6b', rule: [STATUSES.sangrado, BLEED_BONUS],
    text: `Una herida que se acumula, hasta ${STATUSES.sangrado.max} cargas. Al acabar cada ronda quita ${STATUSES.sangrado.tick} PV por carga. El siguiente golpe físico que no añada cargas la abre: pega un ${percent(BLEED_BONUS)} más por cada carga y la gasta entera. Si nadie la corta en una ronda, pierde una carga al acabarla.`,
  },
  mareo: {
    name: 'Mareo', group: 'contra', icon: 'mareo', colour: '#b9a4ff', rule: STATUSES.mareo,
    text: `Baja la Defensa y el Espíritu de quien lo lleva, más cuantas más cargas tenga (hasta ${STATUSES.mareo.max}). Pierde una carga al acabar cada ronda. Es un estado de la mente.`,
  },
  llorera: {
    name: 'Llorera', group: 'contra', icon: 'llorera', colour: '#8fd3ff', rule: STATUSES.llorera,
    text: `Baja la Fuerza y la Magia de quien la lleva, más cuantas más cargas tenga (hasta ${STATUSES.llorera.max}). Pierde una carga al acabar cada ronda. Es un estado de la mente.`,
  },
  quemado: {
    name: 'Quemado', group: 'contra', icon: 'quemado', colour: '#ffb054', rule: [TIMED.quemado, FIRE_TOP],
    text: `Fuego: quita PV cada ${TIMED.quemado.every} segundos. Otro golpe de fuego mientras arde lo sube un nivel, hasta el ${roman(FIRE_TOP)}, y su reloj vuelve a empezar; cada nivel quema bastante más que el anterior. ${lasts('quemado')}`,
  },
  combustion: {
    name: 'Combustión', group: 'contra', icon: 'combustion', colour: '#ffe6a6', rule: [COMBUSTION, TIMED.quemado.levels],
    text: `El fuego en su nivel ${roman(COMBUSTION.level)}, más alto de lo que llega solo. Quema más que nunca, y un golpe físico lo hace estallar: daño de fuego a todos los enemigos, y el fuego prende en los demás.`,
  },
  cegado: {
    name: 'Cegado', group: 'contra', icon: 'cegado', colour: '#c7ccd4', rule: [TIMED.cegado, CEGADO],
    text: `No ve nada: mientras dura, sus golpes físicos suelen fallar, ${Math.round(CEGADO.smoke * 3)} de cada 3 en el humo y ${Math.round(CEGADO.flash * 3)} de cada 3 tras el fogonazo de Explosión. La magia sí la acierta. No se acumula: si vuelve a cegarse, su reloj empieza de nuevo. ${lasts('cegado')}`,
  },
  confusion: {
    name: 'Confusión', group: 'contra', icon: 'confusion', colour: '#4fe0ff', rule: TIMED.confusion,
    text: `No sabe de qué lado está: en su turno golpea a uno de los suyos, o a sí mismo si está solo, y olvida lo que había anunciado. ${lasts('confusion')}`,
  },
  encogido: {
    name: 'Encogido', group: 'contra', icon: 'encogido', colour: '#9fe8ff', rule: TIMED.encogido,
    text: `Más pequeño y con la guardia baja: pierde un ${percent(TIMED.encogido.cut?.defensa ?? 0)} de su Defensa mientras dura. ${lasts('encogido')}`,
  },
  mojado: {
    name: 'Mojado', group: 'contra', icon: 'mojado', colour: '#6cc8f2', rule: TIMED.mojado,
    text: `Empapado. No hace daño por sí solo, pero el agua no se queda quieta cuando le llega otro elemento. ${lasts('mojado')}`,
  },
  shock: {
    name: 'Shock', group: 'contra', icon: 'shock', colour: '#ffe45c', rule: REACTION_RULES.shock,
    text: 'Una descarga le ha dejado sin reaccionar: pierde su siguiente turno. Lo que hubiera anunciado espera al siguiente.',
  },
  empolvado: {
    name: 'Empolvado', group: 'contra', icon: 'empolvado', colour: '#d9a98d', rule: TIMED.empolvado,
    text: `Cubierto de polvo de color. No hace daño por sí solo: espera a que le llegue un elemento. ${lasts('empolvado')}`,
  },
  envenenado: {
    name: 'Envenenado', group: 'contra', icon: 'envenenado', colour: '#a9c79a', rule: [TIMED.envenenado, POWDER_RULES.poison],
    text: `Veneno: quita PV cada ${TIMED.envenenado.every} segundos, y mientras dura cada golpe que recibe entra un ${percent(POWDER_RULES.poison - 1)} más fuerte. ${lasts('envenenado')}`,
  },
  cristalizado: {
    name: 'Cristalizado', group: 'contra', icon: 'cristalizado', colour: '#bfd0ea', rule: [TIMED.cristalizado, POWDER_RULES.shard, POWDER_RULES.shards],
    text: `Esquirlas de cristal clavadas. Cada golpe que recibe hace ${POWDER_RULES.shard} PV más por cada nivel y las clava más hondo, hasta el nivel ${POWDER_RULES.shards}. ${lasts('cristalizado')}`,
  },
  agua: {
    name: 'Agua', group: 'contra', icon: 'agua', colour: '#27c2a0', rule: [TIMED.agua, CRECIDA.marks, CRECIDA.mark],
    text: `Agua estancada a sus pies, de una a ${CRECIDA.marks} marcas. Mientras haya agua está mojado. La marca de arriba se va en ${CRECIDA.mark} segundos, y otro golpe de agua la sostiene.`,
  },
  corriente: {
    name: 'Corriente', group: 'contra', icon: 'corriente', colour: '#ffe24a', rule: TIMED.corriente,
    text: `Electricidad corriendo por su agua: quita PV cada ${TIMED.corriente.every} segundos, más cuanta más agua tenga. Otro golpe eléctrico mientras corre la renueva. ${lasts('corriente')}`,
  },
  hundido: {
    name: 'Hundido', group: 'contra', icon: 'hundido', colour: '#2bb0b8', rule: [TIMED.hundido, CRECIDA.marks],
    text: `Con el agua en la ${CRECIDA.marks}.ª marca está hundido: pierde un ${percent(TIMED.hundido.share)} de toda su vida cada ${TIMED.hundido.every} segundos mientras siga ahí.`,
  },
  congelado: {
    name: 'Congelado', group: 'contra', icon: 'congelado', colour: '#bfeff6', rule: [TIMED.congelado, CRECIDA.frozen, CRECIDA.blows, CRECIDA.ice],
    text: `Su agua se ha helado: no actúa y recibe solo un ${percent(CRECIDA.frozen)} del daño. El hielo aguanta ${CRECIDA.blows} golpes; al romperse hace daño de agua, más cuanto más hielo le quedara.`,
  },
  bomba: {
    name: 'Bomba', group: 'contra', icon: 'bomba', colour: '#7fe9ff', rule: [TIMED.bomba, BOMBA],
    text: `Una bomba pegada con una cuenta atrás de ${BOMBA.seconds} segundos. Estalla al acabar, con más fuerza cuanto más tiempo haya llevado encima.`,
  },
  virus: {
    name: 'Virus', group: 'contra', icon: 'virus', colour: '#9ff4ff', rule: TIMED.virus,
    text: `Mientras dura, cada estado que reciba se contagia a los demás enemigos. ${lasts('virus')}`,
  },
  volcan: {
    name: 'Volcán', group: 'contra', icon: 'volcan', colour: '#ff8a3c', rule: TIMED.volcan,
    text: `Un volcán encima: cada ${TIMED.volcan.every} segundos le cae lava y su fuego sube un nivel. ${lasts('volcan')}`,
  },
  marea: {
    name: TIMED.marea.name, group: 'contra', icon: 'marea', colour: '#6cc8f2', rule: TIMED.marea,
    text: `El agua de los enemigos está unida: lo que sube en uno sube en todos. ${lasts('marea')}`,
  },
  fulgurita: {
    name: TIMED.fulgurita.name, group: 'contra', icon: 'fulgurita', colour: '#bfd0ea', rule: TIMED.fulgurita,
    text: `Las esquirlas de cristal de los enemigos cuentan juntas. ${lasts('fulgurita')}`,
  },
  metralla: {
    name: TIMED.metralla.name, group: 'contra', icon: 'metralla', colour: '#ff6b6b', rule: TIMED.metralla,
    text: `La herida no se gasta: cada golpe físico se lleva lo que suma la herida y la deja abierta. ${lasts('metralla')}`,
  },
  'idea-fija': {
    name: TIMED['idea-fija'].name, group: 'contra', icon: 'idea-fija', colour: '#8fe3c4', rule: TIMED['idea-fija'],
    text: `Un eco suena dentro de su cabeza: cada ${TIMED['idea-fija'].every} segundos golpea a uno de los suyos. ${lasts('idea-fija')}`,
  },
  seiche: {
    name: TIMED.seiche.name, group: 'contra', icon: 'seiche', colour: '#27c2a0', rule: TIMED.seiche,
    text: `Un eco de agua: cada ${TIMED.seiche.every} segundos le golpea con agua y le sostiene el agua. ${lasts('seiche')}`,
  },
  staccato: {
    name: TIMED.staccato.name, group: 'contra', icon: 'staccato', colour: '#8fe3c4', rule: TIMED.staccato,
    text: `Un eco cortante: cada ${TIMED.staccato.every} segundos le vuelve a cortar. ${lasts('staccato')}`,
  },
  mecha: {
    name: 'Mecha encendida', group: 'contra', icon: 'mecha', colour: '#ffb054',
    text: 'Lleva polvo con una mecha prendida: estalla en cuanto actúe o caiga.',
  },
  'punto-debil': {
    name: 'Punto débil', group: 'contra', icon: 'punto-debil', colour: '#fff1b8', rule: WEAK_SPOT,
    text: `Un punto débil al descubierto: el siguiente golpe que reciba hace ${WEAK_SPOT === 3 ? 'el triple' : `${WEAK_SPOT} veces más`} de daño.`,
  },
  baja: {
    name: 'Atributos abajo', group: 'contra', icon: 'baja', colour: '#ff8a7a',
    text: 'Tiene atributos por debajo de lo normal: la marca ▼ dice cuáles (FUE Fuerza, MAG Magia, DEF Defensa, ESP Espíritu, CRÍ Crítico). El resumen del combate dice cuánto, por qué y hasta cuándo.',
  },
  // ——— A favor: what helps whoever carries them ———
  sanacion: {
    name: 'Sanación', group: 'favor', icon: 'sanacion', colour: '#7fe3a0', rule: TIMED.sanacion,
    text: `Una cura que llega poco a poco: devuelve PV cada ${TIMED.sanacion.every} segundos. Otra vez mientras dura, sube un nivel y cura más. ${lasts('sanacion')}`,
  },
  sutura: {
    name: 'Sutura de luz', group: 'favor', icon: 'sutura', colour: '#7fe3a0',
    text: 'El siguiente daño que reciba en esta ronda se queda en la mitad.',
  },
  cortina: {
    name: 'Cortina de polvo', group: 'favor', icon: 'cortina', colour: '#dcc388', rule: CORTINA,
    text: `Una cortina de polvo delante: el siguiente golpe que reciba se queda en la ${CORTINA.share === .5 ? 'mitad' : percent(CORTINA.share)}. Dura hasta ese golpe o ${CORTINA.rounds} rondas, y quien la rompe queda empolvado.`,
  },
  cargado: {
    name: 'Cargado', group: 'favor', icon: 'cargado', colour: '#fff2a8', rule: CONDENSADOR,
    text: `Carga eléctrica: su siguiente golpe eléctrico hace ${CONDENSADOR.scale === 2 ? 'el doble' : `${CONDENSADOR.scale} veces más`} de daño. Si un enemigo le golpea antes, la carga salta a ese enemigo.`,
  },
  pelicula: {
    name: 'Película de jabón', group: 'favor', icon: 'pelicula', colour: '#6cc8f2',
    text: 'Una película de jabón alrededor: recibe un tercio de cada golpe hasta el final de la ronda. Cada enemigo que le golpee recibe su agua, sin daño: queda mojado, y si ardía se le apaga el fuego y si estaba empolvado se envenena.',
  },
  bits: {
    name: 'Escudo de bits', group: 'favor', icon: 'bits', colour: '#7fe9ff', rule: BITS,
    text: `Una cúpula de bits sobre el equipo: para cada golpe entero mientras le queden PV. Dura ${BITS.rounds} rondas.`,
  },
  'siete-vidas': {
    name: 'Siete vidas', group: 'favor', icon: 'siete-vidas', colour: '#f6f0e2',
    text: 'El próximo golpe que fuera a tumbar a alguien del equipo no lo tumba: lo cura.',
  },
  acecho: {
    name: 'Acecho', group: 'favor', icon: 'acecho', colour: '#f0954a',
    text: 'Su gato está agazapado: salta sobre su presa al empezar la ronda.',
  },
  racha: {
    name: 'Racha', group: 'favor', icon: 'racha', colour: '#bfe0ff', rule: RACHA.crit,
    text: `Cada dado gastado desde que lleva Dadista suma un ${RACHA.crit} % de Crítico. Se pierde al cambiar de ánima o al caer.`,
  },
  meteoro: {
    name: 'Meteoro', group: 'favor', icon: 'meteoro', colour: '#f4f9ff',
    text: 'El meteoro ha crecido: usado en su siguiente turno, sale más grande. Cualquier otra cosa lo devuelve a su tamaño.',
  },
  compas: {
    name: 'Compás', group: 'favor', icon: 'compas', colour: '#8fe3c4',
    text: 'Los ecos de Sincopante flotan sobre el equipo y suenan solos al ritmo del compás: golpean o curan hasta que se apagan.',
  },
  dormida: {
    name: 'Definitiva dormida', group: 'favor', icon: 'dormida', colour: '#8f887a',
    text: 'Su definitiva está dormida: despierta en el combate cuando se cumple lo que pide. Su marca dice cuánto le falta.',
  },
  definitiva: {
    name: 'Definitiva despierta', group: 'favor', icon: 'definitiva', colour: '#f0e4c8',
    text: 'Su definitiva está despierta: se puede usar una vez en este combate.',
  },
  sube: {
    name: 'Atributos arriba', group: 'favor', icon: 'sube', colour: '#8fd3ff',
    text: 'Tiene atributos por encima de lo normal: la marca ▲ dice cuáles (FUE Fuerza, MAG Magia, DEF Defensa, ESP Espíritu, CRÍ Crítico). El resumen del combate dice cuánto, por qué y hasta cuándo.',
  },
  // ——— Señales del combate: what a plate tells about a foe ———
  anuncio: {
    name: 'Movimiento anunciado', group: 'combate', icon: 'anuncio', colour: '#c9a8ff',
    text: 'El enemigo ha dicho lo que va a hacer en su siguiente turno, y a quién. Sale sobre su placa hasta que lo hace.',
  },
  debil: {
    name: 'Débil', group: 'combate', icon: 'debil', colour: '#ffd27a', rule: ELEMENT_RULES.weak,
    text: `Un golpe de ese elemento ya ha encontrado su punto flaco: le hace un ${percent(ELEMENT_RULES.weak - 1)} más de daño. Cada tipo de enemigo lo guarda una vez descubierto.`,
  },
  resiste: {
    name: 'Resiste', group: 'combate', icon: 'resiste', colour: '#9fb3bd', rule: ELEMENT_RULES.resist,
    text: `Ese elemento apenas le hace mella: recibe ${ELEMENT_RULES.resist === .5 ? 'la mitad' : `un ${percent(ELEMENT_RULES.resist)}`} del daño. Cada tipo de enemigo lo guarda una vez descubierto.`,
  },
} satisfies Record<string, Guide>;
export type GuideId = keyof typeof GUIDES;
export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[];
export const isGuide = (id: string): id is GuideId => Object.hasOwn(GUIDES, id);
/** A card's icon as an inline SVG, in its colour. */
export const guideIcon = (id: GuideId, svgOf: (icon: IconId) => string) => {
  const icon = GUIDES[id].icon;
  return Object.hasOwn(SIGN_ICONS, icon) ? `<svg viewBox="0 0 16 16" aria-hidden="true">${SIGN_ICONS[icon as SignId]}</svg>` : svgOf(icon as IconId);
};
/** A card's version: a short hash of its words and its rule's numbers (FNV-1a). */
export function guideVersion(id: GuideId): string {
  const card: Guide = GUIDES[id];
  const text = JSON.stringify([card.name, card.text, card.rule ?? null]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
}
/** Which cards have been seen, at which version (main.ts keeps it in the save and the browser). */
export type GuidesSeen = Partial<Record<string, string>>;
/** Whether `id` is new to the players, or changed since they last saw it. */
export const guideState = (seen: GuidesSeen, id: GuideId): 'new' | 'changed' | 'seen' => !seen[id] ? 'new' : seen[id] === guideVersion(id) ? 'seen' : 'changed';
/** The cards found, in the guide's order. */
export const guidesFound = (seen: GuidesSeen) => GUIDE_IDS.filter(id => seen[id]);
