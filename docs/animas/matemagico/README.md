# Matemágico

Status: playable · Comes from: chapter 1's palace (`docs/bubbaloo-palace.md` § The fight and
Matemágico)

## Identity

- Gerard's everyday self: he calculates everything, even what doesn't need it. In the palace,
  when a minion is about to finish Bernat, Bernat begs him on his knees to think (*"Pensa, Gerard!
  Fes la màgia amb la teva ment!"*); Gerard thinks of ones and zeros and fire comes out of his
  hand. Bernat names it afterwards: *"Matemágico. Así te voy a llamar. El que hace magia con la
  cabeza."*
- The same name at every age: no Catalan alias for the boy.
- Motto: *"Lo calcula todo. Hasta lo que no hace falta."*
- Colour: gold `#f3cf78`.
- Look (in fights, decided 2026-11-05): dressed like his interface, blueprint blue ruled in gold (the
  shirt `#2f4a78`, its stripes or collar gold, dark trousers), and a ring of ones and zeros of gold
  light circling him at the waist, turning to whoever looks (`src/anima-looks.ts`). Grown-up Gerard
  also shows his thoughts. In the street everyone keeps their own clothes.
- Interface: a blueprint (below).

## Growth (decided 2026-11-14)

Matemágico **does not level** and cannot be taken off: it grows by a skill tree opened at home,
paid with ecos de luz, and it is about **the elements**, not fire alone (`../README.md` § Two ways
to grow). The level table below is what is built today and moves to the tree.

## Stats

Magia +1, Espíritu +1.

## Signature: binary fire

Fire that comes from a calculation, and a calculation is a one or a zero.

- **Foc Binari** sets the foe on fire (**Quemado**, `../README.md` § Shared mechanics), a timed
  status: cast again before it goes out and the fire rises a level (*"¡El fuego sube: Quemado
  II!"*). Until 2026-11-01 it tossed a digit (a 1 burnt, a 0 did not); the chance went with the
  levels, so the fire can be kept up on purpose.
- **Fire melts the pringue**, the gum shell of the Queen's palace minion, which swallows every
  other hit. That is why it wakes right there.
- Its fire keeps burning Vertitrón's eye or body while the party does something else (`docs/quests/nuria.md` § Final boss).

## Skills

Foc Binari is his from the start; every other skill is a node of his tree, bought at the jar
(`../README.md` § The jar, built 2026-11-15). He does not level.

| Line | Skill | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| Root | Foc Binari | 1 | 16 magic, fire, two streams | `Daño mágico de fuego leve a un enemigo. Golpea dos veces. Lo quema durante unos segundos. Si ya arde, el fuego sube de nivel. Derrite el pringue.` |
| Fuego | Pirámide ígnea | 2 | 24 magic, fire, all | `Daño mágico de fuego medio a todos los enemigos. El fuego de todos sube al más alto.` |
| Agua | Cubo acuático | 2 | 16 magic, water, all | `Daño mágico de agua leve a todos los enemigos. Los moja.` |
| Eléctrico | Punto eléctrico | 2 | 26 magic, electric | `Daño mágico eléctrico medio a un enemigo. Salta a todos los mojados.` |
| Eléctrico | Cortocircuito | 2 | 14 magic, electric | `Daño mágico eléctrico leve a un enemigo. Si está mojado o prepara un movimiento anunciado, pierde su siguiente turno. No se repite hasta que vuelva a actuar.` |
| Eléctrico | ∂Q/∂t Condensador | 1 | ×2 on the next electric blow; 20 magic, electric, to a foe that strikes first | `Carga a quien la usa hasta su siguiente golpe eléctrico, que hace el doble de daño. Si un enemigo le golpea antes, la carga salta a ese enemigo.` |
| Cálculo | Ángulo exacto | 1 | −3 Defensa and Espíritu, one foe, 3 rounds | `Baja Defensa y Espíritu de un enemigo durante 3 rondas.` |
| Cálculo | Análisis Parálisis | 2 | +3 Fuerza and Magia, party, 3 rounds | `Sube Fuerza y Magia de todo el equipo durante 3 rondas.` |
| Cálculo | Cardioide | 2 | 30 heal | `Cura media a un aliado herido.` |

- **Pirámide ígnea** (named *Factor común* until 2026-11-21): every fire on the field goes up to
  the highest one's level (it lights none where there is none).
- **Cubo acuático** (*Vasos comunicantes* until 2026-11-21): all Mojado.
- **Punto eléctrico** (*Descarga* until 2026-11-21): on a wet foe it runs to every wet one
  (Conducción).
- Their ids stay the old ones (`factor-comun`, `vasos`, `descarga`), so saves and trees keep them.
- Passives, one at the end of each element line: Rescoldo, Capilaridad, Toma de tierra
  (`../README.md` § The jar).
- Each is a figure drawn in his circle (§ How each skill looks).

Cost is in maná (`docs/combat.md` § Maná, `docs/action-points.md`).

**Ángulo exacto** (2026-11-05): Gerard works out the angle a foe is open at. A mark on that foe
(`kind: 'debuff'`, `Combatant.marks`) for 3 rounds, this one included, shown with its other stat
changes (*▼ DEF ESP*, `statShifts`). Damage is flat, so −3 Defensa and Espíritu add 3 to **every**
hit on it, from anyone: +12 on Zarpazos, +24 on Zarpazos de fuego. The set-up for many-claw play,
and half of *Punto débil*. A foe that already carries the mark cannot take it again until it fades.

**Earlier skills**, removed when Matemágico moved to the palace (2026-11-01), back at levels 2 and
3 (2026-11-05) with new numbers, nodes of the Cálculo line since 2026-11-15; as they were:

- *Análisis Parálisis*: `Sube Fuerza y Magia de todo el equipo durante 3 rondas.` (+3, a party
  boost; it used to cost 10 Secundaria).
- *Cardioide*: `Cura media a un aliado herido.` (24 heal, light rising from a cardioid; cost 8).

## Grade III: what the castle opens (2026-11-20)

Aitor's direction (2026-11-20): **higher-grade magic that plays with the statuses**. His: a
**Vulcano** for 3 maná that leaves every foe at Quemado III, and at the end of the fire line
**Combustión**. Second round, the same day (Aitor): **Combustión is fire's fourth level**, *Fuego
IV* with its own icon and its own change (physical blows set it off); **water's top is the same
idea, freezing**; Punto de rocío and Diferencia de potencial are out. Shock (water and electricity)
was built already (`docs/combat.md` § Reacciones entre elementos). Numbers are first guesses.

They are the nodes the constellation gains after the castle's first boss (`../README.md` § Growth
opens with the castle, stage 2; the stages are not built, so today they show at once). Each line
keeps its job: **fire piles up, water sets up, electricity cashes in**; grade III is each one's top.

| Line | Node | Ecos | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| Fuego | Passive · **Combustión** | 2 | — | 24 magic, fire, all | `Pasiva. El fuego puede subir a un cuarto nivel, Combustión. Un golpe físico sobre un enemigo en Combustión lo hace estallar: daño mágico de fuego medio a todos los enemigos, y el fuego de los demás sube un nivel.` | Built |
| Fuego | Dúo mayor · **Vulcano**, with Sincopante's Ostinato | 2 | 1 + 2 | 28 magic, fire, all | `Daño mágico de fuego medio a todos los enemigos. Los quema. Durante 20 segundos, un volcán les sube el fuego un nivel cada 5 segundos.` | Built |
| Cálculo | **Integral impropia** | 2 | 3 | 26 heal, party, then Sanación | `Cura media a todo el equipo. Sigue curándolos poco a poco durante 15 segundos.` | Built |
| Cálculo | **Atractor extraño** (beside Integral, past Maná +1) | 2 | 2 | 16 magic, astral, one foe | `Daño mágico no elemental leve a un enemigo. Los estados con reloj de los demás enemigos pasan a él: si ya tiene uno, sus niveles se suman. Al juntarse, los elementos reaccionan.` | Built (§ Atractor extraño) |
| Agua | Passive · **Punto de congelación** | 2 | — | — | `Pasiva. El agua puede subir hasta un nivel III y, un nivel más, congela: el enemigo no actúa hasta que el hielo se rompe o se derrite.` | Designed |
| Eléctrico | **Resonancia** | 2 | 2 | 38 magic, electric | `Daño mágico eléctrico alto a un enemigo. Si está congelado, rompe el hielo de golpe.` | Designed (Aitor liked it, 2026-11-20); built with the freezing rule |

- **Vulcano, a dúo mayor** (Aitor 2026-11-20: Foc Binari with Marta's Ostinato, unlocked; `../README.md`
  § Dúos mayores): Gerard's binary fire goes into the ground behind the foes, Marta's eco beats on it
  three times and a **volcano of particles** rises there. For 20 s, every 5 s, it throws lava on each
  foe and raises its fire a level (with Combustión, to IV): Quemado I to III over the first three
  beats. A wet foe steams instead. Only with its node bought, besides both halves known. It replaces
  the skill built that morning. In the jar its node is a gold star between Matemágico's fire and
  Sincopante, there once Combustión is lit and Ostinato learned (`../README.md` § The jar as one sky).
- **Integral impropia** (Aitor's yes, 2026-11-20; renamed and given its cure on the clock by Aitor,
  2026-11-21): the first cure for everyone in either own ánima. Each one it cures also takes
  **Sanación**, Rayo de sanación's cure on the fight's clock (15 s; again while it lasts, a level up).
  Its numbers are a first guess: watch it with the balance.
- **Combustión, fire IV** (the rule: `../README.md` § Combustión): with the passive in the fight,
  fire landing on Quemado III climbs once more. At IV it pulses ×7 (14 on a boss every 2 s), burns
  white with its own icon on the plate (the flame inside a burst, breathing), and **any physical
  blow on it makes it burst**: 24 of fire on every foe and every other fire a level up; the one that
  burst goes back to III, so it can be fed and set off again. Gerard's own Atacar is a physical blow
  (§ Casting): Foc Binari to IV, then Atacar, is his loop alone; with Papagato, Dadista or Bip beside
  him, every claw, die and ram is a match.
- **Punto de congelación, water's top** (designed, waiting for the freezing rule): Mojado gets
  levels as fire does (water on a wet foe raises it, I → III; Vapor leaves Cegado at the water's
  level, as Humo does at the fire's), and **a fourth water freezes it**: *Congelado*, the shared
  rule Freática's *Bajo cero* already uses (`../README.md` § Congelado), with one mark of ice
  (20 s). Frozen it does not act and takes a quarter of every blow; four to seven blows break the
  ice for a big water blow. **The mirror of Combustión**: both tops are cashed by physical blows,
  fire spreads, ice breaks. Freática's water marks and Mojado's levels are to be one count
  (`../freatica/README.md` § Crecida, Open).

**Look, built** (`just screenshots grado-iii --gpu`): Vulcano's arcs of molten light leave his circle
for the floor under each foe; the floor cracks into a ring of magma and a column of fire bursts up
through each one with three rings climbing it. Fire IV burns white-hot (`effects.fire` level
`white`: taller, the heart nearly white, flaring often) with blue-white sparks spinning round them and
a heartbeat of heat every second (`status-fx` `combustion`). Its burst: the fire draws into the chest,
a white flash and a ball of fire, a ring of flame along the floor, embers arcing to every other foe,
whose fire flares as they land; *¡Combustión!* over it and *PASIVA · Combustión* over the wearer.

### Still proposed

- **Marea**: built 2026-11-21 as a dúo mayor with Freática's Recarga, with *Fulgurita* (Colorista's
  Puñado) and *Suceso seguro* (Dadista's Ases en dúo); `../README.md` § Dúos mayores.

## Cortocircuito and ∂Q/∂t Condensador (Aitor 2026-11-21, built)

Two nodes of the electric line past Toma de tierra (2 ecos each, `src/ecos.ts`). Asked for as
electricity that is not "hit everyone": the line cashes in, and these two decide **when**.

- **Cortocircuito** (2 maná, 14): the current stays in its foe and jumps nowhere (no Conducción). On a
  foe that is wet, or has a move announced, it is a sure Shock: they lose their next turn and what
  they announced waits. Not again on the same foe until it has acted (`Combatant.shorted`): it delays
  a move once and never locks anyone down. The water stays, for a Punto eléctrico after. It is the
  opposite of Punto eléctrico, which spreads through the water and shocks half the time.
- **∂Q/∂t Condensador** (1 maná; the name is the current, the charge's derivative in time): Gerard
  stores charge, *Cargado* on his plate (the capacitor's icon, ×2) and on him (small sparks and short
  arcs, `cargado` in `src/status-fx.ts`). His next electric blow (Atacar · Eléctrico, Punto eléctrico,
  Cortocircuito) lands twice as hard (`CONDENSADOR.scale`; Conducción's own damage is not doubled).
  A foe that strikes him first takes the charge instead: 20 of electric magic (`CONDENSADOR.jump`),
  lightning from him to it. One charge at a time.
- **Largest blow**: Punto eléctrico charged, about 52 at his stats today, plus Conducción apart.
- **The sim** (`just fight-sim run`, smart, Gerard Matemágico + Aitor Tecnópata 3, the elements and
  water bought): neutral against Vertitrón and the dogs; against El Campeón Cortocircuito is played
  about seven times a fight and takes the win from 96 % to 100 %, ending with more PV (25 % → 35 %)
  but in longer fights (14 → 21 rounds); against the camping's magos it delays the Bombona once. First
  guesses, for the balance.

**Look.** Cortocircuito: a resistor, a zigzag between two leads, drawn in his circle; it flies to the
foe, lies across its chest and snaps in two in a flash, each half turning away, sparks from the break
and arcs over the foe (many, and for a while, where it shorts). ∂Q/∂t Condensador: ∂Q over ∂t written
in his circle as Leibniz wrote it, two plates sliding in either side with arcs jumping between them,
and it all drawing into him. The charge let go (×2): the plates flash open over the target. Jumping
back: two strokes of lightning from him to the foe that struck. `just screenshots matemagico-electrico --gpu`.

## Atractor extraño (Aitor 2026-11-25, built)

Grade III of Cálculo, a branch past Maná +1 beside Integral impropia: **2 ecos** (Aitor: «baja algún eco»;
the proposal had 3) and **2 maná**. Its verb is *juntar*: the other lines and the partners leave statuses
on the foes, this puts them all on the one that matters. The proposal behind it: Serie de Fourier
counts them afterwards, one blow a status.

**Rules** (`gather` in `src/battle.ts`; `tests/atractor.test.mjs`):

1. A blow of the astral, 16, on its target.
2. Then every status on the clock **that moves** (`moves` in `TIMED`, a trait of the kind of status, never of
   the foe) leaves every other foe standing, **all at once**, and reaches the target one after another, in the
   plate's order: Quemado, Cegado, Mojado, Empolvado, Envenenado, Cristalizado, Encogido, Confusión and Bomba
   (Gas, when Electrólisis brings it). Since everything has left before anything arrives, the plate's order
   never changes what the others are left with: the fire an Estallido on arrival lights on them stays on them,
   the same on each.
   - **The same one already there adds up**: the levels to its top (fire III, IV with Combustión; the shards
     to `POWDER_RULES.shards`; poison III), keeping the longer clock. Three Quemado II make one Quemado IV
     with Combustión bought (III without it), and the others are left clean.
   - **Two bombs**: their charge adds up to `BOMBA.top`, with the clock of the one closer to going off.
   - A Mojado that comes to a foe with La crecida's water under it runs into that water: the water's own
     Mojado lasts as long as the water.
3. **What does not move**: La crecida's water and everything of it (Agua, Corriente, Hundido, Congelado, and the
   Mojado of water standing under a foe), the cures, Virus, the duals' own (Volcán, Marea, Fulgurita, Metralla,
   Idea fija, Seiche, Staccato) and the statuses counted in rounds (Sangrado, Mareo, Llorera).
4. **What meets reacts**, with no blow of its own, powder first as anywhere: water on a fire is Humo, fire on
   water Vapor, fire and powder Estallido (its blast on every foe, as always), water and powder Envenenado.
   The status that came is spent in it. A fire does not catch on an onion's wet layers: it stays where it was.
5. **No loop with Virus**: what came was not put on anyone, so it does not spread (nor what its reactions set
   off), and Virus itself stays where it is. What lands on an infected target afterwards spreads as ever.
6. With one foe, only the blow. Aimed at a boss's part, only the blow. Si el golpe no llega (anulado, reflejado,
   caparazón, canto), no se junta nada. If the blow fells its target, nothing comes; if a reaction on the way
   fells it, what had not reached it yet is lost with it (it has left the others all the same).

Toma de tierra counts its reactions. The question it answers: who keeps the statuses (the one that will stand
longest; the one an Explosión, a Reinicio or a Combustión is about to cash). The bot plays it by what the
statuses still have to give where they stand (`clockWorth` in `src/battle-sim.ts`): three small fires that
add up to a bigger one go on the foe that will stand longest. In the castle's third-floor rooms (castillo-3,
DUO and TECH) it never plays it: those foes carry little on the clock, and with or without it the rooms come
out the same (2026-11-25, 60 runs). Its pair of `TARGETS` is still to write (the balance pass), in a fight
whose foes carry statuses to gather (Colorista's powder, Pirámide ígnea's fires).

**Look** (`atractor` in `src/math-figures.ts`, contact 2.4 s, end 3.4 s; `just screenshots atractor-extrano --gpu`):
the pen of light leaves his circle for the foe and draws the **Lorenz butterfly** round it (σ 10, ρ 28, β 8/3,
1 200 points worked out once by RK4, `lorenzPoints`), a gold wire standing in the picture's plane, about
2.7 m tall, turning slowly. Gold motes are left along it as it is drawn, and every one follows the **Lorenz
field on the GPU** (the `lorenz` law, src/fight-particles.ts), so the lobes weave themselves. Meanwhile what the
other foes carry rises off them in its own look and flies to a lobe, where it pours in along the orbit:
embers, drops, powder grains, cyan-teal shards, grey smoke, sparks, poison green, a few thousand each,
with gold motes poured in among them so the field stays his. Each foe lets go of its looks as they rise off
it: its plate, its powder and its shards, its bomb (`atractorGiven` in `src/battle-motion.ts`).
Neighbours drift apart and the figure holds. Fire and water that meet in it give a puff of steam. Then
**the bifurcation**: the fight slows a breath, ρ falls from 28 to 0.5 in 1.05 s while the field's rest slides
into the chest, and the whole butterfly spirals into it, the wire shrinking with it and burning brighter, bright
gold motes laid along the closing spiral, to a flash of white and gold. Then the number, *Atractor* over the
target naming what it now carries, and each reaction's word (¡Humo!, ¡Vapor!, ¡Estallido!, ¡Envenenado!),
one above the other. What came shows on the target as it lands: its powder for the instant the fire or the
water meets it, its shards standing out of it. **Sound**: a low hum that trembles as the
attractor does and falls an octave as ρ does (`chaos-hum`), and one struck note (`struck`).

## How each skill looks (Aitor's notes on the sheet, 2026-11-21)

Every skill of his tree past Foc Binari is **a figure drawn in the middle of his circle**, which then
does what it is (`src/math-figures.ts`, wired in `drawFigure` in `src/battle-scene.ts`). Gerard
raises his hand, his circle opens (§ Casting) and, as it fades, the figure is drawn a little over and
before it, a stretch at a time, with a pen of light at its tip. Strokes and edges are tubes of neon
(white-hot in the middle, the figure's colour towards the edges); all the rest is GPU particles. Each
lands at its own moment (`FIGURES` in `src/battle-motion.ts`), and the fight's numbers come then.

| Skill | What is drawn | What it does | Lands |
| --- | --- | --- | --- |
| Cardioide | A small circle rolls round a fixed one of its size; a point on its rim traces the cardioid, cusp up, in green | The circles go; the curve comes apart from its cusp on into motes that flow in an arc to whoever it cures, and the cure rises up them | 1.5 s |
| Pirámide ígnea | A triangle in fire, stroke by stroke, embers off the pen | An apex rises out of its middle into a burning pyramid that turns; it flies over the foes growing and trailing flame, draws in for a breath and blows up: flash, a ball of flame, sparks off its edges, a ring of fire on the floor, a gout to each foe. Then each fire rises to the highest, with its digit | 1.64 s |
| Cubo acuático | A square in pale water light | Its back face slides out and the edges grow to it: a cube, turned to show its depth. It fills with water on its way to the middle of the foes (bubbles, the surface rocking with its speed; Freática's drops and bubbles), swells and bursts: water thrown all round that falls and splashes, a sheet on each foe | 1.96 s |
| Integral impropia | ∫ from 0 to ∞, upright, its limits small | It turns a quarter as it goes to lie between the party at chest height, ends towards them; green light jets from each end into whoever is that side, and Sanación stays on them | 1.55 s |
| Punto eléctrico | A point of charge in front of him: a white-hot bead in a yellow glow, crackling | It rises, slows at the top and falls on its foe as lightning: three strikes a breath apart along fresh jagged paths, each forking, arcs that run round the foe and down to the floor, sparks that bounce, a ring on the floor | 1.0 s |

`just screenshots matemagico-figuras --gpu` plays the five.

## Foc Binari: the look

Gerard raises his hand, his circle opens (§ Casting) and two streams of fire leave it for one foe, braided round each other
(one orange to red, one gold to orange, half a turn apart), and land a hair apart: a quick
**tac-tac** (decided 2026-11-05). The zero, gold, lands first in a spray of gold sparks and barely
holds the picture; the one leaves 0.085 s after it (`CAST_GAP`, `src/battle-motion.ts`) and lands
with the fire and a full hit-stop. Each has its flash, its sound and its number (`−8` *Foc Binari*,
then `−9`), and the fire it lights says so in orange above them (*¡Quemado!*, a status pop). The
damage is one hit's, shared between the two (`split: 2` in `SKILLS`), so the balance stays where
it was. Timing: the hand rises and the circle opens (0.38 s), the streams fly (0.42 s), the zero at 0.8 s,
the one at 0.885 s. The one catches on the foe and it starts to burn (the Quemado look: a flame climbing the body that grows with each level). The home lights flicker orange (`docs/home-lights.md`).

## Interface: a blueprint

`#hud[data-class="matemagico"]`, `.battle-dock[data-anima="matemagico"]`, the party card, the
status sheet and the class banner in `src/style.css`:

- Midnight-ink navy `#0f1a2c` graph paper with gold `#f3cf78` lines, seen only round the edges of
  the screen; the middle of the fight stays clear.
- Commands are index cards on squared paper with a gold margin line, numbered `x01`…`x05` in
  JetBrains Mono; the open command and the skill sheet turn navy with gold squares.
- Headings and skill names in Georgia italic; numbers and kickers monospaced.
- No watermark or background pattern behind the fight: the ánima dresses the interface only.
- The party card: squared navy, with a number line (a tick every step) instead of the wave.
- The status sheet in the same blueprint, with its own ∑.
- The unlock banner as a notebook page, with *1 + 1 = 10* above the name.

## Casting

Decided 2026-11-05 (`src/math-cast.ts`). Matemágico does not run up and hit: he stays where he is and
raises a hand. **One of the zeros circling him** (the nearest, `takeZero` in `src/anima-looks.ts`)
leaves the ring and flies to his fingertip, rounding and taking the spell's colour on the way, and
opens there into **his circle**, which takes its 36 evenly spaced ticks spinning fast and slowing like
a dial, with a finer ring inside it turning the other way, half facing the camera so it reads as a
circle. It is smaller on the boy of chapter 1, and a dark line runs under it so that it also shows on a
bright floor. As the spell leaves, a new zero comes out in the place of the one that left. Every spell of
his that throws something starts with it, and what it throws leaves its middle:

| Action | Colour | What leaves the circle |
| --- | --- | --- |
| **Atacar** (`∅`) | Gold | The ball, at 0,44 s; it lands 0,4 s later |
| Atacar · Agua | Blue | The ball, dripping beads, as the rim does |
| Atacar · Fuego | Orange | The ball, with embers and crackle |
| Atacar · Eléctrico | Yellow | The ball, with bolts from the rim to it and off it as it flies |
| **Ángulo exacto** | Gold | The ball; it leaves its mark as it lands |
| **Foc Binari** | Orange | The two streams, at 0,38 s, embers off the rim |
| **Cardioide** | Green | Its comet, at 0,38 s, to whoever it cures |

**The ball**: particles gather in the circle's middle as the rim's light runs in, and it leaves with a
flash and a ring thrown off the circle, faster all the way. Round it, very small, float **0, e, 1, π**,
always facing whoever looks; when it bursts they are thrown off and fade, and the sparks of its hit
take its colour. Análisis Parálisis throws nothing, so it has no circle, and the duals keep their own
drawing. It only changes the picture: Atacar is still a physical blow. Only the ball is particles
(GPU); the circle and the signs are quads of light. In the fx lab (`just dev-fx`), under *Atacar de
Matemágico*; `just screenshots atacar-lanzado --gpu --scale 2` for the clips.

## Elements for Atacar

Not there from the start: each one is bought with an eco de luz at the jar at home (`../README.md` §
Ecos de luz). With any bought, wearing Matemágico, Gerard's Atacar block splits in one segment per
element and one for none (`∅`), and the top face button (**X on a Switch pad**, X on the keyboard)
walks them, on the commands or while aiming Atacar; a click picks one. The choice stays until
changed, and sleeps while he wears another ánima.

Same damage, free, and it lights **no status of its own** (it does not burn or freeze): a little
burst of it where it lands, and it turns what the foe already carries, whoever put it there.
`docs/combat.md` § Reacciones entre elementos. Nothing in the menu says which one reacts with what.

## Duals

Built with Papagato (2026-11-05, `DUALS` in `src/battle.ts`; how they fire in `../README.md` §
Combined skills):

| Dual | Matemágico + Papagato | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Zarpazos de fuego** | **Foc Binari** + Zarpazos | 1 · 2 | 1 + 2 | `Daño físico de fuego leve a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.` |
| **Punto débil** | **Ángulo exacto** + Zarpazo sangriento | 2 · 1 | 1 + 1 | `Daño físico leve a un enemigo. El siguiente ataque que reciba hace el triple de daño.` |

Gerard draws the figure and Haru strikes it: eight claws round a circle of digits from `000` to
`111`, each one that lands on a foe without layers flipping a coin for fire; or a protractor and a
dotted line to the spot, one blow, and the mark that makes the next action on it land three times as
hard. Both are physical, so the blow uses Papagato's wearer's Fuerza; the fire melts the pringue
too. Details in `../papagato/README.md` § Duals. The burning shield (*Cortina de fuego*, Foc Binari +
Yuki se esconde) is an idea for later.

## Implementation

Built: `matemagico` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS`, `SKILLS` (`foc-binari`, with
`burn` and `melts`) and `TIMED.quemado` (`src/battle.ts`); the beat in `awaken` and
`playBeat` (`src/battle-ui.ts`), its lines in `BATTLE_LINES` and `LINES.afterMatemagico`
(`src/chapter-1.ts`); `CLASSES` (`src/classes.ts`); `effects.binaryFire` (`src/effects.ts`), the
cast timing `CAST_*` (`src/battle-motion.ts`) and the burning look `quemado`
(`src/status-fx.ts`); the interface in `src/style.css`. Unlocked by the `matemagico` story flag
(old saves with `noista` are mapped to it: `RENAMED_FLAGS` in `src/story.ts` and `server.py`).
Journal: *"Pensé en unos y ceros. Y de la mano me salió fuego."*

Screenshots: `just screenshots matemagico` (Foc Binari, Ánima, the interface) and `palace` (the
beat). The fx lab has a *Foc Binari* entry (`just dev-fx`).

The Cálculo line's skills (by level from 2026-11-05, nodes of the tree since 2026-11-15):
*Análisis Parálisis* (`analisis`, a party boost: Gerard works it out in a flash of gold and the stats-rising animation runs on everyone) and
*Cardioide* (`cardioide`, `kind: 'heal'`, `side: 'allies'`: a cardioid of green light drawn
on the floor under whoever it cures, `effects.cardioid`, then the cure rising up them; it never gets
the fallen back up). `just screenshots levels` shows both.

The line starts with *Ángulo exacto* (`angulo`, a foe `debuff`: its mark in `Combatant.marks`, read by
`current`, gone at the end of its last round in `nextRound`; the sound is `think`). Its look and the
duals' look come with the duals' cinematic (`docs/animas/README.md` § Combined skills).

## Open

- Whether Análisis Parálisis and Cardioide keep their look, or get their own (a chalkboard of sums for
  Análisis, the cardioid drawn by hand).
- Grade III (§ Grade III): the tree costs 35 ecos since 2026-11-25 (each dúo mayor 3, Combustión and
  Integral impropia 3, Atractor extraño 2; `src/ecos.ts`). They only show after Aurelià.
