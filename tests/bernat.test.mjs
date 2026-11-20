import assert from 'node:assert/strict';
import test from 'node:test';
import { ANSWER_LAMP, LAMPS, PORTAL_LEVELS, RGB, SHEET_ICONS, colourOf, lampColour, mix } from '../src/friends/bernat.ts';
import { HOUSE_LIGHTS } from '../src/home-lights.ts';
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';

test('each sum of lights on the notebook makes its answer, and the four go sum, subtraction, both, then white', () => {
  assert.equal(PORTAL_LEVELS.length, 4);
  for (const level of PORTAL_LEVELS) assert.equal(colourOf(mix(level.terms)), level.answer, level.kind);
  assert.ok(PORTAL_LEVELS[0].terms.every(t => t.sign > 0) && PORTAL_LEVELS[1].terms.some(t => t.sign < 0));
  assert.equal(PORTAL_LEVELS[3].answer, 'blanco');
  assert.deepEqual(PORTAL_LEVELS[3].terms.map(t => t.colour).sort(), ['azul', 'rojo', 'verde']);
  // The answer goes on the moon, never one of the sum's own lamps; every lamp is one of the flat's.
  for (const level of PORTAL_LEVELS) assert.ok(level.terms.every(t => t.lamp !== ANSWER_LAMP && HOUSE_LIGHTS.some(l => l.id === t.lamp)));
});

test('the moon is read as the colour it shows: each colour lamp as itself, off as nothing, any white as white', () => {
  for (const colour of Object.keys(RGB)) assert.equal(lampColour(LAMPS[colour]), colour, colour);
  assert.equal(lampColour({ ...LAMPS.cian, on: false }), undefined);
  assert.equal(lampColour({ on: true, hue: 0, saturation: 0, brightness: .7, kelvin: 2700 }), 'blanco');
});

test('Bernat the first time is the confidant at El Nucli, with his table and nothing to solve yet', () => {
  const story = new Story([...flagsAt('metro'), 'ticket-placa-de-sants']);
  assert.ok(story.npcs('el-nucli').some(n => n.id === 'bernat'));
  assert.ok(story.interactions('el-nucli').some(i => i.id === 'talk-bernat35'));
  assert.ok(!story.interactions('el-nucli').some(i => i.id === 'nucli-mesa'), 'his box is shut');
  const first = story.handle({ type: 'interact', id: 'talk-bernat35' });
  assert.ok(story.has('bernat-nucli'));
  assert.match(JSON.stringify(first), /Nuria Mendoza/);
  assert.match(JSON.stringify(first), /música/, 'he says she stopped for music');
  assert.deepEqual(story.handle({ type: 'portal' }), [], 'no portal before his call');
});

test('the moon is read as the house sets it: the game\'s own colours, and whatever Siri or the LIFX app make of a colour\'s name', () => {
  for (const colour of Object.keys(LAMPS)) assert.equal(lampColour(LAMPS[colour]), colour, colour);
  // Siri asked for each answer by name (HomeKit's hue and saturation for it), at any brightness.
  const asked = { cian: 180, amarillo: 60, magenta: 300 };
  for (const [colour, hue] of Object.entries(asked)) assert.equal(lampColour({ on: true, hue, saturation: 1, brightness: .5, kelvin: 3500 }), colour, colour);
  assert.equal(lampColour({ on: true, hue: 0, saturation: 0, brightness: 1, kelvin: 4000 }), 'blanco', 'any white is white');
  assert.equal(lampColour({ ...LAMPS.cian, on: false }), undefined, 'off is no answer');
  for (const level of PORTAL_LEVELS) assert.equal(colourOf(mix(level.terms)), level.answer, level.kind);
});

test('the sheet draws every lamp of the sums, and the moon, as its name: shapes only, no word', () => {
  for (const id of new Set([ANSWER_LAMP, ...PORTAL_LEVELS.flatMap(l => l.terms.map(t => t.lamp))])) {
    assert.ok(SHEET_ICONS[id], `${id} has its drawing`);
    assert.doesNotMatch(SHEET_ICONS[id], /<text/, `${id} is drawn, not written`);
  }
});

test('the model stands on his table from his call on, and leaning over it is the riddle until it is solved', () => {
  const story = new Story([...flagsAt('bernat-juego')]);
  const table = story.interactions('el-nucli').find(i => i.id === 'nucli-mesa');
  assert.match(table?.label ?? '', /maqueta/i);
  assert.deepEqual(story.handle({ type: 'interact', id: 'nucli-mesa' }).map(e => e.kind), ['nucli-box']);
});
