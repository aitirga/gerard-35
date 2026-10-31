import * as pc from 'playcanvas';

/**
 * Fire drawn as flame rather than as sprites: each fire is one upright surface turned to the camera whose
 * shader builds its flames from layers of noise rising through it, each warping the next, on the
 * shader's clock and the fire's own seed. Its tongues split, merge and lick up without ever
 * repeating, no two fires alike; their temperature colours them (white-hot low in the heart,
 * yellow, orange, deep red at the tips) and a column of smoke rises over them. Every fire is one
 * instance of one draw call. What the game makes of them (levels, light, sparks) lives in
 * src/effects.ts (docs/graphics.md).
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
 * The fire shell: whoever burns, drawn again a little bigger with this shader, so flames crawl up their
 * own surfaces (the noise runs in world space, continuous across their parts, rising) and follow every
 * move they make. Hotter low on them and at their outline, where the flames stand out against what is
 * behind; `uBurn` is their feet's height, their height, how strongly it burns and how white-hot.
 */
const SHELL_VERTEX_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute vertex_normal: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uInflate: f32;
varying vWorld: vec3f;
varying vNormal: vec3f;
varying vToCamera: vec3f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let model = uniform.matrix_model;
  let view = uniform.matrix_view;
  let n = normalize((model * vec4f(vertex_normal, 0.0)).xyz);
  let world = (model * vec4f(vertex_position, 1.0)).xyz + n * uniform.uInflate;
  output.vWorld = world;
  output.vNormal = n;
  output.vToCamera = vec3f(view[0][2], view[1][2], view[2][2]);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const SHELL_FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uTime: f32;
uniform uBurn: vec4f;
uniform uSwirl: vec4f;
uniform uSeed: f32;
varying vWorld: vec3f;
varying vNormal: vec3f;
varying vToCamera: vec3f;
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
fn ramp(h: f32) -> vec3f {
  var c = mix(vec3f(0.4, 0.03, 0.0), vec3f(1.0, 0.24, 0.02), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3f(1.0, 0.6, 0.1), smoothstep(0.3, 0.62, h));
  return mix(c, vec3f(1.0, 0.93, 0.62), smoothstep(0.62, 0.95, h));
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let t = uniform.uTime; let seed = uniform.uSeed * 97.0; let burn = uniform.uBurn;
  let h = clamp((vWorld.y - burn.x) / max(burn.y, 0.01), 0.0, 1.0);
  // Noise in world space, rising: the same flames run across every part of them. Turned around
  // their middle as time goes and twisted with height, the flames spiral up them.
  let swirl = uniform.uSwirl;
  let d = vWorld.xz - swirl.xy;
  let turn = t * swirl.z + vWorld.y * swirl.w; let c = cos(turn); let s = sin(turn);
  let r = vec2f(c * d.x - s * d.y, s * d.x + c * d.y);
  let p = vec2f(r.x * 2.6 + r.y * 1.9, vWorld.y * 1.7);
  let q = vec2f(fbm(p * 0.9 + vec2f(seed, -t * 1.2), 2), fbm(p * 0.9 + vec2f(seed + 4.1, -t * 1.5), 2));
  let n = fbm(p * 1.6 + (q - 0.5) * 2.0 + vec2f(seed * 0.3, -t * 2.6), 3);
  let normal = normalize(vNormal);
  let rim = 1.0 - abs(dot(normal, normalize(vToCamera)));
  var temp = ((n - 0.5) * 1.7 + 0.5 - h * 0.6 + rim * 0.22 + max(normal.y, 0.0) * 0.1) * burn.z;
  temp = clamp(temp, 0.0, 1.0);
  let a = smoothstep(0.28, 0.6, temp);
  if (a < 0.004) { discard; }
  var fire = ramp(temp) * (1.0 + burn.w * smoothstep(0.6, 1.0, temp));
  #if (FOG != NONE)
    fire *= getFogFactor();
  #endif
  fire = gammaCorrectOutput(toneMap(fire));
  output.color = vec4f(fire * a, a * 0.3);
  return output;
}`;

/** Someone burning as a shell over their own parts (`wrap`). */
export interface Shell {
  /** The height of their feet and how tall they stand (m). */
  base: number; height: number;
  /** 0 out, 1 burning fully, and how white-hot (as a flame's). */
  strength: number; heat: number;
  /** Their middle (x, z), which the flames spiral round; how fast they turn (radians a second) and how much they twist as they rise (radians a metre). */
  x: number; z: number; spin: number; twist: number;
  /** Their parts, in world space, to throw sparks from. */
  readonly parts: readonly pc.MeshInstance[];
  remove(): void;
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

  // Shells: every burning part drawn again with the shell shader, on its own node so it moves with it.
  const shellMaterial = new pc.ShaderMaterial({
    uniqueName: 'gerard-flame-shell',
    attributes: { vertex_position: pc.SEMANTIC_POSITION, vertex_normal: pc.SEMANTIC_NORMAL },
    vertexWGSL: SHELL_VERTEX_WGSL, fragmentWGSL: SHELL_FRAGMENT_WGSL,
  });
  shellMaterial.name = 'Llamas sobre el cuerpo';
  shellMaterial.blendType = pc.BLEND_PREMULTIPLIED;
  shellMaterial.depthWrite = false;
  shellMaterial.setParameter('uTime', 0);
  // A few centimetres out, so the shell never fights the body for the same depth.
  shellMaterial.setParameter('uInflate', .03);
  shellMaterial.update();
  const world = () => app.scene.layers.getLayerById(pc.LAYERID_WORLD);
  /** Shells drawn (development comparisons). */
  let drawShells = true;
  const shells: { shell: Shell; own: pc.MeshInstance[]; source: pc.MeshInstance[]; burn: Float32Array; swirl: Float32Array }[] = [];
  function writeShells() {
    for (const { shell, own, source, burn, swirl } of shells) {
      burn[0] = shell.base; burn[1] = shell.height; burn[2] = Math.max(0, Math.min(1.2, shell.strength)); burn[3] = shell.heat;
      swirl[0] = shell.x; swirl[1] = shell.z; swirl[2] = shell.spin; swirl[3] = shell.twist;
      own.forEach((m, i) => { m.visible = drawShells && source[i].visible && (source[i].node as pc.Entity).enabled && shell.strength > .01; m.setParameter('uBurn', burn); m.setParameter('uSwirl', swirl); });
    }
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
    /** Whether bodies' own fire is drawn (development comparisons; it keeps burning either way). */
    get shells() { return drawShells; },
    set shells(on: boolean) { drawShells = on; },
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
     * Sets someone's own body burning: every part of `model` drawn again a little bigger with
     * flames crawling up it, moving with it. Set its `base`, `height`, `strength` and `heat` as it
     * burns, and `remove()` it when it is out.
     */
    wrap(model: pc.Entity): Shell {
      const source = (model.findComponents('render') as pc.RenderComponent[]).flatMap(r => r.meshInstances).filter(m => m.mesh && !(m.material as pc.Material).name?.startsWith('Llamas'));
      const own = source.map(m => { const shell = new pc.MeshInstance(m.mesh!, shellMaterial, m.node); shell.castShadow = false; return shell; });
      const seed = Math.random();
      own.forEach(m => m.setParameter('uSeed', seed));
      world()?.addMeshInstances(own);
      const record = {
        shell: {
          base: 0, height: 1, strength: 0, heat: 0, x: 0, z: 0, spin: 1.6, twist: 2.5, parts: source,
          remove() { const i = shells.indexOf(record); if (i >= 0) shells.splice(i, 1); world()?.removeMeshInstances(own); },
        } as Shell,
        own, source, burn: new Float32Array(4), swirl: new Float32Array(4),
      };
      shells.push(record);
      return record.shell;
    },
    /** How much scene light the smoke takes (linear RGB), like covering particles. */
    setLight(r: number, g: number, b: number) { light[0] = r; light[1] = g; light[2] = b; material.setParameter('uLight', light); },
    update(dt: number) {
      time += dt;
      // Wrapped so the noise never loses precision; a jump once every ten minutes goes unseen.
      material.setParameter('uTime', time % 600);
      shellMaterial.setParameter('uTime', time % 600);
      write();
      writeShells();
    },
    clear() { flames.length = 0; write(); [...shells].forEach(s => s.shell.remove()); },
    destroy() { [...shells].forEach(s => s.shell.remove()); entity.destroy(); buffer.destroy(); quad.destroy(); material.destroy(); shellMaterial.destroy(); flames.length = 0; },
  };
}
export type FlameSystem = ReturnType<typeof createFlames>;
