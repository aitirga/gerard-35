/** Deliberately small combat rules. Presentation and 3D models are independent. */
import { DOG_PROFILES } from './encounters.ts';
import { PROFILES, healing, magical, physical, withBonus, type ProfileId, type StatBonus, type Stats } from './stats.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/**
 * Classes (docs/party.md). They belong to the party, not to one person: once unlocked, anyone in
 * the party can wear one, and it adds its stats and its skills to whoever wears it.
 */
export type ClassId = 'noista';
export const CLASS_STATS: Record<ClassId, StatBonus> = {
  // Saying no is a matter of conviction, not muscle.
  noista: { magia: 2, espiritu: 2, defensa: -1 },
};
/**
 * `power` is the amount at average stats (see stats.ts); for a `boost` it is what it adds to
 * Fuerza and Magia. `class` skills come with a class; `owners` skills are those people's own.
 * Bernat has none: he only attacks.
 */
export const SKILLS = [
  { id: 'analisis', name: 'Análisis Parálisis', cost: 10, side: 'party', power: 3, kind: 'boost', description: 'Gerard lo piensa todo dos veces y el equipo pega con más cabeza', owners: ['gerard', 'gerard35'] },
  { id: 'impulse', name: 'Impulso', cost: 8, side: 'foes', power: 28, kind: 'physical', description: 'Un golpe con carrerilla a un enemigo', owners: ['aitor'] },
  { id: 'encourage', name: 'Ánimo', cost: 8, side: 'allies', power: 24, kind: 'heal', description: 'Recupera PV de un aliado', owners: ['aitor'] },
  { id: 'nota', name: 'No-ta', cost: 10, side: 'foes', power: 40, kind: 'magic', description: 'Un NO rotundo: rompe el pringue y hace mucho daño', class: 'noista' },
  { id: 'abrazo', name: 'Abrazo', cost: 12, side: 'party', power: 14, kind: 'heal', description: 'Aitor abraza a todo el equipo: PV para todos', owners: ['aitor'] },
] as const;
/** How many rounds a boost lasts, counting the one it is used in. */
export const BOOST_ROUNDS = 3;
export type SkillId = typeof SKILLS[number]['id'];
type Skill = typeof SKILLS[number];
export type FoeKind = 'dog' | 'minion';
export interface Combatant {
  id: string; name: string; hp: number; maxHp: number;
  secondary: number; maxSecondary: number; guarding: boolean;
  /** Stats in this fight: the fighter's own plus their class's. */
  stats: Stats;
  /** Who the fighter is underneath (stats.ts), e.g. Gerard as a boy or at 35. */
  profile: ProfileId;
  /** The class the fighter wears, if any. */
  classId?: ClassId;
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
  /** Análisis Parálisis: the party's Fuerza and Magia are up by `amount` until the end of round `until`. */
  boost?: { amount: number; until: number };
}
/** Someone who fights on the party's side: `id` names them in the fight, `profile` gives their stats. */
export interface PartySlot { id: string; name: string; profile: ProfileId; classId?: ClassId }
/** Chapter 1's party: Gerard, and Bernat once he walks with him. */
export function childParty(allyCount: number, gerardClass?: ClassId): PartySlot[] {
  return [{ id: 'gerard', name: 'Gerard', profile: 'gerard', classId: gerardClass }, ...(allyCount === 2 ? [{ id: 'bernat', name: 'Bernat', profile: 'bernat' as const }] : [])];
}
/** Nobody runs from possessed dogs or from the palace minion. */
export const cornered = (state: BattleState) => state.possessed || state.encounter !== 'dogs';
/** Gerard's class in this fight; the palace minion stops escalating once he has one. */
export const gerardClass = (state: BattleState) => state.allies.find(a => a.id === 'gerard')?.classId;
/** The skills `actor` can use: their own and their class's. */
export function skillsFor(_state: BattleState, actor: Combatant) {
  return SKILLS.filter(skill => 'class' in skill ? actor.classId === skill.class : (skill.owners as readonly ProfileId[]).includes(actor.profile));
}
/** Rounds the party boost has left, this one included (0 when there is none). */
export const boostRounds = (state: BattleState) => state.boost ? Math.max(0, state.boost.until - state.round + 1) : 0;
/** A fighter's stats right now: the party boost adds to the allies' own. */
function current(state: BattleState, c: Combatant): Stats {
  const boost = boostRounds(state) && state.allies.includes(c) ? state.boost!.amount : 0;
  return boost ? withBonus(c.stats, { fuerza: boost, magia: boost }) : c.stats;
}
export interface BattleEffect { kind: BattleAction | 'enemy'; actor: string; target?: string; amount?: number; skill?: SkillId; swallowed?: boolean; healed?: { id: string; amount: number }[]; boosted?: string[] }
function fighter(slot: PartySlot): Combatant {
  const stats = withBonus(PROFILES[slot.profile], slot.classId ? CLASS_STATS[slot.classId] : undefined);
  return { id: slot.id, name: slot.name, profile: slot.profile, classId: slot.classId, stats, hp: stats.pv, maxHp: stats.pv, secondary: stats.sec, maxSecondary: stats.sec, guarding: false };
}
function foe(id: string, name: string, kind: FoeKind, hp?: number): Combatant {
  const stats = { ...PROFILES[kind], ...(hp ? { pv: hp } : {}) };
  return { id, name, kind, profile: kind, stats, hp: stats.pv, maxHp: stats.pv, secondary: 0, maxSecondary: 0, guarding: false };
}
/** The party in turn order: the fastest acts first (a stable sort keeps ties in party order). */
function lineUp(party: PartySlot[]) {
  return party.map(fighter).sort((a, b) => b.stats.velocidad - a.stats.velocidad);
}
/** `party` is a size for chapter 1's boys (1 or 2), or the actual party. */
export function createBattle(party: number | PartySlot[] = 1, foeCount = 1, possessed = false, gerardClassId?: ClassId): BattleState {
  if (!Number.isInteger(foeCount) || foeCount < 1 || foeCount > 4) throw new Error('An encounter needs 1–4 foes');
  const slots = typeof party === 'number' ? childParty(party, gerardClassId) : party;
  if (!slots.length) throw new Error('A battle needs someone on the party\'s side');
  // Solo Gerard can clear a pack with focused attacks; a companion keeps full-strength foes.
  const foeHp = slots.length === 1 && foeCount > 1 ? 36 : 54;
  return {
    allies: lineUp(slots),
    foes: Array.from({ length: foeCount }, (_, i) => foe(`dog-${i}`, DOG_PROFILES[i].name, 'dog', foeHp)),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed, encounter: 'dogs',
    message: possessed ? `${foeCount === 1 ? 'Un perro con los ojos rosados se lanza' : `${foeCount} perros con los ojos rosados se lanzan`} a por vosotros. ¡No hay escapatoria!`
      : `${foeCount === 1 ? 'Un perro curioso te corta' : `${foeCount} perros curiosos te cortan`} el paso. Elige tu movimiento.`,
  };
}
/** The palace fight: Gerard and Bernat against one minion in a shell of gum. */
export function createMinionBattle(gerardClassId?: ClassId): BattleState {
  return {
    allies: lineUp(childParty(2, gerardClassId)),
    foes: [{ ...foe('minion-0', 'Esbirro de la Reina', 'minion'), shell: true }],
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'palace-minion',
    message: 'Un esbirro de la Reina Bubbaloo sale del sumidero, brillante de pringue.',
  };
}
/** Who an action can be aimed at. A party skill is not aimed: these are who it would heal. */
export function validTargets(state: BattleState, action: BattleAction, skill: SkillId = 'impulse'): Combatant[] {
  if (action === 'attack') return state.foes.filter(f => f.hp > 0);
  if (action !== 'skill') return [];
  const ability = SKILLS.find(s => s.id === skill);
  if (!ability) return [];
  // A boost already running has nothing to add until it wears off.
  if (ability.kind === 'boost') return boostRounds(state) ? [] : state.allies.filter(a => a.hp > 0);
  return ability.side === 'foes' ? state.foes.filter(f => f.hp > 0) : state.allies.filter(a => a.hp > 0 && a.hp < a.maxHp);
}
/** Whether a skill needs a target picked, or simply happens (Abrazo and Análisis reach everyone). */
export const aimed = (skill: SkillId) => SKILLS.find(s => s.id === skill)?.side !== 'party';
/** What `skill` (or a plain attack) does to `target` before it is clamped to what is left. */
function strike(state: BattleState, actor: Combatant, target: Combatant, skill?: Skill) {
  const stats = current(state, actor);
  if (!skill) return physical(18, stats, target.stats);
  return skill.kind === 'magic' ? magical(skill.power, stats, target.stats) : physical(skill.power, stats, target.stats);
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill: SkillId = 'impulse'): BattleEffect | undefined {
  if (state.phase !== 'player') return;
  const actor = state.allies[state.active];
  if (!actor || actor.hp <= 0) return;
  const ability = SKILLS.find(s => s.id === skill);
  const targets = validTargets(state, action, skill);
  const party = action === 'skill' && ability?.side === 'party';
  const target = party ? undefined : targets.find(f => f.id === targetId);
  if ((action === 'attack' || action === 'skill') && !target && !(party && targets.length)) return;
  if (action === 'skill' && (!ability || actor.secondary < ability.cost || !skillsFor(state, actor).includes(ability))) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  if (action === 'escape' && cornered(state)) return;
  if (action === 'escape') {
    state.phase = 'escaped'; state.message = 'Te alejas con calma. La aventura sigue.'; return effect;
  }
  if (action === 'defend') {
    actor.guarding = true; state.message = `${actor.name} se prepara para el siguiente golpe.`;
  } else if (party && ability!.kind === 'boost') {
    actor.secondary -= ability!.cost; effect.skill = skill; effect.target = actor.id;
    state.boost = { amount: ability!.power, until: state.round + BOOST_ROUNDS - 1 };
    effect.boosted = targets.map(ally => ally.id);
    state.message = `${actor.name} usa ${ability!.name}. Fuerza y Magia +${ability!.power} para el equipo durante ${BOOST_ROUNDS} rondas.`;
  } else if (party) {
    actor.secondary -= ability!.cost; effect.skill = skill; effect.target = actor.id;
    const power = healing(ability!.power, current(state, actor));
    effect.healed = targets.map(ally => { const amount = Math.min(power, ally.maxHp - ally.hp); ally.hp += amount; return { id: ally.id, amount }; });
    effect.amount = effect.healed.reduce((sum, h) => sum + h.amount, 0);
    state.message = `${actor.name} usa ${ability!.name}. El equipo recupera ${effect.amount} PV.`;
  } else if (target) {
    if (action === 'skill') { actor.secondary -= ability!.cost; effect.skill = skill; }
    effect.target = target.id;
    if (action === 'skill' && ability!.kind === 'heal') {
      effect.amount = Math.min(healing(ability!.power, current(state, actor)), target.maxHp - target.hp);
      target.hp += effect.amount;
      state.message = `${actor.name} usa ${ability!.name} con ${target.name}. +${effect.amount} PV.`;
    } else if (target.shell && skill !== 'nota') {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else {
      const damage = strike(state, actor, target, action === 'skill' ? ability : undefined);
      if (action === 'skill' && skill === 'nota') target.shell = false;
      effect.amount = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - damage);
      const name = action !== 'skill' ? 'Atacar' : ability!.name;
      state.message = action === 'skill' && skill === 'nota' ? `${actor.name} dice que NO. El pringue revienta. −${effect.amount} PV.` : `${actor.name} usa ${name} contra ${target.name}. −${effect.amount} PV.`;
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
  const strength = physical(state.allies.length === 1 && state.foes.length > 1 ? 5 : 9, actor.stats, target.stats);
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = Math.min(damage, target.hp);
  target.hp -= amount;
  state.message = `${actor.name} da un empujón a ${target.name}. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
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
  const raw = gerardClass(state) ? 12 : state.round >= 6 ? 999 : Math.round(10 * 1.5 ** (state.round - 1));
  let amount = Math.min(target.guarding ? Math.ceil(raw / 3) : raw, target.hp);
  const awakening = !gerardClass(state) && target.id === 'bernat' && target.hp - amount <= BEAT_HP;
  if (awakening) amount = Math.max(0, target.hp - BEAT_HP);
  target.hp -= amount;
  state.message = `${actor.name} escupe chicle a ${target.name}. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
  if (awakening) { state.phase = 'beat'; state.message = `${target.name} cae de rodillas. El esbirro se infla para el último golpe…`; }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/** The beat is over: Gerard said no. His class wakes up and it is his turn again, with No-ta. */
export function awaken(state: BattleState, classId: ClassId) {
  if (state.phase !== 'beat') return;
  const gerard = state.allies.find(a => a.id === 'gerard')!;
  const hurt = gerard.maxHp - gerard.hp;
  Object.assign(gerard, fighter({ id: gerard.id, name: gerard.name, profile: gerard.profile, classId }));
  gerard.hp = Math.max(1, gerard.maxHp - hurt);
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
