"""The progress panel: docs/progress.toml stays readable, its checks tick and the bar moves with them."""
import importlib.machinery
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
loader = importlib.machinery.SourceFileLoader("herdr_progress", str(ROOT / "scripts" / "herdr-progress"))
spec = importlib.util.spec_from_loader("herdr_progress", loader)
progress = importlib.util.module_from_spec(spec)
loader.exec_module(progress)


def manifest(*items, weight=1):
    return {"block": [{"title": "Bloque", "weight": weight, "item": list(items)}]}


class ManifestTests(unittest.TestCase):
    def test_the_real_list_loads_and_every_priority_counts_something(self):
        data = progress.measure(progress.load(ROOT / "docs" / "progress.toml"), str(ROOT))
        self.assertTrue(0 < data["total"] < 1)
        for priority in data["priorities"]:
            self.assertTrue(priority["items"], priority["title"])

    def test_a_mistyped_check_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, "p.toml")
            path.write_text('[[block]]\ntitle = "B"\nweight = 1\n[[block.item]]\ntitle = "I"\ngrepp = "x"\n')
            with self.assertRaisesRegex(ValueError, "grepp"):
                progress.load(path)


class CheckTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = self.folder.name
        Path(self.root, "a.txt").write_text("hola mundo")

    def done(self, **item):
        return progress.measure(manifest({"title": "I", **item}), self.root)["blocks"][0]["item"][0]["ok"]

    def test_each_kind_of_check(self):
        self.assertTrue(self.done(file="*.txt"))
        self.assertFalse(self.done(file="*.md"))
        self.assertTrue(self.done(grep="hola", **{"in": "a.txt"}))
        self.assertFalse(self.done(grep="adios", **{"in": "a.txt"}))
        self.assertTrue(self.done(absent="adios", **{"in": "a.txt"}))
        self.assertFalse(self.done(absent="hola", **{"in": "a.txt"}))

    def test_absent_needs_the_file_to_exist(self):
        self.assertFalse(self.done(absent="hola", **{"in": "no-existe.txt"}))

    def test_an_item_with_no_check_waits_for_its_hand_tick(self):
        self.assertFalse(self.done())
        self.assertTrue(self.done(done=True))

    def test_the_bar_grows_when_work_gets_done_and_shrinks_when_work_is_added(self):
        two = [{"title": "Hecho", "file": "a.txt"}, {"title": "Falta", "file": "b.txt"}]
        self.assertEqual(progress.measure(manifest(*two), self.root)["total"], .5)
        Path(self.root, "b.txt").write_text("")
        self.assertEqual(progress.measure(manifest(*two), self.root)["total"], 1)
        three = [*two, {"title": "Nuevo", "file": "c.txt", "weight": 2}]
        self.assertEqual(progress.measure(manifest(*three), self.root)["total"], .5)


class DrawingTests(unittest.TestCase):
    data = {"total": .5, "story": .25, "blocks": [{"title": "Bloque", "share": .5}],
            "priorities": [{"title": "Lo primero", "items": [{"ok": False, "title": "Paso"}],
                            "pending": [{"ok": False, "title": "Paso"}], "share": 0}]}

    def test_nothing_says_100_before_it_is_done(self):
        self.assertEqual(progress.percent(.999), 99)
        self.assertEqual(progress.percent(1), 100)

    def test_a_plain_bar_has_no_escapes_and_keeps_its_width(self):
        self.assertEqual(progress.bar(.5, 10, False), "█████░░░░░")
        self.assertNotIn("\033", "".join(progress.render(self.data, "t", 40, 60, False)))

    def test_it_never_draws_more_than_the_pane_holds(self):
        for rows in (1, 3, 6, 9, 13, 40):
            self.assertLessEqual(len(progress.render(self.data, "t", rows, 60, False)), rows)

    def test_a_short_pane_keeps_the_bar(self):
        self.assertIn("█", "".join(progress.render(self.data, "t", 3, 60, False)))


if __name__ == "__main__":
    unittest.main()
