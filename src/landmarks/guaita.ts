import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The lookout masts put on Barcelona's beaches for 1992: a heavy timber post leaning out towards
 * the sea (+z) with a slimmer one alongside its upper half, a ladder up its back, a round platform
 * half-way up with upright slats closing its back and a rail round its front, and over it a wide
 * steel hoop on spokes that once carried the shade. Retired from duty, they still stand on several
 * beaches. `lean` in degrees.
 */
export const kind = 'guaita';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const lean = Number(landmark.params.lean ?? 11), rad = lean * Math.PI / 180, height = 8.4, deck = 4.6;
  const timber = kit.mat('Madera de la torre', '#6b5644', 0.12), steel = kit.mat('Acero de la torre', '#4f565a', 0.45);
  const mast = kit.mesh(), rings = kit.mesh();
  // A point `h` metres up the leaning mast, `side` across it, `out` in front of it.
  const up = (h: number, side = 0, out = 0) => [side, h * Math.cos(rad) - out * Math.sin(rad), h * Math.sin(rad) + out * Math.cos(rad)];
  mast.box(up(height / 2), [0.42, height, 0.5], [lean, 0, 0]);
  mast.box(up(height * 0.74, 0.34, -0.05), [0.18, height * 0.52, 0.28], [lean, 0, 0]);
  // The platform's floor and the slats round its back, against the post.
  const floor = up(deck, 0, 1);
  for (let k = 0; k < 12; k++) {
    const a = (k + 0.5) / 12 * Math.PI * 2;
    mast.box([floor[0] + Math.cos(a) * 0.45, floor[1], floor[2] + Math.sin(a) * 0.45], [0.26, 0.1, 0.9], [0, -a * 180 / Math.PI, 0]);
    if (Math.sin(a) < 0) mast.box([floor[0] + Math.cos(a) * 0.86, floor[1] + 0.55, floor[2] + Math.sin(a) * 0.86], [0.12, 1, 0.05], [0, -a * 180 / Math.PI + 90, 0]);
  }
  kit.add('Mástil de vigilancia', mast, timber, { cut: true });
  // Steel: the ladder's rungs on the post's back, the rail round the platform's front, the hoop and its spokes.
  for (let h = 0.4; h < deck; h += 0.35) rings.box(up(h, 0, -0.3), [0.46, 0.04, 0.05], [lean, 0, 0]);
  const ring = (c: number[], r: number, y = 0, thick = 0.05, depth = 0.06, from = 0, to = 16) => {
    for (let k = from; k < to; k++) {
      const a = (k + 0.5) / 16 * Math.PI * 2;
      rings.box([c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r], [2 * Math.PI * r / 16 + 0.02, thick, depth], [0, -a * 180 / Math.PI + 90, 0]);
    }
  };
  ring(floor, 0.88, 0.95, 0.05, 0.06, 0, 8); ring(floor, 0.88, 0.5, 0.05, 0.06, 0, 8);
  const hoop = up(height - 0.5, 0, 1.4);
  ring(hoop, 1.45, 0, 0.09, 0.12);
  for (let k = 0; k < 4; k++) {
    const a = (k + 0.5) / 4 * Math.PI;
    rings.box(hoop, [2.9, 0.06, 0.08], [0, -a * 180 / Math.PI, 0]);
  }
  kit.add('Plataforma de vigilancia', rings, steel, { cut: true });
}
