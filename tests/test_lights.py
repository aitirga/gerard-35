import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

import lights
import lifx_lan
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
        self.assertEqual(house.lights()[1], {"latency": 500, "label": "Luna", "group": "Salón", "connected": True, "power": False,
                                             "hue": 300, "saturation": 0.6, "kelvin": 3500, "brightness": 1})
        self.assertEqual(sum(1 for call in api.calls if call[1] == "lights/all"), 2)


class FakeLan:
    """Bulbs on the LAN: reads answer with BULBS, writes are recorded (and acknowledged unless `deaf`)."""

    def __init__(self, serials=("d073d5000001", "d073d5000002"), latencies=None):
        self.addresses = {serial: "192.168.1.2" for serial in serials}
        self.answered = set(serials)
        self.latencies = latencies or {}
        self.deaf = False
        self.calls = []

    def latency(self, serial):
        return self.latencies.get(serial)

    def acknowledged(self, sent):
        return not self.deaf

    def probe(self, serial):
        self.calls.append(("probe", serial))

    def read(self):
        return [dict(bulb) for bulb in BULBS if bulb["id"] in self.addresses]

    def discover(self):
        return self.addresses

    def set(self, serials, color, power, duration):
        self.calls.append(("set", serials, color, power, duration))
        return [(serial, len(self.calls)) for serial in serials]

    def waveform(self, serials, kind, color, period, cycles, peak):
        self.calls.append(("waveform", serials, kind, color, period, cycles, peak))
        return [(serial, len(self.calls)) for serial in serials]


class LanTests(unittest.TestCase):
    def test_on_the_lan_states_and_flashes_skip_the_cloud(self):
        api, lan = FakeApi(), FakeLan()
        house = HomeLights(api, lan, clock=Clock(), worker=False)
        self.assertEqual(house.transport, "lan")
        self.assertEqual([b["label"] for b in house.lights()], ["Sofá", "Luna"])
        house.set([{"light": "Sofá", "power": True, "color": SHADE, "brightness": 0.4},
                   {"light": "Luna", "power": True, "color": SHADE, "brightness": 0.4}], 0.25)
        house._send(*house.next_request())
        self.assertEqual(lan.calls[-1], ("set", ["d073d5000001", "d073d5000002"], {**SHADE, "brightness": 0.4}, True, 0.25))
        house.flash({"lights": ["Luna"], "kind": "breathe", "color": SHADE, "brightness": 1, "period": 0.5, "cycles": 1, "peak": 0.1})
        house._send(*house.next_request())
        self.assertEqual(lan.calls[-1][:3], ("waveform", ["d073d5000002"], "breathe"))
        self.assertEqual(api.calls, [], "nothing went to the cloud")

    def test_a_bulb_missing_on_the_lan_goes_through_the_cloud(self):
        api, lan = FakeApi(), FakeLan(serials=("d073d5000001",))
        house = HomeLights(api, lan, clock=Clock(), worker=False)
        house.inventory = BULBS
        house.set([{"light": "Luna", "power": False, "color": None, "brightness": None}], 0.5)
        house._send(*house.next_request())
        self.assertEqual(lan.calls, [])
        self.assertEqual(api.calls[-1][:2], ("PUT", "lights/id:d073d5000002/state"))

    def test_a_bulb_found_but_not_answering_goes_through_the_cloud(self):
        api, lan = FakeApi(), FakeLan()
        lan.answered = {"d073d5000001"}
        house = HomeLights(api, lan, clock=Clock(), worker=False)
        house.inventory = BULBS
        house.set([{"light": "Luna", "power": False, "color": None, "brightness": None}], 0.5)
        house._send(*house.next_request())
        self.assertEqual(lan.calls, [])
        self.assertEqual(api.calls[-1][:2], ("PUT", "lights/id:d073d5000002/state"))

    def test_a_timed_flash_reaches_each_bulb_by_its_own_latency(self):
        clock = Clock()
        lan = FakeLan(latencies={"d073d5000001": 0.03, "d073d5000002": 0.15})
        house = HomeLights(FakeApi(), lan, clock=clock, worker=False)
        # Seen at 1 s: a breathe peaking 0.05 s in, so the slow bulb goes 0.2 s early, the quick one 0.08 s.
        house.flash({"lights": ["Sofá", "Luna"], "kind": "breathe", "color": SHADE, "brightness": 1, "period": 0.5, "cycles": 1, "peak": 0.1, "at": 1.0})
        sent = lambda: [call[1] for call in lan.calls if call[0] == "waveform"]
        clock.now = 0.79
        house.due()
        self.assertEqual(sent(), [])
        clock.now = 0.80
        house.due()
        self.assertEqual(sent(), [["d073d5000002"]], "the slow bulb first")
        clock.now = 0.92
        house.due()
        self.assertEqual(sent(), [["d073d5000002"], ["d073d5000001"]])

    def test_a_timed_state_lands_together_and_goes_again_if_nobody_heard_it(self):
        clock = Clock()
        lan = FakeLan(latencies={"d073d5000001": 0.02, "d073d5000002": 0.1})
        house = HomeLights(FakeApi(), lan, clock=clock, worker=False)
        house.set([{"light": "Sofá", "power": True, "color": SHADE, "brightness": 0.1},
                   {"light": "Luna", "power": True, "color": SHADE, "brightness": 0.1}], 0, at=0.5)
        clock.now = 0.5
        lan.deaf = True
        house.due()
        self.assertEqual(sorted(call[1][0] for call in lan.calls if call[0] == "set"), ["d073d5000001", "d073d5000002"])
        clock.now = 1.0
        house.due()
        self.assertEqual(set(house.pending), {"Sofá", "Luna"}, "unheard states go again")
        self.assertTrue(all(state["retried"] for state in house.pending.values()), "but only once")

    def test_latency_is_the_typical_trip_less_the_way_back(self):
        self.assertIsNone(lifx_lan.one_way([0.05, 0.06]))
        # The quickest trip (20 ms) waited for nothing: 10 ms of it is the answer coming back.
        self.assertAlmostEqual(lifx_lan.one_way([0.02, 0.12, 0.08, 0.2, 0.1]), 0.09)
        lan = lifx_lan.LanBulbs(targets=["192.168.1.255"])
        for took in (0.02, 0.1, 0.1):
            lan._trip("d073d5000001", took)
        self.assertAlmostEqual(lan.latency("d073d5000001"), 0.09)

    def test_a_flash_is_seen_at_its_peak_or_soon_after_it_starts(self):
        self.assertEqual(lights.rise({"kind": "pulse", "period": 0.2}), 0)
        self.assertAlmostEqual(lights.rise({"kind": "breathe", "period": 0.5, "peak": 0.1}), 0.05)
        self.assertEqual(lights.rise({"kind": "breathe", "period": 1.3, "peak": 0.4}), lights.SEEN_SECONDS)

    def test_when_a_single_address_is_refused_messages_are_broadcast_to_their_bulb(self):
        class Socket:
            def __init__(self): self.sent = []
            def sendto(self, message, address):
                if address[0] != "192.168.1.255":
                    raise OSError(lifx_lan.errno.EHOSTUNREACH, "No route to host")
                self.sent.append((lifx_lan.parse(message)[1], address))
        lan, sock = lifx_lan.LanBulbs(targets=["192.168.1.255"]), Socket()
        lan.addresses, lan.reach = {"d073d5000001": "192.168.1.2"}, "192.168.1.255"
        lan._deliver(sock, lifx_lan.packet(lifx_lan.GET, target="d073d5000001"), "d073d5000001")
        lan._deliver(sock, lifx_lan.packet(lifx_lan.GET, target="d073d5000001"), "d073d5000001")
        self.assertEqual(sock.sent, [("d073d5000001", ("192.168.1.255", lifx_lan.PORT))] * 2)
        self.assertEqual(lan.broadcast, "192.168.1.255")

    def test_messages_follow_the_lan_protocol(self):
        message = lifx_lan.packet(lifx_lan.SET_COLOR, b"\0" * 13, target="d073d5000001", source=7, sequence=3, ack=True)
        self.assertEqual(len(message), 49)
        self.assertEqual(lifx_lan.parse(message)[:3], (lifx_lan.SET_COLOR, "d073d5000001", 3))
        state = lifx_lan.struct.pack(lifx_lan.LIGHT_STATE_FORMAT, 21845, 65535, 32768, 2700, 0, 65535, "Sofá".encode(), 0)
        bulb = lifx_lan.light_state(state)
        self.assertEqual((bulb["label"], bulb["power"], bulb["color"]["hue"], bulb["color"]["kelvin"]), ("Sofá", "on", 120.0, 2700))
        self.assertAlmostEqual(bulb["brightness"], 0.5, places=3)
        self.assertEqual(lifx_lan.hsbk({"hue": 360, "saturation": 1, "brightness": 0.5, "kelvin": 3500}), (0, 65535, 32768, 3500))


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

    def test_the_clock_answers_without_the_key(self):
        os.environ["HOME_LIGHTS_KEY"] = "secret"
        self.addCleanup(os.environ.pop, "HOME_LIGHTS_KEY", None)
        self.assertGreater(self.client.get("/api/lights/clock").json()["now"], 0)

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

    def test_without_the_lan_or_a_token_there_are_no_lights(self):
        with mock.patch.dict(os.environ, {"LIFX_TOKEN": "", "lifx_token": "", "HOME_LIGHTS_LAN": "0"}), \
                mock.patch.object(lights, "_house", None), mock.patch.object(lights, "_house_tried", -float("inf")):
            reply = self.client.get("/api/lights").json()
        self.assertFalse(reply["available"])
        self.assertIn(reply["reason"], ("token", "library"))

    def test_cross_site_writes_are_refused(self):
        response = self.client.put("/api/lights", headers={"Sec-Fetch-Site": "cross-site"}, json={"states": [{"light": "Luna", "power": False}]})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
