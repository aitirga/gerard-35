# A cop de diapasó · (working title)

Status: designing (round 7) · Last updated: 2026-11-19

**Decided** means the user said so. **Proposal** means it came from the design side and is waiting
for a yes. This doc is the choir as a place; Emilie's mission gets its own, `docs/quests/emilie.md`.

## Summary

_To write once it converges._

## Protagonist

- **The choir** (decided, real): **A cop de diapasó**, a choir Gerard and Aitor are part of. It
  gathers friends who are not in the game yet:
  - **Emilie**: Aitor's friend first, now very much both of theirs; **very clever**. Already listed
    in `docs/story-outline.md` as an idea: **Poble Sec**, *helps with a technical problem*.
  - **Marta Tarrés** (not Aitor's best friend from Alegia, `docs/quests/marta.md`; the surname tells
    them apart, decided round 7): **sings contralto**; a **geologist** who works on **ocean
    sediments** (decided round 6, real).
  - **Ferran** (decided round 6, real): **Marta's partner**, a **geologist** too. He does not really
    sing; **he likes video games**. In the game **he sings bass, badly** (decided round 7): a
    wink, never a joke character.
  - **Darío** (decided round 6, real): a **physicist**, **a teacher** now (like Gerard); **sings
    bass** (decided round 7).
  - **Marta, Ferran and Darío are always in the room** (decided round 6): the choir's regulars, there
    from the first rehearsal on. Emilie is the one missing.
  - A circle of scientists: Emilie and Aitor in hydrogeology, Marta and Ferran in geology, Darío in
    physics. Proposal: their remarks (and the AI's clue lines) speak their trades' language, which
    also points softly at Emilie's water.
- **Aitor directs it, Gerard sings in it** (decided round 3, real). Where and when it rehearses: _open_
- The user's doubt (round 1): use the choir as a mission and repeat the musical side (Marta's
  mission already owns timing to notes, La Voz's *Coro*, Sincopante's eco), give Emilie a mission
  of her own, or make the choir a different dynamic in the game.

## Direction (decided round 2)

**The choir is a place and a system, not a mission; Emilie gets a mission of her own** (to design
in `docs/quests/emilie.md`, after this). Decided by the user:

- The choir is the game's **meeting point**, somewhere **near home, on the Meridiana**.
- **Everyone the party saves goes there, "for some strange reason"**: the friends' endings change
  to send them there.
- It doubles as the game's **safe zone**. "No me disgusta pero hay que planearlo bien."
- **They gather by voices**, or something like it: to think through.

Discarded: the whole choir as one mission (a second musical mission after Marta's).

## The choir room (round 3)

- **Who runs it** (decided round 3, real): **Aitor directs the choir**; **Gerard sings in it**. In
  the game Aitor stands at the front with the tuning fork, and Gerard takes his chair in a row.
- **Gerard and Aitor send them there** (decided 2026-11-19, replaces round 3's *no strange
  reason*): at the end of every ánima mission, before the light goes, Aitor names the choir and
  where it is, *A cop de diapasó*, on the Meridiana next to home, and Gerard asks them to go there
  whatever happens and to always remember it. That is why, every new morning after they are
  saved, the people helped turn up there. **Built**: `coro` in each friend's lines
  (`src/friends/*.ts`), said right after the mission's `home` (`src/story.ts`); every mission
  shares Gerard's core line, «Pase lo que pase, venid allí. Acordaos siempre.» (in the singular
  for one friend), and each answer is the friend's own (`tests/coro.test.mjs`). Nobody explains
  why, Gerard least of all. (Round 2's tuning-fork A as the reason stays dropped.)
- **Why the Queen leaves it alone** (proposal): the weekly rehearsal is the one adult routine that
  already is ilusión: grown-ups meeting every week to sing because they like it. She has nothing to
  pop there. A soft plant for *Is the Queen good?* (`docs/lore.md`): what she respects is exactly
  what she wants for everyone. Never said aloud.
- **The endings, changed little** (decided 2026-11-19): no mission's ending is rewritten; each only
  gains the choir lines above at its close. The next time the party walks into the choir room, the
  people they helped are there. Proposal: each has one line on arriving and a short one after.
- **Ensayar** (decided round 3): an activity at the choir, with hours spent like the piano at
  home, that leaves **very subtle clues** to a side mission or something to do. Proposal for how:
  - Aitor gives the A with the tuning fork, the choir sings a stretch, stops, goes again. In the
    pause someone says something in passing: a remark about somebody, a place, a thing they saw.
    Never a direction, never «tienes que ir a»: the player has to put it together.
    *(Example, to rewrite with real details: «Hoy tampoco ha venido Emilie. Ella, que nunca
    falta.»)*
  - One remark a rehearsal, picked from the clues not yet seen.
  - **The price is time** (decided round 7): **any clue in the game** can come out, but rehearsing
    spends the day's hours and the Queen's power grows meanwhile (`docs/chapter-2.md` § The Queen's
    advance), so leaning on the choir makes the game harder. Proposal: 3 hours, more than the piano
    at home (2).
- **They learn the opening song** (decided round 3: «como si aprendieran la canción de inicio»):
  the piece the choir rehearses is the game's opening song. Proposal: Passatge Maresme's theme
  (`triste` in `src/music.ts`, where the game starts). **They learn it bit by bit**: each rehearsal
  (or each person who comes back) takes it a phrase further, stumbling at first. Progress heard,
  never counted. A cutscene, not a minigame: no timing, nothing scored (Marta's mission owns
  timing).
- **By voices** (round 3: maybe, Aitor will say whether there is time): four rows of chairs,
  sopranos, contraltos, tenores, bajos; each person helped sits in their voice and that voice
  joins the song. **Without it**, the song grows by phrases alone, and the room fills with
  people anywhere.
- **Emilie's mission starts here** (decided round 3): the player finds out at the choir, when
  they discover she is missing. Her mission: `docs/quests/emilie.md`, to design after this.
- **Not the jar** (proposal): the jar at home holds the lights (power: Ecos de luz). The choir
  holds the people. Neither counts on screen.
- **Safe zone** (decided as a direction round 2; what it gives, proposal): the pink never comes
  in, even when the Meridiana outside is pink; inside, the party is healed.
- **Where** (decided round 5): **invented**. The real choir rehearses at Gerard and Aitor's home and
  they always talk about finding a room of their own: in the game **they have it at last**, a
  ground-floor room on the Meridiana near home. Proposal: on the odd side between the metro stair
  and home's door, so every way home passes it; at night its window lit with people behind it.
- **What it was** (decided round 6): **a workshop with a metal shutter** that the choir has painted
  themselves, with *A cop de diapasó* written by hand.
- **Their logo** (real, from the choir's Instagram, `@acopdediapaso`; reference in
  `assets/references/environments/coro/instagram-icon.jpg`, local): **a tuning fork drawn as a
  glowing cyan neon line on dark petrol blue**. Proposal: painted on the shutter, and inside as a
  real neon sign, the room's *one detail found only there*.
- **Careful with the palette** (`docs/visual-style.md`): dark petrol blue-green `#1b3844` is Las
  cuerdas' dominant. The logo keeps its own colours, but only on the logo; the room's dominant
  must be something else. Proposal: a workshop's materials (bare brick, raw concrete, the shutter's
  grey steel, mismatched chairs) under warm work lamps, with the cyan neon as the one cold accent.
  To take through the guide's checklist.
- **How it is found** (decided round 5): **Aitor says it on waking**, every morning until they have
  been, as with the university friends (`clue-uni`). Proposal for the line: the choir has just got
  its room and today is the first rehearsal there, *«¡Hoy estrenamos el local!»*; written once the
  room has its name. Flag: `clue-coro`.
- **Early in the game** (decided round 5): reachable from the first day, **in parallel with
  Cardedeu**. So Emilie's mission (which starts at the first rehearsal, when she is missing) is
  early too: its fights are met with the starting party and at most Papagato (balance with
  `just fight-sim`).
- **Doom morning** (idea, not proposed yet): when the Queen covers the flat, the choir room might be
  the last place she has not reached.

## Ensayar: the clue written by an AI (decided round 4, how: proposal)

**Decided** (Aitor, round 4): while the choir rehearses, an AI runs behind the scene with the game's
progress and writes a subtle clue that helps unlock another destination.

How (proposal), following what the game already does for the dogs' turns (`ai.py`,
`/api/battle/enemy-turn`: the key stays on the server, the browser falls back to its own rule):

- **The game decides what can be hinted; the AI only says it.** The browser sends the story flags,
  the day and hour, who is in the room, and the list of **eligible clues**: hand-written true facts
  about the world (`clue-*`, as in `docs/chapter-2.md` § Hidden clues), only those whose
  destination is not yet visited. The AI picks one and writes **one line** for one person present
  to say in the pause. It cannot invent a destination, a mission or a fact.
- **Real people stay true.** Each speaker gets a short sheet with only what is decided about them
  (the docs). The AI must not add facts about a real person (`/side-quest` rule): no new jobs,
  partners, memories.
- **Subtle by rule**, in the prompt and checked after: Spanish, one or two short sentences, a remark
  in passing, never an instruction (no «tienes que», «ve a», no metro line + stop together unless
  the fact itself says so), nothing about the Queen being Nuria Mendoza or anyone, no game words
  (misión, ánima, pista, nivel).
- **Structured answer**: `{ clue: <id from the list>, speaker: <id present>, line: <text> }`
  (structured outputs, `output_config.format`). The server rejects anything off the list.
- **The game keeps the flag**: whatever the AI says, the chosen `clue-*` is set, so later lines can
  build on it, exactly as a written clue would.
- **Always a written fallback**: every eligible clue has a hand-written line. No key, no network, an
  error, a refusal or a check that fails → that line. Screenshots, tests and offline play use it.
- **Time is hidden**: the call starts as Ensayar begins and the rehearsal's first stretch plays
  meanwhile (a few seconds); the remark comes in the pause.
- **Provider** (proposal): Claude through the Anthropic SDK (already a dependency of the tools),
  `claude-opus-5-5` with low effort, with the server-side refusal fallback on; a new
  `AI_CLUE_PROVIDER` next to `AI_BATTLE_PROVIDER`, `ANTHROPIC_API_KEY` as a Fly secret.
- **Not a hint panel**: the line is a person in the room talking, said once, never written down
  anywhere afterwards (no log of what was said).

## Review (round 8: cracks found; all proposals)

1. **The AI's line and the flag.** A `clue-*` flag means Gerard saw the clue, and later lines build
   on it. If the AI's remark is too vague to carry the fact, the flag lies. The server checks that
   the line keeps the fact's key words (given with each clue); otherwise the written line is used.
2. **When no clue is left**, Ensayar must still be worth walking into: the song and a line, and it
   costs no hours then (or the regulars say there is nothing new before the hours are spent).
3. **Everyone helped standing in a small room** is up to a dozen figures (120 Hz budget) and leaves
   their own places empty. They come **to rehearse**, shown during Ensayar; between rehearsals the
   room holds the regulars.
4. **Why a rehearsal every day**: it is always 22 November (`docs/lore.md`, the day that repeats),
   so it is always rehearsal day. A line for Darío or Marta Tarrés, not an explanation.
5. **"The party is healed inside"** only matters if wounds last between fights: to check in the
   code before promising it. If they do not, the safe zone is what the pink never enters.
6. **The song needs voices recorded**: Aitor's time. Until then a placeholder (synth or hummed),
   as with Marta's notes. Which song is "la canción de inicio" is to confirm (`triste`?).

## Place

- Where: an invented ground-floor room on the Meridiana near home (§ The choir room).
- How to get there: on foot from home or from the L1 stair; no trip, no hours.
- Scene: inside the `meridiana-calle` zone (its door on the avenue) plus a small hand-designed
  interior; the interior's identity card is to write.

## The problem

- _open_

## Clues

| Clue | Where | Flag |
| --- | --- | --- |

## Unusual things

- _open_

## Beats

- _open_

## Final boss

- _open_

## Ánima

- _open_

## Second round

- _open_

## Assets

| Who / what | Kind (person, creature) | Photos it may send | `about` and `cues` | Toy image approved | 3D in game | Portrait | Expressions | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Emilie | person | _to ask_ | _open_ | — | — | — | — | — |
| Marta (the choir's) | person | _to ask_ | _open_ | — | — | — | — | — |
| Darío | person | _to ask_ | _open_ | — | — | — | — | — |
| Ferran | person | _to ask_ | _open_ | — | — | — | — | — |

## Open

- The room's interior and identity card (the palette note above).
- A phrase or habit for Marta Tarrés and Darío; photos of the three.
- Who else from the choir appears (only the named friends, or more members as unnamed singers).
- Voices: whether there is time for them; if so, each person's voice.
- Darío, and how to tell this Marta from Alegia's.
- The AI's cost per rehearsal is small but real.
- Everything marked _open_.

## Implementation plan

_Written in the converge step._
