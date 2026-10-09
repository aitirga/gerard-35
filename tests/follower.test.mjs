import test from 'node:test';
import assert from 'node:assert/strict';
import { Follower, FOLLOW_GAP } from '../src/follower.ts';
import { WALK_SPEED } from '../src/movement.ts';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('a companion walks the leader’s path around a corner instead of cutting it', () => {
  const follower = new Follower({ x: 0, z: 0 });
  const leader = { x: 0, z: 0 };
  const dt = 1 / 60;
  // Down the street, then a right turn: the corner at (0, 6) is the only way round.
  for (let frame = 0; frame < 600; frame++) {
    if (leader.z < 6) leader.z = Math.min(6, leader.z + WALK_SPEED * dt);
    else leader.x = Math.min(6, leader.x + WALK_SPEED * dt);
    follower.update(dt, leader);
    const p = follower.position;
    // Every position lies on the L-shaped path, never across the inside of the corner.
    assert.ok(Math.abs(p.x) < 0.3 || Math.abs(p.z - 6) < 0.3, `cut the corner at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  }
  assert.ok(dist(follower.position, leader) <= FOLLOW_GAP + 0.05);
  assert.ok(dist(follower.position, leader) >= FOLLOW_GAP - 0.3);
  assert.equal(follower.walking, false, 'stands still once caught up');
});

test('a stopped companion stays put, then catches up; reset forgets the old path', () => {
  const follower = new Follower({ x: 0, z: 0 });
  const leader = { x: 0, z: 0 };
  for (let frame = 0; frame < 120; frame++) { leader.z += 0.05; follower.update(1 / 60, leader, true); }
  assert.deepEqual(follower.position, { x: 0, z: 0 });
  for (let frame = 0; frame < 240; frame++) follower.update(1 / 60, leader);
  assert.ok(dist(follower.position, leader) <= FOLLOW_GAP + 0.01);
  follower.reset({ x: 3, z: 3 });
  follower.update(1 / 60, { x: 3, z: 3.5 });
  assert.deepEqual(follower.position, { x: 3, z: 3 });
});
