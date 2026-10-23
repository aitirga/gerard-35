import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCombatant, adjustResource, affinityMultiplier, availableActions, createCombat,
  effectiveStats, resolveAmount, stepCombat, validateCombatDefinition,
} from '../src/combat/engine.ts';

const fighter = (id, team, speed = 10) => ({ id, team, stats: { speed, strength: 10, defense: 5 }, resources: { hp: { max: 100 }, energy: { max: 20 } }, actions: ['hit'] });
const definition = () => ({
  id: 'test', combatants: [fighter('a', 'one', 20), fighter('b', 'two')],
  actions: { hit: { target: 'enemy', effects: [{ kind: 'damage', amount: 10 }] } }, statuses: {},
});
const command = (state, actionId = 'hit', targetIds = ['b']) => ({ actorId: activeCombatant(state).id, actionId, targetIds });
const move = (def, state, actionId, targets) => {
  const result = stepCombat(def, state, command(state, actionId, targets));
  assert.equal(result.accepted, true, result.reason); return result.state;
};
const wait = (def, state) => move(def, state, '$wait', []);
const hp = (state, id) => state.combatants.find(c => c.id === id).resources.hp.current;

test('pure formulas, resource bounds and explicit zero immunity share one rule', () => {
  assert.equal(resolveAmount({ base: 18, actorStat: 'strength', targetStat: 'defense', minimum: 1 }, { strength: 12 }, { defense: 15 }), 15);
  assert.equal(resolveAmount({ base: 1, targetStat: 'defense', minimum: 1 }, {}, { defense: 100 }), 1);
  assert.equal(resolveAmount(0), 0);
  assert.equal(affinityMultiplier(['a', 'b'], { a: 4, b: 1 }), 2);
  assert.equal(affinityMultiplier(['a', 'a'], { a: 2 }, 'product'), 2);
  assert.equal(affinityMultiplier(['a', 'b'], { a: 0, b: 4 }, 'highest'), 0);
  assert.equal(affinityMultiplier(['a', 'b'], { a: 4, b: .5 }, 'product'), 2);
  const resource = { current: 5, max: 10 };
  assert.deepEqual(adjustResource(resource, -99), { resource: { current: 0, max: 10 }, amount: -5 });
  assert.deepEqual(resource, { current: 5, max: 10 });
  assert.equal(adjustResource({ current: 0, max: 10 }, 5, false).amount, 0);
});

test('seeded combat replays byte-for-byte without mutation, including probabilistic effects', () => {
  const def = definition();
  def.actions.hit.effects[0] = { kind: 'damage', amount: { base: 16, variance: .4 }, chance: .85 };
  const untouched = structuredClone(def), commands = [];
  let state = createCombat(def, 4096);
  const initial = structuredClone(state);
  while (state.status === 'active') {
    const selected = availableActions(def, state).find(choice => choice.actionId === 'hit');
    commands.push(selected);
    const before = structuredClone(state);
    const transition = stepCombat(def, state, selected);
    assert.equal(transition.accepted, true);
    assert.deepEqual(state, before);
    state = transition.state;
  }
  let replay = createCombat(def, 4096);
  for (const selected of commands) replay = stepCombat(def, replay, selected).state;
  assert.deepEqual(replay, state);
  assert.deepEqual(def, untouched);
  assert.deepEqual(initial, createCombat(def, 4096));
  assert.ok(state.events.length < commands.length * 5, 'state stores only the latest transition');
});

test('invalid actors, actions, costs, dead/duplicate/extra targets do not spend RNG or costs', () => {
  const def = definition();
  def.actions.hit.costs = { energy: 8 };
  def.actions.hit.effects[0].chance = .5;
  const state = createCombat(def, 7), before = structuredClone(state);
  for (const bad of [
    { actorId: 'b', actionId: 'hit', targetIds: ['a'] },
    { actorId: 'a', actionId: 'missing', targetIds: ['b'] },
    { actorId: 'a', actionId: 'hit', targetIds: ['a'] },
    { actorId: 'a', actionId: 'hit', targetIds: ['b', 'b'] },
    { actorId: 'a', actionId: 'hit', targetIds: ['b', 'missing'] },
    { actorId: 'a', actionId: '$wait', targetIds: ['b'] },
  ]) {
    const result = stepCombat(def, state, bad);
    assert.equal(result.accepted, false); assert.equal(result.state, state); assert.deepEqual(result.events, []);
    assert.deepEqual(state, before);
  }
  state.combatants[0].resources.energy.current = 7;
  assert.equal(stepCombat(def, state, command(state)).accepted, false);
  assert.equal(state.rng, 7);
  state.combatants[0].resources.energy.current = 20;
  state.combatants[1].resources.hp.current = 0;
  assert.equal(stepCombat(def, state, command(state)).accepted, false);
});

test('all-target commands are canonical and cannot omit any eligible target', () => {
  const def = definition(); def.combatants.push(fighter('c', 'two'));
  def.actions.hit.target = 'all-enemies';
  const state = createCombat(def);
  assert.deepEqual(availableActions(def, state)[0].targetIds, ['b', 'c']);
  assert.equal(stepCombat(def, state, command(state, 'hit', ['b'])).accepted, false);
  const next = move(def, state, 'hit', ['c', 'b']);
  assert.equal(hp(next, 'b'), 90); assert.equal(hp(next, 'c'), 90);
  assert.deepEqual(next.events.filter(event => event.type === 'damage').map(event => event.targetId), ['b', 'c']);
});

test('costs and cooldowns count subsequent owner turns; legal choices include wait', () => {
  const def = definition(); def.actions.hit.costs = { energy: 8 }; def.actions.hit.cooldown = 1;
  let state = createCombat(def);
  state = move(def, state, 'hit', ['b']);
  assert.equal(state.combatants[0].resources.energy.current, 12);
  state = wait(def, state);
  assert.equal(activeCombatant(state).id, 'a');
  assert.deepEqual(availableActions(def, state).map(c => c.actionId), ['$wait']);
  state = wait(def, state); state = wait(def, state);
  assert.ok(availableActions(def, state).some(c => c.actionId === 'hit'));
});

test('initiative is stable on ties and recomputed from effective stats at round boundaries', () => {
  const def = definition(); def.combatants[1].stats.speed = 20;
  def.combatants.push(fighter('c', 'two', 20));
  def.statuses.fast = { duration: 3, modifiers: [{ stat: 'speed', add: 50 }] };
  def.actions.boost = { target: 'enemy', effects: [{ kind: 'status', status: 'fast' }] }; def.combatants[0].actions.push('boost');
  let state = createCombat(def);
  assert.deepEqual(state.order, ['a', 'b', 'c']);
  state = move(def, state, 'boost', ['c']);
  assert.equal(activeCombatant(state).id, 'b');
  state = wait(def, state); state = wait(def, state);
  assert.deepEqual(state.order, ['c', 'a', 'b']);
});

test('stacking buffs cap, refresh duration and expire on the documented owner boundary', () => {
  const def = definition();
  def.statuses.buff = { duration: 1, maxStacks: 2, stacking: 'stack', modifiers: [{ stat: 'strength', add: 3, multiply: 2 }] };
  def.actions.boost = { target: 'self', effects: [{ kind: 'status', status: 'buff' }, { kind: 'status', status: 'buff', stacks: 5 }] };
  def.combatants[0].actions.push('boost');
  let state = createCombat(def);
  state = move(def, state, 'boost', ['a']);
  assert.equal(state.combatants[0].statuses[0].stacks, 2);
  assert.equal(effectiveStats(def, state.combatants[0]).strength, 64);
  assert.equal(state.combatants[0].statuses[0].remaining, 1);
  state = wait(def, state); state = wait(def, state);
  assert.equal(state.combatants[0].statuses.length, 0);
  assert.equal(effectiveStats(def, state.combatants[0]).strength, 10);
});

test('periodic statuses use source stats, skip defeated turns and can decide the battle', () => {
  const def = definition();
  def.statuses.dot = { duration: 2, onTurnStart: [{ kind: 'damage', amount: { base: 3, actorStat: 'strength' } }] };
  def.actions.poison = { target: 'enemy', effects: [{ kind: 'status', status: 'dot' }] }; def.combatants[0].actions.push('poison');
  def.combatants[1].resources.hp.current = 10;
  const state = move(def, createCombat(def), 'poison', ['b']);
  assert.equal(hp(state, 'b'), 0); assert.equal(state.outcome.winner, 'one');
  assert.ok(state.events.some(event => event.type === 'defeated' && event.targetId === 'b'));
  assert.equal(activeCombatant(state), undefined);
});

test('initial periodic death correctly skips an actor without granting an action', () => {
  const def = definition(); def.combatants.push(fighter('c', 'one', 5));
  def.statuses.dot = { onTurnStart: [{ kind: 'damage', amount: 100 }] }; def.combatants[0].statuses = [{ id: 'dot' }];
  const state = createCombat(def);
  assert.equal(hp(state, 'a'), 0); assert.equal(activeCombatant(state).id, 'b'); assert.equal(state.actionsTaken, 0);
});

test('status cannot resurrect and only explicit revive targets fallen allies', () => {
  const def = definition(); const fallen = fighter('c', 'one', 0); fallen.resources.hp.current = 0; def.combatants.push(fallen);
  def.actions.revive = { target: 'ally', targetLife: 'dead', effects: [{ kind: 'heal', amount: 99 }, { kind: 'resource', resource: 'hp', amount: 99 }, { kind: 'revive', amount: 20 }] };
  def.combatants[0].actions.push('revive');
  const state = move(def, createCombat(def), 'revive', ['c']);
  assert.equal(hp(state, 'c'), 20);
  assert.equal(state.events.filter(event => event.targetId === 'c' && ['heal', 'resource'].includes(event.type)).length, 0);
});

test('immunity produces zero damage and no damaged-trigger counter', () => {
  const def = definition(); def.actions.hit.tags = ['generic-a']; def.combatants[1].affinities = { 'generic-a': 0 };
  def.statuses.counter = { reactions: [{ on: 'damaged', effects: [{ kind: 'damage', amount: 3 }] }] }; def.combatants[1].statuses = [{ id: 'counter' }];
  const state = move(def, createCombat(def), 'hit', ['b']);
  assert.equal(hp(state, 'a'), 100); assert.equal(hp(state, 'b'), 100);
  assert.equal(state.events.find(event => event.type === 'damage').amount, 0);
  assert.equal(state.events.some(event => event.type === 'reaction'), false);
});

test('counter chains run each hook once per causal path and remain finite', () => {
  const def = definition();
  def.statuses.counter = { reactions: [{ on: 'damaged', effects: [{ kind: 'damage', amount: 3, target: 'source' }] }] };
  def.combatants.forEach(c => { c.statuses = [{ id: 'counter' }]; });
  const state = move(def, createCombat(def), 'hit', ['b']);
  assert.equal(hp(state, 'a'), 97); assert.equal(hp(state, 'b'), 87);
  assert.equal(state.events.filter(event => event.type === 'reaction').length, 2);
  assert.equal(state.status, 'active');
});

test('defeat reactions resolve before outcome, including simultaneous team defeat', () => {
  const def = definition(); def.combatants[0].resources.hp.current = 10; def.combatants[1].resources.hp.current = 5;
  def.statuses.final = { reactions: [{ on: 'defeated', effects: [{ kind: 'damage', amount: 10, target: 'source' }] }] }; def.combatants[1].statuses = [{ id: 'final' }];
  const state = move(def, createCombat(def), 'hit', ['b']);
  assert.deepEqual(state.outcome, { reason: 'mutual-defeat' });
});

test('reaction budget exhaustion is an explicit draw, never a silently truncated success', () => {
  const def = definition(); def.rules = { maxReactionDepth: 1 };
  def.statuses.counter = { reactions: [{ on: 'damaged', effects: [{ kind: 'damage', amount: 3 }] }] }; def.combatants.forEach(c => { c.statuses = [{ id: 'counter' }]; });
  const state = move(def, createCombat(def), 'hit', ['b']);
  assert.deepEqual(state.outcome, { reason: 'effect-limit' });
});

test('stunned or non-damaging battles terminate at round/action limits', () => {
  const def = definition(); def.rules = { maxRounds: 2 };
  def.statuses.stun = { preventsActions: true }; def.combatants.forEach(c => { c.statuses = [{ id: 'stun' }]; });
  let state = createCombat(def);
  while (state.status === 'active') { assert.deepEqual(availableActions(def, state).map(c => c.actionId), ['$wait']); state = wait(def, state); }
  assert.equal(state.outcome.reason, 'round-limit'); assert.equal(state.actionsTaken, 4);
  def.rules.maxActions = 1;
  state = wait(def, createCombat(def)); assert.equal(state.outcome.reason, 'action-limit');
});

test('signed resource effects and formulas cannot cross bounds', () => {
  const def = definition();
  def.actions.drain = { target: 'enemy', effects: [{ kind: 'resource', resource: 'energy', amount: { base: -12, actorStat: 'strength', actorScale: -1 } }, { kind: 'resource', target: 'self', resource: 'energy', amount: 999 }] };
  def.combatants[0].actions.push('drain');
  const state = move(def, createCombat(def), 'drain', ['b']);
  assert.equal(state.combatants[1].resources.energy.current, 0); assert.equal(state.combatants[0].resources.energy.current, 20);
});

test('custom effects compose unusual behavior with immutable snapshots and seeded RNG', () => {
  const def = definition(); def.actions.hit.effects = [{ kind: 'custom', handler: 'test:convert', params: { factor: 2 } }];
  const runtime = { effects: { 'test:convert': (context, params) => {
    assert.ok(Object.isFrozen(context.state)); assert.ok(Object.isFrozen(context.actor.resources.hp));
    return [{ kind: 'damage', amount: context.actor.resources.energy.current * params.factor + Math.floor(context.random() * 3) }];
  } } };
  assert.throws(() => createCombat(def), /not registered/);
  const state = createCombat(def, 91, runtime);
  const result = stepCombat(def, state, command(state), runtime);
  assert.equal(result.accepted, true);
  assert.deepEqual(result, stepCombat(def, createCombat(def, 91, runtime), command(state), runtime));
  assert.ok(hp(result.state, 'b') <= 60);
});

test('plugin failure or invalid output rolls back cost, mutations and RNG', () => {
  const def = definition(); def.actions.hit.costs = { energy: 4 }; def.actions.hit.effects = [{ kind: 'custom', handler: 'test:bad' }];
  for (const handler of [context => { context.random(); context.actor.resources.hp.current = 0; return []; }, context => { context.random(); return [{ kind: 'damage', amount: NaN }]; }]) {
    const runtime = { effects: { 'test:bad': handler } };
    const state = createCombat(def, 7, runtime), before = structuredClone(state);
    const result = stepCombat(def, state, command(state), runtime);
    assert.equal(result.accepted, false); assert.equal(result.state, state); assert.deepEqual(state, before);
  }
});

test('recursive custom effects stop at the explicit effect/depth budget', () => {
  const def = definition(); def.actions.hit.effects = [{ kind: 'custom', handler: 'test:loop' }]; def.rules = { maxEffectsPerAction: 5 };
  const runtime = { effects: { 'test:loop': () => [{ kind: 'custom', handler: 'test:loop' }] } };
  const state = createCombat(def, 1, runtime), result = stepCombat(def, state, command(state), runtime);
  assert.equal(result.accepted, true); assert.equal(result.state.outcome.reason, 'effect-limit');
});

test('definition validation collects references, numeric ranges and duplicate IDs', () => {
  const def = definition(); def.combatants[1].id = 'a'; def.combatants[0].stats.strength = Infinity;
  def.combatants[0].actions.push('missing'); def.actions.hit.effects.push({ kind: 'status', status: 'unknown', chance: 2 }); def.rules = { maxRounds: 0 };
  const errors = validateCombatDefinition(def);
  assert.ok(errors.some(error => error.includes('unique')));
  assert.ok(errors.some(error => error.includes('strength')));
  assert.ok(errors.some(error => error.includes('missing')));
  assert.ok(errors.some(error => error.includes('unknown')));
  assert.ok(errors.some(error => error.includes('chance')));
  assert.ok(errors.some(error => error.includes('maxRounds')));
  assert.throws(() => createCombat(def), /Invalid combat definition/);
});

test('many seeded runs maintain finite bounded resources and always terminate', () => {
  const def = definition(); def.rules = { maxActions: 70, maxRounds: 30 };
  def.actions.hit.effects[0] = { kind: 'damage', amount: { base: 16, variance: .7 }, chance: .8 };
  for (let seed = 0; seed < 100; seed++) {
    let state = createCombat(def, seed);
    while (state.status === 'active') {
      state = stepCombat(def, state, availableActions(def, state)[0]).state;
      for (const actor of state.combatants) for (const resource of Object.values(actor.resources)) {
        assert.ok(Number.isFinite(resource.current)); assert.ok(resource.current >= 0 && resource.current <= resource.max);
      }
    }
    assert.ok(state.actionsTaken <= 70); assert.ok(state.outcome);
  }
});

test('a nested self-defeat reaction emits defeat only once', () => {
  const def = definition(); def.actions.hit.effects[0].amount = 1; def.combatants[1].resources.hp.current = 10;
  def.statuses.sacrifice = { reactions: [{ on: 'damaged', effects: [{ kind: 'damage', target: 'self', amount: 10 }] }] };
  def.combatants[1].statuses = [{ id: 'sacrifice' }];
  const state = move(def, createCombat(def), 'hit', ['b']);
  assert.equal(state.events.filter(event => event.type === 'defeated' && event.targetId === 'b').length, 1);
});

test('HP costs cannot defeat the caster; sacrifice belongs to an explicit self-damage effect', () => {
  const def = definition(); def.actions.hit.costs = { hp: 10 }; def.combatants[0].resources.hp.current = 10;
  const state = createCombat(def);
  assert.equal(stepCombat(def, state, command(state)).accepted, false);
  assert.equal(hp(state, 'a'), 10);
});

test('one-turn self-applied periodic status ticks once on its future owner turn end', () => {
  const def = definition(); def.statuses.dot = { duration: 1, onTurnEnd: [{ kind: 'damage', amount: 5 }] };
  def.actions.dot = { target: 'self', effects: [{ kind: 'status', status: 'dot' }] }; def.combatants[0].actions.push('dot');
  let state = move(def, createCombat(def), 'dot', ['a']);
  assert.equal(hp(state, 'a'), 100);
  state = wait(def, state); state = wait(def, state);
  assert.equal(hp(state, 'a'), 95); assert.equal(state.combatants[0].statuses.length, 0);
});

test('removed statuses cannot fire stale periodic effects or subsequent reactions', () => {
  const def = definition();
  def.statuses.cleanse = { onTurnStart: [{ kind: 'removeStatus', status: 'aura' }] };
  def.statuses.aura = { onTurnStart: [{ kind: 'status', status: 'blocked' }] };
  def.statuses.blocked = { preventsActions: true };
  def.combatants[0].statuses = [{ id: 'cleanse' }, { id: 'aura' }];
  const state = createCombat(def);
  assert.deepEqual(state.combatants[0].statuses.map(status => status.id), ['cleanse']);
  assert.ok(availableActions(def, state).some(action => action.actionId === 'hit'));
  const def2 = definition();
  def2.statuses.first = { reactions: [{ on: 'damaged', effects: [{ kind: 'removeStatus', target: 'self', status: 'second' }] }] };
  def2.statuses.second = { reactions: [{ on: 'damaged', effects: [{ kind: 'status', target: 'self', status: 'blocked' }] }] };
  def2.statuses.blocked = { preventsActions: true };
  def2.combatants[1].statuses = [{ id: 'first' }, { id: 'second' }];
  const next = move(def2, createCombat(def2), 'hit', ['b']);
  assert.deepEqual(next.combatants[1].statuses.map(status => status.id), ['first']);
});

test('unsafe map keys and unknown resource references fail during definition validation', () => {
  const def = definition(); def.actions.hit.tags = ['toString']; def.actions.hit.effects.push({ kind: 'resource', resource: 'missing-resource', amount: -1 });
  const errors = validateCombatDefinition(def);
  assert.ok(errors.some(error => error.includes('tags')));
  assert.ok(errors.some(error => error.includes('unknown resource missing-resource')));
  assert.throws(() => createCombat(def), /Invalid combat definition/);
});

test('group resource effects support mixed class pools without inventing absent resources', () => {
  const def = definition();
  const other = fighter('c', 'one', 5);
  delete other.resources.energy;
  other.resources.charges = { max: 4, current: 0 };
  def.combatants.push(other);
  def.combatants[0].resources.energy.current = 2;
  def.actions.restore = { target: 'all-allies', effects: [{ kind: 'resource', resource: 'energy', amount: 5 }, { kind: 'resource', resource: 'charges', amount: 2 }] };
  def.combatants[0].actions.push('restore');
  const before = createCombat(def);
  const listed = availableActions(def, before).find(action => action.actionId === 'restore');
  assert.ok(listed);
  const result = stepCombat(def, before, listed);
  assert.equal(result.accepted, true, result.reason);
  const a = result.state.combatants.find(actor => actor.id === 'a');
  const c = result.state.combatants.find(actor => actor.id === 'c');
  assert.equal(a.resources.energy.current, 7); assert.equal(c.resources.charges.current, 2);
  assert.equal(Object.hasOwn(a.resources, 'charges'), false); assert.equal(Object.hasOwn(c.resources, 'energy'), false);
});
