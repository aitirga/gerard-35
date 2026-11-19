# The castle's bosses

Aurelià, the management team and La Reina Bubbaloo, designed with Aitor on 2026-11-19, and built
the same day as a **preliminary version** (the rules, not the look): see [castle.md](castle.md) §
Built so far. The numbers are `CASTLE` in `src/castle.ts` (book `castle.rules` in
[fight-sim.md](fight-sim.md)). Where they stand in the castle, what roams between them and what each
one opens is in [castle.md](castle.md).

All three follow combat.md § La respuesta de cada combate: a boss chains two or three questions,
one a phase; without the answer the party loses and sees what killed it (the move has a name and
was announced); with it the fight turns and the turn shows. Rules are by kind of blow or status,
never by ánima. Each rule is on the plate: a part with its PV, a chip, a tell, a clock.

## Aurelià

**Aurelià** is the castle's first great boss: a history teacher at the Rec Comtal, a despot in the
classroom, an athlete once. The Queen holds him (his eyes are violet). He is a colleague of
Gerard's, written as an adult would know him: a man who has always confused being obeyed with
being right. He is not mocked and he is not a monster; beaten, he comes back to himself.

- **Where**: the gym, dressed as his. A dais with a lectern before the mats, running lanes painted
  across the floor, a timeline along the whole wall, laurel and marble: his namesake is the
  emperor of the walls, the one who called himself restorer of order. Phase 1's floor has been
  turning into this room since the patio.
- **Met with**: stage 1 of growth. Two ánimas each, levels up to 3 or 4, the constellations' inner
  nodes.
- **How he announces**: he says it. Each move is a chip on his plate that names its target.

| Phase | PV | Moves | Question → answer |
| --- | --- | --- | --- |
| **La lección** | 100–65 % | *Dictado* (told a round ahead, on everyone); *Pregunta → X* (one, very hard); *Castigo* (on whoever uses the same kind of blow two rounds running) | **Part.** *El Atril* has its own PV and, while it stands, Aurelià takes half of everything. Break it: it is wood, it burns. Defender on a *Pregunta* leaves him exposed: the next blow on him is ×1.5 |
| **La carrera** | 65–30 % | *Vuelta*: a clock that runs on his plate, 20 s. When it closes, *Sprint* on everyone and +1 *Ritmo*, for good | **Status and moment.** A **new** clock status on him starts the lap over («Tropiezo»). The same one again does not count: the ánimas have to rotate |
| **La última recta** | 30–0 % | *Expulsión → X* (out for two rounds); *Récord* (charged over two rounds) | **Moment.** Spend now what was kept: the open wound, the dual, Punto débil, before *Récord* lands |

- **Without the answer**: half damage all through the lesson, laps that pile up *Ritmo*, and the
  party falls in the race.
- **With it, it shows**: the lectern breaking, «Respuesta correcta» on a defended question,
  «Tropiezo» on a broken lap.
- *El Atril* never blocks the win; breaking it removes *Dictado*.
- `TARGETS`: `aurelia` (played with the answer, ≥ 0.9), `aurelia-sin-atril` and
  `aurelia-sin-relojes` (≤ 0.2). `FightMoment`s for the picker: `aurelia-leccion`,
  `aurelia-carrera`, `aurelia-recta`.
- **After**: [castle.md](castle.md) § What each boss opens.

## Mar, Montse and Pilar

**The management team**: **Mar**, the head, and **Montse** and **Pilar**, the two heads of
studies. Three at once, held by her, in *Direcció*. They are the people Gerard, the school's
secretary, answers to every day. Phase 2's floor has gone dark and turned to manila and steel on
the way here.

- **Met with**: stage 2. Three ánimas each, levels up to 6, the constellations' outer ring, so the
  three elements are within reach.
- **Each carries an element**, shown on her plate, and they use on the party the same reactions
  the player learned (combat.md § Reacciones).

| Move | Whose | What it does |
| --- | --- | --- |
| *Expediente* | Whoever holds fire | Burns one, and raises the level of a burn already there |
| *Horario* | Whoever holds water | Wets everyone |
| *Circular* | Whoever holds electricity | Electric on everyone; brutal on the wet |
| ***Acta*** | The three | Every third round each signs on her turn (chips «Firma 1/3»). The third signature closes it and announces *Resolución* on everyone for her next turn: all but kills whoever does not hold on, and one of them falling first voids it |
| *Cambio de cargo* | The three | Every few rounds they trade elements, and their weaknesses with them |

- **Two standing**: no quorum, so no *Acta*; but they share out the fallen one's element.
- **One standing**: *Voto de calidad*, the three elements in one.

The question has three parts:

| Part | Answer |
| --- | --- |
| **Order** | First, whoever holds water right now: with nobody wet, electricity loses its edge |
| **Element** | Each is weak to one element, and it moves with *Cambio de cargo*: read it again |
| **Moment** | One who is blinded, confused or has lost her turn does not sign: keep a clock ready for the next signature |

- **Without the answer**: the party is wet, then struck, and the Resolución lands on nobody holding on.
- **With it, it shows**: a signature missed («No firma»), a weakness found, the *Acta* never
  closing once one has fallen.
- `TARGETS`: `direccion-bien` (≥ 0.7) and `direccion-sin-pensar` (≤ 0.05) for now; the split into
  `-sin-orden` and `-sin-elementos` waits for a bot that plays one part of the answer and not the other.
  `FightMoment`s: `direccion-tres`, `direccion-dos`, `direccion-una`.
- **After**: the definitivas ([castle.md](castle.md) § What each boss opens).

## La Reina Bubbaloo

She is nobody: what is left of being a kid (lore.md). Her motive is good and her means are cruel.
The fight is the whole game asked again, in the throne room, with everything the party has: stage
3, the definitivas, three ánimas each. No joke, no cartoon monster.

| Phase | PV | What it tests |
| --- | --- | --- |
| **El chicle** | 100–70 % | The first lesson, at scale: layers of pringue that each ask for something else (fire; a blow, once it is rancid; electricity while it is wet) |
| **Las manos** | 70–40 % | Parts and order: two *Manos*, each with its PV. *Atrapar* holds one of the party out of the fight until that hand breaks |
| **La pompa** | 40–10 % | Moment and elements: she charges *La Pompa* over several rounds. Break it or Defender, with its reactions |
| **She takes Aitor** | 10 % | Below |

`TARGETS`: `reina` (≥ 0.9), and one without the answer for each phase. `FightMoment`s:
`reina-chicle`, `reina-manos`, `reina-pompa`, `reina-aitor`.

### Aitor, held

At about a tenth of her PV she **takes control of Aitor** (decided, story-outline.md § The end, in
order).

- His eyes go violet, as Uri's did. **His dock crosses to the enemy side**, and **player 2 keeps
  driving him, against Gerard**, with all of his kit.
- The music strips down to the six-note motif.
- **By default there is no way out.** Without the artilugio they kill Gerard. It happens once, and
  it has to happen. It comes **only when she is about to fall** (Aitor's call, 2026-11-19): the
  possession is what nearly beating her brings. Lost to her before her tenth, it is an ordinary
  fall, with no call from Bernat; at her tenth she takes him even if he is down, and no blow can
  take her past it (`beaten` looks at her first).
- Built so far: his blow on Gerard comes on her turn (`CASTLE.aitor`, growing each turn she has
  him); player 2 driving him and the motif are to come. Then Bernat calls, the salón de juegos is played, and they come back with it.
- **The artilugio survives a rewind** (decided 2026-11-19): her castle covering everything takes the
  day back, but not the artilugio once Bernat has brought it, nor the night she took Aitor
  (`rewind` in `src/story.ts`). Otherwise a fall to her on the last day sends the party to a doomed
  morning and the death that has to happen once happens again.
- To settle: how much PV she has on the way back (proposal: 40 %, the wounds showing).

### With the artilugio

The real one, in Gerard's hands: the ESP32 with four buttons (story-outline.md § El artilugio).
Nobody says what it is for.

- **Every button sounds in the game.** At the first note she starts: her intent clears. That is
  how Gerard learns it does something.
- **Notes in the right order** light six marks on Aitor's plate, from violet to his cyan. A wrong
  one puts them out. Aitor keeps attacking all the while.
- **All six**: the final boss's song comes in whole, Aitor is free, his dock comes back, every
  ánima's maná is full. What is left is to finish her.
- It does **not calm her**. It takes Aitor from her. (Rejected already: a melody that soothes a
  tantrum.)
- To settle: how a press reaches the game (proposal: Wi-Fi → the API → an event), and what stands
  in if the device is not there (the flat's piano, already proposed).

Code, when built: Aitor on the enemy side is new (no party member fights for the other side
today); `aitor-poseido` in `src/battle.ts` and `src/story.ts`, as docs/progress.toml checks.

### The last scene

At 0 PV she does not die.

- The fight's clock slows (`FightClock.slow`, as a dual does), the music holds one chord, and the
  camera closes on Gerard: the Foc Binari forming in his hand, the numbers turning round it. She
  is on the floor, small.
- In Gerard's dock, two commands and no clock. **Only Gerard chooses**; Aitor answers with one
  line.

| Command | What happens | Epilogue |
| --- | --- | --- |
| **Acabar** | Q.E.D. in slow motion. She comes apart in specks that go from pink to grey. The castle is the school again, with no trace of her | Monday, the alarm, work. Everything in order, and a little greyer. Bernat's notebook, blank |
| **Bajar la mano** | The magic goes out. She shrinks to a pink marble: it goes in the jar, with the lights | Monday, the alarm, work. Some pink is still in the city. Gerard whistles the six notes |

These are **the two endings** (2026-11-19): to kill her, or to let her live, weakened. They
replace the three decided before (kill, wound, let live). Neither is the right one.
