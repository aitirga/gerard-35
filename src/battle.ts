/** Campaign turn/story adapter. Numeric resolution is shared with the generic combat core. */
import { adjustResource } from './combat/engine.ts';
import { DOG_PROFILES } from './encounters.ts';
import { PROFILES, healing, magical, physical, withBonus, type ProfileId, type StatBonus, type Stats } from './stats.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/**
 * Ánimas (the code calls them classes; docs/party.md). They belong to the party, not to one
 * person: once unlocked, anyone in the party but Bernat can wear one, and it adds its stats and
 * its skills to whoever wears it. In a fight the active fighter swaps them with L and R.
 */
export type ClassId = 'matemagico' | 'noista';
export const ANIMA_NAMES: Record<ClassId, string> = { matemagico: 'Matemágico', noista: 'Noísta' };
export const CLASS_STATS: Record<ClassId, StatBonus> = {
  // Counting everything twice sharpens the mind a little.
  matemagico: { magia: 1, espiritu: 1 },
  // Saying no is a matter of conviction, not muscle.
  noista: { magia: 2, espiritu: 2, defensa: -1 },
};
/**
 * Descriptions follow the shape in AGENTS.md ("Daño alto mágico a un enemigo. Rompe el pringue."),
 * unless the skill is marked `abstract: true`, which lets its description stay vague on purpose.
 * `power` is the amount at average stats (see stats.ts); for a `boost` it is what it adds to
 * Fuerza and Magia. Every skill comes with an ánima (`class`), so whoever wears none has none:
 * Bernat only attacks.
 */
export const SKILLS = [
  { id: 'analisis', name: 'Análisis Parálisis', cost: 10, side: 'party', power: 3, kind: 'boost', description: 'Sube Fuerza y Magia de todo el equipo durante 3 rondas.', class: 'matemagico' },
  { id: 'cardioide', name: 'Cardioide', cost: 8, side: 'allies', power: 24, kind: 'heal', description: 'Cura media a un aliado herido.', class: 'matemagico' },
  { id: 'nota', name: 'No-ta', cost: 10, side: 'foes', power: 40, kind: 'magic', description: 'Daño alto mágico a un enemigo. Rompe el pringue.', class: 'noista' },
] as const;
/** How many rounds a boost lasts, counting the one it is used in. */
export const BOOST_ROUNDS = 3;
export type SkillId = typeof SKILLS[number]['id'];
type Skill = typeof SKILLS[number];
export type FoeKind = 'dog' | 'minion' | 'guardian';
/**
 * Statuses that stack (docs/animas/README.md § Shared mechanics). Each stack does its part once
 * more: Sangrado hurts at the end of every round, Mareo and Llorera weaken the stats. Every round
 * each one loses `decay` stacks, so they fade unless something keeps adding them.
 */
export type StatusId = 'sangrado' | 'mareo' | 'llorera';
export interface StatusSpec { name: string; max: number; decay: number; tick?: number; stats?: StatBonus }
export const STATUSES: Record<StatusId, StatusSpec> = {
  sangrado: { name: 'Sangrado', max: 10, decay: 1, tick: 2 },
  mareo: { name: 'Mareo', max: 5, decay: 1, stats: { velocidad: -2, defensa: -1, espiritu: -1 } },
  llorera: { name: 'Llorera', max: 5, decay: 1, stats: { fuerza: -2, magia: -2 } },
};
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
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
  /** A foe's own hit at average stats, when it has one (the palace guards). */
  power?: number;
  /** Stacks of each status the fighter carries. */
  statuses?: Partial<Record<StatusId, number>>;
}
/** Which fight this is: the street dogs, the palace minion that wakes Noísta, or the palace guards of chapter 2. */
export type Encounter = 'dogs' | 'palace-minion' | 'palace-guards';
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
  /** The ánimas the party has unlocked, in the order L and R walk through them. */
  animas: ClassId[];
  /** Gerard has said no (Noísta is awake): the palace minion stops escalating. */
  awakened: boolean;
}
/**
 * Someone who fights on the party's side: `id` names them in the fight, `profile` gives their
 * stats, `bonus` adds what the party has gathered (chapter 2's ánimas).
 */
export interface PartySlot { id: string; name: string; profile: ProfileId; classId?: ClassId; bonus?: StatBonus }
/** Chapter 1's party: Gerard, and Bernat once he walks with him. */
export function childParty(allyCount: number, gerardClass?: ClassId): PartySlot[] {
  return [{ id: 'gerard', name: 'Gerard', profile: 'gerard', classId: gerardClass }, ...(allyCount === 2 ? [{ id: 'bernat', name: 'Bernat', profile: 'bernat' as const }] : [])];
}
/** Nobody runs from possessed dogs or from the palace minion; the palace guards let them back off. */
export const cornered = (state: BattleState) => state.possessed || state.encounter === 'palace-minion';
/** Gerard's ánima in this fight. */
export const gerardClass = (state: BattleState) => state.allies.find(a => a.id === 'gerard')?.classId;
/** Bernat wears no ánima: he only attacks. */
export const wearsAnimas = (c: Combatant) => c.profile !== 'bernat';
/**
 * The active fighter puts on `id`, one of the unlocked ánimas. It is free, the turn stays theirs,
 * and their skills and stats change with it. Returns whether anything changed.
 */
export function wearAnima(state: BattleState, id: ClassId) {
  const actor = state.allies[state.active];
  if (state.phase !== 'player' || !actor || !wearsAnimas(actor) || !state.animas.includes(id) || actor.classId === id) return false;
  // Ánimas never touch PV or Secundaria, so only the stats and the skills change.
  actor.classId = id; actor.stats = withBonus(PROFILES[actor.profile], CLASS_STATS[id]);
  return true;
}
/** L (-1) and R (+1): the previous or next unlocked ánima, round the list. Returns the new one. */
export function switchAnima(state: BattleState, step: -1 | 1): ClassId | undefined {
  const actor = state.allies[state.active];
  if (!actor || !state.animas.length) return;
  const index = state.animas.indexOf(actor.classId!);
  const next = state.animas[index < 0 ? (step > 0 ? 0 : state.animas.length - 1) : (index + step + state.animas.length) % state.animas.length];
  return wearAnima(state, next) ? next : undefined;
}
/** Unlocked ánimas, starting from whatever the party already wears. */
const wornAnimas = (slots: PartySlot[]) => [...new Set(slots.flatMap(s => s.classId ? [s.classId] : []))];
/** The skills `actor` can use: their ánima's. */
export function skillsFor(_state: BattleState, actor: Combatant) {
  return SKILLS.filter(skill => actor.classId === skill.class);
}
/** Rounds the party boost has left, this one included (0 when there is none). */
export const boostRounds = (state: BattleState) => state.boost ? Math.max(0, state.boost.until - state.round + 1) : 0;
/** A fighter's stats right now: the party boost adds to the allies' own. */
function current(state: BattleState, c: Combatant): Stats {
  const boost = boostRounds(state) && state.allies.includes(c) ? state.boost!.amount : 0;
  let stats = boost ? withBonus(c.stats, { fuerza: boost, magia: boost }) : c.stats;
  for (const id of STATUS_IDS) {
    const stacks = c.statuses?.[id], spec = STATUSES[id];
    if (!stacks || !spec.stats) continue;
    stats = withBonus(stats, Object.fromEntries(Object.entries(spec.stats).map(([key, value]) => [key, value * stacks])));
  }
  return stats;
}
/** Stacks of `id` on `c` (0 when none). */
export const stacks = (c: Combatant, id: StatusId) => c.statuses?.[id] ?? 0;
/** Adds `count` stacks of `id`, up to its maximum; returns the stacks it ends with. */
export function addStatus(c: Combatant, id: StatusId, count = 1) {
  const next = Math.min(STATUSES[id].max, stacks(c, id) + count);
  c.statuses = { ...c.statuses, [id]: next };
  return next;
}
/** What happens to one fighter's statuses at the end of a round. */
export interface StatusTick { target: string; status: StatusId; amount: number; stacks: number }
export interface BattleEffect { kind: BattleAction | 'enemy'; actor: string; target?: string; amount?: number; skill?: SkillId; swallowed?: boolean; boosted?: string[]; status?: { id: StatusId; stacks: number } }
/** Bridge the campaign's flat resources to the core; positive healing never revives. */
function changeHealth(target: Combatant, delta: number) {
  const result = adjustResource({ current: target.hp, max: target.maxHp }, delta, false);
  target.hp = result.resource.current;
  return Math.abs(result.amount);
}
/** The action is validated before payment, just as it is in the generic command resolver. */
function spendSecondary(actor: Combatant, cost: number) {
  actor.secondary = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, -cost).resource.current;
}
function fighter(slot: PartySlot): Combatant {
  const stats = withBonus(withBonus(PROFILES[slot.profile], slot.classId ? CLASS_STATS[slot.classId] : undefined), slot.bonus);
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
/** `party` is a size for chapter 1's boys (1 or 2), or the actual party. `animas` defaults to what they wear. */
export function createBattle(party: number | PartySlot[] = 1, foeCount = 1, possessed = false, gerardClassId?: ClassId, animas?: ClassId[]): BattleState {
  if (!Number.isInteger(foeCount) || foeCount < 1 || foeCount > 4) throw new Error('An encounter needs 1–4 foes');
  const slots = typeof party === 'number' ? childParty(party, gerardClassId) : party;
  if (!slots.length) throw new Error('A battle needs someone on the party\'s side');
  // Solo Gerard can clear a pack with focused attacks; a companion keeps full-strength foes.
  const foeHp = slots.length === 1 && foeCount > 1 ? 36 : 54;
  return {
    allies: lineUp(slots),
    foes: Array.from({ length: foeCount }, (_, i) => foe(`dog-${i}`, DOG_PROFILES[i].name, 'dog', foeHp)),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed, encounter: 'dogs',
    animas: animas ?? wornAnimas(slots), awakened: false,
    message: possessed ? `${foeCount === 1 ? 'Un perro con los ojos rosados se lanza' : `${foeCount} perros con los ojos rosados se lanzan`} a por vosotros. ¡No hay escapatoria!`
      : `${foeCount === 1 ? 'Un perro curioso te corta' : `${foeCount} perros curiosos te cortan`} el paso. Elige tu movimiento.`,
  };
}
/** The palace fight: Gerard and Bernat against one minion in a shell of gum. */
export function createMinionBattle(gerardClassId?: ClassId, animas?: ClassId[]): BattleState {
  const slots = childParty(2, gerardClassId);
  const unlocked = animas ?? wornAnimas(slots);
  return {
    allies: lineUp(slots),
    foes: [{ ...foe('minion-0', 'Esbirro de la Reina', 'minion'), shell: true }],
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'palace-minion',
    animas: unlocked, awakened: unlocked.includes('noista'),
    message: 'Un esbirro de la Reina Bubbaloo sale del sumidero, brillante de pringue.',
  };
}
/**
 * The Guardianes de Chicle before the throne stair (docs/chapter-2.md): far too strong without
 * ánimas, one fewer every two ánimas, and softer and weaker with each one.
 */
export function palaceGuards(animas: number) {
  return { count: Math.max(1, 3 - Math.floor(animas / 2)), hp: Math.max(40, 220 - 30 * animas), power: Math.max(8, 30 - 3 * animas) };
}
export type GuardStrength = ReturnType<typeof palaceGuards>;
/** Chapter 2: the party against the palace guards, as strong as the party's ánimas leave them. */
export function createGuardBattle(party: PartySlot[], guards: GuardStrength, animas?: ClassId[]): BattleState {
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party),
    foes: Array.from({ length: guards.count }, (_, i) => ({ ...foe(`guard-${i}`, guards.count > 1 ? `Guardián de chicle ${i + 1}` : 'Guardián de chicle', 'guardian', guards.hp), power: guards.power })),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'palace-guards',
    animas: unlocked, awakened: unlocked.includes('noista'),
    message: guards.count > 1 ? `${guards.count} guardianes de chicle se despegan de la cortina. Son enormes.` : 'Un guardián de chicle se despega de la cortina.',
  };
}
/** Who an action can be aimed at. A party skill is not aimed: these are who it would heal. */
export function validTargets(state: BattleState, action: BattleAction, skill: SkillId = 'nota'): Combatant[] {
  if (action === 'attack') return state.foes.filter(f => f.hp > 0);
  if (action !== 'skill') return [];
  const ability = SKILLS.find(s => s.id === skill);
  if (!ability) return [];
  // A boost already running has nothing to add until it wears off.
  if (ability.kind === 'boost') return boostRounds(state) ? [] : state.allies.filter(a => a.hp > 0);
  return ability.side === 'foes' ? state.foes.filter(f => f.hp > 0) : state.allies.filter(a => a.hp > 0 && a.hp < a.maxHp);
}
/** Whether a skill needs a target picked, or simply happens (Análisis Parálisis reaches everyone). */
export const aimed = (skill: SkillId) => SKILLS.find(s => s.id === skill)?.side !== 'party';
/** What `skill` (or a plain attack) does to `target` before it is clamped to what is left. */
function strike(state: BattleState, actor: Combatant, target: Combatant, skill?: Skill) {
  const stats = current(state, actor), guard = current(state, target);
  if (!skill) return physical(18, stats, guard);
  return skill.kind === 'magic' ? magical(skill.power, stats, guard) : physical(skill.power, stats, guard);
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId): BattleEffect | undefined {
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
    state.phase = 'escaped';
    state.message = state.encounter === 'palace-guards' ? 'Retrocedéis hasta el vestíbulo. Los guardianes vuelven a pegarse a la cortina.' : 'Te alejas con calma. La aventura sigue.';
    return effect;
  }
  if (action === 'defend') {
    actor.guarding = true; state.message = `${actor.name} se prepara para el siguiente golpe.`;
  } else if (party) {
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = actor.id;
    state.boost = { amount: ability!.power, until: state.round + BOOST_ROUNDS - 1 };
    effect.boosted = targets.map(ally => ally.id);
    state.message = `${actor.name} usa ${ability!.name}. Fuerza y Magia +${ability!.power} para el equipo durante ${BOOST_ROUNDS} rondas.`;
  } else if (target) {
    if (action === 'skill') { spendSecondary(actor, ability!.cost); effect.skill = skill; }
    effect.target = target.id;
    if (action === 'skill' && ability!.kind === 'heal') {
      effect.amount = changeHealth(target, healing(ability!.power, current(state, actor)));
      state.message = `${actor.name} usa ${ability!.name} con ${target.name}. +${effect.amount} PV.`;
    } else if (target.shell && !(action === 'skill' && skill === 'nota')) {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else {
      const damage = strike(state, actor, target, action === 'skill' ? ability : undefined);
      if (action === 'skill' && skill === 'nota') target.shell = false;
      effect.amount = changeHealth(target, -damage);
      const name = action !== 'skill' ? 'Atacar' : ability!.name;
      state.message = action === 'skill' && skill === 'nota' ? `${actor.name} dice que NO. El pringue revienta. −${effect.amount} PV.` : `${actor.name} usa ${name} contra ${target.name}. −${effect.amount} PV.`;
    }
  }
  if (state.foes.every(f => f.hp === 0)) {
    state.phase = 'won';
    state.message = state.encounter === 'palace-minion' ? 'El esbirro se queda tieso, se agrieta como chicle viejo… y revienta.'
      : state.encounter === 'palace-guards' ? 'Los guardianes se deshacen en charcos rosas. La cortina tiembla.'
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
  if (actor.power !== undefined) {
    // The palace guards: one heavy fist each, guarding takes two thirds off.
    const hit = physical(actor.power, current(state, actor), current(state, target));
    const amount = changeHealth(target, -(target.guarding ? Math.ceil(hit / 3) : hit));
    state.message = `${actor.name} aplasta a ${target.name} con un puño de chicle. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
    if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; }
    return { actor: actor.id, kind: 'enemy', target: target.id, amount };
  }
  const strength = physical(state.allies.length === 1 && state.foes.length > 1 ? 5 : 9, current(state, actor), current(state, target));
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = changeHealth(target, -damage);
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
  // Once Gerard has said no the minion is shaken: plain spits, no more escalation.
  const raw = state.awakened ? 12 : state.round >= 6 ? 999 : Math.round(10 * 1.5 ** (state.round - 1));
  let amount = Math.min(target.guarding ? Math.ceil(raw / 3) : raw, target.hp);
  const awakening = !state.awakened && target.id === 'bernat' && target.hp - amount <= BEAT_HP;
  if (awakening) amount = Math.max(0, target.hp - BEAT_HP);
  amount = changeHealth(target, -amount);
  state.message = `${actor.name} escupe chicle a ${target.name}. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
  if (awakening) { state.phase = 'beat'; state.message = `${target.name} cae de rodillas. El esbirro se infla para el último golpe…`; }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/**
 * A fighter changes ánima (class) on their own turn, or takes it off with `null`. It does not
 * spend the turn: it only changes their stats and skills. PV and Secundaria keep what is left,
 * within the new maximums. Returns whether it changed.
 */
export function changeAnima(state: BattleState, allyId: string, classId: ClassId | null) {
  const ally = state.allies.find(a => a.id === allyId);
  if (state.phase !== 'player' || !ally || ally.hp <= 0 || state.allies[state.active] !== ally || (ally.classId ?? null) === classId) return false;
  const { hp, secondary } = ally;
  Object.assign(ally, fighter({ id: ally.id, name: ally.name, profile: ally.profile, classId: classId ?? undefined }));
  ally.hp = Math.min(hp, ally.maxHp); ally.secondary = Math.min(secondary, ally.maxSecondary);
  state.message = classId ? `${ally.name} cambia de ánima.` : `${ally.name} se quita el ánima.`;
  return true;
}
/** The beat is over: Gerard said no. His class wakes up and it is his turn again, with No-ta. */
export function awaken(state: BattleState, classId: ClassId) {
  if (state.phase !== 'beat') return;
  const gerard = state.allies.find(a => a.id === 'gerard')!;
  const hurt = gerard.maxHp - gerard.hp;
  Object.assign(gerard, fighter({ id: gerard.id, name: gerard.name, profile: gerard.profile, classId }));
  gerard.hp = Math.max(1, gerard.maxHp - hurt);
  if (!state.animas.includes(classId)) state.animas.push(classId);
  state.awakened = true;
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = []; state.round++;
  state.active = state.allies.indexOf(gerard); state.phase = 'player';
  state.message = 'Gerard ha dicho que no. Algo ha despertado en él: Noísta.';
}
/**
 * The end of a round: statuses do their part and fade (Sangrado hurts first, then every status
 * loses its `decay`), then the next round starts. Returns what the statuses did, in order, so the
 * fight can show it. A fight can end here: foes bled out, or the party did.
 */
export function nextRound(state: BattleState): StatusTick[] {
  if (state.phase !== 'enemy' || state.foes.some(f => f.hp > 0 && !state.enemyActions.includes(f.id))) return [];
  const ticks: StatusTick[] = [];
  for (const c of [...state.foes, ...state.allies]) {
    if (!c.statuses) continue;
    for (const id of STATUS_IDS) {
      const count = stacks(c, id), spec = STATUSES[id];
      if (!count) continue;
      const amount = spec.tick && c.hp > 0 ? changeHealth(c, -spec.tick * count) : 0;
      const left = c.hp > 0 ? Math.max(0, count - spec.decay) : 0;
      if (left) c.statuses[id] = left; else delete c.statuses[id];
      if (amount) ticks.push({ target: c.id, status: id, amount, stacks: left });
    }
  }
  if (state.foes.every(f => f.hp === 0)) { state.phase = 'won'; state.message = 'Se desploman, sin fuerzas para seguir.'; return ticks; }
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; return ticks; }
  state.round++; state.active = state.allies.findIndex(a => a.hp > 0);
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = [];
  state.phase = 'player'; state.message = 'Tu turno. Elige tu siguiente movimiento.';
  return ticks;
}
