# University friends · (working title)

Status: **playable from start to end** on `feature/side-mission-uni` (the ánima's skills wait for the user's design round) · Last updated: 2026-11-07

**Decided** means the user said so. **Proposal** means it came from the design side and is waiting
for a yes.

## Summary

Gerard's friends from university have come to the beach for his birthday, with the Queen's violet
eyes. They stare at the sea, say things that are slightly wrong, and then want to play tag, with pink
tentacles. The only way out is into the water, after Anna and into the spiral, which opens onto the campsite where they spent their summers. The ánima is
still to design.

## Protagonist

- Who (decided): **three couples from university: Anna and Álvaro, Miquel and Sarah, Soraya and
  Guillem. Guillem does not appear in this mission.**
- **Nico** (decided round 6) and **Joan** (decided round 8) are in it too, both on their own: **seven
  friends** on the beach and in La Sobremesa.
- Relation to Gerard and Aitor: from university; which degree and whose friends they are first:
  _open_
- Life now: **many of them have children** (decided; who has how many: _open_).
- Job and routine: _open_
- Unmistakably them:
  - **Anna** loves cold water and danger (decided).
  - **Álvaro** loves games (decided).
  - The others: _open_
- As students: _open_
- **The group's ritual** (decided, real): for years they all went **camping together**, at a campsite
  with a pool, near the beach. The tradition was **a photo of all of them together with a melon**.
  Which campsite, where, which years and why a melon: _open_

## Place

- Where (decided): **the beach**, `barceloneta` (Platja de Sant Miquel, L'Estel Ferit,
  `docs/places/barceloneta.md`). The user said "la playa", and this is the game's only beach; to
  confirm.
- How to get there: L4 to Barceloneta, as today.
- Scene: **exists**, with no story in it yet. It is the brightest place in the game, and that helps:
  the threat happens in full midday sun.
- **To build**: the sea is the zone's border today, so a walkable strip of shallow water is needed
  for Anna and the spiral.

## The problem

- What the Queen did (decided): **she holds them all**: violet eyes, a threatening look, and very
  strange things said. They have gathered "to celebrate" Gerard's birthday.
- This extends the rule from Uri (`docs/lore.md`): people she holds get violet eyes and turn kid.
  Here the kid is a game of tag played by adults who mean it.
- **What it costs them** (decided): they have left their children at home and come running to
  "congratulate" Gerard. It must stay murky.
- Routine vs. ilusión, here (proposal): these are friends who are always saying *"a ver si quedamos"*.
  Now they finally have, all of them, dropping everything, and that is the horror: she gives them the
  time they never had by taking away what they had to do.

## Clues

| Clue | Where | Flag |
| --- | --- | --- |
| Aitor: *«El grupo de la uni lleva toda la mañana escribiendo. Que te esperan en la playa de la Barceloneta.»* | The first time down into the metro, and every morning after until they have been to the beach (`LINES_UNI.clue`) | `clue-uni` |

The beach is the L4's own stop on the network map, so a person pointing there is enough (built).

## Unusual things

- All of them with their backs to the party, looking out to sea (decided).
- Their violet eyes when they finally turn (decided).
- Pink tentacles coming out of them (decided).
- Anna out in the water, and the spiral just past the shoreline (decided).

## Beats

1. **Arrival**: they are all together on the sand, looking out to sea (decided).
2. **The conversation** (decided content; the lines are proposals):

   ```text
   Miquel  Anna se ha ido directa al agua. Ya sabes cómo es.
   Sarah   Le encanta el agua fría. Y el peligro.
   Miquel  Felicidades, Gerard. Treinta y cinco.
   Sarah   Hemos dejado a los niños en casa. A todos. Hemos venido corriendo a felicitarte.
   Aitor   ¿Con quién los habéis dejado?
           (Nobody answers.)
   Soraya  He dejado a Guillem. Ahora tengo muchísimo tiempo. Para vosotros. Muchísimo.
   Álvaro  Con lo que me gustan a mí los juegos. Vamos a jugar al pilla-pilla.
           (They all turn at once and stare. The violet eyes. The tentacles come out.)
   Álvaro  Nos la quedamos nosotros.
   ```

3. **Pilla-pilla** (decided): they chase the party towards the sea, where Anna is.
4. **Caught is game over** (decided): the game goes back to just before the conversation.
5. **The spiral** (decided): it is there beside Anna from the start; near her, she comes apart into
   particles that fall into the spiral typical of Nuria and Uri's mission (decided 2026-11-07),
   a little way past the shoreline and not far, and the party goes in after her.
6. Inside (decided): **the spiral opens onto the campsite**, a mini-dungeon (§ Càmping Eurosport).
7. Boss: **La Sobremesa** (§ Final boss).
8. The ánima leaves them: _open_

- Own mechanic, and how it is taught: **a chase with no fight**, where being caught is the end. Uri's
  tower also has chasers, but theirs start fights, so this one is new. `src/chasers.ts` can give the
  hunting logic. Running is already taught. It teaches itself: they come, you run.
- Diegetic gates (proposal): the tentacles shut the promenade, so the only way open is the sea.
- Aitor's moments (proposals): the question nobody answers; during the chase, *"¡Al agua! ¡Con
  Anna!"*, the direction given by a person.
- Two players (proposal): catching either one catches both. In follower mode Aitor cannot be caught
  on his own, so only Gerard counts.
- Hours spent: _open_

## Càmping Eurosport (the mini-dungeon)

**Decided**: past the spiral, a generic campsite, **Eurosport** by name, where they went for years; it
is what they all have in common. Its monsters are campsite mages and pieces of the board games they
played there. The rest is a proposal, not built.

**The idea**: it is always the same summer evening. The tents are pitched and empty, the bulbs are
lit, and nobody has to go home. It starts warm, and it is wrong the moment you notice that nobody is
there. Coming from the November beach, the summer is the first strange thing.

**Route**, one way, about the size of Uri's tower:

| Zone | What is there | What it asks |
| --- | --- | --- |
| **La entrada** | The barrier, the reception, the *CÀMPING EUROSPORT* sign | First fights: Magos de camping |
| **Las parcelas** | A hedge maze of pitches and tents | Each patrol says a word as it falls | Magos and agentes on their rounds; dados and agentes behind the wrong tents |
| **La tapia** | A tall wall of boards round the pool, one gate with a padlock of word wheels | The three words the maze's foes said |
| **La piscina** | The pool at dusk, its water still, a blackboard on an easel | El Campeón, then Las parcelas |
| **La puerta blindada** | A steel door in the wall between the pool and the merendero | Shut until Las parcelas is solved |
| **El merendero** | The long picnic tables under the pines | La Sobremesa, and the photo |

**Las parcelas is a maze** (decided 2026-11-07, round 2: "más laberíntico… que sea difícil avanzar"):
the 25 pitches are alcoves in clipped hedges, five rows of five, each opening south onto its lane, so
the ground still reads like the board. The lanes are cut by hedge plugs (always under an alcove's side
hedge, so no alcove goes round one), and a few gaps lead from one lane to the next, never one above
the other. In the middle, a **roundabout** round a big pine on a round bed of hedge, with four mouths;
by the way in, a **square** round a hedge block; to the west, a **dead-end square** that looks over a
hedge at the gate's yard but never reaches it. There is one way in, from the reception, and two ways
to the gate, north (round the square, up to the lane along the woods and back down the west side)
and south (out of the roundabout's south mouth, down to the last lane and back up the west side):
92 and 107 steps where the crow flies 49 (`tests/environments.test.mjs` holds it to a detour). The
plan is written by a script into `assets/geo/camping` (§ How the maze is made, docs/barcelona.md).

**Magos and agentes patrol** (decided 2026-11-07): each group walks its round (`CAMP_HUNTERS`,
`src/friends/universidad.ts`) and runs at the party when it sees it down a lane (`src/chasers.ts`);
the hedges hide the party, so a fight can be seen coming and often slipped past. Seven groups: two
magos up and down the maze's hedge across its one way in, two round the square by the way in, two
agentes round and round the roundabout, agentes along the lane by the woods and along the last lane,
magos along the lane past the roundabout's south mouth, and two magos in the gate's yard, where both
ways end. Beaten, a group stays beaten that visit. **The dados never walk**: they come out of a wrong
pitch's tent, mixed with agentes (`camping-tienda`), and with magos out of the black one
(`camping-negra`). Only El Campeón waits in place, by the pool.

**Las palabras** (decided 2026-11-07, round 3): in the fight with a patrol of the maze, each of its
foes, beaten, shouts the patrol's word over its head while it shudders, before it comes apart
(`word` in `CAMP_HUNTERS`, battle-ui `lastWords`; the fight tester gives each kind its first patrol's): **«Empiezo»** near the way
in, **«Continúo»** in the middle, **«Acabo»** by the pool gate. Nothing writes them down.

**La tapia y el candado** (decided round 2 and 3: the final zone must not be seen from the start; "no
bajes la valla, simplemente abre la puerta"; "el código es poner los números 7, 8, 5… no des pistas"):
the pool stands behind a wall of weathered pine boards, 4.6 m, that never comes down. Its one gate is
shut with **a padlock of three number wheels**, 0 to 9, and nothing else on it (`CAMP_LOCK`,
`src/candado-ui.ts`): the code is **7 · 8 · 5**, the letters of the three words. Walking up to it,
Gerard only says it is a padlock of three number wheels; pressing at it opens the wheels (either
player turns them). The right numbers take the padlock off and the gate swings open (flag `candado`);
wrong ones and it holds, nothing else. **No overview in the campsite** (`noOverview`). **Its music is *mazmorra 2*** (`PLACE_SONGS`, src/main.ts).

**La piscina**: El Campeón stands before a blackboard on an easel (*TORNEO*, `pissarra-piscina`):
**Las parcelas is played there** (moved from the reception, decided round 3), once El Campeón is
beaten. Each pitch found lights a bulb over the steel door; solving it opens the door (flag
`parcelas`). The reception's blackboard only has notices now, and the maze's pitch signs carry no
words.

**La puerta blindada** (decided round 3: "una puerta de metal fuerte que se abre"): the merendero is
its own zone behind a second wall of boards and a steel door (`porta-merendero`, style `blindada`): two
riveted leaves in a concrete frame, a locking bar with a wheel, nine bulbs on the lintel. Walked up to
before the board is solved, it says it is bolted and something moves behind it (`LINES_UNI.door`).

**La luz** (decided round 3: "sol bajo en general… al abrirse se ilumina de golpe al monstruo"): the
campsite's sun stands about 14° over the horizon from the south-east, amber, with dim blue shade
(`src/scenery.ts`), so the walls throw the merendero into deep shade: La Sobremesa is there from the
start, a shape you can barely make out (its colour kept down to a sixth, no glow). As the steel door's bar lifts, the merendero's bulbs
(`bombetes-merendero`, `switched`) and a hard lamp over the long table come on at once, with two
failed flickers first.

**Monsters** (each asks one question, by kind; no names of real games, § Open). **Built** (the rules,
the fights and their models; the campsite scene itself is not): their rules are `CAMPING` in
`src/battle.ts` (`campingTurn`, `campingTaken`, `campingRoundEnd`), their models
`src/camping-foes.ts`, their tests `tests/camping-fight.test.mjs`, and `just fight-sim` holds each
fight to what it should be (docs/fight-sim.md § Càmping Eurosport). Each rule shows on the foe's plate:
*Cara N* on a dado (and the same face on top of the model), *Boca arriba* / *Boca abajo* on an agente
(face down it turns its back), *Héroe* / *De paisano · N turnos* on El Campeón (its paint goes to
primer grey), and *Bombona → todos* on a mago that has charged (its burner alight).

| Foe | Look | Rule | Move | The answer |
| --- | --- | --- | --- | --- |
| **Mago de camping** | A robe of old tent canvas, a head torch for a single light, a tent pole as a staff; in twos or threes | Takes half from magic, more from blows | *Bombona*: charges a turn (chip *Bombona → todos*), then a magic blast on both | Hit it physically; hold on when it charges |
| **Dado** | Human-sized and worn, its pips burnt in; in packs, the small fights of the dungeon | Its top face is shown and is the strength of its blow this round; it rolls again each round | *Tumbarse*: a blow as strong as its face | Kill the sixes first. A readable reason to choose a target |
| **Agente** | A tall figure of card, a word on its chest; in pairs | Each round one is face up and takes everything, the other face down and takes half. Ticks ignore this | *Contraseña*: a blow on one | Focus the one face up; put statuses on the one face down |
| **El Campeón** | A hero miniature at human scale, chipped paint on the plinth, a cape of tarpaulin; **invented, no real character** | Two forms, shown on its plate. *Héroe*: hits very hard, takes half. *De paisano*: does not hit, recovers PV, takes double. It changes every two turns | *Puñetazo*, *Recuperarse* | Hold on while it is a hero, and spend everything when it is not. The mini-boss |

**The fights** (ids the story starts; all in the fight tester's *Camping Eurosport* row, staged on the
Barceloneta's sand until the campsite has a place of its own):

| Id | Who | What it is |
| --- | --- | --- |
| `camping-magos` | Two magos | The entrance: they charge together, so holding on that round pays |
| `camping-dados` | Three dados | The small fights of the parcelas |
| `camping-agentes` | Two agentes | Behind a wrong tent: one face up, one face down, turning every round |
| `camping-tienda` | A dado and two agentes | A wrong pitch's tent waking |
| `camping-negra` | Two magos and two dados | The black pitch: the hard fight, no running |
| `campeon` | El Campeón | By the pool, the mini-boss, no running. Starts a hero, two turns each form |

Numbers (`CAMPING`): a mago takes half from magic and ×1.5 from blows, Bombona 26 of magic on both; a
dado's Tumbarse is 4 + 4 a pip; an agente face down takes half, Contraseña 18; El Campeón (380 PV)
takes half as a hero and punches 44, takes double in plain clothes and gets 10 % of its PV back a turn.
Picker moments: *Bombona cargada* (`magos-bombona`), *Héroe* (`campeon-heroe`), *De paisano*
(`campeon-paisano`). `just screenshots camping-foes --gpu`.

**The puzzle: Las parcelas** (decided round 6: a real word-clue game that Gerard and Aitor solve
together, made by a generator). The dungeon's one mechanic nobody else uses:

- **On a board by the pool** (decided round 6, moved round 3): at the blackboard on its easel by the
  pool the puzzle opens as a 2D board (`src/parcelas-ui.ts`): the blackboard on top with the clue in chalk, the 25 pitches below
  as wooden signs, a string of bulbs over it. Gerard and Aitor each move their own marker (Gerard
  gold, Aitor cyan, their ánimas' colours) and either can choose. The board is also playable from the picker (*Misiones* → *LAS PARCELAS*),
  `just screenshots parcelas`.
- The blackboard, written as a campsite notice (*TORNEO*), gives one clue at a time: a word and a
  number (*«MAR · 2»*). That many pitches go with it. When they are all lit, the board shows the
  next clue. A pitch that goes with a later clue can be lit early, as at the real table.
- Choosing is a press on the board (*Elegir esta parcela*, through `data-glyph`). A right one lights a bulb over the steel door. A wrong one wakes its
  tent: a fight. **The black one** puts every lantern out and starts a hard fight; then the board
  starts again from the first clue.
- When every clue is lit, the merendero's steel door opens (the board is by the pool now, § La piscina). Nothing appears on the
  HUD: the board, the lanterns and the bulbs over the gate are all there is. With two players, each can walk to a different pitch.

**Two puzzles** (decided round 6):

| | Prueba (development) | Producción (the real day) |
| --- | --- | --- |
| Grid | 5 × 5, as the original game: 9 to find, 15 wrong, 1 black | The same |
| Clues | 3, 3 and 3 | 4, 3 and 2 |
| Difficulty | Obvious links | Very hard but fair: sideways links, several tempting words per clue, the black one the most tempting wrong answer of the four-word clue |
| File | `src/parcelas/prueba.json`, plain | `src/parcelas/produccion.json`, **sealed** (compressed, not encrypted) and never printed |
| Who sees it | Anyone; `output/parcelas/prueba.html` plays it in a browser | **Nobody before the real day**, Aitor included |

The development build plays the test one and the release build the sealed one (when the dungeon is
built). The repository is public, so the seal only keeps the answers from being read by accident.

**The generator, `just parcelas prueba|produccion`** (`tools/parcelas.py`, tested in
`tests/test_parcelas_tool.py`): Claude composes a puzzle from the word bank
(`assets/parcelas/palabras.txt`, which also knows the group's campsite, the melon photo and the board
games), the rules check it (sizes, one black pitch, every friends' pitch under exactly one clue, a
clue never on the grid nor sharing a root with a pitch word), and a second Claude that only sees the
grid and the clues tries to solve it, stopping at its first wrong pitch as at the table. The test
puzzle is kept only if it finds every target and never the black pitch; the real one if it finds
half and never takes the black pitch first. A reply a safety filter stops by mistake (it happened,
at random) is asked again. The rules of the board are `src/parcelas.ts` (`tests/parcelas.test.mjs`).
Made on 2026-11-07: the test one was found whole by the guesser; the real one, after a rule fix, 7
of 9 with the black pitch taken once (not first). Up to three attempts, each told what failed. The real
one refuses to be replaced without `--force`.

To make the real one more theirs: add the group's words to the bank (jokes, places, things from
those summers), then `just parcelas produccion --force`. Adding words does not show the puzzle.

**Place identity** (proposal for `docs/visual-style.md`, to go through its checklist):

| | |
| --- | --- |
| Dominant | Pine-needle olive `#6a6b45`, to measure against the matrix (palace patio, El Nucli) |
| Material | Tent canvas (`lona`, new), pine needles on packed earth |
| Landmark | The pool with its lifeguard chair (kind: a still rectangle of water in the trees) |
| Light | An endless warm dusk; strings of bulbs between the pines |
| Only here | The strings of bulbs, and a table with a melon on it |
| Reserved | Violet stays in the friends' eyes and the spiral, pink in what the Queen touches; nothing else |

## Gerard's birthday: the day that repeats (decided, written into the game)

Every morning of chapter 2 is Gerard's birthday: the status screen already said `JUE · 22 NOV` and
*El día que se repite*. The lines now say so, with Aitor congratulating him at the start, and the
friends come for it. What the world has done stays done, and the Queen still advances; only the
date does not move (`docs/lore.md`, `docs/chapter-2.md` § The Queen's advance).

## Final boss

**Decided**: a spawn themed on board games, with all the friends coming out of different parts of
it and using board-game attacks. The rest is a proposal.

- Who / what, look: **La Sobremesa** (the hours after a meal when nobody gets up and a game comes
  out). Decided (round 6): **more grotesque**, a fusion of all the friends' bodies with the campsite
  table: folding tables, chairs, tent canvas, boxes and cards, each friend coming out of a different
  part of it from the waist up, violet-eyed. **The look is chosen from concept images first**
  (§ Concept art), then built.
- Gimmick: **each friend is a target with their own PV and their own move. Freeing one takes that
  move away for good; free them all and it falls apart.** There are no phases and no counters: the
  fight gets easier in the order the players choose, and that order is the decision.
- **Duos between couples** (decided round 6): normal moves mix with duo moves. A couple's duo is
  announced a turn ahead with a chip on both plates (*Dúo · Tirada → Gerard*), and works only while
  **both** of them are still held: freeing one of the pair takes the duo away. Soraya has no duo,
  since Guillem is not here; she and Joan live in **symbiosis** instead (decided round 8): with one of
  them freed, the other no longer attacks (*«Sin Soraya no sabe qué cantar»*).

  | Who | Move | What it does (decided round 6; numbers to tune) | The answer |
  | --- | --- | --- | --- |
  | **Álvaro** | *Tirada* | Rolls two big dice in view; the blow takes **1.2 % of the target's PV per pip** (2–14 %). Made harder twice on 2026-11-08 and now tuned at the top level (both ánimas at 3): PV Álvaro 91, Anna 84, Sarah 84, Miquel 95, Joan 72, Soraya 77, Nico 102; the simulator's careful bot wins about half, careless play never, and at level 2 almost never. Gerard in Papagato with Aitor in Tecnópata still wins about 9 in 10 (Explosión reaches and blinds all seven) | A percentage hurts the same whoever it lands on |
  | **Anna** | *Sopeta* | A blow on **one person only**, growing each turn, and **every friend still held gets 10 % of their PV back** (renamed from *Una más* and given the heal 2026-11-08: green steam as she stirs, a ladleful at whom she hits, green drops on every friend she feeds) | Free her early: while she is held, chipping at one friend at a time is undone |
  | **Anna + Álvaro** | *Tirada* (duo) | The same roll with **four dice** (4–24 %) | Free one of them before the chip comes up |
  | **Sarah** | *Regla nueva* | Raises **one** of the friends' blows (+1, to tune) | Free her early, or the others hit harder |
  | **Miquel** | *Carta negra* | Turns a card face up: chip *Carta negra → Aitor*. On his next turn, a hard blow on that one | Defender, or free him first |
  | **Sarah + Miquel** | *Regla nueva* + *Carta negra* (duo) | Sarah raises **every** friend's blows, and Miquel's blow on the marked one **leaves them at 1 PV** unless they defend | Defender on the marked one. The fight's big threat, always telegraphed |
  | **Joan** | *Escala* | Decided round 8: sings his scale note by note, Do, Re, Mi…, more out of tune each time; his blow on **both** grows with the note, shown on his chip (*Escala · Mi*) | Free him early, or he ends the fight. Freeing Soraya also silences him |
  | **Soraya** | *Corrección* | Decided round 8 (replaces *Grito*): corrects Joan, who jumps one note further. No blow of her own | Free her and Joan has nothing to sing |
  | **Nico** | *Cortafuegos* | Decided round 7 (he works in computing and loves music; no duo): shields another friend, chip *Cortafuegos → Sarah*, so the next blow on them lands at half. He never attacks | Free the one he shields later, or free Nico first to take the shield away. The boss's only defender |

- How the friends help: being freed is the help, since each one takes a move away. The fight says who
  came back in one line (*«Miquel se suelta y cae sobre la hierba.»*).
- What the party's ánimas do against it: nothing here checks an ánima. Rules go by kind (physical,
  magic, dual, tick). Area skills hit several friends; Sangrado and Quemado keep working on those
  the party is not focusing.
- Against the game's other bosses: Vertitrón is one body and an optional part. This is several real
  targets, and it is won by freeing them all.
- After it (story `winUni`): back at the long table La Sobremesa comes apart slowly into violet specks
  and the seven are left standing round the table, three along its far side and two at each end, facing
  Gerard and Aitor on the open side; **the photo with the melon** (§ Open); their five lights go into
  Gerard and Aitor in turn, each a beat after the one before; a spiral opens behind the table and everyone,
  the party and the seven, comes apart into it from their real surface; out of a spiral on the November
  beach each body comes together from the head down, and the seven stand in a half ring round the two of
  them, facing them (away from the camera's side, so every face shows).
- Numbers: to set with `just fight-sim`, with a new entry in `TARGETS`. Five actors a round against
  two is the main risk: a first version may need lower blows, or only three moves active at a time.
- Code: `Encounter` `sobremesa`, `FoeKind` one per friend (`sobremesa-alvaro`…).

### Concept art (round 6)

Generated with OpenAI Images (the provider of `just character`) from the friends' photos and Uri's
portrait as the style reference; local only, in `output/concepts/sobremesa/`, shown in the sidebar.
The prompts are in the scratch script, not in the repo, until a direction is chosen.

With Nico added (decided round 6), each take was made again with the six of them, everyone fully
clothed: `sobremesa-a-mesa-6.png` (Nico hangs head-down under the table), `sobremesa-b-torre-6.png`
(Nico in the middle) and `sobremesa-c-carne-6.png` (the cleavage gone). The first five-friend
versions stay beside them.

| Take | What it is |
| --- | --- |
| `sobremesa-a-mesa.png` · **La mesa** | A long creature crawling on folding-table legs, the friends along its back: Álvaro in front with the dice, Soraya screaming on top |
| `sobremesa-b-torre.png` · **La torre** | A tower of canvas and stacked boxes seen from below, the friends coming out at different heights. The least grotesque |
| `sobremesa-c-carne.png` · **Carne y cartas** | One body whose skin turns into cards and canvas, too many fingers, the Queen's pink tentacles underneath. The most grotesque, but it sexualises the women (cleavage), which is not acceptable for real friends: to correct in any version that keeps it |

Faces are close to the photos but not exact; Sarah and Anna look alike in all three.

**Chosen (round 6): C, Carne y cartas.** A clean sheet of it for 3D, the creature alone with flat
light (`output/models/sobremesa/sheet.png`), is made. Its Meshy model is made (2026-11-07, task
`01a1b772-1e3a-7412-90db-6649d2e2bd61`, `target_polycount` 30000, textured, no PBR):
`output/models/sobremesa/sobremesa.glb`, 7 MB, **one mesh, one material, one texture, 29,705
triangles**, with a viewer beside it (`index.html`). Being one piece, it has to be split (base and a
piece per friend) before a friend can be freed on their own. **Rigged and moving** (round 7, decided: integrate the boss first). Meshy gives no skeleton and no
automatic rigger handles a six-torso creature, so `just rig sobremesa` (`tools/rig_glb.py`) adds one
from `assets/models/sobremesa/rig.json`: a bone per friend (chest to head), the card arm, Miquel's
arm, the two claws and the tentacles under the root, each carrying what lies around it with weights
that fade so the mesh bends without tearing. The game loads the result,
`public/models/bosses/sobremesa.glb` (8.5 MB), with PlayCanvas' own GLB loader, and moves the bones
itself (`src/sobremesa.ts`, tested): the mass breathes and sways, each friend looks about on their own
pace, an attack draws back and lunges with its arm or claw (Soraya's screams instead), a freed friend
goes limp and the mass sinks as they come away. **The model lab** shows it (`just model-lab`,
`just screenshots model-lab --gpu`).

Not done yet: the fight itself (the six targets, their moves, the duos, Cortafuegos), placing it in the
fight scene, a freed friend's eyes losing their violet (they are in the texture), and the size of the
GLB for the shipped game.

## Ánima

**Built, provisional** (as Nuria's): winning the mission sets `anima-universidad`, so the
party gets `ANIMAS.universidad` (grey `#a8a89a`, +1 Fuerza, +1 Espíritu, +10 PV to everyone) and
the five lights. What it brings beyond that is **waiting for the user's choice** (a design round with
`/anima`); nothing below is in the game.

**Proposals** (the user picks one, or none, in the next round):

| | A · *La partida* (wearable ánima) | B · *Foto de grupo* (one skill) | C · *A ver si quedamos* (one skill, abstract) |
| --- | --- | --- | --- |
| Idea | The table where everyone finally sits: a support ánima that plays with turns and dice, the friends' own game | The melon photo: everyone in the frame at once | The plan that never happens until it does |
| Fantasy | Gerard deals the round: who goes next, what the dice say | One moment where the whole party is together | Something promised that comes when it is most needed |
| Skills (AGENTS.md shape) | *Tirada* · `Daño medio físico a un enemigo. La fuerza depende de dos dados.` · *Otra ronda* · `Sube Velocidad de todo el equipo durante 2 rondas.` | *Foto de grupo* · `Sube Fuerza, Magia y Defensa de todo el equipo durante 2 rondas.` (once a fight) | *A ver si quedamos* (abstract) · *«Algún día.»*: a few rounds later, it comes back as a heal and a guard on the whole party |
| Shared mechanic | Dice shown on screen (readable, as Álvaro's Tirada) | Once per fight, like the duals | A delayed effect with a visible countdown chip |
| Look | A tablecloth cape, cards in a belt, a die on a cord | A camera on a strap | — |
| World key | A board-game shop's door in the city that only opens to a player | — | — |

Colour for the second round (proposal): the campsite's warm bulbs, `#e8b04a`.

## Second round

-

## Assets

| Who / what | Photos | Description | Portrait | Expressions | 3D | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- |
| Anna | 1 | Done | Done (neutral face, not the photo's kiss) | — | Meshy, rigged (walk, run) | Done |
| Álvaro | 1 | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |
| Miquel | 2, one with Sarah | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |
| Sarah | 1, with Miquel | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |
| Soraya | 1, with a man beside her | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |
| Nico | 1 | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |
| Joan | 1 | Meshy, rigged (walk, run) | Done | — | Meshy, rigged (walk, run) | Done |

The photos are in `assets/references/characters/<id>/` (local, untracked). They have a painted filter, so skin and hair colours are approximate, and a second,
unfiltered photo of each would help.

Looks seen in the photos, as a base for each `--description` (age, build and usual clothes to come
from the user):

- **Anna**: shoulder-length, reddish-brown hair, sunglasses pushed up on it; a white top in the photo.
- **Álvaro**: long, curly, brown hair down to the shoulders; dark rectangular glasses; a short beard.
- **Miquel**: short, messy brown hair; dark rectangular glasses in one photo; moustache, short beard
  and a small tuft under the lip.
- **Sarah**: long, reddish-brown hair; blue eyes; a wide smile.
- **Soraya**: long, straight, dark hair; a wide smile; red lipstick in the photo (dressed up).
- **Nico**: short, thick, dark hair with a fringe; dark eyes; clean-shaven with a faint moustache.
- **Joan**: dark, curly hair, short at the sides; a thin moustache and light stubble.

To build for this mission: the violet eyes on each friend, the pink tentacles, and the spiral placed
in the water (`src/fear-portal.ts` exists).

Commands (OpenAI images at medium quality; Meshy 30 credits a model plus the rig):

```bash
just character <id> --only portrait --description "…"     # OpenAI
just character <id> --only fullbody --description "…"     # OpenAI
just character <id> --only model rig --modeler meshy      # Meshy: textured GLB, then auto-rig
```

The models are in `public/models/characters/<id>.glb` with `<id>-walking.glb` and
`<id>-running.glb`; `just model-lab` with `?personajes` shows them moving. The game does not load GLB
characters yet (they are primitives, `src/characters/`); the friends' primitive files from the first
pass stay until it does.

## Open

- **The campsite and the melon** (proposals, round 4):
  - **On the beach**: a melon on the sand at their feet, which nobody mentions. Only those who know
    the ritual understand it, and the party can look at it.
  - **What the campsite means**: nobody has children or a job there, and they do not have to leave.
    That is what the Queen offers them, and the reason it hurts to take it away.
  - **The photo is the ending**: the ánima leaves them when the photo is finally taken, all of them
    with the melon, and it can stay in the flat afterwards. Gerard and Aitor in it, or the one who
    holds the camera, to decide.
  - **Limit** (`AGENTS.md` § Game philosophy, no food gags or joke monsters): the melon stays a real
    object from a real memory, never a monster or a melon-themed boss.
- **Real games** (rule proposed): mechanics may be inspired by what they played, but names, characters
  and art are invented, as in El Nucli (`docs/places/nucli.md`: never a real game's art). So no
  Marvel characters and no real titles, on screen or in the code.
- **Which Marvel game** was it, and how did it play? (round 5) El Campeón's two forms assume hero and
  civilian identities, a guess until the user says.
- **Bernat also owns board games** (`docs/quests/bernat.md`, El Nucli): he designs them. Proposal:
  this mission keeps the campsite table and the fight with pieces, and his stays a spy story with no
  board-game fight. His mission's spy feel is also why the Agentes here are cards, not spies.
- **Tone** (`AGENTS.md`): dice and cardboard heroes can read as joke monsters. Proposal: real
  materials, worn, silent and human-sized. To judge on the first screenshot, case by case.
- **Nico** (round 6): is he on the beach, and with whom? Has he a partner for a duo? **Joan**: in or out?
- **Soraya and Guillem** (round 3): is the break-up something the Queen makes her say, untrue when
  she wakes, or part of the story? They are a real couple and may play or see this. Proposal: it is
  one of the strange things, and afterwards Soraya does not remember having said it.
- **The geometry of the chase** (round 3): they stand on the shore, facing the sea, with the party
  behind them, so running to the sea means running through them. Proposal: they stand spread along
  the sand with gaps, and the tentacles shut the promenade behind.
- **Retrying** (round 3): replaying the whole conversation after each catch gets heavy. Proposal: the
  first time it plays in full; on a retry it goes straight to Álvaro's last lines.
- **The children** (proposal): once the friends are freed, the first thing they do is ring home or
  run back, and the children are fine.
- **Six lights** (design risk): "every person helped gives a light" (`docs/lore.md`), and each light
  is an eco de luz. Nuria's household gives two, and prices were tuned on two
  (`docs/animas/README.md` § Ecos de luz). Five or more at once would buy most of the ecos table.
  Proposal: one light per couple.
- **Asset cost**: five to seven new characters with portraits and models, the most of any mission.
  They do not need to walk with the party, but the chase means they all need bodies that run.

## Implementation plan

Approved 2026-11-07 (full plan: `~/.claude/plans/continua-compiled-hippo.md`). The final boss first,
then the rest. Each step is one or more commits, each playable from the picker.

**Done**

1. Birthday lines, the word-clue puzzle (generator, sealed real puzzle, 2D board), the GLB rig tool
   and the model lab.
2. **La Sobremesa's rules** (`src/battle.ts`, `tests/sobremesa-fight.test.mjs`): seven whole foes
   `sobremesa-<friend>` in encounter `sobremesa`, the `SOBREMESA` book, Tirada (dice, a share of the
   target's PV), Sopeta (was Una más), Regla nueva (capped at +4 Fuerza), Carta negra, Escala and Corrección with
   their symbiosis, Cortafuegos (a mirror of Punto débil), the two duos telegraphed a turn ahead, the
   picker's moments (*Dúo de la carta negra*, *Joan en La*, *Queda uno*).
3. **Balance** (`TARGETS` `sobremesa-*`, `just fight-sim check`): with the duo party at Papagato 2 and
   Matemágico 2, thinking it through wins always with two thirds of the PV left in about 10 rounds;
   without thinking about half; only Atacar never. Like Vertitrón, longer. Area attacks matter here
   (Papagato 3's *Las dos a la vez* makes it easy).
4. **On screen** (`src/glb.ts`, `src/battle-scene.ts`): the GLB fetched when its fight first comes, one
   body standing as a giant, each friend a part on their bone (plates, blows, fire there), their moves
   shouted over them, a freed friend limp, the whole body flashing for a blow on any of them. Fight
   tester: *Amigos de la uni · La Sobremesa* (on the beach until the campsite exists).
   `just screenshots sobremesa --gpu`.

5. **The model with Joan** (A0): seven friends in La Sobremesa, his bone and pose.
6. **Data and arc** (B1): `src/friends/universidad.ts` (places, the game of tag, the campsite's spots
   from its anchors, every line), flags `clue-uni` … `luz-joan`, `UniRun` (not saved), the picker's
   *Misiones → Amigos de la uni* parts (beach, tag, spiral, camp, board, gate, Sobremesa, won, done).
7. **The seven as characters** (B2): portraits (`just character`), and **toy figures like Gerard's
   and Aitor's** (2026-11-07, the user: «hay contraste entre los personajes en 3D»): `just character-3d
   <id>` from one face photo each (`tools/figures.toml`; the couple photos cropped to one person),
   scale 1.3 (`UNI_SCALE`). They walk and run on the game's rig like the cast, with glowing violet eyes
   over their painted ones while the Queen holds them; group conversations swap face and name per speaker.
8. **The beach** (B3): the six **huddled together** facing the sea (the user: «deberían estar todos
   juntos al principio»), Anna waist-deep in the walkable shallows (`withShallows`, `wade`, foam round
   her) with **the spiral beside her from the start**. The talk is framed on all of them, above the
   dialogue box (`look` with a cell); they turn only when it ends (eyes, tentacles, the promenade shut,
   Aitor's *«¡Al agua! ¡Con Anna!»*), the game of tag (`relentless` chasers), caught is back up the sand
   with Álvaro's last lines. Near Anna she turns, smiles and **comes apart into specks the spiral
   swallows** (story `portal`, `disintegrate` with `into`); the party goes through the same way, and so
   does anyone entering a portal (Uri's bubble too). `just screenshots universidad --gpu`.
9. **Càmping Eurosport** (B4): the designed zone (`assets/geo/camping`, its landmarks, the endless
   evening), its foes and fights (`camping-*`, `campeon`, `CAMPING` book, `src/camping-foes.ts`, tuned
   in `TARGETS`), the pitches as a hedge maze, magos and agentes patrolling it and running at the party, the blackboard opening Las parcelas, each pitch's
   word on its sign and its lantern lit when found (and a bulb over the gate), a wrong tent's fight and the black pitch's, the
   tall wall round the pool shut until solved (`CAMPING_GATE`) and then its gate opening, the steel door to the merendero shut until El Campeón falls (`CAMPING_DOOR`), El Campeón by the pool, La Sobremesa sitting at the
   melon table until the party comes. `just screenshots camping`, `camping-laberinto`, `camping-foes`, `universidad-camping`.
10. **The ending** (B5): free on the grass, the photo with the melon (a flash and a held frame with its
    caption), five lights (one a couple, one each alone: `luz-anna-alvaro`, `luz-miquel-sarah`,
    `luz-soraya`, `luz-nico`, `luz-joan`), the provisional ánima, back on the November beach.
11. **Docs and the report** (B6): this doc, `docs/chapter-2.md`, `docs/lore.md`, the progress panel,
    `output/reports/universidad/index.html`.

**Left for the user**

- The ánima's design round (§ Ánima: three proposals).
- Playing the real Las parcelas on the day (the sealed puzzle is what a release build plays).
- Optional: more of the group's own words in `assets/parcelas/palabras.txt` before
  `just parcelas produccion --force`.
