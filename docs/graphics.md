# Graphics: engine, post pass, particles and trails

How the game is drawn: the engine and why it stays, the post pass that gives the HDR look and
bloom, the particle system used for fights, elements and each scene's air, and the ribbon trails
behind swings and spells. What to build next is at the end.

```
src/game.ts ── camera ──► src/post.ts       CameraFrame: HDR + 4× MSAA, bloom, ACES, vignette, her pink tone
            └─ effects ─► src/effects.ts    kinds (dust, sparks, fire…), battle recipes, elements, auras, scene air
                               ├──────────► src/particles.ts   CPU simulation + one instanced draw
                               └──────────► src/trails.ts      ribbons: one strip, one draw
src/battle-scene.ts ─────► effects.impact / heal / anima / stamp / element / comet / trails …
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

PlayCanvas **2.23.3** (latest stable, October 2026) on **WebGPU**, falling back to **WebGL2**. It stays:

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
- **A second camera draws a second scene.** The flat's TV (`src/news-tv.ts`) films a whole Rec
  Comtal set, so it films 15 pictures a second (30 while watching it up close), only while the
  screen is in view, and the set casts no shadows. Before that it was two thirds of the flat's cost.

Reference, M1 Pro, 1440×900 at 2×, walking: the flat about 5 ms of render CPU, Avinguda Meridiana
about 6 ms, Maresme and Rec Comtal 3–5 ms.

2.23 changed two typings: a render component's `type` is a union (`pc.RenderComponent['type']`, not
`string`) and `meshInstance.material` may be `null`.

### WebGPU, WebGL2 and how to tell

`createGame` (src/game.ts) is async: `createDevice` asks `pc.createGraphicsDevice` for WebGPU and
falls back to WebGL2 when the browser has no adapter (Safari without the flag, old drivers,
software rendering). Both look the same; the post pass, fog, shadows and particles were compared
shot by shot on both (`graphics`, `particles`, `scenes`, `city-cutaway`).

- `?gpu=webgl2` skips WebGPU (to compare, or to dodge a bad driver); it works in production too.
- The console says `Gerard 35 dibuja con WebGPU` (or `WebGL2`) once, and
  `window.gerard.game.app.graphicsDevice.isWebGPU` tells in a development build.
- `?stats` shows `pc.MiniStats` (frame, CPU and GPU time, draw calls, VRAM), harmless in production.
- The 3D city map (src/city-3d.ts) keeps its own small WebGL2 app: an unlit model in a panel gains
  nothing from WebGPU, and its synchronous creation keeps the flat-plan fallback simple.

On an M1 Pro (Chromium 141 headless, 1440×900 at 1×, release engine, no frame cap:
`just screenshots gpu-perf --gpu --perf`, then the same with `--webgl`), WebGPU is the smoother of
the two, mostly because the CPU spends less time per draw call (~1000 of them in the street):

| View | WebGPU fps · CPU ms · p95 ms | WebGL2 fps · CPU ms · p95 ms |
| --- | --- | --- |
| Street, following Gerard | 416–501 · 1.8–2.1 · 2.7–3.3 | 254–263 · 3.6 · 7.7–9.0 |
| Street, overview | 383–516 · 1.7–2.3 · 2.7–4.2 | 286–288 · 3.2–3.3 · 5.3–6.8 |
| Palace | 565–656 · 1.3–1.5 · 2.2–2.7 | 123–159 · 6.0–7.8 · 11.5–16.4 |
| Fight with every element going off | 416–469 · 1.7–2.0 · 2.8–3.1 | 399–432 · 1.9–2.1 · 3.4–3.5 |

At the usual 60 fps cap both hold 16.7 ms frames on this machine; the gap is the headroom left
for weaker computers, and the palace's stalls on WebGL2 (one frame in twenty takes ~16 ms) are
gone (ranges over two runs each). In the development build the engine's debug checks make WebGPU *slower* (8 ms of CPU a frame
against 5.6), so always time with `--perf`, never with `just dev`.

### Custom shaders in both languages

WebGPU never transpiles GLSL at runtime (that needs extra wasm downloads), so every custom shader
ships in GLSL and WGSL, side by side and line for line, and a change to one goes into the other:

- **ShaderMaterial** (the particles, `VERTEX`/`FRAGMENT` and `VERTEX_WGSL`/`FRAGMENT_WGSL` in
  src/particles.ts): pass `vertexWGSL`/`fragmentWGSL` next to the GLSL. In WGSL, declare
  `attribute name: vec4f;`, `varying name: vec2f;` and `uniform name: vec3f;` as in GLSL; the
  engine copies attributes and varyings into globals of the same name, uniforms are read as
  `uniform.name`, the vertex writes `output.position` and `output.vName`, and the fragment writes
  `output.color`. The engine's includes (`gammaPS`, `tonemappingPS`, `fogPS`) exist in both and
  keep their function names; `fog_color` becomes `uniform.fog_color`.
- **Chunks on a StandardMaterial** (the building cutaway in src/geo-scenery.ts): set the same chunk
  names in `getShaderChunks(pc.SHADERLANGUAGE_WGSL)` too. Module-level state is `var<private>`,
  and the forward pass ends on `output.color` instead of `gl_FragColor`. Uniforms a chunk declares
  are bound in every pass on WebGPU (shadows too), so give them a value up front.
- Watch the few functions that differ: `atan(y, x)` is `atan2`, GLSL's `mod` is `x - y * floor(x / y)`
  (WGSL's `%` truncates), `discard` and every `if` body need braces, and there is no implicit
  int-to-float.

Check both with `just screenshots particles --gpu` and the same with `--webgl`.

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
  worked, but it would need our own pass in both shader languages and would blur a tall house
  next to Gerard; the depth one is the engine's in GLSL and WGSL.
- **Contact shadows** are the engine's SSAO (`CameraFrame.ssao`), multiplied into the final
  colour: creases where walls meet floors, under furniture, cars and feet. The engine's shader
  rebuilds positions for a perspective camera, which under ours stretches the scene about five
  times sideways and smears the result, so `orthoSsao` swaps two lines (positions from the view's
  real size, `uOrthoSize` = 2 × orthoHeight, and the sampling disk sized by it), in GLSL and WGSL
  (`ORTHO_SSAO`). If an engine update moves those lines it warns and turns SSAO off rather than
  show it wrong. It runs at half resolution (no visible difference here) with a 0.9 m radius.
- The building cutaway also cuts the prepass (`PREPASS_PASS` in src/geo-scenery.ts); otherwise the
  walls cut away in front of Gerard would still be in the depth and blur him.

Tune both in `LOOK.tiltShift` and `LOOK.ssao`. In a development build,
`window.gerard.game.post.tiltShift = false` and `.ssao = false` switch them off to compare, and
`post.frame.debug = 'dofcoc'` or `'ssao'` shows the blur amount (red behind, green in front) or the
occlusion alone. `just screenshots tilt-shift --gpu` (and with `--webgl`) shoots the street, the
overview, the flat, the house, the palace and a fight with neither, SSAO only and both.

Cost at 1440×900 on an M1 Pro (release engine, `--perf`): on WebGPU +0.4–0.7 ms a frame
(about +0.5 ms CPU for ~50% more draw calls, +0.5–0.8 ms GPU); on WebGL2 about +1–2 ms, mostly
the prepass's draw calls. SSAO alone costs about the same as the tilt-shift alone, and both
together little more than either, since they share the prepass.

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
src/post.ts); it stores linear view depth (−z in view space, metres), the same for the ortho camera
and on both backends, and the shader compares it with the particle's own view depth. Pure light
(`additive` 1: sparks, flashes, glows) and `ground` particles keep the cut, so hits stay bright where
they touch and splats never vanish. The building cutaway also cuts the prepass, or particles would
fade behind walls that aren't drawn. Without the post pass there is no depth and particles draw as
before; `window.gerard.game.effects.particles.soft = false` compares (`just screenshots soft-particles`).
The prepass draws the opaque scene a second time (depth only): 30–50 % more draw calls (fight
750 → 977, street 1078 → 1580, palace 1006 → 1549) and, in `just screenshots gpu-perf --gpu --perf`,
about 0.1–0.9 ms more CPU a frame on WebGPU; WebGL2 pays more for the same draws (several ms in
the palace, on a heavily loaded machine). Set `LOOK.softParticles` to false to drop it.

## Effects (`src/effects.ts`)

`KINDS` defines every kind as data; `createEffects` builds the recipes on top:

| Call | What it shows |
| --- | --- |
| `emit(kind, at, count, spread)` | A plain burst of one kind (footfall dust, gum, spores). |
| `impact(target, from, strength, { guarded, gum, feet })` | A blow: flash, sparks flying on through, a ring and dust at the feet; a guarded blow rings blue; gum foes spit drops that splat. |
| `heal(feet, height)` | Cardioide: light rising from a cardioid round the feet, spiralling up. |
| `insight(head)` | Análisis Parálisis: ideas circling over a head. |
| `stamp(feet)` | No-ta: a shockwave of dust and red ink spattered round the print. |
| `anima(body, colour, big)` | An ánima wakes (`big`) or is swapped in: its colour swirls up in strands of light and rings out. |
| `comet(from, to, colour, seconds, options)` | A spell flying in an arc (a trail, below) that flares where it lands. |
| `poof(where)` | Off in a puff of smoke. |
| `confetti(centre, colours)` | The fight is won: confetti that tumbles down and lies where it falls. |
| `element(element, target, { from, strength, feet })` | A hit of `fire`, `ice`, `air`, `energy`, `water`, `earth`, `light`, `shadow` or `gum`. |
| `aura(element, at, seconds, height)` | A state that clings to someone (burning, frozen, charged…); keep `at` updated. |

Each scene has its **air** (`AIR`): dust motes in the light indoors, pollen on the breeze outside,
fireflies in the patio at night, gloom and bubbles in her palace, and her pink gloom outside that
thickens with her light (`setTone`). It fills what the camera sees and survives `clear()`.

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
at the head); Cardioide and Análisis Parálisis fly as comets to whoever they reach (winding round
the caster when it is them); No-ta's stamp streaks down with a speed line at each side; an ánima
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
| No-ta | 100–135 ms | Slams down, punch-in, shake | Strong fringe, bloom swell |
| Knockout | +50 ms (up to 180) | Punch-in | Full fringe, bloom swell |
| The beat (the minion's blow that drops Bernat) | 160 ms or more | Punch-in | Full fringe and bloom |
| Cardioide, Análisis Parálisis | None | — | A soft bloom swell |
| An ánima wakes | None | Punch-in, shake | Full fringe and bloom |
| Ánima swap (L / R) | None | — | A touch of fringe, bloom swell |

- **Hit-stop** is the fight's own clock (`FightClock`): from contact it hands the fight no time for
  the stop, so poses, flashes, squash and the stamp all hold. The held pose is the contact itself
  (the clock rewinds the frame's overshoot and holds that much less), so an action always takes
  `ACTION_SECONDS` plus exactly its stop and its Promise resolves then. Particles keep flying
  through the hold at `HIT.pace` (30%), so the burst blooms out while the bodies are frozen.
- **The camera** runs on real time, so it moves through the hold: a lurch along the blow that
  springs back with one small overshoot (`HIT.spring`), a punch-in of the ortho height on heavy
  blows (`HIT.punch`, critically damped), and a decaying shake for No-ta and an ánima waking. The
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
time through an attack, a dog's bite, a guarded bite, an ánima swap, a No-ta knockout and an ánima
waking, and logs each contact, hold and resolution on screen.

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

**Soft where it should be.** On WebGPU the sun uses PCSS (`SHADOW_PCSS_32F`): it looks for the
casters round each point and widens the penumbra with their distance, so a house's shadow is crisp
at the wall and soft at its far edge, a tree's trunk sharp and its crown blurred. `penumbra` is the
width per metre between caster and receiver; `samples` and `blockerSamples` trade grain in wide
penumbrae for cost. Its wider footprint needs more `normalOffsetBias` (.12) than PCF did against
acne. On WebGL2 PCSS costs tens of milliseconds a frame (it scales with its samples there), so
WebGL2 keeps a fixed 5×5 PCF, still fitted to the view. VSM (`vsm`) was tried: smooth and free of
grain, but evenly soft (no hardening at contact) and its blur passes cost more than PCSS on WebGPU.

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
`just screenshots lighting --gpu` (and with `--webgl`) shows every view after and before.

Measured with `--perf` on an Apple GPU at 1440×900 (GPU ms a frame, street following Gerard):

| | WebGPU | WebGL2 |
| --- | --- | --- |
| Before (PCF 3×3, no fit, no sky) | 1.0 | 4.7–7 |
| Fit + sky, PCF | 1.0 | same, +0.2–0.6 for 5×5 |
| Fit + sky, PCSS 20/12 | 2.2 (1.6 in the overview) | 118–165: not used |
| Fit + sky, VSM | 2.6 | 18–20 |

## What next

In rough order of what each adds for its cost:

1. **Colour grading per scene** with LUTs (`colorLUT`, blending two for transitions) and
   `colorEnhance` (shadows, highlights, vibrance): warm morning in the flat, cool night patio,
   her pink taking over as a LUT blend rather than only lights.
2. **Weather in the story**: choose rain or snow per scene and chapter, and puddles that gather
   and dry where rain has fallen. Settled snow reads as soft patches; an even sheet needs its own
   particle shape (in both shader languages).
3. **Shadows and sky, further**: a normal map on the pools so their sky reflection ripples, a
   second shadow map for the overview on fast GPUs, and a hemisphere ambient from the sky (the
   atlas's own ambient) once the scenes are rebalanced for it.
4. **GPU particles** (compute) once counts need more than ~20k, on WebGPU only, keeping the CPU
   simulation for WebGL2.
