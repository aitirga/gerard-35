# Barcelona · world map, metro and train

Chapter 2's world is Barcelona (and later a little beyond: Cardedeu). It works on two levels:

1. **Places**: playable 3D scenes, one per spot the story needs (the Meridiana outside the flat,
   the Rec Comtal school, later a station or a friend's street). Each is **designed by hand**,
   inspired by the real place and simplified on purpose. Only a handful exist; most of the city is
   never walked.
2. **The network map**: the whole city as a **cartoon**, with its sea, hills, rivers, districts,
   big avenues and famous places, and the metro lines over it. It is what Gerard sees when he goes
   down into a station, and how he travels between places. It is never a 3D scene.

No map data is downloaded for Barcelona: neither OpenStreetMap nor anyone's district files. The
real city is the inspiration; the shapes are our own.

```
assets/geo/barcelona/city.json ──► just city ──► src/geo/barcelona.json ──► src/city-map.ts (SVG) ──► travel-ui.ts
 (hand-drawn: coast, hills, rivers,   tools/city.py      projected                ▲
  districts, avenues, landmarks,      + output/city/preview.svg                   │
  places, stations, lines; [lat, lon])                               src/map-markers.ts (icons)
src/transit.ts  lines, stations, which place each station opens, story rules for lines
```

## The network map

### Look

- **Cartoon.** Flat colours, soft rounded shapes (the hand-drawn points are joined by curves),
  a thick dark outline on what matters, little waves on the sea, a sandy beach along the coast,
  round green hills for Collserola and Montjuïc, the Eixample with its grid.
- **North-west up, sea at the bottom.** The map is turned so the coast runs left to right along
  the bottom edge (Llobregat on the left, Besòs on the right) and Collserola rises along the top:
  the way people from Barcelona picture their city.
- **Few lines.** For now only the **L1 (red)** and the **L5 (blue)**, thick and outlined, with
  chunky white stations. More lines (the R4 to Cardedeu) are added when a place on them exists.
- **Where Gerard is**: a small pin on the current station. Nothing marks a friend, a mission or a
  "go here".

### Markers

Everything drawn as an icon on the map is a **marker** (`src/map-markers.ts`): data (`id`, `icon`,
`name`, position, `size`, `level`, `label`) drawn by one cartoon drawing in `ICONS`. The map takes
a list of markers; the story decides which (`cityMarkers(state)`):

| Marker | Icon | When |
| --- | --- | --- |
| Famous places (Sagrada Família, Torre Glòries, Park Güell, Tibidabo, Montjuïc, Camp Nou, Barceloneta, Fòrum, Arc de Triomf, Sant Pau) | `temple`, `tower`, `park`, `wheel`, `castle`, `stadium`, `beach`, `sun`, `arch`, `dome` | Always |
| Home | `home` | Always |
| The Rec Comtal school | `school` | Until the TV news |
| La Reina Bubbaloo's castle | `bubbaloo` | From the TV news; its size and towers follow the castle's threat (`level`) |

A new kind of marker is one drawing in `ICONS` (a 2 × 2 box, bottom at y = 1, the outline is
added) and one entry where markers are listed. Markers say what is in the city; they never say
what to do next (`AGENTS.md`).

### Travel

1. A station entrance in a place is an interaction (*"Bajar al metro"*).
2. The network map opens on that station. Selectable stations are the ones that lead to a place
   (bigger, glowing); the rest are drawn but cannot be picked. Arrows, the stick, the mouse or the
   D-pad move between them; Enter/A travels; Esc/B goes back up.
3. The trip: a small train runs along the line on the map, changing at shared stations; then the
   screen fades and the party comes up the destination's entrance.
4. Lines can be closed by the story (`transit.ts` rules), with a person or sign in the world
   saying why.

### Data

`assets/geo/barcelona/city.json`, all hand-drawn in latitude/longitude:

| Field | What |
| --- | --- |
| `frame` | Projection centre, rotation (degrees) and the margin round the city |
| `coast`, `hills`, `rivers` | The sea edge, Collserola and Montjuïc, the Besòs and Llobregat |
| `districts` | `id`, `name`, `colour`, optional `pattern` (`grid`), and a few points of a soft blob |
| `avenues` | Diagonal, Gran Via, Meridiana: named lines with a width class |
| `landmarks` | `id`, `name`, `kind` (its icon), `at` |
| `places` | Points the story puts its own markers on (`home`, `rec-comtal`) |
| `stations`, `lines` | Stations (`id`, `name`, `at`) and lines (`id`, `name`, `kind`, `colour`, ordered `stations`) |

`just city` (`tools/city.py`) projects it to `src/geo/barcelona.json` and writes a rough preview
in `output/city/`.

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
| La Sagrera | L1, L5 | Platform with the R4 poster | Next |
| Cardedeu | R4 (to add) | Nuria and Uri | Next |

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
doors and named `anchors` (where the palace stands).

- **`meridiana-calle`**: the Avinguda Meridiana by Fabra i Puig: side roads, two carriageways with
  a planted median, blocks of flats with shops, home's door and the L1 entrance.
- **`rec-comtal`**: Trinitat Vella round the Institut Escola Rec Comtal (Via de Bàrcino 90, Mare
  de Déu de Lorda 25): the school's two buildings and playground, Via de Bàrcino in front facing
  the camera, blocks of flats, the L1 entrance and the castle on the roof.

## The TV news set

The news is filmed, not drawn (`src/news-set.ts`, `game.startBroadcast`). For the broadcast the
flat steps aside and `rec-comtal` is built as a set: the castle on the school at its current
threat, a police cordon and two patrol cars with their lights going, neighbours filming with their
phones, a reporter and her cameraman, the TV van with its dish, a helicopter circling and the
pupils' backpacks by the gate. A perspective camera films it in shots that loop (`NEWS_SHOTS`):
from the helicopter, the reporter with the castle behind her, a neighbour's shaky phone, the street
behind the patrol car. `src/news-ui.ts` lays the broadcast's graphics over it.

## Architecture: generic pieces, unique content

Every location, line, friend, ánima, mission, foe and clue is **data first**, with **one optional
hook** for what only it does. Generic code never names a specific friend; a friend's file never
reimplements movement, dialogue or battle.

| Element | Generic part | Where | Unique part |
| --- | --- | --- | --- |
| Place | Grid, buildings, roads, props, places to look at, station entrances | `assets/geo/<zone>/`, `src/environments.ts` | Its own props or a landmark model; its story triggers |
| Station / line | Network graph, travel, the map | `src/transit.ts`, `src/travel-ui.ts` | Closures and clue posters per station |
| Map marker | An icon on the network map, from data | `src/map-markers.ts` | Its drawing (the castle's towers follow its threat) |
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
