# Sincopante

Status: designing (first proposal, 2026-11-14: nothing here is decided unless it says so) · Comes
from: Marta's mission, [`docs/quests/marta.md`](../../quests/marta.md)

## Identity

- **Sincopante** (name decided 2026-11-14): Marta's ánima. Whoever wears it does not strike on
  the beat: they leave an **eco** on the field that keeps playing behind the fight, at its own
  rhythm, while everybody else does something else.
- Where it comes from: Las cuerdas. The party met an Eco there as a foe (beside La Lealtad, its
  blow growing each turn) and learned to time blows to La Voz's notes. The ánima hands them both.
- Unlocked: when Marta's ánima leaves her, at the end of the mission. Shared: Gerard or Aitor
  equips it in an extra slot.
- Motto (proposal): *"Entra donde nadie cuenta."*
- Colour: grey in the first round → _open_ (candidate: a cold string green, `#7fe3b0`; not
  silver, which reads as the grey of the first round; never pink or violet).

## Role

A **second voice**: the only ánima whose work goes on while its wearer does something else, and
the only one the rest of the party can play *into*. Good at steady pressure and at stretching
what the others bring (a fire kept alive, a wound kept open, a cure that keeps coming). Bad at
burst: it has no big blow of its own until level 7, and an eco nobody feeds is gone.

It changes how a fight is played because it adds a third thing to spend a turn on: not the foe,
not an ally, the eco.

## Stats

Proposal: Magia +2, Espíritu +2, Defensa +1, Fuerza −1. The eco hits with its wearer's stats.
Marta's light (`ANIMAS`, the party bonus): _open_ (proposal: Espíritu +1).

## Signature: the eco

One rule: **the eco repeats the last thing it heard.**

- **What it is**: a figure of sound on the party's side, a still echo of whoever called it. It
  cannot be hurt and no foe aims at it. Allies can aim at it (it is in the target list of every
  blow and every cure, with no word about why).
- **Its own rhythm**: it runs on the fight's clock (`docs/combat.md` § Estados en tiempo real),
  not on turns. It acts on **a beat every 5 s** and lives **20 s** (four beats, about two
  rounds). Its plate carries one continuous status icon, like a fire's clock: the ring empties,
  a notch for each beat still to come.
- **Looking after it**: anything an ally aims at it starts its 20 s over. Nothing aimed at it in
  20 s and it fades. Atacar is free, so keeping it costs a turn, never maná.
- **Hidden: it becomes what it is fed** (a surprise, as the duals are: nothing says so). What is
  aimed at it does no damage and cures nobody: the eco takes it and from then on repeats it, by
  the kind of the action, never by who wears what:

  | Fed with | The eco's beat |
  | --- | --- |
  | A physical blow | Light physical damage to a foe (*Eco de guerra*) |
  | A magic blow | Light magic damage to a foe |
  | A blow with an element or a clock status (fire) | The same, and it starts that status's clock over on its target; it never raises its level |
  | A blow that adds Sangrado | Light physical damage, and one stack |
  | A cure | A light cure to the ally with the least PV (*Eco curativo*) |

- **Whom it hits**: the foe its wearer last hit; if none, any standing.
- One eco at a time until level 5. Calling another replaces it.
- If the wearer falls or takes Sincopante off, the eco fades.

Needs, none of which exists yet: a field entity that allies can target and that acts on the
clock; the feeding rule; the plate icon. The timing window exists for La Voz (`src/song.ts`).

**Name clash to settle**: *eco* is already the party's currency (Ecos de luz) and a foe in Las
cuerdas (the Eco beside La Lealtad). The foe is a feature (the ánima is that thing, on your
side). The currency may confuse on the status screen. Alternatives if it does: *réplica*,
*contracanto*.

## Skills per level

Seven levels (the shared proposal is in [`../README.md`](../README.md) § Levels). Numbers are
first guesses, to tune with `just fight-sim` once the eco exists there.

| Level | What it gives | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| 1 | **Eco de guerra** | 2 | 8 physical a beat | *Abstract*: `Deja un eco que golpea a un enemigo cada 5 segundos durante 20 segundos: daño leve físico.` |
| 1 | **Eco curativo** | 2 | 6 heal a beat | *Abstract*: `Deja un eco que cura al aliado más herido cada 5 segundos durante 20 segundos: cura leve.` |
| 2 | **Redoble** | 1 | two beats now | *Abstract*: `El eco da dos golpes seguidos ahora mismo y su reloj vuelve a empezar.` |
| 3 | Passive · **A contratiempo** | — | — | A blow of the wearer that lands as the eco beats is repeated by the eco whole, not as a light one |
| 4 | **Maná +1** | — | — | Its pool goes from 3 to 4 |
| 5 | **Canon** | 2 | a second eco | *Abstract*: `Deja un segundo eco, que entra medio compás después. Cada uno repite lo suyo.` |
| 6 | Passive · **Coda** | — | — | An eco that fades (nobody fed it, or it was replaced) gives one last beat on every foe, or every ally if it cures, twice as strong |
| 7 | **Tutti** | 3 | — | *Abstract*: `Durante esta ronda, el eco repite entera cada acción del equipo.` |

- **Cost of the eco: 2, not 3** (Aitor proposed 3). At 3 it empties the pool: the wearer cannot
  call it and play Redoble (half of the dual) without two rounds of Defender in between. At 2 a
  maná is left for Redoble the round after. To revisit with the sim.
- **Eco de guerra / Eco curativo** are the same eco, already tuned. They show the player that it
  comes in kinds; that it can be retuned on the field is what they find out.
- **Redoble**: burst and upkeep in one, for a maná. Needs an eco standing.
- **A contratiempo**: the timing the mission taught, now the player's. The beat is read on the
  eco's ring; the blow has to land in a short window round it (as with La Voz's notes, never
  frame-perfect).
- **Canon**: two ecos, two clocks to keep: war and cure at once, or fire and wound. More upkeep
  is the price.
- **Coda**: letting it die becomes a choice as well.
- **Tutti**: the strong skill of level 7. Costs the whole base pool, so it is prepared.
- **Definitiva** (bought at the jar, [`../README.md`](../README.md) § Definitivas): proposal,
  *Da capo*, unlocked in a fight once the eco has stayed alive 60 s.

Against Atacar (18): an eco left alone gives 4 beats, about 32 for 2 maná (Zarpazos: 28 for 2,
at once). Fed with a free Atacar it gives about 32 more for a turn that would have dealt 18, less
whatever was left on its clock: better than Atacar only if it is fed late. That is the tension to
keep when tuning.

## Combined skills

| With | Dual | Halves | Levels | What it does |
| --- | --- | --- | --- | --- |
| Tecnópata | **Bombardeo orbital** | Redoble + Explosión | 2 · 2 | The eco goes into Bip and takes it up out of sight. As the next round starts, before anyone chooses, three volleys of blue and white light fall on the foes' side, one a beat. `Daño leve mágico a todos los enemigos. Golpea tres veces. Se carga un turno y sale al empezar el siguiente. Los ciega durante 20 segundos.` |

- Three volleys of 14 (42 in all; Rayo solar is 40 and Quemado II). Cegado at level II: the foes'
  blows land at 50 %.
- It charges like Rayo solar (`DualSpec.charge`). It does **not** cost Aitor his next turn, as
  Explosión alone does: Bip comes back down. The eco is spent: it has to be called again.
- **Why 20 s**: see [`../README.md`](../README.md) § Shared mechanics, *How long a clock status
  lasts*. It lands before anyone chooses, so the whole of the party's choosing runs before the
  foes act; 10 s would be gone by then.
- Ideas for later, not designed: with Matemágico (the eco fed with Foc Binari already keeps a
  fire alive: a dual may not be needed); with Papagato (*Maullido*, the eco carries Yuki's purr).

## Look and interface

_Open_ (round 7). Directions: the wearer in dark petrol with silver strings; the eco as their
own outline in light, a half-beat late. Interface: staves and strings, thin silver on petrol.

## In the world

_Open_.

## Second round

_Open_.

## Implementation

Nothing built. Order once the design is agreed:

1. The seven-level table and what a level can give (maná, a passive), `src/levels.ts`.
2. The eco as a field entity on the clock, fed and targeted, with tests; in `just fight-sim`.
3. `sincopante` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS`, `SKILLS`, `CLASSES`; the fight tester.
4. Bombardeo orbital in `DUALS`, Bip's choreography.
5. Look, interface theme, screenshots scenario, `docs/party.md`.

## Open

- The eco's name against Ecos de luz.
- Whether a foe's blow on everyone also silences the eco (a counter the bosses could use).
- Colour, look, motto, in the world, the second round.
- Whether boosts and debuffs can be fed to it.
