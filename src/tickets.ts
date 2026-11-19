/**
 * Memory tickets (docs/story-outline.md § Getting there): there is no money; a station opens when
 * Gerard writes, on the tablet in a station (`travel-ui.ts`), a memory of its person in its place.
 * The server judges it (`tickets.py`, `POST /api/transit/ticket`); what opens each station lives
 * in `tickets.json`, shared with it. Until then the station is on the map like any other, unmarked.
 */
import TICKETS from './tickets.json' with { type: 'json' };
import { STATIONS } from './transit.ts';

/** Stations open from the start: home's, and the school under the castle. */
export const OPEN_STATIONS: readonly string[] = TICKETS.open;
/** Every station a memory opens, in the order of `tickets.json`. */
export const TICKET_STATIONS = Object.keys(TICKETS.memories) as readonly TicketStation[];
export type TicketStation = keyof typeof TICKETS.memories;
/** The story flag a station's ticket sets (src/story.ts). */
export const ticketFlag = <S extends TicketStation>(station: S) => `ticket-${station}` as const;
export const isTicketStation = (station: string): station is TicketStation => station in TICKETS.memories;

/** The stations still without a ticket, given what the story has. */
export function lockedStations(has: (flag: ReturnType<typeof ticketFlag>) => boolean): TicketStation[] {
  return TICKET_STATIONS.filter(station => !has(ticketFlag(station)));
}

/**
 * What the server made of a memory: the station it points to, and whether its person and place are
 * right; a faraway station (Alegia) also asks for a moment with them (`moment`, true elsewhere).
 */
export interface Verdict { station: string | null; person: boolean; place: boolean; moment?: boolean }
/** A ticket printed: the station, or nothing yet. */
export const opens = (verdict: Verdict) => verdict.station && verdict.person && verdict.place && verdict.moment !== false && isTicketStation(verdict.station) ? verdict.station : undefined;

/** Asks the server; throws when it cannot be reached, so the tablet can say it reads nothing. */
export async function remember(text: string): Promise<Verdict> {
  const response = await fetch('/api/transit/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!response.ok) throw new Error(`ticket ${response.status}`);
  const { station, person, place, moment } = await response.json() as Verdict;
  return { station, person, place, ...moment === false ? { moment } : {} };
}

/**
 * What the machine answers, in the world: a ticket, half a ticket, or a blank one. It never says
 * what is missing beyond someone or somewhere.
 */
export function answer(verdict: Verdict | undefined, already = false): string {
  if (!verdict) return 'La pantalla parpadea. Ahora mismo no lee nada.';
  const station = opens(verdict);
  if (station) return already ? `Ese recuerdo ya es un billete: ${STATIONS[station].name}.` : `Billete impreso: ${STATIONS[station].name}.`;
  // Someone and somewhere, but a faraway place asks for more of that day.
  if (verdict.person && verdict.place && verdict.moment === false) return 'Tan lejos no llega un recuerdo así. Tiene que estar más vivo.';
  if (verdict.person) return 'Te acuerdas de quién. No de dónde.';
  if (verdict.place) return 'Un sitio sin nadie no lleva a ningún sitio.';
  return 'El billete sale en blanco.';
}
