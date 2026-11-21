/**
 * A generated floor of the castle as a place the game can walk (docs/castle.md § The generated
 * floor, § The art drifts towards the boss): the floor of `src/castle.ts` turned into an
 * `Environment` that `src/palace-zones.ts` builds like any zone of the palace. Each room's floor is
 * painted by how far along the main path it is, from the zone the party comes from to the one its
 * boss owns, so no new dominant hue is needed (docs/visual-style.md). Pure data: no engine here.
 *
 * Preliminary (2026-11-19): floors and low walls, a lamp a room and her gum; the dressing each
 * phase is meant to gather along the way (lanes and busts, cabinets and stamps, old gum) is to come.
 */
import type { Environment, Room } from './environments';
import type { ZoneTheme } from './palace-zone-plans.ts';
import { CASTLE_PHASES, castlePhase, floorFor, type CastleFloor, type CastlePhase, type CastlePhaseId, type CastlePlace } from './castle.ts';

/** The two ends each phase's art drifts between: the floor, the walls and the light of the zone it leaves and of the one it reaches. */
const ENDS: Record<CastlePhase['from'] | CastlePhase['to'], { floor: string; wall: string; ambient: string; sun: string; glow: string }> = {
  patio: { floor: '#3f7d58', wall: '#ece6da', ambient: '#6c6a7c', sun: '#ffe2cc', glow: '#dfe9ff' },
  gimnasio: { floor: '#2d5a9e', wall: '#e8e2d4', ambient: '#7c8496', sun: '#e4ecff', glow: '#e6f0ff' },
  secretaria: { floor: '#c9a85e', wall: '#b9b6a8', ambient: '#4a4f4c', sun: '#c8ccc0', glow: '#ff7a5a' },
  trono: { floor: '#27306b', wall: '#283063', ambient: '#2c3260', sun: '#7f8fd0', glow: '#c9a046' },
};
/** How bright each phase is: by day, by emergency lighting, with almost none. */
const LIGHT: Record<CastlePhaseId, number> = { 1: 1.3, 2: .8, 3: .55 };
const hex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
/** `a` on its way to `b`, `t` of the way. */
export function mix(a: string, b: string, t: number) {
  const at = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map(i => hex(at(a, i) + (at(b, i) - at(a, i)) * t)).join('')}`;
}
/** A room's floor colour: `order` of the way from the zone left to the boss's (0 the entry, 1 the antechamber). */
export const roomColour = (phase: CastlePhase, order: number) => mix(ENDS[phase.from].floor, ENDS[phase.to].floor, order);
const STEPS = 8;
const step = (order: number) => Math.round(Math.max(0, Math.min(1, order)) * STEPS);

/** A phase's theme: the mix of its two zones' cards (palette by steps along the way), under its own light. */
function themeOf(phase: CastlePhase): ZoneTheme {
  const from = ENDS[phase.from], to = ENDS[phase.to], palette: Record<string, string> = {
    wall: mix(from.wall, to.wall, .5), plinth: mix(mix(from.wall, to.wall, .5), '#3a3640', .45), shade: phase.id === 1 ? '#2a2630' : phase.id === 2 ? '#191b1c' : '#0b0d1c',
    // The corridors: the way's own colour, worn down.
    hall: mix(mix(from.floor, to.floor, .5), '#6a6a6e', .6),
    door: '#e8742c', steel: '#8f9699',
    // Her pink: saturated only where it is her gum; old and dull in the last phase (docs/castle.md).
    her: phase.id === 3 ? '#b8708e' : '#ff6fae',
  };
  for (let i = 0; i <= STEPS; i++) palette[`floor${i}`] = roomColour(phase, i / STEPS);
  return {
    zone: 'castillo', palette, materials: {}, floors: {}, height: phase.id === 3 ? 4.2 : 3.4,
    light: { ambient: mix(from.ambient, to.ambient, .6), sun: mix(from.sun, to.sun, .6), intensity: LIGHT[phase.id] },
    her: phase.id === 3 ? .35 : phase.id === 2 ? .25 : .18,
    glow: mix(from.glow, to.glow, .6),
    // A floor is only ever walked with the bosses before it fallen: so many screams of hers are on its walls (src/castle-mood.ts).
    mood: { won: false, screams: phase.id - 1 },
  };
}
const ROOM_NAMES = { fight: 'Aula', elite: 'Aula de la delegada', rest: 'Sala de profesores', find: 'Armario de material', corridor: 'Rellano', antechamber: 'Antesala' } as const;

/** `floor` as a place: its grid, its rooms and corridors with their floors, the way back and the way into the boss's room. */
export function castleEnvironment(floor: CastleFloor): Environment {
  const phase = castlePhase(floor.phase), theme = themeOf(phase);
  const rooms: Room[] = [
    // Corridors first, so a room's floor lies over the corridor that runs into it.
    ...floor.halls.map((hall, i) => ({ name: `Pasillo ${i + 1}`, ...hall, floor: 'concrete' as const })),
    ...floor.rooms.map(room => ({ name: `${ROOM_NAMES[room.kind]} ${room.id + 1}`, ...room.rect, floor: 'concrete' as const })),
  ];
  floor.halls.forEach((_, i) => { theme.floors[`Pasillo ${i + 1}`] = 'hall'; });
  for (const room of floor.rooms) theme.floors[`${ROOM_NAMES[room.kind]} ${room.id + 1}`] = `floor${step(room.order)}`;
  return {
    id: phase.environment, name: phase.name, grid: [...floor.grid], spawn: { ...floor.spawn }, zoom: 8.2, noOverview: true, walls: 1.4,
    houses: [], props: [],
    palace: { plan: [...floor.grid], rooms, theme, floor },
    interactions: [
      { id: 'castillo-volver', cell: { ...floor.back }, label: 'Volver atrás', hint: 'Volver', to: { environment: phase.out.environment, cell: { ...phase.out.cell } } },
      { id: 'castillo-salir', cell: { ...floor.exit }, label: 'Abrir la puerta', to: { environment: phase.into.environment, cell: { ...phase.into.cell } } },
    ],
  };
}
/** The floor of a castle place on `day` of the save `seed`, as a place. */
export const castleEnvironmentFor = (place: CastlePlace, seed: number, day: number) => castleEnvironment(floorFor(seed, day, castlePhase(place).id));
/** The three floors as they are on a save's first day: what stands in `ENVIRONMENTS` until the game generates the day's. */
export const CASTLE_ENVIRONMENTS = Object.fromEntries(CASTLE_PHASES.map(phase => [phase.environment, castleEnvironment(floorFor(0, 1, phase.id))])) as Record<CastlePlace, Environment>;
