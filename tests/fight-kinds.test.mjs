import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGHT_KINDS } from '../src/effects.ts';
import { MAX_KINDS } from '../src/fight-particles.ts';
import { DUAL_KINDS } from '../src/dual-fx.ts';
import { STATUS_KINDS } from '../src/status-fx.ts';
import { DISINTEGRATE_KINDS } from '../src/disintegrate.ts';

// Every table the fight's GPU particles register (src/fight-particles.ts `define`). They share one
// namespace: a name in two tables keeps only the first look, and one too many stops the fight.
const TABLES = { FIGHT_KINDS, DUAL_KINDS, STATUS_KINDS, DISINTEGRATE_KINDS };

test('no two particle tables define the same kind', () => {
  const owner = new Map();
  for (const [table, kinds] of Object.entries(TABLES)) for (const name of Object.keys(kinds)) {
    assert.ok(!owner.has(name), `«${name}» is in ${owner.get(name)} and ${table}`);
    owner.set(name, table);
  }
});

test('every particle kind fits in the engine at once', () => {
  const total = Object.values(TABLES).reduce((sum, kinds) => sum + Object.keys(kinds).length, 0);
  assert.ok(total <= MAX_KINDS, `${total} kinds, the engine holds ${MAX_KINDS}`);
});
