import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The lookout masts put on Barcelona's beaches for 1992: two steel-shod timber members leaning out
 * towards the sea (+z), a round railed platform half-way up reached by a ladder, and a shade ring at
 * the top. Retired from duty, they still stand on several beaches. `lean` in degrees.
 */
export const kind = 'guaita';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const lean = Number(landmark.params.lean ?? 11), rad = lean * Math.PI / 180, height = 8.2;
  const timber = kit.mat('Madera de la torre', '#7c6a58', 0.12), steel = kit.mat('Acero de la torre', '#6e7579', 0.45);
  const mast = kit.mesh(), rings = kit.mesh();
  // A point `h` metres up the leaning mast, `side` across it.
  const up = (h: number, side = 0, out = 0) => [side, h * Math.cos(rad) - out * Math.sin(rad), h * Math.sin(rad) + out * Math.cos(rad)];
  for (const side of [-0.26, 0.26]) mast.box(up(height / 2, side), [0.24, height, 0.36], [lean, 0, 0]);
  // Rungs between the members, every 35 cm up to the platform.
  for (let h = 0.4; h < 4.6; h += 0.35) mast.box(up(h, 0, -0.04), [0.5, 0.05, 0.06], [lean, 0, 0]);
  kit.add('Mástil de vigilancia', mast, timber, { cut: true });
  // The platform: a round floor and rail at 4.6 m, on the sea side; the shade ring at the top.
  const ring = (h: number, out: number, r: number, y = 0, thick = 0.05, depth = 0.06) => {
    const c = up(h, 0, out);
    for (let k = 0; k < 16; k++) {
      const a = (k + 0.5) / 16 * Math.PI * 2;
      rings.box([c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r], [2 * Math.PI * r / 16 + 0.02, thick, depth], [0, -a * 180 / Math.PI + 90, 0]);
    }
  };
  ring(4.6, 0.9, 0.85, 0.95); ring(4.6, 0.9, 0.85, 0.5);
  ring(height - 0.4, 1.2, 1.25, 0, 0.06, 0.1);
  const floor = up(4.6, 0, 0.9);
  rings.box(floor, [1.8, 0.08, 1.8], [0, 45, 0]);
  kit.add('Plataforma de vigilancia', rings, steel, { cut: true });
}
