/**
 * The castle changes when a boss falls (docs/castle.md § The castle after each boss). Its three
 * stretches are the three phases: the patio, the first floor and the gym (Aurelià's); the second
 * floor and the secretaría (Mar, Montse and Pilar's); the third floor and the throne (hers).
 *
 * - **Behind a boss beaten, it is the school again.** His stretch is `won`: her gum is gone from it,
 *   its colours go quiet and its light is a plain day's. What is left of her clots round the one door
 *   that leads on, so the room itself says which way she went.
 * - **Ahead, she clenches.** Each boss beaten is a scream (`screams`), and every stretch still hers
 *   stands that much further from school: darker, more of her light, more gum on floors and walls.
 *
 * Pure: it turns a zone's theme into today's. The game builds what `story.place` hands it.
 */
import type { Environment } from './environments';
import { PALACE_GYM, PALACE_OFFICE, PALACE_PATIO, PALACE_THRONE, type ZoneTheme } from './palace-zone-plans.ts';
import { CASTLE_PHASES, type Cell, type Flags } from './castle.ts';

export interface CastleMood { won: boolean; screams: number; onward?: Cell }
/** The built zones of the school as they are drawn before any boss falls, and the phase whose boss holds each. */
const ZONES: Record<string, Environment> = { 'palacio-patio': PALACE_PATIO, 'palacio-gimnasio': PALACE_GYM, 'palacio-secretaria': PALACE_OFFICE, 'palacio-trono': PALACE_THRONE };
const STRETCH: Record<string, 1 | 2 | 3> = { 'palacio-patio': 1, 'palacio-gimnasio': 1, 'palacio-secretaria': 2, 'palacio-trono': 3 };
/** The door each won room leaves clotted: the way on to the next stretch. */
const ONWARD: Record<string, string> = { 'palacio-gimnasio': 'gimnasio-vestuarios', 'palacio-secretaria': 'secretaria-direccio' };
export const isCastleZone = (id: string) => Object.hasOwn(STRETCH, id);
/** How many bosses have fallen: each one is a scream of hers. */
export const screams = (flags: Flags) => CASTLE_PHASES.filter(p => p.boss !== 'reina' && flags.has(p.flag)).length;

/** How `environment` (a built zone of the school) stands with these flags; nothing for any other place. */
export function castleMood(flags: Flags, environment: Pick<Environment, 'id' | 'interactions'>): CastleMood | undefined {
  const stretch = STRETCH[environment.id];
  if (!stretch) return undefined;
  const won = flags.has(CASTLE_PHASES[stretch - 1].flag) || flags.has('reina'), next = CASTLE_PHASES[stretch];
  const door = won && next && !flags.has(next.flag) && !flags.has('reina') ? environment.interactions.find(i => i.id === ONWARD[environment.id]) : undefined;
  return { won, screams: flags.has('reina') ? 0 : screams(flags), ...door ? { onward: { ...door.cell } } : {} };
}

const channels = (hex: string) => [0, 1, 2].map(i => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16));
const toHex = (rgb: number[]) => `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: string, b: string, t: number) => { const x = channels(a), y = channels(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
/** A colour with `by` of its colour taken out: towards its own grey. */
export function quiet(hex: string, by: number) {
  const [r, g, b] = channels(hex), grey = .299 * r + .587 * g + .114 * b;
  return toHex([r, g, b].map(v => v + (grey - v) * by));
}
/**
 * What a stretch loses when it is the school again (`calm`: how much colour, and the plain light it
 * takes), and what each scream adds to one still hers (`dread`: how far its colours sink towards her
 * dark `sink`, how much of her light comes in, how much of the day's goes out).
 */
export const MOOD = {
  calm: { colour: .45, ambient: '#8b8e91', sun: '#f3f0e8', light: .6, intensity: 1.2 },
  dread: { sink: '#2a1026', colour: .1, her: .15, light: .1, ambient: '#6a3a5c' },
} as const;

/** `theme` as the castle stands today. Her own pink (`her` in the palette) is never touched: it is hers, or it is gone. */
export function moodTheme(theme: ZoneTheme, mood: CastleMood): ZoneTheme {
  const each = (change: (hex: string) => string) => ({
    palette: Object.fromEntries(Object.entries(theme.palette).map(([key, hex]) => [key, key === 'her' || !isHex(hex) ? hex : change(hex)])),
    materials: Object.fromEntries(Object.entries(theme.materials).map(([key, m]) => [key, m.tint && isHex(m.tint) ? { ...m, tint: change(m.tint) } : m])),
  });
  if (mood.won) {
    const { calm } = MOOD;
    return {
      ...theme, ...each(hex => quiet(hex, calm.colour)), her: 0, glow: quiet(theme.glow, calm.colour), mood,
      light: { ambient: mix(theme.light.ambient, calm.ambient, calm.light), sun: mix(theme.light.sun, calm.sun, calm.light), intensity: Math.max(theme.light.intensity, calm.intensity) },
    };
  }
  if (!mood.screams) return { ...theme, mood };
  const { dread } = MOOD, n = mood.screams;
  return {
    ...theme, ...each(hex => mix(hex, dread.sink, dread.colour * n)), her: Math.min(1, theme.her + dread.her * n), mood,
    light: { ambient: mix(theme.light.ambient, dread.ambient, dread.light * n), sun: theme.light.sun, intensity: theme.light.intensity * (1 - dread.light * n) },
  };
}
/** The built zone `id` as it stands with these flags: the same place, under today's theme. */
export function castleZone(flags: Flags, id: string): Environment {
  const environment = ZONES[id], mood = castleMood(flags, environment), theme = environment.palace!.theme!;
  return { ...environment, palace: { ...environment.palace!, theme: moodTheme(theme, mood!) } };
}
