/** Meridiana's double bed, in the same grid coordinates as its solid furniture tiles. */
export const MERIDIANA_BED = {
  x: 10.5, z: 15.27, width: 2, length: 3, headZ: 16.77,
  duvetTop: .74,
  sleepers: {
    gerard: { scale: 1.26, rest: { x: 11, z: 15 }, height: .93, side: { x: 12, z: 15 }, stand: { x: 12, z: 13 } },
    aitor: { scale: 1.38, rest: { x: 10, z: 14.94 }, height: .96, side: { x: 9, z: 15 }, stand: { x: 9, z: 14 } },
  },
} as const;

export type Sleeper = keyof typeof MERIDIANA_BED.sleepers;
export const WAKE_SECONDS = 4.8;
/** Both are sitting up and awake: the story talks here before they get out of bed (`rise`). */
export const SITTING_SECONDS = 2.2;
export function wakePhase(seconds: number) {
  return seconds < .9 ? 'asleep' : seconds < 1.5 ? 'startle' : seconds < 1.65 ? 'gerard-awake' : seconds < 2.2 ? 'aitor-awake' : seconds < 3.55 ? 'getting-out' : seconds < 4.55 ? 'walking' : 'standing';
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function progress(seconds: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (seconds - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/** Absolute poses: replaying a frame never uses a model's previous, already rotated position. */
export function wakePose(who: Sleeper, seconds: number) {
  const sleeper = MERIDIANA_BED.sleepers[who], gerard = who === 'gerard';
  const sit = progress(seconds, gerard ? .9 : 1.5, gerard ? 1.5 : 2.2);
  const slide = progress(seconds, gerard ? 2.2 : 2.4, gerard ? 2.85 : 3.05);
  const lower = progress(seconds, gerard ? 2.85 : 3.05, gerard ? 3.3 : 3.5);
  const walk = progress(seconds, 3.55, 4.55);
  // Sit up round the hips, keeping the legs on the mattress until they swing over its side.
  const hip = .48 * sleeper.scale, angle = sit * Math.PI / 2;
  const seatedZ = sleeper.rest.z + hip * (1 - Math.cos(angle));
  return {
    x: lerp(sleeper.rest.x, sleeper.side.x, slide),
    z: lerp(lerp(seatedZ, sleeper.side.z, slide), sleeper.stand.z, walk),
    y: lerp(sleeper.height - hip * Math.sin(angle), 0, lower),
    pitch: 90 * (1 - sit),
    yaw: lerp(lerp(180, gerard ? 90 : 270, slide), 180, walk),
    leg: -90 * sit * (1 - lower),
    eyes: progress(seconds, gerard ? .9 : 1.5, gerard ? 1.02 : 1.7),
    walking: seconds > 3.55 && seconds < 4.55,
    grounded: lower === 1,
  };
}
