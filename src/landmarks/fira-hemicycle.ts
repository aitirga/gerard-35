import type { GeoLandmark } from '../geo';
import type { MeshBuilder } from '../geo-scenery';
import type { LandmarkKit } from '../landmarks';

/**
 * The Fira's hemicycle on Plaça d'Espanya (Puig i Cadafalch's plan for the 1929 Exhibition): the
 * curved fronts of the Palau de Comunicacions i Transports and the Palau del Vestit, giant columns of
 * warm limestone on pedestals before tall glass, an entablature with a balustrade and urns, and a
 * pavilion with an arched door and two obelisks at each end; at their feet three granite steps and the
 * forecourt of salmon concrete slabs (`lloses-fira`) down to the roundabout. The pivot is the square's
 * centre; `radius` is the fronts' radius, `fronts` their arcs and `forecourt` the forecourt's arc, as
 * [from, to] in degrees from +z towards +x, `inner` where the slabs start (under the ring road).
 */
export const kind = 'fira-hemicycle';

const rad = (deg: number) => deg * Math.PI / 180;
/** A point `r` from the centre at angle `a` (radians), at height `y`. */
const P = (a: number, r: number, y: number): [number, number, number] => [Math.sin(a) * r, y, Math.cos(a) * r];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const R = Number(landmark.params.radius ?? 124), inner = Number(landmark.params.inner ?? 62);
  const fronts = (landmark.params.fronts ?? [[-118, -83], [164, 206]]) as number[][];
  const [f0, f1] = (landmark.params.forecourt ?? [164, 277]) as number[];
  const slabs = kit.surface('lloses-fira', String(landmark.params.slabs ?? '#c49884'));
  const granite = kit.surface('granit', '#a19a8f');
  const limestone = kit.surface('carreu', '#cdb49c');
  const glass = kit.mat('Vidrio de la Fira', '#3d4c52', 0.85);
  const dark = kit.mat('Puerta de la Fira', '#2a2622', 0.2);

  // The forecourt: one fan of slabs from the roundabout up to the steps, UVs in metres.
  const court = kit.mesh(), steps = kit.mesh(), y = 0.045;
  const n = Math.ceil((f1 - f0) / 2);
  for (let i = 0; i < n; i++) {
    const a0 = rad(f0 + (f1 - f0) * i / n), a1 = rad(f0 + (f1 - f0) * (i + 1) / n);
    const q = [P(a0, R - 5.4, y), P(a1, R - 5.4, y), P(a1, inner, y), P(a0, inner, y)];
    court.quad(q[0], q[1], q[2], q[3], [0, 1, 0], [q[0][0], q[0][2]], [q[1][0], q[1][2]], [q[2][0], q[2][2]], [q[3][0], q[3][2]]);
  }
  kit.add('Explanada de la Fira', court, slabs, { shadows: false });

  const stone = kit.mesh(), glazing = kit.mesh();
  for (const [from, to] of fronts) {
    const a0 = rad(from), a1 = rad(to), arc = R * (a1 - a0);
    // Three low granite steps up to the colonnade, a hand's height each so the party walks them.
    for (let s = 0; s < 3; s++) band(steps, a0, a1, R - 5.4 + s * 1.8, R - 3.6 + s * 1.8, y + 0.04 * (s + 1));
    // Tall glass between the columns, the entablature, the balustrade and its coping.
    curve(glazing, a0, a1, R - 0.2, 0.3, 8.6);
    band(stone, a0, a1, R - 1.75, R + 0.1, 8.6, -1);
    curve(stone, a0, a1, R - 1.75, 8.6, 10.2);
    band(stone, a0, a1, R - 1.75, R + 0.1, 10.2);
    curve(stone, a0, a1, R - 1.45, 10.2, 11.1);
    band(stone, a0, a1, R - 1.6, R + 0.1, 11.1);
    // Giant columns about every 4.8 m, each on its pedestal, crowned by an urn on the balustrade.
    const count = Math.max(2, Math.round(arc / 4.8));
    for (let i = 1; i < count; i++) {
      const a = a0 + (a1 - a0) * i / count, [cx, , cz] = P(a, R - 1, 0), deg = a * 180 / Math.PI;
      kit.part('Pedestal', 'box', limestone, [cx, 0.75, cz], [1.4, 1.1, 1.4], [0, deg, 0]);
      kit.part('Columna', 'cylinder', limestone, [cx, 4.85, cz], [1.1, 7.1, 1.1]);
      kit.part('Capitel', 'box', limestone, [cx, 8.6, cz], [1.6, 0.4, 1.6], [0, deg, 0]);
      const [ux, , uz] = P(a, R - 1.45, 0);
      kit.part('Urna', 'cylinder', limestone, [ux, 11.45, uz], [0.45, 0.7, 0.45]);
      kit.part('Urna', 'sphere', limestone, [ux, 11.9, uz], [0.55, 0.45, 0.55]);
    }
    // A pavilion at each end: a block of stone, its tall arched door, two obelisks over the cornice.
    for (const end of [a0, a1]) {
      const inward = end === a0 ? 1 : -1, mid = end + inward * (5 / R);
      const yaw = mid * 180 / Math.PI, [px, , pz] = P(mid, R - 0.7, 0);
      kit.part('Pabellón', 'box', limestone, [px, 6.5, pz], [10, 13, 1.8], [0, yaw, 0]);
      kit.part('Cornisa del pabellón', 'box', limestone, [px, 13.2, pz], [10.6, 0.5, 2.2], [0, yaw, 0]);
      const [dx, , dz] = P(mid, R - 1.62, 0);
      kit.part('Puerta en arco', 'box', dark, [dx, 3.9, dz], [4, 7.8, 0.06], [0, yaw, 0]);
      kit.part('Arco de la puerta', 'box', dark, [dx, 8.1, dz], [2.8, 0.6, 0.06], [0, yaw, 0]);
      for (const side of [-1, 1]) {
        const [ox, , oz] = P(mid + side * (3.6 / R), R - 0.7, 0);
        kit.part('Obelisco', 'box', limestone, [ox, 14.8, oz], [0.9, 2.8, 0.9], [0, yaw, 0]);
        kit.part('Punta del obelisco', 'cone', limestone, [ox, 16.6, oz], [0.9, 0.9, 0.9]);
      }
    }
  }
  kit.add('Escalones de la Fira', steps, granite, { shadows: false });
  kit.add('Entablamento', stone, limestone);
  kit.add('Vidrieras', glazing, glass);
}

/** A flat ring band between two radii at height `y`, facing up (or down with `facing` -1). */
function band(m: MeshBuilder, a0: number, a1: number, r0: number, r1: number, y: number, facing = 1) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / rad(1.5)));
  for (let i = 0; i < n; i++) {
    const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n;
    const q = [P(b0, r1, y), P(b1, r1, y), P(b1, r0, y), P(b0, r0, y)];
    m.quad(q[0], q[1], q[2], q[3], [0, facing, 0], [q[0][0], q[0][2]], [q[1][0], q[1][2]], [q[2][0], q[2][2]], [q[3][0], q[3][2]]);
  }
}
/** A curved wall facing the centre (the square) at radius `r`, between two heights; UVs in metres. */
function curve(m: MeshBuilder, a0: number, a1: number, r: number, y0: number, y1: number) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / rad(1.5)));
  for (let i = 0; i < n; i++) {
    const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n, u0 = r * (b0 - a0), u1 = r * (b1 - a0);
    m.quad(P(b0, r, y0), P(b1, r, y0), P(b1, r, y1), P(b0, r, y1), [-Math.sin((b0 + b1) / 2), 0, -Math.cos((b0 + b1) / 2)], [u0, y0], [u1, y0], [u1, y1], [u0, y1]);
  }
}
