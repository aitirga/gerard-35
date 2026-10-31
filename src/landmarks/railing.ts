import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

type V3 = [number, number, number];

/**
 * A railing along a river bank or a drop: `points` is its line, [x, z] in metres from the landmark's
 * position (x to the right of the screen, z towards the camera, before `rotation_deg`). `style` is
 * `iron` (a painted top rail, a lower rail and thin balusters, `colour` default the riverside green
 * of Alegia) or `wood` (dark posts and two plain rails, as along a country road). About a metre high:
 * it shows where the street ends without ever hiding Gerard.
 */
export const kind = 'railing';

/** A square bar from `a` to `b` (its centre line), `t` thick. */
function bar(mesh: MeshBuilder, a: V3, b: V3, t: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1;
  // Two directions across the bar: sideways in the ground plane, and the one square to both.
  const h = Math.hypot(dx, dz);
  const side: V3 = h > 1e-6 ? [-dz / h * t / 2, 0, dx / h * t / 2] : [t / 2, 0, 0];
  const up: V3 = [(dy * side[2] - dz * side[1]) / len, (dz * side[0] - dx * side[2]) / len, (dx * side[1] - dy * side[0]) / len];
  const p = (o: V3, s: number, u: number): V3 => [o[0] + side[0] * s + up[0] * u, o[1] + side[1] * s + up[1] * u, o[2] + side[2] * s + up[2] * u];
  for (const [s0, u0, s1, u1] of [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]]) {
    const n: V3 = [side[0] * (s0 + s1) + up[0] * (u0 + u1), side[1] * (s0 + s1) + up[1] * (u0 + u1), side[2] * (s0 + s1) + up[2] * (u0 + u1)];
    mesh.quad(p(a, s0, u0), p(b, s0, u0), p(b, s1, u1), p(a, s1, u1), n, [0, 0], [len, 0], [len, t], [0, t]);
  }
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const points = (landmark.params.points as [number, number][] | undefined) ?? [[-1, 0], [1, 0]];
  const wood = landmark.params.style === 'wood';
  const colour = String(landmark.params.colour ?? (wood ? '#4a3a2c' : '#4f8a3c'));
  const mesh = kit.mesh(), top = wood ? 0.95 : 1.0, step = wood ? 2.2 : 1.6;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1], len = Math.hypot(x1 - x0, z1 - z0);
    const at = (t: number, y: number): V3 => [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t];
    bar(mesh, at(0, top), at(1, top), wood ? 0.1 : 0.06);
    bar(mesh, at(0, wood ? 0.5 : 0.18), at(1, wood ? 0.5 : 0.18), wood ? 0.08 : 0.04);
    const posts = Math.max(1, Math.round(len / step));
    for (let k = 0; k <= posts; k++) {
      if (k === 0 && i > 0) continue;
      bar(mesh, at(k / posts, 0), at(k / posts, top + (wood ? 0.05 : 0.03)), wood ? 0.12 : 0.07);
    }
    // Iron balusters between the posts, every 25 cm.
    if (!wood) for (let k = 1, n = Math.round(len / 0.25); k < n; k++) bar(mesh, at(k / n, 0.18), at(k / n, top), 0.022);
  }
  kit.add(wood ? 'Valla de madera' : 'Barandilla', mesh, kit.mat(wood ? 'Valla de madera' : 'Barandilla', colour, wood ? 0.1 : 0.45), { shadows: !wood });
}
