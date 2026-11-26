import test from 'node:test';
import assert from 'node:assert/strict';
import { act, addStatus, createBattle, enemyAct, improve, inflict, nextRound, runClock, skillsFor, stacks, takeNews, validTargets, awakeUlti, ultiProgress, livesReady, warded, woundScale, CRIT_RULES, SCENT, SKILLS, STATUSES, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';
import { manaMax, actDual } from '../src/battle.ts';

// Papagato from level 4 to 7, and its definitiva (docs/animas/papagato/README.md § Skills per level,
// § Definitiva): Maná +1, Olor a sangre, Acecho (a blow that waits for the next round), Cacería (the
// whole field's blood at once) and Siete vidas (a cut on everyone, and a killing blow turned into a cure).
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
/** Gerard (Matemágico) and Aitor (Papagato at `level`) against three sturdy dogs; `jar`: what is bought at the jar. */
function fight(level = 7, jar = []) {
  const s = createBattle(PARTY, 3, false, undefined, ['matemagico', 'papagato']);
  s.levels = { papagato: level };
  improve(s, improvedBy(jar));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full. */
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
/** The foes' turn is over: the round can end (`nextRound`). */
const foesDone = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); };
const ids = (s, who) => skillsFor(s, by(s, who)).map(k => k.id);

test('Papagato grows to seven: Maná +1 at 4, Olor a sangre at 5, Acecho at 6, Cacería at 7', () => {
  assert.ok(!ids(fight(5), 'aitor').includes('acecho'));
  assert.deepEqual(ids(fight(6), 'aitor'), ['zarpazo', 'zarpazos', 'ronroneo', 'llaga', 'acecho']);
  assert.deepEqual(ids(fight(7), 'aitor'), ['zarpazo', 'zarpazos', 'ronroneo', 'llaga', 'acecho', 'caceria']);
  assert.equal(manaMax(undefined, 'papagato', { papagato: 3 }), 3); assert.equal(manaMax(undefined, 'papagato', { papagato: 4 }), 4);
  assert.equal(by(fight(4), 'aitor').maxSecondary, 4, 'four circles of maná from level 4');
  const acecho = SKILLS.find(k => k.id === 'acecho'), caceria = SKILLS.find(k => k.id === 'caceria');
  assert.equal(acecho.cost, 2); assert.equal(acecho.level, 6); assert.equal(acecho.kind, 'physical');
  assert.equal(caceria.cost, 3, 'the whole base pool'); assert.equal(caceria.level, 7);
});

test('Acecho: nothing lands this turn; as the next round starts the cat lands on the prey, a golpe crítico for sure that spends its wound', () => {
  const s = fight(6), aitor = turn(s, 'aitor'), dog = s.foes[0];
  addStatus(dog, 'sangrado', 3);
  const charge = act(s, 'skill', 'dog-0', 'acecho');
  assert.equal(charge.stalking, 'dog-0'); assert.equal(charge.amount, undefined); assert.equal(dog.hp, 999, 'nothing yet');
  assert.deepEqual(aitor.stalk, { target: 'dog-0' }); assert.equal(aitor.secondary, aitor.maxSecondary - 2);
  assert.match(s.message, /Saldrá al empezar la siguiente ronda/);
  foesDone(s); nextRound(s);
  const [pounce] = takeNews(s);
  assert.equal(pounce.pounce, true); assert.equal(pounce.skill, 'acecho'); assert.equal(pounce.target, 'dog-0'); assert.equal(pounce.actor, 'aitor');
  // The wound lost a stack as the round ended (nobody cut it): two are left for the cat.
  assert.equal(pounce.crit, true, 'a golpe crítico whatever the dice'); assert.equal(pounce.bled, 2);
  assert.equal(stacks(dog, 'sangrado'), 0, 'it spends the wound'); assert.equal(aitor.stalk, undefined);
  assert.equal(dog.hp, 999 - 3 * STATUSES.sangrado.tick - pounce.amount, 'the round\'s bleeding, then the pounce'); assert.equal(s.phase, 'player', 'before anyone chooses');
  assert.match(s.message, /¡Acecho!/);
  // Its weight: the wound's bonus and the crítico's, added (CRIT_RULES.bonus off gives the bare blow).
  const bare = () => { const t = fight(6); turn(t, 'aitor'); act(t, 'skill', 'dog-0', 'acecho'); foesDone(t); nextRound(t); return takeNews(t)[0].amount; };
  const crit = bare(); CRIT_RULES.bonus = 0; const raw = bare(); CRIT_RULES.bonus = .5;
  assert.equal(crit, Math.round(raw * 1.5)); assert.equal(pounce.amount, Math.round(raw * (woundScale(2) + .5)));
  assert.ok(raw > SKILLS.find(k => k.id === 'zarpazo').power, 'a high blow');
});

test('Acecho: if the prey falls the cat takes whoever bleeds most; if the wearer falls or takes Papagato off, the moment is lost', () => {
  const s = fight(6); turn(s, 'aitor'); act(s, 'skill', 'dog-0', 'acecho');
  s.foes[0].hp = 0; addStatus(s.foes[2], 'sangrado', 4); addStatus(s.foes[1], 'sangrado', 1);
  foesDone(s); nextRound(s);
  assert.equal(takeNews(s)[0].target, 'dog-2');
  const fell = fight(6); turn(fell, 'aitor'); act(fell, 'skill', 'dog-0', 'acecho');
  by(fell, 'aitor').hp = 0; foesDone(fell); nextRound(fell);
  assert.deepEqual(takeNews(fell), []); assert.equal(fell.foes[0].hp, 999); assert.equal(by(fell, 'aitor').stalk, undefined);
  const off = fight(6); turn(off, 'aitor'); act(off, 'skill', 'dog-0', 'acecho');
  by(off, 'aitor').classId = 'matemagico'; foesDone(off); nextRound(off);
  assert.deepEqual(takeNews(off), []); assert.equal(off.foes[0].hp, 999);
});

test('Cacería: a claw for each stack on the field, on whoever bleeds, none with the wound\'s bonus; sure críticos on a wound of five or more; it spends the blood', () => {
  const s = fight(7), aitor = turn(s, 'aitor');
  assert.deepEqual(validTargets(s, 'skill', 'caceria'), [], 'no blood, nobody to hunt');
  assert.equal(act(s, 'skill', undefined, 'caceria'), undefined, 'and the turn is not spent');
  addStatus(s.foes[0], 'sangrado', 5); addStatus(s.foes[2], 'sangrado', 2);
  assert.deepEqual(validTargets(s, 'skill', 'caceria').map(f => f.id), ['dog-0', 'dog-2']);
  const e = act(s, 'skill', undefined, 'caceria');
  assert.equal(aitor.secondary, aitor.maxSecondary - 3);
  assert.equal(e.hunt.length, 7, 'seven stacks, seven claws');
  assert.deepEqual(e.hunt.map(c => c.target), ['dog-0', 'dog-0', 'dog-0', 'dog-0', 'dog-0', 'dog-2', 'dog-2']);
  assert.deepEqual(e.hits.map(h => [h.target, h.drained]), [['dog-0', 5], ['dog-2', 2]]);
  assert.ok(e.hunt.slice(0, 5).every(c => c.crit), 'on the wound of five: Olor a sangre makes every claw a crítico');
  assert.ok(e.hunt.slice(5).every(c => !c.crit), 'on the wound of two they roll (and the tests have chance off)');
  assert.equal(by(s, 'dog-1').hp, 999, 'whoever does not bleed is not hunted');
  assert.ok(s.foes.every(f => !stacks(f, 'sangrado')), 'the blood is spent');
  assert.equal(e.amount, e.hunt.reduce((sum, c) => sum + c.amount, 0));
  // No wound's bonus: each plain claw is the skill's own light blow, the crítico half as hard again.
  const plain = e.hunt[5].amount, sure = e.hunt[0].amount;
  assert.equal(sure, Math.round(plain * (1 + CRIT_RULES.bonus)));
  assert.ok(plain < sure);
  assert.deepEqual(e.passives?.map(p => p.id), ['olor-a-sangre']);
});

test('Siete vidas sleeps until a wound of five or more is spent with Papagato worn; then it heads the list, once, for no maná', () => {
  // Not bought: never there.
  const none = fight(7); addStatus(none.foes[0], 'sangrado', 5); turn(none, 'gerard');
  assert.equal(act(none, 'attack', 'dog-0').awoken, undefined); assert.equal(livesReady(none), false);
  const s = fight(7, ['papagato:definitiva']);
  assert.ok(!ids(s, 'aitor').includes('siete-vidas'), 'asleep at the start');
  addStatus(s.foes[0], 'sangrado', 4); turn(s, 'gerard');
  assert.equal(act(s, 'attack', 'dog-0').awoken, undefined, 'four stacks are not enough');
  addStatus(s.foes[0], 'sangrado', 5); turn(s, 'gerard');
  const woke = act(s, 'attack', 'dog-0');
  assert.equal(woke.bled, 5); assert.equal(woke.awoken, 'siete-vidas', 'the partner\'s blow wakes it too');
  assert.equal(awakeUlti(s, by(s, 'aitor'))?.id, 'siete-vidas'); assert.equal(awakeUlti(s, by(s, 'gerard')), undefined);
  assert.equal(ids(s, 'aitor')[0], 'siete-vidas', 'an awake definitiva heads the list');
  // Haru cuts every foe; Yuki's ward goes on the whole party. No maná, and once a fight.
  const aitor = turn(s, 'aitor'), mana = aitor.secondary;
  const e = act(s, 'skill', undefined, 'siete-vidas');
  assert.equal(aitor.secondary, mana);
  assert.equal(e.hits.length, 3); assert.ok(e.hits.every(h => h.amount > 0 && h.status?.stacks === 2));
  assert.deepEqual(e.hunt.map(c => c.target), ['dog-0', 'dog-1', 'dog-2'], 'one claw on each, in turn');
  assert.deepEqual(e.ward, ['gerard', 'aitor']); assert.ok(s.allies.every(warded));
  assert.equal(livesReady(s), false); assert.ok(!ids(s, 'aitor').includes('siete-vidas'));
  // Zarpazos on a wound already at five does not wake it again: it went off.
  addStatus(s.foes[1], 'sangrado', 6); turn(s, 'aitor');
  assert.equal(act(s, 'skill', 'dog-1', 'llaga').awoken, undefined);
  // Without Papagato worn by someone standing, a wound spent wakes nothing.
  const off = fight(7, ['papagato:definitiva']); by(off, 'aitor').hp = 0; addStatus(off.foes[0], 'sangrado', 5); turn(off, 'gerard');
  assert.equal(act(off, 'attack', 'dog-0').awoken, undefined); assert.equal(livesReady(off), false);
});

test('A definitiva bought and asleep says how near it is to waking, on whoever wears its ánima, until it wakes; then that it was used', () => {
  // Not bought: nothing to show.
  const none = fight(7);
  assert.equal(ultiProgress(none, by(none, 'aitor')), undefined);
  const s = fight(7, ['papagato:definitiva']);
  assert.equal(ultiProgress(s, by(s, 'gerard')), undefined, 'only on the ánima that has it');
  assert.deepEqual(ultiProgress(s, by(s, 'aitor')), { skill: 'siete-vidas', name: 'Siete vidas', have: 0, need: SCENT.sure });
  addStatus(s.foes[1], 'sangrado', 3);
  assert.equal(ultiProgress(s, by(s, 'aitor')).have, 3, 'the deepest wound on a foe');
  addStatus(s.foes[0], 'sangrado', 5); turn(s, 'gerard'); act(s, 'attack', 'dog-0');
  assert.equal(ultiProgress(s, by(s, 'aitor')), undefined, 'awake: the command itself shows it');
  turn(s, 'aitor'); act(s, 'skill', undefined, 'siete-vidas');
  assert.equal(ultiProgress(s, by(s, 'aitor')).used, true);
});

/** A fight with Siete vidas just played by Aitor. */
function warded7() {
  const s = fight(7, ['papagato:definitiva']);
  s.unbound = true; turn(s, 'aitor'); act(s, 'skill', undefined, 'siete-vidas'); delete s.unbound;
  return s;
}

test('Siete vidas: the next blow that would kill anyone in the party cures them what it would have taken instead, never past their PV, once', () => {
  const s = warded7(), gerard = by(s, 'gerard');
  // A blow that does not kill goes through as ever.
  s.phase = 'enemy'; s.enemyActions = [];
  gerard.hp = 60; const light = enemyAct(s, 'dog-0', 'gerard');
  assert.ok(light.amount > 0 && light.lives === undefined); assert.ok(warded(gerard));
  // The killing one: the blow's PV, back.
  gerard.hp = 1;
  const killing = enemyAct(s, 'dog-1', 'gerard');
  assert.equal(killing.amount, 0); assert.equal(killing.lives.target, 'gerard');
  assert.ok(killing.lives.blow > 1); assert.equal(gerard.hp, 1 + killing.lives.amount); assert.equal(killing.lives.amount, killing.lives.blow);
  assert.match(s.message, /¡Siete vidas!/);
  assert.ok(!s.allies.some(warded), 'spent for the whole party');
  gerard.hp = 1; enemyAct(s, 'dog-2', 'gerard');
  assert.equal(gerard.hp, 0, 'the next one is a blow again');
  // Never past their PV.
  const t = warded7(), aitor = by(t, 'aitor'); t.phase = 'enemy'; t.enemyActions = [];
  aitor.hp = 3; aitor.maxHp = 6;
  const capped = enemyAct(t, 'dog-0', 'aitor');
  assert.equal(aitor.hp, 6); assert.equal(capped.lives.amount, 3);
});

test('Siete vidas: a pulse or a round\'s tick that would kill counts too, and says it saved them', () => {
  const s = warded7(), gerard = by(s, 'gerard');
  inflict(gerard, 'quemado'); gerard.hp = 1;
  const pulses = runClock(s, TIMED.quemado.every + .01);
  const saved = pulses.find(p => p.target === 'gerard');
  assert.equal(saved.amount, 0); assert.ok(saved.saved.amount > 0); assert.equal(gerard.hp, 1 + saved.saved.amount);
  const t = warded7(), aitor = by(t, 'aitor');
  addStatus(aitor, 'sangrado', 3); aitor.hp = 2; foesDone(t);
  const ticks = nextRound(t);
  const tick = ticks.find(k => k.target === 'aitor');
  assert.equal(tick.amount, 0); assert.ok(tick.saved); assert.equal(aitor.hp, 2 + tick.saved.amount);
});

test('Siete vidas is a definitiva of the jar\'s, and its description follows the plain shape', () => {
  const lives = SKILLS.find(k => k.id === 'siete-vidas');
  assert.equal(lives.ulti, true); assert.equal(lives.node, true); assert.equal(lives.cost, 0); assert.equal(lives.class, 'papagato');
  assert.equal(lives.description, 'Daño físico leve a todos los enemigos. Añade sangrado. El próximo golpe que fuera a matar a alguien del equipo no lo mata: lo cura.');
  assert.equal(SCENT.sure, 5, 'it wakes where Olor a sangre makes the spent wound a sure crítico');
});

test('Siete vidas wakes on Campana de Gauss\'s first die on a wound of five, with Papagato worn by someone standing', () => {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'dadaista' }, { id: 'nuria', name: 'Nuria', profile: 'gerard35', classId: 'papagato' }], 3, false, undefined, ['matemagico', 'papagato', 'dadaista']);
  s.levels = { papagato: 7, dadaista: 7 };
  improve(s, improvedBy(['papagato:definitiva', 'matemagico:fuego', 'matemagico:factor-comun']));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  for (const ally of s.allies) ally.secondary = ally.maxSecondary;
  addStatus(s.foes[1], 'sangrado', 5);
  s.phase = 'player'; s.active = 0;
  const e = actDual(s, 'campana-de-gauss', 'dog-1');
  assert.ok(e, 'Gerard and Aitor bring Campana de Gauss');
  assert.equal(e.bled, 5); assert.equal(e.awoken, 'siete-vidas');
  assert.ok(e.crit, 'a wound of five spent is a golpe crítico, even on a die');
  assert.equal(livesReady(s), true);
});
