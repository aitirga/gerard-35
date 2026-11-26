import * as pc from 'playcanvas';
import type { Effects } from './effects.ts';
import type { GpuKind } from './fight-particles.ts';

/**
 * Bajo cero's own moment (docs/animas/freatica/README.md § Definitiva, Aitor 2026-11-25: «nucleación»): supercooled water
 * that freezes all at once. Everything that grows is a phase field on the GPU (a compute shader in WGSL); the CPU only
 * places the field, says the time and bursts a few particles.
 *
 * - **0 s, the probe.** Whoever wears Freática lets the water level meter's probe drop: a bead of light falls from the
 *   hip to the floor on its tape, and touches it with a white glint (`FROST.drop`).
 * - **Then, the ferns.** From where it touched, frost runs over the floor to every foe that has water: a Kobayashi
 *   phase field (R. Kobayashi, «Modeling and numerical simulations of dendritic crystal growth», 1993), six-fold as
 *   ice is, each crystal's arms turned towards the cell it runs to, its latent heat slowing the tips so they branch.
 *   It nucleates again on the way (`hops`), so it reaches each cell as a fern of crystals, not a single star.
 * - **`FROST.front`, the front.** A front of freezing sweeps out from the probe across the lanes and every cell.
 * - **`FROST.lock`, the cells lock.** The rule's contact: the cells' water becomes its blocks (src/freatica-fx.ts), the
 *   fight stops a moment on it and the picture goes cold (src/battle-scene.ts `coldBeat`).
 * - **To `FROST.end`.** The frost on the floor glints and goes.
 *
 * White and pale cyan only (`#dff8ff`, `#bfeff6`), never pink or violet (docs/visual-style.md). WebGPU only.
 */
export const FROST = {
  /** The field's texels a side, and how far past the probe and the cells it reaches (m). */
  size: 256, margin: .9,
  /** Seconds: the probe falls, the front sets off, the cells lock, the frost has gone. */
  drop: .14, front: .55, lock: .9, end: 2.6,
  /**
   * Steps of the field a second, and the most a frame (a slow frame plays it slower rather than stall). Each is one
   * dispatch of 256² texels: at 120 Hz some 38 a frame, encoded in one compute pass for about 0.1 ms of the CPU
   * (measured 2026-11-26: 146 in 0.1–0.3 ms).
   */
  rate: 4400, most: 160,
  /** Cells the field runs to (more foes freeze all the same; the frost reaches the first six). */
  cells: 6,
  /** Its two colours (sRGB). */
  white: '#dff8ff', cyan: '#bfeff6',
} as const;

/**
 * The phase field's numbers (Kobayashi 1993, his Table 1 save the anisotropy and the noise): grid step, time step and
 * relaxation; the interface's width and its six-fold anisotropy; how undercooling drives it (α, γ), the latent heat
 * (K) and the melting point. Tried on the CPU first (2026-11-26): at K 1.6 a crystal reaches some 75 texels in 1,000
 * steps; at 2 its arms are thinner and a little slower, aimed at their cells, branching at their sides.
 */
export const KOBAYASHI = { dx: .03, dt: 2e-4, tau: 3e-4, eps: .01, delta: .06, j: 6, alpha: .9, gamma: 10, latent: 2, melt: 1, noise: .06 } as const;

export const FROST_KINDS: Record<string, GpuKind> = {
  // The probe falling on its tape: a hard white bead with a short tail.
  'escarcha-sonda': {
    shape: 'streak', colours: ['#ffffff', '#dff8ff', '#bfeff6'], intensity: [3.2, 2.4, 1.6], middle: .5, size: [.035, .03], stretch: .06,
    drag: 0, gravity: 0, curl: 0, response: 0, fadeOut: .2, additive: 1, core: .8,
  },
  // Where it touches, and where the frost locks: glints that sit on the floor and twinkle.
  'escarcha-brillo': {
    shape: 'star', colours: ['#ffffff', '#dff8ff', '#bfeff6'], intensity: [3, 2.2, 1.3], middle: .35, size: [.05, .02], sizeJitter: .6,
    drag: 6, gravity: 0, curl: 0, response: 0, spin: 90, fadeIn: .04, fadeOut: .45, additive: 1, flicker: .6, core: .7,
  },
};

type V3 = { x: number; y: number; z: number };
/** What the moment needs: who cast it (their feet and how tall), and each foe that will freeze (feet, and its cell's half side, m). */
export interface FrostCast { caster: V3; height: number; cells: { at: V3; half: number }[]; ground?: (x: number, z: number) => number }

/** The square of floor the field covers: its corner (least x and z) and its side (m). */
export function frostDomain(cast: Pick<FrostCast, 'caster' | 'cells'>) {
  const xs = [cast.caster.x, ...cast.cells.flatMap(c => [c.at.x - c.half, c.at.x + c.half])];
  const zs = [cast.caster.z, ...cast.cells.flatMap(c => [c.at.z - c.half, c.at.z + c.half])];
  const side = Math.max(2, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + FROST.margin * 2;
  const x = (Math.min(...xs) + Math.max(...xs)) / 2 - side / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2 - side / 2;
  return { x, z, side };
}
/** How many steps of the field a frame of `dt` seconds plays (`FROST.rate`, an even number, at most `FROST.most`). */
export const frostSteps = (dt: number) => Math.min(FROST.most, Math.max(2, 2 * Math.round(dt * FROST.rate / 2)));

const k = KOBAYASHI;
/**
 * One step of the field, texel by texel: reads `uSrc`, writes `uDst`. A texel is (p, T, when it froze, how much of it
 * the front forced): p the phase (0 water, 1 ice), T the temperature (0 undercooled, 1 the melting point).
 * `uClock`: the seconds since the cast, the noise's seed, the front's radius (texels; below 0 not yet), the lock (0–1).
 * `uProbe`: where the probe touched (texels), 1 on a cast's first frame (the field starts over).
 * `uCellN`: a cell's middle (texels), its half side (texels), 1 if it is there.
 */
export const FROST_STEP = /* wgsl */ `
var uSrc: texture_2d<f32>;
var uDst: texture_storage_2d<rgba16float, write>;
uniform uClock: vec4f;
uniform uProbe: vec4f;
uniform uCell0: vec4f;
uniform uCell1: vec4f;
uniform uCell2: vec4f;
uniform uCell3: vec4f;
uniform uCell4: vec4f;
uniform uCell5: vec4f;
const N: i32 = ${FROST.size};
const DX: f32 = ${k.dx};
const DT: f32 = ${k.dt};
const TAU: f32 = ${k.tau};
const EPS: f32 = ${k.eps};
const DELTA: f32 = ${k.delta};
const ARMS: f32 = ${k.j}.0;
const ALPHA: f32 = ${k.alpha};
const GAMMA: f32 = ${k.gamma}.0;
const LATENT: f32 = ${k.latent};
const MELT: f32 = ${k.melt}.0;
const NOISE: f32 = ${k.noise};
const PI: f32 = 3.14159265;
fn cellOf(i: i32) -> vec4f {
  switch i {
    case 0: { return uniform.uCell0; }
    case 1: { return uniform.uCell1; }
    case 2: { return uniform.uCell2; }
    case 3: { return uniform.uCell3; }
    case 4: { return uniform.uCell4; }
    default: { return uniform.uCell5; }
  }
}
fn at(q: vec2i) -> vec4f { return textureLoad(uSrc, clamp(q, vec2i(0), vec2i(N - 1)), 0); }
fn ph(q: vec2i) -> f32 { return at(q).x; }
fn hashOf(q: vec2f) -> f32 { var h = fract(vec3f(q.x, q.y, q.x) * 0.1031); h += dot(h, h.yzx + 33.33); return fract((h.x + h.y) * h.z); }
// The lanes to the cells and the cells themselves: how much the frost may grow here (0–1), and where its arms point.
struct Lane { room: f32, aim: f32, inCell: f32, along: f32 }
fn laneAt(q: vec2f) -> Lane {
  var out = Lane(0.0, 0.0, 0.0, 0.0);
  var best = 1e9;
  let probe = uniform.uProbe.xy;
  for (var i = 0; i < 6; i++) {
    let c = cellOf(i);
    if (c.w < 0.5) { continue; }
    let v = c.xy - probe; let len2 = max(dot(v, v), 1.0);
    let f = clamp(dot(q - probe, v) / len2, 0.0, 1.0);
    let d = length(q - probe - v * f);
    let box = max(abs(q.x - c.x), abs(q.y - c.y)) - c.z;
    let near = min(d - 12.0, box);
    if (near < best) { best = near; out.aim = atan2(v.y, v.x); out.along = f; }
    if (box < 0.0) { out.inCell = 1.0; }
  }
  out.room = clamp(1.0 - best / 30.0, 0.0, 1.0);
  return out;
}
// The interface's width and its turn with the arms (ε and dε/dθ) at a texel, from its gradient.
fn grain(q: vec2i, aim: f32) -> vec4f {
  let gx = (ph(q + vec2i(1, 0)) - ph(q - vec2i(1, 0))) / (2.0 * DX);
  let gy = (ph(q + vec2i(0, 1)) - ph(q - vec2i(0, 1))) / (2.0 * DX);
  // atan2(0, 0) is not defined in WGSL (Metal gives NaN): where the field is flat the angle does not matter, so 0.
  let th = select(0.0, atan2(gy, gx), gx * gx + gy * gy > 1e-8) - aim;
  return vec4f(gx, gy, EPS * (1.0 + DELTA * cos(ARMS * th)), -EPS * ARMS * DELTA * sin(ARMS * th));
}
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (q.x >= N || q.y >= N) { return; }
  let qf = vec2f(q);
  let elapsed = uniform.uClock.x;
  let lane = laneAt(qf);
  // A cast's first frame starts the field over (every step of it: all water, undercooled, nothing frozen yet).
  let probe = uniform.uProbe.xy;
  if (uniform.uProbe.z > 0.5) {
    let seed = length(vec2f(q) - probe) < 4.0;
    textureStore(uDst, q, vec4f(select(0.0, 1.0, seed), 0.0, select(-1.0, 0.0, seed), 0.0));
    return;
  }
  let here = at(q);
  var p = here.x; var tc = here.y; var froze = here.z; var forced = here.w;
  // Nucleating again on the way to each cell (two hops on its lane), as the ferns get there.
  var seeded = false;
  for (var i = 0; i < 6; i++) {
    let c = cellOf(i);
    if (c.w < 0.5) { continue; }
    for (var h = 0; h < 2; h++) {
      let f = select(0.72, 0.42, h == 0);
      let when = ${FROST.drop} + f * ${FROST.front - FROST.drop} * 1.1;
      let spot = probe + (c.xy - probe) * f;
      if (elapsed >= when && elapsed < when + 0.08 && length(qf - spot) < 4.0) { seeded = true; }
    }
  }
  // The probe's first crystal, held for a moment where it touched.
  if (elapsed < ${FROST.drop + .1} && length(qf - probe) < 4.0) { seeded = true; }
  if (seeded && p < 1.0) {
    textureStore(uDst, q, vec4f(1.0, tc, select(froze, elapsed, froze < 0.0), forced));
    return;
  }
  // Kobayashi's step: the anisotropic interface, the double well tilted by the undercooling, and the heat it lets go.
  let aim = lane.aim + 0.3;
  let gc = grain(q, aim);
  let gl = grain(q - vec2i(1, 0), aim); let gr = grain(q + vec2i(1, 0), aim);
  let gd = grain(q - vec2i(0, 1), aim); let gu = grain(q + vec2i(0, 1), aim);
  let lap = (ph(q + vec2i(1, 0)) + ph(q - vec2i(1, 0)) + ph(q + vec2i(0, 1)) + ph(q - vec2i(0, 1)) - 4.0 * p) / (DX * DX);
  let e2x = (gr.z * gr.z - gl.z * gl.z) / (2.0 * DX);
  let e2y = (gu.z * gu.z - gd.z * gd.z) / (2.0 * DX);
  let turnY = (gu.z * gu.w * gu.x - gd.z * gd.w * gd.x) / (2.0 * DX);
  let turnX = -(gr.z * gr.w * gr.y - gl.z * gl.w * gl.y) / (2.0 * DX);
  let drive = ALPHA / PI * atan(GAMMA * (MELT - tc));
  // Out of the lanes and the cells it melts back: the frost goes where the water is, and on its way there.
  let tilt = drive * lane.room - (1.0 - lane.room) * 0.3 + NOISE * (hashOf(qf + vec2f(uniform.uClock.y, elapsed * 61.0)) - 0.5);
  let dp = DT / TAU * (turnY + turnX + gc.z * gc.z * lap + e2x * gc.x + e2y * gc.y + p * (1.0 - p) * (p - 0.5 + tilt));
  let lapT = (at(q + vec2i(1, 0)).y + at(q - vec2i(1, 0)).y + at(q + vec2i(0, 1)).y + at(q - vec2i(0, 1)).y - 4.0 * tc) / (DX * DX);
  var np = clamp(p + dp, 0.0, 1.0);
  // The front: from the probe out, the water in every cell freezes as it passes, a soft edge in front of it.
  let reach = uniform.uClock.z;
  if (reach > 0.0 && lane.inCell > 0.5) {
    let swept = smoothstep(reach, reach - 8.0, length(qf - probe));
    if (swept > np) { forced = max(forced, swept); np = swept; }
  }
  // The lock: the cells are ice, whole.
  if (lane.inCell > 0.5) { np = max(np, uniform.uClock.w); }
  let nt = tc + DT * lapT + LATENT * (np - p);
  if (froze < 0.0 && np > 0.5) { froze = elapsed; }
  textureStore(uDst, q, vec4f(np, nt, froze, forced));
}`;

/** The frost laid on the floor: the field read back, its edges bright and the fresh ice glinting. */
const FROST_VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vUv: vec2f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.vUv = vertex_position.xz * 0.5 + vec2f(0.5);
  output.position = uniform.matrix_viewProjection * (uniform.matrix_model * vec4f(vertex_position, 1.0));
  return output;
}`;
/** `uFrostLook`: seconds since the cast, how much of it shows (0–1), a texel's size in uv, the lock's flash (0–1). */
const FROST_FRAGMENT = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
varying vUv: vec2f;
uniform uFrostLook: vec4f;
var uFrost: texture_2d<f32>;
var uFrostSampler: sampler;
fn rd(uv: vec2f, o: vec2f) -> vec4f { return textureSampleLevel(uFrost, uFrostSampler, uv + o, 0.0); }
fn glint(q: vec2f) -> f32 { var h = fract(vec3f(q.x, q.y, q.x) * 0.1031); h += dot(h, h.yzx + 33.33); return fract((h.x + h.y) * h.z); }
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let px = uniform.uFrostLook.z; let now = uniform.uFrostLook.x; let shown = uniform.uFrostLook.y;
  let uv = vUv;
  let s = rd(uv, vec2f(0.0));
  let gx = rd(uv, vec2f(px, 0.0)).x - rd(uv, vec2f(-px, 0.0)).x;
  let gy = rd(uv, vec2f(0.0, px)).x - rd(uv, vec2f(0.0, -px)).x;
  let ice = smoothstep(0.3, 0.7, s.x);
  // The crystal's own edges (not the front's soft one) are the bright lines: the ferns read by their outline.
  let rim = clamp(length(vec2f(gx, gy)) * 2.2, 0.0, 1.0) * (1.0 - s.w * 0.7);
  let fresh = select(0.0, exp(-(now - s.z) * 2.8), s.z >= 0.0) * ice;
  let cellQ = floor(uv / px);
  let sparkle = step(0.985, glint(cellQ + floor(now * 7.0))) * ice;
  let white = vec3f(0.74, 0.94, 1.0);
  let cyan = vec3f(0.52, 0.86, 0.91);
  let body = mix(cyan, white, rim);
  let edge = 1.0 - smoothstep(0.42, 0.5, max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  let alpha = clamp(ice * 0.22 + rim * 0.45, 0.0, 1.0) * shown * edge;
  let light = white * (rim * 1.8 + fresh * 0.8 + sparkle * 2.5 + uniform.uFrostLook.w * ice * 1.2) * shown * edge;
  output.color = vec4f(gammaCorrectOutput(toneMap(body)) * alpha + gammaCorrectOutput(toneMap(light)), alpha);
  return output;
}`;

/** Bajo cero's moment, on the fight's engine (`effects.gpu`, WebGPU). `start` it as the definitiva begins, `update` each frame. */
export function createFrostFx(app: pc.AppBase, effects: Effects) {
  const device = app.graphicsDevice;
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  let made: ReturnType<typeof make> | undefined;
  /** The field, its steps and the sheet that shows it: made the first time it is cast. */
  function make() {
    const texture = (name: string) => new pc.Texture(device, {
      name, width: FROST.size, height: FROST.size, format: pc.PIXELFORMAT_RGBA16F, mipmaps: false, storage: true,
      minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const a = texture('Escarcha A'), b = texture('Escarcha B');
    const shader = new pc.Shader(device, { name: 'Escarcha · Kobayashi', shaderLanguage: pc.SHADERLANGUAGE_WGSL, cshader: FROST_STEP });
    const step = (from: pc.Texture, to: pc.Texture, name: string) => {
      const c = new pc.Compute(device, shader, name);
      c.setParameter('uSrc', from); c.setParameter('uDst', to);
      const groups = Math.ceil(FROST.size / 8);
      c.setupDispatch(groups, groups, 1);
      return c;
    };
    // Each frame's steps go a → b → a, so the sheet always reads a.
    const ab = step(a, b, 'Escarcha a→b'), ba = step(b, a, 'Escarcha b→a');
    const mesh = new pc.Mesh(device);
    mesh.setPositions(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]));
    mesh.setIndices([0, 2, 1, 0, 3, 2]); mesh.update();
    const material = new pc.ShaderMaterial({ uniqueName: 'gerard-escarcha', attributes: { vertex_position: pc.SEMANTIC_POSITION }, vertexWGSL: FROST_VERTEX, fragmentWGSL: FROST_FRAGMENT });
    material.name = 'Escarcha'; material.blendType = pc.BLEND_PREMULTIPLIED; material.depthWrite = false; material.cull = pc.CULLFACE_NONE; material.update();
    const instance = new pc.MeshInstance(mesh, material);
    instance.cull = false;
    const look = new Float32Array(4);
    instance.setParameter('uFrost', a); instance.setParameter('uFrostLook', look);
    const sheet = new pc.Entity('Escarcha de Bajo cero');
    sheet.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    sheet.enabled = false;
    app.root.addChild(sheet);
    return { a, b, ab, ba, sheet, look, all: [ab, ba] };
  }
  const g0 = effects.gpu;
  if (g0) for (const [name, kind] of Object.entries(FROST_KINDS)) if (!g0.get(name)) g0.define(name, kind);

  let cast: (FrostCast & { domain: ReturnType<typeof frostDomain>; far: number; started: boolean; probe: V3; glinted: boolean; locked: boolean }) | undefined;
  let time = 0;
  const texel = (p: V3) => { const d = cast!.domain; return { x: (p.x - d.x) / d.side * FROST.size, y: (p.z - d.z) / d.side * FROST.size }; };
  /** The uniforms every step of this cast shares: the cells, in texels. */
  function place(c: NonNullable<typeof made>) {
    const cells = cast!.cells.slice(0, FROST.cells).map(cell => { const q = texel(cell.at); return [q.x, q.y, cell.half / cast!.domain.side * FROST.size, 1]; });
    for (const step of c.all) for (let i = 0; i < FROST.cells; i++) step.setParameter(`uCell${i}`, cells[i] ?? [0, 0, 0, 0]);
  }

  const api = {
    /** Whether the moment is playing now. */
    get on() { return !!cast; },
    /**
     * Bajo cero begins: the probe drops from `caster`'s hip, the frost grows to `cells` and locks at `FROST.lock`.
     * Nothing without the GPU engine (the rule does not wait for it).
     */
    start(next: FrostCast) {
      if (!gpu() || !device.supportsCompute || !next.cells.length) return false;
      made ??= make();
      const domain = frostDomain(next);
      // Laid on the floor where it stands highest under the caster and the foes, a little over it (it is a sheet, not a decal).
      const floor = Math.max(...[next.caster, ...next.cells.map(c => c.at)].map(p => next.ground?.(p.x, p.z) ?? p.y));
      const probe = { x: next.caster.x, y: floor, z: next.caster.z };
      const far = Math.max(...next.cells.map(c => Math.hypot(c.at.x - probe.x, c.at.z - probe.z) + c.half * 1.5)) / domain.side * FROST.size;
      cast = { ...next, domain, far, probe, started: false, glinted: false, locked: false };
      time = 0;
      made.sheet.setPosition(domain.x + domain.side / 2, floor + .04, domain.z + domain.side / 2);
      made.sheet.setLocalScale(domain.side / 2, 1, domain.side / 2);
      made.sheet.enabled = true;
      place(made);
      // The probe on its tape: a bead of light from the hip down to the floor.
      const g = gpu()!, hip = { x: next.caster.x, y: next.caster.y + next.height * .5, z: next.caster.z };
      g.burst('escarcha-sonda', { at: hip, count: 1, velocity: { x: 0, y: -(hip.y - floor) / FROST.drop, z: 0 }, life: [FROST.drop, FROST.drop] });
      g.burst('agua-traza', { at: hip, to: probe, shape: 'line', count: 26, life: [.5, .8], size: .7 });
      return true;
    },
    /** Each frame: the field's steps for `dt` seconds, the front and the lock, and the sheet fading at the end. */
    update(dt: number) {
      if (!cast || !made) return;
      time += dt;
      const c = made, g = gpu();
      if (!g) { api.clear(); return; }
      if (time >= FROST.drop && !cast.glinted) {
        cast.glinted = true;
        g.burst('escarcha-brillo', { at: { x: cast.probe.x, y: cast.probe.y + .03, z: cast.probe.z }, count: 24, shape: 'ring', spread: .12, outward: 1.4, life: [.3, .7], light: { intensity: 2.2, range: 2.5, colour: FROST.white } });
      }
      if (time >= FROST.lock && !cast.locked) {
        cast.locked = true;
        for (const cell of cast.cells) g.burst('escarcha-brillo', { at: { x: cell.at.x, y: cast.probe.y + .05, z: cell.at.z }, count: 40, shape: 'ring', spread: cell.half, outward: .6, life: [.4, 1.1] });
      }
      const front = time < FROST.front ? -1 : cast.far * Math.min(1, (time - FROST.front) / (FROST.lock - FROST.front));
      const lock = time < FROST.lock ? 0 : Math.min(1, (time - FROST.lock) / .15);
      if (time >= FROST.drop && time < FROST.end) {
        const steps = frostSteps(dt), clock = [time, Math.random() * 97, front, lock], list: pc.Compute[] = [];
        // The cast's first frame starts the field over (`uProbe.z`), every step of it.
        const fresh = !cast.started, probe = texel(cast.probe);
        cast.started = true;
        for (const step of c.all) { step.setParameter('uProbe', [probe.x, probe.y, fresh ? 1 : 0, 0]); step.setParameter('uClock', clock); }
        for (let i = 0; i < steps / 2; i++) list.push(c.ab, c.ba);
        device.computeDispatch(list, 'Escarcha de Bajo cero');
      }
      c.look[0] = time; c.look[1] = time < FROST.drop ? 0 : Math.max(0, Math.min(1, (FROST.end - time) / (FROST.end - FROST.lock - .7))); c.look[2] = 1 / FROST.size;
      c.look[3] = time < FROST.lock ? 0 : Math.exp(-(time - FROST.lock) * 5);
      if (time >= FROST.end) api.clear();
    },
    /** Gone at once (the fight is over). */
    clear() { cast = undefined; if (made) made.sheet.enabled = false; },
    destroy() {
      if (!made) return;
      made.sheet.destroy(); made.all.forEach(step => step.destroy()); made.a.destroy(); made.b.destroy();
      made = undefined;
    },
  };
  return api;
}
export type FrostFx = ReturnType<typeof createFrostFx>;
