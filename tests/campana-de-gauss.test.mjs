import test from 'node:test';
import assert from 'node:assert/strict';
import { actDual, BELL, createBattle, DUALS, dualSingle, rainCount, RACHA, TIMED, CRECIDA, waterOf } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Campana de Gauss (Matemágico's Pirámide ígnea + Dadista's Dados astrales): dice of fire, half on the foe picked and
// the rest beside it, its fire to III at least and theirs to II (docs/animas/README.md § Combined skills).
const LEVELS = { papagato: 7, dadaista: 7, sincopante: 7, prismatico: 7, freatica: 7 };
const NODES = ['matemagico:fuego', 'matemagico:factor-comun'];
/** Gerard on Matemágico with Pirámide ígnea, Aitor on Dadista, against `foes` sturdy dogs; Gerard to act. */
function pair(foes = 3, seed = 7) {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'dadaista' }], foes, false, undefined, ['matemagico', 'dadaista']);
  s.levels = { ...LEVELS };
  s.improved = improvedBy(NODES);
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.phase = 'player'; s.active = 0; s.seed = seed;
  for (const ally of s.allies) ally.secondary = ally.maxSecondary;
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** How many dice it drops for Aitor as he is now: his die is spent first, one more for the Racha. */
const expected = s => { const look = structuredClone(s); by(look, 'aitor').racha = (by(look, 'aitor').racha ?? 0) + 1; return Math.min(BELL.most, BELL.base + rainCount(look, by(look, 'aitor'))); };

test('Campana de Gauss is a dual of Pirámide ígnea and Dados astrales, on one foe picked', () => {
  const d = DUALS.find(x => x.id === 'campana-de-gauss');
  assert.deepEqual(d.parts, ['factor-comun', 'dados-astrales']);
  assert.ok(dualSingle(d), 'both players pick the same foe');
});

test('Campana de Gauss: half the dice on the foe picked, the rest beside it; its fire to III at least, theirs to II', () => {
  const s = pair();
  const count = expected(s);
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(e.dual.id, 'campana-de-gauss');
  assert.equal(e.bell.length, count, 'base dice and the Dados astrales count');
  assert.ok(e.bell.every(die => die.amount > 0));
  const centre = e.bell.filter(die => die.target === 'dog-1').length;
  assert.equal(centre, Math.ceil(count / 2), 'half on the foe picked, rounded up');
  assert.equal(e.hits[0].target, 'dog-1', 'the foe picked comes first in its hits');
  for (const die of e.bell) assert.equal(die.side, die.target === 'dog-0' ? -1 : die.target === 'dog-2' ? 1 : 0);
  assert.equal(s.foes[1].timed.quemado.level, 3);
  for (const foe of [s.foes[0], s.foes[2]]) {
    if (e.bell.some(die => die.target === foe.id)) assert.equal(foe.timed.quemado.level, 2, foe.id);
    else assert.equal(foe.timed?.quemado, undefined, `${foe.id}: no die, no fire`);
  }
  assert.equal(e.amount, e.bell.reduce((sum, die) => sum + die.amount, 0));
  assert.equal(e.crit, undefined, 'never a golpe crítico');
});

test('Campana de Gauss never lowers a fire, and only shapes it: one at III beside stays at III', () => {
  const s = pair(3, 11);
  s.foes[2].timed = { quemado: { level: 3, left: 2, next: 1 } };
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  if (e.bell.some(die => die.target === 'dog-2')) { assert.equal(s.foes[2].timed.quemado.level, 3); assert.equal(s.foes[2].timed.quemado.left, TIMED.quemado.seconds, 'its clock over'); }
});

test('Campana de Gauss: a side with nobody falls to the foe picked; a foe alone takes them all', () => {
  const end = pair();
  const e = actDual(end, 'campana-de-gauss', 'dog-0');
  assert.ok(e.bell.every(die => die.target !== 'dog-2'), 'the far foe is not beside it');
  assert.ok(e.bell.every(die => die.side !== -1));
  const alone = pair(1);
  const count = expected(alone);
  const lone = actDual(alone, 'campana-de-gauss', 'dog-0');
  assert.equal(lone.bell.length, count);
  assert.ok(lone.bell.every(die => die.target === 'dog-0' && die.side === 0));
  assert.equal(alone.foes[0].timed.quemado.level, 3);
});

test('Campana de Gauss: more Crítico, more dice; and it spends the Racha', () => {
  const plain = pair(), lucky = pair();
  by(lucky, 'aitor').racha = 6;
  const few = actDual(plain, 'campana-de-gauss', 'dog-1').bell.length;
  const e = actDual(lucky, 'campana-de-gauss', 'dog-1');
  assert.ok(e.bell.length > few, `${e.bell.length} > ${few}`);
  assert.ok(e.bell.length <= BELL.most);
  assert.equal(by(lucky, 'aitor').racha, 0, 'the Racha is spent');
  assert.equal(e.starred, 7, 'all of it, with the die its half was paid with');
  assert.ok(RACHA.crit > 0);
  const many = pair();
  by(many, 'aitor').racha = 40;
  assert.equal(actDual(many, 'campana-de-gauss', 'dog-1').bell.length, BELL.most, 'never more than its most');
});

test('Campana de Gauss: water goes up in Vapor instead of burning, the pringue melts', () => {
  const s = pair();
  s.foes[1].timed = { mojado: { level: 1, left: 20, next: 20 } };
  s.foes[1].shell = true;
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(s.foes[1].shell, false); assert.ok(e.melted);
  assert.equal(s.foes[1].timed.quemado, undefined, 'the water takes the fire');
  assert.ok(s.foes[1].timed.cegado); assert.equal(e.reaction.id, 'vapor');
  assert.ok(e.bell.filter(die => die.target === 'dog-1').every(die => die.amount > 0), 'the first die melts it and still lands');
  const held = pair();
  held.foes[1].timed = { agua: { level: 2, left: CRECIDA.mark, next: CRECIDA.mark }, mojado: { level: 1, left: 20, next: 20 } };
  actDual(held, 'campana-de-gauss', 'dog-1');
  assert.equal(waterOf(held.foes[1]), 1, 'water held under it loses a mark');
});

test('Campana de Gauss: on every seed the foe picked takes at least half the dice and burns at III', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = pair(3, seed);
    by(s, 'aitor').racha = seed % 9;
    const e = actDual(s, 'campana-de-gauss', 'dog-1');
    const mine = e.bell.filter(die => die.target === 'dog-1').length;
    assert.ok(mine >= e.bell.length / 2, `seed ${seed}: ${mine} of ${e.bell.length}`);
    const left = e.bell.filter(die => die.target === 'dog-0').length, right = e.bell.filter(die => die.target === 'dog-2').length;
    assert.ok(Math.abs(left - right) <= 1, `seed ${seed}: ${left} / ${right}, the rest split evenly`);
    assert.equal(s.foes[1].timed.quemado.level, 3, `seed ${seed}`);
  }
});

test('Campana de Gauss: once the foe picked falls, its dice go to those beside it, and none land on the fallen', () => {
  const s = pair(3, 5);
  s.foes[1].hp = 5;
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(s.foes[1].hp, 0);
  const onFallen = e.bell.filter(die => die.target === 'dog-1');
  assert.equal(onFallen.length, 1, 'one die is enough');
  assert.ok(e.bell.length > 3 && e.bell.every(die => die.target === 'dog-1' || die.amount > 0), 'every other die still hurts');
  assert.equal(e.bell.length, expected(pair(3, 5)), 'none of its half is wasted');
  for (const die of e.bell) assert.equal(die.side, die.target === 'dog-0' ? -1 : die.target === 'dog-2' ? 1 : 0);
  const alone = pair(1);
  alone.foes[0].hp = 5;
  const lone = actDual(alone, 'campana-de-gauss', 'dog-0');
  assert.equal(lone.bell.length, 1, 'nobody left to fall on');
});

test('Campana de Gauss in Fran\'s orange light: nothing lands or burns, and the Racha is still spent', () => {
  const s = pair();
  s.light = { t: 15 };
  by(s, 'aitor').racha = 3;
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(e.annulled, 'naranja');
  assert.equal(e.amount, 0);
  assert.ok(s.foes.every(f => f.hp === 999 && !f.timed?.quemado));
  assert.equal(by(s, 'aitor').racha, 0);
  assert.ok(e.starred > 0);
});

test('Campana de Gauss on ice melts a mark and that foe does not burn, nor is it said to', () => {
  const s = pair(3, 3);
  s.foes[0].timed = { congelado: { level: 3, left: 3 * CRECIDA.ice, next: TIMED.congelado.every } };
  s.foes[0].cracks = 0; s.cold = { used: true, by: 'aitor' };
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.ok(e.bell.some(die => die.target === 'dog-0'));
  assert.equal(s.foes[0].timed.quemado, undefined, 'the ice puts it out');
  assert.equal(s.foes[0].timed.congelado.level, 2, 'a mark melts');
  assert.ok(e.ice.some(i => i.target === 'dog-0' && i.melted));
  assert.equal(e.hits.find(h => h.target === 'dog-0').burn, undefined);
  assert.equal(s.foes[1].timed.quemado.level, 3);
});

test('Campana de Gauss sets powder off first (Estallido), and the foe picked still ends at III', () => {
  const s = pair();
  s.foes[1].timed = { empolvado: { level: 1, left: 20, next: 20 } };
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(e.reaction.id, 'estallido');
  assert.equal(s.foes[1].timed.empolvado, undefined);
  assert.equal(s.foes[1].timed.quemado.level, 3);
});

test('Campana de Gauss does nothing to a foe that turns magic back, and lights no fire on it', () => {
  const s = pair();
  s.foes[0].kind = 'cristalino';
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  const mirror = e.bell.filter(die => die.target === 'dog-0');
  assert.ok(mirror.length > 0 && mirror.every(die => die.amount === 0));
  assert.equal(s.foes[0].hp, 999);
  assert.equal(s.foes[0].timed?.quemado, undefined);
});

test('Campana de Gauss peels one layer off each onion it reaches, however many dice fall on it', () => {
  const s = pair();
  s.foes.forEach(f => { f.layers = 5; });
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.equal(s.foes[1].layers, 4);
  for (const foe of [s.foes[0], s.foes[2]]) assert.equal(foe.layers, e.bell.some(die => die.target === foe.id) ? 4 : 5, foe.id);
  assert.equal(s.foes[1].timed?.quemado, undefined, 'wet layers never catch');
});
