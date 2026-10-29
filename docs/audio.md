# Music and sound

The game plays music and effects with the Web Audio API and no library. Everything is silent until
the first key, click or pad button, because browsers keep sound off until then.

```
music voices → duck → muffle (lowpass) → Música level ┐
effects                                → Efectos level ┴→ master (Silenciar) → speakers
```

| File | What it holds |
| --- | --- |
| [src/audio.ts](../src/audio.ts) | The engine: the AudioContext, the buses, the player's levels (saved in this browser), ducking and the decoded-file cache. |
| [src/music.ts](../src/music.ts) | `TRACKS` (songs and their marks) and the director that plays, crossfades, jumps and stops them. |
| [src/sfx.ts](../src/sfx.ts) | `SOUNDS` (effects, from a file or a synth recipe) and the menu sounds every menu shares. |
| [src/sound-ui.ts](../src/sound-ui.ts) | The pause menu's Configuración → Sonido page. |
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
  the file ends it crossfades into another random point, so it plays on with no end. Jumps don't
  apply to it.
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

The director, `music` in [src/main.ts](../src/main.ts):

| Call | Does |
| --- | --- |
| `music.play('battle', { from: 'start', fade: .5 })` | Starts a song from a mark, a second or `'random'`, crossfading (equal power) from whatever plays. The same song keeps going unless `restart: true`. |
| `music.jump('ending', { at: 'bar', loop: false })` | Moves the song to a mark on the next `beat`, `bar`, at the `loop-end`, or `now`, with a short crossfade; `loop: false` plays it out from there instead of looping. |
| `music.stop({ fade: 1 })` | Fades the song out. |
| `music.moveOn()` | Ends a vamp: the song finishes the lap it is in and goes on. |
| `music.duck(true)` | Lowers and muffles the music, as the menus do. |
| `music.position()`, `music.playing` | Where the song is (following its loop), and which song it is. |

### Where music plays now

- **Places**: `PLACE_SONGS` in [src/main.ts](../src/main.ts). In the Meridiana flat, `home`
  (`song-home`, 18 min) comes in over 4 s from a random point and plays on; leaving for a place
  without a song fades it over 2 s. A fight takes over, and the place's song comes back, from
  somewhere else, when the fight is over.
- **Streets**: `sad` in Passatge Maresme and `concrete` on Meridiana street, each from the top
  over 4 s (`sad` from a random point). `just screenshots street-music --chrome` checks both and the
  vamp.
- **La Reina Bubbaloo's castle**: `bubbaloo` (`bubbaloo-light`, 13 min) the same way, at the Rec
  Comtal school and inside the palace (chapter 1's too), haunted as below. Walking from the school
  into the palace keeps the same take going.
- **Fights**: the battle song comes in with the fight from its intro. On a win it jumps to its
  ending on the next bar and plays it out; on a fall it fades over 2.5 s; on an escape over 1 s;
  leaving the result screen fades whatever is left.
- **Menus**: the pause menu, the user menu and the lamp dial duck the music while open.

### The mazmorra, concrete and sad songs

The first two are at 110 BPM, measured with `just music-loop` and a self-similarity check of the files.

- `mazmorra-2` (`song-mazmorra-2`, 4:48) holds six versions of one 48 s cycle: 88 beats, Logic's
  bars 1 to 23. Each starts on its downbeat at 0, 48, 96, 144, 192 and 240 s, and the file ends on
  the sixth's seam at 288 s. Version 1 opens it, then 2–6 mix. Version 1 is also the quietest
  (−17.9 dB against −16.6 to −17.2 for the rest). It is for friends' missions, one song per mission, picked among the
  mazmorra songs.
- `concrete` (`song-concrete`, 1:40) is 46 bars from its first downbeat at 0 s to 100.364 s.
  Bars 1 to 9 open; bars 10 to 17 (19.635 → 37.090 s, Logic's locators 10 to 18) vamp three to
  seven times; then bar 18, the break at bars 19 and 20 (40–43.6 s) and the rest play, and at
  100.364 s it starts over from bar 1. The song runs in 8-bar phrases (bars 2–9 and 10–17), each
  ending on the same drum fill, so bar 10 starts with the tail of bar 9's fill just as bar 18 does
  with bar 17's. Going back to bar 2 instead cut that tail off: bar 2 follows the quiet bar 1, so
  the cymbals stopped dead, with a click (a jump of .25 at the cut, against at most .055 between
  neighbouring samples there). Both marks sit 58 samples (1.2 ms) before the downbeat, where the
  two waveforms meet within a natural step. Bar 19 starts the break, so the section stops before
  it. It is for the concrete, robot-like places: Meridiana street (`meridiana-calle`) for now; the
  school on Rec Comtal plays the castle's song.

- `sad` (`song-sad`, 1:36) loops whole: 80 beats (20 bars) at 50 BPM from 0 to 96 s, playing at
  full level to the last sample. It is the childhood street's song, Passatge Maresme, where the
  game starts.

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

Masters in `assets/music/`, not exported or played yet (`mazmorra-2` is exported and waits for
Uri's tower, above):

| Song | Length | Idea |
| --- | --- | --- |
| `intro-piano` | 0:56 | The game's welcome screen, when it exists. |

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

| Sound | When |
| --- | --- |
| `ui-move` | Moving from one menu button to the next (keyboard or pad). |
| `ui-confirm` | Pressing a menu button. |
| `ui-back` | A back button, or Escape out of a menu. |
| `hit` | A blow lands in a fight (from the battle scene's impact moment). |
| `heal` | A cure or a boost lands. |

The menu sounds come from `watchMenuSounds`, which listens to focus and clicks for the whole page.
Keyboard, pad and mouse all go through them, so the menus need no sound code of their own.
Buttons in the street (talk, walk, centre the view) are left quiet.

Still to do: footsteps (from the walk cycle's foot plants), skill-specific combat sounds,
ambiences per place, and songs for places.

## MIDI, later

Not built. The plan: a track with `kind: 'midi'` parsed with `@tonejs/midi`, its notes scheduled
on the AudioContext clock through a small synth or a SoundFont, and the same voice shape (start,
fade, stop, position), so the director plays, loops, jumps and crossfades it like a file. Marks
would be in bars and beats instead of seconds.
