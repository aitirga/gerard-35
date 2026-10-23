import type {
  ActionDefinition, AffinityPolicy, Amount, CombatCommand, CombatDefinition, CombatEvent, CombatRuntime,
  CombatState, CombatTransition, CombatantState, Effect, NumericMap, ResourceState,
} from './types.ts';
import { assertCombatDefinition, assertEffects } from './validation.ts';

export * from './types.ts';
export { validateCombatDefinition } from './validation.ts';

/** Pure formula shared by campaign adapters, simulator and authored effects. Missing stats are zero. */
export function resolveAmount(amount: Amount, actorStats: NumericMap = {}, targetStats: NumericMap = {}, random = .5): number {
  if (typeof amount === 'number') return Math.max(0, Math.round(amount));
  const value = amount.base
    + (amount.actorStat ? (actorStats[amount.actorStat] ?? 0) * (amount.actorScale ?? 1) : 0)
    + (amount.targetStat ? (targetStats[amount.targetStat] ?? 0) * (amount.targetScale ?? -1) : 0);
  return Math.max(0, Math.round(Math.max(amount.minimum ?? 0, value) * (1 + (2 * random - 1) * (amount.variance ?? 0))));
}
/** Duplicate tags count once. Untyped damage is neutral; any zero affinity is a true immunity. */
export function affinityMultiplier(tags: string[], affinities: NumericMap, policy: AffinityPolicy = 'geometric-mean'): number {
  const values = [...new Set(tags)].map(tag => affinities[tag] ?? 1);
  if (!values.length) return 1;
  if (values.includes(0)) return 0;
  if (policy === 'lowest') return Math.min(...values);
  if (policy === 'highest') return Math.max(...values);
  if (policy === 'geometric-mean') return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
  return values.reduce((total, value) => total * value, 1);
}
export function resolveDamage(amount: Amount, actorStats: NumericMap = {}, targetStats: NumericMap = {}, tags: string[] = [], affinities: NumericMap = {}, policy: AffinityPolicy = 'geometric-mean', random = .5): number {
  return Math.max(0, Math.round(resolveAmount(amount, actorStats, targetStats, random) * affinityMultiplier(tags, affinities, policy)));
}
/** Returns a fresh resource and the actual signed delta, after bounds/dead-target rules. */
export function adjustResource(resource: ResourceState, delta: number, allowRevive = true): { resource: ResourceState; amount: number } {
  if (!Number.isFinite(delta)) throw new Error('Resource adjustment must be finite');
  const current = !allowRevive && resource.current <= 0 && delta > 0 ? resource.current : Math.max(0, Math.min(resource.max, resource.current + delta));
  return { resource: { ...resource, current }, amount: current - resource.current };
}
export function effectiveStats(definition: CombatDefinition, combatant: CombatantState): NumericMap {
  const result = { ...combatant.stats };
  const multipliers: NumericMap = {};
  for (const instance of combatant.statuses) for (const modifier of definition.statuses?.[instance.id]?.modifiers ?? []) {
    result[modifier.stat] = (result[modifier.stat] ?? 0) + (modifier.add ?? 0) * instance.stacks;
    multipliers[modifier.stat] = (multipliers[modifier.stat] ?? 1) * (modifier.multiply ?? 1) ** instance.stacks;
  }
  for (const [key, multiplier] of Object.entries(multipliers)) result[key] = (result[key] ?? 0) * multiplier;
  if (Object.values(result).some(value => !Number.isFinite(value))) throw new Error('Stat modifiers overflowed finite numeric bounds');
  return result;
}
const healthKey = (definition: CombatDefinition) => definition.rules?.healthResource ?? 'hp';
const alive = (definition: CombatDefinition, combatant: CombatantState) => combatant.resources[healthKey(definition)].current > 0;
const find = (state: CombatState, id: string) => state.combatants.find(combatant => combatant.id === id);
export function activeCombatant(state: CombatState): CombatantState | undefined {
  return state.status === 'active' ? find(state, state.order[state.turnIndex]) : undefined;
}
function order(definition: CombatDefinition, state: CombatState): string[] {
  const speed = definition.rules?.speedStat ?? 'speed';
  return state.combatants.filter(c => alive(definition, c)).map((combatant, index) => ({ combatant, index, speed: effectiveStats(definition, combatant)[speed] ?? 0 }))
    .sort((a, b) => b.speed - a.speed || a.index - b.index).map(({ combatant }) => combatant.id);
}
function eligible(definition: CombatDefinition, state: CombatState, actor: CombatantState, action: ActionDefinition): CombatantState[] {
  const life = action.targetLife ?? 'alive';
  return state.combatants.filter(target => {
    const living = alive(definition, target);
    if ((life === 'alive' && !living) || (life === 'dead' && living)) return false;
    if (action.target === 'self') return target.id === actor.id;
    if (action.target === 'ally' || action.target === 'all-allies') return target.team === actor.team;
    if (action.target === 'enemy' || action.target === 'all-enemies') return target.team !== actor.team;
    return true;
  });
}
function canUse(definition: CombatDefinition, actor: CombatantState, actionId: string): boolean {
  const action = definition.actions[actionId];
  return !!action && !actor.statuses.some(status => definition.statuses?.[status.id]?.preventsActions)
    && (actor.cooldowns[actionId] ?? 0) === 0
    && Object.entries(action.costs ?? {}).every(([key, value]) => actor.resources[key]?.current >= value
      && (key !== healthKey(definition) || value === 0 || actor.resources[key].current > value));
}
/** Every returned command is legal at this state; no RNG is consumed while listing choices. */
export function availableActions(definition: CombatDefinition, state: CombatState, actorId?: string): CombatCommand[] {
  const actor = activeCombatant(state);
  if (state.definitionId !== definition.id || !actor || !alive(definition, actor) || (actorId && actor.id !== actorId)) return [];
  const choices: CombatCommand[] = [];
  for (const actionId of actor.actions) {
    if (!canUse(definition, actor, actionId)) continue;
    const action = definition.actions[actionId];
    const targets = eligible(definition, state, actor, action);
    if (action.target.startsWith('all-')) {
      if (targets.length) choices.push({ actorId: actor.id, actionId, targetIds: targets.map(target => target.id) });
    } else for (const target of targets) choices.push({ actorId: actor.id, actionId, targetIds: [target.id] });
  }
  choices.push({ actorId: actor.id, actionId: '$wait', targetIds: [] });
  return choices;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

/** A transition-local executor owns all mutable data. Public inputs are never changed. */
class Executor {
  readonly events: CombatEvent[] = [];
  private effectsUsed = 0;
  readonly definition: CombatDefinition;
  readonly state: CombatState;
  readonly runtime?: CombatRuntime;
  constructor(definition: CombatDefinition, state: CombatState, runtime?: CombatRuntime) {
    this.definition = definition; this.state = state; this.runtime = runtime;
  }
  emit(event: Omit<CombatEvent, 'round'>) { this.events.push({ ...event, round: this.state.round }); }
  random() {
    this.state.rng = (Math.imul(this.state.rng, 1664525) + 1013904223) >>> 0;
    return this.state.rng / 2 ** 32;
  }
  finish(reason: NonNullable<CombatState['outcome']>['reason'], winner?: string) {
    if (this.state.status === 'finished') return;
    this.state.status = 'finished'; this.state.outcome = winner === undefined ? { reason } : { reason, winner };
    this.emit({ type: 'finished', detail: winner ? `${reason}:${winner}` : reason });
  }
  outcome(): boolean {
    if (this.state.status === 'finished') return true;
    const teams = [...new Set(this.state.combatants.filter(c => alive(this.definition, c)).map(c => c.team))];
    if (!teams.length) this.finish('mutual-defeat');
    else if (teams.length === 1) this.finish('victory', teams[0]);
    return teams.length <= 1;
  }
  budget(depth: number): boolean {
    if (this.state.status === 'finished') return false;
    if (++this.effectsUsed > (this.definition.rules?.maxEffectsPerAction ?? 512) || depth > (this.definition.rules?.maxReactionDepth ?? 16)) {
      this.finish('effect-limit'); return false;
    }
    return true;
  }
  affinities(target: CombatantState): NumericMap {
    const result = { ...target.affinities };
    for (const instance of target.statuses) for (const [tag, value] of Object.entries(this.definition.statuses?.[instance.id]?.affinities ?? {})) result[tag] = (result[tag] ?? 1) * value ** instance.stacks;
    return result;
  }
  react(on: 'damaged' | 'healed' | 'defeated' | 'action', owner: CombatantState, source: CombatantState, tags: string[], path: Set<string>, depth: number) {
    for (const instance of [...owner.statuses]) {
      if (!owner.statuses.includes(instance)) continue;
      const reactions = this.definition.statuses?.[instance.id]?.reactions ?? [];
      for (let index = 0; index < reactions.length; index++) {
        if (!owner.statuses.includes(instance)) break;
        const reaction = reactions[index];
        const key = `${owner.id}:${instance.id}:${index}`;
        if (reaction.on !== on || path.has(key) || (reaction.tags?.length && !reaction.tags.some(tag => tags.includes(tag)))) continue;
        if (!alive(this.definition, owner) && on !== 'defeated') continue;
        if (!this.budget(depth + 1)) return;
        this.emit({ type: 'reaction', actorId: owner.id, targetId: source.id, statusId: instance.id, detail: on });
        const nextPath = new Set(path); nextPath.add(key);
        this.effects(reaction.effects, owner, [source], source.id, tags, nextPath, depth + 1, instance.stacks);
      }
    }
  }
  effects(effects: Effect[], actor: CombatantState, targets: CombatantState[], sourceId?: string, actionTags: string[] = [], path = new Set<string>(), depth = 0, stacks = 1) {
    for (const effect of effects) {
      const selected = effect.target === 'self' ? [actor] : effect.target === 'source' ? (sourceId && find(this.state, sourceId) ? [find(this.state, sourceId)!] : []) : targets;
      if (effect.kind === 'custom') {
        if (!this.budget(depth)) return;
        if (effect.chance !== undefined && effect.chance < 1 && this.random() >= effect.chance) continue;
        const handler = this.runtime?.effects[effect.handler];
        if (!handler) throw new Error(`Unregistered custom effect ${effect.handler}`);
        const generated = handler({ actor: freeze(structuredClone(actor)), targets: freeze(structuredClone(selected)), state: freeze(structuredClone(this.state)), sourceId, random: () => this.random() }, freeze(structuredClone(effect.params ?? {})));
        assertEffects(generated, this.definition, this.runtime);
        this.effects(generated, actor, selected, sourceId, actionTags, path, depth + 1, stacks);
        continue;
      }
      for (const target of selected) {
        if (!this.budget(depth)) return;
        if (effect.chance !== undefined && effect.chance < 1 && this.random() >= effect.chance) { this.emit({ type: 'miss', actorId: actor.id, targetId: target.id }); continue; }
        const hpKey = healthKey(this.definition);
        const wasAlive = alive(this.definition, target);
        if (effect.kind !== 'revive' && !wasAlive && effect.kind !== 'removeStatus') continue;
        if (effect.kind === 'status') {
          const config = this.definition.statuses![effect.status];
          const previous = target.statuses.find(status => status.id === effect.status);
          const count = Math.min(config.maxStacks ?? 1, effect.stacks ?? 1);
          const duration = effect.duration ?? config.duration;
          if (previous) {
            previous.stacks = config.stacking === 'stack' ? Math.min(config.maxStacks ?? 1, previous.stacks + count) : config.stacking === 'replace' ? count : Math.max(previous.stacks, count);
            previous.remaining = duration; previous.sourceId = actor.id; previous.appliedAtAction = this.state.actionsTaken;
          } else target.statuses.push({ id: effect.status, sourceId: actor.id, stacks: count, remaining: duration, appliedAtAction: this.state.actionsTaken });
          this.emit({ type: 'status', actorId: actor.id, targetId: target.id, statusId: effect.status, amount: target.statuses.find(status => status.id === effect.status)!.stacks });
          continue;
        }
        if (effect.kind === 'removeStatus') {
          const previous = target.statuses.find(status => status.id === effect.status);
          if (previous) {
            previous.stacks -= effect.stacks ?? previous.stacks;
            if (previous.stacks <= 0) target.statuses = target.statuses.filter(status => status !== previous);
            this.emit({ type: 'status-removed', actorId: actor.id, targetId: target.id, statusId: effect.status });
          }
          continue;
        }
        if (effect.kind === 'revive' && wasAlive) continue;
        const amount = effect.amount;
        const roll = typeof amount !== 'number' && amount.variance ? this.random() : .5;
        const actorStats = effectiveStats(this.definition, actor), targetStats = effectiveStats(this.definition, target);
        const tags = effect.kind === 'damage' ? effect.tags ?? actionTags : actionTags;
        let value = effect.kind === 'damage'
          ? resolveDamage(amount, actorStats, targetStats, tags, this.affinities(target), this.definition.rules?.affinityPolicy, roll)
          : resolveAmount(amount, actorStats, targetStats, roll);
        if (effect.kind === 'resource') {
          if (typeof amount === 'number') value = Math.round(amount);
          else {
            const raw = amount.base + (amount.actorStat ? (actorStats[amount.actorStat] ?? 0) * (amount.actorScale ?? 1) : 0)
              + (amount.targetStat ? (targetStats[amount.targetStat] ?? 0) * (amount.targetScale ?? -1) : 0);
            value = Math.round(Math.max(amount.minimum ?? -Infinity, raw) * (1 + (2 * roll - 1) * (amount.variance ?? 0)));
          }
        }
        value *= stacks;
        const resourceKey = effect.kind === 'resource' ? effect.resource : hpKey;
        const resource = target.resources[resourceKey];
        // Mixed class parties may have different pools. A known pool absent on this
        // target is inapplicable; global definition validation still rejects typos.
        if (!resource) continue;
        const adjusted = adjustResource(resource, effect.kind === 'damage' ? -value : value, effect.kind === 'revive' || resourceKey !== hpKey);
        target.resources[resourceKey] = adjusted.resource;
        const kind = effect.kind === 'resource' ? 'resource' : effect.kind;
        this.emit({ type: kind, actorId: actor.id, targetId: target.id, amount: effect.kind === 'damage' ? Math.abs(adjusted.amount) : adjusted.amount, resource: resourceKey });
        const defeatedByThisEffect = wasAlive && !alive(this.definition, target);
        if (effect.kind === 'damage' && adjusted.amount < 0 && !defeatedByThisEffect) this.react('damaged', target, actor, tags, path, depth);
        if (effect.kind === 'heal' && adjusted.amount > 0) this.react('healed', target, actor, tags, path, depth);
        if (defeatedByThisEffect) {
          this.emit({ type: 'defeated', actorId: actor.id, targetId: target.id });
          this.react('defeated', target, actor, tags, path, depth);
        }
      }
    }
  }
  tick(actor: CombatantState, timing: 'onTurnStart' | 'onTurnEnd') {
    for (const instance of [...actor.statuses]) {
      if (!alive(this.definition, actor) || this.state.status === 'finished') break;
      if (!actor.statuses.includes(instance)) continue;
      if (timing === 'onTurnEnd' && instance.appliedAtAction === this.state.actionsTaken) continue;
      const effects = this.definition.statuses?.[instance.id]?.[timing] ?? [];
      const source = find(this.state, instance.sourceId) ?? actor;
      this.effects(effects, source, [actor], source.id, [], new Set(), 0, instance.stacks);
    }
  }
  endTurn(actor: CombatantState) {
    this.tick(actor, 'onTurnEnd');
    actor.turnsTaken++;
    for (const key of Object.keys(actor.cooldowns)) actor.cooldowns[key] = Math.max(0, actor.cooldowns[key] - 1);
    for (const instance of [...actor.statuses]) {
      if (instance.remaining === undefined || instance.appliedAtAction === this.state.actionsTaken) continue;
      instance.remaining--;
      if (instance.remaining <= 0) {
        actor.statuses = actor.statuses.filter(status => status !== instance);
        this.emit({ type: 'status-removed', targetId: actor.id, statusId: instance.id, detail: 'expired' });
      }
    }
  }
  advance() {
    this.state.turnIndex++;
    this.startTurn();
  }
  startTurn() {
    while (!this.outcome()) {
      if (this.state.turnIndex >= this.state.order.length) {
        if (this.state.round >= (this.definition.rules?.maxRounds ?? 100)) { this.finish('round-limit'); return; }
        this.state.round++; this.state.order = order(this.definition, this.state); this.state.turnIndex = 0;
      }
      const actor = activeCombatant(this.state);
      if (!actor || !alive(this.definition, actor)) { this.state.turnIndex++; continue; }
      this.emit({ type: 'turn', actorId: actor.id });
      this.tick(actor, 'onTurnStart');
      if (this.outcome()) return;
      if (alive(this.definition, actor)) return;
      this.state.turnIndex++;
    }
  }
}

export function createCombat(definition: CombatDefinition, seed = 1, runtime?: CombatRuntime): CombatState {
  assertCombatDefinition(definition, runtime);
  if (!Number.isSafeInteger(seed)) throw new Error('Combat seed must be a safe integer');
  const state: CombatState = {
    schemaVersion: 1, definitionId: definition.id, round: 1, turnIndex: 0, actionsTaken: 0, order: [], rng: seed >>> 0, status: 'active', events: [],
    combatants: definition.combatants.map(combatant => ({
      id: combatant.id, name: combatant.name ?? combatant.id, team: combatant.team,
      stats: { ...combatant.stats }, resources: Object.fromEntries(Object.entries(combatant.resources).map(([key, resource]) => [key, { max: resource.max, current: resource.current ?? resource.max }])),
      actions: [...combatant.actions], affinities: { ...combatant.affinities }, cooldowns: {}, turnsTaken: 0,
      statuses: (combatant.statuses ?? []).map(status => ({ id: status.id, sourceId: combatant.id, stacks: status.stacks ?? 1, remaining: status.duration ?? definition.statuses![status.id].duration, appliedAtAction: -1 })),
    })),
  };
  state.order = order(definition, state);
  const executor = new Executor(definition, state, runtime); executor.startTurn(); state.events = executor.events;
  return state;
}
/** All validation precedes clone/cost/RNG; a plugin exception rejects the whole transition. */
export function stepCombat(definition: CombatDefinition, state: CombatState, command: CombatCommand, runtime?: CombatRuntime): CombatTransition {
  const reject = (reason: string): CombatTransition => ({ state, accepted: false, reason, events: [] });
  if (state.definitionId !== definition.id || state.schemaVersion !== 1) return reject('Definition or schema mismatch');
  if (state.status !== 'active') return reject('Combat is finished');
  if (!command || !Array.isArray(command.targetIds) || new Set(command.targetIds).size !== command.targetIds.length) return reject('Invalid or duplicate targets');
  const legal = availableActions(definition, state).find(candidate => candidate.actorId === command.actorId && candidate.actionId === command.actionId && candidate.targetIds.length === command.targetIds.length && candidate.targetIds.every(id => command.targetIds.includes(id)));
  if (!legal) return reject('Actor, action, targets, resources or cooldown are invalid');
  const next = structuredClone(state); next.events = []; next.actionsTaken++;
  const executor = new Executor(definition, next, runtime);
  const actor = activeCombatant(next)!;
  try {
    if (command.actionId === '$wait') executor.emit({ type: 'wait', actorId: actor.id });
    else {
      const action = definition.actions[command.actionId];
      for (const [key, cost] of Object.entries(action.costs ?? {})) {
        const adjusted = adjustResource(actor.resources[key], -cost); actor.resources[key] = adjusted.resource;
        if (cost) executor.emit({ type: 'resource', actorId: actor.id, targetId: actor.id, actionId: command.actionId, resource: key, amount: adjusted.amount });
      }
      if (action.cooldown) actor.cooldowns[command.actionId] = action.cooldown + 1;
      executor.emit({ type: 'action', actorId: actor.id, actionId: command.actionId });
      executor.effects(action.effects, actor, legal.targetIds.map(id => find(next, id)!), actor.id, action.tags);
      executor.react('action', actor, actor, action.tags ?? [], new Set(), 0);
    }
    executor.endTurn(actor);
    if (!executor.outcome()) {
      if (next.actionsTaken >= (definition.rules?.maxActions ?? 1000)) executor.finish('action-limit');
      else executor.advance();
    }
    next.events = executor.events;
    return { state: next, accepted: true, events: executor.events };
  } catch (error) { return reject(error instanceof Error ? error.message : 'Combat effect failed'); }
}
