import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A hill on the skyline past the map's edge (Montjuïc from the Barceloneta): a long, low ridge of
 * pine woods in a few overlapping swells, paler with distance, the city's roofs at its foot and, with
 * `castle`, a fort's low walls on the top. Its footprint (`size_m`) is the ridge's length and depth;
 * `height_m` its height, scaled down like every backdrop.
 */
export const kind = 'muntanya';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const [L, D] = [landmark.w * kit.cell, landmark.d * kit.cell], H = Number(landmark.params.height_m ?? 24);
  const woods = [kit.mat('Pinar lejano', '#6f8a6b', 0.05), kit.mat('Pinar', '#5f7c5c', 0.05), kit.mat('Pinar claro', '#86997a', 0.05)];
  const swells: [number, number, number, number][] = [[-0.3, 0.55, 0.62, 0.9], [0.05, 1, 0.7, 1], [0.32, 0.8, 0.55, 0.85], [-0.05, 0.6, 0.9, 0.7]];
  swells.forEach(([x, h, w, d], i) => kit.part('Ladera', 'sphere', woods[i % 3], [x * L, -H * 0.25, 0], [L * w, H * h * 2.2, D * d]));
  // The roofs at the hill's foot, a band of low pale blocks.
  const roofs = [kit.mat('Tejados lejanos', '#cdbda3', 0.05), kit.mat('Tejados lejanos claros', '#d9cdb6', 0.05)];
  for (let k = 0; k < 14; k++) {
    const t = k / 13 - 0.5, h = 3 + ((k * 7) % 5);
    kit.part('Manzana lejana', 'box', roofs[k % 2], [t * L * 0.9, h / 2, D * 0.42 + (k % 3) * 1.5], [L * 0.07, h, 6]);
  }
  if (landmark.params.castle) {
    const stone = kit.mat('Murallas lejanas', '#b9ad96', 0.05);
    kit.part('Castillo', 'box', stone, [0.05 * L, H * 0.88, 0], [L * 0.12, H * 0.12, D * 0.18]);
    kit.part('Torre del castillo', 'box', stone, [0.05 * L, H * 0.97, 0], [L * 0.03, H * 0.18, D * 0.05]);
  }
}
