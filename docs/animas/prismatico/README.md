# Prismático

Status: designed again 2026-11-20, in Aitor's fifth round of that day: **no paint any more, only
the puff** (dry coloured powder, as at a Holi). Its mechanics are his; the skill list, the names
and every number are proposals waiting for his yes. In the game today, under their paint names:
the wearable ánima, *Brochazo*, *Pintado* (with no reactions) and the dual *Reserva de color*. The
powder's look is built in the effects lab · Comes from: Luca's mission,
[`docs/quests/luca.md`](../../quests/luca.md)

What is **decided** says so and by whom. Everything else is a proposal, and its numbers are first
guesses ([`../README.md`](../README.md) § Order of work).

**Decided by Aitor**

| When | What |
| --- | --- |
| 2026-11-16 | The name is **Prismático** (the prism idea has since gone to Marta's ánima: § Open) |
| 2026-11-20 | It is **more of a tank, a protector**. The dynamic and the idea: **protection and changes of state** |
| 2026-11-20 | **No paint: the puff.** Dry powder thrown by the handful, as at a Holi. Everything is named after it |
| 2026-11-20 | The powder on a foe **does nothing by itself; it waits for an element** |
| 2026-11-20 | **Water** on the powder **poisons**: the foe takes damage over time, and **the physical and magic damage it receives is amplified** while the poison lasts |
| 2026-11-20 | **Fire** on the powder **explodes**: damage, and **every foe burns one level more** |
| 2026-11-20 | **Electricity** leaves the powder **crystalline**: a new status that lasts a time, in which **every attack it receives does a certain amount more**, because the shards dig in |
| 2026-11-20 | **Protective spells**: they **raise everyone's Defensa** and stand **a shield of particles in front** that **halves the next attack**. The first protects one, the second both. *Lienzo* and *Barniz* are out |
| 2026-11-20 | The puffs come in **different colours, which do nothing**: not saturated, **mixed and matte** |

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
  an extra slot. Seven levels by EXP. On trial inside the salon: § In the world.
- **Motto** (built): *"El color se queda en las manos."*
- **Colour** (built, to confirm): a dusty blue, `#617ce2`.

## Role

**The party's screen: it halves the blow that matters, and whoever breaks through it comes away
covered in powder for an element to finish.**

| | Prismático | Papagato | Matemágico | Tecnópata | Dadista | Sincopante |
| --- | --- | --- | --- | --- | --- | --- |
| Hurts with | Light physical blows; the damage is in what the powder becomes | Physical blows | Magic, with elements | Magic, clocks | Physical faces; the astral, by luck | The astral, through ecos |
| Its resource | **Empolvado on the foe**, part of it laid by being hit | Sangrado on the foe | Elements and their statuses | Clock statuses | Crítico (the Racha) | Ecos on its own side |
| Pays off as | An element on the powder: **Estallido** (fire), **Envenenado** (water), **Cristalizado** (electricity) | A golpe crítico on the wound | A reaction between elements | Longer clocks, control | Críticos, Dados astrales | Ecos raised, Tutti |

- **Good at**: the big announced blow (a screen is half of it, for one maná); making the party's
  own blows count for more (a poisoned foe takes a quarter more, a crystallised one a fixed amount
  more on every hit); fights with several foes (one fire sets off every powdered one).
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

Its rule, there from level 1 (`ANIMA_RULES`; what shows it is the screen itself, standing in front
of the ally, and its icon on their plate):

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
   | Electricity | **Cristalizado** | 20 s in which **every blow that foe receives does 8 more**: the shards dig in |

3. **The change raises the screen again** (level 5, *Remolino*): each time a foe's powder turns
   into something, a cortina stands in front of the wearer. So the screen, the powder and the
   element feed one another, as long as the party keeps an element coming.

Empolvado, its three reactions and the cortina are shared rules, by kind and never by ánima: any
fire blows powder up, whoever threw it. They are defined, with how each one shows, in
[`../README.md`](../README.md) § Shared mechanics.

### The cortina (the protective spell)

Aitor's, 2026-11-20: a physical shield of particles in front of an ally that halves the next
attack. What the design adds is marked as a proposal.

- **The next damage a blow does to that ally is halved, and the cortina breaks.** One blow, one
  cortina: of a flurry it stops the first. Pulses (Quemado, a poison) pass through and do not
  break it. Halved first, then Defender's or a protection's third, if there is one.
- It stands **until a blow breaks it, or three rounds** (proposal: the same clock as the Defensa
  it comes with). One on each fighter; raised again, it starts over.
- A blow on everyone breaks each cortina it meets and is halved for whoever stood behind one.
- **The other dynamic** (proposal, § Open): ***Rebufo***, the ánima's rule. The cortina is powder,
  so it does not just vanish: it bursts over whoever broke it and leaves them Empolvado. The
  protection is also how the ánima builds its resource, and a foe has a reason to think twice
  about which of the two it strikes.

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
partner's element part of the defence. One reaction, one cortina: a round with two reactions does
not raise two.

## Skills per level

Seven levels ([`../README.md`](../README.md) § Levels). Numbers are first guesses: "Base" is the
power, against Atacar's 18. Everything is done by the wearer.

| Level | What it gives | Who | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rule · **Rebufo** | The wearer | — | — | `Quien rompe una cortina de polvo queda empolvado.` | Designed |
| 1 | **Puñado** | The wearer | 1 | 16 | `Daño físico leve a un enemigo. Lo empolva durante 20 segundos.` | Built as *Brochazo* (`Lo pinta durante 20 segundos.`) |
| 1 | **Cortina** | The wearer | 1 | +3 | `Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba un aliado.` | Designed |
| 2 | **Rociada** | The wearer | 2 | 14 | `Daño mágico de agua leve a todos los enemigos.` | Designed |
| 3 | **Polvareda** | The wearer | 2 | 12 | `Daño físico leve a todos los enemigos. Los empolva durante 20 segundos.` | Designed |
| 4 | **Maná +1** | — | — | — | — | Designed |
| 5 | Passive · **Remolino** | The wearer | — | — | `Cuando el polvo de un enemigo reacciona, se levanta una cortina ante quien la lleva.` | Designed |
| 6 | **Telón** | The wearer | 2 | +3 | `Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba cada aliado.` | Designed |
| 7 | **Traca** | The wearer | 3 | 10 × 5 | `Daño físico leve a enemigos al azar. Golpea cinco veces. Los empolva durante 20 segundos.` | Designed |
| Definitiva | ***Fin de fiesta*** | The wearer | — | — | *Abstract*: `Empolva a todos los enemigos. Su polvo estalla, envenena y cristaliza a la vez.` | Designed |

**What `AGENTS.md`'s shape has no word for**:

- **Cortina** raises a stat of the whole party and also picks one ally, so its first sentence
  names a target (`de todo el equipo`) that is not the one the player chooses. The test reads the
  target from the skill's `side`; it needs to let a boost name the party while its `side` is one
  ally. The second sentence follows *Sutura de luz*'s (`Reduce a la mitad el siguiente daño que
  reciba esta ronda.`).
- `Lo empolva durante 20 segundos.` is the built `Lo pinta durante 20 segundos.` with its verb
  changed; `Golpea cinco veces.` follows *Bombardeo orbital*'s.
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
- **Traca** spends and builds at once: five light blows, each of them 8 stronger on a crystallised
  foe and a quarter stronger on a poisoned one, and every foe it touches is powdered again. Its
  one way of hurting, and it only hurts on what the party has prepared.

## Definitiva: Fin de fiesta

| | |
| --- | --- |
| **Wakes in a fight when** | The powder has been all three things in that fight, while the ánima was worn: an Estallido, an Envenenado and a Cristalizado. Each is seen as it happens |
| **Then** | Once in that fight, for the turn and no maná |
| **In the game** | *Abstract*: `Empolva a todos los enemigos. Su polvo estalla, envenena y cristaliza a la vez.` |

Three puffs over every foe, one after another, and each takes its exit at once: the explosion's
damage and a level of Quemado, Envenenado I (or a level more on whoever was poisoned), and
Cristalizado. It kills nobody by itself: it leaves the whole field burning, poisoned and full of
shards for the round that follows, which is the ánima in one move.

Close to Matemágico's condition (three different reactions between elements); the powder's three
count for his too. To settle at the duals and balance steps.

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
| 3 · Aitor | *Rociada* (2 maná) | 14 on A and C, **22 on B** (the shards). A **Envenenado I**: from now on every blow on A lands 25 % harder |
| 3 · Foes | A, B and C strike | Whoever hits Aitor first does 8 and is Empolvado |

Three rounds and the three exits. Aitor has lost about 64 PV of 135 and Gerard 32, against 72
each with no ánima of this kind, and from round 4 every blow on A and B counts for more. Aitor is
out of maná: round 4 is Defender (2 back), or a change of ánima.

## What it offers a dual

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
- **On the wearer** (proposal; the recolour in `CLASSES` is built: a dark blue jacket, cream,
  grey trousers): the clothes of someone who has been at it all day, dusted from the hands up to
  the elbows and across the chest in the palette's colours. On the rig (`src/anima-looks.ts`):
  **cloth pouches of pigment at the belt**, one a colour, and nothing in the hands: every skill is
  thrown. Luca's binoculars hang from the neck (§ In the world).
- **The skills**:
  - *Puñado*: a handful thrown; it crosses in a third of a second trailing grains and bursts on
    the foe in a puff the size of its body (dense core, jets, a haze that hangs, thousands of
    grains that settle on it and on the floor).
  - *Cortina*: a handful thrown upwards in front of the ally; it hangs there as a standing screen
    a body wide, churning slowly, grains falling from its foot. A blow goes through it and the
    whole screen bursts forward over whoever dealt it.
  - *Rociada*: a fan of fine water; where it meets powder the powder darkens and runs.
  - *Polvareda*: a handful for each foe, one after another, their puffs joining in one cloud.
  - *Telón*: one long screen across the whole party.
  - *Traca*: five small puffs that go off along the foes' line a tenth of a second apart, each a
    different mix.
  - *Fin de fiesta*: three puffs over every foe; fire, water and a spark through them in turn.
- **Interface** (`#hud[data-class="prismatico"]`): a pigment seller's tray. Flat matte swatches
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

**Built in the game** (under the paint names): the wearable ánima (`prismatico` in `ClassId`,
`CLASS_STATS`, `CLASSES`), *Brochazo*, *Pintado* (20 s, no reactions) and the delayed fuse of
*Reserva de color*. `ANIMAS.luca` is the friend's light, with a placeholder bonus.

**Built for the look** (`src/powder-fx.ts`, the effects lab's section *Polvo de colores*,
`scripts/screenshots/polvo-fx.json`): the puff, the thrown handful, a foe covered in powder, the
explosion that leaves everyone burning, water that turns the powder to poison, and the cortina
standing and breaking. Not built: the crystal's look.

**Systems it needs that the game does not have**:

- **Powder's three reactions** in `react`: today an element only finds Quemado, Mojado, Sangrado
  and Cegado.
- **Envenenado** and **Cristalizado** as statuses that change the damage of the blows that land:
  one place every blow on a fighter goes through, as a golpe crítico's and a wound's bonus have.
  Envenenado's look is ready (`STATUS_LOOKS.envenenado`) and has no rule.
- **The cortina**: *Sutura de luz* already halves the next damage of a round; the cortina is that
  rule lasting until it is used, with a status on the plate, and *Rebufo* on whoever uses it up.
- **The definitiva's waking**, missing for every ánima.

**To build, once the design has a yes** ([`../README.md`](../README.md) § How an ánima is built):

1. The names: *Brochazo* to *Puñado*, *Pintado* to *Empolvado* (ids, sentences, the dual's text),
   and the ánima's own if it changes.
2. The shared rules, each with its tests and in `just fight-sim`: Empolvado's reactions
   (Estallido with its chain, Envenenado, Cristalizado).
3. The cortina and *Rebufo*; *Cortina* at level 1, with the sentence's allowance in
   `tests/battle.test.mjs` and `AGENTS.md`.
4. `ANIMA_RULES`, `SKILLS` (levels 2 and 3), `LEVELLED`.
5. The looks in the fight, from the lab: each skill, Empolvado on the plate and on the body,
   Cristalizado.
6. `src/anima-looks.ts` (the pouches, the dust on the clothes); the theme in `src/style.css`.
7. Unlock at the mission's end; the trial inside the salon.
8. The fight tester and the picker reaching every level and skill; the sheet scenario
   `scripts/screenshots/prismatico.json`; `docs/party.md`.
9. Levels 4 to 7, then Fin de fiesta with the definitivas.

## For the balance, later

Nothing to measure yet. What to watch once it plays:

- **Estallido in a chain**: three powdered foes and one fire are 22 + 11 + 11 = 44 on each, and a
  level of Quemado, for *Polvareda* (2 maná) and a blow that costs nothing. Against Conducción (20
  on every wet foe, after a 2-maná skill). The first number to lower is the half the others take.
- **Envenenado's quarter** on a boss, kept up all fight: with its own water the ánima needs nobody
  for it. Against *Ángulo exacto* (Defensa and Espíritu −3 for three rounds, about 3 a blow).
- **Cristalizado under a flurry**: 8 on every hit. Bombardeo orbital's three volleys, the ecos,
  Dadista's dice, *Traca* itself (five hits: 40 more). If it runs away, a cap on the hits it
  counts, or shards that are spent.
- **The largest single blow**: the powder adds no multiplier of its own. On a foe poisoned and
  crystallised, a blow of 50 with a golpe crítico is 50 × (1 + 0.25 + 0.5) + 8 = 96; Punto débil
  triples it before the shards, as on any blow (271).
- **The cortina for one maná**: half of an announced blow and Defensa +3 for three rounds, at
  level 1. Against *Corchete* (a third of every blow of the round on one ally, 1 die).
- **Remolino**: with one element a round, the wearer has a cortina every round for nothing.
- The simulator's `smart` policy has to learn the powder before any target means anything.

## Open

1. **The name.** Prismático was for prisms and binoculars; the prism has gone to Marta's ánima
   and this one is powder. Recommendation: **Polvorista** (who makes powder and fireworks; it
   sits with Dadista and Sincopante). Others: *Polvorín*, or keeping Prismático for the
   binoculars Luca hands over. The id `prismatico` and the docs keep the old name until he says.
2. **The crystal: a fixed amount on every blow, or one that grows?** Read here as fixed (+8 on
   every blow received while it lasts), which is what makes it different from the poison: the
   poison is for whoever hits hard, the crystal for whoever hits often. The other reading: each
   blow received adds to the next (+4, +8, +12…). Recommendation: fixed; it is read at a glance
   and has no count to follow.
3. **How much the poison amplifies**: 25 % at any level, with the pulses climbing by level as
   Quemado's. Recommendation: that, until the balance.
4. **The other dynamic of the cortina**: *Rebufo* (whoever breaks it is Empolvado).
   Recommendation: yes; it is what makes the protection part of the powder and not a second
   ánima beside it. The alternative, a cortina that an element turns into something else, is
   kept for the duals.
5. **Its own water** (*Rociada*): the ánima can poison alone, and needs someone else for fire and
   electricity. Recommendation: yes; with none of its own, a party without elements would throw
   powder for nothing.
6. **Grey in the first round?** The muted mix is already half-way to grey. Recommendation: grey
   in the first round all the same, so the colours are what the second round gives back.
