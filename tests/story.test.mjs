import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { PLACES, LEASH } from '../src/chapter-1.ts';
import { LINES_2 } from '../src/chapter-2.ts';
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

test('the palace rises, they go in, and Matemágico wakes up in the wrapper room', () => {
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
  assert.equal(story.gerardClass, undefined, 'no ánima before the fight');
  story.handle({ type: 'class', id: 'matemagico' });
  assert.equal(story.gerardClass, 'matemagico');
  assert.ok(story.has('matemagico'));
  assert.match(story.party[0].note, /Matemágico/);
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
  assert.equal(story.gerardClass, 'matemagico', 'he keeps the ánima');
  assert.equal(story.companion, 'none', 'Bernat stays in the dream');
  assert.deepEqual(story.items, [], 'the dream\'s things stay in the dream');
  assert.equal(story.canRun, true);
  assert.deepEqual(story.resume, { environment: 'meridiana', cell: PLACES.wakeUp.cell });
  assert.deepEqual(story.npcs('meridiana'), [], 'Aitor is no NPC: he walks with Gerard');
  assert.equal(story.partner, 'aitor');
  assert.deepEqual(story.party.map(m => [m.id, m.profile, m.classId]), [['gerard', 'gerard35', 'matemagico'], ['aitor', 'aitor', 'tecnopata']]);
  assert.deepEqual(story.npcs('home-floor-1'), [], 'home in Sant Quirze is empty now');
  assert.match(story.party[0].note, /Matemágico/);

  assert.deepEqual(story.pickups('meridiana').map(p => p.id), ['envoltorio']);
  assert.ok(story.pickups('meridiana')[0].spot, 'the wrapper lies on the bedside shelf');
  assert.ok(!story.interactions('meridiana', { x: 9.4, z: 13.6 }).some(i => i.id === 'talk-aitor'), 'Aitor is player 2: nobody talks to him through a prompt');
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'take-envoltorio' })), ['dialogue', 'item:envoltorio']);
  assert.deepEqual(story.items, ['envoltorio']);
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
test("chapter 2: the hall's east door opens onto the school, whose zones stay shut for now", () => {
  const child = new Story([]), story = new Story(['caught']);
  assert.ok(!child.interactions('palacio').some(i => i.id === 'palace-east-door'), 'in the dream it stays a thing to look at');
  assert.equal(child.redirect('palace-east-door'), undefined);
  const door = story.interactions('palacio').find(i => i.id === 'palace-east-door');
  assert.equal(door.label, 'Abrir la puerta');
  const to = story.redirect(door.id);
  assert.equal(to.environment, 'palacio-patio');
  assert.ok(canWalk(to.cell, ENVIRONMENTS['palacio-patio'].grid));
  // The gym, the secretaría and Direcció say why they will not open, in the world's own voice.
  for (const id of ['patio-gimnasio', 'patio-secretaria', 'secretaria-direccio']) assert.ok(story.gate(id)?.lines.length, id);
  for (const id of ['patio-vestibulo', 'secretaria-patio', 'trono-direccio', 'trono-escalera']) assert.equal(story.gate(id), undefined, `${id}: the ways back are always open`);
});

test('chapter 2: falling wakes Gerard at home and keeps everything', () => {
  // The TV news was seen (it carries the R4 clue) and the castle tried.
  const story = new Story([...upTo('castle'), 'clue-r4']);
  const before = story.saved;
  const fall = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.deepEqual(beats(fall), ['fall', 'travel', 'wake', 'dialogue', 'rise']);
  assert.deepEqual(fall[1], { kind: 'travel', environment: PLACES.wakeUp.environment, cell: PLACES.wakeUp.cell });
  // The morning after also carries Aitor's word about the friends on the beach (docs/quests/universidad.md).
  assert.deepEqual(story.saved, STORY_FLAGS.filter(f => before.includes(f) || f === 'palace-tried' || f === 'clue-uni'), 'nothing is lost, the try is remembered');
  const again = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.notEqual(again[3].dialogue, fall[3].dialogue, 'Aitor reacts differently the next time');
  // Chapter 1's fights are simply tried again.
  assert.deepEqual(new Story(upTo('first-fight')).handle({ type: 'battle', won: false }), []);
});

test('ánimas strengthen the party and thin out the palace guards', () => {
  const none = new Story(upTo('palace-tried'));
  const one = new Story([...upTo('palace-tried'), 'anima-nuria']);
  assert.deepEqual(none.animas, []);
  assert.deepEqual(one.animas, ['nuria']);
  assert.equal(none.battleParty(true)[0].bonus, undefined);
  assert.deepEqual(one.battleParty(true).map(m => m.bonus), [{ magia: 1, espiritu: 1, pv: 10 }, { magia: 1, espiritu: 1, pv: 10 }]);
  assert.equal(none.guarded.length, 3);
  assert.equal(one.guarded.length, 3, 'one ánima weakens them; it takes two to send one away');
  assert.ok(one.castleThreat < none.castleThreat, 'but the castle already feels it');
  for (const cell of none.guarded) assert.ok(canWalk(cell, ENVIRONMENTS.palacio.grid), 'guards stand on the hall floor');
  assert.ok(canWalk({ x: 16, z: 10 }, ENVIRONMENTS.palacio.grid));
  assert.deepEqual(new Story(upTo('wrapper-room')).guarded, [], 'no guards in the dream');
});

test('days: things take hours, the evening is noticed, and night falls without ending the day', () => {
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
  assert.equal(story.night, false);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-balcony' })), ['dialogue', 'dialogue'], 'at 21:00 Aitor says night has fallen');
  assert.equal(story.night, true);
  story.handle({ type: 'interact', id: 'meridiana-balcony' });
  assert.deepEqual(story.clock, { day: 1, hour: 22 }, 'the clock stops at 22:00: the day only ends at home');
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-balcony' })), ['dialogue']);
  assert.deepEqual(story.clock, { day: 1, hour: 22 });
});

test('night: through the portal from the street the day is over; by day it is just home', () => {
  const day = new Story(upTo('tv-news'));
  assert.deepEqual(day.handle({ type: 'home' }), [], 'by day, coming home is nothing');
  const story = new Story(upTo('tv-news'));
  story.days.clock.hour = 21;
  assert.deepEqual(beats(story.handle({ type: 'home' })), ['dialogue', 'fall', 'travel', 'wake', 'dialogue', 'rise']);
  assert.deepEqual(story.clock, { day: 2, hour: 8 });
  assert.equal(story.night, false);
});

test('night: a guard in the street catches them; beaten, they wake late; winning lets the hunt go on', () => {
  const story = new Story(upTo('tv-news'));
  assert.deepEqual(story.handle({ type: 'near', id: 'night-1' }), [], 'no guards by day');
  story.days.clock.hour = 21;
  const caught = story.handle({ type: 'near', id: 'night-1' });
  assert.deepEqual(beats(caught), ['dialogue', 'battle:night-guard']);
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'night-guard' }), []);
  assert.equal(story.clock.day, 1);
  assert.deepEqual(beats(story.handle({ type: 'battle', won: false, encounter: 'night-guard' })), ['fall', 'travel', 'wake', 'dialogue', 'rise']);
  assert.deepEqual(story.clock, { day: 2, hour: 11 }, 'they sleep the morning away');
});

test('night falls after a milestone in her palace: the guards beaten', () => {
  const story = new Story([...upTo('castle'), 'anima-nuria']);
  assert.equal(story.night, false);
  const won = story.handle({ type: 'battle', won: true, encounter: 'palace-guards' });
  assert.equal(story.night, true);
  assert.equal(won.at(-1).dialogue, LINES_2.night, 'Aitor says so');
  const later = new Story([...upTo('castle'), 'anima-nuria']);
  later.days.clock.hour = 21;
  assert.ok(!later.handle({ type: 'battle', won: true, encounter: 'palace-guards' }).some(e => e.dialogue === LINES_2.night), 'not twice');
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
test('ánimas grow with the EXP of fights won, every ánima in the fight earns it whole, and each level says what it teaches', async () => {
  const { Story } = await import('../src/story.ts');
  const { LEVEL_XP } = await import('../src/levels.ts');
  const story = new Story(['matemagico', 'papagato']);
  const first = story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['papagato', 'matemagico'], xp: LEVEL_XP[0] - 1 });
  assert.equal(first.some(e => e.kind === 'learn'), false);
  assert.deepEqual(story.xp, { papagato: LEVEL_XP[0] - 1, matemagico: LEVEL_XP[0] - 1 }, 'not split between them');
  const learned = story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['papagato'], xp: 1 });
  assert.equal(story.levels.papagato, 2); assert.ok(story.has('papagato-2'));
  assert.deepEqual(learned.find(e => e.kind === 'learn'), { kind: 'learn', classId: 'papagato', level: 2, skills: ['zarpazos', 'ronroneo'], quiet: true }, 'the victory screen showed it');
  assert.equal(story.levels.matemagico, 1, 'it did not take part');
  story.handle({ type: 'battle', won: false, encounter: 'dogs', worn: ['papagato'], xp: 500 });
  assert.equal(story.xp.papagato, LEVEL_XP[0], 'a lost fight teaches nothing');
  // A big win can go up two levels at once, each with its note.
  const both = story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['matemagico'], xp: 500 });
  assert.deepEqual(both.filter(e => e.kind === 'learn').map(e => [e.level, e.skills]), [[2, ['analisis', 'angulo']], [3, ['cardioide']]]);
  assert.equal(story.levels.matemagico, 3);
});

test('a level the story grants starts the EXP from its floor; development EXP plays out like a fight', async () => {
  const { Story } = await import('../src/story.ts');
  const { LEVEL_XP } = await import('../src/levels.ts');
  const story = new Story(['matemagico', 'papagato', 'papagato-2']);
  story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['papagato'], xp: 10 });
  assert.equal(story.xp.papagato, LEVEL_XP[0] + 10);
  story.debugAnimas = { papagato: 1 };
  const notes = story.giveXp('papagato', LEVEL_XP[1]);
  assert.equal(story.debugAnimas, undefined, 'back to the story\'s ánimas');
  assert.equal(story.levels.papagato, 3);
  assert.equal(notes.filter(e => e.kind === 'learn' && !e.quiet).length, 1, 'with its note');
});

test('the jar at home opens its screen; the ecos go into the ánimas and come back whenever', async () => {
  const { spread, GRACE_DAYS } = await import('../src/days.ts');
  assert.equal(spread(5, 1), (5 - 1 - 3) / GRACE_DAYS);
  assert.equal(spread(2, 3), 0, 'never below the first morning');

  assert.deepEqual(new Story(upTo('castle')).interactions('meridiana').filter(i => i.id === 'meridiana-luces'), [], 'no jar before any light');
  const story = new Story([...upTo('castle'), 'anima-nuria', 'luz-nuria', 'luz-uri']);
  const jar = () => story.interactions('meridiana').find(i => i.id === 'meridiana-luces');
  assert.ok(canWalk(jar().cell, ENVIRONMENTS.meridiana.grid));
  assert.equal(jar().label, 'Abrir el bote');
  assert.deepEqual(story.jar, ['nuria', 'uri']);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'meridiana-luces' })), ['jar']);

  assert.equal(story.ecos, 2); assert.equal(story.ecosFree, 2);
  assert.equal(story.improve('matemagico:agua'), true);
  assert.equal(story.improve('matemagico:agua'), false, 'once');
  assert.equal(story.ecosFree, 1);
  assert.deepEqual(story.improved.elements.matemagico, ['agua']);
  assert.equal(story.improve('papagato:mana-1'), false, 'not enough ecos');
  assert.equal(story.improve('matemagico:pasiva'), false, 'asleep');
  assert.equal(story.unimprove('matemagico:agua'), true);
  assert.equal(story.ecosFree, 2, 'it comes back');
  assert.equal(story.improve('papagato:mana-1'), true);
  assert.equal(story.manaOf('papagato'), 4);
  assert.equal(story.manaOf('matemagico'), 3);
  story.clearImprovements();
  assert.equal(story.ecosFree, 2);

  // Saved, and only what stands: unknown, asleep or out of budget does not count.
  story.improvements = ['nada', 'matemagico:pasiva', 'matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'];
  assert.deepEqual(story.improvements, ['matemagico:fuego', 'matemagico:agua']);

  // A save with a light let out has it back: lights are never spent now.
  assert.deepEqual(new Story([...upTo('castle'), 'luz-nuria', 'luz-nuria-usada']).jar, ['nuria']);
  // A save from when Nil gave a light of his own keeps two: his counts as Uri's.
  assert.deepEqual(new Story([...upTo('castle'), 'luz-nuria', 'luz-nil']).jar, ['nuria', 'uri']);
  // Its saved mornings too, so the server (which only takes known flags) still saves them.
  const old = new Story(upTo('castle'));
  old.loadDays({ epoch: 0, clock: { day: 3, hour: 9 }, mornings: [{ day: 3, story: ['intro', 'luz-nuria', 'luz-nil'] }] });
  assert.deepEqual(old.days.mornings[0].story, ['intro', 'luz-nuria', 'luz-uri']);
});

test('a dual attack is found when it goes off: each ánima lists only those it brings a half of, nothing before', () => {
  const story = new Story();
  assert.deepEqual(story.dualsWith('papagato'), []);
  assert.equal(story.discover('punto-debil'), true);
  assert.equal(story.discover('punto-debil'), false, 'found once');
  assert.deepEqual(story.dualsWith('matemagico').map(d => d.id), ['punto-debil']);
  assert.deepEqual(story.dualsWith('papagato').map(d => d.id), ['punto-debil']);
  assert.deepEqual(story.dualsWith('tecnopata'), [], 'none of its own');
  story.discover('zarpazos-de-fuego');
  assert.deepEqual(story.dualsWith('papagato').map(d => d.id), ['punto-debil', 'zarpazos-de-fuego'], 'in the order found');
  // What the browser kept: unknown or repeated ids are dropped.
  story.duals = ['zarpazos-de-fuego', 'no-such-dual', 'zarpazos-de-fuego'];
  assert.deepEqual(story.duals, ['zarpazos-de-fuego']);
  story.duals = 'not a list';
  assert.deepEqual(story.duals, []);
});
