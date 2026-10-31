import * as pc from 'playcanvas';
import { flankRun, type GeoBuilding, type GeoPoint, type GeoRoad, type GeoScene, type GeoShop } from './geo';
import { shine } from './lighting';
import { BUILDING_CUT_NEAR, buildingHidesPlayer, createBuildingOccluder } from './building-occlusion';
import { gpuTexture, grainOf, greyOf, loadTextures, tintColour, type LoadedTexture } from './materials';
import { LANDMARKS, type LandmarkKit } from './landmarks';
import { buildSea } from './geo-sea';

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
const FACADE_ATLAS: Record<string, [number, number]> = { flats: [4, 3], timber: [3, 2], vila: [3, 2], barceloneta: [4, 3], sants: [3, 2] };
/** Ground floors painted over more bays than the usual two, so a street of shop fronts does not repeat. */
const GROUND_BAYS: Record<string, number> = { 'sants-shops': 6 };
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
/** What wet asphalt and panot reflect, at full wetness. */
const WET_SHEEN = new pc.Color(0.14, 0.14, 0.14);
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
  /**
   * A box, for pieces that must open the cut (`kit.add(…, { cut: true })`) or tile a real material by
   * the metre: centre and size in metres, each face's UVs in metres. Upright (no `euler`), its UVs
   * are the faces' own positions, so the grain runs on from one box to the next (a cornice on its
   * wall); turned by `euler` (degrees round x, y and z: the roll first, then the pitch, then the turn
   * round the vertical), each face's UVs start at its corner.
   */
  box(centre: number[], size: number[], euler?: number[]) {
    if (!euler) {
      const [cx, cy, cz] = centre, [w, h, d] = size;
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [x1, y0], [x0, y0], [x0, y1], [x1, y1]);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [z1, y0], [z0, y0], [z0, y1], [z1, y1]);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0], [z1, y0], [z1, y1], [z0, y1]);
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, z0], [x1, z0], [x1, z1], [x0, z1]);
      return;
    }
    const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const r = [euler[0], euler[1], euler[2]].map(d => d * Math.PI / 180);
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(r[0]), Math.sin(r[0]), Math.cos(r[1]), Math.sin(r[1]), Math.cos(r[2]), Math.sin(r[2])];
    const turn = (v: V3): V3 => {
      let [x, y, z] = v;
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      return [x, y, z];
    };
    const at = (x: number, y: number, z: number): V3 => { const p = turn([x, y, z]); return [p[0] + centre[0], p[1] + centre[1], p[2] + centre[2]]; };
    const faces: [V3, V3, V3, V3, V3, number, number][] = [
      [at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz), turn([0, 0, 1]), size[0], size[1]],
      [at(hx, -hy, -hz), at(-hx, -hy, -hz), at(-hx, hy, -hz), at(hx, hy, -hz), turn([0, 0, -1]), size[0], size[1]],
      [at(hx, -hy, hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), turn([1, 0, 0]), size[2], size[1]],
      [at(-hx, -hy, -hz), at(-hx, -hy, hz), at(-hx, hy, hz), at(-hx, hy, -hz), turn([-1, 0, 0]), size[2], size[1]],
      [at(-hx, hy, hz), at(hx, hy, hz), at(hx, hy, -hz), at(-hx, hy, -hz), turn([0, 1, 0]), size[0], size[2]],
      [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, -hy, hz), at(-hx, -hy, hz), turn([0, -1, 0]), size[0], size[2]],
    ];
    for (const [a, c, d, e, n, u, v] of faces) this.quad(a, c, d, e, n, [0, 0], [u, 0], [u, v], [0, v]);
  }
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
interface Edge { x0: number; z0: number; x1: number; z1: number; hole: number }
/**
 * Each polygon minus the holes, as trapezoids between horizontal lines through every vertex and
 * every crossing of two edges (so no two edges swap places inside a strip): how a sunk river cuts
 * its bed out of the ground and the gardens. Each polygon and each hole is filled even-odd.
 */
function carve(polys: GeoPoint[][], holes: GeoPoint[][]): GeoPoint[][] {
  const edgesOf = (poly: GeoPoint[], hole: number): Edge[] => poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return a[1] < b[1] ? { x0: a[0], z0: a[1], x1: b[0], z1: b[1], hole } : { x0: b[0], z0: b[1], x1: a[0], z1: a[1], hole };
  }).filter(e => e.z1 - e.z0 > 1e-9);
  const xAt = (e: Edge, z: number) => e.x0 + (e.x1 - e.x0) * (z - e.z0) / (e.z1 - e.z0);
  const box = (poly: GeoPoint[]) => [Math.min(...poly.map(p => p[0])), Math.max(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[1]))];
  const holeBoxes = holes.map(box), holeEdges = holes.flatMap((h, i) => edgesOf(h, i));
  const out: GeoPoint[][] = [];
  for (const poly of polys) {
    const [x0, x1, z0, z1] = box(poly);
    // A polygon clear of every hole stays whole.
    if (!holeBoxes.some(([hx0, hx1, hz0, hz1]) => hx0 < x1 && hx1 > x0 && hz0 < z1 && hz1 > z0)) { out.push(poly); continue; }
    const edges = [...edgesOf(poly, -1), ...holeEdges.filter(e => e.z1 > z0 && e.z0 < z1)];
    const levels = new Set([z0, z1]);
    for (const e of edges) { if (e.z0 > z0) levels.add(e.z0); if (e.z1 < z1) levels.add(e.z1); }
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      const dax = a.x1 - a.x0, daz = a.z1 - a.z0, dbx = b.x1 - b.x0, dbz = b.z1 - b.z0, den = dax * dbz - daz * dbx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((b.x0 - a.x0) * dbz - (b.z0 - a.z0) * dbx) / den, u = ((b.x0 - a.x0) * daz - (b.z0 - a.z0) * dax) / den;
      if (t > 0 && t < 1 && u > 0 && u < 1) levels.add(a.z0 + daz * t);
    }
    const zs = [...levels].filter(z => z >= z0 && z <= z1).sort((a, b) => a - b);
    for (let k = 0; k + 1 < zs.length; k++) {
      const za = zs[k], zb = zs[k + 1];
      if (zb - za < 1e-6) continue;
      const zm = (za + zb) / 2;
      const live = edges.filter(e => e.z0 <= zm && e.z1 > zm).sort((a, b) => xAt(a, zm) - xAt(b, zm));
      const inHole = holes.map(() => false);
      let inside = false, open: Edge | undefined;
      for (const e of live) {
        const was = inside && !inHole.includes(true);
        if (e.hole < 0) inside = !inside; else inHole[e.hole] = !inHole[e.hole];
        const now = inside && !inHole.includes(true);
        if (now && !was) open = e;
        else if (was && !now && open) out.push([[xAt(open, za), za], [xAt(e, za), za], [xAt(e, zb), zb], [xAt(open, zb), zb]]);
      }
    }
  }
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
  const streets = scene.roads.filter(r => r.kind === 'road');
  /** Whether a point lies on the asphalt of a street (other than `self`). */
  const onStreet = (px: number, pz: number, self?: GeoRoad) => streets.some(r => r !== self && r.line.some((a, i) => {
    const b = r.line[i + 1];
    if (!b) return false;
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
    return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz) < r.width / 2 + 0.05;
  }));
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
  /** A sunk river (`look.river_m`): its water lies this many cells below the street, cut out of every ground layer. */
  const sunk = (look.river_m ?? 0) / cellM;
  const dry = (polys: GeoPoint[][]) => sunk > 0 ? carve(polys, scene.areas.water) : polys;
  const groundMat = look.ground === 'panot' ? surface('Panot gris', 'ground', panot(), 0.25, 0.08)
    : surface('Suelo urbano', 'ground', speckles('#cbc2ab', ['#bfb59c', '#d6cdb8', '#b8ad94']), 0.25);
  // On a hilltop (`drop`) the ground ends at the brow; elsewhere it fills the map.
  flat('Suelo', dry([scene.drop?.edge ?? [[-0.5, -0.5], [W - 0.5, -0.5], [W - 0.5, D - 0.5], [-0.5, D - 0.5]]]), LAYER.ground, groundMat);
  flat('Arena', dry(scene.areas.sand ?? []), LAYER.sand, surface('Arena', 'sand', speckles('#e3cf9f', ['#d8c08a', '#efdfb8', '#cdb27a']), 0.25));
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
        // …and off the streets that cross the bed.
        if (!inside(px, pz, poly) || crowded(px, pz, r) || onStreet(px, pz)) continue;
        const e = new pc.Entity('Mata');
        e.addComponent('render', { type: 'sphere', material: shrubs[k % shrubs.length], castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
        e.setPosition(x(px), 0.05, z(pz)); e.setLocalScale(r, r * (0.55 + jitter(k) * 0.4), r); root.addChild(e);
      }
    }
  } else flat('Huertas y jardines', dry(scene.areas.grass), LAYER.grass, surface('Hierba', 'grass', speckles('#86a462', ['#7a9858', '#95b36d', '#6f8c4f']), 0.25));
  const undergrowth = surface('Sotobosque', 'forest', speckles('#4f6d42', ['#45603a', '#5c7b4b', '#3d5634']), 0.25);
  flat('Bosque', dry(scene.areas.forest), LAYER.forest, undergrowth);
  const plaza = surface('Losas de la plaza', 'square', canvas(128, 128, ctx => {
    ctx.fillStyle = '#a99d88'; ctx.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `hsl(${30 + jitter(r * 4 + k) * 8}, 18%, ${68 + jitter(r * 9 + k) * 8}%)`;
      ctx.fillRect(k * 32 + 1, r * 32 + 1, 30, 30);
    }
  }), 0.5, 0.1);
  flat('Plazas', dry(scene.areas.square), LAYER.square, plaza);
  // Rivers reuse the pool's caustics, tinted deep green and drifting downstream. A place's own `water`
  // is a turbid river: its colour on pale ripples, so the pool's blue does not turn it teal, and only a
  // little of the sky on it, as a muddy river shows its own colour more than the clouds.
  const ripples = look.water ? kit.texture(canvas(128, 128, ctx => {
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ffffff60'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const y = jitter(i) * 128, a = jitter(i + 40) * 8 + 3;
      ctx.beginPath();
      for (let px = -8; px <= 136; px += 8) ctx.lineTo(px, y + Math.sin(px / 128 * Math.PI * 4 + i) * a);
      ctx.stroke();
    }
  })) : kit.water.diffuseMap;
  const river = mat('Río', look.water ?? '#7f9f8c', 0.85);
  river.diffuseMap = ripples; river.emissive.fromString(look.water ?? '#6f9a86'); river.emissiveMap = ripples; river.emissiveIntensity = 0.08;
  river.diffuseMapTiling.set(0.08 / cellM, 0.08 / cellM); river.emissiveMapTiling.set(0.08 / cellM, 0.08 / cellM);
  shine(river, 'water');
  if (look.water) { river.specular.fromString('#4a5050'); river.reflectivity = 0.55; river.update(); }
  // A beach's water is the sea, with its shore, waves and swash (src/geo-sea.ts); anything else is a river.
  const sea = look.sea
    ? buildSea(kit, scene.areas.water, { width: W, depth: D, cell: cellM }, surface('Arena mojada', 'wet', speckles('#8d7655', ['#806a4b', '#9a8462']), 0.25, 0.3))
    : undefined;
  if (!sea) flat('Río', scene.areas.water, LAYER.water - sunk, river);
  if (sunk > 0) {
    // The banks: stone walls from the street down to the water, leaning back a little, darker and
    // green where the river licks them. Where the river leaves the map there is no bank: the diorama is cut.
    const bank = surface('Muro del río', 'bank', speckles('#7d7b70', ['#6c6a60', '#8e8b80', '#5f5d55']), 0.5);
    const walls = new MeshBuilder(), marks = new MeshBuilder();
    const top = LAYER.ground, low = LAYER.water - sunk - 0.04, lean = sunk * 0.12, tide = 0.78;
    const onEdge = (a: number, b: number, max: number) => Math.abs(a - b) < 0.02 && (Math.abs(a + 0.5) < 0.02 || Math.abs(a - max + 0.5) < 0.02);
    for (const poly of scene.areas.water) {
      const ccw = signedArea(poly) > 0;
      let run = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-3 || onEdge(a[0], b[0], W) || onEdge(a[1], b[1], D)) { run += len; continue; }
        // Towards the water, which lies left of each edge on a counter-clockwise ring.
        const ix = (ccw ? a[1] - b[1] : b[1] - a[1]) / len, iz = (ccw ? b[0] - a[0] : a[0] - b[0]) / len;
        const at = (p: GeoPoint, k: number, out = 0): V3 => P([p[0] + ix * (lean * k + out), p[1] + iz * (lean * k + out)], top + (low - top) * k);
        const u0 = run * cellM, u1 = (run + len) * cellM, v = (top - low) * cellM;
        walls.quad(at(a, 0), at(b, 0), at(b, 1), at(a, 1), [ix, 0.4, iz], [u0, 0], [u1, 0], [u1, v], [u0, v]);
        marks.quad(at(a, tide, 0.02), at(b, tide, 0.02), at(b, 1, 0.02), at(a, 1, 0.02), [ix, 0.4, iz], [0, 0], [1, 0], [1, 1], [0, 1]);
        run += len;
      }
    }
    add('Orillas', walls, bank);
    add('Verdín', marks, mat('Verdín', '#39432f', 0.3), root, true, false);
  }
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
      // Over a sunk river the deck shows its thickness.
      if (sunk > 0) edges('Canto del puente', road.line, half + 0.06, 0.7, 0.2, LAYER.bridge - 0.7, bridgeStone);
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

  /** Stretches of kerb along each street's edges: where it starts and ends, and the side it faces. */
  const kerbs: { a: GeoPoint; b: GeoPoint; out: GeoPoint }[] = [];
  if (look.kerbs) {
    // Granite kerbs, 30 cm wide and proud of the asphalt, along both edges of every street; broken
    // where another street joins and lowered at the zebras, where people cross.
    const lowered = (px: number, pz: number) => (scene.crossings ?? []).some(c => {
      const dx = px - c.x, dz = pz - c.z, along = dx * Math.cos(c.angle) + dz * Math.sin(c.angle);
      return Math.abs(along) < 1.4 && Math.abs(-dx * Math.sin(c.angle) + dz * Math.cos(c.angle)) < c.width / 2 + 0.6;
    });
    const stone = new MeshBuilder(), wide = 0.3 / cellM, high = 0.09;
    for (const road of streets) for (let i = 0; i + 1 < road.line.length; i++) {
      const a = road.line[i], b = road.line[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      for (const side of [-1, 1]) {
        const n = [-u[1] * side, u[0] * side], off = road.width / 2;
        const at = (t: number, o: number): GeoPoint => [a[0] + u[0] * t + n[0] * (off + o), a[1] + u[1] * t + n[1] * (off + o)];
        const lay = (t0: number, t1: number) => {
          const ring = [at(t0, 0), at(t1, 0), at(t1, wide), at(t0, wide)], mid = at((t0 + t1) / 2, wide / 2);
          for (let k = 0; k < 4; k++) {
            const p = ring[k], q = ring[(k + 1) % 4], l = Math.hypot(q[0] - p[0], q[1] - p[1]) * cellM;
            stone.quad(P(p, 0), P(q, 0), P(q, high), P(p, high), [(p[0] + q[0]) / 2 - mid[0], 0, (p[1] + q[1]) / 2 - mid[1]], [0, 0], [l, 0], [l, high * cellM], [0, high * cellM]);
          }
          stone.quad(P(ring[0], high), P(ring[1], high), P(ring[2], high), P(ring[3], high), [0, 1, 0], metres(ring[0]), metres(ring[1]), metres(ring[2]), metres(ring[3]));
          kerbs.push({ a: ring[0], b: ring[1], out: n });
        };
        // Sample the edge every half cell and lay a kerb over each unbroken run.
        const steps = Math.max(1, Math.round(len / 0.5));
        const ok = Array.from({ length: steps + 1 }, (_, k) => { const p = at(k * len / steps, wide / 2); return !onStreet(p[0], p[1], road) && !lowered(p[0], p[1]); });
        for (let k = 0; k <= steps;) {
          if (!ok[k]) { k++; continue; }
          let e = k;
          while (e < steps && ok[e + 1]) e++;
          const t0 = k === 0 ? 0 : (k - 0.5) * len / steps, t1 = e === steps ? len : (e + 0.5) * len / steps;
          if (t1 - t0 > 0.4) lay(t0, t1);
          k = e + 1;
        }
      }
    }
    const granite = mat('Bordillo de granito', '#b9b5ac', 0.08);
    onLoad.push(() => dress(granite, 'granit', '#b9b5ac'));
    add('Bordillos', stone, granite, root, true, true);
  }

  // ------------------------------------------------------------ facades and roofs
  const textures = new Map<string, pc.StandardMaterial>();
  /** Facades whose lit windows and shop fronts glow as the evening comes (their emissive map is only those). */
  const evening: pc.StandardMaterial[] = [];
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
    const ground = ['masonry', 'arcade', 'ashlar', 'ashlar-arcade', 'shops', 'lobby', 'mall-front', 'shopfronts', 'socol', 'sants-shops', 'bars'].includes(kind);
    const [atlasU, atlasV] = FACADE_ATLAS[kind] ?? [1, 1];
    const w = ground ? 128 * (GROUND_BAYS[kind] ?? 2) : 128 * atlasU, h = 192 * atlasV;
    const glass = '#2c3a42', wood = '#5b3d2a';
    // Varies blinds, shutters and awnings between walls of different colours.
    const seed = [...wall].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    /** Lit windows and shop fronts, painted again on their own as the glow they give at dusk. */
    const glows: number[][] = [];
    const draw = (ctx: CanvasRenderingContext2D) => {
      glows.length = 0;
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
      } else if (kind === 'timber') {
        // Basque timber framing, three bays by two storeys: dark posts and floor beams (the trim
        // colour) over whitewashed panels, some with a brace; varnished windows, some with board
        // shutters folded back; and per bay a wooden balcony with turned balusters, an iron one full
        // of geraniums, or just a sill.
        paint(wall, 'wall');
        const r = (i: number) => jitter(seed * 5.1 + i);
        const frame = '#6e4529', rail = '#4a2f1f';
        const flowers = (x0: number, y0: number, n: number) => {
          for (let k = 0; k < n; k++) {
            ctx.fillStyle = ['#4f7a3a', '#d6383f', '#c22f3a', '#5d8a40', '#e0505a'][k % 5];
            ctx.beginPath(); ctx.arc(x0 + k * 6.6, y0 + jitter(seed + k) * 5, 4 + jitter(seed + k + 3) * 2, 0, Math.PI * 2); ctx.fill();
          }
        };
        for (let fy = 0; fy < atlasV; fy++) for (let bx = 0; bx < atlasU; bx++) {
          const x0 = bx * 128, y0 = fy * 192, i = 20 + fy * 11 + bx * 7;
          // The post at the bay's edge, a little crooked like old oak, the floor beam and the plate above.
          ctx.fillStyle = trim;
          const crook = (r(i) - 0.5) * 5;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 10, y0); ctx.lineTo(x0 + 10 + crook, y0 + 192); ctx.lineTo(x0 + crook, y0 + 192); ctx.fill();
          ctx.fillRect(x0, y0 + 179, 128, 13); ctx.fillRect(x0, y0, 128, 7);
          if (r(i + 1) > 0.55) { ctx.save(); ctx.translate(x0 + 14, y0 + 176); ctx.rotate(-1.05); ctx.fillRect(0, -3.5, 64, 7); ctx.restore(); }
          const pick = r(i + 2), balcony = pick > 0.62 ? 'wood' : pick > 0.3 ? 'iron' : 'none';
          // A French window onto a balcony, or a window with a sill: four panes in a varnished frame.
          const wx = x0 + 38, wy = y0 + (balcony === 'none' ? 46 : 30), ww = 52, wh = balcony === 'none' ? 86 : 132;
          ctx.fillStyle = frame; ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 10);
          ctx.fillStyle = glass; ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = 'rgba(190,220,235,.2)'; ctx.fillRect(wx + 3, wy + 3, ww * 0.3, wh - 6);
          ctx.fillStyle = frame; ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh); ctx.fillRect(wx, wy + wh * 0.42, ww, 3);
          if (r(i + 3) > 0.5) {
            ctx.fillStyle = r(i + 4) > 0.45 ? '#8f3424' : '#7a4b2f';
            for (const sx of [wx - 23, wx + ww + 9]) {
              ctx.fillRect(sx, wy - 4, 14, wh + 6);
              ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let y = wy + 9; y < wy + wh; y += 14) ctx.fillRect(sx, y, 14, 2);
              ctx.fillStyle = r(i + 4) > 0.45 ? '#8f3424' : '#7a4b2f';
            }
          }
          if (balcony === 'wood') {
            ctx.fillStyle = rail; ctx.fillRect(x0 + 16, y0 + 166, 96, 13); ctx.fillRect(x0 + 16, y0 + 120, 96, 7);
            for (let k = 0; k < 11; k++) {
              ctx.fillRect(x0 + 20 + k * 8.4, y0 + 126, 3.5, 40);
              ctx.beginPath(); ctx.arc(x0 + 21.75 + k * 8.4, y0 + 146, 3.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x0 + 16, y0 + 179, 96, 6);
            if (r(i + 5) > 0.5) flowers(x0 + 24, y0 + 116, 6);
          } else if (balcony === 'iron') {
            ctx.fillStyle = '#b5ab98'; ctx.fillRect(x0 + 18, y0 + 166, 92, 9);
            ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fillRect(x0 + 18, y0 + 175, 92, 5);
            ctx.fillStyle = '#1f2224'; ctx.fillRect(x0 + 18, y0 + 122, 92, 4);
            for (let k = 0; k < 12; k++) ctx.fillRect(x0 + 20 + k * 7.5, y0 + 122, 2.5, 44);
            flowers(x0 + 22, y0 + 118, 13);
          } else {
            ctx.fillStyle = '#b5ab98'; ctx.fillRect(wx - 8, wy + wh + 4, ww + 16, 6);
            ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(wx - 8, wy + wh + 10, ww + 16, 3);
          }
        }
      } else if (kind === 'rendered') {
        paint(wall, 'wall');
        window(36, 46, 56, 92, trim);
        ctx.fillStyle = '#3f6b4a';
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
          if (lit) glows.push([x0, y0, ww, hh]);
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
      } else if (kind === 'slab') {
        // A 1960s–70s rental slab: a white ribbon of windows in aluminium frames over a brown
        // spandrel, storey after storey; a few blinds down, a few flats lit.
        paint(wall, 'wall');
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(0, 112, w, 4);
        ctx.fillStyle = trim; ctx.fillRect(0, 16, w, 84);
        for (const [i, x0] of [6, 68].entries()) {
          const lit = jitter(seed + i * 5.3) > 0.82, down = jitter(seed + i * 9.1) > 0.6 ? 0.35 + jitter(seed + i) * 0.5 : 0;
          ctx.fillStyle = lit ? '#f1c77a' : '#4f6572'; ctx.fillRect(x0, 22, 54, 72);
          if (lit) glows.push([x0, 22, 54, 72]);
          ctx.fillStyle = 'rgba(205,225,235,.28)'; ctx.fillRect(x0 + 3, 25, 16, 66);
          if (down) { ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x0, 22, 54, 72 * down); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 25; y < 22 + 72 * down; y += 4) ctx.fillRect(x0, y, 54, 1); }
          ctx.fillStyle = '#c9cdcf'; ctx.fillRect(x0 + 26, 22, 3, 72);
        }
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 100, w, 3);
      } else if (kind === 'party') {
        // A bare party wall (mitgera) where a block rises over its neighbour: the brick's own grain
        // and water stains running down from the top.
        paint(wall, 'wall');
        for (let k = 0; k < 3; k++) {
          const sx = jitter(seed + k * 3.7) * w, sw = 6 + jitter(seed + k) * 14;
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, 'rgba(40,30,25,.16)'); g.addColorStop(1, 'rgba(40,30,25,0)');
          ctx.fillStyle = g; ctx.fillRect(sx, 0, sw, h);
        }
      } else if (kind === 'barceloneta') {
        // The old Barceloneta (quarts de casa raised in the 19th century), four bays by three storeys:
        // in every bay a French window in a stone surround onto a small iron balcony, closed by green
        // louvred shutters or a wooden roll blind hung outside, washing over most railings, plants,
        // the odd air conditioner, floor bands between storeys and a cable sagging across.
        paint(wall, 'wall');
        const r = (i: number) => jitter(seed * 5.1 + i);
        const shutter = ['#4f7a52', '#3f6b55', '#6b8a5a', '#7d6a4f', '#5d7c86'][Math.floor(r(1) * 5)];
        const stone = '#cfc5b0', iron = '#25292b';
        const clothes = ['#f4f1ea', '#5e86c4', '#d05a5a', '#f2c94c', '#3fa38a', '#e8846a', '#2f3f66', '#f4f1ea'];
        for (let fy = 0; fy < atlasV; fy++) for (let bx = 0; bx < atlasU; bx++) {
          const x0 = bx * 128, y0 = fy * 192, i = 60 + fy * 17 + bx * 7;
          const wx = x0 + 36, ww = 56, wy = y0 + 34, wh = 128;
          ctx.fillStyle = 'rgba(255,250,240,.22)'; ctx.fillRect(x0, y0 + 180, 128, 6);
          ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(x0, y0 + 186, 128, 4);
          // The stone surround with a shallow arched head, then the dark opening.
          ctx.fillStyle = stone; ctx.beginPath(); ctx.roundRect(wx - 8, wy - 10, ww + 16, wh + 10, [16, 16, 0, 0]); ctx.fill();
          ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, [10, 10, 0, 0]); ctx.fill();
          const close = r(i);
          if (close < 0.45) {
            // A wooden roll blind hanging outside, let down part of the way and tied.
            const down = 0.3 + r(i + 1) * 0.65;
            ctx.fillStyle = r(i + 8) > 0.5 ? shutter : '#a88a62'; ctx.fillRect(wx - 2, wy, ww + 4, wh * down);
            ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = wy + 3; y < wy + wh * down; y += 4) ctx.fillRect(wx - 2, y, ww + 4, 1);
          } else if (close < 0.85) {
            // Louvred shutters, one leaf folded back against the wall, the other half shut.
            ctx.fillStyle = shutter; ctx.fillRect(wx - 30, wy + 2, 24, wh - 2); ctx.fillRect(wx + ww / 2, wy + 2, ww / 2, wh - 2);
            ctx.fillStyle = 'rgba(0,0,0,.2)';
            for (let y = wy + 6; y < wy + wh; y += 5) { ctx.fillRect(wx - 30, y, 24, 1.5); ctx.fillRect(wx + ww / 2, y, ww / 2, 1.5); }
          } else {
            ctx.fillStyle = 'rgba(240,236,226,.7)'; ctx.fillRect(wx + 6, wy + 8, 14, wh - 10);
          }
          if (r(i + 2) > 0.15) {
            // The balcony: a thin stone slab and a plain iron railing in front of the window.
            ctx.fillStyle = '#b8b0a2'; ctx.fillRect(x0 + 18, y0 + 160, 92, 8);
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 18, y0 + 168, 92, 5);
            if (r(i + 3) > 0.35) {
              // Washing over the railing: towels, a shirt, sheets, pegged on and hanging down.
              for (let k = 0; k < 3; k++) {
                if (r(i + 10 + k) < 0.3) continue;
                ctx.fillStyle = clothes[Math.floor(r(i + 20 + k) * clothes.length)];
                const cw = 18 + r(i + 30 + k) * 14, ch = 22 + r(i + 40 + k) * 26;
                ctx.fillRect(x0 + 22 + k * 30, y0 + 120, cw, ch);
                ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x0 + 22 + k * 30, y0 + 120 + ch - 3, cw, 3);
              }
            }
            ctx.fillStyle = iron; ctx.fillRect(x0 + 18, y0 + 118, 92, 4);
            for (let k = 0; k < 13; k++) ctx.fillRect(x0 + 20 + k * 7.2, y0 + 118, 2, 42);
            if (r(i + 4) > 0.7) for (let k = 0; k < 2; k++) {
              ctx.fillStyle = '#b8704f'; ctx.fillRect(x0 + 24 + k * 64, y0 + 146, 12, 14);
              ctx.fillStyle = ['#4f7a3a', '#6d9a48', '#d23a4a'][Math.floor(r(i + 5 + k) * 3)];
              ctx.beginPath(); ctx.arc(x0 + 30 + k * 64, y0 + 142, 9, 0, Math.PI * 2); ctx.fill();
            }
          } else {
            ctx.fillStyle = stone; ctx.fillRect(wx - 10, y0 + 160, ww + 20, 7);
          }
          if (r(i + 6) > 0.85) {
            ctx.fillStyle = '#e8e6e1'; ctx.fillRect(x0 + 96, y0 + 40, 26, 18);
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 96, y0 + 58, 26, 3);
          }
        }
        if (r(99) > 0.4) {
          // A telephone or power cable sagging across the front.
          const cy = 30 + r(98) * (h - 60);
          ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, cy); ctx.quadraticCurveTo(w / 2, cy + 14, w, cy + 4); ctx.stroke();
        }
      } else if (kind === 'sants') {
        // Old Sants houses (Carrer de Valladolid, Badalona 9): render scored into ashlar blocks, a pale
        // stone surround round each French window, a string course at every floor, wooden roll-up
        // blinds hanging outside (persianes) or louvred shutters, iron balconies on stone slabs, a few plants.
        paint(wall, 'wall');
        const r = (i: number) => jitter(seed * 3.7 + i);
        ctx.strokeStyle = 'rgba(70,50,30,.16)'; ctx.lineWidth = 1.2;
        for (let y = 12; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        for (let y = 12, k = 0; y < h; y += 24, k++) for (let x = (k % 2) * 24; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke(); }
        const stone = '#e6dac2', wood = ['#6b5038', '#56664f', '#7a6a50', '#59605f', '#8a6d48', '#6f5a48'][Math.floor(r(1) * 6)];
        for (let fy = 0; fy < atlasV; fy++) {
          const y0 = fy * 192;
          ctx.fillStyle = trim; ctx.fillRect(0, y0 + 180, w, 12);
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, y0 + 178, w, 2);
          for (let bx = 0; bx < atlasU; bx++) {
            const x0 = bx * 128, i = 20 + fy * 11 + bx * 5;
            const balcony = r(i) > 0.4, lit = r(i + 1) > 0.88, blind = r(i + 2);
            // The stone surround, with a deeper lintel.
            ctx.fillStyle = stone; ctx.fillRect(x0 + 30, y0 + 22, 68, 142); ctx.fillRect(x0 + 26, y0 + 18, 76, 12);
            ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x0 + 26, y0 + 30, 76, 2);
            // The opening: dark glass or a lit room, two leaves.
            ctx.fillStyle = lit ? '#f1c77a' : glass; ctx.fillRect(x0 + 37, y0 + 32, 54, 132);
            ctx.fillStyle = lit ? 'rgba(255,245,220,.5)' : 'rgba(190,220,235,.2)'; ctx.fillRect(x0 + 40, y0 + 36, 14, 124);
            ctx.fillStyle = trim; ctx.fillRect(x0 + 62, y0 + 32, 4, 132);
            if (blind < 0.62) {
              // A persiana rolled down part of the way, its slats and the roll at the top.
              const down = 0.25 + r(i + 3) * 0.7, bh = 128 * down;
              ctx.fillStyle = wood; ctx.fillRect(x0 + 35, y0 + 32, 58, bh);
              ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = y0 + 35; y < y0 + 32 + bh; y += 4) ctx.fillRect(x0 + 35, y, 58, 1.2);
              ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x0 + 35, y0 + 32, 58, 5);
              ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 35, y0 + 32 + bh, 58, 2);
            } else if (blind < 0.85) {
              // Louvred shutters folded back against the wall on either side.
              ctx.fillStyle = wood; ctx.fillRect(x0 + 10, y0 + 32, 18, 132); ctx.fillRect(x0 + 100, y0 + 32, 18, 132);
              ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let y = y0 + 36; y < y0 + 164; y += 6) { ctx.fillRect(x0 + 10, y, 18, 1.5); ctx.fillRect(x0 + 100, y, 18, 1.5); }
            } else {
              // A net curtain behind the glass.
              ctx.fillStyle = 'rgba(240,236,226,.55)'; ctx.fillRect(x0 + 37, y0 + 40, 54, 110);
            }
            if (balcony) {
              // A stone slab on its shadow, the iron railing over it, sometimes pots of plants.
              ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0 + 16, y0 + 170, 96, 6);
              ctx.fillStyle = '#c9bda6'; ctx.fillRect(x0 + 14, y0 + 162, 100, 9);
              ctx.fillStyle = '#26292a'; ctx.fillRect(x0 + 16, y0 + 118, 96, 4);
              for (let k = 0; k < 16; k++) ctx.fillRect(x0 + 17 + k * 6, y0 + 118, 2, 44);
              if (r(i + 4) > 0.55) {
                // Modernista railings belly out with a curl at the middle.
                ctx.strokeStyle = '#26292a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0 + 64, y0 + 140, 10, 0, Math.PI * 2); ctx.stroke();
              }
              if (r(i + 5) > 0.5) for (let k = 0; k < 4; k++) {
                ctx.fillStyle = '#9a5a3c'; ctx.fillRect(x0 + 20 + k * 24, y0 + 150, 10, 12);
                ctx.fillStyle = ['#4f7a3a', '#6d9a48', '#3f6a38', r(i + 6 + k) > 0.8 ? '#c8503e' : '#5c8a44'][k];
                ctx.beginPath(); ctx.arc(x0 + 25 + k * 24, y0 + 144, 9 + r(i + k) * 4, 0, Math.PI * 2); ctx.fill();
              }
            } else {
              // A French window with a low iron guard and a stone sill.
              ctx.fillStyle = '#c9bda6'; ctx.fillRect(x0 + 28, y0 + 163, 72, 6);
              ctx.fillStyle = '#26292a'; ctx.fillRect(x0 + 36, y0 + 134, 56, 3);
              for (let k = 0; k < 10; k++) ctx.fillRect(x0 + 37 + k * 6, y0 + 134, 2, 29);
            }
          }
        }
      } else if (kind === 'sants-shops') {
        // Sants ground floors: scored stone render, segmental arches, and behind each a lit shop, a
        // street door with its fanlight grille, or a metal shutter painted with a mural (Carrer de Riego).
        paint(base, 'base');
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5;
        for (let y = 20; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        const murals = [
          // A tiger, a boat on the sea, two enormous hands, a field of flowers, rings of colour.
          (x0: number, y0: number, ww: number, hh: number) => { ctx.fillStyle = '#d9894a'; ctx.fillRect(x0, y0 + hh * 0.3, ww, hh * 0.45); ctx.fillStyle = '#2a2420'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 8 + k * ww / 6, y0 + hh * 0.3, 5, hh * 0.45); ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(x0 + ww * 0.8, y0 + hh * 0.42, 9, 0, Math.PI * 2); ctx.fill(); },
          (x0: number, y0: number, ww: number, hh: number) => { ctx.fillStyle = '#3c6f93'; ctx.fillRect(x0, y0 + hh * 0.55, ww, hh * 0.45); ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.moveTo(x0 + ww * 0.25, y0 + hh * 0.55); ctx.lineTo(x0 + ww * 0.75, y0 + hh * 0.55); ctx.lineTo(x0 + ww * 0.65, y0 + hh * 0.66); ctx.lineTo(x0 + ww * 0.35, y0 + hh * 0.66); ctx.fill(); ctx.fillRect(x0 + ww * 0.49, y0 + hh * 0.2, 3, hh * 0.35); ctx.beginPath(); ctx.moveTo(x0 + ww * 0.52, y0 + hh * 0.22); ctx.lineTo(x0 + ww * 0.72, y0 + hh * 0.5); ctx.lineTo(x0 + ww * 0.52, y0 + hh * 0.5); ctx.fill(); },
          (x0: number, y0: number, ww: number, hh: number) => { ctx.fillStyle = '#d6a37e'; for (const k of [0, 1]) { ctx.beginPath(); ctx.ellipse(x0 + ww * (0.3 + k * 0.4), y0 + hh * 0.55, ww * 0.17, hh * 0.32, (k ? -1 : 1) * 0.3, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let k = 0; k < 4; k++) ctx.fillRect(x0 + ww * 0.2 + k * 6, y0 + hh * 0.3, 2, hh * 0.2); },
          (x0: number, y0: number, ww: number, hh: number) => { ctx.fillStyle = '#5b7f45'; ctx.fillRect(x0, y0 + hh * 0.6, ww, hh * 0.4); for (let k = 0; k < 9; k++) { ctx.fillStyle = ['#e0b23a', '#c8643f', '#f2e6c8'][k % 3]; ctx.beginPath(); ctx.arc(x0 + 8 + (k * 37) % (ww - 12), y0 + hh * (0.45 + (k % 3) * 0.12), 6, 0, Math.PI * 2); ctx.fill(); } },
          (x0: number, y0: number, ww: number, hh: number) => { for (let k = 0; k < 4; k++) { ctx.strokeStyle = ['#c8643f', '#2f62a8', '#e0b23a', '#3f8a4f'][k]; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x0 + ww / 2, y0 + hh * 0.7, 12 + k * 9, Math.PI, 0); ctx.stroke(); } },
        ];
        const bays = w / 128;
        for (let i = 0; i < bays; i++) {
          const x0 = i * 128 + 14, ow = 100, top = 46, kind = jitter(seed * 1.9 + i * 7.3);
          // The arched opening in its stone frame.
          ctx.fillStyle = '#ddd2bd'; ctx.beginPath(); ctx.moveTo(x0 - 6, h); ctx.lineTo(x0 - 6, top + 8); ctx.quadraticCurveTo(x0 + ow / 2, top - 16, x0 + ow + 6, top + 8); ctx.lineTo(x0 + ow + 6, h); ctx.fill();
          ctx.save(); ctx.beginPath(); ctx.moveTo(x0, h); ctx.lineTo(x0, top + 14); ctx.quadraticCurveTo(x0 + ow / 2, top - 6, x0 + ow, top + 14); ctx.lineTo(x0 + ow, h); ctx.clip();
          if (kind < 0.3) {
            // A lit shop: warm glass, a door in it, shelves behind.
            ctx.fillStyle = 'rgba(255,206,140,.8)'; ctx.fillRect(x0, top - 10, ow, h);
            ctx.fillStyle = 'rgba(120,80,40,.35)'; for (let k = 0; k < 3; k++) ctx.fillRect(x0 + 6, top + 50 + k * 34, ow - 44, 4);
            ctx.fillStyle = '#3a3f42'; ctx.fillRect(x0 + ow - 34, top + 20, 4, h); ctx.fillRect(x0, top + 20, ow, 4);
          } else if (kind < 0.62) {
            // A metal shutter down, painted as a mural.
            ctx.fillStyle = '#8f9396'; ctx.fillRect(x0, top - 10, ow, h);
            murals[Math.floor(jitter(seed + i * 3.1) * murals.length)](x0, top, ow, h - top);
            ctx.fillStyle = 'rgba(0,0,0,.14)'; for (let y = top; y < h; y += 6) ctx.fillRect(x0, y, ow, 1.5);
          } else {
            // A street door of dark wood under a fanlight with an iron grille.
            ctx.fillStyle = '#2c3a42'; ctx.fillRect(x0, top - 10, ow, 60);
            ctx.strokeStyle = '#1d1f20'; ctx.lineWidth = 2; for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x0 + k * ow / 6, top - 10); ctx.lineTo(x0 + k * ow / 6, top + 50); ctx.stroke(); }
            ctx.fillStyle = '#4a3324'; ctx.fillRect(x0 + 6, top + 50, ow - 12, h);
            ctx.fillStyle = '#5f4330'; for (let k = 0; k < 2; k++) ctx.fillRect(x0 + 12 + k * (ow - 24) / 2, top + 58, (ow - 36) / 2, h - top - 66);
            ctx.fillStyle = '#c9b48a'; ctx.fillRect(x0 + ow / 2 - 2, top + 110, 4, 10);
          }
          ctx.restore();
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
          if (!shut && kind === 'shops') glows.push([x0 + 6, 56, 88, h - 62]);
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
          } else { ctx.fillStyle = trim; ctx.fillRect(x0, 34, 100, 16); ctx.fillStyle = '#2c3a42'; ctx.fillRect(x0 + 30, 70, 40, h - 70); glows.push([x0 + 30, 70, 40, h - 70]); }
        }
      } else if (kind === 'shopfronts') {
        // The Meridiana's ground floors: shop windows in aluminium frames with the lit shop seen
        // through the glass (a warm ceiling, shelves of goods), a teal or grey canvas awning over
        // some, and here and there a shutter down with its tags.
        paint(base, 'base');
        const goods = ['#c9483c', '#e2c25a', '#4f7fa8', '#6e9a5a', '#ece6d8', '#7a6a58', '#d98a3c'];
        for (const [i, x0] of [14, 142].entries()) {
          const r = (k: number) => jitter(seed + i * 13 + k);
          ctx.fillStyle = '#a3a8aa'; ctx.fillRect(x0, 46, 100, h - 46);
          // The texture repeats every two shops, so a shutter down shows on every other one: keep it rare.
          if (r(1) > 0.93) {
            ctx.fillStyle = '#8f9396'; ctx.fillRect(x0 + 5, 52, 90, h - 52);
            ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 54; y < h; y += 6) ctx.fillRect(x0 + 5, y, 90, 1.5);
            for (let t = 0; t < 2; t++) {
              ctx.strokeStyle = ['#2f7fc4', '#f0c234', '#ffffff', '#1d1d1d'][(seed + i + t) % 4]; ctx.lineWidth = 4; ctx.beginPath();
              const tx = x0 + 14 + r(t + 3) * 46, ty = 96 + r(t + 5) * 60;
              ctx.moveTo(tx, ty); ctx.bezierCurveTo(tx + 12, ty - 22, tx + 22, ty + 18, tx + 38, ty - 6); ctx.stroke();
            }
          } else {
            const inside = ctx.createLinearGradient(0, 52, 0, h);
            inside.addColorStop(0, '#f6e4c2'); inside.addColorStop(1, '#9c8466');
            ctx.fillStyle = inside; ctx.fillRect(x0 + 5, 52, 90, h - 56);
            glows.push([x0 + 5, 52, 90, h - 56]);
            for (let s = 0; s < 3; s++) {
              const y = 88 + s * 28;
              for (let k = 0; k < 9; k++) {
                const tall = 10 + r(s * 9 + k + 7) * 8;
                ctx.fillStyle = goods[Math.floor(r(s * 9 + k + 40) * goods.length)]; ctx.fillRect(x0 + 8 + k * 10, y + 18 - tall, 8, tall);
              }
              ctx.fillStyle = 'rgba(60,50,40,.55)'; ctx.fillRect(x0 + 5, y + 18, 90, 3);
            }
            // The glass: a cool sheen, one bright streak of sky and the door's frame.
            ctx.fillStyle = 'rgba(110,140,155,.3)'; ctx.fillRect(x0 + 5, 52, 90, h - 56);
            ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath();
            ctx.moveTo(x0 + 20, 52); ctx.lineTo(x0 + 44, 52); ctx.lineTo(x0 + 18, h - 4); ctx.lineTo(x0 + 5, h - 4); ctx.lineTo(x0 + 5, 90); ctx.fill();
            ctx.fillStyle = '#a3a8aa'; ctx.fillRect(x0 + 60, 52, 4, h - 56); ctx.fillRect(x0 + 5, 76, 90, 3);
          }
          if (r(2) > 0.45) {
            // A plain canvas awning, its scalloped hem in shadow.
            ctx.fillStyle = ['#3f8f84', '#5d6a70', '#2f6e66'][Math.floor(r(4) * 3)]; ctx.fillRect(x0 - 2, 28, 104, 20);
            ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(x0 + 4 + k * 13, 48, 6, 0, Math.PI); ctx.fill(); }
          } else { ctx.fillStyle = trim; ctx.fillRect(x0, 34, 100, 12); }
        }
      } else if (kind === 'plain') {
        // Plain render, like a station hall's wall over its ground floor: only a band at its foot.
        paint(wall, 'wall');
        ctx.fillStyle = trim; ctx.fillRect(0, h - 10, w, 8);
        ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, h - 2, w, 2);
      } else if (kind === 'vila' || kind === 'socol') {
        // A Vallès town house (Cardedeu): smooth render, moulded frames and louvred shutters in the
        // house's own colour. `vila`, the upper floors, is three bays by two storeys with the first
        // floor at the bottom (a two-storey house shows only that row): French windows onto small
        // iron balconies, smaller windows above. `socol`, the ground floor (two bays): the render
        // over a grey granite plinth, a panelled door under a barred fanlight, and a window behind
        // iron bars or, in some houses, a garage's roller shutter.
        paint(wall, 'wall');
        const r = (i: number) => jitter(seed * 5.1 + i);
        const shutter = ['#5f7048', '#4c6650', '#6b4f3a', '#7d8a84', '#8a6a48'][Math.floor(r(1) * 5)];
        const louvres = (x0: number, y0: number, ww: number, hh: number) => {
          ctx.fillStyle = shutter; ctx.fillRect(x0, y0, ww, hh);
          ctx.fillStyle = 'rgba(0,0,0,.24)'; for (let y = y0 + 3; y < y0 + hh - 2; y += 4) ctx.fillRect(x0 + 2, y, ww - 4, 1.5);
          ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x0, y0, 2, hh);
        };
        if (kind === 'socol') {
          ctx.save(); ctx.beginPath(); ctx.rect(0, 150, w, h - 150); ctx.clip(); paint(base, 'base'); ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 150, w, 3);
          ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let x0 = 40; x0 < w; x0 += 64) ctx.fillRect(x0, 153, 1.5, h - 153);
          const door = ['#2f4a3a', '#5a3b26', '#5e2a24', '#3d4a55', '#6b4f3a'][Math.floor(r(2) * 5)];
          ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(30, 44, 74, h - 44);
          ctx.fillStyle = trim; ctx.fillRect(26, 38, 74, h - 38);
          ctx.fillStyle = glass; ctx.fillRect(35, 47, 56, 22);
          ctx.fillStyle = '#26292a'; for (let k = 0; k < 6; k++) ctx.fillRect(37 + k * 10, 47, 2, 22);
          ctx.fillStyle = door; ctx.fillRect(35, 71, 56, h - 71);
          ctx.fillStyle = 'rgba(255,255,255,.1)'; for (const px of [39, 65]) for (const py of [78, 118, 154]) ctx.fillRect(px, py, 22, 30);
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(62, 71, 2, h - 71);
          ctx.fillStyle = '#c9b48a'; ctx.fillRect(55, 126, 4, 8);
          if (r(3) > 0.76) {
            ctx.fillStyle = trim; ctx.fillRect(140, 50, 104, h - 50);
            ctx.fillStyle = '#8d918f'; ctx.fillRect(147, 57, 90, h - 57);
            ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 59; y < h; y += 5) ctx.fillRect(147, y, 90, 1.5);
          } else {
            ctx.fillStyle = trim; ctx.fillRect(159, 50, 66, 98);
            ctx.fillStyle = glass; ctx.fillRect(167, 58, 50, 82);
            louvres(167, 58, 50, 82 * (0.3 + r(4) * 0.5));
            ctx.fillStyle = '#26292a';
            for (let k = 0; k < 6; k++) ctx.fillRect(168 + k * 9.2, 54, 2.5, 90);
            ctx.fillRect(163, 82, 58, 2.5); ctx.fillRect(163, 118, 58, 2.5);
            ctx.fillStyle = '#c6beaf'; ctx.fillRect(155, 146, 74, 5);
          }
        } else for (let fy = 0; fy < atlasV; fy++) for (let bx = 0; bx < atlasU; bx++) {
          const x0 = bx * 128, y0 = fy * 192, i = 20 + fy * 7 + bx * 3, first = fy === atlasV - 1;
          // A string course over the storey below, and a moulded band at the top: under the roof it is
          // the white rim round the eaves of Nuria's block and the old houses.
          ctx.fillStyle = trim; ctx.fillRect(x0, y0 + 183, 128, 7);
          ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x0, y0 + 190, 128, 2);
          ctx.fillStyle = trim; ctx.fillRect(x0, y0, 128, 10);
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0, y0 + 10, 128, 3);
          const ww = first ? 50 : 44, top = y0 + (first ? 44 : 62), hh = first ? 124 : 78, wx = x0 + 64 - ww / 2;
          // The moulded frame and its lintel, a little proud of the wall.
          ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(wx - 6, top - 4, ww + 16, hh + 10);
          ctx.fillStyle = trim; ctx.fillRect(wx - 8, top - 8, ww + 16, hh + 10); ctx.fillRect(wx - 12, top - 14, ww + 24, 7);
          ctx.fillStyle = glass; ctx.fillRect(wx, top, ww, hh);
          ctx.fillStyle = 'rgba(190,220,235,.2)'; ctx.fillRect(wx + 3, top + 3, ww * 0.3, hh - 6);
          ctx.fillStyle = trim; ctx.fillRect(wx + ww / 2 - 1.5, top, 3, hh);
          // Shutters folded back on both sides, or shut over the window (one leaf sometimes half open).
          if (r(i) > 0.62) { louvres(wx, top, ww / 2 - 1, hh); louvres(wx + ww / 2 + 1, top, ww / 2 - 1, hh * (r(i + 1) > 0.5 ? 1 : 0.55)); }
          else { louvres(wx - 31, top - 2, 22, hh + 2); louvres(wx + ww + 9, top - 2, 22, hh + 2); }
          if (first && r(i + 2) > 0.3) {
            // A stone slab and a wrought-iron railing; geraniums on some.
            ctx.fillStyle = '#b9b2a4'; ctx.fillRect(x0 + 20, top + hh - 2, 88, 7);
            ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(x0 + 20, top + hh + 5, 88, 4);
            if (r(i + 3) > 0.6) for (let k = 0; k < 4; k++) {
              ctx.fillStyle = '#b8704f'; ctx.fillRect(x0 + 27 + k * 20, top + hh - 12, 9, 10);
              ctx.fillStyle = ['#4f7a3a', '#c23a3a', '#6d9a48', '#b8475a'][(k + i) % 4];
              ctx.beginPath(); ctx.arc(x0 + 31 + k * 20, top + hh - 17, 7, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#26292a'; ctx.fillRect(x0 + 22, top + hh - 42, 84, 3);
            for (let k = 0; k < 13; k++) ctx.fillRect(x0 + 23 + k * 6.6, top + hh - 40, 2, 38);
          } else { ctx.fillStyle = '#c6beaf'; ctx.fillRect(wx - 10, top + hh + 1, ww + 20, 5); }
        }
      } else if (kind === 'bars') {
        // A pintxos street's ground floors (Carrer de Blai): bar fronts open and lit from inside, the
        // counter with its trays of pintxos and the bottles behind it, and beside it a window with
        // stools, a roller shutter half up or the menu board of photos.
        paint(base, 'base');
        const frame = ['#6e2a24', '#2f4a35', '#262321', '#6b4528', '#7a5a2a'][seed % 5];
        const inside = (x0: number, y0: number, ww: number, hh: number) => {
          const light = ctx.createLinearGradient(0, y0, 0, y0 + hh);
          light.addColorStop(0, '#f8d9a0'); light.addColorStop(1, '#b97a45');
          ctx.fillStyle = light; ctx.fillRect(x0, y0, ww, hh);
        };
        ctx.fillStyle = frame; ctx.fillRect(4, 22, w - 8, 22);
        // The bar: its front open, bottles on the back shelves, the counter and its pintxos.
        ctx.fillStyle = frame; ctx.fillRect(8, 44, 112, h - 44);
        inside(16, 50, 96, h - 50);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 13; k++) {
          ctx.fillStyle = ['#3d5a2a', '#6b2a1f', '#d8c48a', '#2a3a44', '#8a5a2a'][(k + r * 3 + seed) % 5];
          ctx.fillRect(20 + k * 7, 66 + r * 22, 4, 14);
        }
        ctx.fillStyle = 'rgba(70,40,20,.45)'; ctx.fillRect(16, 81, 96, 3); ctx.fillRect(16, 103, 96, 3);
        ctx.fillStyle = '#4a2f1f'; ctx.fillRect(16, 124, 96, h - 124);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(16, 114, 96, 10);
        for (let k = 0; k < 12; k++) {
          ctx.fillStyle = '#e2c38c'; ctx.fillRect(19 + k * 7.6, 117, 6, 6);
          ctx.fillStyle = ['#b8402c', '#5d7a3a', '#6b3b22', '#f0eadb', '#d98a2c'][(k * 3 + seed) % 5]; ctx.fillRect(19 + k * 7.6, 115, 6, 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(16, 124, 96, 3);
        // The other bay, by bar: a window with stools at a ledge, a shutter half up, or the menu board.
        const other = seed % 3;
        ctx.fillStyle = frame; ctx.fillRect(136, 44, 112, h - 44);
        if (other === 0) {
          inside(144, 50, 96, h - 74);
          ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(148, 54, 18, h - 82);
          ctx.fillStyle = '#4a2f1f'; ctx.fillRect(144, 120, 96, 6);
          for (let k = 0; k < 3; k++) { ctx.fillStyle = '#2b2422'; ctx.fillRect(156 + k * 30, 126, 12, 4); ctx.fillRect(160 + k * 30, 130, 4, h - 154); }
          ctx.fillStyle = frame; ctx.fillRect(144, h - 24, 96, 24);
        } else if (other === 1) {
          inside(144, 50, 96, h - 50);
          ctx.fillStyle = '#8f9396'; ctx.fillRect(144, 50, 96, 52);
          ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 53; y < 102; y += 5) ctx.fillRect(144, y, 96, 1.5);
          ctx.strokeStyle = ['#d23a5a', '#2f7fc4', '#f0c234', '#ffffff'][seed % 4]; ctx.lineWidth = 4; ctx.beginPath();
          ctx.moveTo(156, 86); ctx.bezierCurveTo(170, 62, 186, 98, 206, 72); ctx.stroke();
          ctx.fillStyle = '#4a2f1f'; ctx.fillRect(144, 140, 96, h - 140);
        } else {
          inside(144, 50, 42, h - 50);
          ctx.fillStyle = '#f2efe6'; ctx.fillRect(194, 58, 46, 82);
          for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
            ctx.fillStyle = ['#c98a3a', '#b8402c', '#e8d29a', '#6b8a3a', '#a85a2a'][(r * 3 + k + seed) % 5];
            ctx.fillRect(198 + k * 14, 62 + r * 15, 11, 11);
          }
          ctx.fillStyle = frame; ctx.fillRect(194, 140, 46, h - 140);
        }
        // A lamp on a bracket over each bay.
        for (const x0 of [64, 192]) { ctx.fillStyle = '#26292b'; ctx.fillRect(x0 - 2, 44, 4, 8); ctx.fillStyle = '#ffe2a8'; ctx.fillRect(x0 - 6, 50, 12, 6); }
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
          ctx.fillStyle = 'rgba(255,226,170,.62)'; ctx.fillRect(6 + k * 42, 70, 36, h - 74); glows.push([6 + k * 42, 70, 36, h - 74]);
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
    if (glows.length) {
      // What glows is the painted pane itself (the lit shop and its shelves, a flat's lamp), not a
      // flat patch of colour, so the shop fronts keep their goods at dusk.
      made.emissiveMap = kit.texture(canvas(w, h, ctx => {
        ctx.setTransform(1, 0, 0, -1, 0, h); ctx.fillStyle = '#ffffff';
        for (const [gx, gy, gw, gh] of glows) ctx.fillRect(gx, gy, gw, gh);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(c, 0, 0);
        ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
      }));
      made.emissive.set(1, 0.84, 0.6); made.emissiveIntensity = 0; made.update(); evening.push(made);
    }
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

  /**
   * Walls a building shares with a neighbour (footprint edge → the neighbour's height): where it
   * rises over the neighbour that wall is a bare party wall (mitgera), not a facade with windows.
   */
  function partyWalls(buildings: GeoBuilding[]) {
    const out = new Map<string, Map<number, number>>();
    const boxes = buildings.map(b => {
      const xs = b.poly.map(p => p[0]), zs = b.poly.map(p => p[1]);
      return [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...zs) - 1, Math.max(...zs) + 1];
    });
    buildings.forEach((a, ai) => {
      const shared = new Map<number, number>();
      for (let i = 0; i < a.poly.length; i++) {
        const p = a.poly[i], q = a.poly[(i + 1) % a.poly.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len < 1) continue;
        const ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len;
        const off = (v: GeoPoint) => Math.abs((v[0] - p[0]) * uz - (v[1] - p[1]) * ux);
        let covered = 0, height = 0;
        buildings.forEach((b, bi) => {
          const [x0, x1, z0, z1] = boxes[bi];
          if (bi === ai || Math.max(p[0], q[0]) < x0 || Math.min(p[0], q[0]) > x1 || Math.max(p[1], q[1]) < z0 || Math.min(p[1], q[1]) > z1) return;
          for (let j = 0; j < b.poly.length; j++) {
            // A wall of the neighbour on this wall's line, overlapping it.
            const r = b.poly[j], s = b.poly[(j + 1) % b.poly.length];
            if (off(r) > 0.35 || off(s) > 0.35) continue;
            const t0 = (r[0] - p[0]) * ux + (r[1] - p[1]) * uz, t1 = (s[0] - p[0]) * ux + (s[1] - p[1]) * uz;
            const overlap = Math.min(len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
            if (overlap > 0.5) { covered += overlap; height = Math.max(height, b.height); }
          }
        });
        if (covered > len * 0.5) shared.set(i, height);
      }
      if (shared.size) out.set(a.id, shared);
    });
    return out;
  }
  const party = partyWalls(scene.buildings);
  const palettes = new Map<string, pc.StandardMaterial>();
  /** Swatches of a building's relief, one material for all of it: UV `swatch(i)` picks a colour. */
  const SWATCHES = 8;
  function reliefMaterial(b: GeoBuilding) {
    const colours = [b.walls, b.relief?.balcony ?? b.trim ?? '#ece7dd', '#cfcbc2', '#e8e8e3', '#a9aba6', '#8e9497', '#3c4044', '#dcdad4'];
    const key = colours.join('|');
    let m = palettes.get(key);
    if (!m) {
      // Swatches of 16 px, so mipmaps never blend two colours.
      m = cutaway(textured(`Relieve ${b.walls}`, canvas(16 * SWATCHES, 16, ctx => colours.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * 16, 0, 16, 16); })), 0.15));
      palettes.set(key, m);
    }
    return m;
  }
  const RENDER = 0, BALCONY = 1, CONCRETE = 2, TANK = 3, FIBRE = 4, STEEL = 5, DARK = 6, MACHINE = 7;
  const swatch = (i: number) => [(i + 0.5) / SWATCHES, 0.5];
  /** A box on the grid (corners `ring`, counter-clockwise or not, from `y0` to `y1` cells) in one colour, without its hidden bottom. */
  function block(builder: MeshBuilder, ring: GeoPoint[], y0: number, y1: number, colour: number) {
    const t = swatch(colour), cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], mx = (a[0] + c[0]) / 2 - cx, mz = (a[1] + c[1]) / 2 - cz;
      builder.quad(P(a, y0), P(c, y0), P(c, y1), P(a, y1), [mx, 0, mz], t, t, t, t);
    }
    for (let i = 1; i + 1 < ring.length; i++) builder.tri(P(ring[0], y1), P(ring[i], y1), P(ring[i + 1], y1), [0, 1, 0], t, t, t);
  }
  /** A rectangle centred on (cx, cz), `w` along `e1` and `d` across it. */
  const rect = (cx: number, cz: number, e1: number[], w: number, d: number): GeoPoint[] => {
    const e2 = [-e1[1], e1[0]];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + e1[0] * w / 2 * s + e2[0] * d / 2 * t, cz + e1[1] * w / 2 * s + e2[1] * d / 2 * t]);
  };
  const disc = (cx: number, cz: number, r: number, sides = 8): GeoPoint[] => Array.from({ length: sides }, (_, k) => [cx + Math.cos(k / sides * Math.PI * 2) * r, cz + Math.sin(k / sides * Math.PI * 2) * r]);
  /**
   * The relief that gives a block its shadow lines: balcony slabs with solid fronts every storey on
   * the long walls the camera sees (in continuous bands or by pairs of bays, chosen per wall), a
   * cornice under the parapet, and on a flat roof what Barcelona's terraces carry: stair and lift
   * housings, water tanks, aerials, satellite dishes and air conditioners, seeded by the building.
   */
  function relief(b: GeoBuilding, groundTop: number, shared?: Map<number, number>) {
    const r = b.relief, out = new MeshBuilder();
    if (!r) return out;
    const poly = b.poly, H = b.height, storey = scene.storey, sign = signedArea(poly) > 0 ? 1 : -1;
    const seed = [...b.id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 9973;
    const rand = (i: number) => jitter(seed + i * 1.37);
    // Map outlines often break a straight front into several edges: walls run along all of them.
    const edges = poly.map((a, i) => {
      const c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1e-6;
      return { i, a, c, len, u: [(c[0] - a[0]) / len, (c[1] - a[1]) / len] };
    }).filter(e => e.len > 1e-3);
    const straight = (e: typeof edges[number], f: typeof edges[number]) => e.u[0] * f.u[0] + e.u[1] * f.u[1] > 0.985 && !shared?.has(e.i) && !shared?.has(f.i);
    const first = Math.max(0, edges.findIndex((e, k) => !straight(edges[(k + edges.length - 1) % edges.length], e)));
    const fronts: { i: number; a: GeoPoint; c: GeoPoint; party: boolean }[] = [];
    for (let k = 0; k < edges.length;) {
      const e = edges[(first + k) % edges.length];
      let last = e;
      for (k++; k < edges.length && straight(last, edges[(first + k) % edges.length]); k++) last = edges[(first + k) % edges.length];
      fronts.push({ i: e.i, a: e.a, c: last.c, party: !!shared?.has(e.i) });
    }
    for (const { i, a, c, party } of fronts) {
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-3 || party) continue;
      const u = [(c[0] - a[0]) / len, (c[1] - a[1]) / len], n = [u[1] * sign, -u[0] * sign];
      const at = (t: number, o: number): GeoPoint => [a[0] + u[0] * t + n[0] * o, a[1] + u[1] * t + n[1] * o];
      if (r.cornice && H > groundTop + 0.5) block(out, [at(-0.15, 0), at(len + 0.15, 0), at(len + 0.15, 0.22), at(-0.15, 0.22)], H - 0.14, H + 0.02, CONCRETE);
      const depth = (r.balcony_m ?? 0) / cellM, seen = n[1] > 0.35 || n[0] > 0.6, pick = rand(i + 11);
      if (!depth || !seen || len < BAY * 2 || pick > 0.85) continue;
      // Continuous bands, or a balcony over every other pair of bays.
      const runs: [number, number][] = [];
      if (pick < 0.5) runs.push([0.35, len - 0.35]);
      else for (let t = BAY * 0.25; t + BAY * 2 <= len - 0.2; t += BAY * 3) runs.push([t, t + BAY * 2]);
      for (let k = 0; groundTop + k * storey + 0.7 < H; k++) {
        const y = groundTop + k * storey;
        for (const [t0, t1] of runs) {
          block(out, [at(t0, 0), at(t1, 0), at(t1, depth), at(t0, depth)], y - 0.06, y + 0.06, CONCRETE);
          block(out, [at(t0, depth - 0.05), at(t1, depth - 0.05), at(t1, depth), at(t0, depth)], y + 0.06, y + 0.62, BALCONY);
          for (const t of [t0, t1 - 0.04]) block(out, [at(t, 0), at(t + 0.04, 0), at(t + 0.04, depth), at(t, depth)], y + 0.06, y + 0.62, BALCONY);
        }
      }
    }
    if (!r.rooftop || b.roof !== 'flat') return out;
    // The terrace: stand things inside the footprint, clear of its edges and of each other.
    const roofY = H + 0.25, area = Math.abs(signedArea(poly)), box = b.box, e1 = [Math.cos(box.angle), Math.sin(box.angle)];
    const placed: [number, number, number][] = [];
    const edgeDistance = (px: number, pz: number) => Math.min(...poly.map((p, i) => {
      const q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((px - p[0]) * dx + (pz - p[1]) * dz) / l2));
      return Math.hypot(p[0] + dx * t - px, p[1] + dz * t - pz);
    }));
    let k = 0;
    const spot = (radius: number): [number, number] | undefined => {
      for (let tries = 0; tries < 24; tries++, k++) {
        const px = box.cx + e1[0] * (rand(k * 2 + 50) - 0.5) * box.w - e1[1] * (rand(k * 2 + 51) - 0.5) * box.d;
        const pz = box.cz + e1[1] * (rand(k * 2 + 50) - 0.5) * box.w + e1[0] * (rand(k * 2 + 51) - 0.5) * box.d;
        if (!inside(px, pz, poly) || edgeDistance(px, pz) < radius + 0.5 || placed.some(([qx, qz, qr]) => Math.hypot(px - qx, pz - qz) < radius + qr + 0.3)) continue;
        placed.push([px, pz, radius]); return [px, pz];
      }
    };
    // Low buildings (shops in a courtyard) carry only their air conditioners.
    const count = (per: number, most: number) => b.levels < 4 ? 0 : Math.min(most, 1 + Math.floor(area / per));
    for (let n = count(260, 3); n > 0; n--) {
      // A stair or lift housing in the block's render, with its slab roof.
      const at = spot(1.6); if (!at) break;
      block(out, rect(at[0], at[1], e1, 2.4, 1.7), roofY, roofY + 1.8, RENDER);
      block(out, rect(at[0], at[1], e1, 2.6, 1.9), roofY + 1.8, roofY + 1.9, CONCRETE);
      // Its door, on the side towards the camera.
      const side = e1[0] > 0 ? 1 : -1;
      block(out, rect(at[0] - e1[1] * 0.87 * side, at[1] + e1[0] * 0.87 * side, e1, 0.7, 0.05), roofY, roofY + 1.35, DARK);
    }
    for (let n = count(110, 6); n > 0; n--) {
      const at = spot(0.4); if (!at) break;
      const old = rand(n + 70) > 0.5;
      block(out, disc(at[0], at[1], 0.36), roofY, roofY + (old ? 0.8 : 1), old ? FIBRE : TANK);
    }
    for (let n = Math.min(9, 1 + Math.floor(area / 80)); n > 0; n--) {
      const at = spot(0.35); if (!at) break;
      block(out, rect(at[0], at[1], e1, 0.55, 0.3), roofY, roofY + 0.4, MACHINE);
    }
    for (let n = count(150, 5); n > 0; n--) {
      // An aerial: a mast with two crossbars.
      const at = spot(0.3); if (!at) break;
      const tall = 1.6 + rand(n + 90) * 0.9;
      block(out, rect(at[0], at[1], e1, 0.05, 0.05), roofY, roofY + tall, STEEL);
      for (const [dy, w] of [[0, 0.7], [-0.3, 0.5]]) block(out, rect(at[0], at[1], [-e1[1], e1[0]], w, 0.03), roofY + tall + dy - 0.03, roofY + tall + dy, STEEL);
    }
    for (let n = b.levels < 4 ? 0 : Math.floor(rand(99) * 3); n > 0; n--) {
      // A satellite dish on a short post, tilted up to the south.
      const at = spot(0.4); if (!at) break;
      block(out, rect(at[0], at[1], e1, 0.06, 0.06), roofY, roofY + 0.5, STEEL);
      const rim = disc(at[0], at[1] + 0.05, 0.33, 8);
      for (let j = 1; j + 1 < rim.length; j++) {
        const lift = (p: GeoPoint) => roofY + 0.5 - (p[1] - at[1] - 0.05) * 1.3;
        out.tri(P(rim[0], lift(rim[0])), P(rim[j], lift(rim[j])), P(rim[j + 1], lift(rim[j + 1])), [0, 0.6, 0.8], swatch(MACHINE), swatch(MACHINE), swatch(MACHINE));
      }
    }
    return out;
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
    const shared = b.relief?.party ? party.get(b.id) : undefined;
    const walls = new MeshBuilder(), base = new MeshBuilder(), bare = new MeshBuilder();
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 1e-3) continue;
      // Outward normal in grid space, turned into scene space (same axes).
      const sign = ccw ? 1 : -1;
      const n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
      const bays = Math.max(1, Math.round(len / BAY));
      // Wide ground atlases start at a different bay on every wall, like the facades above.
      const groundBays = GROUND_BAYS[b.ground] ?? 2, g0 = groundBays > 2 ? Math.floor(jitter(i * 3 + b.poly.length * 7) * groundBays) / groundBays : 0;
      base.quad(P(a, 0), P(c, 0), P(c, groundTop), P(a, groundTop), n, [g0, 0], [g0 + bays / groundBays, 0], [g0 + bays / groundBays, 1], [g0, 1]);
      if (H > groundTop + 0.05) {
        const floors = (H - groundTop) / storey;
        if (shared?.has(i)) { bare.quad(P(a, groundTop), P(c, groundTop), P(c, H), P(a, H), n, [0, 0], [bays, 0], [bays, floors], [0, floors]); continue; }
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
    // Flat roofs and outlines a pitched roof cannot cover get a parapet round the real outline, which
    // hides the edge of the roof; painted like the walls, it joins their mesh (one draw call fewer).
    const outline = !boxy(b) || b.roof === 'flat', parapet = photo(b.facade) ? new MeshBuilder() : walls;
    if (outline) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-3) continue;
      const sign = ccw ? 1 : -1, n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
      parapet.quad(P(a, H), P(c, H), P(c, H + 0.45), P(a, H + 0.45), n, [0, 0.9], [len / BAY, 0.9], [len / BAY, 1], [0, 1]);
    }
    add('Planta baja', base, lower, pivot, false);
    add('Fachada', walls, upper(b.facade), pivot, false);
    if (parapet !== walls) add('Peto', parapet, facade('flats', b.walls, trim, baseColour), pivot, false);
    if (b.relief?.party) add('Medianera', bare, facade('party', b.relief.party, trim, baseColour, { wall: grain.party }), pivot, false);
    add('Relieve', relief(b, groundTop, shared), reliefMaterial(b), pivot, false);
    // A flat ceiling under the eaves closes the top of a footprint a pitched roof does not cover
    // (a roof on the real outline covers it all).
    if (!outline) {
      const lid = new MeshBuilder();
      for (const [i, j, k] of triangulate(poly)) lid.tri(P(poly[i], H), P(poly[j], H), P(poly[k], H), [0, 1, 0]);
      add('Forjado', lid, cutaway(mat('Forjado', b.walls)), pivot, false, false);
    }
    add('Tejado', roof(b, H), b.roof === 'flat' ? terraceMaterial(b.roofColor ?? '#b0a597', grain.roof) : roofMaterial(b.roofColor ?? '#b4643f', grain.roof), pivot, false);
    // A Vallès house's gable is plain render; elsewhere it gets a window with shutters.
    if (b.roof !== 'flat') add('Hastial', gableEnds(b, H), facade(b.facade === 'vila' ? 'plain' : 'rendered', b.walls, trim, baseColour, grain), pivot, false);
    if (b.terrat) terrat(b, H, pivot);
  }
  /**
   * What stands on a lived-in terrat, read from above: each house of the row has its stair head
   * (a small rendered box with a door), and there are water tanks of grey fibre cement, aerials and
   * washing lines between them, placed along the roof's long side from a hash of the building.
   */
  function terrat(b: GeoBuilding, H: number, pivot: pc.Entity) {
    const { cx, cz, w, d, angle } = b.box, long = w >= d, len = Math.max(w, d), wide = Math.min(w, d);
    const ua = long ? angle : angle + Math.PI / 2, e1 = [Math.cos(ua), Math.sin(ua)], e2 = [-Math.sin(ua), Math.cos(ua)];
    const seed = [...b.id].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) % 9973, r = (i: number) => jitter(seed + i * 17.3);
    const top = H + 0.25, m = 1 / cellM, yaw = -ua * 180 / Math.PI;
    // A point on the roof `u` cells along its long side and `v` across, `y` cells up.
    const at = (u: number, v: number, y: number) => [x(cx + e1[0] * u + e2[0] * v), y, z(cz + e1[1] * u + e2[1] * v)];
    const heads = new MeshBuilder(), tanks = new MeshBuilder(), irons = new MeshBuilder(), washing = new MeshBuilder();
    const house = 8.5 * m, count = Math.max(1, Math.floor(len / house));
    for (let k = 0; k < count; k++) {
      const u = -len / 2 + (k + 0.5) * len / count, side = r(k) > 0.5 ? 1 : -1;
      // The stair head against one side of the roof, its door facing across it (not off an L's corner).
      const hv = side * (wide / 2 - 1.4 * m);
      if (!inside(cx + e1[0] * u + e2[0] * hv, cz + e1[1] * u + e2[1] * hv, b.poly)) continue;
      heads.box(at(u, hv, top + 1.25 * m), [2.4 * m, 2.5 * m, 2.6 * m], [0, yaw, 0]);
      // One or two water tanks beside it, and sometimes an aerial and a line of washing.
      for (let t = 0; t < 1 + Math.round(r(k + 40)); t++) tanks.box(at(u + (1.9 + t * 1.3) * m * (r(k + 3) > 0.5 ? 1 : -1), hv, top + 0.6 * m), [1.1 * m, 1.2 * m, 1.1 * m], [0, yaw, 0]);
      if (r(k + 60) > 0.45) {
        const au = u - 2.4 * m * side, av = hv - 0.4 * side * m;
        irons.box(at(au, av, top + 1.8 * m), [0.06 * m, 3.6 * m, 0.06 * m]);
        for (const [y, l] of [[3.2, 1.2], [2.8, 0.9]]) irons.box(at(au, av, top + y * m), [l * m, 0.04 * m, 0.04 * m], [0, yaw + 90, 0]);
      }
      if (r(k + 80) > 0.4) {
        // A line strung across the roof with sheets and towels on it, at head height.
        const lu = u + (r(k + 81) - 0.5) * 3 * m;
        irons.box(at(lu, 0, top + 1.6 * m), [0.03 * m, 0.03 * m, wide * 0.7], [0, yaw, 0]);
        for (let c = 0; c < 4; c++) washing.box(at(lu, (c - 1.5) * wide * 0.16, top + 1.25 * m), [0.06 * m, 0.7 * m, 0.55 * m + r(k + c) * 0.4 * m], [0, yaw, 0]);
      }
    }
    add('Casetas del terrado', heads, cutaway(mat('Caseta del terrado', b.walls, 0.1)), pivot, false);
    add('Depósitos', tanks, cutaway(mat('Depósito de fibrocemento', '#a9a7a0', 0.15)), pivot, false);
    add('Antenas', irons, cutaway(mat('Antena', '#3a3d40', 0.4)), pivot, false, false);
    add('Ropa en el terrado', washing, cutaway(mat('Sábanas tendidas', '#f1efe8', 0.1)), pivot, false, false);
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
    confectionery: ['#6b2f3a', '#f6e3c2'],
  };
  const brands: Record<string, [string, string]> = { Granier: ['#ffffff', '#c2272d'], '365': ['#111111', '#ffffff'], 'General Óptica': ['#ffffff', '#00539f'], 'Vision-Prix': ['#e5007d', '#ffffff'] };
  for (const shop of scene.shops ?? []) {
    const parent = pivots.get(shop.building);
    const b = scene.buildings.find(o => o.id === shop.building);
    if (!parent || !b) continue;
    if (shop.kind === 'house') { plaque(shop, parent, b); continue; }
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
  /**
   * A house's name on a glazed tile beside its door (`kind: "house"` in a zone's `shops`), as every old
   * house in a Basque village wears it: blue letters on white, in a blue frame.
   */
  function plaque(shop: GeoShop, parent: pc.Entity, b: GeoBuilding) {
    const name = (shop.name ?? '').toUpperCase();
    const tile = canvas(256, 64, ctx => {
      ctx.fillStyle = '#f2eee4'; ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#2b4c8c'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 246, 54);
      ctx.lineWidth = 1.5; ctx.strokeRect(11, 11, 234, 42);
      ctx.fillStyle = '#23417e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = 30; ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
      while (ctx.measureText(name).width > 220 && size > 12) { size -= 2; ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`; }
      ctx.fillText(name, 128, 34);
    });
    const groundTop = Math.min(b.height, scene.storey * 1.15);
    panel(`Azulejo ${name}`, parent, cutaway(lit(`Azulejo ${name}`, tile, 0.06)), [x(shop.x + shop.nx * 0.04), groundTop - 0.62, z(shop.z + shop.nz * 0.04)],
      [shop.nz, 0, -shop.nx], [0, 1, 0], 1.25, 0.31, [shop.nx, 0, shop.nz]);
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
  /** `owner`: the building a landmark dresses (`params.building`), whose cut its tall pieces then share. */
  function landmarkKit(pivot: pc.Entity, owner?: pc.Entity): LandmarkKit {
    const kitMat = (name: string, hex: string, gloss = 0.2, glow = 0) => {
      const key = `${name}|${hex}|${gloss}|${glow}`;
      let m = shared.get(key);
      if (!m) { m = mat(name, hex, gloss, glow); shared.set(key, m); }
      return m;
    };
    return {
      app, root: pivot, cell: cellM, water: -sunk * cellM, scene, mat: kitMat,
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
      add(name, builder, material, { cut = false, building, shadows = true, parent = pivot } = {}) {
        if (builder.empty) return undefined;
        const mesh = builder.mesh(device); meshes.push(mesh);
        const host = building === undefined ? undefined : buildingCuts.get(pivots.get(building)!), cuts = cut || !!host;
        const e = new pc.Entity(name), instance = new pc.MeshInstance(mesh, cuts ? cutaway(material) : material);
        e.addComponent('render', { meshInstances: [instance], castShadows: shadows, receiveShadows: true, ...(cuts ? {} : { batchGroupId: kit.batch }) });
        parent.addChild(e);
        // A piece on a building's walls or roof opens and closes with that building's cut, so it never
        // floats over the hole nor is eaten while the roof under it stays whole.
        if (host) { host.instances.push(instance); instance.setParameter('geoCutRadius', host.radius); return e; }
        if (cut) {
          // Tall pieces open the same cut as the buildings (the very one of the building they dress): their triangles in world space.
          let group = buildingCuts.get(owner ?? pivot);
          if (!group) { group = { triangles: [], instances: [], radius: 0 }; buildingCuts.set(owner ?? pivot, group); }
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
    if (builder) { builder.build(landmarkKit(pivot, pivots.get(String(lm.params.building))), lm); continue; }
    // A kind without its module yet (data merged before code): a plain block on its footprint.
    console.warn(`Monumento sin constructor: ${lm.kind} (src/landmarks/${lm.kind}.ts)`);
    if (lm.solid) landmarkKit(pivot).part('Monumento pendiente', 'box', mat('Monumento pendiente', '#9a948a'), [0, 0.5, 0], [lm.w * cellM, 1, lm.d * cellM]);
  }

  // ------------------------------------------------------------ surroundings
  // A hilltop falls away on every side to whatever its landmarks lay below (the Búnkers' city);
  // elsewhere the city or wooded hills close the far sides.
  if (scene.drop) flank(scene.drop);
  else if (look.edge === 'city') {
    // The city goes on past the map's far sides: rows of plain blocks with their storeys of windows,
    // in the place's render and brick dulled by distance, on a skirt of street; lower than the real
    // ones, so they frame the place without stealing it.
    const skirt = new MeshBuilder(), tops = new MeshBuilder();
    const tints = ['#b9b2a3', '#ad9c86', '#a9a7a0'], far = tints.map(() => new MeshBuilder());
    for (const ring of [[[-70, -70], [W + 30, -70], [W + 30, -0.5], [-70, -0.5]], [[-70, -0.5], [-0.5, -0.5], [-0.5, D + 30], [-70, D + 30]]] as GeoPoint[][]) {
      skirt.quad(P(ring[0], -0.02), P(ring[1], -0.02), P(ring[2], -0.02), P(ring[3], -0.02), [0, 1, 0], [0, 0], [0, 0], [0, 0], [0, 0]);
    }
    let k = 0;
    const blocks = (from: number, to: number, place: (along: number, row: number, w: number, d: number) => [number, number]) => {
      for (let row = 0; row < 3; row++) for (let along = from; along < to; k++) {
        const w = 9 + jitter(k * 3 + 1) * 10, d = 8 + jitter(k * 3 + 2) * 6, h = Math.round((3 + jitter(k * 3 + 3) * 2.5) * (1 + row * 0.15)) * scene.storey;
        const [cx, cz] = place(along + w / 2, row, w, d);
        const ring: GeoPoint[] = [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
        const walls = far[Math.floor(jitter(k * 3 + 5) * far.length)];
        ring.forEach((p, i) => {
          const q = ring[(i + 1) % 4], l = Math.hypot(q[0] - p[0], q[1] - p[1]) / BAY;
          walls.quad(P(p, 0), P(q, 0), P(q, h), P(p, h), [(p[0] + q[0]) / 2 - cx, 0, (p[1] + q[1]) / 2 - cz], [0, 0], [l, 0], [l, h / scene.storey], [0, h / scene.storey]);
        });
        tops.quad(P(ring[0], h), P(ring[1], h), P(ring[2], h), P(ring[3], h), [0, 1, 0], [0, 0], [0, 0], [0, 0], [0, 0]);
        along += w + 3 + jitter(k * 3 + 4) * 4;
      }
    };
    blocks(-40, W + 20, (along, row, _w, d) => [along, -4 - d / 2 - row * 17]);
    blocks(-5, D + 15, (along, row, w) => [-4 - w / 2 - row * 17, along]);
    add('Calles lejanas', skirt, mat('Calles lejanas', '#adaca5', 0.02), root, true, false);
    tints.forEach((tint, i) => add('Ciudad lejana', far[i], textured(`Ciudad lejana ${tint}`, canvas(32, 48, ctx => {
      ctx.fillStyle = tint; ctx.fillRect(0, 0, 32, 48);
      ctx.fillStyle = '#7f8689'; ctx.fillRect(6, 10, 20, 22);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(4, 33, 24, 3);
    }), 0.05), root, true, false));
    add('Terrados lejanos', tops, mat('Terrados lejanos', '#a19e96', 0.05), root, true, false);
  } else if (look.hills !== false) {
    // Wooded hills close every side but the camera's, as the valley does around the town (unless a
    // landmark draws the place's own or the place has its own horizon, like Cardedeu's Montseny:
    // `look.hills: false`).
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

  // ------------------------------------------------------------ rain and dusk on the street
  // After rain the asphalt and the panot darken and shine, and puddles lie along the kerbs until
  // they dry; at dusk the open shops spill warm light on the sidewalk and the lamps a cold one.
  // Light pools and puddles are flat decals, never real lights.
  const wetting = [asphalt, groundMat].map(m => ({ m, dry: new pc.Color(), spec: new pc.Color(), gloss: m.gloss, map: undefined as pc.Texture | null | undefined }));
  let wet = 0, rain = 0, dusk = 0, shownWet = 0, shownDusk = 0, streetSet = false;
  const puddles = new MeshBuilder();
  kerbs.forEach((k, i) => {
    const len = Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1]), u = [(k.b[0] - k.a[0]) / len, (k.b[1] - k.a[1]) / len];
    for (let t = 3 + jitter(i) * 8; t < len - 1; t += 9 + jitter(i * 7 + t) * 14) {
      // A long, ragged puddle in the gutter, on the street side of the kerb.
      const long = 0.7 + jitter(i + t) * 1.1, across = 0.25 + jitter(i * 3 + t) * 0.25;
      const c: GeoPoint = [k.a[0] + u[0] * t - k.out[0] * (across + 0.05), k.a[1] + u[1] * t - k.out[1] * (across + 0.05)];
      const rim = Array.from({ length: 10 }, (_, j): GeoPoint => {
        const a = j / 10 * Math.PI * 2, r = 0.75 + jitter(i * 11 + j + t) * 0.35;
        return [c[0] + (u[0] * Math.cos(a) * long + k.out[0] * Math.sin(a) * across) * r, c[1] + (u[1] * Math.cos(a) * long + k.out[1] * Math.sin(a) * across) * r];
      });
      for (let j = 1; j + 1 < rim.length; j++) puddles.tri(P(rim[0], LAYER.road + 0.008), P(rim[j], LAYER.road + 0.008), P(rim[j + 1], LAYER.road + 0.008), [0, 1, 0]);
    }
  });
  // Grey sky in still water: lighter than the wet asphalt round it.
  const puddle = mat('Charco', '#7e868b', 0.95);
  puddle.specular.set(0.25, 0.25, 0.25);
  puddle.blendType = pc.BLEND_NORMAL; puddle.depthWrite = false; puddle.opacity = 0; puddle.update();
  const puddleEntity = add('Charcos', puddles, puddle, root, true, false);
  if (puddleEntity) puddleEntity.enabled = false;
  /** A soft round pool of light painted once: bright in the middle, gone at the rim. */
  const pool = (colour: string) => {
    const m = textured(`Luz en el suelo ${colour}`, canvas(64, 64, ctx => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, colour); g.addColorStop(0.55, colour.replace(/[\d.]+\)$/, '0.5)')); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    }), 0);
    m.diffuse.set(0, 0, 0); m.emissiveMap = m.diffuseMap; m.emissive.set(1, 1, 1); m.emissiveIntensity = 0;
    m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.update();
    return m;
  };
  const decal = (builder: MeshBuilder, c: GeoPoint, along: number[], w: number, d: number) => {
    const across = [-along[1], along[0]], at = (s: number, t: number): V3 => P([c[0] + along[0] * s + across[0] * t, c[1] + along[1] * s + across[1] * t], LAYER.road + 0.012);
    builder.quad(at(-w / 2, -d / 2), at(w / 2, -d / 2), at(w / 2, d / 2), at(-w / 2, d / 2), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  };
  const shopLight = new MeshBuilder(), lampLight = new MeshBuilder();
  for (const shop of scene.shops ?? []) decal(shopLight, [shop.x + shop.nx * 0.5, shop.z + shop.nz * 0.5], [shop.nz, -shop.nx], 4, 3.4);
  for (const p of scene.props) {
    // Under the LED head, which hangs out over the street.
    const yaw = Number(p.yaw ?? 0) * Math.PI / 180;
    if (p.kind === 'lamp' && p.style === 'led') decal(lampLight, [p.x + Math.sin(yaw) * 0.5, p.z + Math.cos(yaw) * 0.5], [1, 0], 3.6, 3.6);
  }
  const warm = pool('rgba(255,196,120,1)'), cold = pool('rgba(236,240,244,1)');
  const pools = [add('Luz de las tiendas', shopLight, warm, root, true, false), add('Luz de las farolas', lampLight, cold, root, true, false)];
  pools.forEach(e => { if (e) e.enabled = false; });
  function weather(dt: number) {
    // Wet in a few seconds of rain, dry in about a minute after it stops.
    wet = rain > wet ? Math.min(rain, wet + dt / 5) : Math.max(rain, wet - dt / 60);
    if ((wet !== shownWet && (Math.abs(wet - shownWet) > 0.01 || wet === 0)) || (wet > 0 && wetting.some(w => w.m.diffuseMap !== w.map))) {
      shownWet = wet;
      for (const w of wetting) {
        // The dry look is whatever the material shows when wetness starts or its texture changes.
        if (w.m.diffuseMap !== w.map) { w.map = w.m.diffuseMap; w.dry.copy(w.m.diffuse); w.spec.copy(w.m.specular); w.gloss = w.m.gloss; }
        const k = 1 - 0.42 * wet;
        w.m.diffuse.set(w.dry.r * k, w.dry.g * k, w.dry.b * k); w.m.gloss = w.gloss + (0.5 - w.gloss) * wet;
        w.m.specular.lerp(w.spec, WET_SHEEN, wet); w.m.update();
      }
      puddle.opacity = Math.min(1, wet * 1.3) * 0.5; puddle.update();
      if (puddleEntity) puddleEntity.enabled = wet > 0.02;
    }
    if (Math.abs(dusk - shownDusk) > 0.01) {
      shownDusk = dusk;
      warm.emissiveIntensity = 0.6 * dusk; warm.update(); cold.emissiveIntensity = 0.2 * dusk; cold.update();
      pools.forEach(e => { if (e) e.enabled = dusk > 0.02; });
      for (const m of evening) { m.emissiveIntensity = 0.9 * dusk; m.update(); }
    }
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

  // Which cells the sunk river fills, so rain and drizzle fall into it instead of onto the street's level.
  const riverCells = new Uint8Array(W * D);
  if (sunk > 0) for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) riverCells[j * W + i] = scene.areas.water.some(poly => inside(i, j, poly)) ? 1 : 0;

  return {
    /** The height of the sunk river's surface at a point of the scene (world x, z), or nothing off the river. */
    waterAt(px: number, pz: number) {
      const i = Math.round(px - x(0)), j = Math.round(pz - z(0));
      return i >= 0 && j >= 0 && i < W && j < D && riverCells[j * W + i] ? LAYER.water - sunk : undefined;
    },
    /** Opens the glowing cut round `focus` while a building stands between it and the camera. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      weather(dt);
      if (animate) { time += dt; river.diffuseMapOffset.set(time * 0.05, time * 0.02); river.emissiveMapOffset.set(-time * 0.03, time * 0.04); river.update(); }
      sea?.update(dt, animate);
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
    /** How hard it rains now (0–1; the street stays wet a while after) and how far the evening has come (0–1). */
    setStreet(raining: number, evening: number) {
      // A scene built under rain starts wet.
      if (shownWet === 0 && wet === 0 && !streetSet) wet = raining;
      streetSet = true; rain = raining; dusk = evening;
    },
    destroy() { alive = false; cutRadius.setValue(0); meshes.forEach(m => m.destroy()); gpu.forEach(t => t.destroy()); sea?.destroy(); },
  };
}
