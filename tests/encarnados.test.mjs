import test from 'node:test';
import assert from 'node:assert/strict';
import { STRONG, STRONG_LIGHTS, floorFor } from '../src/castle.ts';
import { createEncounter } from '../src/battle.ts';
import { createFight, seeded, simulate, storyPoint, DUO } from '../src/battle-sim.ts';
import { roomTag } from '../src/castle-pupils.ts';
import { Story } from '../src/story.ts';
import { flagsAt, stepOf } from '../src/story-points.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];

test('Encarnados in a fight: the same pupils, with more PV and harder blows, and only pupils', () => {
  const plain = createEncounter(party, 'alumnos-1a', { random: seeded(3) }), strong = createEncounter(party, 'alumnos-1a', { strong: true, random: seeded(3) });
  assert.deepEqual(strong.foes.map(f => f.kind), plain.foes.map(f => f.kind), 'the same room');
  strong.foes.forEach((foe, i) => {
    assert.equal(foe.maxHp, Math.round(plain.foes[i].maxHp * STRONG.pv));
    assert.equal(foe.hp, foe.maxHp); assert.equal(foe.stats.pv, foe.maxHp);
    assert.equal(foe.castle.strong, true);
  });
  assert.ok(strong.strong && !plain.strong);
  assert.match(strong.message, /encarnados/);
  assert.ok(plain.foes.every(f => !f.castle.strong));
  // The night's group, the same.
  const night = createEncounter(party, 'night-guard', { night: { room: 'alumnos-1a', might: 1 }, strong: true, random: seeded(3) });
  assert.ok(night.foes.every(f => f.castle.strong) && night.encounter === 'night-guard');
  // A boss is never one, whatever is asked; nor a fight outside the castle.
  for (const fight of ['aurelia', 'direccion', 'cebollon']) {
    const state = createEncounter(party, fight, { strong: true, random: seeded(1) });
    assert.ok(!state.strong && state.foes.every(f => !f.castle?.strong), fight);
  }
});

test('the simulator knows them by the setup or by the fight\'s name, and they are harder than their room', () => {
  const byName = createFight({ fight: 'alumnos-1a:encarnados', party: DUO, policy: 'smart' }, seeded(2)), bySetup = createFight({ fight: 'alumnos-1a', strong: true, party: DUO, policy: 'smart' }, seeded(2));
  assert.ok(byName.strong && bySetup.strong);
  assert.deepEqual(byName.foes.map(f => f.maxHp), bySetup.foes.map(f => f.maxHp));
  assert.ok(createFight({ fight: 'night-guard:encarnados', party: DUO, policy: 'smart' }, seeded(2)).strong);
  // The party the second floor asks for (the castle does not soften for a smaller one).
  const setup = { party: DUO, policy: 'smart', ...storyPoint('castillo-2').setup };
  const room = simulate({ ...setup, fight: 'alumnos-2d' }, 12, 5), red = simulate({ ...setup, fight: 'alumnos-2d:encarnados' }, 12, 5);
  assert.ok(red.roundsWon > room.roundsWon, `${red.roundsWon} rounds against ${room.roundsWon}`);
});

test('one group every other day, in a room of the floor or out at night: beaten, an Eco de luz, and no more that day', () => {
  const story = new Story(flagsAt('castle'));
  if (story.clock.day % 2) story.days.clock.day += 1;
  const ecos = story.ecos;
  // By day, a room of the floor is theirs, and only one.
  const room = story.strongRoomOf(1), floor = floorFor(story.days.epoch, story.clock.day, 1);
  assert.ok(floor.rooms.some(r => r.id === room && r.encounter?.startsWith('alumnos-')), 'a plain room of today\'s floor');
  // At night, one of the groups out.
  story.days.clock.hour = 22;
  assert.equal(story.night, true);
  assert.equal(story.strongGroup, STRONG.group);
  story.handle({ type: 'near', id: 'night-1' });
  assert.equal(story.strongFight, false, 'another group: a fight as always');
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'night-guard' }).filter(e => e.kind === 'lights'), []);
  const caught = story.handle({ type: 'near', id: `night-${STRONG.group}` });
  assert.ok(caught.some(e => e.kind === 'battle' && e.encounter === 'night-guard'));
  assert.equal(story.strongFight, true);
  // Lost: nothing, and they are still out.
  story.handle({ type: 'battle', won: false, encounter: 'night-guard' });
  assert.equal(story.strongFight, false);
  assert.equal(story.ecos, ecos);
  // The day after, none; two days after they are out again: beaten, the Eco de luz.
  // (lost at night, the day ends: it is already the next morning)
  if (story.clock.day % 2 === 0) story.days.clock.day += 1;
  story.days.clock.hour = 22;
  assert.equal(story.strongGroup, undefined, 'one day in two');
  story.days.clock.day += 1; story.days.clock.hour = 22;
  story.handle({ type: 'near', id: `night-${STRONG.group}` });
  const won = story.handle({ type: 'battle', won: true, encounter: 'night-guard' });
  assert.deepEqual(won.find(e => e.kind === 'lights'), { kind: 'lights', people: ['encarnado-1'] });
  assert.ok(story.has('luz-encarnado-1'));
  assert.equal(story.ecos, ecos + 1);
  // Not again today: neither the night's group nor a room.
  assert.equal(story.strongGroup, undefined);
  assert.equal(story.strongRoomOf(1), undefined);
  story.handle({ type: 'near', id: `night-${STRONG.group}` });
  assert.equal(story.strongFight, false);
  // Two days after, in the castle: the room that is theirs today.
  story.days.clock.day += 2; story.days.clock.hour = 10;
  const today = story.strongRoomOf(1);
  assert.ok(today !== undefined);
  story.handle({ type: 'near', id: roomTag(1, today) });
  assert.equal(story.strongFight, true);
  const room2 = floorFor(story.days.epoch, story.clock.day, 1).rooms.find(r => r.id === today).encounter;
  const inside = story.handle({ type: 'battle', won: true, encounter: floorFor(story.days.epoch, story.clock.day, 1).rooms.find(r => r.id === today).encounter });
  assert.deepEqual(inside.filter(e => e.kind === 'lights').map(e => e.people[0]).sort(), ['encarnado-2', room2].sort(), 'the Encarnados\' eco, and the room\'s own the first time');
  assert.equal(story.ecos, ecos + 3);
});

test('six in a game and no more, none in chapter 1, and the picker reaches them', () => {
  assert.equal(STRONG_LIGHTS.length, 6);
  const story = new Story(flagsAt('castle'));
  const before = story.ecos;
  for (let day = 0; day < 10; day++) {
    story.days.clock.day += story.clock.day % 2 ? 1 : 2; story.days.clock.hour = 22;
    story.handle({ type: 'near', id: `night-${STRONG.group}` });
    story.handle({ type: 'battle', won: true, encounter: 'night-guard' });
  }
  assert.equal(story.ecos, before + 6);
  assert.equal(story.strongGroup, undefined, 'none left: they do not come out again');
  assert.equal(new Story(flagsAt('first-fight')).strongGroup, undefined);
  for (const id of STRONG_LIGHTS) assert.equal(stepOf(`luz-${id}`).arc.id, 'encarnados');
  assert.equal(new Story(flagsAt('luz-encarnado-4')).ecos - new Story(flagsAt('castle')).ecos, 4);
});

test('each room of the castle gives an Eco de luz the first time it is beaten, and only then', () => {
  const story = new Story(flagsAt('castle'));
  if (!(story.clock.day % 2)) story.days.clock.day += 1;
  const before = story.ecos;
  const first = story.handle({ type: 'battle', won: true, encounter: 'alumnos-2c' });
  assert.deepEqual(first.find(e => e.kind === 'lights'), { kind: 'lights', people: ['alumnos-2c'] });
  assert.ok(story.has('luz-alumnos-2c'));
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'alumnos-2c' }).filter(e => e.kind === 'lights'), []);
  assert.deepEqual(story.handle({ type: 'battle', won: false, encounter: 'delegada-1' }).filter(e => e.kind === 'lights'), []);
  story.handle({ type: 'battle', won: true, encounter: 'delegada-1' });
  assert.equal(story.ecos, before + 2);
  // Not out at night, nor for a boss.
  assert.ok(!story.handle({ type: 'battle', won: true, encounter: 'night-guard' }).some(e => e.kind === 'lights'));
});
