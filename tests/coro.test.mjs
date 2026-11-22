import test from 'node:test';
import assert from 'node:assert/strict';
import { LINES_NURIA } from '../src/friends/nuria.ts';
import { LINES_MARTA } from '../src/friends/marta.ts';
import { LINES_EMILIE } from '../src/friends/emilie.ts';
import { LINES_LUCA } from '../src/friends/luca.ts';
import { LINES_UNI } from '../src/friends/universidad.ts';

// Every ánima mission ends with Gerard and Aitor sending the people helped to the choir
// (docs/quests/coro.md § The choir room): it is why they turn up there every morning after.
/** The missions whose people Gerard speaks Catalan with. */
const CATALAN = ['nuria', 'luca', 'universidad'];
const ENDINGS = { nuria: LINES_NURIA, marta: LINES_MARTA, emilie: LINES_EMILIE, luca: LINES_LUCA, universidad: LINES_UNI };

test('every ánima mission ends with Gerard and Aitor naming the choir, where it is, and asking them to always remember it', () => {
  for (const [mission, lines] of Object.entries(ENDINGS)) {
    const coro = lines.coro;
    assert.ok(coro, `${mission} has its choir lines`);
    const by = speaker => coro.lines.filter(l => l.speaker === speaker).map(l => l.text).join(' ');
    assert.match(by('aitor'), /A cop de diapasó/, `${mission}: Aitor, who directs it, names the choir`);
    assert.match(by('aitor'), /Meridiana/, `${mission}: and says where it is`);
    // Gerard speaks Catalan with his people (docs/chapter-1.md § Catalan with his people): Nuria, Luca and the university friends.
    const catalan = CATALAN.includes(mission);
    assert.match(by('gerard35'), catalan ? /Passi el que passi/ : /Pase lo que pase/, `${mission}: Gerard asks them to come whatever happens`);
    assert.match(by('gerard35'), catalan ? /sempre/i : /siempre/i, `${mission}: and to always remember it`);
    assert.ok(coro.lines.some(l => l.speaker !== 'aitor' && l.speaker !== 'gerard35'), `${mission}: the people helped answer`);
  }
});

// The choir's room inside (docs/quests/coro.md § The room inside): the people each mission saved come
// there the morning after, and stay there instead of at their own place.
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { CHOIR_GROUPS, CHOIR_PEOPLE, LINES_CORO, PLACES_CORO } from '../src/friends/coro.ts';

const sleep = story => {
  if (!story.night) { story.handle({ type: 'interact', id: 'meridiana-bed' }); story.handle({ type: 'evening', what: 'cama' }); }
  story.handle({ type: 'interact', id: 'meridiana-bed' });
};

test('by day the shutter is up and the avenue door goes into the room; at night it is down', () => {
  const story = new Story(flagsAt('tv-news'));
  const door = story.interactions('meridiana-calle').find(i => i.id === 'meridiana-coro');
  assert.equal(door.label, 'Entrar al local del coro');
  assert.deepEqual(story.handle({ type: 'interact', id: 'meridiana-coro' }), [{ kind: 'travel', environment: 'coro', cell: { ...PLACES_CORO.spawn } }]);
  assert.ok(canWalk(PLACES_CORO.spawn, ENVIRONMENTS.coro.grid) && canWalk(PLACES_CORO.stand, ENVIRONMENTS.coro.grid));
  assert.ok(story.interactions('coro').some(i => i.id === 'coro-ensayar'), 'the rehearsal is played from the stand inside');
  // Rehearsing from inside: the afternoon goes by and they come out onto the avenue at night.
  story.inside = 'coro';
  story.handle({ type: 'interact', id: 'coro-ensayar' });
  const gone = story.handle({ type: 'evening', what: 'coro' });
  assert.deepEqual(gone[0], { kind: 'travel', environment: 'meridiana-calle', cell: { x: 104, z: 42 } }, 'out under the shutter');
  assert.ok(story.night);
  assert.deepEqual(story.handle({ type: 'interact', id: 'meridiana-coro' }).map(e => e.kind), ['dialogue'], 'at night, only the shutter');
});

test('everyone a mission saved is at the choir from the morning after, and no longer at their own place', () => {
  const won = ['sobremesa', 'voz', 'converge', 'fran', 'nuria-uri'];
  const story = new Story([...new Set(won.flatMap(f => flagsAt(f)))]);
  assert.deepEqual(story.npcs('coro'), [], 'not yet: the day they are saved they are still where it happened');
  assert.ok(story.npcs('piso-emilie').length && story.npcs('barceloneta').length);
  sleep(story);
  const here = story.npcs('coro');
  assert.deepEqual(here.map(n => n.id).sort(), [...CHOIR_PEOPLE].sort(), 'all of them, in the room');
  for (const npc of here) assert.ok(canWalk(npc.cell, ENVIRONMENTS.coro.grid), `${npc.id} stands in an aisle`);
  assert.equal(new Set(here.map(n => `${n.cell.x},${n.cell.z}`)).size, here.length, 'each in a place of their own');
  for (const [place, who] of [['cardedeu', 'nuria'], ['barceloneta', 'anna'], ['alegia', 'marta'], ['piso-emilie', 'emilie'], ['sagrada-familia', 'luca']]) {
    assert.ok(!story.npcs(place).some(n => n.id === who), `${who} is no longer at ${place}`);
  }
  assert.ok(!story.interactions('piso-emilie').some(i => i.id === 'talk-emilie'));
  assert.deepEqual(story.handle({ type: 'interact', id: 'poble-sec-emilie' }), [{ kind: 'dialogue', dialogue: LINES_CORO.emilieDoor }], 'nobody answers her door');
  // Speaking to anyone there, their group answers.
  for (const id of CHOIR_PEOPLE) {
    assert.ok(story.interactions('coro').some(i => i.id === `coro-hablar-${id}`), `${id} can be spoken to`);
    assert.deepEqual(story.handle({ type: 'interact', id: `coro-hablar-${id}` }), [{ kind: 'dialogue', dialogue: LINES_CORO.talk[CHOIR_GROUPS[id]] }]);
  }
});

test('only the missions won send people: one saved, one group in the room', () => {
  const story = new Story(flagsAt('converge'));
  sleep(story);
  assert.deepEqual(story.npcs('coro').map(n => n.id), ['emilie']);
});
