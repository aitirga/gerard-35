import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { ITEMS, TROPHIES } from '../src/items.ts';
import { flagsAt } from '../src/story-points.ts';

test('every trophy is an item of its own kind, writes down what it gave, and hangs from a real flag', () => {
  for (const { item, flag } of TROPHIES) {
    assert.equal(ITEMS[item].kind, 'trophy', item);
    assert.ok(STORY_FLAGS.includes(flag), `${item}: ${flag}`);
    assert.ok(ITEMS[item].effect, `${item} says what it gave`);
  }
  assert.match(ITEMS['trofeo-marta'].effect, /^Sube PV, Fuerza, Magia, Defensa y Espíritu de todo el equipo un \d+ %\.$/);
});

test('finishing a mission gives its trophy once, with a note, and nothing more to the party than its ánima', () => {
  const story = new Story(flagsAt('cuerdas'));
  assert.ok(!story.items.includes('trofeo-marta'));
  const effects = story.handle({ type: 'battle', won: true, encounter: 'voz' });
  assert.deepEqual(effects.filter(e => e.kind === 'item').map(e => e.item), ['trofeo-marta']);
  assert.ok(story.items.includes('trofeo-marta'));
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'voz' }).filter(e => e.kind === 'item'), [], 'once');
  assert.ok(story.battleParty(true).every(slot => !('trophies' in slot)));
});

test('the castle bosses give theirs too', () => {
  const story = new Story([...flagsAt('castle'), 'aurelia', 'direccion']);
  assert.ok(story.items.includes('trofeo-aurelia') && story.items.includes('trofeo-direccion'));
});
