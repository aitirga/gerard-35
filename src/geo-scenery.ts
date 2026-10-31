import * as pc from 'playcanvas';
import { flankRun, type GeoBuilding, type GeoPoint, type GeoScene } from './geo';
import { shine } from './lighting';
import { BUILDING_CUT_NEAR, buildingHidesPlayer, createBuildingOccluder } from './building-occlusion';
import { gpuTexture, grainOf, greyOf, loadTextures, tintColour, type LoadedTexture } from './materials';
import { LANDMARKS, type LandmarkKit } from './landmarks';

/** What `buildScenery` lends a generated place, so everything is tracked and destroyed with the scene. */
export interface GeoKit {
  app: pc.Application;
  root: pc.Entity;
  batch: number;
  mat: (name: string, hex: string, gloss?: number, glow?: number) => pc.StandardMaterial;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
  water: pc.StandardMaterial;
  /** Grid → scene coordinates. */
  x: (px: number) => number;
  z: (pz: number) => number;
}

/** One facade bay is this wide in cells; textures repeat once per bay and storey. */
const BAY = 1.8;
/** Facades painted as an atlas of several bays × storeys, so a long wall does not repeat one window. */
const FACADE_ATLAS: Record<string, [number, number]> = { flats: [4, 3] };
const EAVE = 0.35;
const ROOF_PITCH = Math.tan(30 * Math.PI / 180);
/** Ground layers stack a hair apart so large flat polygons never z-fight. */
const LAYER = { ground: 0.004, grass: 0.012, sand: 0.014, forest: 0.016, square: 0.02, water: 0.028, path: 0.036, road: 0.042, rail: 0.046, bridge: 0.07 };
/** How strongly a real material's grain shows through the painted walls (hard light, 0–1). */
const GRAIN = 0.85;
/** A roof's slope is this much longer than the ground it covers (30° pitch). */
const SLOPE = 1 / Math.cos(30 * Math.PI / 180);
/**
 * Radius of the see-through opening round Gerard, the glowing edge where it meets solid wall,
 * how much it widens per unit towards the camera, and how quickly it opens.
 */
const CUT_RADIUS = 5;
const CUT_EDGE = 0.14;
/** How far the edge's light bleeds softly into the wall beyond it. */
const CUT_HALO = 0.5;
/** Height of the wall foot left inside the cut, from the focus (0.7 above Gerard's feet). */
const CUT_STUB = -0.25;
const CUT_FLARE = 0.25;
const CUT_RATE = 8;
/** The warm light the edge glows with. */
const CUT_GLOW = '1.0, 0.86, 0.6';
type V3 = [number, number, number];
interface BuildingCut { triangles: number[]; instances: pc.MeshInstance[]; radius: number }

/**
 * Buildings keep their shape: what lies between Gerard and the camera, inside a cylinder round
 * the line of sight that flares out towards it, is cut away, and the cut is traced by a glowing
 * edge whose light bleeds softly into the solid wall beyond it.
 * Shadows are left whole.
 */
const CUT = {
  near: BUILDING_CUT_NEAR.toFixed(2), radius: CUT_RADIUS.toFixed(1), edge: CUT_EDGE.toFixed(2), halfEdge: (CUT_EDGE * 0.5).toFixed(2),
  halo: CUT_HALO.toFixed(2), stub: CUT_STUB.toFixed(2), flare: CUT_FLARE.toFixed(2),
};
const CUTAWAY_DECLARATION = `
uniform vec3 geoCutFocus;
uniform vec3 geoCutToCamera;
uniform float geoCutRadius;
float geoCutGlow = 0.0;
`;
const CUTAWAY_MAIN = `
// The depth prepass (soft particles, tilt-shift and contact shadows in src/post.ts) must see the same
// hole, or they'd read a wall that isn't there.
#if defined(FORWARD_PASS) || defined(PREPASS_PASS)
if (geoCutRadius > 0.0) {
  vec3 cutOffset = vPositionW - geoCutFocus;
  float cutAlong = dot(cutOffset, geoCutToCamera);
  if (cutAlong > ${CUT.near}) {
    float cutAcross = length(cutOffset - geoCutToCamera * cutAlong);
    float cutReach = geoCutRadius * (1.0 + ${CUT.flare} * (cutAlong - ${CUT.near}) / ${CUT.radius});
    // The foot of every wall stays, so the building's edge still shows where Gerard can't pass.
    float cutStub = vPositionW.y - (geoCutFocus.y + ${CUT.stub});
    float cutInside = step(cutAcross, cutReach - ${CUT.edge});
    if (cutInside * step(0.0, cutStub) > 0.5) discard;
    float cutRing = 1.0 - smoothstep(cutReach - ${CUT.halfEdge}, cutReach + ${CUT.halo}, cutAcross);
    float cutFoot = step(cutAcross, cutReach) * smoothstep(-${CUT.halo}, -${CUT.halfEdge}, cutStub);
    geoCutGlow = max(cutRing, cutFoot);
  }
}
#endif
`;
const CUTAWAY_END = `
#ifdef FORWARD_PASS
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${CUT_GLOW}), geoCutGlow * 0.75);
#endif
`;
/** The same cut in WGSL for WebGPU, line for line with the GLSL above (keep both in step). */
const CUTAWAY_DECLARATION_WGSL = `
uniform geoCutFocus: vec3f;
uniform geoCutToCamera: vec3f;
uniform geoCutRadius: f32;
var<private> geoCutGlow: f32 = 0.0;
`;
const CUTAWAY_MAIN_WGSL = `
// The depth prepass (soft particles, tilt-shift and contact shadows in src/post.ts) must see the same
// hole, or they'd read a wall that isn't there.
#if defined(FORWARD_PASS) || defined(PREPASS_PASS)
if (uniform.geoCutRadius > 0.0) {
  let cutOffset = vPositionW - uniform.geoCutFocus;
  let cutAlong = dot(cutOffset, uniform.geoCutToCamera);
  if (cutAlong > ${CUT.near}) {
    let cutAcross = length(cutOffset - uniform.geoCutToCamera * cutAlong);
    let cutReach = uniform.geoCutRadius * (1.0 + ${CUT.flare} * (cutAlong - ${CUT.near}) / ${CUT.radius});
    // The foot of every wall stays, so the building's edge still shows where Gerard can't pass.
    let cutStub = vPositionW.y - (uniform.geoCutFocus.y + ${CUT.stub});
    let cutInside = step(cutAcross, cutReach - ${CUT.edge});
    if (cutInside * step(0.0, cutStub) > 0.5) { discard; }
    let cutRing = 1.0 - smoothstep(cutReach - ${CUT.halfEdge}, cutReach + ${CUT.halo}, cutAcross);
    let cutFoot = step(cutAcross, cutReach) * smoothstep(-${CUT.halo}, -${CUT.halfEdge}, cutStub);
    geoCutGlow = max(cutRing, cutFoot);
  }
}
#endif
`;
const CUTAWAY_END_WGSL = `
#ifdef FORWARD_PASS
output.color = vec4f(mix(output.color.rgb, vec3f(${CUT_GLOW}), geoCutGlow * 0.75), output.color.a);
#endif
`;

/** Collects triangles with flat normals; every face is wound so its normal agrees with `facing`. */
export class MeshBuilder {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; indices: number[] = [];
  /** `smooth`: a normal for each corner instead of the face's, so a curved surface drawn in facets shades round. */
  tri(a: V3, b: V3, c: V3, facing: V3, ua: number[] = [0, 0], ub: number[] = [0, 0], uc: number[] = [0, 0], smooth?: [V3, V3, V3]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    n = [n[0] / len, n[1] / len, n[2] / len];
    let [na, nb, nc] = smooth ?? [n, n, n];
    if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] < 0) {
      [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = [-n[0], -n[1], -n[2]];
      [na, nb, nc] = smooth ? [na, nc, nb] : [n, n, n];
    }
    const base = this.positions.length / 3;
    for (const [p, t, m] of [[a, ua, na], [b, ub, nb], [c, uc, nc]] as const) { this.positions.push(...p); this.normals.push(...m); this.uvs.push(...t); }
    this.indices.push(base, base + 1, base + 2);
  }
  quad(a: V3, b: V3, c: V3, d: V3, facing: V3, ua: number[], ub: number[], uc: number[], ud: number[], smooth?: [V3, V3, V3, V3]) {
    this.tri(a, b, c, facing, ua, ub, uc, smooth && [smooth[0], smooth[1], smooth[2]]);
    this.tri(a, c, d, facing, ua, uc, ud, smooth && [smooth[0], smooth[2], smooth[3]]);
  }
  mesh(device: pc.GraphicsDevice) {
    const m = new pc.Mesh(device);
    m.setPositions(this.positions); m.setNormals(this.normals); m.setUvs(0, this.uvs); m.setIndices(this.indices); m.update();
    return m;
  }
  get empty() { return this.indices.length === 0; }
}

function inside(px: number, pz: number, poly: GeoPoint[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[j];
    if ((z1 > pz) !== (z2 > pz) && px < (x2 - x1) * (pz - z1) / (z2 - z1) + x1) hit = !hit;
  }
  return hit;
}
function signedArea(poly: GeoPoint[]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a / 2;
}
/** Ear clipping for simple polygons, as triangles of vertex indices. */
function triangulate(poly: GeoPoint[]): [number, number, number][] {
  const ccw = signedArea(poly) > 0;
  const idx = poly.map((_, i) => i);
  const out: [number, number, number][] = [];
  const cross = (a: GeoPoint, b: GeoPoint, c: GeoPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = poly.length * poly.length;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const turn = cross(poly[i0], poly[i1], poly[i2]);
      if (ccw ? turn <= 0 : turn >= 0) continue;
      const tri = [poly[i0], poly[i1], poly[i2]];
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(poly[j][0], poly[j][1], tri))) continue;
      out.push([i0, i1, i2]); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break; // Self-touching rings: fan the rest rather than lose the area.
  }
  for (let k = 1; k + 1 < idx.length; k++) out.push([idx[0], idx[k], idx[k + 1]]);
  return out;
}

/**
 * Builds a place generated from map data: ground layers, roads and rails, a river, and every
 * building extruded from its real footprint with a hipped roof and painted facades. Buildings
 * between Gerard and the camera keep their height and open a cut round him traced by a glowing edge.
 */
export function buildGeo(kit: GeoKit, scene: GeoScene) {
  const { app, root, mat, x, z } = kit;
  const device = app.graphicsDevice;
  const meshes: pc.Mesh[] = [];
  const buildingCuts = new Map<pc.Entity, BuildingCut>();
  /** Building materials open the glowing cut; the ground and streets never do. */
  function cutaway<M extends pc.StandardMaterial>(m: M) {
    const glsl = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL), wgsl = m.getShaderChunks(pc.SHADERLANGUAGE_WGSL);
    glsl.set('litUserDeclarationPS', CUTAWAY_DECLARATION);
    glsl.set('litUserMainStartPS', CUTAWAY_MAIN);
    glsl.set('litUserMainEndPS', CUTAWAY_END);
    wgsl.set('litUserDeclarationPS', CUTAWAY_DECLARATION_WGSL);
    wgsl.set('litUserMainStartPS', CUTAWAY_MAIN_WGSL);
    wgsl.set('litUserMainEndPS', CUTAWAY_END_WGSL);
    m.update(); return m;
  }
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const P = (p: GeoPoint, y: number): V3 => [x(p[0]), y, z(p[1])];
  function add(name: string, builder: MeshBuilder, m: pc.Material, parent = root, batched = true, shadows = true) {
    if (builder.empty) return;
    const mesh = builder.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    const instance = new pc.MeshInstance(mesh, m);
    e.addComponent('render', { meshInstances: [instance], castShadows: shadows, receiveShadows: true, ...(batched ? { batchGroupId: kit.batch } : {}) });
    const cut = buildingCuts.get(parent);
    if (cut) {
      // Use the same triangles that are drawn, including roofs and signs. Empty space in a
      // footprint's bounding box must never count as a wall in front of Gerard.
      for (const index of builder.indices) cut.triangles.push(...builder.positions.slice(index * 3, index * 3 + 3));
      cut.instances.push(instance);
      instance.setParameter('geoCutRadius', 0);
    }
    parent.addChild(e); return e;
  }
  function textured(name: string, c: HTMLCanvasElement, gloss = 0.12) {
    const m = mat(name, '#ffffff', gloss); m.diffuseMap = kit.texture(c); m.update(); return m;
  }
  function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
  }

  // ------------------------------------------------------------ real materials
  // Every surface is painted first. The real textures the scene names (scene.textures, embedded by
  // tools/geo.py) load meanwhile and then replace the paint on the ground and roofs, and lay their
  // grain under the painted walls; a texture that fails to load leaves its surface painted.
  // Ground, street and roof UVs count metres, so materials tile by their real size.
  const cellM = scene.cell_m;
  let loaded = new Map<string, LoadedTexture>();
  const gpu = new Map<string, pc.Texture>();
  const onLoad: (() => void)[] = [];
  let alive = true;
  /** A loaded texture's albedo, normal map, or albedo in grey (`grey`, for tinting), uploaded once per scene. */
  function image(id: string, which: 'albedo' | 'normal' | 'grey') {
    const t = loaded.get(id), img = t && (which === 'grey' ? greyOf(t).canvas : t[which]);
    if (!img) return undefined;
    let gpuT = gpu.get(`${id}|${which}`);
    if (!gpuT) { gpuT = gpuTexture(device, img, `${id} ${which}`); gpu.set(`${id}|${which}`, gpuT); }
    return gpuT;
  }
  /** Puts a loaded texture on a material: tiled by its real size, tinted, with its normal map. */
  function dress(m: pc.StandardMaterial, id: string, tint?: string) {
    const t = loaded.get(id);
    if (!t) return;
    const [sw, sh] = [t.info.size_m[0], t.info.size_m[1] ?? t.info.size_m[0]];
    m.diffuseMap = image(id, tint ? 'grey' : 'albedo')!; m.diffuseMapTiling.set(1 / sw, 1 / sh);
    const normal = image(id, 'normal');
    if (normal) { m.normalMap = normal; m.normalMapTiling.set(1 / sw, 1 / sh); m.bumpiness = 0.8; }
    m.diffuse.copy(tint ? tintColour(tint, greyOf(t)) : pc.Color.WHITE);
    m.update();
  }
  /** A surface painted on `painted` (repeating `perCell` times per cell), dressed in the scene's material for `slot` once it loads. */
  function surface(name: string, slot: string, painted: HTMLCanvasElement, perCell: number, gloss = 0.05) {
    const m = textured(name, painted, gloss);
    m.diffuseMapTiling.set(perCell / cellM, perCell / cellM); m.update();
    const real = scene.materials?.[slot];
    if (real) onLoad.push(() => dress(m, real.texture, real.tint));
    return m;
  }

  // ------------------------------------------------------------ ground
  const W = scene.width, D = scene.depth;
  /** Ground and street UVs: metres on the map, so textures run on across polygons and roads. */
  const metres = (p: GeoPoint) => [p[0] * cellM, p[1] * cellM];
  function flat(name: string, polys: GeoPoint[][], y: number, m: pc.Material) {
    const b = new MeshBuilder();
    for (const poly of polys) for (const [i, j, k] of triangulate(poly)) {
      b.tri(P(poly[i], y), P(poly[j], y), P(poly[k], y), [0, 1, 0], metres(poly[i]), metres(poly[j]), metres(poly[k]));
    }
    const e = add(name, b, m, root, true, false);
    return e;
  }
  function speckles(base: string, specks: string[], size = 128, count = 900) {
    return canvas(size, size, ctx => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < count; i++) { ctx.fillStyle = specks[i % specks.length]; ctx.fillRect(jitter(i) * size, jitter(i + 7e3) * size, 2, 2); }
    });
  }
  const look = scene.look ?? {};
  /** Barcelona's renewed sidewalks: small light-grey square tiles, a few a shade lighter or darker. */
  function panot() {
    return canvas(256, 256, ctx => {
      ctx.fillStyle = '#8f8f8a'; ctx.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 16; r++) for (let k = 0; k < 16; k++) {
        ctx.fillStyle = `hsl(40, 4%, ${66 + jitter(r * 16 + k) * 7}%)`;
        ctx.fillRect(k * 16 + 1, r * 16 + 1, 14, 14);
      }
      for (let i = 0; i < 160; i++) { ctx.fillStyle = 'rgba(70,66,60,.16)'; ctx.fillRect(jitter(i + 3e3) * 256, jitter(i + 4e3) * 256, 2, 2); }
    });
  }
  const groundMat = look.ground === 'panot' ? surface('Panot gris', 'ground', panot(), 0.25, 0.08)
    : surface('Suelo urbano', 'ground', speckles('#cbc2ab', ['#bfb59c', '#d6cdb8', '#b8ad94']), 0.25);
  // On a hilltop (`drop`) the ground ends at the brow; elsewhere it fills the map.
  flat('Suelo', [scene.drop?.edge ?? [[-0.5, -0.5], [W - 0.5, -0.5], [W - 0.5, D - 0.5], [-0.5, D - 0.5]]], LAYER.ground, groundMat);
  flat('Arena', scene.areas.sand ?? [], LAYER.sand, surface('Arena', 'sand', speckles('#e3cf9f', ['#d8c08a', '#efdfb8', '#cdb27a']), 0.25));
  if (look.grass === 'bed') {
    // Planted beds: dark soil with fallen leaves under clumps of low shrubs and grasses.
    flat('Parterres', scene.areas.grass, LAYER.grass, surface('Tierra del parterre', 'bed', speckles('#4f4234', ['#5e4d3b', '#7a5a35', '#3f352a', '#8c6a3c'], 128, 1400), 0.25));
    const shrubs = [mat('Arbusto', '#56733f', 0.1), mat('Arbusto claro', '#7b9150', 0.1), mat('Gramínea', '#93a05c', 0.1), mat('Arbusto oscuro', '#3f5a34', 0.1)];
    // Shrubs keep clear of whatever stands in the bed: a pit round each trunk, room around barriers and sacks.
    const clear = scene.props.filter(p => p.kind !== 'manhole' && p.kind !== 'car' && p.kind !== 'bus')
      .map(p => ({ x: p.x, z: p.z, r: p.kind === 'tree' ? 0.55 : 0.85 }));
    const crowded = (px: number, pz: number, r: number) => clear.some(c => Math.abs(px - c.x) < c.r + r * 0.35 && Math.abs(pz - c.z) < c.r + r * 0.35);
    let k = 0;
    for (const poly of scene.areas.grass) {
      const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
      for (let gz = Math.min(...zs) + 0.4; gz < Math.max(...zs); gz += 0.85) for (let gx = Math.min(...xs) + 0.3; gx < Math.max(...xs); gx += 0.95) {
        const px = gx + (jitter(k * 3 + 1) - 0.5) * 0.5, pz = gz + (jitter(k * 3 + 2) - 0.5) * 0.4, r = 0.45 + jitter(k * 3 + 3) * 0.4;
        k++;
        if (!inside(px, pz, poly) || crowded(px, pz, r)) continue;
        const e = new pc.Entity('Mata');
        e.addComponent('render', { type: 'sphere', material: shrubs[k % shrubs.length], castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
        e.setPosition(x(px), 0.05, z(pz)); e.setLocalScale(r, r * (0.55 + jitter(k) * 0.4), r); root.addChild(e);
      }
    }
  } else flat('Huertas y jardines', scene.areas.grass, LAYER.grass, surface('Hierba', 'grass', speckles('#86a462', ['#7a9858', '#95b36d', '#6f8c4f']), 0.25));
  const undergrowth = surface('Sotobosque', 'forest', speckles('#4f6d42', ['#45603a', '#5c7b4b', '#3d5634']), 0.25);
  flat('Bosque', scene.areas.forest, LAYER.forest, undergrowth);
  const plaza = surface('Losas de la plaza', 'square', canvas(128, 128, ctx => {
    ctx.fillStyle = '#a99d88'; ctx.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `hsl(${30 + jitter(r * 4 + k) * 8}, 18%, ${68 + jitter(r * 9 + k) * 8}%)`;
      ctx.fillRect(k * 32 + 1, r * 32 + 1, 30, 30);
    }
  }), 0.5, 0.1);
  flat('Plazas', scene.areas.square, LAYER.square, plaza);
  // Rivers reuse the pool's caustics, tinted deep green and drifting downstream.
  const river = mat('Río', '#7f9f8c', 0.85);
  river.diffuseMap = kit.water.diffuseMap; river.emissive.fromString('#6f9a86'); river.emissiveMap = kit.water.diffuseMap; river.emissiveIntensity = 0.08;
  river.diffuseMapTiling.set(0.08 / cellM, 0.08 / cellM); river.emissiveMapTiling.set(0.08 / cellM, 0.08 / cellM);
  shine(river, 'water');
  flat('Río', scene.areas.water, LAYER.water, river);
  let time = 0;

  // ------------------------------------------------------------ roads, paths, rails, bridges
  // Street UVs are metres on the map too (not along each segment), so the asphalt runs on unbroken.
  const asphalt = look.asphalt
    ? surface('Asfalto nuevo', 'road', speckles(look.asphalt, ['#36383b', '#4a4c4f', '#525457']), 0.5)
    : surface('Asfalto', 'road', speckles('#66625e', ['#5b5854', '#726e69', '#7c7771']), 0.5);
  // Barcelona's bike lanes are the same black asphalt; the Basque bidegorri is red.
  const bikeway = look.asphalt ? asphalt : surface('Bidegorri', 'bike', speckles('#8a6b5f', ['#7e6156', '#957568']), 0.5);
  const footway = surface('Senda', 'footway', speckles('#b7a888', ['#a99a7b', '#c3b596']), 0.5);
  const ballast = surface('Balasto', 'rail', speckles('#857b6f', ['#6f665b', '#9a9083', '#5f574e']), 0.5);
  const bridgeStone = mat('Piedra del puente', '#b3a68d', 0.1);
  const bridgeDeck = surface('Tablero del puente', 'bridge', speckles('#b3a68d', ['#a89a80', '#bdb199']), 0.5, 0.1);
  const steel = mat('Carriles', '#5a5652', 0.6), sleeper = mat('Traviesas', '#6b5a48', 0.1);
  const barrier = mat('Bionda', '#c9c6bd', 0.4);
  function ribbon(builder: MeshBuilder, line: GeoPoint[], half: number, y: number) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-3) continue;
      const nx = -(b[1] - a[1]) / len * half, nz = (b[0] - a[0]) / len * half;
      // Each segment runs a little past its ends so joints have no gaps.
      const ex = (b[0] - a[0]) / len * half * 0.6, ez = (b[1] - a[1]) / len * half * 0.6;
      const s0 = [a[0] - ex, a[1] - ez], s1 = [b[0] + ex, b[1] + ez];
      const c: GeoPoint[] = [[s0[0] + nx, s0[1] + nz], [s1[0] + nx, s1[1] + nz], [s1[0] - nx, s1[1] - nz], [s0[0] - nx, s0[1] - nz]];
      builder.quad(P(c[0], y), P(c[1], y), P(c[2], y), P(c[3], y), [0, 1, 0], metres(c[0]), metres(c[1]), metres(c[2]), metres(c[3]));
    }
  }
  /** Thin walls along both edges of a line: bridge parapets, rails, crash barriers. */
  function edges(name: string, line: GeoPoint[], offset: number, h: number, thick: number, y: number, m: pc.Material) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-3) continue;
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      for (const side of [-1, 1]) {
        const nx = -(b[1] - a[1]) / len * offset * side, nz = (b[0] - a[0]) / len * offset * side;
        const e = new pc.Entity(name);
        e.addComponent('render', { type: 'box', material: m, castShadows: true, receiveShadows: true, batchGroupId: kit.batch });
        e.setPosition(x((a[0] + b[0]) / 2 + nx), y + h / 2, z((a[1] + b[1]) / 2 + nz)); e.setEulerAngles(0, yaw, 0); e.setLocalScale(len, h, thick);
        root.addChild(e);
      }
    }
  }
  const layers = { road: new MeshBuilder(), bike: new MeshBuilder(), foot: new MeshBuilder(), rail: new MeshBuilder(), motorway: new MeshBuilder(), bridge: new MeshBuilder() };
  for (const road of scene.roads) {
    const half = Math.max(road.width / 2, 0.75);
    if (road.kind === 'rail') {
      ribbon(layers.rail, road.line, half, LAYER.rail);
      edges('Carril', road.line, 0.6, 0.12, 0.08, LAYER.rail, steel);
      for (let i = 0; i + 1 < road.line.length; i++) {
        const [a, b] = [road.line[i], road.line[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        for (let t = 0.4; t < len; t += 0.8) {
          const e = new pc.Entity('Traviesa');
          e.addComponent('render', { type: 'box', material: sleeper, castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
          e.setPosition(x(a[0] + (b[0] - a[0]) * t / len), LAYER.rail + 0.03, z(a[1] + (b[1] - a[1]) * t / len)); e.setEulerAngles(0, yaw, 0); e.setLocalScale(0.25, 0.05, 1.7);
          root.addChild(e);
        }
      }
    } else if (road.kind === 'motorway') {
      ribbon(layers.motorway, road.line, half, LAYER.road);
      edges('Bionda', road.line, half - 0.1, 0.45, 0.12, LAYER.road, barrier);
    } else if (road.kind === 'bridge') {
      ribbon(layers.bridge, road.line, half, LAYER.bridge);
      edges('Pretil', road.line, half + 0.12, 0.55, 0.28, 0, bridgeStone);
    } else if (road.kind === 'path') ribbon(road.highway === 'cycleway' ? layers.bike : layers.foot, road.line, half, LAYER.path);
    else ribbon(layers.road, road.line, half, LAYER.road);
  }
  add('Calles', layers.road, asphalt, root, true, false);
  add('Autovía', layers.motorway, asphalt, root, true, false);
  add('Bidegorri', layers.bike, bikeway, root, true, false);
  // On panot the sidewalk is the ground itself, so footways are not drawn over it.
  if (look.footway !== 'panot') add('Sendas', layers.foot, footway, root, true, false);
  add('Vía del tren', layers.rail, ballast, root, true, false);
  add('Puente', layers.bridge, bridgeDeck, root, true, false);

  // ------------------------------------------------------------ facades and roofs
  const textures = new Map<string, pc.StandardMaterial>();
  /** Each building's pivot, so its signs belong to it. */
  const pivots = new Map<string, pc.Entity>();
  const bayM = BAY * cellM, storeyM = scene.storey * cellM;
  /**
   * One bay of one storey (or two bays of the ground floor), painted once per look and colour. With
   * real materials (`grain`: texture ids for the upper floors' wall and the ground floor's base), the
   * texture's grain is laid under the painted windows once it loads, tinted by the wall's own colour.
   */
  function facade(kind: string, wall: string, trim: string, base: string, grain: { wall?: string; base?: string } = {}) {
    const key = `${kind}|${wall}|${trim}|${base}|${grain.wall}|${grain.base}`;
    let m = textures.get(key);
    if (m) return m;
    const ground = ['masonry', 'arcade', 'ashlar', 'ashlar-arcade', 'shops', 'lobby', 'mall-front'].includes(kind);
    const [atlasU, atlasV] = FACADE_ATLAS[kind] ?? [1, 1];
    const w = ground ? 256 : 128 * atlasU, h = 192 * atlasV;
    const glass = '#2c3a42', wood = '#5b3d2a';
    // Varies blinds, shutters and awnings between walls of different colours.
    const seed = [...wall].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const draw = (ctx: CanvasRenderingContext2D) => {
      // Painted top-down, as a facade is read; the wall's v runs bottom-up, so the canvas is flipped.
      ctx.setTransform(1, 0, 0, -1, 0, h);
      /** A plain wall in `fill`, with the real material's grain over it once loaded. */
      const paint = (fill: string, slot: 'wall' | 'base') => {
        ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h);
        const t = grain[slot] ? loaded.get(grain[slot]!) : undefined;
        if (!t) return false;
        // Whole tiles per bay and storey, so the grain repeats with the painted bays without a seam.
        const g = grainOf(t), [sw, sh = sw] = t.info.size_m;
        const across = Math.max(1, Math.round(bayM / sw)), up = Math.max(1, Math.round(storeyM * (ground ? 1.15 : 1) / sh));
        const pattern = ctx.createPattern(g, 'repeat')!;
        pattern.setTransform(new DOMMatrix().scale(128 / across / g.width, 192 / up / g.height));
        ctx.save(); ctx.globalCompositeOperation = 'hard-light'; ctx.globalAlpha = GRAIN; ctx.fillStyle = pattern; ctx.fillRect(0, 0, w, h); ctx.restore();
        return true;
      };
      /** Stone courses: painted joints a miniature can read, over the real stone's grain (or painted shades without one). */
      const stones = (fill: string, rows: number, slot: 'wall' | 'base') => {
        const real = paint(fill, slot), rh = h / rows;
        if (!real) for (let r = 0; r < rows; r++) for (let k = -1; k < w / 40 + 1; k++) {
          ctx.fillStyle = `rgba(${jitter(r * 13 + k) > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + jitter(r * 7 + k) * 0.06})`;
          ctx.fillRect(k * 40 + (r % 2) * 20 + 1, r * rh + 1, 38, rh - 2);
        }
        ctx.strokeStyle = 'rgba(60,50,40,.28)'; ctx.lineWidth = 1.5;
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(w, r * rh); ctx.stroke(); }
        for (let r = 0; r < rows; r++) for (let k = 0; k < w / 40 + 1; k++) { ctx.beginPath(); ctx.moveTo(k * 40 + (r % 2) * 20, r * rh); ctx.lineTo(k * 40 + (r % 2) * 20, (r + 1) * rh); ctx.stroke(); }
      };
      const window = (x0: number, y0: number, ww: number, wh: number, frame: string) => {
        ctx.fillStyle = frame; ctx.fillRect(x0 - 5, y0 - 5, ww + 10, wh + 10);
        ctx.fillStyle = glass; ctx.fillRect(x0, y0, ww, wh);
        ctx.fillStyle = 'rgba(190,220,235,.22)'; ctx.fillRect(x0 + 3, y0 + 3, ww * 0.35, wh - 6);
        ctx.fillStyle = frame; ctx.fillRect(x0 + ww / 2 - 2, y0, 4, wh);
      };
      if (kind === 'hedge') {
        // A clipped hedge (Uri's maze, docs/quests/nuria.md): the wall colour, flecked with leaves.
        paint(wall, 'wall');
        for (let k = 0; k < 220; k++) {
          ctx.fillStyle = jitter(k * 3.1) > .5 ? 'rgba(20,40,15,.22)' : 'rgba(200,235,150,.16)';
          ctx.beginPath(); ctx.arc(jitter(k * 1.7) * w, jitter(k * 2.3) * h, 3 + jitter(k * 5.9) * 7, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 'rendered' || kind === 'timber') {
        paint(wall, 'wall');
        if (kind === 'timber') {
          ctx.fillStyle = trim;
          ctx.fillRect(0, 0, w, 9); ctx.fillRect(0, h - 9, w, 9); ctx.fillRect(0, 0, 8, h); ctx.fillRect(w - 8, 0, 8, h);
          ctx.save(); ctx.translate(14, h - 14); ctx.rotate(-0.95); ctx.fillRect(0, -4, 70, 8); ctx.restore();
        }
        window(36, 46, 56, 92, kind === 'timber' ? '#efe6d4' : trim);
        ctx.fillStyle = kind === 'timber' ? '#7a4b2f' : '#3f6b4a';
        ctx.fillRect(18, 41, 14, 102); ctx.fillRect(96, 41, 14, 102);
        // A wooden balcony rail under each window.
        ctx.fillStyle = wood; ctx.fillRect(26, 138, 76, 8);
        for (let i = 0; i < 9; i++) ctx.fillRect(28 + i * 9, 146, 4, 26);
        ctx.fillRect(22, 170, 84, 7);
      } else if (kind === 'iron-balconies') {
        paint(wall, 'wall');
        ctx.fillStyle = trim; ctx.fillRect(0, h - 14, w, 14);
        window(34, 30, 60, 128, trim);
        ctx.fillStyle = '#b7b0a2'; ctx.fillRect(18, 150, 92, 9);
        ctx.fillStyle = '#1f2224';
        ctx.fillRect(18, 108, 92, 5);
        for (let i = 0; i < 12; i++) ctx.fillRect(20 + i * 8, 108, 2.5, 44);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = ['#d23a4a', '#e8607a', '#c22f3a', '#4f7a3a'][i % 4];
          ctx.beginPath(); ctx.arc(22 + i * 6.3, 104 + jitter(i) * 6, 4 + jitter(i + 3) * 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 'flats') {
        // Barcelona blocks of flats, four bays by three storeys: each bay keeps its kind of opening
        // all the way up (window, balcony, enclosed gallery), while blinds, lights, plants,
        // washing and air conditioners change from flat to flat.
        paint(wall, 'wall');
        const r = (i: number) => jitter(seed * 7.3 + i);
        const blindColours = ['#efe9dc', '#b8a98c', '#8a7a5e', '#5f6e57', '#a39d90', '#d9d2c2', '#7d8a8f'];
        const blindColour = blindColours[Math.floor(r(1) * blindColours.length)];
        const railing = r(2) > 0.55 ? 'panel' : 'iron';
        const panel = ['#c9c4b8', '#8c9696', '#d8cdb7', '#a7b3ad'][Math.floor(r(3) * 4)];
        const kinds = ['window', 'balcony', 'gallery', 'balcony', 'twin', 'balcony'];
        const bayKinds = Array.from({ length: atlasU }, (_, k) => kinds[Math.floor(r(10 + k) * kinds.length)]);
        // A blind of horizontal slats, `down` of the opening, in the building's colour.
        const blind = (x0: number, y0: number, ww: number, hh: number, down: number) => {
          ctx.fillStyle = blindColour; ctx.fillRect(x0, y0, ww, hh * down);
          ctx.fillStyle = 'rgba(0,0,0,.13)'; for (let y = y0 + 3; y < y0 + hh * down; y += 4) ctx.fillRect(x0, y, ww, 1);
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0 - 3, y0 - 6, ww + 6, 6);
        };
        const pane = (x0: number, y0: number, ww: number, hh: number, lit: boolean) => {
          ctx.fillStyle = lit ? '#f1c77a' : glass; ctx.fillRect(x0, y0, ww, hh);
          if (lit) { ctx.fillStyle = 'rgba(255,245,220,.6)'; ctx.fillRect(x0 + 2, y0, ww * 0.3, hh); ctx.fillRect(x0 + ww * 0.68, y0, ww * 0.3, hh); }
          else { ctx.fillStyle = 'rgba(190,220,235,.22)'; ctx.fillRect(x0 + 3, y0 + 3, ww * 0.3, hh - 6); }
        };
        for (let fy = 0; fy < atlasV; fy++) for (let bx = 0; bx < atlasU; bx++) {
          const x0 = bx * 128, y0 = fy * 192, i = 40 + fy * 13 + bx * 5;
          const lit = r(i) > 0.8, closed = !lit && r(i + 1) > 0.85, down = closed ? 1 : r(i + 2) * r(i + 5) * 0.85;
          ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(x0, y0 + 182, 128, 10);
          const kind = bayKinds[bx];
          if (kind === 'gallery') {
            // An enclosed balcony: aluminium frames, three sliding panes over an opaque panel.
            ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x0 + 8, y0 + 168, 112, 8);
            ctx.fillStyle = '#d9d9d4'; ctx.fillRect(x0 + 10, y0 + 30, 108, 140);
            for (let k = 0; k < 3; k++) {
              pane(x0 + 14 + k * 35, y0 + 36, 31, 78, lit && k === 1);
              if (!lit) blind(x0 + 14 + k * 35, y0 + 36, 31, 78, Math.min(1, down + (k - 1) * 0.2));
            }
            ctx.fillStyle = panel; ctx.fillRect(x0 + 14, y0 + 118, 100, 48);
            ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x0 + 14, y0 + 118, 100, 3);
          } else if (kind === 'balcony') {
            // A French window onto a balcony slab with its railing, plants and sometimes washing.
            window(x0 + 38, y0 + 28, 52, 124, trim);
            pane(x0 + 38, y0 + 28, 52, 124, lit);
            ctx.fillStyle = trim; ctx.fillRect(x0 + 62, y0 + 28, 4, 124);
            blind(x0 + 38, y0 + 28, 52, 124, down);
            ctx.fillStyle = '#a49e92'; ctx.fillRect(x0 + 10, y0 + 152, 108, 9);
            ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0 + 10, y0 + 161, 108, 5);
            if (r(i + 3) > 0.55) for (let k = 0; k < 3; k++) {
              ctx.fillStyle = '#b8704f'; ctx.fillRect(x0 + 16 + k * 34, y0 + 136, 12, 14);
              ctx.fillStyle = ['#4f7a3a', '#6d9a48', '#d23a4a'][Math.floor(r(i + 4 + k) * 3)];
              ctx.beginPath(); ctx.arc(x0 + 22 + k * 34, y0 + 132, 9, 0, Math.PI * 2); ctx.fill();
            }
            if (r(i + 7) > 0.7) {
              ctx.fillStyle = 'rgba(40,40,40,.6)'; ctx.fillRect(x0 + 12, y0 + 104, 104, 1.5);
              for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#f4f1ea', '#5e86c4', '#d05a5a', '#f2c94c'][(k + Math.floor(r(i + 8) * 4)) % 4]; ctx.fillRect(x0 + 16 + k * 25, y0 + 105, 16, 18 + r(i + k) * 10); }
            }
            if (r(i + 11) > 0.72) {
              // A canvas awning over the balcony, rolled half down, plain or striped.
              const cloth = ['#3f7a4a', '#c8642c', '#2f5d8a', '#b8343a'][Math.floor(r(i + 12) * 4)], depth = 34 + r(i + 13) * 30;
              for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 && r(i + 14) > 0.4 ? '#f3eee2' : cloth; ctx.fillRect(x0 + 8 + k * 12.4, y0 + 18, 12.4, depth); }
              ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 8, y0 + 18 + depth, 112, 4);
              ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0 + 8, y0 + 18, 112, 5);
            }
            if (railing === 'iron') {
              ctx.fillStyle = '#2b2e30'; ctx.fillRect(x0 + 10, y0 + 112, 108, 4);
              for (let k = 0; k < 14; k++) ctx.fillRect(x0 + 12 + k * 7.6, y0 + 112, 2.5, 40);
            } else {
              ctx.fillStyle = panel; ctx.fillRect(x0 + 10, y0 + 114, 108, 38);
              ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x0 + 10, y0 + 114, 108, 4);
            }
          } else {
            // One window, or two narrow ones side by side, with a sill; sometimes an AC box below.
            const twin = kind === 'twin';
            const openings = twin ? [[x0 + 18, 40], [x0 + 72, 40]] : [[x0 + 34, 60]];
            for (const [ox, ow] of openings) {
              window(ox, y0 + 44, ow, 96, trim);
              pane(ox, y0 + 44, ow, 96, lit);
              blind(ox, y0 + 44, ow, 96, down);
              ctx.fillStyle = '#b9b3a6'; ctx.fillRect(ox - 8, y0 + 145, ow + 16, 6);
              ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(ox - 8, y0 + 151, ow + 16, 3);
            }
            if (r(i + 9) > 0.72) {
              const ax = x0 + (twin ? 46 : 78);
              ctx.fillStyle = '#e8e6e1'; ctx.fillRect(ax, y0 + 154, 34, 22);
              ctx.strokeStyle = '#8d8f90'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax + 17, y0 + 165, 7, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(ax, y0 + 176, 34, 3);
            }
          }
        }
      } else if (kind === 'school') {
        // A school: one wide band of glazing per storey with coloured frames.
        paint(wall, 'wall');
        ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0, h - 10, w, 10);
        ctx.fillStyle = trim; ctx.fillRect(0, 44, w, 104);
        ctx.fillStyle = glass; ctx.fillRect(0, 52, w, 88);
        ctx.fillStyle = 'rgba(190,220,235,.25)'; ctx.fillRect(6, 56, 40, 80);
        ctx.fillStyle = trim; for (const x0 of [0, 64]) ctx.fillRect(x0, 44, 6, 104);
      } else if (kind === 'shops' || kind === 'lobby') {
        // Ground floors on a Barcelona avenue: shop windows under striped awnings, metal shutters;
        // `lobby`: a school or block entrance, glass doors under a coloured band.
        paint(base, 'base');
        for (const [i, x0] of [14, 142].entries()) {
          const shut = kind === 'shops' && jitter(seed + i) > 0.7;
          ctx.fillStyle = '#3a3f42'; ctx.fillRect(x0, 50, 100, h - 50);
          ctx.fillStyle = shut ? '#8f9396' : 'rgba(255,214,150,.55)'; ctx.fillRect(x0 + 6, 56, 88, h - 62);
          if (shut) {
            ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 58; y < h; y += 6) ctx.fillRect(x0 + 6, y, 88, 1.5);
            // Barcelona's lowered shutters always carry a tag or two.
            for (let t = 0; t < 3; t++) {
              ctx.strokeStyle = ['#d23a5a', '#2f7fc4', '#f0c234', '#ffffff', '#1d1d1d'][(seed + i + t) % 5]; ctx.lineWidth = 4; ctx.beginPath();
              const tx = x0 + 14 + jitter(seed + t * 7 + i) * 50, ty = 90 + jitter(seed + t * 11 + i) * 70;
              ctx.moveTo(tx, ty); ctx.bezierCurveTo(tx + 12, ty - 22, tx + 22, ty + 18, tx + 38, ty - 6); ctx.stroke();
            }
          }
          if (kind === 'shops') {
            const stripe = ['#3f6b4a', '#a8423a', '#2f5d8a', '#c88b2c'][(seed + i) % 4];
            for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#f3eee2' : stripe; ctx.fillRect(x0 + k * 10, 30, 10, 20); }
          } else { ctx.fillStyle = trim; ctx.fillRect(x0, 34, 100, 16); ctx.fillStyle = '#2c3a42'; ctx.fillRect(x0 + 30, 70, 40, h - 70); }
        }
      } else if (kind === 'ashlar' || kind === 'ashlar-windows') {
        stones(wall, 8, 'wall');
        if (kind === 'ashlar-windows') {
          ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(38, 40, 52, 104, [26, 26, 0, 0]); ctx.fill();
          ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(44, 46, 40, 94, [20, 20, 0, 0]); ctx.fill();
        }
      } else if (kind === 'masonry') {
        stones(base, 6, 'base');
        ctx.fillStyle = '#4a3324'; ctx.beginPath(); ctx.roundRect(36, 54, 58, h - 54, [6, 6, 0, 0]); ctx.fill();
        ctx.fillStyle = '#5f4330'; for (let i = 0; i < 4; i++) ctx.fillRect(40 + i * 14, 60, 9, h - 64);
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(84, 120, 4, 8);
        window(164, 62, 48, 62, '#e8e0cf');
        ctx.fillStyle = '#26292b'; for (let i = 0; i < 5; i++) ctx.fillRect(166 + i * 10, 62, 3, 62);
      } else if (kind === 'mall') {
        // Hipercor's box: beige concrete panels with a thin blue stripe, no windows.
        paint(wall, 'wall');
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, h - 4, w, 4); ctx.fillRect(w - 3, 0, 3, h);
        ctx.fillStyle = trim; ctx.fillRect(56, 0, 9, h);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 0, w, 6);
      } else if (kind === 'mall-front') {
        // Under a wavy concrete canopy, lit glass doors and shop windows.
        ctx.fillStyle = '#3a4148'; ctx.fillRect(0, 0, w, h);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = 'rgba(255,226,170,.62)'; ctx.fillRect(6 + k * 42, 70, 36, h - 74);
          ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(9 + k * 42, 74, 8, h - 82);
        }
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, 44);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(32 + k * 64, 44, 32, 18, 0, 0, Math.PI); ctx.fill(); }
        ctx.fillStyle = base;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(32 + k * 64, 40, 30, 14, 0, 0, Math.PI); ctx.fill(); }
        ctx.fillStyle = trim; for (const x0 of [0, 128]) ctx.fillRect(x0, 44, 6, h - 44);
      } else if (kind === 'curtain') {
        // An office tower in dark glass: a grid of mullions, a few windows still lit.
        paint(wall, 'wall');
        for (const [x0, y0] of [[8, 14], [68, 14], [8, 104], [68, 104]]) {
          const lit = jitter(seed + x0 * 3 + y0) > 0.72;
          ctx.fillStyle = lit ? 'rgba(255,224,160,.75)' : 'rgba(120,150,170,.25)'; ctx.fillRect(x0, y0, 52, 74);
        }
        ctx.fillStyle = trim; ctx.fillRect(0, 0, w, 8); ctx.fillRect(0, 94, w, 6); ctx.fillRect(0, 0, 4, h); ctx.fillRect(62, 0, 4, h);
      } else if (kind === 'arcade' || kind === 'ashlar-arcade') {
        if (kind === 'arcade') paint(base, 'base'); else stones(base, 6, 'base');
        for (const x0 of [14, 142]) {
          ctx.fillStyle = '#3c3530'; ctx.beginPath(); ctx.roundRect(x0, 34, 100, h - 34, [50, 50, 0, 0]); ctx.fill();
          ctx.fillStyle = '#6f5a44'; ctx.fillRect(x0 + 24, 96, 52, h - 96);
          ctx.fillStyle = 'rgba(255,214,150,.45)'; ctx.fillRect(x0 + 30, 104, 40, 40);
        }
        ctx.fillStyle = trim; ctx.fillRect(0, 0, w, 10);
      }
      // A soft darker base so walls sit on the street.
      const fade = ctx.createLinearGradient(0, h * 0.82, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, ground ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,0)');
      ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
    };
    const c = canvas(w, h, draw);
    const made = m = cutaway(textured(`Fachada ${kind}`, c, 0.1));
    textures.set(key, m);
    // Repainted with the grain once the materials arrive.
    if (grain.wall || grain.base) onLoad.push(() => {
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); draw(ctx);
      made.diffuseMap?.upload();
    });
    return m;
  }
  /**
   * A facade or ground floor from a photo atlas of real bays (`photo:<texture>`): painted as
   * `fallback` until the photo loads (or if it is missing), then the photo's bays × storeys repeat
   * along the wall. The wall's UVs count bays and storeys (`u`) or ground floors of two bays (`v`).
   */
  function photoFacade(kind: string, fallback: pc.StandardMaterial, perU: number, perV: number) {
    const id = kind.slice('photo:'.length), key = `${kind}|${fallback.name}`;
    let m = textures.get(key);
    if (m) return m;
    const made = m = cutaway(mat(`Fachada ${kind}`, '#ffffff', 0.1));
    m.diffuseMap = fallback.diffuseMap; m.diffuseMapTiling.copy(fallback.diffuseMapTiling); m.update();
    textures.set(key, m);
    onLoad.push(() => {
      const t = loaded.get(id);
      if (!t) return;
      made.diffuseMap = image(id, 'albedo')!;
      made.diffuseMapTiling.set(perU / (t.info.bays ?? 1), perV / (t.info.storeys ?? 1)); made.update();
    });
    return m;
  }
  const roofs = new Map<string, pc.StandardMaterial>();
  /** Roof UVs count metres along the ridge and down the slope; `texture` dresses it in real tiles of its colour once loaded. */
  function roofMaterial(colour: string, texture?: string) {
    let m = roofs.get(`${colour}|${texture}`);
    if (m) return m;
    m = cutaway(textured(`Tejado ${colour}`, canvas(64, 64, ctx => {
      ctx.fillStyle = colour; ctx.fillRect(0, 0, 64, 64);
      for (let r = 0; r < 4; r++) {
        const g = ctx.createLinearGradient(0, r * 16, 0, r * 16 + 16);
        g.addColorStop(0, 'rgba(255,230,200,.16)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,10,0,.35)');
        ctx.fillStyle = g; ctx.fillRect(0, r * 16, 64, 16);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(50,15,0,.25)'; ctx.fillRect(k * 16 + (r % 2) * 8, r * 16, 1.5, 16); }
      }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(${jitter(i) > .5 ? '90,60,40' : '255,220,190'},.12)`; ctx.fillRect(jitter(i + 1) * 64, jitter(i + 2) * 64, 6, 3); }
    }), 0.15));
    m.diffuseMapTiling.set(0.9 / cellM, 1.1 / (cellM * SLOPE)); m.update();
    const made = m;
    if (texture) onLoad.push(() => dress(made, texture, colour));
    roofs.set(`${colour}|${texture}`, m);
    return m;
  }
  /** A Barcelona flat roof (terrat): square clay tiles in the roof colour, a few patched. */
  function terraceMaterial(colour: string, texture?: string) {
    let m = roofs.get(`terrat|${colour}|${texture}`);
    if (m) return m;
    m = cutaway(textured(`Terrat ${colour}`, canvas(64, 64, ctx => {
      ctx.fillStyle = 'rgba(60,50,40,1)'; ctx.fillRect(0, 0, 64, 64);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        ctx.fillStyle = colour; ctx.fillRect(k * 16 + 1, r * 16 + 1, 14, 14);
        ctx.fillStyle = `rgba(${jitter(r * 4 + k + 50) > .5 ? '255,255,255' : '0,0,0'},${0.04 + jitter(r * 4 + k + 90) * 0.08})`; ctx.fillRect(k * 16 + 1, r * 16 + 1, 14, 14);
      }
    }), 0.1));
    m.diffuseMapTiling.set(0.9 / cellM, 1.1 / cellM); m.update();
    const made = m;
    if (texture) onLoad.push(() => dress(made, texture, colour));
    roofs.set(`terrat|${colour}|${texture}`, m);
    return m;
  }

  const walls = new Map<string, pc.StandardMaterial>();
  /** A wall's real material at its real size (UVs in metres), plain `tint` until it loads; it opens the cut. */
  function wallSurface(texture: string | undefined, tint: string) {
    const key = `${texture}|${tint}`;
    let m = walls.get(key);
    if (m) return m;
    const made = m = cutaway(mat(`Muro ${texture ?? 'pintado'}`, tint, 0.05));
    if (texture) onLoad.push(() => dress(made, texture, tint));
    walls.set(key, m);
    return m;
  }
  /**
   * `parapet`: a low wall in one real material at its real size, capped flat (the battery's
   * board-marked concrete, the shacks' whitewashed brick, a water tank): no bays, no roof.
   */
  function lowWall(b: GeoBuilding, pivot: pc.Entity) {
    const poly = b.poly, H = b.height, sign = signedArea(poly) > 0 ? 1 : -1;
    const sides = new MeshBuilder(), cap = new MeshBuilder();
    let along = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-3) continue;
      const n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign], u = len * cellM;
      sides.quad(P(a, 0), P(c, 0), P(c, H), P(a, H), n, [along, 0], [along + u, 0], [along + u, H * cellM], [along, H * cellM]);
      along += u;
    }
    for (const [i, j, k] of triangulate(poly)) cap.tri(P(poly[i], H), P(poly[j], H), P(poly[k], H), [0, 1, 0], metres(poly[i]), metres(poly[j]), metres(poly[k]));
    add('Muro', sides, wallSurface(b.materials?.wall, b.walls), pivot, false);
    add('Albardilla', cap, wallSurface(b.materials?.roof ?? b.materials?.wall, b.roofColor ?? b.walls), pivot, false);
  }

  function building(b: GeoBuilding) {
    const pivot = new pc.Entity(`Edificio ${b.number ?? b.name ?? b.id}`);
    root.addChild(pivot); pivots.set(b.id, pivot);
    buildingCuts.set(pivot, { triangles: [], instances: [], radius: 0 });
    if (b.facade === 'parapet') { lowWall(b, pivot); return; }
    const poly = b.poly, H = b.height, storey = scene.storey;
    const groundTop = Math.min(H, storey * 1.15);
    const ccw = signedArea(poly) > 0;
    const walls = new MeshBuilder(), base = new MeshBuilder();
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 1e-3) continue;
      // Outward normal in grid space, turned into scene space (same axes).
      const sign = ccw ? 1 : -1;
      const n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
      const bays = Math.max(1, Math.round(len / BAY));
      base.quad(P(a, 0), P(c, 0), P(c, groundTop), P(a, groundTop), n, [0, 0], [bays / 2, 0], [bays / 2, 1], [0, 1]);
      if (H > groundTop + 0.05) {
        const floors = (H - groundTop) / storey;
        // Atlas facades start at a different bay on every wall, so neighbours never line up (a photo
        // atlas counts whole bays: its material repeats once per its own bays and storeys).
        const [au, av] = FACADE_ATLAS[b.facade] ?? [1, 1], photoBays = photo(b.facade)?.bays ?? 0;
        const u0 = au > 1 ? Math.floor(jitter(i + b.poly.length * 17 + b.levels * 3) * au) / au
          : photoBays > 1 ? Math.floor(jitter(i + b.poly.length * 17 + b.levels * 3) * photoBays) : 0;
        walls.quad(P(a, groundTop), P(c, groundTop), P(c, H), P(a, H), n, [u0, 0], [u0 + bays / au, 0], [u0 + bays / au, floors / av], [u0, floors / av]);
      }
    }
    const trim = b.trim ?? '#f2ede2', baseColour = b.base ?? '#a69a86', grain = b.materials ?? {};
    // Photo atlases stand on the painted flats and shops until they load.
    const upper = (kind: string) => photo(kind) ? photoFacade(kind, facade('flats', b.walls, trim, baseColour), 1, 1) : facade(kind, b.walls, trim, baseColour, grain);
    const lower = photo(b.ground) ? photoFacade(b.ground, facade('shops', b.walls, trim, baseColour), 2, 1) : facade(b.ground, b.walls, trim, baseColour, grain);
    add('Planta baja', base, lower, pivot, false);
    add('Fachada', walls, upper(b.facade), pivot, false);
    // A flat ceiling under the eaves closes the top of any footprint the roof does not cover.
    const lid = new MeshBuilder();
    for (const [i, j, k] of triangulate(poly)) lid.tri(P(poly[i], H), P(poly[j], H), P(poly[k], H), [0, 1, 0]);
    add('Forjado', lid, cutaway(mat('Forjado', b.walls)), pivot, false, false);
    add('Tejado', roof(b, H), b.roof === 'flat' ? terraceMaterial(b.roofColor ?? '#b0a597', grain.roof) : roofMaterial(b.roofColor ?? '#b4643f', grain.roof), pivot, false);
    // Flat roofs and outlines a pitched roof cannot cover get a parapet round the real outline.
    if (!boxy(b) || b.roof === 'flat') {
      // A low parapet hides the edge of a flat roof.
      const parapet = new MeshBuilder();
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 1e-3) continue;
        const sign = ccw ? 1 : -1, n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
        parapet.quad(P(a, H), P(c, H), P(c, H + 0.45), P(a, H + 0.45), n, [0, 0.9], [len / BAY, 0.9], [len / BAY, 1], [0, 1]);
      }
      add('Peto', parapet, photo(b.facade) ? facade('flats', b.walls, trim, baseColour) : facade(b.facade, b.walls, trim, baseColour, grain), pivot, false);
    }
    if (b.roof !== 'flat') add('Hastial', gableEnds(b, H), facade('rendered', b.walls, trim, baseColour, grain), pivot, false);
  }
  /** The photo atlas a `photo:<texture>` facade or ground floor names, if the scene has it. */
  function photo(kind: string) {
    return kind.startsWith('photo:') ? scene.textures?.[kind.slice('photo:'.length)] : undefined;
  }
  /** Whether the footprint nearly fills its oriented box, so a pitched roof on the box fits it. */
  const boxy = (b: GeoBuilding) => Math.abs(signedArea(b.poly)) / (b.box.w * b.box.d) > 0.85;
  /** The roof over the footprint's oriented box: hipped, gabled, pyramid or flat. */
  function roof(b: GeoBuilding, H: number) {
    const box = b.box, long = box.w >= box.d;
    // Flat roofs, and an L or a courtyard (where a box roof would cover open ground), follow the real outline.
    if (b.roof === 'flat' || !boxy(b)) {
      const out = new MeshBuilder();
      for (const [i, j, k] of triangulate(b.poly)) out.tri(P(b.poly[i], H + 0.25), P(b.poly[j], H + 0.25), P(b.poly[k], H + 0.25), [0, 1, 0],
        metres(b.poly[i]), metres(b.poly[j]), metres(b.poly[k]));
      return out;
    }
    const ua = long ? box.angle : box.angle + Math.PI / 2;
    const e1 = [Math.cos(ua), Math.sin(ua)], e2 = [-Math.sin(ua), Math.cos(ua)];
    const hl = Math.max(box.w, box.d) / 2 + EAVE, hs = Math.min(box.w, box.d) / 2 + EAVE;
    const rise = b.roof === 'flat' ? 0 : b.roof === 'pyramid' ? Math.max(hl, hs) * 1.4 : hs * ROOF_PITCH;
    const ridge = b.roof === 'gable' ? hl : b.roof === 'pyramid' ? 0 : Math.max(0, hl - hs);
    const at = (u: number, v: number, y: number): V3 => P([box.cx + e1[0] * u + e2[0] * v, box.cz + e1[1] * u + e2[1] * v], y);
    const out = new MeshBuilder();
    const up = (u: number, v: number): V3 => [x(box.cx + e1[0] * u + e2[0] * v) - x(box.cx), 0.6, z(box.cz + e1[1] * u + e2[1] * v) - z(box.cz)];
    const uv = (u: number, v: number) => [u * cellM, Math.abs(v) * cellM * SLOPE];
    const c00 = at(-hl, -hs, H), c10 = at(hl, -hs, H), c11 = at(hl, hs, H), c01 = at(-hl, hs, H);
    const r0 = at(-ridge, 0, H + rise), r1 = at(ridge, 0, H + rise);
    out.quad(c00, c10, r1, r0, up(0, -1), uv(-hl, -hs), uv(hl, -hs), uv(ridge, 0), uv(-ridge, 0));
    out.quad(c11, c01, r0, r1, up(0, 1), uv(hl, hs), uv(-hl, hs), uv(-ridge, 0), uv(ridge, 0));
    if (b.roof !== 'gable') {
      out.tri(c10, c11, r1, up(1, 0), uv(-hs, hl), uv(hs, hl), uv(0, 0));
      out.tri(c01, c00, r0, up(-1, 0), uv(-hs, hl), uv(hs, hl), uv(0, 0));
    }
    return out;
  }
  /** Gabled roofs leave a triangle of wall at each end. */
  function gableEnds(b: GeoBuilding, H: number) {
    const out = new MeshBuilder();
    if (b.roof !== 'gable' || !boxy(b)) return out;
    const box = b.box, long = box.w >= box.d, ua = long ? box.angle : box.angle + Math.PI / 2;
    const e1 = [Math.cos(ua), Math.sin(ua)], e2 = [-Math.sin(ua), Math.cos(ua)];
    const hl = Math.max(box.w, box.d) / 2, hs = Math.min(box.w, box.d) / 2, rise = (hs + EAVE) * ROOF_PITCH;
    for (const s of [-1, 1]) {
      const at = (v: number, y: number): V3 => P([box.cx + e1[0] * hl * s + e2[0] * v, box.cz + e1[1] * hl * s + e2[1] * v], y);
      out.tri(at(-hs, H), at(hs, H), at(0, H + rise), [e1[0] * s, 0, e1[1] * s], [0, 0], [hs / BAY * 2, 0], [hs / BAY, rise / scene.storey]);
    }
    return out;
  }
  scene.buildings.forEach(building);

  // ------------------------------------------------------------ signs and road markings
  /** A flat, lit picture on a wall or the road: centre, the direction its width runs and its normal. */
  function panel(name: string, parent: pc.Entity, m: pc.Material, c: V3, along: V3, up: V3, w: number, h: number, normal: V3) {
    const b = new MeshBuilder(), at = (u: number, v: number): V3 => [c[0] + along[0] * u + up[0] * v, c[1] + along[1] * u + up[1] * v, c[2] + along[2] * u + up[2] * v];
    b.quad(at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2), normal, [0, 1], [1, 1], [1, 0], [0, 0]);
    return add(name, b, m, parent, false, false);
  }
  function lit(name: string, c: HTMLCanvasElement, glow: number, cutout = false) {
    const m = textured(name, c, 0.3);
    m.emissive.set(1, 1, 1); m.emissiveMap = m.diffuseMap; m.emissiveIntensity = glow;
    if (cutout) { m.opacityMap = m.diffuseMap; m.opacityMapChannel = 'a'; m.alphaTest = 0.5; }
    m.update(); return m;
  }
  /** What a shop without a name says over its door, by kind (in Catalan, as on the street). */
  const SHOP_WORDS: Record<string, string> = {
    bakery: 'FORN', bar: 'BAR', pub: 'BAR', cafe: 'CAFETERIA', restaurant: 'RESTAURANT', fast_food: 'MENJAR', pharmacy: 'FARMÀCIA',
    newsagent: 'PREMSA', convenience: 'ALIMENTACIÓ', supermarket: 'SUPERMERCAT', hairdresser: 'PERRUQUERIA', florist: 'FLORISTERIA',
    optician: 'ÒPTICA', bank: 'BANC', greengrocer: 'FRUITERIA', clothes: 'ROBA', tobacco: 'ESTANC', variety_store: 'TOT A 1 €',
  };
  /** Sign colours by kind: background, letters. */
  const SHOP_COLOURS: Record<string, [string, string]> = {
    bakery: ['#6b3a1f', '#f6e3c2'], cafe: ['#1f3b2f', '#f2efe6'], bar: ['#7a1f24', '#f7e9d0'], pub: ['#2a1f3d', '#ffd36b'],
    pharmacy: ['#1f8a4c', '#ffffff'], optician: ['#1d4e89', '#ffffff'], bank: ['#0a6aa6', '#ffffff'], florist: ['#e9f2e4', '#3f7a3a'],
    convenience: ['#e46a2a', '#ffffff'], supermarket: ['#f2b51d', '#3a2a12'], newsagent: ['#c9372c', '#ffffff'], variety_store: ['#f08a1c', '#ffffff'],
    greengrocer: ['#3d8b3d', '#fff5d6'], restaurant: ['#3a2b25', '#f2d29b'], fast_food: ['#c8102e', '#ffffff'],
  };
  const brands: Record<string, [string, string]> = { Granier: ['#ffffff', '#c2272d'], '365': ['#111111', '#ffffff'], 'General Óptica': ['#ffffff', '#00539f'], 'Vision-Prix': ['#e5007d', '#ffffff'] };
  for (const shop of scene.shops ?? []) {
    const parent = pivots.get(shop.building);
    const b = scene.buildings.find(o => o.id === shop.building);
    if (!parent || !b) continue;
    const text = (shop.name ?? SHOP_WORDS[shop.kind] ?? shop.kind.toUpperCase()).toUpperCase();
    const [bg, fg] = (shop.name && brands[shop.name]) || SHOP_COLOURS[shop.kind] || ['#2f3a44', '#f2efe6'];
    const sign = canvas(256, 56, ctx => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 56);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 50, 256, 6);
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = 34; ctx.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`;
      while (ctx.measureText(text).width > 236 && size > 14) { size -= 2; ctx.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`; }
      ctx.fillText(text, 128, 29);
      if (shop.kind === 'pharmacy') { ctx.fillStyle = '#7fff9a'; ctx.fillRect(8, 20, 24, 8); ctx.fillRect(16, 12, 8, 24); }
    });
    const groundTop = Math.min(b.height, scene.storey * 1.15);
    const normal: V3 = [shop.nx, 0, shop.nz];
    panel(`Rótulo ${text}`, parent, cutaway(lit(`Rótulo ${text}`, sign, 0.55)), [x(shop.x + shop.nx * 0.05), groundTop - 0.32, z(shop.z + shop.nz * 0.05)],
      [shop.nz, 0, -shop.nx], [0, 1, 0], 2.1, 0.46, normal);
  }
  /** A building's longest wall that faces the camera. */
  function frontWall(b: GeoBuilding) {
    const ccw = signedArea(b.poly) > 0, sign = ccw ? 1 : -1;
    let best: { a: GeoPoint; c: GeoPoint; len: number; n: V3; score: number } | undefined;
    for (let i = 0; i < b.poly.length; i++) {
      const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-3) continue;
      const n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
      const score = len * (n[2] + 0.3 * n[0]);
      if (!best || score > best.score) best = { a, c, len, n, score };
    }
    return best;
  }
  for (const b of scene.buildings) {
    const info = b.signature ? scene.textures?.[b.signature] : undefined, best = info && frontWall(b);
    if (!info || !best) continue;
    // A signature facade: the photo at its real size, standing on the street in the middle of the
    // wall facing the camera (never wider or taller than the wall), shown once it has loaded.
    const w = Math.min(info.size_m[0] / cellM, best.len), h = Math.min((info.size_m[1] ?? info.size_m[0]) / cellM, b.height);
    const mid: GeoPoint = [(best.a[0] + best.c[0]) / 2 + best.n[0] * 0.04, (best.a[1] + best.c[1]) / 2 + best.n[2] * 0.04];
    const m = cutaway(mat(`Fachada ${b.signature}`, '#ffffff', 0.12));
    const e = panel(`Fachada ${b.signature}`, pivots.get(b.id)!, m, [x(mid[0]), h / 2, z(mid[1])], [best.n[2], 0, -best.n[0]], [0, 1, 0], w, h, best.n);
    if (e) e.enabled = false;
    const id = b.signature!;
    onLoad.push(() => { if (!loaded.has(id) || !e) return; m.diffuseMap = image(id, 'albedo')!; m.update(); e.enabled = true; });
  }
  for (const b of scene.buildings) {
    // The big letters go on the longest wall that faces the camera, over the ground floor.
    const best = b.sign ? frontWall(b) : undefined;
    if (!best) continue;
    const w = Math.min(best.len * 0.5, 11), h = w / 5.5;
    const letters = canvas(512, 96, ctx => {
      ctx.fillStyle = '#1d2a3a'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#9fe2ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 64px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(b.sign!, 256, 50);
    });
    const mid: GeoPoint = [(best.a[0] + best.c[0]) / 2 + best.n[0] * 0.08, (best.a[1] + best.c[1]) / 2 + best.n[2] * 0.08];
    const groundTop = Math.min(b.height, scene.storey * 1.15);
    panel(`Rótulo ${b.sign}`, pivots.get(b.id)!, cutaway(lit(`Rótulo ${b.sign}`, letters, 1.1)), [x(mid[0]), groundTop + h / 2 + 0.25, z(mid[1])],
      [best.n[2], 0, -best.n[0]], [0, 1, 0], w, h, best.n);
  }

  if (look.markings) {
    // White paint on the new asphalt: lanes, edges, zebra crossings, BUS on the bus lane, bikes on the bike lane.
    const paint = mat('Pintura vial', '#ecebe4', 0.2, 0.15);
    const lines = new MeshBuilder(), y = LAYER.road + 0.006;
    const dash = (a: GeoPoint, b: GeoPoint, offset: number, on: number, off: number, wide: number) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-3) return;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, rx = -uz, rz = ux;
      for (let t = 0; t < len; t += on + off) {
        const t1 = Math.min(len, t + on);
        const p0: GeoPoint = [a[0] + ux * t + rx * offset, a[1] + uz * t + rz * offset], p1: GeoPoint = [a[0] + ux * t1 + rx * offset, a[1] + uz * t1 + rz * offset];
        lines.quad(P([p0[0] + rx * wide / 2, p0[1] + rz * wide / 2], y), P([p1[0] + rx * wide / 2, p1[1] + rz * wide / 2], y),
          P([p1[0] - rx * wide / 2, p1[1] - rz * wide / 2], y), P([p0[0] - rx * wide / 2, p0[1] - rz * wide / 2], y), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      }
    };
    const decals: { m: pc.StandardMaterial; at: GeoPoint; u: GeoPoint; len: number; wid: number }[] = [];
    const busWord = lit('BUS pintado', canvas(64, 192, ctx => {
      ctx.fillStyle = '#ecebe4'; ctx.textAlign = 'center'; ctx.font = '900 60px Arial, sans-serif';
      ctx.save(); ctx.scale(1, 1); ['B', 'U', 'S'].forEach((ch, i) => ctx.fillText(ch, 32, 58 + i * 62)); ctx.restore();
    }), 0.15, true);
    const bike = lit('Bici pintada', canvas(256, 384, ctx => {
      // A bicycle seen from the side, lying along the lane: wheels, diamond frame, saddle and bars.
      ctx.translate(128, 192); ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = '#f4f3ee'; ctx.lineWidth = 17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const line = (...pts: number[]) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
      for (const hub of [-108, 108]) { ctx.beginPath(); ctx.arc(hub, 42, 64, 0, Math.PI * 2); ctx.stroke(); }
      line(-108, 42, -6, 42, -40, -46, -108, 42);
      line(-40, -46, 66, -46, -6, 42);
      line(108, 42, 66, -46, 74, -78);
      line(-48, -66, -40, -46);
      line(-78, -70, -22, -70);
      line(62, -84, 100, -84);
    }), 0.15, true);
    for (const r of scene.roads) {
      const half = r.width / 2;
      for (let i = 0; i + 1 < r.line.length; i++) {
        const a = r.line[i], b = r.line[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-3) continue;
        const u: GeoPoint = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        if (r.kind === 'path' && r.highway === 'cycleway' && half > 0.9) {
          dash(a, b, 0, 1.2, 1.2, 0.1);
          for (let t = 6; t < len; t += 18) decals.push({ m: bike, at: [a[0] + u[0] * t, a[1] + u[1] * t], u, len: 2.4, wid: Math.min(1.6, half * 1.4) });
        }
        if (r.kind !== 'road' || !r.lanes || r.lanes < 2) continue;
        const lane = r.width / r.lanes;
        for (let k = 1; k < r.lanes; k++) {
          const offset = -half + k * lane, solid = r.bus !== undefined && (k === r.bus || k === r.bus + 1);
          dash(a, b, offset, solid ? len + 1 : 2, solid ? 0 : 2.4, solid ? 0.16 : 0.1);
        }
        for (const side of [-1, 1]) dash(a, b, side * (half - 0.2), len + 1, 0, 0.1);
        if (r.bus !== undefined) {
          const offset = -half + (r.bus + 0.5) * lane, rx = -u[1], rz = u[0];
          for (let t = 8; t < len; t += 24) decals.push({ m: busWord, at: [a[0] + u[0] * t + rx * offset, a[1] + u[1] * t + rz * offset], u, len: 2.4, wid: lane * 0.6 });
        }
      }
    }
    for (const c of scene.crossings ?? []) {
      // Bars along the road, side by side across its whole width.
      const ux = Math.cos(c.angle), uz = Math.sin(c.angle), rx = -uz, rz = ux, half = c.width / 2;
      for (let o = -half + 0.35; o < half - 0.2; o += 0.8) {
        const cx = c.x + rx * o, cz = c.z + rz * o, l = 1.1, w = 0.2;
        lines.quad(P([cx - ux * l + rx * w, cz - uz * l + rz * w], y + 0.001), P([cx + ux * l + rx * w, cz + uz * l + rz * w], y + 0.001),
          P([cx + ux * l - rx * w, cz + uz * l - rz * w], y + 0.001), P([cx - ux * l - rx * w, cz - uz * l - rz * w], y + 0.001), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
      }
    }
    add('Marcas viales', lines, paint, root, true, false);
    for (const d of decals) {
      // The picture's up runs with the traffic; its width across the lane.
      const c = P(d.at, y + 0.002);
      panel('Marca pintada', root, d.m, c, [-d.u[1], 0, d.u[0]], [d.u[0], 0, d.u[1]], d.wid, d.len, [0, 1, 0]);
    }
  }

  // ------------------------------------------------------------ landmarks
  // Each kind is drawn by its own module in src/landmarks/ (docs/environment-styling.md § Landmarks),
  // under a pivot at its centre, turned by its angle and scaled so builders work in metres.
  const shared = new Map<string, pc.StandardMaterial>();
  function landmarkKit(pivot: pc.Entity): LandmarkKit {
    const kitMat = (name: string, hex: string, gloss = 0.2, glow = 0) => {
      const key = `${name}|${hex}|${gloss}|${glow}`;
      let m = shared.get(key);
      if (!m) { m = mat(name, hex, gloss, glow); shared.set(key, m); }
      return m;
    };
    return {
      app, root: pivot, cell: cellM, scene, mat: kitMat,
      surface(texture, tint, gloss = 0.1) {
        const key = `surface|${texture}|${tint}|${gloss}`;
        let m = shared.get(key);
        if (!m) { const made = m = mat(`${texture} ${tint}`, tint, gloss); shared.set(key, m); onLoad.push(() => dress(made, texture, tint)); }
        return m;
      },
      part(name, type, material, position, scale, rotation, parent = pivot) {
        const e = new pc.Entity(name);
        e.addComponent('render', { type, material, castShadows: true, receiveShadows: true, batchGroupId: kit.batch });
        e.setLocalPosition(position[0], position[1], position[2]); e.setLocalScale(scale[0], scale[1], scale[2]);
        if (rotation) e.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
        parent.addChild(e); return e;
      },
      mesh: () => new MeshBuilder(),
      add(name, builder, material, { cut = false, shadows = true, parent = pivot } = {}) {
        if (builder.empty) return undefined;
        const mesh = builder.mesh(device); meshes.push(mesh);
        const e = new pc.Entity(name), instance = new pc.MeshInstance(mesh, cut ? cutaway(material) : material);
        e.addComponent('render', { meshInstances: [instance], castShadows: shadows, receiveShadows: true, ...(cut ? {} : { batchGroupId: kit.batch }) });
        parent.addChild(e);
        if (cut) {
          // Tall pieces open the same cut as the buildings: their triangles in world space.
          let group = buildingCuts.get(pivot);
          if (!group) { group = { triangles: [], instances: [], radius: 0 }; buildingCuts.set(pivot, group); }
          const world = e.getWorldTransform(), v = new pc.Vec3();
          for (const index of builder.indices) {
            world.transformPoint(v.set(builder.positions[index * 3], builder.positions[index * 3 + 1], builder.positions[index * 3 + 2]), v);
            group.triangles.push(v.x, v.y, v.z);
          }
          group.instances.push(instance); instance.setParameter('geoCutRadius', 0);
        }
        return e;
      },
      texture: c => kit.texture(c),
    };
  }
  for (const lm of scene.landmarks ?? []) {
    const pivot = new pc.Entity(`Monumento ${lm.id}`);
    pivot.setLocalPosition(x(lm.x), 0, z(lm.z)); pivot.setLocalEulerAngles(0, lm.angle, 0); pivot.setLocalScale(1 / cellM, 1 / cellM, 1 / cellM);
    root.addChild(pivot);
    const builder = LANDMARKS.get(lm.kind);
    if (builder) { builder.build(landmarkKit(pivot), lm); continue; }
    // A kind without its module yet (data merged before code): a plain block on its footprint.
    console.warn(`Monumento sin constructor: ${lm.kind} (src/landmarks/${lm.kind}.ts)`);
    if (lm.solid) landmarkKit(pivot).part('Monumento pendiente', 'box', mat('Monumento pendiente', '#9a948a'), [0, 0.5, 0], [lm.w * cellM, 1, lm.d * cellM]);
  }

  // ------------------------------------------------------------ surroundings
  // A hilltop falls away on every side to whatever its landmarks lay below (the Búnkers' city);
  // elsewhere wooded hills close every side but the camera's, as the valley does around the town.
  if (scene.drop) flank(scene.drop);
  else {
    const hill = [mat('Monte', '#4e6b45', 0.05), mat('Monte lejano', '#5f7c55', 0.05), mat('Monte sombra', '#41593b', 0.05)];
    const hills: [number, number, number, number, number][] = [
      [W * 0.15, -18, 70, 22, 40], [W * 0.5, -22, 90, 30, 46], [W * 0.88, -16, 70, 20, 38],
      [-22, D * 0.3, 40, 18, 70], [-20, D * 0.85, 34, 14, 50],
    ];
    hills.forEach(([px, pz, w, h, d], i) => {
      const e = new pc.Entity('Monte');
      e.addComponent('render', { type: 'sphere', material: hill[i % 3], castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
      e.setPosition(x(px), -h * 0.15, z(pz)); e.setLocalScale(w, h, d); root.addChild(e);
    });
  }
  /**
   * The hill's flank: rings offset outwards from the brow (mitred at the corners), dropping `depth`
   * cells over `run` with a smoothstep, so the top rounds over and the foot eases into the plain.
   * The sides the camera looks at run out up to 2.5 times further (`flankRun`), so they read as a
   * slope rather than a cliff, and are the hill's own undergrowth running on down (the zone's `forest`
   * material, thick with scrub); the sides it looks across to the view are the bare `flank`.
   */
  function flank(drop: NonNullable<GeoScene['drop']>) {
    const edge = drop.edge, n = edge.length, RINGS = 16;
    const normals = edge.map((a, i) => {
      const b = edge[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
    });
    // Mitred outward directions at each corner, capped where the corner is sharp.
    const miters = edge.map((_, i) => {
      const n1 = normals[(i + n - 1) % n], n2 = normals[i], k = 1 / Math.max(0.35, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
      return [(n1[0] + n2[0]) * k, (n1[1] + n2[1]) * k];
    });
    const along = [0];
    for (let i = 1; i <= n; i++) along.push(along[i - 1] + Math.hypot(edge[i % n][0] - edge[i - 1][0], edge[i % n][1] - edge[i - 1][1]) * cellM);
    const profile = (t: number) => -drop.depth * t * t * (3 - 2 * t);
    /** The drawn slope's height at `t` down it: straight between the rings, so nothing on it floats or sinks. */
    const slopeY = (t: number) => { const u = t * RINGS, r = Math.min(RINGS - 1, Math.floor(u)); return profile(r / RINGS) + (profile((r + 1) / RINGS) - profile(r / RINGS)) * (u - r); };
    const runs = miters.map(m => flankRun(drop.run, m[0], m[1]));
    // Distance down the slope at each corner and ring, so the material keeps its real size however long the run.
    const slope = runs.map(run => {
      const s = [0];
      for (let r = 1; r <= RINGS; r++) s.push(s[r - 1] + Math.hypot(run / RINGS, profile(r / RINGS) - profile((r - 1) / RINGS)) * cellM);
      return s;
    });
    const at = (i: number, r: number): V3 => {
      const t = r / RINGS, k = i % n;
      return [x(edge[k][0] + miters[k][0] * runs[k] * t), profile(t), z(edge[k][1] + miters[k][1] * runs[k] * t)];
    };
    // Shaded round: a normal at every corner of every ring, from its neighbours along the brow and down
    // the slope (flat facets would light the two halves of each twisted quad differently, in stripes).
    const round = (i: number, r: number): V3 => {
      const k = i % n, ahead = at(k + 1, r), behind = at(k + n - 1, r), below = at(k, Math.min(RINGS, r + 1)), above = at(k, Math.max(0, r - 1));
      const t = [ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]], d = [below[0] - above[0], below[1] - above[1], below[2] - above[2]];
      const m: V3 = [t[1] * d[2] - t[2] * d[1], t[2] * d[0] - t[0] * d[2], t[0] * d[1] - t[1] * d[0]], len = (m[1] < 0 ? -1 : 1) * (Math.hypot(...m) || 1);
      return [m[0] / len, m[1] / len, m[2] / len];
    };
    // Which sides face the camera (it looks along −x −z): those are dressed as the hill's scrub.
    const near = normals.map(([nx, nz]) => (nx + nz) * Math.SQRT1_2 > 0.4);
    const rock = new MeshBuilder(), scrubland = new MeshBuilder();
    for (let i = 0; i < n; i++) for (let r = 0; r < RINGS; r++) {
      const out: V3 = [normals[i][0], 0.6, normals[i][1]], j = (i + 1) % n;
      (near[i] ? scrubland : rock).quad(at(i, r), at(i + 1, r), at(i + 1, r + 1), at(i, r + 1), out, [along[i], slope[i][r]], [along[i + 1], slope[j][r]], [along[i + 1], slope[j][r + 1]], [along[i], slope[i][r + 1]],
        [round(i, r), round(i + 1, r), round(i + 1, r + 1), round(i, r + 1)]);
    }
    add('Ladera', rock, surface('Ladera', 'flank', speckles('#7a6648', ['#6b5a40', '#8a7656', '#5d5038']), 0.25), root, true, false);
    add('Ladera de matorral', scrubland, undergrowth, root, true, false);
    // Low scrub: on the bare sides a few clumps, thicker near the top, a little apart from the brow;
    // on the camera's sides as thick as the zone's own scrub, all the way down.
    const scrub = [mat('Matorral', '#59613a', 0.08), mat('Matorral seco', '#8a8052', 0.08), mat('Matorral oscuro', '#434b2c', 0.08)].map(m => ({ m, b: new MeshBuilder() }));
    let k = 0;
    for (let i = 0; i < n; i++) {
      const len = Math.hypot(edge[(i + 1) % n][0] - edge[i][0], edge[(i + 1) % n][1] - edge[i][1]);
      for (let s = 0.3; s < len; s += 1.1 + jitter(k) * 0.9) for (let q = 0; q < (near[i] ? 8 : 1); q++) {
        const t = near[i] ? 0.03 + jitter(k + 1) * 0.94 : 0.06 + jitter(k + 1) ** 1.6 * 0.8, f = Math.min(1, (s + q * 0.23) / len), r = (0.45 + jitter(k + 2) * 0.65) / cellM;
        const ex = edge[i][0] + (edge[(i + 1) % n][0] - edge[i][0]) * f, ez = edge[i][1] + (edge[(i + 1) % n][1] - edge[i][1]) * f;
        const mx = miters[i][0] + (miters[(i + 1) % n][0] - miters[i][0]) * f, mz = miters[i][1] + (miters[(i + 1) % n][1] - miters[i][1]) * f;
        const run = runs[i] + (runs[(i + 1) % n] - runs[i]) * f;
        const spot: V3 = [x(ex + mx * run * t), slopeY(t), z(ez + mz * run * t)];
        blob(scrub[k % 3].b, spot, r, r * (0.5 + jitter(k + 3) * 0.3));
        k += 4;
      }
    }
    for (const s of scrub) add('Matorral', s.b, s.m, root, true, false);
  }
  /** A low-poly clump (a squat double pyramid half sunk in the ground), cheap enough to scatter by the hundred. */
  function blob(b: MeshBuilder, [cx, cy, cz]: V3, r: number, h: number) {
    const ring = [0, 1, 2, 3, 4, 5].map(i => { const a = (i / 6 + jitter(cx + cz)) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
    const top: V3 = [cx, cy + h, cz], bottom: V3 = [cx, cy - h * 0.4, cz];
    for (let i = 0; i < 6; i++) {
      const p: V3 = [ring[i][0], cy + h * 0.3, ring[i][1]], q: V3 = [ring[(i + 1) % 6][0], cy + h * 0.3, ring[(i + 1) % 6][1]];
      const out = [(p[0] + q[0]) / 2 - cx, (p[2] + q[2]) / 2 - cz];
      b.tri(p, q, top, [out[0], 0.8, out[1]]);
      b.tri(p, q, bottom, [out[0], -0.3, out[1]]);
    }
  }

  // The real materials, once loaded, dress everything built above (a scene left meanwhile stays as it is).
  if (scene.textures && Object.keys(scene.textures).length) {
    loadTextures(scene.textures).then(t => { if (!alive) return; loaded = t; onLoad.forEach(dressUp => dressUp()); });
  }

  // ------------------------------------------------------------ see-through cut
  // Materials are shared across blocks; the radius belongs to each mesh instance so a true
  // obstruction cannot open a hole in a neighbouring building that leaves Gerard visible.
  const occluders = [...buildingCuts.values()].map(cut => ({ cut, shape: createBuildingOccluder(cut.triangles) }));
  const cutFocus = device.scope.resolve('geoCutFocus'), cutToCamera = device.scope.resolve('geoCutToCamera'), cutRadius = device.scope.resolve('geoCutRadius');
  // Every pass binds the declared uniforms (WebGPU fills a buffer for the shadow pass too), so give them a value up front.
  cutRadius.setValue(0); cutFocus.setValue([0, 0, 0]); cutToCamera.setValue([0, 1, 0]);

  return {
    /** Opens the glowing cut round `focus` while a building stands between it and the camera. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      if (animate) { time += dt; river.diffuseMapOffset.set(time * 0.05, time * 0.02); river.emissiveMapOffset.set(-time * 0.03, time * 0.04); river.update(); }
      for (const { cut, shape } of occluders) {
        const target = focus && toCamera && buildingHidesPlayer(shape, focus, toCamera) ? CUT_RADIUS : 0;
        const radius = animate ? cut.radius + (target - cut.radius) * (1 - Math.exp(-dt * CUT_RATE)) : target;
        const next = Math.abs(radius - target) < 0.02 ? target : radius;
        if (cut.radius === next) continue;
        cut.radius = next;
        for (const instance of cut.instances) instance.setParameter('geoCutRadius', cut.radius);
      }
      if (focus && toCamera) {
        cutFocus.setValue([focus.x, focus.y, focus.z]);
        const d = toCamera.clone().normalize();
        cutToCamera.setValue([d.x, d.y, d.z]);
      }
    },
    destroy() { alive = false; cutRadius.setValue(0); meshes.forEach(m => m.destroy()); gpu.forEach(t => t.destroy()); },
  };
}
