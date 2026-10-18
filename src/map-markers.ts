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
  /** How far a halo round it spreads, in icon units (the Queen's power over the city). */
  reach?: number;
  /** Whether its name is written under it. */
  label?: boolean;
}

/** A face in shade: the side of a volume turned away from the light, no outline of its own. */
const shade = (d: string, fill: string) => `<path fill="${fill}" stroke="none" d="${d}"/>`;
/** A spire of the Sagrada Família: a tall rounded cone, its right half in shade, a coloured fruit on top. */
function spire(x: number, w: number, top: number, fruit: string) {
  return `<path fill="#ead2a0" d="M${x - w},1L${x - w * .3},${top + .35}Q${x},${top - .05},${x + w * .3},${top + .35}L${x + w},1Z"/>`
    + shade(`M${x},1V${top + .12}Q${x + .1 * w},${top + .2},${x + w * .3},${top + .35}L${x + w},1Z`, '#c9a46a')
    + `<circle fill="${fruit}" cx="${x}" cy="${top}" r=".09"/>`;
}

/**
 * Cartoon drawings in a 2 × 2 box around (0, 0), bottom at y = 1, with a thick dark outline.
 * Each is a small abstract volume lit from the left, the same 3D as the city's blocks.
 * `level` is the marker's own value (the castle's threat), `reach` how far its halo spreads.
 */
export const ICONS: Record<string, (level: number, reach: number) => string> = {
  /** Sagrada Família: a cluster of spires, the tallest in the middle. */
  temple: () => [spire(0, .22, -2.05, '#ffd257'), spire(-.32, .2, -1.65, '#ef6b5f'), spire(.32, .2, -1.65, '#8fc46a'), spire(-.68, .22, -1.05, '#5aa8e0'), spire(.68, .22, -1.05, '#ef6b5f')].join('')
    + `<path fill="#ead2a0" d="M-.95,1V.35H.95V1Z"/>${shade('M.35,1V.35H.95V1Z', '#c9a46a')}<path fill="#3b2a20" d="M-.15,1V.62A.15,.15,0,0,1,.15,.62V1Z"/>`,
  /** Torre Glòries: a rounded bullet dotted with coloured windows. */
  tower: () => `<path fill="#5aa0dc" d="M-.5,1V-.55C-.5,-1.45,.5,-1.45,.5,-.55V1Z"/>${shade('M.12,1V-1.2C.38,-1.08,.5,-.85,.5,-.55V1Z', '#2f6aa8')}`
    + [[-.3, .55, '#ef6b5f'], [.05, .55, '#ffd257'], [-.3, .1, '#ffd257'], [.25, .15, '#ef6b5f'], [-.05, -.3, '#9fdcf0'], [-.3, -.7, '#ef6b5f'], [.2, -.65, '#9fdcf0']]
      .map(([x, y, c]) => `<rect fill="${c}" stroke="none" x="${x}" y="${y}" width=".14" height=".2" rx=".03"/>`).join(''),
  /** Park Güell: a green mound crossed by the mosaic bench and a gatehouse with a frosted roof. */
  park: () => `<path fill="#86c260" d="M-1,1Q-.95,-.35,0,-.4Q.95,-.35,1,1Z"/>${shade('M.25,1V-.34Q.95,-.2,1,1Z', '#5f9a4a')}`
    + `<path fill="none" stroke-width=".3" stroke-linecap="round" d="M-.75,.6C-.45,.15,-.1,.85,.25,.4S.65,.05,.85,.45"/><path fill="none" stroke="#5aa8e0" stroke-width=".16" stroke-linecap="round" d="M-.75,.6C-.45,.15,-.1,.85,.25,.4S.65,.05,.85,.45"/><path fill="none" stroke="#ffd257" stroke-width=".16" stroke-dasharray=".1 .14" d="M-.75,.6C-.45,.15,-.1,.85,.25,.4S.65,.05,.85,.45"/>`
    + `<path fill="#e9b88a" d="M-.62,.25V-.45H-.22V.25Z"/><path fill="#fff4e0" d="M-.75,-.4Q-.42,-1.15,-.09,-.4Z"/><circle fill="#ef6b5f" stroke="none" cx="-.42" cy="-.62" r=".07"/>`,
  /** Tibidabo: the little Ferris wheel with its coloured cabins. */
  wheel: () => `<path fill="#d9473f" d="M-.55,1L0,-.45L.55,1H.35L0,.1L-.35,1Z"/><circle fill="#fff4e0" cx="0" cy="-.45" r=".78"/><path fill="none" stroke-width=".07" d="M-.78,-.45H.78M0,-1.23V.33M-.55,-1L.55,.1M.55,-1L-.55,.1"/>`
    + ['#ef6b5f', '#ffd257', '#5aa8e0', '#8fc46a', '#ef6b5f', '#ffd257', '#5aa8e0', '#8fc46a'].map((c, i) => `<circle fill="${c}" cx="${(Math.cos(i * Math.PI / 4) * .78).toFixed(2)}" cy="${(-.45 + Math.sin(i * Math.PI / 4) * .78).toFixed(2)}" r=".14"/>`).join(''),
  /** Montjuïc: a low fortress seen from above the front, a flag on top. */
  castle: () => `<path fill="#ddd2bd" d="M-.95,-.05L-.55,-.4H.95L.55,-.05Z"/><path fill="#c9bba2" d="M-.95,1V-.05H.55V1Z"/>${shade('M.55,1V-.05L.95,-.4V.7Z', '#a3937a')}`
    + `<path fill="#c9bba2" d="M-.95,-.05V-.28H-.7V-.05ZM-.45,-.05V-.28H-.2V-.05ZM.05,-.05V-.28H.3V-.05Z"/><path fill="#3b2a20" d="M-.35,1V.5A.15,.15,0,0,1,-.05,.5V1Z"/>`
    + `<path fill="none" stroke-width=".07" d="M.2,-.32V-1.3"/><path fill="#ffd257" d="M.2,-1.3H.75L.62,-1.12L.75,-.95H.2Z"/><path fill="none" stroke="#d9473f" stroke-width=".05" d="M.24,-1.2H.62M.24,-1.05H.62"/>`,
  /** Camp Nou: a bowl in blue and claret stripes round a green pitch. */
  stadium: () => {
    // The wall's bottom edge follows the bowl: the lower half of an ellipse, .4 below the rim.
    const bottom = (x: number) => (.4 + .5 * Math.sqrt(Math.max(0, 1 - x * x))).toFixed(2);
    const stripes = [-.8, -.4, 0, .4].map(x => `<path fill="#a8324a" stroke="none" d="M${x},0V${bottom(x)}L${x + .2},${bottom(x + .2)}V0Z"/>`).join('');
    return `<path fill="#2f5aa8" d="M-1,0V.4A1,.5,0,0,0,1,.4V0Z"/>${stripes}<ellipse fill="#f2efe6" cx="0" cy="0" rx="1" ry=".5"/><ellipse fill="#a8324a" cx="0" cy=".02" rx=".78" ry=".37"/><ellipse fill="#6fbf5a" cx="0" cy=".05" rx=".48" ry=".2"/>`;
  },
  /** Barceloneta: a strip of sand, a striped parasol and the sail-shaped hotel. */
  beach: () => `<path fill="#bfe3f2" d="M.25,1C.35,.1,.55,-.8,.95,-1.35V1Z"/>${shade('M.7,1V-1C.8,-1.2,.88,-1.28,.95,-1.35V1Z', '#8ec3dc')}`
    + `<path fill="#f5d98a" d="M-1,1Q0,.5,1,1Z"/><path fill="none" stroke-width=".1" d="M-.35,-.25V.8"/><path fill="#ef6b5f" d="M-1.05,-.2A.7,.55,0,0,1,.35,-.2Z"/><path fill="#fff" stroke="none" d="M-.55,-.22Q-.35,-.72,-.15,-.22Z"/>`,
  /** Fòrum: the great solar pergola, a blue panel tilted to the sun on a slanted leg. */
  pergola: () => `<path fill="#e5ddd0" d="M-.2,1L-.05,-.35H.2L.25,1Z"/>${shade('M.08,1L.12,-.35H.2L.25,1Z', '#bfb3a0')}`
    + `<path fill="#3f6fb0" d="M-1.05,-.55L.15,-1.25L1.05,-.6L-.15,.1Z"/><path fill="none" stroke="#8fb8e8" stroke-width=".05" d="M-.75,-.72L.15,-.07M-.45,-.9L.45,-.25M-.15,-1.07L.75,-.42M-.6,-.29L.6,-.99M-.35,-.12L.85,-.82"/>`
    + `<circle fill="#ffd257" cx="-.7" cy="-1.35" r=".22"/>`,
  /** Arc de Triomf: a brick arch with depth, its crown in gold. */
  arch: () => `<path fill="#c96b4a" d="M-.95,1V-.7H.75V1H.35V.1A.4,.4,0,0,0,-.45,.1V1Z"/>${shade('M.75,1V-.7L1.05,-.95V.75Z', '#9d4f35')}`
    + `<path fill="#e9c35a" d="M-.95,-.7L-.65,-.95H1.05L.75,-.7Z"/><path fill="none" stroke="#e9c35a" stroke-width=".07" d="M-.95,-.35H.75"/>`,
  /** Sant Pau: a pavilion with a tiled dome and a little gold spire. */
  dome: () => `<path fill="#e98f5a" d="M-.85,1V.1H.45V1Z"/>${shade('M.45,1V.1L.85,-.1V.8Z', '#c26a3a')}`
    + `<path fill="#5fa6a0" d="M-.78,.1Q-.78,-.75,-.2,-.8Q.38,-.75,.38,.1Z"/><path fill="none" stroke="#e9c35a" stroke-width=".07" d="M-.65,-.25Q-.2,-.4,.25,-.25"/>`
    + `<path fill="none" stroke-width=".07" d="M-.2,-.8V-1.25"/><circle fill="#e9c35a" cx="-.2" cy="-1.3" r=".1"/><path fill="#3b2a20" d="M-.55,1V.55A.13,.13,0,0,1,-.29,.55V1ZM-.11,1V.55A.13,.13,0,0,1,.15,.55V1Z"/>`,
  home: () => `<path fill="#f7d26a" d="M-.75,1V-.05H.45V1Z"/>${shade('M.45,1V-.05L.85,-.25V.8Z', '#d9ac3e')}<path fill="#d9473f" d="M-.95,0L-.15,-.9L.6,-.2L.45,0Z"/><path fill="#a8323a" d="M.45,0L.6,-.2L-.15,-.9L.15,-1.05L.95,-.35Z"/><path fill="#ff7aa8" d="M-.15,.75C-.55,.4,-.45,.05,-.15,.25C.15,.05,.25,.4,-.15,.75Z"/>`,
  school: () => `<path fill="#f2efe6" d="M-.95,1V-.2H.55V1Z"/>${shade('M.55,1V-.2L.95,-.4V.8Z', '#cbc4b2')}<path fill="#e8742c" d="M-.95,-.2L-.2,-.75L.55,-.2Z"/><path fill="#b9561c" d="M.55,-.2L-.2,-.75L.2,-.95L.95,-.4Z"/><path fill="none" stroke="${INK}" stroke-width=".1" d="M-.2,-.75V-1.4"/><path fill="#e8742c" d="M-.2,-1.4H.25L.1,-1.25L.25,-1.1H-.2Z"/>`,
  /**
   * La Reina Bubbaloo's castle: more and taller towers the stronger she is (`level`), inside a
   * halo of pink light as wide as her power has spread (`reach`). It loses towers as Gerard and
   * Aitor help people.
   */
  bubbaloo: (level, reach) => {
    const towers = 3 + Math.round(level * 6);
    const r = Math.max(1.6, reach);
    const parts = [`<circle class="map-halo" fill="url(#queen-halo)" stroke="none" cx="0" cy="-.2" r="${r.toFixed(2)}"/><circle class="map-halo-ring" fill="none" stroke="#ff6fae" stroke-width=".06" stroke-opacity=".7" cx="0" cy="-.2" r="${(r * .62).toFixed(2)}"/>`];
    for (let i = 0; i < towers; i++) {
      const k = towers === 1 ? 0 : i / (towers - 1) - .5, x = k * 1.9, h = 1.1 + (1 - Math.abs(k) * 1.6) * (.6 + level * .9);
      parts.push(`<path fill="${i % 2 ? '#d94a8c' : '#ff6fae'}" d="M${x - .16},1V${-h + .7}L${x},${-h + .25}L${x + .16},${-h + .7}V1Z"/>`);
    }
    parts.push(`<path fill="#ff6fae" d="M-1.05,1V.1H-.75V-.15H-.45V.1H.45V-.15H.75V.1H1.05V1Z"/>${shade('M.45,1V.1H1.05V1Z', '#d94a8c')}<path fill="#6e2453" d="M-.3,1V.55A.3,.3,0,0,1,.3,.55V1Z"/>`);
    parts.push(`<circle fill="#ffe066" cx="0" cy="-1.0" r=".14"/>`);
    return parts.join('');
  },
};

/** Draws one marker at its place, `unit` metres per icon unit. */
export function renderMarker(m: MapMarker, unit: number): string {
  const draw = ICONS[m.icon] ?? ICONS.dome;
  // Every marker stands on the ground of the city: a soft shadow under it.
  const shadow = m.icon === 'bubbaloo' ? '' : `<ellipse fill="${INK}" opacity=".18" cx=".1" cy=".98" rx="1.05" ry=".24"/>`;
  const s = unit * (m.size ?? 1);
  const label = m.label ? `<text class="map-marker-name" x="0" y="${2.25}" font-size=".6">${escapeXml(m.name)}</text>` : '';
  return `<g class="map-marker" data-icon="${m.icon}" data-marker="${m.id}" transform="translate(${m.x} ${m.y}) scale(${s})">${shadow}<g stroke="${INK}" stroke-width=".12" stroke-linejoin="round">${draw(m.level ?? 0, m.reach ?? 0)}</g>${label}<title>${escapeXml(m.name)}</title></g>`;
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
    // Her halo widens over the city day after day.
    state.castle
      ? { id: 'castle', icon: 'bubbaloo', name: 'El castillo de la Reina Bubbaloo', x: school.x, y: school.y, size: 1.1 + state.threat * .6, level: state.threat, reach: 2.4 + (state.spread ?? 0) * 4 }
      : { id: 'rec-comtal', icon: 'school', name: school.name, x: school.x, y: school.y, label: true },
  ];
}
