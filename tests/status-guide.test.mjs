import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, TIMED } from '../src/battle.ts';
import { GUIDES, GUIDE_GROUPS, GUIDE_IDS, guideState, guideVersion, guidesFound } from '../src/status-guide.ts';
import { STATUS_ICONS } from '../src/status-icons.ts';

test('every status a fighter can carry, by rounds or on the clock, has a card in the combat guide', () => {
  for (const id of [...Object.keys(STATUSES), ...Object.keys(TIMED)]) assert.ok(GUIDE_IDS.includes(id), `${id} has no card`);
});

test('a boss\'s own rule shown as a status has no card: that fight is read on its plate and found by trying', () => {
  for (const id of ['encarnado', 'luz', 'enfado', 'cancion', 'converge', 'reaccion']) {
    assert.ok(id in STATUS_ICONS, `${id} is still a plate icon`);
    assert.ok(!GUIDE_IDS.includes(id), `${id} must not have a card`);
  }
});

test('each card says what it does in plain, finished Spanish, with its numbers filled in', () => {
  for (const id of GUIDE_IDS) {
    const card = GUIDES[id];
    assert.ok(card.name && card.text, id);
    assert.ok(card.group in GUIDE_GROUPS, `${id}: its group`);
    assert.match(card.colour, /^#[0-9a-f]{6}$/i, `${id}: its colour`);
    assert.match(card.text, /[.!]$/, `${id}: a finished sentence`);
    assert.doesNotMatch(card.text, /undefined|NaN|\[object/, `${id}: a number missing`);
  }
});

test('a card\'s version follows its words and its numbers, and a changed card counts as unread', () => {
  for (const id of GUIDE_IDS) assert.equal(guideVersion(id), guideVersion(id), 'the same card, the same version');
  assert.equal(new Set(GUIDE_IDS.map(guideVersion)).size, GUIDE_IDS.length, 'no two cards share a version');
  const quemado = guideVersion('quemado');
  assert.equal(guideState({}, 'quemado'), 'new');
  assert.equal(guideState({ quemado }, 'quemado'), 'seen');
  assert.equal(guideState({ quemado: 'una-version-vieja' }, 'quemado'), 'changed');
  // The numbers are part of the card: a fire that lasted longer would show its card again.
  const seconds = TIMED.quemado.seconds;
  try { TIMED.quemado.seconds = seconds + 5; assert.notEqual(guideVersion('quemado'), quemado); }
  finally { TIMED.quemado.seconds = seconds; }
  assert.equal(guideVersion('quemado'), quemado);
});

test('«Cómo jugar» lists the cards read, in the guide\'s order, whatever version they were read at', () => {
  assert.deepEqual(guidesFound({}), []);
  assert.deepEqual(guidesFound({ confusion: 'x', sangrado: guideVersion('sangrado'), 'no-existe': 'y' }), ['sangrado', 'confusion']);
});
