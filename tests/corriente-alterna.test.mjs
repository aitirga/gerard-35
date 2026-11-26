import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, ALTERNA, circuitWorth, createBattle, createFearBattle, enemyAct, eyeOpen, improve, runClock, stageMoment, takeNews, TIMED } from '../src/battle.ts';
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
  assert.deepEqual(beats.map(p => p.level), [1, 2, 3, 4], 'the pulse counts its beat');
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

test('each beat is a bolt for the reactions, and like any bolt it spends what it turns', () => {
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

test('a clock started over on a pole (Rayo de energía) keeps its circuit going, at its loudest', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  beat(s, true); beat(s); beat(s);
  // Aitor turns to Tecnópata and starts the clocks on a pole over.
  const aitor = by(s, 'aitor');
  aitor.classId = 'tecnopata'; s.levels = { ...s.levels, tecnopata: 7 }; aitor.secondary = aitor.maxSecondary;
  s.phase = 'player'; s.active = 1; delete s.spent;
  const ray = act(s, 'skill', 'dog-1', 'rayo-energia');
  assert.ok(ray.restarted?.[0].statuses.includes('alterna'));
  assert.equal(s.circuits[0].left, TIMED.alterna.seconds, 'the circuit runs its whole time again');
  assert.equal(s.foes[1].timed.alterna.left, s.circuits[0].left, 'the plate shows the circuit\'s clock');
  s.phase = 'player';
  const more = [beat(s), beat(s)].flat();
  assert.deepEqual(more.map(p => p.level), [4, 5]);
  assert.ok(more[1].amount >= more[0].amount * .9, 'past the last it beats at the last');
});

test('played again (Da capo) while its circuit still beats, the old circuit goes out: the new one starts its clock and its beats over', () => {
  const s = pair();
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  beat(s, true); beat(s); beat(s);
  assert.equal(s.circuits[0].beat, 3);
  // Da capo gives the dual back: on dog-1 it wires dog-2 and dog-1, and the old circuit (dog-1 and dog-0) is gone.
  delete s.usedDuals; s.phase = 'player'; s.active = 0; delete s.spent; for (const a of s.allies) a.secondary = a.maxSecondary;
  assert.deepEqual(actDual(s, 'corriente-alterna', 'dog-1').circuit, ['dog-2', 'dog-1']);
  assert.equal(s.circuits.length, 1, 'never two at once');
  assert.deepEqual(s.circuits[0].poles, ['dog-2', 'dog-1']); assert.equal(s.circuits[0].beat, 0, 'its strength from the first beat');
  assert.equal(s.foes[0].timed?.alterna, undefined, 'the old pole no longer carries it');
  assert.equal(s.foes[1].timed.alterna.left, TIMED.alterna.seconds);
  s.phase = 'player';
  const beats = [];
  for (let i = 0; i < 8; i++) beats.push(...runClock(s, TIMED.alterna.every));
  const alterna = beats.filter(p => p.status === 'alterna');
  assert.equal(alterna.length, ALTERNA.beats, 'the new circuit\'s four beats, none from the old');
  assert.deepEqual(alterna.map(p => p.level), [1, 2, 3, 4]);
  assert.ok(alterna.every(p => p.target !== 'dog-0'));
  assert.equal(s.circuits, undefined); assert.ok(s.foes.every(f => !f.timed?.alterna));
});

test('a blow that fells its target leaves the circuit to the other pole alone, which takes the first beat', () => {
  const s = pair();
  s.foes[0].hp = 1;
  const e = actDual(s, 'corriente-alterna', 'dog-0');
  assert.equal(s.foes[0].hp, 0);
  assert.deepEqual(e.circuit, ['dog-1', 'dog-0']); assert.deepEqual(e.left.targets, ['dog-1']);
  assert.equal(s.foes[0].timed?.alterna, undefined);
  s.phase = 'player';
  const beats = [beat(s, true), beat(s), beat(s), beat(s)].flat();
  assert.deepEqual(beats.map(p => p.target), ['dog-1', 'dog-1', 'dog-1', 'dog-1']);
});

test('a beat that breaks a boss\'s part tells it at once: Vertitrón\'s eye goes out and its Rayo is called off', () => {
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'sincopante' }];
  const s = createFearBattle(party, 'uri-vertigo', ['matemagico', 'sincopante'], () => .5);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; a.secondary = a.maxSecondary; });
  s.levels = { sincopante: 7 }; improve(s, improvedBy(LINE));
  assert.ok(stageMoment(s, 'vertigo-carga'));
  const body = s.foes.find(f => f.kind === 'vertigo'), eye = s.foes.find(f => f.kind === 'vertigo-ojo');
  assert.equal(body.intent?.ability, 'rayo');
  s.phase = 'player'; s.active = 0;
  assert.deepEqual(actDual(s, 'corriente-alterna', eye.id).circuit, [body.id, eye.id]);
  takeNews(s);
  eye.hp = 1; s.phase = 'player';
  beat(s, true);
  assert.ok(eyeOpen(s), 'the first beat went to the body');
  const [second] = beat(s);
  assert.equal(second.target, eye.id); assert.ok(!eyeOpen(s));
  assert.equal(body.intent, undefined, 'the Rayo charging is called off');
  assert.ok(takeNews(s).some(n => n.eye === 'broken'));
});

test('Virus atómico never spreads the circuit: Alterna stays on its two poles', () => {
  // Infected as the skill leaves it (`virusSeen`, what it carried as Virus landed), then wired, then a foe acts:
  // that action is when the virus spreads what is new on its host.
  const wired = (fresh) => {
    const s = pair();
    s.foes[0].timed = { virus: on() };
    s.foes[0].virusSeen = { timed: { ...s.foes[0].timed }, statuses: {} };
    actDual(s, 'corriente-alterna', 'dog-0');
    if (fresh) s.foes[0].timed[fresh] = on();
    s.phase = 'enemy';
    return { s, e: enemyAct(s, 'dog-2', 'gerard') };
  };
  const { s, e } = wired();
  assert.ok(s.foes[0].timed.alterna && s.foes[1].timed.alterna);
  assert.equal(s.foes[2].timed?.alterna, undefined);
  assert.equal(e.spread, undefined, 'nothing else new on the host: nothing spreads');
  // The same host, with a fire that came after Virus: that does spread, and the circuit still does not.
  const lit = wired('quemado');
  assert.deepEqual(lit.e.spread?.[0]?.statuses, [TIMED.quemado.name]);
  assert.ok(lit.s.foes[2].timed?.quemado); assert.equal(lit.s.foes[2].timed?.alterna, undefined);
});

test('for the bot, a circuit is worth its beats to come, and less with each one spent', () => {
  const s = pair();
  assert.equal(circuitWorth(s), 0);
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  const worth = [circuitWorth(s)];
  for (let i = 0; i < 4; i++) { beat(s, i === 0); worth.push(circuitWorth(s)); }
  assert.ok(worth[0] > 0);
  for (let i = 1; i < worth.length; i++) assert.ok(worth[i] < worth[i - 1], worth.join());
  assert.equal(worth[4], 0);
});

test('a wound is spent by the first hit of the dual on each pole alone: the blow on its target, the first beat on the other', () => {
  const s = pair();
  s.levels = { ...s.levels, papagato: 7 };
  s.foes[0].statuses = { ...s.foes[0].statuses, sangrado: 3 };
  s.foes[1].statuses = { ...s.foes[1].statuses, sangrado: 2 };
  const e = actDual(s, 'corriente-alterna', 'dog-0');
  assert.equal(e.bled, 3, 'the blow, the first of its hits on its target, spends the wound');
  assert.equal(s.foes[0].statuses.sangrado, undefined);
  s.phase = 'player';
  const first = beat(s, true)[0];
  assert.equal(first.target, 'dog-1'); assert.equal(first.bled, 2, 'the first beat on the other pole spends its wound');
  assert.equal(s.foes[1].statuses.sangrado, undefined);
  // A wound cut again between beats stays: the circuit has reached both already.
  s.foes[0].statuses.sangrado = 4; s.foes[1].statuses.sangrado = 4;
  const later = [beat(s)[0], beat(s)[0]];
  assert.ok(later.every(p => p.bled === undefined));
  assert.equal(s.foes[0].statuses.sangrado, 4); assert.equal(s.foes[1].statuses.sangrado, 4);
});

test('a beat La Voz\'s song swallows spends no wound: the first that reaches the pole does', () => {
  const s = pair();
  s.foes[1].statuses = { ...s.foes[1].statuses, sangrado: 5 };
  actDual(s, 'corriente-alterna', 'dog-0');
  s.phase = 'player';
  // dog-1 is all voice for the first beat, as La Voz is while a note sounds.
  s.foes[1].kind = 'voz'; s.song = { t: .3 };
  const swallowed = runClock(s, TIMED.alterna.every + .01).filter(p => p.status === 'alterna' && p.target === 'dog-1');
  assert.ok(swallowed.length && swallowed.every(p => p.amount === 0 && p.bled === undefined && !p.awoken));
  assert.equal(s.foes[1].statuses.sangrado, 5, 'the wound is still there');
});
