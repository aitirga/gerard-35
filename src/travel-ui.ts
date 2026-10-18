/**
 * Going down into a station (docs/barcelona.md): the network map on the station wall, where
 * Gerard picks a destination, and the trip, a small train running along the line on the map.
 * It only shows where he is and where the lines go; it never marks what to do.
 * Looks live in style.css (#travel, .city-*).
 */
import type { ControlAction } from './controller';
import { renderCityMap } from './city-map';
import type { MapMarker } from './map-markers';
import { LINES, STATIONS, destinations, linesAt, route, type Closures, type Leg } from './transit';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Seconds per stop on the map, and the shortest and longest trip. */
const STOP_S = .32, MIN_S = 1.8, MAX_S = 4.5;

export function createTravelUI(hud: HTMLElement) {
  // A <dialog> so the panels' and the dialogue's keys stand aside while it is open.
  const root = document.createElement('dialog');
  root.id = 'travel';
  root.setAttribute('aria-labelledby', 'travel-title');
  root.innerHTML = `<header class="travel-heading"><div><span class="battle-kicker">METRO</span><h1 id="travel-title"></h1><p class="travel-lines"></p></div><p class="travel-status" aria-live="polite"></p></header><div class="travel-map"></div><p class="travel-help"><span><kbd>←</kbd><kbd>→</kbd> Elegir</span><span><kbd>Enter</kbd> Viajar</span><span><kbd>Esc</kbd> Volver arriba</span></p>`;
  hud.append(root);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let from = '', options: Closures = {}, markers: readonly MapMarker[] = [];
  let choices: string[] = [], selected: string | undefined;
  let finish: ((to: string | undefined) => void) | undefined;
  let travelling = false;
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const badge = (id: string) => { const l = LINES.find(line => line.id === id)!; return `<b class="line-badge" data-kind="${l.kind}" style="--line:${l.colour}">${l.name}</b>`; };

  function render(trip?: readonly Leg[]) {
    get('#travel-title').textContent = STATIONS[from].name;
    get('.travel-lines').innerHTML = linesAt(from).map(l => badge(l.id)).join('');
    get('.travel-map').innerHTML = renderCityMap({ current: from, selectable: trip ? [] : choices, selected: trip ? undefined : selected, markers, route: trip, label: `Plano de la red desde ${STATIONS[from].name}` });
    const legs = !trip && selected ? route(from, selected, options) : undefined;
    get('.travel-status').innerHTML = trip ? '' : selected && legs
      ? `${escape(STATIONS[selected].name)} · ${legs.map(l => badge(l.line)).join('<i>›</i>')}`
      : 'Desde aquí no hay a dónde ir.';
  }
  function select(step: number) {
    if (travelling || !choices.length) return;
    const i = selected ? choices.indexOf(selected) : -1;
    selected = choices[(i + step + choices.length) % choices.length];
    render();
  }
  /** The train runs along the route on the map; then the trip resolves. */
  async function travel(to: string) {
    const legs = route(from, to, options);
    if (travelling || !legs) return;
    travelling = true;
    render(legs);
    const points = legs.flatMap((leg, i) => leg.stations.slice(i ? 1 : 0).map(id => STATIONS[id]));
    const stops = points.length - 1;
    const svg = get<SVGSVGElement>('.travel-map svg');
    const train = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    train.classList.add('city-train');
    const view = svg.viewBox.baseVal;
    train.setAttribute('r', String(Math.max(view.width, view.height) / 160 * 1.9));
    svg.append(train);
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const seconds = reducedMotion.matches ? 0 : Math.min(MAX_S, Math.max(MIN_S, stops * STOP_S));
    const status = get('.travel-status');
    await new Promise<void>(done => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = seconds ? Math.min(1, (now - start) / 1000 / seconds) : 1;
        const eased = t * t * (3 - 2 * t);
        let d = eased * total, i = 0;
        while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; }
        const a = points[i], b = points[i + 1] ?? a, k = lengths[i] ? Math.min(1, d / lengths[i]) : 1;
        train.setAttribute('cx', String(a.x + (b.x - a.x) * k)); train.setAttribute('cy', String(a.y + (b.y - a.y) * k));
        // Which line and towards where, as the platform screens say it.
        let reached = 0, leg = legs[0];
        for (const l of legs) { reached += l.stations.length - 1; if (i < reached) { leg = l; break; } }
        const line = LINES.find(l => l.id === leg.line)!;
        const towards = line.stations.indexOf(leg.stations.at(-1)!) > line.stations.indexOf(leg.stations[0]) ? line.stations.at(-1)! : line.stations[0];
        const text = `${line.name} · Dirección ${STATIONS[towards].name}`;
        if (status.textContent !== text) status.innerHTML = `${badge(line.id)} Dirección ${escape(STATIONS[towards].name)}`;
        if (t < 1) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
    close(to);
  }
  function close(to?: string) {
    if (!root.open) return;
    root.open = false; travelling = false;
    window.removeEventListener('keydown', keydown, { capture: true });
    const done = finish; finish = undefined; done?.(to);
  }
  function keydown(event: KeyboardEvent) {
    if (!root.open) return;
    event.stopPropagation();
    if (travelling) { event.preventDefault(); return; }
    if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS', 'Tab'].includes(event.code)) { event.preventDefault(); select(event.shiftKey && event.code === 'Tab' ? -1 : 1); }
    else if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(event.code)) { event.preventDefault(); select(-1); }
    else if (['Enter', 'Space', 'KeyE'].includes(event.code)) { event.preventDefault(); if (!event.repeat && selected) void travel(selected); }
    else if (event.code === 'Escape') { event.preventDefault(); close(); }
  }
  root.addEventListener('click', event => {
    const station = (event.target as Element).closest<SVGGElement>('[data-station]')?.dataset.station;
    if (station && choices.includes(station)) { selected = station; void travel(station); }
  });
  root.addEventListener('pointerover', event => {
    const station = (event.target as Element).closest<SVGGElement>('[data-station]')?.dataset.station;
    if (!travelling && station && choices.includes(station) && station !== selected) { selected = station; render(); }
  });

  return {
    get open() { return root.open; },
    /** Shows the map from `station` with the story's `icons`; resolves with the destination, or nothing if they go back up. */
    show(station: string, closures: Closures = {}, icons: readonly MapMarker[] = []): Promise<string | undefined> {
      close();
      from = station; options = closures; markers = icons;
      choices = destinations(from, closures); selected = choices[0];
      root.open = true; render();
      window.addEventListener('keydown', keydown, { capture: true });
      return new Promise(resolve => { finish = resolve; });
    },
    /** A controller drives it like the keyboard: directions choose, confirm travels, cancel goes back. */
    control(action: ControlAction) {
      if (!root.open || travelling) return;
      if (action === 'confirm') { if (selected) void travel(selected); }
      else if (action === 'cancel') close();
      else if (action === 'left' || action === 'up') select(-1);
      else if (action === 'right' || action === 'down') select(1);
    },
    destroy() { close(); root.remove(); },
  };
}
