# Graphics: engine, post pass and particles

How the game is drawn: the engine and why it stays, the post pass that gives the HDR look and
bloom, and the particle system used for fights, elements and each scene's air. What to build next
is at the end.

```
src/game.ts ── camera ──► src/post.ts       CameraFrame: HDR + 4× MSAA, bloom, ACES, vignette, her pink tone
            └─ effects ─► src/effects.ts    kinds (dust, sparks, fire…), battle recipes, elements, auras, scene air
                               └──────────► src/particles.ts   CPU simulation + one instanced draw
src/battle-scene.ts ─────► effects.impact / heal / anima / stamp / element …
```

Check visual changes with `just screenshots graphics` (the same five views every time: street,
palace, flat, patio, a fight) and `just screenshots particles` (each scene's air, then a fight frozen
in time while every effect, element and aura plays). `tests/particles.test.mjs` runs the real
simulation headless.

## The engine

PlayCanvas **2.23.3** (latest stable, October 2026) on **WebGL2**. It stays:

- The game is built in code (no editor): ~15k lines of TypeScript on PlayCanvas's entities,
  static batching, PCF shadows and shader chunks (the building cutaway). Moving to Three.js or
  Babylon.js would be a rewrite with nothing new on screen; Godot or Bevy web exports are heavy
  and fit badly with the HTML HUD.
- It is actively maintained (patches every week or two) and ships what a modern look needs:
  HDR post (`CameraFrame`), bloom, SSAO, depth of field, colour grading, TAA, WebGPU, compute.
- **WebGPU is not on yet.** Tried on an M1 Pro (October 2026): it runs, but every GLSL shader of
  ours fails to compile there (the building cutaway, so the street's buildings vanish, and the
  particles), it stalls longer on arrival while it builds pipelines, and it saves only about a
  fifth of the CPU per frame. Our cost is draw calls, not the API: switch when compute (GPU
  particles, indirect draws) is worth porting the chunks to WGSL.

## Performance

The cost is the CPU submitting draw calls; the GPU has room. Aim for under ~8 ms of `app.render`
per frame, so a 120 Hz screen keeps an even pace (above it, frames alternate 8 and 16 ms and walking
looks choppy). Measure on the release engine: `npm run dev` serves PlayCanvas's debug build, which is
about half as fast.

- **Batch what stands still.** Scenery parts go into the scene's group `Estático: <id>`
  (`scenery.ts`, props, geo, and the house's parts that never fold). In the Meridiana flat this took
  the draw calls from about 2,300 to 1,000.
- **A second camera draws a second scene.** The flat's TV (`src/news-tv.ts`) films a whole Rec
  Comtal set, so it films 15 pictures a second (30 while watching it up close), only while the
  screen is in view, and the set casts no shadows. Before that it was two thirds of the flat's cost.

Reference, M1 Pro, 1440×900 at 2×, walking: the flat about 5 ms of render CPU, Avinguda Meridiana
about 6 ms, Maresme and Rec Comtal 3–5 ms.

2.23 changed two typings: a render component's `type` is a union (`pc.RenderComponent['type']`, not
`string`) and `meshInstance.material` may be `null`.

## Flush faces (`src/flush-faces.ts`)

Models are built from boxes, and two parts often end in the same plane facing the same way: a
dog's leg flush with the side of its body, a skirting board flush with a wall, a tread on a step.
The depth buffer cannot tell which is in front, so the surface flickers between the two as the
camera or the model moves (z-fighting). The depth buffer itself has plenty of precision; only
faces in exactly the same plane fight.

`separateFlushFacesOnArrival(app)` (in `createGame`) fixes it for everything put under `app.root`:
once a model is built, and before its first frame and static batch, each box face lying on a
bigger one in another colour is pushed out 1.7 mm, a fraction of a pixel. A stack (wall, step,
tread) comes out in that order; the other side of a pushed part stays where it was, so nothing
opens a gap. Same-colour pairs (glasses rims) are left alone. Parts added to a model already in
the scene call `separateFlushFaces(model)` themselves: `buildCharacter` (Gerard growing up),
`wearClass` (the ánima's scarf) and the pickups.

So a new model needs nothing special: build it from boxes, flush where it reads best. Only boxes
are checked; a plane or custom mesh laid on another surface still needs its own small offset.
`tests/flush-faces.test.mjs` covers it.

## Post pass (`src/post.ts`)

The main camera renders through `pc.CameraFrame`: the scene goes to a linear HDR buffer with
4× MSAA (so the canvas itself has no antialiasing), bright pixels bloom, ACES tone-maps at the end
and a vignette darkens the corners. `LOOK` holds every number. Under La Reina Bubbaloo's light
(`setTone`) the vignette turns her pink and colours get a touch richer.

Rules that come with a linear HDR buffer:

- **Only what is brighter than white blooms** (`bloom.threshold` 1.15, linear): lamps and bulbs
  with strong emissive, her pink eyes, and particles with `intensity` over 1. Lit walls stay crisp.
- **Additive light over a lit surface reads weaker.** It used to blend on gamma-encoded colours,
  where adding to something already bright reads several times stronger; over a dark background
  nothing changes. The flat's lamp patches carry `POOL_GAIN` for it; Matemágico's thoughts, drawn
  over the fight, need nothing.
- **Clear colours go through `post.clear()`**, which linearises them; a plain sRGB clear comes out
  paler.
- For before/after comparisons, `window.gerard.game.post.enabled = false` renders straight to the
  screen (development build).

## Particles (`src/particles.ts`)

One pool of up to 6000 particles, simulated on the CPU in flat typed arrays (one array per
property) and drawn as **one instanced draw call** of camera-facing quads, whatever their kind.
The quad's look is drawn by the fragment shader: `glow`, `puff`, `spark` (a streak),
`ring`, `star`, `smoke`, `bubble`, `confetti`, `splat`, `flake`, `zap` (lightning) and `flame`. A
particle faces the camera, stretches along its motion (`velocity`) or lies flat (`ground`).
Blending is premultiplied, so covering particles (dust, gum) and glowing ones (sparks, motes) share
the draw: `additive` 0 hides what is behind, 1 only adds light. The shader uses the engine's fog,
tonemapping and gamma chunks, so particles sit in her pink haze and in the post pass like any
material.

Each step (slow frames are split into steps of at most 1/45 s), a particle:

- falls (`gravity`; negative floats), slows in the air (`drag`) and takes the scene's `wind`;
- **wanders on its own random walk**: an Ornstein–Uhlenbeck velocity (`wander` m/s, `wanderRate`
  1/s) that drifts and is pulled back towards still, so each particle has its own path;
- **rides a swirling flow field**: the curl of smooth noise, precomputed once on a tiling 16³ grid
  and sampled per particle (`flow`), so particles follow eddies and never clump;
- is pulled, swirled or lifted by **attractors** (heal spirals, whirlwinds, implosions);
- **parts around people** (`bodies`): vertical capsules for Gerard, his partner, NPCs, dogs and
  every fighter, which push particles out and drag the air along as they walk through;
- **meets the scene** (`collide`): floors baked from `scenery.groundHeight` (four samples a metre)
  and solid cells from the grid: walls 2.6 m in plans, furniture 0.8 m, street houses as tall
  as their volumes, props 1 m. Particles bounce (`bounce`, `friction`), settle on furniture tops,
  stick flat where they land (`stick`: gum, confetti, snow) or burst into something else
  (`pop` + `onLand`: drops into ripples or splats). `onDeath` does the same when a particle
  dies (bubbles popping).

`intensity` makes a kind shine past white so the post pass blooms it. Covering particles take the
scene's light (`effects` feeds ambient + part of the sun as `uLight`), glowing ones ignore it
(`glow`).

## Effects (`src/effects.ts`)

`KINDS` defines every kind as data; `createEffects` builds the recipes on top:

| Call | What it shows |
| --- | --- |
| `emit(kind, at, count, spread)` | A plain burst of one kind (footfall dust, gum, spores). |
| `impact(target, from, strength, { guarded, gum, feet })` | A blow: flash, sparks flying on through, a ring and dust at the feet; a guarded blow rings blue; gum foes spit drops that splat. |
| `heal(feet, height)` | Cardioide: light rising from a cardioid round the feet, spiralling up. |
| `insight(head)` | Análisis Parálisis: ideas circling over a head. |
| `stamp(feet)` | No-ta: a shockwave of dust and red ink spattered round the print. |
| `anima(body, colour, big)` | An ánima wakes (`big`) or is swapped in: its colour swirls up and rings out. |
| `poof(where)` | Off in a puff of smoke. |
| `confetti(centre, colours)` | The fight is won: confetti that tumbles down and lies where it falls. |
| `element(element, target, { from, strength, feet })` | A hit of `fire`, `ice`, `air`, `energy`, `water`, `earth`, `light`, `shadow` or `gum`. |
| `aura(element, at, seconds, height)` | A state that clings to someone (burning, frozen, charged…); keep `at` updated. |

Each scene has its **air** (`AIR`): dust motes in the light indoors, pollen on the breeze outside,
fireflies in the patio at night, gloom and bubbles in her palace, and her pink gloom outside that
thickens with her light (`setTone`). It fills what the camera sees and survives `clear()`.

To add a kind, add an entry to `KINDS` (sizes are half-widths in metres; the street camera shows
40–75 px a metre, so glows under ~0.05 m disappear) and check it in the `particles` scenario.

## What next

In rough order of what each adds for its cost:

1. **Tilt-shift depth of field** (`CameraFrame.dof`, focus on the player) for a miniature
   diorama look, and **SSAO** (`CameraFrame.ssao`) for contact shadows under furniture and
   between houses; both need checking with the ortho camera.
2. **Colour grading per scene** with LUTs (`colorLUT`, blending two for transitions) and
   `colorEnhance` (shadows, highlights, vibrance): warm morning in the flat, cool night patio,
   her pink taking over as a LUT blend rather than only lights.
3. **Soft particles**: fade covering particles where they cut into the floor or walls, using the
   scene depth (`rendering.sceneDepthMap`).
4. **Weather and decals**: rain (streaks + ripples), snow (flakes that settle) and persistent
   marks (scorch, frost, gum) as ground decals with a budget, from the kinds that already exist.
5. **Ribbons and trails** for swings and spells (a strip renderer next to the particles).
6. **Softer shadows** (`SHADOW_PCSS_32F` or VSM) and shadow resolution that follows the zoom.
7. **Image-based lighting** (a prefiltered environment atlas) so glossy gum, glass and water
   reflect a sky instead of only the sun.
8. **Hit feel**: chromatic fringing on big hits (`CameraFrame.fringing`), a few frames of
   hit-stop, and `pc.MiniStats` behind a `?stats` flag for profiling.
9. **WebGPU and GPU particles** once counts need more than ~20k or compute pays off: port the
   cutaway chunk to WGSL first.
