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
battle: { src: 'music/battle.m4a', marks: { start: 0, loop: 2.368, ending: 130.766 }, loop: ['loop', 'ending'], bpm: 100, beatsPerBar: 4, downbeat: 'loop' },
```

- `loop` names the two marks the song loops between. What comes before the first is an intro that
  plays once; what comes after the second is an ending that only plays when the director jumps
  there. Loops are sample-exact (`AudioBufferSourceNode.loopStart` and `loopEnd`), so the file
  needs no silence trimmed and the seam has no gap.
- `bpm`, `beatsPerBar` and `downbeat` (a mark on the first beat of a bar) let jumps wait for the
  next beat or bar, so they land in time.

The director, `music` in [src/main.ts](../src/main.ts):

| Call | Does |
| --- | --- |
| `music.play('battle', { from: 'start', fade: .5 })` | Starts a song from a mark or second, crossfading (equal power) from whatever plays. The same song keeps going unless `restart: true`. |
| `music.jump('ending', { at: 'bar' })` | Moves the song to a mark on the next `beat`, `bar`, at the `loop-end`, or `now`, with a short crossfade. |
| `music.stop({ fade: 1 })` | Fades the song out. |
| `music.duck(true)` | Lowers and muffles the music, as the menus do. |
| `music.position()`, `music.playing` | Where the song is (following its loop), and which song it is. |

### Where music plays now

- **Fights**: the battle song comes in with the fight from its intro. On a win it jumps to its
  ending on the next bar and plays it out; on a fall it fades over 2.5 s; on an escape over 1 s;
  leaving the result screen fades whatever is left.
- **Menus**: the pause menu, the user menu and the lamp dial duck the music while open.

### Adding a song

1. Keep the master in `assets/music/<song>.<ext>` (WAV, FLAC, AIFF or M4A). It stays on your
   machine: `assets/` is never served or committed for audio. `just music-export <song>` puts the
   copy the game plays in `public/music/<song>.m4a`: copied as is if the master is already `.m4a`,
   otherwise encoded to AAC (which every desktop browser decodes). Run it again after changing the
   master.
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

The battle marks came from this process: quick notes lead into a low C2 on the downbeat at
2.368 s, and the loop is 214 beats at 100 BPM. Other candidates were 2.322 → 116.323 and
2.397 → 123.603. Times are as ffmpeg decodes the file, which is what `decodeAudioData` gives the
game; if a browser places them differently (the AAC priming is 44 ms), check by ear with
`dev-music`.

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
