import type { GameAudio } from './audio';
import { VOZ_RECORDING, recordingAt } from './song';

/**
 * Marta's recording (docs/quests/marta.md § Las cuerdas, § Final boss), always held to a clock: in
 * Las cuerdas the mazes' (src/game.ts, `onCuerdasSong`), whose pieces answer to her notes, and in her
 * fight La Voz's (src/battle-ui.ts, `callbacks.song`). It stops when the clock stops, slows when it
 * slows, and if it ever drifts it jumps to where the clock is, so what is heard is what holds: a
 * piece up while its note sounds, a window on La Voz open while she sings.
 *
 * Far off in Las cuerdas (`near` 0 to 1) it is quiet, muffled and lost in a big room, nearer with each
 * quality beaten; in her fight it is whole and dry.
 */
/** Seconds the sound may stray from its clock before it is put back. */
const DRIFT = .08;
/** A short fade on every jump, so it never clicks. */
const EDGE = .03;
interface Mix { gain: number; cutoff: number; wet: number }
/** Far off and near in Las cuerdas, and in her fight. Even near, Las cuerdas is quieter than the fight. */
const FAR: Mix = { gain: .1, cutoff: 650, wet: .85 }, NEAR: Mix = { gain: .5, cutoff: 5200, wet: .35 }, WHOLE: Mix = { gain: 1, cutoff: 20000, wet: 0 };
/** Seconds a change of distance takes, and how long the song takes to come in when it starts or comes back. */
const GLIDE = 3, COME_IN = 1.5;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const mixAt = (near: number | undefined): Mix => near === undefined ? WHOLE
  : { gain: lerp(FAR.gain, NEAR.gain, near), cutoff: lerp(FAR.cutoff, NEAR.cutoff, near), wet: lerp(FAR.wet, NEAR.wet, near) };

/** A big dark room's echo: three seconds of noise dying away, a little duller as it goes. */
function room(context: BaseAudioContext) {
  const seconds = 3, length = Math.floor(context.sampleRate * seconds), impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const k = i / length, dull = .35 + .6 * k;
      last = last * dull + (Math.random() * 2 - 1) * (1 - dull);
      data[i] = last * Math.pow(1 - k, 2.6) * 3;
    }
  }
  return impulse;
}

export type VozSong = ReturnType<typeof createVozSong>;

export function createVozSong(audio: GameAudio) {
  let buffer: AudioBuffer | undefined, loading = false;
  /** The chain her voice goes through, made once: a muffle, a dry and a wet way, one level for both. */
  let chain: { input: BiquadFilterNode; level: GainNode; dry: GainNode; wet: GainNode } | undefined;
  /** What plays now: its source and fade, where in the file it started and when, and how fast. */
  let voice: { source: AudioBufferSourceNode; fade: GainNode; at: number; from: number; rate: number } | undefined;
  /** How near it is (undefined: her fight; null: never set), so a change glides and the fight's comes in at once. */
  let near: number | undefined | null = null;

  function load() {
    if (buffer || loading || !audio.buses) return;
    loading = true;
    audio.load(VOZ_RECORDING.src).then(b => { buffer = b; }, error => { loading = false; console.warn('No se pudo cargar la voz de Marta', error); });
  }
  function build() {
    const { context, music } = audio.buses!;
    const input = context.createBiquadFilter(), level = context.createGain(), dry = context.createGain(), wet = context.createGain(), reverb = context.createConvolver();
    input.type = 'lowpass'; input.Q.value = .5;
    reverb.buffer = room(context);
    input.connect(dry).connect(level);
    input.connect(reverb).connect(wet).connect(level);
    level.connect(music);
    return { input, level, dry, wet };
  }
  /** Moves the mix to how near it is, over `over` seconds. */
  function mix(to: number | undefined, over: number) {
    const { context } = audio.buses!, now = context.currentTime, m = mixAt(to);
    chain ??= build();
    const glide = (param: AudioParam, value: number) => {
      param.cancelScheduledValues(0); param.setValueAtTime(param.value, now);
      if (over > 0) param.linearRampToValueAtTime(value, now + over); else param.setValueAtTime(value, now);
    };
    glide(chain.level.gain, m.gain); glide(chain.input.frequency, m.cutoff); glide(chain.wet.gain, m.wet); glide(chain.dry.gain, 1 - m.wet);
    near = to;
  }
  function release(fade: number) {
    if (!voice) return;
    const { source, fade: gain } = voice, now = audio.buses!.context.currentTime, over = Math.max(EDGE, fade);
    gain.gain.cancelScheduledValues(0);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + over);
    source.stop(now + over + .02);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    voice = undefined;
  }
  function start(position: number, rate: number, comeIn: number) {
    const { context } = audio.buses!, now = context.currentTime;
    release(EDGE);
    const source = context.createBufferSource(), fade = context.createGain();
    source.buffer = buffer!; source.loop = true;
    source.loopStart = 0; source.loopEnd = Math.min(buffer!.duration, VOZ_RECORDING.length);
    source.playbackRate.value = rate;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + comeIn);
    source.connect(fade).connect(chain!.input);
    source.start(now, position);
    voice = { source, fade, at: now, from: position, rate };
  }
  /** Where the sound is now in the file. */
  function heard() {
    if (!voice) return 0;
    const length = VOZ_RECORDING.length;
    return ((voice.from + (audio.buses!.context.currentTime - voice.at) * voice.rate) % length + length) % length;
  }
  /** Every frame: plays `t` seconds into her song at `rate` (0: stopped), as near as `to` says. */
  function follow(t: number, rate: number, to: number | undefined) {
    if (!audio.buses) return;
    if (!buffer) { load(); return; }
    // Into her fight it is whole at once; in Las cuerdas a change of distance glides.
    if (to !== near) mix(to, to === undefined || near === null ? 0 : GLIDE);
    if (rate <= 0) { release(EDGE * 4); return; }
    const wanted = recordingAt(t);
    if (!voice) { start(wanted, rate, to === undefined ? EDGE : COME_IN); return; }
    const length = VOZ_RECORDING.length, off = Math.abs(heard() - wanted), drift = Math.min(off, length - off);
    if (drift > DRIFT) { start(wanted, rate, EDGE); return; }
    if (Math.abs(voice.rate - rate) > .005) {
      // Slowed or sped up with the fight (a dual's banner): from here on at the new rate.
      const now = audio.buses.context.currentTime;
      voice.from = heard(); voice.at = now; voice.rate = rate;
      voice.source.playbackRate.setValueAtTime(rate, now);
    }
  }

  return {
    /** What is playing, for the screenshot checks: how near (undefined in her fight), how loud and how muffled, and where in the file. */
    get state() { return { near: voice && typeof near === 'number' ? near : undefined, gain: chain?.level.gain.value, cutoff: chain?.input.frequency.value, at: voice ? heard() : undefined }; },
    /** Her fight, every frame: `t` seconds into her song on the fight's clock, which runs at `rate`. */
    follow: (t: number, rate: number) => follow(t, rate, undefined),
    /** Las cuerdas, every frame out of a fight: the mazes' clock, and how near she is (0 far, 1 near). */
    far: (t: number, rate: number, nearness: number) => follow(t, rate, Math.max(0, Math.min(1, nearness))),
    /** Her song ends here (her fight over, a fight that is not hers, another place): it fades out. */
    stop(fade = .6) { if (audio.buses) release(fade); },
  };
}
