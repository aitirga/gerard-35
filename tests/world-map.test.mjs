import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWorldMap } from '../src/world-map.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

for (const environment of Object.values(ENVIRONMENTS)) {
  test(`${environment.id}: local map uses the environment dimensions and landmarks`, () => {
    const svg = renderWorldMap(environment, environment.spawn);
    assert.ok(svg.includes(`viewBox="-1 -1 ${environment.grid[0].length + 2} ${environment.grid.length + 2}"`));
    assert.equal((svg.match(/class="map-point"/g) ?? []).length, environment.interactions.length);
    assert.ok(svg.includes(`cx="${environment.spawn.x + .5}" cy="${environment.spawn.z + .5}" r=".7" class="map-player"`));
  });
}
test('a new environment needs no renderer changes and labels remain text', () => {
  const custom = { id: 'new', name: '<New & place>', grid: ['###', '#.#'], houses: [], interactions: [{ cell: { x: 1, z: 1 }, label: '<Door>' }] };
  const svg = renderWorldMap(custom, { x: 1, z: 1 });
  assert.ok(svg.includes('viewBox="-1 -1 5 4"'));
  assert.ok(svg.includes('M1,1h1v1h-1Z'));
  assert.ok(svg.includes('&lt;New &amp; place&gt;'));
  assert.ok(svg.includes('&lt;Door&gt;'));
});
test('the partner gets a marker of their own', () => {
  const environment = ENVIRONMENTS.meridiana;
  assert.ok(!renderWorldMap(environment, environment.spawn).includes('map-partner'));
  const svg = renderWorldMap(environment, environment.spawn, { cell: { x: 3, z: 4 }, name: 'Aitor' });
  assert.ok(svg.includes('cx="3.5" cy="4.5" r=".7" class="map-partner"><title>Aitor</title>'));
});
