# Nuria y Uri · Cardedeu (working title)

Status: building on `feat/nuria-mission` · steps 1–13 done (step 4 without the 3D model); foe abilities, Vertitrón and the dual attacks on `feat/side-mission-nuria` · Last updated: 2026-11-05

## Summary

**One mission, Nuria and Uri together** (decided 2026-11-01): *Misión de Nuria y Uri* in the
picker, one household and one ánima (`ANIMAS.nuria`, friend *Nuria y Uri*); the old `uri`
placeholder ánima and its arc are gone.

Nuria waits for Gerard and Aitor at the door of her building in Cardedeu, with Haru and Yuki at
her side. Uri, her partner, who never talks, has become a kid again (a bit wild, but a kid): he
won't stop talking and has run off down the street with Nil, their baby. Nuria wants to save
him and lends Gerard the cats: **Papagato** wakes up there, before the end, and Haru and Yuki
fight with the party through the mini-dungeon. Win, and Papagato stays with the party and the
cats come home with Gerard; give up, and they go back to Nuria. Round the corner the street turns into a mini-dungeon (a puzzle and a final boss). Nuria's
ánima is **Papagato**: it brings Haru and Yuki, the cats, to fight with the party.

## Protagonist

- Who: **Nuria** (the protagonist), with **Uri** (her partner) and **Nil** (their son), who go
  together in the mission.
- Relation to Gerard and Aitor: close friends; **Nuria, Gerard and Aitor lived together** for a
  while. That is why **Haru and Yuki**, the cats who live with Nuria, are Gerard's cats too.
- Nil: **under a year old**. Nuria has just become a mother, and that has changed routines she
  used to share with Gerard.
- Job and routine: _open_ (now shaped around the baby)
- Unmistakably them (phrase, habit, hobby):
  - **Uri**: very quiet (which is why him talking non-stop is the first sign something is wrong).
    **Afraid of heights.** Won't try new food; **hates onion**. **Loves video games.** **Very
    loyal.** Nuria usually leads, and he doesn't always get to be fully himself.
- As a kid: _open_

## Place

- Where: **Carrer de Jacint Verdaguer, Cardedeu**, between Carrer del Doctor Daurella (north)
  and a Passeig (south). Nuria's home is the **long two-storey block with the reddish tiled roof**
  on the west side; her door is the first one (number unknown). Nuria waits **downstairs at her
  door**. Round the corner, the mini-dungeon. Aerial reference:
  `assets/references/environments/cardedeu-jacint-verdaguer/aerial.png` (local).
- Around it (aerial): a narrow one-way street with cars parked on the east side, zebra crossings
  at both ends; on the west, a long two-storey block with a hipped terracotta roof, a small house
  with a white roof and a garden at the north corner, a grass plot behind; on the east, terraced
  houses with yards and a big tree over a walled garden.
- How to get there: Rodalies R4 from La Sagrera (the clue on the TV ticker already points there).
- Scene: needs `just geo cardedeu` around the real address; the mini-dungeon is hand-designed.

## The problem

- What the Queen did: **turned Uri into a kid again** (decided). He talks non-stop (he never
  does), plays, runs, a bit wild but a kid, always **with Nil in his arms**. His eyes are
  **violet**: the Queen's hold on a person (animals she possesses go dark pink and attack; a
  person goes violet and turns kid). It plants the twist: she gives childhood back by force.
- How it shows: no literal bubble needed; the Queen's touch is enough (her pink at the edges,
  a bubble rising from a manhole, a wrapper on the pavement). Proposal.
- Nuria's own loss: **none** (decided). She is not lost; she wants Uri back and helps. The
  routine-vs-ilusión thread is carried by Uri (and later by the second round).
- How they are lost without it: _open_
- Routine vs. ilusión, here: _open_

## Clues

| Clue | Where | Flag |
| --- | --- | --- |
| *"La R4 se amplía desde La Sagrera hasta Cardedeu"* | TV ticker at home (done); La Sagrera's platform (to do) | `clue-r4` |

## Unusual things

- Uri's violet eyes, Nil in his arms, never still.

- Uri talks and talks (he never does), like a kid.
- Uri has run off down the street with Nil (proposal: racing the pushchair like a go-kart).
- Past her block, the street becomes *La calle que no acaba*, and at its end a bubble opens onto
  the mini-dungeon.

## La calle que no acaba

Decided with the user (2026-11-01): the unease starts **while Nuria tells them about Uri** and
grows **as they go up the street**; realism does not matter here.

- **Nuria's telling** (`LINES_NURIA.nuriaFirst`): not just "he talks a lot". Uri called her
  «señora» and asked if her son could come down to play, counted cars at the window for an hour
  laughing to himself, took Nil «como quien coge un muñeco» saying «Vamos a jugar a que no
  volvemos», went down the street barefoot, and the street **stretched out behind him** as she
  watched. Aitor has nothing to say (`…`). Asked again, she adds: «Y no miréis los números de las
  puertas.» From then on a little of the Queen's light hangs over her street.
- **The street** (`cardedeu-calle`, a designed zone written by a script from its rules into
  `assets/geo/cardedeu-calle/`): lent, Haru goes on ahead up the street to the corner of Doctor
  Daurella, where Uri ran (`story.guide`, src/guide.ts), looking back when they fall behind, with
  Yuki at the back of the party behind Aitor.
- **Her street turns into it, with no cut** (`src/street-shift.ts`, `SHIFT` in
  src/friends/nuria.ts; decided with the user 2026-11-05: no sudden switch, no choice left). Once
  they have been at her door, walking up the street makes **houses rise out of the ground**, in
  her house's look or the row's, with dust and the ground shuddering, each where they can see it:
  across the street behind her door (the way back to the station), in the gardens on the right,
  then on both sides of Doctor Daurella. Each waits until nobody walking with them would be shut
  out. With every way but on shut, **the corner unrolls**: what stood beyond it sinks, the
  street's own start stretches out over it from the crossing, and its houses are born one after
  another away from them (it is La calle's own piece, laid over her street cell for cell); then
  they say the corner is gone (`LINES_NURIA.calle`, the first time). Well inside, out of sight of
  the crossing, they are in La calle itself, at the same spot and with the camera where it was
  (`setEnvironment`'s `exact`). Coming back to Nuria (*Volver con Nuria*) finds her street as it
  was; it changes again each time they walk up it from her door. Each house rising rumbles and
  grinds up out of the ground and lands with a thud, what sinks rumbles down, and the corner
  stretches out with a long groan, each from where it stands (`rise`, `sink`, `stretch`,
  docs/audio.md § Effects).
- **The street itself**: Jacint Verdaguer as Uri's fear bends it: **one way only, straight on**, no corner, no crossing. Nuria's house repeats
  on the left with a **1 on every door**, the same white car along the right kerb; the houses grow
  (two storeys to four) and the fronts close in (from 6.5 m to 4 m each side) as it goes; the colour
  drains in four steps from Nuria's lime white to the grey of an old photo, then to her violet dusk.
- **The further up, the worse** (`src/street-unease.ts`, pure and tested): how far up the street
  the party is (0–1) brings in the Queen's light (`streetTone`), closes the screen's edges in, grey
  then violet (`#hud[data-uneasy]`, `--unease`), and past 70 % the edges beat slowly. Aitor says what
  he notices over his head, once each, as they get that far (`STREET_MARKS`): the same house, the
  1 on every door, no birds, the houses growing, the way back gone.
- **The bubble** at the far end (the characters still call it *la pompa*; `src/fear-portal.ts`): a
  tall whirlpool in fear's violet, arms of light spiralling into a dark well, its edge fraying,
  violet streaks drawn in round it and motes rising off the street into it, a violet light on the
  houses. Drawn whole on the GPU (one shader quad and one instanced draw of particles whose paths
  come from the clock), it turns faster and burns brighter as they come, on its own clock, so a
  step closer only speeds it up. It hisses (`BEDS.hiss`, docs/audio.md § Sounds that go on): from
  about 32 m away, louder and turning faster as they come, quiet in a menu. The first time it comes
  into sight they talk about it and Uri laughs from inside (`LINES_NURIA.portal`);
  walking up to it takes them into the tower, anywhere across the street and with nothing to press.
  *Volver con Nuria* at the street's start always
  takes them back; out of the tower they come out in front of the bubble.

## The tower (mini-dungeon)

Redesigned with the user (2026-10-25): not a flat maze but **La torre de Uri**, a dark tower that
rises round the corner of Nuria's street, and a **ramp that spirals up round it**, ring inside
ring, to a platform on top where **Vertitrón** stands, a robot with an eye in its chest, with **Uri
and Nil on top of it** (§ Final boss). Theme: **fear**; lighting dark (the Queen's
violet haze, black-violet walls always higher than you, a few violet lanterns, a soft light that
goes with Gerard), and the screen's edges close in, beating like a heart while something chases.

- **The climb** (`src/tower.ts`, pure, tested): widened with the user (2026-11-01) to **three
  rings, one per fear, five cells wide**, each climbing 2.8 over the last; every wall has a
  three-cell gap on the camera's side and a short wall across each corridor beside it, so each ring
  is walked all the way round, turning one way then the other. The ramp rises evenly with the
  walking distance (no steps) up to the flat platform. Drawn as merged meshes
  (`src/tower-scene.ts`); feet follow it (`scenery.addSurface`).
- **Uri waits at the top from the start**, on Vertitrón with Nil, and is never on the ramp. From
  the first ring nothing can be seen up there; from the second Vertitrón shows as a faint violet
  shadow; from the third it is itself, Uri on top (`ringOf`, `game.ts`). Going through each ring's
  way up, Uri shouts down from the top (*"¡Nivel dos! ¡Más arriba!"*, *"¡Nivel tres! ¡El último!"*,
  *"¡Arriba del todo! ¡Desde aquí se ve todo Cardedeu!"*, `LINES_NURIA.shouts`). **Everything Uri says
  in the tower is a shout and never stops the game** (decided with Aitor 2026-11-05; they used to be
  conversations): going in (*"¡NIVEL UNO! ¡Estoy arriba del todo! ¡Si me pilláis, ganáis!"*,
  `LINES_NURIA.mazeIn`), up out of each ring, and onto the platform (*"¡Jefe final! ¡Vertitrón, a por
  ellos!"*, `LINES_NURIA.roof`), where Vertitrón's fight comes in a moment and a half later (`beat`)
  with no conversation before it. A jagged shout bubble in the fear's violet over Uri
  (`#shout-bubble`, the story effect `shout`, `storyUI.shout`), with a zigzag tail towards him;
  when he is above the screen it hangs from the top edge with its tail pointing up. The ring's way
  up and the platform are `passing` triggers, so Gerard walks on through them; a fight ends a shout.
  `just screenshots uri-shouts`.
- **Uri's fears hunt the ramp** (`src/chasers.ts`, pure, tested): El Cebollón (ring 1), El Plato
  Misterioso (ring 2) and La Cebolla y los suyos (ring 3) walk their stretch; when one sees Gerard (close, nothing
  in between) it runs at him; out of sight for a while it gives up and walks back; when it reaches
  him its line plays and the fight starts. Beaten, it is gone; fled from, it rests a few seconds.
- **Their young** (decided 2026-11-01): three packs a ring chase the party too, one along each side
  the climb goes round and one by the ring's way up, drawn as three small copies of the ring's fear.
  They jump in without a line; beaten, they are back on their round 40 seconds later, out of the
  party's sight (`respawn` in `FEARS`), so the climb never gets quiet. On ring 3 a pack now and
  then comes up mixed, a big onion with its young (*Monsters*).
- **Fights on the ramp go to a pocket of the tower** (`src/arena.ts`, `src/pocket.ts`, tested on
  every ramp cell; docs/combat.md § Dónde se planta un combate): five cells between walls 2.6 to
  5.4 high leave no room to line up and be seen, so when a fear or a pack catches the party the
  picture breaks into glass and the fight goes on in the same stretch of corridor (or corner)
  widened by four cells or more, in the ramp's stone and the walls' brick, the tower's cypress
  pots where they stand and the lanterns' violet light, and back onto the ramp when it is over. Vertitrón fights on the summit itself, in the middle of the platform (`PLACES_NURIA.summit.stage`, where it stands), further back than other foes and seen over the party's shoulders, nearly from the front (docs/combat.md § Dónde se planta un combate, `fightCamera`). The fears fight
  a little smaller than in the open (×1.05; the young ×0.62), except the onions, whose size is their layers.
- The fears' rules in a fight are below (*Monsters*); the boss is *Final boss*.

**Monsters** (abilities redesigned 2026-11-05):

- **Every foe action is an ability** (`FOE_ABILITIES` in `src/battle.ts`, `BattleEffect.ability`),
  but **the fight never shows its name** when it is used, neither over the foe nor under the blow's
  number: what it does is seen in the scene. A move announced a turn ahead (`BattleEffect.telegraph`)
  sets the foe's `intent`, a chip on its plate beside *Capas n* and the dish that **names whom it
  looks at** (*Carrerilla → Aitor*). Targets in these fights are fixed by the turn order, so the
  name is exact. The first time something happens a companion says one line in a bubble; there
  are no panels.
- **Rules go by kind, never by ánima**: a blow or a tick, physical or magic, layers. Nothing checks
  who wears what. **A dual counts as every kind** (§ Dual attacks): the better side of a dish,
  whole through Transparente and on the surprise dish. Sangrado ticks and Quemado pulses go round
  every foe rule below.
- **The onions** (he hates onion; `ONIONS` in `src/battle.ts`): one rule at three sizes. While it has
  layers (*Capas n*) a hit only peels one off and lands at half, and everyone cries (*Llorera*). **Every
  layer adds weight to its blow**, so it hits very hard until it is peeled, and ends up weak. In the fight
  each layer lost flies off in pieces (`src/onion-peels.ts`), the one under it shows in another colour
  and the onion stands a step smaller, down to small and pale with none left.
  - **Cebollita** (1 or 2 layers): the easy one, in packs (*Their young*, below). Where Papagato grows.
    Its blow is *Lagrimilla* (Llorera on whom it hits) while it has layers. **Capa nueva**: once, on
    its first turn peeled and still standing, it spends the turn wrapping itself in a new layer (no
    blow). Finish what you peel.
  - **La Cebolla** (8 layers, two of them walk rings 1 and 2, back a while after they fall): at level 1
    it is won by a hair, if at all; at level 2, comfortably.
  - **El Cebollón** (10 layers, ring 1): at level 1 it kills them in about five rounds, whatever they do;
    at level 2 it can be beaten.
  - **Peso** (both big ones): its blow on one, half of it splashing everyone else while it has
    layers, and Llorera on everyone.
  - **Carrerilla → Aplastón** (both big ones): on its own 3rd turn and every 4th after
    (`FEAR_RULES.aplastonFirst`, `aplastonEvery`), still layered, it does its Peso and then rolls
    back and looks at someone (*…y rueda hacia atrás: mira a Aitor.*). On its next turn, if it still
    has layers, **Aplastón**: 1.5 times its blow on that one alone, no splash, Llorera on everyone.
    Peeled by then, the run-up comes to nothing (*Pelada, ya no pesa*). The answer: whoever it looks
    at holds on (Defender takes two thirds off and gives maná back), or the party peels it that
    round (every layer off is weight off). Over a round it hits about as hard as a Peso with splash,
    so the onions' tuning keeps its shape; reading it is what saves PV.
  - **The dynamic** (decided 2026-11-05): one hit a layer is too slow for the big ones, so they have to
    level Papagato up on the little ones until it learns **Zarpazos** (level 2): four little claws, a
    layer each. Holding on does not answer them, since a big one's weight also reaches everyone else
    (half the blow, while it has layers), and fire does not either, since wet layers do not catch.
    Aitor says so as the Cebollón comes (*"no la pelamos ni en una semana"*) and Nuria when they come
    back after falling. Tuned and held there with `just fight-sim` (`docs/fight-sim.md`).
- **El Plato Misterioso** (ring 2; he won't try new food): 230 PV, its blow power 16. A different
  dish each round under its cloche, shown all through the party's round: **una alcachofa** (blows
  ×1.5, magic ×0.5), **una coliflor** (the other way round), then **la sorpresa** (*algo que nadie
  sabe qué es*). On the surprise every single blow, Atacar or a skill, lands at half; a dual lands
  whole. On its surprise turn it does **¡Puaj!**, its blow on everyone (Defender takes two thirds
  off); then it changes dish (**Cambio de plato**). The rhythm: blows, fire, then hold on, statuses
  or a dual.
- **La Cebolla y los suyos** (ring 3's fear, `escolta`; replaced Game Over on 2026-11-05): a single
  hunter that walks Game Over's patrol and does not come back. **La Cebolla half peeled** (5 layers,
  `FEAR_RULES.escortLayers`; its first run-up a turn later, so the Aplastón lands in round 4,
  `escortAplastonFirst`), **a fantasmita** and **a cebollita** with one layer clearing the way for
  it. Each asks its own question: peel and brace the onion, finish or brace the fantasmita before
  its «GAME OVER», leave the cebollita for last but not peeled. The toughest test before the summit:
  it asks for an order. *«La Cebolla sube por la rampa, y no viene sola…»*; beaten, *«…Arriba, Uri
  ya no se ríe.»* Its EXP is its three foes' (35 + 14 + 10).
- **Their young** (`BROOD` in `src/battle.ts`): a pack is two or three, at least one of the ring's
  own and the rest at random from its ring and those below (ring 1 cebollitas; ring 2 platitos and
  cebollitas; ring 3 all three). Little PV but they hit hard, except the cebollitas, which are easy on
  purpose: ring 1's packs are where Papagato grows. **On ring 3, about one pack in three
  (`FEAR_RULES.mixChance`) comes up mixed**: a cebolla with 3 layers (`mixLayers`) and one or two
  young (*«Esta vez no vienen solos.»*), so the big ones and their young meet on every lap, not only
  in the escort. Each kind asks for its own answer:
  - **Cebollita**: a layer or two; while it has any, its blow makes its target cry (*Llorera*), and
    peeled it grows a layer back once (*Capa nueva*, above).
  - **Platito**: a dish of its own, an artichoke (weak to blows) or a cauliflower (weak to magic),
    shown over it; its blow is *Salpicón*. Read it and choose. **Darle la vuelta**: once, on its first
    turn at half its PV or less, it spends the turn flipping its dish, weakness and all. Finish it in
    the round you hit its weakness, or switch kind.
  - **Fantasmita**: counts down on its turns (*Atravesar*, *«2…»*); at zero «GAME OVER» hits everyone
    hard and it starts again. Finish it first, or hold on (Defender takes two thirds off).
    **Transparente**: while its count shows 1 it goes see-through and physical blows land at half;
    magic and duals land whole. After its «GAME OVER» it is solid again.

## Beats

1. Arrival: R4 to Cardedeu; Nuria waiting downstairs at her building, Haru and Yuki at her feet.
2. She tells them about Uri and Nil and **lends them the cats**: Papagato wakes up (ÁNIMA
   DESBLOQUEADA) and the mission is accepted. From here on, Haru and Yuki go with the party.
3. They follow Uri up the street, which turns into *La calle que no acaba* (above) and ends in a
   bubble; through it the street turns into a **maze that gets harder as they go**, and **monsters burst out of places** along the way: things from Uri's
   childhood and his **fears**. The goal is to reach and catch Uri (puzzle + the mission's own
   dynamic). The theme of the whole mini-dungeon is **fear** (decided).
4. Boss: **Vertitrón** on top of the tower; Uri beats his fear (see *Final boss*).
5. Win: Uri is himself again, Nil safe. **Two lights** leave Nuria and Uri and go one into Gerard
   and one into Aitor, and the party's **Ecos de luz** count goes up with each (see *The lights*). Then
   the banner **ÁNIMA DESBLOQUEADA · Papagato**, with a cat's paw prints walking up onto it:
   Papagato stays with the party for good, and **Haru and Yuki come home**: from then on they live
   in the Meridiana flat too.

## The lights

Decided with Aitor (2026-11-05; round 11 had a third, Nil's, out of Uri's chest and split in two):
the mission gives **two lights, Nuria's into Gerard and Uri's into Aitor** (Nil goes in Uri's arms).
They are lore first (what makes each of them who they are, an *ánima* in the lore's sense,
`docs/lore.md`) and the party's **Ecos de luz** to spend.

- **The moment** (the animation, reusable for every friend): one person at a time, their body
  gives a **mini flash** (a quick white pulse over the whole model, a soft ring on the ground), a
  small glowing light rises out of their chest, hangs for a breath, then arcs through the air with
  a short trail and **goes into Gerard or Aitor**, who flash briefly as it enters (and their
  vitals plate ripples, `flashAnima`). Nuria's into Gerard, Uri's into Aitor (with Aitor not
  there, both into Gerard): one light each, never more (`releaseLights` in `src/game.ts`).
- **Kept at home**: the first time they get home afterwards, the lights leave Gerard and Aitor and
  settle into a glass jar on the living room shelf (proposal: *el bote de las luces*). Grey in the
  first round, as the lore says.
- **Count, never names**: the jar shows one marble per light, lit while free and dark once in an
  ánima, so anyone can see how many there are. No names, no labels.
- **The Ecos de luz** (decided 2026-11-05, Aitor; first called *ánimas*, renamed the same day because
  it clashed with the ánimas worn in a fight): the lights are the party's **Ecos de luz**, put into the
  ánimas and taken back at the jar (`docs/animas/README.md` § Ecos de luz; final bosses dropping one
  too: `docs/ideas.md`). A chip beside the menus' buttons (`.anima-count`, `storyUI.animas`,
  `showAnimas` in `src/main.ts`) shows an amber light, like the jar's, and how many are free; it shows
  up with the first one won and goes up as each light goes into Gerard or Aitor (not when the fight
  ends). It is something the party *has*, so the HUD rule allows it.
- **Not for a day** (2026-11-05, Aitor): a light let out held the Queen back a day (*Usar una luz*); gone.

- **Freedom always** (decided): they can leave, go home and come back as often as they like, but
  nothing is kept until it is won: leaving hands Papagato and the cats back to Nuria, who waits
  downstairs again. One of the first missions most players will do, but the order stays open.
- **Falling in the mini-dungeon** costs nothing (decided 2026-11-05): the lost screen offers
  *Reintentar el combate* (the same fight from the start) and *Volver a antes del combate* (the
  fight never happened; the fear that caught them rests a few seconds before it hunts again).
  Only chapter 2's castle is strict: falling there wakes Gerard at home (docs/chapter-2.md).

- Own mechanic, and how it is taught: **a maze of Uri's fears that grows harder**, with
  monsters that ambush from places that warn first (see *The maze*).
- Diegetic gates: _open_
- Aitor's moments: _open_
- Hours spent: _open_ (2–4)

## Final boss

**Vertitrón** (Uri's fear of heights; internally `vertigo`, encounter `uri-vertigo`). Designed by
Aitor on 2026-11-05, replacing the earlier El Vértigo (a giant of ladders with an Altura rule, eye
pips and a hand that reached for Nil), which played as unreadable: every rule now shows as a target
with its PV, a chip that names the move and whom it is for, or a line. Every number is in one
tunable book, `VERTIGO` in `src/battle.ts` (`just fight-sim`, book `vertigo.boss`), with its PV in
`PROFILES.vertigo` and its eye's in `PROFILES['vertigo-ojo']`.

- Where: the top platform of La torre de Uri. Uri has climbed up playing and stands on top of it,
  Nil in his arms.
- Look: **a robot** of the tower's materials, **with an eye in the middle of its chest where
  particles spin**. Smaller than the old giant, so that **Uri and Nil are clearly seen on top**.
  **Uri's eyes are violet** and glow like the possessed dogs' at the start of the game. It never
  wobbles like the gum creatures (`rigid` in `src/battle-scene.ts`; `just screenshots vertigo`).
- Numbers: 360 PV; its eye 100 PV.
- **Uri shouts its moves**: each move's name comes as a speech bubble over Uri, in the fear's
  violet, as if he were playing a video game (*«¡Pisotón!»*, *«¡Barrido!»*, *«¡Grito liberador!»*,
  *«¡Cargando rayo terrorífico!»*, *«¡Rayo terrorífico!»*; `shout` in `src/battle-ui.ts`).

**Its moves**, always in this order, round and round (`VERTIGO_TURNS`):

| Turn | Move | What it does |
| --- | --- | --- |
| 1 | **Pisotón** | Stomps on Aitor or Gerard: power 22 on one. |
| 2 | **Barrido** | Sweeps its hand across the roof: power 14 on both. |
| 3 | **Grito liberador** | The party's Fuerza and Magia −2 and its own +1, **for the rest of the fight**, adding up with every shout. |
| 4 | **Carga** | Its eye charges for a turn, no blow; the chip *Rayo terrorífico → todos* shows on its plate. |
| 5 | **Rayo terrorífico** | The eye sweeps both with a beam: power 32, magic, on both. |

Defender takes two thirds off any of them, so the charged turn is the one to hold on.

**The eye** (`vertigo-ojo`, *El ojo de Vertitrón*) is a second target, **optional**: a part of it
(`part`) with its own PV, no turns, no EXP, and it never holds up the win. **Broken, Vertitrón can
no longer charge nor fire the Rayo** (*«¡El ojo de Vertitrón se apaga! Ya no puede lanzar el Rayo
terrorífico.»*); a charge under way is called off. From then on its turns are Pisotón, Barrido and
Grito liberador. Fire and bleeding break it too.

- The choices: break the eye (100 PV spent on something that brings no win closer, but no more
  Rayos), or race the body before the Gritos add up; and hold on when it charges.
- Win: *«Vertitrón cae de rodillas. Uri baja con Nil en brazos, y el violeta se le va de los ojos.»*
  It drops to its knees, and Uri and Nil come down, safe.
- Measured with `just fight-sim` (`TARGETS`, `vertigo-*`): with the duals found, the smart bot
  beats it in about 5 rounds with three quarters of its PV; without duals in about 13, with a third;
  the casual bot wins a bit more than half; only Atacar always loses. **Grito liberador is what
  decides it**: a long fight turns on how many times it shouts.
- Code: `Encounter` `uri-vertigo`, `FoeKind` `vertigo` and `vertigo-ojo`; its turns in
  `vertigoTurn`, the eye breaking in `checkEye`, the lasting stat changes in `Combatant.lasting`.
  Picker moments (`STAGED_MOMENTS`): *Rayo cargado* (`vertigo-carga`), *Tras dos gritos*
  (`vertigo-grito`), *Ojo roto* (`vertigo-sin-ojo`). Tests in `tests/nuria.test.mjs`.

## Dual attacks

Built 2026-11-05 (`DUALS` in `src/battle.ts`; the rules in `docs/combat.md` § Ataques duales and
`docs/animas/README.md` § Combined skills). Two skills of Matemágico and Papagato, one from each
fighter, become one action: **Zarpazos de fuego** (Foc Binari + Zarpazos) and **Punto débil**
(Ángulo exacto + Zarpazo sangriento). Neither exists at level 1: the first is possible once Papagato
reaches level 2, the second once Matemágico does, so both come up in the tower.

- **How they are found**: by surprise. Nothing glows, nothing is listed, there is no hint. With two
  players, the one who acts later in the round can choose ahead in their own dock while the other
  chooses; when the earlier one picks the skill whose other half the later one has chosen, the
  banner *ATAQUE DUAL* comes up at the top while they aim, with its name, who brings which half and
  its combined maná; confirming sets it off: black bars close in, time slows and the two ánimas play
  it out (with Aitor on Papagato he acts first, so Gerard is the one choosing ahead). Each dual
  goes off once a fight. Two players trying things at once is how it happens.
- **Aitor wears Papagato only if it was put on him before the fight** (an extra slot on the
  Ánimas page). Papagato never changes person during a fight, and the maná stays each wearer's. If
  nobody wears it, Haru and Yuki sit the fight out behind the party.
- Where each one pays off here: Zarpazos de fuego peels a big onion bare in one go and burns what has
  no layers left; Punto débil makes the next blow triple, so the other fighter's big hit (or the
  next dual) lands on the mark. Against Vertitrón they end the fight before many Gritos. On El Plato a dual takes
  the dish's better side and lands whole on the surprise; through a Transparente fantasmita it lands
  whole.

## Ánima

- Name: **Papagato** (Nuria's ánima). Colour: grey → _open_ in the second round.
- When: lent at the start of the mission (on trial); kept for good only when the mission is won.
- Party bonus (`ANIMAS`): _open_ (placeholder in `src/animas.ts`: Magia +1, Espíritu +1, PV +10)
- Brings: the wearable ánima **Papagato**, designed in `docs/animas/papagato/README.md`. Decided:
  the cats are **not controlled**; they sit beside the wearer and every skill (and every skill it
  learns as it **levels up**) is something **Haru** (tricolour, bold) or **Yuki** (white, fearful)
  does. Signature: **Sangrado**, a stacking bleed that grows, and skills that cash it in
  (*Zarpa en la llaga*).
- Look, motto, interface theme: _open_ (in `docs/animas/papagato/`)
- World key it opens: _open_

## Second round

Kept simple (decided): the whole family is together downstairs at their door (Nuria, Uri with
Nil, Haru and Yuki if they are not at the flat), free of the Queen's hold, and they propose a
**new plan**: a small change to how they used to do things. Gerard says yes, and Papagato takes
its colour. Which plan exactly: _open_ (one line of dialogue, no new mechanic).

## Assets

Photos are in `assets/references/characters/` (local, ignored by git): `nuria/`, `uri/`, `nil/`,
`haru/`, `yuki/`, and `group/` (the family selfie; the old flatmates with both cats). Pair photos
sit in both people's folders, so each `--description` says who is who.

Descriptions drafted from the photos (proposals, ready to paste):

- **Nuria**: `Woman in her mid-thirties, slim, long dark-brown wavy hair worn loose or half up, dark brown eyes, freckles, wide warm smile, a small silver hoop in her nose and several small silver hoops in her ears. Cream knit top with navy and red horizontal stripes, light jeans, white trainers. She is the woman in the photos.`
- **Uri**: `Man in his mid-thirties, medium build, short dark-brown hair, short trimmed dark beard, brown eyes, calm friendly half smile. Plain white T-shirt with a small red heart on the sleeve, dark jeans, grey trainers. He is the man in the photos.`
- **Nil** (procedural, in Uri's arms): baby of about eight months, chubby, short dark-brown hair,
  big dark-brown eyes, a big gummy smile, a white onesie with little green crocodiles and a blue
  bandana bib.
- **Haru** (procedural): slim short-haired dilute calico: grey and soft orange-cream patches on the
  back and head, an orange-cream blaze on the forehead, white chest, belly, paws and muzzle,
  green eyes.
- **Yuki** (procedural): plump long-haired fluffy white cat, pale grey at the base of the tail,
  pink ears, sleepy half-closed eyes.

| Who / what | How | Photos | Description | Portrait | Expressions | 3D | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nuria | `just character nuria` | ✓ 5 | ✓ | ✓ | `preocupado`, `riendo` | ✓ generated primitives | ✓ |
| Uri | `just character uri`; violet eyes by recolouring `Ojo` in code | ✓ 4 | ✓ | ✓ | `riendo`, `sorprendido`, `crio=…` | ✓ generated primitives, Nil in his arms | ✓ |
| Nil (baby) | `just character nil`; in 3D, part of Uri's model | ✓ 2 | ✓ | ✓ | `riendo`, `sorprendido` | in Uri's arms | — (he does not speak yet) |
| Haru | Procedural cat (`src/cats.ts`) | ✓ 3 | ✓ | | | — | |
| Yuki | Procedural cat | ✓ 2 | ✓ | | | — | |
| Cebollón, Plato Misterioso, La Cebolla y los suyos, Vertitrón and its eye | Procedural | — | in this doc | | | — | |
| Cardedeu, Jacint Verdaguer | `just geo cardedeu` (zone to create) | aerial ✓; facade and door to come | | | | | |
| La Sagrera platform, R4 on the map | Scene + `src/transit.ts` | — | | | | | |

Commands (only `--dry-run` is free):

```bash
just character nuria --description '<Nuria above>' --dry-run
just character nuria --description '<Nuria above>' --only portrait     # OpenAI; review public/portraits/nuria.png
just character nuria --description '<Nuria above>' --only expressions fullbody model --expressions preocupado riendo
just character uri --description '<Uri above>' --dry-run
just character uri --description '<Uri above>' --only portrait
just character uri --description '<Uri above>' --only expressions fullbody model --expressions riendo sorprendido 'crio=grinning like a mischievous kid, wide eyes'
```

## Converge check

Read as a player, where they could get stuck, and what the world does about it:

- **From Cardedeu station to Nuria's street**: the zone may not reach the station. Haru waits at
  the station exit and trots off towards Jacint Verdaguer, looking back (a cat as a guide, no
  arrow); Aitor: *"¿Esa no es Haru?"*.
- **The first ambush**: before the first one, Uri shouts from ahead *"¡Cuidado con los
  contenedores, que muerden!"*, then the first bin lid rattles in plain view.
- **Vertitrón**: Uri shouts every move's name from up on it, so what is coming is heard before it
  lands. The second time its eye charges, the partner of whoever acts first says *"Ese ojo… si lo
  rompemos, a lo mejor deja de disparar."*; when it breaks, Aitor: *"¡Se le ha apagado el ojo!"*
- **El Plato Misterioso**: each food is drawn big and Gerard names it (*"¡Es una alcachofa!"*), so
  the weakness can be read without a panel. The surprise, Gerard: *"¿Y eso qué es? Así, uno a uno,
  no hay quien se lo coma."*
- **The tower's foe abilities**: none is named when it is used, and an announced one shows as a
  chip naming its target. The first time: an Aplastón coming, the other
  fighter says *"¡Aitor, agárrate!"* (or *"¡Gerard, agárrate!"*); a platito flipping, Gerard: *"¡Le
  ha dado la vuelta! Ahora es una coliflor."*; a fantasmita gone see-through, Aitor: *"¡Le paso la
  mano a través!"*
- **Dual attacks**: never hinted. Two players choosing at the same time find them; once seen, the
  banner says which two skills made it, so it can be done again on purpose.
- **Leaving**: at the station Aitor asks before they go; the line says what is lost.

Balance: it is one of the first missions, so every fight is tuned for Gerard and Aitor with
Matemágico and Papagato and no friend ánimas, with `just fight-sim`: at level 1, except the big onions,
which ask for Papagato at level 2 on purpose (*Monsters*). The tower's fears, the escort and
Vertitrón are measured with Gerard on Matemágico and Aitor on Papagato (`gerard:matemagico+aitor:papagato`,
both at level 2) next to the mission's own party, and must be won by thinking and lost often
without it (`TARGETS` in `src/battle-sim.ts`, `docs/fight-sim.md`). Other quests: none yet, nothing
repeated.

## Open

- Nuria's street number, and which end the first door is at (step 6 can start without it).
- The two decisions at the top of the implementation plan.
- The Passeig at the south end (its name).
- Is this Nuria **Nuria Mendoza**, the woman behind La Reina Bubbaloo? Nothing in this mission
  depends on it; recommended: no, keep the secret elsewhere. (Story decision for `docs/lore.md`.)
- Balance: as an early mission, the boss must be beatable with Matemágico, Papagato and no other
  ánimas.

## Implementation plan

Each step is one or a few `feat: …` commits and leaves the game playable. Order follows
dependencies; steps marked **blocked** need something from the user first.

**Before step 1, decide** (recommendations in brackets):

- Settled (round 11): the mission is **one friend helped** (`ANIMAS.nuria`; the `uri` placeholder
  goes) and gives **three lights** (Nuria, Uri, Nil), spendable at home for one day each.
- Papagato's wearer stats and colour: decided provisionally (the user left it to the plan):
  Velocidad +2, Fuerza +1, Espíritu −1; warm orange `#f0954a`. Tune with `just fight-sim`.

1. **Statuses in story fights.** Stacking statuses on `Combatant` in `src/battle.ts` (stacks,
   duration, end-of-round tick), shown on the fighters in `src/battle-ui.ts`. First three:
   **Sangrado** (damage per stack each round, −1 stack per round), **Mareo** (−Velocidad per
   stack), **Llorera** (the Cebollón's: more misses). Same rules as the combat core
   (`docs/combat.md`), with a parity case in `tests/combat-integration.test.mjs`; unit tests in
   `tests/battle.test.mjs`. Docs: `docs/animas/README.md` § Shared mechanics.
2. **Papagato, level 1.** `papagato` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS`; *Zarpazo de
   Haru* and *Yuki se esconde* in `SKILLS`; `CLASSES` look; `#hud[data-class="papagato"]` theme in
   `src/style.css`; `ANIMAS.nuria` renamed and coloured. **Haru and Yuki** as procedural cats
   (`src/cats.ts`, from the photo notes) sitting beside the wearer in fights and jumping on each
   skill (`src/battle-scene.ts`). Screenshot scenario `papagato` (fight with the ánima worn, via a
   debug story flag). Docs: `docs/animas/papagato/`, `docs/party.md`.
3. **Ánima levels.** Wins per ánima (both wearers count) and story-given levels, a level table per
   ánima, a note when a skill is learned, the level on the Ánimas page. Papagato level 2 *Zarpa en
   la llaga* and level 3 *Las dos a la vez*. Where it is kept: with the loadout in the browser, or
   in the story save [the story save, so it follows the player]. Tests. Can come after step 10
   if the mission should be playable first.
4. **Nuria and Uri** (**blocked**: running `just character` with credits, see *Assets*).
   Portraits, expressions, 3D; `nuria` and `uri` in `SPEAKERS`; Nil procedural in Uri's arms; the
   violet eyes as an `Ojo` recolour while the Queen holds him.
5. **La Sagrera and the R4.** The La Sagrera station scene with the R4 platform and the existing
   `clueR4Marquesina` poster; the R4 line to Cardedeu in `src/transit.ts` and `city.json`; the
   Rodalies trip on the network map (`docs/barcelona.md` § Making a new place reachable). Tests in
   `tests/transit.test.mjs`.
6. **Cardedeu.** `assets/geo/cardedeu/zone.json` anchored on Carrer de Jacint Verdaguer (aerial
   notes above; facade photos if the user has them), `just geo cardedeu`, the station entrance,
   Nuria's door, three lines in `src/environments.ts`. If the station is out of the zone's bounds,
   the trip ends at a station entrance placed at the nearest street end. Screenshot scenario
   `cardedeu`.
7. **The mission's story.** `src/friends/nuria.ts` (the one-file-per-friend convention in
   `docs/barcelona.md` § Architecture): Haru at the station, Nuria at her door, her lines, the cats
   lent (ÁNIMA DESBLOQUEADA, Papagato on trial), Haru and Yuki following the party
   (`src/follower.ts`). **Mission state is not saved**: leaving (Aitor's question at the
   station) or the day ending gives the cats back and resets it (a fall is fought again or stepped back from); only the
   win sets flags (`nuria-uri`, `papagato`, `anima-nuria`, `luz-nuria`, `luz-uri`). Hours: 3
   (`src/days.ts`). Tests in `tests/story.test.mjs`: the lending, every way of losing it, the win.
8. **The maze.** Three levels over the Cardedeu zone (a mission variant of the street: hedges,
   parked cars and fences closing it into a maze): 1 · La calle, 2 · Los patios with fences that
   move on Uri's *"¡cambio!"*, 3 · Hacia arriba up stairs and ladders to the roof. Uri ahead with
   Nil, lines per level, running off. **Ambushes** as data (cell, tell, foe): the tell plays when
   the party is near, walking into it starts the fight, going round does not (pure module +
   test). Risk to check first: walking on raised floors and ladders (`Room.level` exists for the
   flat); if it is too costly, level 3 becomes outdoor stairs on the block's side.
9. **The three fear monsters.** Procedural models (`src/fears.ts`, styled like `src/minion.ts`)
   and encounters: **Cebollón** (layers as a shell that multi-hit peels; Llorera), **Plato
   Misterioso** (a food per round with its own weakness), **Game Over** (restarts with full PV after
   N rounds; since replaced by La Cebolla y los suyos, § Built). `FoeKind`s, `Encounter`s and AI in `src/battle-ai.ts`; balance with
   `just fight-sim`. Tests per rule.
10. **The final boss.** First planned as El Vértigo (Altura, phases, Uri stepping in front of
    Nil); built on 2026-11-05 as **Vertitrón**, a robot with an optional eye (§ Final boss).
    Balance with `just fight-sim`; tests for its moves and its eye.
11. **The lights.** Pure rules first: lights earned (`luz-<person>` flags).
    Then the reusable animation `src/anima-lights.ts` (body flash, rising light, arc and trail,
    the receiver's flash; it takes any person and any receiver, so every friend reuses it), the
    jar on the flat's living-room shelf (since 2026-11-05 its screen, `docs/animas/README.md` § Ecos
    de luz; *Usar una luz* is gone). Tests in
    `tests/story.test.mjs` and a days test. Screenshot scenario `lights`.
12. **The win and home.** Uri himself again (eyes back), the two lights into Gerard and Aitor and
    the *ÁNIMA DESBLOQUEADA · Papagato* banner,
    then into the jar at home (castle threat and the Queen's spread follow from the flags),
    Papagato kept, Haru and Yuki in the Meridiana flat
    from then on (two cats wandering the flat's floor). Screenshot scenario `nuria` covering the
    arrival, the lending, an ambush, each monster, Vertitrón and the cats at home.
13. **Docs.** `docs/chapter-2.md` (friends and clues tables, the lights in § The Queen's advance, implementation list), `docs/lore.md`
    (story so far), `docs/party.md` (Papagato, statuses, levels), `docs/animas/` (implementation
    sections).

### Built

Steps 1–13 are built and tested (`tests/nuria.test.mjs`, `tests/story.test.mjs`). Where the built version differs from the plan above:

- **Step 4**: portraits and expressions from `just character nuria` / `uri` (photos from the main
  checkout's `assets/references/characters/`), shown in every mission line: Nuria `preocupado` while
  Uri is lost and `riendo` when he is back; Uri `crio` while the Queen holds him, `riendo` on top and
  `sorprendido` as he wakes. The 3D models in `src/characters/` are generated from the full-body
  references (`just character <id> --only model`, `assets/characters/<id>/fullbody.png`, local) at
  the cast's scale; Uri's carries Nil and the `Ojo` the code turns violet. Nil has a portrait with
  `riendo` and `sorprendido` (`public/portraits/nil*.png`), ready for a speaker when he has a line.
- **Step 8–10**: the maze became *La torre de Uri* (§ The tower); the boss stands on its top
  platform, not on the roof of Nuria's block. Its fight frames the whole boss, eye and Uri on top
  (`battleScene.foeTop` lifts and widens the camera for foes far taller than the party).
- **Step 11**: the light animation lives in `game.releaseLights` (not a module of its own yet);
  the jar sits on the west end of the TV unit in the living room, built by `updateJar` in
  `src/game.ts` from `story.jar`. Screenshots: `just screenshots lights`.
- **Step 12**: the first time home after the win the lights fly from Gerard and Aitor into the
  jar (not saved: after a reload they are simply there). Haru and Yuki stroll the flat
  (`src/cat-wander.ts`: a few cells to a spot nearby, a sit, another spot), from
  `story.catsAtHome`; shown in `just screenshots lights`.
- **Haru as a guide** (§ Converge check): met at the station, she walks the street to Nuria's door
  ahead of the party (`src/guide.ts`, `story.guide`): she goes on while they keep up, hurries with
  them right behind, stops and turns to look at them when they fall more than a few cells behind,
  and waits there until they come close. At the door she sits beside Nuria (`led` in the mission's
  run, not saved). Screenshots: `just screenshots haru-guide`.
- **Open**: § The lights asks for grey lights in the first round; the jar's lit ones glow amber for
  now, since a pale grey glow vanished against the cream wall behind the TV unit.

- **Step 9, 2026-11-05**: Game Over is gone as a monster (its fantasmita keeps the «GAME OVER»
  blast); ring 3's fear is La Cebolla y los suyos (`escolta`), and ring 3's packs are sometimes mixed.
  An old run that had beaten `fear-game-over` counts it as `fear-escolta` (`migrateBeaten` in
  `src/friends/nuria.ts`). Every tower foe has its abilities (§ Monsters), El Plato 230 PV.
- **Step 10, 2026-11-05**: the boss is **Vertitrón**, designed by Aitor (§ Final boss): a robot with an
  optional eye that ends its Rayo, and Grito liberador weakening the party for good. Before it, a
  three-phase El Vértigo (Altura, eye pips, a hand reaching for Nil) was dropped the same day: Aitor
  found the chip *Nil · 3* and the pips unreadable. Its moments are `FightMoment`s in the picker
  (`STAGED_MOMENTS`, `stageMoment` in `src/battle.ts`).
- **Combined skills, 2026-11-05**: the Matemágico + Papagato duals (§ Dual attacks), and the new
  level-2 skills *Ángulo exacto* (Matemágico) and *Ronroneo de Yuki* (Papagato).

Later, outside this plan: the second round (block 5, one dialogue and Papagato's colour), and more
duals (*Cortina de fuego*, the burning shield, is parked; Noísta + Papagato is on hold with Noísta).
