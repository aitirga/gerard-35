# Development tools in the game

The release opens on the welcome screen (src/title.ts, docs/audio.md); development skips it unless
the URL has `?title` (e.g. `/?story=new&title`).

The place panel (top left) names where Gerard is. Clicking the place's name opens its picker
([src/jump-menu.ts](../src/jump-menu.ts)), a list under the panel with the street still in view.
Arrows walk it, Enter picks, Escape or a click outside closes it, and the game waits while it is open.
In development F2 opens it from anywhere, fights included, where it also has a *Depuración* button
over the fight.

In production it only lists the places the old dropdown offered. In development (`just dev`) it
has five tabs and lists every place. Historia and Misiones are wide, with the **Ánimas** column
on their right.

## Lugares

Every place, grouped by area, with a search box. Picking one moves Gerard there, as walking
through a door would, without touching the story. The places the game only reaches through a
door (the house's floors, the palace) say "solo depuración". The castle's three floors
(*Castillo · Primer, Segundo, Tercer curso*) are the floors of the day the save is on.

Over the list, **Paredes que se pliegan** turns the house's folding walls on or off: walls and tall
furniture folding down to a skirting while they stand between Gerard and the camera
(`setWallFolding` in `src/home-scenery.ts`). It is off for now, in production too, while the house
is tried without it; the choice here is remembered in this browser. `just screenshots wall-folding`
shows both.

## Historia

The story as chapters, each split into arcs and their steps ([src/story-points.ts](../src/story-points.ts)),
plus "Desde el principio". Picking a step reloads the game with that step done and what it needs,
standing where it happened (the station street, the school, inside the castle; otherwise where the
story resumes). The same as `just dev-chapter <flag>`, i.e. `/?story=<flag>`. Nothing is saved: a
jump keeps its own flags.

Over the list, the **Línea temporal**: the main line's key events as dots on a line (`TIMELINE` in
[src/story-points.ts](../src/story-points.ts)), from *Inicio* through *Castillo*, *Aurelià*, *Dirección* and *Artilugio* to *La Reina*. Clicking an event marks
it done with everything before it; under it, each ánima mission is ticked as done on its own, once
the line reaches *Primer metro* (the same choice as *Con ánimas*). The ring is where the game is
now. **Empezar aquí** reloads with exactly that done, **En casa** (the flat on the Meridiana at 35,
the house in Sant Quirze before; `&at=home`) or **Donde pasa** (where the step happened). It is the
quick way home with part of the story done, e.g. to open the jar with Nuria's lights in it.
`just screenshots timeline` shows it.

- **Chapter 1** runs in one line: *En casa*, *Con Bernat*, *El palacio*, each arc after the one before.
- **Chapter 2** is open: *El despertar*, then *La ciudad* from the news on, then **El castillo**
  (docs/castle.md): Aurelià beaten, Dirección beaten, the Queen taking Aitor, the artilugio, the
  Queen beaten; and the two endings, **Final · Acabar** and **Final · Bajar la mano**, each its own arc.
- **Día** and **Con ánimas**, over chapter 2, choose the day a chapter 2 jump wakes up on
  (`&day=<n>`, as `just dev-day`) and which other missions it starts with done (`&with=nuria`),
  so any mix can be tried. *Con ánimas* starts with the missions the story has done; a mission only
  joins jumps that reach where it starts.
- **Hora** (*Mañana*, *Noche*) starts a chapter 2 jump at 21:00 (`&hour=21`): night outside, and a
  jump onto the Meridiana starts at the Fabra i Puig station, for the way home with the palace's
  guards out (docs/chapter-2.md § Night and the way home).
- **De noche · La vuelta a casa**, under chapter 2's arcs, starts the way home at night on the
  Meridiana, out of the Fabra i Puig station, with a level chosen by **El castillo**: her castle's
  stage, 0 (*Aparece*) to 4 (*En la Meridiana*), the TV's headlines (`stage` in src/days.ts). The
  jump wakes on the first day the castle is at that stage with the ánimas of *Con ánimas*
  (`dayForStage`), so the castle, the pink and the hunt all match: stages 0–1 are a calm night,
  2 tense, 3 hard and 4 the last (`NIGHT_TIERS` in src/night.ts). The line under it says how many
  groups come out and, if they catch the party, how strong the fight is (by the ánimas alone).
  **Alumnos** picks whose pupils are out, 1.º to 3.º (the castle's bosses beaten up to that year):
  each hunts its own way (src/night-pupils.ts), El Ausente and El Castigado from the second, El
  Montón in the third. **Cuántos** sets how full the avenue is, for trying densities: half, the
  tier's own, double or triple the groups posted along it (`NIGHT_DEV.crowd` in src/night.ts; the
  note says how many pupils that is). Same as `just dev-night <castle> [<ánimas>] [<year>]`, i.e.
  `/?story=metro&night=<0–4>&with=nuria&year=2&crowd=2`; `just screenshots avenida-llena` stands
  Gerard along the way home to show who is about at each stretch. In the console, `gerard.game.nightStreet` is the
  night itself (its pupils can be moved and set to a mode, as `just screenshots alumnos-de-noche`
  does to stage each one's moment), `gerard.game.nightHunters` who is out and what each is doing,
  and `gerard.game.traffic` the vehicles on the move.
- **The afternoons and the Queen's scream** need no jump of their own: from any chapter 2 point at
  home (*Historia* with *En casa*), the sofa, the kitchen and the bed offer the afternoon, and
  VivaGym's door and the choir's are on the avenue; `gerard.storyEvent({ type: 'battle', won: true,
  encounter: 'aurelia' })` plays a castle boss beaten (her scream, the flash, bed) from anywhere.
  `just screenshots pasar-la-tarde` plays all of it.

The step the story has reached is marked, and those behind it are brighter. The ánima missions
are in their own tab.

## Misiones

Each friend's ánima mission, picked from the chips at the top (*Misión*), and the parts it can
start at, numbered, from **0 · Desde el principio**. Picking a part reloads the game there, as
`just dev-mission <ánima> <part>`, i.e. `/?mission=<ánima>&part=<part>`, with the same *Día* and
*Con ánimas* as Historia (the mission's own chip is off: a part never brings its own mission done).
A part brings what the mission needs to start (the first metro) and nothing of the other missions
unless they are ticked. The part the story is at is marked, and those behind it are brighter.

A part is more than a story flag: most of a mission is not saved (Nuria's cats are only lent until
Uri is back), so a part also sets the mission's run and may play a moment on arrival
(`missionParts` in [src/story-points.ts](../src/story-points.ts)). Nuria and Uri's:

| Part | Starts |
| --- | --- |
| `start` | Coming up from the R4 at Cardedeu: the arrival line, then Haru at the station |
| `door` | Next to Nuria, Haru met, before she lends the cats |
| `lent` | With the cats and Papagato lent, at her door: walking up the street turns it into La calle que no acaba |
| `street` | At the start of *La calle que no acaba*, the bubble still to be seen |
| `portal` | In front of the bubble at the street's end: walking up to it goes into the tower |
| `ring-1` | In the tower, Uri ahead, El Cebollón on the first ring |
| `ring-2`, `ring-3` | At the end of the ring below, its fear beaten (ring 3's is La Cebolla y los suyos) |
| `summit` | Under the top, every fear beaten: walking up starts Vertitrón |
| `vertigo` | On the top: Vertitrón starts on arrival |
| `won` | Vertitrón beaten: Uri comes back to himself, the two lights go into Gerard and Aitor and Papagato's banner shows |
| `done` | The mission won, the next morning at home |

The university friends' (`docs/quests/universidad.md`):

| Part | Starts |
| --- | --- |
| `start` | Coming up from the L4 at the Barceloneta |
| `beach` | Up the sand behind the six, who face the sea; Anna in the water |
| `tag` | The game of tag on: the friends running, the promenade shut by tentacles |
| `spiral` | Anna gone into the spiral in the shallows: wading in goes to the campsite |
| `camp` | Càmping Eurosport, just out of the spiral; the magos wait at the entrance |
| `board` | In front of the reception's blackboard: Las parcelas |
| `gate` | Las parcelas solved, every waiting foe beaten: the gate open, El Campeón by the pool |
| `sobremesa` | El Campeón beaten: walking up to the long table starts La Sobremesa |
| `won` | La Sobremesa beaten: free round the melon table, the photo, the five lights, back on the beach |
| `done` | The mission won: the seven, free, on the sand |

A mission without its own list offers its beginning and each of its steps.

## Ánimas

The column on the right of Historia and Misiones, in two groups.

**Ánimas propias** (Matemágico, Tecnópata) have no levels and earn no EXP
(docs/animas/README.md § Two ways to grow), so they have no level chips: at 35 each says it is
always worn and how many of its constellation's improvements are bought, with *Abrir el bote*
under them; in the childhood chapter they are only *No* or *Despierta*.

**Ánimas compartidas**: each one with *No* and each level it can reach (*Nv 1* to *Nv 3*). It shows the ánimas unlocked now; the story's own level is
underlined in gold, so a change shows against it. A pick applies at once: the status screen, the
interface's colours, L and R in the fight on now and its skills, and the next fights, the
tester's too. *Volver a las de la historia* gives back what the story has unlocked up to here.

It is not saved and sets no flag (`story.debugAnimas`), and no ánima earns EXP from fights while it
is set; a jump starts again with what the story gives at that point.

At the top of the column, **Subir de nivel**: each shared ánima that levels (`LEVELLED` in
`src/levels.ts`: Papagato and Dadista), with its level and EXP and two buttons that make it grow
**for real**, as a won fight would (`story.giveXp`): *Subir a Nv N* (exactly the EXP its next level
needs, the gold one), and *+25 EXP*. Both need the ánima unlocked in the story (a jump to after its
mission gives it); Matemágico and Tecnópata are not there, they grow at the jar. The EXP is kept, a level reached sets its flag and shows its note (*ÁNIMA · NIVEL 2 · Aprende
…*), and they give back the story's ánimas first, so what shows is the story's. Both are greyed out at
the top level.

Under them, **Ecos de luz**: how many there are and how many are free, *+1 eco* and *−1 eco* (on top
of the story's, not saved, `story.debugEcos`) and *Abrir el bote*, which opens the jar's screen
wherever Gerard is.

During a fight, *Saltar a* also has **Victoria subiendo de nivel**: it wins with EXP enough for every
ánima that took part to reach its next level (`BattleState.extraXp`), to see the victory screen's
level-up.

## Combate

El selector **Combate → Probar un dúo** abre Sutura de luz, Relevo de sangre, Bombardeo orbital o Reserva de color con sus dos ánimas equipadas y sus habilidades aprendidas. En el menú del combate, elige **Dual** y el objetivo. Sutura empieza con Gerard herido y Relevo con un enemigo que sangra y está a punto de caer. Cada ensayo se puede abrir con `?story=got-wrapper&solo=1&fight={"trial":"sutura-de-luz"}`, sustituyendo el identificador. La galería se genera con `just screenshots duos-en-combate --gpu`.

The fight tester. Choose:

- **Época**: chapter 1 (Gerard as a boy) or chapter 2 (at 35). The fighters are cloned from the
  street models, so changing it reloads into that chapter (`/?story=minion` or
  `/?story=got-wrapper`, with the fight in `&fight=…`) and the fight starts on arrival.
- **Equipo**: Gerard alone, or with Bernat (chapter 1) or Aitor (chapter 2).
- **Ánimas**: the ones unlocked, which L and R walk through in the fight; and which one Gerard
  and Aitor start wearing (Bernat wears none).
- **Amigos** (chapter 2): the friends' ánimas, which add their bonus and weaken the guards.
- **Contra**: dogs, possessed dogs (pink eyes), the palace minion (chapter 1, with Bernat) or
  the gum guards. In chapter 2, **Torre de Uri** adds Uri's fears (El Cebollón, La Cebolla, El Plato
  Misterioso, ring 3's **La Cebolla y los suyos**), Vertitrón and a pack of each ring's young (a
  random mix each time; ring 3's sometimes with a cebolla), fought in the tower where Gerard stands.
  **Camping Eurosport** has the university friends' dungeon (docs/quests/universidad.md): *Magos*,
  *Dados*, *Agentes*, a *Tienda equivocada* (a die and two agentes), the *Parcela negra* (two magos
  and two dice) and *El Campeón*; on the Barceloneta's sand until the campsite has a place of its own.
  **Castillo** has every fight of the castle (docs/castle.md): each room's pupils by year, La
  Delegada, Aurelià, El Equipo de dirección, La Reina Bubbaloo (the first meeting, which cannot be
  won) and La Reina with the artilugio; rooms on their floor, bosses in their own room, the Queen
  up on her stage (src/throne-arena.ts), after her entrance (Enter, Space or Escape skip it). Her fight's *Momentos* jump to each phase (*El chicle*,
  *Las manos*, *La pompa*, *Tiene a Aitor*; *Suyo* in the first meeting), and the keyboard's 1–4
  are the artilugio's buttons there. **Beating her here plays the ending on**: the last scene,
  Acabar or Bajar la mano, what it does, the Monday's words and the credits, as the story would,
  with nothing raised and no morning (`previewEnding` in src/main.ts): the save is the same after.
  Dogs come 1 to 4; the guards are as many and as strong as the friends' ánimas leave them.
- To try **Ángulo exacto**, **Ronroneo** and the **duals**, the Ánimas column sets the
  levels (Matemágico and Papagato at *Nv 2* reach all of them) and *Equipo* + *Ánimas* put
  Matemágico on Gerard and Papagato on Aitor.
- **Ecos de luz** (chapter 2): the improvements of the ánimas in the fight, whatever they would cost
  (Matemágico's elements, each ánima's maná). Asleep ones (Pasiva, Definitiva) do not show.
- **Ayudas**: *Inmunidad* (no blow takes the party's PV), *PM infinitos* (skills cost no
  Ánima), *Sin límites*: every ánima unlocked at its top level for whoever can wear it (each
  can switch to all of theirs), maná always full in every one, and skills with no limit of use (a
  cure on anyone standing, a boost or a mark again while it runs, every dual as often as wanted;
  `BattleState.unbound`, `unboundAnimas` and `applyHelp` in `src/main.ts`), and *Crítico seguro*:
  every blow of the party is a golpe crítico, to see it and what it does to the numbers
  (`FightSetup.crit`, `BattleState.sureCrits`; docs/animas/README.md § Golpe crítico).

To balance fights rather than play them, `just fight-sim` plays thousands without a screen
([fight-sim.md](fight-sim.md)).

Each fight is staged where the story stages it (game.ts): the dogs in Passatge Maresme, the
minion and the guards in the palace, so the tester takes Gerard there first. A test fight
touches no story flag, saves no ánima choice, and puts the street back as the story has it when
it ends. The last setup is remembered in this browser.

Without the picker, a development URL opens a quick fight: `/?battle=3&allies=2` (2 to 4 dogs,
with Bernat for `allies=2`), and `&animas=matemagico,papagato` chooses the unlocked ánimas
(Matemágico alone by default); Gerard wears the last one. A quick fight starts where Gerard
stands; with no room for it there it goes to a pocket of the place (docs/combat.md § Dónde se
planta un combate), and `&pocket` sends any fight to one, wherever it starts (e.g.
`/?mission=nuria&part=door&battle=3&party=adult&pocket` for a pocket of Cardedeu).

### During a fight

In any fight, the story's too, the Combate tab becomes the fight's own page:

- **Ayudas**: *Inmunidad*, *PM infinitos*, *Sin límites* and *Crítico seguro*, on or off at once (a test fight starts
  with its setup's; *Sin límites* off gives back the fight's own ánimas, levels and kits).
- **Saltar a**: *Victoria* or *Derrota* (its result screen, as if it had happened), *Enemigos a
  1 PV* or *Equipo a 1 PV* (the next blow decides), and against the palace minion *Despierta
  Matemágico*, its beat: Bernat on his knees begs Gerard to think, and Matemágico wakes. Jumps wait for a
  player's turn. A boss with phases or key moments adds its own here (`FightMoment` in
  `src/battle-ui.ts`: the old ones plus `StagedMoment`, which `stageMoment` in `src/battle.ts`
  stages, labelled in `STAGED_MOMENTS`), shown only in their own fight:

  | Fight | Moment | Stages |
  | --- | --- | --- |
  | Vertitrón | *Rayo cargado* (`vertigo-carga`) | Full PV, its eye charged: its next turn is the Rayo terrorífico on both |
  | Vertitrón | *Tras dos gritos* (`vertigo-grito`) | Half its PV, two Gritos liberadores already on (Fuerza and Magia down), the third next |
  | Vertitrón | *Ojo roto* (`vertigo-sin-ojo`) | Full PV, its eye broken: no more Rayo |
  | El Plato Misterioso | *Plato sorpresa* (`plato-sorpresa`) | The surprise dish under the cloche |
  | Magos de camping | *Bombona cargada* (`magos-bombona`) | Every mago whole with its Bombona charged: their next turn blasts both |
  | El Campeón | *Plan a punto* (`campeon-plan`) | Full PV, his Plan full: his next turn is the Rayo total on everyone, unless magic sets it back |
  | El Campeón | *Etapa II* (`campeon-etapa`) | Half his PV, in his Etapa II (the Plan fires at two), a step from firing |
  | Aurelià | *La lección*, *La carrera*, *La última recta* (`aurelia-*`) | Each phase from its start: behind the lectern; running his lap; the lectern gone |
  | El Equipo de dirección | *Las tres: Acta* (`direccion-tres`), *Quedan dos*, *Voto de calidad* | The three on an Acta round; two without quorum; the last with every element |
  | La Reina (with the artilugio) | *El chicle*, *Las manos*, *La pompa*, *Tiene a Aitor* (`reina-*`) | Each stage from its start; the last with Aitor already hers, so the artilugio's keys (1–4, two at once for a pair) can be tried |
  | La Reina (the first time) | *Suyo: Aitor contra Gerard* (`reina-suyo`) | At her tenth with Aitor already hers and no artilugio: on her turn player 2 picks his blow against Gerard |

  To try a dual with full maná, *PM infinitos*.
- **Dual** (a command, in development only): in every fight of `just dev` the fight's menu is
  Atacar · Habilidad · **Dual** · Defender · Huir, in the place the old *?????* had. It opens a list
  like Habilidad's, kicker *DUALES · AITOR + GERARD*: every dual (`dualOptions`), with its two
  halves, its maná as two groups of circles under each wearer's name (*1 + 2 maná*) and its
  description in the details box. The ones that cannot happen now stay in the list, with why
  (`DualBlock`: a half not learned yet, already used this fight (*Ya usado en este combate*: each
  goes off once a fight), someone without the ánima of their half, the partner down or already
  through this round, no maná, no target). Picking one puts on the active fighter the ánima of their
  half if it is free in their kit, asks for a target (its banner already up) and fires it, so a dual can be
  tried with one player and no queue. One not found yet still stops time under *DÚO DESBLOQUEADO*
  before it goes off; in the fight tester a dual counts as found until the page reloads (`just
  screenshots duo-descubierto` plays both). Outside development there is no such command and the menu is
  Atacar · Habilidad · Defender · Huir; duals only come as a surprise (docs/combat.md § Ataques
  duales).
- **Salir del combate**: the fight ends at once, with no result for the story. Picking a place in
  Lugares also leaves the fight first.

A story fight left or jumped from here still counts as the story's when it ends with a result
(Victoria and Derrota do); leaving does not.

`just screenshots jump-menu` shows the tabs, the story's arcs, two jumps and where they land,
test fights in both chapters and the fight's own page.

## Keeping it complete

Everything new in the story has to be reachable from here (AGENTS.md):

- A new story flag: a step in its arc in `STORY_ARCS` in `src/story-points.ts` (TypeScript asks
  for one for every flag in `STORY_FLAGS`), with a `spot` if it happens away from where the story
  resumes, and its name in the `dev-chapter` list in the justfile. A new ánima mission is a new arc
  with `anima` and the step it starts `after`; its flags are its steps, in the order it plays.
  A mission whose moments are not all flags (a run that is not saved, a tower's rings) lists its
  parts in `missionParts`, with the run each one sets; `tests/story-points.test.mjs` checks that
  every part stands on a walkable cell.
- A new place: its entry in `PLACES`, in its area's group, with `open: true` only if production
  players may pick it too.
- A new fight, foe, ánima or skill: playable from the fight tester (`FightSetup`, `startFight` in
  `src/main.ts`), with its stage in `FIGHT_PLACES` if it is fought somewhere new. A fight with
  phases (a boss) gets a `FightMoment` for each, so the picker can jump to it.

## The progress panel

`docs/progress.toml` lists what the whole game needs, with a weight per block and per item. An item
is done when its checks hold against the checkout (a file exists, a text is or is not in a file, a
name is used) or when it says `done = true`, for what code cannot tell. Adding an item makes the bar
shrink; finishing or deleting one makes it grow. The file's header explains the checks.

The checks ask for what is in the game, not only written: a module of `src/` counts once something
imports it (another module, a folder loaded whole, or a page of its own such as `bestiario.html`),
and `used = "levelCap"` holds once the name is in a second module, so a gate defined and never
applied stays pending.

`just progress --audit` is for checking that everything is wired together, before calling a piece
of work done. It prints two things and fails if either finds something broken:

- **The list's own health**: checks that can never tick as written (an `in` that finds no file, a
  `used` name nobody defines, a title twice, a hand tick whose check fails), how many points of the
  bar rest on each kind of evidence, and what waits for a tick by hand.
- **The game's integration** ([scripts/integration.mjs](../scripts/integration.mjs)), read from the
  game's own registries and never from a list: every story flag in the `dev-chapter` list, every
  place in the picker and every fight in the tester (*broken* if not); and, as work left, the fights
  without their pair of `TARGETS`, the places with no song, the missions whose ánima cannot be worn
  and the ánimas that do not grow, who talks without a portrait or fights on the minion's model, and
  what `src/` exports and nobody uses. `tests/integration.test.mjs` holds the broken ones to none.

A gap the audit lists is either an item of the list already or should become one.

`scripts/herdr-progress` draws the total, the story a player can walk through, the priorities and
the blocks. herdr opens it at the top of every tab's column in this project, because having the script is what
turns it on (the `herdr-project` skill), and it looks again every 5 seconds. It measures its own checkout, so a feature's workspace shows that branch.
`just progress` prints it once and `just progress --all` lists every item.

## Partida

The last whole-game report (`just game-sim`, [game-sim.md](game-sim.md)), small: the difficulty
curve of every simulated player, and for the one picked (*Jugador*) its median length, days,
fights, where the game saturates, when each ánima grows and which fights are walls. Under it, **Una
partida típica**: the key moments of that player's median game (the timeline's events and each
mission's end) with the minute, the day and the fights so far. Picking one jumps the real game there
as Historia does, on the day the simulated player was on and with the missions it had done
(`simMoments` in [src/game-sim-panel.ts](../src/game-sim-panel.ts)). It reads
`output/reports/game/data.json` each time the tab opens, and links to the whole page. Without a
report it says to run `just game-sim`. `just screenshots game-sim` shows it.

## The bestiary

`just bestiario` (`bestiario.html`, [src/bestiary.ts](../src/bestiary.ts)) lists everyone in the
game to see what is still to improve: the party and its ánimas, every foe by where it is met, the
monsters being designed and the people. Each entry shows its 3D model as the game draws it (drag
to turn, wheel to come closer; a rigged monster plays its Meshy clips), its portrait and
expressions, the `just character-3d` images (design, views, earlier tries), and for a foe its PV
and weaknesses in every fight it is in, the moves it makes, the fight's question and its answer,
and how its model moves. A badge says how its model stands: its own, procedural, a part of
another, or **provisional** (drawn with someone else's: a castle foe with no figure yet uses the
palace minion; one with its own, src/monsters/<id>.json, fights with it and shows it); the *Por
mejorar* filter keeps only those and whoever has none.

Every model starts **front-on** and still: chosen (or switched with the buttons over it), the camera
looks at its face (yaw 0, every family faces +z), framed to its height, the turntable off until
*Girar*, and its motion from the start. A **person** stands posed as the game poses people
(walk-animation.ts: *Quieto* breathing, *Andar*, *Correr* on the spot). An **ánima** is shown worn:
whoever the game lets wear it (`ANIMA_OWNERS`: someone's own only by them, the rest by anyone but
Bernat, and the boy only his own), its owner first, dressed by the game's own `wearClass` (its
dyed clothes and anima-looks.ts' pieces; a grown Matemágico's thoughts), with what goes with it built
by its own module (Papagato's Haru and Yuki, `createCat`; Tecnópata's Bip, `createBip`), and *Sin
ánima* to compare. Its page lists its colours, what it adds (`CLASS_STATS`), maná, how it grows
(`LEVELLED` or the jar), its skills by level, the jar's tree by line (`IMPROVEMENTS`), passives and
duals. The party's own entries switch between their clothes and each ánima they can wear; a
friend's ánima shows the friend. The street dogs are built by the fight's `buildStreetDogs`, and
Vertitrón's eye is shown on Vertitrón.

It reads the game, not a list: foes come from building every fight as the game does
([src/bestiary-data.ts](../src/bestiary-data.ts), `createFight`, a few seeds for rooms drawn at
random), their moves from playing each fight a few times with the simulator's bot (`playOut`,
which counts each foe kind's abilities in `Run.moves`), their questions from `TARGETS` and, for the
castle, `CASTLE_ANSWERS` (copied from docs/castle.md, docs/castle-bosses.md). Models come from
`src/characters/`, `src/monsters/`, `src/creatures/`, the fears' templates (src/fears.ts) and the
minion; sizes from `foeScale` (src/battle-scene.ts). What lives outside `src/` (tools/figures.toml
and the files `just character-3d` leaves in output/) is written first by `tools/bestiary.py` to
`output/bestiary/figures.json`, which `just bestiario` runs. So a new figure, monster, foe or fight
shows up by itself; `tests/bestiary.test.mjs` fails if a new fight's foe has no place in it.
`just screenshots bestiario --gpu` (after `uv run python tools/bestiary.py`).

**Notes and marks to redo.** Each entry has a *Notas* section: chips to mark what to redo (*modelo*,
*retrato*, *diseño*, *animaciones*, *combate*), a comment, *Guardar nota* (or Ctrl/⌘ + Enter), and
each note's *Hecha*, *Descartar*, *Reabrir* and *Borrar*. In the list an entry with open notes shows
✎ and how many (red when one asks to redo something), *Con notas* keeps only those, and the header
counts the open ones. They live in `docs/bestiary-notes.json`, tracked so they travel between
machines, created with the first note. The dev server writes it (`bestiaryNotes` in vite.config.ts:
`GET`/`PUT /__bestiario/notas`, checked against the format and written through a temp file); a build
has no server, so there the notes are read-only. The format (`src/bestiary-notes.ts`, checked by
`notesProblem`), two spaces, notes in the order they were made:

```json
{
  "notes": [
    {
      "id": "n-<Date.now() in base 36>",
      "entry": "enemigo:repetidor",
      "name": "El Repetidor",
      "redo": ["modelo"],
      "text": "the comment",
      "status": "abierta",
      "created": "2026-11-19T22:50:00Z",
      "reply": "what was done (optional)",
      "closed": "2026-11-20T10:00:00Z"
    }
  ]
}
```

`entry` is the entry's key (`aliado:`, `anima:`, `enemigo:`, `diseno:`, `npc:` and its id), `redo`
any of the five (none: just a comment), `status` `abierta`, `hecha` or `descartada`. The `bestiario`
skill reads the open ones, does what they ask and writes its `reply` under each, which the page shows.
The screenshots use `?notas=scratch` (output/bestiary/notes-scratch.json), so they never leave a real note.

## The ánimas' sheet

`just animas` opens the ánimas' sheet on the dev server, where it can be commented;
`just animas-report` only writes it, to read without notes to write. Both come from
[scripts/animas.mjs](../scripts/animas.mjs), which writes `output/reports/animas/index.html`:
one page to read and check every ánima's design. For each ánima, its design (its own doc,
`docs/animas/<id>/README.md`, section by section) beside **what the game has of it today**, read from
the code: who it belongs to and how it grows, its attributes, every skill by level or node with its
cost, what it is and its description in the game, its passives, the duals it is half of and what the
jar sells it. An ánima that is only a design shows as such. Then *Dúos* (every dual in the game, and
the pairs and ideas designed), *Mecánicas compartidas* and *Cómo crecen*, from
`docs/animas/README.md`.

Nothing in it is written by hand: change a doc or the game and reload it (served, the page is
written again each time it is asked for: `animasSheet` in vite.config.ts, so any dev server, `just
dev`'s too, serves it fresh at `/output/reports/animas/`), or run `just animas-report` again. A new
ánima shows up when its folder has a `README.md`; it links each ánima's screenshot gallery (`just
screenshots <id>`) when there is one. `just animas-report` puts it in herdr's assets sidebar;
elsewhere it opens (`GERARD_OPEN=0` to not open it). The page a design is checked on while ánimas
are designed one by one (`/anima`, `docs/animas/README.md` § Order of work).

**Notes.** Every page of the sheet (each ánima, *Catálogo*, *Dúos*, *Mecánicas compartidas*, *Cómo
crecen*) has its notes in a column on the right: write one and *Guardar nota* (or Ctrl/⌘ + Enter),
then on each *Editar* (Ctrl/⌘ + Enter saves, Esc leaves it as it was), *Hecha*, *Descartar*,
*Reabrir* and *Borrar* (pressed twice). The list on the left shows ✎ and how many are open beside
each page, and *Notas* gathers them all, open or every one. They live in `docs/anima-notes.json`,
tracked so they travel between machines, created with the first note, and are written through the
dev server (`GET`/`PUT /__animas/notas`, the same `notesEndpoint` as the bestiary's: checked against
the format, written through a temp file). Each change is made on the file as it is at that moment,
so a reply the `anima` skill wrote meanwhile is kept, and coming back to the page reads them again.
Opened as a file (`just animas-report`, the sidebar), the sheet shows the notes as they were when it
was written and cannot change them. The format (`src/anima-notes.ts`, checked by
`animaNotesProblem`), two spaces, notes in the order they were made:

```json
{
  "notes": [
    {
      "id": "n-<Date.now() in base 36>",
      "entry": "papagato",
      "name": "Papagato",
      "text": "the comment",
      "status": "abierta",
      "created": "2026-11-20T09:10:00Z",
      "edited": "when its text last changed (optional)",
      "reply": "what was done (optional)",
      "closed": "2026-11-20T10:00:00Z"
    }
  ]
}
```

`entry` is the ánima's folder in docs/animas/ (its `ClassId`) or one of the sheet's pages
(`catalogo`, `duos`, `mecanicas`, `reglas`), `status` `abierta`, `hecha` or `descartada`. The `anima`
skill reads the open ones on what it works on and writes its `reply` under each, which the page
shows. `just screenshots animas-hoja` uses `?notas=scratch`
(output/reports/animas/notes-scratch.json), so it never leaves a real note.

## Effects lab

*Atacar de Matemágico* plays his thrown Atacar (`src/math-cast.ts`), with no element or with each one,
from Gerard at whoever is picked.

**The model lab** (`just model-lab`, `model-lab.html`, [src/model-lab.ts](../src/model-lab.ts)) shows La Sobremesa (docs/quests/universidad.md) on a turntable: drag to turn, wheel to come closer; each friend's attack and freeing, the couples' duos, and its rig as bones or as weights in colour. `just screenshots model-lab --gpu`. With `?personajes` (`model-lab.html?personajes`, [src/character-lab.ts](../src/character-lab.ts)) it shows the Meshy characters instead (the university friends), standing, walking and running with the clips Meshy's auto-rigging gave them, and up close one by one. `just screenshots personajes-lab --gpu`.

`just dev-fx` (or `?fxlab` on any development URL, `?story=matemagico&fxlab` for a clean run) opens a
fight with chapter 1's boys against three dogs and a panel on the right ([src/fx-lab.ts](../src/fx-lab.ts)).
It plays each fight effect (`FIGHT_FX` in src/effects.ts) under a made-up attack name, each
element's hit, a stat going down or up, every sound effect, fire at its three levels, every status at levels I–III and every reaction (the status
first, then the element) on the picked fighter, thrown from another. Ally effects (shields, cures,
veils) land on the first ally when a dog is picked. It can hide the fight's menu, bring the camera
close, keep effects stacking, repeat the last one or clean everything. It never touches the fight's
numbers or the story. Matemágico's *Foc Binari* has its own entry (the streams, then the burst or
the fizzle). `just screenshots fx-lab --gpu` clicks through it.

**Sincopante · ecos** is a section at the top of the panel ([src/eco-lab.ts](../src/eco-lab.ts),
[src/eco-fx.ts](../src/eco-fx.ts), and its shaders in [src/eco-shaders.ts](../src/eco-shaders.ts)). It shows how Sincopante's ecos will look before the ánima is in
the game:
- *Ostinato* and *Bordón* call an eco over the party;
- *Crescendo* raises them all a grade (*p*, *mf*, *f*);
- *A contratiempo* waits for the off-beat and accents them;
- *Da capo* needs three ecos;
- *Tutti* sends them down on the foes;
- *Apagados* mutes them as if their wearer had switched ánima;
- *Secuencia* plays everything in order.

A line under the buttons shows the compás. `window.ecoLab.act('crescendo')` drives it from the
console. It also works over Las cuerdas with Gerard and Aitor, using the fight tester's link plus
`&fxlab&battle=0`.

`just screenshots sincopante-fx --gpu` catches each moment as it happens. Like the rest of the lab,
it never touches the fight's numbers.

**Polvo de colores · el ánima de Luca** is a section too ([src/powder-lab.ts](../src/powder-lab.ts),
[src/powder-fx.ts](../src/powder-fx.ts)). It shows the dry coloured powder of Luca's ánima before
its rules are in the game:
- *Puff* is the puff alone, *Puñado* a handful thrown at the foe picked and *A todos* one for each;
- *Cubierto* leaves the powder on the foe picked, as the status;
- *Fuego* blows up whoever is covered and leaves every foe burning, *Agua* runs it green and
  poisons them;
- *Cortina* stands a screen of powder in front of an ally, *Telón* one in front of each, and
  *Romper* is the picked foe's blow going through one: it bursts over them and leaves them covered;
- *Color* switches between grey (first round) and the muted mixes, and *Quitar polvo* clears it.

`window.powderLab.act('lanzar')` drives it from the console, and `just screenshots polvo-fx --gpu`
catches each moment. It never touches the fight's numbers.

**Freática · agua contenida** is another section ([src/freatica-lab.ts](../src/freatica-lab.ts),
[src/freatica-fx.ts](../src/freatica-fx.ts)). It shows the water Freática holds under the foes
before the ánima is in the game. Every foe has its own cell; *Enemigo* chooses whose:
- *Subir marca* raises its water a mark (I, II, III; at III the foe is under it);
- *Corriente* runs a current through every foe's water and *Vapor* turns its top mark to steam;
- *Bajar marca* takes a mark off and *Drenar rápido* runs the waters' clocks ten times faster;
- *Romper celdas* breaks them all, as when their wearer falls;
- *Color* switches the edges and the gauges between grey (first round) and their own;
- *Secuencia* plays everything in order and *Quitar agua* clears it.

A second row plays each skill's own look: *Recarga*, *Sondeo eléctrico*, *Bombeo*, *Riada*,
*Golpe de ariete* and its definitiva, *Bajo cero* (it needs a foe at III), with *Golpe al hielo*
(a blow from outside: the ice cracks, and breaks at the third) and *Pasa un turno* (every ice
comes down a mark).

A line under the buttons shows each foe's level, the seconds left on its top mark, its current
and its ice.
`window.freaticaLab.act('subir')` drives it from the console, and `window.freaticaLab.fx` is the
field itself (`foes()`, `set(2)`, `set(3, id)`, `bolt(id)`, `cast.riada()`, `cast.bajoCero()`). `just screenshots freatica-fx --gpu` catches each
moment.
