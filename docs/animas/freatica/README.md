# Freática

Status: designed whole 2026-11-20 around Aitor's direction of that day (*La crecida*: water held on
the foes' side that rises to three marks; electricity stays in it as damage over time; fire turns
it to steam and blinds; at the third mark the foes sink and lose a share of their PV over time).
Aitor's yes to the whole, 2026-11-21. **Playable whole since 2026-11-21**: the rule, its seven
levels, the passive *Nivel de base* and the definitiva *Bajo cero* are in the fight rules, and the
effects lab's look is driven by them in real fights (§ Implementation) · Comes from: Emilie's mission, [`docs/quests/emilie.md`](../../quests/emilie.md)

What is **decided** says so and by whom. Everything else is a proposal, and its numbers are first
guesses ([`../README.md`](../README.md) § Order of work).

**Decided by Aitor**

| When | What |
| --- | --- |
| 2026-11-20 | It must **not be another Tecnópata**: less technology, **more water and intelligence** |
| 2026-11-20 | ***La crecida*** is its mechanic («adjudicado»): it has a visual identity and fits water and intelligence |
| 2026-11-20 | It plays with **extending the water states and electricity**; **fire plays with blinding** |
| 2026-11-20 | **Its rule describes the levels** of the water |
| 2026-11-20 | **Electric attacks electrify the water** and it **hurts the foes over time** |
| 2026-11-20 | **Agua contenida**: the water is **held between something on the foes' side, as if the wearer controlled it**. This is where the ánima gets its **mathematical** part |
| 2026-11-20 | **At three of water the foes sink** and start losing **a share of their PV over time** |
| 2026-11-20 | Its name is **Freática**, and its colour is **blue with green** |
| 2026-11-20 | **The visual base first**, shown to him, and the rest polished from there |
| 2026-11-20 | Its definitiva is ***Bajo cero***: it **freezes the foes that have water, for as many turns as water they have**, and **each turn the freezing goes down** (later that day he moved it from turns to time: three rows down) |
| 2026-11-20 | **A frozen foe cannot attack and takes little damage; if the ice is broken, a very large blow** |
| 2026-11-20 | **Cracks show, and it splits more as it takes damage from outside** |
| 2026-11-20 | It can wake **when a foe is full of water** |
| 2026-11-20 | **Broken at the start the ice does a huge amount of damage; the more it has melted, the less, but still a lot** |
| 2026-11-20 | **Every foe that has water at that moment freezes, but one of them must have its water at the maximum.** So **each foe carries its own water** (until then the design had one body of water for the whole enemy side) |
| 2026-11-20 | **A boss can be frozen too**, and like anyone it takes little damage unless its ice is broken |
| 2026-11-20 | **The ice goes by time**, not by turns: it **comes down little by little, melting live, and breaking it is worth less all the while**. More water is still more ice |
| 2026-11-20 | **The ice breaks by percentage, at four to seven blows**. Read here as: each blow from outside cracks a share of the ice, more the harder the blow |
| 2026-11-21 | **The damage of breaking the ice is not a share of PV**: it is a blow, so the wearer's Magia and a weakness to water count, and Hundido stays the one pure share |
| 2026-11-21 | **A flurry is a shortcut through the ice, and that is good**: *Zarpazos de fuego* is a dual that is hard to set up. He put it as Zarpazos three blows, Zarpazos de fuego five, **the ice four to eight**, «or a better combination» |
| 2026-11-20 | **Hundido takes its share of the PV the foe has in all**, not of what it has left |
| 2026-11-21 | **Yes to the whole design**, and into the fights now («pensaba que todo esto ya estaba en el combate») |

**What the first sketch of La crecida loses** (it was a proposal): the water reaching the party at
the third mark. Held on the foes' side, it never wets the party while its wearer stands (§ Signature,
*When nobody holds it*).

## Identity

- **What it is**: Emilie's *why*, back and at work. Whoever wears it does not throw water at
  anyone: they **raise the water under each foe and hold it there**, each in its own cell with
  straight walls that nobody else can see the reason for, and everything that falls into that
  water (a spark, a flame) does more than it would have done alone. Her flat flooded because she
  could no longer join a cause to its effect; the ánima is that same water, understood.
- **Why it is not Tecnópata, and not Matemágico's water**: Tecnópata is a machine and clocks on
  one foe. Matemágico throws water: a status on a foe, twenty seconds. This is **the ground
  itself**: a column of water under each foe, with a level, that the wearer builds, holds and
  spends. Its intelligence is running a system, not a gadget.
- **What wearing it feels like**: being the one who set the board. You hit little; you decide who
  stands in water and how deep, and what your partner's next spark or flame will mean.
- **Unlocked**: at the end of Emilie's mission, when El que no converge falls and the why comes
  back to her (`anima-emilie`, `winEmilie`). Shared: Gerard or Aitor equips it in an extra slot.
  Seven levels by EXP.
- **Name**: **Freática** (Aitor, 2026-11-20). The *nivel freático* is the water table: the level
  groundwater stands at under the ground. It is what the ánima raises.
- **Motto** (proposal): *"No echa agua. La sube."*
- **Colour**: **blue with green** (Aitor, 2026-11-20). Built as the water's own depth: thin water
  is green (`#27c2a0`, the first mark) and deep water is blue (`#1f5fd8`, the third), so the colour
  is also the reading of the level. The marks of the staff gauge are white. The one colour the
  interface and `CLASSES` need is a proposal (§ Open). Grey in the first round (§ Look and
  interface).

## Role

**The party's ground: it floods the foes where they stand, and the depth of each one's water is
the strength of everything that happens in it.**

| | Freática | Matemágico | Tecnópata | Papagato | Dadista | Sincopante | Prismático |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hurts with | Light water blows; the damage is in what the water does over time | Magic, with elements | Magic, clocks | Physical blows | Physical faces; the astral, by luck | The astral, through ecos | Light physical blows; what the paint becomes |
| Its resource | **The level of the water under each foe**, held in its cell | Elements and their statuses on a foe | Clock statuses on a foe | Sangrado on the foe | Crítico (the Racha) | Ecos on its own side | Pintado on the foe |
| Pays off as | **Hundido** at the third mark; **current** in the water from any electricity; **steam** that blinds from any fire; all of it thrown at once (*Golpe de ariete*) or frozen (*Bajo cero*) | A reaction between elements | Longer clocks, control | A golpe crítico on the wound | Críticos, Dados astrales | Ecos raised, Tutti | Estallido, Endurecido, Envenenado |

- **Good at**: one big foe and long fights (a share of PV over time, and the deepest water is
  where everything is strongest); making a partner's elements worth more (one spark runs through
  every foe that has water and stays in each one's); stopping foes outright with its definitiva; a
  cure for the whole party that costs water, not much maná.
- **Bad at**: a big blow right now (it needs three turns of water on a foe first); short fights;
  many foes at once before *Riada* (level 6), since each one's water is raised apart; foes that
  resist water or electricity; being left alone (the water drains while its wearer does something
  else). It has no physical blow and Fuerza −1. If its wearer falls, the cells break and the
  water wets **both sides**.
- **The decision it adds to every turn**: **whose water, and raise, hold or spend?** One foe deep
  or all of them shallow; one more mark, or keep it where it is; spend it as a cure, as steam
  against the blow that is coming, or all of it at once. With a partner it is said out loud: *do
  not light that one yet, I want it sunk first*.

## Stats

Proposal for `CLASS_STATS`: **Magia +3, Espíritu +2, Fuerza −1** (sum +4). The most Magia any
ánima gives: its blows are light and the cure is the party's, so they lean on it; the water's own
damage does not grow with Magia. Fuerza is the trade-off: Atacar is weak in it.

Emilie's light (`ANIMAS.emilie`, the party bonus) keeps its placeholder until the lights are gone
over together: Magia +1, Defensa +1, PV +10 (Luca's placeholder is the same pair).

## Signature: La crecida

The loop:

1. **Raise.** A blow that says `Sube su agua` puts a mark of water under that foe. Three marks at
   most. A foe with water is wet.
2. **Hold, and let things fall in.** Each water's top mark drains in 20 s; any water blow on that
   foe starts its clock over. Electricity from anyone leaves **current** in the water; the deeper
   the water, the harder the current. A foe whose water is at the third mark is **Hundido**.
3. **Spend.** A mark for a cure (*Bombeo*); a mark, to any fire, for steam that blinds; every
   mark at once in *Golpe de ariete*; or all the water there is, frozen (*Bajo cero*).

The rules themselves are shared and live in [`../README.md`](../README.md) § Agua contenida,
§ Corriente, § Hundido and § Congelado (the rule, and how it shows, beat by beat). In short:

| Mark | Seen | What it does to the foe standing in it |
| --- | --- | --- |
| **I** | To the ankles | It is **Mojado** for as long as its water stands, with no clock of its own. So fire does not catch on it (Vapor), and electricity runs through it (Conducción) |
| **II** | To the waist | The same, and what happens in its water is of level II: the current pulses twice as hard, the steam blinds at II |
| **III** | Over its head | Level III for the current and the steam, and it is **Hundido**: every 2 s it loses 2 % of its PV |

- **Each foe carries its own water** (Aitor's): its own cell, level and clock. Raising one foe's
  does nothing to another's.
- **A water's level is the level of what happens in it.** One number to read, the one the water
  itself shows.
- **Corriente** (Aitor's): any electric blow on a foe with water is Conducción as always (it runs
  through every wet foe, and every foe with water is wet; Shock on a coin for the one struck),
  but **the water does not go**: each water it ran through keeps the current for 10 s, pulsing on
  its foe every 2 s at its own level. A bolt while it runs only starts its 10 s over.
- **Vapor**: any fire on a foe with water takes its top mark and leaves that foe Cegado at the
  level its water had (its blows at 70 / 50 / 30 %). At the third mark it is the strongest blind
  in the game, and it costs the sinking.
- **Agua contenida** (Aitor's, the mathematical part): each water stands in **a cell**, a straight
  prism with edges of white light round its foe and a staff gauge up one edge, its three marks
  numbered. It is a control volume: what goes in, what comes out, and the level between.

**When nobody holds it** (proposals):

- **The wearer switches ánima**: the water stays and drains as before, and nobody can raise it.
  The passive *Nivel de base* stops holding. Any water blow from anyone still starts a foe's
  clock over, and the current and the steam work the same. So flooding and then switching to
  another ánima to light it or charge it is a way to play, with the clocks running.
- **The wearer falls**: every cell breaks. The water runs over the whole floor and is gone, and
  everyone standing **on both sides** is Mojado for 20 s, the ordinary status. Against foes that
  bring electricity, that is the danger of leaning on it.

**Where it shows**: in the scene, each foe's cell and its water (the level is the clock: the
surface is seen sinking towards the mark below). On each foe's plate, one continuous status icon,
*Agua*: a small gauge with three ticks, filled to its level, with a bolt and its ring while the
current runs, and *Hundido* at the third mark.

**Its sentence in `ANIMA_RULES`** (the status screen's Ánimas page): *Crecida* · «El agua queda
contenida bajo cada enemigo y sube hasta 3 marcas. Con agua está mojado. La electricidad deja
corriente en ella y el fuego la evapora y lo ciega, más cuanto más alta. En la tercera marca se
hunde y pierde vida poco a poco. El agua baja sola con el tiempo.»

### Passives

| Passive | When | What it does |
| --- | --- | --- |
| **Nivel de base** | Level 5 | «Mientras lleves esta ánima, el agua de un enemigo no baja sola de la primera marca.» |

By example. Without it: the wearer raises a mark under a foe, spends a turn on Defender and the
partner hits with something that is not water; 20 s later that cell is dry and the next spark
finds the foe dry. With it: a foe's first mark stays for the whole fight, so it is wet from its
first Recarga on, every spark charges its water and every flame has steam to make, and the
wearer's maná goes into second and third marks only. Fire still takes it (Vapor), and so does
whatever spends it. One passive, and not from the start.

## Skills per level

| Level | What it gives | Who | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | The rule · *Crecida* | — | — | — | «El agua queda contenida bajo cada enemigo y sube hasta 3 marcas…» (above) | Built |
| 1 | **Recarga** | The wearer | 1 | 16 magic, water | `Daño mágico de agua leve a un enemigo. Sube su agua una marca.` | Built |
| 2 | **Sondeo eléctrico** | The wearer | 1 | 18 magic, electric | `Daño mágico eléctrico leve a un enemigo. La corriente que deja en el agua dura el doble.` | Built |
| 3 | **Bombeo** | The wearer | 1 | 16 cure | `Cura leve a todo el equipo. Baja una marca el agua del enemigo que más tiene.` | Built |
| 4 | Maná +1 | — | — | — | — | Built |
| 5 | Passive · **Nivel de base** | — | — | — | «Mientras lleves esta ánima, el agua de un enemigo no baja sola de la primera marca.» | Built |
| 6 | **Riada** | The wearer | 2 | 12 magic, water | `Daño mágico de agua leve a todos los enemigos. Sube el agua de cada uno una marca.` | Built |
| 7 | **Golpe de ariete** | The wearer | 2 | 26 magic, water, once a mark | `Daño mágico de agua medio a todos los enemigos. Gasta el agua de cada uno: un golpe por cada marca.` | Built |
| Jar | Definitiva · **Bajo cero** | The wearer | — | 90 on breaking a fresh ice of three marks, falling to 40 as it melts | *Abstract*: `Congela a los enemigos que tienen agua, más tiempo cuanta más tengan. Congelados no actúan y reciben poco daño. Romper el hielo a golpes les hace un daño muy alto, menor cuanto más derretido esté.` | Built |

Every skill's look is built in the effects lab (§ Look and interface), and plays in the fights.
*Golpe de ariete* does nothing to a foe with no water: its sentence keeps the shape's
`a todos los enemigos`, and the second sentence says who is struck.

What each one is for in the loop:

- **Recarga** builds: the one way to a mark until level 6, a foe at a time. At the third mark it
  only starts that water's clock over, as fire does on Quemado III.
- **Sondeo eléctrico** is the current for a wearer whose partner has no electricity (Aitor's own
  ánima has none). Its edge over anyone else's spark: its current lasts 20 s, not 10. On a dry
  foe it is a plain bolt. The name is the real survey: electrodes in the ground to find water.
- **Bombeo** spends: a mark becomes a cure for everyone, taken from the foe with the most water.
  With no water anywhere it cannot be used. It is what keeps the wearer able to stay in the
  fight, and what makes raising worth it when nothing is there to light.
- **Riada** builds wide: a mark under every foe in one turn. With it one bolt charges them all,
  and *Bajo cero* has everyone to freeze.
- **Golpe de ariete** spends it all: the water hammer, the blow a pipe takes when its flow is
  stopped dead. Each foe is struck once a mark of its own water, three times at the third; then
  every cell is dry, the current is gone and nobody is sunk. The decision is whether what is left
  of the fight is worth more drowned or struck.
- No skill of its own lights the water: **fire stays the partner's** (Aitor: fire plays with
  blinding), so the steam is always something two fighters do.

## Definitiva: Bajo cero

Aitor's, 2026-11-20 (it replaces that day's proposal, *Régimen permanente*, a level held for 30 s).
What is his is in the table at the top; the numbers here are proposals.

| | |
| --- | --- |
| **Wakes in a fight when** | **A foe has its water at the third mark** (Aitor) |
| **Then** | Once in that fight, for the turn and no maná |
| **In the game** | *Abstract*: `Congela a los enemigos que tienen agua, más tiempo cuanta más tengan. Congelados no actúan y reciben poco daño. Romper el hielo a golpes les hace un daño muy alto, menor cuanto más derretido esté.` |

**What it does.** Every foe that has water at that moment is frozen in it: its water turns to a
block of ice round it, as tall as it stood. A dry foe is not. The rule is shared, **Congelado**:
[`../README.md`](../README.md) § Congelado.

1. **It melts on the fight's clock** (Aitor: by time, live, little by little): a mark of ice
   lasts what a mark of water does, **20 s** (proposal), so the foe at III is held a minute, one
   at II 40 s, one at I 20 s. The block sinks all the while, never a mark at a time; when
   nothing is left the foe is free.
2. **A frozen foe does not act** (a turn that comes while it is in the ice is lost) and **takes a
   quarter** of every blow (proposal). **A boss too** (Aitor): it can be frozen, and takes as
   little as anyone while its ice holds.
3. **The ice holds eight blows from outside** (Aitor: four to eight). A *leve* or *medio* blow
   counts **one**, an *alto* or *muy alto* **two**: eight Atacar break it, or four hard blows.
   **Each strike of a flurry counts one** (the combination proposed, below): *Zarpazos*, four,
   is half an ice in one turn; a dual's eight (*Zarpazos de fuego*) break a whole one at once.
   The cracks do not heal as the ice melts. A physical blow cracks it whatever its element; only
   a flame (magic fire) melts it instead.
4. **Cracked through, it breaks**: the foe takes magic water damage by the ice still there at
   that moment (Aitor: huge at the start, less all the while as it melts, still a lot; a blow, never a share of its PV): base
   **90 with three marks of ice, 73 with two, 57 with one, down to 40** as the last of it goes
   (proposal: 40 + 50 × the ice left over three marks), and is free and acts again. A foe frozen
   at I starts at 57: the deep ice is the one worth breaking.
5. **The ice is the water.** A frozen foe has no water: no Mojado, no Corriente, no Hundido, and
   nothing raises it. When its block melts or breaks, its cell is empty. Bajo cero spends the
   water as *Golpe de ariete* does, for another pay: time without its turns, and one blow
   instead of three.

**The decision it adds.** Before it: how many foes to have in water when it wakes, and how deep
each (the one at III is the key that opens it; *Riada* puts the rest in). After it: to break or
to wait, and the clock is running under the choice. Breaking soon is the largest blow the ánima
has, but it takes four to eight blows of the party's that land at a quarter, the ice is worth
less with every second spent on them, and it gives the foe its turns back. Waiting is up to a
minute in which that foe hits nobody. With several frozen the party chooses whose ice to break
and who stays in.

**How fast a pair breaks a fresh ice** (the reason for counting each strike of a flurry; a round
is 10 to 20 s of the ice's 60):

| The pair has | Turns | Ice left, about | Break's base |
| --- | --- | --- | --- |
| Only Atacar | 8 (four rounds) | None: it has melted first | — |
| Hard blows (*altos*) | 4 (two rounds) | 1 to 2 marks | 57 to 73 |
| *Zarpazos*, and a hard blow from the other | 3 (*Zarpazos* 4 + hard 2, then 2 more) | 1½ to 2½ | 65 to 80 |
| The dual *Zarpazos de fuego* | 2, in one round | 2 to 2½ | 73 to 82 |

With Aitor's first numbers (*Zarpazos* three, the dual five) the dual took four turns, as four
hard blows do, and two *Zarpazos* and a hard blow took three: the dual was the slow way. Counting
every strike keeps one rule (a strike is a blow) and makes the dual the shortcut he wants.

**Against the elements** (proposal): a flame does not crack the ice, it melts a mark off it at
once (20 s of it), with its steam (Cegado, as on the water); electricity does nothing to it.

## What a round looks like

Aitor wears Freática (Magia 13); Gerard wears Matemágico with fire and electricity for Atacar. Two
foes of 260 PV, Espíritu 10. Numbers rounded, first guesses.

| Turn | Does | On the foes |
| --- | --- | --- |
| 1 · Aitor | *Recarga* on A | −19 on A. A's water at **I**: A is wet, B is dry |
| 1 · Gerard | Atacar · Eléctrico on A | −19 on A; Conducción through every wet foe, which is A alone: about −24; A in Shock on a coin. **Current I** in A's water: −2 every 2 s |
| 2 · Aitor | *Recarga* on A | A's water at **II**: its current is now −4 every 2 s |
| 2 · Gerard | Atacar · Eléctrico on A | −19; the current's 10 s start over (no second Conducción while it runs) |
| 3 · Aitor | *Recarga* on A | A's water at **III**: *¡Hundido!* −5 every 2 s (2 % of 260), and the current −6: about 55 PV in ten seconds, with nobody striking. B has not been touched |
| 4 · A announces a heavy blow | Gerard: Atacar · Fuego on A | *Vapor*: A's water drops to II, A is **Cegado III** (its blows at 30 %) and is not sunk now |
| 4 · Aitor | *Recarga* on A, or at level 6 *Riada* | A back at III; with *Riada*, B at I as well |
| 5 · Aitor | *Bajo cero* (A is at III) | A frozen for a minute, B for 20 s if it had water, both melting from that moment. Then blows on A's ice, each at a quarter: four hard ones (two of its eight each) break it two rounds later, with about a mark and a half of ice left, for about −75; with Atacar alone it melts before the eighth |

What it shows: the third turn on a foe is where its fight turns, and from there every turn is a
choice between keeping it under, widening the water to the others and spending it.

## What it offers a dual

**Built (2026-11-21):** *Marea* (dúo mayor, Vasos comunicantes + Recarga), *Géiser* (Foc Binari + Recarga), *A escala* (Rayo encogedor + Recarga) and *Seiche* (Recarga + Ostinato); `../README.md` § Combined skills.

Hooks, for the duals still to choose:

- **Standing water under a foe**: a partner's electric half charges it and every other foe's
  water; a fire half blinds it at its water's level.
- **A level to spend**: a dual could throw the water through the partner's blow, a strike a mark.
- **A clock that is a thing in the scene**: whatever stretches clocks (Tecnópata's *Rayo de
  energía*, *Telemetría*) could hold the water or the current longer.
- **Paint in the water** (Prismático): paint that lands on a wet foe is Envenenado
  ([`../README.md`](../README.md) § Pintado), and a foe in its cell is wet.

## Look and interface

Aitor saw the cell on 2026-11-20 («super, se ve bonito») and asked for the rest of the look. What
follows says for each piece whether it is **built** or a proposal.

### The cell (built, in the effects lab)

The ánima's picture, one for each foe: water that is green where it is thin and blue where it is
deep, held in a prism round the foe whose edges are thin lines of white light, a staff gauge up the corner nearest the camera
with its three marks numbered I, II, III, and a faint square mesh on the surface that bends with
the ripples (her model's cells, quiet). The water wells up from the floor, never poured from above:
it is groundwater rising. Beat by beat in [`../README.md`](../README.md) § Agua contenida.

[`src/freatica-fx.ts`](../../../src/freatica-fx.ts), shown in `?fxlab` by
[`src/freatica-lab.ts`](../../../src/freatica-lab.ts) as *Freática · agua contenida*;
`just screenshots freatica-fx --gpu`. It is the look only: it reads no rule and changes no number.

- **A cell a foe** (`createFreaticaField`): each is laid round its foe, squared to the line from
  the party, a hand wider than it, and its third mark stands just over its head, so *sunk* is true
  on screen. Two foes can stand at different levels side by side.
- **Colour is depth**: the water takes the red out of what is behind it (a pass that multiplies,
  drawn before the water), so a foe under it goes blue-green and never pink or violet.
- **The surface is the clock**: inside a mark it falls from full to the mark's tick over the
  mark's 20 s, a wedge on the gauge rides it, and a notch stays where it last stood.
- Corriente: yellow arcs on the surface and a flash every 2 s. Vapor: the top mark's slab turns
  white and lifts as a cloud. A mark III: bubbles off each foe. The cell breaking: the walls go
  and the water runs out over the floor with a foam lip.

### How each skill shows (built, in the effects lab)

Every skill is read on the cell: none has an effect of its own that could be another ánima's. The
same lab section has a button for each, and the scenario a clip.

| Skill | Beat by beat |
| --- | --- |
| **Recarga** | 0 s: the tape runs out along the floor from the wearer to the foe, a line of white-green light (0.3 s). 0.3 s: water wells up through the foe, a ring of drops thrown up and a column of bubbles. 0.4 s: the level rises a mark (0.6 s), the surface doming in the middle |
| **Sondeo eléctrico** | 0 s: a yellow bolt from the wearer's hands to the foe's chest (0.1 s), a burst of sparks and a flash of light there. 0.12 s: it runs down the foe into the water. 0.2 s: the whole volume flashes and keeps the current: arcs on the surface, the edges running yellow. With no water it is only the bolt |
| **Bombeo** | 0 s: the surface of the foe with the most water sinks a mark (0.6 s), with a notch left on its gauge. The water goes back along the floor to each of the party (0.3 s). 0.3 s: green beads rise in a ring round each of them, one after another |
| **Riada** | 0 s: every foe's water starts to rise a mark, the dry ones' cells drawing themselves in first. A wave crosses each cell from the party's side to its far wall (1 s): a steep white crest with a trough and foam behind, seen on the surface and in profile on the walls it runs along. It breaks on the foe as it reaches it |
| **Golpe de ariete** | In every cell with water at once, one blow a mark, 0.42 s apart: three in the deep one while the shallow one takes its one. Each: the whole body of water goes white from its walls in and the edges flare (0.3 s), drops are thrown off the foe, and the level slams down a mark (0.12 s). After a cell's last there is no water in it and it goes |
| **Bajo cero** | 0 s: a white flash through every body of water (0.12 s). Then each water is gone from its cell and stands as **a block of ice round its foe**, as tall as that water stood (a tall block for the one that was sunk, ankle-high for one at I), setting in 0.3 s with a low breath of cold round its foot. The cells' edges stay, brighter; each gauge keeps its marks, which are now the ice left. **It melts all the while**: the block sinks, a mark every 20 s, its pointer going down with it, giving off cold from its top and running with water down its faces; with the last of it, it is gone. **A blow from outside**: the block flashes white, chips fly, and cracks open from the middle of each face out, an eighth of the way a blow, a quarter for a hard one; a flurry cracks it strike by strike. **Cracked through**: 0.1 s later the block bursts in shards with a flash of light, more and faster the more ice was left, and that foe is out. **A flame**: a mark of it goes at once, in steam, and nothing cracks |

### On the plates and over the field (proposal)

Following [`../README.md`](../README.md) § How an ánima is built: a fight's own mechanic is a quiet
status that is always there, never a new panel.

- **On each foe's plate, *Agua***: the rule's count as a status on whoever has it. A small staff
  gauge with one, two or three bars lit, and round it the clock every timed status has: it drains
  over the top mark's 20 s and blinks in the last three. With it, while they apply: a bolt and its
  ring for *Corriente*, pulsing every 2 s as Quemado does; *Hundido* at the third mark (a head
  under a line), pulsing every 2 s; *Cegado* after steam, as today.
- **Frozen**, the *Agua* icon is replaced by *Congelado*: a crystal with the clock every timed
  status has round it, draining as the ice melts, and the crystal itself splitting further with
  each blow, by the share cracked.
- **Named pops**, over the foe's cell: «AGUA I», «AGUA II», «AGUA III» on a rise, in the water's colour at
  that depth; «HUNDIDO» when the third mark closes over a foe; «CORRIENTE» in yellow when the water
  is charged; «VAPOR» in white with the steam; «BAJO CERO» as the water freezes and «¡ROTO!» with the break, whose
  number is the largest the ánima shows. The pulses' numbers come off each foe in their own
  colour: yellow for Corriente, blue-green for Hundido.
- **The foes under water** move at half speed in their idle and their sounds lose the high end.

### On the wearer (built)

In fights; nothing here says anything about the real Emilie. Field clothes in the water's own two
colours (`CLASSES.freatica.look`): a jacket the blue-green of deep water (`#1d5266`), its stripes
the green of the shallows (`#27c2a0`), pale sleeves, dark trousers. On the rig
([`src/anima-looks.ts`](../../../src/anima-looks.ts)):

- **A staff gauge** of white light down the left of the jacket: a spine, three marks (a longer
  tick the higher) and short ticks between. The same gauge as the cell's.
- **A water level meter** at the right hip: the reel of graduated tape a hydrogeologist lowers
  down a borehole, its tape hanging with the probe at the end, the tip lit green and blinking.

Proposal, not built: casting, they let the probe drop to the floor and the tape runs out to the
cell (the line of light *Recarga* already draws); boots to the knee. The one wink (`AGENTS.md`: a
wink, never the general look): for *Sondeo eléctrico* they hold two bent rods that cross as the
bolt leaves, a dowser's.

### Interface (built)

`#hud[data-class="freatica"]` and `.battle-dock[data-anima="freatica"]` in `src/style.css`: a
column of water read on a staff gauge. The fight's ground goes from green at the top to near black
blue at the bottom. Each command is a mark of the gauge on pale paper (a spine down its left, a
long tick, short ticks); the open one is under water, green at its surface and blue below, with
the white line of the surface along its top. The skill sheet is the column itself, shallow to
deep, the gauge's ticks down its edge. Not Matemágico's blueprint (gold lines on navy) and not
Tecnópata's glass.

Proposal, not built: slow caustics behind the skill sheet, and the open command's water line
rising and falling to it.

### First and second round

The cell's edges and gauge are grey in the first round and their own white in the second (built,
the lab's *Color*); the water is the same in both. The wearer's pieces follow the same rule (not
built: there is no first and second round for a look yet).

### Sound (proposal)

Low and close, as heard under water. A mark rising is a swell, not a splash; the current is a hum
that steps up with the level; a Golpe de ariete is the knock of a pipe, once a mark; frozen,
everything goes quiet but the ice ticking, and each crack is a dry snap; sinking takes the high end off the foes' sounds until they come up.

## In the world

Proposal, from `docs/chapter-2.md` (a flooded street as the kind of thing an ánima opens): with
Freática equipped, water in the way can be **held back**. At a flooded underpass or street the
wearer has *Contener* in reach: the water parts into two straight walls, with the same white edges
as the cell, and the party walks through on the wet ground. Which places, and what is behind them:
to design with the city.

## Second round

_Open_ with her mission's second round (`docs/quests/emilie.md` § Open): the kid's *why?*. The
ánima takes its colour there.

## Implementation

**Built** (2026-11-21), following [`../README.md`](../README.md) § How an ánima is built:

- **The rule** in [`src/battle.ts`](../../../src/battle.ts), one book `CRECIDA` (tunable in `just fight-sim`
  as `crecida.rules.*`): each foe's water is the timed state `agua` (its level the marks, its clock the top
  mark's 20 s), drained by `runWater` on the fight's clock; while it stands the foe keeps Mojado (so every
  rule that asks whether a foe is wet finds it wet), `corriente` at its mark and `hundido` at the third.
  `react` charges it (Conducción, then the current), `steam` takes a mark as Vapor, `holdWater` breaks the
  cells when whoever raised them last falls. Bajo cero is `freeze`; the ice is the timed state `congelado`
  (its level the marks of ice left), `enemyMove` loses a frozen foe's turn, `fearDamage` takes a quarter
  of every blow on it, and `chill` counts the blows on its ice (`iceBlows`), melts a mark with a flame and
  breaks it (`iceBreakPower`).
- **Skills and levels**: `SKILLS` (Recarga, Sondeo eléctrico, Bombeo, Riada, Golpe de ariete, Bajo cero),
  `PASSIVES['nivel-de-base']` (`baseOf`), `LEVELLED` in `src/levels.ts`, the flags `freatica-2` to `freatica-7`
  (`src/story.ts`, `STORY_ARCS`, the picker), the definitiva at the jar (`IMPROVEMENTS`, by itself from
  `ulti` in `SKILLS`), its sounds (`src/battle-sounds.ts`).
- **The look in fights**: [`src/freatica-fight.ts`](../../../src/freatica-fight.ts) drives the effects lab's
  cells (`createFreaticaField`) from the fight's state: each frame every foe's cell follows its marks, its
  clock, its current and its ice (the cell's clocks are the fight's, `drive` in `src/freatica-fx.ts`), and
  each action plays its own look once (each skill's `cast`, a bolt, steam, the ice's cracks, a flame's melt,
  the break, the cells breaking). A frozen foe holds its pose. On the plates: *Agua* (a gauge, its ring the
  top mark's clock), *Corriente*, *Hundido* and *Congelado* (its ring the ice left, the blows it has taken
  in its name); pops «Agua I/II/III», «¡Hundido!», «¡Corriente!», «¡Vapor!», «¡Bajo cero!», «Hielo n/8»,
  «Se derrite» and «¡Roto!» with the break's number; the current's and the sinking's pulses in their colours
  (`src/battle-ui.ts`, `src/style.css`).
- **The fight tester**: Freática at every level from the picker's ánimas column, Bajo cero from its jar list,
  and in a fight *Agua*: every foe standing at no water, I, II or III at will (`stageWater`).
- **The bots** (`src/battle-sim.ts`): `smart` values a mark raised, the sinking reached, a current set and
  the turns a freeze takes away.
- Tests: [`tests/freatica.test.mjs`](../../../tests/freatica.test.mjs). Screenshots:
  `just screenshots freatica-combate --gpu`.

**Choices taken where § Open left one** (2026-11-21, the simplest that fits the design):

- **Its one colour**: `CLASSES` keeps the green of the first mark, as proposed.
- **Grey in the first round**: the cells in fights are grey-edged (the ánima's first round, as the lab's
  *Color*); the water is the same. The second round of Emilie's mission is not built, so nothing turns them white yet.
- **When the wearer falls, the water wets both sides**: built as proposed. The water is held by whoever
  raised it last; the ice is not water and stays.
- **How a flurry counts**: each strike one, as proposed; a blow of power 35 or more (an *alto*) counts two.
  A physical blow cracks whatever its element; magic fire melts a mark (Cegado at the ice's level, any fire
  it lit put out); magic electricity does nothing; any other magic cracks.
- **The ice spends the water**, as proposed.
- **Bajo cero** wakes the first time a foe's water reaches III while Freática is worn, and can be used
  while some foe is at III (the doc's «one of them must have its water at the maximum»). Its break hits
  with the Magia of whoever froze them.
- **Sondeo eléctrico on a dry foe** is a plain bolt on it, but as every electric skill (Descarga) it still
  runs through the foes that are wet elsewhere.
- **Bombeo** needs someone hurt, as every cure, and some water on the field; on a tie it takes the mark
  from the first foe.
- Rayo de energía and Telemetría lengthen the water's, the current's and the ice's clocks; Reinicio starts
  the water's over, never the ice's; Virus atómico never spreads water, current, sinking or ice. A fire on
  every foe (Explosión, a charged fire dual) steams each water as any fire does. A frozen La Voz sings no notes.

**Not built**: the wearer's cast (the probe let down, the dowser's rods), the first and second round for
its pieces on the wearer, the foes moving slower and sounding duller under water, *Contener* in the world.

## For the balance, later

First measured 2026-11-21 (`just fight-sim run`, level 7, Gerard in Matemágico with his elements, `smart`):
against Colorista and Papagato at 7 it wins as often in Uri's roof, the black pitch, Fran and El Campeón
(all 100 %), a little less in Aurelià (95 % against 98 %) and a third-year room (87 % against 100 %), and
far less in Dirección (12 % against 100 % for Colorista, 47 % for Papagato, 13 % for Dadista): its blows
are light and that fight is short. Its fights last longer (more rounds to win). To watch:

- **Hundido is the one pulse in the game that is a pure share of PV** (Aitor's direction). Every
  other pulse counts PV only up to 100 (`pulseDamage`), for the reason in `docs/combat.md`: a pure
  share is the same answer to a boss as to a dog. At 2 % every 2 s a foe held under dies in 100 s
  whatever its PV. If bosses fall to it alone: 1 %, or a top (the share is of the PV in all: Aitor).
- **Holding the third mark**: a mark's 20 s against a round's 10 to 20 s. With a quick wearer
  alternating Recarga and Defender it never drains; with a slow one it does. Whether that is the
  right tension, or too easy with a partner who hits with water for free.
- **Corriente** against Quemado: its pulse is ×1, ×2, ×3 of Quemado's base, lower than fire's
  ×1, ×3, ×5. That was set when one water held every foe; now that each has its own and its own
  level, it may want fire's numbers.
- **Raising a foe at a time**: three turns for one foe at III, and *Riada* only from level 6.
  Whether the ánima is too slow against three or four foes before then.
- **Shock**: a foe with water is wet, so a free spark has a coin for a lost turn. Held to
  one coin each time the water is charged, never while the current runs.
- **Cegado III** for one mark and a free flame; Cegado's 10 s may become 20 s
  ([`../README.md`](../README.md) § How long a clock status lasts).
- **Golpe de ariete**: the largest blow is three of base 26 on each foe at the third mark, each its own golpe
  crítico roll; ×1.5 on a foe weak to water (Vertitrón).
- **Hundido on PV in all** (Aitor): it can end a fight by itself, so the sim has to say what a
  minute under does to each boss.
- **Bajo cero at III on a boss** (Aitor: a boss can be frozen, and takes little unless broken):
  a minute without its turns is the strongest thing in the design, and the fight-sim has to
  say what that does to each boss's pair of targets.
- **How long a mark of ice lasts**: 20 s, as a mark of water, so the whole ánima has one number.
  The fight's clock runs while the players choose, so a slow party gets fewer blows in: whether
  a pair can break a fresh ice while it is still worth it (four hard blows are two rounds, 20 to
  40 s: between two and one marks of ice left).
- **Breaking it**: four to eight blows at a quarter to land 90 falling to 40 (first guesses for
  Aitor's «muchísimo al principio, menos al fundirse, aún bastante»). Whether that is worth more
  than the same blows at full and the foe frozen, by level and by party.
- **The flurry's shortcut** (Aitor wants one): *Zarpazos* is half an ice for 2 maná, and the
  dual a whole one. Whether Papagato then breaks every ice too easily, and whether any party
  that can freeze can also reach *Zarpazos de fuego* (it takes Papagato's and Matemágico's
  skills beside Freática's).
- **The largest blow**: 90 of base as magic water damage on each frozen foe, ×1.5 on one weak to
  water. It is not a blow of anyone's: never a golpe crítico.

## Open

Each point below was taken the proposed way on 2026-11-21 to build the whole (§ Implementation,
*Choices taken*); each is still Aitor's to change.

- **Its one colour** (for `CLASSES` and the interface, which take a single one): the green of the
  first mark, `#27c2a0`, with the blue as the deep end of the interface's ground. The deep blue sits
  near Prismático's proposed ultramarine (`#3d5fe0`); the green keeps them apart.
- **Grey in the first round**: grey edges and gauge over the same water, in the fights too. Or the
  water itself loses its colour until the second round.
- **When the wearer falls, the water wets both sides**: built. The cost of leaning on it, or one
  rule too many.
- **How a flurry counts**: each strike one (*Zarpazos* four of the eight, *Zarpazos de fuego* all
  eight), built. Or Aitor's first numbers, three and five, with which the dual is no quicker than
  four hard blows.
- **The ice spends the water**: built. Or the water is back at the mark the ice melted to.
