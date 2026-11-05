import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, PUSH_SPEED, createCrowd, keepApart } from '../src/crowd.ts';

const open = Array.from({ length: 9 }, () => '.........');
const DT = 1 / 60;
const gap = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
const settle = (crowd, grid = open, seconds = 2) => { for (let i = 0; i < seconds / DT; i++) crowd.separate(DT, grid); };

test('two companions on top of each other step apart until they just touch', () => {
  const crowd = createCrowd();
  const aitor = { position: { x: 4, z: 4 } }, haru = { position: { x: 4.1, z: 4 } };
  crowd.add(BODIES.person, () => [aitor]);
  crowd.add(BODIES.cat, () => [haru]);
  settle(crowd);
  assert.ok(Math.abs(gap(aitor, haru) - (BODIES.person.radius + BODIES.cat.radius)) < 1e-3, `apart by ${gap(aitor, haru)}`);
  // The cat gives way more than Aitor does.
  assert.ok(Math.abs(haru.position.x - 4.1) > Math.abs(aitor.position.x - 4));
});

test('the players and people standing for the story never move; others go round them', () => {
  const crowd = createCrowd();
  // A getter, like the player's movement: writing to it would throw.
  const gerard = { get position() { return { x: 4, z: 4 }; } };
  const nuria = { position: { x: 5.6, z: 4 } }, yuki = { position: { x: 4.2, z: 4.1 } }, aitor = { position: { x: 5.3, z: 4.1 } };
  crowd.add(BODIES.player, () => [gerard]);
  crowd.add(BODIES.figure, () => [nuria]);
  crowd.add(BODIES.cat, () => [yuki]);
  crowd.add(BODIES.person, () => [aitor]);
  settle(crowd);
  assert.deepEqual(nuria.position, { x: 5.6, z: 4 });
  assert.ok(gap(gerard, yuki) >= BODIES.player.radius + BODIES.cat.radius - 1e-3);
  assert.ok(gap(nuria, aitor) >= BODIES.figure.radius + BODIES.person.radius - 1e-3);
});

test('a fear keeps clear of the companions but can still reach Gerard to start its fight', () => {
  assert.equal(keepApart(BODIES.monster, BODIES.player), false);
  assert.equal(keepApart(BODIES.monster, BODIES.person), true);
  assert.equal(keepApart(BODIES.monster, BODIES.monster), true, 'a pack of young fears does not stack up');
  assert.equal(keepApart(BODIES.player, BODIES.figure), false, 'two bodies that never move are left alone');
  const crowd = createCrowd();
  const gerard = { position: { x: 4, z: 4 } }, fear = { position: { x: 4.1, z: 4 } };
  crowd.add(BODIES.player, () => [gerard]);
  crowd.add(BODIES.monster, () => [fear]);
  settle(crowd);
  assert.deepEqual(fear.position, { x: 4.1, z: 4 });
});

test('nobody is pushed into a wall: they slide along it', () => {
  const grid = ['#########', '.........', '.........'];
  const crowd = createCrowd();
  // Aitor against the wall above him, Haru pressing up from below and a little to the side.
  const aitor = { position: { x: 4, z: 1 } }, haru = { position: { x: 3.9, z: 1.2 } };
  crowd.add(BODIES.person, () => [aitor]);
  crowd.add(BODIES.cat, () => [haru]);
  settle(crowd, grid);
  for (const body of [aitor, haru]) assert.equal(grid[Math.round(body.position.z)][Math.round(body.position.x)], '.');
  assert.ok(gap(aitor, haru) >= BODIES.person.radius + BODIES.cat.radius - 1e-3);
});

test('stepping aside is eased: never faster than the push speed, and steady once apart', () => {
  const crowd = createCrowd();
  const a = { position: { x: 4, z: 4 } }, b = { position: { x: 4, z: 4 } };
  crowd.add(BODIES.cat, () => [a, b]);
  const moved = crowd.separate(DT, open);
  for (const body of [a, b]) assert.ok(Math.hypot(moved.get(body).x, moved.get(body).z) <= PUSH_SPEED * DT + 1e-9);
  // On the very same spot they still part, the same way every time.
  assert.ok(gap(a, b) > 0);
  settle(crowd);
  const still = structuredClone([a.position, b.position]);
  assert.equal(crowd.separate(DT, open).size, 0);
  assert.deepEqual([a.position, b.position], still);
});

test('a kind can be taken out again, and its list is asked afresh each frame', () => {
  const crowd = createCrowd();
  const here = [];
  const a = { position: { x: 4, z: 4 } }, b = { position: { x: 4.1, z: 4 } };
  const remove = crowd.add(BODIES.cat, () => here);
  crowd.separate(DT, open);
  assert.deepEqual(b.position, { x: 4.1, z: 4 }, 'nobody listed yet');
  here.push(a, b);
  crowd.separate(DT, open);
  assert.notDeepEqual(b.position, { x: 4.1, z: 4 });
  remove();
  const after = structuredClone(b.position);
  crowd.separate(DT, open);
  assert.deepEqual(b.position, after);
});
