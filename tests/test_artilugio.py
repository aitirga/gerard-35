import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import artilugio
from server import app

KEY = {"x-artilugio-key": "llave"}


class ArtilugioTest(unittest.TestCase):
    def setUp(self):
        artilugio.board.__init__()
        self.env = mock.patch.dict(os.environ, {"ARTILUGIO_KEY": "llave"})
        self.env.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.env.stop()

    def test_the_board_needs_its_key(self):
        self.assertEqual(self.client.get("/api/artilugio/board").status_code, 403)
        self.assertEqual(self.client.post("/api/artilugio/note?n=1", headers={"x-artilugio-key": "otra"}).status_code, 403)
        self.assertEqual(self.client.get("/api/artilugio/board", headers=KEY).text, "asleep 0\n")

    def test_no_key_on_fly_takes_no_board(self):
        with mock.patch.dict(os.environ, {"FLY_APP_NAME": "gerard-35-aitirga"}):
            del os.environ["ARTILUGIO_KEY"]
            self.assertEqual(self.client.get("/api/artilugio/board").status_code, 403)

    def test_only_eight_notes(self):
        self.assertEqual(self.client.post("/api/artilugio/note?n=8", headers=KEY).status_code, 422)
        self.assertEqual(self.client.post("/api/artilugio/note?n=7", headers=KEY).status_code, 204)

    def test_the_story_sets_the_mode_and_escuchar_waits_for_the_board(self):
        self.client.post("/api/artilugio/listen")
        self.assertEqual(self.client.get("/api/artilugio/board", headers=KEY).text, "asleep 0\n", "asleep, it never sounds")
        self.assertEqual(self.client.put("/api/artilugio", json={"mode": "alive"}).status_code, 204)
        self.client.post("/api/artilugio/listen")
        self.client.post("/api/artilugio/listen")
        self.assertEqual(self.client.get("/api/artilugio/board", headers=KEY).text, "alive 2\n")
        self.assertEqual(self.client.get("/api/artilugio/board", headers=KEY).text, "alive 0\n", "each time is heard once")
        self.assertEqual(self.client.put("/api/artilugio", json={"mode": "dormant"}).status_code, 422)

    def test_the_game_is_told_it_is_there(self):
        self.assertFalse(self.client.get("/api/artilugio").json()["connected"])
        self.client.get("/api/artilugio/board", headers=KEY)
        self.assertEqual(self.client.get("/api/artilugio").json(), {"type": "board", "mode": "asleep", "connected": True})

    def test_cross_site_pages_cannot_drive_it(self):
        self.assertEqual(self.client.put("/api/artilugio", json={"mode": "awake"}, headers={"sec-fetch-site": "cross-site"}).status_code, 403)

    def test_notes_reach_whoever_listens_once_it_is_alive(self):
        board = artilugio.board
        stream = artilugio.asyncio.Queue()
        board.streams.add(stream)
        self.client.post("/api/artilugio/note?n=4", headers=KEY)
        self.assertTrue(stream.empty(), "asleep, nobody hears it")
        self.client.put("/api/artilugio", json={"mode": "alive"})
        self.client.post("/api/artilugio/note?n=4", headers=KEY)
        self.client.post("/api/artilugio/motion", headers=KEY)
        events = [stream.get_nowait() for _ in range(stream.qsize())]
        self.assertEqual([e["type"] for e in events], ["board", "note", "motion"])
        self.assertEqual(events[1]["note"], 4)


if __name__ == "__main__":
    unittest.main()
