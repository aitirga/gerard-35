import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../src/story.ts';
import { flagsAt, missionJump, missionParts } from '../src/story-points.ts';
import { ALEGIA, CUERDAS_PLACE, LINES_MARTA, PLACES_CUERDAS, PLACES_MARTA, QUALITIES } from '../src/friends/marta.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { mazeAt } from '../src/cuerdas.ts';

const beats = effects => effects.map(e => e.kind);
const inAlegia = () => new Story(flagsAt('metro'));
const inside = (beaten = []) => { const story = new Story(flagsAt('cuerdas')); story.startMarta({ beaten }); story.inside = CUERDAS_PLACE; return story; };

test('Marta and the piano stand where they can be walked up to, in Alegia and inside', () => {
  const alegia = ENVIRONMENTS[ALEGIA].grid, cuerdas = ENVIRONMENTS[CUERDAS_PLACE].grid;
  for (const cell of [PLACES_MARTA.marta, PLACES_MARTA.piano.seat, PLACES_MARTA.bubble, PLACES_MARTA.back, ...PLACES_MARTA.piano.cells]) assert.ok(canWalk(cell, alegia), JSON.stringify(cell));
  assert.deepEqual(inAlegia().blocked(ALEGIA), PLACES_MARTA.piano.cells, 'the piano is in the way');
  for (const cell of [PLACES_CUERDAS.spawn, PLACES_CUERDAS.exit, ...PLACES_CUERDAS.marta, ...QUALITIES.map(q => q.cell)]) {
    assert.ok(canWalk(cell, cuerdas), JSON.stringify(cell));
    assert.equal(mazeAt(cell), undefined, 'never on a piece that drops');
  }
});

test('the piano does nothing until they have spoken to her; then her note takes the three of them in', () => {
  const story = inAlegia();
  assert.deepEqual(story.interactions(ALEGIA).map(i => i.id).filter(id => id.includes('marta')), ['talk-marta', 'piano-marta']);
  assert.equal(story.handle({ type: 'interact', id: 'piano-marta' })[0].dialogue, LINES_MARTA.pianoBefore);
  assert.ok(!story.has('cuerdas'));
  assert.equal(story.handle({ type: 'interact', id: 'talk-marta' })[0].dialogue, LINES_MARTA.arrive);
  assert.equal(story.handle({ type: 'interact', id: 'talk-marta' })[0].dialogue, LINES_MARTA.waiting);
  const hour = story.clock.hour;
  const play = story.handle({ type: 'interact', id: 'piano-marta' });
  // Her recording of «Izana dena geroa» comes out as Aitor plays, the first time only.
  assert.deepEqual(beats(play).slice(0, 5), ['song', 'dialogue', 'portal', 'travel', 'dialogue']);
  assert.equal(play[0].track, 'izana');
  assert.equal(play[2].who, 'everyone');
  assert.deepEqual(play[3], { kind: 'travel', environment: CUERDAS_PLACE, cell: PLACES_CUERDAS.spawn });
  assert.ok(story.has('cuerdas') && story.clock.hour > hour, 'going in takes its hour');
  // Out through the bubble and in again: no talk over, no second hour.
  assert.deepEqual(story.handle({ type: 'interact', id: 'salir-cuerdas' }), [{ kind: 'travel', environment: ALEGIA, cell: { ...PLACES_MARTA.back } }]);
  const later = story.clock.hour;
  assert.deepEqual(beats(story.handle({ type: 'interact', id: 'piano-marta' })), ['portal', 'travel', 'dialogue']);
  assert.equal(story.clock.hour, later);
});

test('inside, each quality is its fight in turn, and La Voz only once the three are beaten', () => {
  const story = inside();
  const ids = () => story.triggers(CUERDAS_PLACE).map(t => t.id);
  assert.deepEqual(ids(), ['cuerdas-laberinto-0', 'cuerdas-laberinto-1', 'cuerdas-laberinto-2', 'cuerdas-lealtad', 'cuerdas-cristalino', 'cuerdas-directo']);
  // What Aitor notices before a maze is said once.
  assert.deepEqual(beats(story.handle({ type: 'near', id: 'cuerdas-laberinto-0' })), ['dialogue']);
  assert.deepEqual(story.handle({ type: 'near', id: 'cuerdas-laberinto-0' }), []);
  assert.deepEqual(story.handle({ type: 'near', id: 'cuerdas-voz' }), [], 'not before the three');
  assert.deepEqual(story.cuerdasFoes(CUERDAS_PLACE).map(f => f.beaten), [false, false, false, false]);
  QUALITIES.forEach((q, i) => {
    const met = story.handle({ type: 'near', id: `cuerdas-${q.id}` });
    assert.deepEqual(beats(met), ['dialogue', 'battle']);
    assert.equal(met[1].encounter, q.encounter);
    const before = story.npcs(CUERDAS_PLACE)[0].cell;
    const won = story.handle({ type: 'battle', won: true, encounter: q.encounter });
    // She says she feels nothing yet, and comes a platform further in.
    assert.equal(won[0].dialogue, LINES_MARTA.beside[i + 1]);
    assert.ok(story.npcs(CUERDAS_PLACE)[0].cell.z < before.z);
    assert.ok(!ids().includes(`cuerdas-${q.id}`));
  });
  assert.ok(ids().includes('cuerdas-voz'));
  const voz = story.handle({ type: 'near', id: 'cuerdas-voz' });
  assert.deepEqual(beats(voz), ['dialogue', 'battle']);
  assert.equal(voz[1].encounter, 'voz');
});

test('La Voz beaten: her ánima and her light, back in Alegia, the day spent, and nothing left inside', () => {
  const story = inside(QUALITIES.map(q => q.id));
  const won = story.handle({ type: 'battle', won: true, encounter: 'voz' });
  assert.deepEqual(beats(won).slice(0, 5), ['dialogue', 'travel', 'dialogue', 'dialogue', 'lights']);
  assert.equal(won[3].dialogue, LINES_MARTA.coro, 'they send her to the choir before her light goes');
  assert.deepEqual(won[4].people, ['marta']);
  assert.equal(won[1].environment, ALEGIA);
  for (const flag of ['voz', 'anima-marta', 'luz-marta']) assert.ok(story.has(flag), flag);
  assert.ok(story.animas.includes('marta') && story.jar.includes('marta'));
  assert.deepEqual(story.triggers(CUERDAS_PLACE), []);
  assert.ok(story.cuerdasFoes(CUERDAS_PLACE).every(f => f.beaten));
  assert.deepEqual(story.npcs(CUERDAS_PLACE), []);
  story.inside = ALEGIA;
  assert.equal(story.handle({ type: 'interact', id: 'talk-marta' })[0].dialogue, LINES_MARTA.after);
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'voz' }).filter(e => e.kind === 'lights'), [], 'only once');
});

test('she never sounds like herself before the end, and nobody tells the player what to do', () => {
  const early = [LINES_MARTA.arrive, LINES_MARTA.waiting, LINES_MARTA.piano, LINES_MARTA.inside, ...LINES_MARTA.beside, LINES_MARTA.lealtad, LINES_MARTA.cristalino, LINES_MARTA.directo];
  for (const d of early) for (const line of d.lines.filter(l => l.speaker === 'marta')) assert.ok(!/!/.test(line.text), line.text);
  const all = Object.values(LINES_MARTA).flat().flatMap(d => d.lines.map(l => l.text));
  for (const text of all) assert.ok(!/\bclase\b/i.test(text) && !/pulsa|botón|tecla [A-Z]\b/.test(text), text);
});

test('the picker can start the mission at every part', () => {
  const parts = missionParts('marta');
  assert.deepEqual(parts.map(p => p.id), ['start', 'piano', 'inside', 'maze-1', 'lealtad', 'maze-2', 'cristalino', 'maze-3', 'directo', 'voz', 'won', 'done']);
  for (const part of parts) {
    const jump = missionJump('marta', part.id);
    assert.ok(jump.flags.includes('metro'), part.id);
    if (jump.spot?.cell) assert.ok(canWalk(jump.spot.cell, ENVIRONMENTS[jump.spot.environment].grid), `${part.id} ${JSON.stringify(jump.spot.cell)}`);
  }
});
