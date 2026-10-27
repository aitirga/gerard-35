/**
 * The sound engine (docs/audio.md): one AudioContext, a music bus and an effects bus, the player's
 * levels and the decoded files. Music and effects build on it (src/music.ts, src/sfx.ts).
 *
 *   music voices → duck (gain) → muffle (lowpass) → music level ┐
 *   effects                                       → sfx level   ┴→ master → speakers
 */
export interface AudioSettings { music: number; sfx: number; muted: boolean }
export const DEFAULT_AUDIO: AudioSettings = { music: .7, sfx: .8, muted: false };
const storageKey = 'gerard35.audio.v1';
const clamp01 = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

/** Whatever was stored, as valid levels between 0 and 1. */
export function validAudioSettings(value: unknown): AudioSettings {
  const saved = value && typeof value === 'object' ? value as Partial<AudioSettings> : {};
  return { music: clamp01(saved.music, DEFAULT_AUDIO.music), sfx: clamp01(saved.sfx, DEFAULT_AUDIO.sfx), muted: saved.muted === true };
}
/** Sliders feel even when the level is squared: half way sounds like half as loud. */
export const levelGain = (level: number) => level * level;

export interface Buses { context: AudioContext; music: AudioNode; sfx: AudioNode }
export type GameAudio = ReturnType<typeof createAudio>;

export function createAudio() {
  let settings = DEFAULT_AUDIO;
  try { settings = validAudioSettings(JSON.parse(localStorage.getItem(storageKey) ?? '{}')); } catch { /* Storage is optional. */ }
  let buses: (Buses & { master: GainNode; musicLevel: GainNode; sfxLevel: GainNode; duck: GainNode; muffle: BiquadFilterNode }) | undefined;
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const listeners = new Set<() => void>();
  let unlock: () => void = () => {};
  /** Resolves on the first key, click or pad button: browsers keep sound off until then. */
  const unlocked = new Promise<void>(resolve => { unlock = resolve; });

  function setup() {
    if (buses) return buses;
    const Context = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return undefined;
    const context = new Context({ latencyHint: 'interactive' });
    const master = context.createGain(), musicLevel = context.createGain(), sfxLevel = context.createGain(), duck = context.createGain();
    const muffle = context.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = .5;
    duck.connect(muffle).connect(musicLevel).connect(master);
    sfxLevel.connect(master);
    master.connect(context.destination);
    buses = { context, music: duck, sfx: sfxLevel, master, musicLevel, sfxLevel, duck, muffle };
    apply(0);
    return buses;
  }
  function apply(ramp = .08) {
    if (!buses) return;
    const at = buses.context.currentTime;
    buses.master.gain.setTargetAtTime(settings.muted ? 0 : 1, at, ramp / 3);
    buses.musicLevel.gain.setTargetAtTime(levelGain(settings.music), at, ramp / 3);
    buses.sfxLevel.gain.setTargetAtTime(levelGain(settings.sfx), at, ramp / 3);
  }
  function resume() {
    if (document.hidden) return;
    const bus = setup();
    if (bus && bus.context.state !== 'running') void bus.context.resume().catch(() => {});
  }
  const gesture = () => { resume(); unlock(); };
  const events = ['keydown', 'pointerdown'] as const;
  for (const event of events) window.addEventListener(event, gesture, { capture: true, passive: true });
  // A pad press is no event: the controller polls, so look for one now and then until the first sound.
  const padWatch = setInterval(() => {
    try { if ([...(navigator.getGamepads?.() ?? [])].some(pad => pad?.buttons.some(b => b.pressed))) gesture(); } catch { /* Restricted contexts may deny the API. */ }
  }, 250);
  void unlocked.then(() => clearInterval(padWatch));
  // A hidden tab stays quiet and keeps its place.
  const visibility = () => { if (document.hidden) void buses?.context.suspend().catch(() => {}); else void unlocked.then(resume); };
  document.addEventListener('visibilitychange', visibility);

  return {
    unlocked,
    get settings() { return settings; },
    /** The context and buses, created on first use; undefined in a browser without Web Audio. */
    get buses(): Buses | undefined { return setup(); },
    update(change: Partial<AudioSettings>) {
      settings = validAudioSettings({ ...settings, ...change });
      try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Storage is optional. */ }
      apply();
      listeners.forEach(listener => listener());
    },
    onChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    /** Lowers and muffles the music, e.g. while a menu is open. */
    duck(on: boolean, time = .25) {
      if (!buses) return;
      const at = buses.context.currentTime;
      buses.duck.gain.setTargetAtTime(on ? .45 : 1, at, time / 3);
      buses.muffle.frequency.setTargetAtTime(on ? 900 : 20000, at, time / 3);
    },
    /** Fetches and decodes a file under public/ once (e.g. `music/battle.m4a`). */
    load(src: string): Promise<AudioBuffer> {
      const bus = setup();
      if (!bus) return Promise.reject(new Error('Web Audio unavailable'));
      let buffer = buffers.get(src);
      if (!buffer) {
        buffer = fetch(`${import.meta.env.BASE_URL}${src}`)
          .then(response => { if (!response.ok) throw new Error(`${src}: ${response.status}`); return response.arrayBuffer(); })
          .then(data => bus.context.decodeAudioData(data));
        buffer.catch(() => buffers.delete(src));
        buffers.set(src, buffer);
      }
      return buffer;
    },
    destroy() {
      for (const event of events) window.removeEventListener(event, gesture, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
      clearInterval(padWatch);
      void buses?.context.close().catch(() => {});
    },
  };
}
