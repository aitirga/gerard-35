import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * People at a viewpoint at sunset, in the game's block figures: a row `size_m[0]` long along the
 * landmark's x, all facing its −z (turn the landmark so that is the view). Sitting (`seat_m`: the
 * parapet's top) with their legs over the edge, or standing (`stand`); some hold a phone up, one
 * plays a guitar (`guitar`: their place in the row), cans beside them. `count` people, `seed` varies
 * them; `vest` dresses the first one as a civic agent in a high-visibility vest.
 */
export const kind = 'gent';

const SKIN = ['#e9bf9c', '#c98f6a', '#f2d2b6', '#8d5a3c', '#d9a77f'];
const CLOTHES = ['#3f6b8a', '#9a463f', '#d0a24a', '#4c7a4f', '#6a5a8a', '#2f3b46', '#e8e1d4', '#5a8fb0', '#b5674a', '#d8c9a8'];
const TROUSERS = ['#2f3b46', '#4a3f35', '#3d5a80', '#6b6258', '#1f2326'];
const HAIR = ['#2b1d14', '#5a3b22', '#a8743a', '#1c1c1c', '#c9c2b6', '#7a4a2a'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, count = Number(p.count ?? 4), seed = Number(p.seed ?? 1), seat = Number(p.seat_m ?? 1);
  const stand = !!p.stand, guitar = p.guitar === undefined ? -1 : Number(p.guitar), length = landmark.w * kit.cell;
  const pick = <T>(list: T[], i: number) => list[(i * 7 + seed * 13) % list.length];
  for (let i = 0; i < count; i++) {
    const n = i + seed * 5, x = count > 1 ? -length / 2 + length * (i + 0.5) / count + Math.sin(n * 3.1) * 0.15 : 0;
    const vest = !!p.vest && i === 0;
    const shirt = kit.mat('Ropa', vest ? '#e8f04a' : pick(CLOTHES, n)), legs = kit.mat('Pantalón', pick(TROUSERS, n + 2));
    const skin = kit.mat('Piel', pick(SKIN, n + 1), 0.3), hair = kit.mat('Pelo', pick(HAIR, n + 3), 0.3);
    const lean = Math.sin(n * 1.7) * 6;
    if (stand) {
      for (const side of [-1, 1]) kit.part('Pierna', 'box', legs, [x + side * 0.1, 0.42, 0], [0.16, 0.84, 0.18]);
      body(x, 0.84, lean);
    } else {
      // Sitting on the parapet's edge, thighs over it and shins hanging down the far side.
      for (const side of [-1, 1]) {
        kit.part('Muslo', 'box', legs, [x + side * 0.1, seat + 0.08, -0.22], [0.16, 0.16, 0.44]);
        kit.part('Pierna colgando', 'box', legs, [x + side * 0.1, seat - 0.2, -0.46], [0.15, 0.48, 0.16]);
      }
      body(x, seat + 0.02, lean);
      if ((n + 1) % 3 === 0) kit.part('Lata', 'cylinder', kit.mat('Lata', pick(['#c0282d', '#d9d9d9', '#2f6fb5', '#2e7d3a'], n), 0.6), [x + 0.32, seat + 0.07, 0.05], [0.07, 0.13, 0.07]);
    }
    if (i === guitar) {
      kit.part('Guitarra', 'box', kit.mat('Guitarra', '#9a5a2a', 0.4), [x + 0.05, (stand ? 0.84 : seat) + 0.35, -0.22], [0.42, 0.5, 0.12], [0, 0, 60]);
      kit.part('Mástil', 'box', kit.mat('Mástil', '#3b2414', 0.3), [x + 0.38, (stand ? 0.84 : seat) + 0.6, -0.22], [0.5, 0.05, 0.05], [0, 0, 25]);
    }
    /** Body, arms and head from the hips up; a phone held up to film the sunset every few. */
    function body(bx: number, hips: number, tilt: number) {
      kit.part('Cuerpo', 'box', shirt, [bx, hips + 0.32, 0], [0.44, 0.62, 0.26], [tilt, 0, 0]);
      kit.part('Cabeza', 'sphere', skin, [bx, hips + 0.83, -0.02], [0.3, 0.33, 0.3]);
      kit.part('Pelo', 'sphere', hair, [bx, hips + 0.9, 0.03], [0.32, 0.25, 0.32]);
      const phone = (n % 4 === 1) && i !== guitar;
      for (const side of [-1, 1]) {
        if (phone && side > 0) {
          kit.part('Brazo en alto', 'box', shirt, [bx + 0.22, hips + 0.7, -0.14], [0.12, 0.44, 0.13], [-60, 0, 0]);
          kit.part('Móvil', 'box', kit.mat('Móvil', '#16161a', 0.7), [bx + 0.22, hips + 0.93, -0.33], [0.08, 0.15, 0.02], [-10, 0, 0]);
        } else kit.part('Brazo', 'box', shirt, [bx + side * 0.27, hips + 0.3, -0.06], [0.12, 0.48, 0.14], [20, 0, 0]);
      }
      if (vest) kit.part('Franja reflectante', 'box', kit.mat('Reflectante', '#d9dde0', 0.6, 0.3), [bx, hips + 0.3, 0], [0.45, 0.06, 0.27]);
    }
  }
}
