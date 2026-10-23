import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest import mock

import httpx
from fastapi.testclient import TestClient
from ai import JevProvider
from server import STORY_FLAGS, app


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = os.environ.get('DATABASE_PATH')
        os.environ['DATABASE_PATH'] = self.temp.name + '/game.sqlite3'
        self.client = TestClient(app)
        self.client.get('/api/state')

    def tearDown(self):
        self.client.close()
        if self.previous is None:
            os.environ.pop('DATABASE_PATH')
        else:
            os.environ['DATABASE_PATH'] = self.previous
        self.temp.cleanup()

    def test_reload_and_separate_players(self):
        self.assertEqual(self.client.put('/api/state', json={'score': 35}).json(), {'score': 35, 'story': [], 'days': None})
        with TestClient(app, cookies=self.client.cookies) as reopened:
            self.assertEqual(reopened.get('/api/state').json(), {'score': 35, 'story': [], 'days': None})
        with TestClient(app) as visitor:
            self.assertEqual(visitor.get('/api/state').json(), {'score': 0, 'story': [], 'days': None})

    def test_concurrent_and_out_of_order_saves(self):
        cookie = self.client.cookies.get('gerard_player')
        def save(score):
            with TestClient(app, cookies={'gerard_player': cookie}) as client:
                self.assertEqual(client.put('/api/state', json={'score': score}).status_code, 200)
        with ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(save, [10, 35, 5, 20]))
        self.assertEqual(self.client.get('/api/state').json(), {'score': 35, 'story': [], 'days': None})

    def test_story_flags_accumulate_in_story_order(self):
        self.client.put('/api/state', json={'score': 3, 'story': ['got-shoes', 'intro']})
        # An older tab that only knows the intro must not undo the shoes.
        response = self.client.put('/api/state', json={'score': 1, 'story': ['intro', 'met-jan']})
        self.assertEqual(response.json(), {'score': 3, 'story': ['intro', 'met-jan', 'got-shoes'], 'days': None})
        self.assertEqual(self.client.get('/api/state').json()['story'], ['intro', 'met-jan', 'got-shoes'])
        for story in [['flying'], 'intro', ['intro'] * (len(STORY_FLAGS) + 1)]:
            self.assertEqual(self.client.put('/api/state', json={'score': 1, 'story': story}).status_code, 422)

    def test_days_advance_and_going_back_a_day_replaces_the_flags(self):
        day = lambda epoch, d, h, mornings=(): {'epoch': epoch, 'clock': {'day': d, 'hour': h}, 'mornings': list(mornings)}
        self.client.put('/api/state', json={'score': 1, 'story': ['intro', 'caught'], 'days': day(0, 2, 10, [{'day': 1, 'story': ['intro']}])})
        # A late save from earlier in the day keeps the later clock, but its flags still count.
        late = self.client.put('/api/state', json={'score': 1, 'story': ['intro', 'got-shoes'], 'days': day(0, 1, 20)}).json()
        self.assertEqual(late['days']['clock'], {'day': 2, 'hour': 10})
        self.assertEqual(late['story'], ['intro', 'got-shoes', 'caught'])
        # Going back a day (a newer epoch) may take flags away.
        back = self.client.put('/api/state', json={'score': 1, 'story': ['intro'], 'days': day(1, 1, 8)}).json()
        self.assertEqual((back['story'], back['days']['epoch']), (['intro'], 1))
        # A tab still on the old epoch cannot bring them back.
        stale = self.client.put('/api/state', json={'score': 1, 'story': ['intro', 'caught'], 'days': day(0, 3, 9)}).json()
        self.assertEqual((stale['story'], stale['days']['clock']['day']), (['intro'], 1))
        self.assertEqual(self.client.get('/api/state').json()['days']['epoch'], 1)
        for bad in [day(-1, 1, 8), day(0, 0, 8), day(0, 1, 25), {'epoch': 0}]:
            self.assertEqual(self.client.put('/api/state', json={'score': 1, 'days': bad}).status_code, 422)

    def test_databases_from_before_the_story_gain_the_column(self):
        import sqlite3
        path = self.temp.name + '/old.sqlite3'
        with sqlite3.connect(path) as db:
            db.execute('CREATE TABLE players (id TEXT PRIMARY KEY, score INTEGER NOT NULL)')
        with mock.patch.dict(os.environ, {'DATABASE_PATH': path}), TestClient(app) as client:
            self.assertEqual(client.put('/api/state', json={'score': 7, 'story': ['intro']}).json(), {'score': 7, 'story': ['intro'], 'days': None})

    def test_validation_and_health(self):
        for score in [-1, 2.5, True, '3', 2147483648]:
            self.assertEqual(self.client.put('/api/state', json={'score': score}).status_code, 422)
        self.assertEqual(self.client.get('/healthz').status_code, 200)
        self.assertEqual(self.client.get('/api/state').headers['cache-control'], 'no-store')
        self.assertEqual(self.client.put('/api/state', json={'score': 1}, headers={'sec-fetch-site': 'cross-site'}).status_code, 403)


class BattleAITests(unittest.TestCase):
    turn = {'allies': [{'id': 'gerard', 'hp': 20, 'max_hp': 100, 'guarding': False},
                       {'id': 'bernat', 'hp': 85, 'max_hp': 85, 'guarding': True}],
            'foes': [{'id': 'dog-0', 'hp': 54, 'max_hp': 54}, {'id': 'dog-1', 'hp': 0, 'max_hp': 54}]}

    def setUp(self):
        self.client = TestClient(app)
        self.requests = []

    def tearDown(self):
        self.client.close()

    def provider(self, provider):
        return mock.patch.dict('ai.DECISION_PROVIDERS', {'jev': lambda: provider})

    def jev(self, status=200, choice='gerard'):
        def handler(request):
            self.requests.append(request)
            return httpx.Response(status, json={'answers': {'dog-0': {'type': 'choice', 'choice': choice}}})
        return JevProvider('test-key', client=httpx.Client(transport=httpx.MockTransport(handler)))

    def test_jev_picks_targets_from_game_state(self):
        with self.provider(self.jev()):
            response = self.client.post('/api/battle/enemy-turn', json=self.turn)
        self.assertEqual(response.json(), {'provider': 'jev', 'targets': {'dog-0': 'gerard'}})
        sent = json.loads(self.requests[0].content)
        self.assertEqual(self.requests[0].headers['authorization'], 'Bearer test-key')
        self.assertEqual(list(sent['questions']), ['dog-0'])  # Defeated dogs are not asked.
        self.assertEqual(sent['questions']['dog-0']['criteria'].keys(), {'gerard', 'bernat'})
        self.assertIn('Gerard: very tired', sent['state'])
        self.assertIn('Bernat: fresh, guarding', sent['state'])

    def test_unknown_answers_are_dropped_and_failures_fall_back(self):
        with self.provider(self.jev(choice='nobody')):
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=self.turn).json()['targets'], {})
        with self.provider(self.jev(status=529)):
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=self.turn).status_code, 502)
        with self.provider(None):
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=self.turn).status_code, 503)
        with mock.patch.dict(os.environ, {'AI_BATTLE_PROVIDER': 'rules'}):
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=self.turn).status_code, 503)

    def test_without_a_jev_key_the_api_declines_without_calling_out(self):
        env = {k: v for k, v in os.environ.items() if k not in ('TYPESAFE_API_KEY', 'AI_BATTLE_PROVIDER')}
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(JevProvider, 'decide') as decide:
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=self.turn).status_code, 503)
        decide.assert_not_called()

    def test_only_known_fighters_reach_the_model(self):
        for turn in [{'allies': [{'id': 'hacker', 'hp': 1, 'max_hp': 1}], 'foes': self.turn['foes']},
                     {'allies': self.turn['allies'], 'foes': [{'id': 'dog-9', 'hp': 1, 'max_hp': 1}]}]:
            self.assertEqual(self.client.post('/api/battle/enemy-turn', json=turn).status_code, 422)
