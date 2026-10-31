import type { GeoBuilding, GeoLandmark, GeoPoint } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';
import { ENVIRONMENTS, type EnvironmentId } from '../environments.ts';
import { bar, box, prism } from '../landmark-shapes.ts';

/**
 * What stands on Barcelona's flat roofs (terrats), seen from the diorama camera: the hut where the
 * stair comes out, often with the fibre-cement water tank on top, TV aerials and washing lines. For
 * every flat-roofed building of the place `zone` (its EnvironmentId; `skip` lists ids dressed by hand) whose footprint's centre lies
 * inside this landmark's footprint. Each piece is placed where it fits inside the real outline. A
 * roof's pieces are one mesh painted from a small palette that opens and closes with its building's
 * see-through cut: nothing floats over the hole round Gerard, and no hut is eaten on a roof that stays.
 */
export const kind = 'terrats';

/** The palette's swatches: the huts' two renders, the fibre-cement tank, iron and the washing. */
const PALETTE = ['#c9b89c', '#ad8768', '#bdb8ad', '#3a3d3f', '#f2efe6', '#5e86c4', '#c8574e'];
const HUTS = [0, 1], TANK = 2, IRON = 3, CLOTHES = [4, 5, 6];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const scene = ENVIRONMENTS[String(landmark.params.zone) as EnvironmentId]?.geo;
  if (!scene) return;
  const cell = kit.cell, every = Number(landmark.params.every ?? 1);
  const material = kit.mat('Terrats', '#ffffff', 0.15);
  material.diffuseMap = kit.texture(palette()); material.update();
  const within = (b: GeoBuilding) => Math.abs(b.box.cx - landmark.x) <= landmark.w / 2 && Math.abs(b.box.cz - landmark.z) <= landmark.d / 2;
  const skip = (landmark.params.skip as string[] | undefined) ?? [];
  scene.buildings.filter(b => b.roof === 'flat' && b.levels >= 3 && within(b) && !skip.includes(b.id)).forEach((b, n) => {
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
    const roof = kit.mesh();
    /** Adds what `draw` builds to the roof's mesh, painted in one swatch of the palette. */
    const paint = (swatch: number, draw: (m: MeshBuilder) => void) => {
      const from = roof.uvs.length;
      draw(roof);
      for (let i = from; i < roof.uvs.length; i += 2) { roof.uvs[i] = (swatch + 0.5) / PALETTE.length; roof.uvs[i + 1] = 0.5; }
    };
    // The stair's hut, somewhere off the middle, and the water tank on its roof on most of them.
    const spots: [number, number][] = [[-0.22, 0.18], [0.24, -0.2], [0.2, 0.22], [-0.25, -0.18], [0, 0]];
    const spot = spots.map(([a, c]): [number, number] => [a * W, c * D]).find(([u, v]) => fits(u, v, 1.3));
    if (spot) {
      const [hx, hz] = at(...spot), yaw = -angle;
      paint(HUTS[Math.floor(r(1) * HUTS.length)], m => box(m, hx, top, hz, 2.1, 2.3, 2.2, yaw));
      paint(HUTS[0], m => box(m, hx, top + 2.3, hz, 2.4, 0.12, 2.5, yaw));
      if (r(2) > 0.35) paint(TANK, m => prism(m, hx + 0.2, top + 2.42, hz - 0.2, 0.5, 1.05, 8));
    }
    // Aerials on their masts, the old ones with crossbars.
    for (let k = 0; k < (r(3) > 0.4 ? 1 + Math.floor(r(4) * 2) : 0); k++) {
      const u = (r(5 + k) - 0.5) * W * 0.6, v = (r(8 + k) - 0.5) * D * 0.6;
      if (!fits(u, v, 0.3)) continue;
      const [ax, az] = at(u, v), h = 1.8 + r(11 + k) * 1.4;
      paint(IRON, m => {
        bar(m, [ax, top, az], [ax, top + h, az], 0.05);
        for (let c = 0; c < 3; c++) box(m, ax, top + h - 0.25 - c * 0.28, az, 0.9 - c * 0.18, 0.03, 0.03, -angle + r(14 + k) * 2);
      });
    }
    // A washing line between two posts, with the week's clothes pegged on it.
    if (r(20) > 0.62) {
      const u = (r(21) - 0.5) * W * 0.3, v = (r(22) - 0.5) * D * 0.4, len = Math.min(3.4, W * 0.45);
      if (fits(u - len / 2, v, 0.3) && fits(u + len / 2, v, 0.3)) {
        const [ax, az] = at(u - len / 2, v), [bx, bz] = at(u + len / 2, v);
        paint(IRON, m => {
          bar(m, [ax, top, az], [ax, top + 1.75, az], 0.05); bar(m, [bx, top, bz], [bx, top + 1.75, bz], 0.05);
          bar(m, [ax, top + 1.7, az], [bx, top + 1.7, bz], 0.015);
        });
        for (let k = 0; k < 4; k++) {
          const t = 0.15 + k * 0.22 + r(23 + k) * 0.05, w = 0.35 + r(27 + k) * 0.3, h = 0.4 + r(31 + k) * 0.4;
          paint(CLOTHES[(k + Math.floor(r(35) * 4)) % CLOTHES.length], m => box(m, ax + (bx - ax) * t, top + 1.7 - h, az + (bz - az) * t, w, h, 0.02, -angle));
        }
      }
    }
    kit.add('Terrat', roof, material, { building: b.id });
  });
}

/** The swatches side by side, four pixels each, so a piece's single UV reads one flat colour at any mip. */
function palette() {
  const c = document.createElement('canvas'); c.width = PALETTE.length * 4; c.height = 4;
  const ctx = c.getContext('2d')!;
  PALETTE.forEach((colour, i) => { ctx.fillStyle = colour; ctx.fillRect(i * 4, 0, 4, 4); });
  return c;
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
