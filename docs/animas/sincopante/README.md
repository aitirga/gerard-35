# Sincopante

Status: **built whole 2026-11-21**, with Aitor's yes that day («debemos integrarlos ya»). Designed whole
2026-11-20 around his direction of that day (floating ecos that work for the party, support too;
*Crescendo*; the astral; *Da capo* bringing the duals back), and reworked the same evening with his
answers (no feeding; muffled ecos when switching; Marta's voice in them). Comes from: Marta's mission,
[`docs/quests/marta.md`](../../quests/marta.md)

What is **decided** says so and by whom. Everything else is a proposal, and its numbers are first
guesses ([`../README.md`](../README.md) § Order of work).

**Decided by Aitor**

| When | What |
| --- | --- |
| 2026-11-07 | **Skills like hers: song and timing**, in the same spirit as her boss (`docs/quests/marta.md` § Ánima) |
| 2026-11-14 | The name is **Sincopante** |
| 2026-11-20 | **Ecos floating over the party that do things for it, support too** |
| 2026-11-20 | ***Crescendo***: a skill that makes the ecos already standing stronger. The ones that cure cure everyone, the ones that strike strike harder, and they are seen to grow |
| 2026-11-20 | It uses **the astral: magic damage of no element** (as Dadista, [`../dadaista/README.md`](../dadaista/README.md)) |
| 2026-11-20 | ***Da capo*** is its definitiva, and **it lets the party use the dual attacks again** |
| 2026-11-20 | The look: **the ecos' geometry, with an ethereal, magical, angelic air** |
| 2026-11-20 | **No feeding the eco**: the 2026-11-14 idea is cut |
| 2026-11-20 | **The ecos keep sounding when their wearer switches ánima, but muffled** |
| 2026-11-20 | **Marta's voice is the ecos' voice**, worked into them **without getting in the way of the fight's song** |
| 2026-11-20 | The ecos' mark is **Interferencia** (a voice and its echo), with **cimática and cáustica for the effects** (from the identity study, `output/mockups/sincopante-identidad/index.html`) |

**What the 2026-11-14 proposal loses** (all of it was a proposal, never decided):

- **Feeding the eco** is cut (Aitor confirmed it, 2026-11-20). In that proposal the eco repeated
  whatever an ally aimed at it. That cost the allies turns, which is the opposite of ecos working
  for the party. *Acompañamiento* keeps the idea of repeating a blow, as support.
- **Redoble, Canon and Coda** are cut. Crescendo restarts the ecos' clocks, so Redoble has nothing
  left to do. Several ecos are allowed from level 1, so Canon goes. Tutti spends the ecos, so Coda
  goes.
- **Renamed**: Eco de guerra is now *Ostinato* and Eco curativo is now *Bordón*.
- ***A contratiempo* changed**: the blow now goes between two beats, in the gap, which is what
  La Voz teaches since her 2026-11-20 rework.

## Identity

- **What it is**: whoever wears it does not strike alone. What they do stays in the air as an
  **eco**: a figure of light over the party that repeats it on its own beat. One strikes, one cures,
  one goes with a friend. They grow louder until they reach everyone. At most three sound at once:
  a chord. It is Marta's voice let loose in the fight, as her qualities were in Las cuerdas, but
  this time on the party's side.
- **What wearing it feels like**: playing with a band behind you. The work goes on while you do
  something else, and the skill is in keeping it going and in coming in off the beat.
- **Unlocked**: at the end of Marta's mission, when the song is played well and her ánima leaves
  her (§ In the world). Shared: Gerard or Aitor equips it in an extra slot. Seven levels by EXP.
- **Motto** (proposal): *"Entra donde nadie cuenta."* Syncopation is the accent where nobody
  counts one.
- **Colour** (proposal): **nácar**, a pearl white whose edges turn seafoam `#8fe3c4`, with a pale
  gold shimmer. It is grey in the first round and takes its colour in the second (§ Look and
  interface).

## Role

**The party's second voice: damage and cures that keep coming while its wearer, or the whole party,
does something else.**

| | Sincopante | Papagato | Matemágico | Tecnópata | Dadista |
| --- | --- | --- | --- | --- | --- |
| Hurts with | Magic of no element (the astral), mostly through ecos that keep sounding | Physical blows | Magic, with elements | Magic, clocks | Physical faces; the astral, by luck |
| Its resource | **Ecos on its own side**, not a status on the foe | Sangrado on the foe | Elements and their statuses | Clock statuses | Crítico (the Racha) |
| Pays off as | Ecos raised by Crescendo until they reach everyone; Tutti spends them; three at once wake Da capo | A golpe crítico on the wound | A reaction between elements | Longer clocks, control | Críticos, Dados astrales |

- **Good at**: long fights; steady damage and cures; reaching every foe or every ally without a
  skill that costs a lot; helping the partner (*Acompañamiento*, Da capo); turns spent holding on,
  because the ecos keep working.
- **Bad at**: fights that are over in two rounds; a big blow right now (nothing hits hard until
  Tutti at level 7). It has no physical blows and Fuerza −1. It is fragile to a fall: the ecos go
  out with their wearer.
- **The decision it adds to every turn**: spend this turn on the foe, or on the music (call an
  eco, raise them, hold on to keep them). Wait for the off-beat, or act now. Stay in Sincopante
  to raise the ecos, or switch to another ánima and let them sound on their own.

## Stats

Proposal, kept from 2026-11-14: **Magia +2, Espíritu +2, Defensa +1, Fuerza −1** (sum +4). The
ecos strike and cure with their wearer's Magia (curing grows with Magia, `healing` in
`src/stats.ts`). Defensa and Espíritu are for a wearer who spends turns holding on (*Pedal*). The
trade-off is Fuerza: Atacar is weak in it.

Marta's light (`ANIMAS` in `src/animas.ts`, the party bonus) is **Espíritu +1, Defensa +1, 10 PV**
(2026-11-21, in place of the placeholder Magia +1, Velocidad +1 when Velocidad was removed). No
other light has that pair, and it fits a friend who holds on.

## Signature: the ecos and the compás

The loop:

1. **Call** an eco. *Ostinato* strikes a foe and *Bordón* cures an ally, and what they did stays in
   the air as an eco that repeats it on every beat for 20 s.
2. **Raise** them with *Crescendo*. The first time they sound stronger; the second time they reach
   everyone (every foe, or the whole party). Each Crescendo also starts their 20 s over.
3. **Keep** them going or **spend** them. Keeping them costs turns (Crescendo, and from level 6
   Defender with *Pedal*). *Tutti* (level 7) spends them all at once. Three ecos at once, a chord,
   wake *Da capo*.

**The rules of an eco**

- **What it is**: a figure of light floating over the party's side. It is not a fighter: it
  cannot be hurt, no foe aims at it, and nobody aims anything at it.
- **The compás**: every eco sounds on one shared beat, **every 5 s**. The first eco called starts
  the beat, and it keeps running while one eco sounds. A new eco joins it: its first pulse comes
  on the next beat. The beat runs on the fight's clock (`docs/combat.md` § Estados en tiempo
  real), not on turns, so it also sounds while the players choose.
  - **It follows the fight's song** (proposal, so the ecos never cross the music). When the song
    has a tempo (`bpm`, `beatsPerBar`, `downbeat` in `TRACKS`, `src/music.ts`), the beat falls on
    the first beat of every second bar: **4.8 s** in the battle song (100 bpm, 4/4).
  - Without a tempo, it is 5 s.
  - When the fight's clock stops (a dual's banner, a golpe crítico), it picks up at the next
    second downbeat.
  - The numbers in this doc count 5 s.
- **How long it lasts**: **20 s** from its call, which is four beats. Crescendo and Da capo start
  it over. That is the README's length for something that must reach the foes' turn
  ([`../README.md`](../README.md) § How long a clock status lasts).
- **At most three at once.** A fourth replaces the oldest.
- **Its grade** (*matiz*), which Crescendo raises:

  | Grade | Shown | What it does |
  | --- | --- | --- |
  | *p* | One ring, small and dim | As called |
  | *mf* | Two rings, brighter | Half as strong again (×1.5) |
  | *f* | Three rings and two arcs open at its sides | Still ×1.5, and **it reaches everyone**: an eco that strikes hits every foe, and one that cures cures the whole party |

  Crescendo on an eco already at *f* only starts its clock over.
- **Whom it hits**: an Ostinato eco hits the foe it was called on. If that foe falls, it hits the
  next foe its wearer hits; until then, the foe with the fewest PV. A Bordón eco cures the ally
  with the least of their PV left, as a share.
- **A pulse is not a blow.** It is magic damage of no element (the astral) with the wearer's Magia
  at the moment it sounds, or a cure. Like a fire's pulse:
  - it is never a golpe crítico;
  - it neither spends nor uses a wound (Sangrado) or a *Punto débil*;
  - it sets off no reaction;
  - a foe's rules about kinds of blow treat it as they treat a fire's pulse. Against La Voz, a pulse
    during a note does nothing and one in a silence lands.

  So it never spoils what the partner is building, and it never cashes it in either.
- **Its wearer switching ánima** (Aitor, 2026-11-20: they keep sounding, but muffled): the ecos
  go on, *apagados*.
  - **Sound and look**: their voice comes through as from behind a door (a low-pass at 650 Hz,
    9 dB lower, less reverb). Their light drops under half, with no gold shimmer and no motes.
  - **Strength**: each beat strikes or cures at **half** (proposal for what muffled means in
    numbers: 6 → 3, 9 → 5). Their clock runs as before.
  - **What needs Sincopante worn**: calling ecos, Crescendo, Acompañamiento, Tutti and the
    passives. Putting Sincopante back on brings the ecos back whole at once.
  - **Maná**: Sincopante gets its maná back while it is not worn, like any ánima (+1 a round).

  So calling ecos and then playing another ánima still pays, which no other ánima allows, but less
  than staying.
- **Its wearer falling**: every eco goes out at once, with no last note.
- **Where it shows**: in the scene, each eco's size and rings give its grade. On the wearer's plate,
  one continuous status icon, *Compás*: a ring with a hand that goes round once every 5 s. It has a
  notch at the top (the beat) and one at the bottom (the off-beat), and inside, a dot for each eco
  with an arc that empties over its 20 s and its grade as a small letter (*p*, *mf*, *f*). A fight's
  mechanic shown as a status, like a fire's clock.

Needs that do not exist yet: a field entity on the party's side that acts on the clock; the
compás; the icon. The seconds come from `src/battle.ts`'s clock (`runClock`). Judging a press
against a moment already exists for La Voz (`song.aim`).

### Passives

| Passive | When | What it does |
| --- | --- | --- |
| **A contratiempo** | Level 3 | An action of the wearer pressed **in the off-beat** (the second halfway between two beats, give or take half a second) makes every eco sound once more, at once |
| **Pedal** | Level 6 | **While its wearer holds on** (Defender, until they act again), the ecos' clocks stop. They keep sounding |

**A contratiempo, by example.** Aitor wears Sincopante (Magia 12) with two Ostinato ecos at *mf*,
each hitting 9. It is his turn, and the hand on *Compás* has just passed the top notch:

- **He confirms at once** (on the beat, or anywhere else): his action, and nothing more. The ecos
  sound when their beat comes.
- **He waits two seconds and confirms as the hand crosses the bottom notch**: his action, and both
  ecos sound right then, **+18**, on top of their four beats. Their clocks do not move. *PASIVA ·
  A contratiempo*.

That is about a fifth more from the ecos for each turn played off the beat. The window is a whole
second out of every five, judged when the button is pressed (as La Voz judges a blow in her
silences), so it asks for reading, never for a perfect frame. Waiting has a price: the foes' clocks,
and the fire someone is keeping alive, run on too.

**Pedal, by example.** At 0:33 Aitor holds on. His eco has 6 s left, and he acts again at 0:49:

- **Without Pedal**: it sounds once more (0:37) and goes out at 0:39.
- **With Pedal**: it sounds at 0:37, 0:42 and 0:47, still has its 6 s when he acts, and has time to
  be raised. *PASIVA · Pedal*.

Defender already gives 2 maná back. With Pedal it also keeps the band playing, so the turn that
refills maná is no longer a lost turn. It is the sustain pedal of a piano, Aitor's instrument in
Keiran.

## Skills per level

Seven levels ([`../README.md`](../README.md) § Levels; today only three are built for any ánima).
Numbers are first guesses: "Base" is the power, against Atacar's 18.

| Level | What it gives | Who | Cost | Base | Description | State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Ostinato** | The wearer, then its eco | 2 | 14; the eco 4 a beat | `Daño mágico no elemental leve a un enemigo. Deja un eco que repite el golpe cada 5 segundos durante 20 segundos.` | Built |
| 1 | **Bordón** | The wearer, then its eco | 2 | 16; the eco 4 a beat | `Cura leve a un aliado herido. Deja un eco que cura al aliado más herido cada 5 segundos durante 20 segundos.` | Built |
| 2 | **Crescendo** (Aitor's) | The ecos | 1 | ×1.5, then everyone | `Los ecos suenan más fuerte y su reloj vuelve a empezar. Los que ya sonaban fuerte llegan a todos.` | Built |
| 3 | Passive · **A contratiempo** | The wearer | — | — | `Si quien la lleva actúa justo entre dos pulsos, todos sus ecos suenan una vez más.` | Built |
| 4 | **Maná +1** | — | — | — | — | Built |
| 5 | **Acompañamiento** | Its eco | 2 | 6 a repeat | `Deja un eco junto a un aliado durante 20 segundos. Repite cada golpe suyo con daño mágico no elemental leve.` | Built |
| 6 | Passive · **Pedal** | The wearer | — | — | `Mientras quien la lleva se defiende, el reloj de sus ecos se para. Siguen sonando.` | Built |
| 7 | **Tutti** | The wearer and every eco | 3 | 36 | `Daño mágico no elemental alto a todos los enemigos. Cada eco suena una última vez, el doble de fuerte, y se apaga.` | Built |
| Definitiva | ***Da capo*** (Aitor's) | The wearer | — | — | *Abstract*: `Los ataques dúo ya usados en este combate se pueden usar otra vez. Todo el equipo recupera todo su maná.` | Built |

**What `AGENTS.md`'s shape has no word for**: Ostinato, Bordón and Tutti pass it as they are. A
skill that leaves an eco says so in an extra sentence, which the shape already allows. Three rows
do not fit it:

- **Crescendo** acts on the ecos, not on a fighter.
- **Acompañamiento** only leaves an eco.
- **Da capo** gives back maná and duals.

Proposal for `AGENTS.md` and `tests/battle.test.mjs`: a fifth shape, **Ecos**, either
`Deja un eco <junto a un aliado> durante <N> segundos. <Qué hace>.` or `Los ecos <qué les pasa>.`,
for a skill of `kind: 'eco'`. Da capo, the only skill that gives duals back, is marked
`abstract: true` with this exact sentence rather than given a shape of its own.

What each one is for in the loop:

- **Ostinato** builds. A light astral blow now, and a light one every beat for 20 s.
- **Bordón** builds, on the support side. A cure now and a small one every beat on whoever needs
  it most. At *f* it cures the whole party every 5 s.
- **Crescendo** (Aitor's) raises and keeps. For one maná every eco gets stronger, or wider, and
  its 20 s start over. It is worth more the more ecos are up, which is the reason to call several
  before raising them.
- **A contratiempo** is timing. It turns waiting for the off-beat into extra pulses.
- **Acompañamiento** is support for the partner. For 20 s every blow of theirs is repeated by the
  eco at their side: a skill, Atacar, a dual (one repeat per action, not per claw of a flurry). At
  *f* the repeat reaches every foe.
- **Pedal** keeps the ecos alive. It turns Defender into a turn that refills maná *and* keeps the
  ecos going.
- **Tutti** spends: a strong blow on every foe, and the band's last chord. Called, raised, then
  spent: the ánima's whole shape in one fight.

## Definitiva: Da capo

*Da capo*: in a score, "back to the beginning". Aitor's (2026-11-20): it lets the party use the
dual attacks again. Bought at the jar (2 ecos) once the castle's second boss falls
([`../README.md`](../README.md) § Definitivas).

| | |
| --- | --- |
| **Wakes in a fight when** | **Three ecos sound at once: a chord.** It is met while Sincopante is worn, by whoever wears it. The chord can be heard (three notes together) and seen (§ Look) |
| **Then** | Once in that fight, for the wearer's turn and no maná |
| **The duals** | **Every dual already used in this fight can go off once more**, as at the start. It only brings back duals already used: one never found, or not used yet, stays as it was. They are played as always: both turns, each half chosen by its wearer, each half paid from its own maná |
| **The maná** | **Every ánima of both fighters, worn or not, is full again**, so the duals can be paid |
| **The ecos** | The ones standing start their 20 s over, at the grade they have |
| **What it does not do** | It never fires a dual by itself. It does not bring back a definitiva, its own or another's. A dual takes both turns, so the first one comes the round after, not in the round Da capo is used (the wearer's turn went on it) |
| **In the game** | *Abstract*: `Los ataques dúo ya usados en este combate se pueden usar otra vez. Todo el equipo recupera todo su maná.` |

**By example.** Against a boss, Gerard (Matemágico) and Aitor (Tecnópata, Sincopante) fire *Rayo
solar* in round 3. By round 6 Aitor has three ecos up: the chord sounds and *Da capo* appears in
his dock. He uses it. Gerard's and Aitor's ánimas are all full again, and in round 7 *Rayo solar*
can go off a second time, which until now never happened in one fight. With Papagato on one of
them, *Zarpazos de fuego* and *Punto débil* come back as well.

Why this condition: it is the ánima played to its end and it can be seen on the field. Keeping
three ecos alive at once is the whole skill of the ánima (calling, raising, holding on), and it
leads straight into what Da capo rewards: a party that knows its duals.

## What a round looks like

Aitor wears Sincopante at level 6 (Magia 12 with its +2, Maná 4); Gerard is on Matemágico; two
foes with Espíritu 10. A round takes about 15 s, the compás beats every 5 s, and the numbers come
before any balance. Ostinato's eco hits 6 at *p* and 9 at *mf*.

| When | Who | Does | Ecos | On the foes |
| --- | --- | --- | --- | --- |
| 0:02 | Aitor | Ostinato on the first foe (4 → 2 maná) | One, *p*, until 0:22. The beat starts: 0:07, 0:12, 0:17… | 16 |
| 0:07, 0:12 | Its eco | Two beats | | 6 + 6 |
| 0:17 | Its eco | A beat (round 2 has started) | | 6 |
| 0:19.5 | Aitor | **Crescendo, in the off-beat** (2 → 1) | *mf*, until 0:39.5. *A contratiempo*: it sounds now | 9 |
| 0:22, 0:27, 0:32 | Its eco | Three beats | | 9 + 9 + 9 |
| 0:33 | Aitor | **Defender** (1 → 3). *Pedal*: the eco's clock stops at 6.5 s | | — |
| 0:37, 0:42, 0:47 | Its eco | Three beats while he holds on | | 9 + 9 + 9 |
| 0:49 | Aitor | **Bordón** on Gerard (3 → 1) | Two: the first still has its 6.5 s | Cure 18 |

Three of Aitor's turns, one of them Defender, put **97** on the first foe for 3 maná, of which
Defender gave 2 back. Atacar three times with his Fuerza 12 puts 60, for nothing. Meanwhile Gerard
played his own three turns untouched. The cost is that it is slow: 16 of the 97 land in the first
turn, and a foe that goes down at once makes the rest worth nothing. From level 7, a Tutti here
(two ecos at *mf*) would be 38 on each foe, plus 18 from the Ostinato eco's last note and 18 of cure
from the Bordón eco's.

**The largest single action the design allows**: Tutti with three Ostinato ecos at *f*. That is
38, plus 3 × 18, so **92 on every foe**. Getting there costs 3 calls, 2 Crescendos and Tutti: 11
maná and four or five rounds. For comparison: Rayo solar is 40 on each foe, Bombardeo orbital 42,
and Dados astrales about 140 at random.

## What it offers a dual

**Built (2026-11-21):** *Idea fija* (dúo mayor, Confusión + Ostinato), *Seiche* (Recarga + Ostinato) and *Staccato* (Zarpazo sangriento + Ostinato); `../README.md` § Combined skills.

**Built (2026-11-25):** *Corriente alterna* (Matemágico's Cortocircuito + **Crescendo**), the first dual
of Crescendo: Cortocircuito's blow, then a circuit between two foes that strikes one of them every
5 s, in turn and harder each time (8, 11, 14, 17), each beat a bolt for the reactions
(`../README.md` § Alterna; `../matemagico/README.md` § Duals). Crescendo only has a target with ecos
sounding, so the dual turns up when Marta is already playing them.

The duals are designed after every ánima is ([`../README.md`](../README.md) § Order of work). What
Sincopante brings to a pair:

- **Something that keeps going**: an eco that repeats a dual's blow every beat (a dual that leaves
  an eco).
- **A partner accompanied**: *Acompañamiento* repeats any action of the partner. A dual is an
  action, so it is repeated once.
- **A beat to hit in**: a dual pressed in the off-beat, for a partner whose skill waits or
  charges (Rayo solar, Acecho).
- **Cures that keep coming** (Bordón), for a dual that shields or heals.
- **Da capo**: the duals themselves, again. It is the ánima for a party that plays its duals.

**Bombardeo orbital** is playable with Tecnópata. Explosión and Ostinato lift Bip above the foes;
the next round opens with three astral strikes per foe and Cegado for 20 seconds.

Other ideas:

- With Papagato: the eco carrying the purr (*Ronroneo* + Bordón).

## Look and interface

Aitor's direction (2026-11-20): **the ecos' geometry, with an ethereal, magical, angelic air**. The
detail is a proposal.

**Three figures, one for each thing an eco is** (Aitor chose them on 2026-11-20 from the identity
study, `output/mockups/sincopante-identidad/index.html`):

| Figure | What it is | Where it shows |
| --- | --- | --- |
| **Interferencia** | A voice and its echo: every ring is doubled by a copy a little apart, fine ripples run out from both, and a pale gold lights up where the two agree | **The eco itself**, and the ánima's mark everywhere else: the ring an eco lets go, the ripples on the floor (from two points, crossing), its wings, *Compás* (two circles a little apart), the dock |
| **Cimática** | What a note does to what it touches: the figure sand draws on a sounding plate, grains gathered on its still lines. Each grade has its own figure, and the grains jump when it is struck | **The effects that strike**: inside an eco on each beat and in Crescendo, on a foe where a blow lands, the great plate of Tutti (changing figure as it comes down), and the plate under the party in Da capo (its figures played backwards) |
| **Cáustica** | The light an eco gives: the bright net light makes through moving water | **The effects that give light**: the veil hanging from each eco to a pool on the floor, the veil that wraps an ally Bordón cures, Tutti's column and the pool it leaves |

**In the engine** (built 2026-11-20, the look only; Aitor: «una integración gráfica potente,
mezclando partículas, VFX bonito, mágico, cambios de luz», then «me gusta la cimática y la cáustica
para los efectos»). [src/eco-fx.ts](../../../src/eco-fx.ts) places and times the ecos, and
[src/eco-shaders.ts](../../../src/eco-shaders.ts) draws them:
- **Four sheets of light**, each a flat square whose picture is worked out in a WGSL shader and
  added on top of the fight: *the eco* (Interferencia: bead, doubled rings, ripples, wings, and its
  note's figure when struck), *the plate* (Cimática), *the water* (Cáustica, as a veil or a pool)
  and *the wave* (a doubled ring, or ripples from two points). All ecos share the four materials;
  each sheet takes its numbers per instance, so nothing is compiled while a fight runs.
- **Light**: one real light shared by all the ecos, which falls on the party under them.
- **GPU particles**: motes, specks, sparks, lines of dots between the ecos for the chord.
- **Beams**: from the trails, a fine core with two strands twisting round it.
- **The picture**: a pulse of bloom when they sound, and the spotlight that dims and greys the
  fight round them for Crescendo, Da capo and Tutti.

It is played from the effects lab, section *Sincopante · ecos* (`just dev-fx`; docs/dev-tools.md §
Effects lab). The frames are from `just screenshots sincopante-fx --gpu`, over Las cuerdas with
Gerard and Aitor. Not yet: the rings on the wearer's nape, the *Compás* icon on the plate and the
dock's theme with the mark (all wait for the ánima itself), and its cost in a real fight
(`just perf`: the sheets are a few squares, but three ecos at *f* cover a good part of the party's
side).

A moving sketch, playable from a mock dock in the proposed theme:
`output/mockups/sincopante-ecos/index.html`, with frames in `frames/`. It shows the compás, the
three grades, the chord, Da capo, Tutti and the muffled ecos. With *Sonido* and *Música de combate*,
it also plays Marta's voice in the ecos over the battle song, on its downbeats.

### The ecos

They take their geometry from the Eco of Las cuerdas (`src/cuerdas-foes.ts`: a bead of light inside
rings, ripples running over the floor), without its body of glass. On the party's side an eco is
only what a voice leaves in the air.

- **Body**: a bead of light inside fine rings, **each ring doubled by its echo** a little apart
  (Interferencia). Fine ripples run out from the bead and from its echo, and where they agree a
  pale gold lights up; a glint of gold runs round each ring. **A veil of light through water**
  (Cáustica) hangs from it to a pool of the same light on the floor. On each beat its inside shows
  its note's figure for a moment (Cimática), and ripples from two points cross on the floor.
- **Material**: light, not glass. Additive, casting no shadow, partly see-through. **Nácar**: a
  white core, rings going from white to seafoam at their edge, and a pale gold shimmer as they turn.
  The iridescence stays between mint and gold: the pink and violet that real mother-of-pearl shows
  are left out (pink is La Reina's and violet is possession's, `docs/visual-style.md`).
- **Where**: over and behind the party's side, between 1.8 and 2.6 m up, at three heights for
  three ecos (low, middle, high: a chord as it would sit on a stave). They bob slowly, a few
  centimetres over the 5 s of the compás. Acompañamiento's eco sits at its ally's shoulder and
  follows them.
- **Each kind is told by its shape, never by its colour**:
  - **Ostinato** (strikes): its rings stand upright, narrow, like a bell's mouth leaning towards
    the foes.
  - **Bordón** (cures): its rings lie wide and flat, a halo swaying slowly. Its veil and pool are
    warmer, a pale gold.
  - **Acompañamiento**: two thirds the size, its rings upright and facing the foes.
- **Its grade, by size and rings** (Crescendo):

  | Grade | Size | Rings | Light |
  | --- | --- | --- | --- |
  | *p* | 0.2 m | One, and its echo | Dim; a thin veil and a small pool |
  | *mf* | 0.4 m | Two; the echo stands further off, so the ripples cross in gold | Brighter; soft motes rise off it |
  | *f* | 0.6 m | Three and a second echo, and **two wings at its sides**, each a fan of four fine doubled arcs curling up | Specks orbit it; its pool joins the others' under the party; its floor ripple crosses the party's whole side |

  The size is its outer ring's radius. Its figure when struck changes with the grade: each note has
  its own. The wings are the one angelic figure, and they are drawn with arcs, never with feathers. The
  tone stays serious: no cherubs, no hearts, no sparkles.
- **Particles**: soft round motes that rise slowly and fade, like dust in a shaft of light. Never
  stars, which are Dadista's astral: Sincopante's astral is rings and rising light, and Dadista's
  is stars and falling light. All on the GPU engine.
- **The number** of a pulse is small, in nácar, and named *Eco*.

### Beat by beat

| Moment | Lasts | What happens |
| --- | --- | --- |
| **Ostinato** | 1.2 s | The wearer opens a hand towards the foe (0.25 s). A beam of light, two strands twisting round it, flies to the foe (0.3 s); a ring and its echo close round it like a halo pulled tight, two fainter copies behind them, and the note's figure flashes on the foe as on a struck plate: that is the blow (0.2 s), with the number in nácar. A fainter copy of the ring rises off the foe, floats back over the party and settles at its height, turning into the eco (0.5 s) |
| **Bordón** | 1 s | The wearer lifts a hand over the ally. A veil of warm light through water wraps them, a ring and its echo come down over them like a halo and rise back through them (0.6 s), and a pool of light lies at their feet, with the number of the cure. A copy stays above them and rises to its place |
| **A pulse** (every 5 s, all at once) | 0.4 s | Each eco draws in (10 % smaller, 0.15 s), shows its note's figure inside it, and lets out its outer ring. An Ostinato's ring flies flat to its foe (0.25 s) and closes on it with a soft flash, and motes rise off the foe. A Bordón's ring falls like a halo on its ally and rises through them. At *f* the ring grows as it leaves and becomes a wave that crosses every foe (or the whole party) at once. On the floor under the eco, ripples from two points run out and cross |
| **Crescendo** | 0.8 s | The wearer raises both hands, palms up (0.3 s). Every eco draws in, then swells to its new grade (0.5 s): a new ring opens from the bead outwards, its inside shows the figure of its new note (the grains jump to it), a wave of rings runs out from it, and at *f* the wings unfold. The fight dims and greys round the ecos for a moment. The ecos' notes swell. *Crescendo* rises over each eco with its new grade (*mf*, *f*), and their arcs on *Compás* fill again |
| **A contratiempo** | 0.3 s | On the press, a bright tick at the bottom notch of *Compás*. Every eco flashes and lets out an extra pulse at once, a short accented chord off the beat. *PASIVA · A contratiempo* |
| **Pedal** | While it lasts | As the wearer holds on, a thin level line of light runs under the ecos, like the pedal line under a piano stave. Their arcs on *Compás* stop and glow steady, and their notes ring longer. *PASIVA · Pedal*. When the wearer acts again, the line fades |
| **The chord** (three ecos) | One beat | Three thin lines of light join the three ecos into a triangle for a beat, each shows its figure, and the three notes sound together. If Da capo is bought, its command appears in the dock. Nothing else says so |
| **Tutti** | 1.6 s | The ecos fly together over the foes (0.4 s) and become one great sounding plate, its figure changing note by note as it grows. The scene dims and a column of warm light through water stands over the foes (0.5 s). The plate comes down on every foe at once and is struck: its grains jump, a ring closes on each foe, a pool of warm light spreads under them, with the fight frozen for 0.25 s as for a golpe crítico, and every note sounds together. Motes rise off the foes for a second, and the ecos are gone |
| **Da capo** | 2.4 s | The three ecos rise into a column (0.4 s). Every ring on the field turns backwards, a great plate under the party plays its figures from the last to the first while rings close in on it, and the hand of *Compás* spins a whole turn back (0.6 s), while the ecos sing the start of Marta's phrase, *Do Sol Fa Re*. A wave of nácar light crosses the party's side, and every maná pip fills again, one by one, each with a note (0.6 s). The names of the duals already used appear faintly over the party, written on five thin lines, and light up (0.6 s). *¡DA CAPO!* |
| **An eco going out** | 0.6 s | Its rings open and drift apart, the motes rise, and its note fades. If the wearer falls, every eco goes out at once |

*Movimiento reducido* keeps the ecos, the pulses and the numbers, and drops the dimming, the freeze
and the waves.

### Sound: Marta's voice

Decided by Aitor (2026-11-20): **the ecos sing with Marta's voice, without getting in the way of
the fight's song**. The detail is a proposal. It can be heard in the sketch: *Sonido*, then
*Música de combate*.

**The grains.** Short takes cut from her recording (`public/music/marta-voz.m4a`), from the
steadiest middle of a note:

| Grain | Where in the file | Length | Pitch | For |
| --- | --- | --- | --- | --- |
| **Fa** | 4.64 to 5.66 s (turn 1, third note) | 1.0 s | F4, 10 cents sharp | The first eco |
| **La** | 11.77 to 12.95 s (turn 1, seventh note) | 1.2 s | A4, 3 cents sharp | The second eco |
| **Do** | 21.51 to 22.30 s (turn 2, fifth note) | 0.8 s | C4, 10 cents sharp | The third eco |
| **Da capo** | 62.80 to 66.30 s (turn 6) | 3.5 s | *Do Sol Fa Re*, the start of her phrase, quick and bound | Da capo |

Each grain is:
- filtered (high-pass 200 Hz, low-pass 7 kHz);
- faded in over 60 ms and out over 350 ms;
- peaked at −3 dB;
- played retuned by its cents.

**They fit the music by construction.**
- **Key**: the battle song (`music/battle.m4a`) is **in F major**: its chroma is F, C and D, and it
  matches F major at 0.81. Fa, La and Do are its tonic chord, so the ecos never sing out of key with
  it. A fight with a song in another key transposes the grains to that song's tonic chord (a `key`
  for each track in `TRACKS`; proposal). Within a fourth, the voice still sounds like hers.
- **Time**: the compás falls on the song's downbeats (§ Signature), so a voice lands on the music,
  never across it.

**How loud: under the music, never in front of it.**
- **Level**: at *f* an eco is about **12 dB under the song** (the song's median is −17 dB), and at
  *p* about **18 dB under**. Between them sits *mf*, 3 dB under *f*. For comparison, the haunt's
  sounds are 8 to 21 dB under their song (`docs/audio.md`).
- **More ecos are not louder**: with two ecos each note goes 3 dB down, and with three 4.8 dB, so a
  chord is as loud as one eco.
- **Placement**: everything goes through a long reverb (2.8 s, wet over dry), so the voice sits far
  back. The high-pass leaves the bass and body to the song, and the low-pass takes off the breath
  and the sibilants.
- **Bus**: the ecos play on the effects bus, so the player's sound settings govern them.

**What sings when.**

| Moment | Her voice |
| --- | --- |
| An eco is called | Its note comes in softly as it settles (a quarter-second attack) |
| A pulse | Each eco's note, short (0.7 s), together |
| *A contratiempo* | The same notes clipped short (0.22 s) and 2 dB up: an accent off the beat |
| Crescendo | The notes swell in slowly (0.45 s) to the new grade |
| The chord | A pulse with all three: Fa, La and Do together. Nothing else marks it |
| Da capo | The start of her phrase, *Do Sol Fa Re* |
| Tutti | All three, 3 dB over *f*: the only time the voice comes forward |
| Muffled | Behind a door: low-pass 650 Hz, 9 dB lower, half the reverb |

In the game the grains go to `public/sfx/` as `eco-fa`, `eco-la`, `eco-do` and `eco-dacapo`.
For now they sit in the sketch: `output/mockups/sincopante-ecos/audio/`.

### On the wearer

- **Recolours** (`look`, in `CLASSES`): `jacket` a nácar white, `navy` a deep petrol (the dark of
  Las cuerdas), `cream` a pale seafoam, `trousers` petrol.
- **On the rig** (`src/anima-looks.ts`): two thin concentric rings floating behind the shoulders,
  at the nape and tilted, a halo that is also the Eco's rings. They breathe with the compás and
  shine a little more for each eco standing. A ripple spreads under the feet on each beat.
- `scarf`, the colour over the portraits: seafoam nácar.

### Colour and interface

- **Colour** (proposal): `#8fe3c4`, seafoam nácar, with a light `#eefbf6`, a pale gold `#f2e2a8` and
  a dark petrol `#0f2a2c`. It sits clear of Tecnópata's cyan (`#4fe0ff`, bluer and harder) and of
  Dadista's astral (`#bfe0ff`, blue); there is no pink and no violet.
- **Theme** (`#hud[data-class="sincopante"]`):
  - panels of dark petrol glass with a fine double border in nácar (two hairlines 3 px apart), and
    concentric arcs at the top corners;
  - headings in small capitals with wide spacing;
  - the selected command lit by a soft ellipse of light behind it rather than a box;
  - while ecos sound, the dock's border breathes faintly with the compás (its light, never its
    size).
- **New on the plate**: only *Compás* (§ Signature).

## In the world

- **The unlock** (proposal, beat 4 of Marta's mission, `docs/quests/marta.md`): back in Alegia,
  Aitor plays *Izana dena geroa* again and Marta sings it well. As the song ends, three notes of her
  voice stay in the air over the piano as three rings of light (Fa, La, Do), then go into whoever
  will wear the ánima. *ÁNIMA DESBLOQUEADA · Sincopante*. Flag `anima-marta`, already set at the end
  of her mission (`src/story.ts`).
- Nothing else in the street for now: everyone wears their own clothes there.

## Second round

Proposal: grey in the first round. In the second round with Marta (still open in her mission) it
takes its colour, nácar. **Her voice is in the ecos from the start**: the ánima is her voice, back.

## Implementation

**Built** (2026-11-21):
- **The ecos and the compás** in the rules (`src/battle.ts`): `Eco`, `ECOS`, `BattleState.ecos` and
  `compas`, sounding from `runClock` (`runEcos`): a pulse every 5 s, 20 s each, three at most (a
  fourth replaces the oldest), muffled at half while their wearer is in another ánima, out at once if
  they fall. What they do on their own goes to `takeEcoNews`. A pulse is not a blow: no golpe
  crítico, no wound, no reaction.
- **The ánima**: Ostinato and Bordón (`eco`), Crescendo (`raise`), Acompañamiento (`accompany`),
  Tutti (`tutti`) and Da capo (`capo`, `ulti`) in `SKILLS`; *A contratiempo* and *Pedal* in
  `PASSIVES`, with levels 3 and 6 (`contratiempoOf`, `pedalOf`); Sincopante in `LEVELLED`
  (`src/levels.ts`) with its level flags; Da capo at the jar like every definitiva (`src/ecos.ts`),
  awake once a chord sounds (`capoReady`). The *Ecos* description shape is in `AGENTS.md` and
  `tests/battle.test.mjs`. A dual is an action too: Acompañamiento repeats it, and it can be played
  off the beat.
- **The look in the fight**: `src/eco-fx.ts` driven by the rules (`EcoScene.driven`): the scene
  (`src/battle-scene.ts`) calls each eco, sounds it on its beat on whoever the rules say, raises it,
  puts it out, and plays Tutti and Da capo; Acompañamiento's eco floats at its ally's shoulder, two
  thirds the size. *Compás* on the wearer's plate (`src/battle-ui.ts`): a ring whose hand goes round
  once a beat, with the beat and off-beat notches; each note's number is named *Eco*.
- **Her voice**: the four grains in `public/sfx/` (`eco-fa`, `eco-la`, `eco-do`, `eco-dacapo` in
  `SOUNDS`, `src/sfx.ts`), a note for each eco on its beat, the chord in Crescendo and Tutti, her
  phrase in Da capo; silent while muffled.
- **The fight tester**: its levels, Da capo at the jar, and *Contratiempo seguro*
  (`BattleState.sureOffbeat`). `just screenshots sincopante-crece --gpu` plays it whole.
- **The bot** (`src/battle-sim.ts`) values the notes still to come (`ecoWorth`) and Da capo.

**Not built yet**:
- The reverb on her voice and the muffled filter (650 Hz low-pass): today a muffled eco is silent.
- The compás locked to the song's downbeats (`TRACKS` in `src/music.ts`), and a `key` for each
  fight song to transpose the grains.
- The rings on the wearer's nape and the dock's theme with the mark.
- The unlock moment at the end of Marta's mission (the three notes over the piano): today the
  ánima comes with `anima-marta` as before.

## For the balance, later

`just fight-sim` plays it now. First run (2026-11-21, `smart`, Gerard on Matemágico): Sincopante wins
as often as Papagato and Colorista (El Campeón 100 %, La Voz 98 %, Aurelià 88–93 %) but the fights
last about twice as long (El Campeón 9–11 rounds against Papagato's 7; Aurelià 22 against 12). The
bot calls, raises and spends the ecos (Ostinato, Crescendo, Tutti, Bordón) and holds on a lot. Numbers
to watch:

- **The eco's pulse** (base 4, 6 on Aitor). It is the number that decides whether Sincopante outdoes
  Atacar while its wearer holds on. In *What a round looks like* it gives 97 against Atacar's 60
  over three turns, and it should stay above Atacar without making Defender plus Pedal the best
  play every turn.
- **Crescendo at 1 maná**. It restarts every eco, so its worth grows with how many ecos are up.
- **The *f* grade with three ecos**: 27 on each foe every beat, or 9 cure on each ally every beat.
- **Tutti**: 92 on every foe at most. If that is too much, the ecos' last note goes from ×2 to ×1.5.
- **The clock**. A slow player gets more beats per round (with `think: 8`, about four), as with
  fire.
- **Da capo**: how much a second Rayo solar or Zarpazos de fuego is worth against a boss, and
  whether filling every ánima's maná is too much on top of it.

## Open

Answered by Aitor on 2026-11-20: feeding is cut; the ecos keep sounding, muffled; her voice is
theirs. Still open:

1. **What muffled means in numbers**: half strength. *Recommendation*: yes. Staying in Sincopante
   should be worth more than leaving its ecos behind, and half is easy to read.
2. **The compás on the song's downbeats** (4.8 s in the battle song), with each song's key for the
   grains. *Recommendation*: yes. It is what keeps her voice from crossing the music.
3. **A new description shape, *Ecos*** (for Crescendo and Acompañamiento), with Da capo marked
   `abstract`. *Recommendation*: yes. Marking them all abstract would hide an ánima whose skills
   are exact.
4. **An eco costs 2**, where you said 3 on 2026-11-14. *Recommendation*: 2, with Crescendo at 1.
   At 3, calling one empties the pool and a Crescendo has to wait two rounds.

Notes, not questions:

- *Eco* now names four things: the party's Ecos de luz, the Eco of Las cuerdas, the one La Voz
  calls with *Coro*, and these. In a fight the context tells them apart.
- *Crescendo* is also La Voz's rule (her Magia rising with each phrase): her crescendo, made the
  party's.
- A boss could silence the ecos with a named move announced on its plate a turn ahead. Designed
  with each boss, if any.
