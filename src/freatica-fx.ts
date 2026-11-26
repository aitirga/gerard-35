import * as pc from 'playcanvas';
import { bodyOf, type Effects } from './effects.ts';
import type { GpuEmitter, GpuKind } from './fight-particles.ts';

/**
 * Freática's water as the fight will show it (docs/animas/freatica/README.md § Look and interface,
 * docs/animas/README.md § Agua contenida), built in the effects lab ahead of the ánima
 * (src/freatica-lab.ts). A visual piece only: it never touches a fight's numbers.
 *
 * Every foe carries its own water (Aitor 2026-11-20): `createFreaticaFx` is one cell, laid round the
 * foes its scene names, and `createFreaticaField` gives each foe of a fight its own.
 *
 * - **The cell**: a straight prism round its foe, drawn as what it is, a control volume: edges of
 *   white light, clear water inside to a level, and a staff gauge up the corner nearest the camera
 *   with its three marks numbered I, II, III.
 * - **The colour is the depth**: thin water is green, deep water blue, the way a model ramps a
 *   depth. So the level is read three times: by where the surface is, by the gauge, by the hue.
 * - **The surface is the clock**: within a mark it sinks slowly from full to the mark's own tick
 *   over the mark's 20 s, then drops to the one below.
 * - **Bajo cero**: the water freezes into a block round each foe, to where it stood. The ice melts
 *   as the fight's clock runs (a mark every `AGUA.ice` seconds, sinking all the while), cracks with
 *   each blow from outside (it holds `AGUA.blows`; a hard one counts two, each strike of a flurry
 *   one) and breaks when cracked through.
 * - **Corriente**: arcs skate over the surface and run along the edges; each pulse the whole
 *   volume flickers yellow. **Vapor**: the top slab flashes white and goes up as steam, which
 *   stays over the foes. **Hundido**: at the third mark the water closes over the tallest head
 *   and strings of bubbles rise from each foe.
 *
 * Grey edges and gauge in the ánima's first round, their colour in the second; the water is the
 * same in both. No pink and no violet (docs/visual-style.md).
 */
export const AGUA = {
  /** Thin water, deep water, the line of the surface and the cell's edges (sRGB hex). */
  green: '#27c2a0', blue: '#1f5fd8', foam: '#dffcf6', edge: '#f4fffc', grey: '#aab4b1', spark: '#ffe24a',
  /** Each mark's own tick over the floor (m; the third is set by the tallest foe) and how far over it the water stands when full. */
  ticks: [.12, .8, 2] as number[], bands: [.2, .25, .35] as number[],
  /** Seconds a mark lasts, and the current's. */
  mark: 20, current: 10, pulse: 2,
  /** How far the cell reaches past the outermost foe (m), and its line width (px). */
  margin: .24, line: 1.4,
  /** How far apart two neighbouring cells' walls stand at least (m). */
  gap: .06,
  /** How far the cell's walls stand over the water at its third mark (m). */
  headroom: .12,
  /** Seconds a mark of ice takes to melt: what a mark of water lasts. */
  ice: 20,
  /**
   * Blows from outside a frozen foe's ice holds before it breaks. A leve or medio blow counts one, an
   * alto or muy alto two (so four to eight blows), and each strike of a flurry one.
   */
  blows: 8,
} as const;

/**
 * Each mark's tick and band for a cell whose tallest foe is `tallest` m: the third mark stands a hand over its head and
 * the other two shrink with it, so a small foe's cell is only a little taller than it (never taller than `AGUA.ticks`'s).
 */
export function markHeights(tallest: number) {
  const top = Math.max(.5, tallest + .1), k = Math.min(1, top / AGUA.ticks[2]);
  return { ticks: [AGUA.ticks[0] * k, AGUA.ticks[1] * k, top], bands: AGUA.bands.map(b => b * k) };
}

export const AGUA_KINDS = {
  // Air let go under water: beads of glass that rise and wobble.
  'agua-burbuja': { shape: 'dot', glass: .8, colours: ['#ffffff', '#dcfaff', '#a8e6ea'], intensity: [1.7, 1.3, .9], size: [.012, .024], sizeJitter: .6, drag: 2.4, gravity: -2.6, curl: .55, fadeIn: .08, fadeOut: .12, additive: .55, opacity: .95, core: .35 },
  // Riada's surge, a fluid (src/fight-particles.ts § The fluid): soft teal water that pushes itself apart
  // where it crowds and moves with the flow round it, so it runs across the cell as one body, breaks
  // on the foe and spreads over the floor.
  'agua-ola': { shape: 'glow', blur: [.5, .8], colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.35, 1.2, .95], middle: .5, size: [.06, .065], sizeJitter: .35, drag: .3, gravity: 9, curl: .1, response: .2, collide: true, bounce: .02, friction: .45, fadeIn: .05, fadeOut: .3, additive: .2, opacity: .78, core: 0, fluid: { pressure: 14, viscosity: 6, rest: 10 } },
  // Drops thrown off the surface.
  'agua-gota': { shape: 'dot', glass: .35, colours: ['#ffffff', '#c6f3f2', '#6fcfd8'], intensity: [1.5, 1.2, .9], size: [.02, .011], sizeJitter: .6, drag: .5, gravity: 9, collide: true, bounce: 0, friction: 1, fadeOut: .3, additive: .35, opacity: .9, core: .6 },
  // The top of the water gone up as steam: white haze that rushes up and spreads.
  'agua-vapor': { shape: 'glow', colours: ['#ffffff', '#f2f8f8', '#dfeaea'], intensity: [1.5, 1.15, .8], middle: .3, size: [.12, .46], sizeJitter: .6, drag: 1.5, gravity: -2.4, curl: 1.3, response: 1, fadeIn: .08, fadeOut: .6, additive: .3, opacity: .26, blur: [.5, 1.2], fluid: { pressure: 14, viscosity: 2.5, rest: 6 } },
  // What is left of it: a slow cloud that hangs at the height of the foes' heads.
  'agua-nube': { shape: 'glow', colours: ['#f4f8f8', '#e9f0f0', '#dbe5e5'], intensity: [.95, .85, .7], middle: .4, size: [.34, .7], sizeJitter: .5, drag: 2.2, gravity: -.08, curl: .35, response: .6, fadeIn: .35, fadeOut: .5, additive: .12, opacity: .11, blur: 1.2 },
  // The tape a skill runs out along the floor to the cell, and the bolt's own track: beads of light that stay where they are born.
  'agua-traza': { shape: 'glow', colours: ['#ffffff', '#d8fff2', '#7fe6c6'], intensity: [2.2, 1.6, 1], middle: .35, size: [.05, .02], sizeJitter: .4, drag: 6, gravity: 0, fadeIn: .03, fadeOut: .5, additive: .9, opacity: .8 },
  // Water given to the party: green beads that rise round whoever it heals.
  'agua-cura': { shape: 'dot', glass: .5, colours: ['#f2fff9', '#9af5d2', '#35cfa2'], intensity: [1.9, 1.5, 1.1], size: [.014, .03], sizeJitter: .6, drag: 2, gravity: -1.9, curl: .5, fadeIn: .1, fadeOut: .35, additive: .7, opacity: .9, core: .4 },
  // Ice broken off a frozen foe: pale shards that fly, fall and skid.
  'agua-hielo': { shape: 'shard', colours: ['#ffffff', '#d6f6fb', '#8fd6e2'], intensity: [1.8, 1.4, 1], size: [.06, .035], sizeJitter: .7, stretch: .02, spin: 520, drag: .4, gravity: 9, collide: true, bounce: .4, friction: .4, fadeOut: .3, additive: .35, opacity: .95 },
  // The cold coming off the ice: a low white breath that creeps and sinks.
  'agua-frio': { shape: 'glow', colours: ['#ffffff', '#eaf8fb', '#cfeaf0'], intensity: [1.1, .9, .7], middle: .4, size: [.2, .5], sizeJitter: .5, drag: 2.4, gravity: .25, curl: .5, response: .7, fadeIn: .2, fadeOut: .6, additive: .15, opacity: .13, blur: 1.1 },
} satisfies Record<string, GpuKind>;

const VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vUv: vec2f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.vUv = vertex_position.xy;
  output.position = uniform.matrix_viewProjection * (uniform.matrix_model * vec4f(vertex_position, 1.0));
  return output;
}`;

/**
 * What every sheet of the cell shares. `uCell`: half width, half depth, height (m), the time.
 * `uWater`: the level (m), how deep it reads (0 thin and green, 1 deep and blue), how much of the
 * cell is drawn (it draws itself in), the swell of a mark rising. `uElec`: the current (0–1), its
 * pulse's flash, the steam's flash, grey (1) or coloured edges. `uSlab`: the slab that goes up as
 * steam (its bottom and top, m), how broken the cell is, the last seconds' blink. `uFoeN`: a foe's
 * place in the cell (m), its radius, and whether it is there. `uView`: the way to the camera.
 * `uCast`: what a skill does to it: the flash of a water hammer, how frozen it is (0–1: the
 * water is gone into the ice round each foe), and a wave crossing it (where its crest is, m along the cell from
 * the party's side, and how high).
 */
const SHARED = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vUv: vec2f;
uniform uCell: vec4f;
uniform uWater: vec4f;
uniform uElec: vec4f;
uniform uSlab: vec4f;
uniform uFoe0: vec4f;
uniform uFoe1: vec4f;
uniform uFoe2: vec4f;
uniform uFoe3: vec4f;
uniform uView: vec4f;
uniform uCast: vec4f;
const aGreen: vec3f = vec3f(0.020, 0.540, 0.352);
const aBlue: vec3f = vec3f(0.012, 0.205, 0.640);
const aFoam: vec3f = vec3f(0.74, 0.97, 0.92);
const aSpark: vec3f = vec3f(1.0, 0.72, 0.04);
fn aHash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn aNoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2f(1.0, 0.0)), u.x), mix(aHash(i + vec2f(0.0, 1.0)), aHash(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn lg(x: f32, w: f32) -> f32 { return exp(-x * x / (w * w)); }
// What is left of light that has crossed this much water (m): the red goes first, as in real water,
// so nothing seen through it turns pink or violet.
fn aThrough(m: f32) -> vec3f { return exp(-vec3f(1.15, 0.2, 0.09) * m); }
// The cell's edges and the gauge: grey in the first round, their own white in the second.
fn aLine() -> vec3f { return mix(vec3f(0.9, 1.0, 0.97), vec3f(0.42, 0.46, 0.45), uniform.uElec.w); }
// The water's colour so far under its surface, in water that reads this deep.
fn aBody(under: f32) -> vec3f {
  let k = clamp(uniform.uWater.y * 0.42 + under * 0.5, 0.0, 1.0);
  return mix(aGreen, aBlue, smoothstep(0.0, 1.0, k));
}
fn aRing(p: vec2f, foe: vec4f, t: f32) -> f32 {
  let d = length(p - foe.xy);
  return foe.w * 0.011 * sin(d * 15.0 - t * 4.6) * exp(-max(d - foe.z, 0.0) * 1.7) * smoothstep(foe.z * 0.5, foe.z, d);
}
// A wave crossing the cell from the party's side: a steep crest with a trough behind, so far along it (m).
fn aWave(z: f32) -> f32 {
  let w = z - uniform.uCast.z;
  return uniform.uCast.w * (0.3 * exp(-w * w / 0.06) - 0.08 * exp(-(w + 0.55) * (w + 0.55) / 0.2)) * smoothstep(0.0, 0.25, uniform.uCell.y - abs(z));
}
// How high the surface stands over its level at a place in the cell (m): slow swells, a ring round
// each foe, the dome of a mark welling up, and a shiver with each pulse of current. Flat at the walls.
fn aHeight(p: vec2f) -> f32 {
  let t = uniform.uCell.w;
  var h = 0.011 * sin(p.x * 3.1 + t * 1.3) + 0.009 * sin(p.y * 2.7 - t * 1.1 + 1.3) + 0.005 * sin((p.x + p.y) * 5.3 + t * 2.1);
  h += aRing(p, uniform.uFoe0, t) + aRing(p, uniform.uFoe1, t) + aRing(p, uniform.uFoe2, t) + aRing(p, uniform.uFoe3, t);
  // Frozen, it does not move.
  h *= 1.0 - 0.9 * uniform.uCast.y;
  let r = length(p); let wide = 0.55 * min(uniform.uCell.x, uniform.uCell.y);
  h += uniform.uWater.w * (0.2 * exp(-r * r / (wide * wide)) + 0.035 * sin(r * 7.0 - t * 9.0) * exp(-r * 0.6));
  h += uniform.uElec.y * 0.012 * sin(p.x * 31.0 + t * 50.0) * sin(p.y * 29.0 - t * 43.0);
  let edge = smoothstep(0.0, 0.3, uniform.uCell.x - abs(p.x)) * smoothstep(0.0, 0.3, uniform.uCell.y - abs(p.y));
  // Flat at the walls, but for a wave, which runs along them.
  return h * edge + aWave(p.y);
}
// Arcs: thin jagged lines that jump many times a second, a few at a time.
fn aArcs(p: vec2f, t: f32) -> f32 {
  let s = floor(t * 13.0);
  let n = aNoise(p * 1.3 + s * 7.31) + 0.45 * aNoise(p * 4.7 - s * 3.17) + 0.2 * aNoise(p * 13.0 + s) - 0.82;
  let w = max(fwidth(n), 1e-4);
  let line = 1.0 - smoothstep(0.0, 1.6 * w, abs(n));
  let glow = lg(n, 0.09) * 0.25;
  return (line + glow) * smoothstep(0.35, 0.6, aNoise(p * 0.7 + s * 1.9));
}
fn aCaustic(p: vec2f, t: f32) -> f32 {
  var hxx = 0.0; var hyy = 0.0; var hxy = 0.0;
  for (var i = 0; i < 5; i++) {
    let fi = f32(i); let an = fi * 2.399 + 0.4;
    let k = vec2f(cos(an), sin(an)) * (1.5 + 0.5 * fi);
    let s = -(0.6 / (1.0 + 0.5 * fi)) * sin(dot(k, p) + t * (0.6 + 0.21 * fi) + fi * 1.7);
    hxx += s * k.x * k.x; hyy += s * k.y * k.y; hxy += s * k.x * k.y;
  }
  let bend = 0.42;
  let det = (1.0 + bend * hxx) * (1.0 + bend * hyy) - bend * bend * hxy * hxy;
  return pow(clamp(0.07 / abs(det), 0.0, 1.3), 1.6);
}
// Colour that covers by alpha, plus light that only adds.
fn aOut(body: vec3f, alpha: f32, light: vec3f) -> vec4f {
  let a = clamp(alpha, 0.0, 1.0);
  return vec4f(gammaCorrectOutput(toneMap(max(body, vec3f(0.0)))) * a + gammaCorrectOutput(toneMap(max(light, vec3f(0.0)))), a);
}
`;

/** The surface: a grid laid over the cell and lifted to the level, moving with `aHeight`. */
const SURFACE_VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
${SHARED.replace(/#include "[a-zA-Z]+"\n/g, '').replace(/fn aArcs[\s\S]*$/, '')}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let p = vertex_position.xz * uniform.uCell.xy;
  output.vUv = vertex_position.xz;
  let local = vec3f(p.x, uniform.uWater.x + aHeight(p), p.y);
  output.position = uniform.matrix_viewProjection * (uniform.matrix_model * vec4f(local, 1.0));
  return output;
}`;

const SURFACE = /* wgsl */ `
${SHARED}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uCell.w; let p = vUv * uniform.uCell.xy;
  let e = 0.035;
  let n = normalize(vec3f(aHeight(p - vec2f(e, 0.0)) - aHeight(p + vec2f(e, 0.0)), 2.0 * e, aHeight(p - vec2f(0.0, e)) - aHeight(p + vec2f(0.0, e))));
  let v = normalize(uniform.uView.xyz);
  let fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
  let sun = normalize(vec3f(-0.35, 0.82, -0.45));
  let spec = pow(clamp(dot(n, normalize(sun + v)), 0.0, 1.0), 140.0);
  // Her model's cells, quiet: a square mesh on the surface that bends with it.
  let q = (p + n.xz * 0.9) / 0.5;
  let g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2f(1e-4));
  let mesh = 1.0 - clamp(min(g.x, g.y), 0.0, 1.0);
  let net = aCaustic(p * 2.4 + n.xz * 3.0, t * 0.8);
  let wall = min(uniform.uCell.x - abs(p.x), uniform.uCell.y - abs(p.y));
  let rim = lg(wall, 0.02);
  let show = uniform.uWater.z * (1.0 - uniform.uSlab.z) * smoothstep(0.0, 0.04, uniform.uWater.x) * (1.0 - uniform.uCast.y);
  let body = aBody(uniform.uWater.x * 0.55) * (0.75 + 0.5 * n.y) + aFoam * 0.1 * net;
  let alpha = (0.1 + 0.3 * fres) * show;
  // The wave's crest, white, and the foam it leaves behind it.
  let behind = uniform.uCast.z - p.y;
  let crest = uniform.uCast.w * (lg(behind, 0.2) + 0.45 * smoothstep(0.0, 0.2, behind) * (1.0 - smoothstep(0.2, 1.5, behind)) * smoothstep(0.35, 0.75, aNoise(p * 6.0 + vec2f(0.0, t * 2.0))));
  var light = body * 0.2 + aFoam * (spec * 1.6 + fres * 0.16 + mesh * 0.085 + crest * 0.7 + rim * 0.5 * (1.0 - 0.6 * uniform.uSlab.w * (0.5 + 0.5 * sin(t * 14.0))));
  // The current: arcs skating over it, and the whole of it flickering with each pulse.
  light += aSpark * uniform.uElec.x * (aArcs(p, t) * 1.7 + 0.06) + mix(aSpark, vec3f(1.0), 0.25) * uniform.uElec.y * (0.3 + 0.5 * net);
  light += vec3f(1.0) * uniform.uElec.z * 0.9 + aFoam * uniform.uCast.x * 0.75;
  output.color = aOut(body, alpha, light * show);
  return output;
}`;

/**
 * A wall: `uSide` is half its length (m), whether it faces the camera, a seed, and whether it runs
 * along the line from the party (1: a wave crossing the cell shows on its water line). Water below
 * the level, the cell's edges round it whatever the level.
 */
const WALL = /* wgsl */ `
${SHARED}
uniform uSide: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uCell.w; let H = uniform.uCell.z;
  let x = vUv.x * uniform.uSide.x; let h = (vUv.y * 0.5 + 0.5) * H;
  let level = uniform.uWater.x + uniform.uSide.w * aWave(-x);
  let aa = max(fwidth(h), 1e-4);
  let inside = (1.0 - smoothstep(level - aa, level + aa, h)) * smoothstep(0.0, 0.04, level) * (1.0 - uniform.uCast.y);
  let under = max(level - h, 0.0);
  let front = uniform.uSide.y;
  let draw = uniform.uWater.z; let broken = uniform.uSlab.z;
  // Shafts of light hanging in the water, and the net they make.
  let net = aCaustic(vec2f(x * 2.2 + uniform.uSide.z, h * 2.6 - t * 0.25), t * 0.7);
  let body = aBody(under) * (0.72 + 0.28 * exp(-under * 1.2)) + aFoam * 0.07 * net;
  let alpha = inside * mix(0.04, 0.12, front) * draw * (1.0 - broken);
  var light = body * inside * mix(0.05, 0.15, front) * draw * (1.0 - broken);
  // The line where the water meets the wall.
  light += aFoam * lg((h - level) / (aa * 1.4), 1.0) * 0.7 * smoothstep(0.0, 0.04, level) * (1.0 - uniform.uCast.y) * draw * (1.0 - broken) * mix(0.45, 1.0, front);
  // The cell's edges: its floor first, then the uprights rising, then the top.
  let px = ${AGUA.line.toFixed(1)};
  let ex = 1.0 - abs(vUv.x); let wx = max(fwidth(vUv.x), 1e-5) * px;
  let wy = max(fwidth(vUv.y), 1e-5) * px;
  let up = (1.0 - smoothstep(0.0, wx, ex)) * step(h, H * smoothstep(0.3, 1.0, draw) + 0.001);
  let bottom = (1.0 - smoothstep(0.0, wy, vUv.y + 1.0)) * step(abs(vUv.x), smoothstep(0.0, 0.45, draw));
  let top = (1.0 - smoothstep(0.0, wy, 1.0 - vUv.y)) * smoothstep(0.92, 1.0, draw) * 0.55;
  let gone = step(h, H * (1.0 - smoothstep(0.0, 0.7, broken)));
  let frame = max(max(up, bottom), top) * gone * mix(0.5, 1.0, front);
  let along = x * 5.0 + h * 5.0;
  let run = 0.5 + 0.5 * sin(along * 3.0 - t * 22.0 + uniform.uSide.z);
  light += aLine() * frame * (0.85 + 0.5 * uniform.uCast.y + 2.6 * uniform.uCast.x);
  // A water hammer: the whole body of it goes white for an instant, from the walls in.
  light += aFoam * inside * uniform.uCast.x * mix(0.2, 0.55, front) * draw * (0.6 + 0.8 * lg(ex, 0.35));
  // The slab that goes up as steam.
  light += vec3f(1.0) * uniform.uElec.z * step(uniform.uSlab.x, h) * step(h, uniform.uSlab.y) * mix(0.25, 0.7, front);
  output.color = aOut(body, alpha, light);
  return output;
}`;

/** What the water takes out of what is seen through it: drawn first, multiplying what is behind. */
const SURFACE_ABSORB = /* wgsl */ `
${SHARED}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let show = uniform.uWater.z * (1.0 - uniform.uSlab.z) * smoothstep(0.0, 0.04, uniform.uWater.x) * (1.0 - uniform.uCast.y);
  output.color = vec4f(aThrough((0.22 + 0.5 * uniform.uWater.x) * show), 1.0);
  return output;
}`;
const WALL_ABSORB = /* wgsl */ `
${SHARED}
uniform uSide: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let h = (vUv.y * 0.5 + 0.5) * uniform.uCell.z; let level = uniform.uWater.x + uniform.uSide.w * aWave(-vUv.x * uniform.uSide.x);
  let aa = max(fwidth(h), 1e-4);
  let inside = (1.0 - smoothstep(level - aa, level + aa, h)) * smoothstep(0.0, 0.04, level) * (1.0 - uniform.uCast.y);
  let m = (0.75 + 0.45 * max(level - h, 0.0)) * inside * uniform.uSide.y * uniform.uWater.z * (1.0 - uniform.uSlab.z);
  output.color = vec4f(aThrough(m), 1.0);
  return output;
}`;

/** The floor under it: the light the surface throws down, more of it the deeper the water. */
const FLOOR = /* wgsl */ `
${SHARED}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uCell.w; let p = vUv * (uniform.uCell.xy + vec2f(3.2));
  let level = uniform.uWater.x; let broken = uniform.uSlab.z;
  let net = aCaustic(p * 3.1, t);
  let wet = smoothstep(0.0, 0.1, level) * uniform.uWater.z * (1.0 - uniform.uCast.y);
  let cell = step(abs(p.x), uniform.uCell.x) * step(abs(p.y), uniform.uCell.y);
  // Broken, the water runs out past the walls as a thin sheet with a ragged front, and is gone.
  let out = length(max(abs(p) - uniform.uCell.xy, vec2f(0.0)));
  let front = 0.25 + 2.4 * sqrt(broken) + 0.45 * (aNoise(p * 1.7) - 0.5) + 0.2 * (aNoise(p * 5.0) - 0.5);
  let ran = (1.0 - smoothstep(front - 0.35, front, out)) * (1.0 - cell) * smoothstep(0.0, 0.08, broken) * pow(1.0 - broken, 1.3);
  let lip = lg((out - front + 0.12) / 0.07, 1.0) * (1.0 - cell) * smoothstep(0.0, 0.08, broken) * (1.0 - broken);
  let body = mix(aGreen, aBlue, 0.2);
  let still = pow(1.0 - broken, 2.0);
  let alpha = (cell * wet * 0.1 * still + ran * 0.16);
  let light = aFoam * (cell * wet * net * (0.1 + 0.07 * level) * still + ran * (0.03 + 0.2 * net) + lip * 0.35) + body * ran * 0.12
    + aSpark * cell * wet * uniform.uElec.y * net * 0.5;
  output.color = aOut(body, alpha, light);
  return output;
}`;

/**
 * The staff gauge. `uGauge`: its width (m), which way it stands out from the corner (±1), the
 * marks it holds now. `uTicks`: each mark's tick (m) and where the surface was when it began to
 * sink. A spine, a long tick and a numeral for each mark, short ticks between, and a pointer on
 * the surface.
 */
const GAUGE = /* wgsl */ `
${SHARED}
uniform uGauge: vec4f;
uniform uTicks: vec4f;
fn tick(h: f32, at: f32, w: f32) -> f32 { return 1.0 - smoothstep(0.0, w, abs(h - at)); }
// The roman numeral n (1 to 3) round the origin: upright bars between two serifs.
fn numeral(q: vec2f, n: f32, wx: f32, wy: f32) -> f32 {
  let gap = 0.034; let tall = 0.05;
  var m = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    if (fi < n) {
      let cx = (fi - (n - 1.0) * 0.5) * gap;
      m = max(m, (1.0 - smoothstep(0.004, 0.004 + wx, abs(q.x - cx))) * (1.0 - smoothstep(tall, tall + wy, abs(q.y))));
    }
  }
  let half = (n - 1.0) * 0.5 * gap + 0.014;
  let serif = (1.0 - smoothstep(0.003, 0.003 + wy, abs(abs(q.y) - tall))) * (1.0 - smoothstep(half, half + wx, abs(q.x)));
  return max(m, serif);
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uCell.w; let H = uniform.uCell.z; let W = uniform.uGauge.x;
  let x = (vUv.x * uniform.uGauge.y * 0.5 + 0.5) * W; let h = (vUv.y * 0.5 + 0.5) * H;
  let wx = max(fwidth(x), 1e-5) * 1.2; let wy = max(fwidth(h), 1e-5) * 1.2;
  let level = uniform.uWater.x; let marks = uniform.uGauge.z;
  let draw = smoothstep(0.55, 1.0, uniform.uWater.z) * (1.0 - smoothstep(0.0, 0.5, uniform.uSlab.z));
  var dim = 0.0; var lit = 0.0;
  var ticks = array<f32, 4>(0.0, uniform.uTicks.x, uniform.uTicks.y, uniform.uTicks.z);
  for (var i = 1; i < 4; i++) {
    let at = ticks[i]; let on = step(f32(i) - 0.5, marks);
    let major = tick(h, at, wy) * step(x, 0.17);
    let name = numeral(vec2f(x - 0.27, h - at), f32(i), wx, wy);
    // Short ticks between this mark and the one below.
    var minor = 0.0;
    for (var j = 1; j < 4; j++) { minor = max(minor, tick(h, mix(ticks[i - 1], at, f32(j) * 0.25), wy) * step(x, 0.07)); }
    dim += minor * 0.6 + (major + name) * (1.0 - on) * 0.75;
    lit += (major + name) * on;
  }
  // The pointer: a small wedge riding the surface, and a notch where the surface stood.
  let wedge = (1.0 - smoothstep(0.0, wy, abs(h - level) - (0.085 - x) * 0.55)) * step(x, 0.085) * step(0.02, level);
  let was = tick(h, uniform.uTicks.w, wy) * step(0.19, x) * step(x, 0.23) * step(0.02, uniform.uTicks.w);
  let blink = 1.0 - 0.6 * uniform.uSlab.w * (0.5 + 0.5 * sin(t * 14.0));
  var light = aLine() * (dim * 0.5 + lit * 1.5 + was * 0.8) + mix(aFoam, aLine(), 0.3) * wedge * 1.6 * blink;
  light += aSpark * uniform.uElec.x * (lit + wedge) * 0.8;
  output.color = aOut(vec3f(0.0), 0.0, light * draw);
  return output;
}`;

/**
 * A block of ice round a frozen foe: a box from the floor to where the water stood. `uIce`: its
 * width, height and depth (m) and a seed. `uCrack`: how cracked it is (0–1, breaking at 1), how
 * much of it is there, and the flash of a blow. Cracks open from the middle of each face out.
 */
const ICE_VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vUv: vec2f;
varying vPos: vec3f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.vUv = vertex_position.xy;
  output.vPos = vertex_position;
  output.position = uniform.matrix_viewProjection * (uniform.matrix_model * vec4f(vertex_position, 1.0));
  return output;
}`;
const ICE = /* wgsl */ `
${SHARED}
varying vPos: vec3f;
uniform uIce: vec4f;
uniform uCrack: vec4f;
// The nearest two cell points of a scatter, and which cell: its borders are the cracks.
fn aVoro(p: vec2f) -> vec3f {
  let i = floor(p); let f = fract(p);
  var d1 = 8.0; var d2 = 8.0; var id = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2f(f32(x), f32(y));
      let o = vec2f(aHash(i + g), aHash(i + g + vec2f(17.3, 5.1)));
      let d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = aHash(i + g + vec2f(3.7, 9.2)); } else if (d < d2) { d2 = d; }
    }
  }
  return vec3f(d1, d2, id);
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let size = uniform.uIce.xyz; let a = abs(vPos);
  var uv = vPos.xy * size.xy; var n = vec3f(0.0, 0.0, sign(vPos.z)); var half = size.xy * 0.5;
  if (a.x > 0.4995) { uv = vPos.zy * size.zy; n = vec3f(sign(vPos.x), 0.0, 0.0); half = size.zy * 0.5; }
  else if (a.y > 0.4995) { uv = vPos.xz * size.xz; n = vec3f(0.0, sign(vPos.y), 0.0); half = size.xz * 0.5; }
  let v = normalize(uniform.uView.xyz);
  let near = step(0.0, dot(n, v));
  let fres = pow(1.0 - abs(dot(n, v)), 2.0);
  let there = uniform.uCrack.y; let cracked = uniform.uCrack.x;
  // The block's own edges.
  let e = min(half.x - abs(uv.x), half.y - abs(uv.y));
  let rim = 1.0 - smoothstep(0.0, 1.8 * max(fwidth(e), 1e-4), e);
  let frost = aNoise(uv * 9.0 + uniform.uIce.w) * 0.6 + aNoise(uv * 27.0 - uniform.uIce.w) * 0.4;
  // Cracks: the borders of a scatter of cells, opening from the middle of the face out as it is struck.
  let vo = aVoro(uv * 3.4 + uniform.uIce.w * 7.0);
  let border = vo.y - vo.x;
  let reach = length(uv) / max(length(half), 0.05);
  let open = step(reach * 0.7 + vo.z * 0.3, cracked * 1.08) * step(0.001, cracked);
  let crack = (1.0 - smoothstep(0.0, 2.0 * max(fwidth(border), 1e-4), border)) * open;
  let halo = lg(border, 0.07) * open * 0.28;
  // Each piece the cracks cut off catches the light its own way.
  let facet = open * (vo.z - 0.5) * 0.22;
  let ice = mix(vec3f(0.30, 0.74, 0.80), vec3f(0.84, 0.97, 1.0), clamp(frost * 0.4 + fres * 0.45 + facet, 0.0, 1.0));
  let alpha = (0.16 + 0.24 * fres + 0.1 * frost + 0.1 * open) * there * mix(0.5, 1.0, near);
  let light = vec3f(0.9, 1.0, 1.0) * (rim * 0.75 + crack * 1.5 + halo + uniform.uCrack.z * (0.5 + 0.8 * crack)) * there * mix(0.45, 1.0, near);
  output.color = aOut(ice, alpha, light);
  return output;
}`;
/** What the ice takes out of what is seen through it. */
const ICE_ABSORB = /* wgsl */ `
${SHARED}
varying vPos: vec3f;
uniform uIce: vec4f;
uniform uCrack: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vec4f(aThrough(0.8 * uniform.uCrack.y), 1.0);
  return output;
}`;

type V3 = { x: number; y: number; z: number };
type F = Float32Array;
export interface AguaScene {
  /** Who is fighting, and on which side. */
  fighters(): readonly { id: string; party: boolean }[];
  /** A fighter's feet, and their model (for their size). */
  at(id: string): V3 | undefined;
  model(id: string): pc.Entity | undefined;
  /** Where the other foes stand, each with a cell of its own: this one stops halfway to theirs (`createFreaticaField`). */
  neighbours?(): V3[];
  /** Whether the foes stand where they will fight (not still walking in): a cell is placed round a foe only then. */
  settled?(): boolean;
  /** The floor's height at a place (Bajo cero's frost is laid on it). */
  ground?(x: number, z: number): number;
}
interface Tween { t0: number; dur: number; step(k: number): void; end?(): void }

const f4 = (a = 0, b = 0, c = 0, d = 0) => new Float32Array([a, b, c, d]);
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const SURFACE_GRID = 36, GAUGE_WIDTH = .36;

export function createFreaticaFx(app: pc.AppBase, effects: Effects, scene: AguaScene) {
  const device = app.graphicsDevice;
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const g0 = effects.gpu;
  if (g0) for (const [name, kind] of Object.entries(AGUA_KINDS)) if (!g0.get(name)) g0.define(name, kind);

  // ——— Meshes and materials: made once, shared by every sheet ———
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]); quad.update();
  const grid = new pc.Mesh(device);
  {
    const n = SURFACE_GRID, positions: number[] = [], indices: number[] = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) positions.push(i / n * 2 - 1, 0, j / n * 2 - 1);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + n + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
    grid.setPositions(new Float32Array(positions)); grid.setIndices(indices); grid.update();
  }
  const cube = new pc.Mesh(device);
  {
    const positions: number[] = [];
    for (const z of [-.5, .5]) for (const y of [-.5, .5]) for (const x of [-.5, .5]) positions.push(x, y, z);
    cube.setPositions(new Float32Array(positions));
    cube.setIndices([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]); cube.update();
  }
  const material = (name: string, uniqueName: string, fragmentWGSL: string, vertexWGSL = VERTEX, blend: number = pc.BLEND_PREMULTIPLIED) => {
    const m = new pc.ShaderMaterial({ uniqueName, attributes: { vertex_position: pc.SEMANTIC_POSITION }, vertexWGSL, fragmentWGSL });
    m.name = name; m.blendType = blend; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update();
    return m;
  };
  const materials = {
    surface: material('Superficie del agua', 'gerard-agua-surface', SURFACE, SURFACE_VERTEX),
    wall: material('Pared de la celda', 'gerard-agua-wall', WALL),
    floor: material('Fondo de la celda', 'gerard-agua-floor', FLOOR),
    gauge: material('Regla de la celda', 'gerard-agua-gauge', GAUGE),
    surfaceAbsorb: material('Lo que quita la superficie', 'gerard-agua-surface-absorb', SURFACE_ABSORB, SURFACE_VERTEX, pc.BLEND_MULTIPLICATIVE),
    wallAbsorb: material('Lo que quita una pared', 'gerard-agua-wall-absorb', WALL_ABSORB, VERTEX, pc.BLEND_MULTIPLICATIVE),
    ice: material('Hielo', 'gerard-agua-ice', ICE, ICE_VERTEX),
    iceAbsorb: material('Lo que quita el hielo', 'gerard-agua-ice-absorb', ICE_ABSORB, ICE_VERTEX, pc.BLEND_MULTIPLICATIVE),
  };

  // ——— What the sheets are drawn with: written here, read by every one of them ———
  const u = {
    cell: f4(1, 1, 2.5, 0), water: f4(0, 0, 0, 0), elec: f4(0, 0, 0, 0), slab: f4(0, 0, 0, 0),
    foes: [f4(), f4(), f4(), f4()], view: f4(0, 1, 0, 0), cast: f4(0, 0, 0, 0), gauge: f4(GAUGE_WIDTH, 1, 0, 0), ticks: f4(AGUA.ticks[0], AGUA.ticks[1], AGUA.ticks[2], 0),
  };
  const shared: Record<string, F> = { uCell: u.cell, uWater: u.water, uElec: u.elec, uSlab: u.slab, uFoe0: u.foes[0], uFoe1: u.foes[1], uFoe2: u.foes[2], uFoe3: u.foes[3], uView: u.view, uCast: u.cast };
  const root = new pc.Entity('Celda de Freática'); app.root.addChild(root); root.enabled = false;
  /**
   * `far`: how far behind the cell's middle it is drawn (m), so the sheets go down in their own
   * order whatever the camera: the floor, the far walls, what the water takes out, the surface, the
   * near walls, the gauge.
   */
  function sheet(name: string, mesh: pc.Mesh, mat: pc.Material, own: Record<string, F> = {}, parent = root, far: () => number = () => 0) {
    const e = new pc.Entity(name), instance = new pc.MeshInstance(mesh, mat);
    // Its shape is made in its shader, so its own box says nothing about where it is.
    instance.cull = false;
    instance.calculateSortDistance = (_m, at, towards) => (centre.x - at.x) * towards.x + (centre.y + 1 - at.y) * towards.y + (centre.z - at.z) * towards.z + far();
    for (const [key, values] of Object.entries({ ...shared, ...own })) instance.setParameter(key, values);
    e.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    parent.addChild(e); return e;
  }
  const sides = [0, 1, 2, 3].map(i => f4(1, 0, i * 3.7, i > 1 ? 1 : 0));
  const centre = new pc.Vec3();
  const walls = sides.map((side, i) => sheet(`Pared ${i + 1}`, quad, materials.wall, { uSide: side }, root, () => side[1] ? .1 : .5));
  const soaks = sides.map((side, i) => sheet(`Lo que quita la pared ${i + 1}`, quad, materials.wallAbsorb, { uSide: side }, root, () => .32));
  const floor = sheet('Fondo', quad, materials.floor, {}, root, () => .6);
  sheet('Lo que quita la superficie', grid, materials.surfaceAbsorb, {}, root, () => .4);
  sheet('Superficie', grid, materials.surface, {}, root, () => .2);
  // A block of ice for each foe the cell can hold: laid when the water freezes.
  const blocks = [0, 1, 2, 3].map(i => {
    const ice = f4(1, 1, 1, i * 5.3 + 1.7), crack = f4(0, 0, 0, 0);
    const soak = sheet(`Lo que quita el hielo ${i + 1}`, cube, materials.iceAbsorb, { uIce: ice, uCrack: crack }, root, () => .36);
    const e = sheet(`Hielo ${i + 1}`, cube, materials.ice, { uIce: ice, uCrack: crack }, root, () => .26);
    e.enabled = soak.enabled = false;
    return { e, soak, ice, crack, foe: '', cracked: 0, x: 0, z: 0, side: 1 };
  });
  // The gauge stands in the world, turned to the camera, at the corner nearest it.
  const gauge = sheet('Regla', quad, materials.gauge, { uGauge: u.gauge, uTicks: u.ticks }, app.root as pc.Entity);
  gauge.enabled = false;
  // One real light for the current: it flashes over the foes with each pulse.
  const lamp = new pc.Entity('Luz de la corriente'); lamp.addComponent('light', { type: 'omni', color: new pc.Color().fromString(AGUA.spark), intensity: 0, range: 4.5, castShadows: false }); app.root.addChild(lamp);

  // ——— The state ———
  let time = 0, on = false, marks = 0, level = 0, clock: number = AGUA.mark, rate = 1, moving = false, grey = false;
  let current = 0, pulseIn = 0, flash = 0, steamFlash = 0, breaking = false, hammer = 0, frozen = false, ice = 0, iceLeft = 0, breath = 0;
  /**
   * In a fight the clocks are the fight's, not the cell's (src/freatica-fight.ts): the top mark's seconds left, the current's,
   * and the marks of ice left. While driven the surface sinks to them and the cell never drops a mark by itself: the fight
   * lowers it when its water does.
   */
  let driven: { left?: number; current?: number; ice?: number } | undefined;
  const half = { w: 1.5, d: 1.5 }, fwd = new pc.Vec3(0, 0, 1), across = new pc.Vec3(1, 0, 0);
  let yaw = 0, height = 2.6;
  const ticks = [...AGUA.ticks], bands = [...AGUA.bands];
  const tweens: Tween[] = [];
  const tween = (dur: number, step: (k: number) => void, end?: () => void, delay = 0) => tweens.push({ t0: time + delay, dur, step, end });
  const after = (delay: number, run: () => void) => tween(.001, () => {}, run, delay);
  const bubbles = new Map<string, GpuEmitter>();
  let cloud: GpuEmitter | undefined, cloudLeft = 0;
  const full = (n: number) => n > 0 ? ticks[n - 1] + bands[n - 1] : 0;
  /** How tall the ice stands with `left` marks of it still to melt (it sinks all the while, not a mark at a time). */
  const iceTall = (left: number) => { const m = Math.min(3, Math.ceil(left)); return m <= 0 ? 0 : full(m - 1) + (full(m) - full(m - 1)) * (left - (m - 1)); };
  const camera = () => (app.root.findComponents('camera') as pc.CameraComponent[]).find(c => c.enabled && c.entity.enabled)?.entity;
  const foes = () => scene.fighters().filter(f => !f.party).map(f => ({ id: f.id, p: scene.at(f.id), model: scene.model(f.id) })).filter((f): f is { id: string; p: V3; model: pc.Entity } => !!f.p && !!f.model);
  const party = () => scene.fighters().filter(f => f.party).map(f => scene.at(f.id)).filter((p): p is V3 => !!p);
  const local = (p: V3) => { const x = p.x - centre.x, z = p.z - centre.z; return { x: x * across.x + z * across.z, z: x * fwd.x + z * fwd.z }; };
  const world = (x: number, y: number, z: number): V3 => ({ x: centre.x + across.x * x + fwd.x * z, y: centre.y + y, z: centre.z + across.z * x + fwd.z * z });

  /** Where the cell stands: round the foes, squared to the line from the party to them, as tall as the tallest needs. */
  function place() {
    const them = foes(), us = party();
    if (!them.length) return false;
    const mid = (list: V3[]) => list.reduce((s: pc.Vec3, p) => s.add(new pc.Vec3(p.x, p.y, p.z)), new pc.Vec3()).mulScalar(1 / list.length);
    const c = mid(them.map(f => f.p)), from = us.length ? mid(us) : c.clone().sub(new pc.Vec3(3, 0, 0));
    fwd.copy(c).sub(from); fwd.y = 0; if (fwd.length() < 1e-3) fwd.set(1, 0, 0); fwd.normalize();
    across.cross(pc.Vec3.UP, fwd).normalize();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, tallest = 0, floorY = Infinity;
    centre.copy(c);
    for (const f of them) {
      const body = bodyOf(f.model, f.p), q = local(f.p);
      minX = Math.min(minX, q.x - body.radius); maxX = Math.max(maxX, q.x + body.radius);
      minZ = Math.min(minZ, q.z - body.radius); maxZ = Math.max(maxZ, q.z + body.radius);
      tallest = Math.max(tallest, body.height); floorY = Math.min(floorY, f.p.y);
    }
    minX -= AGUA.margin; maxX += AGUA.margin; minZ -= AGUA.margin; maxZ += AGUA.margin;
    // Two foes side by side never share a cell, nor stand one inside the other: where a neighbour's cell (as big as this
    // one) would reach into this one, this one stops halfway to it, on the side it stands.
    const wide = (maxX - minX) / 2, deep = (maxZ - minZ) / 2;
    for (const n of scene.neighbours?.() ?? []) {
      const q = local(n);
      if (q.x - wide >= maxX || q.x + wide <= minX || q.z - deep >= maxZ || q.z + deep <= minZ) continue;
      if (Math.abs(q.x) >= Math.abs(q.z)) { if (q.x > 0) maxX = Math.max(Math.min(maxX, q.x / 2 - AGUA.gap), minX + .2); else minX = Math.min(Math.max(minX, q.x / 2 + AGUA.gap), maxX - .2); }
      else if (q.z > 0) maxZ = Math.max(Math.min(maxZ, q.z / 2 - AGUA.gap), minZ + .2); else minZ = Math.min(Math.max(minZ, q.z / 2 + AGUA.gap), maxZ - .2);
    }
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
    centre.add(across.clone().mulScalar(mx)).add(fwd.clone().mulScalar(mz)); centre.y = floorY;
    half.w = (maxX - minX) / 2; half.d = (maxZ - minZ) / 2;
    // The third mark stands a hand over the tallest head, and the cell only a little over that (`markHeights`).
    const marksAt = markHeights(tallest);
    marksAt.ticks.forEach((t, i) => { ticks[i] = t; }); marksAt.bands.forEach((b, i) => { bands[i] = b; });
    height = full(3) + AGUA.headroom;
    yaw = Math.atan2(fwd.x, fwd.z) * pc.math.RAD_TO_DEG;
    root.setPosition(centre); root.setEulerAngles(0, yaw, 0);
    u.cell[0] = half.w; u.cell[1] = half.d; u.cell[2] = height;
    u.ticks[0] = ticks[0]; u.ticks[1] = ticks[1]; u.ticks[2] = ticks[2];
    // Walls: the two across the line to the party, then the two along it.
    const set = (i: number, x: number, z: number, turn: number, len: number) => { for (const e of [walls[i], soaks[i]]) { e.setLocalPosition(x, height / 2, z); e.setLocalEulerAngles(0, turn, 0); e.setLocalScale(len, height / 2, 1); } sides[i][0] = len; };
    set(0, 0, -half.d, 0, half.w); set(1, 0, half.d, 0, half.w);
    set(2, -half.w, 0, 90, half.d); set(3, half.w, 0, 90, half.d);
    floor.setLocalPosition(0, .014, 0); floor.setLocalEulerAngles(-90, 0, 0); floor.setLocalScale(half.w + 3.2, half.d + 3.2, 1);
    return true;
  }
  /** Once a frame: which walls face the camera, where the gauge stands, where each foe is. */
  function aim() {
    const cam = camera(); if (!cam) return;
    const to = cam.forward.clone().mulScalar(-1);
    u.view[0] = to.dot(across); u.view[1] = to.y; u.view[2] = to.dot(fwd);
    const normals: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    normals.forEach(([x, z], i) => { sides[i][1] = x * u.view[0] + z * u.view[2] > .02 ? 1 : 0; });
    // The gauge: at the corner nearest the camera, standing out from the cell on the party's side.
    let best = -Infinity, cx = 1, cz = -1;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const score = x * half.w * u.view[0] + z * half.d * u.view[2] - z * half.d * .6;
      if (score > best) { best = score; cx = x; cz = z; }
    }
    const right = cam.right.clone(); right.y = 0; if (right.length() < 1e-4) right.set(1, 0, 0); right.normalize();
    const corner = world(cx * half.w, 0, cz * half.d), out = (corner.x - centre.x) * right.x + (corner.z - centre.z) * right.z >= 0 ? 1 : -1;
    const basis = new pc.Mat4(), z = new pc.Vec3().cross(right, pc.Vec3.UP);
    basis.data.set([right.x, right.y, right.z, 0, 0, 1, 0, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]);
    gauge.setRotation(new pc.Quat().setFromMat4(basis));
    gauge.setPosition(corner.x + right.x * out * GAUGE_WIDTH / 2, centre.y + height / 2, corner.z + right.z * out * GAUGE_WIDTH / 2);
    gauge.setLocalScale(GAUGE_WIDTH / 2, height / 2, 1);
    u.gauge[1] = out;
    const them = foes();
    u.foes.forEach((f, i) => {
      const foe = them[i];
      if (!foe) { f[3] = 0; return; }
      const q = local(foe.p), body = bodyOf(foe.model, foe.p);
      // No ring round a foe the water has closed over.
      f[0] = q.x; f[1] = q.z; f[2] = body.radius; f[3] = level < body.height ? 1 : 0;
    });
  }
  function show(yes: boolean) { on = yes; root.enabled = yes; gauge.enabled = yes; if (!yes) { lamp.light!.intensity = 0; stopBubbles(); cloud?.remove(); cloud = undefined; } }
  function stopBubbles() { bubbles.forEach(b => b.remove()); bubbles.clear(); }
  /** Sunk: a string of bubbles from each foe to the surface. Not sunk: none. */
  function sink() {
    const g = gpu();
    if (!g || marks < 3 || !on) { stopBubbles(); return; }
    for (const f of foes()) {
      if (bubbles.has(f.id)) continue;
      const body = bodyOf(f.model, f.p), top = level - f.p.y;
      bubbles.set(f.id, g.emitter('agua-burbuja', { at: { x: f.p.x, y: f.p.y + body.height * .8, z: f.p.z }, rate: 9, spread: body.radius * .5, speed: .12, up: .5, life: [.35, Math.max(.5, (top - body.height * .8) / .7 + .45)] }));
    }
  }
  /** The surface moves to `to` metres over `seconds`, welling up in the middle if it rises. */
  function move(to: number, seconds: number, swell = 0, end?: () => void) {
    const from = level; moving = true;
    tween(seconds, k => { level = from + (to - from) * ease(k); u.water[3] = swell * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * .3); }, () => { level = to; u.water[3] = 0; moving = false; end?.(); });
  }
  function splash(count: number, speed: number) {
    const g = gpu(); if (!g) return;
    g.burst('agua-gota', { at: world(0, level + .05, 0), count, spread: Math.min(half.w, half.d) * .5, speed, up: speed * 1.6, life: [.5, .9], size: .9 });
  }
  function upwell(count: number) {
    const g = gpu(); if (!g) return;
    for (let i = 0; i < 4; i++) g.burst('agua-burbuja', { at: world((Math.random() - .5) * half.w * 1.4, .05, (Math.random() - .5) * half.d * 1.4), count: Math.round(count / 4), spread: .35, speed: .2, up: .6, life: [.3, .5 + level * .9] });
  }

  const caster = (id?: string) => { const us = scene.fighters().filter(f => f.party), who = us.find(f => f.id === id) ?? us[0]; return who && scene.at(who.id); };
  const aimed = (id?: string) => { const them = foes(); return them.find(f => f.id === id) ?? them[0]; };
  /** A line of light drawn from `a` to `b` over `seconds`, a stretch at a time. */
  function trace(a: V3, b: V3, seconds: number, kind = 'agua-traza', colour?: string, thick = 1) {
    const steps = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / .4));
    const at = (k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
    for (let i = 0; i < steps; i++) after(seconds * i / steps, () => gpu()?.burst(kind, { at: at(i / steps), to: at((i + 1) / steps), shape: 'line', count: Math.round(22 * thick), spread: .02 * thick, speed: .1 * thick, life: [.3, .65], ...(colour ? { colour } : {}) }));
  }
  /** One blow of a water hammer: the cell flashes white from its walls in and every foe is struck through the water. */
  function blow() {
    hammer = 1;
    const g = gpu(); if (!g) return;
    for (const f of foes()) {
      const body = bodyOf(f.model, f.p);
      g.burst('agua-gota', { at: { x: f.p.x, y: f.p.y + Math.min(level, body.height) * .6, z: f.p.z }, count: 46, shape: 'ring', spread: body.radius, outward: 2.4, up: 1.3, speed: .9, life: [.3, .7], size: 1.1 });
    }
    splash(26, 1.5);
  }
  /**
   * What each of the ánima's skills looks like on the cell (docs/animas/freatica/README.md § Look
   * and interface, *How each skill shows*). `from` is who casts (the first of the party otherwise),
   * `target` the foe struck. Only the look.
   */
  const casts = {
    /** Recarga: the tape runs out along the floor to the foe, water wells up through it, and the level rises a mark. */
    recarga(from?: string, target?: string) {
      const a = caster(from), foe = aimed(target); if (!a || !foe) return false;
      trace({ x: a.x, y: a.y + .04, z: a.z }, { x: foe.p.x, y: foe.p.y + .04, z: foe.p.z }, .28);
      after(.3, () => {
        const g = gpu(), body = bodyOf(foe.model, foe.p); if (!g) return;
        g.burst('agua-gota', { at: { x: foe.p.x, y: foe.p.y + .05, z: foe.p.z }, count: 70, shape: 'ring', spread: body.radius * .8, outward: .5, up: 3.4, speed: .5, life: [.4, .8], size: 1.1 });
        g.burst('agua-burbuja', { at: { x: foe.p.x, y: foe.p.y + .1, z: foe.p.z }, count: 80, spread: body.radius * .7, speed: .3, up: 1.7, life: [.4, 1] });
      });
      after(.42, () => api.raise(1));
      return true;
    },
    /** Sondeo eléctrico: a bolt from the caster's hands to the foe, then down it into the water, which keeps the current twice as long. */
    sondeo(from?: string, target?: string) {
      const a = caster(from), foe = aimed(target); if (!a || !foe) return false;
      const g = gpu(), body = bodyOf(foe.model, foe.p), kind = g?.get('spark') ? 'spark' : 'agua-traza';
      const chest = { x: foe.p.x, y: foe.p.y + body.height * .6, z: foe.p.z };
      trace({ x: a.x, y: a.y + 1.05, z: a.z }, chest, .1, kind, AGUA.spark, 1.6);
      after(.1, () => g?.burst(kind, { at: chest, count: 80, spread: body.radius * .6, speed: 2.6, up: .4, life: [.12, .35], colour: AGUA.spark, light: { intensity: 2.6, range: 4, colour: AGUA.spark } }));
      if (on && marks) { after(.12, () => trace(chest, { x: foe.p.x, y: centre.y + Math.min(level, chest.y - centre.y), z: foe.p.z }, .08, kind, AGUA.spark)); after(.2, () => api.bolt(AGUA.current * 2)); }
      return true;
    },
    /** Bombeo: the water gives a mark up, and it comes up round each of the party as green beads. */
    bombeo() {
      const us = party(), had = on && marks > 0 && !frozen;
      if (had) api.lower();
      us.forEach((p, i) => {
        if (had || (on && marks)) trace(world(0, .04, -half.d), { x: p.x, y: p.y + .04, z: p.z }, .3);
        // The water given up arcs over to them as a stream of real water (a fluid) and lands at their feet.
        if (had) {
          const from = world(0, Math.max(.3, level), -half.d * .6), T = .55 + i * .08;
          gpu()?.burst('agua-ola', { at: from, count: 180, spread: .12, velocity: { x: (p.x - from.x) / T, y: (p.y - from.y) / T + 4.5 * T, z: (p.z - from.z) / T }, speed: .25, life: [1.2, 1.6], colour: AGUA.green });
        }
        after(.3 + i * .1, () => {
          const g = gpu(); if (!g) return;
          g.burst('agua-cura', { at: { x: p.x, y: p.y + .1, z: p.z }, count: 70, shape: 'ring', spread: .36, up: 1.2, speed: .25, around: .9, life: [.7, 1.4] });
          g.burst('agua-traza', { at: { x: p.x, y: p.y + .04, z: p.z }, count: 40, shape: 'ring', spread: .42, speed: .05, life: [.5, .9] });
        });
      });
      return true;
    },
    /** Riada: a wave crosses the cell from the party's side, and the level rises `n` marks behind it. */
    riada(n = 1) {
      const was = on;
      if (!api.raise(n)) return false;
      after(was ? .05 : .5, () => {
        const reach = half.d + .4, struck = new Set<string>();
        // The surge itself, a fluid: a low wall of water across the cell's near edge, its top layers
        // faster, that runs at the foe, breaks on it and spreads (§ The fluid in src/fight-particles.ts).
        const g = gpu(), at = (x: number, z: number, y: number) => ({ x: centre.x + across.x * x + fwd.x * z, y: centre.y + y, z: centre.z + across.z * x + fwd.z * z });
        if (g) for (let j = 0; j < 6; j++) {
          const k = j / 5, y = .08 + k * Math.max(.5, level + .35), v = 2.2 + 1.6 * k;
          for (const back of [0, .28]) g.burst('agua-ola', {
            at: at(-half.w, -reach - back, y), to: at(half.w, -reach - back, y), shape: 'line', count: Math.round(half.w * 2 * 55), spread: .1,
            velocity: { x: fwd.x * v, y: .4 + .9 * k, z: fwd.z * v }, speed: .2, life: [1.6, 2.1], colour: k < .35 ? AGUA.blue : k < .8 ? AGUA.green : AGUA.foam,
          });
        }
        tween(1.05, k => {
          const z = -reach + 2 * reach * k;
          u.cast[2] = z; u.cast[3] = Math.min(1, Math.sin(Math.PI * k) * 2.2) * 1.2;
          for (const f of foes()) {
            if (struck.has(f.id) || local(f.p).z > z) continue;
            struck.add(f.id);
            const body = bodyOf(f.model, f.p);
            gpu()?.burst('agua-gota', { at: { x: f.p.x, y: centre.y + level, z: f.p.z }, count: 60, spread: body.radius, velocity: { x: fwd.x * 1.6, y: 0, z: fwd.z * 1.6 }, speed: .9, up: 2.2, life: [.4, .8], size: 1.1 });
          }
        }, () => { u.cast[3] = 0; });
      });
      return true;
    },
    /** Golpe de ariete: the water is spent in blows, one a mark, each a white flash through the cell as the level slams down. */
    ariete() {
      if (!on || !marks || breaking || frozen) return false;
      const blows = marks;
      for (let i = 0; i < blows; i++) after(i * .42, () => {
        blow();
        // The mark spent jumps out of the cell as a body of water and spills over the floor (a fluid).
        gpu()?.burst('agua-ola', { at: world(0, Math.max(.15, level), 0), count: Math.round(260 * Math.max(1, half.w * half.d)), shape: 'ring', spread: Math.min(half.w, half.d) * .6, outward: 2.2, up: 2.4, speed: .5, life: [1.3, 1.8], colour: i % 2 ? AGUA.green : AGUA.blue });
        u.ticks[3] = level; marks--; clock = AGUA.mark; stopBubbles();
        move(full(marks), .12, 0, () => { if (!marks) show(false); });
      });
      return true;
    },
    /**
     * Bajo cero: the water freezes round every foe in it, to where it stood. The ice then melts on
     * the clock, `AGUA.ice` seconds a mark (a flame takes a mark off at once, `melt`), and cracks
     * with each blow from outside (`strike`) until it breaks.
     */
    bajoCero() {
      if (!on || !marks || breaking || frozen || moving) return false;
      hammer = 1; current = 0; stopBubbles();
      after(.12, () => {
        frozen = true; clock = AGUA.mark; level = full(marks); iceLeft = marks; breath = 0; u.ticks[3] = 0;
        const them = foes();
        blocks.forEach((b, i) => {
          const f = them[i];
          b.e.enabled = b.soak.enabled = !!f; b.foe = f?.id ?? ''; b.cracked = 0; b.crack[0] = 0; b.crack[1] = 0; b.crack[2] = 1;
          if (!f) return;
          const q = local(f.p), body = bodyOf(f.model, f.p);
          b.x = q.x; b.z = q.z; b.side = Math.max(body.radius * 2 + .1, Math.min(half.w, half.d) * 2 - .08);
          tween(.3, k => { b.crack[1] = k; });
          gpu()?.burst('agua-frio', { at: { x: f.p.x, y: f.p.y + .2, z: f.p.z }, count: 50, shape: 'ring', spread: body.radius + .2, outward: .5, speed: .2, life: [1, 2] });
        });
      });
      return true;
    },
  };
  const alive = () => blocks.filter(b => b.e.enabled && b.foe);
  /** The ice is gone, and with it the water it was. */
  function thawed() { frozen = false; iceLeft = 0; u.ticks[3] = 0; for (const b of blocks) { b.e.enabled = b.soak.enabled = false; b.foe = ''; } marks = 0; level = 0; show(false); }

  const api = {
    /** The water rises `n` marks (three at most), the cell drawing itself in first if it is not there. */
    raise(n = 1) {
      if (breaking || frozen) return false;
      if (!on) {
        if (!place()) return false;
        marks = 0; level = 0; u.water[2] = 0; u.slab[2] = 0; u.ticks[3] = 0; current = 0; show(true); aim();
        tween(.5, k => { u.water[2] = k; });
        after(.38, () => api.raise(n));
        return true;
      }
      marks = Math.min(3, marks + n); clock = AGUA.mark; u.ticks[3] = 0;
      upwell(40 + 30 * marks);
      move(full(marks), .6, 1, () => { splash(10 + 8 * marks, .7); sink(); });
      return true;
    },
    /** Straight to `n` marks, with no rising (for a still picture). */
    set(n: number) {
      if (!on) { if (!place()) return false; show(true); aim(); }
      tweens.length = 0; moving = false; breaking = false; frozen = false; for (const b of blocks) { b.e.enabled = b.soak.enabled = false; b.foe = ''; }
      marks = Math.max(0, Math.min(3, n)); level = full(marks); clock = AGUA.mark; u.water[2] = 1; u.water[3] = 0; u.slab[2] = 0; u.ticks[3] = 0;
      if (!marks) show(false); else sink();
      return true;
    },
    /** The water gives a mark up to something that spends it: it sinks to the mark below, with no steam. */
    lower() {
      if (!on || !marks || moving || frozen) return false;
      marks--; clock = AGUA.mark; u.ticks[3] = level;
      stopBubbles();
      move(full(marks), .6, 0, () => { if (!marks) show(false); });
      return true;
    },
    /**
     * Electrólisis: the current splits the water and it is gone, every mark of it, sinking over `seconds` while it goes
     * (the bubbles it gives off are the dual's own, src/duo-fx/electrolisis.ts).
     */
    drain(seconds = 1.2) {
      if (!on || !marks || frozen || breaking) return false;
      marks = 0; current = 0; clock = AGUA.mark; u.ticks[3] = level; stopBubbles();
      move(0, seconds, 0, () => { if (!marks) show(false); });
      return true;
    },
    /** Electricity: the water keeps the current for `seconds`, pulsing every two. */
    bolt(seconds: number = AGUA.current) {
      if (!on || !marks) return false;
      current = seconds; pulseIn = AGUA.pulse; flash = 1.4;
      gpu()?.burst(gpu()!.get('spark') ? 'spark' : 'agua-gota', { at: world(0, level + .05, 0), count: 90, spread: Math.min(half.w, half.d) * .8, speed: 2.4, up: 1.2, life: [.15, .4], colour: AGUA.spark, light: { intensity: 2.4, range: 4, colour: AGUA.spark } });
      return true;
    },
    /** Fire: the top mark goes up as steam, which stays over the foes for `seconds`. */
    steam(seconds = 10) {
      const g = gpu();
      if (!on || !marks || moving) return false;
      if (frozen) return false;
      const top = level, was = marks;
      marks--; clock = AGUA.mark; u.ticks[3] = top; stopBubbles();
      u.slab[0] = full(marks); u.slab[1] = top + .03; steamFlash = 1;
      if (g) {
        const area = half.w * half.d;
        for (let i = 0; i < 6; i++) g.burst('agua-vapor', { at: world((Math.random() - .5) * half.w * 1.5, (u.slab[0] + top) / 2, (Math.random() - .5) * half.d * 1.5), count: Math.round(70 * area * (.5 + was * .25)), spread: .55, up: 1.6, speed: 1.1, life: [.9, 1.9] });
        cloud?.remove();
        cloud = g.emitter('agua-nube', { at: world(0, ticks[2] - .25, 0), rate: 16 * area * (.5 + was * .3), spread: Math.max(half.w, half.d) * .75, speed: .16, life: [2.2, 3.2] });
        cloudLeft = seconds;
      }
      move(full(marks), .16, 0, () => { if (!marks) show(false); });
      return true;
    },
    /** A skill's own look: `recarga`, `sondeo`, `bombeo`, `riada`, `ariete`, `bajoCero`. */
    cast: casts,
    /** Frozen: a flame on the ice. It does not crack it: `n` marks of it melt at once, in steam. With the last it is gone. */
    melt(n = 1) {
      if (!frozen) return false;
      u.ticks[3] = level;
      let last = 0;
      tween(.5, k => { const e = ease(k); iceLeft -= n * (e - last); last = e; });
      for (const b of alive()) {
        gpu()?.burst('agua-vapor', { at: world(b.x, level, b.z), count: 60, spread: b.side * .5, up: 1.4, speed: .9, life: [.8, 1.6] });
        gpu()?.burst('agua-gota', { at: world(b.x, level * .8, b.z), count: 40, shape: 'ring', spread: b.side * .55, outward: .4, speed: .3, life: [.4, .8] });
      }
      return true;
    },
    /**
     * Frozen: a blow from outside on the foe `id` (the first still in its ice otherwise). It counts
     * `blows` of the `AGUA.blows` the ice holds (two for a hard one), and cracked through it breaks.
     */
    strike(id?: string, blows = 1) {
      const share = blows / AGUA.blows;
      if (!frozen) return false;
      const b = alive().find(x => x.foe === id) ?? alive()[0]; if (!b) return false;
      const from = b.crack[0], to = Math.min(1, b.cracked + share), g = gpu(), at = world(b.x, Math.max(.15, level * .55), b.z);
      b.cracked = to; b.crack[2] = 1;
      tween(.16, k => { b.crack[0] = from + (to - from) * ease(k); });
      if (to < .999) { g?.burst('agua-hielo', { at, count: Math.round(10 + 120 * share + 20 * to), spread: b.side * .45, speed: 1.6, up: 1.2, life: [.4, .8], size: .6 }); return true; }
      // It breaks: the block goes at once, in shards and a white flash.
      after(.1, () => {
        b.e.enabled = b.soak.enabled = false; b.foe = '';
        // The more ice is left, the harder it breaks.
        const left = Math.max(0, iceLeft);
        g?.burst('agua-hielo', { at, count: Math.round(30 + 40 * left), spread: b.side * .5, speed: 2.4 + .6 * left, up: 2.4, life: [.6, 1.3], size: .9, light: { intensity: 1.2 + .6 * left, range: 5, colour: '#dff8ff' } });
        g?.burst('agua-frio', { at, count: 60, spread: b.side * .6, speed: 1.2, life: [.8, 1.6] });
        if (!alive().length) thawed();
      });
      return true;
    },
    /** Whether the water is ice, how many marks of it are left to melt (it goes down all the while), and how cracked each frozen foe's is (0–1). */
    get frozen() { return frozen; },
    get ice() { return frozen ? Math.max(0, iceLeft) : 0; },
    get cracks() { return alive().map(b => ({ foe: b.foe, cracked: b.cracked })); },
    /** Whoever held it has fallen: the edges go out and the water runs out over the floor. */
    break() {
      if (!on || breaking) return false;
      breaking = true; stopBubbles(); current = 0; if (frozen) { frozen = false; for (const b of blocks) { b.e.enabled = b.soak.enabled = false; b.foe = ''; } }
      const from = level;
      splash(50, 1.6);
      const g = gpu();
      if (g) g.burst('agua-gota', { at: world(0, .1, 0), count: 140, shape: 'ring', spread: Math.max(half.w, half.d), outward: 2.6, up: 1.1, speed: .8, life: [.5, 1], size: .9 });
      tween(.8, k => { u.slab[2] = k; level = from * (1 - ease(k)); }, () => { breaking = false; marks = 0; level = 0; show(false); });
      return true;
    },
    /** Grey edges and gauge (the ánima's first round) or their own. */
    setGrey(yes: boolean) { grey = yes; },
    get grey() { return grey; },
    /** Development: the clock runs this many times as fast (to watch a mark drain). */
    setRate(k: number) { rate = k; },
    /** A fight drives this cell's clocks from its own state (`driven`), or lets them run by themselves again (`undefined`). */
    drive(d: { left?: number; current?: number; ice?: number } | undefined) { driven = d; },
    get marks() { return marks; },
    get level() { return level; },
    /** How much of the top mark is left (0–1). */
    get left() { return marks ? clock / AGUA.mark : 0; },
    get current() { return current; },
    get on() { return on; },
    /** Nothing left: no cell, no water, no steam. */
    clear() { tweens.length = 0; moving = false; breaking = false; marks = 0; level = 0; current = 0; flash = 0; steamFlash = 0; cloudLeft = 0; hammer = 0; frozen = false; ice = 0; iceLeft = 0; u.cast[3] = 0; for (const b of blocks) { b.e.enabled = b.soak.enabled = false; b.foe = ''; } show(false); },
    destroy() {
      api.clear(); app.off('update', update);
      root.destroy(); gauge.destroy(); lamp.destroy(); cube.destroy();
      for (const m of Object.values(materials)) m.destroy();
      quad.destroy(); grid.destroy();
    },
  };

  function update(dt: number) {
    time += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = (time - tw.t0) / tw.dur;
      if (k < 0) continue;
      tw.step(Math.min(1, k));
      if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.end?.(); }
    }
    if (cloud && (cloudLeft -= dt) <= 0) { cloud.remove(); cloud = undefined; }
    if (!on) return;
    aim();
    // The surface is the clock: within its mark it sinks from full to the mark's own tick, then drops to the one below.
    if (frozen) {
      // Ice melts on the clock: it stands where the water stood and sinks all the while, a mark every `AGUA.ice` seconds.
      clock = AGUA.mark;
      if (driven?.ice !== undefined) iceLeft = driven.ice; else iceLeft -= dt * rate / AGUA.ice;
      marks = Math.max(0, Math.min(3, Math.ceil(iceLeft))); level = iceTall(iceLeft);
      const drip = (breath -= dt) <= 0; if (drip) breath = .45;
      if (iceLeft <= 0) thawed();
      for (const b of alive()) {
        // It gives off cold from its top and runs with water down its faces.
        if (drip) {
          gpu()?.burst('agua-frio', { at: world(b.x, level, b.z), count: 3, spread: b.side * .45, speed: .1, life: [.8, 1.5] });
          gpu()?.burst('agua-gota', { at: world(b.x, level * .9, b.z), count: 4, shape: 'ring', spread: b.side * .52, outward: .1, speed: .1, life: [.4, .7], size: .8 });
        }
        const tall = Math.max(.03, level);
        b.ice[0] = b.side; b.ice[1] = tall; b.ice[2] = b.side;
        for (const e of [b.e, b.soak]) { e.setLocalPosition(b.x, tall / 2, b.z); e.setLocalScale(b.side, tall, b.side); }
        b.crack[2] = Math.max(0, b.crack[2] - dt * 3.4);
      }
    } else if (marks && !moving && !breaking) {
      if (driven?.left !== undefined) clock = Math.min(AGUA.mark, driven.left); else clock -= dt * rate;
      level = ticks[marks - 1] + bands[marks - 1] * Math.max(0, clock / AGUA.mark);
      if (clock <= 0 && !driven) {
        marks--; clock = AGUA.mark; u.ticks[3] = 0;
        stopBubbles();
        move(full(marks), .5, 0, () => { if (!marks) show(false); });
      }
    }
    if (driven?.current !== undefined && current > 0) current = driven.current;
    if (current > 0) {
      current -= dt;
      if ((pulseIn -= dt) <= 0 && current > 0) {
        pulseIn += AGUA.pulse; flash = 1;
        const g = gpu();
        if (g?.get('spark')) for (const f of foes()) g.burst('spark', { at: { x: f.p.x, y: centre.y + Math.min(level, 1.2), z: f.p.z }, count: 16 + 8 * marks, spread: .25, speed: 1.6, up: .8, life: [.12, .3], colour: AGUA.spark });
      }
      if (current <= 0 || !marks) current = 0;
    }
    flash = Math.max(0, flash - dt * 3.2); steamFlash = Math.max(0, steamFlash - dt * 3.4); hammer = Math.max(0, hammer - dt * 3.6);
    ice += ((frozen ? 1 : 0) - ice) * Math.min(1, dt * 9);
    u.cast[0] = hammer; u.cast[1] = ice;
    u.cell[3] = time; u.water[0] = level;
    // How deep it reads: green at the first mark, blue at the third.
    u.water[1] = Math.min(1, Math.max(0, (level - ticks[0]) / Math.max(.1, ticks[2] - ticks[0])));
    u.elec[0] = current > 0 ? Math.min(1, current / .6) * (.55 + .15 * marks) : 0; u.elec[1] = flash; u.elec[2] = steamFlash; u.elec[3] = grey ? 1 : 0;
    u.slab[3] = marks && !moving && (frozen ? iceLeft * AGUA.ice : clock) / rate < 3 ? 1 : 0;
    u.gauge[2] = marks;
    lamp.setPosition(centre.x, centre.y + Math.min(level, 1.4) + .3, centre.z);
    lamp.light!.intensity = flash * (1.2 + .5 * marks);
    if (marks === 3 && !moving) sink();
  }
  app.on('update', update);
  return api;
}
export type FreaticaFx = ReturnType<typeof createFreaticaFx>;

/**
 * The water of a whole fight: a cell for each foe, with its own level, clock, current and ice.
 * A foe is named by its id; with none, the first. What an element does between cells is here:
 * a bolt on a foe with water runs through every foe that has some (Conducción), and *Bajo cero*
 * freezes every foe with water, if one of them has it at the third mark.
 */
export function createFreaticaField(app: pc.AppBase, effects: Effects, scene: AguaScene) {
  const cells = new Map<string, FreaticaFx>();
  let grey = false, rate = 1;
  const foes = () => scene.fighters().filter(f => !f.party).map(f => f.id);
  const cell = (id: string) => {
    let c = cells.get(id);
    if (!c) {
      c = createFreaticaFx(app, effects, {
        fighters: () => scene.fighters().filter(f => f.party || f.id === id), at: scene.at, model: scene.model,
        neighbours: () => foes().filter(other => other !== id).map(other => scene.at(other)).filter((p): p is V3 => !!p),
      });
      c.setGrey(grey); c.setRate(rate); cells.set(id, c);
    }
    return c;
  };
  const one = (id?: string) => { const all = foes(), pick = id && all.includes(id) ? id : all[0]; return pick ? cell(pick) : undefined; };
  const every = () => foes().map(cell);
  const wet = () => every().filter(c => c.on && c.marks > 0);
  const timers: ReturnType<typeof setTimeout>[] = [];
  return {
    /** The foes that can have water, in the fight's order. */
    foes,
    /** A foe's own cell. */
    cell: one,
    raise(id?: string, n = 1) { return one(id)?.raise(n) ?? false; },
    /** Straight to `n` marks: the foe `id`, or every foe. */
    set(n: number, id?: string) { for (const c of id ? [one(id)] : every()) c?.set(n); },
    lower(id?: string) { return one(id)?.lower() ?? false; },
    /** Electricity on a foe with water: it runs through every foe that has some, and stays in each one's. */
    bolt(id?: string, seconds?: number) {
      const struck = one(id);
      if (!struck?.on || !struck.marks) return false;
      wet().forEach(c => c.bolt(seconds));
      return true;
    },
    /** Fire on a foe with water: its top mark goes up as steam. */
    steam(id?: string, seconds?: number) { return one(id)?.steam(seconds) ?? false; },
    /** Whoever held them has fallen: every cell breaks. */
    break() { return every().map(c => c.break()).some(Boolean); },
    cast: {
      recarga(target?: string, from?: string) { return one(target)?.cast.recarga(from) ?? false; },
      sondeo(target?: string, from?: string) {
        const struck = one(target); if (!struck) return false;
        const others = struck.on && struck.marks ? wet().filter(c => c !== struck) : [];
        timers.push(setTimeout(() => others.forEach(c => c.bolt(AGUA.current * 2)), 200));
        return struck.cast.sondeo(from);
      },
      /** The mark comes off whoever has the most water. */
      bombeo() { return (wet().sort((a, b) => b.marks - a.marks)[0] ?? every()[0])?.cast.bombeo() ?? false; },
      riada() { return every().map(c => c.cast.riada(1)).some(Boolean); },
      ariete() { return wet().map(c => c.cast.ariete()).some(Boolean); },
      /** Only with a foe at the third mark; then every foe with water freezes, for longer the more marks it has. */
      bajoCero() {
        const all = wet();
        if (!all.some(c => c.marks === 3)) return false;
        return all.map(c => c.cast.bajoCero()).some(Boolean);
      },
    },
    /** Frozen: a flame on the foe `id`'s ice (the first still frozen otherwise) melts `n` marks of it at once. */
    melt(id?: string, n = 1) { const named = id ? one(id) : undefined; return (named?.frozen ? named : every().find(c => c.frozen))?.melt(n) ?? false; },
    /** Frozen: a blow from outside on the foe `id`'s ice, or on the first still frozen. It counts `blows` of the `AGUA.blows` it holds. */
    strike(id?: string, blows?: number) { const named = id ? one(id) : undefined; return (named?.frozen ? named : every().find(c => c.frozen))?.strike(undefined, blows) ?? false; },
    /** Frozen: a flurry on that ice, `strikes` little blows `gap` seconds apart, each counting one: eight break a whole ice. */
    flurry(id?: string, strikes = 4, gap = .11) {
      const named = id ? one(id) : undefined, c = named?.frozen ? named : every().find(x => x.frozen); if (!c) return false;
      for (let i = 0; i < strikes; i++) timers.push(setTimeout(() => c.strike(), i * gap * 1000));
      return true;
    },
    setGrey(yes: boolean) { grey = yes; cells.forEach(c => c.setGrey(yes)); },
    get grey() { return grey; },
    setRate(k: number) { rate = k; cells.forEach(c => c.setRate(k)); },
    /** Each foe's water, for a readout. */
    state() { return foes().map(id => { const c = cells.get(id); return { id, marks: c?.on ? c.marks : 0, left: c?.left ?? 0, current: c?.current ?? 0, frozen: !!c?.frozen, ice: c?.ice ?? 0, cracked: c?.cracks[0]?.cracked ?? 0 }; }); },
    clear() { timers.forEach(clearTimeout); timers.length = 0; cells.forEach(c => c.clear()); },
    destroy() { timers.forEach(clearTimeout); cells.forEach(c => c.destroy()); cells.clear(); },
  };
}
export type FreaticaField = ReturnType<typeof createFreaticaField>;
