# Papagato

Status: designing · Comes from: Nuria's mission, `docs/quests/nuria.md`

## Identity

- **Papagato** (cat dad): Gerard and the cats he shared with Nuria when they lived together,
  **Haru** and **Yuki**.
- Unlocked at the start of Nuria's mission, when she lends the cats; kept for good only when the
  mission is won (then the cats live in the Meridiana flat too).
- Motto: _open_
- Colour: grey in the first round → _open_ in the second (proposals: orange for Haru, a warm
  white for Yuki).
- Look (in fights, decided 2026-11-05): Haru's orange shirt with Yuki's white at the collar and
  sleeves, grey trousers, cat ears (one orange, one white, pink inside), a thin ringed tail that
  sways, and a white collar with a gold bell (`src/anima-looks.ts`). Interface: cream paper, rounded
  cards.
- Off Papagato in a fight, the cats go in a puff of smoke (and come back in one when someone wears
  it again); lent by Nuria in Uri's tower they cannot go home, so they step aside behind the party,
  on the side away from the others, and sit it out (`updateCats` in `src/battle-scene.ts`).

## The cats

- **The cats are not controlled.** They sit beside whoever wears Papagato, in the street and in
  fights, and every Papagato skill is something they do: **every skill, and everything it learns
  as it levels, is about Haru and Yuki** (decided).
- **Haru** (tricolour, female) is the **bold** one: she attacks.
- **Yuki** (white, female) is the **fearful** one: she hides, warns, protects.

### How they move

Both cats share one rig (`src/cats.ts`) and one gait (`src/cat-gait.ts`, pure, tested in
`tests/cat-gait.test.mjs`); callers only place a cat and say what it is doing.

- **Rig:** a body pivot (sits, crouches, tilts), four legs of two bones each ending in a paw,
  the head on its neck, ears that turn, eyelids, and a tail of four segments.
- **Legs by inverse kinematics:** each paw has a target on the ground and a two-bone solver finds
  the joints; a paw bearing weight stays still on the ground whatever the body does (breathing,
  bobbing, sitting), and the cat's measured speed sets stride and cycle so paws never slide.
  The hind legs are longer and stand in a Z, the forelegs nearly straight, as in a real cat.
- **Gaits by speed:** a walk in lateral sequence (left hind, left fore, right hind, right fore),
  a trot in diagonal pairs, and a gallop (hinds, then fores, shorter stances the faster it goes),
  with hysteresis between them. A swinging paw leaves and touches down at rest on the ground.
- **States:** standing, sitting (rear down, hind paws tucked, tail round the paws), crouched to
  pounce (the rear wiggles), afraid (pressed to the floor, ears flat, tail tucked), watching (ears
  pricked, the tail's tip twitching) and leaping (forelegs reaching, hind legs pushing back).
- **Alive when still:** breathing, blinks, an ear flick now and then, glances round, a tail that
  sways in a wave down to its tip.
- **Where:** following the party they trot or gallop and sit when left waiting; Haru guiding
  watches the party when they fall behind; at home they stroll at a walk and sit between strolls;
  as characters they sit; in fights Haru stands on guard and pounces (Zarpazo sangriento: her
  claws tear three white-coral lines across the foe, `effects.claw`), Yuki sits behind and slinks off
  to hide (Yuki se esconde).
- **In a fight of Nuria's mission:** while she lends them they are already walking with the party,
  so the fight uses those two (`battleScene.borrowCats`) instead of bringing a pair: they run in
  from where they were and walk on from where it leaves them. There are only those two, even if
  Gerard and Aitor both wear Papagato: they stand by the first wearer and answer either. If nobody
  wears it they sit it out beside whoever is still up. Outside the mission the ánima brings them
  itself, in a poof, beside each wearer.

Screenshots and clips: `just screenshots cats`, `just screenshots cats-fight`.

## Stats

Provisional (decided, to tune): Velocidad +2, Fuerza +1, Espíritu −1 (quick and scrappy).
**To redo**: Velocidad is removed as a stat (2026-10-31, `docs/combat.md`). Colour
in the second round: warm orange `#f0954a`. Nuria's light (`ANIMAS`)
gives its own party bonus, separate.

## Signature: Sangrado

Haru's claws add **Sangrado** stacks (`../README.md` § Shared mechanics): the next physical blow
spends them all, 20% harder for each, and *Zarpa en la llaga* twice that.

## Skills per level

Proposal; names, levels and numbers open. Levels from fights won wearing it and story events.

| Level | Skill | Cat | Cost | Base | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Zarpazo sangriento | Haru | 1 | 16 physical, Sangrado 2 | `Daño leve físico a un enemigo. Añade sangrado.` |
| 1 | Yuki se esconde | Yuki | 1 | +4 Defensa, party, 3 rounds | `Sube Defensa de todo el equipo durante 3 rondas.` |
| 2 | Zarpazos | Haru | 2 | 7 physical, four claws | `Daño leve físico a un enemigo. Golpea cuatro veces.` |
| 2 | Ronroneo de Yuki | Yuki | 2 | 14 heal, party; takes the mental statuses away | `Cura leve a todo el equipo. Quita los efectos de estado mentales.` |
| 3 | Zarpa en la llaga | Haru | 2 | 26 physical | `Daño medio físico a un enemigo. Gasta el sangrado: cada uno suma el doble de daño.` |
| 3 | Las dos a la vez | Haru and Yuki | 2 | 24 physical, every foe, Sangrado 1 | `Daño medio físico a todos los enemigos. Añade sangrado.` |

Cost is in maná (`docs/combat.md` § Maná).

**Zarpazos** is why Papagato has to grow in Nuria's mission: its little claws are what strips the big
onions' layers (`../../quests/nuria.md` § Monsters). Cost 2, power 7 a claw. Its description leaves the
layers out on purpose: four hits, one layer a hit, is for the player to work out.

**Ronroneo de Yuki** (2026-11-05): Yuki purrs and everyone calms down. A cure for everyone standing
(`healing(14)`: 14 from Aitor, 17 from Gerard on Papagato) that also takes away every **mental**
status (`cleanse: 'mental'`; today Mareo and Llorera, never Sangrado: `../README.md` § Shared
mechanics). It is the party's first sustain before Cardioide, and the tower's answer to Mirar
abajo and the onions' tears. It reaches whoever is hurt or carries a mental status.

Ideas for later levels: Yuki's hiss that lowers a foe's Fuerza; *Siete vidas* (abstract, a
once-per-fight save); Haru bringing back something from the enemy.

## Duals

Built with Matemágico (2026-11-05, `DUALS` in `src/battle.ts`; how they fire in `../README.md` §
Combined skills). Each wearer pays their own half from their own ánima's maná, both turns go into
it, and the blow uses the stats of whoever brings the physical half, so Papagato's wearer's Fuerza.

| Dual | Matemágico + Papagato | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Zarpazos de fuego** | Foc Binari + **Zarpazos** | 1 · 2 | 1 + 2 | `Daño leve físico de tipo fuego a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.` |
| **Punto débil** | Ángulo exacto + **Zarpazo sangriento** | 2 · 1 | 1 + 1 | `Daño leve físico a un enemigo. El siguiente ataque que reciba hace el triple de daño.` |

- **Zarpazos de fuego**: Gerard draws a circle of digits round the foe and Haru strikes it eight
  times (power 8 a claw), a layer off each. Each claw that lands on a foe with no layers left flips
  a coin (the fight's dice, `roll`): three times in four a 1, which lights its fire or raises it. The
  fight shows it as that claw lands, never before. Fire never catches on wet layers. A peeled onion, a
  hand of ladders, a boss's spin.
- **Punto débil**: Gerard works out the angle and Haru lands one clean blow (power 20) that leaves
  the mark *Punto débil* on the foe: the next action that hurts it (anyone's, any kind, every strike
  of it) lands three times as hard, and spends it. Unused, it fades at the end of the next round;
  Sangrado and Quemado neither use it nor spend it. It brings neither Ángulo's mark nor Zarpazo's
  Sangrado.
- **Ideas for later**: *Cortina de fuego* (Foc Binari + Yuki se esconde), a burning shield: the
  party's Defensa up, and whoever hits the party catches fire. Parked (2026-11-05), not built.
  Noísta + Papagato is on hold with Noísta (a "¡NO!" that makes Haru jump: breaks the pringue and
  cashes in Sangrado).

## In the world

Proposal: the cats get through gaps a person can't (a cat flap, a fence, a wall top). In Nuria's
mission, Ronroneo de Yuki heals both after Vertitrón's Barrido or Rayo (`docs/quests/nuria.md` §
Final boss).

## Second round

Nuria's family, together and free, proposes a new plan (`docs/quests/nuria.md` § Second round);
saying yes gives Papagato its colour (_open_).

## Implementation

Built (level 1): `papagato` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS` and the skills *Zarpazo
sangriento* (cost 1 Ánima, power 16, two Sangrado stacks; called *Zarpazo de Haru* until
2026-11-05) and *Yuki se esconde* (cost 1, Defensa +4
for the party for 3 rounds) in `src/battle.ts`; `CLASSES` look
(orange shirt, cream stripes) in `src/classes.ts` and its ears, tail and collar in `src/anima-looks.ts`; the theme
`#hud[data-class="papagato"]` in `src/style.css` (cream paper, rounded cards); Haru and Yuki
as procedural cats (`src/cats.ts`) beside the wearer in fights (`src/battle-scene.ts`): Haru
pounces on Zarpazo, Yuki hides on her skill. Unlocked by the `papagato` story flag. Screenshots:
`just screenshots papagato`, `just screenshots onions`. Level 2 (`src/levels.ts`): *Zarpazos* (cost 2,
four claws of power 7, a layer each). Level 3: *Zarpa en la llaga* (cost 2, power 26, +40% per
Sangrado stack, which it spends) and *Las dos a la vez* (cost 2, power 24 to every foe, one Sangrado
stack each). Also at level 2, *Ronroneo de Yuki* (cost 2, a 14 cure for everyone standing that takes
the mental statuses away, `cleanse: 'mental'`). The duals with Matemágico are in § Duals.

In Nuria's mission (`docs/quests/nuria.md`): lent when Nuria hands over the cats (an `anima`
effect, ÁNIMA DESBLOQUEADA) and worn by Gerard unless he already wears something; given back when
the party leaves Cardedeu, falls or the day ends; kept for good with the `papagato` flag when
Vertitrón falls. Aitor wears it only if it was put on him (his extra slot) before a fight: it never
changes person mid-fight. Kept, it gets the big banner: *ÁNIMA DESBLOQUEADA · Papagato* on a cream
cushion card, cat-orange, with a trail of paw prints walking up onto it; going, the cat walks on up
off the card's top edge, its prints fading behind it the oldest first, and the card fades away,
smaller and out of focus (`storyUI.kept`, `.anima-banner[data-anima="papagato"]`; `just screenshots
nuria-won` holds the way out still, step by step). While lent, Haru and Yuki follow the party (`src/follower.ts`); afterwards they
live in the Meridiana flat, strolling between the living room and the dining room
(`src/cat-wander.ts`, `story.catsAtHome`). Screenshots: `just screenshots nuria` and `lights`.

## Open

- Wearer stats, colour, look, motto, interface theme.
- How the cats look in 3D and where they sit in fights.
- Numbers for Sangrado and the skills (`just fight-sim`).
