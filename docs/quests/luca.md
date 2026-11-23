# Luca · La Sagrada peluquería

Status: designed, being built on `feat/side-mission-luca` · Last updated: 2026-11-19

## Summary

Luca, a friend from Gerard's first school, a maths teacher who once studied the sky, has gone
grey: his loud colours, his talking, his hands on your arm, all gone. Under the Queen's hold his
partner **Fran** has become suddenly brilliant: he spends the whole day inside the **Sagrada
Família**, studying Gaudí's hyperboloids, and he is turning the basilica into **his hair salon**.
Luca's colours have drained into the stained glass, and the brighter Fran shines, the greyer Luca
gets. Luca waits outside, unable to go in; Gerard and Aitor cross the salon zone by zone, where
**the light walks through colours and cancels the party's element of its colour**, and face Fran
under the canopy of the altar. Luca's ánima is **Colorista** (its wearable form designed
2026-11-20 and built 2026-11-21, `docs/animas/prismatico/`).

## Protagonist

- Who: **Luca**, a friend of Gerard's (Aitor, 2026-11-15).
- Relation to Gerard and Aitor: he and Gerard met at Gerard's first teaching job, at a school;
  a very close friend of both.
- Job and routine: **a maths teacher**, though he studied something close to **astrophysics**.
- Unmistakably him: **very eccentric**. Dresses in loud, bright colours; **very touchy-feely**
  (hugs, hands on your arm); **talks a lot**. A phrase of his: _open_.
- Home: lives with his partner **Fran** and their **adopted daughter, Yadelin** (spelling to
  confirm). Yadelin is not in the mission; Luca may mention her.
- **Fran**: peculiar too; runs **a hair salon**. Decided (2026-11-15): **only the salon** goes in
  the game, never the money Luca put in nor how it is doing. **Fran is the final boss** (Aitor's
  idea), under the Queen's hold.
- As a kid: _open_ (feeds the second round).
- Photos (2026-11-20): Luca's and Fran's, cropped to one person, in `assets/references/characters/luca/`
  and `.../fran/` (untracked). Their figures, portraits and Fran as a boss are drawn from them
  (`tools/figures.toml`): Fran is no longer invented.

## Place

- **The Sagrada Família**, both scenes already built and unused by any story until now: the
  outside (`sagrada-familia`, L5) and the inside (`sagrada-familia-interior`, through the Nativity
  portal), `docs/places/sagrada.md`.
- How to get there: L5 to Sagrada Família. When memory tickets exist (`docs/story-outline.md` §
  Getting there), the clues below are also what Gerard remembers to open the station: Luca + the
  Sagrada Família.

## The problem

- What the bubble popped: **his colours**. Luca has gone grey: what makes him himself (the loud
  clothes, the touching, the talking) is gone.
- Not Marta's loss (her voice, a quality taken away): here the loss is **seen** (colour) and the
  cause is **someone close**.
- **The duality**: under the Queen's hold **Fran is suddenly brilliant**, studying the basilica's
  architecture and **Gaudí's hyperboloids** all day. A kid who will not stop studying one thing is
  a kid (people the Queen takes become kids again, as Uri did).
- **Communicating vessels, through the stained glass**: Luca's colours have gone into the windows;
  Fran studies that light as pure geometry without seeing it is Luca's.
- **Fran's register**: he can be painted as the bad one: self-absorbed, superior, never looking at
  Luca. Kept **abstract**: no real problem of theirs is named. Adult, never cartoon.
- Routine vs. ilusión, here: Luca let his ilusión (the sky) turn into a routine (equations); the
  Queen hands an ilusión to Fran, and it is paid with Luca's colour.

## Clues

| Clue | Where | Flag |
| --- | --- | --- |
| A photo of Gerard and Luca in the flat, Luca in a loud shirt: from this morning on **Luca is grey in it**. Found by looking at it; Aitor reacts | The Meridiana flat | `clue-luca-foto` |
| TV ticker, among ordinary items: *"Un hombre lleva días dentro de la Sagrada Família midiendo las columnas; los vigilantes no consiguen que se vaya"* (it is Fran) | The flat's TV | `clue-sagrada` |
| A guided-tour poster for the Sagrada Família (*"La luz de las vidrieras"*): one strip of its stained glass is grey | On the Meridiana, a street poster (there is no metro-platform scene; same precedent as the R4 poster on the bus shelter) | `clue-sagrada-cartel` |

**The link**: once the photo and one Sagrada clue are seen, Aitor: *"Ese hombre de la tele que no
sale de la Sagrada Família… ¿no será Fran?"* (or the poster's version).

## Unusual things

- **The pond's reflection.** Luca, grey, stands by the pond of Plaça de Gaudí; his reflection in
  the water is still in colour. Can be looked at.
- **Light that walks.** Inside, the stained glass's patches of colour change with a sun that
  walks too fast; their colour is the light that cancels an element.

## La Sagrada peluquería (the mini-dungeon)

**Fran is turning the Sagrada Família into a hair salon.** The dungeon is *inside* it, through the
Nativity door. Outside stays as it is; inside, the change is seen happening **zone by zone**, the
church near the door and more and more salon deeper in. After the win it is the church again.

- **The mission's own mechanic: the light cancels its own element.** The light through the
  windows walks through colours in real time, during fights too. **Only the party** is affected.

  | Light | Cancels |
  | --- | --- |
  | Azul | Agua |
  | Verde | Nothing (a safe window) |
  | Naranja | Fuego |
  | Rojo | Fuego |
  | Oro | Eléctrico |
  | Blanca (grey-white, clear glass) | Physical blows, Atacar included: it carries no element |

  A cancelled blow does nothing and says so (*Anulado · Luz naranja*). A clock icon on each
  ally's plate shows the light now and the colours coming, like La Voz's song: a subtle
  continuous status, not new HUD. Every element answer becomes a timing too.
- **Zones**, on the real plan (`BASILICA_PLAN`):

  | Zone | In the basilica | Becomes | Foes |
  | --- | --- | --- | --- |
  | **La recepción** | The Nativity arm, by the door | Still the church; a salon desk with Fran's appointment book; grey visitors queue. The light is taught here | Las Polillas |
  | **Los sillones** | The nave and its rows of chairs | Salon chairs and mirrors in rows | Los capellanes |
  | **La carta de colores** | The Passion arm | The dye bar: the windows as a colour chart | Las camisas de Luca |
  | **El ábside** | The apse and its ambulatory | Where Luca used to look up: lenses, star charts. Fran's zone, no fight of its own (2026-11-20) | — |
  | **El crucero** | Under the Tower of Jesus, the presbytery steps | The canopy over the altar as the canopy of Fran's chair | **Fran** |

- Palette: no saturated pink (the Queen's) nor violet (possession) but for possessed eyes.

## Monsters

**They are what is eating Luca's colour**: things of Fran's world (the salon) and things that
steal light; not Luca's own traits (that is Marta's). Each asks one question.

| Foe | What it is | Question | Answer and how it shows | Weak / resists |
| --- | --- | --- | --- | --- |
| **Las Polillas** | Grey moths, many and frail, drawn to light: they swarm whoever struck with an element (the flash) | Lo que alcanza a todos | An all-target blow clears the swarm | Fuego / – |
| **Las camisas de Luca** (roja, azul, dorada; `estampado-*` in code) | Three of his loud shirts on wire hangers, nobody in them | A cuál, by the light | **Only the shirt in the light of its own colour can be hurt** (it is in colour, the others grey; *En su luz* / *Fuera de su luz* on the plate, *Nada* on a wasted blow). That light eats the party's element of that colour, so it is hit with anything else. Fallen, **its light goes out with it** and that element comes back | – / – |
| **Los capellanes** | The basilica's chaplains, restyled by Fran, each with hair of another shape and colour. People under the Queen, unsettling, not a joke | Orden | The freshly styled one (*Recién peinado*) repeats the last gesture next round; down it first and the copy stops | – |

Not used: El Secador (Aitor: no hairdryer monster), El Decolorante. **Cut on 2026-11-20** (Aitor, bestiary notes: «no tiene sentido», «quítalo»): El Telescopio and La Laca, with the apse's fight; the apse is now Fran's zone (§ What was built from the review).

Las Polillas are a figure of `just character-3d polilla` (2026-11-20, Aitor's bestiary note: flight): one piece with its wings cut off as their own nodes, laid flat at chest height in the fight (`src/luca-foes.ts`), the wings beating (`battle-scene.ts`). Fran fights as his boss figure (`fran-jefe`, Meshy's skeleton, 2026-11-21), loaded and moved like the castle's pupils (`BOSS_FIGURES` in `src/foe-bodies.ts`); its six moves from Meshy's library are not played in the fight yet. The removal of La Laca and El Telescopio is waiting for Aitor (docs/bestiary-notes.json).

## Beats

1. **Arrival** (outside): Luca by the pond, grey, saying little and half of it. He tried to go in
   after Fran, and each time he crosses the door he fades more: he needs Gerard. Going in costs an
   hour.
2. **La recepción**: the first fight starts in a cold light and turns orange during it; Foc Binari
   suddenly does nothing (*Anulado*). The player learns the light by losing their best blow.
3. **Los sillones, La carta de colores, El ábside**, in any order. Each zone won gives one colour
   back to Luca, seen when they step out (his clothes and his reflection).
4. **The gate**: a freshly restyled chaplain stands where the guard was, before the presbytery:
   *"El señor está atendiendo. Hay que esperar turno."* More restless with each zone won; once the
   four are done, *"Ya les toca."*
5. **Boss**: Fran (below).
6. **After Fran**: the violet goes from his eyes; he takes off the cape, looks at it, and walks out
   without a word. Outside Luca stands in full colour, and his light leaves him. **Whether they
   stay together is never said.** Two more hours; night falls.

- **Luca never goes in**: he stays outside the whole mission.
- **Respect**: the altar and Gaudí's crypt are left alone; Fran stands on the presbytery steps.
- Aitor's moments: he reads the clues (*"¿no será Fran?"*), names the light the first time it
  cancels a blow, and Fran's coldness.

## Final boss

**Fran**, under the Queen's hold, on the presbytery steps under the canopy he has made his chair's.
Each phase tests what one zone taught; numbers come from the fight sim.

**His look** (invented, no likeness to the real Fran; Aitor: tall and skinny): about forty, **very
tall and thin**, long neck and hands; hair **sculpted** into a high, sharp quiff, shaved at the
sides; a hairdresser's black, fitted clothes; scissors and comb at the hip. Under the Queen: the
**violet eyes**, and the white **cutting cape worn like a chasuble**, chalk hyperboloids on it.

**The question: what do you do with the lamps?** (Aitor, 2026-11-19: *tenemos que entender y
jugar con las lámparas para ganarlo*.) The three lamps of the canopy are the thread of the whole fight,
not one phase's chore: every one still hanging feeds Fran and keeps a colour from the party, every
one broken gives a colour back to Luca and, in the fight, back to the party's hands.

- **Phase 1 · Los acólitos** (*orden*, short: until 75 % of his PV). Two restyled chaplains serve
  him. Each round Fran restyles one (*Recién peinado*), and that one repeats Fran's gesture after
  him. Down the freshly styled one each time and Fran's gesture lands alone. His Corte a medida is
  the hardest blow of the salon's people (22, the chaplains' 16).
- **Phase 2 · El baldaquino** (*pieza* with the light). Fran stands and the three lamps light up,
  one per side of the day (cold: blue and green; warm: orange and red; gold). Each time a light
  comes on and its lamp still hangs, Fran gains **Brillo**, a shield (up to 3: a blow reaches him at
  40 %). Only the lamp of the light shining now can be broken, and that colour's element is cancelled
  right then, so it is broken with something else. **A lamp bursting rains its colour back**: Fran
  loses all his Brillo, and its lights eat nothing of the party's for the rest of the fight (the
  plates say *Vuelve fuego*, the light's window *Ya no anula nada*). Lamps are 40 PV: a light's
  window, not one blow.
- **Phase 3 · La aspersión** (*momento*). Fran charges **Aspersión** for a round (the plate says
  so, and the line says whose colour drips from it): bleach over the whole party, **dyed by every
  lamp still hanging**. Each one adds damage and takes one more point of Fuerza and Magia for the
  rest of the fight; with all three broken it only wets (*no os quita el color*). Hold that round,
  then spend everything. The lamps still drink light in this phase, so it is not too late.
- Code: `Encounter` `fran`; `FoeKind` `fran`, `capellan`, `lampara`.

## Ánima

- **Colorista** (it was Prismático; its id in the code stays `prismatico`): designed on 2026-11-20
  in [`docs/animas/prismatico/README.md`](../animas/prismatico/README.md) and agreed by Aitor that
  day. It replaces the direction of 2026-11-16 (barriers of crystal prisms, amplifying elemental
  attacks on the next turn; the prism goes to Marta's ánima): it is **a tank and protector that
  throws dry coloured powder**, as at a Holi. The powder does nothing by itself and an element
  decides what it becomes: fire blows it up, water turns it to poison, electricity leaves it as
  shards. Its protection is a screen of powder that halves the next blow. The binoculars stay as
  what Luca hands over.
- Today the mission gives `ANIMAS.luca` (light and a placeholder party bonus) and Luca's light,
  as Marta's does.
- World key: none.

## Second round

- _Open._ Proposal: at night Gerard takes Luca up to see the star on Mary's tower, what he looked
  at before maths became routine.

## Assets

Figures come from `/character-3d`; until then, primitive stand-ins in `src/characters/`.

| Who / what | Kind | Photos it may send | `about` and `cues` | Toy image approved | 3D in game | Portrait | Expressions | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Luca | person | none yet | Loud shirts, bright colours; cues to come with photos | – | stand-in | – | – | SVG fallback |
| Fran | person (and boss model) | none (invented) | Tall and very thin, sculpted high quiff, black fitted clothes, white cutting cape | pending Aitor's OK (API credits) | stand-in / procedural boss | – | – | SVG fallback |
| Capellán | person | – | A chaplain in black with a white collar, hair restyled in an odd shape and colour | – | procedural | – | – | SVG fallback |

## Review of the inside (2026-11-16, proposals for Aitor)

What is there: in through the door, four zones open at once (recepción, sillones, carta, ábside),
each a group of foes waiting that starts its fight when walked up to; then the chaplain lets them
through to Fran. Between fights there is nothing to do: the walking light only tints the floor.

What does not hold up yet:

1. **No route and no curve.** The four zones are open in any order, so neither the light's lesson
   (recepción) nor the lessons Fran tests come first for sure. The fights do not get harder: the
   ábside, which should be the last step before the boss, is the easiest one with the answer (smart
   wins with 84 % of its PV), sillones the hardest (25 %).
2. **Nothing but fights.** Nuria's tower has the fears hunting the ramp, the campsite its padlock and
   pitches, Las cuerdas its mazes; here the salon is scenery. The light, the mission's own mechanic,
   is never used outside a fight.
3. **The zones look alike.** The light walks the same through all of them, and the salon's props are
   small: the arms, the nave and the apse read as one place.
4. **Fran is long**: about 19 rounds playing well (La Voz, the longest so far, 10–16).
5. **Moths twice** (recepción, ábside) and nothing new learned between the third zone and the boss.

Proposals (Aitor chose **A, B, C, E and G** on 2026-11-16, built the same day; D and F are left for later):

- **A · A route round the crossing, held by a queue.** Grey visitors queue in the aisles *esperando
  turno*, and the queue is what blocks the way: each zone won, the queue moves on a step and opens the
  next. The way goes round the crossing as the building does: Nativity arm (recepción) → nave
  (sillones) → Passion arm (carta) → apse (ábside) → the crossing (Fran). A diegetic gate, the salon's
  own (a queue is routine itself), and it gives the fights a curve, each harder than the last.
- **B · Each zone in its own windows' light.** The walk is the same, but each zone's windows colour
  it: the Nativity arm cold (blue, green, then the sun comes in orange: the first fire eaten), the
  Passion arm warm (orange and red most of the time: fire is useless against the Estampados there),
  the apse gold, the crossing every colour. Zones become recognisable, and each fight a different
  problem.
- **C · Puzzle: the mirrors in the nave (sillones).** The salon's mirrors stand in the light; turning
  them (one interaction each, a quarter turn) sends the window's beam from mirror to mirror. Brought
  to the chaplains' chairs, it wakes the freshly styled one and the fight starts with him known
  (*Recién peinado* on his plate before he acts); brought to the queue, it moves on. A light puzzle,
  top-down and readable; nobody else uses one.
- **D · Puzzle: Luca's colours at the dye bar (carta).** The colour chart has a gap the shape of a
  shirt. The bowls on the bar are mixed two at a time under the light; the answer is outside: his
  reflection in the pond shows the orange shirt and the teal trousers (orange = red + gold). Mixed
  right, the Estampados come off the chart to fight, and that colour goes back to Luca. It ties the
  pond's reflection to the inside.
- **E · The apse as the climax.** ~~El Telescopio with a Laca instead of moths (its beam is fire: the
  lacquered take it double), or a second lens: the last zone asks two of the lessons at once.~~ Cut on
  2026-11-20: the apse is Fran's zone, with no fight.
- **F · The ánima on trial inside.** At the door Luca gives Gerard his old binoculars (*prismáticos*)
  and it wakes on trial, as Papagato does at Nuria's door, with one skill that plays with the
  light (a prism barrier, or holding an element for the next turn while the light eats it). Kept at
  the win. Needs a `/anima` round first.
- **G · Fran shorter**, about 14 rounds: fewer PV in the lamps' phase, the lamps' Brillo capped lower.

### What was built from the review (2026-11-16)

- **The way (A)**: zones in a fixed order round the crossing (recepción → sillones → carta → Fran; the
  ábside, once a fourth zone, is Fran's since 2026-11-20). Only the next zone's fight starts; the others' foes wait where they stand. Three queues of
  grey visitors behind black belts block the nave (x 23), the Passion arm (row 5) and the apse (x 50),
  each moving on when the zone before is won (`QUEUES` in `src/friends/luca.ts`, `story.blocked`).
  The recepción's fight is across the Nativity arm's mouth: nobody gets in without it. *Mirar la
  cola* says why they block.
- **Each side's light (B)**: `WALKS` in `src/vidrieras.ts`, a walk per side (nacimiento: blue,
  green, orange, white; nave: every colour; pasión: orange, red, green, gold, blue; ábside: gold, orange,
  gold, green). Each fight walks its side's (`LUCA_WALKS`), and the basilica's floor takes the light
  of the side Gerard is on.
- **The mirrors (C)**: three of the nave's mirrors turn a quarter at a time (`src/espejos.ts`, pure
  and tested). Only one way of the eight brings the north window's light down the aisle, along row
  12, down x 20 and along row 20 to the chaplains' chairs, two turns from how they start (three
  until the walk through it, below). Aitor notices the light coming into the nave. Solved, the chaplains start their fight Cegado
  (`dazzle`): the same fight with more PV left. Optional, and rewarded.
- **The apse as Fran's zone (E, 2026-11-20, Aitor)**: El Telescopio and La Laca are gone, and the
  apse with them as a fight. Its queue moves on once La carta is won; it keeps its own windows' light
  (`APSE` in `src/friends/luca.ts`, gold and orange) and Luca's lenses and star charts, and the first
  time it is walked into Gerard and Aitor name them (`LINES_LUCA.apse`). Los sillones is the three
  chaplains alone, a little tougher to stay what it was (capellanes 116 PV, Tijeretazo 29; `just fight-sim check`: with the answer 90 % · 37 % PV, without 19 %).
- **Fran shorter (G)**: about 14 rounds playing well (was 19).
- **The curve** (`just fight-sim check`, P2M2, Fran P3M3), smart wins with PV left · casual wins:

  | Fight | With the answer | Without |
  | --- | --- | --- |
  | Recepción (teaches) | 97 % · 53 % PV | 97 % |
  | Sillones | 94 % · 38 % (dazzled 97 % · 50 %) | 10 % |
  | Carta | 92 % · 30 % | 33 % |
  | Fran | 100 % · 50 %, 14 rounds (2026-11-19: 95 % · 52 %, 16 rounds) | 14 % (2026-11-19: 19 %) |

  New numbers: Estampados 75 PV, Estampar 9, Recolor 80 %; capellanes 92 PV; Tubo 54; Chispa 22;
  Fran 180 PV, acolytes 55, lamps 30. The carta stays the least clear pair (casual 33 %): the Passion
  light leaves fire useless for a long stretch, so it is partly a fight of endurance.

### The walk through it (2026-11-17)

Walked from the pond to Fran, fights aside, and looked at each place as the player sees it
(`just screenshots luca-exploracion --gpu`). What was wrong, and what was done:

| Walking it | What was done |
| --- | --- |
| Luca stood under a tree's crown, half hidden | He stands on the pond's north bank, clear of the trees (`PLACES_LUCA.luca`), his reflection on the water at his feet |
| Coming in, nothing said there was a salon further in | The camera turns down the transept to the crossing while Aitor and Gerard take it in (since 2026-11-19 three looks, `SALON_VIEWS`: § Told coming in) |
| The reception desk read as a black bench | A desk with its front to the door before a black wall with his name and the turn's number (nobody's), the appointment book, a bell, the turns' dispenser |
| The nave kept the church's wooden chairs, though Gerard says the salon's stand where they were | The basilica takes them away while the salon stands (`setPews`); in their blocks, mirrors back to back with a salon chair before each glass, a clearing left where the chaplains wait |
| The chaplains' hair was a cone, a party hat | Three ways of doing it, each in a colour of Luca's: a tall quiff in blue, lacquered spikes in orange, a hard parting in teal (`styleChaplain`), in the salon and in their fights |
| The queues were thin posts and skittles | Grey visitors in the game's block figures behind a belt, every one looking at Fran. A queue that has moved on keeps its two ends by the walls (`queueCells`): the way opens through its middle, and the camera turns to it as Aitor says so |
| The turning mirrors read as whiteboards, and nobody coming in from the crossing ever saw them or the light | Chrome frames, blue glass, a streak of light. The light now starts along the north aisle and ends against the wall by the nave's mouth (`MIRRORS_START`), and coming into the nave anywhere the camera follows it there. Two turns bring it to the chairs, each one moving the light in sight of who turned it: the second mirror sends it down to the third and out along the middle aisle to the presbytery's rope, the third to the chaplains |
| The light's shaft could not be seen under the vault | A thicker shaft, its stripe on the floor, a flare at each mirror, and its fall from the glass |
| The apse's lenses were lollipops, its charts specks | Lenses in brass rings on tripods, turned on the presbytery; painted star charts on easels |
| Fran stood sunk in the presbytery's steps, his chair and dryer hidden | He stands on it (`lift`), back to everyone; beside him his chair under a hood dryer of sixteen straight rods between two rings (a hyperboloid: *solo rectas, y sale una curva*) and his slate with the same curve in chalk |
| Gerard walked through the furniture | The desk, the dye bar, the lenses and the easels keep him out (`SALON_SOLID`) |
| Nothing to look at but the queues | One thing a zone (`LOOKS`): the appointment book (every hour, *Fran*), the dye bowls (Luca's colours, unused), one of his lenses (turned on the columns, not the sky) |

The salon is batched by material (one batch group), so its several hundred pieces cost a handful of
draw calls. No fight, foe or number changed.

### Told coming in (2026-11-19)

Aitor, playing it: coming into the basilica it was not clear what the mission is. The camera made one
wide turn over three lines of mood (*Huele a laca*), and none of them said who is in there, what the
queues are or what there is to take back. Now it is said by the two of them, in few words, with the
camera on what each line is about:

| Moment | The camera | What is said |
| --- | --- | --- |
| In through the door, the first time (`SALON_VIEWS`, `LINES_LUCA.inside`) | Close on Fran under the canopy | *Fran. Bajo el baldaquino, de espaldas a todo.* / *Huele a laca. Ha hecho de la basílica su peluquería.* |
| | The nave's queue | *Y toda esa gente gris hace cola para él. Por ahí no se pasa.* |
| | Close on the moths by the desk | *Polillas. Grises, como Luca.* / *Se le están comiendo el color. Lo que le falta está aquí dentro, a trozos.* / *Pues se lo sacamos. Trozo a trozo, hasta llegar a Fran.* |
| Walking up to a zone's foes, the first time (`ZONE_VIEW`) | Comes close to them while they are named | The zone's lines, as before (the reception's is now one, the light: the moths were shown coming in) |
| A zone won (`flyColour` in `src/game.ts`, the `colour` story effect) | Follows a light of the zone's colour as it rises where its foes stood and goes out of the Nativity door (`COLOUR_OUT`), then turns to the queue that moves on | *Azul. Ha salido por la puerta, hacia Luca.* It was said before and never seen |

Six short lines coming in, said by Gerard and Aitor: no panel, no objective. `just screenshots
luca-entrada --gpu`.

### Fran, the lamps as the question (2026-11-19)

Aitor found Fran's fight bland: three phases each repeating a zone's lesson, Fran the softest blow in
it (Corte 18 against a chaplain's 23), lamps of 30 PV that fell to one blow and then mattered no
more, and nothing in the rules about Luca's colour. Smart play won it with Atacar (43 % of the
damage) and Defender. Now the lamps carry the fight (§ Final boss): a lamp broken frees its light
(`lightFreed`, `lightEats` in `src/battle.ts`) and the Aspersión grows with every lamp still hanging
(`aspersionLamp`, `aspersionDown` per lamp). Numbers: Fran 150 PV (was 180), lamps 40 (was 30), Corte
22, he stands at 75 % (was 66 %). `just fight-sim` (P3M3): smart wins 95 % with half its PV in about
16 rounds, breaking all three lamps; casual 19 %. The sim counts `lampara-rota` and `anulado`.

**La carta de colores, rebuilt (2026-11-19, option B, Aitor's pick).** The Estampados read as
playing cards and the fight asked three things of colour at once. Now the foes are **three of Luca's
shirts on hangers** (red, blue, gold) and the fight asks one thing: *which one, now*.

- **Rule.** A shirt is hurt only in the light of its own colour (`shirtLit`, `lucaTaken` in
  `src/battle.ts`); out of it a blow does nothing (*Nada · Fuera de su luz*). The lit shirt wears its
  colour and print, the others are grey cloth (`lightShirt`, `src/luca-foes.ts`), and each plate
  carries *En su luz* or *Fuera de su luz*. Since that same light eats the party's element of that
  colour, the lit shirt is hit with something else. Gone: each shirt resisting its own element, and
  *Se recolorea*.
- **Reward.** A fallen shirt takes its light with it: the walk skips that colour from then on
  (`passFallenLights`), the element it ate is back for good (*Vuelve Fuego*), and the lights left come
  round faster, so the fight speeds up as it is solved.
- **Light.** The Passion walk is now red, gold, blue, 7 s each (`WALKS.pasion`): only the three
  shirts' colours, none wasted.
- **Told by.** Gerard and Aitor on walking in: «Esas camisas son de Luca.» / «Sin nadie dentro. Y solo
  una tiene color: la de la luz que hay ahora.»
- **Numbers.** 75 PV each, Estampar 18 (was 9, the fight no longer lasts on healing). `just fight-sim`
  (P2M2): reading the light wins 94 % with 29 % of its PV in 6.5 rounds; not reading it (the casual
  looks at the light three times in ten, `LIGHT_READ`) 22 %.

## Built (2026-11-16, `feat/side-mission-luca`)

- **Data**: `src/friends/luca.ts` (places, zones, every line), `ANIMAS.luca`, the flags, the `luca`
  arc and its picker parts (`just dev-mission luca <part>`: start, luca, door, recepcion, sillones,
  carta, abside, crucero, fran, won, done).
- **The light**: `src/vidrieras.ts`; `annulled` and `runLight` in `src/battle.ts`; the window icon and
  *Anulado* in `src/battle-ui.ts`; the basilica's floor and lights take the same colour while the
  salon stands (`setLight` in `src/basilica-scenery.ts`).
- **Foes and Fran**: the `LucaKind` group and the `LUCA` book in `src/battle.ts`, procedural models in
  `src/luca-foes.ts`, fight tester row *La peluquería*, `STAGED_MOMENTS` `fran-acolitos`,
  `fran-baldaquino`, `fran-aspersion`, `TARGETS` for every fight (all hold, `just fight-sim check`).
  Zone numbers: Polillas 28 PV, Estampados 100, capellanes 116 (2026-11-20, without La Laca); Fran 150,
  his acolytes 55, his lamps 40 (2026-11-19). Final pass (2026-11-21): Polillas 52 PV and three at
  most (`polillasMost`, they were five: fewer and each worth a blow), Aleteo 11, each Brillo .625 of
  a blow (`brilloStep`), Fran 14 Espíritu, and each fight its own growth (`FIGHT_GROWTH`,
  docs/fight-sim.md § The final pass, as done).
- **The place**: Luca by the pond (grey by the colours still missing, his reflection in colour lying
  on the water), the door gated until he is met, the salon dressed zone by zone
  (`src/peluqueria-scenery.ts`), each zone's foes waiting, the chaplain before the presbytery.
- **Clues**: the photo in the dining corner (`meridiana-foto-luca`, grey until the win), the ticker
  item, the tour poster on the Meridiana's second bus shelter (`clue-sagrada-cartel`).
- **Stand-in figures**: `src/characters/luca.json`, `fran.json`, `capellan.json` (from Uri's).
- **Tests**: `tests/luca.test.mjs`, `tests/luca-fight.test.mjs`, `tests/vidrieras.test.mjs`.
- **Screenshots**: `just screenshots luca --gpu` (the story and its fights),
  `just screenshots luca-exploracion --gpu` (the walk, fights aside) and
  `just screenshots luca-entrada --gpu` (the mission told coming in, a colour going out).

## Open

- Luca's phrase, his day, what he was like as a kid (the second round).
- Colorista's wearable form: built (`docs/animas/prismatico/README.md`, 2026-11-21). Its trial
  inside the salon is not.
- Luca's photos and Fran's toy image.

## Implementation plan

Each step is one commit on `feat/side-mission-luca`, playable, with `just check` green.

1. **Docs**: this doc, `docs/chapter-2.md`, `docs/story-outline.md`, `docs/lore.md`.
2. **Data and flags**: `src/friends/luca.ts`; `ANIMAS.luca`; flags `clue-luca-foto`,
   `clue-sagrada`, `clue-sagrada-cartel`, `sagrada-luca`, `peluqueria`, `fran`, `anima-luca`,
   `luz-luca` (`STORY_FLAGS`, `server.py`, justfile); `LIGHTS`; `SPEAKERS`; the `luca` arc in
   `STORY_ARCS` and its picker parts; `MISSIONS.luca`.
3. **The light**: `src/vidrieras.ts` (pure cycle), `BattleState.light` advanced in `runClock`,
   cancelled party blows in every damage path, the *Anulado* pop and the plate icon.
4. **Zone foes**: the `LucaKind` group, its four encounters, rules, profiles, book, affinities,
   models (`src/luca-foes.ts`), fight tester, `TARGETS`.
5. **Fran**: the boss, its phases and lamps, `STAGED_MOMENTS`, `TARGETS`.
6. **The place**: Luca and his reflection outside, the door, the salon dressing by zone inside,
   the walking light on the floor, the chaplain gate.
7. **Story**: clues, lines, zone wins, the win, hours; `tests/luca.test.mjs`.
8. **Screenshots, docs, report**: `scripts/screenshots/luca.json`, `docs/combat.md`,
   `docs/progress.toml`, the report page.

Not in this pass: Colorista as a wearable ánima, 3D figures and portraits, the second round.
