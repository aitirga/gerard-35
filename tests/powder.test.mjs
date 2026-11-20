import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, inflict, runClock, pulseDamage, skillsFor, POWDER_RULES, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Colorista's powder (docs/animas/README.md § Empolvado): it does nothing by itself and waits for a
// blow of an element. Fire blows it up, water turns it to poison, electricity to shards.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'prismatico' }];
const ELEMENTS = ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'];
/** Gerard (Matemágico, with the elements and `nodes`) and Aitor (Colorista) against three sturdy dogs. */
function fight(nodes = []) {
  const s = createBattle(PARTY, 3, false, undefined, ['matemagico', 'prismatico']);
  improve(s, improvedBy([...ELEMENTS, ...nodes]));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full; Gerard's Atacar carrying `element`. */
const turn = (s, id, element) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; if (element) by(s, id).element = element; else delete by(s, id).element; return by(s, id); };
const dusty = () => ({ level: 1, left: TIMED.empolvado.seconds, next: TIMED.empolvado.every });
/** Powder on `foes` (by index), as a handful leaves it. */
const powder = (s, ...foes) => foes.forEach(i => { s.foes[i].timed = { ...s.foes[i].timed, empolvado: dusty() }; });

test('Puñado: a light physical blow that leaves its target Empolvado for 20 seconds, which hurts nobody', () => {
  const s = fight();
  assert.deepEqual(skillsFor(s, by(s, 'aitor')).map(k => k.id), ['punado']);
  const a = turn(s, 'aitor'), e = act(s, 'skill', 'dog-0', 'punado');
  assert.equal(a.secondary, a.maxSecondary - 1); assert.ok(e.amount > 0);
  assert.deepEqual(e.afflicted, { id: 'empolvado', level: 1 });
  assert.equal(s.foes[0].timed.empolvado.left, 20);
  const hp = s.foes[0].hp;
  assert.deepEqual(runClock(s, 19), []); assert.equal(s.foes[0].hp, hp); assert.ok(s.foes[0].timed.empolvado);
  runClock(s, 1.1); assert.equal(s.foes[0].timed.empolvado, undefined);
  // Powder on someone burning or wet does nothing to them: only a blow of an element sets it off.
  const t = fight(); inflict(t.foes[0], 'quemado'); t.foes[1].timed = { mojado: { level: 1, left: 20, next: 20 } };
  turn(t, 'aitor'); assert.equal(act(t, 'skill', 'dog-0', 'punado').reaction, undefined);
  turn(t, 'aitor'); assert.equal(act(t, 'skill', 'dog-1', 'punado').reaction, undefined);
  assert.ok(t.foes[0].timed.quemado && t.foes[0].timed.empolvado && t.foes[1].timed.mojado && t.foes[1].timed.empolvado);
});

test('Estallido: fire on powder explodes on its carrier and half as hard on the others, and every foe burns a level more', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'fuego');
  const hp = s.foes.map(f => f.hp), e = act(s, 'attack', 'dog-0');
  assert.equal(e.reaction.id, 'estallido');
  const hits = Object.fromEntries(e.reaction.hits.map(h => [h.target, h.amount]));
  assert.deepEqual(Object.keys(hits), ['dog-0', 'dog-1', 'dog-2']);
  assert.ok(hits['dog-0'] > hits['dog-1'] && hits['dog-1'] === hits['dog-2'] && hits['dog-1'] > 0);
  assert.equal(hp[0] - s.foes[0].hp, e.amount + hits['dog-0']); assert.equal(hp[1] - s.foes[1].hp, hits['dog-1']);
  assert.deepEqual(e.reaction.burns, [{ target: 'dog-0', level: 1 }, { target: 'dog-1', level: 1 }, { target: 'dog-2', level: 1 }]);
  assert.ok(s.foes.every(f => f.timed.quemado.level === 1 && !f.timed.empolvado));
  // No powder: only the blow.
  const dry = fight(); turn(dry, 'gerard', 'fuego');
  assert.equal(act(dry, 'attack', 'dog-0').reaction, undefined);
});

test('Estallido runs in a chain: one fire sets off every powdered foe, each once, and they all burn one level more, not one each', () => {
  const one = fight(); powder(one, 0); turn(one, 'gerard', 'fuego');
  const alone = Object.fromEntries(act(one, 'attack', 'dog-0').reaction.hits.map(h => [h.target, h.amount]));
  const s = fight(); powder(s, 0, 1, 2); inflict(s.foes[2], 'quemado');
  turn(s, 'gerard', 'fuego');
  const e = act(s, 'attack', 'dog-0'), hits = Object.fromEntries(e.reaction.hits.map(h => [h.target, h.amount]));
  // Each took its own blast and the two others' halves.
  assert.equal(hits['dog-0'], alone['dog-0'] + 2 * alone['dog-1']); assert.equal(hits['dog-1'], hits['dog-0']);
  assert.ok(s.foes.every(f => !f.timed.empolvado));
  assert.deepEqual(s.foes.map(f => f.timed.quemado.level), [1, 1, 2]);
});

test('Foc Binari on powder is Estallido in place of its own fire, and fire that fells the carrier still blows its powder up', () => {
  const s = fight(); powder(s, 1);
  turn(s, 'gerard');
  const e = act(s, 'skill', 'dog-1', 'foc-binari');
  assert.equal(e.reaction.id, 'estallido'); assert.equal(e.burn, undefined);
  assert.deepEqual(s.foes.map(f => f.timed.quemado.level), [1, 1, 1]);
  const t = fight(); powder(t, 0); t.foes[0].hp = 1;
  turn(t, 'gerard', 'fuego');
  const hp = t.foes[1].hp, last = act(t, 'attack', 'dog-0');
  assert.equal(t.foes[0].hp, 0); assert.equal(last.reaction.id, 'estallido');
  assert.ok(t.foes[1].hp < hp && t.foes[1].timed.quemado && !t.foes[0].timed?.quemado);
});

test('Envenenado: water on powder leaves poison that pulses and makes every blow land a quarter harder, and no Mojado', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'agua');
  const e = act(s, 'attack', 'dog-0');
  assert.deepEqual(e.reaction, { id: 'veneno', level: 1, targets: ['dog-0'] });
  assert.equal(e.amplified, undefined, 'the blow that poisons is not made heavier by it');
  assert.deepEqual(Object.keys(s.foes[0].timed), ['envenenado']);
  // The same blow on the poisoned one and on a clean one.
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  turn(s, 'aitor'); const heavy = act(s, 'attack', 'dog-0');
  assert.equal(heavy.amount, Math.round(clean * POWDER_RULES.poison));
  assert.deepEqual(heavy.amplified, [{ target: 'dog-0', venom: true }]);
  // It pulses on the fight's clock, and poisoned again it climbs a level and starts over.
  const hp = s.foes[0].hp, pulses = runClock(s, TIMED.envenenado.every);
  assert.deepEqual(pulses, [{ target: 'dog-0', status: 'envenenado', level: 1, amount: pulseDamage('envenenado', 1, 999) }]);
  assert.equal(hp - s.foes[0].hp, pulses[0].amount);
  powder(s, 0); turn(s, 'gerard', 'agua');
  assert.equal(act(s, 'attack', 'dog-0').reaction.level, 2);
  assert.equal(s.foes[0].timed.envenenado.left, TIMED.envenenado.seconds);
  runClock(s, TIMED.envenenado.seconds + .1); assert.equal(s.foes[0].timed.envenenado, undefined);
});

test('water on everyone poisons whoever is powdered and leaves the rest Mojado', () => {
  const s = fight(['matemagico:vasos']); powder(s, 1);
  turn(s, 'gerard');
  const e = act(s, 'skill', undefined, 'vasos');
  assert.deepEqual(e.hits.map(h => h.burn), [{ id: 'mojado', level: 1 }, { id: 'envenenado', level: 1 }, { id: 'mojado', level: 1 }]);
  assert.equal(e.reaction.id, 'veneno'); assert.deepEqual(e.reaction.targets, ['dog-1']);
  assert.ok(!s.foes[1].timed.mojado && !s.foes[1].timed.empolvado && s.foes[1].timed.envenenado);
});

test('Cristalizado: electricity on powder leaves shards, and each blow that lands does more than the one before, up to a cap', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'electrico');
  const e = act(s, 'attack', 'dog-0');
  assert.deepEqual(e.reaction, { id: 'cristal', targets: ['dog-0'] });
  assert.equal(e.amplified, undefined, 'the bolt that sets them is not driven in by them');
  assert.deepEqual(Object.keys(s.foes[0].timed), ['cristalizado']); assert.equal(s.foes[0].timed.cristalizado.level, 1);
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  const extras = [];
  for (let i = 0; i < 7; i++) { turn(s, 'aitor'); const blow = act(s, 'attack', 'dog-0'); extras.push(blow.amount - clean); assert.deepEqual(blow.amplified, [{ target: 'dog-0', shards: blow.amount - clean }]); }
  assert.deepEqual(extras, [4, 8, 12, 16, 20, 20, 20]);
  assert.equal(POWDER_RULES.shard * POWDER_RULES.shards, 20);
  // Crystallised again: the shards stay as deep, the clock starts over. Then it runs out.
  runClock(s, 5); powder(s, 0); turn(s, 'gerard', 'electrico'); act(s, 'attack', 'dog-0');
  assert.equal(s.foes[0].timed.cristalizado.level, 5); assert.equal(s.foes[0].timed.cristalizado.left, TIMED.cristalizado.seconds);
  runClock(s, TIMED.cristalizado.seconds + .1); assert.equal(s.foes[0].timed.cristalizado, undefined);
});

test('poison and shards together: the quarter first, the shards on top', () => {
  const s = fight();
  s.foes[0].timed = { envenenado: { level: 1, left: 20, next: 20 }, cristalizado: { level: 2, left: 20, next: 20 } };
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  turn(s, 'aitor'); const blow = act(s, 'attack', 'dog-0');
  assert.equal(blow.amount, Math.round(clean * POWDER_RULES.poison) + 2 * POWDER_RULES.shard);
  assert.deepEqual(blow.amplified, [{ target: 'dog-0', shards: 8, venom: true }]);
});
