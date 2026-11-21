import test from 'node:test';
import assert from 'node:assert/strict';
import { definitivasOpen, extraSlots, growthStage, levelCap } from '../src/castle.ts';
import { IMPROVEMENTS, asleep, improvementOf, inSky, stageOf, withinEcos } from '../src/ecos.ts';
import { LEVEL_XP, award, reachOf } from '../src/levels.ts';
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';

// Growth opens with the castle (docs/animas/README.md § Growth opens with the castle, docs/castle.md § What each boss opens).
const MISSIONS = ['nuria', 'universidad', 'marta', 'emilie', 'luca'];
const GRADE_III = ['matemagico:combustion', 'matemagico:vulcano', 'matemagico:integral', 'tecnopata:reinicio', 'tecnopata:virus', 'tecnopata:escudo-de-bits'];
const FIRE = ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion', 'matemagico:vulcano'];

test('one stage for the jar, the levels and the slots: from the start, after Aurelià, after Dirección', () => {
  assert.equal(growthStage(new Set()), 1);
  assert.equal(growthStage(new Set(['aurelia'])), 2);
  assert.equal(growthStage(new Set(['aurelia', 'direccion'])), 3);
  assert.deepEqual([1, 2, 3].map(levelCap), [4, 6, 7]);
  assert.deepEqual([1, 2, 3].map(extraSlots), [1, 2, 2], 'three ánimas each from Aurelià, never four');
  assert.deepEqual([1, 2, 3].map(definitivasOpen), [false, false, true]);
});

test('grade III comes into the sky after Aurelià, with whatever hangs from it; the definitivas wake after Dirección', () => {
  for (const id of GRADE_III) assert.equal(stageOf(improvementOf(id)), 2, id);
  for (const item of IMPROVEMENTS.filter(i => i.after && stageOf(improvementOf(i.after)) === 2)) assert.equal(stageOf(item), 2, `${item.id} hangs from grade III`);
  for (const id of ['matemagico:rescoldo', 'matemagico:mana-1', 'tecnopata:telemetria', 'tecnopata:control-remoto', 'tecnopata:nanitos', 'papagato:mana-1', 'dadaista:otra-vez']) assert.equal(stageOf(improvementOf(id)), 1, id);
  const combustion = improvementOf('matemagico:combustion'), fiesta = improvementOf('prismatico:definitiva');
  assert.ok(!inSky(combustion, 1) && inSky(combustion, 2), 'until then the constellation simply has fewer stars');
  assert.ok(inSky(fiesta, 1) && asleep(fiesta, 1) && asleep(fiesta, 2), 'a definitiva is a place kept, asleep');
  assert.ok(!asleep(fiesta, 3), 'Fin de fiesta wakes with Dirección');
  assert.ok(!asleep(improvementOf('papagato:definitiva'), 3), 'Siete vidas wakes with Dirección too');
  assert.ok(asleep(improvementOf('dadaista:definitiva'), 3), 'one whose move is not built sleeps on');
  assert.deepEqual(withinEcos(FIRE, 20, 1), FIRE.slice(0, 3), 'before Aurelià the fire line ends at Rescoldo');
  assert.deepEqual(withinEcos(FIRE, 20, 2), FIRE);
  assert.deepEqual(withinEcos(['prismatico:definitiva'], 5, 2), []);
  assert.deepEqual(withinEcos(['prismatico:definitiva'], 5, 3), ['prismatico:definitiva']);
  assert.deepEqual(withinEcos(FIRE, 20), FIRE, 'the development tools see everything');
});

test('the castle\'s cap holds a shared ánima, keeps the EXP it earns and gives its levels once it rises', () => {
  assert.equal(reachOf('dadaista', 4), 4);
  assert.equal(reachOf('papagato', 6), 6);
  assert.equal(reachOf('sincopante', 6), 6);
  assert.equal(reachOf('matemagico', 6), 1, 'never past its own top: an own ánima grows by its tree');
  const [held] = award(['dadaista'], LEVEL_XP[4], {}, {}, 4);
  assert.equal(held.levelAfter, 4);
  assert.equal(held.reach, 4);
  assert.equal(held.xpAfter, LEVEL_XP[4], 'the EXP over the cap is kept');
  const [more] = award(['dadaista'], 100, { dadaista: held.xpAfter }, { dadaista: 4 }, 4);
  assert.equal(more.xpAfter, LEVEL_XP[4] + 100, 'and goes on being kept at the cap');
  const [ripe] = award(['dadaista'], 0, { dadaista: more.xpAfter }, { dadaista: 4 }, 6);
  assert.equal(ripe.levelAfter, 6);
  assert.ok(ripe.learned.includes('ases-en-duo'), 'what levels 5 and 6 teach comes with them');
  const [top] = award(['papagato'], 500, { papagato: LEVEL_XP.at(-1) }, { papagato: 7 }, 7);
  assert.equal(top.xpAfter, top.xpBefore, 'at its own top an ánima keeps still, as ever');
});

test('in the story: Aurelià opens grade III and level 6, the dúo mayor as one more star; Dirección the definitivas and level 7', () => {
  const story = new Story(flagsAt('castle', MISSIONS));
  story.debugEcos = 30;
  assert.equal(story.stage, 1);
  // Colorista earns what level 6 is worth before Aurelià: it stops at 4 and keeps the rest.
  const early = story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['prismatico'], xp: LEVEL_XP[4] });
  assert.equal(story.levels.prismatico, 4);
  assert.equal(story.xp.prismatico, LEVEL_XP[4]);
  assert.deepEqual(early.filter(e => e.kind === 'learn').map(e => e.level), [2, 3, 4]);
  for (const id of FIRE.slice(0, 3)) assert.ok(story.improve(id), id);
  assert.ok(!story.improve('matemagico:combustion'), 'grade III cannot be bought before Aurelià');
  assert.ok(!story.improve('prismatico:definitiva'), 'nor a definitiva');
  story.improvements = [...story.improvements, 'matemagico:combustion'];
  assert.deepEqual(story.improvements, FIRE.slice(0, 3), 'nor stands if a save has it');

  const won = story.handle({ type: 'battle', won: true, encounter: 'aurelia' });
  assert.equal(story.stage, 2);
  assert.equal(story.levelCap, 6);
  assert.equal(story.levels.prismatico, 6, 'the EXP kept over the old cap gives its levels now');
  const notes = won.filter(e => e.kind === 'learn' && !e.quiet);
  assert.deepEqual(notes.map(e => [e.classId, e.level]), [['prismatico', 5], ['prismatico', 6]]);
  assert.ok(won.indexOf(notes[0]) > won.findIndex(e => e.kind === 'wake'), 'back home, after the flash');
  assert.deepEqual(story.improvements, [...FIRE.slice(0, 3), 'matemagico:combustion'], 'what was put in grade III stands now');
  assert.ok(story.improve('matemagico:vulcano'), 'and the dúo mayor past it can be bought');
  assert.ok(!story.improve('prismatico:definitiva'), 'the definitivas still sleep');

  story.handle({ type: 'battle', won: true, encounter: 'dogs', worn: ['prismatico'], xp: 5000 });
  assert.equal(story.levels.prismatico, 6);
  story.handle({ type: 'battle', won: true, encounter: 'direccion' });
  assert.equal(story.stage, 3);
  assert.equal(story.levels.prismatico, 7);
  assert.ok(story.improve('prismatico:definitiva'), 'Dirección wakes Fin de fiesta');
  assert.ok(story.improved.skills.includes('fin-de-fiesta'));
});
