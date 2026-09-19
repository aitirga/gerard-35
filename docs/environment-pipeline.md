# Reference-driven environments

This prototype reconstructs the main visual features of the user's Apple Maps
screenshots and a read-only inspection of **Passatge Maresme, 20, Sant Quirze del
Vallès** in Apple Maps. The user corrected the original reference pin (24) to
20 and asked us to treat the house directly opposite as Bernat's. Maps labels
the street **Passatge**, rather than Passeig.

The layout is an approximate, deliberately compressed game blockout. It is not
a survey, a cadastral footprint, an exact facade reconstruction or a verified
identification of Bernat's actual address. The playable slice has seven plots
on each side, a widened end, pitched grey roofs, white walls, solar panels,
terracotta front patios, private gardens/pools, trees and parked cars. Only
Gerard's garden is entered; the other east-side plots remain closed.

## What is actually integrated

- `src/environments.ts`: typed footprints, collision grid, props, spawns and
  door interaction anchors. Local coordinates are game cells, not metres.
- `src/scenery.ts`: visual builder; it turns this data into original PlayCanvas
  geometry and procedural textures. No Apple map screenshots, downloaded map
  tiles or extracted Flyover meshes are bundled or requested by the game.
- `src/movement.ts`: generic cell movement that accepts any grid. Scene changes
  reset interpolation and preserve the session step counter.
- `src/dialogue.ts`: conversation banner. `SPEAKERS` holds each character's
  name and palette (the avatar is drawn from it); a `Dialogue` is a left
  speaker, an optional right listener and a list of lines. Looks live in the
  `#dialogue` custom properties in `src/style.css`.
- `src/game.ts`: scene lifecycle, following/overview cameras, controls and the
  three interactions. Old scene resources are destroyed on a transition.
- `just export-environments`: exports the three scene descriptions as JSON in
  `output/environments/` for inspection or future editors. JSON import and GLB
  loading are **not** implemented yet.

Choose Maresme or the original courtyard in the environment selector. Press R
or “Vista general” for the whole street; moving resumes the following camera.
Walk through number 20's front gate, approach the door and press E/Enter/Space
or controller A (standard mapping) to enter. The interior is an invented
placeholder. Use the same interaction at the exit to return to the front garden.
Cross the street to Bernat and ring the bell to complete the demo quest. Calling
Bernat is an in-game dialogue only, with no real-world communication. Bernat's
house cannot be entered. Touch users can tap the interaction button.

The existing backend still saves only the step counter. Scene position and
quest completion are session state, and reset on reload.

## Ways to produce the next environment

| Approach | Integration | Limits |
| --- | --- | --- |
| Reference screenshots → hand-authored footprints → reusable house/tree/car pieces | Implemented here; fastest to adjust layout and gameplay | Approximate architecture; requires visual judgement |
| Paint or upscale a fixed isometric background, then overlay the grid and player | Feasible alternative for a fixed camera | Image pixels do not supply depth, unseen facades, collision, interiors or correct dynamic shadows; requires separate masks and geometry |
| Build detailed assets in Blender and export GLB | Can replace the visual builder while retaining grid, doors and quests | Requires modelling and alignment; GLB loading needs to be added |
| Reconstruct from your own overlapping photos/photogrammetry | Can eventually provide detailed GLB assets | Requires suitable captures, cleanup, smaller textures, collision meshes and independently modelled interiors |

Apple's documented web offerings are [MapKit JS](https://developer.apple.com/documentation/mapkitjs/)
for embedded maps and [Maps Web Snapshots](https://developer.apple.com/documentation/snapshots/)
for map images. These are not a documented GLB export pipeline in the material
reviewed for this prototype. Direct extraction of Apple's 3D city assets is not
implemented or assumed. PlayCanvas supports [GLB model assets](https://developer.playcanvas.com/user-manual/assets/models/exporting/),
so a model produced through your own asset pipeline has a clear integration path.

Upscaling can make a reference easier to read, but generated details should not
be treated as evidence of the real building. Better facade photos and a rough
floor plan would improve recognizable details more than increasing screenshot
resolution alone.

## Validation

`just check` includes movement tests, backend tests, and environment tests for:
rectangular maps, valid spawns, connected walkable areas, reachable doors, solid
building footprints, car/tree collisions, proximity checks and safe transitions.
Browser verification covers entering/exiting Gerard's house, walking across the
street, Bernat's quest, and switching between environments.
