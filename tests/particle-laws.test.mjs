import test from 'node:test';
import assert from 'node:assert/strict';
import { galtonBin, galtonBinX, galtonPath, galtonPegs, galtonTimes, lorenzPoints, MAX_LAWS } from '../src/fight-particles.ts';
import { LAW_LAB_KINDS } from '../src/law-lab.ts';

// The CPU side of the GPU engine's motion laws (src/fight-particles.ts § law): what a figure drawn over
// them and the rule's choices are worked out from, so they must agree with the shader's layout.

test('a Galton path ends in the bin it was made for, whatever order its turns take', () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const rows of [1, 4, 8, 16]) for (let bin = 0; bin <= rows; bin++) for (let i = 0; i < 20; i++) {
    const path = galtonPath(bin, rows, random);
    assert.equal(galtonBin(path, rows), bin);
    assert.ok(path >= 0 && path < 2 ** rows, 'only its rows\' bits');
  }
});

test('the board: row r has r + 1 pegs, and the bins lie half a peg gap past the last row\'s', () => {
  const pegs = galtonPegs(8, .3, .27);
  assert.equal(pegs.length, 36);
  assert.deepEqual(pegs[0], { x: 0, y: -0, row: 0 });
  // A path of all right turns ends half a gap right of the last row's rightmost peg.
  assert.ok(Math.abs(galtonBinX(8, 8, .27) - (Math.max(...pegs.map(p => p.x)) + .135)) < 1e-9);
  assert.ok(Math.abs(galtonBinX(4, 8, .27)) < 1e-9);
});

test('a ball meets each row later than the one before, and the bin line last', () => {
  const times = galtonTimes({ rows: 8, rowGap: .3, fall: 26, bounce: .3, drop: .3 });
  assert.equal(times.length, 9);
  times.slice(1).forEach((t, i) => assert.ok(t > times[i]));
  assert.ok(times[0] > 0.1 && times[8] < 3);
});

test('a Lorenz orbit stands in the law\'s space as the shader lays it out: lobes along x, up y', () => {
  const points = lorenzPoints(1800);
  assert.equal(points.length, 1800);
  const ys = points.map(p => p.y), xs = points.map(p => p.x);
  // Z of 0…50 at 0.05 m a unit: about 2.5 m tall, above its origin; both lobes visited.
  assert.ok(Math.min(...ys) > 0 && Math.max(...ys) < 2.6 && Math.max(...ys) > 2);
  assert.ok(Math.min(...xs) < -.5 && Math.max(...xs) > .5);
});

test('the lab\'s gas catches as its own fire and its sparks see mirrors', () => {
  assert.equal(LAW_LAB_KINDS['ley-gas'].ignite.into, 'ley-llama');
  assert.ok(LAW_LAB_KINDS['ley-chispa'].mirror);
  assert.ok(MAX_LAWS >= 4);
});
