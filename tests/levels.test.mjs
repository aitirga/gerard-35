import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, createFearBattle, validTargets, SKILLS } from '../src/battle.ts';
import { FOE_XP, LEVEL_XP, LEVELLED, MAX_LEVEL, award, fightXp, levelForXp, levelProgress, participants, skillsAt, toNextLevel, xpFloor } from '../src/levels.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];

test('EXP reaches each level at its threshold, and the bar runs from one to the next', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(LEVEL_XP[0] - 1), 1);
  assert.equal(levelForXp(LEVEL_XP[0]), 2);
  assert.equal(levelForXp(LEVEL_XP[1]), MAX_LEVEL);
  assert.equal(xpFloor(1), 0); assert.equal(xpFloor(2), LEVEL_XP[0]);
  assert.equal(levelProgress(LEVEL_XP[0] / 2), .5);
  assert.equal(levelProgress(LEVEL_XP[0]), 0);
  assert.equal(levelProgress(LEVEL_XP[1] + 999), 1, 'full at the top');
});

test('every ánima has its level table: one skill or more at each level past the first', () => {
  for (const id of LEVELLED) for (let level = 2; level <= MAX_LEVEL; level++) assert.ok(skillsAt(id, level).length, `${id} ${level}`);
  assert.deepEqual(skillsAt('matemagico', 2), ['analisis', 'angulo']);
  assert.deepEqual(skillsAt('matemagico', 3), ['cardioide']);
});

test('a fight is worth its foes; bigger fears are worth more', () => {
  const dogs = createBattle(party, 3);
  assert.equal(fightXp(dogs), 3 * FOE_XP.dog);
  assert.ok(FOE_XP.cebollon > FOE_XP.cebolla && FOE_XP.cebolla > FOE_XP.cebollita);
  assert.ok(FOE_XP.vertigo > FOE_XP.cebollon);
  dogs.extraXp = 5;
  assert.equal(fightXp(dogs), 3 * FOE_XP.dog + 5);
});

test('the ánimas that took part: whoever acted wearing one, and whoever ends standing in one', () => {
  const s = createBattle(party, 2, false, undefined, ['matemagico', 'papagato']);
  const first = s.allies[s.active];
  act(s, 'defend');
  assert.deepEqual(participants(s).map(p => p.id), ['matemagico', 'papagato'], 'both still standing in theirs');
  const fallen = createBattle(party, 1, false, undefined, ['matemagico', 'papagato']);
  const acted = fallen.allies[fallen.active], other = fallen.allies.find(a => a !== acted);
  act(fallen, 'defend');
  other.hp = 0;
  assert.deepEqual(participants(fallen), [{ id: acted.classId, wearers: [acted.id] }], 'down and never acted: not there');
  acted.hp = 0;
  assert.deepEqual(participants(fallen).map(p => p.id), [acted.classId], 'acted, then fell: still took part');
  void first;
});

test('award: EXP whole to each, levels crossed and what they teach; the top level keeps still', () => {
  const [p, m] = award(['papagato', 'matemagico'], LEVEL_XP[0], { papagato: 10 }, { papagato: 1, matemagico: 3 });
  assert.deepEqual(p, { id: 'papagato', xpBefore: 10, xpAfter: 10 + LEVEL_XP[0], levelBefore: 1, levelAfter: 2, learned: ['zarpazos', 'ronroneo'] });
  assert.equal(m.xpBefore, xpFloor(3), 'from the floor of a level the story gave');
  assert.equal(m.xpAfter, m.xpBefore); assert.equal(m.levelAfter, 3); assert.deepEqual(m.learned, []);
  const jump = award(['papagato'], 9999, {}, {})[0];
  assert.equal(jump.levelAfter, MAX_LEVEL); assert.deepEqual(jump.learned, ['zarpazos', 'ronroneo', 'llaga', 'a-la-vez']);
  assert.equal(toNextLevel(10, 1), LEVEL_XP[0] - 10);
  assert.equal(toNextLevel(0, 2), LEVEL_XP[1] - LEVEL_XP[0]);
  assert.equal(toNextLevel(0, MAX_LEVEL), 0);
});

test('Cardioide cures someone hurt and standing, never the fallen; Análisis Parálisis raises the party', () => {
  const s = createFearBattle(party, 'cebolla', ['matemagico', 'papagato']);
  s.levels = { matemagico: 3 };
  const aitor = s.allies.find(a => a.id === 'aitor'), gerard = s.allies.find(a => a.id === 'gerard');
  s.active = s.allies.indexOf(gerard);
  assert.deepEqual(validTargets(s, 'skill', 'cardioide'), [], 'nobody hurt');
  aitor.hp = 0; gerard.hp -= 50;
  assert.deepEqual(validTargets(s, 'skill', 'cardioide').map(a => a.id), ['gerard'], 'not the fallen');
  const cure = act(s, 'skill', 'gerard', 'cardioide');
  assert.ok(cure.healed && cure.amount > 20 && cure.amount <= 50);
  assert.equal(aitor.hp, 0, 'still down');
  const b = createBattle(party, 1, false, undefined, ['matemagico', 'papagato']);
  b.levels = { matemagico: 2 };
  b.active = b.allies.findIndex(a => a.id === 'gerard');
  const boost = act(b, 'skill', undefined, 'analisis');
  assert.deepEqual(boost.stats.map(c => c.stats), [['fuerza', 'magia'], ['fuerza', 'magia']]);
  assert.ok(SKILLS.find(skill => skill.id === 'cardioide').level === 3);
});
