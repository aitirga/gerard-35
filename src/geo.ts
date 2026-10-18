/**
 * A real place, as built by `just geo-build <zone>` (tools/geo.py) from OpenStreetMap and a zone
 * file in assets/geo/<zone>/. Coordinates are grid cells: cell (x, z) covers x-0.5..x+0.5, so
 * polygons and the movement grid share one space. Heights are in cells too. See
 * docs/environment-styling.md.
 */
export type GeoPoint = number[];
export interface GeoBuilding {
  id: string;
  style: string;
  name?: string | null;
  number?: string | null;
  levels: number;
  height: number;
  roof: 'hip' | 'gable' | 'pyramid' | 'flat' | string;
  walls: string;
  base?: string | null;
  trim?: string | null;
  roofColor?: string | null;
  /** Upper floors: rendered, timber, iron-balconies, ashlar or ashlar-windows. */
  facade: string;
  /** Ground floor: masonry, arcade, ashlar or ashlar-arcade. */
  ground: string;
  poly: GeoPoint[];
  /** Minimum-area rectangle around the footprint; the roof sits on it. `angle` is the `w` axis. */
  box: { cx: number; cz: number; w: number; d: number; angle: number };
}
export interface GeoRoad {
  id: string;
  kind: 'road' | 'path' | 'bridge' | 'rail' | 'motorway' | string;
  highway?: string;
  name?: string | null;
  width: number;
  line: GeoPoint[];
}
export interface GeoScene {
  id: string;
  name: string;
  region: string;
  attribution: string;
  fetched: string;
  cell_m: number;
  storey: number;
  zoom: number;
  width: number;
  depth: number;
  grid: string[];
  spawn: { x: number; z: number };
  areas: { water: GeoPoint[][]; forest: GeoPoint[][]; grass: GeoPoint[][]; square: GeoPoint[][] };
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  props: ({ kind: string; x: number; z: number } & Record<string, unknown>)[];
  /** Things to look at (`lines`), doors to another scene (`to`), or, with neither, the story's own. */
  places: { id: string; label: string; lines: string[]; cell: { x: number; z: number }; to?: { environment: string; cell: { x: number; z: number } } }[];
  labels: { text: string; x: number; z: number; width: number }[];
  /** Named points for pieces the game adds itself, e.g. where the palace stands (`y` in cells). */
  anchors?: Record<string, { x: number; z: number; y?: number }>;
}
