# Las cuerdas

Status: built (2026-11-14) as a base to try and change. The place is `cuerdas`, Marta's dungeon
(`docs/quests/marta.md`), reached through the bubble a wrong note opens by the piano in Alegia and
from the development picker (*Las cuerdas*, group Alegia; `just dev-mission marta inside`).
Screenshots: `just screenshots marta --gpu`.

An invented place, so there is nothing real to read: the inside of a piano, or a throat. A void in
dark petrol with no ground and no horizon, crossed by taut strings of silver light. Its identity
card is in [../visual-style.md](../visual-style.md) § Las cuerdas.

## How it is built

| File | What it holds |
| --- | --- |
| [src/cuerdas.ts](../../src/cuerdas.ts) | The plan, with no PlayCanvas (the tests read it): the grid, the platforms (`entrada`, `lealtad`, `cristalino`, `directo`, `centro`), the three mazes with each piece's note, its cracks and its row, the pegs, and the rules (which pieces are there at a moment of the song, what a peg does to its row). |
| [src/song.ts](../../src/song.ts) | The song's clock: phrases, what sounds at a moment, the onsets crossed. The mazes and La Voz's fight both run on it. |
| [src/cuerdas-scene.ts](../../src/cuerdas-scene.ts) | `buildCuerdas`: the glass way and its silver edges, the strings under it gathering beneath the centre and rising beyond, the centre's rings and shaft, the lamps, the entrance bubble, the pieces (their ghosts, cracks and knots) and the pegs. `buildPiano` is Alegia's upright. |
| `src/game.ts` | `stepCuerdas`: runs the song, drops and returns the pieces, breaks a cracked piece once it is left, and puts whoever falls back at the maze's start. |
| `src/environments.ts`, `src/grading.ts`, `src/effects.ts` | The environment (`CUERDAS`), its look (`LOOKS.cuerdas`) and its air (`AIR.cuerdas`). |

## The way

South to north: the platform they arrive on, with the bubble behind them; then three times a maze
and the platform where a quality waits; then the centre, where every string meets and La Voz is.
The strings run under the way toward the centre and rise on its far side, so nothing has to say
where to go.

| Maze | What its floor does |
| --- | --- |
| *Dos notas* | Each piece is there while its note sounds and a moment either side (`EARLY`, `LATE`), so as one note gives way to the next both are up for about half a second, the time to step across; it trembles before it goes and drops after, and a faint frame stays where it will come back. `crossable` only passes a maze whose every step works setting out a little sooner or later too. |
| *Una pasada* | The same, and some pieces are cracked: they hold one crossing and break when left. The far side is a gap with only a bridge's silver frame over it; a switch (a knot with a round key) on the east side lays the bridge, and a string under the floor lights from one to the other. The switch is reached from below or from the far row, each over a cracked piece, and the far row from below over a third: up the left first and over to the switch, the far row is out of reach. A fall, or walking back out the near side, puts the cracks back and takes the bridge up. |
| *Las clavijas* | The rows do not sound when they should; a peg beside each row retunes it (interaction «Girar la clavija»). The pegs stand on a walkway down its west side, closed at the far end by a wall of dark glass so the rows are the only way across. |

Falling is not a defeat, and neither is getting stuck: walking back out onto the landing puts the
maze back as it was. Gerard, falling, teeters with his arms up, tumbles down into the void and drops back
out of the dark onto the landing before the maze, whose broken pieces are whole again.

## What is left

- Only Gerard is checked for falls: a second player or the follower walks on air.
- Her voice is a placeholder synth, one sound per note; Marta's recordings replace it.
- The mazes are a base to change by playing (`docs/quests/marta.md` § The three mazes).
- No ambience of its own (no place has one yet).
