import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Fiesta bunting strung across a street from one house front to the other: a cord sagging along
 * local x (the footprint's width) at `height` metres (default 6), hung with small triangular flags
 * in plain colours (`colours` overrides them). Alegia's July fiestas. The flags face along local z:
 * turned about 45° they face the camera, at about 135° it sees them edge-on and they vanish.
 */
export const kind = 'bunting';

const COLOURS = ['#c8343c', '#f2efe6', '#2f7a46', '#e7b52f', '#2f5d9a'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const half = landmark.w * kit.cell / 2, y = Number(landmark.params.height ?? 6), sag = Math.min(0.9, half * 0.09);
  const colours = (landmark.params.colours as string[] | undefined) ?? COLOURS;
  const cordY = (x: number) => y - sag * (1 - (x / half) ** 2);
  const cord = kit.mesh(), n = 12;
  for (let k = 0; k < n; k++) {
    const x0 = -half + (2 * half * k) / n, x1 = -half + (2 * half * (k + 1)) / n;
    cord.quad([x0, cordY(x0), 0], [x1, cordY(x1), 0], [x1, cordY(x1) - 0.03, 0], [x0, cordY(x0) - 0.03, 0], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  kit.add('Cordel', cord, kit.mat('Cordel', '#3a3530', 0.2), { shadows: false });
  // One mesh per colour; each flag is drawn on both faces so it reads from either side.
  const flags = colours.map(() => kit.mesh());
  let i = 0;
  for (let x = -half + 0.35; x < half - 0.2; x += 0.42, i++) {
    const top = cordY(x), w = 0.17, mesh = flags[i % colours.length];
    for (const s of [1, -1]) mesh.tri([x - w, top, 0], [x + w, top, 0], [x, top - 0.36, 0.02 * s], [0, 0, s]);
  }
  flags.forEach((mesh, k) => kit.add('Banderitas', mesh, kit.mat(`Banderita ${colours[k]}`, colours[k], 0.15), { shadows: false }));
}
