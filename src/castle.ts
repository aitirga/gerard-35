/**
 * The castle of La Reina Bubbaloo (docs/castle.md, docs/castle-bosses.md): its three generated
 * phases, what each boss opens, and the names and numbers of its fights. Pure, and a leaf: it runs
 * nothing of the game's, so the story, the fights (src/castle-fight.ts), the places
 * (src/castle-floor.ts) and the simulators all read the same castle.
 *
 * Preliminary (2026-11-19): the whole block plays end to end with the dynamics only. Every number
 * is a first guess for `just fight-sim`, the pupils are five of the eight designed, and the rest
 * room and the find are rooms with nothing in them yet.
 */
import type { Element, TimedId } from './battle.ts';

export interface Cell { x: number; z: number }
export interface Rect { x: number; z: number; w: number; d: number }
/** Anything that can say whether a story flag is set: the story's own set of flags. */
export interface Flags { has(flag: string): boolean }

// ——— Phases ————————————————————————————————————————————————————————————————————————————
export type CastlePhaseId = 1 | 2 | 3;
export const CASTLE_PLACES = ['castillo-1', 'castillo-2', 'castillo-3'] as const;
export type CastlePlace = (typeof CASTLE_PLACES)[number];
export const isCastlePlace = (id?: string): id is CastlePlace => !!id && (CASTLE_PLACES as readonly string[]).includes(id);
/** The flags the castle sets, in the order the story reaches them. */
export const CASTLE_FLAGS = ['aurelia', 'direccion', 'aitor-poseido', 'artilugio', 'reina', 'final-acabar', 'final-bajar'] as const;
export type CastleFlag = (typeof CASTLE_FLAGS)[number];

/** Its fights: each room's pupils by phase (their year), La Delegada's, the two bosses and the Queen, before and after the artilugio. */
export const CASTLE_ENCOUNTERS = [
  'alumnos-1a', 'alumnos-1b', 'alumnos-1c', 'delegada-1',
  'alumnos-2a', 'alumnos-2b', 'alumnos-2c', 'delegada-2',
  'alumnos-3a', 'alumnos-3b', 'alumnos-3c', 'delegada-3',
  'aurelia', 'direccion', 'reina', 'reina-vuelta',
] as const;
export type CastleEncounter = (typeof CASTLE_ENCOUNTERS)[number];
export const isCastleEncounter = (id?: string): id is CastleEncounter => !!id && (CASTLE_ENCOUNTERS as readonly string[]).includes(id);
export type RoomEncounter = Exclude<CastleEncounter, 'aurelia' | 'direccion' | 'reina' | 'reina-vuelta'>;

/**
 * A phase: the floor generated between two fixed rooms. `rooms`: how many are on the main path;
 * `lattice`: the coarse grid they are laid on (columns × rows); `from` and `to`: the two zones its
 * art drifts between (visual-style.md's identity cards); `into`: where its way out leads, the boss's
 * room; `out`: where its way back leads; `flag`: set when its boss falls.
 */
export interface CastlePhase {
  id: CastlePhaseId; environment: CastlePlace; name: string; rooms: number; lattice: readonly [number, number];
  from: 'patio' | 'gimnasio' | 'secretaria'; to: 'gimnasio' | 'secretaria' | 'trono';
  fights: readonly RoomEncounter[]; elite: RoomEncounter; boss: 'aurelia' | 'direccion' | 'reina'; flag: CastleFlag;
  into: { environment: 'palacio-gimnasio' | 'palacio-secretaria' | 'palacio-trono'; cell: Cell };
  out: { environment: 'palacio-patio' | 'palacio-gimnasio' | 'palacio-secretaria'; cell: Cell };
  /** Where its boss waits in `into`, and how near the party gets before the fight starts. */
  bossAt: Cell; bossRadius: number;
}
export const CASTLE_PHASES: readonly CastlePhase[] = [
  {
    id: 1, environment: 'castillo-1', name: 'Castillo · Primer curso', rooms: 8, lattice: [4, 3], from: 'patio', to: 'gimnasio',
    fights: ['alumnos-1a', 'alumnos-1b', 'alumnos-1c'], elite: 'delegada-1', boss: 'aurelia', flag: 'aurelia',
    into: { environment: 'palacio-gimnasio', cell: { x: 13, z: 16 } }, out: { environment: 'palacio-patio', cell: { x: 6, z: 2 } },
    bossAt: { x: 13, z: 10 }, bossRadius: 3.2,
  },
  {
    id: 2, environment: 'castillo-2', name: 'Castillo · Segundo curso', rooms: 10, lattice: [5, 3], from: 'gimnasio', to: 'secretaria',
    fights: ['alumnos-2a', 'alumnos-2b', 'alumnos-2c'], elite: 'delegada-2', boss: 'direccion', flag: 'direccion',
    into: { environment: 'palacio-secretaria', cell: { x: 4, z: 19 } }, out: { environment: 'palacio-gimnasio', cell: { x: 19, z: 2 } },
    bossAt: { x: 3, z: 5 }, bossRadius: 3.2,
  },
  {
    id: 3, environment: 'castillo-3', name: 'Castillo · Tercer curso', rooms: 12, lattice: [5, 4], from: 'secretaria', to: 'trono',
    fights: ['alumnos-3a', 'alumnos-3b', 'alumnos-3c'], elite: 'delegada-3', boss: 'reina', flag: 'reina',
    into: { environment: 'palacio-trono', cell: { x: 1, z: 16 } }, out: { environment: 'palacio-secretaria', cell: { x: 7, z: 1 } },
    bossAt: { x: 13, z: 7 }, bossRadius: 3.2,
  },
];
export const castlePhase = (id: CastlePhaseId | CastlePlace) => CASTLE_PHASES.find(p => p.id === id || p.environment === id)!;
/** The phase the party is on: the first whose boss still stands (3 once Dirección has fallen, the Queen's). */
export const castlePhaseAt = (flags: Flags): CastlePhaseId => flags.has('direccion') ? 3 : flags.has('aurelia') ? 2 : 1;
/**
 * The checkpoint (docs/castle.md § Structure): a boss beaten stays beaten, and from then on every
 * entry to the castle starts in that boss's room. None before Aurelià: the hall, as ever.
 */
export function castleEntry(flags: Flags): { environment: 'palacio-gimnasio' | 'palacio-secretaria'; cell: Cell } | undefined {
  if (flags.has('direccion')) return { environment: 'palacio-secretaria', cell: { x: 4, z: 19 } };
  if (flags.has('aurelia')) return { environment: 'palacio-gimnasio', cell: { x: 13, z: 16 } };
  return undefined;
}
/** What a fight inside the castle, and a rest in its staff room, cost of the day (docs/castle.md § To settle: one hour, proposed). */
export const CASTLE_FIGHT_HOURS = 1, CASTLE_REST_HOURS = 1;

// ——— What each boss opens ———————————————————————————————————————————————————————————————
/**
 * The three stages of growth (docs/animas/README.md § Growth opens with the castle). Slots: the
 * extra ánimas each can equip besides their own (two after Aurelià: three ánimas each, the most in
 * a fight). Cap: the level a shared ánima can reach (the game's own top level is lower than every
 * cap today, so it holds nothing back yet). The definitivas come with Dirección.
 */
export const CASTLE_UNLOCKS = {
  slots: { start: 1, aurelia: 2 },
  cap: { start: 4, aurelia: 6, direccion: 7 },
} as const;
export const extraSlots = (flags: Flags) => flags.has('aurelia') ? CASTLE_UNLOCKS.slots.aurelia : CASTLE_UNLOCKS.slots.start;
export const levelCap = (flags: Flags) => flags.has('direccion') ? CASTLE_UNLOCKS.cap.direccion : flags.has('aurelia') ? CASTLE_UNLOCKS.cap.aurelia : CASTLE_UNLOCKS.cap.start;
export const definitivasOpen = (flags: Flags) => flags.has('direccion');
/** Whose lights each boss gives when it falls: the Ecos de luz for the jar. */
export const CASTLE_LIGHTS = { aurelia: ['aurelia'], direccion: ['mar', 'montse', 'pilar'] } as const;

// ——— The generated floor ————————————————————————————————————————————————————————————————
/**
 * Kinds of room (docs/castle.md § The generated floor). `corridor`: a room with nobody in it (the
 * entry is one); `fight` and `elite`: pupils roam it (`encounter`); `rest` and `find`: side rooms;
 * `antechamber`: the last one, with the way into the boss's room.
 */
export type RoomKind = 'fight' | 'elite' | 'rest' | 'find' | 'corridor' | 'antechamber';
/**
 * A room: `rect` its floor, `cell` its centre, `onPath` whether it is on the main path, `order` how
 * far along that path it is (0 the entry, 1 the antechamber; a side room has its parent's): what its
 * art drifts by.
 */
export interface CastleRoom { id: number; kind: RoomKind; rect: Rect; cell: Cell; onPath: boolean; order: number; encounter?: RoomEncounter }
/**
 * A floor: `grid` in the game's own glyphs (`.` floor, `#` wall), `rooms` and the `halls` that join
 * them (two cells wide), `spawn` where the party comes in, `back` the way out behind it and `exit`
 * the way into the boss's room.
 */
export interface CastleFloor { phase: CastlePhaseId; seed: number; grid: string[]; rooms: CastleRoom[]; halls: Rect[]; spawn: Cell; back: Cell; exit: Cell }

/** The lattice's pitch in cells: a room of nine at most, and three of wall to the next. */
const PITCH = 12;
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The seed of a day's floor: the save, the day and the phase (docs/castle.md: the same all day, another the next). */
export const floorSeed = (seed: number, day: number, phase: CastlePhaseId) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(day + 1, 0xc2b2ae35) ^ Math.imul(phase, 0x27d4eb2f)) >>> 0;
/**
 * The floor of `phase` on `day` of the save `seed`: a main path of the phase's rooms from the entry
 * to the boss's antechamber over a coarse lattice, side rooms off it (the staff room, a find and,
 * from phase 2, one more fight), each room square or rectangular (5 to 9 cells a side) and joined
 * to the next by a corridor two cells wide. Pure: the same three numbers give the same floor.
 */
export function floorFor(seed: number, day: number, phase: CastlePhaseId): CastleFloor {
  const spec = castlePhase(phase), [gw, gh] = spec.lattice, own = floorSeed(seed, day, phase), random = mulberry(own);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const shuffled = <T>(list: readonly T[]) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  const key = (n: Cell) => n.x + n.z * gw, steps: Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  const around = (n: Cell) => steps.map(s => ({ x: n.x + s.x, z: n.z + s.z })).filter(c => c.x >= 0 && c.z >= 0 && c.x < gw && c.z < gh);
  // The main path: a walk that never crosses itself, from the bottom row, found by backtracking.
  const used = new Set<number>();
  function walk(path: Cell[]): Cell[] | undefined {
    if (path.length === spec.rooms) return path;
    for (const next of shuffled(around(path.at(-1)!))) {
      if (used.has(key(next))) continue;
      used.add(key(next));
      const done = walk([...path, next]);
      if (done) return done;
      used.delete(key(next));
    }
    return undefined;
  }
  let path: Cell[] | undefined;
  for (const x of shuffled(Array.from({ length: gw }, (_, i) => i))) {
    const start = { x, z: gh - 1 };
    used.clear(); used.add(key(start));
    path = walk([start]);
    if (path) break;
  }
  if (!path) throw new Error(`No path of ${spec.rooms} rooms on a ${gw}×${gh} lattice.`);
  // Who is on the path: the entry, then fights with a quiet room among them, La Delegada, the antechamber.
  const last = spec.rooms - 1, middle = Array.from({ length: last - 2 }, (_, i) => i + 1);
  const quiet = new Set(shuffled(middle).slice(0, spec.rooms >= 12 ? 2 : 1));
  const fights = shuffled(spec.fights);
  let fought = 0;
  const sizes = [5, 7, 9] as const;
  const centre = (n: Cell): Cell => ({ x: 6 + n.x * PITCH, z: 6 + n.z * PITCH });
  const rectAt = (n: Cell, w: number, d: number): Rect => ({ x: centre(n).x - (w - 1) / 2, z: centre(n).z - (d - 1) / 2, w, d });
  const rooms: CastleRoom[] = [], nodes: Cell[] = [], links: [number, number][] = [];
  const add = (node: Cell, kind: RoomKind, w: number, d: number, onPath: boolean, order: number, encounter?: RoomEncounter) => {
    rooms.push({ id: rooms.length, kind, rect: rectAt(node, w, d), cell: centre(node), onPath, order, ...encounter ? { encounter } : {} });
    nodes.push(node);
    return rooms.length - 1;
  };
  path.forEach((node, i) => {
    const order = i / last;
    if (i === 0) add(node, 'corridor', 5, 5, true, order);
    else if (i === last) add(node, 'antechamber', 5, 5, true, order);
    else if (i === last - 1) add(node, 'elite', 9, 9, true, order, spec.elite);
    else if (quiet.has(i)) { const long = random() < .5; add(node, 'corridor', long ? 9 : 5, long ? 5 : 9, true, order); }
    else add(node, 'fight', pick(sizes.slice(1)), pick(sizes.slice(1)), true, order, fights[fought++ % fights.length]);
    if (i) links.push([i - 1, i]);
  });
  // Side rooms off the path, never off its two ends: the staff room, a find and, from phase 2, one more fight.
  const sides: RoomKind[] = ['rest', 'find', ...phase >= 2 ? ['fight' as const] : []];
  for (const parent of shuffled(middle)) {
    if (!sides.length) break;
    const free = shuffled(around(path[parent])).find(n => !used.has(key(n)));
    if (!free) continue;
    used.add(key(free));
    const kind = sides.shift()!, order = rooms[parent].order;
    const id = kind === 'fight' ? add(free, kind, 7, 7, false, order, fights[fought++ % fights.length]) : add(free, kind, kind === 'rest' ? 7 : 5, 5, false, order);
    links.push([parent, id]);
  }
  // Corridors two cells wide, straight between the centres of two rooms next to each other on the lattice.
  const halls: Rect[] = links.map(([a, b]) => {
    const from = rooms[a].cell, to = rooms[b].cell;
    return from.z === to.z ? { x: Math.min(from.x, to.x), z: from.z, w: Math.abs(from.x - to.x) + 1, d: 2 } : { x: from.x, z: Math.min(from.z, to.z), w: 2, d: Math.abs(from.z - to.z) + 1 };
  });
  const W = gw * PITCH + 1, D = gh * PITCH + 1;
  const open = Array.from({ length: D }, () => Array.from({ length: W }, () => false));
  for (const r of [...rooms.map(room => room.rect), ...halls]) for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) open[z][x] = true;
  // A way in or out stands against the wall away from the room's one corridor, so nobody walks through it.
  const far = (id: number, towards: number): Cell => {
    const room = rooms[id], other = rooms[towards].cell, dx = Math.sign(room.cell.x - other.x), dz = Math.sign(room.cell.z - other.z);
    return { x: room.cell.x + dx * (room.rect.w - 1) / 2, z: room.cell.z + dz * (room.rect.d - 1) / 2 };
  };
  return {
    phase, seed: own, grid: open.map(row => row.map(cell => cell ? '.' : '#').join('')), rooms, halls,
    spawn: { ...rooms[0].cell }, back: far(0, 1), exit: far(last, last - 1),
  };
}
/** The room `cell` is in, if any (a corridor between two is none). */
export const roomAt = (floor: CastleFloor, cell: Cell) => floor.rooms.find(({ rect }) => cell.x >= rect.x && cell.z >= rect.z && cell.x < rect.x + rect.w && cell.z < rect.z + rect.d);
/** The round its pupils walk in a room: its four corners, a cell in from the walls. */
export const roomRound = ({ rect }: CastleRoom): Cell[] => [
  { x: rect.x + 1, z: rect.z + 1 }, { x: rect.x + rect.w - 2, z: rect.z + 1 }, { x: rect.x + rect.w - 2, z: rect.z + rect.d - 2 }, { x: rect.x + 1, z: rect.z + rect.d - 2 },
];
/** The id of a room's pupils as the story and the game name them (`near` events, chasers). */
export const roomId = (room: CastleRoom) => `castillo-sala-${room.id}`;

// ——— The fights ————————————————————————————————————————————————————————————————————————
/**
 * The Queen's pupils (docs/castle.md § Bestiary), gum in the shape of a pupil. Five of the eight
 * are built: El Repetidor, El Empollón, La Chivata, Los Gemelos (two `gemelo`) and La Delegada.
 */
export type PupilKind = 'repetidor' | 'empollon' | 'chivata' | 'gemelo' | 'delegada';
/**
 * Everyone who fights in the castle. `atril` and `mano` are things with their own PV that never
 * take a turn and never hold up the win: Aurelià's lectern, the Queen's two hands. `directiva` is
 * each of Mar, Montse and Pilar.
 */
export type CastleKind = PupilKind | 'aurelia' | 'atril' | 'directiva' | 'reina' | 'mano';
export const CASTLE_KINDS = ['repetidor', 'empollon', 'chivata', 'gemelo', 'delegada', 'aurelia', 'atril', 'directiva', 'reina', 'mano'] as const satisfies readonly CastleKind[];
export const isCastle = (kind?: string): kind is CastleKind => !!kind && (CASTLE_KINDS as readonly string[]).includes(kind);
export const CASTLE_NAMES: Record<CastleKind, string> = {
  repetidor: 'El Repetidor', empollon: 'El Empollón', chivata: 'La Chivata', gemelo: 'Gemelo', delegada: 'La Delegada',
  aurelia: 'Aurelià', atril: 'El Atril', directiva: 'Dirección', reina: 'La Reina Bubbaloo', mano: 'Mano',
};
/** Who comes out in each room's fight, in the order they stand. */
export const CASTLE_FIGHTS: Record<RoomEncounter, readonly PupilKind[]> = {
  'alumnos-1a': ['chivata', 'repetidor'],
  'alumnos-1b': ['empollon', 'chivata'],
  'alumnos-1c': ['gemelo', 'gemelo'],
  'delegada-1': ['delegada', 'gemelo', 'gemelo'],
  'alumnos-2a': ['chivata', 'repetidor', 'empollon'],
  'alumnos-2b': ['empollon', 'empollon', 'chivata'],
  'alumnos-2c': ['gemelo', 'gemelo', 'repetidor'],
  'delegada-2': ['delegada', 'gemelo', 'gemelo', 'chivata'],
  'alumnos-3a': ['chivata', 'chivata', 'repetidor'],
  'alumnos-3b': ['empollon', 'repetidor', 'chivata'],
  'alumnos-3c': ['gemelo', 'gemelo', 'empollon'],
  'delegada-3': ['delegada', 'gemelo', 'gemelo'],
};
/** Each fight by name, for the development picker (src/jump-menu.ts). */
export const CASTLE_FIGHT_NAMES: Record<CastleEncounter, string> = {
  'alumnos-1a': 'Chivata y Repetidor · 1.º', 'alumnos-1b': 'Empollón y Chivata · 1.º', 'alumnos-1c': 'Los Gemelos · 1.º', 'delegada-1': 'La Delegada · 1.º',
  'alumnos-2a': 'Chivata, Repetidor y Empollón · 2.º', 'alumnos-2b': 'Empollones y Chivata · 2.º', 'alumnos-2c': 'Gemelos y Repetidor · 2.º', 'delegada-2': 'La Delegada · 2.º',
  'alumnos-3a': 'Chivatas y Repetidor · 3.º', 'alumnos-3b': 'Empollón, Repetidor y Chivata · 3.º', 'alumnos-3c': 'Gemelos y Empollón · 3.º', 'delegada-3': 'La Delegada · 3.º',
  aurelia: 'Aurelià', direccion: 'El Equipo de dirección', reina: 'La Reina Bubbaloo', 'reina-vuelta': 'La Reina, con el artilugio',
};
/** A pupil's year (docs/castle.md § Three years): fresh gum, gum with a filling, rancid gum. */
export type Year = 1 | 2 | 3;
export const yearOf = (encounter: string): Year => (Number(/-(\d)/.exec(encounter)?.[1]) || 1) as Year;
/** The phase a castle fight belongs to: a room's by its year, each boss's own. */
export const castlePhaseOf = (encounter: CastleEncounter): CastlePhaseId => encounter === 'aurelia' ? 1 : encounter === 'direccion' ? 2 : encounter === 'reina' || encounter === 'reina-vuelta' ? 3 : yearOf(encounter);
export const YEARS: Record<Year, string> = { 1: 'Fresco', 2: 'Con relleno', 3: 'Rancio' };
/** How big each stands, against the palace minion they are drawn from for now (placeholders: none has a model of its own yet). */
export const CASTLE_SIZES: Record<CastleKind, number> = { repetidor: 1.15, empollon: .8, chivata: .62, gemelo: .7, delegada: .95, aurelia: 1.35, atril: .55, directiva: 1.1, reina: 2.3, mano: 1.25 };
/** The management team, in the order they stand and act, and the element each starts with. */
export const DIRECTIVAS = [
  { id: 'mar', name: 'Mar', element: 'fuego' },
  { id: 'montse', name: 'Montse', element: 'agua' },
  { id: 'pilar', name: 'Pilar', element: 'electrico' },
] as const satisfies readonly { id: string; name: string; element: Element }[];
/** What undoes each element's holder: water on fire, a spark on water, fire on a wire. */
export const UNDOES: Record<Element, Element> = { fuego: 'agua', agua: 'electrico', electrico: 'fuego' };
/** The Queen's gum, layer by layer, and what takes each off: fire while fresh, a blow once rancid, a spark while wet. */
export const GUM = { fresco: 'Chicle fresco', rancio: 'Chicle rancio', mojado: 'Chicle mojado' } as const;
export type Gum = keyof typeof GUM;
export const GUM_ORDER: readonly Gum[] = ['fresco', 'rancio', 'mojado'];
/**
 * The castle's rules, every number in one book (`castle.rules`, `just fight-sim --tune`); each
 * foe's PV are its PROFILES entry. First guesses, all of them.
 *
 * Pupils. `year`: how much harder a year hits and holds than the first. El Repetidor announces its
 * Empujón (`empujon`) a turn ahead; in its third year its crust takes `crust` blows to break and lets
 * `crusted` of anything else in. El Empollón resists the kind of blow it took last (`learned` of
 * it) and hits `repaso`. La Chivata's mark makes the next blow on whoever carries it land `chivatazo`
 * times as hard; her own is `senalar`. A Gemelo hits `gemelo` and gets its twin up with `levantar` of
 * its PV. La Delegada hits `orden`; a filling's element lands as ELEMENT_RULES says.
 *
 * Aurelià. Phases at `carrera` and `recta` of his PV. With El Atril standing he takes `atril` of
 * everything. Dictado `dictado` on everyone, Pregunta `pregunta` on one (answered by holding on, the
 * next blow on him lands `expuesto` times as hard), Castigo `castigo` on whoever repeated a kind of
 * blow (`castigoLeve` if nobody did). La carrera: a lap of `vuelta` seconds, then a Sprint `sprint`
 * on everyone and `ritmo` more Fuerza for good. La última recta: Expulsión `expulsion` and
 * `expulsado` rounds out; Récord `record` on everyone after `recordRounds` rounds of charge.
 *
 * Dirección. Expediente `expediente` on one and a fire; Horario wets everyone (`horario`); Circular
 * `circular` on everyone, `conducida` times as hard on the wet. Every `actaEvery` rounds each signs
 * instead; three signatures are a Resolución, `resolucion` on everyone. Every `cargoEvery` rounds
 * they trade elements. The last one standing hits `voto` times as hard.
 *
 * La Reina. Phases at `manos`, `pompa` and `toma` of her PV. A layer of gum lets `gum` of anything
 * in but what takes it off; she wraps herself again every `envolver` own turns. Pegote `pegote` on
 * one. Each hand standing takes `mano` off what reaches her; Aplastar `aplastar`. La Pompa: `pompaHp`
 * PV off her while she blows it burst it, or after `pompaRounds` rounds it is `pompa` on everyone.
 * With Aitor held, his blow on Gerard is `aitor`, and `aitorGrows` more of it each turn she has him. On
 * her way back she has `reinaVuelta` of her PV.
 */
export const CASTLE = {
  year2: 1.25, year3: 1.25,
  empujon: 46, crust: 2, crusted: .3, repaso: 24, learned: .3, chivatazo: 3, senalar: 12, gemelo: 20, levantar: .5, orden: 22,
  carrera: .65, recta: .3, atril: .5, dictado: 22, pregunta: 52, expuesto: 1.5, castigo: 40, castigoLeve: 16,
  vuelta: 20, sprint: 24, ritmo: 2, expulsion: 30, expulsado: 2, record: 70, recordRounds: 2,
  expediente: 18, horario: 6, circular: 12, conducida: 1.8, actaEvery: 3, resolucion: 90, cargoEvery: 4, voto: 1.3,
  manos: .7, pompa: .4, toma: .1, gum: .25, envolver: 3, pegote: 34, mano: .25, aplastar: 26,
  pompaHp: 90, pompaRounds: 3, pompaBlow: 80, aitor: 30, aitorGrows: .35, reinaVuelta: .4,
};
/** How much of her PV the Queen has when the party comes back with the artilugio (docs/castle-bosses.md: 40 %, proposed). */
export const QUEEN_RETURN_HP = CASTLE.reinaVuelta;
/**
 * The artilugio (docs/story-outline.md § The device): four buttons, red, yellow, green and blue
 * (0–3), and four pairs pressed together (notes 4–7), the eight notes of G Phrygian dominant from G
 * to G. Alone the buttons play the G7 chord; each pair, two neighbours on the ring, plays the scale's
 * note between its two buttons. firmware/artilugio/notes.h holds the same table (a test checks it).
 */
export const ARTILUGIO_BUTTONS = 4;
/** The pairs that play a note of their own, in note order from 4: red + yellow, yellow + green, green + blue, blue + red. */
export const ARTILUGIO_PAIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 3], [3, 0]];
/** The eight notes (Hz): Sol, Si, Re, Fa alone; La♭, Do, Mi♭ and the Sol above in pairs. */
export const ARTILUGIO_NOTES: readonly number[] = [392.00, 493.88, 587.33, 698.46, 415.30, 523.25, 622.25, 783.99];
/** The note one press plays: a button alone, or a pair of the table; any other two sound the first one. */
export function artilugioNote(buttons: readonly number[]): number {
  const [a, b] = buttons;
  if (b === undefined || a === b) return a;
  const pair = ARTILUGIO_PAIRS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return pair < 0 ? a : ARTILUGIO_BUTTONS + pair;
}
/** The buttons that light for a note: one alone, two for a pair. */
export const artilugioButtons = (note: number): readonly number[] => note < ARTILUGIO_BUTTONS ? [note] : ARTILUGIO_PAIRS[note - ARTILUGIO_BUTTONS];
/**
 * The melody (Aitor, 2026-11-19): Sol · La♭ · Do · Sol (up) · Fa · Re, the motif the whole game has
 * been humming. Three of its notes are pairs, so it cannot be played without finding them.
 */
export const MELODY: readonly number[] = [0, 4, 5, 7, 3, 2];

/** Aurelià's three phases and the Queen's four, as their plates name them. */
export const AURELIA_PHASES = { leccion: 'La lección', carrera: 'La carrera', recta: 'La última recta' } as const;
export type AureliaPhase = keyof typeof AURELIA_PHASES;
export const REINA_PHASES = { chicle: 'El chicle', manos: 'Las manos', pompa: 'La pompa', aitor: 'Aitor' } as const;
export type ReinaPhase = keyof typeof REINA_PHASES;
/**
 * What the castle's rules keep on a fighter (`Combatant.castle`), plain data.
 * A pupil: its `year`, the `filling` of its second (the element it is weak to), what El Empollón
 * `learned`, El Repetidor's `crust` left, a Gemelo's `twin` (an id). Anyone: `seen`, their PV when
 * last looked at (what tells a blow landed). One of the party: `marked` by La Chivata, the kinds of
 * their last blows (`blows`, for Castigo), rounds still `expelled`, `held` by a hand (its id) or by
 * the Queen.
 * Aurelià: his `phase`, seconds left of his `lap`, the clock statuses already on him (`clocks`) and
 * the one that last tripped him (`tripped`), `exposed` after a question answered, rounds of `record`
 * still to charge. A directiva: the `elements` she holds, and whether she `signed` this Acta.
 * The Queen: her `stage`, the `gum` on her, own turns since she last wrapped herself (`wrapped`), and
 * La Pompa being blown (`pompa`: rounds left, and her PV when she began).
 */
export interface CastleMark {
  year?: Year; filling?: Element; learned?: 'physical' | 'magic'; crust?: number; twin?: string; seen?: number;
  /** A Gemelo brought down alone: held up by its twin at 1 PV until the round ends. `found`: a blow has found what this one is weak to. `told`: its fall has been dealt with. */
  down?: boolean; found?: boolean; told?: boolean;
  /** It loses its next turn (the Queen, her Pompa burst or startled by a note). */
  stunned?: boolean;
  marked?: boolean; blows?: { round: number; kind: 'physical' | 'magic' }[]; expelled?: number; held?: string;
  phase?: AureliaPhase; lap?: number; clocks?: TimedId[]; tripped?: TimedId; exposed?: boolean; record?: number;
  elements?: Element[]; signed?: boolean;
  stage?: ReinaPhase | 'libre'; gum?: Gum; last?: Gum; wrapped?: number; pompa?: { left: number; from: number };
}
/**
 * What the castle's rules keep on the fight (`BattleState.castle`). La Delegada's `focus` (whom hers
 * all strike this round). Dirección: signatures on the Acta now (`firmas`), the round they last traded
 * elements (`cargo`). The Queen: whether the party carries the `artilugio`, the melody's notes got
 * right so far (`notes`), whether its first note has startled her (`startled`), whether she took
 * Aitor (`taken`: what the story reads when the fight is lost) and whether he is free again (`freed`).
 */
export interface CastleFight { focus?: string; firmas?: number; cargo?: number; artilugio?: boolean; notes?: number; startled?: boolean; taken?: boolean; freed?: boolean; /** What the round's end had to say, for the next round's message. */ said?: string }

/** Moments of the castle's fights the picker can jump to (docs/dev-tools.md), a `FightMoment` each. */
export const CASTLE_MOMENTS = {
  'aurelia-leccion': { label: 'La lección', encounter: 'aurelia' },
  'aurelia-carrera': { label: 'La carrera', encounter: 'aurelia' },
  'aurelia-recta': { label: 'La última recta', encounter: 'aurelia' },
  'direccion-tres': { label: 'Las tres: Acta', encounter: 'direccion' },
  'direccion-dos': { label: 'Quedan dos', encounter: 'direccion' },
  'direccion-una': { label: 'Voto de calidad', encounter: 'direccion' },
  'reina-chicle': { label: 'El chicle', encounter: 'reina-vuelta' },
  'reina-manos': { label: 'Las manos', encounter: 'reina-vuelta' },
  'reina-pompa': { label: 'La pompa', encounter: 'reina-vuelta' },
  'reina-aitor': { label: 'Tiene a Aitor', encounter: 'reina-vuelta' },
} as const satisfies Record<string, { label: string; encounter: CastleEncounter }>;
export type CastleMoment = keyof typeof CASTLE_MOMENTS;
export const isCastleMoment = (id: string): id is CastleMoment => id in CASTLE_MOMENTS;
