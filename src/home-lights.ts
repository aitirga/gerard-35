/**
 * The lights at home follow the game (docs/home-lights.md). Each place lends the living room its
 * main colours, fights play on the bulbs (hits flash, low health turns them red and sets a
 * heartbeat going) and the Meridiana flat is the real one: its lamps and the bulbs at home mirror
 * each other both ways. The browser decides; `lights.py` sends it to the bulbs (on the LAN at home).
 * The room keeps to pastels (`pastel`), drops to a breathing dark in the dungeons (`penumbra`) and
 * breaks into raw colour only at the few peaks (`peakOf`, the story's `moment`s). Timing runs beside
 * the game: each flash is given the moment it must be seen, on the bridge's clock, and the bridge
 * sends every bulb its message that bulb's own latency early (docs/home-lights.md § Timing).
 * Everything above `createHomeLights` is pure, for the tests.
 */
import type { EnvironmentId } from './environments.ts';
import { FOE_ABILITIES, markSpent, type BattleEffect, type BattleState, type Encounter } from './battle.ts';
import { AURELIA_PHASES, CASTLE_ENCOUNTERS, MELODY, REINA_PHASES, castlePhaseOf, type CastleEncounter } from './castle.ts';
import type { EndingChoice } from './castle-story.ts';
import { CAST_CONTACT, CONTACT_SECONDS, DUAL_BANNER_SEEN, DUAL_FREEZE, FIGURES, SPELL_CONTACT, isFigure } from './battle-motion.ts';

export type LightId = 'cocina' | 'sofa' | 'luna' | 'mesa' | 'dormitorio' | 'terraza' | 'estudio' | 'galeria';
/**
 * `labels` are the bulbs' names in the LIFX app (the bedroom's two, both over the bed, are one
 * light); `name` is how Gerard calls it, `short` how the lamp's dial titles it.
 */
export interface HouseLight { id: LightId; labels: string[]; room: 'Salón' | 'Dormitorio' | 'Terraza' | 'Estudio' | 'Galería'; name: string; short: string }
export const HOUSE_LIGHTS: readonly HouseLight[] = [
  { id: 'cocina', labels: ['Cocina'], room: 'Salón', name: 'la luz de la cocina', short: 'Cocina' },
  { id: 'sofa', labels: ['Sofá'], room: 'Salón', name: 'la luz del sofá', short: 'Sofá' },
  { id: 'luna', labels: ['Luna'], room: 'Salón', name: 'la luna', short: 'Luna' },
  { id: 'mesa', labels: ['Mesa'], room: 'Salón', name: 'la lámpara de la mesa', short: 'Mesa' },
  { id: 'dormitorio', labels: ['Cama', 'Armario'], room: 'Dormitorio', name: 'la luz del dormitorio', short: 'Dormitorio' },
  { id: 'terraza', labels: ['Terraza'], room: 'Terraza', name: 'el farol de la terraza', short: 'Terraza' },
  { id: 'estudio', labels: ['Estudio'], room: 'Estudio', name: 'la luz del estudio', short: 'Estudio' },
  { id: 'galeria', labels: ['Galeria'], room: 'Galería', name: 'la luz de la galería', short: 'Galería' },
];
const SALON: LightId[] = ['cocina', 'sofa', 'luna', 'mesa'];
const ELSEWHERE: LightId[] = ['dormitorio', 'terraza', 'estudio', 'galeria'];
export const lightById = (id: LightId) => HOUSE_LIGHTS.find(light => light.id === id)!;
export const lampInteraction = (id: string) => id.startsWith('lamp-') && HOUSE_LIGHTS.some(light => `lamp-${light.id}` === id) ? id.slice(5) as LightId : undefined;

/** A bulb's look in LIFX's own terms: whites are a temperature with no saturation. */
export interface Lamp { on: boolean; hue: number; saturation: number; brightness: number; kelvin: number }
export type Look = Partial<Record<LightId, Lamp>>;
export type Scope = 'salon' | 'casa';
export type Intensity = 'suave' | 'normal' | 'intensa';
export const OFF: Lamp = { on: false, hue: 0, saturation: 0, brightness: 0, kelvin: 3500 };

export function white(kelvin: number, brightness: number): Lamp {
  return { on: true, hue: 0, saturation: 0, brightness, kelvin };
}
/** A colour by its hex code, `saturation` capped so a place tints the room instead of flooding it. */
export function hex(code: string, brightness: number, saturation = 1): Lamp {
  const n = parseInt(code.slice(1), 16), [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => v / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  const hue = d === 0 ? 0 : max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { on: true, hue: Math.round(hue), saturation: Math.min(saturation, max ? d / max : 0), brightness, kelvin: 3500 };
}
/** Halfway (`k` 0 → a, 1 → b) along the shorter way round the hue circle. */
export function mix(a: Lamp, b: Lamp, k: number): Lamp {
  if (!a.on) return k < .5 ? a : b;
  if (!b.on) return { ...a, brightness: a.brightness * (1 - k) };
  const turn = ((b.hue - a.hue + 540) % 360) - 180;
  // A white has no hue of its own: it takes the colour's.
  const hue = a.saturation < .05 ? b.hue : b.saturation < .05 ? a.hue : (a.hue + turn * k + 360) % 360;
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { on: true, hue: Math.round(hue), saturation: lerp(a.saturation, b.saturation), brightness: lerp(a.brightness, b.brightness), kelvin: Math.round(lerp(a.kelvin, b.kelvin)) };
}
const scale = (lamp: Lamp, k: number): Lamp => lamp.on ? { ...lamp, brightness: Math.min(1, lamp.brightness * k) } : lamp;
/** Whether two looks would read the same on a bulb (LIFX rounds what it reports). */
export function sameLamp(a: Lamp | undefined, b: Lamp | undefined) {
  if (!a || !b) return a === b;
  if (!a.on || !b.on) return a.on === b.on;
  const hueOff = Math.abs(((a.hue - b.hue + 540) % 360) - 180) * Math.max(a.saturation, b.saturation);
  return hueOff < 6 && Math.abs(a.saturation - b.saturation) < .06 && Math.abs(a.brightness - b.brightness) < .05 && (Math.max(a.saturation, b.saturation) > .5 || Math.abs(a.kelvin - b.kelvin) < 250);
}

/** RGB 0–1 for drawing a lamp in the game: whites from their temperature (Tanner Helland's fit). */
export function lampRgb(lamp: Lamp): [number, number, number] {
  const t = lamp.kelvin / 100;
  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  const warm: [number, number, number] = t <= 66
    ? [1, clamp(99.47 * Math.log(t) - 161.12), t <= 19 ? 0 : clamp(138.52 * Math.log(t - 10) - 305.04)]
    : [clamp(329.7 * (t - 60) ** -.1332), clamp(288.12 * (t - 60) ** -.0755), 1];
  const h = lamp.hue / 60, c = lamp.saturation, x = c * (1 - Math.abs(h % 2 - 1));
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  // HSV with value 1, desaturated towards the white of its temperature.
  return [r + (1 - c) * warm[0], g + (1 - c) * warm[1], b + (1 - c) * warm[2]];
}

/**
 * What each place puts on the living room's four bulbs (kitchen, sofa, moon, table) and a quieter
 * echo for the other rooms, from the colours that fill it on screen. The Meridiana flat has no
 * look of its own: there the bulbs are the flat's lamps.
 */
const PLACE_LOOKS: Record<Exclude<EnvironmentId, 'meridiana'>, { salon: [Lamp, Lamp, Lamp, Lamp]; rest: Lamp }> = {
  // The stone courtyard with its cypresses and olive tree.
  patio: { salon: [white(4000, .7), hex('#6f9a6a', .55, .5), hex('#7d93a6', .5, .45), white(3200, .6)], rest: white(3500, .3) },
  // An afternoon in Sant Quirze: low sun, white walls, gardens and a blue sky.
  maresme: { salon: [white(2600, .85), hex('#7fb6e6', .6, .55), hex('#78b866', .55, .55), hex('#ffb35c', .7, .6)], rest: white(2900, .35) },
  'home-entrance': { salon: [white(2700, .8), hex('#86b36d', .55, .5), white(3200, .55), hex('#ffc27a', .6, .5)], rest: white(2900, .3) },
  // Gerard's childhood home: white rooms, oak and lamps on.
  'home-floor-1': { salon: [white(2800, .85), white(2500, .7), hex('#ffb070', .55, .45), white(3000, .75)], rest: white(2700, .3) },
  'home-floor-2': { salon: [white(2700, .75), hex('#7fa0c8', .45, .35), white(2400, .6), hex('#ffc27a', .55, .45)], rest: white(2600, .25) },
  // La Reina Bubbaloo's palace: candy pink and lilac, but a room you can still live in.
  palacio: { salon: [hex('#ff8fbf', .55, .45), hex('#b48ad6', .45, .4), white(2300, .4), hex('#e0569b', .5, .6)], rest: hex('#ff9fc8', .2, .35) },
  // A Basque village: green hills, grey stone, a soft overcast sky.
  alegia: { salon: [white(3600, .7), hex('#5f9a5a', .55, .55), hex('#8aa0b5', .5, .4), white(3000, .6)], rest: white(3400, .3) },
  // Cardedeu: a quiet Vallès street, white render, terracotta roofs and gardens.
  // Las cuerdas: a dark room in petrol blue, one lamp left silver and a little amber for the first note.
  // Emilie's model: the dark of a screen, phosphor green, and the two values its foes run on.
  modelo: { salon: [hex('#3fe07a', .4, .8), hex('#12301c', .3, .8), hex('#6cc8f2', .35, .7), hex('#ffe45c', .3, .6)], rest: hex('#12301c', .15, .8) },
  // Emilie's flat: grey daylight on water, wet terracotta, the laptop's green.
  'piso-emilie': { salon: [white(5200, .6), hex('#5d8a99', .5, .5), hex('#b5643c', .45, .45), hex('#3fe07a', .35, .6)], rest: white(5000, .25) },
  cuerdas: { salon: [hex('#1f5f6b', .45, .8), white(5600, .35), hex('#49d3c2', .35, .7), hex('#f2b45a', .3, .6)], rest: hex('#16454e', .15, .8) },
  // Uri's maze: hedge green and garden walls, a little strange.
  'cardedeu-laberinto': { salon: [hex('#5f8f4e', .6, .5), hex('#9a6cd8', .45, .45), white(3000, .6), hex('#c98d6a', .5, .5)], rest: hex('#7da86a', .25, .35) },
  cardedeu: { salon: [white(2900, .8), hex('#c8693f', .55, .5), hex('#79a86a', .5, .5), white(3300, .6)], rest: white(3000, .3) },
  // La calle que no acaba: the same street drained grey, dimming towards her violet at the far end.
  'cardedeu-calle': { salon: [white(4200, .45), hex('#9c93a0', .35, .4), hex('#7d6f82', .4, .35), white(3800, .35)], rest: white(4000, .18) },
  // The Meridiana outside: peach façades, green awnings, plane trees and a Barcelona sky.
  'meridiana-calle': { salon: [hex('#f2b38f', .75, .45), hex('#8ec5e8', .6, .5), hex('#2f9c86', .5, .6), white(3200, .7)], rest: white(3200, .3) },
  // Her palace in chapter 2: the school yard's green court and its cold floodlight, a touch of her pink.
  'palacio-patio': { salon: [white(5200, .7), hex('#3f7d58', .6, .5), hex('#8a6aa8', .45, .4), hex('#ff6fae', .45, .35)], rest: white(4500, .25) },
  // The gym: blue mats and cold tubes.
  'palacio-gimnasio': { salon: [white(6000, .8), hex('#2d5a9e', .65, .5), white(5500, .6), hex('#c79a5b', .5, .45)], rest: white(5500, .3) },
  // The secretaría: greenish tubes and manila, his warm desk lamp on the table's bulb.
  'palacio-secretaria': { salon: [white(5000, .75), hex('#d6b46a', .55, .5), hex('#a8b8a6', .45, .45), hex('#f2c27a', .6, .5)], rest: white(4800, .25) },
  // The throne room: night indigo, old gold, one warm spotlight and her pink.
  'palacio-trono': { salon: [hex('#3a4590', .55, .4), hex('#c9a046', .5, .45), hex('#ff6fae', .4, .3), white(2900, .55)], rest: hex('#2a3170', .2, .3) },
  // The castle's floors: on the way from one room's colours to the next's.
  'castillo-1': { salon: [white(5000, .7), hex('#3f7d58', .55, .5), hex('#2d5a9e', .6, .5), hex('#ff6fae', .4, .3)], rest: white(4800, .25) },
  'castillo-2': { salon: [hex('#2d5a9e', .55, .45), hex('#d6b46a', .5, .45), hex('#ff5a3a', .4, .4), white(3800, .4)], rest: white(4000, .2) },
  'castillo-3': { salon: [hex('#c9a85e', .4, .35), hex('#27306b', .55, .4), hex('#b8708e', .35, .3), white(2700, .35)], rest: hex('#2a3170', .2, .25) },
  // The Rec Comtal school: brick and a pale sky (the castle's pink comes with the tone).
  'rec-comtal': { salon: [hex('#d98b5f', .7, .55), hex('#9cc6e6', .55, .45), white(3400, .65), hex('#e7a77a', .6, .45)], rest: white(3300, .3) },
  // The Búnkers del Carmel at sunset: golden grass, the pink band over the sea, a pale blue sky.
  'bunkers-carmel': { salon: [hex('#ffb35c', .7, .6), hex('#eab4a0', .5, .5), hex('#9fb8d8', .5, .45), white(2400, .6)], rest: white(2600, .3) },
  // La Barceloneta: sand, the sea's turquoise, a pale midday sky and the rusted cubes.
  barceloneta: { salon: [white(4200, .85), hex('#4fa3a5', .6, .55), hex('#e6d0a2', .45, .6), hex('#b0603a', .5, .45)], rest: white(4000, .35) },
  // Càmping Eurocamping: pine olive, the bulbs' amber, the pool's teal and the evening's deep blue.
  camping: { salon: [hex('#ffb35c', .7, .55), hex('#6a6b45', .55, .45), hex('#2b6f78', .55, .5), white(2300, .6)], rest: white(2400, .28) },
  // Sants at the end of the day: ochre houses in blue shade, and El Nucli's warm window.
  sants: { salon: [white(3800, .65), hex('#cfa463', .6, .5), hex('#7d93a6', .5, .45), hex('#ffb35c', .65, .6)], rest: white(3500, .28) },
  // The choir's room: work lamps over oxblood rugs and grey blankets, the logo's cyan neon on the back wall.
  coro: { salon: [white(2500, .8), hex('#6b302b', .5, .5), hex('#3fd8e0', .4, .7), white(2700, .65)], rest: white(2500, .3) },
  // El Nucli inside: tungsten pendants over green felt, the wine wall, boxes everywhere.
  'el-nucli': { salon: [white(2400, .8), hex('#3f7a55', .5, .5), hex('#8a2a2e', .45, .45), white(2600, .7)], rest: white(2500, .3) },
  // Carrer de Blai at evening: sienna render, the terraces' amber bulbs and Montjuïc's pines.
  'poble-sec': { salon: [hex('#c77d4f', .7, .5), white(2200, .7), hex('#4e6b3c', .55, .45), hex('#f2c27a', .65, .55)], rest: white(2500, .3) },
  // Plaça d'Espanya: a golden afternoon on salmon paving, the towers' brick and Las Arenas' red steel.
  'placa-espanya': { salon: [white(2500, .85), hex('#c96a45', .6, .5), hex('#8ec0e6', .5, .45), hex('#d9734a', .55, .55)], rest: white(2800, .3) },
  // The Sagrada Família: ochre sandstone in the sun, a blue sky, the pines over the green pond.
  'sagrada-familia': { salon: [white(3000, .8), hex('#c99a62', .6, .55), hex('#86b9e6', .55, .5), hex('#6f8a4a', .5, .5)], rest: white(3100, .3) },
  // Inside it: white stone washed by the glass, orange and red on one side, blue and green on the other.
  'sagrada-familia-interior': { salon: [hex('#e0742c', .65, .6), hex('#2f6fc0', .55, .6), hex('#3a9a5c', .5, .55), hex('#c43a2a', .55, .6)], rest: white(3600, .3) },
};
/** La Reina Bubbaloo's light (scenery.ts BUBBALOO): a magenta sun and a violet gloom. */
const BUBBALOO = [hex('#db6ba8', .5, .55), hex('#9a5bc4', .4, .5), hex('#ff7fb3', .45, .5), hex('#c04a8a', .45, .6)];
const INTENSITY: Record<Intensity, number> = { suave: .7, normal: .9, intensa: 1 };

// ——— Registers: how loud the room may be ———
/**
 * The room keeps to pastels: every colour under a cap, so a place or a fight tints the living room
 * instead of flooding it. `penumbra` is a dungeon's: the room drops to a dark and one lamp (the moon,
 * by the desk) keeps the place's accent, breathing slowly. `suya` is her palace, where her pink may
 * stay as pink as it is. Full colour is kept for the peaks (`peakOf`, the story's moments).
 */
export type Register = 'claro' | 'penumbra' | 'suya';
const PENUMBRA: ReadonlySet<EnvironmentId> = new Set(['cuerdas', 'modelo', 'cardedeu-laberinto', 'cardedeu-calle', 'palacio-trono', 'castillo-3']);
export const registerOf = (place: EnvironmentId): Register => place === 'palacio' ? 'suya' : PENUMBRA.has(place) ? 'penumbra' : 'claro';
/** How much colour each layer may carry: a place, a dungeon's accent or her palace, a fight, a boss. */
export const CAPS = { place: .45, accent: .7, fight: .5, boss: .75 } as const;
export function pastel(lamp: Lamp, cap: number): Lamp {
  return lamp.on && lamp.saturation > cap ? { ...lamp, saturation: cap } : lamp;
}
/** The dungeons' dark: the bulbs that are not the accent at this share of their brightness. */
const DARK = .5;

export interface Mood { tone: number; dusk: number }
/** The look of a place; `tone` is La Reina Bubbaloo's light (0–1), `dusk` chapter 2's evening. */
export function placeLook(place: EnvironmentId, mood: Mood, scope: Scope, intensity: Intensity = 'normal'): Look | undefined {
  if (place === 'meridiana') return undefined;
  const { salon, rest } = PLACE_LOOKS[place];
  const register = registerOf(place);
  // Her light takes over at most half the colour: the room stays the room.
  const tint = Math.min(1, Math.max(0, mood.tone)) * .5, evening = Math.min(1, Math.max(0, mood.dusk));
  const shade = (lamp: Lamp, i: number, accent: boolean) => {
    const tinted = mix(pastel(lamp, accent || register === 'suya' ? CAPS.accent : CAPS.place), BUBBALOO[i % 4], tint);
    const dark = register === 'penumbra' && !accent ? DARK : 1;
    return scale({ ...tinted, kelvin: Math.round(tinted.kelvin - evening * 500) }, (1 - .3 * evening) * dark * INTENSITY[intensity]);
  };
  const look: Look = {};
  SALON.forEach((id, i) => { look[id] = shade(salon[i], i, register === 'penumbra' && id === 'luna'); });
  if (scope === 'casa') ELSEWHERE.forEach((id, i) => { look[id] = shade(rest, i, false); });
  return look;
}
/** A place's own slow motion on one bulb: her palace's fountain beats, a dungeon's dark breathes. */
export function ambience(place: EnvironmentId, look: Look): Flash | undefined {
  // The palace's fountain, the Corazón Líquido, beats slowly on the table lamp.
  if (place === 'palacio' && look.mesa?.on) return { lights: ['mesa'], kind: 'breathe', color: hex('#ff5fae', look.mesa.brightness + .15, .7), period: 5, cycles: 120, peak: .5 };
  // A dungeon's accent sinks and comes back, slower than breathing.
  if (registerOf(place) === 'penumbra' && look.luna?.on) return { lights: ['luna'], kind: 'breathe', color: scale(look.luna, .3), period: 7, cycles: 120, peak: .5 };
  return undefined;
}
/** The flat before the house has said anything: evening lamps in the living room, the rest off. */
export const DEFAULT_FLAT: Record<LightId, Lamp> = {
  cocina: white(3000, .8), sofa: white(2700, .75), luna: white(2400, .5), mesa: white(2500, .7),
  dormitorio: white(2400, .45), terraza: OFF, estudio: OFF, galeria: OFF,
};
/** The lamp dial's quick picks (src/lamp-picker.ts): whites from candle to daylight, then colours. */
export const SWATCHES: { name: string; lamp: Lamp }[] = [
  { name: 'Vela', lamp: white(2200, .6) }, { name: 'Cálida', lamp: white(2700, .75) }, { name: 'Neutra', lamp: white(3500, .8) },
  { name: 'Fría', lamp: white(4500, .85) }, { name: 'Día', lamp: white(6500, .9) },
  { name: 'Rojo', lamp: hex('#ff3b2f', .75, .9) }, { name: 'Atardecer', lamp: hex('#ff9a4a', .8, .75) }, { name: 'Ámbar', lamp: hex('#ffc24a', .8, .7) },
  { name: 'Verde', lamp: hex('#48d07a', .7, .7) }, { name: 'Turquesa', lamp: hex('#2fd0c8', .7, .75) }, { name: 'Azul noche', lamp: hex('#4a6cff', .6, .75) },
  { name: 'Violeta', lamp: hex('#9a5bff', .65, .7) }, { name: 'Magenta', lamp: hex('#ff3fe0', .75, .75) }, { name: 'Rosa', lamp: hex('#ff6fae', .7, .6) },
];
/** The swatch a lamp shows (or the closest one), and the one `step` places along. Brightness is kept. */
export function stepSwatch(lamp: Lamp, step: number): { index: number; lamp: Lamp } {
  const distance = (a: Lamp, b: Lamp) => a.saturation < .15 || b.saturation < .15
    ? Math.abs(a.saturation - b.saturation) * 4 + Math.abs(a.kelvin - b.kelvin) / 1500
    : Math.abs(((a.hue - b.hue + 540) % 360) - 180) / 60 + Math.abs(a.saturation - b.saturation);
  const here = SWATCHES.reduce((best, swatch, i) => distance(swatch.lamp, lamp) < distance(SWATCHES[best].lamp, lamp) ? i : best, 0);
  const index = (here + step + SWATCHES.length) % SWATCHES.length;
  return { index, lamp: { ...SWATCHES[index].lamp, on: true, brightness: step && lamp.on ? lamp.brightness : SWATCHES[index].lamp.brightness } };
}
/** A lamp coming on from off: in the colour it had, or warm if it never had one. */
export function switchedOn(lamp: Lamp): Lamp {
  return lamp.brightness > 0.02 ? { ...lamp, on: true } : SWATCHES[1].lamp;
}

// ——— Fights ———
const CASTLE_LAMPS: Record<1 | 2 | 3 | 'aurelia' | 'direccion', [Lamp, Lamp, Lamp, Lamp]> = {
  1: [hex('#c86a8e', .5, .75), hex('#3f6fb8', .5, .7), white(4600, .6), hex('#4f8a5a', .45, .65)],
  2: [hex('#b0607e', .45, .7), hex('#c9a35a', .5, .6), hex('#7f8a96', .35, .6), hex('#ff5a3a', .35, .7)],
  3: [hex('#8a5a6c', .4, .6), hex('#27306b', .55, .75), hex('#c9a23a', .45, .55), hex('#ff5fa8', .45, .7)],
  aurelia: [hex('#9a5bff', .6, .75), hex('#3f6fb8', .5, .75), white(4200, .65), hex('#d8d2c4', .4, .5)],
  direccion: [hex('#9a5bff', .6, .75), hex('#c9a35a', .5, .6), hex('#ff5a3a', .4, .7), hex('#5aa8ff', .4, .7)],
};
const PALETTES: Record<BattleState['encounter'] | 'possessed', [Lamp, Lamp, Lamp, Lamp]> = {
  dogs: [hex('#ffa040', .8, .8), white(4200, .75), hex('#ff7a2a', .6, .85), hex('#ffd27a', .7, .6)],
  possessed: [hex('#ff5fa8', .7, .7), hex('#a05ae0', .55, .7), hex('#ff8a6a', .6, .6), hex('#e04a9a', .6, .75)],
  'palace-minion': [hex('#e0409a', .65, .75), hex('#8a4ad6', .55, .75), hex('#ff7fc0', .6, .55), hex('#c03a8a', .6, .8)],
  'palace-guards': [hex('#c8306e', .65, .8), hex('#7a3ad6', .5, .8), hex('#ff5a4a', .55, .75), hex('#e0409a', .6, .8)],
  // One of them in the street at night: her pink under the cold LED lamps.
  'night-guard': [hex('#c8306e', .65, .8), white(5000, .45), hex('#2a4a8a', .5, .7), hex('#e0409a', .6, .8)],
  // Uri's fears: onion gold and tears, a dinner-table white, arcade neon, and the roof's violet dusk.
  cebollon: [hex('#e8c25a', .7, .7), hex('#8fd3ff', .55, .6), white(3000, .6), hex('#c89a3a', .6, .7)],
  cebolla: [hex('#e8c25a', .7, .7), hex('#8fd3ff', .55, .6), white(3000, .6), hex('#c89a3a', .6, .7)],
  plato: [white(3600, .75), hex('#7fb05a', .55, .65), hex('#f0d9a8', .5, .6), hex('#c86a4a', .55, .7)],
  // La Cebolla y los suyos: onion gold, the fantasmita's arcade green, the tower's violet and a tear blue.
  escolta: [hex('#e8c25a', .65, .75), hex('#3aff8a', .5, .8), hex('#9a6cd8', .55, .75), hex('#8fd3ff', .5, .6)],
  'uri-vertigo': [hex('#9a6cd8', .65, .8), hex('#3a4a8a', .5, .7), hex('#c8693f', .55, .65), hex('#e0d0ff', .45, .6)],
  // Their young: the ring's own fear, in the tower's violet.
  'crias-1': [hex('#e8c25a', .6, .7), hex('#9a6cd8', .5, .7), hex('#8fd3ff', .5, .6), hex('#c89a3a', .55, .7)],
  'crias-2': [white(3600, .65), hex('#9a6cd8', .5, .7), hex('#7fb05a', .5, .65), hex('#c86a4a', .5, .7)],
  'crias-3': [hex('#3aff8a', .55, .8), hex('#9a6cd8', .5, .75), hex('#ff3ad6', .5, .8), hex('#3a8aff', .5, .75)],
  // La Sobremesa: the campsite's warm bulbs, the friends' violet eyes, the pines and a card's red.
  sobremesa: [hex('#ffc46a', .7, .75), hex('#9a6cd8', .55, .75), hex('#6a6b45', .5, .6), hex('#c8423b', .55, .7)],
  // Càmping Eurocamping: the endless dusk's warm bulbs and pine olive, and each fight's own colour on top.
  'camping-magos': [hex('#ffc46a', .7, .75), hex('#ff8a3a', .6, .8), hex('#6a6b45', .5, .6), hex('#3a6ac8', .5, .7)],
  'camping-dados': [hex('#ffc46a', .7, .75), white(3400, .6), hex('#6a6b45', .5, .6), hex('#c89a5a', .55, .65)],
  'camping-agentes': [hex('#ffc46a', .7, .75), hex('#2f6f78', .55, .75), hex('#6a6b45', .5, .6), hex('#e8dcc0', .5, .6)],
  'camping-tienda': [hex('#ffc46a', .65, .75), hex('#2f6f78', .5, .75), hex('#6a6b45', .5, .6), hex('#c89a5a', .5, .65)],
  // The black pitch: every lantern out, two head torches and the friends' violet in the dark.
  'camping-negra': [hex('#3a3050', .4, .8), hex('#9a6cd8', .5, .8), hex('#fff1cc', .35, .5), hex('#ff8a3a', .45, .8)],
  campeon: [hex('#ffc46a', .65, .75), hex('#c8423b', .6, .8), hex('#5ab8c8', .5, .6), hex('#c9a23a', .55, .7)],
  // Las cuerdas: the void's petrol blue and the strings' silver, and each fight's own note on top.
  'cuerdas-lealtad': [hex('#1f5f6b', .5, .8), white(5200, .5), hex('#f2b45a', .55, .7), hex('#49d3c2', .45, .7)],
  'cuerdas-cristalino': [hex('#1f5f6b', .5, .8), white(6000, .6), hex('#49d3c2', .55, .7), hex('#eef3ff', .5, .3)],
  'cuerdas-directo': [hex('#1f5f6b', .5, .8), white(5200, .5), hex('#5b8cff', .55, .75), hex('#eef3ff', .5, .3)],
  voz: [hex('#1f5f6b', .55, .8), hex('#f2b45a', .55, .7), hex('#49d3c2', .55, .7), hex('#5b8cff', .5, .75)],
  // The castle: her pink, gone old, over the place each phase walks towards (mat blue, manila, night indigo); violet for whoever she holds.
  ...Object.fromEntries(CASTLE_ENCOUNTERS.map(id => [id, CASTLE_LAMPS[id === 'aurelia' || id === 'direccion' ? id : castlePhaseOf(id)]])) as Record<CastleEncounter, [Lamp, Lamp, Lamp, Lamp]>,
  // Emilie's model: a terminal's phosphor green in the dark, with water's blue and a spark's yellow on top.
  'modelo-celdas': [hex('#3fe07a', .45, .8), hex('#12301c', .3, .8), hex('#6cc8f2', .5, .7), hex('#ffe45c', .45, .7)],
  'modelo-oscilacion': [hex('#3fe07a', .5, .8), hex('#6cc8f2', .55, .7), hex('#ffe45c', .55, .7), hex('#12301c', .3, .8)],
  'modelo-atomo': [hex('#3fe07a', .45, .8), hex('#6cc8f2', .6, .75), hex('#12301c', .3, .8), hex('#c9a45a', .45, .6)],
  'no-converge': [hex('#3fe07a', .6, .85), hex('#6cc8f2', .5, .75), hex('#ffe45c', .5, .75), hex('#0c2014', .25, .8)],
  // Fran's salon: the basilica's pale stone light and each zone's own window colour.
  'luca-recepcion': [white(5600, .6), hex('#4f9fe8', .55, .75), hex('#4fbf7a', .5, .7), hex('#e9e4d8', .5, .3)],
  'luca-sillones': [white(5000, .6), hex('#e8503a', .55, .75), hex('#4f9fe8', .5, .7), hex('#e9e4d8', .5, .3)],
  'luca-carta': [white(4600, .6), hex('#ff8f3f', .6, .75), hex('#e8503a', .55, .75), hex('#ffd84f', .5, .7)],
  // Fran under the canopy: every window's colour at once, and the cold white of his cape.
  fran: [white(6200, .6), hex('#4f9fe8', .55, .75), hex('#e8503a', .55, .75), hex('#ffd84f', .55, .7)],
};
const ALARM = hex('#ff2a1a', .75, 1);
/** Possession's violet (whoever she holds) and Aitor's own cyan: the six marks of the artilugio go from one to the other. */
const POSSESSION = hex('#7d3fd8', .55, .8);
const AITOR = hex('#4fd8e8', .7, .7);
/** Aitor's light in the Queen's last fight: her violet while she holds him, walking to his cyan with each right note. */
export function heldLamp(state: BattleState): Lamp | undefined {
  const fight = state.castle;
  if (!fight?.taken || fight.freed) return undefined;
  return mix(POSSESSION, AITOR, Math.min(1, (fight.notes ?? 0) / MELODY.length));
}
/** Direcció's meeting room: three lamps on the table, one going out with each of the three who falls (docs/castle-bosses.md). */
const TABLE_LAMPS: LightId[] = ['cocina', 'sofa', 'luna'];
const fallenDirectivas = (state: BattleState) => state.encounter === 'direccion' ? state.foes.filter(f => f.kind === 'directiva' && f.hp <= 0).length : 0;
/** The fights that close a chapter or a mission, or a floor of the castle: their palette may carry more colour, and their turns break into raw light. */
const BOSSES: ReadonlySet<Encounter> = new Set<Encounter>(['palace-minion', 'cebollon', 'uri-vertigo', 'sobremesa', 'campeon', 'voz', 'no-converge', 'fran', 'delegada-1', 'delegada-2', 'delegada-3', 'aurelia', 'direccion', 'reina', 'reina-vuelta']);
export const isBoss = (state: BattleState) => BOSSES.has(state.encounter);
/** A blow at everyone announced a turn ahead (a card aimed at `todos`): the room holds its breath until it lands. */
export function bracing(state: BattleState) {
  return state.foes.some(foe => foe.hp > 0 && foe.intent?.at === 'todos' && FOE_ABILITIES[foe.intent.ability]?.card);
}
/** 0 with everyone healthy, 1 when someone still standing is about to fall. */
export function tension(state: BattleState) {
  const standing = state.allies.filter(a => a.hp > 0);
  if (!standing.length) return 1;
  return 1 - Math.min(...standing.map(a => a.hp / a.maxHp));
}
/**
 * The fight's look: its own palette in pastel (a boss's carries more colour), turning red and darker
 * as the party's health runs out (the alarm is raw: someone is about to fall), and dimmed while a
 * blow at everyone is announced.
 */
export function battleLook(state: BattleState, scope: Scope, intensity: Intensity = 'normal'): Look {
  const palette = PALETTES[state.possessed ? 'possessed' : state.encounter].map(lamp => pastel(lamp, isBoss(state) ? CAPS.boss : CAPS.fight));
  const danger = Math.max(0, (tension(state) - .45) / .55);
  const held = bracing(state) ? .55 : 1;
  const look: Look = {};
  SALON.forEach((id, i) => { look[id] = scale(mix(palette[i], ALARM, danger * (i === 3 ? .9 : .6)), (1 - danger * (i === 3 ? 0 : .35)) * held * INTENSITY[intensity]); });
  if (scope === 'casa') ELSEWHERE.forEach((id, i) => { look[id] = scale(mix(palette[i % 4], ALARM, danger * .5), .3 * held * INTENSITY[intensity]); });
  // The meeting room's lamps go out one by one, as the three fall.
  TABLE_LAMPS.slice(0, fallenDirectivas(state)).forEach(id => { look[id] = OFF; });
  // Aitor hers: the moon by the desk is his light, in her violet until the melody brings it back to his cyan.
  const aitor = heldLamp(state);
  if (aitor) look.luna = scale(aitor, INTENSITY[intensity]);
  return look;
}
/** A turn of a boss the castle names over it (Aurelià's lesson, race and straight; the Queen's hands and La Pompa; his lap closing). */
const TURNS: ReadonlySet<string> = new Set([...Object.values(AURELIA_PHASES), REINA_PHASES.manos, REINA_PHASES.pompa, 'Vuelta']);
/**
 * What a boss's own rules called over this action that the room answers raw: a `turn` (it grows
 * stronger), a part of it `broken` (La Pompa burst early), or Aitor `taken`. `key` tells the same
 * call twice apart (the Queen names Las manos as her PV cross it and again as she raises them).
 */
export function turnOf(effect: BattleEffect): { kind: 'turn' | 'broken' | 'taken'; key: string } | undefined {
  for (const call of effect.called ?? []) {
    if (call.text === 'Suyo') return { kind: 'taken', key: call.text };
    if (call.text === '¡Pompa rota!') return { kind: 'broken', key: call.text };
    // The lap comes back every lap: it is a turn each time.
    if (call.text === 'Vuelta') return { kind: 'turn', key: `${call.text}-${call.detail ?? ''}` };
    if (TURNS.has(call.text)) return { kind: 'turn', key: call.text };
  }
  return undefined;
}
/**
 * The fight's answer found (docs/combat.md § La respuesta de cada combate): a golpe crítico, a
 * weakness of element or of kind of blow, a Punto débil spent, and each fight's own: El que no
 * converge converging, ice or a shield of bits broken, a short circuit, an electron knocked off El
 * Átomo, the castle's «Respuesta correcta».
 */
export function answerFound(effect: BattleEffect) {
  const struck = [effect, ...(effect.hits ?? [])];
  return struck.some(hit => hit.crit || hit.affinity === 'weak') || !!effect.crits?.some(Boolean)
    || [...effect.hunt ?? [], ...effect.volley ?? [], ...effect.hammer ?? []].some(hit => hit.crit)
    || !!effect.kinds?.some(k => k.affinity === 'weak') || markSpent(effect)
    || !!effect.converged || !!effect.ice?.some(i => i.broke !== undefined) || !!effect.bits?.broke
    || (!!effect.shorted && effect.shorted.why !== 'again') || effect.electron?.mark === 'off'
    || !!effect.called?.some(call => call.text === 'Respuesta correcta');
}
/** A cure from the party: what it gave back, to whom. */
const cured = (effect: BattleEffect) => !!(effect.healed || effect.cures?.length || effect.healedAll?.length || effect.regen);
/** A one-shot effect on some bulbs: LIFX's breathe (a smooth swell) or pulse (a hard strobe). */
export interface Flash { lights: LightId[]; kind: 'breathe' | 'pulse'; color: Lamp; period: number; cycles: number; peak?: number }
/** The heartbeat that starts once someone is low: on the table lamp, so hits never cut it off. */
export function heartbeat(state: BattleState, intensity: Intensity = 'normal'): Flash | undefined {
  const t = tension(state);
  if (t < .62 || state.phase === 'won' || state.phase === 'lost') return undefined;
  return { lights: ['mesa'], kind: 'breathe', color: scale(ALARM, INTENSITY[intensity] + .1), period: t > .85 ? .7 : 1.1, cycles: 60, peak: .2 };
}
/** Seconds from the start of a battle effect to the moment it lands (battle-scene.ts). */
export function impactSeconds(effect: BattleEffect) {
  // A dual: the room flickers as its banner settles and its choreography begins (battle-scene.ts `dual`).
  if (effect.dual) return DUAL_FREEZE + DUAL_BANNER_SEEN;
  if (effect.skill === 'foc-binari') return CAST_CONTACT;
  if (isFigure(effect.skill)) return FIGURES[effect.skill].contact;
  if (effect.spell) return SPELL_CONTACT;
  return effect.target && !effect.boosted ? CONTACT_SECONDS : .2;
}
/** How a hit lands at home: on the bulbs in front of the player, timed to the contact. */
export function hitFlash(effect: BattleEffect, state: BattleState, intensity: Intensity = 'normal'): Flash | undefined {
  const front: LightId[] = ['cocina', 'sofa', 'luna'];
  const strong = INTENSITY[intensity];
  const target = [...state.allies, ...state.foes].find(c => c.id === effect.target);
  const knockedOut = !!target && target.hp === 0;
  const byParty = state.allies.some(a => a.id === effect.actor);
  // A party boost lifts everyone: warm orange everywhere.
  if (effect.boosted) return { lights: [...front, 'mesa'], kind: 'breathe', color: hex('#ff9a3a', strong, .85), period: 1.3, cycles: 1, peak: .4 };
  if (effect.kind === 'defend') return { lights: front, kind: 'breathe', color: hex('#5aa0ff', .8 * strong, .8), period: .9, cycles: 1, peak: .3 };
  if (effect.kind === 'escape' || !effect.target) return undefined;
  if (effect.swallowed) return { lights: front, kind: 'breathe', color: hex('#ff6fae', .9 * strong, .8), period: .7, cycles: 1, peak: .15 };
  // A dual: the whole room flickers gold and orange through its choreography (soft lights only swell).
  if (effect.dual) {
    return intensity === 'suave' ? { lights: [...front, 'mesa'], kind: 'breathe', color: hex('#ffb02e', 1, .85), period: 1.6, cycles: 1, peak: .3 }
      : { lights: [...front, 'mesa'], kind: 'pulse', color: hex('#ffa62a', strong, .9), period: .22, cycles: 8 };
  }
  if (effect.skill === 'foc-binari') {
    // Fire: the room flickers orange, longer the higher the fire it lights, unless the lights are set soft.
    return intensity === 'suave' ? { lights: front, kind: 'breathe', color: hex('#ff8a2a', 1, .85), period: .6, cycles: 1, peak: .1 }
      : { lights: front, kind: 'pulse', color: hex('#ff7a1a', 1, .9), period: .18, cycles: effect.burn ? 2 + 2 * effect.burn.level : 2 };
  }
  if (!byParty) return { lights: front, kind: 'breathe', color: hex('#ff2a1a', strong, 1), period: knockedOut ? .9 : .5, cycles: knockedOut ? 2 : 1, peak: .08 };
  // A cure is not a blow: a slow, soft green on the lamps in front (the table lamp may be beating).
  if (cured(effect)) return { lights: front, kind: 'breathe', color: hex('#8fe0a6', .8 * strong, .4), period: 1.2, cycles: 1, peak: .35 };
  if (knockedOut) return { lights: [...front, 'mesa'], kind: 'breathe', color: hex('#ffd24a', 1, .7), period: .9, cycles: 1, peak: .1 };
  // The answer found lands warmer and longer than a plain blow.
  if (answerFound(effect)) return { lights: front, kind: 'breathe', color: hex('#ffe2a0', strong, .45), period: .7, cycles: 1, peak: .1 };
  return { lights: front, kind: 'breathe', color: white(5500, .8 * strong), period: .45, cycles: 1, peak: .1 };
}
/**
 * The few blows that break the pastel rule, in raw colour: a boss turning (a new phase, a part of
 * it broken), a charged dual let go, a blow at everyone landing, the last blow on a boss.
 */
export function peakOf(effect: BattleEffect, state: BattleState, seen?: Set<string>): Lamp | undefined {
  const byParty = state.allies.some(a => a.id === effect.actor);
  if (state.phase === 'won' && isBoss(state)) return white(6500, 1);
  // A turn the castle names: each one once (`seen`, the fight's own), Aitor taken in possession's violet.
  const turn = turnOf(effect);
  if (turn && !seen?.has(turn.key)) {
    seen?.add(turn.key);
    return turn.kind === 'taken' ? hex('#7d3fd8', 1, .9) : turn.kind === 'broken' ? hex('#fff0c0', 1, .5) : hex('#ff3a1a', 1, 1);
  }
  // A boss getting stronger: red; one losing a part of itself (or one of Direcció falling): a hard white-gold.
  if (effect.stage2 || effect.stage) return hex('#ff3a1a', 1, 1);
  const directiva = state.encounter === 'direccion' && state.foes.some(f => f.id === effect.target && f.kind === 'directiva' && f.hp <= 0);
  if (effect.eye === 'broken' || effect.cracked || effect.lampBroken || effect.release || directiva) return hex('#fff0c0', 1, .5);
  const many = (effect.hits?.length ?? 0) > 1 || (effect.splash?.length ?? 0) > 0;
  if (!byParty && effect.ability?.card && many) return hex('#ff2a1a', 1, 1);
  return undefined;
}
/** A raw peak: the room drops almost to black a moment before, then the colour lands at once. */
export function slam(color: Lamp, lights: LightId[] = SALON): Cue {
  const dark = Object.fromEntries(lights.map(id => [id, { ...color, brightness: .02 }]));
  return { steps: [{ at: -160, look: dark, duration: .08 }, { at: 0, look: Object.fromEntries(lights.map(id => [id, color])), duration: 0 }] };
}
/** Colour walking across the living room, bulb by bulb (a portal opening, a light flying past). */
export function sweep(color: Lamp, reverse = false, step = 180): Cue {
  const order = reverse ? [...SALON].reverse() : SALON;
  return { steps: order.map((id, i) => ({ at: i * step, look: { [id]: color }, duration: .15 })) };
}
/** A timed change of look: each step `at` ms from the moment the cue is seen. */
export interface Cue { steps: { at: number; look: Look; duration: number }[] }
/** The fight is won: each living-room bulb a different bright colour for a moment (bright, but pastel: her pink is not ours to use). */
export const VICTORY: Look = { cocina: hex('#ffd24a', 1, .6), sofa: hex('#48d07a', .9, .55), luna: hex('#4ac8ff', .9, .55), mesa: hex('#ffb070', .9, .55) };
/** The party has fallen: the room sinks to a dark red before the pink-and-black of waking up. */
export const DEFEAT: Look = { cocina: hex('#ff2a1a', .12, 1), sofa: hex('#ff2a1a', .08, 1), luna: OFF, mesa: hex('#c0306e', .1, .9) };

// ——— The end (docs/castle-bosses.md § The last scene) ———
/** The fights that end the game: her fall is no victory, and the last scene follows it. */
export const isQueen = (state: BattleState) => state.encounter === 'reina' || state.encounter === 'reina-vuelta';
/**
 * She sags at 0 PV, the music gone, only the wind from the balcony: the room almost dark, a cold
 * dim white by the windows, and her pink, low, on the table lamp, where Gerard's hand is.
 */
export const LAST: Look = { cocina: white(5200, .08), sofa: white(5600, .12), luna: OFF, mesa: hex('#e0569b', .18, .55) };
/** Her breathing, slow, on the table lamp while Gerard chooses. */
export const LAST_BREATH: Flash = { lights: ['mesa'], kind: 'breathe', color: hex('#e0569b', .06, .55), period: 6, cycles: 60, peak: .5 };
/**
 * What each choice does to the room, `at` ms from the moment it is taken. **Acabar**: the Foc Binari
 * forms in his hand (orange on the lamps in front), goes into her, and her pink on the table lamp
 * goes grey and out; black; then, where the throne was, an empty classroom in a cold, low white.
 * **Bajar la mano**: his hand comes down, her pink stays where it is, and the dream ends in white,
 * filling the room. Neither is the right one: neither is a victory's colours.
 */
export function endingCue(choice: EndingChoice, intensity: Intensity = 'normal'): Cue {
  const k = INTENSITY[intensity];
  const all = (lamp: Lamp) => Object.fromEntries(SALON.map(id => [id, lamp])) as Look;
  if (choice === 'acabar') return { steps: [
    { at: 0, look: { cocina: hex('#ff7a1a', .35 * k, .8), sofa: hex('#ff8a2a', .45 * k, .8), luna: hex('#ff7a1a', .3 * k, .8) }, duration: .8 },
    { at: 1400, look: { mesa: hex('#ff9a4a', .5 * k, .6) }, duration: .2 },
    { at: 2000, look: { mesa: white(4500, .12) }, duration: 2.2 },
    { at: 4200, look: all(OFF), duration: 2.4 },
    { at: 8000, look: { cocina: white(5600, .12 * k), sofa: white(6000, .16 * k) }, duration: 4 },
  ] };
  return { steps: [
    { at: 0, look: { cocina: white(5200, .05), sofa: white(5600, .08) }, duration: 1.5 },
    { at: 1600, look: all(white(5200, .95 * k)), duration: 3.5 },
  ] };
}
/** The morning after Bajar la mano: some pink is still in the city, a moment on the moon. */
export const LEFT_PINK: Flash = { lights: ['luna'], kind: 'breathe', color: hex('#ff9fc8', .4, .3), period: 9, cycles: 1, peak: .5 };

// ——— Timing ———
/** A swell reads as a flash this soon, whatever its peak (lights.py `SEEN_SECONDS`). */
const SEEN_MS = 120;
/** Ms from the start of a flash to the moment it is seen: a pulse at once, a breathe at its peak or `SEEN_MS` in (lights.py `rise`). */
export function riseOf(flash: Flash) {
  return flash.kind === 'breathe' ? Math.round(Math.min(flash.period * (flash.peak ?? .5) * 1000, SEEN_MS)) : 0;
}
/** The screen shows a frame about this long after the game draws it: a frame at 120 Hz and the panel. */
export const SCREEN_MS = 15;
/** Room for the request to reach the bridge and the bridge to plan it. */
const MARGIN_MS = 25;
/**
 * How long the game should hold a hit so the bulbs can be told in time (ms): they need `latency` to
 * get the message, `late` more (the calibration: what the measure cannot see, the bulb's own start)
 * and `rise` to show it; the hit lands `impact` after it starts and the screen shows it `SCREEN_MS` later.
 */
export function holdFor(latency: number, late: number, rise: number, impact: number) {
  return Math.max(0, Math.round(MARGIN_MS + latency + late + rise - impact - SCREEN_MS));
}
/** The bridge's clock less this page's (ms), from the quickest of a few round trips: half of it each way. */
export function clockOffset(samples: { sent: number; server: number; back: number }[]) {
  const best = samples.reduce((a, b) => (b.back - b.sent < a.back - a.sent ? b : a));
  return best.server - (best.sent + best.back) / 2;
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/** How far each tap fell from the nearest beat (ms), leaving out taps that belong to no beat. */
export function tapOffsets(beats: number[], taps: number[], within = 300) {
  return taps.map(tap => beats.reduce((best, beat) => Math.abs(tap - beat) < Math.abs(best) ? tap - beat : best, Infinity)).filter(d => Math.abs(d) <= within);
}
/**
 * The calibration: the player taps along with the screen, then with the bulbs. Whatever their hand
 * adds is in both, so the difference is how much later the bulbs are seen than planned. Undefined
 * with too few taps to trust.
 */
export function lateness(screen: number[], bulbs: number[]) {
  return screen.length >= 4 && bulbs.length >= 4 ? Math.round(median(bulbs) - median(screen)) : undefined;
}

// ——— The director: settings, the bridge and the timing ———
/** `late`: how much later than planned the bulbs are seen (ms), from the calibration; 0 trusts the bridge's measure. */
export interface LightsSettings { enabled: boolean; scope: Scope; intensity: Intensity; late: number }
/** `lan`: the bulbs answer on the home network in milliseconds; `cloud`: through LIFX, up to a second. */
export type Transport = 'lan' | 'cloud';
export type LightsStatus =
  | { state: 'off' } | { state: 'connecting' }
  | { state: 'on'; lights: number; latency?: number; transport: Transport; bulbs: Record<string, number> }
  | { state: 'unavailable'; reason: string };
/**
 * How long a message takes to reach a bulb until the bridge has measured it (ms): a typical bulb at
 * home on the LAN (lights.py `GUESS_SECONDS`), and the cloud's half a second.
 */
export function autoLead(transport: Transport) {
  return transport === 'lan' ? 60 : 500;
}
/** The calibration's reach either way (ms). */
export const LATE_MAX = 400;
interface HouseBulb { label: string; connected: boolean; power: boolean; hue: number; saturation: number; kelvin: number; brightness: number; latency?: number }
const SETTINGS_KEY = 'gerard35.lights.v3';
const KEY_KEY = 'gerard35.lights.key';
/** The flat as the game last gave it back, so a reload does not read bulbs still on their way home. */
const RETURNED_KEY = 'gerard35.lights.returned';
const RETURN_MS = 60000;
/** Lamp changes Gerard makes in the flat stay a moment before the house's own reading counts. */
const ECHO_MS: Record<Transport, number> = { lan: 1200, cloud: 4500 };
/** How often the flat reads the house while Gerard is in it. */
const POLL_MS: Record<Transport, number> = { lan: 250, cloud: 3000 };
/** How often the bridge's clock is read again, and how often the bulbs' latencies (outside the flat, which reads them anyway). */
const CLOCK_MS = 60000, MEASURE_MS = 5000;
export const DEFAULT_SETTINGS: LightsSettings = { enabled: false, scope: 'salon', intensity: 'normal', late: 0 };
export type Moment = 'fall' | 'tv' | 'tv-off' | 'doom' | 'right' | 'wrong' | 'ambush' | 'wake' | 'portal' | 'emerge' | 'unmask' | 'anima' | 'light-in' | 'palace' | 'last' | EndingChoice;
/** The longest the end holds the room before giving it back anyway (the morning after gives it back first). */
const FINALE_MS = 10 * 60000;

export function createHomeLights() {
  let settings: LightsSettings = { ...DEFAULT_SETTINGS };
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { /* Storage is optional. */ }
  // Development (`just dev`, herdr's Start) never takes the house's lights by itself, whatever this
  // browser chose before: they connect only from Configuración → Luces de casa, for that session.
  if (import.meta.env?.DEV) settings = { ...settings, enabled: false };
  // ?luces=<key> opens the lights on a deployed game (HOME_LIGHTS_KEY); it is kept for later visits.
  let key = '';
  try {
    const given = new URLSearchParams(location.search).get('luces');
    if (given) localStorage.setItem(KEY_KEY, given);
    key = localStorage.getItem(KEY_KEY) ?? '';
  } catch { /* Storage is optional. */ }
  let status: LightsStatus = { state: 'off' };
  const listeners = new Set<() => void>();
  const flatListeners = new Set<(id: LightId, lamp: Lamp) => void>();
  /** The Meridiana flat's lamps, which are the bulbs at home while Gerard is there. */
  const flat: Record<LightId, Lamp> = { ...DEFAULT_FLAT };
  /** What each bulb was last told, and when. */
  const sent: Look = {};
  const told: Partial<Record<LightId, number>> = {};
  let present = new Set<LightId>();
  let place: EnvironmentId | undefined;
  let mood: Mood = { tone: 0, dusk: 0 };
  let fight: BattleState | undefined;
  let beat: string | undefined;
  /** A look that holds for a moment (victory, defeat, a fall, a story moment) before the place comes back. */
  let holding = 0;
  /** The party fell: the room stays dark red until the fight closes. */
  let fallen = false;
  /** What lets the room go after being caught, once they wake. */
  let caught: (() => void) | undefined;
  /** The fight whose ending is already playing: the battle screen reports it more than once. */
  let finished: BattleState | undefined;
  /** The turns a boss has already called this fight, so each slams once. */
  let turns = new Set<string>();
  /** The artilugio in her fight: how many marks were lit, whether she has turned and Aitor is free. */
  let melody = { notes: 0, startled: false, freed: false };
  /** The end holding the room (her fall, the last scene, the choice) until the morning after; and which. */
  let finale: (() => void) | undefined;
  let ending: EndingChoice | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  /** The bridge's clock less this page's (ms): known once read, and flashes then carry the moment they must be seen. */
  let offset: number | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let measureTimer: ReturnType<typeof setInterval> | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const active = () => status.state === 'on';
  const transport = (): Transport => status.state === 'on' ? status.transport : 'cloud';
  /** How long the slowest of these bulbs that answer takes to get a message now (ms). */
  const latencyOf = (ids: LightId[]) => {
    const measured = status.state === 'on' ? status.bulbs : {};
    const here = ids.filter(id => present.has(id));
    return Math.max(0, ...(here.length ? here : ids).flatMap(id => lightById(id).labels).map(label => measured[label] ?? autoLead(transport())));
  };
  const labelsOf = (ids: LightId[]) => ids.flatMap(id => lightById(id).labels);
  const bulbStates = (id: LightId, lamp: Lamp) => lightById(id).labels.map(light => ({ light, ...toBulb(lamp) }));
  const changed = () => listeners.forEach(listener => listener());
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage is optional. */ } };
  const later = (ms: number, run: () => void) => { const t = setTimeout(() => { timers.delete(t); run(); }, Math.max(0, ms)); timers.add(t); };
  const headers = () => ({ 'Content-Type': 'application/json', ...(key ? { 'X-Lights-Key': key } : {}) });
  let retry: ReturnType<typeof setTimeout> | undefined;
  let misses = 0;
  const stopRetry = () => { clearTimeout(retry); retry = undefined; };
  /**
   * The lights are wanted but not there. They try again by themselves: soon for a server that is
   * starting or restarting, every half minute for a house the server cannot find. A missing key
   * needs the player.
   */
  function unavailable(reason: string) {
    if (!settings.enabled) return;
    if (status.state === 'unavailable' && status.reason === reason && retry) return;
    stopPolling(); stopRetry();
    status = { state: 'unavailable', reason }; changed();
    if (reason === 'key') return;
    const wait = reason === 'server' ? Math.min(15000, 1500 * 2 ** misses++) : 30000;
    retry = setTimeout(() => { retry = undefined; void connect(); }, wait);
  }
  async function call(method: string, path: string, body?: unknown, keepalive = false) {
    try {
      const response = await fetch(`/api/lights${path}`, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body), keepalive, signal: AbortSignal.timeout(8000) });
      if (response.status === 403 || response.status === 503) unavailable(response.status === 403 ? 'key' : 'token');
      // Not the game's server answering (down, restarting, or another app on its port).
      else if (!keepalive && (response.status >= 500 || (method === 'GET' && !response.ok))) unavailable('server');
      return response.ok ? response : undefined;
    } catch {
      if (!keepalive) unavailable('server');
      return undefined;
    }
  }
  /** Reads the bridge's clock a few times and keeps the quickest answer's reading. */
  async function syncClock() {
    const samples: { sent: number; server: number; back: number }[] = [];
    for (let i = 0; i < 5; i++) {
      try {
        const sentAt = performance.now();
        const response = await fetch('/api/lights/clock', { cache: 'no-store', signal: AbortSignal.timeout(2000) });
        const reply = await response.json() as { now?: number };
        if (typeof reply.now === 'number') samples.push({ sent: sentAt, server: reply.now, back: performance.now() });
      } catch { /* A server without the clock: flashes are timed here instead. */ }
    }
    if (samples.length) offset = clockOffset(samples);
  }
  /** A moment on this page's clock (`performance.now`) on the bridge's, if it has been read. */
  const onBridge = (local?: number) => local === undefined || offset === undefined ? undefined : local + offset;
  // A bulb switched off keeps its colour for the next time a switch turns it on, so an off lamp read
  // from the house carries it, and giving the house back restores it too. OFF itself has none.
  const toBulb = (lamp: Lamp) => ({ power: lamp.on, ...(lamp.on || lamp.brightness > 0 ? { color: { hue: lamp.hue, saturation: lamp.saturation, kelvin: lamp.kelvin }, brightness: lamp.brightness } : {}) });
  const fromBulb = (bulb: HouseBulb): Lamp => ({ on: bulb.power, hue: bulb.hue, saturation: bulb.saturation, brightness: bulb.brightness, kelvin: bulb.kelvin });
  /**
   * Sends what differs from what the bulbs were last told (`force` resends it anyway); returns the
   * bulbs told. `seen` (performance.now ms) is when it should show: the bridge times it, or, before
   * its clock is read, a timer here does.
   */
  function show(look: Look, duration: number, force = false, seen?: number) {
    if (!active()) return [];
    const changes = (Object.entries(look) as [LightId, Lamp][]).filter(([id, lamp]) => present.has(id) && (force || !sameLamp(sent[id], lamp)));
    const states = changes.flatMap(([id, lamp]) => { sent[id] = lamp; told[id] = Date.now(); return bulbStates(id, lamp); });
    if (states.length) {
      const at = onBridge(seen);
      if (seen === undefined || at !== undefined) void call('PUT', '', { states, duration, ...(at === undefined ? {} : { at }) });
      else later(seen - performance.now() - latencyOf(changes.map(([id]) => id)), () => void call('PUT', '', { states, duration }));
    }
    return changes.map(([id]) => id);
  }
  /** A flash, now or to be seen at `seen` (performance.now ms). */
  function flash(effect: Flash, seen?: number) {
    const ids = effect.lights.filter(id => present.has(id) && sent[id]?.on !== false);
    if (!active() || !ids.length) return;
    ids.forEach(id => { told[id] = Date.now(); });
    const body = { lights: labelsOf(ids), kind: effect.kind, color: toBulb(effect.color).color, brightness: effect.color.brightness, period: effect.period, cycles: effect.cycles, peak: effect.peak };
    const at = onBridge(seen);
    if (seen === undefined || at !== undefined) void call('POST', '/effect', { ...body, ...(at === undefined ? {} : { at }) });
    else later(seen - performance.now() - latencyOf(ids) - riseOf(effect), () => void call('POST', '/effect', body));
  }
  /** A cue's steps, each at its moment from `seen`. */
  function play(cue: Cue, seen: number) {
    for (const step of cue.steps) show(step.look, step.duration, true, seen + step.at);
  }
  /** Holds the room on a moment for at most `ms`; returns what lets it go sooner. */
  function hold(ms: number, back = 2) {
    holding++;
    let held = true;
    const release = () => { if (!held) return; held = false; holding--; settle(back, true); };
    later(ms, release);
    return release;
  }
  /** Bernat's box open (src/portal-ui.ts): the real flat follows the game's from El Nucli, as if Gerard were home. */
  let portal = false;
  const mirroring = () => (place === 'meridiana' || portal) && !fight && !holding;
  /** Whatever the bulbs should show now: the fight, the flat, or the place. */
  function settle(duration = 1.2, force = false) {
    if (!active() || holding) return;
    if (fight) { show(battleLook(fight, settings.scope, settings.intensity), duration, force); return; }
    const look = portal ? undefined : place ? placeLook(place, mood, settings.scope, settings.intensity) : undefined;
    const touched = show(look ?? (place === 'meridiana' || portal ? flat : {}), duration, force);
    // A new colour on a bulb stops its slow motion, so it starts again whenever its bulb is told.
    const slow = place && look ? ambience(place, look) : undefined;
    if (slow && touched.includes(slow.lights[0])) flash(slow);
  }
  /** Reads every bulb: their latencies always, and while Gerard is in the flat a lamp switched at home turns on or off in the game too. */
  async function read(initial = false) {
    const response = await call('GET', '');
    if (!response) return;
    const reply = await response.json().catch(() => undefined) as { available: boolean; reason?: string; latency?: number; transport?: Transport; lights: HouseBulb[] } | undefined;
    if (typeof reply?.available !== 'boolean' || (reply.available && !Array.isArray(reply.lights))) { unavailable('server'); return; }
    if (!reply.available) { unavailable(reply.reason ?? 'token'); return; }
    misses = 0;
    const bulbsOf = (light: HouseLight) => reply.lights.filter(b => light.labels.includes(b.label) && b.connected);
    present = new Set(HOUSE_LIGHTS.filter(light => bulbsOf(light).length).map(light => light.id));
    let returned: Partial<Record<LightId, Lamp>> = {};
    try {
      const saved = JSON.parse(localStorage.getItem(RETURNED_KEY) ?? 'null') as { at: number; flat: Record<LightId, Lamp> } | null;
      if (initial && saved && typeof saved.flat === 'object' && saved.flat && Date.now() - saved.at < RETURN_MS) returned = saved.flat;
    } catch { /* Storage is optional. */ }
    for (const light of HOUSE_LIGHTS) {
      // A light of two bulbs is on if either is, in the colour of the one that is.
      const bulbs = bulbsOf(light), bulb = bulbs.find(b => b.power) ?? bulbs[0];
      if (!bulb) continue;
      const lamp = returned[light.id] ?? fromBulb(bulb);
      const quiet = Date.now() - (told[light.id] ?? 0) > ECHO_MS[reply.transport ?? 'cloud'];
      if (initial || (mirroring() && quiet && !sameLamp(lamp, sent[light.id]))) {
        sent[light.id] = lamp;
        if (!sameLamp(lamp, flat[light.id])) { flat[light.id] = lamp; flatListeners.forEach(listener => listener(light.id, lamp)); }
      }
    }
    const bulbs = Object.fromEntries(reply.lights.filter(b => b.connected && typeof b.latency === 'number').map(b => [b.label, b.latency!]));
    const now = status as LightsStatus;
    // Switched off while the read was on its way: it stays off.
    if (now.state !== 'off') {
      const moved = now.state === 'on' && now.transport !== reply.transport;
      status = { state: 'on', lights: present.size, latency: reply.latency, transport: reply.transport ?? 'cloud', bulbs };
      if (moved) startPolling();
      changed();
    }
  }
  let reading = false;
  function startPolling() {
    stopPolling();
    poll = setInterval(() => {
      if (!mirroring() || document.hidden || reading) return;
      reading = true; void read().finally(() => { reading = false; });
    }, POLL_MS[transport()]);
    // Away from the flat nothing reads the bulbs, but their latencies still move with the Wi-Fi.
    measureTimer = setInterval(() => {
      if (mirroring() || document.hidden || reading) return;
      reading = true; void read().finally(() => { reading = false; });
    }, MEASURE_MS);
    clockTimer = setInterval(() => { if (!document.hidden) void syncClock(); }, CLOCK_MS);
  }
  function stopPolling() {
    for (const timer of [poll, measureTimer, clockTimer]) if (timer) clearInterval(timer);
    poll = measureTimer = clockTimer = undefined;
  }
  let connecting: Promise<void> | undefined;
  /** Takes the lights; a retry keeps saying why they were not there until they are. */
  function connect() {
    stopRetry();
    connecting ??= (async () => {
      if (status.state === 'off' || status.state === 'on') { status = { state: 'connecting' }; changed(); }
      // The flat starts as the house is right now.
      await Promise.all([read(true), syncClock()]);
      if ((status as LightsStatus).state !== 'on') return;
      startPolling();
      settle(1.5, true);
    })().finally(() => { connecting = undefined; });
    return connecting;
  }
  /** The game lets go: every bulb back to the flat, which is the house as the game last knew it. */
  function release() {
    stopRetry();
    if (!active()) return;
    timers.forEach(clearTimeout); timers.clear(); holding = 0; fallen = false; finished = undefined; finale = undefined; ending = undefined;
    const states = HOUSE_LIGHTS.filter(light => present.has(light.id)).flatMap(light => bulbStates(light.id, flat[light.id]));
    if (states.length) void call('PUT', '', { states, duration: 1.5 }, true);
    try { localStorage.setItem(RETURNED_KEY, JSON.stringify({ at: Date.now(), flat })); } catch { /* Storage is optional. */ }
    stopPolling();
  }
  if (settings.enabled) void connect();
  window.addEventListener('pagehide', release);
  // Back from the browser's page cache: take the lights again.
  window.addEventListener('pageshow', event => { if (event.persisted && settings.enabled) void connect(); });
  // Back to the tab or the network: lights that were missing try again at once.
  const again = () => { if (settings.enabled && status.state === 'unavailable' && status.reason !== 'key') { misses = 0; void connect(); } };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (active()) { void syncClock(); if (mirroring()) void read(); } else again();
  });
  window.addEventListener('online', again);
  /** Whether the bridge times the flashes (its clock is read), rather than a timer on this page. */
  const timed = () => offset !== undefined;

  return {
    get settings() { return settings; },
    get status() { return status; },
    /** How far ahead the living room's bulbs must be told now (ms): their measured latency and the calibration. */
    get lead() { return latencyOf(SALON) + settings.late; },
    get timed() { return timed(); },
    get active() { return active(); },
    get flat() { return flat as Readonly<Record<LightId, Lamp>>; },
    onChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    /** The flat's lamps changed, from the house or from Gerard. */
    onFlat(listener: (id: LightId, lamp: Lamp) => void) { flatListeners.add(listener); return () => flatListeners.delete(listener); },
    /** `remember: false` temporarily releases the lights on exit without changing the saved choice. */
    async setEnabled(on: boolean, remember = true) {
      if (on === settings.enabled && (on ? status.state !== 'off' : status.state === 'off')) return;
      settings = { ...settings, enabled: on }; if (remember) save();
      if (on) await connect(); else { release(); status = { state: 'off' }; changed(); }
    },
    update(next: Partial<Omit<LightsSettings, 'enabled'>>) {
      settings = { ...settings, ...next, late: Math.max(-LATE_MAX, Math.min(LATE_MAX, next.late ?? settings.late)) };
      save(); changed(); settle(.8);
    },
    /** Gerard walked somewhere else. */
    setPlace(id: EnvironmentId) {
      if (id === place) return;
      place = id;
      if (!fight) settle(id === 'meridiana' ? 1.5 : 1.2, true);
    },
    /** La Reina Bubbaloo's tone or the evening moved: only steps worth a request are sent. */
    setMood(next: Mood) {
      const step = (v: number) => Math.round(v * 10) / 10;
      if (step(next.tone) === step(mood.tone) && step(next.dusk) === step(mood.dusk)) return;
      mood = { tone: step(next.tone), dusk: step(next.dusk) };
      if (!fight) settle(3);
    },
    /** A lamp in the flat was pressed: it changes in the game and, while there, at home. */
    setLamp(id: LightId, lamp: Lamp) {
      flat[id] = lamp;
      flatListeners.forEach(listener => listener(id, lamp));
      if (mirroring()) show({ [id]: lamp }, transport() === 'lan' ? .15 : .4);
    },
    /**
     * A fight changed. Returns how long the game should hold before playing `effect`, so that its
     * hit lands as the bulbs flash. The flash is sent at once with the moment it must be seen (the
     * contact on screen); the bridge tells each bulb its own latency early.
     */
    battle(state: BattleState | undefined, effect?: BattleEffect): number {
      const starting = !!state && !fight;
      const over = state?.phase === 'won' || state?.phase === 'lost' || state?.phase === 'escaped';
      fight = state && !over ? state : undefined;
      if (starting) { turns = new Set(); melody = { notes: 0, startled: false, freed: !!state.castle?.freed }; }
      if (!active()) return 0;
      if (!state) {
        finished = undefined;
        // After a fall the story turns the room pink and black next; the place waits for it.
        if (fallen) { fallen = false; holding--; later(1500, () => settle(2, true)); } else settle(1.5, true);
        return 0;
      }
      const impact = effect ? impactSeconds(effect) * 1000 : 0;
      const hit = effect && hitFlash(effect, state, settings.intensity);
      // A peak breaks the pastel: raw, unless the lights are set soft, where it only swells.
      const peak = effect && peakOf(effect, state, turns);
      const raw = !!peak && settings.intensity !== 'suave';
      const swell: Flash | undefined = peak && !raw ? { lights: [...SALON], kind: 'breathe', color: pastel(peak, CAPS.boss), period: 1.4, cycles: 1, peak: .3 } : undefined;
      const accent = swell ?? hit;
      const lights = raw ? [...SALON] : accent?.lights ?? [];
      // The slam's dark comes before its colour, so a raw peak needs that much more time.
      const ahead = raw ? -Math.min(...slam(peak!).steps.map(step => step.at)) : accent ? riseOf(accent) : 0;
      const holdMs = effect && (raw || accent) ? holdFor(latencyOf(lights), settings.late, ahead, impact) : 0;
      // When the contact shows on screen, less what the calibration found the bulbs add.
      const seen = performance.now() + holdMs + impact + SCREEN_MS - settings.late;
      if (raw) play(slam(peak!), seen);
      else if (accent) flash(accent, seen);
      /** When the flash has had its moment and the room can move on (a raw peak lingers). */
      const after = effect ? holdMs + impact + (raw ? 1100 : 700) : 0;
      if (state.phase === 'won' || state.phase === 'lost') {
        if (finished === state) return 0;
        finished = state;
        const won = state.phase === 'won';
        // Her fall is no victory: the room goes still for the last scene, and stays the end's until the morning after.
        if (won && isQueen(state)) {
          beat = undefined; finale ??= hold(FINALE_MS, 3);
          later(after, () => { show(LAST, 2.5, true); flash(LAST_BREATH); });
          return holdMs;
        }
        holding++; beat = undefined; fallen = !won;
        later(after, () => show(won ? VICTORY : DEFEAT, won ? .25 : 2, true));
        if (won) later(after + 2600, () => { holding--; settle(2, true); });
        return holdMs;
      }
      if (state.phase === 'escaped') { later(after, () => settle(1.2, true)); return holdMs; }
      const look = () => {
        if (fight !== state) return;
        const colours = battleLook(state, settings.scope, settings.intensity);
        const pulse = heartbeat(state, settings.intensity);
        const key = pulse ? `${pulse.period}` : undefined;
        // A new colour on a bulb stops its effect, so the lamp with the heartbeat is left to it.
        if (pulse) delete colours.mesa;
        show(colours, starting ? .25 : raw ? 1.8 : .6, starting || raw);
        if (key !== beat || raw) { beat = key; if (pulse) flash(pulse); else show({ mesa: battleLook(state, settings.scope, settings.intensity).mesa }, raw ? 1.8 : .4, true); }
      };
      if (effect) later(after, look);
      else {
        look();
        if (starting) flash({ lights: [...SALON], kind: 'breathe', color: white(6000, 1), period: .6, cycles: 1, peak: .1 });
      }
      return holdMs;
    },
    /** Bernat's box opened or closed: while open, the real flat is the game's (the portal's puzzle is played on its lamps). */
    portal(open: boolean) { if (open === portal) return; portal = open; settle(.6, true); },
    /**
     * A note of the artilugio in her fight (src/castle-fight.ts `castleNote`). The first one makes her
     * turn: the room flinches. Each right one walks the moon from her violet towards Aitor's cyan, a
     * wrong one puts it back; the sixth frees him, a slam in his own colour, and her violet leaves the room.
     */
    note(state: BattleState | undefined) {
      const held = state?.castle;
      if (!state || !held?.taken || state.phase === 'won' || state.phase === 'lost') return;
      if (fight) fight = state;
      const was = melody;
      melody = { notes: held.notes ?? 0, startled: !!held.startled, freed: !!held.freed };
      if (!active() || holding) return;
      const now = performance.now() + SCREEN_MS - settings.late;
      if (melody.freed && !was.freed) {
        if (settings.intensity === 'suave') flash({ lights: [...SALON], kind: 'breathe', color: AITOR, period: 1.6, cycles: 1, peak: .3 });
        else play(slam(hex('#4fd8e8', 1, .85)), now);
        later(1400, () => settle(1.8, true));
        return;
      }
      // She turns at the first note, as if called by name: the room drops for a breath and comes back.
      if (melody.startled && !was.startled) {
        const look = battleLook(state, settings.scope, settings.intensity);
        play({ steps: [{ at: 0, look: Object.fromEntries(SALON.map(id => [id, scale(look[id] ?? OFF, .2)])), duration: .05 }, { at: 260, look, duration: .5 }] }, now);
      }
      const lamp = heldLamp(state);
      if (!lamp) return;
      show({ luna: scale(lamp, INTENSITY[settings.intensity]) }, .3, true);
      if (melody.notes !== was.notes) flash({ lights: ['luna'], kind: 'breathe', color: melody.notes > was.notes ? hex('#4fd8e8', 1, .6) : hex('#3a1a6a', .05, .9), period: .8, cycles: 1, peak: .25 });
    },
    /**
     * Story moments the room takes part in. Most stay pastel; the raw ones are hers and the falls:
     * being caught, the people she holds unmasked, her palace rising, the end. `colour` is an ánima's.
     */
    moment(kind: Moment, colour?: string) {
      if (!active()) return;
      const now = performance.now() + SCREEN_MS - settings.late;
      const all = (lamp: Lamp) => Object.fromEntries(SALON.map(id => [id, lamp]));
      if (kind === 'right' || kind === 'wrong') {
        flash({ lights: [...SALON, ...ELSEWHERE], kind: 'pulse', color: kind === 'right' ? hex('#2bff6a', 1) : hex('#ff2a1f', 1), period: .45, cycles: 3 });
      } else if (kind === 'last') {
        // The last scene, if the fight did not already still the room: her breathing on the table lamp while Gerard chooses.
        finale ??= hold(FINALE_MS, 3);
        show(LAST, 2, true); flash(LAST_BREATH);
      } else if (kind === 'acabar' || kind === 'bajar') {
        finale ??= hold(FINALE_MS, 3); ending = kind;
        const cue = endingCue(kind, settings.intensity);
        // Acabar's Foc Binari flickers as it forms, unless the lights are set soft.
        if (kind === 'acabar' && settings.intensity !== 'suave') later(200, () => flash({ lights: ['cocina', 'sofa', 'luna'], kind: 'pulse', color: hex('#ff7a1a', 1, .9), period: .2, cycles: 5 }));
        play(cue, now);
      } else if (kind === 'fall' && finale) {
        // The end's way into the morning after: no pink here, whatever was chosen. The dark, and the morning gives the room back.
        show(all(OFF), 2, true);
      } else if (kind === 'fall') {
        holding++;
        show(all(hex('#ff3f9a', .35, .8)), .4, true);
        later(900, () => show(all(OFF), 1.2, true));
        later(3200, () => { holding--; settle(2, true); });
      } else if (kind === 'tv') flash({ lights: ['sofa'], kind: 'breathe', color: hex('#6fa8ff', .55, .6), period: 2.3, cycles: 200, peak: .5 });
      else if (kind === 'tv-off') show({ sofa: place === 'meridiana' ? flat.sofa : sent.sofa ?? OFF }, .5, true);
      else if (kind === 'doom') show(all(BUBBALOO[0]), 4, true);
      // Caught: the room goes out with the screen, in her violet, until they wake.
      else if (kind === 'ambush') { caught?.(); caught = hold(8000); show(all(hex('#6a3ab0', .03, .9)), 1.4, true); }
      // Waking: a pale morning first, then wherever they are.
      else if (kind === 'wake') {
        // The Monday after the end: the morning comes slower, and after Bajar la mano some pink is still there.
        if (finale) {
          const release = finale, chose = ending; finale = ending = undefined;
          show(all(white(4200, .3)), 1.5, true);
          later(2500, () => { release(); if (chose === 'bajar') later(3000, () => flash(LEFT_PINK)); });
          return;
        }
        const release = caught ?? hold(400); caught = undefined;
        show(all(white(4200, .3)), .2, true); later(400, release);
      }
      // Into the spiral and out of it: her pink walks across the room, and back as someone comes out.
      else if (kind === 'portal' || kind === 'emerge') play(sweep(kind === 'portal' ? hex('#ff6fae', .85, .6) : white(3800, .85), kind === 'emerge'), now);
      // The people she held come apart: raw violet, then their own light back.
      else if (kind === 'unmask') {
        const release = hold(3500);
        if (settings.intensity === 'suave') show(all(hex('#9a5bff', .7, .6)), .8, true); else play(slam(hex('#9a5bff', 1, .9)), now + 200);
        later(1600, () => show(all(white(4000, .85)), 1.2, true)); later(3000, release);
      }
      // An ánima wakes: the room swells into its colour, bright but still pastel.
      else if (kind === 'anima' && colour) { const release = hold(3200); show(all(hex(colour, 1, .55)), .4, true); later(2400, release); }
      // A person's light reaches Gerard or Aitor: the amber of the jar, on the lamps by the table.
      else if (kind === 'light-in') flash({ lights: ['luna', 'mesa'], kind: 'breathe', color: hex('#ffb347', 1, .75), period: 1.2, cycles: 1, peak: .3 });
      // Her palace rises: her pink climbs through the room, slowly and all the way.
      else if (kind === 'palace') { const release = hold(6000, 3); show(Object.fromEntries(SALON.map((id, i) => [id, { ...BUBBALOO[i], saturation: .85, brightness: .8 }])), 4, true); later(5500, release); }
    },
    /** Calibrates by eye: the bulbs flash and the screen does as they should be seen, 0.4 s from now. */
    test(onScreen: () => void) {
      if (!active()) { onScreen(); return; }
      const seen = performance.now() + Math.max(400, latencyOf(SALON) + 150);
      flash({ lights: [...SALON], kind: 'pulse', color: white(6500, 1), period: .25, cycles: 1, peak: .5 }, seen - settings.late);
      later(seen - SCREEN_MS - performance.now(), onScreen);
    },
    /** One beat of the tap calibration on the bulbs, to be seen at `seen` (performance.now ms) with the calibration as it is. */
    beat(seen: number) {
      flash({ lights: [...SALON], kind: 'pulse', color: white(6500, 1), period: .2, cycles: 1, peak: .5 }, seen - settings.late);
    },
    release,
  };
}
export type HomeLights = ReturnType<typeof createHomeLights>;
