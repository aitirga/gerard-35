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

test('chapter 2 fights Gerard at 35 and Aitor, fastest first, with their ánimas\' skills', () => {
  const story = chapter2();
  const s = createBattle(story.battleParty(true), 2, false, undefined, story.classes);
  assert.deepEqual(s.allies.map(a => a.id), ['gerard', 'aitor'], 'Gerard (Velocidad 11) acts before Aitor (10)');
  assert.deepEqual(s.allies.map(a => a.maxHp), [120, 135]);
  const [gerard, aitor] = s.allies;
  assert.ok(skillsFor(s, gerard).some(k => k.id === 'foc-binari'), 'Gerard keeps Matemágico');
  assert.deepEqual(s.animas, ['matemagico', 'tecnopata'], 'and Aitor has his own, Tecnópata');
  assert.deepEqual(skillsFor(s, aitor).map(k => k.id), ['rayo-energia', 'rayo-sanacion', 'explosion', 'confusion', 'rayo-encogedor'], 'Tecnópata\'s are Bip\'s');
  assert.equal(createBattle(story.battleParty(false), 2).allies.length, 1, 'without his partner Gerard fights alone');
});

test('each has their own ánima, fixed, and one extra slot for a shared one; two never equip the same; Bernat none', async () => {
  const { EXTRA_SLOTS } = await import('../src/story.ts');
  const story = chapter2();
  assert.equal(EXTRA_SLOTS, 1);
  assert.deepEqual(story.classes, ['matemagico', 'tecnopata']);
  assert.equal(new Story(['intro']).classOf('gerard'), undefined, 'no ánima until the palace');
  assert.equal(story.fixedOf('gerard'), 'matemagico'); assert.equal(story.fixedOf('aitor'), 'tecnopata');
  assert.deepEqual(story.party.map(m => m.classId), ['matemagico', 'tecnopata'], 'each wears their own');
  assert.equal(story.equip('aitor', 'matemagico'), false, 'Gerard\'s own is never anyone else\'s');
  assert.equal(story.unequip('gerard', 'matemagico'), false, 'and is never taken off');
  assert.equal(new Story(['bernat-joined', 'matemagico']).equip('bernat', 'matemagico'), false, 'Bernat only attacks');
  const both = new Story([...STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('got-wrapper') + 1), 'papagato']);
  assert.equal(both.equip('gerard', 'papagato'), true);
  assert.deepEqual(both.kitOf('gerard'), ['matemagico', 'papagato'], 'L / R walk his own and his extra');
  assert.equal(both.classOf('gerard'), 'papagato', 'equipping one puts it on');
  assert.equal(both.equip('aitor', 'papagato'), false, 'Gerard has it equipped');
  assert.equal(both.wearerOf('papagato'), 'gerard');
  assert.ok(both.wear('gerard', 'matemagico'));
  assert.equal(both.equip('aitor', 'papagato'), false, 'wearing his own does not free his extra');
  assert.ok(both.unequip('gerard', 'papagato'));
  assert.equal(both.equip('aitor', 'papagato'), true, 'once he takes it off, Aitor can');
  assert.deepEqual(both.battleParty(true).map(p => p.kit), [['matemagico'], ['tecnopata', 'papagato']]);
  // An old save, from before extras: both chose Papagato; Gerard keeps it.
  both.loadout = { gerard: 'papagato', aitor: 'papagato' };
  assert.deepEqual(both.kitOf('gerard'), ['matemagico', 'papagato']); assert.deepEqual(both.kitOf('aitor'), ['tecnopata']);
  assert.equal(new Story(['intro']).equip('gerard', 'matemagico'), false, 'locked ánimas cannot be equipped');
  const reloaded = chapter2(); reloaded.loadout = { worn: { aitor: 'nonsense', jan: 'matemagico' }, extras: { aitor: ['matemagico'] } };
  assert.deepEqual(reloaded.loadout, { worn: {}, extras: {} }, 'invalid saved choices are dropped');
});

test('in a fight nobody puts on an ánima someone else wears, or one that is not theirs; L and R skip them', async () => {
  const { switchAnima, wearAnima } = await import('../src/battle.ts');
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor' }], 1, false, undefined, ['matemagico', 'papagato', 'tecnopata']);
  s.active = s.allies.findIndex(a => a.id === 'aitor');
  assert.equal(wearAnima(s, 'papagato'), false, 'Gerard has it on');
  assert.equal(wearAnima(s, 'matemagico'), false, 'it is Gerard\'s');
  assert.equal(switchAnima(s, 1), 'tecnopata', 'R walks to the one he can wear');
  assert.equal(switchAnima(s, 1), undefined, 'and there is no other');
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
