import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from server import app


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
        self.assertEqual(self.client.put('/api/state', json={'score': 35}).json(), {'score': 35})
        with TestClient(app, cookies=self.client.cookies) as reopened:
            self.assertEqual(reopened.get('/api/state').json(), {'score': 35})
        with TestClient(app) as visitor:
            self.assertEqual(visitor.get('/api/state').json(), {'score': 0})

    def test_concurrent_and_out_of_order_saves(self):
        cookie = self.client.cookies.get('gerard_player')
        def save(score):
            with TestClient(app, cookies={'gerard_player': cookie}) as client:
                self.assertEqual(client.put('/api/state', json={'score': score}).status_code, 200)
        with ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(save, [10, 35, 5, 20]))
        self.assertEqual(self.client.get('/api/state').json(), {'score': 35})

    def test_validation_and_health(self):
        for score in [-1, 2.5, True, '3', 2147483648]:
            self.assertEqual(self.client.put('/api/state', json={'score': score}).status_code, 422)
        self.assertEqual(self.client.get('/healthz').status_code, 200)
        self.assertEqual(self.client.get('/api/state').headers['cache-control'], 'no-store')
        self.assertEqual(self.client.put('/api/state', json={'score': 1}, headers={'sec-fetch-site': 'cross-site'}).status_code, 403)
