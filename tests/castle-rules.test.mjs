import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE, GUM_ORDER, SHREWD, closestToFalling } from '../src/castle.ts';
import { castleAfter, castleAffinity, castleBlow, castleChips, castleIdle, castleRoundEnd, castleTaken } from '../src/castle-fight.ts';
import { act, affinityOf, chooseElement, createFearBattle, enemyAct, improve, intentLabel, stageMoment, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// What the castle's foes are made of and how its three bosses play (docs/castle.md § Weaknesses,
// docs/castle-bosses.md): the gum by its year, each pupil's own, the ring, and the bosses' rules.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
const NODES = ['matemagico:fuego', 'matemagico:agua', 'matemagico:vasos', 'matemagico:electrico', 'matemagico:descarga'];
function fight(encounter) {
  const s = createFearBattle(PARTY, encounter);
  improve(s, improvedBy(NODES));
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const of = (s, kind) => s.foes.find(f => f.kind === kind);
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const foeTurn = (s, foe, target = 'gerard') => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, foe.id, target); };
const wet = () => ({ level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every });
const blind = () => ({ level: 1, left: TIMED.cegado.seconds, next: TIMED.cegado.every });
/** Gerard's Atacar carrying `element` on `foe`. */
const strike = (s, foe, element) => { const g = turn(s, 'gerard'); assert.ok(chooseElement(s, g, element)); return act(s, 'attack', foe.id); };
/** The fight's tools as the rules borrow them, for calling the rules directly. */
const KIT = { changeHealth: (c, delta) => { const before = c.hp; c.hp = Math.max(0, Math.min(c.maxHp, c.hp + delta)); return Math.abs(before - c.hp); } };
const chips = (s, c) => castleChips(s, c).map(([id]) => id);
const keys = ['fuego', 'agua', 'electrico', 'fisico'];
const made = c => Object.fromEntries(keys.flatMap(key => { const a = castleAffinity(c, key); return a ? [[key, a]] : []; }));

test('the gum by its year: fresh melts, a filling gives to what undoes it, rancid breaks under blows and softens when wet', () => {
  const first = of(fight('alumnos-1b'), 'empollon');
  assert.deepEqual(made(first), { fuego: 'weak' });
  const second = of(fight('alumnos-2b'), 'empollon');
  second.castle.filling = 'fuego';
  assert.deepEqual(made(second), { fuego: 'resist', agua: 'weak' });
  second.castle.filling = 'agua';
  assert.deepEqual(made(second), { agua: 'resist', electrico: 'weak' });
  second.castle.filling = 'electrico';
  assert.deepEqual(made(second), { fuego: 'weak', electrico: 'resist' });
  const s = fight('alumnos-3b'), third = of(s, 'empollon');
  assert.deepEqual(made(third), { fuego: 'resist', fisico: 'weak' });
  third.timed = { mojado: wet() };
  assert.deepEqual(made(third), { fuego: 'weak', fisico: 'weak' }, 'wet, it is soft again');
  assert.ok(chips(s, third).includes('reblandecido'));
  assert.equal(affinityOf(third, 'fisico'), 'weak', 'the fight asks the same rule');
});

test('a second-year pupil shows its filling, hits with it, and spills it on the others when it falls', () => {
  const s = fight('alumnos-2a'), [chivata, repetidor, empollon] = s.foes;
  chivata.castle.filling = 'agua'; repetidor.castle.filling = 'electrico'; empollon.castle.filling = 'fuego';
  assert.ok(chips(s, chivata).includes('relleno-agua'), 'on its plate from the start');
  // La Chivata has marked someone already, so she pinches: her water goes with it.
  by(s, 'aitor').castle = { marked: true };
  const pinch = foeTurn(s, chivata, 'gerard');
  assert.equal(pinch.ability.id, 'pellizco');
  assert.ok(by(s, 'gerard').timed?.mojado, 'water inside: whoever it hits is left wet');
  // El Empollón's fire burns.
  foeTurn(s, empollon, 'aitor');
  assert.ok(by(s, 'aitor').timed?.quemado);
  // She falls: her water spills on the other two.
  chivata.hp = 0; castleAfter(KIT, s);
  assert.ok(repetidor.timed?.mojado && empollon.timed?.mojado);
  assert.ok(chivata.castle.spilled);
  // El Repetidor falls: its spark runs through whoever is wet, and costs them their turn.
  const before = empollon.hp;
  repetidor.hp = 0; castleAfter(KIT, s);
  assert.equal(empollon.hp, before - CASTLE.derrame);
  assert.ok(empollon.shock && !empollon.timed?.mojado);
});

test('Los Gemelos are weak to a spark, and one on a twin passes to the other', () => {
  const s = fight('alumnos-1c'), [one, two] = s.foes;
  assert.equal(castleAffinity(one, 'electrico'), 'weak');
  const before = two.hp, e = strike(s, one, 'electrico');
  assert.equal(e.affinity, 'weak');
  assert.ok(e.amount > 0 && two.hp < before, 'the twin takes its share');
  assert.equal(before - two.hp, Math.max(1, Math.round(e.amount * CASTLE.salto)));
  assert.ok(e.called?.some(c => c.target === two.id && c.text === 'Pasa al otro'));
});

test('El Empollón does not know the kind of blow it has not learned, and forgets what it learned when confused', () => {
  const s = fight('alumnos-1b'), empollon = of(s, 'empollon');
  assert.equal(castleTaken(s, empollon, 'physical'), 1);
  empollon.castle.learned = 'magic';
  assert.equal(castleTaken(s, empollon, 'magic'), CASTLE.learned);
  assert.equal(castleTaken(s, empollon, 'physical'), CASTLE.noSabe);
  assert.equal(castleBlow(empollon, 'physical'), 'weak'); assert.equal(castleBlow(empollon, 'magic'), 'resist');
  const hit = turn(s, 'aitor') && act(s, 'attack', empollon.id);
  assert.deepEqual(hit.kinds, [{ target: empollon.id, blow: 'physical', affinity: 'weak' }], 'the blow says it found it');
  empollon.castle.learned = 'physical';
  empollon.timed = { confusion: { level: 1, left: 20, next: 20 } };
  castleAfter(KIT, s);
  assert.equal(empollon.castle.learned, undefined);
});

test('La Chivata, blinded, cannot point at anyone', () => {
  const s = fight('alumnos-1b'), chivata = of(s, 'chivata');
  chivata.timed = { cegado: blind() };
  const e = foeTurn(s, chivata);
  assert.equal(e.ability.id, 'pellizco');
  assert.ok(!s.allies.some(a => a.castle?.marked));
  assert.ok(e.called?.some(c => c.text === 'No ve a quién'));
});

test('wet, El Ausente shows where it is and El Repetidor\'s crust gives; its pringue melts under any fire', () => {
  const second = fight('alumnos-2d'), ausente = of(second, 'ausente');
  assert.equal(castleTaken(second, ausente, 'physical'), 0);
  ausente.timed = { mojado: wet() };
  assert.equal(castleTaken(second, ausente, 'physical'), 1);
  assert.ok(chips(second, ausente).includes('presente'));
  const third = fight('alumnos-3a'), old = of(third, 'repetidor');
  assert.equal(castleTaken(third, old, 'magic'), CASTLE.crusted);
  old.timed = { mojado: wet() };
  assert.equal(castleTaken(third, old, 'magic'), 1);
  const first = fight('alumnos-1a'), young = of(first, 'repetidor');
  assert.ok(young.shell);
  const plain = strike(first, young, undefined);
  assert.ok(plain.swallowed, 'a plain blow is swallowed');
  const fire = strike(first, young, 'fuego');
  assert.ok(fire.melted && !young.shell && fire.amount > 0, 'Atacar carrying fire melts it, as a skill of fire does');
});

test('El Montón, once it has a shape, is weak to what undoes it', () => {
  const s = fight('alumnos-3d'), monton = of(s, 'monton');
  assert.equal(castleAffinity(monton, 'agua'), undefined);
  monton.castle.form = 'fuego';
  assert.equal(castleAffinity(monton, 'agua'), 'weak');
  monton.castle.form = 'agua';
  assert.equal(castleAffinity(monton, 'electrico'), 'weak');
  monton.castle.form = 'sangrado';
  assert.equal(castleAffinity(monton, 'fuego'), 'weak', 'a wound of a shape is closed by fire, rancid or not');
  monton.castle.form = 'golpe';
  assert.deepEqual(made(monton), { fuego: 'resist', fisico: 'weak' }, 'a plain blow leaves nothing to undo');
});

test('Aurelià: the lectern is oak and brass; any new status trips him and takes a Ritmo; one kept for his run-up brings him down', () => {
  const s = fight('aurelia'), boss = of(s, 'aurelia'), atril = of(s, 'atril');
  assert.deepEqual(made(atril), { fuego: 'weak', electrico: 'weak' });
  assert.deepEqual(made(boss), {}, 'he is a man, not gum');
  assert.ok(stageMoment(s, 'aurelia-carrera'));
  boss.lasting = { shifts: { fuerza: CASTLE.ritmo * 2 }, from: 'Ritmo' };
  assert.ok(chips(s, boss).includes('ritmo'));
  boss.castle.lap = 3;
  // A wound is a status too: not only the ones with a clock.
  boss.statuses = { sangrado: 2 }; castleAfter(KIT, s);
  assert.equal(boss.castle.lap, CASTLE.vuelta, 'the lap starts over');
  assert.equal(boss.lasting.shifts.fuerza, CASTLE.ritmo, 'and a step of Ritmo is gone');
  assert.equal(boss.castle.tripped, 'sangrado');
  // The same one again does not count.
  boss.castle.lap = 3; delete boss.statuses; castleAfter(KIT, s); boss.statuses = { sangrado: 1 }; castleAfter(KIT, s);
  assert.equal(boss.castle.lap, 3);
  // The last straight: a status kept for his run-up cancels the Récord and leaves him on the floor.
  assert.ok(stageMoment(s, 'aurelia-recta'));
  boss.intent = { ability: 'record', at: 'todos' }; boss.castle.record = CASTLE.recordRounds;
  boss.timed = { quemado: { level: 1, left: 10, next: 2 } };
  const e = { kind: 'skill', actor: 'gerard', target: boss.id, amount: 0 };
  castleAfter(KIT, s, e);
  assert.equal(boss.intent, undefined); assert.equal(e.cancelled, 'record');
  assert.equal(castleTaken(s, boss, 'physical'), CASTLE.expuesto);
  assert.ok(e.called.some(c => c.text === 'Caída'));
});

test('Aurelià: whoever holds on through the Expulsión stays in the room', () => {
  const s = fight('aurelia'), boss = of(s, 'aurelia');
  assert.ok(stageMoment(s, 'aurelia-recta'));
  boss.intent = { ability: 'expulsion', target: 'gerard' };
  by(s, 'gerard').guarding = true;
  const stay = foeTurn(s, boss, 'gerard');
  assert.equal(by(s, 'gerard').castle?.expelled, undefined);
  assert.ok(stay.called.some(c => c.text === 'Se queda'));
  boss.intent = { ability: 'expulsion', target: 'aitor' };
  foeTurn(s, boss, 'aitor');
  assert.equal(by(s, 'aitor').castle.expelled, CASTLE.expulsado);
});

test('Dirección: each says what she will do; struck with what undoes her folder she loses it, once until they trade', () => {
  const s = fight('direccion'), [mar, montse, pilar] = s.foes;
  assert.deepEqual(s.foes.map(d => d.intent.ability), ['expediente', 'horario', 'circular'], 'on their plates from the first round');
  assert.ok(intentLabel(s, mar).startsWith('Expediente → '));
  assert.deepEqual([made(mar), made(montse), made(pilar)], [{ agua: 'weak' }, { electrico: 'weak' }, { fuego: 'weak' }]);
  assert.ok(chips(s, mar).includes('preside'));
  // A spark on whoever carries the water: no Horario.
  const e = strike(s, montse, 'electrico');
  assert.equal(e.affinity, 'weak'); assert.equal(e.cancelled, 'horario');
  assert.ok(montse.castle.overruled && montse.castle.warned && !montse.intent);
  assert.ok(chips(s, montse).includes('desautorizada'));
  const lost = foeTurn(s, montse);
  assert.ok(lost.called.some(c => c.text === 'Desautorizada'));
  assert.ok(!s.allies.some(a => a.timed?.mojado), 'nobody is wet');
  // Not again until they trade folders.
  montse.intent = { ability: 'horario', at: 'todos' };
  const again = strike(s, montse, 'electrico');
  assert.equal(again.cancelled, undefined); assert.ok(montse.intent);
  assert.ok(chips(s, montse).includes('sobre-aviso'));
  s.round = CASTLE.cargoEvery; castleRoundEnd(s);
  assert.ok(!montse.castle.warned, 'the trade puts her off her guard');
  assert.deepEqual(montse.castle.elements, ['electrico'], 'and she carries the next one\'s folder');
  assert.deepEqual(made(montse), { fuego: 'weak' });
  assert.equal(montse.intent.ability, 'circular', 'her plate says the move of the folder she has now');
  void pilar;
});

test('Dirección: the Acta is Mar\'s to preside; a blinded one does not sign; the last one standing has the casting vote only if she is Mar', () => {
  const s = fight('direccion'), [mar, montse, pilar] = s.foes;
  s.round = CASTLE.actaEvery - 1; castleRoundEnd(s); s.round++;
  assert.deepEqual(s.foes.map(d => d.intent.ability), ['firma', 'firma', 'firma'], 'the round before, their plates say the Acta is coming');
  montse.timed = { cegado: blind() };
  foeTurn(s, mar); const none = foeTurn(s, montse); foeTurn(s, pilar);
  assert.ok(none.called.some(c => c.text === 'No firma'));
  assert.equal(s.castle.firmas, 2);
  castleRoundEnd(s);
  assert.equal(s.castle.firmas, 0, 'left open, it is void');
  // Pilar falls: Mar and Montse are still a quorum, two signatures close it.
  pilar.hp = 0; castleAfter(KIT, s);
  assert.deepEqual(mar.castle.elements, ['fuego', 'electrico'], 'the next in line takes her folder');
  delete montse.timed;
  s.round = CASTLE.actaEvery * 2 - 1; castleRoundEnd(s); s.round++;
  foeTurn(s, mar); const closed = foeTurn(s, montse);
  assert.ok(closed.telegraph?.id === 'resolucion', 'two signatures and it is closed');
  // Mar falls: nobody presides, so no more Actas, and Montse is left in charge without the casting vote.
  mar.hp = 0; castleAfter(KIT, s);
  assert.equal(montse.intent, undefined, 'the Resolución is void');
  s.round = CASTLE.actaEvery * 3 - 1; castleRoundEnd(s);
  assert.notEqual(montse.intent.ability, 'firma');
  assert.ok(chips(s, montse).includes('funciones'));
  assert.equal(montse.castle.elements.length, 3);
  // The other way round, Mar alone has it.
  const t = fight('direccion');
  assert.ok(stageMoment(t, 'direccion-una'));
  assert.ok(chips(t, t.foes[0]).includes('voto'));
  assert.ok(stageMoment(t, 'direccion-funciones'));
  assert.ok(chips(t, t.foes[1]).includes('funciones') && t.foes[1].hp > 0 && t.foes[0].hp === 0);
});

test('La Reina: five layers, each torn off by what undoes it, a piece of her with it, and none comes back', () => {
  const s = fight('reina'), queen = of(s, 'reina');
  assert.equal(queen.castle.gum, 'fresco');
  assert.deepEqual(made(queen), { fuego: 'weak' });
  assert.ok(chips(s, queen).includes('capas'));
  // A blow she is not weak to goes in at a quarter and leaves the layer on.
  const dull = strike(s, queen, 'agua');
  assert.ok(dull.amount > 0 && queen.castle.gum === 'fresco');
  const before = queen.hp, fire = strike(s, queen, 'fuego');
  assert.equal(queen.castle.gum, undefined);
  assert.deepEqual(queen.castle.peeled, ['fresco']);
  assert.equal(before - queen.hp, fire.amount + Math.ceil(queen.maxHp * CASTLE.capa), 'the layer takes a piece of her with it');
  assert.ok(fire.called.some(c => c.text === 'Se despega'));
  // Bare, her turn goes into the next one: with a filling, weak to what undoes it.
  const wrapped = foeTurn(s, queen);
  assert.equal(wrapped.ability.id, 'envolver');
  assert.equal(queen.castle.gum, GUM_ORDER[1]);
  assert.deepEqual(made(queen), { fuego: 'resist', agua: 'weak' });
  // Her gum carries its filling: the Pegote burns.
  foeTurn(s, queen, 'aitor');
  assert.ok(by(s, 'aitor').timed?.quemado);
  // A dual tears any layer.
  queen.hp -= 5; castleAfter(KIT, s, { kind: 'skill', actor: 'gerard', target: queen.id, amount: 5, dual: { id: 'punto-debil' } });
  assert.deepEqual(queen.castle.peeled, ['fresco', 'fuego']);
  // The rancid one: a blow breaks it.
  queen.castle.peeled = GUM_ORDER.slice(0, 4); queen.castle.gum = 'rancio';
  assert.deepEqual(made(queen), { fuego: 'resist', fisico: 'weak' });
  turn(s, 'aitor'); act(s, 'attack', queen.id);
  assert.deepEqual(queen.castle.peeled, GUM_ORDER);
  assert.ok(chips(s, queen).includes('capas'));
  const bare = foeTurn(s, queen);
  assert.equal(bare.ability.id, 'pegote', 'the five gone, she has nothing left to wrap herself in');
});

test('La Reina: one hand holds and one crushes, both say whom; holding on, nobody is caught', () => {
  const s = fight('reina'), queen = of(s, 'reina');
  assert.ok(stageMoment(s, 'reina-manos'));
  const hands = s.foes.filter(f => f.kind === 'mano');
  assert.deepEqual(hands.map(h => h.castle.hand), ['sujeta', 'aplasta']);
  assert.ok(hands.every(castleIdle));
  assert.equal(queen.intent.ability, 'atrapar');
  const whom = by(s, queen.intent.target);
  whom.guarding = true;
  const miss = foeTurn(s, queen, whom.id);
  assert.ok(miss.called.some(c => c.text === 'No lo coge'));
  assert.equal(whom.castle?.held, undefined);
  assert.equal(queen.intent.ability, 'aplastar', 'and she says what the other hand will do');
  whom.guarding = false;
  foeTurn(s, queen);
  assert.equal(queen.intent.ability, 'atrapar');
  const caught = by(s, queen.intent.target);
  foeTurn(s, queen, caught.id);
  assert.equal(caught.castle.held, hands[0].id);
  // The hand that crushes broken, what she said it would do is off.
  queen.intent = { ability: 'aplastar', target: 'gerard' };
  hands[1].hp = 0; castleAfter(KIT, s);
  assert.equal(queen.intent, undefined);
  // The hand that holds broken, he is free.
  hands[0].hp = 0; castleAfter(KIT, s);
  assert.equal(caught.castle.held, undefined);
});

test('La Reina: La Pompa is a thing in front of her; burst in time it goes off in her face, left alone on everyone', () => {
  const s = fight('reina-vuelta'), queen = of(s, 'reina');
  foeTurn(s, queen);
  const bubble = of(s, 'pompa');
  assert.ok(bubble && castleIdle(bubble), 'a thing with its own PV and no turn');
  assert.equal(castleTaken(s, queen, 'magic'), CASTLE.pompaTras, 'behind it she takes half');
  assert.ok(intentLabel(s, queen).startsWith('La Pompa'));
  const hp = queen.hp;
  bubble.hp = 0; const e = { kind: 'attack', actor: 'aitor', target: bubble.id, amount: 10 };
  castleAfter(KIT, s, e);
  assert.equal(e.cancelled, 'pompa');
  assert.ok(queen.castle.stunned && !queen.castle.pompa && !queen.intent);
  assert.equal(hp - queen.hp, Math.ceil(queen.maxHp * CASTLE.pompaRota));
  assert.equal(castleTaken(s, queen, 'magic'), 1);
  // She loses that turn, then blows another; nobody bursts it, and it goes off on everyone.
  foeTurn(s, queen);
  foeTurn(s, queen);
  const second = s.foes.filter(f => f.kind === 'pompa').at(-1);
  assert.ok(second !== bubble && second.hp > 0);
  for (let i = 1; i < CASTLE.pompaRounds; i++) foeTurn(s, queen);
  const allies = s.allies.map(a => a.hp), blown = foeTurn(s, queen);
  assert.equal(blown.ability.id, 'pompa');
  assert.ok(s.allies.every((a, i) => a.hp < allies[i]));
  assert.equal(second.hp, 0);
});

test('a boss goes for whoever is closest to falling; pupils still take turns, one each', () => {
  const two = [{ id: 'a', hp: 90 }, { id: 'b', hp: 40 }];
  assert.equal(closestToFalling(two, 0).id, 'b'); assert.equal(closestToFalling(two, 1).id, 'b');
  // Level, whoever's turn it would have been.
  const level = [{ id: 'a', hp: 50 }, { id: 'b', hp: 50 }];
  assert.deepEqual([0, 1, 2].map(turn => closestToFalling(level, turn).id), ['a', 'b', 'a']);
  for (const kind of ['aurelia', 'directiva', 'reina', 'campeon', 'voz', 'fran', 'no-converge']) assert.ok(SHREWD.includes(kind), kind);
  assert.ok(!SHREWD.includes('repetidor') && !SHREWD.includes('directo'));
  // Dirección's Expediente names the one with fewer PV, round after round.
  const s = fight('direccion');
  by(s, 'aitor').hp = 30;
  for (let round = 1; round <= 3; round++) {
    castleRoundEnd(s); s.round = round + 1;
    const named = s.foes.filter(f => f.intent?.ability === 'expediente').map(f => f.intent.target);
    assert.ok(named.every(id => id === 'aitor'), `round ${round}: ${named}`);
  }
});
