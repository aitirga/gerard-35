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

### The tree (`src/ecos.ts`)

Four lines from his core, each node bought with ecos at the jar (`../README.md` § The jar). Every node
is 1 eco but the grade III ones, which only show after Aurelià (`growthStage`): Combustión, Integral
impropia and the dúos mayores 3, Atractor extraño and Resonancia 2 (Aitor, 2026-11-25: «baja algún eco»).

| Line | Nodes, in the order they open (ecos) | Ecos |
| --- | --- | --- |
| Fuego | Fuego (1) → Pirámide ígnea (1) → Rescoldo (1) → Combustión (3) → dúo mayor Vulcano (3) | 9 |
| Agua | Agua (1) → Cubo acuático (1) → Capilaridad (1) → dúo mayor Marea (3); off Cubo acuático, Superficie mínima (1) | 7 |
| Eléctrico | Eléctrico (1) → Punto eléctrico (1) → Toma de tierra (1) → Cortocircuito (1) → ∂Q/∂t Condensador (1) → dúo mayor Fulgurita (3); off Condensador, Resonancia (2) | 10 |
| Cálculo | Ángulo exacto (1) → Análisis Parálisis (1) → Cardioide (1) → Maná +1 (1) → Integral impropia (3) → dúo mayor Suceso seguro (3); off Análisis, Serie de Fourier (1); off Maná +1, Atractor extraño (2) | 13 |
| **All** | 33 before 2026-11-25; Serie de Fourier, Superficie mínima and Atractor extraño add 4, Resonancia 2 (2026-11-26) | **39**, and 2 for the definitiva |

The four duals of 2026-11-25 (§ Duals) are not nodes: each is there once both of its halves are known.

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
| Agua | Superficie mínima | 1 | a guard on one ally to the round's end; water, no blow, on whoever strikes them | `Protege a un aliado hasta el final de la ronda. El enemigo que le golpee queda mojado.` |
| Eléctrico | Punto eléctrico | 2 | 26 magic, electric | `Daño mágico eléctrico medio a un enemigo. Salta a todos los mojados.` |
| Eléctrico | Cortocircuito | 2 | 14 magic, electric | `Daño mágico eléctrico leve a un enemigo. Si está mojado o prepara un movimiento anunciado, pierde su siguiente turno. No se repite hasta que vuelva a actuar.` |
| Eléctrico | ∂Q/∂t Condensador | 1 | ×2 on the next electric blow; 20 magic, electric, to a foe that strikes first | `Carga a quien la usa hasta su siguiente golpe eléctrico, que hace el doble de daño. Si un enemigo le golpea antes, la carga salta a ese enemigo.` |
| Eléctrico | Resonancia (grade III) | 2 | 38 magic, electric; breaks Bajo cero's ice at once | `Daño mágico eléctrico alto a un enemigo. Si está congelado, rompe el hielo de golpe.` |
| Cálculo | Ángulo exacto | 1 | −3 Defensa and Espíritu, one foe, 3 rounds | `Baja Defensa y Espíritu de un enemigo durante 3 rondas.` |
| Cálculo | Análisis Parálisis | 2 | +3 Fuerza and Magia, party, 3 rounds | `Sube Fuerza y Magia de todo el equipo durante 3 rondas.` |
| Cálculo | Cardioide | 2 | 30 heal | `Cura media a un aliado herido.` |
| Cálculo | Serie de Fourier | 2 | 10 magic, no element, 1 + up to 5 strikes | `Daño mágico no elemental leve a un enemigo. Golpea una vez más por cada efecto de estado distinto que tenga, hasta seis golpes en total.` |

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
| Cálculo | **Atractor extraño** (beside Integral, past Maná +1) | 2 | 2 | 16 magic, astral, one foe | `Daño mágico no elemental leve a un enemigo. Le pasan Quemado, Mojado, Cegado, Empolvado, Envenenado, Cristalizado, Encogido, Confusión, Gas y Bomba de los demás enemigos: si ya tiene uno, sus niveles se suman. Al juntarse, los elementos reaccionan.` | Built (§ Atractor extraño) |
| Agua | Passive · **Punto de congelación** | 2 | — | — | `Pasiva. El agua puede subir hasta un nivel III y, un nivel más, congela: el enemigo no actúa hasta que el hielo se rompe o se derrite.` | Designed |
| Eléctrico | **Resonancia** (past Condensador, beside Fulgurita) | 2 | 2 | 38 magic, electric | `Daño mágico eléctrico alto a un enemigo. Si está congelado, rompe el hielo de golpe.` | Built 2026-11-26 on Bajo cero's Congelado (§ Resonancia) |

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

## Resonancia (Aitor 2026-11-25, built 2026-11-26)

Grade III of Eléctrico, the line's top: **2 ecos** past ∂Q/∂t Condensador, beside the dúo mayor Fulgurita, and **2
maná**. Kirchhoff, the other candidate for the slot, is out (PLAN.md, Aitor 2026-11-25). Electricity cashes in; this is
the bolt that cashes in the ice.

**Rules** (`shatters` in `SKILLS`, `chill` in `src/battle.ts`; `tests/resonancia.test.mjs`):

1. A blow of 38, electric magic, on one foe: `alto`. It is a bolt like any other: on a wet foe it runs to every wet one
   (Conducción), on a burning one it cashes the fire, on a blinded one it jumps through the smoke; a Condensador charge
   doubles it.
2. **On a foe frozen in Bajo cero's ice** (Congelado, `../README.md` § Congelado) the bolt lands at a quarter, as every
   blow does there, and **the ice breaks at once**: every crack it still lacked (`CRECIDA.blows` less those it had), with
   the break's blow as if cracked through (`iceBreakPower` by the ice left, with the Magia of whoever froze it, water). The
   foe is free.
3. Every other bolt still does nothing to the ice (Punto eléctrico, Sondeo, Corriente alterna's beats); a flame still
   melts a mark. Resonancia is the one electric blow the ice answers to, by the skill's own trait (`shatters`), never by
   who wears it.

The question it asks is when: the ice is worth most fresh (90 at three marks, 40 near melted) and holds its foe still
while it lasts, so breaking it early is the biggest blow and a foe back on its feet sooner. Only the ice of Bajo cero
exists yet: Punto de congelación, water's own freezing (§ Grade III), would give it a second source.

**Look** (`resonancia` in `src/math-figures.ts`; `FIGURES.resonancia`, contact 1.24 s): a driven oscillator at its own
frequency, **x(t) = t·sin(ωt)**, drawn left to right in his circle in the bolt's yellow, inside its envelope ±t (two
dashed lines opening like a horn) over a faint axis. Drawn, it **rings**: it shivers up and down harder and faster, arcs
leaping off its crests, and flies at the foe still ringing. At contact a bolt goes from it into the chest, and round the
foe **a ring of light takes up the note**: a standing wave of six lobes, r = R(1 + ε·cos 6θ·cos ωt), whose ε grows until
it bursts into sparks, a flash and a ring on the floor (bigger and paler where it broke the ice; the break itself is Bajo
cero's cell, `src/freatica-fight.ts`). Sound: a charge rising as it is driven, the zap, a struck note ringing on.

**Fight-sim** (`resuena`: an ice it broke): the bot plays it on a fresh ice (`tests/resonancia.test.mjs`), valuing the
break as PV. It has **no pair of targets yet**, because the bot almost never holds the ice and Resonancia together:
docs/fight-sim.md § Resonancia gives the numbers.

## Serie de Fourier (Aitor 2026-11-25, built)

A branch of Cálculo off Análisis Parálisis, grade II (1 eco, `src/ecos.ts`; open from the start). The
verb it brings is **counting**: the other lines and the partner leave statuses, and Fourier is paid
for their variety.

- **Rule** (`fourier` in `SKILLS`, `src/battle.ts`): 2 maná, power 10, magic with no element (nothing
  reacts). It strikes once, and once more for each thing its target's plate shows as it is cast, up to
  `harmonics` more (5: six strikes at most). Tunable as `skill.fourier.power` and `skill.fourier.harmonics`.
- **What it counts is what the plate draws** (`plateMarks`, the same list `battle-ui` draws its icons
  from, so the rule and the picture cannot disagree; `plateCount` adds Ángulo exacto's mark, the ▼
  over the foe, and no other stat change). One icon, one strike: Agua and Mojado are one icon (the
  water's); Punto débil, Shock, Combustión and a Mecha encendida each count. The plate also carries
  icons that are not statuses, and they count as well: on a foe, Encarnado (a castle pupil's, for the
  whole fight: one free strike against every Encarnado), Canción and Enfado (La Voz), Reacción (El
  Átomo), Converge (El que no converge), a Cortina de polvo, Escudo de bits and Acecho where a foe
  carries them; on an ally (Fourier never aims there), Luz, Racha, Meteoro, Sutura, Compás, Siete
  vidas and a definitiva awake or asleep. The permanent Encarnado counting is the rule as approved
  ("un icono, un golpe"); if it turns out too generous, `plateCount` is where to leave it out. **The variety, not the depth**: Quemado III is one;
  Quemado, Mojado and Empolvado are three (the fire line pays for depth, this for variety).
- **Each strike is a blow of its own** (the `strikes` path): Cristalizado digs a level deeper with
  each, Envenenado lands each harder, Ángulo's −3 adds to each, the ice counts them as a flurry, and
  Punto débil triples every one of them (and is spent). What the strikes put on it does not add
  strikes: the count is taken as it is cast. A foe that falls partway takes no more.
- **The question it answers**: which kind of blow, on a foe carrying many things. In *La carrera*
  each new status is a Tropiezo of Aurelià's, and Fourier cashes in that variety; bosses full of
  statuses too. Order matters: Atractor extraño gathers first, Fourier counts after.
- **Balance** (2026-11-25): `aurelia-carrera-fourier` in `TARGETS` is `aurelia-con-emilie` (Nuria
  and Emilie behind, Gerard on Matemágico or Papagato, Aitor on Tecnópata or Freática, smart) with
  Fourier bought: the bleeding, the water and the fire fill Aurelià's plate, and the bot plays it
  about 0.5 times a fight, winning 80–86 % against 71–79 % without it (a help, not the answer). With
  the plain dúo at the first floor it is barely played (0.02 a fight: Aurelià's plate is thin there).
  `just fight-sim skills` (everything open): 40.7 PV a maná, under Pirámide ígnea (44.1) and
  Explosión (44.7), no warning, nothing that "domina"; Punto débil as a dual is unchanged (14.8 PV a
  maná). `optimize` over `skill.fourier.power` 6–16 and `skill.fourier.harmonics` 3–5 keeps 10 and 5.
  The pair's wins overlap (87 % against 82 %), so the target with it also holds its blows past the
  first (`armonico`, 1.2 a fight, at .6 at least) and the one without holds none.
  Its pair since 2026-11-26: `aurelia-carrera-sin-fourier`, the same party with Fourier bought and banned
  (82 % against 87 % with it, 0.65 casts a fight at 49 PV each; `skills`: 82 PV a use, 41 a maná).
  Punto débil both counting and tripling every strike is the rule as approved; on a dog loaded with
  five statuses and Punto débil one cast does about 300, but setting that up costs the party turns.

**Look** (`fourier` in `src/math-figures.ts`, the mathematics in `src/fourier.ts`). As it is cast, the
foe's real surface (`src/surface-samples.ts`) is laid flat on the camera's plane and its silhouette
traced, hollows and all (`silhouette`: the points in a 48-cell grid, its gaps closed, the boundary
followed cell edge by cell edge and taken at 64 points evenly along it), then put through a discrete
Fourier transform, once. The slowest circles, one a strike (|k| = 1, 2, 3, each both ways round, the
bigger first), become a chain of neon circles drawn big (about 1.8 m) in the air between him and the
foe, each turning at its harmonic off the rim of the one before, a spoke to where the next rides: the
dial in his gold, then each in the colour of the thing it counted (fire orange, water blue, crystal and
ice cyan-white, blood a deep orange-red, poison green, the charge yellow; anything else gold, never
pink or violet), each lit all round its rim, with a bead of light where the next one rides in that
one's colour. From the fight's high camera a dog's silhouette is a lumpy round, so its circles past
the dial are a few centimetres: their beads at the pen are what shows their colours. Every stroke sits on a soft dark tube, so it reads on white plaster and keeps its colour over
a magenta street. The chain's tip draws the series in gold over the whole silhouette, laid faintly
behind it, so how near the count got is seen: **it is not a portrait**. One circle draws a circle, two
an ellipse, four to six a blob that follows the silhouette's broad lines (back, belly, the head's
side) and none of its legs: six terms cannot draw a dog, and the faint silhouette behind is what says
whose it is. The curve leaves the air and settles over the foe at its own size, drawn over its body.
Then a strike every 0.09 s (`FOURIER_GAP`), the outermost circle first: it closes into a beam of its
colour round a gold core to the foe, the curve flares that colour all along it, the foe's skin throws
it off and its body flashes in it, a bloom. After the last the curve shrinks to a point and goes in
motes of gold. Lands at 1.6 s, ends at 2.3 s + 0.09 s a strike past the first (`figureEnd`). Each
frame only moves the circles and emitters, from points kept in arrays it reuses. **Sound**: additive
synthesis, one partial more each strike (`partial-1` … `partial-6`, `partialSound`): a sine that
becomes an almost square chord. No status of its own. `just screenshots serie-de-fourier --gpu`.

## Cortocircuito and ∂Q/∂t Condensador (Aitor 2026-11-21, built)

Two nodes of the electric line past Toma de tierra (1 eco each, `src/ecos.ts`). Asked for as
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
  lightning from him to it, a blow on everyone too (since 2026-11-25: `struckBy` counts its splash). One
  charge at a time.
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
   plate's order: Quemado, Cegado, Mojado, Empolvado, Envenenado, Cristalizado, Encogido, Confusión, Gas and
   Bomba. Since everything has left before anything arrives, the plate's order
   never changes what the others are left with: the fire an Estallido on arrival lights on them stays on them,
   the same on each.
   - **The same one already there adds up**: the levels to its top (fire III, IV with Combustión; the shards
     to `POWDER_RULES.shards`; poison III), keeping the longer clock. Three Quemado II make one Quemado IV
     with Combustión bought (III without it), and the others are left clean.
   - **Two bombs**: their charge adds up to `BOMBA.top`, with the clock of the one closer to going off.
   - A Mojado that comes to a foe with La crecida's water under it runs into that water: the water's own
     Mojado lasts as long as the water.
   - **Gas** (Electrólisis's split water) is the one dual's own status that moves: it is the water it was, and
     water moves. It adds up to `GAS.top` (III), so three foes' gas makes one big cloud for the next fire. A
     fire that comes to it is no blow and does not set it off; the next blow of fire does, as ever (and an
     Estallido on arrival is fire's reaction: that one does).
3. **What does not move**: La crecida's water and everything of it (Agua, Corriente, Hundido, Congelado, and the
   Mojado of water standing under a foe), the cures, Virus, the duals' own but Gas (Volcán, Marea, Fulgurita, Metralla,
   Idea fija, Seiche, Staccato; Corriente alterna's Alterna is no status of a foe's) and the statuses counted in rounds (Sangrado, Mareo, Llorera).
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
out the same (2026-11-25, 60 runs). Balance pass (2026-11-26): the bot takes it about 0.02 a fight wherever
a better blow is on the table (Pirámide ígnea, Cubo acuático on burning foes), at 1 maná or at power 26 alike,
since moving fire adds its levels and loses pulses (three at II are 9 a pulse, one at III is 6) unless
Combustión takes it to IV. Its pair, `trio-segundo-atractor` and `trio-segundo-sin-atractor` (alumnos-2a,
DUO, the second floor with only the fire line that feeds it: Pirámide ígnea, Rescoldo, Combustión), holds it
as it plays: the gather landing 0.03 to 0.05 a fight (`atrae`, held at .02 at least, so a broken gather fails it),
93 % in 4.6 rounds with it and 92 % in 4.6 without. Its numbers stay (2 maná, power 16): it is a player's piece the bot does not read, not the answer
of any fight yet (`just fight-sim skills`: 26 PV a use, 13 a maná, «cara»).

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
## Superficie mínima (Matemágico grows, 2026-11-25, built)

A node of the water line off Cubo acuático, beside Capilaridad (1 eco, grade II, `src/ecos.ts`): his first
guard, and the water line's second skill. Aitor approved it with the expansion (Fourier, Atractor extraño and
four duals); `docs/animas/README.md` § The jar.

- **Rules** (`superficie-minima` in `SKILLS`, `kind: 'guard'`, `film`; `filmTouch` in `src/battle.ts`). 1
  maná, on any ally standing, himself too, never on someone already protected (the guards' rule in
  `validTargets`). They take a third of each blow until the round ends, as with Defender or Corchete
  (`Combatant.film` is the round; it goes in `nextRound`). Each foe whose blow reaches them through it that
  round takes water, with no blow, by water's own rules: on powder, Envenenado (the powder's turn,
  `reaction: 'veneno'`); on a fire, Humo (the fire out, Cegado); on anything else, Mojado for 20 s, and its
  held water's clock starts over. Once an action however many it reaches; every foe that strikes them, not
  only the first, and a blow on everyone counts on whoever it only splashes (El Campeón's Rayo total). Only
  blows that take PV: the clock's pulses, the round's ticks, a foe's move that takes none (Vertitrón's Grito)
  and a blow that took nothing (a miss, a shield's) never touch it. The blow that brings them down still goes
  through it. On someone Cargado, the striker is wet before the charge jumps to it. In La Voz's fight a guard
  lasts until its fighter acts again, but the film still goes with its round (as Defender's words say). Her
  notes are her blows: one that reaches someone under the film leaves her wet, and one that finds a charge
  (Condensador's, or Arco voltaico's waiting) makes it jump to her, told as news of its own (`noteAnswered`).
- **It does not punish, it sets up** (unlike Escolta, Trampantojo and Caleidoscopio): the foe's own blow
  leaves the water that Cortocircuito (a turn lost for sure), Conducción and the duals cash in.
- **The question it answers**: a blow announced, with a name, on an ally (El Campeón's guantelete, the
  Queen's hands, La Lealtad, Directo). Read the chip, put the film on that ally, and whoever strikes comes
  out wet; next round Cortocircuito takes its turn, and an electric Atacar runs on the water (Conducción).
- **The sim** (`src/battle-sim.ts`): its guard is worth what any guard on one ally is (`guardWorth`, Defender's
  two thirds of the blows coming, shared with Escolta and Corchete). A copy never sees the foes' turn, so
  `filmWorth` plays it on a copy after the film. Each foe it leaves wet that was dry, if someone standing can turn
  the water: what the water adds to the best electric Atacar on it, the real rules on a copy (`wetGain`,
  Conducción), or at least `FILM_WORTH` (10, for Cortocircuito or a dual on Cubo acuático or Cortocircuito);
  nobody can, nothing. Poison and smoke count `FILM_WORTH` without that, the smoke less the fire it puts out.
  The `elementos` build buys it right after Cubo acuático; `mixto` does not (bought beside Capilaridad, smart
  plays it about twice a castle room and the third-year rooms and the Encarnados drop out of their targets:
  left for the balance pass). Its pair, `campeon-pelicula` and `campeon-pelicula-sin` (Gerard with Aitor
  Tecnópata at the start of the university's mission, the water line and the electric one to Cortocircuito):
  with it the film goes on about four times a fight, Conducción follows each, the Rayo total comes half as
  often (0.7 against 1.4) and they win with 46 % of their PV; without it, with 32 %.

**Look** (`src/film-fx.ts`, the lattice's `catenoid` shape and `film` look). His dial opens water blue. In
his circle, before his chest and towards the camera (clear of what hangs over his head), the pen draws two
coaxial gold rings, gold to the core, one over the other, and pulls them apart: a soap film forms
between them, a catenoid, r(z) = a·cosh(z/a), and while they part it stays the true minimal surface (its
waist narrowing as `catenoidHeight` says). The rings fly to the ally, one to the ankles and one at the head (under their plate),
and the film stretches into an hourglass sleeve (never a sphere: a bubble would be La Pompa's). Its colours
are thin-film interference, from its thickness: gold, cream, cyan and teal water blue (#2aa8d8), never magenta
or violet, draining down and swirling; its members are soft glows mostly laid over the fight, not added, so its
front and back crossing can never sum to lilac. A blow through it: capillary ripples where it lands, then it bursts like soap,
its bright rim running back from the hole, the water it sheds (plain water, not the film's colours) flying
at whoever struck with a jet of Freática's water drops that arcs over and splashes on them: their Mojado (or
Humo, or Envenenado). The rings stay, a little lit, with a faint water light between them until a new film
forms there, since the guard lasts the round; if the blow brought the ally down, it bursts all the same and
then goes. The round over with no blow: it starts thinning at once to black film from the top (0.9 s), its colours going out, and the last of it comes apart in a few motes, the rings dimming with
it. **Sound**: glass ringing high and wet as it is drawn (`film-shimmer`), a soft pop and a splash as it
bursts (`film-pop`, `splash`). **Icon**: a catenoid's profile, two gold ellipses joined by sides curving
in, water blue (*Película de jabón*, with its card in the guide). `just screenshots superficie-minima --gpu`.

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
| Superficie mínima | Two coaxial gold rings, one over the other, pulled apart with a soap film between them (a catenoid) | The rings fly to the ally, to the ankles and over the head, the film an hourglass sleeve in thin-film colours, held to the round's end (§ Superficie mínima) | 1.4 s |
| Punto eléctrico | A point of charge in front of him: a white-hot bead in a yellow glow, crackling | It rises, slows at the top and falls on its foe as lightning: three strikes a breath apart along fresh jagged paths, each forking, arcs that run round the foe and down to the floor, sparks that bounce, a ring on the floor | 1.0 s |
| Resonancia | t·sin(ωt) in yellow inside its dashed envelope ±t, a horn opening | It rings harder and faster and flies at the foe; a bolt into the chest, and a ring of six lobes standing round the foe swells until it bursts (§ Resonancia) | 1.24 s |

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

With Papagato since 2026-11-05, and since 2026-11-25 one with each ánima he had none with: Freática
(Electrólisis), Dadista (Campana de Gauss) and Sincopante (Corriente alterna), and a third with Papagato
(Arco voltaico). `DUALS` in `src/battle.ts`; how they fire, and the pair table, in `../README.md` §
Combined skills. As every dual, nothing in the fight points at them: two players pick the two halves,
and it happens.

| Dual | Matemágico + Papagato | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Zarpazos de fuego** | **Foc Binari** + Zarpazos | 1 · 2 | 1 + 2 | `Daño físico de fuego leve a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.` |
| **Punto débil** | **Ángulo exacto** + Zarpazo sangriento | 2 · 1 | 1 + 1 | `Daño físico leve a un enemigo. El siguiente ataque que reciba hace el triple de daño.` |
| **Arco voltaico** | **∂Q/∂t Condensador** + Acecho | node · 6 | 1 + 2 | `Daño físico eléctrico muy alto a un enemigo. Se carga un turno y sale al empezar el siguiente. Golpe crítico seguro. Si un enemigo golpea antes a quien espera, la carga salta a ese enemigo y el golpe sale a la mitad.` |

Gerard draws the figure and Haru strikes it: eight claws round a circle of digits from `000` to
`111`, each one that lands on a foe without layers flipping a coin for fire; or a protractor and a
dotted line to the spot, one blow, and the mark that makes the next action on it land three times as
hard. Both are physical, so the blow uses Papagato's wearer's Fuerza; the fire melts the pringue
too. Details in `../papagato/README.md` § Duals. The burning shield (*Cortina de fuego*, Foc Binari +
Yuki se esconde) is an idea for later.

### With Freática: Electrólisis (2026-11-25, built)

| Dual | Matemágico + Freática | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Electrólisis** | **Cubo acuático** + Sondeo eléctrico | node · 2 | 2 + 1 | `Daño mágico eléctrico leve a todos los enemigos. Convierte su agua en gas durante 20 segundos, más fuerte cuanta más agua tenían. El siguiente golpe de fuego sobre uno hace estallar el gas de todos.` |

The current splits each foe's water into Gas at its level instead of running through it (no
Conducción, no Shock); the next fire blow on any of them sets off the gas of all, 12 a level of
magic fire each and Quemado I (`../README.md` § Gas). Its blow is power 20 since 2026-11-26 (18 before: smart
never took it, 0.03 a fight). What it asks: who brings the fire and when,
inside the 20 s, and giving up what that water would have been (Conducción, Vapor, Bajo cero). Its
look: Gerard plants two electrodes of gold neon at the ends of the foes' line, a − and a +; Freática's
bolt runs from one to the other through every foe; the water boils into bubbles, two of hydrogen
(cyan-white) for one of oxygen (pale gold), rising fast through a body of the fight's fluid in each
cell while the water sinks; the bubbles gather into a cloud of glass beads over each foe
(`src/duo-fx/electrolisis.ts`). In the fight tester: «Probar un dúo» → Electrólisis (water I, II and III
under three dogs).

**Balance** (2026-11-26). At 20 smart takes it about half a fight where the electric blow on everyone pays
(La Delegada and the Gemelos of the third year, 187 PV a use against 82 for Sondeo and 76 for Cubo: about
1.1 times its halves before the gas, about 1.45 with it lit). In the castle it never lays gas: it is cast on
dry foes, as an electric blow on everyone. The gas goes up where the fight wets the foes itself: El Campeón,
whose own water the dual splits. For the bot to light it, `smart` values the gas at 28 a level (`GAS_WORTH`,
the blast at the stats it is met with and the fire it leaves) and a fire that sets it off at what the blast
does, nothing given back for the gas spent (it used to lose more by lighting than the blast gave). Its pair,
`campeon-electrolisis` and `campeon-sin-electrolisis` (`ONLY_MAT_FRE`: Gerard only on Matemágico, Aitor only
on Freática; `ELECTRO_AT`: the party after the other missions with Vasos comunicantes, Descarga and Freática's
maná), holds the dual taken (0.77 a fight against 0.06) and the gas going up (0.68 a fight against none), so
`gas.rules.blast` (12) is read; the fight comes out alike (99 %, 14.9 rounds against 14.2): a player's piece,
not El Campeón's answer. The sim gives the gas's blast to Electrólisis, not to the fire that lit it, and the
blast's Magia, Rescoldo and Toma de tierra are whoever brought the fire (a dual's fire half), not whoever pressed.

### With Dadista: Campana de Gauss (2026-11-25, built)

| Dual | Matemágico + Dadista | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Campana de Gauss** | **Pirámide ígnea** + Dados astrales | node · 4 | 2 + 1 and a die | `Daño mágico de fuego leve a un enemigo. Caen más dados cuanto más Crítico, la mitad sobre él y el resto sobre los enemigos de al lado. Su fuego sube al menos a nivel III y el de los de al lado a nivel II. Derrite el pringue. Gasta la racha.` |

- **Rules** (`bellFall`, `bellSplit`, `BELL` in `src/battle.ts`, tunable as `bell.rules.*`): `base` 4
  dice plus the Dados astrales count of whoever wears Dadista (`rainCount`, a die each 15 % of Crítico),
  `most` 14. Half of them, rounded up, fall on the target; the rest go one by one to the foe before it
  in the row and the one after it (the odd one by the fight's dice), shuffled in the order they drop; a
  side with nobody falls to the target. A die whose foe has already fallen goes to the first of the
  target and those beside it still standing (none: the rest are lost). Each is 6 magic fire with the
  Pirámide wearer's stats, never a golpe crítico; the first on a foe in pringue melts it; a foe that
  sings or turns magic back takes nothing and does not burn; an onion loses one layer however many
  dice reach it. Then the fire meets powder (Estallido), then ice (a mark melts and that foe does not
  burn), then the target's fire is at least III and each one beside it a die reached at least II
  (`kindle`: never lower, the clock over); on water it is Vapor, on wet layers nothing. Fran's light
  eats it all. The Racha is spent. The target is always first in the effect's `hits` (an eco that
  repeats the dual finds it).
- **The question it answers**: which foe must burn most. It is the only piece that puts a foe chosen
  straight on III; with Combustión, the next fire takes it to IV. Against the fire-resistant it is a
  poor choice, and it shows. Fight-sim holds it to Aurelià's Atril (`aurelia-leccion-campana` and
  `aurelia-leccion-sin-campana`, party `MAT_DAD`): with it the lesson is about a round shorter.
- **Look** (`src/duo-fx/campana-de-gauss.ts`, contact 1.8 s, end 2.7 s): the fight's camera turns
  round the fight (`bellTurn` in `src/battle-scene.ts`, 50° at most) so the row of foes runs across
  the picture, and zooms onto the board. Pirámide's triangle is drawn in gold, standing in the
  camera's plane over the foes and as wide as their row, eight rows of pegs a tick each, and under it
  a pale glass bin straight over each foe it reaches (each over its foe's place in the picture,
  snapped to the board's bins). Dadista's dice of cold light (small spinning facets) fall into its
  top and melt into single balls of fire, an ember trail behind each, that fall through the pegs on
  the paths the rule chose (the GPU `galton` law, the path's bits in the burst, each peg it meets
  flashing) into the bin over their foe; 150 small gold ghost balls fall on paths of their own and
  settle in the bins as gold sediment, a bead at a time, so the histogram builds as they land. The
  bins fill with liquid fire (box volumes holding a fluid), the pen draws the bell from where the dice
  fell, the bins open at 1.35 s and the fire pours out of each as a sheet onto its foe; the pegs go
  out from the bottom up. If a light eats the fire, the balls still fall but the bins only smoke:
  nothing pours, nothing shakes. Sounds `peg`, `pachinko`, `chord-swell`. Screenshots:
  `just screenshots campana-de-gauss --gpu` (three dogs, four, and Aurelià with El Atril).

### With Sincopante: Corriente alterna (Aitor 2026-11-25, built)

| Dual | Matemágico + Sincopante | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Corriente alterna** | **Cortocircuito** + Crescendo | node · 2 | 2 + 1 | `Daño mágico eléctrico leve a un enemigo. Si está mojado o prepara un movimiento anunciado, pierde su siguiente turno. Durante 20 segundos, la corriente va y viene entre él y el enemigo de al lado: cada 5 segundos golpea a uno de los dos, más fuerte cada vez. Cada golpe provoca las reacciones de la electricidad y gasta el estado con el que reacciona.` |

Cortocircuito's blow (14, its Shock rule and its `shorted` as always), then a circuit for 20 s
between the target and the next foe in the row: a beat every 5 s, the other pole first and then in
turn, 8, 11, 14 and 17, each a bolt for the reactions that, like any bolt, spends what it turns
(`../README.md` § Alterna). It is Vulcano's mirror: Vulcano piles fire up on the clock, this cashes
in on it. The question it answers is *what to prepare, and on whom*: the party feeds the pole whose
beat is coming (Cubo, Capilaridad, a blinding, a fire, powder). Crescendo can only be chosen with ecos
sounding, so it turns up when Marta plays her ecos; nothing announces it.

**How it looks** (`src/duo-fx/corriente-alterna.ts`): Gerard's dial opens in yellow and a resistor
is drawn in it, while a comet of nácar from Sincopante's wearer writes a crescendo hairpin (<) over
the poles; a string of light draws tight between them from its middle out; the resistor flies to the
target and snaps across its chest. On each beat the string is plucked at its far end, the pulse runs
to the pole it is for, flips over there and a bolt falls on it, brighter and a tone higher each time
(`string-1`…`string-4`). After the last the string snaps in the middle and each half whips back onto
its pole, coming apart. The camera turns so the string crosses the picture as it is drawn, clear of
scenery and of the commands on the left (`alternaShot`, `docs/graphics.md`).

### With Papagato: Arco voltaico (2026-11-25, built)

Acecho with the condenser's charge (`DualSpec.stalk`, `pounce` in `src/battle.ts`; its look in
`src/duo-fx/arco-voltaico.ts`). Its turn nothing lands: whoever brings Acecho waits on the prey, charged
(`Combatant.stalk.charged`, the Acecho icon and the Cargado one on their plate). As the next round starts,
before anyone chooses, the cat lands: **80, physical and electric at once, with the cat's wearer's stats**, a
sure golpe crítico. Being physical it spends the wound (+20 % a stack, Olor a sangre from five) and sets off
Combustión; being electric it turns what Atacar·Eléctrico turns, in the same order (the powder first, then
Plasma on a fire, Tormenta through smoke, Conducción through water), so on a bare Quemado IV Plasma takes
the fire, and on powder over it the shards set and the blow bursts it. If its prey fell, the cat takes
whoever bleeds most.

**The risk of waiting.** A foe whose blow finds the one waiting first takes the charge, as Condensador's
does: `CONDENSADOR.jump` of electric magic with the waiting one's stats, which turns what it finds on that
foe (Plasma on its fire, Conducción…); the pounce still comes, at `jumped` (half) of its power. Any blow that
lands on whoever waits makes it jump, however softened: a cortina, Escolta or Defender take some of it off,
not the jump. What keeps the charge is stopping whoever would strike first, or taking it down: Cortocircuito
or Shock on it, a foe felled, a blow that misses or that a shell swallows whole. (With water about, the jump
turns Conducción on its way, so a forced jump is not all lost.) A blow that finds both Gerard carrying his
own Condensador and the one waiting (one on everyone) makes both charges jump, his first (`discharge`,
`effect.arcDischarge`). A fight won before the pounce leaves nobody waiting (`endFight`).

**Look.** Gerard draws a gold parabola in front of him, its focus a bead and its directrix dashed; it rises
and turns in the world until its axis stands over the prey and its focus sits just in front of its chest
(towards the camera, so the body never hides where the light meets; she still lands on the chest), an arch of light running down to the floor either side (its focal length is what makes it meet the
floor there). The arch is worked out once from where the cat rests (`arcFor`), and the scene's run and the
figure share it. While the cat waits charged, sparks rise out of the floor in rings round the focus, within
a cone of a few degrees, strike a GPU mirror along the arch (a `paraboloid` volume in `mirror` mode, opening
down) and converge on the focus, their spread drawing the caustic's cusp; she crouches in plain sight with
her fur standing with static and a faint knot of the charge on her back. If the charge jumps, the arch swings about its vertex until
its axis points at that foe, an arc leaves the vertex for it, and the mirror goes dark. The pounce: she runs
the arch itself, her flight even across like a thrown body's, a wide trail of plasma behind her and a gold
rim of light on her head, drops down the axis onto the focus, a jagged bolt and the crítico, and the arch
bursts into gold splinters. The contact adds no white flash of its own: the crítico and any reaction already
flash, and the bolt and the splinters have to read in that frame. Sound: the
condenser's whine as it settles and as she springs, its snap on contact. The design said the sparks fall
from above; with the arch opening down they rise from the floor, so the mirror sends them to the focus for
real.

**Balance** (2026-11-26). Power 64 → 80: at 64 the pounce was 1.15 times its halves (Acecho's critical
plus what the charge adds to a bolt: 116 against 101 on a directiva, 178 against 158 on El Empollón), and
smart never took it; at 80 it is about 1.4 times. Its pair, `castigado-arco` and `castigado-sin-arco`
(El Castigado, DUO, the second floor with the electric line to Condensador, `ARC_AT`): El Castigado takes a
point of Rabia for each blow that does not fell it, and the pounce weighs two. With it, 100 % in 3.7 rounds,
0.5 pounces a fight at 191 PV each and Revienta 0.07 a fight; without, 98 % in 4.1 and 0.12. The sim
credits a pounce's PV to whoever crouched (Acecho, or Arco voltaico), since 2026-11-26.

### How the pieces of 2026-11-25 meet

Each piece is a rule by kind, never a case for another: they meet through the statuses they leave.

- **Atractor extraño and Electrólisis**: Gas is the one dual's own status that moves (it is the water it
  was). Gathered, the foes' gas adds up to `GAS.top` (III) on one, a single big cloud for the next fire.
  Fire that comes along with it is no blow and lights nothing; an Estallido on the way does.
- **Campana de Gauss and Electrólisis**: each die of fire that lands is a blow of fire, so the first one on
  a foe with gas sets off the gas of every foe (`ignite`), after the bell has shaped its fires.
- **Serie de Fourier and the rest**: it counts the plate, so what the others leave pays it, Gas included,
  one icon a kind (Atractor's pile counts as its variety, not its depth). Corriente alterna's Alterna is on
  the plate but is a circuit, not a status: it is not counted (`plateCount`), and Atractor does not move it.
- **Superficie mínima and Arco voltaico**: on the one waiting charged, a foe's blow bursts the film on it
  first (Mojado) and then takes the jumping charge, which runs through that water (Conducción). The striker
  of someone under the film who carries Gerard's own Condensador is wet before that charge jumps too.
- **Corriente alterna's beats** are bolts for the reactions on whatever the others leave between them:
  water from Cubo, Capilaridad or a film (Conducción), a fire (Plasma), smoke (Tormenta), powder (shards).
  A pole whose water Electrólisis split has none left to conduct.

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
- Grade III (§ Grade III): the tree costs 39 ecos since 2026-11-26 (33 before Serie de Fourier, Atractor extraño,
  Superficie mínima and Resonancia; each dúo mayor 3, Combustión and Integral impropia 3, Atractor extraño and Resonancia 2; `src/ecos.ts`). They only show after Aurelià.
