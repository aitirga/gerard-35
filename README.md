# Gerard 35

A small browser game for Gerard's 35th birthday. The game runs in the browser; a small Python API saves progress in SQLite.

Built with [PlayCanvas](https://playcanvas.com/) (engine only, via npm), [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vite.dev/).

## Getting started

Requires uv, Python 3.12+, Node 22+ (see `.nvmrc`) and [just](https://just.systems/) for the
recommended developer commands.

```bash
just setup
just backend # in one terminal
just dev     # in another terminal
```

Open the URL Vite prints (usually http://localhost:5173). The Maresme neighborhood opens immediately. Select the courtyard from the environment menu to return to the movement test scene. Move Gerard with W, A, S and D, a controller’s left stick or D-pad. On touch screens, use the on-screen arrows. Tap for one cell or hold to keep walking; walls block movement. Keyboard directions follow the isometric grid: W northeast, D southeast, S southwest, A northwest.

Run `just` at any time for a grouped, color-coded command menu. The most common
commands are:

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `just dev`           | Start the dev server with hot reload              |
| `just check`         | Run all project checks                            |
| `just build`         | Create a production bundle                        |
| `just preview`       | Build and inspect static assets (API requires backend)     |
| `just ci`            | Reproduce the CI build from a clean install       |
| `just deploy`        | Check, build and deploy to Fly |
| `just deploy-watch`  | Follow Fly application logs        |

The underlying npm scripts remain available when `just` is not installed:

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server with hot reload          |
| `npm run build`     | Type-check and build a production bundle      |
| `npm run preview`   | Serve the production bundle locally           |
| `npm run typecheck` | Run the TypeScript compiler without emitting  |

## Project layout

```
index.html          Welcome screen, canvas and HUD
src/main.ts         Bootstraps the game and wires the HUD
src/game.ts         Isometric courtyard, Gerard model, lights, shadows and input
src/movement.ts     Shared grid, collisions and cell-to-cell movement
src/style.css       Fullscreen canvas and HUD styling
vite.config.ts      Vite config (relative base so it works on GitHub Pages)
.github/workflows   Runs build and API tests on pushes and pull requests
server.py           Python API and production static file server
fly.toml            On-demand machine and persistent volume
```

## Deployment

Following the Fly setup in `catania-2026` and `cosecre`, with the automatic stop
configuration from `blood_on_the_clocktower`:

```bash
fly auth login
just deploy-init          # once; optional organization argument, defaults to personal
just deploy               # tests, build, remote Docker build, health check
just deploy-status
just deploy-watch         # application logs
just open-site
```

The configured app is https://gerard-35-aitirga.fly.dev/ in Frankfurt (`fra`).
The name must be available; if changing it, update `fly.toml` and the justfile variables.
First deployment provisions the `gerard_data` volume (1 GB). `--ha=false` keeps a
single machine so all requests use the same SQLite database. Do not scale to
multiple machines without adding database replication or a shared database.

Fly stops the machine when idle and starts it on the next request
(`auto_stop_machines = "stop"`, `auto_start_machines = true`,
`min_machines_running = 0`). The first visit after a stop can take a few seconds.
CPU/RAM aren't billed while stopped; persistent storage still has a cost.
See [Fly autostop/autostart](https://fly.io/docs/launch/autostop-autostart/).

Progress is stored in `/data/game.sqlite3`, surviving stops, restarts and deploys.
A one-year HttpOnly cookie identifies each browser; clearing cookies or switching
devices starts a separate game. The existing score field now records completed steps (including any score from the earlier prototype). Only this counter is persisted; Gerard returns to the neighborhood starting cell on reload. The courtyard remains playable when the API is unavailable; use the connection button to retry syncing steps from the current session.
Writes preserve the highest score, including concurrent or late requests.
Failed saves are shown in the HUD with a retry action. Unsaved progress can be
lost if the browser is closed while offline. There is no login or anti-cheat.
Volume snapshots are enabled with 14-day retention; a single machine can have
brief downtime during deploys. Local data lives in ignored `data/`.

GitHub Actions now runs checks only: Pages cannot host the persistent API.
For a full production preview locally, run `just build` and `just backend`, then
open http://127.0.0.1:8080. For frontend hot reload, run `just dev` alongside the backend.

## Why this stack?

- **PlayCanvas engine** gives a real 3D/2D scene graph, physics-ready entities, input
  handling and asset pipeline, but is consumed as a plain npm library so there is no
  editor lock-in and the whole game is just code in this repo.
- **TypeScript** keeps the game logic honest as it grows.
- **Vite** gives instant dev reloads and a static build that hosts anywhere.

Alternatives considered: Phaser (great for pure 2D, less flexible if we want 3D),
Three.js (lower level, more boilerplate for a game loop), Babylon.js (heavier bundle).

## Environments and movement

The default environment is an approximate reconstruction of Passatge Maresme,
Sant Quirze del Vallès, based on the supplied map references. Gerard lives at
number 20; Bernat is placed directly opposite as requested. Walk through Gerard’s
gate, approach the door and press **E** (or controller **A**) to enter the provisional
interior. Use the exit interaction to return. Bernat’s door triggers a demo quest
and dialogue; his house cannot be entered. The quest and current location reset
on reload; the step counter still uses the existing backend.

Press **R** or click **Vista general** to see the complete neighborhood. Movement
resumes the following camera. The environment selector also retains the original
13 × 13 courtyard. Touch devices have movement and interaction buttons.

`src/environments.ts` defines the maps, building footprints, props and interaction
anchors. `src/scenery.ts` builds their visual meshes separately from gameplay.
`src/movement.ts` accepts any scene’s collision grid, with 190 ms cell transitions,
a one-direction input buffer and a 0.3 joystick dead zone. All movement is cardinal.

- `just check`: TypeScript, movement/environment/battle tests and Python API tests.
- `just build`: production assets.
- `just run`: build and serve the full application.
- `just export-environments`: export scene descriptions to JSON for future editors.

See [the environment pipeline](docs/environment-pipeline.md) for the reconstruction
approach, limitations, and future paths using images, Blender/GLB or photogrammetry.

## Battle prototype

A random pack of **2–4 dogs** wanders the open street around the crossroads.
Approach a dog, click a dog or the pack label, or press **E** beside it to meet
the whole pack. Dogs respect obstacles and reserve both ends of their steps.
They pause during combat, dialogue, and journal panels. The camera moves into
a battle view using the current neighborhood.
Gerard fights alone initially; calling Bernat at his door adds a second ally to
subsequent encounters, using Gerard’s model with a blue jacket as a stand-in.

Choose **Atacar**, **Defender**, **Habilidades**, or **Escapar**. Habilidades first
opens the ability list with costs and effects. Select **Impulso** (28 damage,
8 Secundaria) to move focus to the enemies, or **Ánimo** (recover up to 24 HP,
8 Secundaria) to move focus to injured allies. Then select a roster card or its
matching label in the street to apply the ability. Arrows move among valid
targets; **Escape** returns to the ability list without spending a turn or energy.
Full-health and defeated allies cannot be healed. Color, name, and a ground
marker identify the selected target. Mouse, **1–4**, **Tab/arrows**,
**Enter/Space**, and **Esc** work in combat. Walking input is paused until the
result’s **Volver a la calle** button is used. All outcomes restore the street
position. Escape and defeat grant six seconds of recovery; automatic contact
rearms only after separation. Victory clears the pack for at least 14 seconds,
then a new random pack appears once Gerard is clear of its spawn area.

The rules are placeholders: attack, guard, damage/healing skills, and guaranteed escape.
Encounter HP and the provisionally named **Secundaria** bar reset each encounter;
battle progress is not persisted. Enemy groups and one or two allies use the same
turn flow, with defeated combatants skipped and each living foe acting once
per round. Solo packs have 36 HP per dog and deal 5 damage (2 against guard);
with Bernat they have 54 HP and deal 9 (3 against guard). Focused basic attacks
can win all six party/pack combinations.

- `src/encounters.ts`: random pack size, wandering, collision reservations, recovery and dog identities.
- `src/battle.ts`: isolated turn rules and encounter balance.
- `src/battle-ui.ts`: expanding menus, party/enemy bars, keyboard focus and outcomes.
- `src/battle-scene.ts`: dog, model stand-ins, formation and action feedback; replace models here.
- `src/style.css`: battle palette, responsive layouts and reduced-motion presentation.
- `just test`: movement, environment, combat, seeded wandering and Python API tests.
- `just dev-battle 4 2`: open a deterministic four-foe/two-ally fight; accepts 2–4 foes and 1–2 allies.
  With an existing dev server, open `/?battle=4&allies=2`. These parameters are ignored in production.
- `just check`: includes 240 seeded random combat simulations and 120 seeded pack walks.
  Browser checks should cover 2, 3 and 4 foes, both party sizes, targeting with mouse
  and keyboard, victory/defeat/escape, and reduced motion on desktop.

Battle presentation uses a 1.45-second continuous camera/formation entrance with
a diagonal sweep and staggered controls. Attacks approach the selected target,
hold contact, trigger HP/recoil together, and retreat before the next action.
`src/battle-motion.ts` holds the shared timing and target-distance motion. The 3D
scene resolves presentation promises so background tabs cannot run turns ahead
of the animation. Reduced-motion mode skips travel, shake, and the entry sweep.

### Adventure panels

Press **C** for Gerard's character sheet or **M** for the current local map;
press the same key again or **Escape** to return. Both are also available from
on-screen buttons. Exploration pauses while a panel is open; dialogue and combat
keep control of their own inputs. The character sheet is deliberately minimal:
portrait, location, session steps and companion status, with equipment and skills
reserved for later.

`src/exploration-ui.ts` owns the shared panel shell, shortcuts, focus handling and
panel registry. `src/world-map.ts` draws any `Environment` from its collision grid,
house footprints and numbered interactions, with no location-specific map layout.
Add locations in `src/environments.ts` to reuse the renderer. The map is an
informational local overview, not a travel menu.

The shared `--ui-*` tokens in `src/style.css` extend the combat panel's visual
language through exploration, dialogue and the journal: translucent forest-green
surfaces, warm paper/gold commands, crisp borders and restrained diagonal motion.
Keep the world visible behind panels, retain the shell when changing sections,
and respect reduced-motion preferences when adding UI.
