# Bernat · (working title)

Status: designed (round 5), being built · Last updated: 2026-11-19

## Summary

<Two or three sentences once it converges: who, what popped, what Gerard does.>

**Round 4 (Aitor, 2026-11-19): the confidant.** Bernat's part is not a friend's mission like the
others: **no ánima, and Jessica is left out**. He is the confidant who **realises that all this is
the game he made up as a kid**, and who knows (how, still open) that **what can beat her is at home,
in the physical world**: the artilugio. Through him the game **breaks the fourth wall**. He is met at
**El Nucli** (`docs/places/nucli.md`, his seat at the back room's round table), and after the first
fall at the Queen he calls and the portal there sends the artilugio to the real flat
(`docs/story-outline.md` § From the salón de juegos to the real flat). Where the lines below speak
of Jessica, his ánima or a boss, round 4 replaces them.

## Round 5 (Aitor, 2026-11-19): the game knows it is a game

**Decided.**

- **The Queen is sensitive to music**, for a reason nobody gives, and it already shows during the
  game before Bernat says it (to seed: places and fights where a song makes her minions falter, her
  castle's song haunted, La Voz). Bernat puts it into words.
- **Bernat realises he is living inside a game**, and says so to Gerard and Aitor plainly; at that
  moment the three of them look at the camera, at the player. The fourth wall breaks once, here.
  To beat her **the game has to be controlled from outside**: the artilugio is the way to use her
  sensitivity to music from the real world and reach into the game.
- **A first visit, as the confidant** (before the first fall at the Queen): with the Sants ticket,
  Bernat waits at his table at the back of El Nucli. He recognises the castle as the one in his
  childhood notebook, is worried, and does not know where Nuria Mendoza is (the false lead). A
  conversation, no fight. Flag `bernat-nucli`.
- **After the first fall he calls** (flag `bernat-llama`) and they meet at El Nucli again. There he
  says it is a game, and opens the portal: through it, the Meridiana flat.
- **The portal's puzzle: colours of light that mix.** Bernat's notebook page draws a sum of lamps
  of the flat, a little diagram: *the moon = the table in red + the kitchen in green*. The answer
  is to set the moon (the `luna` lamp, real and in the game) to the colour that results, and hold
  it: after 5 s on a colour the whole house blinks green (right) or red (wrong). The other lamps
  of the sum are lit by the game in their colours. Four levels:
  1. a sum (red + green = yellow);
  2. a subtraction (white − red = cyan);
  3. a harder sum with a subtraction (yellow + cyan − green = magenta);
  4. the three primaries at once (red + green + blue = white).
- **Then the performance**: every lamp goes off, one after another, while a pink, Bubbaloo light
  comes on in the room where the artilugio is hidden (Gerard and Aitor's bedroom), and the
  artilugio, awake for the first time, beeps random notes of its scale until it is found. Flag
  `portal-nucli`, which brings `artilugio`.
- **Bernat has no ánima and no fight**, and Jessica is left out (round 4).
- **Built (2026-11-19)**: `src/friends/bernat.ts` (lines, places, the sums and their rule),
  `src/portal-ui.ts` (the notebook page, the moon's dial, the five-second hold, the performance),
  the call in `src/castle-story.ts`, the look at the camera (`stare`, `src/game.ts`), the real flat
  following the game's while the box is open (`portal` in `src/home-lights.ts`), and the board
  beeping random notes of its scale (`firmware/artilugio`). Picker: the arc *Bernat* (`bernat-nucli`)
  and the castle's steps `bernat-llama`, `bernat-juego`, `portal-nucli`. Still a stand-in: his figure
  (`BERNAT_STANDIN`), until `just character-3d bernat`. The colours of the four sums are a proposal.

## Protagonist

- Who: **Bernat**, Gerard's best friend and neighbour on Passatge Maresme as a kid (chapter 1).
  As a boy he designs games in a notebook, and **La Reina Bubbaloo is his invention**
  (`docs/lore.md`). In chapter 2 he is 35 too.
- Relation to Gerard and Aitor: Gerard's best friend since childhood; with Aitor: _open_
- Life now: **a father too**: his daughter **Leia**, about **3 years old**. His wife is
  **Jessica**. **Lives outside Barcelona** (where: _open_).
- Job and routine: very into **board games**: he has **published a few** as a designer, **beside
  another job** (which: _open_). Titles of his published games: _open_
- Looks: **heavy-set, a bit of a geek look**.
- Unmistakably them (phrase, habit, hobby): board games (playing and designing them); a phrase
  or habit: _open_
- As a kid: designed games in a notebook (chapter 1), so the adult who publishes board games is
  the same boy grown up; anything else real: _open_
- **What he remembers of the Queen** (decided, option B): he **remembers the castle of La Reina
  Bubbaloo** and is **very worried**. He does not understand what is happening and cannot stop
  thinking about it. He does not know who or what she is. He is one of those who say **they do
  not know where Nuria Mendoza is** (the false lead, `docs/story-outline.md`).
- **He seems immune** to the Queen's influence, because he is her creator (decided; story
  decision for `docs/lore.md`).

## Place

- Where: **a board-game bar in Barcelona**, a bit hidden, where they meet *de estrangis*
  (on the quiet). Bernat comes in from outside the city. Which bar (real or invented), and in
  which district: _open_
- Tone: the mission has a **spy** feel. People around are under the Queen's influence and do
  strange things at random, so Gerard and Bernat meet where nobody is watching.
- How they meet: **Gerard calls him on the phone** and they agree on a place (decided). How the
  call is triggered and taught: _open_ (topic 4).
- **Bernat calls too** (Aitor, 2026-11-15): after Gerard and Aitor fall at the Queen the first
  time (she takes Aitor), Bernat phones them and asks to meet at **the salón de juegos**, where
  the mission for the device is played (`docs/story-outline.md` § The end, in order). Whether
  that is this mission or another one of his: _open_.
- How to get there: _open_
- Scene: _open_

## The problem

- **Jessica**, Bernat's wife, **se ha vuelto loca**: the Queen has taken hold of her (decided).
  What exactly she does, and what it has to do with Leia: _open_
- What the bubble popped: _open_
- How they are lost without it: _open_
- Routine vs. ilusión, here: _open_

## Clues

| Clue | Where | Flag |
| --- | --- | --- |

## Unusual things

-

## Beats

1. Arrival:
2.
3. Boss:
4. The ánima leaves them:

- Own mechanic, and how it is taught:
- Diegetic gates:
- Aitor's moments:
- Hours spent:

## Final boss

- Who / what, look:
- Gimmick and phases:
- How the friend helps:
- What the party's ánimas do against it:
- Code: `Encounter` `<id>`, `FoeKind` `<kind>`

## Ánima

- Name, colour (grey → <colour> in the second round):
- Party bonus (`ANIMAS`):
- Brings: wearable ánima / single skill
- Look, motto, interface theme:
- Skills (name · cost · power · description in the AGENTS.md shape):
- World key it opens:

## Second round

-

## Assets

| Who / what | Photos | Description | Portrait | Expressions | 3D | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- |
| Bernat (35) | — | — | — | — | — (only `bernat-child.json`, a placeholder) | `bernat` exists (child, no portrait) |

Commands:

```bash
```

## Open

- **Story decision (`docs/lore.md`)**: Bernat invented La Reina Bubbaloo and, as an adult,
  remembers her castle and is worried (decided). To add to `docs/lore.md` once the mission
  converges. He must not know or hint who she really is.
- The phone call: a new interaction (Gerard's mobile). First phone in the game; it must stay a
  person-to-person call, never a list of contacts that works as a quest log.

## Implementation plan

<Written in the converge step.>
