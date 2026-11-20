import * as pc from 'playcanvas';

/**
 * The light Sincopante's ecos are drawn with (docs/animas/sincopante/README.md § Look and
 * interface): four sheets of light, each a flat square with its picture worked out in the shader
 * and added on top of the fight, never hiding what is behind it. `src/eco-fx.ts` places, turns and
 * times them.
 *
 * - **Interferencia**, the eco itself and the ánima's mark: a voice and its echo. Rings of nácar
 *   round a bead, each ring doubled by a copy a little apart, fine ripples running out from both,
 *   and pale gold wherever the two agree. At *f*, two wings: fans of fine doubled arcs curling up.
 * - **Cimática**, what a note does to what it touches: the figure sand draws on a struck plate,
 *   with grains gathered on its still lines. It changes figure as the note rises and its grains
 *   jump when it is struck.
 * - **Cáustica**, the light an eco gives: the bright net light makes through moving water, as a
 *   veil hanging to the floor or a pool lying on it.
 * - **Onda**, what an eco lets go: a doubled ring, or ripples from two points crossing on the floor.
 *
 * Every one takes its numbers per sheet (`MeshInstance.setParameter`), so all ecos share four
 * materials and nothing is compiled while a fight runs. Colours are linear; no pink, no violet.
 */
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

const SHARED = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vUv: vec2f;
const ECO_PI: f32 = 3.14159265;
const ecoLight: vec3f = vec3f(0.86, 0.965, 0.925);
const ecoNacar: vec3f = vec3f(0.28, 0.775, 0.56);
const ecoGold: vec3f = vec3f(0.89, 0.767, 0.4);
fn ecoHash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn ecoHash2(p: vec2f) -> vec2f { return vec2f(ecoHash(p), ecoHash(p + 19.19)); }
fn lg(x: f32, w: f32) -> f32 { return exp(-x * x / (w * w)); }
// A fine line of light at distance r, w wide: a bright core and a soft skirt.
fn ringL(d: f32, r: f32, w: f32) -> f32 { let x = (d - r) / w; return lg(x, 1.15) + 0.16 * lg(x, 4.0); }
// Nothing reaches the edge of its sheet.
fn ecoEdge(uv: vec2f) -> f32 { return 1.0 - smoothstep(0.88, 1.0, max(abs(uv.x), abs(uv.y))); }
// Added light: its alpha is nothing, so it only brightens.
fn ecoOut(col: vec3f) -> vec4f { return vec4f(gammaCorrectOutput(toneMap(max(col, vec3f(0.0)))), 0.0); }
`;

const CHLADNI = /* wgsl */ `
// The figure a square plate draws when it sounds in mode (n, m): the still lines are where this is zero.
fn chl(q: vec2f, nm: vec2f) -> f32 {
  return cos(nm.x * ECO_PI * q.x) * cos(nm.y * ECO_PI * q.y) + cos(nm.y * ECO_PI * q.x) * cos(nm.x * ECO_PI * q.y);
}
fn modeOf(i: f32) -> vec2f {
  if (i < 0.5) { return vec2f(2.0, 3.0); }
  if (i < 1.5) { return vec2f(1.0, 4.0); }
  if (i < 2.5) { return vec2f(3.0, 5.0); }
  return vec2f(4.0, 7.0);
}
// Grains of sand, one a cell, shown only where the plate is still; jump shakes them off their places.
fn grains(m: vec2f, nmA: vec2f, nmB: vec2f, k: f32, cells: f32, jump: f32, wide: f32) -> f32 {
  let cell = floor(m * cells);
  var gp = (cell + 0.15 + 0.7 * ecoHash2(cell)) / cells;
  gp += (ecoHash2(cell + 5.0) - 0.5) * 0.16 * jump;
  let gf = mix(chl(gp, nmA), chl(gp, nmB), k);
  return (1.0 - smoothstep(0.03, 0.22, abs(gf))) * lg(length(m - gp) / wide, 1.2) * step(length(gp), 0.95) * (0.5 + 0.5 * ecoHash(cell + 9.0));
}`;

const CAUSTIC = /* wgsl */ `
// Light through a moving water surface: rays bent by its slope bunch up where the bending folds.
fn caustic(p: vec2f, t: f32) -> f32 {
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
}`;

/**
 * The eco. `uEco`: grade as drawn, seconds since its beat, seed, alpha. `uForm`: how its circle is
 * squashed across and up, its turn, how warm. `uHalf`: the sheet's half width and height in eco
 * units, then how strongly its figure shows and which. `uLook`: gain, line width in pixels, gold,
 * and its own clock (which runs backwards in Da capo).
 */
const BODY = /* wgsl */ `
${SHARED}
${CHLADNI}
uniform uEco: vec4f;
uniform uForm: vec4f;
uniform uHalf: vec4f;
uniform uLook: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let g = uniform.uEco.x; let struck = exp(-max(uniform.uEco.y, 0.0) * 6.0);
  let px = uniform.uLook.y; let gold = uniform.uLook.z; let t = uniform.uLook.w;
  let p = vUv * uniform.uHalf.xy;
  let big = 1.0 + 0.28 * g;
  let co = cos(uniform.uForm.z); let si = sin(uniform.uForm.z);
  let q = vec2f(co * p.x - si * p.y, si * p.x + co * p.y) / uniform.uForm.xy;
  // The voice in the middle and its echoes a little apart: one from the start, a second at f.
  let e1 = 0.65 + 0.35 * smoothstep(0.15, 0.95, g); let e2 = smoothstep(1.15, 1.95, g);
  let sep = 0.2 * e1 + 0.07 * e2;
  let c1 = vec2f(-0.3 * sep, sep); let c2 = vec2f(0.75 * sep, -0.7 * sep);
  let d0 = length(q); let d1 = length(q - c1); let d2 = length(q - c2);
  let rOut = big * (0.62 + 0.3 * g);
  let lam = 0.17; let ph = t * 0.3;
  let env = (1.0 - smoothstep(rOut * 0.55, rOut, d0)) * smoothstep(0.06, 0.3, d0);
  // Soft ripples running out from each; where they agree, the crossing lights up in gold.
  let i0 = pow(0.5 + 0.5 * cos(2.0 * ECO_PI * (d0 / lam - ph)), 3.0);
  let i1 = pow(0.5 + 0.5 * cos(2.0 * ECO_PI * (d1 / lam - ph)), 3.0) * e1;
  let i2 = pow(0.5 + 0.5 * cos(2.0 * ECO_PI * (d2 / lam - ph)), 3.0) * e2;
  let rip = (i0 + i1 + i2) * env;
  let agree = (i0 * i1 + i0 * i2 + i1 * i2) * env;
  let w0 = max(fwidth(d0), 1e-4) * px; let w1 = max(fwidth(d1), 1e-4) * px;
  let ang = atan2(q.y, q.x);
  var body = 0.0; var glint = 0.0; var shim = 0.0; var foam = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i); let lit = clamp(g - fi + 1.0, 0.0, 1.0) * (1.0 - fi * 0.12); let rr = big * (0.62 + 0.3 * fi);
    let line = lit * (ringL(d0, rr, w0) + 0.6 * ringL(d1, rr, w1) * e1);
    // White at its heart, seafoam towards its edge.
    body += line * (1.0 - fi * 0.3); foam += line * fi * 0.3;
    glint += lit * lg((d0 - rr) / w0, 2.4) * lg((d1 - rr) / w1, 2.4) * e1;
    shim += lit * ringL(d0, rr, w0) * smoothstep(0.74, 1.0, cos(ang - t * 1.2 - fi * 2.1));
  }
  let tint = mix(ecoNacar, ecoGold, uniform.uForm.w * 0.55);
  let bead = lg(d0 / 0.07, 1.0) * 1.5 + lg(d0 / 0.2, 1.0) * 0.22;
  let haze = lg(length(p) / (rOut * 1.1), 1.0) * 0.03;
  var col = ecoLight * (body * 0.5 + bead) + tint * (rip * 0.07 + body * 0.2 + foam * 0.9 + haze) + ecoGold * gold * (agree * 0.16 + glint * 1.2 + shim * 0.5);
  // Struck, its inside shows the figure of its note for a moment, grains on the still lines.
  let cim = uniform.uHalf.z;
  if (cim > 0.003) {
    let m0 = q / (rOut * 0.9);
    let m = vec2f(0.9928 * m0.x - 0.1197 * m0.y, 0.1197 * m0.x + 0.9928 * m0.y);
    let r = length(m); let inside = 1.0 - smoothstep(0.9, 1.0, r);
    let nm = modeOf(uniform.uHalf.w);
    let f = chl(m, nm); let fw = max(fwidth(f), 1e-4) * px;
    let fig = lg(f / fw, 1.0) + 0.25 * lg(f / fw, 3.5);
    let sand = grains(m, nm, nm, 0.0, 11.0 + 4.0 * g, struck, max(fwidth(r), 1e-4) * px * 1.3);
    let loud = smoothstep(0.6, 1.8, abs(f)) * struck;
    col += (ecoLight * (fig * 0.5 + sand * 1.1) + ecoGold * gold * loud * 0.35) * inside * cim * (0.55 + 0.22 * g);
  }
  // f: the wings, at each side a fan of fine arcs leaving the eco together and curling up, each
  // shorter and fainter than the one inside it; every arc is a voice and its echo, crossing in a glint.
  let u = smoothstep(1.0, 2.0, g);
  if (u > 0.003) {
    let side = vec2f(abs(p.x), p.y) - vec2f(rOut * uniform.uForm.x * 0.9, -0.1);
    var wing = vec3f(0.0); var wglint = 0.0;
    for (var k = 0; k < 4; k++) {
      // Each arc leaves a little higher than the one under it, so the fan opens from its root.
      let fk = f32(k); let lift = 0.04 + 0.27 * fk; let cl = cos(lift); let sl = sin(lift);
      let w = vec2f(cl * side.x + sl * side.y, -sl * side.x + cl * side.y);
      let rk = (2.3 - 0.32 * fk) * (0.3 + 0.7 * u) * big * 0.62;
      let reach = (1.05 - 0.1 * fk) * (0.5 + 0.5 * u);
      let vA = w - vec2f(0.0, rk); let vB = vA - vec2f(0.17, 0.1);
      let dA = length(vA) - rk; let dB = length(vB) - rk;
      let wA = max(fwidth(dA), 1e-4) * px; let wB = max(fwidth(dB), 1e-4) * px;
      let th = atan2(vA.x, -vA.y);
      let span = smoothstep(0.02, 0.2, th) * (1.0 - smoothstep(reach * 0.4, reach, th));
      let flow = 0.6 + 0.4 * cos(2.0 * ECO_PI * (th / reach * 1.2 - t * 0.35) + fk);
      wing += mix(ecoLight, ecoNacar, 0.3 + 0.2 * fk) * (ringL(dA, 0.0, wA) + 0.45 * ringL(dB, 0.0, wB)) * span * flow * (1.0 - 0.17 * fk);
      wglint += lg(dA / wA, 1.8) * lg(dB / wB, 1.8) * span;
    }
    let clear = smoothstep(rOut * 0.96, rOut * 1.06, d0);
    col += (wing * 0.5 + ecoGold * gold * wglint * 0.5) * u * clear;
  }
  col *= (1.0 + 0.7 * struck) * uniform.uLook.x / (1.0 + 0.4 * g) * uniform.uEco.w * ecoEdge(vUv);
  output.color = ecoOut(col);
  return output;
}`;

/**
 * A sounding plate. `uMem`: the figure it leaves, the one it goes to, how far between them, alpha.
 * `uMem2`: seconds since struck, line width in pixels, gold, its turn. `uMem3`: gain, grains across,
 * how far apart its doubled rim is.
 */
const MEMBRANE = /* wgsl */ `
${SHARED}
${CHLADNI}
uniform uMem: vec4f;
uniform uMem2: vec4f;
uniform uMem3: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let struck = exp(-max(uniform.uMem2.x, 0.0) * 5.0);
  let px = uniform.uMem2.y; let gold = uniform.uMem2.z;
  let co = cos(uniform.uMem2.w); let si = sin(uniform.uMem2.w);
  let m = vec2f(co * vUv.x - si * vUv.y, si * vUv.x + co * vUv.y) / 0.9;
  let r = length(m); let inside = 1.0 - smoothstep(0.9, 0.99, r);
  let nmA = modeOf(uniform.uMem.x); let nmB = modeOf(uniform.uMem.y); let k = uniform.uMem.z;
  // One figure turns into the next: the plate itself goes from one note to the other, its still lines sliding.
  let f = mix(chl(m, nmA), chl(m, nmB), k);
  let fw = max(fwidth(f), 1e-4) * px;
  let fig = lg(f / fw, 1.0) + 0.25 * lg(f / fw, 3.5);
  let wr = max(fwidth(r), 1e-4) * px;
  let sand = grains(m, nmA, nmB, k, uniform.uMem3.y, struck + 0.5 * (1.0 - abs(2.0 * k - 1.0)), wr * 1.3);
  let loud = smoothstep(0.6, 1.8, abs(f)) * struck;
  // Its rim is a ring and its echo.
  let c = vec2f(-0.3, 1.0) * uniform.uMem3.z;
  let d1 = length(m - c); let w1 = max(fwidth(d1), 1e-4) * px;
  let rim = ringL(r, 0.985, wr) + 0.6 * ringL(d1, 0.985, w1);
  let glint = lg((r - 0.985) / wr, 2.4) * lg((d1 - 0.985) / w1, 2.4);
  var col = ecoNacar * inside * 0.04 + ecoLight * (fig * 0.5 + sand * 1.1) * inside + ecoGold * gold * (loud * 0.35 * inside + glint * 1.5)
    + (ecoLight * 0.6 + ecoNacar * 0.2) * rim;
  col *= (1.0 + 0.45 * struck) * uniform.uMem3.x * uniform.uMem.w * ecoEdge(vUv);
  output.color = ecoOut(col);
  return output;
}`;

/**
 * Light through water. `uCau`: 0 for a veil hanging down its sheet, 1 for a pool lying in it; alpha,
 * how warm, seed. `uCau2`: the sheet's half width and height in metres, seconds since struck, grade.
 * `uCau3`: gain, the time.
 */
const CAUSTICS = /* wgsl */ `
${SHARED}
${CAUSTIC}
uniform uCau: vec4f;
uniform uCau2: vec4f;
uniform uCau3: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uCau3.y; let g = uniform.uCau2.w; let seed = uniform.uCau.w;
  let struck = exp(-max(uniform.uCau2.z, 0.0) * 5.0);
  let tint = mix(ecoNacar, ecoGold, uniform.uCau.z * 0.7);
  let p = vUv * uniform.uCau2.xy;
  // The veil: narrow where it hangs from, wider and fainter towards the floor, swaying a little.
  let k = (1.0 - vUv.y) * 0.5;
  let wide = 0.25 + 0.75 * k;
  let x = vUv.x + 0.06 * sin(p.y * 2.3 + t * 1.2) * k;
  let inVeil = 1.0 - smoothstep(wide * 0.5, wide, abs(x));
  let folds = 0.7 + 0.3 * sin(x * uniform.uCau2.x * 26.0 + k * 2.0 + t * 0.7);
  let net = caustic(vec2f(x * uniform.uCau2.x * 7.0, p.y * 4.0 + t * 0.3) + seed, t);
  let fade = smoothstep(0.0, 0.1, k) * (1.0 - 0.6 * k) * (1.0 - smoothstep(0.9, 1.0, k));
  let veil = tint * inVeil * fade * (0.09 * folds + 0.13 * net) * (0.5 + 0.25 * g);
  // The pool: the same net lying on the floor, brightest in its middle.
  let r = length(vUv);
  let inPool = 1.0 - smoothstep(0.35, 0.97, r);
  let floorNet = caustic(p * 7.0 + seed + 5.0, t);
  let pool = (tint * 0.5 + ecoGold * 0.2) * inPool * (floorNet * (0.45 + 0.25 * g) + 0.04);
  var col = mix(veil, pool, step(0.5, uniform.uCau.x));
  col *= (1.0 + 0.6 * struck) * uniform.uCau3.x * uniform.uCau.y * ecoEdge(vUv);
  output.color = ecoOut(col);
  return output;
}`;

/**
 * What an eco lets go. `uWave`: how far out its front is (0 to 1 of the sheet), how deep the train
 * of ripples behind it, how far apart the voice and its echo, alpha. `uWave2`: how much of it is a
 * ring, how much ripples, gold, line width in pixels. `uWave3`: gain, the ripples' wavelength, how warm.
 */
const WAVE = /* wgsl */ `
${SHARED}
uniform uWave: vec4f;
uniform uWave2: vec4f;
uniform uWave3: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let r = uniform.uWave.x; let band = max(uniform.uWave.y, 1e-3); let px = uniform.uWave2.w; let gold = uniform.uWave2.z;
  let c = vec2f(-0.3, 1.0) * uniform.uWave.z;
  let d0 = length(vUv); let d1 = length(vUv - c);
  let w0 = max(fwidth(d0), 1e-4) * px; let w1 = max(fwidth(d1), 1e-4) * px;
  let ring = ringL(d0, r, w0) + 0.6 * ringL(d1, r, w1);
  let glint = lg((d0 - r) / w0, 2.4) * lg((d1 - r) / w1, 2.4);
  // Behind the front, a short train of ripples from each of the two; gold where they cross.
  let lam = max(uniform.uWave3.y, 1e-3);
  let i0 = pow(0.5 + 0.5 * cos(2.0 * ECO_PI * (d0 - r) / lam), 3.0) * lg((d0 - r + band) / band, 1.0);
  let i1 = pow(0.5 + 0.5 * cos(2.0 * ECO_PI * (d1 - r) / lam), 3.0) * lg((d1 - r + band) / band, 1.0);
  let tint = mix(ecoNacar, ecoGold, uniform.uWave3.z * 0.6);
  var col = (ecoLight * ring * 0.6 + tint * ring * 0.2 + ecoGold * gold * glint * 1.5) * uniform.uWave2.x
    + (tint * (i0 + i1) * 0.3 + ecoGold * gold * i0 * i1 * 1.2) * uniform.uWave2.y;
  col *= uniform.uWave3.x * uniform.uWave.w * (1.0 - smoothstep(0.88, 1.0, d0));
  output.color = ecoOut(col);
  return output;
}`;

export function createEcoSheets(device: pc.GraphicsDevice) {
  // One square for every sheet, from -1 to 1 across and up; its entity gives it its size and turn.
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  // Shared by every sheet: held here too, or the first one destroyed would take the mesh with it.
  quad.incRefCount();
  const material = (name: string, uniqueName: string, fragmentWGSL: string) => {
    const m = new pc.ShaderMaterial({ uniqueName, attributes: { vertex_position: pc.SEMANTIC_POSITION }, vertexWGSL: VERTEX, fragmentWGSL });
    m.name = name; m.blendType = pc.BLEND_PREMULTIPLIED; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update();
    return m;
  };
  const body = material('Eco', 'gerard-eco-body', BODY);
  const membrane = material('Figura de un eco', 'gerard-eco-membrane', MEMBRANE);
  const caustic = material('Luz de un eco', 'gerard-eco-caustic', CAUSTICS);
  const wave = material('Onda de un eco', 'gerard-eco-wave', WAVE);
  return {
    quad, body, membrane, caustic, wave,
    destroy() {
      for (const m of [body, membrane, caustic, wave]) m.destroy();
      quad.decRefCount(); if (quad.refCount === 0) quad.destroy();
    },
  };
}
export type EcoSheets = ReturnType<typeof createEcoSheets>;
