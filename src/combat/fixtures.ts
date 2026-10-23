import type { CombatDefinition } from './types.ts';

/**
 * Synthetic mechanics bench, deliberately independent from the campaign and its lore.
 * Role names, numbers and tags are disposable test data, not proposed classes or types.
 */
export function createBenchmarkEncounter(): CombatDefinition {
  return {
    id: 'mechanics-bench-v1',
    name: 'Banco mecánico provisional · 3 contra 3',
    rules: { maxRounds: 80, maxActions: 3000, affinityPolicy: 'geometric-mean' },
    actions: {
      strike: {
        name: 'Golpe de prueba', target: 'enemy', tags: ['contact'],
        effects: [{ kind: 'damage', tags: ['contact'], amount: { base: 10, actorStat: 'power', actorScale: 1, targetStat: 'armor', targetScale: -1, minimum: 2, variance: .18 } }],
      },
      burst: {
        name: 'Esfuerzo concentrado', target: 'enemy', costs: { effort: 8 }, cooldown: 1,
        effects: [{ kind: 'damage', tags: ['technique'], amount: { base: 22, actorStat: 'power', actorScale: 1.2, targetStat: 'armor', targetScale: -1, minimum: 3, variance: .15 } }],
      },
      mend: {
        name: 'Recuperación de prueba', target: 'ally', costs: { effort: 7 },
        effects: [{ kind: 'heal', amount: { base: 22, actorStat: 'support', actorScale: 1, variance: .1 } }],
      },
      brace: {
        name: 'Protección de prueba', target: 'self',
        effects: [{ kind: 'status', status: 'protected' }],
      },
      pressure: {
        name: 'Abrir una oportunidad', target: 'enemy', costs: { effort: 5 }, cooldown: 1,
        effects: [
          { kind: 'damage', amount: { base: 6, actorStat: 'power', actorScale: .4, minimum: 1, variance: .1 } },
          { kind: 'status', status: 'exposed' },
        ],
      },
      interrupt: {
        name: 'Interrupción de prueba', target: 'enemy', costs: { effort: 9 }, cooldown: 3,
        effects: [{ kind: 'status', status: 'interrupted' }],
      },
      attrition: {
        name: 'Desgaste de prueba', target: 'enemy', costs: { effort: 6 }, cooldown: 2,
        effects: [{ kind: 'damage', amount: 5 }, { kind: 'status', status: 'worn' }],
      },
      recover: {
        name: 'Recobrar esfuerzo', target: 'self', cooldown: 1,
        effects: [{ kind: 'resource', resource: 'effort', amount: 7 }],
      },
    },
    statuses: {
      protected: { name: 'Protección provisional', duration: 1, stacking: 'refresh', modifiers: [{ stat: 'armor', add: 11 }] },
      exposed: { name: 'Exposición provisional', duration: 2, stacking: 'refresh', modifiers: [{ stat: 'armor', add: -5 }] },
      interrupted: { name: 'Interrupción provisional', duration: 1, stacking: 'refresh', preventsActions: true },
      worn: { name: 'Desgaste provisional', duration: 3, maxStacks: 2, stacking: 'stack', onTurnEnd: [{ kind: 'damage', amount: 5 }] },
      response: {
        name: 'Respuesta pasiva de prueba',
        reactions: [{ on: 'damaged', tags: ['contact'], effects: [{ kind: 'damage', target: 'source', amount: 4 }] }],
      },
    },
    combatants: [
      {
        id: 'party-front', name: 'Prototipo A · presión', team: 'party',
        stats: { power: 14, armor: 5, support: 0, speed: 13 },
        resources: { hp: { max: 112 }, effort: { max: 28 } },
        actions: ['strike', 'burst', 'brace', 'recover'], statuses: [{ id: 'response' }],
      },
      {
        id: 'party-support', name: 'Prototipo B · apoyo', team: 'party',
        stats: { power: 8, armor: 3, support: 12, speed: 11 },
        resources: { hp: { max: 92 }, effort: { max: 35 } },
        actions: ['strike', 'mend', 'pressure', 'recover'],
      },
      {
        id: 'party-flex', name: 'Prototipo C · control', team: 'party',
        stats: { power: 11, armor: 4, support: 5, speed: 15 },
        resources: { hp: { max: 100 }, effort: { max: 30 } },
        actions: ['strike', 'interrupt', 'attrition', 'mend', 'recover'],
      },
      {
        id: 'opponent-front', name: 'Rival A · presión', team: 'opponent',
        stats: { power: 16.5, armor: 5, support: 0, speed: 10 },
        resources: { hp: { max: 116 }, effort: { max: 24 } },
        actions: ['strike', 'burst', 'brace', 'recover'],
      },
      {
        id: 'opponent-support', name: 'Rival B · apoyo', team: 'opponent',
        stats: { power: 10.5, armor: 3, support: 10, speed: 12 },
        resources: { hp: { max: 98 }, effort: { max: 28 } },
        actions: ['strike', 'mend', 'pressure', 'recover'],
      },
      {
        id: 'opponent-flex', name: 'Rival C · control', team: 'opponent',
        stats: { power: 13.5, armor: 4, support: 3, speed: 14 },
        resources: { hp: { max: 108 }, effort: { max: 27 } },
        actions: ['strike', 'interrupt', 'attrition', 'recover'],
      },
    ],
  };
}
