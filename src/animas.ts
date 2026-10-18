/**
 * Ánimas: what the status screen calls the party's classes (docs/party.md). Their look and stats
 * live in classes.ts and battle.ts; this is only the part each member can personalise, the colour
 * of the scarf the ánima ties at their neck. Pure: no DOM, no engine.
 */
import type { ClassId } from './battle';

export const SCARVES = {
  rojo: { name: 'Rojo NO', colour: '#e2483d' },
  mostaza: { name: 'Mostaza', colour: '#e9ad48' },
  noche: { name: 'Azul noche', colour: '#3d5a8a' },
  pino: { name: 'Verde pino', colour: '#4f7d58' },
  tinta: { name: 'Tinta', colour: '#23202a' },
} as const satisfies Record<string, { name: string; colour: string }>;
export type ScarfId = keyof typeof SCARVES;
export const SCARF_IDS = Object.keys(SCARVES) as ScarfId[];
/** The scarf an ánima comes with, until someone picks another. */
export const DEFAULT_SCARF: Record<ClassId, ScarfId> = { noista: 'rojo' };
export const isScarf = (value: unknown): value is ScarfId => typeof value === 'string' && value in SCARVES;
