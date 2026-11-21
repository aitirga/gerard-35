import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, createBattle, enemyAct, improve, nextRound, runClock, skillsFor, validTargets, awakeUlti, coldReady, stageWater, waterOf, frozenOf, iceBreakPower, manaMax, pulseDamage, CRECIDA, SKILLS, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Freática (docs/animas/freatica/README.md): La crecida, the water held under each foe, rising to three marks; its skills
// from level 1 to 7, the passive Nivel de base, and the definitiva Bajo cero, the water frozen.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'freatica' }];
const ELEMENTS = ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'];
/** Gerard (Matemágico, with the elements) and Aitor (Freática at `level`) against three sturdy dogs; `jar`: what is bought. */
function fight(level = 7, jar = [], foes = 3) {
  const s = createBattle(PARTY, foes, false, undefined, ['matemagico', 'freatica']);
  s.levels = { freatica: level };
  improve(s, improvedBy([...ELEMENTS, ...jar]));
  s.foes.forEach(f => { f.hp = f.maxHp = 400; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full; Gerard's Atacar carrying `element`. */
const turn = (s, id, element) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; if (element) by(s, id).element = element; else delete by(s, id).element; return by(s, id); };
const ids = (s, who) => skillsFor(s, by(s, who)).map(k => k.id);
/** `n` Recargas on `foe`, each on a fresh turn. */
const recargas = (s, foe, n) => { for (let i = 0; i < n; i++) { turn(s, 'aitor'); act(s, 'skill', foe, 'recarga'); } };

test('Freática grows to seven: Recarga, Sondeo eléctrico at 2, Bombeo at 3, Maná +1 at 4, Nivel de base at 5, Riada at 6, Golpe de ariete at 7', () => {
  assert.deepEqual(ids(fight(1), 'aitor'), ['recarga']);
  assert.deepEqual(ids(fight(3), 'aitor'), ['recarga', 'sondeo', 'bombeo']);
  assert.deepEqual(ids(fight(7), 'aitor'), ['recarga', 'sondeo', 'bombeo', 'riada', 'golpe-de-ariete']);
  assert.equal(manaMax(undefined, 'freatica', { freatica: 4 }), 4);
  for (const id of ['recarga', 'sondeo', 'bombeo']) assert.equal(SKILLS.find(k => k.id === id).cost, 1, id);
  for (const id of ['riada', 'golpe-de-ariete']) assert.equal(SKILLS.find(k => k.id === id).cost, 2, id);
});

test('Recarga: a light water blow that raises its target\'s water a mark, up to three; a foe with water is wet, the others are not', () => {
  const s = fight(1), [a, b] = s.foes;
  turn(s, 'aitor');
  const e = act(s, 'skill', a.id, 'recarga');
  assert.ok(e.amount > 0); assert.deepEqual(e.water, [{ target: a.id, from: 0, to: 1 }]);
  assert.equal(waterOf(a), 1); assert.ok(a.timed.mojado, 'wet while it stands'); assert.equal(waterOf(b), 0); assert.ok(!b.timed?.mojado);
  assert.equal(s.water.by, 'aitor', 'whoever raised it holds it');
  recargas(s, a.id, 3);
  assert.equal(waterOf(a), 3, 'three marks at most');
  assert.ok(a.timed.hundido, 'at the third mark it is sunk');
});

test('The water drains on the clock, a mark every 20 s; a water blow starts its top mark over', () => {
  const s = fight(1), a = s.foes[0];
  recargas(s, a.id, 2);
  runClock(s, 15);
  assert.equal(waterOf(a), 2);
  turn(s, 'gerard', 'agua'); act(s, 'attack', a.id);
  assert.equal(a.timed.agua.left, CRECIDA.mark, 'Atacar · Agua starts its clock over');
  runClock(s, 21);
  assert.equal(waterOf(a), 1);
  runClock(s, 20);
  assert.equal(waterOf(a), 0); assert.ok(!a.timed.mojado, 'dry: no longer wet');
});

test('Nivel de base (level 5): while its wearer wears Freática, no water drains below the first mark', () => {
  const s = fight(5), a = s.foes[0];
  recargas(s, a.id, 2);
  runClock(s, 100);
  assert.equal(waterOf(a), 1, 'held at the first mark');
  by(s, 'aitor').classId = 'matemagico';
  runClock(s, 21);
  assert.equal(waterOf(a), 0, 'without it worn, it drains');
});

test('Hundido: at the third mark the foe loses 2 % of all its PV every 2 s, a pure share with no cap', () => {
  const s = fight(1), a = s.foes[0];
  a.hp = a.maxHp = 1000;
  recargas(s, a.id, 3);
  const before = a.hp, pulses = runClock(s, 2.01).filter(p => p.status === 'hundido' && p.target === a.id);
  assert.equal(pulses.length, 1);
  assert.equal(pulses[0].amount, 20, '2 % of 1000');
  assert.equal(before - a.hp, 20);
  assert.equal(pulseDamage('hundido', 1, 5000), 100, 'no top: a boss loses its share too');
});

test('Corriente: a bolt on a foe with water runs through every wet foe and stays in each water, pulsing at its mark; while it runs a bolt only starts it over', () => {
  const s = fight(1), [a, b] = s.foes;
  recargas(s, a.id, 2); recargas(s, b.id, 1);
  turn(s, 'gerard', 'electrico');
  const e = act(s, 'attack', a.id);
  assert.equal(e.reaction.id, 'conduccion');
  assert.deepEqual(new Set(e.reaction.hits.map(h => h.target)), new Set([a.id, b.id]));
  assert.equal(waterOf(a), 2, 'the water does not go'); assert.ok(a.timed.mojado);
  assert.deepEqual(new Set(e.current.targets), new Set([a.id, b.id])); assert.equal(e.current.seconds, 10);
  assert.equal(a.timed.corriente.level, 2); assert.equal(b.timed.corriente.level, 1);
  const pulses = runClock(s, 2.01).filter(p => p.status === 'corriente');
  assert.equal(pulses.find(p => p.target === a.id).amount, pulseDamage('corriente', 2, a.maxHp));
  assert.ok(pulseDamage('corriente', 2, 400) === 2 * pulseDamage('corriente', 1, 400));
  // A second bolt while it runs: no second Conducción, only its 10 s over.
  turn(s, 'gerard', 'electrico');
  const again = act(s, 'attack', a.id);
  assert.ok(!again.reaction); assert.equal(again.current.renewed, true); assert.equal(a.timed.corriente.left, 10);
  runClock(s, 10.5);
  assert.ok(!a.timed.corriente, 'gone with its time'); assert.equal(waterOf(a), 2, 'the water stays');
});

test('Sondeo eléctrico (level 2): a light bolt whose current lasts twice as long; on a dry foe, a plain bolt', () => {
  const s = fight(2), a = s.foes[0];
  turn(s, 'aitor');
  const dry = act(s, 'skill', a.id, 'sondeo');
  assert.ok(dry.amount > 0); assert.ok(!dry.current);
  recargas(s, a.id, 1);
  turn(s, 'aitor');
  const e = act(s, 'skill', a.id, 'sondeo');
  assert.equal(e.current.seconds, 20); assert.equal(a.timed.corriente.left, 20);
});

test('Vapor: fire on a foe with water takes its top mark and blinds it at the level its water had', () => {
  const s = fight(1), a = s.foes[0];
  recargas(s, a.id, 3);
  turn(s, 'gerard', 'fuego');
  const e = act(s, 'attack', a.id);
  assert.equal(e.reaction.id, 'vapor'); assert.equal(e.reaction.level, 3);
  assert.equal(waterOf(a), 2); assert.equal(a.timed.cegado.level, 3, 'Cegado III: its blows at 30 %');
  assert.ok(!a.timed.quemado, 'a foe with water does not catch fire'); assert.ok(!a.timed.hundido, 'not sunk now');
});

test('Bombeo (level 3): a light cure for the party that spends a mark of the foe with most water; with no water it cannot be used', () => {
  const s = fight(3), [a, b] = s.foes;
  by(s, 'gerard').hp -= 40; by(s, 'aitor').hp -= 20;
  turn(s, 'aitor');
  assert.equal(validTargets(s, 'skill', 'bombeo').length, 0, 'no water anywhere');
  recargas(s, a.id, 1); recargas(s, b.id, 2);
  turn(s, 'aitor');
  const e = act(s, 'skill', undefined, 'bombeo');
  assert.ok(e.cures.every(c => c.amount > 0));
  assert.equal(waterOf(b), 1, 'the one with most water gives a mark'); assert.equal(waterOf(a), 1);
});

test('Riada (level 6) raises every foe\'s water a mark; Golpe de ariete (level 7) strikes each once a mark of its own water, and spends it', () => {
  const s = fight(7), [a, b, c] = s.foes;
  turn(s, 'aitor');
  const flood = act(s, 'skill', undefined, 'riada');
  assert.deepEqual(s.foes.map(waterOf), [1, 1, 1]); assert.equal(flood.water.length, 3);
  recargas(s, a.id, 2);
  c.timed = {}; // dry
  assert.deepEqual(validTargets(s, 'skill', 'golpe-de-ariete').map(f => f.id), [a.id, b.id], 'only whoever has water');
  turn(s, 'aitor');
  const e = act(s, 'skill', undefined, 'golpe-de-ariete');
  assert.equal(e.hammer.filter(h => h.target === a.id).length, 3, 'three blows on the one at III');
  assert.equal(e.hammer.filter(h => h.target === b.id).length, 1);
  assert.ok(!e.hammer.some(h => h.target === c.id), 'nothing for a dry one');
  assert.deepEqual(s.foes.map(waterOf), [0, 0, 0]); assert.ok(!a.timed.hundido && !a.timed.mojado);
});

test('Whoever holds the water falls: every cell breaks, and everyone standing on both sides is Mojado', () => {
  const s = fight(1), a = s.foes[0];
  recargas(s, a.id, 2);
  by(s, 'aitor').hp = 1;
  s.phase = 'enemy'; s.enemyActions = [];
  // The dogs take turns: one of them will fell Aitor.
  let broke;
  for (const f of s.foes) { const e = enemyAct(s, f.id, 'aitor'); if (e?.cells) broke = e.cells; }
  assert.equal(by(s, 'aitor').hp, 0);
  assert.ok(broke, 'the action that felled the holder says the cells broke');
  assert.equal(waterOf(a), 0); assert.ok(by(s, 'gerard').timed.mojado, 'the party is wet too');
  assert.equal(s.foes[1].timed.mojado.left, TIMED.mojado.seconds);
});

test('Bajo cero wakes when a foe\'s water reaches the third mark while Freática is worn, and freezes every foe with water for 20 s a mark', () => {
  const s = fight(7, ['freatica:definitiva']), [a, b, c] = s.foes;
  assert.ok(!coldReady(s));
  recargas(s, b.id, 1);
  recargas(s, a.id, 2);
  turn(s, 'aitor');
  const third = act(s, 'skill', a.id, 'recarga');
  assert.equal(third.awoken, 'bajo-cero');
  assert.equal(awakeUlti(s, by(s, 'aitor')).id, 'bajo-cero');
  assert.equal(ids(s, 'aitor')[0], 'bajo-cero', 'an awake definitiva heads the list');
  turn(s, 'aitor');
  const e = act(s, 'skill', undefined, 'bajo-cero');
  assert.deepEqual(e.frozen, [{ target: a.id, marks: 3 }, { target: b.id, marks: 1 }]);
  assert.ok(frozenOf(a) && frozenOf(b) && !frozenOf(c), 'a dry foe is not frozen');
  assert.equal(a.timed.congelado.left, 60); assert.equal(b.timed.congelado.left, 20);
  assert.equal(waterOf(a), 0, 'the ice is the water'); assert.ok(!a.timed.mojado && !a.timed.hundido);
  assert.ok(!coldReady(s), 'once a fight');
  // A frozen foe loses its turn.
  s.phase = 'enemy'; s.enemyActions = [];
  const lost = enemyAct(s, a.id);
  assert.equal(lost.iced, true);
  // It melts on the clock.
  runClock(s, 21);
  assert.ok(!frozenOf(b)); assert.ok(frozenOf(a)); assert.equal(a.timed.congelado.level, 2);
});

test('The ice: a quarter of every blow, eight blows break it (a hard one counts two, each strike of a flurry one), and the break is a large magic water blow by the ice left', () => {
  const s = fight(7, ['freatica:definitiva']), a = s.foes[0];
  a.hp = a.maxHp = 2000;
  recargas(s, a.id, 3);
  turn(s, 'gerard');
  const free = act(s, 'attack', a.id).amount;
  recargas(s, a.id, 1);
  turn(s, 'aitor'); act(s, 'skill', undefined, 'bajo-cero');
  turn(s, 'gerard');
  const iced = act(s, 'attack', a.id);
  assert.ok(iced.amount <= Math.ceil(free / 4) + 1, 'a quarter');
  assert.equal(a.cracks, 1); assert.deepEqual(iced.ice, [{ target: a.id, cracks: 1, added: 1 }]);
  for (let i = 0; i < 6; i++) { turn(s, 'gerard'); act(s, 'attack', a.id); }
  assert.equal(a.cracks, 7);
  const before = a.hp;
  turn(s, 'gerard');
  const last = act(s, 'attack', a.id);
  const broke = last.ice.find(i => i.broke !== undefined);
  assert.ok(broke && broke.broke > 0); assert.ok(!frozenOf(a), 'free at once');
  assert.ok(before - a.hp > broke.broke, 'the blow and the break');
  assert.ok(iceBreakPower(3) === 90 && iceBreakPower(0) === 40 && Math.round(iceBreakPower(2)) === 73);
});

test('A flame on the ice melts a mark of it at once and blinds; electricity does nothing to it', () => {
  const s = fight(7, ['freatica:definitiva']), a = s.foes[0];
  stageWater(s, 3);
  turn(s, 'aitor'); act(s, 'skill', undefined, 'bajo-cero');
  const left = a.timed.congelado.left;
  turn(s, 'aitor'); act(s, 'skill', a.id, 'sondeo');
  assert.equal(a.cracks, 0, 'a bolt does not crack it'); assert.ok(Math.abs(a.timed.congelado.left - left) < 1e-6);
  turn(s, 'gerard'); s.allies[0].secondary = 3;
  const e = act(s, 'skill', a.id, 'foc-binari');
  assert.deepEqual(e.ice, [{ target: a.id, melted: true }]);
  assert.equal(a.timed.congelado.left, left - CRECIDA.ice); assert.equal(a.cracks, 0);
  assert.ok(a.timed.cegado); assert.ok(!a.timed.quemado);
});

test('A flurry is the shortcut: Zarpazos de fuego\'s eight claws break a whole ice at once', () => {
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
  const s = createBattle(party, 1, false, undefined, ['matemagico', 'papagato', 'freatica']);
  s.levels = { papagato: 2 };
  s.foes[0].hp = s.foes[0].maxHp = 2000;
  stageWater(s, 3);
  const a = s.foes[0];
  a.timed = { congelado: { level: 3, left: 60, next: 60 } }; a.cracks = 0; s.cold = { used: true, by: 'aitor' };
  turn(s, 'gerard'); s.allies[1].secondary = 3;
  const e = actDual(s, 'zarpazos-de-fuego', a.id);
  assert.ok(e.ice?.some(i => i.broke !== undefined), 'eight strikes, eight blows: it breaks');
  assert.ok(!frozenOf(a));
});

test('The fight tester sets the water at will', () => {
  const s = fight(1);
  assert.ok(stageWater(s, 2));
  assert.deepEqual(s.foes.map(waterOf), [2, 2, 2]);
  assert.ok(stageWater(s, 0));
  assert.deepEqual(s.foes.map(waterOf), [0, 0, 0]);
  nextRound(s);
});
