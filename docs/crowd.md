# Crowd: nobody walks through anybody

Everyone on the street keeps a little room round them. This includes Gerard, Aitor, Bernat, Haru
and Yuki, Uri's fears in the tower, Nuria at her door and the street dogs. When two of them overlap,
they ease apart: the one that gives way more moves further, at most `PUSH_SPEED` cells a second, so
it reads as a step aside and never as a jump. Nobody is pushed into a wall; a body slides along it
instead.

`src/crowd.ts` is pure and tested (`tests/crowd.test.mjs`). The game wires it in one place,
`src/game.ts` beside `createCrowd()`, and calls `crowd.separate` once a frame before anyone moves on.

## Kinds of body

| Kind | Who | Radius (cells) | Gives way | Notes |
|---|---|---|---|---|
| `player` | Gerard; Aitor when player 2 drives him | .34 | never | Only their own input moves them. |
| `person` | Aitor following, Bernat | .34 | 1 | |
| `cat` | Haru and Yuki walking, leading or at home | .28 | 1.6 | The first to step aside. |
| `monster` | Fears hunting the tower | .42 | .35 | Passes through players, so it can still reach Gerard and start its fight. |
| `figure` | Story NPCs on their cell, the street dogs | .36 | never | Others go round them. |

Two bodies that never give way (two players, or a player and a figure) are left alone. Players
already collide with occupied cells.

## Making something keep its distance

Anything with a `position` in cells can take part: a `Follower`, a `Guide`, a `Wanderer`, a
`Chaser`, a `FreeMovement` (read only), or a small adapter such as `{ position: npc.cell }`. Add one
line next to the others in `src/game.ts`, with a function that lists who is there right now:

```ts
crowd.add(BODIES.cat, () => homeCats.map(h => h.walk));
```

The list is asked for again every frame, so whoever comes and goes (a scene change, a fear beaten,
Haru going on ahead) needs no other bookkeeping. `add` returns a function that takes the kind out
again. For a new kind, add an entry to `BODIES`: its radius, how much it gives way, and the kinds it
`passes` through.

Someone the crowd moves aside takes a step rather than sliding: `crowd.separate` returns how far it
moved each body, and the game counts that as walking (Aitor's and Bernat's legs, a sitting cat
getting up). Cats' legs already follow their own movement (`src/cat-gait.ts`).

Fights are staged by the battle scene, so they do not use the crowd.
