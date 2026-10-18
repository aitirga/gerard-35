"""Draw Barcelona as a cartoon network map from hand-drawn layers (docs/barcelona.md).

  build  assets/geo/barcelona/city.json -> src/geo/barcelona.json, projected to metres on a map
         turned so the coast runs left to right with the sea at the bottom,
         plus output/city/preview.svg

Every shape in city.json is drawn by hand, a few points inspired by the real city; nothing is
downloaded. src/city-map.ts rounds the shapes off and draws the icons.
"""
import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITY = ROOT / "assets" / "geo" / "barcelona"
M_PER_DEG_LAT = 110_540


class Projection:
    """[lat, lon] -> map metres: x to the right along the coast, y down towards the sea."""

    def __init__(self, frame: dict):
        self.lat0, self.lon0 = frame["lat"], frame["lon"]
        self.kx = 111_320 * math.cos(math.radians(self.lat0))
        a = math.radians(frame.get("rotation_deg", 0))
        self.cos, self.sin = math.cos(a), math.sin(a)

    def __call__(self, lat: float, lon: float) -> list[int]:
        east, north = (lon - self.lon0) * self.kx, (lat - self.lat0) * M_PER_DEG_LAT
        x, y = east * self.cos - north * self.sin, east * self.sin + north * self.cos
        return [round(x), round(-y)]


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
    parser.add_argument("step", choices=("build",))
    parser.parse_args()
    build()


if __name__ == "__main__":
    main()
