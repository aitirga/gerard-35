import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFINITIES, ELEMENT_RULES, ELEMENTS, act, affinityOf, elementOf, DUALS, SKILLS } from '../src/battle.ts';
import { createFight, seeded } from '../src/battle-sim.ts';

const fight = (name, improved = []) => createFight({ fight: name, party: 'gerard:matemagico+aitor:papagato', levels: { matemagico: 2, papagato: 2 }, policy: 'smart', improved }, seeded(35));
const blow = (name, improved, element) => {
  const s = fight(name, improved), foe = s.foes[0];
  s.active = s.allies.findIndex(ally => ally.id === 'gerard');
  s.allies[s.active].element = element;
  const effect = act(s, 'attack', foe.id);
  return { effect, foe };
};

test('a foe weak to an element takes more from a blow that carries it, and the blow says so', () => {
  const plain = blow('cuerdas-directo', ['matemagico:electrico']);
  const spark = blow('cuerdas-directo', ['matemagico:electrico'], 'electrico');
  assert.equal(plain.effect.affinity, undefined);
  assert.equal(spark.effect.affinity, 'weak');
  assert.ok(Math.abs(spark.effect.amount / plain.effect.amount - ELEMENT_RULES.weak) < .12, `${spark.effect.amount} against ${plain.effect.amount}`);
});

test('an element a foe has nothing to say about changes nothing', () => {
  const plain = blow('cuerdas-directo', ['matemagico:agua']);
  const water = blow('cuerdas-directo', ['matemagico:agua'], 'agua');
  assert.equal(water.effect.affinity, undefined);
  assert.equal(water.effect.amount, plain.effect.amount);
});

test('what a foe is made of is told by kind of foe and element, and a skill or dual lands with the element of what it lights', () => {
  for (const [kind, table] of Object.entries(AFFINITIES)) for (const [element, a] of Object.entries(table)) {
    assert.ok(element in ELEMENTS, `${kind}: ${element}`);
    assert.ok(a === 'weak' || a === 'resist');
    assert.equal(affinityOf({ kind }, element), a);
  }
  assert.equal(affinityOf({ kind: 'dog' }, 'fuego'), undefined);
  assert.equal(elementOf(SKILLS.find(s => s.id === 'foc-binari')), 'fuego');
  assert.equal(elementOf(SKILLS.find(s => s.id === 'explosion')), 'fuego');
  assert.equal(elementOf(DUALS.find(d => d.id === 'zarpazos-de-fuego')), 'fuego');
  assert.equal(elementOf(SKILLS.find(s => s.id === 'zarpazo')), undefined);
});
