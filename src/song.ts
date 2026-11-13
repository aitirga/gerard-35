/**
 * The song's clock (docs/quests/marta.md): a short phrase sung in a loop, note after note, with or
 * without a silence after each. Marta's mission runs on it twice: in Las cuerdas, where each piece of
 * a maze answers to one note (src/cuerdas.ts), and in the last fight, where La Voz can only be hurt
 * while a note sounds (src/battle.ts). Pure: what sounds at a moment, and what started between two.
 */
export const TONES = {
  // The four the voice sings, low to high. No pink and no violet: those are the Queen's and fear's (docs/visual-style.md).
  la: { name: 'La', hz: 220, colour: '#f2b45a' },
  do: { name: 'Do', hz: 261.63, colour: '#49d3c2' },
  mi: { name: 'Mi', hz: 329.63, colour: '#eef3ff' },
  sol: { name: 'Sol', hz: 392, colour: '#5b8cff' },
} as const;
export type ToneId = keyof typeof TONES;
export const TONE_IDS = Object.keys(TONES) as ToneId[];

/** One note of a phrase: `sing` seconds of it, then `rest` seconds of silence. */
export interface Beat { tone: ToneId; sing: number; rest: number }
export interface Phrase { name: string; beats: readonly Beat[] }

const run = (tones: readonly ToneId[], sing: number, rest: number): Beat[] => tones.map(tone => ({ tone, sing, rest }));
/**
 * The mazes' phrases have no silences: one note is always sounding, so some of the floor is always
 * there. The fight's have them, and get shorter as La Voz is hurt: *Andante*, *Allegro* and *A
 * capela*, whose one long note is the phrase's last.
 */
export const PHRASES = {
  'dos-notas': { name: 'Dos notas', beats: run(['la', 'mi'], 2.6, 0) },
  'una-pasada': { name: 'Una pasada', beats: run(['la', 'do', 'mi'], 2.4, 0) },
  clavijas: { name: 'Las clavijas', beats: run(['la', 'do', 'mi'], 2.2, 0) },
  andante: { name: 'Andante', beats: run(['la', 'do', 'mi', 'do'], 3.2, 2.2) },
  allegro: { name: 'Allegro', beats: run(['la', 'do', 'mi', 'sol', 'mi', 'do'], 1.9, 1.7) },
  'a-capela': { name: 'A capela', beats: [...run(['mi', 'sol', 'mi', 'do'], 1.2, 1.5), { tone: 'la', sing: 3.6, rest: 2 }] },
} as const satisfies Record<string, Phrase>;
export type PhraseId = keyof typeof PHRASES;

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
      if (start > from && start <= to) out.push({ index, loop, tone: beat.tone, round: index === 0 && loop > 0 });
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
/** The share of a phrase in which a note sounds. */
export const duty = (phrase: Phrase) => phrase.beats.reduce((sum, b) => sum + b.sing, 0) / phraseLength(phrase);
