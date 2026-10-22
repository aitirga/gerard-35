import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import lights
from lights import Budget, HomeLights
from server import app

BULBS = [
    {"id": "d073d5000001", "label": "Sofá", "connected": True, "power": "on", "brightness": 0.5,
     "color": {"hue": 0, "saturation": 0, "kelvin": 2700}, "group": {"name": "Salón"}},
    {"id": "d073d5000002", "label": "Luna", "connected": True, "power": "off", "brightness": 1,
     "color": {"hue": 300, "saturation": 0.6, "kelvin": 3500}, "group": {"name": "Salón"}},
]


class FakeApi:
    """Records what would go to LIFX; reading every bulb answers with BULBS."""

    def __init__(self):
        self.calls = []

    def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs.get("json")))
        return BULBS if path == "lights/all" else {"results": []}


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def bridge():
    api, clock = FakeApi(), Clock()
    return HomeLights(api, clock=clock, worker=False), api, clock


SHADE = {"hue": 330, "saturation": 0.6, "kelvin": 3500}


@unittest.skipIf(lights.Color is None, "vendor/geraitor_domotic_house is not checked out")
class HomeLightsTests(unittest.TestCase):
    def test_budget_stays_under_the_lifx_limit(self):
        clock = Clock()
        budget = Budget(per_minute=60, burst=3, clock=clock)
        self.assertEqual([budget.take() for _ in range(4)], [True, True, True, False])
        self.assertAlmostEqual(budget.wait(), 1.0)
        clock.now = 1.0
        self.assertTrue(budget.take())

    def test_a_bulb_waiting_keeps_only_its_newest_state(self):
        house, api, _ = bridge()
        house.set([{"light": "Sofá", "power": True, "color": SHADE, "brightness": 0.2}], 0.5)
        house.set([{"light": "Sofá", "power": False, "color": None, "brightness": None},
                   {"light": "Luna", "power": True, "color": SHADE, "brightness": 0.8}], 1.0)
        kind, pending = house.next_request()
        self.assertEqual(kind, "states")
        self.assertFalse(pending["Sofá"]["power"])
        house._send(kind, pending)
        method, path, body = api.calls[-1]
        self.assertEqual((method, path), ("PUT", "lights/states"))
        self.assertEqual({s["selector"]: s["power"] for s in body["states"]}, {"id:d073d5000001": "off", "id:d073d5000002": "on"})
        self.assertIsNone(house.next_request())

    def test_one_look_for_every_bulb_goes_as_one_fast_state(self):
        house, api, _ = bridge()
        house.set([{"light": label, "power": True, "color": SHADE, "brightness": 0.7} for label in ("Sofá", "Luna")], 0.3)
        house._send(*house.next_request())
        method, path, body = api.calls[-1]
        self.assertEqual((method, path), ("PUT", "lights/id:d073d5000001,id:d073d5000002/state"))
        self.assertTrue(body["fast"])
        self.assertIn("hue:330", body["color"])
        self.assertIn("brightness:0.7", body["color"])

    def test_flashes_go_before_states_and_only_the_latest_few_wait(self):
        house, api, _ = bridge()
        house.set([{"light": "Sofá", "power": True, "color": SHADE, "brightness": 0.2}], 0.5)
        for period in (0.1, 0.2, 0.3, 0.4):
            house.flash({"lights": ["Sofá"], "kind": "breathe", "color": SHADE, "brightness": 1, "period": period, "cycles": 1, "peak": 0.1})
        kinds = [house.next_request() for _ in range(4)]
        self.assertEqual([k[0] for k in kinds], ["effect", "effect", "effect", "states"])
        self.assertEqual([k[1]["period"] for k in kinds[:3]], [0.2, 0.3, 0.4])
        house._send(*kinds[0])
        method, path, body = api.calls[-1]
        self.assertEqual((method, path), ("POST", "lights/id:d073d5000001/effects/breathe"))
        self.assertTrue(body["power_on"])

    def test_a_bulb_lifx_did_not_confirm_goes_again_once(self):
        house, api, _ = bridge()
        api.request = lambda method, path, **kwargs: BULBS if path == "lights/all" else {"results": [
            {"operation": {}, "results": [{"label": "Sofá", "status": "ok"}]},
            {"operation": {}, "results": [{"label": "Luna", "status": "timed_out"}]}]}
        house.set([{"light": "Sofá", "power": True, "color": SHADE, "brightness": 0.2},
                   {"light": "Luna", "power": True, "color": SHADE, "brightness": 0.9}], 0.5)
        house._send(*house.next_request())
        kind, again = house.next_request()
        self.assertEqual(list(again), ["Luna"])
        house._send(kind, again)
        self.assertIsNone(house.next_request(), "only once")

    def test_unknown_bulbs_are_addressed_by_label(self):
        house, _, _ = bridge()
        self.assertEqual(house.selector(["Luna", "Estudio"]), "id:d073d5000002,label:Estudio")

    def test_reading_reuses_a_recent_answer(self):
        house, api, clock = bridge()
        house.lights()
        house.lights()
        clock.now = 2.0
        self.assertEqual(house.lights()[1], {"label": "Luna", "group": "Salón", "connected": True, "power": False,
                                             "hue": 300, "saturation": 0.6, "kelvin": 3500, "brightness": 1})
        self.assertEqual(sum(1 for call in api.calls if call[1] == "lights/all"), 2)


class LightsApiTests(unittest.TestCase):
    def setUp(self):
        self.house, self.api, _ = bridge()
        patches = [mock.patch.object(lights, "_house", self.house), mock.patch.dict(os.environ, {"LIFX_TOKEN": "test"})]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)
        os.environ.pop("FLY_APP_NAME", None)
        os.environ.pop("HOME_LIGHTS_KEY", None)
        self.client = TestClient(app)

    @unittest.skipIf(lights.Color is None, "vendor/geraitor_domotic_house is not checked out")
    def test_reads_and_queues_states(self):
        reply = self.client.get("/api/lights").json()
        self.assertTrue(reply["available"])
        self.assertEqual([b["label"] for b in reply["lights"]], ["Sofá", "Luna"])
        response = self.client.put("/api/lights", json={"states": [{"light": "Luna", "power": True, "color": SHADE, "brightness": 0.4}], "duration": 0.6})
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.house.pending["Luna"]["duration"], 0.6)

    def test_rejects_out_of_range_looks(self):
        response = self.client.put("/api/lights", json={"states": [{"light": "Luna", "power": True, "brightness": 2}]})
        self.assertEqual(response.status_code, 422)

    def test_a_server_on_the_internet_needs_the_house_key(self):
        with mock.patch.dict(os.environ, {"FLY_APP_NAME": "gerard-35"}):
            self.assertEqual(self.client.get("/api/lights").json(), {"available": False, "reason": "key", "lights": []})
            self.assertEqual(self.client.put("/api/lights", json={"states": [{"light": "Luna", "power": False}]}).status_code, 403)
        with mock.patch.dict(os.environ, {"FLY_APP_NAME": "gerard-35", "HOME_LIGHTS_KEY": "llave"}):
            self.assertEqual(self.client.get("/api/lights", headers={"X-Lights-Key": "otra"}).json()["reason"], "key")
            if lights.Color is not None:
                self.assertTrue(self.client.get("/api/lights", headers={"X-Lights-Key": "llave"}).json()["available"])

    def test_without_a_token_there_are_no_lights(self):
        with mock.patch.dict(os.environ, {"LIFX_TOKEN": "", "lifx_token": ""}):
            reply = self.client.get("/api/lights").json()
        self.assertFalse(reply["available"])
        self.assertIn(reply["reason"], ("token", "library"))

    def test_cross_site_writes_are_refused(self):
        response = self.client.put("/api/lights", headers={"Sec-Fetch-Site": "cross-site"}, json={"states": [{"light": "Luna", "power": False}]})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
