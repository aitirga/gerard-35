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
- **Falling is waking up.** When the party falls (in the palace or anywhere outside), the screen
  goes pink and black and Gerard sits up in bed at home, "¡NO!", with Aitor beside him. It keeps the
  dreamlike opening of the old loop as the game's way of forgiving, and it is diegetic: Gerard
  literally wakes up from it. Aitor's line changes with how many times it has happened.
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

**Days and hours.** Each day runs from 08:00 to 22:00 (`src/days.ts`). Looking, talking and walking
are free; doing things takes hours:

| Activity | Hours |
| --- | --- |
| A metro trip | 1 |
| A fight (the palace guards) | 2 |
| Playing the piano at home | 2 |
| A coffee on the balcony | 1 |
| A friend's mission (Nuria's: 1 going into Uri's tower, 2 more when it is won) | 2–4 |

The day ends at 22:00 wherever they are (Aitor: *"Ya está. Es de noche"*), when they go to bed
(*"Dormir"* at the bed, once the news has been seen), or when they fall in a fight. Black, and they
wake up the next morning in bed, "¡NO!", with everything done kept.

**How it is told, never counted:**
- The light: from 18:00 the evening turns pinker, and Aitor says so (at 18:00 and at 20:00).
- The TV at home: the headline gets worse each morning (`NEWS.stages`): it grows over Trinitat
  Vella, reaches Sant Andreu, the Meridiana…
- Aitor every morning: more worried each day (`LINES_2.morning`).
- The castle: bigger each day on the school (up to 1.6 times), the streets pinker (Trinitat Vella,
  then the Meridiana outside the flat, then the flat).
- The network map: the pink halo round the castle widens over the city.

**Her spread** is `(day − 1 − 3 × ánimas) / 6`: six days without any help and on the seventh
morning it reaches the end; **each ánima wins three days back**. So a day spent on the piano and
coffees is a day closer to the end, and a day spent helping a friend pushes her back. Each friend's
mission should fit in a day.

**The lights** (decided 2026-10-24, first in Nuria's mission, `docs/quests/nuria.md` § The
lights): every person Gerard helps gives a light, kept in a jar at home. Each one can be let out
once to push her back **one more day**, so the spread becomes `(day − 1 − 3 × ánimas − lights
used) / 6`. The jar shows how many are lit and how many were used, never whose they were.

Built: the jar stands on the west end of the TV unit in the flat (`PLACES_2.jar`), a glass jar with
a cork and one marble per light, amber while lit and dark once spent. The first time home after a
win, the lights fly from Gerard and Aitor into it. *"Usar una luz"* lets the next lit one out: it
rises, flies across the living room and out of the balcony towards the castle, and Aitor sees the
pink go back. At most one a day: after that the jar only offers *"Mirar las luces"*. Used lights
are story flags (`luz-<person>-usada`), so going back a day puts that day's light back; a light
counts as used today when this morning's saved flags do not have its flag yet.

**The end.** On that morning the flat is already part of her castle: gum over the walls and floors,
thorns, everything pink (`story.doomed`). Aitor: *"Hemos llegado tarde."* A screen says she has
covered everything, with one button: **Volver al día anterior**. It takes them back to the morning
before, with that day's progress lost and everything before it kept (`story.rewind`): Gerard wakes
up "having seen tomorrow". To get out of the loop they must do something that day that pushes her
back.

**Saving.** The day, the hour and the last two mornings are saved with the story. Going back a day
is the only thing that takes flags away, so the save carries an `epoch` that grows with each
rewind: the server lets a newer epoch replace the flags, and ignores tabs still on an older one.

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
  fewer guards, smaller, slower. With enough ánimas the fight is fair, and the curtain parts.
- **Escape is allowed** from the guards (back to the hall), unlike the dream's fights: it is a
  place to probe, not a trap.
- **Losing** wakes Gerard at home (see above). The palace remembers nothing; the party remembers
  everything.

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
- **brings something of that friend into Gerard**: a class (as Noísta came from saying no) or a
  skill, and often a key for somewhere else in the city (a gum wall, a calm word for a possessed
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
| **Nuria**, with Uri and Nil | Carrer de Jacint Verdaguer, Cardedeu (R4 from La Sagrera) | *La torre de Uri*: Uri, a kid again, climbs a dark tower; his fears hunt the ramp and El Vértigo waits on top (`docs/quests/nuria.md`) | **Papagato** (Haru and Yuki fight with the party) | Nuria, Uri, Nil | Playable on `feat/nuria-mission`; Nuria's and Uri's portraits to come |

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
| *"La R4 se amplía desde La Sagrera hasta Cardedeu"* (`clue-r4`) | TV ticker; the lit R4 poster of a bus shelter; later La Sagrera's platform | Cardedeu: Nuria and Uri; at Cardedeu station Haru waits and trots off to Nuria's street |

## The Queen and the second round (blocks 4 and 5)

A proposal, to be decided with the story (`docs/lore.md` has the theme):

1. With enough ánimas the curtain parts and Gerard climbs to the throne. La Reina Bubbaloo does not
   fight; she **shows** him: the ánimas he carries are grey. He gave his friends their routine
   back, and with it the sadness underneath it. She was not stealing their childhood: she was
   trying to give it back, and doing it badly, by popping their lives.
2. **La segunda vuelta**: Gerard goes back to each friend, now looking for the kid they were (a
   game, a passion, an excuse to play). Each ánima takes its colour. The city changes with them.
3. **The choice**: burst her bubble and let Barcelona go back to normal, or **join her cause** and
   change it from inside: a world where everyone has more time, plays, respects, has fun outside
   obligation. Gerard decides what he is, which is what his class power always was.

## How it is built

- `src/story.ts`: the flags and the rules, for both chapters. Chapter 2's flags: `tv-news`,
  `metro`, `rec-comtal`, `palace-tried`, `clue-r4`, and one `anima-<friend>` per friend.
  `party`, `battleParty` and `palaceGuards` read the ánimas from them. Nuria's mission adds
  `cardedeu`, `nuria-uri`, `papagato` (and its levels `papagato-2`, `papagato-3`), one
  `luz-<person>` per light and `luz-<person>-usada` once it is let out; `jar`, `lightUsedToday` and
  `catsAtHome` read them. The mission itself is never saved (`story.nuria`).
- `src/friends/nuria.ts`: Nuria's mission (places, lines, fears); `src/tower.ts` and
  `src/tower-scene.ts`: Uri's tower; `src/chasers.ts`: the fears that hunt it; `src/fears.ts`:
  their models and El Vértigo; `src/cats.ts`: Haru and Yuki; `src/cat-wander.ts`: the cats
  strolling about the flat; `src/levels.ts`: ánima levels.
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
  `won: false` in chapter 2 (falls and wakes up). New effects: `news` (watch the TV), `metro`
  (the station map), `fall`, `look` (the camera turns to a scene anchor) and `doom` (the end);
  for the missions `anima` (an ánima wakes up outside a fight), `learn` (a level reached),
  `lights` (the people helped give their lights) and `release-light` (one leaves the jar).
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
    El Vértigo; giving up or falling hands the cats back; winning keeps Papagato.
14. The lights: they leave Nuria, Uri and Nil into Gerard and Aitor, then wait in a jar at home,
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
2. **Which metro is home?** The flat is on the Meridiana; the scene assumes the L1 at Fabra i Puig,
   and home is the corner block by its Av. Meridiana entrance (`meridiana-calle`, `Casa`). The real
   portal is not known yet: moving home is one override in `assets/geo/meridiana-calle/zone.json`.
3. **What is the Rec Comtal school to Gerard?** Where he works (a teacher?), where a friend
   teaches, or where a friend's kid goes. It changes what the TV says and why the castle is there.
4. **How many ánimas** open the throne: all of them, or enough (e.g. four of six)?
5. **The second round**: does it happen in the same city (colour returning street by street) or
   after a time jump?
