import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, diceOf, dieUse, faceUse, dieSkill, bestDie, spareDie, shake, shakesLeft, rachaOf, rainCount, meteorOf, RAIN, critChance, statShifts, wearAnima, improve, validTargets, skillsFor, enemyAct, MANA_POINTS, DEFEND_CHARGE, DICED, DIE_FACES, FACE_SKILLS, SKILLS, CLASS_STATS, COMODIN_CHANCE, COMODIN_AFTER_DUAL, RACHA, SHAKES } from '../src/battle.ts';

// Dadista (docs/animas/dadaista/): its maná is dice, and each face is a move of its own.
const fight = (seed = 7) => { const s = createBattle(1, 1, false, 'dadaista'); s.seed = seed; s.foes[0].hp = s.foes[0].maxHp = 999; return s; };
const gerard = s => s.allies[0];
const throwDie = (hand, at, target = 'dog-0', seed) => { const s = fight(seed); gerard(s).dice = hand; const effect = act(s, 'skill', target, 'tirar-dado', at); return { s, effect }; };

test('Dadista holds one die for each point of maná, each showing one of its six faces', () => {
  const s = fight(), hand = diceOf(s, gerard(s));
  assert.equal(DICED, 'dadaista');
  assert.equal(hand.length, MANA_POINTS);
  assert.ok(hand.every(face => DIE_FACES.includes(face) || face === 'comodin'));
  assert.deepEqual([...DIE_FACES].sort(), ['blanco', 'corchete', 'mano', 'mano', 'ojo', 'tijeras']);
  assert.equal(diceOf(s, gerard(s)), hand, 'looking again does not roll again');
  assert.deepEqual(diceOf(createBattle(1, 1, false, 'matemagico'), gerard(createBattle(1, 1, false, 'matemagico'))), [], 'nobody else has dice');
  assert.deepEqual(skillsFor(s, gerard(s)).map(skill => skill.id), ['tirar-dado'], 'one skill: the faces are reached by the die, never listed');
  assert.deepEqual(CLASS_STATS.dadaista, { fuerza: 2, magia: 2, critico: 10, defensa: -1 }, 'both hands and luck, and it stands worse');
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

test('Defender deals Dadista new dice, and a hand with none left cannot throw', () => {
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

// Racha (docs/animas/dadaista/ § Racha): the ánima's own rule from level 1, and what Agitar and Estrella fugaz hang from.
const grown = (level, seed = 7) => { const s = fight(seed); s.levels = { dadaista: level }; return s; };

test('Racha: every die spent adds one and each point is more Crítico; Atacar and Defender keep it', () => {
  const s = fight(), g = gerard(s), foe = s.foes[0];
  g.dice = ['mano', 'ojo', 'tijeras'];
  const base = critChance(s, g, foe);
  assert.equal(rachaOf(g), 0);
  assert.deepEqual(statShifts(s, g), [], 'no Racha yet: nothing over them');
  const first = act(s, 'skill', foe.id, 'tirar-dado', 0);
  assert.equal(rachaOf(g), 1); assert.equal(first.racha, 1, 'the effect says where the Racha is now');
  assert.equal(critChance(s, g, foe), base + RACHA.crit);
  assert.deepEqual(statShifts(s, g).map(({ stat, way, amount }) => ({ stat, way, amount })), [{ stat: 'critico', way: 'up', amount: RACHA.crit }]);
  s.phase = 'player'; s.active = 0;
  assert.equal(act(s, 'attack', foe.id).racha, undefined, 'Atacar spends no die: the Racha does not move');
  s.phase = 'player'; s.active = 0;
  act(s, 'defend');
  assert.equal(rachaOf(g), 1, 'nor does Defender, and it keeps it');
  s.phase = 'player'; s.active = 0;
  act(s, 'skill', foe.id, 'tirar-dado', 0);
  assert.equal(rachaOf(g), 2); assert.equal(critChance(s, g, foe), base + 2 * RACHA.crit);
});

test('Racha is lost on taking Dadista off and on falling', () => {
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'dadaista', kit: ['dadaista', 'matemagico'] }];
  const s = createBattle(party, 1, false, undefined, ['dadaista', 'matemagico']), g = gerard(s);
  g.racha = 4;
  assert.equal(rachaOf(g), 4);
  assert.ok(wearAnima(s, 'matemagico'));
  assert.equal(rachaOf(g), 0);
  assert.ok(wearAnima(s, 'dadaista'));
  assert.equal(rachaOf(g), 0, 'putting it back on starts from nothing');
  const fallen = fight(), f = gerard(fallen);
  f.racha = 3; f.hp = 1; fallen.phase = 'enemy';
  enemyAct(fallen, fallen.foes[0].id);
  assert.equal(f.hp, 0); assert.equal(f.racha, undefined);
});

test('Agitar comes at level 2: the hand thrown again, the turn kept, once a fight', () => {
  assert.deepEqual(skillsFor(fight(), gerard(fight())).map(skill => skill.id), ['tirar-dado']);
  assert.equal(shake(fight()), undefined, 'not known at level 1');
  const s = grown(2), g = gerard(s);
  assert.deepEqual(skillsFor(s, g).map(skill => skill.id), ['tirar-dado', 'agitar']);
  assert.equal(shakesLeft(s, g), SHAKES);
  assert.deepEqual(validTargets(s, 'skill', 'agitar'), [], 'it reaches nobody');
  assert.equal(act(s, 'skill', undefined, 'agitar'), undefined, 'and it is not an action');
  g.dice = ['blanco', 'blanco', 'blanco'];
  const got = shake(s);
  assert.equal(got.faces.length, 3); assert.equal(got.comodin, undefined, 'no Racha: no Comodín given');
  assert.deepEqual(g.dice, got.faces); assert.notDeepEqual(g.dice, ['blanco', 'blanco', 'blanco']);
  assert.equal(g.secondary, MANA_POINTS, 'no die is spent');
  assert.equal(s.phase, 'player'); assert.equal(s.active, 0, 'the turn is still theirs');
  assert.equal(shakesLeft(s, g), 0); assert.equal(shake(s), undefined, 'once a fight');
  // With its node at the jar, twice.
  const twice = grown(2); improve(twice, { passives: ['otra-vez'] });
  assert.equal(shakesLeft(twice, gerard(twice)), SHAKES + 1);
  assert.ok(shake(twice)); assert.ok(shake(twice)); assert.equal(shake(twice), undefined);
  // An empty hand has nothing to shake, and keeps its use.
  const empty = grown(2); gerard(empty).secondary = 0;
  assert.equal(shake(empty), undefined); assert.equal(shakesLeft(empty, gerard(empty)), SHAKES);
});

test('Agitar with Racha enough gives one Comodín', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = grown(2, seed), g = gerard(s);
    g.racha = RACHA.comodin;
    const got = shake(s);
    assert.equal(g.dice.filter(face => face === 'comodin').length, 1, `seed ${seed}: ${g.dice}`);
    if (got.comodin !== undefined) assert.equal(g.dice[got.comodin], 'comodin');
    const short = grown(2, seed); gerard(short).racha = RACHA.comodin - 1;
    assert.equal(shake(short).comodin, undefined);
  }
});

test('Estrella fugaz comes at level 3, is paid with the die chosen and leaves the last face alone', () => {
  const spec = SKILLS.find(skill => skill.id === 'estrella-fugaz');
  assert.ok(dieUse('estrella-fugaz')); assert.ok(!faceUse('estrella-fugaz')); assert.ok(faceUse('tirar-dado'));
  assert.equal(spec.kind, 'magic'); assert.ok(!('element' in spec), 'the astral is magic of no element');
  assert.ok(!skillsFor(grown(2), gerard(grown(2))).some(skill => skill.id === 'estrella-fugaz'));
  const s = grown(3), g = gerard(s), foe = s.foes[0];
  assert.deepEqual(skillsFor(s, g).map(skill => skill.id), ['tirar-dado', 'agitar', 'estrella-fugaz']);
  g.dice = ['mano', 'blanco', 'corchete'];
  assert.equal(spareDie(s), 1, 'with nobody choosing it gives up what is worth least: a blank with nothing to repeat');
  assert.deepEqual(validTargets(s, 'skill', 'estrella-fugaz').map(f => f.id), [foe.id]);
  const effect = act(s, 'skill', foe.id, 'estrella-fugaz', 2);
  assert.deepEqual(effect.die, { face: 'corchete', at: 2 }, 'the die pays: its face does nothing');
  assert.equal(effect.skill, 'estrella-fugaz'); assert.ok(effect.amount > 0);
  assert.deepEqual(g.dice, ['mano', 'blanco']); assert.equal(g.secondary, MANA_POINTS - 1);
  assert.equal(g.lastFace, undefined, 'a blank still has nothing to repeat');
  assert.equal(rachaOf(g), 1, 'and the die counts for the Racha'); assert.equal(effect.starred, undefined);
});

test('Estrella fugaz with Racha enough spends it and deals two dice, as far as the hand has room', () => {
  const s = grown(3), g = gerard(s), foe = s.foes[0];
  g.dice = ['mano']; g.secondary = 1; g.racha = RACHA.star - 1;
  const effect = act(s, 'skill', foe.id, 'estrella-fugaz', 0);
  assert.equal(effect.starred, RACHA.star, 'its own die counts: two and this one make three');
  assert.equal(rachaOf(g), 0); assert.equal(effect.racha, 0);
  assert.equal(g.secondary, RACHA.deal); assert.equal(effect.dealt.length, RACHA.deal); assert.deepEqual(g.dice, effect.dealt);
  // A hand nearly full only takes what fits.
  const full = grown(3), f = gerard(full);
  f.dice = ['mano', 'mano', 'mano']; f.racha = 5;
  const tight = act(full, 'skill', full.foes[0].id, 'estrella-fugaz', 0);
  assert.equal(f.secondary, MANA_POINTS); assert.equal(tight.dealt.length, 1); assert.equal(rachaOf(f), 6 - RACHA.star);
});

test('level 4 gives Dadista one more point of maná, so one more die', () => {
  const s = grown(4);
  improve(s, undefined);
  assert.equal(gerard(s).maxSecondary, MANA_POINTS + 1);
  assert.equal(diceOf(s, gerard(s)).length, MANA_POINTS + 1);
  const young = grown(3);
  improve(young, undefined);
  assert.equal(gerard(young).maxSecondary, MANA_POINTS);
});

test('Dados astrales: a die pays for a rain, more dice the more Crítico, and the Racha starts again', () => {
  const s = createBattle(1, 3, false, 'dadaista'); s.seed = 7; s.levels = { dadaista: 4 };
  for (const foe of s.foes) foe.hp = foe.maxHp = 999;
  const g = gerard(s);
  g.dice = ['mano', 'ojo']; g.secondary = 2;
  assert.equal(rainCount(s, g), RAIN.least, 'a bare Crítico still drops two');
  g.racha = 6;
  // Its own die counts: seven of Racha and the ánima's Crítico.
  const expected = Math.floor((critChance(s, g, s.foes[0]) + RACHA.crit) / RAIN.per);
  const effect = act(s, 'skill', undefined, 'dados-astrales', 1);
  assert.deepEqual(effect.die, { face: 'ojo', at: 1 }); assert.deepEqual(g.dice, ['mano']);
  assert.equal(effect.rain.length, expected); assert.ok(expected > RAIN.least);
  assert.ok(effect.rain.every(drop => drop.amount > 0 && s.foes.some(f => f.id === drop.target)));
  assert.equal(effect.amount, effect.rain.reduce((sum, drop) => sum + drop.amount, 0));
  assert.equal(effect.hits.reduce((sum, hit) => sum + hit.amount, 0), effect.amount, 'one total for each foe it fell on');
  assert.equal(effect.crit, undefined, 'none of them is a golpe crítico');
  assert.equal(rachaOf(g), 0); assert.equal(effect.starred, 7); assert.equal(effect.racha, 0);
});

test('Dados astrales never drops more than its most, and stops when nobody is left standing', () => {
  const s = grown(4), g = gerard(s);
  g.dice = ['mano']; g.secondary = 1; g.racha = 40;
  assert.equal(rainCount(s, g), RAIN.most);
  s.foes[0].hp = 1;
  const effect = act(s, 'skill', undefined, 'dados-astrales', 0);
  assert.equal(effect.rain.length, 1); assert.equal(s.phase, 'won');
});

test('Ases en dúo is paid with two dice and counts everyone\'s Crítico twice for three rounds', () => {
  const s = grown(5), g = gerard(s), foe = s.foes[0];
  g.dice = ['mano', 'blanco', 'corchete']; g.secondary = 3;
  const base = critChance(s, g, foe);
  const effect = act(s, 'skill', undefined, 'ases-en-duo', 2);
  assert.deepEqual(effect.die, { face: 'corchete', at: 2 }); assert.deepEqual(effect.paid, ['blanco'], 'the second is the one worth least');
  assert.deepEqual(g.dice, ['mano']); assert.equal(g.secondary, 1);
  assert.equal(rachaOf(g), 2, 'both dice count for the Racha');
  assert.equal(critChance(s, g, foe), (base + 2 * RACHA.crit) * 2);
  assert.ok(statShifts(s, g).some(shift => shift.stat === 'critico' && shift.way === 'up' && shift.rounds === 3));
  s.phase = 'player'; s.active = 0;
  assert.deepEqual(validTargets(s, 'skill', 'ases-en-duo'), [], 'not again while it lasts');
  const poor = grown(5); gerard(poor).dice = ['mano']; gerard(poor).secondary = 1;
  assert.equal(act(poor, 'skill', undefined, 'ases-en-duo', 0), undefined, 'one die is not enough');
});

test('the meteor is one skill that grows when it is used turn after turn, and anything else puts it back', () => {
  const s = createBattle(1, 2, false, 'dadaista'); s.seed = 7; s.levels = { dadaista: 7 };
  for (const foe of s.foes) foe.hp = foe.maxHp = 9999;
  const g = gerard(s), foe = s.foes[0], again = () => { s.phase = 'player'; s.active = 0; };
  const listed = () => skillsFor(s, g).filter(skill => 'meteor' in skill).map(skill => skill.id);
  g.dice = ['mano', 'mano', 'mano', 'mano', 'mano', 'mano']; g.secondary = g.maxSecondary = 6;
  assert.deepEqual(listed(), ['meteorito']); assert.equal(meteorOf(g), 0);
  assert.equal(act(s, 'skill', foe.id, 'meteoro', 0), undefined, 'not before it has grown');
  const first = act(s, 'skill', foe.id, 'meteorito', 0);
  assert.equal(first.meteor, 1); assert.equal(g.secondary, 5); again();
  assert.deepEqual(listed(), ['meteoro']);
  const second = act(s, 'skill', foe.id, 'meteoro', 0);
  assert.ok(second.amount > first.amount); assert.equal(second.paid.length, 1); assert.equal(g.secondary, 3); again();
  assert.deepEqual(listed(), ['asteroide']);
  const third = act(s, 'skill', undefined, 'asteroide', 0);
  assert.equal(third.hits.length, 2, 'on every foe'); assert.equal(third.paid.length, 2); assert.equal(g.secondary, 0);
  assert.equal(third.meteor, 0); assert.equal(rachaOf(g), 6, 'every die it cost counts for the Racha'); again();
  assert.deepEqual(listed(), ['meteorito']);
  // Atacar between two of them breaks it.
  g.dice = ['mano', 'mano']; g.secondary = 2;
  act(s, 'skill', foe.id, 'meteorito', 0); again();
  assert.equal(act(s, 'attack', foe.id).meteor, 0); again();
  assert.deepEqual(listed(), ['meteorito']);
});

// The hand up to six (docs/animas/dadaista/README.md § The hand's size) and Objeto encontrado, Dadista's level 6.
import { HAND, FOUND, foundOf, pastCap, PASSIVES, TIMED, fromTheTop, changeAnima } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';
const PAIR = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'dadaista' }];
const wet = () => ({ mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } });
/** Gerard with fire and Aitor in Dadista at `level`, against three sturdy wet dogs; Aitor's hand full. */
function found(level = 6) {
  const s = createBattle(PAIR, 3, false, undefined, ['matemagico', 'dadaista']); s.seed = 11; s.levels = { dadaista: level };
  improve(s, improvedBy(['matemagico:fuego']));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; f.timed = wet(); });
  return s;
}
const ally = (s, id) => s.allies.find(a => a.id === id);
/** Gerard sets fire to a wet dog: Vapor, a reaction. */
const steam = (s, target = 'dog-0') => { s.phase = 'player'; s.active = 0; delete s.spent; delete s.queued; ally(s, 'gerard').element = 'fuego'; return act(s, 'attack', target); };

test('Objeto encontrado: with the hand full, a partner\'s reaction deals its wearer a die past the cap, once a round', () => {
  assert.equal(PASSIVES['objeto-encontrado'].anima, 'dadaista'); assert.equal(PASSIVES['objeto-encontrado'].level, FOUND.level);
  assert.deepEqual(FOUND, { level: 6, perRound: 1, top: 6 }); assert.equal(HAND.most, 6);
  const s = found(), a = ally(s, 'aitor'), cap = a.maxSecondary;
  assert.equal(foundOf(s), a); assert.equal(a.secondary, cap);
  const first = steam(s);
  assert.equal(first.reaction.id, 'vapor');
  assert.equal(a.secondary, cap + 1, 'a die past the cap'); assert.equal(diceOf(s, a).length, cap + 1);
  assert.deepEqual(first.found, { who: 'aitor', dealt: diceOf(s, a).slice(-1) });
  assert.ok(first.passives.some(p => p.id === 'objeto-encontrado' && p.who === 'aitor'));
  const second = steam(s, 'dog-1');
  assert.equal(second.reaction.id, 'vapor'); assert.equal(second.found, undefined, 'once a round'); assert.equal(a.secondary, cap + 1);
  // Next round, again, and never past six.
  s.round++; steam(s, 'dog-2'); assert.equal(a.secondary, Math.min(HAND.most, cap + 2));
  a.secondary = HAND.most; s.round++; s.foes[0].timed = wet();
  assert.equal(steam(s).found, undefined, 'six is the most'); assert.equal(a.secondary, HAND.most); assert.equal(diceOf(s, a).length, HAND.most);
});

test('Objeto encontrado gives nothing below the cap, below level 6, or to someone not wearing Dadista', () => {
  const half = found(); ally(half, 'aitor').secondary = 2;
  assert.equal(steam(half).found, undefined, 'a hand not full'); assert.equal(ally(half, 'aitor').secondary, 2);
  const early = found(5);
  assert.equal(foundOf(early), undefined); assert.equal(steam(early).found, undefined); assert.equal(ally(early, 'aitor').secondary, ally(early, 'aitor').maxSecondary);
  const fallen = found(); ally(fallen, 'aitor').hp = 0;
  assert.equal(steam(fallen).found, undefined, 'standing');
  // No reaction, no die: a plain fire on a dry dog.
  const dry = found(); dry.foes[0].timed = {};
  assert.equal(steam(dry).found, undefined);
});

test('the die it deals is a normal deal: a dual calls the Comodín on it as on any die', () => {
  let comodines = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = found(); s.seed = seed; const a = ally(s, 'aitor'); diceOf(s, a); a.comodinDue = true;
    const effect = steam(s);
    assert.equal(a.comodinDue, undefined, 'the call is spent on that die');
    if (effect.found.dealt[0] === 'comodin') comodines++;
  }
  assert.ok(comodines > 200 * .1 && comodines < 200 * .32, `about one in five: ${comodines}`);
});

test('the hand up to six: only its two sources go past the cap, and nothing takes the dice past it off', () => {
  const s = found(), a = ally(s, 'aitor'), cap = a.maxSecondary;
  // Defender, a round's rest and Estrella fugaz stop at the cap.
  a.secondary = cap - 1; s.phase = 'player'; s.active = 1; delete s.spent;
  assert.equal(act(s, 'defend').charged, 1); assert.equal(a.secondary, cap, 'Defender fills to the cap, not past it');
  // Past the cap: Defender keeps the six.
  assert.deepEqual(pastCap(s, a, 9), diceOf(s, a).slice(cap)); assert.equal(a.secondary, HAND.most, 'pastCap stops at six');
  s.phase = 'player'; s.active = 1; delete s.spent;
  const held = act(s, 'defend');
  assert.equal(held.charged, 0); assert.equal(a.secondary, HAND.most, 'Defender never takes a die off'); assert.equal(diceOf(s, a).length, HAND.most);
  // Estrella fugaz with Racha: pays its die, and deals nothing past the cap, but trims nothing either.
  a.racha = RACHA.star; s.phase = 'player'; s.active = 1; delete s.spent;
  const star = act(s, 'skill', 'dog-0', 'estrella-fugaz', 0);
  assert.equal(star.starred, RACHA.star); assert.equal(a.secondary, HAND.most - 1, 'its own die only');
  // Resting (the ánima taken off, and a round's rest on it), then back on: the hand comes back as it was.
  a.secondary = HAND.most; const six = [...diceOf(s, a)];
  s.phase = 'player'; s.active = 1; delete s.spent;
  assert.ok(changeAnima(s, 'aitor', null));
  assert.equal(a.mana.dadaista, HAND.most); assert.deepEqual(diceOf(s, a), six, 'resting, the six are still there');
  act(s, 'defend'); assert.equal(a.mana.dadaista, HAND.most, 'the rest never cuts them');
  s.phase = 'player'; s.active = 1; delete s.spent;
  assert.ok(changeAnima(s, 'aitor', 'dadaista')); assert.equal(a.secondary, HAND.most); assert.deepEqual(diceOf(s, a), six);
  // Da capo and improve: never cut.
  a.secondary = HAND.most; fromTheTop(s, a); assert.equal(a.secondary, HAND.most);
  improve(s, s.improved); assert.equal(a.secondary, HAND.most);
  // Nothing else passes the cap: pastCap on someone not in Dadista does nothing.
  const g = ally(s, 'gerard'), before = g.secondary;
  assert.deepEqual(pastCap(s, g, 2), []); assert.equal(g.secondary, before);
});

test('a passive banned in the simulator is out of the fight, levels and stats as they are', async () => {
  const { createFight } = await import('../src/battle-sim.ts');
  const setup = { fight: 'alumnos-2a', party: 'gerard:matemagico/freatica+aitor:dadaista', policy: 'smart', levels: { dadaista: 6 }, animas: ['matemagico', 'freatica', 'dadaista'] };
  const kept = createFight(setup, () => .5), banned = createFight({ ...setup, ban: ['objeto-encontrado'] }, () => .5);
  assert.ok(foundOf(kept)); assert.equal(foundOf(banned), undefined);
  assert.deepEqual(banned.without, ['objeto-encontrado']); assert.equal(kept.without, undefined);
  assert.deepEqual(banned.allies.map(a => [a.maxHp, a.maxSecondary]), kept.allies.map(a => [a.maxHp, a.maxSecondary]));
  // A ban of a skill is not a passive: it leaves every passive in.
  assert.equal(createFight({ ...setup, ban: ['duals'] }, () => .5).without, undefined);
});
