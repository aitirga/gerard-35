import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, awakeUlti, capoReady, createBattle, diceOf, DUALS, ECOS, ecosOf, improve, offbeat, runClock, skillsFor, takeEcoNews, TIMED, validTargets, wearAnima, manaMax, SKILLS, PASSIVES } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';
import { skillsAt, passivesAt, topOf } from '../src/levels.ts';

// Sincopante, Marta's ánima (docs/animas/sincopante/README.md): ecos that repeat what its wearer did on a shared
// compás, raised by Crescendo, spent by Tutti, kept by Pedal, played off the beat (A contratiempo), and Da capo.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'sincopante' }];
/** Gerard (Matemágico) and Aitor (Sincopante at `level`) against three sturdy dogs; `jar`: what is bought at the jar. */
function fight(level = 7, jar = []) {
  const s = createBattle(PARTY, 3, false, undefined, ['matemagico', 'sincopante', 'tecnopata']);
  s.levels = { sincopante: level };
  improve(s, improvedBy(jar));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full. */
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const ids = (s, who) => skillsFor(s, by(s, who)).map(k => k.id);
/** `seconds` on the fight's clock, in small steps as the fight screen runs it. */
const tick = (s, seconds, step = .05) => { for (let t = 0; t < seconds - 1e-9; t += step) runClock(s, Math.min(step, seconds - t)); };

test('Sincopante grows to seven: Ostinato and Bordón, Crescendo, A contratiempo, Maná +1, Acompañamiento, Pedal and Tutti', () => {
  assert.equal(topOf('sincopante'), 7);
  assert.deepEqual(ids(fight(1), 'aitor'), ['ostinato', 'bordon']);
  assert.deepEqual(skillsAt('sincopante', 2), ['crescendo']); assert.deepEqual(passivesAt('sincopante', 3), ['a-contratiempo']);
  assert.deepEqual(skillsAt('sincopante', 4), []); assert.equal(manaMax(undefined, 'sincopante', { sincopante: 4 }), 4);
  assert.deepEqual(skillsAt('sincopante', 5), ['acompanamiento']); assert.deepEqual(passivesAt('sincopante', 6), ['pedal']);
  assert.deepEqual(skillsAt('sincopante', 7), ['tutti']);
  assert.deepEqual(ids(fight(7), 'aitor'), ['ostinato', 'bordon', 'crescendo', 'acompanamiento', 'tutti']);
  assert.ok(!skillsAt('sincopante', 7).includes('da-capo'), 'the definitiva is bought at the jar');
  assert.equal(PASSIVES['a-contratiempo'].anima, 'sincopante'); assert.equal(PASSIVES.pedal.level, 6);
});

test('Ostinato: a light astral blow, and its eco strikes that foe on every beat for 20 s, four beats, as a pulse', () => {
  const s = fight(1), aitor = turn(s, 'aitor'), dog = s.foes[0];
  const effect = act(s, 'skill', 'dog-0', 'ostinato');
  assert.ok(effect.amount > 0); assert.equal(effect.ecoCalled.kind, 'ostinato'); assert.equal(effect.ecoCalled.target, 'dog-0');
  assert.equal(ecosOf(s, aitor).length, 1); assert.equal(s.compas, 0, 'the first eco starts the compás');
  assert.equal(dog.timed?.ostinato, undefined, 'no status on the foe: the eco is on the party\'s side');
  const after = dog.hp;
  s.phase = 'player';
  tick(s, 4.9);
  assert.equal(dog.hp, after, 'nothing before the first beat');
  tick(s, .2);
  const [pulse] = takeEcoNews(s);
  assert.equal(pulse.kind, 'pulse'); assert.equal(pulse.hits[0].target, 'dog-0');
  // Magia 12 against Espíritu 10: 4 + 2 = 6 (docs § What a round looks like).
  assert.equal(pulse.hits[0].amount, after - dog.hp); assert.ok(pulse.hits[0].amount >= 1);
  tick(s, 15);
  const pulses = takeEcoNews(s).filter(n => n.kind === 'pulse');
  assert.equal(pulses.length, 3, 'four beats in all');
  assert.ok(takeEcoNews(s).length === 0);
  assert.equal(ecosOf(s).length, 0, 'gone after 20 s'); assert.equal(s.compas, undefined, 'the compás stops with the last eco');
});

test('Bordón: a cure, and its eco cures whoever has least of their PV left on every beat', () => {
  const s = fight(1), gerard = by(s, 'gerard'), aitor = by(s, 'aitor');
  gerard.hp = 40; aitor.hp = aitor.maxHp - 5;
  turn(s, 'aitor');
  const effect = act(s, 'skill', 'gerard', 'bordon');
  assert.equal(effect.healed, true); assert.equal(effect.ecoCalled.kind, 'bordon');
  const before = gerard.hp;
  s.phase = 'player'; tick(s, 5.05);
  const [pulse] = takeEcoNews(s);
  assert.equal(pulse.hits[0].heal, true); assert.equal(pulse.hits[0].target, 'gerard', 'the most hurt, as a share');
  assert.equal(gerard.hp, before + pulse.hits[0].amount);
});

test('At most three ecos: a fourth replaces the oldest; three at once is a chord, which wakes Da capo once bought', () => {
  const s = fight(7, ['sincopante:definitiva']), aitor = by(s, 'aitor');
  for (let i = 0; i < 3; i++) { turn(s, 'aitor'); act(s, 'skill', `dog-${i}`, 'ostinato'); }
  assert.equal(ecosOf(s, aitor).length, 3);
  const oldest = s.ecos[0].id;
  turn(s, 'aitor'); const fourth = act(s, 'skill', 'dog-0', 'ostinato');
  assert.equal(fourth.ecoReplaced, oldest); assert.equal(s.ecos.length, ECOS.most);
  assert.ok(!capoReady(s), 'asleep until the chord sounds');
  s.phase = 'player'; takeEcoNews(s); tick(s, 5.05);
  const chord = takeEcoNews(s).find(n => n.kind === 'chord');
  assert.ok(chord); assert.equal(chord.awoken, true);
  assert.ok(capoReady(s)); assert.equal(awakeUlti(s, aitor)?.id, 'da-capo');
  assert.equal(ids(s, 'aitor')[0], 'da-capo', 'an awake definitiva heads the list');
});

test('Crescendo: every eco a grade up and its clock over; at mf ×1.5, at f it reaches every foe; with none up it has nothing to do', () => {
  const s = fight(2), aitor = turn(s, 'aitor');
  assert.deepEqual(validTargets(s, 'skill', 'crescendo'), [], 'nothing to raise');
  assert.equal(act(s, 'skill', undefined, 'crescendo'), undefined);
  act(s, 'skill', 'dog-0', 'ostinato');
  s.phase = 'player'; tick(s, 5.05);
  const p = takeEcoNews(s)[0].hits[0].amount;
  tick(s, 4);
  turn(s, 'aitor');
  const raised = act(s, 'skill', undefined, 'crescendo');
  assert.deepEqual(raised.ecosRaised.map(r => r.grade), [1]); assert.equal(s.ecos[0].left, ECOS.life, 'its 20 s start over');
  assert.match(s.message, /mf/);
  s.phase = 'player'; tick(s, 5);
  const mf = takeEcoNews(s).find(n => n.kind === 'pulse').hits[0].amount;
  assert.equal(mf, Math.round(p * ECOS.raise));
  turn(s, 'aitor'); act(s, 'skill', undefined, 'crescendo');
  assert.equal(s.ecos[0].grade, 2);
  s.phase = 'player'; tick(s, 5);
  const f = takeEcoNews(s).find(n => n.kind === 'pulse');
  assert.deepEqual(f.hits.map(h => h.target).sort(), ['dog-0', 'dog-1', 'dog-2'], 'at f it strikes every foe');
  turn(s, 'aitor'); act(s, 'skill', undefined, 'crescendo');
  assert.equal(s.ecos[0].grade, 2, 'f is the top: it only starts its clock over');
});

test('Switching ánima: the ecos go on muffled, at half; the wearer falling puts them all out', () => {
  const s = fight(1), aitor = turn(s, 'aitor');
  aitor.kit = ['sincopante', 'tecnopata'];
  act(s, 'skill', 'dog-0', 'ostinato');
  s.phase = 'player'; tick(s, 5.05);
  const whole = takeEcoNews(s)[0].hits[0].amount;
  turn(s, 'aitor'); assert.ok(wearAnima(s, 'tecnopata'));
  tick(s, 5);
  const muffled = takeEcoNews(s)[0];
  assert.equal(muffled.muffled, true); assert.ok(muffled.hits[0].amount <= Math.ceil(whole * ECOS.muffled) + 1 && muffled.hits[0].amount < whole);
  aitor.hp = 0; tick(s, .1);
  const out = takeEcoNews(s).find(n => n.kind === 'out');
  assert.equal(out.fell, true); assert.equal(s.ecos.length, 0);
});

test('A contratiempo: acting in the off-beat makes every eco sound once more at once, their clocks untouched', () => {
  const s = fight(3); turn(s, 'aitor');
  act(s, 'skill', 'dog-0', 'ostinato');
  s.phase = 'player'; takeEcoNews(s);
  tick(s, 2.5);
  assert.ok(offbeat(s));
  const left = s.ecos[0].left;
  turn(s, 'aitor');
  const effect = act(s, 'attack', 'dog-1');
  assert.ok(effect.passives?.some(p => p.id === 'a-contratiempo'));
  const accent = takeEcoNews(s).find(n => n.kind === 'pulse');
  assert.equal(accent.accent, true); assert.equal(s.ecos[0].left, left);
  // On the beat, or before level 3, nothing more.
  const t = fight(2); turn(t, 'aitor'); act(t, 'skill', 'dog-0', 'ostinato'); t.phase = 'player'; tick(t, 2.5); takeEcoNews(t);
  turn(t, 'aitor'); act(t, 'attack', 'dog-1');
  assert.ok(!takeEcoNews(t).some(n => n.accent));
});

test('Pedal: while the wearer holds on, their ecos\' clocks stand still and they keep sounding', () => {
  const s = fight(6); turn(s, 'aitor');
  act(s, 'skill', 'dog-0', 'ostinato');
  s.phase = 'player'; tick(s, 3);
  turn(s, 'aitor');
  const held = act(s, 'defend');
  assert.ok(held.passives?.some(p => p.id === 'pedal')); assert.equal(by(s, 'aitor').pedal, true);
  const left = s.ecos[0].left;
  s.phase = 'player'; takeEcoNews(s); tick(s, 30);
  assert.equal(s.ecos[0].left, left, 'its clock stood still');
  assert.equal(takeEcoNews(s).filter(n => n.kind === 'pulse').length, 6, 'and it kept sounding');
  turn(s, 'aitor'); act(s, 'attack', 'dog-1');
  assert.equal(by(s, 'aitor').pedal, undefined, 'until they act again');
});

test('Acompañamiento: an eco at an ally\'s side repeats each of their blows with a light astral note', () => {
  const s = fight(5); turn(s, 'aitor');
  const called = act(s, 'skill', 'gerard', 'acompanamiento');
  assert.equal(called.ecoCalled.kind, 'acompanamiento'); assert.equal(called.ecoCalled.target, 'gerard');
  turn(s, 'gerard');
  const blow = act(s, 'attack', 'dog-2');
  assert.equal(blow.accompanied.hits[0].target, 'dog-2'); assert.ok(blow.accompanied.hits[0].amount > 0);
  // It does not sound on the beat by itself.
  s.phase = 'player'; takeEcoNews(s); tick(s, 5.05);
  assert.ok(!takeEcoNews(s).some(n => n.kind === 'pulse'));
});

test('Tutti: a high astral blow on every foe, then each eco\'s last note twice as strong, and they are gone', () => {
  const s = fight(7); turn(s, 'aitor');
  act(s, 'skill', 'dog-0', 'ostinato');
  by(s, 'gerard').hp = 50; turn(s, 'aitor'); act(s, 'skill', 'gerard', 'bordon');
  turn(s, 'aitor');
  const effect = act(s, 'skill', undefined, 'tutti');
  assert.equal(effect.hits.length, 3);
  assert.equal(effect.tutti.length, 2);
  assert.ok(effect.tutti.find(t => t.kind === 'ostinato').hits[0].amount > 0);
  assert.equal(effect.tutti.find(t => t.kind === 'bordon').hits[0].heal, true);
  assert.equal(s.ecos.length, 0); assert.equal(s.compas, undefined);
  assert.equal(SKILLS.find(k => k.id === 'tutti').cost, 3);
});

test('Da capo: the duals already used can go off again, everyone\'s maná fills and the ecos start over; once a fight', () => {
  const s = fight(7, ['sincopante:definitiva', 'tecnopata:explosion']);
  const gerard = by(s, 'gerard'), aitor = by(s, 'aitor');
  s.usedDuals = ['rayo-solar'];
  gerard.secondary = 0; aitor.secondary = 0; gerard.mana = { tecnopata: 0 };
  for (let i = 0; i < 3; i++) { turn(s, 'aitor'); act(s, 'skill', `dog-${i}`, 'ostinato'); }
  s.phase = 'player'; tick(s, 5.05);
  s.ecos.forEach(e => { e.left = 3; });
  turn(s, 'aitor'); aitor.secondary = 0;
  const effect = act(s, 'skill', undefined, 'da-capo');
  assert.deepEqual(effect.dacapo.duals, ['rayo-solar']); assert.equal(s.usedDuals, undefined);
  assert.equal(gerard.secondary, gerard.maxSecondary); assert.equal(gerard.mana, undefined, 'every ánima, worn or not');
  assert.equal(aitor.secondary, aitor.maxSecondary);
  assert.ok(s.ecos.every(e => e.left === ECOS.life));
  assert.ok(!capoReady(s), 'once a fight'); assert.ok(!ids(s, 'aitor').includes('da-capo'));
});

const FIRE_TO_VULCANO = ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion', 'matemagico:vulcano'];
/** Da capo awake and used by Aitor now. */
const daCapo = s => { s.dacapo = { woke: true }; turn(s, 'aitor'); return act(s, 'skill', undefined, 'da-capo'); };

test('Da capo gives back the dúos mayores too, and one played again while it still sounds starts over: never two at once', () => {
  const s = fight(7, ['sincopante:definitiva', ...FIRE_TO_VULCANO]);
  turn(s, 'gerard');
  assert.ok(actDual(s, 'vulcano'), 'Vulcano, a dúo mayor');
  s.phase = 'player'; tick(s, 6);
  assert.ok(s.foes.every(f => f.timed.volcan.left < TIMED.volcan.seconds));
  const effect = daCapo(s);
  assert.deepEqual(effect.dacapo.duals, ['vulcano']);
  turn(s, 'gerard');
  assert.ok(actDual(s, 'vulcano'), 'the dúo mayor goes off a second time');
  assert.ok(s.foes.every(f => f.timed.volcan.left === TIMED.volcan.seconds && f.timed.volcan.level === 1), 'its clock and its strength over');
  turn(s, 'gerard');
  assert.equal(actDual(s, 'vulcano'), undefined, 'and once more is once more: it is spent again');
});

test('a dual that leaves an eco in one foe, played again on another, takes it from the first: Staccato', () => {
  const s = fight(7, ['sincopante:definitiva']);
  const gerard = by(s, 'gerard');
  gerard.classId = 'papagato'; s.levels = { ...s.levels, papagato: 7 }; gerard.maxSecondary = manaMax(s.improved, 'papagato', s.levels);
  turn(s, 'gerard');
  assert.ok(actDual(s, 'staccato', 'dog-0'));
  assert.ok(by(s, 'dog-0').timed.staccato);
  daCapo(s);
  turn(s, 'gerard');
  assert.ok(actDual(s, 'staccato', 'dog-2'));
  assert.equal(by(s, 'dog-0').timed?.staccato, undefined, 'the old one is gone');
  assert.equal(by(s, 'dog-2').timed.staccato.left, TIMED.staccato.seconds);
});

test('Da capo brings Dadista\'s hand back to the dice it started with, never to six, and never cuts a hand past that', () => {
  const s = fight(7, ['sincopante:definitiva']);
  const gerard = by(s, 'gerard');
  gerard.classId = 'dadaista'; s.levels = { ...s.levels, dadaista: 7 }; gerard.maxSecondary = manaMax(s.improved, 'dadaista', s.levels);
  const start = gerard.maxSecondary;
  gerard.secondary = 1; diceOf(s, gerard);
  daCapo(s);
  assert.equal(gerard.secondary, start); assert.equal(diceOf(s, gerard).length, start);
  assert.ok(start < 6);
  // A hand past its top (the hand up to six) is kept as it is.
  const t = fight(7, ['sincopante:definitiva']), other = by(t, 'gerard');
  other.classId = 'dadaista'; t.levels = { ...t.levels, dadaista: 7 }; other.maxSecondary = manaMax(t.improved, 'dadaista', t.levels);
  other.secondary = other.maxSecondary + 1;
  daCapo(t);
  assert.equal(other.secondary, other.maxSecondary + 1);
});

test('A dual is an action too: an eco at either one\'s side repeats it once', () => {
  // Vulcano, the dúo mayor of Matemágico's Foc Binari and Sincopante's Ostinato.
  const s = fight(5, ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion', 'matemagico:vulcano']);
  assert.ok(DUALS.find(d => d.id === 'vulcano').parts.includes('ostinato'));
  turn(s, 'aitor'); act(s, 'skill', 'gerard', 'acompanamiento');
  turn(s, 'gerard'); by(s, 'aitor').secondary = by(s, 'aitor').maxSecondary;
  const effect = actDual(s, 'vulcano', 'dog-0');
  assert.ok(effect?.dual, 'the dual went off');
  assert.ok(effect.accompanied?.hits.length, 'and the eco at Gerard\'s side repeated it once');
});
