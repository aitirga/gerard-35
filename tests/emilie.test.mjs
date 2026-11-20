import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../src/story.ts';
import { flagsAt, missionJump, missionParts, missionNow } from '../src/story-points.ts';
import { LINES_EMILIE, MODELO_PLACE, PISO, PLACES_EMILIE, PLACES_MODELO, PLACES_PISO, POBLE_SEC } from '../src/friends/emilie.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { PATROLS } from '../src/modelo.ts';

const beats = effects => effects.map(e => e.kind);
const inPobleSec = () => new Story(flagsAt('metro'));
const inModel = () => { const story = new Story(flagsAt('modelo')); story.inside = MODELO_PLACE; return story; };

test('her door, her flat and the way out of her model stand where they can be walked up to', () => {
  assert.ok(canWalk(PLACES_EMILIE.door, ENVIRONMENTS[POBLE_SEC].grid));
  const piso = ENVIRONMENTS[PISO].grid;
  for (const cell of [PLACES_PISO.spawn, PLACES_PISO.exit, PLACES_PISO.emilie, PLACES_PISO.laptop]) assert.ok(canWalk(cell, piso), JSON.stringify(cell));
  for (const cell of PLACES_PISO.desk) assert.ok(!canWalk(cell, piso), 'the desk is furniture');
  const modelo = ENVIRONMENTS[MODELO_PLACE].grid;
  for (const cell of [PLACES_MODELO.spawn, PLACES_MODELO.exit]) assert.ok(canWalk(cell, modelo), JSON.stringify(cell));
  // The flat's door goes back down to her door on Margarit.
  assert.deepEqual(ENVIRONMENTS[PISO].interactions.find(i => i.id === 'piso-emilie-salida').to, { environment: POBLE_SEC, cell: { ...PLACES_EMILIE.door } });
});

test('in chapter 2 her door rings instead of being looked at, and takes them up into the flat', () => {
  assert.ok(!new Story(flagsAt('got-wrapper')).interactions(POBLE_SEC).some(i => i.id === 'poble-sec-emilie'), 'not before the city opens');
  const story = inPobleSec();
  const door = story.interactions(POBLE_SEC).find(i => i.id === 'poble-sec-emilie');
  assert.equal(door.label, 'Llamar al portal');
  const first = story.handle({ type: 'interact', id: 'poble-sec-emilie' });
  assert.deepEqual(beats(first), ['dialogue', 'travel']);
  assert.equal(first[0].dialogue, LINES_EMILIE.door);
  assert.deepEqual(first[1], { kind: 'travel', environment: PISO, cell: PLACES_PISO.spawn });
  assert.equal(story.handle({ type: 'interact', id: 'poble-sec-emilie' })[0].dialogue, LINES_EMILIE.doorAgain);
});

test('the laptop does nothing until they have spoken to her; then they connect and are inside her model', () => {
  const story = inPobleSec();
  story.inside = PISO;
  assert.deepEqual(story.npcs(PISO).map(n => n.id), ['emilie']);
  assert.deepEqual(story.interactions(PISO).map(i => i.id), ['talk-emilie', 'portatil-emilie']);
  assert.equal(story.handle({ type: 'interact', id: 'portatil-emilie' })[0].dialogue, LINES_EMILIE.laptopBefore);
  assert.ok(!story.has('modelo'));
  assert.equal(story.handle({ type: 'interact', id: 'talk-emilie' })[0].dialogue, LINES_EMILIE.arrive);
  assert.ok(story.has('poble-sec-emilie'));
  assert.equal(story.handle({ type: 'interact', id: 'talk-emilie' })[0].dialogue, LINES_EMILIE.waiting);
  assert.equal(story.interactions(PISO).find(i => i.id === 'portatil-emilie').hint, 'Mirar');
  const hour = story.clock.hour;
  const connect = story.handle({ type: 'interact', id: 'portatil-emilie' });
  // The Queen's whirlpool swells out of the screen and takes the two of them; Emilie stays.
  assert.deepEqual(beats(connect).slice(0, 4), ['dialogue', 'portal', 'travel', 'dialogue']);
  assert.deepEqual(connect[1], { kind: 'portal', who: 'party', open: { ...PLACES_PISO.portal }, queen: true });
  assert.deepEqual(connect[2], { kind: 'travel', environment: MODELO_PLACE, cell: PLACES_MODELO.spawn });
  assert.equal(connect[3].dialogue, LINES_EMILIE.inside);
  assert.equal(story.interactions(PISO).find(i => i.id === 'portatil-emilie').hint, 'Entrar');
  assert.ok(story.has('modelo') && story.clock.hour > hour, 'going in takes its hour');
  // Back out by the laptop and in again: no talk over, no second hour, and the run is where they left it.
  story.inside = MODELO_PLACE;
  assert.ok(story.interactions(MODELO_PLACE).some(i => i.id === 'salir-modelo'));
  story.modeloRun().placed.push('suelo-1');
  assert.deepEqual(story.handle({ type: 'interact', id: 'salir-modelo' }), [{ kind: 'travel', environment: PISO, cell: { ...PLACES_PISO.laptop } }]);
  const later = story.clock.hour;
  const again = story.handle({ type: 'interact', id: 'portatil-emilie' });
  assert.deepEqual(beats(again), ['dialogue', 'portal', 'travel', 'dialogue']);
  assert.equal(again[3].dialogue, LINES_EMILIE.insideAgain);
  assert.equal(story.clock.hour, later);
  assert.deepEqual(story.modeloRun().placed, ['suelo-1']);
});

test('in her model a patrol is its fight, she speaks once per zone below, and once before El que no converge', () => {
  const story = inModel();
  for (const patrol of PATROLS) assert.deepEqual(story.handle({ type: 'near', id: `modelo-${patrol.id}` }), [{ kind: 'battle', encounter: patrol.encounter }]);
  for (const zone of ['gravas', 'ciudad', 'fondo']) {
    const said = story.handle({ type: 'near', id: `modelo-zona-${zone}` });
    assert.deepEqual(beats(said), ['dialogue']);
    assert.equal(said[0].dialogue, LINES_EMILIE.zones[zone]);
    assert.deepEqual(story.handle({ type: 'near', id: `modelo-zona-${zone}` }), [], 'once');
  }
  assert.deepEqual(beats(story.handle({ type: 'near', id: 'modelo-jefe' })), ['dialogue', 'battle']);
  assert.deepEqual(story.handle({ type: 'near', id: 'modelo-jefe' }), [{ kind: 'battle', encounter: 'no-converge' }]);
});

test('El que no converge beaten in her model: her ánima and her light, back in the flat, the day spent', () => {
  const story = inModel();
  const won = story.handle({ type: 'battle', won: true, encounter: 'no-converge' });
  assert.deepEqual(beats(won).slice(0, 5), ['dialogue', 'travel', 'dialogue', 'dialogue', 'lights']);
  assert.equal(won[3].dialogue, LINES_EMILIE.coro, 'they send her to the choir before her light goes');
  assert.deepEqual(won[4].people, ['emilie']);
  assert.equal(won[1].environment, PISO);
  for (const flag of ['converge', 'anima-emilie', 'luz-emilie']) assert.ok(story.has(flag), flag);
  assert.ok(story.animas.includes('emilie') && story.jar.includes('emilie'));
  story.inside = PISO;
  assert.equal(story.handle({ type: 'interact', id: 'talk-emilie' })[0].dialogue, LINES_EMILIE.after);
  assert.equal(story.handle({ type: 'interact', id: 'portatil-emilie' })[0].dialogue, LINES_EMILIE.laptopAfter);
  story.inside = MODELO_PLACE;
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'no-converge' }).filter(e => e.kind === 'lights'), [], 'only once');
});

test('the boss in the fight tester gives nothing: only beating it inside her model does', () => {
  const story = inPobleSec();
  story.inside = POBLE_SEC;
  assert.deepEqual(story.handle({ type: 'battle', won: true, encounter: 'no-converge' }), []);
  assert.ok(!story.has('converge'));
});

test('nobody tells the player what to do, and nobody says «clase»', () => {
  const dialogues = Object.values(LINES_EMILIE).flatMap(d => d.lines ? [d] : Object.values(d));
  for (const text of dialogues.flatMap(d => d.lines.map(l => l.text))) assert.ok(!/\bclase\b/i.test(text) && !/pulsa|botón|tecla [A-Z]\b/.test(text), text);
});

test('the picker can start the mission at every part, and says where it is', () => {
  const parts = missionParts('emilie');
  assert.deepEqual(parts.map(p => p.id), ['start', 'piso', 'laptop', 'suelo', 'gravas', 'ciudad', 'fondo', 'won', 'done']);
  for (const part of parts) {
    const jump = missionJump('emilie', part.id);
    assert.ok(jump.flags.includes('metro'), part.id);
    if (jump.spot?.cell) assert.ok(canWalk(jump.spot.cell, ENVIRONMENTS[jump.spot.environment].grid), `${part.id} ${JSON.stringify(jump.spot.cell)}`);
  }
  // Each zone part has gone down by one stake per zone above it.
  assert.deepEqual(['gravas', 'ciudad', 'fondo'].map(id => parts.find(p => p.id === id).emilie.section.zone), ['gravas', 'ciudad', 'fondo']);
  assert.equal(missionNow('emilie', flagsAt('metro')), 'start');
  assert.equal(missionNow('emilie', flagsAt('poble-sec-emilie')), 'laptop');
  assert.equal(missionNow('emilie', flagsAt('modelo')), 'suelo');
  assert.equal(missionNow('emilie', flagsAt('luz-emilie')), 'done');
});
