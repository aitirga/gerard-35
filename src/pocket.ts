import * as pc from 'playcanvas';
import { CAMERA, pocketCellOf, pocketWorld, type PocketPlan } from './arena';
import { BACKDROP } from './particles';
import { createPropKit } from './props';
import type { WorldProp } from './environments';

/**
 * A fight's pocket (docs/combat.md § Dónde se planta un combate): when a fight has no room where it
 * starts (src/arena.ts `stageFight`), the picture breaks into glass (src/post.ts) and the fight goes
 * on in the same stretch of the place, widened until it fits (`planPocket`): a corridor stays a
 * corridor, a corner a corner, a room a room. Its floor and walls in the place's own materials, its
 * own things (a lamp, a tree, a cypress pot) where they stood, its light; the walls on the camera's
 * side cut down to their footing so it sees in; the edges of the copied stretch end in the place's
 * sky. Far from every place, so nothing else shows round it.
 */
export const POCKET_AT = new pc.Vec3(0, 0, -4000);

/** What a pocket is made of. */
export interface PocketSource {
  /** The scene's roots, to take its materials and light from, and where the fight started (world space). */
  roots: readonly pc.Entity[];
  spot: pc.Vec3;
  /** The stretch of the place to build (src/arena.ts `planPocket`), and the place's things. */
  plan: PocketPlan;
  props: readonly WorldProp[];
  /** How tall its walls stand (`Environment.walls`, or a storey's worth). */
  wallHeight: number;
  /** Metres per cell: floor UVs run in metres, as the street's do. */
  metres?: number;
  /** What the place says it is made of, where its meshes cannot tell (Uri's tower: one mesh for the whole ramp). */
  look?: { floor?: pc.Material; wall?: pc.Material; light?: pc.Color };
}

/** The floor under `spot` and the wall nearest it, among the scene's meshes, and the most coloured light about. */
export function sampleLook(roots: readonly pc.Entity[], spot: pc.Vec3) {
  let floor: pc.Material | undefined, floorArea = Infinity, wall: pc.Material | undefined, wallAway = Infinity;
  let light: pc.Color | undefined, lightSat = .12;
  for (const root of roots) {
    for (const component of root.findComponents('render') as pc.RenderComponent[]) {
      if (!component.enabled || !component.entity.enabled) continue;
      for (const mesh of component.meshInstances) {
        const box = mesh.aabb, c = box.center, h = box.halfExtents;
        const outX = Math.max(0, Math.abs(spot.x - c.x) - h.x), outZ = Math.max(0, Math.abs(spot.z - c.z) - h.z);
        // The floor: a thin slab right under the spot, the smallest one there (a pavement, not the whole map).
        if (!outX && !outZ && h.y < .4 && Math.abs(box.getMax().y - spot.y) < .45 && h.x * h.z < floorArea && mesh.material) { floor = mesh.material; floorArea = h.x * h.z; }
        // A wall: something standing on the floor near the spot, taller than a person.
        const away = Math.hypot(outX, outZ);
        if (h.y > .9 && away < 8 && box.getMin().y < spot.y + 1 && box.getMax().y > spot.y + 1.6 && away < wallAway && h.x * h.z < 900 && mesh.material) { wall = mesh.material; wallAway = away; }
      }
    }
    for (const component of root.findComponents('light') as pc.LightComponent[]) {
      if (!component.enabled || component.type === 'directional') continue;
      const p = component.entity.getPosition();
      if (Math.hypot(p.x - spot.x, p.z - spot.z) > 16) continue;
      const { r, g, b } = component.color, top = Math.max(r, g, b), sat = top ? (top - Math.min(r, g, b)) / top : 0;
      if (sat > lightSat) { light = component.color.clone(); lightSat = sat; }
    }
  }
  return { floor, wall, light };
}

/** A mesh builder for the pocket's pieces: positions, normals, UVs (metres) and vertex colours (for materials that shade with them). */
function builder() {
  const b = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[] };
  return {
    quad(corners: number[][], n: number[], uvs: number[][], shade = 1) {
      const first = b.positions.length / 3;
      corners.forEach((p, k) => { b.positions.push(...p); b.normals.push(...n); b.uvs.push(...uvs[k]); b.colors.push(shade, shade, shade, 1); });
      b.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    },
    get empty() { return !b.indices.length; },
    mesh(device: pc.GraphicsDevice) {
      const mesh = new pc.Mesh(device);
      mesh.setPositions(b.positions); mesh.setNormals(b.normals); mesh.setUvs(0, b.uvs); mesh.setColors(b.colors); mesh.setIndices(b.indices); mesh.update();
      return mesh;
    },
  };
}
type Builder = ReturnType<typeof builder>;
/** The sides of a cell's column from `bottom` to `top` that face where `open(dx, dz)` says, shaded as the tower's are. */
function sides(k: Builder, x0: number, x1: number, z0: number, z1: number, bottom: number, top: number, open: (dx: number, dz: number) => boolean, m: number) {
  const u = (v: number) => v / m;
  if (open(0, 1)) k.quad([[x0, bottom, z1], [x1, bottom, z1], [x1, top, z1], [x0, top, z1]], [0, 0, 1], [[u(x0), u(bottom)], [u(x1), u(bottom)], [u(x1), u(top)], [u(x0), u(top)]], .82);
  if (open(0, -1)) k.quad([[x1, bottom, z0], [x0, bottom, z0], [x0, top, z0], [x1, top, z0]], [0, 0, -1], [[u(x1), u(bottom)], [u(x0), u(bottom)], [u(x0), u(top)], [u(x1), u(top)]], .82);
  if (open(1, 0)) k.quad([[x1, bottom, z1], [x1, bottom, z0], [x1, top, z0], [x1, top, z1]], [1, 0, 0], [[u(z1), u(bottom)], [u(z0), u(bottom)], [u(z0), u(top)], [u(z1), u(top)]], .74);
  if (open(-1, 0)) k.quad([[x0, bottom, z0], [x0, bottom, z1], [x0, top, z1], [x0, top, z0]], [-1, 0, 0], [[u(z0), u(bottom)], [u(z1), u(bottom)], [u(z1), u(top)], [u(z0), u(top)]], .74);
}

export function createPocket(app: pc.Application, source: PocketSource, random: () => number = Math.random) {
  const device = app.graphicsDevice, metres = source.metres ?? 1, { plan } = source;
  const root = new pc.Entity('Bolsillo de combate'); root.setPosition(POCKET_AT); app.root.addChild(root);
  const owned: pc.StandardMaterial[] = [];
  const plain = (hex: string) => { const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = .2; m.useMetalness = false; m.update(); owned.push(m); return m; };
  const place = { ...sampleLook(source.roots, source.spot), ...source.look };
  const floorMaterial = place.floor ?? plain('#8d877e'), wallMaterial = place.wall ?? place.floor ?? plain('#6f6862');
  const meshes: pc.Mesh[] = [];
  const add = (name: string, k: Builder, material: pc.Material, shadows = true) => {
    if (k.empty) return;
    const mesh = k.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
    root.addChild(e);
  };
  const { cells } = plan, centre = plan.stage.centre;
  const kind = (x: number, z: number) => cells[z]?.[x] ?? 'void';
  const local = (x: number, z: number) => ({ x: x - centre.x, z: z - centre.z });
  // The camera's side: walls there are cut down to their footing, so it sees in.
  const camera = CAMERA[plan.stage.layout], flat = Math.hypot(camera.x, camera.z), toward = { x: camera.x / flat, z: camera.z / flat };
  const front = (x: number, z: number) => { const p = local(x, z); return p.x * toward.x + p.z * toward.z > 1.4; };

  const floor = builder(), under = builder(), walls = builder();
  const depth = 1.4, width = cells[0]?.length ?? 0, length = cells.length;
  /** How tall each wall was built, for particles to meet (`world`). */
  const tops = new Float32Array(width * length);
  const flatUv = (x0: number, x1: number, z0: number, z1: number) => [[x0 / metres, z1 / metres], [x1 / metres, z1 / metres], [x1 / metres, z0 / metres], [x0 / metres, z0 / metres]];
  cells.forEach((row, z) => row.forEach((c, x) => {
    const p = local(x, z), x0 = p.x - .5, x1 = p.x + .5, z0 = p.z - .5, z1 = p.z + .5;
    // Where the copied stretch ends, it is torn off above the sky.
    if (c !== 'void') sides(under, x0, x1, z0, z1, -depth - random() * .8, 0, (dx, dz) => kind(x + dx, z + dz) === 'void', metres);
    if (c === 'floor' || c === 'prop') floor.quad([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [0, 1, 0], flatUv(x0, x1, z0, z1));
    else if (c === 'wall') {
      const top = front(x, z) ? .35 : source.wallHeight * (.94 + random() * .12);
      tops[z * width + x] = top;
      walls.quad([[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], [0, 1, 0], flatUv(x0, x1, z0, z1), .9);
      // Every side a neighbour does not hide: open ground, the sky, or a neighbour cut lower.
      sides(walls, x0, x1, z0, z1, 0, top, (dx, dz) => kind(x + dx, z + dz) !== 'wall' || front(x + dx, z + dz) !== front(x, z), metres);
    }
  }));
  add('Suelo del bolsillo', floor, floorMaterial, false);
  add('Bajo del bolsillo', under, wallMaterial);
  add('Muros del bolsillo', walls, wallMaterial);

  // The place's own things where they stood (a widened row or column does not copy them).
  const kit = createPropKit(device);
  for (const prop of source.props) {
    const c = pocketCellOf(plan, { x: prop.x, z: prop.z });
    if (kind(c.x, c.z) !== 'prop') continue;
    const p = local(c.x, c.z);
    kit.place(prop, root, new pc.Vec3(p.x, 0, p.z));
  }

  // Its light: the place's most coloured light about, or a warm one, over the fight and along it.
  const colour = place.light ?? new pc.Color(1, .93, .82);
  for (const [x, z, intensity] of [[0, 1.5, place.light ? 1.6 : 1.1], [-5, -2, .7], [5, -2, .7]] as const) {
    const light = new pc.Entity('Luz del bolsillo');
    light.addComponent('light', { type: 'omni', color: colour, intensity, range: 13, castShadows: false });
    light.setLocalPosition(x, 4.2, z); root.addChild(light);
  }

  return {
    root,
    /** The middle of the fight, in world space. */
    centre: POCKET_AT.clone(),
    /** How high the floor stands (it is flat). */
    floorAt: () => POCKET_AT.y,
    /** What the fight's particles land on and bounce off while it lasts (effects `setFightStage`): its floor, its walls, its things a metre tall. */
    world: pocketWorld(plan, POCKET_AT, (x, z) => kind(x, z) === 'prop' ? 1 : tops[z * width + x], BACKDROP),
    /** Whether a world point lies over the pocket. */
    contains: (x: number, z: number) => Math.abs(x - POCKET_AT.x) < width + 4 && Math.abs(z - POCKET_AT.z) < length + 4,
    update(dt: number, animate: boolean) { kit.update(dt, animate); },
    destroy() { root.destroy(); meshes.forEach(m => m.destroy()); owned.forEach(m => m.destroy()); kit.destroy(); },
  };
}
export type Pocket = ReturnType<typeof createPocket>;
