import * as pc from 'playcanvas';
import { TOWER, inTower, onTop, towerHeights, type TowerSpec } from './tower';

/**
 * How La torre de Uri looks (src/tower.ts has its shape): the ramp as stone columns as high as
 * each cell stands, walls of dark brick that always rise well over the ramp beside them (you
 * never see out, only up), violet lanterns in the walls, and on top El Vértigo with Uri and Nil.
 * Everything is two merged meshes, so the whole tower is a handful of draw calls.
 */
export interface TowerScenery {
  toWorld: (x: number, z: number) => pc.Vec3;
  addSurface: (px: number, pz: number, w: number, d: number, top: number) => void;
}
const WALL_OVER = 2.6;

export function buildTower(app: pc.Application, grid: readonly string[], scenery: TowerScenery, t: TowerSpec = TOWER) {
  const root = new pc.Entity('La torre de Uri'); app.root.addChild(root);
  const heights = towerHeights(grid, t);
  const materials: pc.StandardMaterial[] = [];
  const meshes: pc.Mesh[] = [];
  const mat = (hex: string, glow = 0) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = .15; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); return m;
  };
  const height = (x: number, z: number) => heights.get(`${x},${z}`);
  // Columns: a top and the four sides that something lower can see.
  const floor = { positions: [] as number[], normals: [] as number[], colors: [] as number[], indices: [] as number[] };
  const walls = { positions: [] as number[], normals: [] as number[], colors: [] as number[], indices: [] as number[] };
  const quad = (b: typeof floor, corners: number[][], n: number[], shade: number) => {
    const i = b.positions.length / 3;
    for (const c of corners) { b.positions.push(...c); b.normals.push(...n); b.colors.push(shade, shade, shade, 1); }
    b.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const column = (b: typeof floor, cx: number, cz: number, top: number, around: (dx: number, dz: number) => number, shade: number) => {
    const p = scenery.toWorld(cx, cz), x0 = p.x - .5, x1 = p.x + .5, z0 = p.z - .5, z1 = p.z + .5;
    quad(b, [[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], [0, 1, 0], shade);
    const sides: [number, number, number[][], number[]][] = [
      [0, 1, [[x0, 0, z1], [x1, 0, z1], [x1, top, z1], [x0, top, z1]], [0, 0, 1]],
      [0, -1, [[x1, 0, z0], [x0, 0, z0], [x0, top, z0], [x1, top, z0]], [0, 0, -1]],
      [1, 0, [[x1, 0, z1], [x1, 0, z0], [x1, top, z0], [x1, top, z1]], [1, 0, 0]],
      [-1, 0, [[x0, 0, z0], [x0, 0, z1], [x0, top, z1], [x0, top, z0]], [-1, 0, 0]],
    ];
    for (const [dx, dz, corners, n] of sides) if (around(dx, dz) < top - .01) quad(b, corners, n, shade * .72);
  };
  const lanterns: pc.Vec3[] = [];
  const wallTop = (x: number, z: number) => {
    let near = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) near = Math.max(near, height(x + dx, z + dz) ?? 0);
    return near + WALL_OVER;
  };
  const size = t.walls[0] + 1;
  for (let z = t.centre.z - size; z <= t.centre.z + size; z++) for (let x = t.centre.x - size; x <= t.centre.x + size; x++) {
    if (!inTower({ x, z }, t)) continue;
    const h = height(x, z);
    const around = (dx: number, dz: number) => grid[z + dz]?.[x + dx] === '#' ? wallTop(x + dx, z + dz) : height(x + dx, z + dz) ?? 0;
    if (h !== undefined) {
      // Darker the higher it climbs: the light stays below.
      const shade = onTop({ x, z }, t) ? .55 : .9 - .35 * (h / (t.rise * (t.walls.length - 1)));
      if (h > .01) column(floor, x, z, h, around, shade);
      scenery.addSurface(x, z, 1, 1, h);
    } else if (grid[z]?.[x] === '#') {
      const top = wallTop(x, z);
      column(walls, x, z, top, around, .8 + ((x * 7 + z * 13) % 5) * .04);
      if ((x * 3 + z * 5) % 11 === 0) lanterns.push(scenery.toWorld(x, z).add(new pc.Vec3(0, top - .9, 0)));
    }
  }
  const instance = (b: typeof floor, material: pc.StandardMaterial, name: string, shadows: boolean) => {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(b.positions); mesh.setNormals(b.normals); mesh.setColors(b.colors); mesh.setIndices(b.indices); mesh.update();
    meshes.push(mesh);
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
    root.addChild(e);
  };
  // The ramp's stone glows faintly, so the way up always reads in the dark; the walls stay dark and
  // cast no shadow into the narrow corridors (the haze and their height do the oppressing).
  const stone = mat('#9a8fb0', .22); stone.diffuseVertexColor = true; stone.update();
  const brick = mat('#4a3550', .05); brick.diffuseVertexColor = true; brick.update();
  instance(floor, stone, 'Rampa', true);
  instance(walls, brick, 'Muros', false);
  // Violet lanterns in the walls: the only warm-ish light up the tower.
  const glow = mat('#c9a2ff', 2.6);
  lanterns.forEach((at, i) => {
    const lamp = new pc.Entity('Farol'); lamp.addComponent('render', { type: 'box', material: glow, castShadows: false });
    lamp.setLocalScale(.24, .45, .24); lamp.setPosition(at); root.addChild(lamp);
    // Some of them really light the ramp around them (a few lights, no shadows: cheap).
    if (i % 4 === 0) {
      const light = new pc.Entity('Luz del farol'); light.addComponent('light', { type: 'omni', color: new pc.Color(.72, .52, 1), intensity: 1.6, range: 9, castShadows: false });
      light.setPosition(at.x, at.y + .4, at.z); root.addChild(light);
    }
  });
  // Around Gerard a soft light goes with him up the tower, so the party can always be seen.
  const near = new pc.Entity('Luz de Gerard'); near.addComponent('light', { type: 'omni', color: new pc.Color(1, .86, .74), intensity: 1.4, range: 7, castShadows: false });
  root.addChild(near);
  const top = t.rise * (t.walls.length - 1);
  return {
    root,
    /** Where El Vértigo stands on top, in world space, and the height of the platform. */
    summit: scenery.toWorld(t.centre.x, t.centre.z).add(new pc.Vec3(0, top, 0)),
    heightAt: (x: number, z: number) => height(Math.round(x), Math.round(z)) ?? 0,
    /** Keeps the soft light over Gerard. */
    follow(at: pc.Vec3) { near.setPosition(at.x, at.y + 2.2, at.z); },
    destroy() { root.destroy(); meshes.forEach(m => m.destroy()); materials.forEach(m => m.destroy()); },
  };
}
export type Tower = ReturnType<typeof buildTower>;
