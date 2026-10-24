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
- Look and interface: _open_ (cat ears? a fur collar? paw prints in the interface?)

## The cats

- **The cats are not controlled.** They sit beside whoever wears Papagato, in the street and in
  fights, and every Papagato skill is something they do: **every skill, and everything it learns
  as it levels, is about Haru and Yuki** (decided).
- **Haru** (tricolour, female) is the **bold** one: she attacks.
- **Yuki** (white, female) is the **fearful** one: she hides, warns, protects.

## Stats

Provisional (decided, to tune): Velocidad +2, Fuerza +1, Espíritu −1 (quick and scrappy). Colour
in the second round: warm orange `#f0954a`. Nuria's light (`ANIMAS`)
gives its own party bonus, separate.

## Signature: Sangrado

Haru's claws add **Sangrado** stacks (`../README.md` § Shared mechanics), and Papagato's big
skills cash them in.

## Skills per level

Proposal; names, levels and numbers open. Levels from fights won wearing it and story events.

| Level | Skill | Cat | Description |
| --- | --- | --- | --- |
| 1 | Zarpazo de Haru | Haru | `Daño leve físico a un enemigo. Añade sangrado.` |
| 1 | Yuki se esconde | Yuki | `Sube Defensa de todo el equipo durante 2 rondas.` |
| 2 | Zarpa en la llaga | Haru | `Daño medio físico a un enemigo. Hace más daño cuanto más sangrado tenga.` |
| 3 | Las dos a la vez | Haru and Yuki | `Daño medio físico a todos los enemigos. Añade sangrado.` |

Ideas for later levels: Yuki's hiss that lowers a foe's Fuerza; *Siete vidas* (abstract, a
once-per-fight save); Haru bringing back something from the enemy.

## Combined skills

| With | Idea |
| --- | --- |
| Noísta | A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |
| Matemágico | Gerard calculates the angle, Haru lands it: a sure hit on the weakest spot |

## In the world

Proposal: the cats get through gaps a person can't (a cat flap, a fence, a wall top). In Nuria's
mission, the wearer resists El Vértigo's Mareo and Haru's claw shuts its spinning eye.

## Second round

Nuria's family, together and free, proposes a new plan (`docs/quests/nuria.md` § Second round);
saying yes gives Papagato its colour (_open_).

## Implementation

Built (level 1): `papagato` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS` and the skills *Zarpazo de
Haru* (cost 6, power 16, two Sangrado stacks) and *Yuki se esconde* (cost 8, Defensa +4 for the
party for 3 rounds; runs side by side with Análisis Parálisis) in `src/battle.ts`; `CLASSES` look
(orange shirt, cream stripes, a grey scarf) in `src/classes.ts`; the theme
`#hud[data-class="papagato"]` in `src/style.css` (cream paper, rounded cards, MIAU); Haru and Yuki
as procedural cats (`src/cats.ts`) beside the wearer in fights (`src/battle-scene.ts`): Haru
pounces on Zarpazo, Yuki hides on her skill. Unlocked by the `papagato` story flag. Screenshots:
`just screenshots papagato`. Levels 2 and 3 (`src/levels.ts`): *Zarpa en la llaga* (cost 10,
power 26 plus 4 per Sangrado stack, which it spends) and *Las dos a la vez* (cost 14, power 24 to
every foe, one Sangrado stack each).

Plan: _to write once the design converges_ (`../README.md` § How an ánima is built).

## Open

- Wearer stats, colour, look, motto, interface theme.
- How the cats look in 3D and where they sit in fights.
- Numbers for Sangrado and the skills (`just combat-sim`).
