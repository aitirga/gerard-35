import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, createGuardBattle, createMinionBattle, enemyAct } from '../src/battle.ts';
import { createCombat, stepCombat } from '../src/combat/engine.ts';

// Compare real campaign actions with a declarative encounter. The two schedulers differ,
// but resolving equivalent content must give identical resources and effective quantities.
function genericEncounter(campaign, action) {
  return {
    id: 'campaign-parity',
    rules: { speedStat: 'velocidad' },
    actions: { move: action },
    combatants: [...campaign.allies, ...campaign.foes].map(actor => ({
      id: actor.id,
      team: campaign.allies.includes(actor) ? 'party' : 'enemy',
      stats: { ...actor.stats },
      resources: {
        hp: { max: actor.maxHp, current: actor.hp },
        sec: { max: actor.maxSecondary, current: actor.secondary },
      },
      actions: ['move'],
    })),
  };
}

test('campaign attacks and magic resolve like generic actions across profiles and defenses', () => {
  const actions = [
    { command: 'attack', skill: undefined, stat: 'fuerza', resistance: 'defensa', power: 18, cost: 0 },
    { command: 'skill', skill: 'foc-binari', stat: 'magia', resistance: 'espiritu', power: 16, cost: 1 },
  ];
  for (const profile of ['gerard', 'gerard35', 'aitor']) for (const defense of [1, 10, 80]) for (const move of actions) {
    const campaign = createBattle([{ id: 'hero', name: 'Hero', profile, classId: 'matemagico' }]);
    const actor = campaign.allies[0], target = campaign.foes[0];
    target.stats[move.resistance] = defense;
    const definition = genericEncounter(campaign, {
      target: 'enemy', costs: { sec: move.cost },
      effects: [{ kind: 'damage', amount: { base: move.power, actorStat: move.stat, targetStat: move.resistance, minimum: 1 } }],
    });
    const transition = stepCombat(definition, createCombat(definition, 73), { actorId: actor.id, actionId: 'move', targetIds: [target.id] });
    assert.equal(transition.accepted, true);
    const result = act(campaign, move.command, target.id, move.skill);
    const genericActor = transition.state.combatants.find(c => c.id === actor.id);
    const genericTarget = transition.state.combatants.find(c => c.id === target.id);
    assert.equal(actor.secondary, genericActor.resources.sec.current);
    assert.equal(target.hp, genericTarget.resources.hp.current);
    assert.equal(result.amount, transition.events.find(e => e.type === 'damage').amount);
  }
});

test('campaign damage clamps a guarded heavy hit to remaining health and records effective loss', () => {
  const campaign = createGuardBattle([{ id: 'hero', name: 'Hero', profile: 'gerard' }], { count: 1, hp: 220, power: 30 });
  const actor = campaign.allies[0];
  actor.hp = 2;
  act(campaign, 'defend');
  const result = enemyAct(campaign, 'guard-0');
  assert.equal(result.amount, 2);
  assert.equal(actor.hp, 0);
  assert.equal(campaign.phase, 'lost');
});

test('a plain attack cannot bypass the story shell by carrying an unused skill identifier', () => {
  const campaign = createMinionBattle();
  const result = act(campaign, 'attack', 'minion-0', 'foc-binari');
  assert.equal(result.swallowed, true);
  assert.equal(result.amount, 0);
  assert.equal(campaign.foes[0].hp, campaign.foes[0].maxHp);
  assert.equal(campaign.foes[0].shell, true);
});
