import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_FLAGS } from '../src/story.ts';
import { STORY_ARCS, flagsAt, missionJump, missionNow, missionParts, missionsDone, spotAt, topLevel } from '../src/story-points.ts';

test('every story flag is set in exactly one step', () => {
  const placed = STORY_ARCS.flatMap(a => a.steps.flatMap(s => s.flags));
  assert.deepEqual([...placed].sort(), [...STORY_FLAGS].sort());
});

test('chapter 1 runs in one line, arc after arc', () => {
  assert.deepEqual(flagsAt('wrapper-room'), STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('wrapper-room') + 1));
  assert.deepEqual(flagsAt('bernat-joined').at(-2), 'got-backpack');
});

test('each ánima mission stands on its own', () => {
  const nuria = flagsAt('anima-nuria');
  assert.ok(nuria.includes('anima-nuria') && nuria.includes('metro'));
  assert.ok(!nuria.includes('castle'), 'Nuria and Uri do not need the castle');
  assert.ok(!flagsAt('castle').includes('anima-nuria'), 'nor does the castle need them');
});

test('Nuria and Uri are one mission with one ánima, and so are the university friends', async () => {
  const { ANIMA_IDS } = await import('../src/animas.ts');
  assert.deepEqual(ANIMA_IDS, ['nuria', 'universidad']);
  assert.ok(!STORY_FLAGS.includes('anima-uri'));
  assert.equal(STORY_ARCS.find(a => a.anima === 'nuria').title, 'Misión de Nuria y Uri');
});

test('other missions join only once the jump reaches where they start', () => {
  assert.ok(!flagsAt('got-wrapper', ['nuria']).includes('anima-nuria'));
  assert.ok(!flagsAt('got-wrapper', ['nuria']).includes('metro'));
  assert.ok(flagsAt('castle', ['nuria']).includes('anima-nuria'));
  assert.deepEqual(missionsDone(flagsAt('castle', ['nuria'])), ['nuria']);
});

test('the news carry the R4 clue, and the city steps stand where they happen', () => {
  assert.ok(flagsAt('tv-news').includes('clue-r4'));
  assert.equal(spotAt('rec-comtal')?.environment, 'rec-comtal');
  assert.equal(spotAt('caught'), undefined);
});

test('every mission starts from its beginning, and every part of one is a place to stand', async () => {
  const { ANIMA_IDS } = await import('../src/animas.ts');
  const { ENVIRONMENTS } = await import('../src/environments.ts');
  const { canWalk } = await import('../src/movement.ts');
  const { entranceId } = await import('../src/transit.ts');
  for (const anima of ANIMA_IDS) {
    const parts = missionParts(anima);
    assert.equal(parts[0].id, 'start', `${anima} starts at its beginning`);
    assert.equal(new Set(parts.map(p => p.id)).size, parts.length, `${anima}'s parts have their own ids`);
    for (const part of parts) {
      const jump = missionJump(anima, part.id);
      assert.ok(jump, `${anima} ${part.id}`);
      // Coming up from the R4 stands Gerard at the station entrance, as a trip does.
      const station = ENVIRONMENTS[jump.spot?.environment ?? 'maresme'].interactions.some(i => i.id === entranceId('cardedeu') && i.cell.x === jump.spot?.cell?.x && i.cell.z === jump.spot?.cell?.z);
      if (jump.spot?.cell && !station) assert.ok(canWalk(jump.spot.cell, ENVIRONMENTS[jump.spot.environment].grid), `${anima} ${part.id} stands on a walkable cell`);
    }
  }
  assert.equal(missionJump('nuria', 'nope'), undefined);
});

test('a part of Nuria\'s mission brings what comes before it, and nothing of the mission after', () => {
  const start = missionJump('nuria', 'start');
  assert.ok(start.flags.includes('metro') && !start.flags.includes('cardedeu'), 'the R4 is still to arrive');
  assert.deepEqual(start.part.event, { type: 'arrive', station: 'cardedeu' });
  const ring = missionJump('nuria', 'ring-3', ['nuria']);
  assert.ok(ring.flags.includes('cardedeu') && !ring.flags.includes('nuria-uri') && !ring.flags.includes('papagato'));
  assert.ok(!ring.flags.includes('anima-nuria'), 'its own ánima never joins');
  assert.deepEqual(ring.part.nuria.beaten, ['fear-cebollon', 'fear-plato'], 'the rings below are beaten');
  assert.ok(missionJump('nuria', 'done').flags.includes('anima-nuria'));
});

test('a part of Nuria\'s mission starts the run where it is', async () => {
  const { Story } = await import('../src/story.ts');
  const jump = missionJump('nuria', 'ring-2');
  const story = new Story(jump.flags);
  story.startNuria(jump.part.nuria);
  assert.ok(story.classes.includes('papagato'), 'Papagato lent');
  assert.equal(story.gerardClass, 'papagato');
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => t.id), ['uri-1'], 'Uri waits at the end of the second ring');
  const hunting = story.fears('cardedeu-laberinto');
  assert.deepEqual(hunting.filter(f => !f.respawn).map(f => f.id), ['fear-plato', 'fear-escolta'], 'El Cebollón stays beaten');
  assert.equal(hunting.filter(f => f.respawn && f.encounter !== 'cebolla').length, 9, 'the young of every ring are all out');
  assert.equal(hunting.filter(f => f.encounter === 'cebolla').length, 2, 'and the big onions');
  assert.equal(missionNow('nuria', story.saved, story.nuria), 'ring-2');
  const won = missionJump('nuria', 'won'), end = new Story(won.flags);
  end.startNuria(won.part.nuria);
  end.handle(won.part.event);
  assert.ok(end.has('nuria-uri') && end.has('papagato') && end.has('luz-uri'), 'beating Vertitrón wins the mission');
  assert.equal(missionNow('nuria', end.saved, end.nuria), 'done');
  assert.equal(missionNow('nuria', flagsAt('got-wrapper')), undefined, 'before the first metro there is no mission');
  const street = missionJump('nuria', 'street'), up = new Story(street.flags);
  up.startNuria(street.part.nuria);
  assert.equal(street.spot.environment, 'cardedeu-calle');
  assert.equal(missionNow('nuria', up.saved, up.nuria), 'street');
  assert.deepEqual(up.triggers('cardedeu-calle').map(t => t.id), ['portal', 'portal-through'], 'the bubble still to be seen');
  const portal = missionJump('nuria', 'portal'), there = new Story(portal.flags);
  there.startNuria(portal.part.nuria);
  assert.equal(missionNow('nuria', there.saved, there.nuria), 'portal');
  assert.deepEqual(there.triggers('cardedeu-calle').map(t => t.id), ['portal-through']);
});

test('the picker\'s ánimas replace the story\'s until given back, and nothing grows meanwhile', async () => {
  const { Story } = await import('../src/story.ts');
  const story = new Story(flagsAt('got-wrapper'));
  const given = story.classes;
  assert.ok(!given.includes('papagato'), 'Papagato comes later, from Nuria');
  story.debugAnimas = { papagato: 3 };
  assert.deepEqual(story.classes, ['papagato']);
  assert.deepEqual(story.levels, { papagato: 3 });
  assert.deepEqual(story.storyClasses, given, 'the story\'s own stay as they were');
  assert.ok(story.equip('gerard', 'papagato'));
  for (let i = 0; i < 9; i++) story.handle({ type: 'battle', won: true, encounter: 'palace-guards', worn: ['papagato'], xp: 100 });
  assert.ok(!story.has('papagato-2'), 'no level flag while the picker holds them');
  story.debugAnimas = undefined;
  assert.deepEqual(story.classes, given);
  assert.equal(topLevel('papagato'), 3);
  assert.equal(topLevel('matemagico'), 3, 'Matemágico has its level table too');
});
