import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The cast-iron lamp in the middle of the Plaça d'Osca (Sants): a black column on a heavy pedestal,
 * collars up the shaft, and at the top four curled arms round a fifth lantern, about 5.5 m in all
 * (Commons photos of the square, 2017 and 2025). Unlit by day. `colour` the iron.
 */
export const kind = 'fanal-osca';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const iron = kit.mat('Hierro colado', String(landmark.params.colour ?? '#24282a'), 0.35);
  const glass = kit.mat('Cristal del farol', '#d8d0b4', 0.6);
  // The pedestal: a stepped foot, a tapering block and its cap.
  kit.part('Pie del farol', 'cylinder', iron, [0, 0.08, 0], [0.78, 0.16, 0.78]);
  kit.part('Pie del farol', 'cylinder', iron, [0, 0.22, 0], [0.62, 0.12, 0.62]);
  kit.part('Pedestal', 'box', iron, [0, 0.75, 0], [0.42, 0.95, 0.42]);
  kit.part('Cornisa del pedestal', 'box', iron, [0, 1.25, 0], [0.52, 0.08, 0.52]);
  // The shaft, with collars, up to the capital.
  kit.part('Fuste', 'cylinder', iron, [0, 2.75, 0], [0.13, 3.0, 0.13]);
  for (const y of [1.4, 2.0, 3.5]) kit.part('Anillo', 'cylinder', iron, [0, y, 0], [0.2, 0.07, 0.2]);
  kit.part('Capitel', 'cone', iron, [0, 4.32, 0], [0.32, 0.2, 0.32], [180, 0, 0]);
  // Four arms out to their lanterns, each curling up at the end; the fifth lantern on top.
  for (let k = 0; k < 4; k++) {
    const a = (k * 90 + 45) * Math.PI / 180, dx = Math.sin(a), dz = Math.cos(a);
    kit.part('Brazo', 'box', iron, [dx * 0.3, 4.38, dz * 0.3], [0.05, 0.05, 0.6], [0, k * 90 + 45, 0]);
    kit.part('Voluta', 'box', iron, [dx * 0.6, 4.48, dz * 0.6], [0.04, 0.22, 0.04]);
    lantern(dx * 0.6, 4.6, dz * 0.6);
  }
  kit.part('Mástil', 'cylinder', iron, [0, 4.6, 0], [0.07, 0.4, 0.07]);
  lantern(0, 4.85, 0);

  function lantern(x: number, y: number, z: number) {
    kit.part('Farol', 'box', glass, [x, y + 0.16, z], [0.18, 0.26, 0.18]);
    kit.part('Base del farol', 'box', iron, [x, y + 0.02, z], [0.2, 0.04, 0.2]);
    kit.part('Sombrero del farol', 'cone', iron, [x, y + 0.36, z], [0.26, 0.16, 0.26]);
  }
}
