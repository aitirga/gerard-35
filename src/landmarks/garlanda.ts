import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

type V3 = [number, number, number];

/**
 * Festoons of warm bulbs strung across a pedestrian street over its terraces (Carrer de Blai): the
 * cable zigzags from wall to wall at about 4.8 m, sagging between its hooks, a bulb every `every`
 * metres. Its local x runs along the street over the footprint's width and its local z across it,
 * the walls at ±`width`/2. The bulbs are the place's one glow (docs/visual-style.md): they bloom.
 * Thin and high, so they never hide Gerard. `step`: metres along the street per zigzag.
 */
export const kind = 'garlanda';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const length = landmark.w * kit.cell, half = Number(params.width ?? landmark.d * kit.cell) / 2;
  const step = Number(params.step ?? 5), every = Number(params.every ?? 0.85), sag = Number(params.sag ?? 0.55), high = Number(params.height ?? 4.8);
  const wire = kit.mesh(), bulbs = kit.mesh();
  const runs = Math.max(1, Math.round(length / (step / 2)));
  const x0 = -length / 2;
  for (let k = 0; k < runs; k++) {
    // One sagging run from one wall to the other, as short straight pieces.
    const from: V3 = [x0 + k * step / 2, high, k % 2 ? half : -half], to: V3 = [x0 + (k + 1) * step / 2, high, k % 2 ? -half : half];
    const at = (t: number): V3 => [from[0] + (to[0] - from[0]) * t, high - sag * 4 * t * (1 - t), from[2] + (to[2] - from[2]) * t];
    for (let i = 0; i < 8; i++) bar(wire, at(i / 8), at((i + 1) / 8), 0.025);
    const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
    for (let d = every / 2; d < len; d += every) {
      const p = at(d / len);
      box(wire, p[0], p[1] - 0.07, p[2], 0.012, 0.07, 0.012);
      box(bulbs, p[0], p[1] - 0.16, p[2], 0.075, 0.1, 0.075, 0, true);
    }
    // The hook in the wall where the cable turns.
    box(wire, from[0], high - 0.05, from[2] + (from[2] < 0 ? 0.05 : -0.05), 0.06, 0.1, 0.12);
  }
  kit.add('Cable de la guirnalda', wire, kit.mat('Cable', '#1d1f20', 0.3), { shadows: false });
  kit.add('Bombillas', bulbs, kit.mat('Bombilla de guirnalda', String(params.colour ?? '#ffcf7e'), 0.4, Number(params.glow ?? 2.6)), { shadows: false });
}
