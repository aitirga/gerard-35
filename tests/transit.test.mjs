import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_MAP, LINES, STATIONS, STATION_PLACES, destinations, entranceId, linesAt, route, stationOf } from '../src/transit.ts';
import { ICONS, cityMarkers } from '../src/map-markers.ts';
import { renderCityMap } from '../src/city-map.ts';
import { castleThreat } from '../src/animas.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

test('the cartoon map has its hand-drawn layers, the metro lines in their colours and the R4 to Cardedeu', () => {
  assert.deepEqual(LINES.map(l => [l.id, l.colour, l.kind]), [
    ['l1', '#e1393e', 'metro'], ['l3', '#3aa83e', 'metro'], ['l4', '#fcbe00', 'metro'], ['l5', '#1f78c0', 'metro'], ['r4', '#f2a900', 'rodalies'],
  ]);
  for (const line of LINES) {
    assert.ok(line.stations.length > 1, line.id);
    assert.equal(new Set(line.stations).size, line.stations.length, `${line.id} stops once at each station`);
    for (const id of line.stations) assert.ok(STATIONS[id], `${line.id}: ${id}`);
  }
  for (const id of Object.keys(STATIONS)) assert.ok(linesAt(id).length, `${id} is on a line`);
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

test('the new places\' stations are on the network, in the real order, and meet where the real lines do', () => {
  const l1 = LINES.find(l => l.id === 'l1').stations;
  assert.deepEqual(l1.slice(0, 6), ['santa-eulalia', 'mercat-nou', 'placa-de-sants', 'hostafrancs', 'espanya', 'rocafort'], 'the L1 west from Espanya to Sants');
  assert.deepEqual(LINES.find(l => l.id === 'l3').stations.slice(0, 8), ['sants-estacio', 'tarragona', 'espanya', 'poble-sec', 'paral-lel', 'drassanes', 'liceu', 'catalunya']);
  assert.deepEqual(LINES.find(l => l.id === 'l4').stations.slice(3), ['urquinaona', 'jaume-i', 'barceloneta', 'ciutadella-vila-olimpica', 'bogatell', 'llacuna']);
  const meets = { espanya: ['l1', 'l3'], catalunya: ['l1', 'l3'], 'placa-de-sants': ['l1', 'l5'], urquinaona: ['l1', 'l4'], 'passeig-de-gracia': ['l3', 'l4'], diagonal: ['l3', 'l5'], verdaguer: ['l4', 'l5'] };
  for (const [station, lines] of Object.entries(meets)) assert.deepEqual(linesAt(station).map(l => l.id), lines, station);
  for (const id of ['placa-de-sants', 'espanya', 'poble-sec', 'barceloneta', 'sagrada-familia', 'el-carmel']) assert.ok(route('fabra-i-puig', id)?.length, `home reaches ${id}`);
});

test('trips to the new places change where a traveller would', () => {
  const change = (from, to) => route(from, to).map(l => [l.line, l.stations.at(-1)]);
  assert.deepEqual(change('fabra-i-puig', 'barceloneta'), [['l1', 'urquinaona'], ['l4', 'barceloneta']], 'to the beach, at Urquinaona');
  assert.deepEqual(change('fabra-i-puig', 'poble-sec'), [['l1', 'catalunya'], ['l3', 'poble-sec']], 'to Poble Sec, at Catalunya');
  assert.deepEqual(change('fabra-i-puig', 'espanya'), [['l1', 'espanya']], 'Plaça d\'Espanya without changing');
  assert.deepEqual(change('poble-sec', 'sagrada-familia'), [['l3', 'diagonal'], ['l5', 'sagrada-familia']], 'the green line to the blue at Diagonal');
  assert.deepEqual(change('sagrada-familia', 'barceloneta'), [['l5', 'verdaguer'], ['l4', 'barceloneta']]);
  assert.equal(route('fabra-i-puig', 'placa-de-sants').at(-1).stations.at(-1), 'placa-de-sants');
  assert.ok(route('fabra-i-puig', 'placa-de-sants').length <= 2, 'Sants on the L1 or by the L5, never more');
  assert.equal(route('el-carmel', 'barceloneta', { lines: ['l4'] }), undefined, 'only the yellow line goes down to the beach');
});

test('only stations with a place are destinations, every place is reachable from home, and each has its entrance', () => {
  const places = Object.keys(STATION_PLACES);
  assert.ok(places.includes('trinitat-vella') && places.includes('cardedeu'));
  assert.deepEqual(destinations('fabra-i-puig'), places.filter(id => id !== 'fabra-i-puig'));
  assert.deepEqual(destinations('fabra-i-puig', { stations: places }), []);
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
