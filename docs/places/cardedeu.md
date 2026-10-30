# Cardedeu · Carrer de Jacint Verdaguer

Nuria and Uri's street in Cardedeu (Vallès Oriental), from the R4 platform up to her door and the
old centre round it: the scene of Nuria's mission (`docs/quests/nuria.md`). Zone `cardedeu`
(real data, `assets/geo/cardedeu/`); Uri's tower round the corner is the separate zone
`cardedeu-laberinto` (designed, left as it is).

Status: researched and drafted 2026-10-30 (`zone.json` reframed and widened, OpenStreetMap
refetched, Nuria's block split for its two roofs). The build waits for the shared materials
pipeline, `src/landmarks/` and `docs/visual-style.md`. Until then `src/geo/cardedeu.json` is
still the old build: rebuilding it moves every cell (see the build plan, step 1).

## The real place

**The town.** Cardedeu (about 19,000 people, 193 m) sits on the Vallès plain between the coastal
range and the Montseny. The railway came on 1 September 1860, and with it the summer residents
from Barcelona: from 1880 the town filled with *torres d'estiueig*, cream villas with gardens,
little belvedere towers and iron railings, round an older core of narrow *cases de cós*. The
ground falls gently to the south: about 200 m at the church, 195 m at Doctor Daurella, 194.7 m at
Pau Gesa, 193.4 m on Rei En Jaume and at the station, 192.4 m on the tracks (EU-DEM 25 m). That is
a 2 % slope, so the game keeps the ground flat.

**Nuria's street.** Carrer de Jacint Verdaguer runs 6° west of north from Avinguda del Rei En
Jaume to Carrer del Doctor Daurella, crossing the Passeig de Pau Gesa (the Passeig left open in
the quest doc). It is one-way, 30 km/h, asphalt, with pavements on both sides, cars along the
east kerb and zebras at both ends. Read from the aerial (`assets/references/environments/
cardedeu-jacint-verdaguer/aerial.png`, local):

- **Nuria's block** (west side, Pau Gesa to Doctor Daurella): about 47 × 13 m, two storeys,
  white render. Its roof is **two hipped roofs end to end** with a valley halfway, orange barrel
  tiles, a white rim round the eaves and a notch at the south-east corner. A strip of small front
  patios behind low walls lines the street.
- **The corner house** (Doctor Daurella corner): one storey under a flat light-grey metal-sheet
  roof (the "white roof"), then a red-tiled terrace, a lawn, hedges and a big tree.
- **Behind** the block: a long grass plot with an old concrete slab, then a taller block of flats
  on Marià Borrell (storeys to check in Street View).
- **East side**: old terraced houses with tile roofs and skylights at the Doctor Daurella end, a
  walled sandy yard, then a walled garden under one **huge dark evergreen canopy** (about 25 m
  across, a cedar or holm oak), a hedge along the pavement, a small white shed at the Pau Gesa end.

**Round it** (OpenStreetMap, Commons, Wikipedia):

- **Museu Arxiu Tomàs Balvey** (Doctor Daurella 1, the Casal Daurella, 1848, ground floor and two
  storeys): the town museum, with a whole old pharmacy inside (the Balvey apothecaries, in use
  until 1954). Its garden of Mediterranean medicinal plants opens onto the Passeig de Pau Gesa.
- **Plaça de Sant Joan** (1915) with the **town hall, Torre Lligé**: a cream villa with a
  five-arch porch under a balustraded terrace, a clock in the central gable, green louvred
  shutters and a small square belvedere with its own hipped roof. The square is *sauló* (pale
  compacted sand) with pollarded plane trees, benches and an orange information totem.
- **Plaça d'Anselm Clavé** with the **Fleca Vella de Josep Puig** (Can Puig, date stone 1550):
  three storeys of ochre render, grey granite quoins, a carved Gothic-revival window over an iron
  balcony, the iron letters FLECA VELLA, a granite plinth and a scalloped parapet. Bakeries here
  sell **borregos de Cardedeu**, long aniseed biscuits made since 1770, most of all in All Saints'
  week. Forn de pa Domènech is a second bakery nearby.
- **Santa Maria** (16th–18th c.) on Plaça de l'Església: grey stone, a square bell tower of 27 m
  with Catalan merlons, the town's skyline. Beside it, alone on a gravel square, the tiny
  pre-Romanesque chapel of **Sant Corneli**.
- **The station** (R2 Nord and R11; the game adds the R4): one storey of butter-yellow render
  under Arab tiles with a scalloped eave course; a taller gabled hall behind an L-shaped porch of
  four round arches facing platform 1; sandstone-tile bases on the piers; a round clock, iron
  wall lanterns, a red ticket machine. Platform 1 runs between the building and the tracks: grey
  concrete pavers, a yellow line, about 1 m above the rails, grey fences, cone-topped lamps, an
  underpass east of the building. Lattice catenary gantries span the two tracks. Behind: big
  cedars, a cypress, and across Avinguda del Rei En Jaume cream summer houses with little towers
  and the salmon-pink Residència Anthurium.
- **The Montseny**, 15–19 km to the north and north-north-east (Matagalls, Turó de l'Home, Les
  Agudes): a broad blue massif with a pale crest, snow-dusted in winter, seen from everywhere.

**What changed recently.** OpenStreetMap now maps Carrer de Teresa Oller and the Diagonal
Fiveller as pedestrian-priority living streets (20 km/h); new flats are going up south of the
tracks (crane in the February 2025 photos); the platform signs read *Rodalies de Catalunya*
(April 2026 photo). The R4 to Cardedeu is the game's fiction (`clue-r4`).

**What a local would recognise**: the station's arcade and clock, the Torre Lligé belvedere, the
Fleca Vella's yellow front and iron letters, Santa Maria's tower over the roofs, the *sauló*
square with its plane trees, borregos in a bakery window, and the Montseny at the end of every
northbound street.

## References

| Source | What it showed | Licence |
| --- | --- | --- |
| Aerial, `assets/references/environments/cardedeu-jacint-verdaguer/aerial.png` | Nuria's block and its two hipped roofs, the corner house, the east side, parked cars | Reference only (local) |
| [OpenStreetMap](https://www.openstreetmap.org/#map=18/41.6373/2.3544), fetched 2026-10-30 | Streets, the station (19 × 14 m, one storey, half-hipped roof), platforms, tracks (R2 Nord, R11), the town hall, museum, Fleca Vella, Santa Maria, Sant Corneli, shops and bars | ODbL |
| [Cardedeu](https://ca.wikipedia.org/wiki/Cardedeu), Viquipèdia | Altitude, the railway in 1860, summer residents from 1880, Santa Maria's 27 m tower, the pharmacy museum, Fleca Vella 1550 | CC BY-SA |
| [Estació de Cardedeu.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_Cardedeu.jpg), Friviere | The station's arcade from platform 1 | CC BY-SA 3.0 |
| [004 Estació de Cardedeu.jpg](https://commons.wikimedia.org/wiki/File:004_Estaci%C3%B3_de_Cardedeu.jpg), Enric | The porch corner, scalloped eave, pier bases, lanterns, clock | CC BY-SA 4.0 |
| [Estació de tren de Cardedeu 02.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_tren_de_Cardedeu_02.jpg), Brunnaiz | The station front from across the tracks, the yellow and cream houses behind | CC BY-SA 4.0 |
| [Estació de Cardedeu - 20260419 204242.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_Cardedeu_-_20260419_204242.jpg), Pere López Brosa | Platform 1 at dusk: pavers, yellow line, gantries, lamps, Rodalies board | CC BY-SA 4.0 |
| [Estació de tren de Cardedeu 01.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_tren_de_Cardedeu_01.jpg), Brunnaiz | Underpass stairs, fences, fields and works south of the tracks | CC BY-SA 4.0 |
| [Estació de Cardedeu - P1110911.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_Cardedeu_-_P1110911.jpg), [P1110912](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_Cardedeu_-_P1110912.jpg), [P1040680](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_Cardedeu_-_P1040680.jpg), Pere López Brosa | Cedars, the cypress, the towered houses and Residència Anthurium | CC BY-SA 4.0 |
| [170 Torre Lligé, Ajuntament de Cardedeu](https://commons.wikimedia.org/wiki/File:170_Torre_Llig%C3%A9,_Ajuntament_de_Cardedeu,_pl._Sant_Joan_1.jpg), Enric | The town hall's porch, terrace, clock gable, belvedere, shutters | CC BY-SA 4.0 |
| [Ajuntament de Cardedeu .jpg](https://commons.wikimedia.org/wiki/File:Ajuntament_de_Cardedeu_.jpg), Friviere | Plaça de Sant Joan: *sauló*, a pollarded plane tree, benches | CC BY-SA 3.0 |
| [Cardedeu - Fleca Vella.jpg](https://commons.wikimedia.org/wiki/File:Cardedeu_-_Fleca_Vella.jpg), Friviere | The Fleca Vella front, straight on | CC BY-SA 3.0 |
| [135 Cases al passeig de Pau Gesa, 63-65](https://commons.wikimedia.org/wiki/File:135_Cases_al_passeig_de_Pau_Gesa,_63-65_(Cardedeu).jpg), [134](https://commons.wikimedia.org/wiki/File:134_Cases_al_passeig_de_Pau_Gesa,_59-65_(Cardedeu).jpg), Enric | Old two-storey houses: moulded frames, iron balconies, panelled doors with grilles | CC BY-SA 4.0 |
| [Vista del centre de Cardedeu des de aire.JPG](https://commons.wikimedia.org/wiki/File:Vista_del_centre_de_Cardedeu_des_de_aire.JPG), Rigic | The old centre from above: Santa Maria and its tower, tile roofs, flat terraces | CC BY-SA 3.0 |
| [Montseny from Cardedeu.jpg](https://commons.wikimedia.org/wiki/File:Montseny_from_Cardedeu.jpg), Randomizedimages | The Montseny's profile and colour from the town's fields | CC BY-SA 3.0 |
| [Museu Arxiu Tomàs Balvey](https://museudecardedeu.cat/) and [femturisme.cat](https://femturisme.cat/ca/establiments/museu-arxiu-tomas-balvey-cardedeu) | The museum building (1848) and its garden opening onto Pau Gesa | Facts only |
| [Cardedeu's borregos](https://www.cataloniatoday.cat/article/1586345-cardedeu-s-borregos.html), Catalonia Today | Borregos, aniseed biscuits from 1770, sold in the town's bakeries | Facts only |
| [OpenTopoData EU-DEM](https://www.opentopodata.org/datasets/eudem/) | Ground heights across the zone | Facts only |
| Google Maps and Street View, the viewpoints in `zone.json` (`output/geo/cardedeu/google/links.md`) | To look at during the build: facade colours, storeys behind the block, the front patios | Reference only, never copied |

Photos downloaded for study are in `output/refs/cardedeu/` (git-ignored).

## Identity card

Checked against the other places: the Meridiana is cool Barcelona concrete and *panot*; Alegia is
cream and timber over rubble-stone ground floors in a green valley; Sant Quirze is suburban and
the palace is pink. Cardedeu is the warm one: a yellow-and-white railway town of the 1900s under
the Montseny. Today it borrows Alegia's look (cream walls, rubble ground floors, green shutters,
wooden rails), which the build has to undo.

| | |
| --- | --- |
| Dominant hue | Butter and ochre yellow render: `#ecd69c` (station), `#e7c36d` (Fleca Vella), with lime white `#f4f0e8` (Nuria's block) |
| Secondary hue | Terracotta barrel tiles `#b05a3a`, weathered `#9a5b40`; olive-green louvred shutters `#5f7048` |
| Signature material | Smooth stucco in warm tones over a grey plinth, Arab barrel-tile roofs, grey Montseny granite for quoins and plinths |
| Ground | Narrow asphalt streets with grey pavers and granite kerbs; *sauló* `#cdb48a` in Plaça de Sant Joan; grey setts in the old squares; the platform's grey slabs and yellow line |
| Silhouette | Low (one to three storeys), hipped roofs, belvedere towers on the villas, Santa Maria's square tower at the back, the Montseny's long blue ridge beyond |
| Landmarks | The station's arcade, Torre Lligé, the Fleca Vella, Santa Maria's tower |
| Light and mood | A calm Vallès afternoon: low warm sun, long soft shadows, golden on the yellow walls, the mountain hazy blue `#7d8ca3`. Quiet, a town where everyone walks; slightly warmer and softer than Barcelona (the current `cardedeu` grade fits) |
| Props kit | Cars along one kerb, garden walls with railings and iron gates, hedges, cypresses, stone pines, cedars, pollarded plane trees, wrought-iron balconies, wall lanterns, the station clock, cone-topped platform lamps, lattice catenary gantries, the orange Rodalies totem, benches on *sauló* |
| Ambient sound | Santa Maria's bell at the quarters and a Rodalies train passing (the platform chime when near the station) |
| Only here | Borregos in the Fleca Vella's window, the long aniseed biscuits of Cardedeu |

## Layout

`assets/geo/cardedeu/zone.json` (real data):

- **Framing**: `rotation_deg` 6 (was 96), so Jacint Verdaguer runs straight along z. North is at
  the back: the old centre and, beyond the edge, the Montseny. The railway and platform 1 face the
  camera, so the station's arcade, Nuria's street front, the town hall's porch and the Fleca
  Vella's front are all on seen sides. At 96° the arcade faced away and anyone on the platform
  stood behind the station.
- **Bounds**: west −65, east 195, north −133, south 112 m from the anchor (Jacint Verdaguer at the
  crossing with Pau Gesa): 227 × 217 cells of 1.25 m (was 174 × 231), 203 buildings (was 169),
  29,098 walkable cells. The north edge now takes in Plaça de Sant Joan, Plaça d'Anselm Clavé, the
  Fleca Vella, Santa Maria and Sant Corneli; the south edge stops just past the second track.
- **Spawn**: platform 1 in front of the arcade (150, 90). The way out is round the west end of
  the station to Avinguda del Rei En Jaume, west to Jacint Verdaguer, then north to the block.
- **Places**: `station-cardedeu` (the arcade, a step to leave), `cardedeu-estacio` (the station
  sign), and three new things to look at, all on seen sides: `cardedeu-fleca` (the window),
  `cardedeu-ajuntament` (the clock), `cardedeu-jardi` (the museum garden gate on Pau Gesa).
- **Labels** on the ground: PASSEIG DE PAU GESA, AV. DEL REI EN JAUME (both run along x).
- **Anchors** (metres, so they survive any reframing): `nuria-door`, `haru-station`,
  `maze-corner`, `maze-back` (the mission's spots, today hard-coded cells in
  `src/friends/nuria.ts`) and `campanar` (Santa Maria's tower, position to confirm).
- **Props drafted**: the six cars of the aerial along the east kerb, the big tree, the corner
  garden's trees, a cypress and a tree by the station, LED lamps along platform 1, a bench on the
  platform and one in Plaça de Sant Joan.
- **Styles drafted** with today's kinds, to be replaced in the build: `estacio`, `ajuntament`,
  `fleca`, `esglesia` and warmer default walls.

`assets/geo/cardedeu/sketch.json`: Nuria's block is now two buildings, `casa-nuria-nord` and
`casa-nuria` (her door, labelled), so each gets its hipped roof and the valley shows between them.
The rest of the sketch (the corner house, the east side, the generated `casa-fila-*` rows where
OpenStreetMap has no footprints) is unchanged.

A draft build (`just geo-build cardedeu`, then reverted) confirmed the framing in the game: the
arcade and platform face the camera, the parked cars line the right kerb, the Fleca Vella and the
town hall show their fronts. Its preview is `output/geo/cardedeu/preview.png`.

## Texture candidates

CC0 (ambientCG, Poly Haven), tinted per style where a colour is given:

| Use | Asset | Notes |
| --- | --- | --- |
| Roof tiles | Poly Haven `clay_roof_tiles_02` | Orange Arab barrel tiles; houses and the station |
| Old roofs | ambientCG `RoofingTiles014B` | Dirty, older barrel tiles: the old centre, the church |
| Fine stucco | ambientCG `Plaster003` | Tinted per wall colour: town houses, villas, station, town hall |
| Textured render | Poly Haven `beige_wall_002` | The 1960s–70s rough render (*gota*): Nuria's block, the flats behind |
| Sandstone bases | ambientCG `Bricks099` | The station's pier bases and plinth tiles |
| Church stone | Poly Haven `large_sandstone_blocks` | Tinted grey for Santa Maria and its tower |
| Granite | ambientCG `Granite003A` at a small scale | Speckle for painted quoins and plinths (the Fleca Vella) |
| Pavement, platform | Poly Haven `concrete_pavement_02` | Grey square slabs |
| Old squares, forecourt | ambientCG `PavingStones126A` | Grey rectangular setts |
| *Sauló* | Poly Haven `gravel_ground_01` | Tinted `#cdb48a`: Plaça de Sant Joan, Sant Corneli |
| Ballast | ambientCG `Gravel022` | Under the sleepers |
| Platform edge | ambientCG `TactilePaving003` | The yellow tactile strip |
| Fallen leaves | ambientCG `ScatteredLeaves008` | Plane leaves on the *sauló* (late October) |

Wikimedia Commons (credit in `public/textures/credits.json`):

| Use | File | Author, licence |
| --- | --- | --- |
| The Fleca Vella's front (the one signature facade, up to 2048 px) | [Cardedeu - Fleca Vella.jpg](https://commons.wikimedia.org/wiki/File:Cardedeu_-_Fleca_Vella.jpg) | Friviere, CC BY-SA 3.0 |
| Same, second choice | [195 Can Puig, la Fleca Vella, pl. Anselm Clavé 11](https://commons.wikimedia.org/wiki/File:195_Can_Puig,_la_Fleca_Vella,_pl._Anselm_Clav%C3%A9_11_-_c._Teresa_Oller_(Cardedeu).jpg) | Enric, CC BY-SA 4.0 |
| Old-house bays (window over an iron balcony, panelled door), cleaned and desaturated | [135 Cases al passeig de Pau Gesa, 63-65](https://commons.wikimedia.org/wiki/File:135_Cases_al_passeig_de_Pau_Gesa,_63-65_(Cardedeu).jpg) | Enric, CC BY-SA 4.0 |
| Station colours and arch proportions (painted, not copied) | [Estació de tren de Cardedeu 02.jpg](https://commons.wikimedia.org/wiki/File:Estaci%C3%B3_de_tren_de_Cardedeu_02.jpg) | Brunnaiz, CC BY-SA 4.0 |

The town hall is painted from its photo rather than textured with it: the photos carry banners
and flags that do not belong in the game.

## Build plan

Each step is one or a few commits and leaves the game playable.

1. **Rebuild and keep the mission working.** `just geo-build cardedeu`; move the mission's cells
   in `src/friends/nuria.ts` to the zone's anchors (read from the built scene, so a later reframe
   cannot break them) and Haru's spot to the platform's west end; update the cells in
   `scripts/screenshots/cardedeu.json` and `nuria.json`. Both scenarios already fail on this
   branch before any change: their first wait expects the title to start with `Meridiana`, and
   `?story=metro` now opens on `Avinguda Meridiana`. Loosen that wait. `npm test`
   (`tests/nuria.test.mjs` checks the cells are walkable).
2. **Development picker.** Add `cardedeu` (and `cardedeu-laberinto`, debug only) to `PLACES` in
   `src/jump-menu.ts`; today the place panel shows the bare id `cardedeu`.
3. **Vallès facades.** Two new kinds in `facade()` (`src/geo-scenery.ts`), on the shared real
   materials: `vila` (smooth stucco, moulded frames, green or brown louvred shutters or roller
   blinds, a small iron balcony on the first floor) and ground `socol` (stucco over a grey plinth,
   panelled doors, a barred window). They replace `rendered` and `masonry` (Alegia's timber and
   rubble) everywhere in Cardedeu. Vary roofs: gabled for the `casa-fila` rows, flat terraces for
   some newer blocks, hips for villas.
4. **Nuria's block.** The two hips with the white rim; front patios with low walls and iron gates
   along the street; her door marked by a doormat and a plant pot (no sign). The corner house's
   metal roof, terrace and lawn.
5. **The station** (a landmark module): the L-shaped porch with four round arches towards the
   platform, the taller gabled hall, the scalloped eave, sandstone pier bases, clock, lanterns,
   ticket machine. Platform 1 raised 1 m over the rails with grey slabs, the yellow line and
   edge; cone-topped lamps; lattice gantries over the tracks every 50 m; grey fences; the orange
   Rodalies totem. A Rodalies train at platform 1 when they arrive is optional.
6. **Street level and kerbs.** Pavements 15 cm above the asphalt with a granite kerb; zebras at
   both ends of Jacint Verdaguer; *sauló* in Plaça de Sant Joan with pollarded plane trees and
   fallen leaves; setts in Plaça d'Anselm Clavé and Plaça de l'Església.
7. **The old centre's landmarks** (modules or styles): Torre Lligé's porch, terrace and
   belvedere; the Fleca Vella's front from Commons with borregos in the window; Santa Maria's
   tower at `campanar` (position checked against the aerial photo), the church in grey stone;
   Sant Corneli. Fill the centre's footprint gaps in the sketch with three-storey *cases de cós*
   along the street fronts.
8. **Gardens, walls and gates.** Walled gardens in the block interiors (now bare beige):
   garden walls with railings and gates on the street fronts, hedges, lawns and patios; new tree
   species `pine` (stone pine) and `cedar` beside `plane`, `olive`, `cypress`, `yucca`; the big
   evergreen across the street as a cedar.
9. **The Montseny.** The hills ring's back side becomes the Montseny: a long blue ridge `#7d8ca3`
   with a pale crest, beyond the north edge and to the right of centre, given as data in
   `zone.json` (a reusable `horizon` profile, so Alegia could have its own).
10. **Sound and light.** Santa Maria's quarter bells and the passing train as the zone's ambience
    (`docs/audio.md`); keep the warm grade, check it against the new yellows.
11. **Uri's tower** (`cardedeu-laberinto`): materials only (hedge and path textures from the
    shared pipeline); layout and gameplay untouched.
12. **Checks and pictures.** `just typecheck`, `npm test`, `uv run --locked python -m unittest
    discover -s tests` if `tools/` changes; `just screenshots cardedeu --gpu` (arrival on the
    platform, the walk to the door, the old centre, the overview) and `just screenshots nuria
    --gpu`. Watch the draw calls: 203 buildings now, more with the centre filled.

## Approximate and open

- Storeys of the block of flats behind Nuria's and of the generated rows: guessed (2–3); to read
  in Street View.
- The big tree's species, the front patios and the corner house's wall colour come from the
  aerial alone.
- Santa Maria's tower position (`campanar`) is inferred from the footprint; confirm.
- Nuria's door: kept where the mission had it (south half of the block); the real number is still
  unknown.
- The second platform and the land beyond the tracks are scenery, not walkable.
- No town cats besides Haru and Yuki, so nobody mistakes another cat for the guide.
