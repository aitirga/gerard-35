import * as pc from 'playcanvas';

/**
 * Reflections (docs/graphics.md, "Reflections"): what shiny things in the scene see of it.
 *
 * The sky (src/lighting.ts) gives every glossy surface a far, general reflection. A reflection probe
 * adds the near one: a cubemap rendered from a point in the scene (a crystal's middle), so glass and
 * polished things reflect what is really round them, the fighters, the floor, the light of the
 * particles. It renders at 256² a face, one face every third frame (the whole cube in under a
 * third of a second), only while something uses it, and only what is near (`far`), so it stays
 * cheap. Its mipmaps give rougher surfaces a blurrier reflection.
 */

/** A cube's six faces, as the engine's cubemap renderer turns its cameras. */
const FACES = [[0, 90, 0], [0, -90, 0], [-90, 0, 180], [90, 0, 180], [0, 180, 0], [0, 0, 0]] as const;

export interface ReflectionProbe {
  /** Where it sees from; move it with what reflects it. */
  readonly at: pc.Vec3;
  /** The cubemap, for a material's `cubeMap`. */
  readonly cubemap: pc.Texture;
  /** Whether it keeps rendering (one face a frame). */
  active: boolean;
  destroy(): void;
}

export function createReflections(app: pc.AppBase, options: { resolution?: number; far?: number; layers?: number[]; every?: number } = {}) {
  const device = app.graphicsDevice;
  /**
   * What reflects a probe lives on its own layer, which probes never render: a probe drawing a
   * crystal that samples the cubemap it is writing would be read and written at once. It is drawn
   * by the scene's cameras just before the world's transparent things, so particles inside glass
   * show over it.
   */
  let glass: pc.Layer | undefined;
  function glassLayer() {
    if (glass) return glass;
    glass = new pc.Layer({ name: 'Vidrio' });
    const layers = app.scene.layers, world = layers.getLayerById(pc.LAYERID_WORLD)!;
    layers.insertTransparent(glass, layers.getTransparentIndex(world));
    return glass;
  }
  /** The scene's own cameras (not probes, not offscreen ones) draw the glass layer too. */
  function showGlass(layer: pc.Layer) {
    for (const camera of app.root.findComponents('camera') as pc.CameraComponent[]) {
      if (camera.renderTarget || !camera.layers.includes(pc.LAYERID_WORLD) || camera.layers.includes(layer.id)) continue;
      camera.layers = [...camera.layers, layer.id];
    }
  }
  let tick = 0;
  const probes: { probe: ReflectionProbe; root: pc.Entity; cameras: pc.CameraComponent[]; face: number; filled: number }[] = [];

  function probe(at: { x: number; y: number; z: number }): ReflectionProbe {
    const resolution = Math.min(options.resolution ?? 256, device.maxCubeMapSize);
    const cubemap = new pc.Texture(device, {
      name: 'Sonda de reflejos', width: resolution, height: resolution, format: pc.PIXELFORMAT_SRGBA8, cubemap: true,
      mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR,
    });
    const root = new pc.Entity('Sonda de reflejos');
    root.setPosition(at.x, at.y, at.z);
    app.root.addChild(root);
    const cameras = FACES.map(([x, y, z], face) => {
      const e = new pc.Entity(`Cara ${face}`);
      e.addComponent('camera', {
        fov: 90, aspectRatio: 1, aspectRatioMode: pc.ASPECT_MANUAL, nearClip: .05, farClip: options.far ?? 6,
        layers: options.layers ?? [pc.LAYERID_WORLD, pc.LAYERID_SKYBOX], priority: -10,
        clearColor: new pc.Color(.02, .015, .03), gammaCorrection: pc.GAMMA_SRGB, toneMapping: pc.TONEMAP_ACES,
        renderTarget: new pc.RenderTarget({ name: `Reflejo ${face}`, colorBuffer: cubemap, depth: true, face, origin: pc.RENDERTARGET_ORIGIN_TOP }),
      });
      e.setLocalEulerAngles(x, y, z);
      e.enabled = false;
      root.addChild(e);
      return e.camera!;
    });
    const record = {
      root, cameras, face: 0, filled: 0,
      probe: {
        at: root.getPosition().clone(), cubemap, active: true,
        destroy() {
          const i = probes.indexOf(record);
          if (i >= 0) probes.splice(i, 1);
          cameras.forEach(c => (c.renderTarget as pc.RenderTarget | null)?.destroy());
          root.destroy(); cubemap.destroy();
        },
      } as ReflectionProbe,
    };
    probes.push(record);
    return record.probe;
  }

  return {
    probe,
    /** The layer for what reflects probes (glass), added to the scene's cameras. */
    glassLayer() { const layer = glassLayer(); showGlass(layer); return layer; },
    /**
     * Each frame: every active probe renders its next face every `every` frames (3: the whole cube
     * every 18 frames, under a third of a second), all six at first so it is never empty. Each face
     * draws what is within `far` of it (6 m), a few hundred draws in a fight.
     */
    update() {
      tick++;
      for (const p of probes) {
        p.root.setPosition(p.probe.at);
        p.cameras.forEach(c => { c.entity.enabled = false; });
        if (!p.probe.active) continue;
        if (p.filled >= 6 && tick % (options.every ?? 3)) continue;
        if (p.filled < 6) { p.cameras.forEach(c => { c.entity.enabled = true; }); p.filled = 6; continue; }
        p.cameras[p.face].entity.enabled = true;
        p.face = (p.face + 1) % 6;
      }
    },
    get count() { return probes.length; },
    destroy() { [...probes].forEach(p => p.probe.destroy()); },
  };
}
export type Reflections = ReturnType<typeof createReflections>;

// ── Glass ───────────────────────────────────────────────────────────────────────────────────────
// A faceted glass (crystals): it refracts the scene behind it, splitting red, green and blue a
// little apart at its edges (dispersion), reflects a probe more the more grazing the view (fresnel),
// glows faintly of its colour inside, lights its edges where faces meet (a per-vertex edge
// coordinate, `aEdge`: 0 on an edge) and catches a key light and the odd twinkle on its facets.
// It needs the scene colour behind it (post.glass(true)) and is drawn on the glass layer.
const GLASS_VS = /* wgsl */ `
attribute vertex_position: vec3f;
attribute vertex_normal: vec3f;
attribute aEdge: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vWorld: vec3f;
varying vNormalW: vec3f;
varying vEdge: vec3f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = uniform.matrix_model * vec4f(vertex_position, 1.0);
  output.vWorld = world.xyz;
  output.vNormalW = normalize((uniform.matrix_model * vec4f(vertex_normal, 0.0)).xyz);
  output.vEdge = aEdge;
  output.position = uniform.matrix_viewProjection * world;
  return output;
}`;

const GLASS_FS = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
var uSceneColorMap: texture_2d<f32>;
var uSceneColorMapSampler: sampler;
var uProbe: texture_cube<f32>;
var uProbeSampler: sampler;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uColour: vec3f;
uniform uGlass: vec4f;
varying vWorld: vec3f;
varying vNormalW: vec3f;
varying vEdge: vec3f;
fn behind(n: vec3f, v: vec3f, ior: f32) -> vec3f {
  let r = refract(-v, n, 1.0 / ior);
  return vWorld + r * uniform.uGlass.x;
}
fn sceneAt(p: vec3f) -> vec3f {
  return textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, getGrabScreenPos(uniform.matrix_viewProjection * vec4f(p, 1.0)), 0.0).rgb;
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let e = min(min(vEdge.x, vEdge.y), vEdge.z);
  let aa = fwidth(e);
  let n = normalize(vNormalW);
  let view = uniform.matrix_view;
  let v = normalize(vec3f(view[0][2], view[1][2], view[2][2]));
  let ndv = clamp(dot(n, v), 0.0, 1.0);
  let fresnel = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);
  // What is behind it, bent, each colour a little more than the last.
  var refr = vec3f(sceneAt(behind(n, v, 1.40)).r, sceneAt(behind(n, v, 1.45)).g, sceneAt(behind(n, v, 1.52)).b);
  refr *= mix(vec3f(1.0), uniform.uColour, 0.3);
  // What is round it, mirrored in its faces.
  var dir = reflect(-v, n);
  dir.x *= -1.0;
  let refl = textureSampleLevel(uProbe, uProbeSampler, dir, 0.0).rgb * 1.4;
  // Its own colour, glowing faintly within, brighter towards the rim.
  let inner = uniform.uColour * (0.12 + 0.4 * (1.0 - ndv)) * uniform.uGlass.y;
  // Its edges, where its faces meet.
  let edge = 1.0 - smoothstep(0.0, aa * 1.5 + 0.012, e);
  // A key light's glint and a twinkle now and then on one facet or another.
  let h = normalize(normalize(vec3f(-0.35, 0.85, 0.4)) + v);
  let spec = pow(max(dot(n, h), 0.0), 140.0) * 4.0;
  let facet = fract(sin(dot(floor(n * 7.0 + 0.5), vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
  let twinkle = pow(max(0.0, sin(uniform.uGlass.z * (1.5 + facet * 2.5) + facet * 40.0)), 30.0) * step(0.55, facet) * 3.0;
  var colour = mix(refr, refl, fresnel) + inner + uniform.uColour * edge * 1.8 + vec3f(spec) + vec3f(1.0, 0.96, 0.9) * twinkle * (1.0 - fresnel);
  #if (FOG != NONE)
    colour = mix(uniform.fog_color, colour, getFogFactor());
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  output.color = vec4f(colour * uniform.uGlass.w, uniform.uGlass.w);
  return output;
}`;

/** A glass material for faceted meshes with an edge coordinate (`glassMesh`), reflecting `cubemap`. */
export function glassMaterial(colour: string, cubemap: pc.Texture) {
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-glass', attributes: { vertex_position: pc.SEMANTIC_POSITION, vertex_normal: pc.SEMANTIC_NORMAL, aEdge: pc.SEMANTIC_ATTR8 },
    vertexWGSL: GLASS_VS, fragmentWGSL: GLASS_FS,
  });
  material.name = 'Vidrio';
  // Premultiplied, written whole: it composites what is behind it itself (refraction).
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_BACK;
  const c = new pc.Color().fromString(colour);
  material.setParameter('uColour', new Float32Array([c.r ** 2.2, c.g ** 2.2, c.b ** 2.2]));
  material.setParameter('uProbe', cubemap);
  const glass = new Float32Array([.25, 1, 0, 0]);
  material.setParameter('uGlass', glass);
  material.update();
  return {
    material,
    /** How far behind it it looks (m, its thickness), how much it glows, the time and how visible it is (0–1). */
    set(depth: number, glow: number, time: number, visible: number) { glass[0] = depth; glass[1] = glow; glass[2] = time % 600; glass[3] = visible; material.setParameter('uGlass', glass); },
  };
}

/**
 * Builds a mesh of flat-shaded triangles with the edge coordinate the glass draws its edges with:
 * each triangle lists its corners and which of its edges are real (an edge inside a flat face,
 * splitting a quad, is not drawn).
 */
export function glassMesh(device: pc.GraphicsDevice, triangles: readonly { corners: readonly [pc.Vec3, pc.Vec3, pc.Vec3]; hidden?: number }[]) {
  const positions: number[] = [], normals: number[] = [], edges: number[] = [];
  for (const { corners: [a, b, c], hidden } of triangles) {
    const n = new pc.Vec3().cross(new pc.Vec3().sub2(b, a), new pc.Vec3().sub2(c, a)).normalize();
    [a, b, c].forEach((p, i) => {
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      // Barycentric: 0 along the edge opposite each corner; a hidden edge never reaches 0.
      const e = [0, 0, 0]; e[i] = 1;
      if (hidden !== undefined) e[hidden] = 1;
      edges.push(...e);
    });
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(positions)); mesh.setNormals(new Float32Array(normals));
  mesh.setVertexStream(pc.SEMANTIC_ATTR8, new Float32Array(edges), 3);
  mesh.setIndices(Array.from({ length: positions.length / 3 }, (_, i) => i));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}
