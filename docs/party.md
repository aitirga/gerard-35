# Party, stats and two players

From chapter 2 Gerard is never alone: **Aitor** walks with him from the moment he wakes up, and a
second player can take him on a second controller. This page covers who controls whom, the
character stats, and how ánimas (classes in the code) are shared. Numbers are provisional and meant to be tuned.

## Two players

| | Player 1 | Player 2 |
| --- | --- | --- |
| Plays | Gerard | Aitor (chapter 2 on) |
| Input | Keyboard, mouse and the first controller | The second controller |
| Exploring | Walks, runs, uses things, menu, their half of the status screen, camera | Walks, runs (hold B), uses what is in reach, advances dialogue, their half of the status screen (Y) |
| Battle | Gerard's turns (and Bernat's in chapter 1) | Aitor's turns |

- **Without a second controller Aitor follows Gerard** like Bernat did, walking Gerard's own
  steps. When a second controller connects (any button), Aitor walks on his own; when it
  disconnects he goes back to following.
- **Both stay on screen.** The camera looks between them and pulls back as they part. Past
  `TETHER` (7 cells) the one ahead is held back by an invisible ring, and Aitor says so in a
  bubble ("¡Eh, espérame!"), so it reads as a person, not a wall.
- **In battle the screen splits too.** Gerard's dock sits bottom left and Aitor's bottom right,
  each with the fighter's face, PV and Secundaria (two waves), their ánima switch and, on their
  turn, the commands, in the colours of their own ánima. Each player picks their own fighter's
  moves: on Aitor's turn the keyboard and the first controller do nothing and the turn line says
  *MANDO 2*. If no second controller is connected, the turn waits and says *CONECTA EL MANDO 2*.
- When Aitor joins, the key hint "Mando 2 · Jugar como Aitor" appears once and goes as soon as a
  second controller is there.
- The Mando page of the menu shows both controllers ("Mando 1 · Gerard", "Mando 2 · Aitor").

### Debug: one player

For development only, `solo` mode lets player 1 play both: Aitor follows Gerard and player 1
picks Aitor's moves in battle too. The interface says so: fights keep a single dock that follows
whoever's turn it is (the other fighter waits on the right) under a *DEPURACIÓN · UN JUGADOR LLEVA
A LOS DOS* badge, and the status screen is one wide sheet with the same badge. Turn it on with `just dev-solo` (or `?solo=1`, off with
`just dev-solo off` / `?solo=0`) or the switch on the Mando page, which only exists in the dev
build. The choice is remembered in the browser. Release builds are always two-player.

## Stats

| Stat | What it does |
| --- | --- |
| **PV** | Puntos de vida. |
| **Secundaria** | What skills spend. |
| **Fuerza** | Adds to physical hits (Atacar, the dogs' pushes). |
| **Magia** | Adds to magic hits (No-ta) and to healing (Cardioide). |
| **Defensa** | Takes away from physical hits. |
| **Espíritu** | Takes away from magic hits. |
| **Velocidad** | Who acts first in the party's half of the round. |

**10 is average.** Every amount has a base at average stats, and each point a stat is above or
below 10 moves it by one: a physical hit is `base + Fuerza − Defensa`, a magic hit is
`base + Magia − Espíritu`, healing is `base + Magia − 10`, never below 1. So chapter 1's boys and
dogs (all 10s) fight exactly as before the stats existed.

| Who | PV | Sec | Fue | Mag | Def | Esp | Vel |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gerard (boy) | 100 | 30 | 10 | 10 | 10 | 10 | 10 |
| Bernat | 85 | 24 | 10 | 10 | 10 | 10 | 10 |
| Gerard (35) | 120 | 36 | 11 | 13 | 10 | 12 | 11 |
| Aitor | 135 | 30 | 13 | 10 | 12 | 11 | 10 |

Gerard at 35 thinks and talks his way through (Magia, Espíritu); Aitor is the solid one (PV,
Fuerza, Defensa).

## Skills and ánimas

| Skill | Who | Cost | Base | Does |
| --- | --- | --- | --- | --- |
| Análisis Parálisis | Whoever wears **Matemágico** | 10 | +3 | Fuerza and Magia +3 for the whole party for 3 rounds (the one it is used in included); cannot be stacked while it runs |
| Cardioide | Whoever wears **Matemágico** | 8 | 24 heal | Heals one hurt ally |
| No-ta | Whoever wears **Noísta** | 10 | 40 magic | Breaks the Queen's gum (pringue) |

Every skill comes with an ánima: whoever wears none has none. Bernat never wears one and only
attacks (Habilidad is greyed out on his turn); Aitor has skills only while he wears an ánima.
Impulso and Abrazo are out for now.

- **Ánimas belong to the party** (the code calls them classes: `ClassId`, `CLASSES`). Gerard has
  **Matemágico** from the start (Magia +1, Espíritu +1; his own look and the gold interface);
  **Noísta** wakes up in chapter 1's palace (Magia +2, Espíritu +2, Defensa −1; the red scarf and
  the protest-poster interface). Anyone in the party but Bernat can wear any unlocked ánima, both
  at once if they like. Wearing one adds its stats and its skills. An ánima's colour and look come
  with it (`colour` and `scarf` in `CLASSES`).
- Pick who wears what in the status screen (C): the **Estado** page and the **Ánimas** page (Q / E
  or L / R turn the pages) show each member's vitals plate (round face, PV and Secundaria as two
  waves) and a pill per ánima, and what the ánima changes and grants. Gerard wears the newest
  unlocked ánima until told otherwise. With a second player each player opens their own half of
  the status screen (Gerard left, Aitor right), dresses only their own character, and sees the
  keys of their own device.
- **In a fight**, each fighter's dock has their vitals plate and the ánima pills, flanked by the
  L and R keys (Q / E on the keyboard). On your own turn L / R or a click on a pill swaps the
  ánima: free, the turn stays theirs, PV and Secundaria keep what is left. The menu sweeps, the
  face on the plate and the 3D fighter light up in the ánima's colour, the dock takes its theme,
  and the skills (also an open skill sheet) change at once. The choice stays on after the fight.
  Bernat's dock has no pills. With a second player on Aitor the fight splits: Gerard's dock bottom
  left, Aitor's bottom right, each in their own ánima's colours and their own device's keys.
- Who wears what is a choice that changes back and forth, so it is kept in the browser, not in
  the saved story flags.

## How it is built

- `src/stats.ts`: stats, profiles and the three formulas. Pure.
- `src/battle.ts`: fighters carry stats, a profile and a class; `createBattle` takes the party
  (`story.battleParty`) and lines it up by Velocidad; `CLASS_STATS` and `SKILLS` (with `class`
  skills, and the party boost Análisis Parálisis, `state.boost`).
- `src/party.ts`: who drives whom (`partnerDriven`, `battleDriver`, `waitingForPlayer2`). Pure.
- `src/story.ts`: `partner` (Bernat or Aitor), `party` with profiles and classes, `classes`,
  `wear` and `loadout`.
- `src/controller-ui.ts`: reads the second controller as player 2.
- `src/game.ts`: a partner per chapter (Bernat, Aitor) who follows or, for Aitor, walks on his
  own collider; the tether ring; the shared camera; Aitor's battle model.
- `src/battle-ui.ts`: whose turn it is, and only that player's input counts; the docks (one
  alone, two split) and the ánima switch. `changeAnima` in `src/battle.ts` is the rule.
- `src/vitals.ts`: the face and the PV / Secundaria waves shared by fights and the status screen,
  and the light when an ánima changes.
- `src/exploration-ui.ts`: the status screen, split in two halves when player 2 is there.
- Tests: `tests/party.test.mjs`, `tests/battle.test.mjs`. Screenshots: `just screenshots duo` (fakes
  two controllers) and `just screenshots battle-solo` (the debug mode).

## Open questions

- Should Aitor get an ánima of his own later (one that Gerard can then borrow)?
- Bernat is still on autopilot-by-player-1 in chapter 1's fights; if chapter 1 is ever played by
  two, he could be player 2's.
- In release, a single player with no second controller cannot finish Aitor's turn. That is
  intended (the game is for two from chapter 2), but a menu option may be kinder.
