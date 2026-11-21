# Story map · the whole game, shallow

Status: mapping (round 20), paused · Last updated: 2026-11-15

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
| La Reina Bubbaloo | Pink gum beehive, a crown of five gum balls, a wrapper-paper gown, sticky gloves, a gum-ball sceptre, heart beauty mark | `docs/lore.md`, `src/queen-hands.ts` (her arms: `reina-brazo`, gloves of stretched gum) | _open_ |
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
  **remembering someone to open a trip** (decided 2026-11-15: no money). Nothing is locked by a
  list; the way there is what has to be earned. See *Getting there* below.
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
  - **The Queen's castle** is generated between fixed rooms (2026-11-19, docs/castle.md; the
    fixed dungeon of round 16 is replaced): falling there wakes Gerard at home, and a boss beaten
    stays beaten (see *The palace: zones*).
- **A real object ends the game** (see *El artilugio*): a programmable button controller,
  hidden in the real flat, that talks to the game over Wi-Fi and is needed to beat the Queen.

## Main arc

| # | Beat | Status |
| --- | --- | --- |
| 1 | Gerard wakes at 35, the castle on the Rec Comtal school, the city opens (playable) | Decided |
| 2 | First try at the palace: far too strong; falling is waking up (playable). **Nothing is required to enter**: only difficulty stands in the way. **The throne is reached only after the castle's two bosses** (2026-11-19, docs/castle.md; before, it was open from the start). The first outing **leans towards the palace** by inertia (the news, the metro), though Gerard may go anywhere | Decided |
| 3 | Friends, in any order: their missions, ánimas and lights | Decided (list below) |
| 4 | **Bernat finds out part of the story** and tells Gerard about **el artilugio** | Decided that he does; *what* he finds out is open |
| 5 | ~~**The artilugio inside the palace**: a puzzle of rooms in a set order~~ **The artilugio at the salón de juegos**: Bernat brings it and sends it across to the real flat through a portal (2026-11-15) | Decided |
| 6 | **The artilugio at home**: found physically in the real flat, connected to the game | Decided |
| 7 | **The final fight**: the Queen possesses Aitor; without the song she always wins; the hidden melody, played on the artilugio, breaks her hold and weakens her hard | Decided |
| 8 | **The reveal at the end**: the Queen is **not Nuria Mendoza**; she is nobody, a product of imagination who **personifies being a kid**. Not all bad: her motive is good (that we be kids again as responsibilities pile up); the game leans into her human side | Decided |
| 9 | **The final choice: two endings** (2026-11-19, before three): **kill her, or let her live, weakened** | Decided; designed in docs/castle-bosses.md § The last scene |
| — | The second round: where it fits now that the ending is a choice | Open |

Beats 4 to 7 happen **in the order of § The end, in order** (decided 2026-11-15): the first fall
at the Queen comes *before* Bernat speaks of the artilugio, not after.

### The end, in order (decided 2026-11-15)

Aitor's idea for how the story closes. It sets the order of things already decided (the
possession, Bernat, the artilugio) and where the artilugio comes from.

1. **The Queen, the first time.** Gerard and Aitor reach La Reina Bubbaloo and fight her for
   real. It can be won, up to a point: when she has **about a tenth of her PV left**, at the last
   moment, she **takes control of Aitor**.
2. **Aitor plays against Gerard.** The real Aitor keeps his controller and now fights on her
   side, all out (round 12). **They kill Gerard.** This happens **once, and it has to happen**:
   the first time there is nothing that stops it, however well the fight was played.
3. **Bernat calls.** Falling there is not just waking up again: Gerard and Aitor **get a phone
   call from Bernat**, who asks them to meet him at **the salón de juegos**.
4. **The mission at the salón de juegos.** There the mission is played to get **the device that
   blocks that spell** (el artilugio, § El artilugio). They come out with it: § From the salón
   de juegos to the real flat, below.
5. **Back at the Queen.** The fight is met again, and when she reaches for Aitor **the device can
   be used right then: the real one, in Gerard's hands**.
6. **Nobody says what it is for.** Gerard has to work that out himself (opaque, round 10). What
   the mission guarantees is only that when the moment comes **he is holding the piece of the
   puzzle that is needed**.

### From the salón de juegos to the real flat (decided 2026-11-15)

How the artilugio is won, in Aitor's words: the real device **is physically inside our home**
the whole time. In the story it is **Bernat who brings it**, physically, but he cannot just hand
it over: he has to **transport it to the real world, the one where we are playing**.

- **Where**: at the salón de juegos, where Bernat is.
- **A mini portal** opens there, and **through it the flat is seen**. It is something in the
  world to walk up to and **interact with**, not a screen or a menu.
- **The puzzle** is played from there and has to do with **the flat's lights and the artilugio
  itself**: the real bulbs (`docs/home-lights.md`) and the real device are its pieces.
- **Solved, the artilugio crosses over**: it leaves Bernat's side and is in the real flat, for
  Gerard to pick up with his hands.

This **replaces the artilugio's old origin** (§ El artilugio, point 2: inside the palace, at the
end of the room-order puzzle, and the light that flew home from there). What § Finding it at
home worked out still serves, moved here: the lights say which room, a clue says where in it,
and the safety nets (*Escuchar*, the game's own flat if the bulbs are off, the piano if the
device will not connect) hold just the same.

Still to design (proposals wait for a yes):

- **The puzzle itself**: what Gerard does at the portal and what the lights answer. A direction
  that fits what exists: what is done on the game's side of the portal changes the real lamps,
  the device answers with its own sound or screen, and the last step lights the room where it
  is hidden. The lights are the clue; nobody says "go and look".
- **What is seen through the portal**: the game's Meridiana flat (already built), in the state
  the real one is in.
- **Why Bernat has it and why it must cross**: he invented her as a kid, so the thing that
  answers her being his is natural; that the game knows there is a world outside it is new for
  the story and should be said once, plainly, in his voice, without winking.
- **The portal's look**: violet is possession's and saturated pink the Queen's
  (`docs/visual-style.md`), so it takes neither; the artilugio's own colour (the one the lit
  room has "never had") is the candidate.
- **Without the bulbs or on a bad day**: the puzzle must be solvable on the game's flat alone.
- **The palace's room-order puzzle**: it no longer guards the artilugio. Whether it stays in the
  palace for something else or is cut.

What this settles:

- **How the possession "always wins"** (tracker 3): the first time it simply does, and the party
  dies. It is a scripted loss inside a real fight, placed where the fight looked won.
- **What sends Gerard to Bernat** (beat 4): the defeat itself. He does not go looking for the
  artilugio; Bernat's call comes because of what just happened.
- **When the device matters**: only from the second visit on, at the moment she takes Aitor.

Still to design (proposals wait for a yes):

- **The threshold**: "about 10 %". Whether it is a fixed share of her PV or the blow that would
  have finished her.
- **How long the turned fight lasts**: Aitor fighting to win against a Gerard alone should be
  short and felt, not a second boss. In the game's tone it is the worst moment of the story, not
  a gag: no joke line over it.
- **The salón de juegos**: which one (a real arcade in Barcelona, from OSM, or the one from the
  childhood street), its identity card (`docs/visual-style.md`), what the mission asks, and
  whether it gives an ánima or only the device. It needs its entry in `PLACES` and its arc in
  `STORY_ARCS` when built.
- **What Bernat knows** when he calls, and how he knows they fell (he made her up as a kid:
  `docs/quests/bernat.md`).
- **After the first time**: if Gerard goes back without the device, or with it and without
  understanding it, she takes Aitor again and they fall again (*losing is learning*, § Finding
  it at home). Whether Bernat calls again then, or says something different.
- **What using it does on screen**: decided before (it frees Aitor and weakens her hard); how
  that reads is still open, and so is how it leads into the three endings.

### The Queen's identity and the false lead (decided)

- Through the game the player is led to suspect the Queen is **Nuria Mendoza**, who **has
  disappeared**: Bernat and other characters say they do not know where she is.
- **Who Nuria Mendoza is** (decided): a real person, **a good friend of Gerard's today**. As kids
  they **called her "la Reina Bubbaloo"**, and **she has never known**. That is why the suspicion
  makes sense to the characters.
- **She never appears in the game as herself.** The Queen **wears her face** (Aitor, 2026-11-20):
  the figure and the portrait are drawn from Nuria Mendoza's photos, made cruel, so in the throne
  room the false lead looks true (Gerard: «…¿Nuria?»; she: she put on the face they were looking
  for, she never had one of her own). At the end it is clear the Queen is nobody: she is *ser
  niño*, imagined into being, with the old nickname and a borrowed face.
- **The credits reveal** that Nuria Mendoza was **on holiday the whole time**, posing for photos,
  and never found out about any of it (decided): the last card is surrounded by her holiday
  photos dropping in one by one (`ALBUM` in `src/credits.ts`; the photos stay on this machine,
  `public/private/`, since the repository is public).
- **The end, after the credits** (Aitor, 2026-11-21): the roll goes up between two collages of the
  game's own snapshots, the adventure and the friends' missions (`SNAPSHOTS`); after Nuria's card,
  each ending's own closing text and «Fi» (`FINAL_CARD`, drafts Aitor rewrites in the guion), and then
  the welcome screen again, «Continuar» leading back to the Monday at home.
- Open: who called her that as kids (Gerard and Bernat? the whole street?), and how the nickname
  surfaces in the game (Bernat remembering it is the natural place).
- Proposal: Gerard can phone her too (the same phone as Bernat's call) and always gets her
  voicemail, a holiday-sounding message nobody takes seriously until the credits.

### The endings

**Two endings** (decided 2026-11-19; they replace the three of before, kill, wound or let live):
**kill her**, or **let her live, weakened**. What each one shows, and how the possession of Aitor
and the melody lead into the choice, is designed in [castle-bosses.md](castle-bosses.md) § Aitor,
held and § The last scene, in the serious tone below. (The round-3 proposals, a tantrum the melody calms down, were rejected as too
cartoonish.)

## People

### Friends with a mission

| Friend | Who | Where | How it is reached | Mission | Status |
| --- | --- | --- | --- | --- | --- |
| **Nuria and Uri** (+ Nil, Haru, Yuki) | Old flatmates; a pack | Cardedeu | R4 from La Sagrera | Uri turned kid, the maze of fears, El Vértigo; ánima **Papagato** | Designed, `docs/quests/nuria.md`; can be an early one |
| **Bernat** | Gerard's childhood best friend; invented the Queen; a father (Leia, ~3); publishes board games beside another job; lives outside Barcelona | **El Nucli**, the hidden board-game bar by Sants (`docs/places/nucli.md`) | The Sants ticket; after the first fall at the Queen, **he calls** | **The confidant** (decided 2026-11-19): he realises this is the game he made up as a kid, and knows (how, still open) that what beats her is at home, **in the physical world**: he breaks the fourth wall. His portal sends the artilugio to the real flat. **No ánima, no Jessica** | Designing, `docs/quests/bernat.md` |
| **Marta** | Aitor's best friend, Gerard's friend too; **a singer** | **Alegia**, Basque Country | Needs a **train ticket** (a memory, § Getting there): one of the hardest places to reach | Her voice taken; the piano, Las cuerdas, her three qualities and La Voz, hurt only while a note sounds | Base playable, `docs/quests/marta.md`; the trip, the clues and her recordings open |
| **Luca** | A very close friend, gay like Gerard and Aitor, **very eccentric**; lives with his partner and their daughter | **La Sagrada Família** | L5, its ticket | Gone grey while Fran turns the basilica into his hair salon; ánima **Prismático** | Playable, `docs/quests/luca.md`; the wearable ánima to design |
| **Emilie** | Friend of Aitor and Gerard; **very clever** | **Poble Sec** | L3, its ticket; no clue leads there yet | Her flat, the model and its section | Playable, `docs/quests/emilie.md`; a clue and the wearable ánima to design |
| **University friends**: Anna and Álvaro, Miquel and Sarah, Guillem and Soraya | Three couples from university (Guillem does not appear) | **La Barceloneta**, the beach | L4 | They come for Gerard's birthday, held by the Queen: a game of tag into the sea and the spiral | Designing, `docs/quests/universidad.md` |
| **Jan and Gerard's parents** | Jan, the older brother (chapter 1), lives in Barcelona near **Entença** (L5); the parents | Jan: Entença. Parents: _open_ (Sant Quirze?) | L5 to Entença | _open_ | Idea; **left out of the base** (2026-11-19), maybe later |

**The base** (decided 2026-11-19): Nuria and Uri, the university friends, Marta, Emilie and Luca,
each with a wearable ánima, and Bernat without one. Pedro and Jan stay out for now.

### Marta's fight (idea, 2026-11-07)

Designed and built as a base since (2026-11-14): `docs/quests/marta.md` § Final boss is the
current word; these are the notes it started from.

- **Her mission's final boss sings** (decided): **the real Marta will record songs of single notes**
  for the game, and they are the boss's **cyclic, endless attack**: a buff that comes round with the
  song and an attack on every tick.
- **The window to hurt it is the note** (decided): while a note is being sung, the boss can be
  attacked and takes damage; between notes it is **immune**. The party has to time its attacks to
  her singing.
- **Her ánima gives skills like hers** (decided): song and timing, in the same spirit.
- Proposals, open: the note shows on screen as well as sounding (a ring or a pulse, never a hidden
  counter), so it can be played with the sound off; Defender pays between notes; the window runs on
  the fight's clock like the timed statuses (`docs/combat.md` § Estados en tiempo real). It must not
  repeat Joan's *Escala* in La Sobremesa (a note that climbs turn by turn), nor the artilugio's
  melody of the ending (`§ El artilugio`), which is Aitor's.
- Asset: Marta's recordings, one file per note, to ask her for.

### The school: Gerard's colleagues (not a mission)

- **Aurelià** (history teacher, once an athlete), **Mar** (the head), **Montse** and **Pilar** (the
  heads of studies) work at the **Institut Escola Rec Comtal**, the same school the castle grows
  out of (decided). The Rec Comtal is **Gerard's workplace: he is a teacher and the
  school's secretary** (decided round 14), so the school matters a lot to him.
- They are **not a mission**: they appear **inside the school/palace** as **its bosses**
  (decided 2026-11-19): Aurelià first, then Mar, Montse and Pilar together
  ([castle-bosses.md](castle-bosses.md)).
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
2. ~~**It is inside the Queen's palace**, reached by a **puzzle: going from room to room in a
   specific order**.~~ Replaced (2026-11-15): **Bernat brings it**, and it crosses to the real
   flat from the salón de juegos (§ From the salón de juegos to the real flat).
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

**The board** (decided 2026-11-19): a Keyestudio FKS0001 ESP32 inventor board Aitor already had
wired. Its firmware and its wiring are in `firmware/artilugio/`. What it uses: **4 coloured
buttons, each with its LED** (red, yellow, green, blue), a **buzzer**, a **16×2 LCD** and a **PIR**
motion sensor (its 4-digit display stays dark, its mic unused). It has no colour screen, so *the
colours that burst* are its four LEDs.

- **8 notes** (decided 2026-11-19, replaces the 10 below): the 4 buttons alone and **4 pairs**
  pressed together, the eight notes of a **G Phrygian dominant scale** from G to G (Aitor):
  *Sol, La♭, Si, Do, Re, Mi♭, Fa, Sol*.
  - **The buttons alone** play the G7 chord: red **Sol**, yellow **Si**, green **Re**, blue **Fa**.
  - **Each pair** (the neighbours on the ring of colours) plays the scale's note **between its two
    buttons**: red + yellow **La♭**, yellow + green **Do**, green + blue **Mi♭**, blue + red
    **Sol** an octave up. (The assignment is a proposal, easy to change in one table.)
- **The melody** (Aitor, 2026-11-19): **Sol · La♭ · Do · Sol (up) · Fa · Re**. Three of its notes
  are pairs, so it cannot be played without discovering them. It is also the motif hidden in every
  song.
- **It is alive from the moment Bernat sends it** (decided 2026-11-19). Hidden in the flat all along,
  it stays mute and the game ignores it until the portal at El Nucli sends it across. From then on it
  **always sounds** when pressed, anywhere in the game.
- **Gerard takes it out by himself** (decided 2026-11-19): when its PIR sees movement (someone picks
  it up, or walks in front of it) or a button is pressed, Gerard in the game takes the artilugio out
  and the player sees him pressing its buttons, the same ones, as they are pressed for real. It is
  learnt little by little: nothing explains it. **It is in his hands, not on screen** (Aitor,
  2026-11-19): he takes it out of his pocket and holds it like a pad, his thumbs going down on its
  buttons (`src/artilugio-held.ts`), in the street and in the fight.
- **It calls out until it is found** (Aitor, 2026-11-20): from the moment Bernat sends it, the board
  in its hiding place plays short bursts of random notes of its scale now and then, closer together
  while its PIR sees someone; before that it stays mute. It calls out only while the game is open
  and the server has just said so (Aitor, 2026-11-21): with nobody playing, or no server, it is
  silent whatever mode it kept, and a restarted server never loses it again. **Found** is someone in front of it for a
  few seconds, or a button pressed: it falls quiet and Gerard takes it out. Until then, people
  walking past do not make him take it out. **Once found**, he holds it out while it is pressed or
  the PIR keeps seeing someone, and puts it away a few seconds after neither (`firmware/artilugio`).
  Put back to sleep by the story, it is lost again.
- **Where the game runs** (decided 2026-11-19): Gerard plays on the **Windows PC at home**, with the
  game's server on the home network. The device talks to that server over Wi-Fi; the game never
  connects to the device.

What follows is the design before the board was chosen; where it disagrees, the lines above win.

- An **ESP32** board with a **screen** and a **speaker** (and more), **4 buttons**, on Wi-Fi.
- **Opaque, no instructions** (decided round 10). Nobody explains it and nobody mentions a hidden
  melody: the story only says the device exists. **It always sounds when a button is pressed**,
  but **it only works in the final battle**. Until then it is **dormant**.
- **It wakes in the final battle** (decided): colours burst on its screen and **the machine
  visibly changes**; that change is the only sign that now it matters.
- **The melody has 6 notes.** With 4 buttons that is not enough: Gerard **discovers that pressing
  two buttons at once sounds different**. ~~Four buttons alone give 4 sounds and the six pairs give
  6 more, 10 in all~~ (8 since 2026-11-19, above); the melody needs at least some of the pairs. Discovering the pairs is the
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

1. *(Replaced 2026-11-15: it no longer starts in the palace but at the portal in the salón de
   juegos; the rest of these steps still serve.)* **In the palace it slips away.** At the end of the room-order puzzle the artilugio is there, on
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
helps in person if needed, which is the last safety net). **No clue beyond the songs** (Aitor,
2026-11-19): the motif already repeats in every song and Gerard has to notice it by himself. The
only hints in the game are generic, that the Queen is very sensitive to music (docs/quests/bernat.md
§ Round 5), never about the melody or the device; Aitor, beside him, decides whether to help:

- **The music teaches.** Every track carries the 6-note motif, so a player has heard it for hours
  before the end without knowing it.
- ~~**When the Queen takes Aitor, the music strips down to the motif**: the battle song falls away
  and the 6 notes repeat alone, exposed, while the device wakes in Gerard's hands.~~ Replaced
  (Aitor, 2026-11-19): the battle song plays on, and **each press of the artilugio makes it step
  aside** so the device is heard, from its own speaker; the six notes bring in the last boss's song
  whole (docs/audio.md § The last fight). Nothing is said; the device glowing in his hands and the
  music giving way to it are the clue.
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

## Getting there: memory tickets (decided 2026-11-15, replaces round 13's money)

All missions can be done from the start in principle; what stands between Gerard and a friend is
**getting there**. **There is no money in the game** (decided 2026-11-15): euros, jobs, prices
and shops added complexity for nothing. What opens a trip is **remembering someone**.

- **The ticket is a memory** (built 2026-11-17). The network map in a station is **a tablet on
  the station's tiles**, and under the map is a field where Gerard **types on the keyboard**, under
  the tablet's own question, *"¿A quién recuerdas, y dónde?"*. If what he writes is right, the
  ticket prints and that station is marked on the map for good; if not, nothing opens. The gate
  stays diegetic: the tablet will not take him where he does not remember anyone.
- **What has to be written: Persona + Lugar** (decided 2026-11-17: enough, since it is not
  always obvious), a memory of someone in a place (*"Luca abrazándome a la salida de la Sagrada
  Família"*). The theme as a mechanic: remembering people, not paying, is what opens the way.
- **Places are not marked until they are remembered** (decided 2026-11-17): a station without its
  ticket is drawn and named like any other stop, with no glow, and cannot be picked.
- **A model judges it**: the text goes to the game server (`POST /api/transit/ticket`,
  `tickets.py`), which asks Claude (`ANTHROPIC_API_KEY`, `TICKET_MODEL`) with a structured answer
  (`station`, `person`, `place`); nicknames, descriptions and typos count. What opens each station
  lives in `src/tickets.json` and never reaches the browser's question, and only a known station
  comes back, so "ábrelo todo" opens nothing. Without a key, or if the model fails, the names in
  `tickets.json` judge by rule, so the game never breaks and tests never call the API.
- **The tablet answers in the world, never with a hint** (`src/tickets.ts`): *"Billete impreso:
  Sagrada Família."*; *"Te acuerdas de quién. No de dónde."* when only the person is right; *"Un
  sitio sin nadie no lleva a ningún sitio."* when only the place is; *"El billete sale en
  blanco."* otherwise.
- **The answer has a colour** (Aitor, 2026-11-21): the server's verdict carries it (`colour` in
  `tickets.py`, worked out from `person` and `place` so the model cannot contradict itself), and the
  tablet lights the answer and the field's ring with it: **green**, the ticket prints and the
  station opens; **yellow**, close (the person or the place is right); **red**, nothing written is
  any station's. When the tablet reads nothing (no server), no colour.
- **Clues live in the world** (`AGENTS.md`): photos and objects at home, people who mention
  someone, old messages on the phone, a cryptic line in the Diario. Never a list of what is missing.
- **Open from the start**: Fabra i Puig (home) and Trinitat Vella (the school under the castle,
  open from the start, § The frame). Every other station opens with a memory; each one is a story
  flag (`ticket-<station>`), in the *Billetes-recuerdo* arc of `STORY_ARCS`.
- **Food without shops**: healing items are food that people give and the party finds (a
  friend's tupper, a bakery bag left on a bench), each place's food its own; nothing is bought.

Open:

- **El Carmel and Espanya have no person yet**: both take *Aitor* for now (`tickets.json`), to
  change when someone is tied to them.
- Whether the answers come from Gerard's own life (he is the player and knows his friends) or
  from what the game shows; proposal: both, the world filling in when he is stuck.
- ~~Marta's long-distance train: the same tablet, or a harder memory.~~ Decided 2026-11-19: the same
  tablet, from Sants Estació (docs/quests/marta.md). ~~A harder memory (Marta in Alegia and a moment
  of her singing).~~ Aitor, 2026-11-21: Marta and Alegia are enough. Marta is from Tolosa, so Alegia
  is not a word anyone would write without being told: the hard part is the place itself, which only
  her voice message at a rehearsal names (`clue-marta`, docs/chapter-2.md § Hidden clues). Tolosa,
  Gipuzkoa or the Basque Country do not count.
- The landmarks' cards (Sagrada Família, Búnkers del Carmel…) still name famous places on the
  map before their station is remembered.

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

**Replaced on 2026-11-19 by [castle.md](castle.md)**: three generated phases between the built
zones, two bosses (Aurelià; Mar, Montse and Pilar) and the Queen, the throne only after both. What
follows is the earlier sketch, kept for the record.

Decided then (a sketch):

- ~~**A regular dungeon** (round 16): fixed rooms, the same every time. The roguelike idea
  (rooms reshuffled every run) was dropped.~~ Generated again, between fixed rooms.
- **Zones**, each with its **characteristic elements and puzzles** and ~~**a boss** at the end.
  The zone bosses are **teachers the user knows** (Aurelià, Montse, Pilar, …), each with a
  special trait to define.~~ The zones are the bosses' fixed rooms.
- **Beating a zone keeps it won**: the general danger level drops, that part stays beaten, and a
  **shortcut** opens to the next zone, so the next visit starts from there. The game nudges the party
  forward zone by zone.
- **The zones** (not in this order; to decide): **el patio**, **el gimnasio**, **la secretaría**,
  then **the throne room** and La Reina Bubbaloo.

Proposals:

- **Kept after falling**: everything, as anywhere else (ánimas, levels, lights, tickets,
  won zones); only a zone half done starts again from its beginning.
- **The general danger level** joins the castle's threat (`castleThreat`, today lowered only by
  ánimas): each zone won lowers it too, and the castle shows it from the street.
- **The artilugio's room order**: a fixed sequence of rooms across the zones, hinted in the world.
- **La secretaría last** before the throne: Gerard's own office (he is the school's secretary),
  his own routine as the last zone. Its material is being kept: each day played, what Gerard did
  and a summary of it (`docs/day-log.md`), for a boss made of his own habits and words.
- The cultural zones (the user's idea; what they mean is still open), and the possessed pupils,
  could live in el patio.

## How missions connect (to fill)

Who mentions whom, which ánima opens which place, where each clue lives. Fixed so far:

- The TV ticker → the R4 → Cardedeu (Nuria and Uri).
- Bernat → the artilugio → the palace's room puzzle.
- Marta's train ticket: which memory opens it (_open_).
- Emilie → a technical problem (which, and who sends the party to her: _open_).

## To reconcile with existing docs

- ~~Where the artilugio comes from~~ Decided (2026-11-15): Bernat brings it and sends it across
  to the real flat from the salón de juegos, through a portal and a puzzle with the flat's lights
  (§ From the salón de juegos to the real flat). § El artilugio point 2 and § Finding it at home
  step 1 are marked as replaced; `docs/bubbaloo-palace.md` and beat 5 of the main arc still
  mention the room-order puzzle as the artilugio's, to fix when the palace is picked up.
- `docs/quests/bernat.md` has Gerard phoning Bernat to meet; now **Bernat is the one who
  calls**, after the fall at the Queen. Whether that is Bernat's own mission or a second one.

- ~~`docs/lore.md`: the Queen is Nuria Mendoza~~ Updated (round 2): she is nobody, Nuria Mendoza
  has disappeared, three endings. `docs/chapter-2.md` § The choice and `docs/quests/nuria.md`
  updated too.
- `docs/quests/nuria.md`: the maze starts "round the corner, the street turns into a maze"; with
  the new rule it starts at a pink bubble in Jacint Verdaguer.
- **`docs/quests/nuria.md` needs a redesign for the tone** (decided): see its *Tone review*
  section for what conflicts.
- ~~`docs/chapter-2.md` § The Queen and the second round said the Queen did not fight at the
  throne.~~ Corrected 2026-11-19: the final fight is designed in `docs/castle-bosses.md`.
- `docs/quests/nuria.md` says falling in the mini-dungeon wakes Gerard at home with the mission
  undone; the new rule offers going back to the start of the block.
- `docs/chapter-2.md` § The palace says "the palace remembers nothing" and has one guard fight;
  the palace's zones (teacher bosses, shortcuts, the room puzzle) are a bigger design to write
  in `docs/bubbaloo-palace.md`.
- `docs/chapter-2.md` open question 3 (what the school is to Gerard) is answered: his workplace.
- **Main moved on while this map was drawn** (merged 2026-11-07), to fold in when it is picked up
  again: **Noísta** is retired (2026-11-01, Matemágico took its place; its row in the visual
  review stays only for reference); **Tecnópata** is Aitor's own ánima (`docs/animas/tecnopata/`);
  **Pedro** is in `docs/lore.md` § People and needs a row in *People* and a mission; Nuria's
  mission is **built** (Uri's tower, Vertitrón), so the bubble and falling items above apply to
  the built version; ánimas already level with EXP and take **ecos de luz** at the jar
  (`docs/animas/README.md`), to fit with food and gear.

## Open (tracker)

The order they will be asked in:

1. **The heart of the story**: ~~who the Queen is; the ending; Nuria Mendoza~~ (decided rounds
   2–3). Still open: what Bernat finds out; what each ending shows and how the final fight leads
   into it (serious tone); who gave Nuria Mendoza the nickname.
2. **El artilugio, the real one**: board, buttons, Wi-Fi, LEDs or sound; where it will be hidden;
   whether the melody exists yet.
3. **The final fight**: ~~Aitor possessed and player 2; what opens the throne~~ (decided round 12:
   Aitor plays against Gerard; nothing required, difficulty only; and 2026-11-15: she takes him
   at about 10 % of her PV, the first time it kills Gerard, and the device is used at that very
   moment from the second visit on, § The end, in order). Still open: how the turned fight
   plays, and what happens on later visits without the answer.
4. **The palace's zones**: ~~regular dungeon, zones with a teacher boss, shortcuts~~ (decided
   rounds 14–16). Still open: the zones' order; each teacher's trait; the cultural zones; the
   pupils.
5. **Each friend in three lines**: Marta, Luca, Emilie, the university friends, Jan and the
   parents (where, what the Queen did, a mechanic name, the ánima).
6. **The order graph and getting there**: who leads to whom; which memory opens each
   station, Marta's ticket.
7. **Falling in a mission**: going back to the block's start: does it cost hours, is it a menu or a
   diegetic moment?
8. **The second round**: same city or a time jump; how it fits the ending.
9. **Recreating Barcelona**: the method (above), the first test block, which zones and in what
   order, and the photos the user can take.
