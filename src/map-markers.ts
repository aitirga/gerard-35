/**
 * Icons on the network map (docs/barcelona.md § Markers): famous places, home, the castle on the
 * school, and later whatever the story adds. A marker is data (where, which icon, how big); an
 * icon is one cartoon drawing in `ICONS`. Adding a kind of marker is one entry there.
 * Markers show what is in the city, never what to do: no friend to visit, no "go here".
 * Pure: SVG strings, no DOM.
 */
import { CITY_MAP } from './transit.ts';

/** Where the cartoon outline and its colours come from (style.css draws nothing of its own here). */
const INK = '#3b2a20';
export interface MapMarker {
  id: string;
  icon: string;
  name: string;
  x: number;
  y: number;
  /** Size in icon units (1 = a landmark). */
  size?: number;
  /** For icons that change with the story: the castle's threat, 0 (tamed) to 1 (at its worst). */
  level?: number;
  /** Whether its name is written under it. */
  label?: boolean;
}

/**
 * Cartoon drawings in a 2 × 2 box around (0, 0), bottom at y = 1, with a thick dark outline.
 * `level` is the marker's own value (the castle's threat).
 */
export const ICONS: Record<string, (level: number) => string> = {
  temple: () => `<path fill="#e5c793" d="M-.95,1V-.1L-.75,-.9L-.55,-.1V1ZM-.4,1V-.6L-.15,-1.6L.1,-.6V1ZM.25,1V-.4L.5,-1.3L.75,-.4V1Z"/><path fill="#8fc46a" d="M-.15,-1.6L-.25,-1.85H-.05Z"/>`,
  tower: () => `<path fill="#4f8fd0" d="M-.5,1C-.65,0-.45,-1.1,0,-1.6C.45,-1.1,.65,0,.5,1Z"/><path fill="none" stroke="#e95a4f" stroke-width=".12" d="M-.48,.3H.48M-.45,-.3H.45"/>`,
  park: () => `<path fill="#7a5a3a" d="M-.12,1V.1H.12V1Z"/><circle fill="#7dbb5a" cx="0" cy="-.35" r=".75"/><circle fill="#f2a65a" cx=".3" cy="-.55" r=".14"/><circle fill="#5aa8e0" cx="-.3" cy="-.2" r=".12"/>`,
  wheel: () => `<circle fill="#fff4e0" cx="0" cy="-.3" r=".85"/><path fill="none" stroke="#d9473f" stroke-width=".1" d="M-.85,-.3H.85M0,-1.15V.55M-.6,-.9L.6,.3M.6,-.9L-.6,.3"/><path fill="#d9473f" d="M-.5,1L0,-.3L.5,1Z"/>`,
  castle: () => `<path fill="#c9bba2" d="M-.95,1V-.35H-.65V-.65H-.35V-.35H-.15V-.65H.15V-.35H.35V-.65H.65V-.35H.95V1Z"/><path fill="${INK}" d="M-.15,1V.45A.15,.15,0,0,1,.15,.45V1Z"/>`,
  stadium: () => `<ellipse fill="#a8324a" cx="0" cy=".2" rx="1" ry=".65"/><ellipse fill="#2f5aa8" cx="0" cy=".2" rx=".75" ry=".45"/><ellipse fill="#6fbf5a" cx="0" cy=".2" rx=".5" ry=".27"/>`,
  beach: () => `<path fill="#f5d98a" d="M-1,1Q0,.55,1,1Z"/><path fill="#ef6b5f" d="M-.95,-.3A.95,.8,0,0,1,.95,-.3Z"/><path fill="#fff" d="M-.3,-.3Q0,-1.05,.3,-.3Z"/><path fill="none" stroke="${INK}" stroke-width=".12" d="M0,-.3V.85"/>`,
  sun: () => `<circle fill="#ffd257" cx="0" cy="-.2" r=".6"/><path fill="none" stroke="#f2a33a" stroke-width=".14" stroke-linecap="round" d="M0,-1.15V-.95M0,.55V.75M-.95,-.2H-.75M.75,-.2H.95M-.67,-.87L-.53,-.73M.53,.33L.67,.47M.67,-.87L.53,-.73M-.53,.33L-.67,.47"/>`,
  arch: () => `<path fill="#c96b4a" d="M-.95,1V-.75H.95V1H.45V.1A.45,.45,0,0,0,-.45,.1V1Z"/><path fill="#e9c35a" d="M-.95,-.75H.95V-1H-.95Z"/>`,
  dome: () => `<path fill="#e98f5a" d="M-.85,1V.1H.85V1Z"/><path fill="#5fa6a0" d="M-.85,.1A.85,.9,0,0,1,.85,.1Z"/><path fill="${INK}" d="M-.2,1V.5H.2V1Z"/>`,
  home: () => `<path fill="#f7d26a" d="M-.75,1V-.05H.75V1Z"/><path fill="#d9473f" d="M-.95,0L0,-.9L.95,0Z"/><path fill="#ff7aa8" d="M0,.75C-.45,.4-.35,.05,0,.25C.35,.05,.45,.4,0,.75Z"/>`,
  school: () => `<path fill="#f2efe6" d="M-.95,1V-.2H.95V1Z"/><path fill="#e8742c" d="M-.95,-.2L0,-.75L.95,-.2Z"/><path fill="none" stroke="${INK}" stroke-width=".1" d="M0,-.75V-1.4"/><path fill="#e8742c" d="M0,-1.4H.45L.3,-1.25L.45,-1.1H0Z"/>`,
  /** Her power spreading over the city: a gooey pink stain with drips, as big as the marker's size. */
  spread: () => `<path class="map-spread" fill="#ff6fae" fill-opacity=".38" stroke-opacity=".5" d="M-1,0C-1,-.6-.6,-1,0,-1C.6,-1,1,-.55,1,0C1,.3,.85,.45,.75,.7C.7,.95,.55,.95,.5,.7C.4,.5,.25,.6,.2,.85C.15,1.05,0,1.05,-.05,.8C-.1,.55,-.3,.55,-.4,.75C-.5,.9,-.65,.9,-.7,.65C-.75,.4,-1,.35,-1,0Z"/>`,
  /**
   * La Reina Bubbaloo's castle: more and taller towers the stronger she is (`level`), a dark
   * storm over it at its worst. It loses towers as Gerard and Aitor help people.
   */
  bubbaloo: level => {
    const towers = 3 + Math.round(level * 6);
    const parts: string[] = [];
    if (level > .5) parts.push(`<ellipse class="map-storm" fill="#2c0d22" opacity="${(.35 + level * .4).toFixed(2)}" cx="0" cy="-1.55" rx="${1.3 + level * .6}" ry=".45"/>`);
    parts.push(`<circle class="map-halo" fill="#ff6fae" opacity=".3" cx="0" cy="-.3" r="${1.4 + level * .5}"/>`);
    for (let i = 0; i < towers; i++) {
      const k = towers === 1 ? 0 : i / (towers - 1) - .5, x = k * 1.9, h = 1.1 + (1 - Math.abs(k) * 1.6) * (.6 + level * .9);
      parts.push(`<path fill="${i % 2 ? '#d94a8c' : '#ff6fae'}" d="M${x - .16},1V${-h + .7}L${x},${-h + .25}L${x + .16},${-h + .7}V1Z"/>`);
    }
    parts.push(`<path fill="#ff6fae" d="M-1.05,1V.1H-.75V-.15H-.45V.1H.45V-.15H.75V.1H1.05V1Z"/><path fill="#6e2453" d="M-.3,1V.55A.3,.3,0,0,1,.3,.55V1Z"/>`);
    parts.push(`<circle fill="#ffe066" cx="0" cy="-1.0" r=".14"/>`);
    return parts.join('');
  },
};

/** Draws one marker at its place, `unit` metres per icon unit. */
export function renderMarker(m: MapMarker, unit: number): string {
  const draw = ICONS[m.icon] ?? ICONS.dome;
  const s = unit * (m.size ?? 1);
  const label = m.label ? `<text class="map-marker-name" x="0" y="${2.25}" font-size=".6">${escapeXml(m.name)}</text>` : '';
  return `<g class="map-marker" data-icon="${m.icon}" data-marker="${m.id}" transform="translate(${m.x} ${m.y}) scale(${s})"><g stroke="${INK}" stroke-width=".12" stroke-linejoin="round">${draw(m.level ?? 0)}</g>${label}<title>${escapeXml(m.name)}</title></g>`;
}
const escapeXml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * What the story tells the map: whether the castle has appeared, how threatening it is, and how
 * far her power has spread over the city (0 to 1, docs/chapter-2.md § The Queen's advance).
 */
export interface MarkerState { castle: boolean; threat: number; spread?: number }
/** Every marker for the city as the story stands: the landmarks, home, and the school or its castle. */
export function cityMarkers(state: MarkerState): MapMarker[] {
  const place = (id: string) => CITY_MAP.places.find(p => p.id === id)!;
  const school = place('rec-comtal'), home = place('home');
  return [
    ...CITY_MAP.landmarks.map(l => ({ id: l.id, icon: l.icon, name: l.name, x: l.x, y: l.y, label: true })),
    { id: 'home', icon: 'home', name: home.name, x: home.x, y: home.y, size: .9 },
    // Her pink spreads from the school towards home, day after day.
    ...(state.castle && state.spread ? [{ id: 'spread', icon: 'spread', name: 'El rosa de la Reina', x: school.x + (home.x - school.x) * state.spread * .35, y: school.y + (home.y - school.y) * state.spread * .35, size: 1.5 + state.spread * 6 }] : []),
    state.castle
      ? { id: 'castle', icon: 'bubbaloo', name: 'El castillo de la Reina Bubbaloo', x: school.x, y: school.y, size: 1.1 + state.threat * .6 + (state.spread ?? 0) * .8, level: state.threat }
      : { id: 'rec-comtal', icon: 'school', name: school.name, x: school.x, y: school.y, label: true },
  ];
}
