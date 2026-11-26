# Papagato

Status: **playable whole** (2026-11-21), as **redesigned 2026-11-20** round physical blows, Sangrado
and golpes críticos (Aitor's direction). **Built**: the golpe crítico and its look, Crítico on the
sheet, cuts that pile up and fade slowly, liquid blood, the new Ronroneo, Zarpazos that cuts; seven
levels (Maná +1 at 4, Olor a sangre at 5, Acecho at 6, Cacería at 7); and its definitiva, Siete
vidas. Yuki se esconde and Las dos a la vez are out · Comes from: Nuria's mission,
[`docs/quests/nuria.md`](../../quests/nuria.md)

What is **decided** says so and by whom. Everything else is a proposal with its numbers as first
guesses: the balance comes after every ánima and every dual is designed (`../README.md` § Order of
work).

## Identity

- **Papagato** (cat dad): Gerard and the cats he shared with Nuria when they lived together,
  **Haru** and **Yuki**. Whoever wears it does not fight alone: Haru opens the wound, the party
  strikes where it already hurts, Yuki keeps them alive.
- **What it feels like to wear**: a hunt. Two or three small cuts, then one blow that lands on all
  of them at once and stops the fight for an instant.
- Unlocked at the start of Nuria's mission, when she lends the cats; kept for good only when the
  mission is won (then the cats live in the Meridiana flat too).
- Motto: *"Nunca va solo. Haru y Yuki van con él."* (built). Proposal for the new direction:
  *"Primero la herida. Después, donde duele."*
- Colour: warm orange `#f0954a` (built). Grey in the first round is _open_ with the second round.
- **The cats are not controlled.** They sit beside whoever wears Papagato, in the street and in
  fights, and **every skill, and everything it learns as it levels, is something Haru or Yuki
  does** (decided). **Haru** (tricolour, female) is the bold one: she attacks. **Yuki** (white,
  female) is the fearful one: she hides, warns, protects.
- Register (`AGENTS.md` § Game philosophy; `docs/quests/nuria.md` asked for this check): the cats
  stay, as animals that hunt. No mascot framing: Haru draws blood, and a critical blow is violent
  on screen.

## Role

**The party's physical damage, by setting up one blow.** Next to the others:

| | Papagato | Matemágico | Tecnópata | Dadista |
| --- | --- | --- | --- | --- |
| Hurts with | Physical blows | Magic, elements | Magic, clocks | Physical, by the die |
| Its resource on the foe | **Sangrado** (stacks, rounds) | Quemado, Mojado (clocks) | Clock statuses | Punto débil, Sangrado |
| Pays off as | **A golpe crítico** on the wound | A reaction between elements | Longer clocks, control | Golpes críticos by luck, then a rain |

- **Good at**: one foe at a time; bosses with a lot of PV (a wound that is kept open hurts every
  round whatever their Defensa); making **everyone's** physical blows better (its passive covers the
  whole party, so Aitor's Fuerza is its best friend); peeling what is in layers (Zarpazos).
- **Bad at**: magic (none); many small foes at once (nothing reaches them all until Cacería, at
  level 7); cover (none: Yuki cures and saves, she shields nobody); anything that resists physical
  blows; fights that punish switching, because the wound only pays
  while Papagato is being worn.
- **How it changes a fight**: it adds a second number to watch on a foe, the wound, and a decision
  every turn: **open it further, or cash it in now**.

## Stats

- **Built** (2026-11-20, lowered 2026-11-24): **Fuerza +1, Crítico +10 %, Espíritu −1** (`CLASS_STATS`):
  the claws hit hard and find the soft spot, and magic gets through to whoever wears it. It was
  Fuerza +2 and Crítico +15 % until Aitor found the ánima overpowered (2026-11-24).
- **Crítico is an attribute** (decided by Aitor 2026-11-20): the chance that a blow is a golpe
  crítico (`../README.md` § Golpe crítico; `Stats.critico`, `PARTY_CRIT` in `src/stats.ts`). 5 % for
  everyone in the party; Papagato adds to it; foes have none.
- Papagato no longer gives Velocidad (removed as a stat, `docs/combat.md` § Sin Velocidad).
- Nuria's light (`ANIMAS`) gives its own party bonus, separate.

## Signature: the wound and the golpe crítico

Three shared rules, used together (`../README.md` § Shared mechanics): **physical blows**,
**Sangrado** and the **golpe crítico**.

1. **Haru opens the wound.** Her claws add Sangrado stacks to a foe, and they pile up. While they
   are there they hurt at the end of every round, 2 PV a stack, Defensa or not.
2. **The next physical blow that adds none spends the wound**, 20 % harder for each stack.
   Anyone's: Atacar, a partner's blow, a dual. That extra damage is all the wound gives at first.
3. **Any blow can be a golpe crítico**, by the Crítico of whoever lands it (15 % on Papagato):
   half as hard again on top, the number large, the fight frozen for an instant.
4. **From level 5 the two meet** (*Olor a sangre*): whoever bleeds is hit critically more often,
   and a wound of five stacks or more, spent, is always a golpe crítico. That is what wakes Siete
   vidas.

So a turn is one of two things: **cut** (Zarpazo sangriento: the wound grows) or **cash in**
(Atacar for free, Zarpa en la llaga for twice the wound, Acecho, the partner's best blow). Both of
Haru's small attacks cut: Zarpazo sangriento deep (two stacks), Zarpazos wide (two claws, two
rolls of Crítico, one stack).

**Cuts pile up** (decided by Aitor 2026-11-20, replacing the rule of 2026-11-05 that a skill that
adds Sangrado spent the old stacks first): **a physical blow that adds Sangrado never spends it,
it piles its own on top; a physical blow that adds none spends it all.** So a wound is built on
purpose, up to 10 stacks, and it is spent by choice. Dadista's Tijeras follows the same rule.
Built (`wound`, `cut` in `src/battle.ts`).

**The blood goes little by little, and lasts** (Aitor 2026-11-20; he will tune it playing). First
guess: **a wound loses one stack at the end of a round in which nobody cut it**, and none while it
is being cut. So a wound that is looked after only grows, and one left alone takes as many rounds
to close as it has stacks. Built (`cutRound`, `nextRound`).

### Passives

| Passive | When | What it does |
| --- | --- | --- |
| **Olor a sangre** | Level 5 | `Los golpes a un enemigo que sangra tienen un 20 % más de Crítico. Gastar una herida de cinco cargas o más es siempre un golpe crítico.` Aitor 2026-11-20. |

- **One passive, and not from the start** (Aitor 2026-11-20: an ánima does not need a passive of
  its own from level 1). Up to level 4 the wound gives its extra damage and nothing else, and a
  crítico comes only from the Crítico attribute. Olor a sangre is what the ánima grows into.
- **By example.** Gerard on Papagato has Crítico 15 % (5 and the ánima's 10); Aitor beside him,
  5 %. With Olor a sangre, on a foe that bleeds, with one stack or with nine, Gerard's blows are
  críticos 35 % of the times and Aitor's 25 %, whatever the blow: a cut, Atacar, Foc Binari.
  Spending a wound of two stacks is that roll. Spending one of **five or more** is no roll at all:
  it is a crítico. So the party cuts up to five and then picks who lands the blow.
- **It covers the whole party**, not only the wearer: Aitor's Atacar on a wound Haru opened gets
  the 20 % and, at five, the sure crítico; so does a dual. By kind of blow, never by ánima
  (`AGENTS.md`). Fire that cauterizes a wound closes it and is never a crítico.
- **It holds while Papagato is worn by someone standing.** Switch to another ánima and the cats
  leave in their puff of smoke: the wound stays on the foe, but it gives no Crítico and five
  stacks promise nothing. Against the maná rule that rewards switching (each ánima in reserve
  gets 1 back whenever its wearer acts), that is the ánima's own tension: stay on Papagato to cash in, or leave to refill.
- **How five reads**, once it has the passive: the Sangrado chip under the foe's plate changes at
  five (larger, pulsing red), with no number or text added: the wound is open. The fight says
  *PASIVA · Olor a sangre* over the wearer when it gives a crítico (`../README.md` § The jar).
- Two passives it has had and lost today: *Instinto* (every blow that spends Sangrado a crítico:
  nothing left to build towards) and *Saña* (a crítico adds a stack).

## Skills per level

Seven levels, by EXP from fights won wearing it (`../README.md` § Levels), all built as they are
here (4 to 7 on 2026-11-21). Cost is in maná (3 from the start, 4 from level 4).

| Level | What it gives | Cat | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Zarpazo sangriento** | Haru | 1 | 16 physical, Sangrado +2 | `Daño físico leve a un enemigo. Añade sangrado.` | Built |
| 2 | **Zarpazos** | Haru | 2 | 9 physical, two claws, Sangrado +1 | `Daño físico leve a un enemigo. Golpea dos veces. Añade sangrado.` | Built |
| 2 | **Ronroneo** | Yuki | 2 | 16 heal at once and Sanación for 15 s, one ally; cleanses their mental statuses | `Cura leve a un aliado herido. Sigue curándolo poco a poco durante 15 segundos. Quita sus efectos de estado mentales.` | Built |
| 3 | **Zarpa en la llaga** | Haru | 2 | 26 physical; the wound counts double | `Daño físico medio a un enemigo. Gasta el sangrado: cada uno suma el doble de daño.` | Built |
| 4 | **Maná +1** | — | — | 3 → 4 | — | Built |
| 5 | Passive · **Olor a sangre** | Haru | — | Crítico +20 % on whoever bleeds; sure at five stacks | `Los golpes a un enemigo que sangra tienen un 20 % más de Crítico. Gastar una herida de cinco cargas o más es siempre un golpe crítico.` | Built (`SCENT`) |
| 6 | **Acecho** | Haru | 2 | 38 physical, lands as the next round starts | `Daño físico alto a un enemigo. Se carga un turno y sale al empezar el siguiente. Golpe crítico seguro.` | Built |
| 7 | **Cacería** | Both | 3 | 10 physical a claw, one claw a stack on the field | `Daño físico leve a todos los enemigos. Golpea una vez por cada sangrado que haya en el campo, repartido entre quienes sangran. Gasta el sangrado.` | Built |

- **No cat in a skill's name** (Aitor 2026-11-20): *Ronroneo*, not *Ronroneo de Yuki*. The *Cat*
  column says who does it on screen; the game's text does not.
- **Level 1 is one skill**: Zarpazo sangriento to cut and Atacar, free, to cash in. The loop is
  learned with those two before anything else arrives.
- **Zarpazo sangriento** is the cut: cheap, two stacks each, so the third one takes a wound past
  five. It is also Punto débil's half.
- **Ronroneo** (new form, Aitor 2026-11-20): Yuki settles on **one** ally and purrs. A light
  cure at once and the rest bit by bit on the fight's clock (*Sanación*, the timed status Rayo de
  sanación already lays: 15 s, a pulse every 3 s), and that ally's mental statuses go
  (`cleanse: 'mental'`). About 36 PV in all for 2 maná, against Cardioide's 30 at once. It was a
  cure for the whole party: Nuria's tower leaned on that against the onions' tears on both, which
  the balance has to look at again.
- **Cut** (Aitor 2026-11-20, *no les veo mucho sentido*): **Yuki se esconde** (Defensa for the
  party) and **Las dos a la vez** (a blow on every foe with a stack each). Neither cuts deeper nor
  cashes in. Nothing replaces them: Papagato has fewer skills and every one is part of the wound.
- **Zarpazos** is why Papagato has to grow in Nuria's mission: each little claw strips a layer off
  a big onion (`../../quests/nuria.md` § Monsters). Its description leaves the layers out on
  purpose. It is a cut too, a wide one (changed 2026-11-20 for the ánima to hold together: as a
  blow that spent the wound, its first small claw threw the whole of it away): two claws, each
  with its own roll of Crítico, and one stack. It had four claws of 7 until 2026-11-24 (Aitor: too
  strong).
- **Zarpa en la llaga** is the big way to cash in: each stack counts double (+40 %), and with Olor
  a sangre on a wound of five or more it is a sure crítico.
- **Acecho** (new): Haru crouches, and nothing happens this turn. As the next round starts, before
  anyone chooses, she lands a high blow that is a crítico whatever the foe has, and spends its
  wound if it has one. It is the plan made visible: the partner cuts this round, Haru collects.
  Charges as Rayo solar does, on its own (`stalk` on the wearer, `pounce` as the round starts, kept
  as news). If the wearer falls or takes Papagato off first, it is lost; if the prey falls first,
  she takes whoever standing bleeds most. Built: the wound it spends is the one left after the
  round's end (a wound nobody cut loses a stack then). On screen (Aitor 2026-11-21) the dark pools under Haru
  and she sinks into it, her eyes flaring red, and is gone; only the slit cat's eye on the wearer's
  plate says she is out there. As the round starts the dark wells up behind the prey (on the
  camera's side), two red eyes light in it, she rises out of it and turns her face to the camera, eyes
  burning red, holds that look a beat, turns back, springs onto its back and lands hard; then she melts into the dark and comes out of it at her place (`ACECHO` in
  `src/battle-scene.ts`, `glare` in `src/cats.ts`, the `umbra` and `glare` particles).
- **Cacería** (new): the whole field's blood at once. One claw for each stack on any foe, shared
  among those bleeding, none with the wound's bonus (the count already is the bonus). The claws on
  a foe whose wound was five or more are críticos (it comes after Olor a sangre); the rest roll. Ten stacks on the field are ten claws. Costs the whole base pool, so it is
  prepared, and its many small claws also peel layers. Built: each foe takes as many claws as it
  has stacks (its own wound, not the field's shared out at random), one foe after another; it
  only reaches whoever bleeds, so with no blood on the field it has nobody to aim at (*Sin
  objetivo*), and its list says *Quienes sangran*. On screen both cats go from claw to claw, Haru
  the even ones and Yuki the odd ones, and each foe's first claw bursts the blood it held.

## Definitiva: Siete vidas

Bought at the jar once the castle's second boss falls (`../README.md` § Definitivas). Aitor's
idea (2026-11-20): it guards against a killing blow, and that blow gives life instead; and both
cats do something.

| | |
| --- | --- |
| **Wakes in a fight when** | A wound of five stacks or more is spent (with Olor a sangre, always a golpe crítico: no luck in it) |
| **Then** | Once in that fight, una habilidad de quien la lleva: for the turn and no maná |
| **Haru** | Goes through every foe: light physical damage to each (14) and Sangrado +2 |
| **Yuki** | Walks among the party: the next blow that would kill someone does not, it cures them what it was going to take |
| **In the game** | `Daño físico leve a todos los enemigos. Añade sangrado. El próximo golpe que fuera a matar a alguien del equipo no lo mata: lo cura.` |

- **Yuki's half holds** until that blow comes, to the end of the fight if need be. One blow,
  whoever it falls on; then it is spent.
- **How it reads**: a continuous status icon on every ally's plate while it holds (a clock-style
  icon, as every fight's own mechanic has). When it goes off, the golpe crítico's freeze, the other
  way round: the fight stops on the killing blow, Yuki is there in front of it, and the number
  that was coming in red turns over into a cure, green and large. *¡Siete vidas!* over it.
- **Haru's half starts the next wound**: every foe is left bleeding, so the turn it costs is not a
  turn without hurting.
- **Laid by hand, not automatic**: choosing the turn is the decision (before the boss's named
  blow, which its plate announces). Automatic, it would only be a second life bar.
- A blow that takes 80 from someone with 30 PV left leaves them at 110, never over their PV. Any
  damage that would kill counts, a status's pulse too. A blow on everyone saves the first it would
  have killed.
- **Built** (2026-11-21): `siete-vidas` in `SKILLS` (`ulti`, `node`, `lives`), its node at the jar
  unveiled by it (2 ecos); `wakeLives` from every blow that spends a wound of five or more while
  someone standing wears Papagato (a cut never does, nor fire that cauterizes); `livesReady` lists
  it at the head of the wearer's skills, once. Its claws land one after another (`hunt`), and the
  ward is one object on every ally (`LivesWard`): `changeHealth` spends it on the first blow, pulse
  or round's tick that would kill any of them, and the fight shows it as `effect.lives` (or
  `saved` on the pulse or the tick). The look as written above: Yuki walks among the party with a
  ring of her white at each one's feet, the cat's-head icon on every plate while it holds, and when
  it goes off she dashes in front of whoever it saves, the fight stops on the blow, the picture
  drains but round them, and the red number turns over into the green cure (*¡Siete vidas!*).
- **Its own look** (Aitor 2026-11-25, «rebobinado y siluetas»; built 2026-11-26, `src/lives-fx.ts`). Where Yuki
  sits at each one's feet she leaves her silhouette: some 300 specks of bone white on her own surface as she sits
  (`writeSurface`, src/surface-samples.ts), born on that cloud (`points` on the GPU engine), with an edge of green.
  While the ward holds they breathe, a new cloud on the same points every 1.6 s that comes up and goes. When it
  saves someone the killing blow lands, its blood flung out along it, and the fight plays it back: the GPU
  engine's `rewind` (a band that keeps where each particle was born and where it was a moment after) runs the
  blood back into the wound, the tape speeding up, and there it turns into Yuki's white thread rising off them;
  their silhouette leaps in front of them and bursts into green motes, and the others come apart. Its sound is
  the blow played backwards, a low purr and a rising cure (`siete-vidas-salva`). Screenshots:
  `just screenshots siete-vidas --gpu`.
- **Multi-hit duals** (Aitor 2026-11-25): a dual of many hits, whatever its kind, spends a wound only with its
  first hit on each foe, as Cacería does (`multiHit` in `src/battle.ts`): Campana de Gauss's dice, Corriente
  alterna's blow and beats, Géiser's blows, the claws of Zarpazos de fuego and Cadáver exquisito, Bombardeo
  orbital's three strikes. That hit lands the wound's bonus, and at five the sure crítico that wakes Siete vidas;
  the rest land plain. A hit La Voz's song swallows spends nothing. A dual of one blow spends it only if it is
  physical, as any blow.
- **In `just fight-sim`** (2026-11-26): the bot values the ward (`LIVES_WORTH` for each ally the next blow would
  bring down, `LIVES_IDLE` otherwise) and, in a boss's fight only, waking it: a wound cut towards five and the
  blow that spends it each a step of it, a wound spent short a step back (not one that went with its foe), the
  whole worth what casting it would do plus a life (`LIVES_LIFE`). Held by `reina-con-siete-vidas` against
  `reina-sin-custodia` in the Queen's first fight: woken in about half of them, the ward taking a killing blow a
  third of the times, and she needs two rounds more to bring the party down (13.2 rounds against 11.1). It costs
  the other boss fights a little (`livesAtStake` in `src/battle-sim.ts` has the numbers).

## What a round looks like

Gerard on Papagato (Fuerza 13 and Crítico 20 % with the proposed stats), Aitor beside him, a foe of
Defensa 10, numbers before any balance:

| Turn | Does | On the foe |
| --- | --- | --- |
| 1 · Gerard | Zarpazo sangriento: 19, and one time in five a crítico (29) | Sangrado 2 |
| 1 · Aitor | Defender, or another foe | 4 PV at the round's end; cut this round, so nothing closes |
| 2 · Gerard | Zarpazo sangriento: 19 | Sangrado 4 |
| 2 · Aitor | Defender, or another foe | 8 PV at the round's end |
| 3 · Gerard | Zarpazo sangriento: 19 | Sangrado 6 |
| 3 · Aitor | Atacar: 21, +120 % wound = **46** | Sangrado 0 |

Three cuts are the whole pool of maná at level 1. From level 5, with Olor a sangre, the same round
changes twice: each cut on the bleeding foe is a crítico 40 % of the times, and Aitor's blow on the
wound of six is one for sure: 21, +120 %, +50 % = **57**, the fight frozen. A wound of six spent by
Zarpa en la llaga instead: 29, +240 %, +50 % = **113** for 2 maná.

## What it offers a dual

**Built (2026-11-21):** *Metralla* (dúo mayor, Explosión + Zarpazo sangriento) and *Staccato* (Zarpazo sangriento + Ostinato); `../README.md` § Combined skills.
**Built (2026-11-25):** *Arco voltaico* (∂Q/∂t Condensador + Acecho), below.

The duals are designed after every ánima is (`../README.md` § Order of work). What Papagato
brings to a pair, for then:

- **A wound to spend**: a partner's skill that hits hard once gets the wound's bonus and the
  crítico. A physical dual spends it, and a dual of many hits of any kind does, with its first hit on
  each foe (§ Definitiva, Multi-hit duals); a magic dual of one blow does not.
- **A flurry** (Zarpazos): many small blows that carry whatever the partner adds to each (fire, a
  status, a peel).
- **A blow that waits** (Acecho), for a partner that charges.
- **A cure that keeps coming and calms** (Ronroneo).

Built with Matemágico (`DUALS` in `src/battle.ts`; how duals fire in `../README.md` § Combined
skills):

| Dual | Matemágico + Papagato | Levels | Maná | Description |
| --- | --- | --- | --- | --- |
| **Zarpazos de fuego** | Foc Binari + **Zarpazos** | 1 · 2 | 1 + 2 | `Daño físico de fuego leve a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.` |
| **Punto débil** | Ángulo exacto + **Zarpazo sangriento** | node · 1 | 1 + 1 | `Daño físico leve a un enemigo. El siguiente ataque que reciba hace el triple de daño.` |
| **Arco voltaico** | ∂Q/∂t Condensador + **Acecho** | node · 6 | 1 + 2 | `Daño físico eléctrico muy alto a un enemigo. Se carga un turno y sale al empezar el siguiente. Golpe crítico seguro. Si un enemigo golpea antes a quien espera, la carga salta a ese enemigo y el golpe sale a la mitad.` |

- **Zarpazos de fuego**: Gerard draws a circle of digits round the foe and Haru strikes it eight
  times (power 8 a claw), a layer off each. Each claw that lands on a foe with no layers left flips
  a coin: three times in four it lights its fire or raises it.
- **Punto débil**: one clean blow (power 20) that leaves the mark *Punto débil*: the next action
  that hurts the foe lands three times as hard and spends it.
- **Arco voltaico**: Acecho with the condenser's charge. Haru does not go into the dark: she waits
  crouched in plain sight, charged, and as the next round starts runs the parabola Gerard drew over the
  prey and drops onto its focus: power 80 (64 until the balance pass of 2026-11-26), physical and electric, with the wearer's stats, a sure
  crítico that spends the wound, turns what a bolt turns and sets off Combustión. A foe that strikes the
  wearer first takes the charge and the pounce lands at half; softening that blow does not stop the jump,
  stopping or felling whoever would strike does. Details in `../matemagico/README.md` §
  Arco voltaico.
- **To look at again with the golpe crítico**: Punto débil's triple on top of a wound and a
  crítico is the biggest single number in the game; whether the triple multiplies them or replaces
  them is a balance question.
- Parked ideas (*Cortina de fuego* went with Yuki se esconde): with
  Sincopante, the eco carrying Yuki's purr; with Dadista, Tijeras and the claws on the same wound.

## Look and interface

Built, the golpe crítico and the blood too (2026-11-20).

- **On the wearer** (in fights; in the street everyone wears their own clothes): Haru's orange
  shirt with Yuki's white at the collar and sleeves, grey trousers, cat ears (one orange, one
  white), a thin ringed tail that sways, a white collar with a gold bell (`src/anima-looks.ts`).
- **Interface**: cream paper, rounded cards, cat orange (`#hud[data-class="papagato"]`).
- **The cats**: toy figures from photos of the real cats (`just character-3d haru`, kind animal), on the
  game's own cat skeleton measured on each model (`tools/animal_rig.py`, `src/animals/`); without their
  file, procedural (`src/cats.ts`). One rig and one gait (`src/cat-gait.ts`, tested, each cat with its own
  measures): legs
  by inverse kinematics, walk, trot and gallop by speed, and the states sitting, crouched to
  pounce, afraid, watching and leaping; alive when still (breathing, blinks, ear flicks, the tail).
  In a fight Haru stands a step ahead on guard and pounces (her claws tear three white-coral lines
  across the foe, `effects.claw`); Yuki sits behind. Her slinking off to hide was Yuki se esconde's:
  it is free for how she goes to an ally to purr, and for Siete vidas.
- Off Papagato in a fight the cats go in a puff of smoke, and come back in one. In Nuria's mission
  the two she lends are the ones already walking with the party (`battleScene.borrowCats`); there
  are only those two even if both wear Papagato, and with nobody wearing it they sit it out.
- **The golpe crítico** (built; `../README.md` § Golpe crítico for the effect every ánima shares):
  the fight stops 0.22 s on the blow, the picture loses its colour all but round the two of them,
  a cut of white light crosses whoever was struck, and the number comes on large and slanted with
  *¡Crítico! · Sangrado +120%* under it when a wound went with it. A flurry's later críticos only
  hold 0.08 s. Not built: the freeze held on Haru at the top of her leap, and her ears going flat
  on a partner's.
- **Sangrado, liquid** (Aitor 2026-11-20; built, `src/status-fx.ts` `blood`, `bloodspray`,
  `bloodstain`): dark blood wells up on whoever bleeds, runs down their parts and drips, more with
  every stack and with each heartbeat; what falls lies on the floor of the place as a stain that
  spreads and dries (8 to 13 s); a cut throws it the way the claw went, on the floor and on whoever
  stands behind; a spent wound bursts, as much as it held. This replaces the rule fights had until
  now (*no blood: scratches of light only*), at Aitor's word.
- **The wound's chip** burns brighter at five stacks while Olor a sangre is worn (`data-ripe`).
- Seen in today's captures: in the dogs' street at night the grading turns the orange shirt red
  and the cats violet. That is the place's light, not the ánima's; worth a look when places are
  reviewed.

## In the world

Proposal: the cats get through gaps a person can't (a cat flap, a fence, a wall top), always as
something Haru does when someone asks, never a prompt that says where.

## Second round

Nuria's family, together and free, proposes a new plan (`docs/quests/nuria.md` § Second round);
saying yes gives Papagato its colour.

## Implementation

**Built** (levels 1 to 3): `papagato` in `ClassId`, `ANIMA_NAMES`, `CLASS_STATS`; its four skills
in `SKILLS` (`src/battle.ts`), by `level` (`src/levels.ts`, three levels); `CLASSES` look and
`src/anima-looks.ts`; the theme in `src/style.css`; Haru and Yuki (`src/cats.ts`,
`src/battle-scene.ts`); the two duals with Matemágico; the `papagato` flag and its banner
(`storyUI.kept`); lent and given back in Nuria's mission; the cats at home afterwards
(`src/cat-wander.ts`). And of this redesign (2026-11-20):

- **Golpe crítico**: `CRIT_RULES`, `critChance`, its own stream of luck (`state.luck`, apart from
  the fight's rolls), `effect.crit` / `crits` / `hits[].crit`; tests run with chance off
  (`tests/setup.mjs`). Its look: `CRIT` and `landing` (`src/hit-feel.ts`), `critBeat`
  (`src/battle-scene.ts`), `dualFx.critical`, the flash in `src/post.ts`, the `crit` number
  (`src/battle-ui.ts`, `pop-crit` in `src/style.css`) and its sound (`src/sfx.ts`).
- **Crítico on the sheet** (`src/stats.ts`) and Papagato's `CLASS_STATS`.
- **Cuts pile up, the blood goes slowly** (`wound`, `cut`, `cutRound`, `nextRound`).
- **Liquid blood** (`src/status-fx.ts`; `flat` kinds in `src/fight-particles.ts`).
- **Olor a sangre** as a passive with a level (`PASSIVES`, `SCENT`, `scentOf`, `sureCrit`): only on
  from level 5, which the game cannot reach yet (or with the tester's *Sin límites*).
- **The cut**: Yuki se esconde and Las dos a la vez out of `SKILLS`, tests and sounds.
- **Ronroneo** on one ally: a cure at once, `regen: 'sanacion'` and the cleanse; Yuki goes to them.
- **The fight tester**: *Crítico seguro* among its helps (`FightSetup.crit`, `state.sureCrits`).

And of 2026-11-21 (`tests/papagato.test.mjs`):

- **Seven levels**: `acecho` (6) and `caceria` (7) in `SKILLS`, so `topOf('papagato')` is 7; its
  flags `papagato-4` to `papagato-7` (`src/story.ts`, `server.py`, the picker's arc in
  `src/story-points.ts`, `just dev-chapter`). Level 4 is the shared Maná +1 (`MANA_LEVEL`) and 5
  brings Olor a sangre; the victory card and the note outside a fight say both (*Gana Maná +1*,
  *Aprende Olor a sangre*), for every ánima that grows by level.
- **Acecho** (`stalk`, `pounce` in `nextRound`) and **Cacería** (`hunt`, `validTargets` only on
  whoever bleeds), with their sounds (`src/battle-sounds.ts`) and the cats' choreography
  (`updateCats`, `huntClaw` in `src/battle-scene.ts`).
- **Siete vidas** (§ Definitiva).
- In the game simulation (`src/game-sim.ts`) the tower still grinds Papagato no further than 3.

**To build**, in this order:

1. **Crítico on the status screen**. (Velocidad is out of the turn order since 2026-11-21.)
2. `just fight-sim`: its targets moved with the new rules (`just fight-sim check` fails on
   `platitos-sin-pensar`); they are set again with the balance, last. The smart bot does not know
   how to value Acecho nor Cacería yet (it never or hardly uses them; Siete vidas it plays since
   2026-11-26, § Definitiva), and with Papagato at 4 or more it does worse on Lo Directo (98 % → 84 %)
   because of how it spends the fourth maná.

Screenshots: `just screenshots papagato` (the ánima's sheet: look, cats, interface, each skill),
`papagato-crece` (levels 4 to 7 and Siete vidas: Acecho, Cacería, the definitiva waking, its ward
saving someone, the victory screen at 4, 5 and 7), `siete-vidas --gpu` (its own look: the silhouettes and the
blow played back), `cats`, `cats-fight`, `duals`, `nuria-won`.

## For the balance, later

What `just fight-sim` says today (smart bot, Gerard on Matemágico and Aitor on Papagato at level
3): **Zarpazos decides everything** (without it El Cebollón is 0 % and Aurelià 13 %) and so do the
duals; **Zarpa en la llaga, Las dos a la vez, Yuki se esconde and Ronroneo change nothing** when
banned (the two in the middle are cut since). So today Papagato is the ánima that peels, not the one that bleeds: the wound is not worth
building. The redesign is what should change that, and these are the numbers to watch:

- The crítico's bonus (+50 %) and whether it adds to the wound's or multiplies it.
- Nuria's mission without Yuki se esconde, without a blow on every foe, and with Ronroneo on one
  ally: its fights were tuned with all three (`TARGETS`).
- How fast the blood goes, and its 2 PV a stack every round on a wound that can now stay at ten.
- Olor a sangre's 20 % and where five sits: three cuts today.
- Zarpa en la llaga's double on a wound that can now reach 10.
- Punto débil's triple on top of both.
- Crítico +10 % on eight claws of Zarpazos de fuego.
- Whether the bots know how to cut and cash in (a `smart` policy for it), or the sim will keep
  saying the wound is worth nothing.

## Open

- Whether Ronroneo keeps the cleanse now that it is for one ally.
- The motto.
- Grey in the first round and the colour's return in the second.
