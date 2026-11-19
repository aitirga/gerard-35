import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, diceOf, dieUse, dieSkill, bestDie, validTargets, skillsFor, enemyAct, MANA_POINTS, DEFEND_CHARGE, DICED, DIE_FACES, FACE_SKILLS, SKILLS, CLASS_STATS, COMODIN_CHANCE, COMODIN_AFTER_DUAL } from '../src/battle.ts';

// Dadaísta (docs/animas/dadaista/): its maná is dice, and each face is a move of its own.
const fight = (seed = 7) => { const s = createBattle(1, 1, false, 'dadaista'); s.seed = seed; s.foes[0].hp = s.foes[0].maxHp = 999; return s; };
const gerard = s => s.allies[0];
const throwDie = (hand, at, target = 'dog-0', seed) => { const s = fight(seed); gerard(s).dice = hand; const effect = act(s, 'skill', target, 'tirar-dado', at); return { s, effect }; };

test('Dadaísta holds one die for each point of maná, each showing one of its six faces', () => {
  const s = fight(), hand = diceOf(s, gerard(s));
  assert.equal(DICED, 'dadaista');
  assert.equal(hand.length, MANA_POINTS);
  assert.ok(hand.every(face => DIE_FACES.includes(face) || face === 'comodin'));
  assert.deepEqual([...DIE_FACES].sort(), ['blanco', 'corchete', 'mano', 'mano', 'ojo', 'tijeras']);
  assert.equal(diceOf(s, gerard(s)), hand, 'looking again does not roll again');
  assert.deepEqual(diceOf(createBattle(1, 1, false, 'matemagico'), gerard(createBattle(1, 1, false, 'matemagico'))), [], 'nobody else has dice');
  assert.deepEqual(skillsFor(s, gerard(s)).map(skill => skill.id), ['tirar-dado'], 'one skill: the faces are reached by the die, never listed');
  assert.equal(Object.values(CLASS_STATS.dadaista).reduce((sum, n) => sum + n, 0), 4);
});

test('Tirar dado spends the die chosen and does what its face says', () => {
  const hand = throwDie(['mano', 'tijeras', 'ojo'], 0);
  assert.deepEqual(hand.effect.die, { face: 'mano', at: 0, as: 'mano' });
  assert.equal(hand.effect.skill, 'cara-mano');
  assert.ok(hand.effect.amount > 30, `a hand lands hard: ${hand.effect.amount}`);
  assert.deepEqual(gerard(hand.s).dice, ['tijeras', 'ojo'], 'the die spent is gone, the others keep their faces');
  assert.equal(gerard(hand.s).secondary, MANA_POINTS - 1);
  // Scissors: a lighter blow that leaves Sangrado.
  const cut = throwDie(['mano', 'tijeras', 'ojo'], 1);
  assert.equal(cut.effect.skill, 'cara-tijeras');
  assert.equal(cut.effect.status.id, 'sangrado');
  assert.ok(cut.effect.amount < hand.effect.amount);
  assert.deepEqual(gerard(cut.s).dice, ['mano', 'ojo']);
});

test('the eye leaves Punto débil: the next blow on that foe does triple', () => {
  const { s, effect } = throwDie(['ojo', 'mano', 'mano'], 0);
  assert.equal(effect.weakSpot, 'set');
  assert.ok(s.foes[0].weakSpot >= s.round);
  const plain = throwDie(['mano', 'mano', 'mano'], 0).effect.amount;
  // The next turn, a hand on the marked foe.
  s.phase = 'player'; s.active = 0;
  const marked = act(s, 'skill', 'dog-0', 'tirar-dado', 0);
  assert.equal(marked.weakSpot, 'spent');
  assert.ok(marked.amount >= plain * 2.5, `${marked.amount} against ${plain}`);
});

test('the brackets protect an ally until the round ends, and aim at the party, not the foes', () => {
  const s = fight(); gerard(s).dice = ['corchete', 'mano', 'mano'];
  assert.equal(dieSkill(s, 0), 'cara-corchete');
  assert.deepEqual(validTargets(s, 'skill', 'tirar-dado', 0).map(c => c.id), ['gerard']);
  assert.deepEqual(validTargets(s, 'skill', 'tirar-dado', 1).map(c => c.id), ['dog-0']);
  assert.equal(act(s, 'skill', 'dog-0', 'tirar-dado', 0), undefined, 'not on a foe');
  const effect = act(s, 'skill', 'gerard', 'tirar-dado', 0);
  assert.equal(effect.guarded, true);
  assert.equal(gerard(s).guarding, true);
  // A foe's blow on a protected ally takes a third.
  const before = gerard(s).hp;
  enemyAct(s, 'dog-0');
  assert.ok(before - gerard(s).hp <= Math.ceil(s.foes[0].stats.fuerza), 'the blow is cut down');
});

test('a blank repeats the last face spent; with none spent yet it can do nothing', () => {
  const s = fight(); gerard(s).dice = ['blanco', 'tijeras', 'mano'];
  assert.equal(dieSkill(s, 0), undefined);
  assert.deepEqual(validTargets(s, 'skill', 'tirar-dado', 0), []);
  assert.equal(act(s, 'skill', 'dog-0', 'tirar-dado', 0), undefined, 'a blank with nothing to repeat stays in the hand');
  act(s, 'skill', 'dog-0', 'tirar-dado', 1);
  assert.equal(gerard(s).lastFace, 'tijeras');
  s.phase = 'player'; s.active = 0;
  assert.equal(dieSkill(s, 0), 'cara-tijeras');
  const again = act(s, 'skill', 'dog-0', 'tirar-dado', 0);
  assert.deepEqual(again.die, { face: 'blanco', at: 0, as: 'tijeras' });
  assert.equal(again.status.id, 'sangrado');
});

test('with no die chosen it takes a hand first, then scissors, then the eye, and skips what can do nothing', () => {
  assert.equal(dieUse('tirar-dado'), true); assert.equal(dieUse('foc-binari'), false);
  const pick = hand => { const s = fight(); gerard(s).dice = hand; gerard(s).secondary = hand.length; return bestDie(s); };
  assert.equal(pick(['ojo', 'tijeras', 'mano']), 2);
  assert.equal(pick(['corchete', 'ojo', 'tijeras']), 2);
  assert.equal(pick(['blanco', 'corchete']), 1, 'a blank with nothing to repeat is never taken');
  const s = fight(); gerard(s).dice = ['ojo', 'mano', 'tijeras'];
  assert.equal(act(s, 'skill', 'dog-0', 'tirar-dado').die.face, 'mano');
});

test('Defender deals Dadaísta new dice, and a hand with none left cannot throw', () => {
  const s = fight(); gerard(s).dice = ['ojo']; gerard(s).secondary = 1;
  const effect = act(s, 'defend');
  assert.equal(effect.charged, DEFEND_CHARGE);
  assert.equal(effect.dealt.length, DEFEND_CHARGE);
  assert.deepEqual(gerard(s).dice, ['ojo', ...effect.dealt], 'the die held keeps its face');
  const empty = fight(); gerard(empty).dice = []; gerard(empty).secondary = 0;
  assert.equal(act(empty, 'skill', 'dog-0', 'tirar-dado'), undefined);
  assert.equal(empty.phase, 'player');
});

test('Tirar dado is abstract (it does what its die says); every face has a move with a plain description', () => {
  assert.equal(SKILLS.find(skill => skill.id === 'tirar-dado').abstract, true);
  for (const id of Object.values(FACE_SKILLS)) { const skill = SKILLS.find(s => s.id === id); assert.ok(skill && !skill.abstract && 'face' in skill, id); }
  assert.equal(SKILLS.some(skill => skill.id === 'doble-o-nada'), false, 'Doble o nada is gone');
});

test('the Comodín lands a hand on every foe standing, goes first, and a blank after it repeats a hand on one', () => {
  const s = createBattle(1, 3, false, 'dadaista'); s.seed = 7;
  for (const foe of s.foes) foe.hp = foe.maxHp = 999;
  gerard(s).dice = ['mano', 'comodin', 'blanco']; gerard(s).secondary = 3;
  assert.equal(bestDie(s), 1, 'the Comodín before a hand');
  assert.equal(dieSkill(s, 1), 'cara-comodin');
  assert.deepEqual(validTargets(s, 'skill', 'tirar-dado', 1).map(c => c.id).sort(), s.foes.map(f => f.id).sort());
  const effect = act(s, 'skill', 'dog-0', 'tirar-dado', 1);
  assert.deepEqual(effect.die, { face: 'comodin', at: 1, as: 'comodin' });
  assert.equal(effect.hits.length, 3, 'every foe standing');
  assert.ok(effect.hits.every(h => h.amount > 30), `a hand's blow on each: ${effect.hits.map(h => h.amount)}`);
  assert.equal(gerard(s).secondary, 2, 'one die, one point of maná');
  assert.equal(gerard(s).lastFace, 'mano', 'the star is not repeated');
  s.phase = 'player'; s.active = 0;
  assert.equal(dieSkill(s, 1), 'cara-mano', 'the blank repeats a hand');
});

test('the Comodín comes rarely, and more often in the first die after a dual', () => {
  const share = due => {
    let comodin = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const s = fight(seed); gerard(s).dice = []; gerard(s).secondary = 1; if (due) gerard(s).comodinDue = true;
      if (diceOf(s, gerard(s))[0] === 'comodin') comodin++;
      assert.equal(gerard(s).comodinDue, undefined, 'only the next die is called');
    }
    return comodin / 3000;
  };
  const plain = share(false), called = share(true);
  assert.ok(Math.abs(plain - COMODIN_CHANCE) < .015, `plain ${plain}`);
  assert.ok(Math.abs(called - COMODIN_AFTER_DUAL) < .04, `after a dual ${called}`);
  assert.ok(!DIE_FACES.includes('comodin'), 'it is not a face of the die');
});
