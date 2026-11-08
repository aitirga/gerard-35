import test from 'node:test';
import assert from 'node:assert/strict';
import { Story, STORY_FLAGS, onTrigger } from '../src/story.ts';
import { FEARS, LINES_NURIA, PLACES_NURIA } from '../src/friends/nuria.ts';
import { TOWER, TOP_HEIGHT, onTop, towerEntrance, towerHeights } from '../src/tower.ts';
import { createChaser, rest, updateChaser, GIVE_UP } from '../src/chasers.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { dueMark, streetProgress, streetTone } from '../src/street-unease.ts';
import { STREET_MARKS } from '../src/friends/nuria.ts';
import { ONIONS, SKILLS, STAGED_MOMENTS, act, actDual, createBroodBattle, createFearBattle, enemyAct, eyeOpen, FEAR_RULES, intentLabel, nextRound, onionPower, onionSize, runClock, stageMoment, statShifts, takeNews, validTargets, VERTIGO, VERTIGO_TURNS } from '../src/battle.ts';
import { fightXp } from '../src/levels.ts';
import { migrateBeaten } from '../src/friends/nuria.ts';

const adult = () => new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('clue-r4') + 1));
const kinds = effects => effects.map(e => e.kind);
const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];

test('every place of Nuria\'s mission stands on a walkable cell', () => {
  const places = [PLACES_NURIA.nuria, PLACES_NURIA.haru, PLACES_NURIA.corner, PLACES_NURIA.calleIn, PLACES_NURIA.portal, PLACES_NURIA.calleBack, PLACES_NURIA.mazeIn, PLACES_NURIA.streetBack, PLACES_NURIA.summit, ...PLACES_NURIA.uri, ...FEARS.flatMap(f => f.patrol.map(cell => ({ environment: 'cardedeu-laberinto', cell })))];
  for (const place of places) assert.ok(canWalk(place.cell, ENVIRONMENTS[place.environment].grid), `${place.environment} ${place.cell.x},${place.cell.z}`);
  // Round Nuria at her door (src/story.ts): Uri, Haru and Yuki beside her, and where the party comes home.
  const { x, z } = PLACES_NURIA.nuria.cell;
  for (const cell of [{ x: x - 2, z }, { x: x - 1, z: z + 1 }, { x: x + 1, z: z + 1 }, { x: x - 1, z: z + 2 }]) {
    assert.ok(canWalk(cell, ENVIRONMENTS.cardedeu.grid), `cardedeu ${cell.x},${cell.z} by Nuria's door`);
  }
});

test('Nuria lends the cats: Papagato on trial, the street runs straight to a bubble, and the bubble opens onto Uri\'s tower', () => {
  const story = adult();
  assert.deepEqual(kinds(story.handle({ type: 'arrive', station: 'cardedeu' })).slice(0, 1), ['dialogue']);
  assert.ok(story.has('cardedeu'));
  assert.deepEqual(story.triggers('cardedeu').map(t => t.id), ['haru'], 'Haru waits at the station');
  story.handle({ type: 'near', id: 'haru' });
  assert.deepEqual(story.triggers('cardedeu'), []);
  assert.ok(!story.triggers('cardedeu').some(t => t.id === 'calle'), 'the street is still a street before Nuria asks');
  assert.ok(!story.interactions('cardedeu').some(i => i.id === 'enter-calle'), 'no prompt for it, ever');
  const lent = story.handle({ type: 'interact', id: 'talk-nuria' });
  assert.deepEqual(kinds(lent), ['dialogue', 'anima']);
  assert.ok(story.classes.includes('papagato') && !story.has('papagato'), 'lent, not kept');
  // Walking up from her door turns her street into La calle (src/street-shift.ts): no prompt, no trigger, no cut.
  assert.ok(!story.interactions('cardedeu').some(i => i.id === 'enter-calle'));
  assert.ok(!story.triggers('cardedeu').some(t => t.id === 'calle'), 'the street itself changes, nothing to step on');
  // Haru goes on ahead to that corner, and stops showing the way once it has unrolled before them.
  assert.deepEqual(story.guide('cardedeu')?.to, PLACES_NURIA.corner.cell);
  const up = story.handle({ type: 'near', id: 'calle' });
  assert.deepEqual(kinds(up), ['dialogue'], 'the first time, they notice the street has changed');
  assert.deepEqual(story.handle({ type: 'near', id: 'calle' }), [], 'only once');
  assert.equal(story.guide('cardedeu'), undefined, 'the cats walk with them from then on');
  assert.ok(ENVIRONMENTS['cardedeu-calle'].interactions.some(i => i.id === 'calle-tornar'), 'they can always go back to Nuria');
  assert.deepEqual(story.handle({ type: 'interact', id: 'calle-tornar' })[0].environment, 'cardedeu');
  assert.deepEqual(story.triggers('cardedeu-calle').map(t => t.id), ['portal', 'portal-through']);
  assert.deepEqual(kinds(story.handle({ type: 'near', id: 'portal' })), ['dialogue']);
  assert.deepEqual(story.triggers('cardedeu-calle').map(t => t.id), ['portal-through'], 'the bubble is talked about once');
  assert.ok(!story.interactions('cardedeu-calle').some(i => i.id === 'enter-maze'), 'there is nothing to press');
  const inside = story.handle({ type: 'near', id: 'portal-through' });
  assert.equal(inside[0].environment, 'cardedeu-laberinto');
  assert.deepEqual(inside[1], { kind: 'shout', speaker: 'uri', text: LINES_NURIA.mazeIn }, 'going in, Uri shouts from the top: no dialogue');
  assert.deepEqual(story.handle({ type: 'interact', id: 'salir-laberinto' })[0], { kind: 'travel', environment: 'cardedeu-calle', cell: PLACES_NURIA.calleBack.cell }, 'out of the tower, in front of the bubble');
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => t.id), ['uri-0']);
  assert.deepEqual(story.fears('cardedeu-laberinto').map(f => f.id), FEARS.map(f => f.id));
});

test('the tower: a fear that reaches Gerard starts its fight and stays beaten, Uri climbs ahead, and the summit waits for him', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' }); story.handle({ type: 'near', id: 'portal-through' });
  assert.deepEqual(story.handle({ type: 'near', id: 'summit' }), [], 'Uri is not up there yet');
  const caught = story.handle({ type: 'near', id: 'fear-cebollon' });
  assert.deepEqual(caught.at(-1), { kind: 'battle', encounter: 'cebollon' });
  story.handle({ type: 'battle', won: true, encounter: 'cebollon', worn: ['papagato'] });
  assert.ok(!story.fears('cardedeu-laberinto').some(f => f.id === 'fear-cebollon'));
  // Up out of each ring Uri shouts it from the top, and nothing stops: no dialogue, no halt.
  for (const n of [0, 1, 2]) {
    const trigger = story.triggers('cardedeu-laberinto')[0];
    assert.deepEqual([trigger.id, trigger.passing], [`uri-${n}`, true], 'walked through without stopping');
    assert.deepEqual(story.handle({ type: 'near', id: `uri-${n}` }), [{ kind: 'shout', speaker: 'uri', text: LINES_NURIA.shouts[n] }]);
  }
  assert.deepEqual(story.triggers('cardedeu-laberinto').map(t => [t.id, t.passing]), [['summit', true]]);
  // Onto the platform: Uri calls for his boss in a shout, seen a moment before the fight comes in.
  assert.deepEqual(story.handle({ type: 'near', id: 'summit' }), [{ kind: 'shout', speaker: 'uri', text: LINES_NURIA.roof, beat: 1.5 }, { kind: 'battle', encounter: 'uri-vertigo' }]);
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

test('beating Vertitrón keeps Papagato, the cats and two lights, one for Gerard and one for Aitor', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' });
  const won = story.handle({ type: 'battle', won: true, encounter: 'uri-vertigo', worn: ['papagato'] });
  for (const flag of ['nuria-uri', 'papagato', 'anima-nuria', 'luz-nuria', 'luz-uri']) assert.ok(story.has(flag), flag);
  assert.deepEqual(won.find(e => e.kind === 'lights'), { kind: 'lights', people: ['nuria', 'uri'] });
  assert.equal(story.jar.length, 2, 'two ánimas to spend at home');
  // After the lights, the banner: Papagato is theirs for good.
  const kinds = won.map(e => e.kind);
  assert.ok(kinds.indexOf('anima') > kinds.indexOf('lights'));
  assert.deepEqual(won.find(e => e.kind === 'anima'), { kind: 'anima', classId: 'papagato', kept: true });
  assert.ok(!story.nuria.lent && story.classes.includes('papagato'));
  assert.ok(story.npcs('cardedeu').some(n => n.id === 'uri'), 'Uri is home with Nuria');
  // A friend's mission won: night falls, and the way home is in the dark (src/night.ts).
  assert.ok(story.night, 'night falls after the mission');
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

test('the bubble takes them in as they reach it, anywhere across the street, and not as they come back out', () => {
  const story = adult();
  story.handle({ type: 'interact', id: 'talk-nuria' });
  const through = story.triggers('cardedeu-calle').find(t => t.id === 'portal-through');
  const { portal, calleBack, calleIn } = PLACES_NURIA, grid = ENVIRONMENTS['cardedeu-calle'].grid;
  for (let x = 0; x < grid[0].length; x++) {
    const z = Math.floor(portal.cell.z);
    if (canWalk({ x, z }, grid)) assert.ok(onTrigger(through, { x, z }), `across the street at ${x}`);
  }
  assert.ok(!onTrigger(through, calleBack.cell), 'out of the tower they stand clear of it');
  assert.ok(!onTrigger(through, calleIn.cell));
  const talk = story.triggers('cardedeu-calle').find(t => t.id === 'portal');
  assert.ok(onTrigger(talk, { x: portal.cell.x, z: through.area.d + 1 }), 'they talk about it before they get there');
  assert.equal(new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('clue-r4') + 1)).triggers('cardedeu-calle').length, 0, 'without the cats it does not take them');
});

test('El Cebollón peels a layer a hit and makes everyone cry while it has any', () => {
  const s = createFearBattle(party, 'cebollon');
  const onion = s.foes[0];
  const blow = act(s, 'attack', 'cebollon');
  assert.equal(onion.layers, ONIONS.cebollon.layers - 1);
  assert.equal(blow.peeled, 1);
  s.phase = 'enemy'; enemyAct(s, 'cebollon');
  assert.ok(s.allies.every(a => a.statuses?.llorera === ONIONS.cebollon.cry));
});

test('an onion is smaller and hits softer with every layer it loses, and small with none', () => {
  for (const kind of Object.keys(ONIONS)) {
    for (let layers = ONIONS[kind].layers; layers > 0; layers--) {
      assert.ok(onionSize(kind, layers - 1) < onionSize(kind, layers), `${kind} at ${layers}`);
      assert.ok(onionPower(kind, layers - 1) < onionPower(kind, layers), `${kind} at ${layers}`);
    }
    assert.ok(onionSize(kind, 0) <= .55, `${kind} ends up small`);
  }
  assert.ok(onionSize('cebollita', ONIONS.cebollita.layers) < onionSize('cebolla', ONIONS.cebolla.layers) && onionSize('cebolla', ONIONS.cebolla.layers) < onionSize('cebollon', ONIONS.cebollon.layers), 'three sizes');
  assert.ok(ONIONS.cebollita.layers < ONIONS.cebolla.layers && ONIONS.cebolla.layers < ONIONS.cebollon.layers, 'the bigger, the more layers');
});

test('Zarpazos lands several little hits, one layer each, and a plain blow only one', () => {
  const s = createFearBattle(party, 'cebollon');
  s.levels = { papagato: 2 };
  const onion = s.foes[0], full = onion.layers, hp = onion.hp;
  const claws = act(s, 'skill', 'cebollon', 'zarpazos');
  assert.equal(claws.strikes.length, 4);
  assert.equal(claws.peeled, 4);
  assert.equal(onion.layers, full - 4);
  assert.equal(claws.amount, claws.strikes.reduce((sum, n) => sum + n, 0));
  assert.equal(onion.hp, hp - claws.amount);
  assert.match(s.message, /4 capas menos: quedan 6/);
});

test('Zarpazos needs Papagato at level 2, and its claws stop when the foe falls', () => {
  const s = createFearBattle(party, 'cebollon');
  assert.equal(act(s, 'skill', 'cebollon', 'zarpazos'), undefined, 'not learned yet');
  s.levels = { papagato: 2 };
  s.foes[0].layers = 1; s.foes[0].hp = 3;
  const claws = act(s, 'skill', 'cebollon', 'zarpazos');
  assert.ok(claws.strikes.length < 4, 'no claws on a foe already down');
  assert.equal(claws.peeled, 1, 'it only had one layer');
  assert.equal(s.phase, 'won');
});

test('a big onion falls on everyone while it has layers, and alone once it is peeled; a little one only on its target', () => {
  const s = createFearBattle(party, 'cebollon');
  s.phase = 'enemy'; s.allies[0].guarding = false;
  const full = s.allies.map(a => a.hp);
  const blow = enemyAct(s, 'cebollon', 'gerard');
  assert.equal(blow.target, 'gerard');
  assert.deepEqual(blow.splash.map(h => h.target), ['aitor']);
  assert.ok(blow.splash[0].amount > 0 && blow.splash[0].amount < blow.amount, 'less than the blow itself');
  assert.equal(s.allies.find(a => a.id === 'aitor').hp, full[s.allies.findIndex(a => a.id === 'aitor')] - blow.splash[0].amount);
  const peeled = createFearBattle(party, 'cebollon');
  peeled.foes[0].layers = 0; peeled.phase = 'enemy';
  const soft = enemyAct(peeled, 'cebollon', 'gerard');
  assert.equal(soft.splash, undefined);
  assert.ok(soft.amount < blow.amount / 2, 'peeled, it hits far softer');
});

test('an onion with layers does not catch fire; peeled, it burns', () => {
  const s = createFearBattle(party, 'cebollon');
  const fire = s.allies.find(a => a.id === 'aitor'); s.active = s.allies.indexOf(fire);
  const wet = act(s, 'skill', 'cebollon', 'foc-binari');
  assert.equal(wet.burn, undefined);
  assert.equal(s.foes[0].timed, undefined);
  assert.match(s.message, /no prenden/);
  const bare = createFearBattle(party, 'cebollon');
  bare.foes[0].layers = 0; bare.active = bare.allies.findIndex(a => a.id === 'aitor');
  assert.deepEqual(act(bare, 'skill', 'cebollon', 'foc-binari').burn, { id: 'quemado', level: 1 });
});

test('El Plato Misterioso swaps dishes, and the dish decides what hurts it', () => {
  const s = createFearBattle(party, 'plato');
  assert.equal(s.foes[0].dish, 'alcachofa');
  s.phase = 'enemy'; enemyAct(s, 'plato');
  assert.equal(s.foes[0].dish, 'coliflor');
});

// The tower's foes and Vertitrón (docs/quests/nuria.md § Monsters, § Final boss).
const duo = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
/** One foe's turn now, whatever came before. */
const enemyTurn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
/** The end of a round in which every foe has had its turn. */
const endRound = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); return nextRound(s); };
const roofFight = (p = party) => createFearBattle(p, 'uri-vertigo', undefined, () => .5);
const tough = s => { s.allies.forEach(a => { a.hp = a.maxHp = 9999; }); return s; };
const bodyOf = s => s.foes.find(f => f.kind === 'vertigo');
const eyeOf = s => s.foes.find(f => f.kind === 'vertigo-ojo');

test('Vertitrón comes with its eye: a target with its own PV, no turns, no EXP, never holding up the win', () => {
  const s = tough(roofFight()), body = bodyOf(s), eye = eyeOf(s);
  assert.deepEqual(s.foes.map(f => f.kind), ['vertigo', 'vertigo-ojo']);
  assert.equal(body.name, 'Vertitrón'); assert.equal(eye.name, 'El ojo de Vertitrón');
  assert.ok(eye.part); assert.ok(eyeOpen(s)); assert.ok(eye.hp > 0 && eye.hp < body.hp);
  assert.ok(validTargets(s, 'attack').some(f => f.id === eye.id), 'a normal target');
  assert.equal(fightXp({ foes: [eye] }), 0, 'worth nothing of its own');
  s.phase = 'enemy'; s.enemyActions = [];
  assert.equal(enemyAct(s, eye.id, 'gerard'), undefined, 'it never acts');
  assert.ok(s.enemyActions.includes(eye.id));
  s.enemyActions = [body.id];
  nextRound(s);
  assert.equal(s.round, 2, 'the round never waits for it');
  const hp = body.hp;
  act(s, 'attack', eye.id);
  assert.ok(eye.hp < eye.maxHp); assert.equal(body.hp, hp, 'blows on it leave the body whole');
  // Beating the body wins, its eye whole or not.
  body.hp = 1; s.phase = 'player'; s.active = 0;
  act(s, 'attack', body.id);
  assert.equal(s.phase, 'won'); assert.match(s.message, /cae de rodillas.*Uri baja con Nil/);
});

test('its turns go round: Pisotón on one, Barrido on both, Grito liberador, the eye charging (announced) and the Rayo on both', () => {
  const s = tough(roofFight()), body = bodyOf(s);
  const pisoton = enemyTurn(s, 'vertigo', 'gerard');
  assert.deepEqual(pisoton.ability, { id: 'pisoton', name: 'Pisotón' });
  assert.equal(pisoton.target, 'gerard'); assert.ok(pisoton.amount > 0); assert.ok(!pisoton.splash?.length, 'on one');
  const barrido = enemyTurn(s, 'vertigo', 'aitor');
  assert.equal(barrido.ability.id, 'barrido'); assert.deepEqual([barrido.target, ...barrido.splash.map(h => h.target)], ['aitor', 'gerard'], 'on both');
  const grito = enemyTurn(s, 'vertigo', 'gerard');
  assert.deepEqual(grito.ability, { id: 'grito', name: 'Grito liberador', card: true });
  assert.equal(grito.amount, undefined, 'no blow');
  const carga = enemyTurn(s, 'vertigo', 'gerard');
  assert.equal(carga.ability.id, 'carga'); assert.equal(carga.amount, undefined);
  assert.deepEqual(carga.telegraph, { id: 'rayo', name: 'Rayo terrorífico', at: 'todos' });
  assert.deepEqual(body.intent, { ability: 'rayo', at: 'todos' });
  assert.equal(intentLabel(s, body), 'Rayo terrorífico → todos', 'the chip names the move and whom it is for');
  s.allies.find(a => a.id === 'gerard').guarding = true;
  const rayo = enemyTurn(s, 'vertigo', 'aitor');
  assert.deepEqual(rayo.ability, { id: 'rayo', name: 'Rayo terrorífico', card: true });
  assert.deepEqual([rayo.target, ...rayo.splash.map(h => h.target)], ['aitor', 'gerard'], 'it sweeps both');
  assert.ok(rayo.splash[0].amount < rayo.amount / 2, 'holding on takes two thirds off');
  assert.ok(rayo.amount > pisoton.amount, 'it hits harder than a Pisotón');
  assert.equal(body.intent, undefined);
  assert.equal(enemyTurn(s, 'vertigo', 'gerard').ability.id, 'pisoton', 'and round again');
});

test('Grito liberador: the party loses Fuerza and Magia and Vertitrón gains them, for the rest of the fight, more with every shout', () => {
  const s = tough(roofFight()), body = bodyOf(s), gerard = s.allies.find(a => a.id === 'gerard');
  const before = enemyTurn(s, 'vertigo', 'gerard').amount;
  body.turns = VERTIGO_TURNS.indexOf('grito');
  const grito = enemyTurn(s, 'vertigo', 'gerard');
  assert.deepEqual(grito.stats, [
    { target: 'gerard', way: 'down', stats: ['fuerza', 'magia'] },
    { target: 'aitor', way: 'down', stats: ['fuerza', 'magia'] },
    { target: body.id, way: 'up', stats: ['fuerza', 'magia'] },
  ]);
  assert.deepEqual(statShifts(s, gerard).map(x => [x.stat, x.way, x.amount, x.rounds]), [['fuerza', 'down', VERTIGO.gritoDown, undefined], ['magia', 'down', VERTIGO.gritoDown, undefined]], 'for good: no rounds');
  assert.deepEqual(statShifts(s, body).map(x => [x.stat, x.way, x.amount]), [['fuerza', 'up', VERTIGO.gritoUp], ['magia', 'up', VERTIGO.gritoUp]]);
  for (let i = 0; i < 5; i++) endRound(s);
  assert.equal(statShifts(s, gerard)[0].amount, VERTIGO.gritoDown, 'rounds go by and it stays');
  body.turns = 0;
  assert.ok(enemyTurn(s, 'vertigo', 'gerard').amount > before, 'its Pisotón hits harder now');
  body.turns = VERTIGO_TURNS.indexOf('grito');
  enemyTurn(s, 'vertigo', 'gerard');
  assert.equal(statShifts(s, gerard)[0].amount, 2 * VERTIGO.gritoDown, 'a second shout adds up');
  assert.equal(statShifts(s, body)[0].amount, 2 * VERTIGO.gritoUp);
});

test('the eye is optional, but broken it ends the Rayo: a charge is called off and the charge never comes again', () => {
  const s = tough(roofFight());
  assert.ok(stageMoment(s, 'vertigo-carga'));
  const body = bodyOf(s), eye = eyeOf(s);
  assert.equal(intentLabel(s, body), 'Rayo terrorífico → todos');
  eye.hp = 3;
  const blow = act(s, 'attack', eye.id);
  assert.equal(blow.eye, 'broken'); assert.equal(blow.cancelled, 'rayo');
  assert.equal(body.intent, undefined); assert.ok(!eyeOpen(s));
  assert.match(s.message, /¡El ojo de Vertitrón se apaga! Ya no puede lanzar el Rayo terrorífico\./);
  assert.ok(!validTargets(s, 'attack').some(f => f.id === eye.id), 'no longer a target');
  const moves = [];
  for (let i = 0; i < 9; i++) moves.push(enemyTurn(s, 'vertigo', 'gerard').ability.id);
  assert.ok(!moves.includes('carga') && !moves.includes('rayo'), moves.join());
  assert.deepEqual([...new Set(moves)].sort(), ['barrido', 'grito', 'pisoton']);
});

test('the eye breaks by damage alone, whatever brings it: every foe at once, or bleeding at the round\'s end', () => {
  const all = tough(roofFight(party.map(p => ({ ...p, classId: 'matemagico' }))));
  const eye = eyeOf(all);
  eye.hp = 1;
  const cardioide = SKILLS.find(s => s.side === 'all-foes');
  if (cardioide) {
    all.allies[0].secondary = 9; all.levels = { matemagico: 3 };
    const e = act(all, 'skill', undefined, cardioide.id);
    if (e) assert.equal(e.eye, 'broken');
  }
  const bleed = tough(roofFight()), bleedEye = eyeOf(bleed);
  bleedEye.hp = 1; bleedEye.statuses = { sangrado: 3 };
  endRound(bleed);
  const news = takeNews(bleed);
  assert.equal(bleedEye.hp, 0);
  assert.ok(news.some(n => n.eye === 'broken'), 'told as news');
  assert.ok(!eyeOpen(bleed));
});

test('no rule of Vertitrón asks for a skill or an ánima by name', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/battle.ts', import.meta.url), 'utf8');
  const start = source.indexOf("/** Vertitrón and its eye, in its fight. */"), end = source.indexOf('/** Whether a big onion takes its run-up');
  const rules = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const id of [...SKILLS.map(s => s.id), 'papagato', 'matemagico', 'zarpazos-de-fuego', 'punto-debil']) assert.ok(!rules.includes(`'${id}'`), id);
});

test('the picker stages the boss\'s moments, and El Plato\'s surprise, each only in its own fight', () => {
  assert.deepEqual(Object.keys(STAGED_MOMENTS), ['vertigo-carga', 'vertigo-grito', 'vertigo-sin-ojo', 'plato-sorpresa']);
  const carga = tough(roofFight());
  assert.ok(stageMoment(carga, 'vertigo-carga'));
  assert.equal(carga.phase, 'player'); assert.ok(eyeOpen(carga));
  assert.equal(intentLabel(carga, bodyOf(carga)), 'Rayo terrorífico → todos');
  assert.equal(enemyTurn(carga, 'vertigo', 'gerard').ability.id, 'rayo');
  const grito = tough(roofFight());
  assert.ok(stageMoment(grito, 'vertigo-grito'));
  assert.equal(bodyOf(grito).hp, Math.floor(bodyOf(grito).maxHp / 2));
  assert.equal(statShifts(grito, grito.allies[0])[0].amount, 2 * VERTIGO.gritoDown);
  assert.equal(enemyTurn(grito, 'vertigo', 'gerard').ability.id, 'grito', 'the third shout next');
  const ciego = tough(roofFight());
  assert.ok(stageMoment(ciego, 'vertigo-carga')); assert.ok(stageMoment(ciego, 'vertigo-sin-ojo'));
  assert.ok(!eyeOpen(ciego)); assert.equal(bodyOf(ciego).intent, undefined, 'staged afresh');
  assert.equal(bodyOf(ciego).hp, bodyOf(ciego).maxHp);
  assert.equal(stageMoment(roofFight(), 'plato-sorpresa'), false);
  const plato = createFearBattle(party, 'plato');
  assert.equal(stageMoment(plato, 'vertigo-carga'), false);
  assert.ok(stageMoment(plato, 'plato-sorpresa')); assert.equal(plato.foes[0].dish, 'sorpresa');
});

test('ring 3\'s fear is La Cebolla y los suyos: half peeled, with a fantasmita and a cebollita, its Aplastón first in round 4', () => {
  const s = tough(createFearBattle(party, 'escolta', undefined, () => .5));
  assert.deepEqual(s.foes.map(f => [f.id, f.kind]), [['cebolla', 'cebolla'], ['fantasmita-1', 'fantasmita'], ['cebollita-2', 'cebollita']]);
  assert.equal(s.foes[0].layers, FEAR_RULES.escortLayers);
  assert.equal(s.foes[1].countdown, 3); assert.equal(s.foes[2].layers, 1);
  assert.equal(fightXp(s), 35 + 14 + 10);
  assert.match(s.message, /no viene sola/);
  assert.equal(FEARS[2].id, 'fear-escolta'); assert.equal(FEARS[2].encounter, 'escolta');
  const seen = [];
  for (let round = 1; round <= 4; round++) {
    const turn = enemyTurn(s, 'cebolla', s.allies[0].id);
    seen.push(turn.telegraph ? 'carrerilla' : turn.ability.id);
  }
  assert.deepEqual(seen, ['peso', 'peso', 'carrerilla', 'aplaston']);
  s.foes[0].hp = 0; s.foes[1].hp = 0; s.foes[2].hp = 1; s.phase = 'player'; s.active = 0;
  act(s, 'attack', 'cebollita-2');
  assert.equal(s.phase, 'won'); assert.match(s.message, /se lleva a los suyos/);
});

test('a big onion takes a run-up now and then, looking at someone, and next turn falls on them alone with all its weight', () => {
  const fight = () => tough(createFearBattle(party, 'cebolla'));
  const upTo = s => { for (let turn = 1; turn < FEAR_RULES.aplastonFirst; turn++) assert.equal(enemyTurn(s, 'cebolla', 'gerard').telegraph, undefined); return enemyTurn(s, 'cebolla', 'gerard'); };
  const s = fight();
  const rush = upTo(s);
  assert.equal(rush.ability.id, 'peso'); assert.equal(rush.telegraph.id, 'carrerilla');
  const named = rush.telegraph.target;
  assert.deepEqual(s.foes[0].intent, { ability: 'aplaston', target: named });
  assert.match(s.message, /mira a (Gerard|Aitor)/);
  const layers = s.foes[0].layers;
  const fall = enemyTurn(s, 'cebolla', named === 'gerard' ? 'aitor' : 'gerard');
  assert.equal(fall.ability.id, 'aplaston'); assert.equal(fall.ability.card, true);
  assert.equal(fall.target, named, 'on whom it looked at'); assert.equal(fall.splash, undefined, 'no splash');
  assert.ok(s.allies.every(a => a.statuses?.llorera > 0), 'everyone still cries');
  // Braced, it hurts a third.
  const braced = fight();
  const looked = upTo(braced).telegraph.target;
  braced.allies.find(a => a.id === looked).guarding = true;
  braced.foes[0].layers = layers;
  const soft = enemyTurn(braced, 'cebolla', 'gerard');
  if (looked === named) assert.ok(soft.amount < fall.amount / 2, 'holding on takes two thirds off');
  // Peeled during its run-up, the Aplastón comes to nothing.
  const peeled = fight();
  upTo(peeled);
  peeled.foes[0].layers = 0;
  const nothing = enemyTurn(peeled, 'cebolla', 'gerard');
  assert.equal(nothing.ability.id, 'peso'); assert.match(peeled.message, /la carrerilla se queda en nada/);
  assert.equal(peeled.foes[0].intent, undefined);
  // And again every few turns after.
  const again = fight(); upTo(again); enemyTurn(again, 'cebolla', 'gerard');
  for (let turn = 2; turn < FEAR_RULES.aplastonEvery; turn++) assert.equal(enemyTurn(again, 'cebolla', 'gerard').telegraph, undefined);
  assert.equal(enemyTurn(again, 'cebolla', 'gerard').telegraph.id, 'carrerilla');
});

test('a cebollita peeled bare wraps itself in a new layer on its next turn, once, and hits nobody that turn', () => {
  const s = tough(createBroodBattle(party, 'crias-1', undefined, () => .99));
  const onion = s.foes[0];
  onion.layers = 1;
  act(s, 'attack', onion.id);
  assert.equal(onion.layers, 0); assert.ok(onion.hp > 0);
  assert.deepEqual(onion.intent, { ability: 'capa-nueva' }, 'it shivers: Pelada');
  const grow = enemyTurn(s, onion.id, 'gerard');
  assert.equal(grow.ability.id, 'capa-nueva'); assert.equal(grow.regrown, true); assert.equal(grow.amount, undefined);
  assert.equal(onion.layers, 1); assert.equal(onion.intent, undefined);
  onion.layers = 0;
  assert.equal(enemyTurn(s, onion.id, 'gerard').ability.id, 'peso', 'only once: peeled again, it rolls');
});

test('a platito hurt to half turns its dish over once, spending its turn', () => {
  const s = tough(createBroodBattle(party, 'crias-2', undefined, () => .2));
  const plate = s.foes.find(f => f.kind === 'platito'), dish = plate.dish;
  plate.hp = Math.floor(plate.maxHp * FEAR_RULES.flipAt);
  const flip = enemyTurn(s, plate.id, 'gerard');
  assert.equal(flip.ability.id, 'vuelta'); assert.notEqual(plate.dish, dish); assert.equal(flip.flipped, plate.dish); assert.equal(flip.amount, undefined);
  assert.match(s.message, /le da la vuelta al plato/);
  assert.equal(enemyTurn(s, plate.id, 'gerard').ability.id, 'salpicon');
  assert.equal(plate.dish, flip.flipped, 'only once');
});

test('a fantasmita on its last count goes see-through: blows land at half, magic and duals whole; after «GAME OVER» it is solid again', () => {
  const fight = () => { const s = tough(createFearBattle(duo, 'escolta', undefined, () => .5)); s.levels = { papagato: 2 }; const ghost = s.foes[1]; ghost.hp = ghost.maxHp = 999; return s; };
  const solid = fight(), clear = fight();
  const turn = enemyTurn(clear, 'fantasmita-1', 'gerard'); enemyTurn(clear, 'fantasmita-1', 'gerard');
  assert.equal(clear.foes[1].countdown, 1); assert.ok(clear.foes[1].transparent);
  assert.match(clear.message, /Se vuelve transparente/);
  assert.equal(turn.ability.id, 'atravesar');
  const hit = s => { s.phase = 'player'; s.active = s.allies.findIndex(a => a.id === 'aitor'); return act(s, 'attack', 'fantasmita-1').amount; };
  assert.equal(hit(clear), Math.round(hit(solid) * FEAR_RULES.transparent));
  const burn = s => { s.phase = 'player'; s.active = s.allies.findIndex(a => a.id === 'gerard'); return act(s, 'skill', 'fantasmita-1', 'foc-binari').amount; };
  assert.equal(burn(fight()), burn((() => { const s = fight(); s.foes[1].transparent = true; return s; })()), 'magic whole');
  const dual = s => { s.phase = 'player'; s.active = 0; s.spent = []; return actDual(s, 'zarpazos-de-fuego', 'fantasmita-1').amount; };
  assert.equal(dual(fight()), dual((() => { const s = fight(); s.foes[1].transparent = true; return s; })()), 'a dual whole');
  const blast = enemyTurn(clear, 'fantasmita-1', 'gerard');
  assert.equal(blast.ability.id, 'game-over'); assert.equal(blast.splash.length, 1);
  assert.ok(!clear.foes[1].transparent);
});

test('El Plato Misterioso: on the surprise dish single blows land at half and a dual whole, and its turn splashes everyone (¡Puaj!)', () => {
  const fight = dish => { const s = tough(createFearBattle(duo, 'plato')); s.levels = { papagato: 2 }; s.foes[0].hp = s.foes[0].maxHp = 9999; s.foes[0].dish = dish; return s; };
  const single = dish => act(fight(dish), 'attack', 'plato').amount;
  const dual = dish => actDual(fight(dish), 'zarpazos-de-fuego', 'plato').amount;
  const plain = (() => { const s = fight('sorpresa'); delete s.foes[0].dish; return act(s, 'attack', 'plato').amount; })();
  const plainDual = (() => { const s = fight('sorpresa'); delete s.foes[0].dish; return actDual(s, 'zarpazos-de-fuego', 'plato').amount; })();
  assert.equal(single('sorpresa'), Math.round(plain * FEAR_RULES.sorpresaSingle));
  assert.equal(dual('sorpresa'), plainDual, 'two at once get it in whole');
  assert.equal(dual('coliflor'), dual('alcachofa'), 'a dual always finds the better side of a dish');
  assert.ok(dual('coliflor') > plainDual);
  const s = fight('sorpresa');
  const puaj = enemyTurn(s, 'plato', 'gerard');
  assert.equal(puaj.ability.id, 'puaj'); assert.deepEqual(puaj.splash.map(h => h.target), ['aitor']);
  assert.equal(s.foes[0].dish, 'alcachofa');
  assert.equal(enemyTurn(s, 'plato', 'gerard').ability.id, 'cambio-plato');
});

test('an old run that beat Game Over has beaten what hunts ring 3 now', () => {
  assert.deepEqual(migrateBeaten(['fear-cebollon', 'fear-plato', 'fear-game-over']), ['fear-cebollon', 'fear-plato', 'fear-escolta']);
  const story = adult();
  story.startNuria({ lent: true, beaten: ['fear-cebollon', 'fear-game-over'] });
  assert.deepEqual(story.nuria.beaten, ['fear-cebollon', 'fear-escolta']);
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

test('la calle que no acaba: one way only, straight to the bubble, darker and stranger the further up', () => {
  // The street itself, before lamps and cars take their cells.
  const grid = ENVIRONMENTS['cardedeu-calle'].geo.grid;
  const { calleIn, portal } = PLACES_NURIA;
  assert.equal(calleIn.cell.x, portal.cell.x, 'straight on: the bubble is right ahead');
  // One way: every row is a single run of street, and it narrows as it goes (never wider further up).
  let width = Infinity;
  for (let z = calleIn.cell.z; z >= portal.cell.z; z--) {
    const runs = grid[z].match(/\.+/g) ?? [];
    assert.equal(runs.length, 1, `row ${z} has one way through`);
    assert.ok(runs[0].length <= width, `row ${z} is no wider than the one before`);
    width = runs[0].length;
  }
  assert.equal(streetProgress(calleIn.cell, calleIn.cell, portal.cell), 0);
  assert.equal(streetProgress(portal.cell, calleIn.cell, portal.cell), 1);
  assert.equal(streetProgress({ x: calleIn.cell.x + 2, z: calleIn.cell.z + 3 }, calleIn.cell, portal.cell), 0, 'behind the start counts as the start');
  assert.ok(streetTone(0) < .2 && streetTone(1) > .6 && streetTone(1) < 1 && streetTone(.5) > streetTone(.25), 'her light grows as they go, short of the tower\'s');
  const said = new Set();
  assert.equal(dueMark(STREET_MARKS, 0, said), undefined, 'nothing at the start');
  assert.equal(dueMark(STREET_MARKS, .3, said), 0, 'the first line due first');
  said.add(0); said.add(1);
  assert.equal(dueMark(STREET_MARKS, .3, said), undefined, 'each line once');
  assert.ok(STREET_MARKS.every((m, i) => i === 0 || m.at > STREET_MARKS[i - 1].at), 'in order up the street');
});

