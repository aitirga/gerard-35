/**
 * The lights at home follow the game (docs/home-lights.md). Each place lends the living room its
 * main colours, fights play on the bulbs (hits flash, low health turns them red and sets a
 * heartbeat going) and the Meridiana flat is the real one: its lamps and the bulbs at home mirror
 * each other both ways. The browser decides; `lights.py` sends it to the bulbs (on the LAN at home).
 * Everything above `createHomeLights` is pure, for the tests.
 */
import type { EnvironmentId } from './environments.ts';
import type { BattleEffect, BattleState } from './battle.ts';
import { CONTACT_SECONDS } from './battle-motion.ts';

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
  // The Meridiana outside: peach façades, green awnings, plane trees and a Barcelona sky.
  'meridiana-calle': { salon: [hex('#f2b38f', .75, .45), hex('#8ec5e8', .6, .5), hex('#2f9c86', .5, .6), white(3200, .7)], rest: white(3200, .3) },
  // The Rec Comtal school: brick and a pale sky (the castle's pink comes with the tone).
  'rec-comtal': { salon: [hex('#d98b5f', .7, .55), hex('#9cc6e6', .55, .45), white(3400, .65), hex('#e7a77a', .6, .45)], rest: white(3300, .3) },
};
/** La Reina Bubbaloo's light (scenery.ts BUBBALOO): a magenta sun and a violet gloom. */
const BUBBALOO = [hex('#db6ba8', .5, .55), hex('#9a5bc4', .4, .5), hex('#ff7fb3', .45, .5), hex('#c04a8a', .45, .6)];
const INTENSITY: Record<Intensity, number> = { suave: .7, normal: .9, intensa: 1 };

export interface Mood { tone: number; dusk: number }
/** The look of a place; `tone` is La Reina Bubbaloo's light (0–1), `dusk` chapter 2's evening. */
export function placeLook(place: EnvironmentId, mood: Mood, scope: Scope, intensity: Intensity = 'normal'): Look | undefined {
  if (place === 'meridiana') return undefined;
  const { salon, rest } = PLACE_LOOKS[place];
  // Her light takes over at most half the colour: the room stays the room.
  const tint = Math.min(1, Math.max(0, mood.tone)) * .5, evening = Math.min(1, Math.max(0, mood.dusk));
  const shade = (lamp: Lamp, i: number) => {
    const tinted = mix(lamp, BUBBALOO[i % 4], tint);
    return scale({ ...tinted, kelvin: Math.round(tinted.kelvin - evening * 500) }, (1 - .3 * evening) * INTENSITY[intensity]);
  };
  const look: Look = {};
  SALON.forEach((id, i) => { look[id] = shade(salon[i], i); });
  if (scope === 'casa') ELSEWHERE.forEach((id, i) => { look[id] = shade(rest, i); });
  return look;
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
  { name: 'Violeta', lamp: hex('#9a5bff', .65, .7) }, { name: 'Rosa', lamp: hex('#ff6fae', .7, .6) },
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
const PALETTES: Record<BattleState['encounter'] | 'possessed', [Lamp, Lamp, Lamp, Lamp]> = {
  dogs: [hex('#ffa040', .8, .8), white(4200, .75), hex('#ff7a2a', .6, .85), hex('#ffd27a', .7, .6)],
  possessed: [hex('#ff5fa8', .7, .7), hex('#a05ae0', .55, .7), hex('#ff8a6a', .6, .6), hex('#e04a9a', .6, .75)],
  'palace-minion': [hex('#e0409a', .65, .75), hex('#8a4ad6', .55, .75), hex('#ff7fc0', .6, .55), hex('#c03a8a', .6, .8)],
  'palace-guards': [hex('#c8306e', .65, .8), hex('#7a3ad6', .5, .8), hex('#ff5a4a', .55, .75), hex('#e0409a', .6, .8)],
};
const ALARM = hex('#ff2a1a', .75, 1);
/** 0 with everyone healthy, 1 when someone still standing is about to fall. */
export function tension(state: BattleState) {
  const standing = state.allies.filter(a => a.hp > 0);
  if (!standing.length) return 1;
  return 1 - Math.min(...standing.map(a => a.hp / a.maxHp));
}
/** The fight's look: its own palette, turning red and darker as the party's health runs out. */
export function battleLook(state: BattleState, scope: Scope, intensity: Intensity = 'normal'): Look {
  const palette = PALETTES[state.possessed ? 'possessed' : state.encounter];
  const danger = Math.max(0, (tension(state) - .45) / .55);
  const look: Look = {};
  SALON.forEach((id, i) => { look[id] = scale(mix(palette[i], ALARM, danger * (i === 3 ? .9 : .6)), (1 - danger * (i === 3 ? 0 : .35)) * INTENSITY[intensity]); });
  if (scope === 'casa') ELSEWHERE.forEach((id, i) => { look[id] = scale(mix(palette[i % 4], ALARM, danger * .5), .3 * INTENSITY[intensity]); });
  return look;
}
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
  const support = effect.skill === 'cardioide' || !!effect.boosted;
  return effect.target && !support ? CONTACT_SECONDS : .2;
}
/** How a hit lands at home: on the bulbs in front of the player, timed to the contact. */
export function hitFlash(effect: BattleEffect, state: BattleState, intensity: Intensity = 'normal'): Flash | undefined {
  const front: LightId[] = ['cocina', 'sofa', 'luna'];
  const strong = INTENSITY[intensity];
  const target = [...state.allies, ...state.foes].find(c => c.id === effect.target);
  const knockedOut = !!target && target.hp === 0;
  const byParty = state.allies.some(a => a.id === effect.actor);
  // Cardioide heals one ally: a green swell; Análisis Parálisis lifts the whole party: warm orange everywhere.
  if (effect.skill === 'cardioide') return { lights: front, kind: 'breathe', color: hex('#6ee08a', strong, .8), period: 1.3, cycles: 1, peak: .4 };
  if (effect.boosted) return { lights: [...front, 'mesa'], kind: 'breathe', color: hex('#ff9a3a', strong, .85), period: 1.3, cycles: 1, peak: .4 };
  if (effect.kind === 'defend') return { lights: front, kind: 'breathe', color: hex('#5aa0ff', .8 * strong, .8), period: .9, cycles: 1, peak: .3 };
  if (effect.kind === 'escape' || !effect.target) return undefined;
  if (effect.swallowed) return { lights: front, kind: 'breathe', color: hex('#ff6fae', .9 * strong, .8), period: .7, cycles: 1, peak: .15 };
  if (effect.skill === 'nota') {
    // The big NO: a strobe, unless the lights are set soft.
    return intensity === 'suave' ? { lights: front, kind: 'breathe', color: hex('#b36bff', 1, .8), period: .6, cycles: 1, peak: .1 }
      : { lights: front, kind: 'pulse', color: hex('#c08aff', 1, .7), period: .16, cycles: 3 };
  }
  if (!byParty) return { lights: front, kind: 'breathe', color: hex('#ff2a1a', strong, 1), period: knockedOut ? .9 : .5, cycles: knockedOut ? 2 : 1, peak: .08 };
  const color = white(5500, strong);
  return { lights: knockedOut ? [...front, 'mesa'] : front, kind: 'breathe', color: knockedOut ? hex('#ffd24a', 1, .7) : color, period: knockedOut ? .9 : .45, cycles: 1, peak: .1 };
}
/** The fight is won: each living-room bulb a different bright colour for a moment. */
export const VICTORY: Look = { cocina: hex('#ffd24a', 1, .8), sofa: hex('#48d07a', .9, .8), luna: hex('#4ac8ff', .9, .8), mesa: hex('#ff6fae', .9, .7) };
/** The party has fallen: the room sinks to a dark red before the pink-and-black of waking up. */
export const DEFEAT: Look = { cocina: hex('#ff2a1a', .12, 1), sofa: hex('#ff2a1a', .08, 1), luna: OFF, mesa: hex('#c0306e', .1, .9) };

// ——— The director: settings, the bridge and the timing ———
/** `lead` in ms, or null to follow how long the bulbs take (`autoLead`). */
export interface LightsSettings { enabled: boolean; scope: Scope; intensity: Intensity; lead: number | null }
/** `lan`: the bulbs answer on the home network in milliseconds; `cloud`: through LIFX, up to a second. */
export type Transport = 'lan' | 'cloud';
export type LightsStatus =
  | { state: 'off' } | { state: 'connecting' }
  | { state: 'on'; lights: number; latency?: number; transport: Transport }
  | { state: 'unavailable'; reason: string };
/**
 * The lead that lands a flash with the hit. On the LAN a bulb starts within a few milliseconds of
 * the message (the measured latency waits for the slowest bulb's answer, so it is not used); through
 * the cloud it is about half a second.
 */
export function autoLead(transport: Transport) {
  return transport === 'lan' ? 40 : 500;
}
interface HouseBulb { label: string; connected: boolean; power: boolean; hue: number; saturation: number; kelvin: number; brightness: number }
const SETTINGS_KEY = 'gerard35.lights.v2';
const KEY_KEY = 'gerard35.lights.key';
/** The flat as the game last gave it back, so a reload does not read bulbs still on their way home. */
const RETURNED_KEY = 'gerard35.lights.returned';
const RETURN_MS = 60000;
/** Lamp changes Gerard makes in the flat stay a moment before the house's own reading counts. */
const ECHO_MS: Record<Transport, number> = { lan: 1200, cloud: 4500 };
/** How often the flat reads the house while Gerard is in it. */
const POLL_MS: Record<Transport, number> = { lan: 250, cloud: 3000 };
export const DEFAULT_SETTINGS: LightsSettings = { enabled: false, scope: 'salon', intensity: 'normal', lead: null };

export function createHomeLights() {
  let settings: LightsSettings = { ...DEFAULT_SETTINGS };
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { /* Storage is optional. */ }
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
  /** A look that holds for a moment (victory, defeat, a fall) before the place comes back. */
  let holding = 0;
  /** The party fell: the room stays dark red until the fight closes. */
  let fallen = false;
  /** The fight whose ending is already playing: the battle screen reports it more than once. */
  let finished: BattleState | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const active = () => status.state === 'on';
  const transport = (): Transport => status.state === 'on' ? status.transport : 'cloud';
  const lead = () => settings.lead ?? autoLead(transport());
  const labelsOf = (ids: LightId[]) => ids.flatMap(id => lightById(id).labels);
  const bulbStates = (id: LightId, lamp: Lamp) => lightById(id).labels.map(light => ({ light, ...toBulb(lamp) }));
  const changed = () => listeners.forEach(listener => listener());
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage is optional. */ } };
  const later = (ms: number, run: () => void) => { const t = setTimeout(() => { timers.delete(t); run(); }, ms); timers.add(t); };
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
  // A bulb switched off keeps its colour for the next time a switch turns it on, so an off lamp read
  // from the house carries it, and giving the house back restores it too. OFF itself has none.
  const toBulb = (lamp: Lamp) => ({ power: lamp.on, ...(lamp.on || lamp.brightness > 0 ? { color: { hue: lamp.hue, saturation: lamp.saturation, kelvin: lamp.kelvin }, brightness: lamp.brightness } : {}) });
  const fromBulb = (bulb: HouseBulb): Lamp => ({ on: bulb.power, hue: bulb.hue, saturation: bulb.saturation, brightness: bulb.brightness, kelvin: bulb.kelvin });
  /** Sends what differs from what the bulbs were last told (`force` resends it anyway); returns the bulbs told. */
  function show(look: Look, duration: number, force = false) {
    if (!active()) return [];
    const changes = (Object.entries(look) as [LightId, Lamp][]).filter(([id, lamp]) => present.has(id) && (force || !sameLamp(sent[id], lamp)));
    const states = changes.flatMap(([id, lamp]) => { sent[id] = lamp; told[id] = Date.now(); return bulbStates(id, lamp); });
    if (states.length) void call('PUT', '', { states, duration });
    return changes.map(([id]) => id);
  }
  function flash(effect: Flash) {
    const lights = labelsOf(effect.lights.filter(id => present.has(id) && sent[id]?.on !== false));
    if (!active() || !lights.length) return;
    effect.lights.forEach(id => { told[id] = Date.now(); });
    void call('POST', '/effect', { lights, kind: effect.kind, color: toBulb(effect.color).color, brightness: effect.color.brightness, period: effect.period, cycles: effect.cycles, peak: effect.peak });
  }
  const mirroring = () => place === 'meridiana' && !fight && !holding;
  /** Whatever the bulbs should show now: the fight, the flat, or the place. */
  function settle(duration = 1.2, force = false) {
    if (!active() || holding) return;
    if (fight) { show(battleLook(fight, settings.scope, settings.intensity), duration, force); return; }
    const look = place ? placeLook(place, mood, settings.scope, settings.intensity) : undefined;
    const touched = show(look ?? (place === 'meridiana' ? flat : {}), duration, force);
    // The palace's fountain, the Corazón Líquido, beats slowly on the table lamp (a new colour stops it).
    if (place === 'palacio' && look?.mesa && touched.includes('mesa')) flash({ lights: ['mesa'], kind: 'breathe', color: hex('#ff5fae', look.mesa.brightness + .15, .7), period: 5, cycles: 120, peak: .5 });
  }
  /** While Gerard is in the flat, a lamp switched at home turns on or off in the game too. */
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
      if (initial && saved && Date.now() - saved.at < RETURN_MS) returned = saved.flat;
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
    const now = status as LightsStatus;
    // Switched off while the read was on its way: it stays off.
    if (now.state !== 'off') {
      const moved = now.state === 'on' && now.transport !== reply.transport;
      status = { state: 'on', lights: present.size, latency: reply.latency, transport: reply.transport ?? 'cloud' };
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
  }
  function stopPolling() { if (poll) clearInterval(poll); poll = undefined; }
  let connecting: Promise<void> | undefined;
  /** Takes the lights; a retry keeps saying why they were not there until they are. */
  function connect() {
    stopRetry();
    connecting ??= (async () => {
      if (status.state === 'off' || status.state === 'on') { status = { state: 'connecting' }; changed(); }
      // The flat starts as the house is right now.
      await read(true);
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
    timers.forEach(clearTimeout); timers.clear(); holding = 0; fallen = false; finished = undefined;
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
    if (active() && mirroring()) void read(); else again();
  });
  window.addEventListener('online', again);

  return {
    get settings() { return settings; },
    get status() { return status; },
    /** The lead in use: the setting, or the automatic one. */
    get lead() { return lead(); },
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
    update(next: Partial<Omit<LightsSettings, 'enabled'>>) { settings = { ...settings, ...next }; save(); changed(); settle(.8); },
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
     * hit lands as the bulbs flash: the lights are sent `lead` ms ahead of the contact.
     */
    battle(state: BattleState | undefined, effect?: BattleEffect): number {
      const starting = !!state && !fight;
      const over = state?.phase === 'won' || state?.phase === 'lost' || state?.phase === 'escaped';
      fight = state && !over ? state : undefined;
      if (!active()) return 0;
      if (!state) {
        finished = undefined;
        // After a fall the story turns the room pink and black next; the place waits for it.
        if (fallen) { fallen = false; holding--; later(1500, () => settle(2, true)); } else settle(1.5, true);
        return 0;
      }
      const ahead = lead();
      const impact = effect ? impactSeconds(effect) * 1000 : 0;
      const hit = effect && hitFlash(effect, state, settings.intensity);
      // The game holds the hit back when the bulbs need longer than its wind-up.
      const hold = effect ? Math.max(0, ahead - impact) : 0;
      if (hit) { if (ahead >= impact) flash(hit); else later(impact - ahead, () => flash(hit)); }
      /** When the flash has had its moment and the room can move on. */
      const after = effect ? hold + impact + 700 : 0;
      if (state.phase === 'won' || state.phase === 'lost') {
        if (finished === state) return 0;
        finished = state;
        const won = state.phase === 'won';
        holding++; beat = undefined; fallen = !won;
        later(after, () => show(won ? VICTORY : DEFEAT, won ? .25 : 2, true));
        if (won) later(after + 2600, () => { holding--; settle(2, true); });
        return hold;
      }
      if (state.phase === 'escaped') { later(after, () => settle(1.2, true)); return hold; }
      const look = () => {
        if (fight !== state) return;
        const colours = battleLook(state, settings.scope, settings.intensity);
        const pulse = heartbeat(state, settings.intensity);
        const key = pulse ? `${pulse.period}` : undefined;
        // A new colour on a bulb stops its effect, so the lamp with the heartbeat is left to it.
        if (pulse) delete colours.mesa;
        show(colours, starting ? .25 : .6, starting);
        if (key !== beat) { beat = key; if (pulse) flash(pulse); else show({ mesa: battleLook(state, settings.scope, settings.intensity).mesa }, .4, true); }
      };
      if (effect) later(after, look);
      else {
        look();
        if (starting) flash({ lights: [...SALON], kind: 'breathe', color: white(6000, 1), period: .6, cycles: 1, peak: .1 });
      }
      return hold;
    },
    /** Story moments the room takes part in. */
    moment(kind: 'fall' | 'tv' | 'tv-off' | 'doom') {
      if (!active()) return;
      if (kind === 'fall') {
        holding++;
        show(Object.fromEntries(SALON.map(id => [id, hex('#ff3f9a', .35, .8)])), .4, true);
        later(900, () => show(Object.fromEntries(SALON.map(id => [id, OFF])), 1.2, true));
        later(3200, () => { holding--; settle(2, true); });
      } else if (kind === 'tv') flash({ lights: ['sofa'], kind: 'breathe', color: hex('#6fa8ff', .55, .6), period: 2.3, cycles: 200, peak: .5 });
      else if (kind === 'tv-off') show({ sofa: place === 'meridiana' ? flat.sofa : sent.sofa ?? OFF }, .5, true);
      else show(Object.fromEntries(SALON.map((id, i) => [id, BUBBALOO[i]])), 4, true);
    },
    /** Calibrates the lead: the bulbs are told now, the screen flashes `lead` ms later. */
    test(onScreen: () => void) {
      if (!active()) { onScreen(); return; }
      flash({ lights: [...SALON], kind: 'breathe', color: white(6500, 1), period: .5, cycles: 1, peak: .05 });
      later(lead(), onScreen);
    },
    release,
  };
}
export type HomeLights = ReturnType<typeof createHomeLights>;
