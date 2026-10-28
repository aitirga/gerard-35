import type { GameAudio } from './audio';
import { createHaunt, type Haunt } from './haunt.ts';

/**
 * Songs and how they play (docs/audio.md). A track is a file under public/ with named marks in
 * seconds; `loop` names the two marks it loops between once it reaches them, so whatever comes
 * before the first is an intro and whatever follows the second is an ending that only plays
 * when the director jumps there. `bpm`, `beatsPerBar` and `downbeat` (a mark on the first beat
 * of a bar) let jumps wait for the next beat or bar. A `haunted` song plays through the castle's
 * haunt (src/haunt.ts) at whatever level `music.haunt` last set. `loudness` is a long take's
 * loudness map (`just music-export` writes it), so it comes in anywhere at an even level. `cycle`
 * makes the file versions of one cycle of that many seconds, back to back: they play one into
 * another in random order, with no end.
 */
export interface Track { src: string; marks: Record<string, number>; loop?: readonly [string, string]; bpm?: number; beatsPerBar?: number; downbeat?: string; stream?: boolean; loudness?: string; haunted?: boolean; cycle?: number }
export const TRACKS = {
  // Measured with `just music-loop`: the quick notes end on a piano G that rings until the C strikes
  // at 2.398 s; the loop starts right there, so it comes round on the C alone, and runs everything
  // after it, the slow notes at the end included: 220 beats (55 bars) to 134.398 s, 22 ms before the
  // file ends. On a win it jumps to its last hit (131.998 s) and plays out.
  battle: { src: 'music/battle.m4a', marks: { start: 0, loop: 2.398, ending: 131.998, end: 134.398 }, loop: ['loop', 'end'], bpm: 100, beatsPerBar: 4, downbeat: 'loop' },
  // An 18-minute take for the Meridiana flat, streamed: it comes in anywhere and never ends.
  home: { src: 'music/song-home.m4a', marks: { start: 0 }, stream: true, loudness: 'music/song-home.loudness.json' },
  // La Reina Bubbaloo's castle, 13 minutes, the same way; it warps more the stronger the castle is.
  bubbaloo: { src: 'music/bubbaloo-light.m4a', marks: { start: 0 }, stream: true, loudness: 'music/bubbaloo-light.loudness.json', haunted: true },
  // The concrete streets: the whole song loops, 184 beats (46 bars) at 110 BPM from its first
  // downbeat at 0 s, break at 40 s included.
  concrete: { src: 'music/song-concrete.m4a', marks: { start: 0, end: 100.364 }, loop: ['start', 'end'], bpm: 110, beatsPerBar: 4, downbeat: 'start' },
  // Passatge Maresme, where the game starts: the whole song loops, 80 beats (20 bars) at 50 BPM.
  sad: { src: 'music/song-sad.m4a', marks: { start: 0, end: 96 }, loop: ['start', 'end'], bpm: 50, beatsPerBar: 4, downbeat: 'start' },
  // A friend's mission: six versions of one 48 s cycle (88 beats at 110 BPM, Logic's bars 1 to 23),
  // each starting on its downbeat, so any can follow any.
  'mazmorra-2': { src: 'music/song-mazmorra-2.m4a', marks: { start: 0 }, cycle: 48, bpm: 110, beatsPerBar: 4, downbeat: 'start' },
} satisfies Record<string, Track>;
export type TrackId = keyof typeof TRACKS;
export const isTrack = (id: string): id is TrackId => Object.hasOwn(TRACKS, id);

/**
 * A random second to come into a long take from, leaving room before its end for the fade in and
 * the crossfade out.
 */
export function randomStart(duration: number, margin: number, random = Math.random) {
  return Math.max(0, duration - margin) * random();
}

/** A long take's loudness: dB for each second of it, over the five seconds round it. */
export interface Loudness { db: number[] }
/** The loudness at a second of the take, between its measured seconds. */
export function loudnessAt({ db }: Loudness, time: number) {
  const at = Math.max(0, Math.min(db.length - 1, time)), i = Math.floor(at);
  return i + 1 < db.length ? db[i] + (db[i + 1] - db[i]) * (at - i) : db[i];
}
export function medianLoudness({ db }: Loudness) {
  const sorted = [...db].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/**
 * A random second to come in from that sounds about as loud as `target` dB: the closest of a few
 * random ones, so the take still comes in anywhere, just not from a hush into a swell.
 */
export function evenStart(duration: number, margin: number, loudness: Loudness, target: number, random = Math.random, tries = 6) {
  let best = 0, gap = Infinity;
  for (let i = 0; i < tries; i++) {
    const time = randomStart(duration, margin, random), off = Math.abs(loudnessAt(loudness, time) - target);
    if (off < gap) { best = time; gap = off; }
  }
  return best;
}
/** The gain that brings a point of `to` dB to `from` dB, never more than `limit` dB either way. */
export function matchGain(from: number, to: number, limit = 6) {
  return 10 ** (Math.max(-limit, Math.min(limit, from - to)) / 20);
}
/** How many versions of its cycle a file holds. */
export function cycleCount(duration: number, cycle: number) {
  return Math.max(1, Math.round(duration / cycle));
}
/**
 * The version to play after `previous`: never the same twice in a row, and never the first, which
 * only opens the song. It starts from silence, while the others carry the tail of the one before
 * them in the file, so going back to it drops the sound.
 */
export function nextVersion(count: number, previous: number, random = Math.random) {
  if (count < 3) return count - 1;
  const pick = 1 + Math.floor(random() * (count - (previous === 0 ? 1 : 2)));
  return previous > 0 && pick >= previous ? pick + 1 : pick;
}

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

/** A cycled voice holds the timer that queues the next version, and the one it took over from while that still plays out. */
interface Voice { track: TrackId; source?: AudioBufferSourceNode; element?: HTMLAudioElement; gain: GainNode; startedAt: number; offset: number; loop?: [number, number]; timer?: ReturnType<typeof setTimeout>; handoff?: Voice }
/** Lead time for anything scheduled, so the first samples are never late. */
const LEAD = .03;
/** A streamed take crossfades into another random point this many seconds before its file ends. */
const TAKE_FADE = 6;
/** A take that came in matched to another's loudness eases back to its own level over this long. */
const SETTLE = 20;
/** A cycled track queues its next version this many seconds before the seam, and crossfades over `SEAM` there. */
const QUEUE = 2, SEAM = .02;

export type Music = ReturnType<typeof createMusic>;

/** The director: one song at a time, crossfading between songs and jumping between marks. */
export function createMusic(audio: GameAudio) {
  let current: Voice | undefined;
  let generation = 0;
  let haunt: Haunt | undefined, dread = 0;
  const loudness = new Map<TrackId, Promise<Loudness | undefined>>();

  /** Where a song's voices go: through the haunt if it is haunted, straight to the music bus if not. */
  function output(id: TrackId) {
    const { context, music } = audio.buses!;
    return (TRACKS[id] as Track).haunted ? (haunt ??= createHaunt(context, music)).input : music;
  }
  /** The haunt follows the song: on for a haunted one, off for any other or silence. */
  function follow(id: TrackId | undefined, fade: number) {
    const level = id && (TRACKS[id] as Track).haunted ? dread : 0;
    if (level > 0 || haunt) (haunt ??= createHaunt(audio.buses!.context, audio.buses!.music)).set(level, fade);
  }

  function ramp(param: AudioParam, to: number, at: number, duration: number) {
    // A fade still running would overlap the new curve, so hold where it is now and start over.
    const from = param.value, now = audio.buses!.context.currentTime;
    param.cancelScheduledValues(0);
    param.setValueAtTime(from, Math.min(now, at));
    if (duration <= 0) param.setValueAtTime(to, at);
    else param.setValueCurveAtTime(fadeCurve(from, to), at, duration);
  }
  function start(id: TrackId, buffer: AudioBuffer, offset: number, at: number, fade: number, loops = true) {
    const { context } = audio.buses!;
    const track: Track = TRACKS[id];
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    const range = loopRange(track);
    // Starting in the ending, or asked to play out, means not going back into the loop.
    const loop = loops && range && offset < range[1] ? range : undefined;
    if (loop) { source.loop = true; source.loopStart = loop[0]; source.loopEnd = loop[1]; }
    gain.gain.value = fade > 0 ? 0 : 1;
    source.connect(gain).connect(output(id));
    const voice: Voice = { track: id, source, gain, startedAt: at, offset, loop };
    source.onended = () => { gain.disconnect(); if (current === voice) current = undefined; else if (current?.handoff === voice) current.handoff = undefined; };
    source.start(at, offset);
    if (fade > 0) ramp(gain.gain, 1, at, fade);
    if (track.cycle) queue(voice, track.cycle, at);
    return voice;
  }
  /** A take's loudness map, fetched once; without one it simply comes in anywhere. */
  function loudnessOf(id: TrackId) {
    const src = (TRACKS[id] as Track).loudness;
    if (!src) return Promise.resolve(undefined);
    let map = loudness.get(id);
    if (!map) {
      map = fetch(`${import.meta.env.BASE_URL}${src}`).then(response => response.ok ? response.json() as Promise<Loudness> : undefined).catch(() => undefined);
      loudness.set(id, map);
    }
    return map;
  }
  /** How loud a voice of a take sounds now, its gain included. */
  function loudnessNow(voice: Voice, map: Loudness) {
    return loudnessAt(map, position(voice, audio.buses!.context.currentTime)) + 20 * Math.log10(Math.max(1e-4, voice.gain.gain.value));
  }
  /**
   * Where to come into a take, and at what gain: near `target` dB (whatever plays now, or the
   * take's middle loudness from silence), lifted or lowered to match, easing back over SETTLE.
   */
  function comeIn(duration: number, map: Loudness | undefined, target?: number) {
    if (!map?.db.length) return { offset: randomStart(duration, TAKE_FADE * 4), level: 1 };
    const level = target ?? medianLoudness(map), offset = evenStart(duration, TAKE_FADE * 4, map, level);
    return { offset, level: matchGain(level, loudnessAt(map, offset)) };
  }
  /** A long take played from the file as it downloads, never decoded whole (that would take hundreds of MB). */
  async function open(id: TrackId) {
    const element = new Audio(`${import.meta.env.BASE_URL}${TRACKS[id].src}`);
    element.preload = 'auto';
    if (!(element.duration > 0)) await new Promise((resolve, reject) => { element.onloadedmetadata = resolve; element.onerror = () => reject(element.error); });
    return element;
  }
  function stream(id: TrackId, element: HTMLAudioElement, offset: number, at: number, fade: number, level = 1) {
    const { context } = audio.buses!;
    const gain = context.createGain();
    gain.gain.value = fade > 0 ? 0 : 1;
    context.createMediaElementSource(element).connect(gain).connect(output(id));
    element.currentTime = offset;
    const voice: Voice = { track: id, element, gain, startedAt: at, offset };
    // Near the end of the file, come back in somewhere else, so the take plays on for as long as you stay.
    element.ontimeupdate = () => {
      if (current !== voice || element.duration - element.currentTime > TAKE_FADE) return;
      element.ontimeupdate = null;
      void Promise.all([open(id), loudnessOf(id)]).then(([next, map]) => {
        if (current !== voice) return;
        const now = context.currentTime + LEAD;
        const { offset, level } = comeIn(next.duration, map, map && loudnessNow(voice, map));
        current = stream(id, next, offset, now, TAKE_FADE, level);
        release(voice, now, TAKE_FADE);
      }).catch(error => console.warn('No se pudo cargar la música', error));
    };
    void element.play().catch(error => console.warn('No se pudo reproducir la música', error));
    ramp(gain.gain, level, at, fade);
    if (level !== 1) gain.gain.setValueCurveAtTime(fadeCurve(level, 1), at + Math.max(0, fade) + .01, SETTLE);
    return voice;
  }
  /** At the end of its version, the voice hands over to another one, sample-exact on the downbeat. */
  function queue(voice: Voice, cycle: number, at: number) {
    const version = Math.floor(voice.offset / cycle + 1e-6);
    const seam = at + (version + 1) * cycle - voice.offset;
    const buffer = voice.source!.buffer!;
    voice.timer = setTimeout(() => {
      if (current !== voice) return;
      voice.handoff = undefined;
      current = start(voice.track, buffer, nextVersion(cycleCount(buffer.duration, cycle), version) * cycle, seam, SEAM);
      current.handoff = voice;
      release(voice, seam, SEAM);
    }, Math.max(0, seam - QUEUE - audio.buses!.context.currentTime) * 1000);
  }
  function release(voice: Voice, at: number, fade: number) {
    clearTimeout(voice.timer);
    ramp(voice.gain.gain, 0, at, fade);
    voice.source?.stop(at + fade + .05);
    const element = voice.element;
    if (element) {
      element.ontimeupdate = null;
      setTimeout(() => { element.pause(); element.removeAttribute('src'); element.load(); voice.gain.disconnect(); }, (at - audio.buses!.context.currentTime + fade) * 1000 + 100);
    }
    // A version still playing out before its seam fades with the one that took over.
    const handoff = voice.handoff;
    voice.handoff = undefined;
    if (handoff) release(handoff, at, fade);
  }
  function position(voice: Voice, now: number): number {
    if (voice.handoff && now < voice.startedAt) return position(voice.handoff, now);
    if (voice.element) return voice.element.currentTime;
    return loopPosition(Math.max(0, now - voice.startedAt), voice.offset, voice.loop);
  }

  return {
    /** The song playing (or fading in). */
    get playing() { return current?.track; },
    /** Seconds into the song, following its loop; undefined in silence. */
    position() { const bus = audio.buses; return current && bus ? position(current, bus.context.currentTime) : undefined; },
    /**
     * Starts a song from a mark, a second or a `random` point, crossfading over `fade` seconds from
     * whatever plays. The same song keeps playing unless `restart`.
     */
    async play(id: TrackId, { from = 'start', fade = .5, restart = false }: { from?: string | number; fade?: number; restart?: boolean } = {}) {
      if (current?.track === id && !restart) return;
      const token = ++generation;
      const track: Track = TRACKS[id];
      let source: AudioBuffer | HTMLAudioElement, map: Loudness | undefined;
      try { [source, map] = track.stream ? await Promise.all([open(id), loudnessOf(id)]) : [await audio.load(track.src), undefined]; } catch (error) { console.warn('No se pudo cargar la música', error); return; }
      if (token !== generation) return;
      const at = audio.buses!.context.currentTime + LEAD;
      const previous = current;
      // A take restarted over itself matches what plays; from silence or another song, its middle.
      // A cycled song always opens with its first version.
      const { offset, level } = from === 'random' && track.cycle ? { offset: 0, level: 1 }
        : from === 'random' ? comeIn(source.duration, map, map && previous?.track === id ? loudnessNow(previous, map) : undefined) : { offset: markTime(track, from), level: 1 };
      current = source instanceof AudioBuffer ? start(id, source, offset, at, fade) : stream(id, source, offset, at, fade, level);
      if (previous) release(previous, at, Math.max(fade, .03));
      follow(id, Math.max(fade, 1));
    },
    /** Moves the song to a mark, on the next beat, bar or loop end, with a short crossfade (not in a streamed take). */
    async jump(to: string | number, { at = 'bar', fade = .03, loop = true }: { at?: Quantize; fade?: number; loop?: boolean } = {}) {
      const voice = current, bus = audio.buses;
      if (!voice?.source || !bus) return;
      const track: Track = TRACKS[voice.track];
      const buffer = voice.source.buffer!;
      const ahead = bus.context.currentTime + LEAD;
      const when = ahead + untilBoundary(position(voice, ahead), at, track, voice.loop);
      current = start(voice.track, buffer, markTime(track, to), when, fade, loop);
      release(voice, when, Math.max(fade, .01));
    },
    /** Fades the song out. */
    stop({ fade = 1 }: { fade?: number } = {}) {
      generation++;
      const bus = audio.buses;
      if (!current || !bus) return;
      release(current, bus.context.currentTime + LEAD, fade);
      current = undefined;
      follow(undefined, fade);
    },
    /**
     * How haunted the castle's song is, 0 to 1 (src/haunt.ts): it applies while a haunted song
     * plays, and waits for one otherwise.
     */
    haunt(level: number, { fade = 3 }: { fade?: number } = {}) {
      if (level === dread) return;
      dread = level;
      if (audio.buses && current) follow(current.track, fade);
    },
    /** The haunt, once a haunted song has played (development checks). */
    get haunted() { return haunt; },
    /** Lowers and muffles the music while a menu is open. */
    duck(on: boolean) { audio.duck(on); },
  };
}
