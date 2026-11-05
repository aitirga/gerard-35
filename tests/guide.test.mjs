import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE, createGuide, updateGuide } from '../src/guide.ts';
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

const open = ['.........', '.........', '.........'];

test('a guide waits for Gerard, walks ahead while he keeps up, and sits at the end', () => {
  const guide = createGuide(open, { x: 0, z: 1 }, { x: 8, z: 1 });
  assert.equal(guide.path.length, 8);
  // Gerard far off: it does not move, and looks at him.
  updateGuide(guide, .1, { x: 0, z: 1 + GUIDE.wait + 1 });
  assert.deepEqual(guide.position, { x: 0, z: 1 });
  assert.ok(guide.waiting && !guide.walking);
  // He comes close: off it goes, faster with him right behind.
  updateGuide(guide, .1, { x: 0, z: 2 });
  assert.ok(guide.walking && guide.position.x > 0);
  const hurried = guide.position.x;
  updateGuide(guide, .1, { x: hurried - GUIDE.close - .5, z: 1 });
  assert.ok(guide.position.x - hurried < GUIDE.hurry * .1, 'slower once he is not right behind');
  // Left behind: it stops and waits until he is close again (not just back under the limit).
  const left = guide.position.x;
  updateGuide(guide, .1, { x: left - GUIDE.wait - .5, z: 1 });
  updateGuide(guide, .1, { x: left - GUIDE.resume - .5, z: 1 });
  assert.equal(guide.position.x, left);
  // Walked all the way: `arrived` once, then it stays.
  let said = 0;
  for (let i = 0; i < 200; i++) if (updateGuide(guide, .1, { x: guide.position.x - 1, z: 1 }) === 'arrived') said++;
  assert.equal(said, 1);
  assert.deepEqual(guide.position, { x: 8, z: 1 });
});

test('Gerard walking beside or level with the guide presses it on, not only from right behind', () => {
  const pace = leader => {
    const guide = createGuide(open, { x: 0, z: 1 }, { x: 8, z: 1 });
    for (let i = 0; i < 10; i++) updateGuide(guide, .02, leader(guide.position));
    const from = guide.position.x;
    updateGuide(guide, .05, leader(guide.position));
    return (guide.position.x - from) / .05;
  };
  // Three cells to one side, level with it: past the distance that counts as right behind.
  const beside = pace(at => ({ x: at.x, z: at.z + 3 }));
  const ahead = pace(at => ({ x: at.x + 1.5, z: at.z + 3 }));
  const trailing = pace(at => ({ x: at.x - 3, z: at.z + 1 }));
  assert.ok(beside > GUIDE.walk + 1, `beside: ${beside.toFixed(2)}`);
  assert.ok(ahead > GUIDE.walk + 1, `ahead: ${ahead.toFixed(2)}`);
  assert.ok(trailing < GUIDE.walk + .3, `trailing: ${trailing.toFixed(2)}`);
});

test('Haru leads them from the station to Nuria\'s door, and sits there', () => {
  const story = new Story(flagsAt('cardedeu'));
  assert.equal(story.guide('cardedeu'), undefined, 'she waits at the station first');
  assert.ok(story.npcs('cardedeu').some(n => n.id === 'haru'));
  story.handle({ type: 'near', id: 'haru' });
  const way = story.guide('cardedeu');
  assert.ok(way, 'met, she leads the way');
  assert.ok(!story.npcs('cardedeu').some(n => n.id === 'haru'), 'the guide draws her now, not a standing cat');
  assert.ok(createGuide(ENVIRONMENTS.cardedeu.grid, way.from, way.to).path.length > 20, 'there is a way along the street');
  assert.equal(story.guide('cardedeu-laberinto'), undefined);
  story.handle({ type: 'near', id: 'haru-home' });
  assert.equal(story.guide('cardedeu'), undefined);
  const haru = story.npcs('cardedeu').find(n => n.id === 'haru');
  assert.deepEqual(haru.cell, way.to, 'she sits where she led them');
  story.handle({ type: 'interact', id: 'talk-nuria' });
  assert.ok(story.nuria.lent && !story.npcs('cardedeu').some(n => n.id === 'haru'), 'lent, she walks with the party');
});
