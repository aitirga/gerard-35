---
name: anima
description: Design a wearable ánima for Gerard's game with the user, or review one that exists and design it whole: show its current state, then origin, role, stats, its mechanic and passives, skills per level, definitiva, look and interface, and a plan. Use when the user wants to create, review, refine or level up an ánima ("ánima", "clase", "habilidades de <ánima>", "repasar las ánimas").
---

# Ánima designer

Second version (2026-11-20, after reviewing Papagato with Aitor): keep it light, learn from each
use and tell the user what to change in this skill. Talk to the user in Spanish; write docs in
English with player-facing text in Spanish.

## The order of work (decided by Aitor)

1. **Each ánima, one by one, designed whole.** This skill.
2. **The duals**, once every ánima is designed. Here an ánima only says what it offers a pair.
3. **The balance**, last. Until then every number is a first guess: say so, and never hold a
   design back for one.

Design is docs. **No mechanic goes into the game's code until the user has said yes to its
design**; what shows the design (the sheet, a screenshot scenario) is built right away.
Once they have, build what the design can stand on today (the rule with its tests, then its look)
and say plainly what stays designed because a system is missing (Papagato: levels 4 to 7, the
definitiva). Rules that bring luck into a fight get their own seeded stream and are switched off in
the tests (`tests/setup.mjs`), and a help in the fight tester to see them at will (*Crítico
seguro*). `just fight-sim check` will move: report it, the targets are set again with the balance.

## 0 · Load

Read quietly: `AGENTS.md` (tone, vocabulary, the skill description shape, `abstract: true`),
`docs/animas/README.md` (order of work, catalogue, levels, passives, definitivas, combined skills,
shared mechanics, how an ánima is built) and the other ánimas' folders, `docs/party.md` (stats,
wearing, two players), `docs/combat.md` (statuses, the fight's clock, *La respuesta de cada
combate*), `src/battle.ts` (`CLASS_STATS`, `SKILLS`, `PASSIVES`, `DUALS`), `src/levels.ts`,
`src/ecos.ts`, `src/classes.ts` (`CLASSES`). If the ánima comes from a friend, read their
`docs/quests/<id>.md` (and design it together with the `/side-quest` flow).

The living doc is `docs/animas/<id>/README.md` (`<id>` is its `ClassId`), from
[template.md](template.md). Anything shared (a status or rule other ánimas can use, a dual) goes
in `docs/animas/README.md` first, and both sides link to it.

**Aitor's notes on the sheet** (`just animas`, `docs/anima-notes.json`, docs/dev-tools.md § The
ánimas' sheet): the `abierta` ones whose `entry` is this ánima's id, plus `duos`, `mecanicas`,
`reglas` or `catalogo` when they touch it, are part of what he wants: read them before proposing and
answer each in what you propose. `git pull` first if they may come from the other machine. Once a
note is dealt with, write its `reply` (one or two plain Spanish sentences: what changed and where,
or what it waits for) and set `status` `hecha` (or `descartada`, with the reason) and `closed` to now
(ISO, to the second); keep it `abierta` while it waits for his OK. Never delete a note or rewrite his
`text`; keep the file two-space pretty-printed, the notes in their order, and no other fields
(`animaNotesProblem` in `src/anima-notes.ts` refuses it otherwise). The open page shows replies
when he comes back to it.

## 1 · Show where it stands (an ánima that already exists)

Before proposing anything, show the user the ánima as it is today:

1. **Its sheet in the game**: `just screenshots <id> --gpu`. The scenario is the ánima's sheet and
   always shows the same things, in this order (`scripts/screenshots/papagato.json` is the model):
   the party with it worn, the look up close, whatever comes with it (cats, a robot, dice), the
   skill list at its top level, **each skill as a clip**, its mechanic visible on a foe, and its row
   on the status screen's Ánimas page. If the scenario is stale or missing, fix or write it first.
2. **What each skill decides**: `just fight-sim run --fight <two or three fights it matters in>
   --party <a party wearing it> --level <its top> --policy smart --ban none,<each skill>,duals`. A
   skill whose ban changes nothing is one the design has to give a reason to exist (or the bot
   cannot value it: say which).
3. **Doc against code**: what the doc says that the game does not have, what the game has that the
   doc does not say, and what has gone stale (a stat that no longer exists, a rule decided since).
4. Tell the user in a few lines: what is built, what is only designed, what does not hold any more,
   and what the sim says, and his open notes on it. What it has by level goes as the skill table
   with its descriptions (§ 3, *The skill table*), never as a list of names. Put the gallery and the sheet in herdr's
   sidebar (§ 5).

## 2 · The direction

One line from the user that the whole ánima hangs from: **its general mechanic** (Papagato:
*physical blows, Sangrado and golpes críticos*) and any passive or rule they already want. If they
have not given it, propose two or three, each a different way of fighting, and wait for that one
answer. What the user says here is **decided**; write it down as theirs, with the date.

## 3 · Design it whole

Then fill every section of the template in one pass, proposing where the user has not decided.
One topic at a time with 2–3 options only if the user asks to go round by round. Every part
keeps the game's tone (`AGENTS.md` § Game philosophy): not a children's game, so an ánima is a
serious way of fighting with depth (combos, trade-offs, decisions), never a cute gimmick.

1. **Identity**: where it comes from, what wearing it feels like in one sentence, its motto.
2. **Role**: a table against the other ánimas (what it hurts with, the resource it leaves on the
   foe, how it pays off), what it is good and bad at, and the decision it adds to every turn. It
   should change how a fight is played, not add numbers.
3. **Stats**: the wearer's `CLASS_STATS` (sum near +4, at least one trade-off; Velocidad no longer
   exists) and, if it comes from a friend, the party bonus in `ANIMAS`.
4. **Signature and passives**: the loop in two or three numbered steps, built from shared rules
   where it can (`docs/animas/README.md` § Shared mechanics). **A new shared rule is defined
   there, twice over: the rule, and how it shows** (the effect on screen, beat by beat, with
   durations and sizes: Golpe crítico is the model). Passives: one or two, few and influential, and
   **not from the start**: an ánima does not need a passive of its own at level 1 (Aitor took
   Papagato's away); it grows into one (§ Passives). **A rule the whole ánima hangs from is not a
   passive and can be there from level 1** (Dadista's *Racha*, Aitor 2026-11-20): every skill
   then builds it, reads it or spends it, **its count shows on the wearer as a status**, and its
   sentence is in `ANIMA_RULES` (`src/battle.ts`), which the status screen's Ánimas page shows.
5. **Skills per level** (a skill's name never says who does it: *Ronroneo*, not *Ronroneo de
   Yuki*): seven levels for a shared ánima (a tree at the jar for an own one). A
   table of level → what it gives (who does it, cost, base, description in the fixed shape, and
   **State: Built / Designed**; § The skill table, below). Intensity from base power: leve ≤20,
   media 21–34, alta 35–49, muy alta ≥50. Level 4 is Maná +1; one passive around 3 to 6; level 7 a strong skill. Under the
   table, a line on what each skill is *for* in the loop. **Every skill is part of the mechanic**
   (it builds the ánima's resource, spends it, or keeps its wearer able to): a built skill that
   does neither is named as a candidate to cut, not kept out of habit, and a cut skill is not
   replaced to fill its level (Aitor cut Papagato's party Defensa and its blow on every foe: *no les
   veo mucho sentido*). **A passive is explained by example**, with numbers before and after, never
   by its rule alone. Then its **definitiva** and the condition that unlocks it in a fight.
6. **What a round looks like**: a short table of turns with the real numbers, to see the loop
   work and catch a design that only reads well.
7. **What it offers a dual**: the hooks it brings to a pair (a wound to spend, a flurry, a blow
   that waits). The duals that exist are listed; new ones are not designed here.
8. **Look and interface**: recolours (`look`), what it adds on the rig, its colour, the
   `#hud[data-class]` theme, and how any new effect looks on this ánima. Grey in the first round,
   its colour in the second, if it is a friend's.
9. **In the world**, **Second round**.
10. **For the balance, later**: what the sim said in § 1 and the numbers to watch. Not tuned now.
11. **Open**: at most a handful of questions that are really the user's (a decided rule the
    design wants to change, a new attribute). Give a recommendation for each.

Mark everything as **decided** (who, when), **built**, or a proposal. A change to something the
user decided before is never slipped in: it is a proposal, named in *Open*.

### The skill table (Aitor 2026-11-20, after Dadista)

**Wherever skills are listed in a table, each row carries its description as the player will read
it**: in the doc's *Skills per level* and in what you tell the user in the chat (there as
`Nivel | Habilidad | Coste | Descripción | Estado`); the short table in `docs/animas/README.md`
§ Levels only names them and links to the ánima's. A row with
a name and a paraphrase of yours (*the whole hand at once*) is not enough: he judges a skill by
the sentence the game will show.

- The description is in Spanish, in a code span, in the shape of `AGENTS.md` § Game vocabulary and
  descriptions, copied from `SKILLS` when the skill is built and written to pass
  `tests/battle.test.mjs` when it is not:
  - Damage: `Daño <físico|mágico>[ <elemento>] <leve|medio|alto|muy alto> a <objetivo>. <Efecto extra>.`
    **The order is kind, element, then intensity** (Aitor 2026-11-20): `Daño físico alto a un
    enemigo.`, `Daño mágico de fuego medio a todos los enemigos.` Elements: `de fuego`, `de agua`,
    `eléctrico`; magic with none says `no elemental` (`Daño mágico no elemental leve a un
    enemigo.`); physical names one only when it has it.
  - Healing: `Cura <leve|media|alta|muy alta> a <objetivo>.`
  - Buffs and debuffs: `Sube|Baja <stats> de <objetivo> durante <N> rondas.`
  - Protection: `Protege a un aliado hasta el final de la ronda.`
  - Targets: `a un enemigo`, `a todos los enemigos`, `a un aliado herido`, `a todo el equipo`.
  - One short sentence for each extra effect; no flavour, no formulas.
- **The intensity is worked out from the base power** in the same row (≤20 leve, 21–34 media,
  35–49 alta, ≥50 muy alta), so the two never disagree; check it when a number changes.
- **Every row has one**: a passive (one or two plain sentences, as `PASSIVES[…].description`), a
  fixed command, the definitiva, and each part of a skill that is several (Dadista's faces). Only
  *Maná +1* has `—`. An `abstract: true` skill is marked *Abstract* and still gets its sentence.
- If the shape has no word for what a skill does (a target at random, a strength that changes),
  say so under the table and propose the word for `AGENTS.md` and the test; do not bend the
  sentence quietly.

## 4 · Check

Compare cost and power with the existing skills (Atacar is 18), check it does not make another
ánima pointless, that every description passes the shape (`tests/battle.test.mjs`), and that what
multiplies does not run away (write the largest single blow the design allows). List what needs
systems that do not exist yet and say so plainly. Update the catalogue row, the levels table and
the definitivas table in `docs/animas/README.md`, and `docs/progress.toml` (an item for what is
designed and not built).

## 5 · Show it

- **The sheet**, `output/reports/animas/index.html`: every ánima's design beside what the game has
  of it today (read from the code), every dual and the shared mechanics, and Aitor's notes on each.
  It is where he reads, checks and comments a design. **`just animas-report`** writes it (run it
  after every change to a doc or to the code; it does not block); `just animas` is his: it serves
  the page so he can write notes, and rewrites it on every reload. Never run `just animas` yourself
  (it starts a server and opens his browser). Nothing in the sheet is written by hand: to change
  what it says, change the doc or the game.
- In herdr, add what changed to the assets sidebar as `AGENTS.md` says (`just animas-report` adds
  its own page; the gallery with `herdr-assets add output/screenshots/<id>/index.html --group
  Screenshots`; the doc with `--group Docs`). Never open them in the user's browser; say they are in
  the sidebar and give the paths, and that `just animas` is where he can comment.
- If the ánima comes from a friend's mission and that mission has a report page
  (`output/reports/<mission>/`, `/side-quest` § Report), update its ánima section too.

## 6 · Plan, once the design is agreed

Fill the *Implementation* section, following `docs/animas/README.md` § How an ánima is built:
any new shared rule first (with tests, and in `just fight-sim`), then `ClassId` and `ANIMA_NAMES`,
`CLASS_STATS`, `SKILLS` and `PASSIVES` (`src/battle.ts`), levels (`src/levels.ts`), `CLASSES`
(`src/classes.ts`), the theme in `src/style.css`, the unlock flag and moment, the fight tester and
the picker reaching every level and skill, the sheet scenario, and `docs/party.md`. Each step a
`feat: …` commit.
