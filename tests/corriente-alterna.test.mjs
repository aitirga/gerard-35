import test from 'node:test';
import assert from 'node:assert/strict';
import { actDual, ALTERNA, createBattle, enemyAct, improve, runClock, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Corriente alterna (Matemágico's Cortocircuito + Sincopante's Crescendo, docs/animas/matemagico/README.md § Duals): the
// blow of Cortocircuito, then a circuit between two foes that strikes one of them every 5 s, in turn and harder each
// time; each beat is a bolt for the reactions and spends the status it reacted with.
const LINE = ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito'];
function pair(nodes = LINE, dogs = 3) {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'sincopante' }], dogs, false, undefined, ['matemagico', 'sincopante']);
  s.levels = { sincopante: 7 };
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.phase = 'player'; s.active = 0;
  for (const ally of s.allies) ally.secondary = ally.maxSecondary;
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const on = (seconds = 20) => ({ level: 1, left: seconds, next: seconds });
/** The next beat, and only it: the pulses of Alterna. */
const beat = (s, first = false) => runClock(s, TIMED.alterna.every + (first ? .01 : 0)).filter(p => p.status === 'alterna');

test('it needs both halves: Cortocircuito bought at the jar, and Crescendo', () => {
  assert.equal(actDual(pair(LINE.slice(0, -1)), 'corriente-alterna', 'dog-0'), undefined);
  assert.ok(actDual(pair(), 'corriente-alterna', 'dog-0'));
});

test('the blow wires its target to the next foe standing in the row, and both carry Alterna', () => {
  const s = pair();
  const e = actDual(s, 'corriente-alterna', 'dog-0');
  assert.ok(e.amount > 0); assert.equal(e.dual.id, 'corriente-alterna');
  assert.deepEqual(e.circuit, ['dog-1', 'dog-0'], 'the other pole first: the first beat goes there');
  assert.deepEqual(e.left, { id: 'alterna', targets: ['dog-1', 'dog-0'] });
  assert.ok(s.foes[0].timed.alterna && s.foes[1].timed.alterna); assert.equal(s.foes[2].timed?.alterna, undefined);
  assert.equal(s.circuits[0].by, 'gerard', 'the beats are the Magia of whoever brought Cortocircuito');
  // The last in the row goes to the one before it.
  const last = pair();
  assert.deepEqual(actDual(last, 'corriente-alterna', 'dog-2').circuit, ['dog-1', 'dog-2']);
});

test('the beats alternate on a fixed order, the other pole first, each harder than the last, and then it is over', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  const beats = [beat(s, true), beat(s), beat(s), beat(s)].map(p => { assert.equal(p.length, 1); return p[0]; });
  assert.deepEqual(beats.map(p => p.target), ['dog-1', 'dog-0', 'dog-1', 'dog-0']);
  assert.deepEqual(beats.map(p => p.level), [1, 2, 3, 4], 'its level is the beat: Alterna I to IV');
  assert.deepEqual(beats.map(p => p.by), ['dog-0', 'dog-1', 'dog-0', 'dog-1'], 'each comes from the other pole');
  assert.ok(beats[2].amount > beats[0].amount && beats[3].amount > beats[1].amount, 'a crescendo');
  assert.ok(beats.every(p => !p.reaction), 'nothing to turn, nothing turned');
  assert.equal(ALTERNA.beats, 4);
  assert.ok(s.foes.every(f => !f.timed?.alterna)); assert.equal(s.circuits, undefined);
  assert.equal(beat(s).length, 0, 'no fifth beat');
});

test('a foe alone is both poles: the four beats go to it', () => {
  const s = pair(LINE, 1);
  assert.deepEqual(actDual(s, 'corriente-alterna', 'dog-0').circuit, ['dog-0', 'dog-0']);
  s.phase = 'player';
  const beats = [beat(s, true), beat(s), beat(s), beat(s)].flat();
  assert.deepEqual(beats.map(p => p.target), ['dog-0', 'dog-0', 'dog-0', 'dog-0']);
  assert.ok(beats.every(p => !p.by), 'from nowhere else');
});

test('each beat is a bolt for the reactions, and it spends the status it reacted with', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  // Wet: Conducción, and the water is gone (the next beat on it finds nothing).
  s.foes[1].timed.mojado = on();
  const [wet] = beat(s, true);
  assert.equal(wet.reaction.id, 'conduccion'); assert.ok(wet.reaction.hits.some(h => h.target === 'dog-1' && h.amount > 0));
  assert.equal(s.foes[1].timed.mojado, undefined);
  // Burning: Plasma, and the fire is out.
  s.foes[0].timed.quemado = { level: 2, left: TIMED.quemado.seconds, next: TIMED.quemado.every };
  const [fire] = beat(s);
  assert.equal(fire.target, 'dog-0'); assert.equal(fire.reaction.id, 'plasma'); assert.equal(s.foes[0].timed.quemado, undefined);
  // Blinded: Tormenta, through everyone blinded, and the smoke is spent.
  s.foes[1].timed.cegado = on(10); s.foes[2].timed = { cegado: on(10) };
  const [storm] = beat(s);
  assert.equal(storm.reaction.id, 'tormenta'); assert.deepEqual(storm.reaction.hits.map(h => h.target).sort(), ['dog-1', 'dog-2']);
  assert.equal(s.foes[1].timed.cegado, undefined);
  // Powder: Cristalizado, and the powder is spent into shards.
  s.foes[0].timed.empolvado = on();
  const [glass] = beat(s);
  assert.equal(glass.reaction.id, 'cristal'); assert.equal(s.foes[0].timed.empolvado, undefined); assert.ok(s.foes[0].timed.cristalizado);
});

test('on someone wet its blow shorts as Cortocircuito: the turn lost, the water kept for the beats', () => {
  const s = pair();
  s.foes[0].timed = { mojado: on() };
  const e = actDual(s, 'corriente-alterna', 'dog-0');
  assert.deepEqual(e.shorted, { target: 'dog-0', why: 'mojado' }); assert.deepEqual(e.shocked, ['dog-0']);
  assert.equal(e.reaction, undefined, 'the current stays in it: no Conducción yet'); assert.ok(s.foes[0].timed.mojado);
  s.phase = 'enemy'; s.enemyActions = [];
  assert.equal(enemyAct(s, 'dog-0', 'gerard').stunned, true);
  s.phase = 'player';
  beat(s, true);
  const [second] = beat(s);
  assert.equal(second.target, 'dog-0'); assert.equal(second.reaction.id, 'conduccion'); assert.equal(s.foes[0].timed.mojado, undefined);
});

test('a pole fallen leaves the beats that remain to the other', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  s.foes[1].hp = 0;
  const beats = [beat(s, true), beat(s), beat(s), beat(s)].flat();
  assert.deepEqual(beats.map(p => p.target), ['dog-0', 'dog-0', 'dog-0', 'dog-0']);
  assert.equal(s.foes[1].timed?.alterna, undefined, 'the fallen one carries nothing');
  // Both down: it is over.
  const t = pair();
  actDual(t, 'corriente-alterna', 'dog-0');
  t.phase = 'player';
  t.foes[0].hp = 0; t.foes[1].hp = 0;
  assert.equal(beat(t, true).length, 0); assert.equal(t.circuits, undefined);
});

test('Toma de tierra gives its sender a maná for a beat that reacts, once a round', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  const gerard = by(s, 'gerard');
  gerard.secondary = 0;
  s.foes[1].timed.mojado = on(); s.foes[0].timed.mojado = on();
  const [first] = beat(s, true);
  assert.equal(first.mana, 'gerard'); assert.equal(gerard.secondary, 1);
  // Both were wet: Conducción took the other's water too, so wet it again; the same round gives nothing more.
  s.foes[0].timed.mojado = on();
  const [second] = beat(s);
  assert.equal(second.reaction.id, 'conduccion'); assert.equal(second.mana, undefined); assert.equal(gerard.secondary, 1);
});

test('a clock started over on a pole (Reinicio) keeps the circuit going, at its loudest', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  beat(s, true); beat(s); beat(s);
  // Its clock started over on a pole (as Reinicio does): the circuit runs as long as its longer pole's.
  s.foes[1].timed.alterna.left = TIMED.alterna.seconds;
  const more = [beat(s), beat(s)].flat();
  assert.deepEqual(more.map(p => p.level), [4, 5]);
  assert.ok(more[1].amount >= more[0].amount * .9, 'past the last it beats at the last');
});
