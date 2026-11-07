# Party, stats and two players

> Each ánima's design, levels and shared mechanics (Sangrado): `docs/animas/` (one folder per ánima).

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
  each with the fighter's face, PV (a wave) and Ánima (circles), their ánima switch and, on their
  turn, the commands, in the colours of their own ánima; the fight's backdrop stays one, Gerard's
  ánima's, across the whole screen. Each player picks their own fighter's
  moves: on Aitor's turn the keyboard and the first controller do nothing and the turn line says
  *MANDO 2*. If no second controller is connected, the turn waits and says *CONECTA EL MANDO 2*.
- **In battle the D-pad's left and right open the fight's summary** (R on the keyboard), for either
  player at any moment (docs/combat.md § Atributos arriba o abajo, y el resumen); its up and down
  and the stick walk the menus. Outside fights it walks every way.
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

The dev build never makes Aitor's turn wait for a second controller: while there is none, it
plays as `solo`, and a second controller that connects takes Aitor back. `?solo=0` waits for it,
as the release does (the `duo` screenshots use it).

## Stats

| Stat | What it does |
| --- | --- |
| **PV** | Puntos de vida. |
| **Fuerza** | Adds to physical hits (Atacar, the dogs' pushes). |
| **Magia** | Adds to magic hits (Foc Binari) and to healing. |
| **Defensa** | Takes away from physical hits. |
| **Espíritu** | Takes away from magic hits. |
| **Velocidad** | Who acts first in the party's half of the round. |

**10 is average.** Every amount has a base at average stats, and each point a stat is above or
below 10 moves it by one: a physical hit is `base + Fuerza − Defensa`, a magic hit is
`base + Magia − Espíritu`, healing is `base + Magia − 10`, never below 1. So chapter 1's boys and
dogs (all 10s) fight exactly as before the stats existed.

| Who | PV | Fue | Mag | Def | Esp | Vel |
| --- | --- | --- | --- | --- | --- | --- |
| Gerard (boy) | 100 | 10 | 10 | 10 | 10 | 10 |
| Bernat | 85 | 10 | 10 | 10 | 10 | 10 |
| Gerard (35) | 120 | 11 | 13 | 10 | 12 | 11 |
| Aitor | 135 | 13 | 10 | 12 | 11 | 10 |

Gerard at 35 thinks and talks his way through (Magia, Espíritu); Aitor is the solid one (PV,
Fuerza, Defensa).

**Ánima** is what skills spend (it replaced Secundaria on 2026-11-01, being tried;
`docs/action-points.md`). It is not a stat: every fighter who can wear ánimas starts each fight
with **5 points** (`ANIMA_POINTS`), shown as circles. A skill spends its cost in circles;
**Defender** gives 2 back (`DEFEND_CHARGE`, never over the top) besides guarding. Ánima belongs to
the fighter, so it stays when they change ánima. Bernat has none. On the vitals plate the PV wave
stays and the second wave became a row of circles labelled *ÁNIMA*: a spent one is a hollow ring
(spending pops it, Defender fills it with a glow). Skill lists, the details box and the status
screen show costs as small circles; allies' overhead plates show tiny ones. A skill the fighter
cannot pay says *Sin ánima*.

## Skills and ánimas

| Skill | Who | Cost | Base | Does |
| --- | --- | --- | --- | --- |
| Foc Binari | Whoever wears **Matemágico** | 1 | 16 magic, fire | Sets the foe on fire (Quemado, timed; again while it burns raises its level); fire melts the Queen's gum (pringue) |
| Ángulo exacto | **Matemágico**, level 2 | 1 | −3 | Defensa and Espíritu −3 on one foe for 3 rounds (a mark; not again while it lasts) |
| Zarpazo sangriento | Whoever wears **Papagato** | 1 | 16 physical | Adds two Sangrado stacks |
| Yuki se esconde | Whoever wears **Papagato** | 1 | +4 | Defensa +4 for the whole party for 3 rounds (the one it is used in included); cannot be stacked while it runs |
| Zarpazos | **Papagato**, level 2 | 2 | 7 physical, four times | Each claw takes a layer off an onion |
| Ronroneo de Yuki | **Papagato**, level 2 | 2 | 14 heal | Everyone standing; takes away every mental status (Mareo, Llorera) |
| Zarpa en la llaga | **Papagato**, level 3 | 2 | 26 physical | +4 per Sangrado stack on the target, and spends them |
| Las dos a la vez | **Papagato**, level 3 | 2 | 24 physical | Every foe, one Sangrado stack each |

Costs are in circles of Ánima.

**Duals** (`docs/animas/README.md` § Combined skills): a Matemágico skill and a Papagato skill, one
from each fighter, can become one action, *Zarpazos de fuego* (Foc Binari + Zarpazos) and *Punto
débil* (Ángulo exacto + Zarpazo sangriento). They are never listed: they happen.

**Statuses** (story fights, `STATUSES` in `src/battle.ts`; `docs/animas/README.md` § Shared
mechanics): they stack, show under the fighter's nameplate, and lose a stack at the end of each
round. **Sangrado** (up to 10) hurts at the end of every round; **Mareo** (up to 5; no foe brings it since Vertitrón replaced El Vértigo)
lowers Velocidad, Defensa and Espíritu; **Llorera** (up to 5, El Cebollón) lowers Fuerza and Magia.
**Quemado** (Foc Binari) runs on the fight's clock instead: it burns every 2 s for 10 s, and fire
again before it goes out raises it to II and III (`docs/animas/README.md` § Quemado).

**Levels** (`src/levels.ts`): fights won wearing an ánima make it grow; 3 wins give level 2 and 8
level 3, each a story flag. Only Papagato has levels so far.

Every skill comes with an ánima: whoever wears none has none. Bernat never wears one and only
attacks (Habilidad is greyed out on his turn); Aitor has skills only while he wears an ánima.
Impulso and Abrazo are out for now.

- **Ánimas belong to the party** (the code calls them classes: `ClassId`, `CLASSES`). Gerard has
  none in chapter 1 until **Matemágico** wakes in him in the palace (Magia +1, Espíritu +1; his
  own look and a gold-on-navy blueprint interface; `docs/animas/matemagico/README.md`). It is
  Matemágico at every age; at 35, in fights whoever wears it thinks out loud: two
  ghostly little birds glide round the head while light bulbs and question marks of soft light
  drift up out of it and fade (`src/thoughts.ts`). Exploring, it does not show. **Papagato**
  comes from Nuria's mission. **Tecnópata** is Aitor's own, his from chapter 2's first morning: a
  placeholder still to design (no stats, no skills, sage `#8cc6a8`). Some ánimas are one
  person's (`ANIMA_OWNERS`, `canWear` in `src/battle.ts`): Matemágico only Gerard, Tecnópata only
  Aitor; Papagato anyone but Bernat.
- **Own ánima and extras** (decided 2026-11-05): each has their **own** ánima, fixed, always
  theirs and never taken off (Matemágico Gerard's once it wakes, Tecnópata Aitor's), and **one extra
  slot** for now (`EXTRA_SLOTS` in `src/story.ts`; more may come) where they equip one of the shared
  ánimas the party has unlocked (Papagato). Equipping only says which ánimas they can use: in a
  fight they still wear **one at a time** and switch among theirs with L / R (their kit: own, then
  extras; `kitOf` in `src/story.ts` and `src/battle.ts`). Two never equip the same extra: one the
  other has equipped cannot be equipped until they take it off. Equipping one puts it on; the one
  worn dresses them and their interface (the extra if they wear it, their own otherwise). Wearing
  one adds its stats and its skills. An ánima's colour and look come
  with it (`colour` and `scarf` in `CLASSES`).
- Pick in the status screen (C). The **Estado** page has a pill per ánima of their kit under each
  vitals plate: which one they wear now. The **Ánimas** page has a column for each member: their
  own (**PROPIA**, *Siempre suya*) apart from their **EXTRA** slot (*0 / 1*), with the shared
  ánimas they could equip there. Every row has its colour, name and level (the ánima's, shared by
  whoever has it) with a small EXP bar, and *· PUESTA* on the one worn. The extra equipped is
  marked **EQUIPADA**; one the other has equipped says *La lleva Aitor* and is greyed out. The
  cursor on a row shows that ánima beside the lists (level, who can wear it and who has it, what it
  changes, the skills it knows); confirming an extra equips it (a sweep of its colour and the badge
  stamping in), or takes it off if it is equipped; their own only shakes. With a second player each player opens their own half of
  the status screen (Gerard left, Aitor right), dresses only their own character, and sees the
  keys of their own device.
- **In a fight**, each fighter's dock has their vitals plate and the ánima bar, flanked by the L
  and R keys (Q / E on the keyboard): one bar with a segment per ánima that never wraps (up to
  four share it, the names shrinking to fit). Each segment shows that ánima's maná as little
  circles in its colour, three to a row (up to six in two): the worn one spends it, the others keep
  theirs and get some back while they rest, so the bar says which ánima still has skills to give. On your own turn L / R or a click on a segment swaps
  the ánima: free, the turn stays theirs, PV and Ánima keep what is left. The interface changes in
  one gesture: the card and the commands (also an open skill sheet) leave to the right in a fast
  fade as the new ones, in the dock's new theme, slide in from the left (mirrored in Aitor's dock).
  The face on the plate and the 3D fighter light up in the ánima's colour. The choice stays on after the
  fight. Bernat's dock has no ánima bar. With a second player on Aitor the fight splits: Gerard's
  dock bottom left, Aitor's bottom right, each in their own ánima's colours and their own device's
  keys.
- Who wears what is a choice that changes back and forth, so it is kept in the browser, not in
  the saved story flags.

## How it is built

- `src/stats.ts`: stats, profiles and the three formulas. Pure.
- `src/battle.ts`: fighters carry stats, a profile and a class; `createBattle` takes the party
  (`story.battleParty`) and lines it up by Velocidad; `CLASS_STATS` and `SKILLS` (with `class`
  skills, Ánima points, statuses, and party boosts like Yuki se esconde, `state.boosts`).
- `src/party.ts`: who drives whom (`partnerDriven`, `battleDriver`, `waitingForPlayer2`). Pure.
- `src/story.ts`: `partner` (Bernat or Aitor), `party` with profiles and classes, `classes`,
  `wear` and `loadout`.
- `src/controller-ui.ts`: reads the second controller as player 2.
- `src/game.ts`: a partner per chapter (Bernat, Aitor) who follows or, for Aitor, walks on his
  own collider; the tether ring; the shared camera; Aitor's battle model.
- `src/battle-ui.ts`: whose turn it is, and only that player's input counts; the docks (one
  alone, two split) and the ánima switch. `changeAnima` in `src/battle.ts` is the rule.
- `src/vitals.ts`: the face, the PV wave and the Ánima circles shared by fights and the status screen,
  and the light when an ánima changes.
- `src/exploration-ui.ts`: the status screen, split in two halves when player 2 is there.
- Tests: `tests/party.test.mjs`, `tests/battle.test.mjs`. Screenshots: `just screenshots duo` (fakes
  two controllers), `just screenshots battle-solo` (the debug mode), `just screenshots combat` (the
  menu, the ánima bar and the Ánima circles) and `just screenshots matemagico`.

## Open questions

- Should Aitor get an ánima of his own later (one that Gerard can then borrow)?
- Bernat is still on autopilot-by-player-1 in chapter 1's fights; if chapter 1 is ever played by
  two, he could be player 2's.
- In release, a single player with no second controller cannot finish Aitor's turn. That is
  intended (the game is for two from chapter 2), but a menu option may be kinder.
