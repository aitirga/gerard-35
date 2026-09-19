import assert from 'node:assert/strict';
import test from 'node:test';
import { GridMovement, LEVEL, SPAWN, canWalk, stickDirection } from '../src/movement.ts';
import { NEIGHBORHOOD } from '../src/environments.ts';
import { WanderingPack } from '../src/encounters.ts';

function finish(movement) {
  for (let i = 0; i < 12; i++) movement.update(1 / 60);
}
test('a step settles on exactly one cell and counts once', () => {
  const m = new GridMovement();
  assert.equal(m.tryStep('up'), true);
  assert.equal(m.steps, 0);
  assert.deepEqual(m.position, SPAWN);
  finish(m);
  assert.deepEqual(m.position, { x: 6, z: 8 });
  assert.equal(m.steps, 1);
  finish(m);
  assert.equal(m.steps, 1);
});
test('a second input cannot redirect a step mid-cell', () => {
  const m = new GridMovement();
  m.tryStep('up');
  m.update(0.05);
  assert.equal(m.tryStep('left'), false);
  finish(m);
  assert.deepEqual(m.cell, { x: 6, z: 8 });
});
test('walls block movement without adding steps', () => {
  const m = new GridMovement();
  m.tryStep('up'); finish(m);
  m.tryStep('up'); finish(m);
  assert.equal(m.tryStep('up'), false); // wall at 6,6
  finish(m);
  assert.deepEqual(m.cell, { x: 6, z: 7 });
  assert.equal(m.steps, 2);
});
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
test('a resumed frame cannot teleport across a cell', () => {
  const m = new GridMovement();
  m.tryStep('up');
  m.update(10);
  assert.equal(m.moving, true);
  assert.equal(m.steps, 0);
  assert.ok(m.position.z > 8 && m.position.z < 9);
});
test('movement remains on the grid through repeated turns', () => {
  const m = new GridMovement();
  for (let i = 0; i < 50; i++) for (const direction of ['up', 'right', 'down', 'left']) {
    assert.equal(m.tryStep(direction), true);
    finish(m);
  }
  assert.deepEqual(m.cell, SPAWN);
  assert.equal(m.steps, 200);
});

test('characters block entry from every direction without changing position or steps', () => {
  const occupied = [{ x: 2, z: 2 }];
  const grid = ['#####', '#...#', '#...#', '#...#', '#####'];
  for (const [spawn, direction] of [
    [{ x: 2, z: 3 }, 'up'], [{ x: 1, z: 2 }, 'right'],
    [{ x: 2, z: 1 }, 'down'], [{ x: 3, z: 2 }, 'left'],
  ]) {
    const m = new GridMovement(grid, spawn);
    assert.equal(m.tryStep(direction, occupied), false);
    assert.deepEqual(m.position, spawn);
    assert.equal(m.steps, 0);
    assert.equal(m.moving, false);
  }
});

test('post-battle overlap with the dog hops to a separate nearest street tile', () => {
  const dog = new WanderingPack(NEIGHBORHOOD.grid).dogs[0].cell;
  const m = new GridMovement(NEIGHBORHOOD.grid, dog);
  assert.equal(m.resolveOverlap([dog]), true);
  assert.equal(Math.abs(m.cell.x - dog.x) + Math.abs(m.cell.z - dog.z), 1);
  assert.equal(canWalk(m.cell, NEIGHBORHOOD.grid), true);
  assert.deepEqual(m.position, dog);
  assert.equal(m.bouncing, true);
  m.update(.05);
  assert.notDeepEqual(m.position, dog);
  assert.notDeepEqual(m.position, m.cell);
  assert.equal(m.tryStep('right', [dog]), false);
  for (let i = 0; i < 6; i++) assert.equal(m.update(.05), false);
  assert.deepEqual(m.position, m.cell);
  assert.equal(m.bouncing, false);
  assert.equal(m.steps, 0);
  assert.equal(m.resolveOverlap([dog]), false);
  assert.equal(m.tryStep('down', [dog]), false);
});

test('overlap resolution avoids walls and occupied neighbors and handles a full area', () => {
  const grid = ['#####', '#...#', '#####'];
  const spawn = { x: 1, z: 1 };
  const m = new GridMovement(grid, spawn);
  assert.equal(m.resolveOverlap([spawn, { x: 2, z: 1 }], false), true);
  assert.deepEqual(m.position, { x: 3, z: 1 });
  assert.equal(m.moving, false);
  assert.equal(m.bouncing, false);
  assert.equal(m.resolveOverlap([spawn, { x: 2, z: 1 }, m.cell]), false);
  assert.deepEqual(m.position, { x: 3, z: 1 });
});

test('teleport cancels a separation hop', () => {
  const m = new GridMovement();
  m.resolveOverlap([SPAWN]);
  m.teleport(LEVEL, SPAWN);
  assert.equal(m.bouncing, false);
  assert.equal(m.moving, false);
  assert.deepEqual(m.position, SPAWN);
});
