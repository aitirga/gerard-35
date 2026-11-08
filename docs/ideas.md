# Game ideas

Ideas Aitor wants in the game, not designed or built yet. Each one says what is decided and what is
still open; when one is designed it moves to its own doc and leaves a link here.

## Ecos de luz: what is still open (2026-11-05)

Designed and built: `docs/animas/README.md` § Ecos de luz. What is still open:

- **Every final boss drops one** (decided, not built): Vertitrón, and each mission's and chapter's
  last fear. Whether a boss's eco is a light like the people's (does it fly into Gerard and Aitor,
  go into the jar?) or its own picture.
- How many Ecos de luz the whole game gives (people helped + final bosses) against the total cost,
  so the "never everything" rule holds.
- Each ánima's passive and ulti (today places kept, asleep, at the jar): what they are, to design
  per ánima (`docs/animas/`, following the skill description shape in AGENTS.md), and whether the
  ulti costs maná or has its own rule (once per fight…).
- More elements for Atacar (Frío, Viento) once something wets or poisons a foe: `REACTIONS` in
  `src/status-fx.ts` has the rest of the combat design's table.

## Calling home through a portal (2026-11-05)

**Decided (Aitor), for later:** a little further into the game they gain the power to call up home
and open a portal to it, to get ready: reassign their Ecos de luz at the jar without walking back.
Today the jar can only be reached by being in the flat.


## Growing an ánima by giving it things (2026-11-07)

**Noted (Aitor), not designed:** ánimas could also improve by having things assigned to them, not only
by EXP from fights (`docs/animas/README.md` § Levels).

- Assigning something to an ánima might teach it a new spell.
- Levelling an ánima up might also give lights (Ecos de luz) or some other reward, besides the skill
  the level already teaches.
- Using the same skill again and again might make it grow too.
- Some way in might unlock a special, secret skill, found by surprise, not shown beforehand.

Open: what "things" are (Ecos de luz, gear, objects from missions…) and where they are assigned (the
jar?); how this sits with EXP levels and the "never everything" rule; whether the secret skill is
`abstract: true`.
