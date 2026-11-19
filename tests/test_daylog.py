import json
import os
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

from fastapi.testclient import TestClient

import daylog
import server


def event(kind, day=1, epoch=0, hour=9, at=1_763_400_000_000, **data):
    return {"kind": kind, "epoch": epoch, "day": day, "hour": hour, "at": at, **data}


DAY_ONE = [
    event("place", place="meridiana", seconds=300),
    event("ride", hour=10, start="fabra-i-puig", to="sagrada-familia"),
    event("memory", hour=10, text="Luca bajo las torres de Gaudí", station="sagrada-familia", person=True, place=True),
    event("flag", hour=10, flag="ticket-sagrada-familia"),
    event("fight", hour=12, encounter="luca-chaplains", outcome="won", rounds=4, moves={"attack": 3, "zarpazos": 2}, worn=["papagato"]),
    event("place", hour=12, place="basilica", seconds=900),
]


def reply(text, stop="end_turn"):
    return SimpleNamespace(stop_reason=stop, content=[SimpleNamespace(type="text", text=text)], _request_id="req_test")


READING = {"summary": "Bajé a ver a Luca.", "habits": ["Vuelve a la Sagrada Família."], "quotes": ["Luca bajo las torres de Gaudí"]}


class DayLogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {"DATABASE_PATH": self.temp.name + "/game.sqlite3"})
        self.env.start()
        self.client = TestClient(server.app)

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.temp.cleanup()

    def log(self, events):
        return self.client.post("/api/log", json={"events": events})

    def rows(self, query):
        with server.connect() as db:
            return db.execute(query).fetchall()

    def test_events_are_kept_and_a_day_is_summarized_once_the_next_one_starts(self):
        fake = mock.Mock()
        fake.messages.create.return_value = reply(json.dumps(READING))
        with mock.patch.object(server, "claude", return_value=fake):
            self.assertEqual(self.log(DAY_ONE).json(), {"logged": 6})
            self.assertEqual(self.rows("SELECT COUNT(*) FROM day_summaries"), [(0,)])
            self.log([event("place", day=2, place="meridiana", seconds=60)])
            self.log([event("place", day=2, place="sants", seconds=60)])
        self.assertEqual(fake.messages.create.call_count, 1)
        [(facts, summary, habits, quotes)] = self.rows("SELECT facts, summary, habits, quotes FROM day_summaries WHERE day = 1")
        facts = json.loads(facts)
        self.assertEqual(facts["minutes"], {"basilica": 15.0, "meridiana": 5.0})
        self.assertEqual(facts["rides"], [["fabra-i-puig", "sagrada-familia"]])
        self.assertEqual(facts["flags"], ["ticket-sagrada-familia"])
        self.assertEqual(facts["outcomes"], {"won": 1})
        self.assertEqual((summary, json.loads(quotes)), ("Bajé a ver a Luca.", ["Luca bajo las torres de Gaudí"]))
        prompt = fake.messages.create.call_args.kwargs["messages"][0]["content"]
        self.assertIn("<typed>Luca bajo las torres de Gaudí</typed> (opened sagrada-familia)", prompt)
        self.assertIn("12h · fight luca-chaplains: won in 4 rounds; used attack×3, zarpazos×2", prompt)

    def test_a_day_lived_again_is_another_day(self):
        with mock.patch.object(server, "claude", return_value=None):
            self.log([event("flag", day=3, flag="cardedeu")])
            self.log([event("flag", day=2, epoch=1, flag="metro")])
        self.assertEqual(self.rows("SELECT epoch, day, summary IS NULL FROM day_summaries"), [(0, 3, 1)])

    def test_without_a_model_the_facts_are_kept_and_tried_three_times_at_most(self):
        fake = mock.Mock()
        fake.messages.create.return_value = reply("", stop="refusal")
        with mock.patch.object(server, "claude", return_value=fake):
            self.log(DAY_ONE)
            for _ in range(5):
                self.log([event("place", day=2, place="meridiana", seconds=1)])
        self.assertEqual(fake.messages.create.call_count, 3)
        [(facts, summary, tries)] = self.rows("SELECT facts, summary, tries FROM day_summaries")
        self.assertEqual((summary, tries), (None, 3))
        self.assertEqual(json.loads(facts)["memories"][0]["station"], "sagrada-familia")

    def test_only_known_shapes_get_in(self):
        self.assertEqual(self.log([event("teleport", place="moon")]).status_code, 422)
        self.assertEqual(self.log([event("memory", text="x" * 281, station=None, person=False, place=False)]).status_code, 422)
        self.assertEqual(self.log([event("place", place="../etc", seconds=1)]).status_code, 422)
        self.assertEqual(self.log([]).status_code, 422)
        cross = self.client.post("/api/log", json={"events": DAY_ONE[:1]}, headers={"sec-fetch-site": "cross-site"})
        self.assertEqual(cross.status_code, 403)

    def test_each_player_has_their_own_days(self):
        with mock.patch.object(server, "claude", return_value=None):
            self.log(DAY_ONE)
            with TestClient(server.app) as other:
                other.post("/api/log", json={"events": [event("place", day=5, place="sants", seconds=1)]})
        self.assertEqual(self.rows("SELECT COUNT(*) FROM day_summaries"), [(0,)])

    def test_the_command_writes_what_is_missing(self):
        with mock.patch.object(server, "claude", return_value=None):
            self.log(DAY_ONE)
            self.log([event("place", day=2, place="meridiana", seconds=1)])
        fake = mock.Mock()
        fake.messages.create.return_value = reply(json.dumps(READING))
        with mock.patch("ai.claude", return_value=fake), mock.patch("builtins.print"):
            daylog.main(["summarize"])
        self.assertEqual(self.rows("SELECT day, summary FROM day_summaries"), [(1, "Bajé a ver a Luca.")])


if __name__ == "__main__":
    unittest.main()
