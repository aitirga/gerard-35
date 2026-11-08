# Tecnópata

Status: designing (look, interface and Bip first) · Comes from: Aitor's own, his from chapter 2's
first morning (it replaces the placeholder *Físico*, `fisico` in old saves)

## Identity

- **Tecnópata**: Aitor with cutting-edge technology. He does not hit anyone himself: his little
  robot, **Bip**, does it for him. He also has powers of the mind (control, persuasion) that come
  from the same technology.
- Aitor's own ánima (`ANIMA_OWNERS`): fixed, only his, never taken off.
- Unlocked: _open_ (today he has it from chapter 2's first morning, as Físico had).
- Motto (proposal): *"Él no pega. Para eso está Bip."*
- Colour (decided 2026-11-05): electric cyan `#4fe0ff`. Not violet (possession and fear) nor pink
  (La Reina Bubbaloo): his mind powers are cyan, the colour of a screen, never the Queen's.
- Damage: physical and magical, both from technology (decided as a direction, skills to design).

## Bip

- **Bip** (decided 2026-11-05): a floating drone the size of a melon, by Aitor's head. A round white
  body under a graphite cap, a flat rectangular screen of black glass on its front with one eye (a
  pill of cyan light lying on its side) that blinks and glances, an antenna with a blinking tip, two
  little rotors on arms out of its sides, and under it a thruster with a halo of cyan light that
  breathes as it hovers. A small cyan light rides with it, so it lights Aitor's side (`src/bip.ts`).
  A first version had a dark band round a white ball and a round eye in the middle: it read as a
  Poké Ball, so it was redrawn.
- **It attacks instead of him.** With Tecnópata on, Atacar is Bip's: it pulls back, darts at the
  target, rams it and bobs back to his shoulder, while Aitor stays where he is with a hand up
  (`src/battle-scene.ts`, `updateBips`). Numbers unchanged: still Aitor's Atacar.
- **Into him and out of him** (decided 2026-11-05): putting Tecnópata on, Bip comes out of Aitor
  as a stream of cyan nanites that gathers by his shoulder and powers up; taking it off, or Aitor
  falling, it comes apart into nanites that stream back into his chest (`effects.nanites`, GPU
  particles only).
- Where it floats: beside him as the camera sees him (never in front of him), on the side away from
  the others, about head high; at rest it watches the foes half turned to the camera, so its face reads.

## Look and interface

- Look (in fights, proposal): his fleece turns graphite with a cyan zip, dark trousers; a thin
  HUD visor (a cyan film on a graphite frame: he wears no glasses of his own), with an earpiece and
  a short antenna on his right ear, and two thin cyan circuit lines down the front of his shirt
  (`src/anima-looks.ts`). In the street he keeps his own clothes.
- **Interface: a drone's HUD** (decided 2026-11-05). The fight seen through Bip's camera: dark
  glass, cut corners, scan lines, a reticle as the watermark (on the status screen),
  monospaced data, cyan on ink. It dresses Aitor's dock; the fight's backdrop is always Gerard's
  ánima's, with two players too. Commands are panels with cut corners numbered `01`…; the open one
  lights up cyan.

## Stats

_Open_ (round 3 of `/anima`). Today none (`CLASS_STATS.tecnopata = {}`).

## Signature

_Open_. Directions given: Bip does the attacking; mind control; technology as both physical and
magical damage. What the skills share: much of it runs **on the fight's clock** (Sanación,
Confusión, Encogido) and Rayo de energía stretches whatever is running out on a foe.

## Skills per level

Built 2026-11-06, all at level 1: Tecnópata does not grow yet (`LEVELLED` in `src/levels.ts`), so
each of them is there from the start until its levels are designed. All are Bip's: Aitor points,
Bip fires (`BIP_SKILLS` in `src/battle-scene.ts`).

| Level | Skill | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| 1 | Rayo de energía | 2 | 18 magic | `Daño leve mágico a un enemigo. Sus estados con reloj duran 5 segundos más.` |
| 1 | Rayo de sanación | 1 | 20 over 15 s | `Cura leve a un aliado herido. La cura llega poco a poco durante 15 segundos.` |
| 1 | Explosión | 2 | 32 magic, all | `Daño medio mágico de tipo fuego a todos los enemigos. Los ciega durante 1 ronda. Pierdes tu siguiente turno.` |
| 1 | Confusión | 2 | — | *Abstract*: `Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.` |
| 1 | Rayo encogedor | 1 | Defensa −25 % | *Abstract*: `Encoge a un enemigo durante 15 segundos: su Defensa baja un 25 %.` |

- **Rayo de energía**: a cyan ray. Quemado, Cegado, Confusión and Encogido on its target last 5 s
  more (`extend`); a cure never. Its target's clock shows it (+5 s, the ring refilling).
- **Rayo de sanación**: a green ray to an ally; *Sanación*, a timed status whose pulses give PV back
  (one every 3 s, 20 PV in all at level I), a level up if cast again while it lasts.
- **Explosión**: Bip dives into the foes and blows up (fire: it melts the pringue); every foe
  standing is *Cegado* until the round ends; Aitor sits the next round out while Bip puts itself
  back together, then it forms again out of his nanites on its own.
- **Confusión**: waves twisting from Bip to a foe's head; for 30 s its turn goes into a plain blow
  on one of its own (on itself if alone), and it forgets what it had announced.
- **Rayo encogedor**: a white ray; the foe shrinks to about two thirds and loses a quarter of its
  Defensa for 15 s, of whatever it has then (`TimedSpec.cut`; at least 1 point). Only physical blows
  feel it (Bip's ram): magic goes against Espíritu.
- Confusión and Rayo encogedor are `abstract`: the fixed shape only knows rounds, and these last
  seconds.

## Combined skills

| With | Dual | Halves | What it does |
| --- | --- | --- | --- |
| Matemágico | **Rayo solar** | Rayo de energía + Foc Binari | Its turn Gerard's fire streams into Bip, which turns sun yellow; as the next round starts, before anyone chooses, Bip sweeps every foe with a sun-yellow ray: high magic damage and Quemado II on each. `Daño alto mágico de tipo fuego a todos los enemigos. Se carga un turno y sale al empezar el siguiente. Los quema con fuego de nivel II.` |

## In the world

_Open_.

## Implementation

Built (2026-11-05):

- The rename: `fisico` → `tecnopata` in `ClassId`, `ANIMA_NAMES` (*Tecnópata*), `CLASS_STATS`,
  `ANIMA_OWNERS` (`src/battle.ts`), `CLASSES` (`src/classes.ts`), the story, tests and screenshot
  scenarios. EXP saved under `fisico` is read as Tecnópata's (`src/main.ts`).
- Bip: `src/bip.ts` (the model and its idle), `updateBips` in `src/battle-scene.ts` (where it
  floats, the strike, coming out and going in), `effects.nanites` and the `nanite` fight kind
  (`src/effects.ts`).
- The look: `CLASSES.tecnopata.look` and `tecnopata` in `src/anima-looks.ts`.
- The interface: `#hud[data-class="tecnopata"]`, `.battle-dock[data-anima="tecnopata"]` and the
  rest in `src/style.css`.
- Screenshots: `just screenshots tecnopata --gpu --scale 2` (Bip close up, the HUD, the target
  panel, Bip's ram, going into Aitor and coming out); `just screenshots animas-menu` shows
  Tecnópata on the status screen.

- The skills and Rayo solar (2026-11-06): `SKILLS` and `DUALS`, the timed statuses Sanación,
  Confusión and Encogido (`TIMED`), `Combatant.charge` and `Combatant.out` in `src/battle.ts`;
  Bip's choreography (`updateBips`, `bipBurst`, `chargeUp`) and Encogido's size in
  `src/battle-scene.ts`; Bip's sun yellow (`solar`) in `src/bip.ts`; the statuses' looks in
  `src/status-fx.ts`; their icons, pops and the plate's clock in `src/battle-ui.ts`.
  `just screenshots tecnopata-skills --gpu` plays each one.

Next: the `/anima` rounds still open (motto, role, stats, signature, levels for the skills, in the
world). The numbers are first guesses: no `just fight-sim` target holds a party with Tecnópata yet.

## Open

- Motto, unlock moment, stats, signature mechanic, at which level each skill comes once Tecnópata grows.
- Whether Bip also shows in the street (today only in fights, like the ánimas' looks).
- Bip's sounds (its bip, the dash, coming out and going in).
- Whether Defender puts Bip in front of him as a shield.
