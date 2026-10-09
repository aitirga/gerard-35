# Chapter 1 · Infancia y casa en Sant Quirze

A 30-minute opening chapter that doubles as the tutorial. It starts on an autumn morning in the
past: it is Gerard's birthday (his age is never stated). He leaves home with Bernat for school,
they walk straight into one of Bernat's games, it turns real, and they must conjure their way
out, planting something (**M1**) that pays off later in the story. Along the way Gerard discovers
his power: **changing class by changing mood**, fast.

| Block | Minutes | Status | Where |
| --- | --- | --- | --- |
| 1 · Casa y calle | 0–10 | Playable | Bedroom → kitchen → hall → street → Bernat's door → down the street |
| 2 · El juego se hace real | 10–20 | Planned | The bottom of Passatge Maresme, now inside Bernat's game |
| 3 · Mini boss y salida | 20–30 | Planned | The scarecrow, the conjuro, back to reality |

## Design principles

- **One verb per beat, taught right before it is needed.** Running arrives with the shoes, just
  before the long street; items arrive with the backpack, just before they matter; the party
  window arrives when Bernat joins. A tutorial note never explains something the player cannot
  try right away, and each note closes itself (✓) once the player has done it.
- **Gates are diegetic.** Nothing stops Gerard without a person saying why: before breakfast he
  thinks "primero, a la cocina"; without the backpack Mum calls him back; while Bernat stalls the
  street itself won't let him leave his friend (a leash of four cells).
- **The HUD is part of the story.** When Bernat stalls, the objective line glitches: wrong colours,
  a monospace shout, jitter, and wording that sounds like a game talking to its players ("DEBÉIS IR
  JUNTOS" → "ESPERA A BERNAT" → "PREGÚNTALE QUÉ PASA"). It escalates each time Gerard pulls
  against the leash. The interface foreshadows "a game inside the game" before anyone says it.
- **Seeds pay off within the chapter.** The potion from Jan's desk is the first common item and
  is meant to be used in block 2's tutorial fight; the scarecrow and the dogs are on screen from the
  moment Bernat joins, so the boss of block 3 has been in plain sight for twenty minutes.
- **Catalan at home, Spanish on screen.** Dialogue is in Spanish, with the family's Catalan where
  it is natural: "Per molts anys", "Bon dia", "POCIÓ".
- **Desktop first.** Keyboard prompts (Shift, I, C, E) are written into the notes; the controller
  equivalent follows in brackets.

## Block 1 · Casa y calle (0–10 min) — playable

| # | Beat | Teaches | Budget |
| --- | --- | --- | --- |
| 1 | Title card "Una mañana de otoño · Hoy es tu cumpleaños", Gerard wakes by his bed | Move, look (E) at the shelves | 1:30 |
| 2 | Jan in his room: "¡Felicidades, enano!", a hint about a shoebox and a "frasco experimental" | Talking | 0:45 |
| 3 | Mum in the kitchen: "Bon dia, campeón! Per molts anys!" → **Zapatillas de correr** | First item; running (Shift / hold B) | 2:00 |
| 4 | Optional: the **Poción** on Jan's desk | Common items | 1:30 |
| 5 | The **Mochila** in the hall; the doors out stay shut until then | Key items vs common (I) | 1:00 |
| 6 | Bernat's doorbell: he congratulates Gerard and joins as a non-playable companion | Party and equipment (C): "modo escuela" | 1:45 |
| 7 | Down the street: dogs and a scarecrow below; Bernat slows, stops; the HUD glitches | Reading the objective | 1:00 |
| 8 | "¿Un déjà-vu?" "Peor. Es igual… creo que la he cagado." → "Continuará…" | — | 0:30 |

Story flags (saved): `intro`, `met-jan`, `got-shoes`, `got-potion`, `got-backpack`,
`bernat-joined`, `bernat-stalled`, `dejavu`. Battles with the dogs stay off until `dejavu`.

### How it is built

- `src/story.ts` is the whole state machine and has no DOM or engine code: game events
  (`interact`, `south`, `leash`, `start`) go in, ordered effects (`dialogue`, `item`,
  `tutorial`, `card`) come out. Everything else is derived from the flags: objective, items,
  party, NPCs and pickups per scene, gates, where to resume. `tests/story.test.mjs` plays the
  block from start to end.
- `src/chapter-1.ts` holds the content: lines, places (checked to be walkable by the tests),
  tutorials, cards, objectives, and the leash length.
- `src/game.ts` draws the cast from the story (Mum, Jan, floating pickups, Bernat), hides
  Gerard's backpack until he has it, blocks NPC cells, turns cells beyond the leash into walls,
  and reports the south row and leash tugs.
- `src/follower.ts` makes Bernat walk Gerard's own breadcrumb trail, so he never cuts corners
  through walls (`tests/follower.test.mjs`).
- `src/story-ui.ts` shows the objective, title cards and notes; `src/exploration-ui.ts` adds the
  Objetos panel (Comunes / Objetos clave) and the Equipo cards in Personaje.
- The server stores the flags next to the score and only ever adds to them.
- Mum, Jan and Bernat use placeholder models recoloured from young Gerard
  (`src/characters/mama.json`, `jan-child.json`, `bernat-child.json`). Replace them with
  `just character <id>` when there are photos, and add their portraits for the dialogue banner.

## Block 2 · El juego se hace real (10–20 min) — plan

1. **The switch.** Right after the déjà-vu, the street "loads" Bernat's game: palette shift and
   light fog, a grid flash over the cobbles, and the HUD restyles itself in the glitch colours for
   good. The dogs turn to face the pair; the objective reads like a quest log.
2. **Tutorial fight 1 (one dog).** Attack and defend only; Bernat narrates the rules of "his" game
   ("¡En mi juego, si te defiendes, el siguiente golpe duele la mitad!").
3. **Tutorial fight 2 (two dogs).** Skills, and the **Poción** from Jan's desk as the first use
   of a common item in battle (if the player skipped it, Bernat has a spare and says so).
4. **The power.** A dog that only guards cannot be hurt by Gerard's normal style. When Gerard is
   about to lose, a scripted beat triggers his power: **cambio de humor**, a quick class swap that
   costs no turn once per round. Three moods to start: *Alegre* (support, heals), *Enfadado*
   (damage, breaks guard) and *Tranquilo* (defence). The guarding dog falls to Enfadado.
5. **Open question:** Bernat is "no controlable". In battle he could act on his own (reusing the
   enemy AI pipeline in `ai.py` with an ally prompt) or be commanded like today. The plan assumes
   he acts on his own with a visible intention line, so the player only drives Gerard.

Build notes: mood classes live in `src/battle.ts` as pure rules (stats and skill sets per mood,
a swap action), tested like the existing battle tests; the world switch is a scenery theme
(`scenery.ts` materials and fog) plus a CSS class on `#hud`.

## Block 3 · Mini boss y salida (20–30 min) — plan

1. **L'Espantaocells.** The scarecrow wakes up as the mini boss, with phases that each favour a
   different mood (a straw shield → Enfadado; a crow swarm that spreads damage → Alegre; a big
   charged swipe → Tranquilo). The dogs from block 2 can return as adds in the last phase.
2. **The way out (M1).** Beaten, the game does not end. Bernat remembers how his notebook game
   ended: the heroes conjure something to leave. The player chooses the conjuro (a short list),
   and the choice is saved as a story flag so later chapters can read it.
3. **Back to reality.** A white-out, the street as it was, the dogs just dogs, the scarecrow back
   in a garden. They run (Shift) to school and arrive late; the teacher's line closes the chapter.
4. End card and a transition towards chapter 2 (Meridiana), keeping the mood power unlocked.

## Risks and choices

- **Length.** Ten minutes for block 1 assumes players read every line. The beats are short on
  purpose and the auto-advancing dialogue keeps a slow reader moving; the potion is optional.
- **Street length.** Passatge Maresme is short; the school is off-map. Block 3's run to school
  can be a short cut-scene instead of a new map.
- **Reloads.** Progress resumes at the last milestone (bedroom before the backpack, street after
  it). Mid-block positions are not saved yet; that is enough for a 10-minute block.
- **Placeholder people.** Mum, Jan and Bernat need real models and portraits before release.
