import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A zebra crossing painted on a street without lane markings (a town street, where the game draws
 * no traffic): white bars across the whole footprint, `size_m` [the street's width, the bars'
 * length], the bars running along local z with the traffic.
 */
export const kind = 'pas-zebra';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const W = landmark.w * kit.cell, D = landmark.d * kit.cell, bars = kit.mesh();
  const count = Math.max(2, Math.floor((W - 0.3) / 1)), x0 = -(count - 1) / 2, y = 0.062;  // just over the asphalt (5 cm up)
  for (let i = 0; i < count; i++) {
    const x = x0 + i;
    bars.quad([x - 0.25, y, -D / 2], [x + 0.25, y, -D / 2], [x + 0.25, y, D / 2], [x - 0.25, y, D / 2], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  kit.add('Paso de cebra', bars, kit.mat('Pintura vial', '#ecebe4', 0.2, 0.15), { shadows: false });
}
