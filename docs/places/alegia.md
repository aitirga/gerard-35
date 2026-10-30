# Alegia · San Juan kalea

The Basque village in the game: San Juan kalea in Alegia (Tolosaldea, Gipuzkoa), from number 95
to the town hall, Zubi Zaharra and the start of the old street's north-east turn. It is the
worked example of [environment-styling.md](../environment-styling.md); this page is its brief:
what the real place is, how it should feel in the game, and the plan to rebuild it with real
materials, better geometry and life.

Status (2026-10-30): researched and drafted. `assets/geo/alegia/zone.json` has the wider bounds,
new reference notes, corrected stone and roof colours, the church-square plane trees and one new
place (the stone cowbell); `osm.json` was fetched again. The game still reads the previous
`src/geo/alegia.json`: the rebuild waits for the shared materials pipeline (`tools/textures.py`),
landmark modules (`src/landmarks/`) and the style guide (`docs/visual-style.md`).

## The real place

Alegia (1,813 people in 2025) sits at about 94 m in a narrow bend of the Oria, where the Amezketa
stream joins it, between steep wooded hills. The village is essentially **one street, San Juan
kalea, running along the river**, with the main square opening halfway along where the town hall
stands ([Basque heritage listing of the historic core](https://www.euskadi.eus/conjunto-del-nucleo-historico-de-alegia/alegia/web01-a4donjak/es/)). Behind it, on the north side, run the
Madrid–Hendaye railway and the N-I; on the south bank, past the old bridge, there are a few houses,
the school and the sports area.

What a local would recognise, in order:

1. **The town hall** (Alegiko udaletxea, 63): 18th-century baroque, square, three storeys of cool
   grey ashlar with rusticated quoins and a hipped roof with deep dark eaves. On the square: a
   portico of **four round arches**, a **continuous iron balcony** on the first floor, four single
   balconies above with curved pediments, a central gable with the **coat of arms** (granted by
   Enrique IV) and a big **clock turret with a bell spire**. On the river side it stands on the
   rubble river wall with a **five-arch loggia**. Design attributed to Martin Karrera Aranburu,
   remodelled about 1770, restored 1986–1989 ([Alegia, Basque Wikipedia](https://eu.wikipedia.org/wiki/Alegia)).
2. **Zubi Zaharra**, the old bridge (late 17th century, partly rebuilt after the 1983 flood): a
   narrow humpback footbridge of grey rubble and ashlar, one large and one smaller round arch, a
   central pier whose rounded cutwater rises to a little refuge with a **cross**; moss and ferns
   everywhere. It starts at the town hall, through a vaulted passage beside Zubimusu (65).
3. **San Juan Bautista church** (17th century, 1643, baroque): Latin cross with the apse to the **west**, against
   custom; square ashlar **belfry at the foot** (east) with a pointed arch at its base; baroque
   portal with an oculus and a niche with the saint, facing a small square of **pollarded plane
   trees** and a stone fountain (Elizako iturria).
4. **The old houses of San Juan kalea** (61–91 on the river side): three and four storeys, ground
   floors of warm rubble or ashlar, upper floors whitewashed with **dark timber framing** or brick
   nogging, wooden balconies and glazed galleries, iron balconies with **geraniums**, deep eaves on
   carved brackets. Every house has its **name** (Konfiteroenea, *the confectioner's*;
   Kafeteroenea; Txanboliñenea; Organistaenea; Zubimusu…), all in OpenStreetMap. Street lamps are
   **wall brackets painted blue with cream bowl shades**.
5. **The river fronts**: behind the houses, back gardens on a three-metre rubble wall with a brick
   coping, brick pillars and white iron railings, wooden balconies above, and a **weir** just
   upstream of the bridge, loud enough to hear from the street.
6. **Txintxarri plaza**, by the river east of the town hall: a **giant stone cowbell** (joare)
   lying on rocks. People from Alegia are nicknamed *txintxarris* after the cowbells the town
   used to make ([Alegría de Oria, Spanish Wikipedia](https://es.wikipedia.org/wiki/Alegr%C3%ADa_de_Oria)). Beside it a wisteria pergola with
   terraces and a wooden culture cabin (Kabia, 2023).
7. **93–95**, where the zone starts: a modern four-storey block with a ground-floor arcade, cream
   render and iron balconies, facing Don Pio Montoya square and its round plane tree.

Around the zone, not in it: the open-air **pelota court** and **Santo Kristo hermitage** (an open
porch with wooden posts, a grille and a bell between two beams) by Parke Haundie, the **railway
station** (Adif, cream render, red name board) and the **gaztetxea** (a red former railway shed),
200 to 300 m north-east of the town hall, up the street; the Elorri pitch and the culture and
sports house on the south bank, by the Amezketa stream.

Life, from the town's own calendar ([fiestas 2022](https://www.ondavasca.com/txintxarri-abesbatzak-botako-du-alegiako-jaietako-txupinazoa/amp/)): the fiestas are in **mid-July**. The
**Txintxarri choir** launches the txupinazo from the town hall; there are giants, txistularis,
bertsolaris in the square, cider on the bridge, a **toka** contest (old men in txapelas throwing
discs, [photo](https://commons.wikimedia.org/wiki/File:Toka.jpg)), pelota finals, and at midnight on the last day the *Txintxarria* is burned.

What changed recently: the Kabia cabin (May 2023); the riverside cycle path to Tolosa (2008); the
town hall restoration (1986–89). The 2016 photo of San Juan kalea shows a grey surface with
red-brown edge bands; Street View (June 2025) shows asphalt.

### Sources

- Basque Government, [*Conjunto del núcleo histórico de Alegia*](https://www.euskadi.eus/conjunto-del-nucleo-historico-de-alegia/alegia/web01-a4donjak/es/):
  the street, the town hall, the church, the hermitage.
- [Alegia](https://eu.wikipedia.org/wiki/Alegia) (Basque Wikipedia) and
  [Alegría de Oria](https://es.wikipedia.org/wiki/Alegr%C3%ADa_de_Oria) (Spanish Wikipedia):
  history, dates, the *txintxarri* nickname.
- Onda Vasca, [the 2022 fiestas programme](https://www.ondavasca.com/txintxarri-abesbatzak-botako-du-alegiako-jaietako-txupinazoa/amp/).
- Commons: [Category:Alegia](https://commons.wikimedia.org/wiki/Category:Alegia) and
  [Heritage buildings in Alegia](https://commons.wikimedia.org/wiki/Category:Heritage_buildings_in_Alegia)
  (98 + 39 files; most by Zarateman under CC0, the rest CC BY-SA). Downloaded at 1280 px to
  `output/refs/alegia/` with `credits.tsv` (git-ignored).
- OpenStreetMap (ODbL), fetched 2026-10-30, and the PNOA orthophoto (© Instituto Geográfico
  Nacional, CC BY 4.0) from the IGN WMS for roof colours and the layout, saved to
  `output/refs/alegia/ortho/`.
- Txindoki: https://en.wikipedia.org/wiki/Txindoki (1,346 m, the limestone pyramid at the west end
  of Aralar, about 8.6 km south of Alegia).
- Google Maps and Street View: reference only, never saved or shipped. Not reopened in this pass:
  the June 2025 notes in `zone.json` come from the first check; the new viewpoints there (links in
  `output/geo/alegia/google/links.md`) are for the build step's look.

## Identity card

| | Alegia |
| --- | --- |
| Dominant hue | **Wet valley green** `#3e5a36`: the wooded hills that close every view, meadows `#6f8f4c` higher up |
| Secondary hue | **Cool grey ashlar** `#9c9a96` (town hall, church, bridge), dark when wet |
| Signature material | Grey ashlar and rubble stone, often wet, against **whitewash `#ece7dc` with dark timber framing `#5a3b2c`** |
| Roofs | Curved clay tiles weathered to a dusty brown-red `#a8614a`, with grey lichen; the town hall's darkest |
| Ground | Grey granite setts in fan arcs with pale bands (town hall square), grey street with red-brown edge bands, the river's grey gravel bars |
| Silhouette / landmark | The town hall's **clock turret** and the square **belfry** rising over hipped roofs, with Zubi Zaharra's hump below |
| Light and mood | Overcast and soft, **txirimiri** (fine drizzle) that comes and goes, low cloud caught in the hills, wet sheen on stone; a cool grade (the existing `alegia` grade: crisp air, clean greens) |
| Accents | Geranium red `#d6383f` on balconies, oxblood shutters `#9a3324`, green riverside railings `#4f8a3c`, blue lamp brackets `#2f5584` |
| Props kit | Pollarded plane trees, blue wall lamps, iron and wooden balconies with geraniums, house-name plaques, stone fountains, benches, green railings, brick-pillar garden fences, the bridge cross, hydrangeas, a wood stack, garden haystacks (`meta`), July bunting |
| Ambient sound | The **weir's rush**, the town hall clock bell on the hour, a train on the Madrid–Hendaye line now and then, and **cowbells far up the hill** |
| Only here | The **giant stone cowbell** in Txintxarri plaza, and every old house wearing its Basque name |

How it stands apart: Barcelona's places are Mediterranean (warm ochre and sandstone, panot
sidewalks, hard sun, sea blue) and Cardedeu is a warm Vallès afternoon of stone and red roofs.
Alegia is the only place that is **green, grey and wet**: closed in by hills instead of open to the
sky, cool light instead of warm, stone that shines with rain, and Basque on every sign. From the
overview the read should be instant: a thin grey-and-white village squeezed between a green river
and a green mountain.

## Layout (the zone)

| | Before | Now (`zone.json`) |
| --- | --- | --- |
| Bounds (metres from 95) | west -45, east 190, north -65, south 55 | west -45, east **290**, north **-95**, south **60** |
| Size | 235 × 120 m, 188 × 96 cells | 335 × 155 m, **268 × 124 cells** of 1.25 m |
| Content | 95 to the town hall | + the whole town hall square, Txintxarri plaza, both bridges, Bulebarra, the start of the north-east street (bars, post office, pharmacy, Parke ttikie) |
| OSM | 35 buildings | 62 buildings, 36 roads, 6 places, 12,517 walkable cells |

- **Rotation 180°** stays: south (the river) is at the back, the street fronts of the river-side
  houses, the town hall's square front (north-west) and 95's arcade face the camera. The church's
  portal faces east and so stays out of view; its north flank, apse and belfry are what the
  camera shows.
- **Edges** are the river (back), the railway and the N-I (front), the wooded south bank, and the
  street running on at both ends. No invisible walls.
- **Spawn** stays at 95 (cell 235, 55 in the new grid). Arrival by bus would fit too: the
  bus stop (Alegiko geltokia) is by the town hall square.
- Extending to the station and the pelota court would roughly double the grid (the street bends
  north-east); not done. If the trip to the Basque Country arrives by train, the station is the
  natural next extension.
- Every cell shifts by (+80, +4) after the next `just geo-build alegia`: the screenshot scenario
  must be updated in the same step.

## Geometry plan

- **Town hall**: a landmark module replacing the extruded box: the four-arch portico on the
  square, the five-arch loggia on the river, the arched passage to the bridge, the continuous
  balcony, four single balconies, the pediment with the coat of arms, the clock turret with its
  bell spire, deep dark eaves. Taller than now: about 13 m to the eaves (tall civic storeys) and
  22 m to the spire.
- **Zubi Zaharra**: a modelled humpback bridge, 38 m long and about 2.5 m wide, a large arch on the
  town hall side, a smaller one on the south, the rounded cutwater rising to the refuge with the
  cross, low parapets. The deck stays walkable; the arches show the river through them.
- **Church**: nave and transept at the real 23 × 39 m, the belfry at about 25 m with a bell
  opening on each face and a hipped tile cap; the church square with its three plane trees and
  fountain.
- **93–95 arcade**: walkable under the first floor (today it is solid), with square pillars.
- **River**: the rubble river wall with brick coping along 61–91, the gardens with brick pillars
  and white railings, the green-railed riverside path, the weir as a line of white water, grey
  gravel bars, alders and willows on both banks.
- **Hills and skyline**: the sphere hills become layered ridges: near, broadleaf woods; middle,
  meadows with two or three white farmhouses; far, the Aralar ridge with **Txindoki's pale
  limestone pyramid** at the back (south), softened by haze. Whether Txindoki shows from the
  street is unconfirmed (the valley is narrow); putting it on the skyline is a small licence.
- **Per house**: walls and facades from the photos (65 pale blue-grey, 61 grey pebbledash with
  green shutters; blue, pink-red and yellow timber-framed houses where the build can place them),
  house-name plaques on the old houses.
- **Ground**: grey setts in fan arcs on the town hall square, red-brown paving at Don Pio Montoya,
  grey street with red-brown edge bands.

## Life and effects

- **Weather**: txirimiri as the default mood (rain at low intensity, 0.2–0.35, with dry spells),
  using the existing weather; low mist on the river in the morning and cloud bands on the hills.
- **The river**: flowing Oria with foam at the weir and a sound; ripples under the drizzle.
- **People**: toka players in txapelas by Txintxarri plaza, someone on a bench under the pergola,
  a kid with a pelota at Parke ttikie.
- **A frontón, invented where it fits**: Alegia's real pelota court is just outside the map, so a
  small kids' pelota wall (green front wall, white lines, metal *chapa* strip) goes on the real
  playground court of Parke ttikie, marked as invented.
- **Food and a txoko**: the bars on the north-east street (Iskiña, Hilario Berri) for pintxos;
  an invented confectioner at **Konfiteroenea** (73), true to the house's name; a txoko door
  (members only, a diegetic gate) on a ground floor near the bridge.
- **Fiestas** (story choice): July bunting across San Juan kalea, the town hall balcony dressed
  with flowers. Keep flags and banners neutral (the real facade often carries political banners;
  the textures paint them out).
- **Sound** (ambiences per place are still to do in the audio system): weir, clock bell, train,
  distant cowbells.

## Marta (not decided)

The story places Marta, Aitor's best friend and a singer, in the Basque Country, reached with an
expensive train ticket. Alegia could become her place: a choir launches the town's fiestas from
the town hall, bertsolaris sing in the square, and the station is a short walk up the street.
That is only a possibility for the story to decide; nothing in the zone depends on it.

## Texture candidates

All shipped textures come from these (webp, ≤ 1024 px, one signature facade at 2048, under about
400 KB each, credits in `public/textures/credits.json`).

| Use | Source | Licence | Author | Notes |
| --- | --- | --- | --- | --- |
| Town hall facade (signature) | [Alegia - Ayuntamiento 3](https://commons.wikimedia.org/wiki/File:Alegia_-_Ayuntamiento_3.JPG), frontal, 960 × 1280 | CC0 | Zarateman | Rectify, paint out the banners and the flag; [Alegiako udaletxea](https://commons.wikimedia.org/wiki/File:Alegiako_udaletxea.jpg) (3040 px, CC BY-SA 4.0, Uranzu) if 2048 px is needed |
| Town hall river side and loggia | [Alegia 12](https://commons.wikimedia.org/wiki/File:Alegia_12.JPG), [Ayuntamiento 4](https://commons.wikimedia.org/wiki/File:Alegia_-_Ayuntamiento_4.JPG) | CC0 | Zarateman | Ashlar bay and loggia arch |
| Belfry | [Iglesia de San Juan Bautista 2](https://commons.wikimedia.org/wiki/File:Alegia_-_Iglesia_de_San_Juan_Bautista_2.jpg) | CC0 | Zarateman | Bell-opening bay |
| Bridge stone | [Alegia 08](https://commons.wikimedia.org/wiki/File:Alegia_08.JPG) | CC0 | Zarateman | Mossy rubble crop for the pier and spandrels |
| River wall, gardens | [Alegia 10](https://commons.wikimedia.org/wiki/File:Alegia_10.JPG) | CC0 | Zarateman | Rubble wall with brick coping |
| Timber-framed bays | [Alegia 37](https://commons.wikimedia.org/wiki/File:Alegia_37.jpg) (white), [Alegia 04](https://commons.wikimedia.org/wiki/File:Alegia_04.JPG) (blue), [Alegia 35](https://commons.wikimedia.org/wiki/File:Alegia_35.jpg) (brick nogging) | CC0 | Zarateman | One bay each, rectified |
| Rubble ground floor, wall lamp | [20160819 Alegia kalea](https://commons.wikimedia.org/wiki/File:20160819_Alegia_kalea.jpg) | CC BY-SA 4.0 | Ksarasola | Reference for the blue lamp bracket; rubble from ambientCG instead |
| Shutters, door | [Alegia 06](https://commons.wikimedia.org/wiki/File:Alegia_06.JPG), [Alegia, puerta 1](https://commons.wikimedia.org/wiki/File:Alegia,_puerta_1.jpg) | CC0 | Zarateman | Window and studded door |
| Grey ashlar | Poly Haven `large_grey_tiles`; ambientCG `Bricks066` (rusticated quoins) | CC0 | | Tint cool grey |
| Warm rubble | Poly Haven `stone_wall`; ambientCG `Bricks099` | CC0 | | Old ground floors |
| Wet grey rubble | Poly Haven `castle_wall_varriation`, `stone_wall_04` | CC0 | | Bridge, river wall |
| Whitewash | ambientCG `Plaster001`, `Plaster003`; Poly Haven `painted_plaster_wall` | CC0 | | Tinted per house |
| Roof | Poly Haven `roof_09` (weathered canal tiles), `ceramic_roof_01` (mossy) | CC0 | | Tint toward `#a8614a` |
| Setts and slabs | ambientCG `PavingStones126A`; Poly Haven `large_grey_tiles` | CC0 | | Square and street |
| River bed | Poly Haven `river_small_rocks`, `dry_river_pebbles`; ambientCG `Ground022` | CC0 | | Gravel bars |
| Timber, balconies | Poly Haven `dark_planks`, `rough_wood`; ambientCG `Planks023A` | CC0 | | |
| Brick nogging, pillars | Poly Haven `mixed_brick_wall`, `brick_wall_001` | CC0 | | |
| Hills | Poly Haven `forest_leaves_02`, ambientCG `Grass007`, `Moss002` | CC0 | | Far ridges stay painted |

## Build plan

1. Merge the foundation; read `docs/visual-style.md` and the texture and landmark APIs.
2. `just geo-build alegia` with the new bounds; update `scripts/screenshots/alegia.json` cells
   (+80, +4) and add shots: the town hall square, Txintxarri plaza, Zubi Zaharra and the weir,
   the north-east street with Parke ttikie, the overview, and the same street under txirimiri
   (`?weather=rain&intensity=.3`).
3. Textures: process the CC0 materials and the Commons crops above with `tools/textures.py`;
   assign them through the zone's styles (ashlar, rubble, whitewash, timber, roof, setts).
4. Landmarks: town hall, Zubi Zaharra and the church belfry as modules in `src/landmarks/`, keyed
   to their OSM ids so the grid and places stay as they are.
5. River and edges: river wall, garden fences, weir, gravel bars, riparian trees.
6. Hills and skyline: layered ridges, farmhouses, the Aralar and Txindoki backdrop, mist bands.
7. Life: the default drizzle, toka players, the pelota wall at Parke ttikie, bunting (if the
   story wants July), house-name plaques, blue wall lamps.
8. Check `just typecheck`, `npm test`, the screenshots (looked at, not trusted), and keep draw
   calls in budget: one material per texture, static meshes batched.

## Approximate or open

- Storeys and colours are per style except where set per house; most houses are not checked one
  by one against Street View.
- The church portal faces away from the camera; nothing is turned to show it.
- Txindoki on the skyline is a licence; the kids' pelota wall is invented; the confectioner at 73
  and the txoko are invented.
- The street's surface (asphalt in 2025, slabs in older photos) needs a last look in Street View.
- The station, the real pelota court and the hermitage are outside the map.
