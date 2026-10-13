/** Deliberately small combat rules. Presentation and 3D models are independent. */
import { DOG_PROFILES } from './encounters.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/** Gerard's classes (docs/bubbaloo-palace.md); a class adds its own skills. */
export type ClassId = 'noista';
export const SKILLS = [
  { id: 'impulse', name: 'Impulso', cost: 8, side: 'foes', description: '28 de daño a un enemigo' },
  { id: 'encourage', name: 'Ánimo', cost: 8, side: 'allies', description: 'Recupera 24 HP de un aliado' },
  { id: 'nota', name: 'No-ta', cost: 10, side: 'foes', description: 'Un NO rotundo: rompe el pringue y hace 40 de daño', class: 'noista' },
] as const;
export type SkillId = typeof SKILLS[number]['id'];
export type FoeKind = 'dog' | 'minion';
export interface Combatant {
  id: string; name: string; hp: number; maxHp: number;
  secondary: number; maxSecondary: number; guarding: boolean;
  kind?: FoeKind;
  /** Pringue: a gum shell that swallows every hit except No-ta. */
  shell?: boolean;
}
/** Which fight this is: the street dogs, or the palace minion that wakes Noísta. */
export type Encounter = 'dogs' | 'palace-minion';
/** Bernat's HP floor in the palace fight: the hit that would cross it stops there and starts the beat. */
export const BEAT_HP = 20;
export interface BattleState {
  allies: Combatant[]; foes: Combatant[]; active: number; round: number;
  phase: BattlePhase; message: string;
  enemyActions: string[];
  /** Dogs under La Reina Bubbaloo's spell: they surround the party, so nobody can escape. */
  possessed: boolean;
  encounter: Encounter;
  /** Gerard's active class, which adds its skills. */
  gerardClass?: ClassId;
}
/** Nobody runs from possessed dogs or from the palace minion. */
export const cornered = (state: BattleState) => state.possessed || state.encounter !== 'dogs';
/** The skills `actor` can use: everyone's, plus Gerard's class skills. */
export function skillsFor(state: BattleState, actor: Combatant) {
  return SKILLS.filter(skill => !('class' in skill) || (actor.id === 'gerard' && state.gerardClass === skill.class));
}
export interface BattleEffect { kind: BattleAction | 'enemy'; actor: string; target?: string; amount?: number; skill?: SkillId; swallowed?: boolean }
const unit = (id: string, name: string, hp: number, secondary = 0): Combatant =>
  ({ id, name, hp, maxHp: hp, secondary, maxSecondary: secondary, guarding: false });
export function createBattle(allyCount: 1 | 2 = 1, foeCount = 1, possessed = false, gerardClass?: ClassId): BattleState {
  if (!Number.isInteger(foeCount) || foeCount < 1 || foeCount > 4) throw new Error('An encounter needs 1–4 foes');
  // Solo Gerard can clear a pack with focused attacks; a companion keeps full-strength foes.
  const foeHp = allyCount === 1 && foeCount > 1 ? 36 : 54;
  return {
    allies: [unit('gerard', 'Gerard', 100, 30), ...(allyCount === 2 ? [unit('bernat', 'Bernat', 85, 24)] : [])],
    foes: Array.from({ length: foeCount }, (_, i) => ({ ...unit(`dog-${i}`, DOG_PROFILES[i].name, foeHp), kind: 'dog' as const })),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed, encounter: 'dogs', gerardClass,
    message: possessed ? `${foeCount === 1 ? 'Un perro con los ojos rosados se lanza' : `${foeCount} perros con los ojos rosados se lanzan`} a por vosotros. ¡No hay escapatoria!`
      : `${foeCount === 1 ? 'Un perro curioso te corta' : `${foeCount} perros curiosos te cortan`} el paso. Elige tu movimiento.`,
  };
}
/** The palace fight: Gerard and Bernat against one minion in a shell of gum. */
export function createMinionBattle(gerardClass?: ClassId): BattleState {
  return {
    allies: [unit('gerard', 'Gerard', 100, 30), unit('bernat', 'Bernat', 85, 24)],
    foes: [{ ...unit('minion-0', 'Esbirro de la Reina', 40), kind: 'minion', shell: true }],
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'palace-minion', gerardClass,
    message: 'Un esbirro de la Reina Bubbaloo sale del sumidero, brillante de pringue.',
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
  if (action === 'skill' && (!ability || actor.secondary < ability.cost || !skillsFor(state, actor).includes(ability))) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  if (action === 'escape' && cornered(state)) return;
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
    } else if (target.shell && skill !== 'nota') {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else {
      const damage = action !== 'skill' ? 18 : skill === 'nota' ? 40 : 28;
      if (skill === 'nota') target.shell = false;
      effect.amount = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - damage);
      const name = action !== 'skill' ? 'Atacar' : ability!.name;
      state.message = skill === 'nota' ? `${actor.name} dice que NO. El pringue revienta. −${effect.amount} HP.` : `${actor.name} usa ${name} contra ${target.name}. −${effect.amount} HP.`;
    }
  }
  if (state.foes.every(f => f.hp === 0)) {
    state.phase = 'won';
    state.message = state.encounter === 'palace-minion' ? 'El esbirro se queda tieso, se agrieta como chicle viejo… y revienta.'
      : state.possessed ? `El rosa se les va de los ojos. ${state.foes.length === 1 ? 'El perro sale corriendo' : 'Los perros salen corriendo'}, con el rabo entre las patas.`
      : `${state.foes.length === 1 ? 'El perro se tranquiliza' : 'Los perros se tranquilizan'}. ¡Camino despejado!`;
  } else {
    const next = state.allies.findIndex((a, i) => i > state.active && a.hp > 0);
    if (next >= 0) state.active = next;
    else state.phase = 'enemy';
  }
  return effect;
}
/** `targetId` is an AI suggestion; without a valid one the dogs take turns picking heroes. */
export function enemyAct(state: BattleState, id: string, targetId?: string): BattleEffect | undefined {
  if (state.phase !== 'enemy' || state.enemyActions.includes(id)) return;
  const actor = state.foes.find(f => f.id === id && f.hp > 0);
  const alive = state.allies.filter(a => a.hp > 0);
  const target = alive.find(a => a.id === targetId) ?? alive[(state.round + state.foes.findIndex(f => f.id === id) - 1) % alive.length];
  if (!actor || !target) return;
  if (state.encounter === 'palace-minion') return minionAct(state, actor);
  state.enemyActions.push(id);
  const strength = state.allies.length === 1 && state.foes.length > 1 ? 5 : 9;
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = Math.min(damage, target.hp);
  target.hp -= amount;
  state.message = `${actor.name} da un empujón a ${target.name}. −${amount} HP${target.guarding ? ' · Protegido' : ''}.`;
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/**
 * The palace minion spits at Bernat, harder every round, and its hits never knock him out: the
 * one that would leave him at BEAT_HP or less stops there and starts the beat, so whatever the
 * player does (attack, guard, heal) the "¡NO!" comes by round 6. After Noísta it simply fights.
 */
function minionAct(state: BattleState, actor: Combatant): BattleEffect | undefined {
  const bernat = state.allies.find(a => a.id === 'bernat' && a.hp > 0);
  const target = bernat ?? state.allies.find(a => a.hp > 0);
  if (!target) return;
  state.enemyActions.push(actor.id);
  // Once Gerard has his class the minion is shaken: plain spits, no more escalation.
  const raw = state.gerardClass ? 12 : state.round >= 6 ? 999 : Math.round(10 * 1.5 ** (state.round - 1));
  let amount = Math.min(target.guarding ? Math.ceil(raw / 3) : raw, target.hp);
  const awakening = !state.gerardClass && target.id === 'bernat' && target.hp - amount <= BEAT_HP;
  if (awakening) amount = Math.max(0, target.hp - BEAT_HP);
  target.hp -= amount;
  state.message = `${actor.name} escupe chicle a ${target.name}. −${amount} HP${target.guarding ? ' · Protegido' : ''}.`;
  if (awakening) { state.phase = 'beat'; state.message = `${target.name} cae de rodillas. El esbirro se infla para el último golpe…`; }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/** The beat is over: Gerard said no. His class wakes up and it is his turn again, with No-ta. */
export function awaken(state: BattleState, gerardClass: ClassId) {
  if (state.phase !== 'beat') return;
  state.gerardClass = gerardClass;
  const gerard = state.allies.find(a => a.id === 'gerard')!;
  gerard.secondary = gerard.maxSecondary;
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = []; state.round++;
  state.active = state.allies.indexOf(gerard); state.phase = 'player';
  state.message = 'Gerard ha dicho que no. Algo ha despertado en él: Noísta.';
}
export function nextRound(state: BattleState) {
  if (state.phase !== 'enemy' || state.foes.some(f => f.hp > 0 && !state.enemyActions.includes(f.id))) return;
  state.round++; state.active = state.allies.findIndex(a => a.hp > 0);
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = [];
  state.phase = 'player'; state.message = 'Tu turno. Elige tu siguiente movimiento.';
}
