import * as pc from 'playcanvas';

/**
 * The portal at the end of La calle que no acaba (docs/quests/nuria.md): a tall whirlpool in fear's
 * violet (docs/visual-style.md) that swallows the light round it. All of it is drawn on the GPU:
 * one upright quad whose shader winds noise into arms spiralling into a dark well, and one instanced
 * draw of particles whose paths the vertex shader works out from the clock and each one's seed
 * (nothing is simulated on the CPU): streaks spiralling in from round it, sparks running round its
 * frayed edge, motes rising off the street into it. A violet light falls on the street and houses.
 */

/** Its half-width and half-height (m), the height of its middle, and how far past its edge the quad reaches (× its size) for the wisps. */
const HALF_W = 2.4, HALF_H = 3, MIDDLE = 2.95, MARGIN = 1.45;
/** Particles: spiralling in, round the edge, rising off the street. */
const INFLOW = 300, RIM = 200, MOTES = 110;
/** The clock wraps once an hour so the shader never loses precision; the jump goes unseen. */
const WRAP = 3600;

const NOISE_WGSL = /* wgsl */ `
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), f.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), f.x), f.y);
}
fn fbm(start: vec2f, octaves: i32) -> f32 {
  var v = 0.0; var a = 0.5; var total = 0.0; var p = start;
  for (var i = 0; i < octaves; i++) { v += a * noise(p); total += a; p = p * 2.03 + vec2f(17.1, 3.7); a *= 0.5; }
  return v / total;
}
fn turn(p: vec2f, a: f32) -> vec2f { let c = cos(a); let s = sin(a); return vec2f(c * p.x - s * p.y, s * p.x + c * p.y); }`;

/**
 * The portal's own axes (WGSL), columns across, up and out: it turns to face the camera like a
 * fire, and leans back a little towards the camera's height, so the high camera doesn't squash it
 * flat and its top shows over the houses at the end of the street.
 */
const AXES_WGSL = /* wgsl */ `
fn portalAxes(view: mat4x4f) -> mat3x3f {
  let across = normalize(vec3f(view[0][0], 0.0, view[2][0]));
  let level = vec3f(-across.z, 0.0, across.x);
  let lean = asin(clamp(view[1][2], -1.0, 1.0)) * 0.4;
  return mat3x3f(across, vec3f(0.0, cos(lean), 0.0) - level * sin(lean), level * cos(lean) + vec3f(0.0, sin(lean), 0.0));
}`;

/** The whirlpool (WGSL): `uShape` is its half-width, half-height, middle's height and margin. */
const WHIRL_VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uShape: vec4f;
varying vUv: vec2f;
${AXES_WGSL}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let shape = uniform.uShape;
  let uv = vertex_position.xy * shape.w;
  let world = uniform.matrix_model[3].xyz + portalAxes(uniform.matrix_view) * vec3f(uv.x * shape.x, shape.z + uv.y * shape.y, 0.0);
  output.vUv = uv;
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const WHIRL_FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uTime: f32;
uniform uNear: f32;
varying vUv: vec2f;
${NOISE_WGSL}
// One layer of the whirlpool, \`phase\` seconds into its life: the nearer the middle, the faster it
// turns, so the noise winds into arms curling inwards. Two layers take turns (below), so the arms
// never wind up tighter and tighter however long it turns.
fn layer(p: vec2f, r: f32, phase: f32, offset: vec2f) -> f32 {
  let q = turn(p, -(phase * (0.5 + 0.9 / (r + 0.4)) + 2.0 / (r + 0.3)));
  let warp = vec2f(fbm(q * 1.5 + offset + vec2f(3.1, 7.7), 3), fbm(q * 1.5 + offset + vec2f(8.3, 2.9), 3));
  return fbm(q * 2.4 + offset + (warp - 0.5) * 2.0, 4);
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uTime; let near = uniform.uNear;
  let p = vUv; let r = length(p);
  // Its edge is never a clean ring: it frays and creeps round as it turns.
  let dir = p / max(r, 1e-4);
  let fray = fbm(turn(dir, t * 0.35) * 1.8 + vec2f(5.2, 1.3), 3);
  let edge = 0.94 + (fray - 0.5) * 0.4;
  let period = 4.0;
  let a = fract(t / period); let b = fract(t / period + 0.5);
  let wa = 1.0 - abs(a * 2.0 - 1.0);
  let n = layer(p, r, a * period, vec2f(floor(t / period) * 7.3, 0.0)) * wa
        + layer(p, r, b * period, vec2f(floor(t / period + 0.5) * 7.3 + 3.7, 1.9)) * (1.0 - wa);
  // Three arms winding in, a logarithmic spiral broken up by the noise.
  let arms = 0.5 + 0.5 * sin(atan2(p.y, p.x) * 3.0 + log(r + 0.04) * 4.5 - t * 2.4 + (n - 0.5) * 5.0);
  let lit = smoothstep(0.42, 0.88, n * 0.8 + arms * 0.42);
  // From the dark well in its middle (ragged, never a round pupil) out to violet towards its edge.
  let depth = smoothstep(0.12, 0.95, r / edge + (n - 0.5) * 0.3);
  var colour = mix(vec3f(0.02, 0.004, 0.04), vec3f(0.15, 0.04, 0.33), depth);
  colour += vec3f(0.36, 0.12, 0.85) * lit * (0.06 + depth * 0.75);
  colour += vec3f(0.6, 0.38, 1.0) * pow(lit, 5.0) * depth * 0.45;
  // Brightest just inside its edge, where the light runs round fastest.
  let rim = smoothstep(edge - 0.3, edge - 0.02, r) * (1.0 - smoothstep(edge - 0.02, edge + 0.08, r));
  colour += vec3f(0.42, 0.16, 1.0) * rim * (0.45 + n * 0.6) * (1.0 + near * 0.4);
  colour *= 1.0 + near * 0.25;
  let cover = (1.0 - smoothstep(edge - 0.06, edge + 0.02, r)) * 0.96;
  // Wisps of violet light curling off past the edge.
  let wisp = smoothstep(0.52, 0.82, fbm(turn(p, -t * 0.4) * 2.6 + vec2f(-t * 0.25, 4.4), 3)) * smoothstep(edge + 0.42, edge, r) * (1.0 - cover);
  var glow = vec3f(0.42, 0.18, 0.95) * wisp * (0.7 + near * 0.5);
  if (cover + wisp < 0.003) { discard; }
  // A light in the haze: the fog takes only half of it.
  #if (FOG != NONE)
    let fogged = mix(1.0, getFogFactor(), 0.5);
    colour = mix(uniform.fog_color, colour, fogged);
    glow *= fogged;
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  glow = gammaCorrectOutput(toneMap(glow));
  // Premultiplied: its inside covers the street behind it, the wisps only add light.
  output.color = vec4f(colour * cover + glow, cover);
  return output;
}`;

/**
 * Its particles (WGSL): `aSeed` is three random numbers and the particle's kind (0 spiralling in,
 * 1 round the edge, 2 rising off the street). Each one's place is a function of where it is in its
 * life, so its streak is where it is now back to where it was a moment ago.
 */
const MOTES_VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aSeed: vec4f;
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uShape: vec4f;
uniform uTime: f32;
uniform uNear: f32;
varying vUv: vec2f;
varying vColour: vec4f;
${AXES_WGSL}
// Where a particle is at \`s\` of its life (0 born, 1 gone), in the portal's space: x and y in its
// half-sizes from its middle, z in metres towards the camera (the portal turns to face it).
// Everything turns the same way as the whirlpool, anticlockwise as seen.
fn place(seed: vec4f, s: f32) -> vec3f {
  let start = seed.x * 6.2832;
  if (seed.w < 0.5) {
    // Drawn in from round it, spiralling ever faster into the well.
    let r = (1.1 + seed.y * 0.5) * pow(1.0 - s, 1.4) + 0.03;
    let a = start + s * 1.5 + 0.9 / (r + 0.2);
    return vec3f(cos(a) * r, sin(a) * r, 0.04 + (0.15 + seed.z * 0.5) * (1.0 - s) * (1.0 - s));
  }
  if (seed.w < 1.5) {
    // Running round its edge.
    let r = 0.9 + seed.y * 0.22 + sin(s * 12.566 + seed.z * 6.2832) * 0.03;
    let a = start + s * (2.5 + seed.z * 2.0);
    return vec3f(cos(a) * r, sin(a) * r, 0.05 + seed.z * 0.1);
  }
  // Rising off the street in front of it, drawn in towards it as they climb.
  let x = (seed.x * 2.0 - 1.0) * 1.7 * (1.0 - s * 0.55) + sin(s * 7.0 + seed.z * 6.2832) * 0.08;
  return vec3f(x, -0.98 + s * 2.3, (0.3 + seed.y * 2.2) * (1.0 - s * 0.75));
}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let shape = uniform.uShape;
  let kind = aSeed.w;
  var life = 2.2 + aSeed.z * 1.4;
  var size = 0.035 + aSeed.y * 0.04;
  if (kind > 0.5) { life = 1.6 + aSeed.y * 1.2; size = 0.03 + aSeed.z * 0.035; }
  if (kind > 1.5) { life = 3.5 + aSeed.z * 2.0; size = 0.035 + aSeed.y * 0.05; }
  let s = fract(uniform.uTime / life + aSeed.x * 3.71 + aSeed.y * 1.37);
  let view = uniform.matrix_view;
  let axes = portalAxes(view);
  let origin = uniform.matrix_model[3].xyz;
  let scale = vec3f(shape.x, shape.y, 1.0);
  let lift = vec3f(0.0, shape.z, 0.0);
  let here = origin + axes * (place(aSeed, s) * scale + lift);
  let before = origin + axes * (place(aSeed, max(s - 0.03, 0.0)) * scale + lift);
  // A streak facing the camera, from where it was a moment ago to where it is.
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  let toCamera = vec3f(view[0][2], view[1][2], view[2][2]);
  var along = here - before;
  along -= toCamera * dot(along, toCamera);
  let travel = length(along);
  var axis = right;
  if (travel > 1e-4) { axis = along / travel; }
  let side = normalize(cross(toCamera, axis));
  let stretch = min(travel, 0.6) * 0.5;
  let corner = vertex_position.xy;
  let world = (here + before) * 0.5 + axis * corner.x * (size + stretch) + side * corner.y * size;
  var fade = smoothstep(0.0, 0.15, s) * (1.0 - smoothstep(0.7, 1.0, s));
  if (kind > 0.5 && kind < 1.5) { fade *= 0.55 + 0.45 * sin(s * 25.0 + aSeed.x * 40.0); }
  if (kind > 1.5) { fade = smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(0.6, 1.0, s)); }
  // Violet to lilac, a few nearly white.
  let hue = fract(aSeed.x * 7.3 + aSeed.z * 3.1);
  var colour = mix(vec3f(0.36, 0.12, 1.0), vec3f(0.62, 0.36, 1.0), hue);
  colour = mix(colour, vec3f(0.9, 0.8, 1.0), step(0.93, hue) * 0.5);
  output.vColour = vec4f(colour * (0.7 + uniform.uNear * 0.5) * fade, fade);
  output.vUv = corner;
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const MOTES_FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vUv: vec2f;
varying vColour: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let g = pow(max(1.0 - length(vUv), 0.0), 1.6);
  if (g * vColour.w < 0.003) { discard; }
  // A soft glow round a hot core.
  var c = vColour.rgb * (g + pow(g, 6.0) * 0.5);
  #if (FOG != NONE)
    c *= mix(1.0, getFogFactor(), 0.5);
  #endif
  c = gammaCorrectOutput(toneMap(c));
  output.color = vec4f(c, g * vColour.w * 0.1);
  return output;
}`;

/** The portal standing on the street at `at`, turned to the camera. */
export function buildPortal(app: pc.AppBase, at: pc.Vec3) {
  const device = app.graphicsDevice;
  const root = new pc.Entity('Portal de Uri'); app.root.addChild(root);
  root.setPosition(at);
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  const shape = new Float32Array([HALF_W, HALF_H, MIDDLE, MARGIN]);
  const material = (name: string, uniqueName: string, vertexWGSL: string, fragmentWGSL: string, attributes: Record<string, string>) => {
    const m = new pc.ShaderMaterial({ uniqueName, attributes, vertexWGSL, fragmentWGSL });
    m.name = name; m.blendType = pc.BLEND_PREMULTIPLIED; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.setParameter('uShape', shape); m.setParameter('uTime', 0); m.setParameter('uNear', 0);
    m.update();
    return m;
  };
  const whirlMaterial = material('Remolino del portal', 'gerard-portal', WHIRL_VERTEX_WGSL, WHIRL_FRAGMENT_WGSL, { vertex_position: pc.SEMANTIC_POSITION });
  const motesMaterial = material('Chispas del portal', 'gerard-portal-motes', MOTES_VERTEX_WGSL, MOTES_FRAGMENT_WGSL, { vertex_position: pc.SEMANTIC_POSITION, aSeed: pc.SEMANTIC_ATTR10 });
  const total = INFLOW + RIM + MOTES;
  const seeds = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    seeds.set([Math.random(), Math.random(), Math.random(), i < INFLOW ? 0 : i < INFLOW + RIM ? 1 : 2], i * 4);
  }
  const format = new pc.VertexFormat(device, [{ semantic: pc.SEMANTIC_ATTR10, components: 4, type: pc.TYPE_FLOAT32 }]);
  const buffer = new pc.VertexBuffer(device, format, total, { usage: pc.BUFFER_STATIC, data: seeds.buffer });
  const look = new pc.Entity('Remolino'); root.addChild(look);
  const whirl = new pc.MeshInstance(quad, whirlMaterial, look);
  const motes = new pc.MeshInstance(quad, motesMaterial, look);
  motes.setInstancing(buffer);
  motes.instancingCount = total;
  // Their bounds are worked out in the shaders, so neither is culled; the particles sort just in
  // front of the whirlpool, so they draw over it, and both sort by its middle against the rest.
  const middle = new pc.Vec3();
  const depth = (nearer: number) => (_: pc.MeshInstance, camera: pc.Vec3, forward: pc.Vec3) => {
    middle.copy(root.getPosition()); middle.y += MIDDLE;
    return (middle.x - camera.x) * forward.x + (middle.y - camera.y) * forward.y + (middle.z - camera.z) * forward.z - nearer;
  };
  for (const [instance, nearer] of [[whirl, 0], [motes, .5]] as const) { instance.cull = false; instance.calculateSortDistance = depth(nearer); }
  look.addComponent('render', { meshInstances: [whirl, motes], castShadows: false, receiveShadows: false });
  const glow = new pc.Entity('Luz del portal');
  glow.addComponent('light', { type: 'omni', color: new pc.Color(.6, .38, 1), intensity: 1.4, range: 10, castShadows: false });
  glow.setLocalPosition(0, 2.6, 1.8);
  root.addChild(glow);
  let time = 0, near = Number.NaN;
  return {
    root,
    /**
     * `nearNow` 0–1: how close the party is; it turns faster and burns brighter as they come. Its
     * own clock runs at that pace, so a step closer only speeds it up, never jolts it.
     */
    update(dt: number, nearNow: number, animate: boolean) {
      near = Number.isNaN(near) ? nearNow : near + (nearNow - near) * Math.min(1, dt * 1.5);
      if (animate) time = (time + dt * (1 + near * 1.4)) % WRAP;
      for (const m of [whirlMaterial, motesMaterial]) { m.setParameter('uTime', time); m.setParameter('uNear', near); }
      glow.light!.intensity = 1.4 + near * 1.6 + (animate ? Math.sin(time * 1.7) * .12 : 0);
    },
    destroy() { root.destroy(); whirlMaterial.destroy(); motesMaterial.destroy(); buffer.destroy(); quad.destroy(); },
  };
}
export type Portal = ReturnType<typeof buildPortal>;
