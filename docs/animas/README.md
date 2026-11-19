# Ánimas

What an ánima is, which ones exist, how they grow and the mechanics they share. Who wears what
and the stats are in `docs/party.md`; the story side (grey ánimas, the second round) in
`docs/lore.md` and `docs/chapter-2.md`. Each ánima is designed with the `/anima` skill.

## This folder

```
docs/animas/
  README.md          this page: the rules every ánima shares, the catalogue, combined skills,
                     shared mechanics, and how an ánima is built in code
  <id>/README.md     one ánima: identity, look, stats, skills per level, its mechanic, combined
                     skills, in the world, second round, implementation status and plan, open
  <id>/…             anything else that ánima needs later (skill VFX notes, references)
```

`<id>` is the ánima's `ClassId` (`matemagico`, `papagato`; `noista` is a retired design kept
for later). A friend's mission lives in
`docs/quests/<friend>.md` and links to the ánima it gives.

## Two things called ánima

The word covers two related things; keep them apart when designing:

| | What it is | Code |
| --- | --- | --- |
| **A wearable ánima** | A way of being that someone in the party puts on: a look, a colour, an interface theme, stats and skills. Gerard's power is changing it. | `ClassId`, `CLASSES` (`src/classes.ts`), `CLASS_STATS`, `SKILLS` (`src/battle.ts`) |
| **A friend's ánima** | The small light that leaves a friend when Gerard helps them: a party-wide stat bonus that also weakens the palace guards. | `ANIMAS` (`src/animas.ts`), `anima-<friend>` flags |

In fights the word has a third use: **Ánima** is also the points skills spend (§ Ánima points).

Each **person** helped also gives a **light** (a friend's household can give several: Nuria and
Uri give two, one into Gerard and one into Aitor). Lights are kept in a jar at home. On screen they
are the party's **Ecos de luz**, what improves the ánimas (§ Ecos de luz); they carry no stats and
nobody wears them.

A friend's mission usually gives both: the friend's light, and a wearable ánima that comes from
them (Nuria → Papagato). Player-facing text says *ánima* for both, never *clase*.

## Catalogue

| Ánima | Origin | Colour | Stats (wearer) | Skills | Status |
| --- | --- | --- | --- | --- | --- |
| [**Matemágico**](matemagico/README.md) | Chapter 1's palace: Bernat begs Gerard to think | `#f3cf78` gold | Magia +1, Espíritu +1 | Foc Binari; Análisis Parálisis, Ángulo exacto (2); Cardioide (3) | Playable |
| [**Noísta**](noista/README.md) | Was chapter 1's palace: Gerard shouts "¡NO!" | `#e2483d` red | Magia +2, Espíritu +2, Defensa −1 | No-ta | Hidden: retired (2026-11-01), replaced by Matemágico |
| [**Papagato**](papagato/README.md) | Nuria's mission (Cardedeu), `docs/quests/nuria.md` | `#f0954a` orange | Velocidad +2, Fuerza +1, Espíritu −1 | Haru and Yuki | Playable |
| [**Tecnópata**](tecnopata/README.md) | Aitor's own, from chapter 2's first morning (was the placeholder Físico) | `#4fe0ff` cyan | — | — | Designing (2026-11-05): look, drone-HUD interface and Bip, his robot, first |
| [**Sincopante**](sincopante/README.md) | Marta's mission (Alegia, Las cuerdas), `docs/quests/marta.md` | _open_ | Proposal: Magia +2, Espíritu +2, Defensa +1, Fuerza −1 | Eco de guerra, Eco curativo; proposal up to level 7 | Designing (2026-11-14): an eco on the field that acts on the clock and repeats what it is fed |
| [**Dadaísta**](dadaista/README.md) | The university friends' mission (Barceloneta, Càmping Eurosport), `docs/quests/universidad.md` | _open_ | Proposal: Fuerza +3, Defensa +2, Magia −1 | Golpe de dados, Doble o nada; proposal up to level 7 | Level 1 built (2026-11-15: its dice as maná, its two skills, look, throw and interface); the rest designing. Physical damage with dice. Decided: its maná is dice with their faces in view, and *Agitar*, a fixed command that does not spend the turn, spends one to roll the others again and is improved at the jar |
| _Pedro's_ | Pedro's mission (`docs/quests/pedro.md`, to write) | _open_ | _open_ | _open_ | Idea (2026-11-05): a shared ánima from Pedro, a gay friend of Gerard and Aitor they see a lot |

**Who has what** (2026-11-05): Matemágico is Gerard's own and Tecnópata Aitor's (`ANIMA_OWNERS`),
fixed, never taken off. Besides their own, each equips the shared ánimas (Papagato…) in their
extra slots (one for now, `EXTRA_SLOTS`); two never equip the same one. In a fight they switch
among their own and their extras, one at a time (`docs/party.md`).

## Two ways to grow (decided 2026-11-14)

| | Own ánimas: Matemágico (Gerard), Tecnópata (Aitor) | Shared ánimas: Papagato, Sincopante… |
| --- | --- | --- |
| Worn | Always: they cannot be taken off | Equipped in a slot |
| Levels | **None.** They earn no EXP | Seven, by EXP (§ Levels) |
| Grow by | **A skill tree, opened at home** (the jar), paid with ecos de luz | Levels; at home only **the definitiva** is added (§ Definitivas) |

**Slots** (decided 2026-11-14, corrected by Aitor 2026-11-15): each of them starts with **two
ánimas** (their own and one shared) and ends with **three, the most worn in a fight at once**. The
third slot comes with the castle's **first boss**; the second boss gives no slot, it opens the
definitivas (§ Growth opens with the castle). `EXTRA_SLOTS` is 1 today.

**Built 2026-11-15** (the own ánimas' half): Matemágico is out of `LEVELLED` (`src/levels.ts`,
only Papagato levels today) and its old level-2 and level-3 skills are nodes of its tree; so are
three of Tecnópata's five. The jar's Maná +2 and sleeping Pasiva are gone. Not built: the seven
levels, the slot growing from two to three, the definitiva's waking. No save is migrated: a save
that had those skills by level has them again once their nodes are bought. To settle: how many
ecos the whole game gives against what two trees and the definitivas cost (the fights were tuned
with those skills in hand), and whether the victory screen shows a card for an ánima that earns
nothing (today it does not).

### The jar: where it is all done (designed 2026-11-14, built 2026-11-15)

Decided by Aitor: the trees and the shared ánimas' maná and definitiva are all bought with ecos
de luz at home; **nobody can have everything**; taking out and putting in is free; the definitiva
is not there from the start, it **wakes after the castle's first boss**. The rest is a proposal.
Sketch: `output/mockups/bote/index.html`.

- **The place stays the jar in the living room** (`src/jar-ui.ts`): the lights are kept there, so
  that is where they are spent.
- **A window, not the whole screen** (built 2026-11-15): it rises out of the jar over the living
  room, which stays in sight round it, dimmed, and folds back down into it on closing.
- **One sky, a constellation per ánima** (decided by Aitor 2026-11-15, over a page per ánima
  with tabs). The jar below keeps every eco in sight: lit while free, dark and tinted by where
  it went once it is in an ánima. A light flies from the jar to the node it turns on, and back.
- **Folded, a constellation is its own tree made small and soft**: joins and all, what is lit
  brighter, its name under it. They are **scattered over the sky, never in a row or a grid**
  (decided by Aitor 2026-11-15: the sky must not say how many ánimas there will be; `SEATS`
  holds ten places, the game will have about eight). One sharpens a little under a cursor, and
  steps back, faint, while another is unfolded over it.
- **A player opens the one they choose**: it comes down from the row onto their side (player 1
  left, player 2 right: `STAGES`), growing to full size, each ring of nodes coming up after the
  one before (a little over a second). They work inside it (their cursor moves only there)
  until they step back out; it goes back to the row when nobody is in it. Each player can be
  in a different one, or both in the same. `inside`, `stages`, `enter`, `leave`, `settle`.
- **A node** is a disc with its drawing and its name (a passive a rounded square); lit, a flat
  pane of glass in its line's colour, never a ball. A node needs the one before it on its line;
  taking one out takes out what hangs from it (`without`).
- **Two cursors**, with no shape of their own: what a player points at takes their colour on its
  own border (Gerard gold, Aitor cyan, a dashed cyan outline round the gold when both are on the
  same thing) and breathes slowly (`jar-pick`); a folded constellation has no ring and does not beat: it comes into
  focus and its name is underlined in that colour. Nothing
  jumps from one thing to the next. Aitor's comes in on his own ánima
  the first time player 2 touches the pad. Each has a floating note threaded to what it is on
  (what it is, what it does, what it costs, what pressing would do or why it cannot be done);
  either can turn anything on or off. `cursors`, `place`, `tipSide`.
- **A shared ánima's constellation** has two nodes: **Maná +1** (2 ecos) and **the Definitiva**
  (3). What it has learned fighting (its levels reached, never the ones to come) is in its
  core's note. **Dadaísta** (decided 2026-11-15) also has there a short line
  for its fixed command, *Agitar* ([its folder](dadaista/README.md) § Agitar; proposal: three
  nodes, 4 ecos): the first shared ánima with a line of its own. Its skills still come by level.
- **Maná**: 3 from the start; a shared ánima gets +1 at level 4 and +1 at the jar; an own ánima
  +1 in its tree. Five is the top, and only for a shared one. Today's Maná +2 goes.
- **The definitiva sleeps** on every page (*Todavía duerme*, as today) until the castle's first
  boss is beaten. Back home that day the jar is different: a line from Gerard or Aitor, and the
  cards are awake. Its use in a fight: § Definitivas.
- **One jar for both**: the ecos are the party's, not each player's. What goes into Tecnópata
  does not go into Matemágico; with two players that is a conversation at home.
- **Not here**: who wears which shared ánima stays where it is (the status screen).

**What it all costs** against what there is. The game gives a light per person helped: with the
friends listed in `docs/story-outline.md`, some 12 to 16 by the end, 3 to 5 around the middle.

| Where | Everything in it |
| --- | --- |
| Matemágico's tree | 17, and 3 for the definitiva |
| Tecnópata's tree | 11, and 3 for the definitiva |
| Each shared ánima | 2 for maná, 3 for the definitiva |
| All of it, with three shared ánimas | 49 |

So at the end the party holds about a third of it, and re-does the split before a hard fight.
If that feels too tight in play, lower the passives from 2 to 1 before adding lights.

**Matemágico's tree: the elements** (decided 2026-11-14: not fire alone). Root: Foc Binari.

| Line | 1 eco | 1 eco | 2 ecos |
| --- | --- | --- | --- |
| **Fuego**, which piles up | Atacar · Fuego (built) | *Factor común*: `Daño medio mágico de tipo fuego a todos los enemigos. El fuego de todos sube al más alto.` | Passive · *Rescoldo*: his fires last 15 s, not 10 |
| **Agua**, which sets up | Atacar · Agua (built) | *Vasos comunicantes*: `Daño leve mágico de tipo agua a todos los enemigos. Los moja.` | Passive · *Capilaridad*: Atacar with water leaves the foe Mojado |
| **Eléctrico**, which cashes in | Atacar · Eléctrico (built) | *Descarga*: `Daño medio mágico de tipo eléctrico a un enemigo. Salta a todos los mojados.` | Passive · *Toma de tierra*: a reaction he sets off gives him 1 maná back, once a round |
| **Cálculo** | Ángulo exacto | Análisis Parálisis, then Cardioide (1 each) | Maná +1 |

- **Mojado** (20 s, § Shared mechanics): it hurts nobody; electricity on it reaches every wet
  foe (Conducción), fire on it makes Vapor (Cegado). Electricity lays no status of its own: it
  is the trigger.
- Three lines that need each other (a reaction takes two elements), and never the ecos for all
  three whole: deep in one or wide in two is the choice.

**Tecnópata's tree.** Root: Rayo de energía and Rayo de sanación.

| Line | 1 eco | 2 ecos |
| --- | --- | --- |
| **Bip** | Explosión | Passive · *Telemetría*: Bip's Atacar gives 3 s more to whatever runs on its target's clock |
| **Mente** | Confusión | *Control remoto*: a foe hits one of its own, now, and forgets its plan |
| **Taller** | Rayo encogedor | Passive · *Nanitos*: Sanación on an ally also takes one clock status off them |
| — | | Maná +1 |

**How it is built.** A node is an `Improvement` in `src/ecos.ts` with its `line` (`LINES`) and
what it gives: an `element`, a `skill` (a `SkillId` marked `node: true` in `SKILLS`: known only
if bought, `skillKnown`), a `passive` (`PASSIVES` in `src/battle.ts`) or `mana`. `TREE_ANIMAS`
are the ánimas with a tree (the owned ones); every other ánima's page offers Maná +1 and the
sleeping definitiva. `improvedBy` turns what is bought into the fight's `Improved` (`elements`,
`mana`, `skills`, `passives`). The screen is `src/jar-ui.ts` (`layout` places each constellation, `SHAPES` says which way each line grows); the
status screen's Ánimas page lists a tree ánima's bought passives under *Con ecos de luz* and no
level. The fight tester's *Ecos de luz* chips and `"improved"` in a `?fight=` link give any node.

**A passive that does something says so in the fight**: a plate *PASIVA · name* over whoever
has it, in their ánima's colour, with a sound (`BattleEffect.passives`, `pop` kind `passive` in
`src/battle-ui.ts`). The five built:

| Passive | Ánima | What it does (as built) |
| --- | --- | --- |
| **Rescoldo** | Matemágico | A fire he lights lasts 15 s, not 10 (`RESCOLDO`) |
| **Capilaridad** | Matemágico | Atacar with water leaves the foe Mojado, unless it put a fire out (changed from the sketch, which spread Mojado between foes: this one makes the water line work without spending maná) |
| **Toma de tierra** | Matemágico | A reaction he sets off gives him 1 maná back, once a round, if his pool is not full |
| **Telemetría** | Tecnópata | Bip's Atacar gives 3 s more to every clock status on its target (`TELEMETRIA`) |
| **Nanitos** | Tecnópata | Rayo de sanación also takes one harmful clock status off whoever it cures |

*Control remoto* as built: Bip takes a foe, which at once hits the strongest of its own standing
(itself if alone; power 34, with its own Fuerza) and forgets what it had announced. `abstract`.
The new skills' numbers are first guesses: no `just fight-sim` target holds them yet.

Screenshots: `just screenshots ecos --gpu` (the jar, both kinds of page) and
`just screenshots arbol-combate --gpu` (every new skill, reaction and passive in a fight).

## Levels

Ánimas **grow**: the more one is worn, the more it learns. Each level brings a new skill or makes
one stronger.

- **Experience (EXP) from fights won** gives levels (decided 2026-11-05, replacing fights won).
- **Story events** can also raise an ánima or teach it something (decided), e.g. the second round
  with its friend.
- How many: proposal, three to four levels per ánima for this game's length.
- Where it shows: the Ánimas page of the status screen (what it has, never what is missing to
  get the next one, per the HUD rule in `AGENTS.md`); a note when a skill is learned.
- Every ánima has its level table in its own folder.

Built today: three levels, for Papagato only (`LEVELLED` in `src/levels.ts`); Matemágico and
Tecnópata grow at the jar.

**Proposal: seven levels, for shared ánimas only** (2026-11-14, Aitor's direction; not built;
Matemágico and Tecnópata do not level, § Two ways to grow). A level gives one of three
things: skills, a **passive**, or **Maná +1**. Each level costs more than the one before.

| Level | EXP (from zero) | To reach it | Gives |
| --- | --- | --- | --- |
| 1 | 0 | — | One or two skills: what the ánima is |
| 2 | 180 | 180 | Skills |
| 3 | 660 | 480 | Skills, or the first passive |
| 4 | 1400 | 740 | Maná +1 |
| 5 | 2500 | 1100 | A skill or a passive |
| 6 | 4100 | 1600 | A passive or a skill |
| 7 | 6400 | 2300 | A strong skill (never the definitiva, which comes from the jar) |

- Levels 2 and 3 keep today's EXP and flags (`matemagico-2`…), so no save changes meaning.
- The totals wait on a count of the EXP the whole game hands out: level 7 should be reached in the
  ánimas worn most, not in all of them.
- **Against Ecos de luz**: the jar already sells Maná +1, Maná +2, and keeps a Pasiva and a
  Definitiva asleep. Decided 2026-11-14: for a shared ánima the jar adds only **the Definitiva**
  (never learned by level); its Maná and its sleeping Pasiva there go, levels give them. The
  own ánimas' trees keep the rest. § Definitivas, § Two ways to grow.
- Proposed tables: [Sincopante](sincopante/README.md) § Skills per level; Papagato below.

| Level | Papagato |
| --- | --- |
| 1 | Zarpazo sangriento, Yuki se esconde |
| 2 | Zarpazos, Ronroneo de Yuki |
| 3 | Zarpa en la llaga, Las dos a la vez |
| 4 | Maná +1 |
| 5 | Passive · *Olor a sangre*: Sangrado no longer loses a stack each round |
| 6 | New · *Acecho*: Haru crouches; a high physical blow as the next round starts |
| 7 | New · *Cacería*: one claw for each Sangrado stack on the field |

## Ecos de luz

Built 2026-11-05, decided with Aitor. What improves an ánima is not levels alone: every light won is
an **eco de luz**, to put into the ánimas at the **jar in the flat's living room** (`src/jar-ui.ts`,
`src/ecos.ts`).

- **Only at the jar, whenever.** *Abrir el bote* opens its screen. Every eco can be taken back and
  put somewhere else as often as they like, one at a time or *Recoger todos los ecos*; nothing is
  lost. Out of the flat nothing can change (a portal home is an idea for later, `docs/ideas.md`).
- **Optional, and never enough for everything**: nothing in the story needs them.
- **Saved in the browser**, like the loadout (`gerard35.ecos.v1`, `story.improvements`). What stands
  is worked out from what the party has now (`withinEcos`): a rewound day can take a light back, and
  what it paid for comes back with it.
- **The chip** beside the menus' buttons counts the free ones. The marbles in the jar, in the flat and
  on the screen, are lit while free and dark once in an ánima (on the screen, tinted by where it went).
- *Usar una luz* (a light let out for a day against the Queen) is gone (2026-11-05).

| Improvement | Ánima | Ecos | What it does |
| --- | --- | --- | --- |
| **A tree's node** | Matemágico, Tecnópata | 1 or 2 | An element for Atacar, a skill, a passive or Maná +1 (§ The jar) |
| **Maná +1** | Each | 2 | Its pool goes from 3 to 4 (`manaMax`, for whoever wears it) |
| **Definitiva** | Each | 3 | A place kept, asleep (`veiled`): shows, cannot be bought. § Definitivas |

Maná +2 and the sleeping Pasiva went on 2026-11-15 (§ Two ways to grow).

Prices from `just fight-sim` (2026-11-05): a Maná +1 is the strongest of them (Vertitrón for a player
who does not think it through, `casual`: wins 54 % without it, about 72 % with one); elements change
little for a bot, which rarely plays them on purpose, and are a tool to choose with (ring 3's young,
`smart`, with Fuego: 64 % → 70 % of PV left). So Maná costs two, and with today's two ecos there is
a real choice: one more maná, or two elements. Targets `vertigo-eco-mana`, `vertigo-eco-elementos`.

A new improvement is an entry in `IMPROVEMENTS` (`src/ecos.ts`); the screen and the fight tester
read it from there. What it does in a fight comes through `Improved` (`BattleState.improved`,
`improve`). Screenshots: `just screenshots ecos --gpu`, `just screenshots elementos --gpu`.

## Growth opens with the castle (idea, 2026-11-15)

Aitor's idea, written down to keep; **not built, numbers to settle**. How far an ánima can grow is
not open from the start: it **opens in three stages, with progress through La Reina Bubbaloo's
castle**. Both ways to grow follow it: the own ánimas' constellations at the jar show and sell more
nodes, and the shared ánimas' level cap rises.

| Stage | Opens when | Constellations (own ánimas) | Levels (shared ánimas) | Also |
| --- | --- | --- | --- | --- |
| 1 | From the start | A few skills only: the inner nodes | Up to level 3–4 | Two ánimas each |
| 2 | The castle's first great boss is beaten (Aurelià) | They expand: new nodes | Up to level 6 or so | **A slot for one more ánima: three each, the most in a fight at once.** New ways to travel, etc. |
| 3 | The second boss is beaten (el Equipo de dirección) | **The definitivas** (the supreme skills) | Up to the top (7) | — |

- **The definitivas** only exist from the second boss on. Even then each one **costs to unlock**
  (ecos at the jar) and has **its own special requirement to fire** in a fight (§ Definitivas).
The castle these stages belong to, and what each boss opens in full: [castle.md](../castle.md).

- **Why**: growth is paced by the story, the castle's bosses are felt as steps up, and it gives
  **control over balance**: a fight before a boss can be tuned knowing the most the party can have.
- **How it shows** (to settle, within the HUD rule: what the player has, never what is missing): at
  the jar a constellation simply has fewer stars until it expands; the expansion is seen happening
  the first time the jar is opened after the boss. A level cap reached says nothing about the next.
- It fits what is already decided: the definitiva bought at the jar with its condition
  (§ Definitivas), which this places after the second boss. It corrects the slots: one more after
  the first boss only, three at most, not four (§ Two ways to grow).
- **To settle**: which nodes are in each stage of each tree; the exact caps (3 or 4, then 6); what
  EXP earned over a cap does (kept and applied when it rises, or lost); what "new ways to travel"
  are; whether ecos already put in a node can outrun a stage (they cannot if the node is not shown).
- For the tools when built: `TARGETS` (`src/battle-sim.ts`) and the picker should take the stage,
  so a fight is balanced and tried at the growth it will be met with.

## Definitivas

Decided 2026-11-14 (Aitor): the definitiva is **bought at the jar** (3 ecos, `<ánima>:definitiva`),
and each ánima has **a condition that, met in a fight, unlocks it** there. The rest is a proposal.

- **The condition is the ánima played well**: its own mechanic taken to its end, something seen on
  the field (a level, stacks, clocks), never a hidden count.
- **Per fight**: met, the definitiva can be used once, for the turn and no maná; the next fight
  starts over. It is met while the ánima is worn, by whoever wears it.
- **How it reads**: until it is met, nothing (the HUD shows what can be pressed). Met, the command
  appears in the wearer's dock and a continuous status icon sits on their plate. The jar says the
  condition in one line when it is bought (_open_: or it is found by playing).

| Ánima | Condition | Definitiva |
| --- | --- | --- |
| Matemágico | Three different reactions between elements in one fight | *Q.E.D.*: very high magic on every foe, of every element he has: each lays its status |
| Papagato | A wound of five stacks or more is opened in one blow | *Siete vidas* (Yuki): the fallen get up and the whole party is cured |
| Tecnópata | Three different clock statuses running on the field at once | *Enjambre*: Bip comes apart over the foes: high magic on all, and every clock on the field starts over |
| Sincopante | The eco stays alive 60 s without fading | *Da capo*: every ánima's maná back to full and the party's clocks start over |

## Combined skills

**Dual attacks** (built 2026-11-05 for Matemágico + Papagato, `DUALS` in `src/battle.ts`): two
skills of two ánimas, each chosen by whoever wears it, become one action. The fight's side of it
(turns, the queue, the banner) is in `docs/combat.md` § Ataques duales.

- **Only particular pairs**, each one a skill from each ánima, so each one is found, not listed.
- **Gated by what the party has, never by a count of fights**: both halves learned (each skill's
  own `level`), each fighter wearing the ánima of their half, the partner standing and still to act
  this round (later in the order), each half's maná in its wearer's ánima, and a foe to aim at.
- **Once a fight each** (decided 2026-11-05, for now): a dual that has gone off cannot again until
  the next fight (`usedDuals`, `DualBlock` `'used'`); its two skills still work on their own.
- **A surprise** (decided 2026-11-05): nothing glows, no skill is marked as part of a pair, no
  dual is listed or hinted before its skill is picked. With two players, the one who acts later can
  choose ahead in their own dock while the other chooses; when the earlier one picks the skill that
  completes the other half, the dual's banner comes up while they aim it, and confirming fires the
  dual instead (`commit`). Only the earlier fighter completes one. The combined cost and the
  description show only then, in the dual's banner (and in the development Dual command).
- **Found, then remembered** (decided 2026-11-05): once a dual has gone off in a fight (not the
  fight tester's), it is found (`Story.discover`, kept in the browser like the EXP). On the status
  screen's Ánimas page, under the lists, *HABILIDADES DÚO DESCUBIERTAS* shows the ones found that
  the ánima under the cursor brings a half of: with whom, its two skills and what it does. Only
  those found: before the first the card is not there, and it never says how many there are.
- **What it costs**: both turns, and each wearer's half from their own ánima's maná (the skills' own
  costs). Both ánimas take part in the fight (EXP).
- **What it is**: its blow uses the stats of whoever brings the half of its kind (a physical dual,
  the Papagato wearer's Fuerza), and against a foe's kind-based rules it counts as **every kind**:
  the better side of a dish, whole through a see-through foe or a surprise dish. A rule may answer
  duals as such, never a particular ánima. Its
  description follows the AGENTS.md shape, as a skill's (`tests/battle.test.mjs`).
- **Worth** about 1.3–1.5 times the two skills used apart in the same round, plus one edge of its own
  (all eight claws peel, the triple blow), tuned with `just fight-sim`. Not twice: the maná makes
  them punctuate a fight, not replace it.
- **Who can wear what** stays as it is: an ánima is worn by whoever equipped it before the fight
  and never changes person in it (Aitor wears Papagato only if it was put on him).

| Pair | Dual | Halves | Levels | Status |
| --- | --- | --- | --- | --- |
| Matemágico + Papagato | **Zarpazos de fuego** | Foc Binari + Zarpazos | 1 · 2 | Built |
| Matemágico + Papagato | **Punto débil** | Ángulo exacto + Zarpazo sangriento | 2 · 1 | Built |
| Matemágico + Tecnópata | **Rayo solar** | Foc Binari + Rayo de energía | 1 · 1 | Built (2026-11-06): charges a turn, sweeps every foe with Quemado II as the next round starts |
| Tecnópata + Sincopante | *Bombardeo orbital* | Explosión + Redoble | 2 · 2 | Proposal (2026-11-14): the eco takes Bip up; three volleys on every foe as the next round starts, Cegado II for 20 s |
| Matemágico + Papagato | *Cortina de fuego*, a burning shield | Foc Binari + Yuki se esconde | 1 · 1 | Idea, parked for later |
| Noísta + Papagato | _name open_ | — | — | On hold with Noísta. A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |

The pair table lives here; each ánima's folder lists the duals it is part of and links back.

## Ánima points

Skills spend **maná** (once called Ánima points): every ánima has its own, for each wearer, full
with 3 at the start of every fight; Defender gives 2 back to the one worn, and one not worn all
round gets 1 back. See `docs/combat.md` § Maná and `docs/action-points.md`. A dual's halves are each
paid from their own wearer's ánima.

## Shared mechanics

Statuses and rules that more than one ánima can apply or exploit. Add here before using one in a
second ánima.

### Sangrado (bleeding)

- A **stacking** status on a foe (proposal: up to 10 stacks). At the end of each round it deals
  damage **for each stack**: little at first, a lot once it piles up. It loses one stack per round
  if nothing adds more.
- **An open wound** (decided 2026-11-05): the next **physical** blow on someone bleeding (Atacar or
  a physical skill, every claw of a flurry) lands **20% harder for each stack** and spends them all
  (`BLEED_BONUS`, `woundScale` in `src/battle.ts`). Magic leaves the wound alone. A skill that adds
  Sangrado spends the old stacks first, then adds its own. *Zarpa en la llaga* opens it twice as far
  (+40% a stack, `deep`). The fight says so in red over the numbers (*+60% · Sangrado*), the blow
  flares red and tears (`bleed`), and the next actor waits to let it be read.
- Open to other ánimas: anything sharp, cutting or nagging can add stacks; anything else can
  feed off them.
- Built in the story's fights: `STATUSES`, `addStatus` and the end-of-round tick in `nextRound`
  (`src/battle.ts`); 2 PV per stack, up to 10 stacks. The fight shows the stacks as chips under
  each nameplate and the tick as a hit at the round's end.
- Description in skills: one short sentence, e.g. `Añade sangrado.`

### Mental statuses

- Statuses come in kinds: one of the mind, not the body, is **mental** (`mental: true` in
  `STATUSES`, `MENTAL_STATUSES`). Today Mareo and Llorera; Sangrado is not.
- A skill that calms takes away **every** mental status, whichever they are (`cleanse: 'mental'`),
  never a list of names: a new mental status is cleansed by it without touching the skill. Its
  description says so in general (`Quita los efectos de estado mentales.`), and so does the fight
  (*«Se les pasan los efectos de estado mentales.»*).
- First used by Papagato's *Ronroneo de Yuki*.

### Mareo (dizziness, mental)

- A stacking status: per stack Velocidad −2, Defensa −1, Espíritu −1. First used by El Vértigo,
  the boss Vertitrón replaced; no foe brings it now (`docs/quests/nuria.md`). The turn order is fixed when a fight starts, so its Velocidad never
  reorders anyone; its Defensa and Espíritu do the harm.
- **To redesign**: Velocidad is removed as a stat (decided 2026-10-31, `docs/combat.md` § Sin
  Velocidad), so its Velocidad −2 goes with it.

### Llorera (crying, mental)

- A stacking status: per stack Fuerza −2 and Magia −2 (tears in the eyes). First used by El
  Cebollón (`docs/quests/nuria.md`).

### Punto débil (a mark on a foe)

- Not a stacking status but a mark (`Combatant.weakSpot`), left by the dual *Punto débil*: the next
  action that hurts that foe, from anyone and of any kind, lands three times as hard on every strike
  (`WEAK_SPOT`), then it is spent. Unused, it fades at the end of the next round. Sangrado ticks and
  Quemado pulses neither use it nor spend it. It shows with the foe's stats (a Defensa drop with no
  number, from *Punto débil*).
- Open to other ánimas: anything that sets up a single big blow can leave it.

### Quemado (burning, timed)

- A **timed** status (`docs/combat.md` § Estados en tiempo real): it runs on the fight's clock, not
  rounds. It burns every **2 s** for **10 s**, while the players choose too.
- **Escalates**: fire landing again while it burns raises it a level (I → II → III) and starts its
  10 s over. Each pulse hits ×1, ×3 and ×5 the base pulse, so keeping it going always beats letting
  it go out and lighting it again. At III, fire only starts its clock over.
- The base pulse is 1 PV plus 1 % of the carrier's PV counted up to 100 PV (`pulseDamage`): about
  2 / 5 / 8 a pulse on a dog, 2 / 6 / 10 on a boss, a much smaller share of the boss.
- First used by Matemágico's *Foc Binari*, which always lights it.
- Built: `TIMED.quemado`, `inflict` and `runClock` in `src/battle.ts`; the clock in
  `src/battle-ui.ts`; its look is `quemado` in `src/status-fx.ts` (the flame grows with the level).
  Over the fighter it is an icon with its level and a clock: a ring that empties clockwise behind
  a turning hand, with a notch for each pulse still to come, where the hand will be when it hurts
  (`drain`); the icon flashes as one does. Landing, it says so in orange over the numbers
  (*¡Quemado!*, `pop(…, 'status')`).

### Cegado (blinded, timed)

- A **timed** status that hurts nobody: 10 s on the fight's clock, its level the level of the fire it
  came from. The foe's blows land at 70 % / 50 % / 30 % (`REACTION_RULES`, `sighted`), whatever they are.
- Left by Humo (Atacar · Agua on Quemado). Atacar · Eléctrico spends it (Tormenta). Details in
  `docs/combat.md` § Reacciones entre elementos.

### Mojado (wet, timed)

Built 2026-11-15 (`TIMED.mojado`, `react` in `src/battle.ts`). 20 s on the clock, no levels, no
pulses: it hurts nobody and waits for an element. Laid by Vasos comunicantes (every foe) and by
Atacar with water once Capilaridad is bought.

| On Mojado | Reaction | What happens |
| --- | --- | --- |
| Fire (Atacar · Fuego, Foc Binari, Factor común) | **Vapor** | The water goes and leaves Cegado I; a wet foe does not catch fire |
| Electricity (Atacar · Eléctrico, Descarga) | **Conducción** | Mojado goes from every wet foe and each takes magic damage (20, `REACTION_RULES.conduct`) |

Water on a burning foe is still Humo (it puts the fire out, it does not wet). By kind of blow,
never by who wears what: any fire and any electricity do it.

### How long a clock status lasts (proposal, 2026-11-14)

A turn's animation is 1.16 s (`ACTION_SECONDS`) and a player thinks 3 to 8 s, so a round with two
allies and two or three foes is about **10 s** quick and up to 20 s slow. From when the first ally
acts to when the foes do: 6 to 18 s. Three lengths, by what the status is for:

| Length | For | Today |
| --- | --- | --- |
| **10 s** (a round) | Something that pulses and is meant to be fed every round | Quemado |
| **20 s** (two rounds) | Something that only counts when the foe acts, so it must reach the foes' turn: a blind, a cut to a stat, the eco | Cegado is 10 s and Encogido 15 s: both can run out before the foe they were for has acted. To raise to 20 s and check with `just fight-sim` (`think: 8`) |
| **30 s** | Control of one foe, paid dear | Confusión |

Sanación (15 s, a cure in five pulses) stays: it pulses, it does not wait for anyone's turn.

| Mechanic | Applied by | Exploited by |
| --- | --- | --- |
| Sangrado | Papagato (Haru) | Papagato (*Zarpa en la llaga*) |
| Mareo (mental) | None now (it was El Vértigo's) | Papagato (*Ronroneo de Yuki* cleanses it) |
| Llorera (mental) | The onions (foe) | Papagato (*Ronroneo de Yuki* cleanses it) |
| Quemado | Matemágico (*Foc Binari*; the dual *Zarpazos de fuego*, on a coin) | Atacar · Agua (Humo) |
| Sangrado (reaction) | Papagato (Haru) | Atacar · Fuego (Cauterizado) |
| Cegado | Atacar · Agua on Quemado | Atacar · Eléctrico (Tormenta) |
| Punto débil | The dual *Punto débil* | Any blow, the next one |

## How an ánima is built

Generic steps every ánima follows; each folder's *Implementation* section says which are done.

1. **Identity**: `ClassId` and `ANIMA_NAMES` (`src/battle.ts`); `CLASSES` (`src/classes.ts`):
   name, motto, colour, `look` (clothes recoloured by what each piece is: `jacket`, `navy`,
   `cream`, `trousers`, the material keys every character shares, `MATERIAL_ROLES` in
   `src/character-model.ts`) and what it adds on the rig in `src/anima-looks.ts` (Papagato's ears,
   tail and collar; Matemágico's ring of digits). It shows in fights; in the street everyone wears
   their own clothes. `scarf` is the colour over the portraits.
2. **Stats and skills**: `CLASS_STATS` and `SKILLS` with `class: '<id>'` (`src/battle.ts`);
   descriptions in the `AGENTS.md` shape, checked by `tests/battle.test.mjs`.
3. **Interface theme**: `#hud[data-class="<id>"]` in `src/style.css`.
4. **Unlock**: a story flag and the moment it happens (`src/story.ts`, the chapter file), with
   the *ÁNIMA DESBLOQUEADA* banner.
5. **Levels and duals**: the skill's `level` (`src/levels.ts`); a dual is an entry in `DUALS` naming
   one skill of each ánima, with its sounds (`dualSounds`, `src/battle-sounds.ts`) and its
   choreography (§ Combined skills).
6. **Shared mechanics** it needs (`STATUSES` in `src/battle.ts`; add new ones to § Shared
   mechanics first).
7. **Screenshots**: a scenario in `scripts/screenshots/` showing the look, the interface and the
   skills; `docs/party.md` updated.
