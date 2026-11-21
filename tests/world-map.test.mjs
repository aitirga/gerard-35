import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWorldMap, roomAt } from '../src/world-map.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

const marker = (svg, cls) => svg.match(new RegExp(`<g class="map-marker ${cls}" transform="translate\\(([\\d.-]+) ([\\d.-]+)\\)"`));

for (const environment of Object.values(ENVIRONMENTS)) {
  test(`${environment.id}: local map shows the place and Gerard without revealing interactions`, () => {
    const svg = renderWorldMap(environment, environment.spawn);
    assert.match(svg, /^<svg class="world-map" data-map="(plan|geo)"/);
    assert.ok(!svg.includes('class="map-point"'));
    assert.ok(!svg.includes('class="map-number"'));
    for (const interaction of environment.interactions) assert.ok(!svg.includes(`<title>${interaction.label}</title>`));
    const at = marker(svg, 'map-player');
    assert.ok(at, 'Gerard has a marker');
    assert.deepEqual([Number(at[1]), Number(at[2])], [environment.spawn.x + .5, environment.spawn.z + .5]);
    // Gerard is inside what the drawing shows.
    const [x, z, w, d] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    assert.ok(at[1] >= x && at[1] <= x + w && at[2] >= z && at[2] <= z + d, 'Gerard is on the drawing');
  });
}
test('a new environment needs no renderer changes and labels remain text', () => {
  const custom = { id: 'new', name: '<New & place>', grid: ['###', '#.#', '###'], houses: [], interactions: [{ cell: { x: 1, z: 1 }, label: '<Door>' }] };
  const svg = renderWorldMap(custom, { x: 1, z: 1 });
  assert.ok(svg.includes('class="map-floor"'));
  assert.ok(svg.includes('&lt;New &amp; place&gt;'));
  assert.ok(!svg.includes('&lt;Door&gt;'));
});
test('an interior is a plan: floors by room, walls, openings and room names, the room Gerard is in lit', () => {
  const environment = ENVIRONMENTS.meridiana;
  const svg = renderWorldMap(environment, { x: 10, z: 10 });
  assert.ok(svg.includes('class="map-wall"'));
  assert.ok(svg.includes('class="map-window"'));
  assert.ok(svg.includes('data-floor="terracotta"'));
  assert.ok(svg.includes('class="map-room is-here"'));
  assert.equal(roomAt(environment, { x: 10, z: 10 }), 'Dormitorio');
});
test('a real place is a street map with its buildings and street names', () => {
  const svg = renderWorldMap(ENVIRONMENTS.sants, ENVIRONMENTS.sants.spawn);
  assert.ok(svg.includes('data-map="geo"'));
  assert.ok(svg.includes('class="map-building"'));
  assert.ok(svg.includes('class="map-street"'));
});
test('the partner gets a marker of their own, beside Gerard when on top of him', () => {
  const environment = ENVIRONMENTS.meridiana;
  assert.ok(!renderWorldMap(environment, environment.spawn).includes('map-partner'));
  const far = renderWorldMap(environment, environment.spawn, { cell: { x: 15, z: 4 }, name: 'Aitor', face: '/portraits/aitor.png', colour: '#3fd0ff' });
  assert.deepEqual(marker(far, 'map-partner').slice(1).map(Number), [15.5, 4.5]);
  assert.ok(far.includes('<title>Aitor</title>'));
  assert.ok(far.includes('href="/portraits/aitor.png"'));
  const close = marker(renderWorldMap(environment, environment.spawn, { cell: { ...environment.spawn }, name: 'Aitor' }), 'map-partner');
  assert.ok(Math.hypot(close[1] - environment.spawn.x - .5, close[2] - environment.spawn.z - .5) > 1, 'nudged off Gerard');
});
