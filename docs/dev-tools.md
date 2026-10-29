# Development tools in the game

The place panel (top left) names where Gerard is. Clicking the place's name opens its picker
([src/jump-menu.ts](../src/jump-menu.ts)), a list under the panel with the street still in view.
Arrows walk it, Enter picks, Escape or a click outside closes it, and the game waits while it is open.
In development F2 opens it from anywhere, fights included, where it also has a *Depuración* button
over the fight.

In production it only lists the places the old dropdown offered. In development (`just dev`) it
has three tabs and lists every place.

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
- **Misiones de ánima**: each friend's mission is its own arc, starting from the first metro. A
  step of one mission brings none of the others: Uri's ánima does not need Nuria's.
- **Día** and **Con ánimas**, over chapter 2, choose the day a chapter 2 jump wakes up on
  (`&day=<n>`, as `just dev-day`) and which other missions it starts with done (`&with=nuria,uri`),
  so any mix can be tried. *Con ánimas* starts with the missions the story has done; a mission only
  joins jumps that reach where it starts.

The step the story has reached is marked, and those behind it are brighter.

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
  the gum guards. Dogs come 1 to 4; the guards are as many and as strong as the friends' ánimas
  leave them.
- **Ayudas**: *Inmunidad* (no blow takes the party's PV) and *PM infinitos* (skills cost nothing).

Each fight is staged where the story stages it (game.ts): the dogs in Passatge Maresme, the
minion and the guards in the palace, so the tester takes Gerard there first. A test fight
touches no story flag, saves no ánima choice, and puts the street back as the story has it when
it ends. The last setup is remembered in this browser.

### During a fight

In any fight, the story's too, the Combate tab becomes the fight's own page:

- **Ayudas**: *Inmunidad* and *PM infinitos*, on or off at once (a test fight starts with its setup's).
- **Saltar a**: *Victoria* or *Derrota* (its result screen, as if it had happened), *Enemigos a
  1 PV* or *Equipo a 1 PV* (the next blow decides), and against the palace minion *El «¡NO!» de
  Gerard*, its beat: Bernat on his knees, Gerard says no and Noísta wakes. Jumps wait for a
  player's turn. A boss with phases adds its own moments here (`FightMoment` in
  `src/battle-ui.ts`).
- **Salir del combate**: the fight ends at once, with no result for the story. Picking a place in
  Lugares also leaves the fight first.

A story fight left or jumped from here still counts as the story's when it ends with a result
(Victoria and Derrota do); leaving does not.

`just screenshots jump-menu` shows the three tabs, the story's arcs, two jumps and where they land,
test fights in both chapters and the fight's own page.

## Keeping it complete

Everything new in the story has to be reachable from here (AGENTS.md):

- A new story flag: a step in its arc in `STORY_ARCS` in `src/story-points.ts` (TypeScript asks
  for one for every flag in `STORY_FLAGS`), with a `spot` if it happens away from where the story
  resumes, and its name in the `dev-chapter` list in the justfile. A new ánima mission is a new arc
  with `anima` and the step it starts `after`; its flags are its steps, in the order it plays.
- A new place: its entry in `PLACES`, in its area's group, with `open: true` only if production
  players may pick it too.
- A new fight, foe, ánima or skill: playable from the fight tester (`FightSetup`, `startFight` in
  `src/main.ts`), with its stage in `FIGHT_PLACES` if it is fought somewhere new. A fight with
  phases (a boss) gets a `FightMoment` for each, so the picker can jump to it.
