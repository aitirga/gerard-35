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
  ANIMA_NAMES, BROOD, CAMPING, MARTA, MODELO, isModelo, LUCA, dazzle, ELEMENT_RULES, DEFEND_CHARGE, DUALS, REACTION_RULES, elementsFor, improve, FEAR_ENCOUNTERS, FEAR_FOES, FEAR_RULES, BROOD_ENCOUNTERS, MENTAL_STATUSES, ONIONS, SKILLS, SOBREMESA, STATUSES, VERTIGO, act, actDual, commit, createBattle, createBroodBattle,
  createEncounter, createFearBattle, createGuardBattle, dualOf, dualOptions, dualPartner, enemyAct, free, isOnion, kitIn, nextRound, palaceGuards, queue, runClock, skillsFor, silenceAt, takeNews, takeSongNews,
  takeQueued, validTargets, wearAnima, aimed, markSpent,
  type BattleAction, type BattleEffect, type BattleState, type BroodEncounter, type ClassId, type DualId, type DualSpec, type Element, type FoeKind, type PartySlot, type SkillId, skillKnown,
} from './battle.ts';
import { costOf, improvedBy, withinEcos } from './ecos.ts';
import { PROFILES, type ProfileId } from './stats.ts';
import { VOZ_SONG, songAt, untilSilence } from './song.ts';
import { ARTILUGIO_NOTES, CASTLE, type MontonForm, type RoomEncounter } from './castle.ts';
import { NIGHT_PUPILS, nightMight } from './night.ts';
import { artilugioLive, castleNote, castleProp, montonCopy, nextNote } from './castle-fight.ts';

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
export const FIGHTS = ['dogs:1', 'dogs:2', 'dogs:3', 'dogs:4', 'possessed:2', 'palace-guards', 'night-guard', ...FEAR_ENCOUNTERS] as const;
/** The party of Nuria's mission as she lends the cats, Aitor wearing nothing until someone chooses: what her fights are tuned for. */
export const MISSION_PARTY = 'gerard:papagato+aitor:-';
/** The party that can make dual attacks: Gerard on Matemágico, Aitor with Papagato equipped beforehand. */
export const DUO = 'gerard:matemagico+aitor:papagato';
/** Gerard on Matemágico and Aitor on his own ánima: two of magic, the party the campsite's magos ask a question of. */
export const TECH = 'gerard:matemagico+aitor:tecnopata';
/** The ánimas the fights are tuned with. */
const MISSION_ANIMAS: ClassId[] = ['matemagico', 'papagato'];

export interface Setup {
  /** One of FIGHTS. */
  fight: string;
  /** Fran's salon: the chaplains start dazzled, the nave's mirrors solved (`dazzle`). */
  dazzled?: boolean;
  /** `gerard:papagato+aitor:matemagico`; `-` wears nothing, and `gerard:papagato` goes alone. */
  party: string;
  /** Each ánima's level (1 if missing). */
  levels?: Partial<Record<ClassId, number>>;
  policy: Policy;
  /**
   * Skills the bot may not use, to measure how much one decides ("and without Zarpazos?"): a skill
   * also bans every dual it is half of, a dual id bans that dual, `duals` bans them all, and `defend`
   * never holds on.
   */
  ban?: Ban[];
  /** The ánimas L and R walk through; Matemágico and Papagato by default, as in Nuria's mission. */
  animas?: ClassId[];
  /** Friends' ánimas already gained, whose bonus the whole party gets. */
  friends?: AnimaId[];
  /** What the Ecos de luz are in (src/ecos.ts ids: `matemagico:agua`, `papagato:mana-1`). */
  improved?: string[];
  /** `improved` is everything bought, nothing taken for granted on top (`nodesFor`): how a story point plays (`storyPoint`). */
  exact?: boolean;
  /** Chance a decision is a slip: any legal action. The policy's own if missing. */
  error?: number;
  /** Seconds a player thinks per turn (fire burns meanwhile: docs/combat.md § Estados en tiempo real). */
  think?: number;
  maxRounds?: number;
}
/**
 * Matemágico and Tecnópata grow by their tree at the jar, not by level (docs/animas/README.md § Two
 * ways to grow). The tables still say "matemagico 2" for short: here that is the first nodes of its
 * trunk (2: Ángulo exacto and Análisis Parálisis; 3: Cardioide too). Tecnópata fights with the three
 * skills of its tree, as it did when they came with it. Whatever `improved` names is added.
 */
export function nodesFor(levels: Partial<Record<ClassId, number>> | undefined, improved: readonly string[] = []) {
  const m = levels?.matemagico ?? 1;
  return [...new Set([...m >= 2 ? ['matemagico:angulo', 'matemagico:analisis'] : [], ...m >= 3 ? ['matemagico:cardioide'] : [], 'tecnopata:explosion', 'tecnopata:confusion', 'tecnopata:rayo-encogedor', ...improved])];
}
/**
 * The story's missions, for playing a fight as the party reaches it (docs/fight-sim.md § Story points).
 * Nuria and Uri's is the introduction; the rest can be done in any order, so each is met with anything
 * from none to all of the others behind it. `lights`: the Ecos de luz it gives (LIGHTS in src/story.ts);
 * `friend`: the ánima whose bonus the whole party gets from then on; `teaching`: its fights left easy
 * on purpose, the ones that teach, which the pair is not asked of. A new mission is one more entry.
 */
/** The pair every fight is held to (docs/combat.md § La respuesta de cada combate): `smart` wins at least `with`, `casual` at most `without`. */
export const PAIR = { with: .9, without: .2 };
export const MISSIONS = {
  nuria: { name: 'Nuria y Uri', intro: true, lights: 2, friend: 'nuria', fights: ['crias-1', 'crias-2', 'crias-3', 'cebolla', 'cebollon', 'plato', 'escolta', 'uri-vertigo'], teaching: ['crias-1', 'crias-2', 'crias-3', 'cebolla'] },
  universidad: { name: 'Los amigos de la uni', intro: false, lights: 5, friend: 'universidad', fights: ['camping-magos', 'camping-dados', 'camping-agentes', 'camping-tienda', 'camping-negra', 'campeon', 'sobremesa'], teaching: ['camping-magos', 'camping-dados', 'camping-agentes', 'camping-tienda'] },
  marta: { name: 'Marta', intro: false, lights: 1, friend: 'marta', fights: ['cuerdas-lealtad', 'cuerdas-cristalino', 'cuerdas-directo', 'voz'], teaching: [] },
  emilie: { name: 'Emilie', intro: false, lights: 1, friend: 'emilie', fights: ['modelo-celdas', 'modelo-oscilacion', 'modelo-atomo', 'no-converge'], teaching: [] },
  luca: { name: 'Luca', intro: false, lights: 1, friend: 'luca', fights: ['luca-recepcion', 'luca-sillones', 'luca-carta', 'fran'], teaching: ['luca-recepcion'] },
} as const satisfies Record<string, { name: string; intro: boolean; lights: number; friend: AnimaId; fights: readonly string[]; teaching: readonly string[] }>;
export type MissionId = keyof typeof MISSIONS;
export const MISSION_IDS = Object.keys(MISSIONS) as MissionId[];
/** The mission a fight belongs to, if any. */
export const missionOf = (fight: string) => MISSION_IDS.find(id => (MISSIONS[id].fights as readonly string[]).includes(fight));
/**
 * Ways of spending the ecos at the jar, each a shopping list in order: what the ecos of a story point
 * pay for is bought, the rest is not (`withinEcos`). `nada`: whoever never opened the jar.
 */
export const BUILDS: Record<string, readonly string[]> = {
  nada: [],
  // A bit of everything: the trunk first, then an element and its skill, then Aitor's.
  mixto: ['matemagico:angulo', 'tecnopata:explosion', 'matemagico:fuego', 'matemagico:analisis', 'tecnopata:rayo-encogedor', 'matemagico:factor-comun', 'matemagico:agua', 'tecnopata:confusion', 'matemagico:electrico', 'matemagico:cardioide', 'matemagico:vasos', 'matemagico:descarga'],
  // Everything into the elements: Atacar's three, then what lays and cashes them.
  elementos: ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico', 'matemagico:vasos', 'matemagico:descarga', 'matemagico:factor-comun', 'matemagico:capilaridad', 'matemagico:toma-de-tierra', 'matemagico:rescoldo'],
  // Skills and maná, no element.
  tronco: ['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'tecnopata:explosion', 'tecnopata:confusion', 'tecnopata:rayo-encogedor', 'matemagico:mana-1', 'tecnopata:control-remoto', 'papagato:mana-1'],
};
export interface StoryPoint { at: string; mission: MissionId; done: MissionId[]; ecos: number; build: string; setup: Pick<Setup, 'animas' | 'friends' | 'levels' | 'improved' | 'exact'> }
/**
 * The party as it stands when it reaches `mission`: `nuria` (the introduction: nothing behind it),
 * `marta:first` (only the introduction behind), `marta:last` (every other mission too) or the ones
 * done by name, `marta:universidad`. It has the friends' ánimas and the ecos of what is behind it,
 * spent as `build` says, and Papagato a level up for each mission done after the introduction.
 */
export function storyPoint(at: string, build = 'mixto'): StoryPoint {
  const [id, order = 'first'] = at.split(':'), mission = MISSIONS[id as MissionId];
  if (!mission) throw new Error(`Unknown mission "${id}": use ${MISSION_IDS.join(', ')}.`);
  if (!(build in BUILDS)) throw new Error(`Unknown build "${build}": use ${Object.keys(BUILDS).join(', ')}.`);
  const open = MISSION_IDS.filter(other => !MISSIONS[other].intro && other !== id);
  const named = order === 'first' ? [] : order === 'last' ? open : order.split('/') as MissionId[];
  for (const other of named) if (!open.includes(other)) throw new Error(`"${other}" cannot be behind "${id}": use first, last or ${open.join('/')}.`);
  const done = mission.intro ? [] : [...MISSION_IDS.filter(other => MISSIONS[other].intro), ...named];
  const ecos = done.reduce((sum, other) => sum + MISSIONS[other].lights, 0), improved = withinEcos(BUILDS[build], ecos);
  return {
    at: mission.intro ? id : `${id}:${order}`, mission: id as MissionId, done, ecos, build,
    setup: {
      animas: mission.intro ? MISSION_ANIMAS : ['matemagico', 'papagato', 'tecnopata'],
      friends: done.map(other => MISSIONS[other].friend),
      levels: { papagato: mission.intro ? 2 : Math.min(3, 2 + named.length) },
      improved, exact: true,
    },
  };
}
/** Every fight of `points`' missions (or `fights`), as each point's party meets it, with each bot. */
export function storyRows(points: StoryPoint[], policies: Policy[], options: { fights?: string[]; party?: string; runs?: number; seed?: number; tuning?: Tuning } = {}) {
  return points.flatMap(point => (options.fights?.filter(f => missionOf(f) === point.mission) ?? MISSIONS[point.mission].fights).flatMap(fight => policies.map(policy => ({
    at: point.at, build: point.build, ecos: point.ecos, spent: costOf(point.setup.improved ?? []),
    row: simulate({ fight, party: options.party ?? DUO, policy, ...point.setup }, options.runs ?? 200, options.seed ?? 35, options.tuning ?? {}),
  }))));
}
export type Ban = SkillId | DualId | 'duals' | 'defend';
/** A turn: `dual` is the active fighter and the next one together (both turns, both halves of maná). */
export interface Choice { wear?: ClassId; action: BattleAction | 'dual'; target?: string; skill?: SkillId; dual?: DualId; element?: Element }
/** Whether `ban` keeps a dual out: all of them, that one, or one of its halves. */
export const dualBanned = (dual: DualSpec, ban: readonly Ban[] = []) => ban.includes('duals') || ban.includes(dual.id) || dual.parts.some(part => ban.includes(part));

/**
 * Numbers tried without touching the code, as `book.id.field`: `onion.cebollon.layers`,
 * `foe.cebollon.pv`, `skill.zarpazos.strikes`, `brood.platito.power`, `dual.zarpazos-de-fuego.power`,
 * `vertigo.boss.pisoton`, `sobremesa.boss.carta`, `camping.rules.bombona`, `fear.rules.escortLayers`, `fear.plato.power`. Runs `work` with them on and
 * puts everything back. A misspelt one is an error, so it never reads as "it changed nothing".
 */
export type Tuning = Record<string, number>;
const BOOKS = {
  onion: ONIONS, foe: PROFILES, brood: BROOD,
  skill: Object.fromEntries(SKILLS.map(skill => [skill.id, skill])),
  dual: Object.fromEntries(DUALS.map(dual => [dual.id, dual])),
  vertigo: { boss: VERTIGO },
  sobremesa: { boss: SOBREMESA },
  camping: { rules: CAMPING },
  marta: { rules: MARTA },
  castle: { rules: CASTLE },
  night: { rules: NIGHT_PUPILS },
  modelo: { rules: MODELO },
  luca: { rules: LUCA },
  reaction: { rules: REACTION_RULES },
  element: { rules: ELEMENT_RULES },
  // Only El Plato hits with its own `power`: the onions' blow is ONIONS' (book `onion`), Vertitrón's VERTIGO's.
  fear: { rules: FEAR_RULES, plato: FEAR_FOES.plato },
} as unknown as Record<string, Record<string, Record<string, unknown>>>;
/** Every number that can be tuned, as `book.id.field` and what it is now: what a balance report shows and `--tune` takes. */
export function tunables(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [book, entries] of Object.entries(BOOKS)) for (const [id, entry] of Object.entries(entries)) for (const [field, value] of Object.entries(entry)) if (typeof value === 'number') out[`${book}.${id}.${field}`] = value;
  return out;
}
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
    // At night on the Meridiana: a group of the castle's pupils (`night-guard:<room>`, the first floor's first by default), as strong as friends and levels leave it.
    : kind === 'night-guard' ? createEncounter(party, 'night-guard', { animas, night: { room: (count ?? 'alumnos-1a') as RoomEncounter, might: nightMight(setup.friends?.length ?? 0, setup.levels) }, random })
    : (BROOD_ENCOUNTERS as readonly string[]).includes(kind) ? createBroodBattle(party, kind as BroodEncounter, animas, random)
    : (FEAR_ENCOUNTERS as readonly string[]).includes(kind) ? createFearBattle(party, kind as (typeof FEAR_ENCOUNTERS)[number], animas, random)
    : undefined;
  if (!state) throw new Error(`Unknown fight "${setup.fight}": use ${FIGHTS.join(', ')}.`);
  if (setup.dazzled) dazzle(state);
  state.levels = { ...setup.levels };
  improve(state, improvedBy(setup.exact ? setup.improved ?? [] : nodesFor(setup.levels, setup.improved)));
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
  const out: Choice[] = setup.ban?.includes('defend') ? [] : [{ action: 'defend' }];
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
/** What `smart` thinks of the model's set-ups: a cell wet, a mark of Error off, El que no converge converged, an electron off El Átomo. */
const MODELO_WET = 14, ERROR_WORTH = 16, CONVERGED_WORTH = 30, ELECTRON_WORTH = 18;
/** What `smart` thinks a PV off Vertitrón's eye is worth (it brings no win closer, but every Rayo it has left), and breaking it. */
const EYE_WORTH = .8, EYE_BROKEN = 30;
/** A thing with PV that is part of a fight's answer and never its win: Vertitrón's eye, Aurelià's lectern, the Queen's hands. */
const isPiece = (foe: BattleState['foes'][number]) => foe.kind === 'vertigo-ojo' || castleProp(foe);
/** Fran's canopy: a lamp broken is a Brillo he will never drink again, a light that eats nothing more and a lighter Aspersión; each Brillo off, the blows that land whole. */
const LAMP_BROKEN = 40, BRILLO_WORTH = 30;
/** El Campeón: a step off his Plan, about a share of what his Rayo total would do to everyone. */
const PLAN_WORTH = 22;
/**
 * The castle's second and third years (docs/castle.md § Bestiary). El Ausente: a PV off it the round
 * it is there is worth more (the next chance is two rounds away). El Castigado: a point of Rabia
 * leaves less room for the blows still to come; the one that fills it costs what its burst would do,
 * the real rules on a copy. El Montón: the turns `smart` expects it to give its first blow back, and
 * what each shape adds to each copy (a fire's pulses, a turn lost, a wound's ticks and its opening).
 */
const PRESENT_WORTH = .5, RAGE_WORTH = 6, MONTON_TURNS = 3;
const SHAPE_WORTH: Record<MontonForm, number> = { golpe: 0, fuego: 15, agua: 0, electrico: 30, sangrado: 12 };
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
    value += (foe.hp - now.hp) * (isPiece(foe) ? EYE_WORTH : 1);
    // A layer off makes its blows lighter for the rest of the fight and the hits behind it land whole.
    if (isOnion(foe.kind)) value += ((foe.layers ?? 0) - (now.layers ?? 0)) * (ONIONS[foe.kind].perLayer * (2 + 2 * ONIONS[foe.kind].splash) + 3);
    if (foe.hp > 0 && now.hp <= 0) value += isPiece(foe) ? EYE_BROKEN : foe.kind === 'lampara' ? LAMP_BROKEN : 20;
    // Fran's Brillo taken away (a lamp broken): every blow on him from now on lands whole again.
    if (foe.kind === 'fran') value += ((foe.brillo ?? 0) - (now.brillo ?? 0)) * BRILLO_WORTH;
    // El Campeón's Plan set back: a step further from the Rayo total on everyone.
    if (foe.kind === 'campeon' && now.hp > 0) value += ((foe.plan ?? 0) - (now.plan ?? 0)) * PLAN_WORTH;
    value += ((now.statuses?.sangrado ?? 0) - (foe.statuses?.sangrado ?? 0)) * 3;
    value += ((now.timed?.quemado?.level ?? 0) - (foe.timed?.quemado?.level ?? 0)) * 10;
    // A debuff's mark on a foe that will stand a while: every later hit on it lands harder, about a
    // hit per ally standing for each of its rounds.
    if (foe.hp > 60) for (const [id, mark] of Object.entries(now.marks ?? {})) if (!foe.marks?.[id as SkillId] && mark) value += mark.amount * MARK_HITS * after.allies.filter(a => a.hp > 0).length;
    // La Voz's Calderón broken by an Acorde: everything it was about to do to everyone.
    if (foe.intent?.ability === 'calderon' && now.hp > 0 && !now.intent) value += [...threat.hp.values()].reduce((total, hp) => total + hp, 0);
    // Emilie's model: a cell wet is a cell switched on (and a bolt away from Conducción); a mark of Error off El que no
    // converge is a step towards the turns it stands solid, and one on is a step back.
    if (isModelo(foe.kind) && now.hp > 0) {
      if (foe.kind === 'celda-seca' && now.timed?.mojado && !foe.timed?.mojado) value += MODELO_WET;
      // El Átomo: an electron off is one thing fewer in its Reacción; one given back, one more.
      if (foe.kind === 'atomo') value += ((foe.electrons?.length ?? 0) - (now.electrons?.length ?? 0)) * ELECTRON_WORTH;
      value += ((foe.error ?? 0) - (now.error ?? 0)) * (foe.converged || now.converged && !foe.converged && (foe.error ?? 0) > 1 ? 0 : ERROR_WORTH);
      if (now.converged && !foe.converged) value += CONVERGED_WORTH;
    }
    // Punto débil: what the next blow on it will add.
    if (now.hp > 0 && now.weakSpot !== undefined && foe.weakSpot === undefined) value += weakSpotWorth(after, now.id, ban);
    // El Ausente the round it is there: the window.
    if (foe.kind === 'ausente' && !foe.castle?.away) value += (foe.hp - now.hp) * PRESENT_WORTH;
    // El Castigado: each point of Rabia, and the one that fills it, unless nothing is left to wait for (its the last, and the party's maná is full).
    if (foe.kind === 'castigado' && now.hp > 0 && (now.castle?.rage ?? 0) > (foe.castle?.rage ?? 0)) {
      const waiting = after.foes.some(f => f.hp > 0 && f.kind !== 'castigado') || after.allies.some(a => a.hp > 0 && a.secondary < a.maxSecondary);
      if (waiting) {
        value -= ((now.castle?.rage ?? 0) - (foe.castle?.rage ?? 0)) * RAGE_WORTH;
        if ((now.castle?.rage ?? 0) >= CASTLE.rabia) value -= sum(threatOn(after)) - sum(threat);
      }
    }
    // El Montón shaped by this blow: what it will give back, against what a plain Atacar would have shown it.
    if (foe.kind === 'monton' && !foe.castle?.form && now.castle?.form) value -= Math.max(0, shapeHarm(after, now) - shapeHarm(after, now, plainCopy(before, foe.id))) * MONTON_TURNS;
  });
  // PV given back count nearly as much as PV taken away (Cardioide, Ronroneo), and a calmed mind a little.
  before.allies.forEach((ally, i) => {
    value += Math.max(0, after.allies[i].hp - ally.hp) * .9;
    for (const id of MENTAL_STATUSES) value += Math.max(0, (ally.statuses?.[id] ?? 0) - (after.allies[i].statuses?.[id] ?? 0)) * 4;
  });
  // Cegado: what the foes would no longer do this turn and about half the next, the real rules on a copy.
  if (after.foes.some((foe, i) => (foe.timed?.cegado?.level ?? 0) > (before.foes[i]?.timed?.cegado?.level ?? 0))) {
    value += (sum(threat) - sum(threatOn(after))) * 1.5;
  }
  // Fran's salon (docs/quests/luca.md): the freshly styled chaplain down leaves the others still;
  // what the foes would no longer do, the real rules on a copy.
  const stilled = after.foes.some((foe, i) => foe.still === after.round && before.foes[i]?.still !== before.round);
  if (stilled) {
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
/** Everything the foes would do to the party now, in PV. */
const sum = (t: Threat) => [...t.hp.values()].reduce((total, hp) => total + hp, 0);
/** What one of El Montón's copies would take off the party, shaped as `monton` is, or by a plain blow on it alone of `copied` PV. */
function shapeHarm(state: BattleState, monton: BattleState['foes'][number], copied?: number) {
  const plain = copied !== undefined, form: MontonForm = plain ? 'golpe' : monton.castle!.form!;
  const amount = plain ? montonCopy({ ...monton, castle: { ...monton.castle, copied } }) : montonCopy(monton);
  const reach = !plain && (monton.castle!.all || form === 'agua') ? state.allies.filter(a => a.hp > 0).length : 1;
  return (amount + SHAPE_WORTH[form]) * reach;
}
/** The PV a plain Atacar would take off `foeId` now: what El Montón would copy from it. */
const plainCopy = (state: BattleState, foeId: string) => damageOn(state, { action: 'attack', target: foeId }, foeId);
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
/**
 * La carta de colores (docs/quests/luca.md): how often each kind of player looks at which of Luca's
 * shirts hangs in its own light before choosing. Who does not look chooses as if the light were not
 * there: any shirt, any element.
 */
const LIGHT_READ: Record<Policy, number> = { attack: 0, random: 0, casual: .3, smart: 1 };
/** The fight as a player who has not looked at the light sees it this turn (a copy without it), or the fight itself. */
function unread(state: BattleState, policy: Policy, random: () => number) {
  // The castle's El Ausente: who does not read its plate swings at it as if it were there.
  if (state.foes.some(f => f.hp > 0 && f.kind === 'ausente' && f.castle?.away) && random() >= LIGHT_READ[policy]) {
    const blind = copy(state);
    for (const f of blind.foes) if (f.kind === 'ausente' && f.castle) f.castle.away = false;
    return blind;
  }
  if (!state.light || !state.foes.some(f => f.hp > 0 && f.kind?.startsWith('estampado')) || random() < LIGHT_READ[policy]) return state;
  const blind = copy(state);
  delete blind.light;
  return blind;
}
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
  if (policy === 'casual') { const seen = unread(state, policy, random); return best(options, choice => damageNow(seen, choice))[0]; }
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
  /** Seconds on the fight's clock from the first turn to the end: thinking, blows, the foes' turns. */
  seconds: number;
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
   * `ojo-roto` (Vertitrón's eye broken, no more Rayo), `lampara-rota` (a lamp of Fran's canopy broken),
   * `anulado` (a party's blow the salon's light ate); and on the party's side `triple:<action>`,
   * the action that spent a Punto débil (×3).
   */
  events: Record<string, number>;
  /** The foes' moves by who made them: foe kind → ability id → times (the bestiary lists them, src/bestiary.ts). */
  moves: Partial<Record<FoeKind, Record<string, number>>>;
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
/**
 * La Voz (docs/quests/marta.md § Final boss): how often each kind of player waits for one of her
 * silences before a blow, the shortest silence worth waiting for (`ROOM`) and how far into it the
 * press comes (`REACT`, seconds). `smart` holds on while she sings at them and her next silence is
 * more than `DENSE` seconds away.
 */
const TIMED: Record<Policy, number> = { attack: 0, random: 0, casual: .5, smart: 1 };
const ROOM = .2, REACT = .12, DENSE = .8;
/** Against her song nobody sits and thinks: the menu is open and the hand on it, waiting for the beat. */
const SONG_THINK = 1.2;
/** How long after the first press the partner's comes, for the Acorde, and how often it is ready to. */
const NOTE_LAG = .2;
const CHORD: Record<Policy, number> = { attack: 0, random: 0, casual: .15, smart: .8 };
/** One fight, from its first turn to its end. */
export function playFight(setup: Setup, seed: number): Run {
  const random = seeded(seed);
  return playOut(createFight(setup, random), setup, random);
}
/**
 * A fight already created, played to its end by `setup`'s bot (only its policy, ban, error, think and
 * maxRounds are read): how the whole-game simulator (src/game-sim.ts) plays a story's fight with the
 * party exactly as the story has it. `state` is played in place, so it holds the end afterwards.
 */
export function playOut(state: BattleState, setup: Setup, random: () => number): Run {
  const think = setup.think ?? 3, maxRounds = setup.maxRounds ?? 60;
  const run: Run = { outcome: 'draw', rounds: 0, hpLeft: 0, kos: 0, used: {}, damage: {}, duals: 0, events: {}, moves: {}, biggest: 0, seconds: 0 };
  // The fight's own clock, counted: how long it lasts at the table (thinking, blows, foes' turns).
  const tick = (seconds: number) => { run.seconds += seconds; runClock(state, seconds); };
  const over = () => state.phase === 'won' || state.phase === 'lost';
  const hadOnion = state.foes.some(f => isOnion(f.kind));
  const count = (key: string) => { run.events[key] = (run.events[key] ?? 0) + 1; };
  const note = (effect?: BattleEffect) => {
    if (!effect) return;
    if (effect.kind === 'enemy' && effect.ability) {
      count(effect.ability.id);
      const kind = state.foes.find(f => f.id === effect.actor)?.kind;
      if (kind) { const moves = run.moves[kind] ??= {}; moves[effect.ability.id] = (moves[effect.ability.id] ?? 0) + 1; }
    }
    if (effect.eye) count('ojo-roto');
    // Fran's salon: a lamp of the canopy broken, and a blow the light ate.
    if (effect.lampBroken) count('lampara-rota');
    if (effect.annulled) count('anulado');
    // La Voz: a blow that went through her while she sang, and an Acorde in one of her silences.
    if (effect.sung) count('atraviesa');
    if (effect.chord) count('acorde');
    if (effect.reaction) count(effect.reaction.id);
  };
  const watch = () => {
    run.firstKo ??= state.allies.some(a => a.hp <= 0) ? state.round : undefined;
    if (hadOnion) run.peeledBy ??= state.foes.every(f => !isOnion(f.kind) || !f.layers || f.hp <= 0) ? state.round : undefined;
    takeNews(state).forEach(note);
    // La Voz's song: each note she sang is a move of hers (the bestiary lists them), what it set off, and her Crescendos and parts.
    for (const news of takeSongNews(state)) {
      if (news.kind === 'nota') {
        count(news.ability);
        const moves = run.moves.voz ??= {}; moves[news.ability] = (moves[news.ability] ?? 0) + 1;
        if (news.conducted) count('conduccion');
        news.shocked?.forEach(() => count('shock'));
      } else count(news.kind === 'part' ? `parte:${news.part}` : news.kind);
    }
  };
  /** La Voz: the moment the last blow that found her in a silence was pressed, and by whom (for the partner's Acorde). */
  let pressed: { t: number; by: string } | undefined;
  while (!over() && state.round <= maxRounds) {
    if (state.phase === 'player') {
      // A choice queued ahead plays on its own after a short flash; anyone else thinks first.
      const waiting = !!state.queued?.[state.allies[state.active].id];
      // La Voz: two who read her song have the second blow ready to press inside the silence the first one
      // struck in (the Acorde); it is judged at that press (`song.aim`), though it plays after the first.
      const chooser = state.allies[state.active], struck = state.song?.struck;
      const chordAt = pressed && struck && struck.by === pressed.by && pressed.by !== chooser.id ? pressed.t + NOTE_LAG : undefined;
      const sameSilence = chordAt !== undefined && (() => { const gap = silenceAt(songAt(VOZ_SONG, chordAt)); return !!gap && gap.loop === struck!.loop && gap.index === struck!.index; })();
      const ready = sameSilence && random() < CHORD[setup.policy];
      pressed = undefined;
      if (!ready) { tick(waiting ? BEAT.queue / 1000 : state.song ? Math.min(think, SONG_THINK) : think); watch(); }
      if (over()) break;
      // The song took whoever was choosing (a note) and nobody else is left to: the foes go.
      if (state.phase !== 'player') continue;
      // La Voz (docs/quests/marta.md): whoever reads her song holds on while she sings at them and her next silence is
      // far, and otherwise waits for a silence before choosing (`TIMED`); the song goes on meanwhile. If it takes the one
      // choosing, the turn has moved on. With her second voice standing there is someone to strike while she sings: nobody waits.
      let held: Choice | undefined;
      const voz = state.foes.find(f => f.kind === 'voz' && f.hp > 0), alone = !state.foes.some(f => f.hp > 0 && f.kind !== 'voz');
      if (state.song && voz && alone && !ready && !waiting) {
        const me = state.allies[state.active], gap = () => untilSilence(VOZ_SONG, state.song!.t, ROOM);
        if (setup.policy === 'smart' && voz.facing === me.id && !me.guarding && gap() > DENSE && !setup.ban?.includes('defend')) held = { action: 'defend' };
        else if (gap() > 0 && random() < TIMED[setup.policy]) {
          tick(gap() + REACT); watch();
          if (over()) break;
          if (state.phase !== 'player' || state.allies[state.active].id !== me.id) continue;
        }
      }
      // The artilugio (docs/castle-bosses.md § With the artilugio): while she has Aitor, whoever reads the fight plays
      // the melody's next notes, two a turn; anyone else plays any of its eight notes. It takes nobody's turn.
      if (artilugioLive(state)) for (let n = 0; n < (setup.policy === 'smart' ? 2 : 1) && artilugioLive(state); n++) { castleNote(state, setup.policy === 'smart' ? nextNote(state) : Math.floor(random() * ARTILUGIO_NOTES.length)); count('nota'); }
      // The partner's Acorde is chosen and judged at its press, inside the silence (a blow there is worth something).
      if (ready && state.song) state.song.aim = chordAt;
      const queued = takeQueued(state);
      const choice: Choice = queued ? { ...queued } : held ?? decide(state, setup, random);
      // Someone in no hurry queues their own choice while the first one chooses (`QUEUE`): their dual, if any, comes by chance.
      const partner = !queued && dualPartner(state);
      if (partner && QUEUE[setup.policy] && pairable(state) && random() < QUEUE[setup.policy]) queue(state, partner.id, ahead(state, partner.id, setup, random));
      const pressAt = state.song?.aim ?? state.song?.t;
      const hp = state.foes.map(f => f.hp), effect = play(state, choice, setup.ban);
      if (state.song) delete state.song.aim;
      if (!effect) throw new Error(`The bot chose something illegal: ${JSON.stringify(choice)}`);
      // A blow that found La Voz in a silence: the partner may press inside the same one.
      if (state.song && pressAt !== undefined && !effect.chord && state.song.struck?.by === effect.actor && (effect.amount ?? 0) > 0) pressed = { t: pressAt, by: effect.actor };
      const key = effect.dual?.id ?? choice.skill ?? choice.action;
      if (effect.dual) run.duals++;
      const dealt = state.foes.reduce((sum, foe, i) => sum + (hp[i] ?? foe.maxHp) - foe.hp, 0);
      run.used[key] = (run.used[key] ?? 0) + 1;
      run.damage[key] = (run.damage[key] ?? 0) + dealt;
      run.biggest = Math.max(run.biggest, dealt);
      if (markSpent(effect) || effect.hits?.some(h => h.weakSpot)) count(`triple:${key}`);
      note(effect); watch();
      // A dual's cinematic runs the fight's clock a little longer; the partner's thinking overlapped the first one's.
      tick(effect.dual ? DUAL_CLOCK : ACTION_SECONDS); watch();
    } else if (state.phase === 'enemy') {
      for (const foe of state.foes.filter(f => f.hp > 0)) {
        if (state.phase !== 'enemy') break;
        // La Voz while she only sings has no turn, and takes no time, as on screen: her song never waits on it. (Parts
        // and other turnless foes still count a turn's time here; the fights tuned with them were measured so.)
        const moved = enemyAct(state, foe.id);
        note(moved);
        watch();
        if ((moved || foe.kind !== 'voz') && state.phase === 'enemy') tick(ACTION_SECONDS);
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
      if (skillKnown(skill.id, row.levels, improvedBy(nodesFor(row.levels, row.improved))) && !row.ban.includes(skill.id) && !row.used[skill.id]) unused.add(skill.name);
    }
  }
  const everUsed = new Set(rows.filter(r => r.policy === 'smart').flatMap(r => Object.keys(r.used)));
  const never = [...unused].filter(name => !everUsed.has(SKILLS.find(s => s.name === name)!.id));
  if (never.length) lines.push(`AVISO smart nunca usa, en toda esta tabla: ${never.join(', ')}. Puede sobrar, o puede que el bot no sepa valorarla.`);
  // A dual the best bot could make (each half learned and worn by someone from the start) and never does.
  const worn = (party: string) => party.split('+').map(entry => entry.split(':')[1]);
  const noDual = DUALS.filter(dual => rows.some(row => row.policy === 'smart' && !dualBanned(dual, row.ban)
    && dual.parts.every(part => { const skill = SKILLS.find(s => s.id === part)!; return worn(row.party).includes(skill.class) && skillKnown(skill.id, row.levels, improvedBy(nodesFor(row.levels, row.improved))); }))
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
/** Atacar's three elements and what lays and cashes them: the jar as a party reaching the castle may have it. */
const ELEMENTAL = ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico', 'matemagico:vasos', 'matemagico:descarga'];
/** Uri's tower with both ánimas grown: Papagato at 2 (ring 1 needs it), Matemágico at 1 or 2 (2 if Gerard wears it up the tower), 3 for whoever grinds. */
const P2M1 = { papagato: 2, matemagico: 1 }, P2M2 = { papagato: 2, matemagico: 2 }, P3M2 = { papagato: 3, matemagico: 2 }, P3M3 = { papagato: 3, matemagico: 3 };
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
  { id: 'plato-sin-pensar', fight: 'plato', party: MISSION_PARTY, levels: L2, policy: 'casual', win: [0, .2], roundsWon: [4, 10], why: 'Sin leer el plato se pierde: ¡Puaj! salpica, la sorpresa no deja entrar nada y cada golpe que no acierta con el plato es una ronda regalada.' },
  // Ring 3's fear: La Cebolla y los suyos.
  { id: 'escolta-bien', fight: 'escolta', party: DUO, levels: P2M2, policy: 'smart', win: [.85, 1], hpLeftWon: [.25, .65], roundsWon: [3.5, 6], why: 'El último anillo es la prueba: primero el fantasmita, pelar la cebolla, agarrarse al Aplastón. Pensando, ágil.' },
  { id: 'escolta-sin-duales', fight: 'escolta', party: DUO, levels: P2M2, policy: 'smart', ban: ['duals'], win: [.75, .98], roundsWon: [5, 7.5], why: 'Sin duales también se pasa, con orden, pero más largo y más justo.' },
  { id: 'escolta-mision-bien', fight: 'escolta', party: MISSION_PARTY, levels: P2M1, policy: 'smart', win: [.8, 1], why: 'Con los gatos en Gerard también se pasa pensando el orden: el fantasmita, luego pelar.' },
  // Casual is the escort's cliff (4 % with four layers, 0 % with five): the floor is 0, since 80 fights (the tests) often see none of those wins.
  { id: 'escolta-sin-pensar', fight: 'escolta', party: MISSION_PARTY, levels: P2M1, policy: 'casual', win: [0, .15], why: 'A lo loco, la Cebolla y los suyos ganan casi siempre.' },
  // The way home at night (src/night.ts): the one that catches them brings the palace's whole guard, as the palace has it now,
  // so the street tells the truth about the palace. Without friends' ánimas there is no winning it: get home unseen.
  // At night the castle's pupils of the floor the party is on walk the Meridiana, stronger out there the fewer friends
  // and levels the party has (src/night.ts `nightMight`). Provisional numbers: Aitor balances the night later.
  { id: 'noche-sin-amigos', fight: 'night-guard:alumnos-1a', party: 'gerard:matemagico+aitor:tecnopata', animas: ['matemagico', 'tecnopata'], policy: 'smart', win: [0, .05], why: 'Sin ánimas de amigos, los alumnos del castillo que salen de noche no se ganan ni pensando: hay que llegar a casa sin que te pillen.' },
  { id: 'noche-con-nuria', fight: 'night-guard:delegada-1', party: DUO, friends: ['nuria'], levels: P2M2, policy: 'smart', win: [0, .2], why: 'Con el ánima de Nuria, La Delegada y los suyos aún son demasiados aquí fuera: Aitor ya lo dice, mejor no probarlo.' },
  { id: 'noche-con-tres', fight: 'night-guard:delegada-1', party: DUO, friends: ['nuria', 'universidad', 'marta'], levels: P3M3, policy: 'smart', win: [.6, 1], why: 'Con tres amigos y las ánimas crecidas, ya se les puede: lo que ganan fuera es lo que ganarían dentro.' },
  // Vertitrón, the final boss. Its numbers are VERTIGO (book vertigo.boss), PROFILES.vertigo and its eye's (foe.vertigo-ojo).
  // Grito liberador is what decides it: every shout makes the party weaker and it stronger for good, so a long fight turns on them.
  { id: 'vertigo-duo-bien', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.5, .9], roundsWon: [3.5, 8], duals: [1, 5], why: 'Con los gatos en Aitor y el fuego en Gerard, quien descubre los duales lo tumba deprisa, antes de que grite mucho.' },
  { id: 'vertigo-sin-duales', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', ban: ['duals'], win: [.85, 1], hpLeftWon: [.2, .55], roundsWon: [10, 15], why: 'Sin ataques duales también se gana: romper el ojo antes del rayo, agarrarse cuando carga. Cuesta vida y rondas, y cada grito pesa.' },
  { id: 'vertigo-eco-mana', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'casual', improved: ['papagato:mana-1'], win: [.05, .5], why: 'Dos ecos en más maná ayudan a quien no le da vueltas, pero no le dan el combate: sin romper el ojo ni agarrarse, pierde más de la mitad.' },
  { id: 'vertigo-eco-elementos', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', improved: ['matemagico:agua', 'matemagico:fuego', 'matemagico:electrico'], hpLeftWon: [.6, .9], why: 'Los elementos son una respuesta más, no lo que decide el combate.' },
  { id: 'vertigo-sin-pensar', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'casual', win: [0, .2], why: 'Sin pensar, Vertitrón gana: quien no rompe el ojo ni se agarra al rayo llega al final sin fuerzas, grito a grito.' },
  { id: 'vertigo-poco-matemagico', fight: 'uri-vertigo', party: DUO, levels: P2M1, policy: 'smart', win: [.9, 1], why: 'Con Matemágico a nivel 1 no hay Punto débil, pero basta Zarpazos de fuego.' },
  { id: 'vertigo-sin-gatos-aitor', fight: 'uri-vertigo', party: MISSION_PARTY, levels: P2M2, policy: 'smart', win: [.55, 1], hpLeftWon: [0, .45], why: 'Si Aitor no lleva a los gatos, se puede, pero sufriendo y no siempre: Gerard tiene que cambiar de ánima para todo y se gana con muy poca vida.' },
  { id: 'vertigo-a-punetazos', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'attack', win: [0, .02], why: 'Solo Atacar no llega: sus gritos y su rayo piden algo más.' },
  { id: 'vertigo-nivel-3', fight: 'uri-vertigo', party: DUO, levels: P3M2, policy: 'smart', win: [.95, 1], hpLeftWon: [.4, .9], why: 'Quien ha subido mucho lo nota, pero el jefe sigue pidiendo cabeza.' },
  { id: 'vertigo-pensando-despacio', fight: 'uri-vertigo', party: DUO, levels: P2M2, policy: 'smart', think: 8, win: [.9, 1], hpLeftWon: [0, .9], why: 'Quien piensa despacio deja arder más el fuego, y aun así Vertitrón no se vuelve un trámite.' },
  // La Sobremesa (docs/quests/universidad.md § Final boss): seven friends, each their own target and move. Its numbers are
  // SOBREMESA (book sobremesa.boss) and each friend's PROFILES entry (foe.sobremesa-anna…). Many at once is what makes it:
  // anything that reaches every foe pays, focusing one at a time pays, and Cortafuegos taxes whoever focuses.
  // Tuned at the top level (both ánimas at 3), how the party gets there: thinking wins about half, and only just.
  { id: 'sobremesa-duo-bien', fight: 'sobremesa', party: DUO, levels: P3M3, policy: 'smart', win: [.4, .72], hpLeftWon: [.08, .32], roundsWon: [12, 18], why: 'El jefe final, con todo al máximo: siete a la vez, la sopeta de Anna los recompone a todos, y aun pensando se gana justo la mitad de las veces.' },
  { id: 'sobremesa-sin-pensar', fight: 'sobremesa', party: DUO, levels: P3M3, policy: 'casual', win: [0, .05], why: 'Sin pensar gana la mesa: el dúo de la carta negra deja a uno con 1 PV, Joan no para de subir y la sopeta deshace lo que se le quita a uno solo.' },
  { id: 'sobremesa-a-punetazos', fight: 'sobremesa', party: DUO, levels: P3M3, policy: 'attack', win: [0, .02], why: 'Solo Atacar no llega: son siete.' },
  { id: 'sobremesa-sin-gatos-aitor', fight: 'sobremesa', party: MISSION_PARTY, levels: P3M3, policy: 'smart', win: [0, .15], why: 'Con Aitor sin ánima no se puede: el jefe final pide a los dos con lo suyo.' },
  { id: 'sobremesa-pronto', fight: 'sobremesa', party: DUO, levels: P2M2, policy: 'smart', win: [0, .2], why: 'A nivel 2 todavía no: La Sobremesa pide haber crecido por el camino.' },
  // Càmping Eurosport (docs/quests/universidad.md § Càmping Eurosport). Its numbers are CAMPING (book camping.rules) and
  // each foe's PROFILES entry (foe.mago…). The small fights teach one rule each and are easy for whoever reads the plate;
  // the black pitch is the hard one, and El Campeón the mini-boss: hold on while it is a hero, spend everything when it is not.
  { id: 'magos-entrada', fight: 'camping-magos', party: DUO, levels: P2M2, policy: 'casual', win: [.95, 1], hpLeftWon: [.45, .95], roundsWon: [2.5, 5], why: 'La entrada: a golpes caen rápido, y la bombona solo se nota si nadie se agarra.' },
  { id: 'magos-con-magia', fight: 'camping-magos', party: TECH, levels: P2M2, policy: 'smart', win: [.95, 1], roundsWon: [3, 6.5], why: 'Con la magia por delante también se pasa, pero más largo: les hace la mitad.' },
  { id: 'dados-faciles', fight: 'camping-dados', party: DUO, levels: P2M2, policy: 'casual', win: [.95, 1], hpLeftWon: [.35, .95], why: 'Los dados son las peleas pequeñas de la mazmorra: se ganan sin darle vueltas.' },
  { id: 'agentes-faciles', fight: 'camping-agentes', party: DUO, levels: P2M2, policy: 'casual', win: [.95, 1], hpLeftWon: [.45, .95], why: 'Dos agentes: uno da la cara y el otro no; se ganan sin pensar, mejor pegando al que está boca arriba.' },
  { id: 'tienda-facil', fight: 'camping-tienda', party: DUO, levels: P2M2, policy: 'casual', win: [.9, 1], why: 'Una parcela equivocada despierta su tienda: un susto, no un muro.' },
  { id: 'tienda-sin-gatos-aitor', fight: 'camping-tienda', party: MISSION_PARTY, levels: P2M2, policy: 'smart', win: [.9, 1], why: 'También con Aitor sin ánima.' },
  { id: 'negra-bien', fight: 'camping-negra', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.2, .65], why: 'La parcela negra es la pelea dura: agarrarse a la bombona, golpes a los magos y primero los seises. Pensando se pasa, con poca vida.' },
  { id: 'negra-sin-pensar', fight: 'camping-negra', party: DUO, levels: P2M2, policy: 'casual', win: [0, .2], why: 'Sin pensar, la parcela negra gana: dos bombonas a la vez sin agarrarse y los dados cayendo.' },
  { id: 'negra-con-magia', fight: 'camping-negra', party: TECH, levels: P2M2, policy: 'smart', win: [0, .2], why: 'Con dos ánimas de magia contra los magos se pierde: la respuesta es pegarles a golpes.' },
  { id: 'campeon-bien', fight: 'campeon', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.3, .8], roundsWon: [6, 12], why: 'El Campeón, pensando: frustrarle el plan con magia antes de que se llene, Defender al que apunta y pegarle con golpes.' },
  { id: 'campeon-sin-pensar', fight: 'campeon', party: DUO, levels: P2M2, policy: 'casual', win: [0, .2], why: 'Sin pensar, el villano gana: su plan se cumple una y otra vez y el Rayo total os barre.' },
  { id: 'campeon-a-punetazos', fight: 'campeon', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Solo Atacar no llega: nadie le frena el plan.' },
  { id: 'campeon-con-tecnopata', fight: 'campeon', party: TECH, levels: P2M2, policy: 'smart', win: [.85, 1], why: 'Con dos de magia también se gana: frustran a la vez, aunque le pegan a la mitad.' },  // Las cuerdas (docs/quests/marta.md). Its numbers are MARTA (book marta.rules) and each foe's PROFILES entry
  // (foe.lealtad…). Each quality asks one question, answered by whoever reads its plate.
  { id: 'lealtad-bien', fight: 'cuerdas-lealtad', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.4, .85], roundsWon: [2.5, 8], why: 'La Lealtad, pensando: callar primero a su Eco con lo que alcanza a todos, y que se agarre quien ella ha jurado golpear.' },
  { id: 'lealtad-sin-pensar', fight: 'cuerdas-lealtad', party: DUO, levels: P2M2, policy: 'casual', win: [0, .3], why: 'Sin pensar se pierde: su Juramento cae entero sobre quien no se agarra, y el Eco lo repite cada vez más fuerte.' },
  { id: 'lealtad-a-punetazos', fight: 'cuerdas-lealtad', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Solo Atacar no llega: ella lo para todo y el Eco, detrás, no deja de crecer.' },
  { id: 'cristalino-a-golpes', fight: 'cuerdas-cristalino', party: DUO, levels: P2M2, policy: 'attack', win: [.95, 1], hpLeftWon: [.25, .65], why: 'Lo Cristalino se rompe a golpes: quien lee la placa y no lanza magia lo pasa, pagando sus destellos.' },
  { id: 'cristalino-bien', fight: 'cuerdas-cristalino', party: DUO, levels: P2M2, policy: 'smart', win: [.95, 1], why: 'Con los gatos y un dual, que no rebota, cae deprisa.' },
  { id: 'cristalino-a-lo-loco', fight: 'cuerdas-cristalino', party: TECH, levels: P2M2, policy: 'random', win: [.1, .7], why: 'Con dos ánimas de magia y sin mirar, la magia vuelve: se pierde a menudo.' },
  { id: 'directo-bien', fight: 'cuerdas-directo', party: DUO, levels: P2M2, policy: 'smart', win: [.95, 1], hpLeftWon: [.35, .7], why: 'Lo Directo, pensando: agarrarse cuando te mira y pegar cuando mira al otro.' },
  { id: 'directo-sin-pensar', fight: 'cuerdas-directo', party: DUO, levels: P2M2, policy: 'casual', win: [0, .2], why: 'Sin agarrarse a la Estocada ni guardarse para cuando se queda clavado, pega demasiado y aguanta demasiado.' },
  { id: 'directo-a-punetazos', fight: 'cuerdas-directo', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Solo Atacar no llega: pega demasiado fuerte para aguantarlo sin Defender.' },
  { id: 'directo-con-tecnopata', fight: 'cuerdas-directo', party: TECH, levels: P2M2, policy: 'smart', win: [0, .35], why: 'Con dos ánimas de magia y sin nada que le duela de verdad, la ventana de Clavado no basta.' },
  { id: 'directo-electrico', fight: 'cuerdas-directo', party: TECH, levels: P2M2, policy: 'smart', improved: ['matemagico:electrico'], win: [.65, 1], why: 'Lo Directo es una lanza: es débil a lo eléctrico. Con ese elemento en Atacar, las dos ánimas de magia que sin él perdían, ganan.' },
  // La Voz, the mission's boss (2026-11-20: each note she sings is a beam, and she is only hurt in her silences). Who
  // strikes while she sings loses the blow; who stands in her song while she sings at them takes every note whole, and the
  // water and the bolt on top (Conducción, Shock); the Acorde (both inside the same silence) is what shortens it.
  { id: 'voz-bien', fight: 'voz', party: DUO, levels: P3M3, policy: 'smart', win: [.9, 1], hpLeftWon: [.22, .58], roundsWon: [10, 16], why: 'La Voz, leyendo la canción: pegar en sus silencios, los dos en el mismo si se puede, y cubrirse mientras canta a uno y tarda en callar.' },
  { id: 'voz-sin-cubrirse', fight: 'voz', party: DUO, levels: P3M3, policy: 'smart', ban: ['defend'], win: [.5, .86], why: 'Pegando bien pero sin cubrirse nunca, sus notas entran enteras y con el agua y el rayo encima: cuesta bastante más.' },
  { id: 'voz-sin-duales', fight: 'voz', party: DUO, levels: P3M3, policy: 'smart', ban: ['duals'], win: [.6, 1], hpLeftWon: [.1, .45], why: 'Sin ataques duales también se gana, más largo: el Crescendo ya aprieta al final.' },
  { id: 'voz-sin-pensar', fight: 'voz', party: DUO, levels: P3M3, policy: 'casual', win: [0, .15], why: 'Quien pega mientras canta la atraviesa y pierde el golpe, y no se cubre cuando las notas van a por él: casi nunca gana.' },
  { id: 'voz-a-punetazos', fight: 'voz', party: DUO, levels: P3M3, policy: 'attack', win: [0, .02], why: 'Sin mirar la canción no hay manera.' },
  { id: 'voz-con-tecnopata', fight: 'voz', party: TECH, levels: P3M3, policy: 'smart', win: [.25, .8], why: 'Con dos ánimas de magia y sin duales cuesta más: menos golpe en cada silencio, y Aitor con poco Espíritu se lleva caras sus notas.' },
  // The castle (docs/castle.md, docs/castle-bosses.md), preliminary: measured 2026-11-19 with the dual party at Papagato 3 and Atacar's three elements bought.
  { id: 'alumnos-primero', fight: 'alumnos-1a', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [.9, 1], why: 'Primer curso: chicle fresco, la primera lección del juego. Se gana sin pensar mucho.' },
  { id: 'alumnos-tercero-bien', fight: 'alumnos-3b', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.8, 1], why: 'Tercer curso: el Empollón se aprende el golpe y el Repetidor lleva costra; alternar físico y mágico, y tumbar a la Chivata antes.' },
  { id: 'alumnos-tercero-sin-pensar', fight: 'alumnos-3b', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .1], why: 'Repetir el mismo golpe contra el Empollón y dejar a la Chivata marcar: se pierde.' },
  { id: 'ausente-bien', fight: 'alumnos-2d', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.9, 1], why: 'El Ausente solo está la ronda después de su golpe: pegarle entonces, o dejarle un fuego que trabaje mientras no está, y Defender el Empujón anunciado.' },
  { id: 'ausente-sin-pensar', fight: 'alumnos-2d', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .2], why: 'Quien no lee su placa le pega al aire la mitad de las rondas, y entre «Presente» y Empujón se pierde.' },
  { id: 'castigado-bien', fight: 'alumnos-2e', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.9, 1], why: 'El Castigado no ataca: dejarlo para el final, sin darle tres golpes que no lo tumben, y alternar físico y mágico contra el Empollón.' },
  { id: 'castigado-sin-pensar', fight: 'alumnos-2e', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .2], why: 'Pegándole por el camino se le llena la Rabia y revienta sobre todos mientras el Empollón sigue: se pierde.' },
  { id: 'monton-bien', fight: 'alumnos-3d', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.9, 1], why: 'El Montón copia el primer golpe que recibe: abrir con uno flojo y sin nada (ni fuego, ni agua, ni corriente, ni sangrado, ni a todos), y la Chivata antes.' },
  { id: 'monton-sin-pensar', fight: 'alumnos-3d', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .35], why: 'Abrir con lo más fuerte le enseña un golpe a todos con sangrado: lo devuelve cada turno, triple sobre el marcado, y casi siempre se pierde.' },
  { id: 'delegada-bien', fight: 'delegada-3', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.7, 1], why: 'La Delegada: callarla o tumbarla primero, y bajar a los Gemelos a la par.' },
  { id: 'delegada-sin-pensar', fight: 'delegada-3', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .1], why: 'Con ella mandando, todos al mismo: sin orden se pierde.' },
  { id: 'aurelia-bien', fight: 'aurelia', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.6, 1], why: 'Aurelià: romper el atril, defender la Pregunta, cambiar de estado de reloj en la carrera y gastar lo guardado antes del Récord.' },
  { id: 'aurelia-sin-pensar', fight: 'aurelia', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .1], why: 'Pegándole tras el atril, a mitad de daño, y sin tropiezos: las vueltas se acumulan.' },
  { id: 'direccion-bien', fight: 'direccion', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.7, 1], why: 'Dirección: primero la del agua, a cada una su debilidad, y Defender cuando el acta está cerrada.' },
  { id: 'direccion-sin-pensar', fight: 'direccion', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .05], why: 'Mojados y sin orden, la Circular y la Resolución acaban con el grupo.' },
  { id: 'reina-toma-a-aitor', fight: 'reina', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [0, 0], why: 'La primera vez no se gana: al décimo de sus PV toma a Aitor, y sin el artilugio Gerard cae.' },
  { id: 'reina-con-artilugio', fight: 'reina-vuelta', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'smart', win: [.9, 1], why: 'Con el artilugio: romper la pompa o defenderla, y tocar las seis notas cuando tiene a Aitor.' },
  { id: 'reina-sin-melodia', fight: 'reina-vuelta', party: DUO, levels: L3, improved: ELEMENTAL, policy: 'casual', win: [0, .1], why: 'Tocando botones al azar las marcas se apagan: Aitor sigue siendo suyo.' },
  // Emilie's model (docs/quests/emilie.md § Fights). Its numbers are MODELO (book modelo.rules) and each foe's PROFILES entry
  // (foe.celda-seca…). Inside it every Atacar can carry water or electricity, so the answer never depends on the jar. The
  // small fights teach one piece each; the boss asks for all of it, and a blow of the right element takes nothing more off
  // it than a plain one: what it buys is a mark of Error, and the turns it stands solid.
  { id: 'celdas-bien', fight: 'modelo-celdas', party: DUO, levels: P2M2, policy: 'smart', win: [.95, 1], hpLeftWon: [.35, .8], roundsWon: [3.5, 7], why: 'Las celdas secas, leyendo la placa: primero agua, luego la electricidad corre por todas las mojadas.' },
  { id: 'celdas-a-punetazos', fight: 'modelo-celdas', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Secas, todo les entra a la mitad: a puñetazos no da tiempo.' },
  { id: 'oscilacion-probando', fight: 'modelo-oscilacion', party: DUO, levels: P2M2, policy: 'casual', win: [.95, 1], roundsWon: [3.5, 7], why: 'La oscilación enseña la regla del jefe en pequeño: probando elementos se encuentra, y se nota en el número.' },
  { id: 'oscilacion-a-punetazos', fight: 'modelo-oscilacion', party: DUO, levels: P2M2, policy: 'attack', roundsWon: [8, 14], hpLeftWon: [0, .35], why: 'Sin elemento también cae, pero el doble de largo y por los pelos: la diferencia se ve.' },
  { id: 'atomo-bien', fight: 'modelo-atomo', party: DUO, levels: P2M2, policy: 'smart', win: [.95, 1], hpLeftWon: [.35, .8], why: 'Arrancarle el agua o el rayo antes de su Reacción, sin devolverle lo arrancado: la Reacción se queda en nada.' },
  { id: 'atomo-probando', fight: 'modelo-atomo', party: DUO, levels: P2M2, policy: 'casual', win: [.8, 1], why: 'Probando elementos se encuentra: el primer golpe que arranca un electrón lo dice, y el que se lo devuelve también.' },
  { id: 'atomo-primer-dia', fight: 'modelo-atomo', party: 'gerard:matemagico+aitor:-', levels: L1, improved: [], exact: true, policy: 'smart', win: [.85, 1], why: 'Sin fuego ni tarro: el modelo presta el agua y el rayo, y arrancar esos dos basta para que la Reacción solo queme.' },
  { id: 'atomo-a-punetazos', fight: 'modelo-atomo', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Sin elemento, cada Reacción os moja y la descarga os atraviesa a todos.' },
  { id: 'no-converge-bien', fight: 'no-converge', party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.3, .7], roundsWon: [8, 15], why: 'El que no converge, leyendo la placa: el elemento en el que no está le quita Error, y convergido se le pega con todo.' },
  { id: 'no-converge-sin-pensar', fight: 'no-converge', party: DUO, levels: P2M2, policy: 'casual', win: [0, .05], roundsLost: [4, 9], why: 'El golpe acertado no quita más PV que uno cualquiera: quien solo mira el número nunca lo hace converger, y su Descarga crece.' },
  { id: 'no-converge-a-punetazos', fight: 'no-converge', party: DUO, levels: P2M2, policy: 'attack', win: [0, .02], why: 'Sin elementos no converge nunca.' },
  { id: 'no-converge-primer-dia', fight: 'no-converge', party: 'gerard:matemagico+aitor:-', levels: L1, improved: [], exact: true, policy: 'smart', win: [.85, 1], why: 'Al alcance de quien llega el primer día, sin tarro ni niveles y con Aitor sin ánima: el modelo presta el agua y la electricidad.' },
  { id: 'no-converge-con-tecnopata', fight: 'no-converge', party: TECH, levels: P2M2, policy: 'smart', win: [.85, 1], why: 'Con dos ánimas de magia también: la respuesta está en Atacar, no en lo que se lleve puesto.' },
  // Fran's salon (docs/quests/luca.md). Its numbers are LUCA (book luca.rules) and each foe's PROFILES entry
  // (foe.polilla…). The light walks through every fight: the party's blows of its element do nothing.
  { id: 'recepcion-ensena', fight: 'luca-recepcion', party: DUO, levels: P2M2, policy: 'casual', win: [.85, 1], why: 'La recepción enseña la luz: el fuego deja de servir a mitad de combate. Se pasa igual, pero se nota.' },
  { id: 'sillones-bien', fight: 'luca-sillones', party: DUO, levels: P2M2, policy: 'smart', win: [.88, 1], hpLeftWon: [.25, .6], why: 'Los capellanes, pensando: primero el recién peinado, y los demás se quedan a medio gesto.' },
  { id: 'sillones-deslumbrados', fight: 'luca-sillones', dazzled: true, party: DUO, levels: P2M2, policy: 'smart', win: [.9, 1], hpLeftWon: [.4, .75], why: 'Con los espejos de la nave resueltos los capellanes empiezan deslumbrados: el mismo combate, con más vida al acabar.' },
  { id: 'sillones-sin-pensar', fight: 'luca-sillones', party: DUO, levels: P2M2, policy: 'casual', win: [0, .2], why: 'Sin mirar quién lleva el peinado nuevo, cada gesto se repite.' },
  { id: 'sillones-a-punetazos', fight: 'luca-sillones', party: DUO, levels: P2M2, policy: 'attack', win: [0, .05], why: 'Solo Atacar no llega.' },
  { id: 'carta-bien', fight: 'luca-carta', party: DUO, levels: P2M2, policy: 'smart', win: [.88, 1], hpLeftWon: [.15, .55], why: 'Las camisas de Luca, pensando: pegar solo a la que está en su luz, y con otra cosa que el elemento que esa luz se come.' },
  { id: 'carta-sin-pensar', fight: 'luca-carta', party: DUO, levels: P2M2, policy: 'casual', win: [0, .35], why: 'Repartiendo golpes sin mirar la luz, la mayoría caen sobre una camisa apagada y no hacen nada.' },
  { id: 'fran-bien', fight: 'fran', party: DUO, levels: P3M3, policy: 'smart', win: [.9, 1], hpLeftWon: [.3, .7], roundsWon: [10, 16], why: 'Fran, pensando: romper cada lámpara en su propia luz, con otro elemento: se le apaga el brillo, esa luz ya no se come nada y la Aspersión cae casi limpia.' },
  { id: 'fran-sin-pensar', fight: 'fran', party: DUO, levels: P3M3, policy: 'casual', win: [0, .25], why: 'Sin mirar a las lámparas, cada luz le da más brillo, sigue comiéndose los elementos y la Aspersión llega teñida de todas.' },
  { id: 'fran-a-punetazos', fight: 'fran', party: DUO, levels: P3M3, policy: 'attack', win: [0, .05], why: 'Solo Atacar no llega.' },
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
