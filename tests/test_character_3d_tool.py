import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import character_3d  # noqa: E402
import character_rig  # noqa: E402


class FakeImages:
    def __init__(self):
        self.calls = []

    def create(self, prompt, images, size, background="transparent"):
        self.calls.append([path.name for path in images])
        return b"image"


class FakeMeshy:
    def __init__(self):
        self.views, self.rigs = [], []

    def start_views(self, images, **options):
        self.views.append(images)
        self.options = options
        return "model-task"

    def start_rig(self, model_task, height):
        self.rigs.append((model_task, height))
        return "rig-task"

    def wait(self, task_id, on_progress=print, timeout=1200, kind="image-to-3d"):
        return {"model_urls": {"glb": "model-url"}, "result": {"rigged_character_glb_url": "rig-url"}}

    def download(self, url):
        return url.encode()


class CharacterThreeDTool(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root)
        self.out = self.root / "output" / "characters" / "3d" / "aitor"
        photos = self.root / "assets" / "references" / "characters" / "aitor"
        photos.mkdir(parents=True)
        (self.root / "src" / "characters").mkdir(parents=True)
        for photo in character_3d.FIGURES["aitor"].photos:
            (self.root / "assets" / "references" / "characters" / photo).write_bytes(b"photo")
        self.images, self.meshy = FakeImages(), FakeMeshy()
        self.made = []
        self.real_convert = character_rig.convert
        character_rig.convert = lambda rigged, name, display, scale, clean_shaven: (b"glb", {"id": name, "name": display, "materials": {}, "rig": {"leg": [0, .6, 0]}, "parts": []})
        self.addCleanup(setattr, character_rig, "convert", self.real_convert)

    def run_tool(self, *args):
        return character_3d.run(["aitor", *args], root=self.root, images=self.images, meshy=self.meshy, log=self.made.append)

    def test_a_full_run_sends_photos_to_openai_only_and_stylised_images_to_meshy(self):
        self.run_tool()
        self.assertEqual(self.images.calls[0], [Path(photo).name for photo in character_3d.FIGURES["aitor"].photos])
        self.assertEqual(self.images.calls[1][0], "front.png")
        self.assertEqual(self.images.calls[2:], [["toy.png"]] * 4, "three views and the portrait")
        self.assertTrue((self.root / "public" / "portraits" / "aitor.png").exists())
        self.assertEqual(len(self.meshy.views[0]), 4)
        for image in self.meshy.views[0]:
            self.assertEqual(image, "data:image/png;base64,aW1hZ2U=", "only the images it drew")
        self.assertEqual(self.meshy.rigs, [("model-task", character_3d.FIGURES["aitor"].height)])
        self.assertEqual(json.loads((self.out / "tasks.json").read_text()), {"model": "model-task", "rig": "rig-task"})
        self.assertEqual((self.root / "public" / "models" / "characters" / "aitor.glb").read_bytes(), b"glb")
        self.assertTrue((self.root / "src" / "characters" / "aitor.json").exists())

    def test_what_exists_is_not_paid_for_twice(self):
        self.run_tool()
        calls, views = len(self.images.calls), len(self.meshy.views)
        self.run_tool()
        self.assertEqual(len(self.images.calls), calls)
        self.assertEqual(len(self.meshy.views), views)

    def test_from_makes_that_step_and_the_ones_after_it_again(self):
        self.run_tool()
        calls = len(self.images.calls)
        self.run_tool("--from", "model")
        self.assertEqual(len(self.images.calls), calls)
        self.assertEqual(len(self.meshy.views), 2)
        self.assertEqual(len(self.meshy.rigs), 2)

    def test_a_portrait_comes_from_the_image_and_never_pays_for_a_model(self):
        self.run_tool("--to", "toy")
        self.images.calls.clear()
        self.run_tool("--from", "portrait")
        self.assertEqual(self.images.calls, [["toy.png"]])
        self.assertEqual(self.meshy.views, [])

    def test_expressions_are_only_the_missing_ones_drawn_from_the_portrait(self):
        self.run_tool("--to", "toy")
        self.run_tool("--from", "portrait")
        self.images.calls.clear()
        self.run_tool("--expressions", "riendo")
        self.assertEqual(self.images.calls, [["aitor.png"]])
        self.run_tool("--expressions", "riendo")
        self.assertEqual(self.images.calls, [["aitor.png"]], "already made")
        self.assertEqual(self.meshy.views, [])
        self.assertEqual(json.loads((self.root / "src" / "portraits.json").read_text()), {"aitor": ["riendo"]})

    def test_a_new_model_makes_no_new_portrait(self):
        self.run_tool()
        calls = len(self.images.calls)
        self.run_tool("--from", "views")
        self.assertEqual(len(self.images.calls), calls + 3, "only the views")

    def test_to_stops_before_paying_for_the_model(self):
        self.run_tool("--to", "toy")
        self.assertEqual(len(self.images.calls), 2)
        self.assertEqual(self.meshy.views, [])
        self.assertEqual(self.images.calls[1][-1], character_3d.GAME_STYLE, "the game's own look goes along")

    def add_figure(self, key, **row):
        character_3d.FIGURES[key] = character_3d.Figure(name=key.title(), about="what it is", height=2, **row)
        self.addCleanup(character_3d.FIGURES.pop, key)

    def test_a_person_without_photos_is_drawn_from_words(self):
        self.add_figure("vecino", kind="person")
        character_3d.run(["vecino"], root=self.root, images=self.images, meshy=self.meshy, log=self.made.append)
        self.assertEqual(self.images.calls[0], [character_3d.GAME_STYLE], "no front view, and no photo")
        self.assertEqual(len(self.meshy.rigs), 1)
        self.assertEqual(self.meshy.options["pose_mode"], "a-pose")

    def test_art_goes_before_the_style_and_a_child_is_never_drawn_from_photos(self):
        self.add_figure("pequeno", kind="person", art=["output/figura.png"])
        character_3d.run(["pequeno", "--to", "toy"], root=self.root, images=self.images, meshy=self.meshy, log=self.made.append)
        self.assertEqual(self.images.calls[0], ["figura.png", character_3d.GAME_STYLE])
        for key in ("gerard-child", "bernat-child"):
            self.assertEqual(character_3d.FIGURES[key].photos, [], key)

    def test_a_photo_of_the_face_alone_goes_straight_to_the_toy(self):
        self.add_figure("vecina", kind="person", face_photos=["vecina/cara.png"])
        character_3d.run(["vecina", "--to", "toy"], root=self.root, images=self.images, meshy=self.meshy, log=self.made.append)
        self.assertEqual(self.images.calls, [["cara.png", character_3d.GAME_STYLE]], "no front view")

    def test_a_creature_gets_no_skeleton_and_its_own_files(self):
        self.add_figure("bicho", kind="creature")
        self.addCleanup(setattr, character_rig, "convert_creature", character_rig.convert_creature)
        character_rig.convert_creature = lambda model, name, display, height: (b"glb", {"id": name, "name": display, "glb": f"models/creatures/{name}.glb", "height": height})
        character_3d.run(["bicho"], root=self.root, images=self.images, meshy=self.meshy, log=self.made.append)
        self.assertEqual(self.images.calls[0], [character_3d.GAME_STYLE])
        self.assertEqual(self.meshy.rigs, [], "Meshy only rigs human shapes")
        self.assertNotIn("pose_mode", self.meshy.options)
        self.assertEqual((self.root / "public" / "models" / "creatures" / "bicho.glb").read_bytes(), b"glb")
        self.assertEqual(json.loads((self.root / "src" / "creatures" / "bicho.json").read_text())["height"], 2)

    def test_a_dry_run_calls_nothing(self):
        self.run_tool("--dry-run")
        self.assertEqual(self.images.calls, [])
        self.assertEqual(self.meshy.views, [])

    def test_every_person_sends_only_listed_photos_and_their_face_ones_are_among_them(self):
        for person in character_3d.FIGURES.values():
            if person.photos:
                self.assertTrue(set(person.face_photos) <= set(person.photos), person.name)
            self.assertNotIn("aitor/aitor-04.jpg", person.photos, "a photo that must stay on this machine")


class Rig(unittest.TestCase):
    def test_a_creature_stands_on_the_ground_as_tall_as_asked_with_the_parts_a_fight_moves(self):
        # Meshy's model: centred on the origin, as tall as it likes.
        file = character_rig.GlbFile()
        positions = np.array([[-1, -2, -1], [1, -2, -1], [0, 2, 1], [0, -2, 1]], dtype=np.float32)
        attributes = {"POSITION": file.put(positions, "VEC3", 5126, 34962, True),
                      "TEXCOORD_0": file.put(np.zeros((4, 2), dtype=np.float32), "VEC2", 5126, 34962)}
        indices = file.put(np.array([[0], [1], [2], [0], [2], [3]], dtype=np.uint32), "SCALAR", 5125, 34963)
        image = io.BytesIO()
        Image.new("RGB", (8, 8), (90, 80, 70)).save(image, "JPEG")
        glb = file.finish(image.getvalue(), 0, [{"mesh": 0}], {"primitives": [{"attributes": attributes, "indices": indices, "material": 0}]}, [{"name": "m"}])
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "model.glb"
            source.write_bytes(glb)
            made, spec = character_rig.convert_creature(source, "bicho", "El Bicho", 2.5)
        self.assertEqual(spec, {"id": "bicho", "name": "El Bicho", "glb": "models/creatures/bicho.glb", "height": 2.5})
        gltf, _ = character_rig.read_glb(made)
        self.assertEqual(gltf["nodes"][gltf["scenes"][0]["nodes"][0]]["name"], "El Bicho")
        self.assertEqual({node["name"] for node in gltf["nodes"]}, {"El Bicho", "Malla", "Cabeza de chicle", "Charco pringoso"})
        bounds = gltf["accessors"][gltf["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
        self.assertAlmostEqual(bounds["min"][1], 0)
        self.assertAlmostEqual(bounds["max"][1], 2.5)
        self.assertAlmostEqual(bounds["min"][0] + bounds["max"][0], 0)

    def test_vertices_on_a_seam_share_one_normal(self):
        # Two triangles folded along an edge, with the edge's vertices split as a texture seam splits them.
        positions = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, -1, 1]], dtype=float)
        triangles = np.array([[0, 1, 2], [3, 5, 4]])
        normals = character_rig.smooth_normals(positions, triangles)
        np.testing.assert_allclose(normals[0], normals[3])
        np.testing.assert_allclose(normals[1], normals[4])
        np.testing.assert_allclose(np.linalg.norm(normals, axis=1), 1)
        self.assertFalse(np.allclose(normals[0], normals[2]), "the far corners keep their own")

    def test_a_painted_eye_is_found_whole_from_a_point_on_it_past_a_darker_brow(self):
        picture = np.full((200, 200, 3), .85)
        picture[60:120, 80:110] = .3  # The eye: an oval, near enough, 30 wide and 60 tall.
        picture[40:50, 75:115] = .1  # The brow above it, darker.
        x, y, half_w, half_h = character_rig.painted_shape(picture, 95, 70, 25)
        self.assertAlmostEqual(x, 94.5)
        self.assertAlmostEqual(y, 89.5)
        self.assertAlmostEqual(half_w, 14.5)
        self.assertAlmostEqual(half_h, 29.5)

    def test_what_runs_on_past_a_feature_is_not_one(self):
        picture = np.full((200, 200, 3), .85)
        picture[50:60] = .15  # A long dark line: a frame, the hair.
        self.assertIsNone(character_rig.painted_shape(picture, 100, 55, 20))

    def test_a_small_smile_the_landmarks_put_on_the_chin_is_found_between_the_eyes(self):
        picture = np.full((300, 300, 3), .85)
        picture[95:125, 100:115] = .3  # The eyes, 60 apart, 30 tall.
        picture[95:125, 185:200] = .3
        picture[180:188, 125:175] = .25  # The smile, a short dark bar under them.
        # In metres with 100 pixels a metre and the picture's top left at (0, 3).
        lo, hi, per_metre = np.array([0, 0, 0]), np.array([3, 3, 0]), 100
        face = {"Ojo.R": {"at": [1.075, 1.9, 0], "size": [.075, .15]}, "Ojo.L": {"at": [1.925, 1.9, 0], "size": [.075, .15]}}
        x, y, half_w, half_h = character_rig.mouth_below_eyes(picture, face, lo, hi, per_metre, landmark_y=230, widest=60)
        self.assertAlmostEqual(x, 149.5)
        self.assertAlmostEqual(y, 183.5)
        self.assertAlmostEqual(half_w, 24.5)

    def test_painted_eyes_are_the_pair_of_level_ovals_not_the_hair_or_the_frames(self):
        picture = np.full((300, 300, 3), .85)
        picture[20:80, 40:260] = .2  # The hair: big and dark.
        picture[130:134, 70:230] = .2  # A frame's bar across the face: thin.
        picture[140:170, 100:115] = .2  # The eyes.
        picture[140:170, 185:200] = .2
        picture[230:236, 125:175] = .3  # The mouth.
        (lx, ly, lw, lh), (rx, ry, rw, rh) = character_rig.painted_eyes(picture)
        self.assertAlmostEqual(lx, 108, delta=3)
        self.assertAlmostEqual(rx, 192, delta=3)
        self.assertAlmostEqual(ly, 155, delta=3)
        self.assertAlmostEqual(lh, 15, delta=3)

    def test_no_painted_eyes_without_a_pair(self):
        picture = np.full((300, 300, 3), .85)
        picture[140:170, 100:115] = .2  # One eye alone.
        self.assertIsNone(character_rig.painted_eyes(picture))

    def test_shaving_paints_what_is_over_the_mouth_and_not_the_mouth(self):
        # A flat face in x and y, its texture mapped straight onto it, front to +z.
        grid = np.linspace(-1, 1, 41)
        positions = np.array([[x, y, 0] for y in grid for x in grid], dtype=float)
        corner = lambda row_, col: row_ * 41 + col
        triangles = np.array([t for row_ in range(40) for col in range(40) for t in (
            [corner(row_, col), corner(row_, col + 1), corner(row_ + 1, col + 1)], [corner(row_, col), corner(row_ + 1, col + 1), corner(row_ + 1, col)])])
        uvs = (positions[:, :2] + 1) / 2
        uvs[:, 1] = 1 - uvs[:, 1]
        picture = np.full((200, 200, 3), 220, dtype=np.uint8)
        row = lambda y: int((1 - (y + 1) / 2) * 200)
        picture[row(.2):row(.08), 60:140] = (90, 70, 60)  # The moustache.
        picture[row(.0):row(-.05), 80:120] = (120, 50, 40)  # The mouth.
        mouth = {"at": [0, -.03, 0], "size": [.2, .03]}
        shaved = np.asarray(character_rig.shave(Image.fromarray(picture), positions, triangles, uvs, mouth))
        np.testing.assert_array_equal(shaved[row(.14), 100], [220, 220, 220])
        np.testing.assert_array_equal(shaved[row(-.03), 100], [120, 50, 40])

    def test_the_gaps_between_a_texture_s_islands_take_the_colour_of_their_edges(self):
        picture = np.zeros((64, 64, 3), dtype=np.uint8)  # A black atlas with one red island.
        picture[16:48, 16:48] = (200, 40, 40)
        uvs = np.array([[.25, .25], [.75, .25], [.75, .75], [.25, .75]])
        filled = np.asarray(character_rig.fill_gutters(Image.fromarray(picture), uvs, np.array([[0, 1, 2], [0, 2, 3]])))
        np.testing.assert_array_equal(filled[32, 32], [200, 40, 40])
        np.testing.assert_array_equal(filled[32, 8], [200, 40, 40], "the gap beside it")
        np.testing.assert_array_equal(filled[8, 32], [200, 40, 40])

    def test_the_colour_of_a_surface_goes_by_area_not_by_triangles(self):
        colours = np.array([[1., 0, 0]] * 9 + [[0, 0, 1.]])
        areas = np.array([.01] * 9 + [1.])
        np.testing.assert_allclose(character_rig.area_median(colours, areas), [0, 0, 1])

    def test_a_rotation_leaves_its_pivot_where_it_was(self):
        pivot = np.array([.2, 1, 0])
        turn = character_rig.rotate_z(40, pivot)
        np.testing.assert_allclose((turn @ np.append(pivot, 1))[:3], pivot)


if __name__ == "__main__":
    unittest.main()
