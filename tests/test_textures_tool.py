import io
import json
import sys
import tempfile
import unittest
import unittest.mock
import zipfile
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import geo  # noqa: E402
import textures  # noqa: E402


def jpeg(colour, size=64, noise=0) -> bytes:
    """A small JPEG: a flat colour, or seamless noise round it."""
    rng = np.random.default_rng(1)
    a = np.ones((size, size, 3)) * np.array(colour, dtype=float)
    if noise:
        a += rng.normal(0, noise, (size, size, 1))
    buffer = io.BytesIO()
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(buffer, "JPEG", quality=95)
    return buffer.getvalue()


class FakeNetwork:
    """Answers the texture libraries' and Wikimedia Commons' URLs from memory and records them."""

    def __init__(self, routes: dict):
        self.routes, self.calls = routes, []

    def get(self, url, **params):
        self.calls.append((url, params))
        for prefix, body in self.routes.items():
            if url.startswith(prefix):
                return body(params) if callable(body) else body
        raise AssertionError(f"unexpected download {url}")

    def get_json(self, url, **params):
        return json.loads(self.get(url, **params))


class TexturesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.patches = [unittest.mock.patch.object(textures, "TEXTURES", base / "public" / "textures"),
                        unittest.mock.patch.object(textures, "RAW", base / "raw")]
        for p in self.patches: p.start()

    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()

    def run_tool(self, *argv, network=None):
        out = io.StringIO()
        with unittest.mock.patch.object(textures, "get", network.get), unittest.mock.patch.object(textures, "get_json", network.get_json), redirect_stdout(out):
            textures.main(list(argv))
        return out.getvalue()

    def meta(self, texture_id):
        return json.loads((textures.TEXTURES / texture_id / "texture.json").read_text())

    def test_fetches_a_poly_haven_material_with_its_real_size_and_licence(self):
        files = {key: {"1k": {"jpg": {"url": f"https://dl.polyhaven.org/{key}.jpg"}}} for key in ("Diffuse", "nor_gl", "Rough")}
        network = FakeNetwork({
            "https://api.polyhaven.com/info/clay_roof_tiles_02": json.dumps({"name": "Clay Roof Tiles 02", "dimensions": [2500, 2500], "authors": {"Amal Kumar": "All"}}).encode(),
            "https://api.polyhaven.com/files/clay_roof_tiles_02": json.dumps(files).encode(),
            "https://dl.polyhaven.org/Diffuse": jpeg((180, 90, 60), 128, 8),
            "https://dl.polyhaven.org/nor_gl": jpeg((128, 128, 255), 128),
        })
        self.run_tool("fetch", "polyhaven", "clay_roof_tiles_02", "--id", "teula", "--px", "64", network=network)
        meta = self.meta("teula")
        self.assertEqual(meta["size_m"], [2.5, 2.5])
        self.assertEqual(meta["files"], {"albedo": "albedo.webp", "normal": "normal.webp"})
        self.assertEqual(meta["px"], [64, 64])
        self.assertEqual(meta["source"]["author"], "Amal Kumar")
        self.assertEqual(meta["source"]["licence"], "CC0 1.0")
        self.assertEqual(meta["source"]["url"], "https://polyhaven.com/a/clay_roof_tiles_02")
        self.assertTrue(meta["mean"].startswith("#b"))
        # Roughness is only downloaded when asked for.
        self.assertFalse(any("Rough" in url for url, _ in network.calls))
        self.assertTrue((textures.RAW / "Diffuse.jpg").exists())

    def test_an_ambientcg_material_without_a_size_needs_one(self):
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as z:
            z.writestr("Asphalt010_1K-JPG_Color.jpg", jpeg((60, 60, 62), 64, 6))
            z.writestr("Asphalt010_1K-JPG_NormalGL.jpg", jpeg((128, 128, 255)))
        asset = {"foundAssets": [{"assetId": "Asphalt010", "displayName": "Asphalt 010", "dimensionX": 0, "dimensionY": 0,
                                  "shortLink": "https://ambientcg.com/a/Asphalt010",
                                  "downloadFolders": {"default": {"downloadFiletypeCategories": {"zip": {"downloads": [
                                      {"attribute": "1K-JPG", "fileName": "Asphalt010_1K-JPG.zip", "fullDownloadPath": "https://ambientcg.com/get?file=Asphalt010_1K-JPG.zip"}]}}}}}]}
        network = FakeNetwork({"https://ambientcg.com/api/v2/full_json": json.dumps(asset).encode(),
                               "https://ambientcg.com/get": archive.getvalue()})
        with self.assertRaises(SystemExit):
            self.run_tool("fetch", "ambientcg", "Asphalt010", "--id", "asfalt", network=network)
        self.run_tool("fetch", "ambientcg", "Asphalt010", "--id", "asfalt", "--size-m", "2", network=network)
        meta = self.meta("asfalt")
        self.assertEqual(meta["size_m"], [2.0, 2.0])
        self.assertEqual(meta["source"]["site"], "ambientCG")
        self.assertIn("normal", meta["files"])

    def test_seams_are_found_and_blended(self):
        ramp = Image.fromarray(np.tile(np.linspace(0, 255, 64, dtype=np.uint8), (64, 1))).convert("RGB")
        self.assertGreater(textures.seam_error(ramp), textures.SEAM_LIMIT)
        self.assertLess(textures.seam_error(textures.make_tileable(ramp)), textures.SEAM_LIMIT)
        flat = Image.new("RGB", (32, 32), (90, 90, 90))
        self.assertEqual(textures.seam_error(flat), 0)

    def test_perspective_straightens_a_quad(self):
        # A white quad on black, skewed: its four corners become the whole picture.
        image = Image.new("RGB", (200, 200), (0, 0, 0))
        quad = [(40, 30), (170, 50), (160, 180), (30, 150)]
        from PIL import ImageDraw
        ImageDraw.Draw(image).polygon(quad, fill=(255, 255, 255))
        out = np.asarray(textures.perspective(image, quad, (50, 40)))
        self.assertGreater(out[2:-2, 2:-2].mean(), 240)

    def test_a_commons_photo_keeps_its_author_and_licence_and_refuses_closed_ones(self):
        def page(licence):
            return json.dumps({"query": {"pages": {"1": {"imageinfo": [{"url": "https://upload.wikimedia.org/x/Facade.jpg",
                                                                         "descriptionurl": "https://commons.wikimedia.org/wiki/File:Facade.jpg",
                                                                         "extmetadata": {"Artist": {"value": "<a href='u'>Jane</a>"},
                                                                                         "LicenseShortName": {"value": licence}}}]}}}}).encode()
        photo = io.BytesIO(); Image.new("RGB", (300, 200), (200, 180, 150)).save(photo, "JPEG")
        url = "https://commons.wikimedia.org/wiki/File:Facade.jpg"
        closed = FakeNetwork({"https://commons.wikimedia.org/w/api.php": page("All rights reserved"), "https://upload.wikimedia.org": photo.getvalue()})
        with self.assertRaises(SystemExit):
            self.run_tool("photo", url, "--id", "facana", "--size-m", "9", "6", network=closed)
        free = FakeNetwork({"https://commons.wikimedia.org/w/api.php": page("CC BY-SA 4.0"), "https://upload.wikimedia.org": photo.getvalue()})
        self.run_tool("photo", url, "--id", "facana", "--size-m", "9", "6", "--bays", "3", "--storeys", "2", "--px", "90",
                      "--corners", "10,10", "290,10", "290,190", "10,190", network=free)
        meta = self.meta("facana")
        self.assertEqual((meta["kind"], meta["bays"], meta["storeys"]), ("photo", 3, 2))
        self.assertEqual(meta["source"]["author"], "Jane")
        self.assertEqual(meta["source"]["licence"], "CC BY-SA 4.0")
        self.assertEqual(meta["px"], [90, 60])
        self.assertNotIn("normal", meta["files"])

    def test_other_sites_photos_are_refused(self):
        with self.assertRaises(SystemExit):
            self.run_tool("photo", "https://maps.googleapis.com/streetview.jpg", "--id", "x", "--size-m", "1", "1", network=FakeNetwork({}))

    def test_panots_are_drawn_over_a_grain_and_wrap(self):
        grain = textures.TEXTURES / "formigo"; grain.mkdir(parents=True)
        Image.new("RGB", (64, 64), (140, 138, 132)).save(grain / "albedo.webp")
        (grain / "texture.json").write_text(json.dumps({"id": "formigo", "files": {"albedo": "albedo.webp"}, "size_m": [2, 2],
                                                        "source": {"name": "Granular Concrete", "author": "Rob", "licence": "CC0 1.0", "licence_url": ""}}))
        for kind in ("square", "flor"):
            self.run_tool("panot", kind, "--id", f"panot-{kind}", "--grain", "formigo", "--px", "128", "--tiles", "4", network=FakeNetwork({}))
            meta = self.meta(f"panot-{kind}")
            self.assertEqual(meta["size_m"], [0.8, 0.8])
            self.assertEqual(meta["source"]["licence"], "CC0 1.0")
        height = textures.panot_height("flor", 32, 2)
        np.testing.assert_allclose(height[:, :32], height[:, 32:])
        self.assertLess(height.min(), 0.3)

    def test_list_names_every_texture(self):
        folder = textures.TEXTURES / "estuc"; folder.mkdir(parents=True)
        (folder / "albedo.webp").write_bytes(b"x" * 2048)
        (folder / "texture.json").write_text(json.dumps({"id": "estuc", "kind": "material", "files": {"albedo": "albedo.webp"}, "size_m": [1.5, 1.5],
                                                         "px": [512, 512], "source": {"site": "Poly Haven", "asset": "plaster_grey_04", "licence": "CC0 1.0"}}))
        out = self.run_tool("list", network=FakeNetwork({}))
        self.assertIn("estuc", out)
        self.assertIn("plaster_grey_04", out)


class GeoMaterialsTest(unittest.TestCase):
    def test_buildings_get_grain_by_kind_and_styles_override_it(self):
        self.assertEqual(geo.building_materials({}, "flats", "shops", "flat"), {"wall": "estuc", "base": "carreu", "roof": "rajola"})
        self.assertEqual(geo.building_materials({}, "timber", "masonry", "hip"), {"wall": "estuc", "base": "mamposteria", "roof": "teula"})
        self.assertEqual(geo.building_materials({"wall": "mao", "roof": "none"}, "flats", "shops", "hip"), {"wall": "mao", "base": "carreu"})
        self.assertEqual(geo.building_materials({}, "hedge", "hedge", "flat"), {})
        self.assertEqual(geo.building_materials({}, "photo:eixample", "photo:botigues", "flat"), {"roof": "rajola"})

    def test_look_materials_follow_the_street(self):
        plain = geo.look_materials({})
        self.assertEqual(plain["ground"], {"texture": "formigo", "tint": "#cbc2ab"})
        self.assertEqual(plain["sand"], {"texture": "sorra"})
        barcelona = geo.look_materials({"look": {"ground": "panot", "asphalt": "#3e4043", "materials": {"square": "saulo", "grass": "none", "road": {"texture": "asfalt", "tint": "#222222"}}}})
        self.assertEqual(barcelona["ground"], {"texture": "panot-gris"})
        self.assertEqual(barcelona["bike"], {"texture": "asfalt", "tint": "#3e4043"})
        self.assertEqual(barcelona["road"], {"texture": "asfalt", "tint": "#222222"})
        self.assertEqual(barcelona["square"], {"texture": "saulo"})
        self.assertNotIn("grass", barcelona)

    def test_missing_textures_are_dropped_so_the_game_paints_them(self):
        scene = {"materials": {"ground": {"texture": "panot-gris"}, "road": {"texture": "no-such"}},
                 "buildings": [{"facade": "flats", "ground": "shops", "materials": {"wall": "estuc", "roof": "no-such"}, "signature": "no-such"}]}
        with tempfile.TemporaryDirectory() as tmp, unittest.mock.patch.object(geo, "TEXTURES", Path(tmp)), redirect_stdout(io.StringIO()), \
                unittest.mock.patch("sys.stderr", io.StringIO()):
            for t in ("panot-gris", "estuc"):
                (Path(tmp) / t).mkdir()
                (Path(tmp) / t / "texture.json").write_text(json.dumps({"kind": "material", "files": {"albedo": "albedo.webp"}, "size_m": [1, 1], "mean": "#808080", "source": {}}))
            found = geo.embed_textures(scene, [])
        self.assertEqual(sorted(found), ["estuc", "panot-gris"])
        self.assertEqual(found["estuc"], {"kind": "material", "files": {"albedo": "albedo.webp"}, "size_m": [1, 1], "mean": "#808080"})
        self.assertEqual(list(scene["materials"]), ["ground"])
        self.assertEqual(scene["buildings"][0]["materials"], {"wall": "estuc"})
        self.assertNotIn("signature", scene["buildings"][0])

    def test_landmark_footprints_turn_with_them(self):
        lm = {"x": 10, "z": 10, "w": 4, "d": 1, "angle": 0}
        self.assertEqual({x for x, _ in geo.landmark_cells(lm, 30, 30)}, {8, 9, 10, 11, 12})
        self.assertEqual({z for _, z in geo.landmark_cells(lm, 30, 30)}, {10})
        turned = geo.landmark_cells(lm | {"angle": 90}, 30, 30)
        self.assertEqual({x for x, _ in turned}, {10})
        self.assertEqual({z for _, z in turned}, {8, 9, 10, 11, 12})
        self.assertEqual(geo.landmark_cells({"x": 0.2, "z": 0.1, "w": 0.4, "d": 0.4, "angle": 0}, 30, 30), [(0, 0)])


if __name__ == "__main__":
    unittest.main()
