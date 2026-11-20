import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// scripts/integration.mjs (`just progress --audit`) reads the game's registries against each other.
// What it calls broken must never be: something in the game that the picker or the justfile misses.

const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/integration.mjs', '--json'], { encoding: 'utf8' });

test('the integration audit reads the whole game and nothing in it is broken', () => {
  const { sections } = JSON.parse(run.stdout);
  assert.deepEqual(sections.map(s => s.id), ['selector', 'combates', 'lugares', 'animas', 'gente', 'codigo']);
  for (const section of sections.filter(s => s.kind === 'broken')) assert.deepEqual(section.gaps, [], section.title);
  assert.equal(run.status, 0);
});

test('it sees work that is known to be left: fights without their pair of targets, ánimas that do not grow', () => {
  const { sections } = JSON.parse(run.stdout);
  const gaps = id => sections.find(s => s.id === id).gaps;
  for (const gap of gaps('combates')) assert.match(gap, /^[\w:-]+: (sin objetivos|solo )/);
  for (const gap of gaps('animas')) assert.match(gap, /ninguna ánima que vestir|ni niveles ni árbol|sin aprender nada/);
  for (const gap of gaps('codigo')) assert.match(gap, /nadie lo (usa|importa)$/);
});
