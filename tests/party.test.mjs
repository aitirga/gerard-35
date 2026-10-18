import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, enemyAct, nextRound, skillsFor, validTargets } from '../src/battle.ts';
import { PROFILES, healing, magical, physical, withBonus } from '../src/stats.ts';
import { battleDriver, partnerDriven, waitingForPlayer2 } from '../src/party.ts';
import { pathTo } from '../src/follower.ts';
import { Story, STORY_FLAGS } from '../src/story.ts';

const chapter2 = () => new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('caught') + 1));

test('average stats leave every base amount as it is; stats above or below move it', () => {
  const kid = PROFILES.gerard, dog = PROFILES.dog;
  assert.equal(physical(18, kid, dog), 18);
  assert.equal(magical(40, kid, PROFILES.minion), 40);
  assert.equal(healing(24, kid), 24);
  assert.equal(physical(18, PROFILES.aitor, dog), 21, 'Aitor hits harder');
  assert.equal(healing(24, PROFILES.gerard35), 27, 'Gerard at 35 heals better');
  assert.equal(physical(1, kid, { ...dog, defensa: 40 }), 1, 'a hit always does something');
  assert.deepEqual(withBonus(kid, { magia: 2, defensa: -20 }).defensa, 1, 'no stat drops below 1');
});

test('chapter 2 fights Gerard at 35 and Aitor, fastest first, with their own skills', () => {
  const story = chapter2();
  const s = createBattle(story.battleParty(true), 2, false, undefined, story.classes);
  assert.deepEqual(s.allies.map(a => a.id), ['gerard', 'aitor'], 'Gerard (Velocidad 11) acts before Aitor (10)');
  assert.deepEqual(s.allies.map(a => a.maxHp), [120, 135]);
  const [gerard, aitor] = s.allies;
  assert.ok(skillsFor(s, gerard).some(k => k.id === 'nota'), 'Gerard keeps Noísta');
  assert.ok(!skillsFor(s, gerard).some(k => k.id === 'analisis'), 'Análisis Parálisis is Matemágico\'s');
  assert.deepEqual(s.animas, ['matemagico', 'noista']);
  assert.ok(!skillsFor(s, gerard).some(k => k.id === 'abrazo'), 'Abrazo is Aitor\'s own');
  assert.deepEqual(skillsFor(s, aitor).map(k => k.id), ['impulse', 'encourage', 'abrazo']);
  assert.equal(createBattle(story.battleParty(false), 2).allies.length, 1, 'without his partner Gerard fights alone');
});

test('Abrazo heals the whole party at once and needs nobody picked', () => {
  const s = createBattle(chapter2().battleParty(true), 2);
  act(s, 'defend');
  const aitor = s.allies[1];
  assert.equal(act(s, 'skill', undefined, 'abrazo'), undefined, 'nobody is hurt yet');
  s.allies[0].hp = 100; aitor.hp = 130;
  assert.equal(validTargets(s, 'skill', 'abrazo').length, 2);
  const hug = act(s, 'skill', undefined, 'abrazo');
  assert.deepEqual(hug.healed, [{ id: 'gerard', amount: 14 }, { id: 'aitor', amount: 5 }]);
  assert.equal(aitor.secondary, 18);
  assert.equal(s.phase, 'enemy');
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  assert.equal(s.phase, 'player');
});

test('ánimas belong to the party: Aitor can wear Noísta and use No-ta, Bernat wears none', () => {
  const story = chapter2();
  assert.deepEqual(story.classes, ['matemagico', 'noista']);
  assert.equal(new Story(['intro']).classOf('gerard'), 'matemagico', 'Matemágico is Gerard\'s from the start');
  assert.equal(new Story(['bernat-joined']).wear('bernat', 'matemagico'), false, 'Bernat only attacks');
  assert.equal(story.wear('aitor', 'noista'), true);
  assert.equal(story.classOf('aitor'), 'noista');
  assert.equal(story.classOf('gerard'), 'noista', 'both can wear it at once');
  const s = createBattle(story.battleParty(true), 1);
  const aitor = s.allies.find(a => a.id === 'aitor');
  assert.ok(skillsFor(s, aitor).some(k => k.id === 'nota'));
  assert.equal(aitor.stats.magia, PROFILES.aitor.magia + 2, 'and he gets its stats');
  story.wear('gerard', null);
  assert.equal(story.gerardClass, undefined, 'Gerard can take it off');
  assert.equal(new Story(['intro']).wear('gerard', 'noista'), false, 'locked ánimas cannot be worn');
  const reloaded = chapter2(); reloaded.loadout = { ...story.loadout, aitor: 'nonsense', jan: 'noista' };
  assert.deepEqual(reloaded.loadout, { gerard: null }, 'invalid saved choices are dropped');
});

test('player 2 plays Aitor; solo mode is only for development', () => {
  const duo = { mode: 'duo', secondPad: true }, alone = { mode: 'duo', secondPad: false }, solo = { mode: 'solo', secondPad: true };
  assert.equal(partnerDriven(duo, 'aitor'), true);
  assert.equal(partnerDriven(duo, 'bernat'), false, 'Bernat always follows');
  assert.equal(partnerDriven(alone, 'aitor'), false, 'without a second controller Aitor follows Gerard');
  assert.equal(partnerDriven(solo, 'aitor'), false);
  assert.equal(battleDriver(duo, 'gerard'), 1);
  assert.equal(battleDriver(duo, 'aitor'), 2);
  assert.equal(battleDriver(solo, 'aitor'), 1, 'solo: Gerard\'s player also picks Aitor\'s moves');
  assert.equal(battleDriver(duo, 'bernat'), 1);
  assert.equal(waitingForPlayer2(alone, 'aitor'), true, 'Aitor\'s turn waits for a second controller');
  assert.equal(waitingForPlayer2(duo, 'aitor'), false);
  assert.equal(waitingForPlayer2(solo, 'aitor'), false);
});

test('a partner who starts away from Gerard gets a walkable path to him', () => {
  const grid = ['#####', '#...#', '#.#.#', '#...#', '#####'];
  const path = pathTo(grid, { x: 1, z: 3 }, { x: 3, z: 1 });
  assert.equal(path.length, 4);
  assert.deepEqual(path.at(-1), { x: 3, z: 1 });
  assert.ok(path.every(c => grid[c.z][c.x] === '.'), 'never through a wall');
  assert.deepEqual(pathTo(grid, { x: 1, z: 1 }, { x: 3, z: 3 }, [{ x: 2, z: 1 }, { x: 1, z: 2 }]), [], 'no way round');
});
