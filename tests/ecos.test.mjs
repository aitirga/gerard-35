import test from 'node:test';
import assert from 'node:assert/strict';
import { act, attackElement, createBattle, cycleElement, elementsFor, enemyAct, improve, inflict, manaMax, nextRound, REACTION_RULES, runClock, TIMED, wearAnima, addStatus, stacks, MANA_POINTS } from '../src/battle.ts';
import { CAST_CONTACT, CONTACT_SECONDS, CURE_CONTACT, SPELL_CONTACT } from '../src/battle-motion.ts';
import { spellLaunch, startSounds } from '../src/battle-sounds.ts';
import { impactSeconds } from '../src/home-lights.ts';
import { IMPROVEMENTS, costOf, improvedBy, withinEcos, without } from '../src/ecos.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico', kit: ['matemagico', 'papagato'] }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
function fight(elements = ['agua', 'fuego', 'electrico']) {
  const s = createBattle(party, 2, false, undefined, ['matemagico', 'papagato']);
  improve(s, { elements: { matemagico: elements } });
  s.active = s.allies.findIndex(a => a.id === 'gerard');
  return s;
}
const gerard = s => s.allies.find(a => a.id === 'gerard');
const dog = (s, i = 0) => s.foes[i];
/** Gerard's Atacar on the first dog with `element`. */
function strike(s, element, target = dog(s).id) { gerard(s).element = element; s.phase = 'player'; s.active = s.allies.indexOf(gerard(s)); return act(s, 'attack', target); }

test('the jar\'s list: elements only on Matemágico, every ánima its maná and two places asleep', () => {
  assert.deepEqual(IMPROVEMENTS.filter(i => i.kind === 'element').map(i => `${i.anima}:${i.element}`), ['matemagico:agua', 'matemagico:fuego', 'matemagico:electrico']);
  for (const anima of ['matemagico', 'papagato', 'tecnopata']) {
    assert.equal(IMPROVEMENTS.filter(i => i.anima === anima && i.kind === 'mana').length, 2, anima);
    assert.ok(IMPROVEMENTS.some(i => i.anima === anima && i.kind === 'passive' && i.veiled), anima);
    assert.ok(IMPROVEMENTS.some(i => i.anima === anima && i.kind === 'ulti' && i.veiled), anima);
  }
});
test('what stands: in order, within the ecos, and what needs something goes with it', () => {
  assert.deepEqual(withinEcos(['papagato:mana-2', 'papagato:mana-1', 'papagato:mana-2'], 5), ['papagato:mana-1', 'papagato:mana-2']);
  assert.deepEqual(withinEcos(['papagato:mana-1', 'matemagico:agua'], 2), ['papagato:mana-1']);
  assert.deepEqual(without(['papagato:mana-1', 'papagato:mana-2', 'matemagico:agua'], 'papagato:mana-1'), ['matemagico:agua']);
  assert.equal(costOf(['papagato:mana-1', 'matemagico:agua']), 3);
  assert.deepEqual(improvedBy(['papagato:mana-1', 'papagato:mana-2', 'matemagico:agua']), { mana: { papagato: 2 }, elements: { matemagico: ['agua'] } });
});
test('more maná: the ánima holds more, starts full, rests up to it, and goes with the ánima', () => {
  const s = createBattle(party, 1, false, undefined, ['matemagico', 'papagato']);
  improve(s, { mana: { papagato: 2 } });
  const g = gerard(s), a = s.allies.find(x => x.id === 'aitor');
  assert.equal(a.maxSecondary, MANA_POINTS + 2); assert.equal(a.secondary, MANA_POINTS + 2);
  assert.equal(g.maxSecondary, MANA_POINTS);
  assert.equal(manaMax(s.improved, 'papagato'), 5);
  a.classId = undefined; // Aitor takes it off: Gerard can wear it, and it holds five for him too.
  s.active = s.allies.indexOf(g);
  assert.ok(wearAnima(s, 'papagato'));
  assert.equal(g.maxSecondary, 5); assert.equal(g.secondary, 5);
  assert.ok(wearAnima(s, 'matemagico'));
  assert.equal(g.maxSecondary, MANA_POINTS);
});
test('X walks Atacar\'s elements, then none; another ánima has none of them', () => {
  const s = fight(['agua', 'electrico']), g = gerard(s);
  assert.deepEqual(elementsFor(s, g), ['agua', 'electrico']);
  const seen = [];
  for (let i = 0; i < 3; i++) { assert.ok(cycleElement(s, g)); seen.push(attackElement(s, g)); }
  assert.deepEqual(seen, ['agua', 'electrico', undefined]);
  cycleElement(s, g);
  g.classId = 'papagato';
  assert.equal(attackElement(s, g), undefined);
  assert.equal(cycleElement(s, g), false);
  assert.equal(createBattle(party, 1).allies.some(a => elementsFor({ improved: undefined }, a).length), false, 'nothing from the start');
});
test('Matemágico always throws his Atacar, elements or not; another ánima goes and hits', () => {
  assert.equal(strike(fight(), undefined).spell, true);
  assert.equal(strike(fight(), 'fuego').spell, true);
  const bare = fight([]);
  assert.equal(strike(bare, undefined).spell, true, 'with no element bought too');
  const worn = fight(); gerard(worn).classId = 'papagato';
  assert.equal(strike(worn, undefined).spell, undefined);
  assert.equal(startSounds(strike(fight(), 'agua'))[0].id, 'think');
  assert.equal(startSounds(strike(worn, undefined)).length, 0);
  for (const element of [undefined, 'agua', 'fuego', 'electrico']) assert.ok(spellLaunch(element).length, `${element} sounds as it leaves`);
});
test('the bulbs at home wait for whatever leaves his circle', () => {
  assert.equal(impactSeconds({ kind: 'attack', actor: 'gerard', target: 'dog-0', spell: true }), SPELL_CONTACT);
  assert.equal(impactSeconds({ kind: 'skill', actor: 'gerard', target: 'dog-0', skill: 'foc-binari' }), CAST_CONTACT);
  assert.equal(impactSeconds({ kind: 'skill', actor: 'gerard', target: 'aitor', skill: 'cardioide' }), CURE_CONTACT);
  assert.equal(impactSeconds({ kind: 'attack', actor: 'aitor', target: 'dog-0' }), CONTACT_SECONDS);
});
test('an element on its own changes nothing: same damage, no status', () => {
  const plain = fight(), wet = fight();
  const a = strike(plain, undefined), b = strike(wet, 'agua');
  assert.equal(a.amount, b.amount);
  assert.equal(b.element, 'agua'); assert.equal(b.reaction, undefined); assert.equal(a.element, undefined);
  for (const element of ['agua', 'fuego', 'electrico']) {
    const s = fight(); strike(s, element);
    assert.deepEqual(dog(s).timed ?? {}, {}, `${element} lights nothing`);
    assert.equal(stacks(dog(s), 'sangrado'), 0);
  }
});
test('Agua on Quemado: the fire goes out and leaves Cegado at its level; blows land lighter; it runs out', () => {
  const s = fight();
  inflict(dog(s), 'quemado'); inflict(dog(s), 'quemado');
  const e = strike(s, 'agua');
  assert.deepEqual(e.reaction, { id: 'humo', level: 2 });
  assert.equal(dog(s).timed.quemado, undefined);
  assert.equal(dog(s).timed.cegado.level, 2);
  // Nothing pulses, and its time runs out.
  const hp = dog(s).hp;
  assert.deepEqual(runClock(s, TIMED.cegado.seconds - 1), []);
  assert.equal(dog(s).hp, hp);
  assert.ok(dog(s).timed.cegado);
  runClock(s, 1.1);
  assert.equal(dog(s).timed.cegado, undefined);
});
test('a blinded foe hits lighter: the higher its Cegado, the less', () => {
  const blow = level => {
    const s = fight(); s.phase = 'enemy'; s.enemyActions = [];
    const f = dog(s);
    if (level) f.timed = { cegado: { level, left: 10, next: 10 } };
    return enemyAct(s, f.id, 'gerard').amount;
  };
  assert.ok(blow(1) < blow(0)); assert.ok(blow(3) <= blow(1));
});
test('Fuego on Sangrado: it seals the wound instead of opening it, every stack at once', () => {
  const s = fight();
  addStatus(dog(s), 'sangrado', 3);
  const hp = dog(s).hp, e = strike(s, 'fuego');
  assert.equal(e.bled, undefined, 'no wound opened');
  assert.equal(e.reaction.id, 'cauterizado'); assert.equal(e.reaction.stacks, 3);
  assert.equal(e.reaction.hits[0].amount, 3 * REACTION_RULES.cauterize);
  assert.equal(stacks(dog(s), 'sangrado'), 0);
  assert.equal(hp - dog(s).hp, e.amount + e.reaction.hits[0].amount);
  // Without fire, the same blow opens the wound as ever.
  const other = fight(); addStatus(dog(other), 'sangrado', 3);
  assert.equal(strike(other, undefined).bled, 3);
});
test('Eléctrico on Cegado: the bolt runs through the smoke to everyone in it, and the smoke is gone', () => {
  const s = fight();
  for (const f of s.foes) f.timed = { cegado: { level: 1, left: 10, next: 10 } };
  const e = strike(s, 'electrico');
  assert.equal(e.reaction.id, 'tormenta');
  assert.deepEqual(e.reaction.hits.map(h => h.target).sort(), s.foes.map(f => f.id).sort());
  assert.ok(s.foes.every(f => !f.timed.cegado));
  // Nobody in smoke: nothing to run through.
  assert.equal(strike(fight(), 'electrico').reaction, undefined);
});
test('a reaction goes by the status, whoever put it there, and never on a foe the blow felled', () => {
  const s = fight();
  dog(s).hp = 1;
  inflict(dog(s), 'quemado');
  const e = strike(s, 'agua');
  assert.equal(e.reaction, undefined);
  nextRound(s);
});
