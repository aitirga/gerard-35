import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A breakwater of the Barcelona seafront, the arm that holds the sand behind it: pale granite
 * boulders piled in a ridge along the footprint's length (x), the biggest along the crest and smaller
 * ones spilling down both sides into the water. Each stone is turned a little its own way, from a hash
 * of the landmark's place, so no two breakwaters repeat.
 */
export const kind = 'escullera';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const [L, D] = [landmark.w * kit.cell, landmark.d * kit.cell];
  const stones = [kit.mat('Escollera', '#8d877b', 0.08), kit.mat('Escollera clara', '#a29b8d', 0.08), kit.mat('Escollera oscura', '#6b665d', 0.08)];
  const seed = landmark.x * 7.3 + landmark.z * 3.1, r = (i: number) => { const v = Math.sin((seed + i) * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  let i = 0;
  for (let x = -L / 2 + 0.9; x < L / 2; x += 1.7) for (const row of [-1, 0, 1]) {
    // The crest's blocks stand proud; the flanks' sit lower and further out.
    const s = row ? 1 + r(i++) * 0.7 : 1.6 + r(i++) * 0.6, y = row ? 0.2 : 0.65;
    const at = [x + (r(i++) - 0.5) * 0.8, y, row * D / 3 + (r(i++) - 0.5) * 0.5];
    kit.part('Bloque de escollera', 'box', stones[Math.floor(r(i++) * 3)], at, [s, s * 0.7, s * 0.85], [(r(i++) - 0.5) * 44, r(i++) * 90, (r(i++) - 0.5) * 36]);
  }
}
