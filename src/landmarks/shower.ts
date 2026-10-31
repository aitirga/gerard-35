import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A beach shower of the Barcelona seafront: a timber deck at sand level with a grey stone slab in the
 * middle, and steel posts with a shower head on an arm and a foot tap below, the yellow and grey bins
 * beside it. The map gives them (amenity=shower); `posts` sets how many stand on the slab.
 */
export const kind = 'shower';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const steel = kit.mat('Acero de la ducha', '#c4c9cc', 0.7), deck = kit.mesh(), slab = kit.mesh();
  const [w, d] = [landmark.w * kit.cell, landmark.d * kit.cell];
  deck.box([0, 0.04, 0], [w, 0.06, d]);
  slab.box([0, 0.075, 0], [w * 0.5, 0.02, d * 0.45]);
  kit.add('Tarima de la ducha', deck, kit.surface('fusta-passera', '#6d5a49', 0.15));
  kit.add('Losa de la ducha', slab, kit.surface('granit', '#9a9da0', 0.2));
  const posts = Number(landmark.params.posts ?? 3);
  for (let i = 0; i < posts; i++) {
    const x = (i - (posts - 1) / 2) * 0.7;
    kit.part('Poste de la ducha', 'cylinder', steel, [x, 1.1, 0], [0.07, 2.2, 0.07]);
    kit.part('Brazo de la ducha', 'box', steel, [x, 2.15, 0.15], [0.04, 0.04, 0.3]);
    kit.part('Alcachofa', 'cylinder', steel, [x, 2.1, 0.3], [0.16, 0.04, 0.16]);
    kit.part('Grifo de pie', 'box', steel, [x, 0.35, 0.06], [0.05, 0.05, 0.12]);
  }
  // The bins for plastic and rubbish that stand by each shower.
  kit.part('Papelera amarilla', 'cylinder', kit.mat('Papelera amarilla', '#e9c02a', 0.35), [w / 2 + 0.35, 0.4, -d / 4], [0.45, 0.8, 0.45]);
  kit.part('Papelera gris', 'cylinder', kit.mat('Papelera gris', '#7e8487', 0.35), [w / 2 + 0.35, 0.4, d / 4], [0.45, 0.8, 0.45]);
}
