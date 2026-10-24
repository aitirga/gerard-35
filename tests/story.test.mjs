import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { PLACES, LEASH } from '../src/chapter-1.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

const kinds = effects => effects.map(e => e.id ?? e.item ? `${e.kind}:${e.id ?? e.item}` : e.kind);

test('block 1 plays from waking up to the first fight in order', () => {
  const story = new Story();
  assert.equal(story.started, false);
  assert.deepEqual(kinds(story.handle({ type: 'start' })), ['card:intro', 'dialogue']);
  assert.deepEqual(story.handle({ type: 'start' }), [], 'the intro plays once');
  assert.equal(story.canRun, false);

  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'talk-jan' })), ['dialogue']);
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'take-pocion' })), ['dialogue', 'item:pocion']);
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'talk-mama' })), ['dialogue', 'item:zapatillas', 'hint:run']);
  assert.equal(story.canRun, true);

  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'take-mochila' })), ['dialogue', 'item:mochila', 'hint:items']);
  assert.deepEqual(story.items, ['zapatillas', 'mochila', 'pocion']);
  assert.equal(story.gate('leave-hall'), undefined);

  assert.equal(story.companion, 'none');
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'call-bernat' })), ['dialogue', 'hint:party']);
  assert.equal(story.companion, 'follow');
  assert.deepEqual(story.party.map(m => [m.id, m.equipment]), [['gerard', ['zapatillas', 'mochila']], ['bernat', []]]);

  assert.equal(story.bubble, undefined, 'Bernat only talks over his head when he stalls');
  story.handle({ type: 'south' });
  assert.equal(story.companion, 'stalled');
  const seen = [story.bubble];
  for (let i = 0; i < 3; i++) { story.handle({ type: 'leash' }); seen.push(story.bubble); }
  assert.deepEqual([...new Set(seen)], ['¿Gerard…?', 'Espera.', 'Esto… ya lo he visto.']);

  assert.equal(story.minion, 'lurking');
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'talk-bernat' })), ['dialogue', 'minion']);
  assert.equal(story.companion, 'follow');
  assert.equal(story.bubble, undefined);
  assert.equal(story.battles, true);
  assert.equal(story.possessed, false, 'the dogs turn when the bubble pops, not before');

  assert.deepEqual(kinds(story.handle({ type: 'minion' })), ['dialogue', 'battle']);
  assert.deepEqual(story.handle({ type: 'minion' }), [], 'the minion shows itself once');
  assert.equal(story.possessed, true);
  assert.equal(story.minion, 'gone', 'back down the manhole');
  assert.equal(story.tone, 'day');

  assert.deepEqual(story.handle({ type: 'battle', won: false }), [], 'losing lets them try again');
  assert.equal(story.tone, 'day');
  assert.deepEqual(kinds(story.handle({ type: 'battle', won: true })), ['dialogue', 'palace']);
  assert.deepEqual(story.handle({ type: 'battle', won: true }), [], 'later fights are just fights');
  assert.equal(story.minion, 'gone');
  assert.equal(story.tone, 'bubbaloo');
  assert.equal(story.palace, false, 'the palace stands once its cut-scene has played');
  assert.deepEqual(story.saved, STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('first-fight') + 1));
});

test('the palace rises, they go in, and Noísta wakes up in the wrapper room', () => {
  const story = new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('first-fight') + 1));
  assert.deepEqual(kinds(story.handle({ type: 'start' })), ['palace'], 'a reload replays the transformation');
  assert.deepEqual(kinds(story.handle({ type: 'palace' })), ['dialogue']);
  assert.equal(story.palace, true);
  assert.deepEqual(story.handle({ type: 'palace' }), []);
  assert.deepEqual(story.resume, { environment: 'maresme', cell: { x: 16, z: 8 } });

  // Heading south, Bernat says it is the other way; back north, he is quiet.
  story.handle({ type: 'away', away: true });
  assert.equal(story.bubble, 'Es por el otro lado.');
  story.handle({ type: 'away', away: false });
  assert.equal(story.bubble, undefined);

  const gate = story.interactions('maresme').find(i => i.id === 'enter-palace');
  assert.ok(gate, 'La Pompa can be crossed once the palace stands');
  const inside = story.handle({ type: 'interact', id: 'enter-palace' });
  assert.deepEqual(kinds(inside), ['gate', 'travel', 'dialogue']);
  assert.deepEqual(inside[1], { kind: 'travel', environment: 'palacio', cell: PLACES.palaceEntry.cell });
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'enter-palace' })), ['gate', 'travel'], 'the welcome plays once');

  // Diegetic gates: the bubble will not let them out, the back door is stuck, the curtain explains itself.
  assert.match(story.gate('leave-palace').lines[0].text, /pompa/);
  assert.deepEqual(story.blocked('palacio'), [{ x: 10, z: 16 }]);
  assert.match(story.handle({ type: 'interact', id: 'push-back-door' })[0].dialogue.lines[0].text, /pegada/);
  assert.equal(story.handle({ type: 'interact', id: 'look-curtain' })[0].dialogue.right, 'bernat');
  for (let i = 1; i <= 5; i++) assert.equal(kinds(story.handle({ type: 'interact', id: `portrait-${i}` }))[0], 'dialogue');
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'take-chicle' })), ['dialogue', 'item:chicle']);
  assert.ok(story.items.includes('chicle'));

  assert.deepEqual(story.handle({ type: 'room', id: 'Galería de los Retratos' }), []);
  assert.deepEqual(kinds(story.handle({ type: 'room', id: 'Sala de los Envoltorios' })), ['dialogue', 'drain', 'dialogue', 'battle']);
  assert.equal(story.gerardClass, 'matemagico');
  story.wear('gerard', null);
  story.handle({ type: 'class', id: 'noista' });
  assert.equal(story.gerardClass, 'noista');
  assert.match(story.party[0].note, /Noísta/);
  const won = story.handle({ type: 'battle', won: true, encounter: 'palace-minion' });
  assert.deepEqual(won.map(e => e.kind), ['dialogue', 'ambush']);
  assert.match(won[0].dialogue.lines.at(-1).text, /Quiere…$/, 'Bernat is cut off mid-sentence');
  assert.deepEqual(story.blocked('palacio'), [], 'the back door peels open');
  assert.equal(story.gate('leave-palace'), undefined);
  assert.deepEqual(story.handle({ type: 'room', id: 'Sala de los Envoltorios' }), [], 'the room is quiet now');
  assert.deepEqual(kinds(new Story(story.saved).handle({ type: 'start' })), ['ambush'], 'a reload replays the ambush');
});

test('caught by the Queen, Gerard wakes up at 35 in Barcelona with Aitor and a Bubbaloo wrapper', () => {
  const story = new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('wrapper-room') + 1));
  assert.equal(story.adult, false);
  const caught = story.handle({ type: 'caught' });
  assert.deepEqual(kinds(caught), ['travel', 'wake', 'dialogue', 'rise', 'hint:duo'], 'a second player can take Aitor from here');
  assert.deepEqual(caught[0], { kind: 'travel', environment: 'meridiana', cell: PLACES.wakeUp.cell });
  assert.equal(caught[2].dialogue.right, 'aitor');
  assert.deepEqual(story.handle({ type: 'caught' }), [], 'it happens once');
  assert.deepEqual(story.handle({ type: 'start' }), [], 'and no cut-scene replays after waking');

  assert.equal(story.adult, true);
  assert.equal(story.gerardClass, 'noista', 'he keeps the class');
  assert.equal(story.companion, 'none', 'Bernat stays in the dream');
  assert.deepEqual(story.items, [], 'the dream\'s things stay in the dream');
  assert.equal(story.canRun, true);
  assert.deepEqual(story.resume, { environment: 'meridiana', cell: PLACES.wakeUp.cell });
  assert.deepEqual(story.npcs('meridiana'), [], 'Aitor is no NPC: he walks with Gerard');
  assert.equal(story.partner, 'aitor');
  assert.deepEqual(story.party.map(m => [m.id, m.profile, m.classId]), [['gerard', 'gerard35', 'noista'], ['aitor', 'aitor', undefined]]);
  assert.deepEqual(story.npcs('home-floor-1'), [], 'home in Sant Quirze is empty now');
  assert.match(story.party[0].note, /Noísta/);

  assert.deepEqual(story.pickups('meridiana').map(p => p.id), ['envoltorio']);
  assert.ok(story.pickups('meridiana')[0].spot, 'the wrapper lies on the bedside shelf');
  assert.ok(!story.interactions('meridiana').some(i => i.id === 'talk-aitor'), 'talking to Aitor needs to know where he is');
  assert.deepEqual(story.interactions('meridiana', { x: 9.4, z: 13.6 }).find(i => i.id === 'talk-aitor').cell, { x: 9, z: 14 });
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'take-envoltorio' })), ['dialogue', 'item:envoltorio']);
  assert.deepEqual(story.items, ['envoltorio']);
  assert.match(story.handle({ type: 'interact', id: 'talk-aitor' })[0].dialogue.lines[1].text, /Bubbaloo/);
  assert.deepEqual(story.saved, STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('got-wrapper') + 1), 'every chapter 1 flag; chapter 2 starts here');
});

test('doors out of the house wait for breakfast and the backpack', () => {
  const story = new Story(['intro']);
  assert.match(story.gate('leave-hall').lines[0].text, /cocina/);
  assert.equal(story.gate('stairs-up'), undefined, 'only the house exits are gated');
  story.handle({ type: 'interact', id: 'talk-mama' });
  assert.equal(story.gate('leave-living').right, 'mama');
  assert.match(story.handle({ type: 'interact', id: 'call-bernat' })[0].dialogue.lines[0].text, /mochila/);
  assert.equal(story.companion, 'none');
});

test('Bernat stalls only while following, and the leash holds Gerard near him', () => {
  const story = new Story(['intro', 'got-shoes', 'got-backpack']);
  story.handle({ type: 'south' });
  assert.equal(story.has('bernat-stalled'), false);
  story.handle({ type: 'interact', id: 'call-bernat' });
  story.handle({ type: 'south' });
  const bernat = { x: 15, z: 30 };
  assert.equal(story.withinLeash({ x: 15, z: 30 + LEASH }, bernat), true);
  assert.equal(story.withinLeash({ x: 15, z: 31 + LEASH }, bernat), false);
  assert.ok(story.interactions('maresme', bernat).some(i => i.id === 'talk-bernat'));
});

test('saved flags restore the same state, and unknown flags are ignored', () => {
  const story = new Story(['intro', 'got-shoes', 'got-backpack', 'hacked']);
  assert.deepEqual(story.saved, ['intro', 'got-shoes', 'got-backpack']);
  assert.deepEqual(story.resume, { environment: 'maresme', cell: { x: 20, z: 23 } });
  assert.deepEqual(new Story().resume, { environment: PLACES.wake.environment, cell: PLACES.wake.cell });
  assert.deepEqual(story.pickups('home-floor-1'), []);
  assert.deepEqual(new Story().pickups('home-floor-1').map(p => p.id), ['mochila']);
});

test('story places stand on walkable cells of their scenes', () => {
  for (const [name, place] of Object.entries(PLACES)) {
    if (!place || typeof place !== 'object' || !('environment' in place)) continue;
    assert.ok(canWalk(place.cell, ENVIRONMENTS[place.environment].grid), `${name} at ${place.cell.x},${place.cell.z}`);
  }
  assert.ok(ENVIRONMENTS.maresme.props.some(p => p.kind === 'manhole' && p.x === PLACES.minion.manhole.x && p.z === PLACES.minion.manhole.z), 'the minion lives under a real manhole');
});

test('the server accepts exactly the story flags', () => {
  const server = readFileSync(new URL('../server.py', import.meta.url), 'utf8');
  const listed = server.match(/STORY_FLAGS = \(([^)]*)\)/)[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
  assert.deepEqual(listed, [...STORY_FLAGS]);
});

test('a reload between the déjà-vu and the minion plays its entrance again', () => {
  const story = new Story(['intro', 'got-shoes', 'got-backpack', 'bernat-joined', 'bernat-stalled', 'dejavu']);
  assert.deepEqual(kinds(story.handle({ type: 'start' })), ['minion']);
  story.handle({ type: 'minion' });
  assert.deepEqual(story.handle({ type: 'start' }), []);
  assert.equal(story.handle({ type: 'interact', id: 'talk-bernat' })[0].dialogue.lines[0].text.includes('rosa'), true);
});

const upTo = flag => STORY_FLAGS.slice(0, STORY_FLAGS.indexOf(flag) + 1);
const beats = effects => effects.map(e => e.kind === 'battle' ? `battle:${e.encounter}` : e.kind === 'metro' ? `metro:${e.station}` : e.kind);

test('chapter 2 morning: the TV turns on as Gerard walks up, and Aitor waits for it at the door', () => {
  const story = new Story(upTo('got-wrapper'));
  assert.ok(story.gate('meridiana-door'), 'Aitor hears the TV first');
  assert.deepEqual(story.triggers('meridiana').map(t => t.id), ['tv']);
  assert.deepEqual(story.triggers('meridiana-calle'), []);
  assert.deepEqual(beats(story.handle({ type: 'near', id: 'tv' })), ['news', 'dialogue']);
  assert.ok(story.has('tv-news') && story.has('clue-r4'), 'the ticker carried the R4 clue');
  assert.deepEqual(story.handle({ type: 'near', id: 'tv' }), [], 'the news plays itself once');
  assert.deepEqual(story.triggers('meridiana'), []);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-tv' })), ['news', 'dialogue'], 'and can be watched again');
  assert.equal(story.gate('meridiana-door'), undefined);
  // Chapter 1 never sees any of it.
  assert.deepEqual(new Story(upTo('wrapper-room')).triggers('meridiana'), []);
});

test('chapter 2 city: the metro opens the city, and the castle can be tried at once', () => {
  const story = new Story(upTo('tv-news'));
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'station-fabra-i-puig' })), ['dialogue', 'metro:fabra-i-puig']);
  assert.ok(story.has('metro'));
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'station-fabra-i-puig' })), ['metro:fabra-i-puig']);
  assert.deepEqual(beats(story.handle({ type: 'arrive', station: 'trinitat-vella' })), ['look', 'dialogue', 'look'], 'the camera turns to the castle while they talk');
  assert.deepEqual(story.handle({ type: 'arrive', station: 'trinitat-vella' }), []);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'enter-school' })), ['gate', 'travel', 'dialogue']);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'enter-school' })), ['gate', 'travel']);
  const out = story.redirect('leave-palace');
  assert.equal(out.environment, 'rec-comtal');
  assert.ok(canWalk(out.cell, ENVIRONMENTS['rec-comtal'].grid), 'the palace lets them out in front of the school');
  assert.ok(story.interactions('palacio').some(i => i.id === 'challenge-guards'));
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'challenge-guards' })), ['dialogue', 'battle:palace-guards']);
});

test('chapter 2: falling wakes Gerard at home and keeps everything', () => {
  // The TV news was seen (it carries the R4 clue) and the castle tried.
  const story = new Story([...upTo('castle'), 'clue-r4']);
  const before = story.saved;
  const fall = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.deepEqual(beats(fall), ['fall', 'travel', 'wake', 'dialogue', 'rise']);
  assert.deepEqual(fall[1], { kind: 'travel', environment: PLACES.wakeUp.environment, cell: PLACES.wakeUp.cell });
  assert.deepEqual(story.saved, STORY_FLAGS.filter(f => before.includes(f) || f === 'palace-tried'), 'nothing is lost, the try is remembered');
  const again = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.notEqual(again[3].dialogue, fall[3].dialogue, 'Aitor reacts differently the next time');
  // After a fall, Aitor brings up the clue the TV gave.
  assert.match(story.handle({ type: 'interact', id: 'talk-aitor' })[0].dialogue.lines.map(l => l.text).join(' '), /Cardedeu/);
  // Chapter 1's fights are simply tried again.
  assert.deepEqual(new Story(upTo('first-fight')).handle({ type: 'battle', won: false }), []);
});

test('ánimas strengthen the party and thin out the palace guards', () => {
  const none = new Story(upTo('palace-tried'));
  const two = new Story([...upTo('palace-tried'), 'anima-nuria', 'anima-uri']);
  assert.deepEqual(none.animas, []);
  assert.deepEqual(two.animas, ['nuria', 'uri']);
  assert.equal(none.battleParty(true)[0].bonus, undefined);
  assert.deepEqual(two.battleParty(true).map(m => m.bonus), [{ magia: 1, espiritu: 1, pv: 20, fuerza: 1, defensa: 1 }, { magia: 1, espiritu: 1, pv: 20, fuerza: 1, defensa: 1 }]);
  assert.equal(none.guarded.length, 3);
  assert.equal(two.guarded.length, 2);
  for (const cell of none.guarded) assert.ok(canWalk(cell, ENVIRONMENTS.palacio.grid), 'guards stand on the hall floor');
  assert.ok(canWalk({ x: 16, z: 10 }, ENVIRONMENTS.palacio.grid));
  assert.deepEqual(new Story(upTo('wrapper-room')).guarded, [], 'no guards in the dream');
});

test('days: things take hours, the evening is noticed, and at night the day is over', () => {
  const story = new Story(upTo('tv-news'));
  assert.deepEqual(story.clock, { day: 1, hour: 8 });
  story.handle({ type: 'interact', id: 'meridiana-piano' });
  assert.equal(story.clock.hour, 10, 'a piece on the piano takes two hours');
  story.handle({ type: 'arrive', station: 'fabra-i-puig' });
  assert.equal(story.clock.hour, 11, 'a trip takes one');
  for (let i = 0; i < 3; i++) story.handle({ type: 'interact', id: 'meridiana-piano' });
  assert.equal(story.clock.hour, 17);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-balcony' })), ['dialogue', 'dialogue'], 'Aitor notices the evening');
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-piano' })), ['dialogue', 'dialogue'], 'and wants to go home late');
  assert.ok(story.dusk > 0 && story.dusk < 1, 'the light turns with the evening');
  story.handle({ type: 'interact', id: 'meridiana-balcony' });
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-balcony' })), ['dialogue', 'dialogue', 'fall', 'travel', 'wake', 'dialogue', 'rise'], 'at 22:00 night falls wherever they are');
  assert.deepEqual(story.clock, { day: 2, hour: 8 });
  assert.equal(story.dusk, 0);
});

test('days: going to bed ends the day, and Aitor will not sleep before the news', () => {
  const early = new Story(upTo('got-wrapper'));
  assert.deepEqual(beats(early.handle({ type: 'interact', id: 'meridiana-bed' })), ['dialogue']);
  assert.equal(early.clock.day, 1);
  const story = new Story(upTo('tv-news'));
  assert.ok(story.interactions('meridiana').some(i => i.id === 'meridiana-bed'));
  assert.ok(canWalk(story.interactions('meridiana').find(i => i.id === 'meridiana-bed').cell, ENVIRONMENTS.meridiana.grid));
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-bed' })), ['dialogue', 'fall', 'travel', 'wake', 'dialogue', 'rise']);
  assert.equal(story.clock.day, 2);
  assert.deepEqual(new Story(upTo('wrapper-room')).interactions('meridiana').filter(i => i.id === 'meridiana-bed'), [], 'not in chapter 1');
});

test("the Queen's advance: without help she covers everything on the seventh morning, and the way out is back a day", () => {
  const story = new Story(upTo('castle'));
  const sleep = () => story.handle({ type: 'interact', id: 'meridiana-bed' });
  const spreads = [];
  for (let day = 1; day < 6; day++) { spreads.push(story.spread); sleep(); }
  assert.ok(spreads.every((s, i) => i === 0 || s > spreads[i - 1]), 'it spreads every morning');
  assert.equal(story.clock.day, 6);
  assert.equal(story.doomed, false);
  // On the sixth day they get the shoes back from nowhere, say: anything done that day.
  story.handle({ type: 'interact', id: 'meridiana-piano' });
  story.flags.add('palace-tried');
  const end = sleep();
  assert.deepEqual(beats(end), ['dialogue', 'fall', 'travel', 'wake', 'dialogue', 'rise', 'doom']);
  assert.equal(story.doomed, true);
  const back = story.rewind();
  assert.deepEqual(beats(back), ['travel', 'wake', 'dialogue', 'rise']);
  assert.deepEqual(story.clock, { day: 6, hour: 8 });
  assert.equal(story.has('palace-tried'), false, "the last day's progress is lost");
  assert.equal(story.has('castle'), true, 'everything before it is kept');
  assert.equal(story.days.epoch, 1);
  assert.equal(story.doomed, false);
  // Each ánima pushes her back three days.
  const helped = new Story([...upTo('castle'), 'anima-nuria']);
  helped.days.clock.day = 7;
  assert.equal(helped.doomed, false);
  helped.days.clock.day = 10;
  assert.equal(helped.doomed, true);
});

test('days saved elsewhere: later clocks win, and a rewind (newer epoch) replaces the flags', () => {
  const story = new Story(upTo('castle'));
  story.loadDays({ epoch: 0, clock: { day: 3, hour: 12 }, mornings: [] });
  assert.deepEqual(story.clock, { day: 3, hour: 12 });
  story.loadDays({ epoch: 0, clock: { day: 2, hour: 9 }, mornings: [] });
  assert.deepEqual(story.clock, { day: 3, hour: 12 }, 'an older save does not turn the clock back');
  story.loadDays({ epoch: 2, clock: { day: 2, hour: 8 }, mornings: [] }, upTo('tv-news'));
  assert.equal(story.has('castle'), false);
  assert.deepEqual(story.clock, { day: 2, hour: 8 });
  story.loadDays({ nonsense: true });
  assert.deepEqual(story.clock, { day: 2, hour: 8 });
});
test('ánimas grow with fights won wearing them, and each level says what it teaches', async () => {
  const { Story } = await import('../src/story.ts');
  const { LEVEL_WINS } = await import('../src/levels.ts');
  const story = new Story(['noista', 'papagato']);
  let learned = [];
  for (let i = 0; i < LEVEL_WINS[0]; i++) learned = story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['papagato', 'papagato', 'noista'] });
  assert.equal(story.wins.papagato, LEVEL_WINS[0], 'two wearers, one fight');
  assert.equal(story.levels.papagato, 2); assert.ok(story.has('papagato-2'));
  assert.deepEqual(learned.find(e => e.kind === 'learn'), { kind: 'learn', classId: 'papagato', level: 2, skills: ['llaga'] });
  assert.equal(story.levels.noista, 1, 'Noísta has no level table yet');
  story.handle({ type: 'battle', won: false, encounter: 'dogs', worn: ['papagato'] });
  assert.equal(story.wins.papagato, LEVEL_WINS[0], 'a lost fight teaches nothing');
});
