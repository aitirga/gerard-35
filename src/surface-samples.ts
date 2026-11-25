import * as pc from 'playcanvas';

/**
 * Points on a model's real surface (docs/graphics.md, "Fight particles on the GPU"): what the GPU
 * engine's `surface` bursts are born on, so a body comes apart from its own skin and clothes and not
 * from the boxes round its parts. Each mesh is sampled once, by area, on its triangles (with the bones
 * and weights of each point when it is skinned); every frame that needs them, the points are carried
 * to where the mesh is now, bent by its bones, in world space.
 */
export const SURFACE_SAMPLES = 1024;

interface MeshSamples {
  /** Local position and normal of each point (xyz), in a random order: any prefix is a fair sample. */
  position: Float32Array; normal: Float32Array;
  /** Four bones and their weights per point, when the mesh is skinned. */
  bones?: Float32Array; weights?: Float32Array;
  /** Its surface, m² in its own space. */
  area: number;
}
const cache = new WeakMap<pc.Mesh, MeshSamples | null>();

/** A small seeded random, so the same mesh is always sampled the same. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** `mesh`'s points, worked out the first time (undefined when its data cannot be read). */
export function meshSamples(mesh: pc.Mesh, count = SURFACE_SAMPLES): MeshSamples | undefined {
  if (cache.has(mesh)) return cache.get(mesh) ?? undefined;
  let result: MeshSamples | null = null;
  try {
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    const vertices = mesh.getPositions(positions);
    if (vertices > 0 && (mesh.primitive[0]?.type ?? pc.PRIMITIVE_TRIANGLES) === pc.PRIMITIVE_TRIANGLES) {
      mesh.getNormals(normals);
      if (!mesh.indexBuffer[0] || mesh.getIndices(indices) === 0) for (let i = 0; i < vertices; i++) indices.push(i);
      const blendIndices: number[] = [], blendWeights: number[] = [];
      const skinned = mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, blendIndices) > 0 && mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, blendWeights) > 0;
      const base = mesh.primitive[0]?.base ?? 0, end = Math.min(indices.length, base + (mesh.primitive[0]?.count ?? indices.length));
      // Each triangle's area, summed up as we go, to pick them by area.
      const triangles = Math.floor((end - base) / 3), sums = new Float64Array(triangles);
      const p = (v: number, k: number) => positions[v * 3 + k];
      let total = 0;
      for (let t = 0; t < triangles; t++) {
        const a = indices[base + t * 3], b = indices[base + t * 3 + 1], c = indices[base + t * 3 + 2];
        const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2);
        const vx = p(c, 0) - p(a, 0), vy = p(c, 1) - p(a, 1), vz = p(c, 2) - p(a, 2);
        total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        sums[t] = total;
      }
      if (total > 0) {
        const rnd = random(vertices * 2654435761 + triangles);
        const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
        const bones = skinned ? new Float32Array(count * 4) : undefined, weights = skinned ? new Float32Array(count * 4) : undefined;
        for (let i = 0; i < count; i++) {
          // The triangle by area (a binary search on the running sums), then a point on it.
          const want = rnd() * total;
          let lo = 0, hi = triangles - 1;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (sums[mid] < want) lo = mid + 1; else hi = mid; }
          const corners = [indices[base + lo * 3], indices[base + lo * 3 + 1], indices[base + lo * 3 + 2]];
          let r1 = rnd(), r2 = rnd();
          if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
          const bary = [1 - r1 - r2, r1, r2];
          let nx = 0, ny = 0, nz = 0;
          for (let k = 0; k < 3; k++) {
            const v = corners[k], w = bary[k];
            position[i * 3] += p(v, 0) * w; position[i * 3 + 1] += p(v, 1) * w; position[i * 3 + 2] += p(v, 2) * w;
            if (normals.length) { nx += normals[v * 3] * w; ny += normals[v * 3 + 1] * w; nz += normals[v * 3 + 2] * w; }
          }
          if (!normals.length) {
            // Flat: the triangle's own face.
            const [a, b, c] = corners;
            const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2), vx = p(c, 0) - p(a, 0), vy = p(c, 1) - p(a, 1), vz = p(c, 2) - p(a, 2);
            nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
          }
          const length = Math.hypot(nx, ny, nz) || 1;
          normal.set([nx / length, ny / length, nz / length], i * 3);
          if (bones && weights) {
            // The bones of its three corners, weighed by how near it is to each; the four heaviest kept.
            const mix = new Map<number, number>();
            for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
              const w = blendWeights[corners[k] * 4 + j] * bary[k];
              if (w > 0) mix.set(blendIndices[corners[k] * 4 + j], (mix.get(blendIndices[corners[k] * 4 + j]) ?? 0) + w);
            }
            const top = [...mix].sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((s, [, w]) => s + w, 0) || 1;
            top.forEach(([bone, w], j) => { bones[i * 4 + j] = bone; weights[i * 4 + j] = w / sum; });
          }
        }
        result = { position, normal, bones, weights, area: total };
      }
    }
  } catch { result = null; }
  cache.set(mesh, result);
  return result ?? undefined;
}

const skinning: pc.Mat4[] = [];
const point = new pc.Vec3(), normal = new pc.Vec3(), out = new pc.Vec3(), outNormal = new pc.Vec3(), scale = new pc.Vec3();

/**
 * Writes up to `limit` points on `model`'s visible surface as it stands now into `target`, from
 * `offset` (in vec4s): `rows` of `stride` vec4s each, the first row world positions (w 1), the second
 * normals and the third the colour of what each is on. Returns how many it wrote.
 */
export function writeSurface(model: pc.Entity, target: Float32Array, offset: number, stride: number, limit = SURFACE_SAMPLES) {
  const meshes: { m: pc.MeshInstance; s: MeshSamples; area: number }[] = [];
  for (const r of model.findComponents('render') as pc.RenderComponent[]) {
    if (!r.enabled || !r.entity.enabled) continue;
    for (const m of r.meshInstances) {
      if (!m.visible || !m.mesh) continue;
      const s = meshSamples(m.mesh);
      if (!s) continue;
      // Skinned, it measures in its bind pose, scaled with the model; otherwise its node scales it.
      (m.skinInstance ? model : m.node).getWorldTransform().getScale(scale);
      meshes.push({ m, s, area: s.area * Math.abs(scale.x * scale.y + scale.y * scale.z + scale.z * scale.x) / 3 });
    }
  }
  const total = meshes.reduce((sum, e) => sum + e.area, 0);
  if (!total) return 0;
  let written = 0;
  meshes.forEach((e, n) => {
    const share = n === meshes.length - 1 ? limit - written : Math.round(limit * e.area / total);
    const take = Math.min(share, SURFACE_SAMPLES, limit - written);
    if (take <= 0) return;
    const { m, s } = e, skin = m.skinInstance;
    let world: pc.Mat4 | undefined;
    if (skin && s.bones) {
      const inverse = skin.skin.inverseBindPose;
      skin.bones.forEach((bone, b) => { (skinning[b] ??= new pc.Mat4()).mul2(bone.getWorldTransform(), inverse[b]); });
    } else world = m.node.getWorldTransform();
    const diffuse = (m.material as pc.StandardMaterial | null)?.diffuse;
    const colour = diffuse ? [diffuse.r ** 2.2, diffuse.g ** 2.2, diffuse.b ** 2.2, 1] : [1, 1, 1, 1];
    for (let i = 0; i < take; i++) {
      point.set(s.position[i * 3], s.position[i * 3 + 1], s.position[i * 3 + 2]);
      normal.set(s.normal[i * 3], s.normal[i * 3 + 1], s.normal[i * 3 + 2]);
      if (world) { world.transformPoint(point, out); world.transformVector(normal, outNormal); }
      else {
        out.set(0, 0, 0); outNormal.set(0, 0, 0);
        for (let j = 0; j < 4; j++) {
          const w = s.weights![i * 4 + j];
          if (w <= 0) continue;
          const matrix = skinning[s.bones![i * 4 + j]];
          if (!matrix) continue;
          const d = matrix.data, x = point.x, y = point.y, z = point.z;
          out.x += (d[0] * x + d[4] * y + d[8] * z + d[12]) * w;
          out.y += (d[1] * x + d[5] * y + d[9] * z + d[13]) * w;
          out.z += (d[2] * x + d[6] * y + d[10] * z + d[14]) * w;
          outNormal.x += (d[0] * normal.x + d[4] * normal.y + d[8] * normal.z) * w;
          outNormal.y += (d[1] * normal.x + d[5] * normal.y + d[9] * normal.z) * w;
          outNormal.z += (d[2] * normal.x + d[6] * normal.y + d[10] * normal.z) * w;
        }
      }
      outNormal.normalize();
      const o = (offset + written) * 4;
      target.set([out.x, out.y, out.z, 1], o);
      target.set([outNormal.x, outNormal.y, outNormal.z, 0], o + stride * 4);
      target.set(colour, o + stride * 8);
      written++;
    }
  });
  return written;
}

/** One point of a model's surface that something stays on (a shard stuck in it): a mesh and which of its samples. */
export interface SurfaceAnchor { instance: pc.MeshInstance; index: number }
const anchorSkin: pc.Mat4[] = [];
const anchorPoint = new pc.Vec3(), anchorNormal = new pc.Vec3();

/** The meshes of `model` that can be sampled now, with their samples and their area in the world. */
function sampled(model: pc.Entity) {
  const meshes: { m: pc.MeshInstance; s: MeshSamples; area: number }[] = [];
  for (const r of model.findComponents('render') as pc.RenderComponent[]) {
    if (!r.enabled || !r.entity.enabled) continue;
    for (const m of r.meshInstances) {
      if (!m.visible || !m.mesh) continue;
      const s = meshSamples(m.mesh);
      if (!s) continue;
      (m.skinInstance ? model : m.node).getWorldTransform().getScale(scale);
      meshes.push({ m, s, area: s.area * Math.abs(scale.x * scale.y + scale.y * scale.z + scale.z * scale.x) / 3 });
    }
  }
  return meshes;
}

/** Carries the `indices` samples of `m` to where its mesh is now, bent by its bones, calling `each` with world position and normal. */
function carry(m: pc.MeshInstance, s: MeshSamples, indices: readonly number[], each: (k: number, position: pc.Vec3, normal: pc.Vec3) => void) {
  const skin = m.skinInstance;
  let world: pc.Mat4 | undefined;
  if (skin && s.bones) {
    const inverse = skin.skin.inverseBindPose;
    skin.bones.forEach((bone, b) => { (anchorSkin[b] ??= new pc.Mat4()).mul2(bone.getWorldTransform(), inverse[b]); });
  } else world = m.node.getWorldTransform();
  indices.forEach((i, k) => {
    point.set(s.position[i * 3], s.position[i * 3 + 1], s.position[i * 3 + 2]);
    normal.set(s.normal[i * 3], s.normal[i * 3 + 1], s.normal[i * 3 + 2]);
    if (world) { world.transformPoint(point, anchorPoint); world.transformVector(normal, anchorNormal); }
    else {
      anchorPoint.set(0, 0, 0); anchorNormal.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        const w = s.weights![i * 4 + j], matrix = anchorSkin[s.bones![i * 4 + j]];
        if (w <= 0 || !matrix) continue;
        const d = matrix.data, x = point.x, y = point.y, z = point.z;
        anchorPoint.x += (d[0] * x + d[4] * y + d[8] * z + d[12]) * w;
        anchorPoint.y += (d[1] * x + d[5] * y + d[9] * z + d[13]) * w;
        anchorPoint.z += (d[2] * x + d[6] * y + d[10] * z + d[14]) * w;
        anchorNormal.x += (d[0] * normal.x + d[4] * normal.y + d[8] * normal.z) * w;
        anchorNormal.y += (d[1] * normal.x + d[5] * normal.y + d[9] * normal.z) * w;
        anchorNormal.z += (d[2] * normal.x + d[6] * normal.y + d[10] * normal.z) * w;
      }
    }
    anchorNormal.normalize();
    each(k, anchorPoint, anchorNormal);
  });
}

/**
 * Up to `count` points on `model`'s surface as it stands now, chosen by area, each one kept if
 * `keep` says so (where it is, which way it faces, the points already chosen). Each stays on its
 * mesh as the model moves (`placeAnchors`).
 */
export function pickAnchors(model: pc.Entity, count: number, keep: (position: pc.Vec3, normal: pc.Vec3, chosen: readonly pc.Vec3[]) => boolean, tries = count * 12): SurfaceAnchor[] {
  const meshes = sampled(model), total = meshes.reduce((sum, e) => sum + e.area, 0);
  if (!total) return [];
  const out: SurfaceAnchor[] = [], chosen: pc.Vec3[] = [];
  for (let t = 0; t < tries && out.length < count; t++) {
    let want = Math.random() * total, e = meshes[0];
    for (const candidate of meshes) { e = candidate; if ((want -= candidate.area) <= 0) break; }
    const index = Math.floor(Math.random() * e.s.position.length / 3);
    let ok = false;
    carry(e.m, e.s, [index], (_, p, n) => { ok = keep(p, n, chosen); if (ok) chosen.push(p.clone()); });
    if (ok) out.push({ instance: e.m, index });
  }
  return out;
}

/** Where each of `anchors` is now on `model`, and which way its surface faces there (false for one whose mesh is gone). */
export function placeAnchors(anchors: readonly SurfaceAnchor[], positions: pc.Vec3[], normals: pc.Vec3[]) {
  const found: boolean[] = anchors.map(() => false), byMesh = new Map<pc.MeshInstance, number[]>();
  anchors.forEach((a, k) => { const list = byMesh.get(a.instance); if (list) list.push(k); else byMesh.set(a.instance, [k]); });
  for (const [m, list] of byMesh) {
    const s = m.mesh ? meshSamples(m.mesh) : undefined;
    if (!s || !m.node) continue;
    carry(m, s, list.map(k => anchors[k].index), (j, p, n) => { const k = list[j]; positions[k].copy(p); normals[k].copy(n); found[k] = true; });
  }
  return found;
}
