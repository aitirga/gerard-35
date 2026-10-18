import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, glyph, glyphText, inputDevice, onInputDevice, padFamily, setInputDevice } from '../src/input-glyphs.ts';

test('pads are recognised by family; custom mappings and unknown pads are generic', () => {
  assert.equal(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)'), 'xbox');
  assert.equal(padFamily('DualSense Wireless Controller (Vendor: 054c Product: 0ce6)'), 'playstation');
  assert.equal(padFamily('Pro Controller (Vendor: 057e)'), 'nintendo');
  assert.equal(padFamily('USB Gamepad'), 'gamepad');
  assert.equal(padFamily('Xbox Wireless Controller', true), 'gamepad', 'a custom mapping has no fixed labels');
});

test('every action has a key for every device, and templates use the device in use', () => {
  for (const [name, row] of Object.entries(GLYPHS)) for (const device of ['keyboard', 'xbox', 'playstation', 'nintendo', 'gamepad']) assert.ok(row[device], `${name} on ${device}`);
  assert.equal(inputDevice(), 'keyboard');
  assert.equal(glyphText('{confirm} Confirmar · {cancel} Volver'), 'Enter Confirmar · Esc Volver');
  const seen = [];
  const stop = onInputDevice(device => seen.push(device));
  setInputDevice('playstation'); setInputDevice('playstation');
  assert.deepEqual(seen, ['playstation'], 'only real changes are announced');
  assert.equal(glyphText('{confirm} Confirmar · {details} detalles · {unknown}'), '✕ Confirmar · △ detalles · {unknown}');
  assert.equal(glyph('animaPrev', 'nintendo'), 'L'); assert.equal(glyph('party', 'nintendo'), 'X', 'the top face button is X on Nintendo');
  setInputDevice('keyboard'); stop();
});
