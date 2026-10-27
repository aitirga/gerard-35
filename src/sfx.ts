import type { GameAudio } from './audio';

/**
 * Sound effects (docs/audio.md). A sound is either a file under public/ (`src`) or a small synth
 * recipe drawn with Web Audio nodes. `gap` keeps one from firing again too soon and `voices`
 * caps how many play at once, so a burst never turns into noise; `jitter` detunes each play a
 * little (in cents) so repeats don't sound mechanical.
 */
/** Draws the sound at `at`, its notes multiplied by `pitch`, and returns how long it lasts. */
type Recipe = (context: AudioContext, out: AudioNode, at: number, pitch: number) => number;
interface Sound { src?: string; synth?: Recipe; volume?: number; jitter?: number; gap?: number; voices?: number }

function tone(context: AudioContext, out: AudioNode, at: number, { type = 'sine', from, to = from, attack = .005, length, gain }: { type?: OscillatorType; from: number; to?: number; attack?: number; length: number; gain: number }) {
  const osc = context.createOscillator(), env = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(.0001, at + length);
  osc.connect(env).connect(out);
  osc.start(at); osc.stop(at + length + .02);
  osc.onended = () => env.disconnect();
}
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(context: AudioContext, out: AudioNode, at: number, { cutoff, length, gain }: { cutoff: number; length: number; gain: number }) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(context, buffer);
  }
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), env = context.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass'; filter.frequency.setValueAtTime(cutoff, at); filter.frequency.exponentialRampToValueAtTime(cutoff / 4, at + length);
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(.0001, at + length);
  source.connect(filter).connect(env).connect(out);
  source.start(at); source.stop(at + length + .02);
  source.onended = () => env.disconnect();
}

export const SOUNDS = {
  // Menus: a soft tick to move, a rising pair to confirm, a falling note to go back.
  'ui-move': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'triangle', from: 1320 * p, length: .045, gain: .12 }); return .05; }, jitter: 15, gap: .03, voices: 2 },
  'ui-confirm': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'square', from: 660 * p, length: .06, gain: .06 }); tone(c, out, at + .055, { type: 'square', from: 990 * p, length: .09, gain: .06 }); return .15; }, gap: .06, voices: 2 },
  'ui-back': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'triangle', from: 620 * p, to: 360 * p, length: .11, gain: .14 }); return .12; }, gap: .06, voices: 2 },
  // Fights: a thump with a burst of grit for a blow, a rising sparkle for a cure or a boost.
  hit: { synth: (c, out, at, p) => { tone(c, out, at, { from: 150 * p, to: 48 * p, length: .16, gain: .5 }); noise(c, out, at, { cutoff: 2400, length: .12, gain: .35 }); return .17; }, jitter: 120, gap: .04, voices: 4 },
  heal: { synth: (c, out, at, p) => { [660, 880, 1320].forEach((from, i) => tone(c, out, at + i * .06, { from: from * p, length: .28, gain: .12 })); return .42; }, jitter: 30, gap: .1, voices: 2 },
} satisfies Record<string, Sound>;
export type SoundId = keyof typeof SOUNDS;

export type Sfx = ReturnType<typeof createSfx>;

export function createSfx(audio: GameAudio) {
  const last = new Map<SoundId, number>();
  const playing = new Map<SoundId, number>();
  return {
    /** Plays a sound now; `volume` scales it and `pan` places it from -1 (left) to 1 (right). */
    play(id: SoundId, { volume = 1, pan = 0 }: { volume?: number; pan?: number } = {}) {
      const bus = audio.buses;
      if (!bus || bus.context.state !== 'running') return;
      const sound: Sound = SOUNDS[id];
      const now = bus.context.currentTime;
      if (now - (last.get(id) ?? -Infinity) < (sound.gap ?? 0) || (playing.get(id) ?? 0) >= (sound.voices ?? 4)) return;
      last.set(id, now);
      const gain = bus.context.createGain(), panner = bus.context.createStereoPanner();
      gain.gain.value = volume * (sound.volume ?? 1);
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(bus.sfx);
      const pitch = 2 ** ((sound.jitter ? (Math.random() * 2 - 1) * sound.jitter : 0) / 1200);
      playing.set(id, (playing.get(id) ?? 0) + 1);
      const done = () => { playing.set(id, (playing.get(id) ?? 1) - 1); gain.disconnect(); panner.disconnect(); };
      if (sound.synth) setTimeout(done, (sound.synth(bus.context, gain, now + .005, pitch) + .1) * 1000);
      else if (sound.src) {
        audio.load(sound.src).then(buffer => {
          const source = bus.context.createBufferSource();
          source.buffer = buffer; source.playbackRate.value = pitch;
          source.connect(gain); source.onended = done; source.start();
        }).catch(error => { done(); console.warn('No se pudo cargar el sonido', error); });
      }
    },
  };
}

/**
 * Menu sounds for every menu at once: moving between buttons ticks, pressing one confirms, a
 * back button (or Escape out of a menu) goes back. It listens to focus and clicks, which keyboard,
 * pad and mouse all go through, so the menus need no sound code of their own.
 */
export function watchMenuSounds(sfx: Sfx, menuOpen: () => boolean) {
  const back = '[data-back], .journal-close, .target-back, [data-map-back]';
  // The street's own buttons (talk, walk, centre the view) make no menu sound.
  const quiet = '#interact, #overview, [data-direction], #environment';
  let pointer = 0, clicked = 0;
  const onPointer = () => { pointer = performance.now(); };
  const onFocus = (event: FocusEvent) => {
    const now = performance.now();
    // Only moving from one button to the next: not a menu opening, a mouse click or a page change.
    if (now - pointer < 400 || now - clicked < 120) return;
    if (event.target instanceof HTMLButtonElement && event.relatedTarget instanceof HTMLButtonElement && !event.target.matches(quiet)) sfx.play('ui-move');
  };
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled || button.matches(quiet)) return;
    clicked = performance.now();
    sfx.play(button.matches(back) ? 'ui-back' : 'ui-confirm');
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.repeat && menuOpen()) sfx.play('ui-back'); };
  window.addEventListener('pointerdown', onPointer, { capture: true });
  window.addEventListener('focusin', onFocus, { capture: true });
  window.addEventListener('click', onClick, { capture: true });
  window.addEventListener('keydown', onKey, { capture: true });
  return () => {
    window.removeEventListener('pointerdown', onPointer, { capture: true });
    window.removeEventListener('focusin', onFocus, { capture: true });
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('keydown', onKey, { capture: true });
  };
}
