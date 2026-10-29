/**
 * La Reina Bubbaloo's castle over its song (docs/audio.md). A haunted track plays through this:
 * the worse the castle is right now, the more the song warps and darkens, a low drone and a draught
 * creep in under it, and things sound now and then in the castle around it. Every sound is tuned to
 * the song's C minor. The `level` is the castle's threat (src/animas.ts), so the music eases as the
 * party gathers ánimas and gets ready to go in, the way the castle's towers fall.
 */

/**
 * Every knob of the haunt, by level. An effect is silent up to its `from` level and grows to
 * `full` at level 1; a sound plays now and then while the level is above its `from`, at its
 * `volume` (1 as designed, 0 never). Sounds follow the castle's pieces (src/palace.ts): thunder
 * comes with the storm over the crown (.55), the song sags once the keep's eyes are lit (.7) and
 * a heartbeat only at her worst, before any ánima.
 */
export const HAUNT = {
  /** The song's pitch wobbling like a warped tape, in cents. */
  wobble: { from: 0, full: 24 },
  /** A slower drift of its pitch under the wobble, in cents. */
  drift: { from: 0, full: 10 },
  /** A lowpass darkening the song, in Hz (20000 leaves it as it is). */
  darken: { from: 0, full: 3800 },
  /** A low C drone that beats slowly, as a gain. */
  drone: { from: .15, full: .03 },
  /** A draught through the halls, as a gain. */
  draught: { from: .4, full: .025 },
  /** Mean seconds between sounds, at level 0 and at level 1. */
  every: [36, 12],
  sounds: {
    breath: { from: .25, volume: 1 },
    bell: { from: .4, volume: 1 },
    thunder: { from: .55, volume: 1 },
    /** Its volume is how far the song drags. */
    sag: { from: .7, volume: 1 },
    heartbeat: { from: .85, volume: 1 },
  },
};
export type HauntSound = keyof typeof HAUNT.sounds;
/** Chapter 1's palace is a dream: a breath now and then, never the storm. */
export const DREAM_HAUNT = .35;

const clamp01 = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** How haunted the castle's song is: the dream in chapter 1, the castle's threat in chapter 2. */
export function castleHaunt({ adult, castleThreat }: { adult: boolean; castleThreat: number }) {
  return adult ? castleThreat : DREAM_HAUNT;
}

/** How far past `from` a level is, 0 at `from` and below, 1 at level 1. */
const past = (l: number, from: number) => from >= 1 ? 0 : Math.max(0, l - from) / (1 - from);

/** What a level does to the song (`HAUNT`): pitch wobble and drift in cents, the lowpass, layer gains and the sounds it allows. */
export function hauntMix(level: number) {
  const l = clamp01(level), { wobble, drift, darken, drone, draught, every, sounds } = HAUNT;
  return {
    wobble: wobble.full * past(l, wobble.from),
    drift: drift.full * past(l, drift.from),
    cutoff: 20000 * (darken.full / 20000) ** past(l, darken.from),
    drone: drone.full * past(l, drone.from),
    draught: draught.full * past(l, draught.from),
    sounds: l > 0 ? (Object.keys(sounds) as HauntSound[]).filter(id => l > sounds[id].from && sounds[id].volume > 0) : [],
    every: every[0] + (every[1] - every[0]) * l,
  };
}

/** The delay swing that bends pitch by `cents` at its peak, for a delay line swept at `rate` Hz. */
export const swing = (cents: number, rate: number) => (2 ** (cents / 1200) - 1) / (2 * Math.PI * rate);

/** The pitch bend of a delay line runs on this much delay, so the swings never reach zero. */
const BASE_DELAY = .03;
const WOBBLE_RATE = .37, DRIFT_RATE = .061;
/** C minor, around the song: C2 for the drone, C3 and G2 for the bell. */
const C2 = 65.41, G2 = 98, C3 = 130.81;

export type Haunt = ReturnType<typeof createHaunt>;

export function createHaunt(context: AudioContext, out: AudioNode) {
  // The song: a delay line swept by two slow LFOs bends its pitch like a warped tape, then a lowpass darkens it.
  const input = context.createGain();
  const warp = context.createDelay(.15); warp.delayTime.value = BASE_DELAY;
  const shade = context.createBiquadFilter(); shade.type = 'lowpass'; shade.frequency.value = 20000; shade.Q.value = .6;
  input.connect(warp).connect(shade).connect(out);
  function lfo(rate: number, target: AudioParam) {
    const osc = context.createOscillator(), depth = context.createGain();
    osc.frequency.value = rate; depth.gain.value = 0;
    osc.connect(depth).connect(target);
    osc.start();
    return depth.gain;
  }
  const wobble = lfo(WOBBLE_RATE, warp.delayTime), drift = lfo(DRIFT_RATE, warp.delayTime);

  // Everything the castle adds goes out dry and into a long, dark echo, so it sounds far off in stone.
  const sounds = context.createGain();
  const echo = context.createDelay(1), damp = context.createBiquadFilter(), feedback = context.createGain();
  echo.delayTime.value = .43; damp.type = 'lowpass'; damp.frequency.value = 1500; feedback.gain.value = .42;
  sounds.connect(out); sounds.connect(echo).connect(damp).connect(out); damp.connect(feedback).connect(echo);

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // The beds are built on first use and keep running, silent at level 0.
  let beds: { drone: AudioParam; draught: AudioParam } | undefined;
  function buildBeds() {
    const drone = context.createGain(), body = context.createBiquadFilter();
    drone.gain.value = 0; body.type = 'lowpass'; body.frequency.value = 240;
    body.connect(drone).connect(out);
    // A low C with a fifth, the C a hair sharp so the two beat slowly.
    for (const [type, freq, gain] of [['sawtooth', C2, .5], ['sine', C2 + .35, .8], ['sine', G2 * 1.002, .35]] as const) {
      const osc = context.createOscillator(), level = context.createGain();
      osc.type = type; osc.frequency.value = freq; level.gain.value = gain;
      osc.connect(level).connect(body); osc.start();
    }
    // A draught through the halls: noise through a narrow band that slowly moves and wanders across.
    const air = context.createBufferSource(), band = context.createBiquadFilter(), draught = context.createGain(), side = context.createStereoPanner();
    air.buffer = noiseBuffer; air.loop = true;
    band.type = 'bandpass'; band.frequency.value = 520; band.Q.value = 5;
    draught.gain.value = 0;
    air.connect(band).connect(draught).connect(side).connect(out);
    air.start();
    lfo(.083, band.frequency).value = 300;
    lfo(.047, side.pan).value = .7;
    beds = { drone: drone.gain, draught: draught.gain };
    return beds;
  }

  /** A short-lived output for one sound at its `volume`, placed left or right; it lets go of itself after `length` seconds. */
  function place(id: HauntSound, pan: number, length: number): [GainNode, StereoPannerNode] {
    const gain = context.createGain(), volume = context.createGain(), panner = context.createStereoPanner();
    volume.gain.value = HAUNT.sounds[id].volume; panner.pan.value = pan;
    gain.connect(volume).connect(panner).connect(sounds);
    setTimeout(() => { gain.disconnect(); volume.disconnect(); panner.disconnect(); }, (length + 4) * 1000);
    return [gain, panner];
  }
  function partial(dest: AudioNode, at: number, freq: number, gain: number, decay: number, type: OscillatorType = 'sine') {
    const osc = context.createOscillator(), env = context.createGain();
    osc.type = type; osc.frequency.value = freq;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + .004);
    env.gain.exponentialRampToValueAtTime(.0001, at + decay);
    osc.connect(env).connect(dest);
    osc.start(at); osc.stop(at + decay + .05);
    osc.onended = () => env.disconnect();
  }
  function hiss(dest: AudioNode, at: number, length: number, filter: (f: BiquadFilterNode) => void) {
    const source = context.createBufferSource(), f = context.createBiquadFilter();
    source.buffer = noiseBuffer; source.loop = true;
    filter(f);
    source.connect(f).connect(dest);
    source.start(at, Math.random() * 1.5); source.stop(at + length);
    source.onended = () => f.disconnect();
  }
  const random = (from: number, to: number) => from + Math.random() * (to - from);
  const RECIPES: Record<HauntSound, (at: number) => void> = {
    // A breath down a corridor: noise swelling through a vowel-like band, crossing from one side to the other.
    breath: at => {
      const [out, panner] = place('breath', 0, 4), from = Math.random() < .5 ? -1 : 1;
      panner.pan.setValueAtTime(from * .8, at); panner.pan.linearRampToValueAtTime(-from * .8, at + 3);
      out.gain.setValueAtTime(0, at); out.gain.linearRampToValueAtTime(.09, at + 1.3); out.gain.linearRampToValueAtTime(0, at + 3);
      hiss(out, at, 3.1, f => { f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(700, at); f.frequency.exponentialRampToValueAtTime(1500, at + 1.3); f.frequency.exponentialRampToValueAtTime(600, at + 3); });
    },
    // A bell tolling somewhere above: a minor-third bell on C or G, once or twice.
    bell: at => {
      const [out] = place('bell', random(-.4, .4), 16), root = Math.random() < .6 ? C3 : G2, far = context.createBiquadFilter();
      far.type = 'lowpass'; far.frequency.value = 1900; far.connect(out);
      setTimeout(() => far.disconnect(), 20000);
      const tolls = Math.random() < .5 ? 1 : 2;
      for (let n = 0; n < tolls; n++) for (const [ratio, gain] of [[.5, .02], [1, .026], [1.2, .016], [1.5, .01], [2, .014], [2.5, .006], [3, .005]] as const) {
        partial(far, at + n * 2.6, root * ratio, gain, 7 / Math.sqrt(ratio));
      }
    },
    // Thunder from the storm over the crown: a slow low roll with a crack or two in it.
    thunder: at => {
      const [out] = place('thunder', random(-.5, .5), 8);
      out.gain.setValueAtTime(0, at); out.gain.linearRampToValueAtTime(.32, at + .7); out.gain.exponentialRampToValueAtTime(.0005, at + 7);
      hiss(out, at, 7.2, f => { f.type = 'lowpass'; f.Q.value = .9; f.frequency.setValueAtTime(260, at); f.frequency.exponentialRampToValueAtTime(70, at + 7); });
      for (let k = 0; k < 2; k++) {
        const crack = context.createGain(), when = at + random(.1, 1.6);
        crack.gain.setValueAtTime(0, when); crack.gain.linearRampToValueAtTime(.12, when + .02); crack.gain.exponentialRampToValueAtTime(.0005, when + .6);
        crack.connect(out);
        hiss(crack, when, .7, f => { f.type = 'lowpass'; f.frequency.value = 900; });
      }
    },
    // The song itself sags, like a tape dragging, and catches up.
    sag: at => {
      const time = warp.delayTime;
      time.cancelScheduledValues(at);
      time.setValueAtTime(BASE_DELAY, at);
      time.linearRampToValueAtTime(BASE_DELAY + .05 * HAUNT.sounds.sag.volume, at + 1.6);
      time.linearRampToValueAtTime(BASE_DELAY, at + 3.4);
    },
    // A heartbeat under the floor, slowing.
    heartbeat: at => {
      const [out] = place('heartbeat', 0, 6);
      for (let k = 0; k < 4; k++) {
        const t = at + k * (.95 + k * .08);
        for (const [dt, gain] of [[0, .16], [.27, .11]] as const) {
          const osc = context.createOscillator(), env = context.createGain();
          osc.frequency.setValueAtTime(62, t + dt); osc.frequency.exponentialRampToValueAtTime(38, t + dt + .2);
          env.gain.setValueAtTime(0, t + dt); env.gain.linearRampToValueAtTime(gain, t + dt + .015); env.gain.exponentialRampToValueAtTime(.0001, t + dt + .25);
          osc.connect(env).connect(out); osc.start(t + dt); osc.stop(t + dt + .3);
          osc.onended = () => env.disconnect();
        }
      }
    },
  };

  let level = 0, timer: ReturnType<typeof setTimeout> | undefined;
  /** Plays one of the sounds the level allows now and then; nothing while the context is suspended, so none pile up. */
  function next(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { sounds: allowed, every } = hauntMix(level);
      if (!allowed.length) { timer = undefined; return; }
      if (context.state === 'running') RECIPES[allowed[Math.floor(Math.random() * allowed.length)]](context.currentTime + .05);
      next(every * random(.5, 1.5));
    }, delay * 1000);
  }

  return {
    /** Haunted voices connect here instead of the music bus. */
    input,
    get level() { return level; },
    /** Moves to a level (0 is the plain song) over `fade` seconds. */
    set(to: number, fade = 3) {
      const was = level;
      level = clamp01(to);
      const mix = hauntMix(level), at = context.currentTime, glide = Math.max(.01, fade / 3);
      wobble.setTargetAtTime(swing(mix.wobble, WOBBLE_RATE), at, glide);
      drift.setTargetAtTime(swing(mix.drift, DRIFT_RATE), at, glide);
      shade.frequency.setTargetAtTime(mix.cutoff, at, glide);
      if (level > 0 || beds) {
        const bed = beds ?? buildBeds();
        bed.drone.setTargetAtTime(mix.drone, at, glide);
        bed.draught.setTargetAtTime(mix.draught, at, glide);
      }
      if (level > 0 && (was === 0 || timer === undefined)) next(random(4, 9));
      else if (level === 0) { clearTimeout(timer); timer = undefined; }
    },
    /** Plays a sound now, whatever the level (development checks). */
    sound(id: HauntSound) { RECIPES[id](context.currentTime + .05); },
  };
}
