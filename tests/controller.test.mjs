import assert from 'node:assert/strict';
import test from 'node:test';
import { ControllerEdges, defaultProfile, idleController, readController, validProfile } from '../src/controller.ts';
const pad = (id = 'Xbox', mapping = 'standard') => ({ id, mapping, index: 0, connected: true, axes: [0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })) });
test('Nintendo A confirms, B cancels, and plus opens the menu on both generations', () => {
  for (const id of ['Nintendo Switch Pro Controller', 'Nintendo Switch 2 Pro Controller', 'Joy-Con (R)', '057e-2009']) {
    const p = pad(id); p.buttons[1].pressed = true;
    assert.equal(readController(p).confirm, true); assert.equal(readController(p).cancel, false);
    p.buttons[1].pressed = false; p.buttons[0].pressed = true; p.buttons[9].pressed = true;
    assert.equal(readController(p).cancel, true); assert.equal(readController(p).menu, true);
  }
});
test('standard controls preserve sticks, dead zone, D-pad and generic face positions', () => {
  const p = pad(); p.axes = [.29, -.29]; assert.equal(readController(p).direction, null);
  p.axes = [.8, -.5]; assert.equal(readController(p).direction, 'right');
  p.buttons[12].pressed = true; assert.equal(readController(p).direction, 'up');
  p.buttons[0].pressed = true; assert.equal(readController(p).confirm, true);
});
test('unknown mappings are inert until configured; custom axes and buttons work', () => {
  const p = pad('Unrecognized Switch 2', ''); p.axes = [1, 0]; p.buttons[0].pressed = true;
  assert.deepEqual(readController(p), idleController());
  const profile = { ...defaultProfile(pad()), right: { axis: 0, sign: 1 }, confirm: { button: 0 } };
  assert.equal(validProfile(profile), true); assert.equal(readController(p, profile).direction, 'right');
  assert.equal(readController(p, profile).confirm, true);
  p.connected = false; assert.deepEqual(readController(p, profile), idleController());
});
test('stored mappings reject partial, negative, fractional and invalid axis bindings', () => {
  for (const value of [null, {}, { ...defaultProfile(pad()), confirm: { button: -1 } }, { ...defaultProfile(pad()), up: { axis: 0, sign: 0 } }, { ...defaultProfile(pad()), menu: { button: 1.5 } }]) assert.equal(validProfile(value), false);
});
test('holding confirm never leaks across screens, reconnects, or focus changes', () => {
  const edge = new ControllerEdges(), held = { ...idleController(), confirm: true };
  assert.deepEqual(edge.update(held, 'world', 0).events, []);
  edge.update(idleController(), 'world', 1);
  assert.deepEqual(edge.update(held, 'world', 2).events, ['confirm']);
  assert.deepEqual(edge.update(held, 'dialogue', 3).events, []);
  assert.deepEqual(edge.update(held, 'dialogue', 4).events, []);
  edge.update(idleController(), 'dialogue', 5);
  assert.deepEqual(edge.update(held, 'dialogue', 6).events, ['confirm']);
  edge.update(held, 'dialogue', 7, false);
  assert.deepEqual(edge.update(held, 'dialogue', 8).events, []);
  assert.deepEqual(edge.update(held, 'another-pad:dialogue', 9).events, []);
});
test('menu directions repeat after a delay, while actions only fire on press', () => {
  const edge = new ControllerEdges(); edge.update(idleController(), 'menu', 0);
  const state = { ...idleController(), direction: 'down', confirm: true };
  assert.deepEqual(edge.update(state, 'menu', 1).events, ['confirm', 'down']);
  assert.deepEqual(edge.update(state, 'menu', 300).events, []);
  assert.deepEqual(edge.update(state, 'menu', 351).events, ['down']);
  assert.deepEqual(edge.update(state, 'menu', 400).events, []);
  assert.deepEqual(edge.update(state, 'menu', 481).events, ['down']);
});

test('remapped sticks use the strongest axis and preserve stable circular steering', () => {
  const p = pad('Unknown', '');
  const profile = { ...defaultProfile(pad()), up: { axis: 1, sign: -1 }, down: { axis: 1, sign: 1 }, left: { axis: 0, sign: -1 }, right: { axis: 0, sign: 1 } };
  p.axes = [.9, -.6];
  assert.equal(readController(p, profile).direction, 'right');
  p.axes = [.7, -.71];
  assert.equal(readController(p, profile, 'right').direction, 'right');
  p.axes = [.5, -.9];
  assert.equal(readController(p, profile, 'right').direction, 'up');
  p.axes = [0, 0];
  assert.equal(readController(p, profile, 'up').direction, null);
});
test('the stick vector reaches the world only when the stick drives movement', () => {
  const p = pad(); p.axes = [0, -.9];
  assert.deepEqual(readController(p).stick, { x: 0, y: -.9 });
  p.buttons[14].pressed = true; assert.equal(readController(p).stick, null);
  p.buttons[14].pressed = false; p.axes = [.1, .1]; assert.equal(readController(p).stick, null);
});

test('hold B to run on Xbox and Nintendo, releasing or losing focus stops running', () => {
  for (const [id, button] of [['Xbox', 1], ['Nintendo Switch 2 Pro Controller', 0]]) {
    const p = pad(id), edge = new ControllerEdges();
    edge.update(readController(p), 'world', 0);
    p.axes = [1, 0]; p.buttons[button].pressed = true;
    assert.equal(edge.update(readController(p), 'world', 1).running, true);
    assert.equal(edge.update(readController(p), 'world', 2).running, true);
    p.buttons[button].pressed = false;
    assert.equal(edge.update(readController(p), 'world', 3).running, false);
    p.buttons[button].pressed = true;
    assert.equal(edge.update(readController(p), 'world', 4, false).running, false);
    assert.equal(edge.update(readController(p), 'world', 5).running, false);
    p.axes = [0, 0]; p.buttons[button].pressed = false;
    edge.update(readController(p), 'world', 6);
    p.buttons[button].pressed = true;
    assert.equal(edge.update(readController(p), 'world', 7).running, true);
    p.connected = false;
    assert.equal(edge.update(readController(p), 'disconnected', 8).running, false);
  }
});
