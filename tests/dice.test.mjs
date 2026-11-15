import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, diceOf, dieUse, bestDie, diePower, skillsFor, MANA_POINTS, DEFEND_CHARGE, DICED, SKILLS, CLASS_STATS } from '../src/battle.ts';

// Dadaísta (docs/animas/dadaista/): its maná is dice, and the die spent says how hard the blow is.
const fight = (seed = 7) => { const s = createBattle(1, 1, false, 'dadaista'); s.seed = seed; s.foes[0].hp = s.foes[0].maxHp = 999; return s; };
const gerard = s => s.allies[0];

test('Dadaísta holds one die for each point of maná, each with a face from 1 to 6', () => {
  const s = fight(), hand = diceOf(s, gerard(s));
  assert.equal(DICED, 'dadaista');
  assert.equal(hand.length, MANA_POINTS);
  assert.ok(hand.every(face => Number.isInteger(face) && face >= 1 && face <= 6));
  assert.equal(diceOf(s, gerard(s)), hand, 'looking again does not roll again');
  assert.deepEqual(diceOf(createBattle(1, 1, false, 'matemagico'), gerard(createBattle(1, 1, false, 'matemagico'))), [], 'nobody else has dice');
  assert.deepEqual(skillsFor(s, gerard(s)).map(skill => skill.id), ['golpe-dados', 'doble-o-nada']);
  assert.equal(Object.values(CLASS_STATS.dadaista).reduce((sum, n) => sum + n, 0), 4);
});

test('Golpe de dados spends the die chosen, and a higher face lands harder', () => {
  const blow = face => { const s = fight(); gerard(s).dice = [face, 1, 1]; const effect = act(s, 'skill', 'dog-0', 'golpe-dados', 0); return { s, effect }; };
  const low = blow(1), high = blow(6);
  assert.deepEqual(low.effect.die, { face: 1, at: 0 });
  assert.deepEqual(high.effect.die, { face: 6, at: 0 });
  assert.ok(high.effect.amount > low.effect.amount * 2, `${high.effect.amount} against ${low.effect.amount}`);
  assert.deepEqual(gerard(high.s).dice, [1, 1], 'the die spent is gone, the others keep their faces');
  assert.equal(gerard(high.s).secondary, MANA_POINTS - 1);
  // The second die of the hand, not the first.
  const s = fight(); gerard(s).dice = [2, 5, 3];
  assert.deepEqual(act(s, 'skill', 'dog-0', 'golpe-dados', 1).die, { face: 5, at: 1 });
  assert.deepEqual(gerard(s).dice, [2, 3]);
  assert.equal(diePower('golpe-dados', 6), 36); assert.equal(diePower('golpe-dados', 1), 11);
});

test('with no die chosen a blow takes the highest, and a bet the highest of the sure ones', () => {
  assert.equal(dieUse('golpe-dados'), 'face'); assert.equal(dieUse('doble-o-nada'), 'bet'); assert.equal(dieUse('foc-binari'), undefined);
  assert.equal(bestDie('golpe-dados', [2, 6, 4]), 1);
  assert.equal(bestDie('doble-o-nada', [6, 3, 2]), 1);
  assert.equal(bestDie('doble-o-nada', [6, 5, 4]), 2);
  const s = fight(); gerard(s).dice = [2, 6, 4];
  assert.equal(act(s, 'skill', 'dog-0', 'golpe-dados').die.face, 6);
});

test('Doble o nada rolls the die again: the same or more lands twice, less is no blow and the die stays', () => {
  // A bet on a one cannot be lost.
  const sure = fight(); gerard(sure).dice = [1, 4, 4];
  const single = (() => { const s = fight(); gerard(s).dice = [1, 4, 4]; return act(s, 'skill', 'dog-0', 'golpe-dados', 0).amount; })();
  const won = act(sure, 'skill', 'dog-0', 'doble-o-nada', 0);
  assert.equal(won.die.won, true); assert.equal(won.die.face, 1); assert.ok(won.die.rolled >= 1);
  assert.equal(won.amount, single * 2, 'the blow of that face, twice');
  assert.deepEqual(gerard(sure).dice, [4, 4]); assert.equal(gerard(sure).secondary, MANA_POINTS - 1);
  // A bet on a six is lost five times in six: find a seed that loses it.
  let lost;
  for (let seed = 1; seed < 40 && !lost; seed++) {
    const s = fight(seed); gerard(s).dice = [6, 2, 2];
    const effect = act(s, 'skill', 'dog-0', 'doble-o-nada', 0);
    if (!effect.die.won) lost = { s, effect };
  }
  assert.ok(lost, 'some bet on a six is lost');
  assert.equal(lost.effect.amount, 0);
  assert.equal(lost.s.foes[0].hp, 999);
  assert.deepEqual(gerard(lost.s).dice, [lost.effect.die.rolled, 2, 2], 'the die stays in the hand with what it rolled');
  assert.ok(lost.effect.die.rolled < 6);
  assert.equal(gerard(lost.s).secondary, MANA_POINTS, 'no maná gone');
  assert.equal(lost.s.phase, 'enemy', 'the turn is gone all the same');
});

test('Defender deals Dadaísta new dice, and a hand with none left cannot throw', () => {
  const s = fight(); gerard(s).dice = [3]; gerard(s).secondary = 1;
  const effect = act(s, 'defend');
  assert.equal(effect.charged, DEFEND_CHARGE);
  assert.equal(effect.dealt.length, DEFEND_CHARGE);
  assert.deepEqual(gerard(s).dice, [3, ...effect.dealt], 'the die held keeps its face');
  const empty = fight(); gerard(empty).dice = []; gerard(empty).secondary = 0;
  assert.equal(act(empty, 'skill', 'dog-0', 'golpe-dados'), undefined);
  assert.equal(empty.phase, 'player');
});

test('both of Dadaísta\'s skills are marked abstract: what they land depends on the die', () => {
  for (const id of ['golpe-dados', 'doble-o-nada']) assert.equal(SKILLS.find(skill => skill.id === id).abstract, true);
});
