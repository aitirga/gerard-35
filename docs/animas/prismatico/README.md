# Colorista

Status: designed 2026-11-20 round the puff (dry coloured powder, as at a Holi) and **agreed by
Aitor that day**: the mechanics are his, and he said yes to the skill list and its names.
**Built whole on 2026-11-21** (his word: *dale y acábalo todo*): its seven levels, its rule, its
passive, the cortina and the definitiva. Numbers are first guesses. Its id in the code and this
folder stay `prismatico`. What is left: § Implementation
· Comes from: Luca's mission, [`docs/quests/luca.md`](../../quests/luca.md)

What is **decided** says so and by whom. Everything else is a proposal, and its numbers are first
guesses ([`../README.md`](../README.md) § Order of work).

**Decided by Aitor**

| When | What |
| --- | --- |
| 2026-11-16 | The name was Prismático (the prism idea has since gone to Marta's ánima) |
| 2026-11-20 | It is **more of a tank, a protector**. The dynamic and the idea: **protection and changes of state** |
| 2026-11-20 | **No paint: the puff.** Dry powder thrown by the handful, as at a Holi. Everything is named after it |
| 2026-11-20 | The powder on a foe **does nothing by itself; it waits for an element** |
| 2026-11-20 | **Water** on the powder **poisons**: the foe takes damage over time, and **the physical and magic damage it receives is amplified** while the poison lasts |
| 2026-11-20 | **Fire** on the powder **explodes**: damage, and **every foe burns one level more** |
| 2026-11-20 | **Electricity** leaves the powder **crystalline**: a new status that lasts a time, in which **every attack it receives does a certain amount more**, because the shards dig in |
| 2026-11-20 | **Protective spells**: they **raise everyone's Defensa** and stand **a shield of particles in front** that **halves the next attack**. The first protects one, the second both. *Lienzo* and *Barniz* are out |
| 2026-11-20 | The puffs come in **different colours, which do nothing**: not saturated, **mixed and matte** |
| 2026-11-20 | **Yes to the design as it stands**: the skill list and its names (*Cortina* and *Telón* above all), *Rebufo*, its own water, the name *Cristalizado* |
| 2026-11-20 | **Cristalizado grows**: each blow more does more damage than the one before |
| 2026-11-20 | The name could be **Colorista** (his word: *podría ser*). Taken as its name until he says otherwise |
| 2026-11-21 | **Build all of it** |

What his earlier rounds of the same day lose: paint that shines on the floor, electricity that
sets the foe hard and takes its turn (*Endurecido*, *Añicos*), and the blows brought to the wearer
(*Lienzo*'s cover).

## Identity

- **What it is**: Luca's colour, back as something you can hold: dry powder, by the handful.
  Whoever it lands on carries it. It does nothing by itself; it waits for an element, and the
  element decides what it becomes.
- **Why powder, why a protector**: Luca is the one who hugs, who puts a hand on your arm, who
  stands close. Nobody is near him without taking some of his colour with them. And he went grey
  by giving it all to someone else: the ánima's risk is his, spending itself on the others.
- **What wearing it feels like**: you stand in front and hurt little. You decide which blow is
  worth half, and you leave the foes ready for whatever your partner throws.
- **Unlocked**: at the end of Luca's mission (`anima-luca`). Shared: Gerard or Aitor equips it in
  an extra slot. Seven levels by EXP (built). On trial inside the salon: § In the world.
- **Motto** (built): *"El color se queda en las manos."*
- **Colour** (built, to confirm): a dusty blue, `#617ce2`.

## Role

**The party's screen: it halves the blow that matters, and whoever breaks through it comes away
covered in powder for an element to finish.**

| | Colorista | Papagato | Matemágico | Tecnópata | Dadista | Sincopante |
| --- | --- | --- | --- | --- | --- | --- |
| Hurts with | Light physical blows; the damage is in what the powder becomes | Physical blows | Magic, with elements | Magic, clocks | Physical faces; the astral, by luck | The astral, through ecos |
| Its resource | **Empolvado on the foe**, part of it laid by being hit | Sangrado on the foe | Elements and their statuses | Clock statuses | Crítico (the Racha) | Ecos on its own side |
| Pays off as | An element on the powder: **Estallido** (fire), **Envenenado** (water), **Cristalizado** (electricity) | A golpe crítico on the wound | A reaction between elements | Longer clocks, control | Críticos, Dados astrales | Ecos raised, Tutti |

- **Good at**: the big announced blow (a screen is half of it, for one maná); making the party's
  own blows count for more (a poisoned foe takes a quarter more, a crystallised one more with
  every hit); fights with several foes (one fire sets off every powdered one).
- **Bad at**: damage of its own (Fuerza −1, light blows at every level). Alone it only has the
  poison: the explosion and the crystal need fire and electricity from someone else
  (Matemágico's Atacar, Foc Binari, Tecnópata's Explosión, a dual). A screen is one blow: a foe
  that strikes many times goes through it at the first.
- **The decision it adds to every turn**: a screen or a handful, and, with the partner, **what the
  powder becomes**: blown up now on everyone, poison for whoever hits hard, or crystal for whoever
  hits often. Two players have to say it out loud.

## Stats

`CLASS_STATS` (built, a first guess): **Defensa +3, Espíritu +2, Fuerza −1** (sum +4). On Aitor:
Defensa 15, Espíritu 13, Fuerza 12. No PV: a worn ánima that changes PV needs a rule for switching
in the middle of a fight, and the points of Defensa already do the work on every blow.

The friend's light (`ANIMAS.luca`: Magia +1, Defensa +1, PV +10, a placeholder) is apart.

## Signature: powder in the air

Its rule, there from level 1 (built: `ANIMA_RULES`; what shows it is the screen itself, standing
in front of the ally, and its icon on their plate):

> ***Rebufo***: `Quien rompe una cortina de polvo queda empolvado.`

The loop:

1. **Cover them in powder.** By hand (*Puñado* on one, *Polvareda* on all), or by being hit: a
   **cortina** stands in front of an ally, halves the next blow and bursts over whoever dealt it.
2. **Let an element decide.** Fire, water or electricity on the powder, from anyone, turns it into
   one of three things ([`../README.md`](../README.md) § Empolvado):

   | On Empolvado | Becomes | What happens |
   | --- | --- | --- |
   | Fire | **Estallido** | The powder explodes: magic fire damage on that foe (22) and half on every other; the blast sets off the powder on the others. Then **every foe is Quemado one level higher** |
   | Water | **Envenenado** | 20 s of poison that pulses, and **every blow on that foe, physical or magic, lands 25 % harder** while it lasts |
   | Electricity | **Cristalizado** | 20 s in which **every blow that foe receives does more than the one before**: 4 more the first, 8 the second, up to 20. The shards dig in |

3. **The change raises the screen again** (level 5, *Remolino*): each time a foe's powder turns
   into something, a cortina stands in front of the wearer. So the screen, the powder and the
   element feed one another, as long as the party keeps an element coming.

Empolvado, its three reactions and the cortina are shared rules, by kind and never by ánima: any
fire blows powder up, whoever threw it. They are defined, with how each one shows, in
[`../README.md`](../README.md) § Shared mechanics.

### The cortina (the protective spell)

Aitor's, 2026-11-20: a physical shield of particles in front of an ally that halves the next
attack. Built (`CORTINA` and `changeHealth` in `src/battle.ts`, the one place every blow on an
ally goes through).

- **The next damage a blow does to that ally is halved, and the cortina breaks.** One blow, one
  cortina: of a flurry it stops the first. Pulses (Quemado, a poison) pass through and do not
  break it. Halved first, then Defender's or a protection's third, if there is one.
- It stands **until a blow breaks it, or three rounds** (the same clock as the Defensa it comes
  with). One on each fighter; raised again, it starts over.
- A blow on everyone breaks each cortina it meets and is halved for whoever stood behind one.
- **The other dynamic** (Aitor's yes, 2026-11-20): ***Rebufo***, the ánima's rule. The cortina is
  powder, so it does not just vanish: it bursts over whoever broke it and leaves them Empolvado.
  The protection is also how the ánima builds its resource, and a foe has a reason to think twice
  about which of the two it strikes.
- *Cortina*'s and *Telón*'s Defensa do not add up: the second one cast restarts the three rounds.

### Passives

| Passive | When | What it does |
| --- | --- | --- |
| **Remolino** | Level 5 | `Cuando el polvo de un enemigo reacciona, se levanta una cortina ante quien la lleva.` |

By example. Aitor wears it; three foes are about to strike him, 24 each at average stats (19 on
his Defensa 15), and one of them is Empolvado.

- **Without it**: the three blows land at 19 each: **57** of his 135 PV.
- **With it**: Gerard's Atacar · Eléctrico crystallises the powdered one, and *PASIVA · Remolino*
  comes up: a cortina in front of Aitor. The first blow lands at half, 10, and whoever dealt it
  is Empolvado again; the other two at 19: **48**, and the next element already has its powder.

It is what joins the two halves of the ánima, protection and changes of state, and it makes the
partner's element part of the defence. A cortina that is already standing is raised again, not
doubled: two reactions in a round leave one screen.

## Skills per level

Seven levels ([`../README.md`](../README.md) § Levels). Numbers are first guesses: "Base" is the
power, against Atacar's 18. Everything is done by the wearer.

| Level | What it gives | Who | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rule · **Rebufo** | The wearer | — | — | `Quien rompe una cortina de polvo queda empolvado.` | Built |
| 1 | **Puñado** | The wearer | 1 | 16 | `Daño físico leve a un enemigo. Lo empolva durante 20 segundos.` | Built |
| 1 | **Cortina** | The wearer | 1 | +3 | `Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba un aliado.` | Built |
| 2 | **Rociada** | The wearer | 2 | 14 | `Daño mágico de agua leve a todos los enemigos.` | Built |
| 3 | **Polvareda** | The wearer | 2 | 12 | `Daño físico leve a todos los enemigos. Los empolva durante 20 segundos.` | Built |
| 4 | **Maná +1** | — | — | — | — | Built |
| 5 | Passive · **Remolino** | The wearer | — | — | `Cuando el polvo de un enemigo reacciona, se levanta una cortina ante quien la lleva.` | Built |
| 6 | **Telón** | The wearer | 2 | +3 | `Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba cada aliado.` | Built |
| 7 | **Traca** | The wearer | 3 | 10 × 5 | `Daño físico leve a enemigos al azar. Golpea cinco veces. Los empolva durante 20 segundos.` | Built |
| Definitiva | ***Fin de fiesta*** | The wearer | — | — | *Abstract*: `Empolva a todos los enemigos. Su polvo estalla, envenena y cristaliza a la vez.` | Built |

**What the shape had no word for**, now in `AGENTS.md` and `tests/battle.test.mjs`:

- **Cortina** raises a stat of the whole party and also picks one ally, so its first sentence
  names a target (`de todo el equipo`) that is not the one the player chooses: a boost that stands
  a screen (`screen` in `SKILLS`) names the party whatever its `side`. The second sentence follows
  *Sutura de luz*'s (`Reduce a la mitad el siguiente daño que reciba esta ronda.`).
- **Traca** strikes foes picked at random: `a enemigos al azar` (a skill with `volley`).
  `Golpea cinco veces.` follows *Bombardeo orbital*'s.
- **Rociada** says nothing of poison: water poisons powder whoever throws it, as no fire skill
  says what it does to a wound.

What each one is for in the loop:

- **Puñado** builds, by hand: powder on the foe that has not broken a cortina, or again on one
  whose powder was just spent.
- **Cortina** protects and builds: half of the next blow on whoever needs it most, three points of
  Defensa for both, and powder on whoever breaks through. It costs what a handful costs: that is
  the choice of every turn.
- **Rociada** spends, and is the one exit the ánima has alone: every powdered foe is poisoned. It
  leaves no Mojado; on a foe with no powder it is only a light blow.
- **Polvareda** builds wide: all of them powdered at once, for one fire to set off in a chain or
  one Rociada to poison.
- **Remolino** keeps the wearer standing and the powder coming (§ Passives).
- **Telón** is the answer to the blow on everyone a boss announces (*Preparando → todos*): today
  both players spend that turn on Defender; with it one maná more halves it for both, and the
  other player keeps acting.
- **Traca** spends and builds at once: five light blows, each of them stronger than the last on a
  crystallised foe and a quarter stronger on a poisoned one, and every foe it touches is powdered again. Its
  one way of hurting, and it only hurts on what the party has prepared.

## Definitiva: Fin de fiesta

| | |
| --- | --- |
| **Wakes in a fight when** | The powder has been all three things in that fight, while the ánima was worn by someone standing: an Estallido, an Envenenado and a Cristalizado. Each is seen as it happens |
| **Then** | Once in that fight, for the turn and no maná. It heads the wearer's skill list while it is awake |
| **Got** | At the jar, as the ánima's definitiva (`prismatico:definitiva`, 2 ecos): the first one that is not veiled |
| **In the game** | *Abstract*: `Empolva a todos los enemigos. Su polvo estalla, envenena y cristaliza a la vez.` |

**Built** (`finaleReady`, `state.finale` in `src/battle.ts`). Three puffs over every foe, one
after another, and each takes its exit at once: the explosion (with three foes, 22 + 11 + 11 on
each) and a level of Quemado, Envenenado I (or a level more on whoever was poisoned), and
Cristalizado. It kills few by itself: it leaves the whole field burning, poisoned and full of
shards for the round that follows, which is the ánima in one move.

Every way the powder turns counts, whoever or whatever turns it: a blow or a skill of an element, a
dual, Superficie mínima's film, the statuses Atractor extraño brings to a powdered foe (or the powder
it brings to a burning or wet one), and a beat of Corriente alterna on a powdered pole, out of
anyone's turn (`powderTurned`; `tests/powder.test.mjs`). The castle's gate holds it like every
definitiva: it can be bought only after Dirección ([`../README.md`](../README.md) § Growth opens with
the castle).

How it shows: when the third thing happens, *Definitiva · despierta* comes up over the wearer and
an icon stays on their plate (asleep it shows n/3). Used, it is **the dust explosion** (Aitor
2026-11-25), 3.9 s (`FIESTA` in `src/powder-fx.ts`):

1. **0–0.3 s**: the bags on the wearer's belt torn open, one after another round the waist.
2. **0.3–0.9 s**: a handful at each foe, and every handful drawn into one matte cloud over them
   (`fiestacloud`: dry pigment that flocks together, no glow).
3. **0.9 s, contact**: a front of fire crosses the cloud foe after foe (`deflagrate`,
   `src/deflagrate.ts`, the same front as Electrólisis's gas): the cloud catches particle by
   particle and each foe goes up as it reaches them (flash, fireball, ring, scorch). The numbers land.
4. **1.5 s**: what burnt falls back as a heavy rain of wet pigment, which turns green on them: poison.
5. **2.1 s**: an arc jumps from the wearer to the first foe and on from foe to foe; the powder
   sets into crystal spikes where it reaches (`src/shard-spikes.ts`), which take about a second to
   form and drive in: with five foes the last are in at about 3.7 s, just before the end.
6. **After**: a stain of every colour of the palette on the floor where each foe stood, for the
   rest of the fight.

Its sound: the bags' gust, a low muffled whump (dust, not gas: no crack), the rain's hiss, the green
splash, the arc and a crack of glass for each foe's shards (`SKILL_SOUNDS`).

Close to Matemágico's old condition (three different reactions between elements), which is gone:
his definitiva is *Horas extra* now ([`../README.md`](../README.md) § Definitivas).

**In fight-sim:** the bot values powder laid where someone can turn it (`DUST_WORTH`), the poison and
shards it turns into (`POISON_WORTH`, `SHARD_WORTH`), and each reaction not yet seen as a third of
what Fin de fiesta would do now (`ultiWorth`, `dustWorth`). Its pair of targets is **not held yet**:
in the Gemelos de tercero (`alumnos-3c`) with Colorista and Matemágico the room falls in about three
rounds (Polvareda and a fire are already its answer), and the three reactions cannot all be seen
before the fourth, so it wakes in 2 % of fights and the pair with and without it plays the same.
A longer fight does not help: over every fight of the third year (`castillo-3`, the Queen's return
of eight or nine rounds included), with Matemágico, Freática or Tecnópata beside Colorista, the
smart bot wakes it in at most 4 % of them. Burn and poison come every fight; Cristalizado almost
never, because water on every powdered foe at once (Vasos comunicantes, Rociada) poisons them all
and is worth more than one electric blow that crystallises one. To decide with Aitor (2026-11-26):
the condition (Cristalizado is the step nobody takes) or how the bot weighs that last step, before
any fight can hold the pair.

## What a round looks like

Level 5. Aitor wears it (maná 4); Gerard wears Matemágico with Atacar · Fuego, · Eléctrico and
· Agua. Three foes, A, B and C, striking for 24 at average stats (19 on Aitor).

| Turn | Does | On the field |
| --- | --- | --- |
| 1 · Aitor | *Cortina* on Gerard (1 maná) | Defensa +3 for both, three rounds. A cortina in front of Gerard |
| 1 · Gerard | Atacar on A | 22 |
| 1 · Foes | A strikes Gerard; B and C strike Aitor | Gerard −11 (21, halved); the cortina bursts over A: **Empolvado**. Aitor −16 and −16 |
| 2 · Gerard | Atacar · Fuego on A | **Estallido**: 22 on A, 11 on B and C; the three **Quemado I**. *PASIVA · Remolino*: a cortina in front of Aitor |
| 2 · Aitor | *Puñado* on B (1 maná) | 18. B Empolvado |
| 2 · Foes | A and C strike Aitor, B strikes Gerard | Aitor −8 (halved; A Empolvado again) and −16. Gerard −21 |
| 3 · Gerard | Atacar · Eléctrico on B | B **Cristalizado**, 20 s. *Remolino*: a cortina in front of Aitor |
| 3 · Aitor | *Rociada* (2 maná) | 14 on A and C, **18 on B** (the first shard; the next blow on B will do 8 more). A **Envenenado I**: from now on every blow on A lands 25 % harder |
| 3 · Foes | A, B and C strike | Whoever hits Aitor first does 8 and is Empolvado |

Three rounds and the three exits. Aitor has lost about 64 PV of 135 and Gerard 32, against 72
each with no ánima of this kind, and from round 4 every blow on A and B counts for more. Aitor is
out of maná: round 4 is Defender (2 back), or a change of ánima.

## What it offers a dual

**Built (2026-11-21):** *Fulgurita* (dúo mayor, Descarga + Puñado), *Caleidoscopio* (dúo mayor, Escudo de bits + Telón), *Cadáver exquisito* (Puñado + Estrella fugaz) and *Trampantojo* (Confusión + Cortina); `../README.md` § Combined skills.

The duals are designed after every ánima is ([`../README.md`](../README.md) § Order of work).
*Reserva de color* (built) pairs the handful with Foc Binari: a fuse of powder that goes off
later; its name and sentence still speak of paint. Other pairings to explore:

- **Powder to spend, on many**: *Polvareda* leaves every foe ready for a half with an element (Foc
  Binari, Factor común, Descarga, Explosión).
- **A foe full of shards**: Cristalizado pays every hit of a flurry (Papagato's blows, Dadista's
  dice, the ecos, Bombardeo orbital's three volleys).
- **A foe that takes a quarter more**: Envenenado under one heavy half (Zarpa en la llaga, Rayo
  solar, Meteoro).
- **A screen with something in it**: a cortina that an ally's element turns into something else
  before a foe breaks it (`docs/combat.md` § Barreras). Only an idea, for the duals.

## Look and interface

**Matte is the whole look.** Everything else in a fight glows: fire, sparks, the astral, the
ecos. The powder is the one thing that does not: dry, opaque, lit by the place's light and nothing
else, with no bloom and no shine. It reads at once because it is the only effect that looks like
matter. On the GPU particle engine (`src/powder-fx.ts`, `docs/graphics.md`); seen in the effects
lab (`just dev-fx`, *Polvo de colores*) and in `just screenshots polvo-fx`. How Empolvado and its
three exits show, beat by beat: [`../README.md`](../README.md) § Empolvado.

- **Colours** (Aitor 2026-11-20: different colours, which do nothing; not saturated, mixed,
  matte): an earth palette, each colour as a pigment looks dry and in daylight: terracotta,
  mustard, sage, dusty teal, slate blue, brick. **Every puff mixes two or three of them**, so no
  puff is one flat colour and no two are alike. Never saturated pink or violet
  (`docs/visual-style.md`). In the first round the powder is grey, the grey of the Luca the party
  meets (to confirm, § Open).
- **On the wearer** (built, `src/anima-looks.ts`; the recolour in `CLASSES`: a dark blue jacket,
  cream, grey trousers): **cloth pouches of pigment at the belt**, one a colour, tied with cord,
  on the side and the back the fight's camera sees; patches of dry dust on the chest, the
  shoulders and the back; and nothing in the hands: every skill is thrown. Luca's binoculars hang
  from the neck (§ In the world). The pigments keep a little of their own colour in a night
  fight, so they still read as colours there.
- **The skills**:
  - *Puñado*: a handful thrown; it crosses in a third of a second trailing grains and bursts on
    the foe in a puff the size of its body (dense core, jets, a haze that hangs, thousands of
    grains that settle on it and on the floor).
  - *Cortina*: a handful thrown upwards in front of the ally; it hangs there as a standing screen
    a body wide, churning slowly, grains falling from its foot. A blow goes through it and the
    whole screen bursts forward over whoever dealt it.
  - *Rociada*: a fan of fine water; where it meets powder the powder darkens and runs.
  - *Polvareda*: a handful for each foe, one after another, their puffs joining in one cloud.
  - *Telón*: a screen in front of each ally, thrown one after another.
  - *Traca*: five small puffs a tenth of a second apart on whoever each one finds, each a
    different mix and each with its own number.
  - *Fin de fiesta*: the dust explosion (§ Definitiva: Fin de fiesta): a matte cloud over every foe,
    a front of fire through it, a rain of burnt pigment, an arc and the shards, and a stain of every colour.
- **Interface** (built, `#hud[data-class="prismatico"]`): a pigment seller's tray. Flat matte swatches
  with a grain to them and a small label, no glow and no gradient; the selected block is a swatch
  with a thumbprint in it.

## In the world

- **Unlocked** at the end of Luca's mission, when his colours come back (`anima-luca`).
- **On trial inside the salon** (`docs/quests/luca.md` § Review, F; proposal): at the door Luca
  gives Gerard his old binoculars and the ánima wakes on trial with *Puñado* and *Cortina*. The
  salon is where it is learned: **the light that walks through the nave eats the party's element
  of its colour**, so which of the powder's three exits is open depends on where the light stands.
  Red light, no explosion; gold, no crystal; blue, no poison.
- Whether Gerard or Aitor wears it is the players' choice. With Aitor (PV, Defensa) in front and
  Gerard (Matemágico, the elements) deciding, it is at its plainest.

## Second round

Open, with the mission's ([`docs/quests/luca.md`](../../quests/luca.md) § Second round). What it
gives the ánima: its colours (§ Look and interface).

## Implementation

**Built in the game** (2026-11-20 and 21; `tests/powder.test.mjs`, `just screenshots prismatico
--gpu`):

- The wearable ánima (`prismatico` in `ClassId`, named Colorista; `CLASS_STATS`, `CLASSES`), in
  `LEVELLED` (`src/levels.ts`): seven levels, each with its flag (`prismatico-2` … `-7`) and its
  step in the picker's arc *Colorista crece*.
- **Empolvado and its three reactions** (`powder`, `POWDER_RULES` in `src/battle.ts`; the
  simulator's book `powder`): Estallido with its chain and a level of Quemado for everyone,
  Envenenado (pulses, and every blow a quarter harder), Cristalizado (each blow 4 more than the
  last, up to 20). Set off by Atacar with an element, a skill of that element on one foe or on
  all, Foc Binari, and a dual with one. Each blow says what it added (*Veneno +25 %*,
  *Esquirlas +4*).
- **The cortina** (`CORTINA`, `cortinaRounds`, inside `changeHealth`): half of the next blow, three
  rounds, pulses pass, Defender's third on top; its icon on the ally's plate. ***Rebufo***
  (`ANIMA_RULES`) on whoever breaks it.
- **The skills** (`SKILLS`): *Puñado*, *Cortina* (`screen: 'one'`), *Rociada* (water of its own:
  it does not wet, it poisons powder), *Polvareda* (`powders`), *Telón* (`screen: 'all'`), *Traca*
  (`volley: 5`: five blows on foes picked on the fight's dice). Level 4 is Maná +1.
- **The passive** *Remolino* (`PASSIVES`, `level: 5`): the first passive a level teaches by itself
  (`passivesAt` in `src/levels.ts`; the level-up shows *PASIVA NUEVA*, the Ánimas page lists it).
- **The definitiva** *Fin de fiesta* (`ulti` in `SKILLS`, `finaleReady`): the first one built. The
  jar unveils an ánima's definitiva when a skill with `ulti` exists for it (`src/ecos.ts`).
- **In the fight** (`src/powder-fx.ts`, from `src/battle-scene.ts`; all on the GPU): the handful
  thrown, the powder that stays on whoever is Empolvado, the explosion, the powder running green,
  the shards and the splinters a blow knocks out, the cortina standing and bursting over whoever
  breaks it, Rociada's fan of water, Traca's puffs, Fin de fiesta's dust explosion (`fiesta`, with
  `deflagrate` from `src/deflagrate.ts`; `scripts/screenshots/fin-de-fiesta.json`). A cortina in the
  scene follows the fight's state, so one raised by Remolino or lost to its three rounds shows too.
- **On the wearer and in the interface**: § Look and interface.
- **Reach**: the fight tester plays every level (`?story=prismatico-7`, or `levels` in a `fight`)
  and the definitiva (`improved: ['prismatico:definitiva']`); the effects lab's section *Polvo de
  colores* has a button for each effect (`scripts/screenshots/polvo-fx.json`).
- The dual *Reserva de color* (Foc Binari + Puñado), built before these rounds: its fuse still
  shows as a stroke of paint.

`ANIMAS.luca` is the friend's light, with a placeholder bonus.

**Not built**:

- **The trial inside the salon** (the light that eats an element is the mission's to build).
- **Grey in the first round**: the lab has it; the fight always throws the colours.
- Empolvado's and Cristalizado's place in the bestiary of looks (`src/status-fx.ts`).
- *Reserva de color*'s look and sentence, which still speak of paint (for the duals step).
- The castle's gate on definitivas, for every ánima.
- The simulator plays its skills by their numbers and does not know what a cortina or powder is
  worth (§ For the balance, later).

## For the balance, later

What to watch, now that it all plays (`just fight-sim`, book `powder`: `powder.rules.blast`,
`.splash`, `.poison`, `.shard`, `.shards`). No fight's targets hold it yet: no party in `TARGETS`
wears it.

The simulator on 2026-11-21 (`--party gerard:matemagico+aitor:prismatico --level prismatico=7
--policy smart`, banning each skill): against La Cebolla it wins in 3.15 rounds, and in **7.49
without *Traca***; no other ban moves either fight. Against Luca's *carta* it wins in 7.5 rounds
whatever is banned.

- ***Traca* on anything with layers**: each of its five puffs is a blow, so it peels five layers
  for 3 maná (Zarpazos peels four for 2, and Traca's fall on whoever the dice pick). It is what the first line above measures, and the
  number to settle first: fewer puffs, or a volley that peels one layer per foe.
- **The bot cannot value** a cortina, *Telón*, *Rociada* or *Polvareda*: it plays them as a boost
  and a light blow. Banning *Cortina* even leaves it with more PV against the *carta*.

- **Estallido in a chain**: three powdered foes and one fire are 22 + 11 + 11 = 44 on each, and a
  level of Quemado, for *Polvareda* (2 maná) and a blow that costs nothing. Against Conducción (20
  on every wet foe, after a 2-maná skill). The first number to lower is the half the others take.
- **Envenenado's quarter** on a boss, kept up all fight: with its own water the ánima needs nobody
  for it. Against *Ángulo exacto* (Defensa and Espíritu −3 for three rounds, about 3 a blow).
- **Cristalizado under a flurry**: 4, 8, 12, 16 and then 20 on every hit. Bombardeo orbital's
  three volleys (24 more), the ecos, Dadista's dice, *Traca* itself (five hits on one foe: 60
  more). The cap of 20 is the brake; the step of 4 is the first number to lower.
- **The largest single blow**: the powder adds no multiplier of its own. On a foe poisoned and
  crystallised at its cap, a blow of 50 with a golpe crítico is 50 × 1.5 × 1.25 + 20 = 114; Punto
  débil triples it before the shards, as on any blow (301).
- **The cortina for one maná**: half of an announced blow and Defensa +3 for three rounds, at
  level 1. Against *Corchete* (a third of every blow of the round on one ally, 1 die).
- **Remolino**: with one element a round, the wearer has a cortina every round for nothing.
- The simulator's `smart` policy has to learn the powder and the cortina before any target means
  anything.

## Open

Answered by Aitor on 2026-11-20: the name (Colorista), the crystal (it grows), *Rebufo* and its own
water (yes). What is left:

1. **How much the poison amplifies**: 25 % at any level, with the pulses climbing by level as
   Quemado's. For the balance.
2. **Grey in the first round?** He did not say; taken as the recommendation: grey in the first
   round, so the colours are what the second round gives back.
3. **The id**: `prismatico` in the code and this folder, as Dadista's is `dadaista`. Renaming it
   is a change across the whole game for no gain; left unless he asks.
