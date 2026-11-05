import test from 'node:test';
import assert from 'node:assert/strict';
import { BROOD, BROOD_ENCOUNTERS, BROOD_RINGS, FEAR_RULES, ONIONS, act, createBroodBattle, enemyAct, nextRound, stacks } from '../src/battle.ts';
import { Story } from '../src/story.ts';
import { FEARS } from '../src/friends/nuria.ts';
import { missionJump } from '../src/story-points.ts';

const party = [
  { id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' },
  { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' },
];
let seed = 3;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('a pack of young is two or three, the ring\'s own first, the rest from its ring and those below', () => {
  for (const encounter of BROOD_ENCOUNTERS) {
    const mixes = new Set();
    for (let i = 0; i < 200; i++) {
      const s = createBroodBattle(party, encounter, undefined, random);
      // Ring 3 sometimes brings La Cebolla along (its own test, below).
      if (s.foes[0].kind === 'cebolla') continue;
      assert.ok(s.foes.length >= 2 && s.foes.length <= 3);
      assert.equal(s.foes[0].kind, BROOD_RINGS[encounter][0]);
      assert.ok(s.foes.every(f => BROOD_RINGS[encounter].includes(f.kind)));
      assert.equal(new Set(s.foes.map(f => f.name)).size, s.foes.length, 'each one has its own name');
      mixes.add(s.foes.map(f => f.kind).join());
    }
    assert.ok(mixes.size >= (encounter === 'crias-1' ? 2 : 3), `${encounter} comes in different mixes`);
  }
});

test('on ring 3 La Cebolla now and then comes up with the young, half peeled: the only pack that mixes them', () => {
  let mixed = 0;
  for (let i = 0; i < 400; i++) {
    const s = createBroodBattle(party, 'crias-3', undefined, random);
    if (s.foes[0].kind !== 'cebolla') continue;
    mixed++;
    const [onion, ...young] = s.foes;
    assert.equal(onion.layers, FEAR_RULES.mixLayers);
    assert.ok(young.length >= 1 && young.length <= 2, 'one or two young with it');
    assert.equal(young[0].kind, 'fantasmita', 'the ring\'s own first');
    assert.ok(young.every(f => BROOD_RINGS['crias-3'].includes(f.kind)));
    assert.equal(new Set(s.foes.map(f => f.id)).size, s.foes.length);
    assert.match(s.message, /La Cebolla/);
  }
  assert.ok(mixed > 400 * FEAR_RULES.mixChance * .6 && mixed < 400 * FEAR_RULES.mixChance * 1.4, `about ${FEAR_RULES.mixChance} of them: ${mixed}`);
  for (const encounter of ['crias-1', 'crias-2']) for (let i = 0; i < 100; i++) assert.ok(!createBroodBattle(party, encounter, undefined, random).foes.some(f => f.kind === 'cebolla'), `${encounter} never`);
});

test('a cebollita with its layer makes whoever it hits cry; a platito keeps a dish with a weakness', () => {
  const s = createBroodBattle(party, 'crias-2', undefined, () => .99);
  const plate = s.foes.find(f => f.kind === 'platito'), onion = s.foes.find(f => f.kind === 'cebollita');
  assert.ok(plate && ['alcachofa', 'coliflor'].includes(plate.dish));
  if (onion) {
    assert.ok(onion.layers >= 1 && onion.layers <= ONIONS.cebollita.layers, 'a layer or two');
    s.phase = 'enemy';
    enemyAct(s, onion.id, 'aitor');
    assert.ok(stacks(s.allies.find(a => a.id === 'aitor'), 'llorera') > 0);
  }
  const dish = plate.dish;
  s.phase = 'enemy'; s.enemyActions = [];
  enemyAct(s, plate.id, 'gerard');
  assert.equal(plate.dish, dish, 'a platito never changes dish');
});

test('a fantasmita counts down on its turns and at zero hits everyone; Defender takes most of it', () => {
  const s = createBroodBattle(party, 'crias-3', undefined, () => .01);
  const ghost = s.foes.find(f => f.kind === 'fantasmita');
  ghost.countdown = 1;
  s.allies[0].guarding = true;
  s.phase = 'enemy';
  enemyAct(s, ghost.id);
  const [held, open] = [s.allies[0], s.allies[1]];
  assert.ok(held.hp < held.maxHp && open.hp < open.maxHp, 'everyone is hit');
  assert.ok(held.maxHp - held.hp < open.maxHp - open.hp, 'holding on hurts less');
  assert.equal(ghost.countdown, BROOD.fantasmita.countdown, 'and it starts counting again');
  // It never comes back to full PV.
  ghost.hp = 5; ghost.countdown = 1; s.enemyActions = s.foes.map(f => f.id);
  nextRound(s);
  assert.equal(ghost.hp, 5);
});

test('the young are beaten for a while only: the story never counts them, and they jump in without a word', () => {
  const jump = missionJump('nuria', 'ring-1');
  const story = new Story(jump.flags);
  story.startNuria(jump.part.nuria);
  const young = FEARS.find(f => f.respawn);
  const effects = story.handle({ type: 'near', id: young.id });
  assert.deepEqual(effects.map(e => e.kind), ['battle']);
  story.handle({ type: 'battle', won: true, encounter: young.encounter, worn: [] });
  assert.ok(story.fears('cardedeu-laberinto').some(f => f.id === young.id), 'still out there');
  story.handle({ type: 'near', id: 'fear-cebollon' });
  story.handle({ type: 'battle', won: true, encounter: 'cebollon', worn: [] });
  assert.ok(!story.fears('cardedeu-laberinto').some(f => f.id === 'fear-cebollon'), 'a fear stays beaten');
});

test('the party can still win against a pack by fighting', () => {
  const s = createBroodBattle(party, 'crias-1', undefined, () => .2);
  for (let i = 0; i < 300 && s.phase !== 'won' && s.phase !== 'lost'; i++) {
    if (s.phase === 'player') act(s, 'attack', s.foes.find(f => f.hp > 0).id);
    else { const next = s.foes.find(f => f.hp > 0 && !s.enemyActions.includes(f.id)); if (next) enemyAct(s, next.id); else nextRound(s); }
  }
  assert.ok(['won', 'lost'].includes(s.phase));
});
