"""Turn a real place into a playable environment, from open map data and a zone file.

  fetch  zone.json -> assets/geo/<zone>/osm.json   OpenStreetMap features around the anchor
                                                   (Overpass, or the OSM API if it is busy),
                                                   plus Google Street View / satellite references
                                                   in output/geo/<zone>/google/ when
                                                   GOOGLE_MAPS_API_KEY is set (never committed)
  build  zone.json + osm.json -> src/geo/<zone>.json  grid, footprints, roofs, roads, water,
                                                   trees and places for src/geo-scenery.ts,
                                                   plus output/geo/<zone>/preview.svg (and .png)

A zone can be designed by hand in assets/geo/<zone>/sketch.json instead (features in metres from
the anchor, inspired by the real place): Barcelona's zones are made this way. With both,
sketch features marked "keep" are added on top of the map data. docs/barcelona.md § Designed zones.

Zone files live in assets/geo/<zone>/zone.json; docs/environment-styling.md explains every field.
Coordinates in a zone file are metres from the anchor: east_m (+ east) and south_m (+ south).
Real materials (public/textures/<id>/, made by tools/textures.py) are named in the zone's `look` and
`styles`; the build embeds each one's metadata in the scene, so the game needs no manifest.
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
KEEP = ("building", "highway", "railway", "waterway", "natural", "landuse", "leisure", "place", "amenity", "bridge", "man_made", "shop")
# Nodes worth keeping: street furniture, trees, shops and station entrances.
KEEP_NODES = {"natural", "highway", "amenity", "man_made", "shop", "railway"}
# Road widths in metres, by highway=*. Unknown kinds fall back to "service".
ROAD_WIDTH = {
    "motorway": 10, "trunk": 9, "primary": 8, "secondary": 7, "tertiary": 6.5, "unclassified": 5,
    "residential": 5, "living_street": 4.5, "service": 3.5, "pedestrian": 4, "footway": 2.2,
    "cycleway": 2.5, "path": 1.8, "steps": 2, "track": 3,
}
PATHS = {"pedestrian", "footway", "cycleway", "path", "steps", "track"}
BLOCKED_ROADS = {"motorway", "trunk", "motorway_link", "trunk_link"}
# Map nodes a zone can turn into props with `osm_props` (prop kind -> tag); see docs/environment-styling.md.
OSM_PROPS = {"tree": ("natural", "tree"), "lamp": ("highway", "street_lamp"), "bench": ("amenity", "bench"),
             "bin": ("amenity", "waste_basket"), "bike-rack": ("amenity", "bicycle_parking")}
# Props that face the nearest road (their `yaw`, degrees) instead of standing square.
FACING_PROPS = {"bench", "bike-rack", "traffic-light", "lamp"}
# ...and those that turn their back to it: benches by the curb look at the shop fronts.
BACK_TO_ROAD = {"bench"}
# Cells each prop kind blocks along +x from its anchor (src/environments.ts PROP_FOOTPRINTS).
PROP_LENGTH = {"shelter": 3, "bus": 5, "containers": 5, "bicing": 4}
# Flat street furniture that blocks nothing: manhole covers and the vent grates over a tunnel.
FLAT_PROPS = {"manhole", "grate"}
# Amenities that count as shops: they get a sign on their building's ground floor.
SHOP_AMENITIES = {"restaurant", "cafe", "bar", "fast_food", "pharmacy", "bank", "pub", "ice_cream", "post_office",
                  "clinic", "dentist", "betting", "bureau_de_change"}
# Roads drawn into the turned frame never sit where a prop from the map would block them.
OPEN_FOR_PROPS = set("pgsa.")
# Raster classes, highest priority first. Lower-case classes are walkable.
WALKABLE = set("rpsgab.")
TEXTURES = ROOT / "public" / "textures"
# Each surface's default material (docs/environment-styling.md § Real materials): a texture in
# public/textures/ and the colour it is tinted to (None: the texture's own colour). The tints are the
# colours the surfaces were painted before, so every zone gains real grain without changing its palette.
# A zone's `look.materials` overrides any of them; "none" keeps the painted surface.
LOOK_MATERIALS = {
    "ground": ("formigo", "#cbc2ab"), "footway": ("saulo", "#b7a888"), "road": ("asfalt", "#66625e"),
    "bike": ("asfalt", "#8a6b5f"), "square": ("granit", "#a99d88"), "grass": ("gespa", "#86a462"),
    "bed": ("terra", "#4f4234"), "forest": ("gespa", "#4f6d42"), "sand": ("sorra", None),
    "rail": ("grava", "#857b6f"), "bridge": ("carreu", "#b3a68d"),
}
# Buildings: the real grain under the painted bays of each facade and ground kind, and the roof's tiles
# (tinted by the style's roof colour). Kinds missing here get "estuc" (render) and "carreu" (stone plinth).
WALL_MATERIALS = {"ashlar": "carreu", "ashlar-windows": "carreu", "mall": "formigo", "curtain": None, "hedge": None}
BASE_MATERIALS = {"masonry": "mamposteria", "mall-front": None, "hedge": None}
ROOF_MATERIALS = {"flat": "rajola"}
# Map nodes that become landmarks in every zone (kind -> tag and real size in metres), unless the zone's
# `osm_landmarks` turns them off; the node's name goes to the builder as `name`.
OSM_LANDMARKS = {"fountain": ("amenity", "drinking_water", (0.6, 0.6)), "kiosk": ("shop", "kiosk", (2.2, 1.5))}


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
        # `bounds_turned`: the bounds are a rectangle in the turned frame (x along the street, z towards
        # the camera), so a diagonal avenue can fill the map instead of the box round its diamond.
        self.turned = zone.get("bounds_turned", False)
        if self.turned:
            corners = [(b["west"], b["north"]), (b["east"], b["south"])]
        else:
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

    def from_turned(self, x: float, z: float) -> tuple[float, float]:
        """Cell coordinates of a point given in metres in the turned frame (`x_m`, `z_m`)."""
        return (x - self.x0) / self.cell - 0.5, (z - self.z0) / self.cell - 0.5

    def unturn(self, x: float, z: float) -> tuple[float, float]:
        """East/south metres of a point given in the turned frame."""
        return x * self.cos + z * self.sin, -x * self.sin + z * self.cos

    def item(self, item: dict) -> tuple[float, float]:
        """Cells of a zone-file item, placed with east_m/south_m or, in the turned frame, x_m/z_m."""
        if "x_m" in item: return self.from_turned(item["x_m"], item["z_m"])
        return self.from_metres(item["east_m"], item["south_m"])

    def bbox(self, margin: float = 40) -> tuple[float, float, float, float]:
        b = self.bounds
        if self.turned:
            # Undo the turn on the four corners and take the box round them.
            points = []
            for x in (b["west"] - margin, b["east"] + margin):
                for z in (b["north"] - margin, b["south"] + margin):
                    points.append(self.latlon(*self.unturn(x, z)))
            return (min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points))
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
        if e["id"].startswith("node/") and not (KEEP_NODES & tags.keys() or "addr:housenumber" in tags):
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

SKETCH_ATTRIBUTION = "Diseñado a mano, inspirado en el lugar real"
SKETCH_AREAS = {"square": {"place": "square"}, "grass": {"leisure": "park"}, "water": {"natural": "water"},
                "forest": {"landuse": "forest"}, "parking": {"amenity": "parking"}, "sand": {"natural": "beach"}}


def sketch_elements(sketch: dict, frame: "Frame", keep_only: bool = False) -> list[dict]:
    """Hand-drawn features (metres from the anchor) as the same elements osm.json holds."""
    out = []
    # `"frame": "turned"`: the sketch is drawn in the turned frame (x along the street, z towards the camera).
    turned = sketch.get("frame") == "turned"
    to_geom = lambda points: [list(frame.latlon(*(frame.unturn(e, s) if turned else (e, s)))) for e, s in points]
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
        tags |= f.get("tags", {})
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
        # `redraw`: streets by these names are left out of the map data and drawn by the sketch instead.
        redraw = set(zone.get("redraw", []))
        osm["elements"] = [e for e in osm["elements"] if not ("highway" in e["tags"] and e["tags"].get("name") in redraw)]
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
    # Tunnels, culverts and underground corridors are not on the street (the metro, the rail tunnel).
    if t.get("tunnel") in ("yes", "culvert", "building_passage") or t.get("location") == "underground": return None
    # Indoor corridors (a station's passages) are not streets either.
    if t.get("highway") == "corridor" or t.get("indoor") in ("yes", "corridor"): return None
    if t.get("natural") == "water" or t.get("waterway") == "riverbank" or t.get("landuse") == "reservoir": return "water"
    if t.get("waterway") in ("river", "stream", "canal"): return "waterway"
    if t.get("landuse") == "forest" or t.get("natural") in ("wood", "scrub"): return "forest"
    if t.get("leisure") in ("garden", "park") or t.get("landuse") in ("grass", "meadow", "village_green"): return "grass"
    if t.get("natural") in ("beach", "sand"): return "sand"
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
    from_m = frame.item
    lo, hi = (-0.5, -0.5), (W - 0.5, D - 0.5)

    areas = {"water": [], "forest": [], "grass": [], "square": [], "sand": []}
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
                # `lane_m`: roads tagged with their lanes get that many lanes' width (a wide avenue reads wide).
                if zone.get("lane_m") and road_kind == "road" and t.get("lanes", "").isdigit():
                    width = max(width, int(t["lanes"]) * zone["lane_m"])
                if zone.get("lane_m") and t.get("width", "").replace(".", "", 1).isdigit():
                    width = float(t["width"])
            road = {"id": e["id"], "kind": road_kind, "highway": highway, "name": t.get("name"),
                    "width": round(width / cell, 2), "line": polys[0] if polys else []}
            if zone.get("lane_m") and t.get("lanes", "").isdigit():
                road |= {"lanes": int(t["lanes"]), "oneway": t.get("oneway") == "yes"}
                # The bus lane, counted from the left of the way's direction (OSM's bus:lanes order).
                bus = [i for i, v in enumerate(t.get("bus:lanes", t.get("psv:lanes", "")).split("|")) if v == "designated"]
                if bus: road["bus"] = bus[0]
            roads.append(road)
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
    paint("a", in_any([a["poly"] for a in areas["sand"]]))
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
    # Landmarks stand on open ground; solid ones block their footprint like a building.
    found_landmarks = landmarks(zone, osm["elements"], frame, raster)
    for lm in found_landmarks:
        if lm["solid"]:
            for x, z in landmark_cells(lm, W, D): raster[z][x] = "L"

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
        # `step`: cells that use the place when walked into (a station's stair), `w` × `d` from a corner.
        if "step" in place:
            sx, sz = (round(v) for v in from_m(place["step"]))
            places[-1]["step"] = {"x": sx, "z": sz, "w": place["step"]["w"], "d": place["step"]["d"]}
    step_cells = {(p["step"]["x"] + i, p["step"]["z"] + j) for p in places if "step" in p for i in range(p["step"]["w"]) for j in range(p["step"]["d"])}
    keep_clear = {spawn} | {(p["cell"]["x"], p["cell"]["z"]) for p in places} | step_cells

    props = scatter_trees(zone, raster, W, D, cell)
    props += map_props(zone, osm["elements"], frame, raster, roads)
    # Works go down last, so they can make room for the trees and furniture around them.
    for p in sorted(zone.get("props", []), key=lambda p: p["kind"] in ("barrier", "bag")):
        trees = {(q["x"], q["z"]) for q in props if q["kind"] == "tree"}
        for x, z in rows(p, frame):
            prop = {k: v for k, v in p.items() if k not in ("east_m", "south_m", "x_m", "z_m", "to", "every_m")} | {"x": round(x), "z": round(z)}
            # Works props never share a cell, and leave each tree its pit: a barrier line breaks around trunks.
            taken = {c for q in props for c in prop_cells(q)}
            if prop["kind"] in ("barrier", "bag") and any(
                    c in taken or any((c[0] + dx, c[1] + dz) in trees for dx in (-1, 0, 1) for dz in (-1, 0, 1)) for c in prop_cells(prop)):
                continue
            # A row of furniture (`to`, `every_m`) leaves out the spots something already stands on, and
            # those on a carriageway: a row along a sidewalk or a median breaks where a side street crosses it.
            if "to" in p and (any(c in taken for c in prop_cells(prop)) or on_carriageway(x, z, roads)): continue
            if prop["kind"] == "car" and (zone.get("rotation_deg", 0) % 180 == 0 or frame.turned):
                prop["along"] = "x"  # the zone's streets run along x, so cars park along x
            if prop["kind"] in FACING_PROPS and "yaw" not in prop:
                prop["yaw"] = facing(prop["x"], prop["z"], roads, prop["kind"])
            props.append(prop)
    props = [p for p in props if all(0 < c[0] < W - 1 and 0 < c[1] < D - 1 and c not in keep_clear for c in prop_cells(p))]
    # Props are solid; anything they cut off from the spawn becomes solid too, so every open cell is reachable.
    blocked = {c for p in props for c in prop_cells(p)}
    reach = flood(spawn, blocked)
    grid = ["".join("." if (x, z) in reach or (x, z) in blocked and ch == "." else "#" for x, ch in enumerate(row)) for z, row in enumerate(grid)]
    stranded = [p["id"] for p in places if (p["cell"]["x"], p["cell"]["z"]) not in reach
                or "step" in p and any(c not in reach for c in step_cells if p["step"]["x"] <= c[0] < p["step"]["x"] + p["step"]["w"] and p["step"]["z"] <= c[1] < p["step"]["z"] + p["step"]["d"])]

    scene = {
        "id": zone["id"], "name": zone["name"], "region": zone.get("region", ""), "attribution": osm["attribution"],
        "fetched": osm["fetched"], "cell_m": cell, "storey": round(zone.get("storey_m", 3) / cell, 3),
        "zoom": zone.get("zoom", 11), "width": W, "depth": D, "grid": grid, "spawn": {"x": spawn[0], "z": spawn[1]},
        "areas": {k: [rounded(a["poly"]) for a in v] for k, v in areas.items()},
        "roads": [{**r, "line": rounded(piece)} for r in roads if r["kind"] != "waterway" for piece in clip_line(r["line"], *lo, *hi)],
        "buildings": buildings, "props": props, "places": places,
        "shops": shops_on_walls(zone, [e for e in osm["elements"] if e["id"] not in {lm["id"] for lm in found_landmarks}], frame, buildings, W, D),
        "crossings": crossings(zone, osm["elements"], frame, roads, W, D),
        "look": zone.get("look", {}),
        "labels": [{"text": l["text"], "x": round(from_m(l)[0], 2), "z": round(from_m(l)[1], 2), "width": l.get("width", 4)} for l in zone.get("labels", [])],
        # Named points for the game's own pieces (e.g. where the palace stands), in cells.
        "anchors": {name: {"x": round(from_m(a)[0], 2), "z": round(from_m(a)[1], 2), **({"y": a["y_m"] / cell} if "y_m" in a else {})}
                    for name, a in zone.get("anchors", {}).items()},
        "landmarks": [{k: v for k, v in lm.items() if k != "textures"} for lm in found_landmarks],
    }
    # Real materials last: what the look, the buildings and the landmarks name, with each texture's metadata.
    scene["materials"] = look_materials(zone)
    scene["textures"] = embed_textures(scene, [t for lm in found_landmarks for t in lm.get("textures", [])])
    out = ROOT / "src" / "geo" / f"{zone_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not stranded: out.write_text(json.dumps(scene, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Built {out.relative_to(ROOT)}: {W}×{D} cells of {cell} m, {len(buildings)} buildings, {len(roads)} roads, "
          f"{len(props)} props, {len(places)} places, {len(reach)} walkable cells")
    preview(scene, raster, ROOT / "output" / "geo" / zone_id)
    if stranded:
        sys.exit(f"Places cut off from the spawn: {', '.join(stranded)}. Move them in zone.json (see the preview).")


def prop_cells(p: dict) -> list[tuple[int, int]]:
    if p["kind"] in FLAT_PROPS: return []
    if p["kind"] == "car": return [(p["x"], p["z"]), (p["x"] + 1, p["z"]) if p.get("along") == "x" else (p["x"], p["z"] + 1)]
    return [(p["x"] + i, p["z"]) for i in range(p.get("length", PROP_LENGTH.get(p["kind"], 1)))]


def rows(p: dict, frame: Frame) -> list[tuple[float, float]]:
    """Where a zone prop stands: once, or with `to` and `every_m` once every so many metres up to `to`."""
    start = frame.item(p)
    if "to" not in p: return [start]
    end = frame.item(p["to"])
    count = max(1, round(math.hypot(end[0] - start[0], end[1] - start[1]) * frame.cell / p.get("every_m", 6)))
    return [(start[0] + (end[0] - start[0]) * i / count, start[1] + (end[1] - start[1]) * i / count) for i in range(count + 1)]


def on_carriageway(x: float, z: float, roads: list) -> bool:
    """Whether a point lies on a road's asphalt (paths and bike lanes do not count)."""
    return any(r["kind"] == "road" and segment_distance(x, z, a, b) < r["width"] / 2 for r in roads for a, b in zip(r["line"], r["line"][1:]))


def nearest_road(x: float, z: float, roads: list, kinds=("road",)) -> tuple[float, tuple, tuple] | None:
    """Distance to the nearest road of these kinds, the nearest point on it, and its segment."""
    best = None
    for r in roads:
        if r["kind"] not in kinds: continue
        for a, b in zip(r["line"], r["line"][1:]):
            d = segment_distance(x, z, a, b)
            if best is None or d < best[0]: best = (d, a, b, r)
    if not best: return None
    d, a, b, r = best
    dx, dz = b[0] - a[0], b[1] - a[1]
    t = 0 if dx == dz == 0 else max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    return d, (a[0] + t * dx, a[1] + t * dz), (a, b, r)


def facing(x: float, z: float, roads: list, kind: str = "") -> int:
    """Yaw in degrees that turns a prop's front (+z) towards the nearest road (or away from it,
    for BACK_TO_ROAD kinds), in 15° steps."""
    near = nearest_road(x, z, roads)
    if not near: return 0
    px, pz = near[1]
    turn = 180 if kind in BACK_TO_ROAD else 0
    return (int(round(math.degrees(math.atan2(px - x, pz - z)) / 15) * 15) + turn) % 360


def map_props(zone: dict, elements: list, frame: Frame, raster: list, roads: list) -> list[dict]:
    """Props from map nodes the zone asks for (`osm_props`: kind -> extra fields), on open ground only."""
    wanted = zone.get("osm_props", {})
    out = []
    for e in elements:
        if not e["id"].startswith("node/"): continue
        for kind, (key, value) in OSM_PROPS.items():
            if kind not in wanted or e["tags"].get(key) != value: continue
            x, z = (round(v) for v in frame.cells(*e["at"]))
            if not (0 < x < frame.width - 1 and 0 < z < frame.depth - 1) or raster[z][x] not in OPEN_FOR_PROPS: continue
            extra = dict(wanted[kind])
            # `in_bed`: what changes for one standing in a planted bed (a tree there needs no paved pit).
            in_bed = extra.pop("in_bed", {})
            prop = {"kind": kind, "x": x, "z": z} | extra | (in_bed if raster[z][x] == "g" else {})
            if kind in FACING_PROPS: prop["yaw"] = facing(x, z, roads, kind)
            out.append(prop)
    return out


def shops_on_walls(zone: dict, elements: list, frame: Frame, buildings: list, W: int, D: int) -> list[dict]:
    """Every shop, bar and bank of the map (and the zone's own `shops`), as a sign on the nearest street wall."""
    signed = {k for k, v in zone.get("buildings", {}).items() if "sign" in v}
    found = []
    for e in elements:
        t = e["tags"]
        kind = t.get("shop") or (t["amenity"] if t.get("amenity") in SHOP_AMENITIES else None)
        if not kind or e["id"] in signed: continue
        if "at" in e: x, z = frame.cells(*e["at"])
        elif e.get("geom"):
            cells = [frame.cells(*p) for p in e["geom"]]
            x, z = sum(c[0] for c in cells) / len(cells), sum(c[1] for c in cells) / len(cells)
        else: continue
        found.append((x, z, t.get("name") or t.get("brand"), kind))
    found += [(*frame.item(s), s["name"], s["kind"]) for s in zone.get("shops", [])]
    out = []
    for x, z, name, kind in found:
        if not (0 <= x < W and 0 <= z < D): continue
        best = None
        for b in buildings:
            poly = b["poly"]
            for a, c in zip(poly, poly[1:] + poly[:1]):
                length = math.hypot(c[0] - a[0], c[1] - a[1])
                if length < 1.5: continue
                nx, nz = (c[1] - a[1]) / length, -(c[0] - a[0]) / length
                mx, mz = (a[0] + c[0]) / 2, (a[1] + c[1]) / 2
                if point_in_polygon(mx + nx * 0.3, mz + nz * 0.3, poly): nx, nz = -nx, -nz
                # Only walls onto the street: a wall shared with the next building is not a shop front.
                if any(point_in_polygon(mx + nx * 1.2, mz + nz * 1.2, o["poly"]) for o in buildings): continue
                d = segment_distance(x, z, a, c)
                if best is None or d < best[0]: best = (d, a, c, b, length, nx, nz)
        if not best or best[0] > 8: continue
        d, a, c, b, length, nx, nz = best
        ux, uz = (c[0] - a[0]) / length, (c[1] - a[1]) / length
        along = max(min(((x - a[0]) * ux + (z - a[1]) * uz), length - 1.2), 1.2) if length > 2.4 else length / 2
        fx, fz = a[0] + ux * along, a[1] + uz * along
        out.append({"name": name, "kind": kind, "building": b["id"],
                    "x": round(fx, 2), "z": round(fz, 2), "nx": round(nx, 3), "nz": round(nz, 3), "along": round(along, 2)})
    # Two shops on one wall a sign's width apart: the second moves along the wall, away from the first.
    out.sort(key=lambda s: (s["building"], s["nx"], s["nz"], s["x"], s["z"]))
    for prev, s in zip(out, out[1:]):
        if s["building"] == prev["building"] and (s["nx"], s["nz"]) == (prev["nx"], prev["nz"]):
            gap = math.hypot(s["x"] - prev["x"], s["z"] - prev["z"])
            if gap < 2.6:
                ux, uz = -s["nz"], s["nx"]
                push = (2.6 - gap) * (1 if (s["x"] - prev["x"]) * ux + (s["z"] - prev["z"]) * uz >= 0 else -1)
                s["x"], s["z"] = round(s["x"] + ux * push, 2), round(s["z"] + uz * push, 2)
    return [{k: v for k, v in s.items() if k != "along"} for s in out]


def crossings(zone: dict, elements: list, frame: Frame, roads: list, W: int, D: int) -> list[dict]:
    """Zebra crossings where the map has highway=crossing on a road (and, with `zebras_x_m`, across every
    road at those points along the turned frame): centre, road direction and width."""
    points = [frame.cells(*e["at"]) for e in elements if e["tags"].get("highway") == "crossing" and "at" in e]
    for x_m in zone.get("zebras_x_m", []):
        x = frame.from_turned(x_m, 0)[0]
        for r in roads:
            if r["kind"] != "road": continue
            for a, b in zip(r["line"], r["line"][1:]):
                if (a[0] - x) * (b[0] - x) <= 0 and a[0] != b[0]:
                    points.append((x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])))
    out = []
    for x, z in points:
        if not (0 <= x < W and 0 <= z < D): continue
        near = nearest_road(x, z, roads)
        if not near or near[0] > near[2][2]["width"] / 2: continue
        (a, b, r) = near[2]
        if any(math.hypot(c["x"] - x, c["z"] - z) < 2 for c in out): continue
        out.append({"x": round(near[1][0], 2), "z": round(near[1][1], 2),
                    "angle": round(math.atan2(b[1] - a[1], b[0] - a[0]), 3), "width": r["width"]})
    return out


def make_building(zone: dict, e: dict, poly: list, cell: float) -> dict:
    t = e["tags"]
    rules = zone.get("styles", {})
    override = zone.get("buildings", {})
    chosen = override.get(f"tag:building={t['building']}", {}) | override.get(e["id"], {})
    style_name = chosen.get("style", "default")
    style = rules.get("default", {}) | rules.get(style_name, {})
    # A per-building override wins over the map's own levels (a mall tagged with its office tower's).
    levels = chosen["levels"] if "levels" in chosen else int(float(t.get("building:levels", style.get("levels", 3))))
    height = float(t["height"]) if "height" in t and "levels" not in chosen else levels * zone.get("storey_m", 3)
    facade, ground = chosen.get("facade", style.get("facade", "rendered")), chosen.get("ground", style.get("ground", "masonry"))
    roof = chosen.get("roof_kind", t.get("roof:shape", style.get("roof_kind", "hip")))
    return {
        "id": e["id"], "style": style_name, "name": t.get("name"), "number": chosen.get("label", t.get("addr:housenumber")),
        "levels": levels, "height": round(height / cell, 2), "roof": roof,
        "walls": chosen.get("walls", pick(e["id"], style.get("walls", ["#e8e0d0"]))), "base": style.get("base"), "trim": style.get("trim"),
        "roofColor": style.get("roof"), "facade": facade, "ground": ground,
        "poly": rounded(poly), "box": oriented_box(poly),
        "materials": building_materials(style.get("materials", {}) | chosen.get("materials", {}), facade, ground, roof, "party" in style),
    } | relief(style | chosen) | ({"sign": chosen["sign"]} if "sign" in chosen else {}) | ({"signature": chosen["signature"]} if "signature" in chosen else {})


def relief(style: dict) -> dict:
    """What a building carries beyond its painted walls (docs/environment-styling.md § Styles): balcony
    slabs every storey on the walls the camera sees (`balcony_m` deep, fronts in `balcony`), a cornice,
    the clutter of a flat roof (`rooftop`) and bare party walls in `party` where it rises over a neighbour."""
    out = {k: style[k] for k in ("balcony_m", "balcony", "cornice", "rooftop", "party") if style.get(k)}
    return {"relief": out} if out else {}


# ---------------------------------------------------------------- real materials

def building_materials(named: dict, facade: str, ground: str, roof: str, party: bool = False) -> dict:
    """The textures under a building's painted walls and plinth and on its roof (and its bare party
    walls, with `party`): the style's or the building's `materials`, else the defaults for its kinds.
    "none" (or a photo facade) leaves it painted."""
    hedge = facade == "hedge"
    out = {"wall": named.get("wall", WALL_MATERIALS.get(facade, "estuc")),
           "base": named.get("base", BASE_MATERIALS.get(ground, "carreu")),
           "roof": named.get("roof", None if hedge else ROOF_MATERIALS.get(roof, "teula"))}
    if party: out["party"] = named.get("party", "mao")
    if facade.startswith("photo:"): out["wall"] = None
    if ground.startswith("photo:"): out["base"] = None
    return {k: v for k, v in out.items() if v and v != "none"}


def look_materials(zone: dict) -> dict:
    """Each surface's texture and tint: LOOK_MATERIALS, the street's own colours, then `look.materials`."""
    look = zone.get("look", {})
    out = {k: {"texture": t, "tint": c} for k, (t, c) in LOOK_MATERIALS.items()}
    if look.get("ground") == "panot": out["ground"] = {"texture": "panot-gris", "tint": None}
    if look.get("asphalt"):
        # Barcelona's bike lanes are the same new asphalt as the road.
        out["road"] = out["bike"] = {"texture": "asfalt", "tint": look["asphalt"]}
    for k, v in look.get("materials", {}).items():
        out[k] = {"texture": v, "tint": None} if isinstance(v, str) else {"texture": v.get("texture"), "tint": v.get("tint")}
    return {k: {kk: vv for kk, vv in v.items() if vv is not None} for k, v in out.items() if v["texture"] and v["texture"] != "none"}


def texture_info(texture_id: str) -> dict | None:
    """What the game needs of a texture: its kind, files, real size, mean colour and bays (photos)."""
    path = TEXTURES / texture_id / "texture.json"
    if not path.exists(): return None
    t = json.loads(path.read_text())
    return {k: t[k] for k in ("kind", "files", "size_m", "mean", "bays", "storeys") if k in t}


def embed_textures(scene: dict, extra: list[str]) -> dict:
    """Every texture the scene names, by id. A missing one is dropped (with a warning) so the game
    paints that surface as before."""
    named = set(extra) | {m["texture"] for m in scene["materials"].values()}
    for b in scene["buildings"]:
        named |= set(b["materials"].values())
        named |= {k.removeprefix("photo:") for k in (b["facade"], b["ground"]) if k.startswith("photo:")}
        if "signature" in b: named.add(b["signature"])
    found = {t: info for t in sorted(named) if (info := texture_info(t))}
    missing = sorted(named - found.keys())
    if missing:
        print(f"Textures not in public/textures/ (painted instead): {', '.join(missing)}; see `just textures`.", file=sys.stderr)
        scene["materials"] = {k: v for k, v in scene["materials"].items() if v["texture"] in found}
        for b in scene["buildings"]:
            b["materials"] = {k: v for k, v in b["materials"].items() if v in found}
            if b.get("signature") not in found: b.pop("signature", None)
    return found


# ---------------------------------------------------------------- landmarks

def landmarks(zone: dict, elements: list, frame: Frame, raster: list) -> list[dict]:
    """The zone's `landmarks` and the map nodes in OSM_LANDMARKS, in cells: centre, turn, footprint."""
    W, D, cell = frame.width, frame.depth, frame.cell
    out = []
    centroid = {e["id"]: frame.cells(*e["at"]) for e in elements if "at" in e}
    for i, lm in enumerate(zone.get("landmarks", [])):
        if "osm" in lm:
            if lm["osm"] not in centroid: sys.exit(f"Landmark {lm.get('id', i)}: no map node {lm['osm']}.")
            x, z = centroid[lm["osm"]]
        else:
            x, z = frame.item(lm)
        w, d = lm.get("size_m", [cell, cell])
        out.append({"kind": lm["kind"], "id": lm.get("id", f"{lm['kind']}-{i + 1}"), "x": round(x, 2), "z": round(z, 2),
                    "angle": lm.get("rotation_deg", 0), "w": round(w / cell, 2), "d": round(d / cell, 2),
                    "solid": lm.get("solid", True), "params": lm.get("params", {}), "textures": lm.get("textures", [])})
    # Street furniture from the map, only on open ground and away from the zone's own props.
    wanted = {k: v for k, v in OSM_LANDMARKS.items() if zone.get("osm_landmarks", {}).get(k, {}) is not False}
    taken = {c for p in zone.get("props", []) for x, z in rows(p, frame) for c in prop_cells({**p, "x": round(x), "z": round(z)})}
    for e in elements:
        if not e["id"].startswith("node/"): continue
        for kind, (key, value, (w, d)) in wanted.items():
            if e["tags"].get(key) != value: continue
            x, z = (round(v) for v in centroid[e["id"]])
            if not (0 < x < W - 1 and 0 < z < D - 1) or raster[z][x] not in OPEN_FOR_PROPS or (x, z) in taken: continue
            params = zone.get("osm_landmarks", {}).get(kind, {}) | ({"name": e["tags"]["name"]} if "name" in e["tags"] else {})
            out.append({"kind": kind, "id": e["id"], "x": x, "z": z, "angle": params.get("rotation_deg", 0), "w": round(w / cell, 2),
                        "d": round(d / cell, 2), "solid": True, "params": {k: v for k, v in params.items() if k != "rotation_deg"}, "textures": []})
    return out


def landmark_cells(lm: dict, W: int, D: int) -> list[tuple[int, int]]:
    """Cells whose centre lies inside the landmark's turned footprint (at least the one under its centre)."""
    a = math.radians(lm["angle"])
    c, s = math.cos(a), math.sin(a)
    reach = math.ceil(math.hypot(lm["w"], lm["d"]) / 2) + 1
    cells = {(round(lm["x"]), round(lm["z"]))}
    for z in range(round(lm["z"]) - reach, round(lm["z"]) + reach + 1):
        for x in range(round(lm["x"]) - reach, round(lm["x"]) + reach + 1):
            dx, dz = x - lm["x"], z - lm["z"]
            if abs(dx * c - dz * s) <= lm["w"] / 2 and abs(dx * s + dz * c) <= lm["d"] / 2: cells.add((x, z))
    return [(x, z) for x, z in sorted(cells) if 0 <= x < W and 0 <= z < D]


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
               "b": "#b8a98e", "R": "#555", "M": "#333", "B": "#b4643f", ".": "#e6e2d4", "a": "#ecd9a8", "L": "#7a4fa0"}
    s = 6
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {scene["width"] * s} {scene["depth"] * s}" '
             f'width="{scene["width"] * s}" height="{scene["depth"] * s}" font-family="sans-serif">']
    for z, row in enumerate(raster):
        for x, c in enumerate(row):
            fill = colours[c] if scene["grid"][z][x] == "." or c in "WFBRML" else "#bdb6a3"
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
