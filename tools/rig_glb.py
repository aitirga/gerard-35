"""Rig a static GLB (a Meshy model) for the game: bones from a data file, smooth weights by distance.

Meshy gives a textured mesh with no skeleton, and no automatic rigger handles a creature that is not a
person. This adds one: each bone pivots at a point and carries what lies around a segment, with weights
that fade over its radius so the mesh bends instead of tearing. The game moves the bones itself
(`src/sobremesa.ts`). It also writes a debug copy whose vertices are coloured by bone, for the model lab.

  just rig sobremesa              # assets/models/sobremesa/rig.json
  just rig sobremesa --preview    # also the front view with a grid and the bones, and the weights,
                                  # in output/models/sobremesa/, to place the bones by eye
"""
import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FLOAT, UBYTE, UINT = 5126, 5121, 5125
ARRAY_BUFFER = 34962


def read_glb(path: Path) -> tuple[dict, bytearray]:
    data = path.read_bytes()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise SystemExit(f"{path} is not a GLB.")
    length, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + length])
    bin_length, _ = struct.unpack_from("<II", data, 20 + length)
    return gltf, bytearray(data[28 + length:28 + length + bin_length])


def write_glb(path: Path, gltf: dict, binary: bytearray):
    gltf["buffers"] = [{"byteLength": len(binary)}]
    text = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(binary))
                     + struct.pack("<II", len(text), 0x4E4F534A) + text
                     + struct.pack("<II", len(binary), 0x004E4942) + binary)


def accessor(gltf: dict, binary: bytearray, index: int) -> np.ndarray:
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    dtype = {FLOAT: np.float32, UINT: np.uint32, UBYTE: np.uint8, 5123: np.uint16}[a["componentType"]]
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    return np.frombuffer(binary, dtype=dtype, count=a["count"] * comps, offset=start).reshape(a["count"], comps)


def append(gltf: dict, binary: bytearray, array: np.ndarray, component: int, kind: str, target: int | None = None, bounds=False) -> int:
    binary.extend(b"\0" * (-len(binary) % 4))
    view = {"buffer": 0, "byteOffset": len(binary), "byteLength": array.nbytes}
    if target:
        view["target"] = target
    binary.extend(array.tobytes())
    gltf["bufferViews"].append(view)
    acc = {"bufferView": len(gltf["bufferViews"]) - 1, "componentType": component, "count": len(array), "type": kind}
    if bounds:
        acc["min"], acc["max"] = array.min(0).tolist(), array.max(0).tolist()
    gltf["accessors"].append(acc)
    return len(gltf["accessors"]) - 1


def depth_at(points: np.ndarray, xy, reach=.12) -> float:
    """The mesh's middle depth around a point of the front view."""
    near = np.hypot(points[:, 0] - xy[0], points[:, 1] - xy[1]) < reach
    return float(np.median(points[near, 2])) if near.any() else 0.0


def place(points: np.ndarray, bones: list[dict]):
    """Every bone's pivot and tip in 3D."""
    for bone in bones:
        bone["at"] = np.array([*bone["pivot"], depth_at(points, bone["pivot"])], np.float32)
        tip = bone.get("tip")
        bone["to"] = np.array([*tip, depth_at(points, tip)], np.float32) if tip else bone["at"]


def weights(points: np.ndarray, bones: list[dict], depth_scale=.6) -> np.ndarray:
    """One weight per bone and vertex: full near its segment, fading to nothing at its radius, and
    starting a little below its pivot so the bend sits there. Depth counts less than height and width,
    so a bone carries the whole thickness of what is in front of it. Raíz takes what is left."""
    w = np.zeros((len(points), len(bones)), np.float32)
    scale = np.array([1, 1, depth_scale], np.float32)
    for j, bone in enumerate(bones):
        radius = bone.get("radius")
        if not radius:
            continue
        a, b = bone["at"], bone["to"]
        ab = b - a
        length2 = float(ab @ ab) or 1e-9
        t = np.clip(((points - a) @ ab) / length2, 0, 1)
        d = np.linalg.norm((points - (a + t[:, None] * ab)) * scale, axis=1)
        fade = np.clip((radius - d) / (radius * .45), 0, 1)
        along = (points - a) @ (ab / np.sqrt(length2))
        start = np.clip((along + .08) / .16, 0, 1)
        w[:, j] = (fade * fade * (3 - 2 * fade)) * start
    total = w.sum(1)
    over = total > 1
    w[over] /= total[over, None]
    w[:, 0] += np.clip(1 - w.sum(1), 0, 1)
    return w


def top4(w: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    joints = np.argsort(-w, axis=1)[:, :4]
    picked = np.take_along_axis(w, joints, 1)
    picked /= picked.sum(1, keepdims=True)
    return joints.astype(np.uint8), picked.astype(np.float32)


def rig(spec_path: Path, root: Path = ROOT, log=print) -> Path:
    spec = json.loads(spec_path.read_text())
    gltf, binary = read_glb(root / spec["source"])
    if len(gltf["meshes"]) != 1 or len(gltf["meshes"][0]["primitives"]) != 1:
        raise SystemExit("Only a single mesh with one primitive is supported (Meshy's shape).")
    primitive = gltf["meshes"][0]["primitives"][0]
    points = accessor(gltf, binary, primitive["attributes"]["POSITION"]).astype(np.float32)
    bones = spec["bones"]
    names = [b["name"] for b in bones]
    place(points, bones)
    full = weights(points, bones)
    joints, w = top4(full)

    # Joints: Raíz at the scene's top, each bone a child of its parent, placed by translation only.
    first = len(gltf["nodes"])
    for bone in bones:
        parent = bone.get("parent")
        at = bone["at"] - (bones[names.index(parent)]["at"] if parent else 0)
        gltf["nodes"].append({"name": bone["name"], "translation": [float(v) for v in at]})
    for j, bone in enumerate(bones):
        if bone.get("parent"):
            node = gltf["nodes"][first + names.index(bone["parent"])]
            node.setdefault("children", []).append(first + j)
    mesh_node = next(i for i, n in enumerate(gltf["nodes"]) if "mesh" in n)
    gltf["nodes"][mesh_node]["skin"] = 0
    gltf["nodes"][mesh_node].setdefault("name", "La Sobremesa")
    gltf["scenes"][gltf.get("scene", 0)]["nodes"].append(first)
    inverse = np.stack([np.eye(4, dtype=np.float32) for _ in bones])
    for j, bone in enumerate(bones):
        inverse[j, 3, :3] = -bone["at"]  # column-major: the translation is the last column
    ibm = append(gltf, binary, inverse.reshape(len(bones), 16), FLOAT, "MAT4")
    gltf["skins"] = [{"joints": list(range(first, first + len(bones))), "inverseBindMatrices": ibm, "skeleton": first}]
    primitive["attributes"]["JOINTS_0"] = append(gltf, binary, joints, UBYTE, "VEC4", ARRAY_BUFFER)
    primitive["attributes"]["WEIGHTS_0"] = append(gltf, binary, w, FLOAT, "VEC4", ARRAY_BUFFER)
    gltf.setdefault("asset", {})["generator"] = "gerard-35 tools/rig_glb.py"
    out = root / spec["out"]
    write_glb(out, gltf, binary)

    # The debug copy: every vertex in the colour of the bones that carry it, blended by weight.
    colours = np.array([[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for c in (b.get("colour", "#7d7f73") for b in bones)], np.float32)
    rgb = (w[:, :, None] * colours[joints]).sum(1)
    debug = json.loads(json.dumps(gltf))
    debug_bin = bytearray(binary)
    debug["meshes"][0]["primitives"][0]["attributes"]["COLOR_0"] = append(debug, debug_bin, np.hstack([rgb, np.ones((len(rgb), 1), np.float32)]), FLOAT, "VEC4", ARRAY_BUFFER)
    material = debug["materials"][debug["meshes"][0]["primitives"][0]["material"]]
    material["pbrMetallicRoughness"].pop("baseColorTexture", None)
    write_glb(root / spec["debug"], debug, debug_bin)

    carried = {name: int((full[:, j] > .5).sum()) for j, name in enumerate(names)}
    log(f"Rigged {len(points)} vertices with {len(bones)} bones into {out.relative_to(root)} "
        f"({out.stat().st_size / 1e6:.1f} MB); mostly carried: " + ", ".join(f"{k} {v}" for k, v in carried.items()))
    return out


def splat(points: np.ndarray, colours: np.ndarray, triangles: np.ndarray, size=700, per=6, seed=0):
    """The mesh seen from the front (+z), orthographic, as dense points over its triangles (x, y in -1..1)."""
    rng = np.random.default_rng(seed)
    r1, r2 = rng.random((len(triangles), per, 1)), rng.random((len(triangles), per, 1))
    flip = r1 + r2 > 1
    r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
    def spread(a):
        x, y, z = a[triangles[:, 0]][:, None], a[triangles[:, 1]][:, None], a[triangles[:, 2]][:, None]
        return (x + r1 * (y - x) + r2 * (z - x)).reshape(-1, a.shape[1])
    pts, col = spread(points), spread(colours)
    px = ((pts[:, 0] + 1) / 2 * (size - 1)).astype(int).clip(0, size - 1)
    py = ((1 - (pts[:, 1] + 1) / 2) * (size - 1)).astype(int).clip(0, size - 1)
    order = np.argsort(pts[:, 2])
    image = np.full((size, size, 3), 255, np.uint8)
    image[py[order], px[order]] = (col[order] * 255).astype(np.uint8)
    return image


def preview(spec_path: Path, root: Path = ROOT, log=print):
    """Front views to place the bones by eye: the textured mesh with a grid every 0.1 and the bones, and the weights."""
    import io
    from PIL import Image, ImageDraw
    spec = json.loads(spec_path.read_text())
    out = root / Path(spec["debug"]).parent
    for name, path, textured in (("frente", spec["source"], True), ("pesos-frente", spec["debug"], False)):
        if not (root / path).exists():
            continue
        gltf, binary = read_glb(root / path)
        prim = gltf["meshes"][0]["primitives"][0]
        points = accessor(gltf, binary, prim["attributes"]["POSITION"]).astype(np.float32)
        triangles = accessor(gltf, binary, prim["indices"]).reshape(-1, 3)
        if textured:
            view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
            texture = np.asarray(Image.open(io.BytesIO(bytes(binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]))).convert("RGB")).astype(np.float32) / 255
            uv = accessor(gltf, binary, prim["attributes"]["TEXCOORD_0"])
            tu = (uv[:, 0] * (texture.shape[1] - 1)).astype(int).clip(0, texture.shape[1] - 1)
            tv = (uv[:, 1] * (texture.shape[0] - 1)).astype(int).clip(0, texture.shape[0] - 1)
            colours = texture[tv, tu]
        else:
            colours = accessor(gltf, binary, prim["attributes"]["COLOR_0"])[:, :3]
        size = 700
        image = Image.fromarray(splat(points, colours, triangles, size))
        draw = ImageDraw.Draw(image)
        at = lambda v: ((v[0] + 1) / 2 * (size - 1), (1 - (v[1] + 1) / 2) * (size - 1))
        if textured:
            for t in range(-10, 11):
                q = int((t / 10 + 1) / 2 * (size - 1))
                draw.line([(q, 0), (q, size)], fill=(255, 0, 0) if t == 0 else (200, 200, 255))
                draw.line([(0, q), (size, q)], fill=(255, 0, 0) if t == 0 else (200, 200, 255))
                if t % 2 == 0:
                    draw.text((q + 2, 2), f"{t / 10:.1f}", fill=(0, 0, 0))
                    draw.text((2, q + 2), f"{-t / 10:.1f}", fill=(0, 0, 0))
        for bone in spec["bones"]:
            a = at(bone["pivot"])
            draw.ellipse([a[0] - 4, a[1] - 4, a[0] + 4, a[1] + 4], fill=(0, 0, 0))
            if "tip" in bone:
                draw.line([a, at(bone["tip"])], fill=(0, 0, 0), width=2)
            draw.text((a[0] + 6, a[1] - 6), bone["name"], fill=(0, 0, 0))
        out.mkdir(parents=True, exist_ok=True)
        image.save(out / f"{name}.png")
        log(f"Wrote {(out / f'{name}.png').relative_to(root)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="just rig", description=__doc__.split("\n\n")[0])
    parser.add_argument("model", help="a folder in assets/models/ with rig.json, e.g. sobremesa")
    parser.add_argument("--preview", action="store_true", help="also write front views with the bones and the weights")
    args = parser.parse_args()
    spec = ROOT / "assets/models" / args.model / "rig.json"
    rig(spec)
    if args.preview:
        preview(spec)
