/**
 * Lattices: shapes made of GPU particles that hold together (docs/graphics.md, "Lattices").
 *
 * A lattice is one batch of fight particles laid out as a grid of nx × ny × nz cells. Each particle
 * knows its cell from where it sits in the batch, so nothing about the shape is stored per particle:
 * its home (where it belongs) is worked out each frame from the cell, the lattice's shape and its
 * transform, and its neighbours are the cells next to its own (±1 along each axis).
 *
 * The cell (−1…1 on each axis) goes through a shape map into the lattice's own space: a box keeps the
 * grid as it is, a ball and a crystal (a double pyramid) pull every shell of the grid radially onto
 * their own surface, a ring bends x round a circle and turns y × z into the tube's section, a column
 * does the same round its height, a shield cuts an escutcheon out of the grid (flat top, sides that
 * curve in to a point) and bends it out like a heater shield, and a sphere wraps x round it and runs y
 * from its bottom to its top: a hollow shell. A ring and a sphere close round x. Every map is continuous and keeps neighbours next to each other, so
 * a lattice blends from one shape to another (`morph`) without tearing: the structure is kept.
 *
 * The maps exist twice, kept side by side here: TypeScript (tests, the CPU's own sums) and WGSL
 * (WebGPU), used by the simulation pass in src/fight-particles.ts.
 */

export type LatticeShape = 'box' | 'ball' | 'crystal' | 'ring' | 'column' | 'shield' | 'sphere';
export const LATTICE_SHAPES: Record<LatticeShape, number> = { box: 0, ball: 1, crystal: 2, ring: 3, column: 4, shield: 5, sphere: 6 };
/** Shapes whose first and last cells along x are neighbours (round a circle): no seam, a row is a loop. */
export const closedShape = (shape: LatticeShape) => shape === 'ring' || shape === 'sphere';
/** Where the dissolve starts: anywhere, at the top, at the bottom, on its outside, or where it was last pushed. */
export type LatticeDissolve = 'random' | 'top' | 'bottom' | 'outside' | 'push';
export const LATTICE_DISSOLVES: Record<LatticeDissolve, number> = { random: 0, top: 1, bottom: 2, outside: 3, push: 4 };

/** Lattices alive at once, the most particles one holds, and how many of what is thrown at it each member looks at a frame. */
export const MAX_LATTICES = 4, MAX_MEMBERS = 8192, HIT_SAMPLES = 24;
/**
 * Texels a lattice takes in its row of the lattice texture:
 *  0–2 its own space → world · 3–5 world → its own space · 6 first slot, count, nx, ny ·
 *  7 nz, shape, the shape it blends to, how far · 8 half-size, flow (cells it has scrolled along x) ·
 *  9 rigidity, bonds, damping, viscosity · 10 toughness, the kind it breaks into, reform, its own kind ·
 *  11 ripple height, 2π / wavelength, phase, strain glow · 12 its velocity, cells scrolled this frame ·
 *  13 its spin (rad/s round each axis), hit radius · 14 a push: where, how far ·
 *  15 the push's strength, dissolve (0–1), where it starts, hold (share of life it holds at) ·
 *  16–17 up to three batches thrown at it (first slot, count), how much of their motion it takes,
 *  their bounce (below 0: caught) · 18 where the dissolve spreads from, its extent ·
 *  19 shortest cell step, its members' life, longest cell step, rim glow ·
 *  20 the point its surface faces away from (for `fresnel`), opacity · 21 fresnel, the axis its strands run along (0 x, 1 y).
 */
export const LATTICE_COLS = 22;

export interface Vec3Like { x: number; y: number; z: number }

/** A cell's place in its grid, −1…1 on each axis, cell-centred; x scrolls by `flow` cells and wraps. */
export function latticeCell(grid: readonly [number, number, number], offset: number, flow = 0): Vec3Like {
  const [nx, ny, nz] = grid;
  const i = offset % nx, j = Math.floor(offset / nx) % ny, k = Math.floor(offset / (nx * ny));
  const fx = (((i + flow) % nx) + nx) % nx;
  return { x: (fx + .5) / nx * 2 - 1, y: (j + .5) / ny * 2 - 1, z: (k + .5) / nz * 2 - 1 };
}

const linf = (c: Vec3Like) => Math.max(Math.abs(c.x), Math.abs(c.y), Math.abs(c.z));
/** Squeezes a square onto a disc radially (each square ring onto a circle). */
const disc = (a: number, b: number) => { const s = Math.max(Math.abs(a), Math.abs(b)) / Math.max(Math.hypot(a, b), 1e-5); return [a * s, b * s]; };
/** Opens a disc onto a square, the other way. */
const square = (a: number, b: number) => { const s = Math.hypot(a, b) / Math.max(Math.abs(a), Math.abs(b), 1e-5); return [a * s, b * s]; };

/**
 * How wide an escutcheon is at height y (−1 its point, 1 its top): straight sides down to a little
 * above its middle, then the heraldic heater's two arcs (each as wide as the shield, centred on the
 * other side) meeting in a sharp point.
 */
const heater = (y: number) => { const t = Math.min(1, Math.max(0, (.15 - y) / 1.15)); return Math.sqrt(4 - 3 * t * t) - 1; };

/**
 * Where a cell (−1…1) sits in the lattice's own space for a shape of half-size `size`: a ring's is its
 * radius, tube half-height and tube half-width; a shield's its half-width, half-height and how far it
 * bends out (towards +z); a sphere's its radius round, its radius up and half its thickness.
 */
export function latticeShape(shape: LatticeShape, c: Vec3Like, size: Vec3Like): Vec3Like {
  switch (shape) {
    case 'box': return { x: c.x * size.x, y: c.y * size.y, z: c.z * size.z };
    case 'ball': { const s = linf(c) / Math.max(Math.hypot(c.x, c.y, c.z), 1e-5); return { x: c.x * s * size.x, y: c.y * s * size.y, z: c.z * s * size.z }; }
    case 'crystal': { const s = linf(c) / Math.max(Math.abs(c.x) + Math.abs(c.y) + Math.abs(c.z), 1e-5); return { x: c.x * s * size.x, y: c.y * s * size.y, z: c.z * s * size.z }; }
    case 'ring': {
      const [a, b] = disc(c.y, c.z), angle = (c.x + 1) * Math.PI, r = size.x + a * size.z;
      return { x: r * Math.cos(angle), y: b * size.y, z: r * Math.sin(angle) };
    }
    case 'column': { const [a, b] = disc(c.x, c.z); return { x: a * size.x, y: c.y * size.y, z: b * size.z }; }
    case 'shield': { const x = c.x * heater(c.y); return { x: x * size.x, y: c.y * size.y, z: size.z * (1 - x * x) + c.z * size.z * .5 }; }
    case 'sphere': {
      const phi = (c.x + 1) * Math.PI, theta = (1 - c.y) * Math.PI / 2, k = 1 + c.z * size.z / Math.max(size.x, size.y, 1e-4);
      return { x: Math.sin(theta) * Math.cos(phi) * size.x * k, y: Math.cos(theta) * size.y * k, z: Math.sin(theta) * Math.sin(phi) * size.x * k };
    }
  }
}

/** The cell (−1…1) a point in the lattice's own space belongs to: `latticeShape` the other way. */
export function latticeUnshape(shape: LatticeShape, p: Vec3Like, size: Vec3Like): Vec3Like {
  const u = { x: p.x / Math.max(size.x, 1e-4), y: p.y / Math.max(size.y, 1e-4), z: p.z / Math.max(size.z, 1e-4) };
  switch (shape) {
    case 'box': return u;
    case 'ball': { const s = Math.hypot(u.x, u.y, u.z) / Math.max(linf(u), 1e-5); return { x: u.x * s, y: u.y * s, z: u.z * s }; }
    case 'crystal': { const s = (Math.abs(u.x) + Math.abs(u.y) + Math.abs(u.z)) / Math.max(linf(u), 1e-5); return { x: u.x * s, y: u.y * s, z: u.z * s }; }
    case 'ring': {
      let angle = Math.atan2(p.z, p.x); if (angle < 0) angle += 2 * Math.PI;
      const [a, b] = square((Math.hypot(p.x, p.z) - size.x) / Math.max(size.z, 1e-4), p.y / Math.max(size.y, 1e-4));
      return { x: angle / Math.PI - 1, y: a, z: b };
    }
    case 'column': { const [a, b] = square(u.x, u.z); return { x: a, y: u.y, z: b }; }
    case 'shield': {
      const w = Math.max(heater(u.y), 1e-3), cx = u.x / w, x = cx * w;
      return { x: cx, y: u.y, z: (p.z - size.z * (1 - x * x)) / Math.max(size.z * .5, 1e-4) };
    }
    case 'sphere': {
      const v = { x: u.x, y: u.y, z: p.z / Math.max(size.x, 1e-4) }, rho = Math.max(Math.hypot(v.x, v.y, v.z), 1e-5);
      let phi = Math.atan2(v.z, v.x); if (phi < 0) phi += 2 * Math.PI;
      const theta = Math.acos(Math.min(1, Math.max(-1, v.y / rho)));
      return { x: phi / Math.PI - 1, y: 1 - theta / (Math.PI / 2), z: (rho - 1) * Math.max(size.x, size.y) / Math.max(size.z, 1e-4) };
    }
  }
}

/** The offset of a cell's neighbour along `axis` (0 x, 1 y, 2 z) one step `dir` (±1), or −1 past the grid's edge; x wraps round. */
export function latticeNeighbour(grid: readonly [number, number, number], offset: number, axis: number, dir: number) {
  const [nx, ny, nz] = grid;
  let i = offset % nx, j = Math.floor(offset / nx) % ny, k = Math.floor(offset / (nx * ny));
  if (axis === 0) i = (i + dir + nx) % nx;
  else if (axis === 1) { j += dir; if (j < 0 || j >= ny) return -1; }
  else { k += dir; if (k < 0 || k >= nz) return -1; }
  return i + nx * (j + ny * k);
}

/** How far a cell sits from the next along each axis that has more than one (the outer shell's, for a ring round its circle). */
function steps(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like) {
  const [nx, ny, nz] = grid;
  // A shield's bend lengthens its steps across, and its sides closing in on the point its lowest steps up.
  const along = shape === 'ring' || shape === 'sphere' ? 2 * Math.PI * (size.x + size.z) / nx : shape === 'shield' ? Math.hypot(2 * size.x / nx, 4 * size.z / nx) : 2 * size.x / nx;
  const up = shape === 'sphere' ? Math.PI * Math.max(size.x, size.y) / ny
    : shape === 'shield' ? Math.hypot(2 * size.y / ny, size.x * (heater(-1 + 3 / ny) - heater(-1 + 1 / ny))) : 2 * size.y / ny;
  const through = shape === 'shield' ? size.z / nz : 2 * size.z / nz;
  return [nx > 1 ? along : 0, ny > 1 ? up : 0, nz > 1 ? through : 0].filter(v => v > 0);
}
/** The shortest step between neighbouring cells: how close a loose member must come home to bond again. */
export function latticeSpacing(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like) {
  const all = steps(shape, grid, size);
  return all.length ? Math.min(...all) : .05;
}
/** The longest step between neighbouring cells: a "bond" three times longer is a seam (a flowing lattice's two ends), not a bond. */
export function latticeReach(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like) {
  const all = steps(shape, grid, size);
  return all.length ? Math.max(...all) : .05;
}

// ── On the GPU (WGSL) ──────────────────────────────────────────────────────────────────────────────────
// `lat(l, c)` reads texel c of lattice l. The cell, the shape maps, the home (with its ripple), the
// neighbour along an axis, the cell nearest a point, whether its x wrapped this frame and the order a
// dissolve takes. `N` is the particle count.

export const latticeWgsl = (N: number) => /* wgsl */ `
fn lat(l: i32, c: i32) -> vec4f { return textureLoad(uLattices, vec2i(c, l), 0); }
fn lWorld(l: i32, p: vec3f) -> vec3f { let a = lat(l, 0); let b = lat(l, 1); let c = lat(l, 2); return vec3f(dot(a.xyz, p) + a.w, dot(b.xyz, p) + b.w, dot(c.xyz, p) + c.w); }
fn lLocal(l: i32, w: vec3f) -> vec3f { let a = lat(l, 3); let b = lat(l, 4); let c = lat(l, 5); return vec3f(dot(a.xyz, w) + a.w, dot(b.xyz, w) + b.w, dot(c.xyz, w) + c.w); }
fn fmodf(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn linf3(c: vec3f) -> f32 { let a = abs(c); return max(a.x, max(a.y, a.z)); }
fn toDisc(q: vec2f) -> vec2f { return q * (max(abs(q.x), abs(q.y)) / max(length(q), 1e-5)); }
fn toSquare(q: vec2f) -> vec2f { return q * (length(q) / max(max(abs(q.x), abs(q.y)), 1e-5)); }
fn heater(y: f32) -> f32 { let t = clamp((0.15 - y) / 1.15, 0.0, 1.0); return sqrt(4.0 - 3.0 * t * t) - 1.0; }
fn closedX(shape: f32) -> bool { return (shape > 2.5 && shape < 3.5) || shape > 5.5; }
fn dominant(l: i32) -> f32 { let h = lat(l, 7); return select(h.z, h.y, h.w < 0.5); }
fn cellIndex(l: i32, o: i32) -> vec3i {
  let nx = i32(lat(l, 6).z + 0.5); let ny = i32(lat(l, 6).w + 0.5);
  return vec3i(o % nx, (o / nx) % ny, o / (nx * ny));
}
fn cellOf(l: i32, o: i32) -> vec3f {
  let g = lat(l, 6); let h = lat(l, 7);
  let ijk = cellIndex(l, o);
  let fx = fmodf(f32(ijk.x) + lat(l, 8).w, g.z);
  return (vec3f(fx, f32(ijk.y), f32(ijk.z)) + 0.5) / vec3f(g.z, g.w, h.x) * 2.0 - 1.0;
}
fn shapeMap(shape: f32, c: vec3f, s: vec3f) -> vec3f {
  if (shape < 0.5) { return c * s; }
  if (shape < 1.5) { return c * (linf3(c) / max(length(c), 1e-5)) * s; }
  if (shape < 2.5) { let a = abs(c); return c * (linf3(c) / max(a.x + a.y + a.z, 1e-5)) * s; }
  if (shape < 3.5) {
    let q = toDisc(c.yz);
    let angle = (c.x + 1.0) * 3.14159265; let r = s.x + q.x * s.z;
    return vec3f(r * cos(angle), q.y * s.y, r * sin(angle));
  }
  if (shape < 4.5) { let q = toDisc(c.xz); return vec3f(q.x * s.x, c.y * s.y, q.y * s.z); }
  if (shape < 5.5) {
    // An escutcheon: a flat top, sides that curve in to a point, bent out along x like a heater shield.
    let x = c.x * heater(c.y);
    return vec3f(x * s.x, c.y * s.y, s.z * (1.0 - x * x) + c.z * s.z * 0.5);
  }
  // A sphere's shell: x round it, y from its bottom to its top, z through its thickness.
  let phi = (c.x + 1.0) * 3.14159265; let theta = (1.0 - c.y) * 1.5707963;
  let k = 1.0 + c.z * s.z / max(max(s.x, s.y), 1e-4);
  return vec3f(sin(theta) * cos(phi) * s.x, cos(theta) * s.y, sin(theta) * sin(phi) * s.x) * k;
}
fn homeOf(l: i32, o: i32) -> vec3f {
  let c = cellOf(l, o);
  let h = lat(l, 7); let s = lat(l, 8); let w = lat(l, 11);
  var p = mix(shapeMap(h.y, c, s.xyz), shapeMap(h.z, c, s.xyz), h.w);
  // A ripple running through it.
  p.y += w.x * sin(p.x * w.y + w.z) + w.x * 0.5 * sin(p.z * w.y * 1.3 - w.z * 0.8);
  return lWorld(l, p);
}
fn neighbourOf(l: i32, o: i32, d: i32) -> i32 {
  let g = lat(l, 6);
  let nx = i32(g.z + 0.5); let ny = i32(g.w + 0.5); let nz = i32(lat(l, 7).x + 0.5);
  var ijk = cellIndex(l, o);
  let axis = d / 2;
  let dir = select(1, -1, d % 2 == 0);
  if (axis == 0) { ijk.x = (ijk.x + dir + nx) % nx; }
  else if (axis == 1) { ijk.y += dir; if (ijk.y < 0 || ijk.y >= ny) { return -1; } }
  else { ijk.z += dir; if (ijk.z < 0 || ijk.z >= nz) { return -1; } }
  return ijk.x + nx * (ijk.y + ny * ijk.z);
}
fn cellNear(l: i32, w: vec3f) -> i32 {
  let g = lat(l, 6); let h = lat(l, 7); let s = lat(l, 8);
  let p = lLocal(l, w);
  let shape = select(h.z, h.y, h.w < 0.5);
  let u = p / max(s.xyz, vec3f(1e-4));
  var c = u;
  if (shape > 0.5 && shape < 1.5) { c = u * (length(u) / max(linf3(u), 1e-5)); }
  else if (shape > 1.5 && shape < 2.5) { let a = abs(u); c = u * ((a.x + a.y + a.z) / max(linf3(u), 1e-5)); }
  else if (shape > 2.5 && shape < 3.5) {
    var angle = atan2(p.z, p.x); if (angle < 0.0) { angle += 6.2831853; }
    let q = toSquare(vec2f((length(p.xz) - s.x) / max(s.z, 1e-4), p.y / max(s.y, 1e-4)));
    c = vec3f(angle / 3.14159265 - 1.0, q.x, q.y);
  } else if (shape > 3.5 && shape < 4.5) { let q = toSquare(u.xz); c = vec3f(q.x, u.y, q.y); }
  else if (shape > 4.5 && shape < 5.5) {
    let w = max(heater(u.y), 1e-3); let cx = u.x / w; let x = cx * w;
    c = vec3f(cx, u.y, (p.z - s.z * (1.0 - x * x)) / max(s.z * 0.5, 1e-4));
  } else if (shape > 5.5) {
    let v = vec3f(u.x, u.y, p.z / max(s.x, 1e-4));
    let rho = max(length(v), 1e-5);
    var phi = atan2(v.z, v.x); if (phi < 0.0) { phi += 6.2831853; }
    let theta = acos(clamp(v.y / rho, -1.0, 1.0));
    c = vec3f(phi / 3.14159265 - 1.0, 1.0 - theta / 1.5707963, (rho - 1.0) * max(s.x, s.y) / max(s.z, 1e-4));
  }
  let n = vec3f(g.z, g.w, h.x);
  let f = clamp((c + 1.0) * 0.5 * n - 0.5, vec3f(0.0), n - 1.0);
  let i = i32(fmodf(floor(f.x - s.w + 0.5), g.z) + 0.5);
  return i + i32(g.z + 0.5) * (i32(f.y + 0.5) + i32(g.w + 0.5) * i32(f.z + 0.5));
}
fn wrappedNow(l: i32, o: i32) -> bool {
  let g = lat(l, 6); let h = lat(l, 7);
  if (closedX(dominant(l))) { return false; }
  let i = f32(cellIndex(l, o).x);
  let a = fmodf(i + lat(l, 8).w, g.z); let b = fmodf(i + lat(l, 8).w - lat(l, 12).w, g.z);
  return abs(a - b) > g.z * 0.5;
}
fn rankOf(l: i32, o: i32, pos: vec3f, seed: f32) -> f32 {
  let m = lat(l, 15);
  let c = cellOf(l, o);
  var r = seed;
  if (m.z > 0.5 && m.z < 1.5) { r = 1.0 - (c.y + 1.0) * 0.5; }
  else if (m.z > 1.5 && m.z < 2.5) { r = (c.y + 1.0) * 0.5; }
  else if (m.z > 2.5 && m.z < 3.5) { r = 1.0 - linf3(c); }
  else if (m.z > 3.5) { r = clamp(length(pos - lat(l, 18).xyz) / max(lat(l, 18).w * 2.0, 0.01), 0.0, 1.0); }
  return mix(r, seed, 0.2);
}
fn slotOf(l: i32, o: i32) -> i32 { return i32(fmodf(lat(l, 6).x + f32(o), ${N}.0) + 0.5); }
// The member before it along its strands' axis (round the loop, when x closes), which a strand draws to;
// or −1. Along x a sphere's strands are its parallels, along y its meridians.
fn rowLeader(l: i32, o: i32) -> f32 {
  if (lat(l, 21).y > 0.5) {
    if (cellIndex(l, o).y > 0) { return f32(slotOf(l, neighbourOf(l, o, 2))); }
    return -1.0;
  }
  if (cellIndex(l, o).x > 0 || closedX(dominant(l))) { return f32(slotOf(l, neighbourOf(l, o, 0))); }
  return -1.0;
}
// On the grid's outline (its first or last row or column): where a shield's rim glows.
fn onRim(l: i32, o: i32) -> bool {
  let ijk = cellIndex(l, o);
  let nx = i32(lat(l, 6).z + 0.5); let ny = i32(lat(l, 6).w + 0.5);
  return (!closedX(dominant(l)) && nx > 1 && (ijk.x == 0 || ijk.x == nx - 1)) || (ny > 1 && (ijk.y == 0 || ijk.y == ny - 1));
}
`;
