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
```

The page is `output/reports/game/index.html` (untracked), its data `output/reports/game/data.json`,
which the picker's **Partida** tab reads ([dev-tools.md](dev-tools.md) § Partida).

## How a game is played

`src/game-sim.ts` (pure, seeded: the same player and seed play the same game) drives the real story:

| Part | What it uses |
| --- | --- |
| The story | `Story` from `src/story.ts`, sent the same events the game sends (`interact`, `near`, `room`, `arrive`, `battle`, `home`…), its effects played as `src/main.ts` plays them (a `minion` sends `minion`, an `ambush` sends `caught`, a `doom` rewinds a day…) |
| The places | Each place's grid (`ENVIRONMENTS`), walked by the shortest way; doors and stairs from place to place (`to`, `story.gate`, `story.redirect`), the story's own ways out (the tower, Las cuerdas) and the metro (`STATION_PLACES`) |
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

### The simulated players

| Player | Fights (`policy`) | Route | Plays |
| --- | --- | --- | --- |
| `pensando` | `smart` | Castle first, Nuria, the uni friends, Marta | Goes for the foes in the way, brings Papagato to level 2 with the tower's young before the fears, buys `mixto` at the jar, Aitor carries the shared ánima |
| `casual` | `casual` | The same | Goes for what is in the way, never grinds, buys nothing; **learns**: after losing three times to a fight it plays that fight as `smart` (`learnAfter`) |
| `corredor` | `smart` | Nuria, Marta, the uni friends; no early castle | Runs past everything it can, buys `elementos`, reads fast |

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
| Puzles | The padlock (15 s a try), Las parcelas (two minutes, and a wrong pitch's fight for each slip), Las cuerdas' mazes (a minute or two, and a fall for each slip) |
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
| Fights | Per fight: times met per game, won the first time, won overall, tries until the first win, PV left when won, rounds, trivial. A **wall** is won the first time in under 35 % of the games (`WALL`); «aprendido», played understood after losing to it |
| A typical game | The game nearest the median: each fight (higher, more PV it cost; a cross, lost) and each level |
| What is missing | What the route had to bridge (the trip to Alegia, a stuck walk), and in how many games |

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

- A new mission: its goals in `mission()` (`src/game-sim.ts`), from wherever its run can be, and its
  fights' names in `ENCOUNTER_NAMES`. A new story flag needs nothing here unless the route has to set it.
- A new place reached on foot needs nothing: doors are followed. One reached by a story interaction
  that travels goes in `STORY_WAYS`.
- A new kind of chaser goes where `refreshHunters` asks the story for them.
- Anything the route has to bridge goes through `gap()`, so the report lists it.
