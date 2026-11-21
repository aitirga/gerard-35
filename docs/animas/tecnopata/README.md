# Tecnópata

Status: designed whole (2026-11-21, `/anima`), waiting for Aitor's OK; built: Bip, the tree and
grade III; designed and not built: Temporizador, Escolta, the stats and Enjambre · Comes from:
Aitor's own, his from chapter 2's first morning (it replaces the placeholder *Físico*, `fisico` in
old saves)

What is **decided** says so and by whom. Everything else is a proposal with its numbers as first
guesses (`../README.md` § Order of work).

## The design (2026-11-21)

**Decided** (Aitor, 2026-11-21): the ánima hangs from **Temporizador**, a bomb on the clock that
Bip's blows load, plus a part of *Bip as a piece*: **Bip standing by an ally to protect them**.

### Identity

- Aitor does not fight: he points, and Bip does it. What Bip leaves on a foe counts down.
- Wearing it feels like running a machine against the clock: load, stretch, let it go.
- Motto (proposal): *«Él no pega. Para eso está Bip.»*

### Role

| | Tecnópata | Matemágico | Papagato | Freática | Sincopante |
| --- | --- | --- | --- | --- | --- |
| Hurts with | Magic of no element, late | Elements | Physical, críticos | Water | Repeated magic |
| Its resource on the foe | Temporizador (a clock with charges) | Elemental statuses | Sangrado | Water marks | Ecos (beside it) |
| Pays off as | The bomb going off, alone or all at once | Reactions | A wound spent | Golpe de ariete, Bajo cero | Tutti |

- Good at: damage that arrives later and big; protecting one ally; stretching or restarting what
  others leave on the clock.
- Bad at: damage now (a fresh Temporizador pays nothing for 12 s); a foe that dies before its bomb
  goes off wastes it.
- The decision it adds to every turn: **stretch the bomb to load more, or let it go before the
  foe's big move**; and whether Bip is in front of a friend or loading a bomb.

### Stats

Built: none (`CLASS_STATS.tecnopata = {}`). Proposal: **Magia +2, Espíritu +1, Defensa +2,
Fuerza −1** (sum +4). Magic for the rays and the bomb; Defensa because Bip stands in front;
Fuerza down since Aitor himself never hits (Bip's ram keeps his Atacar's numbers).

### Signature: Temporizador (a rule from the start, `ANIMA_RULES`)

1. **Bip marks.** A blow of Bip's (Atacar with Tecnópata worn, Rayo de energía) leaves a
   *Temporizador* on the foe: a clock of **12 s** with **1 charge**. Another blow of Bip's on it
   adds a charge (up to **5**) and **does not restart its clock**.
2. **The clock is the tool.** Rayo de energía and Telemetría give it seconds (more time to load);
   Reinicio gives it its whole time back, on every foe; Virus spreads its charges.
3. **It goes off.** When the clock ends it blows: **magic of no element, 8 per charge** at average
   stats (5 charges, 40: alto). Explosión blows every Temporizador on the field now, at the charge
   it has.

Rule sentence (`ANIMA_RULES.tecnopata`, proposal): *Temporizador*: `Los golpes de Bip ponen un
temporizador de 12 segundos y lo cargan, hasta 5 veces. Al acabarse estalla: más daño cuanta más
carga.`

How it shows: over the foe, a small cyan digital count (`12`…`0`) with a row of five pips, the
charges lit; in the last 3 s it beeps and the count goes white; it goes off as a cyan flash
with a ring of squares on the floor and the number over it, *Temporizador ×N*. On the plate its
icon (a clock with a fuse) with the charges.

**Bip in front: Escolta** (the piece of Bip that protects, decided). Bip leaves Aitor's side and
hovers by an ally for 2 rounds: each blow on that ally, the ally takes a third (as Defender) and
**the foe that dealt it gets a Temporizador charge**. Protecting loads the bomb. While Bip escorts,
Atacar still is Bip's: it darts from where it is.

### Skills (a tree at the jar: an own ánima does not level)

| From | Skill | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- |
| Rule | Temporizador | — | 8 × charge | `Los golpes de Bip ponen un temporizador de 12 segundos y lo cargan, hasta 5 veces. Al acabarse estalla: más daño cuanta más carga.` | Designed |
| Root | Rayo de energía | 2 → **1** | 18 → **16** magic | `Daño mágico no elemental leve a un enemigo. Carga su temporizador. Sus estados con reloj duran 5 segundos más.` | Built; the charge and the cost designed |
| Root | Rayo de sanación | 1 | 20 over 15 s | `Cura leve a un aliado herido. La cura llega poco a poco durante 15 segundos.` | Built |
| Bip | Explosión | 2 | 32 magic, all | `Daño mágico de fuego medio a todos los enemigos. Los ciega durante 1 ronda. Hace estallar sus temporizadores. Pierdes tu siguiente turno.` | Built; the detonation designed |
| Bip | Telemetría (passive) | — | +3 s | `Pasiva. El Atacar de Bip alarga 3 segundos los estados con reloj de su objetivo.` | Built (it now stretches the bomb too) |
| Bip · III | Reinicio | 3 | 14 magic, all | `Daño mágico no elemental leve a todos los enemigos. Sus estados con reloj vuelven a empezar.` | Built (restarts the Temporizador, keeps its charges) |
| Mente | Confusión | 2 | — | *Abstract*: `Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.` | Built |
| Mente | Control remoto | 2 | 34, the foe's own | *Abstract*: `Bip toma el mando de un enemigo: golpea con fuerza a uno de los suyos y olvida lo que iba a hacer.` | Built |
| Mente · III | Virus atómico | 2 | 14 magic | `Daño mágico no elemental leve a un enemigo. Durante 20 segundos, cada estado que reciba se contagia a los demás enemigos.` | Built (spreads charges) |
| Taller | **Escolta** | 1 | ⅓ of each blow | `Protege a un aliado durante 2 rondas. Quien le golpee carga su temporizador.` | Designed; replaces Rayo encogedor |
| Taller | Nanitos (passive) | — | — | `Pasiva. Rayo de sanación quita además un efecto de estado dañino a quien cura.` | Built |
| Taller · III | Escudo de bits | 2 | dome of 40 PV | `Protege a todo el equipo durante 2 rondas. Una cúpula de bits detiene los golpes hasta que se rompe. Lo que una cura no puede dar a un aliado bajo la cúpula, la repara.` | Built |
| Taller | Redundancia (passive) | — | ×3 | `Pasiva. Las curas pueden reparar la cúpula de bits hasta el triple de sus PV.` | Built |
| — | Maná +1 | — | — | — | Built |

- **What each is for.** Atacar and Rayo de energía load the bomb (the ray also stretches it, now
  for 1 maná so it is worth its turn). Telemetría lets Atacar load without the clock running out.
  Explosión cashes every bomb at once, early. Reinicio buys the whole clock back to load to 5.
  Virus turns one loaded bomb into one on every foe. Confusión and Control remoto **buy time**:
  they stop the foe's announced move while the bomb counts. Escolta and the dome keep Aitor's
  friends up, and Escolta loads bombs while doing it. Rayo de sanación and Nanitos keep him able.
- **Cut, proposed: Rayo encogedor.** A quarter of Defensa that only physical blows feel, for a
  physical ram that is no longer Tecnópata's way of hurting: it builds nothing and spends nothing.
  Escolta takes its place at the head of the Taller line (Taller becomes Bip as a protector: Escolta,
  Nanitos, Escudo de bits, Redundancia). Its dual *A escala* (with Freática's Recarga) would go
  with it or take another half, in the duals' step.
- Largest single blow the design allows: a Temporizador of 5 charges, 40 (alto), on every foe at
  once with Virus or Enjambre.

### Definitiva: Enjambre

| | |
| --- | --- |
| **Wakes in a fight when** | A Temporizador goes off with its 5 charges (seen on the field) |
| **Then** | Once in that fight, for the turn and no maná |
| **In the game** | *Abstract*: `Bip se deshace en un enjambre sobre los enemigos: a cada uno le pone un temporizador con la carga al máximo. Los estados con reloj del campo vuelven a empezar.` |

It changes the earlier proposal (*three different clock statuses at once*, high magic on all) so
that its condition is this ánima's own mechanic taken to its end.

### What a round looks like (one foe A, one B; a turn about every 4 s, first guess)

| Time | Does | On the foes |
| --- | --- | --- |
| 0 s | Aitor: Atacar (Bip rams A) | A: 18; Temporizador 12 s ×1 (+3 s with Telemetría: 15 s) |
| 4 s | Aitor: Rayo de energía on A | A: 16; ×2, 11 + 5 = 16 s left |
| 8 s | B announces a big blow on Gerard; Aitor: Escolta on Gerard | Bip goes to Gerard |
| 10 s | B hits Gerard | Gerard takes a third; B: Temporizador ×1 |
| 12 s | Aitor: Atacar on A | A: ×3, 12 s left |
| 16 s | Aitor: Atacar on A | A: ×4 |
| 20 s | Aitor: Atacar on A | A: ×5 |
| 22 s | B's Temporizador ends | B: 8 |
| 24 s | A's Temporizador ends | A: 40; Enjambre wakes |

### What it offers a dual

A clock to stretch or restart (Rayo de energía, Reinicio), a bomb to set off (Explosión), a foe
turned against its own (Confusión, Control remoto), and Bip standing in front (Escolta, the dome).
Built duals: § Combined skills below. New ones in the duals' step.

### Open (Aitor's)

1. **Cut Rayo encogedor** for Escolta? Recommendation: yes; *A escala* is looked at with the duals.
2. **Escudo de bits loading the bomb** (each blow the dome stops charges the Temporizador of who
   dealt it)? Recommendation: not now; Escolta already does it on one ally, the dome on all would
   load too fast. Check it with the balance.
3. **Bip away while it escorts**: does Atacar still come from Bip (proposal, simplest), or does
   Aitor lose Atacar while Bip is with someone else (a real cost)? Recommendation: keep Atacar.

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

## Skills as built (before the 2026-11-21 design)

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
  the last *¡Cúpula rota!* (`BITS`, `bitsOf`). As it loses PV it cracks (Aitor 2026-11-21): white
  fractures with gaps run across it, more and wider the less it has left (`cracks` on its lattice).
  It answers the old question of Bip as a shield.
- **Patching it** (Aitor 2026-11-21, *idea 1*): a cure on someone under the dome gives them what they
  have room for and the rest goes into the dome, up to its PV (`changeHealth`): a whole ally under a
  dome with room is a target of any cure, so curing someone whole patches it (Rayo de sanación's
  pulses too). *Cúpula +N* over them; every bit of the dome turns green and it breathes, swelling and
  settling, while its dents and cracks close (Aitor 2026-11-21). It asks a choice
  under a big blow on its way: heal the one who is hurt or keep the dome standing.
- **Redundancia** (Aitor 2026-11-21: *con una pasiva en el árbol permite sobrecurarlo por x3*): the
  Taller line's last node, after Escudo de bits (2 ecos). With it bought, a dome raised by the party
  can be patched up to three times its PV (120 for Escudo de bits; `BITS.redundancia`, `cap`). No fight-sim target plays the shield yet.

**Duals of the shield** (Aitor: *otro dual que hace que el escudo explote al combinarlo con Foc
Binari, etc.*). *Cortafuegos* is taken (the Sobremesa's foes' shield), so the fire one is:

| Dual | Halves | Maná | Description | State |
| --- | --- | --- | --- | --- |
| **Sobrecalentamiento** | Foc Binari + Escudo de bits | 1 + 2 | `Daño mágico de fuego alto a todos los enemigos. Los quema con fuego de nivel II.` | Built |
| *Jaula de Faraday* | Descarga + Escudo de bits | 2 + 2 | `Protege a todo el equipo durante 2 rondas. Quien golpee el escudo recibe una descarga y puede quedar en shock.` | Idea |
| *Muro de agua* | Vasos comunicantes + Escudo de bits | 2 + 2 | `Protege a todo el equipo durante 2 rondas. Quien golpee el escudo queda mojado.` | Idea |

Sobrecalentamiento (a plain dual, Aitor 2026-11-21): Bip raises the dome over the party, of fire this
time (`effects.fireDome`); Gerard's binary fire runs into it, it swells white-hot and bursts, and its
own bits fly at the foes, each at the one on its side (the GPU lattice's `throwAt`), and go off on
them: 36 of fire on each and Quemado II. Nothing of the dome is left.
The two ideas make the wall a trap of the element that meets it; with Shock and Mojado they feed
Matemágico's reactions. Not built: to choose.

## Combined skills

| With | Dual | Halves | What it does |
| --- | --- | --- | --- |
| Matemágico | **Rayo solar** | Rayo de energía + Foc Binari | Its turn Gerard's fire streams into Bip, which turns sun yellow; as the next round starts, before anyone chooses, Bip sweeps every foe with a sun-yellow ray: high magic damage and Quemado II on each. `Daño mágico de fuego alto a todos los enemigos. Se carga un turno y sale al empezar el siguiente. Los quema con fuego de nivel II.` |

**Built 2026-11-21** (`../README.md` § Combined skills and § Dúos mayores): the dúos mayores
*Metralla* (Explosión + Papagato's Zarpazo sangriento, node after Reinicio), *Idea fija* (Confusión +
Sincopante's Ostinato, after Virus atómico) and *Caleidoscopio* (Escudo de bits + Colorista's Telón,
after Redundancia), and the plain dual *Trampantojo* (Confusión + Colorista's Cortina). The tree
costs 25 ecos with them.

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

- The three questions of § The design, Open.
- Unlock moment.
- Whether Bip also shows in the street (today only in fights, like the ánimas' looks).
- Bip's sounds (its bip, the dash, coming out and going in).
- Whether Defender puts Bip in front of him as a shield.
