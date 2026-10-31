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
   * the scene already uses), tinted to `tint`; plain `tint` until it loads or if it is missing. An
   * empty `tint` keeps the texture's own colours (a photo of a facade). It
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
