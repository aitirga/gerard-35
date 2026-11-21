import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { ITEMS, TROPHIES, trophyBonus } from '../src/items.ts';
import { createEncounter } from '../src/battle.ts';
import { flagsAt } from '../src/story-points.ts';

test('every trophy is an item of its own kind, says what it adds, and hangs from a real flag', () => {
  for (const { item, flag } of TROPHIES) {
    assert.equal(ITEMS[item].kind, 'trophy', item);
    assert.ok(STORY_FLAGS.includes(flag), `${item}: ${flag}`);
    assert.ok(Object.keys(ITEMS[item].stats ?? {}).length, `${item} adds something`);
    assert.match(ITEMS[item].effect ?? '', /^Sube .+ de todo el equipo en cada combate\.$/, item);
  }
});

test('finishing a mission gives its trophy, with a note, and its stats go into every fight', () => {
  const story = new Story(flagsAt('cuerdas'));
  assert.ok(!story.items.includes('trofeo-marta'));
  const effects = story.handle({ type: 'battle', won: true, encounter: 'voz' });
  assert.deepEqual(effects.filter(e => e.kind === 'item').map(e => e.item), ['trofeo-marta']);
  assert.ok(story.items.includes('trofeo-marta'));
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'voz' }).filter(e => e.kind === 'item'), [], 'once');

  const won = story.battleParty(true), bare = won.map(({ trophies, ...slot }) => slot);
  assert.deepEqual(won[0].trophies, { espiritu: 1 });
  const before = createEncounter(bare, 'dogs').allies[0], after = createEncounter(won, 'dogs').allies[0];
  assert.equal(after.stats.espiritu, before.stats.espiritu + 1);
});

test('the castle bosses give theirs too, and they add up', () => {
  const story = new Story([...flagsAt('castle'), 'aurelia', 'direccion']);
  assert.ok(story.items.includes('trofeo-aurelia') && story.items.includes('trofeo-direccion'));
  assert.deepEqual(trophyBonus(['trofeo-aurelia', 'trofeo-direccion', 'trofeo-luca']), { defensa: 2, fuerza: 2, magia: 1 });
});
