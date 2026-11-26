import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, enemyAct, nextRound, improve, inflict, runClock, pulseDamage, skillsFor, validTargets, cortinaRounds, finaleReady, CORTINA, POWDER_RULES, POWDER_TURNS, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Colorista's powder (docs/animas/README.md § Empolvado): it does nothing by itself and waits for a
// blow of an element. Fire blows it up, water turns it to poison, electricity to shards.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'prismatico' }];
const ELEMENTS = ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'];
/** Gerard (Matemágico, with the elements and `nodes`) and Aitor (Colorista) against three sturdy dogs. */
function fight(nodes = [], level = 1) {
  const s = createBattle(PARTY, 3, false, undefined, ['matemagico', 'prismatico']);
  s.levels = { prismatico: level };
  improve(s, improvedBy([...ELEMENTS, ...nodes]));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full; Gerard's Atacar carrying `element`. */
const turn = (s, id, element) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; if (element) by(s, id).element = element; else delete by(s, id).element; return by(s, id); };
const dusty = () => ({ level: 1, left: TIMED.empolvado.seconds, next: TIMED.empolvado.every });
/** Powder on `foes` (by index), as a handful leaves it. */
const powder = (s, ...foes) => foes.forEach(i => { s.foes[i].timed = { ...s.foes[i].timed, empolvado: dusty() }; });

test('Puñado: a light physical blow that leaves its target Empolvado for 20 seconds, which hurts nobody', () => {
  const s = fight();
  assert.deepEqual(skillsFor(s, by(s, 'aitor')).map(k => k.id), ['punado', 'cortina']);
  const a = turn(s, 'aitor'), e = act(s, 'skill', 'dog-0', 'punado');
  assert.equal(a.secondary, a.maxSecondary - 1); assert.ok(e.amount > 0);
  assert.deepEqual(e.afflicted, { id: 'empolvado', level: 1 });
  assert.equal(s.foes[0].timed.empolvado.left, 20);
  const hp = s.foes[0].hp;
  assert.deepEqual(runClock(s, 19), []); assert.equal(s.foes[0].hp, hp); assert.ok(s.foes[0].timed.empolvado);
  runClock(s, 1.1); assert.equal(s.foes[0].timed.empolvado, undefined);
  // Powder on someone burning or wet does nothing to them: only a blow of an element sets it off.
  const t = fight(); inflict(t.foes[0], 'quemado'); t.foes[1].timed = { mojado: { level: 1, left: 20, next: 20 } };
  turn(t, 'aitor'); assert.equal(act(t, 'skill', 'dog-0', 'punado').reaction, undefined);
  turn(t, 'aitor'); assert.equal(act(t, 'skill', 'dog-1', 'punado').reaction, undefined);
  assert.ok(t.foes[0].timed.quemado && t.foes[0].timed.empolvado && t.foes[1].timed.mojado && t.foes[1].timed.empolvado);
});

test('Estallido: fire on powder explodes on its carrier and half as hard on the others, and every foe burns a level more', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'fuego');
  const hp = s.foes.map(f => f.hp), e = act(s, 'attack', 'dog-0');
  assert.equal(e.reaction.id, 'estallido');
  const hits = Object.fromEntries(e.reaction.hits.map(h => [h.target, h.amount]));
  assert.deepEqual(Object.keys(hits), ['dog-0', 'dog-1', 'dog-2']);
  assert.ok(hits['dog-0'] > hits['dog-1'] && hits['dog-1'] === hits['dog-2'] && hits['dog-1'] > 0);
  assert.equal(hp[0] - s.foes[0].hp, e.amount + hits['dog-0']); assert.equal(hp[1] - s.foes[1].hp, hits['dog-1']);
  assert.deepEqual(e.reaction.burns, [{ target: 'dog-0', level: 1 }, { target: 'dog-1', level: 1 }, { target: 'dog-2', level: 1 }]);
  assert.ok(s.foes.every(f => f.timed.quemado.level === 1 && !f.timed.empolvado));
  // No powder: only the blow.
  const dry = fight(); turn(dry, 'gerard', 'fuego');
  assert.equal(act(dry, 'attack', 'dog-0').reaction, undefined);
});

test('Estallido runs in a chain: one fire sets off every powdered foe, each once, and they all burn one level more, not one each', () => {
  const one = fight(); powder(one, 0); turn(one, 'gerard', 'fuego');
  const alone = Object.fromEntries(act(one, 'attack', 'dog-0').reaction.hits.map(h => [h.target, h.amount]));
  const s = fight(); powder(s, 0, 1, 2); inflict(s.foes[2], 'quemado');
  turn(s, 'gerard', 'fuego');
  const e = act(s, 'attack', 'dog-0'), hits = Object.fromEntries(e.reaction.hits.map(h => [h.target, h.amount]));
  // Each took its own blast and the two others' halves.
  assert.equal(hits['dog-0'], alone['dog-0'] + 2 * alone['dog-1']); assert.equal(hits['dog-1'], hits['dog-0']);
  assert.ok(s.foes.every(f => !f.timed.empolvado));
  assert.deepEqual(s.foes.map(f => f.timed.quemado.level), [1, 1, 2]);
});

test('Foc Binari on powder is Estallido in place of its own fire, and fire that fells the carrier still blows its powder up', () => {
  const s = fight(); powder(s, 1);
  turn(s, 'gerard');
  const e = act(s, 'skill', 'dog-1', 'foc-binari');
  assert.equal(e.reaction.id, 'estallido'); assert.equal(e.burn, undefined);
  assert.deepEqual(s.foes.map(f => f.timed.quemado.level), [1, 1, 1]);
  const t = fight(); powder(t, 0); t.foes[0].hp = 1;
  turn(t, 'gerard', 'fuego');
  const hp = t.foes[1].hp, last = act(t, 'attack', 'dog-0');
  assert.equal(t.foes[0].hp, 0); assert.equal(last.reaction.id, 'estallido');
  assert.ok(t.foes[1].hp < hp && t.foes[1].timed.quemado && !t.foes[0].timed?.quemado);
});

test('Envenenado: water on powder leaves poison that pulses and makes every blow land a quarter harder, and no Mojado', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'agua');
  const e = act(s, 'attack', 'dog-0');
  assert.deepEqual(e.reaction, { id: 'veneno', level: 1, targets: ['dog-0'] });
  assert.equal(e.amplified, undefined, 'the blow that poisons is not made heavier by it');
  assert.deepEqual(Object.keys(s.foes[0].timed), ['envenenado']);
  // The same blow on the poisoned one and on a clean one.
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  turn(s, 'aitor'); const heavy = act(s, 'attack', 'dog-0');
  assert.equal(heavy.amount, Math.round(clean * POWDER_RULES.poison));
  assert.deepEqual(heavy.amplified, [{ target: 'dog-0', venom: true }]);
  // It pulses on the fight's clock, and poisoned again it climbs a level and starts over.
  const hp = s.foes[0].hp, pulses = runClock(s, TIMED.envenenado.every);
  assert.deepEqual(pulses, [{ target: 'dog-0', status: 'envenenado', level: 1, amount: pulseDamage('envenenado', 1, 999) }]);
  assert.equal(hp - s.foes[0].hp, pulses[0].amount);
  powder(s, 0); turn(s, 'gerard', 'agua');
  assert.equal(act(s, 'attack', 'dog-0').reaction.level, 2);
  assert.equal(s.foes[0].timed.envenenado.left, TIMED.envenenado.seconds);
  runClock(s, TIMED.envenenado.seconds + .1); assert.equal(s.foes[0].timed.envenenado, undefined);
});

test('water on everyone poisons whoever is powdered and leaves the rest Mojado', () => {
  const s = fight(['matemagico:vasos']); powder(s, 1);
  turn(s, 'gerard');
  const e = act(s, 'skill', undefined, 'vasos');
  assert.deepEqual(e.hits.map(h => h.burn), [{ id: 'mojado', level: 1 }, undefined, { id: 'mojado', level: 1 }]);
  assert.equal(e.reaction.id, 'veneno'); assert.deepEqual(e.reaction.targets, ['dog-1']);
  assert.ok(!s.foes[1].timed.mojado && !s.foes[1].timed.empolvado && s.foes[1].timed.envenenado);
});

test('Cristalizado: electricity on powder leaves shards, and each blow that lands does more than the one before, up to a cap', () => {
  const s = fight(); powder(s, 0);
  turn(s, 'gerard', 'electrico');
  const e = act(s, 'attack', 'dog-0');
  assert.deepEqual(e.reaction, { id: 'cristal', targets: ['dog-0'] });
  assert.equal(e.amplified, undefined, 'the bolt that sets them is not driven in by them');
  assert.deepEqual(Object.keys(s.foes[0].timed), ['cristalizado']); assert.equal(s.foes[0].timed.cristalizado.level, 1);
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  const extras = [];
  for (let i = 0; i < 7; i++) { turn(s, 'aitor'); const blow = act(s, 'attack', 'dog-0'); extras.push(blow.amount - clean); assert.deepEqual(blow.amplified, [{ target: 'dog-0', shards: blow.amount - clean }]); }
  assert.deepEqual(extras, [4, 8, 12, 16, 20, 20, 20]);
  assert.equal(POWDER_RULES.shard * POWDER_RULES.shards, 20);
  // Crystallised again: the shards stay as deep, the clock starts over. Then it runs out.
  runClock(s, 5); powder(s, 0); turn(s, 'gerard', 'electrico'); act(s, 'attack', 'dog-0');
  assert.equal(s.foes[0].timed.cristalizado.level, 5); assert.equal(s.foes[0].timed.cristalizado.left, TIMED.cristalizado.seconds);
  runClock(s, TIMED.cristalizado.seconds + .1); assert.equal(s.foes[0].timed.cristalizado, undefined);
});

test('poison and shards together: the quarter first, the shards on top', () => {
  const s = fight();
  s.foes[0].timed = { envenenado: { level: 1, left: 20, next: 20 }, cristalizado: { level: 2, left: 20, next: 20 } };
  turn(s, 'aitor'); const clean = act(s, 'attack', 'dog-1').amount;
  turn(s, 'aitor'); const blow = act(s, 'attack', 'dog-0');
  assert.equal(blow.amount, Math.round(clean * POWDER_RULES.poison) + 2 * POWDER_RULES.shard);
  assert.deepEqual(blow.amplified, [{ target: 'dog-0', shards: 8, venom: true }]);
});

// ——— The cortina, Rebufo and the rest of the levels (docs/animas/prismatico/) ———
/** The foes' turn: `foe` (by index) strikes `ally`. */
const strike = (s, foe, ally) => { s.phase = 'enemy'; s.enemyActions = s.enemyActions.filter(id => id !== s.foes[foe].id); return enemyAct(s, s.foes[foe].id, ally); };
/** The round ends with nobody else acting. */
const endRound = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); nextRound(s); };

test('Cortina: Defensa for the party and a screen in front of one ally that halves the next blow, breaks, and powders whoever broke it (Rebufo)', () => {
  const s = fight(), plain = fight();
  const a = turn(s, 'aitor');
  assert.deepEqual(validTargets(s, 'skill', 'cortina').map(c => c.id), ['gerard', 'aitor']);
  const e = act(s, 'skill', 'gerard', 'cortina');
  assert.equal(a.secondary, a.maxSecondary - 1);
  assert.deepEqual(e.boosted, ['gerard', 'aitor']); assert.deepEqual(e.cortina, { raised: ['gerard'] });
  assert.equal(s.boosts.cortina.amount, 3);
  assert.equal(cortinaRounds(s, by(s, 'gerard')), CORTINA.rounds); assert.equal(cortinaRounds(s, by(s, 'aitor')), 0);
  // The same blow with the Defensa and no screen, to measure the half against.
  turn(plain, 'aitor'); act(plain, 'skill', 'gerard', 'cortina'); delete by(plain, 'gerard').cortina;
  const whole = strike(plain, 0, 'gerard').amount, blow = strike(s, 0, 'gerard');
  assert.equal(blow.amount, Math.ceil(whole * CORTINA.share));
  assert.deepEqual(blow.cortina, { broke: ['gerard'], rebufo: 'dog-0' });
  assert.equal(plain.foes[0].timed?.empolvado, undefined); assert.equal(s.foes[0].timed.empolvado.left, TIMED.empolvado.seconds);
  assert.match(s.message, /La cortina revienta sobre/);
  // One blow, one cortina: the next lands whole, and powders nobody.
  const next = strike(s, 1, 'gerard');
  assert.equal(next.amount, whole); assert.equal(next.cortina, undefined); assert.equal(s.foes[1].timed?.empolvado, undefined);
  // The Defensa it came with is still up, and the screen can be raised again while it is.
  turn(s, 'aitor'); assert.ok(validTargets(s, 'skill', 'cortina').length);
});

test('a cortina lets pulses through, stands three rounds if nobody breaks it, and Defender\'s third comes on top of its half', () => {
  const s = fight();
  turn(s, 'aitor'); act(s, 'skill', 'aitor', 'cortina');
  const a = by(s, 'aitor');
  inflict(a, 'quemado'); const hp = a.hp; runClock(s, TIMED.quemado.every + .1);
  assert.ok(a.hp < hp, 'the fire pulses'); assert.equal(cortinaRounds(s, a), 3, 'and the screen still stands');
  delete a.timed.quemado;
  endRound(s); assert.equal(cortinaRounds(s, a), 2);
  endRound(s); assert.equal(cortinaRounds(s, a), 1);
  endRound(s); assert.equal(a.cortina, undefined); assert.equal(s.boosts?.cortina && s.boosts.cortina.until >= s.round, false);
  // Guarding behind one: a third, then half of that.
  const t = fight(), plain = fight();
  const whole = strike(plain, 0, 'aitor').amount;
  by(t, 'aitor').cortina = t.round; by(t, 'aitor').guarding = true;
  assert.equal(strike(t, 0, 'aitor').amount, Math.ceil(Math.ceil(whole / 3) * CORTINA.share));
});

test('Rociada (level 2): water on every foe that wets nobody, poisons the powdered and puts a fire out into smoke', () => {
  assert.ok(!skillsFor(fight(), by(fight(), 'aitor')).some(k => k.id === 'rociada'));
  const s = fight([], 2); powder(s, 0); inflict(s.foes[1], 'quemado');
  const a = turn(s, 'aitor'), e = act(s, 'skill', undefined, 'rociada');
  assert.equal(a.secondary, a.maxSecondary - 2); assert.equal(e.element, 'agua');
  assert.ok(e.hits.every(h => h.amount > 0));
  assert.equal(e.reaction.id, 'veneno'); assert.deepEqual(e.reaction.targets, ['dog-0']);
  assert.ok(s.foes[0].timed.envenenado && !s.foes[0].timed.empolvado);
  assert.ok(s.foes[1].timed.cegado && !s.foes[1].timed.quemado, 'water on a fire is smoke, whoever throws it');
  assert.equal(s.foes.some(f => f.timed?.mojado), false);
  assert.equal(s.foes[2].timed, undefined);
});

test('Polvareda (level 3): a light physical blow on every foe that leaves them all Empolvado, for one fire to set off in a chain', () => {
  const s = fight([], 3);
  const a = turn(s, 'aitor'), e = act(s, 'skill', undefined, 'polvareda');
  assert.equal(a.secondary, a.maxSecondary - 2);
  assert.deepEqual(e.hits.map(h => h.burn), s.foes.map(() => ({ id: 'empolvado', level: 1 })));
  assert.ok(s.foes.every(f => f.timed.empolvado.left === TIMED.empolvado.seconds));
  turn(s, 'gerard', 'fuego');
  const blast = act(s, 'attack', 'dog-0').reaction;
  assert.equal(blast.id, 'estallido'); assert.equal(blast.hits.length, 3);
  assert.ok(s.foes.every(f => !f.timed.empolvado && f.timed.quemado.level === 1));
});

test('Remolino (level 5): each time a foe\'s powder turns into something, a cortina stands in front of whoever wears Colorista', () => {
  const low = fight([], 4); powder(low, 0);
  turn(low, 'gerard', 'electrico');
  const none = act(low, 'attack', 'dog-0');
  assert.equal(none.cortina, undefined); assert.equal(none.passives, undefined); assert.equal(by(low, 'aitor').cortina, undefined);
  const s = fight([], 5); powder(s, 0, 1);
  turn(s, 'gerard', 'electrico');
  const e = act(s, 'attack', 'dog-0');
  assert.deepEqual(e.cortina, { raised: ['aitor'] });
  assert.deepEqual(e.passives, [{ id: 'remolino', name: 'Remolino', who: 'aitor' }]);
  assert.equal(cortinaRounds(s, by(s, 'aitor')), CORTINA.rounds);
  // The first foe to strike its wearer takes half and is powdered again: the next element already has its powder.
  const blow = strike(s, 2, 'aitor');
  assert.deepEqual(blow.cortina, { broke: ['aitor'], rebufo: 'dog-2' }); assert.ok(s.foes[2].timed.empolvado);
  // Nobody wearing it standing: no screen.
  by(s, 'aitor').hp = 0;
  turn(s, 'gerard', 'agua');
  assert.equal(act(s, 'attack', 'dog-1').cortina, undefined);
});

test('Telón (level 6): a cortina in front of everyone, and its Defensa does not add to Cortina\'s', () => {
  const s = fight([], 6);
  turn(s, 'aitor'); act(s, 'skill', 'gerard', 'cortina');
  const a = turn(s, 'aitor'), e = act(s, 'skill', undefined, 'telon');
  assert.equal(a.secondary, a.maxSecondary - 2);
  assert.deepEqual(e.cortina, { raised: ['gerard', 'aitor'] });
  assert.equal(s.boosts.cortina, undefined); assert.equal(s.boosts.telon.amount, 3);
  assert.ok(s.allies.every(c => cortinaRounds(s, c) === CORTINA.rounds));
  const first = strike(s, 0, 'gerard'), second = strike(s, 1, 'aitor');
  assert.equal(first.cortina.rebufo, 'dog-0'); assert.equal(second.cortina.rebufo, 'dog-1');
  assert.ok(s.foes[0].timed.empolvado && s.foes[1].timed.empolvado && !s.foes[2].timed?.empolvado);
});

test('Traca (level 7): five light blows on foes at random, each its own, and every foe it touches is left Empolvado', () => {
  const s = fight([], 7);
  const a = turn(s, 'aitor'), e = act(s, 'skill', undefined, 'traca');
  assert.equal(a.secondary, a.maxSecondary - 3);
  assert.equal(e.volley.length, 5); assert.ok(e.volley.every(v => v.amount > 0));
  assert.equal(e.amount, e.volley.reduce((sum, v) => sum + v.amount, 0));
  const touched = [...new Set(e.volley.map(v => v.target))];
  assert.deepEqual(e.hits.map(h => h.target), touched);
  for (const f of s.foes) assert.equal(!!f.timed?.empolvado, touched.includes(f.id), f.id);
  assert.ok(e.hits.every(h => h.burn.id === 'empolvado' && h.amount === e.volley.filter(v => v.target === h.target).reduce((sum, v) => sum + v.amount, 0)));
  // On one foe full of shards, each puff does more than the last.
  const t = fight([], 7); t.foes[1].hp = t.foes[2].hp = 0;
  t.foes[0].timed = { cristalizado: { level: 1, left: 20, next: 20 } };
  turn(t, 'aitor');
  const amounts = act(t, 'skill', undefined, 'traca').volley.map(v => v.amount);
  assert.deepEqual(amounts.map(n => n - amounts[0]), [0, 4, 8, 12, 16]);
});

test('Fin de fiesta: bought at the jar, it wakes once the powder has been all three things, goes off once for no maná and leaves every foe burning, poisoned and full of shards', () => {
  // Not bought: the three reactions wake nothing.
  const none = fight(); none.finale = { seen: [...POWDER_TURNS] };
  assert.equal(finaleReady(none), false);
  const s = fight(['prismatico:definitiva']);
  const skills = () => skillsFor(s, by(s, 'aitor')).map(k => k.id);
  assert.ok(!skills().includes('fin-de-fiesta'));
  const turns = [['fuego', 'estallido'], ['agua', 'veneno'], ['electrico', 'cristal']];
  turns.forEach(([element, id], i) => {
    powder(s, 0); turn(s, 'gerard', element);
    const e = act(s, 'attack', 'dog-0');
    assert.equal(e.reaction.id, id);
    assert.equal(e.awoken, i === 2 ? 'fin-de-fiesta' : undefined);
    assert.equal(finaleReady(s), i === 2);
  });
  // Awake, it heads the list: not below the fold of what the ánima already knows.
  assert.equal(skills()[0], 'fin-de-fiesta');
  s.foes.forEach(f => { delete f.timed; });
  const a = turn(s, 'aitor'); a.secondary = 0;
  const hp = s.foes.map(f => f.hp), e = act(s, 'skill', undefined, 'fin-de-fiesta');
  assert.equal(a.secondary, 0, 'no maná');
  assert.equal(e.finale.hits.length, 3); assert.ok(s.foes.every((f, i) => f.hp === hp[i] - e.finale.hits[i].amount && e.finale.hits[i].amount > 0));
  // Every puff blew up: each foe took its own blast and half of the other two.
  assert.equal(new Set(e.finale.hits.map(h => h.amount)).size, 1);
  assert.deepEqual(e.finale.burns.map(b => b.level), [1, 1, 1]);
  assert.deepEqual(e.finale.poisoned, s.foes.map(f => ({ target: f.id, level: 1 })));
  assert.deepEqual(e.finale.crystallised, s.foes.map(f => f.id));
  assert.equal(e.reaction, undefined); assert.equal(e.awoken, undefined);
  for (const f of s.foes) assert.deepEqual(Object.keys(f.timed).sort(), ['cristalizado', 'envenenado', 'quemado']);
  // Once a fight.
  assert.equal(finaleReady(s), false); assert.ok(!skills().includes('fin-de-fiesta'));
  turn(s, 'aitor'); assert.equal(act(s, 'skill', undefined, 'fin-de-fiesta'), undefined);
});

test('Fin de fiesta: every way the powder turns counts to wake it, Atractor extraño bringing a fire to it and a beat of Corriente alterna too', () => {
  // Atractor extraño: the fire of another foe comes to the powdered one and sets it off; that is the third thing it has been.
  const s = fight(['prismatico:definitiva', 'matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:atractor']);
  s.finale = { seen: ['veneno', 'cristal'] };
  powder(s, 0); inflict(s.foes[1], 'quemado');
  turn(s, 'gerard');
  const e = act(s, 'skill', 'dog-0', 'atractor');
  assert.equal(e.gathered[0].reactions[0].id, 'estallido');
  assert.equal(e.awoken, 'fin-de-fiesta'); assert.equal(finaleReady(s), true);
  // Powder that comes to a wet foe turns into poison there, and counts the same.
  const w = fight(['prismatico:definitiva', 'matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:atractor']);
  w.foes[0].timed = { mojado: { level: 1, left: 20, next: 20 } }; powder(w, 1);
  turn(w, 'gerard'); act(w, 'skill', 'dog-0', 'atractor');
  assert.deepEqual(w.finale.seen, ['veneno']);
  // Corriente alterna: a beat is a bolt for the reactions, so on powder it makes shards, out of anyone's turn.
  const c = fight(['prismatico:definitiva']);
  c.finale = { seen: ['estallido', 'veneno'] };
  powder(c, 1);
  c.circuits = [{ poles: ['dog-1', 'dog-0'], by: 'gerard', beat: 0, left: 20, next: 5 }];
  c.phase = 'player';
  const beat = runClock(c, 5.01).find(p => p.status === 'alterna');
  assert.equal(beat.target, 'dog-1'); assert.equal(beat.reaction.id, 'cristal');
  assert.equal(beat.awoken, 'fin-de-fiesta'); assert.equal(finaleReady(c), true);
  // Without Colorista worn by someone standing, nothing is counted.
  const off = fight(['prismatico:definitiva']);
  by(off, 'aitor').hp = 0; powder(off, 1);
  off.circuits = [{ poles: ['dog-1', 'dog-0'], by: 'gerard', beat: 0, left: 20, next: 5 }];
  off.phase = 'player';
  assert.equal(runClock(off, 5.01).find(p => p.status === 'alterna').reaction.id, 'cristal');
  assert.equal(off.finale, undefined);
});
