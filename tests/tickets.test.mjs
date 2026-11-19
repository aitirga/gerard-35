import test from 'node:test';
import assert from 'node:assert/strict';
import { Story } from '../src/story.ts';
import { OPEN_STATIONS, TICKET_STATIONS, answer, opens } from '../src/tickets.ts';
import { STATION_PLACES, destinations } from '../src/transit.ts';
import { flagsAt } from '../src/story-points.ts';

test('every station with a place opens from the start or with a memory', () => {
  for (const station of Object.keys(STATION_PLACES)) assert.ok(OPEN_STATIONS.includes(station) !== TICKET_STATIONS.includes(station), station);
});

test('a new city has only home and the school; a ticket opens its station for good', () => {
  const story = new Story(flagsAt('metro'));
  assert.deepEqual(story.lockedStations, TICKET_STATIONS);
  const open = destinations('fabra-i-puig').filter(id => !story.lockedStations.includes(id));
  assert.deepEqual(open, ['trinitat-vella']);
  story.handle({ type: 'ticket', station: 'sagrada-familia' });
  assert.ok(story.has('ticket-sagrada-familia'));
  assert.ok(!story.lockedStations.includes('sagrada-familia'));
  assert.deepEqual(new Story(flagsAt('ticket-espanya')).lockedStations, []);
});

test('the machine prints a ticket only for someone somewhere, and never says more', () => {
  assert.equal(opens({ station: 'cardedeu', person: true, place: true }), 'cardedeu');
  assert.equal(opens({ station: 'cardedeu', person: true, place: false }), undefined);
  assert.equal(opens({ station: 'luna', person: true, place: true }), undefined);
  assert.equal(answer({ station: 'cardedeu', person: true, place: true }), 'Billete impreso: Cardedeu.');
  assert.equal(answer({ station: 'cardedeu', person: true, place: false }), 'Te acuerdas de quién. No de dónde.');
  assert.equal(answer({ station: 'cardedeu', person: false, place: true }), 'Un sitio sin nadie no lleva a ningún sitio.');
  assert.equal(answer({ station: null, person: false, place: false }), 'El billete sale en blanco.');
  for (const verdict of [{ station: 'barceloneta', person: true, place: false }, { station: null, person: false, place: false }]) {
    assert.doesNotMatch(answer(verdict), /Barceloneta|Anna|playa/);
  }
});
