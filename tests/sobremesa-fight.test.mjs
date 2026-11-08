import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createFearBattle, enemyAct, intentLabel, nextRound, NOTES, SKILLS, SOBREMESA, SOBREMESA_FRIENDS, shieldRounds } from '../src/battle.ts';
import { fightXp } from '../src/levels.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
const fight = () => {
  const s = createFearBattle(party, 'sobremesa', undefined, () => .5);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; });
  return s;
};
const friend = (s, id) => s.foes.find(f => f.id === id);
const turn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
const free = (s, ...ids) => ids.forEach(id => { friend(s, id).hp = 0; });

test('La Sobremesa is seven friends, each a foe of their own, and Joan starts on Do', () => {
  const s = fight();
  assert.deepEqual(s.foes.map(f => f.id), [...SOBREMESA_FRIENDS]);
  assert.ok(s.foes.every(f => !f.part && f.hp > 0));
  assert.equal(intentLabel(s, friend(s, 'joan')), 'Escala · Do');
});

test('Tirada takes as many in a hundred of the target\'s PV as the dice add up to', () => {
  const s = fight();
  const e = turn(s, 'alvaro', 'gerard');
  assert.equal(e.ability.id, 'tirada');
  assert.equal(e.dice.length, SOBREMESA.dice);
  assert.equal(e.amount, Math.round(9999 * e.dice.reduce((a, b) => a + b, 0) * SOBREMESA.pip / 100));
});

test('Álvaro and Anna announce their duo, and then throw four dice with both turns', () => {
  const s = fight();
  friend(s, 'alvaro').turns = SOBREMESA.duoEvery - 1;
  const told = turn(s, 'alvaro', 'aitor');
  assert.equal(told.telegraph.id, 'duo-tirada');
  assert.equal(intentLabel(s, friend(s, 'anna')), 'Dúo · Tirada → Aitor');
  const thrown = turn(s, 'alvaro', 'gerard');
  assert.equal(thrown.ability.id, 'duo-tirada');
  assert.equal(thrown.target, 'aitor', 'it lands on whom they marked');
  assert.equal(thrown.dice.length, SOBREMESA.duoDice);
  assert.ok(s.enemyActions.includes('anna'), 'Anna\'s turn went into it');
});

test('a duo with a partner freed does not go off', () => {
  const s = fight();
  friend(s, 'alvaro').turns = SOBREMESA.duoEvery - 1;
  turn(s, 'alvaro', 'aitor');
  free(s, 'anna');
  const e = turn(s, 'alvaro', 'gerard');
  assert.equal(e.ability.id, 'tirada');
  assert.equal(e.cancelled, 'duo-tirada');
  assert.equal(e.dice.length, SOBREMESA.dice);
});

test('Carta negra is announced on someone, then falls on them', () => {
  const s = fight();
  const told = turn(s, 'miquel', 'gerard');
  assert.equal(told.telegraph.id, 'carta-negra');
  assert.equal(told.amount, undefined);
  assert.equal(intentLabel(s, friend(s, 'miquel')), 'Carta negra → Gerard');
  const blow = turn(s, 'miquel', 'aitor');
  assert.equal(blow.target, 'gerard');
  assert.ok(blow.amount > 0);
});

test('Sarah and Miquel\'s duo raises every friend and leaves its mark at 1 PV, unless they hold on', () => {
  for (const guarding of [false, true]) {
    const s = fight();
    friend(s, 'sarah').turns = SOBREMESA.duoEvery - 1;
    turn(s, 'sarah', 'gerard');
    assert.equal(intentLabel(s, friend(s, 'miquel')), 'Dúo · Regla nueva → Gerard');
    const rule = turn(s, 'sarah', 'aitor');
    assert.equal(rule.ability.id, 'duo-regla');
    assert.ok(s.foes.every(f => f.lasting?.shifts.fuerza === SOBREMESA.regla));
    s.allies[0].guarding = guarding;
    s.phase = 'enemy';
    const blow = enemyAct(s, 'miquel', 'aitor');
    assert.equal(blow.target, 'gerard');
    if (guarding) assert.ok(s.allies[0].hp > 1, 'held on');
    else assert.equal(s.allies[0].hp, 1);
  }
});

test('Joan climbs his scale on every turn and Soraya\'s Corrección climbs it one more; his blow grows with the note', () => {
  const s = fight();
  const first = turn(s, 'joan', 'gerard');
  assert.equal(intentLabel(s, friend(s, 'joan')), 'Escala · Re');
  assert.ok(first.splash.length === 1, 'it reaches both');
  const fixed = turn(s, 'soraya', 'gerard');
  assert.equal(fixed.ability.id, 'correccion');
  assert.equal(intentLabel(s, friend(s, 'joan')), 'Escala · Mi');
  const louder = turn(s, 'joan', 'gerard');
  assert.ok(louder.amount > first.amount);
  friend(s, 'joan').note = 99; turn(s, 'soraya', 'gerard');
  assert.equal(friend(s, 'joan').note, NOTES.length - 1, 'Si is the top');
});

test('Joan and Soraya need each other: with one freed, the other loses their turn', () => {
  const s = fight();
  free(s, 'soraya');
  const joan = turn(s, 'joan', 'gerard');
  assert.equal(joan.cancelled, 'escala'); assert.equal(joan.amount, undefined);
  const t = fight();
  free(t, 'joan');
  assert.equal(turn(t, 'soraya', 'gerard').cancelled, 'correccion');
});

test('Cortafuegos halves the next blow on the friend Nico shields, once', () => {
  const s = fight();
  friend(s, 'anna').hp = 30;
  const shield = turn(s, 'nico', 'gerard');
  assert.equal(shield.shielded, 'anna', 'the friend most hurt');
  s.round++; s.phase = 'player'; s.active = 0;
  assert.ok(shieldRounds(s, friend(s, 'anna')));
  const unshielded = fight(); unshielded.phase = 'player';
  const plain = act(unshielded, 'attack', 'anna');
  const halved = act(s, 'attack', 'anna');
  assert.equal(halved.shield, 'spent');
  assert.ok(halved.amount < plain.amount);
  assert.equal(shieldRounds(s, friend(s, 'anna')), 0);
});

test('a freed friend takes no turn, and the fight is won when all seven are freed', () => {
  const s = fight();
  free(s, 'alvaro');
  assert.equal(turn(s, 'alvaro', 'gerard'), undefined);
  free(s, ...SOBREMESA_FRIENDS.filter(id => id !== 'nico'));
  friend(s, 'nico').hp = 1;
  s.phase = 'player'; s.active = 0;
  act(s, 'attack', 'nico');
  assert.equal(s.phase, 'won');
  assert.ok(fightXp(s) > 90);
  s.phase = 'enemy'; s.enemyActions = SOBREMESA_FRIENDS.slice();
  assert.deepEqual(nextRound(s), []);
});

test('no rule of La Sobremesa asks for a skill or an ánima by name', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/battle.ts', import.meta.url), 'utf8');
  const start = source.indexOf('/** A friend of La Sobremesa still held'), end = source.indexOf('/** Vertitrón and its eye, in its fight. */');
  const rules = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const id of [...SKILLS.map(s => s.id), 'papagato', 'matemagico', 'tecnopata']) assert.ok(!rules.includes(`'${id}'`), id);
});

test('the picker stages La Sobremesa\'s moments, only in its own fight', async () => {
  const { stageMoment } = await import('../src/battle.ts');
  const s = fight();
  assert.ok(stageMoment(s, 'sobremesa-duo-carta'));
  assert.equal(intentLabel(s, friend(s, 'miquel')), 'Dúo · Regla nueva → Gerard');
  assert.ok(stageMoment(s, 'sobremesa-escala-alta'));
  assert.equal(intentLabel(s, friend(s, 'joan')), 'Escala · La');
  assert.ok(stageMoment(s, 'sobremesa-ultimo'));
  assert.deepEqual(s.foes.filter(f => f.hp > 0).map(f => f.id), ['miquel']);
  assert.equal(s.phase, 'player');
  const other = createFearBattle(party, 'plato', undefined, () => .5);
  assert.equal(stageMoment(other, 'sobremesa-ultimo'), false);
});

test('Anna\'s Sopeta hits someone and gives every friend still held some PV back', () => {
  const s = fight();
  for (const f of s.foes) f.hp = Math.round(f.maxHp / 2);
  free(s, 'nico');
  const e = turn(s, 'anna', 'aitor');
  assert.equal(e.ability.id, 'sopeta');
  assert.equal(e.ability.name, 'Sopeta');
  assert.ok(e.amount > 0, 'it hits');
  assert.deepEqual(e.soothed.map(h => h.target).sort(), SOBREMESA_FRIENDS.filter(id => id !== 'nico').sort(), 'the freed are not fed');
  for (const h of e.soothed) assert.equal(h.amount, Math.max(1, Math.round(friend(s, h.target).maxHp * SOBREMESA.sopetaHeal)));
});
