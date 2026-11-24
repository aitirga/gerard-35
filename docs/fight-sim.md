# Fight simulator

`just fight-sim` plays the campaign's real fights without a screen, thousands in seconds. It calls
the same `act`, `enemyAct`, `nextRound` and `runClock` as the fight screen (`src/battle.ts`), in the
same order, so a rule changed in the game is a rule changed here. Use it before and after touching
any fight, foe, skill or level.

It is not `just combat-sim`: that one is the generic engine's lab, on a synthetic three against three
(`docs/combat.md`), and cannot play the campaign's fights.

## For an AI picking this up

```sh
just fight-sim list                 # what there is, as JSON: fights, skills, policies, foes, targets
just fight-sim check                # are the fights still what they are meant to be? exit code 1 if not
just fight-sim run --json           # the numbers and their conclusions, as JSON and nothing else
```

Then the bench, for deciding what to change (§ The balance bench):

```sh
just fight-sim coverage             # what no target holds yet: fights without their pair, skills nobody plays
just fight-sim levers --fight plato # the numbers that fight turns on, and which way each one pushes it
just fight-sim optimize --fight plato --auto 3   # the numbers that put its targets where they should be
just fight-sim skills               # what each skill is worth, and what each fight becomes without it
just fight-sim progress             # whether the party's growth keeps step with the story
just fight-sim curve --done emilie  # what each fight should be from where the player is: side missions, castle, night
just fight-sim optimize --curve --done emilie --fight voz --auto 4   # the numbers that hold that curve
```

Every list is a set of combinations: this one plays 3 fights × 2 parties × 2 levels × 2 bots × 2 bans.

```sh
just fight-sim run \
  --fight crias-1,cebolla,cebollon \
  --party gerard:papagato+aitor:matemagico,gerard:papagato+aitor:papagato \
  --level papagato=1,papagato=2 \
  --policy casual,smart \
  --ban none,zarpazos
```

To try numbers, do not edit the code: `--tune book.id.field=a:b`, repeatable. With `check` it ranks
the combinations by how many targets hold, which is the quick way to tune:

```sh
just fight-sim check --tune onion.cebollon.layers=10:12:14 --tune onion.cebollon.perLayer=3:4
just fight-sim run --fight uri-vertigo --party gerard:matemagico+aitor:papagato \
  --level papagato=2/matemagico=2 --tune vertigo.boss.rayo=28:36 --tune dual.zarpazos-de-fuego.power=7:8
```

| Book | Where | Example |
| --- | --- | --- |
| `onion` | `ONIONS` (`src/battle.ts`) | `onion.cebollon.layers` |
| `foe` | `PROFILES` (`src/stats.ts`), Vertitrón's eye too | `foe.vertigo.pv`, `foe.vertigo-ojo.pv` |
| `brood` | `BROOD`, the tower's young | `brood.fantasmita.gameOver` |
| `skill` | `SKILLS` | `skill.zarpazos.strikes` |
| `dual` | `DUALS` | `dual.zarpazos-de-fuego.power` |
| `vertigo` | `VERTIGO`, the final boss's whole book, as `vertigo.boss` | `vertigo.boss.pisoton`, `vertigo.boss.gritoDown` |
| `reaction` | `REACTION_RULES`, what the elements turn | `reaction.rules.storm`, `reaction.rules.plasma` |
| `cegado` | `TIMED.cegado` and `CEGADO`: how long Cegado lasts, and how often its physical blows miss in smoke and in Explosión's flash | `cegado.rules.seconds`, `cegado.odds.smoke`, `cegado.odds.flash` |
| `powder` | `POWDER_RULES`, what the elements make of Colorista's powder | `powder.rules.blast`, `powder.rules.poison`, `powder.rules.shard` |
| `camping` | `CAMPING`, Càmping Eurocamping's foes, as `camping.rules` | `camping.rules.bombona`, `camping.rules.punetazo` |
| `marta` | `MARTA`, Las cuerdas' foes and La Voz, as `marta.rules` | `marta.rules.vozRe`, `marta.rules.acorde`, `marta.rules.directo` |
| `castle` | `CASTLE` (`src/castle.ts`), the castle's pupils, Aurelià, Dirección and the Queen, as `castle.rules` | `castle.rules.resolucion`, `castle.rules.year3`, `castle.rules.reinaVuelta` |
| `modelo` | `MODELO`, the foes of Emilie's model and El que no converge, as `modelo.rules` | `modelo.rules.seca`, `modelo.rules.descargaStep`, `modelo.rules.convergeTurns` |
| `fear` | `FEAR_RULES` as `fear.rules`, and El Plato's blow as `fear.plato` (the onions hit with `ONIONS`, Vertitrón with `VERTIGO`) | `fear.rules.escortLayers`, `fear.plato.power` |
| `luca`, `sobremesa`, `night` | `LUCA`, `SOBREMESA`, `NIGHT_PUPILS`, as `luca.rules`, `sobremesa.boss`, `night.rules` | `luca.rules.brillo`, `night.rules.perFriend` |
| `guards` | `GUARDS` (`src/battle.ts`), the palace guards before the curtain, as `guards.rules` | `guards.rules.hp`, `guards.rules.animasPerGuard` |
| `crit` | `CRIT_RULES`: how much harder a golpe crítico lands, and how much of each one's Crítico counts | `crit.rules.bonus`, `crit.rules.chance` |
| `class` | `CLASS_STATS`, what wearing an ánima adds | `class.papagato.fuerza`, `class.dadaista.critico` |
| `anima` | `ANIMAS`' `bonus`, what each friend's ánima adds to everyone | `anima.nuria.pv`, `anima.marta.velocidad` |
| `growth` | `ANIMA_GROWTH` (`src/animas.ts`) as `growth.rules`: every ánima's bonus times `scale`, and `pv` and `stat` more for each one gathered | `growth.rules.scale`, `growth.rules.stat` |
| `level`, `xp`, `stage` | `LEVEL_XP` (`level.xp.0` is level 2's EXP, `level.xp.5` level 7's), `FOE_XP`, `XP_RULES` (what a fight inside the castle is worth, times its foes) and `CASTLE_UNLOCKS` | `level.xp.2`, `xp.foe.cebollita`, `xp.rules.castle`, `stage.2.cap` |
| `foes` | `FOE_GROWTH` and `FIGHT_GROWTH` (`src/battle.ts`): how an open mission's foes grow with the other missions' ánimas behind it, the rule for all and each fight's own (§ Progression, § The final pass, as done) | `foes.growth.pv`, `foes.growth.stat`, `foes.<fight>.pv`, `foes.<fight>.stat` |

`just fight-sim levers --fight <fight>` lists the ones a fight reads, so nobody has to guess a path.

What the Ecos de luz are in is one more list, `--improved`, of `src/ecos.ts` ids joined with `/`
(`none` for nothing). The bots may give an Atacar any element it has:

```sh
just fight-sim run --fight uri-vertigo --party gerard:matemagico+aitor:papagato --level matemagico=2/papagato=2 \
  --improved none,matemagico:agua/matemagico:electrico,papagato:mana-1
```

Then, to decide:

1. Change the numbers for real (`ONIONS`, `SKILLS`, `DUALS`, `VERTIGO`, `FEAR_RULES` and `FEAR_FOES` in
   `src/battle.ts`, `PROFILES` in `src/stats.ts`).
2. Run `just fight-sim check`. A target that no longer holds means the fight changed: fix the fight, or
   change the target in `TARGETS` (`src/battle-sim.ts`) on purpose, with its reason in `why`.
3. `just check` runs the targets too (`tests/battle-sim.test.mjs`), so a fight cannot drift unnoticed.

## Reading a row

| Field | Means |
| --- | --- |
| `win`, `winCI` | Share of fights won and its 95 % Wilson interval. With few `--runs` it is wide: read it |
| `draws` | Fights that hit the round limit. Anything but 0 is a warning: something can go on for ever |
| `rounds`, `roundsWon`, `roundsLost` | Mean length of a fight, of those won (how long the way to win takes) and of those lost (how quickly it kills) |
| `hpLeftWon` | Party's PV left when it wins: a win at 5 % and one at 90 % are not the same fight |
| `kos`, `firstKo`, `koRate` | How many fall, the round the first falls in, and how often anyone does |
| `peeledBy`, `peeledRate` | Round the onions lose their last layer, and how often they do |
| `used`, `damageShare` | Mean uses per fight of each action (dual ids included), and the share of the damage each one did |
| `duals` | Mean dual attacks per fight |
| `events` | Mean times per fight the foes did each thing (`aplaston`, `puaj`, `grito`, `rayo`…), Vertitrón's eye was broken (`ojo-roto`), and which action spent a Punto débil (`triple:<action>`) |
| `biggest`, `biggestMax` | The most PV one action of the party took off: mean over fights, and the most in any. How close anything comes to a one-shot |

`conclusions` says in plain words what changed the result between rows (level, ban, party, bot,
tuning), and `AVISO` lines flag what looks wrong: fights that do not end, trivial ones, impossible
ones, and skills or duals `smart` could use and never does.

## The bots

| Policy | Plays like |
| --- | --- |
| `attack` | Only Atacar. The floor to compare with |
| `random` | Any legal action |
| `casual` | Whatever takes the most PV now; no changing ánima, no defending; 15 % slips |
| `smart` | Peels, finishes, defends against the blow coming, minds its maná, changes ánima; 5 % slips |

**Bots are not people.** They compare setups with each other; they do not measure how a fight feels,
and `smart` knows who is about to be hit, which a person only works out. A rule the bots have no value
for may look useless until `worth` (`src/battle-sim.ts`) learns about it: it plays each option on a
copy of the fight and looks at what happened, so most new mechanics are measured with no work.

Fights have little luck of their own (the packs' mix, Zarpazos de fuego's coins), so without slips
most setups would be 0 % or 100 %. The slips (`--error`) are what spread them, and `--think` is how long a player takes per
turn, which matters because fire burns meanwhile (`docs/combat.md` § Estados en tiempo real).

`smart` values each option by what it does on a copy of the fight, plus a few things a copy cannot
show yet: a layer off an onion, Sangrado and fire put on, a debuff's mark (about three hits per ally
standing), a fresh Punto débil (what the next blow on it would add, a dual included), PV off Vertitrón's eye
(×0.8: they bring no win closer, but the eye broken is worth 30 more, since no Rayo comes after), mental statuses taken away, the blow and the Mareo Defender avoids, and the
maná Defender gathers (5 a point: with one ánima each, as in the dual party, it is the only way maná
comes back). Each copy rolls its own dice, so a bot never sees the real fight's next coin.

Not simulated: chapter 1's boys and the palace minion's scripted beat.

## Duals

Gerard on Matemágico and Aitor with Papagato equipped beforehand (the party `gerard:matemagico+aitor:papagato`,
`DUO` in `src/battle-sim.ts`) can make dual attacks; the mission party (`gerard:papagato+aitor:-`, Aitor
wearing nothing) cannot. Nobody hands an ánima over in a fight, so there is no option for it.

- `smart` plans them: when a dual is possible it compares it with its best turn alone plus its
  partner's best reply after it (two plies), and takes the dual only when it is worth more. A dual's
  maná counts both halves.
- `casual` never looks for one. As in the game, the partner sometimes queues a choice ahead
  (`QUEUE`: 60 % for `casual`, 50 % for `random`), their greedy one; when the first fighter's skill
  and that queued skill make a dual, it fires, as people find them. Otherwise the queued choice plays
  when its turn comes, if it still can.
- `random` may pick a dual among its legal moves, and queues like `casual`.
- A dual's cinematic runs the fight's clock `DUAL_CLOCK` seconds (fire burns meanwhile); the
  partner's thinking overlapped the first one's.
- `--ban duals` bans them all, `--ban punto-debil` one, and banning a skill bans every dual it is
  half of (`--ban zarpazos` also takes Zarpazos de fuego away).

## Targets

`TARGETS` (`src/battle-sim.ts`) can hold `win`, `roundsWon`, `roundsLost`, `hpLeftWon` and `duals` to
ranges, and `happens` (how many times an event comes about in a fight on average: the Queen's first
fight cannot be won, so its pair is whether the party gets her to the tenth where she takes Aitor); a target with any fight left unfinished at the round limit always fails. Uri's tower is held
with both parties: the mission party for the onions and the young, the dual party (`DUO`) for the
duals, at the levels the tower reaches (Papagato 2, Matemágico 1 or 2; 3 for whoever grinds).

**Every fight keeps a pair** (`docs/combat.md` § La respuesta de cada combate): one target that plays
the fight's answer and one that does not. Name the answer in both `why`s.

| Target | How to play it | Holds |
| --- | --- | --- |
| With the answer | `smart`, with the party the fight is met with | `win` from .9 up (a final boss may sit lower on purpose), and `roundsWon` or `hpLeftWon` clearly better than without |
| Without the answer | `smart` with the answer banned (`ban`) when it is a skill, a dual or a kind of blow; `casual` when it is an order or a moment, which a ban cannot take away | `win` up to .2 |

`attack` alone is not the pair's second half: a fight that only asks for "something other than Atacar"
asks nothing. A fight that only teaches needs no pair, just a target that holds it easy: the first
fights of the game (`FIRST_FIGHTS`), each mission's way in and one room on each floor of the castle
(`teaching` in `MISSIONS` and `CASTLE_STAGES`). `pairsOf` (`src/balance.ts`) is the rule in code:
`just fight-sim coverage` and `just progress --audit` both read it. See § The pair, as retuned on 2026-11-15 for where each fight stands.

Matemágico and Tecnópata no longer level (2026-11-15: their skills are nodes bought at the jar,
`docs/animas/README.md` § The jar). The sim keeps the old shorthand so the targets still mean
what they meant: `matemagico: 2` gives the Cálculo nodes its level 2 had (Ángulo exacto,
Análisis Parálisis), `3` adds Cardioide, and Tecnópata always has Explosión, Confusión and Rayo
encogedor (`nodesFor` in `src/battle-sim.ts`). No target plays the new nodes yet (Factor común,
Vasos comunicantes, Descarga, Control remoto, the passives): their numbers are first guesses.

## The pair, as retuned on 2026-11-15

| Fight | With the answer (`smart`) | Without (`casual`) | What changed |
| --- | --- | --- | --- |
| El Plato Misterioso | 100 % | 2 % | Its blow 38 and ¡Puaj! 38 |
| Vertitrón | 100 % (99 % with no duals) | 12 % | 415 PV; weak to Agua, resists Eléctrico |
| Parcela negra | 95 % | 11 % (5 % with two magic ánimas) | Magos 130 PV; weak to Agua, resist Fuego |
| El Campeón | 100 % | 7 % | Puñetazo 56 |
| La Lealtad | 93 % | 20 % | See Las cuerdas below |
| Lo Directo | 99 % | 14 % | See Las cuerdas below |
| La Voz | 98 % | 17 % | See Las cuerdas below |

Left easy on purpose, as the fights that teach: the cebollitas, the platitos, the campsite's entrance,
dice, agentes and tent. Not done: La Cebolla at level 1 (its question is the level, not the play),
the third ring's packs (57 % `casual`) and Lo Cristalino.

## Story points

`just fight-sim story` plays each fight with the party that reaches it in the story, instead of a
party and levels chosen by hand. The story is Nuria and Uri's mission as the introduction, then the
rest in whatever order the player likes (`MISSIONS` in `src/battle-sim.ts`), so an open mission is
measured from being the first one done to being the last, and then the castle, a stretch per boss
(`CASTLE_STAGES`: `castillo-1` up to Aurelià, `castillo-2` to Dirección, `castillo-3` to the Queen),
each with every mission behind it and what its stage has opened (`CASTLE_UNLOCKS`).

```sh
just fight-sim story                                   # every open mission, first and last, and the castle's three; builds nada and mixto
just fight-sim story --at marta:first,marta:last --build elementos --fight cuerdas-directo,voz
just fight-sim story --at marta:universidad --policy smart
just fight-sim story --at castillo-3 --level papagato=7/dadaista=7 --party gerard:matemagico/papagato+aitor:tecnopata/dadaista
```

| A point has | From |
| --- | --- |
| The friends' ánimas of what is behind it (their bonus) | `MISSIONS[id].friend` |
| The ecos of what is behind it | `MISSIONS[id].lights` (Nuria and Uri 2, the uni friends 5, Marta 1) |
| What those ecos bought | `--build`, a shopping list in order (`BUILDS`): `nada`, `mixto`, `elementos`, `tronco`; only what the ecos pay for is bought (`withinEcos`), and nothing is given for free on top (`Setup.exact`) |
| Each shared ánima's level | From the EXP of the stretches fought since its friend's mission (`STRETCH_XP`, what `just game-sim` measures as «EXP por tramo») against `LEVEL_XP`, under the castle's cap; Papagato never under 2. `--level` puts them by hand |
| What the jar offers | Only what the castle's stage has opened: grade III from `castillo-2`, the definitivas from `castillo-3` |
| Ánimas unlocked | Each one's own and the one each mission behind left (`FRIEND_ANIMA`) |

The levels are those of an ánima that is always worn. Whoever takes turns between several shared ánimas
has each of them lower: `just game-sim` prints the levels each player really brings to each fight
(«llega con»).

A party can name what each one can switch to in the fight, after a `/`:
`gerard:matemagico/papagato+aitor:tecnopata/dadaista` (Gerard wears Matemágico and can change to
Papagato). Without it each has their own ánima and the one worn, as the fights were tuned.

The party itself is `--party` (the dual party by default). The `TARGETS` still play their hand-picked
setups; the final balance is to be done against these points once every mission is in (§ The final
pass). A new mission is one more entry in `MISSIONS`; a new way of spending, one more list in `BUILDS`.

## The balance report

`just fight-sim report` puts everything on one page, `output/reports/balance/index.html` (untracked,
about a minute): the story-point matrix with each fight's pair (`smart` and `casual`, and whether it
holds: `PAIR` in `src/battle-sim.ts`), a detail per cell (rounds, PV left, damage by action, what the
foes did), the `TARGETS`, what each foe is made of, and every number `--tune` takes with its path.
`scripts/fight-sim-report.mjs` builds it (`balanceData`, `balancePage`); its data is also saved
beside it as `data.json`.

```sh
just fight-sim report --baseline                       # measure, and keep it as the reference
just fight-sim report --tune marta.rules.clavado=3     # try a number: the page shows what moved (▲▼, in points)
just fight-sim report --build nada,mixto,elementos,tronco --runs 300
```

The loop for the fine balance, once every mission is in: add the mission to `MISSIONS` (its fights,
the ones that teach, its lights and its friend's ánima), keep a reference, try numbers with `--tune`
until the pairs hold at the first and the last point, write the numbers into the code, move the
`TARGETS` to those points, and keep a new reference. Fights that teach are shown but not asked the pair.

## The balance bench

What turns the simulator's rows into decisions (`src/balance.ts`). Nothing here writes a number into
the game: every command ends by saying what it found and how to see it whole.

### Speed

Every command shares its rows among threads (`scripts/fight-sim-pool.mjs`, the cores less one;
`--workers N`). A row's fights are cut in pieces of 20, each fight with its own seed, so the same
setup and seed give the same row in one thread or ten. `just fight-sim check` takes about a third of
what it did; the tests (`tests/battle-sim.test.mjs`) still play it in one.

### Levers: the numbers a fight turns on

```sh
just fight-sim levers --fight plato                  # its own numbers: its foes and its rules
just fight-sim levers --fight voz --scope party      # what the party brings: skills, duals, what each ánima adds
just fight-sim levers --pairs --at marta:first,marta:last --fight voz   # against the story's pairs, not the targets
```

A fight is played a few times with every number watched (`watchReads`), so the list is what it really
reads, with nobody keeping it. Each number is then moved a fifth down and up (`--delta`; a whole
number by 1 at least) and every goal that reads it is played again with the same seeds.

| Column | Means |
| --- | --- |
| `mueve` | The most any goal's wins change from the low value to the high one, in points |
| `separa` | Above 0, raising it pulls apart the goals that should win from those that should not: the number that makes the fight's question matter more. Below 0, it pushes them together |
| `pérdida` | How far those goals are from what they ask at the low value, as it is and at the high one (0: all held) |

`--scope fight` (default) is the fight's own; `party` is skills, duals, `class`, `anima`, `growth` and
Gerard's and Aitor's stats, which move every fight; `all` adds the shared rules (elements, crits, EXP).

### Optimize: the numbers that hold the targets

```sh
just fight-sim optimize --fight plato --auto 3                       # its three strongest levers, found for you
just fight-sim optimize --vary foe.voz.pv=600..900/10 --vary marta.rules.directo   # these, the second 40 % either side
just fight-sim optimize --pairs --at luca:first,luca:last --fight fran --auto 4    # hold the pair at both ends of the story
just fight-sim optimize --vary skill.zarpazos.strikes=3..6 --tune growth.rules.scale=0   # with another number held where it is tried
```

It looks for the values of a few numbers that bring a set of goals to what they ask.

- **The goals**: the targets of `--fight`, those named with `--target`, or with `--pairs` both halves
  of every story point's pair (`smart` ≥ 90 %, `casual` ≤ 20 %). With none named, every target whose
  fight reads one of the numbers, so a skill's number is held against every fight it is used in.
- **The loss** (`miss`): for each goal, how far its row is from its ranges, in steps: ten points of
  wins is one, ten of PV left or a round is half, a fight that does not end is ten. A range held by a
  hair still costs a little, so the answer ends inside it and not on its line.
- **The same luck for every try**: every set of numbers plays the same seeds, so the loss is a plain
  function of the numbers and two tries differ by what they are.
- **The search**: a spread of tries over the whole range first (a Latin hypercube), so a start where
  nothing moves (a fight never won) is not the end; then from the best one each number a step up and
  down, to the best neighbour, steps halved when none is better.
- **The least change**: being far from today's numbers costs a little (`--keep`, 0.1 for a number's
  whole range), so between two answers as good it takes the nearer, and a number that changes nothing
  stays where it is.
- **The last word**: today's numbers and the proposed ones are played again with another seed and
  `--check-runs` fights (200). Believe that table, not the search's: a search this greedy can fit one
  seed's luck.

It prints the command that shows the proposal whole (`just fight-sim check --tune …`). Writing the
numbers into the code, and deciding whether to, is still someone's job.

As measured on 2026-11-21: El Plato's three targets (one held of three) are all held by `foe.plato.pv`
260 → 280 and nothing else, found in 60 tries and 8 seconds.

### Skills: what each one is worth

```sh
just fight-sim skills                         # the bosses, seven parties that wear every ánima between them, everything open
just fight-sim skills --story --fight all     # every fight that asks a question, with what the story has given by then
just fight-sim skills --anima papagato,dadaista --party gerard:papagato+aitor:dadaista
```

Every setup is played by `smart`, and then again once for each action it used, with that action
banned (`ban`): what a skill is worth is what the fight becomes without it.

| Column | Means |
| --- | --- |
| `usada en` | Setups where the bot used it, of those whose party knows it and can wear its ánima |
| `usos`, `daño` | Uses per fight, and its share of the party's damage |
| `PV/uso`, `PV/maná` | PV off the foes per use and per point of maná (a dual's maná is both halves) |
| `sin ella` | Banned: wins lost on average and in the worst setup, rounds a win takes more, PV left less |

| Flag | Means |
| --- | --- |
| `no se usa` | The party knows it everywhere and `smart` never picks it. It may be useless, or `worth` may not know its value yet: read the skill before cutting it |
| `decide` | Some fight loses 30 points of wins or more without it: the list below the table says which |
| `domina` | It does half the party's damage wherever it is known |
| `quitarla no cambia nada` | Banned, nothing moves anywhere: wins, rounds or PV |
| `barata`, `cara` | A point of maná buys far more, or far less, with it than with the middle skill of its ánima |

By default everything is open (`fullKit`: every shared ánima at its top level, the whole jar, every
friend's ánima), the one state where every skill is on the table at once; most fights are won with it,
so read rounds and PV more than wins. `--story` gives each fight what the story has given by the end
of its stretch, where a skill's absence shows in the wins. A die's face and Agitar are left out unless
used: they are played through Tirar dado and take no turn.

### Curve: what each fight should be as the party grows

```sh
just fight-sim curve                         # every side mission at 0 to 3 others behind; the castle and the night with fewer, as many and more than they ask
just fight-sim curve --done emilie           # only the orders that start where the player is (Emilie's done): the rest in any order
just fight-sim curve --orders all --fight voz   # every order, not one for each number of missions behind
just fight-sim optimize --curve --done emilie --fight cuerdas-lealtad,cuerdas-directo,voz --vary foes.voz.hit=0..5/0.25
```

The pairs (§ Targets) ask every story point the same; the curve (`CURVE`, `curveGoals` in
`src/balance.ts`) asks each kind of fight what it should be as the party grows (Aitor, 2026-11-22:
«está bien sentirse más poderoso», the castle and the night «para medir su capacidad», the side
missions «siempre un reto, porque es no-lineal el progreso y el orden»):

| Kind | Where | `smart` | `casual` |
| --- | --- | --- | --- |
| Side mission (`side`) | Each open mission's fights that ask something, with 0, 1, 2 and 3 of the others behind | Wins 90 %, with 20–60 % of PV left (the top 5 points higher for each mission behind: growing is felt) in 12 rounds at most | 25 % at most, in every order |
| Castle and night, fewer side missions than they ask (`short`) | The boss (and the night's elite) with one fewer | 50 % at most: «go and get another ánima» | – |
| … as many as they ask (`asked`) | Each fight of the stretch | 85 %, with 15–65 % of PV | A boss 25 %, a room 60 % at most |
| … more (`more`) | With every mission | 95 %, as easily as it likes | A boss 50 % at most |

What each stretch asks for is `CASTLE_ASKS`: Aurelià two side missions, Dirección three, the Queen
all four; the night one (Aitor, sizing them up: with Nuria's ánima alone «mejor no probarlo»). The
Queen's return is off the curve: the melody decides it. `--done` names the open missions the
player has done: they are behind every point, first, and are not played again. With the dual party
only the number behind counts (the ánima a mission leaves is not worn), so one order per number is
enough (`--orders ends`, the default); `--party` plays another.

`--curve` is also a goal set for `levers` and `optimize`, which add to it the `TARGETS` of the same
fights, so the other parties and the mission done first are held on the way. How a fight grows
(`foes.<fight>.pv`, `.stat`, `.hit`) is the fight's own number for `--scope fight`.

### Coverage: what nothing holds yet

`just fight-sim coverage` plays every target a little and watches what it reads, and lists what is
left over: fights with no target that plays their answer or none that plays without it, each ánima as
it stands (skills, how far it grows, whether its definitiva is built, whether any target wears it),
skills and duals no target's bot uses, and the numbers no target's fight reads. Whatever is on that
list can break without `just fight-sim check` noticing.

As measured on 2026-11-21: 19 fights without their pair; no target wears Dadista, Colorista,
Sincopante or Freática; 30 skills and 6 of the 9 duals are used by no target; 219 of 823 numbers are
read by none (every number of those four ánimas among them).

### Progression: whether the party's growth keeps step

```sh
just fight-sim progress                                   # each ánima's bonus at 0, as it is, and doubled
just fight-sim progress --tune growth.rules.scale=0 --tune growth.rules.pv=0:10:20   # only PV for each ánima gathered
just fight-sim progress --tune foes.growth.pv=0:0.1 --tune foes.growth.stat=0:0.5:1    # how much the foes keep up
just fight-sim progress --tune level.xp.2=950:1290 --at castillo-1,castillo-2,castillo-3   # level 4 later
```

The party grows three ways: each friend's ánima adds to everyone's attributes (`ANIMAS`' `bonus`:
+1 to two stats and +10 PV each, and since 2026-11-21 a point of Fuerza, Magia, Defensa and Espíritu,
`ANIMA_GROWTH`: § Power and the castle), the shared ánimas level up, and the ecos buy the jar. The open
missions' foes grow with it (`FOE_GROWTH`, since 2026-11-21); the rest do not. `progress` plays every story point's pairs under each set of numbers and says, point by
point, how many pairs hold, what `smart` and `casual` win, and which fights fall out and to which
side (`duro`: `smart` under 90 %; `fácil`: `casual` over 20 %). Its conclusions say what doing a
mission first or last changes: the city is open, so the same fight is met with one friend's ánima or
with four.

Three rules are numbers to try:

| Number | Tries |
| --- | --- |
| `growth.rules.scale` | Every ánima's bonus times this: 0 is no attribute growth at all |
| `growth.rules.pv`, `growth.rules.stat` | For each ánima gathered, this many PV, and this much Fuerza, Magia, Defensa and Espíritu, on top |
| `foes.growth.pv`, `foes.growth.stat` | For each other open mission's ánima the party has, every foe of an open mission's fight starts with this share more PV and this much more of those four stats (each fight's own, `foes.<fight>`, also `hit`: Fuerza and Magia on top, since 2026-11-22; `gatheredFor`: Nuria's ánima and the mission's own do not count, and the castle's fights never grow; Nuria's tower, meant to come first, grows by `foes.<fight>.stat` with every open mission's ánima a party brings to it, +3 of each for one, since 2026-11-22) |

A level's EXP (`level.xp.N`) moves the level each point is reached with, since the points count their
EXP (`STRETCH_XP`). `just game-sim run --tune …` plays the same numbers through the whole game:
[game-sim.md](game-sim.md) § Trying numbers.

**Before the two decisions below**, as measured on 2026-11-21 with a first sketch of the foes' rule
that counted every ánima and reached the castle too (the dual party, build `mixto`, 43 pairs over the open missions first and
last and the castle's three stretches; 60 to 100 fights a row):

| Rule tried | Pairs held | A mission done last instead of first: `casual` wins |
| --- | --- | --- |
| The game as it is (`growth.rules.scale=1`) | 6–7 of 43 | +33 points |
| No attribute growth at all (`scale=0`) | 13 | +1 |
| Only PV, +10 for each ánima (`scale=0`, `growth.rules.pv=10`) | 8 | +23 |
| Bonus doubled (`scale=2`) | 5 | +30 |
| As it is, and the foes with 8 % more PV for each ánima | 10 | +8 |
| As it is, and the foes with +1 to their four stats for each ánima | 15 | −3 |
| No growth, and the foes with 8 % more PV for each ánima | 18 | −8 |

- **The party already grows with the ánimas it gathers, and that is what tips the open missions.** The
  fights do not grow, so each mission is easier the later it is done: `casual` wins 33 points more of
  a mission done last than of the same mission done first, and most of that is the PV (+23 with the
  PV alone). The levels do little on their own: with no bonus, Papagato from 2 to 4 moves `casual` one point.
- **More of it is not the answer** (doubled, fewer pairs hold); **nor is none** if the party is to be
  felt growing. What keeps the order from mattering is the foes keeping up: with their four stats up
  one for each ánima gathered, the order stops counting (−3) and twice as many pairs hold, though the
  castle, tuned with five ánimas' bonus and nothing on its side, becomes too hard and has to be tuned
  again. The palace's guards and the night's pupils already grow or shrink with the party
  (`palaceGuards`, `nightMight`); the missions' fights do not.
- **The few pairs held are not all the growth's doing**: many fights are still tuned against their
  hand-picked `TARGETS` (Papagato 2, nothing from the jar), which is what the final pass moves to these
  points. Read the columns against each other, not against 43.
- **The EXP does not reach the levels the castle opens.** An ánima worn in every fight has about
  1,750 EXP on reaching the castle (level 4, which costs 1,290) and 2,250 on reaching the Queen (level
  5, 2,070), with levels 6 and 7 at 3,000 and 4,080: the caps of 6 and 7 open levels nobody has the
  EXP for. Whoever takes turns between shared ánimas has less: `pensando` reaches Aurelià with
  Papagato at 3.1 and Dadista at 2, and the Queen with Dadista at 4 and Colorista at 2.4
  (`just game-sim`). Either `LEVEL_XP` shortens from level 4 up or the castle's pupils are worth more.

- **Through the whole game the bonus is what carries the player who does not think.** Six games each
  with `just game-sim run --player pensando,casual --runs 6 --tune growth.rules.scale=0:1`:

  | Bonus | Player | Finish | Median | Fights | Lost | Walls |
  | --- | --- | --- | --- | --- | --- | --- |
  | none (`scale=0`) | `pensando` | 100 % | 275 min | 110 | 18.5 | the palace's guards, the night's guard, Aurelià |
  | as it is | `pensando` | 100 % | 202 min | 68 | 5.7 | the palace's guards, the night's guard |
  | none | `casual` | 0 % | — | 430 | 233 | most of the missions |
  | as it is | `casual` | 67 % | 1,301 min | 369 | 133 | the same ones, later |

  So taking the bonus away is not on the table: the game's length for whoever plays well, and its
  being finishable at all for whoever does not, lean on it. And `casual`, who repeats fights by the
  hundred, does reach Dadista 7: the levels past 5 are today a prize for losing often, not for
  getting far.

#### Decided on 2026-11-21 (Aitor)

**The open missions' foes grow with the ánimas gathered** (`FOE_GROWTH` in `src/battle.ts`: `stat: .5`,
`pv: 0` when this was decided, and 1.25 since the party itself grows a point an ánima later the same
day: § Power and the castle; docs/combat.md § Los enemigos crecen con el equipo). For each *other* open mission's ánima
the party already has, every foe of a fight of Los amigos de la uni, Marta, Emilie or Luca has half a
point more Fuerza, Magia, Defensa and Espíritu, rounded on the sum: nothing on the first of the four,
+1 on the second and third, +2 on the last. Nuria's ánima does not count (it is there before any of
them, so the first mission is the fight as tuned), nor the mission's own; Nuria's fights and the
castle's are always met with the same ánimas and keep their own numbers, so nothing there had to be
tuned again. Whoever joins a fight later (La Voz's second voice, Fran's moths) comes grown the same.
The fight screen, the fight tester (its «Amigos») and both simulators start their fights through
`createEncounter`'s `friends`.

How much was measured three ways. First, nine strengths over the four missions done first and last
(28 pairs, 60 fights a row), with the levels a story point gives an ánima worn in every fight:

| `foes.growth.pv` | `foes.growth.stat` | Pairs held | Done last instead of first: `smart` wins | ends with PV | `casual` wins |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 (as it was) | 3 | +4 | +14 | +34 |
| 0 | 0.5 | 5 | +2 | +4 | +5 |
| 0 | 1 | 7 | +2 | −1 | −6 |
| 0.05 | 0 | 3 | +2 | +9 | +18 |
| 0.05 | 0.5 | 6 | 0 | −3 | −9 |
| 0.05 | 1 | 8 | −4 | −9 | −18 |
| 0.1 | 0 | 6 | +2 | +3 | +1 |
| 0.1 | 0.5 | 8 | −4 | −8 | −15 |
| 0.1 | 1 | 6 | −11 | −14 | −23 |

Then the missions done last with the levels `pensando` really brings to them
(`--level papagato=3/dadaista=2/prismatico=1/sincopante=1/freatica=2`), against the same missions
done first (`smart` 94 %, 54 % of PV left, `casual` 47 %):

| `pv` | `stat` | `smart` | PV left | `casual` | Against done first |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | 97 % | 67 % | 78 % | +3, +13, +31 |
| **0** | **0.5** | **95 %** | **56 %** | **46 %** | **+1, +2, −1** |
| 0 | 1 | 94 % | 52 % | 37 % | 0, −2, −10 |
| 0.1 | 0 | 97 % | 53 % | 42 % | +3, −1, −5 |
| 0.1 | 0.5 | 89 % | 42 % | 26 % | −5, −12, −21 |

And whole games (`just game-sim run --player pensando,casual --runs 6 --tune foes.growth.stat=0:0.5:1`):

| `stat` | Player | Finish | Median | Fights | Lost | New walls |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `pensando` | 100 % | 163 min | 56 | 3.5 | |
| **0.5** | `pensando` | 100 % | 168 min | 59 | 3.7 | none |
| 1 | `pensando` | 100 % | 212 min | 68 | 5.2 | La Voz done last (33 % at the first try) |
| 0 | `casual` | 100 % | 723 min | 241 | 80 | |
| **0.5** | `casual` | 100 % | 702 min | 243 | 81 | the same ones, give or take a seed |
| 1 | `casual` | 100 % | 856 min | 275 | 101 | La Voz too |

Half a point is where the order stops counting for both players without walling anyone in. A whole
point looks neutral when every ánima is at the level of one worn in every fight, but a player takes
turns between them and brings less, and it made a wall of La Voz for whoever thinks. A tenth of PV
did as well on paper and left every blow as tuned, but it is what docs/combat.md warns against: it
only makes the fights longer (La Voz from 11 rounds to 15). `pv` stays in the rule at 0, a number for
the final pass. The 112 `TARGETS` play the same with it (none names another open mission's ánima),
so `just fight-sim check` did not move.

**Levels 5 to 7 within reach, in some four ánimas** (Aitor, 2026-11-21; `LEVEL_XP` and `XP_RULES` in
`src/levels.ts`). Two numbers, found together:

- **Levels 4 to 7 cost 950, 1,150, 1,400 and 1,700 EXP** (they were 1,290, 2,070, 3,000 and 4,080).
  Levels 2 and 3 stay at 180 and 660: the missions are tuned on them.
- **Inside the castle a fight is worth three times its foes** (`XP_RULES.castle`, `fightXp`). The
  party comes in with all five shared ánimas and the castle opens their levels a boss at a time
  (4, 6 after Aurelià, 7 after Dirección), so its few fights have to carry them from 4 to 7. The
  same pupils out on the Meridiana at night are worth what `FOE_XP` says, so the night is not a
  place to farm.

Why both: whoever thinks takes turns between five shared ánimas, so each has little. `pensando`
used to reach the Queen with some 1,200 EXP in Papagato and in Dadista, 950 in Freática, 670 in
Sincopante and 250 in Colorista, and a floor of the castle left some 200. What was tried, six games
of `pensando` each, counting the shared ánimas at level 5 or more when the game ends (`just game-sim`,
«Al acabar»):

| Castle's EXP | Levels 4 to 7 | Ánimas at 5 or more | At 7 | Median |
| --- | --- | --- | --- | --- |
| ×1 | 1,290 · 1,500 · 1,750 · 2,050 (the first shortening, of 5 to 7 only) | 0.2 | 0 | 168 min |
| ×2 | the same | 1.3 | 0.5 | 167 min |
| ×3 | the same | 2.7 | 1.5 | 181 min |
| ×4 | the same | 3.0 | 1.7 | 176 min |
| ×1 | 1,000 · 1,200 · 1,450 · 1,750 | 1.2 | 0 | 192 min |
| ×3 | 1,000 · 1,200 · 1,450 · 1,750 | 3.5 | 2.0 | 171 min |
| ×4 | 1,000 · 1,200 · 1,450 · 1,750 | 3.5 | 2.3 | 169 min |
| **×3** | **950 · 1,150 · 1,400 · 1,700** | **3.7** | **2.3** | **170 min** |
| ×3 | 1,000 · 1,150 · 1,350 · 1,600 | 3.7 | 2.7 | 171 min |

Neither number does it alone: the curve alone leaves the ánimas gathered late with nothing to grow
on, and the castle's EXP alone leaves Papagato, worn through the missions and little inside, short
of 5. With both, as the game is now (`just game-sim run --player pensando,casual,corredor --runs 6`):

| Player | Finish | Median | Fights (lost) | Ánimas at 5 or more | At 7 | Each one's level at the end |
| --- | --- | --- | --- | --- | --- | --- |
| `pensando` | 100 % | 170 min | 59 (4) | 3.7 of 5 | 2.3 | Papagato 4.7, Dadista 7, Colorista 2.7, Sincopante 5.8, Freática 6.8 |
| `casual` | 100 % | 881 min | 263 (91) | 4.2 | 3.5 | Papagato 4.2, Dadista 7, Colorista 6.2, Sincopante 7, Freática 7 |
| `corredor` | 100 % | 150 min | 61 (7) | 4.0 | 3.5 | Papagato 2.2, Dadista 6.7, Colorista 7, Sincopante 6.5, Freática 7 |

Which ánima is left behind is whichever the player wears least (Colorista for `pensando`, Papagato
for `corredor`): the fifth is a choice, not a wall. The levels come where the castle opens them:
`pensando` meets Aurelià with Papagato at 4 and the rest at 1 or 2, Dirección with Freática near 4,
and the Queen's return with three or four of them between 5 and 7.

**What to watch in the final pass**: the castle's fights were tuned with the party at levels 2 to
4, and now the third floor is met at 5 to 7 (`pensando` still loses 4 fights a game and ends La
Reina's return with 88 % of its PV, as before). A story point's levels (`STRETCH_XP`) are those of an
ánima worn in every fight, more than a player brings: for what one really brings, `--level` with
what `just game-sim` says («llega con»).

#### Power and the castle (Aitor, 2026-11-21, later the same day)

What was asked: to feel the party grow, the easy foes of the start falling in no time by the end;
fights neither short nor very long; each block of the castle asking for two side missions and a
little farming; the night a place to farm a little; and a harder kind of pupil worth an Eco de luz.
Seven numbers, found with `just fight-sim` at the story's points and held with `just game-sim`:

| Number | Was | Is | Why |
| --- | --- | --- | --- |
| `ANIMA_GROWTH.stat` (`src/animas.ts`) | 0 | **1** | Each friend freed is a point of Fuerza, Magia, Defensa and Espíritu for both. Blows add and subtract attributes, so five friends are five more on every blow and five less on every one taken |
| `FOE_GROWTH.stat` (`src/battle.ts`) | .5 | **1.25** | The open missions' foes keep up with it: +1, +3 and +4 with one, two and three of the other missions behind |
| Aurelià (`src/stats.ts`, `CASTLE.pregunta`) | 420 PV, 14 Fuerza, Pregunta 52 | **480 PV, 16 Fuerza, Pregunta 85** | He was beaten with no side mission done. The Pregunta is the blow that is defended: at 85 it costs whoever does not (`casual` with two side missions wins 20 %), and little to whoever does |
| Each of Dirección (`directiva`) | 160 PV, 13 Magia, 10 Defensa, 12 Espíritu | **185 PV, 19 Magia, 12 Defensa, 14 Espíritu** | They were beaten with one |
| `CASTLE.year1`, `year2`, `year3` | 1, 1.25, 1.25 | **1.25, 1.4, 1.5** | With the party's new attributes the first floor's rooms were over in a round and the other two were won without thinking |
| `XP_RULES.night` (`src/levels.ts`) | 1 | **1.5** | The night as a place to grow a little |
| `STRONG` (`src/castle.ts`) | – | **PV ×1.6, blows ×1.3** | Encarnados (docs/castle.md § Encarnados) |

**The feeling of power.** The same fights, `smart`, as the party stands at each point (rounds to win):

| Fight | With Nuria's ánima only | Nuria and two side missions | All five | All five at the castle's end |
| --- | --- | --- | --- | --- |
| Three dogs | 3.3 | 1.1 | 1.1 | 1.1 |
| El Cebollón | 3.2 | 2.1 | 2.1 | 2.1 |
| Magos of the campsite | 3.9 | 3.0 | 2.7 | 2.6 |
| El Campeón | 7.2 | 3.4 | 3.6 | 3.7 |
| Lealtad (Marta) | 6.1 | 3.3 | 3.4 | 3.0 |
| First floor's room (1a) | 2.1 | 2.1 | 2.1 | 2.2 |
| Second floor's room (2d) | 5.0 (51 % of PV left) | 4.1 | 3.7 | 3.4 (80 %) |
| Third floor's room (3a) | 10.9 | 9.3 | 9.6 | 6.7 |
| La Delegada, third year | lost | 67 %, 10.7 | 73 %, 8.4 | 93 %, 4.2 |
| The night's group | lost | 3.5 | 2.1 | 2.1 |

A room is two to five rounds, an elite three to five, a boss seven to twelve. What does not get
shorter is a room of two or three pupils against two fighters: it cannot end before each has had a
blow, so two rounds is its floor (the first floor's rooms are there from the start).

**The castle asks for ánimas.** Six parties, `smart`, thirty fights each (the dual party, Matemágico
with Tecnópata, and four that wear a shared ánima each):

| Boss | Nuria and one side mission | And two | And three | All five |
| --- | --- | --- | --- | --- |
| Aurelià | 13 to 70 % | 47 to 97 % | – | 87 to 100 %, in 9 to 12 rounds |
| Dirección | – | 10 to 43 % | 30 to 87 % | 63 to 100 %, in 6 to 8 rounds |

So Aurelià is the first block's two side missions and Dirección the second's: with fewer, only the
best party and a good day get through. `TARGETS` hold it: `aurelia-con-una` (2 %),
`aurelia-con-dos` (97 %), `aurelia-bien` (100 % in 8.5 rounds), `aurelia-sin-pensar` (22 % with two
side missions), `direccion-con-dos` (29 %), `direccion-bien` (92 % in 6.6), `direccion-sin-pensar`
(9 % with three). The castle's other targets now meet their fight with the party the
story brings there (`storyPoint`: ONE, TWO, THREE, FLOOR_1 to FLOOR_3 in `src/battle-sim.ts`), not
with a party without friends.

**Encarnados.** Since the same day's second round they come out every other day, six at most, and
the ecos come mostly from elsewhere (the rooms' first wins, levels 5 and 7, and a jar at one eco a
node, three a dúo mayor since 2026-11-24: docs/animas/README.md § Ecos de luz): 30 to 35 ecos at the end of 41, against 15 to 20 of 61.
The story points count the rooms' (`FLOOR_ROOMS`) and the mixed build now runs through the whole jar;
`just fight-sim check` did not move. In the first measure nobody looked for them and they gave one to six a game. They are a real fight where the floor is (second floor's 2d: `smart` 99 % in
5.2 rounds with 58 % of PV left, `casual` 12 %; `encarnados-bien`, `encarnados-sin-pensar`), soft on
the first floor (two to four rounds) and hard in the hardest room (2a: 50 %). At night they are the
long fight of the game while the party is small (ten rounds with two side missions) and two rounds
with all five. They help in the way they were meant to: something to go and get when a boss says
no. They do not close the jar's gap by themselves.

**Whole games** (`just game-sim run --player pensando,casual,corredor --runs 6`), before these
numbers and with them:

| Player | Finish | Median | Fights (lost) | Aurelià | Dirección | Ánimas at 5 or more |
| --- | --- | --- | --- | --- | --- | --- |
| `pensando`, before | 100 % | 170 min | 59 (4) | first try, always | first try, always | 3.7 of 5 |
| `pensando` | 100 % | 220 min | 81 (10.5) | 1.8 tries | 2 tries | 4.0 |
| `casual`, before | 100 % | 881 min | 263 (91) | 4 tries | 3.7 tries | 4.2 |
| `casual` | 100 % | 713 min | 262 (80) | 4 tries | 4.2 tries | 4.7 |
| `corredor`, before | 100 % | 150 min | 61 (7) | 1.2 tries | first try, always | 4.0 |
| `corredor` | 100 % | 150 min | 63 (7) | 1.3 tries | 1.2 tries | 4.0 |

All three reach the castle with the five ánimas (they do every mission first), so what they pay is
the second half of the request, the little farming: `pensando` loses to Aurelià and to Dirección
once each on average, refights rooms of the floor and comes back. La Voz done last is won at the
first try two times in three (`FOE_GROWTH.stat` 1.25; at 1.5 it was one in three, a wall, and at 1
the last mission was the easy one: `--tune foes.growth.stat=1:1.25:1.5`).

#### The final pass, as done (2026-11-21, night)

`just fight-sim check`: 29 of 117 targets out of range before it, **0 of 170** after;
`just fight-sim coverage` lists no fight without its pair; `npm test` passes. What it took, in the
order it was learned:

1. **Each open fight grows by its own rule** (`FIGHT_GROWTH`, book `foes.<fight>`): one number for
   all (`FOE_GROWTH.stat` 1.25) left La Sobremesa a wall done last and Fran a walk.
2. **Tuning with one party is tuning for one party.** The first numbers held every pair with the
   dual party (Matemágico and Papagato) and made walls for anyone else: `just game-sim`'s thinking
   player, who wears its two newest ánimas at level 1, took 785 minutes where it took 184, losing
   Lo Directo 23 times in a row. Each mission's last fights are now held three ways (`doneLast`):
   the dúo with its grown cats, a party wearing its two newest ánimas (`…-la-ultima-animas-nuevas`,
   won 82 to 100 %, longer), and that party without the answer (0 to 25 %). The growth numbers came
   down for it (La Voz 1.75 → 1.25 a mission, Fran 3 → 1.75, Lo Directo 1.5 → .25, El que no
   converge 1.5 → .25), and Lo Directo and La Lealtad lost some PV (470 → 440, 280 → 260).
3. **What that buys the careless.** A careless dúo with Papagato at level 4 wins some of the last
   mission's fights (Lo Directo about half the time, La Voz seven in ten, in 18 rounds and on its
   last PV). That much is what growing buys; with the newest ánimas the careless still lose.
4. **The bots had three holes**, each of which read as a balance problem: `smart` stood behind
   Defender and a cure for ever against El Repetidor's crust or two Gemelos at a few PV (fights
   «sin acabar»); it hit La Pompa when it could not burst it; `casual` broke Fran's lamps by number.
5. **The palace guards count the friends' ánimas**, as the game does (`story.animas`); the sim was
   counting Matemágico and Tecnópata too, so it read the gate open from the start.

| Whole games (`just game-sim`, 6 each) | Before the pass | With the dúo-only numbers | As it stands |
| --- | --- | --- | --- |
| `pensando`: finishes, median, fights (lost) | 100 %, 184 min, 66 (6) | 83 %, 785 min, 199 (62) | 100 %, 349 min, 110 (25) |
| `corredor` | 100 %, 155 min, 61 (7) | 100 %, 189 min, 77 (11) | 100 %, 204 min, 92 (14) |
| `casual` | 100 %, 603 min, 215 (63) | 17 % | 83 %, 1182 min, 399 (156) |

Before the pass a careless player finished every game: no boss asked anything of it. Now it loses
three fights in eight and takes twice as long, and a thinking one that insists on its newest
ánimas loses one in four.

**Still open, said to Aitor:**

- **Lo Directo** is the one fight where what is worn decides: `pensando` in whole games, with two
  ánimas at level 1 and no burst, wins it one try in five. It asks for a hard blow in the window
  (the cats) or electricity. A softer Estocada lets the careless dúo through (it is a cliff: 54 → 48
  on its blow takes `casual` from 10 % to 68 %).
- **Long fights with the newest ánimas**: El Campeón 17 rounds, La Voz and Fran 15, against 7 to 10
  with the cats. It is the base fight (El Campeón takes 15 with two magic ánimas done first too).
- The trio rooms' cliff and what the castle is with fewer missions (§ The castle, as tuned).
- The Queen does not strike while she wraps herself or blows; her return is five rounds.
- Skills were measured, not retuned (§ Skills): the same list as before.

#### After the pass: cures by share, growth by share, shorter and harder (2026-11-21, late)

Asked by Aitor after reading the pass («la cura porcentual, un 50 %», «cada ánima da un X % más de los
atributos», «que los enemigos peguen algo más pero que sean más cortos los combates, unas 8 rondas»,
«que si farmeo y desbloqueo cosas, pues es más fácil», «dificultad que pensando se gana»):

| Rule | Was | Is |
| --- | --- | --- |
| A cure (`HEAL`, src/stats.ts; book `heal.rules`) | Power plus Magia, in points: Cardioide about 40 PV of 180 | A share of the PV of whoever gets it: power 30 is half (Cardioide), 16 about a quarter, 40 two thirds. Sanación gives back a fifth over its 15 seconds |
| Each friend's ánima (`ANIMA_GROWTH`, book `growth.rules.pct`) | Its own bonus, a point of each attribute and 10 PV | 12 % more of PV, Fuerza, Magia, Defensa and Espíritu |
| Each level of the ánima worn (`LEVEL_GROWTH`, book `growth.level.pct`) | Skills and maná only | 3 % more of every attribute as well (level 7: 18 %) |
| The foes' blows (`FOE_BLOW`, book `foes.blow.share`) | Their own numbers | 0.4 of what the ánimas have grown the party harder (five ánimas: 24 %). Levels are not counted: what is earned fighting makes it easier |
| Castle years | 1.6, 1.4, 1.8 | 1.7, 1.5, 1.9 |
| Vertitrón, Aurelià, La Voz, La Sobremesa, La Reina | 484 PV; 560 PV, 16 Fuerza; 500 PV, 14 Magia; 72 to 95 PV each; 14 Fuerza and Magia | 440 PV, 18 Fuerza and Magia; 500 PV, 21 Fuerza; 460 PV, 15 Magia; 62 to 81 PV each; 17 Fuerza and Magia. Lo Directo 16 Fuerza |

Rounds a win takes, playing the answer: Aurelià 12.5 → 7.5, La Voz 11 → 9, Fran 10 → 7, La Sobremesa
13 → 10, the Queen's first fight 17 → 14. `smart` now cures whoever is under half their PV, or within
two of the foes' turns of falling, and values a cure less as a fight drags past its tenth round.
Fixed on the way: switching ánima mid-fight dropped what the friends' ánimas gave.

**What it cost, and is open:**

- Careless play wins more of some castle rooms than it should (2a, El Montón, La Delegada and Los
  Gemelos of third year: 45 to 70 %): the party kills faster and those rooms turn on lasting three
  rounds. `pairsOf` now takes «without the answer» as winning four in five at most (it was half).
  The bosses still say no to the careless (Aurelià 4 %, Dirección 2 %, Fran 5 %, La Voz 14 %).
- El Cebollón can be outlasted without Zarpazos at level 2, curing with Ronroneo: twice the rounds.
- Not re-run: `just game-sim` whole games.

#### The yardstick and the side missions (Aitor, 2026-11-22)

What was asked, with Nuria's tower and Emilie's model done and the other three to play: «Mejora el
optimizador para que tenga en cuenta el progreso del jugador, está bien sentirse más poderoso, y que
el castillo y Av. Meridiana noche no escalen tanto con la progresión del jugador (para medir su
capacidad), pero las side quests deben escalarse, deben siempre ser un reto porque es no-lineal el
progreso y el orden».

**The bench** learned the curve (§ Curve): `just fight-sim curve --done emilie` is the table of what
each fight is from where the player is, and `optimize --curve` the search that holds it, with the
`TARGETS` of the same fights so nothing else breaks. How a fight grows is its own number now
(`--scope fight` reaches `foes.<fight>.*`).

**The rules that changed:**

| Rule | Was | Is |
| --- | --- | --- |
| The foes' blows in the castle and at night (`FOE_BLOW.castle`, `steady` on the party) | 1 + 0.4 × what the ánimas have grown the party: they kept step with it | 1.24 always, what they were with all five: the same for the full party, harder for a smaller one, so the castle measures what has been done |
| The night's pupils (`NIGHT_PUPILS`) | 6 × their PV and blows, less 1 a friend and 0.4 a level, down to 1: the night softened as the party grew | 1.25 always: the party's growth is what changes the fight |
| The night's pupils' moves | **A bug**: out at night they only shoved (`enemyAct` sent their turn to the plain blow, as the encounter is not a castle one), so the night was won on PV alone | Their own moves, as inside (a test fails on the old code) |
| How a side mission's fight grows (`FIGHT_GROWTH`, new field `hit`) | The four attributes alike and some PV: done last it was longer, and still a walk | Fuerza and Magia on top (`hit`), less PV: done last it is as dangerous and not longer |

**The numbers**, found with `optimize --curve` per mission and held with `just game-sim`:

| Number | Was | Is |
| --- | --- | --- |
| La parcela negra (`foes.camping-negra`) | pv .1, stat .75 | pv .05, stat 3.5, hit 3.75; `camping.rules.bombona` 28 → 24 |
| El Campeón (`foes.campeon`) | pv 0, stat 1.25 | pv .05, stat 1, hit 3.5 |
| La Sobremesa (`foes.sobremesa`) | pv 0, stat .25 | pv 0, stat 2.75, hit 3.5; Anna's Defensa 9 → 11 |
| La Lealtad, Lo Directo, La Voz | pv .1 stat 0; pv .1 stat .25; pv 0 stat 1.25 | pv .05 stat 1.25 hit 1; pv .05 stat 2.25 hit .75; pv 0 stat 1.25 hit .75 |
| Los capellanes, Las camisas, Fran | pv .1 stat .75; pv .025 stat 2; pv .025 stat 1.75 | pv .05 stat 3 hit .5; pv 0 stat 1.5 hit 4.5; pv 0 stat 2.5 hit 4.5 |
| Aurelià (`foe.aurelia`) | 500 PV, 21 Fuerza, 12 Defensa, 12 Espíritu | 540, 25, 14, 11 |

**The three missions left**, from where the player is (`curve --done emilie`, the dual party, 120
fights a row; `smart` wins and PV left, `casual` wins):

| Fight | Next (Emilie behind) | Third | Last | Before, last |
| --- | --- | --- | --- | --- |
| La parcela negra | 100 %, 53 %; 12 % | 98 %, 47 %; 2 % | 100 %, 58 %; 0 % | 100 %, 60 %; 99 % |
| El Campeón | 100 %, 74 %; 1 % | 100 %, 70 %; 3 % | 100 %, 70 %; 0 % | 100 %, 84 %; 98 % |
| La Sobremesa | 100 %, 64 %; 3 % | 99 %, 56 %; 4 % | 99 %, 52 %; 1 % | 100 %, 89 %; 67 % |
| La Lealtad | 100 %, 62 %; 10 % | 100 %, 69 %; 18 % | 100 %, 70 %; 17 % | 100 %, 75 %; 84 % |
| Lo Directo | 98 %, 62 %; 21 % | 98 %, 58 %; 16 % | 98 %, 59 %; 26 % | 100 %, 73 %; 88 % |
| La Voz | 97 %, 64 %; 16 % | 99 %, 60 %; 18 % | 100 %, 74 %; 53 % | 100 %, 80 %; 74 % |
| Los capellanes | 100 %, 64 %; 13 % | 99 %, 57 %; 6 % | 98 %, 57 %; 3 % | 100 %, 71 %; 88 % |
| Las camisas | 100 %, 47 %; 35 % | 99 %, 59 %; 50 % | 98 %, 63 %; 31 % | 100 %, 72 %; 69 % |
| Fran | 100 %, 63 %; 3 % | 100 %, 66 %; 6 % | 98 %, 71 %; 3 % | 100 %, 80 %; 51 % |

Before, the later a mission came the more a careless party won it (up to 99 %); now it loses
it in any order, and whoever thinks wins every one with a third to a half of its PV gone. Still
soft: Las camisas (their question is a light one: `carta-sin-pensar` let 35 % through before) and
La Voz done last with the cats grown (53 %: a whole point more of `hit` walled the thinking player
who wears its newest ánimas, 67 % at the first try).

**The castle and the night as the yardstick** (the same table): Aurelià with Emilie's alone 35 %
in 16 rounds (90 % before: it did not ask for the two missions it is meant to), with two 99 % and
68 % of its PV, with all four 100 % in 7 rounds; Dirección with two 76 %, with three 93 %. The
night's elite with Nuria's ánima alone 1 %, with one friend more 85 %, with three 93 %; its rooms are
won from the first friend on. Not tuned and still open: the second floor's 2a is the hard room it
was (68 % with three), and careless play wins the third floor's 3c and 3d (87 %, 69 %); raising
`year2` and `year3` moved one target for another (cliffs).

**Whole games** (`just game-sim run --player pensando,corredor,casual --runs 12`):

| Player | Before | Now |
| --- | --- | --- |
| `pensando` | 100 %, 186 min, 65.5 fights (4.4 lost) | 100 %, 191 min, 69.5 (6.4) |
| `corredor` | 100 %, 166 min, 73.3 (3.1) | 100 %, 142 min, 65.5 (5.9) |
| `casual` | 100 %, 834 min, 293 (95) | 100 %, 1052 min, 349 (116) |

No new wall for whoever thinks or hurries: the walls left are the palace guards at the first try
(on purpose) and the night with Nuria's ánima alone (what Aitor says: «mejor no probarlo»). La Voz
done last is won at the first try 83 % of the time. `just fight-sim check`: 14 of 170 out, every one
out before too (21 before), except Lo Directo's newest-ánimas target, moved from 65 to 55 % (whole
games win it 92 % at the first try).

#### The castle's first floor with Nuria and Emilie (Aitor, 2026-11-23)

What was asked: the three guards before the curtain, the first floor and Aurelià, with Papagato and
Freática at 2 or 3, «que sea un reto pero no imposible». Measured with the party as it comes
(`storyPoint('castillo-1:emilie')`), Gerard on Matemágico and Aitor on Tecnópata, each with one of
the two friends' ánimas to switch to, jar empty and bought.

| Fight | Before (`smart`; `casual`) | Now |
| --- | --- | --- |
| The guards | 100 %, 67 % PV, 3.8 rounds; careless 100 %: two of them, won without thinking | 100 %, 45 % PV, 4.4 rounds; careless 5 % |
| The guards with Nuria's alone | 66 % (the curtain should not open yet) | 1 % |
| Rooms 1a, 1b, 1c | 96–100 %; careless 83–100 % (they teach) | the same |
| La Delegada | 99 %, 43–57 % PV; careless 6–11 % | the same |
| Aurelià | 50–80 %, 13–14 rounds; careless 0 % | 84–91 %, 9.7–10 rounds; careless 0–2 % |

**A bug in Aurelià**: his next move was picked by his turns, and the Récord's run-up took a turn,
so on the last straight he made one Expulsión and then Récord after Récord (`step` in his mark now
counts what he has announced). **The numbers**: the guards stay three until the third friend's ánima
(`GUARDS.animasPerGuard` 2 → 3), 220 → 250 PV and 30 → 31 a blow before what each ánima takes off;
Aurelià 540 → 420 PV, Pregunta 85 → 105, the ruler with nobody to punish (`castigoLeve`) 16 → 28: a
third shorter, and as dangerous. `CASTLE_ASKS` for the first floor 2 → 1: with one side mission it
is the fight that is asked (the curve's dual party, which never wears Freática, is at 83 %);
`castillo-1:none` is the castle with no side mission. New targets: `guardianes-con-dos-sin-pensar`,
`aurelia-con-emilie` and its `-sin-pensar`; `aurelia-bien` (every ánima) is won in 4.5 to 10 rounds,
not 7 to 13. El Empollón's Repaso no longer says it copies the blow (that is El Montón's).

### The final pass

What is left once the last skills and bosses are in, in order. Each step has its command.

1. **See what nothing holds**: `just fight-sim coverage`. Give every fight on its list its pair of
   `TARGETS`, and every new ánima a target that wears it.
2. **Measure the story as it is played**: `just game-sim` for «EXP por tramo» and the levels each
   player brings to each fight («llega con»); put the EXP in `STRETCH_XP` if a mission changed.
3. **Check the growth first**, since it moves every fight after it: `just fight-sim progress` (the
   order of the missions should not count: § Progression), then `just game-sim` for the levels each
   player really brings.
4. **Weigh the skills**: `just fight-sim skills --story --fight all`. Read every `no se usa`,
   `domina` and `quitarla no cambia nada`; change the skill, or teach `worth` its value.
5. **Fight by fight, in the story's order**: `just fight-sim levers --pairs --fight <fight>`, then
   `just fight-sim optimize --pairs --at <first>,<last> --fight <fight> --auto 4`. Check the proposal
   whole (`just fight-sim check --tune …`), write the numbers into the code, move the fight's
   `TARGETS` to those story points.
6. **Keep a reference and look at the whole**: `just fight-sim report --baseline`, and `just game-sim`
   again for walls and trivial stretches.

## Jev on both sides

A curiosity, not a measure: `node --experimental-strip-types scripts/fight-sim-duel.mjs <fight> [party] [seed]`
plays one real fight with Jev choosing for both sides, the party's action among the legal ones and
whom each foe goes for. It sees what a player sees (PV, maná, announced moves, skill descriptions,
what just happened) and nobody's real name. About two calls a round and one per foe; it needs
`TYPESAFE_API_KEY`.

**What it was used for (2026-11-21, Aitor: «usa Jev para ver cómo piensa y aplícalo en los bosses»).**
Eight fights against the bosses with Jev at both sides, 169 choices of whom a foe goes for: nine
in ten for **whoever has the fewest PV**, whether or not that one is holding on (43 to 6 when the
two pulled apart), to bring one down as soon as it can; and with Jev aiming, the foes won all
eight. The bosses used to take turns, one blow each. Now a boss goes for whoever is closest to
falling (`closestToFalling`, `SHREWD` in `src/castle.ts`: the castle's three, the Queen's hands, El
Campeón, La Voz, Fran and El que no converge), on a tie whoever's turn it was; pupils and the small
fights still take turns. Who plays the answer barely notices (Aurelià 97 %, Dirección 89 %, La Voz
96 %; Fran went from 94 % to 88 %), since the answer is to hold on when a blow is said for you.

## From code

`src/battle-sim.ts` is pure: `simulate`, `sweep`, `conclude`, `checkTargets`, `playFight`, `withTuning`.
`src/balance.ts` is the bench, pure too: `miss`, `optimize`, `levers`, `skillReport`, `coverage`,
`progressLines`. Each takes a `Play` (how rows get played): `inline` here and now, or
`createPool().play` (`scripts/fight-sim-pool.mjs`) among threads.

```js
import { simulate } from '../src/battle-sim.ts';
const row = simulate({ fight: 'cebollon', party: 'gerard:papagato+aitor:matemagico', levels: { papagato: 2 }, policy: 'smart' }, 500, 35);
```

## A second opinion from Jev

The last, optional step: `--jev` hands a finished report to Jev (TypeSafe's model) and asks what the
numbers mean against what the fights are meant to be. The numbers stay the simulator's; Jev only
judges them. It is never called unless asked, it needs `TYPESAFE_API_KEY` in `.env`, and `JEV_MODEL`
picks the model (`jev-latest` by default).

```sh
just fight-sim run --jev-dry-run                      # the exact request, nothing sent
just fight-sim run --policy casual,smart --jev        # ask
just fight-sim check --jev --intent "What these fights should be, in words"
```

It answers: `dynamic_holds` (do the results match the intent?), `fairness` (could someone playing for
the first time find the way to win?), `next_lever` (the one thing to change, or `none`) and a
`difficulty_<fight>` for each fight. The code is `scripts/fight-sim-jev.mjs`.

## Uri's tower, as tuned

Measured with `just fight-sim` (200 fights, seed 35). `DUO` is the dual party; the levels are the
tower's (Papagato 2, Matemágico 2).

| Fight | Party, bot | Wins | Rounds won | PV left | Duals |
| --- | --- | --- | --- | --- | --- |
| Vertitrón | duo, smart | 100 % | 5.1 | 73 % | 2.2 |
| Vertitrón | duo, smart, no duals | 100 % | 13.3 | 36 % | – |
| Vertitrón | duo, casual | 58 % | 12.5 | 12 % | 0.6 |
| Vertitrón | duo, casual, no duals | 28 % | 13.1 | 10 % | – |
| Vertitrón | mission party, smart | 99 % | 13.8 | 27 % | – |
| Vertitrón | duo, only Atacar | 0 % | – | – | – |
| El Plato (Matemágico 1) | duo, smart | 100 % | 4.0 | 70 % | 1.1 |
| El Plato | mission party, casual | 95 % | 7.2 | 15 % | – |
| La Cebolla y los suyos | duo, smart | 99 % | 4.4 | 49 % | 1.1 |
| La Cebolla y los suyos | duo, smart, no duals | 97 % | 6.0 | 53 % | – |
| La Cebolla y los suyos | mission party, casual | 4 % | 7 | 7 % | – |
| Ring 3's packs | mission party, smart / casual | 94 % / 57 % | 4.4 / 4.5 | 57 % / 50 % | – |

What the numbers say:

- Vertitrón turns on its Grito liberador: every shout takes 2 off the party's Fuerza and Magia and
  gives it 1, for good, so a long fight gets harder every five turns. The duals end it before it
  shouts much (5 rounds against 13); without them, `smart` breaks the eye almost every time, so the
  Rayo comes about once.
- Casual's duals happen by chance and are worth a lot: 58 % with them, 28 % without.
- A dual always takes El Plato's weakness, so the dual party reads it in four rounds.
- La Cebolla's layers are the escort's cliff for casual (4 % with four, 0 % with five).
- The biggest single action on Vertitrón (360 PV) is about 220, at most 240: Zarpazos de fuego on a
  Punto débil, the reward for finding both duals. Nothing else comes near.

## Càmping Eurocamping, as tuned

Measured with `just fight-sim` (200 fights, seed 35), Papagato 2 and Matemágico 2. `DUO` is the dual
party; `TECH` is Gerard on Matemágico and Aitor on Tecnópata, two ánimas of magic, the party the
magos ask a question of. Its numbers are `CAMPING` (book `camping.rules`) and each foe's `PROFILES`.

| Fight | Party, bot | Wins | Rounds won | PV left |
| --- | --- | --- | --- | --- |
| Magos | duo, casual | 100 % | 3.2 | 72 % |
| Magos | tech, smart | 100 % | 5.0 | 60 % |
| Dados | duo, casual | 100 % | 3.7 | 58 % |
| Agentes | duo, casual | 100 % | 3.3 | 79 % |
| Tienda equivocada | duo, casual / mission party, smart | 100 % / 100 % | 4.3 / 5.6 | 53 % / 42 % |
| Parcela negra | duo, smart | 97 % | 5.8 | 40 % |
| Parcela negra | duo, casual | 54 % | 5.4 | 19 % |
| Parcela negra | tech, smart | 52 % | 7.3 | 7 % |
| El Campeón | duo, smart | 100 % | 8.4 | 71 % |
| El Campeón | duo, casual | 43 % | 9.4 | 18 % |
| El Campeón | tech, smart | 100 % | 12.4 | 39 % |
| El Campeón | duo, only Atacar | 0 % | – | – |

What the numbers say:

- The small fights teach one rule each and are won without thinking; reading the plate (the sixes
  first, the agente face up) only saves PV.
- The black pitch is the hard one: both magos charge on the same turn, so two Bombonas land
  together; holding on that round and hitting the magos with blows is the way through. Two ánimas
  of magic against them halve their own damage, which is the question.
- El Campeón: `smart` holds on (Defender, which also gathers maná) while it is a hero and spends it
  all while it is in plain clothes; `casual` hits it as a hero at half and loses as often as not;
  Atacar alone never wins, since in plain clothes it gets its PV back.
- `smart` knows whom the Puñetazo will hit, a person does not: people will hold on with both.

## Las cuerdas, as tuned

Measured with `just fight-sim` (200 fights, seed 35). Its numbers are `MARTA` (book `marta.rules`) and
each foe's `PROFILES`. The qualities are played with Papagato 2 and Matemágico 2, La Voz with both at 3.

| Fight | Party, bot | Wins | Rounds won | PV left |
| --- | --- | --- | --- | --- |
| La Lealtad | duo, smart | 93 % | 3.3 | 54 % |
| La Lealtad | duo, casual | 20 % | 5.2 | 19 % |
| La Lealtad | duo, attack only | 0 % | – | – |
| Lo Cristalino | duo, attack only | 100 % | 5.0 | 35 % |
| Lo Cristalino | duo, smart | 100 % | 2.3 | 82 % |
| Lo Cristalino | tech, random | 41 % | 10.8 | 35 % |
| Lo Directo | duo, smart | 99 % | 5.2 | 45 % |
| Lo Directo | duo, casual | 14 % | 6.1 | 11 % |
| Lo Directo | duo, attack only | 0 % | – | – |
| Lo Directo | tech, smart | 16 % | 9.1 | 14 % |
| Lo Directo | tech, smart, Eléctrico on Atacar | 77 % | 8.9 | 13 % |
| La Voz | duo, smart | 98 % | 10.8 | 41 % |
| La Voz | duo, smart, no duals | 80 % | 13.0 | 23 % |
| La Voz | duo, casual | 17 % | 12.4 | 12 % |
| La Voz | tech, smart | 42 % | 15.3 | 26 % |
| La Voz | duo, attack only | 0 % | – | – |

Measured 2026-11-15, after every fight was held to its pair (`docs/combat.md` § La respuesta de cada
combate). What changed for it: La Lealtad's Juramento is sworn when the round starts and does not
move inside it (36, so whoever she names holds on), her Eco is frailer (50 PV) and grows faster
(12 a turn, up to 48); Lo Directo has 420 PV and takes ×3.5 while Clavado, and is weak to Eléctrico;
La Voz's Golpe directo is 54. Lo Cristalino is the one left to do: two magic ánimas playing at
random still win 41 %. Measure again whenever what the party's ánimas can do changes.

La Voz runs on the fight's clock, so the bots play it in time (2026-11-20, each note she sings a
beam and her silences the only window): `smart` holds on while she sings at it and her next silence
is more than `DENSE` seconds off, otherwise waits for a silence and presses `REACT` into it, and has
the second fighter's blow ready inside the same silence (the Acorde) four times in five, judged at
its press (`song.aim`) as on screen; `casual` waits half the time and chains one in seven; `attack`
and `random` never look at the song (`TIMED`, `CHORD`, `ROOM`, `REACT`, `DENSE` in
`src/battle-sim.ts`). Against her song nobody thinks for three seconds: a turn's thinking is
`SONG_THINK` (1.2 s). With her notes landing about once a second, every point of them counts: tune
one note at a time (`--tune marta.rules.vozRe=4:5`), and `vozDo`/`vozFa`, which come twice a turn,
twice as carefully. Her Magia against the party's Espíritu does the rest, so a note of 2 is 2 on
Gerard and 5 on Aitor. `voz-sin-cubrirse` (`--ban defend`) measures what holding on is worth. Her
second voice (`marta.rules.coro`, its PV) can be hit while she sings, so nobody waits for a silence
while it stands; `smart` counts breaking the Calderón (an Acorde while she holds her breath) as the
damage it saves. While she only sings she takes no turn and no time in the foes' phase (other
turnless foes still count a turn's time; the fights tuned with them were measured so).

## The castle, as tuned

Final pass, 2026-11-21 (`just fight-sim story`, 200 fights, seed 35): the dual party at each floor's
story point, every mission behind it. Its numbers are `CASTLE` (book `castle.rules`), `STRONG` and
each kind's `PROFILES`.

| Fight | `smart` | `casual` | What it is |
| --- | --- | --- | --- |
| 1a, 1b, 1c | 100 %, 1 to 2 rounds | 99 to 100 % | The first floor teaches: fresh gum, one pupil's rule each |
| La Delegada · 1.º | 100 %, 88 % of PV, 3.9 rounds | 38 % | The first room that asks to be read |
| **Aurelià** | 97 %, 11.4 rounds | 8 % | With two side missions 92 %, with one 7 % |
| 2a (Chivata, Repetidor, Empollón) | 94 %, 37 % of PV, 6 rounds | 39 % | The floor's tightest room |
| 2b, 2d, 2e | 98 to 99 %, 4 rounds | 26 to 46 % | |
| 2c (Gemelos, Repetidor) | 100 %, 4.2 rounds | 67 % | The floor's soft room (`teaching`) |
| La Delegada · 2.º | 92 %, 4.2 rounds | 29 % | |
| **Dirección** | 89 %, 7.4 rounds | 3 % | With two side missions 9 % |
| 3a (Chivatas, Repetidor) | 99 %, 4.9 rounds | 74 % | The floor's soft room (`teaching`) |
| 3b, 3c, 3d | 89 to 94 %, 4 to 6 rounds | 28 to 40 % | |
| La Delegada · 3.º | 89 %, 4 rounds | 24 % | |
| La Reina, first meeting | gets her to the tenth where she takes Aitor: every time with two friends' ánimas worn each, 88 % with the dual party | never gets there | Cannot be won; held by `happens` |
| La Reina, with the artilugio | 100 %, 5 rounds (plays the melody) | 0 % (random buttons) | Short on purpose: the fight was the first one |

What moved to get there, from the first guesses of the redesign:

| Number | Was | Is |
| --- | --- | --- |
| `year1`, `year2`, `year3` | 1.25, 1.4, 1.5 | 1.6, 1.4, 1.8 (second-years come in threes and with fillings, so their scale is the lowest) |
| El Repetidor, El Empollón, La Delegada, El Ausente, El Castigado, El Montón (PV) | 110, 85, 130, 100, 120, 130 | 160, 125, 150, 140, 160, 250 |
| `empujon`, `repaso`, `senalar`, `gemelo`, `orden`, `levantar` | 46, 24, 12, 20, 22, .5 | 54, 32, 16, 23, 12, .4 (the twins hit harder, La Delegada herself softer: her weight is the order) |
| `presente`, `revienta`, `copia` | 55, 75, 1 | 80, 150, 1.2 |
| Aurelià | 480 PV, Récord 70 | 560 PV, Récord 80 |
| Each of Dirección | 185 PV, 19 Magia, Circular 12 (×1.8 wet), Resolución 90 | 245 PV, 20 Magia, Circular 16 (×2.6 wet), Resolución 100 |
| The Queen | Pegote 34, Aplastar 26, La Pompa 80 on everyone | Pegote 74, Aplastar 44, La Pompa 300 PV and 155 on everyone; behind it she takes ×0.375; burst, it costs her 12 % |
| `STRONG` (Encarnados) | PV ×1.6, blows ×1.3 | PV ×1.3, blows ×1.1 |
| Night (`NIGHT_PUPILS`, src/night.ts) | start 8, 1.1 a friend | start 6, 1 a friend |

**What it is not.** The rooms of three are on a cliff: a tenth less PV and blows takes the smallest
party that can be there (two side missions on the second floor) from 55 % to 87 % playing well, and
lets a careless full party win. They are tuned for the party with every mission behind it, which is
where the game pushes; with fewer, the trio rooms and the elites say «go and get another ánima»
before the boss does (2a 52 %, La Delegada · 2.º 65 % with two side missions; La Delegada · 3.º
about 30 % with three). A castle story point can name the missions behind it to measure that:
`just fight-sim story --at castillo-2:universidad/marta`.

## Emilie's model, as tuned

Measured with `just fight-sim` (200 fights, seed 35). Its numbers are `MODELO` (book `modelo.rules`)
and each foe's `PROFILES`. Inside the model every Atacar can carry water or electricity
(`BattleState.lent`), so nothing here depends on what the jar gave. Played with Papagato 2 and
Matemágico 2, and the boss also as the first day's party meets it (no jar, no levels, Aitor wearing
nothing).

| Fight | Party, bot | Wins | Rounds won | PV left |
| --- | --- | --- | --- | --- |
| Celdas secas | duo, smart | 100 % | 5.3 | 54 % |
| Celdas secas | duo, attack only | 0 % | – | – |
| Oscilaciones | duo, casual | 100 % | 5.1 | 59 % |
| Oscilaciones | duo, attack only | 100 % | 10.0 | 21 % |
| El Átomo | duo, smart | 100 % | 4.3 | 68 % |
| El Átomo | duo, casual | 97 % | 7.3 | 43 % |
| El Átomo | duo, attack only | 0 % | – | – |
| El Átomo | first day, smart | 100 % | 6.3 | 62 % |
| El que no converge | duo, smart | 94 % | 11.1 | 53 % |
| El que no converge | duo, casual | 0 % | – | – |
| El que no converge | duo, attack only | 0 % | – | – |
| El que no converge | first day, smart | 100 % | 11.4 | 55 % |
| El que no converge | tech, smart | 94 % | 13.2 | 47 % |

- The oscilaciones are the boss's rule made loud: the right element lands three times as hard as a
  plain blow, so `casual`, which only looks at the number, finds it. They are the fight that teaches.
- On the boss the right blow takes **no more PV than a plain one**: what it buys is a mark of Error,
  and at none the turns it stands solid and takes double. `casual` never clears a mark and loses to a
  Descarga that grows with them; that is the fight's pair. `smart` values a mark off, a cell wet and
  the boss converged (`ERROR_WORTH`, `MODELO_WET`, `CONVERGED_WORTH` in `src/battle-sim.ts`).
- Its PV and `descargaStep` are the two numbers that move it: at 620 PV and a step of 8, two magic
  ánimas win four times in five and the first day's party one in three. Change one at a time.
- Shock (a bolt on someone wet, half the time, a turn lost) is in the rules the bots play, on both
  sides; they do not go looking for it. With it, and a foe's bolt landing half on the others wet,
  the boss reads 96 % for two magic ánimas played well (62 % PV, 10.7 rounds) and 0 % unplayed.
- Not simulated: the marks the dungeon takes off before the fight (`calibrate`), and waiting out the
  20 s of Mojado before a Descarga, which a person can do and a bot does not. It works once: from the
  second time it floods and discharges in the one move (`wary`). The bots never let the clock run
  that long, so their numbers do not move.
