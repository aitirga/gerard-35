import * as pc from 'playcanvas';
import { bodyOf, type Body, type Effects, type FireLevel } from './effects.ts';
import type { GpuEmitter, GpuField, GpuKind } from './fight-particles.ts';
import { ensureFluidKinds } from './fluid-fx.ts';

/**
 * How statuses read on whoever carries them, in a fight (docs/combat.md, "Turnos con tiempo real",
 * and docs/graphics.md, "Estados"): the physical ones the combat design decided (quemado, mojado,
 * congelado, envenenado, sangrado, cegado por el humo, paralizado), the campaign's own (mareo,
 * llorera) and the reactions between them. Each look is data (`STATUS_LOOKS`): streams of particles
 * off the fighter's own parts or head, a force field that follows them, a pulse, a tint on their
 * body and a way of moving.
 * Particles are only sparks, drops, crystals and haze, never sprites with a shape of their own.
 */
export type StatusLookId = 'quemado' | 'combustion' | 'virus' | 'mojado' | 'congelado' | 'envenenado' | 'sangrado' | 'cegado' | 'paralizado' | 'cauterizado' | 'mareo' | 'llorera' | 'sanacion' | 'confusion' | 'encogido' | 'cargado';
export type ReactionId = 'humo' | 'conduccion' | 'paralisis' | 'congelar' | 'arrastre' | 'veneno-ardiente' | 'vapor' | 'anicos' | 'contagio' | 'cauterizado' | 'tormenta' | 'plasma';
/** How a status moves whoever carries it (battle-scene plays it). */
export type StatusMotion = 'freeze' | 'twitch' | 'sway' | 'grope';

/** A stream of one kind off the fighter, so many a second at each level. */
interface Stream {
  kind: string; rate: readonly [number, number, number];
  /** Off their parts (above a fraction of their height) or from a ball round their head. */
  from?: 'body' | 'head' | 'feet'; above?: number;
  outward?: number; up?: number; speed?: number; life: readonly [number, number];
  colour?: string; size?: number; spread?: number;
}
export interface StatusLook {
  name: string;
  /** Who decided it: the combat design's physical statuses, the campaign's, what a reaction leaves, or Tecnópata's (Bip's). */
  family: 'físico' | 'campaña' | 'reacción' | 'tecnópata' | 'matemágico';
  /** Seconds it lasts by default (the design's real-time statuses). */
  seconds: number;
  /** What it shows, in a sentence (the report and docs). */
  shows: string;
  /** Burns them (effects.fire through battle-scene `ignite`), at its level. */
  fire?: boolean;
  streams: Stream[];
  /** A field round them at this fraction of their height: swirl, pull and lift (m/s²), extra turbulence, reach past their body (m). */
  field?: { height: number; swirl: number; pull: number; lift: number; turbulence?: number; reach: number };
  /** Every so often, a burst (a heartbeat, a jolt). */
  pulse?: { every: number; streams: (Stream & { count: readonly [number, number, number]; chain?: number })[] };
  /** Light added to their body (linear RGB) at level 1; more at higher levels. */
  tint?: readonly [number, number, number];
  motion?: StatusMotion;
}

/** The particles statuses throw, on the GPU engine (src/fight-particles.ts), defined when first needed. */
export const STATUS_KINDS: Record<string, GpuKind> = {
  // Water: beads of it run down whoever is wet (they slide on their parts) and leave a little pool.
  drip: {
    drag: 1.2, gravity: 3.5, curl: .05, response: .2, collide: true, bounce: .02, friction: .97, stick: .3, stickTime: .7, size: [.016, .013], sizeJitter: .4, shape: 'dot', glass: .45,
    colours: ['#f2fbff', '#bfe6ff', '#8fcbf0'], intensity: [2.4, 2, 1.5], middle: .5, fadeIn: .15, fadeOut: .2, additive: .55, onLand: 'puddle',
  },
  puddle: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, size: [.016, .03], sizeJitter: .4, shape: 'dot', glass: .7,
    colours: ['#e6f7ff', '#a8dcff', '#6fb6e8'], intensity: [1.2, 1, .8], fadeOut: .4, additive: .5, life: [1, 1.8],
  },
  // Frost: crystals that grow on their parts and stay there, and cold that falls off them.
  rime: {
    drag: 4, gravity: 0, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 6, size: [.018, .028], sizeJitter: .6, spin: 0, shape: 'shard',
    colours: ['#ffffff', '#e2f6ff', '#a8dcff'], intensity: [2.2, 1.7, 1.2], middle: .5, fadeIn: .2, fadeOut: .15, additive: .6, glass: .35,
  },
  chill: {
    drag: 2.2, gravity: .5, curl: .5, response: .6, size: [.025, .07], sizeJitter: .5, shape: 'glow',
    colours: ['#ffffff', '#dff4ff', '#bfe6ff'], intensity: [1.4, 1.1, .8], middle: .4, fadeIn: .25, fadeOut: .5, additive: .5, opacity: .35,
  },
  // Steam (water on fire): white haze that rushes up and spreads.
  steam: {
    drag: 1.4, gravity: -3, curl: 1.4, response: 1, size: [.05, .16], sizeJitter: .6, shape: 'glow',
    colours: ['#ffffff', '#f2f6f8', '#dfe6ea'], intensity: [1.6, 1.2, .8], middle: .3, fadeIn: .1, fadeOut: .55, additive: .4, opacity: .25,
  },
  // Poison: beads of it bubbling up off them, glassy and green, and a low sickly haze round their feet.
  toxin: {
    drag: 1.6, gravity: -.7, curl: .35, response: .8, size: [.012, .022], sizeJitter: .5, shape: 'dot', glass: .8,
    colours: ['#eaffc8', '#9be04a', '#4f9a1e'], intensity: [2, 1.6, 1.1], middle: .4, fadeIn: .2, fadeOut: .25, additive: .7,
  },
  ooze: {
    drag: .8, gravity: 6, curl: .05, response: .2, collide: true, bounce: 0, friction: .96, stick: .4, stickTime: .7, size: [.012, .01], shape: 'dot',
    colours: ['#d4ff8a', '#7cc832', '#3f7a14'], intensity: [1.6, 1.2, .9], middle: .5, fadeOut: .2, additive: .25, onLand: 'puddle',
  },
  miasma: {
    drag: 2, gravity: -.15, curl: .7, response: .8, size: [.05, .13], sizeJitter: .6, shape: 'glow',
    colours: ['#c6ff7a', '#7cc832', '#3a6a14'], intensity: [1.4, 1, .6], middle: .4, fadeIn: .3, fadeOut: .5, additive: .45, opacity: .3,
  },
  // A wound, as the cut opens it: a short scratch of light on their body, gone at once.
  gash: {
    drag: 4, gravity: 0, curl: 0, response: 0, size: [.032, .014], sizeJitter: .5, stretch: .03, aspect: .14, shape: 'line',
    colours: ['#ffffff', '#ffd2c8', '#ff8a7a'], intensity: [3.2, 2.2, 1.2], middle: .3, fadeIn: 0, fadeOut: .6, additive: 1,
  },
  // Blood (Aitor, 2026-11-20: liquid, and it meets what is around it). It wells up dark on their parts,
  // runs down them and falls; a cut flings it along the blow (`bloodspray`) and it lands on whoever
  // and whatever is in its way. Where a drop meets the floor it lies there (`bloodstain`), spreads a
  // little and dries dark before it goes. Dark and wet, never bright: it covers what is behind it.
  blood: {
    drag: 1.1, gravity: 5, curl: .03, response: .15, collide: true, bounce: 0, friction: .97, stick: .45, stickTime: 1.1, size: [.022, .017], sizeJitter: .5, shape: 'dot', glass: .35, core: 0,
    colours: ['#f02a38', '#b3131f', '#6a0a11'], intensity: [1.35, 1.1, .9], middle: .5, fadeIn: .12, fadeOut: .12, additive: .06, onLand: 'bloodstain',
  },
  bloodspray: {
    drag: .5, gravity: 9, curl: 0, response: .08, collide: true, bounce: 0, friction: .9, stick: .2, stickTime: .7, size: [.036, .02], sizeJitter: .6, stretch: .04, shape: 'streak', core: 0,
    colours: ['#ff3545', '#c01522', '#6a0a11'], intensity: [1.9, 1.3, .9], middle: .4, fadeOut: .15, additive: .08, onLand: 'bloodstain',
  },
  bloodstain: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, flat: true, size: [.045, .105], sizeJitter: .7, shape: 'dot', glass: .28, core: 0,
    colours: ['#e01a28', '#8a0d16', '#3a0709'], intensity: [1.45, 1, .7], middle: .25, fadeOut: .3, additive: .02, opacity: .92, life: [8, 13],
  },
  // Smoke that blinds: dark haze that clings round their head, turning. Smoke grey, never possession's violet.
  smog: {
    drag: 1.8, gravity: -.1, curl: .8, response: 1, size: [.09, .24], sizeJitter: .6, shape: 'glow', blur: [.6, 1.1], core: 0,
    colours: ['#bcc3c1', '#7f8a88', '#4b5452'], intensity: [.95, .85, .75], middle: .4, fadeIn: .2, fadeOut: .5, additive: .05, opacity: .38,
  },
  // Cegado's blindfold: a thick, nearly opaque band of soot wound round their eyes, which the field keeps turning. Its grey
  // leans cool and a touch green so that under a fight's warm, pink light it still reads as smoke, never as possession's violet.
  soot: {
    drag: 3.2, gravity: 0, curl: .35, response: 1, size: [.11, .18], sizeJitter: .45, shape: 'glow', blur: [.5, .9], core: 0,
    colours: ['#56605f', '#323a3a', '#1b2020'], intensity: [.8, .7, .6], middle: .5, fadeIn: .25, fadeOut: .45, additive: 0, opacity: .7,
  },
}

/** Each status's look. Rates are per second at levels I, II and III. */
export const STATUS_LOOKS: Record<StatusLookId, StatusLook> = {
  quemado: {
    name: 'Quemado', family: 'físico', seconds: 20, fire: true,
    shows: 'Arde él mismo: prende en unos puntos de su cuerpo y se extiende por sus piezas dejando carbón con vetas al rojo, y de ellas salen lenguas de fuego en 3D (I unas manchas y llamitas, II casi todo, III envuelto entero); brasas, chispas, ceniza y humo saltan de su superficie.',
    streams: [],
  },
  // Combustión (Quemado IV, docs/animas/README.md § Combustión): over the white-hot fire (`ignite`
  // 'white'), what says it is about to go: sparks gone blue-white, the hottest a flame gets, spinning
  // round them fast, and a heartbeat of heat that throws a ring of embers off their body every second.
  combustion: {
    name: 'Combustión', family: 'físico', seconds: 10,
    shows: 'Arde al rojo blanco, más alto que un incendio; chispas blancas y azuladas le giran alrededor y cada segundo late: un anillo de brasas sale de su cuerpo, como algo a punto de estallar.',
    streams: [
      { kind: 'spark', rate: [40, 40, 40], from: 'body', above: .25, outward: 1.4, up: 1.2, speed: .9, life: [.25, .55], colour: '#e8f4ff' },
      { kind: 'twinkle', rate: [14, 14, 14], from: 'body', above: .4, outward: .5, up: .8, speed: .4, life: [.3, .6], colour: '#bfe0ff', size: .8 },
    ],
    field: { height: .55, swirl: 14, pull: 4, lift: 2.5, turbulence: .3, reach: .55 },
    pulse: { every: 1, streams: [
      { kind: 'crackle', count: [70, 70, 70], rate: [0, 0, 0], from: 'body', above: .2, outward: 2.6, up: .5, speed: 1.6, life: [.35, .7], colour: '#fff1c8' },
      { kind: 'ember', count: [30, 30, 30], rate: [0, 0, 0], from: 'body', above: .3, outward: 1.8, up: 1.4, speed: 1.1, life: [.6, 1.1], colour: '#ffd27a' },
    ] },
    tint: [.12, .07, .03],
  },
  mojado: {
    name: 'Mojado', family: 'físico', seconds: 20,
    shows: 'Gotas que se forman en su cuerpo y bajan resbalando por sus piezas hasta dejar charquitos; un brillo frío y destellos de agua.',
    streams: [
      { kind: 'drip', rate: [14, 28, 50], from: 'body', above: .2, outward: .02, speed: .05, life: [2, 3.2] },
      { kind: 'twinkle', rate: [4, 8, 14], from: 'body', above: .3, outward: .05, life: [.25, .45], colour: '#cfeeff', size: .5 },
    ],
    tint: [0, .015, .05],
  },
  congelado: {
    name: 'Congelado', family: 'físico', seconds: 15,
    shows: 'Escarcha que crece pegada a sus piezas y se queda, y frío que cae de su cuerpo; queda quieto, sin respirar ni moverse, con un brillo helado.',
    streams: [
      { kind: 'rime', rate: [60, 120, 200], from: 'body', outward: -.35, life: [4, 6] },
      { kind: 'chill', rate: [10, 20, 34], from: 'body', above: .3, outward: .15, speed: .1, life: [1.2, 2] },
    ],
    tint: [.04, .1, .18], motion: 'freeze',
  },
  envenenado: {
    name: 'Envenenado', family: 'físico', seconds: 20,
    shows: 'Burbujas verdes que brotan de su cuerpo y suben, gotas que rezuman y un vaho enfermizo a sus pies; se tambalea y le sube un tinte verdoso.',
    streams: [
      { kind: 'toxin', rate: [8, 16, 28], from: 'body', above: .3, outward: .1, up: .3, speed: .1, life: [.9, 1.6] },
      { kind: 'ooze', rate: [2, 5, 9], from: 'body', above: .3, outward: .02, life: [1.2, 2] },
      { kind: 'miasma', rate: [8, 14, 24], from: 'feet', spread: .35, up: .15, speed: .15, life: [1.5, 2.5] },
    ],
    pulse: { every: 2.2, streams: [{ kind: 'toxin', count: [12, 22, 36], rate: [0, 0, 0], from: 'body', above: .3, outward: .5, up: .6, speed: .3, life: [.8, 1.4] }] },
    tint: [.02, .09, 0], motion: 'sway',
  },
  sangrado: {
    name: 'Sangrado', family: 'físico', seconds: 20,
    shows: 'Sangre oscura que le brota en el cuerpo, le resbala por las piezas y gotea; donde cae deja manchas en el suelo que se extienden y se secan. Con cada latido brota más, y cuantas más cargas, más sangra. Un corte la salpica en la dirección del golpe; gastar la herida la revienta.',
    streams: [{ kind: 'blood', rate: [4, 9, 16], from: 'body', above: .3, outward: .05, speed: .04, life: [2.2, 3.4] }],
    pulse: { every: 1.1, streams: [
      { kind: 'blood', count: [5, 10, 16], rate: [0, 0, 0], from: 'body', above: .35, outward: .3, up: .15, speed: .12, life: [2, 3.2] },
      { kind: 'gash', count: [1, 2, 3], rate: [0, 0, 0], from: 'body', above: .3, outward: .04, speed: .03, life: [.3, .5] },
    ] },
    tint: [.035, .004, .004],
  },
  // It has no levels (battle.ts `blind`): the same thick smoke whatever put it there.
  cegado: {
    name: 'Cegado', family: 'físico', seconds: 10,
    shows: 'Una venda de hollín que le da vueltas a la altura de los ojos y humo gris que se le escapa por arriba; busca a tientas, girando la cabeza a un lado y a otro. Sus golpes físicos fallan.',
    streams: [
      { kind: 'soot', rate: [90, 90, 90], from: 'head', spread: .2, speed: .12, life: [1.1, 1.6] },
      { kind: 'smog', rate: [60, 60, 60], from: 'head', spread: .3, up: .35, speed: .18, life: [1.4, 2.2] },
    ],
    field: { height: .85, swirl: 9, pull: 6, lift: .05, turbulence: .25, reach: .4 },
    pulse: { every: 1.6, streams: [{ kind: 'smog', count: [26, 26, 26], rate: [0, 0, 0], from: 'head', spread: .35, up: .6, speed: .35, life: [1, 1.6] }] },
    motion: 'grope',
  },
  paralizado: {
    name: 'Paralizado', family: 'físico', seconds: 8,
    shows: 'Descargas que le recorren el cuerpo a sacudidas, chispas que saltan de sus piezas y un parpadeo eléctrico; tiembla a tirones.',
    streams: [{ kind: 'spark', rate: [24, 45, 75], from: 'body', above: .2, outward: 1.1, speed: .7, life: [.2, .45], colour: '#d8ecff' }],
    pulse: { every: .3, streams: [{ kind: 'arc', count: [3, 5, 8], chain: 8, rate: [0, 0, 0], from: 'body', above: .15, outward: 1.8, speed: 1.4, life: [.2, .4], colour: '#cfe4ff' }] },
    tint: [.06, .08, .14], motion: 'twitch',
  },
  cauterizado: {
    name: 'Cauterizado', family: 'reacción', seconds: 12,
    shows: 'Las heridas, selladas al rojo: brasas apagadas que brillan pegadas a su cuerpo; no puede curarse mientras dura.',
    streams: [{ kind: 'ember', rate: [4, 7, 12], from: 'body', above: .25, outward: -.3, life: [1.5, 2.5], colour: '#ff8a5a' }],
    tint: [.05, .015, 0],
  },
  mareo: {
    name: 'Mareo', family: 'campaña', seconds: 12,
    shows: 'Lucecitas que le dan vueltas sobre la cabeza y se apagan en destellos; se tambalea.',
    streams: [{ kind: 'mote', rate: [9, 15, 22], from: 'head', spread: .3, speed: .2, life: [1.2, 1.8], colour: '#ffe680', size: 1.3 }],
    field: { height: 1.1, swirl: 10, pull: 6, lift: 0, reach: .45 },
    motion: 'sway',
  },
  llorera: {
    name: 'Llorera', family: 'campaña', seconds: 12,
    shows: 'Lágrimas que le saltan de la cara, caen y dejan charquitos a sus pies.',
    streams: [{ kind: 'drip', rate: [10, 16, 26], from: 'body', above: .72, outward: .8, up: 1, speed: .25, life: [.9, 1.4], colour: '#cfeaff', size: 1.4 }],
  },
  // Matemágico's ∂Q/∂t Condensador: the charge he carries until his next electric blow, or a foe's on him.
  cargado: {
    name: 'Cargado', family: 'matemágico', seconds: 30,
    shows: 'Lleva la carga encima: chispitas amarillas que le saltan del pecho y las manos y, cada poco, un arco corto que le cruza el cuerpo; brilla un poco.',
    streams: [{ kind: 'spark', rate: [7, 7, 7], from: 'body', above: .35, outward: .6, speed: .5, life: [.12, .3], colour: '#fff2a8', size: .7 }, { kind: 'twinkle', rate: [3, 3, 3], from: 'body', above: .45, outward: .3, up: .3, speed: .1, life: [.25, .5], colour: '#ffe45c' }],
    pulse: { every: .9, streams: [{ kind: 'arc', count: [2, 2, 2], chain: 7, rate: [0, 0, 0], from: 'body', above: .3, outward: .9, speed: .9, life: [.1, .2], colour: '#fff2a8' }] },
    tint: [.05, .045, .01],
  },
  // Tecnópata's (Bip's): a cure on the clock, waves of the mind, and a body shrunk (battle-scene scales it).
  sanacion: {
    name: 'Sanación', family: 'tecnópata', seconds: 15,
    shows: 'Lucecitas verdes que le suben despacio por el cuerpo, más con cada nivel; brilla un poco.',
    streams: [{ kind: 'mote', rate: [8, 13, 20], from: 'body', above: .1, outward: .25, up: .6, speed: .15, life: [.9, 1.5], colour: '#8ff0b0', size: 1.3 }, { kind: 'twinkle', rate: [2, 4, 7], from: 'body', above: .4, outward: .2, up: .4, speed: .1, life: [.4, .8], colour: '#d8ffe6' }],
    tint: [.01, .06, .02],
  },
  confusion: {
    name: 'Confusión', family: 'tecnópata', seconds: 30,
    shows: 'Lucecitas cian que le dan vueltas sobre la cabeza, de Bip, y se tambalea.',
    streams: [{ kind: 'mote', rate: [10, 10, 10], from: 'head', spread: .32, speed: .25, life: [1, 1.6], colour: '#7fe9ff', size: 1.3 }],
    field: { height: 1.1, swirl: -12, pull: 6, lift: 0, reach: .45 },
    tint: [0, .03, .05],
    motion: 'sway',
  },
  // Virus atómico: a swarm of tiny Bips round them, cyan dots darting in a tight cloud, never still.
  virus: {
    name: 'Virus', family: 'tecnópata', seconds: 20,
    shows: 'Un enjambre de Bips diminutos le rodea: puntos cian que zumban en una nube apretada alrededor de su cuerpo y no paran.',
    streams: [
      { kind: 'mote', rate: [34, 34, 34], from: 'body', above: .3, outward: .9, speed: .6, life: [.7, 1.2], colour: '#7fe9ff', size: .9 },
      { kind: 'twinkle', rate: [10, 10, 10], from: 'body', above: .4, outward: .6, speed: .5, life: [.2, .4], colour: '#e8fdff', size: .6 },
    ],
    field: { height: .55, swirl: 18, pull: 9, lift: .3, turbulence: 1.2, reach: .6 },
    tint: [0, .025, .04],
  },
  encogido: {
    name: 'Encogido', family: 'tecnópata', seconds: 15,
    shows: 'Se queda pequeño; unas chispitas cian le rodean los pies.',
    streams: [{ kind: 'mote', rate: [5, 5, 5], from: 'feet', spread: .2, speed: .1, life: [.8, 1.3], colour: '#bff6ff', size: 1 }],
  },
};

/** The reactions the combat design decided (docs/combat.md): which status, which element, what it leaves. */
export const REACTIONS: Record<ReactionId, { name: string; status: StatusLookId; element: string; leaves: string; shows: string }> = {
  humo: { name: 'Humo', status: 'quemado', element: 'Agua', leaves: 'Cegado', shows: 'El agua apaga la llama de golpe en una nube de vapor y humo oscuro que se le queda en la cabeza.' },
  conduccion: { name: 'Conducción', status: 'mojado', element: 'Eléctrico', leaves: 'Daño a todos los mojados; se secan. Al que recibió el golpe, 50 % de Shock: pierde su siguiente turno', shows: 'La corriente corre por el agua que llevan encima: arcos por todo el cuerpo, chispas y el agua saltando en gotas.' },
  paralisis: { name: 'Parálisis', status: 'mojado', element: 'Eléctrico', leaves: 'Paralizado', shows: 'La descarga corre por el agua de su cuerpo: arcos que lo envuelven entero, chispas y un fogonazo.' },
  congelar: { name: 'Congelado', status: 'mojado', element: 'Frío', leaves: 'Congelado', shows: 'Las gotas se hielan en el sitio: una costra de escarcha le cubre de golpe y el frío cae.' },
  arrastre: { name: 'Arrastra el humo', status: 'cegado', element: 'Viento', leaves: 'Cegado en el otro bando', shows: 'Una ráfaga le arranca el humo de la cabeza y lo lleva al otro bando.' },
  'veneno-ardiente': { name: 'Veneno ardiente', status: 'envenenado', element: 'Fuego', leaves: 'Daño a los adyacentes', shows: 'El veneno estalla en llamas verdes y naranjas: chispas a los lados que alcanzan a quien tenga al lado.' },
  vapor: { name: 'Vapor', status: 'mojado', element: 'Fuego', leaves: 'Cegado', shows: 'El agua hierve de golpe: una columna de vapor que sube y se le queda en la cabeza.' },
  anicos: { name: 'Añicos', status: 'congelado', element: 'Golpe físico fuerte', leaves: 'Daño extra; se acaba Congelado', shows: 'El hielo revienta en esquirlas que salen girando y rebotan, y deja escarcha en el suelo.' },
  contagio: { name: 'Contagio', status: 'envenenado', element: 'Agua', leaves: 'Envenenado más débil en los adyacentes', shows: 'El veneno se diluye en un vaho verde que fluye hasta quien tiene al lado y le prende.' },
  cauterizado: { name: 'Cauterizado', status: 'sangrado', element: 'Fuego', leaves: 'Cauterizado (no puede curarse)', shows: 'Un fogonazo sella las heridas: chisporroteo, una voluta de humo y las heridas brillando al rojo.' },
  tormenta: { name: 'Tormenta', status: 'cegado', element: 'Eléctrico', leaves: 'Daño a todos los que están en el humo', shows: 'La descarga salta por el humo de un luchador a otro: arcos entre todos los que están dentro.' },
  plasma: { name: 'Plasma', status: 'quemado', element: 'Eléctrico', leaves: 'Todo lo que le quedaba al fuego, de golpe; se apaga', shows: 'La descarga se mete en la llama y la enciende entera de una vez: un fogonazo blanco, arcos por el cuerpo y la llama que revienta hacia fuera en brasas.' },
};

/** A fighter as status effects need them: who, their model, where their feet are, their slot in the fight's particles. */
export interface StatusFighter { id: string; model: pc.Entity; feet: pc.Vec3; index: number; party: boolean }

interface Active {
  look: StatusLookId; level: number; left: number; total: number;
  /** Counted in rounds by the fight (the campaign's statuses): its clock does not run. */
  held: boolean;
  emitters: { stream: Stream; emitter: GpuEmitter }[]; field?: GpuField; beat: number; ending: boolean;
}

export function createStatusFx(effects: Effects, hooks: { ignite(id: string, level?: FireLevel): void }) {
  const on = new Map<string, Active[]>();
  let fighters: StatusFighter[] = [];
  /** Steam that lingers over a side after Vapor, and others that last a moment. */
  const timed: { left: number; end(): void }[] = [];
  const levelOf = (n: number) => Math.max(1, Math.min(3, Math.round(n)));
  const fireLevel = (level: number): FireLevel => level >= 3 ? 'high' : level >= 2 ? 'medium' : 'light';
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries(STATUS_KINDS)) if (!g.get(name)) g.define(name, kind);
  }
  const find = (id: string) => fighters.find(f => f.id === id);
  const bodyFor = (f: StatusFighter): Body => bodyOf(f.model, f.feet);
  /** Where a stream is born: on their parts, round their head or round their feet. */
  function streamSpawn(stream: Stream, f: StatusFighter, body: Body) {
    if (stream.from === 'head') return { at: { x: f.feet.x, y: f.feet.y + body.height * .85, z: f.feet.z }, shape: 'ball' as const, spread: stream.spread ?? .2 };
    if (stream.from === 'feet') return { at: { x: f.feet.x, y: f.feet.y + .06, z: f.feet.z }, shape: 'ring' as const, spread: (stream.spread ?? .3) + body.radius };
    return { at: f.feet, shape: 'surface' as const, fighter: f.index, above: stream.above ?? 0 };
  }
  function burstOf(stream: Stream, f: StatusFighter, count: number, extra: { chain?: number } = {}) {
    const g = gpu();
    if (!g || count <= 0) return;
    const body = bodyFor(f);
    g.burst(stream.kind, { ...streamSpawn(stream, f, body), count: extra.chain ? count * extra.chain : count, chain: extra.chain, outward: stream.outward, up: stream.up, speed: stream.speed, life: stream.life, colour: stream.colour, size: stream.size,
      ...(stream.kind === 'arc' ? { light: { intensity: 1.6, range: 2, colour: stream.colour } } : {}) });
  }
  function startStreams(a: Active, f: StatusFighter) {
    const g = gpu(), look = STATUS_LOOKS[a.look];
    if (!g || a.emitters.length || a.field) return;
    ensureKinds();
    const body = bodyFor(f);
    a.emitters = look.streams.map(stream => ({ stream, emitter: g.emitter(stream.kind, { ...streamSpawn(stream, f, body), rate: 0, outward: stream.outward, up: stream.up, speed: stream.speed, life: stream.life, colour: stream.colour, size: stream.size }) }));
    if (look.field) a.field = g.field({ at: f.feet, radius: body.radius + look.field.reach, swirl: look.field.swirl, pull: look.field.pull, lift: look.field.lift, turbulence: look.field.turbulence ?? 0, follow: f.model, offset: { x: 0, y: body.height * look.field.height, z: 0 } });
  }
  function stopStreams(a: Active) {
    a.emitters.forEach(e => e.emitter.remove()); a.emitters = [];
    a.field?.remove(); a.field = undefined;
  }

  const api = {
    /** Who is in the fight this frame, in the fight particles' order (battle-scene). */
    setFighters(list: StatusFighter[]) { fighters = list; },
    /**
     * Puts a status on someone at `level` (1–3) for `seconds` (its look's default): again while it is on
     * it raises the level and starts its clock again (the design's `escalate`), unless `level` is given.
     */
    apply(id: string, look: StatusLookId, o: { level?: number; seconds?: number; left?: number; held?: boolean } = {}) {
      const f = find(id);
      if (!f) return;
      const list = on.get(id) ?? [];
      on.set(id, list);
      let a = list.find(s => s.look === look && !s.ending);
      // Fire at IV burns white (Combustión); the look's own levels stop at III.
      const white = look === 'quemado' && (o.level ?? 0) >= 4;
      const seconds = o.seconds ?? STATUS_LOOKS[look].seconds;
      if (a) { a.level = levelOf(o.level ?? a.level + 1); a.total = seconds; a.left = o.left ?? seconds; a.held = !!o.held; }
      else {
        a = { look, level: levelOf(o.level ?? 1), left: o.left ?? seconds, total: seconds, held: !!o.held, emitters: [], beat: 0, ending: false };
        list.push(a);
      }
      if (STATUS_LOOKS[look].fire) hooks.ignite(id, white ? 'white' : fireLevel(a.level));
    },
    /**
     * Combustión bursts on `id` (docs/animas/README.md § Combustión): the white fire pulls into their
     * chest, then a flash and a ball of fire that swallows them, a ring of flame along the floor, and
     * embers arcing out to each of `to` (the other foes), whose fires flare as they land.
     */
    combust(id: string, to: string[]) {
      const f = find(id), g = gpu();
      if (!f || !g) return;
      ensureKinds();
      const body = bodyFor(f), chest = { x: f.feet.x, y: f.feet.y + body.height * .55, z: f.feet.z };
      // It draws in: sparks off their body pulled into the chest.
      g.burst('spark', { at: chest, count: 90, shape: 'surface', fighter: f.index, outward: -1.4, speed: .9, life: [.1, .18], colour: '#fff6dc' });
      timed.push({ left: .1, end: () => {
        const h = gpu();
        if (!h) return;
        // The ball: a white heart, a skin of gold and orange crackle, embers thrown wide, and smoke after.
        h.burst('spark', { at: chest, count: 160, spread: .2, speed: 6.5, life: [.25, .6], colour: '#ffffff', light: { intensity: 9, range: 6, colour: '#ffcf7a' } });
        h.burst('crackle', { at: chest, count: 340, spread: body.radius * .6, speed: 4.2, up: 1, life: [.4, .9], colour: '#ffb84a' });
        h.burst('ember', { at: chest, count: 180, spread: body.radius * .5, speed: 3.2, up: 2.4, life: [.9, 1.8], colour: '#ffd27a' });
        h.burst('smog', { at: chest, count: 120, spread: body.radius, up: 1.6, speed: .8, life: [1, 1.8] });
        // A ring of flame running out along the floor.
        h.burst('crackle', { at: { x: f.feet.x, y: f.feet.y + .08, z: f.feet.z }, count: 220, shape: 'ring', spread: body.radius + .1, outward: 7, speed: 1, around: .2, life: [.35, .6], colour: '#ff9a3c' });
        // Embers arc to every other foe: their own fire goes up as they land.
        for (const other of to) {
          const o = find(other);
          if (!o) continue;
          const at = { x: o.feet.x, y: o.feet.y + bodyFor(o).height * .55, z: o.feet.z };
          h.burst('ember', { at: chest, to: at, shape: 'line', count: 70, speed: .6, life: [.35, .7], colour: '#ffcf6a', light: { intensity: 3, range: 2.4, colour: '#ffb84a' } });
          timed.push({ left: .28, end: () => gpu()?.burst('crackle', { at, count: 90, shape: 'surface', fighter: o.index, outward: 1.8, up: 1.4, speed: 1.2, life: [.3, .6], colour: '#ffb84a' }) });
        }
      } });
    },
    /** Sets how long a status shown as `held` has left (the fight's clock keeps it, src/battle.ts `runClock`). */
    hold(id: string, look: StatusLookId, left: number) {
      const a = on.get(id)?.find(s => s.look === look && !s.ending);
      if (a) a.left = Math.max(0, left);
    },
    /** Takes a status off at once. */
    remove(id: string, look: StatusLookId) {
      const a = on.get(id)?.find(s => s.look === look && !s.ending);
      if (!a) return;
      a.ending = true; a.left = 0;
      stopStreams(a);
      if (STATUS_LOOKS[look].fire) hooks.ignite(id);
    },
    has(id: string, look: StatusLookId) { return !!on.get(id)?.some(s => s.look === look && !s.ending); },
    /** What is on someone: look, level and how much is left (0–1). */
    on(id: string) { return (on.get(id) ?? []).filter(s => !s.ending).map(s => ({ look: s.look, level: s.level, left: s.total > 0 ? s.left / s.total : 0 })); },
    /** Light their statuses add to their body this frame (linear RGB). */
    tint(id: string, time: number): [number, number, number] {
      const out: [number, number, number] = [0, 0, 0];
      for (const a of on.get(id) ?? []) {
        const t = STATUS_LOOKS[a.look].tint;
        if (!t || a.ending) continue;
        // Paralysis flickers; the rest hold steady, stronger at higher levels.
        const k = (.7 + .3 * a.level) * (a.look === 'paralizado' ? .4 + .6 * Math.abs(Math.sin(time * 37 + Math.sin(time * 11) * 3)) : 1);
        for (let c = 0; c < 3; c++) out[c] += t[c] * k;
      }
      return out;
    },
    /** How their statuses move them: frozen stands still, paralysed twitches, poisoned and dizzy sway. */
    motion(id: string): StatusMotion | undefined {
      const looks = (on.get(id) ?? []).filter(s => !s.ending).map(s => STATUS_LOOKS[s.look].motion);
      return looks.includes('freeze') ? 'freeze' : looks.includes('twitch') ? 'twitch' : looks.includes('sway') ? 'sway' : looks.includes('grope') ? 'grope' : undefined;
    },
    /**
     * A cut opens on `id` (a blow that adds Sangrado): blood flung along the blow from where it landed,
     * more the more stacks it added; it falls on the floor behind them and on whoever stands there.
     */
    cut(id: string, at: { x: number; y: number; z: number }, dir: { x: number; z: number }, stacks = 1) {
      const f = find(id), g = gpu();
      if (!f || !g) return;
      ensureKinds();
      const n = Math.max(1, Math.min(4, stacks));
      g.burst('bloodspray', { at, count: 14 + n * 10, spread: .08, velocity: { x: dir.x * 3.4, y: 2, z: dir.z * 3.4 }, cone: .6, speed: 1.5, life: [.7, 1.2] });
      g.burst('gash', { at, count: 2 + n, shape: 'surface', fighter: f.index, above: .3, outward: .04, speed: .03, life: [.3, .5] });
    },
    /**
     * A wound of `bled` stacks is spent on `id`: all of it at once, off their whole body and out along
     * the blow, so the floor round them says how big the wound was.
     */
    spill(id: string, at: { x: number; y: number; z: number }, dir: { x: number; z: number }, bled: number) {
      const f = find(id), g = gpu();
      if (!f || !g || bled <= 0) return;
      ensureKinds();
      const n = Math.min(10, bled);
      g.burst('bloodspray', { at, count: 24 + n * 12, spread: .1, velocity: { x: dir.x * 3.8, y: 2.3, z: dir.z * 3.8 }, cone: .85, speed: 2, life: [.7, 1.3], size: 1.2 });
      g.burst('blood', { at, count: 10 + n * 6, shape: 'surface', fighter: f.index, above: .25, outward: 1.6, up: .9, speed: .9, life: [1.2, 2.2] });
    },
    /**
     * Cegado: `id`'s physical blow found nothing (battle.ts `misses`). The smoke round its head is torn off along the
     * swing (`dir`) and goes on past `at`, where the blow went by whoever it was meant for.
     */
    miss(id: string, at: { x: number; y: number; z: number }, dir: { x: number; z: number }) {
      const f = find(id), g = gpu();
      if (!f || !g) return;
      ensureKinds();
      const body = bodyFor(f), head = { x: f.feet.x, y: f.feet.y + body.height * .85, z: f.feet.z };
      g.burst('soot', { at: head, count: 50, spread: .25, velocity: { x: dir.x * 3, y: .1, z: dir.z * 3 }, speed: .5, cone: .5, life: [.6, 1.1] });
      g.burst('smog', { at, count: 90, spread: .3, velocity: { x: dir.x * 3.4, y: .25, z: dir.z * 3.4 }, speed: .6, cone: .45, life: [.8, 1.4] });
      g.burst('mote', { at, count: 16, spread: .2, velocity: { x: dir.x * 5, y: .3, z: dir.z * 5 }, speed: .8, cone: .3, life: [.25, .45], colour: '#e4e7eb' });
    },
    /** An Atacar with an element lands on `id`: a little burst of it, no status (docs/combat.md § Reacciones entre elementos). */
    touch(element: 'agua' | 'fuego' | 'electrico', id: string) {
      const f = find(id), g = gpu();
      if (!f || !g) return;
      ensureKinds();
      const chest = { x: f.feet.x, y: f.feet.y + bodyFor(f).height * .55, z: f.feet.z };
      if (element === 'agua') {
        g.burst('drip', { at: chest, count: 46, shape: 'surface', fighter: f.index, above: .25, outward: 1.5, up: 1, speed: .9, life: [.45, .85] });
        g.burst('twinkle', { at: chest, count: 12, spread: .22, speed: 1.2, life: [.2, .4], colour: '#cfeeff', size: .6 });
      } else if (element === 'fuego') {
        g.burst('ember', { at: chest, count: 46, spread: .16, speed: 2, life: [.35, .75], colour: '#ffb84a' });
        g.burst('crackle', { at: chest, count: 30, shape: 'surface', fighter: f.index, outward: 1.4, up: 1.2, speed: .9, life: [.2, .45] });
      } else {
        g.burst('arc', { at: chest, count: 4 * 8, chain: 8, shape: 'surface', fighter: f.index, outward: 1.6, speed: 1.2, life: [.14, .28], colour: '#fff2a8', light: { intensity: 2, range: 2.2, colour: '#ffe45c' } });
        g.burst('spark', { at: chest, count: 28, spread: .14, speed: 2.6, life: [.18, .4], colour: '#fff2a8' });
      }
    },
    /** A reaction on `id` (docs/combat.md): what was on them turns into what it leaves, with its moment. */
    react(reaction: ReactionId, id: string) {
      const f = find(id), g = gpu();
      if (!f) return;
      ensureKinds();
      const body = bodyFor(f), chest = { x: f.feet.x, y: f.feet.y + body.height * .55, z: f.feet.z }, head = { x: f.feet.x, y: f.feet.y + body.height * .85, z: f.feet.z };
      const side = fighters.filter(o => o.party === f.party && o.id !== id);
      const neighbours = side.filter(o => o.feet.distance(f.feet) < 1.6);
      const others = fighters.filter(o => o.party !== f.party);
      const centre = (list: StatusFighter[]) => list.reduce((c, o) => c.add(o.feet), new pc.Vec3()).mulScalar(1 / Math.max(1, list.length));
      const chestOf = (o: StatusFighter) => ({ x: o.feet.x, y: o.feet.y + bodyFor(o).height * .55, z: o.feet.z });
      const level = on.get(id)?.find(s => s.look === REACTIONS[reaction].status && !s.ending)?.level ?? 1;
      api.remove(id, REACTIONS[reaction].status);
      switch (reaction) {
        case 'humo':
          g?.burst('steam', { at: chest, count: 180, spread: body.radius * .7, up: 2, speed: 1.2, life: [.8, 1.6] });
          g?.burst('smog', { at: head, count: 220, spread: .3, up: .8, speed: 1, life: [1.5, 2.5] });
          api.apply(id, 'cegado', { level });
          break;
        case 'conduccion':
          g?.burst('arc', { at: chest, count: 12 * 10, chain: 10, shape: 'surface', fighter: f.index, outward: 2, speed: 1.5, life: [.22, .46], colour: '#fff2a8', light: { intensity: 4, range: 3, colour: '#ffe45c' } });
          g?.burst('spark', { at: chest, count: 110, shape: 'surface', fighter: f.index, outward: 2.5, speed: 1.5, life: [.3, .7], colour: '#fff6c4' });
          g?.burst('drip', { at: chest, count: 80, shape: 'surface', fighter: f.index, outward: 2.2, up: 1.6, speed: 1.2, life: [.5, .9] });
          break;
        case 'paralisis':
          g?.burst('arc', { at: chest, count: 14 * 10, chain: 10, shape: 'surface', fighter: f.index, outward: 2, speed: 1.5, life: [.25, .5], colour: '#cfe4ff', light: { intensity: 4, range: 3, colour: '#cfe4ff' } });
          g?.burst('spark', { at: chest, count: 120, shape: 'surface', fighter: f.index, outward: 2.5, speed: 1.5, life: [.3, .7], colour: '#d8ecff' });
          g?.burst('drip', { at: chest, count: 60, shape: 'surface', fighter: f.index, outward: 1.5, up: 1, speed: .8, life: [.6, 1] });
          api.apply(id, 'paralizado', { level });
          break;
        case 'congelar':
          g?.burst('rime', { at: f.feet, count: 360, shape: 'surface', fighter: f.index, outward: -.4, life: [5, 6] });
          g?.burst('chill', { at: chest, count: 140, spread: body.radius, speed: .4, life: [1.2, 2.2] });
          g?.burst('frost', { at: { x: f.feet.x, y: f.feet.y + .05, z: f.feet.z }, count: 80, shape: 'ring', spread: body.radius + .15, speed: .3, around: .4, life: [1.4, 2.2] });
          api.apply(id, 'congelado', { level });
          break;
        case 'arrastre': {
          // A gust from their side to the other carries the smoke across.
          const to = centre(others), dir = to.clone().sub(f.feet).normalize();
          g?.burst('smog', { at: head, count: 260, spread: .35, velocity: { x: dir.x * 4, y: .6, z: dir.z * 4 }, speed: 1, cone: .5, life: [1.2, 2] });
          timed.push({ left: .7, end: () => others.forEach(o => api.apply(o.id, 'cegado', { level })) });
          break;
        }
        case 'veneno-ardiente':
          g?.burst('crackle', { at: chest, count: 260, spread: .15, speed: 4.5, life: [.4, .9], colour: '#d6ff7a' });
          g?.burst('ember', { at: chest, count: 120, spread: .2, speed: 2.5, life: [.8, 1.6], colour: '#ffb84a' });
          g?.burst('toxin', { at: chest, count: 80, spread: .2, speed: 2, life: [.6, 1.2] });
          for (const o of neighbours) g?.burst('crackle', { at: chest, to: chestOf(o), shape: 'line', count: 120, speed: .8, life: [.3, .6], colour: '#ffcf6a', light: { intensity: 3, range: 2.2, colour: '#ffb84a' } });
          hooks.ignite(id, 'medium');
          timed.push({ left: 1.2, end: () => hooks.ignite(id) });
          break;
        case 'vapor':
          g?.burst('steam', { at: chest, count: 320, spread: body.radius, up: 3, speed: 1.5, life: [1, 2] });
          // The boil itself, a fluid (src/fluid-fx.ts): steam born packed round them that swells out and rolls up.
          ensureFluidKinds(g); g?.burst('fluido-vapor', { at: chest, count: 420, spread: body.radius * .5, speed: 1.2, up: 1.6, life: [1.2, 2] });
          g?.burst('steam', { at: head, count: 140, spread: .3, up: .6, speed: .6, life: [1.4, 2.4] });
          api.apply(id, 'cegado', { level });
          break;
        case 'anicos':
          // The ice bursts into fine splinters that fly off spinning and skitter, glittering, and frost the floor.
          g?.burst('rime', { at: f.feet, count: 420, shape: 'surface', fighter: f.index, outward: 3.2, up: 1.6, speed: 1.6, life: [.6, 1.2] });
          g?.burst('twinkle', { at: chest, count: 40, spread: body.radius, speed: 2, life: [.3, .6], colour: '#e6f6ff', size: .6 });
          g?.burst('chill', { at: chest, count: 90, spread: body.radius, speed: 1.2, life: [.8, 1.5] });
          g?.burst('frost', { at: { x: f.feet.x, y: f.feet.y + .05, z: f.feet.z }, count: 90, shape: 'ring', spread: body.radius + .2, speed: .5, around: .4, life: [1.4, 2.2] });
          break;
        case 'contagio':
          g?.burst('drip', { at: chest, count: 80, shape: 'surface', fighter: f.index, outward: .8, up: .6, speed: .5, life: [.6, 1.2] });
          for (const o of neighbours) {
            g?.burst('miasma', { at: chest, to: chestOf(o), shape: 'line', count: 160, speed: .3, life: [1, 1.8] });
            timed.push({ left: .8, end: () => api.apply(o.id, 'envenenado', { level: Math.max(1, level - 1) }) });
          }
          if (level > 1) api.apply(id, 'envenenado', { level: level - 1 });
          break;
        case 'cauterizado':
          g?.burst('flare', { at: chest, count: 3, spread: .1, life: [.2, .3], light: { intensity: 4, range: 2.5, colour: '#ffb070' } });
          g?.burst('crackle', { at: chest, count: 140, shape: 'surface', fighter: f.index, outward: 1.8, up: 1.5, speed: 1, life: [.3, .7] });
          g?.burst('smog', { at: chest, count: 60, spread: .2, up: 1, speed: .4, life: [1, 1.8] });
          api.apply(id, 'cauterizado', { level });
          break;
        case 'plasma':
          // The bolt goes into the flame and sets all of it off at once: a white flare, arcs over the body, the fire bursting out as embers.
          g?.burst('flare', { at: chest, count: 4, spread: .12, life: [.18, .3], light: { intensity: 6, range: 3.5, colour: '#fff0d8' } });
          g?.burst('arc', { at: chest, count: 10 * 10, chain: 10, shape: 'surface', fighter: f.index, outward: 2, speed: 1.5, life: [.18, .38], colour: '#f4f0ff', light: { intensity: 4, range: 3, colour: '#dfe6ff' } });
          g?.burst('crackle', { at: chest, count: 260 + 80 * level, shape: 'surface', fighter: f.index, outward: 3.4, up: 1.6, speed: 1.8, life: [.35, .8], colour: '#ffb84a' });
          g?.burst('ember', { at: chest, count: 120 + 40 * level, spread: body.radius * .6, speed: 3.6, up: 2.2, life: [.8, 1.6], colour: '#ffd9a0' });
          g?.burst('smog', { at: head, count: 50, spread: .25, up: 1, speed: .5, life: [1, 1.8] });
          break;
        case 'tormenta': {
          // The bolt jumps through the smoke to everyone in it.
          const inSmoke = fighters.filter(o => o.id !== id && api.has(o.id, 'cegado'));
          g?.burst('arc', { at: chest, count: 8 * 10, chain: 10, shape: 'surface', fighter: f.index, outward: 2, speed: 1.5, life: [.2, .42], colour: '#e6eeff', light: { intensity: 4, range: 3, colour: '#cfe0ff' } });
          for (const o of inSmoke) g?.burst('arc', { at: chest, to: chestOf(o), shape: 'line', count: 3 * 16, chain: 16, speed: .6, life: [.25, .45], colour: '#e6eeff', light: { intensity: 4, range: 3, colour: '#cfe0ff' } });
          g?.burst('spark', { at: chest, count: 100, spread: .2, speed: 3, life: [.3, .6], colour: '#e6eeff' });
          break;
        }
      }
    },
    update(dt: number, time: number) {
      for (let i = timed.length - 1; i >= 0; i--) if ((timed[i].left -= dt) <= 0) { timed[i].end(); timed.splice(i, 1); }
      for (const [id, list] of on) {
        const f = find(id);
        list.forEach(a => {
          const look = STATUS_LOOKS[a.look];
          if (!a.ending && !a.held) a.left -= dt;
          if (a.left <= 0 && !a.ending) api.remove(id, a.look);
          if (!f) return;
          const body = bodyFor(f);
          if (a.ending || !f.model.enabled) { stopStreams(a); return; }
          startStreams(a, f);
          for (const { stream, emitter } of a.emitters) {
            emitter.rate = stream.rate[a.level - 1];
            Object.assign(emitter, streamSpawn(stream, f, body));
          }
          // Pulses keep their rhythm (a heartbeat, a jolt).
          if (look.pulse && (a.beat -= dt) <= 0) {
            a.beat = look.pulse.every * (.85 + Math.random() * .3);
            for (const stream of look.pulse.streams) burstOf(stream, f, stream.count[a.level - 1], { chain: stream.chain });
          }
        });
        for (let i = list.length - 1; i >= 0; i--) if (list[i].ending) list.splice(i, 1);
        if (!list.length) on.delete(id);
      }
      void time;
    },
    /** Every status off at once (the fight ended). */
    clear() {
      for (const list of on.values()) for (const a of list) stopStreams(a);
      on.clear(); timed.length = 0;
    },
    destroy() { api.clear(); },
  };
  return api;
}
export type StatusFx = ReturnType<typeof createStatusFx>;
