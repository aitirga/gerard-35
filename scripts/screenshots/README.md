# Screenshot scenarios

`just screenshots <scenario>` plays a scenario from this folder in Chromium and saves numbered
PNGs plus an `index.html` gallery in `output/screenshots/<scenario>/` (ignored by git). Use it to
show progress after any visual change, or to reproduce a bug step by step. It starts its own Vite
dev server unless you pass `--url` (for example `just screenshots chapter-1 --url http://127.0.0.1:5173`
to use a running `just dev`, with or without `just backend`). Other options: `--size 1920x1080`,
`--headed` to watch it play, `--out <dir>`. On a desktop with a GPU, `--gpu` uses the native
renderer instead of software WebGL for faster captures. The private server ignores source
changes during a run so another development session cannot reset the scenario.

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
| `{ "shot": "mum", "caption": "…" }` | Saves the next numbered screenshot. | `delay` ms before it |
| `{ "until": "<js>" }` | Waits until the expression is true. | `timeout` ms (60000) |
| `{ "eval": "<js>" }` | Runs JavaScript in the page. | |
| `{ "wait": 1000 }` | Waits. | |

Prefer `teleport` and `until` over long walks and fixed waits: without a GPU the game renders a
frame or two per second, so timings that work on a laptop can be too short in CI or a container.
Give shots after an animation (panels, dialogue typing) a `delay` of about 1500 ms.

`combat-lab` opens the standalone combat simulator, captures the strategy comparison and a
seeded replay, then repeats the same seeds with higher enemy direct damage.

`morning` advances the game's update clock in 1/60 s steps between its key poses, then stops
rendering until the screenshot is saved. This keeps the bed sequence reproducible on slow GPUs.
