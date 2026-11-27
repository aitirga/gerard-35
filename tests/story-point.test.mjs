import { CASTLE_LIGHTS, PUZZLE_LIGHTS, ROOM_LIGHTS, STRONG_LIGHTS } from '../src/castle.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDS, MISSIONS, MISSION_IDS, missionOf, storyPoint, storyRows } from '../src/battle-sim.ts';
import { FEAR_ENCOUNTERS } from '../src/battle.ts';
import { costOf, improvementOf } from '../src/ecos.ts';
import { LIGHTS } from '../src/story.ts';

test('every mission fight is a real fight, and the missions give every light there is', () => {
  for (const id of MISSION_IDS) for (const fight of MISSIONS[id].fights) { assert.ok(FEAR_ENCOUNTERS.includes(fight), fight); assert.equal(missionOf(fight), id); }
  // The rest are the castle's: those its bosses give back (src/castle.ts).
  // And the Encarnados', which nobody gives: they are taken, one a day (src/castle.ts `STRONG_LIGHTS`).
  assert.equal(MISSION_IDS.reduce((sum, id) => sum + MISSIONS[id].lights, 0) + Object.values(CASTLE_LIGHTS).flat().length + STRONG_LIGHTS.length + ROOM_LIGHTS.length + PUZZLE_LIGHTS.length, LIGHTS.length);
});

test('the introduction has nothing behind it; an open mission has the introduction and whatever was done before', () => {
  const intro = storyPoint('nuria');
  assert.deepEqual([intro.done, intro.ecos, intro.setup.friends, intro.setup.improved], [[], 0, [], []]);
  const first = storyPoint('marta:first'), last = storyPoint('marta:last'), named = storyPoint('marta:universidad/emilie/luca');
  assert.deepEqual(first.setup.friends, ['nuria']); assert.equal(first.ecos, 4); assert.equal(first.setup.levels.papagato, 2);
  assert.deepEqual(last.setup.friends, ['nuria', 'universidad', 'emilie', 'luca']); assert.equal(last.ecos, 18, 'two ecos from each friend');
  // Levels come from the EXP behind the point (STRETCH_XP against LEVEL_XP), under the castle's cap: three more missions take Papagato to 4.
  assert.equal(last.setup.levels.papagato, 4); assert.ok(last.setup.levels.dadaista >= 2 && first.setup.levels.dadaista === undefined);
  assert.deepEqual(named.setup, last.setup);
  assert.throws(() => storyPoint('marta:marta'), /cannot be behind/);
  assert.throws(() => storyPoint('nadie'), /Unknown mission/);
  assert.throws(() => storyPoint('marta', 'todo'), /Unknown build/);
});

test('a build is a shopping list of real nodes, and a point buys only what its ecos pay for', () => {
  // A definitiva whose move is not built yet is a real place kept, veiled: a build can name it, and it is bought once it is built.
  for (const [name, list] of Object.entries(BUILDS)) for (const id of list) assert.ok(improvementOf(id) && (!improvementOf(id).veiled || improvementOf(id).kind === 'ulti'), `${name}: ${id}`);
  for (const id of storyPoint('castillo-3', 'mixto').setup.improved) assert.ok(!improvementOf(id).veiled, `castillo-3 buys ${id}`);
  for (const build of Object.keys(BUILDS)) for (const at of ['marta:first', 'marta:last', 'universidad:last']) {
    const point = storyPoint(at, build);
    assert.ok(costOf(point.setup.improved) <= point.ecos, `${at} ${build}`);
  }
  assert.deepEqual(storyPoint('marta:last', 'nada').setup.improved, []);
});

test('a story point plays its mission\'s fights with its own party', () => {
  const rows = storyRows([storyPoint('marta:first')], ['smart'], { fights: ['cuerdas-directo', 'campeon'], runs: 4 });
  assert.deepEqual(rows.map(r => r.row.fight), ['cuerdas-directo']);
  assert.deepEqual(rows[0].row.friends, ['nuria']);
});

test('the balance report carries every mission fight at every point, and its page embeds the data', async () => {
  const { balanceData, balancePage } = await import('../scripts/fight-sim-report.mjs');
  const data = await balanceData({ runs: 2, builds: ['nada'] });
  for (const id of MISSION_IDS) for (const fight of MISSIONS[id].fights) assert.ok(data.cells.some(c => c.fight === fight && c.smart && c.casual), fight);
  assert.equal(data.cells.filter(c => c.fight === 'voz').length, 2);
  assert.ok(data.numbers['marta.rules.clavado'] > 0 && data.targets.length > 0 && data.affinities.length > 0);
  const page = balancePage(data, data);
  assert.match(page, /Balance de combates/); assert.ok(page.includes('"cuerdas-directo"'));
});
