# Dadaísta

Status: designing (round 5, 2026-11-19: faces with icons, built) · Comes from: the university friends' mission,
[`docs/quests/universidad.md`](../../quests/universidad.md)

**Decided** (Aitor, 2026-11-15): this direction, the working name *Dadaísta*, that it deals
**physical damage with a random part**, that **its maná is dice** (*La mano*: the player sees
what the maná has rolled and decides from that), and that it has **a skill that spends a die and
rolls the others again**, called **Agitar**: it **does not spend the turn**, it is a **fixed
command** once unlocked, with **×1**, and it **is improved at home**, at the jar (§ Agitar).
Also decided (Aitor, 2026-11-15, after playing level 1): **a skill always spends its die**, as any
maná (a bet lost in *Doble o nada* loses the die too; more dice come from Defender, as for
everyone), and there is a **Joker** die (§ The Joker). Everything else here is a proposal.

## Identity

- **Dadaísta** (*dado* + the dadaists, who made art out of chance): whoever wears it fights with
  dice. It throws them, reads them, and bets them. It is the campsite's Dado, on the party's
  side: a face in view that says how hard the blow will be.
- Unlocked: when the photo with the melon is taken and the friends' lights leave them
  (`winUni`). Shared: Gerard or Aitor equips it in an extra slot. Seven levels by EXP
  ([`../README.md`](../README.md) § Levels).
- Motto (proposal): *"Primero se tira. Luego se piensa."*
- Colour, look, interface: _open_ (round 7). Candidate: the campsite's warm bulbs, `#e8b04a`, to
  check against Matemágico's gold `#f3cf78` and Papagato's orange.

## Role

**Physical damage with the highest ceiling and the lowest floor in the party.** No statuses of
its own, no cure, no guard: it brings blows, and what a blow is worth is on the dice.

- Next to Papagato (the other physical ánima): Papagato prepares a wound and cashes it, and it
  is dependable. Dadaísta prepares nothing; it turns up with a 6 and lands it in the wound Haru
  opened, or with a 1 and has to make something of it.
- Good at: one huge blow when the dice allow it, many small blows when they do not. Bad at:
  being counted on for one exact thing on one exact turn; keeping anybody alive.

## Stats

Proposal: Fuerza +3, Defensa +2, Magia −1. The friends' light (`ANIMAS.universidad`, the party
bonus) stays as it is: Fuerza +1, Espíritu +1, PV +10.

## Signature: where chance comes in

**A, La mano, is decided** (2026-11-15). B and C stay in the table as what was weighed.

| | How | For | Against |
| --- | --- | --- | --- |
| **A · La mano** | Its maná is dice: each point is a die with its face in view (three rolled as the fight starts). A skill spends a die the player chooses, and the face says what it does. Chance comes **before** the choice; only a bet (*Doble o nada*) rolls again | The most to decide; nothing ever just fails; luck is a hand to play | The maná circles become dice; a die picker in the skill sheet |
| **B · La tirada en el golpe** | Plain maná. Every skill throws its dice as it lands, in view, as Álvaro's *Tirada* did | The most exciting to watch; the least to build | The least to decide: a bad roll is a bad turn and nothing can be done about it |
| **C · El dado de la ronda** | Plain maná. One die on the wearer's plate, rolled as each round starts, exactly as the Dado foe's; every skill reads it | The easiest to read (one number); the Dado's own rule, handed over | A low die tends to mean "not this round" |

**The rule that keeps it from being luck and nothing else: every face has a use.**

| The die | Its use |
| --- | --- |
| High | One strong blow |
| Low | A safe bet, or many small blows |
| Even or odd | Which side effect a blow leaves |
| Equal to another | The skill happens twice (a passive) |
| The one least wanted | Paid to roll the others again |
| Three in a row | The definitiva's condition |

The maná rules stay as they are, read in dice: Defender rolls two new ones, a round's rest one,
Maná +1 is a fourth die.

**How a turn goes** (confirmed by Aitor, 2026-11-15): the dice are on the table from the start of
the fight, faces up. On their turn the player (1) looks at them, (2) chooses a skill, (3) chooses
which die to spend on it, and (4) the action happens, by that die's face. Nothing is rolled in
between, except *Doble o nada* (which rolls the die bet) and *Agitar* (which rolls the ones left).
New dice are rolled only when maná comes back: Defender, a round's rest. Every skill spends the
die it took, whatever comes of it, so the hand only gets shorter until the wearer holds on.

### The Joker

Built (`JOKER`, `JOKER_CHANCE`, `JOKER_AFTER_DUAL` in `src/battle.ts`). Now and then a die dealt
to the hand is not a face but the **Joker**: black lacquer with a vermilion star.

- **How often** (Aitor, 2026-11-15): 2 % of the dice dealt. **A dual attack calls it**: the next
  die dealt to whoever took part in one (Defender, a round's rest) is the Joker 20 % of the
  times; only that one die. Dadaísta has no dual of its own yet, so today that means changing
  ánima for the dual and coming back to the dice. Nothing on screen says the die is called.

- It **always meets the good condition of the skill it is spent on**: a six for a blow by its
  face (*Golpe de dados*), a bet that cannot be lost (*Doble o nada*, never rolled).
- Its blow **falls on every foe standing**, each one measured on its own.
- Nothing announces it: it is in the hand or it is not. The die picker names it and says what it
  does; the skills' descriptions do not mention it.
- For the skills not built yet, the same rule: the best case of each (the most strikes for
  *Collage*, both effects for *Pares o nones*), on everyone.

## Skills per level

Numbers are first guesses for `just fight-sim`. Atacar is 18; a blow adds the wearer's Fuerza
and takes the foe's Defensa, once per strike.

| Level | What it gives | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| 1 | **Golpe de dados** | 1 die | 6 + 5 a pip (11 to 36) | `Daño variable físico a un enemigo. Más fuerte cuanto más alta la cara del dado.` |
| 1 | **Doble o nada** | 1 die, bet | twice Golpe de dados (22 to 72), or nothing | `Daño variable físico a un enemigo. Vuelve a tirar el dado: si sale igual o más alto, golpe doble. Si sale más bajo, no hay golpe y el dado se pierde.` |
| 2 | Command · **Agitar** | 1 die, ×1 | — | *Abstract*: `Gasta un dado y vuelve a tirar los demás. No gasta el turno.` |
| 2 | **Collage** | 1 die | 4 a strike, 7 minus the face strikes (six with a 1, one with a 6) | `Daño leve físico a enemigos al azar. Golpea más veces cuanto más baja la cara del dado.` |
| 3 | Passive · **Racha** | — | — | A 6 that is spent comes back to the hand, rolled again |
| 4 | **Maná +1** | — | — | A fourth die |
| 5 | **Pares o nones** | 1 die | 16, and −3 for 2 rounds | `Daño leve físico a un enemigo. Con dado par, baja su Defensa durante 2 rondas. Con dado impar, baja su Fuerza durante 2 rondas.` |
| 6 | Passive · **Dobles** | — | — | Spending a die while an equal one is still in the hand makes the skill happen twice |
| 7 | **Cubilete** | every die held | 6 + 4 a pip, a strike a die | `Daño variable físico a un enemigo. Gasta todos los dados y golpea una vez por cada uno.` |

- **Golpe de dados** (the name is Mallarmé's *Un golpe de dados jamás abolirá el azar*): the
  honest one. A 1 or a 2 here is worse than Atacar, so those dice go elsewhere.
- **Doble o nada**: the random part of the damage, and always a choice. The lower the die bet,
  the surer: a 1 always wins (22), a 3 wins two times in three (42), a 6 one in six (72). On
  average it beats Golpe de dados with a 1, 2 or 3, ties with a 4 and loses with a 5 or 6. A
  lost bet costs the turn and the die: the hand is maná, and a skill spends it.
- **Collage**: the same die as a different shape of damage. Many small strikes peel layers and
  spread over a group; against one foe with high Defensa they are worth little. Where they land
  is not chosen.
- **Racha**: sixes are spent first, and a good hand lasts.
- **Agitar**: § Agitar, below.
- **Pares o nones** (back in the table now that Agitar is a command and not a skill in the
  list): the only thing it does besides hitting, and the die decides which. Proposal; the slot
  can take another of the options.
- **Dobles**: the reason to keep a die, or to Defender for one more: a pair is two actions for
  one die. With four or five dice there is a pair most of the time (to tune: the repeat at half).
- **Cubilete**: the whole hand at once, 40 to 120 with four dice. The round after there is
  nothing left.
- **Definitiva** (bought at the jar, [`../README.md`](../README.md) § Definitivas): proposal,
  *Órdago*, unlocked in a fight when the hand holds three dice in a row. What it does: _open_.

### Agitar

Decided by Aitor (2026-11-15): it spends a die and rolls the others again, **it does not spend
the turn**, it is **a fixed command** once unlocked, with **×1**, and it **is improved at the
jar**. The rest is a proposal.

- **What it does**: the player chooses the die to give up, and every other die in the hand is
  rolled again, in view. The turn is still theirs: look, shake, look again, then act. The face
  given up does not matter, so it is where the die nobody wants goes.
- **A fixed command, not a skill in the list**: it sits in the wearer's dock by the dice, with
  its count on it (*Agitar ×1*). Proposal for the button: the pad's top button (X), the one
  that changes Matemágico's element on Atacar. So that button is, for each ánima, its own
  gesture. Through `data-glyph`, as every key.
- **×1** (_to confirm what it counts_): proposal, **once a round** (it comes back as each round
  starts). The other reading is once a fight. It costs a die either way, so the hand itself
  also limits it.
- **When**: level 2 (proposal, moved from 5): it is the ánima's own gesture, so it comes early,
  right after the first fights have taught the dice.
- **What it is for**: the faces are worth about the same on purpose, so rolling again pays for
  what a hand can *be*: a six for Racha, a pair for Dobles, three in a row for the definitiva.
- **Edges**: it needs two dice or more. A 6 given up comes back (Racha), so the whole hand is
  rolled again for nothing. Dobles does not repeat it (it is not a skill).
- Its name is from Tzara's recipe for a dadaist poem: cut the words out, put them in a bag,
  *agite suavemente*.

**Improved at the jar** (proposal: one short line on Dadaísta's page, beside Maná +1 and the
Definitiva; each node needs the one before it):

| Node | Ecos | What it does |
| --- | --- | --- |
| **Agitar ×2** | 1 | One more use |
| **Plantarse** | 1 | Before shaking, one die is chosen to stay as it is |
| **Dado cargado** | 2 | The dice rolled again cannot come out lower than the die given up: a 1 is a plain roll, a 5 leaves fives and sixes |

- Four ecos in all; with Maná +1 (2) and the Definitiva (3), Dadaísta's page holds nine.
- **This is new for a shared ánima**: until now the jar gave a shared one only maná and the
  definitiva ([`../README.md`](../README.md) § Two ways to grow). Dadaísta would be the first
  with a line of its own, and only for its command; its skills still come by level.
- Other nodes weighed: the first Agitar of a fight costs no die; Agitar ×3.

### Options for the slots

| Instead of | Option | What it is |
| --- | --- | --- |
| Collage (2) | **Collage on one foe** | The same strikes, all on the foe chosen: surer, and closer to Papagato's Zarpazos |
| Pares o nones (5) | **Invito yo** | No blow: a die handed to an ally's ánima as maná (one point; two if the die is a 4 or more). The only ánima that feeds the others |
| Pares o nones (5) | **Dobles**, as a skill | Two dice: a blow as strong as their sum; if they are equal it lands on every foe |
| Racha (3) | **La otra cara** | Defender, besides giving two dice, turns over the ones held (1↔6, 2↔5, 3↔4): low dice kept are high dice later |
| Racha (3) | **Mano caliente** | Atacar, free, throws a loose die: 13 to 23 instead of 18, and on a 6 that die goes to the hand |
| Dobles (6) | **Pifia** | A 1 that is spent leaves the foe open: the next blow on it lands harder |

**Atacar** (to decide): plain, as with every ánima, or itself a throw with a small spread (the
*Mano caliente* row). Proposal: plain. The free action stays the sure one.

## Round 5 · Faces with icons instead of numbers (decided and built, 2026-11-19)

**Decided by Aitor (2026-11-19): A, and Doble o nada is gone.** The dice show **small icons that
do things** instead of 1–6. La mano stays (dice as maná, faces in view, the player picks the die);
what changes is what a face *means*. Everything above that reads faces as numbers (high and low,
even and odd, three in a row, Racha's six, Collage and Cubilete by pips, Dado cargado) is from
before this round and is to be redone in icons.

| | How | For | Against |
| --- | --- | --- | --- |
| **A · Each face is an action** | Spending a die does what its face shows, on the target chosen. Six faces, each tied to a system the game already has | The most to decide (which die, on whom, now or later); combines with the other ánimas; levels can carve faces | Damage is no longer a sliding number: a balance pass, and the bet needs a new rule |
| **B · Numbers with marks** | Faces keep 1–6 for strength; the 1 and the 6 also carry an icon (an extra effect) | Smallest change; today's balance holds | Barely changes how it plays |
| **C · Icons that make phrases** | Icons combine in the hand (two of a kind, an eye and a fist…) into stronger moves | The most dadaist (a cut-up poem) | Rules the player must memorise; against readable systems |

Recommended: **A**. A first face set, drawn as old printer's ornaments in ink on ivory (not
cartoon icons), the red one being the die's red face:

| Face | Icon | What it does when spent |
| --- | --- | --- |
| ×2 | **Manicule** ☞ | A strong physical blow to a foe |
| ×1 | **Scissors** | A light physical blow and Sangrado (Papagato's wound, cashed by Zarpa en la llaga) |
| ×1 | **Eye** | Leaves Punto débil on a foe |
| ×1 | **Bracket** | Protects an ally (Protegido) |
| ×1 | **Blank** (red) | Repeats the last face this wearer spent in the fight; with none yet, it can do nothing |

- **Levels** get content for free: each level **carves a face** (level 2: the blank becomes a
  wildcard that copies without spending its twin; level 3: a manicule becomes a double one).
- **Agitar, Dobles** keep working (a pair is two equal icons). **Racha** becomes "a manicule
  spent comes back rolled"; the definitiva's "three in a row" becomes **three different faces**.
- **Doble o nada**: removed (Aitor, 2026-11-19).
- **The blank** changed while building: it repeats the last face spent rather than copying one
  held, so it needs no second pick and asks when to spend it (after a good face).
- **Code**: the hand already holds one face per die (`Combatant.dice`, `diceOf`, `castDie` in
  `src/battle.ts`); faces become ids instead of numbers, `src/dice.ts` draws ornaments instead of
  pips, the hand sheet names faces, `bestDie` and the simulator learn them. Nothing new in the
  status engine: every face uses one that exists.

_Open_: whether the faces differ by level (the carving above), and how Agitar, Racha, Dobles,
Collage and the definitiva read in icons.

## Check, so far

- **Against Papagato**: a die spent well is worth about 26 on average for one maná and brings
  nothing with it; Zarpazo sangriento is 16 and two stacks. Collage with a 1 is six strikes for
  one maná against Zarpazos' four for two: one die in six, and scattered, but to watch in the
  sim.
- **Jackpots**: a 6 bet and won into a *Punto débil* is 72 three times over. Rare by design; a
  cap if the sim says so.
- **The description shape** (`AGENTS.md`) has no word for a strength that changes. Proposal: add
  `variable` to the intensities (and to `tests/battle.test.mjs`) rather than marking four skills
  `abstract`.
- **Needs, none of it built**: maná points with a value and their look in the ánima bar, a die
  picker when a skill is chosen, the bet's roll in view, random targets, the dice in
  `just fight-sim` (`roll` exists), and a level giving maná or a passive (shared with
  Sincopante). For Agitar: a command that does not end the turn (changing ánima already works
  so), its count, its glyph in `GLYPHS`, the hand rolled again in view, and a line at the jar
  for a shared ánima (`TREES` in `src/ecos.ts` is for the own ones today).

## Combined skills

_Open_ (round 6). A name kept for it: *Cadáver exquisito*, the game where each one adds a part
without seeing the other's.

## Look and interface

Built in a first version (2026-11-15), to be judged in play; screenshots with
`just screenshots dadaista --gpu`.

- **Colour**: ivory `#efe6cf`, with ink `#161413` and one vermilion `#d9422b` (a die's red one).
  Not confirmed: the mission's doc had `#e8b04a`, too close to Matemágico's gold and Papagato's
  orange. No pink, no violet.
- **Worn** (`CLASSES.dadaista`, `src/anima-looks.ts`): a black jacket, cream shirt, a red bow tie
  and a brass monocle on its cord. Nothing moves on it: the dice are what moves.
- **The dice** (`src/dice.ts`): ivory cubes with black pips, the one in red, a touch bigger than
  life. They float in a column beside whoever wears it, on the side away from the others, each
  with its face turned to the camera, the first of the hand lowest. A new one (Defender, a round's
  rest, the fight starting) drops in tumbling. At rest they are never still: each drifts, bobs
  and turns a little at a pace of its own, and the ones on the plate rock with them. The Joker
  is the same cube in black lacquer with a vermilion star on every face.
- **The throw** (`updateDice`, `DICE` in `src/battle-scene.ts`): the wearer stays put and raises a
  hand; the die leaves the column, flies at the target tumbling, lands and bounces off to the
  floor. A bet goes straight up first and comes down large over the wearer's head showing what it
  rolled: won, it is thrown and comes down on the target twice (*¡Doble!*); lost, it says *Nada*
  and goes back to its place in the column with the face it rolled.
- **Interface**: on the plate each point of maná is a die showing its face (a spent one, the empty
  place it left); small squares instead of circles on its pill and over its head. Choosing a skill
  that spends a die turns the sheet into the hand, one row a die (*Seis · Golpea por lo que marca*,
  *Tres · Sale con 3 o más*), the cursor starting on the one that would go by default, and the die
  under the cursor comes forward in the scene; then the target. A hand of one skips the step.
- **Each face's landing** (`src/dice-fx.ts`, built 2026-11-19): the face draws its own ornament in
  the air where the die lands, dot by dot as a pen would (`FACE_STROKES` in `src/die-faces.ts`, the
  die's own drawing), in ivory with the die's red, on the GPU engine. **Mano**: two jabs of the
  manicule from the side it came from, the blow shaking the floor, and the hand left pointing at
  the foe over it. **Tijeras**: two cuts crossing in an X, the scissors snapping shut in red where
  they meet, strips of cut paper falling (`scrap`, `DICE_KINDS`). **Ojo**: the lids open from both
  corners, the pupil narrows in red to a small cross where the next blow goes. **Corchete**: two
  brackets close in round the ally in steps and hold, a ring of light at their feet. **En blanco**:
  its red empty frame is stamped first, and the face it repeats is drawn inside it. The clips are in
  `just screenshots dadaista --gpu`.
- **Theme** (`.battle-dock[data-anima="dadaista"]`): strips of ivory paper pasted on ink, none of
  them quite straight, one red rule, a high-contrast serif for names and typewriter for the small
  print.

## In the world · Second round

_Open_.

## Implementation

Built (2026-11-15), level 1 only:

- `ClassId` `dadaista`, `ANIMA_NAMES`, `CLASS_STATS` (Fuerza +3, Defensa +2, Magia −1), `CLASSES`.
- **Dice as maná** (`src/battle.ts`): `Combatant.dice` holds the face of each point; `diceOf`
  keeps it in step with the maná (new points are rolled with the fight's seeded `roll`), so
  Defender and a round's rest deal dice with no code of their own. `act(…, die)` and `commit(…,
  die)` take the die's place in the hand; with none, `bestDie` picks (the highest for a blow, the
  highest sure one for a bet), which is what the simulator and a move left ready use.
- **Faces** (round 5, 2026-11-19): a die is a `DieFace` (`DIE_FACES`: mano, mano, tijeras, ojo,
  corchete, blanco), rolled with `rollFace`. **Tirar dado** (`tirar-dado`, `abstract: true`) is the
  only skill in the list: `act` swaps it for the move of the face spent (`FACE_SKILLS`: `cara-mano`
  38 physical, `cara-tijeras` 16 and Sangrado 2, `cara-ojo` 10 and Punto débil, `cara-corchete`
  Protegido on an ally until the round ends, a new `guard` kind), and a blank does the
  wearer's `lastFace`. Targets follow the die (`validTargets(…, die)`, `dieSkill`); `bestDie` picks
  hand, scissors, eye, brackets, skipping what can do nothing. `BattleEffect.die` says the face, its
  place and what it did (`as`); `BattleEffect.dealt` the dice Defender brought.
- **Look**: the ornaments are one SVG path each (`src/die-faces.ts`), printed on the 3D die's
  texture (`src/dice.ts`) and drawn in the hand, on the plate and in the picker, where each row
  says what the die does and greys out if it can do nothing now.
- Tests in `tests/dice.test.mjs`; the scenario `scripts/screenshots/dadaista.json`.
- **Reached from** the fight tester (wear Dadaísta on Gerard or Aitor). In the story it is worn
  once `anima-universidad` is set (`storyClasses`), with no flag of its own.

Its EXP and levels are built (`LEVELLED`, 2026-11-19), but levels 2 and 3 teach nothing yet.

Not built: Agitar, what levels 2 to 7 give (the faces carved, the passives), its line at the jar,
combined skills, a `TARGETS` pair in the simulator, sounds of its own (it borrows the clink, the
hit and the guard), and the banner when the mission gives it.

## Open

- Agitar's ×1: once a round (the proposal) or once a fight. Its level (2), its button, and its
  three nodes at the jar.
- The level-1 pair, and which options take which slots (Pares o nones at 5).
- Whether Atacar is a throw.
- `variable` as an intensity.
- *Órdago* is a word from mus: traditional, not a product, but to confirm against the mission's
  rule of no real games.

## Not chosen (round 1)

Kept for Pedro's ánima or later: **Agendario** (nothing happens now: each skill is a plan that
arrives rounds later, and plans that arrive together are stronger), **Casamentero** (ties two
fighters: what lands on one lands on the other at half) and **Leguleyo** (changes one rule of
the fight for both sides).
