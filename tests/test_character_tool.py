import base64
import io
import json
import shutil
import sys
import tempfile
import unittest
import unittest.mock
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import character  # noqa: E402
import character_model  # noqa: E402
from providers import Meshy, OpenAIImages  # noqa: E402

PNG = b"\x89PNG fake"


class FakeImages:
    model = "fake-image"

    def __init__(self):
        self.calls = []

    def create(self, prompt, images, size):
        self.calls.append((prompt, images, size))
        return PNG + size.encode()


class FakeMeshy:
    def start(self, image, **options):
        self.image, self.options = image, options
        return "task-1"

    def wait(self, task_id, on_progress):
        return {"model_urls": {"glb": "glb-url"}, "thumbnail_url": "thumb-url", "consumed_credits": 20}

    def download(self, url):
        return url.encode()


def gerard_spec() -> dict:
    return json.loads((ROOT / "src/characters/gerard-child.json").read_text())


class FakeClaude:
    model = "fake-claude"

    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def reply(self, system, messages):
        self.calls.append(list(messages))
        return [SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=self.answers.pop(0))]


class CharacterToolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        photos = self.root / "assets/references/characters/bernat"
        photos.mkdir(parents=True)
        for name in ("front.jpg", "side.png", "phone.heic"):
            (photos / name).write_bytes(b"photo")
        gerard = self.root / "assets/characters/gerard"
        gerard.mkdir(parents=True)
        (gerard / "portrait-transparent.png").write_bytes(PNG)
        example = self.root / "src/characters/gerard-child.json"
        example.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "src/characters/gerard-child.json", example)

    def tearDown(self):
        self.temp.cleanup()

    def run_tool(self, *argv, **providers):
        with redirect_stdout(io.StringIO()) as output:
            out = character.run(list(argv), root=self.root, **providers)
        return out, output.getvalue()

    def test_generates_and_installs_every_step(self):
        images, claude = FakeImages(), FakeClaude("```json\n" + json.dumps(gerard_spec()) + "\n```")
        out, _ = self.run_tool("bernat", "--description", "red hoodie", "--expressions", "sorprendido",
                               images=images, claude=claude)

        portrait_refs = [p.name for p in images.calls[0][1]]
        self.assertEqual(portrait_refs, ["front.jpg", "side.png", "portrait-transparent.png"])
        self.assertIn("Images 1-2 are photos", images.calls[0][0])
        self.assertIn("Character notes: red hoodie", images.calls[0][0])
        # Expressions edit only the new portrait.
        self.assertEqual(images.calls[1][1], [out / "portrait.png"])
        self.assertIn("eyebrows raised high", images.calls[1][0])
        # The full-body pass sees the new portrait first, then the same references.
        self.assertEqual(images.calls[2][1][0], out / "portrait.png")
        self.assertEqual(images.calls[2][2], "1024x1536")
        # Claude sees the full body and the portrait, then Gerard's file as the example.
        content = claude.calls[0][0]["content"]
        self.assertEqual([base64.b64decode(c["source"]["data"]) for c in content if c["type"] == "image"],
                         [PNG + b"1024x1536", PNG + b"1024x1024"])
        self.assertIn('"Gerard de niño"', content[-1]["text"])
        self.assertIn('Use "bernat" as the id', content[-1]["text"])

        self.assertEqual((self.root / "public/portraits/bernat.png").read_bytes(), PNG + b"1024x1024")
        self.assertTrue((self.root / "assets/characters/bernat/portrait-transparent.png").exists())
        self.assertTrue((self.root / "assets/characters/bernat/fullbody.png").exists())
        self.assertTrue((self.root / "public/portraits/bernat-sorprendido.png").exists())
        self.assertTrue((self.root / "assets/characters/bernat/portrait-sorprendido-transparent.png").exists())
        self.assertEqual(json.loads((self.root / "src/portraits.json").read_text()), {"bernat": ["sorprendido"]})
        installed = json.loads((self.root / "src/characters/bernat.json").read_text())
        self.assertEqual(installed["id"], "bernat")
        self.assertEqual(json.loads((out / "meta.json").read_text())["model"]["provider"], "claude")

    def test_expressions_extend_an_installed_portrait(self):
        portrait = self.root / "assets/characters/gerard/portrait-child-transparent.png"
        portrait.write_bytes(b"approved child portrait")
        images = FakeImages()
        self.run_tool("gerard", "--variant", "child", "--only", "expressions", "--expressions", "triste", images=images)
        self.run_tool("gerard", "--variant", "child", "--only", "expressions",
                      "--expressions", "guino=winking one eye with a cheeky grin", images=images)

        self.assertEqual([call[1] for call in images.calls], [[portrait], [portrait]])
        self.assertIn("Expression: winking one eye with a cheeky grin.", images.calls[1][0])
        self.assertTrue((self.root / "public/portraits/gerard-child-guino.png").exists())
        manifest = self.root / "src/portraits.json"
        self.assertEqual(json.loads(manifest.read_text()), {"gerard-child": ["guino", "triste"]})
        self.assertEqual(manifest.read_text(), '{\n  "gerard-child": ["guino", "triste"]\n}\n')
        with self.assertRaisesRegex(SystemExit, "--force"):
            self.run_tool("gerard", "--variant", "child", "--only", "expressions", "--expressions", "triste", images=images)

    def test_unknown_expressions_need_a_description(self):
        with redirect_stdout(io.StringIO()), unittest.mock.patch("sys.stderr", io.StringIO()) as error, \
                self.assertRaises(SystemExit):
            character.parse(["gerard", "--expressions", "bostezo"])
        self.assertIn("bostezo=description", error.getvalue())
        self.assertEqual(character.parse(["gerard", "--expressions", "Bostezo=yawning"]).expressions, [("bostezo", "yawning")])

    def test_meshy_modeler_installs_a_glb(self):
        fullbody = self.root / "assets/characters/bernat/fullbody.png"
        fullbody.parent.mkdir(parents=True)
        fullbody.write_bytes(PNG)
        meshy = FakeMeshy()
        out, _ = self.run_tool("bernat", "--only", "model", "--modeler", "meshy", meshy=meshy)
        self.assertEqual(meshy.image, PNG)
        self.assertEqual(meshy.options["pose_mode"], "a-pose")
        self.assertEqual((self.root / "public/models/characters/bernat.glb").read_bytes(), b"glb-url")
        self.assertEqual(json.loads((out / "meta.json").read_text())["model"]["task"], "task-1")

    def test_claude_fixes_problems_in_an_append_only_conversation(self):
        broken = gerard_spec()
        broken["parts"] = [p for p in broken["parts"] if p["name"] != "Ojo"]
        broken["parts"][0]["material"] = "gold"
        claude = FakeClaude("not json", json.dumps(broken), json.dumps(gerard_spec()))
        fullbody = self.root / "assets/characters/bernat/fullbody.png"
        fullbody.parent.mkdir(parents=True)
        fullbody.write_bytes(PNG)
        self.run_tool("bernat", "--only", "model", claude=claude)
        first, second, third = claude.calls
        self.assertEqual(third[:len(second)], second)  # earlier turns are never edited
        self.assertEqual(second[1]["content"][1].text, "not json")  # thinking + text go back unchanged
        self.assertIn('named "Ojo"', third[-1]["content"])
        self.assertIn("undefined material 'gold'", third[-1]["content"])
        self.assertTrue((self.root / "src/characters/bernat.json").exists())

    def test_claude_gives_up_after_the_repairs(self):
        fullbody = self.root / "assets/characters/bernat/fullbody.png"
        fullbody.parent.mkdir(parents=True)
        fullbody.write_bytes(PNG)
        with self.assertRaisesRegex(SystemExit, "could not produce"):
            self.run_tool("bernat", "--only", "model", claude=FakeClaude(*["{}"] * 3))
        self.assertFalse((self.root / "src/characters/bernat.json").exists())

    def test_refuses_to_overwrite_before_calling_any_api(self):
        target = self.root / "public/portraits/bernat-child.png"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"approved")
        images = FakeImages()
        with self.assertRaisesRegex(SystemExit, "--force"):
            self.run_tool("bernat", "--variant", "child", "--only", "portrait", images=images)
        self.assertEqual(images.calls, [])
        self.run_tool("bernat", "--variant", "child", "--only", "portrait", "--force", images=images)
        self.assertEqual(target.read_bytes(), PNG + b"1024x1024")

    def test_model_step_needs_an_installed_fullbody(self):
        with self.assertRaisesRegex(SystemExit, "fullbody step first"):
            self.run_tool("bernat", "--only", "model", meshy=FakeMeshy())

    def test_dry_run_writes_nothing(self):
        out, log = self.run_tool("bernat", "--dry-run")
        self.assertIsNone(out)
        self.assertIn("src/characters/bernat.json", log)
        self.assertIn("phone.heic: use PNG, JPEG or WebP", log)
        self.assertFalse((self.root / "output").exists())
        self.assertFalse((self.root / "public").exists())

    def test_needs_photos_or_a_description(self):
        with self.assertRaisesRegex(SystemExit, "--description"):
            self.run_tool("nobody", "--dry-run")


class CharacterFileTests(unittest.TestCase):
    def test_every_game_character_is_valid_and_formatted(self):
        for path in (ROOT / "src/characters").glob("*.json"):
            spec = json.loads(path.read_text())
            self.assertEqual(character_model.validate(spec), [], path.name)
            self.assertEqual(character_model.dump(spec), path.read_text(), path.name)

    def test_every_listed_expression_has_its_portrait(self):
        for name, expressions in json.loads((ROOT / "src/portraits.json").read_text()).items():
            for expression in expressions:
                self.assertTrue((ROOT / f"public/portraits/{name}-{expression}.png").exists(), f"{name}-{expression}")

    def test_floating_feet_are_reported(self):
        spec = gerard_spec()
        spec["rig"]["leg"][1] = 0.7
        self.assertIn("soles end at y = 0.240", " ".join(character_model.validate(spec)))


class ProviderTests(unittest.TestCase):
    def test_openai_sends_references_and_decodes_png(self):
        seen = {}

        def handler(request):
            seen["url"], seen["body"] = str(request.url), request.read()
            return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]})

        with tempfile.TemporaryDirectory() as temp:
            ref = Path(temp, "ref.png")
            ref.write_bytes(b"ref")
            client = OpenAIImages("key", "model-x", httpx.Client(transport=httpx.MockTransport(handler)))
            self.assertEqual(client.create("a prompt", [ref], "1024x1024"), PNG)
        self.assertTrue(seen["url"].endswith("/images/edits"))
        self.assertIn(b'name="image[]"; filename="ref.png"', seen["body"])
        self.assertIn(b'name="background"\r\n\r\ntransparent', seen["body"])

    def test_meshy_polls_until_done_and_reports_failures(self):
        states = iter([{"status": "IN_PROGRESS", "progress": 40}, {"status": "SUCCEEDED", "model_urls": {}},
                       {"status": "FAILED", "task_error": {"message": "bad image"}}])

        def handler(request):
            if request.method == "POST":
                self.assertTrue(json.loads(request.read())["image_url"].startswith("data:image/png;base64,"))
                return httpx.Response(202, json={"result": "t1"})
            return httpx.Response(200, json=next(states))

        client = Meshy("key", httpx.Client(transport=httpx.MockTransport(handler)), poll_seconds=0)
        task_id = client.start(PNG, pose_mode="a-pose")
        progress = []
        self.assertEqual(client.wait(task_id, progress.append)["status"], "SUCCEEDED")
        self.assertEqual(progress, ["  Meshy in_progress 40%"])
        with self.assertRaisesRegex(SystemExit, "bad image"):
            client.wait(task_id, progress.append)


if __name__ == "__main__":
    unittest.main()
