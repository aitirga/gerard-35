# Sagrada Família · the surroundings and the inside

Status: research and draft (2026-10-30). Nothing is wired into the game yet: the zone draft lives in
`assets/geo/sagrada-familia/`, the inside is planned below, and the build waits for the shared
foundation (real materials in `tools/textures.py`, landmark modules in `src/landmarks/`,
`docs/visual-style.md`).

Two places for a later mission (the story does not use them yet):

| Id | What | How it is reached |
| --- | --- | --- |
| `sagrada-familia` | The basilica's block and its two squares: the Nativity facade over the pond of Plaça de Gaudí, the Passion facade on Plaça de la Sagrada Família, the start of Avinguda de Gaudí, the queues and the cranes | Metro: the station `sagrada-familia` (L5 on the network map today; the real station is also L2, which the map adds when this place exists, `docs/barcelona.md`) |
| `sagrada-familia-interior` | The inside: the forest of columns, the stained glass, the coloured light on the floor, the altar under its canopy | The Nativity portal, in and back out |

## The real place in 2026

- **The Tower of Jesus Christ is finished outside.** Its cross was set on 20 February 2026, bringing
  the basilica to 172.5 m, the tallest church in the world (Ulm Minster is 161.5 m); Pope Leo XIV
  blessed it on 10 June 2026, the centenary of Gaudí's death. The cross is white, hollow and
  three-dimensional. Inside the tower, work runs to 2028.
- **14 of the 18 towers stand**: the four of the Nativity (98-107 m), the four of the Passion
  (107-112 m), the four Evangelists (about 135 m with their figures: winged bull, eagle, angel,
  lion), Mary's (138 m, crowned since 2021 by a 7 m twelve-pointed glass star lit at night) and
  Jesus'. The Glory's four towers are not built.
- **The Glory facade** (south-east, Carrer de Mallorca), the main entrance, is still a construction
  front: scaffolding, a hoarding, the bronze doors with the Lord's Prayer in Catalan (2008); its
  stair over Carrer de Mallorca is planned but not built. Two or three yellow tower cranes stay.
- **Two stones, two ages.** The Nativity (1893-1936, the facade Gaudí built) is Montjuïc sandstone,
  weathered ochre-brown with soot-grey hollows, sculpture that drips like wax, the green cypress
  with white doves over the central portal, four towers pierced by vertical slots and crowned by
  Venetian-glass mosaic mitres in red, gold and white, *Sanctus* spelled down them. Everything newer
  (nave walls, apse, the high towers) is pale cream-grey ashlar (since 2018 partly from Withnell
  quarry, Lancashire); the high towers are covered in a lattice of triangular openings. From far
  away the dark old front against the pale new mass is the read.
- **The Passion facade** (south-west, Carrer de Sardenya): bare pale stone, six inclined bone-like
  columns, a white pediment of bone columns with *IESUS NAZARENUS REX IUDAEORUM* in big letters and
  a cross, Subirachs' angular figures (carved from 1987).
- **Plaça de Gaudí**: a pond of about 48 × 55 m in green water with reeds and rocks, the Nativity
  reflected in it (the postcard), stone pines and palms, gravel paths, benches, a playground and
  courts at the Lepant end. **Carrer de la Marina** in front of the facade is pedestrian: queues,
  crowd barriers, the visitor entrance signs (A, B, C, D), tour groups behind a flag or umbrella.
- **Plaça de la Sagrada Família**: gardens with gravel paths, a playground and a dog run; cafés and
  souvenir shops on its corners.
- **Avinguda de Gaudí**: a pedestrian diagonal from the Marina/Provença corner to Sant Pau,
  pointing straight at the basilica; Pere Falqués' modernista lamp posts (the *Cinc d'Oros* model,
  set on the avenue in 1985 and usually taken for Gaudí's); café and ice-cream terraces.
- **Around**: Eixample blocks of six to nine storeys with chamfered corners; older ones in cream,
  sand and ochre render with iron balconies, newer 1960s-70s flats with continuous balconies and
  aluminium windows; ground floors of souvenir shops, cafés and fast food. Gaudí's one-storey
  **Escoles** (brick, wavy roof) stand on the Mallorca/Sardenya corner of the basilica's block.
- **The inside** (consecrated 2010): a Latin cross, five aisles in the nave and three in the
  transept, about 90 m long and 60 m across the transept; columns on a 7.5 m grid that branch like
  trees; vaults at 30 m (side aisles), 45 m (nave), 60 m (crossing) and 75 m (apse). The column
  stone follows the load: red porphyry (the four at the crossing, with the Evangelists' symbols in
  lit ovals at their knots), dark basalt, grey granite, sandstone. Joan Vila-Grau's stained glass is
  cool blue and green on the Nativity side (east: birth, morning) and warm red, orange and yellow on
  the Passion side (west: death, sunset), so the white stone and the floor are washed in both. Over
  the altar hangs a seven-sided canopy fringed with lamps, vine leaves, grapes and wheat, Christ
  crucified under it; the organ's pipes behind; gaps in the apse floor show the crypt where Gaudí is
  buried.
- **Crowds**: about five million visitors a year (2025).

### Sources

- [Sagrada Família](https://en.wikipedia.org/wiki/Sagrada_Fam%C3%ADlia) (Wikipedia, read 2026-10-30):
  history, 2026 state, plan, vault heights, column grid, facades.
- Catalan News, [the cross is set](https://www.catalannews.com/society-science/item/sagrada-familia-reaches-1725-metres);
  Vatican News, [cross completed](https://www.vaticannews.va/en/church/news/2026-02/basilica-sagrada-familia-cross-completed-tower-of-jesus-christ.html).
- Sagrada Família blog, [the columns: geometry, mechanics and materials](https://blog.sagradafamilia.org/en/columnes-sagrada-familia-geometria-mecanica-materials-bosc-pedra/)
  (twelve-pointed porphyry, ten basalt, eight granite, six sandstone).
- Barcelona Turisme, [Avinguda Gaudí](https://barcelonaturisme.com/wv3/en/page/1238/avinguda-gaudi.html) (the Falqués lamps).
- OpenStreetMap (ODbL), fetched 2026-10-30: the basilica `relation/9194723` with every tower as a
  `building:part` and its height, Plaça de Gaudí `relation/7708297`, its pond `way/642764418`,
  Plaça de la Sagrada Família `way/23431084`, Avinguda de Gaudí `way/175630078`, the metro
  entrances `node/320188474` (Provença / Avinguda Gaudí), `node/71709847` (Mallorca / Marina),
  `node/320188472` and `node/983361223` (Sardenya side).
- Photos looked at (Wikimedia Commons, all openly licensed; downloads stay in `output/refs/sagrada/`):

| What | File | Author | Licence |
| --- | --- | --- | --- |
| Nativity over the pond, August 2026 | [View of Sagrada Familia 2026 corrected.jpg](https://commons.wikimedia.org/wiki/File:View_of_Sagrada_Familia_2026_corrected.jpg) | ほっきー | CC0 |
| Passion side and its pediment, April 2026 | [Sagrada Família exterior Barcelona 2026.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Fam%C3%ADlia_exterior_Barcelona_2026.jpg) | Wikipsico43 | CC BY-SA 4.0 |
| Passion facade close, the day after the cross | [Sagrada Familia front side.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_front_side.jpg) | Blablabalooo | CC BY-SA 4.0 |
| Nativity and the nave's pale side wall, February 2026 | [Sagrada Familia back side.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_back_side.jpg) | Blablabalooo | CC BY-SA 4.0 |
| Nativity portal from the ground | [Sagrada Família Nativity Façade from Ground, Barcelona, 2023.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Fam%C3%ADlia_Nativity_Fa%C3%A7ade_from_Ground,_Barcelona,_2023.jpg) | Julian Lupyan | CC0 |
| Inside: apse, canopy, porphyry columns, August 2026 | [Apsis Sagrada Familia.jpg](https://commons.wikimedia.org/wiki/File:Apsis_Sagrada_Familia.jpg) | Triptychon | CC0 |
| Inside: the warm west glass | [Sagrada Família Passionside.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Fam%C3%ADlia_Passionside.jpg) | Triptychon | CC0 |
| Inside: the Glory wall's rose and the columns' knots | [Sagrada Familia South.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_South.jpg) | Triptychon | CC0 |
| Inside: vault, medallions, rose, April 2026 | [Interior de la Sagrada Família Barcelona 2026.jpg](https://commons.wikimedia.org/wiki/File:Interior_de_la_Sagrada_Fam%C3%ADlia_Barcelona_2026.jpg) | Wikipsico43 | CC BY-SA 4.0 |
| Avinguda de Gaudí at night with a Falqués lamp | [220 La Sagrada Família (Barcelona), des de l'avinguda de Gaudí, Nadal 2024.jpg](https://commons.wikimedia.org/wiki/File:220_La_Sagrada_Fam%C3%ADlia_(Barcelona),_des_de_l%27avinguda_de_Gaud%C3%AD,_Nadal_2024.jpg) | Enric | CC BY-SA 4.0 |

Google Maps and Street View were used only to look (`output/geo/sagrada-familia/google/links.md`
has the four viewpoints); nothing from them is saved or shipped.

## Identity card

| | Outside (`sagrada-familia`) | Inside (`sagrada-familia-interior`) |
| --- | --- | --- |
| Dominant hue | Weathered ochre-umber of the Nativity `#8a7764`, soot in its hollows `#544839` | Bone-white stone `#ece6db` |
| Secondary hue | Pale new stone `#ddd3c1` and the high towers' warm grey `#b8ab96`; the jade-olive pond `#6f7a4a` and pines `#4a5228` | The glass's two halves: blue `#2f6fc0` and green `#3a9a5c` near the Nativity, orange `#e0742c` and red `#c43a2a` near the Passion |
| Accents | Mosaic red `#b8322a`, Venetian gold `#d6a428`, the white cross, crane yellow `#e6b31e` | Porphyry `#8a6a62`, basalt `#534d47`, vault gold `#c48f4e` |
| Signature material | Carved sandstone in two ages, side by side | Polished column stone and stained glass |
| Ground | Grey panot sidewalks, granite slabs on the pedestrian Marina, *sauló* (pale sand) in both squares, the pond | Pale limestone slabs, crypt grilles in the ambulatory |
| Silhouette | The cluster of honeycomb spires rising to the white cross, Mary's star, the cranes; nothing else in the city is as tall | Trunks that split at a knot into branches holding hexagonal vault "umbrellas" |
| Light and mood | Strong Mediterranean sun from the south-west, long spire shadows across Plaça de Gaudí and the pond; busy, touristic, a little overwhelming. At night the cross and the star glow | Hushed; light comes in colour, cool on the near side, warm on the far side, and moves slowly over the floor |
| Props kit | Grey crowd barriers and the queue, tour groups behind a raised umbrella, the entrance signs, souvenir kiosks and terraces, stone pines and palms, reeds in the pond, tower cranes, scaffolding and hoarding on the Glory, Falqués lamps, the L2/L5 entrance | Rows of wooden chairs, the canopy, the organ, *silencio* signs, rope barriers, the Evangelists' medallions, visitors looking up |
| Ambient sound | Crowd murmur in many languages, a guide's voice, pigeons, a crane's beep and a distant drill | A long reverberant hush, footsteps, a whispered *silencio*, an organ note now and then |
| Only here | The pond reflects the Nativity and its spires, upside down and trembling | The floor is painted by moving pools of coloured light |

How it stands apart from the other places: the Meridiana is an avenue of beige flats, plane trees
and red-white works barriers; Trinitat Vella is brick and render round a school; Cardedeu is low
terracotta; Alegia is green, wooden and Basque; Plaça d'Espanya (its own stream) is red brick and
fountains. Here a single building dominates every frame, the stone itself changes colour with its
age, and the water is a still, green park pond, not a fountain. The palace's pink never appears.

## Outside: the zone (`assets/geo/sagrada-familia/zone.json`)

A real-data zone like the Meridiana: OpenStreetMap for the blocks, streets, squares, pond, trees,
lamps, benches and shops (`osm.json`, 3202 features, fetched from Overpass on 2026-10-30), styled in
`zone.json`.

- **Frame**: anchor 41.4036, 2.1744 (the crossing), turned **135°** with `bounds_turned`, so the
  Eixample grid runs along the game's axes: Carrer de la Marina along x, the Nativity facing +z
  (the camera's side) and the apse facing +x. Both seen faces are the ones a local recognises from
  Plaça de Gaudí and from Avinguda de Gaudí, which points straight at the camera. The Glory
  (Mallorca, a construction front) is on the left; the Passion (Sardenya) is at the back and is
  reached by walking round the block.
- **Bounds** (turned frame, metres): x −110 (the flats across Mallorca) to 130 (the flats across
  Provença and the first 80 m of Avinguda de Gaudí); z −135 (half of Plaça de la Sagrada Família)
  to 182 (the far end of Plaça de Gaudí, before Lepant's houses). 1.5 m cells: **160 × 211**,
  90 buildings, about 19 700 walkable cells. Zoom 14 (wider than the Meridiana's 11.5, for the
  height).
- **Streets** (centre lines in the turned frame): Marina z ≈ 72 (pedestrian in front of the
  Nativity), Sardenya z ≈ −80, Mallorca x ≈ −69, Provença x ≈ 64 (pedestrian along the apse).
  Avinguda de Gaudí leaves the Marina/Provença corner at (64, 71) towards +x +z.
- **The basilica's block**: the church footprint from OSM (x −52…54, z −55…36, the cloister
  included), the Escoles (−35, −58), the official shop (−33, 49) and site huts. In the draft the
  church is an ordinary building 15 storeys high so the preview reads; the landmark module replaces
  it.
- **Spawn and station**: at the Provença / Avinguda Gaudí entrance (76, 57), on the corner where
  the avenue starts, so the party comes up with the apse on one side and the Nativity ahead.
  `station-sagrada-familia` with its three-cell stair, like Fabra i Puig.
- **Places** (Spanish, Gerard's voice): the pond (*Mirar el estanque*), the Nativity (*Mirar la
  fachada*), the Jesus tower (*Mirar arriba*), the queue (*Mirar la cola*), the Passion (*Mirar la
  fachada*), the Glory works (*Mirar las obras*), the Escoles, the Falqués lamp. The Nativity portal
  `sagrada-familia-portal` (*Entrar en la basílica*) has neither lines nor a door: the story answers
  it, so it can be a diegetic gate until the mission opens it (a guard at the barrier: the tickets
  for today sold out weeks ago) and the door to the inside afterwards.
- **Labels**: PLAÇA DE GAUDÍ, CARRER DE LA MARINA, CARRER DE SARDENYA, AVINGUDA DE GAUDÍ.
- **Anchors** for the landmark: `basilica` (the crossing), `naixement`, `passio`, `gloria`, `absis`.

```
            Plaça de la Sagrada Família (gardens, playground)          −z, far
  ──────────────────────── Carrer de Sardenya ─────────────────────────
  Mallorca  │ Escoles   [ Passion facade ]                 │ Provença
            │                                              │
  Glory  ◄──┤   nave ───── crossing (Jesus) ───── apse ►   │   flats
  works     │                                              │
            │ shop      [ Nativity facade ]  portal        │ ● metro (spawn)
  ──────────────────────── Carrer de la Marina (pedestrian, queues) ── ╲
            │        Plaça de Gaudí: pines, the pond        │  Avinguda de Gaudí
            │                                               │    ╲  (towards the camera)
                                                                         +z, near
```

The preview (`just geo-build sagrada-familia` → `output/geo/sagrada-familia/preview.png`) shows the
layout reads: the pond centred in front of the Nativity, the four streets, the diagonal avenue.

## The landmark (`src/landmarks/sagrada-familia.ts`, after the foundation)

Built in code, recognisable from the diorama camera, not a sculpture-by-sculpture model.

- **Heights stay real** (they are the point): Jesus 172.5 m with the cross, Mary 138 m with the
  star, Evangelists 135 m, Passion 107-112 m, Nativity 98-107 m, nave roof roughly 60 m (to check
  against a section). In the follow camera the portals and the base of the towers fill the frame;
  the overview shows the whole cluster. If the overview cannot frame it, scale only the spires above the nave (not the
  footprint) and say so.
- **Towers from OSM**: one per `building:part`, at its centroid in the turned frame: Nativity
  Bernabeu (−13, 30) 98 m, Simó (−5, 29) 107, Judes Tadeu (9, 29) 107, Maties (16, 29) 98; Passion
  Felip (−11, −39) 107, Tomàs (−4, −39) 112, Bartomeu (9, −40) 112, Jaume (16, −40) 107;
  Evangelists Joan (−8, 6), Lluc (12, 6), Mateu (−8, −15), Marc (13, −14) 125 (135 with figures);
  Mary (25, −4) 123 (138 with the star); Jesus (2, −3) 170 (172.5).
- **Shapes**: the bell towers are lathed parabolic cones (round section, tapering, a slight bulge),
  then the mitre: a faceted cap and the mosaic finial (a ball of white spheres round a red and gold
  cross). The high towers are faceted cones with a lattice of triangular openings and a white
  figure, cross or star on top. Nave and apse: a long block with a stepped roof, pale gabled
  windows with fruit pinnacles along the sides, the apse a ring of pointed pinnacles. Nativity: a
  wide, deep portal block with three pointed portals, the dripping texture and the green cypress.
  Passion: six inclined columns and the white pediment with its letters. Glory: a flat wall with
  scaffolding, a hoarding and two tower cranes.
- **Materials** (few, shared): old stone, new stone, high-tower stone (with the lattice openings
  drawn into the texture, not cut in geometry), mosaic, white (figures, cross, Passion pediment),
  emissive glass (the star and the windows at night), crane yellow. All static parts merged by
  material: about ten draw calls.
- **Nothing hides Gerard**: the same dithered see-through hole as the geo buildings when he walks
  behind it (the Passion square and the Glory side), and the cranes' booms high enough to never
  cut him.

## Inside: the plan (`sagrada-familia-interior`, hand-authored)

A plan of glyphs like the palace's (`src/environments.ts`), at the same 1.5 m cells and in the same
frame as outside (the Nativity towards the camera), so walking in through the Nativity keeps
Gerard's bearings: the cool glass is on the near side, the warm glass on the tall far wall.

- **Size**: 62 × 42 cells (93 × 63 m with the walls): nave x −52.5…−15 m, five aisles over 45 m;
  transept x −15…15, z −30…30, three aisles; crossing 15 × 15 m; apse a half circle of 22.5 m
  round (15, 0). About 90 m long, 60 m across the transept, as the real one.
- **Columns** (one solid cell each), on the 7.5 m grid, by stone: `P` porphyry at the crossing's
  four corners, `B` basalt round it, `g` granite in the nave's central rows, `s` sandstone in the
  aisles and the apse's horseshoe.
- **Walls**: `b` cool glass on the Nativity side, `r` warm glass on the Passion side, `#` the
  Glory's inner wall with its rose. North and west walls (Passion, Glory) stand tall, south and east
  ones (Nativity, apse) are cut low, as in the palace.
- **Doors**: `N` the Nativity door, in and out (to `sagrada-familia-portal`'s cell outside);
  `S` the Passion door and `G` the Glory doors are shut and say why (*Las puertas de la Gloria, de
  bronce, con el padrenuestro en catalán. No se abren.*).
- **Presbytery** `^` two steps up, the altar `A` under the canopy; `O` the organ; `c` crypt grilles.

```
                         rrrrrrrrrrSSSrrrrrrrrr                 0
                         r....................r                 1
                         r....................r                 2
                         r....................r                 3
                         r....................r                 4
#rrrrrrrrrrrrrrrrrrrrrrrrr....................rrrrr             5
#.........................s....s.........s........rrrr          6
#....................................................rr         7
#.....................................................rrr       8
#.......................................................rr      9
#....................................................c...rr     10
#.....s....s....s....s....s....B.........B....B...........r     11
#...............................................s.........rr    12
#..........................................................rr   13
#..................................................s........r   14
#...........................................................r   15
#.....g....g....g....g....g....P.........P....B.............rr  16
#....................................................s.......r  17
#...................................................O........r  18
#.........................................^^^^...............r  19
G.........................................^^^^...............r  20
G.........................................^^A^........s......b  21
G.........................................^^^^...............b  22
#............................................................b  23
#...................................................Os.......b  24
#...........................................................bb  25
#.....g....g....g....g....g....P.........P....B.............b   26
#..................................................s........b   27
#..........................................................bb   28
#...............................................s.........bb    29
#.........................................................b     30
#.....s....s....s....s....s....B.........B....B..........bb     31
#....................................................c..bb      32
#.....................................................bbb       33
#....................................................bb         34
#.................................................bbbb          35
#bbbbbbbbbbbbbbbbbbbbbbbbbs....s.........s....bbbbb             36
                         b....................b                 37
                         b....................b                 38
                         b....................b                 39
                         b....................b                 40
                         bbbbbbbbbbNNNbbbbbbbbb                 41
```

- **The forest, readable from above**: each column is a trunk whose section turns from a star to a
  circle as it rises, a knot (an ellipsoid; the porphyry ones carry an Evangelist's lit oval), then
  four branches up to a hexagonal "umbrella" of vault with a lit oculus. Heights are compressed
  (knots about 12 m, umbrellas about 18 m) so the canopy sits in the frame; the umbrellas between
  Gerard and the camera fade like tree crowns (`src/props.ts`). No ceiling is drawn above the
  umbrellas; the tall far walls carry the glass and the Glory's rose.
- **Light**: soft additive pools on the floor, blue-green on the near half and orange-red on the far
  half, drifting slowly (a sun that moves); faint coloured shafts from the windows with dust motes
  (`src/particles.ts`); the white stone tinted by whichever pool is closest. The canopy's lamps are
  warm points.
- **Things to look at** (draft lines): the columns (*Las columnas se abren en ramas, como árboles de
  piedra.*), the cool glass (*Luz azul y verde en el suelo. El lado del Nacimiento, la mañana.*),
  the warm glass (*Rojo y naranja. El lado de la Pasión, la tarde.*), a porphyry medallion (*Un
  toro con alas en un óvalo de luz: Lucas.*), the canopy (*Siete lados, lámparas, uvas y espigas.
  Debajo, Cristo.*), the crypt grille (*Por la rendija se ve la cripta. Ahí abajo está Gaudí.*).
- **Gates**: the door is the only way in or out; the presbytery's rope and a guard keep the altar
  apart until the mission says otherwise.

## Texture candidates

All through `tools/textures.py` once it lands (`fetch ambientcg|polyhaven`, `photo`, `panot`):
webp, at most 1024 px (2048 only for the Nativity portal), under about 400 KB each.

| Use | Source | Asset or file | Author | Licence |
| --- | --- | --- | --- | --- |
| Nativity stone (old, tinted dark ochre, soot in the hollows) | Poly Haven | `old_sandstone_02` | Poly Haven | CC0 |
| Nativity stone, alternative grain | ambientCG | `Concrete012` (old church sandstone plaster) | ambientCG | CC0 |
| New pale ashlar (nave, apse, high towers) | Poly Haven | `large_sandstone_blocks` | Poly Haven | CC0 |
| New ashlar, alternative | ambientCG | `Bricks084`, `Bricks008` | ambientCG | CC0 |
| High towers' triangular lattice | Own procedural painting over the ashlar grain | — | — | own work |
| Mosaic mitres and finials | Own procedural trencadís (red, gold, white) | — | — | own work |
| Nativity portal (signature facade, rectified, 2048) | Commons | [Sagrada Família Nativity Façade from Ground, Barcelona, 2023.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Fam%C3%ADlia_Nativity_Fa%C3%A7ade_from_Ground,_Barcelona,_2023.jpg) (strong upward perspective: check it rectifies) | Julian Lupyan | CC0 |
| Nave's pale side wall (gables, rose windows) | Commons | [Sagrada Familia back side.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_back_side.jpg) (left half) | Blablabalooo | CC BY-SA 4.0 |
| Passion pediment | Own drawing (bone columns and the letters, crisper than a photo); reference [Sagrada Familia front side.jpg](https://commons.wikimedia.org/wiki/File:Sagrada_Familia_front_side.jpg) | — | — | own work |
| Flats facing Plaça de la Sagrada Família | Commons | [Plaça Sagrada Família, house 1 to 7 Barcelona, Spain 1.jpg](https://commons.wikimedia.org/wiki/File:Pla%C3%A7a_Sagrada_Fam%C3%ADlia,_house_1_to_7_Barcelona,_Spain_1.jpg) | Reda Kerbush | CC BY-SA 4.0 |
| Eixample flats round the block | The foundation's shared Barcelona bay library (Meridiana stream) | — | — | — |
| Sidewalks | `tools/textures.py panot square` | — | own work | — |
| Pedestrian Marina, granite slabs | Poly Haven | `granite_tile_04` | Poly Haven | CC0 |
| *Sauló* in both squares | Poly Haven | `park_sand` (or `park_dirt` under trees) | Poly Haven | CC0 |
| *Sauló*, alternative | ambientCG | `Ground109`, `Gravel023` | ambientCG | CC0 |
| Pond | The river's water tinted jade, plus a planar reflection | — | own work | — |
| Inside floor | ambientCG | `Tiles143` (beige limestone slabs) | ambientCG | CC0 |
| Inside white stone (walls, branches, umbrellas) | Poly Haven | `large_sandstone_blocks` tinted bone-white | Poly Haven | CC0 |
| Granite and basalt columns | Poly Haven | `granite_tile_03` (speckled; basalt tinted dark) | Poly Haven | CC0 |
| Porphyry columns | ambientCG | `Granite004A` or `Travertine010` tinted red-brown (pick the one with crystals) | ambientCG | CC0 |
| Stained glass | Own procedural (abstract leaded cells in Vila-Grau's two palettes), emissive | — | — | own work |

No AI-generated images are needed here: every surface has a real or procedural source.

## Build plan

1. **Rebase** on the foundation; read `docs/visual-style.md`, the landmark registry and
   `tools/textures.py`.
2. **Zone**: refresh `zone.json` to the foundation's fields (materials, landmark), `just geo-build
   sagrada-familia`, add `sagrada-familia` to `EnvironmentId` and `ENVIRONMENTS`
   (`geoEnvironment`), `PLACES` in `src/jump-menu.ts` (group Barcelona), `STATION_PLACES`
   (`'sagrada-familia': { environment: 'sagrada-familia' }`); the totem shows L2 and L5. If the L2
   joins the map, its stations and colour go in `city.json` (the foundation's lines).
3. **Textures**: fetch the CC0 materials above, rectify the two Commons photos, write
   `texture.json` credits.
4. **Landmark**: `src/landmarks/sagrada-familia.ts` at the `basilica` anchor: footprint massing,
   14 towers from the OSM parts, the four facades' signature pieces, cranes and scaffolding,
   see-through hole, merged by material. Night: the cross and the star emissive.
5. **Square and street dressing**: stone pines and palms in Plaça de Gaudí (a new `pine` tree
   species if the kit lacks one), reeds and rocks in the pond, the pond's reflection, queue
   barriers on Marina, tour groups (a `crowd` prop: people standing, one holding an umbrella up),
   Falqués lamps on Avinguda de Gaudí (a `lamp` style), the Glory hoarding.
6. **Inside**: the plan above in `src/environments.ts` with its own scenery module (columns,
   umbrellas, glass walls, light pools, canopy), the Nativity door both ways, `PLACES` entry
   (`sagrada-familia-interior`, *solo depuración* until the mission opens it).
7. **Checks**: `just typecheck`, `npm test`, the tests on the new grids; a screenshot scenario
   `scripts/screenshots/sagrada.json` (arrival at the metro, the pond view, the Passion square,
   the overview with the spires, inside near the door, under the crossing, at the altar);
   `just screenshots sagrada --gpu`, looked at and iterated.
8. **Report**: the section `31-sagrada.html` with before/after and the screenshots.

## Approximate and open

- Not walked in person: the reference is OSM plus 2026 Commons photos; the ground-floor shops come
  from OSM and may lag.
- Heights of the flats are a style default (seven storeys) until checked block by block.
- The church footprint includes the cloister and the porches as one outline; the landmark draws
  its own massing inside it.
- The inside is simplified: five aisles and the column grid are kept, the vaults are suggested by
  the umbrellas, the gallery levels, the choir lofts and the ambulatory chapels are left out.
- Which mission uses these places, and whether the Passion door ever opens, is for the story.
