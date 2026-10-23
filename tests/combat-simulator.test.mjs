import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { availableActions, createCombat, stepCombat } from '../src/combat/engine.ts';
import { createBenchmarkEncounter } from '../src/combat/fixtures.ts';
import {
  POLICY_IDS, buildSimulationReport, choosePolicyAction, comparePolicies, createRunSeeds,
  createSimulationEncounter, normalizeConfig, runSimulation, simulateRun, summarizeRuns, wilsonInterval,
} from '../src/combat/simulator.ts';

function duel(options = {}) {
  return {
    id: 'simulator-test',
    combatants: [
      { id: 'p', team: 'party', stats: { speed: 2 }, resources: { hp: { max: 20 }, energy: { max: 10 } }, actions: ['hit', 'skill'] },
      { id: 'e', team: 'opponent', stats: { speed: 1 }, resources: { hp: { max: 20 }, energy: { max: 10 } }, actions: ['hit'] },
    ],
    actions: {
      hit: { target: 'enemy', effects: [{ kind: 'damage', amount: 6 }] },
      skill: { target: 'enemy', costs: { energy: 3 }, effects: [{ kind: 'damage', amount: 12 }] },
    },
    ...options,
  };
}

test('configuration and seed generation reject unbounded or ambiguous inputs', () => {
  for (const bad of [{ runs: 0 }, { runs: 10001 }, { runs: 1.5 }, { seed: -1 }, { seed: 2 ** 32 }, { enemyHp: NaN }, { enemyPower: Infinity }, { maxRounds: 501 }, { policy: 'unknown' }, { enemyPolicy: '' }, { typo: 1 }]) assert.throws(() => normalizeConfig(bad));
  assert.deepEqual(createRunSeeds(0, 3), [0, 1013904223, 1196435762]);
  assert.equal(createRunSeeds(123, 1)[0], 123);
  assert.equal(new Set(createRunSeeds(3517, 10000)).size, 10000);
});

test('reports are deterministic and every saved seed can be replayed exactly', () => {
  const config = normalizeConfig({ runs: 12, seed: 19042, policy: 'random', enemyPolicy: 'tactical' });
  const report = runSimulation(config);
  assert.deepEqual(report, runSimulation(config));
  assert.equal(report.version, '1.0.0');
  assert.equal(report.engineSchemaVersion, 1);
  assert.ok(report.sampleReplay.events.some(event => event.type === 'damage'));
  assert.equal(report.runs[0].replay, undefined, 'replay is not duplicated in run records');
  for (const index of [0, 5, 11]) {
    const rerun = simulateRun(config, report.runs[index].seed, report.encounter, true);
    const { replay, ...record } = rerun;
    assert.deepEqual(record, report.runs[index]);
    let state = createCombat(report.encounter, record.seed);
    for (const command of replay.commands) {
      const next = stepCombat(report.encounter, state, command);
      assert.equal(next.accepted, true);
      state = next.state;
    }
    assert.deepEqual(state, replay.finalState, 'saved commands replay without policy code or hidden RNG state');
  }
});

test('policy comparisons use identical seed lists and preserve independent report configurations', () => {
  const result = comparePolicies({ runs: 7, seed: 44 }, duel());
  assert.deepEqual(result.reports.map(report => report.config.policy), POLICY_IDS);
  for (const report of result.reports) {
    assert.deepEqual(report.seeds, result.seeds);
    assert.equal(report.summary.wins + report.summary.losses + report.summary.draws, 7);
    assert.equal(report.config.enemyPolicy, 'tactical');
  }
});

test('every policy selects legal commands through status, resource and cooldown changes', () => {
  const definition = createBenchmarkEncounter();
  for (const policy of POLICY_IDS) {
    let state = createCombat(definition, 800);
    let seed = 73;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    let actions = 0;
    while (state.status === 'active') {
      const command = choosePolicyAction(definition, state, policy, random);
      assert.ok(availableActions(definition, state).some(choice => JSON.stringify(choice) === JSON.stringify(command)));
      const next = stepCombat(definition, state, command);
      assert.equal(next.accepted, true);
      state = next.state;
      assert.ok(++actions <= 3000);
    }
    assert.equal(choosePolicyAction(definition, state, policy), undefined);
  }
});

test('tactical policy heals critical allies and respects immunity under mixed affinity policies', () => {
  const definition = duel();
  definition.actions.heal = { target: 'ally', costs: { energy: 2 }, effects: [{ kind: 'heal', amount: 30 }] };
  definition.combatants[0].actions.push('heal');
  definition.combatants[0].resources.hp = { max: 50, current: 5 };
  let state = createCombat(definition, 1);
  assert.equal(choosePolicyAction(definition, state, 'tactical').actionId, 'heal');
  definition.rules = { affinityPolicy: 'highest' };
  definition.actions.hit.effects[0].tags = ['immune', 'weak'];
  definition.combatants[1].affinities = { immune: 0, weak: 3 };
  definition.combatants[0].resources.hp = { max: 50 };
  definition.combatants[0].resources.energy = { max: 10 };
  state = createCombat(definition, 1);
  assert.equal(choosePolicyAction(definition, state, 'tactical').actionId, 'skill');
});

test('enemy HP and direct damage tuning are independent and do not mutate shared player content', () => {
  const baseline = createBenchmarkEncounter();
  const before = structuredClone(baseline);
  const config = normalizeConfig({ enemyHp: 1.5, enemyPower: 2 });
  const tuned = createSimulationEncounter(config, baseline);
  assert.deepEqual(baseline, before);
  assert.deepEqual(tuned.combatants.filter(actor => actor.team === 'party'), before.combatants.filter(actor => actor.team === 'party'));
  assert.deepEqual(tuned.actions.strike, baseline.actions.strike);
  assert.deepEqual(tuned.statuses, baseline.statuses);
  const enemy = tuned.combatants.find(actor => actor.team !== 'party');
  assert.equal(enemy.resources.hp.max, 116 * 1.5);
  assert.equal(tuned.actions[enemy.actions[0]].effects[0].amount.base, 20);
  assert.equal(tuned.actions[enemy.actions[0]].effects[0].amount.targetScale, -2);
  const report = runSimulation({ runs: 1, enemyHp: 1.5, enemyPower: 2 }, baseline);
  const { replay: _replay, ...reproduced } = simulateRun(report.config, report.seeds[0], report.encounter, true);
  assert.deepEqual(reproduced, report.runs[0], 'resolved snapshot is not tuned a second time');
});

test('rates use all outcomes and Wilson interval handles zero/all wins', () => {
  const template = { seed: 1, rounds: 4, actions: 12, partyHpRemaining: .5, partyCasualties: 1, resourceSpent: 4, resourceSpentById: { energy: 4 } };
  const records = [
    { ...template, outcome: 'win', winner: 'party', reason: 'victory' },
    { ...template, outcome: 'loss', winner: 'opponent', reason: 'victory' },
    { ...template, outcome: 'draw', reason: 'round-limit' },
    { ...template, outcome: 'draw', reason: 'action-limit' },
  ];
  const summary = summarizeRuns(records);
  assert.equal(summary.winRate, .25);
  assert.equal(summary.lossRate, .25);
  assert.equal(summary.drawRate, .5);
  assert.deepEqual(summary.drawReasons, { 'round-limit': 1, 'action-limit': 1 });
  assert.equal(summary.meanActions, 12);
  assert.deepEqual(summary.meanResourceSpentById, { energy: 4 });
  const none = wilsonInterval(0, 10);
  const all = wilsonInterval(10, 10);
  assert.ok(none[0] < 1e-15 && none[1] > .27 && none[1] < .28);
  assert.ok(all[0] > .72 && all[0] < .73 && all[1] > 1 - 1e-15);
  assert.throws(() => wilsonInterval(1, 0));
  assert.throws(() => summarizeRuns([]));
});

test('round limits, gross resource costs and partial-batch reports are explicit', () => {
  const report = runSimulation({ runs: 3, maxRounds: 1 }, duel());
  assert.equal(report.summary.draws, 3);
  assert.deepEqual(report.summary.drawReasons, { 'round-limit': 3 });
  assert.equal(report.summary.meanResourceSpent, 3);
  assert.deepEqual(report.summary.meanResourceSpentById, { energy: 3 });
  assert.ok(report.runs.every(run => run.rounds === 1 && run.actions === 2));
  const partial = buildSimulationReport(report.config, report.runs.slice(0, 1), report.encounter);
  assert.equal(partial.config.runs, 3);
  assert.equal(partial.runs.length, 1);
  assert.equal(partial.summary.drawRate, 1);
});

test('custom definitions must use two teams and the explicit party convention', () => {
  const definition = duel();
  definition.combatants[0].team = 'hero';
  assert.throws(() => runSimulation({ runs: 1 }, definition), /party/);
});

test('CLI help, invalid inputs and exported report work through the real entry point', async () => {
  const cli = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/combat-sim.mjs', ...args], { encoding: 'utf8' });
  assert.equal(cli('--help').status, 0);
  assert.match(cli('--help').stdout, /--enemy-policy/);
  for (const args of [['--runs', '0'], ['--seed', '-1'], ['--unknown'], ['--out'], ['--enemy-policy', 'missing'], ['--runs', '']]) assert.notEqual(cli(...args).status, 0);
  const directory = await mkdtemp(join(tmpdir(), 'combat-simulator-'));
  try {
    const output = join(directory, 'report.json');
    const input = join(directory, 'encounter.json');
    await writeFile(input, JSON.stringify(duel()), 'utf8');
    const result = cli('--runs=2', '--seed=31', '--compare', '--encounter', input, '--out', output);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.reports.length, 3);
    assert.equal(report.seeds[0], 31);
    assert.equal(report.reports[0].encounter.id, 'simulator-test');
    assert.ok(report.reports.every(item => item.sampleReplay.events.length > 0));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
