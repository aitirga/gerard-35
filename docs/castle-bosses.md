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

**Redesigned on 2026-11-21** for the party that reaches each of them (its ánimas, grades, duals and
definitivas exist now; the first version was written before them) and for the castle's weaknesses
([castle.md](castle.md) § Weaknesses): the ring (water puts out fire, a spark runs through water,
fire melts the wire) is learned on the second floor and asked again by Dirección and by the Queen.
An element is always a prize and never a requirement: each boss has an answer within reach of fire,
physical, astral and Sangrado. **Balanced in the final pass (2026-11-21)**: the numbers and each boss's pair of `TARGETS` are in
[fight-sim.md](fight-sim.md) § The castle, as tuned.

**Whom they go for.** A boss goes for whoever in the party is closest to falling (fewest PV; on a
tie, whoever's turn it was), where pupils take turns: Aurelià's Pregunta and Expulsión, Dirección's
Expediente, the Queen's Pegote and the hand that holds (`closestToFalling`, `SHREWD` in
`src/castle.ts`). It is still said on the plate before it lands, so the answer is the same: the one
named holds on, is cured or is covered.

## Aurelià

**Aurelià** is the castle's first great boss: a history teacher at the Rec Comtal, a despot in the
classroom, an athlete once. The Queen holds him (his eyes are violet). He is a colleague of
Gerard's, written as an adult would know him: a man who has always confused being obeyed with
being right. He is not mocked and he is not a monster; beaten, he comes back to himself.

- **Where**: the gym, dressed as his; his fight goes up onto *La pista* (`src/boss-stages.ts`,
  [palace-zones.md](places/palace-zones.md) § The bosses' stages), with its entrance: the tubes
  row by row, then the school bell. A dais with a lectern before the mats, running lanes painted
  across the floor, a timeline along the whole wall, laurel and marble: his namesake is the
  emperor of the walls, the one who called himself restorer of order. Phase 1's floor has been
  turning into this room since the patio.
- **Met with**: stage 1 of growth. Two ánimas each, levels up to 3 or 4, the constellations' inner
  nodes.
- **How he announces**: he says it. Each move is a chip on his plate that names its target.

| Phase | PV | Moves | Question → answer |
| --- | --- | --- | --- |
| **La lección** | 100–65 % | *Dictado* (told a round ahead, on everyone); *Pregunta → X* (one, very hard); *Castigo* (on whoever uses the same kind of blow two rounds running) | **Part.** *El Atril* has its own PV and, while it stands, Aurelià takes half of everything. Break it: it is oak with brass corners, **weak to fire and to electricity**. Defender (or a protection) on a *Pregunta* leaves him exposed: the next blow on him is ×1.5 («Respuesta correcta») |
| **La carrera** | 65–30 % | *Vuelta*: a clock that runs on his plate, 20 s. When it closes, *Sprint* on everyone and a step of *Ritmo* (his Fuerza, for good; the chip says how many he has) | **Status and moment.** Any **new** status on him, with a clock or not (a burn, a wound, a shock), is a «Tropiezo»: the lap starts over **and he loses a step of Ritmo**. The same one again does not count: the ánimas have to rotate |
| **La última recta** | 30–0 % | *Expulsión → X* (out for two rounds); *Récord* (charged over two rounds, on everyone) | **Hold on, and keep one back.** Whoever holds on through the *Expulsión* stays in the room («Se queda»). A Tropiezo during the run-up of the *Récord* brings him down («Caída»): the Récord is lost and he is exposed, ×1.5. One status has to be kept unused for it |

- Aurelià has no weakness of element: he is a man, not gum. What is hers on him is the lectern.
- **Without the answer**: half damage all through the lesson, *Ritmo* piling up lap after lap, one of
  the party out of the room, the *Récord* whole.
- **With it, it shows**: the lectern breaking, «Respuesta correcta» on a defended question,
  «Tropiezo» and a step of Ritmo gone on a broken lap, «Se queda», «Caída».
- *El Atril* never blocks the win; breaking it removes *Dictado*.
- `TARGETS`: `aurelia-bien`, `aurelia-con-dos`, `aurelia-con-una` and `aurelia-sin-pensar`.
  `FightMoment`s for the picker: `aurelia-leccion`, `aurelia-carrera`, `aurelia-recta`.
- **After**: [castle.md](castle.md) § What each boss opens.

## How they look

Figures of `just character-3d` (OpenAI's image, then Meshy's model, rig and clips; the recipes are
in `tools/figures.toml`), drawn in their fights and in the bestiary. All four people keep the rule
of the Queen's own figure: an adult, held by her, never a joke.

| Who | Figure | What is theirs | What is hers |
| --- | --- | --- | --- |
| **Aurelià** (2.05 m) | `aurelia` | The real man: tall and lean like a runner, his dark curls, the full short beard, a silver hoop, his own shirt with a bold brown and black geometric print on sand, navy running shorts, trainers | A general's mantle of her wrapper paper (pink and black stripes) held by two black gum balls, a laurel of pink gum, her gum bound round his wrists like a gymnast's tape and criss-cross round his shins, violet eyes |
| **El Atril** (1.45 m) | `atril`, a creature in one piece | A lectern of dark oak with brass corners, his laurel on its front, the book open on top | Her gum pulled taut over it in strands, the first black blisters |
| **Mar** (2.0 m) | `mar` | The head of the school, the directora: the tallest, her own round face, straight auburn hair past the shoulders, her mustard yellow scarf over a long steel-grey coat | Violet eyes; pink gum gloves; a collar of her striped paper; black blisters on the hem |
| **Montse** (1.75 m) | `montse` | Her own long face and high cheekbones, an ash-blonde bob to the jaw, a manila cardigan over a black T-shirt, black trousers | The same eyes and gloves; her striped paper as a scarf |
| **Pilar** (1.88 m) | `pilar` | Her own long narrow face, long straight dark brown hair, long silver drop earrings, a steel-blue dress | The same eyes and gloves; her striped paper as a short cape |

- **Aurelià is drawn from his own face** (redone 2026-11-21): Aitor's photos are all group shots,
  so only crops of him alone went to the image model (`assets/references/characters/aurelia/`, the
  originals in `raw/`). The first figure, from words alone, came out a generic comic-book strongman;
  what makes him himself is his head and his patterned shirt, and the Queen's marks sit on top.
- **The three are drawn from their own faces** (redone 2026-11-21, Aitor: «que las caras ahora se
  reconozcan»). The first figures had no face on purpose, the Queen's gum bubble over it; now, like
  Aurelià, each is the real woman with the Queen's marks on top, and her violet eyes tell the player
  she is held. Aitor's photos are group shots, so only crops of each woman alone went to the image
  model (`assets/references/characters/<id>/`, the originals in `raw/`, the people behind painted
  out). Montse and Pilar were drawn beside Mar's image so the three read as one team; the faceless
  figures are kept in `output/characters/3d/<id>/v1`.
- **Choosing whom to hit**, the one under the cursor shows her name over her head and in the target
  picker («→ Mar»): three of a kind stand close, and the element chip alone did not say who is who.
- In *Direcció* each stands with her own figure (`castleFigure` in `src/castle-models.ts` picks it
  by the fighter's id); the bestiary lists the team once, with a view for each.
- Each has her low-poly portrait (`public/portraits/<id>.png`, `just character <id> --only portrait`
  from the same crops and her figure's image), with her violet eyes, in `SPEAKERS` (`src/dialogue.ts`).

## Mar, Montse and Pilar

**The management team**: **Mar**, the head, and **Montse** and **Pilar**, the two heads of
studies. Three at once, held by her, out of *Direcció* and waiting before its door, at the far end of Gerard's secretaría (`bossAt` of phase 2, `src/castle.ts`). Their fight is on *La sala de juntas* (`src/boss-stages.ts`, [palace-zones.md](places/palace-zones.md) § The bosses' stages): the blinds open, the three lamps, the stamp on the minutes; a lamp goes out with each who falls and the book shows the Acta's signatures. They are the people Gerard, the school's
secretary, answers to every day. Phase 2's floor has gone dark and turned to manila and steel on
the way here.

- **Met with**: stage 2. Three ánimas each, levels up to 6, the constellations' outer ring, so the
  three elements are within reach.
- **Each carries a folder**, an element shown on her plate, and they use on the party the same
  reactions the player learned (combat.md § Reacciones).
- **What did not work before**: the three were interchangeable, their moves were not told (wetting
  and the spark fell in the same enemy phase with nothing to do about it) and the Acta and the trade
  of folders ran on a count of rounds nobody could see.

| Rule | What it is |
| --- | --- |
| **Each says what she will do** | Her next move is on her plate, as Aurelià's are: «Expediente → X», «Horario», «Circular», «Firma». The round of the *Acta* shows on the three plates as «Firma», and the trade the round before it comes («Cambio de cargo al acabar la ronda») |
| *Expediente* | Whoever holds fire: burns one, and raises the level of a burn already there |
| *Horario* | Whoever holds water: wets everyone |
| *Circular* | Whoever holds electricity: electric on everyone; brutal on the wet |
| **The ring** | Each is weak to what undoes her folder (fire → water, water → electricity, electricity → fire). That blow also **overrules** her («Desautorizada»): she loses the move she had announced. Once per folder each: after it she is «Sobre aviso» until the next trade |
| ***Acta*** | **Mar presides.** Every fourth round (third until 2026-11-26) those standing with her each sign on their turn (chips «Firma 1/3»). The last signature closes it and announces *Resolución* on everyone for her next turn: it all but kills whoever does not hold on. One who is blinded, confused or without her turn does not sign («No firma»). An Acta left open at the end of the round is void. **Without Mar there is no Acta** |
| *Cambio de cargo* | Every four rounds they trade folders, and their weaknesses with them. It takes «Sobre aviso» off |
| *Respaldo* | (2026-11-26) On a round with no Acta, one under half her PV is held up by the one of them with the most: «Respaldo → Montse» on her plate the round before, and on her turn she gives her a fifth of her PV back. One every two rounds at most. Overruled like any told move |
| **When one falls** | (2026-11-26) The first time, she stays on the floor at 1 PV («Caída»), and another takes her folder meanwhile and starts her *Readmisión*, still doing her own moves: at the end of each round a page of the papers («Readmisión 1/2»), and after two she is back in her seat with a quarter of her PV and her folder. **On the floor only what undoes her folder finishes her** («Aguanta» otherwise). Overruling the one readmitting stops that round's page. Nobody comes back twice, and with nobody left in her seat there is nobody to readmit her. An Acta being signed, or a Resolución announced, is void. Down for good, the next in line keeps her folder |
| **The last one** | If she is **Mar**: *Voto de calidad*, the three elements in one and she hits harder. If Montse or Pilar: **«En funciones»**, the three elements without the extra |

The question has three parts:

| Part | Answer |
| --- | --- |
| **What to break before it fires** | Each round there are three moves told and two turns: overrule the *Circular* while the party is wet, or the *Horario* before it |
| **Order** | Mar first (no more Actas, no Voto de calidad, but she is the one who takes longest) or whoever holds water first (the spark loses its edge). Both work and each costs something else. And whoever falls: finish her on the floor with what undoes her folder, or she is back in two rounds |
| **Moment** | Keep a status (blind, confuse, shock) for the signature, and the Cúpula, the Telón or Defender for the *Resolución* |

- **A second answer for a party without the element**: Cortocircuito, Confusión, Control remoto and
  Cegado already take away or weaken a move that has been told; now there is something to take away.
- **Without the answer**: the party is wet, then struck, and the Resolución lands on nobody holding on.
- **With it, it shows**: «Desautorizada» and a move that never comes, a signature missed («No
  firma»), the Acta void, «Sin quórum» once Mar has fallen.
- `TARGETS`: `direccion-bien`, `direccion-con-dos` and `direccion-sin-pensar`; the split into
  `-sin-orden` and `-sin-elementos` waits for a bot that plays one part of the answer and not the other.
  `FightMoment`s: `direccion-tres`, `direccion-dos`, `direccion-una` (Mar alone, Voto de calidad),
  `direccion-funciones` (Montse alone, en funciones).
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
  flavours light one after another and her name comes up («La Reina Bubbaloo. La que Todo lo
  ¿Corrompe?»); the camera pulls back over the party's shoulders into the fight and the bars open.
  The game drives the camera and light (`throneShot` in src/game.ts, the stage's `update`), the
  fight's screen the bars and the name in time with it (battle-ui `entrance`). Her figure and the
  stage's textures load as the party comes into the throne room, so it starts without waiting.
- **While she holds Aitor** her spotlight turns possession's violet, her core beats faster and the
  footlights falter; freed, the warm light comes back.
- **The rules are her definitive design** (2026-11-21, once every ánima's mechanics existed): the
  whole game asked again, each stage examining a floor of the castle. Aitor held, the artilugio, the
  melody, the last scene and the two endings are as they were. Since 2026-11-26 (Aitor: «aumenta la
  dificultad de la batalla final», then «unas 15 rondas de media») she comes back with 2.5 times the
  first fight's PV (`reinaVueltaPv`), at 70 % of it, so **Las manos** come out of the floor again
  before La pompa; `reinaFuria` would make her hands and pegotes land harder on the way back (1 for
  now). La Pompa and Aitor's blows are as they were (`CASTLE`, `src/castle.ts`).

| Stage | PV | What she does | What it examines |
| --- | --- | --- | --- |
| **El chicle** | 100–70 % | **Five layers, the five of her crown**: fresh (fire), three with a filling (what undoes each: the ring), rancid (physical, or wet it and then fire). Under a layer everything goes in at ×0.25. The layer's answer tears it off («Se despega») and takes a piece of her PV with it; she spends her turn wrapping herself in the next. With a filling, her *Pegote* burns, wets or shocks. **A layer torn off does not come back**: the five gone, she has no gum left. A dual tears off any layer | The three years of her pupils |
| **Las manos** | 70–40 % | Two hands, each a thing with its own PV and its own job: **the one that holds** (*Atrapar → X*, told: whoever holds on is not caught, «No lo coge») and **the one that crushes** (*Aplastar → X*, told). Each hand standing takes a quarter off what reaches her. A hand broken takes its told move with it, and lets go of whoever it held | Part, order and holding on (Aurelià) |
| **La pompa** | 40–10 % | *La Pompa* is **a thing with its own PV**, in front of her: while she blows it she takes less than half (`pompaTras`, ×0.375 since the final pass). Burst in time it goes off in her face («¡Pompa rota!»): she loses her turn and a piece of her PV. Left alone, it goes off on everyone | What to break before it fires, with everything kept (the definitivas) |
| **She takes Aitor** | 10 % | Below | – |

- **Her crown is her marker**: each layer torn off puts out one of its five flavours
  (`setPeeled` in src/throne-arena.ts). No new HUD; her plate says «Capas N».
- **Without the answer**: ×0.25 all through the first stage while she hits every turn, one of the
  party caught, La Pompa whole.
- **Placeholder**: La Pompa and the two hands are drawn with the palace minion's model at their own
  size; neither has a figure yet.

`TARGETS`: `reina-toma-a-aitor`, `reina-con-artilugio` and `reina-sin-melodia`; one without the answer for each stage is still to be added (the balance round). `FightMoment`s:
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
- How much PV she has on the way back: 70 % of 2.5 times her first fight's (2026-11-26; it was 40 %, the wounds showing).

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

- She sags where she stands, bowed and spent, her full size still: imposing, with no strength left
  (`LAST` in `src/battle-scene.ts`; Aitor, 2026-11-21: not small). The fight's HUD goes, there is
  no victory screen, and the music goes silent: only the wind through the open balcony.
- Gerard walks up to her and **reaches up to take her by the neck**; the camera closes in low, from the side, on
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
