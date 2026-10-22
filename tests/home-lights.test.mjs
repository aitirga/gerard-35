import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_LIGHTS, LAMP_PRESETS, OFF, battleLook, heartbeat, hex, hitFlash, impactSeconds, lampInteraction, lampRgb, mix, nextLamp, placeLook, sameLamp, tension } from '../src/home-lights.ts';
import { CONTACT_SECONDS } from '../src/battle-motion.ts';
import { createBattle, createGuardBattle, palaceGuards } from '../src/battle.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

const calm = { tone: 0, dusk: 0 };

test('every bulb at home is a lamp Gerard can press in the Meridiana flat', () => {
  const lamps = ENVIRONMENTS.meridiana.interactions.filter(i => lampInteraction(i.id));
  assert.deepEqual(lamps.map(i => lampInteraction(i.id)).sort(), HOUSE_LIGHTS.map(l => l.id).sort());
  for (const lamp of lamps) assert.ok(canWalk(lamp.cell, ENVIRONMENTS.meridiana.grid), lamp.id);
  assert.equal(lampInteraction('meridiana-tv'), undefined);
});

test('each place lights the living room, or the whole house when asked; the flat mirrors instead', () => {
  for (const id of Object.keys(ENVIRONMENTS)) {
    if (id === 'meridiana') { assert.equal(placeLook(id, calm, 'casa'), undefined); continue; }
    assert.deepEqual(Object.keys(placeLook(id, calm, 'salon')).sort(), ['cocina', 'luna', 'mesa', 'sofa']);
    assert.equal(Object.keys(placeLook(id, calm, 'casa')).length, HOUSE_LIGHTS.length);
  }
});

test('the Queen\'s palace is pink without flooding the room', () => {
  for (const lamp of Object.values(placeLook('palacio', { tone: 1, dusk: 1 }, 'casa', 'intensa'))) {
    assert.ok(lamp.saturation <= .7, `saturation ${lamp.saturation}`);
    assert.ok(lamp.brightness <= .7, `brightness ${lamp.brightness}`);
  }
});

test('her tone and the evening tint and dim a place', () => {
  const day = placeLook('meridiana-calle', calm, 'salon'), pink = placeLook('meridiana-calle', { tone: 1, dusk: 0 }, 'salon'), late = placeLook('meridiana-calle', { tone: 0, dusk: 1 }, 'salon');
  assert.ok(!sameLamp(day.mesa, pink.mesa));
  assert.ok(late.cocina.brightness < day.cocina.brightness);
  assert.ok(late.mesa.kelvin < day.mesa.kelvin);
});

test('colours convert both ways close enough', () => {
  const red = hex('#ff0000', 1);
  assert.deepEqual([red.hue, red.saturation], [0, 1]);
  assert.deepEqual(lampRgb(red).map(v => Math.round(v * 100) / 100), [1, 0, 0]);
  assert.equal(hex('#00ff00', 1, .5).saturation, .5);
  assert.equal(mix(hex('#ff0000', 1), hex('#0000ff', 1), .5).hue, 300, 'the short way round');
  assert.ok(sameLamp(OFF, { ...OFF, brightness: .5 }));
});

test('a lamp turns on warm, goes through the colours and then off', () => {
  let lamp = OFF;
  const verbs = [];
  for (let i = 0; i <= LAMP_PRESETS.length; i++) { const next = nextLamp(lamp); verbs.push(next.verb); lamp = next.lamp; }
  assert.equal(verbs[0], 'Encender');
  assert.equal(verbs.at(-1), 'Apagar');
  assert.equal(lamp.on, false);
  assert.equal(nextLamp(hex('#123456', .3)).lamp, LAMP_PRESETS[0].lamp, 'a colour set at home starts the cycle again');
});

test('the room turns red and a heartbeat starts as the party runs out of health', () => {
  const state = createBattle(1, 2);
  const healthy = battleLook(state, 'salon');
  assert.equal(tension(state), 0);
  assert.equal(heartbeat(state), undefined);
  state.allies[0].hp = Math.round(state.allies[0].maxHp * .2);
  const hurt = battleLook(state, 'salon');
  assert.ok(Math.abs(((hurt.mesa.hue - 4 + 540) % 360) - 180) < Math.abs(((healthy.mesa.hue - 4 + 540) % 360) - 180), 'closer to red');
  assert.ok(hurt.sofa.brightness < healthy.sofa.brightness);
  assert.deepEqual(heartbeat(state).lights, ['mesa']);
  state.allies[0].hp = 3;
  assert.ok(heartbeat(state).period < 1);
});

test('hits flash in front of the player, timed to the contact', () => {
  const state = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard-adult' }], palaceGuards(0));
  const foe = state.foes[0].id;
  const attack = { kind: 'attack', actor: 'gerard', target: foe, amount: 10 };
  assert.equal(impactSeconds(attack), CONTACT_SECONDS);
  assert.ok(!hitFlash(attack, state).lights.includes('mesa'), 'the heartbeat lamp is left alone');
  const bite = hitFlash({ kind: 'enemy', actor: foe, target: 'gerard', amount: 10 }, state);
  assert.equal(bite.color.hue, hex('#ff2a1a', 1).hue, 'red when the party is hit');
  const no = { kind: 'skill', actor: 'gerard', target: foe, amount: 40, skill: 'nota' };
  assert.equal(hitFlash(no, state).kind, 'pulse');
  assert.equal(hitFlash(no, state, 'suave').kind, 'breathe', 'no strobe when the lights are soft');
  assert.equal(impactSeconds({ kind: 'skill', actor: 'gerard', target: 'gerard', skill: 'encourage' }), .2);
});
