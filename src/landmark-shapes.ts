import type { MeshBuilder } from './geo-scenery';

/**
 * Solids for landmark builders that gather many small pieces into one mesh per material (a terrace's
 * chairs, a hillside's pines), so they cost one draw call instead of one entity each. Positions and
 * sizes in metres; UVs in metres too, so `kit.surface` textures tile at their real size.
 */
type V3 = [number, number, number];

/** A box standing on `y`, centred on (x, z) and turned `yaw` radians round the vertical; `bottom` closes its base. */
export function box(b: MeshBuilder, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, bottom = false) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u: number, v: number, t: number): V3 => [x + u * c + t * s, y + v, z - u * s + t * c];
  const dir = (u: number, v: number, t: number): V3 => [u * c + t * s, v, -u * s + t * c];
  const hw = w / 2, hd = d / 2;
  // Front and back, the two sides, the top (and the base if asked): UVs count metres across and up.
  b.quad(at(-hw, 0, hd), at(hw, 0, hd), at(hw, h, hd), at(-hw, h, hd), dir(0, 0, 1), [0, 0], [w, 0], [w, h], [0, h]);
  b.quad(at(hw, 0, -hd), at(-hw, 0, -hd), at(-hw, h, -hd), at(hw, h, -hd), dir(0, 0, -1), [0, 0], [w, 0], [w, h], [0, h]);
  b.quad(at(hw, 0, hd), at(hw, 0, -hd), at(hw, h, -hd), at(hw, h, hd), dir(1, 0, 0), [0, 0], [d, 0], [d, h], [0, h]);
  b.quad(at(-hw, 0, -hd), at(-hw, 0, hd), at(-hw, h, hd), at(-hw, h, -hd), dir(-1, 0, 0), [0, 0], [d, 0], [d, h], [0, h]);
  b.quad(at(-hw, h, hd), at(hw, h, hd), at(hw, h, -hd), at(-hw, h, -hd), [0, 1, 0], [x - hw, z + hd], [x + hw, z + hd], [x + hw, z - hd], [x - hw, z - hd]);
  if (bottom) b.quad(at(-hw, 0, hd), at(hw, 0, hd), at(hw, 0, -hd), at(-hw, 0, -hd), [0, -1, 0], [0, 0], [w, 0], [w, d], [0, d]);
}

/** A thin bar from `a` to `b` with a square section `t` wide (a wire, a handrail, a leaning trunk). */
export function bar(b: MeshBuilder, a: V3, e: V3, t: number) {
  const d: V3 = [e[0] - a[0], e[1] - a[1], e[2] - a[2]];
  const len = Math.hypot(...d) || 1;
  // Two directions across the bar: one level, one up, so a level wire shows a top and a side.
  let side: V3 = [-d[2], 0, d[0]];
  const sl = Math.hypot(...side);
  side = sl > 1e-6 ? [side[0] / sl * t / 2, 0, side[2] / sl * t / 2] : [t / 2, 0, 0];
  const n: V3 = [d[0] / len, d[1] / len, d[2] / len];
  let up: V3 = [n[1] * side[2] - n[2] * side[1], n[2] * side[0] - n[0] * side[2], n[0] * side[1] - n[1] * side[0]];
  const ul = Math.hypot(...up) || 1;
  up = [up[0] / ul * t / 2, up[1] / ul * t / 2, up[2] / ul * t / 2];
  if (up[1] < 0) up = [-up[0], -up[1], -up[2]];
  const p = (o: V3, su: number, uu: number): V3 => [o[0] + side[0] * su + up[0] * uu, o[1] + side[1] * su + up[1] * uu, o[2] + side[2] * su + up[2] * uu];
  // The four long faces, each between two edges of the section, facing away from the axis.
  for (const [s1, u1, s2, u2, fs, fu] of [[1, 1, 1, -1, 1, 0], [1, -1, -1, -1, 0, -1], [-1, -1, -1, 1, -1, 0], [-1, 1, 1, 1, 0, 1]] as const) {
    const facing: V3 = [side[0] * fs + up[0] * fu, side[1] * fs + up[1] * fu, side[2] * fs + up[2] * fu];
    b.quad(p(a, s1, u1), p(e, s1, u1), p(e, s2, u2), p(a, s2, u2), facing, [0, 0], [len, 0], [len, t], [0, t]);
  }
}

/** A prism of `sides` round the vertical (a pole, a trunk, a water tank), from `y` up `h`, with a lid. */
export function prism(b: MeshBuilder, x: number, y: number, z: number, r: number, h: number, sides = 6, lid = true) {
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    const arc = r * (a1 - a0);
    b.quad(p0, p1, [p1[0], y + h, p1[2]], [p0[0], y + h, p0[2]], [Math.cos(am), 0, Math.sin(am)], [k * arc, 0], [(k + 1) * arc, 0], [(k + 1) * arc, h], [k * arc, h]);
    if (lid) b.tri([x, y + h, z], [p0[0], y + h, p0[2]], [p1[0], y + h, p1[2]], [0, 1, 0], [x, z], [p0[0], p0[2]], [p1[0], p1[2]]);
  }
}

/**
 * A lens of foliage: a low dome over a shallower bowl, `rx` × `rz` wide and `up` + `down` tall round
 * a centre at `y`. An umbrella pine's crown, a shrub, a pot plant.
 */
export function crown(b: MeshBuilder, x: number, y: number, z: number, rx: number, rz: number, up: number, down: number, sides = 9, seed = 0) {
  const ring = (k: number, f: number, yy: number): V3 => {
    const a = (k / sides) * Math.PI * 2 + seed;
    // A little unevenness round the rim, so crowns side by side do not look stamped.
    const wob = 1 + 0.12 * Math.sin(k * 2.7 + seed * 5.1);
    return [x + Math.cos(a) * rx * f * wob, yy, z + Math.sin(a) * rz * f * wob];
  };
  const top: V3 = [x, y + up, z], low: V3 = [x, y - down, z];
  for (let k = 0; k < sides; k++) {
    const r0 = ring(k, 1, y), r1 = ring(k + 1, 1, y), m0 = ring(k, 0.62, y + up * 0.72), m1 = ring(k + 1, 0.62, y + up * 0.72);
    const a = ((k + 0.5) / sides) * Math.PI * 2 + seed, out: V3 = [Math.cos(a), 0, Math.sin(a)];
    b.quad(r0, r1, m1, m0, [out[0], 0.5, out[2]], [0, 0], [1, 0], [1, 1], [0, 1]);
    b.tri(m0, m1, top, [out[0] * 0.3, 1, out[2] * 0.3], [0, 0], [1, 0], [0.5, 1]);
    b.tri(r0, r1, low, [out[0] * 0.5, -1, out[2] * 0.5], [0, 0], [1, 0], [0.5, 1]);
  }
}
