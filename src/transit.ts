/**
 * Metro and Rodalies (docs/barcelona.md): the lines and stations of the network map, which
 * stations lead to a playable place, and the route a train takes between two of them.
 * Pure: no DOM, no engine. The drawing is `src/city-map.ts`, the trip `src/travel-ui.ts`.
 */
import CITY from './geo/barcelona.json' with { type: 'json' };
import type { EnvironmentId } from './environments';

export type LineKind = 'metro' | 'rodalies';
export interface Line { id: string; name: string; kind: LineKind; colour: string; stations: string[] }
/** `edge`: a town beyond the map (Cardedeu), waiting at its border on the way there. */
export interface Station { id: string; name: string; x: number; y: number; edge?: boolean }
type Points = number[][];
/** The cartoon city (tools/city.py): hand-drawn layers in metres, on a map with the sea at the bottom. */
export interface CityMap {
  extent: { x0: number; y0: number; x1: number; y1: number };
  coast: Points;
  sea: Points;
  hills: { id: string; name: string; poly: Points }[];
  rivers: { id: string; name: string; line: Points }[];
  districts: { id: string; name: string; colour: string; pattern?: string; poly: Points }[];
  avenues: { id: string; name: string; size: number; line: Points }[];
  /** The real city drawn in 3D from OpenStreetMap (`just city-fetch`), an image under the lines. */
  background?: { x0: number; y0: number; x1: number; y1: number; href: string };
  /** Famous places, drawn as icons (`src/map-markers.ts`). */
  landmarks: { id: string; name: string; icon: string; x: number; y: number }[];
  /** Places the story puts icons on (home, the school). */
  places: { id: string; name: string; x: number; y: number }[];
  stations: Station[];
  lines: Line[];
}
export const CITY_MAP = CITY as CityMap;
export const LINES: readonly Line[] = CITY_MAP.lines;
export const STATIONS: Readonly<Record<string, Station>> = Object.fromEntries(CITY_MAP.stations.map(s => [s.id, s]));

/**
 * Stations that lead somewhere: the scene, and the id of the station entrance in it (an
 * interaction `station-<id>`) where the party comes up and goes back down.
 */
export const STATION_PLACES: Readonly<Record<string, { environment: EnvironmentId }>> = {
  'fabra-i-puig': { environment: 'meridiana-calle' },
  'trinitat-vella': { environment: 'rec-comtal' },
  cardedeu: { environment: 'cardedeu' },
  'sagrada-familia': { environment: 'sagrada-familia' },
};
/** The interaction in a place that is the station's entrance. */
export const entranceId = (station: string) => `station-${station}`;
/** Which station an interaction is the entrance of, if any. */
export const stationOf = (interactionId: string) => interactionId.startsWith('station-') && STATIONS[interactionId.slice(8)] ? interactionId.slice(8) : undefined;

export function linesAt(station: string): Line[] { return LINES.filter(l => l.stations.includes(station)); }

/** What the story can close: whole lines (a gum-blocked tunnel) and single stations. */
export interface Closures { lines?: readonly string[]; stations?: readonly string[] }

/** Stations the party can travel to from `from`: open, with a place, reachable, not where they are. */
export function destinations(from: string, closures: Closures = {}): string[] {
  return Object.keys(STATION_PLACES).filter(id => id !== from && !closures.stations?.includes(id) && route(from, id, closures));
}

export interface Leg { line: string; stations: string[] }
/**
 * The trip from `from` to `to`, one leg per line: the fewest stops, with each change of line
 * counting as four stops so trains prefer to stay on. Undefined when there is no way.
 */
export function route(from: string, to: string, closures: Closures = {}): Leg[] | undefined {
  if (!STATIONS[from] || !STATIONS[to]) return undefined;
  if (from === to) return [];
  const open = LINES.filter(l => !closures.lines?.includes(l.id));
  const shut = (s: string) => s !== from && s !== to && !!closures.stations?.includes(s);
  type Node = { station: string; line: string };
  const key = (n: Node) => `${n.station}|${n.line}`;
  const cost = new Map<string, number>(), back = new Map<string, string>();
  const queue: { node: Node; cost: number }[] = [];
  for (const line of open) if (line.stations.includes(from)) { const n = { station: from, line: line.id }; cost.set(key(n), 0); queue.push({ node: n, cost: 0 }); }
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { node, cost: c } = queue.shift()!;
    if (c > (cost.get(key(node)) ?? Infinity)) continue;
    if (node.station === to) {
      // Walk back to the start, then split the stops into one leg per line.
      const path: Node[] = [node];
      for (let k = key(node); back.has(k); k = back.get(k)!) { const [station, line] = back.get(k)!.split('|'); path.unshift({ station, line }); }
      const legs: Leg[] = [];
      for (const step of path) {
        const leg = legs.at(-1);
        if (leg?.line === step.line) { if (leg.stations.at(-1) !== step.station) leg.stations.push(step.station); }
        else legs.push({ line: step.line, stations: leg ? [leg.stations.at(-1)!] : [step.station] });
      }
      return legs.filter(l => l.stations.length > 1);
    }
    const line = open.find(l => l.id === node.line)!;
    const i = line.stations.indexOf(node.station);
    const next: { node: Node; cost: number }[] = [i - 1, i + 1]
      .filter(j => j >= 0 && j < line.stations.length && !shut(line.stations[j]))
      .map(j => ({ node: { station: line.stations[j], line: line.id }, cost: c + 1 }));
    if (!shut(node.station)) for (const other of open) if (other.id !== line.id && other.stations.includes(node.station)) next.push({ node: { station: node.station, line: other.id }, cost: c + 4 });
    for (const n of next) {
      if (n.cost >= (cost.get(key(n.node)) ?? Infinity)) continue;
      cost.set(key(n.node), n.cost); back.set(key(n.node), key(node)); queue.push(n);
    }
  }
  return undefined;
}
