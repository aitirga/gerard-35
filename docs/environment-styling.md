# Real places: styling, sourcing and building environments

How to turn a real street into a playable scene: where the information comes from, how to
read a place and translate it into the game's look, and the scripts that build it. The worked
example is **San Juan kalea, Alegia (Gipuzkoa)**, around number 95. For the hand-authored scenes
(Passatge Maresme, the houses, the palace) see [environment-pipeline.md](environment-pipeline.md).

```
assets/geo/<zone>/zone.json ──┐  (you write it: anchor, area, styles, props, places, landmarks)
                              ├─► just geo-fetch ─► assets/geo/<zone>/osm.json      (OpenStreetMap, committed)
Google Maps / Street View ────┘                   └► output/geo/<zone>/google/      (references, never committed)
                                                                 │
just texture-fetch / -photo / -panot ─► public/textures/<id>/    │  (real materials, one folder each)
                                                 │               │
               just geo-build ◄──────────────────┴───────────────┘
                 ├─► src/geo/<zone>.json        grid, footprints, roofs, roads, water, trees, places,
                 │                              landmarks, materials and the textures they use
                 └─► output/geo/<zone>/preview.svg|png   top-down check
                                   │
src/environments.ts  geoEnvironment() ─► Environment (grid, spawn, props, interactions)
src/geo-scenery.ts   buildGeo()       ─► PlayCanvas meshes: ground, roads, river, buildings, hills,
                                         real materials (src/materials.ts), landmarks (src/landmarks/)
```

A zone can also be **designed by hand** in `assets/geo/<zone>/sketch.json`, inspired by the real
place and with no map data (Barcelona's zones, see [barcelona.md](barcelona.md#designed-zones)):
`build` uses it when there is no `osm.json`. Places may also be doors (`to`) or left to the story
(no `lines`), and `anchors` name points for the game's own pieces (the palace on the school).

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
- **Nothing hides Gerard.** Buildings between Gerard and the camera keep their height and open a
  dithered see-through hole round him (`src/geo-scenery.ts`), trees turn see-through
  (`src/props.ts`). Folding walls down to a skirting is for house interiors only. No style may break that.
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
6. Hook it into the game: in `src/environments.ts` add the id to `EnvironmentId`, the JSON import,
   `export const <ZONE> = geoEnvironment('<zone>', <ZONE>_SCENE as GeoScene);` and its entry in
   `ENVIRONMENTS`; give it a look in `LOOKS` (`src/grading.ts`, the typecheck asks for it) and an
   entry in `PLACES` (`src/jump-menu.ts`) so the development picker reaches it. A place with a metro
   or train station also gets `<station>: { environment: '<zone>' }` in `STATION_PLACES`
   (`src/transit.ts`) and a place `station-<station>` on a walkable cell (with a `metro` prop and a
   `step`, like Fabra i Puig on the Meridiana); `tests/transit.test.mjs` checks both.
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
| `bounds_turned` | `true`: `bounds_m` is a rectangle in the turned frame (x along the street, z towards the camera), so a diagonal avenue fills the map. Items can then be placed with `x_m`/`z_m` in that frame instead of `east_m`/`south_m` |
| `cell_m` | Metres per grid cell |
| `rotation_deg` | Turns the map around the anchor before gridding (0: north up; 180: south up; the Meridiana uses -62 so it runs left to right) |
| `lane_m` | Lane width: roads tagged `lanes` get that many lanes' width (or their `width` tag), and keep `lanes`, `oneway` and the bus lane (`bus:lanes`) for the markings |
| `redraw` | Street names whose map ways are left out, to be drawn by the sketch's `keep` features instead (an avenue whose works the map does not show yet) |
| `osm_props` | Props from map nodes, by kind, with extra fields for each: `tree` (natural=tree), `lamp` (street_lamp), `bench`, `bin` (waste_basket), `bike-rack` (bicycle_parking). Only on open ground; lamps and racks face the nearest road, benches turn their back to it (they look at the shop fronts) |
| `shops` | Shops the map lacks: `name`, `kind` (an OSM shop or amenity value) and a position. Every shop, bar, bank and pharmacy of the map gets a sign on the nearest street wall of its building. `kind: "house"` is a house's name instead: a glazed tile beside the door, blue letters on white (Alegia's *Konfiteroenea*) |
| `zebras_x_m` | Points along the turned frame where a zebra crossing runs across every road; the map's own `highway=crossing` nodes are drawn too |
| `look` | The street's surfaces: `ground`/`footway` `panot` (grey sidewalk tiles; footways are not drawn over it), `grass` `bed` (soil and shrubs), `asphalt` colour (bike lanes too), `markings` (lanes, edges, zebras, BUS, bikes; a street with markings also gets moving traffic, see below), and `materials`: the real material of each surface (see [Real materials](#real-materials)). `river_m` sinks the water that many metres below the street between stone banks (the `bank` material; rain falls into it), `water` is the river's colour (a turbid river: on pale ripples, so it is the colour you see, mirroring less sky than the pool-blue default), and `hills: false` leaves out the generic round hills when a landmark draws the place's own (Alegia's `valley`) |
| `look.kerbs`, `look.edge` | `kerbs: true` lays granite kerbs (`granit`, 30 cm wide, standing a little proud) along every road's edges, lowered at the zebras, with puddles in their gutters after rain; `edge: "city"` closes the far sides with rows of plain blocks in dulled render and brick on a skirt of street instead of wooded hills |
| `zoom` | Follow-camera zoom (orthographic half-height) |
| `spawn` | `east_m`/`south_m`; snapped to the nearest walkable cell |
| `storey_m` | Height of one storey |
| `reference` | `checked` date, `streetview_capture`, `notes` (one line per observation) and `viewpoints` (`name`, `lat`, `lon`, `heading`, `pitch`) for `fetch` |
| `styles` | Named looks; `default` is merged under every other one (see below) |
| `buildings` | Overrides by `way/<id>` (wins) or `tag:building=<value>`: `style`, `levels` (wins over the map's), `roof_kind`, `label`, `sign` (big lit letters over the ground floor of the wall facing the camera), `signature` (a photo texture of the real facade on that wall), `materials` (merged over the style's), and per house `walls` (one colour), `facade`, `ground` |
| `props` | Extra props in metres: `tree` (`species`, `scale`, `base`, `stakes`, `trunk` colour), `car` (`color`), `lamp` (`style`: `led`), `manhole`, `metro` (a totem and a stair over the next three cells along x; `network`: `metro` or `rodalies`; `name` and `line` for the totem's plate), `bench` (`style`: `chair`), `barrier` (`color` red/white, `style` `jersey`, `panel`, `fence`), `bag`, `bin`, `bike-rack`, `traffic-light` (switched by the traffic), `shelter` (three cells along x), `bus` (`color`, `livery` `tmb`/`sagales`; five cells along x), `hoarding` (`length` cells along x), `containers` (the five recycling containers, five cells along x), `bicing` (a dock, four cells along x), `moto` (a parked scooter), `terrace` (a café table and two chairs), `grate` (a flat vent grate over a tunnel). With `to` (a second position) and `every_m`, one prop every so many metres along the way, leaving out spots something already stands on and spots on a carriageway (a row breaks where a side street crosses it). Cars park along x when the rotation is 0 or 180 or the bounds are turned |
| `trees` | Generated trees: `forest_every_m`, `riverbank_every_m`, `species` list |
| `places` | Things to look at: `id`, `label`, `lines`, and either `osm` (any feature id) or `east_m`/`south_m`. With `to` (`environment`, `cell`) instead of `lines` it is a door; with neither, the story answers it (station entrances `station-<id>`, clues). `step` (a position, `w` and `d` in cells) makes those cells use the place when walked into: a station's stair (the three cells beside its `metro` prop) |
| `labels` | Ground text: `text`, `east_m`, `south_m`, `width` in cells |
| `anchors` | Named points for the game's own pieces: `east_m`, `south_m`, optional `y_m` (height) |
| `landmarks` | Pieces drawn by their own module in `src/landmarks/<kind>.ts`: `kind`, a position (`east_m`/`south_m`, `x_m`/`z_m` or `osm`), `rotation_deg`, `size_m`, `solid`, `params`, `textures` (see [Landmarks](#landmarks)) |
| `osm_landmarks` | Landmarks the map gives in every zone (`fountain`: drinking water, `kiosk`: shop=kiosk): `{"kiosk": false}` turns one off, `{"fountain": {"colour": "#24384a"}}` passes it params |

### Styles

| Key | Values |
| --- | --- |
| `walls` | List of render colours; each building gets one |
| `base`, `trim`, `roof` | Stone plinth, frames/bands/timber, roof tiles |
| `roof_kind` | `hip`, `gable`, `pyramid`, `flat`. `flat` is a tiled terrace on the real outline with a parapet; footprints that fill less than 85 % of their oriented box (an L, a courtyard) get the same outline with their own roof tiles |
| `facade` | Upper floors: `rendered` (window, green shutters, wooden rail), `timber` (Basque framing over whitewash, an atlas of three bays by two storeys: crooked posts, braces, wooden or iron balconies with geraniums, board shutters), `iron-balconies` (French windows, iron railings, geraniums, white floor bands), `ashlar` (stone courses), `ashlar-windows` (stone with arched windows), `flats` (Barcelona blocks, painted as an atlas of four bays by three storeys that starts at a different bay on every wall: each bay keeps its kind all the way up, a window, twin windows, a balcony with an iron or panel railing, plants, washing and sometimes an awning, or an enclosed aluminium gallery, while blinds, lit flats and air conditioners change from flat to flat), `school` (a band of glazing with coloured frames), `mall` (blank concrete with a thin stripe in the trim colour), `curtain` (an office tower in dark glass, a few windows lit) |
| `ground` | Ground floor: `masonry` (rubble stone, wooden door, barred window), `arcade` (round arches with lit shops), `ashlar`, `ashlar-arcade`, `shops` (shop windows under striped awnings, some shutters down and tagged), `lobby` (glass doors under a coloured band), `mall-front` (lit glass under a wavy concrete canopy) |
| `levels` | Default storeys (OSM `building:levels` or `height` win when present) |
| `balcony_m`, `balcony`, `cornice`, `rooftop`, `party` | Relief as real geometry: balcony slabs `balcony_m` deep every storey on the walls the camera sees (fronts in `balcony`), a cornice under the parapet, a flat roof's clutter (stair and lift housings, water tanks, aerials, dishes, air conditioners) and bare party walls in the `party` colour where a block rises over its neighbour |
| `ground: shopfronts` | Glass shop fronts in aluminium frames with the lit shop seen through (a warm ceiling, shelves of goods), teal or grey canvas awnings over about half and a rare shutter down (the Meridiana) |
| `materials` | Real materials of the style: `wall` (grain under the painted upper floors), `base` (under the ground floor) and `roof` (tiles, tinted by `roof`); texture ids, or `"none"` to keep it painted. Defaults by kind in [Real materials](#real-materials) |

`facade` and `ground` may also be `photo:<texture>`: an atlas of real bays cut from photos (see
[Photo facades](#photo-facades-and-signature-facades)).

A new facade or ground kind is one more branch in `facade()` in `src/geo-scenery.ts`: it paints a
canvas for one bay and one storey (ground textures are two bays wide; `FACADE_ATLAS` gives a kind
several bays × storeys, like `flats`), drawn top-down as the facade is read. Fill its plain wall
with `paint(colour, 'wall' | 'base')` (or `stones(…)`) rather than `fillRect`, so the real grain
goes under what it paints on top.

## What the build does

`tools/geo.py build`:

1. Projects every feature to anchor-relative metres, rotates them, and converts to cells
   (cell `(i, j)` covers `i-0.5 … i+0.5`, the same space as `src/movement.ts`).
2. Rasterises by priority: grass → sand (natural=beach or sand; sketch `"area": "sand"`) → forest →
   square → water → paths → roads → rail → motorway → bridge → buildings → solid landmarks.
   Walkable: roads, paths, squares, grass, sand, bridges and open ground. Solid: buildings, water,
   rail, motorway, forest, solid landmarks and the map edge. Lines are at least 1.5 cells wide so
   diagonal paths stay connected edge to edge.
3. Snaps the spawn and places, scatters trees on forest and river banks, adds the zone's props,
   then keeps only the open cells reachable from the spawn (the tests require every open cell to
   be reachable).
4. Writes `src/geo/<zone>.json` (format in `src/geo.ts`): the grid, polygons for areas and
   buildings clipped to the map, road centre lines with widths, each building's oriented box for
   its roof and its materials, props, places, labels, landmarks, the surfaces' materials, the
   metadata of every texture it names, and the attribution.

`src/geo-scenery.ts` then draws, from that file alone: layered flat ground (polygons triangulated
by ear clipping), road ribbons, rails with sleepers, motorway barriers, the bridge with parapets,
a tinted flowing river, and each building as walls extruded from its footprint (ground band +
upper floors, textured per bay and storey), a lid and a roof on its oriented box, then the
landmarks. Static ground is batched; buildings are separate, with materials that open the
see-through hole. Low hills ring the far sides. Every surface is painted first and dressed in its
real material as soon as the textures load.

## Alegia, worked example

Alegia is the place built furthest with every tool on this page; its brief, identity card, sources
and credits are in [places/alegia.md](places/alegia.md).

- **Zone**: 335 × 155 m around San Juan kalea 95 (anchor 43.10017, -2.10033), 1.25 m cells
  (268 × 124), rotated 180° so the river is at the back and the street fronts face the camera.
- **Data** (OSM, fetched 2026-10-30): 62 buildings, most with their house name, San Juan kalea, the
  church, the town hall, Zubi Zaharra and the road bridge, the Oria riverbank, the riverside
  bidegorri, the Madrid–Hendaye railway and the N-I.
- **Look**: `river_m: 3` sinks the Oria between rubble banks under an overcast sky (`scenery.ts`
  turns the sun soft and white for `alegia`; `lighting.ts` gives it the `overcast` sky, whose
  horizon is the wooded hills the water mirrors); `hills: false` hands the backdrop to the `valley`
  landmark (wooded ridge, meadows with farmhouses, Txindoki, mist on the slopes).
- **Materials**: setts (`galtzada`), wet rubble (`harri-hezea`) on the church, bridge and banks, old
  canal tiles (`teila-zaharra`) on every roof, river pebbles (`legarra`), and the town hall's real
  front (`udaletxea`, a signature facade).
- **Landmarks**: `alegia-town-hall`, `zubi-zaharra`, `belfry`, `church-windows`, `weir`, `joare`,
  `pergola`, `toka`, `pelota-wall`, `railing` (both banks), `wall-lamp`, `bunting`, `valley`.
- **Life**: the `alegia` air is a drizzle that rings the puddles and the river, and low mist;
  every old house wears its name tile (`shops` of kind `house`).
- **Sketch**: `sketch.json` keeps one feature over the map, Bulebarra laid as a square: OSM tags it
  a park, the orthophoto shows a paved prow.
- **Approximate**: storeys and colours are per style except where set per house; the arcade at
  95 is painted, not walkable; riverbank trees are scattered, not surveyed.

Build it with `just geo-build alegia`; refresh the data with `just geo alegia` (the result may
change if OSM changes). Pick it in the development picker, or `just screenshots alegia`.

## Limits and next steps

- Heights: pull `building:levels` from b5m/cadastre instead of per-style defaults.
- Facades per house: `buildings` overrides can already set `walls`, `facade` and `ground`; going
  through Street View house by house would replace the per-style defaults.
- Interiors and doors: add `places` with `to` (like Maresme's door) once there is an interior.
- Terrain: the town is flat; slopes (Kale Gora) would need ground heights in the grid.
- GLB: a landmark modelled in Blender could be loaded by its landmark module (the grid and places
  stay as they are); the loader is not written yet.
- Kerbs: `look.kerbs` lays a raised granite strip along the roads, but the carriageway is not a
  step down from the sidewalk (scenes have no ground heights).

## Real materials

Real surfaces on the miniature: photographed asphalt, stone, render, roof tiles and Barcelona's
panot, at their real size, so a place reads like a tilt-shift photograph of the street. They are
an addition, never a dependency: every surface is still painted as before, and its real material
replaces or enriches the paint once the textures have loaded. A texture that is missing or fails
leaves the painted surface, and the game says so in the console (`Textura sin cargar`).

### The library

Each texture is a folder `public/textures/<id>/` with its game-ready files and its own
`texture.json`. There is **no shared manifest**: branches add folders without touching a common
file, and `just geo-build` copies what a zone uses into `src/geo/<zone>.json`, so the game reads
nothing else. Credits live in each `texture.json`.

| id | What | Real size (m) | Source |
| --- | --- | --- | --- |
| `asfalt` | Asphalt with cracks and tyre marks (tinted per street) | 30 | Poly Haven `aerial_asphalt_01` |
| `formigo` | Fine concrete: open urban ground, the panots' grain | 2.4 | Poly Haven `granular_concrete` |
| `panot-gris` | Barcelona's grey four-pastille panot, 20 cm tiles (the Meridiana) | 3.2 | Drawn by `textures.py panot square` over `formigo` |
| `panot-flor` | The flower of Barcelona, 20 cm tiles (Eixample, Passeig de Gràcia) | 3.2 | Drawn by `textures.py panot flor` over `formigo` |
| `granit` | Granite slabs: squares, kerbs, plinths | 2.3 | Poly Haven `granite_tile` |
| `saulo` | *Sauló*, the park gravel | 2.1 | Poly Haven `sandy_gravel` |
| `sorra` | Beach sand | 1.8 | Poly Haven `dense_sand` |
| `gespa` | Grass with fallen leaves | 2 | Poly Haven `leafy_grass` |
| `terra` | Raked soil (planted beds) | 2 | Poly Haven `raked_dirt` |
| `grava` | Gravel (rail ballast) | 2.25 | Poly Haven `gravel_floor` |
| `estuc` | Render / plaster, mottled | 1.5 | Poly Haven `plaster_grey_04` |
| `carreu` | Sandstone ashlar blocks (the painted courses stay over it, so it reads from far) | 3 | Poly Haven `sandstone_blocks_08` |
| `mamposteria` | Rubble stone in courses (old ground floors) | 1.5 | Poly Haven `rustic_stone_wall_02` |
| `mao` | Exposed red brick (*obra vista*, 60s–70s blocks) | 2 | Poly Haven `large_red_bricks` |
| `teula` | Curved clay roof tiles (*teula àrab*) | 2.5 | Poly Haven `clay_roof_tiles_02` |
| `rajola` | Square terracotta tiles of a flat roof (*terrat*) | 2.08 | Poly Haven `terracotta_floor_tiles` |

All are CC0. `just textures` lists them with their files and licence.

`texture.json` (written by the tool; only `kind`, `files`, `size_m`, `mean`, `bays` and `storeys`
reach the game):

```json
{
  "id": "teula", "name": "Teula àrab", "kind": "material",
  "files": { "albedo": "albedo.webp", "normal": "normal.webp" },
  "size_m": [2.5, 2.5], "px": [512, 512], "mean": "#91502b", "made": "2026-10-30",
  "source": { "site": "Poly Haven", "asset": "clay_roof_tiles_02", "name": "Clay Roof Tiles 02",
              "url": "https://polyhaven.com/a/clay_roof_tiles_02", "author": "Amal Kumar",
              "licence": "CC0 1.0", "licence_url": "https://creativecommons.org/publicdomain/zero/1.0/" },
  "command": "tools/textures.py fetch polyhaven clay_roof_tiles_02 --id teula"
}
```

`kind` is `material` (tiles every `size_m` metres) or `photo` (one picture covering `size_m`, or
with `bays` × `storeys` an atlas of real bays). `mean` is the albedo's average colour.

### Sources and licences

The repo and the site are public, so only what may be redistributed ships:

- **CC0 libraries**: [Poly Haven](https://polyhaven.com/textures) (gives the real size) and
  [ambientCG](https://ambientcg.com/) (pass `--size-m`). First choice for every generic surface.
- **Wikimedia Commons** files under CC0, CC BY or CC BY-SA: the tool reads the author, licence and
  file page from Commons and refuses anything else.
- **Own photos** (`--licence "own work"`), e.g. the user's photos of a street, rectified.
- **Own procedural painting**, like the panots.
- **Generated images** (OpenAI through `OPENAI_API_KEY`) only for fantasy surfaces no photo can
  give (the palace), at most four per agent, recorded as such in `source`.
- **Never**: Google Maps, Street View, satellite or Google Images (look at them, never copy them),
  and images of unknown licence.

Raw downloads stay in `output/textures/raw/` (git-ignored); delete those over 50 MB once processed.

### Commands

```bash
just texture-fetch polyhaven clay_roof_tiles_02 --id teula            # CC0 material, 512 px
just texture-fetch polyhaven aerial_asphalt_01 --id asfalt --px 1024   # wide tiles get 1024 px
just texture-fetch ambientcg Bricks076 --id mao-vell --size-m 1.6      # ambientCG gives no size
just texture-panot flor --id panot-flor --grain formigo --colour '#9d9b94'
just texture-photo foto.jpg --id nucli-front --size-m 9 4.2 \
    --corners 312,140 1830,188 1810,1290 296,1240 --licence 'own work' --author Aitor
just texture-photo 'https://commons.wikimedia.org/wiki/File:<file>.jpg' --id eixample-bays \
    --size-m 10.8 9 --bays 3 --storeys 3 --crop 120,80,2400,2000
just textures                                                          # list them
```

- `fetch` downloads the colour and OpenGL normal maps (roughness only with `--roughness`, when the
  game uses it), downscales to `--px` (default 512), checks that opposite edges match and blends
  the seams if they do not, and writes webp under 400 KB each.
- `photo` rectifies a facade by its four corners (top-left, top-right, bottom-right, bottom-left,
  in the photo's pixels) to its real width and height, or crops it straight with `--crop`.
  Flatten the light first if the photo has hard sun, and crop out people and cars.
- `panot` draws the exact tile pattern (joints, pastilles or the flower's grooves) as a height
  field, its normal map from it, and the cement's colour over the grain of a fetched texture, with
  a shade per tile; 16 × 16 tiles per texture so stains do not repeat every step.

Budget: webp, at most 1024 px (2048 only for one signature facade per place), each file under
about 400 KB (a test checks it). The street camera shows about 26–40 px a metre, so a 512 px
texture over 1.5–3 m is plenty; prefer large tiles (the asphalt covers 30 m) so the overview shows
no repetition.

### How they are used

**Surfaces.** Each surface of the street has a material: a texture and the colour it is tinted
to. Ground, street and roof UVs count metres, so every texture tiles at its real size and runs on
unbroken across polygons and roads. A tint makes the texture grey and then the given colour, so a
zone keeps its palette and gains the real grain and its normal map. Defaults (`LOOK_MATERIALS` in
`tools/geo.py`), chosen so the zones made before real materials keep their colours:

| Surface | Default | Tint |
| --- | --- | --- |
| `ground` (open ground) | `formigo`; `panot-gris` when `look.ground` is `panot` | `#cbc2ab`; panot keeps its own |
| `road` (and motorway) | `asfalt` | `look.asphalt`, else `#66625e` |
| `bike` | `asfalt` | as the road in Barcelona (`look.asphalt`), else the red bidegorri `#8a6b5f` |
| `footway` (paths) | `saulo` | `#b7a888` |
| `square` | `granit` | `#a99d88` |
| `grass` / `bed` / `forest` | `gespa` / `terra` / `gespa` | `#86a462` / `#4f4234` / `#4f6d42` |
| `sand` | `sorra` | its own |
| `rail` / `bridge` | `grava` / `carreu` | `#857b6f` / `#b3a68d` |
| `bank` (the walls of a sunk river, `look.river_m`) | painted stone | `#7d7b70` |

**Buildings.** The real grain goes *under* the painted bays: each plain wall is filled with the
building's own colour and the texture is laid over it as neutral grey grain (`hard-light`), then the
windows, balconies and shops are painted on top as before. So terraces still vary by colour, and
brick or ashlar stays under the windows, not over them. Roofs take the texture itself, tinted by
the style's `roof` colour. Defaults (`WALL_MATERIALS`, `BASE_MATERIALS`, `ROOF_MATERIALS`):

| Part | Default | Exceptions |
| --- | --- | --- |
| `wall` (upper floors) | `estuc` | `ashlar`, `ashlar-windows`: `carreu` (replaces the painted stone courses); `mall`: `formigo`; `curtain`, `hedge`: none |
| `base` (ground floor) | `carreu` | `masonry`: `mamposteria`; `mall-front`, `hedge`: none |
| `roof` | `teula` | `flat`: `rajola`; `hedge`: none |

**The contract in `zone.json`.** A string names a texture with its own colours; an object adds a
tint; `"none"` keeps the painted surface. Styles name `wall`, `base` and `roof`; a building's own
`materials` are merged over its style's.

```json
"look": {
  "ground": "panot",
  "asphalt": "#3e4043",
  "materials": { "ground": "panot-flor", "square": "saulo", "bed": { "texture": "terra", "tint": "#5a4632" } }
},
"styles": {
  "default": { "facade": "flats", "ground": "shops", "materials": { "wall": "mao", "roof": "rajola" } },
  "eixample": { "facade": "photo:eixample-bays", "ground": "photo:eixample-shops" }
},
"buildings": {
  "way/123": { "style": "eixample", "signature": "nucli-front", "materials": { "base": "granit" } }
}
```

What `just geo-build` writes into `src/geo/<zone>.json` (types in `src/geo.ts`):

```json
"materials": { "ground": { "texture": "panot-flor" }, "road": { "texture": "asfalt", "tint": "#3e4043" } },
"buildings": [{ "id": "way/123", "facade": "photo:eixample-bays", "materials": { "base": "granit", "roof": "rajola" }, "signature": "nucli-front" }],
"textures": { "panot-flor": { "kind": "material", "files": { "albedo": "albedo.webp", "normal": "normal.webp" }, "size_m": [3.2, 3.2], "mean": "#92908a" } }
```

A name with no folder in `public/textures/` is dropped with a warning at build time, so the game
paints that surface.

### Photo facades and signature facades

- **A photo atlas** (`"facade": "photo:<id>"` or `"ground": "photo:<id>"`): a `photo` texture with
  `bays` × `storeys` real bays, cut and rectified from photos (an Eixample row of balconies, a
  run of shop fronts). It repeats along every wall like the painted `flats` atlas, starting at a
  different bay on each wall; the game paints `flats` (or `shops` on the ground floor) until it
  loads. The atlas is stretched to the game's bays (1.8 cells wide, one storey high), so cut bays of
  about that proportion. No grain is added: the photo has its own.
- **A signature facade** (`"signature": "<id>"` on a building): one rectified photo of the real
  facade, at its real size, standing on the street in the middle of the wall that faces the camera
  (never wider or taller than that wall). Use it for the two or three facades a local would
  recognise (the game store's front, a friend's door); everything else stays bays.

## Landmarks

A landmark is a piece of a geo place drawn by its own code: the Sagrada Família's towers, a
fountain, a kiosk, a beach's lifeguard tower. Data in `zone.json`, code in one module per kind,
found without a list to edit. Hand-made interiors (the palace, the houses) stay as they are;
landmarks are for geo zones.

```json
"landmarks": [
  { "kind": "kiosk", "x_m": 14, "z_m": 6, "rotation_deg": 0, "size_m": [2.2, 1.5], "params": { "sign": "PREMSA" } },
  { "kind": "sagrada-familia", "id": "temple", "east_m": 0, "south_m": 0, "rotation_deg": 15,
    "size_m": [110, 60], "solid": true, "params": { "phase": "2026" }, "textures": ["pedra-montjuic"] },
  { "kind": "fountain", "osm": "node/4980345974", "params": { "colour": "#24384a" } }
]
```

| Field | Meaning |
| --- | --- |
| `kind` | Its module: `src/landmarks/<kind>.ts` |
| `id` | Optional name (default `<kind>-<n>`; map landmarks use their node id) |
| position | `east_m`/`south_m`, `x_m`/`z_m` in the turned frame, or `osm` (a map node or feature id) for the centre |
| `rotation_deg` | Turn round the vertical, counter-clockwise seen from above; at 0 the landmark's front (+z) faces the camera |
| `size_m` | Footprint `[width, depth]` in metres (default one cell) |
| `solid` | Default `true`: the cells whose centre is inside the turned footprint are blocked like a building, so places snap round it |
| `params` | Anything the builder reads (colours, a phase, a name). `building` (a `way/<id>`) says which building the landmark dresses: its `cut` pieces then join that building's cut and vanish with its wall, instead of floating in the hole (a belfry's bells, a church's windows, the town hall's turret) |
| `textures` | Texture ids the builder uses that the zone does not already use, so the build embeds them |

The map also gives small landmarks in every zone (`OSM_LANDMARKS` in `tools/geo.py`), on open
ground away from the zone's props: drinking fountains (`fountain`, amenity=drinking_water: three
in Alegia) and kiosks (`kiosk`, shop=kiosk: the ONCE booth on the Meridiana, which then gets no
sign on a wall). `osm_landmarks` turns them off or passes params.

**The builder.** `src/landmarks.ts` finds every `src/landmarks/*.ts` with Vite's
`import.meta.glob`; a module exports `kind` and `build(kit, landmark)`:

```ts
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

export const kind = 'gate';
export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const iron = kit.mat('Forja', String(landmark.params.colour ?? '#2e3a34'), 0.4);
  for (const x of [-2, 2]) kit.part('Pilar', 'box', kit.surface('granit', '#b9b2a6'), [x, 1.5, 0], [0.6, 3, 0.6]);  // metres, centre on the ground
  kit.part('Reja', 'box', iron, [0, 1.4, 0], [3.4, 2.6, 0.06]);
  const arch = kit.mesh();                                   // flat-shaded triangles, UVs in metres
  arch.quad([-2.3, 3, 0.3], [2.3, 3, 0.3], [2.3, 4.2, 0.3], [-2.3, 4.2, 0.3], [0, 0, 1], [0, 0], [4.6, 0], [4.6, 1.2], [0, 1.2]);
  kit.add('Arco', arch, kit.surface('carreu', '#d8cdb8'), { cut: true });   // tall enough to hide Gerard: it opens the cut
}
```

| Kit | What it gives |
| --- | --- |
| `root`, `cell` | The pivot at the landmark's centre, turned and scaled so **one unit is one metre**; metres per cell |
| `mat(name, hex, gloss, glow)` | A plain material, shared within the scene |
| `surface(texture, tint, gloss)` | A real material, tinted, tiling by metres on `mesh()` UVs; plain `tint` until it loads |
| `part(name, type, material, position, scale, rotation?, parent?)` | A primitive merged into the static batch |
| `mesh()` / `add(name, mesh, material, { cut, shadows, parent })` | Hand-built meshes (`quad`, `tri`, and `box(centre, size)` with UVs in metres); `cut: true` for anything tall enough to hide Gerard (its own cut group, like a building, or its building's with `params.building`), otherwise batched |
| `texture(canvas)` | A painted canvas texture (signs), destroyed with the scene |

Rules: build at real size in metres; nothing tall may hide Gerard (`cut: true`); reuse materials
(`mat` and `surface` share by name and colour) and prefer `part` or one `mesh()` per material so
draw calls stay low; text in the world is Spanish or Catalan as on the street, never guidance. A
kind with no module yet (data merged before code) draws a plain block on its footprint and warns;
`tests/materials.test.mjs` fails until the module exists. Make a new landmark reachable from the
development picker (`PLACES` in `src/jump-menu.ts`) like any new place.

## Traffic

A real street with `look.markings` gets cars, yellow taxis and the odd TMB bus (`src/traffic.ts`).
They drive the lanes of every `road` whose `highway` carries through traffic (not service roads,
alleys or living streets), keep right on two-way streets, never use the bus lane and turn at random
where streets meet, entering and leaving at the edges of the map. Where two such streets cross,
and at zebras with a `traffic-light` prop within 8 cells, junctions take turns: the longest street
through a junction gets the long green, the cross street and the people on foot the short one,
with amber and all-red in between, and neighbouring junctions turn green one after another. Each
traffic light shows the turn of the street it stands beside, its walk signal the opposite. Drivers
follow whoever is ahead, move over before a lane ends, keep out of a junction they could not clear
and stop for Gerard or his partner standing in front of them. Do not put parked `car` or moving-bus
props in a lane: they would block it; a bus at a stop goes in the bus lane.

A two-way `cycleway` at least 1.8 cells wide (the Meridiana's median) carries cyclists both ways,
one about every 55 cells each way, each on its own half; they keep behind the rider in front and
brake for anyone standing in their way. Where the scene has `grate` props, a train runs under them
every minute or so and its draught puffs out of each grate in turn as it passes (`src/game.ts`).

