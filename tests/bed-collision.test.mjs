import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES } from '../src/chapter-1.ts';
import { MERIDIANA } from '../src/environments.ts';
import { Follower, FOLLOW_GAP, pathTo } from '../src/follower.ts';
import { FreeMovement, RADIUS, WALK_SPEED, canWalk } from '../src/movement.ts';

const exits = { gerard: { x: 12, z: 15 }, aitor: { x: 9, z: 15 } };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

// Check the circle against solid tile boxes independently of FreeMovement's broad phase and
// collision solver, including furniture marked in the actual bedroom plan.
function assertClear(position, context = '') {
  for (let z = 0; z < MERIDIANA.grid.length; z++) {
    for (let x = 0; x < MERIDIANA.grid[z].length; x++) {
      if (MERIDIANA.grid[z][x] !== '#') continue;
      const dx = Math.max(x - .5 - position.x, 0, position.x - x - .5);
      const dz = Math.max(z - .5 - position.z, 0, position.z - z - .5);
      assert.ok(dx * dx + dz * dz >= (RADIUS - 1e-7) ** 2,
        `${context}: circle at ${position.x},${position.z} penetrates solid tile ${x},${z}`);
    }
  }
}

function driveFrames(movement, x, z, count, dt, context) {
  for (let frame = 0; frame < count; frame++) {
    movement.drive(x, z, dt);
    assertClear(movement.position, `${context}, frame ${frame}`);
  }
}

test('the Meridiana mattress blocks approaches from both sides and its foot', () => {
  const approaches = [
    { start: exits.gerard, vector: [-1, 0], axis: 'x', stop: 11.5 + RADIUS },
    { start: exits.aitor, vector: [1, 0], axis: 'x', stop: 9.5 - RADIUS },
    { start: { x: 10, z: 13 }, vector: [0, 1], axis: 'z', stop: 13.5 - RADIUS },
    { start: { x: 11, z: 13 }, vector: [0, 1], axis: 'z', stop: 13.5 - RADIUS },
  ];
  for (const dt of [1 / 60, .05, .5]) for (const { start, vector, axis, stop } of approaches) {
    const movement = new FreeMovement(MERIDIANA.grid, start);
    driveFrames(movement, ...vector, 120, dt, `approach ${start.x},${start.z} dt=${dt}`);
    near(movement.position[axis], stop);
    assert.equal(movement.walking, false, 'pushing against the mattress does not animate walking');
  }
});

test('diagonal movement cannot enter the bed or the bedside furniture on slow frames', () => {
  const approaches = [
    [{ x: 12, z: 13 }, [-1, 1]],
    [{ x: 9, z: 13 }, [1, 1]],
    [exits.gerard, [-1, -1]],
    [exits.aitor, [1, -1]],
    [exits.gerard, [-1, 1]],
    [exits.aitor, [1, 1]],
  ];
  for (const dt of [1 / 144, 1 / 30, .5]) for (const [start, vector] of approaches) {
    const movement = new FreeMovement(MERIDIANA.grid, start);
    driveFrames(movement, ...vector, 180, dt, `diagonal ${start.x},${start.z} dt=${dt}`);
  }
});

test('both bedside passages let a character walk out and back without crossing the mattress', () => {
  for (const start of Object.values(exits)) {
    const movement = new FreeMovement(MERIDIANA.grid, start);
    const frames = 40, dt = 2 / WALK_SPEED / frames;
    driveFrames(movement, 0, -1, frames, dt, `leave bedside ${start.x}`);
    near(movement.position.x, start.x);
    near(movement.position.z, 13);
    driveFrames(movement, 0, 1, frames, dt, `return bedside ${start.x}`);
    near(movement.position.x, start.x);
    near(movement.position.z, start.z);
  }
});

test('getting out on each side connects to the existing morning positions over clear floor', () => {
  for (const [start, destination] of [[exits.gerard, PLACES.wakeUp.cell], [exits.aitor, PLACES.aitor.cell]]) {
    const route = pathTo(MERIDIANA.grid, start, destination);
    assert.ok(route.length, 'there is a walkable path from the bedside to the morning position');
    assert.deepEqual(route.at(-1), destination);
    let previous = start;
    for (const cell of route) {
      assert.equal(canWalk(cell, MERIDIANA.grid), true);
      assert.equal(Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z), 1);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        assertClear({ x: previous.x + (cell.x - previous.x) * t, z: previous.z + (cell.z - previous.z) * t }, 'morning path');
      }
      previous = cell;
    }
  }
});

test('Aitor follows around the foot of the bed after getting out on the opposite side', () => {
  for (const dt of [1 / 60, .05, .5]) {
    const follower = new Follower(exits.aitor);
    const leader = exits.gerard;
    follower.seed(pathTo(MERIDIANA.grid, exits.aitor, leader));
    for (let frame = 0; frame < 20; frame++) follower.update(dt, leader, true);
    assert.deepEqual(follower.position, exits.aitor, 'the sleeping companion stays still while the scene is held');
    let passedFoot = false;
    for (let frame = 0; frame < 360; frame++) {
      follower.update(dt, leader);
      assertClear(follower.position, `follower dt=${dt}, frame ${frame}`);
      passedFoot ||= follower.position.z === 13 && follower.position.x >= 10 && follower.position.x <= 11;
    }
    assert.equal(passedFoot, true, 'the route crosses the floor at the foot instead of cutting through the mattress');
    assert.ok(Math.hypot(follower.position.x - leader.x, follower.position.z - leader.z) <= FOLLOW_GAP + .01);
    assert.equal(follower.walking, false);
  }
});
