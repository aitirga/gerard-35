"""Put a pet from Meshy (Haru, Yuki) on the game's cat skeleton.

Meshy only rigs two arms and two legs, so a cat comes as one piece. The game moves its cats with its own
gait (src/cat-gait.ts): a body pivot, four legs of two bones each, a head on its neck, two ears and a tail
of four segments, each a node it turns by name (src/cats.ts). This measures that skeleton on the model
(where its paws stand, how high its belly and back are, where its head, ears and tail are), skins the
model to it with soft weights across each joint, and writes the skeleton's measures beside it, so the
gait plants this cat's paws under this cat's hips. The skeleton rests in the gait's standing pose: the
model as Meshy made it is the cat standing still.

Its painted eyes get a node each, turned to the face, where the game puts an eyelid of the fur round
them to blink.
"""
from pathlib import Path

import numpy as np

from character_rig import (GlbFile, accessor, area_median, clean_texture, dark_blobs, front_view, jpeg, read_glb, reatlas,
                           smooth_normals, texture_of)

LEGS = ("lf", "rf", "lh", "rh")
# As src/cat-gait.ts CAT_RIG: how much of its length a leg stands at (forelegs nearly straight, hind legs
# folded in a Z), how its length splits into two bones, and which way its middle joint points.
FOLD = {"f": .909, "h": .811}
UPPER = {"f": .085 / .165, "h": .095 / .185}
BEND = {"lf": 1, "rf": 1, "lh": -1, "rh": -1}
SOFT = .95  # cat-gait.ts solveLeg
TAIL_SEGMENTS = 4
# Where the hip sits between the belly and the back, and the body pivot between them.
HIP_IN_BODY = .27
# How far each joint's weights blend, in parts of what they join.
LEG_BAND, KNEE_BAND, NECK_BAND, TAIL_BAND, EAR_BAND = .22, .3, .12, .25, .3
# Where an ear begins: this far out from the middle of the head, in its widths, and this far down from its
# tip, in the head's heights over the back.
EAR_SIDE, EAR_HEIGHT = .12, .32
# How far round its line the tail holds the surface, in its radii: all of it, then less, to none.
TAIL_REACH = (1.4, 2.0)
# A paw's column reaches this many times its own radius: past it, the fur over a leg stays the body's.
COLUMN = 1.9
BONES = ["Cuerpo de gato", *(f"{part} {leg}" for leg in LEGS for part in ("Pata", "Rodilla")),
         "Cabeza de gato", "Oreja izquierda", "Oreja derecha", *(f"Cola {i + 1}" for i in range(TAIL_SEGMENTS))]
# An eyelid's size against the painted eye it covers, and how deep it is against its width.
LID_SIZE, LID_DEPTH = (1.3, 1.25), .45


def solve_leg(z: float, y: float, bend: int, a: float, b: float):
    """cat-gait.ts solveLeg: the upper bone's angle from straight down and the lower's bend, in radians."""
    length, wanted = a + b, np.hypot(z, y)
    soft, room = SOFT * length, length - SOFT * length - 1e-4
    reach = wanted if wanted <= soft else soft + room * np.tanh((wanted - soft) / room)
    d = max(abs(a - b) + 1e-4, reach)
    toward = np.arctan2(z, -y)
    at_hip = np.arccos(np.clip((a * a + d * d - b * b) / (2 * a * d), -1, 1))
    at_knee = np.arccos(np.clip((a * a + b * b - d * d) / (2 * a * b), -1, 1))
    return toward + bend * at_hip, -bend * (np.pi - at_knee)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def pitch(degrees: float) -> np.ndarray:
    """A rotation about x, as cats.ts turns a leg or the tail (setLocalEulerAngles(x, 0, 0))."""
    a = np.radians(degrees)
    return np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])


def towards(d: np.ndarray) -> np.ndarray:
    """The smallest rotation that turns +y to `d`."""
    d = d / np.linalg.norm(d)
    axis, c = np.cross([0, 1, 0], d), d[1]
    if np.linalg.norm(axis) < 1e-9:
        return np.eye(3) if c > 0 else np.diag([1, -1, -1])
    k = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + k + k @ k / (1 + c)


def quaternion(r: np.ndarray) -> list[float]:
    """A rotation matrix as glTF's (x, y, z, w)."""
    w = np.sqrt(max(1e-12, 1 + r[0, 0] + r[1, 1] + r[2, 2])) / 2
    q = [(r[2, 1] - r[1, 2]) / (4 * w), (r[0, 2] - r[2, 0]) / (4 * w), (r[1, 0] - r[0, 1]) / (4 * w), w]
    return [float(v) for v in np.array(q) / np.linalg.norm(q)]


def measure(positions: np.ndarray, height: float):
    """
    The model standing on the ground facing +z, its paws centred on the origin and `height` to the tips of
    its ears, and the skeleton measured on it: paws, belly, back, head, ears and tail.
    """
    p = positions - [0, positions[:, 1].min(), 0]
    low = p[p[:, 1] < .05 * p[:, 1].max()]
    mid_x, mid_z = np.median(low[:, 0]), (low[:, 2].min() + low[:, 2].max()) / 2
    paws = {}
    for leg in LEGS:
        side = 1 if leg[0] == "l" else -1
        own = low[((low[:, 0] - mid_x) * side > 0) & ((low[:, 2] > mid_z) == (leg[1] == "f"))]
        if len(own) < 10:
            raise SystemExit(f"No {leg} paw on the ground: the model must stand on four legs, facing +z.")
        paws[leg] = own.mean(axis=0)
    centre = np.mean(list(paws.values()), axis=0)
    p = p - [centre[0], 0, centre[2]]
    # The ears: the highest point of the front half (the tail rises behind).
    p *= height / p[p[:, 2] > 0, 1].max()
    low = p[p[:, 1] < .05 * p[:, 1].max()]
    for leg in LEGS:
        side = 1 if leg[0] == "l" else -1
        own = low[(low[:, 0] * side > 0) & ((low[:, 2] > 0) == (leg[1] == "f"))]
        paws[leg] = own.mean(axis=0)
    fore, hind = (paws["lf"][2] + paws["rf"][2]) / 2, (paws["lh"][2] + paws["rh"][2]) / 2
    span = fore - hind
    spread = min(abs(paws[leg][0]) for leg in LEGS)
    # The belly: the underside down the cat's middle, between the fore and the hind legs.
    strip = p[(np.abs(p[:, 0]) < .35 * spread) & (p[:, 1] < p[:, 1].max() * .6)]
    edges = np.linspace(hind + .2 * span, fore - .2 * span, 7)
    belly = float(np.median([strip[(strip[:, 2] >= a) & (strip[:, 2] < b), 1].min() for a, b in zip(edges, edges[1:])
                             if ((strip[:, 2] >= a) & (strip[:, 2] < b)).any()]))
    # The back: the lowest point of the top line between the tail and the head, which may overhang the body.
    edges = np.linspace(hind, fore, 9)
    tops = [p[(p[:, 2] >= a) & (p[:, 2] < b), 1].max() for a, b in zip(edges, edges[1:]) if ((p[:, 2] >= a) & (p[:, 2] < b)).any()]
    back = min(tops)
    hip = belly + HIP_IN_BODY * (back - belly)
    body_y = (belly + back) / 2
    # Each paw's column: how wide the leg is just above the paw.
    radius = {}
    for leg in LEGS:
        ring = p[(p[:, 1] > .25 * belly) & (p[:, 1] < .55 * belly)]
        near = np.hypot(ring[:, 0] - paws[leg][0], ring[:, 2] - paws[leg][2])
        radius[leg] = float(np.percentile(near[near < .6 * spread], 90))

    # The head: over the neck line, from the notch under the chin to where the back meets the skull.
    over = p[(p[:, 1] > back) & (p[:, 2] > hind + .5 * span)]
    nape = over[:, 2].min()
    front_x = .5 * (over[:, 0].max() - over[:, 0].min())
    rows = np.linspace(belly + .3 * (back - belly), back + .4 * (over[:, 1].max() - back), 14)
    profile = [(p[(p[:, 1] >= a) & (p[:, 1] < b) & (np.abs(p[:, 0]) < front_x) & (p[:, 2] > nape), 2].max(), (a + b) / 2)
               for a, b in zip(rows, rows[1:]) if ((p[:, 1] >= a) & (p[:, 1] < b) & (np.abs(p[:, 0]) < front_x) & (p[:, 2] > nape)).any()]
    notch_z, notch_y = min(profile)
    neck_line = {"nape": (float(nape), float(back)), "notch": (float(notch_z), float(notch_y))}
    head = p[over_neck(p, neck_line) > 0]
    head_lo, head_hi = head.min(axis=0), head.max(axis=0)
    # Each ear: the top of its side of the head, down a third of the head's height.
    ears, wide, tall = {}, head_hi[0] - head_lo[0], head_hi[1] - back
    for side, name in ((1, "Oreja izquierda"), (-1, "Oreja derecha")):
        flank = head[head[:, 0] * side > EAR_SIDE * wide]
        tip = flank[np.argmax(flank[:, 1])]
        own = flank[flank[:, 1] > tip[1] - EAR_HEIGHT * tall]
        ears[name] = {"base": np.array([own[:, 0].mean(), tip[1] - EAR_HEIGHT * tall, own[:, 2].mean()]), "tip": tip}
    neck = np.array([0, (notch_y + back) / 2, (notch_z + nape) / 2])

    # The tail: what rises over the back behind the hind legs, as a line of centres from its base up,
    # carried on down the way it comes into the rump, to the body pivot's height, where it is rooted.
    tail = p[(p[:, 1] > back + .03 * height) & (p[:, 2] < hind)]
    if len(tail) < 30:
        raise SystemExit("No tail behind the hind legs: the model's tail must rise clear of its body.")
    rows = np.linspace(tail[:, 1].min(), tail[:, 1].max(), 13)
    line = [tail[(tail[:, 1] >= a) & (tail[:, 1] <= b)].mean(axis=0) for a, b in zip(rows, rows[1:]) if ((tail[:, 1] >= a) & (tail[:, 1] <= b)).sum() > 3]
    line = np.array(line)
    down = line[0] - line[min(2, len(line) - 1)]
    if down[1] < 0:
        line = np.vstack([line[0] + down * (body_y - line[0][1]) / down[1], line])
    tail_radius = float(np.median(gap_to(tail, line)))
    # Points along it every quarter of its length.
    steps = np.r_[0, np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))]
    marks = np.array([[np.interp(t, steps, line[:, k]) for k in range(3)] for t in np.linspace(0, steps[-1], TAIL_SEGMENTS + 1)])
    return p, {"paws": paws, "radius": radius, "fore": fore, "hind": hind, "belly": belly, "back": back, "hip": hip,
               "body_y": body_y, "neck": neck, "neck_line": neck_line, "head_lo": head_lo, "head_hi": head_hi, "ears": ears,
               "tail": marks, "tail_line": line, "tail_radius": tail_radius}


def skeleton(m: dict):
    """The bones' rest: where each one is and how it turns, in the model's frame, and the gait's measures."""
    rest, rig = {}, {"joints": {}, "bones": {}, "bend": dict(BEND)}
    body = np.array([0, m["body_y"], 0])
    rest["Cuerpo de gato"] = (body, np.eye(3))
    rig["bodyY"] = round(float(m["body_y"]), 4)
    for leg in LEGS:
        kind = leg[1]
        joint = np.array([m["paws"][leg][0], m["hip"], m["paws"][leg][2]])
        length = m["hip"] / FOLD[kind]
        a, b = length * UPPER[kind], length * (1 - UPPER[kind])
        hip, knee = solve_leg(0, -m["hip"], BEND[leg], a, b)
        # cats.ts turns a leg by −angle about x: forward positive in the gait is −x rotation.
        turn_hip = pitch(-np.degrees(hip))
        turn_knee = turn_hip @ pitch(-np.degrees(knee))
        rest[f"Pata {leg}"] = (joint, turn_hip)
        rest[f"Rodilla {leg}"] = (joint + turn_hip @ [0, -a, 0], turn_knee)
        rig["joints"][leg] = {"x": round(float(joint[0]), 4), "y": round(float(joint[1] - m["body_y"]), 4), "z": round(float(joint[2]), 4)}
        rig["bones"][leg] = [round(float(a), 4), round(float(b), 4)]
    rest["Cabeza de gato"] = (m["neck"], np.eye(3))
    for name, ear in m["ears"].items():
        rest[name] = (ear["base"], np.eye(3))
    marks = m["tail"]
    for i in range(TAIL_SEGMENTS):
        # Each segment's +y along the tail as it was sculpted; the gait turns it from straight up.
        rest[f"Cola {i + 1}"] = (marks[i], towards(marks[i + 1] - marks[i]))
    rig["tailSegments"] = TAIL_SEGMENTS
    rig["tailSegment"] = round(float(np.linalg.norm(np.diff(marks, axis=0), axis=1).mean()), 4)
    return rest, rig


def weights(p: np.ndarray, m: dict, rest: dict) -> np.ndarray:
    """Each vertex's weight on each bone: body unless a leg, the head, an ear or the tail holds it, blended across each joint."""
    w = np.zeros((len(p), len(BONES)))
    index = {b: i for i, b in enumerate(BONES)}
    body = np.ones(len(p))
    # Legs: under the belly, inside their paw's column; the knee splits the column.
    leg_band = LEG_BAND * m["hip"]
    for leg in LEGS:
        paw, r = m["paws"][leg], m["radius"][leg]
        column = np.hypot(p[:, 0] - paw[0], p[:, 2] - paw[2]) < COLUMN * r
        held = column * smooth((m["belly"] + leg_band - p[:, 1]) / (2 * leg_band))
        knee_y = rest[f"Rodilla {leg}"][0][1]
        band = KNEE_BAND * knee_y
        lower = smooth((knee_y + band - p[:, 1]) / (2 * band))
        w[:, index[f"Rodilla {leg}"]] += held * lower
        w[:, index[f"Pata {leg}"]] += held * (1 - lower)
        body -= held
    body = np.clip(body, 0, 1)
    # The head: over the back, in front of the neck; its ears over its crown.
    neck_band = NECK_BAND * (m["head_hi"][1] - m["head_lo"][1])
    head = smooth((over_neck(p, m["neck_line"]) + neck_band) / (2 * neck_band)) * body
    wide = m["head_hi"][0] - m["head_lo"][0]
    for side, name in ((1, "Oreja izquierda"), (-1, "Oreja derecha")):
        base = m["ears"][name]["base"][1]
        ear_band = EAR_BAND * (m["ears"][name]["tip"][1] - base)
        ear = head * (p[:, 0] * side > EAR_SIDE * wide) * smooth((p[:, 1] - base + ear_band) / (2 * ear_band))
        w[:, index[name]] += ear
        head = head - ear
    w[:, index["Cabeza de gato"]] += head
    body = body - head - w[:, [index["Oreja izquierda"], index["Oreja derecha"]]].sum(axis=1)
    # The tail: behind the hind legs, from its base up, each segment where it lies along the line.
    marks = m["tail"]
    segment = np.linalg.norm(np.diff(marks, axis=0), axis=1).mean()
    tail_band = TAIL_BAND * segment
    behind = p[:, 2] < m["hind"]
    t = along(p, marks)
    # Only what lies round the tail's line: the rump beside its root stays the body's.
    r = m["tail_radius"]
    near = smooth((TAIL_REACH[1] * r - gap_to(p, m["tail_line"])) / ((TAIL_REACH[1] - TAIL_REACH[0]) * r))
    root = behind * near * smooth((p[:, 1] - marks[0][1] + tail_band) / (2 * tail_band)) * np.clip(body, 0, 1)
    s = np.clip(t, 0, TAIL_SEGMENTS - 1e-6)
    k = np.floor(s).astype(int)
    f = s - k
    # Within a band either side of each joint between segments, the two share it.
    share = tail_band / segment
    nxt = np.minimum(k + 1, TAIL_SEGMENTS - 1)
    prv = np.maximum(k - 1, 0)
    to_next = np.where(k < TAIL_SEGMENTS - 1, smooth((f - (1 - share)) / (2 * share)), 0)
    to_prev = np.where(k > 0, smooth((share - f) / (2 * share)), 0)
    own = 1 - to_next - to_prev
    rows = np.arange(len(p))
    for bones, part in ((k, own), (nxt, to_next), (prv, to_prev)):
        np.add.at(w, (rows, np.array([index[f"Cola {b + 1}"] for b in bones])), root * part)
    body = body - root
    w[:, index["Cuerpo de gato"]] += np.clip(body, 0, 1)
    w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-9)
    return w


def over_neck(p: np.ndarray, line: dict) -> np.ndarray:
    """How far above the neck line each point is (negative under it): the line runs from the nape, where the
    back meets the skull, down to the notch under the chin, and on level forward; behind the nape, nothing is head."""
    (nape_z, nape_y), (notch_z, notch_y) = line["nape"], line["notch"]
    t = np.clip((p[:, 2] - nape_z) / (notch_z - nape_z), 0, 1)
    over = p[:, 1] - (nape_y + (notch_y - nape_y) * t)
    return np.where(p[:, 2] < nape_z, np.minimum(over, -(nape_z - p[:, 2]) * 4), over)


def gap_to(p: np.ndarray, line: np.ndarray) -> np.ndarray:
    """How far each point is from a line of points."""
    best = np.full(len(p), np.inf)
    for a, b in zip(line, line[1:]):
        d = b - a
        t = np.clip((p - a) @ d / max(d @ d, 1e-12), 0, 1)
        best = np.minimum(best, np.linalg.norm(p - (a + t[:, None] * d), axis=1))
    return best


def along(p: np.ndarray, marks: np.ndarray) -> np.ndarray:
    """How far along the tail's marks each point lies, in segments (0 at the base); past the ends it goes on."""
    best, where = np.full(len(p), np.inf), np.zeros(len(p))
    for i in range(len(marks) - 1):
        a, d = marks[i], marks[i + 1] - marks[i]
        t = np.clip((p - a) @ d / (d @ d), -.5 if i == 0 else 0, 1.5 if i == len(marks) - 2 else 1)
        gap = np.linalg.norm(p - (a + t[:, None] * d), axis=1)
        closer = gap < best
        best[closer], where[closer] = gap[closer], i + t[closer]
    return where


def find_eyes(p, triangles, uvs, pixels, normals, m):
    """
    The two painted eyes on the head's front, seen from the front: the pair of dark ovals alike in size,
    level and either side of the middle. Each as where it is, how big, which way the face looks there,
    and the colour of the fur round both.
    """
    lo, hi = m["head_lo"], m["head_hi"]
    picture, depth, per_metre = front_view(p, triangles, uvs, pixels, lo, hi, 600)
    height, width = picture.shape[:2]
    face = picture.mean(axis=2)[np.isfinite(depth)]
    blobs = [b for b in dark_blobs(picture, limit=np.percentile(face, 1.5) + .05, step=2)
             if b["area"] > .0001 * height * width and b["full"] > .5 and .4 < b["h"] / b["w"] < 3]
    best, score = None, np.inf
    for i, one in enumerate(blobs):
        for other in blobs[i + 1:]:
            left, right = sorted((one, other), key=lambda b: b["x"])
            apart = right["x"] - left["x"]
            if not .15 * width < apart < .7 * width or max(one["area"], other["area"]) > 1.6 * min(one["area"], other["area"]):
                continue
            off = abs(left["y"] - right["y"]) / apart + abs((left["x"] + right["x"]) / 2 - width / 2) / width
            if off < .3 and off < score:
                best, score = (left, right), off
    if not best:
        raise SystemExit("No pair of painted eyes on the head's front.")
    eyes, rings = [], np.zeros(len(triangles), dtype=bool)
    centres = p[triangles].mean(axis=1)
    for b in best:
        row, col = int(b["y"]), int(b["x"])
        at = np.array([lo[0] + b["x"] / per_metre, hi[1] - b["y"] / per_metre, depth[row, col]])
        size = np.array([b["w"], b["h"]]) / per_metre / 2
        # Which way the face looks there: the nearest vertices' normals.
        nearest = np.argsort(np.linalg.norm(p - at, axis=1))[:24]
        n = normals[nearest].mean(axis=0)
        eyes.append({"at": at, "size": size, "normal": n / np.linalg.norm(n)})
        ring = np.hypot(*((centres[:, :2] - at[:2]) / size).T)
        rings |= (ring > 1.3) & (ring < 2.4) & (centres[:, 2] > at[2] - .02)
    # Left of the picture is the cat's right (it faces the camera): the cat's left eye first, on +x.
    eyes.sort(key=lambda e: -e["at"][0])
    corners = p[triangles[rings]]
    areas = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0]), axis=1)
    uv = uvs[triangles[rings]].mean(axis=1)
    colours = pixels[np.clip((uv[:, 1] % 1 * pixels.shape[0]).astype(int), 0, pixels.shape[0] - 1),
                     np.clip((uv[:, 0] % 1 * pixels.shape[1]).astype(int), 0, pixels.shape[1] - 1)]
    return eyes, area_median(colours, areas)


def convert(model: Path, name: str, display: str, height: float):
    """
    A pet for the game from Meshy's plain model, as its GLB's bytes and its file: `height` to the tips of its
    ears in the cat's own units (the game scales a cat by its entity), on the game's cat skeleton.
    """
    gltf, blob = read_glb(model.read_bytes())
    primitive = gltf["meshes"][0]["primitives"][0]
    attributes = primitive["attributes"]
    raw = accessor(gltf, blob, attributes["POSITION"])
    uvs = accessor(gltf, blob, attributes["TEXCOORD_0"])
    triangles = accessor(gltf, blob, primitive["indices"]).astype(np.uint32).reshape(-1, 3)
    positions, m = measure(raw, height)
    rest, rig = skeleton(m)
    w = weights(positions, m, rest)
    normals = smooth_normals(positions, triangles)
    texture = texture_of(gltf, blob)
    pixels = np.asarray(texture, dtype=np.float32) / 255
    eyes, fur = find_eyes(positions, triangles, uvs, pixels, normals, m)

    # The nodes: each bone at its rest, under its parent, then the eyes on the head and the mesh.
    parent = {"Cuerpo de gato": None, "Cabeza de gato": "Cuerpo de gato", "Oreja izquierda": "Cabeza de gato",
              "Oreja derecha": "Cabeza de gato", "Cola 1": "Cuerpo de gato",
              **{f"Cola {i + 1}": f"Cola {i}" for i in range(1, TAIL_SEGMENTS)},
              **{f"Pata {leg}": "Cuerpo de gato" for leg in LEGS}, **{f"Rodilla {leg}": f"Pata {leg}" for leg in LEGS}}
    nodes, at = [], {}
    for bone in BONES:
        position, turn = rest[bone]
        up = parent[bone]
        local_at, local_turn = (position, turn) if up is None else (rest[up][1].T @ (position - rest[up][0]), rest[up][1].T @ turn)
        node = {"name": bone, "translation": [float(v) for v in local_at]}
        if not np.allclose(local_turn, np.eye(3)):
            node["rotation"] = quaternion(local_turn)
        at[bone] = len(nodes)
        nodes.append(node)
    for bone in BONES:
        children = [at[child] for child, up in parent.items() if up == bone]
        if children:
            nodes[at[bone]]["children"] = sorted(children)
    head_at, head_turn = rest["Cabeza de gato"]
    eye_nodes = []
    for eye, label in zip(eyes, ("izquierdo", "derecho")):
        n = eye["normal"]
        turn = np.array([-n[1], n[0], 0, 1 + n[2]])
        eye_nodes.append(len(nodes))
        nodes.append({"name": f"Ojo {label}", "translation": [float(v) for v in head_turn.T @ (eye["at"] - head_at)],
                      "rotation": [float(v) for v in turn / np.linalg.norm(turn)]})
    nodes[at["Cabeza de gato"]]["children"] = sorted(nodes[at["Cabeza de gato"]].get("children", []) + eye_nodes)
    mesh_node = len(nodes)
    nodes.append({"name": "Malla", "mesh": 0, "skin": 0})
    root = len(nodes)
    nodes.append({"name": display, "children": [at["Cuerpo de gato"], mesh_node]})

    order = np.argsort(-w, axis=1)[:, :4]
    joints = order.astype(np.uint8)
    strengths = np.take_along_axis(w, order, 1)
    strengths /= strengths.sum(axis=1, keepdims=True)
    vmap, faces, atlas_uvs, atlas = reatlas(positions, triangles, uvs, clean_texture(texture, uvs, triangles))
    file = GlbFile()
    part = {"POSITION": file.put(positions[vmap].astype(np.float32), "VEC3", 5126, 34962, True),
            "NORMAL": file.put(normals[vmap].astype(np.float32), "VEC3", 5126, 34962),
            "TEXCOORD_0": file.put(atlas_uvs.astype(np.float32), "VEC2", 5126, 34962),
            "JOINTS_0": file.put(np.ascontiguousarray(joints[vmap]), "VEC4", 5121, 34962),
            "WEIGHTS_0": file.put(strengths[vmap].astype(np.float32), "VEC4", 5126, 34962)}
    mesh = {"name": name, "primitives": [{"attributes": part, "indices": file.put(faces.reshape(-1, 1).astype(np.uint32), "SCALAR", 5125, 34963), "material": 0}]}
    binds = []
    for bone in BONES:
        world = np.eye(4)
        world[:3, :3], world[:3, 3] = rest[bone][1], rest[bone][0]
        binds.append(np.linalg.inv(world))
    a_bind = file.put(np.array(binds).transpose(0, 2, 1).reshape(-1, 16).astype(np.float32), "MAT4", 5126)
    material = {"name": display, "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": .82}}
    glb = file.finish(jpeg(atlas), root, nodes, mesh, [material],
                      skins=[{"joints": [at[b] for b in BONES], "inverseBindMatrices": a_bind, "skeleton": at["Cuerpo de gato"]}])
    hexa = "#" + "".join(f"{int(round(v * 255)):02x}" for v in fur)
    size = np.mean([e["size"] for e in eyes], axis=0)
    spec = {"id": name, "name": display, "glb": f"models/animals/{name}.glb", "height": round(float(height), 4), "rig": rig,
            "lids": {"color": hexa, "size": [round(float(size[0] * 2 * LID_SIZE[0]), 4), round(float(size[1] * 2 * LID_SIZE[1]), 4),
                                             round(float(size[0] * 2 * LID_DEPTH), 4)]}}
    return glb, spec
