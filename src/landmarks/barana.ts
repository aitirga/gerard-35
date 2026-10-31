import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A black iron railing of upright bars between a top and a bottom rail, as round Barcelona's
 * viewpoints and excavations: `size_m[0]` long along the landmark's x, or with `ring` a circle of
 * that diameter (the water tank's roof). `h` its height, `y_m` what it stands on (a parapet's top),
 * `colour`; `gap_m` leaves an opening in the middle (a gate), and `bars` false keeps only the rails
 * (the 2 m bar fence is drawn with `h` 2 and its bars further apart, `every_m`).
 */
export const kind = 'barana';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, h = Number(p.h ?? 1), y = Number(p.y_m ?? 0), every = Number(p.every_m ?? 0.13), gap = Number(p.gap_m ?? 0);
  const iron = kit.mat('Barandilla de hierro', String(p.colour ?? '#26272a'), 0.45);
  const length = landmark.w * kit.cell;
  if (p.ring) {
    const r = length / 2, n = Math.max(12, Math.round(Math.PI * length / 1.2));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, mid = (a + b) / 2, chord = 2 * r * Math.sin(Math.PI / n);
      kit.part('Poste', 'box', iron, [Math.cos(a) * r, y + h / 2, Math.sin(a) * r], [0.05, h, 0.05]);
      for (const v of [h - 0.03, h * 0.5]) kit.part('Pasamanos', 'box', iron, [Math.cos(mid) * r, y + v, Math.sin(mid) * r], [chord, 0.04, 0.04], [0, -mid * 180 / Math.PI + 90, 0]);
    }
    return;
  }
  // Straight runs either side of the gate, posts every 1.5 m and bars between.
  const runs = gap > 0 ? [[-length / 2, -gap / 2], [gap / 2, length / 2]] : [[-length / 2, length / 2]];
  for (const [x0, x1] of runs) {
    const span = x1 - x0, mid = (x0 + x1) / 2;
    kit.part('Pasamanos', 'box', iron, [mid, y + h - 0.025, 0], [span, 0.05, 0.05]);
    kit.part('Travesaño', 'box', iron, [mid, y + 0.1, 0], [span, 0.04, 0.04]);
    for (let x = x0; x <= x1 + 1e-6; x += span / Math.max(1, Math.round(span / 1.5))) kit.part('Poste', 'box', iron, [x, y + h / 2, 0], [0.06, h, 0.06]);
    if (p.bars !== false) for (let x = x0 + every; x < x1 - every / 2; x += every) kit.part('Barrote', 'box', iron, [x, y + h / 2, 0], [0.022, h - 0.1, 0.022]);
  }
}
