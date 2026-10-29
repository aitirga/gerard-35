import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_FLAGS } from '../src/story.ts';
import { STORY_ARCS, flagsAt, missionsDone, spotAt } from '../src/story-points.ts';

test('every story flag is set in exactly one step', () => {
  const placed = STORY_ARCS.flatMap(a => a.steps.flatMap(s => s.flags));
  assert.deepEqual([...placed].sort(), [...STORY_FLAGS].sort());
});

test('chapter 1 runs in one line, arc after arc', () => {
  assert.deepEqual(flagsAt('wrapper-room'), STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('wrapper-room') + 1));
  assert.deepEqual(flagsAt('bernat-joined').at(-2), 'got-backpack');
});

test('each ánima mission stands on its own', () => {
  const uri = flagsAt('anima-uri');
  assert.ok(uri.includes('anima-uri') && uri.includes('metro'));
  assert.ok(!uri.includes('anima-nuria'), 'Uri does not need Nuria');
  assert.ok(!uri.includes('castle'), 'nor the castle');
  assert.ok(flagsAt('anima-uri', ['nuria']).includes('anima-nuria'), 'unless asked for');
});

test('other missions join only once the jump reaches where they start', () => {
  assert.ok(!flagsAt('got-wrapper', ['nuria']).includes('anima-nuria'));
  assert.ok(!flagsAt('got-wrapper', ['nuria']).includes('metro'));
  assert.ok(flagsAt('castle', ['nuria', 'uri']).includes('anima-uri'));
  assert.deepEqual(missionsDone(flagsAt('castle', ['uri'])), ['uri']);
});

test('the news carry the R4 clue, and the city steps stand where they happen', () => {
  assert.ok(flagsAt('tv-news').includes('clue-r4'));
  assert.equal(spotAt('rec-comtal')?.environment, 'rec-comtal');
  assert.equal(spotAt('caught'), undefined);
});
