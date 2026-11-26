import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, actDual, improve, skillsFor, ultiProgress, ultiReady, awakeUlti, overtimeReady, overtime, tired, wearAnima, runClock, nextRound, enemyAct, dualOptions, plateMarks, takeTurn, HORAS_EXTRA, DEFEND_CHARGE, SKILLS } from '../src/battle.ts';

// Horas extra (docs/animas/matemagico/README.md § Definitiva): wakes with every foe standing at Quemado III at once,
// then three actions in a row with no maná, then Agotado for a round.
const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico', kit: ['matemagico', 'papagato'] }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const fight = (foes = 2, bought = true) => {
  const s = createBattle(party, foes, false, undefined, ['matemagico', 'papagato', 'tecnopata']);
  s.seed = 7; s.levels = { matemagico: 5, papagato: 5, tecnopata: 5 };
  improve(s, { elements: { matemagico: ['fuego'] }, skills: [...bought ? ['horas-extra'] : [], 'factor-comun', 'integral'] });
  for (const foe of s.foes) foe.hp = foe.maxHp = 9999;
  return s;
};
const burn = (foe, level) => { foe.timed = { ...foe.timed, quemado: { level, left: 10, next: 2 } }; };
const gerard = s => s.allies[0], aitor = s => s.allies[1];

test('Horas extra is the fixed shape of an abstract definitiva of Matemágico, and its book', () => {
  const spec = SKILLS.find(x => x.id === 'horas-extra');
  assert.equal(spec.class, 'matemagico'); assert.equal(spec.cost, 0); assert.ok(spec.ulti); assert.ok(spec.abstract);
  assert.equal(spec.description, 'Quien la usa actúa tres veces seguidas sin gastar maná. Después queda agotado: durante una ronda solo puede atacar o defender.');
  assert.deepEqual(HORAS_EXTRA, { wake: 3, actions: 3, spent: 1 });
});

test('it wakes the moment every foe standing is at Quemado III at once, and the sleeping row counts them', () => {
  const s = fight(3), g = gerard(s);
  burn(s.foes[0], 3); burn(s.foes[1], 3); burn(s.foes[2], 2);
  assert.deepEqual(ultiProgress(s, g), { skill: 'horas-extra', name: 'Horas extra', have: 2, need: 3 });
  assert.equal(overtimeReady(s), false);
  // A foe falling never breaks it: only those standing count.
  s.foes[2].hp = 0;
  const effect = act(s, 'defend');
  assert.equal(effect.awoken, 'horas-extra'); assert.ok(overtimeReady(s)); assert.ok(ultiReady(s, 'horas-extra'));
  assert.equal(awakeUlti(s, g).id, 'horas-extra'); assert.equal(ultiProgress(s, g), undefined);
});

test('it needs the definitiva bought and Matemágico worn by someone standing', () => {
  const unbought = fight(2, false);
  unbought.foes.forEach(f => burn(f, 3));
  assert.equal(act(unbought, 'defend').awoken, undefined);
  const unworn = fight(2);
  unworn.foes.forEach(f => burn(f, 3));
  assert.ok(wearAnima(unworn, 'papagato'));
  assert.equal(act(unworn, 'defend').awoken, undefined);
});

test('against a boss with parts only the body counts', () => {
  const s = fight(2), g = gerard(s);
  s.foes[1].part = true;
  burn(s.foes[0], 3);
  assert.deepEqual(ultiProgress(s, g), { skill: 'horas-extra', name: 'Horas extra', have: 1, need: 1 });
  assert.equal(act(s, 'defend').awoken, 'horas-extra');
});

test('a fire raised to III by the clock wakes it too, said on the pulse', () => {
  const s = fight(1);
  burn(s.foes[0], 2);
  s.foes[0].timed.volcan = { level: 1, left: 10, next: .5 };
  const pulses = runClock(s, 1);
  assert.equal(s.foes[0].timed.quemado.level, 3);
  assert.ok(pulses.some(p => p.awoken === 'horas-extra'));
});

test('three actions in a row, none spending maná, no dual nor definitiva among them; ánima changes allowed', () => {
  const s = fight(2), g = gerard(s);
  s.overtime = { woke: true };
  g.secondary = 0;
  const cast = act(s, 'skill', undefined, 'horas-extra');
  assert.deepEqual(cast.overtime, { step: 0, of: 3 });
  assert.ok(overtime(s, g)); assert.equal(s.active, 0, 'the turn stays');
  assert.ok(!skillsFor(s, g).some(x => 'ulti' in x), 'no definitiva among its actions');
  assert.ok(dualOptions(s).every(o => !o.ok), 'nor a dual');
  assert.equal(takeTurn(s, 'aitor'), false, 'nobody else takes the turn meanwhile');
  assert.ok(plateMarks(s, g).includes('horas-extra'));
  // A skill with no maná to pay it goes, and the maná is as it was.
  const pyramid = act(s, 'skill', undefined, 'factor-comun');
  assert.ok(pyramid, 'a skill it could not pay goes'); assert.deepEqual(pyramid.overtime, { step: 1, of: 3 });
  assert.equal(g.secondary, 0); assert.equal(s.active, 0);
  // Another ánima for the second.
  assert.ok(wearAnima(s, 'papagato'));
  g.secondary = 0;
  const before = g.secondary;
  const second = act(s, 'skill', 'dog-0', 'zarpazo');
  assert.deepEqual(second.overtime, { step: 2, of: 3 }); assert.ok(g.secondary >= before);
  assert.equal(s.active, 0);
  const third = act(s, 'attack', 'dog-1');
  assert.deepEqual(third.overtime, { step: 3, of: 3 });
  assert.ok(!overtime(s, g)); assert.equal(s.extra, undefined);
  assert.equal(s.allies[s.active].id, 'aitor', `spent, the turn moves on (${s.phase}, ${s.spent})`);
  assert.ok(s.overtime.used); assert.equal(overtimeReady(s), false);
});

test('then Agotado for a round: only Atacar or Defender, and Defender gathers no maná', () => {
  const s = fight(2), g = gerard(s);
  s.foes.forEach(f => burn(f, 3));
  act(s, 'defend');
  s.active = 0; delete s.spent;
  act(s, 'skill', undefined, 'horas-extra');
  for (let i = 0; i < HORAS_EXTRA.actions; i++) act(s, 'attack', 'dog-0');
  assert.ok(tired(s, g)); assert.ok(plateMarks(s, g).includes('agotado'));
  act(s, 'defend');
  while (s.phase === 'enemy') { const f = s.foes.find(x => x.hp > 0 && !s.enemyActions.includes(x.id)); if (!f) { nextRound(s); break; } enemyAct(s, f.id); }
  assert.equal(s.phase, 'player'); s.active = 0;
  assert.ok(tired(s, g), 'the round after');
  assert.deepEqual(skillsFor(s, g), []);
  g.secondary = 0;
  const held = act(s, 'defend');
  assert.equal(held.charged, 0); assert.equal(g.secondary, 0);
  assert.ok(DEFEND_CHARGE > 0);
  s.round++;
  assert.ok(!tired(s, g), 'and over after it');
});

test('Sin límites lets it go again, as any definitiva', () => {
  const s = fight(2), g = gerard(s);
  s.unbound = true;
  assert.ok(overtimeReady(s));
  act(s, 'skill', undefined, 'horas-extra');
  for (let i = 0; i < HORAS_EXTRA.actions; i++) act(s, 'attack', 'dog-0');
  assert.ok(overtimeReady(s), 'awake again');
  assert.ok(actDual !== undefined);
});
