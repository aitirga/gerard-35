/**
 * The balance bench (docs/fight-sim.md § The balance bench): what turns the fight simulator's rows
 * into decisions. A loss that says how far a set of fights is from what it is meant to be (`miss`),
 * a search that finds the numbers that bring it to nothing (`optimize`), the numbers that move a
 * fight and by how much (`levers`), what each skill is worth and what happens without it
 * (`skillReport`), what nobody measures yet (`coverage`), how the party's growth carries through
 * the story (`progressLines`) and what each fight should be as the party grows (`curveGoals`). Pure: whoever calls hands in how rows are played (`Play`), here and
 * now (`inline`) or shared among threads (scripts/fight-sim-pool.mjs).
 */
import { ANIMA_NAMES, DUALS, SKILLS, kitIn, skillKnown, type ClassId } from './battle.ts';
import { LEVELLED, topOf } from './levels.ts';
import {
  CASTLE_STAGE_IDS, DUO, FIGHTS, FIRST_FIGHTS, MISSIONS, MISSION_IDS, PAIR, STRETCHES, TARGETS, createFight, playFight, seeded, simulate, storyJobs, storyPoint, stretchOf, targetSetup, tunables, watchReads, withTuning,
  type Ban, type CastleStageId, type MissionId, type Policy, type Row, type Setup, type StoryJob, type StoryPoint, type Target, type Tuning,
} from './battle-sim.ts';

/** One row to play: a setup, how many fights, the seed and the numbers tried. */
export interface Job { setup: Setup; runs: number; seed: number; tuning: Tuning }
/** How rows get played: every job's row, in the order given. */
export type Play = (jobs: Job[]) => Promise<Row[]>;
/** Here and now, one after another: for tests and small jobs. */
export const inline: Play = async jobs => jobs.map(job => simulate(job.setup, job.runs, job.seed, job.tuning));

// ── What a fight is meant to be, as a distance ───────────────────────────
export type Wanted = Pick<Target, 'win' | 'roundsLost' | 'hpLeftWon' | 'roundsWon' | 'duals'>;
/** A setup and the ranges its row should fall in: a target, or half of a story point's pair. */
export interface Goal { id: string; setup: Setup; want: Wanted; why?: string }
export const targetGoals = (targets: readonly Target[] = TARGETS): Goal[] =>
  targets.map(target => ({ id: target.id, setup: targetSetup(target), want: { win: target.win, roundsLost: target.roundsLost, hpLeftWon: target.hpLeftWon, roundsWon: target.roundsWon, duals: target.duals }, why: target.why }));
/** The pair of every fight that asks a question, as each story point's party meets it: `smart` wins, `casual` does not (`PAIR`). */
export function pairGoals(points: StoryPoint[], options: { fights?: string[]; party?: string } = {}): Goal[] {
  return storyJobs(points, ['smart', 'casual'], options).filter(job => !teaches(job.setup.fight)).map(job => ({
    id: `${job.setup.fight}@${job.at}/${job.build}:${job.setup.policy}`, setup: job.setup,
    want: job.setup.policy === 'smart' ? { win: [PAIR.with, 1] } : { win: [0, PAIR.without] },
  }));
}
// ── What a fight should be as the party grows ────────────────────────────
/**
 * How many side missions each stretch of the castle asks for (docs/fight-sim.md § Power and the castle): Aurelià one
 * (Aitor, 2026-11-23: with Papagato and Freática at 2 or 3, «un reto pero no imposible»), Dirección three, the Queen all four. The night on the Meridiana, met before the castle, asks for one: Aitor says so
 * when he sees them (src/night.ts `sizeUp`: with Nuria's ánima alone, «mejor no probarlo»).
 */
export const CASTLE_ASKS: Record<CastleStageId, number> = { 'castillo-1': 1, 'castillo-2': 3, 'castillo-3': 4 };
const NIGHT_ASKS = 1;
/** The groups the night's hunters bring before the castle (src/castle.ts `nightGroup`, first floor), the elite last. */
const NIGHT_ROOMS = ['alumnos-1a', 'alumnos-1b', 'alumnos-1c', 'delegada-1'] as const;
/** The fights that say no to a party with fewer side missions than they ask for, and that a careless one never takes. */
const BOSSES = ['aurelia', 'direccion'];
/** Fights the curve leaves out: the Queen's return is won by the melody (the artilugio), not by what the party has grown. */
const OFF_CURVE = ['reina-vuelta'];
/**
 * What each fight should be as the party grows (Aitor, 2026-11-22: «está bien sentirse más poderoso»; the castle and the
 * night «no escalen tanto con la progresión del jugador, para medir su capacidad»; the side missions «deben siempre ser
 * un reto, porque es no-lineal el progreso y el orden»).
 * - `side`: a side mission's fights that ask something, in whatever order it is done: `smart` wins, ending with a share
 *   of its PV in `hp` (the top rises `power` for each mission behind it: growing is felt, but never as a walk) in
 *   `rounds` at most (a foe that grows is harder, not longer), and `casual` wins `casual` at most.
 * - `gate`: the castle's and the night's, which do not grow with the party. With fewer side missions than they ask
 *   for, a boss (or the night's elite) says no: `smart` wins `short` at most. With what they ask, a challenge
 *   (`asked`; a room, which three careless blows can tip, lets `casual` win `room` at most). With more, the party's
 *   power (`more`): `smart` wins almost always, by as much as it likes, and a careless one still loses a boss.
 */
export const CURVE = {
  side: { smart: .9, hp: [.2, .6] as [number, number], power: .05, casual: .25, rounds: 12 },
  gate: { short: .5, asked: { smart: .85, hp: [.15, .65] as [number, number], casual: .25, room: .6 }, more: { smart: .95, casual: .5 } },
};
/** Where a goal of the curve stands: a side mission with `behind` others done, or a gate with fewer, as many or more than it asks. */
export type CurveKind = 'side' | 'short' | 'asked' | 'more';
export interface CurveGoal extends Goal { at: string; fight: string; kind: CurveKind; behind: number; policy: Policy }
export interface CurveOptions {
  /** Only these fights (a mission's, a floor's, `night-guard:<room>`); by default every one that asks something. */
  fights?: string[];
  /** The open missions already done (`emilie`): only the orders that start from where the player is. */
  done?: MissionId[];
  /** `ends` (default): one order for each number of missions behind; `all`: every order. */
  orders?: 'ends' | 'all';
  party?: string; build?: string;
}
const OPEN = () => MISSION_IDS.filter(id => !MISSIONS[id].intro);
/** Every set of `pool` with `size` members that holds all of `must`, in a stable order; `ends` keeps one, turning with `turn`. */
function setsOf(pool: MissionId[], size: number, must: MissionId[], orders: 'ends' | 'all', turn: number): MissionId[][] {
  const out: MissionId[][] = [];
  const walk = (from: number, picked: MissionId[]) => {
    // The missions done come first, in the order given: a shared ánima's level counts from its friend's mission on.
    if (picked.length === size) { if (must.every(id => picked.includes(id))) out.push([...must, ...picked.filter(id => !must.includes(id))]); return; }
    for (let i = from; i < pool.length; i++) walk(i + 1, [...picked, pool[i]]);
  };
  walk(0, []);
  return orders === 'all' || out.length <= 1 ? out : [out[turn % out.length]];
}
const named = (id: string, behind: MissionId[], all: number) => !behind.length ? `${id}:first` : behind.length === all ? `${id}:last` : `${id}:${behind.join('/')}`;
/**
 * The curve's goals: each side mission's fights at each number of missions behind it, and the castle's and the night's at
 * one fewer side mission than they ask, as many, and every one (`CURVE`). With `done`, only the orders that start where
 * the player is: the missions done are behind every point, and are not played again.
 */
export function curveGoals(options: CurveOptions = {}): CurveGoal[] {
  const open = OPEN(), done = options.done ?? [], orders = options.orders ?? 'ends', build = options.build ?? 'mixto', party = options.party ?? DUO;
  for (const id of done) if (!open.includes(id)) throw new Error(`"${id}" is not an open mission: use ${open.join(', ')}.`);
  const wanted = (fight: string) => !options.fights || options.fights.includes(fight) || options.fights.includes(fight.split(':')[0]);
  const goals: CurveGoal[] = [];
  const add = (at: string, point: StoryPoint, fight: string, kind: CurveKind, behind: number, boss: boolean) => {
    const { side, gate } = CURVE;
    const want = (policy: Policy): Wanted | undefined => kind === 'side'
      ? policy === 'smart' ? { win: [side.smart, 1], hpLeftWon: [side.hp[0], Math.min(1, side.hp[1] + side.power * behind)], roundsWon: [0, side.rounds] } : { win: [0, side.casual] }
      : kind === 'short' ? policy === 'smart' ? { win: [0, gate.short] } : undefined
      : kind === 'asked' ? policy === 'smart' ? { win: [gate.asked.smart, 1], hpLeftWon: gate.asked.hp } : { win: [0, boss ? gate.asked.casual : gate.asked.room] }
      : policy === 'smart' ? { win: [gate.more.smart, 1] } : boss ? { win: [0, gate.more.casual] } : undefined;
    for (const policy of ['smart', 'casual'] as const) {
      const w = want(policy);
      if (w) goals.push({ id: `${fight}@${at}:${policy}`, at, fight, kind, behind, policy, setup: { fight, party, policy, ...point.setup }, want: w });
    }
  };
  // The side missions, in whatever order they come.
  for (const [turn, id] of open.entries()) {
    if (done.includes(id)) continue;
    const others = open.filter(other => other !== id), fights = STRETCHES[id].fights.filter(f => !teaches(f) && wanted(f));
    if (!fights.length) continue;
    for (let size = done.length; size <= others.length; size++) for (const behind of setsOf(others, size, done, orders, turn)) {
      const at = named(id, behind, others.length), point = storyPoint(at, build);
      for (const fight of fights) add(at, point, fight, 'side', behind.length, false);
    }
  }
  // The castle: one side mission fewer than a stretch asks for, as many, and all.
  for (const [turn, stage] of CASTLE_STAGE_IDS.entries()) {
    const asks = CASTLE_ASKS[stage], fights = STRETCHES[stage].fights.filter(f => !teaches(f) && !OFF_CURVE.includes(f) && wanted(f));
    if (!fights.length) continue;
    for (const [size, kind] of [[asks - 1, 'short'], [asks, 'asked'], [open.length, 'more']] as const) {
      if (size < done.length || size < 0 || (kind === 'more' && asks === open.length)) continue;
      for (const behind of setsOf(open, size, done, orders, turn)) {
        const at = behind.length === open.length ? stage : `${stage}:${behind.join('/') || 'none'}`, point = storyPoint(at, build);
        for (const fight of fights) if (kind !== 'short' || BOSSES.includes(fight)) add(at, point, fight, kind, size, BOSSES.includes(fight));
      }
    }
  }
  // The night before the castle: met on the way home from any mission (the last one's, with every other behind it).
  const nights = NIGHT_ROOMS.map(room => `night-guard:${room}`).filter(wanted);
  if (nights.length) for (const [size, kind] of [[NIGHT_ASKS - 1, 'short'], [NIGHT_ASKS, 'asked'], [open.length - 1, 'more']] as const) {
    if (size < done.length) continue;
    for (const behind of setsOf(open, size, done, orders, 1)) {
      const id = open.find(other => !behind.includes(other))!, at = named(id, behind, open.length - 1), point = storyPoint(at, build);
      for (const fight of nights) if (kind !== 'short' || fight.endsWith('delegada-1')) add(`noche·${at}`, point, fight, kind, size, fight.endsWith('delegada-1'));
    }
  }
  return goals;
}
/** Whether a target asks for something to happen in its fight at least once (`Target.happens`). */
const reaches = (target: Target) => Object.values(target.happens ?? {}).some(range => range[0] >= 1);
const teaches = (fight: string) => { const stretch = stretchOf(fight); return FIRST_FIGHTS.includes(fight) || !!stretch && STRETCHES[stretch].teaching.includes(fight); };
/** What one step of the loss is, for each thing a goal can ask: ten points of wins, ten of PV, a round, half a dual. */
const UNITS = { win: .1, hpLeftWon: .1, roundsWon: 1, roundsLost: 1, duals: .5 } as const;
/** Where a number cannot go any further: a range that ends there has no edge to keep away from. */
const LIMITS: Partial<Record<keyof typeof UNITS, readonly [number, number]>> = { win: [0, 1], hpLeftWon: [0, 1] };
/** A range held by less than `EDGE` steps still costs a little (`EDGE_WEIGHT`): the search ends inside it, not on its line, where another seed would fall out. */
const EDGE = .3, EDGE_WEIGHT = .2;
/**
 * How far `row` is from what `want` asks, in steps (`UNITS`): 0 is held with room to spare, 1 is
 * wins ten points out of range. Wins count whole, the rest half; a fight that does not end, ten each.
 */
export function miss(want: Wanted, row: Row) {
  let total = row.draws / Math.max(1, row.runs) * 10;
  for (const key of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
    const range = want[key], value = row[key];
    if (!range || value === null) continue;
    const unit = UNITS[key], [low, high] = range, [floor, ceiling] = LIMITS[key] ?? [-Infinity, Infinity];
    const gap = Math.max(0, low - value, value - high), out = gap < 1e-9 ? 0 : gap / unit;
    const room = Math.min(low > floor ? value - low : Infinity, high < ceiling ? high - value : Infinity) / unit;
    const edge = out > 0 || (high - low) / unit < 2 * EDGE ? 0 : Math.max(0, EDGE - room);
    total += (key === 'win' ? 1 : .5) * (out + EDGE_WEIGHT * edge);
  }
  return Number(total.toFixed(9));
}

// ── What a fight is made of ──────────────────────────────────────────────
/** The numbers `setup`'s fight reads when it is played (`book.id.field`), from a few fights of it. */
export function readsOf(setup: Setup, fights = 2): Set<string> {
  return watchReads(() => { for (let i = 0; i < fights; i++) playFight(setup, 101 + i * 7919); }).read;
}
/**
 * Whose a number is. `fight`: the fight's own (its foes, its rules); `party`: what the party brings
 * to every fight (skills, duals, what an ánima adds, Gerard's and Aitor's own stats); `all`: those
 * and the rules every fight shares (the elements, EXP, the castle's caps).
 */
export type Scope = 'fight' | 'party' | 'all';
/** A target plays «without the answer» when it wins four in five at most (it was half until cures gave back half the PV, 2026-11-21: the careless last longer). */
const WITHOUT = .8;
const PARTY_BOOKS = ['skill', 'dual', 'class', 'growth', 'heal'], SHARED_BOOKS = ['reaction', 'element', 'powder', 'crit', 'level', 'xp', 'stage', 'foes'];
const PARTY_PROFILES = ['foe.gerard.', 'foe.bernat.', 'foe.gerard35.', 'foe.aitor.'];
export function inScope(path: string, scope: Scope) {
  const [book, id] = path.split('.');
  // How a fight grows with the ánimas gathered (`foes.<fight>`) is the fight's own; the rule for all and the blows' are shared.
  if (book === 'foes' && id !== 'growth' && id !== 'blow') return scope !== 'party';
  const party = PARTY_BOOKS.includes(book) || PARTY_PROFILES.some(prefix => path.startsWith(prefix));
  return scope === 'all' || (scope === 'party' ? party : !party && !SHARED_BOOKS.includes(book));
}

// ── Numbers to search ────────────────────────────────────────────────────
/** A number the search may move: where it is, how far it may go, and the smallest change worth trying. */
export interface Variable { path: string; now: number; min: number; max: number; step: number }
const nice = (x: number) => { const power = 10 ** Math.floor(Math.log10(x)), m = x / power; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power; };
/**
 * `path` as a variable. `spec`: `10..20`, or `10..20/2` with its step; without one, 40 % either side
 * of what it is now (2 at least for a whole number). Whole numbers move by 1, the rest by a
 * twentieth of their range, unless a step is given.
 */
export function variable(path: string, spec?: string, numbers: Record<string, number> = tunables()): Variable {
  const now = numbers[path];
  if (now === undefined) throw new Error(`Nothing to tune at "${path}": see the numbers with just fight-sim levers.`);
  let min: number, max: number, step: number | undefined;
  if (spec) {
    const [range, by] = spec.split('/');
    [min, max] = range.split('..').map(Number);
    step = by === undefined ? undefined : Number(by);
    if (![min, max, step ?? 1].every(Number.isFinite) || min >= max || (step ?? 1) <= 0) throw new Error(`A range is "low..high" or "low..high/step", not "${spec}".`);
  } else {
    const whole = Number.isInteger(now), reach = Math.max(Math.abs(now) * .4, whole ? 2 : .2);
    min = now >= 0 ? Math.max(0, now - reach) : now - reach; max = now + reach;
    if (whole) { min = Math.floor(min); max = Math.ceil(max); }
  }
  step ??= [now, min, max].every(Number.isInteger) ? 1 : nice((max - min) / 20);
  return { path, now, min, max, step };
}
/** `x` on the variable's own grid (steps from where it is now), inside its range. */
const snap = (v: Variable, x: number) => Number(Math.min(v.max, Math.max(v.min, v.now + Math.round((x - v.now) / v.step) * v.step)).toFixed(6));

// ── The search ───────────────────────────────────────────────────────────
export interface Search {
  variables: Variable[]; goals: Goal[]; play: Play;
  /** Numbers held where they are tried, under the variables. */
  base?: Tuning;
  /** Fights per row while searching (80), the seed (35), and how many sets of numbers it may try (60). */
  runs?: number; seed?: number; budget?: number;
  /** How much staying near today's numbers counts: with two answers as good, the smaller change wins (.1 a variable's whole range). */
  keep?: number;
  /** Fights per row for the last word, with another seed (200). */
  checkRuns?: number;
  say?: (line: string) => void;
}
export interface Scored { x: number[]; tuning: Tuning; missed: number; loss: number; rows: Row[]; misses: number[] }
export interface Found {
  variables: Variable[]; goals: Goal[]; runs: number; seed: number; tried: number;
  /** Today's numbers and the best found, as the search saw them. */
  start: Scored; best: Scored;
  /** Both again with more fights and another seed: what to believe. */
  checked: { runs: number; seed: number; start: Scored; best: Scored };
  /** Every step that got nearer, in order. */
  trail: { tuning: Tuning; loss: number; missed: number }[];
}
/**
 * The numbers that bring `goals` closest to what they ask (`miss`, added up), moving only
 * `variables`. Every set of numbers is played with the same seeds, so the loss is a plain function
 * of them and two sets differ by what they are, not by luck. First a spread of tries over the whole
 * range (a Latin hypercube), so a start in a flat place (a fight never won) is not the end; then from
 * the best of them a compass search: each variable a step up and down, to the best neighbour, steps
 * halved when none is better, until the steps are the smallest and nothing improves. The last word
 * is another seed with more fights (`checked`): a search this greedy can fit one seed's luck.
 */
export async function optimize(search: Search): Promise<Found> {
  const { variables, goals, play, base = {} } = search, runs = search.runs ?? 80, seed = search.seed ?? 35, budget = search.budget ?? 60, keep = search.keep ?? .1;
  if (!variables.length || !goals.length) throw new Error('A search needs a number to move and a goal to hold.');
  const key = (x: number[]) => x.join(','), seen = new Map<string, Scored>(), trail: Found['trail'] = [];
  const tuningOf = (x: number[]): Tuning => Object.fromEntries(variables.map((v, i) => [v.path, x[i]]));
  const far = (x: number[]) => variables.reduce((sum, v, i) => sum + Math.abs(x[i] - v.now) / (v.max - v.min), 0);
  const measure = async (points: number[][], n: number, s: number): Promise<Scored[]> => {
    const rows = await play(points.flatMap(x => goals.map(goal => ({ setup: goal.setup, runs: n, seed: s, tuning: { ...base, ...tuningOf(x) } }))));
    return points.map((x, i) => {
      const mine = rows.slice(i * goals.length, (i + 1) * goals.length), misses = mine.map((row, g) => miss(goals[g].want, row)), missed = misses.reduce((sum, m) => sum + m, 0);
      return { x, tuning: tuningOf(x), missed, loss: missed + keep * far(x), rows: mine, misses };
    });
  };
  const score = async (points: number[][]) => {
    const fresh = [...new Map(points.filter(x => !seen.has(key(x))).map(x => [key(x), x])).values()].slice(0, Math.max(0, budget - seen.size));
    for (const scored of fresh.length ? await measure(fresh, runs, seed) : []) seen.set(key(scored.x), scored);
    return points.flatMap(x => seen.get(key(x)) ?? []);
  };
  const better = (list: Scored[]) => list.reduce<Scored | undefined>((top, s) => !top || s.loss < top.loss ? s : top, undefined);
  const start = (await score([variables.map(v => v.now)]))[0];
  let here = start;
  const step = (to: Scored) => { here = to; trail.push({ tuning: to.tuning, loss: to.loss, missed: to.missed }); search.say?.(`  ${to.missed.toFixed(2)}  ${Object.entries(to.tuning).map(([path, n]) => `${path}=${n}`).join(' ')}`); };
  // A spread over the whole range, each variable's range cut in as many slices as tries and each slice used once.
  const random = seeded(seed), spread = Math.min(Math.floor(budget / 3), 3 * variables.length + 2);
  if (start.missed > 0 && spread > 1) {
    const slices = variables.map(() => Array.from({ length: spread }, (_, i) => i).sort(() => random() - .5));
    const widest = better(await score(Array.from({ length: spread }, (_, k) => variables.map((v, i) => snap(v, v.min + (slices[i][k] + random()) / spread * (v.max - v.min))))));
    if (widest && widest.loss < here.loss - 1e-9) step(widest);
  }
  let steps = variables.map(v => Math.max(v.step, Math.round((v.max - v.min) / 4 / v.step) * v.step));
  while (seen.size < budget) {
    const around = variables.flatMap((v, i) => [-1, 1].map(sign => here.x.map((value, j) => j === i ? snap(v, value + sign * steps[i]) : value))).filter(x => key(x) !== key(here.x));
    const top = better(await score(around));
    if (top && top.loss < here.loss - 1e-9) { step(top); continue; }
    if (steps.every((s, i) => s <= variables[i].step)) break;
    steps = steps.map((s, i) => Math.max(variables[i].step, Math.round(s / 2 / variables[i].step) * variables[i].step));
  }
  const checkRuns = search.checkRuns ?? 200, checkSeed = seed + 7_000_003;
  const [startAgain, bestAgain] = await measure([start.x, here.x], checkRuns, checkSeed);
  return { variables, goals, runs, seed, tried: seen.size, start, best: here, checked: { runs: checkRuns, seed: checkSeed, start: startAgain, best: bestAgain }, trail };
}

// ── The numbers that move a fight ────────────────────────────────────────
export interface Lever {
  path: string; now: number; low: number; high: number;
  /** The goals that read it, with their wins at the low value, as it is and at the high one. */
  goals: { id: string; policy: Policy; win: [number, number, number]; hpLeftWon: [number | null, number | null, number | null]; roundsWon: [number | null, number | null, number | null] }[];
  /** The most any goal's wins move from the low value to the high one. */
  swing: number;
  /** How raising it moves the goals that should win against those that should not (points of wins): above 0 it pulls a pair apart, below it pushes it together. */
  apart: number;
  /** The loss at the low value, as it is and at the high one, over the goals that read it. */
  loss: [number, number, number];
}
/**
 * Each number `goals`' fights read (within `scope`, or `paths`), moved `delta` down and up (a fifth;
 * a whole number at least 1), and what that does to each goal that reads it: which numbers a fight
 * turns on, and which way. Sorted by how much they move the wins.
 */
export async function levers(options: { goals: Goal[]; play: Play; runs?: number; seed?: number; delta?: number; scope?: Scope; paths?: string[]; base?: Tuning }): Promise<{ base: Row[]; levers: Lever[] }> {
  const { goals, play, base = {} } = options, runs = options.runs ?? 80, seed = options.seed ?? 35, delta = options.delta ?? .2;
  const numbers = withTuning(base, tunables), reads = withTuning(base, () => goals.map(goal => readsOf(goal.setup)));
  const paths = (options.paths ?? [...new Set(reads.flatMap(read => [...read]))].filter(path => inScope(path, options.scope ?? 'fight'))).sort();
  const plan = paths.map(path => {
    const now = numbers[path];
    if (now === undefined) throw new Error(`Nothing to tune at "${path}".`);
    const by = Number.isInteger(now) ? Math.max(1, Math.round(Math.abs(now) * delta)) : now === 0 ? .1 : Math.abs(now) * delta;
    const low = Number((now >= 0 ? Math.max(0, now - by) : now - by).toFixed(6)), high = Number((now + by).toFixed(6));
    return { path, now, low, high, who: goals.map((_, i) => i).filter(i => options.paths || reads[i].has(path)) };
  }).filter(lever => lever.who.length);
  const job = (i: number, tuning: Tuning): Job => ({ setup: goals[i].setup, runs, seed, tuning: { ...base, ...tuning } });
  const rows = await play([...goals.map((_, i) => job(i, {})), ...plan.flatMap(lever => lever.who.flatMap(i => [job(i, { [lever.path]: lever.low }), job(i, { [lever.path]: lever.high })]))]);
  const baseRows = rows.slice(0, goals.length);
  let at = goals.length;
  const out = plan.map(({ path, now, low, high, who }): Lever => {
    const mine = who.map(i => ({ i, low: rows[at++], high: rows[at++], base: baseRows[i] }));
    const sum = (pick: (m: (typeof mine)[number]) => Row) => mine.reduce((total, m) => total + miss(goals[m.i].want, pick(m)), 0);
    // A goal that should win has a floor to its wins; one that should not, a ceiling.
    const side = (i: number) => { const win = goals[i].want.win; return !win ? 0 : win[0] >= .5 ? 1 : win[1] <= .5 ? -1 : 0; };
    return {
      path, now, low, high,
      goals: mine.map(m => ({ id: goals[m.i].id, policy: goals[m.i].setup.policy, win: [m.low.win, m.base.win, m.high.win], hpLeftWon: [m.low.hpLeftWon, m.base.hpLeftWon, m.high.hpLeftWon], roundsWon: [m.low.roundsWon, m.base.roundsWon, m.high.roundsWon] })),
      swing: Math.max(...mine.map(m => Math.abs(m.high.win - m.low.win))),
      apart: Number(mine.reduce((total, m) => total + side(m.i) * (m.high.win - m.low.win), 0).toFixed(3)),
      loss: [sum(m => m.low), sum(m => m.base), sum(m => m.high)].map(n => Number(n.toFixed(2))) as [number, number, number],
    };
  });
  return { base: baseRows, levers: out.sort((a, b) => b.swing - a.swing || Math.abs(b.loss[2] - b.loss[0]) - Math.abs(a.loss[2] - a.loss[0])) };
}

// ── What each skill is worth ─────────────────────────────────────────────
export type SkillFlag = 'unused' | 'decides' | 'dominates' | 'idle' | 'cheap' | 'dear';
export interface SkillLine {
  id: string; name: string; anima?: ClassId; kind: 'skill' | 'dual' | 'attack' | 'defend'; cost: number;
  /** Setups whose party knows it and can wear its ánima, and those where the bot used it. */
  known: number; usedIn: number;
  /** Uses per fight and share of the party's damage, over the setups that know it. */
  uses: number; share: number;
  /** PV off the foes per use, and per point of maná. */
  perUse: number | null; perMana: number | null;
  /** Without it (banned), over the setups it was used in: wins lost on average and at most, rounds a win takes more, PV left less. */
  drop: number | null; worst: number | null; rounds: number | null; hp: number | null;
  /** The setups it decides: wins fall `DECIDES` or more without it. */
  decides: { fight: string; party: string; drop: number }[];
  flags: SkillFlag[];
}
/** Wins lost without a skill for it to decide a fight; the damage share that is dominating; and what no change at all is. */
const DECIDES = .3, DOMINATES = .5, IDLE = { win: .03, rounds: .3, hp: .03 };
/** The ánimas `setup`'s party can wear in the fight, and the skills it knows of them. */
function kitOf(setup: Setup) {
  const state = createFight(setup, seeded(1)), animas = new Set(state.allies.flatMap(ally => [...ally.classId ? [ally.classId] : [], ...kitIn(state, ally)]));
  return SKILLS.filter(skill => animas.has(skill.class) && skillKnown(skill.id, state.levels, state.improved)).map(skill => skill.id as string);
}
/**
 * Every action of the party over `setups` (played by their own bot, `smart` to mean anything): how
 * much it is used, what it takes off, what a point of maná buys with it, and what the fight becomes
 * without it: each one used is banned in turn and the same fights played again. A skill is `unused`
 * if the bot knows it everywhere and never picks it (it may be useless, or the bot may not value it),
 * `decides` a fight that is lost without it, `dominates` when it does half the damage wherever it is
 * known, is `idle` when banning it changes nothing anywhere, and `cheap` or `dear` when a point of
 * maná buys far more or less with it than with the rest of its ánima.
 */
export async function skillReport(options: { setups: Setup[]; play: Play; runs?: number; seed?: number; tuning?: Tuning; least?: number }): Promise<{ base: Row[]; lines: SkillLine[] }> {
  const { setups, play, tuning = {} } = options, runs = options.runs ?? 60, seed = options.seed ?? 35, least = options.least ?? .05;
  const job = (setup: Setup): Job => ({ setup, runs, seed, tuning });
  const base = await play(setups.map(job)), kits = withTuning(tuning, () => setups.map(kitOf));
  const bans = base.flatMap((row, i) => Object.entries(row.used).filter(([id, n]) => id !== 'attack' && n >= least && !setups[i].ban?.includes(id as Ban)).map(([id]) => ({ i, id })));
  const without = await play(bans.map(({ i, id }) => job({ ...setups[i], ban: [...setups[i].ban ?? [], id as Ban] })));
  const ids = [...new Set(['attack', 'defend', ...SKILLS.map(s => s.id as string), ...DUALS.map(d => d.id as string)])];
  const mean = (list: number[]) => list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : null, r = (n: number | null, places = 2) => n === null ? null : Number(n.toFixed(places));
  const lines = ids.map((id): SkillLine => {
    const skill = SKILLS.find(s => s.id === id), dual = DUALS.find(d => d.id === id);
    const costOf = (part: string): number => SKILLS.find(s => s.id === part)?.cost ?? 0;
    const cost: number = skill ? costOf(id) : dual ? dual.parts.reduce<number>((sum, part) => sum + costOf(part), 0) : 0;
    const where = setups.map((_, i) => i).filter(i => skill ? kits[i].includes(id) : dual ? dual.parts.every(part => kits[i].includes(part)) : true);
    const uses = where.reduce((sum, i) => sum + (base[i].used[id] ?? 0), 0), dealt = where.reduce((sum, i) => sum + (base[i].dealt[id] ?? 0), 0);
    const gone = bans.flatMap((ban, n) => ban.id === id ? [{ i: ban.i, row: without[n] }] : []);
    const drops = gone.map(g => base[g.i].win - g.row.win);
    const perUse = uses > 0 && dealt > 0 ? dealt / uses : null;
    const rounds = mean(gone.flatMap(g => g.row.roundsWon === null || base[g.i].roundsWon === null ? [] : [g.row.roundsWon - base[g.i].roundsWon!]));
    const hp = mean(gone.flatMap(g => g.row.hpLeftWon === null || base[g.i].hpLeftWon === null ? [] : [base[g.i].hpLeftWon! - g.row.hpLeftWon]));
    const share = mean(where.map(i => base[i].damageShare[id] ?? 0)) ?? 0;
    const decides = gone.map((g, n) => ({ fight: setups[g.i].fight, party: setups[g.i].party, drop: r(drops[n])! })).filter(d => d.drop >= DECIDES).sort((a, b) => b.drop - a.drop);
    const flags: SkillFlag[] = [];
    // A die's face is played through Tirar dado, and Agitar takes no turn: neither is a choice the table can count.
    const counted = id !== 'defend' && !(skill && ('face' in skill || 'free' in skill));
    if (counted && where.length && !where.some(i => (base[i].used[id] ?? 0) >= least)) flags.push('unused');
    if (decides.length) flags.push('decides');
    if (id !== 'attack' && where.length >= 3 && share >= DOMINATES) flags.push('dominates');
    if (gone.length && drops.every(d => Math.abs(d) < IDLE.win) && Math.abs(rounds ?? 0) < IDLE.rounds && Math.abs(hp ?? 0) < IDLE.hp) flags.push('idle');
    return {
      id, name: skill?.name ?? dual?.name ?? (id === 'attack' ? 'Atacar' : 'Defender'), anima: skill?.class, kind: skill ? 'skill' : dual ? 'dual' : id as 'attack' | 'defend', cost,
      known: where.length, usedIn: where.filter(i => (base[i].used[id] ?? 0) >= least).length,
      uses: r(where.length ? uses / where.length : 0)!, share: r(share, 3)!, perUse: r(perUse, 1), perMana: perUse !== null && cost > 0 ? r(perUse / cost, 1) : null,
      drop: r(mean(drops), 3), worst: drops.length ? r(Math.max(...drops), 3) : null, rounds: r(rounds), hp: r(hp, 3), decides, flags,
    };
  }).filter(line => line.known && !(line.usedIn === 0 && SKILLS.some(s => s.id === line.id && ('face' in s || 'free' in s))));
  // Cheap or dear: what a point of maná buys with it, against the middle of its own ánima's skills.
  for (const anima of new Set(lines.map(line => line.anima))) {
    const paid = lines.filter(line => line.anima === anima && line.kind === 'skill' && line.perMana !== null).map(line => line.perMana!).sort((a, b) => a - b);
    if (!anima || paid.length < 3) continue;
    const middle = paid[Math.floor(paid.length / 2)];
    for (const line of lines) if (line.anima === anima && line.perMana !== null) { if (line.perMana > middle * 1.6) line.flags.push('cheap'); else if (line.perMana < middle * .6) line.flags.push('dear'); }
  }
  return { base, lines };
}

// ── What nobody measures yet ─────────────────────────────────────────────
export interface Coverage {
  /** Fights with no target that plays their answer, or none that plays without it (docs/combat.md § La respuesta de cada combate). */
  fights: { fight: string; with: string[]; without: string[] }[];
  /** Skills and duals no target's bot ever uses, and ánimas no target wears. */
  skills: { id: string; name: string; anima: ClassId }[]; duals: { id: string; name: string }[]; animas: ClassId[];
  /** Each ánima as it stands: its skills, the levels that teach them, and whether its definitiva is built. */
  kits: { anima: ClassId; name: string; skills: number; top: number; definitiva: boolean; worn: boolean; played: number }[];
  /** Numbers no target's fight reads, by book: nothing holds them to anything. */
  numbers: Record<string, string[]>;
}
/**
 * Each fight's pair as `targets` hold it (docs/combat.md § La respuesta de cada combate), without playing anything.
 * With the answer: `smart`, nothing banned, asked to win. Without: anything asked not to (a ban, `casual`, the wrong
 * party), but never Atacar alone. A fight that cannot be won (the Queen's first) is held by what happens in it instead:
 * its answer gets there, `happens` at least once. A fight that only teaches needs no pair, just something that holds it (`held`).
 */
export function pairsOf(targets: readonly Target[] = TARGETS) {
  const kindOf = (fight: string) => fight.split(':')[0];
  return FIGHTS.map(fight => {
    const mine = targets.filter(target => kindOf(target.fight) === kindOf(fight) && (fight.includes(':') ? target.fight === fight : true));
    return {
      fight, teaches: teaches(fight), held: mine.length,
      with: mine.filter(t => t.policy === 'smart' && !t.ban?.length && (t.win && t.win[0] >= .5 || reaches(t))).map(t => t.id),
      without: mine.filter(t => t.policy !== 'attack' && t.win && t.win[1] <= WITHOUT && !reaches(t)).map(t => t.id),
    };
  });
}
/**
 * What the targets leave out, measured: every target is played a little and its used actions
 * gathered, and a few of its fights are watched for the numbers they read. What is left over is what
 * the final pass has no hold on yet: fights without their pair, skills and ánimas no target plays,
 * numbers no target's fight reads.
 */
export async function coverage(options: { play: Play; runs?: number; seed?: number; targets?: readonly Target[] }): Promise<Coverage> {
  const targets = options.targets ?? TARGETS, runs = options.runs ?? 20, seed = options.seed ?? 35;
  const rows = await options.play(targets.map(target => ({ setup: targetSetup(target), runs, seed, tuning: {} })));
  const used = new Set(rows.flatMap(row => Object.entries(row.used).filter(([, n]) => n > 0).map(([id]) => id)));
  const worn = new Set(targets.flatMap(target => target.party.split('+').flatMap(entry => (entry.split(':')[1] ?? '').split('/'))));
  const read = new Set(targets.flatMap(target => [...readsOf(targetSetup(target))]));
  const numbers: Record<string, string[]> = {};
  for (const path of Object.keys(tunables())) if (!read.has(path)) (numbers[path.split('.')[0]] ??= []).push(path);
  const fights = pairsOf(targets).filter(f => !f.teaches && (!f.with.length || !f.without.length)).map(({ fight, with: played, without }) => ({ fight, with: played, without }));
  const ids = Object.keys(ANIMA_NAMES) as ClassId[];
  return {
    fights,
    skills: SKILLS.filter(skill => !used.has(skill.id)).map(skill => ({ id: skill.id, name: skill.name, anima: skill.class })),
    duals: DUALS.filter(dual => !used.has(dual.id)).map(dual => ({ id: dual.id, name: dual.name })),
    animas: ids.filter(id => !worn.has(id)),
    kits: ids.map(anima => {
      const skills = SKILLS.filter(skill => skill.class === anima);
      return { anima, name: ANIMA_NAMES[anima], skills: skills.length, top: LEVELLED.includes(anima) ? topOf(anima) : 1, definitiva: skills.some(skill => 'ulti' in skill), worn: worn.has(anima), played: skills.filter(skill => used.has(skill.id)).length };
    }),
    numbers,
  };
}

// ── How the party's growth carries through the story ────────────────────
export interface ProgressLine {
  at: string; build: string; friends: number; levels: Partial<Record<ClassId, number>>;
  /** Fights that ask a question at this point, and how many hold their pair. */
  pairs: number; held: number;
  /** Means over them: `smart`'s wins and PV left, `casual`'s wins. */
  smartWin: number; smartHp: number | null; casualWin: number;
  /** The fights that do not hold, and why: `smart` under `PAIR.with` (hard) or `casual` over `PAIR.without` (easy). */
  hard: string[]; easy: string[];
}
/** A story's rows (`storyJobs` of both bots, played), a line per point: whether the party that reaches it is the party its fights ask for. */
export function progressLines(points: StoryPoint[], jobs: StoryJob[], rows: Row[]): ProgressLine[] {
  const r = (n: number, places = 3) => Number(n.toFixed(places));
  return points.map(point => {
    const mine = jobs.map((job, i) => ({ job, row: rows[i] })).filter(m => m.job.at === point.at && m.job.build === point.build && !teaches(m.job.setup.fight));
    const fights = [...new Set(mine.map(m => m.job.setup.fight))].map(fight => ({ fight, smart: mine.find(m => m.job.setup.fight === fight && m.job.setup.policy === 'smart')?.row, casual: mine.find(m => m.job.setup.fight === fight && m.job.setup.policy === 'casual')?.row })).filter((f): f is { fight: string; smart: Row; casual: Row } => !!f.smart && !!f.casual);
    const hp = fights.flatMap(f => f.smart.hpLeftWon === null ? [] : [f.smart.hpLeftWon]), n = Math.max(1, fights.length);
    return {
      at: point.at, build: point.build, friends: point.setup.friends?.length ?? 0, levels: point.setup.levels ?? {},
      pairs: fights.length, held: fights.filter(f => f.smart.win >= PAIR.with && f.casual.win <= PAIR.without).length,
      smartWin: r(fights.reduce((sum, f) => sum + f.smart.win, 0) / n), smartHp: hp.length ? r(hp.reduce((sum, v) => sum + v, 0) / hp.length) : null,
      casualWin: r(fights.reduce((sum, f) => sum + f.casual.win, 0) / n),
      hard: fights.filter(f => f.smart.win < PAIR.with).map(f => f.fight), easy: fights.filter(f => f.casual.win > PAIR.without).map(f => f.fight),
    };
  });
}
