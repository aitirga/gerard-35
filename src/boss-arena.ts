import * as pc from 'playcanvas';
import { formation, pocketWorld, standing, type Cast, type PocketCell } from './arena';
import { MeshBuilder } from './geo-scenery';
import type { GeoLandmark, GeoScene } from './geo';
import { LANDMARKS, type LandmarkKit } from './landmarks';
import { BACKDROP } from './particles';
import { POCKET_AT, sampleLook } from './pocket';
import { createPropKit } from './props';
import { DOOR, TALL } from './landmarks/tanca-camping';

/**
 * A boss's own arena (docs/combat.md § Dónde se planta un combate): instead of fighting where it
 * starts, among the place's dressing (El Campeón's waiting figure on its plinth, La Sobremesa sat at
 * the melon table, both still there while the fight's own model stands next to them), the picture
 * breaks into glass, as into a pocket (src/pocket.ts), and the fight goes on in a stage built of that
 * very place's pieces: its landmark builders (src/landmarks/), its pines, its floor, water and light,
 * laid out with room for the fight and nothing of the boss left waiting. Far from every place, at
 * POCKET_AT, its torn edges ending in the place's sky.
 *
 * Positions are in cells (world units), from the fight's centre; on open ground the party stands at
 * -x, the foes at +x and the camera looks from +z (src/arena.ts `CAMERA`), or from behind the party's
 * left for a giant (`fightCamera`).
 */
export type BossArenaId = 'piscina' | 'merendero';
/** Which fights have their own arena. */
export const BOSS_ARENAS: Partial<Record<string, BossArenaId>> = { campeon: 'piscina', sobremesa: 'merendero' };
/** How much further apart the two sides stand than usual: room to move, not a pocket's stretch. */
export const ARENA_SPREAD = 1.3;

export interface BossArenaSource {
  /** The scene's roots, to take its floor, water and textured materials from. */
  roots: readonly pc.Entity[];
  /** Where the place's own floor for this arena lies (world space): the pool deck, the merendero's ground. */
  floorSpot: pc.Vec3;
  /** The place's scene (its landmarks' kit reads it) and metres per cell. */
  scene: GeoScene;
  /** Who is in the fight, to light the boss where it will stand. */
  cast: Cast;
}

type Piece = { kind: string; x: number; z: number; angle?: number; w?: number; d?: number; params?: Record<string, unknown>; tall?: number };
type V3 = [number, number, number];

/** The pool deck at dusk: the water behind the fight, the wall of boards beyond, bulbs from pine to pine. */
const PISCINA = {
  floor: { x0: -12, x1: 12, z0: -12, z1: 6 },
  /** The pool's water, centred behind the fight (cells). */
  pool: { x: 0, z: -6.8, w: 14, d: 4 },
  pieces: [
    { kind: 'piscina', x: 0, z: -6.8, w: 14, d: 4 },
    // The wall of boards round the pool, behind it and down the far side.
    { kind: 'tanca-camping', x: 0, z: -11.4, w: 24, d: 1, params: { style: 'fusta' }, tall: TALL.h },
    { kind: 'tanca-camping', x: -11.6, z: -5.5, angle: 90, w: 12, d: 1, params: { style: 'fusta' }, tall: TALL.h },
    // The lifeguard's chair across the water, facing it; the board of the tournament behind El Campeón.
    { kind: 'cadira-socorrista', x: -3.5, z: -9.9, w: 1, d: 1, tall: 2 },
    { kind: 'pissarra', x: 5.4, z: -2.6, angle: -18, w: 1, d: 1, tall: 1.4 },
    { kind: 'bombetes', x: 0, z: 0, params: { runs: [] } },
  ] as Piece[],
  pines: [[-10, -9.6, .95], [-.5, -10.2, .85], [9.6, -9.8, 1], [10.6, 2.2, .9], [-10.4, 3.4, .9]] as V3[],
  /** Bulb strings between the pines (indices), 2.7 m up. */
  strings: [[0, 1], [1, 2], [2, 3], [0, 4]] as [number, number][],
};

/** The merendero: long tables under the pines, the wall of boards and its steel door, the melon table behind the boss. */
const MERENDERO = {
  floor: { x0: -13, x1: 14, z0: -12, z1: 7 },
  pieces: [
    // The wall between the merendero and the pool, its steel door open (the party came through), and down the right.
    { kind: 'tanca-camping', x: -9.25, z: -10.6, w: 7.5, d: 1, params: { style: 'fusta' }, tall: TALL.h },
    { kind: 'tanca-camping', x: -4, z: -10.6, angle: 180, w: 3, d: 1, params: { style: 'blindada', lamps: 9 }, tall: DOOR.h },
    { kind: 'tanca-camping', x: 5.75, z: -10.6, w: 16.5, d: 1, params: { style: 'fusta' }, tall: TALL.h },
    { kind: 'tanca-camping', x: 13.6, z: -2, angle: 90, w: 17, d: 1, params: { style: 'fusta' }, tall: TALL.h },
    // The long tables in their rows; the melon one right behind where La Sobremesa rises.
    { kind: 'taula-picnic', x: -7.5, z: -6.5, w: 3, d: 2, params: { seed: 1 }, tall: 1 },
    { kind: 'taula-picnic', x: -1.5, z: -7, w: 3, d: 2, params: { seed: 2 }, tall: 1 },
    { kind: 'taula-picnic', x: 9.6, z: -3.6, w: 3, d: 2, params: { seed: 9, melo: true }, tall: 1 },
    { kind: 'taula-picnic', x: 4.2, z: -7.6, w: 3, d: 2, params: { seed: 3 }, tall: 1 },
    { kind: 'taula-picnic', x: 10.4, z: 3.6, angle: 90, w: 3, d: 2, params: { seed: 5 }, tall: 1 },
    { kind: 'bombetes', x: 0, z: 0, params: { runs: [], switched: true } },
  ] as Piece[],
  pines: [[-11.4, -8.6, 1], [-4.6, -8.9, .9], [1.8, -9.2, 1.1], [8.4, -9, .95], [12.2, -6.4, 1], [12.4, 1.8, .9], [-11.6, 1.2, .9], [5.2, 5.6, .85]] as V3[],
  strings: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 5], [6, 0]] as [number, number][],
};

/** Materials of the place by name, from whatever its meshes wear (the landmarks' textured boards, its water). */
function namedMaterials(roots: readonly pc.Entity[]) {
  const named = new Map<string, pc.Material>();
  for (const root of roots) for (const component of root.findComponents('render') as pc.RenderComponent[]) {
    for (const mesh of component.meshInstances) if (mesh.material?.name && !named.has(mesh.material.name)) named.set(mesh.material.name, mesh.material);
  }
  return named;
}

export function createBossArena(app: pc.Application, id: BossArenaId, source: BossArenaSource) {
  const device = app.graphicsDevice, cell = source.scene.cell_m, plan = id === 'piscina' ? PISCINA : MERENDERO;
  const root = new pc.Entity(id === 'piscina' ? 'Arena: la piscina' : 'Arena: el merendero'); root.setPosition(POCKET_AT); app.root.addChild(root);
  const owned: pc.Material[] = [], meshes: pc.Mesh[] = [], textures: pc.Texture[] = [];
  const named = namedMaterials(source.roots);
  const plain = (name: string, hex: string, gloss = .2, glow = 0) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); owned.push(m); return m;
  };
  const addMesh = (name: string, b: MeshBuilder, material: pc.Material, parent: pc.Entity, shadows = true) => {
    if (b.empty) return undefined;
    const mesh = b.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
    parent.addChild(e); return e;
  };

  // ── Floor: the place's own, under the spot it stands for, torn off at its edges over the sky.
  const look = sampleLook(source.roots, source.floorSpot);
  const floorMaterial = look.floor ?? plain('Suelo de la arena', id === 'piscina' ? '#9a8f80' : '#5f664a');
  const skirtMaterial = look.wall ?? floorMaterial;
  const { x0, x1, z0, z1 } = plan.floor;
  const floor = new MeshBuilder(), skirt = new MeshBuilder();
  const uv = (x: number, z: number) => [x * cell, z * cell];
  floor.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], uv(x0, z1), uv(x1, z1), uv(x1, z0), uv(x0, z0));
  // A ragged skirt below every edge: the stretch was torn out of the place.
  const tear = (a: number) => 1 + Math.abs(Math.sin(a * 12.9898) * 43758.5453 % 1) * .9;
  const edge = (from: V3, to: V3, out: V3) => {
    const n = Math.max(1, Math.round(Math.hypot(to[0] - from[0], to[2] - from[2])));
    for (let i = 0; i < n; i++) {
      const p = (t: number): V3 => [from[0] + (to[0] - from[0]) * t, 0, from[2] + (to[2] - from[2]) * t];
      const a = p(i / n), b = p((i + 1) / n), deep = -tear(a[0] * 3 + a[2] * 7);
      skirt.quad([a[0], 0, a[2]], [b[0], 0, b[2]], [b[0], deep, b[2]], [a[0], deep, a[2]], out, [0, 0], [cell, 0], [cell, deep * cell], [0, deep * cell]);
    }
  };
  edge([x0, 0, z1], [x1, 0, z1], [0, 0, 1]); edge([x1, 0, z1], [x1, 0, z0], [1, 0, 0]);
  edge([x1, 0, z0], [x0, 0, z0], [0, 0, -1]); edge([x0, 0, z0], [x0, 0, z1], [-1, 0, 0]);
  addMesh('Suelo de la arena', floor, floorMaterial, root, false);
  addMesh('Borde de la arena', skirt, skirtMaterial, root);

  // ── The place's pieces, by its own builders, in metres under pivots scaled to cells.
  const metres = (x: number, z: number, angle = 0) => {
    const pivot = new pc.Entity('Pieza'); pivot.setLocalPosition(x, 0, z); pivot.setLocalEulerAngles(0, angle, 0); pivot.setLocalScale(1 / cell, 1 / cell, 1 / cell);
    root.addChild(pivot); return pivot;
  };
  const shared = new Map<string, pc.StandardMaterial>();
  const kitFor = (pivot: pc.Entity): LandmarkKit => ({
    app, root: pivot, cell, water: 0, scene: source.scene,
    mat(name, hex, gloss = .2, glow = 0) {
      const key = `${name}|${hex}|${gloss}|${glow}`;
      let m = shared.get(key);
      if (!m) { m = plain(name, hex, gloss, glow); shared.set(key, m); }
      return m;
    },
    // The place's own textured material when it has it (the same boards, the same concrete), else its tint.
    surface(texture, tint, gloss = .1) {
      const real = named.get(`${texture} ${tint}`);
      if (real instanceof pc.StandardMaterial) return real;
      return this.mat(`${texture} ${tint}`, tint || '#ffffff', gloss);
    },
    part(name, type, material, position, scale, rotation, parent = pivot) {
      const e = new pc.Entity(name);
      e.addComponent('render', { type, material, castShadows: true, receiveShadows: true });
      e.setLocalPosition(position[0], position[1], position[2]); e.setLocalScale(scale[0], scale[1], scale[2]);
      if (rotation) e.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
      parent.addChild(e); return e;
    },
    mesh: () => new MeshBuilder(),
    add(name, b, material, { shadows = true, parent = pivot } = {}) { return addMesh(name, b, material, parent, shadows); },
    texture(c) {
      const t = new pc.Texture(device, { width: c.width, height: c.height, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
      t.setSource(c); textures.push(t); return t;
    },
  });
  // The bulbs hang from pine to pine, 2.7 m up, sagging a little: their runs in metres from the arena's centre.
  const runs = plan.strings.map(([a, b]) => [plan.pines[a], plan.pines[b]].map(([x, z], i) => [x * cell, 2.7 - i * .1, z * cell] as V3));
  const built = new Map<string, pc.Entity>();
  plan.pieces.forEach((piece, i) => {
    const builder = LANDMARKS.get(piece.kind);
    if (!builder) return;
    const pivot = metres(piece.x, piece.z, piece.angle);
    const params = piece.kind === 'bombetes' ? { ...piece.params, runs } : piece.params ?? {};
    const landmark: GeoLandmark = { kind: piece.kind, id: `${id}-${i}`, x: piece.x, z: piece.z, angle: piece.angle ?? 0, w: piece.w ?? 1, d: piece.d ?? 1, solid: !!piece.tall, params };
    builder.build(kitFor(pivot), landmark);
    built.set(`${piece.kind}-${i}`, pivot);
  });
  // The merendero's steel door stands open, its bar up: the party came in through it.
  for (const leaf of root.find(n => n.name === 'Hoja blindada') as pc.Entity[]) leaf.setLocalEulerAngles(0, -Math.sign(leaf.getLocalPosition().x) * DOOR.swing, 0);
  (root.findByName('Cerrojo blindado') as pc.Entity | null)?.setLocalPosition(0, DOOR.lift, 0);

  // The pool's water: the place's own, filled to the brim, lit from inside.
  if (id === 'piscina') {
    const { x, z, w, d } = PISCINA.pool, water = new MeshBuilder();
    const wx0 = x - w / 2, wx1 = x + w / 2, wz0 = z - d / 2, wz1 = z + d / 2, y = .03;
    water.quad([wx0, y, wz1], [wx1, y, wz1], [wx1, y, wz0], [wx0, y, wz0], [0, 1, 0], uv(wx0, wz1), uv(wx1, wz1), uv(wx1, wz0), uv(wx0, wz0));
    const placeWater = named.get('Río');
    const pool = placeWater instanceof pc.StandardMaterial ? placeWater.clone() : plain('Agua de la piscina', '#2b6f78', .85);
    if (placeWater) owned.push(pool);
    pool.emissive.set(.18, .62, .72); pool.emissiveIntensity = .28; pool.update();
    addMesh('Agua de la piscina', water, pool, root, false);
  }

  // The pines the bulbs are tied to, in the place's own kind.
  const props = createPropKit(device);
  for (const [x, z, scale] of plan.pines) props.place({ kind: 'tree', x: Math.round(x * 7), z: Math.round(z * 5), species: 'pine', base: 'ground', scale }, root, new pc.Vec3(x, 0, z));

  // ── Light.
  const light = (name: string, options: Record<string, unknown>, at: V3) => {
    const e = new pc.Entity(name); e.addComponent('light', options); root.addChild(e); e.setLocalPosition(...at); return e;
  };
  // Where the boss will stand (the arena's formation), for its light to find it.
  const slots = formation('open', source.cast.allies, standing(source.cast.foes), ARENA_SPREAD);
  const boss = slots.foes[slots.foes.length - 1] ?? { x: 2, z: 0 };
  const warm = new pc.Color(1, .72, .42);
  if (id === 'piscina') {
    // The bulbs over the far side of the water and down the left, warm; the pool's own light, cold, from below the deck's edge.
    light('Luz de las bombillas', { type: 'omni', color: warm, intensity: .8, range: 10, castShadows: false }, [-4, 3, -8.5]);
    light('Luz de las bombillas', { type: 'omni', color: warm, intensity: .7, range: 10, castShadows: false }, [6, 3, -8.5]);
    light('Luz de la piscina', { type: 'omni', color: new pc.Color(.35, .82, 1), intensity: 1.6, range: 7, castShadows: false }, [PISCINA.pool.x, .5, PISCINA.pool.z + 1]);
    // A hard lamp on the wall, over the fight, throwing its shadows towards the camera.
    const lamp = light('Foco de la piscina', { type: 'spot', color: new pc.Color(1, .82, .6), intensity: 3.2, range: 16, innerConeAngle: 16, outerConeAngle: 30, castShadows: true, shadowResolution: 1024 }, [boss.x - 1.5, 7.5, boss.z - 6]);
    lamp.lookAt(root.getPosition().x + (boss.x - 1.5) / 2, POCKET_AT.y + .8, POCKET_AT.z + boss.z); lamp.rotateLocal(90, 0, 0);
    light('Luz del grupo', { type: 'omni', color: warm, intensity: .45, range: 8, castShadows: false }, [-3, 3.5, 2.5]);
  } else {
    // As at the long table when the steel door opened: one hard warm lamp over La Sobremesa and the bulbs' spill.
    const lamp = light('Foco del merendero', { type: 'spot', color: new pc.Color(1, .78, .5), intensity: 9, range: 16, innerConeAngle: 18, outerConeAngle: 34, castShadows: true, shadowResolution: 2048, shadowBias: .03, normalOffsetBias: .06, shadowType: pc.SHADOW_PCF3_32F }, [boss.x + 1.5, 7.5, boss.z + 3.5]);
    lamp.lookAt(POCKET_AT.x + boss.x, POCKET_AT.y + 1.4, POCKET_AT.z + boss.z); lamp.rotateLocal(90, 0, 0);
    light('Luz de las bombillas del merendero', { type: 'omni', color: new pc.Color(1, .7, .4), intensity: 1.6, range: 12, castShadows: false }, [boss.x - 1, 3.2, boss.z + 2]);
    light('Luz de las bombillas del merendero', { type: 'omni', color: new pc.Color(1, .7, .4), intensity: 1.1, range: 11, castShadows: false }, [-5, 3.2, -4]);
    light('Luz del grupo', { type: 'omni', color: warm, intensity: .6, range: 9, castShadows: false }, [-4, 3.5, 2]);
  }

  // ── What particles meet: the floor, the walls and the things on it.
  const pad = 1, cols = x1 - x0 + pad * 2 + 1, rows = z1 - z0 + pad * 2 + 1;
  const centre = { x: -x0 + pad, z: -z0 + pad };
  const cells: PocketCell[][] = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => {
    const x = i - centre.x, z = j - centre.z;
    return x >= x0 && x <= x1 && z >= z0 && z <= z1 ? 'floor' : 'void';
  }));
  const tops = new Float32Array(cols * rows);
  const mark = (x: number, z: number, top: number) => {
    const i = Math.round(x + centre.x), j = Math.round(z + centre.z);
    if (cells[j]?.[i] !== 'floor') return;
    cells[j][i] = 'wall'; tops[j * cols + i] = top / cell;
  };
  for (const piece of plan.pieces) {
    if (!piece.tall) continue;
    const w = piece.w ?? 1, d = piece.d ?? 1, turned = Math.abs((piece.angle ?? 0) % 180) === 90;
    const hw = (turned ? d : w) / 2, hd = (turned ? w : d) / 2;
    for (let x = Math.ceil(piece.x - hw); x <= Math.floor(piece.x + hw); x++) for (let z = Math.ceil(piece.z - hd); z <= Math.floor(piece.z + hd); z++) mark(x, z, piece.tall);
  }
  for (const [x, z] of plan.pines) mark(x, z, 6);

  return {
    root,
    /** The middle of the fight, in world space. */
    centre: POCKET_AT.clone(),
    floorAt: () => POCKET_AT.y,
    world: pocketWorld({ cells, stage: { layout: 'open', centre } }, POCKET_AT, (x, z) => tops[z * cols + x], BACKDROP),
    contains: (x: number, z: number) => Math.abs(x - POCKET_AT.x) < cols + 4 && Math.abs(z - POCKET_AT.z) < rows + 4,
    update(dt: number, animate: boolean) { props.update(dt, animate); },
    destroy() { root.destroy(); meshes.forEach(m => m.destroy()); owned.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); props.destroy(); },
  };
}
export type BossArena = ReturnType<typeof createBossArena>;
