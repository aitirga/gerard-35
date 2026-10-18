"""Turn a real place into a playable environment, from open map data and a zone file.

  fetch  zone.json -> assets/geo/<zone>/osm.json   OpenStreetMap features around the anchor
                                                   (Overpass, or the OSM API if it is busy),
                                                   plus Google Street View / satellite references
                                                   in output/geo/<zone>/google/ when
                                                   GOOGLE_MAPS_API_KEY is set (never committed)
  build  zone.json + osm.json -> src/geo/<zone>.json  grid, footprints, roofs, roads, water,
                                                   trees and places for src/geo-scenery.ts,
                                                   plus output/geo/<zone>/preview.svg (and .png)

A zone without osm.json can be sketched by hand in assets/geo/<zone>/sketch.json (features in
metres from the anchor); with both, sketch features marked "keep" are added on top of the map
data. docs/barcelona.md § Sketched zones.

Zone files live in assets/geo/<zone>/zone.json; docs/environment-styling.md explains every field.
Coordinates in a zone file are metres from the anchor: east_m (+ east) and south_m (+ south).
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "gerard-35-environment-tool/0.1 (personal game prototype)"
OVERPASS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")
OSM_API = "https://api.openstreetmap.org/api/0.6/map.json"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
GOOGLE = "https://maps.googleapis.com/maps/api"
ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"
M_PER_DEG_LAT = 110_540

# Tags worth keeping; everything else is dropped from osm.json.
KEEP = ("building", "highway", "railway", "waterway", "natural", "landuse", "leisure", "place", "amenity", "bridge", "man_made")
# Road widths in metres, by highway=*. Unknown kinds fall back to "service".
ROAD_WIDTH = {
    "motorway": 10, "trunk": 9, "primary": 8, "secondary": 7, "tertiary": 6.5, "unclassified": 5,
    "residential": 5, "living_street": 4.5, "service": 3.5, "pedestrian": 4, "footway": 2.2,
    "cycleway": 2.5, "path": 1.8, "steps": 2, "track": 3,
}
PATHS = {"pedestrian", "footway", "cycleway", "path", "steps", "track"}
BLOCKED_ROADS = {"motorway", "trunk", "motorway_link", "trunk_link"}
# Raster classes, highest priority first. Lower-case classes are walkable.
WALKABLE = set("rpsgb.")


def zone_dir(zone: str) -> Path:
    return ROOT / "assets" / "geo" / zone


def load_zone(zone: str) -> dict:
    path = zone_dir(zone) / "zone.json"
    if not path.exists():
        sys.exit(f"No {path.relative_to(ROOT)}; copy assets/geo/alegia/zone.json and edit it.")
    return json.loads(path.read_text())


class Frame:
    """Anchor-relative metres (east, south) <-> game cells, with the zone's rotation."""

    def __init__(self, zone: dict):
        self.lat0, self.lon0 = zone["anchor"]["lat"], zone["anchor"]["lon"]
        self.kx = 111_320 * math.cos(math.radians(self.lat0))
        self.cell = zone["cell_m"]
        a = math.radians(zone.get("rotation_deg", 0))
        self.cos, self.sin = math.cos(a), math.sin(a)
        self.bounds = b = zone["bounds_m"]
        corners = [self.rotate(e, s) for e in (b["west"], b["east"]) for s in (b["north"], b["south"])]
        self.x0 = min(c[0] for c in corners)
        self.z0 = min(c[1] for c in corners)
        self.width = round((max(c[0] for c in corners) - self.x0) / self.cell)
        self.depth = round((max(c[1] for c in corners) - self.z0) / self.cell)

    def metres(self, lat: float, lon: float) -> tuple[float, float]:
        return (lon - self.lon0) * self.kx, -(lat - self.lat0) * M_PER_DEG_LAT

    def latlon(self, east: float, south: float) -> tuple[float, float]:
        return self.lat0 - south / M_PER_DEG_LAT, self.lon0 + east / self.kx

    def rotate(self, east: float, south: float) -> tuple[float, float]:
        return east * self.cos - south * self.sin, east * self.sin + south * self.cos

    def from_metres(self, east: float, south: float) -> tuple[float, float]:
        """Cell coordinates: cell (i, j) spans i-0.5..i+0.5, as in src/movement.ts."""
        x, z = self.rotate(east, south)
        return (x - self.x0) / self.cell - 0.5, (z - self.z0) / self.cell - 0.5

    def cells(self, lat: float, lon: float) -> tuple[float, float]:
        return self.from_metres(*self.metres(lat, lon))

    def bbox(self, margin: float = 40) -> tuple[float, float, float, float]:
        b = self.bounds
        south, west = self.latlon(b["west"] - margin, b["south"] + margin)
        north, east = self.latlon(b["east"] + margin, b["north"] - margin)
        return south, west, north, east


# ---------------------------------------------------------------- fetch

def geocode(address: str) -> tuple[float, float]:
    response = httpx.get(NOMINATIM, params={"q": address, "format": "jsonv2", "limit": 1},
                         headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    hits = response.json()
    if not hits:
        sys.exit(f"Nominatim found nothing for {address!r}; set anchor.lat/lon by hand.")
    return float(hits[0]["lat"]), float(hits[0]["lon"])


def overpass(bbox: tuple[float, float, float, float]) -> list[dict] | None:
    s, w, n, e = bbox
    query = f"[out:json][timeout:90];(nwr({s},{w},{n},{e}););out geom;"
    for url in OVERPASS:
        try:
            response = httpx.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=120)
            if response.status_code == 200:
                return normalise_overpass(response.json()["elements"])
            print(f"  {url}: HTTP {response.status_code}", file=sys.stderr)
        except (httpx.HTTPError, ValueError) as error:
            print(f"  {url}: {error}", file=sys.stderr)
    return None


def normalise_overpass(elements: list[dict]) -> list[dict]:
    out = []
    for e in elements:
        tags = e.get("tags", {})
        if e["type"] == "node":
            out.append({"id": f"node/{e['id']}", "tags": tags, "at": [e["lat"], e["lon"]]})
        elif e["type"] == "way" and "geometry" in e:
            out.append({"id": f"way/{e['id']}", "tags": tags, "geom": [[p["lat"], p["lon"]] for p in e["geometry"]]})
        elif e["type"] == "relation" and tags.get("type") == "multipolygon":
            rings = [[[p["lat"], p["lon"]] for p in m["geometry"]] for m in e.get("members", [])
                     if m.get("role") == "outer" and "geometry" in m]
            out.append({"id": f"relation/{e['id']}", "tags": tags, "rings": join_rings(rings)})
    return out


def osm_api(bbox: tuple[float, float, float, float]) -> list[dict]:
    s, w, n, e = bbox
    response = httpx.get(OSM_API, params={"bbox": f"{w},{s},{e},{n}"}, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    elements = response.json()["elements"]
    nodes = {x["id"]: x for x in elements if x["type"] == "node"}
    ways = {x["id"]: x for x in elements if x["type"] == "way"}
    geom = lambda way: [[nodes[n]["lat"], nodes[n]["lon"]] for n in way["nodes"] if n in nodes]
    out = []
    for x in elements:
        tags = x.get("tags", {})
        if x["type"] == "node" and tags:
            out.append({"id": f"node/{x['id']}", "tags": tags, "at": [x["lat"], x["lon"]]})
        elif x["type"] == "way":
            out.append({"id": f"way/{x['id']}", "tags": tags, "geom": geom(x)})
        elif x["type"] == "relation" and tags.get("type") == "multipolygon":
            rings = [geom(ways[m["ref"]]) for m in x["members"] if m["type"] == "way" and m.get("role") == "outer" and m["ref"] in ways]
            out.append({"id": f"relation/{x['id']}", "tags": tags, "rings": join_rings(rings)})
    return out


def join_rings(parts: list[list]) -> list[list]:
    """Chains outer member ways end to end; an open chain (cut by the bbox) is closed straight."""
    parts = [p for p in parts if len(p) > 1]
    rings = []
    while parts:
        ring = parts.pop(0)
        grown = True
        while grown and ring[0] != ring[-1]:
            grown = False
            for i, p in enumerate(parts):
                if p[0] == ring[-1]: ring += p[1:]
                elif p[-1] == ring[-1]: ring += p[::-1][1:]
                elif p[-1] == ring[0]: ring = p + ring[1:]
                elif p[0] == ring[0]: ring = p[::-1] + ring[1:]
                else: continue
                parts.pop(i); grown = True; break
        rings.append(ring)
    return rings


def trim(elements: list[dict]) -> list[dict]:
    keep = []
    for e in elements:
        tags = e["tags"]
        if not any(k in tags for k in KEEP) and "addr:housenumber" not in tags:
            continue
        if e["id"].startswith("node/") and not ({"natural", "highway", "amenity", "man_made"} & tags.keys() or "addr:housenumber" in tags):
            continue
        if e["id"].startswith("way/") and len(e.get("geom", [])) < 2:
            continue
        keep.append(e)
    return keep


def google_references(zone: dict, frame: Frame, out: Path) -> None:
    """Street View and satellite pictures for the zone's viewpoints, as private references."""
    out.mkdir(parents=True, exist_ok=True)
    viewpoints = zone.get("reference", {}).get("viewpoints", [])
    links = [f"# {zone['name']} · Google Maps references\n",
             "Open these in a browser to check how the place looks today. Images saved next to this file",
             "are for reference only: Google's terms do not allow shipping them in the game.\n",
             f"- Satellite: https://www.google.com/maps/@{frame.lat0},{frame.lon0},180m/data=!3m1!1e3"]
    for v in viewpoints:
        links.append(f"- {v['name']}: https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={v['lat']},{v['lon']}"
                     f"&heading={v.get('heading', 0)}&pitch={v.get('pitch', 0)}&fov=90")
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if key:
        with httpx.Client(timeout=60) as client:
            for v in viewpoints:
                params = {"location": f"{v['lat']},{v['lon']}", "heading": v.get("heading", 0), "pitch": v.get("pitch", 0),
                          "fov": 90, "size": "640x640", "source": "outdoor", "key": key}
                meta = client.get(f"{GOOGLE}/streetview/metadata", params=params).json()
                if meta.get("status") != "OK":
                    print(f"  Street View {v['name']}: {meta.get('status')}", file=sys.stderr); continue
                (out / f"streetview-{v['name']}.jpg").write_bytes(client.get(f"{GOOGLE}/streetview", params=params).content)
                links.append(f"  - saved streetview-{v['name']}.jpg (captured {meta.get('date', '?')})")
            satellite = client.get(f"{GOOGLE}/staticmap", params={
                "center": f"{frame.lat0},{frame.lon0}", "zoom": 18, "size": "640x640", "scale": 2, "maptype": "satellite", "key": key})
            if satellite.status_code == 200:
                (out / "satellite.png").write_bytes(satellite.content)
                links.append("  - saved satellite.png")
    else:
        links.append("\nSet GOOGLE_MAPS_API_KEY in .env to also download the pictures (Street View Static and Maps Static APIs).")
    (out / "links.md").write_text("\n".join(links) + "\n")


def fetch(zone_id: str) -> None:
    zone = load_zone(zone_id)
    if "lat" not in zone["anchor"]:
        zone["anchor"]["lat"], zone["anchor"]["lon"] = geocode(zone["anchor"]["address"])
        (zone_dir(zone_id) / "zone.json").write_text(json.dumps(zone, indent=2, ensure_ascii=False) + "\n")
        print(f"Anchor geocoded to {zone['anchor']['lat']}, {zone['anchor']['lon']} (saved in zone.json)")
    frame = Frame(zone)
    bbox = frame.bbox()
    print(f"Downloading OpenStreetMap features in {bbox}…")
    elements = overpass(bbox)
    source = "overpass"
    if elements is None:
        print("Overpass is unavailable; using the OSM API bbox call instead.")
        elements, source = osm_api(bbox), "osm-api"
    elements = trim(elements)
    data = {"attribution": ATTRIBUTION, "license": "ODbL-1.0", "source": source, "fetched": date.today().isoformat(),
            "bbox": bbox, "elements": sorted(elements, key=lambda e: e["id"])}
    path = zone_dir(zone_id) / "osm.json"
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Saved {len(elements)} features to {path.relative_to(ROOT)}")
    google_references(zone, frame, ROOT / "output" / "geo" / zone_id / "google")
    print(f"Google Maps references in output/geo/{zone_id}/google/links.md")


# ---------------------------------------------------------------- geometry

def point_in_polygon(x: float, z: float, poly: list) -> bool:
    inside = False
    for (x1, z1), (x2, z2) in zip(poly, poly[1:] + poly[:1]):
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            inside = not inside
    return inside


def segment_distance(x: float, z: float, a: tuple, b: tuple) -> float:
    dx, dz = b[0] - a[0], b[1] - a[1]
    t = 0 if dx == dz == 0 else max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    return math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)


def clip(poly: list, x0: float, z0: float, x1: float, z1: float) -> list:
    """Sutherland-Hodgman against the map rectangle."""
    edges = [(0, x0, 1), (0, x1, -1), (1, z0, 1), (1, z1, -1)]
    for axis, value, sign in edges:
        if not poly: break
        inside = lambda p: (p[axis] - value) * sign >= 0
        out = []
        for a, b in zip(poly, poly[1:] + poly[:1]):
            if inside(b):
                if not inside(a): out.append(cut(a, b, axis, value))
                out.append(b)
            elif inside(a):
                out.append(cut(a, b, axis, value))
        poly = out
    return poly


def cut(a, b, axis, value):
    t = (value - a[axis]) / (b[axis] - a[axis])
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]


def clip_line(line: list, x0: float, z0: float, x1: float, z1: float) -> list[list]:
    """Liang-Barsky on each segment; a line that leaves and re-enters the map becomes several."""
    pieces, current = [], []
    for a, b in zip(line, line[1:]):
        t0, t1, dx, dz = 0.0, 1.0, b[0] - a[0], b[1] - a[1]
        for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dz, a[1] - z0), (dz, z1 - a[1])):
            if p == 0:
                if q < 0: t0, t1 = 1, 0
            elif p < 0: t0 = max(t0, q / p)
            else: t1 = min(t1, q / p)
        if t0 > t1:
            if current: pieces.append(current); current = []
            continue
        start, end = [a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1]
        if not current: current = [start]
        current.append(end)
        if t1 < 1: pieces.append(current); current = []
    if current: pieces.append(current)
    return [piece for piece in pieces if len(piece) > 1]


def area(poly: list) -> float:
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1])) / 2


def hull(points: list) -> list:
    pts = sorted(set(map(tuple, points)))
    if len(pts) < 3: return pts
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def oriented_box(poly: list) -> dict:
    """Minimum-area rectangle around the footprint: the roof is built on it."""
    h = hull(poly)
    best = None
    for a, b in zip(h, h[1:] + h[:1]):
        angle = math.atan2(b[1] - a[1], b[0] - a[0])
        c, s = math.cos(angle), math.sin(angle)
        us = [p[0] * c + p[1] * s for p in h]
        vs = [-p[0] * s + p[1] * c for p in h]
        size = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or size < best[0]:
            u, v = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            best = (size, {"cx": u * c - v * s, "cz": u * s + v * c, "w": max(us) - min(us), "d": max(vs) - min(vs), "angle": angle})
    return {k: round(v, 3) for k, v in best[1].items()}


def rounded(poly: list) -> list:
    return [[round(x, 2), round(z, 2)] for x, z in poly]


def pick(seed: str, options: list):
    return options[int(hashlib.sha1(seed.encode()).hexdigest(), 16) % len(options)]


# ---------------------------------------------------------------- sketch

SKETCH_ATTRIBUTION = "Esquema provisional dibujado a mano (sin datos de OpenStreetMap)"
SKETCH_AREAS = {"square": {"place": "square"}, "grass": {"leisure": "park"}, "water": {"natural": "water"},
                "forest": {"landuse": "forest"}, "parking": {"amenity": "parking"}}


def sketch_elements(sketch: dict, frame: "Frame", keep_only: bool = False) -> list[dict]:
    """Hand-drawn features (metres from the anchor) as the same elements osm.json holds."""
    out = []
    to_geom = lambda points: [list(frame.latlon(e, s)) for e, s in points]
    for f in sketch.get("features", []):
        if keep_only and not f.get("keep"):
            continue
        if "rect" in f:
            e, s, w, d = f["rect"]
            ring = [[e, s], [e + w, s], [e + w, s + d], [e, s + d], [e, s]]
        elif "poly" in f:
            ring = f["poly"] + f["poly"][:1]
        else:
            ring = None
        if "building" in f:
            tags = {"building": f["building"]}
            if "levels" in f: tags["building:levels"] = str(f["levels"])
            if "number" in f: tags["addr:housenumber"] = str(f["number"])
        elif "area" in f:
            tags = dict(SKETCH_AREAS[f["area"]])
        elif "highway" in f:
            tags = {"highway": f["highway"]}
        elif "railway" in f:
            tags = {"railway": f["railway"]}
        else:
            sys.exit(f"Sketch feature {f.get('id')} is not a building, area, highway or railway.")
        if f.get("name"): tags["name"] = f["name"]
        geom = to_geom(f["line"]) if "line" in f else to_geom(ring) if ring else None
        if not geom:
            sys.exit(f"Sketch feature {f.get('id')} needs rect, poly or line.")
        out.append({"id": f"sketch/{f['id']}", "tags": tags, "geom": geom})
    return out


def map_data(zone_id: str, zone: dict, frame: "Frame") -> dict:
    """osm.json, with any kept sketch features on top; or the sketch alone."""
    osm_path, sketch_path = zone_dir(zone_id) / "osm.json", zone_dir(zone_id) / "sketch.json"
    sketch = json.loads(sketch_path.read_text()) if sketch_path.exists() else None
    if osm_path.exists():
        osm = json.loads(osm_path.read_text())
        if sketch: osm["elements"] += sketch_elements(sketch, frame, keep_only=True)
        return osm
    if not sketch:
        sys.exit(f"No {osm_path.relative_to(ROOT)}; run `just geo-fetch {zone_id}` first (or sketch the zone in sketch.json).")
    print(f"No osm.json: building {zone_id} from its sketch ({sketch_path.relative_to(ROOT)}).")
    return {"attribution": SKETCH_ATTRIBUTION, "fetched": sketch.get("drawn", ""), "elements": sketch_elements(sketch, frame)}


# ---------------------------------------------------------------- build

def classify(element: dict) -> str | None:
    t = element["tags"]
    if "building" in t: return "building"
    if t.get("natural") == "water" or t.get("waterway") == "riverbank" or t.get("landuse") == "reservoir": return "water"
    if t.get("waterway") in ("river", "stream", "canal"): return "waterway"
    if t.get("landuse") == "forest" or t.get("natural") in ("wood", "scrub"): return "forest"
    if t.get("leisure") in ("garden", "park") or t.get("landuse") in ("grass", "meadow", "village_green"): return "grass"
    if t.get("place") == "square" or t.get("amenity") == "parking" or (t.get("highway") == "pedestrian" and t.get("area") == "yes"): return "square"
    if t.get("railway") in ("rail", "light_rail", "narrow_gauge"): return "rail"
    if "highway" in t and "geom" in element: return "road"
    return None


def build(zone_id: str) -> None:
    zone = load_zone(zone_id)
    frame = Frame(zone)
    osm = map_data(zone_id, zone, frame)
    W, D, cell = frame.width, frame.depth, frame.cell
    to_cells = lambda geom: [list(frame.cells(lat, lon)) for lat, lon in geom]
    from_m = lambda item: frame.from_metres(item["east_m"], item["south_m"])
    lo, hi = (-0.5, -0.5), (W - 0.5, D - 0.5)

    areas = {"water": [], "forest": [], "grass": [], "square": []}
    roads, buildings, centroids = [], [], {}
    for e in osm["elements"]:
        kind = classify(e)
        if not kind: continue
        polys = [to_cells(r) for r in e.get("rings", [])] or ([to_cells(e["geom"])] if "geom" in e else [])
        # Where a place can point at: the middle of an area, or of a line such as a bridge.
        for poly in polys:
            centroids[e["id"]] = [sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)]
        if kind == "building":
            poly = polys[0][:-1] if polys and polys[0][0] == polys[0][-1] else (polys[0] if polys else [])
            cx, cz = centroids.get(e["id"], (-99, -99))
            if len(poly) < 3 or not (0 <= cx < W and 0 <= cz < D): continue
            if area(poly) < 0: poly.reverse()
            buildings.append(make_building(zone, e, poly, cell))
        elif kind in areas:
            for poly in polys:
                clipped = clip(poly[:-1] if poly[0] == poly[-1] else poly, *lo, *hi)
                if len(clipped) > 2: areas[kind].append({"id": e["id"], "poly": clipped})
        elif kind in ("road", "rail", "waterway"):
            t = e["tags"]
            highway = t.get("highway", "")
            if kind == "rail": width, road_kind = 6, "rail"
            elif kind == "waterway": width, road_kind = 12, "waterway"
            else:
                if highway in ("motorway_junction", "crossing", "bus_stop", "proposed", "construction"): continue
                width = ROAD_WIDTH.get(highway.removesuffix("_link"), ROAD_WIDTH["service"])
                road_kind = "bridge" if t.get("bridge") == "yes" else "motorway" if highway in BLOCKED_ROADS else "path" if highway in PATHS else "road"
            roads.append({"id": e["id"], "kind": road_kind, "highway": highway, "name": t.get("name"),
                          "width": round(width / cell, 2), "line": polys[0] if polys else []})
    # A river drawn only as a line becomes water where no water area covers it.
    if areas["water"]:
        roads = [r for r in roads if r["kind"] != "waterway"]

    raster = [["." for _ in range(W)] for _ in range(D)]
    def paint(cls: str, test) -> None:
        for z in range(D):
            for x in range(W):
                if test(x, z): raster[z][x] = cls
    def in_any(polys):
        boxes = [(p, min(q[0] for q in p), max(q[0] for q in p), min(q[1] for q in p), max(q[1] for q in p)) for p in polys]
        return lambda x, z: any(x0 <= x <= x1 and z0 <= z <= z1 and point_in_polygon(x, z, p) for p, x0, x1, z0, z1 in boxes)
    def near_lines(kinds, extra=0.0):
        # At least 0.75 cells either side, so a thin diagonal path stays connected edge to edge.
        segs = [(a, b, max(r["width"] / 2, 0.75) + extra) for r in roads if r["kind"] in kinds for a, b in zip(r["line"], r["line"][1:])]
        return lambda x, z: any(segment_distance(x, z, a, b) <= w for a, b, w in segs)
    # Painted lowest priority first; later layers win.
    paint("g", in_any([a["poly"] for a in areas["grass"]]))
    paint("F", in_any([a["poly"] for a in areas["forest"]]))
    paint("s", in_any([a["poly"] for a in areas["square"]]))
    paint("W", in_any([a["poly"] for a in areas["water"]]))
    paint("W", near_lines({"waterway"}))
    paint("p", near_lines({"path"}))
    paint("r", near_lines({"road"}))
    paint("R", near_lines({"rail"}, 1))
    paint("M", near_lines({"motorway"}, 1))
    paint("b", near_lines({"bridge"}))
    paint("B", in_any([b["poly"] for b in buildings]))

    # The map edge is always solid.
    grid = ["".join("." if raster[z][x] in WALKABLE and 0 < x < W - 1 and 0 < z < D - 1 else "#" for x in range(W)) for z in range(D)]
    def flood(start: tuple, blocked: set) -> set:
        open_cells = {(x, z) for z, row in enumerate(grid) for x, ch in enumerate(row) if ch == "." and (x, z) not in blocked}
        reach, queue = set(), [start]
        while queue:
            c = queue.pop()
            if c in reach or c not in open_cells: continue
            reach.add(c)
            queue += [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)]
        return reach
    def nearest(px: float, pz: float, cells) -> tuple[int, int]:
        return min(cells, key=lambda c: (c[0] - px) ** 2 + (c[1] - pz) ** 2)

    # The spawn is the open cell nearest to it; places snap to the nearest cell reachable from there.
    spawn = nearest(*from_m(zone["spawn"]), [(x, z) for z, row in enumerate(grid) for x, ch in enumerate(row) if ch == "."])
    reachable = flood(spawn, set())
    places = []
    for place in zone.get("places", []):
        target = centroids[place["osm"]] if "osm" in place else from_m(place)
        x, z = nearest(*target, reachable)
        # Lines are looked at; `to` is a door to another scene; neither: the story answers it.
        places.append({"id": place["id"], "label": place["label"], "lines": place.get("lines", []), "cell": {"x": x, "z": z}}
                      | ({"to": place["to"]} if "to" in place else {}))
    keep_clear = {spawn} | {(p["cell"]["x"], p["cell"]["z"]) for p in places}

    props = scatter_trees(zone, raster, W, D, cell)
    for p in zone.get("props", []):
        x, z = from_m(p)
        prop = {k: v for k, v in p.items() if k not in ("east_m", "south_m")} | {"x": round(x), "z": round(z)}
        if prop["kind"] == "car" and zone.get("rotation_deg", 0) % 180 == 0:
            prop["along"] = "x"  # the zone's streets run east-west, so cars park along x
        props.append(prop)
    props = [p for p in props if all(0 < c[0] < W - 1 and 0 < c[1] < D - 1 and c not in keep_clear for c in prop_cells(p))]
    # Props are solid; anything they cut off from the spawn becomes solid too, so every open cell is reachable.
    blocked = {c for p in props for c in prop_cells(p)}
    reach = flood(spawn, blocked)
    grid = ["".join("." if (x, z) in reach or (x, z) in blocked and ch == "." else "#" for x, ch in enumerate(row)) for z, row in enumerate(grid)]
    stranded = [p["id"] for p in places if (p["cell"]["x"], p["cell"]["z"]) not in reach]

    scene = {
        "id": zone["id"], "name": zone["name"], "region": zone.get("region", ""), "attribution": osm["attribution"],
        "fetched": osm["fetched"], "cell_m": cell, "storey": round(zone.get("storey_m", 3) / cell, 3),
        "zoom": zone.get("zoom", 11), "width": W, "depth": D, "grid": grid, "spawn": {"x": spawn[0], "z": spawn[1]},
        "areas": {k: [rounded(a["poly"]) for a in v] for k, v in areas.items()},
        "roads": [{**r, "line": rounded(piece)} for r in roads if r["kind"] != "waterway" for piece in clip_line(r["line"], *lo, *hi)],
        "buildings": buildings, "props": props, "places": places,
        "labels": [{"text": l["text"], "x": round(from_m(l)[0], 2), "z": round(from_m(l)[1], 2), "width": l.get("width", 4)} for l in zone.get("labels", [])],
        # Named points for the game's own pieces (e.g. where the palace stands), in cells.
        "anchors": {name: {"x": round(from_m(a)[0], 2), "z": round(from_m(a)[1], 2), **({"y": a["y_m"] / cell} if "y_m" in a else {})}
                    for name, a in zone.get("anchors", {}).items()},
    }
    out = ROOT / "src" / "geo" / f"{zone_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not stranded: out.write_text(json.dumps(scene, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Built {out.relative_to(ROOT)}: {W}×{D} cells of {cell} m, {len(buildings)} buildings, {len(roads)} roads, "
          f"{len(props)} props, {len(places)} places, {len(reach)} walkable cells")
    preview(scene, raster, ROOT / "output" / "geo" / zone_id)
    if stranded:
        sys.exit(f"Places cut off from the spawn: {', '.join(stranded)}. Move them in zone.json (see the preview).")


def prop_cells(p: dict) -> list[tuple[int, int]]:
    if p["kind"] == "manhole": return []
    if p["kind"] == "car": return [(p["x"], p["z"]), (p["x"] + 1, p["z"]) if p.get("along") == "x" else (p["x"], p["z"] + 1)]
    return [(p["x"], p["z"])]


def make_building(zone: dict, e: dict, poly: list, cell: float) -> dict:
    t = e["tags"]
    rules = zone.get("styles", {})
    override = zone.get("buildings", {})
    chosen = override.get(f"tag:building={t['building']}", {}) | override.get(e["id"], {})
    style_name = chosen.get("style", "default")
    style = rules.get("default", {}) | rules.get(style_name, {})
    levels = int(float(t.get("building:levels", chosen.get("levels", style.get("levels", 3)))))
    height = float(t["height"]) if "height" in t else levels * zone.get("storey_m", 3)
    return {
        "id": e["id"], "style": style_name, "name": t.get("name"), "number": chosen.get("label", t.get("addr:housenumber")),
        "levels": levels, "height": round(height / cell, 2),
        "roof": chosen.get("roof_kind", t.get("roof:shape", style.get("roof_kind", "hip"))),
        "walls": chosen.get("walls", pick(e["id"], style.get("walls", ["#e8e0d0"]))), "base": style.get("base"), "trim": style.get("trim"),
        "roofColor": style.get("roof"), "facade": chosen.get("facade", style.get("facade", "rendered")),
        "ground": chosen.get("ground", style.get("ground", "masonry")),
        "poly": rounded(poly), "box": oriented_box(poly),
    }


def scatter_trees(zone: dict, raster: list, W: int, D: int, cell: float) -> list[dict]:
    """Trees on forest cells and on the open bank beside water, on a jittered lattice."""
    rules = zone.get("trees", {})
    species = rules.get("species", ["plane"])
    out = []
    def lattice(step_m: float, keep) -> None:
        step = max(2, round(step_m / cell))
        for z in range(1, D - 1, step):
            for x in range(1, W - 1, step):
                jx = x + int(hashlib.sha1(f"{x},{z}".encode()).hexdigest(), 16) % step
                jz = z + int(hashlib.sha1(f"{z},{x}".encode()).hexdigest(), 16) % step
                if jx < W - 1 and jz < D - 1 and keep(jx, jz):
                    out.append({"kind": "tree", "x": jx, "z": jz, "species": pick(f"{jx},{jz}", species), "base": "ground",
                                "scale": round(0.9 + (jx * 7 + jz * 13) % 5 * 0.1, 2)})
    near_water = lambda x, z: any(raster[z + dz][x + dx] == "W" for dz in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)
                                  if 0 <= z + dz < D and 0 <= x + dx < W)
    lattice(rules.get("forest_every_m", 6), lambda x, z: raster[z][x] == "F")
    lattice(rules.get("riverbank_every_m", 7), lambda x, z: raster[z][x] in "g." and near_water(x, z))
    return out


def preview(scene: dict, raster: list, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    colours = {"W": "#5aa6c8", "F": "#4f7a4a", "g": "#9cc07f", "s": "#d8c7a8", "r": "#8a8a8a", "p": "#c8b48a",
               "b": "#b8a98e", "R": "#555", "M": "#333", "B": "#b4643f", ".": "#e6e2d4"}
    s = 6
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {scene["width"] * s} {scene["depth"] * s}" '
             f'width="{scene["width"] * s}" height="{scene["depth"] * s}" font-family="sans-serif">']
    for z, row in enumerate(raster):
        for x, c in enumerate(row):
            fill = colours[c] if scene["grid"][z][x] == "." or c in "WFBRM" else "#bdb6a3"
            parts.append(f'<rect x="{x * s}" y="{z * s}" width="{s}" height="{s}" fill="{fill}"/>')
    for b in scene["buildings"]:
        pts = " ".join(f"{(x + .5) * s:.1f},{(z + .5) * s:.1f}" for x, z in b["poly"])
        parts.append(f'<polygon points="{pts}" fill="{b["roofColor"]}" stroke="#222" stroke-width="1"/>')
        if b["number"]:
            parts.append(f'<text x="{(b["box"]["cx"] + .5) * s:.0f}" y="{(b["box"]["cz"] + .5) * s:.0f}" font-size="11" text-anchor="middle" fill="#fff">{b["number"]}</text>')
    for p in scene["props"]:
        colour = "#2f5d2a" if p["kind"] == "tree" else "#c03" if p["kind"] == "car" else "#fc0"
        parts.append(f'<circle cx="{(p["x"] + .5) * s}" cy="{(p["z"] + .5) * s}" r="{s * .45}" fill="{colour}"/>')
    for i, p in enumerate(scene["places"]):
        parts.append(f'<circle cx="{(p["cell"]["x"] + .5) * s}" cy="{(p["cell"]["z"] + .5) * s}" r="{s * 1.2}" fill="#36c" stroke="#fff"/>'
                     f'<text x="{(p["cell"]["x"] + .5) * s}" y="{(p["cell"]["z"] + .9) * s}" font-size="9" text-anchor="middle" fill="#fff">{i + 1}</text>')
    sp = scene["spawn"]
    parts.append(f'<circle cx="{(sp["x"] + .5) * s}" cy="{(sp["z"] + .5) * s}" r="{s}" fill="#e33" stroke="#fff" stroke-width="2"/>')
    parts.append(f'<text x="8" y="{scene["depth"] * s - 8}" font-size="12" fill="#222">{scene["attribution"]}</text></svg>')
    svg = out / "preview.svg"
    svg.write_text("\n".join(parts))
    if shutil.which("rsvg-convert"):
        subprocess.run(["rsvg-convert", str(svg), "-o", str(out / "preview.png")], check=False)
    print(f"Preview in {svg.relative_to(ROOT)}{' (+ preview.png)' if (out / 'preview.png').exists() else ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=("fetch", "build", "all"))
    parser.add_argument("zone", help="folder name in assets/geo/, e.g. alegia")
    args = parser.parse_args()
    if args.step in ("fetch", "all"): fetch(args.zone)
    if args.step in ("build", "all"): build(args.zone)


if __name__ == "__main__":
    main()
