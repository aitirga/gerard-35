import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

type V3 = [number, number, number];

/**
 * Strings of warm bulbs hung from pine to pine over a campsite (Càmping Eurosport,
 * docs/quests/universidad.md): each of `runs` is a list of points `[x, y, z]` in metres from the
 * landmark's centre (the trunks it is tied to, about 2.7 m up), the cable sagging between them with
 * a bulb every `every` metres and a turn of cable round each trunk. Long straight swags tied to the
 * trees, low over the pitches, not the zigzag festoons over a street (Carrer de Blai's `garlanda`).
 * The bulbs are the place's one glow; thin and high, they never hide Gerard. Not solid. With
 * `switched: true` they are a string the story turns on (the merendero's, dark until its steel door
 * opens): its bulbs are `Bombillas del merendero`, with a material of their own, out of the batch.
 */
export const kind = 'bombetes';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const runs = (landmark.params.runs as V3[][] | undefined) ?? [];
  const every = Number(landmark.params.every ?? 0.7), sagPerMetre = Number(landmark.params.sag ?? 0.06);
  const wire = kit.mesh(), bulbs = kit.mesh();
  for (const run of runs) {
    run.forEach((p, i) => {
      // The cable's turns round the trunk, where it is tied.
      box(wire, p[0], p[1] - 0.06, p[2], 0.26, 0.06, 0.26);
      const q = run[i + 1];
      if (!q) return;
      const len = Math.hypot(q[0] - p[0], q[2] - p[2]), sag = Math.min(0.7, len * sagPerMetre);
      const at = (t: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - sag * 4 * t * (1 - t), p[2] + (q[2] - p[2]) * t];
      for (let k = 0; k < 10; k++) bar(wire, at(k / 10), at((k + 1) / 10), 0.022);
      for (let d = every * 0.75; d < len - every * 0.4; d += every) {
        const b = at(d / len);
        box(wire, b[0], b[1] - 0.08, b[2], 0.012, 0.08, 0.012);
        box(bulbs, b[0], b[1] - 0.2, b[2], 0.1, 0.13, 0.1, 0, true);
      }
    });
  }
  kit.add('Cable de las bombillas', wire, kit.mat('Cable', '#1d1f20', 0.3), { shadows: false });
  const colour = String(landmark.params.colour ?? '#ffad4a'), glow = Number(landmark.params.glow ?? 1.5);
  if (landmark.params.switched === true) kit.add('Bombillas del merendero', bulbs, kit.mat('Bombilla del merendero', colour, 0.4, glow), { shadows: false, moving: true });
  else kit.add('Bombillas del camping', bulbs, kit.mat('Bombilla del camping', colour, 0.4, glow), { shadows: false });
}
