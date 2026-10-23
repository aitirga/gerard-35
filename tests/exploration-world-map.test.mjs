import test from 'node:test';
import assert from 'node:assert/strict';
import { explorationWorldPosition, renderExplorationWorldMap } from '../src/exploration-world-map.ts';
import { CITY_VIEW } from '../src/city-map.ts';
import { CITY_MAP, STATIONS } from '../src/transit.ts';

const beforeCastle = { castle: false, threat: 1, spread: 0 };
const castle = { castle: true, threat: .5, spread: .4 };

test('Barcelona pin follows the current place instead of its nearest metro station', () => {
  for (const [environment, placeId, context] of [
    ['meridiana', 'home', beforeCastle],
    ['meridiana-calle', 'home', beforeCastle],
    ['rec-comtal', 'rec-comtal', beforeCastle],
    ['palacio', 'rec-comtal', castle],
  ]) {
    const place = CITY_MAP.places.find(p => p.id === placeId);
    const position = explorationWorldPosition(environment, context);
    assert.equal(position.id, placeId);
    assert.deepEqual([position.x, position.y], [place.x, place.y]);
    const svg = renderExplorationWorldMap(environment, context);
    assert.ok(svg.includes(`data-world-location="${environment}" transform="translate(${place.x} ${place.y})"`));
    assert.equal((svg.match(/class="city-pin world-map-location-pin"/g) ?? []).length, 1);
    assert.match(svg, /Estás aquí/);
  }
  const home = explorationWorldPosition('meridiana', beforeCastle);
  const station = STATIONS['fabra-i-puig'];
  assert.notDeepEqual([home.x, home.y], [station.x, station.y]);
});

test('places outside Barcelona and the childhood palace never receive a false city pin', () => {
  for (const environment of ['patio', 'maresme', 'home-entrance', 'home-floor-1', 'home-floor-2', 'alegia']) {
    for (const context of [beforeCastle, castle]) {
      assert.equal(explorationWorldPosition(environment, context), undefined);
      const svg = renderExplorationWorldMap(environment, context);
      assert.doesNotMatch(svg, /world-map-location-pin|Estás aquí/);
      assert.match(svg, /Tu ubicación actual queda fuera de este mapa/);
    }
  }
  assert.equal(explorationWorldPosition('palacio'), undefined);
  assert.equal(explorationWorldPosition('palacio', beforeCastle), undefined);
  assert.doesNotMatch(renderExplorationWorldMap('palacio', beforeCastle), /world-map-location-pin/);
});

test('world map keeps the city extent, city art and story landmarks without travel actions or routes', () => {
  for (const context of [beforeCastle, castle]) {
    const svg = renderExplorationWorldMap('meridiana', context);
    assert.ok(svg.includes(`viewBox="${CITY_VIEW.x0} ${CITY_VIEW.y0} ${CITY_VIEW.x1 - CITY_VIEW.x0} ${CITY_VIEW.y1 - CITY_VIEW.y0}"`));
    assert.match(svg, /class="city-map exploration-world-map"/);
    assert.match(svg, /Mapa del mundo: Barcelona/);
    assert.match(svg, /class="city-background"/);
    for (const landmark of CITY_MAP.landmarks) assert.ok(svg.includes(`data-marker="${landmark.id}"`));
    assert.ok(svg.includes(`data-marker="${context.castle ? 'castle' : 'rec-comtal'}"`));
    assert.doesNotMatch(svg, /is-pickable|is-selected|city-route|city-preview|<button|tabindex|role="button"|map-point|map-number/);
  }
});
