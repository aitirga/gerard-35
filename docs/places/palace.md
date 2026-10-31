# Inside La Reina Bubbaloo's palace (chapter 2)

Status: **research and plans** (2026-10-30), **part 1 built** (2026-10-31): the hall's east door
in chapter 2, el patio and el gimnasio are built and documented, as built, in
[palace-zones.md](palace-zones.md), with what part 2 (la secretaría, el salón del trono) must do.
This file keeps the research: the real place, an identity card per zone, the drafted plans of all
four zones and the texture candidates. It refines `docs/visual-style.md` § 4 *The palace inside,
by zones*.

Related: the palace's story and chapter 1 part in [bubbaloo-palace.md](../bubbaloo-palace.md),
how chapter 2 reaches it in [chapter-2.md](../chapter-2.md) § The palace, any time, the decisions
on zones in `docs/story-outline.md` § The palace: zones (rounds 14–16), the tone in the same file
§ Tone.

## The place

In chapter 2 the palace has grown out of the **Institut Escola Rec Comtal** in Trinitat Vella,
Gerard's workplace: he teaches there and is the school's secretary. From the street it is
`rec-comtal` with the castle on top (`seat` in `src/palace.ts`); inside, today, it is the dream's
palace of chapter 1 (`palacio`): the hall, the portrait gallery and the wrapper room, with the
guards before the gum curtain.

What the story decided (rounds 14–16): the palace is **a regular dungeon of zones**, each with its
own characteristic elements, puzzles and **a boss**, the bosses being teachers Gerard works with
(Aurelia, Montse, Pilar…). A zone won stays won and **opens a shortcut** to the next one. The zones
are **el patio, el gimnasio, la secretaría** (his own office, his routine, last) and then **the
throne room**. Nothing is required to reach the throne: the curtain and its guards stay open from
day one, only difficulty stands in the way.

Aitor's direction for this place: **not everything pink**. The entrance stays hers (her gum, her
wrappers) and pink appears in details, her creeping in; **each zone has its own main colour** so a
screenshot names it at a glance; the real school shows through each zone, transformed. The tone is
serious: a workplace with children held inside it, empty where it should be loud, too orderly,
too long. The cartoon only as a wink.

This step is **places only**: no fights, bosses or puzzles. The plans leave **named anchors** where
the bosses and set-pieces go, and **diegetic gates** where a zone must not open yet.

## The real place

| What | Finding | Source |
| --- | --- | --- |
| The school | Created for 2020–21 by merging Trinitat Vella's three public centres: Escola Ramon y Cajal, Escola Ramon Berenguer III and Institut Josep Comas i Solà. €4.2 M from the Pla de Barris; in summer 2021 walls came down to make 100 m² open classrooms; provisional modules stood in the playground. Its project: technology, three languages, emotions and teamwork. | [betevé](https://beteve.cat/societat/trinitat-vella-fusiona-centres-educatius-publics/), [guia.barcelona.cat](https://guia.barcelona.cat/en/detall/institut-escola-rec-comtal_99400648272.html) |
| Via de Bàrcino 90 (primary and secondary) | OSM way 469114784 (school code 08013305): a pentagonal plot of about 6,200 m². A **stepped, crescent-shaped block of three storeys** wraps its north side (parts of 21 × 32, 18 × 18 and 28 × 25 m, about 60 × 45 m overall), with a two-storey annex; **the pati is a pitch of about 43 × 37 m** south of it. The municipal nursery Escola Bressol El Tren shares the block's north end; the Complex Esportiu Municipal Trinitat Vella is next door to the north-east. | OpenStreetMap, checked 2026-10-30 (© OpenStreetMap contributors, ODbL) |
| Mare de Déu de Lorda 25 (infants) | OSM way 655717687 (code 08002447): about 4,200 m², a two-storey school of about 45 × 47 m with one-storey annexes behind a fence. | OpenStreetMap |
| The neighbourhood | Trinitat Vella: 1950s–60s blocks of four and five storeys in brick and cream render, hemmed in by the Meridiana, the Ronda and the railway; the medieval Rec Comtal canal still runs through Vallbona next door, which names the school. | [Commons: the neighbourhood from the Coll de la Trinitat](https://commons.wikimedia.org/wiki/File:La_Trinitat_Vella_des_del_mirador_del_coll_de_la_Trinitat_-_20210418_162952.jpg), [the Rec Comtal at Vallbona](https://commons.wikimedia.org/wiki/File:Rec_Comtal_a_Vallbona_-_20210418_165442.jpg) |
| Inside | No openly licensed photo of the school's inside exists, and photos of a school with pupils are not for a public repo. The zones are drawn from what every Barcelona public school shares (below), and from what Aitor knows of Gerard's school. | — |

What a local recognises in any Barcelona public school, and so what the zones are built from:

- **El pati**: a concrete or resin court with faded white, red and yellow lines, futsal goals and
  basketball hoops on tubular posts, a covered **porxo** of arches along the building, a drinking
  trough with push taps, plane trees or hackberries in planters, a fence, backpacks dropped in a
  row when the bell rings, the lost-property heap. Reference: Escola Salesians Rocafort's patio.
- **El gimnàs**: often an old covered court with a **painted dado** (green or blue to about 1.5 m,
  cream above), barred high windows, basketboards on the walls, **espatlleres** (pine wall bars),
  the **plint** (the stepped wooden vaulting box with a leather top), blue vinyl **matalassos**,
  Swedish benches, the ball cage, ropes, hoops and cones, the changing rooms (*vestidors*).
- **La secretaria**: a counter with its **finestreta** (the window parents queue at, with opening
  hours taped on it), grey steel filing cabinets, AZ binders, manila folders, the photocopier, the
  cork board with circulars and the school calendar, the school's seal and the *registre
  d'entrada* stamp, the key cabinet with every classroom's key, terrazzo floors.
- **La sala d'actes**: a low stage with curtains, rows of folding chairs, the school's banner, an
  upright piano for the Christmas concert and the end-of-year show.
- **Everywhere**: signs in Catalan (*Pati, Gimnàs, Secretaria, Direcció, Vestidors, Sala
  d'actes*), children's drawings on the walls, a welcome mural with *Benvinguts* in the pupils'
  languages, and the school's own colour on doors and frames (the `rec-comtal` school style uses
  orange `#e8742c`).

What changed recently, and why it matters here: the school is new (2020–23), built by merging
three; its classrooms were opened up and its patio filled with modules for a while. Gerard's
workplace is itself a place whose routine was remade, which is what the palace does to it again.

The real block (crescent of three storeys over a south-facing court) also answers how the
`rec-comtal` scene could grow closer to the real place; that scene is not part of this stream, so
it is only noted here.

## Identity

### The palace inside, as a whole

- **The entrance is hers, pink**, as built in chapter 1. Only one change, in chapter 2: the east
  door (chapter 1's sealed *Ala Líquida*) shows the school's **orange frame** under the gum and
  opens onto the school.
- **Each zone has one main colour**, a step round the colour wheel from the last, so the four read
  apart even in a thumbnail: pink → court green → mat blue → manila and steel → night indigo and
  gold. Measured distances between dominants (CIE76): entrance–patio 82, patio–gym 68,
  gym–secretaría 91, secretaría–throne 93, gym–throne 23 (told apart by light: tubes against one
  spotlight in the dark).
- **The deeper, the more of the real school**, and **her pink only in details** (under a tenth of
  the screen): seams, drains, cracks, what the pupils touched, the boss's things.
- **The school's orange is the thread**: every door between zones keeps its orange frame. Orange
  is the school, pink is her.
- **Violet only in the possessed pupils' eyes.**
- **A won zone comes back** (proposal kept from the style guide): when its boss falls, its pink
  dries and greys, its look drifts towards the real school's morning (`rec-comtal`), and the
  castle outside loses a little of its threat.

### Entrance · Vestíbulo de las Burbujas, Galería de los Retratos, Sala de los Envoltorios (built)

Status: built in chapter 1; kept. Only the chapter 2 east door changes.

| | |
| --- | --- |
| Dominant | Rose tile `#c95a8d` |
| Secondary | Gum pink `#ff6fae`, plum tile `#5a1d47`, gum wall `#b9467e`, wrapper white `#fbeef3`, liquid core `#ff3d8b` |
| Material | Glossy gum walls with drips, wet-candy checkerboard floors, twisted wrapper columns |
| Ground | The checkerboard |
| Landmark | El Corazón Líquido, the fountain (kind: fountain) |
| Light | `palacio` look, `palace` sky, pink liquid-centre point lights over violet shade |
| Props | Wrapper columns, sconces, portraits, wrapper heaps, the drain, the curtain |
| Air | Her gloom and bubbles (`AIR.palacio`) |
| Sound | The fountain bubbling, gum creaking |
| Only here | The portraits of the Queen as Bernat imagined her |
| Text | None but Bernat's felt-tip *REINA BUBALU* |
| Wink | The child's drawing in a gold frame |
| Note | Under the tone review (`docs/story-outline.md` § Visual review): the gum could get heavier, translucent and less bumpy later; not part of this stream |

### El patio (proposal, refined)

Status: refined from `docs/visual-style.md` § 4: the porch becomes the zone's hub (the doors to the
gym and the secretaría open off it), and the court's colour and lines follow the reference.

| | |
| --- | --- |
| Dominant | Court green `#3f7d58` (resin court) |
| Secondary | Line white `#e9ece4`, worn asphalt `#5d5e5c`, porch concrete `#a9a49a`, school cream `#ece6da`, school orange `#e8742c`, galvanised fence `#9aa0a0`; her pink `#ff6fae` in details |
| Material | Painted resin court and its risen lines (white-painted concrete kerbs) |
| Ground | The green court inside, worn asphalt round it, the porch's concrete under the arches |
| Landmark | **La pista**: the court's own lines risen into knee-high kerbs, a maze read from above (kind: a drawn maze on the ground) |
| Light | New look `palacio-patio`: open to her plum sky, low and flat like the end of the school day, slightly cool; one cold floodlight on a pole; long fence shadows. `palace` sky, but lit as outdoors (the common sun direction, plum-tinted) |
| Props | Basketball hoops on tubular posts, futsal goals, benches, the drinking trough with push taps, plane trees in planters, the porch's arches, backpacks along the fence, the lost-property heap |
| Air | Dry plane leaves and chalk dust skittering (a `leaf` kind, or `pollen` recoloured); now and then one of her bubbles |
| Sound | A ball bouncing on its own, the recess bell ringing and stopping halfway, children's voices far off |
| Only here | The court's painted lines standing up out of the ground |
| Text | Catalan: *GIMNÀS*, *SECRETARIA* over the porch doors; a *Benvinguts* mural in the pupils' languages on the porch wall (proposal, for the user's "cultural zones" idea) |
| Wink | A pink gum ball in the lost-property heap |
| Her pink | Gum in the court's cracks, a trickle of pink water from the trough, gum over the street gate |

### El gimnasio (proposal, refined)

Status: refined from `docs/visual-style.md` § 4. The floor changes from varnished wood to a grey
sports linoleum: honey wood is the Meridiana flat's family and material (matrix rule), and Aitor's
beige shirt nearly vanished on pale wood (ΔE 9). The blue moves to the mats and the painted dado.

| | |
| --- | --- |
| Dominant | Mat blue `#2d5a9e` (the mats stacked into walls, and the dado on the tall walls) |
| Secondary | Sports linoleum `#7d8287`, wall-bar pine `#c79a5b`, upper wall cream `#e8e2d4`, line yellow `#e5b52e`, tube white `#e6f0ff`, shade `#1c2333`; her pink in details |
| Material | Blue vinyl mats and pine wall bars |
| Ground | Grey sports linoleum with yellow and white court lines |
| Landmark | **El plint**: the vaulting box stacked into a stepped tower in the middle (kind: a stepped tower) |
| Light | New look `palacio-gimnasio`: cool; rows of cold tubes, one flickering; her plum light through the high barred windows |
| Props | Wall bars on every tall wall, the plint, mats, Swedish benches, ropes, the ball cage, hoops and cones on the floor |
| Air | Chalk dust in the window light (`mote`) |
| Sound | A whistle, trainers squeaking, a ball thudding against the wall in a steady drill that never ends |
| Only here | Wall bars and ropes that go up into a dark with no ceiling |
| Text | Catalan: *VESTIDORS* on the changing-room door |
| Wink | One pink ball among the orange ones in the ball cage |
| Her pink | Gum seeping between the floor's seams, round the plint's handholds |

### La secretaría (proposal, refined)

Status: refined from `docs/visual-style.md` § 4. The manila is carried by what the camera sees
most, the **tops of the archive** (archive boxes and folders piled on back-to-back cabinets); the
floor is a cool terrazzo, never manila, so Gerard's and Matemágico's yellows stay his.

| | |
| --- | --- |
| Dominant | Manila `#d6b46a` (folders and archive boxes on the cabinets) with steel `#7f8a83` |
| Secondary | Terrazzo `#9ea3a3`, paper white `#f2efe6`, binder navy `#2f3e5c`, counter laminate `#cbbfa6`, tube light `#eef4e6`, desk-lamp warm `#f2c27a`; her pink sticky notes |
| Material | Grey steel filing cabinets and manila card |
| Ground | Cool terrazzo (*granito*) |
| Landmark | **The aisles of cabinets** and, at their end, **La mesa de Gerard** under the one warm lamp (kind: aisles) |
| Light | New look `palacio-secretaria`: greenish tubes overhead, flat and tiring; Gerard's desk lamp the only warm light (and the home's `mesa` bulb with it) |
| Props | The counter and its finestreta, the queue, the same desk repeated in rows, the photocopier, cabinets, binders, drifts of forms, the cork board, the key cabinet, the stamp |
| Air | Paper dust; now and then a sheet drifting down (a `sheet` kind, proposal) |
| Sound | The photocopier, a phone nobody answers, a stamp thudding, a clock |
| Only here | The finestreta seen from the visitors' side, with a queue that never moves |
| Text | Catalan: *SECRETARIA · Horari d'atenció*, *REGISTRE D'ENTRADA*, *DIRECCIÓ* |
| Wink | The office's stamp and No-ta's stamp are cousins |
| Her pink | Her sticky notes on everything, her ink on the stamp pad |

### El salón del trono (proposal)

Status: kept from `docs/visual-style.md` § 4, with the balcony placed where the camera sees it.

| | |
| --- | --- |
| Dominant | Curtain indigo `#232a5c` |
| Secondary | Night `#10132b`, old gold `#c9a046`, stage boards `#5a3b2a`, walnut floor `#3b2c26`, aisle runner ochre `#7a5a2e`, spotlight `#fff4dc`; she and her throne `#ff6fae`, core `#ff3d8b` |
| Material | Velvet curtains, varnished stage boards, folding steel chairs |
| Ground | Dark walnut parquet, an ochre runner up the aisle |
| Landmark | **El escenario**: the stage with her throne in the spotlight (kind: a stage) |
| Light | New look `palacio-trono`: dark; one warm spotlight on the throne, the city's night through the balcony, her core glowing; a pool of light follows Gerard |
| Props | Rows of folding chairs, the school's banner, the upright piano |
| Air | Stage haze, her bubbles rising slowly |
| Sound | Almost nothing: chairs creaking, her bubble swelling and shrinking |
| Only here | Empty chairs facing her, and the night city behind her through the balcony |
| Text | Catalan: *SALA D'ACTES*, the banner *Institut Escola Rec Comtal* |
| Note | The final fight happens here (Aitor held by her, the melody). The balcony opens through the **north** wall, the one the camera sees, so the city stands behind her: her palace's inside need not match its outside (the exterior balcony faces Via de Bàrcino). The *Desde el balcón* portrait in the gallery shows this very view. |

### Against the other places

| Check | Result |
| --- | --- |
| Matrix (dominant family and signature material not both taken) | Patio: court green + resin court (El Nucli is bottle green + felt, ΔE 25). Gym: mat blue + vinyl and pine. Secretaría: manila + steel cabinets (Sants street is ochre + shutters and render, ΔE 7: told apart by material, ground and light). Throne: indigo + velvet (La torre de Uri is violet-black + dark stone, ΔE 25). |
| Neighbours (doors) | Entrance → patio ΔE 82, patio → gym 68, patio → secretaría 51, secretaría → throne 93, entrance → throne (the curtain's stair) 55: all four of colour, material, ground and light differ at every door. |
| Gerard and Aitor on the floors | Every floor where they walk is mid-value and away from their colours: court green L* 48, linoleum 54, terrazzo 67. The closest pairs are Aitor's beige shirt on the terrazzo and Gerard's provisional pyjama blue on the linoleum (both ΔE 19; Aitor's dark trousers and Gerard's ánima looks carry them). The throne's walnut is dark on purpose and near Noísta's charcoal (ΔE 14): a pool of light follows them there. No floor is mustard, navy, crimson or orange. |
| Reserved colours | Pink only as her details and the entrance; violet only in eyes; the school's orange on doors (Papagato's orange is a light, never a surface near him). One glow per zone at most: the floodlight, the flickering tube, the desk lamp, the spotlight. |

## Layout

All four zones are **hand-authored plan scenes like `palacio`** (no map data): one cell is one
metre, north is up, the camera looks from the south-east, so north and west walls stand tall and
south and east ones are cut low; a door on a south or east edge faces the camera. Each zone is its
own environment (its own look, air, sky and music), joined by doors.

```
                         ┌────────────────── EL SALÓN DEL TRONO ──────────────────┐
                         │ stage + her throne · balcony on the night city (north)  │
                         └───────────▲────────────────────────────────▲───────────┘
                                     │ the stair (behind the curtain:  │ Direcció's stair: the last
                                     │ the guards, open from day one)  │ shortcut, once la secretaría is won
 ENTRANCE (pink, built) ─────────────┘                                 │
 vestíbulo ── east door (ch2 only) ──> EL PATIO: its porch is the hub ─┤
                                        ├── door GIMNÀS ──> EL GIMNASIO│   (opens when el patio is won)
                                        └── door SECRETARIA ──> LA SECRETARÍA ── Direcció ┘
                                                                (Gerard's key turns when el gimnasio is won)
```

Order and shortcuts: **patio → gimnasio → secretaría → throne**. Each won zone opens the door to
the next **in the patio's porch**, a few steps from the hall, so the next visit starts there; the
secretaría's *Direcció* door is the last shortcut, up a stair into the throne room's west door,
past the guards. A zone half done starts again from its door; won zones stay won (falling wakes
Gerard at home as anywhere).

Chapter 1 stays untouched: `palacio`'s plan, rooms and lines do not change. In chapter 2 only
(`story.adult`), the east door gets its orange frame and becomes a door (`story.redirect` or an
adult-only interaction, as `challenge-guards` is today), arriving at the patio's porch.

Proposed flags (story arc *El palacio por dentro*): `palacio-escuela` (first time through the east
door), `zona-patio`, `zona-gimnasio`, `zona-secretaria` (each zone won).

### El patio · `palacio-patio` (35 × 25)

Rasterised from a real court's markings (baseline, side lines, halfway line, centre circle, keys,
three-point arcs), mirrored, with gaps for the ways through; the builder models each kerb as a
smooth piece along the true line and keeps the cells for collision.

```
######2##########1##########3######
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,A,,,,,A,,,A,,,,,,,A,,,A,,,,,A,,#
#.................................|
#.................................|
#f...............................m|
#f...======..=========..======....|
#f...=====.......=.......=====...m|
#....=....=.............=....=....|
#..........=.....=.....=.........m|
#....=.....==..=====..==.....=....|
#.T..=====..=.==.B.==.=..=====...m|
#....=...=..=.=.....=.=..=...=....|
#...H=......=....L....=......=H..m|
#b...=...=..=.=.....=.=..=...=....|
#....=====..=.==...==.=..=====...m|
#....=.....==..=====..==.....=....|
#.T........=.....=.....=.........m|
#....=....=.............=....=....|
#....=====.......=.......=====...m|
#b...======..=========..======....|
#.................................|
#.................................|
|||||||||||||||||P|||||||||||||||||
```

| Glyph | Meaning | Glyph | Meaning |
| --- | --- | --- | --- |
| `.` | Court (green inside the lines) or asphalt | `,` | Porch floor |
| `#` | School wall (tall north and west) | `\|` | Fence (low) |
| `A` | Porch pillar | `=` | Risen court line (knee-high kerb) |
| `H` | Basketball hoop | `T` | Plane tree in a planter |
| `b` | Bench | `f` | Drinking trough |
| `m` | Backpacks along the fence | `L` | Lost-property heap |
| `B` | Boss anchor | `P` | Gate to the street, sealed |
| `1` | Door back to the hall | `2`, `3` | Doors *Gimnàs* and *Secretaria* |

Anchors and places (ids proposed, lines drafts in Spanish):

| Id | Cell | What |
| --- | --- | --- |
| `patio-entrada` | 17, 1 | Arrival from the hall's east door; `1` leads back (*Volver al vestíbulo*) |
| `boss-patio` | 17, 12 | Where the zone's boss stands, before the heap |
| `la-pista` | 17, 14 | Set-piece: the lost-property heap in the centre circle |
| `patio-gimnas` | 6, 1 | *Entrar en el gimnasio*. Gate until `zona-patio`: *"Dentro suena un silbato. Luego, nada."* / *"La puerta no cede. Algo blando la sujeta por dentro."* (the mats stacked against it; when the zone is won they slide away) |
| `patio-secretaria` | 28, 1 | *Abrir la secretaría*. Gate until `zona-gimnasio`. Gerard: *"Es mi puerta. La llave entra… y no gira."* Aitor: *"¿Seguro que es esa?"* Gerard: *"La abro cada mañana."* |
| `patio-calle` | 17, 23 | Looks at `P`: *"La puerta del patio da a la Via de Bàrcino. Hay chicle hasta arriba. Por aquí no sale nadie."* |
| `patio-mochilas` | 32, 14 | *"Mochilas en fila contra la valla, como cuando suena el timbre. Nadie ha vuelto a por ellas."* |
| `patio-objetos` | 17, 13 | *"Objetos perdidos: chaquetas, una flauta, un táper. Cada año el montón es el mismo."* |
| `patio-fuente` | 2, 7 | *"La fuente de los grifos que hay que apretar. Sale un hilo de agua rosa."* |
| `patio-alumnos` | along the fence and the porch | Anchors for the possessed pupils, standing still (later) |

### El gimnasio · `palacio-gimnasio` (26 × 18)

The mats make a circuit, the PE lesson's obstacle course, winding from the door to the plint.

```
#EEEEEEEEEEEEEEEEEEEEEEEE#
E.....................CCC#
E....r..r........r..r.CCC#
E..MMMMMMMM....MMMMMMMM..#
E..M..................M..#
E..M..................M.b#
E..M........PPP....M..M.b#
E..M..M.....PPP....M..M..#
E.....M.....PPP....M..M..V
E..M..M.ooooo......M..M..#
E..M..M......B........M..#
E..M..MMMMMMMMMMMMMM..M.b#
E..M....................b#
E..M..................M..#
E..MMMMMMMMM..MMMMMMMMM..#
E..MMMMMMMMM..MMMMMMMMM..#
E........................#
#############1############
```

| Glyph | Meaning | Glyph | Meaning |
| --- | --- | --- | --- |
| `E` | Tall wall with wall bars, blue dado, high windows | `#` | Wall |
| `M` | Blue mats stacked waist-high | `P` | El plint (3 × 3, stepped) |
| `C` | Ball cage | `b` | Swedish bench |
| `r` | Rope hanging from the dark (walkable) | `o` | Hoop on the floor (walkable) |
| `B` | Boss anchor | `V` | *Vestidors*, always shut |
| `1` | Door back to the porch | | |

| Id | Cell | What |
| --- | --- | --- |
| `gimnas-entrada` | 13, 16 | Arrival; `1` leads back to the porch |
| `boss-gimnasio` | 13, 10 | Before the plint |
| `el-plint` | 13, 7 | Set-piece |
| `gimnas-vestidors` | 24, 8 | *"Vestidors. Huele a lejía. Dentro gotea una ducha que nadie cierra."* |
| `gimnas-espatlleres` | 2, 8 | *"Las espalderas de siempre. No se ve dónde acaban."* |
| `gimnas-cuerdas` | 8, 2 | *"Cuerdas que bajan de un techo que no se ve."* |

### La secretaría · `palacio-secretaria` (28 × 21)

Gerard comes in on the visitors' side, for once. Behind the counter, the office repeats: the same
desk in rows, then the archive's aisles, and at their end his own desk.

```
######D#####################
#GG........................#
#....AA......AA......AA....#
#....AA..AA..AA~.AA..AA....#
#k...AA..AA..AA..AA..AA....#
#..B.AA.~AA..AA..AA..AA....#
#....AA..AA..AA..AA.~AA....#
#....AA..AA..AA..AA..AA....#
#........AA......AA........#
#........................X.#
#..dd..dd.......dd..dd..dd.#
#..........................#
#..dd..dd.......dd..dd..dd.#
#..........................#
#KKKKKWKKKKKKFKKKKKKKKKKKKK#
#..........................#
#N.....qqqqq...............#
#N.........q...............#
#..........q...............#
#..........................#
####1#######################
```

| Glyph | Meaning | Glyph | Meaning |
| --- | --- | --- | --- |
| `K` | Counter | `W` | The finestreta |
| `F` | The counter's flap (walkable) | `q` | The queue (figures standing still) |
| `N` | Cork board | `d` | The same desk, repeated |
| `X` | Photocopier | `A` | Back-to-back cabinets, archive boxes on top |
| `~` | Drift of forms | `G` | La mesa de Gerard |
| `k` | Key cabinet | `B` | Boss anchor |
| `D` | *Direcció*: the stair to the throne | `1` | Door back to the porch |

| Id | Cell | What |
| --- | --- | --- |
| `secretaria-entrada` | 4, 19 | Arrival; `1` leads back |
| `secretaria-cola` | 9, 17 | *"Una cola delante de la finestreta. Nadie se mueve. Nadie se queja."* |
| `secretaria-finestreta` | 6, 15 | *"La finestreta. Desde este lado nunca la había visto."* |
| `secretaria-tablon` | 2, 16 | *"Circulares, el calendario escolar, los horarios. Todo en su sitio."* (the timetable is a natural home for the artilugio's room-order hint, `docs/story-outline.md` § El artilugio: later) |
| `boss-secretaria` | 3, 5 | Before his desk |
| `la-mesa` | 1–2, 1 | Set-piece: his mug, the school's seal, the day's pile of forms, the one warm lamp |
| `secretaria-llaves` | 2, 4 | *"Las llaves de todas las aulas, cada una en su gancho."* |
| `secretaria-direccio` | 6, 1 | Gate until `zona-secretaria`: *"Direcció. Cerrada por dentro. Por debajo sale luz de escenario."*; once won it leads to the throne room's west door |

### El salón del trono · `palacio-trono` (26 × 22)

```
###########OOOO###########
#cccSSSSSSSSSSSSSSSSSSccc#
#cccSppSSSSSQQQSSSSSSSccc#
#cccSSSSSSSSQQQSSSSSSSccc#
#cccSSSSSSSSSSSSSSSSSSccc#
#cccSSSSSSSSSSSSSSSSSSccc#
#...ss______________ss...#
#............B...........#
#........................#
#..hhhhhhhhh..hhhhhhhhh..#
#........................#
#..hhhhhhhhh..hhhhhhhhh..#
#........................#
#..hhhhhhhhh..hhhhhhhhh..#
#........................#
#..hhhhhhhhh..hhhhhhhhh..#
2........................#
#..hhhhhhhhh..hhhhhhhhh..#
#........................#
#........................#
#........................#
############11############
```

| Glyph | Meaning | Glyph | Meaning |
| --- | --- | --- | --- |
| `O` | The balcony, open on the night city | `S` | Stage (raised, walkable) |
| `_` | The stage's front edge | `s` | Steps up |
| `c` | Velvet curtains | `Q` | Her throne |
| `p` | Upright piano | `h` | Folding chairs |
| `B` | Anchor for the final confrontation | `1` | The stair from the curtain |
| `2` | The stair from *Direcció* | | |

| Id | Cell | What |
| --- | --- | --- |
| `trono-cortina` | 12–13, 20 | Arrival from the curtain's stair (after the guards) |
| `trono-direccio` | 1, 16 | Arrival from la secretaría (the last shortcut) |
| `el-escenario` | 13, 3 | Set-piece: her throne in the spotlight |
| `boss-reina` | 13, 7 | Before the stage |

All four plans were checked by a flood fill from their arrival cell: every walkable cell, door
and anchor is reached (the plint's centre is solid on purpose). The scratch script that drew and
checked them is not committed; the plans above are the source.

## Texture candidates

The shared library first (`formigo`, `asfalt`, `granit`, `estuc`, `rajola`). New ones, all CC0
unless said, fetched with `tools/textures.py fetch` and kept to the place budget (≤ ~12 new, webp,
≤ 1024 px, < 400 KB each):

| Proposed id | Source and asset | Licence · author | Real size | Use |
| --- | --- | --- | --- | --- |
| `pista-resina` | Poly Haven [`concrete_floor_painted`](https://polyhaven.com/a/concrete_floor_painted) tinted court green (lines are geometry) | CC0 · Poly Haven | 2 m | Patio court |
| `asfalt-gastat` | Poly Haven [`worn_asphalt`](https://polyhaven.com/a/worn_asphalt) | CC0 · Poly Haven | 2 m | Patio round the court (or the shared `asfalt` if it reads) |
| `escorca-platan` | Poly Haven [`tree_bark_03`](https://polyhaven.com/a/tree_bark_03) | CC0 · Poly Haven | 1 m | Plane trunks |
| `reixa` | ambientCG [`Fence003`](https://ambientcg.com/view?id=Fence003) (alpha) | CC0 · ambientCG | 1 m | Chain-link fence, if alpha stays cheap; otherwise lines drawn in code |
| `linoleum-esport` | Poly Haven [`old_linoleum_flooring_01`](https://polyhaven.com/a/old_linoleum_flooring_01) tinted grey | CC0 · Poly Haven | 2 m | Gym floor |
| `matalas` | Poly Haven [`leather_white`](https://polyhaven.com/a/leather_white) tinted mat blue | CC0 · Poly Haven | 0.3 m | Vinyl mats |
| `pi-espatllera` | Poly Haven [`white_oak_veneer`](https://polyhaven.com/a/white_oak_veneer) warmed to pine | CC0 · Poly Haven | 0.5 m | Wall bars, benches, the plint |
| `paret-pintada` | Poly Haven [`peeling_painted_wall`](https://polyhaven.com/a/peeling_painted_wall) | CC0 · Poly Haven | 1.8 m | The gym's old painted dado (blue) and cream wall |
| `terratzo` | ambientCG [`Terrazzo004`](https://ambientcg.com/view?id=Terrazzo004) (or Poly Haven [`terrazzo_tiles`](https://polyhaven.com/a/terrazzo_tiles)) | CC0 | 1–2 m | Secretaría floor, porch |
| `armari-metall` | ambientCG [`PaintedMetal014`](https://ambientcg.com/view?id=PaintedMetal014); drawer fronts from Commons [Filing Cabinets.jpg](https://commons.wikimedia.org/wiki/File:Filing_Cabinets.jpg) | CC0 · ambientCG; CC0 · MarkBuckawicki | 1 m; one drawer bay | Cabinets |
| `cartro` | ambientCG [`Cardboard004`](https://ambientcg.com/view?id=Cardboard004) | CC0 · ambientCG | 1 m | Archive boxes on the cabinets |
| `paper` | ambientCG [`Paper003`](https://ambientcg.com/view?id=Paper003) | CC0 · ambientCG | 0.5 m | Drifts of forms |
| `suro` | ambientCG [`Cork003`](https://ambientcg.com/view?id=Cork003) | CC0 · ambientCG | 0.5 m | Cork board |
| `vellut` | Poly Haven [`velour_velvet`](https://polyhaven.com/a/velour_velvet) tinted indigo | CC0 · Poly Haven | 0.3 m | Throne room curtains |
| `fusta-escenari` | Poly Haven [`old_wooden_floor_02`](https://polyhaven.com/a/old_wooden_floor_02) (stage) and [`dark_wooden_planks`](https://polyhaven.com/a/dark_wooden_planks) (hall) | CC0 · Poly Haven | 2 m | Stage boards and the hall's floor |

That is fifteen candidates for four zones: the builder keeps about three to four per zone and
paints the rest (court lines, signs, the porch's arches, the drawings) in code. Generated images
(at most four for this stream, recorded as such) only if her gum in the entrance is redone after
the tone review: a heavy, translucent gum skin and a printed wrapper paper are the two surfaces no
photo can give. None are generated in this step.

Reference photos (looked at, not shipped):

| Photo | Licence · author | Shows |
| --- | --- | --- |
| [El pati de l'escola](https://commons.wikimedia.org/wiki/File:El_pati_de_l%27escola.jpg) (Escola Salesians Rocafort, Barcelona) | CC BY-SA 4.0 · Stbosco11 | Concrete court with faded white and red lines, hoops on tubular posts, futsal goals, the arcaded porch, wall troughs, fence |
| [El pati cobert](https://commons.wikimedia.org/wiki/File:El_pati_de_cobert.jpg) (same school) | CC BY-SA 4.0 · Stbosco11 | The covered court: green dado and cream wall, barred windows, boards on the walls, a painted floor |
| [Kasse og brett](https://commons.wikimedia.org/wiki/File:Kasse_og_brett.JPG) | Public domain · ChickenFalls | The plint (stepped box, leather top), springboard, blue mats |
| [Kasten](https://commons.wikimedia.org/wiki/File:Kasten14.jpg) | CC BY 2.5 · Peng | The plint and a soft mat |
| [Espaldar na escola](https://commons.wikimedia.org/wiki/File:Espaldar_na_escola.jpg) | CC BY-SA 4.0 · Luís Filipe Figueiredo Alves Gaspar | Wall bars close up: rounded rungs, the frame's joints |
| [Albertus-Magnus-Gymnasium, Turnhalle](https://commons.wikimedia.org/wiki/File:Erweiterungsbau_Albertus-Magnus-Gymnasium_K%C3%B6ln-5476.jpg) | CC BY-SA 4.0 · Raimond Spekking | Wall bars on a school gym wall, real proportions (about 1 × 2.6 m a section) |
| [IES Universidad Laboral de Toledo](https://commons.wikimedia.org/wiki/File:2022-07-13,_Visita_a_las_obras_que_se_est%C3%A1n_ejecutando_en_el_IES_%E2%80%98Universidad_Laboral%E2%80%99_de_Toledo_-_52213664939.jpg) | CC BY-SA 2.0 · Gobierno de Castilla-La Mancha | A Spanish public school's sports hall: wall bars in rows, brick, high windows |
| [Filing Cabinets](https://commons.wikimedia.org/wiki/File:Filing_Cabinets.jpg) | CC0 · MarkBuckawicki | Beige and grey steel drawer fronts, label holders |
| [Files at New Trier High School](https://commons.wikimedia.org/wiki/File:Files_at_New_Trier_High_School_(14402908135).jpg) | CC BY-SA 2.0 · Spiro Bolos | A school archive: cabinets in rows, boxes and folders piled on top |
| [La Trinitat Vella from the Coll de la Trinitat](https://commons.wikimedia.org/wiki/File:La_Trinitat_Vella_des_del_mirador_del_coll_de_la_Trinitat_-_20210418_162952.jpg) | CC BY-SA 3.0 · Pere prlpz | The neighbourhood: brick blocks between the Ronda and the railway |

## Build plan

After the foundation merges (materials, `docs/visual-style.md`), in this order:

1. **Data** (`src/environments.ts`): `EnvironmentId` gains `palacio-patio`, `palacio-gimnasio`,
   `palacio-secretaria`, `palacio-trono`; their plans (above), glyph legends and rooms go beside
   `PALACIO` (a `palace.zone` field tells the builder which kit). `PALACIO` itself is not edited.
   Walkability tests in `tests/environments.test.mjs`: from each arrival, every door and anchor is
   reached.
2. **Builder** (`src/palace-zones.ts`, new, called from `src/scenery.ts` like
   `buildPalaceInterior`): one kit per zone on the palace's rules (tall north and west walls, low
   south and east, inner walls waist-high, walls fold away from Gerard), shared materials from
   `palaceKit` plus the zone's textures, everything static batched. The court's kerbs as merged
   strips along the true lines; mats, cabinets, chairs as instanced or merged boxes. Point lights:
   at most four per zone, no shadows.
3. **Story** (`src/story.ts`, `src/chapter-2.ts`): the flags above, the east door in chapter 2,
   the doors between zones with their gates (`gate()`), the looks and their lines, the anchors in
   `PLACES_2`; each zone won lowers `castleThreat` (proposal, with the story).
4. **Light, air and sound**: a `LOOKS` entry per zone (`src/grading.ts`, `her` about .15–.3), its
   air in `AIR` (`src/effects.ts`), its home-lights look (`src/home-lights.ts`: the secretaría's
   desk lamp on the real `mesa` bulb), its music in `PLACE_SONGS` (`src/main.ts`), and the place on
   the exploration map (`src/exploration-world-map.ts`, as `palacio` is today).
5. **Picker** (`AGENTS.md`): the four in `PLACES` (`src/jump-menu.ts`, group *Barcelona*,
   names *Palacio · El patio*, *Palacio · El gimnasio*, *Palacio · La secretaría*, *Palacio · El
   salón del trono*), a chapter 2 arc *El palacio por dentro* in `STORY_ARCS`
   (`src/story-points.ts`) with the four flags, and the flags in the justfile's `dev-chapter` list.
6. **Screenshots**: a `palace-zones` scenario (follow camera and overview in each zone, every door
   and gate), then `palace`, `bubbaloo` and `forecourt` again to prove chapter 1 unchanged.
7. **Docs**: `docs/bubbaloo-palace.md` (the zones), `docs/chapter-2.md` (the palace), the rows of
   `docs/visual-style.md` § 2 and § 4 that this file refines, `docs/dev-tools.md`.

Later, with the story: the bosses (who fights where, each one's trait), the puzzles (La pista's
maze, the circuit, the archive), the possessed pupils, the artilugio's room order, and a
`FightMoment` per boss phase in the fight tester.

## Open

1. Which teacher is the boss of which zone, and what each one's trait is (the story's decision).
2. The cultural zones (the user's idea): the *Benvinguts* mural and games of many places in the
   patio are a respectful start; what they mean in play is open.
3. The real inside of Gerard's school: if Aitor has photos of the empty spaces (no pupils, no
   faces), the signature details can follow them; Gerard must not be asked (the game is a surprise).
4. Whether the entrance's gum is redone under the tone review (heavier, less bumpy), which would
   be the only use of generated textures here.
