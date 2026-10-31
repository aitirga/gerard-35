import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

/**
 * The Montseny on Cardedeu's horizon (docs/places/cardedeu.md): the massif's long ridge beyond the
 * map's north edge, as seen from the town's fields (Wikimedia Commons, «Montseny from Cardedeu»):
 * low hills to the west, the high flat-topped summits (Turó de l'Home, Les Agudes) right of the
 * middle, a long slope down to the east. Faceted, hazy blue, paler towards the crest, lit a little
 * from within as distant hills are by the haze. Its footprint is `size_m` (length along the ridge,
 * depth); `height_m` is the summit's height above the plain. `profile` ([position, height] pairs,
 * 0–1) and the `forest`, `colour` and `crest` colours make other ranges, such as the wooded hills in
 * front of it.
 */
export const kind = 'montseny';

/** The ridge's profile, west to east: position along it and height, both 0–1. */
const PROFILE: [number, number][] = [
  [0, 0.1], [0.07, 0.24], [0.15, 0.36], [0.22, 0.33], [0.3, 0.46], [0.37, 0.62], [0.43, 0.8], [0.48, 0.95],
  [0.53, 1], [0.58, 0.97], [0.63, 0.98], [0.69, 0.88], [0.76, 0.74], [0.83, 0.58], [0.9, 0.4], [0.96, 0.22], [1, 0.1],
];
/** Height (0–1) where the hazy forest gives way to the bare upper slopes, and those to the pale crest. */
const UPPER = 0.42, CREST = 0.8;

type V3 = [number, number, number];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const length = landmark.w * kit.cell, depth = landmark.d * kit.cell;
  const height = Number(landmark.params.height_m ?? 60);
  const profile = smooth((landmark.params.profile as [number, number][] | undefined) ?? PROFILE);
  const bands = [kit.mesh(), kit.mesh(), kit.mesh()];
  const band = (h: number) => (h >= CREST ? 2 : h >= UPPER ? 1 : 0);
  // Each profile point: the crest, a shoulder part-way down each side and the foot. Spurs jut out
  // where the jitter says, so the facets catch the sun unevenly like real ridges.
  const jitter = (i: number) => { const v = Math.sin(i * 91.7 + 13.1) * 43758.5453; return v - Math.floor(v); };
  const ring = profile.map(([t, h], i) => {
    const x = (t - 0.5) * length, top = h * height, spread = depth / 2 * (0.55 + 0.45 * h);
    const spur = (jitter(i) - 0.5) * 0.2 * spread;
    return {
      h,
      crest: [x, top, (jitter(i + 40) - 0.5) * depth * 0.08] as V3,
      front: [x + (jitter(i + 7) - 0.5) * 3, top * 0.45, spread * 0.5 + spur] as V3,
      foot: [x, 0, spread] as V3,
      back: [x, 0, -spread] as V3,
    };
  });
  const quad = (b: MeshBuilder, a: V3, c: V3, d: V3, e: V3, facing: V3) => b.quad(a, c, d, e, facing, [0, 0], [1, 0], [1, 1], [0, 1]);
  for (let i = 0; i + 1 < ring.length; i++) {
    const p = ring[i], q = ring[i + 1], high = Math.min(p.h, q.h);
    // The face towards the camera in two bands, crest to shoulder and shoulder to foot.
    quad(bands[band(high)], p.crest, q.crest, q.front, p.front, [0, 0.6, 1]);
    quad(bands[0], p.front, q.front, q.foot, p.foot, [0, 0.4, 1]);
    quad(bands[band(high) === 2 ? 1 : 0], p.crest, q.crest, q.back, p.back, [0, 0.5, -1]);
  }
  for (const [end, side] of [[ring[0], -1], [ring[ring.length - 1], 1]] as const) {
    bands[0].tri(end.foot, end.crest, end.back, [side, 0.3, 0]);
  }
  // Distance flattens a range's relief: every facet's normal leans towards one (up and towards the
  // camera) by `soft`, so the slopes shade gently instead of flashing like cut glass.
  const soft = Number(landmark.params.soft ?? 0.7);
  for (const b of bands) for (let i = 0; i < b.normals.length; i += 3) {
    const n = [b.normals[i] * (1 - soft), b.normals[i + 1] * (1 - soft) + 0.8 * soft, b.normals[i + 2] * (1 - soft) + 0.6 * soft];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    b.normals[i] = n[0] / len; b.normals[i + 1] = n[1] / len; b.normals[i + 2] = n[2] / len;
  }
  const colours = [String(landmark.params.forest ?? '#6b7c8f'), String(landmark.params.colour ?? '#7d8ca3'), String(landmark.params.crest ?? '#a9b3c3')];
  const haze = Number(landmark.params.haze ?? 0.3);
  bands.forEach((b, i) => kit.add(['Montseny, falda', 'Montseny, laderas', 'Montseny, cresta'][i], b, kit.mat(`Montseny ${colours[i]}`, colours[i], 0.02, haze), { shadows: false }));
}

/** The profile with a point halfway between each pair, nudged up or down, so the ridge line is not ruled straight. */
function smooth(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  points.forEach(([t, h], i) => {
    out.push([t, h]);
    const next = points[i + 1];
    if (next) out.push([(t + next[0]) / 2, (h + next[1]) / 2 + (i % 2 ? 0.025 : -0.02)]);
  });
  return out;
}
