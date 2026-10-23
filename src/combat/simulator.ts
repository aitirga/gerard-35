/** Deterministic balancing tools. Policies are approximations, never a human difficulty model. */
import { activeCombatant, availableActions, createCombat, effectiveStats, resolveAmount, resolveDamage, stepCombat } from './engine.ts';
import { createBenchmarkEncounter } from './fixtures.ts';
import { assertCombatDefinition } from './validation.ts';
import type { Amount, CombatCommand, CombatDefinition, CombatEvent, CombatOutcome, CombatRuntime, CombatState, CombatantState, Effect, NumericMap } from './types.ts';

export const SIMULATION_VERSION = '1.0.0';
export const POLICY_IDS = ['basic', 'random', 'tactical'] as const;
export type PolicyId = typeof POLICY_IDS[number];
export interface SimulationConfig {
  runs: number;
  seed: number;
  policy: PolicyId;
  enemyPolicy: PolicyId;
  enemyHp: number;
  /** Scales direct damage effects in enemy actions. Periodic damage/reactions retain authored values. */
  enemyPower: number;
  maxRounds: number;
}
export const DEFAULT_SIMULATION_CONFIG: Readonly<SimulationConfig> = Object.freeze({
  runs: 200, seed: 3517, policy: 'tactical', enemyPolicy: 'tactical', enemyHp: 1, enemyPower: 1, maxRounds: 80,
});
export interface SampleReplay {
  seed: number;
  commands: CombatCommand[];
  events: CombatEvent[];
  finalState: CombatState;
}
export interface RunRecord {
  seed: number;
  outcome: 'win' | 'loss' | 'draw';
  winner?: string;
  reason: CombatOutcome['reason'];
  rounds: number;
  actions: number;
  /** Total surviving party HP / initial total party maximum HP, including casualties in denominator. */
  partyHpRemaining: number;
  partyCasualties: number;
  /** Gross party resource outflow, excluding HP; recovery does not cancel previous expenditure. */
  resourceSpent: number;
  resourceSpentById: NumericMap;
  replay?: SampleReplay;
}
export interface SimulationSummary {
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  lossRate: number;
  drawRate: number;
  winRateCI: [number, number];
  meanRounds: number;
  meanActions: number;
  meanPartyHpRemaining: number;
  meanPartyCasualties: number;
  meanResourceSpent: number;
  meanResourceSpentById: NumericMap;
  drawReasons: Record<string, number>;
}
export interface SimulationReport {
  version: string;
  engineSchemaVersion: 1;
  config: SimulationConfig;
  /** Fully resolved/tuned definition: replay this snapshot directly, without applying multipliers again. */
  encounter: CombatDefinition;
  seeds: number[];
  runs: RunRecord[];
  summary: SimulationSummary;
  sampleReplay: SampleReplay;
  /** Plugins must be supplied by the caller again; their implementation is not serialized. */
  runtimeEffects: string[];
}
export interface ComparisonReport {
  version: string;
  seed: number;
  seeds: number[];
  reports: SimulationReport[];
}

export function normalizeConfig(input: Partial<SimulationConfig> = {}): SimulationConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La configuración debe ser un objeto');
  for (const key of Object.keys(input)) if (!(key in DEFAULT_SIMULATION_CONFIG)) throw new Error(`Opción de simulación desconocida: ${key}`);
  const config = { ...DEFAULT_SIMULATION_CONFIG, ...input };
  const bounded = (key: 'runs' | 'seed' | 'enemyHp' | 'enemyPower' | 'maxRounds', minimum: number, maximum: number, integer: boolean) => {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      throw new Error(`${key} debe ser ${integer ? 'un entero' : 'un número'} entre ${minimum} y ${maximum}`);
    }
  };
  bounded('runs', 1, 10000, true);
  bounded('seed', 0, 0xffffffff, true);
  bounded('enemyHp', .1, 10, false);
  bounded('enemyPower', .1, 10, false);
  bounded('maxRounds', 1, 500, true);
  for (const key of ['policy', 'enemyPolicy'] as const) if (!POLICY_IDS.includes(config[key])) throw new Error(`${key} debe ser ${POLICY_IDS.join(', ')}`);
  return config;
}

/** First seed equals the input seed, so --runs 1 --seed <failed-seed> reproduces a run. */
export function createRunSeeds(seed: number, runs: number): number[] {
  normalizeConfig({ seed, runs });
  const seeds: number[] = [];
  let next = seed >>> 0;
  for (let i = 0; i < runs; i++) {
    seeds.push(next);
    next = (Math.imul(1664525, next) + 1013904223) >>> 0;
  }
  return seeds;
}

function scaleAmount(amount: Amount, factor: number): Amount {
  if (typeof amount === 'number') return amount * factor;
  return {
    ...amount, base: amount.base * factor,
    ...(amount.actorStat ? { actorScale: (amount.actorScale ?? 1) * factor } : {}),
    ...(amount.targetStat ? { targetScale: (amount.targetScale ?? -1) * factor } : {}),
    ...(amount.minimum !== undefined ? { minimum: amount.minimum * factor } : {}),
  };
}

/** Tuning is applied once to an immutable baseline; shared player actions are never modified. */
export function createSimulationEncounter(config: SimulationConfig, baseline?: CombatDefinition, runtime?: CombatRuntime): CombatDefinition {
  normalizeConfig(config);
  const encounter = structuredClone(baseline ?? createBenchmarkEncounter());
  assertCombatDefinition(encounter, runtime);
  const teams = new Set(encounter.combatants.map(actor => actor.team));
  if (teams.size !== 2 || !teams.has('party')) throw new Error('El simulador necesita el equipo "party" y exactamente un equipo rival');
  const health = encounter.rules?.healthResource ?? 'hp';
  encounter.rules = { ...encounter.rules, maxRounds: config.maxRounds, maxActions: Math.min(encounter.rules?.maxActions ?? 3000, 10000) };
  const clonedActions = new Map<string, string>();
  for (const actor of encounter.combatants) {
    if (actor.team === 'party') continue;
    const pool = actor.resources[health];
    pool.max = Math.max(1, pool.max * config.enemyHp);
    if (pool.current !== undefined) pool.current = Math.min(pool.max, Math.max(0, pool.current * config.enemyHp));
    if (config.enemyPower === 1) continue;
    actor.actions = actor.actions.map(actionId => {
      if (clonedActions.has(actionId)) return clonedActions.get(actionId)!;
      let cloneId = `simulation-enemy-${actionId}`;
      while (Object.hasOwn(encounter.actions, cloneId)) cloneId += '-copy';
      const action = structuredClone(encounter.actions[actionId]);
      action.effects = action.effects.map(effect => effect.kind === 'damage' ? { ...effect, amount: scaleAmount(effect.amount, config.enemyPower) } : effect);
      encounter.actions[cloneId] = action;
      clonedActions.set(actionId, cloneId);
      return cloneId;
    });
  }
  assertCombatDefinition(encounter, runtime);
  return encounter;
}

/** The heuristic inspects mechanical effects; it has no names, class IDs or lore knowledge. */
function scoreCommand(definition: CombatDefinition, state: CombatState, command: CombatCommand): number {
  if (command.actionId === '$wait') return -1e6;
  const actor = state.combatants.find(item => item.id === command.actorId)!;
  const action = definition.actions[command.actionId];
  const health = definition.rules?.healthResource ?? 'hp';
  const actorStats = effectiveStats(definition, actor);
  const scoreEffect = (effect: Effect, target: CombatantState, depth = 0): number => {
    const friendly = actor.team === target.team;
    const direction = friendly ? -1 : 1;
    const hp = target.resources[health];
    const targetStats = effectiveStats(definition, target);
    const amount = 'amount' in effect ? resolveAmount(effect.amount, actorStats, targetStats) : 0;
    const probability = effect.chance ?? 1;
    let score = 0;
    if (effect.kind === 'damage') {
      const tags = [...new Set(effect.tags ?? action.tags ?? [])];
      const affinities = { ...target.affinities };
      for (const status of target.statuses) for (const [tag, multiplier] of Object.entries(definition.statuses?.[status.id]?.affinities ?? {})) affinities[tag] = (affinities[tag] ?? 1) * multiplier ** status.stacks;
      const damage = resolveDamage(effect.amount, actorStats, targetStats, tags, affinities, definition.rules?.affinityPolicy);
      score = direction * (Math.min(hp.current, damage) + (damage >= hp.current && hp.current > 0 ? 28 : 0) + (hp.current > 0 ? (1 - hp.current / hp.max) * 9 : 0));
    } else if (effect.kind === 'heal') {
      const missing = hp.max - hp.current;
      score = (friendly ? 1 : -1) * Math.min(missing, Math.max(0, amount)) * (hp.current / hp.max < .4 ? 1.65 : hp.current / hp.max < .65 ? .95 : .32);
    } else if (effect.kind === 'revive') {
      score = hp.current === 0 ? (friendly ? 1 : -1) * (Math.min(hp.max, Math.max(0, amount)) + 40) : 0;
    } else if (effect.kind === 'resource') {
      const pool = target.resources[effect.resource];
      if (pool) score = (friendly ? 1 : -1) * Math.min(pool.max - pool.current, Math.max(0, amount)) * (pool.current < pool.max * .3 ? 1.1 : .2);
    } else if (effect.kind === 'status' && depth < 2) {
      const status = definition.statuses?.[effect.status];
      if (status) {
        const existing = target.statuses.find(item => item.id === effect.status);
        const alreadyActive = existing && (existing.remaining === undefined || existing.remaining > 1) && (status.stacking !== 'stack' || existing.stacks >= (status.maxStacks ?? 1));
        if (!alreadyActive) {
          const duration = Math.min(effect.duration ?? status.duration ?? 2, 3);
          if (status.preventsActions) score += direction * 20 * duration;
          for (const modifier of status.modifiers ?? []) {
            const change = (modifier.add ?? 0) + (target.stats[modifier.stat] ?? 0) * ((modifier.multiply ?? 1) - 1);
            score += (friendly ? 1 : -1) * change * duration * .8;
          }
          for (const tick of [...(status.onTurnStart ?? []), ...(status.onTurnEnd ?? [])]) score += scoreEffect(tick, target, depth + 1) * duration * .7;
        }
      }
    } else if (effect.kind === 'removeStatus') {
      const instance = target.statuses.find(item => item.id === effect.status);
      const status = definition.statuses?.[effect.status];
      if (instance && status) {
        const negative = !!status.preventsActions || (status.modifiers ?? []).some(modifier => (modifier.add ?? 0) < 0 || (modifier.multiply ?? 1) < 1) || [...(status.onTurnStart ?? []), ...(status.onTurnEnd ?? [])].some(item => item.kind === 'damage');
        score = (friendly === negative ? 1 : -1) * 15;
      }
    }
    return score * probability;
  };
  let score = 0;
  for (const effect of action.effects) {
    const targets = effect.target === 'self' ? [actor] : command.targetIds.map(id => state.combatants.find(item => item.id === id)!).filter(Boolean);
    for (const target of targets) score += scoreEffect(effect, target);
  }
  for (const [resource, cost] of Object.entries(action.costs ?? {})) {
    const pool = actor.resources[resource];
    score -= cost * (.35 + (pool && pool.current - cost < pool.max * .25 ? .6 : 0));
  }
  return score;
}

/** Selects only commands from the engine's legal list. Random policy has its own seeded stream. */
export function choosePolicyAction(definition: CombatDefinition, state: CombatState, policy: PolicyId, random: () => number = () => 0): CombatCommand | undefined {
  if (!POLICY_IDS.includes(policy)) throw new Error(`Política desconocida: ${policy}`);
  const legal = availableActions(definition, state);
  if (!legal.length) return undefined;
  if (policy === 'random') return legal[Math.min(legal.length - 1, Math.max(0, Math.floor(random() * legal.length)))];
  if (policy === 'basic') {
    return legal.find(command => {
      const action = definition.actions[command.actionId];
      return action && Object.values(action.costs ?? {}).every(cost => cost === 0) && action.effects.some(effect => effect.kind === 'damage');
    }) ?? legal.find(command => command.actionId === '$wait') ?? legal[0];
  }
  let best = legal[0];
  let score = -Infinity;
  for (const command of legal) {
    const candidate = scoreCommand(definition, state, command);
    if (candidate > score) { best = command; score = candidate; }
  }
  return best;
}

export function simulateRun(config: SimulationConfig, runSeed: number, encounter?: CombatDefinition, captureReplay = false, runtime?: CombatRuntime): RunRecord {
  normalizeConfig({ ...config, seed: runSeed });
  const definition = encounter ?? createSimulationEncounter(config, undefined, runtime);
  let state = createCombat(definition, runSeed, runtime);
  const health = definition.rules?.healthResource ?? 'hp';
  const partyIds = new Set(state.combatants.filter(actor => actor.team === 'party').map(actor => actor.id));
  const initialPartyHp = state.combatants.filter(actor => partyIds.has(actor.id)).reduce((sum, actor) => sum + actor.resources[health].max, 0);
  if (!initialPartyHp) throw new Error('El encuentro debe contener un equipo "party" con salud positiva');
  let policySeed = (runSeed ^ 0x9e3779b9) >>> 0;
  const random = () => { policySeed = (Math.imul(policySeed, 1664525) + 1013904223) >>> 0; return policySeed / 0x100000000; };
  const commands: CombatCommand[] = [];
  const events: CombatEvent[] = captureReplay ? [...state.events] : [];
  const resourceSpentById: NumericMap = {};
  let transitions = 0;
  while (state.status === 'active') {
    const actor = activeCombatant(state);
    if (!actor) throw new Error(`Motor sin actor activo; semilla ${runSeed}`);
    const command = choosePolicyAction(definition, state, actor.team === 'party' ? config.policy : config.enemyPolicy, random);
    if (!command) throw new Error(`Motor sin acción legal; semilla ${runSeed}`);
    const result = stepCombat(definition, state, command, runtime);
    if (!result.accepted) throw new Error(`La política produjo una acción inválida: ${result.reason}; semilla ${runSeed}`);
    if (captureReplay) { commands.push(structuredClone(command)); events.push(...result.events); }
    for (const event of result.events) {
      if (event.type === 'resource' && event.resource && event.resource !== health && (event.amount ?? 0) < 0 && partyIds.has(event.targetId ?? event.actorId ?? '')) {
        resourceSpentById[event.resource] = (resourceSpentById[event.resource] ?? 0) - event.amount!;
      }
    }
    state = result.state;
    if (++transitions > 10000) throw new Error(`El motor excedió el presupuesto de transiciones; semilla ${runSeed}`);
  }
  if (!state.outcome) throw new Error(`Motor finalizado sin resultado; semilla ${runSeed}`);
  const party = state.combatants.filter(actor => partyIds.has(actor.id));
  return {
    seed: runSeed, outcome: state.outcome.winner === 'party' ? 'win' : state.outcome.winner ? 'loss' : 'draw',
    ...(state.outcome.winner ? { winner: state.outcome.winner } : {}), reason: state.outcome.reason,
    rounds: Math.min(state.round, definition.rules?.maxRounds ?? config.maxRounds), actions: state.actionsTaken,
    partyHpRemaining: party.reduce((sum, actor) => sum + actor.resources[health].current, 0) / initialPartyHp,
    partyCasualties: party.filter(actor => actor.resources[health].current <= 0).length,
    resourceSpent: Object.values(resourceSpentById).reduce((a, b) => a + b, 0), resourceSpentById,
    ...(captureReplay ? { replay: { seed: runSeed, commands, events, finalState: state } } : {}),
  };
}

export function wilsonInterval(wins: number, total: number): [number, number] {
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(wins) || wins < 0 || wins > total) throw new Error('Wilson necesita recuentos enteros válidos y al menos un resultado');
  const z = 1.959963984540054;
  const p = wins / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function summarizeRuns(runs: RunRecord[]): SimulationSummary {
  if (!runs.length) throw new Error('Se necesita al menos un combate para calcular estadísticas');
  const n = runs.length;
  const wins = runs.filter(run => run.outcome === 'win').length;
  const losses = runs.filter(run => run.outcome === 'loss').length;
  const draws = runs.filter(run => run.outcome === 'draw').length;
  const drawReasons: Record<string, number> = {};
  const meanResourceSpentById: NumericMap = {};
  for (const run of runs) {
    if (run.outcome === 'draw') drawReasons[run.reason] = (drawReasons[run.reason] ?? 0) + 1;
    for (const [id, spent] of Object.entries(run.resourceSpentById)) meanResourceSpentById[id] = (meanResourceSpentById[id] ?? 0) + spent / n;
  }
  const mean = (key: 'rounds' | 'actions' | 'partyHpRemaining' | 'partyCasualties' | 'resourceSpent') => runs.reduce((sum, run) => sum + run[key], 0) / n;
  return {
    wins, losses, draws, winRate: wins / n, lossRate: losses / n, drawRate: draws / n, winRateCI: wilsonInterval(wins, n),
    meanRounds: mean('rounds'), meanActions: mean('actions'), meanPartyHpRemaining: mean('partyHpRemaining'), meanPartyCasualties: mean('partyCasualties'),
    meanResourceSpent: mean('resourceSpent'), meanResourceSpentById, drawReasons,
  };
}

/** May aggregate a nonempty partial batch after cancellation; config.runs retains requested size. */
export function buildSimulationReport(config: SimulationConfig, runs: RunRecord[], encounter?: CombatDefinition, runtime?: CombatRuntime): SimulationReport {
  normalizeConfig(config);
  if (!runs.length || runs.length > config.runs) throw new Error('El lote debe contener entre 1 y runs resultados');
  const definition = encounter ?? createSimulationEncounter(config, undefined, runtime);
  const sampleReplay = runs[0].replay ?? simulateRun(config, runs[0].seed, definition, true, runtime).replay!;
  return {
    version: SIMULATION_VERSION, engineSchemaVersion: 1, config: { ...config }, encounter: structuredClone(definition),
    seeds: runs.map(run => run.seed), runs: runs.map(({ replay: _replay, ...run }) => run),
    summary: summarizeRuns(runs), sampleReplay, runtimeEffects: Object.keys(runtime?.effects ?? {}).sort(),
  };
}

export function runSimulation(input: Partial<SimulationConfig> = {}, baseline?: CombatDefinition, runtime?: CombatRuntime): SimulationReport {
  const config = normalizeConfig(input);
  const encounter = createSimulationEncounter(config, baseline, runtime);
  const runs = createRunSeeds(config.seed, config.runs).map((seed, index) => simulateRun(config, seed, encounter, index === 0, runtime));
  return buildSimulationReport(config, runs, encounter, runtime);
}

export function comparePolicies(input: Partial<SimulationConfig> = {}, baseline?: CombatDefinition, runtime?: CombatRuntime): ComparisonReport {
  const config = normalizeConfig(input);
  return {
    version: SIMULATION_VERSION, seed: config.seed, seeds: createRunSeeds(config.seed, config.runs),
    reports: POLICY_IDS.map(policy => runSimulation({ ...config, policy }, baseline, runtime)),
  };
}
