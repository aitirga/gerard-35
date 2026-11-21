/** Small geometry types keep visibility checks independent of the renderer. */
export type Point3 = { x: number; y: number; z: number };

/** Only surfaces in front of the player may open; shared with the cutaway shader. */
export const BUILDING_CUT_NEAR = 0.05;
/**
 * A surface whose plane passes this close to the focus is the wall he is leaning on, not one hiding
 * him: the walkable grid lets him stand up to about this far inside a real footprint, whose lines don't
 * follow the cells. Also shared with the cutaway shader.
 */
export const BUILDING_CUT_LEAN = 0.35;

interface Triangle {
  a: Point3;
  ab: Point3;
  ac: Point3;
  /** Unit normal of the triangle's plane; its sign doesn't matter. */
  normal: Point3;
}

/** Compile the actual drawn triangles, including their roof shape, once per building. */
export function createBuildingOccluder(vertices: readonly number[]) {
  if (vertices.length % 9 !== 0) throw new RangeError('Building triangles need nine coordinates each');
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const triangles: Triangle[] = [];
  for (let i = 0; i < vertices.length; i += 9) {
    const a = { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] };
    const b = { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] };
    const c = { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] };
    for (const p of [a, b, c]) {
      min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
    }
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const nx = ab.y * ac.z - ab.z * ac.y, ny = ab.z * ac.x - ab.x * ac.z, nz = ab.x * ac.y - ab.y * ac.x;
    const area = Math.hypot(nx, ny, nz) || 1;
    triangles.push({ a, ab, ac, normal: { x: nx / area, y: ny / area, z: nz / area } });
  }
  return { min, max, triangles };
}

type BuildingOccluder = ReturnType<typeof createBuildingOccluder>;
const EPSILON = 1e-8;

function hitsBounds(shape: BuildingOccluder, origin: Point3, direction: Point3) {
  let near = BUILDING_CUT_NEAR, far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(direction[axis]) < EPSILON) {
      if (origin[axis] < shape.min[axis] || origin[axis] > shape.max[axis]) return false;
      continue;
    }
    const a = (shape.min[axis] - origin[axis]) / direction[axis];
    const b = (shape.max[axis] - origin[axis]) / direction[axis];
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return far > BUILDING_CUT_NEAR;
}

/** Double-sided ray/triangle intersection: both sides of an opaque surface hide the player. */
function hitsTriangle(triangle: Triangle, origin: Point3, direction: Point3) {
  const { a, ab, ac } = triangle;
  const px = direction.y * ac.z - direction.z * ac.y;
  const py = direction.z * ac.x - direction.x * ac.z;
  const pz = direction.x * ac.y - direction.y * ac.x;
  const determinant = ab.x * px + ab.y * py + ab.z * pz;
  if (Math.abs(determinant) < EPSILON) return false;
  const inverse = 1 / determinant;
  const tx = origin.x - a.x, ty = origin.y - a.y, tz = origin.z - a.z;
  const u = (tx * px + ty * py + tz * pz) * inverse;
  if (u < -EPSILON || u > 1 + EPSILON) return false;
  const qx = ty * ab.z - tz * ab.y;
  const qy = tz * ab.x - tx * ab.z;
  const qz = tx * ab.y - ty * ab.x;
  const v = (direction.x * qx + direction.y * qy + direction.z * qz) * inverse;
  if (v < -EPSILON || u + v > 1 + EPSILON) return false;
  return (ac.x * qx + ac.y * qy + ac.z * qz) * inverse > BUILDING_CUT_NEAR;
}

function leansOn({ a, normal }: Triangle, focus: Point3) {
  return Math.abs((a.x - focus.x) * normal.x + (a.y - focus.y) * normal.y + (a.z - focus.z) * normal.z) < BUILDING_CUT_LEAN;
}

/** The unit direction towards the camera, or nothing for a degenerate one. */
function unit(toCamera: Point3): Point3 | undefined {
  const length = Math.hypot(toCamera.x, toCamera.y, toCamera.z);
  return length < EPSILON ? undefined : { x: toCamera.x / length, y: toCamera.y / length, z: toCamera.z / length };
}

/** A building opens only when its visible geometry overlaps the player's narrow silhouette. */
export function buildingHidesPlayer(shape: BuildingOccluder, focus: Point3, toCamera: Point3): boolean {
  if (!shape.triangles.length) return false;
  const direction = unit(toCamera);
  if (!direction) return false;
  const horizontal = Math.hypot(direction.x, direction.z);
  const right = horizontal > EPSILON ? { x: -direction.z / horizontal, z: direction.x / horizontal } : { x: 1, z: 0 };
  // From the knees to the top of the head (Aitor stands taller than Gerard): a building over a head opens too.
  for (const lift of [-0.35, 0.1, 0.6, 1.1]) {
    for (const side of [0, -0.18, 0.18]) {
      const origin = { x: focus.x + right.x * side, y: focus.y + lift, z: focus.z + right.z * side };
      if (hitsBounds(shape, origin, direction) && shape.triangles.some(triangle => !leansOn(triangle, focus) && hitsTriangle(triangle, origin, direction))) return true;
    }
  }
  return false;
}

/**
 * The ground round the player that a building coming down to its foundations keeps in sight: points
 * `reach` world units from his focus in eight directions, `drop` below it (just above his feet).
 */
export const GROUND_SIGHT = { reach: 3, drop: 0.6 };
const UP: Point3 = { x: 0, y: 1, z: 0 };

/**
 * Whether a building hides the ground a few steps round the player, as a roof in front of the square
 * he stands in does while it covers half the screen and not him. Ground under the building itself
 * does not count, so from the street in front of it the floor behind its facade never brings it down.
 */
export function buildingHidesGround(shape: BuildingOccluder, focus: Point3, toCamera: Point3): boolean {
  if (!shape.triangles.length) return false;
  const direction = unit(toCamera);
  if (!direction) return false;
  const hits = (origin: Point3, towards: Point3) => hitsBounds(shape, origin, towards) && shape.triangles.some(triangle => hitsTriangle(triangle, origin, towards));
  for (let k = 0; k < 8; k++) {
    const angle = k * Math.PI / 4;
    const origin = { x: focus.x + Math.cos(angle) * GROUND_SIGHT.reach, y: focus.y - GROUND_SIGHT.drop, z: focus.z + Math.sin(angle) * GROUND_SIGHT.reach };
    if (hits(origin, direction) && !hits(origin, UP)) return true;
  }
  return false;
}
