import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DUALS, FEAR_FOES, FEAR_RULES, ONIONS, SKILLS, VERTIGO } from '../src/battle.ts';
import { PROFILES } from '../src/stats.ts';
import { DUO, FIGHTS, MISSION_PARTY, TARGETS, catalogue, checkTargets, conclude, createFight, decide, dualBanned, legalChoices, playFight, seeded, simulate, sweep, wilson, withTuning } from '../src/battle-sim.ts';
import { JEV_URL, askJev, jevLines, jevRequest } from '../scripts/fight-sim-jev.mjs';
import { parseArguments, tunings } from '../scripts/fight-sim.mjs';

const setup = { fight: 'cebollon', party: MISSION_PARTY, levels: { papagato: 2 }, policy: 'smart' };

test('the same setup and seed give the same numbers, and another seed can differ', () => {
  assert.deepEqual(simulate(setup, 30, 7), simulate(setup, 30, 7));
  const packs = seed => simulate({ ...setup, fight: 'crias-3', policy: 'casual' }, 30, seed).rounds;
  assert.notEqual(packs(1), packs(99999));
});

test('every fight it lists can be played to an end, by every policy and both parties, with no illegal move', () => {
  for (const fight of FIGHTS) for (const policy of ['attack', 'random', 'casual', 'smart']) for (const party of [MISSION_PARTY, DUO]) {
    const run = playFight({ fight, party, levels: { papagato: 2, matemagico: 2 }, policy }, 11);
    assert.ok(['won', 'lost', 'draw'].includes(run.outcome), `${fight} ${policy} ${party}`);
    assert.ok(run.rounds >= 1);
  }
  assert.ok(FIGHTS.includes('escolta') && !FIGHTS.includes('game-over'), 'ring 3 is the escort; Game Over is gone');
});

const boss = { fight: 'uri-vertigo', party: DUO, levels: { papagato: 2, matemagico: 2 }, policy: 'smart' };
test('duals are offered with both halves learned and worn, and a ban keeps them out (all, one, or through a half)', () => {
  const state = createFight(boss, seeded(1));
  const duals = legalChoices(state, {}).filter(c => c.action === 'dual');
  assert.deepEqual([...new Set(duals.map(c => c.dual))].sort(), ['punto-debil', 'zarpazos-de-fuego']);
  assert.deepEqual([...new Set(duals.map(c => c.target))].sort(), ['ojo', 'vertigo'], 'at the body or its eye');
  assert.ok(!legalChoices(state, {}, true, false).some(c => c.action === 'dual'), 'not without asking for them');
  assert.ok(!legalChoices(state, { ban: ['duals'] }).some(c => c.action === 'dual'));
  assert.deepEqual([...new Set(legalChoices(state, { ban: ['zarpazos'] }).filter(c => c.action === 'dual').map(c => c.dual))], ['punto-debil'], 'a banned half bans its dual');
  assert.deepEqual([...new Set(legalChoices(state, { ban: ['punto-debil'] }).filter(c => c.action === 'dual').map(c => c.dual))], ['zarpazos-de-fuego']);
  assert.ok(dualBanned(DUALS.find(d => d.id === 'punto-debil'), ['angulo']));
  // Matemágico at level 1: no Ángulo exacto, so no Punto débil; Papagato at level 1: no Zarpazos, so no dual at all.
  assert.deepEqual([...new Set(legalChoices(createFight({ ...boss, levels: { papagato: 2 } }, seeded(1)), {}).filter(c => c.action === 'dual').map(c => c.dual))], ['zarpazos-de-fuego']);
  assert.ok(!legalChoices(createFight({ ...boss, levels: { matemagico: 2 } }, seeded(1)), {}).some(c => c.dual === 'zarpazos-de-fuego'));
  // Nobody wearing the other half (the mission party: Aitor wears nothing): no dual.
  assert.ok(!legalChoices(createFight({ ...boss, party: MISSION_PARTY }, seeded(1)), {}).some(c => c.action === 'dual'));
});

test('smart makes duals on purpose and casual only by chance (its partner had queued); a ban stops both', () => {
  const smart = simulate(boss, 30);
  assert.ok(smart.duals > 0 && (smart.used['zarpazos-de-fuego'] ?? 0) + (smart.used['punto-debil'] ?? 0) > 0, JSON.stringify(smart.used));
  const state = createFight({ ...boss, policy: 'casual' }, seeded(3)), random = seeded(4);
  for (let i = 0; i < 40; i++) assert.notEqual(decide(state, { ...boss, policy: 'casual' }, random).action, 'dual', 'casual never looks for a dual');
  assert.ok(simulate({ ...boss, policy: 'casual' }, 40).duals > 0, 'but its queue sometimes completes one');
  for (const policy of ['smart', 'casual']) {
    const banned = simulate({ ...boss, policy, ban: ['duals'] }, 20);
    assert.equal(banned.duals, 0, policy);
    assert.ok(!DUALS.some(d => banned.used[d.id]), policy);
  }
});

test('a row says how long wins take and how many duals a fight has; a target checks both, and a draw always fails', () => {
  const row = simulate(boss, 12);
  assert.ok(row.roundsWon === null || row.roundsWon >= 1);
  assert.ok(typeof row.duals === 'number' && row.events && typeof row.events === 'object');
  assert.ok((row.events.manotazo ?? 0) + (row.events.pisoton ?? 0) > 0, 'what the foes did is counted');
  const [held] = checkTargets([{ id: 'x', why: 'y', ...boss, duals: [0, 99], roundsWon: [1, 60] }], 12);
  assert.ok(held.pass, held.failures.join('; '));
  const [broken] = checkTargets([{ id: 'x', why: 'y', ...boss, duals: [50, 99] }], 12);
  assert.ok(!broken.pass && /duals/.test(broken.failures.join()));
  const [endless] = checkTargets([{ id: 'x', why: 'y', ...boss, maxRounds: 1 }], 4);
  assert.ok(!endless.pass && /sin acabar/.test(endless.failures.join()));
});

test('the tower\'s books can be tuned and are put back: duals, Vertitrón and its eye, the fears\' rules and powers', () => {
  const before = [DUALS[0].power, VERTIGO.pisoton, FEAR_RULES.escortLayers, FEAR_FOES.plato.power, PROFILES['vertigo-ojo'].pv];
  const tuning = { 'dual.zarpazos-de-fuego.power': 1, 'vertigo.boss.pisoton': 40, 'fear.rules.escortLayers': 1, 'fear.plato.power': 1, 'foe.vertigo-ojo.pv': 5 };
  withTuning(tuning, () => {
    assert.deepEqual([DUALS[0].power, VERTIGO.pisoton, FEAR_RULES.escortLayers, FEAR_FOES.plato.power, PROFILES['vertigo-ojo'].pv], [1, 40, 1, 1, 5]);
    assert.equal(createFight({ fight: 'escolta', party: DUO, policy: 'smart' }, seeded(1)).foes[0].layers, 1);
  });
  assert.deepEqual([DUALS[0].power, VERTIGO.pisoton, FEAR_RULES.escortLayers, FEAR_FOES.plato.power, PROFILES['vertigo-ojo'].pv], before);
  assert.throws(() => withTuning({ 'vertigo.boss.nada': 1 }, () => {}), /Nothing to tune/);
  // Only El Plato hits with its own power: the onions' and Vertitrón's would change nothing, so they are no knob.
  for (const path of ['fear.escolta.power', 'fear.cebolla.power', 'fear.cebollon.power', 'fear.uri-vertigo.power']) assert.throws(() => withTuning({ [path]: 300 }, () => {}), /Nothing to tune/);
});

test('the conclusions flag a dual smart could make and never does', () => {
  const row = simulate({ ...boss, ban: ['duals'] }, 4);
  const lines = conclude([{ ...row, ban: [], used: { attack: 10 } }]);
  assert.ok(lines.some(line => /nunca hace.*Zarpazos de fuego/.test(line)), lines.join('\n'));
});

test('a banned skill is never used, and a skill not learned yet is not offered', () => {
  const banned = simulate({ ...setup, ban: ['zarpazos'] }, 20);
  assert.equal(banned.used.zarpazos, undefined);
  assert.ok(simulate(setup, 20).used.zarpazos > 0, 'allowed, the best bot uses it');
  const state = createFight({ ...setup, levels: { papagato: 1 } }, seeded(1));
  assert.ok(!legalChoices(state, {}).some(c => c.skill === 'zarpazos'));
});

test('the bots only ever choose what is on the list of legal moves', () => {
  const state = createFight(setup, seeded(2)), random = seeded(3);
  for (const policy of ['attack', 'random', 'casual', 'smart']) {
    const options = legalChoices(state, {}).map(o => JSON.stringify(o));
    assert.ok(options.includes(JSON.stringify(decide(state, { ...setup, policy }, random))), policy);
  }
});

test('deciding leaves the fight as it was: bots think on a copy', () => {
  const state = createFight(setup, seeded(4)), before = structuredClone(state);
  decide(state, setup, seeded(5));
  assert.deepEqual(state, before);
});

test('the fights are what they are meant to be (just fight-sim check)', () => {
  for (const result of checkTargets(TARGETS, 80)) assert.ok(result.pass, `${result.id}: ${result.failures.join('; ')}. ${result.why}`);
});

test('tuning changes the numbers for one simulation only, and a misspelt one is an error', () => {
  const layers = ONIONS.cebollon.layers, pv = PROFILES.cebollon.pv, strikes = SKILLS.find(s => s.id === 'zarpazos').strikes;
  const tuned = simulate(setup, 10, 35, { 'onion.cebollon.layers': 2, 'foe.cebollon.pv': 20, 'skill.zarpazos.strikes': 1 });
  assert.deepEqual(tuned.tuning, { 'onion.cebollon.layers': 2, 'foe.cebollon.pv': 20, 'skill.zarpazos.strikes': 1 });
  assert.ok(tuned.rounds < simulate(setup, 10).rounds);
  assert.equal(ONIONS.cebollon.layers, layers); assert.equal(PROFILES.cebollon.pv, pv); assert.equal(SKILLS.find(s => s.id === 'zarpazos').strikes, strikes);
  assert.throws(() => withTuning({ 'onion.cebollon.capas': 3 }, () => {}), /Nothing to tune/);
  assert.equal(ONIONS.cebollon.layers, layers);
});

test('combinations multiply, and the conclusions say what changed the result', () => {
  const rows = sweep({ fights: ['cebollon'], parties: [MISSION_PARTY, 'gerard:papagato'], levels: [{ papagato: 1 }, { papagato: 2 }], policies: ['smart'], bans: [[], ['zarpazos']] }, { runs: 12 });
  assert.equal(rows.length, 2 * 2 * 2);
  const lines = conclude(rows);
  assert.ok(lines.some(line => /papagato 1 gana 0 %; papagato 2 gana 100 %/.test(line)), lines.join('\n'));
  assert.ok(lines.some(line => /sin zarpazos gana 0 %/.test(line)), lines.join('\n'));
});

test('Wilson\'s interval holds the observed share and narrows with more fights', () => {
  const [low, high] = wilson(50, 100);
  assert.ok(low < .5 && high > .5);
  const [low2, high2] = wilson(500, 1000);
  assert.ok(high2 - low2 < high - low);
});

test('the command line reads lists, numbers to tune and rejects what it does not know', () => {
  const options = parseArguments(['run', '--fight', 'a,b', '--runs=9', '--tune', 'onion.cebollon.layers=10:12', '--json']);
  assert.deepEqual(options.fights, ['a', 'b']);
  assert.equal(options.runs, 9);
  assert.equal(options.json, true);
  assert.deepEqual(tunings(options.tune), [{ 'onion.cebollon.layers': 10 }, { 'onion.cebollon.layers': 12 }]);
  assert.deepEqual(tunings(), [{}]);
  assert.throws(() => parseArguments(['run', '--nada']), /desconocida/);
  assert.throws(() => parseArguments(['run', '--runs', 'muchos']), /número/);
  assert.throws(() => parseArguments(['run', '--tune', 'onion.cebollon.layers']), /--tune/);
});

const cli = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/fight-sim.mjs', ...args], { encoding: 'utf8', env: { ...process.env, TYPESAFE_API_KEY: '' } });
test('--json gives only JSON, for another program to read; list says what there is', () => {
  const run = cli('run', '--fight', 'cebollon', '--level', 'papagato=1,papagato=2', '--policy', 'smart', '--runs', '6', '--json');
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.rows.length, 2);
  assert.ok(Array.isArray(report.conclusions));
  const list = JSON.parse(cli('list').stdout);
  assert.deepEqual(list.fights, JSON.parse(JSON.stringify(catalogue().fights)));
  assert.ok(list.skills.some(s => s.id === 'zarpazos' && s.level === 2));
  assert.ok(list.duals.some(d => d.id === 'zarpazos-de-fuego' && d.parts.includes('foc-binari')));
  assert.equal(list.dualParty, DUO);
  assert.ok(['dual', 'vertigo', 'fear'].every(book => list.books.includes(book)));
});

test('a misspelt option or fight fails instead of looking like a result', () => {
  assert.equal(cli('run', '--nada').status, 2);
  assert.equal(cli('run', '--fight', 'nada').status, 2);
  assert.equal(cli('nada').status, 2);
});

test('Jev is only asked when asked for: --jev-dry-run shows the request and sends nothing, --jev without a key says so', () => {
  const dry = cli('run', '--fight', 'cebollon', '--level', 'papagato=2', '--policy', 'smart', '--runs', '4', '--jev-dry-run', '--json');
  assert.equal(dry.status, 0, dry.stderr);
  const request = JSON.parse(dry.stdout).jevRequest;
  assert.equal(request.model, 'jev-latest');
  assert.ok(request.questions.dynamic_holds && request.questions.next_lever && request.questions.difficulty_cebollon);
  const missing = cli('run', '--fight', 'cebollon', '--runs', '2', '--level', 'papagato=2', '--policy', 'smart', '--jev');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /TYPESAFE_API_KEY/);
});

test('the request to Jev follows its API: score levels in order, choice criteria by name', () => {
  const { questions, state } = jevRequest({ rows: [simulate(setup, 2)], conclusions: ['una'] });
  assert.deepEqual(state.conclusions, ['una']);
  assert.equal(state.results[0].fight, 'cebollon');
  for (const question of Object.values(questions)) {
    assert.ok(['noul', 'score', 'choice'].includes(question.type));
    assert.ok(question.instructions);
    if (question.type === 'score') assert.ok(Array.isArray(question.criteria) && question.criteria.length >= 2 && question.criteria.length <= 10);
    if (question.type === 'choice') assert.ok(!Array.isArray(question.criteria) && Object.keys(question.criteria).length >= 1);
  }
  assert.ok(Object.keys(questions).every(id => /^[a-z0-9_]+$/i.test(id)));
});

test('asking Jev goes to its endpoint with the key, and reads its answers', async () => {
  let sent;
  const fetcher = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ model: 'jev-x', usage: { input_tokens: 3 }, answers: {
      dynamic_holds: { type: 'noul', noul: .9 },
      next_lever: { type: 'choice', choice: 'none', confidence: .8, probabilities: { none: .8 } },
      fairness: { type: 'score', score: 2.1, confidence: .6, legend: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' }, probabilities: {} },
    } }) };
  };
  const answer = await askJev({ rows: [] }, { apiKey: 'k', fetcher });
  assert.equal(sent.url, JEV_URL);
  assert.equal(sent.options.headers.Authorization, 'Bearer k');
  assert.equal(answer.model, 'jev-x');
  const lines = jevLines(answer).join('\n');
  assert.match(lines, /dynamic_holds: 90 % sí/);
  assert.match(lines, /next_lever: none/);
  assert.match(lines, /fairness: 2.10 de 3/);
  await assert.rejects(askJev({ rows: [] }, { apiKey: 'k', fetcher: async () => ({ ok: false, status: 401, text: async () => 'no' }) }), /401/);
  await assert.rejects(askJev({ rows: [] }, {}), /TYPESAFE_API_KEY/);
});
