import type { GeoLandmark } from '../geo';
import type { MeshBuilder } from '../geo-scenery';
import type { LandmarkKit } from '../landmarks';

/**
 * Las Arenas, the old bullring of Plaça d'Espanya (August Font i Carreras, 1900) made a shopping
 * centre by Richard Rogers and Alonso-Balaguer (2011): a brick drum 100 m across whose neo-Mudéjar
 * facade (horseshoe arches with cream and brick voussoirs, tile panels, twin windows: the photo
 * `arenes-arcs`, one bay) stands lifted on a grey concrete band and red steel V struts over a glazed
 * ground floor; the gate tower (`arenes-porta`) with ARENAS DE BARCELONA in its tiles; on top a glazed
 * band, the round terrace behind a glass parapet, the red steel rim and the shallow dish roof; and,
 * outside, the red panoramic lift. Centre on the drum's axis; `gate` and `lift` are the angles
 * (degrees from the front, +z, towards +x) of the gate tower and the lift, `lift_m` the lift's distance.
 */
export const kind = 'arenas';

/** Radius of the facade, and heights in metres measured on the photos against a bay of 4.3 m. */
const R = 50, BAND = [4, 5.3], FACADE = 11.9, CORNICE = 5.3 + 11.9, RIM = [20.4, 21.8], DOME = 26.5;
/** Bays round the drum, one photo bay each (2πR / 4.3 m). */
const BAYS = 73;
const rad = (deg: number) => deg * Math.PI / 180;

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const gate = Number(landmark.params.gate ?? -29), lift = Number(landmark.params.lift ?? 194), liftR = Number(landmark.params.lift_m ?? 61);
  const facade = kit.surface('arenes-arcs', '');
  const front = kit.surface('arenes-porta', '');
  const brick = kit.surface('mao', '#9a5e40');
  const concrete = kit.surface('formigo', '#b9b5ad');
  const cream = kit.surface('carreu', '#e2d6bd');
  const red = kit.mat('Acero rojo', '#b3261e', 0.5);
  const under = kit.mat('Bajo del alero', '#3a3e43', 0.3);
  const roof = kit.mat('Cubierta de la cúpula', '#d3ccba', 0.3);
  const walk = kit.mat('Mirador', '#a9a196', 0.15);
  const glass = kit.mat('Vidrio de Las Arenas', '#55707c', 0.85);
  const shops = kit.mat('Planta baja', '#3b3c45', 0.6);

  // The drum: glazed ground floor set back, the band, the photographed bays, the cornice and merlons.
  const ground = kit.mesh(), band = kit.mesh(), bays = kit.mesh(), stone = kit.mesh(), glazed = kit.mesh(), rim = kit.mesh(), underside = kit.mesh(), deck = kit.mesh(), dish = kit.mesh(), steel = kit.mesh();
  const gateHalf = 7.8 / R; // the gate tower's half-width, as an angle: the bays stop at it
  const skip = (a: number) => Math.abs(Math.atan2(Math.sin(a - rad(gate)), Math.cos(a - rad(gate)))) < gateHalf;
  for (let i = 0; i < BAYS; i++) {
    const a0 = i / BAYS * Math.PI * 2, a1 = (i + 1) / BAYS * Math.PI * 2, bay = R * (a1 - a0);
    ring(ground, a0, a1, R - 1.6, 0, BAND[0], i * bay);
    ring(band, a0, a1, R + 0.2, BAND[0], BAND[1], i * bay);
    band.quad(...flat(a0, a1, R - 1.6, R + 0.2, BAND[0]), [0, -1, 0], [0, 0], [bay, 0], [bay, 1.8], [0, 1.8]);
    if (!skip((a0 + a1) / 2)) {
      // One photo bay per segment: u runs 0–4.3 m along it, v the facade's height.
      const p = (a: number, r: number, y: number): [number, number, number] => [Math.sin(a) * r, y, Math.cos(a) * r];
      bays.quad(p(a0, R, BAND[1]), p(a1, R, BAND[1]), p(a1, R, CORNICE), p(a0, R, CORNICE), p((a0 + a1) / 2, 1, 0), [0, 0], [4.3, 0], [4.3, FACADE], [0, FACADE]);
    }
    ring(stone, a0, a1, R + 0.35, CORNICE, CORNICE + 0.6, i * bay);
    stone.quad(...flat(a0, a1, R - 0.6, R + 0.35, CORNICE + 0.6), [0, 1, 0], [0, 0], [bay, 0], [bay, 1], [0, 1]);
    if (!skip((a0 + a1) / 2)) for (const t of [0.25, 0.75]) {
      // Stepped merlons on the cornice, two a bay.
      const a = a0 + (a1 - a0) * t;
      block(stone, a, R + 0.05, CORNICE + 0.6, 1.1, 0.9, 0.5);
      block(stone, a, R + 0.05, CORNICE + 1.5, 0.55, 0.45, 0.5);
    }
    // The glazed band behind the cornice, the red rim and its dark underside with red ribs.
    ring(glazed, a0, a1, R - 3.2, CORNICE + 0.6, RIM[0], i * bay);
    ring(rim, a0, a1, R + 4, RIM[0], RIM[1], i * bay);
    underside.quad(...flat(a0, a1, R - 3.2, R + 4, RIM[0]), [0, -1, 0], [0, 0], [bay, 0], [bay, 7], [0, 7]);
    if (i % 2 === 0) block(steel, a0, R + 0.4, RIM[0] - 0.35, 0.3, 0.35, 7.2);
    // The terrace walk on the rim behind its glass parapet, a red steel edge outside it, and the dish rising from it.
    ring(glazed, a0, a1, R + 2.8, RIM[1], RIM[1] + 1.1, i * bay);
    deck.quad(...flat(a0, a1, R - 3.2, R + 2.8, RIM[1]), [0, 1, 0], [0, 0], [bay, 0], [bay, 6], [0, 6]);
    rim.quad(...flat(a0, a1, R + 2.8, R + 4, RIM[1]), [0, 1, 0], [0, 0], [bay, 0], [bay, 1.2], [0, 1.2]);
    const s = (a: number, r: number, y: number): [number, number, number] => [Math.sin(a) * r, y, Math.cos(a) * r];
    dish.quad(s(a0, R - 3.2, RIM[1]), s(a1, R - 3.2, RIM[1]), s(a1, 14, DOME - 1), s(a0, 14, DOME - 1), [0, 1, 0], [0, 0], [bay, 0], [bay, 33], [0, 33]);
    dish.tri(s(a0, 14, DOME - 1), s(a1, 14, DOME - 1), [0, DOME, 0], [0, 1, 0], [0, 0], [1, 0], [0.5, 1]);
    // A V strut under every other pier, red steel from the pavement to the band.
    if (i % 2 === 0) for (const side of [-1, 1]) {
      const foot = a0, top = a0 + side * (1.7 / R);
      strut(steel, foot, top, R - 0.2);
    }
  }
  // The gate tower: the photo on its front, brick sides and back, the crown with the city's arms.
  const g = kit.mesh(), gs = kit.mesh();
  const gc = rad(gate), out = R + 3.2, half = 7.8, top = 18.75;
  const at = (x: number, z: number, y: number): [number, number, number] => [Math.sin(gc) * z + Math.cos(gc) * x, y, Math.cos(gc) * z - Math.sin(gc) * x];
  const n = (x: number, z: number): [number, number, number] => [Math.sin(gc) * z + Math.cos(gc) * x, 0, Math.cos(gc) * z - Math.sin(gc) * x];
  g.quad(at(-half, out, 0), at(half, out, 0), at(half, out, top), at(-half, out, top), n(0, 1), [0, 0], [15.6, 0], [15.6, top], [0, top]);
  // The crown over the gate: the middle of the photo's top, with the shield and its merlons.
  g.quad(at(-1.3, out + 0.01, top), at(1.3, out + 0.01, top), at(1.3, out + 0.01, 20.6), at(-1.3, out + 0.01, 20.6), n(0, 1), [6.55, top], [9.15, top], [9.15, 20.6], [6.55, 20.6]);
  for (const side of [-1, 1]) gs.quad(at(side * half, out, 0), at(side * half, R - 4, 0), at(side * half, R - 4, top), at(side * half, out, top), n(side, 0), [0, 0], [7, 0], [7, top], [0, top]);
  gs.quad(at(-half, out, top), at(half, out, top), at(half, R - 4, top), at(-half, R - 4, top), [0, 1, 0], [0, 0], [15.6, 0], [15.6, 7], [0, 7]);
  box(gs, at(0, out - 0.21, (top + 20.6) / 2), gc, [2.6, 20.6 - top, 0.4]);
  // The panoramic lift: a grey lattice shaft with its round cabin, the red mast and the bridge to the rim.
  const la = rad(lift), lx = Math.sin(la) * liftR, lz = Math.cos(la) * liftR;
  const lattice = kit.mat('Celosía del ascensor', '#8d9296', 0.45);
  const l = kit.mesh(), lr = kit.mesh(), lg = kit.mesh();
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(l, [lx + dx * 1.1, 13, lz + dz * 1.1], la, [0.25, 26, 0.25]);
  for (let y = 2; y < 26; y += 2.4) box(l, [lx, y, lz], la, [2.5, 0.15, 2.5]);
  box(lr, [lx + Math.cos(la) * 2.2, 17.5, lz - Math.sin(la) * 2.2], la, [0.7, 35, 0.7]);
  box(lr, [lx + Math.cos(la) * 2.2, 31, lz - Math.sin(la) * 2.2], la, [2.6, 1.6, 2.6]);
  box(lg, [lx, 14, lz], la, [2.2, 2.6, 2.2]);
  box(lr, [(lx + Math.sin(la) * (R + 4)) / 2, RIM[1] - 0.4, (lz + Math.cos(la) * (R + 4)) / 2], la, [1.8, 0.6, liftR - R - 4]);
  box(l, [lx, 26.2, lz], la, [5.5, 0.4, 5.5]);

  // 26 m of building: everything tall opens the cut round Gerard.
  for (const [name, mesh, m] of [['Planta baja', ground, shops], ['Banda de hormigón', band, concrete], ['Fachada de Las Arenas', bays, facade], ['Cornisa', stone, cream],
    ['Banda acristalada', glazed, glass], ['Alero rojo', rim, red], ['Bajo del alero', underside, under], ['Mirador', deck, walk], ['Cúpula', dish, roof], ['Acero rojo', steel, red],
    ['Puerta principal', g, front], ['Torre de la puerta', gs, brick], ['Ascensor', l, lattice], ['Mástil rojo', lr, red], ['Cabina', lg, glass]] as const) {
    kit.add(name, mesh, m, { cut: true });
  }
}

type V3 = [number, number, number];
/** The outward face of one segment of a ring, between two angles and heights; UVs in metres from `u0`. */
function ring(m: MeshBuilder, a0: number, a1: number, r: number, y0: number, y1: number, u0: number) {
  const p = (a: number, y: number): V3 => [Math.sin(a) * r, y, Math.cos(a) * r];
  const u1 = u0 + r * (a1 - a0);
  m.quad(p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1), [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)], [u0, y0], [u1, y0], [u1, y1], [u0, y1]);
}
/** The four corners of a flat annulus segment at height `y`, for a quad. */
function flat(a0: number, a1: number, r0: number, r1: number, y: number): [V3, V3, V3, V3] {
  const p = (a: number, r: number): V3 => [Math.sin(a) * r, y, Math.cos(a) * r];
  return [p(a0, r1), p(a1, r1), p(a1, r0), p(a0, r0)];
}
/** A box standing on the ring at angle `a` and radius `r` from height `y`: `w` along the ring, `h` up, `d` across it. */
function block(m: MeshBuilder, a: number, r: number, y: number, w: number, h: number, d: number) {
  box(m, [Math.sin(a) * r, y + h / 2, Math.cos(a) * r], a, [w, h, d]);
}
/** A box at `centre`, turned by `yaw` (radians, its depth along the direction `yaw` points to), UVs in metres. */
function box(m: MeshBuilder, [cx, cy, cz]: number[], yaw: number, [w, h, d]: number[]) {
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), vx = Math.sin(yaw), vz = Math.cos(yaw);
  const p = (i: number, j: number, k: number): V3 => [cx + ux * i * w / 2 + vx * k * d / 2, cy + j * h / 2, cz + uz * i * w / 2 + vz * k * d / 2];
  const faces: [V3, V3, V3, V3, V3][] = [
    [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), [vx, 0, vz]],
    [p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), [-vx, 0, -vz]],
    [p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), [ux, 0, uz]],
    [p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), [-ux, 0, -uz]],
    [p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1), [0, 1, 0]],
  ];
  for (const [a, b, c, e, n] of faces) {
    const along = (q: V3) => q[0] * ux + q[2] * uz, across = (q: V3) => q[0] * vx + q[2] * vz;
    const uv = (q: V3) => n[1] ? [along(q), across(q)] : Math.abs(n[0] * vx + n[2] * vz) > 0.5 ? [along(q), q[1]] : [across(q), q[1]];
    m.quad(a, b, c, e, n, uv(a), uv(b), uv(c), uv(e));
  }
}
/** One leg of a V strut: a red steel blade from its foot on the pavement, widening up to the band. */
function strut(m: MeshBuilder, foot: number, top: number, r: number) {
  const corner = (a: number, y: number, w: number, depth: number): V3 =>
    [Math.sin(a) * (r + depth) + Math.cos(a) * w, y, Math.cos(a) * (r + depth) - Math.sin(a) * w];
  const face = (depth: number) => [corner(foot, 0, -0.2, depth), corner(foot, 0, 0.2, depth), corner(top, BAND[0], 0.4, depth), corner(top, BAND[0], -0.4, depth)];
  const o = face(0.25), i = face(-0.25), out: V3 = [Math.sin(foot), 0, Math.cos(foot)], along: V3 = [Math.cos(foot), 0, -Math.sin(foot)];
  m.quad(o[0], o[1], o[2], o[3], out, [0, 0], [0.4, 0], [0.8, 4], [0, 4]);
  m.quad(i[1], i[0], i[3], i[2], [-out[0], 0, -out[2]], [0, 0], [0.4, 0], [0.8, 4], [0, 4]);
  m.quad(o[1], i[1], i[2], o[2], along, [0, 0], [0.5, 0], [0.5, 4], [0, 4]);
  m.quad(i[0], o[0], o[3], i[3], [-along[0], 0, -along[2]], [0, 0], [0.5, 0], [0.5, 4], [0, 4]);
}
