import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CUT_NEAR, buildingHidesPlayer, createBuildingOccluder } from '../src/building-occlusion.ts';
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
  assert.equal(buildingHidesPlayer(createBuildingOccluder(wall(-2, 2, BUILDING_CUT_NEAR * 2)), focus, { x: 0, y: 0, z: 1 }), true);
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

test('Meridiana fruit-shop corner stays whole while its far-side facade still opens', () => {
  const building = meridiana.buildings.find(building => building.id === 'way/614237380');
  const vertices = building.poly.flatMap(([x, z], i) => {
    const [nextX, nextZ] = building.poly[(i + 1) % building.poly.length];
    return quad([x, 0, z], [nextX, 0, nextZ], [nextX, building.height, nextZ], [x, building.height, z]);
  });
  const shape = createBuildingOccluder(vertices);
  const camera = { x: 40, y: 52, z: 40 };
  // These walkable pavement cells previously intersected the one-cell inflated footprint.
  for (const [x, z] of [[50, 36], [52, 37], [53, 37], [55, 38]]) {
    assert.notEqual(meridiana.grid[z][x], '#');
    assert.equal(buildingHidesPlayer(shape, { x, y: 0.7, z }, camera), false, `${x},${z}`);
  }
  // At the lip of the facade it really covers a sliver of the character's silhouette.
  assert.equal(buildingHidesPlayer(shape, { x: 51, y: 0.7, z: 36 }, camera), true);
  assert.notEqual(meridiana.grid[30][40], '#');
  assert.equal(buildingHidesPlayer(shape, { x: 40, y: 0.7, z: 30 }, camera), true);
});
