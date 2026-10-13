# El Palacio de la Reina Bubbaloo · plan

The first mini dungeon of the game, and the place the game comes back to for its final dungeon.
In chapter 1 it rises at the **north end of Passatge Maresme**, the opposite end of the street from
the first fight, and it is gone again when the boys return to reality at the end of the chapter.
In **phase two it reappears in Barcelona, on top of Gerard's school**. It is the same building in
both places: in chapter 1 the party only sees its front, its hall and one wing, and the rest is
designed now so that later visits open new doors in it. Story context lives in `docs/lore.md`;
this file says how the palace looks and plays.

Status: **plan**, nothing built yet.

## The beat in one paragraph

After the first fight the light has turned pink. Then the houses at the north end of the street
start to change: gum creeps up their walls, wrapper-twist towers push out of their roofs, and
behind them the palace inflates like a blown bubble. Bernat: *"Es justo como en mi sueño… se está
volviendo real."* The boys walk up the street, through the bubble that seals the gate, and into
the palace. They explore the hall and a gallery, step into a room full of giant wrappers, and a
minion rises from a drain in the floor. Nothing they do hurts it. When it is about to finish
Bernat (*"¡Gerard, me va a matar!"*), Gerard shouts *"¡No!"*. That unlocks his first class,
**Noísta**: his clothes and colours change, the battle interface takes on the class's style, and
he gains **No-ta**, the one skill that hurts the minion. It kills it.

## Story order

| # | Beat | Teaches | Budget |
| --- | --- | --- | --- |
| 1 | After-fight lines; then Bernat looks north: *"Gerard… mira las casas del fondo."* | — | 0:15 |
| 2 | **The transformation** (cut-scene, about 8 s, see below). Bernat: *"Es justo como en mi sueño… se está volviendo real."* | — | 0:30 |
| 3 | Walk up the street. The usual street, now pink; the dogs gone; the palace grows on screen as they approach. Bernat's bubble if Gerard dawdles south: *"Es por el otro lado."* | Walking with purpose | 1:00 |
| 4 | **The forecourt and the gate**: the pink runner, the twist towers, the bubble over the gate. *"Atravesar la pompa"* pops it. | — | 0:45 |
| 5 | **Vestíbulo de las Burbujas**: look around, the fountain, the sealed stair and the sealed east door each explain themselves | Exploring, looking (E) | 2:00 |
| 6 | **Galería de los Retratos**: portraits of the Queen as Bernat imagined her; an optional *Chicle de fresa* | Looking; a common item | 1:30 |
| 7 | **Sala de los Envoltorios**: the drain gurgles, the minion rises, the fight starts | — | 0:20 |
| 8 | **The unwinnable fight**: every hit is swallowed by the gum; the minion goes after Bernat | Trying everything | 2:00 |
| 9 | *"¡Gerard, me va a matar!"* *"¡No!"* → Noísta: new look, new interface style, **No-ta** | A new class and a skill, by using them | 0:45 |
| 10 | No-ta kills the minion. The wrapper room's sealed door unsticks: a way back to the hall. End card. | — | 0:45 |

About 10 minutes, matching the 10–20 min block that `docs/chapter-1.md` keeps for "El juego se hace
real". The **Continuará…** card moves from after the first fight to the end of beat 10.

Story flags to add, in order: `palace` (the street has changed), `in-palace` (went through the gate),
`noista` (class unlocked), `wrapper-room` (minion beaten). The server's `STORY_FLAGS` follows, as today.

Diegetic gates (nothing on screen says where to go):

- The **south end** of the street after the transformation: Bernat's bubble, *"Es por el otro lado."*
- **Home** is still enterable; Mum is not there and the house is in the pink light (a small, eerie touch).
- **The stair to the throne** in the hall: the *Cortina de Chicle*. Gerard: *"Está pegajosa. No hay
  manera de pasar."* Bernat: *"En mi sueño la reina estaba arriba. Pero aún no… aún no."*
- **The east door** (Ala Líquida): gum oozes from under it. *"Detrás suena como si algo hirviera.
  Mejor no."*
- **The wrapper room's north door**: stuck shut until the minion falls; then it peels open with a
  long sticky sound and leads straight back to the hall (a shortcut, like a classic dungeon loop).

## The exterior: La Puerta de la Reina

The palace has to read as one silhouette from anywhere on the street, because players will see it
over the rooftops for the rest of the chapter, and because the final dungeon starts here. The
camera looks from the south-east, so the façade faces the camera as Gerard walks north: the front
is the side worth building.

**Placement.** The palace stands just past the north edge of the map, behind the widened end of the
street (cells x 8–24, z 2–6). Its gate opens at **x 16, z 2**, on the axis of the street. The grid
does not grow: the palace body sits beyond the north wall (z < 2) on its own gum plinth, so the
street stays the playable forecourt and the interior is a separate scene (`palacio`).

**Silhouette, back to front:**

```
                      ♛  Torre de la Corona (centre, tallest; a crown of gum points,
                     ███    a balcony facing the street: the Queen's balcony, used later)
          ◯         █████         ◯     Cúpulas de pompa: translucent bubble domes
         ╱§╲    ▄▄▄▄█████▄▄▄▄    ╱§╲    with a glowing liquid core
         │§│   █  drip  drip █   │§│    Torres de envoltorio: spiral-striped twist towers,
         │§│   █   ╭─────╮   █   │§│    the twisted ends of a Bubbaloo wrapper, pink and white
    ▓▓▓▓▓│§│▓▓▓█   │ ◌ ◌ │   █▓▓▓│§│▓▓▓▓▓   Muralla de chicle: a rampart with drips
    west-0 house  │  pompa  │   east-0 house  La Pompa: the gate, sealed by a wobbling bubble
    (gum-coated)  ╰───┬───╯   (gum-coated)
                 pink runner
              ═══ forecourt (z 2–6) ═══
```

**Pieces** (all procedural, like the rest of the street):

- **Muralla de chicle**: a long rampart of glossy plum-pink gum across the north edge, with a rounded
  top edge (no crenellations; gum does not have sharp corners) and drips frozen mid-fall, a few
  of them animated very slowly.
- **La Pompa**: the gate is a round arch shaped like a pursed gum-ball mouth, with a thick lip.
  A translucent bubble fills it and wobbles; it catches the street lamps. Walking up and pressing E
  (*"Atravesar la pompa"*) pops it (goo and spores, the minion's own effects) and changes scene.
  It reforms behind them, so the gate always looks sealed from the street.
- **Torres de envoltorio**: two towers flanking the gate, built from stacked twisted segments
  striped pink and white like a wrapper's twisted end, flaring at the top.
- **Cúpulas de pompa**: on top of each tower, a translucent bubble dome with a glowing pink core
  (Bubbaloo's liquid centre). They pulse slowly; at night-pink they are the brightest thing in
  the scene, so the palace reads even in the overview.
- **Torre de la Corona**: the central keep behind the gate, the tallest piece, topped by a crown
  of soft gum points with a gum ball on each. Halfway up, the **Queen's balcony** looks down the
  street (empty in chapter 1; the place for a future appearance).
- **The north houses join in**: `west-0` and `east-0` (and, more faintly, `west-1` and `east-1`)
  stay recognisable but get a gum coating that has crept up from the ground, drips from the
  eaves, a small bubble dome on the roof and a twist chimney. The palace grows *out of* the
  neighbourhood instead of replacing it.
- **The forecourt**: a pink runner from z 6 to the gate covers the *SANT QUIRZE* floor sign (one
  letter peeks out at the edge). The plane tree at (16, 4) is wrapped in a ribbon of gum. Two
  liquid-centre lanterns stand either side of the runner.

**The transformation** (cut-scene; nothing else on screen):

1. Gerard and Bernat stop. The camera eases to the overview (the existing `R` view) so the whole
   street is visible, and holds Gerard's position marked by the boys themselves.
2. 0–2 s: a low wobble in the camera; gum rises up the walls of the north houses from the
   ground to the eaves (the coating scales up in y).
3. 2–5 s: the palace inflates behind them, piece by piece, each with a bubble-gum overshoot
   (scale 0 → 1.15 → 1): rampart, towers, domes, finally the crown tower.
4. 5–6 s: the gate's bubble blows and settles; a ring of spores puffs over the forecourt.
5. Back to the follow camera; Bernat's line.

## The interior: scene `palacio`

A new plan-based scene, like the house, with its own builder (`src/palace-scenery.ts`) because the
house builder knows a family flat, not a gum palace. Same rules: walls fold away when they hide
Gerard, rooms have floors and levels, interactions are cells with lines or travel.

**Look:** plum-and-rose checkerboard floors polished like wet candy; glossy gum walls with soft
rounded tops and drips; twisted wrapper columns; floating bubbles that drift up and pop at the
ceiling; light from liquid-centre lanterns (pink point lights) and a faint violet ambient. Always
in La Reina Bubbaloo's light (`setTone(1)`), plus a slow pulse in the lanterns, as if the building
breathed. The floor plan reads as a palace from above even with walls folded: symmetry around the
north–south axis, a strong centre.

**The whole palace** (the final dungeon; chapter 1 opens only the shaded part):

```
 north
 ┌───────────────────────────────────────────────────────────────┐
 │                   SALÓN DEL TRONO (later)                     │
 │    throne of a giant gum ball · the balcony over the street   │
 └──────────────┬─────────────────────────────────┬──────────────┘
 ┌──────────────┴──────┐  TORRE DE LA CORONA  ┌───┴──────────────┐
 │  COCINAS DEL CHICLE │  (stair; later)       │  ALA LÍQUIDA     │
 │  (later: a chewing  │         ║             │  (later: flooded │
 │   machine, conveyor │   Cortina de Chicle   │   with liquid    │
 │   belts)            │         ║             │   centre, gum    │
 ├═════════════════════┤         ║             │   bridges)       │
 │░ SALA DE LOS       ░│  ┌──────╨──────┐      │                  │
 │░ ENVOLTORIOS       ░│  │░░░░░░░░░░░░░│      └────────▲─────────┘
 │░ (the fight; drain ░│  │░ VESTÍBULO ░│        sealed door (oozes)
 │░  in the middle)   ░╞══╡░ DE LAS    ░╞═════════════╛
 │░░░░░░░░░▲░░░░░░░░░░░│  │░ BURBUJAS  ░│
 └─────────┼───────────┘  │░ (fountain)░│
 ┌─────────┴───────────┐  │░░░░░░░░░░░░░│
 │░ GALERÍA DE LOS    ░╞══╡░░░░░░░░░░░░░│
 │░ RETRATOS          ░│  └──────╥──────┘
 └─────────────────────┘     La Pompa (from the street)
 south                       ░ = open in chapter 1
```

### Vestíbulo de las Burbujas

- Double-height hall, about 11 × 9 cells, entered from the south through the inside of La Pompa.
- **El Corazón Líquido**: a round fountain in the centre, a basin of glowing pink liquid that
  bubbles up and drips back. Looking: *"Huele a fresa. Y a algo que no es fresa."*
- Four twisted wrapper columns around the fountain; between them, floating bubbles rise and pop.
- North: a wide stair rising to a landing, blocked by the **Cortina de Chicle** (strings of gum
  hanging like a bead curtain, swaying). The gate's lines are above.
- East: a tall door with gum oozing from under it (the Ala Líquida, later). West: an open arch to
  the gallery, the only obvious way on. A small arch in the north-west corner is stuck shut: the
  back door of the wrapper room, which opens after the fight.

### Galería de los Retratos

- A long west-wing corridor (about 13 × 3 cells) with a runner down the middle and liquid-centre
  sconces between frames.
- **Five portraits of La Reina Bubbaloo** as Bernat invented her (her look is in `docs/lore.md`;
  it is invented and has nothing of Nuria Mendoza, and no portrait hints at her):
  1. **La coronación**: she lowers the crown of gum balls onto her own head. Gerard: *"Se corona
     ella sola."*
  2. **En el trono**: sitting on a giant gum ball, legs crossed, sceptre resting on her shoulder.
  3. **La gran pompa**: blowing a bubble bigger than herself; the frame is dented where it pressed.
     Bernat: *"Esa la dibujé yo. Igualita."*
  4. **Desde el balcón**: waving from the palace balcony over a city at night that is not Sant
     Quirze: a tall tower lit up in colours, a long straight avenue. A quiet nod to Barcelona,
     where the palace appears in phase two. Nobody comments on it.
  5. **El dibujo**: a child's drawing in felt-tip pens, in a gold frame, signed *Bernat*. Bernat
     goes quiet: *"…Esto estaba en mi libreta."*
- Looking at each gives a short line from Gerard or Bernat.
- A sweet bowl on a side table: **Chicle de fresa** (common item, heals 20), optional.
- At the north end, an arch into the wrapper room.

### Sala de los Envoltorios

- A square room (about 9 × 9 cells) filled with giant crumpled wrappers (low, walkable around),
  pink-and-white ribbons hanging from the ceiling, and a **round drain grate in the middle**. The
  minion lives in drains (lore), so it rises from there, the same way the first one did.
- On entering: the drain gurgles, a bubble rises and pops, and the minion oozes up and grows to
  full size (a bigger version of the street minion, 1.5×). Bernat: *"Ese no se va a esconder."*
  The fight starts.
- North-east: the stuck door back to the hall.

## The fight and Noísta

### The unwinnable part

- **Foe:** *Esbirro de la Reina*, 40 HP, with **Pringue**: a gum shell that swallows every hit
  (damage 0, and a pop over the target: *"¡El chicle se lo traga!"*). Attacks and Impulso do
  nothing; Defender and Ánimo still work, so trying things is never pointless, only not enough.
- **No escape**, as in the first fight (the door has sealed behind them).
- **It goes for Bernat.** Its spit (*Escupitajo pegajoso*) targets Bernat, and its damage grows
  each round (*"el pringue crece"*), so healing and guarding buy time but cannot stall forever.
  Its hits never knock Bernat out: the first hit that would leave him at 20 HP or less stops at
  that line and **triggers the beat** (by round 4–5 whatever the player does).
- Gerard is only targeted lightly, so he is never the one about to fall.

### The beat (inside the battle)

The battle interface stays up; the scene plays over it:

1. Everything freezes for a moment. Bernat is down on one knee; the minion rears back for the last
   hit.
2. Speech bubbles over the fighters (inside the battle, since the rest of the HUD is inert during
   fights): Bernat, *"¡Gerard, me va a matar!"*
3. Gerard, in a bigger bubble that shakes the screen: *"¡NO!"*
4. A shockwave from Gerard throws the minion back a step. A white flash on Gerard, and when it
   fades he wears the **Noísta** look. The battle interface switches theme with a short wipe.
5. A banner inside the battle: **CLASE DESBLOQUEADA · NOÍSTA**, *"Dice que no. Y el mundo le hace
   caso."*
6. Gerard's turn. **Habilidades** pulses once; inside it, **No-ta** is new. No key hint and no
   instructions: it is the only new thing on screen, and the only one that has not failed yet.

### No-ta

- Costs 10 of Gerard's secondary bar. A rotund NO: **ignores and removes Pringue** and deals
  40 damage, enough to kill the minion in one go.
- Animation: a huge red rubber stamp reading **NO** slams down on the target (camera kick,
  sparks in Noísta red), leaving the word printed on the ground for a second. The minion goes rigid,
  cracks like old gum and pops into goo, which drains away down the grate.
- Why it works (lore): the Queen's minions make things **obey**. Gerard's power is to **refuse**.
  This makes Noísta the natural counter to La Reina Bubbaloo, and a reason why only Gerard can face her.

### Noísta: look and interface

- **Gerard's look** changes a little, not into a costume: the mustard shirt with navy stripes
  becomes **crimson with charcoal stripes**, the trousers charcoal, the glasses get red frames,
  and he wears a short crimson scarf tied at the neck that flutters when he runs. The look stays
  outside battle too (it is his active class), and the dialogue portrait gets a tinted variant
  when there is a generated one.
- **Interface style** (the active class drives the shared `--ui-*` variables on `#hud`, so battle,
  journal and hints change together):
  - colours: ink `#1b1216`, accent **crimson** `#e2483d` (replaces the gold), paper bone `#f4ece2`,
    muted `#c9b3ad`;
  - shapes: protest-poster style, with command cards slanted a few degrees, a hard offset shadow in
    crimson, and a faint diagonal **NO** watermark in the battle background;
  - type: the battle title and kicker in heavy condensed italics, as if stamped.
- **Character panel (C)**: Gerard's card shows *Clase · Noísta* and No-ta.

### How classes fit the game

**Noísta is the first class.** It comes from Gerard himself: he always contradicts, always says the
opposite. Here that habit becomes a power at the moment it matters most. How classes work beyond
this one (how many, where they come from, how switching works, and how it relates to the moods
in `docs/chapter-1.md`) is **left open on purpose**, to be thought through later. Build Noísta so
that it does not decide that: one class, its look, its theme and its skill.

## Build plan

Four steps, each playable and tested on its own, each with a screenshot scenario.

1. **The palace exterior and the transformation**
   - `src/palace.ts`: builds and animates the exterior (rampart, gate and bubble, twist towers,
     bubble domes, crown tower with balcony). A `grow(progress)` drives the transformation and
     `set(state)` places it for reloads. It takes a base (position, footprint, height) so the same
     palace can stand at the end of the street now and **on top of Gerard's school in Barcelona**
     in phase two. The street-only parts (the gum coating on the north houses, the forecourt runner
     and lanterns) live beside it, not inside it.
   - `src/game.ts`: shows it on `maresme` when `story.has('palace')`, runs the cut-scene with the
     overview camera, adds the gate interaction (*Atravesar la pompa* → `palacio`), and extends
     the overview framing to include the palace.
   - Story: after-fight → `palace` effect → transformation → Bernat's line; south-end bubble;
     the end card moves to the end of the block. Tests in `tests/story.test.mjs`.
   - Scenario `scripts/screenshots/palace-exterior.json`.
2. **The interior scene**
   - `palacio` in `src/environments.ts`: plan, rooms, interactions, doors (the curtain, the east
     door, the stuck back door) and the gate back to the street. Walkability tests like the house's.
   - `src/palace-scenery.ts`: floors, gum walls that fold, columns, the fountain, floating bubbles,
     portraits, wrappers, the drain, the curtain, lanterns.
   - The *Chicle de fresa* item in `src/items.ts`.
   - Scenario `scripts/screenshots/palace.json` (a tour of the three rooms).
3. **Battles beyond dogs**
   - Foes get a kind (`dog` | `minion`) instead of assuming dogs: names, models and colours in
     `src/battle.ts`, `src/battle-scene.ts`, `src/battle-ui.ts` (today `DOG_PROFILES` is wired in
     everywhere). The minion fighter reuses `src/minion.ts`.
   - Rules: `Pringue` (shell), escalating targeted attacks, a damage floor that triggers a
     scripted **beat**; pure and tested in `tests/battle.test.mjs`.
   - In-battle speech bubbles and the class banner in `src/battle-ui.ts`.
4. **Noísta**
   - `src/classes.ts`: class definitions (name, look overrides by material, UI theme, skills).
     `noista` flag → active class; Gerard's materials recoloured and the scarf part added in
     `src/game.ts` / `src/character-model.ts`; battle clones pick it up.
   - No-ta in `src/battle.ts` (cost, ignores and removes Pringue); the stamp effect in
     `src/battle-scene.ts`; theme via `#hud[data-class="noista"]` in `src/style.css`.
   - Party panel shows the class. Scenario `scripts/screenshots/noista.json` covering the fight
     from the first swallowed hit to the stamp.
   - Docs: `docs/lore.md` (palace, Noísta, why it counters the Queen), `docs/chapter-1.md`.

## Decisions

- **Noísta** comes from Gerard always contradicting. The wider class system stays open (see
  *How classes fit the game*).
- **The palace leaves Sant Quirze** when the boys return to reality at the end of chapter 1. In
  phase two it reappears in **Barcelona, on top of Gerard's school**. So `src/palace.ts` must sit on
  any base, a street end or a school roof, and its growth animation must work in both places.
- **No portrait hints at Nuria Mendoza** for now; the Queen's portraits show an invented look.

## Open questions

1. **Sueño or libreta.** Until now Bernat *designed* the game in his notebook; here he *dreamed* it.
   Undecided. The lines can carry both for now: the palace is "como en mi sueño", and the fifth
   portrait is a drawing "de mi libreta".
2. Does block 3 (the conjuro, back to reality) start inside the palace or back on the street?
