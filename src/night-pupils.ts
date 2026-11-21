/**
 * How the castle's pupils hunt the Meridiana at night (docs/chapter-2.md § Night and the way home;
 * decided with Aitor 2026-11-20). Each pupil is a body of its own on the street, and each hunts the
 * way it fights inside (docs/castle.md § Bestiary), so the way home is the castle's rehearsal:
 *
 * - **El Repetidor** plants itself, tells its charge and runs straight, unable to turn; into a
 *   wall, a lamp or a row of containers it is stunned.
 * - **La Chivata** never catches: she points, and while she sees Gerard everyone knows where he is.
 * - **El Empollón** learns the kind of cover that last worked on it and goes to look there.
 * - **Los Gemelos** hunt as two: one follows, the other runs round to cut the way ahead.
 * - **La Delegada** walks at Gerard without stopping, cover or not; while she stands, nobody gives up.
 * - **El Ausente** is only seen in a lamp's light; in the dark it is not there.
 * - **El Castigado** stands facing the wall. Running past it is a point of Rabia; at three it
 *   bursts: everyone hears where Gerard is, and it runs at him for good.
 * - **El Montón** does what Gerard does: it runs when he runs, walks when he walks, stops when he stops.
 *
 * And for all of them: a run is heard from far off, light or dark; before running at Gerard they
 * doubt a moment (time to cut the line of sight), and having lost him they go and look where they
 * last had him; a car that runs one over flattens it for a while. One that reaches the party is its
 * group's fight (`nightGroup`). Pure: no DOM, no engine; the game and the simulator both step it.
 */
import { REACH, clearLine, step } from './chasers.ts';
import { canWalk, facingToward, type Cell } from './movement.ts';
import { CASTLE_FIGHTS, nightGroup, type CastlePhaseId, type PupilKind } from './castle.ts';
import { CLIMB, FIRST_CLEAR, HIDE_REACH, HIDING_KINDS, PORTAL_SAFE, isLit, postsAlong, roundAbout, sightOf, type NightTier } from './night.ts';

export type HidingKind = (typeof HIDING_KINDS)[number];
/** Something to stand still behind, and what kind of thing it is (what El Empollón learns). */
export interface Cover { x: number; z: number; kind: HidingKind }
/**
 * The street's rules, every number in one book. Seconds, cells and cells per second (Gerard walks
 * 5.2 and runs 7.8).
 *
 * Everyone: `hesitate` before running at Gerard (less with La Delegada standing: `ordered` of it),
 * `giveUp` without him before going to look where he was, `search` looking round there; a run is
 * heard from `hear`; walking into one (`touch`) is its fight; a car leaves one `flat` this long.
 * El Repetidor: it lumbers at `lumber` of the night's run, charges from `chargeFrom` (never under
 * `chargeNear`) after a `windup` whose last `lock` no longer turns, at `chargeSpeed` for
 * `chargeLength`; a crash stuns it `crash`, a charge run out `spent`.
 * La Chivata: she sees `far` times as far, keeps `keep` away, tells everyone within `reveal`, and
 * stops pointing `lose` after losing him.
 * El Empollón: it learns a cover from within `learnNear`, and checks the nearest of that kind within `check`.
 * Los Gemelos: the one cutting ahead aims `lead` in front of Gerard, until `close`.
 * La Delegada: `march` times the night's walk, never under `marchLeast`.
 * El Castigado: a run within `rageNear` for `rageEvery` is a point of Rabia; at `rage` it bursts,
 * heard within `alarm`, and runs at `fury` times the night's run.
 * El Montón: `mimicRun` when Gerard runs, `mimicWalk` when he walks; it lets go past `forget`.
 */
export const STREET = {
  hesitate: .9, ordered: .4, giveUp: 2.6, search: 3.2, hear: 11, touch: .75, flat: 6, rest: 5, still: .4,
  lumber: .6, chargeFrom: 9, chargeNear: 2.2, windup: 1.1, lock: .35, chargeSpeed: 15, chargeLength: 13, crash: 4, spent: 1.4,
  far: 1.5, keep: 5, reveal: 40, lose: 1.2,
  learnNear: 14, check: 10,
  lead: 8, close: 3,
  march: 1.25, marchLeast: 1.9,
  rageNear: 7, rageEvery: .8, rage: 3, alarm: 32, fury: 1.15,
  mimicRun: 7.4, mimicWalk: 4.4, forget: 34,
} as const;
/** The same book for another place: the castle's own floors keep theirs (src/castle-pupils.ts). */
export type StreetRules = { [K in keyof typeof STREET]: number };

/**
 * What a pupil is doing. `rising`: climbing out of its grate, seeing nothing. `alert`: it has seen
 * something and doubts. `search`: going to where it last had Gerard, then looking round. `windup`
 * and `charge`: El Repetidor's. `point`: La Chivata's. `wall`: El Castigado's. `stunned`: after a
 * crash or a charge run out. `flat`: under a car. `resting`: after a fight the party walked away from.
 */
export type PupilMode = 'rising' | 'patrol' | 'alert' | 'chase' | 'search' | 'return' | 'windup' | 'charge' | 'point' | 'wall' | 'stunned' | 'flat' | 'resting';
export interface Pupil {
  /** `night-<group>-<n>`: the group is whose fight it brings (`nightGroup`). */
  id: string; group: number; kind: PupilKind;
  position: Cell; facing: number; mode: PupilMode;
  /** Its round, and the point of it it is heading for. */
  patrol: Cell[]; next: number;
  /** Seconds left of a timed mode; chasing, seconds since it last had Gerard. */
  timer: number;
  /** Where it last knew Gerard to be, and seconds left looking round there. */
  known: Cell; look: number;
  /** Whether it had Gerard in sight on its last step (Los Gemelos share it; La Chivata tells it). */
  seeing: boolean;
  /** Seconds it has got nowhere walking at something out of reach. */
  stuck: number;
  /** El Repetidor's charge: its line, and how far along it. */
  dir?: Cell; ran?: number;
  /** El Castigado: its Rabia, the seconds of running heard towards the next point, and whether it has burst. */
  rage?: number; heard?: number; burst?: boolean;
  /** A Gemelo's twin, and whether this one is the one cutting ahead. */
  twin?: string; flanking?: boolean;
  /** El Empollón: it has already gone to check the cover it learned, this search. */
  checked?: boolean;
  /** El Montón: the pace it has taken from Gerard. */
  pace?: Pace;
  /** La Delegada inside the castle: she stands in her room until she has Gerard, or is told where he is; then she never stops. */
  waits?: boolean;
}
export type Pace = 'still' | 'walk' | 'run';
/** Gerard as the street sees him: where, how fast, which way (a unit vector, zero standing) and how long he has stood still. */
export interface Prey { position: Cell; pace: Pace; heading: Cell; still: number }
/** A vehicle on the move: its centre, its heading (unit), its size and its speed. */
export interface Car { x: number; z: number; hx: number; hz: number; length: number; width: number; v: number }
/**
 * What happened, for the game to show. `alert`: one doubts. `spotted`: it runs at Gerard. `heard`:
 * it goes to a noise. `lost`: it gave up. `caught`: the fight. `windup`, `charge`, `crash`: El
 * Repetidor. `point`: La Chivata has him. `learned`: El Empollón knows that cover now. `flank`: a
 * Gemelo runs round. `order`: La Delegada is out. `rage`, `burst`: El Castigado. `shape`: El Montón
 * has taken Gerard's pace. `flat`, `up`: a car, and getting up from it.
 */
export type StreetEventType = 'alert' | 'spotted' | 'heard' | 'lost' | 'caught' | 'windup' | 'charge' | 'crash' | 'point' | 'learned' | 'flank' | 'order' | 'rage' | 'burst' | 'shape' | 'flat' | 'up';
export interface StreetEvent { type: StreetEventType; pupil: Pupil }
/**
 * The street tonight. `grid`: the hunters' own (the portal's light a wall, `huntersGrid`). `groups`:
 * how many have come up so far. `learned`: the kind of cover El Empollón knows (the next time). `pointed`: La Chivata
 * has Gerard in sight; `marching`: La Delegada stands.
 */
export interface Street {
  tier: NightTier; phase: CastlePhaseId;
  /** The place's numbers: the Meridiana's (`STREET`) unless it brings its own. */
  rules: StreetRules;
  grid: readonly string[]; lamps: readonly Cell[]; covers: readonly Cover[]; portal: Cell;
  /** Cells of a carriageway, where no round goes (`carriageway`). */
  road: (cell: Cell) => boolean;
  pupils: Pupil[]; groups: number;
  learned?: HidingKind; pointed: boolean; marching: boolean;
  /** The most groups that can be out at once, once the night's own are posted (`postGroups`); twice the tier's `hunters` without. */
  most?: number;
  /** The very cover El Empollón has just learned from: it goes on hiding Gerard until he leaves it. */
  fresh?: Cover;
}
export function createStreet(spec: Pick<Street, 'tier' | 'phase' | 'grid' | 'lamps' | 'covers' | 'portal'> & { road?: Street['road']; rules?: StreetRules }): Street {
  return { road: () => false, rules: STREET, ...spec, pupils: [], groups: 0, pointed: false, marching: false };
}

const dist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.z - b.z);
const round = (c: Cell): Cell => ({ x: Math.round(c.x), z: Math.round(c.z) });
/** Streets with through traffic (src/traffic.ts drives the same ones). */
const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified']);
/** Whether a cell lies on a carriageway of `roads` (their lines and widths in cells): where cars run. */
export function carriageway(roads: readonly { highway?: string; width: number; line: readonly (readonly number[])[] }[]): (cell: Cell) => boolean {
  const driven = roads.filter(r => r.highway && DRIVEN.has(r.highway));
  return cell => driven.some(road => road.line.some((a, i) => {
    const b = road.line[i + 1];
    return !!b && segment({ x: a[0], z: a[1] }, { x: b[0], z: b[1] }, cell) <= road.width / 2;
  }));
}
/** How far `p` is from the stretch `a`–`b`. */
function segment(a: Cell, b: Cell, p: Cell) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

/** How many groups can be out at once: twice the night's first count. */
export const groupsOut = (street: Street) => new Set(street.pupils.map(p => p.group)).size;
/**
 * The next group climbs out of the grate at `at`: the pupils of the floor's next room (`nightGroup`),
 * a body each, side by side. Nothing once twice the night's first count are out.
 */
export function riseGroup(street: Street, at: Cell): Pupil[] {
  if (groupsOut(street) >= (street.most ?? street.tier.hunters * 2)) return [];
  const group = ++street.groups, kinds = CASTLE_FIGHTS[nightGroup(group, street.phase)];
  const loop = roundAbout(at, street.grid, 4, cell => !street.road(cell));
  const risen = kinds.map((kind, i): Pupil => {
    const beside = { x: at.x + (i - (kinds.length - 1) / 2) * 1.2, z: at.z };
    const position = canWalk(round(beside), street.grid) ? beside : { ...at };
    // Each starts its round at another point, so a group spreads out instead of walking in file.
    const patrol = loop.length > 1 ? [...loop.slice(i % loop.length), ...loop.slice(0, i % loop.length)] : [round(position)];
    return { id: `night-${group}-${i + 1}`, group, kind, position, facing: 0, mode: 'rising', patrol, next: 1 % patrol.length, timer: CLIMB + i * .35, known: { ...position }, look: 0, seeing: false, stuck: 0 };
  });
  // Los Gemelos come in pairs: each knows its twin.
  const twins = risen.filter(p => p.kind === 'gemelo');
  for (let i = 0; i + 1 < twins.length; i += 2) { twins[i].twin = twins[i + 1].id; twins[i + 1].twin = twins[i].id; }
  street.pupils.push(...risen);
  return risen;
}
/**
 * A group that was there already (a room of the castle, src/castle-pupils.ts): its pupils, a body
 * each, on their `round`, each starting at another point of it. `group` is theirs to name (the
 * room's number); La Delegada waits where she stands, El Castigado faces the wall.
 */
export function placeGroup(street: Street, group: number, kinds: readonly PupilKind[], round: readonly Cell[]): Pupil[] {
  const placed = kinds.map((kind, i): Pupil => {
    const patrol = [...round.slice(i % round.length), ...round.slice(0, i % round.length)], position = { ...patrol[0] };
    return {
      id: `sala-${group}-${i + 1}`, group, kind, position, facing: 0, mode: kind === 'castigado' ? 'wall' : 'patrol', patrol, next: 1 % patrol.length,
      timer: 0, known: { ...position }, look: 0, seeing: false, stuck: 0, ...kind === 'delegada' ? { waits: true } : {},
    };
  });
  const twins = placed.filter(p => p.kind === 'gemelo');
  for (let i = 0; i + 1 < twins.length; i += 2) { twins[i].twin = twins[i + 1].id; twins[i + 1].twin = twins[i].id; }
  street.pupils.push(...placed);
  street.groups = Math.max(street.groups, group);
  return placed;
}
/**
 * Night has fallen and the avenue is theirs already: a group at each of the night's posts
 * (`postsAlong`, one every `tier.every` cells, on both pavements, the median and the side streets),
 * out and walking a wide round, none within sight of where the party comes out (`from`). `across`
 * keeps them to the avenue itself (its rows, first to last), not up the streets that leave it. From
 * then on the grates may bring `tier.hunters` twice over on top of them.
 */
export function postGroups(street: Street, from: Cell, across?: readonly [number, number], clear = FIRST_CLEAR): Pupil[] {
  if (!street.tier.every) return [];
  const on = (cell: Cell) => !street.road(cell) && (!across || (cell.z >= across[0] && cell.z <= across[1]));
  const posts = postsAlong(street.grid, street.tier.every, from, on, clear), posted: Pupil[] = [];
  street.most = posts.length;
  for (const post of posts) {
    const group = riseGroup(street, post), loop = roundAbout(post, street.grid, 7, cell => !street.road(cell));
    group.forEach((p, i) => {
      // Already up: the rules take it from climbing out to its round (or El Castigado to its wall) on their first step.
      p.timer = 0;
      if (loop.length > 1) { p.patrol = [...loop.slice(i % loop.length), ...loop.slice(0, i % loop.length)]; p.next = 1 % p.patrol.length; p.position = { ...p.patrol[0] }; p.known = { ...p.position }; }
    });
    posted.push(...group);
  }
  street.most = groupsOut(street) + street.tier.hunters * 2;
  return posted;
}
/** A group beaten melts: its pupils are gone, and what El Empollón had learned goes with the last of them. */
export function removeGroup(street: Street, group: number) {
  street.pupils = street.pupils.filter(p => p.group !== group);
  if (!street.pupils.some(p => p.kind === 'empollon')) delete street.learned;
}
/** A fight the party walked away from: its group stands still a while, then goes back to its round. */
export function restGroup(street: Street, group: number) {
  for (const p of street.pupils) if (p.group === group) { p.mode = 'resting'; p.timer = street.rules.rest; }
}
/** Whether a pupil can be seen: El Ausente only in a lamp's light, or while it acts (doubting, running at Gerard, climbing out, flat). */
export function shows(pupil: Pupil, street: Street) {
  return pupil.kind !== 'ausente' || pupil.mode === 'alert' || pupil.mode === 'chase' || pupil.mode === 'rising' || pupil.mode === 'flat' || isLit(pupil.position, street.lamps);
}
/** The cover Gerard is hidden behind, if he is: still, out of the light, next to it. */
export function coverOf(street: Street, prey: Prey): Cover | undefined {
  if (prey.still < street.rules.still || isLit(prey.position, street.lamps)) return undefined;
  return street.covers.find(c => dist(c, prey.position) <= HIDE_REACH);
}

const UP: readonly PupilMode[] = ['patrol', 'alert', 'chase', 'search', 'return', 'windup', 'charge', 'point', 'wall'];
const standing = (p: Pupil) => UP.includes(p.mode);
const face = (p: Pupil, at: Cell) => { if (dist(p.position, at) > 1e-3) p.facing = facingToward(at.x - p.position.x, at.z - p.position.z); };

/**
 * Moves the street on `dt` seconds, in small steps so nobody goes through a wall on a slow frame.
 * Returns what happened; it stops at a catch.
 */
export function stepStreet(street: Street, dt: number, prey: Prey, cars: readonly Car[] = []): StreetEvent[] {
  const events: StreetEvent[] = [];
  for (let left = Math.min(dt, .5); left > 1e-6 && !events.some(e => e.type === 'caught'); left -= .05) tick(street, Math.min(.05, left), prey, cars, events);
  return events;
}

function tick(street: Street, dt: number, prey: Prey, cars: readonly Car[], events: StreetEvent[]) {
  const { tier, grid, rules: R } = street, at = prey.position;
  const say = (type: StreetEventType, pupil: Pupil) => { events.push({ type, pupil }); };
  const safe = dist(at, street.portal) <= PORTAL_SAFE;
  const lit = isLit(at, street.lamps), cover = coverOf(street, prey);
  const noisy = prey.pace === 'run' && !safe;
  if (street.fresh && street.fresh !== cover) delete street.fresh;
  street.pointed = street.pupils.some(p => p.kind === 'chivata' && p.mode === 'point' && p.seeing);
  street.marching = street.pupils.some(p => p.kind === 'delegada' && standing(p) && !p.waits);
  const byId = (id?: string) => id ? street.pupils.find(p => p.id === id) : undefined;
  /** Cover hides from all but La Delegada, El Montón, and El Empollón once it has learned that kind. */
  const hiddenFrom = (p: Pupil) => safe || (!!cover && p.kind !== 'delegada' && p.kind !== 'monton' && !(p.kind === 'empollon' && street.learned === cover.kind && street.fresh !== cover));
  const sees = (p: Pupil, chasing: boolean) => {
    if (hiddenFrom(p)) return false;
    const d = dist(p.position, at);
    if (street.pointed && p.kind !== 'chivata' && d <= R.reveal) return true;
    // El Ausente is at home in the dark: it sees there as the others do once they are after him.
    const far = sightOf(tier, lit, chasing || p.kind === 'ausente') * (p.kind === 'chivata' ? R.far : 1);
    return d <= far && clearLine(grid, p.position, at);
  };
  const hears = (p: Pupil) => noisy && dist(p.position, at) <= R.hear;
  /** A step towards `target`; standing against something for a while counts as having got there. */
  const walk = (p: Pupil, target: Cell, speed: number) => {
    const before = p.position;
    step(p, target, speed, dt, grid);
    p.stuck = dist(before, p.position) < speed * dt * .2 ? p.stuck + dt : 0;
  };
  const search = (p: Pupil, where: Cell) => { p.mode = 'search'; p.known = { ...where }; p.look = R.search; p.checked = false; p.stuck = 0; };
  const engage = (p: Pupil) => {
    p.timer = 0; p.stuck = 0; p.known = { ...at };
    if (p.kind === 'chivata') { p.mode = 'point'; p.seeing = true; say('point', p); }
    else { p.mode = 'chase'; say(p.kind === 'monton' ? 'shape' : 'spotted', p); }
  };
  /** Where a pupil goes back to once whatever held it is over. */
  const back = (p: Pupil): PupilMode => p.burst || p.kind === 'delegada' ? 'chase' : p.kind === 'castigado' ? 'wall' : 'return';
  const caught = (p: Pupil) => !safe && dist(p.position, at) <= REACH;

  for (const p of street.pupils) {
    if (events.some(e => e.type === 'caught')) return;
    if (p.mode === 'rising' || p.mode === 'resting') {
      p.timer -= dt;
      if (p.timer > 0) continue;
      const rose = p.mode === 'rising';
      p.mode = rose && p.kind !== 'delegada' && p.kind !== 'castigado' ? 'patrol' : back(p); p.timer = 0;
      if (rose && p.kind === 'delegada') say('order', p);
      continue;
    }
    if (p.mode === 'flat' || p.mode === 'stunned') {
      p.timer -= dt;
      // A Gemelo down is got up by its twin, as inside.
      const twin = byId(p.twin);
      if (p.mode === 'flat' && twin && standing(twin) && dist(twin.position, p.position) <= 1.6) p.timer = Math.min(p.timer, .5);
      if (p.timer <= 0) { if (p.mode === 'flat') say('up', p); p.mode = back(p); p.timer = 0; }
      continue;
    }
    // A car that runs one over flattens it.
    if (cars.some(c => c.v > 1.5 && under(c, p.position))) { p.mode = 'flat'; p.timer = R.flat; p.seeing = false; say('flat', p); continue; }
    // Walking into one is its fight, whatever it was doing.
    if (!safe && dist(p.position, at) <= R.touch) { say('caught', p); return; }
    const d = dist(p.position, at), twin = byId(p.twin);

    // ——— El Castigado: facing the wall until it bursts ———
    if (p.kind === 'castigado' && !p.burst) {
      p.seeing = false;
      if (noisy && d <= R.rageNear) {
        p.heard = (p.heard ?? 0) + dt;
        if (p.heard >= R.rageEvery) {
          p.heard = 0; p.rage = (p.rage ?? 0) + 1;
          if (p.rage < R.rage) say('rage', p);
          else {
            // It bursts: everyone within earshot knows where Gerard is, and it runs at him for good.
            p.burst = true; p.mode = 'chase'; p.timer = 0; p.known = { ...at }; say('burst', p);
            for (const q of street.pupils) if (q !== p && ['patrol', 'return', 'search', 'alert'].includes(q.mode) && dist(q.position, p.position) <= R.alarm) search(q, at);
          }
        }
      } else p.heard = 0;
      continue;
    }
    // ——— La Delegada in her room (the castle): she stands until she has him, or La Chivata tells her ———
    if (p.kind === 'delegada' && p.waits) {
      p.seeing = sees(p, false);
      if (!p.seeing) continue;
      p.waits = false; say('order', p);
    }
    // ——— Those that never lose him: La Delegada at a walk, El Castigado burst at a run ———
    if (p.kind === 'delegada' || p.burst) {
      p.mode = 'chase'; p.seeing = !safe; p.known = { ...at };
      walk(p, at, p.kind === 'delegada' ? Math.max(tier.walk * R.march, R.marchLeast) : tier.run * R.fury);
      if (caught(p)) { say('caught', p); return; }
      continue;
    }
    // ——— El Repetidor's charge ———
    if (p.mode === 'windup') {
      p.timer -= dt;
      if (p.timer > R.lock && d > 1e-3) { face(p, at); p.dir = { x: (at.x - p.position.x) / d, z: (at.z - p.position.z) / d }; }
      if (p.timer <= 0) { p.mode = 'charge'; p.ran = 0; say('charge', p); }
      continue;
    }
    if (p.mode === 'charge') {
      const dir = p.dir ?? { x: 0, z: 1 }, move = R.chargeSpeed * dt, next = { x: p.position.x + dir.x * move, z: p.position.z + dir.z * move };
      if (!canWalk(round(next), grid)) { p.mode = 'stunned'; p.timer = R.crash; p.seeing = false; say('crash', p); continue; }
      const hit = !safe && segment(p.position, next, at) <= REACH;
      p.position = next; p.ran = (p.ran ?? 0) + move;
      if (hit) { say('caught', p); return; }
      if (p.ran >= R.chargeLength) { p.mode = 'stunned'; p.timer = R.spent; p.seeing = false; }
      continue;
    }
    // ——— La Chivata pointing ———
    if (p.mode === 'point') {
      p.seeing = sees(p, true);
      if (p.seeing) {
        p.timer = 0; p.known = { ...at };
        const far = sightOf(tier, lit, true) * R.far;
        // She keeps her distance, and keeps him in sight.
        if (d < R.keep && d > 1e-3) walk(p, { x: p.position.x - (at.x - p.position.x) / d * 3, z: p.position.z - (at.z - p.position.z) / d * 3 }, tier.run);
        else if (d > far * .8) walk(p, at, tier.walk);
        face(p, at);
      } else if ((p.timer += dt) >= R.lose) { search(p, p.known); say('lost', p); }
      continue;
    }

    // ——— Everyone else, and La Chivata and El Montón until they have him ———
    const walkSpeed = p.kind === 'repetidor' ? tier.walk * .8 : p.kind === 'chivata' ? tier.walk * 1.2 : p.kind === 'monton' ? tier.walk * .5 : tier.walk;
    const runSpeed = p.kind === 'repetidor' ? tier.run * R.lumber : tier.run;
    switch (p.mode) {
      case 'patrol': case 'return': {
        // A Gemelo whose twin has him needs no look of its own.
        if (twin?.mode === 'chase' && twin.seeing && !hiddenFrom(p)) { engage(p); break; }
        p.seeing = sees(p, false);
        if (p.seeing) { p.mode = 'alert'; p.timer = street.marching ? R.hesitate * R.ordered : R.hesitate; p.known = { ...at }; face(p, at); say('alert', p); break; }
        if (hears(p)) { search(p, at); say('heard', p); break; }
        const target = p.mode === 'return' ? p.patrol.reduce((a, b) => dist(a, p.position) <= dist(b, p.position) ? a : b) : p.patrol[p.next];
        walk(p, target, walkSpeed);
        if (dist(p.position, target) < .2 || p.stuck > 1) {
          p.stuck = 0;
          if (p.mode === 'return') { p.mode = 'patrol'; p.next = (p.patrol.indexOf(target) + 1) % p.patrol.length; }
          else p.next = (p.next + 1) % p.patrol.length;
        }
        break;
      }
      case 'alert': {
        face(p, at);
        p.seeing = sees(p, true);
        if (p.seeing) p.known = { ...at };
        if ((p.timer -= dt) > 0) break;
        if (p.seeing) engage(p); else search(p, p.known);
        break;
      }
      case 'search': {
        p.seeing = sees(p, true);
        if (p.seeing) { engage(p); break; }
        if (hears(p)) { p.known = { ...at }; p.look = R.search; p.stuck = 0; }
        if (dist(p.position, p.known) > .6 && p.stuck < .8) { walk(p, p.known, (walkSpeed + runSpeed) / 2); break; }
        p.look -= dt; p.facing += 150 * dt;
        if (p.look > 0) break;
        // El Empollón goes to check the nearest cover of the kind it has learned before it gives up.
        if (p.kind === 'empollon' && street.learned && !p.checked) {
          p.checked = true;
          const known = street.covers.filter(c => c.kind === street.learned && dist(c, p.position) <= R.check).sort((a, b) => dist(a, p.position) - dist(b, p.position))[0];
          if (known) { p.known = { x: known.x, z: known.z }; p.look = R.search / 2; p.stuck = 0; break; }
        }
        // And what hid Gerard from it this time, it knows from now on (the last one only: alternate, as inside).
        if (p.kind === 'empollon' && cover && cover.kind !== street.learned && d <= R.learnNear) { street.learned = cover.kind; street.fresh = cover; say('learned', p); }
        p.mode = 'return'; p.stuck = 0; say('lost', p);
        break;
      }
      case 'chase': {
        if (p.kind === 'monton') {
          // It does what Gerard does, and needs no sight of him to do it.
          p.pace = prey.pace; p.seeing = !safe; p.known = { ...at };
          if (d > R.forget) { p.mode = 'return'; delete p.pace; say('lost', p); break; }
          if (prey.pace !== 'still') walk(p, at, prey.pace === 'run' ? R.mimicRun : R.mimicWalk);
          if (caught(p)) { say('caught', p); return; }
          break;
        }
        // Los Gemelos share what either of them sees or hears.
        const shared = !!twin && twin.mode === 'chase' && !hiddenFrom(p);
        p.seeing = sees(p, true) || (shared && twin!.seeing);
        const knows = p.seeing || hears(p) || (shared && noisy && dist(twin!.position, at) <= R.hear);
        if (knows) { p.known = { ...at }; p.timer = 0; }
        // With La Delegada standing nobody gives up: they wait where they last had him.
        else if (!street.marching) p.timer += dt;
        if (p.timer >= R.giveUp) { p.flanking = false; search(p, p.known); break; }
        if (p.kind === 'repetidor' && p.seeing && d <= R.chargeFrom && d >= R.chargeNear && clearLine(grid, p.position, at)) {
          p.mode = 'windup'; p.timer = R.windup; face(p, at); p.dir = { x: (at.x - p.position.x) / d, z: (at.z - p.position.z) / d }; say('windup', p);
          break;
        }
        // Of two Gemelos after him, the one further off runs round to where he is going.
        let target = p.known;
        const cuts = p.kind === 'gemelo' && !!twin && twin.mode === 'chase' && knows && prey.pace !== 'still' && d > R.close
          && (d > dist(twin.position, at) || (d === dist(twin.position, at) && p.id > twin.id));
        if (cuts) {
          const ahead = { x: at.x + prey.heading.x * R.lead, z: at.z + prey.heading.z * R.lead };
          if (canWalk(round(ahead), grid)) target = ahead;
          if (!p.flanking) { p.flanking = true; say('flank', p); }
        } else p.flanking = false;
        if (dist(p.position, target) > .3) walk(p, target, runSpeed);
        if (caught(p)) { say('caught', p); return; }
        break;
      }
    }
  }
}
/** Whether `at` is under the vehicle `car`: inside its box, a little over. */
function under(car: Car, at: Cell) {
  const dx = at.x - car.x, dz = at.z - car.z;
  return Math.abs(dx * car.hx + dz * car.hz) <= car.length / 2 + .3 && Math.abs(-dx * car.hz + dz * car.hx) <= car.width / 2 + .3;
}
