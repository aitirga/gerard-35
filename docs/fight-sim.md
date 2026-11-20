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
| `reaction` | `REACTION_RULES`, what the elements turn | `reaction.rules.storm`, `reaction.rules.blind2` |
| `camping` | `CAMPING`, Càmping Eurosport's foes, as `camping.rules` | `camping.rules.bombona`, `camping.rules.punetazo` |
| `marta` | `MARTA`, Las cuerdas' foes and La Voz, as `marta.rules` | `marta.rules.vozRe`, `marta.rules.acorde`, `marta.rules.directo` |
| `castle` | `CASTLE` (`src/castle.ts`), the castle's pupils, Aurelià, Dirección and the Queen, as `castle.rules` | `castle.rules.resolucion`, `castle.rules.year3`, `castle.rules.reinaVuelta` |
| `modelo` | `MODELO`, the foes of Emilie's model and El que no converge, as `modelo.rules` | `modelo.rules.seca`, `modelo.rules.descargaStep`, `modelo.rules.convergeTurns` |
| `fear` | `FEAR_RULES` as `fear.rules`, and El Plato's blow as `fear.plato` (the onions hit with `ONIONS`, Vertitrón with `VERTIGO`) | `fear.rules.escortLayers`, `fear.plato.power` |

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
ranges; a target with any fight left unfinished at the round limit always fails. Uri's tower is held
with both parties: the mission party for the onions and the young, the dual party (`DUO`) for the
duals, at the levels the tower reaches (Papagato 2, Matemágico 1 or 2; 3 for whoever grinds).

**Every fight keeps a pair** (`docs/combat.md` § La respuesta de cada combate): one target that plays
the fight's answer and one that does not. Name the answer in both `why`s.

| Target | How to play it | Holds |
| --- | --- | --- |
| With the answer | `smart`, with the party the fight is met with | `win` from .9 up (a final boss may sit lower on purpose), and `roundsWon` or `hpLeftWon` clearly better than without |
| Without the answer | `smart` with the answer banned (`ban`) when it is a skill, a dual or a kind of blow; `casual` when it is an order or a moment, which a ban cannot take away | `win` up to .2 |

`attack` alone is not the pair's second half: a fight that only asks for "something other than Atacar"
asks nothing. See § The pair, as retuned on 2026-11-15 for where each fight stands.

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
party and levels chosen by hand. The story is Nuria and Uri's mission as the introduction and then the
rest in whatever order the player likes (`MISSIONS` in `src/battle-sim.ts`), so an open mission is
measured from being the first one done to being the last.

```sh
just fight-sim story                                   # every open mission, first and last, builds nada and mixto
just fight-sim story --at marta:first,marta:last --build elementos --fight cuerdas-directo,voz
just fight-sim story --at marta:universidad --policy smart
```

| A point has | From |
| --- | --- |
| The friends' ánimas of what is behind it (their bonus) | `MISSIONS[id].friend` |
| The ecos of what is behind it | `MISSIONS[id].lights` (Nuria and Uri 2, the uni friends 5, Marta 1) |
| What those ecos bought | `--build`, a shopping list in order (`BUILDS`): `nada`, `mixto`, `elementos`, `tronco`; only what the ecos pay for is bought (`withinEcos`), and nothing is given for free on top (`Setup.exact`) |
| Papagato's level | 2 after the introduction, one more per open mission behind (up to 3) |
| Ánimas to switch between | Matemágico, Papagato and Tecnópata (the introduction: the first two) |

The party itself is `--party` (the dual party by default). The `TARGETS` still play their hand-picked
setups; the final balance is to be done against these points once every mission is in. A new mission
is one more entry in `MISSIONS`; a new way of spending, one more list in `BUILDS`.

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

## Jev on both sides

A curiosity, not a measure: `node --experimental-strip-types scripts/fight-sim-duel.mjs <fight> [party] [seed]`
plays one real fight with Jev choosing for both sides, the party's action among the legal ones and
whom each foe goes for. It sees what a player sees (PV, maná, announced moves, skill descriptions,
what just happened) and nobody's real name. About two calls a round and one per foe; it needs
`TYPESAFE_API_KEY`.

## From code

`src/battle-sim.ts` is pure: `simulate`, `sweep`, `conclude`, `checkTargets`, `playFight`, `withTuning`.

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

## Càmping Eurosport, as tuned

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

Preliminary (docs/castle.md § Built so far). Measured with `just fight-sim check` (200 fights, seed
35): the dual party, Papagato 3, and Atacar's three elements with Vasos and Descarga (`ELEMENTAL`
in `src/battle-sim.ts`). Its numbers are `CASTLE` (book `castle.rules`) and each kind's `PROFILES`.

| Fight | Bot | Wins | Rounds won | PV left |
| --- | --- | --- | --- | --- |
| Primer curso · Chivata y Repetidor | casual | 100 % | 3.2 | 84 % |
| Tercer curso · Empollón, Repetidor y Chivata | smart | 91 % | 10.9 | 43 % |
| Tercer curso · Empollón, Repetidor y Chivata | casual | 0 % | – | – |
| La Delegada · 3.º | smart | 83 % | 8.2 | 18 % |
| La Delegada · 3.º | casual | 0 % | – | – |
| Aurelià | smart | 82 % | 12.9 | 6 % |
| Aurelià | casual | 0 % | – | – |
| Dirección | smart | 92 % | 6.3 | 10 % |
| Dirección | casual | 0 % | – | – |
| La Reina, first meeting | smart | 0 % | – | – |
| La Reina, with the artilugio | smart (plays the melody) | 100 % | 7.0 | 74 % |
| La Reina, with the artilugio | casual (random buttons) | 0 % | – | – |

Measured 2026-11-19. What changed for it: Dirección has 160 PV each and hits softer (Expediente 18,
Horario 6, Circular 12, ×1.8 on the wet), and its Acta announces the Resolución a turn ahead; the
third year hits ×1.25, not ×1.5; La Delegada's third room is her and the twins. Without Papagato
(`TECH`), Aurelià and Dirección are still almost never won: the whole-game simulator
(docs/game-sim.md) says whether a real party reaches them that way. In `playOut` the smart bot plays
the artilugio's melody (two notes a turn) and casual presses random buttons.

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
| La pluma | duo, smart | 100 % | 5.3 | 60 % |
| La pluma | duo, attack only | 0 % | – | – |
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
