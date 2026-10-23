import type { CombatDefinition, CombatRuntime, Effect } from './types.ts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const safeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value !== 'prototype' && !Object.hasOwn(Object.prototype, value);
const own = (object: Record<string, unknown>, key: string) => Object.hasOwn(object, key);
const positiveInt = (value: unknown) => finite(value) && Number.isSafeInteger(value) && value > 0;
const optional = (value: unknown, predicate: (value: unknown) => boolean) => value === undefined || predicate(value);
const stringList = (value: unknown) => Array.isArray(value) && value.every(safeId) && new Set(value).size === value.length;

/** Returns all useful authoring errors together; rejects non-finite numbers and broken references. */
export function validateCombatDefinition(input: unknown, runtime?: CombatRuntime): string[] {
  const errors: string[] = [];
  if (!record(input)) return ['definition must be an object'];
  if (!safeId(input.id)) errors.push('id must be a nonempty, safe string');
  if (!optional(input.name, value => typeof value === 'string')) errors.push('name must be a string');
  const actions = record(input.actions) ? input.actions : {};
  const statuses = record(input.statuses) ? input.statuses : {};
  if (!record(input.actions)) errors.push('actions must be an object');
  if (input.statuses !== undefined && !record(input.statuses)) errors.push('statuses must be an object');
  const rules = record(input.rules) ? input.rules : {};
  if (input.rules !== undefined && !record(input.rules)) errors.push('rules must be an object');
  for (const key of ['healthResource', 'speedStat']) if (!optional(rules[key], safeId)) errors.push(`rules.${key} must be a nonempty string`);
  const health = typeof rules.healthResource === 'string' ? rules.healthResource : 'hp';
  if (!optional(rules.affinityPolicy, value => ['product', 'geometric-mean', 'lowest', 'highest'].includes(String(value)))) errors.push('rules.affinityPolicy is unknown');
  for (const key of ['maxRounds', 'maxActions', 'maxReactionDepth', 'maxEffectsPerAction']) {
    if (!optional(rules[key], positiveInt)) errors.push(`rules.${key} must be a positive safe integer`);
  }
  const map = (value: unknown, path: string, minimum?: number) => {
    if (!record(value)) { errors.push(`${path} must be an object`); return; }
    for (const [key, item] of Object.entries(value)) if (!safeId(key) || !finite(item) || (minimum !== undefined && item < minimum)) errors.push(`${path}.${key} must be a finite number${minimum !== undefined ? ` >= ${minimum}` : ''}`);
  };
  const resourcesAvailable = new Set(Array.isArray(input.combatants) ? input.combatants.flatMap(item => record(item) && record(item.resources) ? Object.keys(item.resources) : []) : []);
  const checkEffects = (effects: unknown, path: string) => errors.push(...validateEffects(effects, actions, statuses, runtime, path, resourcesAvailable));
  for (const [id, item] of Object.entries(actions)) {
    const path = `actions.${id}`;
    if (!safeId(id) || id.startsWith('$')) errors.push(`${path}: reserved or invalid action id`);
    if (!record(item)) { errors.push(`${path} must be an object`); continue; }
    if (!optional(item.name, value => typeof value === 'string')) errors.push(`${path}.name must be a string`);
    if (!['enemy', 'ally', 'self', 'any', 'all-enemies', 'all-allies'].includes(String(item.target))) errors.push(`${path}.target is unknown`);
    if (!optional(item.targetLife, value => ['alive', 'dead', 'any'].includes(String(value)))) errors.push(`${path}.targetLife is unknown`);
    if (!optional(item.cooldown, value => finite(value) && Number.isSafeInteger(value) && value >= 0)) errors.push(`${path}.cooldown must be a nonnegative integer`);
    if (item.costs !== undefined) map(item.costs, `${path}.costs`, 0);
    if (!optional(item.tags, stringList)) errors.push(`${path}.tags must be unique nonempty strings`);
    checkEffects(item.effects, `${path}.effects`);
  }
  for (const [id, item] of Object.entries(statuses)) {
    const path = `statuses.${id}`;
    if (!safeId(id)) errors.push(`${path}: invalid status id`);
    if (!record(item)) { errors.push(`${path} must be an object`); continue; }
    if (!optional(item.name, value => typeof value === 'string')) errors.push(`${path}.name must be a string`);
    for (const key of ['duration', 'maxStacks']) if (!optional(item[key], positiveInt)) errors.push(`${path}.${key} must be a positive integer`);
    if (!optional(item.stacking, value => ['refresh', 'stack', 'replace'].includes(String(value)))) errors.push(`${path}.stacking is unknown`);
    if (!optional(item.preventsActions, value => typeof value === 'boolean')) errors.push(`${path}.preventsActions must be boolean`);
    if (item.affinities !== undefined) map(item.affinities, `${path}.affinities`, 0);
    if (item.modifiers !== undefined) {
      if (!Array.isArray(item.modifiers)) errors.push(`${path}.modifiers must be an array`);
      else item.modifiers.forEach((modifier, i) => {
        if (!record(modifier) || !safeId(modifier.stat) || !optional(modifier.add, finite) || !optional(modifier.multiply, value => finite(value) && value >= 0)) errors.push(`${path}.modifiers[${i}] is invalid`);
      });
    }
    for (const key of ['onTurnStart', 'onTurnEnd']) if (item[key] !== undefined) checkEffects(item[key], `${path}.${key}`);
    if (item.reactions !== undefined) {
      if (!Array.isArray(item.reactions)) errors.push(`${path}.reactions must be an array`);
      else item.reactions.forEach((reaction, i) => {
        const rp = `${path}.reactions[${i}]`;
        if (!record(reaction)) { errors.push(`${rp} must be an object`); return; }
        if (!['damaged', 'healed', 'defeated', 'action'].includes(String(reaction.on))) errors.push(`${rp}.on is unknown`);
        if (!optional(reaction.tags, stringList)) errors.push(`${rp}.tags must be unique strings`);
        checkEffects(reaction.effects, `${rp}.effects`);
      });
    }
  }
  if (!Array.isArray(input.combatants) || input.combatants.length < 2) errors.push('combatants must contain at least two fighters');
  else {
    const ids = new Set<string>();
    const teams = new Set<string>();
    input.combatants.forEach((item, i) => {
      const path = `combatants[${i}]`;
      if (!record(item)) { errors.push(`${path} must be an object`); return; }
      if (!optional(item.name, value => typeof value === 'string')) errors.push(`${path}.name must be a string`);
      if (!safeId(item.id) || ids.has(item.id)) errors.push(`${path}.id must be unique and nonempty`);
      else ids.add(item.id);
      if (!safeId(item.team)) errors.push(`${path}.team must be nonempty`); else teams.add(item.team);
      map(item.stats, `${path}.stats`);
      if (item.affinities !== undefined) map(item.affinities, `${path}.affinities`, 0);
      const resources = record(item.resources) ? item.resources : {};
      if (!record(item.resources)) errors.push(`${path}.resources must be an object`);
      if (!own(resources, health)) errors.push(`${path}.resources.${health} is required`);
      for (const [key, resource] of Object.entries(resources)) {
        if (!safeId(key) || !record(resource) || !finite(resource.max) || resource.max < 0 || !optional(resource.current, value => finite(value) && value >= 0 && value <= Number(resource.max))) errors.push(`${path}.resources.${key} requires finite 0 <= current <= max`);
      }
      const hp = resources[health];
      if (record(hp) && finite(hp.max) && hp.max <= 0) errors.push(`${path}.resources.${health}.max must be positive`);
      if (!stringList(item.actions)) errors.push(`${path}.actions must be a unique string array`);
      else for (const id of item.actions as string[]) {
        if (!own(actions, id)) errors.push(`${path}.actions: unknown action ${id}`);
        else {
          const action = actions[id];
          if (record(action) && record(action.costs)) for (const key of Object.keys(action.costs)) if (!own(resources, key)) errors.push(`${path}: action ${id} costs missing resource ${key}`);
        }
      }
      if (item.statuses !== undefined) {
        if (!Array.isArray(item.statuses)) errors.push(`${path}.statuses must be an array`);
        else {
          const seen = new Set<string>();
          item.statuses.forEach((status, j) => {
            const sp = `${path}.statuses[${j}]`;
            if (!record(status) || !safeId(status.id) || !own(statuses, status.id)) { errors.push(`${sp}: unknown status`); return; }
            if (seen.has(status.id)) errors.push(`${sp}: duplicate initial status ${status.id}`); seen.add(status.id);
            if (!optional(status.stacks, positiveInt) || !optional(status.duration, positiveInt)) errors.push(`${sp}: stacks and duration must be positive integers`);
            const max = record(statuses[status.id]) ? Number((statuses[status.id] as Record<string, unknown>).maxStacks ?? 1) : 1;
            if (finite(status.stacks) && status.stacks > max) errors.push(`${sp}.stacks exceeds maxStacks ${max}`);
          });
        }
      }
    });
    if (teams.size < 2) errors.push('combatants must belong to at least two teams');
  }
  return errors;
}

/** Also validates plugin output before it can alter a combat transition. */
export function validateEffects(effects: unknown, _actions: Record<string, unknown>, statuses: Record<string, unknown>, runtime?: CombatRuntime, path = 'effects', resourcesAvailable?: Set<string>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(effects)) return [`${path} must be an array`];
  effects.forEach((effect, index) => {
    const p = `${path}[${index}]`;
    if (!record(effect)) { errors.push(`${p} must be an object`); return; }
    if (!optional(effect.target, value => ['targets', 'self', 'source'].includes(String(value)))) errors.push(`${p}.target is unknown`);
    if (!optional(effect.chance, value => finite(value) && value >= 0 && value <= 1)) errors.push(`${p}.chance must be between 0 and 1`);
    if (['damage', 'heal', 'resource', 'revive'].includes(String(effect.kind))) {
      const amount = effect.amount;
      if (finite(amount)) { if (effect.kind !== 'resource' && amount < 0) errors.push(`${p}.amount must be nonnegative`); }
      else if (record(amount)) {
        if (!finite(amount.base)) errors.push(`${p}.amount.base must be finite`);
        for (const key of ['actorScale', 'targetScale', 'minimum']) if (!optional(amount[key], finite)) errors.push(`${p}.amount.${key} must be finite`);
        for (const key of ['actorStat', 'targetStat']) if (!optional(amount[key], safeId)) errors.push(`${p}.amount.${key} must be nonempty`);
        if (!optional(amount.variance, value => finite(value) && value >= 0 && value <= 1)) errors.push(`${p}.amount.variance must be between 0 and 1`);
      } else errors.push(`${p}.amount must be a finite number or formula`);
      if (effect.kind === 'resource') {
        if (!safeId(effect.resource)) errors.push(`${p}.resource must be nonempty and safe`);
        else if (resourcesAvailable && !resourcesAvailable.has(effect.resource)) errors.push(`${p}.resource references unknown resource ${effect.resource}`);
      }
      if (effect.kind === 'damage' && !optional(effect.tags, stringList)) errors.push(`${p}.tags must be unique strings`);
    } else if (effect.kind === 'status' || effect.kind === 'removeStatus') {
      if (!safeId(effect.status) || !own(statuses, effect.status)) errors.push(`${p}.status references unknown status ${String(effect.status)}`);
      if (!optional(effect.stacks, positiveInt) || !optional(effect.duration, positiveInt)) errors.push(`${p}.stacks and duration must be positive integers`);
    } else if (effect.kind === 'custom') {
      if (!safeId(effect.handler) || !runtime || !Object.hasOwn(runtime.effects, effect.handler) || typeof runtime.effects[effect.handler] !== 'function') errors.push(`${p}.handler is not registered: ${String(effect.handler)}`);
      if (effect.params !== undefined && !isJsonObject(effect.params)) errors.push(`${p}.params must be a finite JSON object`);
    } else errors.push(`${p}.kind is unknown: ${String(effect.kind)}`);
  });
  return errors;
}
function isJsonObject(value: unknown): boolean {
  try {
    const check = (item: unknown, depth: number): boolean => depth <= 30 && (item === null || typeof item === 'string' || typeof item === 'boolean' || finite(item) || (Array.isArray(item) ? item.every(v => check(v, depth + 1)) : record(item) && Object.entries(item).every(([key, v]) => safeId(key) && check(v, depth + 1))));
    return record(value) && check(value, 0);
  } catch { return false; }
}
export function assertCombatDefinition(input: unknown, runtime?: CombatRuntime): asserts input is CombatDefinition {
  const errors = validateCombatDefinition(input, runtime);
  if (errors.length) throw new Error(`Invalid combat definition:\n${errors.map(error => `- ${error}`).join('\n')}`);
}
export function assertEffects(effects: unknown, definition: CombatDefinition, runtime?: CombatRuntime): asserts effects is Effect[] {
  const errors = validateEffects(effects, definition.actions, definition.statuses ?? {}, runtime, 'effects', new Set(definition.combatants.flatMap(combatant => Object.keys(combatant.resources))));
  if (errors.length) throw new Error(`Invalid custom effects: ${errors.join('; ')}`);
}
