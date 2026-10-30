# Búnkers del Carmel · the Turó de la Rovira

Status: research and draft (2026-10-30). Nothing is wired into the game yet: the zone draft lives
in `assets/geo/bunkers-carmel/` (`zone.json`, `osm.json`, `sketch.json`), and the build waits for
the shared foundation (real materials in `tools/textures.py`, landmark modules in `src/landmarks/`,
the new metro lines, `docs/visual-style.md`).

A new place, the surprise among Barcelona's places: the only high viewpoint in the game, drawn at
dusk, where the whole city lies below Gerard down to the sea.

| Id | What | How it is reached |
| --- | --- | --- |
| `bunkers-carmel` | The top of the Turó de la Rovira (262 m): the Civil War anti-aircraft battery's gun pits, the ruins of the shanty town that grew on it, dry grass, pines and prickly pears, people sitting on the parapets, and the city below as a backdrop | Metro: the station `el-carmel` (L5). The real station is 0.8 km away and about 70 m lower; the game's entrance stands at the foot of the north-west steps, on Carrer del Turó de la Rovira, compressed (see [The zone](#the-zone-assetsgeobunkers-carmel)) |

## The real place in 2026

- **The hill.** A narrow NE-SW ridge of Palaeozoic slate and limestone, 300 m long and about 65 m
  wide, one of the Tres Turons with the Turó del Carmel and the Creueta del Coll, in
  Horta-Guinardó. The summit is flat because people flattened it: an Iberian village (7th-1st
  century BC), a villa called El Castell (1910s, pulled down in 1937 because it was in the guns'
  way), the battery, the shacks. Its south slope belongs to the Parc del Guinardó.
- **The battery** (Bateria antiaèria del Turó de la Rovira). Built by the Republic's DECA from May
  1937 against the Italian and German bombers; four Vickers 105 mm guns firing from 3 March 1938;
  the army destroyed them on 25-26 January 1939, the day before Barcelona fell. Seven firing
  positions survive: **round pits 6 to 9 m across**, sunk about a metre, ringed by a low curved
  parapet of board-marked concrete (the formwork's planks printed in it, pebbly aggregate,
  crumbled edges), a round gun mount in the middle and small square ammunition niches with rusty
  red steel doors set into the parapet. Two of them form a twin emplacement at the SW end, joined
  by the command post; the rest are strung along the crest towards the officers' pavilion. Locals
  call them the *búnkers*; they never were bunkers.
- **Els Canons** (1944-1990). After the war the empty battery became one of the city's longest-lived
  shanty towns: about 110 shacks and 600 people, the battery's axis its main street, shacks built
  on and inside the gun pits. The last family left in 1990 and the shacks were pulled down for the
  1992 Olympics. What remains: red-brick walls with white lime render, concrete floor slabs and
  patches of floor tiles (25 × 25 cm grès, red terracotta, grey and patterned hydraulic tiles),
  steps, and the 1963 water tank, a grey concrete cylinder about 14 m across at the SW end, on
  which the neighbours fixed a fountain.
- **The museum** (MUHBA Turó de la Rovira). Cleared by volunteer work camps (2006-2008) and
  restored from 2010; opened in 2011: concrete paths, grey gravel between the remains, dry stone
  retaining walls on the north slope, black iron railings, five interpretation lecterns (dark
  steel, Catalan). The officers' pavilion, at the NE end, is the interpretation centre (October to
  May: Wednesday, Friday, Saturday and Sunday, 10:00-14:00).
- **Sunset.** Since the 2010s it is Barcelona's most famous free viewpoint: at dusk dozens to
  hundreds of people, locals and tourists, sit on the parapets with their legs over the edge,
  phones up, a guitar, beer cans; graffiti on the shacks' walls. Looking south-east over the city
  at sunset (the sun sets behind Collserola, WSW), the sky over the sea turns pale blue above a
  pink band (the Belt of Venus) over a grey-blue one (the earth's shadow).
- **The fence (since 2 May 2023).** A 2 m bar fence closes the summit at night after years of
  complaints from the neighbours of Marià Labèrnia and Mühlberg: open 9:00-19:30 in summer and
  9:00-17:30 in winter; the Guàrdia Urbana and civic agents clear it and lock the gates. In April
  2026 the neighbours still complained of drinking outside the fence after closing. In late October
  the sun sets around 17:50, so in winter the gates close before the sunset.
- **The view** (360°): south-east, the Eixample's grid with the Sagrada Família (2 km, SSE) and
  Torre Glòries (2.9 km, SE), the Hospital de Sant Pau, the Port Olímpic towers and the sea
  (4.5 km); south-west, Montjuïc; north, Collserola and Tibidabo; north-north-east, Nou Barris and
  **Trinitat Vella, 3.9 km away: where her palace stands in the story**.
- **Getting there.** On foot only. Bus 22 turns round on Carrer de la Gran Vista; the 119 and the
  V17 stop near Marià Labèrnia; the nearest metro stations, El Carmel and El Coll | La Teixonera
  (L5) and Alfons X (L4), are 15-25 minutes uphill.

### Sources

- [Turó de la Rovira](https://en.wikipedia.org/wiki/Tur%C3%B3_de_la_Rovira) (Wikipedia, read
  2026-10-30): height, battery, Els Canons, the 2011 museum.
- MUHBA, [Turó de la Rovira](https://www.barcelona.cat/museuhistoria/en/heritages/museum-spaces/turo-de-la-rovira)
  (spaces, opening hours, address Marià Labèrnia s/n).
- Actium for BIMSA, [Intervenció arqueològica Turó de la Rovira - Bateria antiaèria](https://www.barcelona.cat/museuhistoria/sites/default/files/intervencioturorovira.pdf)
  (2015): summit UTM 429949.95, 4585652.90, 262 m; the hill's geology and size; seven firing
  units; the 25 × 25 cm floor tiles; the 1:500 general plan of the battery, used for the sketch.
- Catalan News, [Barcelona will close Carmel Bunkers at night from May 2](https://www.catalannews.com/society-science/item/barcelona-will-close-carmel-bunkers-at-night-from-may-2)
  (2023: the 2 m fence, 19:30); Diari Catalunya, [Els búnquers del Carmel, focus de conflictes veïnals](https://diaricatalunya.cat/en/barcelones/general/els-bunquers-del-carmel-focus-de-conflictes-veinals-per-botellades-i-molesties)
  (26 April 2026: summer and winter hours, civic agents, drinking after closing).
- OpenStreetMap (ODbL), fetched 2026-10-30: in `osm.json` the water tank `way/142894787`, the
  officers' pavilion `way/1167567030`, the concrete footways and steps and Carrer del Turó de la
  Rovira `way/309904244`; looked at but not kept by the fetch, the battery's outline
  `way/142894789` (historic=fort, *Bateries antiaèries i barraques del Carmel*), the gun pits' wall
  arcs and the 2 m fence (`barrier` ways), used to check the sketch.
- ICGC, *Ortofoto de Catalunya* (current, WMS `ortofoto_color_vigent`, CC BY 4.0): looked at to
  place every pit; not shipped.
- Photos looked at (Wikimedia Commons, all openly licensed; downloads stay in `output/refs/bunkers/`):

| What | File | Author | Licence |
| --- | --- | --- | --- |
| The view south-east at dusk, the Belt of Venus over the sea, the railing, 2021 | [Barcelona 23 23 31 330000.jpeg](https://commons.wikimedia.org/wiki/File:Barcelona_23_23_31_330000.jpeg) | Robot8A | CC BY-SA 4.0 |
| People sitting on the shacks' graffiti'd brick walls at golden hour, the water tank, 2018 | [Nice afternoon at the Bunkers del Carmel in Barcelona.jpg](https://commons.wikimedia.org/wiki/File:Nice_afternoon_at_the_Bunkers_del_Carmel_in_Barcelona.jpg) | Thingstodoinbarcelona | CC BY-SA 4.0 |
| A crowd on the parapets at sunset, 2018 | [Bunkers del Carmel Barcelona.jpg](https://commons.wikimedia.org/wiki/File:Bunkers_del_Carmel_Barcelona.jpg) | Barcelonatips | CC BY-SA 4.0 |
| People standing in a gun pit, the city and Torre Glòries below, 2018 | [View from the Bunkers del Carmel.jpg](https://commons.wikimedia.org/wiki/File:View_from_the_Bunkers_del_Carmel.jpg) | Thingstodoinbarcelona | CC BY-SA 4.0 |
| A curved parapet: brick with a concrete cap, a rusty red door, a pine, 2016 | [Anti-aircraft batteries at Turó de la Rovira, 2016 13.jpg](https://commons.wikimedia.org/wiki/File:Anti-aircraft_batteries_at_Tur%C3%B3_de_la_Rovira,_2016_13.jpg) | Benjamín Núñez González | CC BY-SA 4.0 |
| Board-marked concrete close up, 2016 | [Anti-aircraft batteries at Turó de la Rovira, 2016 05.jpg](https://commons.wikimedia.org/wiki/File:Anti-aircraft_batteries_at_Tur%C3%B3_de_la_Rovira,_2016_05.jpg) | Benjamín Núñez González | CC BY-SA 4.0 |
| Inside a pit: niche door, red tiles, concrete slabs, 2016 | [Anti-aircraft batteries at Turó de la Rovira, 2016 09.jpg](https://commons.wikimedia.org/wiki/File:Anti-aircraft_batteries_at_Tur%C3%B3_de_la_Rovira,_2016_09.jpg) | Benjamín Núñez González | CC BY-SA 4.0 |
| Shack ruins: whitewash, brick, a floor slab, the tank, 2016 | [Anti-aircraft batteries at Turó de la Rovira, 2016 01.jpg](https://commons.wikimedia.org/wiki/File:Anti-aircraft_batteries_at_Tur%C3%B3_de_la_Rovira,_2016_01.jpg) | Benjamín Núñez González | CC BY-SA 4.0 |
| A gun pit with its mount and the water tank, 2013 | [045 Turó de la Rovira, bateria antiaèria i dipòsit d'aigua.jpg](https://commons.wikimedia.org/wiki/File:045_Tur%C3%B3_de_la_Rovira,_bateria_antia%C3%A8ria_i_dip%C3%B2sit_d%27aigua.jpg) | Enric | CC BY-SA 4.0 |
| The shacks' tiled floors along a path, an olive, dry grass, 2013 | [013 Turó de la Rovira, restes de barraques.jpg](https://commons.wikimedia.org/wiki/File:013_Tur%C3%B3_de_la_Rovira,_restes_de_barraques.jpg) | Enric | CC BY-SA 4.0 |
| Prickly pears and dry grass under the parapets, 2013 | [030 Turó de la Rovira, figueres de moro sota les bateries antiaèries.jpg](https://commons.wikimedia.org/wiki/File:030_Tur%C3%B3_de_la_Rovira,_figueres_de_moro_sota_les_bateries_antia%C3%A8ries.jpg) | Enric | CC BY-SA 4.0 |
| The musealised platforms, gravel, a lectern, the tank, 2015 | [Restes museïtzades dels antiaeris del turó de la Rovira P1500867.jpg](https://commons.wikimedia.org/wiki/File:Restes_muse%C3%AFtzades_dels_antiaeris_del_tur%C3%B3_de_la_Rovira_P1500867.jpg) | Pere López Brosa | CC BY-SA 3.0 |
| The railing, the crowd, the lecterns, the sea, 2017 | [Bateries antiaèries Turó de la Rovira.jpg](https://commons.wikimedia.org/wiki/File:Bateries_antia%C3%A8ries_Tur%C3%B3_de_la_Rovira.jpg) | Malet | CC BY-SA 4.0 |
| The hill from afar at golden hour, people on top, 2024 | [Turó de la Rovira - P1100470.jpg](https://commons.wikimedia.org/wiki/File:Tur%C3%B3_de_la_Rovira_-_P1100470.jpg) | Pere López Brosa | CC BY-SA 4.0 |

Google Maps and Street View were only looked at (`output/geo/bunkers-carmel/google/links.md` has
the three viewpoints); nothing from them is saved or shipped.

## Identity card

Status: refined from `docs/visual-style.md` (proposal) because the references add the shacks'
whitewash and brick, the dusk sky's real colours and the black railings, and because the card's
"only here" can be built from the network map's own data.

| | |
| --- | --- |
| Dominant | Dry gold grass and bare earth in low sun `#c09a5e` (kept); war concrete `#a29f96` |
| Secondary | Scrub and pines `#4f5a2e`; the dusk sky over the sea: pale blue `#b9cddd`, the pink Belt of Venus `#eac6b0`, the earth's shadow `#91959d`; the shacks' whitewash `#ece6da` and brick `#a4533a` |
| Material | Board-marked Civil War concrete with pebbly aggregate and crumbled edges (new texture `formigo-encofrat`), over bare slate rock |
| Ground | Dry grass and rock, grey gravel round the remains (`grava`), concrete paths, and patches of the shacks' floor tiles: red terracotta (`rajola`), grey and patterned hydraulic tiles (drawn) |
| Landmark | The round gun pits strung along a bare crest, the grey water tank at its end; from the overview, a dry island above the city (kind: round platforms on a hilltop) |
| Light | New look `bunkers-carmel`: warm golden hour, long soft shadows, haze over the city; `dusk` sky (pale blue, pink band, grey-blue band). The game's one sun direction stays: colour, length of shadow and the sky carry the hour |
| Props | Parapets with gun mounts and ammunition niches (rusty red steel doors), black iron railings, dark steel MUHBA lecterns, the bar fence and its gate, bins, prickly pears and agaves, Aleppo pines and olives, dry grass tufts, people sitting on the parapets with their legs over the edge (phones, a guitar, cans), a civic agent in a high-visibility vest at the gate |
| Air | Gusts across the top carrying seeds and dust (`wind` high); no pollen |
| Sound | Wind, the city's far hum and a siren far below, a guitar, talk in many languages, a can opening, monk parakeets squawking in the pines |
| Only here | The whole city at Gerard's feet: real Barcelona, every building from the network map's model, laid out below the hill to the sea, with the Sagrada Família, Torre Glòries and, far off to the north, her castle on Trinitat Vella |
| Text | Catalan: the MUHBA lecterns (*Turó de la Rovira*, *Bateria antiaèria*, *Barraques dels Canons*), graffiti tags on the shacks' walls |
| Wink | A pink gum stuck on a parapet's rim, still soft (optional, if the story wants her near) |

**How it stands apart.** It is the only place drawn at dusk, the only one above the city, and the
only one whose ground is wild (dry grass and rock) rather than paved or planted. Its neighbours:

| Neighbour | Why | ΔE | Differ in | Verdict |
| --- | --- | --- | --- | --- |
| Sagrada Família, outside | Seen from the top | 23 | colour, material (carved sandstone), ground (panot, sauló), light (morning) | ✓ |
| Sants street (proposal) | Closest dominant in the matrix | 5 | material (render, shutters), ground (asphalt, panot), light (shade, cool) | ✓ three of four |
| Rec Comtal and her palace | Seen from the top, far off | 26 | all four | ✓ |
| Poble Sec (proposal) | Also warm, slopes and stairs | 19 | material (render, iron rails), ground (stone steps), light (evening in a street) | ✓ |
| El piso de la Meridiana | Warm honey | 14 | material, ground, light (indoor) | ✓ |

## The zone (`assets/geo/bunkers-carmel/`)

A real-data zone with a sketch on top, like the Meridiana: OpenStreetMap gives the water tank,
the officers' pavilion, the concrete paths and steps, the street and the park
(`osm.json`, 166 features, fetched from Overpass on 2026-10-30); `sketch.json` adds what the map
lacks, drawn from the Actium plan (1:500) georeferenced on the water tank and checked on the ICGC
orthophoto and against OSM's wall arcs (within 2-3 m).

- **Frame**: anchor 41.41938, 2.16175 (the summit, 262 m), turned **180°** (south up) so the view
  is straight up the screen: the crest runs across it, the officers' pavilion and the NE gate on
  the left, the water tank on the right, the parapets along the top edge and the city beyond them;
  the north slope with its paths and the street come towards the camera. People sitting on the
  parapets turn their backs to the camera and face the city, as in every photo of the place.
- **Bounds**: east -75 to 46 m, south -58 to 42 m: 97 × 80 cells of 1.25 m (the cell of Alegia:
  the walls and pits are small), about 5400 walkable cells. Zoom 12.
- **The battery** (sketch, `keep`): the top as a `square` (concrete, gravel, floors); the seven gun
  pits as C-shaped parapets 1.2 m high, open towards the battery's axis (`canonera-a` to `-g`:
  A -30.5/23.3 and B -8/22.3 the twin emplacement, C -18.8/10.5, D 15.3/9.3, E 7/-1, F 12/-15,
  G 23.5/-18.5, east/south metres); the command post between A and B (1.6 m: its south face is a
  parapet to sit on); the parapets along the long terrace's south edge; three whitewashed shack
  walls on the north edge; the excavated shacks under their steel grating, railed off.
- **Slopes**: `forest` (solid scrub) on the steep north edge, the west slope and the gardens beyond
  the street; the map's paths and steps cut through it, so the real paths are the way up. The
  south slope is drawn as scrub in this draft; the build turns it into the drop (below).
- **Arrival**: `station-el-carmel` and its `metro` totem stand on Carrer del Turó de la Rovira at
  the foot of the north-west steps (-50, -40), the camera's side. **Compressed on purpose**: the
  real El Carmel station is 0.8 km north-west, on the Rambla del Carmel, about 70 m lower, but its
  real direction is exactly towards the camera, so the entrance sits where the walk from it
  arrives. From there: the steps, the west gate in the bar fence, the steps beside the water tank,
  and the battery opens at the twin emplacement with the city appearing over the parapets.
- **Places** (Spanish, Gerard's voice): the city (*Mirar la ciudad*, at the long terrace's
  parapet), a gun pit (*Mirar el emplazamiento*), the shacks' floors (*Mirar las baldosas*), the
  water tank (*Mirar el depósito*), the officers' pavilion (*Mirar el pabellón*: closed at this
  hour), the shacks' walls (*Mirar los restos*), the fence (*Mirar la valla*: it is locked at
  dusk; for now the gate is open). `bunkers-norte` (*Mirar al norte*, at the NE end) has no lines:
  the story answers it, so it can show her castle on Trinitat Vella when the story wants it.
- **Styles**: `parapet` (concrete) for every `building=ruins`, `shack` (whitewash over a brick
  base) for the shack walls, `tank`, `pavilion`. The current builder draws them as low houses; the
  build gives them their own kinds (below).

```
                dusk sky · the sea · Port Olímpic · Diagonal Mar                   ↑ south-east
          Glòries · Sagrada Família · the Eixample · Guinardó and Carmel below
 Pavelló ┐           ╭(D)━━━━━━━ long terrace parapet ━━━━━━━━╮(B)
         │  (G)  (F)   (E)     [excavated shacks]     (C)   ▭▭ command post ▭▭ (A)   ◯ dipòsit
         └── north edge: whitewashed shack walls ── scrub ── dry stone terraces ──┘
                   the north path loop · olives and pines · the bar fence
                                                                   west gate ┘
                  ● El Carmel (L5) · Carrer del Turó de la Rovira                  ↓ north-west (camera)
```

`just geo-build bunkers-carmel` builds it (preview in `output/geo/bunkers-carmel/preview.png`); the
draft's preview shows the layout reads: the pits along the crest, the parapets on the view side,
the paths and steps up from the street.

## The view (the backdrop)

The view is the place. Two facts shape it:

- The game's camera is orthographic, about 42.6° down from 40, 52, 40. A point `d` metres further
  along the view and `h` metres lower moves up the screen by `0.68 d - 0.74 h`; with Gerard at the
  parapet and a half-height of 12 m, the top of the screen is about 45 m ahead of him if the city
  lies 25 m below the top. The real city (0.3 to 4.5 km) has to fit in roughly the 20 to 60 m
  round the summit.
- Uniform scale cannot do it: at 1:250 Trinitat Vella would fall under the hill itself, and the
  near Carmel blocks would be as small as the far Eixample, which reads as a map, not a view.

**Proposal: the city remapped round the hill** (`src/landmarks/vista.ts`, a landmark of this zone):

1. Read every building from `public/maps/barcelona-buildings.bin` (the decoder in `src/city-3d.ts`,
   shared) and the ground picture `public/maps/barcelona.webp` (streets, parks, sea).
2. Keep the bearing of everything from the summit and compress its distance: radius
   `ρ = ρ0 + a · ln(1 + r / r0)` with `ρ0` the hill's edge in that direction plus a few metres,
   `r0 ≈ 300 m`, `a ≈ 12.6 m`, so the sea (4.5 km) lands about 60 m from the summit. Each building
   is scaled by the local factor `a / (r0 + r)` (heights too, with the network map's ×2.4 stretch):
   the Carmel blocks just below the hill come out at about half Gerard's height, the Sagrada
   Família (2 km) about 2.3 m, the far Eixample a fine grain. That is the foreshortening of the real
   view, and every landmark stays in its real direction: Sagrada Família SSE, Glòries SE, Montjuïc
   SW, Trinitat Vella NNE.
3. Lower it about 25 m under the top, on the ground picture warped the same way (a polar mesh),
   the sea to its edge, and a dusk sky card behind it (the three bands above). City lights come on
   as emissive dots as the look darkens.
4. Merge it into a few static meshes with one vertex-coloured material (warm facades, lighter
   roofs, as the network map); drop buildings under 6 m or 150 m² beyond 2 km. Target: a handful of
   draw calls and well under 500k triangles.
5. **Her castle** at Trinitat Vella's remapped spot (about 58 m north-north-east of the summit,
   left of the hill and towards the camera): the palace's silhouette from `src/palace.ts`, three or
   four times its local scale so it reads, glowing pink at dusk, sized by `castleThreat`. It is out
   of the follow camera's frame on purpose: *Mirar al norte* at the NE end turns the camera to it
   with the existing `look` effect while Gerard speaks, so it is found, never pointed at.
6. **The hill's flank**: the zone's edge on the view side drops to the backdrop as a skirt of rock
   and dry grass with pines, agaves and prickly pears standing on it, so the miniature is seen past
   real ground, not past a cut.

**Fallback**: a painted panorama card, rendered offline from the same model with a perspective
camera at the summit and the dusk sky, set behind the drop and facing the camera (one draw call).
Decide between them with screenshots of both from the parapet.

## Texture candidates

Shipped textures come from CC0 libraries or openly licensed Commons files (repo and site are
public). The shared library already has `grava`, `terra`, `mao`, `rajola`, `mamposteria`, `estuc`
and `formigo`; the new ones (four at most):

| Use | Source | Licence |
| --- | --- | --- |
| `formigo-encofrat`, the signature: board-marked war concrete for parapets, mounts and the command post | Poly Haven [`concrete_layers`](https://polyhaven.com/a/concrete_layers) (Amal Kumar; "coarse formwork lines, chipped edges", 1.55 m); alternatives [`wood_textured_concrete`](https://polyhaven.com/a/wood_textured_concrete) (Dimitrios Savva, 1.8 m), ambientCG `Concrete035` | CC0 |
| `herba-seca`, the dry gold grass of the slopes and between the remains | Poly Haven [`withered_grass`](https://polyhaven.com/a/withered_grass) (Charlotte Baglioni, 2 m); alternatives [`dry_ground_rocks`](https://polyhaven.com/a/dry_ground_rocks) (Rob Tuytel, 4 m), [`dry_ground_01`](https://polyhaven.com/a/dry_ground_01) | CC0 |
| `roca`, bare slate outcrops and the hill's flank | Poly Haven [`rocks_ground_02`](https://polyhaven.com/a/rocks_ground_02) (Rob Tuytel, 2 m); alternatives [`rock_face`](https://polyhaven.com/a/rock_face), [`gray_rocks`](https://polyhaven.com/a/gray_rocks), ambientCG `Rock058` | CC0 |
| `calc`, the shacks' whitewash over brick | Poly Haven [`whitewashed_brick`](https://polyhaven.com/a/whitewashed_brick) (Charlotte Baglioni, 2 m); alternatives [`rough_plaster_brick`](https://polyhaven.com/a/rough_plaster_brick), ambientCG `PaintedPlaster015` / `PaintedPlaster016` | CC0 |
| Rusty niche doors (small, could stay painted) | Poly Haven [`rust_coarse_01`](https://polyhaven.com/a/rust_coarse_01), [`rusty_metal_02`](https://polyhaven.com/a/rusty_metal_02) | CC0 |
| Hydraulic floor tiles of the shacks | Drawn (`tools/textures.py`, like the panot) over `formigo`: 20 cm grey, ochre and patterned tiles, broken patches | own |
| Dry stone terrace walls (north slope) | `mamposteria` (library) or Poly Haven [`stacked_stone_wall`](https://polyhaven.com/a/stacked_stone_wall) | CC0 |
| One signature photo, if the CC0 concrete reads too clean | [Anti-aircraft batteries at Turó de la Rovira, 2016 05.jpg](https://commons.wikimedia.org/wiki/File:Anti-aircraft_batteries_at_Tur%C3%B3_de_la_Rovira,_2016_05.jpg), Benjamín Núñez González (the parapet's concrete, rectified with `textures.py photo`) | CC BY-SA 4.0 |

No generated images: everything here exists in photos.

## Build plan

1. Rebase on the foundation; move the zone onto its materials (`look` ground `herba-seca`,
   paths `formigo`, gravel `grava`) and its landmark format.
2. Wire it: `bunkers-carmel` in `EnvironmentId` and `ENVIRONMENTS`, its `<option>`, its entry in
   `PLACES` (`src/jump-menu.ts`: *Búnkers del Carmel*, *Turó de la Rovira*, group Barcelona),
   `STATION_PLACES['el-carmel']` (`src/transit.ts`; `city.json` already has the station on the L5
   and the `bunker` landmark), the map marker if the place wants one.
3. `tools/geo.py`: a `drop` area kind (solid, painted after paths so the map's paths down the slope
   end at the edge, nothing drawn on it but the flank); `pine` among the tree species; props
   `prickly-pear`, `agave`, `railing` (black iron bars), `lectern` (MUHBA).
4. Fetch the four textures with credits; check each under 400 KB.
5. The battery: the parapets stay sketch buildings, drawn by a `parapet` ground kind in
   `formigo-encofrat` with a plain concrete lid (no roof tiles), so they keep the see-through cut;
   a `bateria` landmark adds the gun mounts, the niches and their doors, the steel grating over the
   excavated shacks, the floor-tile patches and the lecterns, merged by material.
6. The hill's flank and the view (above), the dusk sky and the look `bunkers-carmel` in
   `src/grading.ts` (warm, a touch of haze, deep warm shade), `AIR` with gusts and seeds.
7. People: the news set's figures (`src/news-set.ts`) sitting along the parapets facing the city,
   one with a guitar, a few standing with phones; the civic agent at the west gate.
8. Story: no flag yet; `bunkers-norte` and the gate are the hooks (the castle seen from afar; the
   civic agent closing at dusk as a diegetic end of the visit).
9. Tests (`npm test`: reachable grid, places, station) and `scripts/screenshots/bunkers-carmel.json`
   (arrival at the steps, the twin emplacement, the parapet with the city, the NE end looking
   north, the overview); `just screenshots bunkers-carmel --gpu`, then `gpu-perf` for the backdrop.

## Approximate, open and risky

- The game's ground is flat: the pits are not sunk, the slopes are not slopes; the level changes
  are shown by parapets, steps and the flank, never walked.
- The battery's pieces are within 2-3 m of the real ones; the shacks' walls and floors are a
  selection, not a survey.
- The El Carmel entrance is compressed 0.8 km (said above, and in `zone.json`).
- The dusk is a colour and a sky, not a different sun direction (the style guide's rule); the
  real sunset light comes from the right of the screen and a little behind.
- The remapped city is new code reading 3.6 MB of buildings: cost and legibility decide between it
  and the painted card.
- Sants (proposal) has the nearest dominant (ΔE 5); they differ in material, ground and light.
