import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Stone paving laid over the streets of an old centre where cars share the street with people on
 * foot, as round Cardedeu's Plaça d'Anselm Clavé and Plaça de l'Església: grey slabs from wall to wall
 * instead of asphalt. `params.polys` are convex outlines ([x, z] pairs in metres from the landmark's
 * centre); `texture` (default `lloses`) and `tint` its stone. It lies a few centimetres over the
 * streets, so it covers their asphalt, and blocks nothing.
 */
export const kind = 'llosat';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, top = 0.07, floor = kit.mesh();
  for (const poly of (p.polys as [number, number][][] | undefined) ?? []) {
    for (let k = 1; k + 1 < poly.length; k++) {
      const [a, b, c] = [poly[0], poly[k], poly[k + 1]];
      floor.tri([a[0], top, a[1]], [b[0], top, b[1]], [c[0], top, c[1]], [0, 1, 0], a, b, c);
    }
  }
  kit.add('Losas del casco antiguo', floor, kit.surface(String(p.texture ?? 'lloses'), String(p.tint ?? '#a39d90')), { shadows: false });
}
