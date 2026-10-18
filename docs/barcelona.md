# Barcelona · world map, metro and train

Chapter 2's world is Barcelona (and a little beyond: Cardedeu). It works on two levels:

1. **Places**: playable 3D scenes, one per spot the story needs (the Meridiana outside the flat,
   the Rec Comtal school, a station, a friend's street). Built like Alegia, from map data
   (`docs/environment-styling.md`). Only a handful exist; most of the city is never walked.
2. **The network map**: the whole city drawn schematically, with its sea, mountains, rivers,
   avenues and landmarks, and the metro and Rodalies lines over it. It is what Gerard sees when he
   goes down into a station, and how he travels between places. It is never a 3D scene.

```
bcn-geodata (CartoBCN districts + barris) ──┐
assets/geo/barcelona/city.json ─────────────┼─► just city ─► src/geo/barcelona.json ─► src/city-map.ts (SVG)
 (coast, hills, rivers, avenues, landmarks,  │   tools/city.py      projected, simplified        ├─ travel-ui.ts (station map)
  lines and stations in lat/lon)            ─┘   + output/city/preview.svg                     └─ news-ui.ts (TV aerial map)
src/transit.ts  lines, stations, which place each station opens, story rules for lines
```

## The network map

### Look

- **North-west up, sea at the bottom.** The map is turned so the coast runs left to right along
  the bottom edge (Llobregat on the left, Besòs on the right) and Collserola rises along the top:
  the way people from Barcelona picture their city. The Eixample grid then reads straight.
- **Layers, back to front**: sea (deep blue with soft waves), land (warm paper), Collserola and
  Montjuïc (soft green with a hatched ridge), the Besòs and Llobregat (thin blue), the ten
  districts (pale tiles with white borders, names in small caps), main avenues (Diagonal, Gran
  Via, Meridiana, Paral·lel, Passeig de Gràcia, Rondes), landmarks (small hand-drawn pictograms:
  Sagrada Família, Torre Glòries, Park Güell, Tibidabo, Montjuïc, Camp Nou, Barceloneta, Fòrum,
  Arc de Triomf, Sant Pau), and the lines on top.
- **Lines**: metro lines in their official colours as thick rounded strokes with white-ringed
  stations; Rodalies as a thinner double stroke in its own colour with its "R" roundel. Shared
  stations are drawn as linked rings. A line that leaves the city (the R4 towards Cardedeu)
  runs to the map's edge and ends in a labelled tab with its destination.
- **The castle** pulses in pink on the Rec Comtal school once the TV has shown it; the palace
  is part of the world, not a marker.
- **Where Gerard is**: a small portrait pin at the current station. Nothing else is marked: no
  friends, no missions, no "go here".

### Travel

1. A station entrance in a place is an interaction (*"Bajar al metro"*, *"Coger el tren"*).
2. The network map opens on that station. Selectable stations are the ones that lead to a place
   (bigger rings with a soft glow); the rest are drawn but cannot be picked. Arrows, the stick, the
   mouse or the D-pad move between selectable stations; Enter/A travels; Esc/B goes back up.
3. The trip: a small train runs along the line on the map, changing at shared stations, with the
   line's name shown; then the screen fades and the party comes up the destination's entrance.
4. Lines can be closed by the story (`transit.ts` rules): the line is drawn dimmed with a person or
   sign in the world saying why.

### Data

`assets/geo/barcelona/city.json` is hand-authored in latitude/longitude:

| Field | What |
| --- | --- |
| `frame` | Projection centre, rotation (degrees) and the map's extent in metres |
| `coast`, `hills`, `rivers` | Polylines / polygons for the sea edge, Collserola and Montjuïc, the Besòs and Llobregat |
| `avenues` | Named polylines with a width class |
| `landmarks` | `id`, `name`, `kind` (pictogram), `at` |
| `lines` | `id`, `name`, `kind` (`metro`/`rodalies`), `colour`, ordered `stations` |
| `stations` | `id`, `name`, `at`, optional `offmap` (drawn at the edge, e.g. Cardedeu) |

`just city` (`tools/city.py`) projects everything, simplifies the CartoBCN district and
neighbourhood polygons (downloaded once from [bcn-geodata](https://github.com/martgnz/bcn-geodata),
CC-BY Ajuntament de Barcelona) and writes `src/geo/barcelona.json` plus a preview in
`output/city/`. Coordinates of stations, avenues and landmarks are approximate and schematic: good
for a drawn map, not a survey. Verify a station against TMB's or Rodalies' maps before building a
place on it.

## Places and stations

`src/transit.ts` joins the two levels:

- **Station → place**: a station that leads somewhere names the scene and the cell where the
  party comes up (`place: { environment, cell }`), and the scene has an interaction with the same
  station id to go back down.
- **Lines**: a line is an ordered list of station ids. Any two stations on the network are
  connected (changing lines at shared stations); `route(from, to)` returns the stations the train
  passes, for the animation.
- **Rules**: a line or station can be closed by the story (`closed(story)` reads flags) and only
  stations with a place are destinations. These rules are pure and tested (`tests/transit.test.mjs`).

| Station | Lines | Place | Status |
| --- | --- | --- | --- |
| Fabra i Puig | L1 | `meridiana-calle` (home's street) | Sketch |
| Trinitat Vella | L1 | `rec-comtal` (the school under the palace) | Sketch |
| La Sagrera | L1, L5, R4 | Platform with the R4 poster | Next |
| Cardedeu | R4 (extension) | Nuria and Uri | Next |

### Making a new place reachable

1. Build the scene (`docs/environment-styling.md`): a zone in `assets/geo/<zone>/`, `just geo
   <zone>`, three lines in `src/environments.ts`.
2. Put a station entrance in it: a `places` entry in `zone.json` with the station's id
   (`station-<id>`) and a metro or train sign prop.
3. In `src/transit.ts`, give the station its `place`.
4. Add it to a screenshot scenario.

## Sketched zones (when OpenStreetMap cannot be reached)

`just geo-fetch` needs OpenStreetMap (Nominatim, Overpass or the OSM API). When it cannot reach
them, a zone can be **sketched**: `assets/geo/<zone>/sketch.json` holds hand-drawn features in
metres from the anchor (buildings as rectangles or polygons, roads and paths as lines with an
OSM-style `highway`, squares, grass, water, rail). `just geo-build` uses `osm.json` when it exists
and the sketch otherwise; with both, sketch features marked `"keep": true` are added on top (a
fictional element on a real street). The attribution of a sketched scene says so, and the zone is
listed as *Sketch* until `just geo <zone>` replaces it with real data.

`meridiana-calle` and `rec-comtal` are sketched for now (this environment could not reach
OpenStreetMap). Their anchors are real: the school's is the Institut Escola Rec Comtal at
41.45105, 2.19168. Run `just geo meridiana-calle` and `just geo rec-comtal` on a machine with
network access, then check the previews against Google Maps/Street View as the styling guide says.

## Architecture: generic pieces, unique content

Every location, line, friend, ánima, mission, foe and clue is **data first**, with **one optional
hook** for what only it does. Generic code never names a specific friend; a friend's file never
reimplements movement, dialogue or battle.

| Element | Generic part | Where | Unique part |
| --- | --- | --- | --- |
| Place | Grid, buildings, roads, props, places to look at, station entrances | `assets/geo/<zone>/`, `src/environments.ts` | Its own props or a landmark model; its story triggers |
| Station / line | Network graph, travel, the map | `src/transit.ts`, `src/travel-ui.ts` | Closures and clue posters per station |
| Trigger | A cell and a radius that fires `near` once | `story.triggers(environment)` | What the story does with it |
| Door redirect | A door can lead elsewhere by story state | `story.redirect(id)` | The palace's exit, home's door |
| Anchor and look | Named points in a scene (`anchors` in `zone.json`); a `look` effect turns the camera to one while people talk | `game.look(anchor)` | The castle on the school |
| Friend | Scene(s), NPC, lines, flags | `src/chapter-2.ts` (later one file per friend) | Their mission's mechanic |
| Ánima | Colour, stat bonus, class or skill it brings | `src/animas.ts` | The moment it is given |
| Clue | A line or text in the world that sets a `clue-*` flag | `src/chapter-2.ts` | Where it hides |
| Encounter | Foes, party, rules, presentation | `src/battle.ts`, `src/battle-scene.ts` | Each encounter's own rule (the minion's shell, the guards' scaling) |
| Story beat | Events in, effects out | `src/story.ts` | The beat's lines and cut-scene |

Conventions:

- **Content in data, rules in pure modules, presentation separate.** As in chapter 1:
  `story.ts`/`transit.ts`/`battle.ts` are pure and tested; `game.ts` and the `*-ui.ts` files only
  show what they say.
- **Flags are forever** in chapter 2 (open progression). Name them by what happened
  (`tv-news`, `metro`, `anima-uri`), never by what the player should do next.
- **Every gate is a person or a thing** with a line, and every gate has a test that the line plays.
- **One file per friend** once a friend's mission grows past a few beats
  (`src/friends/<id>.ts` with its lines, places, triggers and hook), registered in one list.
