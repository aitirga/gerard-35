# The palace's zones (chapter 2)

Status: **built** (2026-10-31): the way in from her hall and all four zones, **el patio**, **el
gimnasio**, **la secretaría** and **el salón del trono**, with their doors and the gates that keep
them shut. Places only: no bosses, puzzles or story flags yet; their anchors are in place (see
[What is left](#what-is-left)). The research, the real school and the drafted plans are in
[palace.md](palace.md); the palace's story in [../bubbaloo-palace.md](../bubbaloo-palace.md) and
[../chapter-2.md](../chapter-2.md).

In chapter 2 La Reina Bubbaloo's palace has grown out of the Rec Comtal school, where Gerard
teaches and is the secretary. Her hall stays hers and pink; behind its east door the real school
shows through, one zone at a time, **each with its own main colour** so a screenshot names it at
a glance. Her pink is only a detail there (under a tenth of the screen): she is creeping in.
The tone is serious: a school at the end of the day, empty where it should be loud; the cartoon
only as a wink.

## How it is built

Zones are **hand-authored plan scenes**, like chapter 1's `palacio`, with no map data: one cell
is one metre, north is up, the camera looks from the south-east, so the **north and west walls
stand tall** and the **south and east ones are cut low** (a door or sign only reads on a north or
west wall: the camera never sees a face looking west or north).

**Themes are data, the builder is shared.**

| File | What it holds |
| --- | --- |
| [src/palace-zone-plans.ts](../../src/palace-zone-plans.ts) | Each zone's plan (glyph rows), rooms, named anchors, props, interactions and **theme** (`ZoneTheme`): palette, real materials by surface, which surface each room's floor is, wall height, its own light, how far her tone takes over (`her`) and the colour of its lamps. `ZONE_GLYPHS` names every glyph. No PlayCanvas: the tests read it. |
| [src/palace-zones.ts](../../src/palace-zones.ts) | `buildPalaceZone`: what every zone shares (floors per room, the school's walls with their plinth or painted dado, low walls and galvanised fences, doors with the school's orange frame and a Catalan sign, lamps, her gum), then the zone's own dressing (`dressPatio`, `dressGym`, `dressSecretaria`, `dressTrono`) painted from its palette. Real textures (`public/textures/<id>/`, read through their `texture.json`) load meanwhile and replace the paint. Static meshes are batched; floors and walls use boxes whose UVs count metres, so one material per surface. Also `buildSchoolDoor`, the orange frame on the hall's east door in chapter 2. |
| `src/environments.ts` | `palacio-patio`, `palacio-gimnasio`, `palacio-secretaria` and `palacio-trono` in `EnvironmentId` and `ENVIRONMENTS`. An environment is a zone when `palace.theme` is set. |
| `src/scenery.ts` | Builds a zone with `buildPalaceZone` and takes its light (`theme.light`) instead of the palace's; hands it `surface` (raised floors feet follow: the throne room's stage) and the player's position each frame (its pool of light). |
| `src/game.ts` | The tone in a zone is `theme.her`; the hall's east door shows its orange frame at 35; a story interaction with the same id as a scene's replaces it (how the east door's "Mirar" becomes "Abrir"). |
| `src/story.ts`, `src/chapter-2.ts` | The east door opens onto the patio at 35 (`redirect`); the gym, secretaría and Direcció doors say why they will not open (`gate`, lines `gymShut`, `officeShut`, `directionShut`). |
| `src/grading.ts`, `src/home-lights.ts`, `src/effects.ts`, `src/main.ts`, `src/jump-menu.ts`, `src/exploration-world-map.ts` | Each zone's look, its home bulbs, its air, its song (`bubbaloo`) and place label, its picker entry (group *Palacio de la Reina*) and its pin on the city map (the school). |
| `scripts/screenshots/palace-zones.json` | `just screenshots palace-zones --gpu`: the east door, every zone from the follow camera and from above, their set-pieces, the three gates and Direcció from the throne room. |

To add a zone: its plan, rooms, anchors, interactions and theme in `palace-zone-plans.ts`
(new glyphs in `ZONE_GLYPHS`; walkable ones in `WALKABLE`), its id in `EnvironmentId` and
`ENVIRONMENTS`, a `dress<Zone>` function in `palace-zones.ts` registered by its `zone` id, then
`LOOKS`, `PLACE_LOOKS` (home lights), `AIR`, `PLACE_SONGS`, `PLACES` and the doors that lead to it.
The tests (`tests/environments.test.mjs`) check that every walkable cell and interaction is reached
from the arrival, that every anchor is within two steps of where one can go, and that every door
leads back (the throne room's stair excepted: going up it is crossing the guards, the story's fight).

## The way in

- **Chapter 1 is untouched.** `palacio`'s plan, rooms, scenery and lines are the same; in the
  dream the east door is still a thing to look at ("Mejor no.").
- **At 35** (`story.adult`) the hall's east door (chapter 1's sealed *Ala Líquida*, cell 22,13)
  shows the **school's orange frame** under her gum (`buildSchoolDoor`, built over the hall by
  `game.ts` like the doomed flat's gum), and its interaction becomes **Abrir la puerta**, which
  leads to the patio's porch (17,2). The hall itself stays pink: it is the zones' entrance.
- From the porch, the **VESTÍBUL** door (17,0) leads back to the hall (20,13).
- Nothing new is required to reach the throne: the curtain and its guards stay as they are.

The doors between zones, as built:

```
 her hall ── east door (at 35) ──> EL PATIO, its porch the hub ── VESTÍBUL ──> back to the hall
                                     ├── GIMNÀS ──> EL GIMNASIO            gate: the mats hold it shut
                                     └── SECRETARIA ──> LA SECRETARÍA      gate: his key will not turn
                                                          └── DIRECCIÓ ──> EL SALÓN DEL TRONO
                                                                gate: locked from the other side
 her hall <── the stair behind the gum curtain ── EL SALÓN DEL TRONO ── DIRECCIÓ ──> la secretaría
```

Every way back is open: gym and secretaría to the porch, the throne room down its stair to the
hall (out through the curtain, behind the guards) and through Direcció to the secretaría (it opens
from that side). Going up the stair is crossing the guards, which stays the story's fight.

No story flags were added. The three gates are permanent until the story adds the flags that open
them (proposed in palace.md: `palacio-escuela`, `zona-patio`, `zona-gimnasio`, `zona-secretaria`);
every zone is reached meanwhile from the picker (*Palacio de la Reina*).

## The zones

### The entrance (her hall, kept)

The Vestíbulo de las Burbujas as built for chapter 1: rose and plum checkerboard, gum walls,
El Corazón Líquido. Only change at 35: the school's orange frame on the east door, lit a little
so it stays orange in her magenta light.

### El patio · `palacio-patio` (35 × 25)

The school yard at the end of the day under her plum sky. The **porch** along the north wall is
the hub: door to her hall, door to the gym (*GIMNÀS*), door to the secretaría (*SECRETARIA*).
The court's own markings have **risen into knee-high kerbs** (white-painted concrete, 0.42 m),
a maze read from above; where a line stayed down, its paint still crosses the gap.

| | |
| --- | --- |
| Dominant | Court green `#3f7d58` (the painted court) |
| Palette | Line white `#e9ece4`, worn asphalt `#5d5e5c`, porch concrete `#a9a49a`, school cream `#ece6da`, plinth `#8d8a83`, school orange `#e8742c` (doors), galvanised fence `#9aa0a0`, hoop red `#c8402e`, trough `#b9b4a8`; her pink `#ff6fae` in details |
| Materials | `pista-pintada` (court, tinted, 4.5 m tile), `asfalt` (round the court), `formigo` (porch), `estuc` (the school's facade), `mao` (the neighbours' brick party wall on the west, own colours) |
| Landmark | **La pista**: the risen lines; the lost-property heap in the centre circle |
| Light | Ambient `#6c6a7c`, a low warm-white sun `#ffe2cc` at 1.45; her tone 0.15 (0.35 in part 1: the school's cream read pink under her light; the plum stays in the shade and the sky); one cold floodlight `#dfe9ff` on a pole over the east fence |
| Look | `palacio-patio`: slightly cool, greens kept, plum in the shade; `her` 0.2 |
| Air | Chalk dust; a little of her gloom |
| Props | Square porch pillars with beams back to the school landing on a string course (the roof cut away so the camera sees under it); classroom windows with blinds half down; first-floor windows above the canopy; the *Benvinguts* mural (twelve languages, rolled over in pink but the first word); two minibasket hoops on tubular posts (rim at 2.60 m, as for primary); the push-tap trough; two plane trees in pits; benches; school bags along the east fence; the lost-property heap (jackets, a recorder, a lunchbox); dry plane leaves; the street gate to Via de Bàrcino; a ball bouncing on its own |
| Her pink | A low crust of gum along the top of the facade, mostly the darker gum, spreading a few metres each way from her hall's door (in part 1 it ran the whole facade in round blobs that read as candy); gum round that door; gum in the court's cracks and on some kerb joints; pink water in the trough; the nets stiff with gum; the street gate sealed; one pink gum ball in the lost property (the wink) |
| Anchors | `boss-patio` (17,12), `la-pista` (17,14) |
| Looks (Gerard) | the mural, the trough, the lost property, the bags, a hoop, the street gate |
| Gates | *GIMNÀS*: Gerard «Dentro suena un silbato. Luego, nada.» Aitor «La puerta no cede. Algo blando la sujeta por dentro.» (the mats are stacked against it). *SECRETARIA*: «Es mi puerta. La llave entra… y no gira.» «¿Seguro que es esa?» «La abro cada mañana.» The street gate is only looked at. |

### El gimnasio · `palacio-gimnasio` (26 × 18)

The school gym: **wall bars** along the tall walls rising past where anyone could climb into a
**dark with no ceiling**, a **blue painted dado**, high barred windows with her plum light, and
the **blue mats stacked waist-high** into the PE lesson's obstacle course, winding from the door
to **El plint**, the vaulting box grown into a stepped tower in the centre circle.

| | |
| --- | --- |
| Dominant | Mat blue `#2d5a9e` (the mats and the dado) |
| Palette | Mat side `#24497f`, floor grey `#7d8287`, upper wall cream `#e8e2d4`, plinth grey `#6f747a`, wall-bar pine `#c79a5b`, line yellow `#e5b52e` and white `#e9ece4`, tube white `#e6f0ff`, shade `#1c2333`, leather `#7a4a2c`, ball orange `#e07a2e`, window plum `#6a3f7a`, steel `#8f9699`; her pink in details |
| Materials | `estuc` (the floor: a worn grey sports floor, tinted, 3 m tile, with a sheen), `paret-pintada` (the dado in blue and the wall in cream: old peeling paint) |
| Landmark | **El plint**: six pine boxes with their handholds, stepped into a 2 m tower, leather on top |
| Light | Ambient `#7c8496`, a cold sun `#e4ecff` at 1.15; her tone 0.2; six tube fixtures on cables, three steady lamps and one that stutters |
| Look | `palacio-gimnasio`: cold, a little green in the shade, hard on the mats; `her` 0.15 |
| Air | Dust in the tube light; a trace of her gloom |
| Props | Wall bars (pine uprights every metre, rungs every 19 cm up to 2.7 m and wider above), the dark fading above 3.6 m, barred high windows, ropes hanging from the dark (they sway though nothing moves the air), hoops on the floor, the ball cage, Swedish benches, a minibasket board on the west wall, the painted court (yellow lines, white key lines, the centre circle round the plint), the *VESTIDORS* door |
| Her pink | Gum oozing from the plint's handholds, seeping between the floor's seams round it, one pink ball in the cage (the wink), one pink hoop |
| Anchors | `boss-gimnasio` (13,10), `el-plint` (13,7) |
| Looks | the wall bars, a rope, the ball cage, the plint, the changing rooms' door |
| Doors | Back to the patio (south, cut low); *VESTIDORS* on the north wall, always shut (it opens onto nothing yet) |

Changes from the drafted plan in palace.md: the *Vestidors* door moved from the east wall to the
north wall (19,0), where the camera can see it; the plint's glyph is `p` (`P` is the patio's
street gate).

### La secretaría · `palacio-secretaria` (28 × 21)

Gerard's own office, entered for once from the **visitors' side**. A **queue that never moves**
(five adults and a child, coats on, a form in every hand, their backs to the camera) faces the
**finestreta** cut in the counter's glass screen. Behind the counter the office **repeats**: the
same desk ten times (the same monitor, mug, pile and pink note), the photocopier that has not
stopped, then **the archive**: back-to-back steel cabinets in long runs with **manila archive boxes
piled on top**, drifts of forms that overflowed the aisles. At the end of the aisles, in the far
corner, **La mesa de Gerard**, as he left it, under the room's only warm lamp. *DIRECCIÓ* opens
off the north wall beside it: the last door before her.

| | |
| --- | --- |
| Dominant | Manila `#d6b46a` (the archive boxes: what the camera sees most) with steel `#7f8a83` (the cabinets) |
| Palette | Terrazzo `#9ea3a3`, paper `#f2efe6`, binder navy `#2f3e5c`, counter laminate `#cbbfa6`, wall `#e3e0d4` over a grey-green dado `#8d968c`, tube light `#eef4e6`, desk lamp `#f2c27a`, school orange on the doors; her pink in details |
| Materials | `terratzo` (the floor, tinted, 40 cm tiles), `cartro` (the archive boxes, tinted manila), `paret-pintada` (wall and dado); the cabinets' drawer fronts, the binders, the cork board and the key cabinet painted in code |
| Landmark | **The archive's aisles** ending at **La mesa de Gerard** (anchor `la-mesa`) |
| Light | Ambient `#7d857f`, a flat greenish sun `#eef2e6` at 1.05; her tone 0.25; three tube lights and one warm desk lamp; one pair of tubes dead |
| Look | `palacio-secretaria`: flat and tiring, a little green, washed out; `her` 0.15 |
| Air | Paper dust; a trace of her gloom |
| Props | The counter (laminate on a panelled front, a glass screen on aluminium posts), the finestreta with its *SECRETARIA* sign, opening hours and the *REGISTRE D'ENTRADA* stamp, the raised flap, the queue, a row of waiting chairs on their beam with a form left on one, ten identical desks with their chairs, the photocopier (a copy slides out every two seconds, copies piled on the floor), back-to-back four-drawer cabinets, archive boxes with labels, drifts of forms and loose sheets everywhere, shelves of binders by school year along the north wall, the clock stopped at nine, the cork board (circulars, calendar, timetables), the key cabinet (every classroom's key on its hook) |
| La mesa de Gerard | His mug (white with a blue band), the school's seal, the registry stamp and its ink pad (her pink ink: the wink, No-ta's stamp's cousin), a framed photo, the day's pile, his chair pulled out, the articulated lamp |
| Her pink | Sticky notes on everything (screens, drawers, boxes, the glass, the board's papers), the ink on his stamp pad |
| Anchors | `boss-secretaria` (3, 5), `la-mesa` (2, 1) |
| Looks (Gerard) | the queue, the finestreta, the cork board, the desks, the photocopier, the keys, his desk |
| Doors | Back to the patio (south, cut low, arrival 4, 19); *DIRECCIÓ* (6, 0), shut: Gerard «Direcció. Cerrada por dentro.» Aitor «Por debajo sale luz. Como la de un escenario.» |

Changes from the drafted plan in palace.md: the cabinets' glyph is `R` (`A` is the patio's pillars),
the key cabinet and the cork board hang on the west wall (`k`, `N`: walls with something on them),
Direcció is door `2`, the queue runs down from the finestreta and turns at its tail, and a row of
waiting chairs (`h`) fills the waiting room.

### El salón del trono · `palacio-trono` (26 × 22)

The school's **sala d'actes** at night. Rows of **empty folding chairs** face the **stage**, an ochre
runner up the aisle; on the stage, between velvet backcloths and a gold-edged apron with its
footlights, **her throne under one spotlight**: a seat of chewed gum and, for a back, **the bubble
she is blowing**, swelling and shrinking, her liquid core glowing inside it. Behind it the
**balcony** opens through the north wall onto **the night city**: blocks with their windows lit, the
Meridiana's two lines of lamps running away to Torre Glòries in its colours, the Sagrada Família's
towers, Collserola's red lights (the view in the gallery's *Desde el balcón*). The stage is raised
0.8 m and walkable, up its corner steps.

| | |
| --- | --- |
| Dominant | Curtain indigo `#232a5c` (the velvet) with old gold `#c9a046` (edges, frames, railing) |
| Palette | Night `#10132b`, wall `#283063`, stage boards `#5a3b2a`, walnut floor `#3b2c26` and wainscot `#4a3426`, runner ochre `#7a5a2e`, chairs steel `#8f9699` and seats `#3d4150`, spotlight `#fff4dc`; she and her throne `#ff6fae`, core `#ff3d8b`: the only saturated colour |
| Materials | `vellut` (the backcloth, wings, window drapes, tinted indigo; the runner, tinted ochre), `fusta-escenari` (the stage, the floor and the wainscot, three tints), `paret-pintada` (the walls) |
| Landmark | **El escenario**: the stage and her throne in the spotlight (anchor `el-escenario`) |
| Light | Ambient `#353d6c`, a cold moonlit sun `#8f9fe0` at 0.7; her tone 0.2; one warm spotlight on the throne (the zones' only shadow-casting lamp), her core's pink light, the city's cold glow through the balcony, a low warm wash from the footlights, and **a pool of light that follows the party** across the dark floor |
| Look | `palacio-trono`: indigo in the shade, gold in the light, deep blacks; `her` 0.2 |
| Air | Stage haze, her bubbles rising slowly, a little gloom |
| Props | The stage with its walnut front, gold edge and footlights, the velvet backcloth in pleats, the west wing's velvet legs, the east wing as the hall's store (folded chairs stacked on their trolleys, low), the balcony with its gold doors thrown open and its railing, the school's banner *INSTITUT ESCOLA REC COMTAL*, the upright piano with an open score and its stool, ninety folding chairs, a programme left on a front seat, the ochre runner with gold edges, tall west windows hung with velvet, gold sconces, *DIRECCIÓ*'s door |
| Her pink | The throne (a mass of chewed gum, the bubble, the core, drips on the boards), her gum round the stair down to her hall and its glow |
| Anchors | `boss-reina` (13, 7) before the stage, `el-escenario` (13, 3) |
| Looks | the chairs, the piano, the throne, the balcony («Desde aquí se ve casa.») |
| Doors | Down the stair behind her curtain to the hall (south, 12–13, 21: no school frame, her gum round it; arrival 12, 19); *DIRECCIÓ* in the west wall (0, 16), the school's orange frame, back to the secretaría |

Changes from the drafted plan in palace.md: the piano's glyph is `n` (`p` is the plint), `c` is the
wings (velvet on the west; on the east the store, because anything tall there would stand between
the camera and the stage), the throne is the bubble rather than a ball (the first try, a ball with
arms and a crown of flavours, read as a cartoon face), and the visible beam of the spotlight was
dropped (a hard-edged cone in the dark).

### Five moods, one palace

| | Entrance | El patio | El gimnasio | La secretaría | El salón del trono |
| --- | --- | --- | --- | --- | --- |
| Dominant | Rose tile and gum pink | Court green | Mat blue | Manila and steel | Night indigo and gold |
| Ground | Rose and plum checkerboard | Green resin court, worn asphalt | Grey sports floor, yellow lines | Grey terrazzo | Dark walnut, ochre runner |
| Light | Her magenta, pink lamps | Low end-of-day sun, one floodlight | Cold tubes, one flickering | Flat greenish tubes, one warm lamp | Dark; one spotlight, a pool that follows |
| Height | Gum walls | Open sky over a facade | Walls into a dark with no ceiling | A low office (3.4 m) | A tall hall (6 m), the city behind |
| Her pink | Everything | Gum in cracks, the trough, the crust | Gum in the plint's handholds | Sticky notes, the ink pad | The throne, the stair |

| Check | Result |
| --- | --- |
| Neighbours | Hall → patio, patio → gym, patio → secretaría, secretaría → throne, hall → throne (the stair): colour, ground, material and light all change at every door. |
| Gerard and Aitor | Readable on every floor in every screenshot: the court, the grey sports floor, the terrazzo (Aitor's beige shirt is the closest pair, carried by his dark trousers) and, in the dark hall, inside the pool of light that follows them. Mats stop at the waist, kerbs at the knee, cabinets at 1.3 m with boxes on top (they hide the legs of whoever stands right behind them); the east wing is low. |
| Pink | Her details in the four zones; the throne is the largest, on purpose, and the only saturated thing in its room. |
| Orange | On every door between zones; nowhere else. Her stair has none: it is hers. |
| Violet | Not used. |

## Credits

| Texture | Source | Licence · author | Use |
| --- | --- | --- | --- |
| `pista-pintada` | Poly Haven [Painted Concrete](https://polyhaven.com/a/painted_concrete) | CC0 · Dario Barresi, Dimitrios Savva | The patio's court |
| `paret-pintada` | Poly Haven [Peeling Painted Wall](https://polyhaven.com/a/peeling_painted_wall) | CC0 · Dimitrios Savva | The gym's dado and wall |
| `terratzo` | Poly Haven [Terrazzo Tiles](https://polyhaven.com/a/terrazzo_tiles) | CC0 · Amal Kumar | The secretaría's floor |
| `cartro` | ambientCG [Cardboard004](https://ambientcg.com/a/Cardboard004) | CC0 · ambientCG (Lennart Demes) | The archive boxes |
| `vellut` | Poly Haven [Velour Velvet](https://polyhaven.com/a/velour_velvet) | CC0 · colormass, Rico Cilliers | The throne room's curtains and runner |
| `fusta-escenari` | Poly Haven [Old Wooden Floor 02](https://polyhaven.com/a/old_wooden_floor_02) | CC0 · Poly Haven | The stage, the hall's floor, the wainscot |
| `asfalt`, `formigo`, `estuc`, `mao` | The shared library (their `texture.json`) | CC0 | Asphalt, porch, facade and gym floor, party wall |

Everything else is painted in code: signs, the mural, the court lines, the kerbs, the gum, the
drawer fronts, the binders, the cork board, the keys, the clock, the banner and the night city.
No generated images were used. Reference photos (looked at, not shipped) are listed in palace.md.

## What is approximate

- The zones are what every Barcelona public school shares, not the Rec Comtal's real inside: no
  openly licensed photo of it exists, and Gerard must not be asked.
- The patio's court is a 25 × 15 m basketball court (real: 28 × 15); the porch has no roof, cut
  away for the camera; the school's facade is one storey and the start of the next.
- Kerbs follow cells (their collision), drawn as lines from cell to cell with diagonals, so the
  arcs are stepped.
- The gym floor is a render texture standing in for a sports floor.
- The particles that drift (dust, gloom) treat every solid cell as 3 m tall (`effects.ts`, as in
  the hall), so they skirt the low kerbs and mats.
- The secretaría is a school office made larger and repeated on purpose; its archive and its
  waiting room are what public offices in Barcelona share, not the Rec Comtal's own.
- The queue's figures are built from boxes and spheres, not the game's characters; they never move.
- The throne room's night city is a painting behind the balcony, composed to be seen from above
  through the opening (the skyline sits high because the throne hides the bottom of the view); the
  Meridiana does not run to Torre Glòries from Trinitat Vella in this straight a line.
- The pool of light that follows the party is a point light over Gerard, not over the pair.

## What is left

1. **Gates by flags** (with the story): `zona-patio` opens *GIMNÀS* (the mats slide away from the
   door), `zona-gimnasio` turns Gerard's key in *SECRETARIA*, `zona-secretaria` opens *Direcció*;
   then each flag in `STORY_ARCS` (an arc *El palacio por dentro*) and the justfile's
   `dev-chapter` list, as AGENTS.md asks.
2. **The curtain's stair up**: today beating the guards ends with «La cortina se mueve. Arriba hay
   alguien.»; the story decides when that lets the party up into the throne room (arrival 12, 19).
3. **Won zones** (proposal): when a zone's boss falls its pink dries and greys and its look drifts
   towards the school's real morning (`rec-comtal`): lower `her`, fewer gum details.
4. **Bosses and set-pieces** stand on the anchors (`boss-*`, `la-pista`, `el-plint`, `la-mesa`,
   `el-escenario`), with a `FightMoment` per boss phase in the fight tester.
5. Optional: a real sports-floor texture for the gym, rounder arcs in the patio, particles that
   know the zones' real heights, the queue's figures as the game's own characters.
