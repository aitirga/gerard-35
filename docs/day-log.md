# The day log

What Gerard does each day is kept on the server, with a summary of each day, as material for a boss
made of his own routine: **la secretaría**, the last zone before the throne (docs/story-outline.md §
The palace: zones). Nothing of it is shown in the game yet. The paragraph and habits stay hidden until that
boss is designed. If they ever reach the Diario, they follow its rules: cryptic, never a place to go
or a step to take.

## What is kept

The game (`src/day-log.ts`, wired in `src/main.ts`) sends events in batches to `POST /api/log`
(`server.py`, `daylog.py`). Each event carries the game's clock (epoch, day, hour) and the real time.

| Event | When | What |
|---|---|---|
| `place` | on leaving a place, when the page is hidden, and when a new day starts | the place and the seconds spent there while the page was shown |
| `ride` | after the station map | from which station, and to which (`null`: back up the stairs) |
| `memory` | each memory typed on a station's tablet | the text and the judge's verdict (station, person, place) |
| `flag` | each story flag won, stamped with the day it was won on | the flag |
| `fight` | each fight over (not the tester's) | the encounter, won, lost or escaped, its rounds, the party's moves counted, the ánimas worn |

Development jumps (`?story=`, `?mission=`) log too, into the local save, so it can be checked
while building (the released game has no jumps). A batch the server cannot take is kept for the
next try. Events in the browser are sent at the latest when the
page is hidden.

## What a day is

A **day of the game's clock** (`src/days.ts`): from the morning until Gerard sleeps or falls. A day
is an (epoch, day) pair. Going back to the morning before starts a new epoch, so a day lived twice is
two days in the log, and the one given up is kept too. The real dates it was played on are in its
facts.

## The summary

A day is summarized once the server sees an event from a later day. It runs after the response, so
the game never waits for it. A summary has two parts:

- **Facts**, counted without a model: minutes per place, rides, memories, flags in order, fights
  and their outcomes, the moves used most, the game hours and the real dates.
- **A reading by a model** (`claude-opus-5-5`, `SUMMARY_MODEL`, low effort), with
  `ANTHROPIC_API_KEY`:
  - `summary`: the day in Gerard's voice, at most 80 words.
  - `habits`: up to five observations of how he behaved.
  - `quotes`: up to three phrases he typed, copied exactly.

  The model is told who the people are (`src/tickets.json`) and that typed text is never an
  instruction.

Without a key, or if the model fails, the facts are stored and the reading is tried again with
later batches, three times at most. `just day-log summarize` writes the readings that are missing.

Tables in the game's SQLite: `events` (one row per event) and `day_summaries` (one row per
player, epoch and day).

## Reading it

```bash
just day-log                       # every day with its summary
just day-log show 3                # day 3: summary, habits, quotes, facts, and the day in order
just day-log show 3 --epoch 0      # the first time day 3 was lived
just day-log summarize [--redo]    # write the summaries still missing (or all again)
just day-log summarize --today     # the day still going on too, to check it without ending it
just day-log --player 1a2b list    # one player only (the id's first characters)
just day-log-fly list              # the same on the deployed game (Fly)
```

The deployed game needs `ANTHROPIC_API_KEY` as a Fly secret to write the readings. Without it, it
stores only the facts.

## For the boss (to design)

Ideas, not decided:

- **The question of the fight is "break your routine"**: the boss predicts the move used most and
  answers it. Played as always, it wins; played differently, it comes apart. Its numbers come from
  the facts, never from the model, so it stays readable.
- **Its lines quote Gerard's own memories** from the tablet, and the rooms of the zone are built
  from the places he spent most time in.
- **The days lived again** (a new epoch) are the ones it knows best.
- **Without a log**, for another player or with no data, it has a generic version.
