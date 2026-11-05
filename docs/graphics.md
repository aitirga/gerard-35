# Graphics: engine, post pass, particles and trails

How the game is drawn: the engine and why it stays, the post pass that gives the HDR look and
bloom, the particle system used for fights, elements and each scene's air, and the ribbon trails
behind swings and spells. What to build next is at the end.

bloom, each scene's colour grade, and the particle system used for fights, elements and each
scene's air. What to build next is at the end.

```
src/game.ts ── camera ──► src/post.ts       CameraFrame: HDR + 4× MSAA, bloom, ACES, vignette, her pink tone
                               └──────────► src/grading.ts     a colour look per scene (LUT + colorEnhance), cross-fades
            └─ effects ─► src/effects.ts    kinds (dust, sparks, fire…), battle recipes, elements, auras, scene air
                               ├──────────► src/particles.ts   CPU simulation + one instanced draw
                               ├──────────► src/flames.ts      fire drawn whole by a noise shader: one draw
                               └──────────► src/trails.ts      ribbons: one strip, one draw
src/battle-scene.ts ─────► effects.impact / binaryFire / anima / element / comet / trails …
            └─ hit feel ► src/hit-feel.ts   hit-stop, camera lurch and punch-in; post.pulse for fringe + bloom
                               │                               weather and ground marks
src/scenery.ts ── sun, sky ─► src/lighting.ts   shadows fitted to the view (PCSS / PCF), sky reflections
```

Check visual changes with `just screenshots graphics` (the same five views every time: street,
palace, flat, patio, a fight) and `just screenshots particles` (each scene's air, then a fight frozen
in time while every effect, element and aura plays), and `just screenshots trails` (swings, spells
and spirals frozen mid-flight). `tests/particles.test.mjs` and `tests/trails.test.mjs` run the real
simulation and strip building headless.

in time while every effect, element and aura plays). `just screenshots weather` shows rain and snow
on the street and the patio, and the marks a fight leaves. `tests/particles.test.mjs` runs the real
simulation headless.

## The engine

PlayCanvas **2.23.3** (latest stable, October 2026) on **WebGPU** only. It stays:

- The game is built in code (no editor): ~15k lines of TypeScript on PlayCanvas's entities,
  static batching, PCF shadows and shader chunks (the building cutaway). Moving to Three.js or
  Babylon.js would be a rewrite with nothing new on screen; Godot or Bevy web exports are heavy
  and fit badly with the HTML HUD.
- It is actively maintained (patches every week or two) and ships what a modern look needs:
  HDR post (`CameraFrame`), bloom, SSAO, depth of field, colour grading, TAA, WebGPU, compute.
## Performance

The cost is the CPU submitting draw calls; the GPU has room. Aim for under ~8 ms of `app.render`
per frame, so a 120 Hz screen keeps an even pace (above it, frames alternate 8 and 16 ms and walking
looks choppy). Measure on the release engine: `npm run dev` serves PlayCanvas's debug build, which is
about half as fast.

- **Batch what stands still.** Scenery parts go into the scene's group `Estático: <id>`
  (`scenery.ts`, props, geo, and the house's parts that never fold). In the Meridiana flat this took
  the draw calls from about 2,300 to 1,000.
- **Trees and rigid props draw merged** (`merge` in src/props.ts). A tree is a dozen primitives
  (trunk, branches, crown, lobes) under a swaying pivot, so it cannot join the static batch: its
  trunk and crown are merged per material under the pivot instead (four draws, not twelve), its
  pit, pot and stakes join the batch, and a crown that fades while Gerard is behind it switches
  back to its own parts so the see-through lobes still sort one by one. Moving cars, buses, motos
  and cyclists merge the same way (merged meshes are shared, so all cars cost one body mesh).
  Over Avinguda Meridiana's overview this took the draw calls from about 11,100 to 5,000 and the
  frame from 19 to 12 ms at 2× pixels, for 18 MB more vertex data. `just screenshots
  zone-overview` shows it (and checks that merged and per-part crowns look the same).
- **Developing on a busy GPU.** At 2× pixels the post pass costs more than the scene (about 13–17
  ms of GPU in the city). A machine can draw fewer pixels in `just dev` only, with
  `VITE_PIXEL_RATIO=1.5` (about half the pixels) in its git-ignored `.env.development.local`.
  Builds, the deployed game and screenshots keep the full ratio.
- **A second camera draws a second scene.** The flat's TV (`src/news-tv.ts`) films a whole Rec
  Comtal set, so it films 15 pictures a second (30 while watching it up close), only while the
  screen is in view, and the set casts no shadows. Before that it was two thirds of the flat's cost.

Reference, M1 Pro, 1440×900 at 2×, walking: the flat about 5 ms of render CPU, Avinguda Meridiana
about 6 ms, Maresme and Rec Comtal 3–5 ms.

2.23 changed two typings: a render component's `type` is a union (`pc.RenderComponent['type']`, not
`string`) and `meshInstance.material` may be `null`.

### WebGPU only

`createGame` (src/game.ts) is async: `createDevice` asks `pc.createGraphicsDevice` for WebGPU and
nothing else. A browser with no adapter gets a note saying the game needs WebGPU (a recent Chrome,
Edge or Safari) instead of a black page.

- The console says `Gerard 35 dibuja con WebGPU` once.
- `?stats` shows `pc.MiniStats` (frame, CPU and GPU time, draw calls, VRAM), harmless in production.
- The 3D city map (src/city-3d.ts) has its own small WebGPU app on its own canvas. Its device comes
  up asynchronously the first time the travel panel opens, and the panel waits for it.

On an M1 Pro (Chromium 141 headless, 1440×900 at 1×, release engine, no frame cap:
`just screenshots gpu-perf --gpu --perf`; ranges over two runs each), with ~1000 draw calls in the
street:

| View | fps · CPU ms · p95 ms |
| --- | --- |
| Street, following Gerard | 416–501 · 1.8–2.1 · 2.7–3.3 |
| Street, overview | 383–516 · 1.7–2.3 · 2.7–4.2 |
| Palace | 565–656 · 1.3–1.5 · 2.2–2.7 |
| Fight with every element going off | 416–469 · 1.7–2.0 · 2.8–3.1 |

At the usual 60 fps cap it holds 16.7 ms frames on this machine; the rest is the headroom left
for weaker computers. In the development build the engine's debug checks make WebGPU *slower* (8 ms of CPU a frame
against 5.6), so always time with `--perf`, never with `just dev`.

**Burning fighters** (`gpu-perf` also times a fight at rest, its three dogs burning at the three
levels, and all five fighters burning at the highest). Measured on a MacBook with Chromium at
1440×900 and 2× pixels (`--scale 2`, as a Retina screen draws), against the fires they replaced:

| Fight | frame ms before → now · draws |
| --- | --- |
| At rest | 15.96 → 15.79 · 613 |
| Three dogs burning (light, medium, high) | 16.38 → 16.68 · 659 |
| All five fighters burning high | 17.67 → 18.70 · 811 |

Every tongue of flame on anyone is one draw call, and the burn on someone's surface one a part. Measuring
the older fires, turning each part off in turn showed that most of the cost is the fires' lights (each omni
light costs every lit pixel within its range), so fires within `FIRE_SHARE` metres cast one light between
them, at most `FIRE_LIGHTS` at once. Catching fire surveys a body once: 0.7–2.4 ms on a foe, about 4 ms on
Vertitrón or Gerard (77 visible parts), in the development build; every later fire on them reuses it.

### Custom shaders in WGSL

Every custom shader is written in WGSL:

- **ShaderMaterial** (the particles, `VERTEX_WGSL`/`FRAGMENT_WGSL` in src/particles.ts): pass
  `vertexWGSL`/`fragmentWGSL`. Declare `attribute name: vec4f;`, `varying name: vec2f;` and
  `uniform name: vec3f;`; the
  engine copies attributes and varyings into globals of the same name, uniforms are read as
  `uniform.name`, the vertex writes `output.position` and `output.vName`, and the fragment writes
  `output.color`. The engine's includes (`gammaPS`, `tonemappingPS`, `fogPS`) keep their function
  names; `fog_color` is `uniform.fog_color`.
- **Chunks on a StandardMaterial** (the building cutaway in src/geo-scenery.ts): set the chunk
  names in `getShaderChunks(pc.SHADERLANGUAGE_WGSL)`. Module-level state is `var<private>`,
  and the forward pass ends on `output.color`. Uniforms a chunk declares are bound in every pass
  (shadows too), so give them a value up front.
- Watch WGSL's habits: `atan(y, x)` is `atan2`, a floored `mod` is `x - y * floor(x / y)`
  (`%` truncates), `discard` and every `if` body need braces, and there is no implicit
  int-to-float.

Check with `just screenshots particles --gpu`.

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

## Seeing Gerard behind things (`src/occlusion.ts`)

The camera is orthographic and high, so a building often stands between Gerard and it. Three things
keep him in sight, all set in `occlusion` (`?cut=`, `?silueta=0` and `?camara=fija` at load, and
`window.gerard.game.occlusion` live in a development build):

- **The street camera tilts** (`occlusion.camera`, src/camera-orbit.ts). It is calm on purpose:
  swinging round made players dizzy, so in the street it never swings and never moves while anyone
  walks. In places with buildings (the ones generated from map data), when Gerard and his partner
  stand still and a building has hidden one of them for 1.5 s, the camera tilts up slowly (to 55°
  or 68°, at most 18° a second) to the lowest angle that shows them, keeps it while they walk on,
  and comes back to its own angle once they stand in the open for 1.2 s. Directions on screen
  never change. It is automatic, not a key: both players share the camera and the city is styled
  for one angle.
  - Every angle is tried against the buildings near them (`sight` in src/geo-scenery.ts, the same
    rays as the cut). `createCameraOrbit` can still swing round (30°, 60° or 90° either way,
    `swing: true`, its default and what `tests/camera-orbit.test.mjs` covers); the game turns it off.
  - Each player steers by the angle on screen when they started pressing (`controlYaw` in
    src/game.ts, `screenToGrid(x, y, yaw)`), so a turn would never bend the way they are going.
  - Fights, cut-scenes and the overview (R) bring it home; while someone talks it only finishes the
    turn under way. Interiors, the palace and Uri's maze have no buildings to ask, so it never moves there.
  While it waits or turns, and where no angle shows him, the window below opens.
- **The building opens** (`occlusion.style`, shader chunks in src/geo-scenery.ts). Only a building
  that hides him opens (`buildingHidesPlayer`, a few rays from his body against its real
  triangles), only what stands in front of him, and the foot of each wall stays. Styles:
  - `dither` (default): a round window of 3.3 m radius on screen, centred on him. The camera is
    orthographic, so a cylinder along the line of sight is the same circle at every depth (the roof
    and the facade open alike). The last 1.1 m dissolves into a screen-space stipple (interleaved
    gradient noise, the same pattern in the depth prepass) and the wall just outside darkens a touch,
    as in Baldur's Gate 3 and Divinity: Original Sin 2.
  - `ghost`: the whole building turns to a screen door (a third of it stays), as Diablo fades walls.
    Shows the most, but at 1× the stipple shimmers into moiré over a large wall: it wants TAA.
  - `ring`: the earlier cut of 5 m radius, wider towards the camera, traced by a glowing cream edge. Each
    surface opens at its own size, so roofs and walls show stacked arcs.
  - `none`: buildings stay whole; only the silhouette shows him.
- **Silhouettes** (`occlusion.silhouettes`, `createSilhouettes`): Gerard and his partner are drawn a
  second time, flat light blue, only where something stands in front of them (depth test reversed,
  no depth write), as Torchlight and Diablo-likes show their heroes. The copies share each part's
  mesh and node, so they follow every pose. The stencil keeps them off the people themselves: their
  parts write 1 where they are seen, a copy draws only where the stencil is still 0 and raises it,
  so an arm behind his own body never shows and overlapping parts never darken twice. The post
  pass keeps a stencil buffer for it (`frame.rendering.stencil`). The tilt-shift blurs a silhouette
  with the wall in front of it.

Trees fade their crowns (src/props.ts) and house interiors fold their walls (src/home-scenery.ts)
as before. `just screenshots camera-orbit` shoots the fixed and the turning camera from two hidden
spots on Avinguda Meridiana and checks a key pressed after a turn; `hidden-view` shoots every window
style from the same spots with the camera fixed; `building-visibility` checks that only the building
in the way opens and closes again. `tests/camera-orbit.test.mjs` covers the camera's choices.

## Post pass (`src/post.ts`)

The main camera renders through `pc.CameraFrame`: the scene goes to a linear HDR buffer with
4× MSAA (so the canvas itself has no antialiasing), bright pixels bloom, ACES tone-maps at the end
and a vignette darkens the corners. `LOOK` holds every number. Each scene is colour graded
(below), and under La Reina Bubbaloo's light (`setTone`) her own grade blends in and the vignette
turns her pink.

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
  screen (development build), and `post.graded = false` keeps the pass but drops the grading.

### Tilt-shift and contact shadows

Two effects read the scene depth, which a **depth prepass** draws first (an MSAA scene can't
sample its own depth). It re-issues every opaque draw, so it is most of their cost and is shared
by both, and by anything else that wants `uSceneDepthMap` (soft particles, decals).

- **Tilt-shift** is the engine's depth of field (`CameraFrame.dof`, near and far blur). It works
  with the orthographic camera as it is: the engine linearises ortho depth, and the circle of
  confusion comes only from that depth. `post.focus(points, mode)`, called by src/game.ts every
  frame after the camera moves, puts the sharp plane through what the camera follows (Gerard and
  his partner, every fighter, a cut-scene's subject), so the ground blurs above and below them on
  screen like a photographed miniature, and roofs near the camera go soft too. The sharp depth is
  `band × orthoHeight` (the same share of the screen at any zoom), and the blur grows over that
  depth again up to `blur` pixels (at 540 tall). The overview (R) uses a narrower band and more
  blur; fights widen the band to every fighter plus `margin`, so a fighter is never soft (only the
  far floor and the dark behind blurs). A screen-space blur by height on screen would also have
  worked, but it would need our own pass and would blur a tall house next to Gerard; the depth
  one is the engine's.
- **Contact shadows** are the engine's SSAO (`CameraFrame.ssao`), multiplied into the final
  colour: creases where walls meet floors, under furniture, cars and feet. The engine's shader
  rebuilds positions for a perspective camera, which under ours stretches the scene about five
  times sideways and smears the result, so `orthoSsao` swaps two lines (positions from the view's
  real size, `uOrthoSize` = 2 × orthoHeight, and the sampling disk sized by it) in its WGSL
  (`ORTHO_SSAO`). If an engine update moves those lines it warns and turns SSAO off rather than
  show it wrong. It runs at half resolution (no visible difference here) with a 0.9 m radius.
- The building cutaway also cuts the prepass (`PREPASS_PASS` in src/geo-scenery.ts); otherwise the
  walls cut away in front of Gerard would still be in the depth and blur him.

Tune both in `LOOK.tiltShift` and `LOOK.ssao`. In a development build,
`window.gerard.game.post.tiltShift = false` and `.ssao = false` switch them off to compare, and
`post.frame.debug = 'dofcoc'` or `'ssao'` shows the blur amount (red behind, green in front) or the
occlusion alone. `just screenshots tilt-shift --gpu` shoots the street, the
overview, the flat, the house, the palace and a fight with neither, SSAO only and both.

Cost at 1440×900 on an M1 Pro (release engine, `--perf`): +0.4–0.7 ms a frame
(about +0.5 ms CPU for ~50% more draw calls, +0.5–0.8 ms GPU). SSAO alone costs about the same as the tilt-shift alone, and both
together little more than either, since they share the prepass.

## Colour grading (`src/grading.ts`)

Each scene has a **look** (`LOOKS`): a colour transform baked into a lookup table, plus a few of
CameraFrame's `colorEnhance` dials. It adds mood and never repaints: the palette must survive.

| Look | Mood |
| --- | --- |
| `maresme` | A sunny Mediterranean afternoon: golden light, teal shade, a little more vibrance. |
| `home-*` | Gerard's family house: warm afternoon indoors, soft amber shade opened up. |
| `patio` | A cool blue night: blue in the shade, the lamps and fireflies keep their warmth. |
| `meridiana` | The flat in the morning: soft and airy, peachy shade, the hot oranges held back. |
| `alegia` | Crisp Basque air: cool shade, clean greens, a touch of clarity. |
| `meridiana-calle` | Barcelona concrete: cool and a little hard. |
| `rec-comtal` | A Barcelona morning round the school, a touch warmer than the avenue. |
| `palacio` | Her palace: sugary and saturated, candy highlights over violet shade. |
| `bubbaloo` | Her light anywhere: magenta shade, pink light, darker and stranger. |
| `oscuro` | The flat before anyone is up (`setDark`): blue and grey until the lamps come on. |

How it works:

- A look's `grade` is a transform in display (sRGB) space: white balance (`temperature`, `tint`),
  `lift` / `gamma` / `gain` per channel, split toning (`shadows`, `highlights`: colour added to
  each, never to black or white), an S-curve `contrast` and `saturation`. `gradeColour` is the
  pure function; `lutTable` bakes it once into a 16³ LUT (the engine's 256×16 strip, Unreal
  layout), and each look's texture is built the first time it is shown.
- The engine applies the LUT **after** ACES tone mapping and `colorEnhance` **before** it, on the HDR
  colour (so `colorEnhance.shadows` opens up the shade without touching what blooms).
- The first LUT slot is the scene's look, the second her `bubbaloo` look, blended by her tone
  (`colorLUT.blend`) times the look's `her` (the palace takes only a third: it is sugary, not
  gloomy). Her old saturation boost now lives in that LUT.
- `post.setScene(id)` (from `setEnvironment`) cross-fades the first slot over `GRADE_FADE` (one
  second; instant with reduced motion): while it fades, and while the flat is dark, a spare
  texture is rewritten each frame with the mix. Otherwise nothing is uploaded.
- Both slots stay filled and `colorEnhance` stays on, so there is one compose shader throughout.
  No shader of ours: the engine's own chunks do it (the `grading` scenario with `--gpu`).
- The engine filters the 16³ LUT in linear light between steps placed in sRGB, so the darkest step
  (below about 17/255) comes out up to ~4/255 lighter and a smooth dark gradient shows faint steps
  if stretched. The patio, the darkest scene, pulls its shade back down with `colorEnhance.shadows`.

Cost: two LUT lookups (four bilinear fetches) and the `colorEnhance` maths per pixel in the
compose pass that already runs; 16 KB of texture per look shown, plus a 16 KB upload a frame only
while a cross-fade or the dark morning lasts.

To tune or add a look, edit `LOOKS` and check it with `just screenshots grading`, which shows every
scene plain and graded, a cross-fade half way, the street and the house under her tone and the
dark flat. `tests/grading.test.mjs` keeps every look honest: black stays near black, white near
white, mid grey near itself and greys in order.

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
- changes colour over its life: two colours, or three (`middle` says when it shows the second);
- **wanders on its own random walk**: an Ornstein–Uhlenbeck velocity (`wander` m/s, `wanderRate`
  1/s) that drifts and is pulled back towards still, so each particle has its own path;
- **rides a swirling flow field**: the curl of smooth noise, precomputed once on a tiling 16³ grid
  and sampled per particle (`flow`), so particles follow eddies and never clump;
- is pulled, swirled or lifted by **attractors** (heal spirals, whirlwinds, implosions, a fire's
  draw), as much as its `pulled` (1 by default);
- **parts around people** (`bodies`): vertical capsules for Gerard, his partner, NPCs, dogs and
  every fighter, which push particles out and drag the air along as they walk through;
- **meets the scene** (`collide`): floors baked from `scenery.groundHeight` (four samples a metre)
  and solid cells from the grid: walls 2.6 m in plans, furniture 0.8 m, street houses as tall
  as their volumes, props 1 m. Particles bounce (`bounce`, `friction`), settle on furniture tops,
  stick flat where they land (`stick`: gum, confetti, snow) or burst into something else
  (`pop` + `onLand`, one kind or several: drops into ripples or splats, rain into a ripple and
  spray). `onDeath` does the same when a particle dies (bubbles popping).

`retire(kinds, keep, seconds)` is a budget: it fades the oldest particles of those kinds out over
`seconds` (through their own `fadeOut`, from wherever they are in it) until only `keep` are left.

`intensity` makes a kind shine past white so the post pass blooms it. Covering particles take the
scene's light (`effects` feeds ambient + part of the sun as `uLight`), glowing ones ignore it
(`glow`).

**Soft particles**: covering particles fade out over the last `soft` metres (default .3, never more
than the particle's own size) in front of whatever is behind them, so a puff of smoke, dust or frost
melts into the floor, a wall or someone instead of showing a hard straight line. The post pass
renders a depth prepass of the opaque scene (`rendering.sceneDepthMap`, `LOOK.softParticles` in
src/post.ts); it stores linear view depth (−z in view space, metres), the same for the ortho camera,
and the shader compares it with the particle's own view depth. Pure light
(`additive` 1: sparks, flashes, glows) and `ground` particles keep the cut, so hits stay bright where
they touch and splats never vanish. The building cutaway also cuts the prepass, or particles would
fade behind walls that aren't drawn. Without the post pass there is no depth and particles draw as
before; `window.gerard.game.effects.particles.soft = false` compares (`just screenshots soft-particles`).
The prepass draws the opaque scene a second time (depth only): 30–50 % more draw calls (fight
750 → 977, street 1078 → 1580, palace 1006 → 1549) and, in `just screenshots gpu-perf --gpu --perf`,
about 0.1–0.9 ms more CPU a frame. Set `LOOK.softParticles` to false to drop it.

## Fight particles on the GPU (`src/fight-particles.ts`)

A general particle engine on the GPU, used in fights, and on the street while something beaten comes
apart there (Disintegration, below), only with motion on, on a device that renders to float textures;
everywhere else, in reduced motion and in the headless tests, effects stay on the CPU pool. 32 768 particles.

- **State** is a float texture of five bands of rows (A position + age; B velocity + life; C kind,
  seed, the part it clings to, size; D when it lets go + its colour tint; E the particle it follows,
  where it sits in its chain, its batch), ping-ponged by **one full-screen pass a frame**
  (`pc.drawQuadWithShader`): each band's texel recomputes the same step and writes its own share.
- **Kinds are data, defined at runtime** (`define(name, kind)`, 16 slots, `GpuKind`): physics
  (drag, gravity or buoyancy, turbulence, how much fields move it, collide, bounce, friction, cling
  and for how long, settle), look (shape, three colour stops with brightness and when the middle one
  shows, size at birth and death and how much each particle's size varies, streak length, how thin a
  line is, spin, fades, additive, opacity, twinkle), how it sees others (separation, cohesion,
  alignment, radius), chains (`follow`) and what it becomes (`onLand`, `onDeath`, with its own `life`).
  Redefining a kind changes the particles of it already in flight.
- **Shapes**: `glow`, `streak`, `flame`, `smoke`, `line` (crisp thin lines along their motion),
  `shard` (a sharp diamond), `ring`, `star`, `dot` (hard-edged) and `strand` (a ribbon from a chain
  link to the link ahead, so a chain draws as one line).
- **Spawning** happens on the GPU: the CPU keeps a ring of slots and sends batches (`burst`,
  `emitter`, up to 64 a frame): in a ball, on a ring round any axis (spinning with `around`), along a
  line (`to`), or on the **surface of a fighter**: a random part above a fraction of their height, a
  random face, a random point on it, thrown off along its normal; with `band` only within that band of
  their height (drawn again until the point is in it), and with `fromPart` in the colour of the part it
  leaves (each part's diffuse colour rides with its box). A burst may tint the kind
  (`colour`) and cut itself into **chains** (`chain`): every link starts where its leader does, and
  followers close in on the link ahead (lagging, so a chain draws a curve as its head moves). A
  particle born this frame waits a frame to move, so it never reads its leader before it exists.
- **Motion**: gravity or buoyancy, drag, a divergence-free turbulent flow (crossed sine waves pushing
  across their own direction) and up to 16 **force fields** (`field`: swirl round any axis, pull or
  push, lift along the axis, more turbulence), which can `follow` a fighter.
- **Seeing each other**: a kind with separation, cohesion or alignment looks at its four ring
  neighbours (siblings from the same batch: it moves towards their middle and matches their velocity)
  and three random particles a frame (it keeps away from any within `radius`). No grid, no sort: 7
  reads a particle, only for the kinds that ask.
- **Meeting the fighters**: every part of every fighter (`setFighters`, each frame) is an oriented
  box (world and inverse matrices and its mesh's bounds in a data texture), so particles bounce off
  their real shape, slide along it and may **cling** (stored in the part's local space, riding it
  wherever it goes) before letting go. A heightmap of the fight's floor catches the rest; there a kind
  may settle, or become its `onLand` kind (shards into frost, gum into splats).
- **Drawing**: one instanced draw of a quad per slot, reading the state in the vertex shader (dead
  slots collapse to nothing), white-hot to mid to end over their lives, tinted, in the scene's fog
  and tonemapping.
- **Blur**: a kind's `blur` (0 crisp to 2, or at birth and at death so it softens as it fades)
  draws it out of focus: its shape is averaged over five points and its quad grows so the halo is
  never cut. Only blurred kinds pay the five lookups. Motes, embers, cures, fireflies, twinkles and
  flares blur as they fade; `effects.gpu.get(name)` and `define` change it live.
- **Crystals** (`volume`, up to 8): a sphere, a box or a `crystal` (a double pyramid) placed by a
  rigid transform or following a node, as a signed distance in its own space. Its mode says what
  particles do with it: `contain` (glass: what is inside stays in and bounces off its inner walls,
  what is outside bounces off it), `solid` (bounced off), `orbit` (drawn onto a shell `distance` off
  its surface and swirled round its axis) or `attract` (pulled in to settle on its faces and slide).
  `kinds` limits it to some kinds. `effects` draws a visible crystal of glass for it (`crystalAt`:
  it grows in, turns, bobs, and shrinks away or shatters into shards with a flash).
- **Light from the particles**: a burst with `light: { intensity, range, colour? }` is a light group.
  After each step a small pass sums each group on the GPU (64 of its particles: brightness-weighted
  middle, colour and brightness, the colour and fade the draw uses) into an 8×2 float texture that
  is read back without waiting (`texture.read`, one read in flight). A real omni light then follows
  the cloud's middle in its colour, its brightness following theirs (against the brightest they have
  been), so the light falls on the fighters, the floor and the scenery like any light and goes out
  with them. The four brightest groups get a light (`FX_LIGHTS`), scaled down by daylight like a
  fire's.

`FIGHT_KINDS` in src/effects.ts defines the fight's kinds; it uses them for blows (sparks and crisp
`needle` lines that meet whoever was hit), for whoever burns (`FIRE_GPU`: embers, crackle, smoke and
ash off their own parts, a vortex round them) and for fire hits (a ring of embers drawn in, then blown
out). `effects.fightFx(name, { model, from, colour, strength })` plays a preset made of them
(`FIGHT_FX`): `needles`, `shatter` (ice: spinning shards that become frost), `arc` (energy: chains of
light), `vortex` (an ánima's colour spiralling up), `swarm` (shadow: a flock that sees itself),
`goo` (gum that clings and splats), `heal` and `fireworks` (rockets with trails that burst into
embers). In development, `window.gerard.game.fx(name, fighterId, { from, colour })` plays one in a
fight, and `just screenshots fight-fx --gpu --scale 2` records each; `effects.gpu.define(...)` and
`effects.gpu.burst(...)` in the console try new ones live. `effects.gpu.draw = false` compares.
Crystal presets: `prison` (a crystal closes round them, light bouncing inside it and off them),
`orbit` (light circling a crystal over their head), `gather` (a crystal draws embers in and bursts),
plus `meteor` (trails falling from high up that flare where they land, a scorch left) and `fireflies`
(warm lights wandering round them); heal, vortex, arc, fireworks, prison, orbit, gather, meteor and
fireflies light what is round them; the lattice presets (`ward`, `morph`, `current`, `veil`, `forge`, `shield`, `bubble`, `globe`, `orb`) are under Lattices. Firing all thirteen every 0.7 s (a storm no fight reaches)
costs ~1.1 ms at 2× pixels, nearly all of it the lights; the first
eight alone, before particles lit anything, cost ~0.15 ms.

## Lattices (`src/lattice.ts`)

A lattice is a shape made of fight particles that holds together: solid and stable, it bends when
pushed and springs back, changes shape without losing its structure, flows, breaks where particles
thrown at it hit hardest, and mends. `effects.gpu.lattice(kind, options)` makes one (up to 4 at once,
up to 8192 members each); every field of the `GpuLattice` it returns can change from frame to frame.

- **A grid, not a list of points.** A lattice is one batch of particles laid out as nx × ny × nz
  cells. A member knows its cell from its place in the batch, so nothing about the shape is stored
  per particle: its **home** is computed each frame from the cell, the lattice's shape and its
  transform (`at`, `rotation`, or a node it `follow`s), and its **neighbours** are the six cells
  next to its own (x wraps round). Moving, turning or reshaping a lattice costs nothing: the homes
  move and the members follow, lagging as softly as the lattice is soft.
- **Shapes are continuous maps of the grid** (cell −1…1 → the lattice's own space): `box` keeps it,
  `ball` and `crystal` (a double pyramid) pull each shell of the grid radially onto their surface,
  `ring` bends x round a circle and turns y × z into the tube's section, `column` does the same round
  its height, `shield` cuts a heraldic escutcheon out of the grid (a straight top and sides, then two
  arcs as wide as the shield meeting in a point) and bends it out along x towards +z, and `sphere`
  wraps x round it and runs y from its bottom to its top (a hollow shell, z its thickness). A ring and
  a sphere close round x: their rows are loops, with no seam. Each map keeps neighbours next to each other, so `shape`, `morphTo` and `morph` (0–1)
  blend between any two without tearing. Each map also runs backwards (`latticeUnshape`): a point
  leads straight to its cell. The maps exist twice, side by side in src/lattice.ts: TypeScript
  (tested in `tests/lattice.test.mjs`) and WGSL.
- **Springs.** `rigidity` (1/s²) pulls each member home, damped towards the home's own motion
  (`damping`; the lattice's velocity and spin come from its transform frame to frame). `bonds` pull
  it towards each neighbour at the distance their homes keep, and `viscosity` evens out its velocity
  with theirs. Every spring is capped against the frame's length (`k·dt²`), so no lattice blows up on
  a long frame. High rigidity is a solid; low rigidity with strong bonds a jelly; rigidity 0 a cloth
  that falls and drapes over the fighters (members meet their parts like any `collide` kind).
- **Flow.** `flow` scrolls the cells along x (cells a second): round a ring they circle it, along
  anything else they stream through and start again at the other end. `wave` sends a ripple through
  the homes.
- **Meeting other particles.** `hitBy(batch)` (the slots a `burst` returns) throws that burst at the
  lattice, up to three at once. Each bonded member looks at 24 of their particles a frame, at the
  nearest point of each one's step this frame (so nothing slips through between frames), and takes
  `transfer` of its velocity. Each thrown particle maps the middle of its step back to a cell, checks
  that member and its six neighbours, and bounces off the nearest (`bounce`) or is caught (`bounce`
  below 0: it dies there, becoming its `onDeath`).
- **Breaking.** A bond stretched past `toughness` (0.5 = half its length) snaps: the member breaks
  loose, as `breakInto` if given, and its neighbours lose that bond, so cracks run. A member glows
  with its strain (`glow`) before it snaps; `rim` brightens its outline (first and last rows and
  columns), a shield's edge. `push(at, radius, strength)` kicks members for one frame.
  `dissolve` (0–1) breaks it progressively from `dissolveFrom`: `random`, `top`, `bottom`, `outside`,
  or from where it was last pushed (`push`).
- **Mending and assembling.** With `reform` (1/s²), loose members are drawn home, carrying their own
  weight, and bond again within 0.4 of a cell. With `from: { at, spread, shape }` the members are born
  loose there and fly in to build the lattice.
- **Life.** A member's life (`life`) stops at `hold` of it while bonded (or on its way home); once
  loose it ages through the rest and fades as its kind. `remove()` frees every member that way.
  Nothing is lost when a lattice goes: its members are plain particles again.
- **See-through.** `opacity` (0–1) dims every member, loose ones too. With `fresnel` (0–1) the
  draw turns each member see-through as far as its surface faces the camera (its direction from the
  lattice's middle, or for a shield from a point well behind it), keeping the outline bright: a body
  of glass with what is inside showing. Any kind can be glass too (`glass` in `GpuKind`, 0–1): its
  middle see-through, its edge kept and a glint up on its left, like a glass bead or a soap bubble.
  `strands: 'y'` joins a lattice's strands along y instead of x: a sphere's meridians.
- **State.** Members use band E's spare channel (lattice slot + 1, negative when loose) and, while
  bonded, band D's first channel for their strain. Each lattice is a row of 22 texels in a data
  texture (`LATTICE_COLS` in src/lattice.ts lists them). The ring allocator never puts a burst on a
  living lattice's slots. Drawn as `strand`, a member ribbons to its row neighbour while both are
  bonded, so a lattice reads as threads (`thread`, `veil`).

`FIGHT_KINDS` adds `node` (a dot of light with a little weight, so loose bits fall), `pane` (the same
dot, of glass), `facet` (flat diamonds of glass that fill between bands), `thread`, `veil` and `chip`
(what a lattice breaks into). The `fightFx` presets are `ward` (a wall between the
target and the blows: sparks dent it, hole it and knock bits loose, it mends, then crumbles),
`morph` (a ball → crystal → ring → column → ball, shaken by pushes), `current` (a ring of threads
streaming round the target), `veil` (cloth that drapes over them) and `forge` (embers assembling a
crystal that bursts into chips), `shield` (an escutcheon of light with a bright rim and a boss, a
small ball lattice, raised between the target and the blows: it unfolds from its middle, unbreakable
until whole, takes three volleys, mends, and a last heavy volley shatters it from where it lands) and
three spheres round the target that rise as a disc from its feet and swell round it, turning,
deflect blows from three sides, heal at once and pop: `bubble` (bands of light, its parallels, with
glass facets between them, a lattice each), `globe` (bands both ways, parallels and meridians, and
the glass) and `orb` (glass made of the shield's dots alone, `opacity` and `fresnel`, which instead of popping takes a last heavy volley and shatters into chips from where it lands, like the shield). `just screenshots lattice --gpu --scale 2` records each, framed
close with `game.frame` (which holds the fight camera too while set) and `game.fighterAt(id)`.

`fightFx` takes a fighter's feet at their own origin when the scene's floor does not reach under the
fight (`groundAt` reads −1 there); before, effects that start at the feet or the chest sat almost a
metre low in such fights.

## Disintegration (`src/disintegrate.ts`)

A beaten foe does not fall over and leave in a puff: all at once, a little sooner at its feet, it
crumbles into specks of violet and purple light, tiny and see-through, that hang where it stood for a
moment, drift up a little with a short trail and fade (the crumbling under half a second, the specks
about a second and a half). Violet is fear's and possession's (docs/visual-style.md): what held it
leaving. In a fight each foe does as it is beaten; on the street, what stood for it does once the
place shows again: a fear on the tower's ramp where it caught the party, and El Vértigo on the top,
while Uri talks. `effects.disintegrate(model, { colour, delay, own, done })` runs one (`colour` in
place of the violet and purple) and returns its `progress` and whether it is `finished`.

- **The crumbling is a shader on its own materials** (`dissolvable`: WGSL chunks of the lit shader).
  A front sweeps from below its feet to above its head (`DISINTEGRATE.seconds`, 0.42 s), so ragged
  (`ragged` 1, a whole height of value noise: coarse over its height, fine per metre) that it eats
  grains all over it at once. The noise is measured from where it stands, so the pattern rides with
  it. A fragment the front has passed is discarded in every pass, its shadow and the depth prepass
  too; one at the edge of a hole glows faintly violet. A fighter's material copies get the chunks
  when the fight is built, so nothing compiles the moment it is beaten; a street model comes apart in
  copies of its own, and gets its materials back once it is gone (a pack of young comes back whole).
- **What it eats becomes fight particles born on its real parts**: bursts of `speck`s on its
  `surface`, within the `band` of its height the front is crossing, so for a moment its shape stands
  there in specks. Each speck is a chain of four drawn as a strand (its trail), half violet
  (`#a274ff`), half deep purple (`#6c2cc4`), so they show on dark floors and on light ones; with no
  white-hot core (`core: 0`) and little additive light, they keep their colour over any floor. Thick
  drag and a little buoyancy: they hang, then rise a little, darkening as they fade; other effects'
  force fields leave them be (`response: 0`). Bigger foes throw more and slightly bigger specks.
- **In a fight** (`src/battle-scene.ts`) a beaten foe shudders for `DISINTEGRATE.shudder`, then crumbles
  rising a touch (`DISINTEGRATE.lift`) and leaning back, frozen in its pose, with the `dissolve` sound (a
  breath of air rising and soft notes climbing). El Vértigo lets go of Uri and Nil first: they stay
  whole and come down to the floor. Gerard and Aitor still fall on their side and get back up.
- **On the street** (`src/game.ts`): a fear beaten on the ramp leaves a copy where it stood, which
  comes apart 0.35 s after the place shows again (never under the fight's glass) and is destroyed;
  a pack of young beaten goes away whole and comes back later as before. El Vértigo on the top does
  the same while Uri talks, and lets Uri and Nil down to the platform. While anything comes apart or
  its specks still drift, the GPU engine runs outside the fight too.
- **Reduced motion**: the crumbling alone, nothing thrown, nothing rising.

`just screenshots disintegrate --gpu --scale 2` records three dogs beaten at once, El Cebollón beaten
and then coming apart on the ramp, and El Vértigo in its fight and on the top.

## Reflections (`src/reflections.ts`)

The sky (src/lighting.ts) gives every glossy surface a far, general reflection. Reflections add the
near one and glass:

- **Reflection probes** (`probe(at)`): a cubemap (256² a face, mipmapped, sRGB) rendered from a point
  by six perspective cameras on the world and skybox layers, so what reflects it shows what is really
  round it: the fighters, the floor, the light of the particles. All six faces at first, then one
  face every third frame (the whole cube in under a third of a second), only what is within `far`
  (6 m), and only while something uses it (`active`).
- **The glass layer** (`glassLayer()`): what samples a probe would be read and written at once if a
  probe drew it, so it lives on its own layer, which probes never render and the scene's cameras draw
  just before the world's transparent things (particles inside glass show over it).
- **Glass** (`glassMaterial(colour, cubemap)`, `glassMesh(device, triangles)`): a custom shader for
  faceted meshes. It refracts the scene behind it from the post pass's colour copy, red, green and
  blue bent by slightly different indices (dispersion, rainbow fringes at its edges); reflects the
  probe more the more grazing the view (Schlick fresnel); glows faintly of its colour within,
  brighter towards the rim; lights its edges where its faces meet (a per-vertex barycentric edge
  coordinate, with the edges that split a flat face hidden, anti-aliased with `fwidth`); and catches
  a key light's glint and the odd twinkle on a facet. `post.glass(true)` turns on the colour copy
  (CameraFrame `sceneColorMap`: a copy of the frame with mipmaps and the scene pass split in two);
  effects keeps it on from a fight's first crystal to its end, as switching it rebuilds the post
  pass.

Crystals (src/effects.ts, `crystalAt`) use all three: quartz, a hexagonal prism pointed at both ends
(optionally with smaller points round its foot), on the glass layer, reflecting a probe at the
newest crystal, with a key light of their colour that makes their faces glint and lights what is
near. Their volume in the fight particles is the same shape (`quartz`). A crystal costs ~1.5 ms a
frame at 2× pixels (the colour copy, then the probe), and only while
there is one.

**Particle sprites** (src/fight-particles.ts `shapeAt`, and the CPU pool's `glow`): light is a
white-hot pinpoint, a body of its colour and a faint halo fading to nothing at the quad's edge;
`dot` is a lit bead for matter (gum, frost: shaded from the upper left, a glint, a brighter rim,
smooth-edged with `fwidth`, never turning) and a glowing orb for light (additive kinds); `star` has
four fine tapering rays, four shorter diagonal ones, a hot core and a soft glow. A GPU kind's `core`
(0–1, 1 by default) scales how white-hot any shape's middle is: 0 keeps a speck too small to have a
core its own colour all through (a disintegration's violet). Each particle is a touch brighter or
dimmer than its kind, so a burst never looks flat.

## Effects (`src/effects.ts`)

`KINDS` defines every kind as data; `createEffects` builds the recipes on top:

| Call | What it shows |
| --- | --- |
| `emit(kind, at, count, spread)` | A plain burst of one kind (footfall dust, gum, spores). |
| `impact(target, from, strength, { guarded, gum, feet })` | A blow: flash, sparks flying on through (white-hot to gold, never clinging) and a little dust at the feet, no ring; on Gerard or Aitor it lands mid-body; a guarded blow glints blue; gum foes spit drops that splat. Nothing in a fight reads as blood. |
| `binaryFire(from, to, { seconds, burn, feet, onArrive })` | Foc Binari: two braided streams of fire (orange to red, gold to orange) from the hand to one foe, shedding embers; with `burn` (a 1) they burst into fire, without it (a 0) they fizzle into smoke. |
| `heal(feet, height)` | Light rising from a cardioid round the feet, spiralling up (no skill uses it now). |
| `insight(head)` | Ideas circling over a head (no skill uses it now). |
| `anima(body, colour, big)` | An ánima wakes (`big`) or is swapped in: its colour swirls up in strands of light and rings out. |
| `comet(from, to, colour, seconds, options)` | A spell flying in an arc (a trail, below) that flares where it lands. |
| `poof(where)` | Off in a puff of smoke. |
| `disintegrate(model, { colour, delay, own, done })` | A beaten foe crumbles at once into tiny violet and purple specks that hang, drift up a little and fade, and is disabled (Disintegration, above). |
| `confetti(centre, colours)` | The fight is won: confetti that tumbles down and lies where it falls. |
| `element(element, target, { from, strength, feet, body })` | A hit of `fire`, `ice`, `air`, `energy`, `water`, `earth`, `light`, `shadow` or `gum`; fire is left burning around `body`. |
| `aura(element, at, seconds, height)` | A state that clings to someone (burning, frozen, charged…); keep `at` updated. |
| `fire(at, level, { seconds, body, model })` | A fire at `light`, `medium` or `high`, alone, around someone or on their own body (below); returns `{ level, burning, glow, stop() }`. |

**Fire** (`FIRE`, `src/flames.ts`) is drawn whole, never as sprites. Each fire is one upright
surface turned to the camera (it stands like someone standing there, so it never sinks into the
floor and whoever stands in front hides it), and its shader builds the flames: two slow fields of
fractal noise rising through it warp a quick one, so its tongues split, merge and lick up without
ever repeating, every fire on its own seed and the shader's clock. The noise eats more of the body
the higher it climbs, tearing its top into tongues (more of them across a wider fire), and its
temperature colours it, white-hot low in the heart, then yellow, orange and deep red at the tips;
past `heat` 0 its heart blooms. Above it a column of smoke, lit warm from below and cooling to grey,
takes the scene's light. All fires are one instanced draw, sorted after the marks and before the
particles, so sparks fly over them.

It comes in three levels, to be given to whatever needs one (a burning state, a skill's hit, a bin
set alight): `light`, an ankle-high flicker; `medium`, a knee-high campfire that flares now and then;
`high`, a blaze taller than a person, flaring and spitting sparks into a column of smoke. Standing on
its own, only its sparks (`fleck`) are particles. It breathes (its strength and height swell and ebb), crackles (a
flare: taller, hotter, a spray of sparks, a brighter light) and throws a flickering omni light (cheap:
lighting is clustered), which shows at night and hardly by day (scaled by the scene's light). Change
`level` while it burns and it grows or calms into it; `stop()` lets it die down over `FIRE_FADE`;
`clear()` and a new scene put it out.

**On someone's own body** (`fire(at, level, { model })`) they burn themselves, whatever they are made
of, and nothing stands on the floor (`wrap` in src/flames.ts). It has three layers, all from their
actual geometry, so it works on any model without knowing what it is:

- **The burn.** It catches at four points of their surface, apart from each other, and spreads from
  them, its edge torn by noise, as `spread` grows into its level (`FIRE[level].spread`: under half of them
  at `light`, most at `medium`, all of them at `high`). Every part is drawn again a hair over
  itself: behind the front char with veins of heat that breathe, along it a thin flickering line, ahead
  of it a scorch. The pattern is pinned to each part in the pose they caught fire in, so it moves with
  them and never swims.
- **Tongues of flame.** Real 3D teardrops, seen from any side and hidden by the body like anything
  else, grown out of points of their triangles chosen by area (`surveySurface`: never what faces the
  floor, lies buried inside another of their parts or is a flat puddle at their feet; the survey is kept
  per model, as every fire hit starts a fire). Each leaves along the way its surface faces, then climbs,
  so the same code suits a wall, a sphere or a ladder; each swells, licks and sways, and at the end of each
  breath its tip pinches off and rises. A tongue catches as the burn reaches it. They have no state: a
  tongue's life is a function of the clock and its seed, and it finds its part's transform in a texture,
  so they follow every move (a sniff, a blow, a squash) and everyone's are one draw call. How tall they
  lick (`FIRE[level].lick`) scales with the square root of their height (`lickScale`): small on a cat,
  big on a giant, never to scale. Mostly covering rather than added, flames in front of flames keep
  their colour instead of summing to white.
- **What flies off them** (`FIRE_GPU`): embers, crackle, smoke (many faint dark glows) and ash, on the
  GPU, off their parts above their feet, more on a bigger body; a vortex (a field following them) carries
  them round as they rise. Now and then it crackles: the tongues flare and a spray leaves them.

In fights, `battleScene.ignite(id, level)` (in development `window.gerard.game.ignite`) sets a fighter
alight, whoever they are, Vertitrón and its eye included: it follows them, heats them (their materials
glow warm and flicker with it, on top of the hit flash) and goes out when they fall. A node tagged
`fireproof` does not burn (Uri, riding Vertitrón). Quemado sets the foe alight this way while it lasts,
at its level. `just screenshots burning --gpu --scale 2` records the levels and every kind of body.

**Around someone with no model to burn** (`fire(at, level, { body: { radius, height } })`, and the
fire `aura`), it wraps them: one layer stands just behind them, so they hide its middle and it rises
over their head, and a lower, wider, partly see-through one stands just in front, licking up their lower
half; its light falls on them. A fire hit (`element('fire', …, { body, model })`) leaves one burning on
whoever it hit, its level set by the hit's `strength`. `just screenshots fire --gpu` records it all as clips.

**On fighters.** Particles of a blow burst inside whoever they hit, which used to hide most of them.
A kind's `front` (or a burst's) draws it that many metres nearer the camera than it is: the same
place on screen, only nearer in depth (soft fading included), so sparks, flashes, shards and stars
show over the fighter they burst from while a wall further in front still hides them. Ground
particles never take it; cures (`heal`) take little, so they still wind round the body.
`effects.particles.front = false` compares. Hits also touch whoever they land on: every `impact` and
`element` throws a brief light of its colour (`glint`, at most `GLINTS` at once) that lights them and
around them, and sparks, shards, drops, rocks and gum bounce off their body (`bodies`).

Each scene has its **air** (`AIR`): dust motes in the light indoors, pollen on the breeze outside,
fireflies in the patio at night, gloom and bubbles in her palace, and her pink gloom outside that
thickens with her light (`setTone`). It fills what the camera sees and survives `clear()`.

## Statuses on fighters (`src/status-fx.ts`)

How a status reads on whoever carries it, in a fight: the combat design's physical statuses (quemado, mojado, congelado, envenenado,
sangrado, cegado, paralizado), the campaign's (`STATUSES` in src/battle.ts: sangrado, mareo,
llorera), cauterizado, and the ten reactions between elements. Each look (`STATUS_LOOKS`) is data:

- **streams** of GPU particles (above) off the fighter's own parts, their head or their feet, at a
  rate for each level (I–III); as particles meet their parts, drops run down them, frost clings to
  them, a wound's scratches of light flash on them (no blood: Sangrado drips nothing);
- a **field** that follows them (the smoke that turns round a blinded head, the lights over a dizzy
  one) and a **pulse** (a heartbeat, a jolt, bubbles);
- the **body** responds: a tint of light on its materials (with the hit flash and the fire's heat in
  battle-scene) and a way of moving: frozen stands still, poisoned or dizzy sways, paralysed twitches.

Only sparks, drops, crystals and haze: haze is many faint soft glows overlapping, never a puff
sprite. Applying a status again while it is on raises its level and restarts its clock (the
design's `escalate`); Quemado burns through `ignite` at the fire's level. The campaign's statuses
follow the fight's stacks (counted in rounds). `REACTIONS` turn one
status into another with their own moment. In development, `window.gerard.game.status(id, look,
level)` (0 takes it off), `react(reaction, id)` and `statusesOf(id)`; `just screenshots status-fx
--gpu --scale 2` records each one. The combat engine does not have real-time statuses or
reactions yet: when it does, its events only need to call `status` and `react`.

## Weather and marks (`src/effects.ts`)

**Weather** falls over scenes with a sky (never in `plan` interiors or in her palace):
`effects.setWeather('clear' | 'rain' | 'snow', intensity 0–1, now?)`. It ramps in and out over
`WEATHER_RAMP` (4 s) and crossfades when it changes; `now`, or entering a scene, starts it already
falling. In development, `?weather=rain|snow&intensity=.6` sets it from the URL. The story will
choose it later; nothing on the HUD shows it.

- **Rain**: `spark` streaks falling at 9 m/s, leaning with the scene's wind (×2.5), that `pop` on
  floors, roofs and furniture tops into a `ripplet` (a ground ring) and a drop of `spray`; it melts
  settled snow. Over half intensity a low `haze` hangs about. Covering particles and marks take
  30 % less light.
- **Snow**: `flake`s drifting down at 0.85 m/s on the random walk, the flow field and the wind,
  each leaving a soft `drift` patch (a flat `smoke`) where it lands; overlapping patches read as a
  dusting. A scene that opens in snow starts dusted.
- Pollen and fireflies thin out under either.
- **Reduced motion**: nothing falls. Snow is only a still dusting on the floor; rain only dims.

Budgets (`WEATHER`; heavy weather, measured headless with the game's view): rain lands at most
1400 drops a second, about 1700 particles alive with ripples, spray and mist on the street (the
widest scenes stay under ~2400). Snow falls at most 220 flakes a second and keeps at most
`settled` 2000 patches, the oldest melting first: about 2900 alive on the street, ~3200 in the
widest scenes, a few hundred of them melting at any time. With the air (≤ ~450 outside) that
still leaves the 6000-particle pool over 2000 for a fight, whose bursts are a few hundred.

**Marks** are what hits leave on the ground: `effects.mark(kind, at, size)` with `scorch` (fire,
with embers dying out), `frost` (ice), `gum`, `wet` (water) or `dust` (earth). `element()` leaves
its element's mark under the target (`ELEMENT_MARKS`) and gum blows (`impact` with `gum`) a small
puddle. A mark stays while a fight lasts (`update` gets `fight`), fades over 2.5 s when it ends
(`clear()` or the fight flag dropping), and outside a fight fades after 40 s. Past `MARK_BUDGET`
(320 layers, ~45 marks) the oldest fade first.

They are a second, 512-particle pool with the same shader and shapes (`splat`, `smoke`, `flake`,
`glow` lying flat), not a decal renderer: the particle pool draws in no particular order, so a
covering scorch drawn after a flame would dim it; the marks' pool sorts behind every other
transparent draw (`calculateSortDistance`), so flames, dust and rain always lie on top. Each layer
sits 3 cm over the floor under it (kerbs and steps included, and over painted planes such as the
street's name, which the floor height does not know about), far above the depth precision of the
orthographic camera (and only a pixel or two off in this view), and marks never write depth, so they cannot z-fight with the floor or
with each other.

To add a mark, add its flat kinds to `MARK_KINDS` (long `life` and a small `fadeOut`, which the
budget fades through; `brief` layers like embers die on their own), its layers to `MARKS`, and,
if an element leaves it, an entry in `ELEMENT_MARKS`.

To add a kind, add an entry to `KINDS` (sizes are half-widths in metres; the street camera shows
40–75 px a metre, so glows under ~0.05 m disappear) and check it in the `particles` scenario.

## Stats going up or down (`src/stat-fx.ts`)

One animation for it, whatever the cause. What reads first: **three chevrons** pass in front of the
fighter, on the camera's side and facing it, one after another (`chevronPose`, drawn by
`src/stat-arrows.ts`): flat, unlit, each with a dark outline so it reads on any floor, popping in a
little big, gliding up past them pointing up in blue, or down pointing down in red, and fading out.
Under them a circle of light spins at the fighter's feet, with a second one that opens out when a stat
rises and closes in when one falls; then a sheaf of fourteen thin bars runs past them, each its own width, length and speed, **down in red** when a stat falls and **up
in blue** when one rises, with a tint on their body and the stat's name over them (*Defensa ▼*), rising with it or dropping. It
sounds in step with the chevrons (`stat-up`, `stat-down` in `src/sfx.ts`): air rushing up and three bright
notes climbing, a bell over each and a sparkle at the top; or air falling, three notes sinking and
bending down, and a low thud as it lands.
Particles go with the bars on the GPU (`effects.statChange`, kinds `rise`, `sink` and `drip`): rising,
a ring of blue motes spins up off their feet on a brief vortex and fine streaks shoot past their head,
twinkling out; falling, red drops run down off them and settle round their feet as dots while dim
embers sink. It is sized to whoever it happens to. The colours stay saturated and not too bright, so
they do not bloom to white on the fights' light floors.

While a stat **stays** up or down (`statShifts` in `src/battle.ts`: a boost while it runs, Mareo
or Llorera by their stacks, an onion with no layers left), **tiny bright motes of energy** leave the
fighter's head on the GPU (`STAT_MOTES` and `STAT_MOTE_KINDS` in `src/stat-fx.ts`, streamed by
`src/stat-motes.ts`): born on their own head's parts, a white-hot pinpoint in a body of colour, small
but bright enough to bloom. Up, they are blue and drift up off it, wandering a little and twinkling
as they fade; down, they are red and fall off it past their shoulders, dimming as they drop. Someone
with stats both up and down gives off both. They start as the chevrons pass (`STAT_MOTES.delay`) and
stop when the change wears off, the last ones finishing their way; what an action changes waits for
its blow to land. They stop while the fighter is down. `window.gerard.game.statMotesOf(id)` says
which they give off.

To use it, say so in the rules: an action that changes stats fills in `BattleEffect.stats`
(`src/battle.ts`) with who and which, and the fight plays it as the blow lands. Today: an onion's last
layer breaking its defence, *Yuki se esconde*, *Análisis Parálisis*, and *Llorera* and *Mareo* landing. `just dev-fx` has it
under *Características*, and `just screenshots stat-fx` shows it; `just screenshots stat-motes --gpu` shows the motes and the fight's summary.

## Trails (`src/trails.ts`)

Ribbons of light behind whatever moves fast, reached as `effects.trails`. A trail keeps where its
head has been and when; every frame each trail becomes a strip of vertex pairs (a soft tip ahead
of the head, then two vertices a point), and every trail goes into **one dynamic vertex buffer
drawn as one triangle strip**: consecutive trails are joined by repeating a vertex at each end,
which makes triangles with no area. The strip faces the camera (the shader spreads it across the
line as it runs on screen) or, with `normal`, lies flat in a plane like a blade's arc. Its width,
colour and alpha follow each point's age: widest, whitest (`core`) and brightest at the head,
thinning (`taper`) and fading to nothing at `life` seconds old, with soft edges. `intensity` over
1 blooms; `additive` 1 only adds light. Blending, fog, tonemapping and gamma are the particles'.

| Call | What it draws |
| --- | --- |
| `follow(entity or point, { offset, seconds, space, … })` | Light streaming from an entity (at `offset` in its own space: a fist, a nose) or a point you keep moving, until `stop()` or `seconds`. Its path is recorded and filled with a centripetal Catmull–Rom curve, a point every 5 cm, so a slow frame draws a curve, not a polyline. With `space` (the swinger) it is kept in that entity's space, so a fist swung while running in draws the swing's arc instead of a streak along the run. |
| `comet(from, to, colour, seconds, { arc, bend, onArrive })` | A head flying from A to B (easing out, `arc` metres over the line, `bend` sideways); `effects.comet` adds a flare on arrival. |
| `spiral(centre, colour, { radius, narrow, height, turns, phase, seconds })` | A strand climbing round a point on the floor, narrowing as it rises. |

Comets and spirals are drawn from their path itself (28 points between the head and the tail
`life` seconds behind it), so they are smooth at any frame rate. Every call takes the look options
(`colour` as one hex or head and tail, `width` in metres, `life`, `intensity`, `additive`, `core`,
`taper`, `opacity`, `normal`) and returns `{ stop(), done }`.

In fights (`trailsFor` in src/battle-scene.ts): a blow swings an arc from the leading hand
(`Mano` on the first `Brazo`) for the quarter second into contact, a dog's from its nose and the
gum minion's from its head; skills are in the wearer's ánima colour (`CLASSES[id].colour`, white
at the head); support skills fly as comets to whoever they reach (winding round the caster when
it is them); Foc Binari draws its own two streams of fire (`effects.binaryFire`): the caster raises
a hand, they leave it at `CAST_LAUNCH` (0.26 s) and land `CAST_FLIGHT` (0.42 s) later, at
`CAST_CONTACT` (0.68 s; `src/battle-motion.ts`); an ánima
waking winds three strands up round Gerard, a swap two (`effects.anima`). Reduced motion turns
trails off (`trails.enabled`), and `effects.clear()` ends them with the fight.

To add one, call `effects.trails.follow(…)` when the move starts and let `seconds` stop it, or
`effects.comet(…)` for a spell; check it in the `trails` scenario. The buffer holds 4096
vertices (256 KB): a swing is up to ~45, a comet or a strand 58, an awakening 174; past the
capacity a trail is skipped for that frame, never cut. Six trails at once (an awakening, a comet
and two swings, 350 vertices) take about 0.2 ms a frame to build on the CPU, then one 22 KB
upload and one draw call.

## Hit feel (`src/hit-feel.ts`)

When a blow lands (`contactBurst` in `src/battle-scene.ts`, at `CONTACT_SECONDS`) the fight holds
still for a moment, the picture lurches along the blow and springs back, and heavy moments fringe
the colours apart and swell the bloom. `landing(blow)` turns what happened into numbers: a weight
from the share of the target's PV the blow took, skill or plain, guarded, knockout or the beat.

| Contact | Hit-stop | Picture | Post pass |
| --- | --- | --- | --- |
| Plain blow (Atacar, a dog's bite, a guard's fist) | 55–90 ms, longer the bigger the bite | Lurch along the blow | Fringe only on big bites |
| Guarded blow | Half (~30–45 ms) | Smaller lurch | None |
| Gum swallows the blow | 35 ms | Small lurch | None |
| A skill hit (Foc Binari, Zarpazo…) | 100–135 ms | Lurch along the blow, punch-in | Strong fringe, bloom swell |
| Knockout | +50 ms (up to 180) | Punch-in | Full fringe, bloom swell |
| The beat (the minion's blow that drops Bernat) | 160 ms or more | Punch-in | Full fringe and bloom |
| A party boost (Yuki se esconde) | None | — | A soft bloom swell |
| An ánima wakes | None | Punch-in, shake | Full fringe and bloom |
| Ánima swap (L / R) | None | — | A touch of fringe, bloom swell |

- **Hit-stop** is the fight's own clock (`FightClock`): from contact it hands the fight no time for
  the stop, so poses, flashes and squash all hold. The held pose is the contact itself
  (the clock rewinds the frame's overshoot and holds that much less), so an action always takes
  `ACTION_SECONDS` plus exactly its stop and its Promise resolves then. Particles keep flying
  through the hold at `HIT.pace` (30%), so the burst blooms out while the bodies are frozen.
- **The camera** runs on real time, so it moves through the hold: a lurch along the blow that
  springs back with one small overshoot (`HIT.spring`), a punch-in of the ortho height on heavy
  blows (`HIT.punch`, critically damped), and a decaying shake for an ánima waking. The
  kick is a sideways move added after `lookAt` in `src/game.ts`, so the picture shifts without
  swimming.
- **`post.pulse(fringe, bloom)`** jumps `CameraFrame.fringing` and the bloom intensity up and lets
  them fade on real time (`LOOK.hit` in `src/post.ts`). Fringing grows with the square of the
  distance from the centre, so the fighters stay readable and the edges split. It is off at rest
  (the engine's fringe would split every edge green and magenta through the tilt-shift's blur) and
  its shader is built in the first frame, so the first big hit does not wait for it; with the pass off a
  pulse does nothing.
- prefers-reduced-motion (`animate` false) skips all of it: no hold, no lurch, no pulse.

Tunables: `HIT` in `src/hit-feel.ts` (stop lengths, particle pace, lurch, spring, punch, where
fringing starts) and `LOOK.hit` in `src/post.ts` (fringe and bloom at a full pulse, fade times).
`tests/hit-feel.test.mjs` checks the timing; `just screenshots hit-feel` steps a fight 1/60 s at a
time through an attack, a dog's bite, a guarded bite, an ánima swap, a Foc Binari knockout (in
flight, contact, held, after) and an ánima waking, and logs each contact, hold and resolution on
screen.

### Tempo and entry (`src/battle-motion.ts`)

Quick, with each beat marked. After every action the fight waits before the next actor moves
(`holdAfter`, `BEAT`): a short breath (170 ms) after a plain blow, longer when something changed
that needs reading: a layer off an onion (420 ms), someone down (460 ms), a status put on, a fire
lit or raised (640 ms), stats up or down (720 ms, as their number comes a moment after the blow's).
The foes' plan is worked out during that wait. A status that lands also says so on its own: its
name stamped in its colour above the blow's number (`pop(…, 'status')`, `.damage-pop[data-kind="status"]`):
*¡Quemado!* orange, *¡Sangrado!* red, *¡Mareo!* violet, *¡Llorera!* blue.

A fight comes in in `ENTRY_SECONDS` (1.05 s), gathering speed: everyone rushes to their places
along `surge` (cubic in-out: off slowly, a rush, a short brake), and the camera's follow rate
climbs with the entry's progress (from 2 to 48 a second), so it leaves slowly and closes in
quicker and quicker. The HUD's entrance beats in `src/style.css` fit inside it.

## Shadows and sky (`src/lighting.ts`)

`LIGHTING` holds every number. Each scene's sun gets its shadows from `lighting(app).shade()`, and
`buildScenery` picks the sky (`setSky`: `day` for the street and Alegia, `indoor` for the flats,
`night` for the patio, `palace` inside hers) and passes her light along (`setTone`).

**Shadows follow the view.** The engine fits the sun's shadow map round the camera's view box
from its near clip to `shadowDistance`, so with the camera 77 m away most of the 2048² texels used
to land on empty air (about 20 texels a metre). While the engine culls, `lighting.ts` narrows that
box to the slab where things stand: the floor (`floor`) up to the tallest shadow receiver on screen
(rescanned every `scanEvery` frames, between `ceiling` bounds). The map then covers about what the
camera sees, which roughly doubles its texels per metre following Gerard, and it grows and shrinks
with the zoom. Its radius moves in steps of 2^(1/8) (`step`), so the texel grid holds still while the
zoom eases and only jumps a few percent at a step, and the engine snaps the map to whole texels as
the camera moves, so edges do not shimmer. Only the shadow changes: what is drawn is untouched.
`shadowSlice` is the maths (`tests/lighting.test.mjs`). The backdrop under the diorama no longer
casts: as a 200 m caster it stretched the shadow depth range, which PCSS uses to size its search.

**Soft where it should be.** The sun uses PCSS (`SHADOW_PCSS_32F`): it looks for the
casters round each point and widens the penumbra with their distance, so a house's shadow is crisp
at the wall and soft at its far edge, a tree's trunk sharp and its crown blurred. `penumbra` is the
width per metre between caster and receiver; `samples` and `blockerSamples` trade grain in wide
penumbrae for cost. Its wider footprint needs more `normalOffsetBias` (.12) than PCF did against
acne. VSM (`vsm`) was tried: smooth and free of
grain, but evenly soft (no hardening at contact) and its blur passes cost more than PCSS.

**The sky is only reflected.** Each sky is three colours (zenith, horizon, ground) painted into a
small equirect texture and prefiltered by the engine (`EnvLighting.generateAtlas`) into the
environment atlas (`app.scene.envAtlas`); no skybox is drawn. Matte materials have no specular, so
the atlas would only change their ambient: `lighting.ts` overwrites the atlas's ambient part with
the scene's flat `ambientLight`, so they light exactly as before. Glossy ones reflect it through
`shine(material, kind)` (`LIGHTING.shine`: specular colour and `reflectivity`): pools, the bath,
the river, glass, car paint, steel, gold and her gum. With the ortho camera a flat surface reflects
one direction (floors and roofs the zenith, walls and windows the ground below the horizon), and
rounded ones the whole gradient, which is what gives her gum its pale pink rim.

Her light is a second sky (`bubbaloo`) and the dark morning a third (`dawn`). The scene's own sky and
hers are kept built; in between, the atlas is rebuilt in `steps` (12) as the tone fades, while the
ambient part follows `ambientLight` smoothly. A rebuild costs about 1–2 ms on the GPU, at most a
dozen times in a fade and twice on a scene change; standing still costs nothing.

For comparisons (development build): `window.gerard.game.lighting` has `shadows` (`'pcss'`, `'vsm'`,
`'pcf5'`, `'pcf3'`), `fit` and `sky`; `settings` is `LIGHTING` live and `refresh()` applies it.
`just screenshots lighting --gpu` shows every view after and before.

Measured with `--perf` on an Apple GPU at 1440×900 (GPU ms a frame, street following Gerard):

| | GPU ms |
| --- | --- |
| Before (PCF 3×3, no fit, no sky) | 1.0 |
| Fit + sky, PCF | 1.0 |
| Fit + sky, PCSS 20/12 | 2.2 (1.6 in the overview) |
| Fit + sky, VSM | 2.6 |

## What next

In rough order of what each adds for its cost:

1. **Weather in the story**: choose rain or snow per scene and chapter, and puddles that gather
   and dry where rain has fallen. Settled snow reads as soft patches; an even sheet needs its own
   particle shape.
2. **Shadows and sky, further**: a normal map on the pools so their sky reflection ripples, a
   second shadow map for the overview on fast GPUs, and a hemisphere ambient from the sky (the
   atlas's own ambient) once the scenes are rebalanced for it.
3. **A look for chapter 2's dusk** (`story.dusk`), which today only raises her tone, and a finer
   LUT (32³) if the darkest gradients ever show steps.
4. **GPU particles** (compute) once counts need more than ~20k.
