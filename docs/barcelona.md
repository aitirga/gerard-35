# Barcelona · world map, metro and train

Chapter 2's world is Barcelona (and later a little beyond: Cardedeu). It works on two levels:

1. **Places**: playable 3D scenes, one per spot the story needs (the Meridiana outside the flat,
   the Rec Comtal school, later a station or a friend's street). Each is **designed by hand**,
   inspired by the real place and simplified on purpose. Only a handful exist; most of the city is
   never walked.
2. **The network map**: the whole city as a **3D model**, a cartoon of the real Barcelona with
   its sea, hills, rivers, streets and every building, its famous places, and the metro lines
   running over the roofs. It is what Gerard sees when he goes down into a station, and how he
   travels between places. It is looked at, never walked.

The city under the lines is **real**: Barcelona's streets, coast, rivers, parks and buildings
from OpenStreetMap. Stations, lines, landmarks and places on top are drawn by hand.

```
OpenStreetMap ──► just city-fetch ──► assets/geo/barcelona/streets.json (simplified, committed)
              └──► just city-fetch-buildings ──► output/city/buildings.json (footprints, heights; not committed)
                                                   │
assets/geo/barcelona/city.json ──► just city ──► src/geo/barcelona.json ──► src/city-map.ts (SVG) ──► travel-ui.ts
 (hand-drawn: coast, hills, rivers,   tools/city.py      projected                ▲        ▲
  districts, avenues, landmarks,         │                                        │        │
  places, stations, lines; [lat, lon])   ├► output/city/background.svg ──► public/maps/barcelona.webp (ground)
                                         │  (just city-background, Chromium)
                                         └► public/maps/barcelona-buildings.bin ──► src/city-3d.ts (the model)
                                                                                   src/map-markers.ts (icons)
src/transit.ts  lines, stations, which place each station opens, story rules for lines
```

## The network map

### Look

- **A model of the real city** (`src/city-3d.ts`, its own PlayCanvas app in the panel). The
  ground is one picture (`tools/city.py` `background`, rendered into `public/maps/barcelona.webp`):
  streets, big roads wider and lighter, railways, parks, woods (Collserola, Montjuïc), beaches,
  rivers and the sea. On it stands **every building** from OpenStreetMap at its height
  (`height`, else `building:levels`, else a guess by kind), stretched ×2.4 so the city reads from
  high up: warm facades for homes, greys for works and offices, terracotta for churches, schools
  and other civic buildings, glass for towers; lit from the left like the icons, roofs a shade
  lighter. The buildings are cut into 8 × 8 meshes. Districts are never drawn.
- **The lines over the roofs**: thick slabs in the line's colour with dark ink sides, a round
  joint at every station, a post down to the street under each station and a soft shadow on the
  ground.
- **Drawn on top, upright**: stations, their names, the pin, the trip and the markers are one SVG
  over the canvas, moved every frame to where the camera sees them, so they never tilt. From far
  away only the names that matter stay.
- **Falls back** to the flat cartoon plan (`src/city-map.ts`: the picture with blocks lifted in
  2.5D, or the hand-drawn sea, hills, rivers and avenues before the first `just city-fetch`) when
  WebGL or the buildings are missing.
- **Landmarks are abstract little volumes** lit from the left like the blocks, on a soft
  shadow: a cluster of spires, a bullet tower dotted with windows, the solar pergola…
- **North-west up, sea at the bottom.** The map is turned so the coast runs left to right along
  the bottom edge (Llobregat on the left, Besòs on the right) and Collserola rises along the top:
  the way people from Barcelona picture their city. The camera looks at it from the sea side,
  tilted; the player can turn it round.
- **Few lines.** Only the lines that reach a place, thick and outlined, with chunky white
  stations, in the colours of TMB's line signs: the **L1 (red)** from Santa Eulàlia to Fondo, the
  **L3 (green)** from Sants Estació down the Paral·lel to Catalunya and Diagonal, the **L4
  (yellow)** from Verdaguer down to the beaches at Llacuna, the **L5 (blue)** from Badal to Vall
  d'Hebron, and the Rodalies **R4 (ochre)** from La Sagrera to Cardedeu. A line is cut where the
  story stops needing it, but it always stops at its real stations in their real order; more lines
  (the L2 through Sagrada Família, the L3 north to Vall d'Hebron) are added when a place on them
  exists.
- **Where Gerard is**: a small pin on the current station. Nothing marks a friend, a mission or a
  "go here".

### Markers

Everything drawn as an icon on the map is a **marker** (`src/map-markers.ts`): data (`id`, `icon`,
`name`, position, `size`, `level`, `label`) drawn by one cartoon drawing in `ICONS`. The map takes
a list of markers; the story decides which (`cityMarkers(state)`):

| Marker | Icon | When |
| --- | --- | --- |
| Famous places (Sagrada Família, Torre Glòries, Park Güell, Tibidabo, Montjuïc, Camp Nou, Barceloneta, Fòrum, Arc de Triomf, Sant Pau, Plaça d'Espanya's Venetian towers, the Búnkers del Carmel) | `temple`, `tower`, `park`, `wheel`, `castle`, `stadium`, `beach`, `pergola`, `arch`, `dome`, `venetian`, `bunker` | Always |
| Home | `home` | Always |
| The Rec Comtal school | `school` | Until the TV news |
| La Reina Bubbaloo's castle | `bubbaloo` | From the TV news; its size and towers follow the castle's threat (`level`); a pink halo round it widens as her power spreads (`reach`) |

A new kind of marker is one drawing in `ICONS` (a 2 × 2 box, bottom at y = 1, the outline is
added) and one entry where markers are listed. Markers say what is in the city; they never say
what to do next (`AGENTS.md`).

### Travel

1. A station entrance in a place is a totem (the red M, the line and the station's name) beside a
   stair going down between granite kerbs and glass, lit from the hall. Walking into the stair goes
   down (the place's `step` cells); pressing E beside it (*"Bajar al metro"*) does the same.
2. The network plan opens on the station wall: white tiles, the station's name on a dark sign in
   its line's colour, the plan framed on where Gerard is (*Estás aquí*) and where he can go, every
   station named, the lines' ends in the legend. Selectable stations are the ones that lead to a
   place (bigger, glowing); the rest are drawn but cannot be picked. Arrows, the stick, the mouse
   or the D-pad move between them, and the trip to the one picked is dashed on the plan with its
   stops and changes; Enter/A travels. The wheel or +/− zoom, dragging pans, dragging with the
   right button (or Shift) turns and tilts the model, 0 shows the whole city. Esc/B goes back up:
   the party stands at the entrance again.
3. The trip: a small train runs along the line over the roofs, changing at shared stations, the
   camera drifting after it; then the screen fades and the party comes up the destination's
   entrance.
4. Lines can be closed by the story (`transit.ts` rules), with a person or sign in the world
   saying why.

### Data

`assets/geo/barcelona/city.json`, all hand-drawn in latitude/longitude:

| Field | What |
| --- | --- |
| `frame` | Projection centre, rotation (degrees) and the margin round the city |
| `coast`, `hills`, `rivers` | The sea edge, Collserola and Montjuïc, the Besòs and Llobregat |
| `districts` | `id`, `name`, `colour`, optional `pattern`, and a few points of a soft blob: not drawn; they set the map's extent |
| `avenues` | Diagonal, Gran Via, Meridiana: named lines with a width class |
| `landmarks` | `id`, `name`, `kind` (its icon), `at` |
| `places` | Points the story puts its own markers on (`home`, `rec-comtal`) |
| `stations`, `lines` | Stations (`id`, `name`, `at`: OpenStreetMap's station node, between the platforms when lines meet) and lines (`id`, `name`, `kind`, `colour`, ordered `stations`) |

`just city` (`tools/city.py`) projects it to `src/geo/barcelona.json`, writes a rough preview
in `output/city/`, and, when `streets.json` exists, draws the ground and renders it
(`just city-background`, `scripts/city-background.mjs`); when `buildings.json` exists, it
projects the buildings into `public/maps/barcelona-buildings.bin` (int16s: per building its
height, kind, point count and points in map metres; committed, unlike `buildings.json`, which
stays in `output/city/`) and leaves the lifted blocks out of the ground. `just city-fetch` and `just city-fetch-buildings` download them again from Overpass tile
by tile (5 × 5 and 6 × 6 tiles over the map's extent widened so wide screens show city too; each
tile is kept in `output/city/`, so a run that fails halfway only asks again for what is missing).
Data © OpenStreetMap contributors (ODbL).

**Without `buildings.json`** (a fresh checkout: it is not committed), the build keeps the committed
ground and buildings as they are and only redraws the hand-drawn layers, stations, lines and
landmarks: drawing the ground again without the buildings would stand the blocks back up in it.
It stops instead if the districts moved the map's extent, since the old ground would no longer fit.
So a new station or line only needs `uv run --locked python tools/city.py build` (what `just city`
runs before rendering the ground, which then has nothing to render).

## Places and stations

`src/transit.ts` joins the two levels:

- **Station → place**: a station that leads somewhere names the scene, and the scene has an
  interaction with the station's id (`station-<id>`): the party comes up there and goes back down
  there.
- **Lines**: a line is an ordered list of station ids. Any two stations on the network are
  connected (changing lines at shared stations); `route(from, to)` returns the legs the train
  takes, for the animation.
- **Rules**: a line or station can be closed by the story and only stations with a place are
  destinations. Pure and tested (`tests/transit.test.mjs`).

| Station | Lines | Place | Status |
| --- | --- | --- | --- |
| Fabra i Puig | L1 | `meridiana-calle` (home's street) | Playable |
| Trinitat Vella | L1 | `rec-comtal` (the school under the palace) | Playable |
| La Sagrera | L1, L5, R4 | Change for the R4 (the poster clue is on the Meridiana's bus shelter) | On the map |
| Sant Andreu (Rodalies) | R4 | — | On the map |
| Plaça de Sants | L1, L5 | El Nucli, the game store where Gerard meets Bernat | On the map |
| Espanya | L1, L3 | Plaça d'Espanya | On the map |
| Poble Sec | L3 | Poble Sec | On the map |
| Barceloneta | L4 | `barceloneta` (the beach: Platja de Sant Miquel, L'Estel Ferit) | Playable |
| Sagrada Família | L5 | The temple's surroundings and its inside | On the map |
| El Carmel | L5 | The Búnkers del Carmel | On the map |

Other changes, where the real lines meet: Catalunya (L1, L3), Urquinaona (L1, L4), Passeig de
Gràcia (L3, L4), Diagonal (L3, L5) and Verdaguer (L4, L5). From home the beach is a change at
Urquinaona, Poble Sec one at Catalunya, Plaça d'Espanya the L1 all the way.
| Cardedeu | R4 | Nuria and Uri (`docs/quests/nuria.md`) | At the map's edge (`edge` in `city.json`: a town beyond the map waits at its border, named with an arrow) |

### Making a new place reachable

1. Design the scene (below): `assets/geo/<zone>/zone.json` and `sketch.json`, `just geo-build
   <zone>`, three lines in `src/environments.ts`.
2. Put a station entrance in it: a `places` entry with the station's id (`station-<id>`) and a
   `metro` prop.
3. In `src/transit.ts`, give the station its `place`; add the station (and its line) to
   `city.json` if the map does not have it yet.
4. Add it to a screenshot scenario.

## Designed zones

Barcelona's places are **designed by hand**: `assets/geo/<zone>/sketch.json` holds features in
metres from the zone's anchor (buildings as rectangles or polygons, roads and paths as lines with a
`highway` kind, squares, grass, water), inspired by how the real place looks and simplified for
play. `just geo-build <zone>` turns them into the scene with the same builder and looks as the
other real places (`docs/environment-styling.md`): facades, roofs, trees, props, places to look at,
doors and named `anchors` (where the palace stands). A sketch may be drawn in the turned frame
(`"frame": "turned"`: x along the street, z towards the camera) and give features extra OSM `tags`
(`lanes`, `oneway`, `bus:lanes`, `width`); next to an `osm.json`, only its `keep` features are added.

- **`meridiana-calle`**: the Avinguda Meridiana from Fabra i Puig to Hipercor (Meridiana 350-356),
  the one real-data zone of Barcelona: OpenStreetMap for the blocks, cross streets, street trees,
  lamps, benches, shops and zebra crossings (`osm.json`), with the avenue's own cross-section after
  the 2025-26 works redrawn in `sketch.json` (`redraw`) from photos taken on it in October 2026.
  Turned -62° so the avenue runs left to right with the even side, the shops, facing the camera:
  the wide panot sidewalk with plane trees and benches, the curb bed, the side road with the bus
  lane and the Sagalés coach at the shelter, the planted median with the bike lane and young
  staked trees, the works' red and white barriers and sacks, the two carriageways and the west bed.
  Real signs on the ground floors (Granier, 365, Vision-Prix, General Óptica, Al Meu BB, Café
  Entrepans, Zamora Floristas' kiosk…), Hipercor's box with its blue letters and the dark tower
  behind, the graffiti hoarding in front of it, home's corner block (Casa) and the L1 entrance.
- **`cardedeu`**: Nuria's street in Cardedeu (`docs/quests/nuria.md`), a real-data zone like
  Alegia: OpenStreetMap (`osm.json`) from Carrer del Doctor Daurella down to the railway, with the
  R4 station on Avinguda del Rei En Jaume, plus what the map lacks drawn in `sketch.json` from the
  aerial reference: Nuria's long two-storey block with a hipped terracotta roof (her door the first
  on Carrer de Jacint Verdaguer), the white-roofed corner house, the houses and gardens across the
  street. Turned 90° so her block faces the camera.
- **`barceloneta`**: the beach of the L4 (`docs/places/barceloneta.md`), a real-data zone:
  OpenStreetMap for the old Barceloneta's blocks, the beach, the promenade, its palms and showers,
  with the sea drawn in `sketch.json` along the real coastline and drawn by `src/geo-sea.ts`
  (waves, white water, the swash on the wet sand). Turned 65° so the sea faces the camera: the
  Platja de Sant Miquel with L'Estel Ferit, the volleyball courts, the lifeguard post and the old
  lookout, the Passeig Marítim's parapet and palms, the blocks behind with washing on the
  balconies; the L4 stair at the end of a street on the back edge (the real station is 700 m
  inland), the breakwater and the W's sail past the ends.
- **`rec-comtal`**: Trinitat Vella round the Institut Escola Rec Comtal (Via de Bàrcino 90, Mare
  de Déu de Lorda 25): the school's two buildings and playground, Via de Bàrcino in front facing
  the camera, blocks of flats, the L1 entrance and the castle on the roof.

## The TV news set

The news is filmed, not drawn, and it plays **on the TV in the flat** (`src/news-tv.ts`). While the
party is at home, `rec-comtal` is built as a news set on its own render layer, lit by its own sun so
nothing of it touches the flat: the castle on the school at its current threat and size, a police
cordon and two patrol cars with their lights going, neighbours filming with their phones, a reporter
and her cameraman, the TV van with its dish, a helicopter circling and the pupils' backpacks by the
gate (`src/news-set.ts`). A news camera films it into a texture shown on the TV's screen, in shots
that loop (`NEWS_SHOTS`): from the helicopter, the reporter with the castle behind her, a
neighbour's shaky phone, the street behind the patrol car. The broadcast's graphics (EN DIRECTO,
the shot's caption, ÚLTIMA HORA with the day's headline, the ticker) are drawn on a canvas over the
picture. Watching it is the game's camera coming close to the TV.

## Architecture: generic pieces, unique content

Every location, line, friend, ánima, mission, foe and clue is **data first**, with **one optional
hook** for what only it does. Generic code never names a specific friend; a friend's file never
reimplements movement, dialogue or battle.

| Element | Generic part | Where | Unique part |
| --- | --- | --- | --- |
| Place | Grid, buildings, roads, props, places to look at, station entrances | `assets/geo/<zone>/`, `src/environments.ts` | Its own props or a landmark model; its story triggers |
| Station / line | Network graph, travel, the map | `src/transit.ts`, `src/travel-ui.ts` | Closures and clue posters per station |
| Map marker | An icon on the network map, from data | `src/map-markers.ts` | Its drawing (the castle's towers follow its threat; her halo, the spread) |
| Day and hour | What an activity costs, when the day ends, how far she has spread | `src/days.ts`, `story.spend` | How each place shows the spread |
| Castle threat | One number from the ánimas; the palace and its marker read it | `castleThreat` in `src/animas.ts`, `palace.setThreat` | Which tower falls when |
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
