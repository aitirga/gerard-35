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
