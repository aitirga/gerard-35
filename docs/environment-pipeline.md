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
- `src/props.ts`: the reusable prop kit (trees, cars, streetlamps, manholes).
  See [Reusable props](#reusable-props).
- `src/movement.ts`: generic cell movement that accepts any grid. Scene changes
  reset interpolation and preserve the session step counter.
- `src/dialogue.ts`: conversation banner. `SPEAKERS` holds each character's
  name and palette (the avatar is drawn from it); a `Dialogue` is a left
  speaker, an optional right listener and a list of lines. Looks live in the
  `#dialogue` custom properties in `src/style.css`.
- `src/home-scenery.ts`: Gerard's house from the family sketch. Plans, rooms and
  stairs in `src/environments.ts` become walls, floors, steps and furniture;
  walls fold away while they hide Gerard.
- `src/game.ts`: scene lifecycle, following/overview cameras, controls and the
  interactions: doors and stairs travel (`to`), things to look at speak (`lines`).
  Old scene resources are destroyed on a transition.
- `just export-environments`: exports every scene description as JSON in
  `output/environments/` for inspection or future editors. JSON import and GLB
  loading are **not** implemented yet.

Choose Maresme or the original courtyard in the environment selector. Press R
or “Vista general” for the whole street; moving resumes the following camera.
Walk through number 20's front gate, approach the door and press E/Enter/Space
or controller A (standard mapping) to enter the open-air entrance of the house.
Its layout follows the family's hand-drawn plan: entrance, floor 1 and floor 2,
joined by doors and stairs. Use the street door to return to the front garden.
Cross the street to Bernat and ring the bell to complete the demo quest. Calling
Bernat is an in-game dialogue only, with no real-world communication. Bernat's
house cannot be entered. Touch users can tap the interaction button.

The existing backend still saves only the step counter. Scene position and
quest completion are session state, and reset on reload.

## Reusable props

A prop is one entry in an environment's `props` list, anchored on a cell:

```ts
{ kind: 'tree', x: 10, z: 9 }                                   // street plane tree in a pit
{ kind: 'tree', x: 23, z: 13, species: 'cypress', base: 'ground' }
{ kind: 'tree', x: 1, z: 1, species: 'olive', scale: 0.6, base: 'pot' }
{ kind: 'car', x: 12, z: 9, color: '#b95641' }                  // spans x,z and x,z+1
{ kind: 'lamp', x: 21, z: 11 }
{ kind: 'manhole', x: 14, z: 13 }                               // flat, stays walkable
```

- Collision is defined once, in `PROP_FOOTPRINTS`. `blockProps(grid, props)`
  marks those cells solid, so generated maps and hand-drawn grids (courtyard,
  interior) use the same rule. Tests check that every prop blocks exactly its
  footprint and never covers a spawn or door.
- `scenery.ts` places every prop of every environment through
  `createPropKit().place(prop, parent, position)`. The kit owns its materials,
  so another scene can create its own kit, place props under any root and
  call `destroy()` when it is done.
- Trees are `plane` (street), `olive` (garden) or `cypress` (tall and slim),
  standing in a `pit`, a `pot` or on bare `ground`. Size, rotation and crown
  lobes vary with the anchor, so each tree differs but is the same on every
  reload.
- `update(dt, animate, focus, toCamera)` makes the trees sway, and fades any
  crown between the player and the camera, so the player never walks
  out of sight behind a tree.

To add a new kind of prop, add it to the `WorldProp` union and
`PROP_FOOTPRINTS`, then add a builder in `props.ts`.

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
