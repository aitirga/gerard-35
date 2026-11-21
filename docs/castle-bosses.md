# The castle's bosses

Aurelià, the management team and La Reina Bubbaloo, designed with Aitor on 2026-11-19, and built
the same day as a **preliminary version** (the rules, not the look): see [castle.md](castle.md) §
Built so far. Each has its own figure since 2026-11-20 (§ How they look). The numbers are `CASTLE` in `src/castle.ts` (book `castle.rules` in
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

## How they look

Figures of `just character-3d` (OpenAI's image, then Meshy's model, rig and clips; the recipes are
in `tools/figures.toml`), drawn in their fights and in the bestiary. All four people keep the rule
of the Queen's own figure: an adult, held by her, never a joke.

| Who | Figure | What is theirs | What is hers |
| --- | --- | --- | --- |
| **Aurelià** (2.05 m) | `aurelia` | The real man: tall and lean like a runner, his dark curls, the full short beard, a silver hoop, his own shirt with a bold brown and black geometric print on sand, navy running shorts, trainers | A general's mantle of her wrapper paper (pink and black stripes) held by two black gum balls, a laurel of pink gum, her gum bound round his wrists like a gymnast's tape and criss-cross round his shins, violet eyes |
| **El Atril** (1.45 m) | `atril`, a creature in one piece | A lectern of dark oak with brass corners, his laurel on its front, the book open on top | Her gum pulled taut over it in strands, the first black blisters |
| **Mar** (2.0 m) | `mar` | The head: tall, a high dark bun, a long steel-grey coat buttoned to the neck | A pink gum bubble over the whole face, with a face pressed into it from inside and none of its own; pink gum gloves; a collar of her striped paper; black blisters on the skirt |
| **Montse** (1.75 m) | `montse` | A grey bob, a manila cardigan over a dark dress, flat shoes | The same bubble and gloves; her striped paper as a scarf |
| **Pilar** (1.88 m) | `pilar` | Long pale hair, a steel-blue dress | The same bubble and gloves; her striped paper as a short cape |

- **Aurelià is drawn from his own face** (redone 2026-11-21): Aitor's photos are all group shots,
  so only crops of him alone went to the image model (`assets/references/characters/aurelia/`, the
  originals in `raw/`). The first figure, from words alone, came out a generic comic-book strongman;
  what makes him himself is his head and his patterned shirt, and the Queen's marks sit on top.
- **The three have no face on purpose.** There is no photo of them, and Aitor asked for "a face as
  if it were Bubbaloo's": the Queen has put her own over theirs. It is also what tells the player
  they are held, where Aurelià has his violet eyes. Montse and Pilar were drawn from Mar's image so
  the three read as one team.
- In *Direcció* each stands with her own figure (`castleFigure` in `src/castle-models.ts` picks it
  by the fighter's id); the bestiary lists the team once, with a view for each.
- Their drawn faces in dialogue take the figures' colours (`SPEAKERS` in `src/dialogue.ts`). None
  has a portrait yet.

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

She is nobody: what is left of being a kid (lore.md), wearing Nuria Mendoza's face. Her motive is
good and her means are cruel. The fight is the whole game asked again, in the throne room, with
everything the party has: stage 3, the definitivas, three ánimas each. No joke, no cartoon monster.

- **Her figure** (2026-11-20): `[reina]` in tools/figures.toml, drawn from Nuria Mendoza's face
  photos (a mix of two drafts Aitor chose), Meshy's skeleton and clips (src/monsters/reina.json),
  2.8 m; her portrait, public/portraits/reina.png. The bestiary shows both.
- **Where**: her stage (src/throne-arena.ts). As she comes down from the throne the picture breaks
  into glass and the fight goes up onto the sala d'actes' stage, built for it: the boards with their
  gold edge and footlights over the dark rows of chairs, the indigo velvet in pleats with the
  school's banner, the balcony open onto the night city, and her throne beside her (the gum seat,
  the bubble she blows with her core beating in it, the crown of five flavours on top), her gum
  spreading from it over the boards and climbing the velvet, bubbles rising and popping. One warm
  spotlight on her, her core's pink, the city's cold glow, the footlights' wash. It keeps the throne
  room's card (places/palace-zones.md).
- **Her camera** (Aitor, 2026-11-20: «Aitor y Gerard algo más atrás y ella en el fondo»): the fight
  lines up along the stage (layout `z`, `THRONE_SPREAD`), the party near the footlights with their
  backs to the camera and she far up it before the balcony; the view is a little lower and wider
  than other fights' (`THRONE_VIEW`), to take in her throne.
- **Her entrance** (`THRONE_INTRO`, 7.5 s, skipped with Enter, Space or Escape): the stage dark;
  low along the front the footlights come on one by one while the party walks on; the camera glides
  up the dark stage to the throne, her core beating fast in the bubble, she a shape beside it; her
  spotlight slams on (a flash, a shake) and the camera is close on her from below; her crown's
  flavours light one after another and her name comes up («La Reina Bubbaloo. Lo que dejasteis en
  el patio.»); the camera pulls back over the party's shoulders into the fight and the bars open.
  The game drives the camera and light (`throneShot` in src/game.ts, the stage's `update`), the
  fight's screen the bars and the name in time with it (battle-ui `entrance`). Her figure and the
  stage's textures load as the party comes into the throne room, so it starts without waiting.
- **While she holds Aitor** her spotlight turns possession's violet, her core beats faster and the
  footlights falter; freed, the warm light comes back.
- **The rules are preliminary, on purpose**: Aitor (2026-11-20) leaves the fight's real design for
  last, once every ánima's mechanics exist; until then it is the version below.

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

- His eyes go violet, as Uri's did. **He crosses to her side**: he walks over to stand in front of
  her, turns on Gerard and from then on attacks from there, as a foe would; **his card crosses
  too**, out of the party's docks onto her side in possession's violet («Del lado de la Reina»), and
  **player 2 keeps driving him, against Gerard**, with all of his kit (built 2026-11-20).
  Freed, he walks back to his place and his card comes home.
- **The music does not change** when she takes him (Aitor, 2026-11-19, replacing the motif-only
  idea): it only fades out, for good, when the artilugio is played at her (`silenced` in `src/main.ts`).
- **By default there is no way out.** Without the artilugio they kill Gerard. It happens once, and
  it has to happen. It comes **only when she is about to fall** (Aitor's call, 2026-11-19): the
  possession is what nearly beating her brings. Lost to her before her tenth, it is an ordinary
  fall, with no call from Bernat; at her tenth she takes him even if he is down, and no blow can
  take her past it (`beaten` looks at her first).
- Built so far: his blow on Gerard comes on her turn (`CASTLE.aitor`, growing each turn she has
  him). **Player 2 plays that turn** (built 2026-11-19, a full turn on her side): his commands
  cross to the right of the fight in possession's violet, Atacar, his skills aimed at a foe that he
  can pay for, or Defender, and what he picks runs as his own action against Gerard (`heldAct` in
  `src/battle.ts`), growing as hers did; picked something that does not hurt Gerard, the thread of
  gum pulls his arm anyway, so the first time there is still no way out. His eyes go violet in the
  fight. Without a choice (the simulators) she moves him herself, as before. He and his card cross to
  her side (`crossOver` in `src/battle-scene.ts`, `.held-side` in `src/battle-ui.ts`, built 2026-11-20).
  Then Bernat calls, the salón de juegos is played, and they come back with it.
- **The artilugio survives a rewind** (decided 2026-11-19): her castle covering everything takes the
  day back, but not the artilugio once Bernat has brought it, nor the night she took Aitor
  (`rewind` in `src/story.ts`). Otherwise a fall to her on the last day sends the party to a doomed
  morning and the death that has to happen once happens again.
- To settle: how much PV she has on the way back (proposal: 40 %, the wounds showing).

### With the artilugio

The real one, in Gerard's hands: the board, four buttons and four pairs, eight notes
(story-outline.md § The device). Nobody says what it is for. It wakes as she takes Aitor: its four
lights go round on their own, on the real board and on the one in Gerard's hands on screen.

- **Every button sounds.** The real board on its own speaker, in the room (the game only plays the
  keys' and the pad's notes, when they stand in), and the battle song steps aside while it does,
  coming back once the artilugio is put away (docs/audio.md § The last fight). At the first note she
  starts: her intent clears. That is how Gerard learns it does something.
- **Notes in the right order** light six marks on Aitor's plate, from violet to his cyan. A wrong
  one puts them out (the melody's first starts it again). Aitor keeps attacking all the while.
- **All six**: the final boss's song comes in whole (an intro and three versions of its A, in order
  and then any of them; Aitor composes it), Aitor is free, his dock comes back, every ánima's maná is
  full. What is left is to finish her.
- It does **not calm her**. It takes Aitor from her. (Rejected already: a melody that soothes a
  tantrum.)
- How a press reaches the game (built 2026-11-19): the board sends each note over Wi-Fi to the
  game's server (`artilugio.py`), which passes it to the browser as an event (`src/artilugio.ts`).
  Without the board, the keyboard's 1–4 (two at once for a pair) or player 1's pad (left trigger
  held, the face buttons) stand in; the flat's piano is still a proposal.

Code, when built: Aitor on the enemy side is new (no party member fights for the other side
today); `aitor-poseido` in `src/battle.ts` and `src/story.ts`, as docs/progress.toml checks.

### The last scene

At 0 PV she does not die, and she does not come apart as the others do (Aitor, 2026-11-21).

- She sinks to the floor, small (`LAST` in `src/battle-scene.ts`). The fight's HUD goes, there is
  no victory screen, and the music goes silent: only the wind through the open balcony.
- Gerard walks up to her and **takes her by the neck**; the camera closes in low, from the side, on
  the two of them. Over it, the line «La mà del Gerard és al seu coll. Ella no s'hi resisteix.»
  and, in Gerard's dock, two commands and no clock. **Only Gerard chooses**; Aitor answers with one
  line, said in the fight as it plays out. Once he chooses, the welcome screen's piano comes back,
  sadder (docs/audio.md § The last fight).
- It plays inside her fight (`lastScene` in `src/battle-ui.ts` and `src/main.ts`); the fight closes
  after and the story hears the choice with the win (`ending` on the battle event, `castleEnding`).

| Command | What happens | Epilogue |
| --- | --- | --- |
| **Acabar** | «Hazlo.» The Foc Binari forms in the hand at her neck, his circle turning, and goes into her: she comes apart in specks that go from pink to grey. Over black: where the throne was, a classroom with the chairs up on the desks | Monday, the alarm, work. Everything in order, and a little greyer |
| **Bajar la mano** | «…Vale. Vale.» His hand comes down. The dream ends, in white, and they wake | Monday, the alarm, work. Some pink is still in the city. Gerard whistles the six notes |

These are **the two endings** (2026-11-19): to kill her, or to let her live, weakened. They
replace the three decided before (kill, wound, let live). Neither is the right one.
