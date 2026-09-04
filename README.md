# Gerard 35

A small browser game for Gerard's 35th birthday. Runs entirely in the browser, no install needed.

Built with [PlayCanvas](https://playcanvas.com/) (engine only, via npm), [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vite.dev/).

## Getting started

Requires Node 22+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Click or tap the cube, or press Space, to score.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server with hot reload          |
| `npm run build`     | Type-check and build a production bundle      |
| `npm run preview`   | Serve the production bundle locally           |
| `npm run typecheck` | Run the TypeScript compiler without emitting  |

## Project layout

```
index.html          Entry page with the canvas and a tiny HTML HUD
src/main.ts         Bootstraps the game and wires the HUD
src/game.ts         PlayCanvas scene: camera, light, cube, input, update loop
src/style.css       Fullscreen canvas and HUD styling
vite.config.ts      Vite config (relative base so it works on GitHub Pages)
.github/workflows   Builds and deploys to GitHub Pages on push to main
```

## Deployment

Every push to `main` builds the site and deploys it to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: in the repo settings go to
**Pages** and set the source to **GitHub Actions**.

The game will then be live at https://aitirga.github.io/gerard-35/

## Why this stack?

- **PlayCanvas engine** gives a real 3D/2D scene graph, physics-ready entities, input
  handling and asset pipeline, but is consumed as a plain npm library so there is no
  editor lock-in and the whole game is just code in this repo.
- **TypeScript** keeps the game logic honest as it grows.
- **Vite** gives instant dev reloads and a static build that hosts anywhere.

Alternatives considered: Phaser (great for pure 2D, less flexible if we want 3D),
Three.js (lower level, more boilerplate for a game loop), Babylon.js (heavier bundle).
