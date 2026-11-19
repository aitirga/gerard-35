import test from 'node:test';
import assert from 'node:assert/strict';
import { CURVE_STEPS, PLAYERS, Playing, pathOn, summarise } from '../src/game-sim.ts';

/** A game cut short after `fights` fights: the whole route is `just game-sim`'s, too long for a test. */
const playTo = (fights, seed = 35, player = PLAYERS.pensando) => new Playing(player, seed, { days: 60, seconds: 1e9, fights }).playAll();

test('a walk takes the grid\'s shortest way round walls and blocked cells, or none', () => {
  const grid = ['.....', '.###.', '.....'];
  assert.equal(pathOn(grid, { x: 0, z: 1 }, { cell: { x: 4, z: 1 }, radius: 0 }).length - 1, 6);
  assert.equal(pathOn(grid, { x: 0, z: 0 }, { cell: { x: 4, z: 0 }, radius: 0 }, new Set(['2,0'])).length - 1, 8);
  assert.equal(pathOn(['..#..'], { x: 0, z: 0 }, { cell: { x: 4, z: 0 }, radius: 0 }), undefined);
});

test('the thinking player walks the story through the friends\' missions into the castle, the same every time with the same seed', () => {
  const game = playTo(40);
  for (const flag of ['first-fight', 'wrapper-room', 'caught', 'tv-news', 'metro', 'palace-tried', 'nuria-uri', 'sobremesa', 'voz']) assert.ok(game.flags.includes(flag), `${flag} is reached`);
  assert.ok(game.fights.every(f => f.rounds > 0));
  assert.ok(game.seconds > 0 && Object.values(game.time).every(t => t >= 0));
  assert.ok(game.moments.some(m => m.kind === 'level' && m.anima === 'papagato'), 'Papagato grows with the EXP of its fights');
  assert.ok(game.fights.some(f => f.encounter.startsWith('alumnos-')), 'after the friends it goes into the castle, through a generated floor');
  const again = playTo(40);
  assert.equal(again.seconds, game.seconds);
  assert.deepEqual(again.fights.map(f => f.encounter), game.fights.map(f => f.encounter));
});

test('many games add up per player: length, the difficulty curve by tenths, levels and every fight met', () => {
  const { players: [p] } = summarise([playTo(20, 35), playTo(20, 36)]);
  assert.equal(p.id, 'pensando'); assert.equal(p.runs, 2); assert.equal(p.name, PLAYERS.pensando.name);
  assert.equal(p.curve.length, CURVE_STEPS);
  assert.ok(p.minutes.p50 > 0 && p.encounters.some(e => e.encounter === 'cebolla' || e.encounter.startsWith('crias')));
  assert.ok(p.sample.fights.length > 0);
});
