# Screenshot scenarios

`just screenshots <scenario>` plays a scenario from this folder in Chromium and saves numbered
PNGs plus an `index.html` gallery in `output/screenshots/<scenario>/` (ignored by git). Use it to
show progress after any visual change, or to reproduce a bug step by step. It starts its own Vite
dev server unless you pass `--url` (for example `just screenshots chapter-1 --url http://127.0.0.1:5173`
to use a running `just dev`, with or without `just backend`). Other options: `--size 1920x1080`,
`--headed` to watch it play, `--out <dir>`. The game draws only on WebGPU, and the runner passes
the flags headless Chromium needs to expose it. On a desktop with a GPU, `--gpu` uses this
machine's GPU for faster captures; without it the game draws on the SwiftShader software WebGPU
adapter (slow, but it runs anywhere). `--perf` serves PlayCanvas's profiler build instead of the debug one and lifts the
60 fps cap, for timing runs such as `gpu-perf`. Playwright's Chromium cannot decode AAC, so a scenario that plays
music (`.m4a`) needs `--chrome`, which runs the installed Google Chrome instead. The private server ignores source
changes during a run so another development session cannot reset the scenario.

The scenario can also be a path to any `.json` (`just screenshots /tmp/try.json`), for throwaway
scenarios while debugging; its output goes to `output/screenshots/<file name>/`.

**Clips.** A `record` step saves a short video of the game running: an `.mp4` (in the gallery,
looping) and a contact sheet PNG of evenly spread frames, to read the motion at a glance (useful for
agents, which can read images but not videos). The runner drives the game's own clock, each frame
exactly `1/fps` later however slowly the browser renders it, so a clip plays smoothly at its true
speed even under software rendering, and is the same on every machine apart from randomness. It needs
`ffmpeg` (`brew install ffmpeg`); `--frames` keeps each clip's JPEG frames next to it. `--scale 2`
renders at twice the pixels (the game follows the device pixel ratio up to 2), so `clip` crops of
small things, such as fighters seen from the fight camera, stay sharp.

The page errors it sees make the run fail, and a failed step saves `failure.png` and prints the
game state (scene, position, story flags, companion, Bernat's bubble). Set `SCREENSHOT_DEBUG=1` to echo the Vite server log and the
browser console.

## Writing a scenario

A scenario is `<name>.json` with a `title`, an optional `description` and a list of `steps`. Each
step is one action; extra keys are its options. JavaScript strings run in the page, where the
development build exposes `window.gerard = { game, story }`.

| Step | Does | Options |
| --- | --- | --- |
| `{ "open": "/?story=new" }` | Loads the game and waits for it. Always pass `?story=<flag>` (or `new`) so the run neither reads nor saves your progress. For standalone tools, `ready` overrides the game readiness expression. | `reducedMotion`: `no-preference` (default) or `reduce`; `ready`: JavaScript condition |
| `{ "teleport": "home-floor-1", "cell": [17, 10] }` | Moves Gerard to a scene and cell. | `settle` ms (800) |
| `{ "press": "KeyE" }` | Presses a key (Playwright names: `KeyE`, `Escape`, `Shift`…). | `times`, `gap` ms |
| `{ "hold": ["KeyS", "KeyA"], "ms": 2000 }` | Holds keys, e.g. to walk (S+A walks down the street). | `until` instead of `ms`, `timeout` |
| `{ "skipDialogue": true }` | Advances the open conversation to its end. | `settle` ms |
| `{ "shot": "mum", "caption": "…" }` | Saves the next numbered screenshot. | `delay` ms before it; `clip` `[x, y, width, height]` saves only that part of the page, for close crops |
| `{ "record": "fire", "seconds": 2, "caption": "…" }` | Saves the next numbered clip (`.mp4` + `-sheet.png`) on the game's clock. | `fps` (30); `warmup` seconds run first, uncaptured; `each`: JavaScript run before every frame, with `frame` and `frameTime` set; `keys` held throughout (walking); `clip` as for `shot`; `tiles` in the sheet (12); `app` expression (`window.gerard.game.app`) |
| `{ "until": "<js>" }` | Waits until the expression is true. | `timeout` ms (60000) |
| `{ "eval": "<js>" }` | Runs JavaScript in the page. | |
| `{ "wait": 1000 }` | Waits. | |

Prefer `teleport` and `until` over long walks and fixed waits: without a GPU the game renders a
frame or two per second, so timings that work on a laptop can be too short in CI or a container.
Give shots after an animation (panels, dialogue typing) a `delay` of about 1500 ms. To frame
something up close, `window.gerard.game.frame({ x, y, z }, height)` points the camera at it (`height`
is the ortho half-height in metres) until `frame()` gives it back.

`fight-fx` plays each preset of `effects.fightFx` (the GPU particle engine) on a dog in a real
fight as a clip; run it with `--gpu --scale 2`.

`lattice` plays the lattice presets (`ward`, `morph`, `current`, `veil`, `forge`, `shield`, `bubble`, `globe`, `orb`, and the orb with nothing see-through to compare: shapes made of
particles that hold together, docs/graphics.md "Lattices") on a dog in a real fight, each framed
close: in a fight too, `frame()` holds the camera, and `game.fighterAt(id)` says where a fighter
stands. Run it with `--gpu --scale 2`.

`fire` shows `effects.fire` at its three levels at night and by day, each up close, one fire
changing level and dying down, then in a fight: fire hits wrapping the foe they hit, a foe burning, a
real Atacar played through, and a frozen blow with effects drawn inside the dog and then in front of
it (`effects.particles.front`), mostly as clips.

`combat-lab` opens the standalone combat simulator, captures the strategy comparison and a
seeded replay, then repeats the same seeds with higher enemy direct damage.

`status-fx` puts each status on a dog in a real fight (`window.gerard.game.status`: quemado rising
from I to III, mojado, congelado, envenenado, sangrado, cegado, paralizado, mareo, llorera), then each
reaction between elements (`react`). Run it with `--gpu
--scale 2`; it frames the dog with `game.frame`.

`gpu-perf` samples frame time, CPU time per frame, GPU time and draw calls for five seconds each in
the street (following Gerard and in the overview), the palace, a fight at rest, with its foes burning
and with every fighter burning, and a fight full of effects, and
prints a table in its last shot. Run it with `just screenshots gpu-perf --gpu --perf`
(docs/graphics.md has the numbers).

`morning` advances the game's update clock in 1/60 s steps between its key poses, then stops
rendering until the screenshot is saved. This keeps the bed sequence reproducible on slow GPUs.
