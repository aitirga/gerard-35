/**
 * A real place, as built by `just geo-build <zone>` (tools/geo.py) from OpenStreetMap and a zone
 * file in assets/geo/<zone>/. Coordinates are grid cells: cell (x, z) covers x-0.5..x+0.5, so
 * polygons and the movement grid share one space. Heights are in cells too. See
 * docs/environment-styling.md.
 */
export type GeoPoint = number[];
/**
 * A real texture in public/textures/<id>/ (made by tools/textures.py), as tools/geo.py embeds it:
 * its files, the metres one tile (or the whole photo) covers, its mean colour and, for a photo
 * atlas of real bays, how many bays across and storeys high it holds.
 */
export interface GeoTexture {
  kind: 'material' | 'photo' | string;
  files: { albedo: string; normal?: string; roughness?: string };
  size_m: number[];
  mean?: string;
  bays?: number;
  storeys?: number;
}
/** A surface's real material: a texture id and the colour it is tinted to (without one, its own colours). */
export interface GeoMaterial { texture: string; tint?: string }
/**
 * A landmark drawn by its own builder in src/landmarks/<kind>.ts: centre and footprint in cells,
 * `angle` in degrees round the vertical (0: its front faces the camera), free `params`.
 */
export interface GeoLandmark { kind: string; id: string; x: number; z: number; angle: number; w: number; d: number; solid: boolean; params: Record<string, unknown> }
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
  /** Upper floors: rendered, timber, iron-balconies, ashlar, ashlar-windows, flats, school, mall or curtain, or `photo:<texture>`. */
  facade: string;
  /** Ground floor: masonry, arcade, ashlar, ashlar-arcade, shops, lobby, mall or curtain, or `photo:<texture>`. */
  ground: string;
  /** Big lit letters over the ground floor of the wall facing the camera (HIPERCOR). */
  sign?: string;
  /** Real grain under the painted upper floors (`wall`) and ground floor (`base`), and the roof's tiles: texture ids. */
  materials?: { wall?: string; base?: string; roof?: string };
  /** A photo (texture id) of the real facade, on the wall facing the camera. */
  signature?: string;
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
  /** With the zone's `lane_m`: lanes to paint, whether it is one way, and which lane (from the left) is the bus's. */
  lanes?: number;
  oneway?: boolean;
  bus?: number;
}
/** A shop, bar or bank of the map: its sign on its building's street wall, at (x, z), facing (nx, nz). */
export interface GeoShop { name: string | null; kind: string; building: string; x: number; z: number; nx: number; nz: number }
/** A zebra crossing: centre, the road's direction (radians, in grid space) and its width in cells. */
export interface GeoCrossing { x: number; z: number; angle: number; width: number }
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
  areas: { water: GeoPoint[][]; forest: GeoPoint[][]; grass: GeoPoint[][]; square: GeoPoint[][]; sand?: GeoPoint[][] };
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  props: ({ kind: string; x: number; z: number } & Record<string, unknown>)[];
  /** Things to look at (`lines`), doors to another scene (`to`), or, with neither, the story's own. */
  places: {
    id: string; label: string; lines: string[]; cell: { x: number; z: number }; to?: { environment: string; cell: { x: number; z: number } };
    /** Cells that use the place when walked into, like a station's stair. */
    step?: { x: number; z: number; w: number; d: number };
  }[];
  labels: { text: string; x: number; z: number; width: number }[];
  shops?: GeoShop[];
  crossings?: GeoCrossing[];
  /**
   * The street's surfaces: `ground` and `footway` `panot` (Barcelona's grey sidewalk tiles), `grass`
   * `bed` (planted strips of shrubs), `asphalt` colour, and `markings` (lanes, zebras, BUS, bikes).
   * `river_m` sinks the water that many metres below the street between stone banks, `water` is its
   * colour, and `hills: false` leaves out the generic hills (a landmark draws the place's own).
   */
  look?: { ground?: 'panot'; footway?: 'panot'; grass?: 'bed'; asphalt?: string; markings?: boolean; river_m?: number; water?: string; hills?: boolean };
  /** Named points for pieces the game adds itself, e.g. where the palace stands (`y` in cells). */
  anchors?: Record<string, { x: number; z: number; y?: number }>;
  /** Real materials of the street's surfaces (ground, footway, road, bike, square, grass, bed, forest, sand, rail, bridge). */
  materials?: Record<string, GeoMaterial>;
  /** Every texture the scene names, by id, so the game needs no manifest. */
  textures?: Record<string, GeoTexture>;
  landmarks?: GeoLandmark[];
}
