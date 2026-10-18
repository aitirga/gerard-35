import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_MAP, LINES, STATIONS, STATION_PLACES, destinations, entranceId, linesAt, route, stationOf } from '../src/transit.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

test('every line names known stations and the map has its layers', () => {
  for (const line of LINES) {
    assert.ok(line.stations.length > 1, line.id);
    for (const id of line.stations) assert.ok(STATIONS[id], `${line.id}: ${id}`);
    for (const id of line.extension ?? []) assert.ok(line.stations.includes(id), `${line.id} extends to a station it has`);
  }
  assert.equal(CITY_MAP.districts.length >= 10, true);
  assert.ok(CITY_MAP.sea.length > 4 && CITY_MAP.landmarks.some(l => l.id === 'rec-comtal'));
  assert.match(CITY_MAP.attribution, /CartoBCN/);
});

test('the L1 runs from home to the Rec Comtal without changing', () => {
  assert.deepEqual(route('fabra-i-puig', 'trinitat-vella'), [{ line: 'l1', stations: ['fabra-i-puig', 'sant-andreu', 'torras-i-bages', 'trinitat-vella'] }]);
  assert.deepEqual(route('trinitat-vella', 'fabra-i-puig')[0].stations.at(-1), 'fabra-i-puig');
  assert.deepEqual(route('fabra-i-puig', 'fabra-i-puig'), []);
  assert.equal(route('fabra-i-puig', 'nowhere'), undefined);
});

test('trips change lines at shared stations and prefer staying on', () => {
  const legs = route('fabra-i-puig', 'cardedeu');
  assert.deepEqual(legs.map(l => l.line), ['l1', 'r4'], 'La Sagrera: L1 to the R4');
  assert.equal(legs[0].stations.at(-1), 'la-sagrera');
  assert.equal(legs[1].stations[0], 'la-sagrera');
  assert.ok(linesAt('la-sagrera').map(l => l.id).includes('r4'));
  // A closed line is avoided, or there is no way at all.
  assert.equal(route('fabra-i-puig', 'cardedeu', { lines: ['r4'] }), undefined);
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
