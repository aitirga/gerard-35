import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, createFearBattle, validTargets, SKILLS, improve } from '../src/battle.ts';
import { EMPTY_LEVELS, FOE_XP, LEVEL_XP, LEVELLED, MANA_LEVEL, MAX_LEVEL, award, topOf, levelOf, fightXp, levelForXp, levelProgress, participants, passivesAt, skillsAt, toNextLevel, xpFloor } from '../src/levels.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];

test('EXP reaches each level at its threshold, and the bar runs from one to the next', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(LEVEL_XP[0] - 1), 1);
  assert.equal(levelForXp(LEVEL_XP[0]), 2);
  assert.equal(levelForXp(LEVEL_XP[1]), 3);
  assert.equal(levelForXp(LEVEL_XP.at(-1)), MAX_LEVEL);
  assert.equal(levelForXp(LEVEL_XP.at(-1), 3), 3, 'never past the ánima\'s own top');
  assert.equal(xpFloor(1), 0); assert.equal(xpFloor(2), LEVEL_XP[0]);
  assert.equal(levelProgress(LEVEL_XP[0] / 2), .5);
  assert.equal(levelProgress(LEVEL_XP[0]), 0);
  assert.equal(levelProgress(LEVEL_XP[1] + 999, 3), 1, 'full at the ánima\'s top');
  assert.equal(levelProgress(LEVEL_XP.at(-1) + 999), 1, 'full at the top');
  assert.ok(LEVEL_XP.every((xp, i) => i === 0 || xp > LEVEL_XP[i - 1]), 'each level asks for more');
});

test('every ánima has its level table: one skill or more at each level past the first', () => {
  // Level 4 is a point of maná, and a level left empty on purpose is named (`EMPTY_LEVELS`).
  for (const id of LEVELLED) for (let level = 2; level <= topOf(id); level++) assert.ok(skillsAt(id, level).length || passivesAt(id, level).length || level === MANA_LEVEL || EMPTY_LEVELS[id]?.includes(level), `${id} ${level}`);
  assert.equal(topOf('papagato'), 7); assert.equal(topOf('dadaista'), 7); assert.equal(topOf('matemagico'), 1);
  assert.equal(levelOf('dadaista', flag => flag === 'dadaista-5'), 5, 'the highest flag held is the level');
  assert.deepEqual(skillsAt('dadaista', 7), ['meteorito', 'meteoro', 'asteroide']);
  assert.deepEqual(LEVELLED, ['papagato', 'dadaista', 'prismatico', 'sincopante'], 'the shared ánimas level; the own ánimas grow by their tree at the jar');
  // Colorista: a skill at 2, 3, 6 and 7, and its passive at 5 (a level can teach a passive and nothing else).
  assert.equal(topOf('prismatico'), 7); assert.deepEqual(skillsAt('prismatico', 5), []); assert.deepEqual(passivesAt('prismatico', 5), ['remolino']);
  // Papagato: Maná +1 at 4, Olor a sangre at 5 (a passive and nothing else), Acecho at 6 and Cacería at 7.
  assert.deepEqual(skillsAt('papagato', 4), []); assert.deepEqual(passivesAt('papagato', 5), ['olor-a-sangre']);
  assert.deepEqual(skillsAt('papagato', 6), ['acecho']); assert.deepEqual(skillsAt('papagato', 7), ['caceria']);
  assert.ok(!skillsAt('papagato', 7).includes('siete-vidas'), 'the definitiva is bought at the jar, never learned by level');
  assert.deepEqual(award(['prismatico'], 9999, {}, { prismatico: 4 })[0].passives, ['remolino']);
  assert.deepEqual(skillsAt('papagato', 2), ['zarpazos', 'ronroneo']);
  assert.deepEqual(skillsAt('matemagico', 2), []);
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
  const [p, none] = award(['papagato', 'matemagico'], LEVEL_XP[0], { papagato: 10 }, { papagato: 1 });
  assert.equal(none, undefined, 'Matemágico earns none: it grows by its tree');
  const [m] = award(['papagato'], LEVEL_XP[0], {}, { papagato: 7 });
  assert.deepEqual(p, { id: 'papagato', xpBefore: 10, xpAfter: 10 + LEVEL_XP[0], levelBefore: 1, levelAfter: 2, reach: 7, learned: ['zarpazos', 'ronroneo'] });
  assert.equal(m.xpBefore, xpFloor(7), 'from the floor of a level the story gave');
  assert.equal(m.xpAfter, m.xpBefore); assert.equal(m.levelAfter, 7); assert.deepEqual(m.learned, []);
  const jump = award(['papagato'], 9999, {}, {})[0];
  assert.equal(jump.levelAfter, 7); assert.deepEqual(jump.learned, ['zarpazos', 'ronroneo', 'llaga', 'acecho', 'caceria']);
  assert.deepEqual(jump.passives, ['olor-a-sangre'], 'Olor a sangre comes with level 5');
  assert.deepEqual(award(['papagato'], LEVEL_XP[2] - LEVEL_XP[1], {}, { papagato: 3 })[0].passives, undefined, 'level 4 is a point of maná, no passive');
  assert.equal(toNextLevel(10, 1), LEVEL_XP[0] - 10);
  assert.equal(toNextLevel(0, 2), LEVEL_XP[1] - LEVEL_XP[0]);
  assert.equal(toNextLevel(0, MAX_LEVEL), 0);
  assert.equal(toNextLevel(0, 3, 3), 0, 'nothing past the ánima\'s top');
  assert.equal(award(['dadaista'], LEVEL_XP.at(-1), {}, {})[0].levelAfter, 7);
});

test('Cardioide cures someone hurt and standing, never the fallen; Análisis Parálisis raises the party', () => {
  const s = createFearBattle(party, 'cebolla', ['matemagico', 'papagato']);
  improve(s, { skills: ['cardioide'] });
  const aitor = s.allies.find(a => a.id === 'aitor'), gerard = s.allies.find(a => a.id === 'gerard');
  s.active = s.allies.indexOf(gerard);
  assert.deepEqual(validTargets(s, 'skill', 'cardioide'), [], 'nobody hurt');
  aitor.hp = 0; gerard.hp -= 50;
  assert.deepEqual(validTargets(s, 'skill', 'cardioide').map(a => a.id), ['gerard'], 'not the fallen');
  const cure = act(s, 'skill', 'gerard', 'cardioide');
  assert.ok(cure.healed && cure.amount > 20 && cure.amount <= 50);
  assert.equal(aitor.hp, 0, 'still down');
  const b = createBattle(party, 1, false, undefined, ['matemagico', 'papagato']);
  improve(b, { skills: ['analisis'] });
  b.active = b.allies.findIndex(a => a.id === 'gerard');
  const boost = act(b, 'skill', undefined, 'analisis');
  assert.deepEqual(boost.stats.map(c => c.stats), [['fuerza', 'magia'], ['fuerza', 'magia']]);
  assert.ok(SKILLS.find(skill => skill.id === 'cardioide').node, 'a node of its tree');
});
