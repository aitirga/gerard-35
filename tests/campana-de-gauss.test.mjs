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
  assert.ok(centre >= count / 4, 'about half on the foe picked');
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
