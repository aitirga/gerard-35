# Marta · (working title)

Status: base being built (round 7) on `feat/side-mission-marta` · Last updated: 2026-11-13

**Decided** means the user said so. **Proposal** means it came from the design side and is waiting
for a yes.

## Summary

_To write once it converges._ Marta, Aitor's best friend and a singer, is in the Basque Country,
one of the hardest places to reach. Her mission ends against a boss that sings with her real voice.

## Protagonist

- Who (decided, `docs/story-outline.md`): **Marta**, a **singer**.
- Relation to Gerard and Aitor (decided): **Aitor's best friend**, Gerard's friend too.
- **How she and Aitor met** (decided, real): they played in the same band, **Keiran**: **Aitor on
  piano, Marta singing**. When, where and what they played: _open_
- **Job** (decided, real): she is a **dentist** now. She also sang in a rock band, **Mindtrap**,
  which **has split up**. She and Aitor are still very close.
- **Her character** (decided, real): spontaneous, crystal-clear, direct, pleasant, loyal; a very
  good singer; funny.
- **Her moment** (real): she **came out of a very long relationship not long ago** and is now
  exploring. Whether the game mentions it, and how: _open_ (a real person's private life; her say
  matters).
- Her link to Gerard, apart from Aitor: _open_
- Unmistakably her (a phrase, a habit, how she laughs): _open_
- Does she still sing anywhere now: _open_
- As a kid: _open_

## Place

- Where (decided round 1): **Alegia** (`docs/places/alegia.md`), San Juan kalea. What Alegia is to
  her (her village, where she works, a visit) and where in it she is found: _open_
- How to get there (decided round 1): **hard to reach from the start: the trip to the Basque
  Country has to be unlocked or paid for.** How (money, a person, another mission), how much and
  from which station: _open_. Proposal (`docs/story-outline.md` § Getting there): the long-distance
  train, the main money goal of the game.
- Scene: **exists** (`alegia` in the dev picker, thirteen things to look at, no story yet). The
  station is outside the built zone, 200–300 m up the street: the arrival point is _open_.

## The problem

- What the bubble did (decided round 2): **Marta has lost her voice. She cannot sing: when she
  tries, it comes out wrong.** She speaks normally.
- **With the voice went what makes her special** (decided round 2): her qualities (loyalty, being
  crystal-clear, friendship…) are loose in her own world, as its monsters.
- How she is lost without it, and how she carries it day to day: _open_
- Routine vs. ilusión, here (proposal): she sang in two bands and now sings in none; she is a
  dentist. The voice is what the routine put away, and the Queen has taken it out and let it loose.

## Clues

| Clue | Where | Flag |
| --- | --- | --- |

## Unusual things

- _open_

## Beats

1. Arrival:
2.
3. Boss:
4. The ánima leaves her:

- **It leads into her universe, her dungeon** (decided round 2), **Las cuerdas** (decided round 4;
  the name is a working one): a dark void crossed by taut strings of light in every direction, a
  piano seen from inside, or huge vocal cords. The party walks on them; they all meet at one point,
  where the boss is. Identity card (proposal, to take through `docs/visual-style.md`'s checklist):
  dominant a dark petrol blue-green, no place has it; signature material silver strings of light;
  no pink, no violet. **Built to it** (`docs/visual-style.md` § Las cuerdas, `docs/places/cuerdas.md`), with
  one exception the guide asks for: the bubble they came in by is the Queen's pink.
- **Three rectangular spaces with a puzzle each** (decided round 4): three mazes that **change and
  evolve with Marta's voice singing**. **A progressive puzzle, on the map** (decided round 5):
  **pieces that fall, and moving in time with the voice.** Round 6's proposal is **built as a
  base to try and change** (the user, round 7: «probemos la implementación base», «los puzzles
  igual los vamos cambiando»), § The three mazes.
- **The boss is a surprise** (decided round 5): **its dynamic, skills in time with the note, is
  felt at the end.** The foes and puzzles before it must not explain it; at most something light
  in the fights. So the three qualities fight by their own rules, with no note window.
- **The way in is the piano** (decided round 3): Aitor starts playing **a very characteristic song
  of theirs**, ***Izana Dena Geroa*** (decided round 4), and Marta sings; **it sounds terrible at
  first**. **Aitor records the piano**; the real Marta will be asked to record the voice. Whose
  song it is (Keiran's own?), where the piano is in Alegia, how the bad take is made, and how it
  opens the way in (proposal: the bubble opens where the right note should be): _open_
- Proposal: with the voice back, they play it well at the end, and that is when the ánima leaves
  her.
- **Its monsters are her lost qualities** (decided round 2), **three** (decided round 3), each the
  quality loose with nobody to govern it, with a rule that comes from what it is (rules: proposal):

  | Foe | Look (proposal) | Rule (proposal) |
  | --- | --- | --- |
  | **La Lealtad** | A figure standing in front of another, its back to it | Takes the blows aimed at the one it guards |
  | **Lo Cristalino** | Thin glass, seen through | Shows what the foes will do next round; returns magic; breaks under a physical blow |
  | **Lo Directo** | A straight line, an arrow of light | Says whom it will hit, and hits very hard: Defender matters |

  Kept apart from Uri's tower (`docs/quests/nuria.md`), whose creatures are his fears: these are
  not what she is afraid of but what she is.
- **Marta does not seem herself, and comes back** (decided round 4): without her qualities she is
  polite, evasive and dull on arrival, and Aitor notices first. **She gets nothing back until the
  end** (decided round 5, replacing round 4's "one quality at a time"): everything returns at once,
  after the boss.
- Own mechanic, and how it is taught: _open_. Proposal: the boss's pulse already runs through the
  dungeon, so its rule is learned on foot before the fight.
- Diegetic gates:
- Aitor's moments: _open_. She is **his** best friend: this is the mission where Aitor has most to
  say.
- Hours spent:

## The three mazes (base built, to change by playing)

One rule in all three (`src/cuerdas.ts`, pure; `src/song.ts` is the phrase's clock): a rectangle of
pieces hung between strings. The voice sings a short phrase in a loop; **each piece answers to one
note, has its colour, and falls when the note is not its own.** A piece about to fall trembles
first. Falling takes whoever fell back to the rectangle's near edge, nothing else. It reads with the
sound off: colour, height and the tremble.

| Maze | New | Asks for |
| --- | --- | --- |
| 1 · *Dos notas* | Two notes taking turns: half the floor is there, half is not | Reading the rhythm, crossing in time |
| 2 · *Una pasada* | Three notes, and cracked pieces that **fall for good** once stepped on (until the maze is left) | Planning the way before setting out |
| 3 · *Las clavijas* | Three notes; a **peg** beside each row changes the note the whole row answers to | Building the way: the rows in the song's order |

After each maze, a wide platform (a knot of strings) and the quality that waits on it. Steps are
timed on the map, never blows: nothing here says the last fight will be about that.

## The qualities (base built)

Each one a foe with one rule read on its plate (`MARTA` in `src/battle.ts`), by kind of blow, never
by who wears what. Beaten, its light runs down the strings to the centre (proposal, built): the
boss is everything she lost, together.

| Fight | Foes | Rule |
| --- | --- | --- |
| `cuerdas-lealtad` | **La Lealtad** and an **Eco** | A blow aimed at the Eco lands on La Lealtad while she stands (blows on every foe get past her). The Eco's own blow grows each turn: how long to spend on her is the decision |
| `cuerdas-cristalino` | **Lo Cristalino** | Magic comes back at whoever cast it and does nothing to it; a physical blow lands half as hard again. It says whom it will hit a turn ahead |
| `cuerdas-directo` | **Lo Directo** | Says whom it will hit and hits very hard. Defender is the answer, and costs the turn |

**Their moves** (reworked 2026-11-15, the user: «repiénsalos un poco más… habilidades que usen, no
solo la pasiva y ataques normales»; a base to play, names and numbers are proposals). Each foe has a
few named moves, said on its plate a turn ahead, and one thing the party can do about each. None
leaves its place except Lo Directo: what they do reaches from where they stand, drawn in the notes'
colours (`cuerdasFx` in `src/battle-scene.ts`, the pictures in `src/dual-fx.ts` § Las cuerdas, the
bodies in `src/cuerdas-foes.ts`).

| Foe | Move | What it does | What the party can do |
| --- | --- | --- | --- |
| La Lealtad | ***Juramento*** | Her shield's strings sound and the blow goes at **whoever struck her last** | Choose who touches her: the one who can hold on |
| La Lealtad | ***Lazo*** | Every fourth turn, if her Eco is hurt or gone: ties it back, whole (a fallen one returns, its Resonancia from the start) | Killing the Eco first does not last while she stands: go through her, or hit both at once |
| Eco | ***Resonancia*** | Repeats the Juramento on the same one, harder each turn it has had (up to a ceiling) | The longer the fight, the worse: it is the clock of this fight |
| Lo Cristalino | ***Destello*** | A thin beam of magic on whom it said | Defender on that one |
| Lo Cristalino | ***Estallido*** | At half its PV it **cracks**: shards on everyone, once (it never brings anyone down) | From here on it is «Rajado»: it sends no magic back and magic lands on it as on anyone |
| Lo Cristalino | ***Prisma*** | Cracked, its light comes out split in four colours, on everyone, every turn | Finish it: the second half is a race, and now magic helps |
| Lo Directo | ***Golpe directo*** ×2 | Very hard, on whom it said | Defender on that one |
| Lo Directo | ***En línea recta*** | Its crossbar out: through everyone, less hard | Both hold on, or take it |
| Lo Directo | ***Estocada*** | Draws from further back: its hardest blow, on whom it said. Its lance **stays in the floor** until its next turn («Clavado»): blows on it land half as hard again | The window: hold on, then spend everything while it is stuck |

## Final boss

- Who / what, look (decided round 2): **an ethereal, volatile Marta: a pure ánima**, with the song
  showing on her as a **pulse**. Not Marta possessed: the real Marta is beside the party. Name,
  colour and what it is made of: _open_
- **It sings** (decided 2026-11-07): the real Marta records **songs of single notes** for the game.
  They are its **cyclic, endless attack**: a buff that comes round with the song and an attack on
  every tick.
- **The window to hurt it is the note** (decided): while a note sounds it can be attacked and takes
  damage; between notes it is **immune**. The party times its attacks to her singing.
- Decided and built: the note shows on screen as that status ring, so it can be played with the
  sound off, and the window runs on the fight's clock like the timed statuses (`docs/combat.md`
  § Estados en tiempo real). Still a proposal: Defender pays between notes.
- Must not repeat: Joan's *Escala* in La Sobremesa (a note that climbs turn by turn,
  `docs/quests/universidad.md`), nor the artilugio's melody of the ending, which is Aitor's.
- **Name** (proposal, built): **La Voz**. `Encounter` `voz`, `FoeKind` `voz`.
- **Built as a base** (`MARTA` in `src/battle.ts`, the phrase in `src/song.ts`):
  - The phrase runs on the fight's clock, in both phases. **It shows as a status on her plate and
    nowhere else** (decided 2026-11-13: «un status effect como de quemado, la bola que gira… algo
    más sutil, tipo un status effect continuo»): one icon like a fire's clock that never runs out.
    Its ring is the phrase, an arc per note in the note's colour and a gap per silence; its hand
    goes round once a phrase; it is lit while a note sounds and flashes as each starts; its corner
    is her Crescendo. A first version drew a track of notes across the top of the fight: cut. Her
    body is there while she sings and almost gone in the silences.
  - **A blow chosen while a note sounds lands; in a silence it goes through her** (nothing, and the
    maná is spent). Fire and bleeding on her only hurt on a note too.
  - ***Eco***: every note that starts hurts the whole party a little (Defender takes two thirds off).
  - ***Crescendo***: every time the phrase comes round, her Magia goes up one, and her Eco with it.
    No ceiling: the fight cannot be sat out.
  - ***Acorde*** (the players' side of it): a second blow from **the other** fighter inside the same
    note lands half as hard again. This is where the two players time each other.
  - Her own turns go round three moves, and each phrase has its own three (reworked 2026-11-15,
    `VOZ_TURNS`; a base to play):
    - *Andante*: ***Guardia*** (the next blow on her lands at half, and is spent), ***Nota clara***
      (until her next turn magic comes back; she says whom she will hit) and ***Golpe directo***
      (very hard, on whom she said). One move from each quality.
    - *Allegro*: ***Coro*** instead of Guardia, once: a ring leaves her throat and a **second
      voice** comes together beside her, an Eco of her own (few PV, its Resonancia growing). It
      takes blows in the silences too, so there is something to do between notes; left alone it is
      a second clock. It goes when she does.
    - *A capela*: ***«Toma aire»*** (she lifts her arms and draws the four notes' light in: the
      plate says «Calderón → todos»), then ***Calderón*** (the held note let go on everyone), then
      Golpe directo. **An Acorde on her while she holds her breath breaks it**: the Calderón is
      lost, she is «Sin aire» and her next turn does nothing. It is the Acorde's reason to exist
      in the last phase: the two players have to land inside the same note, on purpose.
  - **Phases**, by her PV, each a `FightMoment`: *Andante* (long notes, long silences), *Allegro*
    (from 60 %: short notes) and *A capela* (from 25 %: very short notes and one long one a phrase).
- How the friend helps: _open_ (she is beside them and gets nothing back until it is over).
- What the party's ánimas do against it: nothing special by ánima (rules by kind): fire keeps
  burning on the notes, a mark (Ángulo exacto, Punto débil) waits for one.
- **Marta's recordings replace the placeholder**: the notes are synthesised until her files exist
  (§ Assets).

## Ánima

- **Skills like hers** (decided 2026-11-07): song and timing, in the same spirit as the boss.
- Name, colour (grey → colour in the second round): _open_
- Party bonus (`ANIMAS`): _open_
- Brings: wearable ánima / single skill: _open_
- Look, motto, interface theme: _open_
- Skills: _open_
- World key it opens: _open_
- Design of the wearable ánima: `docs/animas/<id>/README.md`, with `/anima`.

## Second round

- _open_

## Assets

Figures come from `/character-3d`: `about` and `cues` written here, ready for `tools/figures.toml`.

| Who / what | Kind (person, creature) | Photos it may send | `about` and `cues` | Toy image approved | 3D in game | Portrait | Expressions | SPEAKERS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Marta | person | _to ask_: `assets/references/characters/marta/` | _open_ | — | **stand-in**: `src/characters/marta.json`, Nuria's hand-built figure in other colours; it does not look like her | — | — | name only, no portrait |
| The qualities, the Eco, La Voz | built by hand | — | — | — | `src/cuerdas-foes.ts`: string, glass and light, each part moving on its own (a figure from a file moves as one piece) | — | — | — |
| The piano in Alegia | prop, by hand | — | — | — | `buildPiano` in `src/cuerdas-scene.ts` | — | — | — |

- **Marta's recordings** (decided): one file per note, to ask her for. Which notes, how long, what
  format: _open_

Commands:

```bash
```

## Open

- Everything marked _open_ above.
- **Provisional, to settle with Aitor**: where the piano and Marta stand (now under the pergola of
  the square by the town hall, `PLACES_MARTA`); her figure (a stand-in); the bonus of her ánima in
  `ANIMAS` (Magia +1, Velocidad +1, 10 PV, as the others'); every line in `LINES_MARTA`.
- **Not built**: the trip to Alegia (it is reached from the picker only); the clues; a second player
  driving Aitor never falls in a maze (only Gerard is checked); what is beaten inside is one visit's
  and is not saved; the song played well at the end is a line, not yet music.

## Implementation plan

The user asked for a base to try (round 7), so the converge check was skipped: the gaps it would
have found are in *Open*. Each step is a commit and playable from the picker.

**Status (2026-11-14): steps 1 to 9 built**, playable part by part with `just dev-mission marta
<part>` (start, piano, inside, maze-1, lealtad, maze-2, cristalino, maze-3, directo, voz, won, done).

| # | Step | Files | Blocked by |
| --- | --- | --- | --- |
| 1 | **The song's clock**: phrases, what sounds at a moment, onsets crossed. Pure, tested | `src/song.ts`, `tests/song.test.mjs` | — |
| 2 | **Fights**: the three qualities, the Eco and La Voz; their profiles, EXP, sizes, sounds, moments; the fight tester; `just fight-sim` targets | `src/battle.ts`, `src/stats.ts`, `src/levels.ts`, `src/arena.ts`, `src/battle-sim.ts`, `src/battle-sounds.ts`, `src/jump-menu.ts`, `tests/cuerdas-fight.test.mjs` | — |
| 3 | **Their bodies**, of light and string, showing their rule (La Voz there on a note, gone in a silence) | `src/cuerdas-foes.ts`, `src/fears.ts`, `src/battle-scene.ts` | Design choice: built by hand, not `/character-3d` (§ Assets) |
| 4 | **The fight's song on screen**: a continuous status on her plate (ring, hand, colour), the notes' sound | `src/battle-ui.ts`, `src/style.css`, `src/sfx.ts` | Marta's recordings (placeholder synth) |
| 5 | **Las cuerdas**: the place's plan, its mazes' rules, the scene (strings, pieces, platforms, the centre, light and air) | `src/cuerdas.ts`, `src/cuerdas-scene.ts`, `src/environments.ts`, `src/scenery.ts`, `src/grading.ts`, `src/effects.ts`, `tests/cuerdas.test.mjs`, `docs/visual-style.md` | — |
| 6 | **The story**: Marta in Alegia, the piano, the bubble, the mazes, the four fights, the way back; flags, the picker's arc and parts, the ánima and its light | `src/friends/marta.ts`, `src/story.ts`, `src/story-points.ts`, `src/animas.ts`, `src/dialogue.ts`, `src/game.ts`, `src/main.ts`, `server.py`, `justfile`, `tests/marta.test.mjs` | Marta's figure (a stand-in until her photos); the trip to Alegia (the game has no money yet) |
| 7 | **Screenshots**: arrival, each maze, each fight, La Voz's phases, the ánima | `scripts/screenshots/marta*.json` | — |
| 8 | **Docs**: her rows in `docs/chapter-2.md`, `docs/lore.md`, `docs/story-outline.md`, `docs/progress.toml`, the place's page | `docs/…`, `docs/places/cuerdas.md` | — |
| 9 | **Report**: `output/reports/marta/index.html` | — | — |

Later, each its own piece: the wearable ánima with `/anima` (song and timing); the clues and who
mentions her; the ticket; Marta's figure, portrait and expressions; her recordings; the second round.
