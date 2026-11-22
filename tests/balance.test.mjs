import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMA_GROWTH, animaGrowth } from '../src/animas.ts';
import { FIGHT_GROWTH, FOE_GROWTH, createEncounter, gatheredFor, growthOf, kitIn } from '../src/battle.ts';
import { CASTLE_UNLOCKS } from '../src/castle.ts';
import { FOE_XP, LEVEL_XP, XP_RULES, fightXp } from '../src/levels.ts';
import { improvementOf, stageOf } from '../src/ecos.ts';
import { CASTLE_STAGES, CASTLE_STAGE_IDS, DUO, MISSION_PARTY, STRETCHES, STRETCH_IDS, TARGETS, createFight, fullKit, playRuns, seeded, simulate, storyJobs, storyPoint, stretchOf, tallyRuns, tunables, watchReads, withTuning } from '../src/battle-sim.ts';
import { coverage, inScope, inline, levers, miss, optimize, pairGoals, progressLines, readsOf, skillReport, targetGoals, variable } from '../src/balance.ts';
import { parseArguments } from '../scripts/fight-sim.mjs';
import { createPool } from '../scripts/fight-sim-pool.mjs';

const onion = { fight: 'cebollon', party: MISSION_PARTY, levels: { papagato: 2 }, policy: 'smart' };
const row = extra => ({ runs: 100, draws: 0, win: .5, roundsWon: 5, roundsLost: 5, hpLeftWon: .5, duals: 0, ...extra });

test('the loss is nothing inside a range, grows with the distance outside it, and a fight that never ends always costs', () => {
  assert.equal(miss({ win: [.9, 1] }, row({ win: .97 })), 0);
  assert.ok(Math.abs(miss({ win: [.9, 1] }, row({ win: .7 })) - 2) < 1e-9, 'twenty points out are two steps');
  assert.ok(miss({ win: [0, .2] }, row({ win: .5 })) > miss({ win: [0, .2] }, row({ win: .3 })));
  // On the line of a range that has room: a little, so the search ends inside it. At a wall (0 or 100 %), nothing.
  assert.ok(miss({ win: [.4, .7] }, row({ win: .4 })) > 0 && miss({ win: [.4, .7] }, row({ win: .4 })) < .1);
  assert.equal(miss({ win: [0, .2] }, row({ win: 0 })), 0);
  assert.ok(miss({ roundsWon: [6, 12] }, row({ roundsWon: 4 })) > 0 && miss({ roundsWon: [6, 12] }, row({ roundsWon: null })) === 0);
  assert.ok(miss({}, row({ draws: 10 })) >= 1);
});

test('a variable has a range and a step: given, or 40 % either side of what the number is now', () => {
  const pv = variable('foe.cebollon.pv');
  assert.deepEqual([pv.now, pv.min, pv.max, pv.step], [tunables()['foe.cebollon.pv'], 90, 210, 1]);
  assert.deepEqual(variable('foe.cebollon.pv', '100..200/10'), { path: 'foe.cebollon.pv', now: 150, min: 100, max: 200, step: 10 });
  assert.ok(variable('element.rules.weak').step < 1, 'a share moves by less than one');
  assert.throws(() => variable('foe.nadie.pv'), /Nothing to tune/);
  assert.throws(() => variable('foe.cebollon.pv', '200..100'), /range/);
  assert.deepEqual(parseArguments(['optimize', '--vary', 'foe.voz.pv=500..800', '--vary', 'marta.rules.vozRe', '--auto', '3', '--pairs']).vary, { 'foe.voz.pv': '500..800', 'marta.rules.vozRe': undefined });
});

test('the search finds numbers that hold the goals, changes as little as it can, and checks them with another seed', async () => {
  // A made-up fight: `smart` always wins, `casual` wins less the more PV the onion has.
  const fake = async jobs => jobs.map(job => row({ runs: job.runs, win: job.setup.policy === 'smart' ? 1 : Math.max(0, Math.min(1, 1 - ((job.tuning['foe.cebollon.pv'] ?? 150) - 100) / 100)) }));
  const goals = [{ id: 'bien', setup: onion, want: { win: [.9, 1] } }, { id: 'sin-pensar', setup: { ...onion, policy: 'casual' }, want: { win: [0, .2] } }];
  const found = await optimize({ variables: [variable('foe.cebollon.pv', '100..250'), variable('foe.cebollon.fuerza')], goals, play: fake, budget: 80 });
  assert.ok(found.start.missed > 2, 'casual wins half as it stands');
  assert.equal(found.best.missed, 0);
  assert.ok(found.best.tuning['foe.cebollon.pv'] >= 180 && found.best.tuning['foe.cebollon.pv'] <= 190, `the least PV that holds, not the most: ${found.best.tuning['foe.cebollon.pv']}`);
  assert.equal(found.best.tuning['foe.cebollon.fuerza'], tunables()['foe.cebollon.fuerza'], 'a number that changes nothing stays where it is');
  assert.equal(found.checked.best.missed, 0); assert.ok(found.checked.seed !== found.seed && found.tried <= 80 && found.trail.length > 0);
  // Already held: nothing moves.
  const still = await optimize({ variables: [variable('foe.cebollon.pv', '100..250')], goals: [goals[0]], play: fake });
  assert.equal(still.best.tuning['foe.cebollon.pv'], 150);
});

test('a fight says which numbers it reads, and watching leaves every number as it was', () => {
  const before = JSON.stringify(tunables()), read = readsOf(onion);
  assert.ok(read.has('onion.cebollon.layers') && read.has('foe.cebollon.pv') && read.has('skill.zarpazos.strikes'));
  assert.ok(!read.has('foe.vertigo.pv') && !read.has('marta.rules.vozRe'));
  assert.equal(JSON.stringify(tunables()), before);
  assert.equal(watchReads(() => 7).result, 7);
  assert.deepEqual(simulate(onion, 6, 3), simulate(onion, 6, 3), 'and the fights play the same after');
  assert.ok(inScope('foe.cebollon.pv', 'fight') && !inScope('skill.zarpazos.strikes', 'fight') && inScope('skill.zarpazos.strikes', 'party') && !inScope('foe.cebollon.pv', 'party'));
  assert.ok(inScope('foe.aitor.pv', 'party') && !inScope('element.rules.weak', 'fight') && inScope('element.rules.weak', 'all'));
});

test('levers move each number down and up and say what that does to each goal', async () => {
  const goals = targetGoals(TARGETS.filter(t => t.id === 'cebollon-nivel-2-bien' || t.id === 'cebollon-nivel-1'));
  const found = await levers({ goals, play: inline, runs: 10, paths: ['onion.cebollon.layers', 'foe.cebollon.pv'] });
  assert.equal(found.base.length, 2); assert.equal(found.levers.length, 2);
  const pv = found.levers.find(l => l.path === 'foe.cebollon.pv');
  assert.deepEqual([pv.now, pv.low, pv.high], [150, 120, 180]);
  assert.equal(pv.goals.length, 2);
  assert.ok(pv.goals.every(g => g.win[0] >= g.win[2]), 'more PV never wins more');
  assert.equal(pv.loss.length, 3);
  // Without paths: the fight's own numbers, found by playing it.
  const own = await levers({ goals: goals.slice(0, 1), play: inline, runs: 2 });
  assert.ok(own.levers.some(l => l.path === 'onion.cebollon.perLayer') && !own.levers.some(l => l.path.startsWith('skill.')));
});

test('each friend\'s ánima makes the party a share larger, and the growth rule can be tried without touching the game', () => {
  assert.deepEqual(ANIMA_GROWTH, { pct: .12 }, 'each ánima, 12 % more of PV, Fuerza, Magia, Defensa and Espíritu');
  assert.equal(animaGrowth([]), 0); assert.equal(animaGrowth(['nuria', 'marta']), .24);
  withTuning({ 'growth.rules.pct': .2 }, () => assert.equal(animaGrowth(['nuria']), .2));
  const hp = tuning => withTuning(tuning, () => createFight({ ...onion, friends: ['nuria', 'luca'] }, seeded(1)).allies[0].maxHp);
  assert.ok(hp({}) > hp({ 'growth.rules.pct': 0 }) && hp({ 'growth.rules.pct': .24 }) > hp({}));
  // A level of the ánima worn is a share more too, and the foes' blows do not keep step with it.
  const levelled = level => createFight({ ...onion, levels: { papagato: level } }, seeded(1)).allies.find(a => a.classId === 'papagato')?.maxHp;
  if (levelled(1)) assert.ok(levelled(4) > levelled(1));
});

test('an open mission\'s foes grow with the other missions\' ánimas behind it, each fight by its own rule, in the game as in the simulator', () => {
  assert.deepEqual(FOE_GROWTH, { pv: 0, stat: 1.25 }, 'the rule of a fight with none of its own: a point and a quarter of each attribute for each, and no more PV');
  // Every fight of the four open missions has its own, found so that done last it is what it is done first (docs/fight-sim.md § The final pass).
  for (const id of ['universidad', 'marta', 'emilie', 'luca']) for (const fight of STRETCHES[id].fights) assert.ok(FIGHT_GROWTH[fight], `${fight} has no growth of its own`);
  for (const fight of ['aurelia', 'reina-vuelta']) assert.equal(FIGHT_GROWTH[fight], undefined, `${fight} is met as it is`);
  for (const fight of STRETCHES.nuria.fights) assert.ok(FIGHT_GROWTH[fight]?.stat > 0 && FIGHT_GROWTH[fight].pv === 0, `${fight}: Nuria's tower grows by its blows, never by its length`);
  assert.equal(growthOf('fran'), FIGHT_GROWTH.fran); assert.equal(growthOf('dogs'), FOE_GROWTH); assert.equal(growthOf(), FOE_GROWTH);
  const all = ['nuria', 'universidad', 'marta', 'emilie', 'luca'];
  // Nuria's is with everyone before the first open mission, and a mission's own comes at its end: neither counts.
  assert.deepEqual([[], ['nuria'], ['nuria', 'luca'], ['nuria', 'marta', 'emilie'], all].map(friends => gatheredFor('fran', friends)), [0, 0, 0, 2, 3]);
  assert.equal(gatheredFor('sobremesa', all), 3);
  // The castle's fights are met as they are, after every mission; Nuria's tower as it is when done first, and grown with
  // every open mission's ánima a party brings to it (Aitor and Gerard did Emilie's first).
  for (const fight of ['aurelia', 'reina-vuelta', 'dogs', 'palace-guards', 'night-guard']) assert.equal(gatheredFor(fight, all), 0, fight);
  for (const fight of ['cebollon', 'uri-vertigo', 'crias-1']) assert.deepEqual([[], ['emilie'], ['emilie', 'marta'], all].map(friends => gatheredFor(fight, friends)), [0, 1, 2, 4], fight);
  const fran = (friends, tuning = {}) => withTuning(tuning, () => createFight({ fight: 'fran', party: MISSION_PARTY, policy: 'smart', friends }, seeded(1)).foes.find(foe => foe.kind === 'fran'));
  const first = fran(['nuria']), last = fran(['nuria', 'universidad', 'marta', 'emilie']), rule = FIGHT_GROWTH.fran;
  // Its `stat` for each of the others behind, rounded on the sum; its `pv`, a share of its PV for each.
  assert.deepEqual([['nuria', 'marta'], ['nuria', 'marta', 'emilie'], all].map(friends => fran(friends).stats.defensa - first.stats.defensa), [1, 2, 3].map(n => Math.round(rule.stat * n)));
  const four = c => [c.stats.fuerza, c.stats.magia, c.stats.defensa, c.stats.espiritu];
  assert.deepEqual(four(last), four(first).map(value => value + Math.round(rule.stat * 3))); assert.equal(last.maxHp, Math.round(first.maxHp * (1 + rule.pv * 3))); assert.equal(last.stats.velocidad, first.stats.velocidad);
  assert.deepEqual(four(fran(all, { 'foes.fran.stat': 0 })), four(first), 'the rule is a number: at 0 the fight is the one tuned');
  const longer = fran(all, { 'foes.fran.pv': .1 });
  assert.equal(longer.maxHp, Math.round(first.maxHp * 1.3)); assert.equal(longer.hp, longer.maxHp);
  // The fight screen and the whole-game simulator start their fights here, with the story's ánimas.
  const slots = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
  const started = friends => createEncounter(slots, 'fran', { friends, random: seeded(1) });
  assert.deepEqual(four(started(all).foes.find(foe => foe.kind === 'fran')), four(last));
  assert.equal(started(all).grown, 3); assert.equal(started(['nuria']).grown, undefined);
  for (const lamp of started(all).foes.filter(foe => foe.kind === 'lampara')) assert.equal(lamp.stats.defensa, started([]).foes.find(foe => foe.id === lamp.id).stats.defensa + Math.round(rule.stat * 3), 'everything in the fight grows alike');
  // Whoever joins later comes as grown as the rest: La Voz's second voice.
  const voz = createEncounter(slots, 'voz', { friends: all, random: seeded(1) }), plain = createEncounter(slots, 'voz', { random: seeded(1) });
  assert.equal(voz.foes[0].stats.magia, plain.foes[0].stats.magia + Math.round(FIGHT_GROWTH.voz.stat * 3)); assert.equal(voz.grown, 3);
});

test('inside the castle a fight is worth three times its foes, and out at night half as much again', () => {
  assert.deepEqual(XP_RULES, { castle: 3, night: 1.5 });
  const slots = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
  const worth = state => state.foes.reduce((sum, foe) => sum + FOE_XP[foe.kind], 0);
  const room = createEncounter(slots, 'alumnos-1a', { random: seeded(1) }), night = createEncounter(slots, 'night-guard', { night: { room: 'alumnos-1a', might: 2 }, random: seeded(1) });
  assert.ok(worth(room) > 0); assert.equal(fightXp(room), 3 * worth(room)); assert.equal(fightXp(night), Math.round(1.5 * worth(night)));
  withTuning({ 'xp.rules.night': 1 }, () => assert.equal(fightXp(night), worth(night)));
  assert.equal(fightXp(createEncounter(slots, 'fran', { random: seeded(1) })), worth(createEncounter(slots, 'fran', { random: seeded(1) })));
  withTuning({ 'xp.rules.castle': 1 }, () => assert.equal(fightXp(room), worth(room)));
  // What development adds is not multiplied: it is the EXP to the next level, exactly.
  assert.equal(fightXp({ ...room, extraXp: 7 }), 3 * worth(room) + 7);
  // The steps from 4 to 7 are short: what a floor of the castle leaves is a level or two.
  assert.deepEqual([...LEVEL_XP], [180, 660, 950, 1150, 1400, 1700]);
});

test('the castle is three stretches after every mission, each with what its stage has opened', () => {
  assert.deepEqual(CASTLE_STAGE_IDS, ['castillo-1', 'castillo-2', 'castillo-3']);
  for (const id of STRETCH_IDS) for (const fight of STRETCHES[id].fights) assert.equal(stretchOf(fight), id, fight);
  const [one, two, three] = CASTLE_STAGE_IDS.map(id => storyPoint(id, 'mixto'));
  for (const point of [one, two, three]) assert.deepEqual(point.setup.friends, ['nuria', 'universidad', 'marta', 'emilie', 'luca']);
  // The friends' ten lights, two ecos each, then Aurelià's and the first floor's four rooms, then Dirección's three and the second floor's six.
  assert.deepEqual([one.ecos, two.ecos, three.ecos], [20, 25, 34]);
  assert.deepEqual(two.done.slice(-1), ['castillo-1']); assert.deepEqual(three.done.slice(-2), ['castillo-1', 'castillo-2']);
  for (const [n, point] of [one, two, three].entries()) {
    const stage = CASTLE_STAGES[point.at].stage;
    assert.equal(stage, n + 1);
    for (const level of Object.values(point.setup.levels)) assert.ok(level >= 1 && level <= CASTLE_UNLOCKS[stage].cap, `${point.at}: ${level}`);
    for (const id of point.setup.improved) assert.ok(stageOf(improvementOf(id)) <= stage, `${point.at}: ${id}`);
  }
  assert.ok(one.setup.levels.papagato >= storyPoint('marta:first').setup.levels.papagato);
  // A level's EXP moves the levels a point is reached with; and they can be put by hand.
  assert.ok(withTuning({ 'level.xp.2': 100000, 'level.xp.3': 100001, 'level.xp.4': 100002, 'level.xp.5': 100003 }, () => storyPoint('castillo-1').setup.levels.papagato) < one.setup.levels.papagato || one.setup.levels.papagato <= 3);
  assert.equal(storyPoint('castillo-3', 'mixto', { papagato: 7 }).setup.levels.papagato, 7);
  assert.throws(() => storyPoint('castillo-9'), /Unknown mission/);
});

test('a party can name each one\'s extras, and everything open has every ánima at its top with the whole jar', () => {
  const state = createFight({ fight: 'cebollon', party: 'gerard:matemagico/papagato+aitor:tecnopata/dadaista', policy: 'smart' }, seeded(1));
  assert.deepEqual(kitIn(state, state.allies[0]).sort(), ['matemagico', 'papagato']);
  assert.deepEqual(kitIn(state, state.allies[1]).sort(), ['dadaista', 'tecnopata']);
  assert.throws(() => createFight({ fight: 'cebollon', party: 'gerard:matemagico/nada', policy: 'smart' }, seeded(1)), /Unknown ánima/);
  const full = fullKit();
  assert.equal(full.levels.papagato, 7); assert.equal(full.friends.length, 5);
  assert.ok(full.improved.includes('matemagico:integral') && full.exact);
  const run = simulate({ fight: 'direccion', party: 'gerard:prismatico+aitor:dadaista', policy: 'smart', ...full }, 2, 1);
  assert.equal(run.runs, 2); assert.equal(run.draws, 0);
});

test('the skill table says what each action does and what the fight becomes without it', async () => {
  const { base, lines } = await skillReport({ setups: [onion], play: inline, runs: 12 });
  assert.equal(base.length, 1);
  const claws = lines.find(l => l.id === 'zarpazos'), attack = lines.find(l => l.id === 'attack');
  assert.ok(claws && claws.known === 1 && claws.usedIn === 1 && claws.uses > 0 && claws.perUse > 0 && claws.perMana > 0);
  // Since cures give back a share of the PV, El Cebollón can be outlasted without Zarpazos: it takes far longer.
  assert.ok(claws.drop >= 0 && claws.rounds >= 3, `without Zarpazos El Cebollón takes rounds more (${claws.rounds})`);
  assert.ok(attack && attack.drop === null, 'Atacar cannot be taken away');
  assert.ok(!lines.some(l => l.id === 'ostinato'), 'what the party cannot wear is not on its table');
});
const DECISIVE = .3;

test('coverage says what no target plays: fights without their pair, skills nobody uses, numbers nobody reads', async () => {
  const found = await coverage({ play: inline, runs: 2, targets: TARGETS.filter(t => t.fight === 'cebollon' || t.fight === 'crias-1') });
  assert.ok(!found.fights.some(f => f.fight === 'cebollon'), 'El Cebollón has both halves');
  assert.ok(found.fights.some(f => f.fight === 'voz' && !f.with.length && !f.without.length));
  assert.ok(found.skills.some(s => s.id === 'ostinato') && !found.skills.some(s => s.id === 'zarpazos'));
  assert.ok(found.animas.includes('dadaista') && !found.animas.includes('papagato'));
  assert.ok(found.numbers.foe.includes('foe.vertigo.pv') && !(found.numbers.onion ?? []).includes('onion.cebollon.layers'));
  assert.equal(found.kits.find(k => k.anima === 'papagato').top, 7);
});

test('a story\'s rows become a line per point: how many pairs hold with the party that reaches it', () => {
  const points = [storyPoint('marta:first'), storyPoint('marta:last')], jobs = storyJobs(points, ['smart', 'casual'], { fights: ['cuerdas-directo'] });
  const lines = progressLines(points, jobs, jobs.map(job => row({ fight: job.setup.fight, win: job.setup.policy === 'smart' ? .95 : job.at.endsWith('last') ? .6 : .1 })));
  assert.deepEqual(lines.map(l => [l.at, l.pairs, l.held, l.easy]), [['marta:first', 1, 1, []], ['marta:last', 1, 0, ['cuerdas-directo']]]);
  assert.ok(lines[1].friends > lines[0].friends);
  const goals = pairGoals(points);
  assert.ok(goals.length === 12 && goals.every(g => g.want.win), 'the three fights that ask (Lo Cristalino only teaches), two bots, two points');
  assert.deepEqual(goals.find(g => g.setup.policy === 'casual').want.win, [0, .2]);
});

test('rows played in threads are the rows played here, piece by piece', async () => {
  assert.deepEqual(tallyRuns(onion, [...playRuns(onion, 9, 0, 5), ...playRuns(onion, 9, 5, 12)], 9), simulate(onion, 12, 9));
  // A thread plays the game as it is; the tests play with chance crits off (tests/setup.mjs), so the jobs say so too.
  const off = { 'crit.rules.chance': 0 };
  const jobs = [{ setup: onion, runs: 45, seed: 9, tuning: off }, { setup: { ...onion, fight: 'cebolla', party: DUO }, runs: 22, seed: 9, tuning: { ...off, 'foe.cebolla.pv': 90 } }];
  const pool = createPool(2);
  try { assert.deepEqual(await pool.play(jobs), await inline(jobs)); } finally { await pool.close(); }
});
