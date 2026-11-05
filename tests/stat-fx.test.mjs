import test from 'node:test';
import assert from 'node:assert/strict';
import { VERTIGO_TURNS, addStatus, act, createBattle, createBroodBattle, createFearBattle, enemyAct, nextRound, statNames, statShifts } from '../src/battle.ts';
import { CHEVRONS, STAT_MOTES, STAT_MOTE_KINDS, chevronPose, playStatChange, statChangeShape } from '../src/stat-fx.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];

test('stats falling run the bars down past them, and rising up, from above their head to their feet', () => {
  const down = statChangeShape('down', .6, 2), up = statChangeShape('up', .6, 2);
  assert.ok(down.bars.length >= 5);
  for (const bar of down.bars) { assert.ok(bar.from > 2, 'from over their head'); assert.ok(bar.to <= 0, 'to their feet'); }
  for (const bar of up.bars) { assert.ok(bar.from < 2 * .25, 'from their feet or a little up'); assert.ok(bar.to > 2); }
});

test('the bars are fine and each one its own: widths, lengths and speeds differ', () => {
  const { bars } = statChangeShape('up', .6, 2);
  assert.ok(bars.length >= 12);
  for (const bar of bars) assert.ok(bar.width > 0 && bar.width <= .09, `fine: ${bar.width}`);
  for (const key of ['width', 'tail', 'seconds']) assert.ok(new Set(bars.map(b => b[key].toFixed(3))).size > bars.length / 2, `${key} varies`);
});

test('a second circle opens out when stats rise and closes in when they fall', () => {
  assert.ok(statChangeShape('up', .6, 2).echo.narrow > 1);
  assert.ok(statChangeShape('down', .6, 2).echo.narrow < 1);
});

test('however small someone is, it stays big enough to read', () => {
  const small = statChangeShape('down', .1, .3), big = statChangeShape('down', .55, 1.5);
  assert.deepEqual(small, big);
});

test('first the circle, quickly, then the bars one after another', () => {
  const { ring, bars } = statChangeShape('down', .6, 2);
  assert.ok(ring.seconds < .4, 'the circle is quick');
  assert.ok(bars[0].delay > ring.seconds / 2, 'the bars leave once it has spun');
  for (let i = 1; i < bars.length; i++) assert.ok(bars[i].delay > bars[i - 1].delay);
});

test('it is sized to whoever it happens to, with the bars round them, not on one side', () => {
  for (const radius of [.6, 1.2]) {
    const { ring, bars } = statChangeShape('up', radius, 2);
    assert.ok(ring.radius >= radius);
    for (const bar of bars) assert.ok(Math.hypot(bar.x, bar.z) <= radius + 1e-9);
    // Their centre of mass stays close to the fighter's: bars on every side.
    const x = bars.reduce((sum, b) => sum + b.x, 0) / bars.length, z = bars.reduce((sum, b) => sum + b.z, 0) / bars.length;
    assert.ok(Math.hypot(x, z) < radius * .35, `off centre by ${Math.hypot(x, z)}`);
  }
});

test('it draws in red going down, blue going up, and waits for its delay', () => {
  const calls = [];
  const trails = {
    spiral: (centre, colour, options) => calls.push({ kind: 'spiral', centre, colour, options }),
    comet: (from, to, colour, seconds, options) => calls.push({ kind: 'comet', from, to, colour, options }),
  };
  playStatChange(trails, { x: 1, y: 2, z: 3 }, 'down', { radius: .6, height: 2, delay: .5 });
  const rings = calls.filter(c => c.kind === 'spiral'), bars = calls.filter(c => c.kind === 'comet');
  assert.ok(rings.length >= 1 && bars.length >= 5);
  for (const ring of rings) { assert.deepEqual(ring.options.normal, { x: 0, y: 1, z: 0 }, 'flat on the floor'); assert.ok(ring.options.delay >= .5); assert.equal(ring.options.height, 0); }
  for (const bar of bars) { assert.equal(bar.options.arc, 0, 'straight up and down'); assert.equal(bar.from.x, bar.to.x); assert.equal(bar.from.z, bar.to.z); assert.ok(bar.options.delay > .5); assert.ok(bar.options.taper < .5, 'a bar, not a streak'); }
  const red = hex => parseInt(hex.slice(1, 3), 16) > parseInt(hex.slice(5, 7), 16);
  assert.ok(bars.every(bar => red(bar.colour[0])), 'red');
  calls.length = 0;
  playStatChange(trails, { x: 0, y: 0, z: 0 }, 'up', { radius: .6, height: 2 });
  assert.ok(calls.filter(c => c.kind === 'comet').every(bar => !red(bar.colour[0])), 'not red');
});

test('the last layer off an onion breaks its defence, and the layers before it do not', () => {
  const s = createFearBattle(party, 'cebollon');
  s.foes[0].layers = 2;
  assert.equal(act(s, 'attack', 'cebollon').stats, undefined, 'one left');
  s.active = s.allies.findIndex(a => a.hp > 0 && s.allies.indexOf(a) === 1);
  const broken = act(s, 'attack', 'cebollon');
  assert.deepEqual(broken.stats, [{ target: 'cebollon', way: 'down', stats: ['defensa'] }]);
});

test('Zarpazos taking the last layer breaks it too, however many claws it took; a foe that falls with it does not show it', () => {
  const s = createFearBattle(party, 'cebollon');
  s.levels = { papagato: 2 };
  s.foes[0].layers = 3;
  const claws = act(s, 'skill', 'cebollon', 'zarpazos');
  assert.equal(claws.peeled, 3);
  assert.deepEqual(claws.stats, [{ target: 'cebollon', way: 'down', stats: ['defensa'] }]);
  const fallen = createFearBattle(party, 'cebollon');
  fallen.foes[0].layers = 1; fallen.foes[0].hp = 1;
  assert.equal(act(fallen, 'attack', 'cebollon').stats, undefined);
});

test('Las dos a la vez breaks the defence of each onion it peels bare', () => {
  const s = createBroodBattle(party, 'crias-1', undefined, () => .1);
  s.levels = { papagato: 3 };
  s.foes.forEach(f => { f.layers = 1; f.hp = f.maxHp; });
  const all = act(s, 'skill', undefined, 'a-la-vez');
  assert.deepEqual(all.stats.map(c => c.target).sort(), s.foes.map(f => f.id).sort());
  assert.ok(all.stats.every(c => c.way === 'down'));
});

test('a boost says who it raises and which stats', () => {
  const s = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  const yuki = act(s, 'skill', undefined, 'escondite');
  assert.deepEqual(yuki.stats, [{ target: 'gerard', way: 'up', stats: ['defensa'] }, { target: 'aitor', way: 'up', stats: ['defensa'] }]);
});

test('Llorera landing and Grito liberador say what they lower and raise; a blow with neither says nothing', () => {
  const big = createFearBattle(party, 'cebollon');
  big.phase = 'enemy';
  const cry = enemyAct(big, 'cebollon', 'gerard');
  assert.deepEqual(cry.stats, [{ target: 'gerard', way: 'down', stats: ['fuerza', 'magia'] }, { target: 'aitor', way: 'down', stats: ['fuerza', 'magia'] }]);
  const bare = createFearBattle(party, 'cebollon');
  bare.foes[0].layers = 0; bare.phase = 'enemy';
  assert.equal(enemyAct(bare, 'cebollon', 'gerard').stats, undefined);
  const roof = createFearBattle(party, 'uri-vertigo');
  // Grito liberador: the party's Fuerza and Magia down, Vertitrón's up.
  roof.foes[0].turns = VERTIGO_TURNS.indexOf('grito'); roof.phase = 'enemy';
  const grito = enemyAct(roof, 'vertigo', 'aitor');
  assert.deepEqual(grito.stats.map(c => [c.target, c.way]), [...roof.allies.map(a => [a.id, 'down']), ['vertigo', 'up']]);
  assert.deepEqual(grito.stats[0].stats, ['fuerza', 'magia']);
  roof.foes[0].turns = 0;
  assert.equal(enemyAct({ ...roof, enemyActions: [] }, 'vertigo', 'gerard').stats, undefined, 'a Pisotón says nothing');
});

test('stats read in plain words', () => {
  assert.equal(statNames(['defensa']), 'Defensa');
  assert.equal(statNames(['fuerza', 'magia']), 'Fuerza y Magia');
  assert.equal(statNames(['velocidad', 'defensa', 'espiritu']), 'Velocidad, Defensa y Espíritu');
  assert.equal(statNames([]), '');
});

test('three chevrons pass them one after another: rising up past them, or sinking down', () => {
  const at = (way, i, t) => chevronPose(way, i, t, 2);
  assert.equal(at('up', 0, 0), undefined, 'not before the circle has spun');
  // Each starts after the one before and is gone in the end.
  const first = i => { for (let t = 0; t < 2; t += .01) if (at('up', i, t)) return t; };
  for (let i = 1; i < CHEVRONS.count; i++) assert.ok(first(i) > first(i - 1));
  assert.equal(at('up', 2, 3), undefined);
  // Rising goes up, falling down, from about their knees to over their head.
  const path = (way, i) => [.05, .3, .9].map(k => at(way, i, CHEVRONS.after + i * CHEVRONS.stagger + k * CHEVRONS.seconds).y);
  const up = path('up', 1), down = path('down', 1);
  assert.ok(up[0] < up[1] && up[1] < up[2] && up[2] > 2, up.join());
  assert.ok(down[0] > down[1] && down[1] > down[2] && down[0] > 2, down.join());
  // It pops in a little big, settles, and fades out at the end.
  const mid = at('up', 0, CHEVRONS.after + CHEVRONS.seconds * .4), early = at('up', 0, CHEVRONS.after + CHEVRONS.seconds * .14);
  assert.ok(early.scale > 1.1 && mid.scale === 1 && mid.alpha === 1);
  assert.ok(at('up', 0, CHEVRONS.after + CHEVRONS.seconds * .95).alpha < .2);
});

test('what is up or down now: a boost while it runs, Llorera and Mareo by their stacks, all added up stat by stat', () => {
  const s = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  const [gerard, aitor] = s.allies;
  assert.deepEqual(statShifts(s, gerard), [], 'nothing at the start');
  act(s, 'skill', undefined, 'escondite');
  assert.deepEqual(statShifts(s, aitor), [{ stat: 'defensa', way: 'up', amount: 4, rounds: 3, from: ['Yuki se esconde'] }]);
  assert.deepEqual(statShifts(s, s.foes[0]), [], 'a party boost is only the party\'s');
  addStatus(aitor, 'llorera', 2);
  assert.deepEqual(statShifts(s, aitor).map(shift => [shift.stat, shift.way, shift.amount]), [['fuerza', 'down', 4], ['magia', 'down', 4], ['defensa', 'up', 4]], 'in the fight\'s order');
  // Mareo takes one Defensa a stack: with Yuki's four, it is still up, by less, for both reasons.
  addStatus(gerard, 'mareo', 1);
  const defence = statShifts(s, gerard).find(shift => shift.stat === 'defensa');
  assert.deepEqual(defence, { stat: 'defensa', way: 'up', amount: 3, rounds: 3, from: ['Yuki se esconde', 'Mareo 1'] });
  gerard.hp = 0;
  assert.deepEqual(statShifts(s, gerard), [], 'nothing on someone fallen');
});

test('a boost wears off after its rounds, and a status as its stacks fade', () => {
  const s = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  act(s, 'skill', undefined, 'escondite');
  addStatus(s.allies[1], 'llorera', 1);
  for (let round = 0; round < 3; round++) {
    assert.ok(statShifts(s, s.allies[0]).length, `round ${round + 1}: still up`);
    s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); s.allies.forEach(a => { a.hp = a.maxHp; });
    nextRound(s);
    if (round === 0) assert.deepEqual(statShifts(s, s.allies[1]).map(shift => shift.way), ['up'], 'one stack of Llorera lasts one round');
  }
  assert.deepEqual(statShifts(s, s.allies[0]), [], 'three rounds, then it is gone');
});

test('an onion peeled bare has its defence broken, with no number', () => {
  const s = createFearBattle(party, 'cebollon');
  assert.deepEqual(statShifts(s, s.foes[0]), [], 'with its layers on');
  s.foes[0].layers = 0;
  assert.deepEqual(statShifts(s, s.foes[0]), [{ stat: 'defensa', way: 'down', amount: undefined, rounds: undefined, from: ['Sin capas'] }]);
});

test('stats that stay up give off tiny blue motes that rise off the head, and down red ones that fall', () => {
  const up = STAT_MOTE_KINDS[STAT_MOTES.up.kind], down = STAT_MOTE_KINDS[STAT_MOTES.down.kind];
  assert.ok(up.gravity < 0, 'up: they rise');
  assert.ok(down.gravity > 0, 'down: they fall');
  for (const way of ['up', 'down']) assert.ok(STAT_MOTES[way].above >= .75, `${way}: off the head`);
  for (const kind of [up, down]) {
    assert.ok(Math.max(...kind.size) <= .03, 'tiny');
    assert.ok(kind.intensity[0] >= 3 && kind.additive > .5, 'but bright: dots of light');
  }
  const hue = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return { r, g, b }; };
  const blue = hue(up.colours[1]), red = hue(down.colours[1]);
  assert.ok(blue.b > blue.r && blue.b > blue.g, 'blue up');
  assert.ok(red.r > red.g && red.r > red.b, 'red down');
  assert.ok(STAT_MOTES.delay > CHEVRONS.after, 'they wait for the chevrons');
});
