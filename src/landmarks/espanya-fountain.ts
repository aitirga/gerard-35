import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Jujol's fountain in the middle of Plaça d'Espanya (Font dels Tres Mars, 1929): three basins on a
 * triangle, low arms between them out to the corner pedestals with the Oslé brothers' bronze groups,
 * a rusticated podium, the edicle with Blay's three rivers in their niches, three Corinthian columns
 * with gilded capitals, the attic, and the bronze brazier on top with Llobet's Victories and the iron
 * lanterns. About 20 m high and 36 m across; the front (+z) is one corner. `dry`: the basins empty,
 * as during the L8 works; `works`: the island dug up round it, tarps, spoil and a digger, the soil
 * reaching out as far as `works` says (metres, every 30° from the front; a ragged ring if `true`).
 * Nothing of it can hide Gerard (the island is behind barriers), so it all joins the static batch.
 */
export const kind = 'espanya-fountain';

/** The corners (and the arms to them) point at 0°, 120° and 240°; the basins lie between them. */
const CORNERS = [0, 120, 240], BASINS = [60, 180, 300];
const rad = (deg: number) => deg * Math.PI / 180;
const at = (deg: number, r: number, y: number): [number, number, number] => [Math.sin(rad(deg)) * r, y, Math.cos(rad(deg)) * r];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const dry = landmark.params.dry !== false;
  const stone = kit.surface('carreu', '#cbbfa8');
  const rough = kit.surface('mamposteria', '#a69c8c');
  const bronze = kit.mat('Bronce', '#4b4436', 0.45);
  const gold = kit.mat('Capitel dorado', '#b8923e', 0.6);
  const marble = kit.mat('Mármol de los ríos', '#dcc9a2', 0.3);
  const iron = kit.mat('Farol de hierro', '#25282a', 0.4);
  const glow = kit.mat('Cristal del farol', '#ffd79a', 0.3, 0.9);
  const floor = dry ? kit.surface('carreu', '#9a9184') : kit.mat('Agua de la fuente', '#3f6f78', 0.92);

  // The three basins: long ovals along the triangle's sides, a low stone kerb round each.
  for (const a of BASINS) {
    const [cx, , cz] = at(a, 12, 0);
    kit.part('Fondo del estanque', 'cylinder', floor, [cx, 0.12, cz], [22, 0.24, 9.5], [0, a, 0]);
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps * Math.PI * 2, t1 = (i + 1) / steps * Math.PI * 2, tm = (t0 + t1) / 2;
      // A point on the oval (11 m along the side, 4.75 m across), turned to the basin's direction.
      const p = (t: number) => { const u = Math.cos(t) * 11, v = Math.sin(t) * 4.75, c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [cx + u * c + v * s, cz - u * s + v * c]; };
      const [x0, z0] = p(t0), [x1, z1] = p(t1), [xm, zm] = p(tm);
      kit.part('Borde del estanque', 'box', stone, [xm, 0.35, zm], [Math.hypot(x1 - x0, z1 - z0) + 0.12, 0.7, 0.5], [0, Math.atan2(-(z1 - z0), x1 - x0) * 180 / Math.PI, 0]);
    }
    if (dry) for (let i = 0; i < 3; i++) {
      // Rainwater left in the low corners of a dry basin.
      const [px, , pz] = at(a + (i - 1) * 14, 11 + (i % 2) * 2, 0);
      kit.part('Charco', 'cylinder', kit.mat('Charco', '#56676a', 0.9), [px, 0.25, pz], [2.4 - i * 0.5, 0.02, 1.6], [0, a + i * 30, 0]);
    }
  }
  // The arms out to the corners and the pedestals with their bronze groups.
  for (const a of CORNERS) {
    const [mx, , mz] = at(a, 12, 0), [px, , pz] = at(a, 19, 0);
    kit.part('Brazo de la fuente', 'box', stone, [mx, 0.5, mz], [2.6, 1, 14], [0, a, 0]);
    kit.part('Pedestal', 'box', rough, [px, 1.4, pz], [3.6, 2.8, 3.6], [0, a, 0]);
    kit.part('Cornisa del pedestal', 'box', stone, [px, 2.95, pz], [4, 0.3, 4], [0, a, 0]);
    // A group of figures: a bulk, a raised arm and a head, the bronze dark against the sky.
    kit.part('Grupo de bronce', 'box', bronze, [px, 4, pz], [1.8, 2, 1.3], [0, a + 15, 0]);
    kit.part('Figura', 'capsule', bronze, [px + 0.4, 5.3, pz], [0.7, 1.6, 0.7], [0, 0, 12]);
    kit.part('Figura', 'capsule', bronze, [px - 0.5, 4.9, pz + 0.3], [0.6, 1.3, 0.6], [8, 0, -18]);
    kit.part('Cabeza', 'sphere', bronze, [px + 0.55, 6.25, pz], [0.4, 0.45, 0.4]);
    for (const side of [-1, 1]) {
      // Iron lanterns on posts along each arm.
      const [lx, , lz] = at(a + side * 7, 10, 0);
      kit.part('Poste del farol', 'cylinder', iron, [lx, 1.9, lz], [0.12, 2.2, 0.12]);
      kit.part('Farol', 'box', glow, [lx, 3.15, lz], [0.36, 0.5, 0.36]);
      kit.part('Sombrerete', 'cone', iron, [lx, 3.55, lz], [0.5, 0.3, 0.5]);
    }
  }
  // The podium: a rusticated triangle with a spout and its little basin on each side.
  triangle(kit, rough, 0, 3.4, 7.2, 'Podio');
  triangle(kit, stone, 3.4, 3.9, 6.2, 'Cornisa del podio');
  for (const a of BASINS) {
    const [sx, , sz] = at(a, 3.45, 0);
    kit.part('Caño', 'box', bronze, [sx, 1.6, sz], [0.5, 0.5, 0.6], [0, a, 0]);
    const [bx, , bz] = at(a, 4.6, 0);
    kit.part('Pila', 'cylinder', stone, [bx, 0.5, bz], [2.2, 1, 1.6], [0, a, 0]);
  }
  // The edicle: a triangular body with the rivers in their niches, the columns at its corners.
  triangle(kit, stone, 3.9, 12.6, 3.6, 'Edículo');
  for (const a of BASINS) {
    const [nx, , nz] = at(a, 1.85, 0);
    kit.part('Hornacina', 'box', kit.mat('Fondo de hornacina', '#6f665a', 0.1), [nx, 7.9, nz], [2, 6, 0.3], [0, a, 0]);
    const [fx, , fz] = at(a, 2.15, 0);
    kit.part('Río de mármol', 'capsule', marble, [fx, 6.6, fz], [1, 2.6, 0.8]);
    kit.part('Río de mármol', 'sphere', marble, [fx, 5.4, fz], [1.6, 1.1, 1]);
  }
  for (const a of CORNERS) {
    const [cx, , cz] = at(a, 3.9, 0);
    kit.part('Basa', 'box', stone, [cx, 4.3, cz], [1.3, 0.8, 1.3], [0, a, 0]);
    kit.part('Columna corintia', 'cylinder', kit.surface('carreu', '#d9cdb6'), [cx, 8.3, cz], [0.95, 7.2, 0.95]);
    kit.part('Capitel', 'box', gold, [cx, 12.2, cz], [1.35, 0.8, 1.35], [0, a + 45, 0]);
  }
  // The attic, its cornice, and the crown: a drum, the Victories and the bronze brazier.
  triangle(kit, stone, 12.6, 14.8, 5, 'Ático');
  triangle(kit, stone, 14.8, 15.3, 5.6, 'Cornisa del ático');
  kit.part('Tambor', 'cylinder', stone, [0, 16.2, 0], [2.6, 1.8, 2.6]);
  for (const a of BASINS) {
    const [vx, , vz] = at(a, 1.7, 0);
    kit.part('Victoria', 'capsule', bronze, [vx, 16.9, vz], [0.6, 2.1, 0.6]);
    kit.part('Alas', 'box', bronze, [vx, 17.4, vz], [1.1, 0.9, 0.12], [0, a + 90, 0]);
  }
  kit.part('Pie del pebetero', 'cylinder', bronze, [0, 17.6, 0], [0.9, 1, 0.9]);
  kit.part('Pebetero', 'cone', bronze, [0, 18.7, 0], [2.4, 1.3, 2.4], [180, 0, 0]);
  kit.part('Borde del pebetero', 'cylinder', bronze, [0, 19.4, 0], [2.5, 0.12, 2.5]);
  for (const a of CORNERS) {
    // Clusters of three lanterns on the attic's corners.
    const [lx, , lz] = at(a, 4.6, 0);
    kit.part('Brazo de faroles', 'cylinder', iron, [lx, 15.9, lz], [0.14, 1.2, 0.14]);
    for (const side of [-1, 0, 1]) {
      const [ox, , oz] = at(a + side * 12, 4.9, 0);
      kit.part('Farol', 'box', glow, [ox, 16.75, oz], [0.4, 0.6, 0.4]);
      kit.part('Sombrerete', 'cone', iron, [ox, 17.2, oz], [0.55, 0.32, 0.55]);
    }
  }
  if (landmark.params.works) works(kit, Array.isArray(landmark.params.works) ? landmark.params.works.map(Number) : undefined);
}

/** A triangular prism with corners at 0°, 120° and 240°, `r` from the centre, between two heights. */
function triangle(kit: LandmarkKit, m: Parameters<LandmarkKit['add']>[2], y0: number, y1: number, r: number, name: string) {
  const mesh = kit.mesh(), corners = CORNERS.map(a => at(a, r, 0));
  for (let i = 0; i < 3; i++) {
    const [ax, , az] = corners[i], [bx, , bz] = corners[(i + 1) % 3];
    const len = Math.hypot(bx - ax, bz - az), out = at(BASINS[i], 1, 0);
    mesh.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [out[0], 0, out[2]], [0, y0], [len, y0], [len, y1], [0, y1]);
  }
  mesh.tri([corners[0][0], y1, corners[0][2]], [corners[1][0], y1, corners[1][2]], [corners[2][0], y1, corners[2][2]], [0, 1, 0],
    [corners[0][0], corners[0][2]], [corners[1][0], corners[1][2]], [corners[2][0], corners[2][2]]);
  kit.add(name, mesh, m);
}

/**
 * The L8 works on the island (since late 2024): the lawn dug up round the fountain and out to a
 * fringe of grass by the barriers, a few tufts left standing, blue tarps over the trenches, spoil
 * heaps, a small digger and the site cabin. `radii`: how far the soil reaches, every 30°.
 */
function works(kit: LandmarkKit, radii?: number[]) {
  const soil = kit.surface('terra', '#6e5840');
  const ground = kit.mesh(), steps = 72;
  // The dug ground: a ragged ring round the basins, out to `radii` (or towards the shaft, 100°–130°).
  const base = (deg: number) => {
    if (!radii?.length) return 23 + Math.max(0, 1 - Math.abs(deg - 115) / 22) * 24;
    const i = deg / 360 * radii.length, k = Math.floor(i) % radii.length, t = i - Math.floor(i);
    return radii[k] * (1 - t) + radii[(k + 1) % radii.length] * t;
  };
  const reach = (deg: number) => base(deg) + Math.sin(rad(deg) * 3 + 1) * 2.5 + Math.sin(rad(deg) * 7) * 1.2;
  for (let i = 0; i < steps; i++) {
    const a0 = i / steps * 360, a1 = (i + 1) / steps * 360;
    const p0 = at(a0, reach(a0), 0.045), p1 = at(a1, reach(a1), 0.045);
    ground.tri([0, 0.045, 0], p0, p1, [0, 1, 0], [0, 0], [p0[0], p0[2]], [p1[0], p1[2]]);
  }
  kit.add('Tierra removida', ground, soil, { shadows: false });
  // Patches of the old lawn left standing among the trenches.
  const lawn = kit.surface('gespa', '#86a462');
  for (const [a, r, w, d] of [[20, 25, 5, 2.6], [165, 24, 4.4, 2.2], [250, 22, 3.6, 2], [305, 23, 4.4, 2.4], [75, 27, 3.6, 1.8]]) {
    for (const k of [-1, 1]) {
      const [x, , z] = at(a + k * 4, r + k * 0.6, 0);
      kit.part('Hierba que queda', 'cylinder', lawn, [x, 0.06, z], [w * (k < 0 ? 1 : 0.7), 0.03, d * (k < 0 ? 1 : 0.8)], [0, a + k * 25, 0]);
    }
  }
  const tarp = kit.mat('Lona azul', '#2f5f9e', 0.35);
  for (const [a, r, w, d, turn] of [[30, 20, 6, 3.5, 20], [150, 21, 5, 4, -30], [200, 19.5, 7, 3, 70], [118, 34, 8, 5, 10], [270, 21, 4, 3, 45]]) {
    const [x, , z] = at(a, r, 0);
    kit.part('Lona', 'box', tarp, [x, 0.12, z], [w, 0.12, d], [2, turn, 3]);
  }
  const spoil = kit.mat('Montón de tierra', '#7a6247', 0.05);
  for (const [a, r, s] of [[95, 30, 4.5], [130, 40, 5.5], [340, 22, 3], [215, 23, 3.5]]) {
    const [x, , z] = at(a, r, 0);
    kit.part('Montón de tierra', 'sphere', spoil, [x, 0, z], [s, s * 0.55, s * 0.8], [0, a, 0]);
  }
  // A small yellow digger by the shaft, its arm down in a trench.
  const yellow = kit.mat('Excavadora', '#e2a41c', 0.4), dark = kit.mat('Orugas', '#2a2a2a', 0.2);
  const [dx, , dz] = at(108, 38, 0);
  kit.part('Orugas', 'box', dark, [dx, 0.4, dz], [2.4, 0.8, 3.2], [0, 30, 0]);
  kit.part('Excavadora', 'box', yellow, [dx, 1.3, dz], [2.2, 1, 2.6], [0, 30, 0]);
  kit.part('Cabina', 'box', kit.mat('Cabina', '#3c4a52', 0.7), [dx + 0.4, 2.3, dz + 0.3], [1.1, 1.2, 1.2], [0, 30, 0]);
  kit.part('Brazo', 'box', yellow, [dx - 1.4, 2.2, dz - 1.2], [0.4, 0.4, 3.6], [40, 30, 0]);
  kit.part('Cazo', 'box', dark, [dx - 2.3, 0.8, dz - 2.6], [0.9, 0.8, 0.7], [0, 30, 0]);
  // The site cabin: a white container with the contractor's band.
  const [cx, , cz] = at(125, 44, 0);
  kit.part('Caseta de obra', 'box', kit.mat('Caseta', '#e4e2dc', 0.3), [cx, 1.3, cz], [6, 2.6, 2.4], [0, 25, 0]);
  kit.part('Franja de la caseta', 'box', kit.mat('Franja de la caseta', '#2e6ca8', 0.3), [cx, 2.2, cz], [6.05, 0.3, 2.45], [0, 25, 0]);
}
