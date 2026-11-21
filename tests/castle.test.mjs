import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE, CASTLE_ENCOUNTERS, CASTLE_PHASES, MELODY, castleEntry, extraSlots, floorFor, isCastle } from '../src/castle.ts';
import { aitorTaken, artilugioLive, castleAfter, castleChips, castleIdle, castleNote, castleRoundEnd, castleTaken, montonCopy, nextNote } from '../src/castle-fight.ts';
import { castleEnvironment } from '../src/castle-floor.ts';
import { createFearBattle } from '../src/battle.ts';
import { Story } from '../src/story.ts';
import { LINES_CASTLE } from '../src/castle-story.ts';
import { flagsAt } from '../src/story-points.ts';
import { canWalk } from '../src/movement.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
/** Whether `to` can be walked to from `from` on `grid`, step by step. */
function reaches(grid, from, to) {
  const seen = new Set([`${from.x},${from.z}`]), queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (at.x === to.x && at.z === to.z) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: at.x + dx, z: at.z + dz }, key = `${next.x},${next.z}`;
      if (!seen.has(key) && canWalk(next, grid)) { seen.add(key); queue.push(next); }
    }
  }
  return false;
}

test('a castle floor is the same all day and another the next, and always walks from its entry to its boss and back', () => {
  for (const phase of CASTLE_PHASES) for (let seed = 0; seed < 12; seed++) {
    const floor = floorFor(seed, 3, phase.id);
    assert.deepEqual(floorFor(seed, 3, phase.id), floor, 'the same three numbers, the same floor');
    for (const cell of [floor.spawn, floor.back, floor.exit]) assert.ok(canWalk(cell, floor.grid), `${phase.id}/${seed}: ${JSON.stringify(cell)}`);
    assert.ok(reaches(floor.grid, floor.spawn, floor.exit), `${phase.id}/${seed}: the boss's door can be reached`);
    assert.ok(reaches(floor.grid, floor.spawn, floor.back), `${phase.id}/${seed}: the way back can be reached`);
    assert.equal(floor.rooms.filter(r => r.onPath).length, phase.rooms, 'its main path has the phase\'s rooms');
    assert.equal(floor.rooms.filter(r => r.kind === 'rest').length, 1, 'one staff room');
    for (const room of floor.rooms.filter(r => r.kind === 'fight' || r.kind === 'elite')) assert.ok([...phase.fights, phase.elite].includes(room.encounter), room.encounter);
    const place = castleEnvironment(floor);
    assert.deepEqual(place.interactions.map(i => i.id), ['castillo-volver', 'castillo-salir']);
  }
  const days = new Set([1, 2, 3, 4].map(day => JSON.stringify(floorFor(7, day, 1).grid)));
  assert.ok(days.size > 1, 'a new day, a new floor');
});

test('every castle fight stands up, all of it the castle\'s own', () => {
  for (const encounter of CASTLE_ENCOUNTERS) {
    const state = createFearBattle(party, encounter);
    assert.ok(state.foes.length && state.foes.every(f => isCastle(f.kind)), encounter);
  }
});

test('Aurelià behind his lectern takes half; with the lectern broken, all of it', () => {
  const state = createFearBattle(party, 'aurelia'), boss = state.foes.find(f => f.kind === 'aurelia'), atril = state.foes.find(f => f.kind === 'atril');
  assert.equal(castleTaken(state, boss, 'physical'), CASTLE.atril);
  atril.hp = 0; castleAfter(undefined, state);
  assert.equal(castleTaken(state, boss, 'physical'), 1);
});

test('at a tenth of her PV the Queen takes Aitor, even down, and nothing reaches her while she has him', () => {
  for (const down of [false, true]) {
    const state = createFearBattle(party, 'reina'), queen = state.foes.find(f => f.kind === 'reina'), aitor = state.allies.find(a => a.id === 'aitor');
    if (down) aitor.hp = 0;
    // One big blow from well above the tenth straight to nothing: she does not fall.
    queen.castle.stage = 'pompa'; queen.hp = 0;
    castleAfter(undefined, state);
    assert.equal(queen.hp, Math.ceil(queen.maxHp * CASTLE.toma));
    assert.equal(aitor.castle?.held, 'reina');
    assert.ok(aitor.hp > 0, 'she lifts him');
    assert.ok(aitorTaken(state));
    assert.equal(castleTaken(state, queen, 'physical'), 0);
    assert.ok(!artilugioLive(state), 'the first time there is no artilugio');
  }
});

test('she takes Aitor only when she is about to fall: lost before that, it is an ordinary fall', () => {
  for (const who of ['gerard', 'aitor']) {
    const state = createFearBattle(party, 'reina');
    state.allies.find(a => a.id === who).hp = 0;
    castleAfter(undefined, state);
    assert.ok(!aitorTaken(state), who);
  }
  const story = new Story([...flagsAt('castle'), 'aurelia', 'direccion']);
  const fall = story.handle({ type: 'battle', won: false, encounter: 'reina', taken: false });
  assert.ok(!story.has('aitor-poseido') && !story.has('artilugio'), 'no possession, no call from Bernat');
  assert.ok(!fall.some(e => e.kind === 'dialogue' && JSON.stringify(e).includes('Bernat')), 'an ordinary fall');
});

test('with the artilugio, the melody in order frees Aitor; a wrong note puts the marks out', () => {
  const state = createFearBattle(party, 'reina-vuelta'), queen = state.foes.find(f => f.kind === 'reina');
  queen.hp = 0; castleAfter(undefined, state);
  state.phase = 'player';
  assert.ok(artilugioLive(state));
  const first = castleNote(state, nextNote(state));
  assert.ok(first.right && first.startled && first.notes === 1);
  assert.equal(castleNote(state, MELODY[0]).notes, 1, 'the first note again starts the melody again');
  assert.equal(castleNote(state, 6).notes, 0, 'a wrong one, and back to nothing');
  let last;
  for (let i = 0; i < MELODY.length; i++) last = castleNote(state, nextNote(state));
  assert.ok(last.freed);
  assert.ok(!aitorTaken(state));
  assert.equal(state.allies.find(a => a.id === 'aitor').castle?.held, undefined);
  assert.ok(castleTaken(state, queen, 'physical') > 0, 'and she can be finished');
});

test('the castle in the story: the gym leads into the floor, each boss moves the way in, she takes Aitor once, and Gerard chooses', () => {
  const story = new Story(flagsAt('castle'));
  assert.equal(story.redirect('patio-gimnasio').environment, 'castillo-1');
  assert.equal(story.extraSlots, 1);
  // A boss beaten: the Queen screams through the building, the picture goes white, and they are in bed. No night to walk home through.
  const first = story.handle({ type: 'battle', won: true, encounter: 'aurelia' });
  const scream = first.find(e => e.kind === 'scream');
  assert.ok(scream && scream.fear === 1 && scream.text === LINES_CASTLE.screams.aurelia);
  assert.ok(!first.some(e => e.kind === 'fall'), 'nobody falls: it is a flash');
  assert.deepEqual(first.slice(first.indexOf(scream) + 1).map(e => e.kind).slice(0, 2), ['travel', 'wake']);
  assert.equal(first.find(e => e.kind === 'travel').environment, 'meridiana');
  assert.deepEqual(story.clock, { day: 2, hour: 8 }, 'the same morning again');
  assert.equal(story.night, false);
  assert.ok(story.has('aurelia') && story.has('luz-aurelia'));
  assert.equal(story.extraSlots, 2, 'Aurelià opens a third ánima each');
  assert.equal(story.redirect('gimnasio-vestuarios').environment, 'castillo-2');
  assert.deepEqual(castleEntry(new Set(['aurelia'])).environment, 'palacio-gimnasio');
  const second = story.handle({ type: 'battle', won: true, encounter: 'direccion' }).find(e => e.kind === 'scream');
  assert.ok(second.fear === 2 && second.text === LINES_CASTLE.screams.direccion, 'she is more afraid each time');
  assert.equal(story.clock.day, 3);
  assert.ok(['direccion', 'luz-mar', 'luz-montse', 'luz-pilar'].every(f => story.has(f)));
  assert.equal(story.redirect('secretaria-direccio').environment, 'castillo-3');
  // Lost with Aitor hers: the once it happens. The morning after, Bernat calls them to El Nucli.
  const fall = story.handle({ type: 'battle', won: false, encounter: 'reina', taken: true });
  assert.ok(story.has('aitor-poseido') && story.has('bernat-llama') && !story.has('artilugio'));
  assert.ok(fall.some(e => e.kind === 'dialogue'));
  // At his table: the game told, the look at the camera, his box; its puzzle solved, the artilugio is home.
  const told = story.handle({ type: 'interact', id: 'talk-bernat35' });
  assert.ok(story.has('bernat-juego') && told.some(e => e.kind === 'stare'));
  assert.deepEqual(story.handle({ type: 'interact', id: 'nucli-mesa' }).map(e => e.kind), ['nucli-box']);
  story.handle({ type: 'portal' });
  assert.ok(story.has('portal-nucli') && story.has('artilugio'));
  const won = story.handle({ type: 'battle', won: true, encounter: 'reina-vuelta' });
  assert.ok(won.some(e => e.kind === 'ending'));
  const end = story.handle({ type: 'ending', choice: 'bajar' });
  assert.ok(story.has('reina') && story.has('final-bajar') && !story.has('final-acabar'));
  assert.ok(end.some(e => e.kind === 'epilogue' && e.choice === 'bajar'));
  assert.equal(end.at(-1).kind, 'credits', 'the Monday after, then the credits');
  assert.deepEqual(story.handle({ type: 'ending', choice: 'acabar' }), [], 'only once');
  assert.equal(story.redirect('patio-gimnasio'), undefined, 'after her, the school is a school');
  assert.equal(extraSlots(1), 1); assert.equal(extraSlots(2), 2);
});

test('each castle boss beaten holds her back as an ánima does, so a castle begun late can be finished', () => {
  const story = new Story(flagsAt('castle'));
  story.days.clock = { day: 6, hour: 9 };
  const before = story.spread;
  story.handle({ type: 'battle', won: true, encounter: 'aurelia' });
  story.days.clock = { day: 6, hour: 9 };
  assert.ok(story.spread < before, 'Aurelià beaten: her spread goes back');
  assert.equal(story.heldBack, story.animas.length + 1);
});

test('held, Aitor plays her side: player 2 picks his blow from his own kit, and whatever he picks the thread makes it hurt', async () => {
  const { enemyAct, heldMoves } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'reina'), queen = state.foes.find(f => f.kind === 'reina');
  queen.hp = 0; castleAfter(undefined, state);
  const aitor = state.allies.find(a => a.id === 'aitor'), gerard = state.allies.find(a => a.id === 'gerard');
  assert.equal(aitor.castle?.held, 'reina');
  const moves = heldMoves(state, aitor);
  assert.deepEqual([moves[0].action, moves.at(-1).action], ['attack', 'defend'], 'Atacar first, Defender last, his skills between');
  // His own blow, on her turn: it lands on Gerard and the fight goes on, hers.
  state.phase = 'enemy'; state.enemyActions = [];
  state.castle.aitorMove = { action: 'attack' };
  const before = gerard.hp, blow = enemyAct(state, queen.id);
  assert.equal(blow.actor, 'aitor');
  assert.ok(gerard.hp < before && blow.amount === before - gerard.hp);
  assert.ok(state.phase === 'enemy' || state.phase === 'lost', 'the view he acted in never ends the real fight as won');
  assert.equal(state.castle.aitorMove, undefined, 'a choice is spent on the turn it was for');
  // Defender hurts nobody: the thread of gum pulls his arm anyway.
  gerard.hp = gerard.maxHp; state.phase = 'enemy'; state.enemyActions = [];
  state.castle.aitorMove = { action: 'defend' };
  enemyAct(state, queen.id);
  assert.ok(gerard.hp < gerard.maxHp, 'there is no way out the first time');
  assert.match(state.message, /hilo de chicle/);
});

test('El Ausente is only there the round after it strikes: a blow goes through it before, a fire it carried still burns', async () => {
  const { act, enemyAct } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'alumnos-2d'), ausente = state.foes.find(f => f.kind === 'ausente');
  assert.ok(ausente.castle.away && castleIdle(ausente) === false, 'it starts out of reach, with its turn to come');
  assert.equal(castleTaken(state, ausente, 'physical'), 0);
  assert.deepEqual(castleChips(state, ausente).map(([id]) => id).filter(id => id === 'ausente'), ['ausente'], 'its plate says so');
  state.active = state.allies.findIndex(a => a.classId === 'matemagico');
  const before = ausente.hp, fire = act(state, 'skill', ausente.id, 'foc-binari');
  assert.equal(ausente.hp, before, 'nothing of the blow reaches it');
  assert.ok(ausente.timed?.quemado, 'the fire it carried does: the clock works while it is away');
  assert.ok(fire.called?.some(c => c.target === ausente.id && c.text === 'No está'));
  // Its turn: «Presente», from nowhere, and it stays where it can be reached.
  state.phase = 'enemy'; state.enemyActions = [];
  const blow = enemyAct(state, ausente.id, state.allies[0].id);
  assert.equal(blow.ability.id, 'presente');
  assert.ok(blow.amount > 0 && !ausente.castle.away && castleIdle(ausente), 'there now, with no turn until it is gone again');
  assert.equal(castleTaken(state, ausente, 'magic'), 1);
  castleRoundEnd(state);
  assert.ok(!ausente.castle.away, 'still there through the next round');
  state.round++; castleRoundEnd(state);
  assert.ok(ausente.castle.away, 'and gone when that round ends');
});

test('El Castigado never attacks: three blows that do not fell it and it bursts on everyone, a fall or a fire gives it no Rabia', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'alumnos-2e'), castigado = state.foes.find(f => f.kind === 'castigado');
  const hit = (amount, kind = 'attack') => { castigado.hp -= amount; castleAfter(undefined, state, { kind, actor: state.allies[0].id, target: castigado.id, amount }); };
  assert.ok(castleIdle(castigado), 'facing the wall: no turn');
  castigado.hp -= 4; castleAfter(undefined, state);
  assert.equal(castigado.castle.rage, 0, 'a tick is no blow');
  hit(10); hit(10);
  assert.equal(castigado.castle.rage, 2);
  assert.ok(castleIdle(castigado));
  hit(10);
  assert.equal(castigado.castle.rage, CASTLE.rabia);
  assert.ok(!castleIdle(castigado), 'its Rabia full, it has a turn');
  state.phase = 'enemy'; state.enemyActions = [];
  const hp = state.allies.map(a => a.hp), burst = enemyAct(state, castigado.id, state.allies[0].id);
  assert.equal(burst.ability.id, 'revienta');
  assert.ok(state.allies.every((a, i) => a.hp < hp[i]), 'on everyone');
  assert.equal(castigado.castle.rage, 0, 'and back to the wall');
  // One big blow that fells it adds nothing.
  hit(castigado.hp);
  assert.equal(castigado.castle.rage, 0);
});

test('El Montón takes the shape of the first blow it takes, by what that blow carried, and gives it back every turn', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const shaped = effect => {
    const state = createFearBattle(party, 'alumnos-3d'), monton = state.foes.find(f => f.kind === 'monton'), other = state.foes.find(f => f !== monton);
    const target = effect.hits ? undefined : monton.id, hits = effect.hits ? [{ target: monton.id, amount: 20 }, { target: other.id, amount: 20 }] : undefined;
    monton.hp -= 20; if (hits) other.hp -= 20;
    castleAfter(undefined, state, { kind: 'skill', actor: state.allies[0].id, amount: 20, ...target ? { target } : {}, ...effect, ...hits ? { hits } : {} });
    return { state, monton };
  };
  const fresh = createFearBattle(party, 'alumnos-3d');
  assert.deepEqual(castleChips(fresh, fresh.foes.find(f => f.kind === 'monton')).map(([id]) => id), ['sin-forma'], 'shapeless, and its plate says what it will do');
  assert.equal(shaped({ kind: 'attack' }).monton.castle.form, 'golpe', 'a plain blow');
  assert.equal(shaped({ kind: 'attack', element: 'electrico' }).monton.castle.form, 'electrico', "Atacar's element");
  assert.equal(shaped({ skill: 'foc-binari' }).monton.castle.form, 'fuego', 'a skill that burns is fire');
  assert.equal(shaped({ skill: 'zarpazo' }).monton.castle.form, 'sangrado', 'a blow that opens a wound');
  assert.equal(shaped({ dual: { id: 'zarpazos-de-fuego', name: '', parts: ['foc-binari', 'zarpazos'], actors: [], spent: {} } }).monton.castle.form, 'fuego', "a dual's fire");
  // (Papagato's Las dos a la vez, the blow on everyone that bled, is cut: docs/animas/papagato/README.md.)
  const wide = shaped({ skill: 'vasos', hits: true });
  assert.ok(wide.monton.castle.form === 'agua' && wide.monton.castle.all, 'a blow on everyone comes back on everyone');
  // Its turn: the copy, as hard as the blow it took and its year on top, and a shock that costs the next turn.
  const { state, monton } = shaped({ kind: 'attack', element: 'electrico' });
  assert.equal(montonCopy(monton), Math.round(20 * CASTLE.copia * CASTLE.year3));
  const gerard = state.allies.find(a => a.id === 'gerard'), before = gerard.hp;
  state.phase = 'enemy'; state.enemyActions = [];
  const copy = enemyAct(state, monton.id, gerard.id);
  assert.equal(copy.ability.id, 'copia');
  assert.equal(before - gerard.hp, montonCopy(monton));
  assert.ok(gerard.shock, 'in shock: the next turn is lost');
  // A second blow changes nothing: the first one gave it its shape.
  monton.hp -= 40; castleAfter(undefined, state, { kind: 'skill', actor: gerard.id, skill: 'foc-binari', target: monton.id, amount: 40 });
  assert.equal(monton.castle.form, 'electrico');
});

test('the second year brings El Ausente and El Castigado, the third El Montón, each in a room of its own', () => {
  const kinds = phase => new Set(CASTLE_PHASES[phase - 1].fights.flatMap(id => createFearBattle(party, id).foes.map(f => f.kind)));
  assert.ok(kinds(2).has('ausente') && kinds(2).has('castigado') && !kinds(1).has('ausente'));
  assert.ok(kinds(3).has('monton') && !kinds(2).has('monton'));
});
