"""Draw Barcelona as a schematic network map: districts, sea, hills, avenues, landmarks and lines.

  fetch  bcn-geodata (CartoBCN) districts and neighbourhoods -> assets/geo/barcelona/cartobcn.json
         (simplified to a few metres, committed, so building never needs the network)
  build  cartobcn.json + assets/geo/barcelona/city.json -> src/geo/barcelona.json, projected to
         metres on a map turned so the coast runs left to right with the sea at the bottom,
         plus output/city/preview.svg

docs/barcelona.md explains the map and every field of city.json.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
CITY = ROOT / "assets" / "geo" / "barcelona"
M_PER_DEG_LAT = 110_540
SOURCES = {"districts": "districtes/districtes.geojson", "barris": "barris/barris.geojson"}


def load_city() -> dict:
    return json.loads((CITY / "city.json").read_text())


# ---------------------------------------------------------------- geometry

def simplify(points: list, tolerance: float) -> list:
    """Douglas-Peucker on [x, y] points in metres."""
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    def distance(p):
        if length == 0: return math.hypot(p[0] - ax, p[1] - ay)
        return abs(dy * p[0] - dx * p[1] + bx * ay - by * ax) / length
    index, worst = max(((i, distance(p)) for i, p in enumerate(points[1:-1], 1)), key=lambda t: t[1])
    if worst <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


class Projection:
    """[lat, lon] -> map metres: x to the right along the coast, y down towards the sea."""

    def __init__(self, frame: dict):
        self.lat0, self.lon0 = frame["lat"], frame["lon"]
        self.kx = 111_320 * math.cos(math.radians(self.lat0))
        a = math.radians(frame.get("rotation_deg", 0))
        self.cos, self.sin = math.cos(a), math.sin(a)

    def __call__(self, lat: float, lon: float) -> list[float]:
        east, north = (lon - self.lon0) * self.kx, (lat - self.lat0) * M_PER_DEG_LAT
        x, y = east * self.cos - north * self.sin, east * self.sin + north * self.cos
        return [x, -y]

    def metres(self, lat: float, lon: float) -> list[float]:
        return [(lon - self.lon0) * self.kx, (lat - self.lat0) * M_PER_DEG_LAT]


def outer_rings(geometry: dict) -> list[list]:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in geometry["coordinates"]]
    return []


# ---------------------------------------------------------------- fetch

def fetch() -> None:
    city = load_city()
    out = {"attribution": city["attribution"], "source": city["districts_source"]}
    project = Projection(city["frame"])
    for key, path in SOURCES.items():
        url = f"{city['districts_source']}/{path}"
        print(f"Downloading {url}…")
        response = httpx.get(url, timeout=120, follow_redirects=True)
        response.raise_for_status()
        features = []
        for feature in response.json()["features"]:
            for ring in outer_rings(feature["geometry"]):
                # Simplify in metres, store as [lat, lon] again so the frame can change later.
                metres = [project.metres(lat, lon) for lon, lat in ring]
                kept = simplify(metres, 6 if key == "barris" else 10)
                features.append({"name": feature["properties"].get("NOM"), "ring": [
                    [round(project.lat0 + y / M_PER_DEG_LAT, 6), round(project.lon0 + x / project.kx, 6)] for x, y in kept]})
        out[key] = features
        print(f"  {len(features)} {key}")
    (CITY / "cartobcn.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Saved {(CITY / 'cartobcn.json').relative_to(ROOT)}")


# ---------------------------------------------------------------- build

def build() -> None:
    city = load_city()
    source = CITY / "cartobcn.json"
    if not source.exists():
        sys.exit("No assets/geo/barcelona/cartobcn.json; run `just city-fetch` first.")
    carto = json.loads(source.read_text())
    project = Projection(city["frame"])
    pt = lambda p: [round(v) for v in project(*p)]
    line = lambda points: [pt(p) for p in points]

    districts = [{"name": d["name"], "poly": line(d["ring"])} for d in carto["districts"]]
    barris = [{"name": b["name"], "poly": line(b["ring"])} for b in carto["barris"]]
    xs = [p[0] for d in districts for p in d["poly"]]
    ys = [p[1] for d in districts for p in d["poly"]]
    m = city["frame"].get("margin_m", 500)
    extent = {"x0": min(xs) - m, "y0": min(ys) - m, "x1": max(xs) + m, "y1": max(ys) + m}

    # The sea: the coast, closed far below the map.
    coast = line(city["coast"])
    far = 50_000
    sea = coast + [[coast[-1][0] + far, coast[-1][1]], [coast[-1][0] + far, far], [coast[0][0] - far, far], [coast[0][0] - far, coast[0][1]]]

    stations = []
    for s in city["stations"]:
        x, y = pt(s["at"])
        station = {"id": s["id"], "name": s["name"], "x": x, "y": y}
        if s.get("offmap"):
            station["offmap"] = True
        stations.append(station)
    by_id = {s["id"]: s for s in stations}
    # Stations beyond the map are drawn on its edge, on the way from the line's last station there.
    inset = 260
    for line_ in city["lines"]:
        for previous, current in zip(line_["stations"], line_["stations"][1:]):
            s = by_id[current]
            if not s.get("offmap"): continue
            a = by_id[previous]
            dx, dy = s["x"] - a["x"], s["y"] - a["y"]
            t = min(
                ((extent["x1"] - inset - a["x"]) / dx) if dx > 0 else ((extent["x0"] + inset - a["x"]) / dx) if dx < 0 else math.inf,
                ((extent["y1"] - inset - a["y"]) / dy) if dy > 0 else ((extent["y0"] + inset - a["y"]) / dy) if dy < 0 else math.inf,
            )
            s["x"], s["y"] = round(a["x"] + dx * t), round(a["y"] + dy * t)
    missing = [sid for l in city["lines"] for sid in l["stations"] if sid not in by_id]
    if missing:
        sys.exit(f"Lines name unknown stations: {', '.join(missing)}")

    data = {
        "attribution": carto["attribution"], "extent": extent, "sea": sea,
        "hills": [{"id": h["id"], "name": h["name"], "poly": line(h["poly"])} for h in city["hills"]],
        "rivers": [{"id": r["id"], "name": r["name"], "line": line(r["line"])} for r in city["rivers"]],
        "districts": districts, "barris": barris,
        "avenues": [{"id": a["id"], "name": a["name"], "size": a["size"], "line": line(a["line"])} for a in city["avenues"]],
        "landmarks": [{"id": l["id"], "name": l["name"], "kind": l["kind"], "x": pt(l["at"])[0], "y": pt(l["at"])[1]} for l in city["landmarks"]],
        "stations": stations,
        "lines": [{k: l[k] for k in ("id", "name", "kind", "colour", "stations", "extension") if k in l} for l in city["lines"]],
    }
    out = ROOT / "src" / "geo" / "barcelona.json"
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Built {out.relative_to(ROOT)}: {len(districts)} districts, {len(barris)} neighbourhoods, "
          f"{len(stations)} stations, {len(data['lines'])} lines, {out.stat().st_size // 1024} KB")
    preview(data, ROOT / "output" / "city")


def preview(data: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    e = data["extent"]
    path = lambda pts, close=True: "M" + "L".join(f"{x},{y}" for x, y in pts) + ("Z" if close else "")
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{e["x0"]} {e["y0"]} {e["x1"] - e["x0"]} {e["y1"] - e["y0"]}" width="1400" font-family="sans-serif">',
             f'<rect x="{e["x0"]}" y="{e["y0"]}" width="{e["x1"] - e["x0"]}" height="{e["y1"] - e["y0"]}" fill="#efe6d2"/>',
             f'<path d="{path(data["sea"])}" fill="#7fb3cf"/>']
    parts += [f'<path d="{path(h["poly"])}" fill="#9cbf87"/>' for h in data["hills"]]
    parts += [f'<path d="{path(d["poly"])}" fill="#f6efe0" stroke="#fff" stroke-width="40"/>' for d in data["districts"]]
    parts += [f'<path d="{path(r["line"], False)}" fill="none" stroke="#7fb3cf" stroke-width="60"/>' for r in data["rivers"]]
    parts += [f'<path d="{path(a["line"], False)}" fill="none" stroke="#d9cdb4" stroke-width="{a["size"] * 30}"/>' for a in data["avenues"]]
    stations = {s["id"]: s for s in data["stations"]}
    for l in data["lines"]:
        pts = [[stations[s]["x"], stations[s]["y"]] for s in l["stations"]]
        parts.append(f'<path d="{path(pts, False)}" fill="none" stroke="{l["colour"]}" stroke-width="{70 if l["kind"] == "metro" else 45}" stroke-linejoin="round"/>')
    parts += [f'<circle cx="{s["x"]}" cy="{s["y"]}" r="55" fill="#fff" stroke="#333" stroke-width="15"/>' for s in data["stations"]]
    parts += [f'<text x="{l["x"]}" y="{l["y"]}" font-size="180" text-anchor="middle">{l["name"]}</text>' for l in data["landmarks"]]
    parts.append("</svg>")
    (out / "preview.svg").write_text("\n".join(parts))
    print(f"Preview in {(out / 'preview.svg').relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=("fetch", "build", "all"))
    args = parser.parse_args()
    if args.step in ("fetch", "all"): fetch()
    if args.step in ("build", "all"): build()


if __name__ == "__main__":
    main()
