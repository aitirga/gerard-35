import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, STATUS_KINDS, STATUS_LOOKS } from '../src/status-fx.ts';
import { STATUSES } from '../src/battle.ts';

// docs/combat.md ("Dos familias de elementos"): the physical statuses the combat design decided.
const DECIDED = ['quemado', 'mojado', 'congelado', 'envenenado', 'sangrado', 'cegado', 'paralizado'];
// The engine's own kinds the looks may use besides their own (src/effects.ts FIGHT_KINDS).
const ENGINE = ['spark', 'ember', 'crackle', 'arc', 'mote', 'twinkle', 'frost', 'shard', 'flare'];

test('every status the combat design decided, and the campaign has, has a look', () => {
  for (const id of [...DECIDED, ...Object.keys(STATUSES)]) assert.ok(STATUS_LOOKS[id], `no look for ${id}`);
});

test('every reaction starts from a status with a look, and leaves one when it leaves a status', () => {
  for (const [id, r] of Object.entries(REACTIONS)) {
    assert.ok(STATUS_LOOKS[r.status], `${id} starts from ${r.status}`);
    assert.ok(r.shows.length > 20 && r.element, `${id} says what it shows and which element sets it off`);
  }
  // The ten reactions of the design's table.
  assert.equal(Object.keys(REACTIONS).length, 10);
});

test('looks are only sparks, drops, crystals and haze: no particle drawn as a flame or a puff', () => {
  for (const [name, kind] of Object.entries(STATUS_KINDS)) assert.ok(!['flame', 'smoke'].includes(kind.shape), `${name} is a ${kind.shape}`);
  for (const [id, look] of Object.entries(STATUS_LOOKS)) {
    for (const stream of [...look.streams, ...(look.pulse?.streams ?? [])]) {
      assert.ok(STATUS_KINDS[stream.kind] || ENGINE.includes(stream.kind), `${id} throws an unknown kind: ${stream.kind}`);
      assert.equal(stream.rate.length, 3, `${id}: a rate for each level`);
      assert.ok(stream.rate[0] <= stream.rate[1] && stream.rate[1] <= stream.rate[2], `${id}: more at higher levels`);
    }
    assert.ok(look.seconds > 0 && look.shows.length > 20, `${id}: lasts and says what it shows`);
    assert.ok(look.fire || look.streams.length || look.pulse, `${id} shows something`);
  }
});
