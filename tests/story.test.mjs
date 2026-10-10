import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { PLACES, LEASH } from '../src/chapter-1.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

const kinds = effects => effects.map(e => e.kind === 'dialogue' ? 'dialogue' : `${e.kind}:${e.id ?? e.item}`);

test('block 1 plays from waking up to the déjà-vu in order', () => {
  const story = new Story();
  assert.equal(story.started, false);
  assert.deepEqual(kinds(story.handle({ type: 'start' })), ['card:intro', 'dialogue', 'hint:move']);
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

  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'talk-bernat' })), ['dialogue', 'card:end']);
  assert.equal(story.companion, 'follow');
  assert.equal(story.bubble, undefined);
  assert.equal(story.battles, true);
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
  assert.equal(canWalk(PLACES.scarecrow, ENVIRONMENTS.maresme.grid), false, 'the scarecrow blocks its cell');
});

test('the server accepts exactly the story flags', () => {
  const server = readFileSync(new URL('../server.py', import.meta.url), 'utf8');
  const listed = server.match(/STORY_FLAGS = \(([^)]*)\)/)[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
  assert.deepEqual(listed, [...STORY_FLAGS]);
});
