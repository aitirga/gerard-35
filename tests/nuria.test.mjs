import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS } from '../src/story.ts';
import { AMBUSHES, PLACES_NURIA } from '../src/friends/nuria.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { act, addStatus, createFearBattle, enemyAct, MAX_ALTURA, nextRound, GAME_OVER_ROUNDS } from '../src/battle.ts';

const adult = () => new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('clue-r4') + 1));
const kinds = effects => effects.map(e => e.kind);
const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'noista' }];

test('every place of Nuria\'s mission stands on a walkable cell', () => {
  const places = [PLACES_NURIA.nuria, PLACES_NURIA.haru, PLACES_NURIA.corner, PLACES_NURIA.mazeIn, PLACES_NURIA.streetBack, ...PLACES_NURIA.uri, ...AMBUSHES.map(a => ({ environment: 'cardedeu-laberinto', cell: a.cell }))];
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
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => t.id), [...AMBUSHES.map(a => a.id), 'uri-0']);
});

test('the maze: ambushes start their fight and stay beaten, Uri runs on, and the roof waits for him', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' }); story.handle({ type: 'interact', id: 'enter-maze' });
  assert.deepEqual(story.handle({ type: 'interact', id: 'subir-tejado' }), [], 'Uri is not up there yet');
  const ambush = story.handle({ type: 'near', id: 'ambush-cebollon' });
  assert.deepEqual(ambush.at(-1), { kind: 'battle', encounter: 'cebollon' });
  story.handle({ type: 'battle', won: true, encounter: 'cebollon', worn: ['papagato'] });
  assert.ok(!story.triggers('cardedeu-laberinto').some(t => t.id === 'ambush-cebollon'));
  for (const n of [0, 1, 2]) { assert.equal(kinds(story.handle({ type: 'near', id: `uri-${n}` }))[0], 'dialogue'); }
  assert.ok(!story.triggers('cardedeu-laberinto').some(t => t.id.startsWith('uri-')));
  assert.deepEqual(story.handle({ type: 'interact', id: 'subir-tejado' }).at(-1), { kind: 'battle', encounter: 'uri-vertigo' });
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
