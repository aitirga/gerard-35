"""Turn a rigged GLB (Meshy's skeleton) into a model of the game's own rig.

The game animates its people by setting Euler angles on named nodes (`Cuerpo`, `Pierna`, `Brazo`…,
src/character-model.ts), so every bone here rests at no rotation, in body axes. This merges Meshy's
24 bones into those few, lowers the arms from its A-pose into a relaxed rest pose, scales the model
to the game's units and splits the clothes off, so an ánima can dye them. It finds the face on the
model: a mouth bone stretches the painted mouth, and each eye gets a node, turned to the face's
surface, where the game puts its eyelid (src/face.ts). It also measures the body: the character file
it writes says where the joints are and where an ánima's pieces sit.

Finding the face needs MediaPipe, once per model: `uv run --with mediapipe`. What it finds is kept
next to the rigged file, with a picture to check it by.
"""
import io
import json
import struct
from pathlib import Path

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ARM_REST_DEGREES = 11  # How far from straight down the arms hang at rest.
GROUND = .02  # Where the soles end, in body coordinates (character_model.py).
TEXTURE_QUALITY = 88
TEXTURE_SIZE = 1024  # A toy's flat colours need no more: the street camera shows 40–75 pixels a metre.
GUTTER_EDGE = 3  # How much of an island's edge is half gap, as a filter's size: 1 pixel. Meshy's islands are small: more eats them.
GUTTER_REACH = 24  # How far past an island its colour spreads, in pixels at the original size.
TEXTURE_CLEAN = 5  # Median filter, in pixels at the original size: takes off the scratches, keeps the painted edges.

# Which of the game's bones each of Meshy's bones becomes.
MERGE = {
    "Hips": "Cuerpo", "Spine": "Cuerpo", "Spine01": "Cuerpo", "Spine02": "Cuerpo", "neck": "Cuerpo",
    "LeftShoulder": "Cuerpo", "RightShoulder": "Cuerpo",
    "Head": "Cabeza", "head_end": "Cabeza", "headfront": "Cabeza",
    "LeftArm": "Brazo.L", "LeftForeArm": "Antebrazo.L", "LeftHand": "Mano.L",
    "RightArm": "Brazo.R", "RightForeArm": "Antebrazo.R", "RightHand": "Mano.R",
    "LeftUpLeg": "Pierna.L", "LeftLeg": "Espinilla.L", "LeftFoot": "Tobillo.L", "LeftToeBase": "Tobillo.L",
    "RightUpLeg": "Pierna.R", "RightLeg": "Espinilla.R", "RightFoot": "Tobillo.R", "RightToeBase": "Tobillo.R",
}
BONES = ["Cuerpo", "Cabeza", "Pierna.R", "Espinilla.R", "Tobillo.R", "Brazo.R", "Antebrazo.R", "Mano.R",
         "Pierna.L", "Espinilla.L", "Tobillo.L", "Brazo.L", "Antebrazo.L", "Mano.L", "Boca"]
EYES = ("Ojo.R", "Ojo.L")
UPPER = {"Cuerpo", "Brazo.L", "Antebrazo.L", "Brazo.R", "Antebrazo.R"}
LOWER = {"Pierna.L", "Espinilla.L", "Pierna.R", "Espinilla.R"}
SKIP_COLOUR = .16  # How far from a garment's own colour a texel stops being that garment.

# Where the cast's head has what an ánima fits to it (src/anima-looks.ts): the middle of an eye, and the top.
CAST_EYE = (.079, .24, .19)
CAST_TOP = .47
# How far round the mouth its bone pulls, in sizes of it, from all to nothing.
MOUTH_PULL = (.8, 1.4)
# How deep into the face it reaches, in metres: the back of the head is at the same height.
PULL_DEPTH = .05
# How far up a creature's feet reach, in parts of its height: they make its base.
CREATURE_BASE = .12
# An eyelid's size against the eye it covers, and how thick it is against the eye's width.
LID_SIZE = (1.25, 1.2)
LID_DEPTH = .5
EYE_NORMAL_VERTICES = 24
# Where a moustache is: from just over the mouth, this wide and this tall, in half widths of the mouth.
SHAVE_GAP = .001
SHAVE_WIDE = 2.7
SHAVE_TALL = 1.2
FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
# Landmarks of MediaPipe's face mesh: outer corner, inner corner, top and bottom of each eye; corners and outer lips of the mouth.
EYE_MARKS = {"Ojo.R": (33, 133, 159, 145), "Ojo.L": (263, 362, 386, 374)}
MOUTH_MARKS = (61, 291, 0, 17)

COMPONENTS = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(data: bytes):
    magic, _version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise SystemExit("Not a GLB file.")
    size, _kind = struct.unpack_from("<I4s", data, 12)
    gltf = json.loads(data[20:20 + size])
    offset = 20 + size
    bin_size, _kind = struct.unpack_from("<I4s", data, offset)
    return gltf, data[offset + 8:offset + 8 + bin_size]


def accessor(gltf: dict, blob: bytes, index: int) -> np.ndarray:
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    kind, width = COMPONENTS[a["componentType"]], WIDTH[a["type"]]
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = view.get("byteStride", width * np.dtype(kind).itemsize)
    if stride == width * np.dtype(kind).itemsize:
        values = np.frombuffer(blob, kind, a["count"] * width, start).reshape(a["count"], width)
    else:
        values = np.stack([np.frombuffer(blob, kind, width, start + i * stride) for i in range(a["count"])])
    if a.get("normalized") and kind != np.float32:
        values = values / np.iinfo(kind).max
    return values.astype(np.float64 if kind == np.float32 else kind)


def rotate_z(degrees: float, pivot: np.ndarray) -> np.ndarray:
    a = np.radians(degrees)
    r = np.eye(4)
    r[:2, :2] = [[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]
    t, back = np.eye(4), np.eye(4)
    t[:3, 3], back[:3, 3] = -pivot, pivot
    return back @ r @ t


def area_median(colours: np.ndarray, areas: np.ndarray) -> np.ndarray:
    """The colour most of a surface is, channel by channel: small dense details do not outvote large plain parts."""
    result = []
    for channel in colours.T:
        order = np.argsort(channel)
        result.append(channel[order][np.searchsorted(np.cumsum(areas[order]), areas.sum() / 2)])
    return np.array(result)


class GlbFile:
    """A GLB under construction: arrays go into its one buffer, and the texture and the document close it."""

    def __init__(self):
        self.buffer, self.views, self.accessors = bytearray(), [], []

    def _align(self):
        while len(self.buffer) % 4:
            self.buffer.append(0)

    def put(self, array: np.ndarray, gltf_type: str, component: int, target: int | None = None, bounds=False) -> int:
        self._align()
        raw = array.tobytes()
        self.views.append({"buffer": 0, "byteOffset": len(self.buffer), "byteLength": len(raw), **({"target": target} if target else {})})
        self.buffer.extend(raw)
        entry = {"bufferView": len(self.views) - 1, "componentType": component, "count": len(array), "type": gltf_type}
        if bounds:
            entry["min"], entry["max"] = [float(v) for v in array.min(axis=0)], [float(v) for v in array.max(axis=0)]
        self.accessors.append(entry)
        return len(self.accessors) - 1

    def finish(self, jpeg: bytes, root: int, nodes: list, mesh: dict, materials: list, **extra) -> bytes:
        self._align()
        self.views.append({"buffer": 0, "byteOffset": len(self.buffer), "byteLength": len(jpeg)})
        self.buffer.extend(jpeg)
        self._align()
        document = {
            "asset": {"version": "2.0", "generator": "gerard-35 tools/character_rig.py"},
            "scene": 0, "scenes": [{"nodes": [root]}], "nodes": nodes, "meshes": [mesh], "materials": materials,
            "textures": [{"source": 0, "sampler": 0}], "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
            "images": [{"bufferView": len(self.views) - 1, "mimeType": "image/jpeg"}],
            "accessors": self.accessors, "bufferViews": self.views, "buffers": [{"byteLength": len(self.buffer)}], **extra,
        }
        text = json.dumps(document, separators=(",", ":")).encode()
        text += b" " * (-len(text) % 4)
        return struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(self.buffer)) + struct.pack("<I4s", len(text), b"JSON") + text \
            + struct.pack("<I4s", len(self.buffer), b"BIN\0") + bytes(self.buffer)


def fill_gutters(texture: Image.Image, uvs: np.ndarray, triangles: np.ndarray) -> Image.Image:
    """
    The texture with the gaps between its islands painted the colour of their edges. Left as they are,
    filtering and mipmaps bring the gaps' colour into the seams, which show as fine lines on the model.
    """
    width, height = texture.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    for corners in uvs[triangles] % 1:
        draw.polygon([(u * width, v * height) for u, v in corners], fill=255)
    # A texel on an island's very edge is already half gap.
    covered = np.asarray(mask.filter(ImageFilter.MinFilter(GUTTER_EDGE))) > 0
    if not covered.any():
        return texture
    pixels = np.array(texture, dtype=np.float32)
    pixels[~covered] = 0
    for _ in range(GUTTER_REACH):
        weight, colour = np.zeros(covered.shape, dtype=np.float32), np.zeros_like(pixels)
        for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
            weight += np.roll(covered, step, axis)
            colour += np.roll(pixels, step, axis)
        grows = ~covered & (weight > 0)
        pixels[grows] = colour[grows] / weight[grows, None]
        covered = covered | grows
    return Image.fromarray(pixels.astype(np.uint8))


def clean_texture(texture: Image.Image, uvs: np.ndarray, triangles: np.ndarray) -> bytes:
    """A JPEG of the texture without seams or scratches, painted edges kept, at the size the game needs."""
    encoded = io.BytesIO()
    clean = fill_gutters(texture, uvs, triangles).filter(ImageFilter.MedianFilter(TEXTURE_CLEAN)).resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)
    clean.save(encoded, "JPEG", quality=TEXTURE_QUALITY, optimize=True)
    return encoded.getvalue()


def texture_of(gltf: dict, blob: bytes) -> Image.Image:
    view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    start = view.get("byteOffset", 0)
    return Image.open(io.BytesIO(blob[start:start + view["byteLength"]])).convert("RGB")


def smooth_normals(positions: np.ndarray, triangles: np.ndarray) -> np.ndarray:
    """One normal per point of the surface: Meshy splits vertices along its texture's seams, and they show as facets."""
    _, welded = np.unique(np.round(positions, 5), axis=0, return_inverse=True)
    welded = welded.reshape(-1)
    corners = positions[triangles]
    faces = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
    total = np.zeros((welded.max() + 1, 3))
    for corner in range(3):
        np.add.at(total, welded[triangles[:, corner]], faces)
    total /= np.maximum(np.linalg.norm(total, axis=1, keepdims=True), 1e-12)
    return total[welded]


def front_view(positions, triangles, uvs, pixels, lo, hi, height=900):
    """The textured surface between `lo` and `hi`, seen from the front: picture and depth, and how to go back to metres."""
    per_metre = height / (hi[1] - lo[1])
    width = int((hi[0] - lo[0]) * per_metre)
    picture, depth = np.full((height, width, 3), .55), np.full((height, width), -np.inf)
    centre = positions[triangles].mean(axis=1)
    near = (centre[:, 0] > lo[0]) & (centre[:, 0] < hi[0]) & (centre[:, 1] > lo[1]) & (centre[:, 1] < hi[1])
    for triangle in triangles[near]:
        p = positions[triangle]
        x, y = (p[:, 0] - lo[0]) * per_metre, (hi[1] - p[:, 1]) * per_metre
        area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0])
        if abs(area) < 1e-9:
            continue
        x0, x1 = max(int(x.min()), 0), min(int(x.max()) + 2, width)
        y0, y1 = max(int(y.min()), 0), min(int(y.max()) + 2, height)
        if x0 >= x1 or y0 >= y1:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1) + .5, np.arange(y0, y1) + .5)
        a = ((x[1] - gx) * (y[2] - gy) - (x[2] - gx) * (y[1] - gy)) / area
        b = ((x[2] - gx) * (y[0] - gy) - (x[0] - gx) * (y[2] - gy)) / area
        c = 1 - a - b
        inside = (a >= 0) & (b >= 0) & (c >= 0)
        z = a * p[0, 2] + b * p[1, 2] + c * p[2, 2]
        rows, cols = np.nonzero(inside & (z > depth[y0:y1, x0:x1]))
        if not len(rows):
            continue
        weight = np.stack([a[rows, cols], b[rows, cols], c[rows, cols]], axis=1)
        uv = weight @ uvs[triangle]
        tex_x = np.clip((uv[:, 0] % 1 * pixels.shape[1]).astype(int), 0, pixels.shape[1] - 1)
        tex_y = np.clip((uv[:, 1] % 1 * pixels.shape[0]).astype(int), 0, pixels.shape[0] - 1)
        picture[rows + y0, cols + x0] = pixels[tex_y, tex_x]
        depth[rows + y0, cols + x0] = z[rows, cols]
    return picture, depth, per_metre


def painted_shape(picture: np.ndarray, x: int, y: int, reach: int, dark: float = .5, widest: int | None = None):
    """
    The dark painted shape at a point or nearest it, as (centre x, centre y, half width, half height);
    None if it runs on past a feature's size (half as wide as `widest`, by default `reach` and a half),
    into a frame or the hair. `dark` is how far from the darkest thing round the point to the skin the
    shape's edge lies.
    """
    widest = widest or int(reach * 1.5)
    luma = picture.mean(axis=2)
    y0, x0 = max(y - reach, 0), max(x - reach, 0)
    window = luma[y0:y + reach, x0:x + reach]
    limit = window.min() + (np.percentile(window, 90) - window.min()) * dark
    rows, cols = np.nonzero(window < limit)
    nearest = np.argmin((rows + y0 - y) ** 2 + (cols + x0 - x) ** 2)
    seed = (int(rows[nearest]) + y0, int(cols[nearest]) + x0)
    seen, stack = {seed}, [seed]
    while stack:
        row, col = stack.pop()
        for cell in ((row + 1, col), (row - 1, col), (row, col + 1), (row, col - 1)):
            if cell in seen or not (0 <= cell[0] < luma.shape[0] and 0 <= cell[1] < luma.shape[1]):
                continue
            if luma[cell] < limit and abs(cell[0] - y) < reach * 3 and abs(cell[1] - x) < widest * 2:
                seen.add(cell)
                stack.append(cell)
    rows, cols = zip(*seen)
    half_w, half_h = (max(cols) - min(cols)) / 2, (max(rows) - min(rows)) / 2
    if half_w > widest or half_h > reach * 2 or len(seen) < 20:
        return None
    return (max(cols) + min(cols)) / 2, (max(rows) + min(rows)) / 2, half_w, half_h


def mouth_below_eyes(picture: np.ndarray, face: dict, lo, hi, per_metre: float, landmark_y: float, widest: int):
    """
    A painted mouth the landmarks missed (they put a small smile on the chin): the darkest shape
    between the eyes' frames and where the landmarks fell, centred between the eyes.
    """
    eyes = [face[bone] for bone in EYE_MARKS]
    x = (np.mean([e["at"][0] for e in eyes]) - lo[0]) * per_metre
    top = (hi[1] - np.mean([e["at"][1] for e in eyes])) * per_metre + np.mean([e["size"][1] for e in eyes]) * per_metre * 2.6
    half = abs(eyes[0]["at"][0] - eyes[1]["at"][0]) * per_metre / 2
    y0, y1, x0, x1 = int(top), int(landmark_y + half * .4), int(x - half * .6), int(x + half * .6)
    if y1 <= y0 or x1 <= x0:
        return None
    window = picture[y0:y1, x0:x1].mean(axis=2)
    # The darkest spots first; one that runs on (a collar, a stripe) is not a mouth, so the next is tried.
    tried = np.zeros_like(window, dtype=bool)
    for _ in range(6):
        row, col = np.unravel_index(np.argmin(np.where(tried, np.inf, window)), window.shape)
        if tried[row, col]:
            break
        # Its window stays below the frames: something darker there would set the edge past the mouth.
        reach = max(10, min(int(half * .5), int(row)))
        shape = painted_shape(picture, x0 + int(col), y0 + int(row), reach, dark=.35, widest=widest)
        if shape:
            return shape
        r = int(half * .25)
        tried[max(row - r, 0):row + r, max(col - r, 0):col + r] = True
    return None


def dark_blobs(picture: np.ndarray, limit: float = .32, step: int = 3) -> list[dict]:
    """The dark painted shapes of a picture (on a coarse grid of `step` pixels), with their boxes and how full they are."""
    luma = picture[::step, ::step].mean(axis=2)
    dark = luma < limit
    seen = np.zeros_like(dark)
    blobs = []
    for start in zip(*np.nonzero(dark)):
        if seen[start]:
            continue
        seen[start] = True
        stack, cells = [start], []
        while stack:
            row, col = stack.pop()
            cells.append((row, col))
            for cell in ((row + 1, col), (row - 1, col), (row, col + 1), (row, col - 1)):
                if 0 <= cell[0] < dark.shape[0] and 0 <= cell[1] < dark.shape[1] and dark[cell] and not seen[cell]:
                    seen[cell] = True
                    stack.append(cell)
        rows, cols = np.array(cells).T
        top, bottom, left, right = rows.min() * step, (rows.max() + 1) * step, cols.min() * step, (cols.max() + 1) * step
        blobs.append({"x": (left + right) / 2, "y": (top + bottom) / 2, "w": right - left, "h": bottom - top,
                      "area": len(cells) * step * step, "full": len(cells) * step * step / ((right - left) * (bottom - top))})
    return blobs


def painted_eyes(picture: np.ndarray):
    """
    The two painted eyes of a cartoon face MediaPipe does not take for one: the pair of compact dark
    ovals, alike in size, level with each other, either side of the middle and about halfway down.
    As (left, right) in the picture, each (centre x, centre y, half width, half height); None if none.
    """
    height, width = picture.shape[:2]
    whole = height * width
    eyes = [b for b in dark_blobs(picture) if .0004 * whole < b["area"] < .02 * whole and b["full"] > .5
            and .7 < b["h"] / b["w"] < 3.5 and .3 * height < b["y"] < .75 * height]
    best, score = None, np.inf
    for i, one in enumerate(eyes):
        for other in eyes[i + 1:]:
            left, right = sorted((one, other), key=lambda b: b["x"])
            apart = right["x"] - left["x"]
            if not .15 * width < apart < .5 * width or max(one["area"], other["area"]) > 1.6 * min(one["area"], other["area"]):
                continue
            off = abs(left["y"] - right["y"]) / apart + abs((left["x"] + right["x"]) / 2 - width / 2) / width
            if off < .35 and off < score:
                best, score = (left, right), off
    if not best:
        return None
    return tuple((b["x"], b["y"], b["w"] / 2, b["h"] / 2) for b in best)


def find_face(rigged: Path, positions, triangles, uvs, pixels, head) -> dict:
    """Where the eyes and the mouth are on the model, in its own metres, and how big. Kept in `<rigged>.face.json`."""
    kept = rigged.with_suffix(".face.json")
    if kept.exists():
        return json.loads(kept.read_text())
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as tasks
        from mediapipe.tasks.python import vision
    except ImportError as error:
        raise SystemExit("Finding the face needs MediaPipe: run this with `uv run --with mediapipe`.") from error
    model = rigged.parent.parent / "face_landmarker.task"
    if not model.exists():
        model.write_bytes(httpx.get(FACE_MODEL, follow_redirects=True, timeout=120).content)
    margin = (head.max(axis=0) - head.min(axis=0)) * .12
    lo, hi = head.min(axis=0) - margin, head.max(axis=0) + margin
    picture, depth, per_metre = front_view(positions, triangles, uvs, pixels, lo, hi)
    image = Image.fromarray((picture * 255).astype(np.uint8))
    detector = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(base_options=tasks.BaseOptions(model_asset_path=str(model)), num_faces=1))
    found = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(image)))
    if not found.face_landmarks:
        # A face drawn too simply for MediaPipe: its painted eyes, and the mouth below them.
        painted = painted_eyes(picture)
        if not painted:
            image.save(rigged.with_suffix(".face.png"))
            raise SystemExit(f"No face found on {rigged.name}: look at {rigged.with_suffix('.face.png')}.")
        face = {}
        for bone, (x, y, half_w, half_h) in zip(("Ojo.R", "Ojo.L"), painted):
            z = float(depth[max(int(y) - 6, 0):int(y) + 7, max(int(x) - 6, 0):int(x) + 7].max())
            face[bone] = {"at": [float(lo[0] + x / per_metre), float(hi[1] - y / per_metre), z], "size": [half_w / per_metre, half_h / per_metre]}
        apart = painted[1][0] - painted[0][0]
        mouth = mouth_below_eyes(picture, face, lo, hi, per_metre, painted[0][1] + apart * .75, int(apart * .9))
        if not mouth:
            image.save(rigged.with_suffix(".face.png"))
            raise SystemExit(f"No mouth found on {rigged.name}: look at {rigged.with_suffix('.face.png')}.")
        x, y, half_w, half_h = mouth
        z = float(depth[max(int(y) - 6, 0):int(y) + 7, max(int(x) - 6, 0):int(x) + 7].max())
        face["Boca"] = {"at": [float(lo[0] + x / per_metre), float(hi[1] - y / per_metre), z], "size": [half_w / per_metre, half_h / per_metre]}
        return keep_face(face, kept, image, lo, hi, per_metre, rigged)
    marks = found.face_landmarks[0]

    def at(index):
        x, y = marks[index].x * image.width, marks[index].y * image.height
        around = depth[max(int(y) - 6, 0):int(y) + 7, max(int(x) - 6, 0):int(x) + 7]
        return np.array([lo[0] + x / per_metre, hi[1] - y / per_metre, float(around.max())])

    def feature(one, other, top, bottom):
        ends, heights = (at(one), at(other)), (at(top), at(bottom))
        middle = (ends[0] + ends[1] + heights[0] + heights[1]) / 4
        size = [abs(ends[0][0] - ends[1][0]) / 2, abs(heights[0][1] - heights[1][1]) / 2]
        return {"at": [float(v) for v in middle], "size": [float(v) for v in size]}

    face = {bone: feature(*indices) for bone, indices in EYE_MARKS.items()}
    face["Boca"] = feature(*MOUTH_MARKS)
    # The landmarks only know real faces: on a painted one they fall about each feature, so they go to the shape they fell on.
    for bone, spot in face.items():
        cx, cy = (spot["at"][0] - lo[0]) * per_metre, (hi[1] - spot["at"][1]) * per_metre
        mouth = bone == "Boca"
        # From the lower lip: a moustache lies just over a mouth.
        if mouth:
            cy += spot["size"][1] * per_metre * .8
        reach = spot["size"][1] * 1.3 if mouth else spot["size"][0] * 1.3
        widest = int(spot["size"][0] * per_metre * 1.5) if mouth else None
        shape = painted_shape(picture, int(cx), int(cy), int(reach * per_metre), dark=.35 if mouth else .5, widest=widest)
        if mouth and not shape:
            shape = mouth_below_eyes(picture, face, lo, hi, per_metre, cy, widest)
        if shape:
            x, y, half_w, half_h = shape
            z = float(depth[max(int(y) - 6, 0):int(y) + 7, max(int(x) - 6, 0):int(x) + 7].max())
            face[bone] = {"at": [float(lo[0] + x / per_metre), float(hi[1] - y / per_metre), z], "size": [half_w / per_metre, half_h / per_metre]}
    return keep_face(face, kept, image, lo, hi, per_metre, rigged)


def keep_face(face: dict, kept: Path, image: Image.Image, lo, hi, per_metre: float, rigged: Path) -> dict:
    """Writes what was found, and the picture with its boxes to check it by eye."""
    kept.write_text(json.dumps(face, indent=1))
    check = np.asarray(image).copy()
    for spot in face.values():
        x, y = int((spot["at"][0] - lo[0]) * per_metre), int((hi[1] - spot["at"][1]) * per_metre)
        rx, ry = int(spot["size"][0] * per_metre), int(max(spot["size"][1], .002) * per_metre)
        check[y - ry:y + ry, [max(x - rx, 0), x + rx]] = (255, 0, 80)
        check[[y - ry, y + ry], max(x - rx, 0):x + rx] = (255, 0, 80)
    Image.fromarray(check).save(rigged.with_suffix(".face.png"))
    return face


def shave(texture: Image.Image, positions, triangles, uvs, mouth: dict) -> Image.Image:
    """A copy of the texture without a moustache: what is not skin between the mouth and the nose, painted the colour of the cheeks."""
    painted = np.array(texture, dtype=np.float32) / 255
    height, width = painted.shape[:2]
    at, (half_w, half_h) = np.array(mouth["at"]), mouth["size"]
    wide = half_w * SHAVE_WIDE
    low, high = at[1] + half_h + SHAVE_GAP, at[1] + half_h + half_w * SHAVE_TALL
    middle = positions[triangles].mean(axis=1)
    level = (middle[:, 1] > low) & (middle[:, 1] < high) & (middle[:, 2] > at[2] - PULL_DEPTH)
    cheeks = triangles[level & (np.abs(middle[:, 0] - at[0]) > wide) & (np.abs(middle[:, 0] - at[0]) < wide * 1.5)]
    texel = lambda uv: painted[np.clip((uv[..., 1] % 1 * height).astype(int), 0, height - 1), np.clip((uv[..., 0] % 1 * width).astype(int), 0, width - 1)]
    skin = np.median(texel(uvs[cheeks].mean(axis=1)), axis=0)
    xs, ys = positions[triangles][:, :, 0], positions[triangles][:, :, 1]
    touching = (xs.min(axis=1) < at[0] + wide) & (xs.max(axis=1) > at[0] - wide) & (ys.min(axis=1) < high) & (ys.max(axis=1) > low)
    for triangle in triangles[touching & (middle[:, 2] > at[2] - PULL_DEPTH)]:
        x, y = uvs[triangle, 0] % 1 * width, uvs[triangle, 1] % 1 * height
        area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0])
        if abs(area) < 1e-9:
            continue
        gx, gy = np.meshgrid(np.arange(int(x.min()), int(x.max()) + 2), np.arange(int(y.min()), int(y.max()) + 2))
        gx, gy = np.clip(gx, 0, width - 1), np.clip(gy, 0, height - 1)
        a = ((x[1] - gx - .5) * (y[2] - gy - .5) - (x[2] - gx - .5) * (y[1] - gy - .5)) / area
        b = ((x[2] - gx - .5) * (y[0] - gy - .5) - (x[0] - gx - .5) * (y[2] - gy - .5)) / area
        c = 1 - a - b
        px, py = a * positions[triangle[0], 0] + b * positions[triangle[1], 0] + c * positions[triangle[2], 0], a * positions[triangle[0], 1] + b * positions[triangle[1], 1] + c * positions[triangle[2], 1]
        inside = (a >= -.02) & (b >= -.02) & (c >= -.02) & (np.abs(px - at[0]) < wide) & (py > low) & (py < high)
        painted[gy[inside], gx[inside]] = skin
    return Image.fromarray((painted * 255).astype(np.uint8))


def convert(rigged: Path, name: str, display: str, scale: float, clean_shaven: bool = False):
    """
    The new GLB's bytes and the character file for it. `scale` is the game's entity scale (src/bed.ts);
    `clean_shaven` takes off a moustache the model came with, without paying for another model.
    """
    gltf, blob = read_glb(rigged.read_bytes())
    primitive = gltf["meshes"][0]["primitives"][0]
    attributes = primitive["attributes"]
    positions = accessor(gltf, blob, attributes["POSITION"])
    normals = accessor(gltf, blob, attributes["NORMAL"])
    uvs = accessor(gltf, blob, attributes["TEXCOORD_0"])
    joints = accessor(gltf, blob, attributes["JOINTS_0"]).astype(int)
    weights = accessor(gltf, blob, attributes["WEIGHTS_0"])
    indices = accessor(gltf, blob, primitive["indices"]).astype(np.uint32).reshape(-1)
    skin = gltf["skins"][0]
    names = [gltf["nodes"][j]["name"] for j in skin["joints"]]
    binds = accessor(gltf, blob, skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    where = {n: np.linalg.inv(b)[:3, 3] for n, b in zip(names, binds)}

    # Meshy's Left is the character's left, +x when the face looks along +z.
    if where["LeftArm"][0] < 0:
        raise SystemExit("Expected the character's left arm on +x, facing +z.")
    # Merge the weights into the game's bones, keeping the four strongest of each vertex.
    target = np.array([BONES.index(MERGE[n]) for n in names])
    merged = np.zeros((len(positions), len(BONES)))
    np.add.at(merged, (np.repeat(np.arange(len(positions)), 4), target[joints].reshape(-1)), weights.reshape(-1))
    order = np.argsort(-merged, axis=1)[:, :4]
    new_weights = np.take_along_axis(merged, order, 1)
    new_weights /= np.maximum(new_weights.sum(axis=1, keepdims=True), 1e-9)
    dominant = order[:, 0]

    # Lower the arms: the whole chain turns round the shoulder, baked into the mesh.
    pose = np.tile(np.eye(4), (len(BONES), 1, 1))
    joint_at = {b: None for b in BONES}
    for side, sign in (("L", 1), ("R", -1)):
        prefix = "Left" if side == "L" else "Right"
        shoulder, elbow, wrist = where[f"{prefix}Arm"], where[f"{prefix}ForeArm"], where[f"{prefix}Hand"]
        v = wrist - shoulder
        turn = rotate_z(sign * ARM_REST_DEGREES - np.degrees(np.arctan2(v[0], -v[1])), shoulder)
        for bone in (f"Brazo.{side}", f"Antebrazo.{side}", f"Mano.{side}"):
            pose[BONES.index(bone)] = turn
        move = lambda p: (turn @ np.append(p, 1))[:3]
        joint_at[f"Brazo.{side}"], joint_at[f"Antebrazo.{side}"], joint_at[f"Mano.{side}"] = shoulder, move(elbow), move(wrist)
        joint_at[f"Pierna.{side}"] = where[f"{prefix}UpLeg"]
        joint_at[f"Espinilla.{side}"] = where[f"{prefix}Leg"]
        joint_at[f"Tobillo.{side}"] = where[f"{prefix}Foot"]
    joint_at["Cuerpo"] = np.zeros(3)
    joint_at["Cabeza"] = where["Head"]
    blend = (pose[order] * new_weights[:, :, None, None]).sum(axis=1)
    homogeneous = np.c_[positions, np.ones(len(positions))]
    positions = np.einsum("nij,nj->ni", blend, homogeneous)[:, :3]
    triangles = indices.reshape(-1, 3)
    normals = smooth_normals(positions, triangles)

    # The texture, and the face painted on it.
    texture = texture_of(gltf, blob)
    pixels = np.asarray(texture, dtype=np.float32) / 255
    face = find_face(rigged, positions, triangles, uvs, pixels, positions[dominant == BONES.index("Cabeza")])

    if clean_shaven:
        texture = shave(texture, positions, triangles, uvs, face["Boca"])
        pixels = np.asarray(texture, dtype=np.float32) / 255

    # The mouth pulls on the vertices round it, out of what the head holds.
    head_bone = BONES.index("Cabeza")
    at = np.array(face["Boca"]["at"])
    reach = np.array(face["Boca"]["size"]) * 1.3
    reach[1] = max(reach[1], reach[0] * .6)
    distance = np.hypot(*((positions[:, :2] - at[:2]) / reach).T)
    t = np.clip((distance - MOUTH_PULL[0]) / (MOUTH_PULL[1] - MOUTH_PULL[0]), 0, 1)
    pull = (1 - t * t * (3 - 2 * t)) * (positions[:, 2] > at[2] - PULL_DEPTH) * (dominant == head_bone)
    merged[:, BONES.index("Boca")] = pull * merged[:, head_bone]
    merged[:, head_bone] *= 1 - pull
    joint_at["Boca"] = at
    for eye in EYES:
        joint_at[eye] = np.array(face[eye]["at"])
    # Which way the face looks at each eye, and what colour it is round them: an eyelid is that skin.
    centre_uv = uvs[triangles].mean(axis=1)
    centre_at = positions[triangles].mean(axis=1)
    corners = positions[triangles]
    surface = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0]), axis=1)
    turns, around = {}, np.zeros(len(triangles), dtype=bool)
    for eye in EYES:
        spot, size = np.array(face[eye]["at"]), np.array(face[eye]["size"]) * 1.3
        # A painted eye can lie on one flat triangle: the nearest vertices of the face say which way it looks.
        front = np.nonzero((positions[:, 2] > spot[2] - PULL_DEPTH) & (dominant == head_bone))[0]
        nearest = front[np.argsort(np.linalg.norm(positions[front, :2] - spot[:2], axis=1))[:EYE_NORMAL_VERTICES]]
        n = normals[nearest].mean(axis=0)
        n /= np.linalg.norm(n)
        turn = np.array([-n[1], n[0], 0, 1 + n[2]])
        turns[eye] = turn / np.linalg.norm(turn)
        ring = np.hypot(*((centre_at[:, :2] - spot[:2]) / size).T)
        around |= (ring > 1.2) & (ring < 2.4) & (centre_at[:, 2] > spot[2] - PULL_DEPTH)
    ring_uv = centre_uv[around]
    lid_colour = area_median(pixels[np.clip((ring_uv[:, 1] % 1 * pixels.shape[0]).astype(int), 0, pixels.shape[0] - 1),
                                    np.clip((ring_uv[:, 0] % 1 * pixels.shape[1]).astype(int), 0, pixels.shape[1] - 1)], surface[around])
    order = np.argsort(-merged, axis=1)[:, :4]
    new_joints = order.astype(np.uint8)
    new_weights = np.take_along_axis(merged, order, 1)
    new_weights /= np.maximum(new_weights.sum(axis=1, keepdims=True), 1e-9)

    # Into the game's units: the entity's scale brings the height back; the soles end where every character's do.
    lift = np.array([0, GROUND - positions[:, 1].min() / scale, 0])
    positions = positions / scale + lift
    joint_at = {k: v / scale + lift for k, v in joint_at.items()}

    # Which triangles are clothes an ánima can dye.
    centre = uvs[triangles].mean(axis=1)
    px = np.clip((centre[:, 0] % 1 * texture.width).astype(int), 0, texture.width - 1)
    py = np.clip((centre[:, 1] % 1 * texture.height).astype(int), 0, texture.height - 1)
    colours = pixels[py, px]
    bone_of = dominant[triangles[:, 0]]
    corners = positions[triangles]
    areas = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0]), axis=1)
    upper = np.isin(bone_of, [BONES.index(b) for b in UPPER])
    lower = np.isin(bone_of, [BONES.index(b) for b in LOWER])
    jacket = area_median(colours[upper], areas[upper])
    # A hoodie's hem hangs from the legs: the trousers are what the legs wear that is not the jacket.
    below = lower & (np.linalg.norm(colours - jacket, axis=1) > SKIP_COLOUR * .5)
    trousers = area_median(colours[below], areas[below])
    to_jacket, to_trousers = np.linalg.norm(colours - jacket, axis=1), np.linalg.norm(colours - trousers, axis=1)
    worn = upper | lower
    groups = {"jacket": worn & (to_jacket < SKIP_COLOUR) & (to_jacket <= to_trousers),
              "trousers": worn & (to_trousers < SKIP_COLOUR) & (to_trousers < to_jacket)}
    means = {role: colours[groups[role]].mean(axis=0) for role in groups}
    groups["skin"] = ~(groups["jacket"] | groups["trousers"])
    means["skin"] = np.ones(3)
    hexa = lambda c: "#" + "".join(f"{int(round(v * 255)):02x}" for v in c)
    material_names = {"jacket": f"Ropa de arriba de {display}", "trousers": f"Pantalón de {display}", "skin": f"{display}"}

    # Measures: the foot's box, the hand, the head and where an ánima's pieces go.
    def of(*bones):
        return positions[np.isin(dominant, [BONES.index(b) for b in bones])]

    def side_box(side):
        foot = of(f"Tobillo.{side}")
        lo, hi = foot.min(axis=0), foot.max(axis=0)
        return (lo + hi) / 2, hi - lo

    head = of("Cabeza")
    pivot = joint_at["Cabeza"]
    # The neck is the narrowest slice under the head; a collar sits round what is just below it.
    half_width = lambda y: float(np.abs(positions[(np.abs(positions[:, 1] - y) < .008) & (np.abs(positions[:, 0]) < .2), 0]).max())
    neck_y = min(np.arange(pivot[1] - .06, pivot[1] + .06, .01), key=half_width)
    collar_y = neck_y - .03
    collar_half = min(half_width(collar_y), float(np.abs(head[:, 0]).max())) + .012
    hips_y = joint_at["Pierna.L"][1]
    chest_y = hips_y + (neck_y - hips_y) * .55
    torso = of("Cuerpo")
    level = lambda y: positions[(np.abs(positions[:, 1] - y) < .03) & (np.abs(positions[:, 0]) < .07)]
    # Head parts of ánimas are written for the cast's head: this node maps its eye and its top onto this one's.
    eyes = np.array([joint_at[eye] for eye in EYES]) - pivot
    eye = np.array([np.abs(eyes[:, 0]).mean(), eyes[:, 1].mean(), eyes[:, 2].mean()])
    top = head[:, 1].max() - pivot[1]
    middle = (head[:, 2].max() + head[:, 2].min()) / 2 - pivot[2]
    mount_scale = [eye[0] / CAST_EYE[0], (top - eye[1]) / (CAST_TOP - CAST_EYE[1]), (eye[2] - middle) / CAST_EYE[2]]
    mount_at = [0, eye[1] - CAST_EYE[1] * mount_scale[1], middle]
    fit = {"collar": [collar_half, float(collar_y), collar_half * .95 + abs(float(pivot[2]))],
           "chest": [0, float(chest_y), float(level(chest_y)[:, 2].max())],
           "back": [0, float(hips_y), float(level(hips_y)[:, 2].min())]}

    # The nodes. A game name (`Brazo`, twice) is an empty node holding a bone with a unique name:
    # skinning finds bones by name, the game finds limbs by theirs.
    nodes: list[dict] = []

    def add(name_, translation=None, children=None, **extra):
        nodes.append({"name": name_, **({"translation": [float(v) for v in translation]} if translation is not None else {}), **extra})
        if children:
            nodes[-1]["children"] = children
        return len(nodes) - 1

    bone_nodes = {}

    def limb(wrapper, bone, at, parent_at, children):
        bone_nodes[bone] = add(f"Hueso {bone}", children=children or None)
        return add(wrapper, at - parent_at, [bone_nodes[bone]])

    def anchor(name_, at, size=None):
        return add(name_, at, **({"scale": [float(v) for v in size]} if size is not None else {}))

    top = []
    for side in ("R", "L"):
        centre_foot, size_foot = side_box(side)
        ankle = joint_at[f"Tobillo.{side}"]
        foot = limb("Tobillo", f"Tobillo.{side}", ankle, joint_at[f"Espinilla.{side}"], [anchor("Zapatilla", centre_foot - ankle, size_foot)])
        shin = limb("Espinilla", f"Espinilla.{side}", joint_at[f"Espinilla.{side}"], joint_at[f"Pierna.{side}"], [foot])
        top.append(limb("Pierna", f"Pierna.{side}", joint_at[f"Pierna.{side}"], np.zeros(3), [shin]))
        wrist = joint_at[f"Mano.{side}"]
        palm = of(f"Mano.{side}").mean(axis=0) - wrist
        hand_bone = add(f"Hueso Mano.{side}", wrist - joint_at[f"Antebrazo.{side}"], [anchor("Mano", palm)])
        bone_nodes[f"Mano.{side}"] = hand_bone
        fore = limb("Antebrazo", f"Antebrazo.{side}", joint_at[f"Antebrazo.{side}"], joint_at[f"Brazo.{side}"], [hand_bone])
        top.append(limb("Brazo", f"Brazo.{side}", joint_at[f"Brazo.{side}"], np.zeros(3), [fore]))
    held = [add("Soporte de cabeza", mount_at, scale=[float(v) for v in mount_scale])]
    for eye in EYES:
        held.append(add("Ojo", joint_at[eye] - pivot, rotation=[float(v) for v in turns[eye]]))
    bone_nodes["Boca"] = add("Hueso Boca")
    held.append(add("Boca", joint_at["Boca"] - pivot, [bone_nodes["Boca"]]))
    bone_nodes["Cabeza"] = add("Pivote de cabeza", pivot, held)
    mesh_node = add("Malla", mesh=0, skin=0)
    bone_nodes["Cuerpo"] = add("Cuerpo", children=[*top, bone_nodes["Cabeza"], mesh_node])

    file = GlbFile()
    put = file.put
    a_pos = put(positions.astype(np.float32), "VEC3", 5126, 34962, True)
    a_nor = put(normals.astype(np.float32), "VEC3", 5126, 34962)
    a_uv = put(uvs.astype(np.float32), "VEC2", 5126, 34962)
    a_joint = put(new_joints, "VEC4", 5121, 34962)
    a_weight = put(new_weights.astype(np.float32), "VEC4", 5126, 34962)
    primitives, materials = [], []
    for role in ("jacket", "trousers", "skin"):
        chosen = triangles[groups[role]].reshape(-1).astype(np.uint32)
        primitives.append({"attributes": {"POSITION": a_pos, "NORMAL": a_nor, "TEXCOORD_0": a_uv, "JOINTS_0": a_joint, "WEIGHTS_0": a_weight},
                           "indices": put(chosen.reshape(-1, 1), "SCALAR", 5125, 34963), "material": len(materials)})
        materials.append({"name": material_names[role], "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": .82}})
    # At rest every bone sits at its own point with no rotation.
    bind = np.tile(np.eye(4), (len(BONES), 1, 1))
    for i, bone in enumerate(BONES):
        bind[i, :3, 3] = -joint_at[bone]
    a_bind = put(bind.transpose(0, 2, 1).reshape(-1, 16).astype(np.float32), "MAT4", 5126)
    glb = file.finish(clean_texture(texture, uvs, triangles), bone_nodes["Cuerpo"], nodes, {"name": name, "primitives": primitives}, materials,
                      skins=[{"joints": [bone_nodes[b] for b in BONES], "inverseBindMatrices": a_bind, "skeleton": bone_nodes["Cuerpo"]}])

    # The character file: where the joints are, and boxes that stand for the body in tests.
    box = lambda points, at: {"position": [round(float(v), 4) for v in (points.min(axis=0) + points.max(axis=0)) / 2 - at],
                              "scale": [round(max(float(v), .001), 4) for v in points.max(axis=0) - points.min(axis=0)]}
    rounded = lambda v: [round(float(c), 4) for c in v]
    leg, arm = joint_at["Pierna.L"], joint_at["Brazo.L"]
    spec = {
        "id": name, "name": display, "glb": f"models/characters/{name}.glb",
        "materials": {role: {"name": material_names[role], "color": hexa(means[role])} for role in ("jacket", "trousers", "skin")},
        "rig": {"head": rounded(pivot), "headScale": [1, 1, 1], "arm": rounded(arm), "leg": rounded(leg),
                "elbow": rounded(joint_at["Antebrazo.L"] - arm), "knee": rounded(joint_at["Espinilla.L"] - leg)},
        "fit": {k: rounded(v) for k, v in fit.items()},
        "lids": {"color": hexa(lid_colour), "size": [
            round(float(np.mean([face[eye]["size"][0] for eye in EYES])) * 2 * LID_SIZE[0] / scale, 4),
            round(float(np.mean([face[eye]["size"][1] for eye in EYES])) * 2 * LID_SIZE[1] / scale, 4),
            round(float(np.mean([face[eye]["size"][0] for eye in EYES])) * 2 * LID_DEPTH / scale, 4)]},
        "parts": [
            {"name": "Torso", "shape": "box", "material": "jacket", "attach": "body", **box(torso, np.zeros(3))},
            {"name": "Cabeza", "shape": "box", "material": "skin", "attach": "head", **box(head, pivot)},
            {"name": "Ojo", "shape": "box", "material": "skin", "attach": "head", "position": [.05, rounded(head.mean(axis=0) - pivot)[1], .1], "scale": [.02, .02, .02], "mirror": True},
            {"name": "Pierna", "shape": "box", "material": "trousers", "attach": "leg", **box(of("Pierna.L", "Espinilla.L"), leg)},
            {"name": "Zapatilla", "shape": "box", "material": "skin", "attach": "leg", **box(of("Tobillo.L"), leg)},
            {"name": "Brazo", "shape": "box", "material": "jacket", "attach": "arm", **box(of("Brazo.L", "Antebrazo.L", "Mano.L"), arm)},
        ],
    }
    return glb, spec


def convert_creature(model: Path, name: str, display: str, height: float):
    """
    A creature for the game from Meshy's plain model, as its GLB's bytes and its file: standing on the
    ground, `height` metres tall, with the nodes a fight moves a foe by (src/fears.ts): a base on the
    ground and a head holding the whole figure, which wobbles as one piece.
    """
    gltf, blob = read_glb(model.read_bytes())
    primitive = gltf["meshes"][0]["primitives"][0]
    attributes = primitive["attributes"]
    positions = accessor(gltf, blob, attributes["POSITION"])
    uvs = accessor(gltf, blob, attributes["TEXCOORD_0"])
    triangles = accessor(gltf, blob, primitive["indices"]).astype(np.uint32).reshape(-1, 3)
    low, high = positions.min(axis=0), positions.max(axis=0)
    positions = (positions - [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2]) * height / (high[1] - low[1])
    normals = smooth_normals(positions, triangles)
    feet = positions[positions[:, 1] < height * CREATURE_BASE]

    file = GlbFile()
    attributes = {"POSITION": file.put(positions.astype(np.float32), "VEC3", 5126, 34962, True),
                  "NORMAL": file.put(normals.astype(np.float32), "VEC3", 5126, 34962),
                  "TEXCOORD_0": file.put(uvs.astype(np.float32), "VEC2", 5126, 34962)}
    indices = file.put(triangles.reshape(-1, 1), "SCALAR", 5125, 34963)
    material = {"name": display, "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": .82}}
    nodes = [
        {"name": "Malla", "mesh": 0, "translation": [0, -height / 2, 0]},
        {"name": "Cabeza de chicle", "translation": [0, height / 2, 0], "children": [0]},
        {"name": "Charco pringoso", "translation": [0, .01, 0], "scale": [float(v) for v in [np.ptp(feet[:, 0]), .02, np.ptp(feet[:, 2])]]},
        {"name": display, "children": [1, 2]},
    ]
    glb = file.finish(clean_texture(texture_of(gltf, blob), uvs, triangles), 3, nodes, {"name": name, "primitives": [{"attributes": attributes, "indices": indices, "material": 0}]}, [material])
    return glb, {"id": name, "name": display, "glb": f"models/creatures/{name}.glb", "height": height}
