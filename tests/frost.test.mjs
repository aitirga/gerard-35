import test from 'node:test';
import assert from 'node:assert/strict';
import { FROST, FROST_STEP, frostDomain, frostSteps } from '../src/frost-fx.ts';
import { FREATICA_SKILLS } from '../src/freatica-fight.ts';

// Bajo cero's moment (src/frost-fx.ts): where its field lies, how many steps a frame plays, and its compute shader.
test('The frost field covers the caster and every cell, square, with room round them', () => {
  const d = frostDomain({ caster: { x: 0, y: 0, z: 0 }, cells: [{ at: { x: 4, y: 0, z: 1 }, half: .6 }, { at: { x: 3, y: 0, z: -2 }, half: .5 }] });
  assert.ok(d.x <= -FROST.margin + 1e-9 && d.x + d.side >= 4.6 + FROST.margin - 1e-9);
  assert.ok(d.z <= -2.5 - FROST.margin + 1e-9 && d.z + d.side >= 1.6 + FROST.margin - 1e-9);
});

test('A frame plays an even number of steps, more for a longer frame, never past the most', () => {
  assert.equal(frostSteps(1 / 120) % 2, 0);
  assert.ok(frostSteps(1 / 60) > frostSteps(1 / 120));
  assert.equal(frostSteps(1), FROST.most);
  assert.ok(frostSteps(0) >= 2);
});

test('The cells lock as the rule lands, and the moment plays to its end', () => {
  assert.equal(FREATICA_SKILLS['bajo-cero'].contact, FROST.lock);
  assert.equal(FREATICA_SKILLS['bajo-cero'].end, FROST.end);
  assert.ok(FROST.drop < FROST.front && FROST.front < FROST.lock && FROST.lock < FROST.end);
});

test('The compute shader names nothing WGSL reserves, guards atan2 at a flat field, and writes rgba16float', () => {
  // A reserved word anywhere breaks the whole shader (WGSL § Reserved words): the ones a name here could fall into.
  for (const word of ['target', 'filter', 'smooth', 'self', 'set', 'get', 'shared', 'type', 'from', 'move', 'pass', 'common', 'meta', 'module', 'resource', 'handle', 'cast', 'final', 'use', 'with', 'where', 'new', 'of', 'do', 'enum', 'mut', 'ref', 'static', 'union', 'using', 'macro', 'layout', 'precision', 'patch', 'std']) {
    assert.ok(!new RegExp(`\\b(let|var|fn|const)\\s+${word}\\b`).test(FROST_STEP), word);
  }
  assert.match(FROST_STEP, /select\(0\.0, atan2\(gy, gx\), gx \* gx \+ gy \* gy > 1e-8\)/);
  assert.match(FROST_STEP, /texture_storage_2d<rgba16float, write>/);
  assert.match(FROST_STEP, /const N: i32 = 256;/);
});
