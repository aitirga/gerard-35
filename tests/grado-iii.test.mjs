import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, dualBlock, createBattle, enemyAct, nextRound, improve, inflict, fireTop, pulseDamage, runClock, bitsOf, BITS, COMBUSTION, FIRE_TOP, MANA_POINTS, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Grade III (docs/animas/matemagico/README.md and docs/animas/tecnopata/README.md § Grade III):
// Vulcano, Combustión (fire's fourth level) and Reinicio.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const FIRE = ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo'];
function fight(nodes = [], dogs = 3) {
  const s = createBattle(PARTY, dogs, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const fireAt = (level, left = TIMED.quemado.seconds) => ({ level, left, next: TIMED.quemado.every });

test('without Combustión fire stops at III; with it, a fourth level that pulses harder', () => {
  const s = fight(FIRE);
  assert.equal(fireTop(s), FIRE_TOP);
  s.foes[0].timed = { quemado: fireAt(3) };
  turn(s, 'gerard'); act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(s.foes[0].timed.quemado.level, 3);
  const c = fight([...FIRE, 'matemagico:combustion']);
  assert.equal(fireTop(c), COMBUSTION.level);
  c.foes[0].timed = { quemado: fireAt(3) };
  turn(c, 'gerard');
  const e = act(c, 'skill', 'dog-0', 'foc-binari');
  assert.equal(c.foes[0].timed.quemado.level, 4); assert.deepEqual(e.burn, { id: 'quemado', level: 4 });
  assert.ok(pulseDamage('quemado', 4, 260) > pulseDamage('quemado', 3, 260));
  // Only while the one who wears Matemágico stands.
  by(c, 'gerard').hp = 0; assert.equal(fireTop(c), FIRE_TOP);
});

test('Combustión: a physical blow on a fire at IV makes it burst on every foe; the others burn a level more and it goes back to III', () => {
  const s = fight([...FIRE, 'matemagico:combustion']);
  s.foes[0].timed = { quemado: fireAt(4) }; s.foes[1].timed = { quemado: fireAt(1) };
  s.foes[2].timed = { mojado: { level: 1, left: 20, next: 20 } };
  turn(s, 'aitor');
  const hp = s.foes.map(f => f.hp), e = act(s, 'attack', 'dog-0');
  assert.equal(e.combustion.target, 'dog-0');
  assert.deepEqual(e.combustion.hits.map(h => h.target), ['dog-0', 'dog-1', 'dog-2']);
  assert.ok(e.combustion.hits.every(h => h.amount >= COMBUSTION.blast - 4));
  assert.equal(s.foes[0].timed.quemado.level, COMBUSTION.after);
  assert.equal(s.foes[1].timed.quemado.level, 2);
  assert.equal(s.foes[2].timed.quemado, undefined, 'a wet one is Vapor'); assert.deepEqual(e.combustion.steamed, ['dog-2']);
  assert.ok(s.foes[1].hp < hp[1]);
  assert.equal(e.passives[0].id, 'combustion');
  // Magic sets nothing off.
  s.foes[1].timed.quemado.level = 4; turn(s, 'gerard');
  assert.equal(act(s, 'skill', 'dog-1', 'foc-binari').combustion, undefined);
  // Without the passive, a physical blow is only a blow.
  const plain = fight(FIRE); plain.foes[0].timed = { quemado: fireAt(4) }; turn(plain, 'aitor');
  assert.equal(act(plain, 'attack', 'dog-0').combustion, undefined);
});

test('Combustión holds for any physical blow, a confused foe\'s on one of its own too', () => {
  const s = fight([...FIRE, 'matemagico:combustion', 'tecnopata:confusion', 'tecnopata:control-remoto'], 2);
  s.foes[1].timed = { quemado: fireAt(4) };
  turn(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'control-remoto');
  assert.equal(e.controlled.victim, 'dog-1'); assert.equal(e.combustion.target, 'dog-1');
});

test('Reinicio: every clock on every foe starts over from its whole time; a cure is never one of them', () => {
  const s = fight(['tecnopata:explosion', 'tecnopata:telemetria', 'tecnopata:reinicio']);
  s.foes[0].timed = { quemado: fireAt(2, 1.5), confusion: { level: 1, left: 4, next: 4 } };
  s.foes[1].timed = { mojado: { level: 1, left: 2, next: 2 } };
  const a = turn(s, 'aitor');
  const e = act(s, 'skill', undefined, 'reinicio');
  assert.equal(a.secondary, MANA_POINTS - 3);
  assert.ok(e.hits.every(h => h.amount > 0));
  assert.equal(s.foes[0].timed.quemado.left, TIMED.quemado.seconds); assert.equal(s.foes[0].timed.quemado.level, 2);
  assert.equal(s.foes[0].timed.confusion.left, TIMED.confusion.seconds);
  assert.equal(s.foes[1].timed.mojado.left, TIMED.mojado.seconds);
  assert.deepEqual(e.restarted.map(r => r.target), ['dog-0', 'dog-1']);
  // It never shortens one that had more left (Rayo de energía first).
  s.foes[0].timed.quemado.left = 14; turn(s, 'aitor'); act(s, 'skill', undefined, 'reinicio');
  assert.equal(s.foes[0].timed.quemado.left, 14);
  runClock(s, .1);
});

// Gerard (Matemágico) and Aitor wearing a shared ánima, for the duals with it.
function pair(aitor, nodes = [], dogs = 3) {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: aitor }], dogs, false, undefined, ['matemagico', aitor]);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.phase = 'player'; s.active = 0;
  return s;
}

test('Vulcano, a dúo mayor: Foc Binari and Ostinato, only once its node is bought; fire on every foe and a volcano that raises it every 5 seconds', () => {
  const locked = pair('sincopante', FIRE);
  assert.equal(actDual(locked, 'vulcano'), undefined, 'not without its node');
  const s = pair('sincopante', [...FIRE, 'matemagico:combustion', 'matemagico:vulcano']);
  s.foes[2].timed = { mojado: { level: 1, left: 20, next: 20 } };
  const e = actDual(s, 'vulcano');
  assert.equal(e.dual.id, 'vulcano'); assert.ok(e.hits.every(h => h.amount > 0));
  assert.equal(s.foes[0].timed.quemado.level, 1); assert.ok(s.foes[0].timed.volcan);
  assert.equal(s.foes[2].timed.quemado, undefined, 'a wet foe steams'); assert.equal(e.reaction.id, 'vapor');
  runClock(s, TIMED.volcan.every + .01);
  assert.equal(s.foes[0].timed.quemado.level, 2, 'the first beat');
  runClock(s, TIMED.volcan.every); runClock(s, TIMED.volcan.every);
  assert.equal(s.foes[0].timed.quemado.level, 4, 'with Combustión, up to IV');
  runClock(s, TIMED.volcan.every);
  assert.equal(s.foes[0].timed.volcan, undefined, 'twenty seconds, then it is gone');
});

test('Integral: a cure for everyone hurt in the party at once', () => {
  const s = fight(['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:integral']);
  by(s, 'gerard').hp -= 50; by(s, 'aitor').hp -= 50;
  const g = turn(s, 'gerard'), hp = s.allies.map(a => a.hp);
  const e = act(s, 'skill', undefined, 'integral');
  assert.equal(g.secondary, g.maxSecondary - 3);
  assert.deepEqual(e.cures.map(c => c.target), ['gerard', 'aitor']);
  assert.ok(s.allies.every((a, i) => a.hp > hp[i]));
});

test('Virus atómico: what lands on the infected foe lands on every other foe too', () => {
  const s = fight(['tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus']);
  turn(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'virus');
  assert.ok(s.foes[0].timed.virus); assert.deepEqual(e.afflicted, { id: 'virus', level: 1 });
  assert.equal(e.spread, undefined, 'what it already carried stays its own');
  turn(s, 'gerard');
  const fire = act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(s.foes[1].timed.quemado.level, 1); assert.equal(s.foes[2].timed.quemado.level, 1);
  assert.deepEqual(fire.spread, [{ from: 'dog-0', to: ['dog-1', 'dog-2'], statuses: ['Quemado'] }]);
  turn(s, 'gerard'); act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(s.foes[1].timed.quemado.level, 2, 'a level up spreads too');
  assert.equal(s.foes[1].timed.virus, undefined, 'the virus itself never does');
});

test('Escudo de bits: a wall in front of the party stops half of every blow until it breaks or two rounds pass', () => {
  const s = fight(['tecnopata:rayo-encogedor', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits'], 1);
  turn(s, 'aitor');
  const e = act(s, 'skill', undefined, 'escudo-de-bits');
  assert.deepEqual(e.bits, { raised: 40 });
  const wall = bitsOf(s); assert.equal(wall.hp, 40); assert.equal(by(s, 'gerard').bits, by(s, 'aitor').bits, 'one wall for both');
  s.phase = 'enemy'; s.enemyActions = [];
  const hp = s.allies.map(a => a.hp);
  const blow = enemyAct(s, 'dog-0');
  const lost = s.allies.reduce((sum, a, i) => sum + hp[i] - a.hp, 0);
  assert.ok(blow.bits.took > 0); assert.equal(wall.hp, 40 - blow.bits.took);
  assert.ok(Math.abs(lost - blow.bits.took) <= 1, 'half of it went into the wall');
  nextRound(s); nextRound(s);
  s.round += BITS.rounds; nextRound(s);
});

test('Sobrecalentamiento: Foc Binari and Escudo de bits; the wall goes off as fire over every foe and what is left of it shields the party', () => {
  const s = pair('tecnopata', ['tecnopata:rayo-encogedor', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits']);
  const e = actDual(s, 'sobrecalentamiento');
  assert.equal(e.dual.id, 'sobrecalentamiento'); assert.equal(e.hits.length, 3);
  assert.ok(e.hits.every(h => h.amount > 0 && h.burn.level === 2));
  assert.equal(bitsOf(s).hp, 20); assert.deepEqual(e.bits, { raised: 20 });
});
