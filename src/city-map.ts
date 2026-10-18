/**
 * Barcelona drawn schematically (docs/barcelona.md): sea, hills, rivers, districts, avenues,
 * landmarks and the metro and Rodalies lines, as an SVG string. Used by the station map
 * (`travel-ui.ts`) and the TV news (`news-ui.ts`). Looks live in style.css (.city-*).
 */
import { CITY_MAP, LINES, STATIONS, type Leg } from './transit';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const path = (points: number[][], close = true) => `M${points.map(([x, y]) => `${x},${y}`).join('L')}${close ? 'Z' : ''}`;
/** A rectangle of the map, in map metres. */
export interface View { x0: number; y0: number; x1: number; y1: number }
export const CITY_VIEW: View = (() => {
  // Where the lines run, plus air for the names and the tabs of stations beyond the map.
  const inside = CITY_MAP.stations.filter(s => !s.offmap);
  const xs = inside.map(s => s.x), ys = inside.map(s => s.y);
  return { x0: Math.min(...xs) - 1300, y0: Math.min(...ys) - 1100, x1: Math.max(...xs) + 2200, y1: Math.max(...ys) + 1500 };
})();
/** Where a station beyond the view sits on its edge: on the way to it from the line's previous station. */
function onEdge(view: View, from: { x: number; y: number }, to: { x: number; y: number }, inset: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const t = Math.min(1,
    dx > 0 ? (view.x1 - inset - from.x) / dx : dx < 0 ? (view.x0 + inset - from.x) / dx : Infinity,
    dy > 0 ? (view.y1 - inset - from.y) / dy : dy < 0 ? (view.y0 + inset - from.y) / dy : Infinity);
  return { x: from.x + dx * t, y: from.y + dy * t };
}
/** A square view of `radius` metres around a landmark, e.g. the school for the TV. */
export function around(landmark: string, radius: number): View {
  const l = CITY_MAP.landmarks.find(m => m.id === landmark)!;
  return { x0: l.x - radius * 1.6, y0: l.y - radius, x1: l.x + radius * 1.6, y1: l.y + radius };
}
/** Stations the map always names: the big interchanges. */
const NAMED = new Set(['catalunya', 'passeig-de-gracia', 'sants-estacio', 'espanya', 'la-sagrera', 'clot', 'diagonal', 'sagrada-familia', 'trinitat-nova', 'glories', 'paral-lel', 'verdaguer']);

/** Small pictograms for landmarks, drawn in a 2 × 2 box around (0, 0). */
const PICTOGRAMS: Record<string, string> = {
  temple: 'M-.7,1V-.2L-.5,-1L-.3,-.2V1ZM-.25,1V-.6L0,-1.6L.25,-.6V1ZM.3,1V-.2L.5,-1L.7,-.2V1Z',
  tower: 'M-.45,1C-.6,0-.4,-1.2,0,-1.6C.4,-1.2,.6,0,.45,1Z',
  park: 'M0,1V.2M-.8,.2A.8,.8,0,1,1,.8,.2Z',
  wheel: 'M-.8,-.2A.8,.8,0,1,0,.8,-.2A.8,.8,0,1,0,-.8,-.2ZM0,-.2V1M-.5,1H.5',
  castle: 'M-.9,1V-.4H-.6V-.7H-.3V-.4H.3V-.7H.6V-.4H.9V1Z',
  stadium: 'M-1,0A1,.6,0,1,0,1,0A1,.6,0,1,0,-1,0Z',
  beach: 'M0,1V-.6M-.9,-.4A.9,.7,0,0,1,.9,-.4Z',
  sun: 'M-1,.3H1L.8,.6H-.8ZM0,-.9A.6,.6,0,1,0,0,.3A.6,.6,0,1,0,0,-.9Z',
  arch: 'M-.9,1V-.9H.9V1H.4V0A.4,.4,0,0,0,-.4,0V1Z',
  dome: 'M-.8,1V0A.8,.8,0,0,1,.8,0V1Z',
  school: 'M-.9,1V-.2L0,-.9L.9,-.2V1ZM-.25,1V.3H.25V1Z',
  home: 'M-.8,1V-.1L0,-.8L.8,-.1V1Z',
};

/** La Reina Bubbaloo's castle over the Rec Comtal school, `s` metres per unit. */
function castle(s: number) {
  const school = CITY_MAP.landmarks.find(l => l.id === 'rec-comtal')!;
  return `<g class="city-castle" transform="translate(${school.x} ${school.y - s * .4}) scale(${s})"><circle class="city-castle-halo" r="1.9"/>`
    + `<path d="M-1.2,1V-.2H-.8V-1.1A.25,.25,0,0,1,-.3,-1.1V-.2H-.2V-1.5L0,-2.1L.2,-1.5V-.2H.3V-1.1A.25,.25,0,0,1,.8,-1.1V-.2H1.2V1Z"/>`
    + `<circle class="city-castle-ball" cx="0" cy="-2.15" r=".22"/><circle class="city-castle-ball" cx="-.55" cy="-1.3" r=".18"/><circle class="city-castle-ball" cx=".55" cy="-1.3" r=".18"/></g>`;
}
export interface CityMapOptions {
  view?: View;
  /** Where Gerard is: a pin on that station. */
  current?: string;
  /** Stations that can be picked, and the one picked now. */
  selectable?: readonly string[];
  selected?: string;
  /** The castle has appeared over the Rec Comtal school (after the TV news). */
  castle?: boolean;
  /** The trip being made, highlighted on top of its lines. */
  route?: readonly Leg[];
  /** `news`: an aerial look for the TV, with neighbourhood borders and no station names. */
  style?: 'station' | 'news';
  label?: string;
}

export function renderCityMap(options: CityMapOptions = {}): string {
  const v = options.view ?? CITY_VIEW, w = v.x1 - v.x0, h = v.y1 - v.y0;
  const unit = Math.max(w, h) / 160;
  const news = options.style === 'news';
  const selectable = new Set(options.selectable ?? []);
  const lineWidth = (kind: string) => kind === 'metro' ? unit * (news ? 1.2 : 1.6) : unit * (news ? .9 : 1.1);
  // Stations beyond the map come to its edge, along their line.
  const edge = new Map<string, { x: number; y: number }>();
  for (const line of LINES) line.stations.forEach((id, i) => { if (STATIONS[id].offmap && i) edge.set(id, onEdge(v, STATIONS[line.stations[i - 1]], STATIONS[id], unit * 8)); });
  const at = (id: string) => ({ ...STATIONS[id], ...edge.get(id) });
  const parts: string[] = [];
  parts.push(`<rect class="city-land" x="${v.x0}" y="${v.y0}" width="${w}" height="${h}"/>`);
  parts.push(`<path class="city-sea" d="${path(CITY_MAP.sea)}"/>`);
  for (const d of CITY_MAP.districts) parts.push(`<path class="city-district" d="${path(d.poly)}" stroke-width="${unit * .35}"/>`);
  if (news) for (const b of CITY_MAP.barris) parts.push(`<path class="city-barri${b.name === 'la Trinitat Vella' ? ' is-here' : ''}" d="${path(b.poly)}" stroke-width="${unit * .25}"/>`);
  for (const hill of CITY_MAP.hills) parts.push(`<path class="city-hill" d="${path(hill.poly)}"/>`);
  for (const r of CITY_MAP.rivers) parts.push(`<path class="city-river" d="${path(r.line, false)}" stroke-width="${unit * 1.1}"/>`);
  for (const a of CITY_MAP.avenues) parts.push(`<path class="city-avenue" d="${path(a.line, false)}" stroke-width="${unit * (.35 + a.size * .3)}"><title>${escape(a.name)}</title></path>`);
  if (news) for (const a of [...CITY_MAP.avenues, ...CITY_MAP.rivers]) {
    const inView = a.line.filter(([x, y]) => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1);
    if (inView.length < 1) continue;
    const [x, y] = inView[Math.floor(inView.length / 2)];
    parts.push(`<text class="city-news-label${'size' in a ? '' : ' is-river'}" x="${x}" y="${y}" font-size="${unit * 2.2}">${escape(a.name.toUpperCase())}</text>`);
  }
  if (news) for (const b of CITY_MAP.barris) {
    if (b.name !== 'la Trinitat Vella') continue;
    const cx = b.poly.reduce((s, p) => s + p[0], 0) / b.poly.length, cy = b.poly.reduce((s, p) => s + p[1], 0) / b.poly.length;
    parts.push(`<text class="city-news-label is-barri" x="${cx}" y="${cy + unit * 9}" font-size="${unit * 2.8}">TRINITAT VELLA</text>`);
  }
  if (!news) for (const d of CITY_MAP.districts) {
    const cx = d.poly.reduce((s, p) => s + p[0], 0) / d.poly.length, cy = d.poly.reduce((s, p) => s + p[1], 0) / d.poly.length;
    parts.push(`<text class="city-district-name" x="${cx}" y="${cy}" font-size="${unit * 1.5}">${escape(d.name.toUpperCase())}</text>`);
  }
  for (const l of CITY_MAP.landmarks) {
    if (l.id === 'rec-comtal' && options.castle) continue;
    const s = unit * (news ? 1.6 : 1.3);
    parts.push(`<g class="city-landmark" data-kind="${l.kind}" transform="translate(${l.x} ${l.y}) scale(${s})"><path d="${PICTOGRAMS[l.kind] ?? PICTOGRAMS.dome}" stroke-width="${.18}"/><title>${escape(l.name)}</title></g>`);
    if (!news) parts.push(`<text class="city-landmark-name" x="${l.x}" y="${l.y + s * 2.3}" font-size="${unit * 1.15}">${escape(l.name)}</text>`);
  }
  // Lines: Rodalies as a double stroke under the metro; the part a story extended is dashed.
  for (const line of [...LINES].sort((a, b) => (a.kind === 'rodalies' ? 0 : 1) - (b.kind === 'rodalies' ? 0 : 1))) {
    const pts = line.stations.map(id => [at(id).x, at(id).y]);
    const width = lineWidth(line.kind);
    const extended = line.extension?.length ? line.stations.findIndex(s => line.extension!.includes(s)) : -1;
    const main = extended > 0 ? pts.slice(0, extended) : pts, extra = extended > 0 ? pts.slice(extended - 1) : [];
    if (line.kind === 'rodalies') {
      parts.push(`<path class="city-line rodalies" d="${path(main, false)}" stroke="${line.colour}" stroke-width="${width}"/><path class="city-line-core" d="${path(main, false)}" stroke-width="${width * .4}"/>`);
      if (extra.length) parts.push(`<path class="city-line rodalies is-new" d="${path(extra, false)}" stroke="${line.colour}" stroke-width="${width}" stroke-dasharray="${width * 1.6} ${width}"/>`);
    } else parts.push(`<path class="city-line metro" d="${path(main, false)}" stroke="${line.colour}" stroke-width="${width}"><title>${line.name}</title></path>`);
  }
  if (options.route?.length) for (const leg of options.route) {
    const line = LINES.find(l => l.id === leg.line)!;
    parts.push(`<path class="city-route" d="${path(leg.stations.map(id => [at(id).x, at(id).y]), false)}" stroke="${line.colour}" stroke-width="${lineWidth(line.kind) * 2.1}"/>`);
  }
  // Stations: interchanges as white rings, the rest as small ticks; destinations glow.
  const counts = new Map<string, number>();
  for (const line of LINES) for (const id of line.stations) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (options.castle) parts.push(castle(unit * (news ? 3.4 : 2.2)));
  for (const s of Object.values(STATIONS).map(st => at(st.id))) {
    const pickable = selectable.has(s.id), here = options.current === s.id, chosen = options.selected === s.id;
    const r = unit * (pickable || here ? 1.5 : (counts.get(s.id) ?? 1) > 1 ? 1.05 : .62);
    const name = !news && (pickable || here || NAMED.has(s.id) || s.offmap);
    if (s.offmap) {
      // A station beyond the map: a tab on the edge, pointing away.
      const line = LINES.find(l => l.stations.includes(s.id))!;
      parts.push(`<g class="city-offmap${pickable ? ' is-pickable' : ''}${chosen ? ' is-selected' : ''}" data-station="${s.id}"><rect x="${s.x - unit * 6}" y="${s.y - unit * 1.8}" width="${unit * 12}" height="${unit * 3.6}" rx="${unit * 1.8}" fill="${line.colour}"/><text x="${s.x}" y="${s.y + unit * .55}" font-size="${unit * 1.6}">${escape(s.name)} →</text></g>`);
      continue;
    }
    parts.push(`<g class="city-station${pickable ? ' is-pickable' : ''}${here ? ' is-here' : ''}${chosen ? ' is-selected' : ''}" data-station="${s.id}">`
      + `${pickable ? `<circle class="city-station-glow" cx="${s.x}" cy="${s.y}" r="${r * 2.2}"/>` : ''}`
      + `<circle cx="${s.x}" cy="${s.y}" r="${r}" stroke-width="${r * .38}"/>`
      + `${name ? `<text x="${s.x + r * 1.6}" y="${s.y + unit * .5}" font-size="${unit * (pickable || here ? 1.55 : 1.15)}">${escape(s.name)}</text>` : ''}<title>${escape(s.name)}</title></g>`);
  }
  if (options.current) {
    const s = at(options.current);
    parts.push(`<g class="city-pin" transform="translate(${s.x} ${s.y})"><path d="M0,0L${-unit * 1.5},${-unit * 3}A${unit * 1.9},${unit * 1.9},0,1,1,${unit * 1.5},${-unit * 3}Z"/><text y="${-unit * 3.6}" font-size="${unit * 1.7}">G</text></g>`);
  }
  return `<svg class="city-map${news ? ' is-news' : ''}" viewBox="${v.x0} ${v.y0} ${w} ${h}" preserveAspectRatio="xMidYMid ${news ? 'slice' : 'meet'}" role="img" aria-label="${escape(options.label ?? 'Plano de Barcelona con las líneas de metro y Rodalies')}">${parts.join('')}</svg>`;
}
