import * as pc from 'playcanvas';

/**
 * How Gerard stays in sight when the world hides him (docs/graphics.md, "Seeing Gerard behind things"):
 *
 * - `style`: what a building between him and the camera does (src/geo-scenery.ts): `dither` opens a
 *   round window round him whose rim dissolves, `ghost` turns the whole building to a screen door,
 *   `ring` is the earlier cut with a glowing edge, and `none` leaves it whole.
 * - `silhouettes`: Gerard and whoever walks with him show as a tinted silhouette wherever something
 *   still hides them (a lamp post, the foot of a wall, a crown, someone in front, a whole building
 *   with `none`), as Torchlight and Diablo-likes show their heroes.
 *
 * - `camera`: `auto` lets the street camera tilt up or swing round to find him behind a building
 *   (src/camera-orbit.ts); `fixed` keeps its one angle.
 *
 * `?cut=ghost` (or `ring`, `none`), `?silueta=0` and `?camara=fija` pick them at load; in a
 * development build, `window.gerard.game.occlusion` changes them live.
 */
export const OCCLUSION_STYLES = ['dither', 'ghost', 'ring', 'none'] as const;
export type OcclusionStyle = typeof OCCLUSION_STYLES[number];

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const asked = params.get('cut') as OcclusionStyle | null;
export const occlusion: { style: OcclusionStyle; silhouettes: boolean; camera: 'auto' | 'fixed' } = {
  style: asked && OCCLUSION_STYLES.includes(asked) ? asked : 'dither',
  silhouettes: params.get('silueta') !== '0',
  camera: params.get('camara') === 'fija' ? 'fixed' : 'auto',
};

/** The silhouette: a flat, cool tint over whatever hides them, this opaque (HDR, before tone mapping). */
const SILHOUETTE = { color: new pc.Color(0.5, 0.75, 1.15), opacity: 0.8 };
/** Parts smaller than this (half their widest side, metres: glasses rims, eyes) lie inside a bigger part's silhouette and get no copy. */
const SILHOUETTE_MIN_PART = 0.04;

/**
 * Draws each tracked person a second time, flat, only where something stands in front of them.
 *
 * The copies share each part's mesh and node, so they follow every pose; they draw after the opaque
 * scene with the depth test reversed (only behind something) and without writing depth. The
 * stencil keeps them off the people themselves: every tracked part writes 1 where it is seen, and
 * a copy draws only where the stencil is still 0, raising it, so an arm behind Gerard's own body
 * never shows and overlapping parts never darken twice. Needs the post pass's stencil (src/post.ts).
 * About 50 extra draws for Gerard and his partner together.
 */
export function createSilhouettes(app: pc.AppBase) {
  const world = app.scene.layers.getLayerById(pc.LAYERID_WORLD)!;
  const seen = new pc.StencilParameters({ func: pc.FUNC_ALWAYS, ref: 1, zpass: pc.STENCILOP_REPLACE });
  const hidden = new pc.StencilParameters({ func: pc.FUNC_EQUAL, ref: 0, zpass: pc.STENCILOP_INCREMENT });
  const material = new pc.StandardMaterial();
  material.name = 'Silueta';
  material.useLighting = false; material.useSkybox = false;
  material.diffuse.set(0, 0, 0); material.emissive.copy(SILHOUETTE.color);
  material.opacity = SILHOUETTE.opacity; material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false; material.depthFunc = pc.FUNC_GREATER;
  material.stencilFront = material.stencilBack = hidden;
  material.update();
  /** Every tracked part, marked in the stencil, with its copy (none for small parts). */
  const parts = new Map<pc.MeshInstance, pc.MeshInstance | undefined>();
  const present = new Set<pc.MeshInstance>();
  function drop(source: pc.MeshInstance, copy: pc.MeshInstance | undefined) {
    // The skin is the part's: destroying the copy must not take it along.
    if (copy) { world.removeMeshInstances([copy], true); copy.skinInstance = null; copy.destroy(); }
    parts.delete(source);
    source.stencilFront = source.stencilBack = null;
  }
  function track(source: pc.MeshInstance) {
    source.stencilFront = source.stencilBack = seen;
    const { x, y, z } = source.aabb.halfExtents;
    if (!source.mesh || Math.max(x, y, z) < SILHOUETTE_MIN_PART) return undefined;
    const copy = new pc.MeshInstance(source.mesh, material, source.node);
    copy.skinInstance = source.skinInstance;
    copy.castShadow = false;
    world.addMeshInstances([copy], true);
    return copy;
  }
  return {
    /** Keeps a copy of every part of `people` (rebuilt, re-dressed or hidden parts follow) each frame. */
    update(people: pc.Entity[]) {
      present.clear();
      if (occlusion.silhouettes) for (const person of people) {
        for (const render of person.findComponents('render') as pc.RenderComponent[]) {
          const shown = render.enabled && render.entity.enabled;
          for (const source of render.meshInstances) {
            present.add(source);
            if (!parts.has(source)) parts.set(source, track(source));
            const copy = parts.get(source);
            if (copy) copy.visible = shown && source.visible;
          }
        }
      }
      for (const [source, copy] of parts) if (!present.has(source)) drop(source, copy);
    },
    destroy() { for (const [source, copy] of parts) drop(source, copy); material.destroy(); },
  };
}
