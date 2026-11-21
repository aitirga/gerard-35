# Chapter 2 · La ciudad abierta (Barcelona)

Gerard wakes up at 35 in the Meridiana flat, on his birthday, shouting "¡NO!". The TV is showing
something impossible: **a pink castle has appeared on top of the Rec Comtal school**, with every
pupil still inside. From here the chapter is **open**: Gerard and Aitor cross Barcelona on foot,
by metro and by train, find Gerard's friends one by one, help them with what La Reina Bubbaloo has
done to them, and come home stronger with their **ánimas**. The castle can be tried at any time
from the moment they reach the metro; it is far too strong at first, and that is the point.

The themes behind it (routine, growing up, being a kid again, deciding who you are) and the twist
are in `docs/lore.md`; the city map, the metro and the train are in `docs/barcelona.md`; the
palace's rooms are in `docs/bubbaloo-palace.md`; two players in `docs/party.md`.

| Block | Status | What |
| --- | --- | --- |
| 0 · Despertar a los 35 | Playable | Gerard wakes shouting "¡NO!", Aitor joins the party (player 2), the Bubbaloo wrapper |
| 1 · La noticia | Playable | The TV turns itself on: ÚLTIMA HORA, the castle on the Rec Comtal; out to the Meridiana; the metro door |
| 2 · La primera subida | Playable (first slice) | Metro to Trinitat Vella, the castle on the school, its guards: far too strong. Falling wakes Gerard at home with everything kept |
| 3 · La ciudad abierta | Plan | Friends across the city and beyond (Cardedeu by train), their missions, their ánimas; hidden clues |
| 4 · La Reina | Plan | With enough ánimas Gerard reaches the throne: the twist |
| 5 · La segunda vuelta | Plan | Back to the friends with new eyes; the colour of each ánima; the final choice |

## What changed from the loop design

The first plan for this chapter was a time loop (a clock, friends forgetting every morning). It is
replaced by **open progression**, as decided on 2026-10-18:

- **Nothing resets.** Whatever Gerard has done stays done: friends remember him, ánimas, classes,
  opened doors, learned clues. Losing a fight is not a game over and costs nothing but the trip.
- **Falling is waking up, in the castle.** When the party falls in the castle (the palace and
  its zones), the screen goes pink and black and Gerard sits up in bed at home, "¡NO!", with Aitor
  beside him, and the day is over: the castle is strict, and it is crossed by the checkpoints its
  bosses leave. It keeps the dreamlike opening of the old loop, and it is diegetic: Gerard
  literally wakes up from it. Aitor's line changes with how many times it has happened.
- **Anywhere else a fall costs nothing** (decided on 2026-11-05): in the missions and the city the
  lost screen offers *Reintentar el combate* (the same fight from the start) and *Volver a antes
  del combate* (as if it never began), `forgiving` and `fallen` in `src/battle-ui.ts`, decided in
  `src/main.ts`.
- **But the days count** (decided on 2026-10-18, see *The Queen's advance* below): an unspoken
  countdown gives time a meaning and keeps side activities from eating the game.

## The morning (block 0 and 1)

1. Black, then Gerard and Aitor asleep in the same bed, Aitor slowly stroking the back of
   Gerard's hand, the flat dark but for the daylight through the bedroom door. "¡NO!" Gerard bolts
   upright and Aitor sits up beside him; after the first words they get out of bed on either side
   and the lamps come on by themselves. The Bubbaloo wrapper is on the nightstand (all playable
   already; `src/bed.ts`, `wake`/`rise` in `src/game.ts`).
2. **The TV calls him.** Leaving the bedroom, the living room flickers: the TV has switched itself
   on. If Gerard heads for the front door first, Aitor stops him: *"Espera. ¿Oyes eso? La tele se ha
   encendido sola."* (a diegetic gate, the only one in the flat).
3. **The TV in the living room plays the news all day, looping, while they are at home**: it is a
   real TV in the room, filmed in 3D (`src/news-tv.ts`), never a full screen over the game. It films
   15 pictures a second while the screen is in view and 30 while someone watches it up close, with no
   shadows on the set (`docs/graphics.md` § Performance).
   **Approaching it** (no key: just walking up to it) the camera comes close to the screen to watch
   it; *"Mirar la tele"* does the same later, and any key looks away. On the screen:
   - a red **ÚLTIMA HORA** band and the headline *"Aparece un castillo rosa encima de la escuela
     Rec Comtal"*, with the subtitle *"Todos los alumnos estaban dentro"*;
   - **filmed images in a loop**: the screen cuts to Trinitat Vella in 3D, the castle on the
     school at its most threatening, filmed like real news: from the helicopter, the reporter
     in front of the cordon with the castle behind her, a neighbour's shaky phone, the street
     behind a patrol car with its lights going (`docs/barcelona.md` § The TV news set);
   - a **ticker** along the bottom with the day's other news. This is where the first
     **hidden clues** live (see below): *"Rodalies: la R4 se amplía desde La Sagrera hasta
     Cardedeu"*, among ordinary items.
   - The headline changes each morning with the Queen's advance (below).
4. After it, Gerard and Aitor talk: the castle is *the* castle from his dream. Aitor still
   half-believes it is a dream; he comes anyway (*"Donde vayas tú, voy yo"*).
5. **The front door** now opens onto the **Meridiana**: the avenue, its trees and benches, the
   flats, and the **metro entrance** with its red sign. Walking up to it marks the moment the city
   opens (`metro` flag): from here every line Gerard knows is a way to anywhere, including the
   castle.

## The Queen's advance (the unspoken countdown)

If Gerard and Aitor do nothing to stop her, La Reina Bubbaloo's power keeps spreading, and one day
they wake up and there is no flat any more. Nothing on screen counts it; the world shows it.

**Days and hours.** Each day runs from 08:00 into the night; the clock stops at 22:00 (`src/days.ts`). Looking, talking and walking
are free; doing things takes hours:

| Activity | Hours |
| --- | --- |
| A metro trip | 1 |
| A fight (the palace guards) | 2 |
| Playing the piano at home | 2 |
| A coffee on the balcony | 1 |
| A friend's mission (Nuria's: 1 going into Uri's tower, 2 more when it is won) | 2–4 |

At 21:00 night falls (Aitor: *"Ya es de noche, Gerard. Vámonos a casa."*), and a friend's mission
won or a milestone in her palace brings it at once (see [Night and the way home](#night-and-the-way-home)).
The day ends when they get home at night (through the portal), when they go to bed (*"Dormir"* at
the bed, once the news has been seen), or when they fall in a fight. Black, and they wake up the
next morning in bed, "¡NO!", with everything done kept.

**How it is told, never counted:**
- The light: from 18:00 the evening turns pinker, and Aitor says so (at 18:00 and at 20:00).
- The TV at home: the headline gets worse each morning (`NEWS.stages`): it grows over Trinitat
  Vella, reaches Sant Andreu, the Meridiana…
- Aitor every morning: more worried each day (`LINES_2.morning`). It is Gerard's birthday every
  morning (decided 2026-11-07): the date stays on 22 November while everything else moves on, and
  Aitor says so.
- The castle: bigger each day on the school (up to 1.6 times), the streets pinker (Trinitat Vella,
  then the Meridiana outside the flat, then the flat).
- The network map: the pink halo round the castle widens over the city.

**Her spread** is `(day − 1 − 3 × ánimas) / 6`: six days without any help and on the seventh
morning it reaches the end; **each ánima wins three days back**, and so does **each boss of her
castle beaten** (Aurelià, the Equipo de dirección; decided 2026-11-19), so a castle begun late can
still be finished. So a day spent on the piano and
coffees is a day closer to the end, and a day spent helping a friend pushes her back. Each friend's
mission should fit in a day.

**The lights** (decided 2026-10-24, first in Nuria's mission, `docs/quests/nuria.md` § The
lights): every person Gerard helps gives a light, kept in a jar at home: the party's **Ecos de
luz**, which improve the ánimas (`docs/animas/README.md` § Ecos de luz). The jar shows how many
there are, never whose they were, and the HUD counts the free ones (a chip beside the menus'
buttons). Until 2026-11-05 a light could be let out for a day against the Queen; no more.

Built: the jar stands on the round dining table in the comedor, opened from its east side (`PLACES_2.jar`), a glass jar with
a cork and one marble per light, amber while free and dark once in an ánima. The first time home
after a win, the lights fly from Gerard and Aitor into it. *Abrir el bote* opens its screen
(`src/jar-ui.ts`).

**The end.** On that morning the flat is already part of her castle: gum over the walls and floors,
thorns, everything pink (`story.doomed`). Aitor: *"Hemos llegado tarde."* A screen says she has
covered everything, with one button: **Volver al día anterior**. It takes them back to the morning
before, with that day's progress lost and everything before it kept (`story.rewind`): Gerard wakes
up "having seen tomorrow". To get out of the loop they must do something that day that pushes her
back.

**Saving.** The day, the hour and the last two mornings are saved with the story. Going back a day
is the only thing that takes flags away, so the save carries an `epoch` that grows with each
rewind: the server lets a newer epoch replace the flags, and ignores tabs still on an older one.

## Night and the way home

Decided 2026-11-07 with Aitor, and redone with him 2026-11-20 (each pupil hunts its own way, the
afternoons, no night after a castle boss); built in `src/night.ts` (the night's tiers, light and
cover), `src/night-pupils.ts` (how each pupil hunts), `src/night-lights.ts` (light), `src/game.ts`
(`huntAtNight`: bodies, sounds, Aitor's lines), `src/story.ts` (`nightfall`, `home`, `night-guard`).

**When night falls.** Three ways, all in `src/story.ts`:

- **Back from a friend's mission** (`nightfall()`): at once when it is won, with Aitor's line. The
  mission's place is far from home, so the way back is the night's walk.
- **An afternoon spent** (§ Spending the afternoon): in bed, on the sofa, cooking, at the gym or
  with the choir. It is night at once.
- **The clock** reaching 21:00.

Her castle brings no night (docs/castle.md § Structure): the guards before the curtain bring
nothing, and a boss beaten ends the day with her scream and a flash, in bed. At night the day no
longer ends by itself: the clock stops at 22:00, and the day ends through home's portal (Aitor:
*"Ya está. Dentro."*), in bed, or with a fall.

**What the night is for.** Getting home, and finding out how strong the party is before going into
her castle: out here a fall costs a late morning, in there it ends the day's run. What walks the
street is what waits inside (the pupils of the castle's floor the party is on), so the street
teaches each of them by its body before its fight asks its question.

**How night looks, outdoors only.** Every street scene (`scenery.outdoor`) fades to `NIGHT_LIGHT`
(`src/scenery.ts`): a low cold moon, a deep blue ambient, the sky's reflections a street night
(`LIGHTING.sky.streetNight`), a dark city blue past the map. Lit flats and shop windows glow (the
dusk's own glow, at full), the lamps' heads glow, and the ten lamps nearest Gerard light the
pavement for real (a pool of lights handed from lamp to lamp, so the frame never pays for more);
home's portal, the station halls and VivaGym's window keep their own lights. Moving cars carry
head and tail lights. Her pink stays low in the haze, more as she spreads. While one of them runs
at Gerard the screen's edges close in, cold and dark, and beat (`#hud[data-hunted]`).

**The way home.** The Meridiana's station is the L1's real Fabra i Puig, at its Concepció Arenal
entrance on the even side, about 300 m and one crossing from home's portal at Meridiana 335 on the
odd side ([places/meridiana.md](places/meridiana.md#home-at-meridiana-335-the-avenue-turned-round)).
Coming out onto the avenue at night, the castle's pupils climb out of the vent grates (the
station's under the plaza, the median's over the trains) in groups: the floor's rooms in turn and
La Delegada's last (`nightGroup` in `src/castle.ts`). Once up, **each pupil is a body of its own**
with its own figure and gait (`src/castle-models.ts`), walking its own round and hunting its own
way. The one that touches Gerard brings its whole group's fight.

The street's rules, for everyone (`STREET` in `src/night-pupils.ts`, every number in one book):

- **Light gives you away.** In a lamp's light they see Gerard from far off; in the dark between
  lamps only up close, a little further once they are after him.
- **Running is heard.** A run is heard from 11 cells in the dark, and whoever hears it comes to
  look. Walking is silent. Running is still the only way to outpace most of them: the choice is
  the night's.
- **They doubt, then they look.** One that sees Gerard doubts for a moment before running at him
  (stepping back into the dark in that moment loses it). One that loses him goes to where it last
  had him and looks round there before going back to its round.
- **Cover hides.** Standing still behind the containers, the bus shelter or a café terrace, out of
  the light, is out of sight. Aitor says it once, the first time they are chased near cover:
  *"¡Ahí detrás! Y ni te muevas."*
- **Cars flatten them.** Traffic stops for Gerard and Aitor, not for them: one caught on the
  carriageway by a moving car is flat for six seconds, then peels itself up. Crossing between cars
  loses them.
- **The portal is safe.** Its warm light is the brightest on the street, and they never step into it.
- **Each train brings more.** A train under the median puffs out of the grates and, at night, one
  more group climbs out after it, never in the party's face.

And each one's own way, which is its fight's way (docs/castle.md § The pupils):

| Pupil | Year | On the street | What gets past it |
| --- | --- | --- | --- |
| El Repetidor | 1 | Slow. Seeing Gerard within nine cells it stops, leans back and paws the ground (dust at its feet), then charges in a straight line it cannot leave, nearly twice as fast as he runs. | Step out of its line in the last moment: it crashes into what is there and stays dazed four seconds. |
| La Chivata | 1 | Never runs at him. She sees half as far again, keeps her distance and points: a line of glints from her to Gerard, and everyone within forty cells knows where he is while she has him. | Break her line of sight (dark, cover); or go for her first, she is the weakest fight. |
| El Empollón | 1 | Hunts like anyone, but when Gerard loses it behind cover it learns that kind of cover: the next time it goes straight to the nearest one and looks behind it. It remembers one kind, the last. | Do not hide twice the same way: containers, then a shelter, then a terrace. |
| Los Gemelos | 1 | Two as one: what either sees or hears both know. The nearer one follows; the further one runs round to where Gerard is running to. One flat under a car is got up by the other. | Do not run straight away from one. Turn, cross, or stop behind something. |
| La Delegada | 1–3 | Never runs, never stops: she walks at Gerard wherever he is, and cover and dark mean nothing to her. While she is out the others doubt less and do not give up. | She is slow: distance. Or her fight. |
| El Ausente | 2 | Only seen in a lamp's light or while it runs at him; it sees in the dark as far as the others do chasing. | The lit stretches, where Gerard is seen, are where it is seen too. |
| El Castigado | 2 | Stands facing the wall and hunts nobody. Each run near it is a point of Rabia (it swells); at three it bursts: everyone within thirty cells comes, and it runs fastest of all without doubting or giving up. | Walk past it. |
| El Montón | 3 | Does what Gerard does: stands while he stands, walks when he walks, runs when he runs, nearly as fast. It needs no sight of him. | Walk away from it, far enough that it lets go. Running never loses it. |

Nothing on screen names these rules. They are read off the bodies (the lean, the dust, the line of
glints, the swelling) and Aitor says what he sees of each the first time, in a speech bubble
(`showNight` in `src/game.ts`): *"¡Ese toma carrerilla!"*, *"La pequeña nos señala. Mientras nos
vea, lo saben todos."*, *"Esa no corre. Tampoco para."*… He also sizes them up the first time they
show: whose floor they come from, and by the friends' ánimas whether to stop (`sizeUp`).

**Caught.** The group of the pupil that touched Gerard is the fight, with the castle's own rules
(`night-guard` with a `NightFight`), stronger out here the fewer friends and levels the party has
(`nightMight`: PV and blows times its might, never weaker than inside): on the first nights it
cannot be won, with the friends' ánimas and grown levels it can. Escaping is allowed, and the group
stands still a few seconds after it. Beaten, they wake at 11:00 the next day (*"Las once…"*);
winning melts the group and the hunt goes on. Its numbers are provisional (book `night`): Aitor
balances the night later, and El Empollón and La Chivata's group is still won from the first night.

How hard it is goes with her spread (`NIGHT_TIERS`, by `stage`):

| Tier | Stage | A group posted every | Pupils posted | Groups by the party | Per train | Walk / run (cells/s) | Sight lit / dark / chasing | Trains every | Lamps out |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calma | 0–1 | 12 cells | some 65 | 2 | 0 | 1.4 / 4.4 | 8 / 3 / 5 | 40 s | none |
| tensa | 2 | 8 cells | some 100 | 3 | 1 | 1.6 / 5.2 | 9 / 3 / 6 | 28 s | none |
| dura | 3 | 6 cells | some 130 | 4 | 1 | 1.8 / 6.2 | 10 / 4 / 7 | 22 s | none |
| última | 4 | 4.5 cells | some 175 | 5 | 2 | 2.0 / 7.2 | 12 / 4 / 8 | 18 s | one in three |

**The avenue is theirs.** When night falls a group is out already every so many cells of the
avenue's length (`every`, `postGroups` in src/night-pupils.ts over `postsAlong` in src/night.ts): on
both pavements and the median, never on the carriageway nor in the far side streets (`avenueRows`),
none within a few cells of where the party comes out, each pupil on a wide round of its own. On top
of those, groups climb out of the grates by the party as it comes out and with each train, up to
twice the tier's count. Only the pupils near the party have a body, and only those on screen are
drawn and moved (`syncStalkers`, `placeStalkers` in src/game.ts): the last night costs some 6.4 ms a
frame of the 8.3 there are. How full it is has not been played yet and is Aitor's to set: the
picker's **Cuántos** (`&crowd=`) halves, doubles or triples it without touching the tiers.

Gerard walks at 5.2 cells/s and runs at 7.8: at first they are slower than a walk; on the last night
only running keeps ahead, and running is heard. The fight sim holds the street fight to that (`noche-sin-amigos`, `noche-con-nuria`,
`noche-con-tres` in `TARGETS`); the game simulator walks home by the same rules
(`src/game-sim.ts`). Development: `just dev-night <castle stage 0–4> [<ánimas>] [<year 1–3>]`, the
picker's *De noche · La vuelta a casa* (its level is the castle's stage, *Alumnos* the year whose
pupils are out), Hora (Noche), the fight tester's *De noche en la Meridiana*, and
`just screenshots camino-a-casa` and `just screenshots alumnos-de-noche` (each pupil's moment,
staged through `game.nightStreet`).

For later: balancing the night (each floor's groups, and levels raising the ánimas' stats a little,
proposed by Aitor 2026-11-20); a tell for Gerard himself when he is out of sight behind cover.

## Spending the afternoon

Decided with Aitor 2026-11-20; `EVENINGS` in `src/days.ts`, `spendAfternoon` and `afternoonGone` in
`src/story.ts`. From the news on, the afternoon can be spent somewhere: a line or two, the dark, and
it is night at once. The bed only passes the time (every fight starts with full mana anyway); the
other four leave **one state**, for the whole party, that lasts that night and the next day and
shows in a fight as any buff does (its arrow over each head, its line in the summary). One at a
time: the last afternoon is the one that counts. It is never announced beforehand: the first time,
the note that comes with the night says what it was (*Hasta mañana por la noche*).

| Where | Offered as | What happens | Leaves |
| --- | --- | --- | --- |
| The bed (home) | *Echarse un rato* by day, *Dormir* at night | Gerard lies down, Aitor wakes him when it is dark. At night the bed is sleeping, and the day ends. | Nothing: the hours |
| The sofa (home) | *Sentarse en el sofá* | Aitor scratches Gerard's back until neither notices the light go. | **Tranquilos**: Espíritu +2 |
| The kitchen (home) | *Cocinar* | Gerard cooks what is left, Aitor lays the table and opens the wine. | **Bien cenados**: Crítico +10 |
| VivaGym (next door, on the avenue) | *Entrenar en VivaGym* | An afternoon at the gym. Out of it, it is night ten steps from the portal. | **En forma**: Fuerza +2 |
| The choir (on the avenue, 80 cells from home) | *Ensayar con el coro* | A rehearsal; the first one is where they learn Emilie is missing (docs/quests/coro.md). The way home from it is a real walk at night. | **Afinados**: Magia +2 |

At night there is no afternoon left: each of them answers with a line instead. The state is kept
with the days (`Days.boost`, saved by the server) and goes with the morning after next. Seen in
`just screenshots pasar-la-tarde`.

For later: the gym's and the choir's doors are interactions on the avenue's pavement, with no
interior of their own yet; cooking is one dish.

## The snow globe

Asked for by Aitor 2026-11-14; built in `src/story.ts` (`shake`, `Kept`, `recall`), `src/items.ts`
(`bola`), `src/main.ts` (kept in the browser, `gerard35.bola.v1`).

A snow globe stands on the TV unit in the flat from the morning Gerard wakes at 35 (`PLACES_2.bola`,
flag `got-bola`): it is snowing inside with nobody having touched it, and what is under the snow is
their own portal. Taking it is a key object; the note shows the Objetos key.

**Shaking it** (Objetos, *Agitar*) does two things:

- **It keeps the missions.** Each friend's mission as it is at that moment (what was beaten, how far
  up the tower, what was said) is what the globe keeps. From then on a day's end, a fall or a reload
  puts the missions back to the last shake instead of to nothing, so a mission no longer has to fit
  in one day. A mission won drops out of it; rewinding a day empties it.
- **It brings the party home**, inside the front door, through a white of falling snow. No hours spent.

What does not come along: Nuria's cats (she lends them again at her door, and the tower stays as
far as they got) and a game of tag in progress on the sand. Shaken at home it only keeps. **At
night it does nothing** (*"De noche se queda quieta"*): the way home at night is the street's
(§ Night and the way home).

Try it: `just dev-chapter got-bola`, `just screenshots bola --gpu`.

## Getting around

- **On foot** inside each place (a playable scene: a street, a square, a friend's house).
- **By metro and train** between places: each station entrance is an interaction (*"Bajar al
  metro"*). It opens the **network map** (`docs/barcelona.md`): a cartoon Barcelona with its sea,
  hills, streets and blocks in 3D, avenues and famous places as icons, and for now only the L1 (red) and L5
  (blue); the train to Cardedeu comes with Cardedeu. Gerard picks a station; the train runs along
  the line on the map; they come up out of the destination's entrance.
- The map shows **where Gerard is**, the lines and their stations; only stations that lead to a
  place are selectable. It never marks a friend, a mission or "go here": the world tells him that.
- Travel is instant and free (no clock). A line can be closed by the story (a gum-blocked tunnel, a
  strike), always with a person or a sign saying so.

## The palace, any time (block 2)

From the moment they reach the metro, the L1 takes them to **Trinitat Vella**, a short walk from
the school. The **Institut Escola Rec Comtal** has grown into La Reina Bubbaloo's palace: the same
building as in chapter 1 (`docs/bubbaloo-palace.md`), grown out of the school instead of set on
top of it. La Pompa (the gate) fills the school's front door on the pavement of Via de Bàrcino,
its pillars half in the wall and a pink runner out to the kerb; its gum ramparts cover the ground
floor either side, and the two wrapper towers climb out of the front wall. The keep, the wings
and the crown stand on a layer of gum over the roof, which rounds off over the front wall and drips
down it, and the spiked towers stand round the school with their feet in the street, where nobody
can walk through them. Each day it grows taller, never wider than the roof (`seat` in
`src/palace.ts`). La Pompa lets anyone in.

- **Inside is the same palace**, as Gerard remembers it from the dream. Aitor sees it for the
  first time; his lines carry the surprise.
- **Its guards are far too strong.** The Guardianes de Chicle stand before the gum curtain that
  hides the throne stair. Crossing it means a fight that, without ánimas, cannot be won. That is
  the first lesson of the chapter: go and see, lose, wake up, go and find the friends.
- **Each ánima weakens them** (and strengthens the party), so every return is visibly different:
  fewer guards, smaller, slower. With enough ánimas the fight is fair, and the curtain parts onto
  the castle's first phase (docs/castle.md), not the throne.
- **Escape is allowed** from the guards (back to the hall), unlike the dream's fights: it is a
  place to probe, not a trap.
- **Losing** wakes Gerard at home (see above). The palace remembers only its bosses beaten
  (docs/castle.md § Structure); the party remembers everything.
- **Behind the hall's east door, the school.** At 35 the door shows the school's orange frame
  under her gum and opens onto the yard: the palace's zones (el patio, el gimnasio, la
  secretaría, el salón del trono), each with its own colour, the school transformed
  (`docs/places/palace-zones.md`). Their doors stay shut until the story opens them.

**The castle itself shows it.** At first it is very, very threatening: twice the size of the
dream's palace, a ring of twelve spiked towers with lit slits, thorns along the ramparts, glowing
eyes on the keep and a storm turning over the crown. Its **threat** goes from 1 down as the party
gathers ánimas (`castleThreat` in `src/animas.ts`, 0.15 per ánima, never below 0.1); every piece
has a threshold and falls when the threat drops below it: the small outer towers first, then the
thorns, the storm, the eyes, and last the tall towers guarding the keep. The castle on the
network map loses towers and shrinks with it.

Guard strength is a pure function of the ánimas the party holds (`palaceGuards` in
`src/battle.ts`). Provisional numbers: three guardians with 220 PV and 30-point hits with no
ánimas, losing a guardian every two ánimas and 30 PV and 3 points per ánima.

## Friends and ánimas (block 3)

The heart of the chapter. Each friend's mission is designed in its own doc under `docs/quests/`
(Nuria: `docs/quests/nuria.md`). La Reina Bubbaloo has blown her bubble over the lives of Gerard's
friends: what held their adult days together has popped (the office is gone, the alarm does not
ring, the train to work never comes, the to-do list is blank). They are lost and sad: *"si no voy
a trabajar, ¿qué soy?"*. Gerard finds them, spends time with them, helps with what they need. When
he does, a small light leaves them and goes with him: their **ánima**, what makes that friend
who they are. Each ánima:

- **makes the party stronger** (a stat bonus for everyone), and weakens the palace guards;
- **brings something of that friend into Gerard**: a wearable ánima (as Papagato came from
  Nuria's cats) or a skill, and often a key for somewhere else in the city (a gum wall, a calm word for a possessed
  animal, a flooded street);
- shows as a coloured light in Personaje (the HUD rule: it is something the party *has*).

Friends are visited in any order; some are only reachable once another has given Gerard what is
needed (a class that opens a gate). Nobody lists them: people mention each other, places point to
places, clues hide in the world.

Template per friend:

| Field | Example |
| --- | --- |
| Who | **Nuria and Uri**, friends who live in **Cardedeu** |
| How Gerard learns of them | A hidden clue (the R4 extension on the TV ticker and on La Sagrera's platform posters), a photo in the flat, a voice message |
| How to get there | Rodalies from La Sagrera, the line the clue talks about |
| What's wrong | The Queen's bubble over their routine (to design with the real people) |
| Mission | Something only they could need, unique in mechanics and look |
| Ánima | Name, colour, stat bonus, the class or skill it brings |
| Second round | What their ánima's colour is, and what being a kid again means for them (block 5) |

Friends so far:

| Friend | Where | Mission | Ánima | Lights | Status |
| --- | --- | --- | --- | --- | --- |
| **Nuria and Uri** (one mission), with Nil | Carrer de Jacint Verdaguer, Cardedeu (R4 from La Sagrera) | *La calle que no acaba*, then through a bubble *La torre de Uri*: Uri, a kid again, climbs a dark tower; his fears hunt the ramp and Vertitrón waits on top (`docs/quests/nuria.md`) | **Papagato** (Haru and Yuki fight with the party) | Nuria, Uri | Playable on `feat/nuria-mission`; Nuria's and Uri's portraits to come |
| **The university friends** (seven: Anna and Álvaro, Miquel and Sarah, Soraya, Nico, Joan) | The beach of the Barceloneta (L4), then **Càmping Eurosport** through a spiral in the sea | On Gerard's birthday, with violet eyes, they want to play tag (pink tentacles; caught is back up the sand); past the spiral, their old campsite: Las parcelas (a word-clue puzzle), El Campeón, and **La Sobremesa**, all seven fused at the long table (`docs/quests/universidad.md`) | Provisional (`ANIMAS.universidad`); its skills to design | Five: Anna and Álvaro, Miquel and Sarah, Soraya, Nico, Joan | Playable on `feature/side-mission-uni` |
| **Marta** | **Alegia** (how the trip is paid is open) | She has lost her voice, and with it what made her herself. Aitor plays their song on a piano, it comes out wrong, and a note opens the bubble into **Las cuerdas**: three mazes that move with her voice, her three lost qualities (La Lealtad, Lo Cristalino, Lo Directo) and **La Voz**, who can only be hurt while a note sounds (`docs/quests/marta.md`) | Provisional (`ANIMAS.marta`); the wearable ánima to design | Marta | Playable on `feat/side-mission-marta` as a base to try; clues, the trip, her figure and her recordings to come |
| **Luca** (Fran, his partner, is the boss) | The **Sagrada Família** (L5): Luca outside by the pond, the salon inside | Luca has gone grey; Fran, brilliant under the Queen, is turning the basilica into his hair salon with Luca's colours. Zone by zone, **the light walks and cancels the party's element of its colour**: Las Polillas, Los capellanes and La Laca, Los Estampados, El Telescopio, then **Fran** under the altar's canopy (`docs/quests/luca.md`) | **Prismático** (wearable to design; today `ANIMAS.luca`) | Luca | Being built on `feat/side-mission-luca` |
| **Pedro** | _open_ | _open_ | _open_ | Pedro | Idea (2026-11-05): a gay friend Gerard and Aitor see a lot; Aitor wants him in the game. To design with `/side-quest` (mission, `docs/quests/pedro.md`) and `/anima` |

Each friend's mission is a small, hand-made piece: its own scene or two, its own lines, often one
mechanic nobody else uses. The shared parts (scene, travel, dialogue, flags, ánima, battle) are
generic; what makes it theirs is data and one script hook (`docs/barcelona.md` § Architecture).

## Hidden clues

The game never says where to go next. Clues are scattered **randomly in the world**, in places a
curious player looks: the TV ticker, posters on a station platform, a neighbour's line, a phone
notification, graffiti, a menu on a bar's board. A clue:

- reads as an ordinary bit of the world, never highlighted;
- teaches something true about the city: *"Acaban de extender la R4 de La Sagrera hasta
  Cardedeu"* tells the player a train goes somewhere new, and Cardedeu is where Nuria and Uri live;
- is remembered (a `clue-*` flag) when Gerard sees it, so later lines can build on it (Aitor:
  *"¿No decían en la tele que la R4 ahora llega a Cardedeu?"* only once the clue has been seen);
- appears in more than one place, so missing one never strands the player.

| Clue | Where | Points to |
| --- | --- | --- |
| Aitor: the university group has written all morning, they wait on the Barceloneta's beach for his birthday (`clue-uni`) | The first time down into the metro; every morning after until they have been | The Barceloneta (L4): the seven friends |
| *"La R4 se amplía desde La Sagrera hasta Cardedeu"* (`clue-r4`) | TV ticker; the lit R4 poster of a bus shelter; later La Sagrera's platform | Cardedeu: Nuria and Uri; at Cardedeu station Haru waits and trots off to Nuria's street |
| A photo of Gerard and Luca in the flat: Luca has gone grey in it (`clue-luca-foto`) | The Meridiana flat, looking at it | Luca is wrong |
| *"Un hombre lleva días dentro de la Sagrada Família midiendo las columnas"* (`clue-sagrada`) | TV ticker | The Sagrada Família: Fran |
| A Sagrada Família tour poster with one grey strip of stained glass (`clue-sagrada-cartel`) | A street poster on the Meridiana | The Sagrada Família; with the photo, Aitor: *"¿no será Fran?"* |

## The Queen and the second round (blocks 4 and 5)

A proposal, to be decided with the story (`docs/lore.md` has the theme):

1. Past the castle's two bosses Gerard climbs to the throne. (She fights: the final fight is
   designed in docs/castle-bosses.md, 2026-11-19. What follows is the earlier proposal for what
   she shows.) La Reina Bubbaloo **shows** him: the ánimas he carries are grey. He gave his friends their routine
   back, and with it the sadness underneath it. She was not stealing their childhood: she was
   trying to give it back, and doing it badly, by popping their lives.
2. **La segunda vuelta**: Gerard goes back to each friend, now looking for the kid they were (a
   game, a passion, an excuse to play). Each ánima takes its colour. The city changes with them.
3. **The choice** (decided 2026-10-29: **three endings**): **kill her, wound her, or let her live**.
   She is nobody: she personifies being a kid, with a good motive and cruel means
   (`docs/lore.md`). Gerard decides what he is, which is what his class power always was. What
   each ending shows: open (`docs/story-outline.md`).

## How it is built

- `src/story.ts`: the flags and the rules, for both chapters. Chapter 2's flags: `tv-news`,
  `metro`, `rec-comtal`, `palace-tried`, `clue-r4`, and one `anima-<friend>` per friend.
  `party`, `battleParty` and `palaceGuards` read the ánimas from them. Nuria's mission adds
  `cardedeu`, `nuria-uri`, `papagato` (and its levels `papagato-2`, `papagato-3`), one
  `luz-<person>` per light; `jar`, `ecos` and `catsAtHome` read them. The mission itself is never saved (`story.nuria`).
- `src/friends/nuria.ts`: Nuria's mission (places, lines, fears); `src/tower.ts` and
  `src/tower-scene.ts`: Uri's tower; `src/chasers.ts`: the fears that hunt it; `src/fears.ts`:
  their models and Vertitrón; `src/cats.ts`: Haru and Yuki; `src/cat-wander.ts`: the cats
  strolling about the flat; `src/levels.ts`: ánima levels.
- `src/friends/luca.ts`: Luca's mission; `src/vidrieras.ts`: the salon's walking light;
  `src/luca-foes.ts` and `src/peluqueria-scenery.ts`: its foes and the salon over the basilica.
- `src/chapter-2.ts`: chapter 2's lines, places, triggers, the news broadcast and the clues.
- `src/animas.ts`: the ánimas: who they come from, colour, stat bonus.
- `src/days.ts`: days, hours, the Queen's spread, saved mornings.
- `src/news-tv.ts`: the news on the flat's TV (the set on its own layer, filmed into the screen).
- `src/transit.ts`, `src/city-map.ts`, `src/travel-ui.ts`: lines, stations, the network map and the
  trip (`docs/barcelona.md`).
- Scenes: `meridiana-calle` (the avenue and the metro) and `rec-comtal` (the school under the
  palace), designed by hand and built with `just geo-build` from `assets/geo/<zone>/`.
- `src/news-set.ts`: the news set and its shots; `src/map-markers.ts`: icons on the network map.
- `src/game.ts`: proximity triggers (`story.triggers`), story redirects of doors
  (`story.redirect`), the palace standing on the school, the guards' fight.
- Story events: `near` (walked up to a trigger), `arrive` (came out of a station), `battle` with
  `won: false` in chapter 2 (falls in the castle and wakes up). New effects: `news` (watch the TV), `metro`
  (the station map), `fall`, `look` (the camera turns to a scene anchor) and `doom` (the end);
  for the missions `anima` (an ánima wakes up outside a fight, as a note, or is kept for good,
  `kept`, as the big ÁNIMA DESBLOQUEADA banner), `learn` (a level reached),
  `lights` (the people helped give their lights), `jar` (the jar's screen opens) and `shout`
  (someone far off shouts in a bubble over their head and nothing waits for it: Uri up his tower;
  its trigger is `passing`, so Gerard is not stopped either).
- Screenshots: `just screenshots chapter-2-city`, `castle-threat`, `countdown`, and for Nuria's
  mission `cardedeu`, `nuria`, `papagato` and `lights`; `just dev-day 6` wakes up on a later day.

## Implementation list

Done in the first slice (2026-10-18):

1. The TV turns on as Gerard walks up to it; news overlay with the looping aerial map and the
   ticker clue; replay with *"Mirar la tele"*.
2. Aitor's diegetic gate at the front door until the news has been seen.
3. `meridiana-calle`: the avenue outside the flat, the metro entrance, home's street door.
4. The network map (cartoon Barcelona, L1 and L5, markers), travel along a line, arrival.
8. The news filmed in 3D on a set in Trinitat Vella, playing on the flat's TV, and the castle's threat (towers, thorns, storm, eyes).
9. The days: hours, evening, night, sleep; the Queen's spread (castle, light, headlines, map, Aitor); the end and going back a day; saved with an epoch.
5. `rec-comtal`: the school under the palace at Trinitat Vella, with the L1 entrance.
6. The palace interior reused in chapter 2 with Aitor; the guardians' fight scaled by ánimas;
   escape allowed; falling wakes Gerard at home with everything kept.
7. The ánima data model and its bonus to the party and malus to the guards; ánimas in Personaje.

Done in Nuria's mission (`feat/nuria-mission`, 2026-10-25; `docs/quests/nuria.md` § Implementation plan):

10. Stacking statuses in story fights (Sangrado, Mareo, Llorera) and ánima levels.
11. Papagato, with Haru and Yuki fighting beside its wearer, up to level 3.
12. The R4 from La Sagrera to Cardedeu on the network map, and Cardedeu's real streets.
13. The mission: Haru at the station, Nuria lends the cats, La torre de Uri with his fears and
    Vertitrón; giving up hands the cats back, a fall is fought again or stepped back from; winning keeps Papagato.
14. The lights: Nuria's into Gerard and Uri's into Aitor, counted beside the menus as the party's
    ánimas, then wait in a jar at home,
    one a day to push her back; Haru and Yuki live in the flat from then on.

Next:

1. Polish the two designed scenes with photos of the real places (facades, the school's sign).
2. La Sagrera station scene (the R4 platform, the clue poster).
3. More friends: who they are, where, their missions and ánimas (open question 1); Nuria's and
   Uri's portraits and 3D (`just character`, with credits).
4. The guards' fight presentation: their own model (now the minion, scaled up).
5. The throne and the Queen's scene (block 4), then the second round (block 5).
6. A few possessed animals of the city as random encounters between the metro and each place.

## Open questions

1. **Who are the friends?** Names, where they live, what the Queen's bubble did to them, what
   ánima each gives. Nuria and Uri (Cardedeu) are the first. Is this Nuria the Nuria Mendoza behind
   La Reina Bubbaloo (`docs/lore.md`)? That would put the reveal in Cardedeu.
2. ~~**Which metro is home?**~~ Settled (2026-11-07): home is Meridiana 335 (`meridiana-calle`,
   `Casa`, OSM `way/644309392`), and its metro the L1 at Fabra i Puig, by the Concepció Arenal
   entrance ([places/meridiana.md](places/meridiana.md#home-at-meridiana-335-the-avenue-turned-round)).
3. ~~**What is the Rec Comtal school to Gerard?**~~ Settled (2026-10-30): **his workplace; he is a
   teacher and the school's secretary** (`docs/story-outline.md`).
4. **How many ánimas** open the throne: all of them, or enough (e.g. four of six)?
5. **The second round**: does it happen in the same city (colour returning street by street) or
   after a time jump?
