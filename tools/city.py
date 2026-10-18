"""Draw Barcelona as the network map (docs/barcelona.md).

  fetch  OpenStreetMap streets, railways, coast, rivers and green areas for the whole map ->
         assets/geo/barcelona/streets.json (simplified, compact; needs network)
  build  assets/geo/barcelona/city.json -> src/geo/barcelona.json, projected to metres on a map
         turned so the coast runs left to right with the sea at the bottom; streets.json ->
         output/city/background.svg, the city drawn in 3D (scripts/city-background.mjs turns it
         into public/maps/barcelona.webp); plus output/city/preview.svg

city.json is drawn by hand (stations, lines, landmarks, places); the city behind them is real.
src/city-map.ts lays the background image under the lines and draws the icons.
"""
import argparse
import json
import math
import sys
import time
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
CITY = ROOT / "assets" / "geo" / "barcelona"
M_PER_DEG_LAT = 110_540
STREETS = CITY / "streets.json"
USER_AGENT = "gerard-35-environment-tool/0.1 (personal game prototype)"
OVERPASS = ("https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter")
# The area is asked in TILES × TILES pieces.
TILES = 5
ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"
# How far the background reaches past the map's extent, as a share of its width and in metres
# down and up: a wide screen shows more than the extent.
WIDE_X, WIDE_Y = .3, 1500
# Road kinds kept, by drawing class; widths (metres, a little wider than real so they read).
ROAD_CLASS = {
    "motorway": "motorway", "trunk": "motorway", "motorway_link": "link", "trunk_link": "link",
    "primary": "primary", "primary_link": "link", "secondary": "secondary", "secondary_link": "link",
    "tertiary": "tertiary", "tertiary_link": "link", "unclassified": "street", "residential": "street",
    "living_street": "street", "pedestrian": "pedestrian",
}
ROAD_WIDTH = {"motorway": 34, "primary": 28, "secondary": 22, "tertiary": 17, "link": 14, "street": 12, "pedestrian": 10}
# The city in 3D: how far round the streets the city is built, and how high the roofs stand.
BUILT_REACH, ROOF = 75, 22
# Streets are cut this much wider out of the blocks so the paving still shows past the walls.
GAP = 18


class Projection:
    """[lat, lon] -> map metres: x to the right along the coast, y down towards the sea."""

    def __init__(self, frame: dict):
        self.lat0, self.lon0 = frame["lat"], frame["lon"]
        self.kx = 111_320 * math.cos(math.radians(self.lat0))
        a = math.radians(frame.get("rotation_deg", 0))
        self.cos, self.sin = math.cos(a), math.sin(a)

    def inverse(self, x: float, y: float) -> tuple[float, float]:
        y = -y
        east, north = x * self.cos + y * self.sin, -x * self.sin + y * self.cos
        return self.lat0 + north / M_PER_DEG_LAT, self.lon0 + east / self.kx

    def __call__(self, lat: float, lon: float) -> list[int]:
        east, north = (lon - self.lon0) * self.kx, (lat - self.lat0) * M_PER_DEG_LAT
        x, y = east * self.cos - north * self.sin, east * self.sin + north * self.cos
        return [round(x), round(-y)]


def wide_extent(extent: dict) -> dict:
    w = extent["x1"] - extent["x0"]
    return {"x0": round(extent["x0"] - w * WIDE_X), "x1": round(extent["x1"] + w * WIDE_X),
            "y0": extent["y0"] - WIDE_Y, "y1": extent["y1"] + WIDE_Y}


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker on points in metres. A closed ring is split at its farthest point first."""
    if len(points) < 3:
        return points
    if points[0] == points[-1]:
        far = max(range(len(points)), key=lambda i: math.dist(points[0], points[i]))
        if far in (0, len(points) - 1):
            return points[:1]
        return simplify(points[:far + 1], tolerance)[:-1] + simplify(points[far:], tolerance)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a], points[b]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1
        far, index = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / length
            if d > far:
                far, index = d, i
        if far > tolerance:
            keep[index] = True
            stack += [(a, index), (index, b)]
    return [p for p, k in zip(points, keep) if k]


def join(lines: list[list]) -> list[list]:
    """Joins ways that share ends into longer lines (coastlines, multipolygon rings)."""
    lines = [list(l) for l in lines if len(l) > 1]
    joined = True
    while joined:
        joined = False
        for i, a in enumerate(lines):
            for j in range(i + 1, len(lines)):
                b = lines[j]
                if a[-1] == b[0]: merged = a + b[1:]
                elif b[-1] == a[0]: merged = b + a[1:]
                elif a[0] == b[0]: merged = a[::-1] + b[1:]
                elif a[-1] == b[-1]: merged = a + b[::-1][1:]
                else: continue
                lines[i] = merged
                del lines[j]
                joined = True
                break
            if joined:
                break
    return lines


def overpass_tile(tile: tuple[float, float, float, float]) -> list[dict] | None:
    """One tile's streets, railways, coast, rivers and green areas, with geometry."""
    box = ",".join(f"{v:.5f}" for v in tile)
    roads = "|".join(ROAD_CLASS)
    query = f"""[out:json][timeout:180];
(
  way["highway"~"^({roads})$"]["tunnel"!~"yes|building_passage"]({box});
  way["railway"~"^(rail|light_rail)$"]["tunnel"!="yes"]({box});
  way["natural"="coastline"]({box});
  way["waterway"="river"]({box});
  way["man_made"~"^(pier|breakwater|groyne)$"]({box});
  wr["leisure"~"^(park|garden|golf_course|nature_reserve)$"]({box});
  wr["landuse"~"^(forest|grass|recreation_ground|cemetery|meadow|village_green)$"]({box});
  wr["natural"~"^(wood|scrub|heath|beach|water)$"]({box});
);
out geom qt;"""
    for attempt in range(3):
        for url in OVERPASS:
            try:
                response = httpx.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=240)
                if response.status_code == 200:
                    return response.json()["elements"]
                print(f"    {url}: HTTP {response.status_code}", file=sys.stderr)
            except (httpx.HTTPError, ValueError) as error:
                print(f"    {url}: {error}", file=sys.stderr)
        time.sleep(15 * (attempt + 1))
    return None


def fetch() -> None:
    city = json.loads((CITY / "city.json").read_text())
    project = Projection(city["frame"])
    built = json.loads((ROOT / "src" / "geo" / "barcelona.json").read_text())
    wide = wide_extent(built["extent"])
    corners = [project.inverse(x, y) for x in (wide["x0"], wide["x1"]) for y in (wide["y0"], wide["y1"])]
    s, n = min(c[0] for c in corners), max(c[0] for c in corners)
    w, e = min(c[1] for c in corners), max(c[1] for c in corners)
    box = f"{s:.4f},{w:.4f},{n:.4f},{e:.4f}"
    # Asked tile by tile: Overpass gives up (504) on the whole area at once. Each tile is kept
    # in output/city/osm/, so running it again only asks for the tiles still missing.
    cache = ROOT / "output" / "city" / "osm"
    cache.mkdir(parents=True, exist_ok=True)
    print(f"Fetching OpenStreetMap for {box} in {TILES * TILES} tiles…")
    seen: dict[tuple, dict] = {}
    missing = 0
    for i in range(TILES):
        for j in range(TILES):
            tile = (s + (n - s) * i / TILES, w + (e - w) * j / TILES, s + (n - s) * (i + 1) / TILES, w + (e - w) * (j + 1) / TILES)
            path = cache / f"tile-{i}-{j}.json"
            if path.exists():
                elements = json.loads(path.read_text())
            else:
                elements = overpass_tile(tile)
                if elements is None:
                    missing += 1
                    continue
                path.write_text(json.dumps(elements, separators=(",", ":")))
                time.sleep(2)
            print(f"  tile {i * TILES + j + 1}/{TILES * TILES}: {len(elements)} features")
            for el in elements:
                seen[(el["type"], el["id"])] = el
    if missing:
        sys.exit(f"{missing} tiles could not be fetched (Overpass busy); run it again to fetch only those. Nothing written yet.")
    elements = list(seen.values())

    # Stored in 1e-5 degrees from the frame's centre (about a metre), simplified in metres.
    lat0, lon0 = city["frame"]["lat"], city["frame"]["lon"]
    kx = 111_320 * math.cos(math.radians(lat0))
    def compact(geometry: list[dict], tolerance: float = 3) -> list[int]:
        metres = [((p["lon"] - lon0) * kx, (p["lat"] - lat0) * M_PER_DEG_LAT) for p in geometry]
        flat = []
        for x, y in simplify(metres, tolerance):
            flat += [round(y / M_PER_DEG_LAT * 1e5), round(x / kx * 1e5)]
        return flat
    def outers(e: dict) -> list[list[dict]]:
        if e["type"] == "way":
            return [e["geometry"]] if "geometry" in e else []
        rings = join([[(p["lat"], p["lon"]) for p in m["geometry"]] for m in e.get("members", [])
                      if m.get("role") in ("outer", "") and m.get("geometry")])
        return [[{"lat": a, "lon": b} for a, b in r] for r in rings]

    data = {"attribution": ATTRIBUTION, "fetched": date.today().isoformat(), "bbox": box, "origin": [lat0, lon0],
            "unit": "1e-5 degrees from origin, [lat, lon] pairs",
            "roads": {c: [] for c in ROAD_WIDTH}, "rail": [], "coast": [], "rivers": [], "piers": [],
            "green": [], "wood": [], "beach": [], "water": []}
    coast = []
    for e in elements:
        t = e.get("tags", {})
        if e["type"] == "node":
            continue
        if "highway" in t and e["type"] == "way":
            data["roads"][ROAD_CLASS[t["highway"]]].append(compact(e["geometry"]))
        elif "railway" in t and e["type"] == "way":
            data["rail"].append(compact(e["geometry"], 6))
        elif t.get("natural") == "coastline":
            coast.append([(p["lat"], p["lon"]) for p in e["geometry"]])
        elif t.get("waterway") == "river":
            data["rivers"].append(compact(e["geometry"], 8))
        elif "man_made" in t and e["type"] == "way":
            data["piers"].append(compact(e["geometry"]))
        else:
            kind = ("wood" if t.get("landuse") == "forest" or t.get("natural") in ("wood", "scrub", "heath") or t.get("leisure") == "nature_reserve"
                    else "beach" if t.get("natural") == "beach" else "water" if t.get("natural") == "water" else "green")
            for ring in outers(e):
                if len(ring) > 3:
                    data[kind].append(compact(ring, 6))
    data["coast"] = [compact([{"lat": a, "lon": b} for a, b in line]) for line in join(coast)]
    STREETS.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    counts = ", ".join(f"{len(v)} {k}" for k, v in data["roads"].items())
    print(f"Wrote {STREETS.relative_to(ROOT)} ({STREETS.stat().st_size // 1024} KB): {counts}; "
          f"{len(data['coast'])} coast lines, {len(data['green']) + len(data['wood'])} green areas")


def background(project: Projection, wide: dict, out: Path) -> dict | None:
    """The real city in 3D, as one SVG in map metres: land, green, water, and the blocks between
    the streets standing up with their walls in shade. Returns where it goes on the map."""
    if not STREETS.exists():
        print(f"No {STREETS.relative_to(ROOT)}; run `just city-fetch` for the background.")
        return None
    osm = json.loads(STREETS.read_text())
    lat0, lon0 = osm["origin"]
    def pts(flat: list[int]) -> list[list[int]]:
        return [project(lat0 + flat[i] / 1e5, lon0 + flat[i + 1] / 1e5) for i in range(0, len(flat), 2)]
    def d(lines: list[list[int]], close: bool = False) -> str:
        out = []
        for flat in lines:
            p = pts(flat)
            if len(p) > 1:
                out.append("M" + "L".join(f"{x},{y}" for x, y in p) + ("Z" if close else ""))
        return "".join(out)
    W, H = wide["x1"] - wide["x0"], wide["y1"] - wide["y0"]
    rect = f'x="{wide["x0"] - 2000}" y="{wide["y0"] - 2000}" width="{W + 4000}" height="{H + 4000}"'

    # The sea: the longest coastline closed far below the map (land on its left, sea on its right).
    sea = ""
    lines = sorted((pts(c) for c in osm["coast"]), key=len, reverse=True)
    islands = [l for l in lines[1:] if l[0] == l[-1]]
    if lines:
        c = lines[0]
        if c[0][0] > c[-1][0]:
            c = c[::-1]
        far = 60_000
        ring = c + [[c[-1][0] + far, c[-1][1]], [c[-1][0] + far, far], [c[0][0] - far, far], [c[0][0] - far, c[0][1]]]
        sea = "M" + "L".join(f"{x},{y}" for x, y in ring) + "Z"
    island = "".join("M" + "L".join(f"{x},{y}" for x, y in l) + "Z" for l in islands)
    roads = {k: d(v) for k, v in osm["roads"].items()}
    green, wood, water, beach = d(osm["green"], True), d(osm["wood"], True), d(osm["water"], True), d(osm["beach"], True)
    rivers, rail, piers = d(osm["rivers"]), d(osm["rail"]), d(osm["piers"])
    stroke = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
    # The built city: near the streets, minus the streets, parks, water and the sea.
    holes = "".join(f'<path d="{roads[k]}" {stroke} stroke="#000" stroke-width="{ROAD_WIDTH[k] + GAP}"/>' for k in ROAD_WIDTH)
    reach = "".join(f'<path d="{roads[k]}" {stroke} stroke="#fff" stroke-width="{BUILT_REACH * 2}"/>' for k in ("street", "tertiary", "secondary", "pedestrian"))
    mask = (f'<mask id="built" maskUnits="userSpaceOnUse" {rect}><rect {rect} fill="#000"/>{reach}{holes}'
            f'<path d="{rail}" {stroke} stroke="#000" stroke-width="14"/><path d="{green}{wood}{water}{beach}" fill="#000"/>'
            f'<path d="{sea}" fill="#000"/><path d="{rivers}" {stroke} stroke="#000" stroke-width="90"/></mask>')
    walls = "".join(f'<rect {rect} fill="#cfb386" mask="url(#built)" transform="translate(0 {-ROOF * k / 4:.1f})"/>' for k in range(4))
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{wide["x0"]} {wide["y0"]} {W} {H}" width="{W}" height="{H}">',
        f'<defs>{mask}</defs>',
        f'<rect {rect} fill="#eadfc2"/>',
        f'<path d="{wood}" fill="#9cc77a"/><path d="{green}" fill="#b4d98c"/><path d="{beach}" fill="#f5da92"/>',
        f'<path d="{rivers}" {stroke} stroke="#86c3dd" stroke-width="80"/><path d="{water}" fill="#86c3dd"/>',
        # Streets: the paving between blocks, the big roads lighter and wider.
        *(f'<path d="{roads[k]}" {stroke} stroke="#e2d6bc" stroke-width="{ROAD_WIDTH[k] + GAP}"/>' for k in ("street", "pedestrian", "link", "tertiary")),
        f'<path d="{rail}" {stroke} stroke="#b9a88a" stroke-width="12"/>',
        f'<path d="{sea}" fill="#7ec4e0"/><path d="{island}" fill="#eadfc2"/>',
        f'<path d="{sea}" fill="none" stroke="#f5da92" stroke-width="40"/>',
        f'<path d="{piers}" {stroke} stroke="#e2d4b2" stroke-width="30"/>',
        walls,
        f'<rect {rect} fill="#fbf1dc" mask="url(#built)" transform="translate(0 {-ROOF})"/>',
        *(f'<path d="{roads[k]}" {stroke} stroke="#3b2a2030" stroke-width="{ROAD_WIDTH[k] + 10}"/><path d="{roads[k]}" {stroke} stroke="#fffaf0" stroke-width="{ROAD_WIDTH[k]}"/>' for k in ("secondary", "primary", "motorway")),
        "</svg>",
    ]
    out.mkdir(parents=True, exist_ok=True)
    (out / "background.svg").write_text("".join(parts))
    print(f"Background in {(out / 'background.svg').relative_to(ROOT)}; `just city-background` renders it")
    return {**wide, "href": "maps/barcelona.webp"}


def build() -> None:
    city = json.loads((CITY / "city.json").read_text())
    project = Projection(city["frame"])
    line = lambda points: [project(*p) for p in points]
    at = lambda item: dict(zip(("x", "y"), project(*item["at"])))

    districts = [{"id": d["id"], "name": d["name"], "colour": d["colour"], **({"pattern": d["pattern"]} if "pattern" in d else {}), "poly": line(d["poly"])}
                 for d in city["districts"]]
    points = [p for d in districts for p in d["poly"]]
    m = city["frame"].get("margin_m", 800)
    extent = {"x0": min(p[0] for p in points) - m, "y0": min(p[1] for p in points) - m,
              "x1": max(p[0] for p in points) + m, "y1": max(p[1] for p in points) + m}
    # The sea: the coast, closed far below the map.
    coast = line(city["coast"])
    far = 50_000
    sea = coast + [[coast[-1][0] + far, coast[-1][1]], [coast[-1][0] + far, far], [coast[0][0] - far, far], [coast[0][0] - far, coast[0][1]]]
    stations = [{"id": s["id"], "name": s["name"], **at(s)} for s in city["stations"]]
    known = {s["id"] for s in stations}
    missing = [sid for l in city["lines"] for sid in l["stations"] if sid not in known]
    if missing:
        sys.exit(f"Lines name unknown stations: {', '.join(missing)}")

    data = {
        "extent": extent, "coast": coast, "sea": sea,
        "hills": [{"id": h["id"], "name": h["name"], "poly": line(h["poly"])} for h in city["hills"]],
        "rivers": [{"id": r["id"], "name": r["name"], "line": line(r["line"])} for r in city["rivers"]],
        "districts": districts,
        "avenues": [{"id": a["id"], "name": a["name"], "size": a["size"], "line": line(a["line"])} for a in city["avenues"]],
        "landmarks": [{"id": l["id"], "name": l["name"], "icon": l["kind"], **at(l)} for l in city["landmarks"]],
        "places": [{"id": p["id"], "name": p["name"], **at(p)} for p in city["places"]],
        "stations": stations,
        "lines": [{k: l[k] for k in ("id", "name", "kind", "colour", "stations") if k in l} for l in city["lines"]],
    }
    image = background(project, wide_extent(extent), ROOT / "output" / "city")
    if image:
        data["background"] = image
    out = ROOT / "src" / "geo" / "barcelona.json"
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Built {out.relative_to(ROOT)}: {len(districts)} districts, {len(stations)} stations, "
          f"{len(data['lines'])} lines, {len(data['landmarks'])} landmarks, {out.stat().st_size // 1024} KB")
    preview(data, ROOT / "output" / "city")


def preview(data: dict, out: Path) -> None:
    """A rough top-down check of the layers; the real look is src/city-map.ts."""
    out.mkdir(parents=True, exist_ok=True)
    e = data["extent"]
    path = lambda pts, close=True: "M" + "L".join(f"{x},{y}" for x, y in pts) + ("Z" if close else "")
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{e["x0"]} {e["y0"]} {e["x1"] - e["x0"]} {e["y1"] - e["y0"]}" width="1400" font-family="sans-serif">',
             f'<rect x="{e["x0"]}" y="{e["y0"]}" width="{e["x1"] - e["x0"]}" height="{e["y1"] - e["y0"]}" fill="#efe6d2"/>',
             f'<path d="{path(data["sea"])}" fill="#7fb3cf"/>']
    parts += [f'<path d="{path(h["poly"])}" fill="#9cbf87"/>' for h in data["hills"]]
    parts += [f'<path d="{path(d["poly"])}" fill="{d["colour"]}" stroke="#fff" stroke-width="40"/>' for d in data["districts"]]
    parts += [f'<path d="{path(r["line"], False)}" fill="none" stroke="#7fb3cf" stroke-width="60"/>' for r in data["rivers"]]
    stations = {s["id"]: s for s in data["stations"]}
    for l in data["lines"]:
        pts = [[stations[s]["x"], stations[s]["y"]] for s in l["stations"]]
        parts.append(f'<path d="{path(pts, False)}" fill="none" stroke="{l["colour"]}" stroke-width="70" stroke-linejoin="round"/>')
    parts += [f'<text x="{l["x"]}" y="{l["y"]}" font-size="180" text-anchor="middle">{l["name"]}</text>' for l in data["landmarks"] + data["places"]]
    parts.append("</svg>")
    (out / "preview.svg").write_text("\n".join(parts))
    print(f"Preview in {(out / 'preview.svg').relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=("fetch", "build"))
    step = parser.parse_args().step
    fetch() if step == "fetch" else build()


if __name__ == "__main__":
    main()
