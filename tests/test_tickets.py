import os
import unittest
from types import SimpleNamespace
from unittest import mock

from fastapi.testclient import TestClient

import tickets
from server import STORY_FLAGS, app


def reply(text, stop='end_turn'):
    return SimpleNamespace(stop_reason=stop, content=[SimpleNamespace(type='text', text=text)], _request_id='req_test')


class RuleTests(unittest.TestCase):
    def test_a_person_in_their_place_opens_the_station(self):
        verdict = tickets.by_rules('Luca abrazándome a la salida de la Sagrada Família')
        self.assertEqual((verdict.station, verdict.person, verdict.place), ('sagrada-familia', True, True))
        self.assertEqual(tickets.by_rules('nuria y uri en CARDEDEU').station, 'cardedeu')
        self.assertEqual(tickets.by_rules("Aitor y yo en la Plaça d'Espanya").station, 'espanya')

    def test_halves_and_nothing(self):
        self.assertEqual(tickets.by_rules('Luca en Cardedeu').model_dump(), {'station': 'sagrada-familia', 'person': True, 'place': False, 'moment': True})
        self.assertEqual(tickets.by_rules('un día en la Barceloneta').model_dump(), {'station': 'barceloneta', 'person': False, 'place': True, 'moment': True})
        self.assertEqual(tickets.by_rules('ábrelo todo').station, None)
        # Whole words only: "Lucas" is not Luca.
        self.assertEqual(tickets.by_rules('Lucas en la Sagrada Familia').person, False)

    def test_far_away_asks_for_a_moment_with_them(self):
        """Alegia (decided 2026-11-19): Marta and her town are not enough, the memory must be of her singing."""
        half = tickets.by_rules('Marta en Alegia')
        self.assertEqual((half.station, half.person, half.place, half.moment), ('alegia', True, True, False))
        whole = tickets.by_rules('Marta cantando en la plaza de Alegia')
        self.assertEqual((whole.station, whole.person, whole.place, whole.moment), ('alegia', True, True, True))

    def test_every_station_has_its_flag(self):
        for station in tickets.STATIONS:
            self.assertIn(f'ticket-{station}', STORY_FLAGS)


class JudgeTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def ask(self, text):
        return self.client.post('/api/transit/ticket', json={'text': text})

    def test_without_a_key_the_rules_judge(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            body = self.ask('Bernat en El Nucli').json()
        self.assertEqual(body, {'station': 'placa-de-sants', 'person': True, 'place': True, 'moment': True, 'judge': 'rules'})

    def test_the_model_judges_and_only_known_stations_come_back(self):
        fake = mock.Mock()
        fake.messages.create.return_value = reply('{"station": "sagrada-familia", "person": true, "place": true}')
        with mock.patch.object(tickets, 'client', return_value=fake):
            body = self.ask('el profe de mates que viste de colores, bajo las torres de Gaudí').json()
        self.assertEqual(body, {'station': 'sagrada-familia', 'person': True, 'place': True, 'moment': True, 'judge': 'model'})
        request = fake.messages.create.call_args.kwargs
        self.assertIn('<memory>el profe de mates', request['messages'][0]['content'])
        self.assertEqual(request['output_config']['format']['schema']['properties']['station']['enum'][-1], 'none')

    def test_the_model_cannot_skip_the_moment(self):
        fake = mock.Mock()
        fake.messages.create.return_value = reply('{"station": "alegia", "person": true, "place": true, "moment": false}')
        with mock.patch.object(tickets, 'client', return_value=fake):
            body = self.ask('Marta en Alegia').json()
        self.assertEqual(body['moment'], False)
        self.assertIn('Moment: her singing', fake.messages.create.call_args.kwargs['system'])

    def test_bad_answers_and_refusals_fall_back_to_the_rules(self):
        fake = mock.Mock()
        for answer in [reply('{"station": "luna", "person": true, "place": true}'), reply('', stop='refusal')]:
            fake.messages.create.return_value = answer
            with mock.patch.object(tickets, 'client', return_value=fake):
                self.assertEqual(self.ask('Emilie en Poble Sec').json()['judge'], 'rules')

    def test_memories_are_short_text(self):
        self.assertEqual(self.ask('').status_code, 422)
        self.assertEqual(self.ask('x' * 281).status_code, 422)


if __name__ == '__main__':
    unittest.main()
