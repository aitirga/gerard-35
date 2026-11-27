/**
 * The pupils on the castle's own floors (docs/castle.md § The generated floor): inside, each one is a
 * body of its own that hunts the way it does out on the Meridiana at night (src/night-pupils.ts), so
 * what the way home rehearsed is what the rooms ask. The same rules, with the floor's own numbers:
 *
 * - A room's pupils walk its round until they have Gerard; lost, they go and look where he was, and
 *   back to their room. Walking into one, or one reaching the party, is its room's fight.
 * - **La Delegada** waits in her room. Once she has seen Gerard, or La Chivata has pointed him out
 *   within her reach, she walks at him and never stops, and nobody gives up while she stands.
 * - **El Ausente** is only seen inside the light the party carries, or once it comes at them.
 * - **The staff room** is the floor's safe place, as home's portal is the street's: pupils do not go
 *   in, and nobody in it is seen.
 * - There is nothing to hide behind yet (El Empollón has nothing to learn): what cuts a line of sight
 *   is a wall, a corner, a corridor.
 *
 * Pure: no DOM, no engine. The game steps it (`stepStreet`) and draws each body.
 */
import { CASTLE_FIGHTS, castlePhase, roomRound, type CastleFloor, type CastlePhaseId, type Cell, type RoomEncounter } from './castle.ts';
import type { NightTier } from './night.ts';
import { STREET, createStreet, placeGroup, removeGroup, type Street, type StreetRules } from './night-pupils.ts';

/**
 * How the pupils of each floor walk, run and see (cells and cells per second; Gerard walks 5.2 and
 * runs 7.8). The first floor is in daylight, so there is no dark to see less in; the second is under
 * emergency lighting and the third has almost none: out of the party's own light they see little,
 * and run faster. Only the speeds and sights are read inside (no grates, no trains).
 */
export const FLOOR_TIERS: Record<CastlePhaseId, NightTier> = {
  1: { id: 'primero', hunters: 0, perTrain: 0, walk: 1.3, run: 4.2, sightLit: 6, sightDark: 6, sightChasing: 7, trainEvery: 0, lampsOut: 0 },
  2: { id: 'segundo', hunters: 0, perTrain: 0, walk: 1.5, run: 4.8, sightLit: 6, sightDark: 3.5, sightChasing: 6.5, trainEvery: 0, lampsOut: 0 },
  3: { id: 'tercero', hunters: 0, perTrain: 0, walk: 1.6, run: 5.4, sightLit: 6, sightDark: 3, sightChasing: 7, trainEvery: 0, lampsOut: 0 },
};
/**
 * The street's book (`STREET`) cut to rooms of five to nine cells and corridors of twelve: a run is
 * heard a room away, El Repetidor charges across a room and no further (so a wall is always near to
 * crash it into), La Chivata keeps a room's width and tells whoever is within a room or two, Los
 * Gemelos cut a corner ahead, El Castigado bursts for the rooms next to its own, El Montón lets go a
 * room and a half away.
 */
export const INDOORS: StreetRules = {
  ...STREET,
  hear: 8, chargeFrom: 6.5, chargeNear: 2, chargeSpeed: 12, chargeLength: 9, crash: 4.5,
  keep: 3.5, reveal: 15, learnNear: 8, check: 8, lead: 4, close: 2,
  march: 1.3, marchLeast: 1.7, rageNear: 5, alarm: 16, forget: 18,
};

/** A room's pupils still about: its number (their group), who they are and the round they walk. */
export interface RoomGroup { room: number; encounter: RoomEncounter; round: readonly Cell[] }
/** The rooms of `floor` whose pupils are still about, leaving out those in `beaten`. */
export function roomGroups(floor: CastleFloor, beaten: readonly number[] = []): RoomGroup[] {
  return floor.rooms.filter(room => room.encounter && !beaten.includes(room.id)).map(room => ({ room: room.id, encounter: room.encounter!, round: roomRound(room) }));
}
/** The pupils' own grid: the staff room is a wall to them, and so is the room of the floor's closed door (nobody of hers goes in there, and no chase crosses it). */
export function pupilsGrid(floor: CastleFloor): string[] {
  const shut = floor.rooms.filter(room => room.kind === 'rest' || room.kind === 'puzzle').map(room => room.rect);
  if (!shut.length) return [...floor.grid];
  return floor.grid.map((row, z) => [...row].map((c, x) => shut.some(r => z >= r.z && z < r.z + r.d && x >= r.x && x < r.x + r.w) ? '#' : c).join(''));
}
/**
 * `floor` as the pupils hunt it. `light` is the light the party carries, a cell the game keeps on
 * Gerard: inside it El Ausente shows, and it is why the party is always seen as lit. Nobody is on it
 * yet: `syncFloor` puts each room's pupils in.
 */
export function createFloorStreet(floor: CastleFloor, light: Cell): Street {
  const staff = floor.rooms.find(room => room.kind === 'rest');
  return createStreet({
    tier: FLOOR_TIERS[floor.phase], phase: floor.phase, rules: INDOORS, grid: pupilsGrid(floor), lamps: [light], covers: [],
    // The staff room's middle stands in for home's portal; with no staff room, nowhere does.
    portal: staff ? { ...staff.cell } : { x: -99, z: -99 },
  });
}
/**
 * Keeps the floor's pupils to the rooms the story says are still about: a room not yet on the floor
 * comes onto it, at its round; one the story no longer lists (won today) goes. `placed` is the
 * caller's memory of the rooms already put in, so a group melted after its fight is not put back
 * before the story has marked its room. Returns the rooms that came in.
 */
export function syncFloor(street: Street, groups: readonly RoomGroup[], placed: Set<number>): RoomGroup[] {
  const fresh = groups.filter(g => !placed.has(g.room));
  for (const g of fresh) { placed.add(g.room); placeGroup(street, g.room, CASTLE_FIGHTS[g.encounter], g.round); }
  for (const room of placed) if (!groups.some(g => g.room === room) && street.pupils.some(p => p.group === room)) removeGroup(street, room);
  return fresh;
}
/** The story's name for a room's pupils (`near` events, `castleNear` in src/castle-story.ts). */
export const roomTag = (phase: CastlePhaseId, room: number) => `castillo-sala-${castlePhase(phase).id}-${room}`;
