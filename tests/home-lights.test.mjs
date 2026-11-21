import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPS, HOUSE_LIGHTS, LAST, answerFound, endingCue, heldLamp, isQueen, turnOf, OFF, SCREEN_MS, SWATCHES, VICTORY, ambience, autoLead, battleLook, bracing, clockOffset, heartbeat, hex, hitFlash, holdFor, impactSeconds, isBoss, lampInteraction, lampRgb, lateness, mix, peakOf, placeLook, registerOf, riseOf, sameLamp, slam, stepSwatch, sweep, switchedOn, tapOffsets, tension, white } from '../src/home-lights.ts';
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

test('the dial steps through whites and colours, keeping the brightness', () => {
  const dim = { ...white(2700, .3) };
  const next = stepSwatch(dim, 1);
  assert.equal(next.index, 2);
  assert.equal(next.lamp.brightness, .3);
  assert.equal(stepSwatch(dim, -2).index, SWATCHES.length - 1, 'round the end');
  assert.equal(stepSwatch(hex('#ff70ad', .5), 0).lamp.hue, SWATCHES.find(s => s.name === 'Rosa').lamp.hue, 'a colour set at home finds its swatch');
  assert.equal(switchedOn(OFF).kelvin, 2700, 'warm when it never had a colour');
  assert.deepEqual(switchedOn({ ...hex('#4a6cff', .6), on: false }).on, true);
});

test('until the bridge has measured them, a bulb takes tens of milliseconds on the LAN and half a second through the cloud', () => {
  assert.equal(autoLead('lan'), 60);
  assert.equal(autoLead('cloud'), 500);
});

test('places keep to pastels; dungeons drop to a dark with one accent breathing; her palace keeps its pink', () => {
  for (const id of Object.keys(ENVIRONMENTS)) {
    if (id === 'meridiana') continue;
    const look = placeLook(id, calm, 'casa', 'intensa');
    for (const [bulb, lamp] of Object.entries(look)) {
      const cap = registerOf(id) === 'claro' ? CAPS.place : CAPS.accent;
      assert.ok(lamp.saturation <= cap + 1e-9, `${id} ${bulb}: saturation ${lamp.saturation}`);
    }
  }
  const dungeon = placeLook('cuerdas', calm, 'salon');
  assert.equal(registerOf('cuerdas'), 'penumbra');
  assert.ok(dungeon.cocina.brightness < dungeon.luna.brightness, 'the accent stays lit');
  assert.equal(ambience('cuerdas', dungeon).lights[0], 'luna', 'and it breathes');
  assert.ok(ambience('cuerdas', dungeon).period >= 6, 'slower than breathing');
  assert.equal(ambience('maresme', placeLook('maresme', calm, 'salon')), undefined, 'a street does not');
  assert.equal(ambience('palacio', placeLook('palacio', calm, 'salon')).lights[0], 'mesa', 'her fountain still beats');
});

test('a fight is pastel; a boss carries more colour; the alarm stays raw', () => {
  const guards = createBattle(1, 2);
  assert.ok(!isBoss(guards));
  for (const lamp of Object.values(battleLook(guards, 'salon'))) assert.ok(lamp.saturation <= CAPS.fight + 1e-9);
  guards.allies[0].hp = 1;
  assert.ok(battleLook(guards, 'salon').mesa.saturation > CAPS.fight, 'someone about to fall turns the room red');
  const boss = { ...guards, encounter: 'voz', allies: guards.allies.map(a => ({ ...a, hp: a.maxHp })) };
  assert.ok(isBoss(boss));
  assert.ok(Math.max(...Object.values(battleLook(boss, 'salon')).map(l => l.saturation)) > CAPS.fight);
});

test('a blow at everyone announced makes the room hold its breath', () => {
  const state = createBattle(1, 2);
  const calmLook = battleLook(state, 'salon');
  assert.ok(!bracing(state));
  state.foes[0].intent = { ability: 'bombona', at: 'todos' };
  assert.ok(bracing(state));
  assert.ok(battleLook(state, 'salon').sofa.brightness < calmLook.sofa.brightness);
});

test('raw light is kept for the peaks: a boss turning, a part broken, a blow at everyone, the last blow on a boss', () => {
  const state = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard-adult' }], palaceGuards(0));
  const foe = state.foes[0].id;
  assert.equal(peakOf({ kind: 'attack', actor: 'gerard', target: foe, amount: 10 }, state), undefined, 'a plain blow is not one');
  assert.equal(peakOf({ kind: 'attack', actor: 'gerard', target: foe, amount: 10, crit: true }, state), undefined, 'nor a critical one');
  assert.ok(peakOf({ kind: 'enemy', actor: foe, target: 'gerard', stage2: true }, state).saturation > .85, 'a boss turning: full red');
  assert.ok(peakOf({ kind: 'attack', actor: 'gerard', target: foe, eye: 'broken' }, state));
  assert.ok(peakOf({ kind: 'enemy', actor: foe, target: 'gerard', ability: { id: 'bombona', name: 'Bombona', card: true }, hits: [{ target: 'gerard', amount: 5 }, { target: 'aitor', amount: 5 }] }, state));
  assert.ok(peakOf({ kind: 'attack', actor: 'gerard', target: foe }, { ...state, encounter: 'fran', phase: 'won' }), 'the last blow on a boss');
  assert.equal(peakOf({ kind: 'attack', actor: 'gerard', target: foe }, { ...state, phase: 'won' }), undefined, 'not on a guard');
  const cue = slam(hex('#ff3a1a', 1, 1));
  assert.ok(cue.steps[0].at < 0 && Object.values(cue.steps[0].look)[0].brightness < .05, 'it drops to dark just before');
  assert.equal(cue.steps.at(-1).at, 0);
  assert.deepEqual(sweep(white(4000, 1)).steps.map(step => Object.keys(step.look)[0]), ['cocina', 'sofa', 'luna', 'mesa']);
});

test('the answer found lands warmer than a plain blow', () => {
  const state = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard-adult' }], palaceGuards(0));
  const foe = state.foes[0].id;
  const plain = hitFlash({ kind: 'attack', actor: 'gerard', target: foe, amount: 10 }, state);
  const weak = hitFlash({ kind: 'attack', actor: 'gerard', target: foe, amount: 20, affinity: 'weak' }, state);
  assert.ok(weak.period > plain.period && weak.color.saturation > plain.color.saturation);
});

test('victory is bright but never her pink', () => {
  for (const lamp of Object.values(VICTORY)) assert.ok(lamp.saturation <= .6 && !(lamp.hue >= 315 && lamp.hue <= 350), `${lamp.hue}`);
});

test('timing: the hit waits only when the bulbs need longer than its wind-up', () => {
  assert.equal(riseOf({ kind: 'pulse', period: .2 }), 0);
  assert.equal(riseOf({ kind: 'breathe', period: .45, peak: .1 }), 45);
  assert.equal(riseOf({ kind: 'breathe', period: 1.3, peak: .4 }), 120, 'a slow swell is seen before its peak');
  const contact = CONTACT_SECONDS * 1000;
  assert.equal(holdFor(80, 0, 45, contact), 0, 'a measured LAN bulb is told in time');
  assert.ok(holdFor(500, 0, 0, contact) > 0, 'the cloud holds the hit back a little');
  assert.equal(holdFor(500, 0, 0, contact), Math.round(25 + 500 - contact - SCREEN_MS));
  assert.ok(holdFor(80, 200, 45, 200) > holdFor(80, 0, 45, 200), 'bulbs found late are told earlier');
});

test('the bridge\'s clock is read from the quickest round trip', () => {
  const offset = clockOffset([
    { sent: 0, server: 1000 + 40, back: 80 },
    { sent: 100, server: 1000 + 102, back: 104 },
    { sent: 200, server: 1000 + 230, back: 260 },
  ]);
  assert.equal(offset, 1000);
});

test('the tap calibration measures the bulbs against the screen, whatever the hand adds', () => {
  const beats = [0, 700, 1400, 2100, 2800, 3500];
  // The player taps 30 ms early on the screen and 50 ms late on the bulbs: they arrive 80 ms late.
  const screen = tapOffsets(beats, beats.map(b => b - 30));
  const bulbs = tapOffsets(beats, [...beats.map(b => b + 50), 5000]);
  assert.equal(bulbs.length, beats.length, 'a stray tap belongs to no beat');
  assert.equal(lateness(screen, bulbs), 80);
  assert.equal(lateness(screen.slice(0, 2), bulbs), undefined, 'too few taps to trust');
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
  const fire = { kind: 'skill', actor: 'gerard', target: foe, amount: 12, skill: 'foc-binari', burn: { id: 'quemado', level: 1 } };
  assert.equal(hitFlash(fire, state).kind, 'pulse');
  assert.ok(hitFlash(fire, state).cycles > hitFlash({ ...fire, burn: undefined }, state).cycles, 'a fire that catches flickers longer');
  assert.ok(hitFlash({ ...fire, burn: { id: 'quemado', level: 3 } }, state).cycles > hitFlash(fire, state).cycles, 'and longer the higher it burns');
  assert.equal(hitFlash(fire, state, 'suave').kind, 'breathe', 'no strobe when the lights are soft');
  assert.equal(impactSeconds({ kind: 'skill', actor: 'gerard', target: 'gerard', skill: 'analisis', boosted: ['gerard'] }), .2);
});

test('a dual flickers the whole room gold and orange as its banner settles', () => {
  const state = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard-adult' }], palaceGuards(0));
  const foe = state.foes[0].id;
  const dual = { kind: 'skill', actor: 'gerard', target: foe, amount: 60, dual: { id: 'zarpazos-de-fuego', name: 'Zarpazos de fuego', parts: ['foc-binari', 'zarpazos'], actors: ['gerard', 'aitor'], spent: {} } };
  const flash = hitFlash(dual, state);
  assert.equal(flash.kind, 'pulse');
  assert.ok(flash.lights.includes('mesa') && flash.cycles >= 6, 'every bulb, through the choreography');
  const { hue } = flash.color;
  assert.ok(hue >= 25 && hue <= 50, `gold to orange, never violet or pink: ${hue}`);
  assert.equal(hitFlash(dual, state, 'suave').kind, 'breathe', 'no strobe when the lights are soft');
  assert.ok(impactSeconds(dual) > CONTACT_SECONDS, 'it waits for the banner');
});

test('the castle\'s bosses turn the room raw once per turn they name; Aitor taken is possession\'s violet', async () => {
  const { createFearBattle } = await import('../src/battle.ts');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
  const state = createFearBattle(party, 'reina-vuelta'), queen = state.foes.find(f => f.kind === 'reina').id;
  const seen = new Set();
  const manos = { kind: 'attack', actor: 'gerard', target: queen, called: [{ target: queen, text: 'Las manos' }] };
  assert.ok(peakOf(manos, state, seen).saturation > .85, 'her hands: full red');
  assert.equal(peakOf({ ...manos, kind: 'enemy', actor: queen }, state, seen), undefined, 'named again as she raises them: once is enough');
  const taken = peakOf({ kind: 'attack', actor: 'gerard', target: queen, called: [{ target: 'aitor', text: 'Suyo' }] }, state, seen);
  assert.ok(taken.hue > 255 && taken.hue < 290, `violet, not her pink (${taken.hue})`);
  assert.ok(peakOf({ kind: 'attack', actor: 'gerard', target: queen, called: [{ target: queen, text: '¡Pompa rota!' }] }, state, seen).saturation <= .5, 'a part of her broken: white-gold');
  assert.equal(turnOf({ kind: 'attack', actor: 'gerard', called: [{ target: queen, text: 'Respuesta correcta' }] }), undefined, 'the answer is a warm flash, not a slam');
});

test('while she holds Aitor the moon is his light: her violet, walking to his cyan with each right note', async () => {
  const { createFearBattle } = await import('../src/battle.ts');
  const { MELODY } = await import('../src/castle.ts');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
  const state = createFearBattle(party, 'reina-vuelta');
  assert.equal(heldLamp(state), undefined, 'not before she takes him');
  state.castle = { ...state.castle, taken: true, notes: 0 };
  const violet = heldLamp(state);
  assert.ok(violet.hue > 255 && violet.hue < 290);
  assert.equal(battleLook(state, 'salon').luna.hue, violet.hue, 'on the moon');
  state.castle.notes = MELODY.length - 1;
  assert.ok(heldLamp(state).hue < 230, 'almost his cyan');
  state.castle.freed = true;
  assert.equal(heldLamp(state), undefined, 'free: her violet leaves the room');
});

test('Direcció\'s table lamps go out one by one as the three fall, each fall a hard white', async () => {
  const { createFearBattle } = await import('../src/battle.ts');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
  const state = createFearBattle(party, 'direccion');
  const three = state.foes.filter(f => f.kind === 'directiva');
  assert.equal(three.length, 3);
  assert.ok(battleLook(state, 'salon').cocina.on);
  three[0].hp = 0;
  const look = battleLook(state, 'salon');
  assert.equal(look.cocina.on, false); assert.ok(look.sofa.on && look.luna.on);
  assert.ok(peakOf({ kind: 'attack', actor: 'gerard', target: three[0].id, amount: 30 }, state), 'her fall slams');
  three[1].hp = 0; three[2].hp = 0;
  assert.ok(['cocina', 'sofa', 'luna'].every(id => !battleLook(state, 'salon')[id].on));
});

test('a cure is not a blow, and each fight\'s own answer lands as the answer', () => {
  const state = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard-adult' }], palaceGuards(0));
  const foe = state.foes[0].id;
  const plain = hitFlash({ kind: 'attack', actor: 'gerard', target: foe, amount: 10 }, state);
  const cure = hitFlash({ kind: 'skill', actor: 'gerard', target: 'gerard', amount: 10, healed: true }, state);
  assert.ok(cure.color.hue > 100 && cure.color.hue < 160 && cure.period > plain.period, 'a slow green');
  for (const answer of [{ converged: true }, { weakSpot: 'renewed' }, { kinds: [{ target: foe, blow: 'magic', affinity: 'weak' }] }, { crits: [false, true] }, { shorted: { target: foe, why: 'mojado' } }, { called: [{ target: foe, text: 'Respuesta correcta' }] }]) {
    assert.ok(answerFound({ kind: 'attack', actor: 'gerard', target: foe, amount: 10, ...answer }), JSON.stringify(answer));
  }
  assert.ok(!answerFound({ kind: 'attack', actor: 'gerard', target: foe, amount: 10, shorted: { target: foe, why: 'again' } }));
});

test('the end: her fall is no victory, and the two choices leave the room differently, neither in victory\'s colours', () => {
  assert.ok(isQueen({ encounter: 'reina-vuelta' }) && isQueen({ encounter: 'reina' }) && !isQueen({ encounter: 'aurelia' }));
  assert.ok(Object.values(LAST).every(lamp => !lamp.on || lamp.brightness <= .2), 'the last scene is almost dark');
  const acabar = endingCue('acabar'), bajar = endingCue('bajar');
  const last = cue => cue.steps.at(-1).look;
  assert.ok(acabar.steps.some(step => Object.values(step.look).every(lamp => !lamp.on) && Object.keys(step.look).length === 4), 'Acabar goes to black');
  assert.ok(Object.values(last(acabar)).every(lamp => lamp.saturation === 0 && lamp.brightness < .2), 'and comes back as an empty classroom, cold and low');
  assert.ok(Object.values(last(bajar)).every(lamp => lamp.saturation === 0 && lamp.brightness > .8), 'Bajar la mano ends in white');
  for (const cue of [acabar, bajar]) for (const step of cue.steps) for (const lamp of Object.values(step.look)) assert.ok(!Object.values(VICTORY).some(v => sameLamp(v, lamp)));
  assert.ok(endingCue('bajar', 'suave').steps.at(-1).look.mesa.brightness < last(bajar).mesa.brightness, 'soft lights stay softer');
});
