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

/** `hold` keeps a note or a noise at full for that long after its attack before it dies away. */
function tone(context: AudioContext, out: AudioNode, at: number, { type = 'sine', from, to = from, attack = .005, hold = 0, length, gain }: { type?: OscillatorType; from: number; to?: number; attack?: number; hold?: number; length: number; gain: number }) {
  const osc = context.createOscillator(), env = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + attack);
  if (hold) env.gain.setValueAtTime(gain, at + attack + hold);
  env.gain.exponentialRampToValueAtTime(.0001, at + length);
  osc.connect(env).connect(out);
  osc.start(at); osc.stop(at + length + .02);
  osc.onended = () => env.disconnect();
}
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(context: AudioContext, out: AudioNode, at: number, { cutoff, to = cutoff / 4, type = 'lowpass', q = 1, attack = 0, hold = 0, length, gain }: { cutoff: number; to?: number; type?: BiquadFilterType; q?: number; attack?: number; hold?: number; length: number; gain: number }) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(context, buffer);
  }
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), env = context.createGain();
  source.buffer = buffer; source.loop = true;
  filter.type = type; filter.Q.value = q; filter.frequency.setValueAtTime(cutoff, at); filter.frequency.exponentialRampToValueAtTime(to, at + length);
  env.gain.setValueAtTime(attack ? 0 : gain, at);
  if (attack) env.gain.linearRampToValueAtTime(gain, at + attack);
  if (hold) env.gain.setValueAtTime(gain, at + attack + hold);
  env.gain.exponentialRampToValueAtTime(.0001, at + length);
  source.connect(filter).connect(env).connect(out);
  source.start(at); source.stop(at + length + .02);
  source.onended = () => env.disconnect();
}

/** A cat's miaow: a voice that rises and falls through a nasal filter. */
function meow(context: AudioContext, out: AudioNode, at: number, { pitch, length, gain }: { pitch: number; length: number; gain: number }) {
  const osc = context.createOscillator(), filter = context.createBiquadFilter(), env = context.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(pitch, at);
  osc.frequency.linearRampToValueAtTime(pitch * 1.5, at + length * .35);
  osc.frequency.linearRampToValueAtTime(pitch * .82, at + length);
  filter.type = 'bandpass'; filter.Q.value = 3;
  filter.frequency.setValueAtTime(1100, at);
  filter.frequency.linearRampToValueAtTime(1900, at + length * .4);
  filter.frequency.linearRampToValueAtTime(1000, at + length);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + length * .2);
  env.gain.exponentialRampToValueAtTime(.0001, at + length);
  osc.connect(filter).connect(env).connect(out);
  osc.start(at); osc.stop(at + length + .02);
  osc.onended = () => env.disconnect();
}

export const SOUNDS = {
  // Menus: a soft tick to move, a rising pair to confirm, a falling note to go back.
  'ui-move': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'triangle', from: 1320 * p, length: .045, gain: .12 }); return .05; }, jitter: 15, gap: .03, voices: 2 },
  'ui-confirm': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'square', from: 660 * p, length: .06, gain: .06 }); tone(c, out, at + .055, { type: 'square', from: 990 * p, length: .09, gain: .06 }); return .15; }, gap: .06, voices: 2 },
  'ui-back': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'triangle', from: 620 * p, to: 360 * p, length: .11, gain: .14 }); return .12; }, gap: .06, voices: 2 },
  // Fights: a thump with a burst of grit for a blow, a rising sparkle for a cure or a boost.
  hit: { synth: (c, out, at, p) => { tone(c, out, at, { from: 150 * p, to: 48 * p, length: .16, gain: .5 }); noise(c, out, at, { cutoff: 2400, length: .12, gain: .35 }); return .17; }, jitter: 120, gap: .04, voices: 4 },
  heal: { synth: (c, out, at, p) => { [660, 880, 1320].forEach((from, i) => tone(c, out, at + i * .06, { from: from * p, length: .28, gain: .12 })); return .42; }, jitter: 30, gap: .1, voices: 2 },
  // Holding on: a knock taken on the guard, the stance itself, and maná coming back.
  'hit-guarded': { synth: (c, out, at, p) => { tone(c, out, at, { type: 'triangle', from: 170 * p, to: 90 * p, length: .1, gain: .32 }); noise(c, out, at, { cutoff: 900, length: .07, gain: .14 }); return .12; }, jitter: 80, gap: .04, voices: 3 },
  guard: { synth: (c, out, at, p) => { tone(c, out, at, { type: 'square', from: 240 * p, to: 170 * p, length: .05, gain: .09 }); noise(c, out, at, { cutoff: 3000, length: .04, gain: .1 }); tone(c, out, at + .02, { type: 'triangle', from: 180 * p, length: .2, gain: .14 }); return .24; }, jitter: 40, gap: .08, voices: 2 },
  mana: { synth: (c, out, at, p) => { [990, 1320].forEach((from, i) => tone(c, out, at + i * .05, { from: from * p, length: .16, gain: .08 })); return .22; }, jitter: 20, gap: .1, voices: 2 },
  // Gum swallowing a blow whole, and melting.
  swallowed: { synth: (c, out, at, p) => { tone(c, out, at, { from: 240 * p, to: 70 * p, length: .22, gain: .34 }); tone(c, out, at + .1, { from: 110 * p, to: 200 * p, length: .12, gain: .14 }); return .26; }, jitter: 60, gap: .1, voices: 2 },
  melt: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 2600, to: 5200, type: 'highpass', length: .36, gain: .14 }); tone(c, out, at, { from: 420 * p, to: 140 * p, length: .3, gain: .16 }); return .38; }, gap: .2, voices: 2 },
  // Foc Binari: the fire gathering, landing, or going out on something wet; and what burns keeps crackling.
  'fire-cast': { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 500 * p, to: 2600 * p, type: 'bandpass', q: .8, attack: .22, length: .4, gain: .32 }); tone(c, out, at, { type: 'sawtooth', from: 70 * p, to: 180 * p, attack: .2, length: .38, gain: .07 }); return .42; }, jitter: 60, gap: .15, voices: 2 },
  'fire-hit': { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 3200, to: 500, length: .32, gain: .4 }); tone(c, out, at, { from: 110 * p, to: 40 * p, length: .3, gain: .42 }); return .34; }, jitter: 60, gap: .08, voices: 2 },
  fizzle: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 3000, to: 6000, type: 'highpass', length: .42, gain: .15 }); tone(c, out, at, { from: 300 * p, to: 120 * p, length: .12, gain: .1 }); return .44; }, jitter: 60, gap: .1, voices: 2 },
  zap: { synth: (c, out, at, p) => { [0, .025, .06].forEach(t => tone(c, out, at + t, { type: 'sawtooth', from: 2100 * p, to: 500 * p, length: .03, gain: .09 })); noise(c, out, at, { cutoff: 5200 * p, to: 2200, type: 'bandpass', q: 2, length: .09, gain: .34 }); return .12; }, jitter: 90, gap: .05, voices: 2 },
  burn: { synth: (c, out, at) => { [0, .05, .11].forEach(t => noise(c, out, at + t, { cutoff: 1800, to: 2400, type: 'bandpass', q: 2, length: .03, gain: .6 })); noise(c, out, at, { cutoff: 600, length: .2, gain: .14 }); return .24; }, gap: .3, voices: 2 },
  // Matemágico thinking, and a soft gathering before a cure.
  think: { synth: (c, out, at, p) => { [880, 1175, 988, 1319].forEach((from, i) => tone(c, out, at + i * .075, { type: 'triangle', from: from * p, length: .06, gain: .09 })); return .36; }, jitter: 25, gap: .2, voices: 1 },
  'cast-soft': { synth: (c, out, at, p) => { tone(c, out, at, { from: 330 * p, to: 660 * p, attack: .2, length: .34, gain: .12 }); tone(c, out, at + .04, { from: 495 * p, to: 990 * p, attack: .2, length: .32, gain: .06 }); return .38; }, jitter: 25, gap: .2, voices: 1 },
  // Haru and Yuki: a miaow as they go, a claw as it lands, a deeper one into a wound.
  meow: { synth: (c, out, at, p) => { meow(c, out, at, { pitch: 520 * p, length: .34, gain: .75 }); return .36; }, jitter: 110, gap: .2, voices: 2 },
  'meow-soft': { synth: (c, out, at, p) => { meow(c, out, at, { pitch: 690 * p, length: .24, gain: .5 }); return .26; }, jitter: 90, gap: .15, voices: 2 },
  claw: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 5200 * p, to: 1800 * p, type: 'bandpass', q: 1.2, length: .07, gain: .46 }); tone(c, out, at, { type: 'triangle', from: 1900 * p, to: 900 * p, length: .035, gain: .05 }); return .09; }, jitter: 160, voices: 6 },
  'claw-deep': { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 4200 * p, to: 1200 * p, type: 'bandpass', q: 1.2, length: .1, gain: .46 }); tone(c, out, at, { from: 130 * p, to: 60 * p, length: .16, gain: .4 }); noise(c, out, at + .02, { cutoff: 900, length: .12, gain: .18 }); return .2; }, jitter: 90, gap: .06, voices: 2 },
  bleed: { synth: (c, out, at, p) => { tone(c, out, at, { from: 1100 * p, to: 340 * p, length: .07, gain: .16 }); tone(c, out, at + .07, { from: 700 * p, to: 240 * p, length: .06, gain: .08 }); return .14; }, jitter: 120, gap: .08, voices: 3 },
  // An onion: a layer ripping off with a wet pop, and all its weight coming down.
  peel: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 3000 * p, to: 900 * p, type: 'bandpass', q: 1, length: .1, gain: .3 }); tone(c, out, at + .06, { from: 520 * p, to: 1000 * p, length: .045, gain: .1 }); return .13; }, jitter: 150, gap: .03, voices: 4 },
  slam: { synth: (c, out, at, p) => { tone(c, out, at, { from: 78 * p, to: 30 * p, length: .42, gain: .66 }); noise(c, out, at, { cutoff: 700, length: .34, gain: .32 }); tone(c, out, at, { type: 'triangle', from: 150 * p, to: 60 * p, length: .12, gain: .24 }); return .44; }, jitter: 70, gap: .1, voices: 2 },
  // The other foes: a bark, a spit of gum, a dish splashing, an arcade ghost, the roof's wind and its «GAME OVER».
  bark: { synth: (c, out, at, p) => { [0, .13].forEach(t => { tone(c, out, at + t, { type: 'sawtooth', from: 420 * p, to: 210 * p, length: .075, gain: .24 }); noise(c, out, at + t, { cutoff: 1400, to: 900, type: 'bandpass', length: .05, gain: .2 }); }); return .22; }, jitter: 110, gap: .15, voices: 3 },
  spit: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 2400 * p, to: 700, type: 'bandpass', length: .11, gain: .24 }); tone(c, out, at, { from: 300 * p, to: 700 * p, length: .06, gain: .12 }); return .14; }, jitter: 90, gap: .06, voices: 2 },
  splash: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 4200, to: 900, length: .3, gain: .26 }); [0, .05].forEach(t => tone(c, out, at + t, { from: 900 * p, to: 1800 * p, length: .05, gain: .06 })); return .32; }, jitter: 90, gap: .08, voices: 3 },
  glitch: { synth: (c, out, at, p) => { [1040, 520, 780, 260].forEach((from, i) => tone(c, out, at + i * .03, { type: 'square', from: from * p, length: .03, gain: .14 })); return .15; }, jitter: 40, gap: .08, voices: 2 },
  'game-over': { synth: (c, out, at, p) => { [659, 523, 440, 330, 262].forEach((from, i) => tone(c, out, at + i * .11, { type: 'square', from: from * p, length: i === 4 ? .34 : .13, gain: .09 })); noise(c, out, at + .44, { cutoff: 1600, length: .3, gain: .16 }); return .8; }, gap: .4, voices: 1 },
  gust: { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 400 * p, to: 1400 * p, type: 'bandpass', q: .7, attack: .2, length: .52, gain: .5 }); return .54; }, jitter: 80, gap: .3, voices: 1 },
  // A dual attack (docs/combat.md § Ataques duales): the stinger as time slows, Matemágico's gold
  // chime climbing (a fifth, an octave and a bell over it) with a rush of air under it, then a miaow.
  dual: { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 300 * p, to: 3800 * p, type: 'bandpass', q: .8, attack: .25, length: .55, gain: .16 });
    tone(c, out, at, { from: 65 * p, to: 98 * p, attack: .02, length: .7, gain: .3 });
    [523, 784, 1047, 1568].forEach((from, i) => { tone(c, out, at + i * .07, { type: 'triangle', from: from * p, length: .5 - i * .06, gain: .12 }); tone(c, out, at + i * .07, { from: from * 2.01 * p, length: .3, gain: .03 }); });
    tone(c, out, at + .3, { from: 2093 * p, length: .9, gain: .05 });
    meow(c, out, at + .42, { pitch: 600 * p, length: .3, gain: .55 });
    return 1.25;
  }, jitter: 10, gap: .5, voices: 1 },
  // A dual about to go off (its banner up while it is aimed): two tones far apart sliding into one, a
  // rush of air rising under them, and a glint as they meet.
  'dual-armed': { synth: (c, out, at, p) => {
    tone(c, out, at, { type: 'triangle', from: 262 * p, to: 523 * p, attack: .1, length: .42, gain: .11 });
    tone(c, out, at, { type: 'triangle', from: 1047 * p, to: 523 * p, attack: .1, length: .42, gain: .07 });
    noise(c, out, at, { cutoff: 900 * p, to: 5200 * p, type: 'bandpass', q: 1.1, attack: .3, length: .42, gain: .06 });
    tone(c, out, at + .38, { from: 1568 * p, length: .45, gain: .05 }); tone(c, out, at + .38, { from: 3136 * p, length: .25, gain: .015 });
    return .85;
  }, jitter: 10, gap: .4, voices: 1 },
  // Punto débil: the angle found (a bright tick on a fine wire), and the mark spent (a crack and a deep blow).
  'mark-set': { synth: (c, out, at, p) => { tone(c, out, at, { from: 2637 * p, length: .5, gain: .07 }); tone(c, out, at + .05, { type: 'triangle', from: 1760 * p, length: .3, gain: .06 }); noise(c, out, at, { cutoff: 9000, to: 6000, type: 'highpass', length: .05, gain: .06 }); return .55; }, jitter: 10, gap: .2, voices: 1 },
  'mark-spent': { synth: (c, out, at, p) => { noise(c, out, at, { cutoff: 6000 * p, to: 800, type: 'bandpass', q: .9, length: .2, gain: .4 }); tone(c, out, at, { from: 120 * p, to: 36 * p, length: .5, gain: .6 }); tone(c, out, at, { type: 'triangle', from: 1975 * p, to: 988 * p, length: .25, gain: .08 }); return .52; }, jitter: 30, gap: .2, voices: 1 },
  // The tower's fears: a dish turned over on its rim (porcelain), wood creaking and cracking
  // (Vertitrón's eye breaking) and a heavy fall (its stomp, its knees hitting the roof: a deep thump).
  clink: { synth: (c, out, at, p) => { [2794, 3729].forEach((from, i) => tone(c, out, at + i * .06, { from: from * p, to: from * p * .995, length: .35, gain: .07 })); noise(c, out, at, { cutoff: 8000, to: 5000, type: 'highpass', length: .03, gain: .06 }); return .45; }, jitter: 40, gap: .1, voices: 2 },
  creak: { synth: (c, out, at, p) => { [0, .09, .2].forEach((t, i) => noise(c, out, at + t, { cutoff: (700 + i * 120) * p, to: (500 + i * 80) * p, type: 'bandpass', q: 9, length: .14, gain: .5 })); tone(c, out, at, { type: 'sawtooth', from: 95 * p, to: 80 * p, attack: .05, length: .4, gain: .05 }); return .42; }, jitter: 120, gap: .25, voices: 1 },
  crack: { synth: (c, out, at, p) => { [0, .04, .1, .17].forEach(t => noise(c, out, at + t, { cutoff: 2600 * p, to: 700, type: 'bandpass', q: 1.4, length: .06, gain: .5 })); tone(c, out, at, { from: 140 * p, to: 50 * p, length: .3, gain: .4 }); return .36; }, jitter: 90, gap: .15, voices: 2 },
  // Vertitrón (src/battle-scene.ts): its Grito liberador, a low growl of a roar with air rushing out;
  // its eye charging, a whine climbing; the Rayo terrorífico, a hard electric buzz that falls away.
  roar: { synth: (c, out, at, p) => { tone(c, out, at, { type: 'sawtooth', from: 92 * p, to: 70 * p, attack: .08, length: .9, gain: .16 }); tone(c, out, at, { type: 'square', from: 46 * p, to: 38 * p, attack: .1, length: .9, gain: .08 }); noise(c, out, at, { cutoff: 300 * p, to: 1800 * p, type: 'bandpass', q: .6, attack: .1, length: .85, gain: .5 }); return .92; }, jitter: 60, gap: .5, voices: 1 },
  charge: { synth: (c, out, at, p) => { tone(c, out, at, { type: 'sawtooth', from: 180 * p, to: 1400 * p, attack: .3, length: .8, gain: .05 }); tone(c, out, at, { from: 360 * p, to: 2600 * p, attack: .3, length: .8, gain: .06 }); noise(c, out, at, { cutoff: 600 * p, to: 4800 * p, type: 'bandpass', q: 3, attack: .4, length: .75, gain: .14 }); return .82; }, jitter: 30, gap: .5, voices: 1 },
  beam: { synth: (c, out, at, p) => { tone(c, out, at, { type: 'sawtooth', from: 220 * p, to: 70 * p, length: .7, gain: .14 }); tone(c, out, at, { type: 'square', from: 110 * p, to: 55 * p, length: .65, gain: .07 }); noise(c, out, at, { cutoff: 5200 * p, to: 900, type: 'bandpass', q: 1.2, length: .6, gain: .32 }); return .72; }, jitter: 40, gap: .4, voices: 1 },
  thump: { synth: (c, out, at, p) => { tone(c, out, at, { from: 55 * p, to: 24 * p, length: .8, gain: .8 }); noise(c, out, at, { cutoff: 400, to: 60, length: .6, gain: .3 }); noise(c, out, at + .08, { cutoff: 2400, to: 600, type: 'bandpass', length: .4, gain: .12 }); return .82; }, jitter: 30, gap: .4, voices: 1 },
  // A pane of the glass into or out of a fight's pocket turning (src/post.ts): a tiny glassy tick, never twice the same.
  'glass-tick': { synth: (c, out, at, p) => { tone(c, out, at, { from: 3600 * p, to: 3100 * p, length: .035, gain: .045 }); noise(c, out, at, { cutoff: 9000 * p, to: 5000, type: 'highpass', q: .8, length: .022, gain: .08 }); return .04; }, jitter: 450, gap: .024, voices: 3 },
  // Stats going up or down (src/stat-fx.ts), in step with its chevrons: a rush of air rising and three
  // bright notes climbing with a bell over each, a sparkle at the top; or air falling, three notes
  // sinking and bending down, and a low thud as it lands.
  'stat-up': { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 600 * p, to: 5200 * p, type: 'bandpass', q: 1.1, attack: .1, length: .3, gain: .16 });
    [659, 880, 1175].forEach((from, i) => { const t = at + .12 + i * .11; tone(c, out, t, { type: 'triangle', from: from * p, to: from * p * 1.02, length: .2, gain: .13 }); tone(c, out, t, { from: from * 2 * p, length: .14, gain: .035 }); });
    tone(c, out, at + .45, { from: 2349 * p, length: .25, gain: .03 });
    noise(c, out, at + .42, { cutoff: 7000, to: 11000, type: 'highpass', q: .7, length: .22, gain: .04 });
    return .72;
  }, jitter: 15, gap: .2, voices: 1 },
  'stat-down': { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 4200 * p, to: 500 * p, type: 'bandpass', q: 1.1, attack: .04, length: .32, gain: .15 });
    [784, 587, 440].forEach((from, i) => { const t = at + .12 + i * .11; tone(c, out, t, { type: 'triangle', from: from * p, to: from * p * .9, length: .2, gain: .14 }); tone(c, out, t, { type: 'square', from: from * p / 2, to: from * p * .45, length: .12, gain: .025 }); });
    tone(c, out, at + .44, { from: 150 * p, to: 70 * p, length: .24, gain: .22 });
    return .7;
  }, jitter: 15, gap: .2, voices: 1 },
  // Someone goes down, and is gone in a puff; the party running off.
  ko: { synth: (c, out, at, p) => { tone(c, out, at, { from: 320 * p, to: 70 * p, length: .34, gain: .28 }); noise(c, out, at + .28, { cutoff: 500, length: .18, gain: .24 }); return .48; }, jitter: 60, gap: .1, voices: 2 },
  poof: { synth: (c, out, at) => { noise(c, out, at, { cutoff: 1500, to: 300, attack: .04, length: .26, gain: .36 }); return .28; }, gap: .1, voices: 3 },
  // A beaten foe coming apart (src/disintegrate.ts): a breath of air rising as it crumbles, and soft
  // high notes climbing out of it like its light streaming up.
  dissolve: { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 500 * p, to: 4200 * p, type: 'bandpass', q: .9, attack: .12, length: .75, gain: .26 });
    noise(c, out, at + .05, { cutoff: 6500, to: 9000, type: 'highpass', q: .7, attack: .2, length: .6, gain: .05 });
    [784, 988, 1319, 1568].forEach((from, i) => tone(c, out, at + .1 + i * .12, { from: from * p, to: from * p * 1.03, attack: .04, length: .38, gain: .045 }));
    return .9;
  }, jitter: 25, gap: .12, voices: 3 },
  flee: { synth: (c, out, at, p) => { [0, .07, .14, .21].forEach(t => noise(c, out, at + t, { cutoff: 700 * p, to: 300, type: 'bandpass', q: 1.5, length: .04, gain: .75 })); return .26; }, gap: .3, voices: 1 },
  // Ánimas: changing one, one that will not change, one waking up; a level or an ánima gained, and an item.
  'anima-swap': { synth: (c, out, at, p) => { tone(c, out, at, { from: 520 * p, to: 1040 * p, length: .16, gain: .12 }); tone(c, out, at + .03, { type: 'triangle', from: 780 * p, to: 1560 * p, length: .18, gain: .06 }); return .22; }, jitter: 20, gap: .06, voices: 2 },
  denied: { synth: (c, out, at) => { tone(c, out, at, { type: 'square', from: 150, length: .06, gain: .06 }); tone(c, out, at + .07, { type: 'square', from: 120, length: .09, gain: .06 }); return .17; }, gap: .15, voices: 1 },
  awaken: { synth: (c, out, at) => { noise(c, out, at, { cutoff: 300, to: 3000, type: 'bandpass', q: .7, attack: .9, length: 1.1, gain: .2 }); [262, 392, 523, 784].forEach((from, i) => tone(c, out, at + .9 + i * .06, { from, length: .8, gain: .13 })); return 1.9; }, voices: 1 },
  unlock: { synth: (c, out, at) => { [523, 659, 784, 1047].forEach((from, i) => tone(c, out, at + i * .08, { type: 'triangle', from, length: i === 3 ? .4 : .22, gain: .13 })); return .68; }, gap: .4, voices: 1 },
  // A fight's victory screen (battle-ui `levelUp`): an ánima's level stamping in, two quick notes up and a ping.
  'level-up': { synth: (c, out, at) => {
    [784, 1175].forEach((from, i) => tone(c, out, at + i * .07, { type: 'triangle', from, length: .16, gain: .12 }));
    tone(c, out, at + .14, { from: 1568, length: .5, gain: .07 }); tone(c, out, at + .14, { from: 3136, length: .22, gain: .02 });
    return .64;
  }, gap: .12, voices: 2 },
  // A skill learned on the victory screen (battle-ui `revealSkill`): air rushing up under a low swell,
  // a chord climbing (C, G, C, E, G) and a long bell over it as its name lands.
  'skill-learned': { synth: (c, out, at) => {
    noise(c, out, at, { cutoff: 260, to: 4200, type: 'bandpass', q: .8, attack: .3, length: .6, gain: .14 });
    tone(c, out, at, { from: 65, to: 131, attack: .25, length: .9, gain: .26 });
    [262, 392, 523, 659, 784].forEach((from, i) => tone(c, out, at + .22 + i * .06, { type: 'triangle', from, length: .7 - i * .06, gain: .1 }));
    tone(c, out, at + .5, { from: 2093, length: 1.1, gain: .05 }); tone(c, out, at + .5, { from: 3136, length: .5, gain: .018 });
    return 1.6;
  }, gap: .6, voices: 1 },
  pickup: { synth: (c, out, at, p) => { [880, 1175].forEach((from, i) => tone(c, out, at + i * .07, { from: from * p, length: .18, gain: .12 })); return .26; }, jitter: 15, gap: .1, voices: 1 },
  // Nuria's street turning into La calle que no acaba (src/street-shift.ts). A house born out of the
  // ground: the ground giving way in a low rumble, stone grinding up and cracking as it pushes through,
  // and a heavy thud as it overshoots and settles (about 1.2 s into its 1.7 s rise).
  rise: { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 110 * p, to: 170 * p, attack: .25, hold: .85, length: 1.55, gain: 1 });
    noise(c, out, at + .05, { cutoff: 320 * p, to: 820 * p, type: 'bandpass', q: 2.4, attack: .3, hold: .6, length: 1.25, gain: .42 });
    tone(c, out, at, { type: 'triangle', from: 38 * p, to: 60 * p, attack: .3, hold: .7, length: 1.25, gain: .24 });
    [.16, .34, .49, .7, .88, 1.02].forEach((t, i) => noise(c, out, at + t, { cutoff: (1500 + i * 260) * p, to: 500, type: 'bandpass', q: 1.5, length: .05, gain: .28 }));
    tone(c, out, at + 1.18, { from: 74 * p, to: 30 * p, length: .5, gain: .5 });
    noise(c, out, at + 1.18, { cutoff: 700, to: 70, length: .42, gain: .32 });
    return 1.7;
  }, jitter: 90, gap: .12, voices: 3 },
  // What stood beyond the corner going down into the ground: the rumble and the grinding falling away, and a muffled close.
  sink: { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 170 * p, to: 75 * p, attack: .1, hold: .75, length: 1.3, gain: .95 });
    noise(c, out, at, { cutoff: 900 * p, to: 240 * p, type: 'bandpass', q: 2.4, attack: .12, hold: .55, length: 1.15, gain: .38 });
    tone(c, out, at, { type: 'triangle', from: 62 * p, to: 30 * p, attack: .1, hold: .6, length: 1.15, gain: .24 });
    [.12, .3, .55].forEach(t => noise(c, out, at + t, { cutoff: 1300 * p, to: 400, type: 'bandpass', q: 1.5, length: .05, gain: .26 }));
    tone(c, out, at + 1, { from: 52 * p, to: 26 * p, length: .4, gain: .32 });
    return 1.4;
  }, jitter: 70, gap: .2, voices: 2 },
  // The corner unrolling into the street's start: the ground stretching out away from them, a long
  // groan bending down with a rush of air going off into the distance.
  stretch: { synth: (c, out, at, p) => {
    noise(c, out, at, { cutoff: 140 * p, to: 70 * p, attack: .3, hold: 1, length: 1.95, gain: .9 });
    noise(c, out, at, { cutoff: 1300 * p, to: 180 * p, type: 'bandpass', q: 1.1, attack: .45, hold: .6, length: 1.9, gain: .3 });
    tone(c, out, at, { type: 'triangle', from: 82 * p, to: 41 * p, attack: .4, hold: .9, length: 1.9, gain: .2 });
    tone(c, out, at + .1, { type: 'square', from: 41 * p, to: 22 * p, attack: .4, hold: .8, length: 1.8, gain: .05 });
    return 1.95;
  }, jitter: 30, gap: 1, voices: 1 },
} satisfies Record<string, Sound>;
export type SoundId = keyof typeof SOUNDS;

/** Four seconds of noise a channel, for sounds that go on: too long to hear it come round. */
const longNoiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function longNoise(context: BaseAudioContext) {
  let buffer = longNoiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(2, context.sampleRate * 4, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    longNoiseBuffers.set(context, buffer);
  }
  return buffer;
}
/**
 * A sound that goes on while something is there (`sfx.bed`): it builds itself into `out` from `at`
 * and is steered with `drive` (0–1, what it means is up to each) until it stops.
 */
type Bed = (context: BaseAudioContext, out: AudioNode, at: number) => { drive(k: number, at: number): void; stop(at: number): void };
/**
 * The bubble's hiss's knobs (`BEDS.hiss`): each layer's level far from it (`drive` 0) and at it (1).
 * A change is heard the next time the hiss starts (going back into La calle).
 */
export const HISS = { hiss: [.035, .05], whirl: [.06, .25], draught: [.45, .5] };

export const BEDS = {
  // The bubble at the end of La calle que no acaba (src/fear-portal.ts): a sharp hiss breathing on
  // two slow swells that never line up, a narrower whirl of air going up and down and round from
  // side to side at the bubble's own pace, and a low draught pulling into its well. `drive` is how
  // close the party is: the whirl turns faster and louder and the hiss opens up, as the bubble does.
  hiss: (c, out, at) => {
    const source = c.createBufferSource();
    source.buffer = longNoise(c); source.loop = true;
    const sources: AudioScheduledSourceNode[] = [source];
    const lfo = (rate: number, depth: number, param: AudioParam, type: OscillatorType = 'sine') => {
      const osc = c.createOscillator(), amount = c.createGain();
      osc.type = type; osc.frequency.value = rate; amount.gain.value = depth;
      osc.connect(amount).connect(param); osc.start(at); sources.push(osc);
      return osc;
    };
    const filter = (type: BiquadFilterType, frequency: number, q: number, gain = 0) => {
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = frequency; f.Q.value = q; f.gain.value = gain;
      return f;
    };
    const level = (value: number) => { const g = c.createGain(); g.gain.value = value; return g; };
    const high = filter('highpass', 4200, .8), hiss = level(HISS.hiss[0]);
    lfo(.29, HISS.hiss[0] * .35, hiss.gain); lfo(.71, HISS.hiss[0] * .22, hiss.gain);
    source.connect(high).connect(filter('peaking', 6800, 1.2, 9)).connect(hiss).connect(out);
    const band = filter('bandpass', 3000, 4), whirl = level(HISS.whirl[0]), round = c.createStereoPanner();
    const sweep = lfo(.35, 1300, band.frequency, 'triangle'), turn = lfo(.35, .6, round.pan);
    source.connect(band).connect(whirl).connect(round).connect(out);
    const draught = level(HISS.draught[0]);
    lfo(.13, HISS.draught[0] * .33, draught.gain);
    source.connect(filter('lowpass', 240, .7)).connect(draught).connect(out);
    source.start(at);
    return {
      drive(k, t) {
        // The bubble turns 1 + 1.4 × near times its own pace (src/fear-portal.ts).
        const rate = .35 * (1 + k * 1.4);
        sweep.frequency.setTargetAtTime(rate, t, .4); turn.frequency.setTargetAtTime(rate, t, .4);
        const between = ([far, close]: number[]) => far + (close - far) * k;
        whirl.gain.setTargetAtTime(between(HISS.whirl), t, .4);
        hiss.gain.setTargetAtTime(between(HISS.hiss), t, .4);
        draught.gain.setTargetAtTime(between(HISS.draught), t, .4);
        high.frequency.setTargetAtTime(4200 - k * 1400, t, .4);
      },
      stop(t) { for (const s of sources) s.stop(t); },
    };
  },
} satisfies Record<string, Bed>;
export type BedId = keyof typeof BEDS;
/** How loud a bed plays (0 silent, 1 as designed), where it sits from left to right, and its `drive`. */
export interface BedLevel { volume: number; pan?: number; drive?: number }

export type Sfx = ReturnType<typeof createSfx>;

export function createSfx(audio: GameAudio) {
  const last = new Map<SoundId, number>();
  const playing = new Map<SoundId, number>();
  const beds = new Map<BedId, { gain: GainNode; panner: StereoPannerNode; bed: ReturnType<Bed>; level: Required<BedLevel> }>();
  return {
    /**
     * Keeps a sound that goes on (`BEDS`) playing at `level`, or fades it out with none. Whatever
     * makes it calls this every frame; the sound eases to each new level and only moves when it does.
     */
    bed(id: BedId, level?: BedLevel) {
      const bus = audio.buses;
      let running = beds.get(id);
      if (!level || !bus) {
        if (!running) return;
        beds.delete(id);
        const { gain, panner, bed } = running, t = gain.context.currentTime;
        gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(0, t, .15);
        bed.stop(t + 1);
        setTimeout(() => { gain.disconnect(); panner.disconnect(); }, 1100);
        return;
      }
      const t = bus.context.currentTime;
      if (!running) {
        const gain = bus.context.createGain(), panner = bus.context.createStereoPanner();
        gain.gain.value = 0;
        gain.connect(panner).connect(bus.sfx);
        running = { gain, panner, bed: BEDS[id](bus.context, gain, t), level: { volume: 0, pan: 0, drive: Number.NaN } };
        beds.set(id, running);
      }
      const { volume, pan = 0, drive = 0 } = level, was = running.level;
      if (Math.abs(volume - was.volume) > .003) { running.gain.gain.setTargetAtTime(volume, t, .15); was.volume = volume; }
      if (Math.abs(pan - was.pan) > .01) { running.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, .1); was.pan = pan; }
      if (!(Math.abs(drive - was.drive) <= .01)) { running.bed.drive(drive, t); was.drive = drive; }
    },
    /** Plays a sound `delay` seconds from now; `volume` scales it and `pan` places it from -1 (left) to 1 (right). */
    play(id: SoundId, { volume = 1, pan = 0, delay = 0 }: { volume?: number; pan?: number; delay?: number } = {}) {
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
      if (sound.synth) setTimeout(done, (sound.synth(bus.context, gain, now + .005 + delay, pitch) + delay + .1) * 1000);
      else if (sound.src) {
        audio.load(sound.src).then(buffer => {
          const source = bus.context.createBufferSource();
          source.buffer = buffer; source.playbackRate.value = pitch;
          source.connect(gain); source.onended = done; source.start(bus.context.currentTime + delay);
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
