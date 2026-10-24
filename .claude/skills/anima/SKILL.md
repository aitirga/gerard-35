---
name: anima
description: Design a wearable ánima for Gerard's game with the user, round by round: origin, fantasy, stats, skills per level, shared mechanics, look and interface, then a plan. Use when the user wants to create, refine or level up an ánima ("ánima", "clase", "habilidades de <ánima>").
---

# Ánima designer

A first version: keep it light, learn from each use and tell the user what to change in this
skill. Talk to the user in Spanish; write docs in English with player-facing text in Spanish.

## 0 · Load

Read quietly: `AGENTS.md` (vocabulary, the skill description shape, `abstract: true`),
`docs/animas/README.md` (the catalogue, levels, combined skills, shared mechanics, how an ánima is built) and the other ánimas' folders, `docs/party.md` (stats, wearing,
two players), `docs/combat.md` (statuses, stacks, `custom` effects), `src/battle.ts`
(`CLASS_STATS`, `SKILLS`), `src/classes.ts` (`CLASSES`). If the ánima comes from a friend, read
their `docs/quests/<id>.md` (and design it together with the `/side-quest` flow).

The living doc is `docs/animas/<id>/README.md` (`<id>` is its `ClassId`), from
[template.md](template.md): create it at the first answer, add the ánima to the catalogue in
`docs/animas/README.md`, update it every round and say in one line what changed. Anything shared
(a status other ánimas can use, a combined skill) goes in `docs/animas/README.md`, and both
sides link to it.

## 1 · Rounds

One topic at a time, each with 2–3 concrete proposals; follow the user if they jump ahead.

1. **Origin and fantasy**: where it comes from (a friend, a story moment, Gerard's own mood) and
   what it feels like to wear in one sentence. Its **motto** (like *"Dice que no. Y el mundo le hace
   caso."*).
2. **Role**: what it is good at and bad at next to the others in the catalogue (damage, support,
   control, a payoff). It should change how a fight is played, not just add numbers.
3. **Stats**: the wearer's `CLASS_STATS` (sum near +4, at least one trade-off once there are
   several ánimas) and, if it comes from a friend, the party bonus in `ANIMAS`.
4. **Signature mechanic**: one rule only this ánima has, or a shared one from *Shared
   mechanics* (Sangrado, Mareo…) used in its own way. A new shared mechanic goes into that section.
5. **Skills per level**: a table of level → skill (cost, base power, kind, target, description in
   the fixed shape; intensity from base power: leve ≤20, media 21–34, alta 35–49, muy alta ≥50).
   Level 1 has one or two skills; each later level adds or upgrades one. Say what raises each
   level: fights won wearing it, or a story event.
6. **Combined skills**: which other ánimas it complements, and the combined skill each pair gets
   when Gerard and Aitor wear them side by side (`docs/animas/README.md` § Combined skills, and the pair in both ánimas' folders). Only
   particular pairs.
7. **Look and interface**: material recolours (`look`), an accessory like Noísta's scarf, its
   colour, the `#hud[data-class]` theme. Grey in the first round, its colour in the second, if it
   is a friend's.
8. **In the world**: what it lets the party do outside fights (a gate, a gap, a person it calms),
   always diegetic.

## 2 · Check

Before planning: compare cost and power with the existing skills (Atacar is 18; No-ta 40 for 10
Secundaria), check it does not make another ánima pointless, and that every description passes
the shape (`tests/battle.test.mjs`). List what needs systems that don't exist yet (levels,
statuses in story fights) and say so plainly.

## 3 · Plan

Fill the *Implementation* section of the ánima's folder, following `docs/animas/README.md` §
How an ánima is built: `ClassId` and `ANIMA_NAMES`,
`CLASS_STATS`, `SKILLS` (`src/battle.ts`), `CLASSES` (`src/classes.ts`), the theme in
`src/style.css`, any new status or system first (with tests), the unlock flag and moment, a
screenshot scenario, and `docs/party.md`. Each step a `feat: …` commit.
