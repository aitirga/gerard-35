import type { GeoLandmark } from '../geo';
import { box, type LandmarkKit } from '../landmarks';

/**
 * The sea edge of the Passeig Marítim (Henrich and Tarrasó, 1992): a low white concrete parapet
 * along the promenade, and below it on the beach side (+z) a timber boardwalk at sand level. One
 * landmark is one straight run, as long as its footprint (`size_m[0]`); the gaps between runs are the
 * steps down to the sand. `boardwalk_m` is the boardwalk's width (0: none), `bollards_m` the spacing
 * of the black bollards along the promenade side (0: none).
 */
export const kind = 'passeig';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const length = landmark.w * kit.cell, deck = Number(landmark.params.boardwalk_m ?? 3), every = Number(landmark.params.bollards_m ?? 0);
  // The wall: 0.65 m over the sand, a coping a little wider on top.
  const wall = kit.mesh();
  box(wall, [0, 0.31, 0], [length, 0.62, 0.32]);
  box(wall, [0, 0.66, 0], [length + 0.04, 0.08, 0.42]);
  kit.add('Pretil del paseo', wall, kit.surface('formigo', '#ebe8e0', 0.08));
  if (deck > 0) {
    // Planks run along the wall, laid on low joists; the deck's edge a shade darker.
    const boards = kit.mesh();
    box(boards, [0, 0.05, 0.21 + deck / 2], [length, 0.06, deck]);
    kit.add('Pasarela de madera', boards, kit.surface('fusta-passera', '#6d5a49', 0.15));
  }
  if (every > 0) {
    const bollard = kit.mat('Pilona', '#1f2224', 0.35);
    for (let x = -length / 2 + every / 2; x < length / 2; x += every) {
      kit.part('Pilona', 'cylinder', bollard, [x, 0.45, -0.75], [0.16, 0.9, 0.16]);
      kit.part('Remate de pilona', 'sphere', bollard, [x, 0.9, -0.75], [0.16, 0.08, 0.16]);
    }
  }
}
