# Cardedeu · Carrer de Jacint Verdaguer

Nuria and Uri's street in Cardedeu (Vallès Oriental), from the R4 platform up to her door and the
old centre round it: the scene of Nuria's mission (`docs/quests/nuria.md`). Zone `cardedeu`
(real data, `assets/geo/cardedeu/`); Uri's tower round the corner is the separate zone
`cardedeu-laberinto` (designed, left as it is).

Status: built 2026-10-31. Researched and reframed on 2026-10-30, then rebuilt on the shared real
materials with its own facades, landmarks, gardens and horizon (§ How it was built). Nuria's
mission reads its spots from the zone's anchors, so it survived the rebuild. `just screenshots
cardedeu --gpu` and `just screenshots nuria --gpu` show it.

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
cream and timber over rubble-stone ground floors in a green valley, under a cool sky; Sant Quirze
is suburban and the palace is pink. Cardedeu is the warm one: a railway town of summer houses from
around 1900, low and gardened, under the Montseny. Before this build it borrowed Alegia's look
(cream walls, rubble ground floors, green shutters, wooden rails, bare yards); the build removed it.

Changed from the research card: the research led with the yellow render. From the diorama camera,
roofs and gardens fill most of the screen, so the built card leads with them, as the guide's
matrix already did (`docs/visual-style.md` § 2). The yellow and white render is what the follow
camera sees at street level. Colours below were measured on the overview screenshot (median per
group).

| | |
| --- | --- |
| Dominant hue | Terracotta Arab tiles seen from above `#b66e43` (22 % of the town in the overview), weathered browner in the old centre (`#86604f`–`#946049`), and garden green `#8a9a57` (12 %) |
| Secondary hue | Butter and ochre render (`#ecd69c` station, `#e7c36d` Fleca Vella), warm lime white on Nuria's block (`#f3e9d8`); olive-green or brown louvred shutters (`#5f7048`, `#6b4f3a`); grey granite plinths |
| Signature material | Hipped barrel-tile roofs (`teula`, a mix of tones per house), smooth render over a granite plinth (`estuc`, `granit`), lawns behind every row (`gespa`) |
| Ground | Asphalt streets with pale pavements; *sauló* in Plaça de Sant Joan; grey stone slabs from wall to wall in the old centre (`lloses`); the platform's grey slabs with the yellow line |
| Silhouette | Low (one to three storeys), hipped roofs with a white rim under the eaves, dark garden trees between them, Santa Maria's square tower at the back, the Montseny's long blue ridge beyond the north edge |
| Landmarks | The station's porch of four round arches with its clock; Torre Lligé (the town hall) with five arches, terrace, clock gable and belvedere; the Fleca Vella's real front; Santa Maria's tower |
| Light and mood | `cardedeu` look: a calm Vallès afternoon, warm (temperature +.07), `day` sky; the mountain hazy blue |
| Props kit | Cars along the east kerb, garden walls with railings and iron gates, front patios with pots, hedges, cedars, stone pines, olives, cypresses, plane trees, cone-topped platform lamps, lattice catenary gantries, the platform's name boards, benches on *sauló* |
| Air | Pollen (the default outside) |
| Sound | Not built: Santa Maria's bell at the quarters and a Rodalies train passing would be its own (`docs/audio.md`) |
| Only here | Borregos in the Fleca Vella's window (in Gerard's line), the white-roofed corner house in its garden |
| Text | Catalan: *Passeig de Pau Gesa*, *Av. del Rei En Jaume*, *Plaça de Sant Joan* on the ground; *Cardedeu* on the platform boards; *Fleca Vella* on its real front |

## Layout

`assets/geo/cardedeu/zone.json` (real data from OpenStreetMap plus `sketch.json`):

- **Framing**: `rotation_deg` 6 (was 96), so Jacint Verdaguer runs straight along z. North is at
  the back: the old centre and, beyond the edge, the Montseny. The railway and platform 1 face the
  camera, so the station's arcade, Nuria's street front, the town hall's porch and the Fleca
  Vella's front are all on seen sides.
- **Bounds**: west −65, east 195, north −133, south 112 m from the anchor (Jacint Verdaguer at the
  crossing with Pau Gesa): 227 × 217 cells of 1.25 m, 153 buildings, 29,945 walkable cells. The
  north edge takes in Plaça de Sant Joan, Plaça d'Anselm Clavé, the Fleca Vella, Santa Maria and
  Sant Corneli; the south edge stops just past the second track.
- **Spawn**: platform 1 in front of the arcade. The way out is round the west end of the station to
  Avinguda del Rei En Jaume, west to Jacint Verdaguer, then north to the block.
- **Places**: `station-cardedeu` (the arcade, a step to leave), `cardedeu-estacio` (the sign), and
  four things to look at on seen sides, each answered by Gerard in a short Spanish line with no
  hint: `cardedeu-fleca` (the window and its borregos), `cardedeu-ajuntament` (the clock and the
  belvedere), `cardedeu-jardi` (the museum garden's gate on Pau Gesa), `cardedeu-campanar` (Santa
  Maria's tower).
- **Anchors** (metres, so they survive any reframing): `nuria-door`, `haru-station`,
  `maze-corner`, `maze-back`, read by `src/friends/nuria.ts`, and `campanar`.
- **Gardens**: `yards` turns the ground 5 m or more from any street (15 m from the railway) into
  lawn with a garden tree every 8 m, at 1.45 times the usual size (cedars, stone pines, olives,
  planes, cypresses), as the aerial photo shows behind every row. They stay walkable.
- **Generated rows**: `sketch.json` lines with houses (`casa-fila-*`) the streets OpenStreetMap left
  empty before the reframe. Those that the wider frame put on mapped buildings or gardens were
  removed on review (2026-10-31): 51 houses doubled the old centre's mapped houses, filled the
  museum's garden and Casa Pere Llibre's, and stood on the yard across Nuria's street. Casa Pere
  Llibre's garden (private on the map) got a low wall with railings on its two streets and big
  trees, inferred, not seen in a photo.

## How it was built

| Piece | Where | What it does |
| --- | --- | --- |
| Town houses | `vila` and `socol` in `facade()` (`src/geo-scenery.ts`) | Upper floors as an atlas of 3 bays × 2 storeys: moulded frames, louvred shutters in the house's colour, French windows on small iron balconies with geraniums, a string course and a white band under the eaves. Ground floor: render over a granite plinth, panelled doors under barred fanlights, barred windows or a garage shutter. `plain` is the station hall's bare render; gables of `vila` houses stay plain |
| Roofs | `styles.*.roof` as a list (`tools/geo.py`) | Each house picks a tone: salmon to brown in the new streets, browner in the old centre (`centre`), a flat light-grey sheet roof on the corner house (`cantonada`) |
| Nuria's block | `sketch.json`, `patis` landmark | Two hipped roofs end to end over the 47 m block; a row of front patios with low rendered walls, railings, gates, tiles and a pot in each |
| Garden walls | `tanca` landmark | Rendered walls with a stone coping, railings and gates between pillars, a hedge behind: the big garden across Nuria's street and the museum garden on Pau Gesa |
| The station | `porxo`, `andana`, `catenaria` landmarks | The porch of four round arches with the clock, lanterns, ticket machine and bench; platform 1 with its paving, yellow line, edge, cone lamps, name boards and fence; lattice gantries over both tracks |
| Torre Lligé | `torre-llige` and `porxo` landmarks | The town hall's clock gable and belvedere, and its five-arch porch under a balustraded terrace |
| Fleca Vella | `signature: fleca-vella` | The real front from Commons, at its real size, on the wall facing the camera |
| Santa Maria | `esglesia` style, `campanar` landmark | Grey stone church and its 27 m square tower with Catalan merlons |
| Old centre paving | `llosat` landmark, `lloses` texture | Grey stone slabs from wall to wall over the living streets round Plaça d'Anselm Clavé and Plaça de l'Església |
| Plaça de Sant Joan | zone props | *Sauló*, eight plane trees with pale trunks, benches, two lamps |
| Gardens | `yards` (`tools/geo.py`) | Lawn and big garden trees behind the houses (§ Layout) |
| Trees | `cedar` and `pine` in `src/props.ts` | Garden cedars in uneven flat tiers and umbrella-topped stone pines, beside the existing species |
| Horizon | `montseny` landmark, `look.hills: false` | The Montseny's ridge (Turó de l'Home and Les Agudes right of the middle) beyond the north edge, hazy blue with a paler crest, its facets softened as distance does; wooded hills in front of it. It replaces the generic hills |
| Zebras | `pas-zebra` landmark | Both ends of Jacint Verdaguer |
| Mission | `src/friends/nuria.ts`, `tests/nuria.test.mjs` | Nuria's door, Haru's spot and the maze corner come from the anchors; the test also checks the cells round her door are walkable |
| Picker | `PLACES` in `src/jump-menu.ts` | `cardedeu` and `cardedeu-laberinto`, group *Cardedeu* |

Draw calls (`--gpu`, measured with a throwaway probe): about 1,450 following Gerard and 9,500 in
the overview, in line with the Meridiana's 9,900.

## Textures and credits

Credits live in each texture's `public/textures/<id>/texture.json`.

| Texture | Used for | Source | Licence |
| --- | --- | --- | --- |
| `fleca-vella` | The Fleca Vella's signature front (4.3 × 10.4 m) | [Cardedeu - Fleca Vella.jpg](https://commons.wikimedia.org/wiki/File:Cardedeu_-_Fleca_Vella.jpg), Friviere, Wikimedia Commons | CC BY-SA 3.0 |
| `lloses` | The old centre's stone slabs (2.4 m tile) | ambientCG [PavingStones126A](https://ambientcg.com/a/PavingStones126A) | CC0 |
| `estuc`, `teula`, `rajola`, `granit`, `saulo`, `gespa`, `formigo`, `carreu`, `grava`, `asfalt` | Render, roof tiles, terrace and patio tiles, plinths, *sauló*, lawns, open ground, church stone, ballast, streets | The shared library, Poly Haven | CC0 |

The town hall, station and houses are painted from the photos in § References, not textured with
them: the photos carry people, cars, banners and hard sun.

## Approximate and open

- **Approximate**: the storeys of the block of flats behind Nuria's and of the generated rows (2–3);
  the big tree's species, the front patios and the corner house's walls (from the aerial alone);
  Santa Maria's tower position (inferred from the footprint); Nuria's door (kept where the mission
  had it; the real number is unknown); the extent of the stone paving (the living streets round
  the two squares; the real paving may reach further along Sant Antoni and Teresa Oller).
- **Gardens are generated**: every patch of ground well back from the streets becomes lawn with
  trees. Real yards also hold patios, sheds and pools, and garden edges follow the cells, so they
  step along diagonal streets.
- **Not built**: pavements raised over the asphalt with granite kerbs (shared work, not started);
  the station's scalloped eave course and half-hipped roof (a plain hip today); a Rodalies train at
  the platform; the orange Rodalies totem; Sant Corneli beyond a plain block; fallen plane leaves
  on the *sauló*; the bells and the passing train.
- **Gerard's legs** can hide for a moment behind a near roof at some corners when the cut does not
  open (the shared see-through rule); the screenshots avoid it, play may show it.
- **Plane trees** in Plaça de Sant Joan use the shared plane species, a little brighter than the
  real pollarded planes in autumn.
- The second platform and the land beyond the tracks are scenery, not walkable.
- No town cats besides Haru and Yuki, so nobody mistakes another cat for the guide.
- `cardedeu-laberinto` (Uri's tower) is untouched.
