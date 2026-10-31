import type * as pc from 'playcanvas';
import type { GeoLandmark } from './geo';
import type { MeshBuilder } from './geo-scenery';

/**
 * Landmarks of the geo places (docs/environment-styling.md § Landmarks): a zone lists them in
 * `landmarks` (or the map gives them, like drinking fountains), tools/geo.py blocks their footprint,
 * and each kind is drawn by its own module in src/landmarks/<kind>.ts, found here without a list to
 * edit. A module exports `kind` and `build(kit, landmark)`.
 */
export interface LandmarkKit {
  app: pc.Application;
  /** The landmark's pivot: at its centre on the ground, turned by its angle, scaled so one unit is one metre. */
  root: pc.Entity;
  /** Metres per cell, for builders that need the grid (the footprint `w`/`d` are in cells). */
  cell: number;
  /** A plain material, shared by name and colour within the scene. */
  mat(name: string, hex: string, gloss?: number, glow?: number): pc.StandardMaterial;
  /**
   * A real material from public/textures/ (listed in the landmark's `textures` in zone.json, or one
   * the scene already uses), tinted to `tint`; plain `tint` until it loads or if it is missing. It
   * tiles by real metres on MeshBuilder meshes whose UVs are in metres; a primitive's faces count 0–1.
   */
  surface(texture: string, tint: string, gloss?: number): pc.StandardMaterial;
  /** A primitive (box, cylinder, sphere, cone…) in metres, merged into the scene's static batch. */
  part(name: string, type: pc.RenderComponent['type'], material: pc.Material, position: number[], scale: number[], rotation?: number[], parent?: pc.Entity): pc.Entity;
  /** A builder for hand-made meshes (flat-shaded triangles and quads; positions in metres). */
  mesh(): MeshBuilder;
  /**
   * Adds a built mesh. `cut`: tall pieces open the see-through cut round Gerard like the buildings
   * (their material gets the cut shader); otherwise the mesh joins the static batch.
   */
  add(name: string, builder: MeshBuilder, material: pc.StandardMaterial, options?: { cut?: boolean; shadows?: boolean; parent?: pc.Entity }): pc.Entity | undefined;
  /** Paints a canvas texture (signs, tiles), tracked and destroyed with the scene. */
  texture(canvas: HTMLCanvasElement): pc.Texture;
}

export interface LandmarkModule {
  kind: string;
  build(kit: LandmarkKit, landmark: GeoLandmark): void;
}

const modules = import.meta.glob<LandmarkModule>('./landmarks/*.ts', { eager: true });
/** Every landmark builder by kind. */
export const LANDMARKS = new Map(Object.values(modules).map(m => [m.kind, m]));

type V3 = [number, number, number];
/**
 * A box into a hand-built mesh, for pieces that must open the cut (`kit.add(…, { cut: true })`) or
 * tile a real material by the metre: centre and size in metres, turned by `euler` (degrees round x,
 * y and z: the roll first, then the pitch, then the turn round the vertical), each face's UVs in metres.
 */
export function box(b: MeshBuilder, centre: number[], size: number[], euler: number[] = [0, 0, 0]) {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const r = [euler[0], euler[1], euler[2]].map(d => d * Math.PI / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(r[0]), Math.sin(r[0]), Math.cos(r[1]), Math.sin(r[1]), Math.cos(r[2]), Math.sin(r[2])];
  const turn = (v: V3): V3 => {
    let [x, y, z] = v;
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    return [x, y, z];
  };
  const at = (x: number, y: number, z: number): V3 => { const p = turn([x, y, z]); return [p[0] + centre[0], p[1] + centre[1], p[2] + centre[2]]; };
  const faces: [V3, V3, V3, V3, V3, number, number][] = [
    [at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz), turn([0, 0, 1]), size[0], size[1]],
    [at(hx, -hy, -hz), at(-hx, -hy, -hz), at(-hx, hy, -hz), at(hx, hy, -hz), turn([0, 0, -1]), size[0], size[1]],
    [at(hx, -hy, hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), turn([1, 0, 0]), size[2], size[1]],
    [at(-hx, -hy, -hz), at(-hx, -hy, hz), at(-hx, hy, hz), at(-hx, hy, -hz), turn([-1, 0, 0]), size[2], size[1]],
    [at(-hx, hy, hz), at(hx, hy, hz), at(hx, hy, -hz), at(-hx, hy, -hz), turn([0, 1, 0]), size[0], size[2]],
    [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, -hy, hz), at(-hx, -hy, hz), turn([0, -1, 0]), size[0], size[2]],
  ];
  for (const [a, c, d, e, n, u, v] of faces) b.quad(a, c, d, e, n, [0, 0], [u, 0], [u, v], [0, v]);
}
