import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';
import { BEACH, LINES_UNI, PLACES_UNI, UNI_FRIENDS } from '../src/friends/universidad.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { createChaser, updateChaser } from '../src/chasers.ts';

const beats = effects => effects.map(e => e.kind);
const onBeach = () => new Story(flagsAt('clue-uni'));
const grid = ENVIRONMENTS[BEACH].grid;

test('the friends stand on walkable sand, Anna in the shallows the party can wade into', () => {
  for (const cell of Object.values(PLACES_UNI.friends)) assert.ok(canWalk(cell, grid), JSON.stringify(cell));
  assert.ok(canWalk(PLACES_UNI.anna, grid), 'Anna stands in the water, opened for her');
  assert.ok(canWalk(PLACES_UNI.portal, grid), 'and the spiral beside her can be waded into');
  assert.ok(canWalk(PLACES_UNI.retry, grid));
  // The shallows reach the sand: a straight wade from the shore to her.
  for (let z = PLACES_UNI.friends.alvaro.z; z <= PLACES_UNI.anna.z; z++) assert.ok(canWalk({ x: PLACES_UNI.anna.x, z }, grid), `z ${z}`);
});

test('on the beach, the six huddle together facing the sea, Anna waist-deep in it, all their own figures with the Queen\'s eyes', () => {
  const story = onBeach();
  const npcs = story.npcs(BEACH);
  assert.deepEqual(npcs.map(n => n.id).sort(), [...UNI_FRIENDS].sort());
  assert.ok(npcs.every(n => n.character === n.id && n.possessed));
  assert.ok(npcs.every(n => n.facing === 0), 'all looking out to sea');
  assert.ok(npcs.find(n => n.id === 'anna').wade > 0, 'Anna stands in the water');
  // Together: no two of the six more than a few metres apart.
  const six = Object.values(PLACES_UNI.friends);
  for (const a of six) for (const b of six) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) <= 4.5, `${JSON.stringify(a)} ${JSON.stringify(b)}`);
});

test('walking up behind them starts the talk and the game of tag: the friends run, the promenade shuts', () => {
  const story = onBeach();
  assert.deepEqual(story.triggers(BEACH).map(t => t.id), ['uni-talk']);
  const talk = story.handle({ type: 'near', id: 'uni-talk' });
  // The camera takes in the huddle, Anna and the spiral while they talk, then goes back to Gerard.
  assert.deepEqual(beats(talk), ['look', 'dialogue', 'look']);
  assert.deepEqual(talk[1], { kind: 'dialogue', dialogue: LINES_UNI.beach });
  assert.ok(talk[0].cell && !talk[2].cell);
  assert.ok(story.has('barceloneta-uni'));
  assert.deepEqual(story.npcs(BEACH).map(n => n.id), ['anna'], 'the six are chasers now');
  const chasers = story.uniChasers(BEACH);
  assert.equal(chasers.length, 6);
  assert.ok(chasers.every(c => c.relentless && !c.frozen));
  const shut = story.blocked(BEACH);
  assert.ok(shut.length > 50 && shut.every(c => c.z >= PLACES_UNI.tentacles.z && c.z < PLACES_UNI.tentacles.z + PLACES_UNI.tentacles.depth));
  assert.deepEqual(story.triggers(BEACH).map(t => t.id), ['uni-spiral']);
});

test('caught is back up the sand before the talk; the second time only Álvaro\'s last lines', () => {
  const story = onBeach();
  story.handle({ type: 'near', id: 'uni-talk' });
  const caught = story.handle({ type: 'near', id: 'uni-alvaro' });
  assert.deepEqual(beats(caught), ['dialogue', 'fall', 'travel', 'recover']);
  assert.deepEqual(caught[2], { kind: 'travel', environment: BEACH, cell: { ...PLACES_UNI.retry } });
  assert.equal(story.uniChasers(BEACH).length, 0);
  assert.equal(story.blocked(BEACH).length, 0, 'the tentacles go');
  assert.equal(story.npcs(BEACH).length, 7, 'all on the sand again');
  assert.deepEqual(story.handle({ type: 'near', id: 'uni-talk' }), [{ kind: 'dialogue', dialogue: LINES_UNI.again }]);
});

test('near Anna she comes apart into the spiral beside her; the friends stop and stare; through it is the campsite', () => {
  const story = onBeach();
  story.handle({ type: 'near', id: 'uni-talk' });
  assert.deepEqual(story.handle({ type: 'near', id: 'uni-spiral' }), [
    { kind: 'dialogue', dialogue: LINES_UNI.spiral }, { kind: 'portal', who: 'anna' }, { kind: 'dialogue', dialogue: LINES_UNI.gone },
  ]);
  assert.ok(story.uni.spiral);
  assert.ok(story.npcs(BEACH).some(n => n.id === 'anna'), 'still there until she has gone into it');
  assert.deepEqual(story.triggers(BEACH), [], 'nothing to go through while she goes');
  story.sank('anna');
  assert.ok(!story.npcs(BEACH).some(n => n.id === 'anna'), 'Anna has gone into it');
  assert.ok(story.uniChasers(BEACH).every(c => c.frozen));
  assert.deepEqual(story.triggers(BEACH).map(t => t.id), ['uni-through']);
  assert.deepEqual(story.triggers(BEACH)[0].cell, PLACES_UNI.portal);
  assert.deepEqual(story.handle({ type: 'near', id: 'uni-alvaro' }), [], 'nobody catches them once it has opened');
});

test('Aitor tells of the beach on the way into the metro and in the mornings, until they have been', () => {
  const story = new Story(flagsAt('tv-news'));
  const down = story.handle({ type: 'interact', id: 'station-fabra-i-puig' });
  assert.ok(down[0].dialogue.lines.some(l => l.text.includes('Barceloneta')));
  assert.ok(story.has('clue-uni'));
  const fall = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.ok(fall.find(e => e.kind === 'dialogue').dialogue.lines.some(l => l.text.includes('Barceloneta')), 'and again the next morning');
  story.handle({ type: 'near', id: 'uni-talk' });
  const next = story.handle({ type: 'battle', won: false, encounter: 'palace-guards' });
  assert.ok(!next.find(e => e.kind === 'dialogue').dialogue.lines.some(l => l.text.includes('Barceloneta')), 'not once they have been');
});

test('a friend playing tag runs at Gerard from the start and never gives up', () => {
  const open = ['.'.repeat(40)].concat(Array(39).fill('.'.repeat(40)));
  const chaser = createChaser({ id: 'uni-alvaro', patrol: [{ x: 2, z: 2 }], sight: 99, walk: 0, run: 6, relentless: true });
  let caught = false;
  for (let i = 0; i < 400 && !caught; i++) caught = updateChaser(chaser, .05, { x: 30, z: 30 }, open) === 'caught';
  assert.ok(caught, 'it got there however long it took');
});

import { CAMP, CAMP_FREED, CAMP_HUNTERS, CAMP_LOCK, PLACES_CAMP } from '../src/friends/universidad.ts';
import { CAMPING_DOOR, CAMPING_GATE } from '../src/environments.ts';

const campGrid = ENVIRONMENTS[CAMP].grid;
const inCamp = () => { const s = new Story(flagsAt('camping')); s.startUni({ entered: true }); return s; };
const board = (lit = [], shown = []) => ({ lit, shown, darkness: 0 });

test('through the spiral is Càmping Eurosport: they say what they see once, and it takes an hour', () => {
  const story = onBeach();
  story.handle({ type: 'near', id: 'uni-talk' });
  story.handle({ type: 'near', id: 'uni-spiral' });
  story.sank('anna');
  const through = story.handle({ type: 'near', id: 'uni-through' });
  // They come apart into it as Anna did, and come out in the campsite.
  assert.deepEqual(through[0], { kind: 'portal', who: 'party' });
  assert.deepEqual(through[1], { kind: 'travel', environment: CAMP, cell: { ...PLACES_CAMP.entrada } });
  assert.deepEqual(through[2], { kind: 'dialogue', dialogue: LINES_UNI.camp });
  assert.ok(story.has('camping') && story.uni.entered);
});

test('the campsite\'s places stand on walkable ground', () => {
  for (const cell of [PLACES_CAMP.entrada, PLACES_CAMP.pizarra, PLACES_CAMP.tablero, PLACES_CAMP.foto, ...PLACES_CAMP.pitches, ...CAMP_HUNTERS.flatMap(h => h.patrol), ...Object.values(CAMP_FREED)]) assert.ok(canWalk(cell, campGrid), JSON.stringify(cell));
});

test('magos and agentes patrol the paths and run at the party; reaching it is their fight, won it stays won this visit', () => {
  const story = inCamp();
  const rounds = story.fears(CAMP);
  assert.deepEqual(rounds.map(f => f.id), CAMP_HUNTERS.map(h => `camp-${h.id}`));
  assert.ok(rounds.every(f => f.patrol.length >= 2 && f.sight > 0 && f.run > f.walk));
  assert.deepEqual([...new Set(rounds.map(f => f.encounter))].sort(), ['camping-agentes', 'camping-magos'], 'no dados on the paths');
  assert.deepEqual(story.campFoes(CAMP), [], 'El Campeón waits behind the tall wall, unseen until Las parcelas is solved');
  assert.deepEqual(story.handle({ type: 'near', id: 'camp-agentes-fondo' }), [{ kind: 'battle', encounter: 'camping-agentes' }]);
  story.handle({ type: 'battle', won: true, encounter: 'camping-agentes' });
  assert.ok(!story.fears(CAMP).some(f => f.id === 'camp-agentes-fondo'), 'the one that caught them is beaten');
  assert.ok(story.fears(CAMP).some(f => f.id === 'camp-agentes-norte'), 'the other pair still walks');
});

test('the dados only come out of a wrong pitch, with agentes, or of the black one', async () => {
  const { CAMPING_FIGHTS } = await import('../src/battle.ts');
  assert.ok(CAMPING_FIGHTS['camping-tienda'].includes('dado') && CAMPING_FIGHTS['camping-tienda'].includes('agente'));
  assert.ok(CAMPING_FIGHTS['camping-negra'].includes('dado'));
});

test('the maze\'s patrols shout Empiezo, Continúo, Acabo as they fall (in the fight), whose letters are the padlock\'s numbers', () => {
  const story = inCamp();
  for (const hunter of CAMP_HUNTERS) {
    story.handle({ type: 'near', id: `camp-${hunter.id}` });
    assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: hunter.encounter }), [], `${hunter.id}: the word was shouted in the fight`);
  }
  assert.deepEqual([...new Set(CAMP_HUNTERS.map(h => h.word))].sort(), ['Acabo', 'Continúo', 'Empiezo']);
  assert.equal(CAMP_HUNTERS.find(h => h.id === 'magos-plaza').word, 'Empiezo', 'near the way in');
  assert.equal(CAMP_HUNTERS.find(h => h.id === 'agentes-rotonda').word, 'Continúo', 'in the middle');
  assert.equal(CAMP_HUNTERS.find(h => h.id === 'magos-patio').word, 'Acabo', 'by the pool gate');
  assert.deepEqual(['Empiezo', 'Continúo', 'Acabo'].map(w => w.length), [...CAMP_LOCK.code]);
});

test('the pool gate is padlocked; 7, 8, 5 opens it and nothing else does', () => {
  const story = inCamp();
  assert.deepEqual(story.blocked(CAMP), [...CAMPING_GATE, ...CAMPING_DOOR]);
  assert.deepEqual(story.handle({ type: 'near', id: 'camp-gate' }), [{ kind: 'dialogue', dialogue: LINES_UNI.gate }, { kind: 'candado' }]);
  assert.deepEqual(story.handle({ type: 'near', id: 'camp-gate' }), [], 'said once');
  assert.deepEqual(story.handle({ type: 'interact', id: 'candado-porton' }), [{ kind: 'candado' }], 'the padlock again, without the talk');
  assert.deepEqual(story.handle({ type: 'candado', numbers: [5, 8, 7] }), []);
  assert.ok(!story.has('candado'));
  assert.deepEqual(story.handle({ type: 'candado', numbers: [7, 8, 5] }), [{ kind: 'dialogue', dialogue: LINES_UNI.unlocked }]);
  assert.ok(story.has('candado'));
  assert.deepEqual(story.blocked(CAMP), CAMPING_DOOR, 'the pool is open; the merendero\'s steel door is not');
  assert.deepEqual(story.campFoes(CAMP).map(f => f.id), ['campeon'], 'the gate is open: El Campeón stands by the pool');
  assert.deepEqual(story.handle({ type: 'interact', id: 'recepcio-pizarra' }), [{ kind: 'dialogue', dialogue: LINES_UNI.boardIdle }], 'the reception only has notices now');
});

test('by the pool El Campeón stands before the blackboard; Las parcelas there opens the steel door', () => {
  const story = new Story(flagsAt('candado'));
  story.startUni({ entered: true });
  assert.deepEqual(story.triggers(CAMP).filter(t => t.id === 'camp-campeon' || t.id === 'camp-door').map(t => t.id), ['camp-campeon', 'camp-door']);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'pissarra-piscina' })), ['dialogue', 'battle'], 'El Campeón first');
  story.handle({ type: 'battle', won: true, encounter: 'campeon' });
  assert.deepEqual(story.handle({ type: 'near', id: 'camp-door' }), [{ kind: 'dialogue', dialogue: LINES_UNI.door }], 'the steel door says why it is shut');
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'pissarra-piscina' })), ['dialogue', 'parcelas']);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'pissarra-piscina' })), ['parcelas'], 'the notice is read once');
  assert.deepEqual(story.handle({ type: 'parcelas', outcome: 'lit', board: board([3]), solved: false }), []);
  assert.deepEqual(story.uni.board.lit, [3]);
  assert.deepEqual(story.handle({ type: 'parcelas', outcome: 'tent', board: board([3], [5]), solved: false }), [{ kind: 'battle', encounter: 'camping-tienda' }]);
  assert.deepEqual(story.handle({ type: 'parcelas', outcome: 'black', board: board([], [5, 9]), solved: false }), [{ kind: 'battle', encounter: 'camping-negra' }]);
  assert.deepEqual(story.handle({ type: 'near', id: 'camp-mesa' }), [], 'not before the door opens');
  const open = story.handle({ type: 'parcelas', outcome: 'lit', board: board([0, 1, 2, 3, 4, 5, 6, 7, 8]), solved: true });
  assert.deepEqual(open, [{ kind: 'dialogue', dialogue: LINES_UNI.doorOpen }]);
  assert.ok(story.has('parcelas'));
  assert.deepEqual(story.blocked(CAMP), []);
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'pissarra-piscina' })), ['dialogue'], 'nothing left to choose');
  const table = story.handle({ type: 'near', id: 'camp-mesa' });
  assert.deepEqual(table[1], { kind: 'battle', encounter: 'sobremesa' });
});

test('La Sobremesa beaten: it comes apart at the table, the photo, five lights, a spiral for everyone, back on the beach', () => {
  const story = new Story(flagsAt('parcelas'));
  story.startUni({ entered: true, beaten: ['campeon'] });
  const won = story.handle({ type: 'battle', won: true, encounter: 'sobremesa', worn: [], xp: 0 });
  assert.deepEqual(beats(won).slice(0, 9), ['unmask', 'dialogue', 'look', 'photo', 'lights', 'portal', 'travel', 'emerge', 'dialogue']);
  assert.equal(won.find(e => e.kind === 'lights').people.length, 5);
  assert.equal(won.find(e => e.kind === 'portal').who, 'everyone', 'the seven go home through it too');
  for (const flag of ['sobremesa', 'anima-universidad', 'luz-anna-alvaro', 'luz-miquel-sarah', 'luz-soraya', 'luz-nico', 'luz-joan']) assert.ok(story.has(flag), flag);
  assert.equal(story.npcs(CAMP).length, 7, 'round the melon table');
  assert.ok(story.npcs(BEACH).every(n => !n.possessed), 'and themselves again on the beach');
  assert.deepEqual(story.triggers(BEACH), []);
  assert.ok(story.jar.includes('anna-alvaro'));
});

test('freed, the seven face Gerard and Aitor: round the table from its far side, and in a half ring on the beach away from the camera', () => {
  const story = new Story(flagsAt('parcelas'));
  story.startUni({ entered: true, beaten: ['campeon'] });
  story.handle({ type: 'battle', won: true, encounter: 'sobremesa', worn: [], xp: 0 });
  // The camera looks from +x +z (src/camera-orbit.ts HOME_POSE): whoever faces it within a right angle shows their face.
  const towardCamera = facing => Math.cos((facing - 45) * Math.PI / 180) > 0;
  for (const place of [CAMP, BEACH]) for (const npc of story.npcs(place)) assert.ok(towardCamera(npc.facing), `${npc.id} in ${place} turns their back`);
  for (const npc of story.npcs(BEACH)) assert.ok(canWalk(npc.cell, grid), `${npc.id} stands on the sand`);
  assert.ok(canWalk(PLACES_UNI.home, grid), 'Gerard comes out on the sand');
});

test('nothing on its round sees the party where it comes out of the spiral', () => {
  for (const h of CAMP_HUNTERS) for (const at of h.patrol) assert.ok(Math.hypot(at.x - PLACES_CAMP.entrada.x, at.z - PLACES_CAMP.entrada.z) > h.sight + 2, h.id);
});
