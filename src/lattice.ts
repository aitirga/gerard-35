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
 * curve in to a point) and bends it out like a heater shield, a sphere wraps x round it and runs y
 * from its bottom to its top: a hollow shell, and a dome is the sphere's upper half, y from its rim on
 * the floor to its top. A catenoid is the soap film between two coaxial rings (x round it, y from one
 * ring to the other), and a string a line from one end to the other (x along it). A ring, a sphere, a
 * dome and a catenoid close round x. Every map is continuous and keeps neighbours next to each other, so
 * a lattice blends from one shape to another (`morph`) without tearing: the structure is kept.
 *
 * The maps exist twice, kept side by side here: TypeScript (tests, the CPU's own sums) and WGSL
 * (WebGPU), used by the simulation pass in src/fight-particles.ts.
 */

export type LatticeShape = 'box' | 'ball' | 'crystal' | 'ring' | 'column' | 'shield' | 'sphere' | 'dome' | 'catenoid' | 'string';
export const LATTICE_SHAPES: Record<LatticeShape, number> = { box: 0, ball: 1, crystal: 2, ring: 3, column: 4, shield: 5, sphere: 6, dome: 7, catenoid: 8, string: 9 };
/** Shapes whose first and last cells along x are neighbours (round a circle): no seam, a row is a loop. */
export const closedShape = (shape: LatticeShape) => shape === 'ring' || shape === 'sphere' || shape === 'dome' || shape === 'catenoid';
/** How far from the top a shell's rows reach (as a share of a half turn): a sphere to its bottom, a dome to its rim. */
const reachOf = (shape: LatticeShape) => shape === 'dome' ? .5 : 1;
/** Where the dissolve starts: anywhere, at the top, at the bottom, on its outside, or where it was last pushed. */
export type LatticeDissolve = 'random' | 'top' | 'bottom' | 'outside' | 'push';
export const LATTICE_DISSOLVES: Record<LatticeDissolve, number> = { random: 0, top: 1, bottom: 2, outside: 3, push: 4 };

/**
 * Lattices alive at once, the most particles one holds, how many of what is thrown at it each member
 * looks at a frame, and how many points its loose members can be thrown at (`throwAt`).
 */
export const MAX_LATTICES = 4, MAX_MEMBERS = 8192, HIT_SAMPLES = 24, MAX_AIMS = 6;
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
 *  20 the point its surface faces away from (for `fresnel`), opacity · 21 fresnel, the axis its strands run along (0 x, 1 y) ·
 *  22 thrown (`throwAt`): how many points, how hard it steers (1/s), its speed (m/s), how fast it scatters where it lands ·
 *  23 the way the points lie from its middle (an angle round y), how high it arcs ·
 *  24–29 the points (where, and how near counts as landing) ·
 *  LOOK_COL (after them) its look: a colour its members turn to (linear RGB packed in 8 bits each), how
 *  far (0–1), how cracked it is (0–1, `latticeCracks`) and the seed of its cracks ·
 *  FILM_COL a soap film's look (`film`): on, thickness, drain, swirl · +1 its clock (s), the rolling rim's
 *  width (m), the share of a rupture shed as droplets, how fast they are flung (m/s) ·
 *  RIPPLE_COL, +1 two capillary ripples: where (its own space), seconds since · +2 their height, wavelength, speed, decay ·
 *  RUPTURE_COL a rupture: where (its own space), the hole's radius (m; below 0 none) ·
 *  TRAVEL_COL, +1 two pulses travelling along a string: where plucked (cell −1…1), towards which end (±1),
 *  metres travelled, height now · +2 their width (m) · SNAP_COL a snapped string: where (cell), how far
 *  its halves have recoiled (0–1), how hard they whip, snapped (0/1).
 */
export const LOOK_COL = 24 + MAX_AIMS;
export const FILM_COL = LOOK_COL + 1, RIPPLE_COL = FILM_COL + 2, RUPTURE_COL = RIPPLE_COL + 3, TRAVEL_COL = RUPTURE_COL + 1, SNAP_COL = TRAVEL_COL + 3;
export const LATTICE_COLS = SNAP_COL + 1;
/** Capillary ripples a lattice keeps at once, and pulses travelling along a string. */
export const MAX_RIPPLES = 2, MAX_PULSES = 2;
/** How thick a catenoid's shell is, as a share of its radius either way (its z cells, when it has more than one). */
export const CATENOID_SHELL = .1;
/** A linear RGB colour (0–1 each) packed into one number a shader unpacks exactly (8 bits each). */
export const packColour = (rgb: readonly number[]) => rgb.slice(0, 3).reduce((sum, c) => sum * 256 + Math.round(Math.min(1, Math.max(0, c)) * 255), 0);
/**
 * Which of `count` points thrown at a member flies to, by the angle of its home round the lattice's
 * middle (`angle`, round y as `atan2(z, x)`), against the way the points lie (`facing`): the points
 * sorted by their own angle, the lattice is cut into `count` wedges from straight behind, so each side
 * goes to the points on its side and no two streams cross. Also in WGSL (`aimOf`).
 */
export function latticeAim(angle: number, facing: number, count: number) {
  const turn = (((angle - facing + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
  return Math.min(count - 1, Math.floor(turn * count));
}

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
 * A catenoid's radius at height t (−1 one ring, 1 the other) between rings of radius `ring` with a
 * waist of `neck`: r = a·cosh(k·t), a = neck, k = acosh(ring / neck), so both rings are met. Its true
 * minimal surface stands `catenoidHeight` high either side of its waist; any other half-height
 * stretches it along its axis, keeping its profile (a waist narrower than the rings, never wider).
 */
export function catenoidRadius(t: number, ring: number, neck: number) {
  const r = Math.max(ring, 1e-3), a = Math.min(Math.max(neck, 1e-3), r);
  return a * Math.cosh(Math.acosh(r / a) * t);
}
/** The half-height at which a catenoid of waist `neck` reaches rings of radius `ring` (a·acosh(R/a)): the real soap film's. */
export const catenoidHeight = (ring: number, neck: number) => { const a = Math.min(Math.max(neck, 1e-3), Math.max(ring, 1e-3)); return a * Math.acosh(Math.max(ring, 1e-3) / a); };

/**
 * A pulse along a string held at both ends (d'Alembert): its height at `u` metres from the start
 * (0…`length`), plucked at `from` (cell −1…1) towards the end `toward` (1 the far one, −1 the start)
 * and `travelled` metres on, `width` metres wide (a Gaussian of height 1). Each fixed end throws it
 * back upside down: the pulse and its mirror images (every 2·length) add up, so the ends never move.
 * Also in WGSL (`travelOf`).
 */
export function stringPulse(u: number, length: number, from: number, toward: number, travelled: number, width: number) {
  const L = Math.max(length, 1e-4), w = Math.max(width, 1e-4);
  const uu = toward > 0 ? u : L - u, q = (toward > 0 ? (from + 1) / 2 : (1 - from) / 2) * L + travelled;
  const g = (x: number) => Math.exp(-(x * x) / (w * w));
  let y = 0;
  for (let m = -1; m <= 2; m++) y += g(uu - q - 2 * L * m) - g(uu + q - 2 * L * m);
  return y;
}
/**
 * When a pulse reaches an end: metres it travels to reach the end it heads for (plucked at `from`, cell
 * −1…1, towards `toward`), then every `length` after it reaches the other, and so on, each end in turn.
 * Its `n`th reflection (0 the first) is at `first + n·length`, on the end `toward·(−1)^n`.
 */
export function stringReflections(length: number, from: number, toward: number) {
  const L = Math.max(length, 1e-4);
  return { first: (toward > 0 ? (1 - from) / 2 : (from + 1) / 2) * L, every: L, end: (n: number) => (n % 2 === 0 ? toward : -toward) as number };
}

/**
 * Where a cell (−1…1) sits in the lattice's own space for a shape of half-size `size`: a ring's is its
 * radius, tube half-height and tube half-width; a shield's its half-width, half-height and how far it
 * bends out (towards +z); a sphere's (and a dome's) its radius round, its radius up and half its thickness;
 * a catenoid's its rings' radius, its half-height and its waist's radius; a string's its half-length
 * and its section's two radii (a rope of strands when y or z has more than one cell).
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
    case 'sphere': case 'dome': {
      const phi = (c.x + 1) * Math.PI, theta = (1 - c.y) * Math.PI / 2 * reachOf(shape), k = 1 + c.z * size.z / Math.max(size.x, size.y, 1e-4);
      return { x: Math.sin(theta) * Math.cos(phi) * size.x * k, y: Math.cos(theta) * size.y * k, z: Math.sin(theta) * Math.sin(phi) * size.x * k };
    }
    case 'catenoid': {
      const angle = (c.x + 1) * Math.PI, r = catenoidRadius(c.y, size.x, size.z) * (1 + c.z * CATENOID_SHELL);
      return { x: r * Math.cos(angle), y: c.y * size.y, z: r * Math.sin(angle) };
    }
    case 'string': { const [a, b] = disc(c.y, c.z); return { x: c.x * size.x, y: a * size.y, z: b * size.z }; }
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
    case 'sphere': case 'dome': {
      const v = { x: u.x, y: u.y, z: p.z / Math.max(size.x, 1e-4) }, rho = Math.max(Math.hypot(v.x, v.y, v.z), 1e-5);
      let phi = Math.atan2(v.z, v.x); if (phi < 0) phi += 2 * Math.PI;
      const theta = Math.acos(Math.min(1, Math.max(-1, v.y / rho)));
      return { x: phi / Math.PI - 1, y: 1 - theta / (Math.PI / 2 * reachOf(shape)), z: (rho - 1) * Math.max(size.x, size.y) / Math.max(size.z, 1e-4) };
    }
    case 'catenoid': {
      let angle = Math.atan2(p.z, p.x); if (angle < 0) angle += 2 * Math.PI;
      const y = u.y;
      return { x: angle / Math.PI - 1, y, z: (Math.hypot(p.x, p.z) / catenoidRadius(y, size.x, size.z) - 1) / CATENOID_SHELL };
    }
    case 'string': { const [a, b] = square(u.y, u.z); return { x: u.x, y: a, z: b }; }
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

/**
 * How far a cell sits from the next along each axis that has more than one, shortest and longest (the
 * outer shell's, for a ring round its circle; a catenoid's round its waist and its rings, and up its
 * steepest part).
 */
function steps(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like): [number, number][] {
  const [nx, ny, nz] = grid;
  if (shape === 'catenoid') {
    const R = Math.max(size.x, 1e-3), a = Math.min(Math.max(size.z, 1e-3), R), k = Math.acosh(R / a);
    const round: [number, number] = [2 * Math.PI * a * (1 - CATENOID_SHELL) / nx, 2 * Math.PI * R * (1 + CATENOID_SHELL) / nx];
    const up: [number, number] = [2 * size.y / ny, Math.hypot(2 * size.y / ny, 2 * a * k * Math.sinh(k) * (1 + CATENOID_SHELL) / ny)];
    const through: [number, number] = [2 * CATENOID_SHELL * a / nz, 2 * CATENOID_SHELL * R / nz];
    return [nx > 1 ? round : undefined, ny > 1 ? up : undefined, nz > 1 ? through : undefined].filter((v): v is [number, number] => !!v);
  }
  // A shield's bend lengthens its steps across, and its sides closing in on the point its lowest steps up.
  const along = closedShape(shape) ? 2 * Math.PI * (size.x + size.z) / nx : shape === 'shield' ? Math.hypot(2 * size.x / nx, 4 * size.z / nx) : 2 * size.x / nx;
  const up = shape === 'sphere' || shape === 'dome' ? Math.PI * reachOf(shape) * Math.max(size.x, size.y) / ny
    : shape === 'shield' ? Math.hypot(2 * size.y / ny, size.x * (heater(-1 + 3 / ny) - heater(-1 + 1 / ny))) : 2 * size.y / ny;
  const through = shape === 'shield' ? size.z / nz : 2 * size.z / nz;
  return [nx > 1 ? along : 0, ny > 1 ? up : 0, nz > 1 ? through : 0].filter(v => v > 0).map(v => [v, v]);
}
/** The shortest step between neighbouring cells: how close a loose member must come home to bond again. */
export function latticeSpacing(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like) {
  const all = steps(shape, grid, size);
  return all.length ? Math.min(...all.map(s => s[0])) : .05;
}
/** The longest step between neighbouring cells: a "bond" three times longer is a seam (a flowing lattice's two ends), not a bond. */
export function latticeReach(shape: LatticeShape, grid: readonly [number, number, number], size: Vec3Like) {
  const all = steps(shape, grid, size);
  return all.length ? Math.max(...all.map(s => s[1])) : .05;
}

// ── On the GPU (WGSL) ──────────────────────────────────────────────────────────────────────────────────
// `lat(l, c)` reads texel c of lattice l. The cell, the shape maps, the home (with its ripple, a
// string's travelling pulses and its snap, a film's capillary ripples), the neighbour along an axis,
// the cell nearest a point, whether its x wrapped this frame and the order a dissolve takes. `N` is the
// particle count.

/**
 * Capillary ripples (`ripple`), in WGSL: how far a point (its own space) stands out of its surface. The
 * simulation moves the homes by it and the draw thickens a film by it, so the rings show in its colours.
 * Needs `lat(l, c)`.
 */
export const latticeRippleWgsl = /* wgsl */ `
// Capillary ripples from where it was struck (\`ripple\`): rings running out from each point at their
// speed, a train of them behind each front, dying away with time and distance. Nothing when none.
fn rippleOf(l: i32, p: vec3f) -> f32 {
  let k = lat(l, ${RIPPLE_COL + MAX_RIPPLES});
  if (k.x == 0.0) { return 0.0; }
  var sum = 0.0;
  for (var r = 0; r < ${MAX_RIPPLES}; r++) {
    let at = lat(l, ${RIPPLE_COL} + r);
    if (at.w < 0.0) { continue; }
    let d = length(p - at.xyz); let lambda = max(k.y, 1e-3);
    let behind = k.z * at.w - d;
    if (behind < -lambda) { continue; }
    let env = exp(-max(-behind, 0.0) * max(-behind, 0.0) / (0.2 * lambda * lambda)) * exp(-max(behind, 0.0) / (2.5 * lambda));
    sum += k.x * exp(-at.w / max(k.w, 1e-3)) * env / (1.0 + d / (2.0 * lambda)) * -cos(6.2831853 * behind / lambda);
  }
  return sum;
}
`;

export const latticeWgsl = (N: number) => /* wgsl */ `
fn lat(l: i32, c: i32) -> vec4f { return textureLoad(uLattices, vec2i(c, l), 0); }
fn lWorld(l: i32, p: vec3f) -> vec3f { let a = lat(l, 0); let b = lat(l, 1); let c = lat(l, 2); return vec3f(dot(a.xyz, p) + a.w, dot(b.xyz, p) + b.w, dot(c.xyz, p) + c.w); }
fn lLocal(l: i32, w: vec3f) -> vec3f { let a = lat(l, 3); let b = lat(l, 4); let c = lat(l, 5); return vec3f(dot(a.xyz, w) + a.w, dot(b.xyz, w) + b.w, dot(c.xyz, w) + c.w); }
fn fmodf(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn linf3(c: vec3f) -> f32 { let a = abs(c); return max(a.x, max(a.y, a.z)); }
fn toDisc(q: vec2f) -> vec2f { return q * (max(abs(q.x), abs(q.y)) / max(length(q), 1e-5)); }
fn toSquare(q: vec2f) -> vec2f { return q * (length(q) / max(max(abs(q.x), abs(q.y)), 1e-5)); }
fn heater(y: f32) -> f32 { let t = clamp((0.15 - y) / 1.15, 0.0, 1.0); return sqrt(4.0 - 3.0 * t * t) - 1.0; }
fn closedX(shape: f32) -> bool { return (shape > 2.5 && shape < 3.5) || (shape > 5.5 && shape < 8.5); }
// A catenoid's radius at height t (−1…1): a·cosh(k·t), its waist a, reaching its rings (catenoidRadius).
fn catR(t: f32, s: vec3f) -> f32 {
  let r = max(s.x, 1e-3); let a = min(max(s.z, 1e-3), r); let q = r / a;
  return a * cosh(log(q + sqrt(max(q * q - 1.0, 0.0))) * t);
}
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
  if (shape > 7.5 && shape < 8.5) {
    // A catenoid: the soap film between two rings, x round it, y from one ring to the other.
    let angle = (c.x + 1.0) * 3.14159265; let r = catR(c.y, s) * (1.0 + c.z * ${CATENOID_SHELL});
    return vec3f(r * cos(angle), c.y * s.y, r * sin(angle));
  }
  if (shape > 8.5) { let q = toDisc(c.yz); return vec3f(c.x * s.x, q.x * s.y, q.y * s.z); }
  // A sphere's shell: x round it, y from its bottom to its top, z through its thickness; a dome only its upper half.
  let phi = (c.x + 1.0) * 3.14159265; let theta = (1.0 - c.y) * select(1.5707963, 0.78539816, shape > 6.5);
  let k = 1.0 + c.z * s.z / max(max(s.x, s.y), 1e-4);
  return vec3f(sin(theta) * cos(phi) * s.x, cos(theta) * s.y, sin(theta) * sin(phi) * s.x) * k;
}
// Which way its surface faces at p (its own space), for what ripples across it: out of a ball or a shell,
// out from the axis of a ring, a column or a catenoid, up from a string, out of a box's or a shield's face.
fn outwardOf(shape: f32, p: vec3f) -> vec3f {
  if ((shape > 0.5 && shape < 2.5) || (shape > 5.5 && shape < 7.5)) { return p / max(length(p), 1e-5); }
  if ((shape > 2.5 && shape < 4.5) || (shape > 7.5 && shape < 8.5)) { let r = vec3f(p.x, 0.0, p.z); return r / max(length(r), 1e-5); }
  if (shape > 8.5) { return vec3f(0.0, 1.0, 0.0); }
  return vec3f(0.0, 0.0, 1.0);
}
${latticeRippleWgsl}
// A string's pulses (\`travel\`) at cell x (−1…1): d'Alembert, each pulse and its mirror images, so it
// flips over at each fixed end (stringPulse).
fn travelOf(l: i32, cx: f32) -> f32 {
  let s = lat(l, 8); let L = max(2.0 * s.x, 1e-4); let w = max(lat(l, ${TRAVEL_COL + MAX_PULSES}).x, 1e-4);
  var y = 0.0;
  for (var n = 0; n < ${MAX_PULSES}; n++) {
    let q4 = lat(l, ${TRAVEL_COL} + n);
    if (q4.w == 0.0) { continue; }
    let u = (cx + 1.0) * 0.5 * L;
    let uu = select(L - u, u, q4.y > 0.0);
    let q = select((1.0 - q4.x) * 0.5, (q4.x + 1.0) * 0.5, q4.y > 0.0) * L + q4.z;
    var sum = 0.0;
    for (var m = -1; m <= 2; m++) {
      let a = uu - q - 2.0 * L * f32(m); let b = uu + q - 2.0 * L * f32(m);
      sum += exp(-a * a / (w * w)) - exp(-b * b / (w * w));
    }
    y += q4.w * sum;
  }
  return y;
}
fn homeOf(l: i32, o: i32) -> vec3f {
  let c = cellOf(l, o);
  let h = lat(l, 7); let s = lat(l, 8); let w = lat(l, 11);
  var p = mix(shapeMap(h.y, c, s.xyz), shapeMap(h.z, c, s.xyz), h.w);
  let form = dominant(l);
  if (form < 7.5) {
    // A ripple running through it.
    p.y += w.x * sin(p.x * w.y + w.z) + w.x * 0.5 * sin(p.z * w.y * 1.3 - w.z * 0.8);
  } else if (form < 8.5) {
    // A catenoid breathes: its ripple runs up it and round it, in and out from its axis.
    let r = vec2f(p.x, p.z); let rl = max(length(r), 1e-5);
    let bulge = w.x * sin(p.y * w.y - w.z + (c.x + 1.0) * 9.424778) * (1.0 - c.y * c.y);
    p.x += r.x / rl * bulge; p.z += r.y / rl * bulge;
  } else {
    // A string trembles between its two fixed ends, and its pulses travel along it.
    let still = sin((c.x + 1.0) * 1.5707963);
    p.y += still * w.x * sin(p.x * w.y + w.z) + travelOf(l, c.x);
    p.z += still * w.x * 0.6 * sin(p.x * w.y * 1.4 - w.z * 1.3);
    // Snapped: each half recoils onto its own end, whipping as it goes.
    let snap = lat(l, ${SNAP_COL});
    if (snap.w > 0.5) {
      let left = c.x < snap.x;
      let pole = select(s.x, -s.x, left);
      let rel = select((1.0 - c.x) / max(1.0 - snap.x, 1e-3), (c.x + 1.0) / max(snap.x + 1.0, 1e-3), left);
      p.x = pole + (p.x - pole) * (1.0 - snap.y * 0.94);
      p.y += snap.z * sin(rel * 4.712389) * rel * snap.y * (1.0 - snap.y) * 4.0;
    }
  }
  p += outwardOf(form, p) * rippleOf(l, p);
  return lWorld(l, p);
}
// A string's pulses lighting it up: how far it stands out of line now, as a share of its pulses' height.
fn travelGlow(l: i32, o: i32) -> f32 {
  if (dominant(l) < 8.5) { return 0.0; }
  let a = max(abs(lat(l, ${TRAVEL_COL}).w), abs(lat(l, ${TRAVEL_COL + 1}).w));
  if (a == 0.0) { return 0.0; }
  return min(1.5, abs(travelOf(l, cellOf(l, o).x)) / a);
}
// Snapped where it was cut: the members either side of the cut break loose.
fn snappedAt(l: i32, o: i32) -> bool {
  let snap = lat(l, ${SNAP_COL});
  if (snap.w < 0.5 || dominant(l) < 8.5) { return false; }
  return abs(cellOf(l, o).x - snap.x) < 3.0 / lat(l, 6).z;
}
// Ruptured (\`rupture\`): inside the hole running out from where it burst.
fn rupturedAt(l: i32, w: vec3f) -> bool {
  let r = lat(l, ${RUPTURE_COL});
  return r.w > 0.0 && length(lLocal(l, w) - r.xyz) < r.w;
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
  } else if (shape > 7.5 && shape < 8.5) {
    var angle = atan2(p.z, p.x); if (angle < 0.0) { angle += 6.2831853; }
    c = vec3f(angle / 3.14159265 - 1.0, u.y, (length(p.xz) / catR(u.y, s.xyz) - 1.0) / ${CATENOID_SHELL});
  } else if (shape > 8.5) { let q = toSquare(u.yz); c = vec3f(u.x, q.x, q.y); }
  else if (shape > 5.5) {
    let v = vec3f(u.x, u.y, p.z / max(s.x, 1e-4));
    let rho = max(length(v), 1e-5);
    var phi = atan2(v.z, v.x); if (phi < 0.0) { phi += 6.2831853; }
    let theta = acos(clamp(v.y / rho, -1.0, 1.0));
    c = vec3f(phi / 3.14159265 - 1.0, 1.0 - theta / select(1.5707963, 0.78539816, shape > 6.5), (rho - 1.0) * max(s.x, s.y) / max(s.z, 1e-4));
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
// Thrown: the point a loose member flies at (where, how near counts as landing), by the side of the
// lattice its home is on (latticeAim).
fn aimOf(l: i32, home: vec3f) -> vec4f {
  let n = i32(lat(l, 22).x + 0.5);
  let rel = home - vec3f(lat(l, 0).w, lat(l, 1).w, lat(l, 2).w);
  let turn = fmodf(atan2(rel.z, rel.x) - lat(l, 23).x + 3.14159265, 6.2831853) / 6.2831853;
  return lat(l, 24 + clamp(i32(turn * f32(n)), 0, n - 1));
}
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
