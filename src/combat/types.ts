/** Plain, JSON-serializable combat content. Names/tags carry no built-in lore or taxonomy. */
export type NumericMap = Record<string, number>;
export interface ResourceDefinition { max: number; current?: number }
export interface ResourceState { max: number; current: number }
export interface AmountFormula {
  base: number;
  actorStat?: string;
  actorScale?: number;
  targetStat?: string;
  targetScale?: number;
  minimum?: number;
  /** Symmetric proportional spread, 0..1; uses the combat RNG. */
  variance?: number;
}
export type Amount = number | AmountFormula;
export type AffinityPolicy = 'product' | 'geometric-mean' | 'lowest' | 'highest';
export interface EffectBase { target?: 'targets' | 'self' | 'source'; chance?: number }
export type Effect = EffectBase & (
  | { kind: 'damage'; amount: Amount; tags?: string[] }
  | { kind: 'heal'; amount: Amount }
  | { kind: 'resource'; resource: string; amount: Amount }
  | { kind: 'status'; status: string; stacks?: number; duration?: number }
  | { kind: 'removeStatus'; status: string; stacks?: number }
  | { kind: 'revive'; amount: Amount }
  | { kind: 'custom'; handler: string; params?: JsonObject }
);
export type TargetRule = 'enemy' | 'ally' | 'self' | 'any' | 'all-enemies' | 'all-allies';
export interface ActionDefinition {
  name?: string;
  target: TargetRule;
  targetLife?: 'alive' | 'dead' | 'any';
  costs?: NumericMap;
  /** Number of subsequent owner turns on which this action is unavailable. */
  cooldown?: number;
  tags?: string[];
  effects: Effect[];
}
export interface StatModifier { stat: string; add?: number; multiply?: number }
export interface ReactionDefinition {
  on: 'damaged' | 'healed' | 'defeated' | 'action';
  /** At least one matching tag must be on the triggering action/effect. */
  tags?: string[];
  effects: Effect[];
}
export interface StatusDefinition {
  name?: string;
  /** Owner turn ends. Omit for permanent passives. Newly applied statuses skip that action's turn end. */
  duration?: number;
  maxStacks?: number;
  stacking?: 'refresh' | 'stack' | 'replace';
  modifiers?: StatModifier[];
  affinities?: NumericMap;
  preventsActions?: boolean;
  onTurnStart?: Effect[];
  onTurnEnd?: Effect[];
  reactions?: ReactionDefinition[];
}
export interface InitialStatus { id: string; stacks?: number; duration?: number }
export interface CombatantDefinition {
  id: string;
  name?: string;
  team: string;
  stats: NumericMap;
  resources: Record<string, ResourceDefinition>;
  actions: string[];
  affinities?: NumericMap;
  statuses?: InitialStatus[];
}
export interface CombatRules {
  healthResource?: string;
  speedStat?: string;
  affinityPolicy?: AffinityPolicy;
  maxRounds?: number;
  maxActions?: number;
  maxReactionDepth?: number;
  maxEffectsPerAction?: number;
}
export interface CombatDefinition {
  id: string;
  name?: string;
  combatants: CombatantDefinition[];
  actions: Record<string, ActionDefinition>;
  statuses?: Record<string, StatusDefinition>;
  rules?: CombatRules;
}
export interface StatusInstance {
  id: string;
  sourceId: string;
  stacks: number;
  remaining?: number;
  appliedAtAction: number;
}
export interface CombatantState {
  id: string;
  name: string;
  team: string;
  stats: NumericMap;
  resources: Record<string, ResourceState>;
  actions: string[];
  affinities: NumericMap;
  statuses: StatusInstance[];
  cooldowns: NumericMap;
  turnsTaken: number;
}
export interface CombatOutcome {
  winner?: string;
  reason: 'victory' | 'mutual-defeat' | 'round-limit' | 'action-limit' | 'effect-limit';
}
export interface CombatEvent {
  type: 'action' | 'wait' | 'damage' | 'heal' | 'resource' | 'status' | 'status-removed' | 'defeated' | 'revive' | 'miss' | 'reaction' | 'turn' | 'finished';
  actorId?: string;
  targetId?: string;
  actionId?: string;
  statusId?: string;
  amount?: number;
  resource?: string;
  round: number;
  detail?: string;
}
export interface CombatState {
  schemaVersion: 1;
  definitionId: string;
  combatants: CombatantState[];
  round: number;
  turnIndex: number;
  order: string[];
  actionsTaken: number;
  rng: number;
  status: 'active' | 'finished';
  outcome?: CombatOutcome;
  /** Most recent transition only. Store transitions separately when retaining a full replay. */
  events: CombatEvent[];
}
export interface CombatCommand { actorId: string; actionId: string; targetIds: string[] }
export interface CombatTransition { state: CombatState; events: CombatEvent[]; accepted: boolean; reason?: string }

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
/** Snapshots are deeply frozen at runtime. The seeded RNG is the only engine-provided entropy. */
export interface CustomEffectContext {
  readonly actor: Readonly<CombatantState>;
  readonly targets: readonly Readonly<CombatantState>[];
  readonly state: Readonly<CombatState>;
  readonly sourceId?: string;
  readonly random: () => number;
}
export interface CombatRuntime {
  effects: Record<string, (context: CustomEffectContext, params: JsonObject) => Effect[]>;
}
