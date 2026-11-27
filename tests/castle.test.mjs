import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE, CASTLE_ENCOUNTERS, CASTLE_PHASES, MELODY, castleEntry, extraSlots, floorFor, isCastle } from '../src/castle.ts';
import { aitorTaken, artilugioLive, castleAfter, castleChips, castleIdle, castleNote, castleRoundEnd, castleTaken, montonCopy, nextNote } from '../src/castle-fight.ts';
import { castleEnvironment } from '../src/castle-floor.ts';
import { FOE_BLOW, createFearBattle } from '../src/battle.ts';
import { Story, onTrigger } from '../src/story.ts';
import { pupilsGrid } from '../src/castle-pupils.ts';
import { HORARIO_GIVEN, horarioFor, solutions, squares } from '../src/horario.ts';
import { PICA, createPica, stepPica } from '../src/pica-pared.ts';
import { LINES_CASTLE } from '../src/castle-story.ts';
import { flagsAt } from '../src/story-points.ts';
import { canWalk } from '../src/movement.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

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

test('the castle in the story: the curtain leads up to the floor, each boss moves the way in, she takes Aitor once, and Gerard chooses', () => {
  const story = new Story(flagsAt('castle'));
  // The gym is held shut from inside; the guards stand before the curtain, and there is no stair yet.
  assert.ok(story.gate('patio-gimnasio')?.lines.length, 'the gym says why it will not open');
  assert.ok(story.guarded.length > 0);
  assert.ok(!story.interactions('palacio').some(i => i.id === 'cruzar-cortina'));
  assert.ok(story.interactions('palacio').some(i => i.id === 'challenge-guards'));
  // The guards beaten: gone for good, the curtain parted, the hall drawn again with the party before it.
  const guards = story.handle({ type: 'battle', won: true, encounter: 'palace-guards' });
  assert.ok(story.has('cortina'));
  assert.deepEqual(guards.slice(0, 2).map(e => e.kind), ['travel', 'dialogue']);
  assert.equal(guards[0].environment, 'palacio');
  assert.deepEqual(story.guarded, [], 'nobody stands there any more');
  assert.equal(story.place('palacio').palace.parted, true);
  assert.ok(!story.interactions('palacio').some(i => i.id === 'challenge-guards' || i.id === 'look-curtain'));
  const stair = story.interactions('palacio').find(i => i.id === 'cruzar-cortina');
  assert.ok(stair && canWalk(stair.cell, ENVIRONMENTS.palacio.grid));
  const up = story.redirect('cruzar-cortina');
  assert.equal(up.environment, 'castillo-1');
  assert.deepEqual(up.cell, story.place('castillo-1').spawn, "today's floor, where it begins");
  assert.deepEqual(story.place('castillo-1').interactions.find(i => i.id === 'castillo-volver').to, { environment: 'palacio', cell: stair.cell }, 'and its way back comes down the same stair');
  assert.equal(story.redirect('patio-gimnasio'), undefined);
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
  assert.equal(story.gate('patio-gimnasio'), undefined, 'his gym is open again');
  assert.equal(story.redirect('cruzar-cortina').environment, 'palacio-gimnasio', 'the first floor is the school again: the stair comes out by the gym');
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
  assert.ok(end[0].kind === 'dialogue' && end[0].dialogue.lines[0].text === LINES_CASTLE.bajar.aitor.text, 'chosen outside her fight, Aitor answers here');
  assert.ok(!end.some(e => e.kind === 'epilogue'), 'letting her be ends the dream: nothing told over black');
  assert.equal(end.at(-1).kind, 'credits', 'the Monday after, then the credits');
  assert.deepEqual(story.handle({ type: 'ending', choice: 'acabar' }), [], 'only once');
  assert.equal(story.redirect('patio-gimnasio'), undefined, 'after her, the school is a school');
  assert.equal(extraSlots(1), 1); assert.equal(extraSlots(2), 2);
});

test('her last scene played in the fight: the choice comes with the win, Aitor has answered there, and only Acabar is told over black', () => {
  for (const choice of ['acabar', 'bajar']) {
    const story = new Story(flagsAt('artilugio'));
    const end = story.handle({ type: 'battle', won: true, encounter: 'reina-vuelta', ending: choice });
    assert.ok(story.has('reina') && story.has(`final-${choice}`), choice);
    assert.ok(!end.some(e => e.kind === 'ending'), 'nothing left to choose');
    assert.ok(!end.some(e => e.kind === 'dialogue' && e.dialogue.lines.some(l => l.text === LINES_CASTLE[choice].aitor.text)), 'his line was said in the fight');
    assert.equal(end.some(e => e.kind === 'epilogue'), choice === 'acabar');
    assert.equal(end.at(-1).kind, 'credits');
  }
});

test('after her, the Meridiana at night is only a street and a morning is only a morning', () => {
  const story = new Story(flagsAt('artilugio'));
  story.handle({ type: 'battle', won: true, encounter: 'reina-vuelta', ending: 'bajar' });
  assert.ok(story.has('reina'));
  story.days.clock = { ...story.days.clock, hour: 21 };
  assert.ok(story.night && !story.nightOut, 'night still falls, but her pupils are not out');
  assert.deepEqual(story.handle({ type: 'near', id: 'night-0' }), [], 'nobody to catch them');
  const home = story.handle({ type: 'home' });
  assert.deepEqual(home.map(e => e.kind), ['dialogue', 'fall', 'travel', 'wake', 'rise'], 'home and to bed; the morning after, nothing shouted, no castle on the news');
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
  assert.equal(before - gerard.hp, Math.round(montonCopy(monton) * FOE_BLOW.castle), 'and as hard on whoever the party has grown (the castle is the yardstick)');
  assert.ok(gerard.shock, 'in shock: the next turn is lost');
  // A second blow changes nothing: the first one gave it its shape.
  monton.hp -= 40; castleAfter(undefined, state, { kind: 'skill', actor: gerard.id, skill: 'foc-binari', target: monton.id, amount: 40 });
  assert.equal(monton.castle.form, 'electrico');
});

test('La Fila: four Párvulos with El Repetidor, each a tug', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'alumnos-2f'), row = state.foes.filter(f => f.kind === 'parvulo'), gerard = state.allies[0];
  assert.equal(row.length, 4);
  assert.ok(row.every(p => p.maxHp < state.foes.find(f => f.kind === 'repetidor').maxHp / 4), 'each a blow\'s worth');
  state.phase = 'enemy'; state.enemyActions = [];
  const hp = gerard.hp, tug = enemyAct(state, row[0].id, gerard.id);
  assert.equal(tug.ability.id, 'tiron');
  assert.ok(gerard.hp < hp);
});

test('El Pelota does not strike while one of his is bigger: he mends it and raises its Fuerza, up to a most; alone he pinches, confused he mends the party', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const { castleConfused, castleIntent } = await import('../src/castle-fight.ts');
  const state = createFearBattle(party, 'alumnos-2g'), pelota = state.foes.find(f => f.kind === 'pelota'), estiron = state.foes.find(f => f.kind === 'estiron'), gerard = state.allies[0];
  assert.equal(pelota.intent?.ability, 'peloteo', 'told from the start');
  assert.match(castleIntent(state, pelota) ?? '', /Estirón/, 'and whom');
  estiron.hp -= 200;
  const turn = () => { state.phase = 'enemy'; state.enemyActions = []; return enemyAct(state, pelota.id, gerard.id); };
  const before = estiron.hp, hp = gerard.hp, flattery = turn();
  assert.equal(flattery.ability.id, 'peloteo');
  assert.equal(estiron.hp - before, Math.round(estiron.maxHp * CASTLE.peloteoCura));
  assert.equal(estiron.lasting.shifts.fuerza, CASTLE.peloteo);
  assert.equal(gerard.hp, hp, 'no blow');
  for (let i = 0; i < 6; i++) turn();
  assert.equal(estiron.lasting.shifts.fuerza, CASTLE.peloteoMost, 'never past its most');
  // Confused, the same Peloteo goes to whoever of the party is lowest.
  gerard.hp = 10;
  assert.ok(castleConfused(state, pelota, { actor: pelota.id, kind: 'enemy' }));
  assert.ok(gerard.hp > 10);
  // With nobody bigger standing he pinches.
  estiron.hp = 0; castleAfter(undefined, state);
  const low = gerard.hp, pinch = turn();
  assert.equal(pinch.ability.id, 'pellizco');
  assert.ok(gerard.hp < low);
});

test('El Estirón grows with every Zancada; at its most it tells the Desplome, comes down on everyone and is its own size again', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'alumnos-2g'), estiron = state.foes.find(f => f.kind === 'estiron'), [gerard, aitor] = state.allies;
  const turn = () => { state.phase = 'enemy'; state.enemyActions = []; for (const a of state.allies) a.hp = a.maxHp; return enemyAct(state, estiron.id, gerard.id); };
  const blows = [];
  for (let i = 1; i <= CASTLE.estironMost; i++) {
    const step = turn();
    assert.equal(step.ability.id, 'zancada');
    assert.equal(estiron.castle.grown, i);
    blows.push(gerard.maxHp - gerard.hp);
  }
  assert.ok(blows[2] > blows[0], 'each stride harder than the last');
  assert.equal(estiron.intent?.ability, 'desplome', 'told a turn ahead');
  assert.match(castleChips(state, estiron).map(c => c[1]).join(' '), /Estirón 3/);
  const fall = turn();
  assert.equal(fall.ability.id, 'desplome');
  assert.ok(gerard.hp < gerard.maxHp && aitor.hp < aitor.maxHp, 'on everyone');
  assert.equal(estiron.castle.grown, 0, 'and back to no steps');
  assert.equal(turn().ability.id, 'zancada', 'it starts over');
});

test('El Mayor brings a Párvulo and tells his Arremete; it lands harder for each one standing, and he brings no more than his row', async () => {
  const { enemyAct } = await import('../src/battle.ts');
  const state = createFearBattle(party, 'alumnos-3e'), mayor = state.foes.find(f => f.kind === 'mayor'), gerard = state.allies[0];
  const row = () => state.foes.filter(f => f.kind === 'parvulo' && f.hp > 0);
  gerard.maxHp = 5000;   // room to measure a blow that would otherwise fell him
  const turn = () => { state.phase = 'enemy'; state.enemyActions = []; gerard.hp = gerard.maxHp; return enemyAct(state, mayor.id, gerard.id); };
  assert.equal(row().length, 2);
  assert.equal(turn().ability.id, 'trae');
  assert.equal(row().length, CASTLE.fila, 'one more walks in');
  assert.ok(state.enemyActions.includes(row().at(-1).id), 'with no turn the round it comes');
  assert.equal(mayor.intent?.ability, 'arremete');
  assert.match(castleChips(state, mayor).map(c => c[1]).join(' '), /Jaleado ×3/);
  assert.equal(turn().ability.id, 'arremete');
  const cheered = gerard.maxHp - gerard.hp;
  // His row full, he tells the next one without bringing anyone.
  turn();
  assert.equal(row().length, CASTLE.fila);
  // With nobody standing the same blow is one more.
  for (const p of row()) p.hp = 0;
  castleAfter(undefined, state);
  assert.equal(turn().ability.id, 'arremete');
  assert.ok(gerard.maxHp - gerard.hp < cheered * .6, 'alone it is far less');
  assert.match(castleChips(state, mayor).map(c => c[1]).join(' '), /Nadie le jalea/);
});

test('the second and third years each have a soft room and a hard one of the new pupils', () => {
  const kinds = phase => new Set(CASTLE_PHASES[phase - 1].fights.flatMap(id => createFearBattle(party, id).foes.map(f => f.kind)));
  for (const kind of ['parvulo', 'pelota', 'estiron']) assert.ok(kinds(2).has(kind) && !kinds(1).has(kind), kind);
  assert.ok(kinds(3).has('mayor') && !kinds(2).has('mayor'));
});

test('the second year brings El Ausente and El Castigado, the third El Montón, each in a room of its own', () => {
  const kinds = phase => new Set(CASTLE_PHASES[phase - 1].fights.flatMap(id => createFearBattle(party, id).foes.map(f => f.kind)));
  assert.ok(kinds(2).has('ausente') && kinds(2).has('castigado') && !kinds(1).has('ausente'));
  assert.ok(kinds(3).has('monton') && !kinds(2).has('monton'));
});

// ——— The closed doors (docs/castle.md § The closed doors) ——————————————————————————————————————
test('the second and third floors have a closed room in the middle of the way: with its door shut nothing past it can be reached', () => {
  for (let seed = 0; seed < 12; seed++) {
    assert.equal(floorFor(seed, 3, 1).puzzle, undefined, 'none on the first floor');
    for (const phase of [2, 3]) {
      const floor = floorFor(seed, 3, phase), puzzle = floor.puzzle, room = floor.rooms[puzzle.room];
      assert.equal(puzzle.id, phase === 2 ? 'horario' : 'pica-pared');
      assert.equal(room.kind, 'puzzle');
      assert.ok(room.onPath && room.order > .25 && room.order < .75, 'in the middle of the way');
      const shut = floor.grid.map((row, z) => [...row].map((c, x) => puzzle.gate.some(g => g.x === x && g.z === z) ? '#' : c).join(''));
      assert.ok(reaches(shut, floor.spawn, puzzle.entry), 'the room is reached');
      assert.ok(reaches(shut, floor.spawn, puzzle.board) && puzzle.touch.every(cell => reaches(shut, floor.spawn, cell)), 'and what is in it');
      assert.ok(!reaches(shut, floor.spawn, floor.exit), 'the way on is not');
      assert.ok(reaches(floor.grid, floor.spawn, floor.exit), 'open, it is');
      // Nothing opens off it but its two doors, and nobody of hers goes in.
      assert.ok(pupilsGrid(floor)[room.cell.z][room.cell.x] === '#');
    }
  }
});

test('El horario squares one way only, another each day, and squaring it opens the door for good and lets go of an Eco de luz', () => {
  for (let seed = 1; seed < 60; seed++) {
    const { given, solution } = horarioFor(seed * 7919);
    assert.ok(squares(solution));
    assert.equal(solutions([...given]), 1, 'one way only');
    assert.ok(given.filter(Boolean).length >= HORARIO_GIVEN && given.filter(Boolean).length <= 8);
    assert.ok(given.every((value, i) => !value || value === solution[i]));
  }
  assert.notDeepEqual(horarioFor(1).solution, horarioFor(2).solution);
  const story = new Story([...flagsAt('castle'), 'aurelia']);
  const shut = story.blocked('castillo-2'), plan = story.puzzle('castillo-2');
  assert.equal(plan.id, 'horario');
  assert.deepEqual(shut, plan.gate);
  assert.ok(story.interactions('castillo-2').some(i => i.id === 'castillo-horario') && story.interactions('castillo-2').some(i => i.id === 'castillo-puerta'));
  // The door says why; the sheet opens, with what a timetable is said the first time only.
  assert.deepEqual(story.handle({ type: 'interact', id: 'castillo-puerta' }), [{ kind: 'dialogue', dialogue: LINES_CASTLE.horarioShut }]);
  assert.deepEqual(story.handle({ type: 'interact', id: 'castillo-horario' }).map(e => e.kind), ['dialogue', 'horario']);
  assert.deepEqual(story.handle({ type: 'interact', id: 'castillo-horario' }).map(e => e.kind), ['horario']);
  const { horario } = story.horario, wrong = [...horario.solution];
  [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
  assert.deepEqual(story.handle({ type: 'horario', board: wrong }), [], 'a sheet that does not square opens nothing');
  story.pencil(wrong);
  assert.deepEqual(story.horario.tried, wrong, 'what is pencilled stays for the next look');
  assert.deepEqual(story.handle({ type: 'horario', board: horario.solution }).map(e => e.kind), ['dialogue', 'lights']);
  assert.ok(story.has('luz-horario'));
  assert.deepEqual(story.blocked('castillo-2'), []);
  assert.equal(story.puzzle('castillo-2'), undefined);
  assert.ok(!story.interactions('castillo-2').some(i => i.id === 'castillo-horario'));
});

test('Pica pared: it catches whoever moves while it looks, hears a run, and the wall reached opens the door for good', () => {
  const pica = createPica(7), still = [{ watched: true, moving: false, running: false }], walking = [{ watched: true, moving: true, running: false }];
  assert.equal(pica.phase, 'away');
  const until = (phase, walkers = still) => { for (let i = 0; i < 2000 && pica.phase !== phase; i++) assert.deepEqual(stepPica(pica, .01, walkers).caught, [], 'nobody caught on the way'); assert.equal(pica.phase, phase); };
  // Walking while it counts is the game; its shoulders rise before it turns.
  until('tell', walking);
  until('look');
  // Within a breath of its turning nobody is caught; after it, whoever moves is, and nobody behind the line.
  assert.deepEqual(stepPica(pica, PICA.grace / 2, walking).caught, []);
  assert.deepEqual(stepPica(pica, PICA.grace, [...walking, { watched: false, moving: true, running: true }, ...still]).caught, [0]);
  assert.equal(pica.caught, 1);
  until('away');
  // A run is heard: it has turned before a walk's count would have ended.
  const heard = createPica(7), plain = createPica(7), time = (p, walkers) => { let t = 0; while (p.phase === 'away') { stepPica(p, .01, walkers); t += .01; } return t; };
  assert.ok(time(heard, [{ watched: true, moving: true, running: true }]) < time(plain, walking));
  // In the story: the great Castigado stands in the door, the wall is a place to reach, and reaching it is that.
  const story = new Story([...flagsAt('castle'), 'aurelia', 'direccion']), plan = story.puzzle('castillo-3');
  assert.equal(plan.id, 'pica-pared');
  assert.deepEqual(story.blocked('castillo-3'), [...plan.gate, ...plan.door]);
  const [wall] = story.triggers('castillo-3');
  assert.ok(plan.touch.every(cell => onTrigger(wall, cell)), 'either side of it');
  assert.ok(onTrigger(wall, { x: plan.door[0].x - plan.out.x, z: plan.door[0].z - plan.out.z }), 'and right behind its back');
  assert.ok(!onTrigger(wall, plan.entry));
  assert.deepEqual(story.handle({ type: 'near', id: wall.id }).map(e => e.kind), ['dialogue', 'lights']);
  assert.ok(story.has('luz-pica-pared'));
  assert.deepEqual(story.blocked('castillo-3'), []);
  assert.deepEqual(story.triggers('castillo-3'), []);
});
