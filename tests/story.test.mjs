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
  assert.deepEqual(story.saved, [...STORY_FLAGS]);
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
