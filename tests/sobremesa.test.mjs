import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACK_TIME, BONES, FREE_TIME, FRIENDS, pose, strike } from '../src/sobremesa.ts';

test('an attack draws back, lunges forward and settles', () => {
  assert.equal(strike(0), 0);
  assert.ok(strike(.3) < -.9, 'drawn back');
  assert.ok(strike(.55) > 1.3, 'lunging');
  assert.equal(strike(1), 0);
});

test('an attacking friend leans forward at the strike; the others do not lunge', () => {
  const at = .5 * ATTACK_TIME;
  const p = pose(at, { Miquel: { kind: 'attack', since: 0 } });
  assert.ok(p.Miquel.shift[2] > .08);
  assert.equal(p.Anna.shift[2], 0);
  assert.ok(p['Brazo derecho'].turn[0] > 10, 'his arm goes with it');
});

test('a freed friend goes limp and stays still, and the mass sinks as they come away', () => {
  const later = pose(FREE_TIME * 3, { Nico: { kind: 'free', since: 0 } }), muchLater = pose(FREE_TIME * 9, { Nico: { kind: 'free', since: 0 } });
  assert.deepEqual(later.Nico, muchLater.Nico);
  assert.ok(later.Nico.turn[0] > 30);
  const all = Object.fromEntries(FRIENDS.map(f => [f, { kind: 'free', since: 0 }]));
  assert.ok(pose(10, all)['Raíz'].shift[1] < pose(10)['Raíz'].shift[1] - .02);
});

test('the rig data names the same bones the game moves', () => {
  const rig = JSON.parse(readFileSync(new URL('../assets/models/sobremesa/rig.json', import.meta.url)));
  assert.deepEqual(rig.bones.map(b => b.name).sort(), [...BONES].sort());
});

test('each move has its own motion: Anna bends to the pot, Miquel holds his card up high, Nico spreads his claws', () => {
  const mid = .3 * ATTACK_TIME, plain = pose(mid, { Anna: { kind: 'attack', since: 0 } });
  const soup = pose(mid, { Anna: { kind: 'attack', since: 0, move: 'sopeta' } });
  assert.ok(soup.Anna.shift[1] < plain.Anna.shift[1] - .02, 'she bends down');
  const card = pose(mid, { Miquel: { kind: 'attack', since: 0, move: 'carta-negra', warn: true } });
  assert.ok(card['Brazo derecho'].turn[0] < -30 && card['Brazo derecho'].shift[1] > .08, 'the card up high');
  const wall = pose(.5 * ATTACK_TIME, { Nico: { kind: 'attack', since: 0, move: 'cortafuegos' } });
  assert.ok(wall['Garra izquierda'].turn[2] > 25 && wall['Garra derecha'].turn[2] < -25, 'claws spread');
});
