import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The bell stage of a square stone belfry, put on a tower the map already extrudes: on each face a
 * round-headed opening with its bell inside behind a low iron rail, and a moulded cornice under the
 * roof. `height` is the tower's height in metres (to its eaves); the
 * footprint is the tower's. San Juan's belfry in Alegia.
 */
export const kind = 'belfry';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const w = landmark.w * kit.cell / 2, d = landmark.d * kit.cell / 2, top = Number(landmark.params.height ?? 24);
  const stone = kit.mat('Piedra del campanario', String(landmark.params.colour ?? '#a29f98'), 0.1);
  const dark = kit.mat('Hueco del campanario', '#1f1d1b', 0.05);
  const bronze = kit.mat('Campana', '#5a4a32', 0.55);
  const iron = kit.mat('Barandilla del campanario', '#26292b', 0.4);
  const openings = kit.mesh(), sill = top - 4.3, spring = top - 2.2, r = 0.85;
  // Each face: the opening's square part and its round head, a hair proud of the wall.
  for (const [nx, nz, half, depth] of [[0, 1, w, d], [0, -1, w, d], [1, 0, d, w], [-1, 0, d, w]] as const) {
    const at = (u: number, y: number): [number, number, number] => nz ? [u, y, nz * (depth + 0.03)] : [nx * (depth + 0.03), y, u];
    const n: [number, number, number] = [nx, 0, nz];
    openings.quad(at(-r, sill), at(r, sill), at(r, spring), at(-r, spring), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    for (let k = 0; k < 10; k++) {
      const a0 = Math.PI * k / 10, a1 = Math.PI * (k + 1) / 10;
      openings.tri(at(0, spring), at(Math.cos(a0) * r, spring + Math.sin(a0) * r), at(Math.cos(a1) * r, spring + Math.sin(a1) * r), n);
    }
    // The bell hanging in it (flattened against the dark, the tower is solid), and the iron rail across its foot.
    const bell = nz ? [0, nz * (depth + 0.1)] : [nx * (depth + 0.1), 0];
    kit.part('Campana', 'cone', bronze, [bell[0], spring - 0.45, bell[1]], nz ? [0.85, 1, 0.16] : [0.16, 1, 0.85]);
    kit.part('Yugo', 'box', iron, [bell[0], spring + 0.1, bell[1]], nz ? [1.3, 0.12, 0.1] : [0.1, 0.12, 1.3]);
    kit.part('Barandilla', 'box', iron, nz ? [0, sill + 0.55, nz * (depth + 0.12)] : [nx * (depth + 0.12), sill + 0.55, 0], nz ? [r * 2, 0.05, 0.05] : [0.05, 0.05, r * 2]);
    for (let k = -3; k <= 3; k++) kit.part('Barrote', 'box', iron, nz ? [k * r / 3.5, sill + 0.28, nz * (depth + 0.12)] : [nx * (depth + 0.12), sill + 0.28, k * r / 3.5], [0.03, 0.55, 0.03]);
    if (half < r) console.warn(`Campanario estrecho: ${landmark.id}`);
  }
  kit.add('Huecos del campanario', openings, dark, { cut: true, shadows: false });
  // The cornice: a stone band a little wider than the tower, under the roof's eaves.
  kit.part('Cornisa', 'box', stone, [0, top - 0.18, 0], [w * 2 + 0.4, 0.36, d * 2 + 0.4]);
  kit.part('Imposta', 'box', stone, [0, sill - 0.12, 0], [w * 2 + 0.16, 0.24, d * 2 + 0.16]);
}
