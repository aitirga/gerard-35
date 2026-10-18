import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { currentThought, diary, storyClock } from '../src/journal.ts';
import { LINES } from '../src/chapter-1.ts';

const upTo = flag => new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf(flag) + 1));

test('the clock moves with the story, and at 35 it is always the same birthday', () => {
  assert.deepEqual(storyClock(new Story()), { time: '07:30', day: 'DÍA DE COLE' });
  assert.equal(storyClock(upTo('got-backpack')).time, '07:48');
  assert.deepEqual(storyClock(upTo('caught')), { time: '08:00', day: 'JUE · 15 OCT' });
  assert.equal(storyClock(upTo('got-wrapper')).time, '08:06');
  // Never backwards within a chapter.
  let last = 0;
  for (const flag of STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('wrapper-room') + 1)) {
    const [h, m] = storyClock(upTo(flag)).time.split(':').map(Number);
    assert.ok(h * 60 + m >= last, flag); last = h * 60 + m;
  }
});

test('every story state has a mission and a thought, for Gerard and for Aitor', () => {
  for (const flag of [undefined, ...STORY_FLAGS]) {
    const story = flag ? upTo(flag) : new Story();
    for (const member of ['gerard', 'aitor']) {
      const { mission, thought } = currentThought(story, member);
      assert.ok(mission.length > 3 && thought.length > 3, `${flag} ${member}`);
    }
  }
});

test('the thought is never an instruction: no dialogue line is copied and no key is named', () => {
  const lines = new Set(Object.values(LINES).flatMap(d => d.lines.map(l => l.text)));
  for (const flag of [undefined, ...STORY_FLAGS]) {
    const { mission, thought } = currentThought(flag ? upTo(flag) : new Story());
    assert.ok(!lines.has(thought), flag);
    assert.doesNotMatch(`${mission} ${thought}`, /\b(pulsa|ve a|habla con|busca|coge)\b/i, flag);
  }
});

test('the diary remembers what happened, current chapter first, and Aitor only from chapter 2', () => {
  assert.deepEqual(diary(new Story()).map(c => c.entries.length), [0]);
  const backpack = diary(upTo('got-backpack'));
  assert.equal(backpack.length, 1);
  assert.equal(backpack[0].entries.length, 4);
  const adult = diary(upTo('got-wrapper'));
  assert.deepEqual(adult.map(c => c.title), ['El día que se repite', 'Una mañana de otoño']);
  assert.equal(adult[0].entries.length, 2);
  assert.match(adult[1].entries.at(-1), /gelatina/);
  const aitor = diary(upTo('got-wrapper'), 'aitor');
  assert.equal(aitor.length, 1);
  assert.equal(aitor[0].entries.length, 2);
});
