import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CUT_LEAN, BUILDING_CUT_NEAR, buildingHidesPlayer, createBuildingOccluder } from '../src/building-occlusion.ts';
import meridiana from '../src/geo/meridiana-calle.json' with { type: 'json' };

const focus = { x: 0, y: 0.7, z: 0 };
const toCamera = { x: 0, y: 1, z: 1 };
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const wall = (left, right, z, height = 4) => quad([left, 0, z], [right, 0, z], [right, height, z], [left, height, z]);
const hides = vertices => buildingHidesPlayer(createBuildingOccluder(vertices), focus, toCamera);

test('walking beside an inaccessible facade keeps the unobstructing building whole', () => {
  const facade = quad([0.7, 0, 0.5], [0.7, 0, 3], [0.7, 5, 3], [0.7, 5, 0.5]);
  assert.equal(hides(facade), false);
  assert.equal(hides(wall(-2, 2, 1)), true);
});

test('a real wall between the player and the camera opens from either winding', () => {
  const vertices = wall(-2, 2, 1);
  assert.equal(hides(vertices), true);
  const reversed = [];
  for (let i = 0; i < vertices.length; i += 9) reversed.push(...vertices.slice(i + 6, i + 9), ...vertices.slice(i + 3, i + 6), ...vertices.slice(i, i + 3));
  assert.equal(hides(reversed), true);
  assert.equal(buildingHidesPlayer(createBuildingOccluder(vertices), focus, { x: 0, y: 52, z: 52 }), true);
});

test('walls behind the player and geometry at the focus never open', () => {
  assert.equal(hides(wall(-2, 2, -1)), false);
  assert.equal(buildingHidesPlayer(createBuildingOccluder(wall(-2, 2, 0)), focus, { x: 0, y: 0, z: 1 }), false);
  assert.equal(buildingHidesPlayer(createBuildingOccluder(wall(-2, 2, BUILDING_CUT_NEAR / 2)), focus, { x: 0, y: 0, z: 1 }), false);
  assert.equal(buildingHidesPlayer(createBuildingOccluder(wall(-2, 2, BUILDING_CUT_NEAR * 2)), focus, { x: 0, y: 0, z: 1 }), false);
  assert.equal(buildingHidesPlayer(createBuildingOccluder(wall(-2, 2, BUILDING_CUT_LEAN * 2)), focus, { x: 0, y: 0, z: 1 }), true);
});

test('an opening in a concave footprint stays visible despite overlapping building bounds', () => {
  assert.equal(hides([...wall(-3, -0.5, 1), ...wall(0.5, 3, 1)]), false);
  assert.equal(hides([...wall(-3, -0.5, 1), ...wall(0.1, 3, 1)]), true);
});

test('low roofs and empty space below a sloping roof do not create phantom occlusion', () => {
  const lowRoof = quad([-2, 0.2, 0.5], [2, 0.2, 0.5], [2, 0.2, 3], [-2, 0.2, 3]);
  assert.equal(hides(lowRoof), false);
  // All rays cross these bounds, but the actual roof slopes away above the silhouette.
  const slope = quad([-2, 4, 0.5], [2, 4, 0.5], [2, 6, 3], [-2, 6, 3]);
  assert.equal(hides(slope), false);
  const roofInSight = quad([-2, 2, 0.5], [2, 2, 0.5], [2, 2, 3], [-2, 2, 3]);
  assert.equal(hides(roofInSight), true);
});

test('occlusion samples the actual silhouette without growing it into nearby walls', () => {
  assert.equal(hides(wall(0.15, 0.3, 1)), true);
  assert.equal(hides(wall(0.3, 1, 1)), false);
  assert.equal(hides(wall(-2, 2, 1, 1.4)), true);
});

test('separate buildings retain independent visibility and empty geometry stays closed', () => {
  const obscuring = createBuildingOccluder(wall(-2, 2, 1));
  const adjacent = createBuildingOccluder(wall(0.5, 2, 1));
  assert.equal(buildingHidesPlayer(obscuring, focus, toCamera), true);
  assert.equal(buildingHidesPlayer(adjacent, focus, toCamera), false);
  assert.equal(hides([]), false);
  assert.equal(hides([0, 0, 1, 0, 0, 1, 0, 0, 1]), false);
  assert.equal(buildingHidesPlayer(obscuring, focus, { x: 0, y: 0, z: 0 }), false);
});

const occluderOf = id => {
  const building = meridiana.buildings.find(building => building.id === id);
  return createBuildingOccluder(building.poly.flatMap(([x, z], i) => {
    const [nextX, nextZ] = building.poly[(i + 1) % building.poly.length];
    return quad([x, 0, z], [nextX, 0, nextZ], [nextX, building.height, nextZ], [x, building.height, z]);
  }));
};
// The street camera's own angle (src/camera-orbit.ts HOME_POSE).
const streetCamera = { x: 40, y: 52, z: 40 };

test('home on the Meridiana stays whole from its pavement while the block behind it still opens', () => {
  // Meridiana 335 (docs/places/meridiana.md): on the far side of the avenue, its front to the camera.
  const shape = occluderOf('way/644309392');
  for (const [x, z] of [[26, 41], [28, 41], [31, 41], [34, 41], [28, 42]]) {
    assert.notEqual(meridiana.grid[z][x], '#');
    assert.equal(buildingHidesPlayer(shape, { x, y: 0.7, z }, streetCamera), false, `${x},${z}`);
  }
  // Round the back of the block, away from the camera, it opens.
  assert.equal(buildingHidesPlayer(shape, { x: 22, y: 0.7, z: 24 }, streetCamera), true);
});

test('pressed against a facade he stands in front of, the building stays closed', () => {
  const shape = occluderOf('way/644309392');
  // Against home's wall, the closest the walkable grid lets him: the footprint's line runs through him.
  for (const x of [27, 30, 33]) assert.equal(buildingHidesPlayer(shape, { x, y: 0.7, z: 39.7 }, streetCamera), false, `${x}`);
  // Round the back of the same block it still opens.
  assert.equal(buildingHidesPlayer(shape, { x: 20, y: 0.7, z: 24 }, streetCamera), true);
});
