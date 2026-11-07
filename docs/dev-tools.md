# Development tools in the game

The place panel (top left) names where Gerard is. Clicking the place's name opens its picker
([src/jump-menu.ts](../src/jump-menu.ts)), a list under the panel with the street still in view.
Arrows walk it, Enter picks, Escape or a click outside closes it, and the game waits while it is open.
In development F2 opens it from anywhere, fights included, where it also has a *Depuración* button
over the fight.

In production it only lists the places the old dropdown offered. In development (`just dev`) it
has four tabs and lists every place. Historia and Misiones are wide, with the **Ánimas** column
on their right.

## Lugares

Every place, grouped by area, with a search box. Picking one moves Gerard there, as walking
through a door would, without touching the story. The places the game only reaches through a
door (the house's floors, the palace) say "solo depuración".

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

- **Chapter 1** runs in one line: *En casa*, *Con Bernat*, *El palacio*, each arc after the one before.
- **Chapter 2** is open: *El despertar*, then *La ciudad* from the news on.
- **Día** and **Con ánimas**, over chapter 2, choose the day a chapter 2 jump wakes up on
  (`&day=<n>`, as `just dev-day`) and which other missions it starts with done (`&with=nuria`),
  so any mix can be tried. *Con ánimas* starts with the missions the story has done; a mission only
  joins jumps that reach where it starts.

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

A mission without its own list offers its beginning and each of its steps.

## Ánimas

The column on the right of Historia and Misiones: every ánima, with *No* and each level it can
reach (*Nv 1* to *Nv 3*). It shows the ánimas unlocked now; the story's own level is
underlined in gold, so a change shows against it. A pick applies at once: the status screen, the
interface's colours, L and R in the fight on now and its skills, and the next fights, the
tester's too. *Volver a las de la historia* gives back what the story has unlocked up to here.

It is not saved and sets no flag (`story.debugAnimas`), and no ánima earns EXP from fights while it
is set; a jump starts again with what the story gives at that point.

Under each ánima the story has unlocked, its EXP and two buttons that make it grow **for real**, as a
won fight would (`story.giveXp`): *+25 EXP*, and *Subir de nivel* (exactly the EXP its next level
needs). The EXP is kept, a level reached sets its flag and shows its note (*ÁNIMA · NIVEL 2 · Aprende
…*), and they give back the story's ánimas first, so what shows is the story's. Both are greyed out at
the top level.

Under them, **Ecos de luz**: how many there are and how many are free, *+1 eco* and *−1 eco* (on top
of the story's, not saved, `story.debugEcos`) and *Abrir el bote*, which opens the jar's screen
wherever Gerard is.

During a fight, *Saltar a* also has **Victoria subiendo de nivel**: it wins with EXP enough for every
ánima that took part to reach its next level (`BattleState.extraXp`), to see the victory screen's
level-up.

## Combate

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
  Dogs come 1 to 4; the guards are as many and as strong as the friends' ánimas leave them.
- To try **Ángulo exacto**, **Ronroneo de Yuki** and the **duals**, the Ánimas column sets the
  levels (Matemágico and Papagato at *Nv 2* reach all of them) and *Equipo* + *Ánimas* put
  Matemágico on Gerard and Papagato on Aitor.
- **Ecos de luz** (chapter 2): the improvements of the ánimas in the fight, whatever they would cost
  (Matemágico's elements, each ánima's maná). Asleep ones (Pasiva, Definitiva) do not show.
- **Ayudas**: *Inmunidad* (no blow takes the party's PV), *PM infinitos* (skills cost no
  Ánima) and *Sin límites*: every ánima unlocked at its top level for whoever can wear it (each
  can switch to all of theirs), maná always full in every one, and skills with no limit of use (a
  cure on anyone standing, a boost or a mark again while it runs, every dual as often as wanted;
  `BattleState.unbound`, `unboundAnimas` and `applyHelp` in `src/main.ts`).

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

- **Ayudas**: *Inmunidad*, *PM infinitos* and *Sin límites*, on or off at once (a test fight starts
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
  tried with one player and no queue. Outside development there is no such command and the menu is
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
is done when its checks hold against the checkout (a file exists, a text is or is not in a file) or
when it says `done = true`, for what code cannot tell. Adding an item makes the bar shrink; finishing
or deleting one makes it grow. The file's header explains the checks.

`scripts/herdr-progress` draws the total, the story a player can walk through, the priorities and
the blocks. herdr opens it at the top of every tab's column in this project, because having the script is what
turns it on (the `herdr-project` skill), and it looks again every 5 seconds. It measures its own checkout, so a feature's workspace shows that branch.
`just progress` prints it once and `just progress --all` lists every item.

## Effects lab

*Atacar de Matemágico* plays his thrown Atacar (`src/math-cast.ts`), with no element or with each one,
from Gerard at whoever is picked.

`just dev-fx` (or `?fxlab` on any development URL, `?story=matemagico&fxlab` for a clean run) opens a
fight with chapter 1's boys against three dogs and a panel on the right ([src/fx-lab.ts](../src/fx-lab.ts)).
It plays each fight effect (`FIGHT_FX` in src/effects.ts) under a made-up attack name, each
element's hit, a stat going down or up, every sound effect, fire at its three levels, every status at levels I–III and every reaction (the status
first, then the element) on the picked fighter, thrown from another. Ally effects (shields, cures,
veils) land on the first ally when a dog is picked. It can hide the fight's menu, bring the camera
close, keep effects stacking, repeat the last one or clean everything. It never touches the fight's
numbers or the story. Matemágico's *Foc Binari* has its own entry (the streams, then the burst or
the fizzle). `just screenshots fx-lab --gpu` clicks through it.
