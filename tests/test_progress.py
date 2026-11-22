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

    def test_every_check_of_the_real_list_can_tick_and_none_contradicts_a_hand_tick(self):
        data = progress.measure(progress.load(ROOT / "docs" / "progress.toml"), str(ROOT))
        self.assertEqual(progress.audit(data)["broken"], [])

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

    def test_a_module_counts_once_something_imports_it(self):
        Path(self.root, "src").mkdir()
        Path(self.root, "src/suelto.ts").write_text("export const SUELTO = 1;")
        self.assertFalse(self.done(file="src/suelto.ts"))
        Path(self.root, "src/main.ts").write_text("import { SUELTO } from './suelto';")
        self.assertTrue(self.done(file="src/suelto.ts"))

    def test_a_folder_loaded_whole_and_a_page_of_its_own_count_as_imports(self):
        Path(self.root, "src/landmarks").mkdir(parents=True)
        Path(self.root, "src/landmarks/font.ts").write_text("export default 1;")
        Path(self.root, "src/lab.ts").write_text("")
        self.assertFalse(self.done(file="src/landmarks/font.ts"))
        Path(self.root, "src/landmarks.ts").write_text("const all = import.meta.glob('./landmarks/*.ts');")
        self.assertTrue(self.done(file="src/landmarks/font.ts"))
        self.assertFalse(self.done(file="src/lab.ts"))
        Path(self.root, "lab.html").write_text('<script type="module" src="/src/lab.ts"></script>')
        self.assertTrue(self.done(file="src/lab.ts"))

    def test_used_wants_the_name_in_another_module_than_the_one_that_defines_it(self):
        Path(self.root, "src").mkdir()
        Path(self.root, "src/castle.ts").write_text("export const levelCap = () => 3; // levelCaps is another word")
        self.assertFalse(self.done(used="levelCap"))
        Path(self.root, "src/levels.ts").write_text("import { levelCaps } from './castle';")
        self.assertFalse(self.done(used="levelCap"))
        Path(self.root, "src/levels.ts").write_text("import { levelCap } from './castle';")
        self.assertTrue(self.done(used="levelCap"))
        self.assertFalse(self.done(used=["levelCap", "definitivasOpen"]))

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


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = self.folder.name
        Path(self.root, "a.txt").write_text("hola mundo")

    def audit(self, *items):
        return progress.audit(progress.measure(manifest(*items), self.root))

    def test_what_can_never_tick_as_written_is_broken(self):
        broken = self.audit({"title": "Lejos", "grep": "hola", "in": "no-existe.txt"},
                            {"title": "Sin nombre", "used": "nadieLoDefine"},
                            {"title": "A mano", "done": True, "file": "b.txt"},
                            {"title": "Dos", "file": "a.txt"}, {"title": "Dos", "file": "a.txt"})["broken"]
        self.assertEqual(len(broken), 4, broken)
        for title in ("Lejos", "Sin nombre", "A mano", "Dos"):
            self.assertTrue(any(title in line for line in broken), title)

    def test_pending_work_is_not_broken_and_the_bar_is_split_by_what_it_rests_on(self):
        report = self.audit({"title": "Texto", "grep": "hola", "in": "a.txt"}, {"title": "Archivo", "file": "a.txt"},
                            {"title": "Mano", "done": True}, {"title": "Falta", "file": "b.txt"}, {"title": "Espera"})
        self.assertEqual(report["broken"], [])
        self.assertEqual(report["waiting"], ["Espera"])
        self.assertEqual({kind: count for kind, (_, count) in report["rests"].items()}, {"used": 0, "text": 1, "file": 1, "hand": 1})
        self.assertAlmostEqual(sum(points for points, _ in report["rests"].values()), .6)


class DrawingTests(unittest.TestCase):
    data = {"total": .5, "story": .25, "blocks": [{"title": "Bloque", "share": .5}],
            "priorities": [{"title": "Lo primero", "items": [{"ok": False, "title": "Paso"}],
                            "pending": [{"ok": False, "title": "Paso"}], "share": 0, "id": "p1"}],
            "tasks": [{"ok": False, "title": f"Paso {n}", "priority": "p1"} for n in range(12)]}

    def test_nothing_says_100_before_it_is_done(self):
        self.assertEqual(progress.percent(.999), 99)
        self.assertEqual(progress.percent(1), 100)

    def test_a_plain_bar_has_no_escapes_and_keeps_its_width(self):
        self.assertEqual(progress.bar(.5, 10, False), "█████░░░░░")
        self.assertNotIn("\033", "".join(progress.render(self.data, "t", 40, 60, False)[0]))

    def test_it_never_draws_more_than_the_pane_holds(self):
        for rows in (1, 3, 6, 9, 13, 40):
            self.assertLessEqual(len(progress.render(self.data, "t", rows, 60, False)[0]), rows)

    def test_a_short_pane_keeps_the_bar(self):
        self.assertIn("█", "".join(progress.render(self.data, "t", 3, 60, False)[0]))


if __name__ == "__main__":
    unittest.main()
