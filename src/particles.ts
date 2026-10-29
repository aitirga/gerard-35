import * as pc from 'playcanvas';

/**
 * Particles: one pool simulated on the CPU in flat arrays and drawn as a single instanced batch,
 * whatever their kind. Each particle rides a swirling flow field, wanders on its own random walk,
 * drifts with the wind, is pulled by attractors, bounces, slides or sticks on the floors and walls
 * of the scene and flows around the people in it. Kinds are data (`ParticleKind`); what the game
 * makes of them lives in src/effects.ts (docs/graphics.md).
 */

/** What the shader draws on each quad. */
export type ParticleShape = 'glow' | 'puff' | 'spark' | 'ring' | 'star' | 'smoke' | 'bubble' | 'confetti' | 'splat' | 'flake' | 'zap' | 'flame';
const SHAPES: Record<ParticleShape, number> = { glow: 0, puff: 1, spark: 2, ring: 3, star: 4, smoke: 5, bubble: 6, confetti: 7, splat: 8, flake: 9, zap: 10, flame: 11 };
/** `face` turns to the camera, `velocity` stretches along the motion, `ground` lies flat. */
export type ParticleOrient = 'face' | 'velocity' | 'ground';
const ORIENTS: Record<ParticleOrient, number> = { face: 0, velocity: 1, ground: 2 };

type Range = number | readonly [number, number];
export interface Vec { x: number; y: number; z: number }

export interface ParticleKind {
  shape: ParticleShape;
  orient?: ParticleOrient;
  /** Colour at birth and at the end of life (sRGB hex); a burst may bring its own. */
  colour: string | readonly [string, string];
  /** 0 covers what is behind it (dust, gum), 1 adds light (sparks, motes). */
  additive?: number;
  /** 0 takes the scene's light like a surface, 1 shines on its own. */
  glow?: number;
  /** How many times brighter than its colour it shines; past white it blooms (src/post.ts). */
  intensity?: number;
  opacity?: number;
  /** Seconds. */
  life: Range;
  /** Half the width of the quad, in metres, and how much wider and taller it is drawn (flames are tall). */
  size: Range; aspect?: readonly [number, number];
  /** Size at the end of life relative to birth (2 doubles, 0 shrinks away). */
  sizeEnd?: number;
  /** Fractions of life spent growing in, fading in and fading out. */
  growIn?: number; fadeIn?: number; fadeOut?: number;
  /** Launch speed (m/s) away from the burst, and an extra upward kick. */
  speed?: Range; rise?: Range;
  /** m/s² down (negative floats up), and how fast the air slows it (1/s). */
  gravity?: number; drag?: number;
  /** Random walk: how far each particle wanders (m/s) and how often it changes its mind (1/s). */
  wander?: number; wanderRate?: number;
  /** How strongly the swirling flow field carries it (m/s). */
  flow?: number;
  /** How readily it takes the wind's speed (1/s). */
  wind?: number;
  /** Meets floors and walls. Bounce keeps that much of its speed; friction is what sliding loses. */
  collide?: boolean; bounce?: number; friction?: number;
  /** Stays where it lands, lying flat (gum, ink), or bursts into its `onLand` there (`pop`). */
  stick?: boolean; pop?: boolean;
  /** How much people moving through push it aside (0 ignores them). */
  bodies?: number;
  /** Streak length per m/s, for `velocity` particles. */
  stretch?: number;
  /** Degrees per second. */
  spin?: Range;
  /** 0 steady, 1 twinkles fully; how many times a second. */
  flicker?: number; flickerRate?: number;
  /** Confetti tumbles: turns a second around its long side. */
  tumble?: number;
  /** Particles left behind when it lands for the first time, or when it dies. */
  onLand?: SubBurst; onDeath?: SubBurst;
  /**
   * Soft particles: how deep (m, up to .9) it fades out in front of what it cuts into (floors,
   * walls, people), so a puff never shows a hard straight line. Never more than its own size;
   * 0 keeps the cut. Defaults to .3, or 0 for pure light (`additive` 1) and `ground` particles.
   */
  soft?: number;
}
export interface SubBurst { kind: string; count: number; /** Takes the parent's colour. */ inherit?: boolean }

export interface SpawnOptions {
  /** Radius around the point where particles appear. */
  spread?: number;
  /** Spread over a horizontal disc instead of a ball; `ring` puts them on its edge. */
  flat?: boolean; ring?: boolean;
  /** Aim (any length) and how wide the fan around it is (radians). Without it, outward. */
  direction?: Vec; cone?: number;
  /** Added to every particle, e.g. what the source was doing. */
  velocity?: Vec;
  /** Multipliers on the kind's own values. */
  speed?: number; size?: number; life?: number;
  colour?: string | readonly [string, string];
  /** Custom placement (e.g. along a curve): write particle `i` of `n`'s offset from the point. */
  place?: (i: number, n: number, out: pc.Vec3) => void;
}
export interface EmitterOptions extends SpawnOptions {
  /** Particles a second. */
  rate: number;
  /** Spawn anywhere this far around the point (x, z) and this high above the floor there. */
  area?: { x: number; z: number; low: number; high: number };
  /** Ambient particles survive `clear()`. */
  ambient?: boolean;
}
export interface AttractorOptions {
  at: Vec;
  /** m/s² towards the point (negative pushes away), a swirl around it and a lift upward. */
  pull?: number; swirl?: number; lift?: number;
  radius?: number;
  /** Seconds before it lets go (Infinity until removed). */
  life?: number;
}
export interface ParticleBody { x: number; y: number; z: number; radius: number; height: number; /** Same object every frame, to measure how fast it moves. */ key?: object }
/** The scene as particles feel it: floors sampled over a rectangle, and solid cells. */
export interface ParticleWorld {
  x0: number; z0: number; x1: number; z1: number;
  /** Floor height outside the rectangle. */
  outside: number;
  ground(x: number, z: number): number;
  /** Cell (0, 0)'s centre, the grid's size (1 m cells) and how tall each cell's solid stands. */
  cells?: { x: number; z: number; cols: number; rows: number; top: Float32Array };
}
export interface ParticleEmitter {
  readonly at: pc.Vec3;
  /** The volume it fills, when it has one; change it as the view moves. */
  readonly area?: { x: number; z: number; low: number; high: number };
  rate: number;
  enabled: boolean;
  /** Fill the area as if it had been running a while. */
  warm(): void;
  remove(): void;
}
export interface ParticleAttractor { readonly at: pc.Vec3; pull: number; swirl: number; lift: number; radius: number; remove(): void }

interface Compiled {
  shape: number; orient: number; additive: number; glow: number; intensity: number; opacity: number;
  life: [number, number]; size: [number, number]; aspect: [number, number]; sizeEnd: number; growIn: number; fadeIn: number; fadeOut: number;
  speed: [number, number]; rise: [number, number]; gravity: number; drag: number;
  wander: number; wanderRate: number; flow: number; wind: number;
  collide: boolean; bounce: number; friction: number; stick: boolean; pop: boolean; bodies: number;
  stretch: number; spin: [number, number]; flicker: number; flickerRate: number; tumble: number;
  colour: Float32Array; onLand?: SubBurst; onDeath?: SubBurst; soft: number;
}

const range = (r: Range | undefined, fallback: number): [number, number] => r === undefined ? [fallback, fallback] : typeof r === 'number' ? [r, r] : [r[0], r[1]];
const pick = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
/** Linear colour from sRGB hex, the way materials take it. */
const colourCache = new Map<string, [number, number, number]>();
function linear(hex: string) {
  let c = colourCache.get(hex);
  if (!c) { const s = new pc.Color().fromString(hex); c = [s.r ** 2.2, s.g ** 2.2, s.b ** 2.2]; colourCache.set(hex, c); }
  return c;
}
function colourPair(colour: string | readonly [string, string], out: Float32Array) {
  const [a, b] = typeof colour === 'string' ? [colour, colour] : colour;
  out.set(linear(a), 0); out.set(linear(b), 3);
  return out;
}

/** A tiling field of swirls (the curl of smooth noise), so particles follow eddies and never clump. */
const FIELD = 16;
function flowField() {
  let seed = 0x9e3779b9;
  const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Whole-number wave vectors keep each wave periodic over the field.
  const waves = Array.from({ length: 12 }, (_, i) => {
    let k: number[];
    do k = [0, 1, 2].map(() => Math.round(random() * 6 - 3)); while (k.every(v => v === 0));
    return { c: i % 3, k, phase: random() * Math.PI * 2, amp: 1 / Math.hypot(...k) };
  });
  const field = new Float32Array(FIELD ** 3 * 3);
  let sum = 0;
  for (let z = 0; z < FIELD; z++) for (let y = 0; y < FIELD; y++) for (let x = 0; x < FIELD; x++) {
    // d[c][j]: how potential component c changes along axis j.
    const d = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const w of waves) {
      const s = Math.PI * 2 / FIELD, cos = Math.cos(s * (w.k[0] * x + w.k[1] * y + w.k[2] * z) + w.phase) * w.amp * s;
      for (let j = 0; j < 3; j++) d[w.c][j] += w.k[j] * cos;
    }
    const i = ((z * FIELD + y) * FIELD + x) * 3;
    field[i] = d[2][1] - d[1][2]; field[i + 1] = d[0][2] - d[2][0]; field[i + 2] = d[1][0] - d[0][1];
    sum += field[i] ** 2 + field[i + 1] ** 2 + field[i + 2] ** 2;
  }
  const scale = 1 / Math.sqrt(sum / (FIELD ** 3));
  for (let i = 0; i < field.length; i++) field[i] *= scale;
  return field;
}

/** The particle shader for WebGL2; `VERTEX_WGSL` and `FRAGMENT_WGSL` below are the same for WebGPU. */
const VERTEX = /* glsl */ `
attribute vec3 vertex_position;
attribute vec4 aPosSize;
attribute vec4 aColour;
attribute vec4 aMotion;
attribute vec4 aLook;
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_view;
varying vec2 vUv;
varying vec4 vColour;
varying vec4 vLook;
varying vec2 vDepth;
void main(void) {
  vec2 corner = vertex_position.xy;
  vec3 right = vec3(matrix_view[0][0], matrix_view[1][0], matrix_view[2][0]);
  vec3 up = vec3(matrix_view[0][1], matrix_view[1][1], matrix_view[2][1]);
  float size = aPosSize.w;
  float c = cos(aMotion.w), s = sin(aMotion.w);
  vec3 world;
  // aLook.y: the whole part is the orientation, the fraction the softness in metres.
  float orient = floor(aLook.y);
  if (orient > 1.5) {
    vec2 r = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
    world = aPosSize.xyz + vec3(r.x, 0.0, r.y);
  } else if (orient > 0.5) {
    // A streak: the head at the particle, the tail trailing back along its motion on screen.
    vec2 onScreen = vec2(dot(aMotion.xyz, right), dot(aMotion.xyz, up));
    float tail = length(onScreen);
    vec2 dir = tail > 0.0001 ? onScreen / tail : vec2(0.0, 1.0);
    vec3 along = right * dir.x + up * dir.y;
    vec3 across = up * dir.x - right * dir.y;
    float halfLength = size + tail * 0.5;
    world = aPosSize.xyz - along * (tail * 0.5) + along * (corner.x * halfLength) + across * (corner.y * size);
  } else {
    vec2 q = corner * aMotion.xy;
    vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * size;
    world = aPosSize.xyz + right * r.x + up * r.y;
  }
  vUv = corner;
  vColour = aColour;
  vLook = aLook;
  vDepth = vec2(-(matrix_view * vec4(world, 1.0)).z, aLook.y - orient);
  gl_Position = matrix_viewProjection * vec4(world, 1.0);
}`;

const FRAGMENT = /* glsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
// Soft particles need the post pass's depth prepass; rendering into the scene depth itself rules it out.
#if defined(SCENE_DEPTHMAP_LINEAR) && !defined(SCENE_TEXTURE_DEPTH)
  #define SOFT_PARTICLES
  #include "screenDepthPS"
  uniform float uSoft;
#endif
uniform vec3 uLight;
varying vec2 vUv;
varying vec4 vColour;
varying vec4 vLook;
varying vec2 vDepth;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wave(float x) { float i = floor(x), f = fract(x); return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), f * f * (3.0 - 2.0 * f)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Round shading for puffs, lit from the upper left like the low-poly scene.
float shade(vec2 uv) {
  vec3 n = vec3(uv, sqrt(max(0.0, 1.0 - dot(uv, uv))));
  return 0.62 + 0.48 * max(0.0, dot(n, vec3(-0.36, 0.6, 0.71)));
}
void main(void) {
  float shape = floor(vLook.x);
  float seed = fract(vLook.x);
  vec2 uv = vUv;
  float r = length(uv);
  float a = 0.0, white = 0.0, lit = 1.0;
  if (shape < 0.5) {
    float core = exp(-r * r * 26.0);
    a = (exp(-r * r * 4.5) * 0.7 + core) * clamp(1.0 - r * r, 0.0, 1.0);
    white = core * 0.5;
  } else if (shape < 1.5) {
    a = smoothstep(1.0, 0.84, r);
    lit = shade(uv * 0.95);
  } else if (shape < 2.5) {
    float across = 1.0 - uv.y * uv.y;
    a = across * across * across * smoothstep(-1.0, -0.3, uv.x) * smoothstep(1.0, 0.65, uv.x);
    white = pow(max(0.0, 1.0 - abs(uv.y)), 6.0) * smoothstep(-0.5, 0.6, uv.x) * 0.8;
  } else if (shape < 3.5) {
    float d = (r - 0.8) / 0.11;
    a = (exp(-d * d) + exp(-r * r * 3.0) * 0.08) * smoothstep(1.0, 0.93, r);
  } else if (shape < 4.5) {
    vec2 q = abs(uv);
    float rays = max(exp(-q.x * 13.0 - q.y * q.y * 2.6), exp(-q.y * 13.0 - q.x * q.x * 2.6));
    float core = exp(-r * r * 16.0);
    a = (rays + core) * clamp(1.0 - r * r, 0.0, 1.0);
    white = core * 0.6;
  } else if (shape < 5.5) {
    float n = noise(uv * 2.3 + seed * 37.0) * 0.6 + noise(uv * 5.1 - seed * 11.0) * 0.4;
    a = smoothstep(1.0, 0.3, r + (n - 0.5) * 0.7) * 0.8;
    lit = shade(uv * 0.9) * (0.88 + n * 0.25);
  } else if (shape < 6.5) {
    vec2 g = uv - vec2(-0.34, 0.38);
    float rim = smoothstep(0.68, 0.95, r) * smoothstep(1.0, 0.95, r);
    float glint = exp(-dot(g, g) * 40.0);
    a = rim * 0.85 + 0.1 * smoothstep(1.0, 0.9, r) + glint;
    white = glint;
  } else if (shape < 7.5) {
    vec2 q = abs(uv);
    a = smoothstep(1.0, 0.86, q.x) * smoothstep(1.0, 0.86, q.y);
    lit = 0.82 + 0.25 * uv.y;
  } else if (shape < 8.5) {
    float angle = atan(uv.y, uv.x);
    float edge = 0.74 + 0.15 * sin(angle * 5.0 + seed * 31.0) + 0.07 * sin(angle * 9.0 - seed * 17.0);
    a = smoothstep(edge, edge - 0.08, r);
    vec2 g = uv - vec2(-0.22, 0.26);
    lit = 0.88 + 0.3 * exp(-dot(g, g) * 9.0);
  } else if (shape < 9.5) {
    // A six-armed snowflake: fold every arm onto one, then draw the arm and its two side twigs.
    float sector = 1.0471976;
    float angle = mod(atan(uv.y, uv.x) + sector * 0.5, sector) - sector * 0.5;
    vec2 q = vec2(cos(angle), abs(sin(angle))) * r;
    float arm = smoothstep(0.085, 0.03, q.y) * smoothstep(1.0, 0.86, r);
    float twig = smoothstep(0.07, 0.02, abs(q.y - (q.x - 0.45) * 0.9)) * step(0.45, q.x) * step(q.x, 0.78);
    a = max(arm, twig) + exp(-r * r * 30.0) * 0.6;
    white = exp(-r * r * 20.0) * 0.5;
  } else if (shape < 10.5) {
    // Lightning: a jagged path along the streak, a hot core and a soft halo.
    float path = (wave(uv.x * 3.0 + seed * 40.0) - 0.5) * 0.9 + (wave(uv.x * 9.0 - seed * 23.0) - 0.5) * 0.35;
    float d = abs(uv.y - path);
    a = (exp(-d * d * 140.0) + exp(-d * d * 10.0) * 0.3) * smoothstep(1.0, 0.75, abs(uv.x));
    white = exp(-d * d * 500.0);
  } else {
    // A flame: round at the root, licking up to a point, with a hot core.
    float t = uv.y * 0.5 + 0.5;
    float x = uv.x + (wave(t * 3.0 + seed * 19.0) - 0.5) * 0.35 * t;
    float w = 0.72 * pow(1.0 - t, 0.8) * sqrt(clamp(t * 3.0, 0.0, 1.0));
    a = smoothstep(w, w - 0.18, abs(x));
    white = smoothstep(0.6, 0.0, abs(x) / max(w, 0.01)) * (1.0 - t) * 0.4;
  }
  a *= vColour.a;
  #ifdef SOFT_PARTICLES
    // Fade over the last metres in front of the scene behind it (both linear view depth, metres).
    float soft = vDepth.y * uSoft;
    if (soft > 0.0) a *= clamp((getLinearScreenDepth() - vDepth.x) / soft, 0.0, 1.0);
  #endif
  if (a < 0.004) discard;
  float additive = vLook.z;
  float peak = max(1.0, max(vColour.r, max(vColour.g, vColour.b)));
  vec3 colour = mix(vColour.rgb, vec3(peak), clamp(white, 0.0, 1.0)) * lit * mix(uLight, vec3(1.0), vLook.w);
  #if (FOG != NONE)
    float fogged = getFogFactor();
    colour = mix(mix(fog_color, colour, fogged), colour * fogged, additive);
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  // Premultiplied: covering particles hide what is behind, additive ones (alpha 0) only add.
  gl_FragColor = vec4(colour * a, a * (1.0 - additive));
}`;

/**
 * The same shader in WGSL for WebGPU, line for line with the GLSL above (keep both in step).
 * The engine copies attributes and varyings into globals of the same name; uniforms are read
 * through `uniform.`, the position goes to `output.position` and the colour to `output.color`.
 */
const VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aPosSize: vec4f;
attribute aColour: vec4f;
attribute aMotion: vec4f;
attribute aLook: vec4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
varying vUv: vec2f;
varying vColour: vec4f;
varying vLook: vec4f;
varying vDepth: vec2f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let corner = vertex_position.xy;
  let view = uniform.matrix_view;
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  let up = vec3f(view[0][1], view[1][1], view[2][1]);
  let size = aPosSize.w;
  let c = cos(aMotion.w); let s = sin(aMotion.w);
  var world: vec3f;
  // aLook.y: the whole part is the orientation, the fraction the softness in metres.
  let orient = floor(aLook.y);
  if (orient > 1.5) {
    let r = vec2f(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
    world = aPosSize.xyz + vec3f(r.x, 0.0, r.y);
  } else if (orient > 0.5) {
    // A streak: the head at the particle, the tail trailing back along its motion on screen.
    let onScreen = vec2f(dot(aMotion.xyz, right), dot(aMotion.xyz, up));
    let tail = length(onScreen);
    let dir = select(vec2f(0.0, 1.0), onScreen / tail, tail > 0.0001);
    let along = right * dir.x + up * dir.y;
    let across = up * dir.x - right * dir.y;
    let halfLength = size + tail * 0.5;
    world = aPosSize.xyz - along * (tail * 0.5) + along * (corner.x * halfLength) + across * (corner.y * size);
  } else {
    let q = corner * aMotion.xy;
    let r = vec2f(c * q.x - s * q.y, s * q.x + c * q.y) * size;
    world = aPosSize.xyz + right * r.x + up * r.y;
  }
  output.vUv = corner;
  output.vColour = aColour;
  output.vLook = aLook;
  output.vDepth = vec2f(-(uniform.matrix_view * vec4f(world, 1.0)).z, aLook.y - orient);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
// Soft particles need the post pass's depth prepass; rendering into the scene depth itself rules it out.
#if defined(SCENE_DEPTHMAP_LINEAR) && !defined(SCENE_TEXTURE_DEPTH)
  #define SOFT_PARTICLES
  #include "screenDepthPS"
  uniform uSoft: f32;
#endif
uniform uLight: vec3f;
varying vUv: vec2f;
varying vColour: vec4f;
varying vLook: vec4f;
varying vDepth: vec2f;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn wave(x: f32) -> f32 { let i = floor(x); let f = fract(x); return mix(hash(vec2f(i, 0.0)), hash(vec2f(i + 1.0, 0.0)), f * f * (3.0 - 2.0 * f)); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), f.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), f.x), f.y);
}
// Round shading for puffs, lit from the upper left like the low-poly scene.
fn shade(uv: vec2f) -> f32 {
  let n = vec3f(uv, sqrt(max(0.0, 1.0 - dot(uv, uv))));
  return 0.62 + 0.48 * max(0.0, dot(n, vec3f(-0.36, 0.6, 0.71)));
}
// GLSL's mod: WGSL's % truncates, which flips the result for negative x.
fn floorMod(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let shape = floor(vLook.x);
  let seed = fract(vLook.x);
  let uv = vUv;
  let r = length(uv);
  var a = 0.0; var white = 0.0; var lit = 1.0;
  if (shape < 0.5) {
    let core = exp(-r * r * 26.0);
    a = (exp(-r * r * 4.5) * 0.7 + core) * clamp(1.0 - r * r, 0.0, 1.0);
    white = core * 0.5;
  } else if (shape < 1.5) {
    a = smoothstep(1.0, 0.84, r);
    lit = shade(uv * 0.95);
  } else if (shape < 2.5) {
    let across = 1.0 - uv.y * uv.y;
    a = across * across * across * smoothstep(-1.0, -0.3, uv.x) * smoothstep(1.0, 0.65, uv.x);
    white = pow(max(0.0, 1.0 - abs(uv.y)), 6.0) * smoothstep(-0.5, 0.6, uv.x) * 0.8;
  } else if (shape < 3.5) {
    let d = (r - 0.8) / 0.11;
    a = (exp(-d * d) + exp(-r * r * 3.0) * 0.08) * smoothstep(1.0, 0.93, r);
  } else if (shape < 4.5) {
    let q = abs(uv);
    let rays = max(exp(-q.x * 13.0 - q.y * q.y * 2.6), exp(-q.y * 13.0 - q.x * q.x * 2.6));
    let core = exp(-r * r * 16.0);
    a = (rays + core) * clamp(1.0 - r * r, 0.0, 1.0);
    white = core * 0.6;
  } else if (shape < 5.5) {
    let n = noise(uv * 2.3 + seed * 37.0) * 0.6 + noise(uv * 5.1 - seed * 11.0) * 0.4;
    a = smoothstep(1.0, 0.3, r + (n - 0.5) * 0.7) * 0.8;
    lit = shade(uv * 0.9) * (0.88 + n * 0.25);
  } else if (shape < 6.5) {
    let g = uv - vec2f(-0.34, 0.38);
    let rim = smoothstep(0.68, 0.95, r) * smoothstep(1.0, 0.95, r);
    let glint = exp(-dot(g, g) * 40.0);
    a = rim * 0.85 + 0.1 * smoothstep(1.0, 0.9, r) + glint;
    white = glint;
  } else if (shape < 7.5) {
    let q = abs(uv);
    a = smoothstep(1.0, 0.86, q.x) * smoothstep(1.0, 0.86, q.y);
    lit = 0.82 + 0.25 * uv.y;
  } else if (shape < 8.5) {
    let angle = atan2(uv.y, uv.x);
    let edge = 0.74 + 0.15 * sin(angle * 5.0 + seed * 31.0) + 0.07 * sin(angle * 9.0 - seed * 17.0);
    a = smoothstep(edge, edge - 0.08, r);
    let g = uv - vec2f(-0.22, 0.26);
    lit = 0.88 + 0.3 * exp(-dot(g, g) * 9.0);
  } else if (shape < 9.5) {
    // A six-armed snowflake: fold every arm onto one, then draw the arm and its two side twigs.
    let sector = 1.0471976;
    let angle = floorMod(atan2(uv.y, uv.x) + sector * 0.5, sector) - sector * 0.5;
    let q = vec2f(cos(angle), abs(sin(angle))) * r;
    let arm = smoothstep(0.085, 0.03, q.y) * smoothstep(1.0, 0.86, r);
    let twig = smoothstep(0.07, 0.02, abs(q.y - (q.x - 0.45) * 0.9)) * step(0.45, q.x) * step(q.x, 0.78);
    a = max(arm, twig) + exp(-r * r * 30.0) * 0.6;
    white = exp(-r * r * 20.0) * 0.5;
  } else if (shape < 10.5) {
    // Lightning: a jagged path along the streak, a hot core and a soft halo.
    let path = (wave(uv.x * 3.0 + seed * 40.0) - 0.5) * 0.9 + (wave(uv.x * 9.0 - seed * 23.0) - 0.5) * 0.35;
    let d = abs(uv.y - path);
    a = (exp(-d * d * 140.0) + exp(-d * d * 10.0) * 0.3) * smoothstep(1.0, 0.75, abs(uv.x));
    white = exp(-d * d * 500.0);
  } else {
    // A flame: round at the root, licking up to a point, with a hot core.
    let t = uv.y * 0.5 + 0.5;
    let x = uv.x + (wave(t * 3.0 + seed * 19.0) - 0.5) * 0.35 * t;
    let w = 0.72 * pow(1.0 - t, 0.8) * sqrt(clamp(t * 3.0, 0.0, 1.0));
    a = smoothstep(w, w - 0.18, abs(x));
    white = smoothstep(0.6, 0.0, abs(x) / max(w, 0.01)) * (1.0 - t) * 0.4;
  }
  a *= vColour.a;
  #ifdef SOFT_PARTICLES
    // Fade over the last metres in front of the scene behind it (both linear view depth, metres).
    let soft = vDepth.y * uniform.uSoft;
    if (soft > 0.0) { a *= clamp((getLinearScreenDepthFrag() - vDepth.x) / soft, 0.0, 1.0); }
  #endif
  if (a < 0.004) { discard; }
  let additive = vLook.z;
  let peak = max(1.0, max(vColour.r, max(vColour.g, vColour.b)));
  var colour = mix(vColour.rgb, vec3f(peak), clamp(white, 0.0, 1.0)) * lit * mix(uniform.uLight, vec3f(1.0), vLook.w);
  #if (FOG != NONE)
    let fogged = getFogFactor();
    colour = mix(mix(uniform.fog_color, colour, fogged), colour * fogged, additive);
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  // Premultiplied: covering particles hide what is behind, additive ones (alpha 0) only add.
  output.color = vec4f(colour * a, a * (1.0 - additive));
  return output;
}`;

/** Floats per particle in the instance buffer: position + size, colour, motion, look. */
const STRIDE = 16;
/** The longest step the simulation takes; slow frames are split into several. */
const STEP = 1 / 45;
/** Floor samples per metre. */
const FLOOR_RES = 4;

export function createParticles(app: pc.AppBase, capacity = 6000) {
  const device = app.graphicsDevice;
  const kinds: Compiled[] = [];
  const names = new Map<string, number>();
  // Structure of arrays: each property of every particle in its own typed array.
  const f32 = () => new Float32Array(capacity);
  const px = f32(), py = f32(), pz = f32(), vx = f32(), vy = f32(), vz = f32(), wx = f32(), wy = f32(), wz = f32();
  const age = f32(), life = f32(), size = f32(), rot = f32(), spin = f32(), seed = f32();
  const colour = new Float32Array(capacity * 6);
  const kind = new Uint8Array(capacity), state = new Uint8Array(capacity), ambient = new Uint8Array(capacity);
  const LANDED = 1, STUCK = 2;
  let alive = 0, recycle = 0, time = 0;
  const field = flowField();
  const flow = new Float32Array(3);
  const wind = new pc.Vec3();
  /** Scales the flow field everywhere (the scene's mood: still indoors, gusty outside). */
  let turbulence = 1;

  // Floors and walls, baked so each particle reads them in a couple of array lookups.
  let floors: Float32Array | undefined, floorCols = 0, floorRows = 0, world: ParticleWorld | undefined;
  function groundAt(x: number, z: number) {
    if (!floors || !world) return -Infinity;
    const i = Math.round((x - world.x0) * FLOOR_RES), j = Math.round((z - world.z0) * FLOOR_RES);
    return i < 0 || j < 0 || i >= floorCols || j >= floorRows ? world.outside : floors[j * floorCols + i];
  }
  function solidAt(x: number, z: number) {
    const cells = world?.cells;
    if (!cells) return -Infinity;
    const i = Math.round(x - cells.x), j = Math.round(z - cells.z);
    return i < 0 || j < 0 || i >= cells.cols || j >= cells.rows ? -Infinity : cells.top[j * cells.cols + i];
  }

  // Bodies: vertical capsules (people, dogs) as x, y, z, radius, height, vx, vz.
  const BODY = 7, bodyData = new Float32Array(16 * BODY);
  let bodyCount = 0;
  const lastSeen = new WeakMap<object, { x: number; z: number; t: number }>();

  const emitters: Emitter[] = [];
  const attractors: Attractor[] = [];
  const pending: number[] = [];

  function sampleFlow(x: number, y: number, z: number) {
    // About one eddy every three metres, drifting slowly so the paths keep changing.
    const fx = x * .34 + time * .05, fy = y * .34 - time * .08, fz = z * .34 + time * .03;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
    const tx = fx - x0, ty = fy - y0, tz = fz - z0;
    flow[0] = flow[1] = flow[2] = 0;
    for (let c = 0; c < 8; c++) {
      const ox = c & 1, oy = (c >> 1) & 1, oz = c >> 2;
      const w = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty) * (oz ? tz : 1 - tz);
      const i = (((((z0 + oz) & 15) * FIELD) + ((y0 + oy) & 15)) * FIELD + ((x0 + ox) & 15)) * 3;
      flow[0] += field[i] * w; flow[1] += field[i + 1] * w; flow[2] += field[i + 2] * w;
    }
  }

  function kindId(name: string) {
    const id = names.get(name);
    if (id === undefined) throw new Error(`Unknown particle kind: ${name}`);
    return id;
  }
  function spawn(id: number, x: number, y: number, z: number, svx: number, svy: number, svz: number, colours: Float32Array, sizeMul: number, lifeMul: number, isAmbient: boolean, ageAt = 0) {
    const k = kinds[id];
    let i: number;
    if (alive < capacity) i = alive++;
    // Full: the newest takes a place round-robin, so a big burst never stalls the rest.
    else { recycle = (recycle + 1) % capacity; i = recycle; }
    px[i] = x; py[i] = y; pz[i] = z; vx[i] = svx; vy[i] = svy; vz[i] = svz;
    const g = k.wander;
    wx[i] = g * (Math.random() * 2 - 1); wy[i] = g * (Math.random() * 2 - 1); wz[i] = g * (Math.random() * 2 - 1);
    life[i] = Math.max(.05, pick(k.life) * lifeMul); age[i] = ageAt * life[i];
    size[i] = pick(k.size) * sizeMul; seed[i] = Math.random();
    rot[i] = Math.random() * Math.PI * 2; spin[i] = pick(k.spin) * Math.PI / 180 * (Math.random() < .5 ? -1 : 1);
    // A touch of variety in each particle's tone, so a burst never looks flat.
    const tone = (.88 + Math.random() * .24) * k.intensity;
    for (let c = 0; c < 6; c++) colour[i * 6 + c] = colours[c] * tone;
    kind[i] = id; state[i] = 0; ambient[i] = isAmbient ? 1 : 0;
    return i;
  }
  function kill(i: number) {
    const last = --alive;
    if (i === last) return;
    px[i] = px[last]; py[i] = py[last]; pz[i] = pz[last]; vx[i] = vx[last]; vy[i] = vy[last]; vz[i] = vz[last];
    wx[i] = wx[last]; wy[i] = wy[last]; wz[i] = wz[last];
    age[i] = age[last]; life[i] = life[last]; size[i] = size[last]; rot[i] = rot[last]; spin[i] = spin[last]; seed[i] = seed[last];
    colour.copyWithin(i * 6, last * 6, last * 6 + 6);
    kind[i] = kind[last]; state[i] = state[last]; ambient[i] = ambient[last];
  }
  /** Sub-bursts wait until the step is over, so the arrays never shift under the loop. */
  function queue(sub: SubBurst, i: number) {
    const t = Math.min(1, age[i] / life[i]), o = i * 6;
    pending.push(kindId(sub.kind), sub.count, px[i], py[i], pz[i], vx[i] * .3, Math.max(0, vy[i]) * .3, vz[i] * .3, sub.inherit ? 1 : 0,
      colour[o] + (colour[o + 3] - colour[o]) * t, colour[o + 1] + (colour[o + 4] - colour[o + 1]) * t, colour[o + 2] + (colour[o + 5] - colour[o + 2]) * t, ambient[i]);
  }
  const subColour = new Float32Array(6);
  function flushPending() {
    for (let p = 0; p < pending.length; p += 13) {
      const id = pending[p], k = kinds[id];
      if (pending[p + 8]) for (let c = 0; c < 6; c++) subColour[c] = pending[p + 9 + (c % 3)];
      const own = pending[p + 8] ? subColour : k.colour;
      for (let n = 0; n < pending[p + 1]; n++) {
        const a = Math.random() * Math.PI * 2, s = pick(k.speed);
        spawn(id, pending[p + 2], pending[p + 3] + .02, pending[p + 4], pending[p + 5] + Math.cos(a) * s, pending[p + 6] + pick(k.rise), pending[p + 7] + Math.sin(a) * s, own, 1, 1, pending[p + 12] === 1);
      }
    }
    pending.length = 0;
  }

  function step(h: number) {
    const windX = wind.x, windY = wind.y, windZ = wind.z;
    for (let i = 0; i < alive; i++) {
      const k = kinds[kind[i]];
      age[i] += h;
      if (age[i] >= life[i]) {
        if (k.onDeath) queue(k.onDeath, i);
        kill(i); i--; continue;
      }
      rot[i] += spin[i] * h;
      if (state[i] & STUCK) continue;
      let x = px[i], y = py[i], z = pz[i], ux = vx[i], uy = vy[i], uz = vz[i];
      const ox = x, oy = y, oz = z;
      uy -= k.gravity * h;
      if (k.drag) { const f = Math.exp(-k.drag * h); ux *= f; uy *= f; uz *= f; }
      if (k.wind) { const f = Math.min(1, k.wind * h); ux += (windX - ux) * f; uz += (windZ - uz) * f; uy += windY * f; }
      for (const a of attractors) {
        const dx = a.at.x - x, dy = a.at.y - y, dz = a.at.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= a.radius || d < 1e-4) continue;
        const fall = 1 - d / a.radius, flat = Math.hypot(dx, dz) || 1;
        ux += (dx / d * a.pull - dz / flat * a.swirl) * fall * h;
        uy += (dy / d * a.pull + a.lift) * fall * h;
        uz += (dz / d * a.pull + dx / flat * a.swirl) * fall * h;
      }
      // The random walk: each particle's own drift, pulled back towards still and kicked anew.
      let mx = 0, my = 0, mz = 0;
      if (k.wander) {
        const theta = k.wanderRate * h, kick = k.wander * Math.sqrt(2 * theta) * 2;
        wx[i] += -wx[i] * theta + kick * (Math.random() + Math.random() + Math.random() - 1.5);
        wy[i] += -wy[i] * theta + kick * (Math.random() + Math.random() + Math.random() - 1.5);
        wz[i] += -wz[i] * theta + kick * (Math.random() + Math.random() + Math.random() - 1.5);
        mx = wx[i]; my = wy[i]; mz = wz[i];
      }
      if (k.flow && turbulence) {
        sampleFlow(x, y, z);
        const s = k.flow * turbulence;
        mx += flow[0] * s; my += flow[1] * s; mz += flow[2] * s;
      }
      if (k.bodies) for (let b = 0; b < bodyCount; b++) {
        const o = b * BODY, bx = bodyData[o], by = bodyData[o + 1], bz = bodyData[o + 2], radius = bodyData[o + 3];
        if (y < by - .1 || y > by + bodyData[o + 4] + .25) continue;
        const dx = x - bx, dz = z - bz, d2 = dx * dx + dz * dz, reach = radius * 2.4;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d;
        if (d < radius) {
          x = bx + nx * radius; z = bz + nz * radius;
          const inward = ux * nx + uz * nz;
          if (inward < 0) { ux -= inward * nx * 1.3; uz -= inward * nz * 1.3; }
        }
        // Whoever walks through drags the air along and parts it.
        const f = (1 - d / reach) * k.bodies * h * 5;
        ux += (bodyData[o + 5] * 1.2 + nx * .7) * f; uz += (bodyData[o + 6] * 1.2 + nz * .7) * f; uy += f * .35;
      }
      x += (ux + mx) * h; y += (uy + my) * h; z += (uz + mz) * h;
      if (k.collide) {
        const top = solidAt(x, z);
        let floor = groundAt(x, z);
        // Things standing on a cell are a floor for whatever comes down onto them.
        if (top > floor && oy >= top - .05) floor = top;
        else if (y < top) {
          const blockX = solidAt(x, oz) > y, blockZ = solidAt(ox, z) > y, keep = Math.max(.25, k.bounce);
          if (blockX || !blockZ) { x = ox; ux = -ux * keep; wx[i] = -wx[i]; }
          if (blockZ || !blockX) { z = oz; uz = -uz * keep; wz[i] = -wz[i]; }
        }
        if (y < floor) {
          y = floor;
          if (!(state[i] & LANDED)) {
            state[i] |= LANDED;
            if (k.onLand) { px[i] = x; py[i] = y; pz[i] = z; queue(k.onLand, i); }
            if (k.pop) { kill(i); i--; continue; }
          }
          if (k.stick) { state[i] |= STUCK; ux = uy = uz = 0; y = floor + .012 + seed[i] * .006; }
          else {
            if (uy < 0) uy = -uy * k.bounce;
            if (uy < .25) uy = 0;
            const keep = Math.max(0, 1 - k.friction);
            ux *= keep; uz *= keep;
            wy[i] = Math.max(0, wy[i]);
          }
        }
      }
      px[i] = x; py[i] = y; pz[i] = z; vx[i] = ux; vy[i] = uy; vz[i] = uz;
    }
  }

  // Rendering: one camera-facing quad, instanced once per living particle.
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  const format = new pc.VertexFormat(device, [pc.SEMANTIC_ATTR10, pc.SEMANTIC_ATTR11, pc.SEMANTIC_ATTR12, pc.SEMANTIC_ATTR13].map(semantic => ({ semantic, components: 4, type: pc.TYPE_FLOAT32 })));
  const buffer = new pc.VertexBuffer(device, format, capacity, { usage: pc.BUFFER_DYNAMIC });
  const instances = new Float32Array(buffer.lock() as ArrayBuffer);
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-particles',
    attributes: { vertex_position: pc.SEMANTIC_POSITION, aPosSize: pc.SEMANTIC_ATTR10, aColour: pc.SEMANTIC_ATTR11, aMotion: pc.SEMANTIC_ATTR12, aLook: pc.SEMANTIC_ATTR13 },
    vertexGLSL: VERTEX, fragmentGLSL: FRAGMENT, vertexWGSL: VERTEX_WGSL, fragmentWGSL: FRAGMENT_WGSL,
  });
  material.name = 'Partículas';
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  const light = new Float32Array([1, 1, 1]);
  material.setParameter('uLight', light);
  let soft = true;
  material.setParameter('uSoft', 1);
  const instance = new pc.MeshInstance(quad, material);
  instance.setInstancing(buffer);
  instance.instancingCount = 0;
  const entity = new pc.Entity('Partículas');
  entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
  app.root.addChild(entity);

  function write() {
    for (let i = 0; i < alive; i++) {
      const k = kinds[kind[i]], o = i * STRIDE, t = Math.min(1, age[i] / life[i]), s = seed[i];
      const grow = k.growIn ? 1 - (1 - Math.min(1, t / k.growIn)) ** 2 : 1;
      let fade = (k.fadeIn ? Math.min(1, t / k.fadeIn) : 1) * (k.fadeOut ? Math.min(1, (1 - t) / k.fadeOut) : 1);
      if (k.flicker) fade *= 1 - k.flicker * (.5 + .5 * Math.sin(time * k.flickerRate * (.7 + s * .6) * Math.PI * 2 + s * 40));
      const stuck = (state[i] & STUCK) !== 0, c = i * 6;
      instances[o] = px[i]; instances[o + 1] = py[i]; instances[o + 2] = pz[i];
      instances[o + 3] = size[i] * grow * Math.max(0, 1 + (k.sizeEnd - 1) * t);
      instances[o + 4] = colour[c] + (colour[c + 3] - colour[c]) * t;
      instances[o + 5] = colour[c + 1] + (colour[c + 4] - colour[c + 1]) * t;
      instances[o + 6] = colour[c + 2] + (colour[c + 5] - colour[c + 2]) * t;
      instances[o + 7] = k.opacity * Math.max(0, fade);
      const orient = stuck ? 2 : k.orient;
      if (orient === 1) {
        // The streak is as long as a short slice of its flight, capped so a fast spark stays a spark.
        let sx = vx[i] * k.stretch, sy = vy[i] * k.stretch, sz = vz[i] * k.stretch;
        const length = Math.hypot(sx, sy, sz);
        if (length > .9) { const f = .9 / length; sx *= f; sy *= f; sz *= f; }
        instances[o + 8] = sx; instances[o + 9] = sy; instances[o + 10] = sz;
      } else if (k.tumble && !stuck) {
        instances[o + 8] = Math.cos(time * k.tumble * Math.PI * 2 * (.6 + s * .8) + s * 9) * .6; instances[o + 9] = 1; instances[o + 10] = 0;
      } else { instances[o + 8] = k.tumble ? .6 : k.aspect[0]; instances[o + 9] = k.aspect[1]; instances[o + 10] = 0; }
      instances[o + 11] = rot[i];
      instances[o + 12] = k.shape + s * .98; instances[o + 13] = orient + (orient === 2 ? 0 : Math.min(k.soft, instances[o + 3])); instances[o + 14] = k.additive; instances[o + 15] = k.glow;
    }
    if (alive) buffer.unlock(0, alive * STRIDE * 4);
    instance.instancingCount = alive;
    entity.enabled = alive > 0;
  }

  class Emitter implements ParticleEmitter {
    readonly at = new pc.Vec3();
    enabled = true;
    acc = 0;
    rate: number;
    readonly id: number;
    readonly colours: Float32Array;
    readonly options: EmitterOptions;
    readonly area?: { x: number; z: number; low: number; high: number };
    constructor(name: string, at: Vec, options: EmitterOptions) {
      this.id = kindId(name); this.at.set(at.x, at.y, at.z); this.rate = options.rate; this.options = options;
      this.area = options.area && { ...options.area };
      this.colours = options.colour ? colourPair(options.colour, new Float32Array(6)) : kinds[this.id].colour;
    }
    emit(n: number, ageAt?: () => number) {
      const area = this.area;
      if (!area) { burstFrom(this.id, this.at, n, this.options, this.colours, !!this.options.ambient); return; }
      for (let i = 0; i < n; i++) {
        const x = this.at.x + (Math.random() * 2 - 1) * area.x, z = this.at.z + (Math.random() * 2 - 1) * area.z;
        if (world && (x < world.x0 || x > world.x1 || z < world.z0 || z > world.z1)) continue;
        const floor = Math.max(groundAt(x, z), world ? world.outside : 0);
        const y = floor + area.low + Math.random() * (area.high - area.low);
        if (solidAt(x, z) > y) continue;
        const k = kinds[this.id], a = Math.random() * Math.PI * 2, s = pick(k.speed) * (this.options.speed ?? 1);
        const v = this.options.velocity;
        spawn(this.id, x, y, z, Math.cos(a) * s + (v?.x ?? 0), pick(k.rise) + (v?.y ?? 0), Math.sin(a) * s + (v?.z ?? 0), this.colours, this.options.size ?? 1, this.options.life ?? 1, !!this.options.ambient, ageAt?.());
      }
    }
    warm() {
      const k = kinds[this.id];
      this.emit(Math.round(this.rate * (k.life[0] + k.life[1]) / 2 * (this.options.life ?? 1)), Math.random);
    }
    remove() { const i = emitters.indexOf(this); if (i >= 0) emitters.splice(i, 1); }
  }
  class Attractor implements ParticleAttractor {
    readonly at = new pc.Vec3();
    age = 0;
    pull: number; swirl: number; lift: number; radius: number; life: number;
    constructor(o: AttractorOptions) {
      this.at.set(o.at.x, o.at.y, o.at.z);
      this.pull = o.pull ?? 0; this.swirl = o.swirl ?? 0; this.lift = o.lift ?? 0; this.radius = o.radius ?? 2; this.life = o.life ?? Infinity;
    }
    remove() { const i = attractors.indexOf(this); if (i >= 0) attractors.splice(i, 1); }
  }

  const offset = new pc.Vec3(), basisA = new pc.Vec3(), basisB = new pc.Vec3(), aim = new pc.Vec3();
  function burstFrom(id: number, at: Vec, count: number, o: SpawnOptions, colours: Float32Array, isAmbient: boolean) {
    const k = kinds[id], spread = o.spread ?? 0, n = Math.max(0, Math.round(count));
    if (o.direction) {
      aim.set(o.direction.x, o.direction.y, o.direction.z).normalize();
      basisA.cross(aim, Math.abs(aim.y) < .9 ? pc.Vec3.UP : pc.Vec3.RIGHT).normalize();
      basisB.cross(aim, basisA);
    }
    const cosCone = Math.cos(o.cone ?? .5);
    for (let i = 0; i < n; i++) {
      if (o.place) o.place(i, n, offset);
      else {
        const a = Math.random() * Math.PI * 2, r = spread * (o.ring ? 1 : Math.sqrt(Math.random()));
        if (o.flat || o.ring) offset.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        else { const u = Math.random() * 2 - 1, q = Math.sqrt(1 - u * u); offset.set(Math.cos(a) * q * r, u * r * .6, Math.sin(a) * q * r); }
      }
      const speed = pick(k.speed) * (o.speed ?? 1);
      let ux: number, uy: number, uz: number;
      if (o.direction) {
        const c = 1 - Math.random() * (1 - cosCone), sn = Math.sqrt(1 - c * c), b = Math.random() * Math.PI * 2;
        ux = (aim.x * c + (basisA.x * Math.cos(b) + basisB.x * Math.sin(b)) * sn) * speed;
        uy = (aim.y * c + (basisA.y * Math.cos(b) + basisB.y * Math.sin(b)) * sn) * speed;
        uz = (aim.z * c + (basisA.z * Math.cos(b) + basisB.z * Math.sin(b)) * sn) * speed;
      } else {
        // Outward from where it appeared, or any way along the ground from a single point.
        const flat = Math.hypot(offset.x, offset.z), a = flat > 1e-4 ? Math.atan2(offset.z, offset.x) : Math.random() * Math.PI * 2;
        ux = Math.cos(a) * speed; uy = 0; uz = Math.sin(a) * speed;
      }
      uy += pick(k.rise) * (o.speed ?? 1);
      spawn(id, at.x + offset.x, at.y + offset.y, at.z + offset.z, ux + (o.velocity?.x ?? 0), uy + (o.velocity?.y ?? 0), uz + (o.velocity?.z ?? 0), colours, o.size ?? 1, o.life ?? 1, isAmbient);
    }
  }

  const burstColour = new Float32Array(6);
  return {
    get count() { return alive; },
    capacity,
    /** The wind every `wind`-riding particle leans into (m/s). */
    wind,
    get turbulence() { return turbulence; },
    set turbulence(value: number) { turbulence = value; },
    /** Registers or replaces a kind under `name`. */
    define(name: string, def: ParticleKind) {
      const compiled: Compiled = {
        shape: SHAPES[def.shape], orient: ORIENTS[def.orient ?? 'face'], additive: def.additive ?? 0, glow: def.glow ?? 0, intensity: def.intensity ?? 1, opacity: def.opacity ?? 1,
        life: range(def.life, 1), size: range(def.size, .1), aspect: [def.aspect?.[0] ?? 1, def.aspect?.[1] ?? 1], sizeEnd: def.sizeEnd ?? 1, growIn: def.growIn ?? 0, fadeIn: def.fadeIn ?? 0, fadeOut: def.fadeOut ?? 0,
        speed: range(def.speed, 0), rise: range(def.rise, 0), gravity: def.gravity ?? 0, drag: def.drag ?? 0,
        wander: def.wander ?? 0, wanderRate: def.wanderRate ?? 1, flow: def.flow ?? 0, wind: def.wind ?? 0,
        collide: def.collide ?? false, bounce: def.bounce ?? 0, friction: def.friction ?? 0, stick: def.stick ?? false, pop: def.pop ?? false, bodies: def.bodies ?? 0,
        stretch: def.stretch ?? 0, spin: range(def.spin, 0), flicker: def.flicker ?? 0, flickerRate: def.flickerRate ?? 1, tumble: def.tumble ?? 0,
        colour: colourPair(def.colour, new Float32Array(6)), onLand: def.onLand, onDeath: def.onDeath,
        soft: def.orient === 'ground' ? 0 : Math.min(.9, def.soft ?? ((def.additive ?? 0) >= 1 ? 0 : .3)),
      };
      const existing = names.get(name);
      if (existing !== undefined) kinds[existing] = compiled;
      else { if (kinds.length >= 255) throw new Error('Too many particle kinds'); names.set(name, kinds.length); kinds.push(compiled); }
    },
    /** One-off: `count` particles of `name` at `at`. */
    burst(name: string, at: Vec, count: number, options: SpawnOptions = {}) {
      const id = kindId(name);
      burstFrom(id, at, count, options, options.colour ? colourPair(options.colour, burstColour) : kinds[id].colour, false);
    },
    /** A steady stream (move its `at`, change its `rate`); `area` fills a volume instead of a point. */
    emitter(name: string, at: Vec, options: EmitterOptions): ParticleEmitter {
      const e = new Emitter(name, at, options); emitters.push(e); return e;
    },
    /** A point that pulls, swirls or lifts particles nearby. */
    attract(options: AttractorOptions): ParticleAttractor {
      const a = new Attractor(options); attractors.push(a); return a;
    },
    /** Who particles flow around this frame. */
    setBodies(list: readonly ParticleBody[]) {
      bodyCount = Math.min(list.length, bodyData.length / BODY);
      for (let b = 0; b < bodyCount; b++) {
        const body = list[b], o = b * BODY;
        bodyData[o] = body.x; bodyData[o + 1] = body.y; bodyData[o + 2] = body.z; bodyData[o + 3] = body.radius; bodyData[o + 4] = body.height;
        let speedX = 0, speedZ = 0;
        if (body.key) {
          const seen = lastSeen.get(body.key);
          if (seen && time > seen.t) { speedX = (body.x - seen.x) / (time - seen.t); speedZ = (body.z - seen.z) / (time - seen.t); }
          if (Math.hypot(speedX, speedZ) > 12) speedX = speedZ = 0;
          lastSeen.set(body.key, { x: body.x, z: body.z, t: time });
        }
        bodyData[o + 5] = speedX; bodyData[o + 6] = speedZ;
      }
    },
    /** Bakes the scene's floors and walls; particles already flying keep going. */
    setWorld(next: ParticleWorld | undefined) {
      world = next; floors = undefined;
      if (!next) return;
      floorCols = Math.max(1, Math.ceil((next.x1 - next.x0) * FLOOR_RES) + 1);
      floorRows = Math.max(1, Math.ceil((next.z1 - next.z0) * FLOOR_RES) + 1);
      floors = new Float32Array(floorCols * floorRows);
      for (let j = 0; j < floorRows; j++) for (let i = 0; i < floorCols; i++) floors[j * floorCols + i] = next.ground(next.x0 + i / FLOOR_RES, next.z0 + j / FLOOR_RES);
    },
    groundAt,
    /** Where every living particle is (x, y, z each) and whether it is stuck, for tests and debugging. */
    snapshot() {
      return Array.from({ length: alive }, (_, i) => ({ x: px[i], y: py[i], z: pz[i], stuck: (state[i] & STUCK) !== 0, kind: [...names].find(([, id]) => id === kind[i])![0] }));
    },
    /** How much scene light covering particles take (linear RGB); glowing ones ignore it. */
    setLight(r: number, g: number, b: number) { light[0] = r; light[1] = g; light[2] = b; material.setParameter('uLight', light); },
    /** Soft particles on or off (for comparisons); they also need the post pass's scene depth (src/post.ts). */
    get soft() { return soft; },
    set soft(on: boolean) { soft = on; material.setParameter('uSoft', on ? 1 : 0); },
    update(dt: number, simulate = true) {
      if (dt > 0 && simulate) {
        time += dt;
        for (const e of emitters) {
          if (!e.enabled) continue;
          e.acc += e.rate * dt;
          const n = Math.floor(e.acc); e.acc -= n;
          if (n) e.emit(Math.min(n, 400));
        }
        for (let a = attractors.length - 1; a >= 0; a--) if ((attractors[a].age += dt) >= attractors[a].life) attractors.splice(a, 1);
        const steps = Math.min(8, Math.ceil(dt / STEP));
        for (let s = 0; s < steps; s++) { step(dt / steps); if (pending.length) flushPending(); }
      }
      write();
    },
    /** Ends every effect in flight; ambient particles (`ambient` emitters) stay unless `all`. */
    clear(all = false) {
      for (let i = alive - 1; i >= 0; i--) if (all || !ambient[i]) kill(i);
      pending.length = 0;
      write();
    },
    destroy() { entity.destroy(); buffer.destroy(); quad.destroy(); material.destroy(); emitters.length = 0; attractors.length = 0; },
  };
}
export type ParticleSystem = ReturnType<typeof createParticles>;
