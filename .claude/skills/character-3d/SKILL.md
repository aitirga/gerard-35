---
name: character-3d
description: Make a figure for Gerard's game in 3D with image generation and Meshy: a real person from their photos, someone invented or an NPC from a description, a monster, foe or creature. It comes out as a toy figure that belongs in the game's world, recognisable but not realistic, and is put in the game. Use when the user wants a new character, friend, NPC, boss, foe, monster or creature model, or wants to redo one ("personaje", "modelo 3D", "monstruo", "enemigo", "jefe", "figura", "meshy").
---

# 3D figures

Talk to the user in Spanish. Everything runs through `just character-3d` (`tools/character_3d.py`,
`tools/README.md` § Personas reales), and each figure is a table in `tools/figures.toml`.

**The look is what the user fought for.** Hand-built primitives didn't tell people apart; hand
sculpting and likeness-first models were rejected as scary and "demasiado realistas". What worked
for people is a **toy figure of the game's own world**: big rounded shapes, matte plastic, flat solid
colours, recognisable through two or three big features. **Monsters are the exception** (Aitor,
2026-11-19: "más miedo"): same world, light and scale of detail, but a sculpted horror figure, like a
stop-motion puppet for adults, not a toy (`MONSTER_LOOK` in `tools/character_3d.py`). The image step
decides this, so it gets approved before anything is paid for.

## 0 · Load, quietly

`AGENTS.md` (tone, reachable from the picker, balance), `docs/visual-style.md`, `tools/figures.toml`
(how the others are described), and for a friend their `docs/quests/<id>.md`.

## 1 · The brief

Decide the kind with the user, and write the table in `tools/figures.toml` (its header says every
field). The table's name is the figure's id in the game.

| What | `kind` | Route |
| --- | --- | --- |
| A real person: a friend, family | `person`, with `photos` | Photos → faithful front → toy → views → model → skeleton → game rig |
| Someone invented, an NPC, a person with no photos | `person`, no `photos` | Words → toy → views → model → skeleton → game rig |
| A monster with two arms and two legs (the castle's pupils) | `monster` | Words → image → views → model → Meshy's skeleton + walking/running clips → `public/models/monsters/`, no face |
| A monster with no human shape (a heap, a beast), an object turned monster | `creature` | Words → image → views → model → game, in one piece |
| A pet on four legs (Nuria's cats) | `animal`, photos of the animal in `face_photos` | Photos → toy → views → model → the game's cat skeleton measured on it (`tools/animal_rig.py`) |
| Someone carried in another's arms (Nil) | `held`, the carrier says `carries` | Words and `art` → toy sitting as if held → views → model → in the carrier's arms |

Anything that must walk, talk and blink like the cast is a `person`, also if it isn't human. A foe
that walks but has no face (a bubble, a mask) is a `monster`: Meshy rigs it like a person and its
clips come along, but nothing looks for eyes or a mouth. Meshy only rigs two arms and two legs: a
`creature` wobbles and lunges as one piece, like Uri's fears. A monster still uses Meshy's own
skeleton (`src/monsters/<id>.json`, seen in `just model-lab` → `model-lab.html?monstruos`); putting
it on the game's rig for foes is work still to propose.

**Photos**

- They stay local and untracked: `assets/references/characters/<id>/`. Ask the user to drop them.
- **Never send a photo of a real child**, also when the figure is a child (Gerard at ten): draw them
  from words and `art`, the game's own images, like their adult figure's `toy.png`, or from a photo
  of them as an adult in `face_photos` (Bernat and Jan), described younger in `about`.
- A photo with someone else in it, even a reflection in sunglasses, or a name beside it: paint that
  out on a copy before listing it, and say so.
- **Look at each one before listing it, and list only what may leave this machine.** Listed photos go
  to OpenAI; a photo out of `photos` never does. Leave out any that is shirtless, intimate, or has
  other people or children in it, and tell the user which you left out and why.
- Meshy only ever sees the stylised images. That is how the tool works: keep it so.

**The words**

- `about`: who they are or what it is; build, clothes and colours.
- `cues` (photos only): what makes this person themselves, as **big shapes and colours**, never as
  fine detail: head shape first (long, round, wide), then what is unmistakable (round glasses, a beard
  as one flat patch, an earring, hair in big chunks). Ask the user: they know these people, and the
  first draft is usually wrong about what matters.
- `height`: metres in the game. The cast is close in size (Gerard 1.75, Aitor 1.82): small differences.

**Rules a monster's or a person's look must pass** (say which one when you push back)

- Not a children's game: never cute, no joke or food monsters, no googly eyes, no smile on a threat.
  For people toy is the material, not the tone; monsters are not toys at all.
- Saturated pink stays La Reina Bubbaloo's; violet stays possession's and fear's
  (`docs/visual-style.md`). Use them only when that is what the figure is.
- Her gum on an object or a person is the easiest way to draw food by accident: brown wood under
  glossy pink came out as chocolate with icing (El Atril's first image). Say the material plainly
  (dark oak planks, brass corners), make the gum matte and pulled taut in strands, and write that it
  must never look like food.
- A photo with other people in it never goes to the image model, and is never listed in `photos`:
  describe the one person in words in `about` instead (Aurelià, from a group photo).
- It reads from a high camera at 40–75 pixels a metre: a strong silhouette and nothing small.
- Its silhouette and main colour differ from those of whoever it shares a screen with.

**A family of monsters** (the castle's pupils, `tools/figures.toml` from `[chivata]` on; the design is
in docs/castle.md § Bestiary): every `about` opens with the same family sentence and its year, then
says what only this one has, and that trait is how it fights (memory: few coherent monsters). What
the rounds of 2026-11-19 taught:

- **What frightens**: no face where a face should be, with a face pressed into it from inside ("the
  hollow imprint of a face, like a face pushed against a rubber sheet"). A plain smooth bubble came
  out cute. Too thin, too still, a neck a little too long: unsettling; round and stubby: a plush.
- **The same one, another year**: put its approved `toy.png` in `art` and say "the same figure, a
  year older", or it comes out a different monster.
- Say what it is made of when it hardens ("rubbery folds of hardened gum, not rock"), or it turns
  into a rock golem.
- **Never blocky limbs or the cast's clothes on a monster**: they read as real people swallowed.
- Nothing hanging in front of the chest or crotch (a deflated bubble, a sack): it reads badly. Say
  "nothing hangs from its chest" and put a collapsed thing over the head instead.
- Compare them **to scale beside Gerard** on one sheet, smallest to biggest: that is how the
  progression is judged, not one by one.
- **Meshy's A-pose makes a monster symmetric.** La Chivata's one long arm came back as two normal
  ones, and El Castigado's one wrist tag as two. Give a monster traits that survive a mirror, and do
  a one-sided one in the game (scale that arm's bones, hang a tag on one hand).
- **The end of the climb is loud, not grey.** Aitor turned down the rancid ash-grey third year:
  "más chicle, más contraste, rosa chillón con zonas o pústulas negras". Rot shows as black on hot
  pink (pustules "the size of a fist", so they read from above), not as a fade to grey.

## 2 · The image: get it approved before paying

```bash
just character-3d <id> --dry-run            # what would be made and sent
just character-3d <id> --to toy             # the image; about a minute
just character-3d <id> --from toy --to toy  # another go
```

Put `output/characters/3d/<id>/toy.png` in the sidebar and ask. **Do not spend Meshy credits on an
image the user hasn't seen.** If several come at once, a sheet side by side lets them compare. A
change of look is cheap here and expensive later, so insist until it is right. If OpenAI answers 429 with
`credit_balance_exhausted`, the account is out of money: stop and tell the user, there is no way round it. Change `about` or
`cues`, not the shared prompts, unless the whole game's style is what changed.

## 3 · The model

```bash
just character-3d <id> --from views
```

Three more images, then Meshy: about 30 credits for the model and 5 for the skeleton, some minutes.
With `--to views` you can look at the three views before paying (a monster's views must keep its
trait: the long arm, the hunch).
Run it in the background. Say what it will cost if it is more than one figure. People also get their
face found on the model: look at `output/characters/3d/<id>/rigged.face.png`, whose red boxes must
sit on the eyes and the mouth. They drive the eyelids and the talking.

Small fixes don't need another model: change the converter or a flag (`clean_shaven` took Gerard's
moustache off) and run `just character-3d <id> --from game`, which is free. Regenerate only when
the shape is wrong.

## 4 · In the game

The files land in `public/models/` and `src/characters/` or `src/creatures/`. Then connect them:

**A person.** `npc.character` or `makeMate` use `src/characters/<id>.json` like any other, with the
entity's scale in `scale` of its table. They need a `SPEAKERS` entry to speak, with `portrait`. Only a figure in the bed (`src/bed.ts`) needs
its `hip`.

**Portraits are not this figure: the 3D figure is for the game's world only.** Aitor rejected both
portraits rendered from the model and portraits drawn from `toy.png`. What people see of a face in a
conversation, a menu or a fight's plate is a low-poly painting in the style of `gerard-child.png`, Nil and
Nuria, made with `just character` (tools/README.md):

```bash
just character <id> [--variant child] --only portrait --force \
  --photos <only the photos listed for it in figures.toml> \
  --context assets/characters/gerard/portrait-child-transparent.png \
  --description "Drawn in exactly the same cute, warm, polished low-poly style and framing as the boy's portrait in the first artwork image. <its about>"
just character <id> [--variant child] --only expressions --expressions riendo sorprendido   # one image each, once the plain one is approved
```

It only draws, never pays for a model. A child is drawn from an adult's photo and words, as in `toy`.

**An animal.** `src/cats.ts` builds it from its file when it is loaded (`COMPANIONS` in the game's
and the bestiary's `loadCharacterModels`), on its own measures of the cat skeleton, so the gait plants
its paws under its hips; without the file it keeps its primitives. Check it walking, trotting, sitting
and pouncing (`just screenshots cats --gpu`): the converter finds belly, back, the neck line under the
chin, ears and tail by shape, and a model that stands otherwise may need its thresholds. Its pose must
be straight from the front, all four paws on the ground and the tail clear of the body.

**Someone held.** The carrier's table says `carries = "<id>"`; `buildCharacter` puts the figure on
the forearms against the chest and turns the arms round it (`CARRY`). Nothing animates a carrier's
arms, so it holds everywhere they appear.

**A creature.** It is a template for a foe, with the part names of the minion and Uri's fears:

```ts
// src/fears.ts
import { CREATURES, buildCreature } from './character-model';
const expediente = buildCreature(CREATURES['./creatures/expediente.json'], app.root);
// and in `templates`: ['expediente', expediente]
```

A new foe also means its `FoeKind`, `Encounter` and AI: it must be playable from the fight tester
with a `FightMoment` per phase of a boss, and balanced with `just fight-sim` (`AGENTS.md`). A foe
whose arms and legs move on their own is new work in `battle-scene.ts`: propose it to the user
first, don't assume it. A foe's life bar hangs at a fixed 1.45 m (`battle-scene.ts`), so on a taller
one it crosses the body: give the new kind its height there, as the onions have.

## 5 · Check it where it lives

**The bestiary** (`just bestiario`) shows every being with its model, portrait, concept art, data and
whether its model is its own or a placeholder. Every figure made or redone here must appear there
right (memory: keep the bestiary updated): open it, and regenerate its screenshots.


A model that looks good alone can still be wrong in the game: this is how "vale super" became "son
demasiado realistas". Always look at it there, with `just screenshots <scenario> --gpu`, adding a
scenario or a step (`scripts/screenshots/gerard-aitor.json` is the example):

- At the street camera's distance: is it recognised, does it belong next to the others?
- Close up, with the game's camera, which looks down: is the face still readable from above?
- Walking and in a fight, with its neighbours and the fight's light.
- A person: every expression (`just screenshots expresiones --gpu`) and, if they wear ánimas, the
  dyed clothes and an ánima's pieces on the head and neck.
- A creature: in a fight, with a blow on it, its flash and its fall.

Each gallery goes into herdr's sidebar as it is made, as `AGENTS.md` says, never opened in the
browser. Tests hold the files to what the game needs (`tests/character-files.test.mjs`). Run
`just check`. Commit only if the user asks: the GLBs are tracked, about 1 MB each.

## Learn from each use

Keep this skill true. When the user corrects a figure's look, ask whether it was about that figure or
about all of them; if it was all of them, change the prompts in `tools/character_3d.py` and say so here.
