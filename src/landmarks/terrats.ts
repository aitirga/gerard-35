import type { GeoBuilding, GeoLandmark, GeoPoint } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { ENVIRONMENTS, type EnvironmentId } from '../environments.ts';
import { bar, box, prism } from '../landmark-shapes.ts';

/**
 * What stands on Barcelona's flat roofs (terrats), seen from the diorama camera: the hut where the
 * stair comes out, often with the fibre-cement water tank on top, TV aerials and washing lines. For
 * every flat-roofed building of the place `zone` (its EnvironmentId) whose footprint's centre lies
 * inside this landmark's footprint, so a few landmarks share out a whole place. Each piece is placed
 * where it fits inside the real outline, and vanishes with the roof under it wherever the see-through
 * cut opens.
 */
export const kind = 'terrats';

const HUTS = ['#c9b89c', '#ad8768'];
const CLOTHES = ['#f2efe6', '#5e86c4', '#c8574e'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const scene = ENVIRONMENTS[String(landmark.params.zone) as EnvironmentId]?.geo;
  if (!scene) return;
  const cell = kit.cell, every = Number(landmark.params.every ?? 1);
  const huts = HUTS.map(() => kit.mesh()), tanks = kit.mesh(), iron = kit.mesh(), clothes = CLOTHES.map(() => kit.mesh());
  const within = (b: GeoBuilding) => Math.abs(b.box.cx - landmark.x) <= landmark.w / 2 && Math.abs(b.box.cz - landmark.z) <= landmark.d / 2;
  scene.buildings.filter(b => b.roof === 'flat' && b.levels >= 3 && within(b)).forEach((b, n) => {
    if (n % every) return;
    const r = (i: number) => { const v = Math.sin(hash(b.id) * 0.001 + i * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const top = (b.height + 0.25) * cell, { cx, cz, angle } = b.box;
    const ux = Math.cos(angle), uz = Math.sin(angle);
    /** A point of the roof in local metres, from offsets in metres along the box's axes. */
    const at = (u: number, v: number): [number, number] => [(cx - landmark.x) * cell + u * ux - v * uz, (cz - landmark.z) * cell + u * uz + v * ux];
    /** Whether a square of `half` metres round a roof point lies inside the real outline, with a margin. */
    const fits = (u: number, v: number, half: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, c]) => {
      const [px, pz] = at(u + a * (half + 0.5), v + c * (half + 0.5));
      return inside(px / cell + landmark.x, pz / cell + landmark.z, b.poly);
    });
    const W = b.box.w * cell, D = b.box.d * cell;
    if (W * D < 40) return;
    // The stair's hut, somewhere off the middle, and the water tank on its roof on most of them.
    const spots: [number, number][] = [[-0.22, 0.18], [0.24, -0.2], [0.2, 0.22], [-0.25, -0.18], [0, 0]];
    const spot = spots.map(([a, c]): [number, number] => [a * W, c * D]).find(([u, v]) => fits(u, v, 1.3));
    if (spot) {
      const [hx, hz] = at(...spot), yaw = -angle;
      box(huts[Math.floor(r(1) * HUTS.length)], hx, top, hz, 2.1, 2.3, 2.2, yaw);
      box(huts[0], hx, top + 2.3, hz, 2.4, 0.12, 2.5, yaw);
      if (r(2) > 0.35) prism(tanks, hx + 0.2, top + 2.42, hz - 0.2, 0.5, 1.05, 8);
    }
    // Aerials on their masts, the old ones with crossbars.
    for (let k = 0; k < (r(3) > 0.4 ? 1 + Math.floor(r(4) * 2) : 0); k++) {
      const u = (r(5 + k) - 0.5) * W * 0.6, v = (r(8 + k) - 0.5) * D * 0.6;
      if (!fits(u, v, 0.3)) continue;
      const [ax, az] = at(u, v), h = 1.8 + r(11 + k) * 1.4;
      bar(iron, [ax, top, az], [ax, top + h, az], 0.05);
      for (let c = 0; c < 3; c++) box(iron, ax, top + h - 0.25 - c * 0.28, az, 0.9 - c * 0.18, 0.03, 0.03, -angle + r(14 + k) * 2);
    }
    // A washing line between two posts, with the week's clothes pegged on it.
    if (r(20) > 0.62) {
      const u = (r(21) - 0.5) * W * 0.3, v = (r(22) - 0.5) * D * 0.4, len = Math.min(3.4, W * 0.45);
      if (fits(u - len / 2, v, 0.3) && fits(u + len / 2, v, 0.3)) {
        const [ax, az] = at(u - len / 2, v), [bx, bz] = at(u + len / 2, v);
        bar(iron, [ax, top, az], [ax, top + 1.75, az], 0.05); bar(iron, [bx, top, bz], [bx, top + 1.75, bz], 0.05);
        bar(iron, [ax, top + 1.7, az], [bx, top + 1.7, bz], 0.015);
        for (let k = 0; k < 4; k++) {
          const t = 0.15 + k * 0.22 + r(23 + k) * 0.05, w = 0.35 + r(27 + k) * 0.3, h = 0.4 + r(31 + k) * 0.4;
          box(clothes[(k + Math.floor(r(35) * 4)) % CLOTHES.length], ax + (bx - ax) * t, top + 1.7 - h, az + (bz - az) * t, w, h, 0.02, -angle);
        }
      }
    }
  });
  huts.forEach((m, i) => kit.add('Casetas de terrat', m, kit.surface('estuc', HUTS[i]), { cut: 'always' }));
  kit.add('Depósitos de agua', tanks, kit.mat('Fibrocemento', '#bdb8ad', 0.15), { cut: 'always', shadows: false });
  kit.add('Antenas y tendederos', iron, kit.mat('Hierro de terrat', '#3a3d3f', 0.4), { cut: 'always', shadows: false });
  clothes.forEach((m, i) => kit.add('Ropa tendida', m, kit.mat('Ropa tendida', CLOTHES[i], 0.15), { cut: 'always', shadows: false }));
}

function hash(s: string) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; }
function inside(px: number, pz: number, poly: GeoPoint[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[j];
    if ((z1 > pz) !== (z2 > pz) && px < (x2 - x1) * (pz - z1) / (z2 - z1) + x1) hit = !hit;
  }
  return hit;
}
