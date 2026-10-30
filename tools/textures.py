"""Real surfaces for the geo places: one folder per texture in public/textures/<id>/.

  fetch   ambientcg|polyhaven <asset> --id <id>   a CC0 material: albedo and normal map (roughness with
                                                  --roughness), downscaled, checked (and fixed) to tile
  photo   <file or Wikimedia Commons URL> --id <id>  a facade, a row of bays, a shop front or a sign from a
                                                  photo: four corners rectify it, or --crop cuts it straight
  panot   square|flor --id <id> --grain <id>      Barcelona's pavement tiles, drawn here (exact pattern)
                                                  over the grain of a fetched material
  list                                            every texture, its real size, files and licence

Each folder holds the game-ready webp files and its own texture.json (files, real size in metres
per tile or per image, source, author, licence, URL): there is no shared manifest, so branches can
add textures without touching the same file. tools/geo.py embeds what a zone uses into
src/geo/<zone>.json. Raw downloads stay in output/textures/raw/ (git-ignored).
docs/environment-styling.md § Real materials explains the contract and the sources allowed.
"""
import argparse
import io
import json
import re
import sys
import zipfile
from datetime import date
from html import unescape
from pathlib import Path
from urllib.parse import unquote

import httpx
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEXTURES = ROOT / "public" / "textures"
RAW = ROOT / "output" / "textures" / "raw"
USER_AGENT = "gerard-35-texture-tool/0.1 (personal game prototype)"
POLYHAVEN = "https://api.polyhaven.com"
AMBIENTCG = "https://ambientcg.com/api/v2/full_json"
COMMONS = "https://commons.wikimedia.org/w/api.php"
CC0 = {"licence": "CC0 1.0", "licence_url": "https://creativecommons.org/publicdomain/zero/1.0/"}
# Licences a shipped photo may carry (the repo and the site are public).
FREE = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? [0-9.]+|own work)$", re.I)
# Game-ready files: at most this many bytes each (the quality steps down until they fit).
MAX_BYTES = 400_000
# A tile whose opposite edges differ by more than this (mean, 0–1) gets its seams blended.
SEAM_LIMIT = 0.06


# ---------------------------------------------------------------- network (tests replace these)

def get(url: str, **params) -> bytes:
    response = httpx.get(url, params=params or None, headers={"User-Agent": USER_AGENT}, timeout=120, follow_redirects=True)
    response.raise_for_status()
    return response.content


def get_json(url: str, **params) -> dict:
    return json.loads(get(url, **params))


# ---------------------------------------------------------------- images

def rgb(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def seam_error(image: Image.Image) -> float:
    """How much a tile's opposite edges differ (0: seamless), compared with neighbouring rows inside it."""
    a = np.asarray(image, dtype=np.float32) / 255
    edges = (np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2
    inside = (np.abs(a[:, 1] - a[:, 2]).mean() + np.abs(a[1] - a[2]).mean()) / 2
    return float(max(0.0, edges - inside))


def make_tileable(image: Image.Image, band: float = 0.2) -> Image.Image:
    """Blends the edges with the same picture shifted by half a tile, whose edges meet seamlessly
    (they were neighbouring pixels); the shifted copy's own seam lies in the middle, where only
    the original shows."""
    a = np.asarray(image, dtype=np.float32)
    h, w = a.shape[:2]
    shifted = np.roll(a, (h // 2, w // 2), axis=(0, 1))
    ramp = lambda n: np.clip(np.minimum(np.arange(n) + 0.5, n - np.arange(n) - 0.5) / (n * band), 0, 1)
    keep = np.outer(ramp(h), ramp(w))[:, :, None] if a.ndim == 3 else np.outer(ramp(h), ramp(w))
    return Image.fromarray(np.clip(a * keep + shifted * (1 - keep), 0, 255).astype(np.uint8))


def square(image: Image.Image, px: int) -> Image.Image:
    """Downscaled so its long side is `px` (never upscaled)."""
    w, h = image.size
    k = min(1.0, px / max(w, h))
    return image.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS) if k < 1 else image


def mean_hex(image: Image.Image) -> str:
    m = np.asarray(image, dtype=np.float32).reshape(-1, 3).mean(axis=0)
    return "#" + "".join(f"{round(v):02x}" for v in m)


def save_webp(image: Image.Image, path: Path, quality: int = 82) -> int:
    """Writes the webp, stepping the quality down until it fits MAX_BYTES; returns its size."""
    for q in range(quality, 39, -6):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=q, method=6)
        if buffer.tell() <= MAX_BYTES or q - 6 < 40:
            path.write_bytes(buffer.getvalue())
            return buffer.tell()
    return 0  # unreachable


def normal_from_height(height: np.ndarray, strength: float) -> Image.Image:
    """OpenGL normal map (green up) from a 0–1 height field that wraps at its edges."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    n = np.dstack((-dx, dy, np.ones_like(height)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).round().astype(np.uint8))


def perspective(image: Image.Image, corners: list[tuple[float, float]], size: tuple[int, int]) -> Image.Image:
    """Rectifies the quad `corners` (top-left, top-right, bottom-right, bottom-left, in source pixels) to `size`."""
    w, h = size
    target = [(0, 0), (w, 0), (w, h), (0, h)]
    # PIL maps each output pixel back to the source: solve the 8 coefficients of that homography.
    rows, rhs = [], []
    for (x, y), (u, v) in zip(target, corners):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.append(v)
    coeffs = np.linalg.solve(np.array(rows, dtype=np.float64), np.array(rhs, dtype=np.float64))
    return image.transform((w, h), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)


# ---------------------------------------------------------------- writing a texture

def write(texture_id: str, info: dict, albedo: Image.Image, normal: Image.Image | None = None,
          rough: Image.Image | None = None, tile: bool = True) -> dict:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", texture_id):
        sys.exit(f"Texture ids are lower-case words joined by hyphens, not {texture_id!r}.")
    out = TEXTURES / texture_id
    out.mkdir(parents=True, exist_ok=True)
    files, report = {}, []
    for name, image in (("albedo", albedo), ("normal", normal), ("roughness", rough)):
        if image is None: continue
        if tile:
            error = seam_error(image)
            if error > SEAM_LIMIT:
                image = make_tileable(image)
                report.append(f"{name} seams blended (edge error {error:.3f})")
        size = save_webp(image, out / f"{name}.webp", 90 if name == "normal" else 82)
        files[name] = f"{name}.webp"
        report.append(f"{name}.webp {image.size[0]}×{image.size[1]} {size // 1024} KB")
    meta = {"id": texture_id, **info, "files": files, "px": list(albedo.size), "mean": mean_hex(albedo), "made": date.today().isoformat()}
    (out / "texture.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"public/textures/{texture_id}/: " + ", ".join(report))
    return meta


def raw_path(name: str) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    return RAW / name


# ---------------------------------------------------------------- fetch (CC0 libraries)

def resolution(px: int) -> str:
    return "1k" if px <= 1024 else "2k"


def fetch_polyhaven(asset: str, px: int, roughness: bool) -> tuple[dict, list]:
    info = get_json(f"{POLYHAVEN}/info/{asset}")
    files = get_json(f"{POLYHAVEN}/files/{asset}")
    res = resolution(px)
    maps = []
    for key in ("Diffuse", "nor_gl", "Rough"):
        if key == "Rough" and not roughness: maps.append(None); continue
        entry = files.get(key, {}).get(res) or next(iter(files.get(key, {}).values()), None)
        if not entry: maps.append(None); continue
        url = entry["jpg"]["url"]
        data = get(url)
        raw_path(Path(url).name).write_bytes(data)
        maps.append(rgb(data))
    size = [round(v / 1000, 3) for v in info.get("dimensions", [])] or None
    source = {"site": "Poly Haven", "asset": asset, "name": info.get("name", asset), "url": f"https://polyhaven.com/a/{asset}",
              "author": ", ".join(info.get("authors", {})) or "Poly Haven", **CC0}
    return {"size_m": size if size and min(size) > 0 else None, "source": source}, maps


def fetch_ambientcg(asset: str, px: int, roughness: bool) -> tuple[dict, list]:
    found = get_json(AMBIENTCG, id=asset, include="downloadData")["foundAssets"]
    if not found:
        sys.exit(f"ambientCG has no asset {asset!r}.")
    a = found[0]
    want = "1K-JPG" if px <= 1024 else "2K-JPG"
    downloads = a["downloadFolders"]["default"]["downloadFiletypeCategories"]["zip"]["downloads"]
    pick = next((d for d in downloads if d["attribute"] == want), None) or downloads[0]
    data = get(pick["fullDownloadPath"])
    raw_path(pick["fileName"]).write_bytes(data)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        def find(suffix):
            name = next((n for n in z.namelist() if n.endswith(suffix)), None)
            return rgb(z.read(name)) if name else None
        maps = [find("_Color.jpg"), find("_NormalGL.jpg"), find("_Roughness.jpg") if roughness else None]
    # ambientCG gives a size in centimetres for some assets, and 0 for the rest.
    dims = [a.get("dimensionX", 0), a.get("dimensionY", 0)]
    source = {"site": "ambientCG", "asset": asset, "name": a.get("displayName", asset), "url": a.get("shortLink", f"https://ambientcg.com/a/{asset}"),
              "author": "ambientCG (Lennart Demes)", **CC0}
    return {"size_m": [d / 100 for d in dims] if min(dims) > 0 else None, "source": source}, maps


def fetch(args) -> None:
    library = {"polyhaven": fetch_polyhaven, "ambientcg": fetch_ambientcg}[args.library]
    info, (albedo, normal, rough) = library(args.asset, args.px, args.roughness)
    if albedo is None:
        sys.exit(f"{args.asset} has no colour map.")
    size = args.size_m or info["size_m"]
    if not size:
        sys.exit(f"{args.library} gives no real size for {args.asset}; pass --size-m (metres the tile covers).")
    meta = {"name": args.name or info["source"]["name"], "kind": "material", "size_m": [float(v) for v in (size * 2)[:2]],
            "source": info["source"], "command": f"tools/textures.py fetch {args.library} {args.asset} --id {args.id}"}
    write(args.id, meta, square(albedo, args.px), square(normal, args.px) if normal else None, square(rough, args.px) if rough else None)


# ---------------------------------------------------------------- photo (facades, bays, shop fronts, signs)

def strip_html(text: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def commons(url: str) -> tuple[bytes, dict]:
    """Downloads a Wikimedia Commons file (page or upload URL) with its author and licence."""
    name = unquote(url.split("File:")[-1] if "File:" in url else url.rstrip("/").split("/")[-1]).split("?")[0]
    page = get_json(COMMONS, action="query", titles=f"File:{name}", prop="imageinfo", iiprop="url|extmetadata", format="json")
    info = next(iter(page["query"]["pages"].values()))
    if "imageinfo" not in info:
        sys.exit(f"Wikimedia Commons has no file {name!r}.")
    ii = info["imageinfo"][0]
    meta = ii.get("extmetadata", {})
    licence = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    source = {"site": "Wikimedia Commons", "name": name, "url": ii.get("descriptionurl", url),
              "author": strip_html(meta.get("Artist", {}).get("value", "")) or "unknown",
              "licence": licence, "licence_url": meta.get("LicenseUrl", {}).get("value", "")}
    return get(ii["url"]), source


def points(text: str) -> tuple[float, float]:
    x, y = text.split(",")
    return float(x), float(y)


def photo(args) -> None:
    if args.source.startswith("http"):
        if "wikimedia.org" not in args.source:
            sys.exit("Only Wikimedia Commons URLs (or local files) can be used: other sites' images may not be shipped.")
        data, source = commons(args.source)
        raw_path(re.sub(r"[^\w.-]", "_", source["name"])).write_bytes(data)
    else:
        path = Path(args.source)
        if not path.exists():
            sys.exit(f"No file {path}.")
        data = path.read_bytes()
        source = {"site": "own photo" if args.licence == "own work" else "file", "name": path.name, "url": args.url or "",
                  "author": args.author or "", "licence": args.licence or "", "licence_url": ""}
    if args.author: source["author"] = args.author
    if args.licence: source["licence"] = args.licence
    if not FREE.match(source["licence"] or ""):
        sys.exit(f"Licence {source['licence']!r} cannot ship in a public repo; use CC0, CC BY, CC BY-SA, public domain or own work.")
    image = rgb(data)
    w_m, h_m = args.size_m
    long_px = args.px
    size = (long_px, max(1, round(long_px * h_m / w_m))) if w_m >= h_m else (max(1, round(long_px * w_m / h_m)), long_px)
    if args.corners:
        if len(args.corners) != 4:
            sys.exit("--corners takes four points: top-left top-right bottom-right bottom-left, as x,y in the photo's pixels.")
        image = perspective(image, [points(c) for c in args.corners], size)
    else:
        if args.crop:
            x, y, w, h = (float(v) for v in args.crop.split(","))
            image = image.crop((round(x), round(y), round(x + w), round(y + h)))
        image = image.resize(size, Image.LANCZOS)
    meta = {"name": args.name or source["name"], "kind": "photo", "size_m": [w_m, h_m], "source": source,
            "command": f"tools/textures.py photo {args.source} --id {args.id}"}
    if args.bays: meta |= {"bays": args.bays, "storeys": args.storeys or 1}
    write(args.id, meta, image, tile=False)


# ---------------------------------------------------------------- panot (drawn here)

def panot_height(kind: str, tile: int, tiles: int) -> np.ndarray:
    """Height field (0–1) of `tiles` × `tiles` panots of `tile` pixels: joints and grooves low, faces high."""
    t = (np.arange(tile) + 0.5) / tile
    u, v = np.meshgrid(t, t)
    # A 20 cm panot: a joint of about 3 mm round it and a bevelled edge.
    edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
    h = np.clip((edge - 0.008) / 0.025, 0, 1) ** 0.6
    if kind == "square":
        # Four pastilles: raised squares split by a cross-shaped groove about 1 cm wide.
        cu, cv = np.abs(u - 0.5), np.abs(v - 0.5)
        groove = np.clip((np.minimum(cu, cv) - 0.022) / 0.018, 0, 1)
        h = np.minimum(h, 0.35 + 0.65 * groove)
    elif kind == "flor":
        # The flower of Barcelona: a central disc and four on the diagonals, each ringed by a sunken
        # groove (negative relief); where the rings cross, the groove runs on.
        ring = np.zeros_like(u)
        for cx, cy, r in ((0.5, 0.5, 0.125), (0.31, 0.31, 0.105), (0.69, 0.31, 0.105), (0.31, 0.69, 0.105), (0.69, 0.69, 0.105)):
            d = np.hypot(u - cx, v - cy)
            ring = np.maximum(ring, np.clip(1 - np.abs(d - r - 0.03) / 0.03, 0, 1))
        centre = np.hypot(u - 0.5, v - 0.5) < 0.125
        ring[centre] = 0
        h = np.minimum(h, 1 - 0.75 * np.clip(ring * 1.6, 0, 1))
    else:
        sys.exit(f"Unknown panot {kind!r}: square or flor.")
    return np.tile(h, (tiles, tiles))


def panot(args) -> None:
    tile_px = args.px // args.tiles
    height = panot_height(args.kind, tile_px, args.tiles)
    size = height.shape[0]
    grain_meta = json.loads((TEXTURES / args.grain / "texture.json").read_text())
    grain = Image.open(TEXTURES / args.grain / grain_meta["files"]["albedo"]).convert("L")
    # The grain keeps its real scale: its tile covers grain size_m, the panot texture tiles × 0.2 m.
    metres = args.tiles * 0.2
    reps = max(1, round(metres / grain_meta["size_m"][0]))
    grain = np.tile(np.asarray(grain.resize((size // reps, size // reps), Image.LANCZOS), dtype=np.float32) / 255, (reps, reps))
    grain = np.pad(grain, ((0, size - grain.shape[0]), (0, size - grain.shape[1])), mode="wrap")
    grain = 1 + (grain - grain.mean()) * args.grain_amount
    base = np.array([int(args.colour[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255
    rng = np.random.default_rng(35)
    # Every panot was laid on its own day: a shade lighter or darker than its neighbours.
    shade = np.kron(1 + rng.normal(0, 0.035, (args.tiles, args.tiles)), np.ones((tile_px, tile_px)))
    dirt = 0.62 + 0.38 * height  # dust collects in the joints and grooves
    albedo = np.clip(base[None, None, :] * (grain * shade * dirt)[:, :, None], 0, 1)
    meta = {"name": args.name or f"Panot {args.kind}", "kind": "material", "size_m": [metres, metres],
            "source": {"site": "drawn by tools/textures.py", "name": f"panot {args.kind}", "url": "",
                       "author": f"gerard-35 (pattern) over {grain_meta['source'].get('name', args.grain)} by {grain_meta['source'].get('author', '')}",
                       **{k: grain_meta["source"].get(k, "") for k in ("licence", "licence_url")}},
            "command": f"tools/textures.py panot {args.kind} --id {args.id} --grain {args.grain}"}
    # Drawn whole tiles wrap by construction (a joint on the edge is not a seam).
    write(args.id, meta, Image.fromarray((albedo * 255).round().astype(np.uint8)), normal_from_height(height, args.strength), tile=False)


# ---------------------------------------------------------------- list

def textures() -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted(TEXTURES.glob("*/texture.json"))]


def list_textures(_args=None) -> None:
    rows = textures()
    if not rows:
        print("No textures yet in public/textures/; fetch one with `just texture-fetch`.")
        return
    print(f"{'id':<16} {'kind':<9} {'metres':<11} {'px':<10} {'KB':>5}  source · licence")
    for t in rows:
        kb = sum((TEXTURES / t["id"] / f).stat().st_size for f in t["files"].values()) // 1024
        extra = f" {t['bays']}×{t['storeys']} bays" if "bays" in t else ""
        size = "×".join(f"{v:g}" for v in t["size_m"])
        print(f"{t['id']:<16} {t['kind']:<9} {size:<11} {'×'.join(map(str, t['px'])):<10} {kb:>5}  "
              f"{t['source'].get('site')} {t['source'].get('asset', t['source'].get('name', ''))} · {t['source'].get('licence')}{extra}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    f = sub.add_parser("fetch", help="a CC0 material from ambientCG or Poly Haven")
    f.add_argument("library", choices=("ambientcg", "polyhaven"))
    f.add_argument("asset", help="the library's asset id, e.g. clay_roof_tiles_02 or Asphalt010")
    f.add_argument("--id", required=True, help="the texture's folder in public/textures/, e.g. teula")
    f.add_argument("--size-m", type=float, nargs="+", help="metres one tile covers (width [height]); Poly Haven gives it")
    f.add_argument("--px", type=int, default=512, help="long side in pixels (default 512; 1024 for wide tiles)")
    f.add_argument("--roughness", action="store_true", help="also write roughness.webp (only if the game uses it)")
    f.add_argument("--name", help="a readable name")
    f.set_defaults(run=fetch)
    p = sub.add_parser("photo", help="a facade, bays, a shop front or a sign from a photo")
    p.add_argument("source", help="a local file or a Wikimedia Commons file URL")
    p.add_argument("--id", required=True)
    p.add_argument("--size-m", type=float, nargs=2, required=True, metavar=("W", "H"), help="real width and height in metres")
    p.add_argument("--corners", nargs="+", help="four x,y points in the photo: top-left top-right bottom-right bottom-left")
    p.add_argument("--crop", help="x,y,w,h in the photo's pixels, when it is already straight")
    p.add_argument("--bays", type=int, help="an atlas of real bays: how many across")
    p.add_argument("--storeys", type=int, help="...and how many storeys high")
    p.add_argument("--px", type=int, default=1024, help="long side in pixels (default 1024; 2048 only for one signature facade)")
    p.add_argument("--author"); p.add_argument("--licence", help="CC0, CC BY 4.0, CC BY-SA 4.0, public domain or own work")
    p.add_argument("--url", help="where the photo comes from, for a local file"); p.add_argument("--name")
    p.set_defaults(run=photo)
    n = sub.add_parser("panot", help="Barcelona's pavement tiles, drawn over a fetched grain")
    n.add_argument("kind", choices=("square", "flor"))
    n.add_argument("--id", required=True)
    n.add_argument("--grain", required=True, help="a fetched texture whose grain shows through, e.g. formigo")
    n.add_argument("--grain-amount", type=float, default=0.5, help="how strongly the grain's stains show (0–1)")
    n.add_argument("--colour", default="#a5a49e", help="the cement's colour")
    n.add_argument("--tiles", type=int, default=16, help="panots across the texture (16 × 20 cm = 3.2 m, so stains do not repeat every step)")
    n.add_argument("--px", type=int, default=1024)
    n.add_argument("--strength", type=float, default=6.0, help="how deep the joints read in the normal map")
    n.add_argument("--name")
    n.set_defaults(run=panot)
    sub.add_parser("list", help="every texture with its size and licence").set_defaults(run=list_textures)
    args = parser.parse_args(argv)
    args.run(args)


if __name__ == "__main__":
    main()
