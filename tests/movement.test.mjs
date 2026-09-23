import assert from 'node:assert/strict';
import test from 'node:test';
import { FreeMovement, LEVEL, RADIUS, SPAWN, WALK_SPEED, canWalk, facingToward, screenToGrid, stickDirection } from '../src/movement.ts';
import { NEIGHBORHOOD } from '../src/environments.ts';
import { WanderingPack } from '../src/encounters.ts';

const open = ['#######', '#.....#', '#.....#', '#.....#', '#######'];
const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) < epsilon;
function drive(m, x, z, seconds, occupied = [], fps = 60) {
  let steps = 0;
  for (let i = 0; i < Math.round(seconds * fps); i++) steps += m.drive(x, z, 1 / fps, occupied) ? 1 : 0;
  return steps;
}
test('every floor tile is reachable from spawn', () => {
  const seen = new Set();
  const queue = [SPAWN];
  while (queue.length) {
    const c = queue.shift();
    const key = `${c.x},${c.z}`;
    if (!canWalk(c) || seen.has(key)) continue;
    seen.add(key);
    queue.push({ x: c.x + 1, z: c.z }, { x: c.x - 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x, z: c.z - 1 });
  }
  assert.equal(seen.size, [...LEVEL.join('')].filter(c => c !== '#').length);
});
test('map edges and non-integer positions are never walkable', () => {
  for (const c of [{ x: -1, z: 3 }, { x: 13, z: 5 }, { x: 3, z: 13 }, { x: 1.5, z: 1 }, { x: 1, z: 0 }]) {
    assert.equal(canWalk(c), false);
  }
});
test('joystick dead zone and dominant axis prevent drift and diagonals', () => {
  assert.equal(stickDirection(0.29, -0.29), null);
  assert.equal(stickDirection(0.8, -0.5), 'right');
  assert.equal(stickDirection(-0.9, 0.6), 'left');
  assert.equal(stickDirection(0.3, -0.9), 'up');
  assert.equal(stickDirection(0, 0.9), 'down');
});
test('joystick dead zone and dominant axis pick menu directions', () => {
  assert.equal(stickDirection(0.29, -0.29), null);
  assert.equal(stickDirection(0.8, -0.5), 'right');
  assert.equal(stickDirection(-0.9, 0.6), 'left');
  assert.equal(stickDirection(0.3, -0.9), 'up');
  assert.equal(stickDirection(0, 0.9), 'down');
});
test('a circular stick sweep changes sectors once per quarter turn without diagonal chatter', () => {
  let previous = 'right';
  const turns = [];
  for (let degrees = 0; degrees <= 360; degrees++) {
    const radians = degrees * Math.PI / 180;
    const direction = stickDirection(Math.cos(radians), Math.sin(radians), previous);
    if (direction !== previous) turns.push(direction);
    previous = direction;
  }
  assert.deepEqual(turns, ['down', 'left', 'up', 'right']);
  for (const [x, y] of [[.7, .71], [.72, .69], [.68, .73]]) assert.equal(stickDirection(x, y, 'right'), 'right');
  assert.equal(stickDirection(.6, .8, 'right'), 'down');
  assert.equal(stickDirection(-1, 0, 'right'), 'left');
  assert.equal(stickDirection(.28, 0, 'right'), 'right');
  assert.equal(stickDirection(.2, 0, 'right'), null);
  assert.equal(stickDirection(.28, 0), null);
});
test('screen directions map onto the isometric grid', () => {
  // Screen right is between grid right and grid up; screen down is between grid right and down.
  const right = screenToGrid(1, 0), down = screenToGrid(0, 1);
  assert.ok(right.x > 0 && right.z < 0 && Math.abs(Math.abs(right.x) - Math.abs(right.z)) < 1e-9);
  assert.ok(down.x > 0 && down.z > 0);
  assert.equal(facingToward(0, 1), 0); assert.equal(facingToward(1, 0), 90); assert.equal(facingToward(0, -1), 180);
});
test('free movement goes any direction and stops exactly where released', () => {
  const m = new FreeMovement(open, { x: 2, z: 2 });
  drive(m, Math.SQRT1_2, Math.SQRT1_2, .1);
  const stop = m.position;
  assert.ok(stop.x > 2.3 && stop.z > 2.3 && !Number.isInteger(stop.x));
  assert.ok(near(stop.x - 2, stop.z - 2));
  assert.equal(m.walking, true);
  drive(m, 0, 0, .5);
  assert.deepEqual(m.position, stop); assert.equal(m.walking, false);
});
test('speed is the same at any frame rate, a stalled frame cannot teleport, and tilt scales it', () => {
  const lane = ['####################', '#..................#', '####################'];
  for (const fps of [30, 60, 144]) {
    const m = new FreeMovement(lane, { x: 1, z: 1 });
    drive(m, 1, 0, 1, [], fps);
    assert.ok(near(m.position.x, 1 + WALK_SPEED, 1e-3), `${fps} fps`);
  }
  const m = new FreeMovement(lane, { x: 1, z: 1 });
  m.drive(1, 0, 10); assert.ok(near(m.position.x, 1 + WALK_SPEED * .05));
  const slow = new FreeMovement(lane, { x: 1, z: 1 });
  drive(slow, .5, 0, 1); assert.ok(near(slow.position.x, 1 + WALK_SPEED / 2, 1e-3));
  const capped = new FreeMovement(lane, { x: 1, z: 1 });
  drive(capped, 3, 0, .5); assert.ok(near(capped.position.x, 1 + WALK_SPEED / 2, 1e-3));
});
test('walls stop the collider flush and the player slides along them', () => {
  const m = new FreeMovement(open, { x: 1, z: 2 });
  drive(m, Math.SQRT1_2, Math.SQRT1_2, 3);
  // Bottom-right corner of the room, touching both walls.
  assert.ok(near(m.position.x, 5.5 - RADIUS)); assert.ok(near(m.position.z, 3.5 - RADIUS));
  drive(m, 0, 1, .2); assert.equal(m.walking, false);
  // Pushing up-left reaches the top wall first, then keeps sliding left along it.
  drive(m, -.3, -1, .6);
  assert.ok(near(m.position.z, .5 + RADIUS));
  const before = m.position.x; drive(m, -.3, -1, .2);
  assert.ok(m.position.x < before - .2); assert.ok(near(m.position.z, .5 + RADIUS)); assert.equal(m.walking, true);
});
test('clipping a corner nudges the player around it instead of snagging', () => {
  const room = ['#######', '#.....#', '#..#..#', '#.....#', '#######'];
  const m = new FreeMovement(room, { x: 1, z: 2 });
  // Clipping the pillar's corner by a third of a tile still gets around it.
  m.at = { x: 1, z: 1.55 };
  drive(m, 1, 0, 1);
  assert.ok(m.position.x > 4, `stuck at ${m.position.x}`); assert.ok(m.position.z < 1.5);
});
test('walls are never crossed, even at every angle and a stalled frame', () => {
  for (let degrees = 0; degrees < 360; degrees += 7) {
    const m = new FreeMovement(open, { x: 3, z: 2 });
    const a = degrees * Math.PI / 180;
    for (let i = 0; i < 60; i++) m.drive(Math.cos(a), Math.sin(a), i % 5 ? 1 / 60 : 1);
    const p = m.position;
    assert.ok(p.x >= .5 + RADIUS - 1e-6 && p.x <= 5.5 - RADIUS + 1e-6 && p.z >= .5 + RADIUS - 1e-6 && p.z <= 3.5 - RADIUS + 1e-6, `${degrees}°`);
    assert.ok(canWalk(m.cell, open));
  }
});
test('a step counts each new tile once, even walking along a tile border', () => {
  const lane = ['##########', '#........#', '#........#', '##########'];
  const m = new FreeMovement(lane, { x: 1, z: 1 });
  assert.equal(drive(m, 1, 0, 6 / WALK_SPEED), 6);
  assert.deepEqual(m.cell, { x: 7, z: 1 }); assert.equal(m.steps, 6);
  const seam = new FreeMovement(lane, { x: 1, z: 1 });
  seam.at = { x: 1.5, z: 1.5 };
  for (let i = 0; i < 40; i++) seam.drive(0, i % 2 ? .02 : -.02, 1 / 60);
  assert.equal(seam.steps, 0);
});
test('occupied tiles are solid and never part of the footprint', () => {
  const m = new FreeMovement(open, { x: 1, z: 2 });
  const dog = { x: 3, z: 2 };
  drive(m, 1, 0, 1, [dog]);
  assert.ok(near(m.position.x, 2.5 - RADIUS));
  assert.ok(!m.footprint.some(c => c.x === dog.x && c.z === dog.z));
  assert.ok(m.footprint.some(c => c.x === m.cell.x && c.z === m.cell.z));
});
test('post-battle overlap with the dog hops to a separate nearest street tile', () => {
  const dog = new WanderingPack(NEIGHBORHOOD.grid).dogs[0].cell;
  const m = new FreeMovement(NEIGHBORHOOD.grid, dog);
  assert.equal(m.resolveOverlap([dog]), true);
  assert.equal(Math.abs(m.cell.x - dog.x) + Math.abs(m.cell.z - dog.z), 1);
  assert.equal(canWalk(m.cell, NEIGHBORHOOD.grid), true);
  assert.deepEqual(m.position, dog); assert.equal(m.bouncing, true);
  m.update(.05);
  assert.notDeepEqual(m.position, dog); assert.notDeepEqual(m.position, m.cell);
  assert.equal(m.drive(1, 0, .05, [dog]), false);
  for (let i = 0; i < 6; i++) m.update(.05);
  assert.deepEqual(m.position, m.cell); assert.equal(m.bouncing, false); assert.equal(m.steps, 0);
  assert.equal(m.resolveOverlap([dog]), false);
});
test('overlap resolution avoids walls and occupied neighbors and handles a full area', () => {
  const grid = ['#####', '#...#', '#####'];
  const spawn = { x: 1, z: 1 };
  const m = new FreeMovement(grid, spawn);
  assert.equal(m.resolveOverlap([spawn, { x: 2, z: 1 }], false), true);
  assert.deepEqual(m.position, { x: 3, z: 1 }); assert.equal(m.bouncing, false);
  assert.equal(m.resolveOverlap([spawn, { x: 2, z: 1 }, m.cell]), false);
  assert.deepEqual(m.position, { x: 3, z: 1 });
});
test('teleport cancels a separation hop', () => {
  const m = new FreeMovement();
  m.resolveOverlap([SPAWN]);
  m.teleport(LEVEL, SPAWN);
  assert.equal(m.bouncing, false);
  assert.deepEqual(m.position, SPAWN);
});

test('running doubles speed, preserves analog tilt, and returns to walking on release', () => {
  const lane = ['####################', '#..................#', '####################'];
  for (const fps of [30, 60, 144]) for (const tilt of [.5, 1]) {
    const m = new FreeMovement(lane, { x: 1, z: 1 });
    for (let i = 0; i < fps; i++) m.drive(tilt, 0, 1 / fps, [], true);
    assert.ok(near(m.position.x, 1 + WALK_SPEED * 2 * tilt));
    const before = m.position.x;
    m.drive(tilt, 0, 1 / fps);
    assert.ok(near(m.position.x - before, WALK_SPEED * tilt / fps));
  }
});

test('running still collides with walls and occupied tiles on stalled frames', () => {
  for (const occupied of [[], [{ x: 3, z: 2 }]]) {
    const m = new FreeMovement(open, { x: 1, z: 2 });
    for (let i = 0; i < 60; i++) m.drive(1, 0, 1, occupied, true);
    assert.ok(near(m.position.x, (occupied.length ? 2.5 : 5.5) - RADIUS));
    assert.equal(m.walking, false);
  }
});
