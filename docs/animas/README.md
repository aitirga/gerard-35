# Ánimas

What an ánima is, which ones exist, how they grow and the mechanics they share. Who wears what
and the stats are in `docs/party.md`; the story side (grey ánimas, the second round) in
`docs/lore.md` and `docs/chapter-2.md`. Each ánima is designed with the `/anima` skill.

## Order of work (decided by Aitor, 2026-11-20)

1. **Each ánima, one by one**, designed whole with `/anima`: identity, role, stats, its mechanic
   and passives, every level, its definitiva, its look. Papagato first.
2. **The duals**, once every ánima is designed: each ánima's folder says what it offers a pair
   (*What it offers a dual*), and the pairs are chosen from those.
3. **The balance**, last, with everything in: `just fight-sim` and each fight's `TARGETS`.

Until step 3 every number is a first guess, and a design is not held back by one.

**To read and check it all**: `just animas` opens one page (`output/reports/animas/index.html`)
with every ánima's design beside what the game has of it today, read from the code (stats, skills
by level or node, passives, duals, the jar), plus every dual, the shared mechanics and how ánimas
grow, and beside each page its notes, written there and kept in `docs/anima-notes.json`. Nothing to
keep in step by hand: reload it after changing a doc or the code (`just animas-report` only writes
it). docs/dev-tools.md § The ánimas' sheet.

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
| [**Papagato**](papagato/README.md) | Nuria's mission (Cardedeu), `docs/quests/nuria.md` | `#f0954a` orange | Fuerza +2, Crítico +15 %, Espíritu −1 (built 2026-11-20, a first guess) | Haru and Yuki: physical blows, Sangrado and golpes críticos | Playable to level 3, redesigned 2026-11-20. Built: the golpe crítico, cuts that pile up, liquid blood, Ronroneo on one ally; Yuki se esconde and Las dos a la vez are out. Designed, not built: levels 4 to 7 (with the passive *Olor a sangre* at level 5: Crítico +20 % on whoever bleeds, sure on a wound of five) and Siete vidas |
| [**Tecnópata**](tecnopata/README.md) | Aitor's own, from chapter 2's first morning (was the placeholder Físico) | `#4fe0ff` cyan | — | — | Designing (2026-11-05): look, drone-HUD interface and Bip, his robot, first |
| [**Sincopante**](sincopante/README.md) | Marta's mission (Alegia, Las cuerdas), `docs/quests/marta.md` | Proposal: nácar, seafoam `#8fe3c4` | Proposal: Magia +2, Espíritu +2, Defensa +1, Fuerza −1 | Ecos floating over the party that strike or cure on their own beat (Ostinato, Bordón), raised by *Crescendo*; the astral | Ostinato and Bombardeo orbital are playable. The full eco system and the later skills are pending. |
| [**Dadista**](dadaista/README.md) | The university friends' mission (Barceloneta, Càmping Eurosport), `docs/quests/universidad.md` | `#efe6cf` ivory (built, to confirm); the astral, bluish white `#bfe0ff` | Fuerza +2, Magia +2, Crítico +10 %, Defensa −1 (Aitor 2026-11-20, built) | Tirar dado: each die's face is a move (Mano, Tijeras, Ojo, Corchete, a blank that repeats, the Comodín). *Racha*: every die spent is Crítico +10 % | Playable to level 3: its dice as maná, the faces, the *Racha* with its count on the plate (the ánima's rule from level 1), *Agitar* at 2 (the hand rolled again for nothing, once a fight, twice with one eco; the Comodín with Racha 3) and *Estrella fugaz* at 3 (astral; 3 of Racha for two dice). Dice, luck and the astral (Aitor 2026-11-20). Designed, waiting for the seven levels: *Dados astrales* at level 4 with Maná +1 (Aitor's), *Ases en dúo* (Aitor's), *Meteorito → Meteoro → Asteroide* at level 7 (Aitor's) and the definitiva *Un golpe de dados*. Renamed from Dadaísta |
| [**Colorista**](prismatico/README.md) | Luca's mission (the Sagrada Família), `docs/quests/luca.md` | `#617ce2` dusty blue (built, to confirm) | Defensa +3, Espíritu +2, Fuerza −1 (built, a first guess) | Dry coloured powder, by the handful. Empolvado does nothing and waits for an element: fire blows it up (and every foe burns a level more), water poisons (blows on it land harder), electricity leaves shards (every blow does more than the one before). *Cortina* and *Telón* raise the party's Defensa and stand a screen of powder that halves the next blow; whoever breaks it is powdered | **Playable whole** (built 2026-11-21): designed 2026-11-20 round the puff and agreed by Aitor that day (the name too: it was Prismático; its id stays `prismatico`). Seven levels, the cortina and *Rebufo*, *Remolino* at level 5, and *Fin de fiesta*, the first definitiva in the game. Not built: its trial inside the salon, grey in the first round |
| [**Freática**](freatica/README.md) | Emilie's mission (Poble Sec, her model), `docs/quests/emilie.md` | Blue with green (Aitor): the water is green where thin (`#27c2a0`), blue where deep (`#1f5fd8`) | Proposal: Magia +3, Espíritu +2, Fuerza −1 | *La crecida*: water held in a cell under each foe that rises to three marks. With water a foe is wet; electricity stays in it as a current, fire turns it to steam and blinds, and at the third mark it sinks. Its definitiva, *Bajo cero*, freezes every foe that has water | Designed whole 2026-11-20 round Aitor's direction (La crecida; agua contenida, the mathematical part; electricity that electrifies the water; fire that blinds; sunk at three, losing a share of PV over time; each foe its own water; the definitiva *Bajo cero*), waiting for his yes. Its look is built: the cells and each skill in the effects lab (`src/freatica-fx.ts`), its colours and pieces on the wearer and its interface (the fight tester can put it on). No rule and no skill yet |
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
definitivas (§ Growth opens with the castle). Built: `extraSlots` in `src/castle.ts`, by the stage.

**Built 2026-11-15** (the own ánimas' half): Matemágico is out of `LEVELLED` (`src/levels.ts`,
only Papagato levels today) and its old level-2 and level-3 skills are nodes of its tree; so are
three of Tecnópata's five. The jar's Maná +2 and sleeping Pasiva are gone. Built since: the seven
levels, and the castle's stages (the third slot, the caps, grade III, the definitiva's waking: § Growth
opens with the castle). No save is migrated: a save
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
- **Every constellation open at once** (§ The jar as one sky, built 2026-11-21; until then each
  one was folded small and a player unfolded one onto their side). Gerard's tree on the left,
  Aitor's on the right, the shared ones small and **scattered round and between them, never in a
  row or a grid** (decided by Aitor 2026-11-15: the sky must not say how many ánimas there will
  be). Each has its place in `SKY` (`SPARE` for one that has none yet). The constellation under
  a cursor is pushed in on, slowly (`PUSH`), its glow filling in; away from the cursors the
  names of what is not lit step back a little.
- **A node** is a disc with its drawing and its name (a passive a rounded square); lit, a flat
  pane of glass in its line's colour, never a ball. A node needs the one before it on its line;
  taking one out takes out what hangs from it (`without`).
- **Two cursors**, with no shape of their own: what a player points at takes their colour on its
  own border (Gerard gold, Aitor cyan, a dashed cyan outline round the gold when both are on the
  same thing) and breathes slowly (`jar-pick`). Nothing jumps from one thing to the next. Each
  moves over the whole sky by the nearest light the way pressed; Q / E jump from core to core.
  Aitor's comes in on his own ánima the first time player 2 touches the pad. Each has a floating
  note threaded to what it is on (what it is, what it does, what it costs, what pressing would do
  or why it cannot be done), set where it covers least and never over a dúo mayor; either can turn
  anything on or off. `cursors`, `place`, `tipSide`.
- **A shared ánima's constellation** has two nodes: **Maná +1** (2 ecos) and **the Definitiva**
  (3). What it has learned fighting (its levels reached, never the ones to come) is in its
  core's note. **Dadista** also has there a node for *Agitar*, *Otra vez*
  ([its folder](dadaista/README.md) § Agitar; decided by Aitor 2026-11-20, built: 1 eco, a
  second use a fight): the first shared ánima with a node of its own. Its skills still come by
  level.
- **Maná**: 3 from the start; a shared ánima gets +1 at level 4 and +1 at the jar; an own ánima
  +1 in its tree. Five is the top, and only for a shared one. Today's Maná +2 goes.
- **The definitiva sleeps** on every page (*Todavía duerme*, a «?») until the castle's second boss,
  el Equipo de dirección, is beaten (§ Growth opens with the castle, built 2026-11-21); Gerard says
  it as they fall (*Y algo más. Algo que no sé usar todavía.*), and the next time the jar opens the
  ones whose move is built wake in the sky. Its use in a fight: § Definitivas.
- **One jar for both**: the ecos are the party's, not each player's. What goes into Tecnópata
  does not go into Matemágico; with two players that is a conversation at home.
- **Not here**: who wears which shared ánima stays where it is (the status screen).

**What it all costs** against what there is. The game gives a light per person helped: with the
friends listed in `docs/story-outline.md`, some 12 to 16 by the end, 3 to 5 around the middle.

| Where | Everything in it |
| --- | --- |
| Matemágico's tree | 17, and 2 for the definitiva |
| Tecnópata's tree | 11, and 2 for the definitiva |
| Each shared ánima | 2 for maná, 2 for the definitiva |
| All of it, with three shared ánimas | 49 |

So at the end the party holds about a third of it, and re-does the split before a hard fight.
If that feels too tight in play, lower the passives from 2 to 1 before adding lights.

**Matemágico's tree: the elements** (decided 2026-11-14: not fire alone). Root: Foc Binari.

| Line | 1 eco | 1 eco | 2 ecos |
| --- | --- | --- | --- |
| **Fuego**, which piles up | Atacar · Fuego (built) | *Factor común*: `Daño mágico de fuego medio a todos los enemigos. El fuego de todos sube al más alto.` | Passive · *Rescoldo*: his fires last 15 s, not 10 |
| **Agua**, which sets up | Atacar · Agua (built) | *Vasos comunicantes*: `Daño mágico de agua leve a todos los enemigos. Los moja.` | Passive · *Capilaridad*: Atacar with water leaves the foe Mojado |
| **Eléctrico**, which cashes in | Atacar · Eléctrico (built) | *Descarga*: `Daño mágico eléctrico medio a un enemigo. Salta a todos los mojados.` | Passive · *Toma de tierra*: a reaction he sets off gives him 1 maná back, once a round |
| **Cálculo** | Ángulo exacto | Análisis Parálisis, then Cardioide (1 each) | Maná +1 |

- **Mojado** (20 s, § Shared mechanics): it hurts nobody; electricity on it reaches every wet
  foe (Conducción), fire on it makes Vapor (Cegado). Electricity lays no status of its own: it
  is the trigger.
- Three lines that need each other (a reaction takes two elements), and never the ecos for all
  three whole: deep in one or wide in two is the choice.
- **Grade III** (Aitor 2026-11-20; in the sky once the castle's first boss has fallen, § Growth opens
  with the castle): Fuego adds the passive *Combustión*, fire's fourth level (2, § Combustión), and past it the
  node of the dúo mayor *Vulcano* (2, § Dúos mayores); Cálculo *Integral* (2; a cure for everyone);
  all built. Agua *Punto de congelación* and Eléctrico *Resonancia* are designed, waiting for the
  freezing rule. [matemagico/README.md](matemagico/README.md) § Grade III.

**Tecnópata's tree.** Root: Rayo de energía and Rayo de sanación.

| Line | 1 eco | 2 ecos |
| --- | --- | --- |
| **Bip** | Explosión | Passive · *Telemetría*: Bip's Atacar gives 3 s more to whatever runs on its target's clock |
| **Mente** | Confusión | *Control remoto*: a foe hits one of its own, now, and forgets its plan |
| **Taller** | Rayo encogedor | Passive · *Nanitos*: Sanación on an ally also takes one clock status off them |
| — | | Maná +1 |

**Grade III** (Aitor 2026-11-20, after the castle's first boss): Bip adds *Reinicio* (2 ecos; every
clock on every foe starts over), Mente *Virus atómico* (2; what lands on a foe spreads to the others),
Taller *Escudo de bits* (2; a dome over the party that stops each blow whole, which cures patch) and
*Redundancia* (2; cures fill the dome to three times its PV), all built.
[tecnopata/README.md](tecnopata/README.md) § Grade III.

**How it is built.** A node is an `Improvement` in `src/ecos.ts` with its `line` (`LINES`) and
what it gives: an `element`, a `skill` (a `SkillId` marked `node: true` in `SKILLS`: known only
if bought, `skillKnown`), a `passive` (`PASSIVES` in `src/battle.ts`) or `mana`. `TREE_ANIMAS`
are the ánimas with a tree (the owned ones); every other ánima's page offers Maná +1 and the
sleeping definitiva. `improvedBy` turns what is bought into the fight's `Improved` (`elements`,
`mana`, `skills`, `passives`). The screen is `src/jar-ui.ts` (`layout` places each constellation and each dúo mayor, `SKY` says where each sits and which way each line grows); the
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

Screenshots: `just screenshots ecos --gpu` (the one sky with all seven ánimas, Vulcano coming in) and
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

Built today (2026-11-20): levels go to seven (`MAX_LEVEL`, `LEVEL_XP` in `src/levels.ts`; the EXP of 4 to 7
a first guess), and each shared ánima grows as far as it has been designed (`topOf`): Papagato to 3,
Dadista to 7. Level 4 is Maná +1 (`MANA_LEVEL`, in `manaMax`). A level left empty on purpose is
named in `EMPTY_LEVELS`. The castle caps them (built 2026-11-21, § Growth opens with the castle):
4, 6 after Aurelià, 7 after Dirección (`levelCap` in `src/castle.ts`, `reachOf`). Matemágico and
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
- Proposed tables: Papagato, Dadista, Sincopante, Colorista and Freática below.

| Level | Papagato |
| --- | --- |
| 1 | Zarpazo sangriento |
| 2 | Zarpazos, Ronroneo (one ally: a cure at once and over time) |
| 3 | Zarpa en la llaga |
| 4 | Maná +1 |
| 5 | Passive · *Olor a sangre*: Crítico +20 % on whoever bleeds, and spending a wound of five or more is always a golpe crítico |
| 6 | New · *Acecho*: Haru crouches; a high physical blow as the next round starts, always a golpe crítico |
| 7 | New · *Cacería*: one claw for each Sangrado stack on the field, each a golpe crítico |

Yuki se esconde and Las dos a la vez are cut (Aitor 2026-11-20; still in the game until the
redesign is built). Its whole table, with costs and
descriptions: [papagato/README.md](papagato/README.md) § Skills per level.

| Level | Dadista (2026-11-20; all built but the empty level 6) |
| --- | --- |
| 1 | Tirar dado: the die spent does what its face shows. Its rule, *Racha*: every die spent is Crítico +10 % for the wearer while Dadista stays on, counted on their plate |
| 2 | *Agitar*: rolls the whole hand again, for nothing; once a fight. With Racha 3 or more, one die is the Comodín |
| 3 | *Estrella fugaz*: a light astral blow paid with any die; it spends 3 of Racha to deal two dice |
| 4 | Maná +1, and *Dados astrales* (Aitor's): a rain of dice of light on foes at random, a die for each 15 % of Crítico; it spends the Racha |
| 5 | *Ases en dúo* (Aitor's): two dice; the whole party's Crítico doubled for three rounds |
| 6 | Nothing yet |
| 7 | *Meteorito*, then *Meteoro*, then *Asteroide* (Aitor's): played turn after turn for 1, 2 and 3 dice, the last on every foe |

Its whole table: [dadaista/README.md](dadaista/README.md) § Skills per level.

| Level | Sincopante (Ostinato playable) |
| --- | --- |
| 1 | *Ostinato*: a light astral blow that stays as an eco, striking again every 5 s for 20 s; *Bordón*: the same with a cure |
| 2 | *Crescendo* (Aitor's): the ecos sound stronger, then reach everyone; their clocks start over |
| 3 | Passive · *A contratiempo*: an action pressed in the off-beat makes every eco sound once more |
| 4 | Maná +1 |
| 5 | New · *Acompañamiento*: an eco at an ally's side repeats each of their blows |
| 6 | Passive · *Pedal*: while the wearer holds on, the ecos' clocks stop |
| 7 | New · *Tutti*: a high astral blow on every foe; every eco sounds a last time, twice as strong, and goes out |

Its whole table: [sincopante/README.md](sincopante/README.md) § Skills per level.

| Level | Colorista (agreed 2026-11-20; **built** 2026-11-21) |
| --- | --- |
| 1 | Its rule, *Rebufo*: whoever breaks a cortina is powdered. *Puñado*: a light physical blow that powders; *Cortina*: Defensa up for the party and a screen that halves the next blow on one ally |
| 2 | *Rociada*: light water on every foe (the powdered ones are poisoned, as by any water) |
| 3 | *Polvareda*: a light physical blow on every foe that powders them all |
| 4 | Maná +1 |
| 5 | Passive · *Remolino*: when a foe's powder reacts, a cortina stands in front of the wearer |
| 6 | *Telón*: Defensa up for the party and a cortina in front of each ally |
| 7 | *Traca*: five light physical blows on foes at random, each powdering |

Its whole table: [prismatico/README.md](prismatico/README.md) § Skills per level. Its level 5 is
the first that teaches only a passive (`passivesAt` in `src/levels.ts`): the level-up shows it as
*PASIVA NUEVA* and the Ánimas page lists it under *PASIVA*.

| Level | Freática (proposal 2026-11-20; only its look built) |
| --- | --- |
| 1 | Its rule, *Crecida*: water held under each foe, up to three marks (§ Agua contenida). *Recarga*: a light water blow that raises its target's a mark |
| 2 | *Sondeo eléctrico*: a light electric blow; the current it leaves in the water lasts twice as long |
| 3 | *Bombeo*: a light cure for the whole party that takes a mark from the foe with the most water |
| 4 | Maná +1 |
| 5 | Passive · *Nivel de base*: while it is worn, a foe's water never drains below the first mark by itself |
| 6 | *Riada*: light water on every foe; each one's water rises a mark |
| 7 | *Golpe de ariete*: medium water on every foe, a blow for each mark of its own water, which is spent |

Its whole table: [freatica/README.md](freatica/README.md) § Skills per level.

### Passives

A passive is always on while its ánima is worn: no cost, no button. **Few and influential**: one
or two an ánima, each changing how it is played, never a small number added. **An ánima does not
need one from the start** (Aitor 2026-11-20): a passive is something it grows into.

| Where it comes from | Ánimas | Example |
| --- | --- | --- |
| **A level** (3, 5 or 6) | Shared ones | Papagato's *Olor a sangre* (level 5), Sincopante's *A contratiempo*, Colorista's *Remolino* (built), Freática's *Nivel de base* |
| **A node at the jar** (2 ecos) | Own ones | Matemágico's *Rescoldo*, Tecnópata's *Nanitos* |

A passive can reach the whole party (*Olor a sangre*: anyone's blow on a foe that bleeds), and then it
holds only while the ánima is being worn by someone standing: switching away turns it off. When
one does something the fight says so (§ The jar, *A passive that does something says so*).

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

## Growth opens with the castle (built 2026-11-21)

Aitor's idea (2026-11-15), built 2026-11-21. How far an ánima can grow is not open from the start:
it **opens in three stages, with progress through La Reina Bubbaloo's castle**. Both ways to grow
follow it: the own ánimas' constellations at the jar show and sell more nodes, and the shared
ánimas' level cap rises. The castle these stages belong to, and what each boss opens in full:
[castle.md](../castle.md).

| Stage | Opens when | Constellations (own ánimas) | Levels (shared ánimas) | Also |
| --- | --- | --- | --- | --- |
| 1 | From the start | Grades I and II: every node but grade III | Up to level 4 | Two ánimas each |
| 2 | The castle's first great boss is beaten (Aurelià) | **Grade III**: Combustión, Integral, Reinicio, Virus atómico, Escudo de bits, and what hangs from them (Redundancia, the dúo mayor Vulcano) | Up to level 6 | **A slot for one more ánima: three each, the most in a fight at once.** The dúos mayores stand in the sky as a «?» |
| 3 | The second boss is beaten (el Equipo de dirección) | **The definitivas** wake | Up to the top (7) | — |

- **One number**: `growthStage` in `src/castle.ts` (from the flags `aurelia` and `direccion`), and
  what each stage opens in `CASTLE_UNLOCKS` (`extraSlots`, `levelCap`, `definitivasOpen`).
  `Story.stage` is read by the jar, the levels and the slots.
- **The jar**: a node has the stage it opens at (`stage` in `src/ecos.ts`, `gradeIII`), and whatever
  hangs from it opens with it (`stageOf`: Redundancia and Vulcano follow their line). A node of a
  later stage is not in the sky (`inSky`) and does not stand among what is bought (`withinEcos` with
  the story's stage): ecos put in it come back, and come back to it once the stage is reached (a
  rewound day works the same). A definitiva is always in the sky as a place kept, asleep (`asleep`)
  until stage 3; then the ones whose move is built (Fin de fiesta today) can be bought.
- **The levels**: a shared ánima stops at the cap (`reachOf`, `award`'s `cap`) and **keeps the EXP
  it earns**; when a boss raises the cap, the EXP kept gives its levels at once (`Story.ripen`, after
  the boss's fight), each with its note, back home after the flash. On the victory screen and the
  status screen an ánima at the cap has its bar full and never says MÁXIMO: the cap is not its top.
- **How it shows** (the HUD rule: what the player has, never what is missing): a constellation simply
  has fewer stars until it expands, and nothing says more will come. The first time the jar opens
  after the boss (`gerard35.jar-stage.v1`, the stage it last showed), once the sky is up a light runs
  out along each new join and the star opens at its end, where it will always be, with a chime; a
  dúo mayor's threads run after it and its «?» opens between them (`data-arriving`). A definitiva
  that wakes opens the same way. A level cap reached says nothing about the next.
- **Why**: growth is paced by the story, the castle's bosses are felt as steps up, and it gives
  **control over balance**: a fight before a boss can be tuned knowing the most the party can have.
- **Cut** (Aitor 2026-11-21): the "new ways to travel" of stage 2 (the snow globe inside the
  castle) are not needed. The tools see everything: the fight tester's chips and `withinEcos`
  without a stage open every node, and `TARGETS` (`src/battle-sim.ts`) do not take the stage yet
  (the missions' builds hold nothing past grade II); the picker reaches each stage by its story
  points (Aurelià, Dirección).
- Tests: `tests/crecimiento.test.mjs`. Screenshots: `just screenshots crecimiento --gpu`.

## Definitivas

Decided 2026-11-14 (Aitor): the definitiva is **bought at the jar** (2 ecos since 2026-11-20, `<ánima>:definitiva`),
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
| Papagato | A wound of five Sangrado stacks or more is spent (always a golpe crítico, by its passive) | *Siete vidas*: Haru hurts every foe and leaves them bleeding; Yuki walks among the party, and the next blow that would kill someone cures them instead what it was going to take |
| Tecnópata | Three different clock statuses running on the field at once | *Enjambre*: Bip comes apart over the foes: high magic on all, and every clock on the field starts over |
| Sincopante | Three ecos sound at once: a chord (proposal 2026-11-20) | *Da capo* (Aitor's, 2026-11-20: the duals again): every dual already used in the fight can go off once more, and every ánima of both fighters is full of maná again to pay for them |
| Colorista | The powder has been all three things in the fight: an Estallido, an Envenenado and a Cristalizado | *Fin de fiesta*: every foe is powdered and its powder blows up, poisons and crystallises at once. **Built** (2026-11-21), the first: § The one that is built |
| Freática | A foe has its water at the third mark (Aitor 2026-11-20) | *Bajo cero* (Aitor 2026-11-20): every foe with water freezes, 20 s a mark of its own, melting live. Frozen they do not act and take little; breaking the ice with four to eight blows lands a very large one, larger the sooner. Designed; its look built |
| Dadista | The wearer's Crítico reaches 100 % (proposal 2026-11-20) | *Un golpe de dados*: a great die of light on every foe, high magic of no element and a sure golpe crítico; the hand is filled to six dice |

### The one that is built

*Fin de fiesta* (Colorista, 2026-11-21) is the first definitiva in the game, and how it is made is
how the next ones are:

- **A skill with `ulti: true` and `node: true`** in `SKILLS` (`src/battle.ts`), cost 0. The jar
  unveils an ánima's definitiva as soon as such a skill exists for it (`ulti` in `src/ecos.ts`);
  the others stay veiled.
- **Its condition** is a function of the fight's state (`finaleReady`, over `state.finale`): what
  the fight has seen while the ánima was worn by someone standing, and whether it was used.
  `skillsFor` only lists the skill while it is true, at the head of the list, with *Definitiva*
  where the cost goes.
- **How it reads**: the moment it is met, *Definitiva · despierta* pops over the wearer
  (`effect.awoken`) and an icon stays on their plate until it is used.
- The fight tester's *Sin límites* (`unbound`) has it awake from the start.

The castle's gate on buying it is built (§ Growth opens with the castle): it sleeps until Dirección
has fallen. Not built: the line at the jar that says the condition.

## Combined skills

**Dual attacks** (built 2026-11-05 for Matemágico + Papagato, `DUALS` in `src/battle.ts`): two
skills of two ánimas, each chosen by whoever wears it, become one action. The fight's side of it
(turns, the queue, the banner) is in `docs/combat.md` § Ataques duales.

- **Only particular pairs**, each one a skill from each ánima, so each one is found, not listed.
- **Gated by what the party has, never by a count of fights**: both halves learned (each skill's
  own `level`), each fighter wearing the ánima of their half, the partner standing and still to act
  this round (later in the order), each half's maná in its wearer's ánima, and a valid target (a wounded ally for Sutura de luz).
- **Once a fight each** (decided 2026-11-05, for now): a dual that has gone off cannot again until
  the next fight (`usedDuals`, `DualBlock` `'used'`); its two skills still work on their own.
- **A surprise** (decided 2026-11-05): nothing glows, no skill is marked as part of a pair, no
  dual is listed or hinted before its skill is picked. The combined cost and the description show
  only in the dual's banner (and in the development Dual command).
- **The first one by chance** (decided 2026-11-20, so they are not found by trying pairs blindly):
  a dual not found yet is never armed while aimed. It goes off only when one player confirms their
  skill while the other has the skill that completes it picked; then time stops under *DÚO
  DESBLOQUEADO*, its name and what it does, and it goes off. Once found, picking the skill that
  completes the other player's aimed one puts both on aiming the dual, its banner already up.
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
| Matemágico + Tecnópata | **Sutura de luz** | Cardioide + Rayo de sanación | node · 1 | Playable. Heals a wounded ally and halves the next damage this round |
| Papagato + Dadista | **Relevo de sangre** | Zarpa en la llaga + Estrella fugaz | 3 · 3 | Playable. On a killing blow the wound passes to the enemy with the most remaining PV |
| Tecnópata + Sincopante | **Bombardeo orbital** | Explosión + Ostinato | node · 1 | Playable. Three volleys on every foe next round, with Cegado II for 20 s |
| Matemágico + Colorista | **Reserva de color** | Foc Binari + Brochazo | 1 · 1 | Playable. A fuse of powder on a foe explodes after its turn or when it falls (its text still says paint) |
| Matemágico + Tecnópata | **Sobrecalentamiento** | Foc Binari + Escudo de bits | 1 · node | Built (2026-11-20). The bit dome overheats and goes off over every foe; what is left closes over the party |
| Matemágico + Sincopante | **Vulcano** (dúo mayor) | Foc Binari + Ostinato | 1 · 1, and its node | Built (2026-11-20). A volcano of particles for 20 s that raises every foe's fire each 5 s |
| Noísta + Papagato | _name open_ | — | — | On hold with Noísta. A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |

The pair table lives here; each ánima's folder lists the duals it is part of and links back.

### Dúos mayores (Aitor 2026-11-20; Vulcano built)

Aitor's idea (2026-11-20): **some very strong duals are unlocked, not there from the start**, and
they **live between the branches** of two ánimas: available only when **both ends have reached
them**. The first is **Vulcano**: Foc Binari with Marta's Ostinato, *a volcano of particles that
keeps setting fire to every foe for a while*.

**What they are.** A step between the duals and the definitivas: skill → dual → **dúo mayor** →
definitiva. Few (one a pair at most, three or four in the game), each the top of a mechanic both
halves share. Worth about **twice** the two skills used apart, not a dual's 1.3 to 1.5.

**How they open (built):** both halves known (as any dual), **and its node bought at the jar** (2
ecos), in the constellation of the own ánima that brings a half (`kind: 'dual'` in `src/ecos.ts`,
drawn as two discs joined; `Improved.duals`; `major` in `DUALS`; `dualBlock` says *level* without
it). Its card: *Dúo mayor de Foc Binari y Ostinato.* and what it does (it only says so once both
ends are lit, threaded to both, so it can say with whom). In the jar its node is no longer on the
fire line but a gold star between Matemágico and Sincopante (§ The jar as one sky). **The castle
gates it** (built 2026-11-21, § Growth opens with the castle): nothing of it before Aurelià; from
him on it stands in the sky as a **«?»** (Aitor 2026-11-21: *los dúos buenos hagamos que se vean
después de Aurelià también, pero con un ?*), and it is revealed, and can be bought, when both
sides reach it: its own half's line lit as far as it, the other half learned. In a fight it is a
dual like the others (both turns, each half's maná, once a fight, found the first time by chance),
under **DÚO MAYOR DESBLOQUEADO** and then **DÚO MAYOR**, its kicker gold and burning.

**Vulcano** (built): `Daño mágico de fuego medio a todos los enemigos. Los quema. Durante 20
segundos, un volcán les sube el fuego un nivel cada 5 segundos.` Gerard's binary fire goes into the
ground behind the foes; Marta's eco beats on it three times, the floor cracking wider each time; the
volcano rises and erupts, a bomb of lava on each foe. While it stands (the timed status *Volcán*,
20 s, a beat every 5 s, `runClock`): a cone of embers redrawn all the time, smoke from its mouth,
lava glowing at its foot; each beat an eruption and a bomb on each foe under it, whose fire goes up
a level (to IV with Combustión). Fight tester: *Probar un dúo · Vulcano*; `just screenshots
duos-grado-iii --gpu`.

**Others it makes room for** (one line each): *Marea*, Vasos comunicantes + Freática's *Recarga*
(every foe's water to its third mark at once); one of Tecnópata's with a shared ánima's first skill.

### The jar as one sky (built 2026-11-21, kept by Aitor)

Aitor (2026-11-20): *maybe we have to show all the constellations together again, so these duals
have room between them and fit well.* Until then a player unfolded one constellation at a time onto
their side, and a dual between two ánimas had nowhere to be drawn. Aitor said yes (2026-11-21) and
decided that **the normal duals are not in the sky** (*igual al final los colocamos, pero no*):
only the dúos mayores are. Seeing it built with all seven ánimas he kept it (2026-11-21: *me gusta
este diseño, mantén esta idea de todo incluido en el mismo cielo*): **the jar is one sky with
everything in it**, and whatever grows next (a stage of the castle, a new ánima, another dúo mayor)
comes into that same sky, never as a page or a constellation opened on its own. Built in
`src/jar-ui.ts`:

- **Everything open at once** on the 1600 × 900 sheet: Gerard's tree on the left, Aitor's on the
  right (`SKY`: where each core sits and which way each line grows; `RINGS` a little tighter than
  the old unfolded tree), and each shared ánima a small constellation scattered round and between
  them, never a grid: its jar nodes one way (`nodes`), **the skills it has learned fighting** the
  other (`skills`) as small stars of its colour, chained faintly from the core (by level, never
  bought, a die's faces not counted; not pointable, their names come out when the constellation is
  pushed in on). They sit on a gentle arc a fixed step apart, every name on the same side
  (`SPARK`), so Dadista's eight at level 7 still read a line apart.
- **A dúo mayor is a gold star between two constellations** (`Bridge`), larger and ringed, with
  *DÚO MAYOR* over its name, on an arc that bows up from the star that ends its own half's line
  (Vulcano: Combustión, its `after`) to the other half's learned star (Ostinato), a gold thread to
  each. **From Aurelià it is in the sky as a «?»** (Aitor 2026-11-21; until then the castle keeps it
  out with the rest of grade III): dim gold, *DÚO MAYOR* over it and no name; its note says only
  *Todavía no se ve qué es.*, nothing of its halves or its cost. Each thread is faint until its own
  end is lit (`data-lit`: that star bought, the other half learned; while that half is not learned
  the thread hangs from its constellation's core). **It is revealed once both ends are lit** (that
  star bought, the other half learned): a light runs along each thread towards the middle and the
  «?» opens as its name a second later (`data-born`), the other half's star grows and shows its name.
  Bought, its threads burn gold. Taking out what it hangs from takes it out too: its light flies back
  to the jar and the star goes back to a «?», its threads faint. (Until 2026-11-21 it was not in the
  sky at all until both ends were lit.)
- **Cursors** move over the whole sky by the nearest light the way pressed; Q / E jump from core to
  core; a core is only read (pressing it does nothing). The constellation under a cursor, both
  ends of a dúo mayor under one, is pushed in on slowly (`PUSH`: 1.05 an own tree, 1.14 a shared
  one), its glow filling in. Esc closes.
- **The castle's stages add stars to this same sky** (§ Growth opens with the castle): a node of a
  stage still to come is simply not there; the first time the jar opens after the boss, a light runs
  out along each new join and the star opens at its end (`arriving`, `data-arriving`).
- `just screenshots ecos --gpu`: the sky with all seven ánimas after Aurelià (picker levels), Vulcano
  revealed as Combustión is lit, Gerard and Aitor at work at once, a shared ánima pushed in on.
  `just screenshots crecimiento --gpu`: the sky before Aurelià, the stars he brings coming in,
  Vulcano's «?», and the definitiva that wakes after Dirección.
- A future ánima without a place in `SKY` takes one of `SPARE` until it is given its own.

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
- **Cuts pile up** (decided by Aitor 2026-11-20, built; it replaces *A skill that adds Sangrado
  spends the old stacks first*, above): a physical blow that adds Sangrado no longer spends the old
  stacks, it piles its own on top. A physical blow that adds none spends them all, as before. So a
  wound is built on purpose, up to its ten stacks, and spent by choice.
- **It goes little by little, and lasts** (Aitor 2026-11-20, to tune playing; built). First
  guess: a wound loses one stack at the end of a round in which nobody added to it, none while it
  is being cut (`cutRound`, `nextRound`).
- **While a Papagato of level 5 is in the fight** (its passive *Olor a sangre*, Aitor 2026-11-20): every blow
  on whoever bleeds has Crítico +20 %, and the blow that spends a wound of five stacks or more is
  always a golpe crítico (§ Golpe crítico).

### Golpe crítico (2026-11-20, built)

Aitor's direction: a blow that lands much harder than the others, **shown with a larger number and
with the fight frozen for an instant**. Defined here for every ánima; Papagato is the first built
round it. Numbers are first guesses.

**The rule**

- A **golpe crítico** is a blow that lands **50 % harder** (`CRIT_RULES.bonus`).
- **It adds to the other bonuses, it does not multiply them**: a wound of three stacks (+60 %)
  spent by a crítico (+50 %) lands at +110 %. Punto débil's triple and a weakness to an element
  multiply afterwards, as today. To settle in the balance.
- **Each strike on its own**: every claw of a flurry can be one.
- **Only blows**: never a status's tick or pulse (Sangrado, Quemado, an eco's beat: Sincopante), a reaction's damage, or a cure.
- **Two ways to be one:**
  - **Guaranteed by a rule**, never luck: spending a wound of five Sangrado stacks or more while
    a Papagato with *Olor a sangre* (level 5) is worn, a skill that says `Golpe crítico seguro.`
    (Acecho). This is the one that carries decisions.
  - **By chance: Crítico is an attribute** (decided by Aitor 2026-11-20), in the place Velocidad
    leaves on the sheet. Proposal for its numbers: 5 % for everyone, more from an ánima (Papagato
    +15 %) or equipment; rolled a strike on its own seeded stream of luck (`state.luck`, apart from the fight's
    `roll`, so a crítico never shifts what else the dice decide), and `just fight-sim` plays it. A status can raise it against whoever carries it (Papagato's *Olor a sangre*:
    +20 % on a foe that bleeds).
- **Foes** have no Crítico: a foe's blow is a crítico only if one of its named moves says so, and
  then its plate announces it like any other (`docs/combat.md` § El nombre de lo que hace el
  enemigo). No party member falls to luck nobody could read.
- **In descriptions**: `Golpe crítico seguro.` as an extra sentence; a boost reads `Sube Crítico de
  todo el equipo durante 3 rondas.` like any other attribute.

**How it shows** (the effect, the same for every ánima, tinted by whoever lands it)

| Beat | What happens |
| --- | --- |
| **The freeze** | On contact the fight **stops for 0.22 s**: fighters, particles and the fight's clock (no status runs out or pulses meanwhile, as under a dual's banner). The hit-stop every heavy blow already has, held four times as long. |
| **The picture** | During the freeze the camera pushes in about 8 % on the target, the scene dims and loses colour except for the blow and the two fighters, and the target flashes white for two frames. On release, a lurch and shake harder than a heavy blow's. |
| **The number** | Almost twice the size of a normal one (×1.8), in the ánima's colour with a dark edge, tilted a little; it slams in from larger, overshoots and settles, and stays a third of a second longer. Over it, the named pop ***¡CRÍTICO!***, with the wound's bonus when it spent one: *¡CRÍTICO! · Sangrado +120 %*. |
| **The sound** | Everything ducks to near silence for the freeze, music included, then one dry, sharp hit as time comes back. |
| **The foe** | Its reaction to a blow, larger: thrown back half as far again. Its bar drops in one piece, a white ghost of what it lost fading after. |
| **After** | The next to act waits for it to be read, as with a spent wound today. |

- **A flurry** (Zarpazos, a dual's eight claws): only the first crítico of an action gets the whole
  freeze; later ones in the same action get 0.08 s and the number, so the action never stalls.
- **Not on every blow**: the freeze is what makes it worth setting up. If a party ends up landing
  one every turn, the answer is fewer críticos, not a shorter freeze.
- *Movimiento reducido* keeps the freeze and the number and drops the camera push, the flash and
  the shake.
- **Built** (2026-11-20): the freeze and the flurry's short one (`CRIT`, `landing` in
  `src/hit-feel.ts`; `critBeat` in `src/battle-scene.ts`), the push-in, the colour drained all but
  round the two fighters (the dual's spotlight in `src/post.ts`) under a white flash (`uFlash`), a
  cut of white light across whoever is struck (`dualFx.critical`), the number (`crit` pops,
  `pop-crit` in `src/style.css`: white, not yet the ánima's colour) and the dry hit (`crit` in
  `src/sfx.ts`). To see it at will: the fight tester's *Crítico seguro*.
- **Not built yet**: the music ducking under the freeze, the foe thrown back further and the white
  ghost on its bar, and a *Movimiento reducido* of its own (today reduced motion skips the whole
  beat and keeps the number).

### The astral (magic of no element)

Aitor 2026-11-20, for Dadista and then for Sincopante. **The astral is magic damage of no element.**
It is not a new kind of damage: it is what *Rayo de energía* already does, now with a name and a
look.

- **The rule**: magic, Magia against Espíritu. With no element it sets off no reaction and meets no
  weakness or resistance to an element. A foe's rule about magic applies to it in full (Lo
  Cristalino sends it back).
- **In descriptions**: `Daño mágico no elemental <intensidad> a <objetivo>.` (`AGENTS.md`). The word
  *astral* is never shown to the player.
- **How it shows**: each ánima draws it its own way, and the two must never be mistaken for each
  other.
  - **Dadista**: bluish white `#bfe0ff`, four-point stars that twinkle and fall
    ([dadaista/README.md](dadaista/README.md) § The astral look).
  - **Sincopante** (its look built in the effects lab): nácar `#8fe3c4`, a ring and its echo that
    close on the foe like a halo, the figure of sand on a struck plate where the blow lands, and
    soft round motes that rise ([sincopante/README.md](sincopante/README.md) § Look and interface).
  - What they share: a cold light, and no elemental pop over the number.

### Mental statuses

- Statuses come in kinds: one of the mind, not the body, is **mental** (`mental: true` in
  `STATUSES`, `MENTAL_STATUSES`). Today Mareo and Llorera; Sangrado is not.
- A skill that calms takes away **every** mental status, whichever they are (`cleanse: 'mental'`),
  never a list of names: a new mental status is cleansed by it without touching the skill. Its
  description says so in general (`Quita los efectos de estado mentales.`), and so does the fight
  (*«Se les pasan los efectos de estado mentales.»*).
- First used by Papagato's *Ronroneo*.

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

- Not a stacking status but a mark (`Combatant.weakSpot`), left by the dual *Punto débil* and by
  Dadista's *Ojo*: the next
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

### Combustión (fire's fourth level, set off by a blow)

Aitor's, 2026-11-20: at the end of Matemágico's fire line, **a Fuego IV with its own icon** whose
change is that **physical blows spread the fire in explosions**
([matemagico/README.md](matemagico/README.md) § Grade III). Built (`COMBUSTION`, `fireTop`,
`combust` in `src/battle.ts`; `tests/grado-iii.test.mjs`). Numbers are first guesses.

- **While Matemágico is worn by someone standing with *Combustión* bought**, fire climbs one level
  past Quemado III: fire landing on III (Foc Binari, a claw of Zarpazos de fuego, an Estallido)
  raises it to **IV, Combustión**. Without the passive in the fight it stops at III, as before.
- **It pulses ×7** the base pulse (Quemado is ×1, ×3, ×5): 14 every 2 s on a boss.
- **Any physical blow on a foe in Combustión makes it burst**: fire magic (24, with the Matemágico
  wearer's Magia) on **every foe, that one included**, and every other foe's fire **goes up a level**
  (lit at I where there was none, to IV at most; on a wet one it is Vapor). The one that burst goes
  back to **III**, its clock full: it is fed again and set off again.
- **By kind of blow, never by who**: Atacar (Gerard's ball is physical), a claw, a die, Bip's ram,
  a dual's physical blow, a physical blow on every foe, and a foe's physical blow on one of its own
  (Confusión, Control remoto). Never a pulse, a reaction or a magic blow, so a burst never sets
  off another. A reaction of the blow itself goes first: Atacar · Agua on it is Humo, and nothing
  bursts.
- A burst is fire: it melts the pringue and meets fire's weakness and resistance. Toma de tierra
  counts it when the blow is the wearer's.

**How it shows** (built): at IV the fire burns white-hot (`effects.fire` level `white`), sparks gone
blue-white spin round them and a heartbeat of heat throws a ring of embers every second
(`STATUS_LOOKS.combustion`). Its icon on the plate is the flame inside a burst, white-gold, breathing.
Landing, *¡Combustión!* (*Un golpe físico la hace estallar*). The burst: the white fire draws into
the chest (0.1 s), a white flash and a ball of fire with a ring of flame along the floor, embers arc
to every other foe and their fires flare; *¡Combustión!* and its 24 on each, *PASIVA · Combustión*
over Matemágico's wearer.

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

### Agua contenida (the water held under each foe)

Proposal 2026-11-20, round Aitor's direction for Freática ([freatica/README.md](freatica/README.md):
*La crecida*; water held between something on the foes' side, as if its wearer controlled it; three
of water sinks them; and, later that day, **each foe carries its own water**). Its look is built
in the effects lab (`src/freatica-fx.ts`); no rule. Numbers are first guesses.

**The rule**

- **A cell a foe**: each foe can have water of its own under it, with a **level of 0 to 3
  marks**. Raising one foe's does nothing to another's. The party never has any.
- **It rises** with a blow that says so (Freática's *Recarga* on its target, *Riada* on every
  foe), a mark at a time. At the third mark such a blow only starts that water's clock over.
- **It drains on the fight's clock**: a water's top mark goes in **20 s**, then the next one
  starts its own 20 s. **Any water blow on that foe, from anyone, starts its top mark's clock
  over** (Atacar with water, a skill, a dual). Nobody but a blow that says so raises it.
- **A foe with water is Mojado**, with no clock of its own: it lasts as long as its water.
  Everything that asks whether a foe is wet finds it wet: Vapor, Conducción, Shock, and whether
  powder thrown into it is poisoned (§ Empolvado: to settle, since powder now only reacts to a
  blow of an element).
- **A water's level is the level of what happens in it**: the current (§ Corriente) and the
  steam (below) are of level I, II or III with it, read at the moment they act.
- **Vapor**: any fire on a foe with water does not light it (as on any wet foe). Its water
  **loses its top mark** and **that foe is Cegado at the level its water had** (its blows at
  70 / 50 / 30 %), for Cegado's time. Electricity on it afterwards is Tormenta, as always.
- **At the third mark** the foe is Hundido (§ Hundido). Freática's definitiva turns the water to
  ice (§ Congelado).
- **Who holds it**: the water stands while whoever raised it stands, whatever ánima they wear
  then (worn or not, it drains the same; unworn, nobody can raise it). **If they fall, every cell
  breaks**: the water runs over the whole floor and is gone, and everyone standing on **both
  sides** is Mojado for 20 s, the ordinary status.
- **By kind of blow, never by who wears what**: any water holds it, any electricity charges it,
  any fire steams it, a foe's move too. A boss has its own like anyone; a part of a boss can have
  water and is never sunk.

**How it shows.** A straight prism of clear water with a little of its ánima's colour, on the
GPU. It is drawn as what it is, a control volume: exact edges, a gauge, a level.

| Beat | What happens |
| --- | --- |
| **The cell appears** (0.5 s, with a foe's first mark) | Four thin lines of white light draw a rectangle on the floor round the foe, a hand out from it, then rise as the prism's vertical edges. Up the corner nearest the camera, a **staff gauge**: three long ticks numbered I, II, III with short ticks between |
| **A mark rises** (0.6 s) | The water wells up from the floor, never poured from above: a slow dome in the middle that flattens out to the walls. Mark I is at the foe's ankles (0.25 m), II at the waist (0.9 m), III a hand over its head (2 m at least). The gauge's tick lights as the surface reaches it, with *Agua I* / *II* / *III* over the cell |
| **While it stands** | A flat surface with slow ripples and a ring round each foe that moves (the flat's `wake`); a faint square mesh on it that bends with the ripples; caustics on the floor; the foes seen through it, a little bent. The walls are only their edges: the water ends in a clean plane, as if cut |
| **It drains** | **The surface is the clock**: it sinks without stopping from its mark towards the one below over the 20 s, and the gauge keeps a small notch where it was. In the last 3 s the edge of the surface blinks. A water blow that starts the clock over brings it back up to its mark in 0.3 s |
| **Vapor** (0.6 s) | The slab between the surface and the mark below flashes white and goes up as steam in 0.3 s; the surface is at the lower mark at once. A white cloud stays over the cell at the height of the foes' heads for as long as they are Cegado, thicker with its level. *Vapor* in fire's colour over the cell, the Cegado icon on each plate |
| **The cells break** (0.8 s) | The edges go out from the top down; the water falls outwards in a sheet that runs across the whole floor, past the party's feet, and thins to nothing. *Mojado* over everyone standing |
| **On the plates** | On each foe with water, one continuous status icon, *Agua*: a small gauge with three ticks, filled to its level, with the ring of its top mark's clock |

- *Movimiento reducido*: no dome and no falling sheet; the surface is simply at its level, and the
  steam is the cloud without the flash.
- A translucent volume and its surface a foe, four at most: to measure against the 120 Hz budget
  (`just perf`).

### Corriente (current in the water, timed)

Proposal 2026-11-20, with Agua contenida (Aitor: electric attacks electrify the water and it hurts
the foes over time). Its look is built in the effects lab; no rule.

- **Any electric blow on a foe with water** is Conducción as always: magic through every wet foe
  (`REACTION_RULES.conduct`), and every foe with water is wet; Shock on a coin for the one
  struck. But **the water does not go**: each water it ran through keeps the current.
- **A timed state of a foe's water**: **10 s**, pulsing every **2 s** on its foe. The pulse is
  Quemado's base (1 PV plus 1 % of the carrier's PV counted up to 100) at **×1, ×2, ×3** with
  that water's mark at that moment: on a foe of 260 PV, 2 / 4 / 6 a pulse.
- **Electricity while it runs only starts its 10 s over**: no second Conducción and no Shock until
  the current has gone out. So a water gives one coin for a lost turn each time it is charged.
- It ends with its 10 s or with the last of that water. A blow can say its current lasts longer
  (Freática's *Sondeo eléctrico*: twice).
- Like Quemado's, its pulses pass over the foes' own rules and are never a golpe crítico.

**How it shows**: on the bolt's contact, a yellow flash through the whole volume (0.15 s) and
*Corriente* in electricity's colour over the cell. While it runs, thin arcs travel along the
prism's edges and skate over the surface, more of them with the level, and a low hum that steps
up with it. Each pulse: the water flickers yellow once, its foe jerks, and its number
comes out in electricity's colour. On that foe's *Agua* icon, a bolt with the 10 s ring and a
notch for each pulse to come.

### Hundido (sunk)

Proposal 2026-11-20, with Agua contenida (Aitor: at three of water it sinks them and they start
losing a share of their PV over time, of the PV they have in all). Nothing built.

- **Not laid by a blow: it is where the water is.** While a foe's water stands at the third
  mark, that foe is Hundido; the moment it drops below, it is not.
- **Every 2 s it loses 2 % of its PV**, of all it has, 1 at least. A pure share on purpose: the
  one pulse that does not count PV only up to a top (`pulseDamage`), so it weighs the same on a
  boss as on anything else. To watch in the balance.
- It does nothing else: a sunk foe acts as before. Its pulses pass over the foes' own rules, are
  never a golpe crítico, and a part of a boss is not sunk.

**How it shows**: as the surface closes over the tallest head, the scene's sound loses its high
end for the foes (0.4 s), *¡Hundidos!* over the cell, larger than a status pop, and a short burst
of bubbles from each. While it lasts they move a little slower and heavier in their idle (the
look only; their turns are their own), their colours cooler behind the water. Each pulse: a
string of bubbles from the foe to the surface, where they break in a small ring, and the number
in the water's colour. Its icon on each foe's plate, a figure under a line, with no ring: the
water's own surface says how long.

### Congelado (frozen, on the clock)

Aitor's, 2026-11-20, for Freática's definitiva *Bajo cero*: **frozen foes cannot attack and take
little damage; if the ice is broken, a very large blow; cracks show, and it splits more as it takes
damage from outside; it goes by time, melting live, little by little, and breaking it is worth less
all the while; it breaks at four to eight blows, and a flurry is a shortcut through it.** The numbers are first guesses.
Its look is built in the effects lab (`src/freatica-fx.ts`); no rule.

**The rule**

- **Laid on every foe that has water**, when one of them has it at the third mark (Freática's
  *Bajo cero*). A dry foe is not frozen.
- **On the clock**: a mark of ice lasts what a mark of water does, 20 s, so each foe's ice lasts
  20, 40 or 60 s by the marks its water had. It melts all the while, never a mark at a time; when
  nothing is left the foe is free.
- **A frozen foe does not act** (a turn that comes while it is in the ice is lost), and **takes a
  quarter** of every blow.
- **Its ice holds eight blows from outside** (never a pulse or a reaction): a *leve* or *medio*
  blow counts one, an *alto* or *muy alto* two, so four to eight blows. **Each strike of a flurry
  counts one** (proposal): *Zarpazos* is half an ice, a dual's eight a whole one. The cracks do
  not heal as it melts. A physical blow cracks it whatever its element.
- **Cracked through, it breaks**: the foe takes magic water damage by the ice still there (Aitor:
  huge broken at the start, less as it melts, still a lot, and a blow, not a share of its PV; proposed base 90 with three marks of
  ice, falling with it to 40 as the last goes), and is free at once.
- The break is nobody's blow: never a golpe crítico, and it spends no wound.
- A flame (magic fire) does not crack it: it melts a mark off at once, with its steam. Electricity does nothing.
- **A boss can be frozen too** (Aitor), and takes as little as anyone while its ice holds.

**How it shows** (built as a look: the lab's *Bajo cero*, *Golpe al hielo*, *Golpe alto al hielo*,
*Ráfaga de cuatro*, *Ráfaga de ocho*, *Llama al hielo*)

| Beat | What is seen |
| --- | --- |
| It freezes | A white flash through the water (0.12 s). The water is gone and stands as a block of pale blue-green ice round each foe, as tall as the water stood, set in 0.3 s; a low breath of cold round its foot. Seen through it the foe is darker and greener, never pink |
| While it lasts | The foe holds its pose. The block sinks all the while, a mark every 20 s, giving off cold from its top and running with water down its faces; the gauge's pointer goes down with it, and its edges blink in the last three seconds |
| A blow from outside | The block flashes white (0.3 s), chips fly, more the harder the blow, and cracks open from the middle of each face outwards, an eighth of the way a blow and a quarter for a hard one; a flurry cracks it strike by strike. Each piece the cracks cut off catches the light its own way. The number is small |
| It breaks | 0.1 s after the blow that cracks it through, the block bursts: 150 shards from a fresh ice of three marks, fewer and slower the less is left, a flash of cold light, a breath of cold. «¡ROTO!» and the largest number the ánima shows, with the hold of a golpe crítico |
| A flame | A mark of the ice goes at once (0.5 s) in steam and running water; nothing cracks |
| On the plate | A crystal with the clock of a timed status round it, draining as the ice melts; the crystal splits further with each blow |

### Empolvado (powdered, timed)

Aitor's, 2026-11-20 (fifth round), for Colorista: dry coloured powder, as at a Holi, that **does
nothing by itself and waits for an element**. The three reactions are his; the numbers are first
guesses. **Built** that day (`powder` and `POWDER_RULES` in `src/battle.ts`,
`tests/powder.test.mjs`): the status, laid by *Puñado*, and its three reactions. It replaces that
day's paint proposal (Pintado, Endurecido, Añicos, the cover).

**The rule**

- A **timed** status, as Mojado: 20 s on the clock, no levels, no pulses. Powder on a powdered foe
  starts its 20 s over.
- Laid by a blow that powders (Colorista's *Puñado*, *Polvareda*, *Traca*) and by breaking a
  cortina while Colorista is worn (§ Cortina de polvo, *Rebufo*).

| On Empolvado | Reaction | What happens |
| --- | --- | --- |
| Fire | **Estallido** | The powder explodes: magic fire damage on that foe (22) and half (11) on every other foe. The blast is fire: it sets off the powder on any other powdered foe, each once. When the chain is over, **every foe standing is Quemado one level higher**, once however many went up |
| Water | **Envenenado** | The powder takes the water and leaves Envenenado I (§ Envenenado); on one already poisoned, a level more and its clock starts over. It leaves no Mojado |
| Electricity | **Cristalizado** | The powder on the one struck fuses into shards (§ Cristalizado). Only the one struck, as Shock |

- **Only a blow of an element sets it off**, after the powder is there: powder that lands on a
  foe already burning or wet does nothing to it. Otherwise a handful on a burning field would
  blow it up every turn, with no element spent.
- **By kind of blow, never by who wears what**: any fire, any water and any electricity do it
  (Atacar with an element, a skill, a dual, a foe's move), whoever threw the powder. It holds on
  both sides; today no foe throws any.
- A part of a boss can be powdered, blown up, poisoned and crystallised.
- The powder is spent by its reaction: the next one needs powder again. A foe can be Envenenado,
  Cristalizado and Quemado at once, from three handfuls.

**How it shows.** Matte is the look: dry, opaque, lit only by the place's light, no bloom and no
shine, the one effect in a fight that does not glow. On the GPU particle engine
(`src/powder-fx.ts`; the effects lab's *Polvo de colores*, `just screenshots polvo-fx`). Colours
do nothing: an earth palette (terracotta, mustard, sage, dusty teal, slate blue, brick), two or
three mixed in every puff; never saturated pink or violet.

| Beat | What happens |
| --- | --- |
| **It lands** (0.5 s) | A puff the size of the foe's body: a dense core that opens in a tenth of a second, eight or nine jets thrown outwards, a haze that hangs for two seconds, and thousands of grains that fall. Over the number, *¡Empolvado!* |
| **While it lasts** | The powder stays on its body, all over the side it came from, and on the floor round it; a few grains shed every second and a thin haze stays at its feet. Its plate has the icon, a small cloud, with the 20 s ring |
| **Estallido** (0.6 s) | A white flash on the body, then a fireball that swallows it and a ring along the floor; the powder leaves as black char. Embers fly to every other foe; a powdered one goes up 0.15 s after the one before. Scorch on the floor, smoke, and every foe left with Quemado's flames. *Estallido* in fire's colour, with its PV beside it |
| **Envenenado** (0.6 s) | The water darkens the powder; it runs down the body in thick streaks turning green and pools at its feet. From there on it is Envenenado's look (bubbles, ooze, the haze at its feet). *Envenenado* in its green |
| **Cristalizado** (0.5 s) | A spark runs over the powder; it draws together into small hard shards that stand out of the body, the only thing of the powder that catches the light. *Cristalizado* in electricity's colour |

- *Movimiento reducido*: no jets and no flying char; the powder appears, changes colour and goes.

### Envenenado (poisoned, timed)

Aitor's, 2026-11-20: left by water on Empolvado; **the foe takes damage and the physical and magic
damage it receives is amplified while it lasts**. Its look is built (`STATUS_LOOKS.envenenado`);
and so is its rule. Numbers are first guesses.

- A **timed** status that pulses: every **4 s** for **20 s**, about two rounds, so it does not
  need feeding every round as Quemado does.
- **While it lasts, every blow on whoever is poisoned, physical or magic, lands 25 % harder**, at
  any level. The quarter multiplies the blow as it lands, after a wound's and a golpe crítico's
  bonus, as a weakness does. Pulses are not blows; a reaction's blast is one. Over the number,
  *Veneno +25 %*.
- **Escalates** as Quemado: poisoned again while it lasts, a level more (I → II → III) and its
  20 s start over. Each level costs powder and water again; the level only raises the pulse.
- First guess for the pulse: twice Quemado's base (2 PV plus 2 % of the carrier's PV counted up to
  100), at ×1, ×3 and ×5: on a foe of 260 PV, 4 / 12 / 20 a pulse, 20 / 60 / 100 in its 20 s.
- Like Sangrado and Quemado, its pulses pass over the foes' own rules, and are never a golpe
  crítico.
- The reactions the combat direction gave it (fire on it, *Veneno ardiente*; water on it,
  *Contagio*) stay for later.

### Cristalizado (full of shards, timed)

Aitor's, 2026-11-20: left by electricity on Empolvado; **every attack it receives does more, and
each one more than the last, because the shards dig in**. Built. (Not *Cristalino*: that is a foe of Las
cuerdas.)

- A **timed** status: 20 s on the clock, no levels, no pulses. Crystallised again, its 20 s start
  over.
- **Every blow that lands on it does more than the one before** (Aitor 2026-11-20): 4 more the
  first, 8 the second, and so on up to 20 at the fifth (first guesses). The extra is added at the
  end, after Defensa and after anything that multiplies. Every hit of a flurry counts, and an
  eco's; pulses do not. The count is on its plate, as Sangrado's, and goes with the status.
  So the poison is for whoever hits hard and the crystal for whoever hits often.
- **How it shows**: small hard shards stand out of the body where the powder was, in the powder's
  colours gone pale; they glint when the foe moves. Each blow drives them in: a short glassy
  crack, three or four splinters thrown out, and *Esquirlas +4* (then *+8*, *+12*…) beside the
  number. Its icon on
  the plate, a splinter, with the 20 s ring.

### Cortina de polvo (the powder screen)

Aitor's, 2026-11-20: a protective spell that raises everyone's Defensa and stands **a physical
shield of particles in front** of an ally that **halves the next attack**; Colorista's first
protects one (*Cortina*), its second both (*Telón*). **Built** 2026-11-21 (`CORTINA`,
`cortinaRounds` and `changeHealth` in `src/battle.ts`; `tests/powder.test.mjs`). *Sutura de luz*
already halves the next damage of a round: this is that rule with a body.

- **The next damage a blow does to whoever stands behind it is halved, and the cortina breaks.**
  One blow: of a flurry it stops the first hit. Pulses pass through and do not break it. Halved
  first; Defender's or a protection's third comes after.
- It stands until a blow breaks it or **three rounds** pass. One on each fighter; raised again,
  it starts over. A blow on everyone breaks each one it meets.
- ***Rebufo*** (Colorista's rule, `ANIMA_RULES`): whoever breaks a cortina is left **Empolvado**:
  the screen bursts over them.
- The Defensa it comes with is one boost: *Cortina* and *Telón* do not add up, the later one
  starts the three rounds again.
- In descriptions: `Una cortina de polvo reduce a la mitad el siguiente daño que reciba un
  aliado.` (`cada aliado` for both).

**How it shows**: a handful thrown upwards hangs in front of the ally as a standing screen, a
body wide and a little taller, between them and the foes: dense in the middle, thin at the edges,
churning slowly, grains falling from its foot onto the floor. Its icon on the ally's plate, a
small curtain. A blow goes through it: the screen is torn open where the blow passes and the
whole of it is thrown forward over whoever dealt it (a puff, as a handful's), and the number
comes out with *Cortina −50 %*.

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
| Sangrado | Papagato (Haru), Dadista (*Tijeras*) | Any physical blow that adds none; Papagato (*Zarpa en la llaga*, twice over; *Cacería*) |
| Golpe crítico | A rule: a wound of five spent under Papagato's *Olor a sangre*, *Acecho*. By chance: the Crítico attribute, +20 % on whoever bleeds (*Olor a sangre*), +10 % a die spent (Dadista's *Racha*, built) and the party's doubled (*Ases en dúo*, a proposal) | Whoever lands the blow |
| Mareo (mental) | None now (it was El Vértigo's) | Papagato (*Ronroneo* cleanses it) |
| Llorera (mental) | The onions (foe) | Papagato (*Ronroneo* cleanses it) |
| Quemado | Matemágico (*Foc Binari*; the dual *Zarpazos de fuego*, on a coin; *Vulcano*) | Atacar · Agua (Humo); any physical blow at IV, *Combustión*; Tecnópata's *Reinicio* starts it over |
| Sangrado (reaction) | Papagato (Haru) | Atacar · Fuego (Cauterizado) |
| Cegado | Atacar · Agua on Quemado | Atacar · Eléctrico (Tormenta) |
| Punto débil | The dual *Punto débil*; Dadista (*Ojo*) | Any blow, the next one |
| Crítico past 100 % | Dadista (*Racha*, *Ases en dúo*; proposal) | Dadista (*Dados astrales*: a die of light for each 15 %) |
| Empolvado | Colorista (*Puñado*, *Polvareda*, *Traca*; whoever breaks a cortina, by *Rebufo*) | Any fire (Estallido), any water (Envenenado), any electricity (Cristalizado) |
| Cristalizado | Electricity on Empolvado | Whoever hits often: every blow does more than the one before (flurries, ecos, *Traca*) |
| Envenenado | Water on Empolvado; Colorista (*Rociada*) | Whoever hits hard: every blow lands 25 % harder. Whatever stretches a clock (Tecnópata's *Rayo de energía*, *Telemetría*) |
| Cortina de polvo | Colorista (*Cortina*, *Telón*, *Remolino*) | Whoever stands behind it: the next blow at half |
| Agua contenida, on each foe (proposal) | Freática (*Recarga*, *Riada*); any water blow keeps it from draining | Any electricity (Corriente), any fire (Vapor on that foe, at its water's level), powder (Envenenado, to settle); Freática (*Bombeo*, *Golpe de ariete*) |
| Corriente (proposal) | Any electricity on a foe with water, through every foe that has some; Freática (*Sondeo eléctrico*, twice as long) | The water's level: its pulse is ×1, ×2, ×3 |
| Hundido (proposal) | A foe's water at its third mark | Whoever keeps it there |
| Congelado (Aitor's; numbers a proposal) | Freática's definitiva, *Bajo cero*, on every foe with water when one has it at the third mark | Whoever breaks the ice before it melts: four to eight blows from outside, the hard ones counting two; a flurry is the shortcut (*Zarpazos* half of it, a dual's eight all) |
| The astral | Tecnópata (*Rayo de energía*), Dadista (its astral skills), Sincopante (every blow and eco; proposals) | Nothing on purpose: it is the damage nothing resists |

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
