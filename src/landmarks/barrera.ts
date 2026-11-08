import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A boom barrier at a gate for cars (Càmping Eurosport's way in): a squat white post with its motor
 * box, and the arm in red and white bands, `arm_m` long, raised (`raised`, default true: degrees up
 * from level, 80) or down across local +x. Walkers pass beside it; only the post is solid.
 */
export const kind = 'barrera';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const len = Number(landmark.params.arm_m ?? 3.6), up = landmark.params.raised === false ? 0 : Number(landmark.params.raised ?? 80);
  const post = kit.mesh();
  post.box([0, 0.5, 0], [0.34, 1.0, 0.3]);
  post.box([0, 1.04, 0], [0.38, 0.08, 0.34]);
  kit.add('Poste de la barrera', post, kit.mat('Poste de la barrera', '#e7e4dc', 0.3));
  // The arm turns on its hinge at the post's top, along +x; bands every 40 cm in two meshes.
  const a = up * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hinge: [number, number, number] = [0.12, 0.92, 0.2];
  const red = kit.mesh(), white = kit.mesh();
  for (let i = 0, t = 0; t < len; i++, t += 0.4) {
    const t1 = Math.min(len, t + 0.4), mid = (t + t1) / 2;
    (i % 2 ? white : red).box([hinge[0] + mid * c, hinge[1] + mid * s, hinge[2]], [t1 - t, 0.08, 0.06], [0, 0, up]);
  }
  kit.add('Brazo de la barrera', red, kit.mat('Franja roja', '#b8463a', 0.3), { shadows: false });
  kit.add('Brazo de la barrera', white, kit.mat('Franja blanca', '#efece4', 0.3), { shadows: false });
}
