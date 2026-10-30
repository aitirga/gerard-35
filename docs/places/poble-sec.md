# Poble Sec · Carrer de Blai and the Montjuïc slope

Status: research and draft (2026-10-30). Nothing is wired into the game yet: the zone draft lives in
`assets/geo/poble-sec/` (`zone.json` and the OpenStreetMap data in `osm.json`), and the build waits
for the shared foundation (real materials in `tools/textures.py`, landmark modules in
`src/landmarks/`, `docs/visual-style.md`).

Where Emilie lives (`docs/story-outline.md`, People: a friend of Gerard and Aitor, very clever; her
mission will be a technical problem). This step gives her a corner and a door to look at, no mission.

| Id | What | How it is reached |
| --- | --- | --- |
| `poble-sec` | Carrer de Blai from Carrer de Salvà to Plaça dels Ocellets, the cross streets that climb towards Montjuïc as far as Carrer d'Elkano, Emilie's corner at Blai and Margarit, and the slope rising behind as the backdrop | Metro: the station `poble-sec` (L3, already on the network map), its entrance in Plaça dels Ocellets |

## The real place in 2026

- **Where.** El Poble-sec is the strip of streets between Avinguda del Paral·lel and Montjuïc, built
  for workers from 1858 on land the Cerdà plan left out. Its streets form two sets: long ones that
  follow the hill's contour (Blai, Elkano, Magalhães, Blesa) and short steep ones that climb
  straight up it (Salvà, Poeta Cabanyes, Tapioles, Margarit, Blasco de Garay, Creu dels Molers),
  many of them ending in stairs where the houses stop and Montjuïc's park begins.
- **Carrer de Blai.** About 450 m long and 9.5-10 m from wall to wall, pedestrian, paved in grey
  concrete slabs with no kerbs (already so in photos from 2012), with young trees in square pits.
  Since about 2010-2011 it has been Barcelona's pintxos street: bars side by side on both sides, counters
  of pintxos speared on toothpicks (you pay by counting the toothpicks on your plate), terraces of
  folding tables, chalkboards and menu boards, busy from the evening on. OpenStreetMap lists about
  fifty bars, restaurants and shops on it (La Tasqueta de Blai, Blai 9, Koska, Blai Tonight, Bota
  Bar, La Tiza, Vi & Beers, Mai Tanca…), a library and a greengrocer or two.
- **It is level.** Blai runs along the contour: within 4 m from end to end (EU-DEM 25 m). The cross
  streets rise about 3 m from Blai to Elkano, then steeply: Magalhães +6 m, Passeig de l'Exposició
  +17 m, the foot of the Margarit stairs +31 m and their top +50 m.
- **The houses.** Narrow lots (6-10 m), four to seven storeys, from the 1880s to the 1970s side by
  side. The old ones: warm render (ochre, sand, sienna, pale peach, cream) often scored as fake
  ashlar or banded in red, an iron balcony per French window, rolled-up slatted blinds hung over the
  railings, green or brown shutters, plant pots, washing, aerials. Some modernista fronts with
  curved crowns and sgraffito (Blai 56-58, 1906: pale green flowers on ochre; Creu dels Molers 22;
  Blai 37 in stone). Later infill in exposed brick or cream with continuous balconies. Flat roofs
  (*terrats*) with water tanks, aerials and washing lines. Ground floors: bars, a few shops, roller
  shutters covered in graffiti, some painted with portraits of Catalan artists (Joan Manuel Serrat,
  born on Poeta Cabanyes, among them).
- **Cross streets.** One-way asphalt with narrow sidewalks, cars on one side, motorbikes, balconies
  close overhead; looking up them, Montjuïc's pines; looking down, the Paral·lel.
- **Landmarks round Blai.** The church of Santa Madrona (1888, Adrià Casademunt, neo-Gothic; its
  images and furniture burnt in the Tragic Week of 1909 and it was damaged again in the Civil War;
  Lluís Bonet i Garí restored it and added the sandstone bell tower with its clock and octagonal
  top) on Carrer de Tapioles, just below Blai; the Biblioteca Poble Sec - Francesc Boix at Blai 34,
  named after the Poble Sec photographer who hid the negatives of Mauthausen; Plaça dels Ocellets,
  the small square where Blai meets the Paral·lel; Plaça del Sortidor further up, with its cast-iron
  Canaletes-style fountain and lamp.
- **What changed recently.** Carrer d'Elkano, the next street up, was rebuilt from Jaume Fabra to
  Margarit from September 2024, a year of works: a single-level street at its top end, and from
  Radas to Margarit a raised pavement with parking bays that zigzag, raised crossings and a tree
  every 13 m behind stone bollards. Neighbours complained in 2022 that Blai's paving and drainage
  fail (water pools in the empty tree pits); no works on Blai were found.
- **The metro.** El Poble-sec (L3, 1975) is under the Paral·lel between Carrer de Manso and Carrer
  del Parlament; its only entrance on the Poble Sec side is at Carrer de Teodor Bonaplata, about
  210 m west of Plaça dels Ocellets. Paral·lel (L2, L3 and the Montjuïc funicular) is at the other
  end of Blai, about 240 m away.

### Sources

- Wikipedia: [Poble-sec](https://en.wikipedia.org/wiki/Poble-sec),
  [El Poble-sec (ca)](https://ca.wikipedia.org/wiki/El_Poble-sec),
  [Poble Sec station](https://en.wikipedia.org/wiki/Poble_Sec_station) (read 2026-10-30).
- Betevé, [the rebuilding of Carrer
  d'Elkano](https://beteve.cat/societat/comenca-reurbanitzacio-carrer-elkano-poble-sec-2024/)
  (2024).
- Barcelona, [Aplec de Santa
  Madrona](https://www.barcelona.cat/culturapopular/en/festivals-and-traditions/aplec-de-santa-madrona)
  and [Saint Madrona in Poble-sec](https://barcelona.cat/culturapopular/en/noticia/474362);
  [campaners.com](https://www.campaners.com/php/torrepdf.php?numer=5919) (the church and its tower).
- Food guides on Blai and the toothpick count, for example [Barcelona
  Metropolitan](https://www.barcelona-metropolitan.com/api/amp/eating-and-drinking/la-ruta-de-pintxos-i-tapes-del-poble-sec/).
- OpenStreetMap (ODbL), fetched 2026-10-30 (Overpass for `osm.json`, the OSM API for the survey):
  every building of the zone, Blai's segments (`way/893988157` to `way/893988164`, pedestrian,
  paving stones), Plaça dels Ocellets (`way/323693656`), the church (`way/215873439`), the shops
  and bars, the station (`node/5312707123`) and its entrance at Teodor Bonaplata
  (`node/1238021382`), and the stairs up the hill (Carrer de Margarit `way/35381108`, 204 steps;
  Blasco de Garay `way/192238394`, 70; Roser `way/192239287`, 23).
- Elevations: EU-DEM 25 m through [OpenTopoData](https://www.opentopodata.org/) (relative heights
  only).
- Photos looked at (Wikimedia Commons, all openly licensed; downloads stay in
  `output/refs/poble-sec/`):

| What | File | Author | Licence |
| --- | --- | --- | --- |
| Looking down Carrer del Roser from Passeig de l'Exposició: the slope, balconies, washing, aerials | [Carrer del Roser des del Passeig de l´Exposició - Poble Sec.jpg](https://commons.wikimedia.org/wiki/File:Carrer_del_Roser_des_del_Passeig_de_l%C2%B4Exposici%C3%B3_-_Poble_Sec.jpg) | Jaume Meneses | CC BY-SA 2.0 |
| The bay of Poble Sec: curved iron balconies, carved lintels, rolled slatted blinds | [Elkano 61.jpg](https://commons.wikimedia.org/wiki/File:Elkano_61.jpg) | Xavier Badia Castellà | CC BY-SA 3.0 |
| A bar and its terrace on Blai under a modernista front | [Blai 56-58.baixos.jpg](https://commons.wikimedia.org/wiki/File:Blai_56-58.baixos.jpg) | Xavier Badia Castellà | CC BY-SA 3.0 |
| The sgraffito front of Blai 56-58 (1906) | [Blai 56-58.jpg](https://commons.wikimedia.org/wiki/File:Blai_56-58.jpg) | Xavier Badia Castellà | CC BY-SA 3.0 |
| Blai's ground floor, slabs, street plate, red bands | [Blai 41.jpg](https://commons.wikimedia.org/wiki/File:Blai_41.jpg) | Xavier Badia Castellà | CC BY-SA 3.0 |
| Santa Madrona's tower among balconies | [Barcelona - Iglesia de Santa Madrona 02.jpg](https://commons.wikimedia.org/wiki/File:Barcelona_-_Iglesia_de_Santa_Madrona_02.jpg) | Zarateman | CC0 |
| Cross-street fronts: cream with green blinds; ochre with a graffiti shutter; a curved crown | [Creu dels Molers 63.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_63.jpg), [Elkano 73.jpg](https://commons.wikimedia.org/wiki/File:Elkano_73.jpg), [Creu dels Molers 22.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_22.jpg), [Creu dels Molers 39.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_39.jpg) | Xavier Badia Castellà | CC BY-SA 3.0 |
| Plaça del Sortidor: the fountain, terraces, acacias | [770 Plaça del Sortidor (Barcelona).jpg](https://commons.wikimedia.org/wiki/File:770_Pla%C3%A7a_del_Sortidor_(Barcelona).jpg) | Enric | CC BY-SA 4.0 |
| The view from the top of Poble Sec: flat roofs and the three chimneys | [Barri del Poble Sec i les xemeneies.jpg](https://commons.wikimedia.org/wiki/File:Barri_del_Poble_Sec_i_les_xemeneies.jpg) | Jaume Meneses | CC BY-SA 2.0 |
| Montjuïc's wooded slope over the Paral·lel | [Barcelona (4279582277).jpg](https://commons.wikimedia.org/wiki/File:Barcelona_(4279582277).jpg) | Nicolas Vigier | CC0 |
| A painted shutter: Serrat | [Grafit de Joan Manuel Serrat al Poble Sec.jpg](https://commons.wikimedia.org/wiki/File:Grafit_de_Joan_Manuel_Serrat_al_Poble_Sec.jpg) | ru8icon | CC BY-SA 4.0 |

Commons has no recent photo of Blai's terraces at night; Street View and Google Maps were used
only to look (`output/geo/poble-sec/google/links.md` has the four viewpoints), nothing from them is
saved or shipped. Aitor's own photos of Blai at night would be the best reference for the terraces.

## Identity card

Status: refined from `docs/visual-style.md` because the research shows the stairs are at the top
of the barrio, 300 m above Blai: the place's material is its houses (render, iron balconies, rolled
blinds) and the stairs move to the landmark.

| | |
| --- | --- |
| Dominant | Sienna render `#b8744a` (the old houses in evening light) |
| Secondary | Montjuïc pine `#4e6b3c`, terrace bulbs `#f2c27a`, Blai's slabs `#a7a197`, shutter green `#3f5a3a`, cream render `#e6d2b5` |
| Material | Warm render bays with an iron balcony per French window and rolled slatted blinds hung over the railing (`photo:poble-sec-bays`, from Elkano 61, over `estuc`) |
| Ground | Blai's grey concrete slabs from wall to wall, no kerbs (`blai-lloses`); the cross streets' narrow asphalt and grey panot sidewalks (`asfalt`, `panot-gris`) |
| Landmark | Montjuïc rising behind the roofs: stepped rows of houses on stone walls, Margarit's long stair with its handrail, umbrella pines on top (kind: a slope and its stairs). Secondary, never the landmark: Santa Madrona's sandstone tower |
| Light | New look `poble-sec`: warm evening, deeper shade, lit windows; `day` sky; drawn for about 20:00, but it must hold from morning to night like every place. The terraces' festoon bulbs are the place's one glow |
| Props | Bar terraces (folding aluminium tables and chairs, closed parasols, chalkboard menus, planters), festoon strings over them, pintxo counters through open bar doors, rows of recycling containers, parked scooters, plants and washing on balconies, wall lamps on brackets, the L3 totem |
| Air | Warm motes under the terrace lights, still air |
| Sound | Chatter, cutlery and glasses on the terraces, a waiter calling an order, a scooter labouring uphill, a TV through an open balcony, swifts screaming at dusk |
| Only here | Every street that climbs from Blai ends in stairs going up into Montjuïc's pines (in the game, at the zone's back edge) |
| Text | Catalan street plates (white marble, black letters: *Carrer de Blai*, *Plaça dels Ocellets*); bar boards as on the street (*Pintxos*, *Vermut*, *Tapes*); the real bar names in plain type |
| Wink | None yet |
| Emilie | Her corner (invented resident, real lot): the narrow wedge of four storeys where Carrer de Margarit leaves Blai, both faces seen by the camera, her door on Margarit beside the café. Top floor: a balcony crowded with plants, an orange extension cable dropping to the floor below, the bluish light of a screen; a small antenna and a solar panel on the roof. Nothing on it points anywhere: it is just how her home looks |

### How it stands apart

| Compared with | ΔE (dominants) | Why it is not confused |
| --- | --- | --- |
| Plaça d'Espanya (L3, one stop; one district) | 40 | Colour, material (houses vs monumental stone and brick towers), ground (slabs vs granite plaza); both warm, Espanya golden afternoon, Poble Sec evening |
| Sants street (one district) | 21 | Colour, material (render with balconies vs painted shutters), ground, light (Sants cool and in shade) |
| Trinitat Vella · Rec Comtal | 11 | Not neighbours. Brick 60s blocks in the morning vs older render houses with iron balconies at evening |
| Cardedeu | 13 | Not neighbours. Hipped clay roofs and gardens seen from above vs flat roofs over narrow streets |
| El piso de la Meridiana | 12 | Not neighbours. An interior in wood |
| Búnkers del Carmel | 19 | Not neighbours. An open hill at sunset vs dense streets |

The palace's pink and the possession violet never appear; the bulbs are amber, not pink.

## The zone (`assets/geo/poble-sec/zone.json`)

A real-data zone like the Meridiana and the Sagrada Família: OpenStreetMap for the blocks, streets,
trees, shops and bars (`osm.json`, 3399 features from Overpass, fetched 2026-10-30), styled in
`zone.json`.

- **Frame**: anchor 41.373685, 2.164479 (where Tapioles crosses Blai), turned **153°** with
  `bounds_turned`, so Blai runs along x at z ≈ 0: number 1 at the left (Salvà side), Plaça dels
  Ocellets and the Paral·lel at the right. The uphill side of Blai (odd numbers, its bars) faces the
  camera; the cross streets climb away from it towards Montjuïc at the back, their left-hand
  houses facing the camera; the Paral·lel cuts the near right corner.
- **Bounds** (turned frame, metres): x −150 (just past Salvà) to 300 (the Paral·lel), z −128 (the
  first houses beyond Elkano) to 40 (through the blocks that run down to the Paral·lel). 1.5 m
  cells: **300 × 112**, 289 buildings, 10 645 walkable cells. Zoom 11.
- **Streets** (centre lines in the turned frame): Blai z ≈ 0 (walls at z −4.5 and +5);
  Elkano z ≈ −93 at the left to −112 at the right; cross streets at Salvà x ≈ −122, Poeta Cabanyes
  −62, Tapioles 0, Margarit 73 → 47 (it leans), Blasco de Garay 128 → 105, Creu dels Molers 230 →
  204; Plaça dels Ocellets x 233-283.
- **Spawn and station**: in Plaça dels Ocellets (251, 6), beside the L3 totem and stair (243, 8),
  `station-poble-sec` with its three-cell stair. The real entrance is 210 m further along the
  Paral·lel; it moves to where Blai meets the avenue.
- **Places** (Spanish, Gerard's voice, no hints): the bars (*Mirar las barras*, at La Tasqueta de
  Blai), Emilie's door (*Mirar el portal*), the stairs at the top of Margarit (*Mirar las
  escaleras*: "Otro día subo", the reason he does not climb), the library (*Mirar la biblioteca*:
  Francesc Boix), Santa Madrona (*Mirar el campanario*).
- **Labels**: CARRER DE BLAI (twice), CARRER D'ELKANO, PLAÇA DELS OCELLETS.
- **Anchors**: `blai`, `emilie` (her door), `escales` (the foot of the stairs), `santa-madrona`.
- **Buildings**: Emilie's wedge `way/1264332421` (4 storeys, label *Casa de Emilie*), the church
  `way/215873439` (style `church`); every other house takes the map's storeys (mostly 6 and 7).

```
z −128 ┄┄ backdrop beyond the edge: rows of houses stepping up, Margarit's stair, pines ┄┄┄┄┄┄┄┄┄
        the first houses up the slope, their fronts facing the camera
z ≈ −100 ════════════ Carrer d'Elkano (rebuilt 2024-25 from Margarit to the right) ════════════
        │Salvà        │Poeta Cabanyes │Tapioles    ╲Margarit     │Blasco de Garay │Creu dels Molers
        │   deep blocks of narrow 5-7 storey houses, courtyards inside              │
        │             │               │     Emilie ▣╲            │                │
z = 0  ═╪══ CARRER DE BLAI · pedestrian · bars and terraces on both sides ══════════╪══ Plaça dels
        │             │               │ Santa Madrona ╲ library   │                │   Ocellets ● L3
z = 40 ┄┴┄┄ cut through the blocks that run down to the Paral·lel ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╲ Paral·lel ┄┄
       x −150        −62              0            73            128              230        300
```

The preview (`just geo-build poble-sec` → `output/geo/poble-sec/preview.png`) shows the layout
reads: Blai straight across, the cross streets climbing to Elkano, the plaça and the avenue at the
right, every place reachable.

### The slope on flat ground

The game's ground is flat. Here that is mostly true: Blai and the streets as far as Elkano rise
about 3 m, so the playable part stays level. The slope is the zone's back edge, made on purpose
(the diorama is cut where the hill starts):

- **`montjuic-vessant`** (a landmark module, beyond z −128, never walked): two or three rows of
  houses stepping up on rubble-stone retaining walls (`mamposteria`), each row 5-6 m above the one
  before; every cross street carries on up between them as stairs with an iron handrail; Margarit's
  is the long one (the real 204 steps, with lamps), climbing to the pines; umbrella pines and holm
  oaks over pine-needle ground (`pinassa`), and far back, low, the wall of the castle on the crest.
- **Compressed**: in reality 200-300 m of steeper streets (Magalhães, Plaça del Sortidor, Passeig de
  l'Exposició) lie between Elkano and the stairs. The backdrop folds them into one rise, so every
  street from Blai visibly ends in stairs climbing the hill.
- **Gate**: the street ends where the diorama ends, like every zone; at Margarit, the place *Mirar
  las escaleras* lets Gerard say why he is not going up today.

## Texture candidates

Budget: at most about 12 new textures; this place needs five, the rest comes from the library.

| Id | Use | Source | Licence, author | Notes |
| --- | --- | --- | --- | --- |
| `poble-sec-bays` | Photo atlas, 3 bays × 2 storeys, the old houses' upper floors | [Elkano 61.jpg](https://commons.wikimedia.org/wiki/File:Elkano_61.jpg) | CC BY-SA 3.0, Xavier Badia Castellà | Nearly frontal; rectify by its four corners, cut the half-hidden first bay; pale yellow, so the street's colour changes come from mixing it with the painted `iron-balconies` in the zone's palette |
| `poble-sec-bays-crema` | Photo atlas, 2 × 2, cream with green roll-down blinds | [Creu dels Molers 63.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_63.jpg) | CC BY-SA 3.0, Xavier Badia Castellà | Frontal; a second family so a block never repeats one photo |
| `poble-sec-baixos` | Ground-floor atlas for the cross streets: an arched doorway, a graffiti-covered shutter, a stone plinth | [Elkano 73.jpg](https://commons.wikimedia.org/wiki/File:Elkano_73.jpg), [Creu dels Molers 39.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_39.jpg) | CC BY-SA 3.0, Xavier Badia Castellà | Crop out the shop's name board; Blai's bars are painted instead (below) |
| `blai-lloses` | Blai's grey concrete slabs | Poly Haven [`concrete_pavement_03`](https://polyhaven.com/a/concrete_pavement_03), or [`granite_tile_04`](https://polyhaven.com/a/granite_tile_04) | CC0 | Tint to `#a7a197`; check the slab size against the 2012 photos (about 40 cm) |
| `pinassa` | Montjuïc's pine-needle ground in the backdrop | Poly Haven [`forest_ground_04`](https://polyhaven.com/a/forest_ground_04) (pine forest collection) | CC0 | |
| Optional signature | One recognisable front on the seen side of Blai | [Blai 37.jpg](https://commons.wikimedia.org/wiki/File:Blai_37.jpg) (stone, curved crown) or [Creu dels Molers 22.jpg](https://commons.wikimedia.org/wiki/File:Creu_dels_Molers_22.jpg) | CC BY-SA 3.0, Xavier Badia Castellà | Both shot from below: strong rectification; only if the bays alone do not read |
| Reused | Render, flat roofs, sidewalks, asphalt, retaining walls, Montjuïc stone, stair treads, 60s brick | `estuc`, `rajola`, `panot-gris`, `asfalt`, `mamposteria`, `carreu`, `granit`, `mao` | CC0 | Already in `public/textures/` |

Also looked at and set aside: Poly Haven `concrete_pavers` (interlocking, not Barcelona),
`clay_plaster` and `damaged_plaster` (too rough at this scale; `estuc` is enough), the painted
portrait shutters (Sants already has murals on shutters as its "only here"; a single one here could
be a found detail, not a texture).

## Build plan (after the foundation merges)

1. Merge the foundation into `feat/places-poble-sec`; `just geo-build poble-sec`.
2. Textures: `just texture-photo` for `poble-sec-bays`, `poble-sec-bays-crema` and
   `poble-sec-baixos` (credits from Commons in each `texture.json`); `just texture-fetch polyhaven`
   for `blai-lloses` and `pinassa`. Look at each at its real size.
3. Styles in `zone.json`: `default` (old houses: `photo:poble-sec-bays` or the painted
   `iron-balconies` in the sienna palette, `estuc`, flat `rajola` roofs), `crema`
   (`photo:poble-sec-bays-crema`), `flats` (60s-70s infill, `mao` or cream), `church`; spread them
   by building id so neighbours differ. `look.materials`: Blai's pedestrian ways and Plaça dels
   Ocellets in `blai-lloses`, sidewalks `panot-gris`, roads `asfalt` `#46484a`.
4. A painted ground floor `bars` in `facade()` (`src/geo-scenery.ts`): open bar fronts lit warm
   from inside, a counter of pintxos, a chalkboard, a menu board, a roller shutter half up; given to
   the buildings whose ground floor the map lists as a bar or restaurant on Blai.
5. Landmarks (`src/landmarks/`): `montjuic-vessant` (the backdrop above), `terrassa` (a bar
   terrace: two to six folding tables and chairs, a closed parasol, a chalkboard, a planter; low, so
   it never hides Gerard; about fifteen along the seen side of Blai, leaving the middle free) and
   `garlanda` (a festoon of warm bulbs strung over a terrace at about 4.5 m; thin, so it never hides
   him; the place's bloom). Optional: Santa Madrona's tower (`campanar`), drawn simply.
6. Props: an umbrella `pine` tree species in `src/props.ts` for the backdrop (the Búnkers, Sagrada
   and Espanya streams need it too: whoever is first adds it); Elkano's new trees every 13 m from
   Margarit rightwards; recycling container rows where the map has `amenity=recycling` (shared with
   Sants); the L3 totem's plate in L3 green (the plate is red for every metro line today).
7. Wiring: the id in `EnvironmentId` and `ENVIRONMENTS` (`src/environments.ts`) and `index.html`;
   `STATION_PLACES['poble-sec']` in `src/transit.ts`; the place in `PLACES` (`src/jump-menu.ts`,
   group Barcelona); `LOOKS['poble-sec']` in `src/grading.ts` (warm evening, temperature about
   +.10, contrast 1.06); `AIR['poble-sec']` in `src/effects.ts` (warm motes, still air).
8. Screenshots: `scripts/screenshots/poble-sec.json` (arriving in Plaça dels Ocellets, the terraces
   on Blai, Emilie's corner, the top of Margarit with the stairs, the overview) and
   `just screenshots poble-sec --gpu`; check Gerard in greyscale and the draw calls with `?stats`.
9. Checks: `just typecheck`, `npm test`, `uv run --locked python -m unittest discover -s tests`.
   Docs: `docs/barcelona.md` (the station and the designed zone), the Poble Sec row and card in
   `docs/visual-style.md`, this file.

## Approximate, open and risks

- **Draw calls.** 289 buildings, about six times the Meridiana's 52, each with its own walls,
  ground floor, roof, lid and parapet (they open the see-through cut, so they are not batched). The
  follow camera sees a fraction; the overview sees all. Measure first; if it is over budget, trim
  the bounds (x −60 and z −118 keep Blai's core: about 220 buildings) or drop the one-storey
  courtyard sheds the map lists inside the blocks (42 of them, never seen from the street).
- **The station** moves 210 m along the Paral·lel to Plaça dels Ocellets.
- **The stairs** are compressed: in reality they start 200-300 m above Elkano.
- **Storeys** come from the map (`building:levels`, Catastro-derived); none were checked house by
  house.
- **Emilie** is invented on a real lot above a real café; her name appears only on a letterbox in a
  line, never on the street.
- **Terraces and festoons**: their number and placement are a reading of the photos and guides, not
  a survey; festoons are the nice-to-see liberty of the place.
- **Not covered**: Plaça del Sortidor, the Paral·lel's theatres and the three chimneys (outside the
  zone); Emilie's flat inside (a hand-made interior if her mission needs it).
