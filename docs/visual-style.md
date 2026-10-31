# Visual style guide

What every place in the game should look like, and why: the visual language all places share,
the identity card that makes each one unmistakable, the palace's zones, and the checklist a new
place follows. The *how* lives elsewhere: the post pass, grading, particles and light in
[graphics.md](graphics.md), the real-place pipeline and materials in
[environment-styling.md](environment-styling.md), the city in [barcelona.md](barcelona.md), the
palace's plan in [bubbaloo-palace.md](bubbaloo-palace.md), the tone in `docs/story-outline.md`.

The aim, in Aitor's words: **an equilibrium between something very realistic and something nice
to see and functional**. In practice, a tilt-shift photograph of the real place in which only the
play space is simplified.

Status (2026-10-30): the cards for **existing** places describe what is built, with colours
measured on screenshots. The cards for **new** places are **proposals**: whoever builds a place
refines its card in `docs/places/<zone>.md`, says why it changed, and updates its row in the
matrix (§ 2).

## 1. The visual language

### Realistic, nice to see, functional

| Layer | Realistic | Nice to see | Functional |
| --- | --- | --- | --- |
| Layout | Real footprints, streets and proportions (OpenStreetMap, references) | Cropped to a diorama: one street, one square, one hall | Open ground reads as walkable; borders are real things (a river, a fence, a kerb, a wall) |
| Shape | Real storeys, roof kinds, cornices; signature details modelled | Boxes and painted bays, no clutter under ~25 cm | Silhouettes read from above; nothing between Gerard and the camera stays opaque |
| Surface | Real materials from photos at real scale | A little below the photo's saturation; clean, delit | Ground calm and mid-light, so people and props stand out on it |
| Light | One sun, real shadows, contact shadows, the sky in glossy things | A colour grade per place for mood | Gerard is always the clearest thing near the middle of the screen |

### The diorama camera

| Fact | What it means for a place |
| --- | --- |
| High orthographic camera from the south-east of the grid; R pulls back to the overview | Walls facing grid south and east are the ones seen: turn the zone so its signature facade faces the camera (`rotation_deg`). Roofs and ground fill most of the screen, so they get the texture budget. |
| The street camera shows 40–75 px a metre | Details under ~10 cm vanish. Text meant to be read needs letters of ~0.5 m (ground labels, big shop letters); smaller text is texture. A 1024 px texture over 2–4 m is plenty. |
| Tilt-shift: the sharp band follows Gerard, the top and bottom of the screen blur | Put a place's detail where people walk, not at the screen's edges. Tall roofs near the camera go soft: give them shape, not fine texture. |
| Contact shadows (SSAO) | Props sit on the ground, never float; creases are what make the miniature. |
| The diorama is cut at the zone's edge | The edge is part of the look (hills, the sea, a clean slab): make it on purpose. |
| One sun for every place (`sun.setEulerAngles(48, -35, 0)` in `src/scenery.ts`) | A place changes the sun's colour and strength, never its direction, so shadows read the same everywhere. |

### Real materials on a miniature

Real surfaces on a small world read like a tilt-shift photograph of the real city. The shared
library is `public/textures/<id>/` (albedo, normal, `texture.json`: `asfalt`, `carreu`, `estuc`,
`formigo`, `gespa`, `granit`, `grava`, `mamposteria`, `mao`, `panot-flor`, `panot-gris`, `rajola`,
`saulo`, `sorra`, `terra`, `teula`): reuse it first, and add only the place's signature material.

| Rule | Detail |
| --- | --- |
| Sources | CC0 (ambientCG, Poly Haven); Wikimedia Commons under CC0, CC BY or CC BY-SA, with author, licence and file URL in each texture's own `public/textures/<id>/texture.json` (written by `tools/textures.py`; there is no shared credits file); our own procedural painting; generated images only for fantasy surfaces no photo can give (the palace), recorded as such. Raw downloads stay in `output/` (git-ignored). |
| Never shipped | Google Maps, Street View, satellite, Google Images, photorealistic 3D tiles, images of unknown licence. Look at them, never copy them. No brand logos as images: write the name in a plain typeface. |
| Format | webp, at most 1024 px (2048 only for one signature facade per place), each under ~400 KB. |
| Real scale | A panot tile is 20 cm, a Catalan brick 29 × 5 cm on its face, a storey about 3 m, a roof tile row about 20 cm. A wrong scale is what makes a miniature look fake. |
| Delit | No baked sun or shadow in an albedo: flatten the photo, crop out people, cars and signs. The game lights it. |
| Gloss | Stone, render, brick, asphalt and earth are matte. Gloss only for glass, water, metal, car paint, polished floors and her gum (`shine(material, kind)`). |
| Repetition | No visible tiling in the overview: two or three variants or a large soft tint, and facades from the bay atlas (`FACADE_ATLAS`) so a street varies. |

### Grading and light

Each place has its own look in `LOOKS` (`src/grading.ts`): it adds mood and never repaints, and
`just screenshots grading` checks it. Its card names the look, its temperature and the hour it is
drawn for.

| Rule | Detail |
| --- | --- |
| One look per place | A new place adds its entry; reusing another place's look makes them twins. |
| Gentle | Temperature within ±.12, saturation .9–1.05; `tests/grading.test.mjs` keeps black, white and grey honest. |
| Neighbours alternate | Places next to each other (§ 2) lean opposite ways (warm and cool) when they can. |
| Sky | `day` outside, `indoor` in flats and shops, `night` for the patio, `palace` in hers. A new sky kind only where the light is truly different (the Sagrada Família's nave). |
| Hour | Places are drawn for one light (the street's afternoon, the flat's morning). The story's hours only add her evening pink, so a place's own light should hold from 08:00 to 22:00. |
| Bloom means something | Only what is brighter than white blooms (`bloom.threshold` 1.15): a lamp, her, fear and possession, an ánima, and at most one signature glow per place (the Sagrada's glass, the Magic Fountain). Never as decoration. |

### Saturation and reserved colours

1. **Gerard first.** Nothing near the middle of the screen is more saturated or more contrasted
   than him (in her palace, where pink is everywhere, he stands out by value and light instead).
   No ground or wall where he walks in his own colours (mustard and navy, Noísta's crimson and
   charcoal, his ánima's colour).
2. **One saturated accent per place**, its signature, plus small ones (signs, flowers). The rest
   stays muted, at or a little below the photo.
3. **Some colours carry meaning** and belong to it everywhere:

| Colour | Means | Where it may appear |
| --- | --- | --- |
| Bubble-gum pink to magenta, saturated (hue ~320–345°: `#ff6fae`, `#d94a8c`, `#ff3d8b`) | La Reina Bubbaloo | Her palace, her gum and bubbles, her minions, her tint (`bubbaloo`), the bubble that opens a mission's dungeon. A real pink thing elsewhere (a sign, a flower) is muted or shifted to red or violet. |
| Violet (`#c9a2ff`, violet-black) | People she holds (violet eyes) and fear (Uri's tower) | Possessed eyes; fear dungeons |
| Dark pink eyes | Animals she holds | Their eyes only |
| Crimson `#e2483d` | Noísta | Its interface and Gerard's look |
| Amber glass | The lights of the people helped | The jar at home |
| Ánima colours (`CLASSES`, `ANIMAS`) | An ánima | Trails, auras, interface |
| TMB and Rodalies line colours (L1 red, L3 green, L4 yellow, L5 blue, R4 ochre) | Transport | Station totems, signs and the network map |

### Silhouettes that read from above

- **One landmark per place**, readable in the overview (R) at thumbnail size, and no two places
  with the same kind of landmark (a belfry, twin campaniles, spires and a spiral tower are four
  different kinds).
- **Roofs carry identity from above**: hipped clay roofs in Cardedeu, flat Barcelona terraces with
  water tanks, aerials and washing, the Eixample's chamfered corners round the Sagrada Família.
- **Values**: ground mid-light (L* about 55–85), walls a step lighter or darker, people the
  strongest contrast; dark places (fear, her palace) light a pool round him instead. Test: in a
  greyscale screenshot, Gerard is found within a second.
- **Nothing hides Gerard**: geo buildings open their see-through hole, trees turn see-through,
  interiors fold their walls, particles never sit on him.

### Text in the world

| Where | Language of the world's text | Examples |
| --- | --- | --- |
| Barcelona, Sant Quirze, Cardedeu | Catalan for street plates, transport, schools and public signs; shops as they really are | *Carrer de Sants*, *Platja de la Barceloneta*, *Institut Escola Rec Comtal*, *Sortida* |
| Alegia | Basque, with Spanish where the real place has it | *San Juan kalea*, *Udaletxea* |
| Her palace | The school's own signs in Catalan, under her gum | *Secretaria*, *Gimnàs*, *Pati* |
| Interface, dialogue, Gerard's lines | Spanish | — |

- Street names go on the ground as labels (`labels`), like *PASSATGE MARESME*.
- World text is texture, never guidance: no sign, poster or graffiti points to a person, an
  objective or the next step. Clues are ordinary bits of the world (`docs/chapter-2.md` § Hidden
  clues).
- Real names in a plain typeface (no logos); invented names (El Nucli, board-game titles) where
  the place is invented.

### Weather and particles

| What | Rule |
| --- | --- |
| Air (`AIR` in `src/effects.ts`) | Every card names its air. Motes indoors and pollen outside are the defaults; a place's own air (fireflies, her gloom, sand, spray) is one of its identity cues. At most ~450 particles outside. |
| Weather | Only where there is a sky (never in plan interiors or the palace); the story chooses it. Barcelona defaults to clear; Alegia is where rain belongs; snow is an event, never a default. |
| Wind | The scene's `wind` sets the mood: still in the flat, a sea breeze on the beach, gusts on the bunkers' hill. |
| Fights | Leave 2000 of the pool's 6000 particles for fights. |

### "Cartoon only as a wink"

Decided 2026-10-29 (`docs/story-outline.md` § Tone): not a children's game; a wink here and there
is fine, the cartoon look is never the general dynamic.

| Do | Don't |
| --- | --- |
| Real proportions, materials and light everywhere, her palace included: her gum is heavy, glossy, translucent; it sags and drips like the real thing | Outlines, cel shading, rubbery architecture, bouncy props |
| At most one wink per place, small and found rather than shown: a nod to Bernat's notebook, a gum stuck under a bench | Faces on objects, googly eyes, joke or food monsters, candy-land rainbows |
| Her intrusion in an ordinary place looks wrong, not cute: a skin of gum that breathes, a bubble that warps the street seen through it | Her pink spread over a whole real place, except as her tint |
| People keep the game's block figures: that is the game's style, not a joke | Kiddy signage or comic lettering in the world (Bernat's felt-tip drawing is a child's on purpose) |

### Performance budget

Reference: the Meridiana avenue, the heaviest place, draws about 1000 calls following Gerard
(before the depth prepass) in about 6 ms of render CPU on an M1 Pro (`docs/graphics.md` §
Performance). A new place stays at or under it.

| Item | Budget |
| --- | --- |
| Draw calls | ≤ ~1000 following Gerard before the prepass; everything still goes into `Estático: <id>` |
| Materials | One per surface kind, shared; facades from an atlas |
| Textures | The shared library first; ≤ ~12 new ones per place (one 2048 at most), webp under ~400 KB each |
| Lights | A handful of point lights per room, no shadows on them; the sun is the only shadow caster |
| Particles | Air ≤ ~450 outside; 2000 kept for fights |
| Measure | `?stats` in the browser, `just screenshots gpu-perf --gpu --perf` |

### Never

- A HUD hint, waypoint, objective marker, glowing outline, "!" over a person, or world text that
  tells the player where to go (`AGENTS.md`).
- Hiding Gerard: opaque things between him and the camera, a ground in his colours, particles on him.
- Shipping Google imagery or anything without a clear licence; logos as images.
- Her pink outside her influence, violet outside possession and fear, bloom as decoration.
- Baked light in textures; a different sun direction per place.

## 2. The distinctiveness system

### The identity card

Every place has one. Copy it into `docs/places/<zone>.md` and fill every field.

| Field | What it says |
| --- | --- |
| Dominant hue | The colour that covers most of the screen at the follow camera (name and hex) |
| Secondary hues | Two or three that go with it (hex) |
| Signature material | The surface that says "this place" (a library id or a new texture) |
| Ground | What Gerard walks on |
| Landmark | What reads in the overview, and its kind |
| Light and mood | `LOOKS` id, warm or cool, sky kind, the hour it is drawn for |
| Props kit | The furniture that repeats |
| Air | Its particles and wind |
| Sound | Its ambient cue, in words (no file yet) |
| Only here | One detail no other place has |
| Text | Language and examples |
| Wink | Optional: the one cartoon nod, if any |

```md
## Identity

Status: built | proposal | refined from docs/visual-style.md because …

| | |
| --- | --- |
| Dominant | <name> `#hex` |
| Secondary | `#hex`, `#hex` |
| Material | … |
| Ground | … |
| Landmark | … (kind: …) |
| Light | `<look>`, warm or cool, `<sky>` sky, <hour> |
| Props | … |
| Air | … |
| Sound | … |
| Only here | … |
| Text | … |
| Wink | … (optional) |
```

### Matrix

Rule: **no two places share both the dominant hue family and the signature material.** Pale warm
whites are the Mediterranean's own colour, so several places share them; those are told apart by
material, light and landmark, which the last column names.

| Place | Dominant | Family | Signature material | Landmark kind | Look | Told from its nearest look-alike by |
| --- | --- | --- | --- | --- | --- | --- |
| Passatge Maresme | `#d6cfbc` | sunlit white | white render, flat roofs (`estuc`) | row of white cubes | `maresme` warm | Sagrada inside (ΔE 8): a street of houses in the sun vs a nave in coloured light |
| Casa de Gerard | `#ecdcb8` | cream, indoor amber | plaster and pale tile (`rajola`) | the house cut open | `home-*` warm | La Barceloneta (ΔE 8): a room in amber light vs an open beach |
| El piso de la Meridiana | `#b9803f` | honey | wood parquet | the flat cut open, long balcony | `meridiana` warm | Poble Sec (ΔE 12): interior, wood |
| Avinguda Meridiana | `#9fa09a` | cool grey | grey square panot (`panot-gris`), new black asphalt (`asfalt-nou`) | a mall box under brown-banded slabs | `meridiana-calle` cool | Sagrada outside (ΔE 13): panot and blocks vs carved stone |
| Trinitat Vella · Rec Comtal | `#a8664e` | brick red-brown | exposed brick (`mao`) | the school and her palace on it | `rec-comtal` warm | Poble Sec (ΔE 11): brick blocks vs sienna render and stairs |
| Her palace, outside | `#ff6fae` | her pink | glossy gum | crown tower, spiked towers | her tone | — (hers alone) |
| Alegia | `#f1efe8` | white and dark timber | timber framing, ashlar (`carreu`) | square belfry | `alegia` cool | Sagrada inside (ΔE 5): street vs nave in coloured light |
| Cardedeu | `#b66e43` | terracotta and garden green | hipped clay roofs (`teula`), lawns (`gespa`) | a long hipped roof | `cardedeu` warm | Poble Sec (ΔE 3, the same colour): low roofs, lawns and garden trees seen from above vs render and stone stairs at evening |
| La torre de Uri | `#1f0f22` | violet-black | dark stone walls | spiral tower | `cardedeu-laberinto` cool | Throne room (ΔE 25): violet vs indigo and gold |
| El Nucli (built) | `#2f4a3a` | bottle green | board-game boxes, felt | the wall of boxes | `el-nucli` warm | Palace patio (ΔE 25): indoor felt vs painted court |
| Sants street (built) | `#cfa463` | ochre | painted roller shutters, old render scored as ashlar (`estuc`) | a lit shopfront in a row of shutters | `sants` cool | Bunkers (ΔE 5): render in shade vs concrete at sunset |
| Sagrada Família, outside | `#8a7764` | weathered sandstone | carved sandstone | spires | `sagrada-familia` warm | Avinguda Meridiana (ΔE 18): carved stone and park vs panot and blocks |
| Sagrada Família, inside | `#e9e4d8` + coloured light | pale stone in coloured light | branching stone columns, stained glass | a forest of columns | `sagrada-familia-interior` neutral, sky `nave` | Alegia (ΔE 5): its light is the colour |
| Plaça d'Espanya | `#c49884` | salmon paving, limestone and brick | monumental limestone, exposed brick | twin campaniles; a brick drum on red struts | `placa-espanya` warm | Sagrada outside (ΔE 13): flat paving, brick towers and a roundabout vs carved stone and spires |
| La Barceloneta | `#e6d0a2` | sand and sea | sand (`sorra`, `sorra-humida`), rusted iron (`acer-corten`) | four stacked rusted cubes | `barceloneta` cool | Casa de Gerard (ΔE 7): open sea vs a room |
| Poble Sec (built) | `#b08c58` | sienna-ochre and pine green | render bays with iron balconies (`poble-sec-bays`), Blai's slabs | the slope and its stairs | `poble-sec` warm | Búnkers (ΔE 7): dense streets with balconies and terraces vs an open hilltop |
| Búnkers del Carmel | `#c09a5e` | dry gold grass, war concrete, golden light | board-marked concrete (`formigo-encofrat`), rock (`roca`), dry grass (`herba-seca`) | round gun pits on a bare crest above the city | `bunkers-carmel` warm, dusk sky | Sants (ΔE 5): open hill at sunset vs a shaded street |
| Palace · entrance | `#c95a8d` | her pink | gum, wrapper paper | El Corazón Líquido | `palacio` | Palace outside (ΔE 17): the same building, inside |
| Palace · el patio | `#3f7d58` | court green | painted resin court (`pista-pintada`), its lines as kerbs | the court's raised lines | `palacio-patio` cool | El Nucli (ΔE 25): a painted court under the sky vs felt indoors |
| Palace · el gimnasio | `#2d5a9e` | mat blue | vinyl mats, pine wall bars, grey sports floor | the stacked vaulting box | `palacio-gimnasio` cold | Throne room (ΔE 23): blue under tubes vs indigo in the dark |
| Palace · la secretaría | `#d6b46a` | manila and steel | archive boxes (`cartro`) on steel cabinets, terrazzo (`terratzo`) | aisles of cabinets | `palacio-secretaria` flat green | Sants (ΔE 7): an office under her vs a street |
| Palace · el salón del trono | `#232a5c` | night indigo and gold | velvet (`vellut`), stage boards (`fusta-escenari`), her gum | the stage and her throne | `palacio-trono` night | El gimnasio (ΔE 23), La torre de Uri (ΔE 25): indigo and gold vs blue or violet |

ΔE is CIE76 between dominant colours: under ~10 reads as the same colour, 20 as clearly different.

**Today two built places look alike**: Alegia and Cardedeu both show cream walls under bright
orange hipped roofs (measured on screenshots). Their cards pull them apart: Cardedeu leads with
its roofs and gardens (low houses seen from above, warm), Alegia with white render and dark timber
under a cool, wet sky, its roofs aged darker.

### Neighbours: the contrast rule

Two places are **neighbours** when a door or a step joins them (a house and its street, a shop and
its street, inside and outside), when they are up to three stops apart on a line, when they share
a district, or when one is seen from the other. **Neighbours differ in at least two of four:**
dominant colour (ΔE ≥ 20), signature material, ground, light (warm against cool, or another sky).
A door pair always differs in light or ground, so the scene change reads at once. Neighbours never
share a landmark kind.

| Neighbours | Why | ΔE | Differ in | Verdict |
| --- | --- | --- | --- | --- |
| Casa de Gerard · Passatge Maresme | Door | 11 | material, ground, light (indoor) | ✓ |
| El piso · Avinguda Meridiana | Door | 44 | all four | ✓ |
| Rec Comtal · her palace outside | Grown out of it | 51 | all four | ✓ |
| Palace outside · entrance | Door | 17 | ground, light (palace sky) | ✓ (her own building) |
| Cardedeu · La torre de Uri | Round the corner | 66 | all four | ✓ |
| Avinguda Meridiana · Rec Comtal | L1, three stops | 37 | colour, material, light | ✓ |
| El Nucli · Sants street | Door | 57 | all four | ✓ |
| Sagrada inside · outside | Door | 32 | colour, ground, light (coloured nave) | ✓ |
| Sants · Plaça d'Espanya | L1 and L3, two stops; one district | 24 | colour, material, light (cool and warm) | ✓ |
| Plaça d'Espanya · Poble Sec | L3, one stop; one district | 22 | colour, material, ground | ✓ (both warm: Espanya golden afternoon, Poble Sec evening) |
| Sants · Poble Sec | One district | 21 | colour, material, ground, light | ✓, the closest: keep Sants cool and in shade |
| Sagrada outside · Búnkers del Carmel | Seen from the hilltop | 23 | colour, material, ground, light | ✓ |
| Palace zones, door to door | Doors | 55–92 | all four | ✓ |

## 3. Cards

### Existing places (built)

#### Passatge Maresme · Sant Quirze del Vallès (`maresme`)

| | |
| --- | --- |
| Dominant | Sunlit white render `#d6cfbc` |
| Secondary | Terracotta pavements `#c8785a`, garden green `#7da04a`, pool blue `#7cc7e0` |
| Material | Smooth white render and flat roofs on modern terraced houses |
| Ground | Beige concrete pavers on a shared street, terracotta pavements |
| Landmark | The row of white cubes; from the first fight on, her palace at the north end |
| Light | `maresme`: golden, teal shade, warm; `day` sky; afternoon |
| Props | Parked cars, lamps, plane trees in pits, cypresses, potted olives, garden walls and gates, manholes |
| Air | Pollen |
| Sound | Birds, a dog behind a gate, a moped far off, a sprinkler |
| Only here | A pool behind nearly every garden wall, seen only from above |
| Text | Catalan: *PASSATGE MARESME* and *SANT QUIRZE* painted on the paving |
| Wink | A small pink bubble rising through the dogs' manhole (chapter 1) |

#### Casa de Gerard · Passatge Maresme, 20 (`home-entrance`, `home-floor-1`, `home-floor-2`)

| | |
| --- | --- |
| Dominant | Cream plaster in afternoon amber `#ecdcb8` |
| Secondary | Honey wood `#c9a26a`, pale floor tiles `#e9e2d0`, the olive backdrop `#6f6b4a` |
| Material | White plaster, pale ceramic floor, light wood furniture |
| Ground | Pale tiles and rugs |
| Landmark | The family house cut open on its wooden base (walls fold) |
| Light | `home-*`: warm amber indoors; `indoor` sky |
| Props | Family furniture, framed prints, Jan's desk, the kitchen, the hall with the backpack |
| Air | Motes in the light |
| Sound | Toast, a radio in Catalan, Mum calling, a door |
| Only here | Jan's *POCIÓ* brewing on his desk |
| Text | Catalan at home: *Per molts anys*, *POCIÓ* |

#### El piso de la Meridiana (`meridiana`)

| | |
| --- | --- |
| Dominant | Honey parquet `#b9803f` |
| Secondary | Cream walls `#f0e2c2`, dark grey in the music corner `#4a4f57`, terracotta balcony tiles |
| Material | Warm wood floor, white kitchen units |
| Ground | Parquet; balcony tiles |
| Landmark | The open flat with its long balcony |
| Light | `meridiana`: soft peach morning, warm; `oscuro` before the lamps; `indoor` sky |
| Props | Piano, sofa, the TV with the news, bookshelves, plants, the bed, the cats |
| Air | Motes |
| Sound | The Meridiana's traffic muffled through the balcony, the fridge, the news, the cats |
| Only here | The jar of lights on the TV unit |
| Text | The TV's *ÚLTIMA HORA* and ticker |

#### Avinguda Meridiana (`meridiana-calle`)

Built 2026-10-31; how and from what in [places/meridiana.md](places/meridiana.md).

| | |
| --- | --- |
| Dominant | Cool panot grey `#9fa09a`, new black asphalt `#34363a` |
| Secondary | Cream render `#ddd3bd`, tan facing brick `#c9a47a` (`mao-groc`), awning teal `#3f8f84` |
| Material | Grey four-pastille panot (`panot-gris`) beside new black asphalt (`asfalt-nou`), both dark and glossy after rain; granite kerbs |
| Ground | A 10 m panot sidewalk with the old plane trees in pits and a kerb bed; six lanes (two and a bus lane each way); the planted median with its two-way bike lane |
| Landmark | Hipercor's white vaulted canopy and blue letters under a brown-banded residential slab (kind: a mall box under slabs) |
| Light | `meridiana-calle`: cool and a little hard; `day` sky, a late-October afternoon |
| Props | Plane trees in pits, staked young trees, LED lamps, curved poles with yellow lights, benches and single chairs facing the shops, the bus shelter and coach, five-colour recycling containers, a Bicing dock, parked scooters, café tables, red and white barriers and sacks, the L1 totem and stair, traffic and cyclists |
| Air | Pollen and dry plane leaves on a light wind along the avenue |
| Sound | Heavy traffic, a bus kneeling at the stop, crossing beeps, the works, a train under the median (not in the game yet) |
| Only here | The planted median over the trains: a bike lane between beds of staked young trees, its vent grates breathing when a train passes underneath |
| Text | Catalan street signs; the real shop names in type (Granier, 365, Vision-Prix…) over glass shop fronts |

#### Trinitat Vella · Escola Rec Comtal (`rec-comtal`)

| | |
| --- | --- |
| Dominant | Brick red-brown `#a8664e` (1950s–60s blocks) |
| Secondary | School cream `#ece6da` with orange frames `#e8742c`; mauve wherever her tone reaches |
| Material | Exposed brick (`mao`) and cream render on four- and five-storey blocks |
| Ground | Asphalt, plain sidewalks, the school's playground |
| Landmark | The school, and the palace grown out of it |
| Light | `rec-comtal`: a warm morning, half her tone round the castle; `day` sky |
| Props | Street trees, lamps, the L1 entrance; on the news, the cordon, patrol cars, the TV van |
| Air | Her pink gloom near the castle |
| Sound | No school noise (the pupils are inside), a police radio, the news helicopter |
| Only here | The pupils' backpacks lined along the gate |
| Text | Catalan: *Institut Escola Rec Comtal* over the door |

#### Her palace, outside (on the school; in chapter 1 at the end of Passatge Maresme)

| | |
| --- | --- |
| Dominant | Gum pink `#ff6fae`, deep gum `#d94a8c` |
| Secondary | Plum `#6e2453`, wrapper white `#fbeef3`, liquid core `#ff3d8b` (glow); thorns `#4a1033` and slits `#ff2f7a` while the threat is high |
| Material | Glossy, translucent gum (the sky gives it its pale rim) |
| Ground | The pink runner to La Pompa |
| Landmark | The crown tower, wrapper towers and bubble domes; on the school the ring of spiked towers and the storm, falling with the threat |
| Light | Her tone (`bubbaloo`) round it |
| Props | Liquid-centre lanterns, drips |
| Air | Her gloom and bubbles |
| Sound | Gum creaking as it grows, a bubble's wobble, the storm |
| Only here | La Pompa: a gate sealed by a wobbling bubble |
| Note | Under the case-by-case tone review (`docs/story-outline.md`): keep the gum physical and heavy |

#### Alegia · San Juan kalea (`alegia`)

Built to this card on 2026-10-31; the brief, sources and credits are in [places/alegia.md](places/alegia.md).

| | |
| --- | --- |
| Dominant | Whitewash `#ece7dc` with dark timber `#5a3b2c`, closed in by wet valley green `#3e5a36` |
| Secondary | Grey rubble and ashlar `#8a8781`, wet asphalt `#535658`, old canal tiles aged darker (`teila-zaharra`, `#8c5443`), the Oria's turbid olive `#5f633e`, geranium red |
| Material | Timber framing over whitewash, grey rubble (`harri-hezea`) and ashlar, the town hall's real front, iron and wooden balconies |
| Ground | A narrow street with no pavements; grey setts (`galtzada`) on the squares; the Oria sunk between rubble banks behind green railings |
| Landmark | The town hall's clock turret and San Juan's square belfry; Zubi Zaharra's hump; wooded hills, meadows and Txindoki all round |
| Light | `alegia`: soft and cool under a thin overcast (a whiter, softer sun; the `overcast` sky, whose horizon is the wooded hills); the place for rain |
| Props | Geraniums on iron balconies, pollarded plane trees, blue wall lamps, house-name tiles, the toka, the pergola, July bunting, parked cars |
| Air | Txirimiri (`drizzle`) that rings the puddles and the river; low mist |
| Sound | The weir, church bells, rain on the arcade, a train on the line, cowbells up the hill (not built: places have no ambiences yet) |
| Only here | The giant stone cowbell of Txintxarri plaza, and every old house wearing its name on a tile |
| Text | Basque: *San Juan kalea*, *Udaletxea*, *Eliza*, house names, *Bazkideak bakarrik* |

#### Cardedeu · Carrer de Jacint Verdaguer (`cardedeu`)

| | |
| --- | --- |
| Dominant | Terracotta hipped roofs `#b66e43` seen from above (browner in the old centre), garden green `#8a9a57` (measured on the built overview) |
| Secondary | Butter and ochre render (`#ecd69c` station, `#e7c36d` Fleca Vella), warm lime white on Nuria's block `#f3e9d8`, olive or brown louvred shutters, granite plinths |
| Material | Clay-tile roofs (`teula`) with a white rim under the eaves, render over granite (`estuc`, `granit`), lawns and big garden trees behind every row (`gespa`) |
| Ground | Asphalt streets with pale pavements, *sauló* in Plaça de Sant Joan, grey stone slabs over the old centre's streets (`lloses`), the platform's slabs and yellow line |
| Landmark | Nuria's long two-storey block under two hipped roofs; the station's porch of round arches; Santa Maria's square tower at the back and the Montseny's blue ridge beyond |
| Light | `cardedeu`: a warm afternoon; `day` sky |
| Props | Garden walls with railings and gates, front patios with pots, cedars and stone pines, cars on one kerb, zebras, cone lamps and catenary gantries on the platform |
| Air | Pollen, a few leaves |
| Sound | The R4 pulling in, birds, a lawnmower, the cats |
| Only here | The white-roofed corner house in its garden; borregos in the Fleca Vella's window |
| Text | Catalan: *Carrer de Jacint Verdaguer*, Rodalies signs |

#### La torre de Uri (`cardedeu-laberinto`)

| | |
| --- | --- |
| Dominant | Violet-black `#1f0f22` |
| Secondary | Mauve ramp `#883b65` (her doing, so near her pink), lilac stone `#9a8fb0`, violet lanterns `#c9a2ff` |
| Material | Dark stone walls, always higher than you |
| Ground | The ramp spiralling up, ring inside ring |
| Landmark | The tower, El Vértigo on top (kind: a spiral tower) |
| Light | `cardedeu-laberinto`: cold and deep |
| Props | Violet lanterns, the fears |
| Air | Haze |
| Sound | A heartbeat when a fear gives chase, wind growing with the height, Uri's voice ahead |
| Only here | The screen's edges beating like a heart |
| Text | None: it is fear, not a street |

### New places (proposals)

#### El Nucli · the game store (Plaça de Sants, L1 and L5)

Where Gerard meets Bernat, on the quiet (`docs/quests/bernat.md`: a spy feel). Built as `el-nucli`;
the card refined from the real shop is in `docs/places/nucli.md`.

| | |
| --- | --- |
| Dominant | Bottle green `#2f4a3a` (painted walls, felt on the tables) |
| Secondary | Walnut shelves `#7a4e2d`, lamp light `#f2c27a`; the box spines are the colour (many, muted) |
| Material | Board-game boxes, printed cardboard, floor to ceiling; green felt |
| Ground | An old shop's hydraulic tile floor (`rajola`), worn at the door |
| Landmark | The wall of boxes; a back room behind a curtain |
| Light | New look, warm tungsten with deep shade; `indoor` sky |
| Props | Shelves, demo tables and chairs, the counter and till, dice, card sleeves, a noticeboard of game nights, a bell over the door |
| Air | Motes in the lamp light |
| Sound | Dice on wood, boxes sliding, the door's bell, low talk |
| Only here | The back-room table where Bernat waits, a game half set up |
| Text | Catalan sign *El Nucli · Jocs de taula*; invented box titles, no real logos |
| Wink | A box on the shelf with Bernat's name as designer |

#### Sants · El Nucli's street

Built as `sants` (Carrer de Valladolid, from OpenStreetMap); the refined card is in
`docs/places/nucli.md`.

| | |
| --- | --- |
| Dominant | Ochre render `#cfa463` of old Sants (two- to four-storey houses) |
| Secondary | Bottle-green wooden shutters `#3e6a4a`, graffiti on roller shutters (many colours, muted), grey panot `#a3a29b` |
| Material | Painted roller shutters and old render (`estuc`) with stone door frames |
| Ground | Narrow asphalt, grey panot (`panot-gris`) |
| Landmark | El Nucli's lit shopfront in a row of shutters; if the zone reaches Sants Estació, the steel canopy over the Plaça dels Països Catalans |
| Light | New look, cool shade (the narrow street) with warm shop windows |
| Props | Shutters half down, scooters, the row of recycling bins (grey, yellow, blue, green, brown), shop signs, balconies with plants |
| Air | Pollen, a few leaves |
| Sound | Carrer de Sants' traffic, shutters rattling up and down, a motorbike, a shop radio |
| Only here | Roller shutters painted with murals, each one different |
| Text | Catalan: *Carrer de Sants*, shop signs |

#### Sagrada Família · outside (L5)

| | |
| --- | --- |
| Dominant | Weathered sandstone `#9f8f78`; the newer towers paler `#d9d2c3` |
| Secondary | Plaça de Gaudí's trees `#5d7a4f` and pond `#4b6f6d`; the pinnacles' coloured glass fruit as accents |
| Material | Carved sandstone, organic and porous |
| Ground | Eixample panot with the flower (`panot-flor`), sauló paths in the park (`saulo`) |
| Landmark | The towers: the tallest silhouette in the game, also seen from the bunkers (kind: spires) |
| Light | New look, neutral to warm morning with a touch of haze for the scale; turn the zone so the Nativity façade and the pond face the camera |
| Props | Tour groups, tour buses, souvenir stalls, construction fences and cranes, benches, the pond |
| Air | Dust from the works, pollen |
| Sound | Crowds in many languages, a guide's voice, the works (a crane's warning, a grinder) |
| Only here | The pinnacles' fruit in glass mosaic: the only glitter on stone in the game; the Passion façade's magic square (every line adds up to 33) as a place to look at |
| Text | Catalan and many languages on the queues and tickets |

#### Sagrada Família · inside (a later mission)

The one place whose identity is light, not material: build the light first.

| | |
| --- | --- |
| Dominant | Pale stone `#e9e4d8` washed in coloured light: blue-green `#3f8fa0` on the Nativity side, red-orange `#d9703c` on the Passion side |
| Secondary | Red porphyry columns at the crossing `#8a3b34`, dark basalt `#3c3d40`, white vaults `#f4f1ea` |
| Material | Branching stone columns (a forest), stained glass |
| Ground | Polished pale stone `#d9d3c6` that takes the coloured light |
| Landmark | The columns branching into the vault (kind: a forest of columns) |
| Light | New look, neutral (the glass brings the colour); a new sky kind for the nave, white above and coloured at the horizon; the glass is the place's one bloom |
| Props | Pews, the canopy hanging over the altar, visitors, rope barriers |
| Air | Motes in the light shafts, taking each shaft's colour |
| Sound | A hushed hall: long reverb, footsteps, whispers in many languages, now and then an organ note |
| Only here | Pools of coloured light on the floor, blue-green turning red-orange as you cross the nave |
| Text | Few quiet signs, in Catalan first |

#### Plaça d'Espanya (L1 and L3)

Built (`docs/places/espanya.md` has the reasons and the measured colours).

| | |
| --- | --- |
| Dominant | The Fira's salmon forecourt slabs `#c49884` (`lloses-fira`), hue 19°: orange-red, never her pink |
| Secondary | Warm limestone `#cdb9a0` (the colonnades, the fountain, the tower bases), tower brick `#b45e40`, Las Arenas' orange brick, the roundabout's asphalt `#46474a`, the dug island `#6e5840` |
| Accent | Las Arenas' red steel `#b3261e`: its V struts, the rim's edge, the lift's mast |
| Material | Monumental limestone and exposed brick (`carreu`, `mao`, Las Arenas' photographed bays) |
| Ground | Salmon slabs and granite steps under the colonnades, panot sidewalks, a wide roundabout with arrows and BUS lanes, the island dug for the L8 behind yellow barriers |
| Landmark | The two Venetian towers framing the avenue up to the Palau Nacional (kind: twin campaniles); Las Arenas' drum in the foreground |
| Light | `placa-espanya`: golden late afternoon, the towers' long shadows across the forecourt |
| Props | Lamp masts crowned with four heads, traffic lights, the works' yellow jersey barriers, a Bicing dock, the red and white tourist kiosk, cypresses, taxis and TMB buses in the traffic |
| Air | Pollen |
| Sound | The roundabout's roar, buses, water up the avenue (not built yet) |
| Only here | Las Arenas' brick bullring floating on red steel V struts |
| Text | Catalan: *PLAÇA D'ESPANYA* on the ring, *Espanya* on the metro, *TURISME*, *ARENAS DE BARCELONA* |

#### La Barceloneta · the beach (L4)

Built as `barceloneta`; its refined card is in `docs/places/barceloneta.md`.

| | |
| --- | --- |
| Dominant | Sand `#e3cd9f` |
| Secondary | Sea `#2f7f96`, wet sand `#b9a47c`, weathered steel `#8a4a2b`, the W hotel's glass `#7f9aa6` |
| Material | Sand (`sorra`): trampled by the promenade, smooth and darker by the water |
| Ground | Sand, the promenade's paving, the wet line |
| Landmark | L'Estel Ferit (Rebecca Horn, 1992), four rusted cubes stacked off-true on the sand; the W hotel's sail on the horizon (kind: a stacked sculpture) |
| Light | New look, bright and cool midday, open shadows, a high sky |
| Props | Beach bars, lifeguard towers, showers, volleyball nets, towels and umbrellas, bikes on the promenade, gulls |
| Air | Sand blowing low, spray at the water's edge, a sea breeze |
| Sound | Waves, gulls, vendors calling out drinks, a volleyball |
| Only here | Waves washing up and pulling back, leaving a line of foam |
| Text | Catalan: *Platja de la Barceloneta*, the flag board |

#### Poble Sec · Carrer de Blai and the Montjuïc slope (L3, Emilie)

Built (2026-10-31): the card as built, measured on screenshots, is in `docs/places/poble-sec.md`;
this proposal is kept for the record.

| | |
| --- | --- |
| Dominant | Sienna render `#b8744a` of narrow 19th-century blocks |
| Secondary | Balcony plants and Montjuïc's pines `#4e6b3c`, terrace umbrellas, warm windows `#f2c27a` |
| Material | Stepped streets: stone steps with iron handrails up the slope |
| Ground | Blai's pedestrian paving, then steps and ramps |
| Landmark | The slope rising behind the streets, pines and the castle on top; if the zone reaches the Paral·lel, the three chimneys (kind: a slope and its stairs) |
| Light | New look, warm evening, deeper contrast, terraces lit |
| Props | Bar terraces, pintxo counters, plant pots, washing, scooters, handrails |
| Air | Warm motes under the terrace lights |
| Sound | Chatter and cutlery on the terraces, a guitar, a TV through an open window, steps |
| Only here | Streets that end in stairs climbing Montjuïc |
| Text | Catalan: *Carrer de Blai*, bar boards (*Pintxos*) |
| Note | Emilie's own place is invented: its builder adds it to this card |

#### Búnkers del Carmel · Turó de la Rovira (L5, El Carmel): the surprise (built)

Built as `bunkers-carmel`; the full card, sources and what is approximate are in
`docs/places/bunkers.md`.

| | |
| --- | --- |
| Dominant | Dry gold grass and bare earth in low sun `#c09a5e`; war concrete `#a29f96` |
| Secondary | Scrub and pines `#4f5a2e`; the dusk sky over the sea (pale blue `#b9cddd`, the pink band `#eac6b0`, the earth's shadow `#91959d`); the shacks' whitewash `#ece6da` and brick `#a4533a` |
| Material | Board-marked Civil War concrete with pebbly aggregate (`formigo-encofrat`), over bare rock (`roca`) |
| Ground | Grey gravel on the top (`grava`), concrete paths (`formigo`), dry grass and scrub (`herba-seca`), patches of the shacks' red and grey tiled floors |
| Landmark | The round gun pits strung along a bare crest, the grey water tank at its end: a dry island above the city (kind: round platforms on a hilltop) |
| Light | `bunkers-carmel`: golden hour, lilac shade, a `dusk` sky; the sun keeps the game's one direction, so colour and sky carry the hour |
| Props | Gun mounts and niches with rusty red doors, black iron railings, MUHBA lecterns, the 2 m bar fence and its gate, prickly pears, agaves, Aleppo pines and olives, people sitting on the parapets facing the city, a civic agent |
| Air | Gusts with dust motes glinting in the low sun |
| Sound | Wind, the city's far hum, a guitar, many languages, parakeets (not built: no place has its own ambience yet) |
| Only here | The whole real city at Gerard's feet, from the network map's model, down to the sea: the Sagrada Família, Torre Glòries, the Port Olímpic towers, and far off her castle |
| Text | Catalan lecterns: *Bateria antiaèria*, *Barraques dels Canons*, *Turó de la Rovira*, *Pavelló d'oficials* |

## 4. The palace inside, by zones

The palace is a regular dungeon of zones, each with its puzzles and a boss, the bosses being
Gerard's colleagues at the school (`docs/story-outline.md` § The palace: zones). Its look:

- **The entrance is hers: pink.** The hall, the gallery and the wrapper room are the palace of the
  dream, the same in both chapters: gum, wrappers, liquid centres.
- **Every zone beyond it is a part of the Rec Comtal school**, Gerard's workplace (he is its
  teacher and secretary), swallowed by her. Each zone has **one main colour** so a screenshot names
  the zone, its own floor, light, air and sound, and its own look in `LOOKS` (her share, `her`,
  about .15–.3), cross-faded at the doors.
- **The deeper, the more of the real school.** The school shows through real and unglamorous:
  its furniture, its signs in Catalan, its routines. **Her pink creeps in only in details** (under
  a tenth of the screen): seams, drains, cracks, what the pupils touched, the boss's things.
- **The school's orange is the thread.** The real school's orange frames (`#e8742c`, the
  `rec-comtal` school style) stay on every door between zones: orange is the school, pink is her.
- **Violet only in the possessed pupils' eyes.**
- **Serious.** A workplace with children held inside it: empty where it should be loud, too
  orderly, too long. No candy, no jokes in the set dressing.
- **A won zone comes back** (proposal): when its boss falls, its pink dries and greys, its look
  drifts towards the real school's morning (`rec-comtal`), and the shortcut door opens.

The zones' order is open; the story outline proposes la secretaría last before the throne.

| Zone | The real school | Transformed | Main colour | Her pink creeping in | Set-piece |
| --- | --- | --- | --- | --- | --- |
| Entrance (vestíbulo, galería, sala de los envoltorios) | — (the dream's palace) | Built in chapter 1 | Pink | All of it | El Corazón Líquido |
| El patio | The playground: a painted court, hoops, the porch, plane trees, the fence, the hopscotch | Open to her sky; the court's lines have risen into kerbs, a maze of its own markings; backpacks along the fence | Court green | Gum filling the court's cracks, a pink ball, gum on the bench | **La pista** |
| El gimnasio | Sprung floor and court lines, wall bars, the vaulting box, blue mats, ropes, high windows, tubes | Too tall: ropes hang out of the dark, mats stacked into walls, a drill that never ends | Mat blue | Gum seeping between floorboards, one pink ball among the blue | **El plint** |
| La secretaría | Gerard's own office: the counter window, cabinets, binders, forms, the photocopier, the seal, the registry stamp, circulars | The office repeats: aisles of cabinets, drifts of forms, a queue at the window that never moves; his routine made a maze | Manila and steel | Her pink sticky notes on everything, her ink on the stamp pad | **La mesa de Gerard** |
| El salón del trono | The assembly hall: a low stage and curtains, rows of folding chairs, the school's banners, the upright piano of school concerts | The hall at night, chairs facing the stage, her throne under one light, the balcony open on the city | Night indigo and gold | She and her throne: the room's one saturated colour | **El escenario** |

#### Entrance · Vestíbulo de las Burbujas, Galería de los Retratos, Sala de los Envoltorios (built)

| | |
| --- | --- |
| Palette | Gum pink `#ff6fae`, rose tile `#c95a8d`, plum tile `#5a1d47`, gum wall `#b9467e`, wrapper white `#fbeef3`, liquid core `#ff3d8b`; the gallery deeper (`#4a1638` floor, frames `#f2b8d8`), the wrapper room paler (`#f0c6da`, pink and white stripes) |
| Materials | Wet-candy checkerboard floors, glossy gum walls with drips, twisted wrapper columns |
| Light | Pink liquid-centre lights over violet shade; `palace` sky; `palacio` look |
| Air | Her gloom and bubbles |
| Sound | The fountain bubbling, gum creaking |
| Set-piece | El Corazón Líquido, the fountain |

#### El patio (proposal)

| | |
| --- | --- |
| Palette | Court green `#3f7d58`, line white `#e9ece4`, asphalt `#2e3436`, school cream `#ece6da`, school orange `#e8742c`, her pink `#ff6fae` (detail) |
| Materials | Painted asphalt (`asfalt`), rubber safety floor, chain-link fence, plane-tree bark, painted steel hoops |
| Light | Open to her plum sky, low and flat like the end of the school day; one floodlight on a pole, cold white; long fence shadows |
| Air | Dry plane leaves and chalk dust skittering |
| Sound | A ball bouncing on its own, the recess bell ringing and stopping, children's voices far off |
| Props | Hoops, goals, benches, the porch, backpacks along the fence, a lost-property heap |
| Set-piece | **La pista**: the court's painted lines raised into knee-high kerbs, a maze of its own markings read from above, the hoops as gates, the lost-property heap in the centre circle |

#### El gimnasio (proposal)

| | |
| --- | --- |
| Palette | Mat blue `#2d5a9e`, varnished floor `#b8834a`, wall-bar pine `#c79a5b`, line yellow `#e5b52e`, tube white `#e6f0ff`, shade `#1c2333`, her pink `#ff6fae` (detail) |
| Materials | Varnished wood floor, vinyl mats, pine wall bars, rope, painted steel |
| Light | Rows of cold tubes, one flickering; her plum light through the high windows |
| Air | Chalk dust in the window light |
| Sound | A whistle, trainers squeaking, a ball thudding against the wall in a steady drill |
| Props | Wall bars (*espatlleres*), the vaulting box (*plint*), mats, benches, ropes, the ball cage |
| Set-piece | **El plint**: the vaulting box stacked into a stepped tower in the middle of the court, wall bars on every wall, ropes vanishing into the dark |

#### La secretaría (proposal)

| | |
| --- | --- |
| Palette | Manila `#d6b46a`, cabinet grey-green `#7f8a83`, paper white `#f2efe6`, binder navy `#2f3e5c`, tube light `#eef4e6`, desk-lamp warm `#f2c27a`, her pink `#ff6fae` (detail) |
| Materials | Steel cabinets, cardboard and paper, laminate desks, cork boards |
| Light | Greenish tubes overhead, flat and tiring; Gerard's desk lamp the only warm light |
| Air | Paper dust; now and then a sheet drifting down |
| Sound | The photocopier, a phone nobody answers, stamps thudding, a clock |
| Props | The counter window (*finestreta*), cabinets, binders, the photocopier, the noticeboard, the stamp *REGISTRE D'ENTRADA* |
| Set-piece | **La mesa de Gerard**: his own desk at the end of the archive, as he left it (his mug, the school's seal, the pile of forms), under the one warm lamp |
| Wink | The office's stamp and No-ta's stamp are cousins |

#### El salón del trono (proposal)

| | |
| --- | --- |
| Palette | Curtain indigo `#232a5c`, night `#10132b`, old gold `#c9a046`, stage boards `#5a3b2a`, spotlight `#fff4dc`, her pink `#ff6fae` and core `#ff3d8b` |
| Materials | Velvet curtains, varnished stage boards, folding steel chairs, her gum |
| Light | Dark; one warm spotlight on the throne, the city's night through the balcony, her core glowing |
| Air | Stage haze, her bubbles rising slowly |
| Sound | Almost nothing: chairs creaking, her bubble swelling and shrinking |
| Props | Rows of folding chairs, the school's banners, the upright piano (for the story to confirm) |
| Set-piece | **El escenario**: the stage with her throne, a giant gum ball, in the spotlight, the empty chairs facing it, the balcony over the street behind |
| Note | The final fight happens here (Aitor held by her, the melody): the room stays dark so she is the only colour |

The chapter 1 plan's *Cocinas del Chicle* and *Ala Líquida* are not in the zone list; if they
come back (as the school's canteen, say), each gets a card the same way.

## 5. How a new place gets its identity

1. **Read the real place**: ten minutes of photos and Street View (to look at, never to copy),
   notes in the zone's `reference` (`docs/environment-styling.md` § Reading a place).
2. **Write its card** in `docs/places/<zone>.md` from the template (§ 2), starting from this
   file's proposal if there is one, and say why anything changed.
3. **Check the matrix**: its dominant family and signature material together are not taken, nor
   its landmark kind. Update its row here.
4. **Check its neighbours** (doors, three stops on a line, the same district, in sight): two of
   four differ (colour ΔE ≥ 20, material, ground, light).
5. **Keep the reserved colours out**: no saturated pink or violet unless it is her or fear; at
   most one signature glow, and not a reserved colour.
6. **Source its materials**: the shared library first; new ones licensed, at real scale, delit,
   webp, credited.
7. **Give it its light**: an entry in `LOOKS` (`src/grading.ts`), a sky kind, its air in `AIR` if
   it is not the default.
8. **Write its world text** in the place's language, and nothing that points the way.
9. **Check readability**: Gerard found in a second in a greyscale screenshot, nothing hides him,
   the landmark reads in the overview (R).
10. **Check the budget** (§ 1): draw calls, textures, lights, particles.
11. **Take screenshots** (`just screenshots <scenario> --gpu`): the follow camera, the overview,
    and the place beside its neighbours.
12. **Make it reachable**: its entry in `PLACES` (`src/jump-menu.ts`).
