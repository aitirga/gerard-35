# Poble Sec · Carrer de Blai and the Montjuïc slope

Status: built (2026-10-31). The place `poble-sec` is playable: the L3 brings the party up in Plaça
dels Ocellets, and the development picker lists it under Barcelona (*Poble Sec · Carrer de Blai*).
Screenshots: `just screenshots poble-sec --gpu`.

Where Emilie lives (`docs/story-outline.md`, People: a friend of Gerard and Aitor, very clever; her
mission will be a technical problem). This step gives her a corner and a door to look at, no mission.

| Id | What | How it is reached |
| --- | --- | --- |
| `poble-sec` | Carrer de Blai from Carrer de Salvà to Plaça dels Ocellets, the cross streets that climb towards Montjuïc as far as Carrer d'Elkano, Emilie's corner at Blai and Margarit, and the slope rising behind as the backdrop | Metro: the station `poble-sec` (L3), its entrance in Plaça dels Ocellets (`STATION_PLACES` in `src/transit.ts`) |

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

Status: built; refined from `docs/visual-style.md` because the research showed the stairs are at
the top of the barrio, 300 m above Blai: the place's material is its houses (render, iron balconies,
rolled blinds) and the stairs moved to the landmark. Colours measured on the screenshots.

| | |
| --- | --- |
| Dominant | Warm sienna-ochre render and terracotta flat roofs, `#b08c58` in the low sun (measured), over cool blue-grey shade `#323c4f` |
| Secondary | Montjuïc's pines `#4e6b3c`, the festoons' bulbs `#ffcf7e`, Blai's slabs `#96908a`, the cream and orange trim of the Elkano 73 bays `#e6d2b5` / `#c27b3e` |
| Material | Warm render bays with an iron balcony per French window and slatted blinds rolled over the railing: two photo atlases (`poble-sec-bays` from Elkano 61, `poble-sec-bays-siena` from Elkano 73) mixed with the painted `iron-balconies` in a sienna palette |
| Ground | Blai's grey concrete slabs (30 × 60 cm, running bond) from wall to wall with no kerbs (`blai-lloses`), also on the cross streets' sidewalks; narrow asphalt on the cross streets |
| Landmark | Montjuïc behind the roofs: terraces of houses on rubble-stone walls, every street from Blai going on up as a stair with its handrail, Passeig de l'Exposició's trees, the slope of umbrella pines and holm oaks and the castle's wall on the crest (kind: a slope and its stairs; `montjuic-vessant`) |
| Light | `poble-sec` in `LOOKS`: warm (temperature +.10), contrast 1.06, cool lifted shade; `day` sky; drawn for the start of the evening |
| Props | Bar terraces (aluminium tables and folding chairs, plates of pintxos, a glass of vermut, a parasol folded shut, a planter, the A-frame chalkboard), festoons of bulbs zigzagging across Blai, bar fronts lit from inside (`bars` ground floors), young trees in pits, the roofs' stair huts, water tanks, aerials and washing (`terrats`), the L3 totem and stair |
| Air | `AIR['poble-sec']`: warm motes in still air (and her gloom when the story brings it) |
| Sound | Chatter, cutlery and glasses on the terraces, a waiter calling an order, a scooter labouring uphill, a TV through an open balcony, swifts at dusk (no file yet) |
| Only here | Every street that climbs from Blai ends in a stair going up into Montjuïc's pines; and Blai's festoons, the place's one glow |
| Text | Catalan and as on the street: the real bar names on their signs (La Tasqueta de Blai, Bota Bar, Mai Tanca…), chalkboards *PINTXOS*, *VERMUT*, *TAPES*, *BRAVES*, *CERVESA*; *CARRER DE BLAI*, *CARRER D'ELKANO*, *PLAÇA DELS OCELLETS* on the ground |
| Wink | None |
| Emilie | Her corner (invented resident, real lot `way/1264332421`): the narrow four-storey wedge where Carrer de Margarit leaves Blai, in the cream and orange Elkano 73 bays, both faces seen by the camera, her door on Margarit beside the corner bar. Top floor: a balcony crowded with pots and geraniums, an orange extension cable dropping to the balcony below, the bluish light of a screen behind the glass; on the roof a small aerial, two solar panels and a row of pots (`casa-emilie`). Nothing on it points anywhere: it is just how her home looks |

### How it stands apart

| Compared with | ΔE (CIE76, against `#b08c58`) | Why it is not confused |
| --- | --- | --- |
| Plaça d'Espanya (L3, one stop; one district) | 29 (`#d8ccb2`) | Material (houses and balconies vs monumental stone and brick towers), ground (slabs vs a granite plaza), landmark (a wooded slope with stairs vs twin campaniles) |
| Sants street (one district) | 12 (`#cfa463`) | The closest colour: told apart by material (render with iron balconies vs painted shutters), ground (Blai's slabs), light (Poble Sec warm evening, Sants cool and in shade) and the hill at the back; three of four |
| Trinitat Vella · Rec Comtal | 22 | Not neighbours. Brick blocks in the morning vs render with balconies at evening, terraces and festoons |
| Cardedeu | 28 | Not neighbours. Hipped clay roofs and gardens vs flat terrats with huts over narrow streets |
| El piso de la Meridiana | 14 | Not neighbours. An interior in wood |
| Búnkers del Carmel | 7 | Not neighbours (L5, another district), the nearest colour: an open hilltop of concrete and earth at sunset vs dense streets of render, balconies and terraces |

The palace's pink and the possession violet never appear; the bulbs are amber; the only blue is
the glow of Emilie's screen.

## The zone (`assets/geo/poble-sec/zone.json`)

A real-data zone like the Meridiana: OpenStreetMap for the blocks, streets, trees, shops and bars
(`osm.json`, 3399 features from Overpass, fetched 2026-10-30), styled in `zone.json`.

- **Frame**: anchor 41.373685, 2.164479 (where Tapioles crosses Blai), turned **153°** with
  `bounds_turned`, so Blai runs along x at z ≈ 0: number 1 at the left (Salvà side), Plaça dels
  Ocellets and the Paral·lel at the right. The uphill side of Blai (odd numbers, most of its bars)
  faces the camera; the cross streets climb away from it towards Montjuïc at the back (the upper
  right of the screen), their left-hand houses facing the camera; the Paral·lel cuts the near right
  corner.
- **Bounds** (turned frame, metres): x −150 (just past Salvà) to 300 (the Paral·lel), z −128 (the
  first houses beyond Elkano) to 40 (through the blocks that run down to the Paral·lel). 1.5 m
  cells: **300 × 112**, 289 buildings, about 10 540 walkable cells. Zoom 11.
- **Streets** (centre lines in the turned frame): Blai z ≈ 0 (walls at z −4.5 to −5.9 and +4 to
  +5); Elkano z ≈ −93 at the left to −112 at the right; cross streets where they meet Blai: Salvà
  x ≈ −125, Poeta Cabanyes −66, Tapioles −2, Margarit 72 (it leans to 46 at the back edge),
  Blasco de Garay 128, Creu dels Molers 230; Plaça dels Ocellets x 233–283.
- **Spawn and station**: in Plaça dels Ocellets (251, 6), beside the L3 totem (242.5, 8) and its
  stair, `station-poble-sec` with its three-cell step, like Fabra i Puig on the Meridiana. The real
  entrance is 210 m further along the Paral·lel; it moves to where Blai meets the avenue.
- **Places** (Spanish, Gerard's voice, no hints): the bars (*Mirar las barras*, at La Tasqueta de
  Blai), Emilie's door (*Mirar el portal*), the stairs at the top of Margarit (*Mirar las
  escaleras*: "Otro día subo", the reason he does not climb), the library (*Mirar la biblioteca*:
  Francesc Boix).
- **Labels**: CARRER DE BLAI (twice), CARRER D'ELKANO, PLAÇA DELS OCELLETS.
- **Anchors**: `blai`, `emilie` (her door), `escales` (the foot of the stairs).
- **Buildings**: every house takes the map's storeys (mostly 6 and 7). Four styles, spread by a
  hash of the building's id so neighbours differ: `default` (the painted `iron-balconies` in seven
  sienna and ochre renders, flat terracotta roofs), `bays` (the Elkano 61 photo atlas, about 40 %
  of the houses of three to seven storeys), `siena` (the Elkano 73 atlas, cream with orange trim,
  about 13 %) and `flats` (the 60s–70s blocks of eight storeys or more). The 37 buildings whose
  ground floor the map lists as a bar, restaurant or café get the painted `bars` ground floor.
  Emilie's wedge `way/1264332421` is labelled *Casa de Emilie*, four storeys, style `siena`.

```
z −128 ┄┄ Montjuïc beyond the edge: terraces of houses, a stair up every street, pines, the castle ┄┄
        the first houses up the slope, their fronts facing the camera
z ≈ −100 ════════════ Carrer d'Elkano (rebuilt 2024-25 from Margarit to the right) ════════════
        │Salvà        │Poeta Cabanyes │Tapioles    ╲Margarit     │Blasco de Garay │Creu dels Molers
        │   deep blocks of narrow 5-7 storey houses, courtyards inside              │
        │             │               │     Emilie ▣╲            │                │
z = 0  ═╪══ CARRER DE BLAI · slabs · bars, terraces and festoons on both sides ═════╪══ Plaça dels
        │             │               │              ╲ library    │                │   Ocellets ● L3
z = 40 ┄┴┄┄ cut through the blocks that run down to the Paral·lel ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╲ Paral·lel ┄┄
       x −150        −62              0            73            128              230        300
```

### Blai: terraces, festoons and bars

- **`terrassa-blai`** (27 of them): one in front of each bar or restaurant the map lists on Blai,
  on whichever side it is, never two within 5.5 m on a side, 4.6 × 1.8 m against the wall so the
  middle 6 m stay free. Aluminium tables and folding chairs, plates of pintxos and a glass, a
  parasol folded shut, a planter and the A-frame chalkboard (*PINTXOS*, *VERMUT*, *TAPES*, *MENÚ*,
  *BRAVES*, *CERVESA*). Low: nothing reaches Gerard's head.
- **`garlanda`** (6 runs): festoons zigzagging from wall to wall at 4.8 m over the runs of
  terraces between the cross streets, a bulb every 0.85 m. The bulbs glow past the bloom
  threshold: the place's one glow. None over Plaça dels Ocellets (there is no wall across to hang
  them from).
- **`bars`** (a painted ground floor in `facade()`, `src/geo-scenery.ts`): the bar front open and
  lit, bottles on the back shelves, the counter with its trays of pintxos; beside it a window with
  stools, a roller shutter half up with a tag, or the menu board of food photos; a lamp on a
  bracket over each bay. The real name goes above on the sign the map gives every bar.
- **Trees**: eleven young plane trees in square pits on Blai's south side between the terraces
  (the map has none on Blai; the photos do).

### The slope on flat ground

The game's ground is flat. Here that is mostly true: Blai and the streets as far as Elkano rise
about 3 m, so the playable part stays level. The slope is the zone's back edge, made on purpose
(the diorama is cut where the hill starts):

- **`montjuic-vessant`** (a landmark beyond z −128, 470 × 110 m, never walked): three terraces
  held by rubble-stone walls (`mamposteria`), 6, 7 and 7 m high, a street along the top of each
  with its parapet; rows of three- to five-storey houses in the sienna palette on the first two;
  every cross street from Blai carries on up as a 4.4 m stair cut into the terraces between stone
  walls, with an iron handrail up the middle and a lamp at the top of each flight; Passeig de
  l'Exposició's plane trees on the third; then the slope (`pinassa`, folded so it is not a plane)
  up to 58 m with about 330 umbrella pines and holm oaks, Margarit's stair going on up through
  them in seven flights with handrails and lamps, and the castle's crenellated wall on the crest.
  One mesh per material (about 17 draw calls).
- **Compressed**: in reality 200–300 m of steeper streets (Magalhães, Plaça del Sortidor, Passeig de
  l'Exposició) lie between Elkano and the stairs, and the castle is a kilometre away. The backdrop
  folds them into one rise, so every street from Blai visibly ends in stairs climbing the hill.
- **Gate**: the street ends where the diorama ends, like every zone, at the foot of the first
  stone wall; at Margarit, the place *Mirar las escaleras* lets Gerard say why he is not going up
  today.

### Roofs

**`terrats`** (eight landmarks, each covering a strip of the zone): for every flat roof of three
storeys or more, the stair's hut (where it fits inside the real outline), the fibre-cement water
tank on most of them, one or two aerials and, on some, a washing line with the week's clothes.
They are cut with the roof under them wherever the see-through cut opens (`cut: 'always'`), so
nothing floats over the hole round Gerard. Emilie's roof is dressed by hand instead
(`casa-emilie`).

## Textures and credits

Four new textures; everything else comes from the shared library (`asfalt`, `carreu`, `estuc`,
`granit`, `mamposteria`, `rajola`, …). Credits also live in each `texture.json`.

| Id | Use | Source | Licence, author | Notes |
| --- | --- | --- | --- | --- |
| `blai-lloses` | Blai's grey concrete slabs, 30 × 60 cm in running bond, tinted `#96908a` (the open ground everywhere, so the cross streets' sidewalks too) and `#928b80` (Plaça dels Ocellets) | Poly Haven [`concrete_pavement`](https://polyhaven.com/a/concrete_pavement), 1.8 m tile | CC0, Charlotte Baglioni | The slab size matches the photos of Blai 41 |
| `pinassa` | Montjuïc's ground under the pines, tinted `#474d33` | Poly Haven [`forest_ground_04`](https://polyhaven.com/a/forest_ground_04) (pine forest collection) | CC0 | |
| `poble-sec-bays` | Photo atlas, 3 bays × 2 storeys: curved iron balconies, carved lintels, slatted blinds | [Elkano 61.jpg](https://commons.wikimedia.org/wiki/File:Elkano_61.jpg), rectified by its four corners | CC BY-SA 3.0, Xavier Badia Castellà | Midtones lifted and warmed (recorded in `adjusted`) so the shaded photo reads as the pale render it is under the evening grade |
| `poble-sec-bays-siena` | Photo atlas, 2 bays × 1 storey: cream render with orange balcony slabs and window surrounds, a long iron balcony with plants | [Elkano 73.jpg](https://commons.wikimedia.org/wiki/File:Elkano_73.jpg), cropped straight | CC BY-SA 3.0, Xavier Badia Castellà | The orange pilaster at each edge doubles where the atlas repeats, like a party wall |

Set aside: Creu dels Molers 63 (cream with green blinds) and a ground-floor atlas (Elkano 73's
shutter carries a shop's name across its middle; Creu dels Molers 39's upper floors are behind a
tree): Blai's bars are painted instead; Blai 37 as a signature facade (shot from below; the bays
already read).

## How it was built

1. `just geo-build poble-sec` from `osm.json` and `zone.json`.
2. Textures with `tools/textures.py`: `fetch polyhaven concrete_pavement --id blai-lloses`,
   `fetch polyhaven forest_ground_04 --id pinassa`, `photo <Commons URL> --id poble-sec-bays
   --size-m 8.1 6 --bays 3 --storeys 2 --corners 580,332 3769,332 3953,2635 476,2635` and `photo
   <Commons URL> --id poble-sec-bays-siena --size-m 5.4 3 --bays 2 --storeys 1 --crop
   475,575,3302,1666` (then the midtone lift on `poble-sec-bays`).
3. `zone.json`: styles, the buildings' styles and `bars` ground floors, the terraces (one per bar
   on Blai, from the map's shops), the festoons over their runs, the trees, the landmarks. They were
   written by a one-off script from the built scene; the data in `zone.json` is the source now.
4. Landmark modules in `src/landmarks/`: `terrassa-blai`, `garlanda`, `montjuic-vessant`,
   `casa-emilie`, `terrats`, with their solids in `src/landmark-shapes.ts` (boxes, bars, prisms
   and foliage lenses gathered into one mesh per material).
5. Wiring: `EnvironmentId`, `ENVIRONMENTS` (`src/environments.ts`), `LOOKS['poble-sec']`
   (`src/grading.ts`), `PLACES` (`src/jump-menu.ts`, Barcelona), `STATION_PLACES['poble-sec']`
   (`src/transit.ts`), `AIR['poble-sec']` (`src/effects.ts`), the home bulbs' colours
   (`src/home-lights.ts`, the typecheck asks for every place).
6. Screenshots: `scripts/screenshots/poble-sec.json` (Plaça dels Ocellets, Blai, Emilie's corner
   and door, the top of Margarit, a cross street, the overview, and a last shot with the draw calls).

## Approximate, open and risks

- **Draw calls.** Following Gerard about 1 060–1 150 (one frame each, `--gpu`), over the ~1 000 of
  the budget by about 10 %; the overview about 6 850 (the Meridiana's is about 10 000). Most of it
  is the 289 buildings (five meshes each, unbatched because they open the cut) and the 82 shop
  signs; this place's own pieces add about 100. If it must come down: drop the one-storey courtyard
  sheds inside the blocks (never seen from the street; needs a way to skip buildings in
  `tools/geo.py`), or trim the bounds to Blai's core.
- **The station** moves 210 m along the Paral·lel to Plaça dels Ocellets. Its totem's plate is red
  like every metro line's today (`src/props.ts`); the L3's is green.
- **The stairs and the hill** are compressed: in reality the stairs start 200–300 m above Elkano
  and the castle is a kilometre away.
- **Storeys** come from the map (`building:levels`, Catastro-derived); none were checked house by
  house. Facades are spread by hash, not house by house.
- **Santa Madrona** is just outside the bounds (its footprint's centre is south of z 40), so its
  tower is not drawn and the place that looked at it was removed.
- **Blai's slabs** cover all open ground, so the cross streets' sidewalks are slabs too (in reality
  a mix of panot and slabs).
- **Emilie** is invented on a real lot above a real bar; her name appears only on a letterbox in a
  line, never on the street.
- **Terraces and festoons**: their number and placement are a reading of the photos, the guides
  and the map's bars, not a survey; the festoons are the nice-to-see liberty of the place.
- **Not covered**: Plaça del Sortidor, the Paral·lel's theatres and the three chimneys (outside the
  zone); Elkano's new trees (2024-25) and the recycling containers; Emilie's flat inside (a
  hand-made interior if her mission needs it); the ambient sound.
