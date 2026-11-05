import * as pc from 'playcanvas';

/**
 * Fire drawn as flame rather than as sprites, two ways.
 *
 * A fire standing on its own (a lit bin, a bonfire) is one upright surface turned to the camera whose
 * shader builds its flames from layers of noise rising through it, each warping the next, on the
 * shader's clock and the fire's own seed. Its tongues split, merge and lick up without ever
 * repeating, no two fires alike; their temperature colours them (white-hot low in the heart,
 * yellow, orange, deep red at the tips) and a column of smoke rises over them. Every fire is one
 * instance of one draw call.
 *
 * Someone burning (`wrap`) burns themselves, whatever they are made of: the fire catches at a few
 * points of their surface and spreads over their own parts, leaving char with hot veins behind a bright
 * front, and real 3D tongues of flame grow out of their actual triangles, seen from any side and hidden
 * by the body like anything else. Nothing stands on the floor.
 *
 * What the game makes of them (levels, light, sparks) lives in src/effects.ts (docs/graphics.md).
 */
export interface Flame {
  /** The middle of its base, on the floor (keep it updated to move it). */
  readonly at: pc.Vec3;
  /** Half its width and the height its flames reach (m), and how much taller its smoke rises (× height). */
  width: number; height: number; smoke: number;
  /** 0 out, 1 burning fully: thinner and lower as it falls. */
  strength: number;
  /** How white-hot it burns (0–2); past 0 its heart blooms. */
  heat: number;
  /**
   * Metres nearer the camera it is drawn than it stands (the same place on screen): flames in front
   * of whoever burns are drawn over them, negative ones behind them.
   */
  nearer: number;
  /** 0–1: how see-through its middle is, so whoever it wraps shows between its tongues. */
  hollow: number;
  /** Its own pattern of flames. */
  readonly seed: number;
  remove(): void;
}

/** The flame shader (WGSL). */
const VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aBase: vec4f;
attribute aSize: vec4f;
attribute aLook: vec4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
varying vUv: vec2f;
varying vLook: vec4f;
varying vShape: vec2f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let view = uniform.matrix_view;
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  let back = vec3f(view[0][2], view[1][2], view[2][2]);
  // It stands upright on its base and turns to face the camera, like someone standing there: it
  // never sinks into the floor, and whoever stands in front of it hides it as they should.
  let top = 1.0 + aSize.y;
  let world = aBase.xyz + normalize(vec3f(right.x, 0.0, right.z)) * vertex_position.x * aBase.w + vec3f(0.0, vertex_position.y * top * aSize.x, 0.0) + back * aSize.z;
  output.vUv = vec2f(vertex_position.x, vertex_position.y * top);
  output.vLook = aLook;
  output.vShape = vec2f(aSize.y, aSize.w);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uTime: f32;
uniform uLight: vec3f;
varying vUv: vec2f;
varying vLook: vec4f;
varying vShape: vec2f;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), f.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), f.x), f.y);
}
// Fractal noise of a few octaves, scaled so fewer octaves keep the same range (cost is per octave).
fn fbm(start: vec2f, octaves: i32) -> f32 {
  var v = 0.0; var a = 0.5; var total = 0.0; var p = start;
  for (var i = 0; i < octaves; i++) { v += a * noise(p); total += a; p = p * 2.03 + vec2f(17.1, 3.7); a *= 0.5; }
  return v / total * 0.97;
}
// Temperature to colour: deep red, orange, yellow, white-hot.
fn ramp(h: f32) -> vec3f {
  var c = mix(vec3f(0.4, 0.03, 0.0), vec3f(1.0, 0.24, 0.02), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3f(1.0, 0.6, 0.1), smoothstep(0.3, 0.62, h));
  return mix(c, vec3f(1.0, 0.93, 0.62), smoothstep(0.62, 0.95, h));
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let seed = vLook.x * 97.0; let strength = vLook.y; let heat = vLook.z; let t = uniform.uTime;
  let uv = vUv;
  let y = uv.y; let fy = clamp(y, 0.0, 1.0);
  // Two slow fields of noise rising through it warp a quick one: its tongues split, merge and
  // never repeat. Stretched upwards, the noise draws tall tongues, two or three across.
  let p = vec2f(uv.x * (1.2 + vLook.w * 3.0), y * 1.5);
  let q = vec2f(fbm(p * 0.8 + vec2f(seed, -t * 0.8), 3), fbm(p * 0.8 + vec2f(seed + 7.3, -t * 1.0), 3));
  let n = fbm(p + (q - 0.5) * 2.2 + vec2f(seed * 0.37, -t * 2.4), 4);
  // Its body: wide and white-hot low down, narrowing and cooling as it climbs, swaying with the slow
  // field; the noise eats more of it the higher it is, tearing the top into tongues.
  let x = abs(uv.x + (q.x - 0.5) * 0.5 * fy) / mix(1.0, 0.5, fy);
  let body = (1.0 - smoothstep(0.15, 1.0, x)) * (1.0 - fy * 0.95);
  var temp = body * 1.35 + (n - 0.55) * (0.6 + fy * 1.3);
  // A rounded root broken by the noise (never a straight line on the floor), nothing past its top or sides.
  let side = abs(uv.x);
  temp *= smoothstep(0.0, (0.1 + 0.3 * side * side) * (0.5 + n), y) * smoothstep(1.15, 0.85, y) * (1.0 - smoothstep(0.65, 0.97, side));
  temp = clamp(temp * strength - (1.0 - strength) * 0.15, 0.0, 1.0);
  var fireA = smoothstep(0.04, 0.22, temp);
  var fire = ramp(temp) * (1.0 + heat * smoothstep(0.55, 1.0, temp));
  // Wrapping someone, its middle shows them between its tongues.
  fireA *= 1.0 - vShape.y * 0.8 * (1.0 - smoothstep(0.25, 0.85, abs(uv.x))) * smoothstep(0.05, 0.35, y);
  // Smoke: a column rising from its upper flames, widening as it climbs and thinning at the top.
  var smokeA = 0.0;
  var smoke = vec3f(0.0);
  if (vShape.x > 0.0) {
    let sy = (y - 0.55) / max(vShape.x + 0.45, 0.01);
    let s = fbm(vec2f(uv.x * 1.5 + (q.y - 0.5) * 1.2, y * 1.2) + vec2f(seed * 0.5, -t * 0.6), 3);
    let column = 1.0 - abs(uv.x + (q.x - 0.5) * 0.6 * y) / mix(0.3, 0.8, clamp(sy, 0.0, 1.0));
    smokeA = clamp(smoothstep(0.3, 0.65, s + column * 0.5 - 0.15) * smoothstep(0.0, 0.25, sy) * smoothstep(1.0, 0.5, sy) * (1.0 - smoothstep(0.7, 0.97, abs(uv.x))), 0.0, 1.0) * 0.85 * strength;
    // Lit warm by the flames under it, cooling to grey; it takes the scene's light like a surface.
    smoke = mix(vec3f(0.42, 0.25, 0.15), vec3f(0.2, 0.19, 0.19), smoothstep(0.0, 0.5, sy)) * uniform.uLight + vec3f(0.45, 0.15, 0.02) * (1.0 - smoothstep(0.0, 0.3, sy)) * 0.6;
  }
  smokeA *= 1.0 - fireA;
  if (fireA + smokeA < 0.004) { discard; }
  #if (FOG != NONE)
    let fogged = getFogFactor();
    fire *= fogged;
    smoke = mix(uniform.fog_color, smoke, fogged);
  #endif
  fire = gammaCorrectOutput(toneMap(fire));
  smoke = gammaCorrectOutput(toneMap(smoke));
  // Premultiplied: flames add their light and cover a little of what is behind; smoke covers it.
  output.color = vec4f(fire * fireA + smoke * smokeA, fireA * 0.4 + smokeA);
  return output;
}`;

/**
 * The burn on someone's own surface: each part drawn again a hair over itself. Its pattern is pinned
 * to the part (`uRest`, the part in the pose it caught fire in), so it moves with them and never swims.
 * The fire spreads out from where it caught (`uSeeds`) as `uBurn.x` grows, its edge torn by noise: behind
 * it char with veins of heat that breathe, along it a bright line eating into them.
 */
const SHELL_VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute vertex_normal: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uInflate: f32;
uniform uRest: mat4x4f;
varying vRest: vec3f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let model = uniform.matrix_model;
  let n = normalize((model * vec4f(vertex_normal, 0.0)).xyz);
  let world = (model * vec4f(vertex_position, 1.0)).xyz + n * uniform.uInflate;
  output.vRest = (uniform.uRest * vec4f(vertex_position, 1.0)).xyz;
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

/** Temperature to colour, shared by what burns on someone: deep red, orange, yellow, white-hot. */
const RAMP_WGSL = /* wgsl */ `
fn ramp(h: f32) -> vec3f {
  var c = mix(vec3f(0.4, 0.03, 0.0), vec3f(1.0, 0.24, 0.02), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3f(1.0, 0.6, 0.1), smoothstep(0.3, 0.62, h));
  return mix(c, vec3f(1.0, 0.93, 0.62), smoothstep(0.62, 0.95, h));
}`;

/** How much further than its `spread` a burn reaches, so at 1 not a corner of them is left; a tongue catches with it. */
const SPREAD_REACH = 1.22;

const SHELL_FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uTime: f32;
uniform uBurn: vec4f;
uniform uSeeds: mat4x4f;
uniform uSeed: f32;
varying vRest: vec3f;
fn hash(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn noise(p: vec3f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 0.0)), hash(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3f(0.0, 0.0, 1.0)), hash(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 1.0)), hash(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
${RAMP_WGSL}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uTime; let burn = uniform.uBurn; let seed = uniform.uSeed * 97.0; let seeds = uniform.uSeeds;
  let p = vRest;
  // How far this point is from where it caught, against the furthest point of them; noise tears the edge.
  let d = min(min(distance(p, seeds[0].xyz), distance(p, seeds[1].xyz)), min(distance(p, seeds[2].xyz), distance(p, seeds[3].xyz)));
  let torn = noise(p * 4.5 + seed) * 0.55 + noise(p * 12.0 + seed + 3.7) * 0.3 + noise(p * 27.0 + seed + 9.1) * 0.15 - 0.5;
  let edge = d / max(burn.w, 0.01) + torn * 0.5 - burn.x * ${SPREAD_REACH};
  if (edge > 0.12) { discard; }
  let burnt = 1.0 - smoothstep(-0.03, 0.0, edge);
  // A scorch ahead of the fire, and the fire's front, a thin line that flickers where it is eating into them.
  let scorch = 1.0 - smoothstep(-0.02, 0.12, edge);
  let line = (1.0 - smoothstep(0.0, 0.02, abs(edge + 0.01))) * smoothstep(0.28, 0.62, noise(p * 6.0 + vec3f(seed, -t * 1.6, 0.0)));
  // Behind it, cracks of heat through the char, breathing slowly.
  let crack = abs(noise(p * 8.5 + vec3f(seed * 0.3, -t * 0.18, seed)) - 0.5) * 2.0;
  let vein = (1.0 - smoothstep(0.0, 0.07, crack)) * burnt;
  let breath = 0.35 + 0.65 * noise(p * 2.6 + vec3f(t * 0.7, -t * 0.9, seed));
  var emit = (ramp(0.36 + 0.3 * line) * line * 0.9 + ramp(0.1 + 0.3 * breath) * vein * breath * 0.85) * (1.0 + burn.y * 0.2) * burn.z;
  var soot = vec3f(0.024, 0.016, 0.013) * (0.6 + 0.8 * noise(p * 15.0 + seed));
  let a = clamp(max(burnt * 0.84, scorch * 0.4) * min(burn.z, 1.0), 0.0, 1.0);
  #if (FOG != NONE)
    let fogged = getFogFactor();
    emit *= fogged;
    soot = mix(uniform.fog_color, soot, fogged);
  #endif
  output.color = vec4f(gammaCorrectOutput(toneMap(soot)) * a + gammaCorrectOutput(toneMap(emit)), a);
  return output;
}`;

/**
 * A tongue of flame, a real 3D teardrop grown out of a point of someone's surface. It leaves along the
 * way the surface faces, then climbs, whatever that surface is; it swells, licks and sways, and at the
 * end of each breath its tip pinches off and rises. No state: its life is a function of the clock and its
 * seed, and where it stands comes from its part's transform (`uParts`), so it follows every move they
 * make and a fire of hundreds is one draw.
 */
const TONGUE_VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aRoot: vec4f;
attribute aFacing: vec4f;
attribute aLook: vec4f;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uTime: f32;
var uParts: texture_2d<uff>;
varying vLook: vec4f;
varying vNormal: vec3f;
varying vBack: vec3f;
varying vSpot: vec2f;
fn chance(x: f32) -> f32 { return fract(sin(x * 91.17) * 43758.5453); }
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let part = i32(aRoot.w + 0.5);
  let m0 = textureLoad(uParts, vec2i(0, part), 0); let m1 = textureLoad(uParts, vec2i(1, part), 0); let m2 = textureLoad(uParts, vec2i(2, part), 0);
  let burn = textureLoad(uParts, vec2i(3, part), 0);
  let local = vec4f(aRoot.xyz, 1.0);
  let root = vec3f(dot(m0, local), dot(m1, local), dot(m2, local));
  let facing = vec4f(aFacing.xyz, 0.0);
  let normal = normalize(vec3f(dot(m0, facing), dot(m1, facing), dot(m2, facing)));
  let t = uniform.uTime; let seed = aLook.x;
  // Each breath its own: how long it lasts and how tall it gets.
  let breaths = t * mix(1.5, 3.1, chance(seed + 0.31)) + seed * 37.0;
  let which = floor(breaths); let life = breaths - which;
  let big = 0.6 + 0.65 * chance(which * 0.137 + seed);
  let grow = smoothstep(0.0, 0.28, life); let pinch = smoothstep(0.42, 1.0, life);
  // It catches as the burn reaches it (the rank in aFacing.w: how far from where the fire began).
  let caught = clamp((burn.z * ${SPREAD_REACH} - aFacing.w) / 0.06, 0.0, 1.0);
  let strength = clamp(burn.x, 0.0, 1.3) * caught;
  let tall = aLook.y * burn.y * big * (0.45 + 0.55 * grow) * strength;
  let wide = (tall * 0.2 + aLook.z * 0.08) * (0.35 + 0.65 * grow) * (1.0 - pinch * 0.7) * min(strength * 3.0, 1.0);
  let v = vertex_position.y;
  // Wide where it leaves them, or a teardrop of its own once it pinches off.
  let round_ = pow(max(sin(3.14159 * pow(v, 0.55)), 0.0), 0.9);
  let radius = wide * mix(pow(1.0 - v, 1.25), round_, pinch);
  let lift = tall * 0.85 * pinch * pinch;
  // Out of the surface first, then up, whichever way it faces; what faces up has nothing to leave.
  let away = vec3f(normal.x, max(normal.y, -0.15), normal.z);
  let leave = (1.0 - exp(-v * 4.0)) * tall * 0.26 * (1.0 - max(normal.y, 0.0));
  let sway = vec3f(sin(v * 5.5 - t * 8.0 + seed * 40.0), 0.0, cos(v * 4.2 - t * 6.3 + seed * 71.0)) * tall * 0.2 * v * (0.5 + 0.5 * v);
  let spine = root + away * (0.008 + leave) + vec3f(0.0, pow(v, 1.2) * tall + lift, 0.0) + sway;
  let around = vec3f(vertex_position.x, 0.0, vertex_position.z);
  let world = spine + around * radius;
  let view = uniform.matrix_view;
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  output.vLook = vec4f(v, min(strength * 2.5, 1.0) * (1.0 - smoothstep(0.72, 1.0, life)), seed, burn.w);
  output.vNormal = normalize(around + vec3f(0.0, 0.3, 0.0));
  output.vBack = vec3f(view[0][2], view[1][2], view[2][2]);
  // Where it is across the screen and how high: flames side by side share one noise, a single fire.
  output.vSpot = vec2f(dot(world, right), world.y);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const TONGUE_FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uTime: f32;
varying vLook: vec4f;
varying vNormal: vec3f;
varying vBack: vec3f;
varying vSpot: vec2f;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), f.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), f.x), f.y);
}
${RAMP_WGSL}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let along = vLook.x; let fade = vLook.y; let seed = vLook.z; let heat = vLook.w; let t = uniform.uTime;
  // Round, so the eye looks through more fire at its middle than at its edge: that is its volume.
  let through = abs(dot(normalize(vNormal), normalize(vBack)));
  // Noise rising through it, warped by a slower one, eats it more the higher it climbs.
  let p = vec2f(vSpot.x * 6.0 + seed * 13.0, vSpot.y * 3.4 - t * 3.6);
  let warp = noise(p * 0.6 + vec2f(seed * 7.0, -t * 0.7));
  let n = noise(p + (warp - 0.5) * 1.7) * 0.65 + noise(p * 2.1 + (warp - 0.5) * 2.4) * 0.35;
  // Hottest a little above where it leaves them, cooling as it climbs; it melts into them at its root.
  let lobe = smoothstep(0.0, 0.2, along) * (1.0 - along * 0.85);
  let temp = clamp((mix(0.6, 1.0, through) * lobe * 0.68 + (n - 0.5) * (0.26 + along * 0.8)) * fade, 0.0, 1.0);
  let a = smoothstep(0.08, 0.34, temp) * smoothstep(0.0, 0.22, along);
  if (a < 0.004) { discard; }
  var fire = ramp(temp) * (1.0 + heat * 0.5 * smoothstep(0.7, 1.0, temp));
  #if (FOG != NONE)
    fire *= getFogFactor();
  #endif
  // Mostly covering what is behind, with some added light: flames in front of flames melt together and keep their colour rather than summing to white.
  output.color = vec4f(gammaCorrectOutput(toneMap(fire)) * a, a * 0.72);
  return output;
}`;

/** Someone burning: their own surface and the tongues growing out of it (`wrap`). */
export interface Shell {
  /** 0 out, 1 burning fully, and how white-hot (as a flame's). */
  strength: number; heat: number;
  /** How much of them has caught (0–1): it spreads from where it began, and a tongue grows wherever it reaches. */
  spread: number;
  /** How tall their tongues of flame lick (m). */
  reach: number;
  /** Their parts, in world space, to throw sparks from. */
  readonly parts: readonly pc.MeshInstance[];
  remove(): void;
}

/** Tongues of flame and burning parts at once, across everyone on fire. */
const MAX_TONGUES = 1600, MAX_BURNING_PARTS = 512;
/** Floats per tongue: where on its part + which part, the way that part faces there + when it catches, its seed, height, width. */
const TONGUE_STRIDE = 12;
/** Tongues per square metre of someone, and how few and how many anyone has. */
const TONGUE_DENSITY = 58, TONGUES_MIN = 36, TONGUES_MAX = 300;
/** Points of their surface where a fire catches, and how many draws of each tongue to look for an open spot. */
const CATCH_POINTS = 4, TONGUE_TRIES = 3;

/** A mesh's triangles, read once; one that keeps nothing to read gives its bounding box. */
const meshTriangles = new WeakMap<pc.Mesh, { positions: number[]; indices: number[] }>();
function trianglesOf(mesh: pc.Mesh) {
  let known = meshTriangles.get(mesh);
  if (known) return known;
  let positions: number[] = [], indices: number[] = [];
  mesh.getPositions(positions); mesh.getIndices(indices);
  if (positions.length && !indices.length) indices = Array.from({ length: positions.length / 3 }, (_, i) => i);
  if (!indices.length) {
    const c = mesh.aabb.center, h = mesh.aabb.halfExtents;
    positions = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(i => [c.x + (i & 1 ? h.x : -h.x), c.y + (i & 2 ? h.y : -h.y), c.z + (i & 4 ? h.z : -h.z)]);
    indices = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  }
  known = { positions, indices };
  meshTriangles.set(mesh, known);
  return known;
}

/** What burns of someone: their parts, posed as they caught, and where their tongues grow. */
interface Surface {
  parts: pc.MeshInstance[];
  /** Each part from its own space to the pose they caught fire in. */
  rest: Float32Array[];
  /** Where it catches, in that pose (`uSeeds`), and how far its furthest point is from them. */
  seeds: Float32Array; furthest: number;
  /** `TONGUE_STRIDE` floats each, the part being its index in `parts`. */
  tongues: Float32Array;
}

/** What burns of them: what shows, but for a flat puddle or shadow at their feet and anything marked `fireproof` (Uri, riding Vertitrón). */
function burnableParts(model: pc.Entity) {
  const feet = model.getPosition().y;
  const fireproof = (node: pc.GraphNode) => { for (let n: pc.GraphNode | null = node; n && n !== model.parent; n = n.parent) if (n.tags.has('fireproof')) return true; return false; };
  return (model.findComponents('render') as pc.RenderComponent[]).flatMap(r => r.meshInstances).filter(m => {
    if (!m.mesh || !m.visible || !(m.node as pc.Entity).enabled || fireproof(m.node)) return false;
    const box = m.aabb;
    return !(box.halfExtents.y < .03 && box.center.y < feet + .08);
  });
}

/** Each body's survey, as it takes a moment and every fire hit on them starts a fire: kept while they keep their parts. */
const surveys = new WeakMap<pc.Entity, Surface>();
function surfaceOf(model: pc.Entity) {
  const parts = burnableParts(model), known = surveys.get(model);
  if (known && known.parts.length === parts.length && known.parts.every((m, i) => m === parts[i])) return known;
  const surface = surveySurface(model, parts);
  surveys.set(model, surface);
  return surface;
}
/**
 * Finds where someone burns, from their actual triangles: tongues spread over them by area, never on
 * what faces the floor or lies buried inside another of their parts, and the points where it catches,
 * apart from each other. Anything with triangles works, whatever it is.
 */
function surveySurface(model: pc.Entity, parts: pc.MeshInstance[]): Surface {
  const toRest = new pc.Mat4().copy(model.getWorldTransform()).invert();
  const worlds = parts.map(m => m.node.getWorldTransform()), inverses = worlds.map(w => new pc.Mat4().copy(w).invert());
  const poses = worlds.map(w => new pc.Mat4().mul2(toRest, w)), rest = poses.map(pose => new Float32Array(pose.data));
  // Every triangle that can burn, with how much it weighs.
  const a = new pc.Vec3(), b = new pc.Vec3(), c = new pc.Vec3(), u = new pc.Vec3(), v = new pc.Vec3(), n = new pc.Vec3();
  const found: { part: number; i: number; n: [number, number, number] }[] = [], totals: number[] = [];
  let weight = 0, area = 0;
  parts.forEach((m, part) => {
    const { positions: p, indices: id } = trianglesOf(m.mesh!);
    for (let i = 0; i + 2 < id.length; i += 3) {
      worlds[part].transformPoint(a.set(p[id[i] * 3], p[id[i] * 3 + 1], p[id[i] * 3 + 2]), a);
      worlds[part].transformPoint(b.set(p[id[i + 1] * 3], p[id[i + 1] * 3 + 1], p[id[i + 1] * 3 + 2]), b);
      worlds[part].transformPoint(c.set(p[id[i + 2] * 3], p[id[i + 2] * 3 + 1], p[id[i + 2] * 3 + 2]), c);
      n.cross(u.sub2(b, a), v.sub2(c, a));
      const size = n.length() / 2;
      if (size < 1e-6) continue;
      n.mulScalar(1 / (2 * size));
      // Nothing grows out of what faces the floor; a little more out of what faces up.
      if (n.y < -.5) continue;
      area += size; weight += size * (1 + .3 * n.y);
      found.push({ part, i, n: [n.x, n.y, n.z] }); totals.push(weight);
    }
  });
  const wanted = Math.round(Math.max(TONGUES_MIN, Math.min(TONGUES_MAX, area * TONGUE_DENSITY)));
  const spacing = Math.sqrt(area / Math.max(1, wanted));
  const local = new pc.Vec3(), world = new pc.Vec3(), inside = new pc.Vec3(), place = new pc.Vec3();
  const boxes = parts.map(m => m.aabb.clone());
  const buried = (from: number) => parts.some((m, other) => {
    if (other === from || !boxes[other].containsPoint(world)) return false;
    inverses[other].transformPoint(world, inside);
    const box = m.mesh!.aabb, h = box.halfExtents, o = box.center, skin = .002;
    return Math.abs(inside.x - o.x) < h.x - skin && Math.abs(inside.y - o.y) < h.y - skin && Math.abs(inside.z - o.z) < h.z - skin;
  });
  const roots: number[][] = [], places: pc.Vec3[] = [];
  for (let tries = wanted * TONGUE_TRIES; tries > 0 && roots.length < wanted && found.length; tries--) {
    const pick = Math.random() * weight;
    let low = 0, high = totals.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (totals[mid] < pick) low = mid + 1; else high = mid; }
    const tri = found[low], { positions: p, indices: id } = trianglesOf(parts[tri.part].mesh!);
    let s = Math.random(), t = Math.random();
    if (s + t > 1) { s = 1 - s; t = 1 - t; }
    const r = 1 - s - t, at = (k: number) => p[id[tri.i] * 3 + k] * r + p[id[tri.i + 1] * 3 + k] * s + p[id[tri.i + 2] * 3 + k] * t;
    local.set(at(0), at(1), at(2));
    worlds[tri.part].transformPoint(local, world);
    if (buried(tri.part)) continue;
    // The way it faces, in its part's own space.
    const facing = inverses[tri.part].transformVector(u.set(tri.n[0], tri.n[1], tri.n[2]), v).normalize();
    poses[tri.part].transformPoint(local, place);
    places.push(place.clone());
    roots.push([local.x, local.y, local.z, tri.part, facing.x, facing.y, facing.z]);
  }
  // Where it catches: a first point anywhere, then each as far as it can from the ones before.
  const seeds = new Float32Array(CATCH_POINTS * 4), chosen: pc.Vec3[] = [];
  const nearest = (p: pc.Vec3) => chosen.reduce((best, q) => Math.min(best, p.distance(q)), Infinity);
  for (let i = 0; i < CATCH_POINTS; i++) {
    let best = places[Math.floor(Math.random() * places.length)] ?? new pc.Vec3();
    for (let tries = 0; i && tries < 8; tries++) { const other = places[Math.floor(Math.random() * places.length)]; if (other && nearest(other) > nearest(best)) best = other; }
    chosen.push(best);
    seeds.set([best.x, best.y, best.z, 1], i * 4);
  }
  const furthest = Math.max(.01, ...places.map(nearest));
  const tongues = new Float32Array(roots.length * TONGUE_STRIDE);
  roots.forEach((r, i) => {
    const big = Math.random();
    // Many small and a few tall ones; each catches as the burn reaches it, give or take.
    tongues.set([...r, Math.max(0, Math.min(1, nearest(places[i]) / furthest + (Math.random() - .5) * .12)), Math.random(), .5 + .8 * big * big, spacing, 0], i * TONGUE_STRIDE);
  });
  return { parts, rest, seeds, furthest, tongues };
}

/** Floats per fire in the instance buffer: base + width, height + smoke + nearer + hollow, seed + strength + heat + width (for the fragment shader). */
const STRIDE = 12;

export function createFlames(app: pc.AppBase, capacity = 64) {
  const device = app.graphicsDevice;
  const flames: Flame[] = [];
  let time = 0;
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  const format = new pc.VertexFormat(device, [pc.SEMANTIC_ATTR10, pc.SEMANTIC_ATTR11, pc.SEMANTIC_ATTR12].map(semantic => ({ semantic, components: 4, type: pc.TYPE_FLOAT32 })));
  const buffer = new pc.VertexBuffer(device, format, capacity, { usage: pc.BUFFER_DYNAMIC });
  const instances = new Float32Array(buffer.lock() as ArrayBuffer);
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-flames',
    attributes: { vertex_position: pc.SEMANTIC_POSITION, aBase: pc.SEMANTIC_ATTR10, aSize: pc.SEMANTIC_ATTR11, aLook: pc.SEMANTIC_ATTR12 },
    vertexWGSL: VERTEX_WGSL, fragmentWGSL: FRAGMENT_WGSL,
  });
  material.name = 'Llamas';
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  const light = new Float32Array([1, 1, 1]);
  material.setParameter('uLight', light);
  material.setParameter('uTime', 0);
  const instance = new pc.MeshInstance(quad, material);
  instance.setInstancing(buffer);
  instance.instancingCount = 0;
  instance.cull = false;
  // After the marks on the floor and before the particles, so sparks fly over the flames.
  instance.calculateSortDistance = () => 1e6;
  const entity = new pc.Entity('Llamas');
  entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
  app.root.addChild(entity);

  // What burns on someone: every part drawn again with the burn shader, on its own node so it moves with it.
  const shellMaterial = new pc.ShaderMaterial({
    uniqueName: 'gerard-flame-shell',
    attributes: { vertex_position: pc.SEMANTIC_POSITION, vertex_normal: pc.SEMANTIC_NORMAL },
    vertexWGSL: SHELL_VERTEX_WGSL, fragmentWGSL: SHELL_FRAGMENT_WGSL,
  });
  shellMaterial.name = 'Llamas sobre el cuerpo';
  shellMaterial.blendType = pc.BLEND_PREMULTIPLIED;
  shellMaterial.depthWrite = false;
  // A hair off the surface, pushed towards the camera, so it never fights the body for the same depth.
  shellMaterial.depthBias = -1;
  shellMaterial.slopeDepthBias = -1;
  shellMaterial.setParameter('uTime', 0);
  shellMaterial.setParameter('uInflate', .006);
  shellMaterial.update();
  const world = () => app.scene.layers.getLayerById(pc.LAYERID_WORLD);

  // Every tongue of flame on anyone is one instance of one draw; each finds its part in a texture.
  const tongueMesh = new pc.Mesh(device);
  {
    const sides = 7, rings = 7, positions: number[] = [], indices: number[] = [];
    for (let r = 0; r <= rings; r++) for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      positions.push(Math.cos(angle), r / rings, Math.sin(angle));
    }
    for (let r = 0; r < rings; r++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides, a = r * sides + side, b = (r + 1) * sides + side, c = r * sides + next, d = (r + 1) * sides + next;
      indices.push(a, b, c, c, b, d);
    }
    tongueMesh.setPositions(new Float32Array(positions));
    tongueMesh.setIndices(indices);
    tongueMesh.update();
  }
  const tongueFormat = new pc.VertexFormat(device, [pc.SEMANTIC_ATTR10, pc.SEMANTIC_ATTR11, pc.SEMANTIC_ATTR12].map(semantic => ({ semantic, components: 4, type: pc.TYPE_FLOAT32 })));
  const tongueBuffer = new pc.VertexBuffer(device, tongueFormat, MAX_TONGUES, { usage: pc.BUFFER_DYNAMIC });
  const partTexture = new pc.Texture(device, {
    name: 'Partes que arden', width: 4, height: MAX_BURNING_PARTS, format: pc.PIXELFORMAT_RGBA32F, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const tongueMaterial = new pc.ShaderMaterial({
    uniqueName: 'gerard-flame-tongues',
    attributes: { vertex_position: pc.SEMANTIC_POSITION, aRoot: pc.SEMANTIC_ATTR10, aFacing: pc.SEMANTIC_ATTR11, aLook: pc.SEMANTIC_ATTR12 },
    vertexWGSL: TONGUE_VERTEX_WGSL, fragmentWGSL: TONGUE_FRAGMENT_WGSL,
  });
  tongueMaterial.name = 'Llamas: lenguas';
  tongueMaterial.blendType = pc.BLEND_PREMULTIPLIED;
  tongueMaterial.depthWrite = false;
  tongueMaterial.setParameter('uTime', 0);
  tongueMaterial.setParameter('uParts', partTexture);
  tongueMaterial.update();
  const tongueInstance = new pc.MeshInstance(tongueMesh, tongueMaterial);
  tongueInstance.setInstancing(tongueBuffer);
  tongueInstance.instancingCount = 0;
  tongueInstance.cull = false;
  // Over the char on their surface and before the particles, so sparks fly over the flames.
  tongueInstance.calculateSortDistance = () => 1e6;
  const tongueEntity = new pc.Entity('Lenguas de fuego');
  tongueEntity.addComponent('render', { meshInstances: [tongueInstance], castShadows: false, receiveShadows: false });
  tongueEntity.enabled = false;
  app.root.addChild(tongueEntity);

  /** Everyone on fire: where their parts sit in the texture, from `layOut`. */
  const shells: { shell: Shell; own: pc.MeshInstance[]; surface: Surface; burn: Float32Array; first: number; count: number }[] = [];
  /** Lays everyone's tongues and parts out again, when someone catches fire or goes out. */
  function layOut() {
    const out = new Float32Array(tongueBuffer.lock() as ArrayBuffer);
    let row = 0, tongues = 0;
    for (const record of shells) {
      const { surface } = record, parts = Math.min(surface.parts.length, MAX_BURNING_PARTS - row);
      record.first = row; record.count = parts;
      const stride = TONGUE_STRIDE, all = surface.tongues.length / stride;
      for (let i = 0; i < all && tongues < MAX_TONGUES; i++) {
        const part = surface.tongues[i * stride + 3];
        if (part >= parts) continue;
        out.set(surface.tongues.subarray(i * stride, (i + 1) * stride), tongues * stride);
        out[tongues * stride + 3] = row + part;
        tongues++;
      }
      row += parts;
    }
    tongueBuffer.unlock();
    tongueInstance.instancingCount = tongues;
    tongueEntity.enabled = tongues > 0;
  }
  function writeShells() {
    if (!shells.length) return;
    const data = partTexture.lock() as Float32Array;
    for (const { shell, own, surface, burn, first, count } of shells) {
      burn[0] = shell.spread; burn[1] = shell.heat; burn[2] = Math.max(0, Math.min(1.3, shell.strength)); burn[3] = surface.furthest;
      own.forEach((m, i) => {
        const source = surface.parts[i], showing = source.visible && (source.node as pc.Entity).enabled && shell.strength > .01;
        m.visible = showing;
        m.setParameter('uBurn', burn);
        if (i >= count) return;
        const w = source.node.getWorldTransform().data, o = (first + i) * 16;
        data[o] = w[0]; data[o + 1] = w[4]; data[o + 2] = w[8]; data[o + 3] = w[12];
        data[o + 4] = w[1]; data[o + 5] = w[5]; data[o + 6] = w[9]; data[o + 7] = w[13];
        data[o + 8] = w[2]; data[o + 9] = w[6]; data[o + 10] = w[10]; data[o + 11] = w[14];
        data[o + 12] = showing ? shell.strength : 0; data[o + 13] = shell.reach; data[o + 14] = shell.spread; data[o + 15] = shell.heat;
      });
    }
    partTexture.unlock();
  }

  function write() {
    const n = Math.min(flames.length, capacity);
    for (let i = 0; i < n; i++) {
      const f = flames[i], o = i * STRIDE;
      instances[o] = f.at.x; instances[o + 1] = f.at.y; instances[o + 2] = f.at.z; instances[o + 3] = f.width;
      instances[o + 4] = f.height; instances[o + 5] = f.smoke; instances[o + 6] = f.nearer; instances[o + 7] = f.hollow;
      instances[o + 8] = f.seed; instances[o + 9] = Math.max(0, Math.min(1, f.strength)); instances[o + 10] = f.heat; instances[o + 11] = f.width;
    }
    if (n) buffer.unlock(0, n * STRIDE * 4);
    instance.instancingCount = n;
    entity.enabled = n > 0;
  }

  return {
    get count() { return flames.length; },
    /** Tongues of flame growing out of whoever burns now. */
    get tongues() { return tongueInstance.instancingCount; },
    /** Every fire drawn now, for tests and debugging. */
    list(): readonly Flame[] { return [...flames]; },
    /** A new fire at `at` (copied; move it through the returned `at`). */
    add(at: { x: number; y: number; z: number }, options: Partial<Omit<Flame, 'at' | 'seed' | 'remove'>> = {}): Flame {
      const flame: Flame = {
        at: new pc.Vec3(at.x, at.y, at.z), width: .3, height: 1, smoke: 0, strength: 1, heat: 0, nearer: 0, hollow: 0, ...options,
        seed: Math.random(),
        remove() { const i = flames.indexOf(flame); if (i >= 0) flames.splice(i, 1); },
      };
      flames.push(flame);
      return flame;
    },
    /**
     * Sets someone's own body burning, whatever it is made of: it catches at a few points of their
     * surface and spreads over their parts as `spread` grows, and tongues of flame grow out of their
     * triangles, moving with them. Set its `strength`, `heat`, `spread` and `reach` as it burns, and
     * `remove()` it when it is out.
     */
    wrap(model: pc.Entity): Shell {
      const surface = surfaceOf(model), { parts } = surface;
      const own = parts.map((m, i) => {
        const part = new pc.MeshInstance(m.mesh!, shellMaterial, m.node);
        part.castShadow = false;
        // Under the tongues: they draw over the char, not the other way round.
        part.calculateSortDistance = () => 2e6;
        part.setParameter('uRest', surface.rest[i]);
        return part;
      });
      const seed = Math.random();
      own.forEach(m => { m.setParameter('uSeed', seed); m.setParameter('uSeeds', surface.seeds); });
      world()?.addMeshInstances(own);
      const record = {
        shell: {
          strength: 0, heat: 0, spread: 0, reach: .3, parts,
          remove() { const i = shells.indexOf(record); if (i >= 0) { shells.splice(i, 1); layOut(); } world()?.removeMeshInstances(own); },
        } as Shell,
        own, surface, burn: new Float32Array(4), first: 0, count: 0,
      };
      shells.push(record);
      layOut();
      return record.shell;
    },
    /** How much scene light the smoke takes (linear RGB), like covering particles. */
    setLight(r: number, g: number, b: number) { light[0] = r; light[1] = g; light[2] = b; material.setParameter('uLight', light); },
    update(dt: number) {
      time += dt;
      // Wrapped so the noise never loses precision; a jump once every ten minutes goes unseen.
      material.setParameter('uTime', time % 600);
      shellMaterial.setParameter('uTime', time % 600);
      tongueMaterial.setParameter('uTime', time % 600);
      write();
      writeShells();
    },
    clear() { flames.length = 0; write(); [...shells].forEach(s => s.shell.remove()); },
    destroy() { [...shells].forEach(s => s.shell.remove()); entity.destroy(); buffer.destroy(); quad.destroy(); material.destroy(); shellMaterial.destroy(); tongueEntity.destroy(); tongueBuffer.destroy(); tongueMesh.destroy(); tongueMaterial.destroy(); partTexture.destroy(); flames.length = 0; },
  };
}
export type FlameSystem = ReturnType<typeof createFlames>;
