import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The roof of Gaudí's Escoles de la Sagrada Família (1909, rebuilt on the Mallorca corner in 2002):
 * a one-storey brick school for the builders' children whose walls wave in plan (the map's outline
 * already does) and whose thin-brick roof rises from eaves that go up and down in waves, opposite on
 * each side, to a level ridge. Drawn over the map's own building, which gives the walls: `wall` is
 * their top in metres, `waves` how many run along the length, `colour` the brick's.
 */
export const kind = 'escoles';

type V3 = [number, number, number];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params as { wall?: number; waves?: number; colour?: string };
  const w = landmark.w * kit.cell, d = landmark.d * kit.cell, top = p.wall ?? 3, waves = p.waves ?? 3;
  // Walls of exposed brick; the roof's thin bricks, laid flat in layers, read like tiles from above.
  const brick = kit.surface('mao', p.colour ?? '#b0866a', 0.05), tiles = kit.surface('rajola', p.colour ?? '#b0866a', 0.05);
  const roof = kit.mesh(), walls = kit.mesh();
  const ridge = top + 1.5;
  /** The eave's height along the length: a wave, the far side the other way round. */
  const eave = (x: number, side: number) => top + 0.8 + 0.65 * Math.sin((x / w + 0.5) * waves * Math.PI * 2) * side;
  const steps = waves * 10;
  for (let i = 0; i < steps; i++) {
    const x0 = -w / 2 + w * i / steps, x1 = -w / 2 + w * (i + 1) / steps;
    for (const side of [-1, 1]) {
      // The roof overhangs the wall a little; the wall rises from the building's flat top to the eave.
      const z = side * (d / 2 + 0.35), slope = Math.hypot(d / 2, ridge - top);
      roof.quad([x0, ridge, 0], [x1, ridge, 0], [x1, eave(x1, side) - 0.12, z], [x0, eave(x0, side) - 0.12, z], [0, 1, side], [x0, 0], [x1, 0], [x1, slope], [x0, slope]);
      walls.quad([x0, top - 0.05, side * d / 2], [x1, top - 0.05, side * d / 2], [x1, eave(x1, side), side * d / 2], [x0, eave(x0, side), side * d / 2], [0, 0, side],
        [x0, top], [x1, top], [x1, eave(x1, side)], [x0, eave(x0, side)]);
    }
  }
  // The two ends close the gap under the roof.
  for (const end of [-1, 1]) {
    const x = end * w / 2, normal: V3 = [end, 0, 0];
    const outline: V3[] = [[x, top - 0.05, -d / 2], [x, top - 0.05, d / 2], [x, eave(x, 1), d / 2], [x, ridge, 0], [x, eave(x, -1), -d / 2]];
    for (let k = 1; k + 1 < outline.length; k++) {
      const [a, b, c] = [outline[0], outline[k], outline[k + 1]];
      walls.tri(a, b, c, normal, [a[2], a[1]], [b[2], b[1]], [c[2], c[1]]);
    }
  }
  kit.add('Tejado ondulado de las Escuelas', roof, tiles, { cut: true });
  kit.add('Muro de las Escuelas', walls, brick, { cut: true });
}
