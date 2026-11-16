import test from 'node:test';
import assert from 'node:assert/strict';
import { reflect, trace, turned } from '../src/espejos.ts';
import { BEAM, MIRRORS, MIRRORS_START } from '../src/friends/luca.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

const grid = ENVIRONMENTS['sagrada-familia-interior'].grid;
const all = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]];

test('a mirror sends the light a quarter turn, by how it stands', () => {
  assert.deepEqual(reflect({ x: 0, z: 1 }, 0), { x: 1, z: 0 });
  assert.deepEqual(reflect({ x: 0, z: 1 }, 1), { x: -1, z: -0 });
  assert.deepEqual(reflect({ x: 1, z: 0 }, 0), { x: 0, z: 1 });
  assert.deepEqual(turned([0, 1, 0], 1), [0, 0, 0]);
});

test('the nave\'s mirrors have one way to bring the window\'s light to the chaplains\' chairs, and it starts elsewhere', () => {
  const hits = all.filter(f => trace(grid, MIRRORS, f, BEAM).hit);
  assert.deepEqual(hits, [[0, 0, 1]]);
  const start = trace(grid, MIRRORS, MIRRORS_START, BEAM);
  assert.equal(start.hit, false);
  const solved = trace(grid, MIRRORS, [0, 0, 1], BEAM);
  assert.deepEqual(solved.end, BEAM.target);
  assert.equal(solved.turns.length, 3, 'through all three');
  for (const f of all) assert.ok(trace(grid, MIRRORS, f, BEAM).path.length > 2, 'the light always comes in somewhere');
});

test('three turns from how they start are enough, never one or two', () => {
  const near = (from, n) => n === 0 ? [from] : [0, 1, 2].flatMap(i => near(turned(from, i), n - 1));
  for (const n of [1, 2]) assert.ok(!near([...MIRRORS_START], n).some(f => trace(grid, MIRRORS, f, BEAM).hit), `${n}`);
  assert.ok(near([...MIRRORS_START], 3).some(f => trace(grid, MIRRORS, f, BEAM).hit));
});
