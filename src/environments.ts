import type { Cell } from './movement';

export type EnvironmentId = 'patio' | 'maresme' | 'home';
export interface Rect { x: number; z: number; w: number; d: number }
export interface House extends Rect { id: string; side: 'west' | 'east'; number?: number; solar?: boolean; pool?: boolean }
export interface WorldProp { kind: 'tree' | 'car'; x: number; z: number; color?: string }
export interface Interaction {
  id: 'enter-home' | 'leave-home' | 'call-bernat';
  cell: Cell;
  label: string;
}
export interface Environment {
  id: EnvironmentId;
  name: string;
  grid: string[];
  spawn: Cell;
  houses: House[];
  props: WorldProp[];
  interactions: Interaction[];
}

export const COURTYARD_ROWS = [
  '#############', '#...........#', '#..#.....#..#', '#..#.....#..#',
  '#..###...#..#', '#...........#', '#.....##....#', '#..#.....#..#',
  '#..#.....#..#', '#..#..G..#..#', '#...........#', '#...........#', '#############',
];
export const COURTYARD: Environment = {
  id: 'patio', name: 'El patio', grid: COURTYARD_ROWS, spawn: { x: 6, z: 9 },
  houses: [], props: [], interactions: [],
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
    // Front patios and narrow gates connect to the street; other plots stay closed.
    if (i === 3) {
      carve({ x: 8, z: z + 2, w: 3, d: 1 });
      carve({ x: 22, z: z + 2, w: 1, d: 1 });
      carve({ x: 23, z: z + 1, w: 7, d: 3 });
    }
  }
  const props: WorldProp[] = [{ kind: 'tree', x: 16, z: 4 }];
  for (const z of [9, 15, 20, 29, 35, 39]) {
    props.push({ kind: 'tree', x: 10, z }, { kind: 'tree', x: 21, z: z - 1 });
  }
  const colors = ['#d8d6c7', '#66808c', '#b95641', '#e4dfd2', '#353f44'];
  for (const [i, z] of [9, 15, 20, 28, 34, 39].entries()) {
    props.push({ kind: 'car', x: 12, z, color: colors[i % colors.length] });
    if (i % 2 === 0) props.push({ kind: 'car', x: 19, z: z + 1, color: colors[(i + 1) % colors.length] });
  }
  for (const prop of props) {
    cells[prop.z][prop.x] = '#';
    if (prop.kind === 'car') cells[prop.z + 1][prop.x] = '#';
  }
  return {
    id: 'maresme', name: 'Passatge Maresme', grid: cells.map(row => row.join('')),
    spawn: { x: 20, z: 24 }, houses, props,
    interactions: [
      { id: 'enter-home', cell: { x: 29, z: 24 }, label: 'Entrar en casa de Gerard' },
      { id: 'call-bernat', cell: { x: 8, z: 24 }, label: 'Llamar a Bernat' },
    ],
  };
}
export const NEIGHBORHOOD = createNeighborhood();
export const HOME: Environment = {
  id: 'home', name: 'Casa de Gerard · Interior provisional', spawn: { x: 6, z: 9 },
  grid: [
    '#############', '#...........#', '#.###.......#', '#.###.......#',
    '#...........#', '#.......##..#', '#.......##..#', '#...........#',
    '#...........#', '#...........#', '#...........#', '#############',
  ], houses: [], props: [],
  interactions: [{ id: 'leave-home', cell: { x: 6, z: 10 }, label: 'Salir a Passatge Maresme' }],
};
export const ENVIRONMENTS: Record<EnvironmentId, Environment> = { patio: COURTYARD, maresme: NEIGHBORHOOD, home: HOME };
export function nearbyInteraction(environment: Environment, cell: Cell): Interaction | undefined {
  return environment.interactions.find(i => Math.abs(i.cell.x - cell.x) + Math.abs(i.cell.z - cell.z) <= 1);
}
