# Emilie · (working title)

Status: building (round 10: fights first) · Last updated: 2026-11-16

**Decided** means the user said so. **Proposal** means it came from the design side and is waiting
for a yes.

## Protagonist

- **Emilie** (decided, real): Aitor's friend first, now very much both of theirs; **very clever**.
  She sings in the choir Aitor directs, **A cop de diapasó** (`docs/quests/coro.md`).
- **Her work** (decided, real): **hydrogeology** and nearby fields, **like Aitor's**.
- **Who she is** (decided round 2, real): **Belgian parents, born in Navarra**. **Very clever**:
  when they meet they talk about everything.
- Place in `docs/story-outline.md` (idea, earlier): **Poble Sec**, *helps with a technical problem*.
  **Her corner is already built** (`docs/places/poble-sec.md`, place `poble-sec`, L3): an invented
  home on a real lot where Carrer de Margarit leaves Blai, a balcony of geraniums, a screen's blue
  light behind the glass; the Margarit stairs climb Montjuïc behind it. Still to confirm as her
  mission's place.
- The choir's regulars are scientists too (Marta Tarrés and Ferran, geologists; Darío, a
  physicist): they can speak of her in their trades' language (`docs/quests/coro.md`).

## How the player finds her (decided)

- **Her mission starts at the choir**: the player finds out there, when they discover she is
  missing from rehearsal (`docs/quests/coro.md` § The choir room).

## The problem (decided round 2)

- **The Queen has taken her intelligence** (decided): Emilie has become someone who does not
  understand things. **Her flat is completely flooded** and she does not know what to do; **she
  cannot work out how to use her phone**. Something that is not her at all.
- **The mission wins the lost intelligence back** (decided): **technological and conceptual**.
- **Not possessed** (decided round 4): no violet eyes, no kid. **The Queen has affected her
  because she sees her as dangerous.** The only friend she acts against out of fear rather than
  to give them a childhood back: her human side (`docs/lore.md`). **Story decision**: why Emilie
  is a danger to her is _open_ (§ Why the Queen fears her).
- Tone (decided round 4: «me gusta esa parte de tono»): she is not a joke. She knows she used to know: she is
  frightened and ashamed of it, apologises, starts a sentence and loses it. Anyone who has lived
  through burnout, a long illness or watched a parent's mind go will recognise it. Gerard and
  Aitor are the ones who have to think now.
- Routine vs. ilusión, here (proposal): the Queen took the adult part, *knowing how things work*,
  her competence. What a kid has and Emilie still needs is **curiosity**, *wanting to know*. The
  first round gives her knowledge back; the second, the wish to ask (§ Second round).
- Kept apart from Marta's mission (`docs/quests/marta.md`), which also loses a faculty: Marta's
  qualities are loose as monsters and she gets nothing back until the end; Emilie's mind comes back
  **bit by bit, as the party works it out**, and the mission is about understanding, not fighting
  what was lost.

## Why the Queen fears her (round 4, proposals; a story decision)

1. **She had started to measure it** (recommended): the minions live in the sewers and their
   bubbles rise through the manholes (`docs/lore.md`). Emilie, who reads water under the city for a
   living, noticed something in it (pink in a sample, levels that make no sense, bubbles where
   there should be none) and was close to mapping how the Queen moves under Barcelona. The Queen
   took her mind before she could finish. Once it is back she can say a little about it, never
   who the Queen is (Bernat's mission finds out part of the story, `docs/quests/bernat.md`; the
   reveal is the throne's).
2. **She understands everything**: no evidence, only that a mind like hers would see through her
   in the end. More abstract; it leans on the twist (the Queen is nobody, `docs/lore.md`).

## Shape (decided round 3)

**A mission like the others** (`docs/story-outline.md`: a mission's dungeon starts at a pink
bubble): they go to her home, notice she says strange things, and **the bubble opens and takes them
into the mission**. How to frame the dungeon: _open_ (Aitor: «no sé aún cómo plantearlo»).

Beats (proposal):

1. **The choir**: Emilie has not come to the first rehearsal in the new room; Marta Tarrés, Ferran
   or Darío say so, and that she does not answer the phone (`docs/quests/coro.md`).
2. **Poble Sec, her door**: water running out under it onto Margarit. She opens, soaked, polite and
   wrong.
3. **Her flat, flooded**: the strange things she says (proposal: she names things wrong, explains
   the flood backwards, holds the phone and does not know what it is for, apologises). Aitor
   notices first: he speaks her trade, and she no longer does.
4. **The bubble is in her laptop** (decided round 6): the screen whose blue light shows at her
   window, on a table above the water. On it, her model of the water under Poble Sec; the pink
   bubble swells out of the screen. *Entrar*.
5. The dungeon (§ Dungeon), her intelligence coming back bit by bit.
6. Boss, then her light.

## The dungeon in vertical 2D (round 5)

- **Decided** (Aitor, round 5): **a mission in vertical "2D"**, the cross-section seen from the
  side, going down. **Pseudo-2D**: it looks 2D; fights zoom into a 3D setting of their own. The
  first place in the game seen this way: it is the mission's own.
- How (proposal): the same engine and the same orthographic camera, turned **dead side-on with no
  tilt**, over a **thin slab of real 3D** (rock, water, pipes with depth and light, like a cutaway
  diorama). It reads as 2D and stays lit and shaded like the rest of the game.
- Moving (proposal): left and right as usual; **there is no jump in the game**, so going up and
  down is by **climbing points** (a fracture, a well shaft, a pipe, a rope left by a survey), with
  *interact*, each taught where it first appears. Two players: both on the slab, Aitor beside or a
  step behind Gerard.
- Where the mechanic lives (proposal): **water levels**. A layer floods or drains; measuring tells
  where and when; pumping lowers it and opens the way. In side view the water table is a line you
  can see move.
- **The fight** (proposals):
  1. **The cut opens** (recommended): when a fight starts the camera swings round from the side to
     the usual fight angle and the layer around the party **extrudes into depth**: the rock face
     becomes a floor, the cross-section becomes a place. The fight is the game's usual 3D fight, in
     that layer's materials and light; at the end it folds back into the section. Unique to this
     mission, and it says the theme: a diagram becoming real ground.
  2. **The glass** (already built, `docs/combat.md` § Dónde se planta un combate): the game's own
     way to a pocket made of the place's pieces. Cheapest and consistent; the pocket planner would
     need to make a slab into a floor.
  3. **Zoom into a sensor**: the fight happens inside the measurement, an arena of its own. More
     conceptual, more work.
- **Through the laptop** (round 6), the dungeon is naturally **her model** (proposal): a groundwater
  model drawn as a vertical cross-section, the way such models are drawn, made into a place. Still
  to confirm: whether it is **only drawn where it has been measured** (proposal 3 below), and how
  much it looks like a model (mesh lines, colour ramps) or like real rock.

## Inside the model (round 7)

- **Decided** (Aitor, round 7): through the laptop the party **travels into the 2D model** and
  **walks around in it**: a **cross-section with different zones**, **water that flows**, and
  **monsters roaming** in it.
- Monsters roam the section and a fight starts when one reaches the party (as Uri's fears hunt the
  tower's ramp, `docs/quests/nuria.md`).

Zones, top to bottom (proposal; real hydrogeology under Poble Sec and Montjuïc):

| Zone | What it is | Its rule (proposal) | Seen |
| --- | --- | --- | --- |
| **La zona no saturada** | Soil and roots under the street, air in the pores; rain soaking down | Air moves here: the place for **wind** | Roots, drops falling, the street's foundations above |
| **El nivel freático** | The water table: the line where the ground is full of water | It rises and falls; what is under it is underwater | A visible line that moves |
| **Las gravas** | A fast aquifer | Currents carry anything (and anyone) along | Water streaming between stones |
| **Las arcillas** | A clay layer that holds water back | A wall to water: only fractures or wells go through | Dense, smooth, dark |
| **La roca de Montjuïc** | Fractured sandstone under pressure | Water bursts upwards where it is opened | Cracks, jets |
| **Bajo la ciudad** | What people dug: the **L3's tunnel** (Poble Sec) with its pumps, and the **sewers** | The pumps lower the water; the sewers are where the minions live, and where the pink is | Concrete, rails, pipes, a pink trace |

Monsters (proposals, to choose a direction):

1. **What the water does** (physical): **La pluma**, a contaminant plume that drifts with the flow
   and grows downstream; **La cuña salina**, the sea's salt pushing in from below, heavy and slow;
   **El cono**, a pumping well's drawdown that pulls everything towards it.
2. **What goes wrong in a model** (numerical, technological and conceptual): **La oscilación**,
   cells flickering between two values; **Las celdas secas**, cells that dry out and switch off,
   leaving holes in the world; **El que no converge**, a figure that never settles. Real failures
   of a groundwater model, taken seriously.
3. **Both**: the physical ones in the upper zones, the model's failures lower down, where her mind
   has gone most wrong.

## Dungeon (round 3, proposals; the cross-section chosen in round 5)

1. **El acuífero**: down into the ground under Montjuïc, through its layers: gravel where water
   runs fast, sand, clay that holds it back, fractured rock. Each layer plays by its own rule of
   water. It looks like a geology cross-section, seen from the side.
2. **El modelo**: into her laptop's groundwater model, the screen's blue light at her window: a
   world of mesh cells, flow arrows and contour lines, colour ramps for depth. Wrong until it is
   calibrated against what is measured.
3. **Both, the one through the other** (recommended): the real underground, but **only drawn
   where it has been measured**. Unmeasured, it is blank, her lost knowledge; each sensor the party
   places draws the rock, the water and the model's lines around it (mechanic A, Medir y modelar).
   The map of the dungeon is her mind coming back.

## Own mechanic (round 2, proposals)

A. **Medir y modelar** (recommended): her flat floods because the water under Poble Sec and
   Montjuïc is rising, and nobody can see why. The party places **sensors** (piezometers, a data
   logger: real tools of her trade) in the flooded places; each one shows the hidden water around
   it (its level, where it flows). With enough points **the model closes** and can **predict**:
   where the water will rise next, which passage floods and when, where to pump. Every point
   measured comes back to Emilie as understanding: her lines get sharper, she starts finishing
   sentences, then correcting Gerard. Intelligence regained as science does it: observe, model,
   predict. Aitor, a hydrogeologist too, is the one who reads the first readings for her.
B. **La red**: the flat's machines (phone, router, the pump, her laptop) are a network of
   connections cut; the party reconnects nodes and each brings back a capacity. More technological,
   but close to Tecnópata (Aitor's robot) and Matemágico's ones and zeros.
C. **Preguntas**: her intelligence comes back as questions she can no longer ask; the party finds
   them in the world and brings them to her. More conceptual, harder to make playable.

## Elements (idea, round 3 of the choir: «que juegue con el elemento Agua y Viento o algo así»)

- The mission plays with **water and wind**, or something like it, from her work and Aitor's
  (hydrogeology). To integrate step by step.
- What the game has today (`src/battle.ts`, `docs/combat.md` § Debilidades por elemento): three
  elements, **fuego, agua, eléctrico**, with reactions (humo, cauterizado, tormenta, vapor,
  conducción). **Wind does not exist**: it would be a fourth element, with its reactions to design.
  Matemágico already has some water (*Vasos comunicantes*, the *Capilaridad* passive), so Emilie's
  water has to be different: water under the ground, not water thrown.
- Proposals to weigh (none decided):
  - **Agua y viento**: wind as a new element (it carries, scatters, dries; with water, rain or
    spray); the two halves of the water cycle.
  - **Agua subterránea**: closer to hydrogeology: aquifers, pressure, the water table rising,
    ground that lets water through or not. Real hook: Barcelona's groundwater, which the metro
    tunnels have to pump out, and which floods what is dug below it.
  - In the world: `docs/chapter-2.md` already names **a flooded street** as the kind of key an
    ánima can open elsewhere in the city.

## Review (round 8: cracks found and a tighter version; all proposals)

Aitor asked to rethink it. What does not hold, and what replaces it:

1. **Too many systems for one day.** Sensors, a map drawn by measuring, water levels, pumps,
   currents, climbing points, six zones, a new camera, a new fight transition and a new element.
   **One verb instead: *Medir*** (drive a piezometer). It does three things at once: it **turns the
   model's guess into real ground** around it, it **settles the water** there to its true level,
   and **the borehole is the way down** to the next layer (which also solves going down without a
   jump). No pumps, no separate climbing points.
2. **"Blank where unmeasured" hides the monsters.** Instead the unmeasured is **the model's guess**:
   flat colour, mesh lines, water drawn where it is not. The measured is rock, gravel and water with
   weight. One extra material for the whole place, and the monsters live in the guess, in sight.
3. **Three zones, not six**: the soil under the street; the gravels with their current; under the
   city (the L3 tunnel and the sewers, the pink). The clay is the gate between them: only a
   borehole crosses it.
4. **Wind as a fourth element is the most expensive idea here** (reactions with three elements,
   weaknesses, sim targets) and the mission is early. The fights can ask their question with what
   exists: what is under the water table is *mojado*, and water and electricity already react. Wind
   belongs to her ánima's design (`/anima`), if anywhere.
5. **"Unintelligent" can read as mockery of a real person.** Sharper and kinder: she keeps every
   fact and has lost **the why**: she cannot join a cause to its effect. She can say the flat is
   flooded and that water runs downhill, and cannot put the two together. It is also what the
   mission plays: flow is cause and effect. Worth telling the real Emilie before friends play it.
6. **The Queen acting out of fear breaks her pattern** unless what she did is the same as to
   everyone: she gave Emilie a kid's not-knowing. What a kid keeps is asking why: the second round.
   And what Emilie had found should serve the twist without telling it: **the pink in the water has
   no source**; it rises everywhere at once. Bernat knows *who* invented her; Emilie only knows
   *that it comes from nowhere*.
7. **The choir must be a clue, not a gate.** The L3 reaches Poble Sec from the first day: if the
   player goes to her door without having been to the choir, the mission must start all the same.
   And hearing she is missing must not cost Ensayar's hours: it is said on walking in.
8. **The side view is the technical risk**: movement, the follower, two players, fight staging and
   the dev picker all assume a floor seen from above. Before designing further, **a one-day spike**:
   one screen of section, both characters walking and going down a borehole, one fight opening
   into 3D. If it does not hold, the fallback is the section built as a tilted relief model seen
   with the usual camera.
9. **Nothing yet about the fights.** No foe has its question, there is no boss, no ánima. Proposal
   for the boss: **El que no converge**, the model's own failure, with one visible unknown on its
   plate per layer; each *Medir* placed in the dungeon has already pinned one, and in the fight the
   rest are pinned by the right kind of blow. To design next.

## Decided in round 9 (Aitor)

- **She has lost the why** (review point 5), not "unintelligent".
- ***Medir* is the one verb, and three zones** (review points 1 and 3).
- **Fights go through a transition like Uri's tower** (the glass, `docs/combat.md` § Dónde se planta
  un combate) into **a 3D representation of the fight**.
- **No wind here** (another element may come to the game later; not in this mission). **Water,
  and water with electricity**: as Nuria's mission brings fire, this one brings their interaction,
  and **the final boss uses it against the party: it wets them and electrifies them**.
- **The boss is the one that does not converge, Matrix style.**
- **Monsters are seen in the section and have to be dodged or hidden from**; **the borehole can be
  the hiding place**.

## In the section: seen, dodged, hidden from (round 9, proposals)

- The monsters **live in the model's guess** (the unmeasured: mesh lines and falling figures) and
  patrol along the layers, side to side. They see along their layer. Reached, the fight starts.
- **They cannot enter measured ground.** Round each piezometer the ground is real, and they turn
  back at its edge. **Inside the borehole the party is out of the model**: they pass by. So *Medir*
  is the way down, the hiding place and the safe ground at once, and the way through a zone is
  choosing where to measure.
- **Where to measure**: at **survey stakes**, the points Emilie had marked to drill before she lost
  the why (her unfinished plan, in her own model). Fewer piezometers than stakes in each zone: that
  is the decision. Taught at the first stake, which stands right where the party lands, with a
  monster already coming along the layer.
- Emilie comes back **zone by zone**: after each one she says a little more, and what she says is
  how the fights are read (a person, never a panel).

## Fights, as built (round 10)

In `src/battle.ts` (`MODELO`, `MODELO_FIGHTS`, `modeloTurn`), figures in `src/modelo-foes.ts`, tests in
`tests/modelo-fight.test.mjs`, measured in `docs/fight-sim.md` § Emilie's model. Playable from the
fight tester (*El modelo de Emilie*), the boss with a moment for each phase (*Itera*, *Converge*,
*Diverge*). `just screenshots emilie-foes --gpu`.

| Fight (`Encounter`) | Who | What shows it | Moves |
| --- | --- | --- | --- |
| `modelo-celdas` | three Celdas secas | the figure: grey edges around nothing while dry; wet, green and full of water | *Chispa*: a spark on one; on someone wet it runs through everyone wet |
| `modelo-oscilacion` | two Oscilaciones, on different values | the figure's colour and lean (blue «Agua», yellow «Eléctrico»), the other one every round | *Ola* on «Agua» (wets one), *Chispa* on «Eléctrico» |
| `modelo-pluma` | La pluma and two Celdas secas | – | *Empapa*: wets whoever is still dry |
| `no-converge` | El que no converge | its value in its chest, its marks of Error over its head; converged, a solid body and the *Converge* icon with its turns | *Inunda* on «Agua», *Descarga* on «Eléctrico», *Converge* (none) |

No rule is written on a plate (Aitor: «no me gusta que ponga el status explícito, que gráficamente se vea es
suficiente»): the figures carry them, and the summary (R) names the value and the Error count for whoever
wants it in words.

What changed from the proposal below, and why:

- **On the boss the right blow takes no more PV than a plain one.** While it iterates it takes half
  of everything and nothing of its own element; a blow of the other element only takes a mark of Error
  off. The number comes when it converges (double, for two of its turns). Otherwise whoever only
  looks at the number would find the answer without reading anything (`casual` in the sim won), and
  the fight would have no pair.
- **Its value changes with the round**, not with each blow: both players hit with the same element
  in a round, the other one in the next.
- **In *Diverge* it starts with four marks** and comes out of the blow that converges it Mojado, so
  the next bolt is Conducción on it.
- **The dungeon's part**: `calibrate(state, n)` takes a mark off before the fight for each piezometer
  placed beyond the one each zone needs to go down, never the last mark.
- Figures are built by hand from primitives, as the campsite's and Las cuerdas' are (lines of light,
  not characters): first pass, to judge in the gallery. La pluma is amber, low, never pink.
- **Waiting the water out is learned in the model's fights and works once on the boss** (Aitor,
  2026-11-17: «que la mecánica de esperar a quitarse el efecto la aprendamos durante los combates
  pero que el jefe final nos lo deje hacer solo una vez, puede hacer un mini guiño como que "se da
  cuenta", pero sutil, no explícito»). Mojado lasts 20 s on the fight's clock. Against the celdas,
  the oscilaciones and La pluma, letting it run off before a spark always works: that is where it
  is found. Against El que no converge it works the first time (its Descarga lands on a dry party,
  half). It sees it, and says so only with a look: its figures stop falling for a moment and its
  second pose is gone, and the line reads «Sus cifras se detienen un instante.» No pop, nothing on
  its plate. From then on, when its water has run off on the clock again by its Descarga, it does
  its whole strategy in the one move: it wets everyone and discharges, and the bolt runs through
  them all (Conducción), as hard as if they had never dried. It is its Descarga, no more: not a
  sure fall. Water that dries while it stands converged does not count (it is not waiting for it).
  Picker moment: *Ya vio la espera* (`modelo-sobre-aviso`).
  The first idea, an attack that drops the whole party (*Desbordamiento*), was built and taken out
  the same day.
- **Shock** (Aitor, 2026-11-17: «que atacar eléctricamente sobre alguien mojado tenga un 50 % de
  probabilidad de aplicar shock y pierda un turno»). A general rule of Conducción, written in
  `docs/combat.md` § reactions, not the model's own: a bolt on someone wet leaves them in Shock half
  the time and their next turn is lost, on both sides. In here it is what makes the water matter
  twice: a cell switched on can be made to lose its spark, and a Descarga on a wet party may cost
  one of them the round. A foe's bolt now lands whole on the one it strikes and half on the others
  wet (it was whole on all). The fights still hold their targets (`just fight-sim check`).

## The section, as built (round 10)

The side view holds. The model is its own place, `modelo` (`MODELO` in `src/environments.ts`, picker:
*El modelo de Emilie*, group Barcelona), drawn by `src/modelo-scene.ts` over the rules of
`src/modelo.ts`, and the game steps it in `src/game.ts` (`stepModelo`, `useStake`).

- **One gallery, four depths.** The party walks a single strip, 36 m long and three cells deep,
  under a camera that looks from the side (`view: { yaw: 0, pitch: 14 }`). Going down, nobody
  changes cell: the whole section rises past the party, a gallery every 5 m, so the borehole they
  went in by is seen overhead from the zone below. Fights are staged in the gallery itself, whose
  camera already looks from that side.
- **Guess and real.** Unmeasured ground is black with the model's mesh in phosphor green (finer the
  deeper), the clay between galleries hatched, the houses of Poble Sec in outline over the street,
  a tunnel's ring under the city. A stake measured turns the ground 3.2 m each side of it into what
  it is (earth, gravel, wet concrete), lit, with the piezometer's steel tube and its water level
  running down the clay.
- **One prompt per stake.** Wood with orange flagging tape. It offers «Medir», then «Entrar», then,
  inside, «Bajar»; walking away from it leaves the borehole. Only the stakes of the party's zone
  answer, and none once the piezometers are spent.
- **Patrols.** Each walks as the foes it fights as. One that reaches the party starts its fight;
  beaten it is gone, run from it stands still five seconds. At the bottom El que no converge stands
  at 24 m and its fight starts within 3.5 m; what was measured beyond one stake a zone has already
  taken marks of Error off it (`calibrate`).

Not there yet: Emilie's voice in the section, the way in from her laptop and the way out, the
party hidden from view inside a borehole (they stand in a column of light for now), a fall in a
fight inside the model, and its sound. The scene is some 450 separate pieces: to merge into a few
meshes before it is measured against the 120 Hz budget.

## Fights (round 9, the proposal)

What exists and is used (`src/battle.ts`): *Mojado* (20 s, hurts nobody), **Conducción**
(electricity on someone wet: magic on everyone wet, who are left dry), Atacar with an element
(agua, eléctrico) for anyone from the first day, Matemágico's *Vasos comunicantes* and *Descarga*.
New here: **foes can wet and shock the party**, by the same rules.

| Foe | Zone | What it is | Its question | Without / with the answer |
| --- | --- | --- | --- | --- |
| **La celda seca** | The soil | A model cell that has dried out and switched off: a hollow block of mesh | *Which first?* While dry every blow lands at half. Water wets it and it switches on; then electricity is Conducción | A long fight of small numbers / wet it, then one bolt through all of them |
| **La oscilación** | The gravels | A figure flickering between two values, never still. Its plate says which it is on now: «Agua» or «Eléctrico», and it flips every turn | *When, and with what?* A blow of the element it is on is absorbed; the other one lands hard | Half the blows wasted / every blow the right one. It is the boss's rule, small |
| **La pluma** | Under the city | The pink trace in the water, drifting; it wets one of the party each turn and grows downstream | *Who first?* It comes with celdas secas that shock whoever is wet | The party soaked and shocked / the plume down first, then the rest |

### Final boss: El que no converge

- Look (proposal): a tall figure made of **falling columns of figures**, phosphor green on black,
  that never settles: two poses flickering one over the other. Built by hand like La Voz, each
  part moving on its own (a figure from a file moves as one piece). Colour to take through
  `docs/visual-style.md` (no pink, no violet; not the choir's cyan nor Las cuerdas' petrol).
- **On its plate, always**: the state it is on, «Agua» or «Eléctrico», flipping every turn, and
  its **Error**, a row of marks.
- **Its two moves are the mission's lesson turned on the party**: on «Agua», ***Inunda*** (the
  whole party *Mojado*); on «Eléctrico», ***Descarga*** (Conducción on everyone wet). Left alone:
  soaked, shocked, soaked, shocked, harder each round as its Error grows.
- **The question: how do you stop something that will not settle?** A blow of **the element it is
  not on** lands hard and **takes one mark of Error away**; a blow of the element it is on is
  absorbed and adds one. The two players alternate, water on «Eléctrico», electricity on «Agua».
- **The turn, seen**: at Error zero, **«Converge»**: the figures stop falling and it is a solid
  body for some turns: no flipping, no Inunda, no Descarga, every blow at full. Then it diverges
  again, phase two, with more marks.
- **The dungeon counts**: it starts with one mark fewer for each piezometer placed on the way
  down. Explored well, it is nearly converged on arrival.
- Within reach of the first day's party: Atacar with agua or eléctrico is everyone's.
- Phases, each a `FightMoment`: *Itera* (the above), *Diverge* (from half its PV: more marks, and
  it wets itself too, so Conducción on it is the big number).
- Code: `Encounter` `no-converge`, `FoeKind` `celda-seca`, `oscilacion`, `pluma`, `no-converge`.
  `TARGETS`: one alternating the elements, one attacking flat.

## Decided in round 10 (Aitor: «me parece bien, empieza con la implementación»)

- **Measured ground is safe ground**, the borehole hides the party, and measuring is done at
  Emilie's survey stakes (§ In the section).
- **The three foes and the boss as proposed** (§ Fights): the state that flips, the Error, «Converge».
- **Phosphor green** for the model and the boss (to take through `docs/visual-style.md`).
- **The water is not pink, and there is no pink in this mission.** Why the Queen fears her needs no
  more story than this: **Emilie has lost her intelligence, and the party connects to the computer
  in her living room.** The proposals in § Why the Queen fears her (the pink in the water, the
  source that is nowhere) are **dropped**; so are the pink trace of zone three and the pink bubble
  swelling out of the screen: the way in is **connecting to her laptop**. La pluma is a
  contaminant plume of the model, never pink.

## Found while building (round 10; proposals taken to keep the fights honest, to confirm)

- **Atacar's elements are not everyone's from the first day**: they are bought at the jar, ánima by
  ánima (`src/ecos.ts`), and so are *Vasos comunicantes* and *Descarga*. A party can reach Emilie
  with neither water nor electricity, and a fight's answer must be within reach of whoever meets it
  (`AGENTS.md`). So **inside the model every Atacar can carry Agua or Eléctrico** (`BattleState.lent`):
  they are the model's two variables, lent by the place for as long as the party is in it. What the
  jar gives stays worth having: Vasos comunicantes wets every cell at once, Descarga reaches them
  all.
- **Water wets a celda seca by the cell's own rule** (Atacar with water leaves nobody else Mojado
  without *Capilaridad*).
- **In *Diverge* the boss is left Mojado when it converges**, not while it flips: while it is on
  «Eléctrico» a bolt is absorbed, so being wet then would ask for the wrong blow.

## Open

- Everything: the problem, the place, the mechanic, the boss, the ánima, her look and photos.
