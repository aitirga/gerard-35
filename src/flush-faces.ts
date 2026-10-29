import * as pc from 'playcanvas';

/**
 * Models built from boxes often have two parts whose faces lie in the same plane and face the same
 * way: a leg flush with the side of a body, a skirting board flush with a wall. The depth buffer
 * cannot tell which is in front, so the surface flickers between them as anything moves
 * (z-fighting). `separateFlushFaces` finds those faces under an entity and pushes the smaller one
 * out by `PUSH`, a fraction of a pixel, so the detail always wins and nothing opens a gap.
 * `separateFlushFacesOnArrival` does it for every model put in the scene.
 */
const PUSH = .0017;
/** Faces closer than this along their normal count as the same plane (world units). */
const SAME_PLANE = .0002;
/**
 * Rounds of pushing: a pushed face can land on another plane (PUSH is off the millimetre grid
 * that hand-made offsets use, so it seldom does), and its part's side faces grow a little longer.
 */
const ROUNDS = 6;

interface Face {
  part: pc.Entity; material: pc.Material | null; axis: number; sign: number;
  /** Which way it faces, rounded, so faces that may share a plane sort together. */
  direction: number;
  normal: pc.Vec3; offset: number; centre: pc.Vec3; u: pc.Vec3; v: pc.Vec3; hu: number; hv: number; area: number;
  /** World bounds of the face. */
  lo: number[]; hi: number[];
  /** Tie-break between faces of the same size. */
  order: number;
}

const xyz = (v: pc.Vec3) => [v.x, v.y, v.z];
const isBox = (node: pc.GraphNode): node is pc.Entity => (node as pc.Entity).render?.type === 'box' && !!(node as pc.Entity).render!.meshInstances.length;

function facesOf(part: pc.Entity): Face[] {
  const m = part.getWorldTransform();
  const centre = m.getTranslation(new pc.Vec3());
  const axes = [m.getX(new pc.Vec3()), m.getY(new pc.Vec3()), m.getZ(new pc.Vec3())];
  const size = axes.map(a => a.length());
  // A model shrunk to nothing to grow in later would turn a fraction of a pixel into a big step.
  const own = part.getLocalScale();
  if ([own.x, own.y, own.z].some((s, i) => size[i] < Math.abs(s) * .05 || size[i] < 1e-6)) return [];
  const unit = axes.map((a, i) => a.mulScalar(1 / size[i]));
  const material = part.render!.meshInstances[0].material;
  const faces: Face[] = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = unit[(axis + 1) % 3], v = unit[(axis + 2) % 3], hu = size[(axis + 1) % 3] / 2, hv = size[(axis + 2) % 3] / 2;
    const reach = [Math.abs(u.x) * hu + Math.abs(v.x) * hv, Math.abs(u.y) * hu + Math.abs(v.y) * hv, Math.abs(u.z) * hu + Math.abs(v.z) * hv];
    for (const sign of [-1, 1]) {
      const normal = unit[axis].clone().mulScalar(sign);
      const at = normal.clone().mulScalar(size[axis] / 2).add(centre);
      faces.push({
        part, material, axis, sign, normal, offset: normal.dot(at), centre: at, u, v, hu, hv, area: hu * hv * 4,
        direction: Math.round(normal.x * 100) * 40401 + Math.round(normal.y * 100) * 201 + Math.round(normal.z * 100),
        lo: xyz(at).map((c, k) => c - reach[k]), hi: xyz(at).map((c, k) => c + reach[k]), order: 0,
      });
    }
  }
  return faces;
}

/** Whether two rectangles in the same plane overlap by more than a sliver (separating axes). */
function overlap(f: Face, g: Face) {
  const dx = g.centre.x - f.centre.x, dy = g.centre.y - f.centre.y, dz = g.centre.z - f.centre.z;
  for (const axis of [f.u, f.v, g.u, g.v]) {
    const reachF = Math.abs(f.u.dot(axis)) * f.hu + Math.abs(f.v.dot(axis)) * f.hv;
    const reachG = Math.abs(g.u.dot(axis)) * g.hu + Math.abs(g.v.dot(axis)) * g.hv;
    if (Math.abs(dx * axis.x + dy * axis.y + dz * axis.z) >= reachF + reachG - SAME_PLANE) return false;
  }
  return true;
}

/** The same colour on both sides of the plane: no flicker to see, so leave it (e.g. glasses rims). */
function looksTheSame(f: Face, g: Face) {
  return f.material === g.material && !(f.material as pc.StandardMaterial | null)?.diffuseMap;
}

/** Bigger faces first; equal ones in the order they were found. */
const before = (f: Face, g: Face) => f.area > g.area || (f.area === g.area && f.order < g.order);

/** Pairs of flush faces in one plane, swept along the world axis that runs most across it. */
function pairsIn(plane: Face[], pairs: [Face, Face][]) {
  const n = xyz(plane[0].normal).map(Math.abs), k = n.indexOf(Math.min(...n));
  plane.sort((f, g) => f.lo[k] - g.lo[k]);
  for (let i = 0; i < plane.length; i++) {
    const f = plane[i];
    for (let j = i + 1; j < plane.length && plane[j].lo[k] <= f.hi[k] + SAME_PLANE; j++) {
      const g = plane[j];
      if (f.part === g.part || f.normal.dot(g.normal) < .9999 || Math.abs(f.offset - g.offset) > SAME_PLANE) continue;
      if ([0, 1, 2].some(a => g.lo[a] > f.hi[a] + SAME_PLANE || f.lo[a] > g.hi[a] + SAME_PLANE)) continue;
      if (looksTheSame(f, g) || !overlap(f, g)) continue;
      pairs.push(before(f, g) ? [f, g] : [g, f]);
    }
  }
}

/** Pairs of flush faces that would flicker, bigger face first. */
function pairsAmong(faces: Face[]) {
  faces.forEach((f, i) => { f.order = i; });
  // Faces facing the same way, in order along it: each run within SAME_PLANE of the next is a plane.
  const sorted = [...faces].sort((f, g) => f.direction - g.direction || f.offset - g.offset);
  const pairs: [Face, Face][] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].direction === sorted[i].direction && sorted[j].offset - sorted[j - 1].offset <= SAME_PLANE) j++;
    if (j - i > 1) pairsIn(sorted.slice(i, j), pairs);
    i = j;
  }
  return pairs;
}

function boxesUnder(root: pc.Entity) {
  const boxes = new Map<pc.Entity, Face[]>();
  root.forEach(node => { if (isBox(node)) boxes.set(node, facesOf(node)); });
  return boxes;
}

/** Pairs of flush faces under `root` that would flicker, bigger face first. */
export function findFlushFaces(root: pc.Entity) {
  return pairsAmong([...boxesUnder(root).values()].flat());
}

/** Pushes `face` out along its normal by `step` (world units), keeping the opposite face where it was. */
function push(face: Face, step: number) {
  const { part, axis, sign } = face;
  const world = part.getWorldTransform();
  const column = [world.getX(new pc.Vec3()), world.getY(new pc.Vec3()), world.getZ(new pc.Vec3())][axis];
  const length = column.length();
  const scale = part.getLocalScale().clone();
  const grow = 1 + step / length;
  scale.x *= axis === 0 ? grow : 1; scale.y *= axis === 1 ? grow : 1; scale.z *= axis === 2 ? grow : 1;
  const shift = column.mulScalar(sign * step / 2 / length);
  const parent = part.parent as pc.Entity | null;
  if (parent) new pc.Mat4().copy(parent.getWorldTransform()).invert().transformVector(shift, shift);
  part.setLocalScale(scale);
  part.setLocalPosition(part.getLocalPosition().clone().add(shift));
}

/**
 * Separates flush faces under `root` (see the top of this file) and returns how many it pushed.
 * Run it on a model once it is built and posed at rest; running it again is harmless.
 */
export function separateFlushFaces(root: pc.Entity) {
  const boxes = boxesUnder(root);
  let pushed = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const pairs = pairsAmong([...boxes.values()].flat());
    if (!pairs.length) break;
    // Each face steps out one PUSH past the furthest face it lies on, so a stack (a wall, a step
    // on it, the tread on the step, its edge) comes out in order in one go: biggest faces first.
    pairs.sort(([a], [b]) => before(a, b) ? -1 : before(b, a) ? 1 : 0);
    const level = new Map<Face, number>();
    for (const [big, small] of pairs) level.set(small, Math.max(level.get(small) ?? 0, (level.get(big) ?? 0) + 1));
    for (const [face, steps] of level) push(face, steps * PUSH);
    for (const face of level.keys()) face.part.forEach(node => { if (isBox(node)) boxes.set(node, facesOf(node)); });
    pushed += level.size;
  }
  return pushed;
}

/**
 * Separates flush faces on each model put under `app.root`, once it is built: straight after the
 * code that built it, or before the frame it was built in is drawn (and its static batch merged).
 * Parts added to a model already in the scene need their own `separateFlushFaces`.
 */
export function separateFlushFacesOnArrival(app: pc.AppBase) {
  const arrived = new Set<pc.Entity>();
  const settle = () => {
    for (const model of arrived) if (model.parent) separateFlushFaces(model);
    arrived.clear();
  };
  app.root.on('childinsert', (child: pc.Entity) => {
    if (!arrived.size) queueMicrotask(settle);
    arrived.add(child);
  });
  app.on('prerender', settle);
}
