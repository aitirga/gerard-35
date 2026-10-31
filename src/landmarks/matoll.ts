import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Dry Mediterranean scrub on a hillside: prickly pears (`figuera`, figueres de moro: clumps of
 * flat oval pads, a few red fruits on their rims) or agaves (`atzavara`: a rosette of thick,
 * pointed blue-grey leaves), `count` of them scattered over the footprint (`size_m`), `seed`
 * varies them. Low, so it never hides anyone; plant it where nobody walks.
 * With `over: "forest"` (and no turn) it covers instead every scrub cell of the place the paths
 * leave with low clumps (rosemary, mastic, broom, tall dry grass), so a slope reads as wild ground.
 */
export const kind = 'matoll';

type V3 = [number, number, number];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  if (landmark.params.over === 'forest') { scrub(kit, landmark); return; }
  const p = landmark.params, count = Number(p.count ?? 3), seed = Number(p.seed ?? 1);
  const w = landmark.w * kit.cell, d = landmark.d * kit.cell;
  const rand = (i: number) => { const v = Math.sin((i + seed * 31) * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0; k < count; k++) {
    const x = (rand(k * 3) - 0.5) * w, z = (rand(k * 3 + 1) - 0.5) * d, s = 0.8 + rand(k * 3 + 2) * 0.5;
    if (p.kind === 'atzavara') agave(kit, x, z, s, k + seed);
    else pear(kit, x, z, s, k + seed);
  }
}

/** A prickly pear: pads growing out of pads, each a flattened oval turned its own way. */
function pear(kit: LandmarkKit, x: number, z: number, s: number, n: number) {
  const pads = [kit.mat('Pala de chumbera', '#6f8a55', 0.15), kit.mat('Pala de chumbera clara', '#88a066', 0.15), kit.mat('Pala de chumbera seca', '#7d8350', 0.15)];
  const fruit = kit.mat('Higo chumbo', '#b0364a', 0.3);
  const r = (i: number) => { const v = Math.sin((i + n * 17) * 91.7) * 43758.5453; return v - Math.floor(v); };
  const level = (count: number, y: number, spread: number, size: number, from: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count + r(from + i)) * 360, dx = Math.sin(a * Math.PI / 180) * spread * s, dz = Math.cos(a * Math.PI / 180) * spread * s;
      kit.part('Pala', 'sphere', pads[(i + from) % 3], [x + dx, y * s, z + dz], [0.42 * size * s, 0.55 * size * s, 0.09 * s], [r(from + i + 9) * 30 - 15, a, (r(from + i + 5) - 0.5) * 50]);
      if (r(from + i + 7) > 0.55) kit.part('Higo', 'sphere', fruit, [x + dx, (y + 0.3 * size) * s, z + dz], [0.07 * s, 0.09 * s, 0.07 * s]);
    }
  };
  level(3, 0.25, 0.12, 1, 0);
  level(4, 0.62, 0.3, 0.9, 10);
  level(3, 0.95, 0.22, 0.75, 20);
}

/** An agave: a ground rosette of long, thick leaves that rise and fan out, the inner ones upright. */
function agave(kit: LandmarkKit, x: number, z: number, s: number, n: number) {
  const leaves = [kit.mat('Pita', '#7f9a8c', 0.2), kit.mat('Pita clara', '#93ac9a', 0.2), kit.mat('Pita seca', '#a39c72', 0.15)];
  for (let i = 0; i < 13; i++) {
    const inner = i > 8, tilt = inner ? 18 : 48 + (i % 3) * 12, len = (inner ? 0.75 : 0.95) * s, t = tilt * Math.PI / 180;
    // Turn first, then lean: each leaf fans out its own way from the rosette's heart.
    const turn = new pc.Entity('Roseta'); kit.root.addChild(turn);
    turn.setLocalPosition(x, 0, z); turn.setLocalEulerAngles(0, i * 137.5 + n * 40, 0);
    kit.part('Hoja de pita', 'cone', leaves[i === 0 ? 2 : i % 2], [0, Math.cos(t) * len / 2, Math.sin(t) * len / 2], [0.16 * s, len, 0.07 * s], [tilt, 0, 0], turn);
  }
}

/** One clump in most scrub cells (blocked cells inside the place's forest areas), jittered and sized at random. */
function scrub(kit: LandmarkKit, landmark: GeoLandmark) {
  const { grid, areas } = kit.scene, cell = kit.cell;
  const shades = [['Matorral', '#5b6239'], ['Matorral seco', '#7d7a4a'], ['Matorral oscuro', '#454c2d'], ['Hierba seca alta', '#9a8a58']]
    .map(([name, hex]) => ({ m: kit.mat(name, hex, 0.08), b: kit.mesh() }));
  const rand = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid[z].length; x++) {
    if (grid[z][x] !== '#' || !areas.forest.some(poly => inside(x, z, poly))) continue;
    const k = x * 131 + z * 977;
    if (rand(k) < 0.45) continue;
    const r = 0.3 + rand(k + 1) * 0.35, h = r * (0.55 + rand(k + 2) * 0.55);
    const cx = (x - landmark.x + (rand(k + 3) - 0.5) * 0.4) * cell, cz = (z - landmark.z + (rand(k + 4) - 0.5) * 0.4) * cell;
    blob(shades[Math.floor(rand(k + 5) * shades.length)].b, [cx, 0, cz], r, h, rand(k + 6));
  }
  for (const s of shades) kit.add(s.m.name, s.b, s.m);
}

/** A low-poly clump: a squat double pyramid half sunk in the ground. */
function blob(b: ReturnType<LandmarkKit['mesh']>, [cx, cy, cz]: V3, r: number, h: number, turn: number) {
  const ring = [0, 1, 2, 3, 4, 5].map(i => { const a = (i / 6 + turn) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const top: V3 = [cx, cy + h, cz], bottom: V3 = [cx, cy - h * 0.4, cz];
  for (let i = 0; i < 6; i++) {
    const p: V3 = [ring[i][0], cy + h * 0.3, ring[i][1]], q: V3 = [ring[(i + 1) % 6][0], cy + h * 0.3, ring[(i + 1) % 6][1]];
    const out = [(p[0] + q[0]) / 2 - cx, (p[2] + q[2]) / 2 - cz];
    b.tri(p, q, top, [out[0], 0.8, out[1]]);
    b.tri(p, q, bottom, [out[0], -0.3, out[1]]);
  }
}

function inside(px: number, pz: number, poly: number[][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[j];
    if ((z1 > pz) !== (z2 > pz) && px < (x2 - x1) * (pz - z1) / (z2 - z1) + x1) hit = !hit;
  }
  return hit;
}
