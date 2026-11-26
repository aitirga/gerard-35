import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, createBattle, enemyAct, improve, plateCount, plateMarks, runClock, suggested, TIMED } from '../src/battle.ts';
import { improvedBy, IMPROVEMENTS } from '../src/ecos.ts';

// Sugestión (docs/animas/tecnopata/README.md § Sugestión): Tecnópata's first passive of the Mente line. A confused foe's
// blow, and each beat of Idea fija, go to the foe an ally last aimed at alone.
const MENTE = ['tecnopata:confusion', 'tecnopata:control-remoto'];
const WITH = [...MENTE, 'tecnopata:sugestion'];
/** Gerard in `g` and Aitor in Tecnópata against three sturdy dogs, with `nodes` bought. */
function fight(nodes = WITH, g = 'matemagico') {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: g }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }], 3, false, undefined, [g, 'tecnopata']);
  s.levels = { sincopante: 7 };
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const confuse = c => { c.timed = { ...c.timed, confusion: { level: 1, left: TIMED.confusion.seconds, next: TIMED.confusion.every } }; };
/** The foe `id`'s own turn, with no miss in it. */
const foeTurn = (s, id) => { s.phase = 'enemy'; s.enemyActions = []; s.foes.forEach(f => { f.stats = { ...f.stats, critico: 0 }; }); return enemyAct(s, id); };

test('Sugestión is a node of the Mente line after Control remoto, beside Virus atómico, for one eco, in the first stage', () => {
  const node = IMPROVEMENTS.find(i => i.id === 'tecnopata:sugestion');
  assert.equal(node.kind, 'passive'); assert.equal(node.line, 'mente'); assert.equal(node.after, 'tecnopata:control-remoto');
  assert.equal(node.cost, 1); assert.equal(node.stage ?? 1, 1);
  assert.match(node.description, /^Pasiva\. /);
});

test('a confused foe strikes the foe an ally last aimed at alone, and the passive says so over whoever brings it', () => {
  const s = fight();
  turn(s, 'gerard'); act(s, 'attack', 'dog-2');
  assert.equal(s.aimed, 'dog-2');
  confuse(s.foes[0]);
  const e = foeTurn(s, 'dog-0');
  assert.equal(e.confused, true); assert.equal(e.target, 'dog-2');
  assert.deepEqual(e.passives?.map(p => [p.id, p.who]), [['sugestion', 'aitor']]);
});

test('aimed at the confused one itself, it strikes itself', () => {
  const s = fight();
  turn(s, 'gerard'); act(s, 'attack', 'dog-0');
  confuse(s.foes[0]);
  const e = foeTurn(s, 'dog-0');
  assert.equal(e.target, 'dog-0');
});

test('with nobody aimed at, or the one aimed at down, the blow goes at random as without it', () => {
  const s = fight();
  confuse(s.foes[0]);
  const free = foeTurn(s, 'dog-0');
  assert.notEqual(free.target, 'dog-0'); assert.equal(free.passives, undefined);
  turn(s, 'gerard'); act(s, 'attack', 'dog-2'); s.foes[2].hp = 0;
  assert.equal(suggested(s), undefined);
  const fallen = foeTurn(s, 'dog-0');
  assert.equal(fallen.target, 'dog-1'); assert.equal(fallen.passives, undefined);
});

test('a blow on everyone, a cure or a guard does not move the mark; a skill or a dual on one foe does', () => {
  const s = fight([...WITH, 'tecnopata:escolta', 'tecnopata:explosion']);
  turn(s, 'gerard'); act(s, 'attack', 'dog-1');
  turn(s, 'aitor'); act(s, 'skill', undefined, 'explosion');
  assert.equal(s.aimed, 'dog-1', 'Explosión reaches every foe');
  turn(s, 'aitor'); act(s, 'skill', 'gerard', 'escolta');
  assert.equal(s.aimed, 'dog-1', 'a skill on an ally aims at no foe');
  turn(s, 'aitor'); act(s, 'skill', 'dog-2', 'confusion');
  assert.equal(s.aimed, 'dog-2');
});

test('without the node, or with nobody standing in Tecnópata, the confused foe strikes at random', () => {
  const s = fight(MENTE);
  turn(s, 'gerard'); act(s, 'attack', 'dog-2');
  assert.equal(suggested(s), undefined);
  const t = fight();
  turn(t, 'gerard'); act(t, 'attack', 'dog-2');
  by(t, 'aitor').hp = 0;
  assert.equal(suggested(t), undefined);
});

test('never a part: a part aimed at leaves the blow at random', () => {
  const s = fight();
  turn(s, 'gerard'); act(s, 'attack', 'dog-2');
  s.foes[2].part = true;
  assert.equal(suggested(s), undefined);
});

test('Idea fija beats on the foe aimed at instead of the strongest', () => {
  const s = fight([...WITH, 'tecnopata:virus', 'tecnopata:idea-fija'], 'sincopante');
  s.foes[1].hp = 900; s.foes[2].hp = 500;
  // Idea fija on dog-0: the dual aims at it too.
  turn(s, 'gerard'); by(s, 'aitor').secondary = by(s, 'aitor').maxSecondary;
  actDual(s, 'idea-fija', 'dog-0');
  assert.equal(s.aimed, 'dog-0');
  turn(s, 'gerard'); act(s, 'attack', 'dog-2');
  s.phase = 'player';
  const pulses = runClock(s, TIMED['idea-fija'].every + .01).filter(p => p.status === 'idea-fija');
  assert.equal(pulses[0].target, 'dog-2', 'not dog-1, the strongest');
  assert.equal(pulses[0].passives?.[0]?.id, 'sugestion');
});

test('the plate marks the foe aimed at only while someone is confused, and Serie de Fourier does not count it', () => {
  const s = fight();
  turn(s, 'gerard'); act(s, 'attack', 'dog-2');
  assert.ok(!plateMarks(s, s.foes[2]).includes('sugestion'), 'nobody to send: no mark');
  confuse(s.foes[0]);
  assert.ok(plateMarks(s, s.foes[2]).includes('sugestion'));
  assert.ok(!plateMarks(s, s.foes[1]).includes('sugestion'));
  assert.ok(!plateCount(s, s.foes[2]).includes('sugestion'));
});
