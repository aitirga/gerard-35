/** Deliberately small combat rules. Presentation and 3D models are independent. */
import { DOG_PROFILES } from './encounters.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
export type BattlePhase = 'player' | 'enemy' | 'won' | 'lost' | 'escaped';
export const SKILLS = [
  { id: 'impulse', name: 'Impulso', cost: 8, side: 'foes', description: '28 de daño a un enemigo' },
  { id: 'encourage', name: 'Ánimo', cost: 8, side: 'allies', description: 'Recupera 24 HP de un aliado' },
] as const;
export type SkillId = typeof SKILLS[number]['id'];
export interface Combatant {
  id: string; name: string; hp: number; maxHp: number;
  secondary: number; maxSecondary: number; guarding: boolean;
}
export interface BattleState {
  allies: Combatant[]; foes: Combatant[]; active: number; round: number;
  phase: BattlePhase; message: string;
  enemyActions: string[];
}
export interface BattleEffect { kind: BattleAction | 'enemy'; actor: string; target?: string; amount?: number; skill?: SkillId }
const unit = (id: string, name: string, hp: number, secondary = 0): Combatant =>
  ({ id, name, hp, maxHp: hp, secondary, maxSecondary: secondary, guarding: false });
export function createBattle(allyCount: 1 | 2 = 1, foeCount = 1): BattleState {
  if (!Number.isInteger(foeCount) || foeCount < 1 || foeCount > 4) throw new Error('An encounter needs 1–4 foes');
  // Solo Gerard can clear a pack with focused attacks; a companion keeps full-strength foes.
  const foeHp = allyCount === 1 && foeCount > 1 ? 36 : 54;
  return {
    allies: [unit('gerard', 'Gerard', 100, 30), ...(allyCount === 2 ? [unit('bernat', 'Bernat', 85, 24)] : [])],
    foes: Array.from({ length: foeCount }, (_, i) => unit(`dog-${i}`, DOG_PROFILES[i].name, foeHp)),
    active: 0, round: 1, phase: 'player', enemyActions: [], message: `${foeCount === 1 ? 'Un perro curioso te corta' : `${foeCount} perros curiosos te cortan`} el paso. Elige tu movimiento.`,
  };
}
export function validTargets(state: BattleState, action: BattleAction, skill: SkillId = 'impulse'): Combatant[] {
  if (action === 'attack') return state.foes.filter(f => f.hp > 0);
  if (action !== 'skill') return [];
  const ability = SKILLS.find(s => s.id === skill);
  if (!ability) return [];
  return ability.side === 'allies' ? state.allies.filter(a => a.hp > 0 && a.hp < a.maxHp) : state.foes.filter(f => f.hp > 0);
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill: SkillId = 'impulse'): BattleEffect | undefined {
  if (state.phase !== 'player') return;
  const actor = state.allies[state.active];
  if (!actor || actor.hp <= 0) return;
  const ability = SKILLS.find(s => s.id === skill);
  const target = validTargets(state, action, skill).find(f => f.id === targetId);
  if ((action === 'attack' || action === 'skill') && !target) return;
  if (action === 'skill' && (!ability || actor.secondary < ability.cost)) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  if (action === 'escape') {
    state.phase = 'escaped'; state.message = 'Te alejas con calma. La aventura sigue.'; return effect;
  }
  if (action === 'defend') {
    actor.guarding = true; state.message = `${actor.name} se prepara para el siguiente golpe.`;
  } else if (target) {
    if (action === 'skill') { actor.secondary -= ability!.cost; effect.skill = skill; }
    effect.target = target.id;
    if (action === 'skill' && skill === 'encourage') {
      effect.amount = Math.min(24, target.maxHp - target.hp);
      target.hp += effect.amount;
      state.message = `${actor.name} usa Ánimo con ${target.name}. +${effect.amount} HP.`;
    } else {
      const damage = action === 'skill' ? 28 : 18;
      effect.amount = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - damage);
      state.message = `${actor.name} usa ${action === 'skill' ? 'Impulso' : 'Atacar'} contra ${target.name}. −${effect.amount} HP.`;
    }
  }
  if (state.foes.every(f => f.hp === 0)) {
    state.phase = 'won'; state.message = `${state.foes.length === 1 ? 'El perro se tranquiliza' : 'Los perros se tranquilizan'}. ¡Camino despejado!`;
  } else {
    const next = state.allies.findIndex((a, i) => i > state.active && a.hp > 0);
    if (next >= 0) state.active = next;
    else state.phase = 'enemy';
  }
  return effect;
}
export function enemyAct(state: BattleState, id: string): BattleEffect | undefined {
  if (state.phase !== 'enemy' || state.enemyActions.includes(id)) return;
  const actor = state.foes.find(f => f.id === id && f.hp > 0);
  const alive = state.allies.filter(a => a.hp > 0);
  const target = alive[(state.round + state.foes.findIndex(f => f.id === id) - 1) % alive.length];
  if (!actor || !target) return;
  state.enemyActions.push(id);
  const strength = state.allies.length === 1 && state.foes.length > 1 ? 5 : 9;
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = Math.min(damage, target.hp);
  target.hp -= amount;
  state.message = `${actor.name} da un empujón a ${target.name}. −${amount} HP${target.guarding ? ' · Protegido' : ''}.`;
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
export function nextRound(state: BattleState) {
  if (state.phase !== 'enemy' || state.foes.some(f => f.hp > 0 && !state.enemyActions.includes(f.id))) return;
  state.round++; state.active = state.allies.findIndex(a => a.hp > 0);
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = [];
  state.phase = 'player'; state.message = 'Tu turno. Elige tu siguiente movimiento.';
}
