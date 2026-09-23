import * as pc from 'playcanvas';
import type { TreeSpecies, WorldProp } from './environments';

/** How see-through a crown gets while it hides the player, and how quickly it fades. */
const GHOST_OPACITY = 0.3;
const FADE_RATE = 9;
/** Rough radius of the player's silhouette, in world units, for the occlusion test. */
const FOCUS_RADIUS = 0.35;

interface Tree {
  pivot: pc.Entity; yaw: number; phase: number; sway: number;
  crowns: pc.RenderComponent[]; solid: pc.Material[]; ghosts: pc.StandardMaterial[];
  /** Crown as a vertical capsule in world space: bottom and top centres plus radius. */
  bottom: pc.Vec3; top: pc.Vec3; radius: number;
  opacity: number;
}

export type PropKit = ReturnType<typeof createPropKit>;

/**
 * Reusable props with their own materials. Any scene can `place` a WorldProp under its own
 * root; call `update` every frame for swaying and see-through crowns, `destroy` when done.
 * Collision is not handled here: it comes from PROP_FOOTPRINTS in environments.ts.
 */
export function createPropKit() {
  const materials: pc.StandardMaterial[] = [];
  const trees: Tree[] = [];
  let time = 0;
  function mat(name: string, hex: string, gloss = 0.2, glow = 0) {
    const m = new pc.StandardMaterial();
    m.name = name; m.diffuse.fromString(hex); m.gloss = gloss;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); return m;
  }
  function part(parent: pc.Entity, name: string, type: string, m: pc.Material, p: number[], s: number[], r?: number[]) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: true, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]);
    if (r) e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  // Deterministic per-anchor noise: the same tree looks the same after every reload.
  const noise = (x: number, z: number, i: number) => { const v = Math.sin(x * 127.1 + z * 311.7 + i * 74.7) * 43758.5453; return v - Math.floor(v); };

  const leaf = [mat('Olivo', '#78925b'), mat('Copa clara', '#98a86e'), mat('Copa oscura', '#597a54')];
  const foliage: Record<TreeSpecies, pc.StandardMaterial[]> = {
    plane: leaf,
    olive: [mat('Olivo plateado', '#8d9b6f'), mat('Olivo claro', '#a6ae86'), mat('Olivo sombra', '#6f8060')],
    cypress: [mat('Ciprés', '#4c6947'), mat('Ciprés claro', '#5d7a52')],
  };
  const bark = mat('Troncos', '#817058');
  const oliveBark = mat('Tronco de olivo', '#8a8173');
  const stone = mat('Piedra clara', '#e3dec8');
  const soil = mat('Tierra', '#6f5e49');
  const clay = mat('Maceta de barro', '#b8704f');
  const metal = mat('Forja verde', '#354d47', 0.5);
  const glass = mat('Cristal azul', '#557c83', 0.8);
  const glow = mat('Farolas', '#ffdb9c', 0.2, 2);
  const rim = mat('Marco de alcantarilla', '#8f8a78', 0.3);
  const iron = mat('Hierro de alcantarilla', '#6d6a5e', 0.45);
  const paint = new Map<string, pc.StandardMaterial>();

  /**
   * Round lobes set on the surface of a crown sphere: the silhouette stays spherical but
   * bumpy, with darker lobes underneath and lighter ones on top for a sense of volume.
   */
  function lobes(pivot: pc.Entity, crowns: pc.Entity[], palette: pc.StandardMaterial[], n: (i: number) => number, s: number, y: number, reach: number, count: number, size: number) {
    const dark = palette[palette.length - 1], light = palette[1];
    for (let i = 0; i < count; i++) {
      const a = (i / count + n(3)) * Math.PI * 2, e = -0.35 + (i % 3) * 0.5 + n(i + 12) * 0.2, d = reach * s;
      const r = (size + n(i + 8) * 0.08) * s * 2;
      crowns.push(part(pivot, 'Lóbulo de copa', 'sphere', e < 0 ? dark : e > 0.5 ? light : palette[0],
        [Math.cos(e) * Math.cos(a) * d, y * s + Math.sin(e) * d, Math.cos(e) * Math.sin(a) * d], [r, r, r]));
    }
    // A small sunlit cap on top keeps the crown from reading as a flat disc from above.
    crowns.push(part(pivot, 'Copa soleada', 'sphere', light, [0.08 * s, (y + reach * 0.85) * s, -0.06 * s], [size * 2.2 * s, size * 1.6 * s, size * 2.2 * s]));
  }
  function tree(holder: pc.Entity, x: number, z: number, species: TreeSpecies, scale: number, base: 'pit' | 'pot' | 'ground') {
    const n = (i: number) => noise(x, z, i);
    const s = scale * (0.9 + n(0) * 0.2);
    let lift = 0;
    if (base === 'pit') {
      part(holder, 'Alcorque', 'box', stone, [0, 0.04, 0], [0.9, 0.12, 0.9]);
      part(holder, 'Tierra', 'box', soil, [0, 0.11, 0], [0.73, 0.05, 0.73]);
    } else if (base === 'pot') {
      part(holder, 'Maceta', 'cylinder', clay, [0, 0.21, 0], [0.56, 0.42, 0.56]);
      part(holder, 'Borde de maceta', 'cylinder', clay, [0, 0.43, 0], [0.64, 0.07, 0.64]);
      part(holder, 'Tierra de maceta', 'cylinder', soil, [0, 0.45, 0], [0.5, 0.02, 0.5]);
      lift = 0.44;
    }
    // Trunk and crowns hang from a base pivot, so the whole tree leans in the breeze.
    const pivot = new pc.Entity('Árbol'), yaw = n(1) * 360;
    pivot.setLocalPosition(0, lift, 0); pivot.setLocalEulerAngles(0, yaw, 0); holder.addChild(pivot);
    const palette = foliage[species];
    const crowns: pc.Entity[] = [];
    let low: number, high: number, radius: number, sway: number;
    if (species === 'cypress') {
      part(pivot, 'Tronco', 'cylinder', bark, [0, 0.2 * s, 0], [0.12, 0.4 * s, 0.12]);
      crowns.push(part(pivot, 'Copa de ciprés', 'sphere', palette[0], [0, 1.35 * s, 0], [0.7 * s, 2.3 * s, 0.7 * s]));
      crowns.push(part(pivot, 'Punta de ciprés', 'sphere', palette[1], [0.04 * s, 2.35 * s, 0.03 * s], [0.44 * s, 1.1 * s, 0.44 * s]));
      [low, high, radius, sway] = [0.6 * s, 2.5 * s, 0.38 * s, 0.5];
    } else if (species === 'olive') {
      // A short, split trunk under a round, silvery crown.
      part(pivot, 'Tronco', 'cylinder', oliveBark, [0, 0.32 * s, 0], [0.22, 0.66 * s, 0.22], [0, 0, 8]);
      for (const side of [-1, 1]) part(pivot, 'Rama', 'cylinder', oliveBark, [side * 0.16 * s, 0.78 * s, 0], [0.12, 0.5 * s, 0.12], [0, 0, -side * 32]);
      crowns.push(part(pivot, 'Copa de olivo', 'sphere', palette[0], [0, 1.2 * s, 0], [1.1 * s, 0.95 * s, 1.1 * s]));
      lobes(pivot, crowns, palette, n, s, 1.2, 0.4, 5, 0.26);
      [low, high, radius, sway] = [1.05 * s, 1.35 * s, 0.78 * s, 1];
    } else {
      // Street plane tree: tall trunk with a flared foot and a small fork under a round crown.
      part(pivot, 'Pie del tronco', 'cylinder', bark, [0, 0.08 * s, 0], [0.26, 0.16 * s, 0.26]);
      part(pivot, 'Tronco', 'cylinder', bark, [0, 0.62 * s, 0], [0.17, 1.24 * s, 0.17]);
      for (const side of [-1, 1]) part(pivot, 'Rama', 'cylinder', bark, [side * 0.13 * s, 1.28 * s, 0], [0.1, 0.5 * s, 0.1], [0, 0, -side * 28]);
      crowns.push(part(pivot, 'Copa de árbol', 'sphere', palette[0], [0, 1.9 * s, 0], [1.4 * s, 1.35 * s, 1.4 * s]));
      lobes(pivot, crowns, palette, n, s, 1.9, 0.48, 6, 0.3);
      [low, high, radius, sway] = [1.7 * s, 2.1 * s, 0.88 * s, 1];
    }
    const world = holder.getPosition();
    // Swap materials on the render component: mesh instances only exist once the parent is in the scene.
    const meshes = crowns.map(c => c.render!);
    const solid = meshes.map(r => r.material);
    const ghosts = [...new Set(solid)].map(m => {
      const g = m.clone() as pc.StandardMaterial;
      g.blendType = pc.BLEND_NORMAL; g.update(); materials.push(g); return [m, g] as const;
    });
    const ghostOf = new Map(ghosts);
    trees.push({
      pivot, yaw, phase: x * .7 + z * .31, sway, crowns: meshes, solid, ghosts: solid.map(m => ghostOf.get(m)!),
      bottom: new pc.Vec3(world.x, world.y + lift + low, world.z), top: new pc.Vec3(world.x, world.y + lift + high, world.z), radius,
      opacity: 1,
    });
  }
  function car(holder: pc.Entity, color: string) {
    let body = paint.get(color);
    if (!body) { body = mat('Carrocería', color, 0.65); paint.set(color, body); }
    // The body spans the anchor cell and the next one along +z, like its footprint.
    part(holder, 'Coche', 'box', body, [0, 0.32, 0.5], [0.84, 0.45, 1.85]);
    part(holder, 'Cabina', 'box', glass, [0, 0.66, 0.5], [0.72, 0.36, 0.95]);
    part(holder, 'Techo coche', 'box', body, [0, 0.86, 0.53], [0.74, 0.08, 0.65]);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      part(holder, 'Rueda', 'cylinder', metal, [side * 0.41, 0.2, 0.5 + end * 0.59], [0.32, 0.13, 0.32], [0, 0, 90]);
    }
    part(holder, 'Faros coche', 'box', stone, [0, 0.36, -0.44], [0.6, 0.1, 0.03]);
  }
  function lamp(holder: pc.Entity) {
    part(holder, 'Base de farola', 'cylinder', metal, [0, 0.06, 0], [0.2, 0.12, 0.2]);
    part(holder, 'Farola', 'box', metal, [0, 1.65, 0], [0.075, 3.3, 0.075]);
    part(holder, 'Luminaria', 'box', glow, [0, 3.28, 0], [0.38, 0.16, 0.45]);
  }
  function manhole(holder: pc.Entity) {
    // Flat street furniture: nothing here may suggest a collision the grid lacks.
    part(holder, 'Marco de alcantarilla', 'cylinder', rim, [0, 0.04, 0], [0.68, 0.012, 0.68]);
    part(holder, 'Tapa de alcantarilla', 'cylinder', iron, [0, 0.046, 0], [0.56, 0.012, 0.56]);
    for (const dz of [-0.14, 0, 0.14]) part(holder, 'Estría', 'box', rim, [0, 0.054, dz], [0.42, 0.008, 0.035]);
  }
  function setOpacity(t: Tree, opacity: number) {
    t.opacity = opacity;
    const opaque = opacity >= 0.999;
    t.crowns.forEach((r, i) => { r.material = opaque ? t.solid[i] : t.ghosts[i]; });
    if (!opaque) for (const g of new Set(t.ghosts)) { g.opacity = opacity; g.update(); }
  }
  const ray = new pc.Vec3();
  /** Whether any part of the crown capsule lies between the focus and the camera. */
  function hides(t: Tree, focus: pc.Vec3, toCamera: pc.Vec3) {
    const reach = t.radius + FOCUS_RADIUS;
    for (let k = 0; k <= 2; k++) {
      ray.lerp(t.bottom, t.top, k / 2).sub(focus);
      const along = ray.dot(toCamera);
      if (along > 0 && ray.lengthSq() - along * along < reach * reach) return true;
    }
    return false;
  }

  return {
    /** Foliage for hedges, planters and anything else that should match the trees. */
    leaf,
    /** Builds a prop under `parent` at a local position that sits on the anchor cell. */
    place(prop: WorldProp, parent: pc.Entity, position: pc.Vec3) {
      const holder = new pc.Entity(`Prop: ${prop.kind}`);
      holder.setLocalPosition(position); parent.addChild(holder);
      if (prop.kind === 'tree') tree(holder, prop.x, prop.z, prop.species ?? 'plane', prop.scale ?? 1, prop.base ?? 'pit');
      else if (prop.kind === 'car') car(holder, prop.color);
      else if (prop.kind === 'lamp') lamp(holder);
      else manhole(holder);
      return holder;
    },
    /** Sways trees and fades crowns that stand between `focus` and the camera direction. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      time += dt;
      for (const t of trees) {
        if (animate) t.pivot.setLocalEulerAngles(Math.sin(time * 1.1 + t.phase) * 1.1 * t.sway, t.yaw, Math.sin(time * .83 + t.phase * 1.3) * 1.4 * t.sway);
        const target = focus && toCamera && hides(t, focus, toCamera) ? GHOST_OPACITY : 1;
        if (t.opacity === target) continue;
        const next = animate ? t.opacity + (target - t.opacity) * (1 - Math.exp(-dt * FADE_RATE)) : target;
        setOpacity(t, Math.abs(next - target) < 0.01 ? target : next);
      }
    },
    destroy() { materials.forEach(m => m.destroy()); trees.length = 0; },
  };
}
