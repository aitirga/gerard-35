# Music and sound

The game plays music and effects with the Web Audio API and no library. Everything is silent until
the first key, click or pad button, because browsers keep sound off until then.

```
music voices → duck → hush → muffle (lowpass) → Música level ┐
effects                                       → Efectos level ┴→ master (Silenciar) → speakers
```

| File | What it holds |
| --- | --- |
| [src/audio.ts](../src/audio.ts) | The engine: the AudioContext, the buses, the player's levels (saved in this browser), ducking and the decoded-file cache. |
| [src/music.ts](../src/music.ts) | `TRACKS` (songs and their marks) and the director that plays, crossfades, jumps and stops them. |
| [src/sfx.ts](../src/sfx.ts) | `SOUNDS` (effects, from a file or a synth recipe) and the menu sounds every menu shares. |
| [src/sound-ui.ts](../src/sound-ui.ts) | The pause menu's Configuración → Sonido page. |
| [src/title.ts](../src/title.ts) | The welcome screen the game opens on, under Aitor's piano. |
| [tools/music_loop.py](../tools/music_loop.py) | Finds where a song loops and renders the seam to listen to. |

## Songs

A track is a file under `public/music/` with **marks**: named seconds into the file.

```ts
battle: { src: 'music/battle.m4a', marks: { start: 0, loop: 2.398, ending: 131.998, end: 134.398 }, loop: ['loop', 'end'], bpm: 100, beatsPerBar: 4, downbeat: 'loop' },
```

- `loop` names the two marks the song loops between. What comes before the first is an intro that
  plays once; what comes after the second is an ending that only plays when the director jumps
  there. Loops are sample-exact (`AudioBufferSourceNode.loopStart` and `loopEnd`), so the file
  needs no silence trimmed and the seam has no gap.
- `stream: true` makes it a **long take**: a song of many minutes played from the file as it
  downloads (an `<audio>` element routed into the music bus), because decoding it whole would take
  hundreds of MB. It has no loop marks. `from: 'random'` comes in anywhere, and six seconds before
  the file ends it crossfades into another random point, so it plays on with no end. With `wraps: true`
  a random point is only picked as it starts: at the end of the file it crossfades into its top, so
  it never jumps while it plays. Jumps don't apply to it.
- `loudness` points a long take at its **loudness map** (`public/music/<song>.loudness.json`, dB
  for each second over the five round it), so a random point never jumps from a hush into a swell.
  Of six random points it takes the one nearest in loudness to what plays (the outgoing point, gain
  included) or, from silence or another song, to the take's median. The new point comes in with a
  gain that matches that loudness (at most 6 dB either way) and eases back to its own level over
  20 s. In `song-home`, two random points differ by up to 6.3 dB (1.8 dB typically); the chosen ones
  by at most about 2 dB, which the gain makes up.
- `bpm`, `beatsPerBar` and `downbeat` (a mark on the first beat of a bar) let jumps wait for the
  next beat or bar, so they land in time.
- `vamp: { from, to, laps: [2, 4] }` repeats the section between two marks a random number of
  times (laps, the first included), then lets the song go on. The repeat is the source's own loop,
  so it is sample-exact; halfway through the last lap the director lets go of it and the song plays
  past the section's end. `music.moveOn()` makes the lap it is in the last one, for a moment in the
  game to call later. With a `loop` too, the song starts over from the loop's start at its end (a
  new voice, sample-exact) and vamps again with new laps. `from: 'random'` starts it from the top.
- `cycle: 48` makes the file **versions of one cycle** of that many seconds, back to back, each
  starting on its downbeat so that one can follow another. The song opens with the first version,
  then plays the others picked at random (never the same twice in a row), with no end. The first
  never comes back: it starts from silence, while each of the others carries the reverb tail of
  the one before it in the file, so going back to it would cut that tail and drop the sound. The next
  version is queued 2 s before the seam and starts sample-exact on it, with a 20 ms crossfade. The
  number of versions comes from the file's length. `from: 'random'` opens it from the first version.
- `intro: '<mark>'` with a `cycle` puts the versions after an **intro**: the file is the intro, then
  the versions back to back from that mark. The song plays the intro once and the versions once in
  order, straight from the file (no seam), then any of them, never the same twice in a row, the first
  included (it follows the intro, so it carries the intro's tail, not silence). The last boss's song
  is made this way (§ The last fight).
- `rate` plays a song straight through slower (and so lower) or faster, and `tone` darkens it through
  a lowpass at that many Hz. Only for a song played straight: no loop, cycle or vamp.

The director, `music` in [src/main.ts](../src/main.ts):

| Call | Does |
| --- | --- |
| `music.play('battle', { from: 'start', fade: .5 })` | Starts a song from a mark, a second or `'random'`, crossfading (equal power) from whatever plays. The same song keeps going unless `restart: true`. |
| `music.jump('ending', { at: 'bar', loop: false })` | Moves the song to a mark on the next `beat`, `bar`, at the `loop-end`, or `now`, with a short crossfade; `loop: false` plays it out from there instead of looping. |
| `music.stop({ fade: 1 })` | Fades the song out. |
| `music.moveOn()` | Ends a vamp: the song finishes the lap it is in and goes on. |
| `music.duck(true)` | Lowers and muffles the music, as the menus do. |
| `music.hush(true, { fade: .4 })` | Takes the music out altogether; the song goes on underneath, so `hush(false)` brings it back where it would be. |
| `music.position()`, `music.playing` | Where the song is (following its loop), and which song it is. |

### Where music plays now

- **The welcome screen** ([src/title.ts](../src/title.ts)): the release opens on it (development only
  with `?title`): the game's name, *Mareas del Tiempo: La Reina*, and one button, «Nueva partida» for
  a new game and «Continuar» once one is under way, nothing else, over Gerard's room at night, so
  blurred it cannot be told. «Nueva partida» brings the room into focus and the game starts there;
  «Continuar» goes to black and opens where the save left them. Aitor's piano (`intro-piano`, 56 s) plays under it from its
  first note (the `piano` mark, past the file's opening second of silence) as soon as sound is on,
  and again after a four-second breath if it plays out while the screen waits. A browser keeps sound
  off until a key, click or pad button, unless it lets the page play (Chrome does once a site has
  played sound often enough, `audio.tryStart()`): otherwise the press that turns sound on only brings
  the piano in, and the next one starts the game, where the place's song comes over the piano.
  `just screenshots title --chrome` checks both cases and «Continuar».
- **Places**: `PLACE_SONGS` in [src/main.ts](../src/main.ts). In the Meridiana flat, `home`
  (`song-home`, 18 min) comes in over 4 s from a random point and plays on; leaving for a place
  without a song fades it over 2 s. A fight takes over, and the place's song comes back, from
  somewhere else, when the fight is over. Walking between two places with the same song keeps it
  going. `just screenshots place-sounds --chrome` checks the places below that got their song on
  2026-11-19, and their footsteps.
- **Childhood and the towns**: `triste` in the house the game opens in (its three floors), out in
  Passatge Maresme, and in every town, the same song always (Aitor, 2026-11-20): Cardedeu (Nuria's
  street and the street that never ends, not Uri's tower) and Alegia, as in Sant Quirze. The first time Aitor plays the piano there, Marta's «Izana»
  starts at once and `triste` fades out under it over 1.5 s.
- **The friends' missions** start on the dark mazmorra song, sad and plain (`mazmorra-oscuro`,
  Logic's `song-mazmorra-4`): Uri's tower, the university friends' camping, Emilie's (Poble Sec, her
  flat and her model) and Luca's (the Sagrada Família, outside and inside, Fran's salon included).
  Marta's Las cuerdas has her own voice instead (below). The beach where the university friends'
  mission starts is Barcelona's (below).
- **Boss rooms** (Aitor, 2026-11-19): in three of those missions, reaching the boss's room changes the
  song for `mazmorra-3`, from its top over 2 s, and the boss is fought to it, going on from where it
  was (`inBossRoom` and `BOSS_ROOM_FIGHTS` in [src/main.ts](../src/main.ts)). Any other fight there
  still has the battle song, and the room's song comes back after it. Each room counts until its boss
  falls; then the place's song comes back:
  - Vertitrón (Nuria's mission, Papagato's): Uri's tower once its third ring is behind them, the last
    climb to the summit.
  - La Sobremesa (the university friends'): the walled merendero north of the steel door (the
    camping's rows 3–19, columns 2–17), once Las parcelas has opened it.
  - El que no converge (Emilie's): the bottom of her model (`fondo`).

  Luca's Fran, Marta's La Voz and the castle's bosses keep their own music (the battle song; La Voz
  her recording; the Queen's last fight § The last fight). Looked at twice a second, so walking in or
  out changes it. `just screenshots boss-rooms --chrome` checks all three.
- **How the missions' take plays** (`mazmorra-oscuro`, 11 min), as in Uri's tower: from a different
  point every time they go in and every time a fight there ends, never jumping while it plays: at the
  end of the file it goes on from the top. `just screenshots tower-music --chrome` checks it.
- **Barcelona by day and by night** (Aitor, 2026-11-19): its streets (the Avinguda Meridiana, Sants,
  Plaça d'Espanya, the Carmel bunkers and the Barceloneta) play `concrete` by day, whole (its vamp and
  the rest), and `mazmorra-2` by night (`story.night`, from 21 h), when the palace's monsters are out
  and the party walks home from the station (src/night.ts). A fight there at night (a palace guard
  catching them on the way home) goes on to `mazmorra-2`, with no battle song; nightfall changes the
  song where they stand (`CITY` and `songHere` in [src/main.ts](../src/main.ts), looked at twice a
  second). Not the flat (home's own song), El Nucli (inside), Rec Comtal (the castle's) or the
  missions' places. `just screenshots city-music --chrome` checks day, night, a night fight and the
  Barceloneta; `street-music` the vamp.
- **La Reina Bubbaloo's castle**: `bubbaloo` (`bubbaloo-light`, 13 min) the same way, at the Rec
  Comtal school and inside the palace (chapter 1's too), haunted as below. Walking from the school
  into the palace keeps the same take going.
- **Fights**: the battle song comes in with the fight from its intro, in every fight but La Voz's
  and, once its six notes are played, the Queen's last. On a win it jumps to its ending on the next
  bar and plays it out; on a fall it fades over 2.5 s; on an escape over 1 s; leaving the result
  screen fades whatever is left.
- **Las cuerdas and La Voz** (docs/quests/marta.md § Final boss): Marta's own recording
  (`public/music/marta-voz.m4a`, 87 s, her eight-note phrase sung eight times). In Las cuerdas it
  loops far off, from a random point: quiet, low-passed at 650 Hz and mostly a 3 s room echo with no
  quality beaten, louder, brighter (5.2 kHz) and drier with each one (`distance` in
  `src/voz-song.ts`); the battle song takes over in the qualities' fights. In La Voz's fight there is
  no battle song: the recording loops whole and dry, held to the fight's clock: it stops with the
  pause menu and the fight's entrance, slows with a dual's banner, and jumps back if it drifts more
  than 80 ms. Its notes and their rhythm are the fight's (`VOZ_SONG` in `src/song.ts`, found by
  pitch). It fades on the result. `just screenshots marta-voz-lejos --chrome` checks all of it.
- **Marta at the piano**: `izana` (`marta-izana`, 21 s, her «Izana dena geroa») plays once the first
  time Aitor plays the piano in Alegia, under the dialogue, and plays out into Las cuerdas.
- **Menus**: the pause menu, the user menu and the lamp dial duck the music while open.

### The last fight

The Queen's last fight (`reina-vuelta`, docs/castle-bosses.md § With the artilugio) and the end,
in `scoreNote`, `scoreFreed` and `scoreBattle` in [src/main.ts](../src/main.ts) (Aitor, 2026-11-19):

1. **The battle song**, as in any fight.
2. **Holding Aitor her music does not change; the first note of the artilugio fades it out for
   good** over 2.5 s (Aitor, 2026-11-19), so the artilugio is heard. The real board sounds on its own
   speaker, in the room and with no delay; the game only sounds the notes of the keys and the pad
   standing in for it (anywhere in the game, not only here).
3. **The sixth note** frees Aitor and brings in, over that silence, **the last boss's song** (`reina`, Logic's
   `battle-final`, 90 BPM), whole, from its intro: two bars of intro and three versions of its 16-bar A
   (42.667 s each, from 5.333 s), played once in order, then any of them until the fight ends (`intro`
   above). Its marks were measured on the bounce: bars 1–2 match nothing 16 bars on, and every bar from
   the 3rd matches its own 16 bars later.
4. **Her fall** fades it over 4 s into silence, and no place's song comes in from then until the end
   has played (`finale`).
5. **The last choice** (src/endings.ts): no music, only the wind through the throne room's open
   balcony (`BEDS.wind`). Once Gerard chooses, the wind goes and the welcome screen's piano comes back,
   sadder (`intro-triste`: the same file at 0.9 of its speed, so slower and a little lower, through a
   lowpass at 2.2 kHz). It plays out over Aitor's line, the epilogue and the morning after, and only
   then does the place's song come in.

`just screenshots reina-music --chrome` plays all of it. `just dev-music reina 128` plays the end of
the third A going back to an earlier one.

### The mazmorra, concrete and triste songs

`mazmorra-2` and `concrete` are at 110 BPM, measured with `just music-loop` and a self-similarity
check of the files; `mazmorra-3` at 90.

- `mazmorra-2` (`song-mazmorra-2`, 4:48) holds six versions of one 48 s cycle: 88 beats, Logic's
  bars 1 to 23. Each starts on its downbeat at 0, 48, 96, 144, 192 and 240 s, and the file ends on
  the sixth's seam at 288 s. Version 1 opens it, then 2–6 mix. Version 1 is also the quietest
  (−17.9 dB against −16.6 to −17.2 for the rest). Barcelona's streets play it by night, and their
  fights then (2026-11-19).
- `mazmorra-oscuro` (`song-mazmorra-oscuro`, 11:14) is Logic's `song-mazmorra-4`, the friends'
  missions' song: a long take, streamed, with its loudness map (−26.8 to −16.9 dB, median −20.7). A
  new bounce of `song-mazmorra-4` (2026-11-19) is the same audio (correlation .99999, the difference
  −47 dB of encoding), so the game keeps its file.
- `mazmorra-3` (`song-mazmorra-3`, 3:20) is the boss rooms': 75 bars at 90 BPM, played as three
  versions of a 25-bar part (bars 1, 26 and 51 match within .94–1.00), and its end runs back into its
  top, so it loops whole. The file starts already sounding, so cutting at exactly 0 → 200 s clicked (a
  step of .10 against .02 between neighbouring samples there); the loop runs from 104 samples in (at
  48 kHz) to 59 before 200 s, where the two waveforms meet (a step of .0014), 2 ms short of 75 bars.
- `concrete` (`song-concrete`, 1:40) is 46 bars from its first downbeat at 0 s to 100.364 s.
  Bars 1 to 9 open; bars 10 to 17 (19.594 → 37.049 s, Logic's locators 10 to 18) vamp three to
  seven times; then bar 18, the break at bars 19 and 20 (40–43.6 s) and the rest play, and at
  100.364 s it starts over from bar 1. The song runs in 8-bar phrases (bars 2–9 and 10–17), each
  ending on the same drum fill, so bar 10 starts with the tail of bar 9's fill just as bar 18 does
  with bar 17's. Going back to bar 2 instead cut that tail off: bar 2 follows the quiet bar 1, so
  the cymbals stopped dead, with a click (a jump of .25 at the cut, against at most .055 between
  neighbouring samples there). It was bounced again on 2026-11-19: bars 1–17 are as before, bars
  18–20 (bar 18 now opens like bar 10, .99 alike against .94) and 34–36 were rewritten. On the new
  bounce the old marks (58 samples before the downbeats) jumped .05 against a step of .029, so both
  now sit 2035 samples (42.4 ms) before the downbeats of bars 10 and 18, inside the fill bars 9 and
  17 share, where the two waveforms meet (a step of .007), exactly 8 bars apart. Bar 19 starts the
  break, so the section stops before it. It is Barcelona's by day (above); the school on Rec Comtal plays the castle's
  song.

- `triste` (`song-triste`, 1:36) loops whole: 80 beats (20 bars) at 50 BPM, playing at full level
  to the last sample. The file starts already sounding, so cutting at exactly 0 → 96 s clicked (a
  jump about 15 times the largest natural step there); the loop runs from 0.000896 s (43 samples at
  48 kHz) to 95.998729 s (61 before 96 s), where the two waveforms meet, 2 ms short of 80 beats. It
  is the childhood street's song, Passatge Maresme, where the game starts.

`just dev-music mazmorra-2 45` plays the first seam 3 s in, and `just dev-music concrete 34`
the vamp coming back to bar 10.

### Adding a song

1. Keep the master in `assets/music/<song>.<ext>` (WAV, FLAC, AIFF or M4A). It stays on your
   machine: `assets/` is never served or committed for audio. `just music-export <song>` puts the
   copy the game plays in `public/music/<song>.m4a`: copied as is if the master is already `.m4a`,
   otherwise encoded to AAC (which every desktop browser decodes), and writes its loudness map
   beside it (`just music-loop`'s `loudness` command). Run it again after changing the master.
2. Measure on the exported file, since encoding can shift the start by a few milliseconds.
   `just music-loop public/music/<song>.m4a` prints the tempo, the opening notes (to spot the
   downbeat the loop starts on) and ranked seam candidates. Narrow the search with
   `--start 2.1:2.7 --end 110:` once you know roughly where.
3. `just music-seam public/music/<song>.m4a <start> <end>` writes
   `output/music/<song>/seam-<start>-<end>.wav`: the seconds before the end, then those after the
   start. If you can't hear the join, it's a good loop. A good loop is usually a whole number of
   beats long.
4. Add the track to `TRACKS` and play it from the game (e.g. on `onLocation` for a place's song).
5. `just dev-music <song> <mark or seconds>` opens the game and plays it from there on the first
   key, e.g. `just dev-music battle 126` to hear the battle seam come round. In the console,
   `gerard.music.position()` tells where the song is.

The battle marks came from this process: quick notes end on a piano G that rings until the C
strikes at 2.398 s (the onset list says 2.368 s, but its frames are 12 ms wide; a 2 ms loudness
scan finds the attack). The loop starts on that attack, so it comes round on the C alone, not on
G–C, and runs everything after it, the slow notes at the end included: 220 beats (55 bars) at
100 BPM to 134.398 s, 22 ms before the file ends. On a win the song jumps to its last hit at
131.998 s and plays out. Earlier loops started 30 ms early (the G's tail came round with it) and
ended at 130.766 s (half a bar short) or 131.968 s (cut the slow notes). Times are as ffmpeg decodes the file, which is what `decodeAudioData` gives the
game; if a browser places them differently (the AAC priming is 44 ms), check by ear with
`dev-music`.

### Songs waiting for their place

Each master in `assets/music/` is named after its
Logic project in `~/Music/Logic/G-35/` (`song-triste`'s is still called `song-sad`, and
`song-mazmorra-4` is exported as `song-mazmorra-oscuro`). Projects not bounced yet have no master:
`intro-final`, `intro-light`, `song-1`, `song-concrete-recovered` and `song-mazmorra-1` (`intro-piano`
came from one of the two intros). Bounce into `assets/music/`, not `dist/`: `just build` empties
`dist/`.

### The castle's haunt

A track with `haunted: true` plays through [src/haunt.ts](../src/haunt.ts) instead of straight into
the music bus. `music.haunt(level)` sets how haunted, from 0 (the song as it is) to 1; it applies
while a haunted song plays and goes back to 0 for any other song (a fight) or silence. The game sets
it to the castle's threat (`castleHaunt`: `story.castleThreat` in chapter 2, which every ánima
lowers by .15 down to .1; a fixed .35 in chapter 1's dream), whenever a place's song starts and
whenever the story changes.

What the level does, all tuned to the song's C minor and going into the music bus, so the music
slider and the menus' duck apply. Every number below is a knob in `HAUNT` at the top of
[src/haunt.ts](../src/haunt.ts): an effect is silent up to its `from` level and grows to `full` at
level 1, and a sound plays while the level is above its `from`, at its `volume` (1 as designed, 0
never). As the party gathers ánimas and gets ready to go in, the threat falls and each effect eases
along its own range, so tuning how the castle calms down is editing that table.

- **The song warps**: a delay line swept by two slow LFOs bends its pitch like a warped tape (up to
  24 cents at .37 Hz and 10 at .06 Hz at level 1), and a lowpass darkens it (20 kHz at 0, 3.8 kHz
  at 1).
- **Beds**: a low C2–G2 drone that beats slowly (from .15) and a draught of filtered noise
  wandering across the stereo field (from .4).
- **Sounds now and then**, on average one every 36 s at level 0 down to every 12 s at 1, through a
  long dark echo. Each plays while the level is above its `from`, the way the castle's pieces stand
  (src/palace.ts):

| Sound | From | |
| --- | --- | --- |
| `breath` | .25 | A breath crossing from one side to the other. |
| `bell` | .4 | A minor-third bell on C or G, once or twice, far off. |
| `thunder` | .55 | A low roll with cracks: the storm over the crown appears at the same threat. |
| `sag` | .7 | The song itself drags like a tape and catches up (its `volume` is how far). |
| `heartbeat` | .85 | Four slowing beats under the floor; only before the first ánima. |

So the dream has the breath; chapter 2 starts with everything, the heartbeat goes with the first
ánima, the sag with the second, and at the floor only the warped song and its drone are left.

Hear it with `just dev-music bubbaloo random .8` (the third argument is the level), and play one
sound on demand from the console with `gerard.music.haunted.sound('bell')`. To try a knob without
reloading, change it from the console and set the level again:
`const { HAUNT } = await import('/src/haunt.ts'); HAUNT.drone.full = .05; gerard.music.haunted.set(.8)`
(sounds pick up their new `from` and `volume` the next time one plays). `just screenshots
castle-music --chrome` checks the song, the level and a level-matched wrap in the game, and logs each sound's loudness:
against the song's median of about .057 RMS, they sit between .005 (the breath) and .022 (the
heartbeat), and the beds at level 1 at about .02.

## Effects

A sound in `SOUNDS` is either a file (`src: 'sfx/step.ogg'` under `public/`) or a synth recipe
that draws it with oscillators and noise. Each has a `gap` (no replay sooner than that), a
`voices` cap (no more at once) and `jitter` (random detune in cents, so repeats don't sound
mechanical). `sfx.play(id, { volume, pan })` plays one.

There are no sound files yet: every effect is a synth recipe, and the artilugio's notes from the
real board are not played here at all (its own speaker plays them; § The last fight). `just dev-fx` has a button for each
under *Sonidos*, to hear them, and `just screenshots sfx` measures them all (and the beds) and
checks a fight's. `just screenshots calle-sounds` logs what Nuria's street asks for as it turns into
La calle, and the bubble's hiss at each distance.

**Which sound goes with what in a fight is one table**, `SKILL_SOUNDS` and `FOE_SOUNDS` in
[src/battle-sounds.ts](../src/battle-sounds.ts): `start` as an action begins, `impact` as it lands.
A new skill or foe does not compile until it says how it sounds there. A dual sounds like its two
halves together (`dualSounds`): both starts, both impacts.
What only the fight's picture knows the moment of, the battle scene cues (`setCue`), and what only
the fight's screen knows, the screen does (`sound`).

| Sound | When |
| --- | --- |
| `ui-move` | Moving from one menu button to the next (keyboard or pad). |
| `ui-confirm` | Pressing a menu button. |
| `ui-back` | A back button, or Escape out of a menu. |
| `hit` | A blow lands: Atacar, a dog, Vertitrón; softer from a peeled onion. |
| `hit-guarded` | A blow lands on someone holding on. |
| `guard`, `mana` | Defender, and the maná it gives back. |
| `swallowed` | The palace minion's gum swallows a blow. |
| `fire-cast`, `fire-hit`, `fizzle`, `melt` | Foc Binari: gathering; landing and lighting; going out on wet layers; melting the gum. |
| `burn` | Quemado pulses. |
| `think` | *Análisis Parálisis*, *Ángulo exacto*. |
| `cast-soft`, `heal` | *Cardioide*: gathering and curing; `heal` also *Ronroneo*. |
| `meow`, `meow-soft` | Haru or Yuki going: every Papagato skill (`meow-soft`, Yuki's purr). |
| `claw` | *Zarpazo sangriento*, each of *Zarpazos*' claws. |
| `claw-deep` | *Zarpa en la llaga*. |
| `bleed` | A wound spent as the blow lands, and Sangrado at the end of a round: wet, a splash more than a note. |
| `crit` | A golpe crítico, on the frame the fight stops, before anything else of the blow: a dry crack, its weight below and a thin ring left over the hold. A flurry's later ones as each claw lands. |
| `peel` | A layer comes off an onion. |
| `eco-fa`, `eco-la`, `eco-do`, `eco-dacapo`, `eco-pip` | Sincopante's ecos with Marta's voice (docs/animas/sincopante/README.md § Sound): her Fa, La and Do, the start of her phrase in Da capo, and a glass note on Fa an octave up for each maná pip Da capo fills. All sent through 2.8 s of a hall's echo (`ECO_HALL`: a ConvolverNode on the sound's own level, a third of it, `hall` and `wet` on a sound), so they ring in a big room past the fight's song; Da capo ends on her chord, the three at once. |
| `reina-la` | La Reina Bubbaloo singing to herself as her hands come down at the end of chapter 1 (`docs/lore.md` § Her music): a woman's voice on «la», the playground's chant (sol mi la sol mi, `QUEEN_LA`). A sawtooth and its fundamental through the four bands of an «a», each syllable opening from an «l», a vibrato on the notes she holds, a breath under it, and mostly a high hall's echo (a 3 s convolution, darker as it dies), so she sounds far above. The castle's song is hushed for it (`music.hush`) and gone in the dark that follows, so home's song comes in from silence. A recording can replace it (`src`). About 6.5 s with its echo, peak .27. |
| `slam` | A big onion or a palace guard coming down (an Aplastón too); Vertitrón's blows on both (Barrido, and with `crack` its Rayo terrorífico). |
| `bark`, `spit`, `splash`, `glitch`, `gust` | A dog; the minion; the dishes; the arcade ghosts; Vertitrón. |
| `zap` | Atacar · Eléctrico landing, and its Tormenta. Agua and Fuego use `splash` and `fire-hit`, softer; their reactions, `fizzle` and `burn`. |
| `think`, then `cast-soft` (`fire-cast` with Fuego) | Matemágico's thrown Atacar and Ángulo exacto: the circle opening, then the ball leaving (`spellLaunch`). |
| `game-over` | A fantasmita's «GAME OVER» (only its blast: Game Over is no longer a monster). |
| `stat-up`, `stat-down` | Stats going up or down (`BattleEffect.stats`, with `src/stat-fx.ts`). |
| `ko`, `dissolve` | Someone falls; a beaten foe coming apart (src/disintegrate.ts). |
| `poof` | Something gone in a puff (no fight uses it now). |
| `flee` | Huir. |
| `anima-swap`, `denied` | Changing ánima with L or R, or having nothing to change to. |
| `dual-armed` | A dual's banner coming up while it is aimed, before it goes off (`dual` is its start in the fight). |
| `awaken` | An ánima waking up mid-fight. |
| `unlock`, `pickup` | A new ánima or a skill learned; an item gained. Out of fights too. |
| `level-up`, `skill-learned` | On a fight's victory screen: an ánima's level stamping in; a skill it learned taking the screen. |
| `rise`, `sink`, `stretch` | Nuria's street turning into La calle que no acaba (src/street-shift.ts): a house born out of the ground (a rumble, stone grinding and cracking up, a thud as it settles), what stood beyond the corner going down, and the corner stretching out into the street's start. |
| `step`, `step-floor`, `step-sand`, `step-water` | A foot landing (the walk cycle's `landed`, src/game.ts): Gerard's at half (more running), whoever walks with him quieter and from their side. Which one, by place, is `STEPS` in [src/sfx.ts](../src/sfx.ts): `step` on hard ground (streets, stone, marble) where it says nothing, `step-floor` on floors indoors (the house, the flat, El Nucli), `step-sand` on the beach and the camping's gravel, `step-water` in Emilie's flooded flat, and none in Las cuerdas. About .01 RMS, under a menu's tick. |
| `partial-1` … `partial-6` | Additive synthesis (`additive`): a tone of 220 Hz built from its first one to six odd harmonics at 1/k, the newest with an accent, so a pure sine becomes a bright, almost square chord. One a strike, each a partial more (`partialSound(n)`): Serie de Fourier. In tune, no jitter. |
| `string-1` … `string-4` | A plucked string (`pluck`: eight harmonics of a string plucked a fifth of the way along, the high ones dying first, a click of the finger), a whole tone higher each (`stringSound(beat)`): Corriente alterna's latidos. |
| `chaos-hum`, `struck` | A low hum (a sawtooth and its sub through a closing lowpass) whose pitch trembles as a Lorenz attractor's x does, falling an octave in 2 s as it settles; and the single bell-like note it ends on. Atractor extraño. |
| `film-shimmer`, `film-pop` | A soap film drawn (high glass partials beating in pairs over a wet hiss) and bursting (a soft pop, drops flung off). Superficie mínima. |
| `bubbles`, `gas-crack` | Water splitting (some twenty little rising chirps over a low gurgle), and gas going off, one dry crack a cloud (four can overlap). Electrólisis. |
| `peg`, `pachinko`, `chord-swell` | A ball off a peg (one tick, `gap` 0 and sixteen voices, so each can be panned where it falls with `stage.pan`), a whole board rattling down across the stereo field, and a soft D major chord held while a curve is drawn. Campana de Gauss. |
| `whine`, `snap` | A capacitor charging (a thin whine climbing over 1.6 s) and its discharge. Arco voltaico. |
| `luz-azul`, `luz-verde`, `luz-naranja`, `luz-rojo`, `luz-oro`, `luz-blanca` | Fran's salon: the windows' light turns to that colour in a fight. A pane of stained glass rings once, quiet and short; the cold lights higher than the warm, the white one plain. |

A sound from somewhere in the street (the shift's houses) comes from where it stands: quieter the
further from Gerard (down to a fifth at 45 m) and panned to its side of the screen (`heard` in
[src/game.ts](../src/game.ts)), through `sfx.play(id, { volume, pan })`.

### Sounds that go on

A sound in `BEDS` plays for as long as something is there, not once: `sfx.bed(id, level)` is
called every frame with `{ volume, pan, drive }` (`drive` 0–1 steers it, what it means is up to
each) and eases to it; called with no level it fades out and stops. It goes through the effects
bus, so the Efectos slider applies.

| Bed | When |
| --- | --- |
| `hiss` | The bubble at the end of La calle que no acaba (src/fear-portal.ts). A sharp hiss breathing on two slow swells, a narrower whirl of air going up and down and round from side to side at the bubble's own pace, and a low draught pulling into its well. Silent down the street, it comes up from about 32 m away to its full at the bubble (`hiss` in src/game.ts); `drive` is how close the party is, so the whirl turns faster and louder as the bubble does. Quiet in a menu or a fight, it fades out through the bubble into the tower. |

| `wind` | The last choice (src/endings.ts, § The last fight): gusts of air through the throne room's open balcony on two swells that never line up, wandering from side to side, a thin whistle now and then, and the city's far hum under it. About .033 RMS, by the hiss's level; its knobs are `WIND` in src/sfx.ts. |

`sfx.bed(id, level, ease)` eases to each level over `ease` seconds (a time constant, .15 by default):
the wind comes in over 1.5 and goes over 1.2.

Its layers' levels, far (`drive` 0) and at the bubble (1), are knobs in `HISS` in
[src/sfx.ts](../src/sfx.ts), heard the next time the hiss starts:
`const { HISS } = await import('/src/sfx.ts'); HISS.whirl = [.06, .35]`, then go back into La calle.
At the bubble it sits at about .049 RMS (.03 the hiss, .025 the whirl, .034 the draught); a
house rising at about .12, under a fight's `slam` (.14).

The menu sounds come from `watchMenuSounds`, which listens to focus and clicks for the whole page.
Keyboard, pad and mouse all go through them, so the menus need no sound code of their own.
Buttons in the street (talk, walk, centre the view) are left quiet.

Still to do: ambiences per place (each place card in docs/visual-style.md says its own in words), and
real recorded sounds where a recipe falls short (`src` in `SOUNDS` takes a file under `public/`).

## MIDI, later

Not built. The plan: a track with `kind: 'midi'` parsed with `@tonejs/midi`, its notes scheduled
on the AudioContext clock through a small synth or a SoundFont, and the same voice shape (start,
fade, stop, position), so the director plays, loops, jumps and crossfades it like a file. Marks
would be in bars and beats instead of seconds.
