# Story map · the whole game, shallow

Status: mapping (round 19) · Last updated: 2026-10-30

The whole story at a glance, before any mission is designed in depth: the main arc, every friend
in a few lines, how they connect, and what is still open. Each mission is then designed on its own
with `/side-quest` (`docs/quests/<id>.md`) and must fit this map. When a decision here changes the
story, it also goes into `docs/lore.md` (the story bible) and, for how chapter 2 plays,
`docs/chapter-2.md`.

**Decided** means the user said so. **Proposal** means it came from the design side and is waiting
for a yes.

## Tone (decided 2026-10-29)

**Not a children's game.** It grows out of a children's game (Bernat's notebook, the childhood
prologue) and its motive is childhood, but it treats a very adult subject: routine,
responsibility, growing up and losing yourself in it. There is humour and play, but it is
serious. The Queen is human and complex, never a cartoon villain; the friends' losses are real
adult losses; **combat is robust and complex**. No tantrums, no villain who just needs calming
down, no joke or food monsters, no kiddy narration. Written into `AGENTS.md`, `docs/lore.md`,
`docs/combat.md` and the `/side-quest` and `/anima` skills.

**The visuals too** (decided): a wink here and there is fine (a gum detail, a nod to the
notebook), but the cartoon look is not the general dynamic. Existing designs are reviewed **case by
case** (below).

### Visual review (case by case)

What exists or is designed with a cartoon look, to judge one by one (keep, tone down, redesign):

| Piece | Now | Where | Verdict |
| --- | --- | --- | --- |
| La Reina Bubbaloo | Pink gum beehive, a crown of five gum balls, a wrapper-paper gown, sticky gloves, a gum-ball sceptre, heart beauty mark | `docs/lore.md`, `src/queen-hands.ts` (her hands: pink gelatine) | _open_ |
| Her minions | Gum-ball heads, gooey bodies, pink puddles, blowing bubbles | `src/minion.ts` | _open_ |
| The palace | Gum ramparts, wrapper-twist towers, bubble domes; chapter 2's spiked towers, storm and glowing eyes | `docs/bubbaloo-palace.md`, `src/palace.ts` | _open_ |
| Possessed animals and people | Dark pink eyes (animals), violet eyes (people) | `docs/lore.md` | _open_ |
| The pink tint | Places turn darker, pink and strange where she watches | `src/grading.ts` | _open_ |
| The network map | A cartoon Barcelona with icons for landmarks | `docs/barcelona.md` | _open_ |
| Noísta | Red scarf, protest-poster interface, a giant NO stamp | `docs/animas/noista/` | _open_ |
| Matemágico | Ghostly little birds, light bulbs and question marks over the head in fights | `src/thoughts.ts` | _open_ |
| Papagato | Haru and Yuki fighting beside the wearer | `docs/animas/papagato/` | _open_ (with Nuria's redesign) |

## The frame (decided)

- **Chapter 2 is the last chapter: it is the main game.** Chapter 1 (the childhood dream) is the
  prologue. Everything still open in the story (the Queen's real identity, the twist, the ending)
  resolves inside chapter 2.
- **Non-linear.** There is some direction (people mention each other, some places are harder to
  reach), but missions can be done **in any order**, and **difficulty adjusts** to what the party
  already has. The Queen can be challenged **at any time**.
- **Every mission is available, but reaching it takes doing things** (decided round 13):
  **unlocking transport, earning some money**, and so on. Nothing is locked by a list; the way
  there is what has to be earned. See *Getting there* below.
- **A mission's dungeon starts at a pink bubble** (decided round 19): somewhere in the friend's
  place a **Bubbaloo bubble** appears; walking up to it takes the party into **an alternate
  reality**, the mission's dungeon. Proposals: it is the one clear sign of the Queen in an
  ordinary street, so it should look wrong rather than cute (a skin of gum that breathes, the
  street seen warped through it, a faint sound from inside); entering is a choice at the bubble
  (*"Entrar"*), and leaving the dungeon comes back out of it; the same entry for every friend,
  with what is inside different each time.
- **Falling.** When the party falls, the cycle restarts: Gerard wakes up shouting "¡NO!", and
  **some changes are kept**.
  - **In a friend's mission**, falling offers to go back **to the start of the block** the party
    was in, so nothing has to be repeated from the beginning.
  - **The Queen's palace** is a regular dungeon (the roguelike idea was dropped in round 16):
    falling there wakes Gerard at home, and won zones stay won (see *The palace: zones*).
- **A real object ends the game** (see *El artilugio*): a programmable button controller,
  hidden in the real flat, that talks to the game over Wi-Fi and is needed to beat the Queen.

## Main arc

| # | Beat | Status |
| --- | --- | --- |
| 1 | Gerard wakes at 35, the castle on the Rec Comtal school, the city opens (playable) | Decided |
| 2 | First try at the palace: far too strong; falling is waking up (playable). **Nothing is required to enter or to reach the throne**: only difficulty stands in the way, and it is open from the start. The first outing **leans towards the palace** by inertia (the news, the metro), though Gerard may go anywhere | Decided |
| 3 | Friends, in any order: their missions, ánimas and lights | Decided (list below) |
| 4 | **Bernat finds out part of the story** and tells Gerard about **el artilugio** | Decided that he does; *what* he finds out is open |
| 5 | **The artilugio inside the palace**: a puzzle of rooms in a set order | Decided |
| 6 | **The artilugio at home**: found physically in the real flat, connected to the game | Decided |
| 7 | **The final fight**: the Queen possesses Aitor; without the song she always wins; the hidden melody, played on the artilugio, breaks her hold and weakens her hard | Decided |
| 8 | **The reveal at the end**: the Queen is **not Nuria Mendoza**; she is nobody, a product of imagination who **personifies being a kid**. Not all bad: her motive is good (that we be kids again as responsibilities pile up); the game leans into her human side | Decided |
| 9 | **The final choice: three endings**: **kill her, wound her, or let her live** | Decided; what each shows is open |
| — | The second round: where it fits now that there are three endings | Open |

### The Queen's identity and the false lead (decided)

- Through the game the player is led to suspect the Queen is **Nuria Mendoza**, who **has
  disappeared**: Bernat and other characters say they do not know where she is.
- **Who Nuria Mendoza is** (decided): a real person, **a good friend of Gerard's today**. As kids
  they **called her "la Reina Bubbaloo"**, and **she has never known**. That is why the suspicion
  makes sense to the characters.
- **She never appears in the game.** At the end it is clear the Queen is nobody: she is *ser
  niño*, imagined into being, with the old nickname.
- **The credits reveal** that Nuria Mendoza was **on holiday the whole time** and never found out
  about any of it (decided).
- Open: who called her that as kids (Gerard and Bernat? the whole street?), and how the nickname
  surfaces in the game (Bernat remembering it is the natural place).
- Proposal: Gerard can phone her too (the same phone as Bernat's call) and always gets her
  voicemail, a holiday-sounding message nobody takes seriously until the credits.

### The endings (open)

Three endings (decided): **kill her, wound her, or let her live**. What each one shows, and how
the possession of Aitor and the melody lead into the choice, is to design again in the serious
tone below. (The round-3 proposals, a tantrum the melody calms down, were rejected as too
cartoonish.)

## People

### Friends with a mission

| Friend | Who | Where | How it is reached | Mission | Status |
| --- | --- | --- | --- | --- | --- |
| **Nuria and Uri** (+ Nil, Haru, Yuki) | Old flatmates; a pack | Cardedeu | R4 from La Sagrera | Uri turned kid, the maze of fears, El Vértigo; ánima **Papagato** | Designed, `docs/quests/nuria.md`; can be an early one |
| **Bernat** | Gerard's childhood best friend; invented the Queen; a father (Leia, ~3; wife Jessica); publishes board games beside another job; lives outside Barcelona | A hidden board-game bar in Barcelona | Gerard **phones** him and they meet | A spy feel: the city's people act strangely; Bernat seems immune (her creator); Jessica has gone mad; he **finds out part of the story** | Designing, `docs/quests/bernat.md` |
| **Marta** | Aitor's best friend, Gerard's friend too; **a singer** | **Basque Country** | Needs a **train ticket**: one of the hardest places to reach | _open_ | Idea |
| **Luca** | A very close friend, gay like Gerard and Aitor, **very eccentric**; lives with his partner and their daughter | _open_ | _open_ | _open_ | Idea |
| **Emilie** | Friend of Aitor and Gerard; **very clever** | **Poble Sec** | _open_ (L3 Poble Sec / Paral·lel are not on the map yet) | **Helps with a technical problem** | Idea |
| **University friends**: Anna and Álvaro, Miquel and Sarah, Guillem and Soraya | Three couples from university | _open_ | _open_ | **An original mission**, all six together | Idea |
| **Jan and Gerard's parents** | Jan, the older brother (chapter 1), lives in Barcelona near **Entença** (L5); the parents | Jan: Entença. Parents: _open_ (Sant Quirze?) | L5 to Entença | _open_ | Idea |

### The school: Gerard's colleagues (not a mission)

- **Aurelia, Montse, Pilar, …** work at the **Institut Escola Rec Comtal**, the same school the
  castle grows out of (decided). The Rec Comtal is **Gerard's workplace: he is a teacher and the
  school's secretary** (decided round 14), so the school matters a lot to him.
- They are **not a mission**: they appear **inside the school/palace**, possibly as
  **the zone bosses** (decided round 15; each one's special trait to define).
- The school is **de alta complejidad**: the **pupils are possessed too**, and the palace has
  **different zones with cultural differences** (decided as a direction; what that means in play:
  open).

### Mentioned only

- **Pol and Mire, Vela and Estela**: friends from Sant Quirze. Named in lines, photos or places;
  no mission.

## El artilugio

The game's last key is **real**: a small **controller with buttons, programmable with Arduino**,
that the user owns and will hide in the real flat.

1. **The story tells of it**: probably Bernat talks about it (decided as likely).
2. **It is inside the Queen's palace**, reached by a **puzzle: going from room to room in a
   specific order**.
3. **At home, a puzzle activates physically**: Gerard has to **find the real device in the real
   flat**; it connects to the game **over Wi-Fi**.
4. **It plays notes.** Gerard must play **the sequence that repeats, hidden in every song** of the
   game.
5. **The final fight needs it** (decided): even when the Queen is about to fall, there comes a
   point where she **possesses Aitor**. Aitor joins the enemy side and **they always win**.
   **The song prevents it**: played on the artilugio, it frees Aitor, weakens the Queen hard, and
   the fight can be won.
6. **Why music frees him** (decided): **the real Aitor made this game for Gerard and composed all
   its music.** The melody hidden in every song is his own; it is **the music that brings Aitor
   out of the possession**. Gerard, playing it with his own hands on a device Aitor built, is
   reaching the person behind the whole game.

### The device (decided)

- An **ESP32** board with a **screen** and a **speaker** (and more), **4 buttons**, on Wi-Fi.
- **Opaque, no instructions** (decided round 10). Nobody explains it and nobody mentions a hidden
  melody: the story only says the device exists. **It always sounds when a button is pressed**,
  but **it only works in the final battle**. Until then it is **dormant**.
- **It wakes in the final battle** (decided): colours burst on its screen and **the machine
  visibly changes**; that change is the only sign that now it matters.
- **The melody has 6 notes.** With 4 buttons that is not enough: Gerard **discovers that pressing
  two buttons at once sounds different**. Four buttons alone give 4 sounds and the six pairs give
  6 more, 10 in all; the melody needs at least some of the pairs. Discovering the pairs is the
  device's own puzzle, taught by doing (a note in the melody that no single button plays).
- Proposals:
  - **The screen** shows what is played (the note's shape or its waveform), never the answer:
    it is an object in the world, but the HUD rules still apply to it (no slots to fill, no
    progress bar).
  - **The speaker** plays every note on the device itself, and the game echoes it. It also covers
    *"Escuchar"* when Gerard cannot find it (below).
  - **Nobody hints at the pairs** (opaque, decided). The only help is the music itself (below).
  - **Two at once** means within a short window (about 60 ms, to tune), decided by the firmware
    or the server, so a slightly clumsy chord still counts.
  - **Fallback keyboard / piano**: the same 4 keys and the same pairs, so the discovery is the
    same.

### Finding it at home (round 7: the room by the lights, the spot by a clue)

**Decided as a direction (round 9): a play of lights in the real flat** leads Gerard to the
device. The steps below are the working proposal; how the lights play exactly is still to design.

The user chose a mix: the lights say **which room**, a clue says **where in it**.

1. **In the palace it slips away.** At the end of the room-order puzzle the artilugio is there, on
   its own, in the game. When Gerard reaches for it, it turns into light and flies off the way the
   friends' lights do, out of the palace and towards home. Aitor: *"Va hacia casa."*
2. **At home, one room is lit.** Back in the Meridiana flat, every lamp is off but one: the room
   where the real device is hidden, in a colour it has never had (the artilugio's own). If the
   house lights are connected (`docs/home-lights.md`), **the real bulb in that real room lights
   the same way**. Nothing is said: the light is the clue.
3. **In that room, the spot.** Walking into it in the game, Gerard finds the last trace of the
   light settled on a piece of furniture, and a line (Aitor's, or a note in his handwriting)
   that describes the hiding place without naming it. The user knows the real spot and writes the
   line.
4. **Switched on, it sleeps.** The real device joins the game over Wi-Fi (through the game's
   server) and plays its notes when pressed, but nothing else happens: it is dormant until the
   final battle.

Safety nets, so the birthday never stalls:

- **Lights off or not connected**: the game's own flat still shows the lit room.
- **Still lost after a while**: *"Escuchar"* in that room makes the device's speaker play in the
  real flat. Aitor (the real one is there) can always help in person.
- **The device does not connect**: the same melody can be played on the flat's piano in the game
  (or the keyboard), so the final fight is never blocked by hardware.

How a player who was never told can still get there (decided round 11: **clues built into the
game, but Gerard has to realise it himself at the end**; the real Aitor plays beside him and
helps in person if needed, which is the last safety net):

- **The music teaches.** Every track carries the 6-note motif, so a player has heard it for hours
  before the end without knowing it.
- **When the Queen takes Aitor, the music strips down to the motif**: the battle song falls away
  and the 6 notes repeat alone, exposed, while the device wakes in Gerard's hands. Nothing is
  said; the coincidence (the only music left, the only object glowing) is the clue.
- **The pairs are heard, not told**: the motif's pair notes sound fuller (two voices), so trying
  two buttons at once is the natural answer to *"that note isn't on any button"*.
- **Losing is learning**: the possession always wins until the melody is played, so each fall
  wakes Gerard with one more try's worth of listening.

Proposals and things to check:

- **How it reaches the game** (proposal): through the game's own server, like the LIFX bulbs
  (`docs/home-lights.md`: `server.py` already talks to devices on the home LAN). The device posts
  its button presses to the backend and the game reads them, which avoids the browser's limits on
  talking to a device on the LAN from an HTTPS page.
- **Never let hardware block the ending** (proposal): if the device is not found or will not
  connect on the day, the same melody can be played another way (the flat's piano, the keyboard),
  so the birthday never ends on a dead battery.
- **The melody in every song**: the tracks are Aitor's own (made in Logic), so the motif is
  written into each one by its composer. Nobody points it out (opaque, round 10); the flat's
  piano (already an activity) is somewhere a curious player could pick it out by ear.
- **Emilie and the artilugio** (proposal): her technical problem could be exactly this, getting the
  device to talk to the game.
- **What the melody does to her** (open): it frees Aitor (decided) and weakens her hard; how it
  reads on her (not "calming her down", rejected as cartoonish) is still to design.
- **Aitor possessed and player 2** (decided round 12): **the real Aitor plays against Gerard, all
  out**: his controller keeps driving Aitor, now on the Queen's side, and he fights to win.
  To design: how the possession "always wins" while Aitor is a real player (e.g. Aitor and the
  Queen cannot be brought down while he is held; hitting Aitor hurts Gerard's own side), how
  Aitor's dock moves to the enemy side, and whether the melody is played at any moment of the
  fight or on Gerard's turn.
- **Fit with the lore** (check): people the Queen holds get violet eyes and turn into kids (Uri);
  Aitor possessed could follow the same rule.

## Getting there: transport and money (decided round 13, details open)

All missions can be done from the start in principle; what stands between Gerard and a friend is
**getting there**: a transport to unlock, money to earn, and similar.

Open, with proposals:

- **How money is earned.** Proposal: small jobs in the city that **cost hours of the day**, so
  earning the train fare is literally giving time to routine while the Queen advances. The theme
  as a mechanic: work buys access, and time is what it costs.
- **What each transport needs.** Proposal, as a first sketch: the metro from the start (playable);
  **Rodalies** (Cardedeu) with a ticket bought at the station; the **long-distance train to the
  Basque Country** (Marta) with an expensive ticket, the main money goal of the game; other
  unlocks (a bike, a car, a lift from a friend) as rewards of missions.
- **Money is euros** (decided round 17), a real part of the game, not only for tickets.
- **Healing items are food, bought in shops** (decided round 17): different establishments sell
  different things. Proposals: each place's food is its own (a bakery on the Meridiana, the bar
  where Bernat meets Gerard, something local in Cardedeu, pintxos in the Basque Country), so
  shopping is also a way of being somewhere; the Meridiana already has real shop signs (Granier,
  Café Entrepans…) that could open; prices and what each food heals as data next to the existing
  items (`src/items.ts`, today's *Poción* and *Chicle de fresa*).
- **Foods with characteristics** (round 18, to confirm what the user meant): beyond healing, a
  food could raise a stat for a while (Fuerza, Defensa…), so what you eat and where is a choice.
- **Where money shows**: it is something the party has, so it can show in the status screen; the
  HUD rule (`AGENTS.md`) still forbids showing what is missing for a ticket.
- **Who sells and tells**: ticket machines and people at stations say what a trip costs, in the
  world.

## Recreating Barcelona (round 18: direction decided; method proposed and kept, round 19)

**Decided**: part of Barcelona has to be recreated, **as realistic as possible while keeping the
diorama feel**, with **real textures**.

Today's pipeline (`docs/environment-styling.md`, `docs/barcelona.md` § Designed zones):
OpenStreetMap footprints or hand-drawn sketches, extruded; facades **painted procedurally** on
canvases per bay and storey (`flats`, `shops`, `school`…); Google Street View used only as a
reference, never shipped. That gives the right layout but a drawn look.

**Proposal: real materials on a miniature.** The diorama effect comes from the camera and the
grading (a high orthographic view, tilt-shift blur, a cut base at the zone's edge); realism comes
from the surfaces. Real textures on a miniature read like a tilt-shift photograph of the real
city, which is exactly the look asked for.

| Layer | Today | Proposal | Source and licence |
| --- | --- | --- | --- |
| Footprints, streets | OSM or sketch | Keep | OSM (ODbL) |
| Heights | Style default or OSM `building:levels` | Real storeys per building | Catastro INSPIRE buildings (floors above ground), open with attribution |
| Terrain | Flat | Real slopes where they matter (Poble Sec and Montjuïc, Collserola edges) | ICGC elevation model (CC BY 4.0) |
| Ground | Flat colours | **PBR materials**: Barcelona's *panot* (the flower tile), asphalt, granite kerbs, *sauló* in squares and parks, tree pits | CC0 libraries (ambientCG, Poly Haven) plus the user's own photos of the panot |
| Facades | Canvas-painted bays | **A library of real bays** cut from the user's own photos, perspective-corrected: Eixample balconies, enclosed galleries, shopfronts, 70s blocks, used in the same bay atlas (`FACADE_ATLAS`) so streets still vary | The user's photos (taken like the Meridiana ones, October 2026) |
| Signature facades | Procedural | One rectified photo per key facade (the Rec Comtal school, each friend's door, the board-game bar) | The user's photos |
| Landmarks | Procedural | Modelled in Blender as GLB where a landmark is seen (the loader path exists in PlayCanvas) | Own work |
| Small props | Procedural | Real Barcelona street furniture as models: the bench, the lamp, the Bicing dock, the bins, the green newsstand | Own models or CC0 |
| Look | The game's grading per scene | Keep the grading and add the miniature cues: tilt-shift depth of field, slightly saturated real colours, soft contact shadows | Existing post (`src/post.ts`, `src/grading.ts`) |

Rules to keep: Google stays reference only (its terms forbid shipping its imagery or 3D tiles);
the HUD and gate rules do not change; nothing hides Gerard. Photogrammetry or Gaussian splats of
a few spots (a shop interior, a statue) are possible later, but they bake their own light and
would clash with the diorama's lighting, so not as the base.

**First step, before any new zone** (proposal): redo one block of the Meridiana with real
materials and photo bays, and compare it side by side with today's in screenshots. If it reads
right, it becomes the style for every new zone.

Zones Barcelona will need (from the people above): the Meridiana (exists), Trinitat Vella
(exists), La Sagrera (the R4), Bernat's board-game bar (district open), Entença (Jan), Poble Sec
(Emilie), and the stations for Rodalies and the long-distance train (Sants?).

## The palace: zones (rounds 14–16)

Decided (a sketch, to think through properly):

- **A regular dungeon** (round 16): fixed rooms, the same every time. The roguelike idea
  (rooms reshuffled every run) was dropped.
- **Zones**, each with its **characteristic elements and puzzles** and **a boss** at the end.
  The zone bosses are **teachers the user knows** (Aurelia, Montse, Pilar, …), each with a
  special trait to define.
- **Beating a zone keeps it won**: the general danger level drops, that part stays beaten, and a
  **shortcut** opens to the next zone, so the next visit starts from there. The game nudges the party
  forward zone by zone.
- **The zones** (not in this order; to decide): **el patio**, **el gimnasio**, **la secretaría**,
  then **the throne room** and La Reina Bubbaloo.

Proposals:

- **Kept after falling**: everything, as anywhere else (ánimas, levels, lights, money, won
  zones); only a zone half done starts again from its beginning.
- **The general danger level** joins the castle's threat (`castleThreat`, today lowered only by
  ánimas): each zone won lowers it too, and the castle shows it from the street.
- **The artilugio's room order**: a fixed sequence of rooms across the zones, hinted in the world.
- **La secretaría last** before the throne: Gerard's own office (he is the school's secretary),
  his own routine as the last zone.
- The cultural zones (the user's idea; what they mean is still open), and the possessed pupils,
  could live in el patio.

## How missions connect (to fill)

Who mentions whom, which ánima opens which place, where each clue lives. Fixed so far:

- The TV ticker → the R4 → Cardedeu (Nuria and Uri).
- Bernat → the artilugio → the palace's room puzzle.
- Marta's train ticket: who or what gives it (_open_).
- Emilie → a technical problem (which, and who sends the party to her: _open_).

## To reconcile with existing docs

- ~~`docs/lore.md`: the Queen is Nuria Mendoza~~ Updated (round 2): she is nobody, Nuria Mendoza
  has disappeared, three endings. `docs/chapter-2.md` § The choice and `docs/quests/nuria.md`
  updated too.
- `docs/quests/nuria.md`: the maze starts "round the corner, the street turns into a maze"; with
  the new rule it starts at a pink bubble in Jacint Verdaguer.
- **`docs/quests/nuria.md` needs a redesign for the tone** (decided): see its *Tone review*
  section for what conflicts.
- `docs/chapter-2.md` § The Queen and the second round says the Queen **does not fight** at the
  throne; the final fight (Aitor possessed, the melody) replaces that.
- `docs/quests/nuria.md` says falling in the mini-dungeon wakes Gerard at home with the mission
  undone; the new rule offers going back to the start of the block.
- `docs/chapter-2.md` § The palace says "the palace remembers nothing" and has one guard fight;
  the palace's zones (teacher bosses, shortcuts, the room puzzle) are a bigger design to write
  in `docs/bubbaloo-palace.md`.
- `docs/chapter-2.md` open question 3 (what the school is to Gerard) is answered: his workplace.

## Open (tracker)

The order they will be asked in:

1. **The heart of the story**: ~~who the Queen is; the ending; Nuria Mendoza~~ (decided rounds
   2–3). Still open: what Bernat finds out; what each ending shows and how the final fight leads
   into it (serious tone); who gave Nuria Mendoza the nickname.
2. **El artilugio, the real one**: board, buttons, Wi-Fi, LEDs or sound; where it will be hidden;
   whether the melody exists yet.
3. **The final fight**: ~~Aitor possessed and player 2; what opens the throne~~ (decided round 12:
   Aitor plays against Gerard; nothing required, difficulty only). Still open: how the possession
   always wins, and when the melody can be played.
4. **The palace's zones**: ~~regular dungeon, zones with a teacher boss, shortcuts~~ (decided
   rounds 14–16). Still open: the zones' order; each teacher's trait; the cultural zones; the
   pupils.
5. **Each friend in three lines**: Marta, Luca, Emilie, the university friends, Jan and the
   parents (where, what the Queen did, a mechanic name, the ánima).
6. **The order graph and getting there**: who leads to whom; transport unlocks and money (how it
   is earned, what each trip costs, Marta's ticket).
7. **Falling in a mission**: going back to the block's start: does it cost hours, is it a menu or a
   diegetic moment?
8. **The second round**: same city or a time jump; how it fits the ending.
9. **Recreating Barcelona**: the method (above), the first test block, which zones and in what
   order, and the photos the user can take.
