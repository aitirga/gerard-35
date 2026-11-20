/**
 * The song's clock (docs/quests/marta.md): a phrase sung in a loop, note after note, with or without
 * a silence after each. Marta's mission runs on one, her own recording (`VOZ_SONG`), twice: in Las
 * cuerdas, where each piece of a maze answers to one of her notes as she is heard far off
 * (src/cuerdas.ts), and in the last fight, where every note La Voz sings is a move of hers and she
 * can only be hurt in her silences (src/battle.ts). Pure: what sounds at a moment, what started
 * between two, and how long until the next silence.
 */
export const TONES = {
  // Low to high: the six Marta sings (src/cuerdas.ts, La Voz), and Mi, which no piece or fight uses now.
  // No pink and no violet: those are the Queen's and fear's (docs/visual-style.md). La and Fa share a
  // maze, so they are far apart: amber and the strings' silver.
  la: { name: 'La', hz: 220, colour: '#f2b45a' },
  do: { name: 'Do', hz: 261.63, colour: '#49d3c2' },
  re: { name: 'Re', hz: 293.66, colour: '#9ad65a' },
  mi: { name: 'Mi', hz: 329.63, colour: '#b9c6d8' },
  fa: { name: 'Fa', hz: 349.23, colour: '#eef3ff' },
  sol: { name: 'Sol', hz: 392, colour: '#5b8cff' },
  sib: { name: 'Si♭', hz: 466.16, colour: '#ef6a3c' },
} as const;
export type ToneId = keyof typeof TONES;
export const TONE_IDS = Object.keys(TONES) as ToneId[];

/**
 * One note of a phrase: `sing` seconds of it, then `rest` seconds of silence. `round`: the phrase
 * comes round on it, as on its first note (a long recording sings its phrase many times over).
 */
export interface Beat { tone: ToneId; sing: number; rest: number; round?: boolean }
export interface Phrase { name: string; beats: readonly Beat[] }


/**
 * Marta's recording of La Voz's song (public/music/marta-voz.m4a), which loops for the whole fight:
 * `length` seconds, its first note `offset` seconds in. The fight's clock is the song's, so a moment
 * `t` of it is `(offset + t) % length` of the file.
 */
export const VOZ_RECORDING = { src: 'music/marta-voz.m4a', length: 87.236, offset: 1.033 } as const;
/** Where in the file a moment of La Voz's song is. */
export const recordingAt = (t: number) => ((VOZ_RECORDING.offset + t) % VOZ_RECORDING.length + VOZ_RECORDING.length) % VOZ_RECORDING.length;
/**
 * The notes of her recording, found by their pitch (`[tone, seconds sung, seconds of silence after,
 * 1 where the phrase starts over]`): one eight-note phrase, Do Sol Fa Re · Do Si♭ La Fa, sung eight
 * times, slow, bound, short, fast. Always eight notes a turn (the user, 2026-11-19: «el ciclo del boss
 * debería ser también de 8»): a passing note sung on the way is part of the note it leads from. A
 * change of note with less than 0.15 s between them is bound: the first sounds until the next.
 */
const SUNG: readonly (readonly [ToneId, number, number, 1?])[] = [
  ['do', 1.5, 0.24], ['sol', 1.34, 0.38], ['fa', 1.32, 0.37], ['re', 1.49, 0.87], ['do', 0.98, 0.49], ['sib', 1.17, 0.44], ['la', 1.52, 0.0], ['fa', 1.68, 0.53],
  ['do', 1.4, 0.0, 1], ['sol', 1.39, 0.0], ['fa', 1.64, 0.0], ['re', 1.1, 0.48], ['do', 1.07, 0.49], ['sib', 1.47, 0.0], ['la', 1.4, 0.0], ['fa', 1.16, 0.55],
  ['do', 1.49, 0.3, 1], ['sol', 1.29, 0.0], ['fa', 1.43, 0.0], ['re', 1.06, 0.55], ['do', 1.27, 0.17], ['sib', 1.36, 0.0], ['la', 1.45, 0.0], ['fa', 0.98, 1.08],
  ['do', 0.89, 0.73, 1], ['sol', 0.67, 0.73], ['fa', 1.29, 0.22], ['re', 0.93, 0.59], ['do', 1.22, 0.29], ['sib', 0.88, 0.51], ['la', 1.49, 0.0], ['fa', 0.96, 0.55],
  ['do', 0.65, 0.0, 1], ['sol', 2.15, 0.0], ['fa', 1.36, 0.0], ['re', 0.77, 0.56], ['do', 0.55, 0.2], ['sib', 2.3, 0.0], ['la', 1.34, 0.0], ['fa', 0.58, 0.52],
  ['do', 0.94, 0.0, 1], ['sol', 0.78, 0.0], ['fa', 0.85, 0.0], ['re', 0.6, 0.73], ['do', 0.94, 0.0], ['sib', 0.79, 0.0], ['la', 0.57, 0.35], ['fa', 0.73, 0.0],
  ['do', 0.33, 0.16, 1], ['sol', 1.27, 0.0], ['fa', 0.88, 0.0], ['re', 0.39, 0.55], ['do', 0.52, 0.0], ['sib', 1.43, 0.0], ['la', 0.87, 0.0], ['fa', 0.5, 0.62],
  ['do', 0.68, 0.62, 1], ['sol', 0.63, 0.65], ['fa', 0.73, 0.49], ['re', 0.82, 0.44], ['do', 0.67, 0.59], ['sib', 0.66, 0.52], ['la', 0.95, 0.23], ['fa', 0.91, 1.03],
];
/** La Voz's song: her recording, note by note; the last note's silence runs to the file's end and on to its first note. */
export const VOZ_SONG: Phrase = (() => {
  const beats: Beat[] = SUNG.map(([tone, sing, rest, round]) => ({ tone, sing, rest, ...round ? { round: true } : {} }));
  const last = beats[beats.length - 1];
  last.rest = 0;
  last.rest = VOZ_RECORDING.length - beats.reduce((sum, b) => sum + b.sing + b.rest, 0);
  return { name: 'La Voz', beats };
})();

/** Seconds one turn of the phrase lasts. */
export const phraseLength = (phrase: Phrase) => phrase.beats.reduce((sum, b) => sum + b.sing + b.rest, 0);

export interface Moment {
  /** Which note of the phrase this is, and how many times the phrase has come round before it. */
  index: number; loop: number; tone: ToneId;
  /** Whether the note sounds now (false in the silence after it). */
  sounding: boolean;
  /** Seconds since the note started, and seconds left of what is on now (the note, or its silence). */
  into: number; left: number;
  /** How far through what is on now, 0 to 1. */
  k: number;
}
/** What is on `t` seconds into the song. */
export function songAt(phrase: Phrase, t: number): Moment {
  const length = phraseLength(phrase), time = Math.max(0, t);
  const loop = Math.floor(time / length);
  let at = time - loop * length;
  for (let index = 0; index < phrase.beats.length; index++) {
    const beat = phrase.beats[index], whole = beat.sing + beat.rest;
    // The last one takes whatever a rounding left over.
    if (at < whole || index === phrase.beats.length - 1) {
      const sounding = at < beat.sing;
      const left = sounding ? beat.sing - at : Math.max(0, whole - at), span = sounding ? beat.sing : beat.rest;
      return { index, loop, tone: beat.tone, sounding, into: at, left, k: span > 0 ? Math.min(1, 1 - left / span) : 1 };
    }
    at -= whole;
  }
  throw new Error('A phrase needs a note');
}
/** The notes that start after `from` and up to `to` (seconds into the song), in order; `round` when the phrase comes round with it. */
export function onsets(phrase: Phrase, from: number, to: number): { index: number; loop: number; tone: ToneId; round: boolean }[] {
  const out: { index: number; loop: number; tone: ToneId; round: boolean }[] = [];
  if (!(to > from)) return out;
  const length = phraseLength(phrase);
  for (let loop = Math.max(0, Math.floor(from / length)); loop * length <= to; loop++) {
    let start = loop * length;
    phrase.beats.forEach((beat, index) => {
      if (start > from && start <= to) out.push({ index, loop, tone: beat.tone, round: index === 0 ? loop > 0 : !!beat.round });
      start += beat.sing + beat.rest;
    });
  }
  return out;
}
/** Seconds from `t` until a note sounds with at least `room` seconds of it left (0 if one does now). */
export function untilNote(phrase: Phrase, t: number, room = 0): number {
  const now = songAt(phrase, t);
  if (now.sounding && now.left >= room) return 0;
  let wait = now.sounding ? now.left + phrase.beats[now.index].rest : now.left;
  for (let step = 1; step <= phrase.beats.length; step++) {
    const beat = phrase.beats[(now.index + step) % phrase.beats.length];
    if (beat.sing >= room) return wait;
    wait += beat.sing + beat.rest;
  }
  return wait;
}
/** Where each turn of the phrase starts, in seconds into one go of it (a phrase with no `round` beats is one turn). */
export function turnStarts(phrase: Phrase): number[] {
  const starts: number[] = [];
  let clock = 0;
  phrase.beats.forEach((beat, index) => { if (index === 0 || beat.round) starts.push(clock); clock += beat.sing + beat.rest; });
  return starts;
}
/** Seconds from `t` until a silence with at least `room` seconds of it left (0 if in one now). */
export function untilSilence(phrase: Phrase, t: number, room = 0): number {
  const now = songAt(phrase, t);
  if (!now.sounding && now.left >= room) return 0;
  let wait = now.sounding ? now.left : now.left + phrase.beats[(now.index + 1) % phrase.beats.length].sing;
  for (let step = now.sounding ? 0 : 1; step <= phrase.beats.length; step++) {
    const index = (now.index + step) % phrase.beats.length, beat = phrase.beats[index];
    if (beat.rest >= room && beat.rest > 0) return wait;
    wait += beat.rest + phrase.beats[(index + 1) % phrase.beats.length].sing;
  }
  return wait;
}
/** The share of a phrase in which a note sounds. */
export const duty = (phrase: Phrase) => phrase.beats.reduce((sum, b) => sum + b.sing, 0) / phraseLength(phrase);

/**
 * The turn of the phrase `t` is in, for drawing it: where it starts and how long it is (seconds into
 * the song), and its notes from its start. A phrase with no `round` beats is one turn.
 */
export function turnAt(phrase: Phrase, t: number): { start: number; length: number; beats: { at: number; sing: number; tone: ToneId }[] } {
  const total = phraseLength(phrase), loop = Math.floor(Math.max(0, t) / total), at = Math.max(0, t) - loop * total;
  const turns: { start: number; length: number; beats: { at: number; sing: number; tone: ToneId }[] }[] = [];
  let clock = 0;
  phrase.beats.forEach((beat, index) => {
    if (index === 0 || beat.round) turns.push({ start: clock, length: 0, beats: [] });
    const turn = turns[turns.length - 1];
    turn.beats.push({ at: clock - turn.start, sing: beat.sing, tone: beat.tone });
    clock += beat.sing + beat.rest;
    turn.length = clock - turn.start;
  });
  const turn = [...turns].reverse().find(x => x.start <= at + 1e-9) ?? turns[0];
  return { ...turn, start: turn.start + loop * total };
}
