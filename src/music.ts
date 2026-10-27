import type { GameAudio } from './audio';

/**
 * Songs and how they play (docs/audio.md). A track is a file under public/ with named marks in
 * seconds; `loop` names the two marks it loops between once it reaches them, so whatever comes
 * before the first is an intro and whatever follows the second is an ending that only plays
 * when the director jumps there. `bpm`, `beatsPerBar` and `downbeat` (a mark on the first beat
 * of a bar) let jumps wait for the next beat or bar.
 */
export interface Track { src: string; marks: Record<string, number>; loop?: readonly [string, string]; bpm?: number; beatsPerBar?: number; downbeat?: string }
export const TRACKS = {
  // Measured with `just music-loop`: the quick notes lead into a low C on the downbeat at 2.368 s;
  // from 130.766 s (214 beats later) the song closes on its last hit and decays, which plays on a win.
  battle: { src: 'music/battle.m4a', marks: { start: 0, loop: 2.368, ending: 130.766 }, loop: ['loop', 'ending'], bpm: 100, beatsPerBar: 4, downbeat: 'loop' },
} satisfies Record<string, Track>;
export type TrackId = keyof typeof TRACKS;
export const isTrack = (id: string): id is TrackId => Object.hasOwn(TRACKS, id);

/** Where to jump: right away, on the next beat or bar, or when the loop comes round. */
export type Quantize = 'now' | 'beat' | 'bar' | 'loop-end';

/** A mark's time, or the seconds themselves. */
export function markTime(track: Track, at: string | number) {
  if (typeof at === 'number') return at;
  const time = track.marks[at];
  if (time === undefined) throw new Error(`No "${at}" mark in ${track.src}`);
  return time;
}
export function loopRange(track: Track): [number, number] | undefined {
  return track.loop ? [markTime(track, track.loop[0]), markTime(track, track.loop[1])] : undefined;
}
/**
 * The song position after `elapsed` seconds of a voice started at `offset`. A voice started
 * before the loop's end wraps back to its start; one started past it (the ending) plays straight.
 */
export function loopPosition(elapsed: number, offset: number, loop?: readonly [number, number]) {
  const position = offset + elapsed;
  if (!loop || offset >= loop[1] || position < loop[1]) return position;
  return loop[0] + (position - loop[0]) % (loop[1] - loop[0]);
}
/** Seconds from `position` to the next beat, bar or loop end; never past the loop's end, where the song wraps. */
export function untilBoundary(position: number, at: Quantize, track: Pick<Track, 'bpm' | 'beatsPerBar' | 'downbeat' | 'marks'>, loop?: readonly [number, number]) {
  const end = loop && position < loop[1] ? loop[1] : undefined;
  if (at === 'now') return 0;
  if (at === 'loop-end') return end === undefined ? 0 : end - position;
  if (!track.bpm) return 0;
  const step = 60 / track.bpm * (at === 'bar' ? track.beatsPerBar ?? 4 : 1);
  const origin = track.downbeat ? track.marks[track.downbeat] ?? 0 : 0;
  const next = origin + Math.ceil((position - origin) / step - 1e-6) * step;
  return Math.max(0, Math.min(next, end ?? Infinity) - position);
}
/** An equal-power fade: a crossfade made of one going in and one going out keeps the loudness even. */
export function fadeCurve(from: number, to: number, steps = 32) {
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1) * Math.PI / 2;
    curve[i] = from + (to - from) * (to > from ? Math.sin(t) : 1 - Math.cos(t));
  }
  return curve;
}

interface Voice { track: TrackId; source: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number; loop?: [number, number] }
/** Lead time for anything scheduled, so the first samples are never late. */
const LEAD = .03;

export type Music = ReturnType<typeof createMusic>;

/** The director: one song at a time, crossfading between songs and jumping between marks. */
export function createMusic(audio: GameAudio) {
  let current: Voice | undefined;
  let generation = 0;

  function ramp(param: AudioParam, to: number, at: number, duration: number) {
    // A fade still running would overlap the new curve, so hold where it is now and start over.
    const from = param.value, now = audio.buses!.context.currentTime;
    param.cancelScheduledValues(0);
    param.setValueAtTime(from, Math.min(now, at));
    if (duration <= 0) param.setValueAtTime(to, at);
    else param.setValueCurveAtTime(fadeCurve(from, to), at, duration);
  }
  function start(id: TrackId, buffer: AudioBuffer, offset: number, at: number, fade: number) {
    const { context, music } = audio.buses!;
    const track: Track = TRACKS[id];
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    const range = loopRange(track);
    // Starting in the ending means playing it out, not jumping back into the loop.
    const loop = range && offset < range[1] ? range : undefined;
    if (loop) { source.loop = true; source.loopStart = loop[0]; source.loopEnd = loop[1]; }
    gain.gain.value = fade > 0 ? 0 : 1;
    source.connect(gain).connect(music);
    const voice: Voice = { track: id, source, gain, startedAt: at, offset, loop };
    source.onended = () => { gain.disconnect(); if (current === voice) current = undefined; };
    source.start(at, offset);
    if (fade > 0) ramp(gain.gain, 1, at, fade);
    return voice;
  }
  function release(voice: Voice, at: number, fade: number) {
    ramp(voice.gain.gain, 0, at, fade);
    voice.source.stop(at + fade + .05);
  }
  function position(voice: Voice, now: number) {
    return loopPosition(Math.max(0, now - voice.startedAt), voice.offset, voice.loop);
  }

  return {
    /** The song playing (or fading in). */
    get playing() { return current?.track; },
    /** Seconds into the song, following its loop; undefined in silence. */
    position() { const bus = audio.buses; return current && bus ? position(current, bus.context.currentTime) : undefined; },
    /**
     * Starts a song from a mark or second, crossfading over `fade` seconds from whatever plays.
     * The same song keeps playing unless `restart`.
     */
    async play(id: TrackId, { from = 'start', fade = .5, restart = false }: { from?: string | number; fade?: number; restart?: boolean } = {}) {
      if (current?.track === id && !restart) return;
      const token = ++generation;
      let buffer: AudioBuffer;
      try { buffer = await audio.load(TRACKS[id].src); } catch (error) { console.warn('No se pudo cargar la música', error); return; }
      if (token !== generation) return;
      const at = audio.buses!.context.currentTime + LEAD;
      const previous = current;
      current = start(id, buffer, markTime(TRACKS[id], from), at, fade);
      if (previous) release(previous, at, Math.max(fade, .03));
    },
    /** Moves the song to a mark, on the next beat, bar or loop end, with a short crossfade. */
    async jump(to: string | number, { at = 'bar', fade = .03 }: { at?: Quantize; fade?: number } = {}) {
      const voice = current, bus = audio.buses;
      if (!voice || !bus) return;
      const track: Track = TRACKS[voice.track];
      const buffer = voice.source.buffer!;
      const ahead = bus.context.currentTime + LEAD;
      const when = ahead + untilBoundary(position(voice, ahead), at, track, voice.loop);
      current = start(voice.track, buffer, markTime(track, to), when, fade);
      release(voice, when, Math.max(fade, .01));
    },
    /** Fades the song out. */
    stop({ fade = 1 }: { fade?: number } = {}) {
      generation++;
      const bus = audio.buses;
      if (!current || !bus) return;
      release(current, bus.context.currentTime + LEAD, fade);
      current = undefined;
    },
    /** Lowers and muffles the music while a menu is open. */
    duck(on: boolean) { audio.duck(on); },
  };
}
