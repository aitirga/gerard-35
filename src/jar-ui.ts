import { ANIMA_OWNERS, ELEMENTS, MANA_POINTS, SKILLS, type ClassId } from './battle';
import { animaOf, CLASSES } from './classes';
import { isDpad, type ControllerEvent } from './controller';
import { ELEMENT_ICONS, IMPROVEMENTS, LINES, TREE_ANIMAS, costOf, improvementOf, type Improvement, type LineId } from './ecos';
import { nearestButton } from './menu-nav';
import type { Direction } from './movement';
import type { SoundId } from './sfx';
import type { Story } from './story';

/**
 * The jar at home (docs/animas/README.md § The jar): the one place the party's Ecos de luz are put
 * into its ánimas and taken back. A window over the living room, not the whole screen: one sky
 * with a cluster of lights per ánima (its core, and its tree branching out of it), and the jar
 * below with every eco in it (lit while free, dark and tinted once it is in an ánima). Each ánima
 * is a constellation, closed at first: only its core and the stars already lit. A player opens
 * the one they choose and its tree unfolds out of the core; they work inside it until they step
 * back out. A light flies from the jar to the node it turns on, and back. Gerard and Aitor each
 * move their own cursor, each with its own floating note; each can be in a different constellation. Moves and buttons read the device in use (input-glyphs.ts).
 */
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const svg = (paths: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;
/** The drawing of each kind of node that is not an element. */
const KIND_ICONS = {
  // A skill is a four-pointed spark.
  skill: '<path d="M8 1.2 9.7 6.3 14.8 8 9.7 9.7 8 14.8 6.3 9.7 1.2 8 6.3 6.3z"/>',
  mana: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5"/>',
  passive: '<path d="M8 1.5 14 4v4.2c0 3.2-2.5 5.4-6 6.3-3.5-.9-6-3.1-6-6.3V4z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  ulti: '<path d="M8 1.2 9.9 6l5 .4-3.8 3.2 1.2 5L8 11.9l-4.3 2.7 1.2-5L1.1 6.400l5-.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
};
const iconOf = (item: Improvement) => item.element ? ELEMENT_ICONS[item.element] : KIND_ICONS[item.kind as keyof typeof KIND_ICONS];
export const colourOf = (item: Improvement) => item.element ? ELEMENTS[item.element].colour : item.line ? LINES[item.line].colour : CLASSES[item.anima].colour;
const ecoWord = (n: number) => n === 1 ? 'eco' : 'ecos';

type Player = 1 | 2;
const PLAYERS: Player[] = [1, 2];
const WHO: Record<Player, string> = { 1: 'Gerard', 2: 'Aitor' };
/** The sky is drawn on a sheet of 1600 × 900 and scaled with the window. */
const W = 1600, H = 900;
/** How far from its core each node of a line sits. */
const RINGS = [96, 180, 264, 348];
/** Which way each line of an own ánima's tree grows (degrees, 0 to the right, clockwise). */
const SHAPES: Partial<Record<ClassId, { lines: Partial<Record<LineId, number>>; mana?: number; ulti: number }>> = {
  matemagico: { lines: { calculo: 180, fuego: -65, electrico: 0, agua: 65 }, ulti: -128 },
  tecnopata: { lines: { bip: -120, mente: 0, taller: 120 }, mana: 55, ulti: -55 },
};
/**
 * Where a folded constellation waits: its own tree made small (style.css), somewhere in the sky.
 * Scattered on purpose, never a row or a grid: the sky must not say how many there will be.
 */
const SEATS: [number, number][] = [[470, 250], [1130, 225], [800, 385], [215, 455], [1395, 430], [1010, 560], [585, 590], [1345, 705], [270, 700], [830, 165]];
/** Where a constellation unfolds: on the left for whoever opens it as player 1, on the right for player 2. */
const STAGES: Record<Player, [number, number]> = { 1: [440, 560], 2: [1160, 560] };
const JAR_AT: [number, number] = [800, 724];
interface Spot { key: string; x: number; y: number; shape: 'node' | 'core' | 'mini' | 'pill' }
interface Star { key: string; x: number; y: number; ring: number; label: 'above' | 'below' }
interface Link { from: string; to: string; d: string; colour: string; ring: number }
interface Tree { id: ClassId; stars: Star[]; links: Link[] }
const pct = (x: number, y: number) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;

export function createJarUI(hud: HTMLElement, story: Story, callbacks: { pause: (paused: boolean) => void; sound: (id: SoundId) => void; changed: () => void }) {
  const root = document.createElement('section');
  root.id = 'jar-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'El bote de las luces');
  hud.append(root);
  let open = false, closing = false, openedAt = 0, timer = 0;
  /** What each player's cursor is on; player 2's shows once they move. */
  const cursors: Partial<Record<Player, string>> = {};
  /** The constellation each player has opened and is working in, if any. */
  const inside: Partial<Record<Player, ClassId>> = {};
  const animaOfKey = (key: string | undefined) => !key ? undefined : key.startsWith('core:') ? key.slice(5) as ClassId : improvementOf(key)?.anima;
  const unfolded = (id: ClassId | undefined) => !!id && PLAYERS.some(p => inside[p] === id);
  /** Which constellation is unfolded on each side. */
  const stages: Partial<Record<Player, ClassId>> = {};
  let spots: Spot[] = [], trees: Tree[] = [];
  /** Whose cursor is riding a constellation that is unfolding or folding: it goes at its pace. */
  const gliding = new Set<Player>();
  let closed: (() => void) | undefined;
  /** The own ánimas first (each its owner's tree), then the shared ones. */
  const pages = () => [...story.classes.filter(id => TREE_ANIMAS.includes(id)), ...story.classes.filter(id => !TREE_ANIMAS.includes(id))];
  const ownerOf = (id: ClassId) => ANIMA_OWNERS[id] === 'gerard' ? 'Gerard' : ANIMA_OWNERS[id] === 'aitor' ? 'Aitor' : '';
  const isOn = (key: string) => key.startsWith('core:') || story.improvements.includes(key);
  const stateOf = (item: Improvement) => story.improvements.includes(item.id) ? 'on'
    : item.veiled ? 'veiled'
    : item.after && !story.improvements.includes(item.after) ? 'needs'
    : item.cost > story.ecosFree ? 'short' : 'open';

  /** Each ánima's tree round its own core, at full size: where each node is and what joins what. */
  function layout() {
    trees = pages().map(id => {
      const shape = SHAPES[id], items = IMPROVEMENTS.filter(item => item.anima === id);
      const stars: Star[] = [], links: Link[] = [], core = `core:${id}`;
      const place = (item: Improvement, angle: number, radius: number, ring: number, flip: boolean) => {
        const a = angle * Math.PI / 180, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        stars.push({ key: item.id, x, y, ring, label: flip ? 'above' : 'below' });
        const from = stars.find(s => s.key === item.after) ?? { key: core, x: 0, y: 0 };
        // The join stops short of both discs.
        const length = Math.hypot(x - from.x, y - from.y), near = from.key === core ? 56 : 30, far = 30;
        const at = (k: number) => `${(from.x + (x - from.x) * k).toFixed(1)} ${(from.y + (y - from.y) * k).toFixed(1)}`;
        links.push({ from: from.key, to: item.id, d: `M${at(near / length)}L${at(1 - far / length)}`, colour: colourOf(item), ring });
      };
      const apart = items.filter(item => !item.line);
      if (shape) {
        for (const [line, angle] of Object.entries(shape.lines) as [LineId, number][]) {
          const flat = Math.abs(Math.cos(angle * Math.PI / 180)) > .8;
          items.filter(item => item.line === line).forEach((item, i) => place(item, angle, RINGS[i], i + 1, flat && i % 2 === 1));
        }
        for (const item of apart) place(item, item.kind === 'ulti' ? shape.ulti : shape.mana ?? 90, 132, 1, false);
      } else apart.forEach((item, i) => place(item, apart.length === 1 ? 90 : 152 - i * (124 / (apart.length - 1)), 112, 1, false));
      return { id, stars, links };
    });
  }
  /** Where a constellation waits folded: its own place in the sky. */
  function skySeat(id: ClassId) {
    const [x, y] = SEATS[pages().indexOf(id) % SEATS.length];
    return { x, y };
  }
  /** Where it is now: on a stage at full size if someone is in it, at its place in the sky if not. */
  function seat(id: ClassId) {
    const stage = PLAYERS.find(s => stages[s] === id);
    return stage ? { x: STAGES[stage][0], y: STAGES[stage][1], open: true } : { ...skySeat(id), open: false };
  }
  /** Who is unfolded where, and from that what can be pointed at and where it is on the sheet. */
  function settle() {
    for (const s of PLAYERS) if (stages[s] && !unfolded(stages[s])) delete stages[s];
    // A constellation unfolds on its opener's side, or on the other if that one is taken.
    for (const p of PLAYERS) { const id = inside[p]; if (id && !PLAYERS.some(s => stages[s] === id)) stages[stages[p] ? (p === 1 ? 2 : 1) : p] = id; }
    spots = trees.flatMap(tree => {
      const at = seat(tree.id);
      return [{ key: `core:${tree.id}`, x: at.x, y: at.y, shape: at.open ? 'core' as const : 'mini' as const }, ...at.open ? tree.stars.map(s => ({ key: s.key, x: at.x + s.x, y: at.y + s.y, shape: 'node' as const })) : []];
    });
    spots.push({ key: 'reset', x: JAR_AT[0], y: 862, shape: 'pill' }, { key: 'close', x: 1508, y: 52, shape: 'pill' });
  }
  /** A marble per eco, packed from the bottom of the jar: the ones in an ánima below, dark and tinted by where they went; the free ones on top, lit. */
  function marbles() {
    const spent = story.improvements.flatMap(id => { const item = improvementOf(id)!; return Array.from({ length: item.cost }, () => colourOf(item)); });
    const all = [...spent, ...Array.from({ length: Math.max(0, story.ecosFree) }, () => '')];
    let row = 0, inRow = 0;
    return all.map((where, i) => {
      const wide = row % 2 ? 4 : 5;
      const x = 50 + (inRow - (wide - 1) / 2) * 16.5, y = 4 + row * 13.5;
      if (++inRow === wide) { row++; inRow = 0; }
      return `<i class="jar-marble" ${where ? 'data-in' : 'data-free'} style="--size:15.5%;--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--i:${i};${where ? `--where:${where}` : ''}"></i>`;
    }).join('');
  }
  function jar() {
    const free = story.ecosFree, total = story.ecos, used = total - free;
    return `<div class="jar-vessel" style="--glow:${(total ? Math.min(1, free / Math.max(3, total)) : 0).toFixed(2)}">
        <div class="jar-halo"></div>
        <svg class="jar-back" viewBox="0 0 240 300" aria-hidden="true"><defs>
          <linearGradient id="jar-glass" x1="0" x2="1"><stop offset="0" stop-color="#cfe9f2" stop-opacity=".2"/><stop offset=".22" stop-color="#cfe9f2" stop-opacity=".05"/><stop offset=".8" stop-color="#cfe9f2" stop-opacity=".04"/><stop offset="1" stop-color="#cfe9f2" stop-opacity=".2"/></linearGradient>
          <linearGradient id="jar-cork" x1="0" x2="1"><stop offset="0" stop-color="#8b6538"/><stop offset=".45" stop-color="#c79c67"/><stop offset="1" stop-color="#7c5a33"/></linearGradient></defs>
          <path d="M72 54h96v10c0 10 26 20 38 44 8 16 10 34 10 52v92c0 26-18 42-44 42H68c-26 0-44-16-44-42v-92c0-18 2-36 10-52 12-24 38-34 38-44z" fill="url(#jar-glass)"/>
        </svg>
        <div class="jar-marbles">${marbles()}</div>
        <svg class="jar-front" viewBox="0 0 240 300" aria-hidden="true">
          <path d="M72 54h96v10c0 10 26 20 38 44 8 16 10 34 10 52v92c0 26-18 42-44 42H68c-26 0-44-16-44-42v-92c0-18 2-36 10-52 12-24 38-34 38-44z" fill="none" stroke="#dff2f8" stroke-opacity=".5" stroke-width="2"/>
          <path d="M42 150c0-18 3-30 9-42 4-8 11-14 18-19" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
          <path d="M40 176v44" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>
          <rect x="64" y="46" width="112" height="13" rx="6" fill="#dff2f8" fill-opacity=".22" stroke="#dff2f8" stroke-opacity=".5" stroke-width="1.5"/>
        </svg>
      </div>
      <p class="jar-count"><strong>${free}</strong><span>${free === 1 ? 'eco libre' : 'ecos libres'}${used ? `<small>${used} en las ánimas</small>` : ''}</span></p>`;
  }
  const manaPips = (id: ClassId) => Array.from({ length: story.manaOf(id) }, (_, i) => `<i ${i >= MANA_POINTS ? 'data-extra' : ''}></i>`).join('');
  function node(item: Improvement, star: Star) {
    return `<button type="button" class="jar-node" data-key="${item.id}" data-improve="${item.id}" data-kind="${item.kind}" data-label="${star.label}" style="--x:${star.x.toFixed(1)};--y:${star.y.toFixed(1)};--item:${colourOf(item)};--ring:${star.ring}">
      <span class="jar-node-star">${item.veiled ? '<b>?</b>' : svg(iconOf(item))}</span>
      <span class="jar-node-name">${escape(item.name)}</span>
    </button>`;
  }
  /** A constellation: its glow, its joins, its core and its nodes, all round one point so it can shrink into the row and grow onto a stage. */
  function constellation(tree: Tree) {
    const id = tree.id, own = TREE_ANIMAS.includes(id), name = escape(animaOf(id, story.adult).name), whose = own ? ownerOf(id) : `Nivel ${story.levels[id] ?? 1}`;
    return `<div class="jar-constellation" data-anima="${id}" data-own="${own}" style="--anima:${CLASSES[id].colour}">
        <i class="jar-nebula"></i>
        <svg class="jar-links" viewBox="-420 -420 840 840" aria-hidden="true">${tree.links.map(l => `<path d="${l.d}" data-from="${l.from}" data-to="${l.to}" style="--item:${l.colour};--ring:${l.ring}"/>`).join('')}</svg>
        <button type="button" class="jar-core" data-key="core:${id}" data-core="${id}"><strong>${name}</strong><small>${whose}</small><span class="jar-pips"></span></button>
        ${tree.stars.map(s => node(improvementOf(s.key)!, s)).join('')}
      </div>
      <span class="jar-mini-name" data-name="${id}" style="--anima:${CLASSES[id].colour}"><strong>${name}</strong><small>${whose}</small></span>`;
  }
  /** What a player's cursor is on: what it is, what it does, what it costs and what pressing would do now. */
  function tip(key: string, player: Player) {
    if (key === 'reset') return '<span class="battle-kicker">EL BOTE</span><strong>Recoger todos los ecos</strong><p>Todas las luces vuelven al bote. No se pierde nada.</p>';
    if (key === 'close') return '<span class="battle-kicker">EL BOTE</span><strong>Cerrar</strong><p>Aquí dentro se pueden mover siempre que queráis. Fuera de casa, no.</p>';
    if (key.startsWith('core:')) {
      const id = key.slice(5) as ClassId, spec = animaOf(id, story.adult), own = TREE_ANIMAS.includes(id);
      const count = costOf(story.improvements.filter(i => improvementOf(i)?.anima === id));
      const has = SKILLS.filter(skill => skill.class === id && !('node' in skill) && (own || ('level' in skill ? skill.level : 1) <= (story.levels[id] ?? 1)));
      return `<span class="battle-kicker">${own ? `ÁNIMA DE ${ownerOf(id).toUpperCase()} · SIEMPRE PUESTA` : `ÁNIMA · NIVEL ${story.levels[id] ?? 1}`}</span><strong>${escape(spec.name)}</strong><p>${escape(spec.motto)}</p>
        <p class="jar-tip-has"><b>${own ? 'Desde el principio' : 'Aprendido luchando'}</b>${has.map(skill => escape(skill.name)).join(' · ')}</p>
        <span class="jar-tip-foot"><span>Maná ${story.manaOf(id)} · ${count ? `${count} ${ecoWord(count)} dentro` : 'sin ecos'}</span><span class="jar-tip-action" data-glyph-template="${inside[player] === id ? '{cancel} · Plegar' : '{confirm} · Desplegar'}"></span></span>`;
    }
    const item = improvementOf(key);
    if (!item) return '';
    const state = stateOf(item), skill = item.skill ? SKILLS.find(s => s.id === item.skill) : undefined;
    const kind = item.kind === 'ulti' ? 'DEFINITIVA' : item.passive ? 'PASIVA' : item.kind === 'mana' ? 'MANÁ' : item.element ? 'PARA ATACAR' : `HABILIDAD · ${skill?.cost ?? 0} DE MANÁ`;
    const action = state === 'on' ? `{confirm} · Apagar: vuelve${item.cost > 1 ? 'n' : ''} ${item.cost} ${ecoWord(item.cost)}` : state === 'open' ? `{confirm} · Encender` : '';
    const why = state === 'short' ? `Hacen falta ${item.cost} ${ecoWord(item.cost)} libres.`
      : state === 'needs' ? `Primero: ${improvementOf(item.after!)!.name}.`
      : state === 'veiled' ? 'Aún no se puede despertar.' : '';
    return `<span class="battle-kicker">${kind}${item.line ? ` · ${LINES[item.line].name.toUpperCase()}` : ''}</span><strong>${escape(item.name)}</strong><p>${escape(item.description)}</p>
      <span class="jar-tip-foot"><span class="jar-tip-cost" style="--item:${colourOf(item)}">${'<i></i>'.repeat(item.cost)}${item.cost} ${ecoWord(item.cost)}</span>${action ? `<span class="jar-tip-action" data-glyph-template="${action}"></span>` : `<span class="jar-tip-why">${escape(why)}</span>`}</span>`;
  }
  /**
   * Where a note goes beside what it is about: the side that covers the fewest other lights, stays
   * on the sheet and keeps off the other player's note.
   */
  function tipSide(spot: Spot, other?: { x: number; y: number }) {
    const w = 330, h = 184, gap = spot.shape === 'core' ? 76 : spot.shape === 'mini' ? 100 : spot.shape === 'pill' ? 40 : 48;
    const dx = gap + w / 2 + (spot.shape === 'pill' ? 90 : 0), dy = gap + h / 2;
    // Beside it first, then above and below, then the corners; a little further out if all of those cover something.
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let best = { x: spot.x + dx, y: spot.y }, least = Infinity;
    for (const far of [0, 70]) around.forEach(([sx, sy], i) => {
      const x = spot.x + sx * (dx + far) * (sx && sy ? .86 : 1), y = spot.y + sy * (dy + far + (sy > 0 && !sx ? 24 : 0)) * (sx && sy ? .9 : 1);
      const covers = (s: Spot, pad: number) => Math.abs(s.x - x) < w / 2 + pad && Math.abs(s.y - y) < h / 2 + pad;
      let score = i * .05 + far * .01;
      for (const s of spots) if (covers(s, s.shape === 'mini' ? 84 : s.shape === 'core' ? 58 : 32)) score += s === spot ? 40 : s.shape === 'node' ? 1 : 3;
      if (x - w / 2 < 14 || x + w / 2 > W - 14 || y - h / 2 < 14 || y + h / 2 > H - 14) score += 50;
      if (Math.abs(JAR_AT[0] - x) < w / 2 + 80 && Math.abs(JAR_AT[1] - y) < h / 2 + 96) score += 4;
      if (other && Math.abs(other.x - x) < w + 8 && Math.abs(other.y - y) < h + 8) score += 20;
      if (score < least) { least = score; best = { x, y }; }
    });
    return best;
  }
  /** Each player's note, where it is now, and the mark on what each points at: its border takes their colour (style.css). */
  function place() {
    let first: { x: number; y: number } | undefined;
    for (const player of PLAYERS) {
      const key = cursors[player], spot = spots.find(s => s.key === key);
      const tether = root.querySelector<SVGLineElement>(`.jar-tether[data-player="${player}"]`);
      tether?.setAttribute('visibility', spot ? 'visible' : 'hidden');
      const note = root.querySelector<HTMLElement>(`.jar-tip[data-player="${player}"]`);
      if (!note) continue;
      note.hidden = !spot;
      if (!spot || !key) continue;
      if (gliding.has(player)) note.dataset.glide = ''; else delete note.dataset.glide;
      const at = tipSide(spot, first);
      first ??= at;
      note.style.cssText = pct(at.x, at.y);
      // A thread from the light to its note, so a note set apart still reads as its own.
      for (const [name, value] of [['x1', spot.x], ['y1', spot.y], ['x2', at.x], ['y2', at.y]] as const) tether?.setAttribute(name, value.toFixed(1));
      note.innerHTML = `<b class="jar-tip-who">${WHO[player]}</b>${tip(key, player)}`;
    }
    gliding.clear();
    root.querySelectorAll<HTMLElement>('[data-key]').forEach(el => { el.dataset.cursor = PLAYERS.filter(p => cursors[p] === el.dataset.key).join('') || ''; if (!el.dataset.cursor) delete el.dataset.cursor; });
  }
  /** What is on, what could be, what joins them, and what is left in the jar. */
  function refresh(landing: string[] = []) {
    root.querySelectorAll<HTMLButtonElement>('.jar-node').forEach(button => {
      const item = improvementOf(button.dataset.improve!)!, state = stateOf(item);
      button.dataset.state = state; button.setAttribute('aria-pressed', String(state === 'on'));
      if (landing.includes(item.id)) { delete button.dataset.landing; void button.offsetWidth; button.dataset.landing = ''; }
    });
    root.querySelectorAll<SVGPathElement>('.jar-links path[data-to]').forEach(path => {
      const to = improvementOf(path.dataset.to!)!;
      path.dataset.state = isOn(path.dataset.from!) && isOn(to.id) ? 'on' : isOn(path.dataset.from!) && !to.veiled ? 'next' : 'off';
    });
    root.querySelectorAll<HTMLElement>('.jar-core').forEach(button => {
      const id = button.dataset.core as ClassId;
      button.querySelector('.jar-pips')!.innerHTML = manaPips(id);
    });
    settle();
    root.querySelectorAll<HTMLElement>('.jar-constellation').forEach(el => {
      const id = el.dataset.anima as ClassId, at = seat(id), home = skySeat(id), name = root.querySelector<HTMLElement>(`.jar-mini-name[data-name="${id}"]`);
      el.style.left = `${(at.x / W * 100).toFixed(2)}%`; el.style.top = `${(at.y / H * 100).toFixed(2)}%`;
      // Folded where another has unfolded over it, it steps back until someone points at it.
      el.dataset.behind = String(!at.open && PLAYERS.some(s => stages[s] && Math.abs(STAGES[s][0] - at.x) < 330 && Math.abs(STAGES[s][1] - at.y) < 270));
      el.dataset.open = String(at.open); el.dataset.lit = String(story.improvements.some(i => improvementOf(i)?.anima === id));
      if (name) { name.style.cssText += `;${pct(home.x, home.y + 96)}`; name.dataset.open = String(at.open); name.dataset.behind = el.dataset.behind; }
    });
    const holder = root.querySelector('.jar-jar');
    if (holder) holder.innerHTML = jar();
    const reset = root.querySelector<HTMLButtonElement>('[data-jar-reset]');
    if (reset) reset.setAttribute('aria-disabled', String(!story.improvements.length));
    place();
  }
  function render() {
    layout(); settle();
    const list = pages(), at = (key: string) => spots.find(s => s.key === key)!;
    root.innerHTML = `<div class="jar-veil" aria-hidden="true"></div>
      <div class="jar-window"><div class="jar-sky">
        <header class="jar-title"><span class="battle-kicker">EN CASA · EL COMEDOR</span><h1>El bote <em>de las luces</em></h1></header>
        <svg class="jar-threads" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${PLAYERS.map(p => `<line class="jar-tether" data-player="${p}"/>`).join('')}</svg>
        ${trees.map(constellation).join('')}
        <div class="jar-jar" style="${pct(...JAR_AT)}"></div>
        <button type="button" class="jar-pill" data-key="reset" data-jar-reset style="${pct(at('reset').x, at('reset').y)}">Recoger todos los ecos</button>
        <button type="button" class="jar-pill" data-key="close" data-jar-close data-back style="${pct(at('close').x, at('close').y)}">Cerrar <kbd data-glyph="cancel"></kbd></button>
        ${PLAYERS.map(p => `<aside class="jar-tip" data-player="${p}" hidden></aside>`).join('')}
        <p class="jar-help" data-glyph-template="{arrows} · Moverse  ·  {confirm} · Desplegar, encender o apagar  ·  {prev} / {next} · Ánima  ·  {cancel} · Plegar o cerrar"></p>
      </div></div>`;
    if (!list.length) root.querySelector('.jar-sky')!.insertAdjacentHTML('beforeend', '<p class="jar-empty">Ninguna ánima todavía.</p>');
    cursors[1] = spots.some(s => s.key === cursors[1]) ? cursors[1] : spots[0]?.key;
    if (cursors[2] && !spots.some(s => s.key === cursors[2])) delete cursors[2];
    refresh();
  }
  /** What a player can reach: inside a constellation, its core and its nodes; out in the sky, the cores and the jar's buttons. */
  const targets = (player: Player) => [...root.querySelectorAll<HTMLButtonElement>('button[data-key]')].filter(b => inside[player] ? animaOfKey(b.dataset.key) === inside[player] : !b.dataset.improve);
  const buttonOf = (key: string | undefined) => key ? root.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`) : null;
  function point(player: Player, key: string | undefined) {
    if (!key || cursors[player] === key) return;
    cursors[player] = key;
    place();
  }
  /** A player opens a constellation: its tree unfolds out of the core and they are in it. */
  function enter(player: Player, id: ClassId) {
    if (inside[player] === id) return;
    inside[player] = id; cursors[player] = `core:${id}`; gliding.add(player);
    callbacks.sound('glass-tick'); refresh();
  }
  /** And steps back out to the sky: it folds again unless the other is still in it. */
  function leave(player: Player) {
    const id = inside[player];
    if (!id) return;
    delete inside[player]; cursors[player] = `core:${id}`; gliding.add(player);
    callbacks.sound('glass-tick'); refresh();
  }
  /** Player 2's cursor comes in on their own ánima the first time they touch anything. */
  function wake(player: Player) {
    if (cursors[player]) return false;
    const own = pages().find(id => ANIMA_OWNERS[id] === (player === 2 ? 'aitor' : 'gerard'));
    point(player, own ? `core:${own}` : spots[0]?.key);
    return true;
  }
  function move(player: Player, direction: Direction) {
    const from = buttonOf(cursors[player]);
    if (!from) { point(player, spots[0]?.key); return; }
    point(player, (nearestButton(targets(player), from, direction) as HTMLButtonElement | undefined)?.dataset.key);
  }
  /** To the next ánima: its core out in the sky, or straight into it from inside another. */
  function turn(player: Player, step: 1 | -1) {
    const list = pages(), on = animaOfKey(cursors[player]);
    if (!list.length) return;
    const index = on ? list.indexOf(on) : step > 0 ? -1 : 0, next = list[(index + step + list.length) % list.length];
    if (inside[player]) enter(player, next); else point(player, `core:${next}`);
  }
  /** An eco crosses the sky, out of the jar and into a node, or back. */
  function fly(a: DOMRect | undefined, b: DOMRect | undefined, colour: string, delay = 0) {
    if (!a || !b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = root.getBoundingClientRect();
    const eco = document.createElement('i');
    eco.className = 'jar-flight'; eco.style.setProperty('--where', colour); root.append(eco);
    const x0 = a.left + a.width / 2 - box.left, y0 = a.top + a.height / 2 - box.top, x1 = b.left + b.width / 2 - box.left, y1 = b.top + b.height / 2 - box.top;
    const lift = Math.min(y0, y1) - 50, mid = (x0 + x1) / 2 + (y1 - y0) * .12;
    const at = (x: number, y: number, s: number) => ({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` });
    eco.animate([at(x0, y0, .8), { ...at(mid, lift, 1.4), offset: .5 }, at(x1, y1, .7)], { duration: 460, delay, fill: 'backwards', easing: 'cubic-bezier(.3,.05,.3,1)' }).finished.then(() => eco.remove(), () => eco.remove());
  }
  const mouth = () => ([...root.querySelectorAll('.jar-marble[data-free]')].at(-1) ?? root.querySelector('.jar-marbles'))?.getBoundingClientRect();
  function press(button: HTMLButtonElement, player: Player) {
    if (button.hasAttribute('data-jar-close')) { close(); return; }
    if (button.dataset.core) { const id = button.dataset.core as ClassId; if (inside[player] === id) leave(player); else enter(player, id); return; }
    const before = [...story.improvements];
    const back = () => before.filter(id => !story.improvements.includes(id)).forEach((id, i) => fly(buttonOf(id)?.getBoundingClientRect(), mouth(), colourOf(improvementOf(id)!), i * 70));
    if (button.hasAttribute('data-jar-reset')) {
      if (!before.length) { callbacks.sound('denied'); return; }
      story.clearImprovements(); callbacks.sound('clink'); callbacks.changed(); refresh(); back();
      return;
    }
    const id = button.dataset.improve, item = id ? improvementOf(id) : undefined;
    if (!id || !item) return;
    const state = stateOf(item);
    if (state === 'on') {
      // Whatever hangs from it goes out with it: each light finds its own way back.
      story.unimprove(id); callbacks.sound('glass-tick'); callbacks.changed(); refresh(); back();
    } else if (state === 'open') {
      const from = mouth();
      story.improve(id); callbacks.changed(); refresh([id]);
      fly(from, button.querySelector('.jar-node-star')?.getBoundingClientRect(), colourOf(item));
      callbacks.sound('clink');
    } else {
      button.classList.remove('is-stuck'); void button.offsetWidth; button.classList.add('is-stuck');
      callbacks.sound('denied');
    }
  }
  /** Opens the jar; resolves when it is closed, so the story's next beat waits for it. */
  function show() {
    if (open) return Promise.resolve();
    open = true; closing = false; openedAt = performance.now(); delete cursors[1]; delete cursors[2]; delete inside[1]; delete inside[2]; delete stages[1]; delete stages[2];
    root.hidden = false; root.dataset.phase = 'in'; hud.dataset.jar = 'open'; callbacks.pause(true);
    render();
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (open && !closing) root.dataset.phase = 'open'; }, 1300);
    return new Promise<void>(resolve => { closed = resolve; });
  }
  /** The window folds back into the jar, and then the room is theirs again. */
  function close(now = false) {
    if (!open || (closing && !now)) return;
    const end = () => {
      clearTimeout(timer);
      open = closing = false; root.hidden = true; root.replaceChildren(); delete root.dataset.phase; delete hud.dataset.jar; callbacks.pause(false);
      document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
      closed?.(); closed = undefined;
    };
    if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) { end(); return; }
    closing = true; root.dataset.phase = 'out';
    clearTimeout(timer);
    timer = window.setTimeout(end, 260);
  }
  function control(action: ControllerEvent, player: Player = 1) {
    if (!open || closing) return;
    if (action === 'menu' || (action === 'cancel' && !inside[player])) { close(); return; }
    if (wake(player)) return;
    if (action === 'cancel') { leave(player); return; }
    if (action === 'prev' || action === 'next') turn(player, action === 'prev' ? -1 : 1);
    else if (action === 'confirm') { const button = buttonOf(cursors[player]); if (button) press(button, player); }
    else if (action !== 'overview' && action !== 'character' && !isDpad(action)) move(player, action);
  }
  // The mouse is player 1's: a node can only be reached unfolded, and reaching one puts them in its constellation.
  const within = (button: HTMLButtonElement) => { const id = button.dataset.improve ? animaOfKey(button.dataset.key) : undefined; if (id && inside[1] !== id) { inside[1] = id; refresh(); } };
  root.addEventListener('click', event => {
    if (closing) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (button) { within(button); point(1, button.dataset.key); press(button, 1); }
  });
  root.addEventListener('pointerover', event => {
    if (closing) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (!button || (inside[1] && !button.dataset.improve && animaOfKey(button.dataset.key) !== inside[1])) return;
    within(button); point(1, button.dataset.key);
  });
  // Ahead of the game and the menu: while it is open the keys are its own.
  function keydown(event: KeyboardEvent) {
    if (!open || document.querySelector('dialog[open]')) return;
    const keys: Record<string, ControllerEvent> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'confirm', Enter: 'confirm', Escape: 'cancel', KeyQ: 'prev', KeyE: 'next',
    };
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // The press that opened it must not move its cursor straight away.
    if (event.code === 'KeyE' && performance.now() - openedAt < 250) return;
    if (event.repeat && !['up', 'down', 'left', 'right'].includes(action)) return;
    control(action, 1);
  }
  window.addEventListener('keydown', keydown, { capture: true });
  return {
    open: show, close: () => close(), control,
    get isOpen() { return open; },
    destroy() { close(true); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
