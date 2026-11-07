/**
 * The campaign's fight simulator (docs/fight-sim.md): plays real fights headless with the game's own
 * rules (src/battle.ts, the same `act`, `enemyAct`, `nextRound` and `runClock` the fight screen calls,
 * in the same order), so it can never drift from the game. Pure and seeded: the same setup and seed
 * give the same numbers. `scripts/fight-sim.mjs` is its command line.
 *
 * Bots are not people: they compare setups with each other, they do not measure how hard a fight
 * feels. `src/combat/simulator.ts` is a different thing: the generic engine's lab, on a synthetic fight.
 */
import { ACTION_SECONDS, BEAT, DUAL_CLOCK } from './battle-motion.ts';
import { animaBonus, type AnimaId } from './animas.ts';
import {
  ANIMA_NAMES, BROOD, DEFEND_CHARGE, DUALS, REACTION_RULES, elementsFor, improve, FEAR_ENCOUNTERS, FEAR_FOES, FEAR_RULES, BROOD_ENCOUNTERS, MENTAL_STATUSES, ONIONS, SKILLS, STATUSES, VERTIGO, act, actDual, commit, createBattle, createBroodBattle,
  createFearBattle, createGuardBattle, dualOf, dualOptions, dualPartner, enemyAct, free, isOnion, kitIn, nextRound, palaceGuards, queue, runClock, skillsFor, takeNews,
  takeQueued, validTargets, wearAnima, aimed, markSpent,
  type BattleAction, type BattleEffect, type BattleState, type BroodEncounter, type ClassId, type DualId, type DualSpec, type Element, type PartySlot, type SkillId,
} from './battle.ts';
import { improvedBy } from './ecos.ts';
import { PROFILES, type ProfileId } from './stats.ts';

export const SIM_VERSION = 2;
export const POLICIES = {
  attack: 'Solo Atacar, al primer enemigo en pie: el suelo de comparación.',
  random: 'Cualquier acción legal al azar.',
  casual: 'Quien juega sin darle vueltas: lo que más PV quita ahora, sin cambiar de ánima ni defenderse. 15 % de despistes.',
  smart: 'Quien entiende las reglas: pela, remata, se defiende del golpe que viene, cuida el maná y cambia de ánima. 5 % de despistes.',
} as const;
export type Policy = keyof typeof POLICIES;
const ERRORS: Record<Policy, number> = { attack: 0, random: 0, casual: .15, smart: .05 };
/**
 * How often the partner of whoever acts first has queued a choice ahead (split mode, docs/fight-sim.md
 * § Duals): what a person in no hurry does. Their queued choice and the first one's skill make a dual
 * only by chance, as people find them. `smart` plans its duals instead (`decide`), so it never relies on this.
 */
const QUEUE: Record<Policy, number> = { attack: 0, random: .5, casual: .6, smart: 0 };
/** Who can fight in a simulated party (chapter 2's; chapter 1's scripted fights are not simulated). */
const MEMBERS: Record<string, { name: string; profile: ProfileId }> = {
  gerard: { name: 'Gerard', profile: 'gerard35' },
  aitor: { name: 'Aitor', profile: 'aitor' },
};
export const FIGHTS = ['dogs:1', 'dogs:2', 'dogs:3', 'dogs:4', 'possessed:2', 'palace-guards', ...FEAR_ENCOUNTERS] as const;
/** The party of Nuria's mission as she lends the cats, Aitor wearing nothing until someone chooses: what her fights are tuned for. */
export const MISSION_PARTY = 'gerard:papagato+aitor:-';
/** The party that can make dual attacks: Gerard on Matemágico, Aitor with Papagato equipped beforehand. */
export const DUO = 'gerard:matemagico+aitor:papagato';
/** The ánimas the fights are tuned with. */
const MISSION_ANIMAS: ClassId[] = ['matemagico', 'papagato'];

export interface Setup {
  /** One of FIGHTS. */
  fight: string;
  /** `gerard:papagato+aitor:matemagico`; `-` wears nothing, and `gerard:papagato` goes alone. */
  party: string;
  /** Each ánima's level (1 if missing). */
  levels?: Partial<Record<ClassId, number>>;
  policy: Policy;
  /**
   * Skills the bot may not use, to measure how much one decides ("and without Zarpazos?"): a skill
   * also bans every dual it is half of, a dual id bans that dual, and `duals` bans them all.
   */
  ban?: Ban[];
  /** The ánimas L and R walk through; Matemágico and Papagato by default, as in Nuria's mission. */
  animas?: ClassId[];
  /** Friends' ánimas already gained, whose bonus the whole party gets. */
  friends?: AnimaId[];
  /** What the Ecos de luz are in (src/ecos.ts ids: `matemagico:agua`, `papagato:mana-1`). */
  improved?: string[];
  /** Chance a decision is a slip: any legal action. The policy's own if missing. */
  error?: number;
  /** Seconds a player thinks per turn (fire burns meanwhile: docs/combat.md § Estados en tiempo real). */
  think?: number;
  maxRounds?: number;
}
export type Ban = SkillId | DualId | 'duals';
/** A turn: `dual` is the active fighter and the next one together (both turns, both halves of maná). */
export interface Choice { wear?: ClassId; action: BattleAction | 'dual'; target?: string; skill?: SkillId; dual?: DualId; element?: Element }
/** Whether `ban` keeps a dual out: all of them, that one, or one of its halves. */
export const dualBanned = (dual: DualSpec, ban: readonly Ban[] = []) => ban.includes('duals') || ban.includes(dual.id) || dual.parts.some(part => ban.includes(part));

/**
 * Numbers tried without touching the code, as `book.id.field`: `onion.cebollon.layers`,
 * `foe.cebollon.pv`, `skill.zarpazos.strikes`, `brood.platito.power`, `dual.zarpazos-de-fuego.power`,
 * `vertigo.boss.pisoton`, `fear.rules.escortLayers`, `fear.plato.power`. Runs `work` with them on and
 * puts everything back. A misspelt one is an error, so it never reads as "it changed nothing".
 */
export type Tuning = Record<string, number>;
const BOOKS = {
  onion: ONIONS, foe: PROFILES, brood: BROOD,
  skill: Object.fromEntries(SKILLS.map(skill => [skill.id, skill])),
  dual: Object.fromEntries(DUALS.map(dual => [dual.id, dual])),
  vertigo: { boss: VERTIGO },
  reaction: { rules: REACTION_RULES },
  // Only El Plato hits with its own `power`: the onions' blow is ONIONS' (book `onion`), Vertitrón's VERTIGO's.
  fear: { rules: FEAR_RULES, plato: FEAR_FOES.plato },
} as unknown as Record<string, Record<string, Record<string, unknown>>>;
export function withTuning<T>(tuning: Tuning, work: () => T): T {
  const undo: (() => void)[] = [];
  try {
    for (const [path, value] of Object.entries(tuning)) {
      const [book, id, field] = path.split('.'), entry = BOOKS[book]?.[id];
      if (!entry || typeof entry[field] !== 'number') throw new Error(`Nothing to tune at "${path}": use ${Object.keys(BOOKS).join(', ')}.<id>.<numeric field>.`);
      const before = entry[field];
      undo.push(() => { entry[field] = before; });
      entry[field] = value;
    }
    return work();
  } finally { undo.reverse().forEach(put => put()); }
}
/** A small seeded generator (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function partySlots(party: string, friends: AnimaId[] = []): PartySlot[] {
  const bonus = friends.length ? { bonus: animaBonus(friends) } : {};
  const slots = party.split('+').map(entry => {
    const [id, anima] = entry.split(':'), member = MEMBERS[id];
    if (!member) throw new Error(`Unknown party member "${id}": use ${Object.keys(MEMBERS).join(', ')}.`);
    if (anima && anima !== '-' && !(anima in ANIMA_NAMES)) throw new Error(`Unknown ánima "${anima}": use ${Object.keys(ANIMA_NAMES).join(', ')} or -.`);
    return { id, name: member.name, profile: member.profile, classId: !anima || anima === '-' ? undefined : anima as ClassId, ...bonus };
  });
  if (new Set(slots.map(s => s.id)).size !== slots.length) throw new Error(`Someone is twice in "${party}".`);
  return slots;
}
/** The fight as the game starts it. */
export function createFight(setup: Setup, random: () => number = Math.random): BattleState {
  const party = partySlots(setup.party, setup.friends), animas = setup.animas ?? MISSION_ANIMAS;
  const [kind, count] = setup.fight.split(':');
  const state = kind === 'dogs' || kind === 'possessed' ? createBattle(party, Number(count ?? 1), kind === 'possessed', undefined, animas)
    : kind === 'palace-guards' ? createGuardBattle(party, palaceGuards(animas.length), animas)
    : (BROOD_ENCOUNTERS as readonly string[]).includes(kind) ? createBroodBattle(party, kind as BroodEncounter, animas, random)
    : (FEAR_ENCOUNTERS as readonly string[]).includes(kind) ? createFearBattle(party, kind as (typeof FEAR_ENCOUNTERS)[number], animas, random)
    : undefined;
  if (!state) throw new Error(`Unknown fight "${setup.fight}": use ${FIGHTS.join(', ')}.`);
  state.levels = { ...setup.levels };
  if (setup.improved?.length) improve(state, improvedBy(setup.improved));
  // The fight's own dice (Zarpazos de fuego's coins) come from the same seed.
  state.seed = Math.floor(random() * 2 ** 32) >>> 0;
  return state;
}

/**
 * Everything the active fighter can do now, ánimas they could change to included (it is free), and
 * with `duals` every dual they can make now with the next ally (who must already wear their half:
 * nobody changes ánima off their own turn).
 */
export function legalChoices(state: BattleState, setup: Pick<Setup, 'ban'>, swaps = true, duals = true): Choice[] {
  const worn = state.allies[state.active].classId;
  const out: Choice[] = [{ action: 'defend' }];
  const actorNow = state.allies[state.active];
  for (const target of validTargets(state, 'attack')) {
    out.push({ action: 'attack', target: target.id });
    for (const element of elementsFor(state, actorNow)) out.push({ action: 'attack', target: target.id, element });
  }
  for (const wear of [worn, ...swaps ? kitIn(state, actorNow).filter(id => id !== worn && free(state, actorNow, id)) : []]) {
    const look = wear === worn ? state : structuredClone(state);
    if (wear !== worn) wearAnima(look, wear!);
    const actor = look.allies[look.active];
    for (const skill of skillsFor(look, actor)) {
      if (setup.ban?.includes(skill.id) || actor.secondary < skill.cost) continue;
      const targets = validTargets(look, 'skill', skill.id);
      if (!targets.length) continue;
      const wearing = wear === worn ? {} : { wear };
      if (aimed(skill.id)) for (const target of targets) out.push({ ...wearing, action: 'skill', skill: skill.id, target: target.id });
      else out.push({ ...wearing, action: 'skill', skill: skill.id });
    }
  }
  if (duals) for (const option of dualOptions(state, swaps)) {
    if (!option.ok || dualBanned(option.dual, setup.ban)) continue;
    const wearing = option.wear ? { wear: option.wear } : {};
    for (const target of validTargets(state, 'attack')) out.push({ ...wearing, action: 'dual', dual: option.dual.id, target: target.id });
  }
  return out;
}
function apply(state: BattleState, choice: Choice) {
  if (choice.wear) wearAnima(state, choice.wear);
  if (choice.action === 'attack') state.allies[state.active].element = choice.element;
  if (choice.action === 'dual') return actDual(state, choice.dual!, choice.target);
  return act(state, choice.action, choice.target, choice.skill);
}
/** A copy to think on with dice of its own: a bot never sees the real fight's next roll (Zarpazos de fuego's coins). */
function copy(state: BattleState) {
  const look = structuredClone(state);
  if (look.seed !== undefined) look.seed = (Math.imul(look.seed ^ (look.seed >>> 16), 0x45d9f3b) + 0x9e3779b9) >>> 0;
  return look;
}
/** The hits `smart` expects a debuff's mark to add to, per ally standing (Ángulo exacto: −3 for 3 rounds). */
const MARK_HITS = 3;
/** What `smart` thinks a point of maná gathered (Defender) is worth: a little more than it costs to spend (2.5), since it is what skills wait on. */
const MANA_WORTH = 5;
/** What `smart` thinks a PV off Vertitrón's eye is worth (it brings no win closer, but every Rayo it has left), and breaking it. */
const EYE_WORTH = .8, EYE_BROKEN = 30;
interface Threat { hp: Map<string, number>; mareo: Map<string, number> }
/** What the foes would do to each ally if their turn came now (PV, and Mareo stacks): the real rules, on a copy. */
function threatOn(state: BattleState): Threat {
  const look = copy(state), before = new Map(look.allies.map(a => [a.id, { hp: a.hp, mareo: a.statuses?.mareo ?? 0 }]));
  look.phase = 'enemy'; look.enemyActions = [];
  for (const foe of look.foes) if (foe.hp > 0 && look.phase === 'enemy') enemyAct(look, foe.id);
  return {
    hp: new Map(look.allies.map(a => [a.id, before.get(a.id)!.hp - a.hp])),
    mareo: new Map(look.allies.map(a => [a.id, Math.max(0, (a.statuses?.mareo ?? 0) - before.get(a.id)!.mareo)])),
  };
}
/** What a choice costs in maná, both halves for a dual. */
function manaOf(choice: Choice) {
  if (choice.action === 'dual') return DUALS.find(d => d.id === choice.dual)!.parts.reduce((sum, id) => sum + SKILLS.find(s => s.id === id)!.cost, 0);
  return SKILLS.find(s => s.id === choice.skill)?.cost ?? 0;
}
/** How good a choice looks to `smart`, played on a copy: new mechanics are measured by what they do. */
function worth(before: BattleState, choice: Choice, threat: Threat, ban: readonly Ban[] = []) {
  const after = copy(before);
  apply(after, choice);
  return gain(before, after, choice, threat, ban);
}
/** What changed from `before` to `after` (one choice played), as `smart` values it. */
function gain(before: BattleState, after: BattleState, choice: Choice, threat: Threat, ban: readonly Ban[]) {
  const actor = before.allies[before.active];
  let value = 0;
  before.foes.forEach((foe, i) => {
    const now = after.foes[i];
    // Vertitrón's eye: PV off it count while its Rayo is still to come (breaking it ends the Rayo for good).
    value += (foe.hp - now.hp) * (foe.kind === 'vertigo-ojo' ? EYE_WORTH : 1);
    // A layer off makes its blows lighter for the rest of the fight and the hits behind it land whole.
    if (isOnion(foe.kind)) value += ((foe.layers ?? 0) - (now.layers ?? 0)) * (ONIONS[foe.kind].perLayer * (2 + 2 * ONIONS[foe.kind].splash) + 3);
    if (foe.hp > 0 && now.hp <= 0) value += foe.kind === 'vertigo-ojo' ? EYE_BROKEN : 20;
    value += ((now.statuses?.sangrado ?? 0) - (foe.statuses?.sangrado ?? 0)) * 3;
    value += ((now.timed?.quemado?.level ?? 0) - (foe.timed?.quemado?.level ?? 0)) * 10;
    // A debuff's mark on a foe that will stand a while: every later hit on it lands harder, about a
    // hit per ally standing for each of its rounds.
    if (foe.hp > 60) for (const [id, mark] of Object.entries(now.marks ?? {})) if (!foe.marks?.[id as SkillId] && mark) value += mark.amount * MARK_HITS * after.allies.filter(a => a.hp > 0).length;
    // Punto débil: what the next blow on it will add.
    if (now.hp > 0 && now.weakSpot !== undefined && foe.weakSpot === undefined) value += weakSpotWorth(after, now.id, ban);
  });
  // PV given back count nearly as much as PV taken away (Cardioide, Ronroneo), and a calmed mind a little.
  before.allies.forEach((ally, i) => {
    value += Math.max(0, after.allies[i].hp - ally.hp) * .9;
    for (const id of MENTAL_STATUSES) value += Math.max(0, (ally.statuses?.[id] ?? 0) - (after.allies[i].statuses?.[id] ?? 0)) * 4;
  });
  // Cegado: what the foes would no longer do this turn and about half the next, the real rules on a copy.
  if (after.foes.some((foe, i) => (foe.timed?.cegado?.level ?? 0) > (before.foes[i].timed?.cegado?.level ?? 0))) {
    const sum = (t: Threat) => [...t.hp.values()].reduce((total, hp) => total + hp, 0);
    value += (sum(threat) - sum(threatOn(after))) * 1.5;
  }
  const skill = SKILLS.find(s => s.id === choice.skill);
  if (skill?.kind === 'boost') value += skill.power * 3 * before.foes.filter(f => f.hp > 0).length;
  value -= manaOf(choice) * 2.5;
  if (choice.action === 'defend') {
    const coming = threat.hp.get(actor.id) ?? 0;
    // Defender only gathers maná into an ánima worn: wearing none, there is nothing to gather. With one
    // ánima each (the dual party) it is the only way maná comes back, so each point counts.
    value += coming * 2 / 3 + (actor.classId ? Math.min(DEFEND_CHARGE, actor.maxSecondary - actor.secondary) * MANA_WORTH : 0) + (coming >= actor.hp ? 30 : 0) + (threat.mareo.get(actor.id) ?? 0) * 3;
  }
  return value;
}
/**
 * What a fresh Punto débil on `foeId` is worth: the most the next blow on it (any ally's, a dual
 * included, with the maná they have now) would add for it, a little less since it may fade unused.
 */
function weakSpotWorth(after: BattleState, foeId: string, ban: readonly Ban[]) {
  let best = 0;
  after.allies.forEach((ally, i) => {
    if (ally.hp <= 0) return;
    const look = copy(after);
    look.phase = 'player'; look.active = i; look.enemyActions = []; delete look.spent; delete look.queued;
    const bare = copy(look);
    delete bare.foes.find(f => f.id === foeId)!.weakSpot;
    for (const choice of legalChoices(look, { ban: [...ban] }, false, true)) {
      if (choice.target !== foeId) continue;
      best = Math.max(best, damageOn(look, choice, foeId) - damageOn(bare, choice, foeId));
    }
  });
  return best * .7;
}
const damageOn = (state: BattleState, choice: Choice, foeId: string) => {
  const after = copy(state), before = state.foes.find(f => f.id === foeId)!.hp;
  apply(after, choice);
  return before - after.foes.find(f => f.id === foeId)!.hp;
};
/** The PV a choice takes off right now: all `casual` looks at. */
function damageNow(before: BattleState, choice: Choice) {
  const after = copy(before);
  apply(after, choice);
  return before.foes.reduce((sum, foe, i) => sum + foe.hp - after.foes[i].hp, 0);
}
/** The best of `options` by `score`, the first one on a tie. */
function best(options: Choice[], score: (choice: Choice) => number): [Choice, number] {
  let top = options[0], value = -Infinity;
  for (const option of options) { const v = score(option); if (v > value) { value = v; top = option; } }
  return [top, value];
}
/**
 * What a bot does with this turn. `smart` plans duals: it takes one only when it is worth more than
 * its best turn alone plus the partner's best reply after it (two plies, only when a dual is possible).
 * `casual` never looks for one: its duals happen by chance, when its partner had queued (`playFight`).
 */
export function decide(state: BattleState, setup: Setup, random: () => number): Choice {
  const policy = setup.policy;
  const options = legalChoices(state, setup, policy === 'smart' || policy === 'random', policy === 'smart' || policy === 'random');
  if (policy === 'attack') return options.find(o => o.action === 'attack') ?? options[0];
  if (policy === 'random' || random() < (setup.error ?? ERRORS[policy])) return options[Math.floor(random() * options.length)];
  if (policy === 'casual') return best(options, choice => damageNow(state, choice))[0];
  const threat = threatOn(state);
  const singles = options.filter(o => o.action !== 'dual'), duals = options.filter(o => o.action === 'dual');
  const [alone, aloneWorth] = best(singles, choice => worth(state, choice, threat, setup.ban));
  if (!duals.length) return alone;
  // The partner's best reply once this turn alone has played: what the dual would take their turn from.
  const after = copy(state);
  apply(after, alone);
  const partner = dualPartner(state);
  const reply = after.phase === 'player' && partner && after.allies[after.active]?.id === partner.id
    ? best(legalChoices(after, setup, true, false), choice => worth(after, choice, threatOn(after), setup.ban))[1] : 0;
  const [dual, dualWorth] = best(duals, choice => worth(state, choice, threat, setup.ban));
  return dualWorth > aloneWorth + reply ? dual : alone;
}

export interface Run {
  outcome: 'won' | 'lost' | 'draw';
  rounds: number;
  /** The party's PV left, as a share of its full PV. */
  hpLeft: number;
  /** How many of the party fell. */
  kos: number;
  /** The round the first of them fell in (none if nobody did). */
  firstKo?: number;
  /** The round the last onion ran out of layers in (none if there is no onion, or it never did). */
  peeledBy?: number;
  /** Times each action was used: skill ids, dual ids, `attack` and `defend`. */
  used: Record<string, number>;
  /** PV the party took off the foes with each skill, dual or `attack`. */
  damage: Record<string, number>;
  /** Dual attacks made. */
  duals: number;
  /**
   * What happened on the foes' side, counted: each foe ability by id (`vacio`, `aplaston`, `puaj`…),
   * `ojo-roto` (Vertitrón's eye broken, no more Rayo); and on the party's side `triple:<action>`,
   * the action that spent a Punto débil (×3).
   */
  events: Record<string, number>;
  /** The most PV one action of the party took off (a dual's eight claws are one): how close anything comes to a one-shot. */
  biggest: number;
}
/** The active fighter's choice, as the fight takes it: a skill a later ally's queued one completes becomes their dual (unless banned). */
function play(state: BattleState, choice: Choice, ban: readonly Ban[] = []) {
  if (choice.action === 'dual') return apply(state, choice);
  if (choice.wear) wearAnima(state, choice.wear);
  if (choice.action === 'attack') state.allies[state.active].element = choice.element;
  const partner = dualPartner(state), queued = partner && state.queued?.[partner.id];
  const dual = choice.action === 'skill' && queued?.skill ? dualOf(choice.skill!, queued.skill) : undefined;
  if (dual && dualBanned(dual, ban)) return act(state, choice.action, choice.target, choice.skill);
  return commit(state, choice.action, choice.target, choice.skill);
}
/** Whether the active fighter and the next ally wear the two halves of some dual they both know (maná aside): only then is there anything to queue for. */
const pairable = (state: BattleState) => dualOptions(state).some(option => !option.reason || option.reason === 'mana');
/** What the partner queues ahead (a choice in the dock, no ánima change, no dual): `casual` its greedy one, `random` any. */
function ahead(state: BattleState, partnerId: string, setup: Setup, random: () => number) {
  const look = structuredClone(state);
  look.active = look.allies.findIndex(a => a.id === partnerId);
  const options = legalChoices(look, setup, false, false);
  const choice = setup.policy === 'casual' && random() >= (setup.error ?? ERRORS.casual) ? best(options, c => damageNow(look, c))[0] : options[Math.floor(random() * options.length)];
  return { action: choice.action as 'attack' | 'defend' | 'skill', ...choice.skill ? { skill: choice.skill } : {}, ...choice.target ? { target: choice.target } : {} };
}
/** One fight, from its first turn to its end. */
export function playFight(setup: Setup, seed: number): Run {
  const random = seeded(seed), state = createFight(setup, random), think = setup.think ?? 3, maxRounds = setup.maxRounds ?? 60;
  const run: Run = { outcome: 'draw', rounds: 0, hpLeft: 0, kos: 0, used: {}, damage: {}, duals: 0, events: {}, biggest: 0 };
  const over = () => state.phase === 'won' || state.phase === 'lost';
  const hadOnion = state.foes.some(f => isOnion(f.kind));
  const count = (key: string) => { run.events[key] = (run.events[key] ?? 0) + 1; };
  const note = (effect?: BattleEffect) => {
    if (!effect) return;
    if (effect.kind === 'enemy' && effect.ability) count(effect.ability.id);
    if (effect.eye) count('ojo-roto');
    if (effect.reaction) count(effect.reaction.id);
  };
  const watch = () => {
    run.firstKo ??= state.allies.some(a => a.hp <= 0) ? state.round : undefined;
    if (hadOnion) run.peeledBy ??= state.foes.every(f => !isOnion(f.kind) || !f.layers || f.hp <= 0) ? state.round : undefined;
    takeNews(state).forEach(note);
  };
  while (!over() && state.round <= maxRounds) {
    if (state.phase === 'player') {
      // A choice queued ahead plays on its own after a short flash; anyone else thinks first.
      const waiting = !!state.queued?.[state.allies[state.active].id];
      runClock(state, waiting ? BEAT.queue / 1000 : think); watch();
      if (over()) break;
      const queued = takeQueued(state);
      const choice: Choice = queued ? { ...queued } : decide(state, setup, random);
      // Someone in no hurry queues their own choice while the first one chooses (`QUEUE`): their dual, if any, comes by chance.
      const partner = !queued && dualPartner(state);
      if (partner && QUEUE[setup.policy] && pairable(state) && random() < QUEUE[setup.policy]) queue(state, partner.id, ahead(state, partner.id, setup, random));
      const hp = state.foes.map(f => f.hp), effect = play(state, choice, setup.ban);
      if (!effect) throw new Error(`The bot chose something illegal: ${JSON.stringify(choice)}`);
      const key = effect.dual?.id ?? choice.skill ?? choice.action;
      if (effect.dual) run.duals++;
      const dealt = state.foes.reduce((sum, foe, i) => sum + (hp[i] ?? foe.maxHp) - foe.hp, 0);
      run.used[key] = (run.used[key] ?? 0) + 1;
      run.damage[key] = (run.damage[key] ?? 0) + dealt;
      run.biggest = Math.max(run.biggest, dealt);
      if (markSpent(effect) || effect.hits?.some(h => h.weakSpot)) count(`triple:${key}`);
      note(effect); watch();
      // A dual's cinematic runs the fight's clock a little longer; the partner's thinking overlapped the first one's.
      runClock(state, effect.dual ? DUAL_CLOCK : ACTION_SECONDS); watch();
    } else if (state.phase === 'enemy') {
      for (const foe of state.foes.filter(f => f.hp > 0)) {
        if (state.phase !== 'enemy') break;
        note(enemyAct(state, foe.id));
        watch();
        if (state.phase === 'enemy') runClock(state, ACTION_SECONDS);
        watch();
      }
      if (state.phase === 'enemy') nextRound(state);
      watch();
    } else break;
  }
  run.outcome = state.phase === 'won' ? 'won' : state.phase === 'lost' ? 'lost' : 'draw';
  run.rounds = state.round;
  run.hpLeft = state.allies.reduce((sum, a) => sum + a.hp, 0) / state.allies.reduce((sum, a) => sum + a.maxHp, 0);
  run.kos = state.allies.filter(a => a.hp <= 0).length;
  return run;
}

const mean = (values: number[]) => values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
const round = (value: number | null, places = 2) => value === null ? null : Number(value.toFixed(places));
/** Wilson's 95 % interval for a share: small samples do not read as certainties. */
export function wilson(hits: number, total: number): [number, number] {
  if (!total) return [0, 1];
  const z = 1.96, p = hits / total, d = 1 + z * z / total, centre = p + z * z / (2 * total), spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
  return [Math.max(0, (centre - spread) / d), Math.min(1, (centre + spread) / d)];
}
export interface Row {
  fight: string; party: string; levels: Partial<Record<ClassId, number>>; policy: Policy; ban: Ban[]; friends: AnimaId[]; improved: string[]; tuning: Tuning; runs: number;
  /** Share of fights won, and Wilson's 95 % interval. */
  win: number; winCI: [number, number];
  /** Fights that hit the round limit: something can go on for ever. */
  draws: number;
  /** Means: rounds of a fight, of those won, of those lost, the party's PV left when won, and how many of the party fell. */
  rounds: number; roundsWon: number | null; roundsLost: number | null; hpLeftWon: number | null; kos: number;
  /** Mean dual attacks per fight. */
  duals: number;
  /** Mean round the first of the party falls in, over fights where someone did, and how often. */
  firstKo: number | null; koRate: number;
  /** Mean round the onions lose their last layer, and how often they do. */
  peeledBy: number | null; peeledRate: number | null;
  /** Mean uses of each action per fight, most used first, and the share of the damage each one did. */
  used: Record<string, number>; damageShare: Record<string, number>;
  /** Mean times per fight each thing in `Run.events` happened (foe abilities, the hand broken or reaching Nil, the fire put out, a Punto débil spent). */
  events: Record<string, number>;
  /** The biggest single action of the party: its mean over fights, and the most in any. */
  biggest: number; biggestMax: number;
}
/** `runs` fights of a setup; a same seed gives every setup the same luck to compare fairly. */
export function simulate(setup: Setup, runs = 200, seed = 35, tuning: Tuning = {}): Row {
  return withTuning(tuning, () => tally(setup, runs, seed, tuning));
}
function tally(setup: Setup, runs: number, seed: number, tuning: Tuning): Row {
  const list = Array.from({ length: runs }, (_, i) => playFight(setup, (seed + i * 7919) >>> 0));
  const won = list.filter(r => r.outcome === 'won'), lost = list.filter(r => r.outcome === 'lost');
  const used: Record<string, number> = {}, damage: Record<string, number> = {}, events: Record<string, number> = {};
  for (const run of list) {
    for (const [key, n] of Object.entries(run.used)) used[key] = (used[key] ?? 0) + n;
    for (const [key, n] of Object.entries(run.damage)) damage[key] = (damage[key] ?? 0) + n;
    for (const [key, n] of Object.entries(run.events)) events[key] = (events[key] ?? 0) + n;
  }
  const total = Object.values(damage).reduce((sum, n) => sum + n, 0) || 1;
  const ko = list.flatMap(r => r.firstKo === undefined ? [] : [r.firstKo]);
  const hasOnions = createFight(setup, seeded(seed)).foes.some(f => isOnion(f.kind));
  const peeled = list.flatMap(r => r.peeledBy === undefined ? [] : [r.peeledBy]);
  return {
    fight: setup.fight, party: setup.party, levels: setup.levels ?? {}, policy: setup.policy, ban: setup.ban ?? [], friends: setup.friends ?? [], improved: setup.improved ?? [], tuning, runs,
    win: round(won.length / runs, 3)!, winCI: wilson(won.length, runs).map(v => round(v, 3)!) as [number, number],
    draws: list.filter(r => r.outcome === 'draw').length,
    rounds: round(mean(list.map(r => r.rounds)))!, roundsWon: round(mean(won.map(r => r.rounds))), roundsLost: round(mean(lost.map(r => r.rounds))), hpLeftWon: round(mean(won.map(r => r.hpLeft)), 3),
    duals: round(mean(list.map(r => r.duals)))!,
    kos: round(mean(list.map(r => r.kos)))!, firstKo: round(mean(ko)), koRate: round(ko.length / runs, 3)!,
    peeledBy: hasOnions ? round(mean(peeled)) : null, peeledRate: hasOnions ? round(peeled.length / runs, 3) : null,
    used: Object.fromEntries(Object.entries(used).sort((a, b) => b[1] - a[1]).map(([key, n]) => [key, round(n / runs)!])),
    damageShare: Object.fromEntries(Object.entries(damage).sort((a, b) => b[1] - a[1]).map(([key, n]) => [key, round(n / total, 3)!])),
    events: Object.fromEntries(Object.entries(events).sort((a, b) => b[1] - a[1]).map(([key, n]) => [key, round(n / runs)!])),
    biggest: round(mean(list.map(r => r.biggest)))!, biggestMax: Math.max(0, ...list.map(r => r.biggest)),
  };
}
/** Every combination of the lists given. */
export function sweep(grid: { fights: string[]; parties: string[]; levels: Partial<Record<ClassId, number>>[]; policies: Policy[]; bans?: Ban[][]; friends?: AnimaId[][]; improved?: string[][]; tunings?: Tuning[] }, options: Pick<Setup, 'error' | 'think' | 'maxRounds' | 'animas'> & { runs?: number; seed?: number } = {}): Row[] {
  const { runs, seed, ...rest } = options, rows: Row[] = [];
  for (const fight of grid.fights) for (const party of grid.parties) for (const levels of grid.levels) for (const policy of grid.policies) for (const ban of grid.bans ?? [[]]) for (const friends of grid.friends ?? [[]]) for (const improved of grid.improved ?? [[]]) for (const tuning of grid.tunings ?? [{}]) {
    rows.push(simulate({ fight, party, levels, policy, ban, friends, improved, ...rest }, runs, seed, tuning));
  }
  return rows;
}

const percent = (share: number) => `${Math.round(share * 100)} %`;
const levelText = (levels: Row['levels']) => Object.entries(levels).map(([id, n]) => `${id} ${n}`).join(', ') || 'nivel 1';
const tuningText = (tuning: Tuning) => Object.entries(tuning).map(([path, n]) => `${path}=${n}`).join(', ') || 'los números del juego';
/** Reads a table for whoever has to decide: what changed the result, and what looks wrong. Plain facts, in order. */
export function conclude(rows: Row[]): string[] {
  const lines: string[] = [];
  type Axis = 'levels' | 'ban' | 'party' | 'policy' | 'tuning';
  const group = (row: Row, leaveOut: Axis) => JSON.stringify({ fight: row.fight, party: leaveOut === 'party' ? 0 : row.party, levels: leaveOut === 'levels' ? 0 : row.levels, policy: leaveOut === 'policy' ? 0 : row.policy, ban: leaveOut === 'ban' ? 0 : row.ban, friends: row.friends, improved: row.improved, tuning: leaveOut === 'tuning' ? 0 : row.tuning });
  const compare = (leaveOut: Axis, say: (low: Row, high: Row) => string, least = .1) => {
    const groups = new Map<string, Row[]>();
    for (const row of rows) groups.set(group(row, leaveOut), [...groups.get(group(row, leaveOut)) ?? [], row]);
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.win - b.win), low = sorted[0], high = sorted.at(-1)!;
      if (high.win - low.win >= least) lines.push(say(low, high));
    }
  };
  compare('levels', (low, high) => `${low.fight} (${low.policy}, ${low.party}): ${levelText(low.levels)} gana ${percent(low.win)}; ${levelText(high.levels)} gana ${percent(high.win)}.`);
  compare('ban', (low, high) => `${low.fight} (${low.policy}, ${levelText(low.levels)}): sin ${low.ban.join(', ') || 'nada'} gana ${percent(low.win)}; sin ${high.ban.join(', ') || 'prohibir nada'} gana ${percent(high.win)}.`);
  compare('party', (low, high) => `${low.fight} (${low.policy}, ${levelText(low.levels)}): el peor equipo es ${low.party} (${percent(low.win)}), el mejor ${high.party} (${percent(high.win)}).`, .15);
  compare('policy', (low, high) => `${low.fight} (${low.party}, ${levelText(low.levels)}): ${low.policy} gana ${percent(low.win)}, ${high.policy} ${percent(high.win)}: ${high.win - low.win >= .4 ? 'jugar bien decide' : 'jugar bien ayuda'}.`, .2);
  compare('tuning', (low, high) => `${low.fight} (${low.policy}, ${levelText(low.levels)}): con ${tuningText(low.tuning)} gana ${percent(low.win)}; con ${tuningText(high.tuning)} gana ${percent(high.win)}.`);
  for (const row of rows) {
    const who = `${row.fight} (${row.policy}, ${row.party}, ${levelText(row.levels)})`;
    if (row.draws) lines.push(`AVISO ${who}: ${row.draws} de ${row.runs} combates no acaban en el límite de rondas.`);
    if (row.win >= .99 && (row.hpLeftWon ?? 0) >= .85) lines.push(`AVISO ${who}: trivial, gana siempre con ${percent(row.hpLeftWon!)} de PV.`);
    if (row.win <= .01 && row.policy === 'smart') lines.push(`AVISO ${who}: imposible jugando bien, ${percent(row.win)}.`);
  }
  // A skill the best bot could use and never does: it may be useless, or the bot may not value it.
  const unused = new Set<string>();
  for (const row of rows) {
    if (row.policy !== 'smart') continue;
    for (const skill of SKILLS) {
      const level = 'level' in skill ? skill.level : 1;
      if ((row.levels[skill.class] ?? 1) >= level && !row.ban.includes(skill.id) && !row.used[skill.id]) unused.add(skill.name);
    }
  }
  const everUsed = new Set(rows.filter(r => r.policy === 'smart').flatMap(r => Object.keys(r.used)));
  const never = [...unused].filter(name => !everUsed.has(SKILLS.find(s => s.name === name)!.id));
  if (never.length) lines.push(`AVISO smart nunca usa, en toda esta tabla: ${never.join(', ')}. Puede sobrar, o puede que el bot no sepa valorarla.`);
  // A dual the best bot could make (each half learned and worn by someone from the start) and never does.
  const worn = (party: string) => party.split('+').map(entry => entry.split(':')[1]);
  const noDual = DUALS.filter(dual => rows.some(row => row.policy === 'smart' && !dualBanned(dual, row.ban)
    && dual.parts.every(part => { const skill = SKILLS.find(s => s.id === part)!; return worn(row.party).includes(skill.class) && (row.levels[skill.class] ?? 1) >= ('level' in skill ? skill.level : 1); }))
    && !rows.some(row => row.policy === 'smart' && row.used[dual.id]));
  if (noDual.length) lines.push(`AVISO smart nunca hace, en toda esta tabla: ${noDual.map(d => d.name).join(', ')}. Puede no compensar, o puede que el bot no sepa valorarlo.`);
  return lines;
}

/**
 * What the fights are meant to be, as numbers (docs/fight-sim.md). `just fight-sim check` and the
 * tests hold the game to them: change a number here on purpose, with its reason, or fix the fight.
 */
export interface Target extends Setup {
  id: string;
  why: string;
  win?: readonly [number, number];
  /** Rounds a fight lasts when lost: how quickly it kills. */
  roundsLost?: readonly [number, number];
  /** The party's PV left when it wins. */
  hpLeftWon?: readonly [number, number];
  /** Rounds a fight lasts when won: how long the way to win takes. */
  roundsWon?: readonly [number, number];
  /** Dual attacks per fight. */
  duals?: readonly [number, number];
}
const L1 = { papagato: 1 }, L2 = { papagato: 2 }, L3 = { papagato: 3 };
/** Uri's tower with both ánimas grown: Papagato at 2 (ring 1 needs it), Matemágico at 1 or 2 (2 if Gerard wears it up the tower), 3 for whoever grinds. */
const P2M1 = { papagato: 2, matemagico: 1 }, P2M2 = { papagato: 2, matemagico: 2 }, P3M2 = { papagato: 3, matemagico: 2 };
export const TARGETS: readonly Target[] = [
  { id: 'cebollitas-faciles', fight: 'crias-1', party: MISSION_PARTY, levels: L1, policy: 'casual', win: [.98, 1], hpLeftWon: [.5, 1], why: 'Las cebollas pequeñas son fáciles: con ellas sube de nivel Papagato, sin darle vueltas.' },
  { id: 'cebollitas-a-puñetazos', fight: 'crias-1', party: MISSION_PARTY, levels: L1, policy: 'attack', win: [.95, 1], why: 'Incluso solo Atacar basta contra las pequeñas.' },
  { id: 'cebolla-nivel-1', fight: 'cebolla', party: MISSION_PARTY, levels: L1, policy: 'casual', win: [.2, .9], hpLeftWon: [0, .35], why: 'Sin Zarpazos, la Cebolla se gana por los pelos o no se gana.' },
  { id: 'cebolla-nivel-1-bien', fight: 'cebolla', party: MISSION_PARTY, levels: L1, policy: 'smart', win: [.2, .95], hpLeftWon: [0, .35], why: 'Jugar bien no la vuelve cómoda: el problema son sus capas, no la táctica.' },
  { id: 'cebolla-nivel-2', fight: 'cebolla', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [.95, 1], hpLeftWon: [.35, 1], why: 'Con Zarpazos la Cebolla cae con claridad.' },
  { id: 'cebollon-nivel-1', fight: 'cebollon', party: MISSION_PARTY, levels: L1, policy: 'casual', win: [0, .05], roundsLost: [2, 6], why: 'Las cebollas grandes matan rápido: a nivel 1 ni se le acerca.' },
  { id: 'cebollon-nivel-1-bien', fight: 'cebollon', party: MISSION_PARTY, levels: L1, policy: 'smart', win: [0, .2], roundsLost: [2, 9], why: 'A nivel 1 tampoco jugando bien: defenderse solo alarga la derrota, la respuesta es otra.' },
  { id: 'cebollon-nivel-2', fight: 'cebollon', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [.5, 1], why: 'Con Zarpazos ya se le puede ganar sin darle muchas vueltas, aunque peleado.' },
  { id: 'cebollon-nivel-2-bien', fight: 'cebollon', party: MISSION_PARTY, levels: L2, policy: 'smart', win: [.9, 1], hpLeftWon: [.35, 1], why: 'Zarpazos le quita las capas fácilmente: subir de nivel a Papagato es la respuesta.' },
  { id: 'cebollon-lo-decide-zarpazos', fight: 'cebollon', party: MISSION_PARTY, levels: L2, policy: 'smart', ban: ['zarpazos'], win: [0, .2], why: 'Es Zarpazos lo que lo cambia, no el nivel en sí: a nivel 2 sin usarlo se sigue perdiendo.' },
  { id: 'cebollon-nivel-3', fight: 'cebollon', party: MISSION_PARTY, levels: L3, policy: 'smart', win: [.9, 1], why: 'A nivel 3 sigue siendo la respuesta.' },
  // The young and the onions with the dual party (Aitor wearing Papagato from the loadout).
  { id: 'cebollon-duales-nivel-1', fight: 'cebollon', party: DUO, levels: L1, policy: 'smart', win: [0, .2], why: 'A nivel 1 no hay ataques duales: sin Zarpazos, ni a la vez se pela El Cebollón.' },
  { id: 'cebollon-zarpazos-de-fuego', fight: 'cebollon', party: DUO, levels: L2, policy: 'smart', win: [.95, 1], hpLeftWon: [.4, .85], duals: [.5, 3], why: 'Zarpazos de fuego pela ocho capas de golpe: el dual es la manera rápida.' },
  { id: 'platitos-sin-pensar', fight: 'crias-2', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [.6, .98], why: 'Le dan la vuelta al plato: hay que volver a leerlo.' },
  { id: 'crias-3-mezcla', fight: 'crias-3', party: MISSION_PARTY, levels: L2, policy: 'smart', win: [.8, 1], why: 'El tercer anillo mezcla crías y una cebolla grande: rematar al fantasmita antes de que se vuelva transparente, o agarrarse.' },
  { id: 'fantasmitas-sin-pensar', fight: 'crias-3', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [.35, .8], why: 'El tercer anillo aprieta: transparentes, el golpe los atraviesa, y a veces sube La Cebolla con ellos.' },
  // El Plato Misterioso (ring 2's fear): fast to read, and a dual always takes the dish's weakness.
  { id: 'plato-bien', fight: 'plato', party: DUO, levels: P2M1, policy: 'smart', win: [.95, 1], hpLeftWon: [.35, .84], roundsWon: [3, 6], why: 'Leer el plato: golpes, fuego y, con la sorpresa, los dos a la vez o agarrarse. Un dual siempre acierta con el plato, así que es rápido.' },
  { id: 'plato-sin-duales', fight: 'plato', party: DUO, levels: P2M1, policy: 'smart', ban: ['duals'], win: [.9, 1], roundsWon: [4, 7], why: 'Sin duales también cae: en la sorpresa se aguanta y se recarga. Una o dos rondas más.' },
  { id: 'plato-sin-pensar', fight: 'plato', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [.6, .98], roundsWon: [5, 8], why: 'Sin pensar se gana, pero ¡Puaj! salpica y la sorpresa no deja entrar nada: se llega con poca vida.' },
  // Ring 3's fear: La Cebolla y los suyos.
  { id: 'escolta-bien', fight: 'escolta', party: DUO, levels: P2M2, policy: 'smart', win: [.85, 1], hpLeftWon: [.25, .65], roundsWon: [3.5, 6], why: 'El último anillo es la prueba: primero el fantasmita, pelar la cebolla, agarrarse al Aplastón. Pensando, ágil.' },
  { id: 'escolta-sin-duales', fight: 'escolta', party: DUO, levels: P2M2, policy: 'smart', ban: ['duals'], win: [.75, .98], roundsWon: [5, 7.5], why: 'Sin duales también se pasa, con orden, pero más largo y más justo.' },
  { id: 'escolta-mision-bien', fight: 'escolta', party: MISSION_PARTY, levels: P2M1, policy: 'smart', win: [.8, 1], why: 'Con los gatos en Gerard también se pasa pensando el orden: el fantasmita, luego pelar.' },
  // Casual is the escort's cliff (4 % with four layers, 0 % with five): the floor is 0, since 80 fights (the tests) often see none of those wins.
  { id: 'escolta-sin-pensar', fight: 'escolta', party: MISSION_PARTY, levels: P2M1, policy: 'casual', win: [0, .15], why: 'A lo loco, la Cebolla y los suyos ganan casi siempre.' },
  // Vertitrón, the final boss. Its numbers are VERTIGO (book vertigo.boss), PROFILES.vertigo and its eye's (foe.vertigo-ojo).
  // Grito liberador is what decides it: every shout makes the party weaker and it stronger for good, so a long fight turns on them.
  { id: 'vertigo-duo-bien', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.5, .9], roundsWon: [3.5, 8], duals: [1, 5], why: 'Con los gatos en Aitor y el fuego en Gerard, quien descubre los duales lo tumba deprisa, antes de que grite mucho.' },
  { id: 'vertigo-sin-duales', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', ban: ['duals'], win: [.85, 1], hpLeftWon: [.2, .55], roundsWon: [10, 15], why: 'Sin ataques duales también se gana: romper el ojo antes del rayo, agarrarse cuando carga. Cuesta vida y rondas, y cada grito pesa.' },
  { id: 'vertigo-eco-mana', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'casual', improved: ['papagato:mana-1'], win: [.55, .95], why: 'Dos ecos en más maná ayudan a quien no le da vueltas, sin regalarle el combate.' },
  { id: 'vertigo-eco-elementos', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', improved: ['matemagico:agua', 'matemagico:fuego', 'matemagico:electrico'], hpLeftWon: [.6, .9], why: 'Los elementos son una respuesta más, no lo que decide el combate.' },
  { id: 'vertigo-sin-pensar', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'casual', win: [.35, .8], why: 'Sin pensar, Vertitrón gana a menudo: no es un trámite.' },
  { id: 'vertigo-poco-matemagico', fight: 'uri-vertigo', party: DUO, levels: P2M1, policy: 'smart', win: [.9, 1], why: 'Con Matemágico a nivel 1 no hay Punto débil, pero basta Zarpazos de fuego.' },
  { id: 'vertigo-sin-gatos-aitor', fight: 'uri-vertigo', party: MISSION_PARTY, levels: P2M2, policy: 'smart', win: [.8, 1], hpLeftWon: [.1, .45], why: 'Si Aitor no lleva a los gatos, se puede, pero sufriendo: Gerard tiene que cambiar de ánima para todo y se gana con poca vida.' },
  { id: 'vertigo-a-punetazos', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'attack', win: [0, .02], why: 'Solo Atacar no llega: sus gritos y su rayo piden algo más.' },
  { id: 'vertigo-nivel-3', fight: 'uri-vertigo', party: DUO, levels: P3M2, policy: 'smart', win: [.95, 1], hpLeftWon: [.4, .9], why: 'Quien ha subido mucho lo nota, pero el jefe sigue pidiendo cabeza.' },
  { id: 'vertigo-pensando-despacio', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', think: 8, win: [.9, 1], hpLeftWon: [0, .9], why: 'Quien piensa despacio deja arder más el fuego, y aun así Vertitrón no se vuelve un trámite.' },
];
export interface TargetResult { id: string; why: string; pass: boolean; failures: string[]; row: Row; wanted: Pick<Target, 'win' | 'roundsLost' | 'hpLeftWon' | 'roundsWon' | 'duals'> }
/** Plays every target and says which hold. */
export function checkTargets(targets: readonly Target[] = TARGETS, runs = 200, seed = 35, tuning: Tuning = {}): TargetResult[] {
  return targets.map(({ id, why, win, roundsLost, hpLeftWon, roundsWon, duals, ...setup }) => {
    const row = simulate(setup, runs, seed, tuning), failures: string[] = [];
    const within = (name: string, value: number | null, range?: readonly [number, number]) => {
      if (range && value !== null && (value < range[0] || value > range[1])) failures.push(`${name} ${value} fuera de ${range[0]}–${range[1]}`);
    };
    within('win', row.win, win); within('roundsLost', row.roundsLost, roundsLost); within('hpLeftWon', row.hpLeftWon, hpLeftWon);
    within('roundsWon', row.roundsWon, roundsWon); within('duals', row.duals, duals);
    // A fight that does not end is never what it is meant to be.
    if (row.draws) failures.push(`${row.draws} combates sin acabar`);
    return { id, why, pass: !failures.length, failures, row, wanted: { win, roundsLost, hpLeftWon, roundsWon, duals } };
  });
}
/** What the tool can do, for whoever (or whatever) picks it up. */
export function catalogue() {
  return {
    version: SIM_VERSION,
    fights: FIGHTS,
    members: Object.keys(MEMBERS),
    animas: Object.keys(ANIMA_NAMES),
    policies: POLICIES,
    missionParty: MISSION_PARTY,
    dualParty: DUO,
    skills: SKILLS.map(s => ({ id: s.id, name: s.name, anima: s.class, level: 'level' in s ? s.level : 1, cost: s.cost, power: s.power, description: s.description })),
    duals: DUALS.map(d => ({ id: d.id, name: d.name, parts: d.parts, cost: d.parts.map(id => SKILLS.find(s => s.id === id)!.cost), power: d.power, strikes: d.strikes ?? 1, description: d.description })),
    books: Object.keys(BOOKS),
    onions: ONIONS,
    foes: PROFILES,
    statuses: STATUSES,
    targets: TARGETS.map(({ id, why, fight, party, levels, policy, ban, win, roundsLost, hpLeftWon, roundsWon, duals }) => ({ id, why, fight, party, levels, policy, ban, win, roundsLost, hpLeftWon, roundsWon, duals })),
  };
}
