import test from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE, CYCLE_LENGTH, LIGHTS, LIGHT_IDS, cancels, changes, lightAt, untilFree, upcoming } from '../src/vidrieras.ts';
import { ELEMENTS, act, annulled, createFearBattle, enemyAct, lightNow, runClock, takeLightNews } from '../src/battle.ts';

test('the light walks from the cold morning to the warm afternoon, and round again', () => {
  assert.deepEqual(CYCLE.map(s => s.light), ['azul', 'verde', 'naranja', 'rojo', 'oro']);
  assert.equal(lightAt(0).light, 'azul');
  assert.equal(lightAt(8).light, 'verde');
  assert.equal(lightAt(14).light, 'naranja');
  assert.equal(lightAt(CYCLE_LENGTH + 1).light, 'azul');
  assert.equal(lightAt(CYCLE_LENGTH + 1).loop, 1);
  assert.deepEqual(upcoming(0), ['verde', 'naranja']);
  assert.deepEqual(changes(7, 15), ['verde', 'naranja']);
  assert.deepEqual(changes(0, 0), []);
});

test('each light eats one of the elements, in its own colour; green eats none', () => {
  assert.equal(cancels('azul'), 'agua');
  assert.equal(cancels('naranja'), 'fuego');
  assert.equal(cancels('rojo'), 'fuego');
  assert.equal(cancels('oro'), 'electrico');
  assert.equal(cancels('verde'), undefined);
  assert.equal(cancels('blanca'), 'fisico', 'white carries no element: it eats the physical blows');
  for (const id of LIGHT_IDS) { const element = cancels(id); if (element && element !== 'fisico') assert.ok(element in ELEMENTS, id); }
  // No pink and no violet: those are the Queen's and fear's (docs/visual-style.md).
  for (const id of LIGHT_IDS) assert.ok(!/^#(ff6fae|d94a8c|c9a2ff)$/i.test(LIGHTS[id].colour), id);
  assert.equal(untilFree(14, 'fuego'), 7 + 7, 'orange and red both eat fire: free again in gold');
  assert.equal(untilFree(0, 'fuego'), 0);
});

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const fight = () => {
  const s = createFearBattle(party, 'cebollon', undefined, () => 0);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; a.secondary = a.maxSecondary = 99; });
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; delete f.layers; });
  return s;
};

test('in the salon the light eats the party\'s blow of its element, whole, and says which', () => {
  const s = fight();
  s.light = { t: 15 };
  assert.equal(lightNow(s), 'naranja');
  s.phase = 'player'; s.active = 0;
  const fire = act(s, 'skill', s.foes[0].id, 'foc-binari');
  assert.equal(fire.amount, 0);
  assert.equal(fire.annulled, 'naranja');
  assert.equal(s.foes[0].hp, 9999);
  assert.equal(s.foes[0].timed?.quemado, undefined, 'nothing lit either');
  assert.match(s.message, /luz naranja/);
});

test('a plain blow goes through any light, fire goes through a light that is not its own, and outside the salon nothing is eaten', () => {
  const s = fight();
  s.light = { t: 15 };
  s.phase = 'player'; s.active = 0;
  assert.ok(act(s, 'attack', s.foes[0].id).amount > 0);
  const t = fight();
  t.light = { t: 1 };
  t.phase = 'player'; t.active = 0;
  assert.ok(act(t, 'skill', t.foes[0].id, 'foc-binari').amount > 0, 'blue eats water, not fire');
  const u = fight();
  assert.equal(annulled(u, u.allies[0], 'fuego'), undefined);
});

test('the foes are never touched by the light', () => {
  const s = fight();
  s.light = { t: 15 };
  assert.equal(annulled(s, s.foes[0], 'fuego'), undefined);
  s.phase = 'enemy'; s.enemyActions = [];
  const hit = enemyAct(s, s.foes[0].id, 'gerard');
  assert.ok(!hit?.annulled);
});

test('the fight\'s clock walks the light and tells each new one once', () => {
  const s = fight();
  s.light = { t: 0 };
  s.phase = 'player';
  runClock(s, 9);
  assert.equal(lightNow(s), 'verde');
  assert.deepEqual(takeLightNews(s), ['verde']);
  assert.deepEqual(takeLightNews(s), []);
});

test('the white light eats the party\'s physical blows, Atacar and a physical skill, and lets magic through', () => {
  const s = fight();
  s.light = { t: 22, walk: 'nacimiento' };
  assert.equal(lightNow(s), 'blanca', 'the Nativity side: blue, green, orange, then white');
  s.phase = 'player'; s.active = 0;
  const fist = act(s, 'attack', s.foes[0].id);
  assert.equal(fist.amount, 0);
  assert.equal(fist.annulled, 'blanca');
  assert.match(s.message, /luz blanca/);
  assert.equal(annulled(s, s.allies[1], undefined, 'physical'), 'blanca');
  assert.equal(annulled(s, s.allies[1], 'fuego', 'magic'), undefined, 'magic goes through, fire too');
  assert.equal(annulled(s, s.foes[0], undefined, 'physical'), undefined, 'the foes are never touched');
});
