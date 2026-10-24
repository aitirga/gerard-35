import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_MAP, LINES, STATIONS, STATION_PLACES, destinations, entranceId, linesAt, route, stationOf } from '../src/transit.ts';
import { ICONS, cityMarkers } from '../src/map-markers.ts';
import { renderCityMap } from '../src/city-map.ts';
import { castleThreat } from '../src/animas.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

test('the cartoon map has its hand-drawn layers, the red and blue lines and the R4 to Cardedeu', () => {
  assert.deepEqual(LINES.map(l => [l.id, l.colour, l.kind]), [['l1', '#e1393e', 'metro'], ['l5', '#1f78c0', 'metro'], ['r4', '#f2a900', 'rodalies']]);
  for (const line of LINES) {
    assert.ok(line.stations.length > 1, line.id);
    for (const id of line.stations) assert.ok(STATIONS[id], `${line.id}: ${id}`);
  }
  assert.ok(CITY_MAP.districts.length >= 10 && CITY_MAP.districts.every(d => d.poly.length >= 5 && d.colour), 'districts are soft blobs with a colour');
  assert.ok(CITY_MAP.sea.length > 4 && CITY_MAP.places.some(p => p.id === 'rec-comtal') && CITY_MAP.places.some(p => p.id === 'home'));
  for (const l of CITY_MAP.landmarks) assert.ok(ICONS[l.icon], `${l.id} has an icon to draw`);
});

test('markers: landmarks, home, and the school until the castle appears, as threatening as the story says', () => {
  const before = cityMarkers({ castle: false, threat: 1 });
  assert.ok(before.some(m => m.icon === 'school') && !before.some(m => m.icon === 'bubbaloo'));
  const worst = cityMarkers({ castle: true, threat: 1 }).find(m => m.icon === 'bubbaloo');
  const tamed = cityMarkers({ castle: true, threat: .1 }).find(m => m.icon === 'bubbaloo');
  assert.ok(worst.size > tamed.size, 'it shrinks as people are helped');
  const towers = level => (ICONS.bubbaloo(level).match(/<path/g) ?? []).length;
  assert.ok(towers(1) > towers(.1), 'and loses towers');
  assert.match(renderCityMap({ markers: [worst], current: 'fabra-i-puig', selectable: ['trinitat-vella'] }), /data-marker="castle"/);
  assert.equal(castleThreat(0), 1);
  assert.ok(castleThreat(2) < castleThreat(1) && castleThreat(20) >= .1);
});

test('the L1 runs from home to the Rec Comtal without changing', () => {
  assert.deepEqual(route('fabra-i-puig', 'trinitat-vella'), [{ line: 'l1', stations: ['fabra-i-puig', 'sant-andreu', 'torras-i-bages', 'trinitat-vella'] }]);
  assert.deepEqual(route('trinitat-vella', 'fabra-i-puig')[0].stations.at(-1), 'fabra-i-puig');
  assert.deepEqual(route('fabra-i-puig', 'fabra-i-puig'), []);
  assert.equal(route('fabra-i-puig', 'nowhere'), undefined);
});

test('trips change lines at shared stations and prefer staying on', () => {
  const legs = route('fabra-i-puig', 'sagrada-familia');
  assert.deepEqual(legs.map(l => l.line), ['l1', 'l5'], 'La Sagrera: from the red line to the blue');
  assert.equal(legs[0].stations.at(-1), 'la-sagrera');
  assert.equal(legs[1].stations[0], 'la-sagrera');
  assert.deepEqual(linesAt('la-sagrera').map(l => l.id), ['l1', 'l5', 'r4']);
  // A closed line is avoided, or there is no way at all.
  assert.equal(route('fabra-i-puig', 'sagrada-familia', { lines: ['l5'] }), undefined);
  assert.equal(route('fabra-i-puig', 'trinitat-vella', { stations: ['sant-andreu'] }), undefined, 'only the L1 reaches Trinitat Vella');
});

test('only stations with a place are destinations, and each place has its entrance', () => {
  assert.deepEqual(destinations('fabra-i-puig'), ['trinitat-vella']);
  assert.deepEqual(destinations('fabra-i-puig', { stations: ['trinitat-vella'] }), []);
  for (const [station, place] of Object.entries(STATION_PLACES)) {
    const environment = ENVIRONMENTS[place.environment];
    const entrance = environment.interactions.find(i => i.id === entranceId(station));
    assert.ok(entrance, `${place.environment} has ${entranceId(station)}`);
    assert.ok(canWalk(entrance.cell, environment.grid), `${station}'s entrance is walkable`);
    assert.equal(stationOf(entrance.id), station);
  }
  assert.equal(stationOf('meridiana-tv'), undefined);
});

test('the R4 leaves from La Sagrera for Cardedeu, a town waiting at the map\'s edge', () => {
  assert.deepEqual(route('fabra-i-puig', 'cardedeu').map(l => l.line), ['l1', 'r4']);
  assert.ok(STATIONS.cardedeu.edge);
  const { x0, x1, y0, y1 } = CITY_MAP.extent;
  assert.ok(STATIONS.cardedeu.x > x0 && STATIONS.cardedeu.x < x1 && STATIONS.cardedeu.y > y0 && STATIONS.cardedeu.y < y1, 'drawn inside the map');
  assert.match(renderCityMap(), /Cardedeu →/);
});
