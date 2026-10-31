import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { seated } from './assegut';

/**
 * A bar's terrace on a square (the Plaça d'Osca): a row of round aluminium tables along its local x,
 * their chairs, full glasses nobody drinks, and sometimes a square parasol over the middle one.
 * `tables` how many (1–3), `parasol` the canvas colour (or nothing), `chairs` per table (2–4),
 * `seed` turns the chairs a little differently at each table. `people` sit on that many chairs of each
 * table, still, every head turned to `look` (a heading in the zone's frame, as for `assegut`).
 */
export const kind = 'terrassa';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const tables = Math.max(1, Math.min(3, Number(params.tables ?? 1)));
  for (let t = 0; t < tables; t++) table(kit, landmark, (t - (tables - 1) / 2) * 1.75, Number(params.seed ?? 0) * 3 + t);
  // A square parasol over the middle table: a pole and a shallow canvas pyramid, which opens the cut round Gerard.
  if (params.parasol !== false && params.parasol !== undefined) {
    const dark = kit.mat('Hierro de terraza', '#2b2f2c', 0.4);
    kit.part('Mástil de la sombrilla', 'cylinder', dark, [0, 1.2, 0], [0.04, 2.4, 0.04]);
    const canvas = kit.mat('Lona de la sombrilla', String(params.parasol), 0.15);
    const tent = kit.mesh(), h = 2.35, peak = 2.65, s = 1.15;
    const corners: [number, number][] = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      const nx = (ax + bx) / 2, nz = (az + bz) / 2;
      tent.tri([ax, h, az], [bx, h, bz], [0, peak, 0], [nx, 0.6, nz], [0, 0], [1, 0], [0.5, 1]);
      tent.tri([ax, h, az], [bx, h, bz], [0, peak, 0], [-nx, -0.6, -nz], [0, 0], [1, 0], [0.5, 1]);
    }
    kit.add('Sombrilla', tent, canvas, { cut: true });
  }
}

function table(kit: LandmarkKit, landmark: GeoLandmark, x: number, seed: number) {
  const { params } = landmark;
  const chairs = Math.max(2, Math.min(4, Number(params.chairs ?? 4)));
  const people = Math.min(chairs, Number(params.people ?? 0)), look = Number(params.look ?? 0) - landmark.angle;
  const alu = kit.mat('Aluminio de terraza', '#a7aaa8', 0.55);
  const dark = kit.mat('Hierro de terraza', '#2b2f2c', 0.4);
  const seatColour = String(params.seat ?? '#3a4a3e');
  const seat = kit.mat('Asiento de terraza', seatColour, 0.3);
  // The table: a round top on a single foot.
  kit.part('Mesa de terraza', 'cylinder', alu, [x, 0.72, 0], [0.7, 0.03, 0.7]);
  kit.part('Pie de la mesa', 'cylinder', dark, [x, 0.36, 0], [0.06, 0.7, 0.06]);
  kit.part('Base de la mesa', 'cylinder', dark, [x, 0.02, 0], [0.45, 0.04, 0.45]);
  // The chairs round it, each turned a little, all facing the table.
  for (let k = 0; k < chairs; k++) {
    const a = (k / chairs) * Math.PI * 2 + seed * 0.7 + Math.sin(seed + k) * 0.25, r = 0.62;
    const cx = x + Math.sin(a) * r, cz = Math.cos(a) * r, yaw = a * 180 / Math.PI;
    const at = (u: number, v: number) => [cx + Math.sin(a) * v + Math.cos(a) * u, cz + Math.cos(a) * v - Math.sin(a) * u];
    for (const [u, v] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      const [lx, lz] = at(u, v);
      kit.part('Pata de silla', 'box', alu, [lx, 0.22, lz], [0.025, 0.44, 0.025], [0, yaw, 0]);
    }
    kit.part('Asiento de silla', 'box', seat, [cx, 0.46, cz], [0.42, 0.04, 0.42], [0, yaw, 0]);
    const [bx, bz] = at(0, 0.2);
    kit.part('Respaldo de silla', 'box', seat, [bx, 0.68, bz], [0.42, 0.4, 0.03], [0, yaw, 0]);
    // Someone on the chair, facing the table (the chair's back is away from it).
    if (k < people) seated(kit, kit.root, cx, cz, yaw + 180, look, 0.48, seed * 5 + k);
  }
  // Full glasses of beer, untouched.
  const beer = kit.mat('Caña', '#e0a840', 0.8), foam = kit.mat('Espuma', '#f4efe2', 0.3);
  for (let k = 0; k < chairs; k++) {
    const a = (k / chairs) * Math.PI * 2 + seed * 0.7, r = 0.2;
    kit.part('Caña llena', 'cylinder', beer, [x + Math.sin(a) * r, 0.8, Math.cos(a) * r], [0.07, 0.13, 0.07]);
    kit.part('Espuma', 'cylinder', foam, [x + Math.sin(a) * r, 0.87, Math.cos(a) * r], [0.07, 0.02, 0.07]);
  }
}
