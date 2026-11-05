# Game ideas

Ideas Aitor wants in the game, not designed or built yet. Each one says what is decided and what is
still open; when one is designed it moves to its own doc and leaves a link here.

## Ecos de luz: spend them to improve the ánimas (2026-11-05)

**Decided (Aitor):**

- The currency the party collects is called **Ecos de luz** (one *eco de luz*). It replaces the
  word "ánimas" for that counter, which clashed with the ánimas worn in a fight (Matemágico,
  Papagato…). Ánima stays the name of what Gerard and Aitor wear.
- **Where they come from**: every person helped gives one (the lights that go into Gerard and
  Aitor, `docs/quests/nuria.md` § The lights), and **every final boss drops one** too (Vertitrón,
  and each mission's and chapter's last fear).
- **A total in the inventory**: how many the party has, the same count the chip beside the menus'
  buttons shows (`.anima-count`, `storyUI.animas` in `src/story-ui.ts`, already labelled *ecos de
  luz*).
- **What they buy: improvements to an ánima**, for instance:
  - **more maná** for that ánima (its pool goes from 3 to 4…, `MANA_POINTS` in `src/battle.ts`,
    `docs/action-points.md`);
  - **unlocking its *ulti***, its strongest move.
- **Optional**: nothing in the story needs them; a player who never spends one can finish the game.
- **Never everything**: the whole game gives fewer Ecos de luz than all the improvements cost, so
  the player chooses which ánimas to push and none reaches 100 % by collecting alone.

**Open:**

- Where they are spent: the jar at home (`docs/chapter-2.md`), a person, the status screen's
  ánimas page.
- What happens to *Usar una luz* (an eco let out of the jar holds the Queen back a day): kept as a
  third thing to spend them on (then each eco is a choice: a day or an improvement), or dropped.
- The price list: how much more maná costs, how much an ulti costs, whether a second step costs
  more; how many Ecos de luz the whole game gives (people helped + final bosses) against the total
  cost, so the "never everything" rule holds (`just fight-sim` for what more maná does to fights).
- Each ánima's ulti: what it is (to design per ánima, `docs/animas/`, following the skill
  description shape in AGENTS.md), and whether it costs maná or has its own rule (once per fight…).
- Whether a boss's eco is a light like the people's (does it fly into Gerard and Aitor, go into the
  jar?) or its own picture.
- The player-facing name in the jar's own lines (today *"Usar una luz"*, *"Mirar las luces"*).
