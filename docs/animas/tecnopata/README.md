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
  glass, cut corners, scan lines,
  monospaced data, cyan on ink. It dresses Aitor's dock; the fight's backdrop is always Gerard's
  ánima's, with two players too. Commands are panels with cut corners numbered `01`…; the open one
  lights up cyan.

## Growth (decided 2026-11-14)

Tecnópata **does not level** and cannot be taken off: it grows by a skill tree opened at home,
paid with ecos de luz (`../README.md` § The jar, built 2026-11-15). The two rays are his from
the start; Explosión, Confusión and Rayo encogedor open the lines Bip, Mente and Taller, each
with a second node (Telemetría, Control remoto, Nanitos), and a Maná +1 stands apart.

## Stats

_Open_ (round 3 of `/anima`). Today none (`CLASS_STATS.tecnopata = {}`).

## Signature

_Open_. Directions given: Bip does the attacking; mind control; technology as both physical and
magical damage. What the skills share: much of it runs **on the fight's clock** (Sanación,
Confusión, Encogido) and Rayo de energía stretches whatever is running out on a foe.

## Skills

Built 2026-11-06; since 2026-11-15 the two rays are the root and the rest are nodes of the tree
(the first column). All are Bip's: Aitor points,
Bip fires (`BIP_SKILLS` in `src/battle-scene.ts`).

| From | Skill | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| Root | Rayo de energía | 2 | 18 magic | `Daño mágico no elemental leve a un enemigo. Sus estados con reloj duran 5 segundos más.` |
| Root | Rayo de sanación | 1 | 20 over 15 s | `Cura leve a un aliado herido. La cura llega poco a poco durante 15 segundos.` |
| Bip | Explosión | 2 | 32 magic, all | `Daño mágico de fuego medio a todos los enemigos. Los ciega durante 1 ronda. Pierdes tu siguiente turno.` |
| Mente | Confusión | 2 | — | *Abstract*: `Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.` |
| Taller | Rayo encogedor | 1 | Defensa −25 % | *Abstract*: `Encoge a un enemigo durante 15 segundos: su Defensa baja un 25 %.` |
| Mente | Control remoto | 2 | 34 physical, the foe's own | *Abstract*: `Bip toma el mando de un enemigo: golpea con fuerza a uno de los suyos y olvida lo que iba a hacer.` |

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
- **Control remoto** (2026-11-15): a white-cyan beam from Bip to the foe and a ring over its
  head; it turns at once on the strongest of its own standing (on itself if alone) and loses its
  announced move. Confusión lasts and is a plain blow; this is one hard blow, now.
- Passives (`../README.md` § The jar): **Telemetría** (Bip's Atacar gives 3 s more to every clock
  status on its target) and **Nanitos** (Rayo de sanación also takes a harmful clock status off
  whoever it cures). Each says so on a plate over Aitor when it does something.
- Confusión and Rayo encogedor are `abstract`: the fixed shape only knows rounds, and these last
  seconds.

## Grade III: what the castle opens (2026-11-20)

Aitor asked (2026-11-20), with Matemágico's grade III (`../matemagico/README.md` § Grade III),
for more skills and interactions here too. Tecnópata's ground is **the clock**: Rayo de energía
stretches what runs out, Telemetría feeds it. Second round, the same day (Aitor): the first
proposal, *Sobrecarga*, emptied the clocks at once; he wanted **the opposite, the clocks started
over**, and *Virus* as a passive through Confusión did not convince him (the idea yes, how it
applied no: it is now an active skill, § Virus atómico and Escudo de bits). Numbers are first guesses.

| Line | Node | Ecos | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| Bip | **Reinicio** | 2 | 3 | 14 magic, all | `Daño mágico no elemental leve a todos los enemigos. Sus estados con reloj vuelven a empezar.` | Built |

- **Reinicio**: Bip reboots every foe's clocks. Each status on the clock a foe carries (Quemado and
  Combustión, Mojado, Cegado, Confusión, Encogido, Envenenado, Cristalizado; never a cure) starts
  over from its whole time, at the level it has; one with more left than that keeps it (after Rayo
  de energía). Explosión's blinding, which ends with the round, is not a clock and stays as it is.
  Rayo de energía buys five seconds on one; Reinicio buys the whole time back on everyone, for his
  whole pool. With Vulcano and Combustión it keeps the field burning at its top; with Confusión it
  is thirty seconds more of a foe hitting its own.
- **Look, built** (`just screenshots grado-iii --gpu`): a wave of nanites leaves Bip along the
  floor; over each foe a dial of cyan turns backwards and closes while a scan climbs it from its
  feet to its head; *Reinicio* over each, with the statuses it started over, and the rings on the
  plates fill again.

### Virus atómico and Escudo de bits (Aitor 2026-11-20, built)

| Line | Skill | Ecos | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| Mente | **Virus atómico** | 2 | 2 | 14 magic | `Daño mágico no elemental leve a un enemigo. Durante 20 segundos, cada estado que reciba se contagia a los demás enemigos.` | Built |
| Taller | **Escudo de bits** | 2 | 2 | dome of 40 PV | `Protege a todo el equipo durante 2 rondas. Una cúpula de bits detiene los golpes hasta que se rompe. Lo que una cura no puede dar a un aliado bajo la cúpula, la repara.` | Built |
| Taller | **Redundancia** (passive) | 2 | — | cap ×3 | `Pasiva. Las curas pueden reparar la cúpula de bits hasta el triple de sus PV.` | Built |

- **Virus atómico** (Aitor: *se ve como un enjambre de Bips; los estados alterados que recibe se
  propagan a los enemigos*): a swarm of tiny Bips weaves from Bip into a foe and keeps buzzing round
  it (the timed status *Virus*, 20 s, `spread` in `src/battle.ts`). Every status that lands on it
  afterwards (a new one, a level up, one lit again; stacks of Sangrado too) lands on every other foe
  standing, at its level and with its time, carried by a stream of tiny Bips: *¡Contagio!* over each.
  What it carried before stays its own; the virus itself never spreads; Reinicio starts it over.
- **Escudo de bits** (Aitor: *usa las animaciones de escudo con partículas; los ataques se dirigen
  ahí y nos protegen un porcentaje mientras dure o se rompa*; 2026-11-21: *más como un escudo
  redondeado, una semiesfera, y que los ataques la golpeen a ella; que tenga una vida y lo pare entero,
  lo sobrante lo rompe y entra*): a dome of Bip's bits over the party, its rim on the floor round
  everyone standing (`effects.bitDome`, a GPU lattice of the `dome` shape, src/lattice.ts). It has
  **40 PV** of its own; **every blow on the party goes into it first and it stops it whole** out of
  those PV; the blow that empties them breaks it and what it could not stop gets through. Otherwise
  it lasts two rounds and melts back into nanites. Pulses go past it. A foe's blow it takes whole
  lands on its shell, where the way from the foe to whoever it aimed at meets it: the foe comes up to
  the dome, not through it, and the dome dents and sparks there, with nothing on the ally. On the
  party's plates, its icon (a dome of squares) with the PV it has left; each blow says *Cúpula −N*,
  the last *¡Cúpula rota!* (`BITS`, `bitsOf`). It answers the old question of Bip as a shield.
- **Patching it** (Aitor 2026-11-21, *idea 1*): a cure on someone under the dome gives them what they
  have room for and the rest goes into the dome, up to its PV (`changeHealth`): a whole ally under a
  dome with room is a target of any cure, so curing someone whole patches it (Rayo de sanación's
  pulses too). *Cúpula +N* over them, and light runs up the dome as its dents close. It asks a choice
  under a big blow on its way: heal the one who is hurt or keep the dome standing.
- **Redundancia** (Aitor 2026-11-21: *con una pasiva en el árbol permite sobrecurarlo por x3*): the
  Taller line's last node, after Escudo de bits (2 ecos). With it bought, a dome raised by the party
  can be patched up to three times its PV (120 for Escudo de bits, 60 for what Sobrecalentamiento
  leaves; `BITS.redundancia`, `cap`). No fight-sim target plays the shield yet.

**Duals of the shield** (Aitor: *otro dual que hace que el escudo explote al combinarlo con Foc
Binari, etc.*). *Cortafuegos* is taken (the Sobremesa's foes' shield), so the fire one is:

| Dual | Halves | Maná | Description | State |
| --- | --- | --- | --- | --- |
| **Sobrecalentamiento** | Foc Binari + Escudo de bits | 1 + 2 | `Daño mágico de fuego alto a todos los enemigos. Los quema con fuego de nivel II. Lo que queda del escudo protege a todo el equipo durante 2 rondas.` | Built |
| *Jaula de Faraday* | Descarga + Escudo de bits | 2 + 2 | `Protege a todo el equipo durante 2 rondas. Quien golpee el escudo recibe una descarga y puede quedar en shock.` | Idea |
| *Muro de agua* | Vasos comunicantes + Escudo de bits | 2 + 2 | `Protege a todo el equipo durante 2 rondas. Quien golpee el escudo queda mojado.` | Idea |

Sobrecalentamiento: Bip raises the dome, Gerard's binary fire runs into it, it glows and goes off over
the foes (36 of fire on each, Quemado II), and what is left (20 PV) closes again over the party.
The two ideas make the wall a trap of the element that meets it; with Shock and Mojado they feed
Matemágico's reactions. Not built: to choose.

## Combined skills

| With | Dual | Halves | What it does |
| --- | --- | --- | --- |
| Matemágico | **Rayo solar** | Rayo de energía + Foc Binari | Its turn Gerard's fire streams into Bip, which turns sun yellow; as the next round starts, before anyone chooses, Bip sweeps every foe with a sun-yellow ray: high magic damage and Quemado II on each. `Daño mágico de fuego alto a todos los enemigos. Se carga un turno y sale al empezar el siguiente. Los quema con fuego de nivel II.` |

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

- The tree (2026-11-15): `TECNOPATA` in `src/ecos.ts`, `control-remoto` in `SKILLS` and
  `BIP_SKILLS`, `PASSIVES`; `just screenshots arbol-combate --gpu`.

Next: the `/anima` rounds still open (motto, role, stats, signature, in the world). The numbers are first guesses: no `just fight-sim` target holds a party with Tecnópata yet.

## Open

- Motto, unlock moment, stats, signature mechanic.
- Whether Bip also shows in the street (today only in fights, like the ánimas' looks).
- Bip's sounds (its bip, the dash, coming out and going in).
- Whether Defender puts Bip in front of him as a shield.
