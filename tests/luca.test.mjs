import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../src/story.ts';
import { flagsAt, missionJump, missionNow, missionParts } from '../src/story-points.ts';
import { DOOR, FURNITURE, INTERIOR, LINES_LUCA, LOOKS, MIRRORS, PLACES_LUCA, QUEUES, QUEUE_LEFT, SAGRADA, COLOUR_OUT, SALON_SOLID, SALON_VIEWS, ZONES, ZONE_VIEW, queueCells, zoneAt } from '../src/friends/luca.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { NEWS } from '../src/chapter-2.ts';
import { canWalk } from '../src/movement.ts';

const beats = effects => effects.map(e => e.kind);
const say = effects => effects.filter(e => e.kind === 'dialogue').map(e => e.dialogue);
const atHome = () => new Story(flagsAt('metro'));
const bySagrada = () => new Story(flagsAt('metro'));
const inSalon = (beaten = []) => { const story = new Story(flagsAt('peluqueria')); story.startLuca({ entered: true, beaten, told: ['dentro'] }); story.inside = INTERIOR; return story; };

test('Luca, his reflection, the chaplain and every zone stand where they can be walked up to', () => {
  const out = ENVIRONMENTS[SAGRADA].grid, inside = ENVIRONMENTS[INTERIOR].grid;
  for (const cell of [PLACES_LUCA.luca, PLACES_LUCA.reflejo, PLACES_LUCA.outside, PLACES_LUCA.won]) assert.ok(canWalk(cell, out), JSON.stringify(cell));
  assert.ok(!canWalk({ x: Math.round(PLACES_LUCA.water.x), z: Math.round(PLACES_LUCA.water.z) }, out), 'his reflection is in the water');
  for (const cell of [PLACES_LUCA.inside, PLACES_LUCA.capellan, ...ZONES.map(z => z.cell)]) assert.ok(canWalk(cell, inside), JSON.stringify(cell));
  assert.ok(!canWalk(PLACES_LUCA.fran, inside), 'Fran is up the presbytery steps, where nobody walks');
});

test('three clues point to him, none highlighted; Aitor puts the photo and the Sagrada Família together once', () => {
  assert.ok(NEWS.ticker.some(item => /Sagrada Família/.test(item)));
  const story = atHome();
  story.flags.delete('tv-news'); story.flags.delete('clue-sagrada');
  const photo = story.handle({ type: 'interact', id: 'meridiana-foto-luca' });
  assert.deepEqual(say(photo), [LINES_LUCA.photo]);
  assert.ok(story.has('clue-luca-foto'));
  assert.deepEqual(say(story.handle({ type: 'interact', id: 'meridiana-foto-luca' })), [LINES_LUCA.photoAgain]);
  const news = story.handle({ type: 'interact', id: 'meridiana-tv' });
  assert.ok(story.has('clue-sagrada'));
  assert.deepEqual(say(news).at(-1), LINES_LUCA.linkTv);
  const poster = story.handle({ type: 'interact', id: 'clue-sagrada-cartel' });
  assert.deepEqual(say(poster), [LINES_LUCA.poster], 'linked already: said once');
  assert.ok(story.has('clue-sagrada-cartel'));
  const other = atHome();
  other.flags.delete('clue-sagrada');
  other.handle({ type: 'interact', id: 'clue-sagrada-cartel' });
  assert.deepEqual(say(other.handle({ type: 'interact', id: 'meridiana-foto-luca' })), [LINES_LUCA.photo, LINES_LUCA.linkPoster]);
});

test('the door waits for Luca; once he has been spoken to, inside is Fran\'s salon and going in takes its hour', () => {
  const story = bySagrada();
  assert.equal(story.gate(DOOR), LINES_LUCA.doorBefore);
  assert.equal(story.salon, false);
  assert.deepEqual(story.lucaFoes(INTERIOR), [], 'the plain church before');
  assert.deepEqual(story.interactions(SAGRADA).map(i => i.id).filter(id => id.includes('luca')), ['talk-luca', 'luca-reflejo']);
  assert.deepEqual(say(story.handle({ type: 'interact', id: 'talk-luca' })), [LINES_LUCA.arrive]);
  assert.equal(story.gate(DOOR), undefined);
  assert.ok(story.salon);
  assert.equal(story.npcs(SAGRADA).find(n => n.id === 'luca').faded, 1 - 0 / 5);
  story.inside = INTERIOR;
  const hour = story.clock.hour;
  const enter = story.handle({ type: 'near', id: 'luca-dentro' });
  assert.deepEqual(say(enter), LINES_LUCA.inside);
  assert.equal(LINES_LUCA.inside.length, SALON_VIEWS.length, 'a few words over each look');
  assert.ok(LINES_LUCA.inside.flatMap(d => d.lines).length <= 6, 'the mission in few words');
  assert.deepEqual(beats(enter).slice(0, 7), ['look', 'dialogue', 'look', 'dialogue', 'look', 'dialogue', 'look'], 'the camera goes to Fran, to the queue and to the moths, each while its lines are said');
  assert.deepEqual(enter.filter(e => e.kind === 'look'), [...SALON_VIEWS.map(v => ({ kind: 'look', cell: { ...v.cell }, height: v.height })), { kind: 'look' }]);
  assert.ok(story.has('peluqueria') && story.clock.hour > hour);
  assert.deepEqual(story.handle({ type: 'near', id: 'luca-dentro' }), []);
});

test('the way goes round the crossing: each zone is its fight once, in order, and the queue ahead moves on as each is won', () => {
  const story = inSalon();
  assert.equal(story.lucaFoes(INTERIOR).length, 4, 'all four wait where they stand');
  const ids = () => story.triggers(INTERIOR).map(t => t.id).filter(id => ZONES.some(z => id === `luca-${z.id}`));
  assert.deepEqual(ids(), ['luca-recepcion'], 'only the next one starts');
  assert.deepEqual(story.handle({ type: 'near', id: 'luca-carta' }), [], 'one further on does nothing');
  const blocked = () => story.blocked(INTERIOR).map(c => `${c.x},${c.z}`);
  for (const q of QUEUES) assert.ok(q.cells.every(c => blocked().includes(`${c.x},${c.z}`)), q.id);
  const first = story.handle({ type: 'near', id: 'luca-recepcion' });
  assert.deepEqual(beats(first), ['dialogue', 'battle'], 'the moths were shown coming in');
  assert.equal(first[1].encounter, 'luca-recepcion');
  assert.deepEqual(beats(story.handle({ type: 'near', id: 'luca-recepcion' })), ['battle'], 'its line only once');
  assert.deepEqual(say(story.handle({ type: 'interact', id: 'talk-capellan' })), [LINES_LUCA.capellan[0]]);
  for (const [i, zone] of ZONES.entries()) {
    assert.deepEqual(ids(), [`luca-${zone.id}`]);
    if (i) {
      const near = story.handle({ type: 'near', id: `luca-${zone.id}` });
      assert.deepEqual(beats(near), ['look', 'dialogue', 'look', 'battle'], `${zone.id}: the camera comes close to what waits there while it is named`);
      assert.deepEqual(near[0], { kind: 'look', cell: { ...zone.cell }, height: ZONE_VIEW });
    }
    const won = story.handle({ type: 'battle', won: true, encounter: zone.encounter });
    assert.deepEqual(say(won), [LINES_LUCA.zoneWon[i]]);
    const freed = QUEUES.find(q => q.after === zone.id);
    assert.deepEqual(won[0], { kind: 'colour', from: { ...zone.cell }, to: { ...COLOUR_OUT }, colour: zone.colour }, 'its colour goes out of the door, seen');
    assert.deepEqual(won[1], { kind: 'look', cell: { ...freed?.look ?? PLACES_LUCA.capellan }, height: freed ? 11 : 9 }, 'the camera turns to the queue that moved on');
    assert.deepEqual(won.at(-1), { kind: 'look' });
    if (freed) {
      assert.ok(!freed.cells.slice(QUEUE_LEFT, -QUEUE_LEFT).some(c => blocked().includes(`${c.x},${c.z}`)), `${freed.id} moves on: the way opens through its middle`);
      assert.ok(queueCells(freed, true).every(c => blocked().includes(`${c.x},${c.z}`)), `${freed.id}: its ends wait on by the walls`);
      assert.ok(!queueCells(freed, true).some(c => c.x === freed.look.x && c.z === freed.look.z));
      assert.ok(!story.interactions(INTERIOR).some(i => i.id === `luca-cola-${freed.id}`));
    }
  }
  assert.deepEqual(blocked(), [...QUEUES.flatMap(q => queueCells(q, true)), ...MIRRORS, ...SALON_SOLID].map(m => `${m.x},${m.z}`), 'only the queues\' ends, the mirrors and the salon\'s furniture stand in the way now');
  assert.equal(story.npcs(SAGRADA).find(n => n.id === 'luca').faded, 1 - 4 / 5, 'a colour back for each zone');
  const boss = story.handle({ type: 'interact', id: 'talk-capellan' });
  assert.deepEqual(say(boss), [LINES_LUCA.ready, LINES_LUCA.fran]);
  assert.equal(boss.at(-1).encounter, 'fran');
});

test('each zone is lit by its own windows, and the queues keep the way whole', () => {
  assert.deepEqual(ZONES.map(z => z.walk), ['nacimiento', 'nave', 'pasion', 'abside']);
  for (const z of ZONES) assert.equal(zoneAt(z.cell)?.id, z.id, z.id);
  assert.equal(zoneAt(PLACES_LUCA.capellan), undefined, 'the crossing has the nave\'s light');
  const grid = ENVIRONMENTS[INTERIOR].grid;
  for (const q of QUEUES) {
    for (const c of q.cells) assert.equal(grid[c.z][c.x], '.', `${q.id} ${c.x},${c.z}`);
    assert.ok(canWalk(q.look, grid), q.id);
  }
});

test('turning the nave\'s mirrors brings the light to the chaplains\' chairs; they start their fight dazzled', () => {
  const story = inSalon(['recepcion']);
  assert.deepEqual(story.interactions(INTERIOR).map(i => i.id).filter(id => id.startsWith('luca-espejo')), ['luca-espejo-0', 'luca-espejo-1', 'luca-espejo-2']);
  assert.equal(story.dazzled('luca-sillones'), false);
  // Coming into the nave anywhere across its mouth, the camera follows the light to the wall it ends on.
  const mouth = story.triggers(INTERIOR).find(t => t.id === 'luca-espejos');
  assert.deepEqual(mouth.area, { x: 20, z: 6, w: 3, d: 29 });
  const seen = story.handle({ type: 'near', id: 'luca-espejos' });
  assert.deepEqual(say(seen), [LINES_LUCA.mirrors]);
  assert.deepEqual(seen.map(e => e.kind), ['look', 'dialogue', 'look']);
  assert.ok(Math.hypot(seen[0].cell.x - MIRRORS[1].x, seen[0].cell.z - 9) < 3, 'between the second mirror and the wall');
  assert.deepEqual(story.handle({ type: 'near', id: 'luca-espejos' }), []);
  assert.deepEqual(story.handle({ type: 'interact', id: 'luca-espejo-1' }), []);
  assert.deepEqual(say(story.handle({ type: 'interact', id: 'luca-espejo-2' })), [LINES_LUCA.dazzled]);
  assert.ok(story.beam.hit && story.dazzled('luca-sillones'));
  assert.equal(story.dazzled('luca-carta'), false);
  // Turned away again and back: said once.
  story.handle({ type: 'interact', id: 'luca-espejo-2' });
  assert.equal(story.dazzled('luca-sillones'), false);
  assert.deepEqual(story.handle({ type: 'interact', id: 'luca-espejo-2' }), []);
});

test('the salon\'s furniture stands on the floor and keeps Gerard out; one thing in each zone can be looked at', () => {
  const grid = ENVIRONMENTS[INTERIOR].grid, story = inSalon();
  const blocked = story.blocked(INTERIOR).map(c => `${c.x},${c.z}`);
  for (const c of SALON_SOLID) { assert.equal(grid[c.z][c.x], '.', `${c.x},${c.z}`); assert.ok(blocked.includes(`${c.x},${c.z}`)); }
  assert.equal(SALON_SOLID.length, 3 + (FURNITURE.bar.to - FURNITURE.bar.from + 1) + FURNITURE.lenses.length + FURNITURE.charts.length);
  // Nothing of it in a queue, on a mirror, where a zone's foes wait or where anything is looked at from.
  const taken = [...QUEUES.flatMap(q => [...q.cells, q.look]), ...MIRRORS, ...ZONES.map(z => z.cell), ...LOOKS.map(l => l.cell), PLACES_LUCA.inside, PLACES_LUCA.capellan].map(c => `${c.x},${c.z}`);
  for (const c of SALON_SOLID) assert.ok(!taken.includes(`${c.x},${c.z}`), `${c.x},${c.z}`);
  const ids = story.interactions(INTERIOR).map(i => i.id);
  for (const look of LOOKS) {
    assert.ok(canWalk(look.cell, grid) && !blocked.includes(`${look.cell.x},${look.cell.z}`), look.id);
    assert.ok(ids.includes(look.id));
    assert.deepEqual(say(story.handle({ type: 'interact', id: look.id })), [LINES_LUCA.looks[look.id]]);
  }
  const after = new Story(flagsAt('luz-luca'));
  assert.ok(!after.interactions(INTERIOR).some(i => i.id.startsWith('luca-')), 'gone with the salon');
  assert.deepEqual(after.blocked(INTERIOR), []);
});

test('Fran beaten: Luca in full colour by the pond, his ánima and light, the day spent, the plain church again', () => {
  const story = inSalon(ZONES.map(z => z.id));
  const won = story.handle({ type: 'battle', won: true, encounter: 'fran' });
  assert.deepEqual(beats(won).slice(0, 5), ['dialogue', 'travel', 'dialogue', 'dialogue', 'lights']);
  assert.deepEqual(won[1], { kind: 'travel', environment: SAGRADA, cell: { ...PLACES_LUCA.won } });
  assert.deepEqual([won[2].dialogue, won[3].dialogue], [LINES_LUCA.home, LINES_LUCA.coro], 'they send him to the choir before his light goes');
  assert.deepEqual(won[4].people, ['luca']);
  for (const flag of ['fran', 'anima-luca', 'luz-luca']) assert.ok(story.has(flag), flag);
  assert.ok(story.animas.includes('luca') && story.jar.includes('luca'));
  assert.equal(story.salon, false);
  assert.equal(story.npcs(SAGRADA).find(n => n.id === 'luca').faded, 0);
  assert.deepEqual(story.npcs(INTERIOR), []);
  assert.deepEqual(say(story.handle({ type: 'interact', id: 'talk-luca' })), [LINES_LUCA.after]);
  assert.equal(story.gate(DOOR), undefined);
});

test('he talks little and half of it while grey, never names a real problem, and nobody tells the player what to do', () => {
  const grey = [LINES_LUCA.arrive, ...LINES_LUCA.waiting.slice(0, 1)];
  for (const d of grey) for (const line of d.lines.filter(l => l.speaker === 'luca')) assert.ok(!/!/.test(line.text), line.text);
  const all = Object.values(LINES_LUCA).flatMap(v => Array.isArray(v) ? v : 'lines' in v ? [v] : Object.values(v)).flatMap(d => d.lines.map(l => l.text));
  for (const text of all) assert.ok(!/\bclase\b|dinero|deuda|pulsa|botón/i.test(text), text);
});

test('the picker can start the mission at every part, and knows where the story is', () => {
  const parts = missionParts('luca');
  assert.deepEqual(parts.map(p => p.id), ['start', 'luca', 'door', 'recepcion', 'sillones', 'espejos', 'carta', 'abside', 'crucero', 'fran', 'won', 'done']);
  for (const part of parts) if (part.spot?.environment === INTERIOR && part.luca) {
    const story = new Story(missionJump('luca', part.id).flags); story.startLuca(part.luca);
    assert.ok(!story.blocked(INTERIOR).some(c => c.x === part.spot.cell.x && c.z === part.spot.cell.z), `${part.id} stands clear of the queues`);
  }
  for (const part of parts) {
    const jump = missionJump('luca', part.id);
    assert.ok(jump.flags.includes('metro'), part.id);
    if (jump.spot?.cell) assert.ok(canWalk(jump.spot.cell, ENVIRONMENTS[jump.spot.environment].grid), `${part.id} ${JSON.stringify(jump.spot.cell)}`);
  }
  const story = inSalon(['recepcion', 'sillones']);
  assert.equal(missionNow('luca', story.saved, undefined, undefined, story.luca), 'carta');
});
