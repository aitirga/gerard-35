# Real places: styling, sourcing and building environments

How to turn a real street into a playable scene: where the information comes from, how to
read a place and translate it into the game's look, and the scripts that build it. The worked
example is **San Juan kalea, Alegia (Gipuzkoa)**, around number 95. For the hand-authored scenes
(Passatge Maresme, the houses, the palace) see [environment-pipeline.md](environment-pipeline.md).

```
assets/geo/<zone>/zone.json ──┐  (you write it: anchor, area, styles, props, places)
                              ├─► just geo-fetch ─► assets/geo/<zone>/osm.json      (OpenStreetMap, committed)
Google Maps / Street View ────┘                   └► output/geo/<zone>/google/      (references, never committed)
                                                                 │
               just geo-build ◄──────────────────────────────────┘
                 ├─► src/geo/<zone>.json        grid, footprints, roofs, roads, water, trees, places
                 └─► output/geo/<zone>/preview.svg|png   top-down check
                                   │
src/environments.ts  geoEnvironment() ─► Environment (grid, spawn, props, interactions)
src/geo-scenery.ts   buildGeo()       ─► PlayCanvas meshes: ground, roads, river, buildings, hills
```

`just geo <zone>` runs fetch and build together; `just geo-build <zone>` rebuilds offline from
the saved data, so tweaking styles never needs the network.

## Where each kind of information comes from

| Need | Source | How it is used | Licence |
| --- | --- | --- | --- |
| Address → coordinates | [Nominatim](https://nominatim.org/) (OpenStreetMap) | `fetch` geocodes `anchor.address` when `lat`/`lon` are missing | ODbL |
| Footprints, house numbers, names, streets, paths, rail, river, gardens, squares | [OpenStreetMap](https://www.openstreetmap.org/) via Overpass, or the OSM API bbox call when Overpass is busy | Saved trimmed in `osm.json`; the build extrudes and rasterises it | ODbL: keep the attribution, which the game shows in the place panel |
| How it looks *today*: render colours, materials, storeys, balconies, arcades, shutters, trees, parked cars, pavements | Google Maps **Street View** (note the capture date shown in the viewer) | Read by a person, written down as `reference.notes` and turned into `styles` | Reference only |
| Roof colour and shape, tree cover, yards | Google Maps **satellite** layer | Same: notes and styles | Reference only |
| Better building heights and parcels (optional) | Gipuzkoa's [b5m](https://b5m.gipuzkoa.eus/) / geoEuskadi open data (many OSM features already cite `source=b5m`) | Not wired in; set `levels` per building in `zone.json` meanwhile | Open data (check each layer) |

**Why Google is only a reference.** The Google Maps Platform terms do not allow copying map
data out of Google (tracing geometry, caching tiles, shipping imagery or the photorealistic 3D
tiles in a product). So geometry always comes from OpenStreetMap, and Google is what we *look
at* to judge the current state of the street. With `GOOGLE_MAPS_API_KEY` in `.env`, `fetch` also
saves Street View Static and Maps Static pictures for the zone's viewpoints into
`output/geo/<zone>/google/` (git-ignored) so they can be compared side by side with the game;
without a key it writes `links.md` with the same viewpoints as Google Maps links to open by hand.
Nothing from Google is bundled in the game.

## Reading a place (what to look for)

Spend ten minutes in Street View before writing any style. For each street segment, write one
line in `reference.notes`, with the capture date in `reference.streetview_capture`:

1. **Silhouette**: storeys, roof shape (hipped, gabled, flat), eaves depth, towers.
2. **Ground floor**: arcade, shops, stone plinth, garage doors, steps. It is what the player sees
   most, so it gets its own texture.
3. **Upper floors**: render colour range, timber framing, balconies (iron or wood), miradors,
   shutters, flowers.
4. **Street**: width, pavement or none, surface colour, parked cars and which side, lamps,
   signs, benches, trees (species and pruning).
5. **Signature details**: the two or three things a local would recognise (Alegia: the arcade
   and geraniums at 95, the pollarded plane tree in the square, the stone church, the old bridge).
   These earn extra effort; everything else is simplified.
6. **Surroundings**: river, hills, rail, motorway. They frame the scene from the overview.

Use the satellite layer for roof colour and the green belts, and Street View for everything
vertical.

## Art direction rules

- **Real layout, simplified looks.** Keep positions and footprints from the map so the place is
  recognisable from above; paint facades as repeating bays instead of modelling each window.
- **Scale.** One cell is `cell_m` metres (Alegia: 1.25 m, which keeps a person about one cell
  wide). Heights come from `levels × storey_m`.
- **Palette.** Pick 3–5 close render colours per street from Street View and let the build
  assign them per building (stable hash of the OSM id), so a terrace varies without looking
  random. Keep roofs to one or two terracotta tones. Saturation stays a little below the photos,
  like the rest of the game.
- **Face the camera.** The camera looks from the south-east of the grid, so walls facing grid
  south and east are the ones seen. Choose `rotation_deg` so the signature facades face it
  (Alegia uses 180: the houses on the river side of San Juan kalea show their street fronts).
- **Nothing hides Gerard.** Buildings between Gerard and the camera fold down to their footprint
  (`src/geo-scenery.ts`), trees turn see-through (`src/props.ts`). No style may break that.
- **Gates are diegetic.** The map edge, the river and the rail are the borders; do not add
  invisible walls in open ground. If an area should be closed, add a fence or a person.
- **Text in the world.** Street names go on the ground as labels (`labels`), like
  "PASSATGE MARESME"; things to look at are `places`, spoken by Gerard, never a HUD hint.

## Making a new zone

1. `cp -r assets/geo/alegia assets/geo/<zone>` and delete the copied `osm.json`.
2. Edit `zone.json`: `id`, `name`, `region`, `anchor.address` (remove `lat`/`lon` to geocode it),
   `bounds_m` (metres from the anchor: `west`/`east` negative/positive, `north`/`south`
   negative/positive), `cell_m`, `rotation_deg`, `spawn`.
3. `just geo-fetch <zone>`. Open `output/geo/<zone>/google/links.md`, walk the street in Street
   View and fill in `reference`.
4. Write `styles`, then assign them in `buildings` (by `way/<id>` or by `tag:building=<value>`).
   `just geo-build <zone>` prints a summary and writes `output/geo/<zone>/preview.png`, where
   house numbers, props (green trees, red cars, yellow lamps), places (blue, numbered) and the
   spawn (red) are drawn over the walkable grid. Unreachable open ground is drawn darker.
5. Add `props`, `places` and `labels`. Places snap to the nearest cell reachable from the spawn;
   the build fails and names the place if one is cut off.
6. Hook it into the game (three lines): add the id to `EnvironmentId`, add
   `export const <ZONE> = geoEnvironment('<zone>', <ZONE>_SCENE as GeoScene);` with its JSON import
   to `ENVIRONMENTS` in `src/environments.ts`, and an `<option>` in `index.html`.
7. Add a screenshot scenario in `scripts/screenshots/<zone>.json` (copy `alegia.json`) and run
   `just screenshots <zone>`; `just check` runs the environment tests on the new grid.

To find the OSM id of a building, look it up on openstreetmap.org (query features tool) or read
the `id` fields in `src/geo/<zone>.json` after a first build.

## `zone.json` reference

| Field | Meaning |
| --- | --- |
| `id`, `name`, `region` | Scene id, the name in the selector, the eyebrow of the place panel |
| `anchor` | `address` and `lat`/`lon` of the reference point; all metre offsets start here |
| `bounds_m` | Playable rectangle in metres from the anchor (`west`, `east`, `north`, `south`) |
| `cell_m` | Metres per grid cell |
| `rotation_deg` | Turns the map around the anchor before gridding (0: north up; 180: south up) |
| `zoom` | Follow-camera zoom (orthographic half-height) |
| `spawn` | `east_m`/`south_m`; snapped to the nearest walkable cell |
| `storey_m` | Height of one storey |
| `reference` | `checked` date, `streetview_capture`, `notes` (one line per observation) and `viewpoints` (`name`, `lat`, `lon`, `heading`, `pitch`) for `fetch` |
| `styles` | Named looks; `default` is merged under every other one (see below) |
| `buildings` | Overrides by `way/<id>` (wins) or `tag:building=<value>`: `style`, `levels`, `roof_kind`, `label`, and per house `walls` (one colour), `facade`, `ground` |
| `props` | Extra props in metres: `tree` (`species`, `scale`), `car` (`color`), `lamp`, `manhole`. Cars park along x when the rotation is 0 or 180 |
| `trees` | Generated trees: `forest_every_m`, `riverbank_every_m`, `species` list |
| `places` | Things to look at: `id`, `label`, `lines`, and either `osm` (any feature id) or `east_m`/`south_m` |
| `labels` | Ground text: `text`, `east_m`, `south_m`, `width` in cells |

### Styles

| Key | Values |
| --- | --- |
| `walls` | List of render colours; each building gets one |
| `base`, `trim`, `roof` | Stone plinth, frames/bands/timber, roof tiles |
| `roof_kind` | `hip`, `gable`, `pyramid`, `flat`. Footprints that fill less than 85 % of their oriented box (an L, a courtyard) get a flat roof on the real outline with a parapet |
| `facade` | Upper floors: `rendered` (window, green shutters, wooden rail), `timber` (framing, brown shutters), `iron-balconies` (French windows, iron railings, geraniums, white floor bands), `ashlar` (stone courses), `ashlar-windows` (stone with arched windows) |
| `ground` | Ground floor: `masonry` (rubble stone, wooden door, barred window), `arcade` (round arches with lit shops), `ashlar`, `ashlar-arcade` |
| `levels` | Default storeys (OSM `building:levels` or `height` win when present) |

A new facade or ground kind is one more branch in `facade()` in `src/geo-scenery.ts`: it paints a
canvas for one bay and one storey (ground textures are two bays wide).

## What the build does

`tools/geo.py build`:

1. Projects every feature to anchor-relative metres, rotates them, and converts to cells
   (cell `(i, j)` covers `i-0.5 … i+0.5`, the same space as `src/movement.ts`).
2. Rasterises by priority: grass → forest → square → water → paths → roads → rail → motorway →
   bridge → buildings. Walkable: roads, paths, squares, grass, bridges and open ground. Solid:
   buildings, water, rail, motorway, forest and the map edge. Lines are at least 1.5 cells wide so
   diagonal paths stay connected edge to edge.
3. Snaps the spawn and places, scatters trees on forest and river banks, adds the zone's props,
   then keeps only the open cells reachable from the spawn (the tests require every open cell to
   be reachable).
4. Writes `src/geo/<zone>.json` (format in `src/geo.ts`): the grid, polygons for areas and
   buildings clipped to the map, road centre lines with widths, each building's oriented box for
   its roof, props, places, labels and the attribution.

`src/geo-scenery.ts` then draws, from that file alone: layered flat ground (polygons triangulated
by ear clipping), road ribbons, rails with sleepers, motorway barriers, the bridge with parapets,
a tinted flowing river, and each building as walls extruded from its footprint (ground band +
upper floors, textured per bay and storey), a lid and a roof on its oriented box. Static ground
is batched; buildings are separate so they can fold. Low hills ring the far sides.

## Alegia, worked example

- **Zone**: 235 × 120 m around San Juan kalea 95 (anchor 43.10017, -2.10033), 1.25 m cells
  (188 × 96), rotated 180° so the river is at the back and the street fronts face the camera.
- **Data** (OSM, fetched 2026-10-15): 35 buildings, most with their house name and number, San Juan kalea
  and Kale Gora, the church (San Juan eliza), the town hall (Alegiko udaletxea, 63), Zubi Zaharra,
  the Oria riverbank polygon, the Bidegorri, the Madrid–Hendaye railway and the A-1.
- **Street View** (June 2025 capture) and satellite gave the styles:
  - `arcade-block` for 93–95: four storeys, cream render, arcade, iron balconies with geraniums;
  - `terrace` for the old houses 61–91: timber framing over stone ground floors, four storeys;
  - `stone` for the church and its belfry (pyramid roof), `civic` for the town hall;
  - the pollarded plane tree and parked cars in front of 95, lamps along the street.
- **Places**: the portal of 95, the plane tree, the church, the town hall and the bridge.
- **Approximate**: storeys and colours are per style, not per house; facades are painted bays;
  roofs are fitted to boxes; the arcade at 95 is not walkable; riverbank trees are scattered,
  not surveyed; open ground behind the church is walkable gravel in the game.

Build it with `just geo-build alegia`; refresh the data with `just geo alegia` (the result may
change if OSM changes). Pick it in the environment selector, or `just screenshots alegia`.

## Limits and next steps

- Heights: pull `building:levels` from b5m/cadastre instead of per-style defaults.
- Facades per house: `buildings` overrides can already set `walls`, `facade` and `ground`; going
  through Street View house by house would replace the per-style defaults.
- Interiors and doors: add `places` with `to` (like Maresme's door) once there is an interior.
- Terrain: the town is flat; slopes (Kale Gora) would need ground heights in the grid.
- GLB: a landmark modelled in Blender could replace one building's procedural mesh; the grid
  and places stay as they are.
