# Chapter 1 · Infancia y casa en Sant Quirze

A 30-minute opening chapter that doubles as the tutorial. It starts on an autumn morning in the
past: it is Gerard's birthday (his age is never stated). He leaves home with Bernat for school,
they walk straight into one of Bernat's games, it turns real (with its villain, La Reina Bubbaloo:
see `docs/lore.md`), and they must conjure their way
out, planting something (**M1**) that pays off later in the story. Along the way Gerard discovers
his power: **changing class by changing mood**, fast.

| Block | Minutes | Status | Where |
| --- | --- | --- | --- |
| 1 · Casa y calle | 0–10 | Playable | Bedroom → kitchen → hall → street → Bernat's door → down the street → first fight |
| 2 · El juego se hace real | 10–20 | Playable | The street turns into La Reina Bubbaloo's palace: the first mini dungeon and Noísta, Gerard's first class ([design](bubbaloo-palace.md)) |
| 3 · Final | — | Playable | Replaced: the palace ends in the Queen's hands, black, and Gerard waking up at 35 (chapter 2) |

## Design principles

- **No objective panel.** Nothing on screen says what to do or where to go (see the game
  philosophy in `AGENTS.md`). Gerard learns where to go the way a kid would: the smell of toast,
  Jan's teasing about a shoebox, Mum telling him the backpack is in the hall and to fetch Bernat.
- **One verb per beat, learned by trying.** Each control shows up once, as a key and a verb
  ("Shift · Correr"), right when it becomes possible, and fades as soon as it is used: walking at
  the start, running with the shoes, items (I) with the backpack, equipment (C) with Bernat.
- **Gates are diegetic.** Nothing stops Gerard without a person saying why: before breakfast he
  thinks "primero, a la cocina"; without the backpack Mum calls him back; while Bernat stalls the
  street itself won't let him leave his friend (a leash of four cells).
- **The world tells you something is wrong.** When Bernat stalls, he mutters over his head, one
  more line each time Gerard pulls away: "¿Gerard…?" → "Espera." → "Esto… ya lo he visto." The
  player turns back because a friend sounds off, not because a panel says so.
- **Seeds pay off within the chapter.** The potion from Jan's desk is the first common item and
  is meant to be used in block 2's fights; the dogs are on screen from the moment Gerard steps
  into the street, and every so often a small pink bubble rises through the manhole beside them,
  easy to miss, long before Bernat mentions it.
- **Catalan at home, Spanish on screen.** Dialogue is in Spanish, with the family's Catalan where
  it is natural: "Per molts anys", "Bon dia", "POCIÓ".
- **Desktop first.** Keyboard prompts (Shift, I, C, E) are written into the notes; the controller
  equivalent follows in brackets.

## Block 1 · Casa y calle (0–10 min) — playable

| # | Beat | Teaches | Budget |
| --- | --- | --- | --- |
| 1 | Title card "Una mañana de otoño · Hoy es tu cumpleaños", Gerard wakes by his bed | Walking (W A S D), looking (E) at the shelves | 1:30 |
| 2 | Jan in his room: "¡Felicidades, enano!", a hint about a shoebox and a "frasco experimental" | Talking | 0:45 |
| 3 | Mum in the kitchen: "Bon dia, campeón! Per molts anys!" → **Zapatillas de correr** | First item; running (Shift / hold B) | 2:00 |
| 4 | Optional: the **Poción** on Jan's desk | Common items | 1:30 |
| 5 | The **Mochila** in the hall; the doors out stay shut until then | Key items vs common (I) | 1:00 |
| 6 | Bernat's doorbell: he congratulates Gerard and joins as a non-playable companion | Party and equipment (C): "modo escuela" | 1:45 |
| 7 | Down the street: dogs below, a faint pink bubble in their manhole; Bernat slows, stops and mutters | Noticing a friend | 1:00 |
| 8 | "¿Un déjà-vu?" "Peor. Es igual… creo que la he cagado." | — | 0:30 |
| 9 | A gum head pokes out of the manhole for a moment, pops a bubble over the dogs and sinks back: their eyes turn dark pink. "¡Ha salido algo rosa de la alcantarilla!" Bernat: "Un esbirro de la Reina Bubbaloo." | — | 0:45 |
| 10 | The dogs attack: **first fight**, straight away and with no tutorial. Escapar is greyed out (the dogs surround them); losing lets them try again | Fighting | 2:00 |
| 11 | Won: the light over Sant Quirze turns dark, pink and strange while they are inside Bernat's game; the houses at the north end start to change → block 2 | — | 0:45 |

Story flags (saved): `intro`, `met-jan`, `got-shoes`, `got-potion`, `got-backpack`,
`bernat-joined`, `bernat-stalled`, `dejavu`, `minion`, `first-fight`. Battles with the dogs stay
off until `dejavu`; from `minion` on the dogs are possessed, and `first-fight` keeps Sant Quirze
in La Reina Bubbaloo's light. The palace block adds `palace`, `in-palace`, `got-chicle`, `noista`
and `wrapper-room` (see the [palace design](bubbaloo-palace.md)).

### How it is built

- `src/story.ts` is the whole state machine and has no DOM or engine code: game events
  (`interact`, `south`, `leash`, `start`, `minion`, `battle`) go in, ordered effects (`dialogue`,
  `item`, `hint`, `card`, `minion`, `battle`) come out. Everything else is derived from the flags: Bernat's bubble, items,
  party, NPCs and pickups per scene, gates, where to resume. `tests/story.test.mjs` plays the
  block from start to end.
- `src/chapter-1.ts` holds the content: lines, places (checked to be walkable by the tests),
  key hints, cards, Bernat's bubbles, and the leash length.
- `src/game.ts` draws the cast from the story (Mum, Jan, floating pickups, Bernat), hides
  Gerard's backpack until he has it, blocks NPC cells, turns cells beyond the leash into walls,
  and reports the south row and leash tugs.
- `src/minion.ts` builds and animates La Reina Bubbaloo's minion under the manhole (the faint
  hint bubbles, and its one brief appearance with the gum bubble). `src/battle-scene.ts` swaps the dogs' eyes to the possessed
  pink, and `src/scenery.ts` blends any scene towards La Reina Bubbaloo's light (`setTone`).
- `src/follower.ts` makes Bernat walk Gerard's own breadcrumb trail, so he never cuts corners
  through walls (`tests/follower.test.mjs`).
- `src/story-ui.ts` shows title cards, item notes, key hints and Bernat's speech bubble; `src/exploration-ui.ts` is the
  status screen: Estado (equipment, stats), Objetos (Comunes / Objetos clave), Mapa and Diario.
- The server stores the flags next to the score and only ever adds to them.
- Mum, Jan and Bernat use placeholder models recoloured from young Gerard
  (`src/characters/mama.json`, `jan-child.json`, `bernat-child.json`). Replace them with
  `just character <id>` when there are photos, and add their portraits for the dialogue banner.

## Block 2 · El juego se hace real (10–20 min) — plan

> Built as [La Reina Bubbaloo's palace](bubbaloo-palace.md): the houses at the north end turn into
> her palace, a first mini dungeon where Gerard unlocks the Noísta class. The notes below are the
> earlier idea, kept for reference.

1. **The switch** (now in block 1). The minion possesses the dogs, the first fight happens, and the
   light turns pink and gloomy. Still open: whether the HUD should also take La Reina Bubbaloo's
   colours.
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

> Dropped. Chapter 1 now ends inside the palace: La Reina Bubbaloo's hands catch Gerard and Bernat,
> everything goes black and Gerard wakes up at 35 in Barcelona (see the [palace design](bubbaloo-palace.md)).
> Kept for reference.

1. **A bigger Bubbaloo minion** as the mini boss (to be designed), with phases that each favour a
   different mood (a gum shield → Enfadado; a swarm of little bubbles that spreads damage → Alegre; a big
   charged swipe → Tranquilo). The dogs from block 2 can return as adds in the last phase.
2. **The way out (M1).** Beaten, the game does not end. Bernat remembers how his notebook game
   ended: the heroes conjure something to leave. The player chooses the conjuro (a short list),
   and the choice is saved as a story flag so later chapters can read it.
3. **Back to reality.** A white-out, the street as it was, the dogs just dogs, the morning light
   back. They run (Shift) to school and arrive late; the teacher's line closes the chapter.
4. End card and a transition towards chapter 2 (Meridiana), keeping the mood power unlocked.

## Risks and choices

- **Length.** Ten minutes for block 1 assumes players read every line. The beats are short on
  purpose and the auto-advancing dialogue keeps a slow reader moving; the potion is optional.
- **Street length.** Passatge Maresme is short; the school is off-map. Block 3's run to school
  can be a short cut-scene instead of a new map.
- **Reloads.** Progress resumes at the last milestone (bedroom before the backpack, street after
  it). Mid-block positions are not saved yet; that is enough for a 10-minute block.
- **Placeholder people.** Mum, Jan and Bernat need real models and portraits before release.
