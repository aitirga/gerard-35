import type { GeoLandmark } from '../geo';
import type { MeshBuilder } from '../geo-scenery';
import type { LandmarkKit } from '../landmarks';

/**
 * One of the two Venetian towers of Plaça d'Espanya (Ramon Reventós, 1927–29, after St Mark's
 * campanile), 47 m high on a 7.2 m square: a granite plinth, a battered base of cream artificial
 * stone with its door, a shaft of red brick with three recessed channels on each face ending in
 * arches and pierced by slit windows, a cornice on brackets, a loggia of columns and a copper
 * pyramid gone dark grey-green. Front (+z): the door. `brick` repaints the shaft.
 */
export const kind = 'venetian-tower';

/** Heights in metres, measured on the photos against the real 47 m. */
const Y = { plinth: 0.6, base: 7, band: 7.6, arches: 31.6, shaft: 33.6, cornice: 35, sill: 35.5, loggia: 39.6, attic: 40.6, roof: 46.2, top: 47 };
/** Half the shaft's width (7.2 m), the recessed plane of its channels, and its piers along one face. */
const HALF = 3.6, RECESS = 3.3, PIERS = [-1.1, 1.1], CHANNELS = [[-2.9, -1.35], [-0.85, 0.85], [1.35, 2.9]];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const brick = kit.surface('mao', String(landmark.params.brick ?? '#8a4632'));
  const stone = kit.surface('carreu', '#d4c6ab');
  const granite = kit.surface('granit', '#a29b90');
  const copper = kit.mat('Cobre envejecido', '#56625b', 0.35);
  const dark = kit.mat('Hueco de la torre', '#211b18', 0.1);
  const b = kit.mesh(), s = kit.mesh(), c = kit.mesh(), d = kit.mesh(), g = kit.mesh();

  // The plinth: two granite steps.
  box(g, 0, [0, 0.15, 0], [9.4, 0.3, 9.4]);
  box(g, 0, [0, 0.45, 0], [8.6, 0.3, 8.6]);
  // The battered stone base, a band over it, and the door with its arch on the front.
  frustum(s, Y.plinth, Y.base, 4, 3.8);
  box(s, 0, [0, (Y.base + Y.band) / 2, 0], [8, Y.band - Y.base, 8]);
  box(d, 0, [0, 2.3, 3.93], [1.6, 3.4, 0.2]);
  arch(d, 0, 0, 4, 0.8, 0, 0, 4, 1.6);
  // The brick shaft: the core is the channels' back, corner piers and two piers a face stand proud.
  box(b, 0, [0, (Y.band + Y.shaft) / 2, 0], [RECESS * 2, Y.shaft - Y.band, RECESS * 2]);
  for (const [px, pz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(b, 0, [px * 3.25, (Y.band + Y.shaft) / 2, pz * 3.25], [0.7, Y.shaft - Y.band, 0.7]);
  for (let k = 0; k < 4; k++) {
    for (const x of PIERS) box(b, k, [x, (Y.band + Y.shaft) / 2, (RECESS + HALF) / 2], [0.5, Y.shaft - Y.band, HALF - RECESS]);
    for (const [x0, x1] of CHANNELS) {
      // Each channel closes in an arch under the cornice; slit windows light the stair inside.
      arch(b, k, (x0 + x1) / 2, Y.arches, (x1 - x0) / 2, Y.shaft, RECESS, HALF, 0);
      for (const y of [12.5, 18.5, 24.5, 29.4]) box(d, k, [(x0 + x1) / 2, y, RECESS + 0.02], [0.2, 1.3, 0.06]);
    }
  }
  // The cornice on brackets, the loggia's sill, corner piers, columns and dark inside, the attic.
  box(s, 0, [0, Y.shaft + 0.25, 0], [7.6, 0.5, 7.6]);
  box(s, 0, [0, (Y.shaft + 0.5 + Y.cornice) / 2, 0], [8.4, Y.cornice - Y.shaft - 0.5, 8.4]);
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) box(s, k, [-3 + i * 1.2, Y.shaft + 0.2, HALF + 0.2], [0.24, 0.5, 0.4]);
  box(s, 0, [0, (Y.cornice + Y.sill) / 2, 0], [7.9, Y.sill - Y.cornice, 7.9]);
  box(d, 0, [0, (Y.sill + Y.loggia) / 2, 0], [6, Y.loggia - Y.sill, 6]);
  for (const [px, pz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(s, 0, [px * 3.3, (Y.sill + Y.loggia) / 2, pz * 3.3], [1, Y.loggia - Y.sill, 1]);
  for (let k = 0; k < 4; k++) for (const x of [-1.4, 0, 1.4]) box(s, k, [x, (Y.sill + Y.loggia) / 2, 3.45], [0.36, Y.loggia - Y.sill, 0.36]);
  box(s, 0, [0, (Y.loggia + Y.attic) / 2, 0], [7.9, Y.attic - Y.loggia, 7.9]);
  box(s, 0, [0, Y.attic + 0.12, 0], [8.3, 0.24, 8.3]);
  // The copper pyramid and its finial.
  frustum(c, Y.attic + 0.24, Y.roof, 4, 0.12);
  box(c, 0, [0, (Y.roof + Y.top) / 2, 0], [0.24, Y.top - Y.roof, 0.24]);

  kit.add('Escalones de la torre', g, granite);
  // 47 m of tower: everything above the plinth opens the cut round Gerard.
  kit.add('Fuste de ladrillo', b, brick, { cut: true });
  kit.add('Piedra de la torre', s, stone, { cut: true });
  kit.add('Pirámide de cobre', c, copper, { cut: true });
  kit.add('Huecos de la torre', d, dark, { cut: true });
}

type V3 = [number, number, number];
/** A point on face `k` (0 front +z, 1 right +x, 2 back, 3 left), given as if on the front. */
function turn([x, y, z]: number[], k: number): V3 {
  return k === 0 ? [x, y, z] : k === 1 ? [z, y, -x] : k === 2 ? [-x, y, -z] : [-z, y, x];
}
/** A box (centre, size in metres) laid out as on the front and turned to face `k`; UVs count metres. No bottom. */
function box(m: MeshBuilder, k: number, centre: number[], [w, h, d]: number[]) {
  const [x, y, z] = centre, x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
  const q = (a: number[], b: number[], c: number[], e: number[], n: number[], u: number[][]) =>
    m.quad(turn(a, k), turn(b, k), turn(c, k), turn(e, k), turn(n, k), u[0], u[1], u[2], u[3]);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]);
  q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
  q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
}
/** A square frustum round the vertical axis, from half-width `h0` at `y0` to `h1` at `y1`, with its top. */
function frustum(m: MeshBuilder, y0: number, y1: number, h0: number, h1: number) {
  for (let k = 0; k < 4; k++) {
    const n = turn([0, (h0 - h1) / (y1 - y0), 1], k);
    m.quad(turn([-h0, y0, h0], k), turn([h0, y0, h0], k), turn([h1, y1, h1], k), turn([-h1, y1, h1], k), n,
      [-h0, 0], [h0, 0], [h1, y1 - y0], [-h1, y1 - y0]);
  }
  if (h1 > 0) m.quad([-h1, y1, h1], [h1, y1, h1], [h1, y1, -h1], [-h1, y1, -h1], [0, 1, 0], [-h1, h1], [h1, h1], [h1, -h1], [-h1, -h1]);
}
/**
 * A round arch on face `k`: the wall from its curve up to `top` (or a half-disc of opening when `top`
 * is 0), between depths `back` and `front`, so a channel or a door reads as cut into the wall. With
 * `width` set it fills the half-disc instead, the top of a door of that width.
 */
function arch(m: MeshBuilder, k: number, cx: number, spring: number, r: number, top: number, back: number, front: number, width: number) {
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const a0 = Math.PI * i / steps, a1 = Math.PI * (i + 1) / steps;
    const p0 = [cx - Math.cos(a0) * r, spring + Math.sin(a0) * r], p1 = [cx - Math.cos(a1) * r, spring + Math.sin(a1) * r];
    if (width) {
      // The door's half-disc, a dark fan standing a hair proud of the base.
      m.tri(turn([cx, spring, front], k), turn([p0[0], p0[1], front], k), turn([p1[0], p1[1], front], k), turn([0, 0, 1], k));
      continue;
    }
    // The spandrel on the front plane and the arch's underside back to the channel.
    m.quad(turn([p0[0], p0[1], front], k), turn([p1[0], p1[1], front], k), turn([p1[0], top, front], k), turn([p0[0], top, front], k), turn([0, 0, 1], k),
      [p0[0], p0[1]], [p1[0], p1[1]], [p1[0], top], [p0[0], top]);
    const mid = [(Math.cos(a0) + Math.cos(a1)) / 2, -(Math.sin(a0) + Math.sin(a1)) / 2];
    m.quad(turn([p0[0], p0[1], back], k), turn([p1[0], p1[1], back], k), turn([p1[0], p1[1], front], k), turn([p0[0], p0[1], front], k), turn([mid[0], mid[1], 0], k),
      [p0[0], back], [p1[0], back], [p1[0], front], [p0[0], front]);
  }
}
