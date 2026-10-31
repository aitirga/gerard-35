import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_POSE, cameraOffset, createCameraOrbit, towardCamera } from '../src/camera-orbit.ts';
import { buildingHidesPlayer, createBuildingOccluder } from '../src/building-occlusion.ts';
import { screenToGrid } from '../src/movement.ts';

const focus = { x: 0, y: 0.7, z: 0 };
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
/** A closed block over x0–x1, z0–z1, `h` tall. */
function block(x0, x1, z0, z1, h) {
  return createBuildingOccluder([
    ...quad([x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]), ...quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]),
    ...quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]), ...quad([x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]),
    ...quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]),
  ]);
}
const sightOf = shapes => pose => shapes.some(shape => buildingHidesPlayer(shape, focus, towardCamera(pose))) ? 1 : 0;
function run(orbit, sight, seconds, dt = 0.05) { for (let t = 0; t < seconds - 1e-9; t += dt) orbit.update(dt, sight); }
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the home pose is the game\'s own (40, 52, 40) camera', () => {
  const o = cameraOffset(HOME_POSE);
  assert.ok(Math.abs(o.x - 40) < 1e-9 && Math.abs(o.y - 52) < 1e-9 && Math.abs(o.z - 40) < 1e-9);
});

test('screen directions follow the camera round: up is always away from it', () => {
  assert.deepEqual(screenToGrid(0.3, -0.8), screenToGrid(0.3, -0.8, 45));
  for (const yaw of [-45, 15, 45, 105, 135]) {
    const up = screenToGrid(0, -1, yaw), right = screenToGrid(1, 0, yaw), o = cameraOffset({ yaw, pitch: 30 });
    const flat = Math.hypot(o.x, o.z);
    assert.ok(close(up.x, -o.x / flat) && close(up.z, -o.z / flat), `up at ${yaw}°`);
    assert.ok(close(up.x * right.x + up.z * right.z, 0), `right is across at ${yaw}°`);
    // Right keeps the same turn from up as at home (north-west up, north-east right).
    assert.ok(up.x * right.z - up.z * right.x > 0, `right is to the right at ${yaw}°`);
  }
});

test('in the open the camera never leaves home', () => {
  const orbit = createCameraOrbit();
  run(orbit, sightOf([block(-20, -15, -20, -15, 30)]), 3);
  assert.equal(orbit.target, HOME_POSE);
  assert.deepEqual({ ...orbit.pose }, { ...HOME_POSE });
});

test('a low block in front: after a moment it tilts up rather than swinging round', () => {
  const orbit = createCameraOrbit();
  const sight = sightOf([block(1, 4, 1, 4, 3)]);
  assert.equal(sight(HOME_POSE), 1);
  run(orbit, sight, 0.2);
  assert.equal(orbit.target, HOME_POSE, 'passing a corner does not move it');
  run(orbit, sight, 0.4);
  assert.equal(orbit.target.yaw, HOME_POSE.yaw);
  assert.ok(orbit.target.pitch > HOME_POSE.pitch);
  assert.equal(sight(orbit.target), 0);
  run(orbit, sight, 3);
  assert.ok(orbit.settled);
});

test('a tall block in front: it swings round, at most a quarter turn', () => {
  const orbit = createCameraOrbit();
  const sight = sightOf([block(1, 4, 1, 4, 20)]);
  run(orbit, sight, 0.6);
  assert.notEqual(orbit.target.yaw, HOME_POSE.yaw);
  assert.ok(Math.abs(orbit.target.yaw - HOME_POSE.yaw) <= 90);
  assert.equal(sight(orbit.target), 0);
  // It turns gradually, never more than 80° a second.
  const before = orbit.pose.yaw; orbit.update(0.1, sight);
  assert.ok(Math.abs(orbit.pose.yaw - before) <= 8 + 1e-9);
});

test('once in the open again it waits, then comes home', () => {
  const orbit = createCameraOrbit();
  run(orbit, sightOf([block(1, 4, 1, 4, 20)]), 0.6);
  const away = orbit.target;
  const open = sightOf([]);
  run(orbit, open, 1.2);
  assert.equal(orbit.target, away, 'no ping-pong at the edge of a block');
  run(orbit, open, 1.2);
  assert.equal(orbit.target, HOME_POSE);
});

test('when nothing shows him it stays home, and fights or cut-scenes bring it home', () => {
  const walled = createCameraOrbit();
  run(walled, () => 1, 2);
  assert.equal(walled.target, HOME_POSE);
  const orbit = createCameraOrbit();
  run(orbit, sightOf([block(1, 4, 1, 4, 20)]), 0.6);
  orbit.update(0.05, undefined);
  assert.equal(orbit.target, HOME_POSE);
  orbit.update(0.05, undefined, true);
  assert.deepEqual({ ...orbit.pose }, { ...HOME_POSE }, 'reduced motion cuts instead of turning');
});

test('after it moves it keeps the new angle a moment before changing its mind', () => {
  const orbit = createCameraOrbit();
  let clear = pose => pose.pitch > 60 && pose.yaw === HOME_POSE.yaw;
  const sight = pose => clear(pose) ? 0 : 1;
  run(orbit, sight, 0.6);
  assert.ok(orbit.target.pitch > 60);
  clear = pose => pose.yaw > HOME_POSE.yaw && pose.pitch < 50;
  run(orbit, sight, 0.7);
  assert.ok(orbit.target.pitch > 60, 'held');
  run(orbit, sight, 1);
  assert.ok(orbit.target.yaw > HOME_POSE.yaw && orbit.target.pitch < 50);
});
