import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * People standing in the street, in the game's block figures and clothes of every colour: a queue
 * along the footprint's length (`style: 'queue'`, facing +x, with a security guard at its head when
 * `guard` and the entrance's lettered sign when `sign`), a tour group round a guide holding up an
 * umbrella (`style: 'group'`, `umbrella` its colour), or visitors spread over the footprint all
 * looking one way (`style: 'scatter'`, `face` in degrees, 0: +z), some holding a phone up for the
 * picture. They never move; the footprint keeps Gerard out of them. `count` and `seed` vary them.
 *
 * A crowd is one mesh coloured from a small painted palette, so a square full of people costs one
 * draw call (two with the entrance's sign), not one per colour.
 */
export const kind = 'crowd';

type V3 = [number, number, number];
type Mesh = ReturnType<LandmarkKit['mesh']>;

const SKIN = ['#e9bf9c', '#c98f6a', '#f2d2b6', '#8d5a3c', '#d9a77f', '#b07850'];
const CLOTHES = ['#3f6b8a', '#b9483f', '#e0b04a', '#4c7a4f', '#2f3b46', '#e8e1d4', '#5a8fb0', '#c96f3f', '#7a8a9a', '#f2efe6', '#8a3f52'];
const HAIR = ['#2b1d14', '#5a3b22', '#a8743a', '#1c1c1c', '#c9c2b6', '#e2c98e'];
const TROUSERS = ['#2f3b46', '#4a3f35', '#3d5a80', '#c9b99a', '#1f2328'];
const BAGS = ['#2f3b46', '#c96f3f', '#3f6b8a', '#4c7a4f'];
const CAPS = ['#f2efe6', '#e0b04a', '#3d5a80'];
/** Guard's uniform, his vest, the guide's yellow jacket, umbrella handles and phones, the sign's post. */
const GEAR = ['#1f2a44', '#d6e04a', '#f2c230', '#2a2a2a', '#1d1f22', '#3a3d40'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params as { style?: 'queue' | 'group' | 'scatter'; count?: number; umbrella?: string; guard?: boolean; sign?: string; seed?: number; face?: number; phones?: number };
  let seed = (p.seed ?? [...landmark.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 2147483646 + 1;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];

  // The palette: one texel per colour, read at its centre with no filtering.
  const colours = [...SKIN, ...CLOTHES, ...HAIR, ...TROUSERS, ...BAGS, ...CAPS, ...GEAR, p.umbrella ?? '#e0b030'];
  const at = new Map(colours.map((c, i) => [c, i]));
  const uv = (c: string) => [((at.get(c) ?? 0) + 0.5) / colours.length, 0.5];
  const crowd = kit.mesh();

  // Figures are drawn in cells, as tall as Gerard; the footprint is in cells too.
  const u = kit.cell, w = landmark.w * u, d = landmark.d * u;

  /** One visitor at (x, z) metres facing `yaw` degrees (0: +z); `hold` raises a phone or an umbrella. */
  function person(x: number, z: number, yaw: number, o: { clothes?: string; extra?: 'backpack' | 'cap' | 'none'; hold?: 'phone' | 'umbrella' | 'none' } = {}) {
    const s = u * (0.9 + random() * 0.14), a = yaw * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const place = (q: V3): V3 => [x + (q[0] * c + q[2] * sn) * s, q[1] * s, z + (-q[0] * sn + q[2] * c) * s];
    const turn = (q: V3): V3 => [q[0] * c + q[2] * sn, q[1], -q[0] * sn + q[2] * c];
    const top = o.clothes ?? pick(CLOTHES), legs = pick(TROUSERS), skin = pick(SKIN);
    const extra = o.extra ?? pick(['backpack', 'cap', 'none', 'none'] as const);
    for (const side of [-1, 1]) cuboid(crowd, place, turn, [side * 0.13, 0.42, 0], [0.2, 0.84, 0.22], uv(legs));
    cuboid(crowd, place, turn, [0, 1.15, 0], [0.55, 0.7, 0.32], uv(top));
    const raised = o.hold && o.hold !== 'none';
    cuboid(crowd, place, turn, [-0.34, 1.15, 0], [0.15, 0.6, 0.17], uv(top));
    if (raised) {
      // The right arm up and forward: a phone held out at eye height, or the guide's umbrella.
      const hand: V3 = o.hold === 'phone' ? [0.22, 1.78, 0.42] : [0.34, 2.05, 0.1];
      bar(crowd, place(hand), place([0.34, 1.42, 0]), 0.15 * s, uv(top));
      if (o.hold === 'phone') cuboid(crowd, place, turn, [0.2, 1.84, 0.46], [0.16, 0.26, 0.03], uv(GEAR[4]));
    } else cuboid(crowd, place, turn, [0.34, 1.15, 0], [0.15, 0.6, 0.17], uv(top));
    ball(crowd, place([0, 1.72, 0]), [0.21 * s, 0.23 * s, 0.21 * s], uv(skin));
    ball(crowd, place([0, 1.84, -0.04]), [0.22 * s, 0.15 * s, 0.22 * s], uv(pick(HAIR)));
    if (extra === 'backpack') cuboid(crowd, place, turn, [0, 1.2, -0.24], [0.42, 0.5, 0.18], uv(pick(BAGS)));
    if (extra === 'cap') cuboid(crowd, place, turn, [0, 1.98, 0.04], [0.4, 0.08, 0.44], uv(pick(CAPS)));
    return { place, turn };
  }

  if (p.style === 'group') {
    // The guide in the middle with an umbrella up so the group can find her; the group round her.
    const guide = person(0, 0, 180, { clothes: GEAR[2], extra: 'none', hold: 'umbrella' });
    bar(crowd, guide.place([0.34, 3.0, 0.1]), guide.place([0.34, 1.95, 0.1]), 0.05 * u, uv(GEAR[3]));
    canopy(crowd, guide.place([0.34, 2.74, 0.1]), 0.5 * u, 0.32 * u, uv(p.umbrella ?? '#e0b030'));
    const n = p.count ?? 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.5 - Math.PI * 0.25 + random() * 0.3, r = Math.min(w, d) * (0.32 + random() * 0.14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      person(x, z, Math.atan2(-x, -z) * 180 / Math.PI + (random() - 0.5) * 30, { hold: random() < 0.15 ? 'phone' : 'none' });
    }
  } else if (p.style === 'scatter') {
    // Loose rows of visitors looking the same way, a step apart, about one in three taking a picture.
    const n = p.count ?? Math.round(w * d / (2.6 * u * u)), placed: [number, number][] = [];
    for (let tries = 0; placed.length < n && tries < n * 30; tries++) {
      const x = (random() - 0.5) * (w - 0.8 * u), z = (random() - 0.5) * (d - 0.8 * u);
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.95 * u)) continue;
      placed.push([x, z]);
      person(x, z, (p.face ?? 180) + (random() - 0.5) * 50, { hold: random() < (p.phones ?? 0.35) ? 'phone' : 'none' });
    }
  } else {
    // A queue: two loose files shuffling forward along +x.
    const n = p.count ?? Math.round(w / (0.85 * u));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n) + (random() - 0.5) * 0.3 * u, z = (i % 2 ? 1 : -1) * d * 0.18 + (random() - 0.5) * 0.25 * u;
      person(x, z, 90 + (random() - 0.5) * 50, { hold: random() < 0.12 ? 'phone' : 'none' });
    }
    if (p.guard) {
      const guard = person(w / 2 + 0.2 * u, 0, -90, { clothes: GEAR[0], extra: 'none' });
      cuboid(crowd, guard.place, guard.turn, [0, 1.98, 0], [0.46, 0.12, 0.46], uv(GEAR[0]));
      cuboid(crowd, guard.place, guard.turn, [0, 1.2, 0], [0.58, 0.5, 0.35], uv(GEAR[1]));
    }
    if (p.sign) {
      // The entrance's sign on a post: a white letter on black, as on the visitors' gates.
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#1d1f22'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.sign, 64, 68, 116);
      const face = kit.mat(`Rótulo ${p.sign}`, '#ffffff', 0.3); face.diffuseMap = kit.texture(c); face.update();
      const x = w / 2 + 0.6 * u, z = -d / 2;
      const still = (q: V3): V3 => [x + q[0], q[1], z + q[2]], none = (q: V3) => q;
      cuboid(crowd, still, none, [0, 1.2, 0], [0.08, 2.4, 0.08], uv(GEAR[5]));
      cuboid(crowd, still, none, [0, 2.4, 0], [1.02, 1.02, 0.1], uv(GEAR[5]));
      const quad = kit.mesh();
      quad.quad([x - 0.5, 1.9, z + 0.06], [x + 0.5, 1.9, z + 0.06], [x + 0.5, 2.9, z + 0.06], [x - 0.5, 2.9, z + 0.06], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
      kit.add('Rótulo de la entrada', quad, face, { shadows: false });
    }
  }

  const people = kit.mat(`Gente ${landmark.id}`, '#ffffff', 0.25);
  const swatches = document.createElement('canvas'); swatches.width = colours.length; swatches.height = 1;
  const ctx = swatches.getContext('2d')!;
  colours.forEach((colour, i) => { ctx.fillStyle = colour; ctx.fillRect(i, 0, 1, 1); });
  const texture = kit.texture(swatches);
  texture.minFilter = pc.FILTER_NEAREST; texture.magFilter = pc.FILTER_NEAREST;
  texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE; texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
  people.diffuseMap = texture; people.update();
  kit.add('Visitantes', crowd, people);
}

/** A box in a figure's own frame (`centre`, `size`), placed and turned with it; every face one colour. */
function cuboid(b: Mesh, place: (q: V3) => V3, turn: (q: V3) => V3, centre: V3, size: V3, uv: number[]) {
  const [cx, cy, cz] = centre, [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const corner = (sx: number, sy: number, sz: number) => place([cx + sx * hx, cy + sy * hy, cz + sz * hz]);
  const faces: [V3, [number, number, number][]][] = [
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
    [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  ];
  for (const [normal, k] of faces) b.quad(corner(...k[0]), corner(...k[1]), corner(...k[2]), corner(...k[3]), turn(normal), uv, uv, uv, uv);
}

/** A square bar from `a` to `c`, `w` thick (a raised arm, an umbrella's stick). */
function bar(b: Mesh, a: V3, c: V3, w: number, uv: number[]) {
  const d = norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  const side = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), up = cross(side, d);
  const corner = (p: V3, i: number): V3 => {
    const [su, sv] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][i % 4];
    return [p[0] + (side[0] * su + up[0] * sv) * w / 2, p[1] + (side[1] * su + up[1] * sv) * w / 2, p[2] + (side[2] * su + up[2] * sv) * w / 2];
  };
  for (let i = 0; i < 4; i++) {
    const out = norm([corner([0, 0, 0], i)[0] + corner([0, 0, 0], i + 1)[0], corner([0, 0, 0], i)[1] + corner([0, 0, 0], i + 1)[1], corner([0, 0, 0], i)[2] + corner([0, 0, 0], i + 1)[2]]);
    b.quad(corner(a, i), corner(a, i + 1), corner(c, i + 1), corner(c, i), out, uv, uv, uv, uv);
  }
}

/** A low ellipsoid round `c` with radii `r` (heads, hair). */
function ball(b: Mesh, c: V3, r: V3, uv: number[]) {
  const segments = 6, rings = 4;
  const point = (i: number, j: number): V3 => {
    const t = Math.PI * i / rings, a = Math.PI * 2 * j / segments;
    return [c[0] + Math.sin(t) * Math.cos(a) * r[0], c[1] - Math.cos(t) * r[1], c[2] + Math.sin(t) * Math.sin(a) * r[2]];
  };
  for (let i = 0; i < rings; i++) for (let j = 0; j < segments; j++) {
    const p = [point(i, j), point(i, j + 1), point(i + 1, j + 1), point(i + 1, j)];
    const mid = norm([p[0][0] + p[2][0] - 2 * c[0], p[0][1] + p[2][1] - 2 * c[1], p[0][2] + p[2][2] - 2 * c[2]]);
    if (i === 0) b.tri(p[0], p[2], p[3], mid, uv, uv, uv);
    else if (i === rings - 1) b.tri(p[0], p[1], p[2], mid, uv, uv, uv);
    else b.quad(p[0], p[1], p[2], p[3], mid, uv, uv, uv, uv);
  }
}

/** An umbrella's canopy: a shallow eight-sided cone, its rim at `c`. */
function canopy(b: Mesh, c: V3, r: number, h: number, uv: number[]) {
  const tip: V3 = [c[0], c[1] + h, c[2]];
  for (let j = 0; j < 8; j++) {
    const a0 = j / 8 * Math.PI * 2, a1 = (j + 1) / 8 * Math.PI * 2;
    const p0: V3 = [c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], p1: V3 = [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r];
    b.tri(p0, p1, tip, [Math.cos((a0 + a1) / 2), 1, Math.sin((a0 + a1) / 2)], uv, uv, uv);
    b.tri(p1, p0, tip, [0, -1, 0], uv, uv, uv);
  }
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
