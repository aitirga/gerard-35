---
name: side-quest
description: Design a friend's ánima mission (side quest) for Gerard's game with the user, round by round, until it converges into a design doc and an implementation plan. Use when the user wants to create, continue or plan a side quest, a friend's mission, or a new ánima ("misión", "side quest", "ánima de <amigo>").
---

# Side quest designer

You are a co-designer, not a form. The user knows the real people; you know the game. Your job is
to pull out what only they know, propose what the game needs, and converge on a mission that can
be built. Talk to the user in Spanish. Write docs in English (like the rest of `docs/`), with
player-facing lines in Spanish.

## 0 · Load the world (every time, before the first question)

Read these, quietly; don't summarise them back:

- `AGENTS.md`: game philosophy (no quest log, diegetic gates, HUD rules), ánima vocabulary, the
  skill description shape.
- `docs/lore.md`: themes (routine vs. ilusión, growing up, choosing who you are), La Reina
  Bubbaloo, her minions, people.
- `docs/chapter-2.md` § Friends and ánimas, § Hidden clues, § The Queen's advance (a mission
  fits in one day, 2–4 hours), § The Queen and the second round.
- `docs/party.md` (stats, ánimas as classes, two players), `docs/combat.md` (fights).
- `src/animas.ts` (`ANIMAS`), `src/battle.ts` (`ClassId`, `CLASS_STATS`, `SKILLS`, `Encounter`,
  `FoeKind`), `src/dialogue.ts` (`SPEAKERS`), `src/portraits.json`, `src/characters/`.
- `docs/quests/`: missions already designed. Reuse nothing that another mission already owns
  (a mechanic, a boss gimmick, a place) and note links between friends.
- `docs/barcelona.md` § places and transit if the mission is in the city.

If the user names a friend that already has `docs/quests/<id>.md`, **resume** it: read it, say in
two lines what is decided and what is open, and continue from the first open topic.

## 1 · Iterate

Keep a living doc from the first answer on: `docs/quests/<id>.md`, from
[template.md](template.md). After every round, update it (decided things move out of *Open*) and
tell the user in one line what changed. The doc, not the chat, is the memory.

**How a round works**

- Ask about **one topic at a time** (at most 2–3 tightly related questions), in the order below,
  but follow the user if they jump ahead or dump a lot at once: file everything they gave you, then
  ask only what is still missing.
- Each question comes with **2–3 concrete proposals** grounded in what you know (the friend, the
  place, the themes, mechanics not used yet), plus room for their own answer. Use
  `AskUserQuestion` when the choices are clear-cut; ask in plain text when you need a story,
  a memory or a description of a real person.
- Ask for **real details** about real people: hobbies, jokes, phrases they say, their job, their
  town, what they were like as kids. These are what make a mission personal. Never invent facts
  about a real person and file them as decided: mark invented proposals as proposals.
- Push back when a proposal breaks the rules below, and say which rule.

**Topics, in order**

1. **Protagonista**: who (the real friend, their relation to Gerard and Aitor), their job and
   routine, a phrase or habit that is unmistakably them. One person or a pair (Nuria and Uri).
2. **Lugar**: where they are (a real place: city district, town, house, workplace), how the party
   gets there (metro line, Rodalies, on foot), and whether the scene exists or needs `just geo`.
3. **Problema**: what the Queen's bubble popped in their routine (the office vanished, the alarm
   never rings, the to-do list is blank) and how they are lost without it. It must be a version
   of *routine vs. ilusión* (`docs/lore.md`).
4. **Cómo se entera el jugador**: the hidden clues that point to this friend (at least two places,
   never highlighted, a `clue-*` flag each), and who mentions them.
5. **Lo inusual**: 2–4 strange things in their place, caused by the bubble or by the friend's
   world gone wrong (gum where it shouldn't be, possessed animals with pink eyes, objects acting
   out the routine on their own). At least one should be something to explore or play with, not
   just look at.
6. **Desarrollo y mecánica propia**: the beats from arrival to the boss, in one day (2–4 hours of
   game time). The mission's **one mechanic nobody else uses** (`docs/chapter-2.md`) and how it is
   taught by doing. Any diegetic gate (a person or thing saying why). Where Aitor speaks.
7. **Jefe final**: who or what (a possessed animal, an object of their routine turned monster, a
   minion in person only inside the palace), its look, its gimmick (like the pringue that only
   No-ta breaks), its phases, how the friend helps, and what the new or existing ánimas do against
   it. Name an `Encounter` id and any new `FoeKind`.
8. **Ánima**: name, colour (grey in the first round, its colour in the second), party stat bonus
   (`ANIMAS`), and what it brings into Gerard: a wearable ánima (`ClassId` with `CLASS_STATS`,
   look, motto, interface theme) with 1–2 `SKILLS`, or a single skill, and the world key it opens
   (a gate elsewhere in the city). Write each skill description in the fixed shape from
   `AGENTS.md`, or mark it `abstract: true` and say why. Design the wearable ánima itself in
   `docs/animas/<id>/README.md` following the `/anima` skill; the quest doc links to it.
9. **Segunda vuelta**: the kid under the routine for this friend, what Gerard does to find it, and
   the ánima's colour.
10. **Assets pendientes**: see § Assets.
11. **Dudas abiertas**: anything still undecided, and the user's own doubts. Ask the user
    explicitly if there is something they were unsure how to approach (a design doubt, the tone,
    the scope) and give it its own round.

**Rules every proposal must pass**

- No objective panel, quest log, waypoint, arrow or checklist; the map never marks the friend.
  People and the world give direction.
- Gates are diegetic. Every new control is taught right before it is needed.
- Player-facing text says *ánima*, never *clase*. HUD glyphs through `data-glyph`, never a hard
  key.
- It fits in one in-game day and works for two players (Aitor on mando 2) and for the follower
  mode.
- Nothing preaches: the friend's story carries the theme.
- The Queen's secret (Nuria Mendoza) is never revealed by accident. If a mission touches it, flag
  it as a story decision for `docs/lore.md`.

## 2 · Converge

When every topic has an answer (or the user says "suficiente"), run a check before planning:

- Read the doc as a player: can someone who never saw the doc find this friend, understand the
  problem, learn the mechanic and beat the boss without a hint panel? Name any spot where they'd
  get stuck, and add a person, a line or a visible detail there.
- Check balance against `docs/party.md` and `palaceGuards`: the ánima's bonus and skills next to
  Noísta and Matemágico; the boss next to the party with the ánimas it can have by then.
- Check it against the other `docs/quests/` for repeated mechanics or places.

Show the user the gaps found, settle them, then write the plan.

## 3 · Implementation plan

Add an **Implementation plan** section to the doc: ordered, small steps, each one a commit
(`feat: …`, per `AGENTS.md`) and each one playable. Map every step to files. The usual shape:

1. **Data**: `ANIMAS` in `src/animas.ts`; `ClassId`, `ANIMA_NAMES`, `CLASS_STATS`, `SKILLS` in
   `src/battle.ts`; `CLASSES` in `src/classes.ts` (+ `#hud[data-class]` theme in `src/style.css`);
   flags (`anima-<id>`, `clue-*`, mission beats) in `STORY_FLAGS` (`src/story.ts`); speakers in
   `SPEAKERS` (`src/dialogue.ts`); new glyphs in `src/input-glyphs.ts`.
2. **Place**: the scene (`just geo <zona>` or a hand-designed one), the station or line in
   `src/transit.ts`, the clues in the world.
3. **Story**: lines and triggers in `src/chapter-2.ts` and rules in `src/story.ts`; hours spent
   (`src/days.ts`).
4. **Mechanic**: its own module, pure logic separate from rendering, with a test.
5. **Boss**: `Encounter`, `FoeKind`, AI in `src/battle-ai.ts`, model; balance with
   `just combat-sim`.
6. **Tests**: `tests/battle.test.mjs` (skill description shape), story rules, the mechanic.
7. **Screenshots**: a scenario in `scripts/screenshots/<id>.json` covering arrival, the mechanic,
   the boss and the ánima unlock (`just screenshots <id>`).
8. **Docs**: the friend's row in `docs/chapter-2.md` (the template table and clues table),
   people and places in `docs/lore.md`, skills in `docs/party.md`.
9. **Report**: the mission's page (§ Report).

Mark which steps are blocked by missing assets. End by asking whether to start with step 1 (on a
`feat/<id>-mission` branch, via the `feature` skill) or keep refining.

## Report

When a mission is built (all its playable steps done, or the user stops for now), make a small
visual page that shows it to the user: `output/reports/<id>/index.html`, copied from
[report.html](report.html). That template is the design for every mission and ánima report
(`output/reports/nuria-mission/` is the first one): keep its styles, palette and lightbox and only
fill or drop sections, so all reports look alike.

- **Content**, in Spanish: the hero (eyebrow, title with the memorable part in `<em>`, a two–three
  sentence lede, chips with branch, commits, files and lines, tests passing and steps done, the
  best screenshot); *El recorrido* (one beat per step of the route, a real line of dialogue and two
  screenshots each); one section per thing that makes the mission itself (place, mechanic, enemies,
  boss, the ánima's skills table, any new system); *Cómo está hecho* (branch commits, modules,
  `just screenshots` scenarios, docs touched); *Pendiente y decisiones* (open questions for the user
  as `.q` cards). Facts come from the code, the doc and `git log main..HEAD`, never invented.
- **Screenshots**: run `just screenshots <scenario>` first and reference them relatively
  (`../../screenshots/<scenario>/<shot>.png`, with `data-cap`). Don't copy images.
- **Changes later**: when the user edits a mission (a new beat, a reworked boss, more skills),
  update that same page in place, never a new one: the affected sections, new screenshots, chips,
  commit list (the session's in amber) and the footer date. Drop pending cards that got settled.
- **Show it**: `herdr-assets add output/reports/<id>/index.html --title "<Misión de X>" --group
  Reports` (same path again updates the link), and give the user the path. `output/` is
  untracked, so the page stays local.

## Assets

Build a checklist in the doc for every new character (the friend, the boss if it is a person or
creature, any NPC with lines), checking what already exists:

- Reference photos: `assets/references/characters/<id>/` (PNG, JPEG or WebP; export HEIC). Ask
  the user to drop them; they stay local and untracked.
- A `--description` for `just character <id>`: age, build, hair, glasses, beard, usual clothes,
  colours. Draft it with the user and write it in the doc ready to paste.
- Portrait and expressions the dialogue needs (default set: `sorprendido`, `riendo`, `triste`,
  `enfadado`, `pensativo`, `preocupado`; list any custom `nombre=descripción`), in
  `public/portraits/` and `src/portraits.json`.
- Full body and 3D model: `src/characters/<name>.json`.
- `SPEAKERS` entry with `portrait`.
- Places: reference photos in `assets/references/environments/<place>/`, and whether the zone
  needs `just geo`.
- Props or creatures that are procedural (like `src/minion.ts`) rather than character JSON.

Give the exact commands to run, in order, and say which steps cost API credits (`--dry-run`
first).
