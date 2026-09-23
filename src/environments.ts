import type { Cell } from './movement';

export type EnvironmentId = 'patio' | 'maresme' | 'home-entrance' | 'home-floor-1' | 'home-floor-2';
export interface Rect { x: number; z: number; w: number; d: number }
export interface House extends Rect { id: string; side: 'west' | 'east'; number?: number; solar?: boolean; pool?: boolean }
/** Tree shapes shared by every scene: street plane trees, garden olives and slim cypresses. */
export type TreeSpecies = 'plane' | 'olive' | 'cypress';
/** What the trunk stands in: a paved street pit (default), an indoor pot, or bare ground. */
export type TreeBase = 'pit' | 'pot' | 'ground';
/** Reusable scene pieces, anchored on a cell. `src/props.ts` draws them in any environment. */
export type WorldProp =
  | { kind: 'tree'; x: number; z: number; species?: TreeSpecies; scale?: number; base?: TreeBase }
  | { kind: 'car'; x: number; z: number; color: string }
  | { kind: 'lamp'; x: number; z: number }
  | { kind: 'manhole'; x: number; z: number };
export type PropKind = WorldProp['kind'];
/** Cells each kind blocks, relative to its anchor; visuals are built on the same footprint. */
export const PROP_FOOTPRINTS: Record<PropKind, readonly Cell[]> = {
  tree: [{ x: 0, z: 0 }],
  car: [{ x: 0, z: 0 }, { x: 0, z: 1 }],
  lamp: [{ x: 0, z: 0 }],
  manhole: [],
};
export function propCells(prop: WorldProp): Cell[] {
  return PROP_FOOTPRINTS[prop.kind].map(offset => ({ x: prop.x + offset.x, z: prop.z + offset.z }));
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
  /** Doors and stairs: where the interaction takes Gerard. */
  to?: { environment: EnvironmentId; cell: Cell };
  /** What Gerard says when looking at something. */
  lines?: string[];
  /** Stairs: walking into these cells uses the interaction, no key needed. */
  step?: Rect;
}
export type FloorKind = 'tile' | 'stone' | 'deck' | 'gravel' | 'grass' | 'concrete';
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
  const props: WorldProp[] = [{ kind: 'tree', x: 16, z: 4, scale: 1.25 }];
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
      { id: 'call-bernat', cell: { x: 8, z: 24 }, label: 'Llamar a Bernat' },
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
  'o': 'mueble', '_': 'hueco de la escalera', '=': 'barandilla de cristal', ' ': 'exterior',
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
    '#o...#...#^^#..#.....#....#',
    'W........#^^#.o#....o#....#',
    'Woooo....#^^#..#.....#....#',
    '#........#++#+###+####..oo#',
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
  stairs: [{ x: 10, z: 2, w: 2, d: 5, up: 'north', from: 0, to: 1.32 }],
  props: [
    { kind: 'tree', x: 23, z: 3, species: 'olive', scale: 0.9, base: 'ground' },
    { kind: 'tree', x: 25, z: 1, species: 'cypress', base: 'ground' },
    { kind: 'tree', x: 25, z: 11, species: 'cypress', scale: 0.9, base: 'ground' },
  ],
  interactions: [
    { id: 'leave-hall', cell: { x: 1, z: 1 }, label: 'Salir al patio', to: { environment: 'home-entrance', cell: { x: 17, z: 2 } } },
    { id: 'leave-living', cell: { x: 1, z: 9 }, label: 'Volver al patio 2', to: { environment: 'home-entrance', cell: { x: 18, z: 6 } } },
    { id: 'stairs-up', cell: { x: 10, z: 1 }, label: 'Subir a la planta 2', step: { x: 10, z: 1, w: 2, d: 1 }, to: { environment: 'home-floor-2', cell: { x: 12, z: 6 } } },
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
    { id: 'stairs-down', cell: { x: 11, z: 5 }, label: 'Bajar a la planta 1', step: { x: 11, z: 4, w: 2, d: 1 }, to: { environment: 'home-floor-1', cell: { x: 11, z: 2 } } },
    ...SHELF_LINES.map(([id, label, lines], i) => ({ id, label, lines, cell: { x: 1 + i * 2, z: 2 } })),
  ],
});
export const ENVIRONMENTS: Record<EnvironmentId, Environment> = {
  patio: COURTYARD, maresme: NEIGHBORHOOD,
  'home-entrance': HOME_ENTRANCE, 'home-floor-1': HOME_FLOOR_1, 'home-floor-2': HOME_FLOOR_2,
};
/** Reach from the player's position; wide enough for a side-on door, too short for a diagonal tile. */
export const INTERACTION_REACH = 1.25;
export function nearbyInteraction(environment: Environment, position: Cell): Interaction | undefined {
  return environment.interactions.find(i => Math.hypot(i.cell.x - position.x, i.cell.z - position.z) <= INTERACTION_REACH);
}
