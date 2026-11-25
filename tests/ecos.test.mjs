import test from 'node:test';
import assert from 'node:assert/strict';
import { CEGADO, PASSIVES, SKILLS, act, attackElement, createBattle, cycleElement, elementsFor, enemyAct, firePulses, improve, inflict, manaMax, nextRound, pulseDamage, REACTION_RULES, runClock, TIMED, wearAnima, addStatus, stacks, MANA_POINTS } from '../src/battle.ts';
import { CAST_CONTACT, CONTACT_SECONDS, CURE_CONTACT, SPELL_CONTACT } from '../src/battle-motion.ts';
import { spellLaunch, startSounds } from '../src/battle-sounds.ts';
import { impactSeconds } from '../src/home-lights.ts';
import { IMPROVEMENTS, LINES, TREE_ANIMAS, costOf, improvedBy, withinEcos, without } from '../src/ecos.ts';

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

test('the jar\'s list: a tree for each own ánima, one more maná for a shared one, and the definitiva asleep on all', () => {
  assert.deepEqual(TREE_ANIMAS, ['matemagico', 'tecnopata']);
  assert.deepEqual(IMPROVEMENTS.filter(i => i.kind === 'element').map(i => `${i.anima}:${i.element}`), ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico']);
  for (const anima of ['matemagico', 'papagato', 'tecnopata']) assert.equal(IMPROVEMENTS.filter(i => i.anima === anima && i.kind === 'mana').length, 1, anima);
  assert.ok(IMPROVEMENTS.some(i => i.anima === 'matemagico' && i.kind === 'ulti' && i.veiled), 'matemagico');
  assert.deepEqual(IMPROVEMENTS.filter(i => i.anima === 'papagato').map(i => i.id), ['papagato:mana-1', 'papagato:definitiva'], 'a shared ánima: its skills come by level');
  for (const item of IMPROVEMENTS.filter(i => i.kind === 'ulti')) assert.equal(item.cost, 2, `${item.id}: a definitiva costs 2 ecos (Aitor, 2026-11-20)`);
  // Every skill marked `node` is a node of its ánima's tree, and only those; each line is a chain.
  assert.deepEqual(IMPROVEMENTS.flatMap(i => i.skill ? [i.skill] : []).sort(), SKILLS.filter(s => s.node).map(s => s.id).sort());
  // A passive is a node too, unless it comes with a level of its ánima (Olor a sangre, Papagato's).
  assert.deepEqual(IMPROVEMENTS.flatMap(i => i.passive ? [i.passive] : []).sort(), Object.keys(PASSIVES).filter(id => !PASSIVES[id].level).sort());
  assert.deepEqual(Object.keys(PASSIVES).filter(id => PASSIVES[id].level).sort(), ['a-contratiempo', 'nivel-de-base', 'olor-a-sangre', 'pedal', 'remolino']);
  // A definitiva whose move is built is awake: it is that skill, bought here (Colorista's Fin de fiesta, the first).
  const fiesta = IMPROVEMENTS.find(i => i.id === 'prismatico:definitiva');
  assert.equal(fiesta.veiled, undefined); assert.equal(fiesta.skill, 'fin-de-fiesta'); assert.equal(fiesta.name, 'Fin de fiesta');
  assert.deepEqual(improvedBy(['prismatico:definitiva']).skills, ['fin-de-fiesta']);
  // Papagato's Siete vidas, the second.
  const lives = IMPROVEMENTS.find(i => i.id === 'papagato:definitiva');
  assert.equal(lives.veiled, undefined); assert.equal(lives.skill, 'siete-vidas'); assert.equal(lives.name, 'Siete vidas');
  assert.deepEqual(improvedBy(['papagato:definitiva']).skills, ['siete-vidas']);
  // Sincopante's Da capo, the third.
  const capo = IMPROVEMENTS.find(i => i.id === 'sincopante:definitiva');
  assert.equal(capo.veiled, undefined); assert.equal(capo.skill, 'da-capo'); assert.equal(capo.name, 'Da capo');
  assert.deepEqual(improvedBy(['sincopante:definitiva']).skills, ['da-capo']);
  // Freática's Bajo cero, the third.
  const cold = IMPROVEMENTS.find(i => i.id === 'freatica:definitiva');
  assert.equal(cold.veiled, undefined); assert.equal(cold.skill, 'bajo-cero'); assert.equal(cold.name, 'Bajo cero');
  assert.deepEqual(IMPROVEMENTS.filter(i => i.kind === 'ulti' && !i.veiled).map(i => i.anima), ['papagato', 'tecnopata', 'sincopante', 'prismatico', 'freatica']);
  for (const item of IMPROVEMENTS) {
    if (item.skill) assert.equal(SKILLS.find(s => s.id === item.skill).class, item.anima, item.id);
    if (item.passive) assert.equal(PASSIVES[item.passive].anima, item.anima, item.id);
    if (item.after) { const before = IMPROVEMENTS.find(i => i.id === item.after); assert.ok(before && before.anima === item.anima && before.line === item.line, `${item.id} needs one of its own line`); }
    if (item.line) assert.ok(LINES[item.line], item.id);
  }
  // Every node is one eco but the definitivas (2), the dúos mayores (3) and grade III (3 the big ones, 2
  // Reinicio and Virus atómico): Aitor, 2026-11-24, the jar some 25 % dearer, so some three quarters of it
  // (74 ecos while two definitivas sleep, 55 to win) can be had by the game's end.
  // Superficie mínima (2026-11-25): one more on Matemágico's water line.
  assert.equal(costOf(IMPROVEMENTS.filter(i => i.anima === 'matemagico' && !i.veiled).map(i => i.id)), 34);
  assert.equal(costOf(IMPROVEMENTS.filter(i => i.anima === 'tecnopata' && !i.veiled).map(i => i.id)), 27); // Escolta where Rayo encogedor was, Rayo encogedor at Taller's end, and Enjambre (2)
  assert.equal(costOf(IMPROVEMENTS.filter(i => !i.veiled).map(i => i.id)), 75);
  for (const item of IMPROVEMENTS.filter(i => i.kind === 'dual')) assert.equal(item.cost, 3, `${item.id}: a dúo mayor costs 3 ecos`);
});
test('what stands: in order, within the ecos, and what needs something goes with it', () => {
  assert.deepEqual(withinEcos(['matemagico:vasos', 'matemagico:agua', 'matemagico:vasos'], 5), ['matemagico:agua', 'matemagico:vasos']);
  assert.deepEqual(withinEcos(['papagato:mana-1', 'matemagico:agua', 'tecnopata:explosion'], 2), ['papagato:mana-1', 'matemagico:agua']);
  assert.deepEqual(withinEcos(['papagato:mana-2', 'papagato:pasiva', 'matemagico:definitiva'], 9), [], 'what the jar no longer has, or keeps asleep, is not there');
  assert.deepEqual(without(['matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad', 'matemagico:fuego'], 'matemagico:agua'), ['matemagico:fuego'], 'a node goes with everything after it on its line');
  assert.equal(costOf(['papagato:mana-1', 'matemagico:agua']), 2);
  assert.deepEqual(improvedBy(['papagato:mana-1', 'matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad', 'tecnopata:explosion']),
    { mana: { papagato: 1 }, elements: { matemagico: ['agua'] }, skills: ['vasos', 'explosion'], passives: ['capilaridad'], duals: [] });
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
test('Agua on Quemado: the fire goes out and leaves Cegado, whatever the fire\'s level; it runs out', () => {
  const s = fight();
  inflict(dog(s), 'quemado'); inflict(dog(s), 'quemado');
  const e = strike(s, 'agua');
  assert.deepEqual(e.reaction, { id: 'humo', level: 1 });
  assert.equal(dog(s).timed.quemado, undefined);
  assert.equal(dog(s).timed.cegado.level, 1, 'Cegado has no levels');
  // Nothing pulses, and its time runs out.
  const hp = dog(s).hp;
  assert.deepEqual(runClock(s, TIMED.cegado.seconds - 1), []);
  assert.equal(dog(s).hp, hp);
  assert.ok(dog(s).timed.cegado);
  runClock(s, 1.1);
  assert.equal(dog(s).timed.cegado, undefined);
});
test('Cegado never adds up: smoke on smoke only starts its clock over', () => {
  const s = fight();
  inflict(dog(s), 'quemado'); strike(s, 'agua');
  runClock(s, 6);
  assert.ok(dog(s).timed.cegado.left < TIMED.cegado.seconds);
  inflict(dog(s), 'quemado'); strike(s, 'agua');
  assert.equal(dog(s).timed.cegado.level, 1);
  assert.equal(dog(s).timed.cegado.left, TIMED.cegado.seconds);
});
test('a blinded foe\'s physical blows miss whole as often as CEGADO says, and it is said', () => {
  const blow = (blind, odds) => {
    const saved = { ...CEGADO }; Object.assign(CEGADO, { smoke: odds, flash: odds });
    try {
      const s = fight(); s.phase = 'enemy'; s.enemyActions = [];
      const f = dog(s), hp = s.allies.find(a => a.id === 'gerard').hp;
      if (blind) f.timed = { cegado: { level: 1, left: 10, next: 10 } };
      const e = enemyAct(s, f.id, 'gerard');
      return { e, lost: hp - s.allies.find(a => a.id === 'gerard').hp, message: s.message };
    } finally { Object.assign(CEGADO, saved); }
  };
  const seen = blow(false, 1), blind = blow(true, 1), lucky = blow(true, 0);
  assert.ok(seen.lost > 0 && !seen.e.missed);
  assert.equal(blind.lost, 0); assert.equal(blind.e.amount, 0);
  assert.deepEqual(blind.e.missed, ['gerard']);
  assert.match(blind.message, /¡Falla!/); assert.doesNotMatch(blind.message, /−0 PV/);
  assert.ok(lucky.lost > 0 && !lucky.e.missed, 'blinded, a blow can still find them');
  assert.ok(CEGADO.smoke > CEGADO.flash, 'smoke blinds more than the flash');
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
test('Eléctrico on Quemado is Plasma: every pulse the fire had left lands at once, harder, and it goes out', () => {
  const s = fight();
  dog(s).hp = dog(s).maxHp = 300;
  dog(s).timed = { quemado: { level: 3, left: TIMED.quemado.seconds, next: TIMED.quemado.every } };
  const pulses = firePulses(dog(s).timed.quemado), hp = dog(s).hp;
  assert.equal(pulses, TIMED.quemado.seconds / TIMED.quemado.every);
  const e = strike(s, 'electrico');
  assert.equal(e.reaction.id, 'plasma'); assert.equal(e.reaction.level, 3);
  assert.equal(e.reaction.hits[0].amount, Math.round(pulses * pulseDamage('quemado', 3, 300) * REACTION_RULES.plasma));
  assert.ok(REACTION_RULES.plasma > 1, 'more than the fire would have done by itself');
  assert.equal(dog(s).timed.quemado, undefined, 'the fire is gone');
  assert.equal(hp - dog(s).hp, e.amount + e.reaction.hits[0].amount);
  // A fire near its end has less left to give.
  const late = fight(); dog(late).hp = dog(late).maxHp = 300;
  dog(late).timed = { quemado: { level: 3, left: 2, next: 2 } };
  assert.equal(strike(late, 'electrico').reaction.hits[0].amount, Math.round(pulseDamage('quemado', 3, 300) * REACTION_RULES.plasma));
});
test('a skill\'s fire on someone wet is Vapor, never Cauterizado; Cortocircuito\'s current turns what is on its target', () => {
  const s = fight();
  improve(s, improvedBy(['matemagico:fuego', 'matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito']));
  gerard(s).secondary = gerard(s).maxSecondary = 9;
  dog(s).hp = dog(s).maxHp = 300;
  dog(s).timed = { mojado: { level: 1, left: 20, next: 20 } }; addStatus(dog(s), 'sangrado', 2);
  const steamed = act(s, 'skill', dog(s).id, 'foc-binari');
  assert.equal(steamed.reaction.id, 'vapor');
  assert.equal(stacks(dog(s), 'sangrado'), 2, 'the wound is untouched');
  assert.ok(!dog(s).timed.quemado && !dog(s).timed.mojado);
  // Not wet and with nothing announced: Cortocircuito is a bolt like any other.
  const short = fight();
  improve(short, improvedBy(['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito']));
  gerard(short).secondary = 9;
  for (const f of short.foes) { delete f.intent; f.timed = { cegado: { level: 1, left: 10, next: 10 } }; }
  short.phase = 'player'; short.active = short.allies.indexOf(gerard(short));
  assert.equal(act(short, 'skill', dog(short).id, 'cortocircuito').reaction.id, 'tormenta');
  // Wet: the current stays in it, nothing jumps; a fire on it still goes up as Plasma.
  const held = fight();
  improve(held, improvedBy(['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito']));
  gerard(held).secondary = 9;
  for (const f of held.foes) f.timed = { mojado: { level: 1, left: 20, next: 20 } };
  dog(held).timed.quemado = { level: 2, left: 10, next: 2 };
  held.phase = 'player'; held.active = held.allies.indexOf(gerard(held));
  const e = act(held, 'skill', dog(held).id, 'cortocircuito');
  assert.equal(e.shorted.why, 'mojado'); assert.equal(e.reaction.id, 'plasma');
  assert.ok(dog(held, 1).timed.mojado, 'no Conducción to the other');
});
test('a reaction goes by the status, whoever put it there, and never on a foe the blow felled', () => {
  const s = fight();
  dog(s).hp = 1;
  inflict(dog(s), 'quemado');
  const e = strike(s, 'agua');
  assert.equal(e.reaction, undefined);
  nextRound(s);
});
