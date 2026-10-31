import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Inside a gun pit of the anti-aircraft battery (Turó de la Rovira, 1937-38): the round concrete
 * floor, the ring of the gun's mount in the middle with its dark hole, and the ammunition niches
 * with their rusty red steel doors set into the parapet (the parapet itself is the zone's
 * `parapet` building). `radius_m`: the pit's inner radius; `niches`: their bearings in degrees in
 * the landmark's frame (0 towards the camera, 90 to its right), at `wall_m` from the centre.
 */
export const kind = 'canonera';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const radius = Number(landmark.params.radius_m ?? 3), wall = Number(landmark.params.wall_m ?? radius), mount = Math.min(1.9, radius * 1.2);
  const floor = kit.surface('formigo', '#b3ada2'), ring = kit.surface('formigo-encofrat', '#a39c90');
  const hole = kit.mat('Hueco del afuste', '#4d4843', 0.05), rust = kit.mat('Puerta oxidada', '#8a3f22', 0.25);
  const recess = kit.mat('Nicho', '#3b3632', 0.05), bolt = kit.mat('Pernos', '#5a4134', 0.3);
  // The pit's floor: a round slab a shade lighter than the gravel round it.
  const slab = kit.mesh(), SIDES = 28;
  for (let i = 0; i < SIDES; i++) {
    const a = i / SIDES * Math.PI * 2, b = (i + 1) / SIDES * Math.PI * 2;
    slab.tri([0, 0.05, 0], [Math.cos(a) * radius, 0.05, Math.sin(a) * radius], [Math.cos(b) * radius, 0.05, Math.sin(b) * radius], [0, 1, 0],
      [0, 0], [Math.cos(a) * radius, Math.sin(a) * radius], [Math.cos(b) * radius, Math.sin(b) * radius]);
  }
  kit.add('Suelo del emplazamiento', slab, floor, { shadows: false });
  // The mount: a low concrete ring round a dark hole, its bolts sticking up.
  kit.part('Afuste', 'cylinder', ring, [0, 0.13, 0], [mount, 0.18, mount]);
  kit.part('Hueco del afuste', 'cylinder', hole, [0, 0.135, 0], [mount * 0.66, 0.2, mount * 0.66]);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    kit.part('Perno', 'cylinder', bolt, [Math.cos(a) * mount * 0.41, 0.26, Math.sin(a) * mount * 0.41], [0.06, 0.1, 0.06]);
  }
  // Niches in the parapet's inner face, each with its door ajar or shut.
  for (const [k, deg] of ((landmark.params.niches as number[] | undefined) ?? []).entries()) {
    const a = deg * Math.PI / 180, x = Math.sin(a) * (wall - 0.04), z = Math.cos(a) * (wall - 0.04), yaw = deg + 180;
    kit.part('Nicho', 'box', recess, [x, 0.55, z], [0.72, 0.62, 0.06], [0, yaw, 0]);
    const shut = k % 2 === 0;
    kit.part('Puerta del nicho', 'box', rust, [x - Math.cos(a) * (shut ? 0 : 0.2), 0.55, z + Math.sin(a) * (shut ? 0 : 0.2)], [0.64, 0.56, 0.035], [0, yaw + (shut ? 0 : 55), 0]);
  }
}
