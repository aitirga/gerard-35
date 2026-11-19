/**
 * The day log (docs/day-log.md): what Gerard does each day, sent to the server in batches and
 * kept there for a future boss made of his own routine (`daylog.py` writes each day's summary).
 * Nothing of it is shown in the game. Pure: the clock, the sending and the time are given.
 */

/** When it happened: the game's clock (src/days.ts) and the real one (ms). */
export interface Stamp { epoch: number; day: number; hour: number }
export type LogEntry =
  /** Visible seconds spent in a place, sent on leaving it, when the page is hidden or the day changes. */
  | { kind: 'place'; place: string; seconds: number }
  /** Down into a station: where to, or back up the stairs (null). */
  | { kind: 'ride'; start: string; to: string | null }
  /** A memory typed on a station's tablet and the judge's verdict (src/tickets.ts). */
  | { kind: 'memory'; text: string; station: string | null; person: boolean; place: boolean }
  | { kind: 'flag'; flag: string }
  /** A fight over: how it ended, its rounds and the party's moves (skill or action → times). */
  | { kind: 'fight'; encounter: string; outcome: 'won' | 'lost' | 'escaped'; rounds: number; moves: Record<string, number>; worn: string[] };
export type LogEvent = LogEntry & Stamp & { at: number };

/** At most this many events a request (the server takes 100), and kept while it cannot be reached. */
const BATCH = 100, KEPT = 1000;

export interface DayLog {
  /** Something happened, now or at `stamp` (a moment already passed, e.g. before a day ended). */
  add(entry: LogEntry, stamp?: Stamp): void;
  /** The clock now, to stamp several entries with the moment before something changed it. */
  stamp(): Stamp;
  /** Gerard is in `place` from now on. */
  enter(place: string): void;
  /** The page is hidden (time stops counting) or shown again. */
  visible(shown: boolean): void;
  /** After the story moved: a new day closes the time spent in the place on the day before. */
  tick(): void;
  /** Sends what is waiting; `leaving`: the page is going away (the request outlives it). */
  flush(leaving?: boolean): Promise<void>;
  readonly waiting: readonly LogEvent[];
}

export function createDayLog(clock: () => Stamp, send: (events: LogEvent[], leaving: boolean) => Promise<boolean>, now = () => Date.now()): DayLog {
  let queue: LogEvent[] = [];
  let place: string | undefined, since: number | undefined, last = clock();
  let sending = false, timer: ReturnType<typeof setTimeout> | undefined;
  const stamp = (): Stamp => { const { epoch, day, hour } = clock(); return { epoch, day, hour }; };
  const sameDay = (a: Stamp, b: Stamp) => a.epoch === b.epoch && a.day === b.day;
  function push(entry: LogEntry, at: Stamp) {
    queue.push({ ...entry, ...at, at: now() });
    if (queue.length > KEPT) queue = queue.slice(-KEPT);
    clearTimeout(timer);
    timer = setTimeout(() => { void log.flush(); }, 5000);
  }
  /** The time in the current place so far, on `at`'s day. */
  function close(at: Stamp) {
    if (place !== undefined && since !== undefined) {
      const seconds = Math.round((now() - since) / 1000);
      if (seconds > 0) push({ kind: 'place', place, seconds: Math.min(seconds, 86400) }, at);
    }
    since = undefined;
  }
  const log: DayLog = {
    add(entry, at) { log.tick(); push(entry, at ?? stamp()); },
    stamp,
    enter(next) { log.tick(); close(stamp()); place = next; since = now(); },
    visible(shown) {
      log.tick();
      if (shown) { if (since === undefined) since = now(); } else close(stamp());
    },
    tick() {
      const current = stamp();
      if (sameDay(current, last)) { last = current; return; }
      const running = since !== undefined;
      close(last);
      if (running) since = now();
      last = current;
    },
    async flush(leaving = false) {
      clearTimeout(timer);
      if (sending || !queue.length) return;
      sending = true;
      const batch = queue.slice(0, BATCH);
      try {
        if (await send(batch, leaving)) queue = queue.slice(batch.length);
      } catch { /* Kept for the next try. */ } finally { sending = false; }
      if (queue.length && !leaving) timer = setTimeout(() => { void log.flush(); }, queue.length > BATCH ? 0 : 30000);
    },
    get waiting() { return queue; },
  };
  return log;
}

/** The server's side: POST /api/log (server.py). */
export async function sendLog(events: LogEvent[], leaving: boolean): Promise<boolean> {
  const response = await fetch('/api/log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }),
    keepalive: leaving, signal: AbortSignal.timeout(8000),
  });
  return response.ok || response.status === 422;
}
