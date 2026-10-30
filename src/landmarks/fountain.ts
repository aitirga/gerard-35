import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A street drinking fountain, the cast-iron column Barcelona (and many towns) put on its
 * pavements: painted dark green, a fluted shaft on a granite slab, the grate it drains into, a
 * capital with a small dome, the spout and push button facing the street, and the city's shield.
 * The map gives them (amenity=drinking_water); `colour` repaints the iron.
 */
export const kind = 'fountain';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const iron = kit.mat('Hierro fundido', String(landmark.params.colour ?? '#2f4a3b'), 0.45);
  const grate = kit.mat('Rejilla', '#22262a', 0.35);
  const brass = kit.mat('Latón', '#b8933f', 0.6);
  const slab = kit.surface('granit', '#8f8c85', 0.15);
  const shield = kit.mat('Escudo', '#c43b2f', 0.4);
  kit.part('Losa de la fuente', 'box', slab, [0, 0.03, 0], [0.6, 0.06, 0.6]);
  kit.part('Rejilla de la fuente', 'cylinder', grate, [0, 0.075, 0.08], [0.42, 0.03, 0.42]);
  kit.part('Pie', 'cylinder', iron, [0, 0.16, -0.08], [0.3, 0.14, 0.3]);
  for (let i = 0; i < 6; i++) {
    // Six flutes round the shaft catch the light like the real casting.
    const a = (i / 6) * Math.PI * 2;
    kit.part('Estría', 'box', iron, [Math.cos(a) * 0.1, 0.62, -0.08 + Math.sin(a) * 0.1], [0.04, 0.8, 0.04], [0, -a * 180 / Math.PI, 0]);
  }
  kit.part('Fuste', 'cylinder', iron, [0, 0.62, -0.08], [0.2, 0.84, 0.2]);
  kit.part('Capitel', 'cylinder', iron, [0, 1.07, -0.08], [0.3, 0.08, 0.3]);
  kit.part('Cúpula', 'sphere', iron, [0, 1.13, -0.08], [0.24, 0.16, 0.24]);
  kit.part('Remate', 'sphere', iron, [0, 1.24, -0.08], [0.08, 0.08, 0.08]);
  kit.part('Caño', 'box', brass, [0, 0.82, 0.07], [0.05, 0.05, 0.16], [-12, 0, 0]);
  kit.part('Pulsador', 'sphere', brass, [0, 0.93, 0.03], [0.06, 0.06, 0.06]);
  kit.part('Escudo', 'box', shield, [0, 0.55, 0.025], [0.1, 0.13, 0.02]);
}
