import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { FEARS, PLACES_NURIA } from '../src/friends/nuria.ts';
import { TOWER, TOP_HEIGHT, onTop, towerEntrance, towerHeights } from '../src/tower.ts';
import { createChaser, rest, updateChaser, GIVE_UP } from '../src/chasers.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { act, addStatus, createFearBattle, enemyAct, MAX_ALTURA, nextRound, GAME_OVER_ROUNDS } from '../src/battle.ts';

const adult = () => new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('clue-r4') + 1));
const kinds = effects => effects.map(e => e.kind);
const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'noista' }];

test('every place of Nuria\'s mission stands on a walkable cell', () => {
  const places = [PLACES_NURIA.nuria, PLACES_NURIA.haru, PLACES_NURIA.corner, PLACES_NURIA.mazeIn, PLACES_NURIA.streetBack, PLACES_NURIA.summit, ...PLACES_NURIA.uri, ...FEARS.flatMap(f => f.patrol.map(cell => ({ environment: 'cardedeu-laberinto', cell })))];
  for (const place of places) assert.ok(canWalk(place.cell, ENVIRONMENTS[place.environment].grid), `${place.environment} ${place.cell.x},${place.cell.z}`);
});

test('Nuria lends the cats: Papagato on trial, and the corner opens onto Uri\'s maze', () => {
  const story = adult();
  assert.deepEqual(kinds(story.handle({ type: 'arrive', station: 'cardedeu' })).slice(0, 1), ['dialogue']);
  assert.ok(story.has('cardedeu'));
  assert.deepEqual(story.triggers('cardedeu').map(t => t.id), ['haru'], 'Haru waits at the station');
  story.handle({ type: 'near', id: 'haru' });
  assert.deepEqual(story.triggers('cardedeu'), []);
  assert.ok(!story.interactions('cardedeu').some(i => i.id === 'enter-maze'), 'no maze before Nuria asks');
  const lent = story.handle({ type: 'interact', id: 'talk-nuria' });
  assert.deepEqual(kinds(lent), ['dialogue', 'anima']);
  assert.ok(story.classes.includes('papagato') && !story.has('papagato'), 'lent, not kept');
  assert.ok(story.interactions('cardedeu').some(i => i.id === 'enter-maze'));
  const inside = story.handle({ type: 'interact', id: 'enter-maze' });
  assert.equal(inside[0].environment, 'cardedeu-laberinto');
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => t.id), ['uri-0']);
  assert.deepEqual(story.fears('cardedeu-laberinto').map(f => f.id), FEARS.map(f => f.id));
});

test('the tower: a fear that reaches Gerard starts its fight and stays beaten, Uri climbs ahead, and the summit waits for him', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' }); story.handle({ type: 'interact', id: 'enter-maze' });
  assert.deepEqual(story.handle({ type: 'near', id: 'summit' }), [], 'Uri is not up there yet');
  const caught = story.handle({ type: 'near', id: 'fear-cebollon' });
  assert.deepEqual(caught.at(-1), { kind: 'battle', encounter: 'cebollon' });
  story.handle({ type: 'battle', won: true, encounter: 'cebollon', worn: ['papagato'] });
  assert.ok(!story.fears('cardedeu-laberinto').some(f => f.id === 'fear-cebollon'));
  for (const n of [0, 1, 2]) { assert.equal(kinds(story.handle({ type: 'near', id: `uri-${n}` }))[0], 'dialogue'); }
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => t.id), ['summit']);
  assert.deepEqual(story.handle({ type: 'near', id: 'summit' }).at(-1), { kind: 'battle', encounter: 'uri-vertigo' });
});

test('the tower\'s ramp climbs evenly round every ring up to the platform, with no short cut', () => {
  const grid = ENVIRONMENTS['cardedeu-laberinto'].grid;
  const heights = towerHeights(grid);
  assert.equal(heights.get(`${towerEntrance().x},${towerEntrance().z}`), 0);
  const top = [...heights].filter(([k]) => { const [x, z] = k.split(',').map(Number); return onTop({ x, z }); });
  assert.ok(top.length > 100 && top.every(([, h]) => h === TOP_HEIGHT()), 'a flat platform on top');
  // Every ring is walked round: Uri's stops climb, one ring higher each.
  const at = c => heights.get(`${c.x},${c.z}`);
  const stops = PLACES_NURIA.uri.map(u => at(u.cell));
  assert.ok(stops.every((h, i) => i === 0 || h > stops[i - 1]), stops.join(' < '));
  assert.ok(stops[0] > TOP_HEIGHT() / 5, 'the first ring alone climbs a good way');
  // Neighbouring ramp cells never jump: it is a ramp, not stairs.
  for (const [k, h] of heights) {
    const [x, z] = k.split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [0, 1]]) { const n = heights.get(`${x + dx},${z + dz}`); if (n !== undefined && !onTop({ x, z })) assert.ok(Math.abs(n - h) < .6, `${k}: ${h} vs ${n}`); }
  }
});

test('a fear walks its round, chases Gerard when it sees him, gives up when it loses him, and rests after a fight', () => {
  const grid = ENVIRONMENTS['cardedeu-laberinto'].grid;
  const spec = FEARS.find(f => f.id === 'fear-cebollon');
  const c = createChaser({ id: spec.id, patrol: spec.patrol, sight: spec.sight, walk: spec.walk, run: spec.run });
  const far = { x: 25, z: 54 };
  for (let i = 0; i < 20; i++) assert.equal(updateChaser(c, .1, far, grid), undefined);
  assert.equal(c.mode, 'patrol');
  const near = { x: c.position.x, z: c.position.z - 4 };
  assert.equal(updateChaser(c, .1, near, grid), 'spotted');
  let event;
  for (let i = 0; i < 40 && event !== 'caught'; i++) event = updateChaser(c, .1, near, grid);
  assert.equal(event, 'caught');
  rest(c);
  assert.equal(updateChaser(c, .1, near, grid), undefined, 'resting after the fight');
  const d = createChaser({ id: 'x', patrol: spec.patrol, sight: spec.sight, walk: spec.walk, run: spec.run });
  updateChaser(d, .1, { x: d.position.x, z: d.position.z - 5 }, grid);
  let lost;
  for (let t = 0; t < GIVE_UP + 1 && lost !== 'lost'; t += .1) lost = updateChaser(d, .1, far, grid);
  assert.equal(lost, 'lost');
});

test('beating El Vértigo keeps Papagato, the cats and the three lights', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' });
  const won = story.handle({ type: 'battle', won: true, encounter: 'uri-vertigo', worn: ['papagato'] });
  for (const flag of ['nuria-uri', 'papagato', 'anima-nuria', 'luz-nuria', 'luz-uri', 'luz-nil']) assert.ok(story.has(flag), flag);
  assert.deepEqual(won.find(e => e.kind === 'lights'), { kind: 'lights', people: ['nuria', 'uri', 'nil'] });
  assert.ok(!story.nuria.lent && story.classes.includes('papagato'));
  assert.ok(story.npcs('cardedeu').some(n => n.id === 'uri'), 'Uri is home with Nuria');
});

test('giving up hands the cats back: Aitor asks first at the station, and falling counts too', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' });
  assert.deepEqual(kinds(story.handle({ type: 'interact', id: 'station-cardedeu' })), ['dialogue'], 'Aitor asks');
  assert.ok(story.nuria.lent);
  assert.equal(story.handle({ type: 'interact', id: 'station-cardedeu' }).at(-1).kind, 'metro');
  assert.ok(!story.nuria.lent && !story.classes.includes('papagato'));
  story.handle({ type: 'interact', id: 'talk-nuria' });
  story.handle({ type: 'battle', won: false, encounter: 'plato' });
  assert.ok(!story.nuria.lent, 'falling wakes them at home without the cats');
});

test('El Cebollón peels a layer a hit and makes everyone cry while it has any', () => {
  const s = createFearBattle(party, 'cebollon');
  const onion = s.foes[0];
  act(s, 'attack', 'cebollon');
  assert.equal(onion.layers, 3);
  s.phase = 'enemy'; enemyAct(s, 'cebollon');
  assert.ok(s.allies.every(a => a.statuses?.llorera === 1));
});

test('El Plato Misterioso swaps dishes, and the dish decides what hurts it', () => {
  const s = createFearBattle(party, 'plato');
  assert.equal(s.foes[0].dish, 'alcachofa');
  s.phase = 'enemy'; enemyAct(s, 'plato');
  assert.equal(s.foes[0].dish, 'coliflor');
});

test('Game Over restarts with full PV when its countdown runs out', () => {
  const s = createFearBattle(party, 'game-over');
  const ghost = s.foes[0];
  for (let round = 0; round < GAME_OVER_ROUNDS; round++) {
    ghost.hp = 10;
    s.phase = 'enemy'; s.enemyActions = ['game-over']; nextRound(s);
  }
  assert.equal(ghost.hp, ghost.maxHp);
});

test('El Vértigo: the spinning eye makes everyone look down unless they hold on, and Uri always stands up to it', () => {
  const s = createFearBattle(party, 'uri-vertigo');
  const vertigo = s.foes[0];
  s.phase = 'enemy'; enemyAct(s, 'vertigo');
  assert.ok(s.vertigo.eye, 'the warning');
  s.enemyActions = []; s.allies[0].guarding = true;
  enemyAct(s, 'vertigo');
  assert.equal(s.vertigo.altura, 2);
  assert.ok(!s.allies[0].statuses?.mareo && s.allies[1].statuses.mareo === 1, 'holding on keeps you steady');
  s.vertigo.altura = MAX_ALTURA; s.enemyActions = [];
  enemyAct(s, 'vertigo');
  assert.equal(s.vertigo.altura, 3, 'Vacío brings the roof down to 3');
  // Whatever the party does, by round 6 Uri steps in front of Nil, and from then the roof comes down.
  for (let round = s.round; round < 6; round++) { s.phase = 'enemy'; s.enemyActions = ['vertigo']; nextRound(s); }
  assert.ok(s.vertigo.uri);
  const altura = s.vertigo.altura;
  s.phase = 'enemy'; s.enemyActions = ['vertigo']; nextRound(s);
  assert.equal(s.vertigo.altura, altura - 1);
  assert.ok(vertigo.hp > 0);
});

test('Haru\'s claw on the spinning eye shuts it, and the twist comes at half PV', () => {
  const s = createFearBattle(party, 'uri-vertigo');
  s.vertigo.eye = true;
  act(s, 'skill', 'vertigo', 'zarpazo');
  assert.ok(!s.vertigo.eye);
  s.phase = 'player'; s.active = 1;
  s.foes[0].hp = Math.floor(s.foes[0].maxHp / 2) + 5;
  act(s, 'skill', 'vertigo', 'nota');
  assert.ok(s.vertigo.uri);
  assert.match(s.message, /Uri se pone delante de Nil/);
});

test('after the win Haru and Yuki live in the Meridiana flat, strolling on its floor', async () => {
  const { createWanderer, wander } = await import('../src/cat-wander.ts');
  assert.deepEqual(adult().catsAtHome('meridiana'), [], 'not before Uri is back');
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' });
  story.handle({ type: 'battle', won: true, encounter: 'uri-vertigo', worn: ['papagato'] });
  const cats = story.catsAtHome('meridiana');
  assert.deepEqual(cats.map(c => c.id), ['haru', 'yuki']);
  assert.deepEqual(story.catsAtHome('cardedeu'), []);
  const grid = ENVIRONMENTS.meridiana.grid;
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const { cell } of cats) {
    assert.ok(canWalk(cell, grid));
    const cat = createWanderer(cell);
    const visited = new Set();
    for (let t = 0; t < 120; t += .1) {
      wander(cat, .1, grid, random);
      assert.ok(canWalk({ x: Math.round(cat.position.x), z: Math.round(cat.position.z) }, grid), 'stays on the floor');
      visited.add(`${Math.round(cat.position.x)},${Math.round(cat.position.z)}`);
    }
    assert.ok(visited.size > 3, 'it moves about');
  }
});
