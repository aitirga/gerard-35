import { ANIMA_OWNERS, DUALS, ELEMENTS, MANA_POINTS, SKILLS, type ClassId, type SkillId } from './battle';
import { animaOf, CLASSES } from './classes';
import { isDpad, type ControllerEvent } from './controller';
import { ELEMENT_ICONS, IMPROVEMENTS, LINES, TREE_ANIMAS, asleep, costOf, improvementOf, inSky, stageOf, type Improvement, type LineId } from './ecos';
import { nearestButton } from './menu-nav';
import type { Direction } from './movement';
import type { SoundId } from './sfx';
import type { Story } from './story';

/**
 * The jar at home (docs/animas/README.md § The jar, § The jar as one sky): the one place the party's
 * Ecos de luz are put into its ánimas and taken back. A window over the living room, not the whole
 * screen: one sky with every ánima's constellation open at once (Gerard's tree on the left, Aitor's
 * on the right, the shared ones small and scattered round and between them, the skills they have
 * learned fighting as small stars), the dúos mayores as gold stars between two constellations (a
 * «?» until both their ends are lit), and the jar below with every eco in it (lit while free, dark
 * and tinted once it is in an ánima). A light flies from the jar to the star it turns on, and back.
 * Gerard and Aitor each move their own cursor over the whole sky, each with its own floating note,
 * and the constellation under a cursor is pushed in on, slowly. The castle's stages
 * (docs/animas/README.md § Growth opens with the castle) add stars to the same sky: the first time
 * it opens after a boss, a light runs out along each new join and the star opens at its end. Moves
 * and buttons read the device in use (input-glyphs.ts).
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
  // A dúo mayor: two discs joined, something done with someone.
  dual: '<circle cx="4.9" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="11.1" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.6 8h2.8" stroke="currentColor" stroke-width="1.8"/>',
};
const iconOf = (item: Improvement) => item.element ? ELEMENT_ICONS[item.element] : KIND_ICONS[item.kind as keyof typeof KIND_ICONS];
/** A dúo mayor is gold, whatever its halves (docs/animas/README.md § Dúos mayores). */
const MAJOR = '#ffd36b';
export const colourOf = (item: Improvement) => item.kind === 'dual' ? MAJOR : item.element ? ELEMENTS[item.element].colour : item.line ? LINES[item.line].colour : CLASSES[item.anima].colour;
const ecoWord = (n: number) => n === 1 ? 'eco' : 'ecos';

type Player = 1 | 2;
const PLAYERS: Player[] = [1, 2];
const WHO: Record<Player, string> = { 1: 'Gerard', 2: 'Aitor' };
/** The sky is drawn on a sheet of 1600 × 900 and scaled with the window. */
const W = 1600, H = 900;
/** How far from its core each node of an own tree's line sits. */
const RINGS = [80, 142, 204, 266, 328];
/** Degrees off its line a node that branches beside another stands (`layout`). */
const BRANCH = 13;
/**
 * Where each constellation sits in the one sky. Gerard's tree on the left and Aitor's on the right,
 * each line growing its own way (degrees, 0 to the right, clockwise); the shared ones small and
 * scattered round and between them, never a row or a grid (the sky must not say how many ánimas
 * there will be), their nodes one way (`nodes`) and the skills they have learned the other
 * (`skills`). Each shared ánima sits by the end of the lines it makes a dúo mayor with, so its gold
 * star has room between and no thread crosses the sky: Sincopante between Matemágico's fire and
 * Tecnópata's Mente (Vulcano, Idea fija), Colorista in the middle between Eléctrico and Taller
 * (Fulgurita, Caleidoscopio), Dadista by Cálculo (Suceso seguro), Freática under Agua (Marea),
 * Papagato out past Bip (Metralla).
 */
interface Seat { at: [number, number]; lines?: Partial<Record<LineId, number>>; mana?: number; ulti?: number; nodes?: number; skills?: number }
const SKY: Partial<Record<ClassId, Seat>> = {
  matemagico: { at: [396, 500], lines: { calculo: 180, fuego: -60, electrico: 0, agua: 60 }, ulti: -120 },
  tecnopata: { at: [1236, 468], lines: { mente: -120, bip: 0, taller: 120 }, mana: 58, ulti: -58 },
  dadaista: { at: [244, 286], nodes: 0, skills: 190 },
  sincopante: { at: [842, 172], nodes: -90, skills: 180 },
  papagato: { at: [1452, 206], nodes: 180, skills: 80 },
  prismatico: { at: [900, 404], nodes: 0, skills: 90 },
  freatica: { at: [232, 752], nodes: 150, skills: -15 },
};
/** Places for an ánima the sky has none for yet. */
const SPARE: [number, number][] = [[1404, 736], [640, 610], [1120, 812]];
/** The dúos mayores whose arc bows downwards: away from the names of the line it hangs from (Caleidoscopio, off Taller), or under the core it goes round to reach its skill (Idea fija, to Ostinato on Sincopante's far side). */
const BOWED_DOWN: readonly string[] = ['caleidoscopio', 'idea-fija'];
/** How much the constellation under a cursor is pushed in on. */
const PUSH = { own: 1.05, shared: 1.14 };
/** How big each kind of light is on the sheet, for the joins to stop short of it and the notes to keep clear. */
const RADIUS = { own: 48, shared: 38, node: 20, small: 18, dual: 28 };
const JAR_AT: [number, number] = [800, 724];
/** Where the jar's name ends, from the top left corner. */
const TITLE: [number, number] = [330, 124];
type Side = 'above' | 'below' | 'left' | 'right';
interface Spot { key: string; x: number; y: number; r: number; pill?: true }
interface Star { key: string; x: number; y: number; ring: number; label: Side }
interface Link { from: string; to: string; d: string; colour: string; ring: number }
/** A skill a shared ánima has learned fighting: a small star of its constellation, never bought. */
interface Spark { skill: SkillId; x: number; y: number; ring: number; label: Side }
interface Tree { id: ClassId; own: boolean; x: number; y: number; stars: Star[]; links: Link[]; sparks: Spark[]; chain: string }
/**
 * A dúo mayor's gold star, between the star that ends one half's line and the other half's skill
 * (`learned`: that skill is a star of its constellation; until then the thread hangs from its core).
 */
interface Bridge { item: Improvement; partner: ClassId; skill: SkillId; learned: boolean; x: number; y: number; threads: [string, string] }
const pct = (x: number, y: number) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;
const at = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
/** Where a label goes for a light that sits `angle` from its core: beside it unless it is nearly straight above or below (`flat`, how far from upright still counts as beside). */
function sideOf(angle: number, flat = .45): Side {
  const c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
  return Math.abs(c) > flat ? (c > 0 ? 'right' : 'left') : s < 0 ? 'above' : 'below';
}
/**
 * A shared ánima's learned skills: small stars on a gentle arc on its `skills` side, at least
 * `radius` from the core and `gap` apart across that side, every name on the same side of its star,
 * so they always read a line apart, however many it has learned (Dadista has eight at level 7).
 */
const SPARK = { radius: 70, gap: 24, flat: .2 };
/**
 * The castle's stage the jar was last opened at, so what a stage brings is seen coming in once: in
 * the browser, like the ecos (and in memory if storage is off, so it plays once a session at most).
 */
const STAGE_KEY = 'gerard35.jar-stage.v1';
let stageSeen = 1;
function seenStage() {
  try { const saved = Number(localStorage.getItem(STAGE_KEY)); if (saved >= 1 && saved <= 3) stageSeen = saved; } catch { /* Storage is optional. */ }
  return stageSeen;
}
function keepStage(stage: number) {
  stageSeen = stage;
  try { localStorage.setItem(STAGE_KEY, String(stage)); } catch { /* Storage is optional. */ }
}

export function createJarUI(hud: HTMLElement, story: Story, callbacks: { pause: (paused: boolean) => void; sound: (id: SoundId) => void; changed: () => void }) {
  const root = document.createElement('section');
  root.id = 'jar-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'El bote de las luces');
  hud.append(root);
  let open = false, closing = false, openedAt = 0, timer = 0, chime = 0;
  /** The stage the jar was last seen at when it opened: what a later one brings comes in (`arriving`). */
  let seen = 1;
  /** What each player's cursor is on; player 2's shows once they move. */
  const cursors: Partial<Record<Player, string>> = {};
  let spots: Spot[] = [], trees: Tree[] = [], bridges: Bridge[] = [];
  /** The constellations under a cursor, and whose (`'1'`, `'2'` or `'12'`). */
  let pushed = new Map<ClassId, string>();
  /** The dúos mayores already in the sky, so one that comes in while the jar is open is seen arriving. */
  const shown = new Set<string>();
  let closed: (() => void) | undefined;
  /** The own ánimas first (each its owner's tree), then the shared ones. */
  const pages = () => [...story.classes.filter(id => TREE_ANIMAS.includes(id)), ...story.classes.filter(id => !TREE_ANIMAS.includes(id))];
  const ownerOf = (id: ClassId) => ANIMA_OWNERS[id] === 'gerard' ? 'Gerard' : ANIMA_OWNERS[id] === 'aitor' ? 'Aitor' : '';
  const isOn = (key: string) => key.startsWith('core:') || story.improvements.includes(key);
  /**
   * A dúo mayor is in the sky from the castle's stage that brings it, a «?» (Aitor 2026-11-21); it
   * is revealed, and can be bought, once both its ends are lit: its own half's line as far as it,
   * and the other half learned.
   */
  const revealed = (bridge: Bridge) => bridge.learned && isOn(bridge.item.after!);
  const bridgeOf = (id: string) => bridges.find(b => b.item.id === id);
  /** What a star is now: lit, a «?» still to reach, asleep, missing what comes before it, short of ecos, or there to light. */
  const stateOf = (item: Improvement) => story.improvements.includes(item.id) ? 'on'
    : item.kind === 'dual' && !(bridgeOf(item.id) && revealed(bridgeOf(item.id)!)) ? 'unknown'
    : asleep(item, story.stage) ? 'veiled'
    : item.after && !story.improvements.includes(item.after) ? 'needs'
    : item.cost > story.ecosFree ? 'short' : 'open';
  /** Whether a star is new in the sky since the jar was last opened: a stage of the castle has brought it (or woken it, a definitiva). */
  const arriving = (item: Improvement) => story.stage > seen && stageOf(item) > seen && !asleep(item, story.stage);
  /** What a shared ánima has learned fighting (its levels reached, never the ones to come); a die's faces are its die. */
  const learned = (id: ClassId) => SKILLS.filter(skill => skill.class === id && !('node' in skill) && !('face' in skill) && ('level' in skill ? skill.level : 1) <= (story.levels[id] ?? 1));
  /** The constellations a light belongs to: a dúo mayor's, both. */
  function animasAt(key: string | undefined): ClassId[] {
    if (!key) return [];
    if (key.startsWith('core:')) return [key.slice(5) as ClassId];
    const item = improvementOf(key);
    return !item ? [] : item.kind === 'dual' && item.partner ? [item.anima, item.partner] : [item.anima];
  }

  /** Every constellation in its place in the sky, round its own core: where each light is and what joins what. */
  function layout() {
    let spare = 0;
    trees = pages().map(id => {
      const seat = SKY[id] ?? { at: SPARE[spare++ % SPARE.length], nodes: 90, skills: -90 }, own = TREE_ANIMAS.includes(id);
      // Only what the castle's stage has opened: until then a constellation simply has fewer stars.
      const items = IMPROVEMENTS.filter(item => item.anima === id && item.kind !== 'dual' && inSky(item, story.stage));
      const stars: Star[] = [], links: Link[] = [], core = `core:${id}`, coreR = own ? RADIUS.own : RADIUS.shared, nodeR = own ? RADIUS.node : RADIUS.small;
      const place = (item: Improvement, angle: number, radius: number, ring: number, label: Side) => {
        const a = angle * Math.PI / 180, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        stars.push({ key: item.id, x, y, ring, label });
        const from = stars.find(s => s.key === item.after) ?? { key: core, x: 0, y: 0 };
        // The join stops short of both discs.
        const length = Math.hypot(x - from.x, y - from.y), near = (from.key === core ? coreR : nodeR) + 5, far = nodeR + 5;
        const point = (k: number) => at(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
        links.push({ from: from.key, to: item.id, d: `M${point(near / length)}L${point(1 - far / length)}`, colour: colourOf(item), ring });
      };
      const apart = items.filter(item => !item.line);
      if (seat.lines) {
        for (const [line, angle] of Object.entries(seat.lines) as [LineId, number][]) {
          const flat = Math.abs(Math.cos(angle * Math.PI / 180)) > .8;
          // Down the line one ring a node; a node that branches off the same one as an earlier node (Atractor extraño beside
          // Integral impropia, both past Maná +1) shares that node's ring, a little to one side of the line, then the other.
          const ringOf = new Map<string, number>(), branches = new Map<string, number>();
          let next = 0;
          for (const item of items.filter(item => item.line === line)) {
            const twin = [...ringOf.keys()].find(id => improvementOf(id)?.after === item.after && item.after);
            if (twin) {
              const i = ringOf.get(twin)!, k = (branches.get(twin) ?? 0) + 1, turn = BRANCH * Math.ceil(k / 2) * (k % 2 ? -1 : 1);
              branches.set(twin, k);
              place(item, angle + turn, RINGS[i], i + 1, flat ? (turn < 0 ? 'below' : 'above') : sideOf(angle + turn));
              continue;
            }
            const i = Math.min(next++, RINGS.length - 1);
            ringOf.set(item.id, i);
            place(item, angle, RINGS[i], i + 1, flat ? (i % 2 ? 'above' : 'below') : sideOf(angle));
          }
        }
        for (const item of apart) { const angle = item.kind === 'ulti' ? seat.ulti ?? -90 : seat.mana ?? 90; place(item, angle, 102, 1, sideOf(angle)); }
      } else apart.forEach((item, i) => { const angle = (seat.nodes ?? 90) + (i - (apart.length - 1) / 2) * 46; place(item, angle, 82, 1, sideOf(angle)); });
      // What it has learned: small stars on its other side, in an arc, a faint chain from the core through them.
      const skills = own ? [] : learned(id), n = skills.length;
      const face = (seat.skills ?? -90) * Math.PI / 180, reach = Math.max(SPARK.radius, (n - 1) * SPARK.gap / 2 + 24), label = sideOf(seat.skills ?? -90, SPARK.flat);
      const sparks = skills.map((skill, i) => {
        // `across` along the side, `out` from the core on a circle through them; a slight zigzag, so it reads as stars and not a ring.
        const across = (i - (n - 1) / 2) * SPARK.gap, out = Math.sqrt(reach * reach - across * across) + (i % 2) * 7;
        return { skill: skill.id, x: Math.cos(face) * out - Math.sin(face) * across, y: Math.sin(face) * out + Math.cos(face) * across, ring: 1 + Math.floor(i / 2), label };
      });
      const first = sparks[0], chain = first ? `M${at(first.x * coreR / Math.hypot(first.x, first.y), first.y * coreR / Math.hypot(first.x, first.y))}${sparks.map(s => `L${at(s.x, s.y)}`).join('')}` : '';
      return { id, own, x: seat.at[0], y: seat.at[1], stars, links, sparks, chain };
    });
    // A dúo mayor between two constellations in the sky, from the stage that brings it: on an arc from
    // its own half's last star to the other half's skill (its core while that is not learned), bowed upwards.
    bridges = IMPROVEMENTS.filter(item => item.kind === 'dual' && item.dual && item.partner && item.after && inSky(item, story.stage)).flatMap(item => {
      const mine = trees.find(t => t.id === item.anima), theirs = trees.find(t => t.id === item.partner);
      const spec = DUALS.find(d => d.id === item.dual)!, skill = SKILLS.find(s => (spec.parts as readonly string[]).includes(s.id) && s.class === item.partner)?.id;
      const end = mine?.stars.find(s => s.key === item.after), spark = theirs?.sparks.find(s => s.skill === skill);
      if (!mine || !theirs || !end || !skill) return [];
      const ax = mine.x + end.x, ay = mine.y + end.y;
      // Without its star yet, the thread starts at the edge of the other constellation's core, on the side facing this end.
      const toward = Math.atan2(ay - theirs.y, ax - theirs.x), rim = RADIUS.shared + 6;
      const bx = spark ? theirs.x + spark.x : theirs.x + Math.cos(toward) * rim, by = spark ? theirs.y + spark.y : theirs.y + Math.sin(toward) * rim;
      const length = Math.hypot(bx - ax, by - ay), bow = (bx > ax ? -1 : 1) * (BOWED_DOWN.includes(item.dual!) ? -1 : 1) * length * .3;
      const cx = (ax + bx) / 2 + (ay - by) / length * bow, cy = (ay + by) / 2 + (bx - ax) / length * bow;
      const x = (ax + 2 * cx + bx) / 4, y = (ay + 2 * cy + by) / 4;
      return [{ item, partner: item.partner!, skill, learned: !!spark, x, y, threads: [`M${at(ax, ay)}Q${at((ax + cx) / 2, (ay + cy) / 2)} ${at(x, y)}`, `M${at(bx, by)}Q${at((bx + cx) / 2, (by + cy) / 2)} ${at(x, y)}`] as [string, string] }];
    });
  }
  /** Who points where, and from that what can be pointed at and where it is on the sheet. */
  function settle() {
    pushed = new Map();
    for (const p of PLAYERS) for (const id of animasAt(cursors[p])) pushed.set(id, (pushed.get(id) ?? '') + p);
    spots = trees.flatMap(tree => {
      const k = pushed.has(tree.id) ? PUSH[tree.own ? 'own' : 'shared'] : 1, r = tree.own ? RADIUS.node : RADIUS.small;
      return [{ key: `core:${tree.id}`, x: tree.x, y: tree.y, r: (tree.own ? RADIUS.own : RADIUS.shared) * k }, ...tree.stars.map(s => ({ key: s.key, x: tree.x + s.x * k, y: tree.y + s.y * k, r: r * k }))];
    });
    spots.push(...bridges.map(b => ({ key: b.item.id, x: b.x, y: b.y, r: RADIUS.dual })));
    spots.push({ key: 'reset', x: JAR_AT[0], y: 862, r: 20, pill: true }, { key: 'close', x: 1508, y: 52, r: 20, pill: true });
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
  /** What a star shows: a «?» while it sleeps or is still to reach (a dúo mayor names only what it is), its drawing and name otherwise. */
  function face(item: Improvement) {
    const state = stateOf(item), hidden = state === 'unknown' || state === 'veiled';
    const name = state === 'unknown' ? '' : state === 'veiled' && item.kind === 'ulti' ? 'Definitiva' : item.name;
    return { star: hidden ? '<b>?</b>' : svg(iconOf(item)), name: `${item.kind === 'dual' ? '<small>Dúo mayor</small>' : ''}${escape(name)}` };
  }
  function node(item: Improvement, star: { x: number; y: number; ring: number; label: Side }) {
    const { star: drawing, name } = face(item);
    return `<button type="button" class="jar-node" data-key="${item.id}" data-improve="${item.id}" data-kind="${item.kind}" data-label="${star.label}"${arriving(item) ? ' data-arriving' : ''} style="--x:${star.x.toFixed(1)};--y:${star.y.toFixed(1)};--item:${colourOf(item)};--ring:${star.ring}">
      <span class="jar-node-star">${drawing}</span>
      <span class="jar-node-name">${name}</span>
    </button>`;
  }
  /** A join between two stars; one a stage has just brought has a light that runs out along it to the new star (`jar-link-run`). */
  function link(l: Link) {
    const coming = arriving(improvementOf(l.to)!);
    return `<path d="${l.d}" data-from="${l.from}" data-to="${l.to}"${coming ? ' data-arriving' : ''} style="--item:${l.colour};--ring:${l.ring}"/>${coming ? `<path class="jar-link-run" d="${l.d}" pathLength="1" style="--item:${l.colour};--ring:${l.ring}"/>` : ''}`;
  }
  /** A constellation: its glow, its joins, its core, its nodes and what it has learned, all round one point. */
  function constellation(tree: Tree, index: number) {
    const id = tree.id, name = escape(animaOf(id, story.adult).name), whose = tree.own ? ownerOf(id) : `Nivel ${story.levels[id] ?? 1}`;
    const sparks = tree.sparks.map(s => {
      const skill = SKILLS.find(k => k.id === s.skill)!;
      return `<i class="jar-spark" data-skill="${s.skill}" data-label="${s.label}" style="--x:${s.x.toFixed(1)};--y:${s.y.toFixed(1)};--ring:${s.ring}">${svg(KIND_ICONS.skill)}<span>${escape(skill.name)}</span></i>`;
    }).join('');
    return `<div class="jar-constellation" data-anima="${id}" data-own="${tree.own}" style="--anima:${CLASSES[id].colour};--push:${PUSH[tree.own ? 'own' : 'shared']};--i:${index};${pct(tree.x, tree.y)}">
        <i class="jar-nebula"></i>
        <svg class="jar-links" viewBox="-420 -420 840 840" aria-hidden="true">${tree.chain ? `<path class="jar-chain" d="${tree.chain}"/>` : ''}${tree.links.map(link).join('')}</svg>
        ${sparks}
        <button type="button" class="jar-core" data-key="core:${id}" data-core="${id}"><strong>${name}</strong><small>${whose}</small><span class="jar-pips"></span></button>
        ${tree.stars.map(s => node(improvementOf(s.key)!, s)).join('')}
      </div>`;
  }
  /**
   * The threads of each dúo mayor, from each end to its star (its own half's first, then the other's):
   * faint while that end is not lit; a light runs along them when the star is revealed, or when a
   * stage brings it into the sky.
   */
  const threads = (b: Bridge) => `<g class="jar-bridge" data-bridge="${b.item.id}"${arriving(b.item) ? ' data-arriving' : ''}>${b.threads.map((d, i) => `<path class="jar-bridge-thread" data-end="${i}" d="${d}"/><path class="jar-bridge-run" d="${d}" pathLength="1"/>`).join('')}</g>`;
  /** What a player's cursor is on: what it is, what it does, what it costs and what pressing would do now. */
  function tip(key: string) {
    if (key === 'reset') return '<span class="battle-kicker">EL BOTE</span><strong>Recoger todos los ecos</strong><p>Todas las luces vuelven al bote. No se pierde nada.</p>';
    if (key === 'close') return '<span class="battle-kicker">EL BOTE</span><strong>Cerrar</strong><p>Aquí dentro se pueden mover siempre que queráis. Fuera de casa, no.</p>';
    if (key.startsWith('core:')) {
      const id = key.slice(5) as ClassId, spec = animaOf(id, story.adult), own = TREE_ANIMAS.includes(id);
      const count = costOf(story.improvements.filter(i => improvementOf(i)?.anima === id));
      const has = own ? SKILLS.filter(skill => skill.class === id && !('node' in skill)) : learned(id);
      return `<span class="battle-kicker">${own ? `ÁNIMA DE ${ownerOf(id).toUpperCase()} · SIEMPRE PUESTA` : `ÁNIMA · NIVEL ${story.levels[id] ?? 1}`}</span><strong>${escape(spec.name)}</strong><p>${escape(spec.motto)}</p>
        <p class="jar-tip-has"><b>${own ? 'Desde el principio' : 'Aprendido luchando'}</b>${has.map(skill => escape(skill.name)).join(' · ')}</p>
        <span class="jar-tip-foot"><span>Maná ${story.manaOf(id)}</span><span>${count ? `${count} ${ecoWord(count)} dentro` : 'Sin ecos'}</span></span>`;
    }
    const item = improvementOf(key);
    if (!item) return '';
    const state = stateOf(item), skill = item.skill ? SKILLS.find(s => s.id === item.skill) : undefined;
    // A dúo mayor not reached yet says only what it is: nothing of its halves, its cost or how.
    if (state === 'unknown') return '<span class="battle-kicker">DÚO MAYOR</span><strong>?</strong><p>Todavía no se ve qué es.</p>';
    // A definitiva the castle has not woken yet is a place kept, whatever its move.
    const { name, description } = state === 'veiled' && item.kind === 'ulti' ? { name: 'Definitiva', description: 'Todavía duerme.' } : item;
    const kind = item.kind === 'dual' ? 'DÚO MAYOR' : item.kind === 'ulti' ? 'DEFINITIVA' : item.passive ? 'PASIVA' : item.kind === 'mana' ? 'MANÁ' : item.element ? 'PARA ATACAR' : `HABILIDAD · ${skill?.cost ?? 0} DE MANÁ`;
    const action = state === 'on' ? `{confirm} · Apagar: vuelve${item.cost > 1 ? 'n' : ''} ${item.cost} ${ecoWord(item.cost)}` : state === 'open' ? `{confirm} · Encender` : '';
    const why = state === 'short' ? `Hacen falta ${item.cost} ${ecoWord(item.cost)} libres.`
      : state === 'needs' ? `Primero: ${improvementOf(item.after!)!.name}.`
      : state === 'veiled' ? 'Aún no se puede despertar.' : '';
    return `<span class="battle-kicker">${kind}${item.line && item.kind !== 'dual' ? ` · ${LINES[item.line].name.toUpperCase()}` : ''}</span><strong>${escape(name)}</strong><p>${escape(description)}</p>
      <span class="jar-tip-foot"><span class="jar-tip-cost" style="--item:${colourOf(item)}">${'<i></i>'.repeat(item.cost)}${item.cost} ${ecoWord(item.cost)}</span>${action ? `<span class="jar-tip-action" data-glyph-template="${action}"></span>` : `<span class="jar-tip-why">${escape(why)}</span>`}</span>`;
  }
  /**
   * Where a note goes beside what it is about: the side that covers the fewest other lights, stays
   * on the sheet and keeps off the other player's note.
   */
  function tipSide(spot: Spot, other?: { x: number; y: number }) {
    const w = 330, h = 184, gap = spot.r + (spot.pill ? 20 : 28);
    const dx = gap + w / 2 + (spot.pill ? 90 : 0), dy = gap + h / 2;
    // Beside it first, then above and below, then the corners; a little further out if all of those cover something.
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let best = { x: spot.x + dx, y: spot.y }, least = Infinity;
    for (const far of [0, 60, 120]) around.forEach(([sx, sy], i) => {
      const x = spot.x + sx * (dx + far) * (sx && sy ? .86 : 1), y = spot.y + sy * (dy + far + (sy > 0 && !sx ? 24 : 0)) * (sx && sy ? .9 : 1);
      const covers = (s: Spot, pad: number) => Math.abs(s.x - x) < w / 2 + pad && Math.abs(s.y - y) < h / 2 + pad;
      let score = i * .05 + far * .012;
      // A dúo mayor or a core costs more to cover than a node: a note never hides one arriving.
      for (const s of spots) if (covers(s, s.r + 10)) score += s === spot ? 40 : s.r === RADIUS.dual ? 8 : s.r > RADIUS.dual ? 3 : 1;
      if (x - w / 2 < 14 || x + w / 2 > W - 14 || y - h / 2 < 14 || y + h / 2 > H - 14) score += 50;
      if (Math.abs(JAR_AT[0] - x) < w / 2 + 80 && Math.abs(JAR_AT[1] - y) < h / 2 + 96) score += 4;
      // Nor over the jar's name, top left.
      if (x - w / 2 < TITLE[0] && y - h / 2 < TITLE[1]) score += 6;
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
      const to = tipSide(spot, first);
      first ??= to;
      note.style.cssText = pct(to.x, to.y);
      // A thread from the light to its note, so a note set apart still reads as its own.
      for (const [name, value] of [['x1', spot.x], ['y1', spot.y], ['x2', to.x], ['y2', to.y]] as const) tether?.setAttribute(name, value.toFixed(1));
      note.innerHTML = `<b class="jar-tip-who">${WHO[player]}</b>${tip(key)}`;
    }
    root.querySelectorAll<HTMLElement>('[data-key]').forEach(el => { el.dataset.cursor = PLAYERS.filter(p => cursors[p] === el.dataset.key).join('') || ''; if (!el.dataset.cursor) delete el.dataset.cursor; });
    // The constellation under a cursor is pushed in on, slowly; the others keep to their place.
    root.querySelectorAll<HTMLElement>('.jar-constellation').forEach(el => { const who = pushed.get(el.dataset.anima as ClassId); if (who) el.dataset.focus = who; else delete el.dataset.focus; });
  }
  /** What is on, what could be, what joins them, which dúos mayores are revealed, and what is left in the jar. */
  function refresh(landing: string[] = []) {
    for (const bridge of bridges) {
      const id = bridge.item.id, on = revealed(bridge), born = on && !shown.has(id);
      if (on) shown.add(id); else shown.delete(id);
      const star = root.querySelector<HTMLElement>(`.jar-node[data-key="${id}"]`), lines = root.querySelector<SVGGElement>(`.jar-bridge[data-bridge="${id}"]`);
      const spark = root.querySelector<HTMLElement>(`.jar-constellation[data-anima="${bridge.partner}"] .jar-spark[data-skill="${bridge.skill}"]`);
      for (const el of [star, lines, spark]) {
        if (!el) continue;
        if (on) el.dataset.shown = ''; else delete el.dataset.shown;
        if (born && open) { delete el.dataset.born; void (el as HTMLElement).offsetWidth; el.dataset.born = ''; }
      }
      // Revealed or back to a «?» as its end is lit or put out.
      if (star) { const { star: drawing, name } = face(bridge.item); star.querySelector('.jar-node-star')!.innerHTML = drawing; star.querySelector('.jar-node-name')!.innerHTML = name; }
      lines?.setAttribute('data-state', story.improvements.includes(id) ? 'on' : on ? 'next' : 'unknown');
      // Each thread is lit from its own end: this half's line as far as it, the other half learned.
      lines?.querySelectorAll<SVGPathElement>('.jar-bridge-thread').forEach(thread => thread.toggleAttribute('data-lit', thread.dataset.end === '0' ? isOn(bridge.item.after!) : bridge.learned));
    }
    root.querySelectorAll<HTMLButtonElement>('.jar-node').forEach(button => {
      const item = improvementOf(button.dataset.improve!)!, state = stateOf(item);
      button.dataset.state = state; button.setAttribute('aria-pressed', String(state === 'on'));
      if (landing.includes(item.id)) { delete button.dataset.landing; void button.offsetWidth; button.dataset.landing = ''; }
    });
    root.querySelectorAll<SVGPathElement>('.jar-links path[data-to]').forEach(path => {
      const to = improvementOf(path.dataset.to!)!;
      path.dataset.state = isOn(path.dataset.from!) && isOn(to.id) ? 'on' : isOn(path.dataset.from!) && !asleep(to, story.stage) ? 'next' : 'off';
    });
    root.querySelectorAll<HTMLElement>('.jar-core').forEach(button => { button.querySelector('.jar-pips')!.innerHTML = manaPips(button.dataset.core as ClassId); });
    root.querySelectorAll<HTMLElement>('.jar-constellation').forEach(el => { el.dataset.lit = String(story.improvements.some(i => improvementOf(i)?.anima === el.dataset.anima)); });
    settle();
    const holder = root.querySelector('.jar-jar');
    if (holder) holder.innerHTML = jar();
    const reset = root.querySelector<HTMLButtonElement>('[data-jar-reset]');
    if (reset) reset.setAttribute('aria-disabled', String(!story.improvements.length));
    place();
  }
  function render() {
    layout();
    shown.clear();
    for (const b of bridges) if (revealed(b)) shown.add(b.item.id);
    root.innerHTML = `<div class="jar-veil" aria-hidden="true"></div>
      <div class="jar-window"><div class="jar-sky">
        <header class="jar-title"><span class="battle-kicker">EN CASA · EL COMEDOR</span><h1>El bote <em>de las luces</em></h1></header>
        <svg class="jar-bridges" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bridges.map(threads).join('')}</svg>
        <svg class="jar-threads" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${PLAYERS.map(p => `<line class="jar-tether" data-player="${p}"/>`).join('')}</svg>
        ${trees.map(constellation).join('')}
        <div class="jar-duals">${bridges.map(b => node(b.item, { x: b.x, y: b.y, ring: 6, label: 'above' })).join('')}</div>
        <div class="jar-jar" style="${pct(...JAR_AT)}"></div>
        <button type="button" class="jar-pill" data-key="reset" data-jar-reset style="${pct(JAR_AT[0], 862)}">Recoger todos los ecos</button>
        <button type="button" class="jar-pill" data-key="close" data-jar-close data-back style="${pct(1508, 52)}">Cerrar <kbd data-glyph="cancel"></kbd></button>
        ${PLAYERS.map(p => `<aside class="jar-tip" data-player="${p}" hidden></aside>`).join('')}
        <p class="jar-help" data-glyph-template="{arrows} · Moverse  ·  {confirm} · Encender o apagar  ·  {prev} / {next} · Ánima  ·  {cancel} · Cerrar"></p>
      </div></div>`;
    if (!trees.length) root.querySelector('.jar-sky')!.insertAdjacentHTML('beforeend', '<p class="jar-empty">Ninguna ánima todavía.</p>');
    settle();
    cursors[1] = spots.some(s => s.key === cursors[1]) ? cursors[1] : spots[0]?.key;
    if (cursors[2] && !spots.some(s => s.key === cursors[2])) delete cursors[2];
    refresh();
  }
  /** What a player can reach: every light in the sky and the jar's buttons, wherever they are. */
  const targets = () => [...root.querySelectorAll<HTMLButtonElement>('button[data-key]')].filter(b => !b.hidden);
  const buttonOf = (key: string | undefined) => key ? root.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`) : null;
  function point(player: Player, key: string | undefined) {
    if (!key || cursors[player] === key) return;
    cursors[player] = key;
    settle(); place();
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
    point(player, (nearestButton(targets(), from, direction) as HTMLButtonElement | undefined)?.dataset.key);
  }
  /** To the next ánima's core, wherever the cursor is. */
  function turn(player: Player, step: 1 | -1) {
    const list = pages(), on = animasAt(cursors[player])[0];
    if (!list.length) return;
    const index = on ? list.indexOf(on) : step > 0 ? -1 : 0;
    point(player, `core:${list[(index + step + list.length) % list.length]}`);
  }
  /** An eco crosses the sky, out of the jar and into a node, or back. */
  function fly(a: DOMRect | undefined, b: DOMRect | undefined, colour: string, delay = 0) {
    if (!a || !b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = root.getBoundingClientRect();
    const eco = document.createElement('i');
    eco.className = 'jar-flight'; eco.style.setProperty('--where', colour);
    const x0 = a.left + a.width / 2 - box.left, y0 = a.top + a.height / 2 - box.top, x1 = b.left + b.width / 2 - box.left, y1 = b.top + b.height / 2 - box.top;
    const lift = Math.min(y0, y1) - 50, mid = (x0 + x1) / 2 + (y1 - y0) * .12;
    const to = (x: number, y: number, s: number) => ({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` });
    // Already where it leaves from, so it never shows in the corner before its flight starts.
    eco.style.transform = to(x0, y0, .8).transform;
    root.append(eco);
    eco.animate([to(x0, y0, .8), { ...to(mid, lift, 1.4), offset: .5 }, to(x1, y1, .7)], { duration: 460, delay, fill: 'backwards', easing: 'cubic-bezier(.3,.05,.3,1)' }).finished.then(() => eco.remove(), () => eco.remove());
  }
  const mouth = () => ([...root.querySelectorAll('.jar-marble[data-free]')].at(-1) ?? root.querySelector('.jar-marbles'))?.getBoundingClientRect();
  function press(button: HTMLButtonElement) {
    if (button.hasAttribute('data-jar-close')) { close(); return; }
    // A core is only read: everything of it is already in the sky.
    if (button.dataset.core) return;
    const before = [...story.improvements];
    const back = () => before.filter(id => !story.improvements.includes(id)).forEach((id, i) => fly(buttonOf(id)?.getBoundingClientRect(), mouth(), colourOf(improvementOf(id)!), i * 70));
    if (button.hasAttribute('data-jar-reset')) {
      if (!before.length) { callbacks.sound('denied'); return; }
      // Each light finds its own way back before the stars it leaves go out of the sky.
      back(); story.clearImprovements(); callbacks.sound('clink'); callbacks.changed(); refresh();
      return;
    }
    const id = button.dataset.improve, item = id ? improvementOf(id) : undefined;
    if (!id || !item) return;
    const state = stateOf(item);
    if (state === 'on') {
      // Whatever hangs from it goes out with it: each light finds its own way back.
      const rects = new Map(before.map(other => [other, buttonOf(other)?.getBoundingClientRect()]));
      story.unimprove(id); callbacks.sound('glass-tick'); callbacks.changed(); refresh();
      before.filter(other => !story.improvements.includes(other)).forEach((other, i) => fly(rects.get(other), mouth(), colourOf(improvementOf(other)!), i * 70));
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
    open = true; closing = false; openedAt = performance.now(); delete cursors[1]; delete cursors[2];
    root.hidden = false; root.dataset.phase = 'in'; hud.dataset.jar = 'open'; callbacks.pause(true);
    // The first time it opens after a castle boss, what that stage brings comes into the sky (and is never seen coming again).
    seen = Math.min(seenStage(), story.stage);
    render();
    keepStage(story.stage);
    clearTimeout(chime);
    // A chime as the new stars open at the ends of their joins (style.css: `data-arriving`, at 2.2 s).
    if (root.querySelector('.jar-node[data-arriving]')) chime = window.setTimeout(() => { if (open && !closing) callbacks.sound('unlock'); }, 2200);
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (open && !closing) root.dataset.phase = 'open'; }, 1600);
    return new Promise<void>(resolve => { closed = resolve; });
  }
  /** The window folds back into the jar, and then the room is theirs again. */
  function close(now = false) {
    if (!open || (closing && !now)) return;
    const end = () => {
      clearTimeout(timer); clearTimeout(chime);
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
    if (action === 'menu' || action === 'cancel') { close(); return; }
    if (wake(player)) return;
    if (action === 'prev' || action === 'next') turn(player, action === 'prev' ? -1 : 1);
    else if (action === 'confirm') { const button = buttonOf(cursors[player]); if (button && !button.hidden) press(button); }
    else if (action !== 'overview' && action !== 'character' && !isDpad(action)) move(player, action);
  }
  // The mouse is player 1's.
  root.addEventListener('click', event => {
    if (closing) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (button) { point(1, button.dataset.key); press(button); }
  });
  root.addEventListener('pointerover', event => {
    if (closing) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (button) point(1, button.dataset.key);
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
