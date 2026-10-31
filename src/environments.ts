import type { Cell } from './movement';
import type { GeoScene } from './geo';
import ALEGIA_SCENE from './geo/alegia.json' with { type: 'json' };
import MERIDIANA_CALLE_SCENE from './geo/meridiana-calle.json' with { type: 'json' };
import REC_COMTAL_SCENE from './geo/rec-comtal.json' with { type: 'json' };
import CARDEDEU_SCENE from './geo/cardedeu.json' with { type: 'json' };
import CARDEDEU_MAZE_SCENE from './geo/cardedeu-laberinto.json' with { type: 'json' };
import SANTS_SCENE from './geo/sants.json' with { type: 'json' };
import { towerGrid } from './tower.ts';

export type EnvironmentId = 'patio' | 'maresme' | 'home-entrance' | 'home-floor-1' | 'home-floor-2' | 'meridiana' | 'palacio' | 'alegia'
  | 'meridiana-calle' | 'rec-comtal' | 'cardedeu' | 'cardedeu-laberinto' | 'sants' | 'el-nucli';
export interface Rect { x: number; z: number; w: number; d: number }
export interface House extends Rect { id: string; side: 'west' | 'east'; number?: number; solar?: boolean; pool?: boolean }
/** Tree shapes shared by every scene: street plane trees, garden olives, slim cypresses and a potted yucca. */
export type TreeSpecies = 'plane' | 'olive' | 'cypress' | 'yucca';
/** What the trunk stands in: a paved street pit (default), an indoor pot, or bare ground. */
export type TreeBase = 'pit' | 'pot' | 'ground';
/** Reusable scene pieces, anchored on a cell. `src/props.ts` draws them in any environment. */
/** `yaw` (degrees) turns a one-cell prop's front (+z) towards a road; the build sets it for benches, lamps and lights. */
export type WorldProp =
  /** `stakes`: a young tree held by three wooden stakes; `trunk`: bark colour (Barcelona's pale plane trees). */
  | { kind: 'tree'; x: number; z: number; species?: TreeSpecies; scale?: number; base?: TreeBase; stakes?: boolean; trunk?: string }
  /** A car spans its anchor and the next cell along +z, or along +x with `along: 'x'`. */
  | { kind: 'car'; x: number; z: number; color: string; along?: 'x' | 'z' }
  /** `led`: a tall, slim grey pole with a small white LED head, as on the renewed Meridiana. */
  | { kind: 'lamp'; x: number; z: number; style?: 'classic' | 'led'; yaw?: number }
  | { kind: 'manhole'; x: number; z: number }
  /**
   * A station entrance: a totem with the metro's red M (or Rodalies' orange R), the line and the
   * station's `name`, beside a stair going down over the next three cells along +x.
   */
  | { kind: 'metro'; x: number; z: number; network?: 'metro' | 'rodalies'; name?: string; line?: string }
  /** Wooden slats on a grey metal frame: a long bench or a single chair. */
  | { kind: 'bench'; x: number; z: number; style?: 'bench' | 'chair'; yaw?: number }
  /** Street works: a red or white plastic jersey barrier, a yellow fence panel or a metal crowd barrier. */
  | { kind: 'barrier'; x: number; z: number; color?: 'red' | 'white'; style?: 'jersey' | 'panel' | 'fence'; yaw?: number }
  /** A white sack of rubble from the works. */
  | { kind: 'bag'; x: number; z: number }
  | { kind: 'bin'; x: number; z: number }
  /** A steel hoop with a bike locked to it. */
  | { kind: 'bike-rack'; x: number; z: number; yaw?: number }
  /** A traffic light with yellow housings on a curved pole, and a pedestrian light lower down. */
  | { kind: 'traffic-light'; x: number; z: number; yaw?: number }
  /** A bus shelter with a yellow roof and seat; three cells along +x. */
  | { kind: 'shelter'; x: number; z: number }
  /** A city bus (TMB red, Sagalés white) stopped along +x, five cells long. */
  | { kind: 'bus'; x: number; z: number; color: string; livery?: 'tmb' | 'sagales' }
  /** A works hoarding of corrugated metal covered in graffiti, `length` cells along +x. */
  | { kind: 'hoarding'; x: number; z: number; length: number };
export type PropKind = WorldProp['kind'];
const along = (n: number): Cell[] => Array.from({ length: n }, (_, x) => ({ x, z: 0 }));
/** Cells each kind blocks, relative to its anchor; visuals are built on the same footprint. */
export const PROP_FOOTPRINTS: Record<PropKind, readonly Cell[]> = {
  tree: [{ x: 0, z: 0 }],
  car: [{ x: 0, z: 0 }, { x: 0, z: 1 }],
  lamp: [{ x: 0, z: 0 }],
  manhole: [],
  metro: [{ x: 0, z: 0 }],
  bench: [{ x: 0, z: 0 }],
  barrier: [{ x: 0, z: 0 }],
  bag: [{ x: 0, z: 0 }],
  bin: [{ x: 0, z: 0 }],
  'bike-rack': [{ x: 0, z: 0 }],
  'traffic-light': [{ x: 0, z: 0 }],
  shelter: along(3),
  bus: along(5),
  hoarding: along(1),
};
export function propCells(prop: WorldProp): Cell[] {
  if (prop.kind === 'hoarding') return along(prop.length).map(o => ({ x: prop.x + o.x, z: prop.z }));
  const turned = prop.kind === 'car' && prop.along === 'x';
  return PROP_FOOTPRINTS[prop.kind].map(offset => turned ? { x: prop.x + offset.z, z: prop.z + offset.x } : { x: prop.x + offset.x, z: prop.z + offset.z });
}
/** Marks every prop footprint as solid, so hand-drawn and generated maps place props alike. */
export function blockProps(grid: readonly string[], props: readonly WorldProp[]): string[] {
  const cells = grid.map(row => [...row]);
  for (const cell of props.flatMap(propCells)) {
    if (!cells[cell.z] || cells[cell.z][cell.x] === undefined) throw new Error(`Prop outside the map at ${cell.x},${cell.z}`);
    cells[cell.z][cell.x] = '#';
  }
  return cells.map(row => row.join(''));
}
export interface Interaction {
  id: string;
  cell: Cell;
  label: string;
  /** Optional short caption for an action the object alone does not explain. */
  hint?: string;
  /** Visual anchor in grid coordinates, when the action is reached from a different cell. */
  anchor?: Cell & { y: number };
  /** Doors and stairs: where the interaction takes Gerard. */
  to?: { environment: EnvironmentId; cell: Cell };
  /** What Gerard says when looking at something. */
  lines?: string[];
  /** Stairs: walking into these cells uses the interaction, no key needed (a door travels; a station's stair goes down to the map). */
  step?: Rect;
}
export type FloorKind = 'tile' | 'stone' | 'deck' | 'gravel' | 'grass' | 'concrete' | 'laminate' | 'terracotta' | 'hydraulic' | 'terrazzo';
/** A named area of a floor plan; `level` raises its floor, e.g. a deck or a stair landing. */
export interface Room extends Rect { name: string; floor: FloorKind; level?: number }
/** A flight of steps over a rectangle, climbing `from` → `to` towards `up`. */
export interface Stairs extends Rect { up: 'north' | 'east'; from: number; to: number }
export interface Environment {
  id: EnvironmentId;
  name: string;
  grid: string[];
  spawn: Cell;
  houses: House[];
  props: WorldProp[];
  interactions: Interaction[];
  /** Follow-camera zoom (orthographic half-height); without it the camera frames the whole map. */
  zoom?: number;
  /** Interiors: the drawn floor plan the grid comes from (see PLAN_GLYPHS), its rooms and steps. */
  plan?: string[];
  rooms?: Room[];
  stairs?: Stairs[];
  /** La Reina Bubbaloo's palace: a plan in PALACE_GLYPHS, built by `src/palace-scenery.ts`. */
  palace?: { plan: string[]; rooms: Room[] };
  /** A real place generated from map data (tools/geo.py), drawn by `src/geo-scenery.ts`. */
  geo?: GeoScene;
}

export const COURTYARD_ROWS = [
  '#############', '#...........#', '#..#.....#..#', '#..#.....#..#',
  '#..###...#..#', '#...........#', '#.....##....#', '#..#.....#..#',
  '#..#.....#..#', '#..#..G..#..#', '#...........#', '#...........#', '#############',
];
const COURTYARD_PROPS: WorldProp[] = [
  { kind: 'tree', x: 1, z: 1, species: 'cypress' }, { kind: 'tree', x: 11, z: 1, species: 'cypress' },
  { kind: 'tree', x: 6, z: 11, species: 'olive', scale: 0.85 },
];
export const COURTYARD: Environment = {
  id: 'patio', name: 'El patio', grid: blockProps(COURTYARD_ROWS, COURTYARD_PROPS), spawn: { x: 6, z: 9 },
  houses: [], props: COURTYARD_PROPS, interactions: [],
};

/** Approximate reference-derived blockout, not a cadastral or surveyed map.
 * Local +z follows the long street; coordinates are gameplay cells, not metres.
 * Edit footprints/props here, or replace the builder with an imported GLB;
 * collision and interaction data remain independent from the artwork.
 */
function createNeighborhood(): Environment {
  const cells = Array.from({ length: 43 }, () => Array<string>(37).fill('#'));
  const carve = ({ x, z, w, d }: Rect) => {
    for (let rz = z; rz < z + d; rz++) for (let rx = x; rx < x + w; rx++) cells[rz][rx] = '.';
  };
  carve({ x: 9, z: 2, w: 13, d: 39 });
  carve({ x: 8, z: 2, w: 17, d: 5 }); // widened end of the passage
  const houses: House[] = [];
  for (let i = 0; i < 7; i++) {
    const z = 7 + i * 5;
    houses.push({ id: i === 3 ? 'bernat' : `west-${i}`, side: 'west', x: 1, z, w: 7, d: 5, solar: i % 3 === 1 });
    houses.push({ id: i === 3 ? 'gerard' : `east-${i}`, side: 'east', x: 30, z, w: 6, d: 5, number: 26 - i * 2, solar: i % 3 === 2, pool: i === 1 || i === 5 });
    // Bernat's front patio opens onto the street. Gerard's plot is closed: its street wall
    // leads straight into the open-air entrance of his house.
    if (i === 3) carve({ x: 8, z: z + 2, w: 3, d: 1 });
  }
  // The north end stays clear: the palace's gate rises there (src/palace.ts).
  const props: WorldProp[] = [];
  for (const z of [9, 15, 20, 29, 35, 39]) {
    props.push({ kind: 'tree', x: 10, z }, { kind: 'tree', x: 21, z: z - 1 });
  }
  // Courtyards reuse the same trees: an olive on a lawn, cypresses beside a pool, clear of the garage.
  for (const house of houses) {
    if (house.side !== 'east' || house.id === 'gerard') continue;
    if (house.pool) props.push({ kind: 'tree', x: 23, z: house.z, species: 'cypress', base: 'ground' }, { kind: 'tree', x: 23, z: house.z + 1, species: 'cypress', base: 'ground' });
    else props.push({ kind: 'tree', x: 24, z: house.z + 1, species: 'olive', scale: 0.7, base: 'ground' });
  }
  const colors = ['#d8d6c7', '#66808c', '#b95641', '#e4dfd2', '#353f44'];
  for (const [i, z] of [9, 15, 20, 28, 34, 39].entries()) {
    props.push({ kind: 'car', x: 12, z, color: colors[i % colors.length] });
    if (i % 2 === 0) props.push({ kind: 'car', x: 19, z: z + 1, color: colors[(i + 1) % colors.length] });
  }
  // An olive in a pot in Gerard's open-air patio, seen over the street wall.
  props.push({ kind: 'tree', x: 25, z: 23, species: 'olive', scale: 0.7, base: 'pot' });
  for (const z of [11, 27, 36]) props.push({ kind: 'lamp', x: 21, z });
  for (const [x, z] of [[14, 13], [17, 30], [15, 38]]) props.push({ kind: 'manhole', x, z });
  return {
    id: 'maresme', name: 'Passatge Maresme', grid: blockProps(cells.map(row => row.join('')), props),
    spawn: { x: 20, z: 24 }, houses, props, zoom: 10.5,
    interactions: [
      { id: 'enter-home', cell: { x: 21, z: 23 }, label: 'Entrar en casa de Gerard', to: { environment: 'home-entrance', cell: { x: 2, z: 2 } } },
      { id: 'call-bernat', cell: { x: 8, z: 24 }, label: 'Llamar a Bernat', hint: 'Llamar a Bernat' },
    ],
  };
}
export const NEIGHBORHOOD = createNeighborhood();
/**
 * Gerard's house, drawn from the family's hand sketch: an open-air entrance, floor 1 and floor 2.
 * North is up, as on the sketch; the camera looks from the south-east, so north and west walls
 * stay tall and the others fold away around Gerard. `src/home-scenery.ts` builds the looks.
 */
export const PLAN_GLYPHS = {
  '.': 'suelo', '+': 'paso o puerta abierta', '^': 'escalones',
  '#': 'muro', 'W': 'muro con ventana', 'D': 'puerta cerrada', 'G': 'cristalera',
  'o': 'mueble', '/': 'bajo el tramo superior', '_': 'hueco de la escalera', '=': 'barandilla', ' ': 'exterior',
} as const;
const WALKABLE_GLYPHS = new Set(['.', '+', '^']);
export function planGrid(plan: readonly string[]): string[] {
  return plan.map(row => [...row].map(glyph => WALKABLE_GLYPHS.has(glyph) ? '.' : '#').join(''));
}
function house(environment: Omit<Environment, 'grid' | 'houses'> & { plan: string[] }): Environment {
  return { ...environment, houses: [], grid: blockProps(planGrid(environment.plan), environment.props) };
}
const HOME_ZOOM = 6.2;
export const HOME_ENTRANCE = house({
  id: 'home-entrance', name: 'Casa de Gerard · Entrada', spawn: { x: 2, z: 2 }, zoom: HOME_ZOOM,
  plan: [
    '####################',
    '#........^^^.ooo...#',
    'D........^^^.......D',
    '#........^^^.......#',
    '#######..###....o..#',
    '#ooooo#.........oo.G',
    'Dooooo#.........oo.G',
    'Dooooo#.........oo.G',
    'Dooooo#.........o..#',
    'Dooooo#....#########',
    '#ooooo#....#        ',
    '############        ',
  ],
  rooms: [
    { name: 'Entrada', x: 1, z: 1, w: 8, d: 3, floor: 'stone' },
    { name: 'Garaje', x: 1, z: 5, w: 5, d: 6, floor: 'concrete' },
    { name: 'Patio', x: 7, z: 5, w: 4, d: 6, floor: 'gravel' },
    { name: 'Patio 2', x: 12, z: 1, w: 7, d: 8, floor: 'deck', level: 0.54 },
    // No wall between the patios: the terrace simply ends and Gerard can hop down.
    { name: 'Borde de la terraza', x: 11, z: 5, w: 1, d: 4, floor: 'deck', level: 0.54 },
  ],
  stairs: [{ x: 9, z: 1, w: 3, d: 3, up: 'east', from: 0, to: 0.54 }],
  props: [
    { kind: 'tree', x: 9, z: 7, species: 'olive', scale: 0.8, base: 'pot' },
    { kind: 'tree', x: 17, z: 1, species: 'olive', scale: 0.7, base: 'pot' },
    { kind: 'tree', x: 12, z: 8, species: 'cypress', scale: 0.7, base: 'pot' },
  ],
  interactions: [
    { id: 'leave-home', cell: { x: 1, z: 2 }, label: 'Salir a Passatge Maresme', to: { environment: 'maresme', cell: { x: 20, z: 23 } } },
    { id: 'enter-hall', cell: { x: 18, z: 2 }, label: 'Entrar en casa', to: { environment: 'home-floor-1', cell: { x: 2, z: 1 } } },
    { id: 'enter-living', cell: { x: 18, z: 6 }, label: 'Pasar al salón por la cristalera', to: { environment: 'home-floor-1', cell: { x: 2, z: 10 } } },
  ],
});
export const HOME_FLOOR_1 = house({
  id: 'home-floor-1', name: 'Casa de Gerard · Planta 1', spawn: { x: 2, z: 1 }, zoom: HOME_ZOOM,
  plan: [
    '###WW########W###WWW#######',
    'D........#..#oo#.ooo.#....#',
    '#........#^^#..#.....W....#',
    '######...#^^#..#.....W....#',
    '#o...#...#^/#..#.....#....#',
    'W........#^/#.o#....o#....#',
    'Woooo....#^/#..#.....#....#',
    '#........#+##+###+####..oo#',
    '#.oo..oo.+...........G..oo#',
    'G.....oo.+...oooo....+....#',
    'G.....oo.#...oooo....+....#',
    '#........#...........G....#',
    '###########################',
  ],
  rooms: [
    { name: 'Recibidor', x: 1, z: 1, w: 8, d: 2, floor: 'tile' },
    { name: 'Salón', x: 1, z: 3, w: 8, d: 9, floor: 'tile' },
    { name: 'Rellano', x: 10, z: 1, w: 2, d: 1, floor: 'tile', level: 1.32 },
    { name: 'Escalera', x: 10, z: 2, w: 2, d: 6, floor: 'tile' },
    { name: 'Baño', x: 13, z: 1, w: 2, d: 6, floor: 'tile' },
    { name: 'Estudio', x: 16, z: 1, w: 5, d: 6, floor: 'tile' },
    { name: 'Cocina', x: 10, z: 8, w: 11, d: 4, floor: 'tile' },
    { name: 'Jardín', x: 22, z: 1, w: 4, d: 11, floor: 'grass' },
  ],
  props: [
    { kind: 'tree', x: 23, z: 3, species: 'olive', scale: 0.9, base: 'ground' },
    { kind: 'tree', x: 25, z: 1, species: 'cypress', base: 'ground' },
    { kind: 'tree', x: 25, z: 11, species: 'cypress', scale: 0.9, base: 'ground' },
  ],
  interactions: [
    { id: 'leave-hall', cell: { x: 1, z: 1 }, label: 'Salir al patio', to: { environment: 'home-entrance', cell: { x: 17, z: 2 } } },
    { id: 'leave-living', cell: { x: 1, z: 9 }, label: 'Volver al patio 2', to: { environment: 'home-entrance', cell: { x: 18, z: 6 } } },
    { id: 'stairs-up', cell: { x: 10, z: 1 }, label: 'Subir a la planta 2', step: { x: 11, z: 2, w: 1, d: 2 }, to: { environment: 'home-floor-2', cell: { x: 12, z: 6 } } },
  ],
});
/** Gerard's shelves: four bays along the north wall of his room, each one a thing to look at. */
const SHELF_LINES: [string, string, string[]][] = [
  ['shelf-egypt', 'Mirar los dioses egipcios', ['Anubis, Horus, Bastet… y un Tutankamón que brilla más que yo.', 'Los tengo ordenados para que se vigilen entre ellos.']],
  ['shelf-minerals', 'Mirar los minerales', ['Amatista, cuarzo, malaquita… y pirita, el oro de los tontos.', 'La geoda la abrí yo mismo. Casi me dejo un dedo.']],
  ['shelf-magic', 'Mirar las cartas de Magic', ['Un mazo por color: blanco, azul, negro, rojo y verde.', 'El dado de veinte caras dice que hoy gano yo.']],
  ['shelf-more', 'Mirar el resto de la estantería', ['Libros, un globo terráqueo y un trofeo que no pienso explicar.']],
];
export const HOME_FLOOR_2 = house({
  id: 'home-floor-2', name: 'Casa de Gerard · Planta 2', spawn: { x: 12, z: 6 }, zoom: HOME_ZOOM - 0.6,
  plan: [
    '##############W###WW##',
    '#ooooooo#____#oo#ooo.#',
    'W.......#____#..#.oo.#',
    'W.......#____#..#....#',
    '#.....o.#__^^#.o#....#',
    '#o......#==..#+###+###',
    '#o......+............#',
    '#ooooooo#............#',
    '###########+#####+####',
    '        #...oo#...oo.#',
    '        Wo....#...oo.#',
    '        #oo...#......#',
    '        #oo...#o.....#',
    '        #oo...#o.....#',
    '        Wo....#......#',
    '        #.....########',
    '        #######       ',
  ],
  rooms: [
    { name: 'Habitación de Gerard', x: 1, z: 1, w: 7, d: 7, floor: 'tile' },
    { name: 'Baño', x: 14, z: 1, w: 2, d: 4, floor: 'tile' },
    { name: 'Otra habitación', x: 17, z: 1, w: 4, d: 4, floor: 'tile' },
    { name: 'Pasillo', x: 9, z: 5, w: 12, d: 3, floor: 'tile' },
    { name: 'Habitación de los padres', x: 9, z: 9, w: 5, d: 7, floor: 'tile' },
    { name: 'Habitación de Jan', x: 15, z: 9, w: 6, d: 6, floor: 'tile' },
  ],
  props: [{ kind: 'tree', x: 20, z: 7, species: 'olive', scale: 0.55, base: 'pot' }],
  interactions: [
    { id: 'stairs-down', cell: { x: 11, z: 5 }, label: 'Bajar a la planta 1', step: { x: 11, z: 4, w: 2, d: 1 }, to: { environment: 'home-floor-1', cell: { x: 10, z: 1 } } },
    ...SHELF_LINES.map(([id, label, lines], i) => ({ id, label, lines, cell: { x: 1 + i * 2, z: 2 } })),
  ],
});
/**
 * Gerard and Aitor's flat on the Meridiana, the home of chapters 2 and 3, drawn from their croquis.
 * The croquis is turned a quarter to the left, so the kitchen and TV walls stand tall for the
 * camera: its top (study) is west here, the kitchen wall north and the balcony east.
 * One cell is roughly 0.8 m. `src/home-scenery.ts` furnishes it after the photos.
 */
export const MERIDIANA = house({
  id: 'meridiana', name: 'Meridiana · Casa de Gerard y Aitor', spawn: { x: 7, z: 3 }, zoom: HOME_ZOOM,
  plan: [
    '     ####################',
    '     D.o#oooo..oooo..G..=',
    '######..#............G.o=',
    '#oooo#...............+.o=',
    '#o...+.........oooo..+.o=',
    '#o...#.o#oo.o..oooo..G.o=',
    '#o...#W#######.o.o...####',
    '#o...+.o#oooo#........W  ',
    '#oo..#..W....+.####...W  ',
    '#W####.o#....#.#oo#oo.#  ',
    '     =.o#....#.#.o#oo.#  ',
    '     =.o#....#.+..#...#  ',
    '     =oo#....###oo#ooo#  ',
    '     ####....##########  ',
    '        W.oo.#           ',
    '        #.oo.#           ',
    '        #oooo#           ',
    '        ######           ',
  ],
  rooms: [
    { name: 'Estudio', x: 1, z: 3, w: 4, d: 6, floor: 'laminate' },
    { name: 'Recibidor', x: 6, z: 1, w: 2, d: 5, floor: 'laminate' },
    { name: 'Galería', x: 6, z: 7, w: 2, d: 6, floor: 'terracotta' },
    { name: 'Cocina', x: 9, z: 1, w: 5, d: 5, floor: 'laminate' },
    // Four rows longer than the croquis: room for a double bed against the south wall, a nightstand each side.
    { name: 'Dormitorio', x: 9, z: 7, w: 4, d: 10, floor: 'laminate' },
    { name: 'Pasillo', x: 14, z: 7, w: 1, d: 5, floor: 'laminate' },
    { name: 'Baño', x: 16, z: 9, w: 2, d: 4, floor: 'laminate' },
    { name: 'Salón', x: 14, z: 1, w: 7, d: 6, floor: 'laminate' },
    { name: 'Comedor', x: 19, z: 7, w: 3, d: 6, floor: 'laminate' },
    { name: 'Balcón', x: 22, z: 1, w: 2, d: 5, floor: 'terracotta' },
  ],
  // The yucca beside the TV; every other plant is furniture.
  props: [{ kind: 'tree', x: 15, z: 1, species: 'yucca', scale: 0.9, base: 'pot' }],
  interactions: [
    { id: 'meridiana-door', cell: { x: 6, z: 1 }, label: 'Salir a la Meridiana', to: { environment: 'meridiana-calle', cell: { x: 50, z: 40 } } },
    // The piano and the balcony take time in chapter 2 (the story answers them, src/days.ts).
    { id: 'meridiana-piano', cell: { x: 2, z: 5 }, label: 'Tocar el piano', hint: 'Tocar el piano' },
    { id: 'meridiana-kitchen', cell: { x: 10, z: 2 }, label: 'Mirar la cocina', lines: ['Encimera de madera, azulejos blancos… y alguien tiene que fregar.'] },
    // The story turns the TV on (chapter 2's news); before that it is just the TV.
    { id: 'meridiana-tv', cell: { x: 16, z: 2 }, label: 'Mirar la tele', anchor: { x: 16.75, z: 1.8, y: 1.65 } },
    { id: 'meridiana-painting', cell: { x: 19, z: 11 }, label: 'Mirar el cuadro', lines: ['Barcelona de noche, con la torre encendida. Nuestra ciudad, en la pared.'] },
    { id: 'meridiana-balcony', cell: { x: 22, z: 3 }, label: 'Tomar un café en el balcón', hint: 'Tomar café' },
    // The lamps are the bulbs at home (src/home-lights.ts): pressing one changes both. The game
    // writes their labels as what the next press does.
    { id: 'lamp-cocina', cell: { x: 11, z: 5 }, label: 'Luz de la cocina' },
    { id: 'lamp-sofa', cell: { x: 14, z: 4 }, label: 'Luz del sofá' },
    { id: 'lamp-luna', cell: { x: 14, z: 6 }, label: 'Luna' },
    { id: 'lamp-mesa', cell: { x: 21, z: 10 }, label: 'Lámpara de la mesa' },
    { id: 'lamp-dormitorio', cell: { x: 12, z: 8 }, label: 'Luz del dormitorio' },
    { id: 'lamp-terraza', cell: { x: 23, z: 1 }, label: 'Farol de la terraza' },
    { id: 'lamp-estudio', cell: { x: 4, z: 7 }, label: 'Luz del estudio' },
    { id: 'lamp-galeria', cell: { x: 6, z: 9 }, label: 'Luz de la galería' },
  ],
});
/**
 * El Nucli, the board-game shop at Carrer de Valladolid 41 in Sants (docs/places/nucli.md), where
 * Gerard meets Bernat on the quiet. The street door is at the bottom, as outside, so the wall of
 * boxes (west) and each room's back wall stand for the camera. Shop at the front, the play hall
 * with its six tables behind the wine-red wall, and a back room behind a curtain that nobody sees
 * from the street. Wider than the real local, to leave room to play. `src/nucli-scenery.ts`
 * furnishes it. The cell right behind each inner wall is furniture, so no wall stands between
 * Gerard and the camera except for a step through a doorway.
 */
export const EL_NUCLI = house({
  id: 'el-nucli', name: 'El Nucli · Sants', spawn: { x: 6, z: 23 }, zoom: HOME_ZOOM,
  plan: [
    '##############',
    '#oooooooooooo#',
    '#o..........o#',
    '#o..oooo..ooo#',
    '#o..oooo..ooo#',
    '#o..........o#',
    '#ooooooo..ooo#',
    '########++####',
    '#ooooo.....oo#',
    '#............#',
    '#.oo..oo..oo.#',
    '#.oo..oo..oo.#',
    '#............#',
    '#.oo..oo..oo.#',
    '#.oo..oo..oo.#',
    '#ooooooo.....#',
    '########.....#',
    '#o...........#',
    '#o.ooooo....o#',
    '#o..........o#',
    '#o..........o#',
    '#o....ooo...o#',
    '#o....ooo....#',
    '#o...........#',
    '#oooo...oooo.#',
    '##GGGGGGGGGG##',
  ],
  rooms: [
    { name: 'Trastienda', x: 1, z: 1, w: 12, d: 6, floor: 'concrete' },
    { name: 'Sala de juego', x: 1, z: 8, w: 12, d: 8, floor: 'terrazzo' },
    { name: 'Tienda', x: 1, z: 17, w: 12, d: 8, floor: 'hydraulic' },
  ],
  // A yucca in a pot in the shop window's corner.
  props: [{ kind: 'tree', x: 12, z: 24, species: 'yucca', scale: 0.75, base: 'pot' }],
  interactions: [
    { id: 'nucli-salida', cell: { x: 6, z: 24 }, label: 'Salir a la calle', to: { environment: 'sants', cell: { x: 86, z: 36 } } },
    { id: 'nucli-estanteria', cell: { x: 2, z: 21 }, label: 'Mirar las estanterías', lines: ['Cajas hasta el techo: Faro de Niebla, Los Telares, Vapor Vell, Mercado de Sombras, Rodalies…', 'Algunas las he jugado en casa de alguien. Otras no las había visto nunca.'] },
    { id: 'nucli-mostrador', cell: { x: 4, z: 19 }, label: 'Mirar el mostrador', lines: ['La caja, un bote de dados sueltos a un euro y una campanita.', 'Nadie detrás. La campanita está boca abajo.'] },
    { id: 'nucli-vitrina', cell: { x: 7, z: 19 }, label: 'Mirar la vitrina', lines: ['Cartas sueltas en fundas, cada una con su precio escrito a lápiz.', 'Las más caras, arriba del todo, con su propia luz.'] },
    { id: 'nucli-partida', cell: { x: 8, z: 11 }, label: 'Mirar la partida', lines: ['Una partida a medias: losetas, fichas de madera, una libreta con los puntos.', 'Las sillas están apartadas, como si se hubieran levantado todos a la vez.'] },
    { id: 'nucli-tablon', cell: { x: 6, z: 9 }, label: 'Mirar el tablón', lines: ['Torneos, presentaciones y «se busca jugador para campaña de rol, los jueves».', 'Encima de todo han clavado una hoja nueva. Está en blanco.'] },
    // Bernat's mission (docs/quests/bernat.md) takes this over once he is there; until then it is a table.
    { id: 'nucli-mesa', cell: { x: 8, z: 4 }, label: 'Mirar la mesa', lines: ['Una mesa redonda entre cajas sin abrir, y dos sillas.', 'Desde aquí no se ve la calle. Y desde la calle no se ve esto.'] },
  ],
});
/** Where Bernat sits in El Nucli's back room, at the round table, facing the curtain: his mission puts him here. */
export const NUCLI_BERNAT_SEAT: Cell = { x: 4, z: 3 };
/** What each character of the palace plan stands for (docs/bubbaloo-palace.md). */
export const PALACE_GLYPHS = {
  '.': 'suelo', '+': 'arco o paso', 'R': 'sumidero', '#': 'muro de chicle', 'P': 'muro con retrato',
  'C': 'cortina de chicle', 'S': 'escalera al trono', 'D': 'puerta sellada', 'F': 'fuente del Corazón Líquido',
  'O': 'columna de envoltorio', 'w': 'montón de envoltorios', 'T': 'mesita del bol de chicles', ' ': 'fuera',
} as const;
const PALACE_WALKABLE = new Set(['.', '+', 'R']);
/**
 * Inside La Reina Bubbaloo's palace (docs/bubbaloo-palace.md). North is up and the camera looks
 * from the south-east, so north and west walls stand tall and south and east ones are cut low.
 * Chapter 1 opens the hall, the portrait gallery and the wrapper room; the stair north (behind
 * the gum curtain) and the east door wait for the final dungeon.
 */
const PALACE_PLAN = [
  '                       ', // 0
  '             #######   ', // 1
  '             #SSSSS#   ', // 2
  '             #SSSSS#   ', // 3
  '             #SSSSS#   ', // 4
  '             #SSSSS#   ', // 5
  '             #SSSSS#   ', // 6
  '#P#P#P#P#P####CCCCC####', // 7
  '#.........#...........#', // 8
  '#.........+...........#', // 9
  '#....T....+..O.....O..#', // 10
  '#++########...........#', // 11
  '#.........#....FFF....#', // 12
  '#.w.....w.#....FFF....D', // 13
  '#.......w.#....FFF....#', // 14
  '#.........#...........#', // 15
  '#....R....+...........#', // 16
  '#.........#..O.....O..#', // 17
  '#.ww....w.#...........#', // 18
  '#.........#...........#', // 19
  '################+######', // 20
];
export const PALACIO: Environment = {
  id: 'palacio', name: 'Palacio de la Reina Bubbaloo', spawn: { x: 16, z: 18 }, zoom: 7.2,
  grid: PALACE_PLAN.map(row => [...row].map(glyph => PALACE_WALKABLE.has(glyph) ? '.' : '#').join('')),
  houses: [], props: [],
  palace: {
    plan: PALACE_PLAN,
    rooms: [
      { name: 'Vestíbulo de las Burbujas', x: 11, z: 8, w: 11, d: 12, floor: 'tile' },
      { name: 'Galería de los Retratos', x: 1, z: 8, w: 9, d: 3, floor: 'tile' },
      { name: 'Sala de los Envoltorios', x: 1, z: 12, w: 9, d: 8, floor: 'tile' },
    ],
  },
  interactions: [
    { id: 'leave-palace', cell: { x: 16, z: 20 }, label: 'Salir por la pompa', to: { environment: 'maresme', cell: { x: 16, z: 3 } } },
    { id: 'palace-fountain', cell: { x: 16, z: 15 }, label: 'Mirar la fuente', lines: ['El Corazón Líquido. Burbujea, rosa y espeso.', 'Huele a fresa. Y a algo que no es fresa.'] },
    { id: 'palace-east-door', cell: { x: 21, z: 13 }, label: 'Mirar la puerta', lines: ['Sale chicle por debajo de la puerta. Detrás suena como si algo hirviera.', 'Mejor no.'] },
    { id: 'palace-column', cell: { x: 12, z: 17 }, label: 'Tocar la columna', lines: ['Una columna de envoltorio retorcido. Cruje como el papel de un caramelo.'] },
    { id: 'palace-wrappers', cell: { x: 8, z: 15 }, label: 'Mirar los envoltorios', lines: ['Envoltorios gigantes, arrugados. Alguien se ha comido muchísimos chicles aquí.'] },
  ],
};
/**
 * A real place from map data: `just geo <zone>` writes src/geo/<zone>.json from OpenStreetMap
 * and assets/geo/<zone>/zone.json (docs/environment-styling.md). Its grid, props and places come
 * straight from that file; only the look lives in `src/geo-scenery.ts`.
 */
export function geoEnvironment(id: EnvironmentId, scene: GeoScene): Environment {
  const props = scene.props as WorldProp[];
  return {
    id, name: scene.name, grid: blockProps(scene.grid, props), spawn: scene.spawn, zoom: scene.zoom,
    houses: [], props, geo: scene,
    // A place with lines is looked at, one with `to` is a door; with neither, the story answers it.
    interactions: scene.places.map(({ id, label, lines, cell, to, step }) => ({ id, label, cell, ...(lines.length ? { lines } : {}), ...(to ? { to: to as Interaction['to'] } : {}), ...(step ? { step } : {}) })),
  };
}
/** San Juan kalea in Alegia (Gipuzkoa), around number 95. */
export const ALEGIA = geoEnvironment('alegia', ALEGIA_SCENE as GeoScene);
/** Chapter 2 (docs/barcelona.md): the Meridiana outside the flat, and Trinitat Vella round the Rec Comtal school. Sketched for now. */
export const MERIDIANA_CALLE = geoEnvironment('meridiana-calle', MERIDIANA_CALLE_SCENE as GeoScene);
export const REC_COMTAL = geoEnvironment('rec-comtal', REC_COMTAL_SCENE as GeoScene);
/** Nuria's street in Cardedeu (docs/quests/nuria.md), from the R4. */
export const CARDEDEU = geoEnvironment('cardedeu', CARDEDEU_SCENE as GeoScene);
/** Uri's maze, round the corner of Nuria's street (docs/quests/nuria.md § The maze). */
const MAZE_GROUND = geoEnvironment('cardedeu-laberinto', CARDEDEU_MAZE_SCENE as GeoScene);
/** Its tower's walls are drawn into the grid (src/tower.ts): the ramp spirals up ring by ring. */
export const CARDEDEU_MAZE = { ...MAZE_GROUND, grid: towerGrid(MAZE_GROUND.grid) };
/** Sants (docs/places/nucli.md): from the Plaça de Sants metro up Carrer de Riego to El Nucli on Carrer de Valladolid. */
export const SANTS = geoEnvironment('sants', SANTS_SCENE as GeoScene);
export const ENVIRONMENTS: Record<EnvironmentId, Environment> = {
  patio: COURTYARD, maresme: NEIGHBORHOOD,
  'home-entrance': HOME_ENTRANCE, 'home-floor-1': HOME_FLOOR_1, 'home-floor-2': HOME_FLOOR_2,
  meridiana: MERIDIANA, palacio: PALACIO, alegia: ALEGIA,
  'meridiana-calle': MERIDIANA_CALLE, 'rec-comtal': REC_COMTAL, cardedeu: CARDEDEU, 'cardedeu-laberinto': CARDEDEU_MAZE,
  sants: SANTS, 'el-nucli': EL_NUCLI,
};
/** Reach from the player's position; wide enough for a side-on door, too short for a diagonal tile. */
export const INTERACTION_REACH = 1.25;
export function nearbyInteraction(environment: Environment, position: Cell): Interaction | undefined {
  return environment.interactions.find(i => Math.hypot(i.cell.x - position.x, i.cell.z - position.z) <= INTERACTION_REACH);
}
