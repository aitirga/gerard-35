import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A row of Barcelona's side-loading street containers in the parking lane, one colour per fraction:
 * grey (resta), yellow (envasos), blue (paper), green (vidre) and brown (orgànica), a little below
 * their real saturation. Each is about 1.5 m along the kerb, 1 m deep and 1.6 m high, its loading
 * side (+z) to the pavement. `kinds` lists them left to right (default all five).
 */
export const kind = 'contenidors';

const FRACTIONS: Record<string, string> = { resta: '#787c7e', envasos: '#c4a03e', paper: '#3e6290', vidre: '#4b7a52', organica: '#7a5a40' };

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const kinds = Array.isArray(landmark.params.kinds) ? landmark.params.kinds.map(String) : Object.keys(FRACTIONS);
  const step = 1.6, dark = kit.mat('Goma del contenedor', '#2b2d2e', 0.3);
  kinds.forEach((name, i) => {
    const x = (i - (kinds.length - 1) / 2) * step, body = kit.mat(`Contenedor ${name}`, FRACTIONS[name] ?? FRACTIONS.resta, 0.35);
    kit.part('Contenedor', 'box', body, [x, 0.86, 0], [1.46, 1.42, 0.98]);
    // The lid a hand wider, the dark mouth on the loading side, the foot and its wheels' shadow line.
    kit.part('Tapa', 'box', body, [x, 1.62, -0.02], [1.52, 0.1, 1.06], [-4, 0, 0]);
    kit.part('Boca', 'box', dark, [x, 1.3, 0.5], [0.9, 0.16, 0.02]);
    kit.part('Pedal', 'box', dark, [x + 0.45, 0.12, 0.5], [0.22, 0.05, 0.08]);
    kit.part('Base', 'box', dark, [x, 0.08, 0], [1.4, 0.16, 0.92]);
  });
}
