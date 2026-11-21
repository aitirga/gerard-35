# Whole-game simulator

`just game-sim` plays the whole game headless, from *Desde el principio* to the end of what is
built, many times over, and says how it went: how long it takes, how many days in Barcelona, where
it is hard and where it has gone easy, when the shared ánimas stop growing and which fights are
walls. 48 games take about half a minute.

It is not `just fight-sim` ([fight-sim.md](fight-sim.md)): that one plays a fight with a party chosen
by hand (or by story point) thousands of times. This one plays the story, and every fight in it comes
with the party exactly as the story has it at that moment: its levels, its ecos and what they bought,
the friends' ánimas, who carries what.

## For an AI picking this up

```sh
just game-sim                          # = report: plays 24 games per player, writes the page and data.json
just game-sim run --player pensando    # the numbers in the terminal only
just game-sim play --player casual --seed 36 --trace   # one game, fight by fight, every step and every hunted walk
just game-sim list                     # the simulated players, as JSON
just game-sim run --player pensando --tune growth.rules.scale=0:1:2   # the same games with each number, side by side
just game-sim run --player corredor --set order=nuria/marta/luca/emilie/universidad --set build=tronco
```

The page is `output/reports/game/index.html` (untracked), its data `output/reports/game/data.json`,
which the picker's **Partida** tab reads ([dev-tools.md](dev-tools.md) § Partida).

## How a game is played

`src/game-sim.ts` (pure, seeded: the same player and seed play the same game) drives the real story:

| Part | What it uses |
| --- | --- |
| The story | `Story` from `src/story.ts`, sent the same events the game sends (`interact`, `near`, `room`, `ticket`, `arrive`, `battle`, `home`…), its effects played as `src/main.ts` plays them (a `minion` sends `minion`, an `ambush` sends `caught`, a `doom` rewinds a day…) |
| The places | Each place's grid (`ENVIRONMENTS`), walked by the shortest way; doors and stairs from place to place (`to`, `story.gate`, `story.redirect`; the story's version of a thing replaces the place's, as in `src/game.ts`), the story's own ways (the tower, Las cuerdas, Emilie's door and her model) and the metro (`STATION_PLACES`) |
| Tickets | The first trip to a station that needs one (`isTicketStation`, `ticketFlag` in `src/tickets.ts`) writes its memory under the map first: the `ticket` event, before `arrive`. What the server would make of the text is not played: the memory is taken as right, after a wrong try or two when the player slips. Stations open from the start (`OPEN_STATIONS`) need none. A rewind takes back a ticket written that day, as in the game |
| Emilie's model | Her section's own rules (`src/modelo.ts`) stepped as `src/game.ts` steps them (`stepModelo`, 50 ms at a time): along the gallery to each zone's well, the patrols walking and coming for the party (`tick`), a patrol beaten gone and its power in the lift (`beat`, `charged`, `descend`), the stakes measured on the way (`measure`), and El que no converge calibrated by them before its fight (`calibrate`) |
| Fran's salon | The zones in their order round the crossing (`story.lucaNext`), the queues kept off by `story.blocked`, and the nave's mirrors (`src/espejos.ts`): whoever reads them turns the fewest that bring the light to the chairs, walking round the chaplains so as not to set their fight off first, and they start it dazzled (`dazzle`) |
| Chasers | `src/chasers.ts` with the story's own lists: Uri's fears and their young (`story.fears`), the campsite's rounds, the friends' game of tag (`story.uniChasers`), and at night her guards out of the grates, with lamps, the portal's light and trains (`src/night.ts`) |
| Fights | `createEncounter` (`src/battle.ts`, the one the fight screen opens) and `playOut` (`src/battle-sim.ts`), the fight simulator's bots on the real rules; its EXP and who took part (`fightXp`, `participants`) go back to the story as the game sends them |
| The jar | At home in the morning, the ecos go where the player's build says (`BUILDS`), through `story.improve` |
| Who carries what | The shared ánimas as extras (`story.equip`), the newest the slots hold, taking turns between the carrier and the other |

The route is a list of goals, not a script: each turn of the loop looks at the story and does the
next thing (chapter 1's beats; the wrapper, the snow globe and the news; the castle once; each friend's
mission in the player's order; the way home at night; then the castle to the end). In the castle
([castle.md](castle.md)) it beats the guards before the curtain once, and then each day goes in at the
checkpoint the story gives (`enter-school`), through the doors to that day's generated floor
(`story.place` has its grid and its way out), with its pupils hunting the party (`story.fears`), out
into the boss's room and up to the boss. The Queen the first time takes Aitor (`taken` goes back with
the fight) and Gerard falls; the morning after brings the artilugio, which the bots play in the second
fight (`playOut`); when she falls the player picks its ending (`Player.ending`). A fall, a lost day or a rewind
is picked up where it left the story. A mission lost `patience` times running is left for another one
first, as the city is open.

The five friends' missions, as each is played:

| Mission | Reached by | What the route does | Won when |
| --- | --- | --- | --- |
| Nuria and Uri | Cardedeu | Haru, Nuria, the street, the portal, the tower ring by ring (its young for EXP, its fears), Vertitrón on top | `nuria-uri` |
| The uni friends | Barceloneta | The talk on the sand, the game of tag, the spiral, the campsite's patrols for the padlock's words, El Campeón, Las parcelas, La Sobremesa | `sobremesa` |
| Emilie | Poble Sec | Her door on Margarit, her in the flat, the laptop's whirlpool; in her model each zone along to its well, a patrol beaten for the lift's power (whoever runs past everything backs off from the second once there is power), her stake measured on the way, and El que no converge at the bottom | `converge` |
| Luca | Sagrada Família | The photo at home, looked at on the first morning after the news (the ticker and the photo together are Aitor's lead); the door (Aitor sees him), Luca by the pond, in; the recepción, the nave's mirrors and Los sillones, La carta de colores, El ábside, the chaplain and Fran | `fran` |
| Marta | Alegia, by the long-distance train | Marta, the piano, Las cuerdas' three mazes and their qualities, La Voz | `voz` |

Inside her model, below El suelo, there is no way back out but down (*Volver* is only up there), so a
night that falls in it is spent going on to its bottom; anywhere else the night sends the party home.

### The simulated players

| Player | Fights (`policy`) | Route | Plays |
| --- | --- | --- | --- |
| `pensando` | `smart` | Castle first, Nuria, the uni friends, Emilie, Luca, Marta | Goes for the foes in the way, brings Papagato to level 2 with the tower's young before the fears, buys `mixto` at the jar, Aitor carries the shared ánima; measures every stake in Emilie's model and turns the nave's mirrors |
| `casual` | `casual` | The same | Goes for what is in the way, never grinds, buys nothing; measures one stake in two and leaves the mirrors; **learns**: after losing three times to a fight it plays that fight as `smart` (`learnAfter`), and then also measures every stake before El que no converge and turns the mirrors before Los sillones |
| `corredor` | `smart` | Nuria, Emilie, Luca, Marta, the uni friends; no early castle | Runs past everything it can (in Emilie's model it fights one patrol a zone, for the lift, and backs off from the other), buys `elementos`, reads fast |

People learn, so every player also grinds one level more in the tower after two falls in it
(`seekLevel` and the mission's tries), and gives a foe that beat them a wide berth until a level up
(`feared`). A new player is one more entry in `PLAYERS`.

### Time

A person's time is estimated, not measured: it is for comparing, not a promise.

| Kind | How |
| --- | --- |
| Andar | Cells of the shortest way at running speed (`WALK_SPEED` × 1.5), times `pace` (looking round, wrong turns); with chasers about, played step by step |
| Leer | Every dialogue line: 0.8 s plus its characters at `read` characters a second |
| Combatir | The fight's own clock (`Run.seconds`: each turn's thinking, every blow and every foe's turn) and 11 s of way in and result screen |
| Escenas, metro | Each story beat's seconds on screen (`BEAT`), the metro map and its blackout (10 s) |
| Puzles | The padlock (15 s a try), Las parcelas (two minutes, and a wrong pitch's fight for each slip), Las cuerdas' mazes (a minute or two, and a fall for each slip), a ticket's memory (30 s a try, Alegia's 45, another try for each slip), the nave's mirrors (20 s, and 15 s for each slip), each stake in Emilie's model (2 s stopped, its patrols walking) |
| Mirar alrededor | `explore` seconds the first time in a place |

Walking in Las cuerdas is as the crow flies (its strings change as the song plays).

## Reading the report

| Section | Says |
| --- | --- |
| The cards | Each player's median length (p10, p90), days in Barcelona, fights and losses, rewinds (her castle covering everything and the day taken back), whether and where the game saturates |
| Difficulty | Each fight at the tenth of its game it came in: 100 a fight lost, otherwise the share of the party's PV it took |
| Trivial | The share of fights won with more than 85 % of the PV in three rounds or fewer (`TRIVIAL`). The game **saturates** from the tenth on which every fight left is trivial and none is lost |
| Time | Minutes of each kind |
| Levels | When each shared ánima reaches each level (minute, share of the game, fight number, share of games), and the EXP earned already at the top level, lost |
| Fights | Per fight: times met per game, won the first time, won overall, tries until the first win, PV left when won, rounds, trivial. A **wall** is won the first time in under 35 % of the games (`WALL`); «aprendido», played understood after losing to it. In the terminal, «llega con»: each shared ánima's mean level and the friends' ánimas gathered the first time the fight is met (`EncounterSummary.levels`, `friends`) |
| Al acabar | In the terminal: how many of the shared ánimas end the game at level 5 or more, and at 7, per game, and each one's mean level (`PlayerSummary.grown`). What `LEVEL_XP` and `XP_RULES` are held to: 5 to 7 in some four of the five ([fight-sim.md](fight-sim.md) § Progression). With several `--tune` values it is the column «≥5 · 7» |
| EXP por tramo | In the terminal: the fights of each stretch of the story and the EXP they leave per game (`PlayerSummary.stretches`). `pensando`'s are what the fight simulator's story points count levels from (`STRETCH_XP` in `src/battle-sim.ts`) |
| A typical game | The game nearest the median: each fight (higher, more PV it cost; a cross, lost) and each level |
| What is missing | What the route had to bridge (a stuck walk; the trip to Alegia until 2026-11-19), and in how many games |

## As measured on 2026-11-19

48 games, 16 per player, seed 35 on, before the castle was built:

- `pensando` takes about 84 min (80–93) and 5.5 days, 31 fights, 1.5 lost (the castle's first fall
  is one). Papagato reaches level 2 at a third of the game and its top, 3, at two thirds: from there
  every fight's EXP is lost (530 a game).
- `casual` takes 13 hours at the median (6–26) and 82 rewinds: without each fight's answer El
  Cebollón (30 tries), El Campeón, La Lealtad, Lo Directo, La Sobremesa and La Voz are walls, and the
  days spent learning them let her castle cover everything again and again. This is the design
  working (a fight without its answer is lost) and also a warning: a player who does not read the
  plates is stuck for hours.
- `corredor` takes 4.5 hours: running past the young leaves Papagato at level 1 for El Cebollón and
  La Lealtad, which become walls until the tower's EXP is earned.
- Nothing saturates yet: the castle is what comes after Papagato's top level.

With the castle as tuned the same day (36 games, 12 per player, seed 35 on):

| Player | Finish | Length (p10–p90) | Days | Rewinds | Fights (lost) | Papagato at its top |
| --- | --- | --- | --- | --- | --- | --- |
| `pensando` | 100 % | 149 min (129–188) | 12 | 0 | 57 (5) | 36 % of the game |
| `corredor` | 83 % | 371 min (203–865) | 15.6 | 37 | 171 (37) | 69 % |
| `casual` | 0 % | over 24 hours, cut at 450 fights | 16 | 149 | 452 (117) | 52 % |

- The first year is trivial on purpose (its pupils won with 97–99 % of the PV in one or two rounds);
  Aurelià falls the first time for `pensando` (11 rounds, 28 % of the PV left) and Mar, Montse and
  Pilar nine times in ten (5 rounds, 34 % left). Without the answer (`casual` before it learns) both
  are lost every time.
- **The first Queen kills the party before she takes Aitor two times in three**: the possession comes
  in 32 % of the meetings, so a day or two go before the fall the story asks for.
- **Late in her countdown the castle could not be finished** (fixed 2026-11-19): each boss beaten
  brings the night, so a boss won on the eve of her last day led to a doomed morning and the rewind
  took the win back. Now each castle boss beaten holds her back three days, as an ánima does
  (`Story.heldBack`).
- **The party stops growing before the castle**: Papagato reaches its top level (3) at a third of the
  game for `pensando`; every fight's EXP after that is lost (1,800 a game, 13,000 for `casual`). The
  castle's caps (4, 6, 7 in `CASTLE_UNLOCKS`) have no levels to open yet (`LEVEL_XP` ends at 3).
- Nobody is caught on the way home at night, at any stage: the shortest way from Fabra i Puig runs
  along the far pavement, out of the guards' sight (4 cells in the dark, 12 under a lamp).
- **The artilugio survives a rewind** (decided 2026-11-19, `rewind` in `src/story.ts`): before that,
  the Queen's death on the last day sent the party to a doomed morning and took it back.

With Emilie's and Luca's missions played and the memory tickets written (same day, 72 games, 24 per
player, seed 35 on; before them, in brackets):

| Player | Finish | Length (p10–p90) | Days | Rewinds (max.) | Fights (lost) |
| --- | --- | --- | --- | --- | --- |
| `pensando` | 100 % (100 %) | 176 min, 160–207 (145) | 13.1 (13) | 0, max. 0 (0.3, max. 7) | 66 (4.1) |
| `corredor` | 100 % (100 %) | 353 min, 177–845 (334) | 19.1 (17.2) | 25.2, max. 106 (26.1, max. 144) | 151 (35.3) |
| `casual` | 33 % (42 %), the rest cut at 450 fights | 1,325 min | 25.9 (21.5) | 116.5 (120.7) | 426 (134) |

| Fight | `pensando`: first win · PV left · rounds | `corredor` | `casual` |
| --- | --- | --- | --- |
| Celdas secas | 100 % · 57 % · 4.9 | 100 % · 53 % · 6.3 | 46 % · 51 % · 6.3 |
| Oscilaciones | 100 % · 80 % · 4 | 100 % · 75 % · 4.3 | 100 % · 57 % · 5.3 |
| La pluma | 100 % · 61 % · 4.9 | 83 % · 30 % · 7.3 | 29 % · 35 % · 7 (wall) |
| El que no converge | 100 % · 84 % · 7.8 | 100 % · 87 % · 9.5 | 0 % · 80 % · 10 (wall) |
| La recepción | 100 % · 100 % · 1 | 100 % · 87 % · 3.2 | 88 % · 73 % · 4.2 |
| Los sillones | 100 % · 57 % · 3.1 | 4 % · 46 % · 5 (wall) | 0 % · 56 % · 4.8 (wall) |
| La carta de colores | 100 % · 51 % · 5.1 | 100 % · 44 % · 6.7 | 17 % · 56 % · 7 (wall) |
| El ábside (cut 2026-11-20: Fran's zone, no fight) | 96 % · 51 % · 9.6 | 58 % · 47 % · 10.5 | 0 % · 36 % · 10.8 (wall) |
| Fran | 100 % · 68 % · 6.8 | 100 % · 56 % · 10.1 | 71 % · 31 % · 7.3 |

La pluma's row is from before 2026-11-20, when El Átomo took its place (`modelo-atomo`, docs/quests/emilie.md
§ El Átomo); its own numbers are in [fight-sim.md](fight-sim.md) § Emilie's model.

- **Two more ánimas end the rewinds for whoever reads the fights**: six more days of grace, and the
  first Queen takes Aitor in 36 % of the meetings (22 % before). The 7 rewinds `pensando` had in one
  game (seed 56) were 21 falls running to the first Queen before she took Aitor, days 7 to 21, until
  her countdown ran out; the Alegia train's three hours only moved which games drew that run.
- **Los sillones is a wall for a party that comes to Luca before Nuria's mission is won.** The city
  opens before it, and whoever leaves the tower for later (`corredor` after two falls to El Cebollón)
  meets the chaplains with Matemágico and Tecnópata at level 1, and Tecnópata with only its first
  skill (Explosión, Confusión and Rayo encogedor come from the jar, and `elementos` buys none): lost
  even dazzled and played well, until Papagato is theirs at level 2. The fight simulator does not see
  it, as its parties get Tecnópata's three skills for free (`nodesFor`; with them the same pair wins
  82 %) and its story points have Nuria's mission done first. El ábside is the same, less so.
  Emilie's model does not have this: El que no converge is won with that party (as its
  `no-converge-primer-dia` target asks).
- Emilie's and Luca's fights are no wall for `pensando`; La recepción is trivial for it (it teaches).
- `casual` finishes less (33 %): it cycles through five missions it cannot win yet, and more of its
  games reach the 450-fight cut.

## Trying numbers

`--tune` takes the fight simulator's numbers ([fight-sim.md](fight-sim.md) § For an AI picking this
up: `book.id.field`), applied to every fight, level and bonus of the game. With one value each the
report is written apart, in `output/reports/game-prueba/`, so the picker's page stays the game as it
is. With several, each combination plays the same seeds and they are compared in one table (finish,
median length, fights and losses, rewinds, trivial share, the level each shared ánima reaches in half
the games or more, walls), and no page is written.

```sh
just game-sim run --tune growth.rules.scale=0:1:2      # what each friend's ánima adds: nothing, as it is, doubled
just game-sim run --tune level.xp.2=950:1290 --tune xp.rules.castle=1:3   # level 4's EXP and what the castle's fights are worth
just game-sim run --tune foes.growth.stat=0:0.5:1        # the open missions' foes: as tuned, keeping up, ahead
just game-sim run --tune stage.1.cap=4:5 --player pensando
```

`--set field=value` changes how the chosen players play (any field of `Player`: `order` with `/`,
`build`, `policy`, `carrier`, `engage`, `grind`, `seekLevel`, `castleFirst`…): the same person in
another order, or buying something else at the jar.

The whole game starts its fights with `createEncounter`, as the game does, with the story's ánimas:
an open mission's foes grow with the others' behind it (`foes.growth.stat`, `foes.growth.pv`:
[fight-sim.md](fight-sim.md) § Progression), in whatever order the player does them.

## Trying a rule: without her countdown

`just game-sim report --sin-cuenta-atras` plays the same games with no end to her countdown (the
story never reaches a doomed morning; `Playing.rules`), and writes its page apart, in
`output/reports/game-sin-cuenta-atras/`. Measured 2026-11-19, 12 games a player, the castle tuned:

| Player | Finish (with → without) | Median length | Rewinds | Mar, Montse and Pilar met |
| --- | --- | --- | --- | --- |
| `pensando` | 100 % → 100 % | 126 → 126 min | 0 → 0 | 1.1 → 1.1 |
| `corredor` | 83 % → 92 % | 354 → 300 min (p90 865 → 385) | 35 → 0 | 14.9 → 1.8 |
| `casual` | 0 % → 0 % | 1,449 → 423 min, stopped further on | 149 → 0 | Aurelià 49 → 2.3 |

The countdown never touches a player who reads the fights (`pensando` ends on day 10 of 16). It only
acts on those who are losing, and then not as a choice but as a loop: each day lost to a fight brings
the end nearer, and on the last day every win that ends the day (a boss brings the night) is taken
back by the rewind; with every friend's ánima already won nothing pushes her back.

## Extending it

- A new mission: its route in `mission()` (`src/game-sim.ts`), from wherever its run can be; the flag
  its win sets in `missionDone()`; its station in `MISSION_STATIONS`; its place in each player's
  `order`; its fights' names in `ENCOUNTER_NAMES`. A new story flag needs nothing here unless the route
  has to set it; a new station's ticket needs nothing (`ride` writes it the first time).
- A new place reached on foot needs nothing: doors are followed. One reached by a story interaction
  that travels goes in `STORY_WAYS`.
- Rules a place plays by on its own (a section like Emilie's, a puzzle that moves the party) are
  stepped with the same pure functions the game uses, not walked on the grid (`section`, `sectionWalk`).
- A new kind of chaser goes where `refreshHunters` asks the story for them.
- Anything the route has to bridge goes through `gap()`, so the report lists it.
