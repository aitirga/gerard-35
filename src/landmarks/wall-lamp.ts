import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A street lamp on a wall bracket, as along San Juan kalea in Alegia: an iron arm painted blue
 * reaching out from the house front and a cream bowl shade hanging from it. The wall is behind the
 * pivot (local -z); `height` is the bracket's height in metres (default 4.2), `colour` the iron's.
 */
export const kind = 'wall-lamp';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const y = Number(landmark.params.height ?? 4.2);
  const iron = kit.mat('Brazo de farola', String(landmark.params.colour ?? '#2f5584'), 0.45);
  const shade = kit.mat('Tulipa de farola', '#efe4c6', 0.35, 0.05);
  kit.part('Pletina', 'box', iron, [0, y - 0.15, 0.03], [0.16, 0.5, 0.06]);
  kit.part('Brazo', 'box', iron, [0, y, 0.45], [0.07, 0.07, 0.9]);
  kit.part('Tornapuntas', 'box', iron, [0, y - 0.22, 0.25], [0.05, 0.05, 0.58], [40, 0, 0]);
  kit.part('Tulipa', 'cone', shade, [0, y - 0.2, 0.86], [0.5, 0.26, 0.5]);
  kit.part('Remate', 'cylinder', iron, [0, y - 0.02, 0.86], [0.12, 0.08, 0.12]);
}
