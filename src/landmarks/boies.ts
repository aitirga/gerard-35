import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The line of yellow buoys off Barcelona's beaches that keeps boats out of the bathing water: round
 * floats every `every_m` metres along the footprint's length (x), riding low in the sea, each with
 * a darker band where the rope ties on. Not solid: it stands in the water, past where anyone walks.
 */
export const kind = 'boies';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const length = landmark.w * kit.cell, every = Number(landmark.params.every_m ?? 9);
  const float = kit.mat('Boya', '#f2c230', 0.4), band = kit.mat('Cinta de la boya', '#8f7420', 0.2);
  for (let x = -length / 2; x <= length / 2 + 0.01; x += every) {
    kit.part('Boya', 'sphere', float, [x, 0.1, 0], [0.6, 0.55, 0.6]);
    kit.part('Cinta de la boya', 'cylinder', band, [x, 0.08, 0], [0.62, 0.07, 0.62]);
  }
}
