# The palace's zones (chapter 2)

Status: **part 1 of 2 built** (2026-10-31): the way in from her hall, **el patio** and **el
gimnasio**. Part 2 builds **la secretaría** and **el salón del trono** on the same system (see
[What part 2 must do](#what-part-2-must-do)). The research, the real school and the drafted
plans of all four zones are in [palace.md](palace.md); the palace's story in
[../bubbaloo-palace.md](../bubbaloo-palace.md) and [../chapter-2.md](../chapter-2.md).

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
| [src/palace-zones.ts](../../src/palace-zones.ts) | `buildPalaceZone`: what every zone shares (floors per room, the school's walls with their plinth or painted dado, low walls and galvanised fences, doors with the school's orange frame and a Catalan sign, lamps, her gum), then the zone's own dressing (`dressPatio`, `dressGym`) painted from its palette. Real textures (`public/textures/<id>/`, read through their `texture.json`) load meanwhile and replace the paint. Static meshes are batched; floors and walls use boxes whose UVs count metres, so one material per surface. Also `buildSchoolDoor`, the orange frame on the hall's east door in chapter 2. |
| `src/environments.ts` | `palacio-patio` and `palacio-gimnasio` in `EnvironmentId` and `ENVIRONMENTS`. An environment is a zone when `palace.theme` is set. |
| `src/scenery.ts` | Builds a zone with `buildPalaceZone` and takes its light (`theme.light`) instead of the palace's. |
| `src/game.ts` | The tone in a zone is `theme.her`; the hall's east door shows its orange frame at 35; a story interaction with the same id as a scene's replaces it (how the east door's "Mirar" becomes "Abrir"). |
| `src/story.ts`, `src/chapter-2.ts` | The east door opens onto the patio at 35 (`redirect`), the gym and secretaría doors say why they will not open (`gate`, lines `gymShut`, `officeShut`). |
| `src/grading.ts`, `src/home-lights.ts`, `src/effects.ts`, `src/main.ts`, `src/jump-menu.ts`, `src/exploration-world-map.ts` | Each zone's look, its home bulbs, its air, its song (`bubbaloo`) and place label, its picker entry (group *Palacio de la Reina*) and its pin on the city map (the school). |
| `scripts/screenshots/palace-zones.json` | `just screenshots palace-zones --gpu`: the east door, both zones from the follow camera and from above, the porch close up, a gate. |

To add a zone: its plan, rooms, anchors, interactions and theme in `palace-zone-plans.ts`
(new glyphs in `ZONE_GLYPHS`; walkable ones in `WALKABLE`), its id in `EnvironmentId` and
`ENVIRONMENTS`, a `dress<Zone>` function in `palace-zones.ts` registered by its `zone` id, then
`LOOKS`, `PLACE_LOOKS` (home lights), `AIR`, `PLACE_SONGS`, `PLACES` and the doors that lead to it.
The tests check that every walkable cell, door and look is reached and that every door leads back.

## The way in

- **Chapter 1 is untouched.** `palacio`'s plan, rooms, scenery and lines are the same; in the
  dream the east door is still a thing to look at ("Mejor no.").
- **At 35** (`story.adult`) the hall's east door (chapter 1's sealed *Ala Líquida*, cell 22,13)
  shows the **school's orange frame** under her gum (`buildSchoolDoor`, built over the hall by
  `game.ts` like the doomed flat's gum), and its interaction becomes **Abrir la puerta**, which
  leads to the patio's porch (17,2). The hall itself stays pink: it is the zones' entrance.
- From the porch, the **VESTÍBUL** door (17,0) leads back to the hall (20,13).
- Nothing new is required to reach the throne: the curtain and its guards stay as they are.

No story flags were added. The gates below are permanent until part 2 or the story adds the
flags that open them (proposed in palace.md: `palacio-escuela`, `zona-patio`, `zona-gimnasio`,
`zona-secretaria`).

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
| Light | Ambient `#6c6a7c`, a low warm-white sun `#ffe2cc` at 1.45; her tone 0.35; one cold floodlight `#dfe9ff` on a pole over the east fence |
| Look | `palacio-patio`: slightly cool, greens kept, plum in the shade; `her` 0.2 |
| Air | Chalk dust; a little of her gloom |
| Props | Square porch pillars with beams back to the school landing on a string course (the roof cut away so the camera sees under it); classroom windows with blinds half down; first-floor windows above the canopy; the *Benvinguts* mural (twelve languages, rolled over in pink but the first word); two minibasket hoops on tubular posts (rim at 2.60 m, as for primary); the push-tap trough; two plane trees in pits; benches; school bags along the east fence; the lost-property heap (jackets, a recorder, a lunchbox); dry plane leaves; the street gate to Via de Bàrcino; a ball bouncing on its own |
| Her pink | A crust of gum along the top of the facade, thickest over her hall's door and thinning to the corners; gum round that door; gum in the court's cracks and on some kerb joints; pink water in the trough; the nets stiff with gum; the street gate sealed; one pink gum ball in the lost property (the wink) |
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

### Against each other and the rest

| Check | Result |
| --- | --- |
| Hall → patio | Rose and plum checkerboard, gum, magenta light → green court, cream school, brick, cool end-of-day light. Every axis changes. |
| Patio → gym | Green outdoor court → blue mats, grey floor, cold tubes, a dark ceiling. |
| Gerard and Aitor | Readable on the green court and on the grey floor in every screenshot; the mats stop at waist height and the kerbs at the knee, so neither hides them; the plint (2 m) only covers a cell or two behind it. |
| Pink | Only her details in both zones (the crust on the facade is the largest, over her hall's door). |
| Orange | On every door between zones; nowhere else (the hoop posts are red, the balls a duller orange). |
| Violet | Not used. |

## Credits

| Texture | Source | Licence · author | Use |
| --- | --- | --- | --- |
| `pista-pintada` | Poly Haven [Painted Concrete](https://polyhaven.com/a/painted_concrete) | CC0 · Dario Barresi, Dimitrios Savva | The patio's court |
| `paret-pintada` | Poly Haven [Peeling Painted Wall](https://polyhaven.com/a/peeling_painted_wall) | CC0 · Dimitrios Savva | The gym's dado and wall |
| `asfalt`, `formigo`, `estuc`, `mao` | The shared library (their `texture.json`) | CC0 | Asphalt, porch, facade and gym floor, party wall |

Everything else is painted in code: signs, the mural, the court lines, the kerbs, the gum.
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

## What part 2 must do

1. **La secretaría** (`palacio-secretaria`, 28 × 21) and **el salón del trono** (`palacio-trono`,
   26 × 22) from the drafted plans and identity cards in palace.md: their themes (manila and steel
   with a cool terrazzo floor and greenish tubes, Gerard's desk lamp the only warm light; curtain
   indigo, old gold, stage boards, one spotlight, the balcony on the night city), their glyphs in
   `ZONE_GLYPHS`, `dressSecretaria` and `dressTrono`, and their registrations as listed above.
   Texture candidates (terrazzo, steel cabinets, cardboard, paper, cork, velvet, stage boards) are
   in palace.md.
2. **Doors**: give `patio-secretaria` its `to` (the secretaría's entrance at 4,19), add the
   *Direcció* door from the secretaría to the throne room's west door (0,16) and the stair from
   the curtain (12–13,21); keep the gates until the story's flags exist.
3. **Gates by flags** (with the story): `zona-patio` opens *GIMNÀS* (the mats slide away from the
   door), `zona-gimnasio` turns Gerard's key in *SECRETARIA*, `zona-secretaria` opens *Direcció*;
   then each flag in `STORY_ARCS` (an arc *El palacio por dentro*) and the justfile's
   `dev-chapter` list, as AGENTS.md asks.
4. **Won zones** (proposal): when a zone's boss falls its pink dries and greys and its look drifts
   towards the school's real morning (`rec-comtal`): lower `her`, fewer gum details.
5. **Bosses and set-pieces** stand on the anchors (`boss-*`, `la-pista`, `el-plint`), with a
   `FightMoment` per boss phase in the fight tester.
6. Optional: give the gym a real sports-floor texture, round the patio's arcs, and let the
   particles know the zones' real heights.
