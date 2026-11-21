/**
 * The castle's fights (docs/castle.md § Bestiary, docs/castle-bosses.md): the Queen's pupils,
 * Aurelià, the management team and La Reina Bubbaloo, with Aitor held and the artilugio. The rules
 * only: src/battle.ts calls in here at the same points it calls its other families (a fight made, a
 * blow weighed, a foe's turn, an action over, a round's end, the clock), and hands over the few
 * tools of its own these need (`CastleKit`). Pure: nothing here knows about the screen.
 *
 * Preliminary (2026-11-19): the dynamics, with first-guess numbers (src/castle.ts `CASTLE`).
 */
import { DUALS, ELEMENTS, ELEMENT_ORDER, FOE_ABILITIES, SKILLS, STATUSES, TIMED, addStatus, affinityName, elementOf, inflict, roman, stacks, woundScale,
  type Affinity, type AffinityKey, type BattleEffect, type BattleState, type ClassId, type Combatant, type Element, type FoeAbilityId, type PartySlot, type StatusId, type TimedId } from './battle.ts';
import { magical, physical, type Stats } from './stats.ts';
import { type HeldMove, AURELIA_PHASES, CASTLE, CASTLE_FIGHTS, CASTLE_NAMES, DIRECTIVAS, GUM, GUM_ORDER, HANDS, MELODY, MONTON_FORMS, REINA_PHASES, STRONG, UNDOES, gumOf, isCastle, yearOf,
  type AureliaPhase, type CastleEncounter, type CastleKind, type CastleMark, type CastleMoment, type Gum, type MontonForm, type PupilKind, type RoomEncounter, type Year } from './castle.ts';

/** What src/battle.ts lends: its own stats, PV and line-up, so a castle fight is measured as any other. */
export interface CastleKit {
  current(state: BattleState, c: Combatant): Stats;
  changeHealth(target: Combatant, delta: number): number;
  sighted(actor: Combatant, raw: number): number;
  foe(id: string, name: string, kind: CastleKind, hp?: number): Combatant;
  lineUp(party: PartySlot[], unlocked: readonly ClassId[]): Combatant[];
  seedFrom(random: () => number): number;
  /** Someone the Queen holds acting on her side, with their own kit against the party (src/battle.ts `heldAct`). */
  heldAct(state: BattleState, held: Combatant, move: HeldMove): BattleEffect | undefined;
}
type Blow = 'physical' | 'magic' | 'dual';
type Hit = (who: Combatant, power: number) => number;
type Called = NonNullable<BattleEffect['called']>;

const mark = (c: Combatant): CastleMark => c.castle ??= {};
const fight = (state: BattleState) => state.castle ??= {};
const alive = (c?: Combatant): c is Combatant => !!c && c.hp > 0;
const one = (state: BattleState, kind: CastleKind) => state.foes.find(f => f.kind === kind);
const all = (state: BattleState, kind: CastleKind) => state.foes.filter(f => f.kind === kind);
/** Who of the party can be struck: standing, and not held out of the fight (if everyone left is held, them). */
function standing(state: BattleState) {
  const up = state.allies.filter(a => a.hp > 0), free = up.filter(a => !a.castle?.held);
  return free.length ? free : up;
}
/** How much harder a pupil hits than in its first year, and out on the Meridiana at night, by its `might` too. */
const byYear = (year?: Year) => year === 3 ? CASTLE.year3 : year === 2 ? CASTLE.year2 : year === 1 ? CASTLE.year1 : 1;
const yearScale = (c: Combatant) => byYear(c.castle?.year) * (c.castle?.might ?? 1) * (c.castle?.strong ? STRONG.power : 1);
const ability = (id: FoeAbilityId) => ({ id, name: FOE_ABILITIES[id].name, ...FOE_ABILITIES[id].card ? { card: true as const } : {} });
const soak = (c: Combatant) => { c.timed = { ...c.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } }; };
/** Every status on `c` now, by id: the ones with a clock, the ones that pile up, and a Shock. */
const statusesOn = (c: Combatant): string[] => [
  ...(Object.keys(c.timed ?? {}) as TimedId[]).filter(id => c.timed?.[id]),
  ...(Object.keys(c.statuses ?? {}) as StatusId[]).filter(id => stacks(c, id) > 0),
  ...c.shock ? ['shock'] : [],
];
const statusName = (id: string) => id === 'shock' ? 'Shock' : TIMED[id as TimedId]?.name ?? STATUSES[id as StatusId]?.name ?? id;
/** Things with PV that never take a turn and never hold up the win: Aurelià's lectern, the Queen's hands, the Pompa she blows. */
export const castleProp = (c: Combatant) => c.kind === 'atril' || c.kind === 'mano' || c.kind === 'pompa';

// ——— What each is made of ———————————————————————————————————————————————————————————————
/**
 * What a layer of gum is weak to and resists (docs/castle.md § Weaknesses). Fresh, fire melts it. With
 * a filling, what undoes the filling (`UNDOES`), and it resists its own. Rancid, it breaks under
 * blows and no longer minds the fire; wet, it is soft again and the fire gets in.
 */
function gumAffinity(gum: Gum, key: AffinityKey, wet: boolean): Affinity | undefined {
  if (gum === 'fresco') return key === 'fuego' ? 'weak' : undefined;
  if (gum === 'rancio') return key === 'fisico' ? 'weak' : key === 'fuego' ? (wet ? 'weak' : 'resist') : undefined;
  return key === UNDOES[gum] ? 'weak' : key === gum ? 'resist' : undefined;
}
/** What undoes El Montón's shape: the ring for an element, and fire on a wound (it seals it). A plain blow has nothing to undo. */
const SHAPE_UNDONE: Partial<Record<MontonForm, Element>> = { ...UNDOES, sangrado: 'fuego' };
/**
 * What a castle foe is weak to or resists right now, worked out from what it is and what is on it,
 * never kept: its gum by its year (and whether it is wet), a Gemelo's strand to its twin (a spark),
 * the shape El Montón took, the folders one of Dirección carries, the layer the Queen is wrapped in,
 * the lectern's oak and brass. By element or kind of blow, never by who strikes (src/battle.ts `affinityOf`).
 */
/** Her two hands, up: the one that holds and the one that crushes. Those already in the fight stand again (a moment staged twice). */
function raiseHands(kit: CastleKit, state: BattleState) {
  for (const hand of ['sujeta', 'aplasta'] as const) {
    const id = `mano-${hand}`;
    let c = state.foes.find(x => x.id === id);
    if (!c) { c = kit.foe(id, HANDS[hand], 'mano'); state.foes.push(c); }
    c.hp = c.maxHp; c.castle = { seen: c.hp, hand };
  }
}
export function castleAffinity(c: Pick<Combatant, 'kind' | 'castle' | 'timed'>, key: AffinityKey): Affinity | undefined {
  const m = c.castle;
  if (!m) return undefined;
  const wet = !!c.timed?.mojado;
  if (c.kind === 'atril') return key === 'fuego' || key === 'electrico' ? 'weak' : undefined;
  if (c.kind === 'directiva') return (m.elements ?? []).some(e => UNDOES[e] === key) ? 'weak' : undefined;
  if (c.kind === 'reina') return m.gum ? gumAffinity(m.gum, key, wet) : undefined;
  if (!m.year) return undefined;
  if (c.kind === 'gemelo' && key === 'electrico') return 'weak';
  if (c.kind === 'monton' && m.form && SHAPE_UNDONE[m.form] === key) return 'weak';
  return gumAffinity(gumOf(m.year, m.filling), key, wet);
}
/** What a kind of blow finds in a castle foe: El Empollón knows the one it learned and not the other; rancid gum breaks under a blow. */
export function castleBlow(c: Combatant, blow: 'physical' | 'magic'): Affinity | undefined {
  if (c.kind === 'empollon' && c.castle?.learned) return c.castle.learned === blow ? 'resist' : 'weak';
  return blow === 'physical' ? castleAffinity(c, 'fisico') : undefined;
}
/** Everything a foe can be weak to (a function: src/battle.ts is still loading when this file is read). */
const keys = (): readonly AffinityKey[] => [...ELEMENT_ORDER, 'fisico'];
/** Mar presides: without her there is no Acta, and the Voto de calidad is hers alone. */
const PRESIDES: string = DIRECTIVAS[0].id;
const MOVES: Record<Element, FoeAbilityId> = { fuego: 'expediente', agua: 'horario', electrico: 'circular' };
/** Whether the Acta can be signed: Mar, and at least one of the other two. */
const quorum = (team: Combatant[]) => team.length >= 2 && team.some(d => d.id === PRESIDES);
/**
 * What each of Dirección will do in `round`, on her plate from the round before: her signature on an
 * Acta round, otherwise the move of the folder she carries (in turn, if she carries several). A
 * Resolución already announced stays.
 */
function planDireccion(state: BattleState, round: number) {
  const team = all(state, 'directiva').filter(alive), up = standing(state);
  const acta = quorum(team) && round % CASTLE.actaEvery === 0;
  team.forEach((d, i) => {
    if (d.intent?.ability === 'resolucion') return;
    const elements = d.castle?.elements ?? ['fuego'], element = elements[(d.turns ?? 0) % elements.length];
    if (acta) d.intent = { ability: 'firma' };
    else if (element !== 'fuego') d.intent = { ability: MOVES[element], at: 'todos' };
    else if (up.length) d.intent = { ability: 'expediente', target: up[(round + i) % up.length].id };
    else delete d.intent;
  });
}
/**
 * Whoever has no turn now: a thing, a Gemelo its twin is holding up, El Ausente the round it is
 * there (it struck already), El Castigado until its Rabia is full. The round never waits for them.
 */
export const castleIdle = (c: Combatant) => castleProp(c) || !!c.castle?.down
  || (c.kind === 'ausente' && !c.castle?.away) || (c.kind === 'castigado' && (c.castle?.rage ?? 0) < CASTLE.rabia);
/** La Delegada in charge: standing, and neither confused nor blinded. While she is, hers strike whom she says and their tells do not show. */
function inCharge(state: BattleState) {
  const delegada = one(state, 'delegada');
  return alive(delegada) && !delegada.timed?.confusion && !delegada.timed?.cegado ? delegada : undefined;
}
const WON: Partial<Record<CastleEncounter, string>> = {
  aurelia: 'Aurelià se queda quieto en mitad de la pista. El violeta se le va de los ojos y mira el gimnasio como si no lo hubiera visto nunca.',
  direccion: 'Las tres se sientan donde estaban, despacio. El violeta se apaga. Sobre la mesa queda un acta sin firmar.',
  reina: 'Es queda a terra, petita.',
  'reina-vuelta': 'Es queda a terra, petita. Ja no aguanta res.',
};
const MESSAGES: Partial<Record<CastleEncounter, string>> = {
  aurelia: 'Aurelià está en la tarima, detrás del atril, con los ojos violeta. No levanta la voz. Nunca le ha hecho falta.',
  direccion: 'Mar, Montse y Pilar levantan la vista del acta a la vez. Las tres tienen los ojos violeta.',
  reina: 'Baixa del tron sense pressa. Porta la cara de la Nuria Mendoza, i no és ella. No té nom: és tot el que va quedar de quan éreu petits.',
  'reina-vuelta': 'Us espera on la vau deixar. Porta els vostres cops a sobre. El Gerard estreny l\'artilugi a la butxaca.',
};
export const castleWinMessage = (state: BattleState) => WON[state.encounter as CastleEncounter] ?? 'El chicle pierde la forma y se queda en el suelo, quieto. Solo era chicle.';

// ——— A fight made ——————————————————————————————————————————————————————————————————————
function pupil(kit: CastleKit, kind: PupilKind, id: string, name: string, year: Year, random: () => number): Combatant {
  const c = kit.foe(id, name, kind), pv = Math.round(c.maxHp * byYear(year));
  c.stats = { ...c.stats, pv }; c.hp = c.maxHp = pv;
  c.castle = { year, seen: pv };
  // Its gum by its year decides what it is made of (`castleAffinity`); in the second it carries a filling, which shows.
  if (year === 2) c.castle.filling = ELEMENT_ORDER[Math.floor(random() * ELEMENT_ORDER.length)];
  if (kind === 'repetidor' && year === 1) c.shell = true;
  if (kind === 'repetidor' && year === 3) c.castle.crust = CASTLE.crust;
  // El Ausente starts out of reach; El Castigado facing the wall, calm.
  if (kind === 'ausente') c.castle.away = true;
  if (kind === 'castigado') c.castle.rage = 0;
  return c;
}
/** A castle fight as it starts: a room's pupils in their year, Aurelià behind his lectern, the three of Dirección, or the Queen. */
export function createCastleBattle(kit: CastleKit, party: PartySlot[], encounter: CastleEncounter, animas: ClassId[] | undefined, random: () => number): BattleState {
  let foes: Combatant[], message = MESSAGES[encounter];
  const castle: BattleState['castle'] = {};
  if (encounter === 'aurelia') {
    const boss = kit.foe('aurelia', CASTLE_NAMES.aurelia, 'aurelia'), atril = kit.foe('atril', CASTLE_NAMES.atril, 'atril');
    boss.castle = { phase: 'leccion', seen: boss.hp }; atril.castle = { seen: atril.hp };
    foes = [boss, atril];
  } else if (encounter === 'direccion') {
    foes = DIRECTIVAS.map(d => {
      const c = kit.foe(d.id, d.name, 'directiva');
      c.castle = { elements: [d.element], seen: c.hp };
      return c;
    });
  } else if (encounter === 'reina' || encounter === 'reina-vuelta') {
    const queen = kit.foe('reina', CASTLE_NAMES.reina, 'reina');
    queen.castle = { stage: 'chicle', seen: queen.hp };
    wrap(queen, 'fresco');
    castle.artilugio = encounter === 'reina-vuelta';
    if (encounter === 'reina-vuelta') {
      // Back with the artilugio: she is as they left her, the wounds showing, already blowing her Pompa.
      queen.hp = Math.round(queen.maxHp * CASTLE.reinaVuelta);
      queen.castle = { stage: 'pompa', seen: queen.hp };
    }
    foes = [queen];
  } else {
    const kinds = CASTLE_FIGHTS[encounter as RoomEncounter], year = yearOf(encounter), seen: Partial<Record<PupilKind, number>> = {};
    foes = kinds.map((kind, i) => {
      const n = seen[kind] = (seen[kind] ?? 0) + 1, many = kinds.filter(k => k === kind).length > 1;
      return pupil(kit, kind, `${kind}-${i}`, many ? `${kind === 'gemelo' ? 'Gemelo' : CASTLE_NAMES[kind]} ${n}` : CASTLE_NAMES[kind], year, random);
    });
    const twins = foes.filter(f => f.kind === 'gemelo');
    twins.forEach((twin, i) => { mark(twin).twin = twins[i ^ 1]?.id; });
    const who = [...new Set(kinds)].map(kind => kind === 'gemelo' ? 'Los Gemelos' : CASTLE_NAMES[kind]);
    message = `${who.length > 1 ? `${who.slice(0, -1).join(', ')} y ${who.at(-1)}` : who[0]}. Chicle con forma de alumno, la bata en los pliegues y una pompa donde iría la cara.`;
  }
  const unlocked = animas ?? [...new Set(party.flatMap(s => s.classId ? [s.classId] : []))];
  const state: BattleState = {
    allies: kit.lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: kit.seedFrom(random),
    message: message!, castle,
  };
  // Dirección say what is coming from the first round.
  if (encounter === 'direccion') planDireccion(state, 1);
  return state;
}
/**
 * A room's pupils out on the Meridiana at night (src/castle.ts `NightFight`, docs/chapter-2.md § Night
 * and the way home): the same rules, `might` times their PV and blows, and the fight is the night's
 * (`night-guard`: lost, they wake late the next morning; won, the hunt goes on).
 */
export function castleAtNight(state: BattleState, might: number): BattleState {
  for (const c of state.foes) {
    if (!c.castle) continue;
    c.castle.might = might;
    c.hp = c.maxHp = Math.round(c.maxHp * might); c.stats = { ...c.stats, pv: c.maxHp }; c.castle.seen = c.hp;
  }
  state.encounter = 'night-guard';
  state.message = `${state.foes.length > 1 ? 'Suben por la rejilla y os rodean' : 'Sube por la rejilla y os corta el paso'}, chorreando chicle: los alumnos de la Reina, aquí fuera.`;
  return state;
}
/**
 * A group of pupils come as Encarnados (src/castle.ts `STRONG`): each with more PV and a harder blow,
 * on top of its year and of the night. The fight says so (`state.strong`), which is what the story
 * pays an Eco de luz for.
 */
export function castleStrong(state: BattleState): BattleState {
  // Pupils only (they carry a year): a boss, its parts and whoever else is in a castle fight stay as they are.
  const pupils = state.foes.filter(c => c.castle?.year && !c.part);
  if (!pupils.length) return state;
  for (const c of pupils) {
    c.castle!.strong = true;
    c.hp = c.maxHp = Math.round(c.maxHp * STRONG.pv); c.stats = { ...c.stats, pv: c.maxHp }; c.castle!.seen = c.hp;
  }
  state.strong = true;
  state.message = `${state.message} Vienen encarnados: rojos por dentro, y más enteros que los demás.`;
  return state;
}
/** The Queen wraps herself in a layer of gum: what takes it off is what it is weak to (`gumAffinity`), or a dual. */
function wrap(queen: Combatant, gum: Gum) {
  const m = mark(queen);
  m.gum = gum; delete m.found;
}

// ——— A blow weighed ————————————————————————————————————————————————————————————————————
/**
 * What a castle rule does to a blow that lands on `target` (a share of it; ticks and pulses never
 * come through here). El Empollón resists the kind it took last; El Repetidor's crust; a Gemelo held
 * up by its twin and El Ausente while it is not there take nothing (what a blow lights still takes:
 * a fire, a wound); Aurelià behind his lectern takes half, and more once a question was answered;
 * the Queen's gum, her hands, and Aitor in front of her.
 */
export function castleTaken(state: BattleState, target: Combatant, blow: Blow): number {
  const m = target.castle;
  if (!m || !isCastle(target.kind)) return 1;
  const wet = !!target.timed?.mojado;
  // Wet, El Ausente shows where it is.
  if (m.down || (m.away && !wet)) return 0;
  // What it learned it resists; the other kind it does not know (a dual is neither).
  if (target.kind === 'empollon') return !m.learned || blow === 'dual' ? 1 : m.learned === blow ? CASTLE.learned : CASTLE.noSabe;
  // The crust gives while it is wet.
  if (target.kind === 'repetidor') return m.crust && !wet ? CASTLE.crusted : 1;
  if (target.kind === 'aurelia') return (alive(one(state, 'atril')) ? CASTLE.atril : 1) * (m.exposed ? CASTLE.expuesto : 1);
  if (target.kind === 'reina') {
    if (m.stage === 'aitor') return 0;
    const hands = all(state, 'mano').filter(alive).length, bubble = all(state, 'pompa').some(alive);
    return (m.gum ? CASTLE.gum : 1) * Math.max(0, 1 - CASTLE.mano * hands) * (bubble ? CASTLE.pompaTras : 1);
  }
  return 1;
}

// ——— A foe's turn ——————————————————————————————————————————————————————————————————————
/**
 * A castle foe's turn, every move named. Returns false for a thing with no turn (the lectern, a hand)
 * or one that loses it. `hit` is the fight's own blow (stats, Cegado, holding on); La Chivata's mark
 * makes the next one on whoever carries it land harder.
 */
export function castleTurn(kit: CastleKit, state: BattleState, actor: Combatant, aimed: Combatant, effect: BattleEffect, hit: Hit): boolean {
  if (castleIdle(actor)) return false;
  actor.turns = (actor.turns ?? 0) + 1;
  const up = standing(state), called: Called = [];
  const use = (id: FoeAbilityId) => { effect.ability = ability(id); };
  const scale = yearScale(actor);
  const strike: Hit = (who, power) => {
    const marked = who.castle?.marked;
    if (marked) { delete who.castle!.marked; called.push({ target: who.id, text: `×${CASTLE.chivatazo}`, detail: 'Chivatazo' }); }
    return hit(who, Math.round(power * scale * (marked ? CASTLE.chivatazo : 1)));
  };
  const spell: Hit = (who, power) => {
    const raw = kit.sighted(actor, magical(Math.round(power * scale), kit.current(state, actor), kit.current(state, who)));
    return kit.changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const everyone = (blow: Hit, power: (who: Combatant) => number, main: Combatant) => {
    effect.target = main.id; effect.amount = blow(main, power(main));
    effect.splash = up.filter(a => a !== main).map(a => ({ target: a.id, amount: blow(a, power(a)) }));
  };
  const announce = (id: FoeAbilityId, target?: Combatant) => {
    actor.intent = target ? { ability: id, target: target.id } : { ability: id, at: 'todos' };
    effect.telegraph = { id, name: FOE_ABILITIES[id].name, ...target ? { target: target.id } : { at: 'todos' as const } };
  };
  const named = (intent: Combatant['intent']) => up.find(a => a.id === intent?.target);
  /** What a filling leaves on whoever its blow lands on: a fire, water, or a spark that finds them wet (their next turn lost). */
  const fill = (element: Element, who?: Combatant): string => {
    if (!alive(who)) return '';
    if (element === 'fuego') { const fire = inflict(who, 'quemado'); if (who.id === effect.target) effect.burn = { id: 'quemado', level: fire.level }; return ` ${who.name} arde.`; }
    if (element === 'agua') { soak(who); return ` ${who.name} queda mojado.`; }
    if (!who.timed?.mojado) return '';
    delete who.timed.mojado; who.shock = true; effect.shocked = [...effect.shocked ?? [], who.id];
    return ` La chispa encuentra mojado a ${who.name}: pierde su siguiente turno.`;
  };
  // Whom La Delegada said, if she is in charge; otherwise whom the fight aimed at, if they can be struck.
  const boss = inCharge(state), ordered = boss && actor !== boss ? up.find(a => a.id === state.castle?.focus) : undefined;
  let target = ordered ?? (up.includes(aimed) ? aimed : up[0]);
  effect.target = target.id;

  if (actor.kind === 'repetidor') {
    const due = actor.intent; delete actor.intent;
    if (due) {
      target = named(due) ?? target; effect.target = target.id;
      use('empujon'); effect.amount = strike(target, CASTLE.empujon);
      state.message = `${actor.name} carga con todo el cuerpo contra ${target.name}. −${effect.amount} PV.`;
    } else {
      use('empujon'); announce('empujon', target); delete effect.target;
      state.message = `${actor.name} retrocede dos pasos, despacio, y se queda mirando a ${target.name}.`;
    }
  } else if (actor.kind === 'empollon') {
    use('repaso'); effect.amount = strike(target, CASTLE.repaso);
    state.message = `${actor.name} repite el golpe de ${target.name}, igual, y se lo devuelve. −${effect.amount} PV.`;
  } else if (actor.kind === 'chivata') {
    // She points at whoever a big blow is already coming for; with nobody marked she marks, otherwise she pinches.
    const coming = state.foes.map(f => alive(f) ? named(f.intent) : undefined).find(Boolean);
    // Blinded, she cannot point at anyone.
    const blind = !!actor.timed?.cegado, free = !up.some(a => a.castle?.marked);
    if (blind && free) called.push({ target: actor.id, text: 'No ve a quién', detail: 'Cegada no señala' });
    if (free && !blind) {
      const who = coming ?? target;
      mark(who).marked = true; use('chivatazo'); effect.target = who.id; effect.amount = 0;
      called.push({ target: who.id, text: 'Chivatazo', detail: `El siguiente golpe, ×${CASTLE.chivatazo}` });
      state.message = `${actor.name} señala a ${who.name} sin decir nada. El siguiente golpe que reciba hará el triple.`;
    } else {
      use('pellizco'); effect.amount = strike(target, CASTLE.senalar);
      state.message = `${actor.name} pellizca a ${target.name} y se aparta. −${effect.amount} PV.`;
    }
  } else if (actor.kind === 'gemelo') {
    use('codazo'); effect.amount = strike(target, CASTLE.gemelo);
    state.message = `${actor.name} golpea a ${target.name}. −${effect.amount} PV.`;
  } else if (actor.kind === 'delegada') {
    // She says whom, out loud, and strikes first: the weakest of them standing.
    const weakest = up.reduce((low, a) => a.hp < low.hp ? a : low);
    fight(state).focus = weakest.id; target = weakest; effect.target = target.id;
    use('orden'); effect.amount = strike(target, CASTLE.orden);
    called.push({ target: target.id, text: 'A ese', detail: 'Todos golpean al mismo' });
    state.message = `${actor.name} señala a ${target.name}. «A ese». −${effect.amount} PV.`;
  } else if (actor.kind === 'ausente') {
    // It was there all along: it strikes, and stays where it can be reached until the next round is over.
    const m = mark(actor);
    use('presente'); effect.amount = strike(target, CASTLE.presente);
    m.away = false; m.back = state.round;
    called.push({ target: actor.id, text: 'Presente', detail: 'Se le puede pegar la ronda que viene' });
    state.message = `«Presente». ${actor.name} estaba detrás de ${target.name}, y nadie lo había visto. −${effect.amount} PV.`;
  } else if (actor.kind === 'castigado') {
    // Its Rabia full: it turns round and bursts on everyone, then goes back to the wall.
    mark(actor).rage = 0;
    use('revienta'); everyone(strike, () => CASTLE.revienta, target);
    called.push({ target: actor.id, text: 'Revienta', detail: 'Vuelve a la pared' });
    state.message = `${actor.name} se da la vuelta y revienta sobre todos. −${effect.amount} PV a ${target.name}. Luego vuelve a la pared.`;
  } else if (actor.kind === 'monton') {
    montonTurn();
  } else if (actor.kind === 'aurelia') {
    aureliaTurn();
  } else if (actor.kind === 'directiva') {
    directivaTurn();
  } else if (actor.kind === 'reina') {
    if (actor.castle?.stunned) {
      delete actor.castle.stunned; delete effect.target;
      state.message = `${actor.name} se queda quieta. Pierde el turno.`;
      effect.called = [{ target: actor.id, text: 'Sin turno' }];
      return true;
    }
    reinaTurn();
  }
  // A second-year pupil hits with what it carries inside.
  const filling = actor.castle?.filling;
  if (filling && (effect.amount ?? 0) > 0) state.message += [effect.target, ...(effect.splash ?? []).map(hit => hit.target)].map(id => fill(filling, up.find(a => a.id === id))).join('');
  if (called.length) effect.called = [...effect.called ?? [], ...called];
  if (!effect.splash?.length) delete effect.splash;
  forsaken(state);
  return true;

  /**
   * El Montón: shapeless, it leans on one. Shaped, it gives back the first blow it took, as hard as
   * that blow was (`montonCopy`), to one or to everyone as that blow reached, and with what it
   * carried: a fire on whoever it strikes, water on everyone, a shock that costs a turn, or a wound
   * (a blow on someone bleeding opens the old one first).
   */
  function montonTurn() {
    const m = mark(actor), form = m.form;
    if (!form) {
      use('arrimarse'); effect.amount = strike(target, CASTLE.arrimarse);
      state.message = `${actor.name} se os arrima, todavía sin forma. −${effect.amount} PV a ${target.name}.`;
      return;
    }
    // The copy: what it took, as it took it; La Chivata's mark and holding on count as for any blow.
    const copy: Hit = who => {
      const marked = who.castle?.marked, bled = form === 'sangrado' ? stacks(who, 'sangrado') : 0;
      if (marked) { delete who.castle!.marked; called.push({ target: who.id, text: `×${CASTLE.chivatazo}`, detail: 'Chivatazo' }); }
      if (bled) delete who.statuses!.sangrado;
      const raw = kit.sighted(actor, Math.max(1, Math.round(montonCopy(actor) * (marked ? CASTLE.chivatazo : 1) * woundScale(bled))));
      return kit.changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
    };
    use('copia');
    // What the copy leaves on each one it reaches.
    const leave = (who: Combatant): string => {
      if (!alive(who)) return '';
      if (form === 'agua') { who.timed = { ...who.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } }; return ''; }
      if (form === 'fuego') { const fire = inflict(who, 'quemado'); if (who === target) effect.burn = { id: 'quemado', level: fire.level }; return fire.level > 1 ? ` ${who.name}: ${TIMED.quemado.name} ${roman(fire.level)}.` : ` ${who.name} arde.`; }
      if (form === 'electrico') { who.shock = true; effect.shocked = [...effect.shocked ?? [], who.id]; return ` ${who.name} queda en shock: pierde su siguiente turno.`; }
      if (form === 'sangrado') { const n = addStatus(who, 'sangrado', CASTLE.sangre); if (who === target) effect.status = { id: 'sangrado', stacks: n }; return ` ${who.name}: Sangrado ${n}.`; }
      return '';
    };
    const wide = m.all || form === 'agua';
    if (wide) everyone(copy, () => 0, target); else effect.amount = copy(target, 0);
    const after = (wide ? up : [target]).map(leave).join('');
    state.message = wide
      ? `${actor.name} copia el golpe y os lo devuelve a todos. −${effect.amount} PV a ${target.name}.${form === 'agua' ? ' Mojados.' : ''}${after}`
      : `${actor.name} copia el golpe y se lo devuelve a ${target.name}. −${effect.amount} PV.${after}`;
  }
  /** Aurelià: each turn he does what he announced and announces what comes next, by his phase. */
  function aureliaTurn() {
    const m = mark(actor), phase = m.phase ?? 'leccion', atril = alive(one(state, 'atril'));
    const due = actor.intent; delete actor.intent;
    let said = '';
    if (due?.ability === 'dictado') {
      use('dictado'); everyone(strike, () => CASTLE.dictado, target);
      said = `«Copiad». ${actor.name} dicta sin mirar a nadie, y cada palabra pesa. −${effect.amount} PV a ${target.name}.`;
    } else if (due?.ability === 'pregunta') {
      target = named(due) ?? target; effect.target = target.id;
      const ready = target.guarding;
      use('pregunta'); effect.amount = strike(target, CASTLE.pregunta);
      said = `«${target.name}. De pie». La pregunta cae sobre ${target.name}. −${effect.amount} PV.`;
      if (ready && alive(target)) {
        m.exposed = true; called.push({ target: actor.id, text: 'Respuesta correcta', detail: `El siguiente golpe, ×${CASTLE.expuesto}` });
        said += ' Respuesta correcta: se queda sin palabras un momento.';
      }
    } else if (due?.ability === 'castigo') {
      const repeater = up.find(a => { const b = a.castle?.blows ?? []; return b.length >= 2 && b.at(-1)!.kind === b.at(-2)!.kind && b.at(-1)!.round === b.at(-2)!.round + 1; });
      target = repeater ?? target; effect.target = target.id;
      use('castigo'); effect.amount = strike(target, repeater ? CASTLE.castigo : CASTLE.castigoLeve);
      said = repeater ? `«Otra vez lo mismo». Castigo para ${target.name}. −${effect.amount} PV.` : `${actor.name} golpea el suelo con la regla ante ${target.name}. −${effect.amount} PV.`;
    } else if (due?.ability === 'expulsion') {
      target = named(due) ?? target; effect.target = target.id;
      // Whoever holds on stays in the room.
      const stays = target.guarding;
      use('expulsion'); effect.amount = strike(target, CASTLE.expulsion);
      said = `«Fuera de mi clase». −${effect.amount} PV a ${target.name}.`;
      if (stays && alive(target)) {
        called.push({ target: target.id, text: 'Se queda', detail: 'Aguanta en su sitio' });
        said += ` ${target.name} no se mueve de su sitio.`;
      } else if (alive(target) && up.length > 1) {
        mark(target).expelled = CASTLE.expulsado; called.push({ target: target.id, text: 'Expulsado', detail: `${CASTLE.expulsado} rondas fuera` });
        said += ` ${target.name} se queda fuera ${CASTLE.expulsado} rondas.`;
      }
    } else if (due?.ability === 'record') {
      m.record = (m.record ?? CASTLE.recordRounds) - 1;
      if (m.record > 0) {
        use('record'); actor.intent = due; delete effect.target;
        said = `${actor.name} sigue tomando carrerilla al fondo de la pista.`;
        state.message = said; return;
      }
      delete m.record;
      use('record'); everyone(strike, () => CASTLE.record, target);
      said = `Récord. ${actor.name} cruza la pista entera y se os lleva por delante. −${effect.amount} PV a ${target.name}.`;
    } else {
      delete effect.target;
      said = `${actor.name} os mira por encima de las gafas.`;
    }
    const cycle: FoeAbilityId[] = phase === 'leccion' ? [...atril ? ['dictado' as const] : [], 'pregunta', 'castigo'] : phase === 'carrera' ? ['pregunta', 'castigo'] : ['expulsion', 'record'];
    const next = cycle[(actor.turns! - 1) % cycle.length], whom = up.filter(alive);
    if (whom.length) {
      const at = whom[(state.round + actor.turns!) % whom.length];
      if (next === 'dictado' || next === 'record' || next === 'castigo') { announce(next); if (next === 'castigo') actor.intent = { ability: 'castigo' }; }
      else announce(next, at);
      if (next === 'record') m.record = CASTLE.recordRounds;
      said += next === 'pregunta' ? ` Mira a ${at.name}: le va a preguntar.` : next === 'dictado' ? ' Abre el cuaderno sobre el atril.' : next === 'castigo' ? ' Coge la regla.'
        : next === 'expulsion' ? ` Señala la puerta y mira a ${at.name}.` : ' Se va al fondo de la pista y clava los pies.';
    }
    if (!effect.ability) use(next);
    state.message = said;
  }
  /**
   * One of Dirección: she does what her plate said (`planDireccion`): her signature on an Acta round,
   * otherwise the move of the folder she carries. Struck with what undoes it, she has lost that move.
   */
  function directivaTurn() {
    const m = mark(actor), team = all(state, 'directiva').filter(alive), f = fight(state);
    const last = team.length === 1, casting = last && actor.id === PRESIDES, power = (base: number) => base * (casting ? CASTLE.voto : 1);
    const due = actor.intent; delete actor.intent;
    if (m.overruled) {
      delete m.overruled; delete effect.target;
      called.push({ target: actor.id, text: 'Desautorizada', detail: 'Pierde el turno' });
      state.message = `${actor.name} busca en la carpeta lo que iba a leer. Ya no está. Pierde el turno.`;
      return;
    }
    // The Acta closed last round: whoever signed last reads out the Resolución, if there is still quorum.
    if (due?.ability === 'resolucion') {
      f.firmas = 0; for (const d of team) delete d.castle!.signed;
      use('resolucion'); everyone(spell, () => CASTLE.resolucion, target);
      state.message = `Resolución: lo que dice el acta, se cumple. −${effect.amount} PV a ${target.name}.`;
      return;
    }
    if (due?.ability === 'firma' && quorum(team) && !m.signed) {
      delete effect.target;
      if (actor.timed?.cegado) {
        use('firma');
        called.push({ target: actor.id, text: 'No firma', detail: 'No ve el papel' });
        state.message = `${actor.name} busca el acta a tientas. No firma.`;
        return;
      }
      m.signed = true; f.firmas = (f.firmas ?? 0) + 1;
      if (f.firmas < team.length) {
        use('firma');
        called.push({ target: actor.id, text: `Firma ${f.firmas}/${team.length}` });
        state.message = `${actor.name} firma el acta. Firma ${f.firmas} de ${team.length}.`;
        return;
      }
      // The last one: the Acta is closed, and its Resolución comes on her next turn. Holding on takes two thirds off; without quorum it is void.
      use('firma'); announce('resolucion');
      called.push({ target: actor.id, text: `Firma ${f.firmas}/${team.length}`, detail: 'Resolución en su próximo turno' });
      state.message = `${actor.name} firma la última. El acta está cerrada: en su próximo turno, Resolución para todos.`;
      return;
    }
    const elements = m.elements ?? ['fuego'];
    const element: Element = due?.ability === 'expediente' ? 'fuego' : due?.ability === 'horario' ? 'agua' : due?.ability === 'circular' ? 'electrico' : elements[(actor.turns! - 1) % elements.length];
    if (due?.target) { target = named(due) ?? target; effect.target = target.id; }
    if (element === 'fuego') {
      use('expediente'); effect.amount = spell(target, power(CASTLE.expediente));
      if (alive(target)) { const fire = inflict(target, 'quemado'); effect.burn = { id: 'quemado', level: fire.level }; }
      state.message = `${actor.name} abre un expediente a nombre de ${target.name}. Arde. −${effect.amount} PV.`;
    } else if (element === 'agua') {
      use('horario'); everyone(spell, () => power(CASTLE.horario), target);
      for (const a of up.filter(alive)) soak(a);
      state.message = `${actor.name} reparte el horario nuevo. Os cae encima como un cubo de agua. Mojados.`;
    } else {
      const wet = new Set(up.filter(a => a.timed?.mojado).map(a => a.id));
      use('circular'); everyone(spell, who => power(CASTLE.circular) * (wet.has(who.id) ? CASTLE.conducida : 1), target);
      for (const a of up) if (wet.has(a.id) && a.timed) delete a.timed.mojado;
      state.message = `${actor.name} hace circular la corriente${wet.size ? ': en los mojados prende entera' : ''}. −${effect.amount} PV a ${target.name}.`;
    }
    if (last) state.message = `${casting ? 'Voto de calidad' : 'En funciones'}. ${state.message}`;
  }
  /** The Queen, by her stage: the gum, her hands, La Pompa, and Aitor's hand against Gerard. */
  function reinaTurn() {
    const m = mark(actor), stage = m.stage ?? 'chicle', hands = all(state, 'mano');
    if (stage === 'aitor') {
      const aitor = state.allies.find(a => a.castle?.held === 'reina'), gerard = up.find(a => a !== aitor);
      if (!aitor || !gerard) { delete effect.target; state.message = `${actor.name} espera.`; return; }
      use('suyo'); effect.target = gerard.id;
      // Every turn she has him he hits harder: without the artilugio this only ends one way.
      const grows = 1 + CASTLE.aitorGrows * (actor.turns! - 1);
      const move = state.castle?.aitorMove; if (state.castle) delete state.castle.aitorMove;
      // Player 2 plays him, on her side, with his own kit (docs/castle-bosses.md § Aitor, held).
      if (move) {
        const before = gerard.hp, done = kit.heldAct(state, aitor, move), hurt = before - gerard.hp;
        if (done && hurt > 0) {
          const extra = gerard.hp > 0 ? kit.changeHealth(gerard, -Math.round(hurt * (grows - 1))) : 0;
          effect.actor = aitor.id; effect.amount = hurt - extra;
          if (done.skill) effect.skill = done.skill;
          state.message = `Aitor, con los ojos violeta, ${move.action === 'skill' && done.skill ? `usa ${SKILLS.find(s => s.id === done.skill)?.name ?? 'lo que sabe'} contra` : 'golpea a'} ${gerard.name}. −${effect.amount} PV.`;
          forsaken(state);
          return;
        }
        // Whatever he chose that does not hurt Gerard, the thread of gum pulls his arm anyway.
        if (done) state.message = 'Aitor duda. ';
      }
      const raw = physical(Math.round(CASTLE.aitor * grows), kit.current(state, aitor), kit.current(state, gerard));
      effect.amount = kit.changeHealth(gerard, -(gerard.guarding ? Math.ceil(raw / 3) : raw));
      state.message = `${move ? 'Aitor duda. El hilo de chicle tira de su brazo y' : 'Aitor, con los ojos violeta,'} golpea a ${gerard.name} con todo lo que sabe. −${effect.amount} PV.`;
      forsaken(state);
      return;
    }
    const grip = hands.filter(alive), holder = grip.find(h => h.castle?.hand === 'sujeta'), crusher = grip.find(h => h.castle?.hand === 'aplasta');
    /** What her hands will do on her next turn, said now: the one that holds reaches for someone, or the other comes down. */
    const tell = (after?: FoeAbilityId) => {
      const whom = standing(state).filter(a => alive(a) && !a.castle?.held), caught = state.allies.some(a => a.castle?.held && a.castle.held !== 'reina');
      const next = holder && alive(holder) && !caught && whom.length > 1 && after !== 'atrapar' ? 'atrapar' as const : crusher && alive(crusher) ? 'aplastar' as const : undefined;
      if (next && whom.length) announce(next, whom[(state.round + actor.turns!) % whom.length]);
    };
    if (stage === 'manos' && !m.raised) {
      // Her two hands come out of the floor: each a thing to break, each taking a share of what reaches her. One holds, the other crushes.
      raiseHands(kit, state); m.raised = true;
      use('manos'); delete effect.target;
      called.push({ target: actor.id, text: REINA_PHASES.manos });
      state.message = 'Del suelo salen dos manos de chicle, cada una del tamaño de una puerta. Una se abre. La otra se cierra en un puño.';
      // And she says at once what the first of them is going to do.
      const whom = up.filter(alive);
      if (whom.length) announce(whom.length > 1 ? 'atrapar' : 'aplastar', whom[(state.round + actor.turns!) % whom.length]);
      return;
    }
    if (stage === 'pompa') {
      const bubble = state.foes.find(x => x.id === m.pompa?.id);
      if (!m.pompa) {
        // La Pompa is a thing in front of her, with its own PV: burst before it is full, it is hers to take.
        const b = kit.foe(`pompa-${all(state, 'pompa').length + 1}`, CASTLE_NAMES.pompa, 'pompa');
        b.castle = { seen: b.hp }; state.foes.push(b);
        m.pompa = { left: CASTLE.pompaRounds, id: b.id };
        use('pompa'); announce('pompa'); delete effect.target;
        state.message = `${actor.name} empieza a hinchar una pompa delante de ella. Crece despacio y lo va tapando todo.`;
        return;
      }
      m.pompa.left -= 1;
      if (m.pompa.left > 0) {
        use('pompa'); delete effect.target;
        state.message = `La pompa sigue creciendo. ${m.pompa.left === 1 ? 'Ya no cabe más aire.' : 'Se le ve la piel tensa.'}`;
        return;
      }
      delete m.pompa; delete actor.intent;
      if (bubble) { bubble.hp = 0; mark(bubble).told = true; mark(bubble).seen = 0; }
      use('pompa'); everyone(spell, () => CASTLE.pompaBlow, target);
      state.message = `La Pompa revienta sobre todos. −${effect.amount} PV a ${target.name}.`;
      return;
    }
    if (stage === 'manos') {
      // Each turn her hands do what she said, and she says what comes next.
      const due = actor.intent; delete actor.intent;
      const caught = state.allies.some(a => a.castle?.held && a.castle.held !== 'reina');
      if (due?.ability === 'atrapar' && holder) {
        target = named(due) ?? target; effect.target = target.id;
        use('atrapar'); effect.amount = 0;
        if (target.guarding) {
          called.push({ target: target.id, text: 'No lo coge', detail: 'Aguanta en el suelo' });
          state.message = `La ${holder.name.toLowerCase()} se cierra sobre ${target.name}, que se agarra al suelo. No lo levanta.`;
        } else if (up.length > 1 && !caught) {
          mark(target).held = holder.id;
          called.push({ target: target.id, text: 'Atrapado', detail: 'Hasta romper esa mano' });
          state.message = `La ${holder.name.toLowerCase()} se cierra sobre ${target.name} y lo levanta del suelo. Fuera del combate hasta que se rompa.`;
        } else state.message = `La ${holder.name.toLowerCase()} se cierra en el aire.`;
      } else if (due?.ability === 'aplastar' && crusher) {
        target = named(due) ?? target; effect.target = target.id;
        use('aplastar'); effect.amount = strike(target, CASTLE.aplastar);
        state.message = `La ${crusher.name.toLowerCase()} cae sobre ${target.name}. −${effect.amount} PV.`;
      } else {
        use('pegote'); effect.amount = strike(target, CASTLE.pegote);
        state.message = `${actor.name} lanza un pegote contra ${target.name}. −${effect.amount} PV.`;
      }
      tell(due?.ability);
      return;
    }
    if (stage === 'chicle' && !m.gum) {
      // Bare: she spends the turn wrapping herself in the next of her five. One torn off never comes back.
      const next = GUM_ORDER.find(gum => !(m.peeled ?? []).includes(gum));
      if (next) {
        wrap(actor, next); use('envolver'); delete effect.target;
        called.push({ target: actor.id, text: GUM[next] });
        state.message = `${actor.name} se envuelve en otra capa. ${next === 'rancio' ? 'Esta es vieja, gris, agrietada.' : next === 'fresco' ? 'Esta es fresca y brilla.' : `Esta lleva algo dentro: ${ELEMENTS[next].name.toLowerCase()}.`}`;
        return;
      }
    }
    use('pegote'); effect.amount = strike(target, CASTLE.pegote);
    state.message = `${actor.name} lanza un pegote contra ${target.name}. −${effect.amount} PV.`;
    // Wrapped in a layer with a filling, her gum carries it.
    if (m.gum && m.gum !== 'fresco' && m.gum !== 'rancio' && effect.amount > 0) state.message += fill(m.gum, target);
  }
}

// ——— An action over ————————————————————————————————————————————————————————————————————
/** Everyone still standing is held (Gerard down with Aitor hers, or the last one free in a hand): nobody is left on their side. */
function forsaken(state: BattleState) {
  if (state.allies.some(a => a.castle?.held) && state.allies.every(a => a.hp <= 0 || a.castle?.held)) for (const a of state.allies) a.hp = 0;
}
/** The kind of blow a party action was, if it was one. */
function blowOf(effect?: BattleEffect): Blow | undefined {
  if (!effect || effect.kind === 'enemy') return undefined;
  if (effect.dual) return 'dual';
  if (effect.kind === 'attack') return 'physical';
  const skill = effect.kind === 'skill' ? SKILLS.find(s => s.id === effect.skill) : undefined;
  return skill?.kind === 'magic' ? 'magic' : skill?.kind === 'physical' ? 'physical' : undefined;
}
/** The element a party action landed with: Atacar's, a skill's or a dual's (Foc Binari is fire). */
function elementIn(effect?: BattleEffect): Element | undefined {
  if (!effect) return undefined;
  const dual = effect.dual ? DUALS.find(d => d.id === effect.dual!.id) : undefined, skill = effect.skill ? SKILLS.find(s => s.id === effect.skill) : undefined;
  return effect.element ?? elementOf(dual ?? skill);
}
/** What El Montón gives back with each copy: the blow it took, and its year on top. */
export const montonCopy = (c: Combatant) => Math.round((c.castle?.copied ?? 0) * CASTLE.copia * yearScale(c));
/** Whether a party action was aimed at `c` or reached it (a blow on everyone). */
const reached = (effect: BattleEffect | undefined, c: Combatant) => !!effect && (effect.hits ? effect.hits.some(h => h.target === c.id) : effect.target === c.id);
/**
 * What a blow carried, for El Montón's shape: the element it landed with (Atacar's, a skill's or a
 * dual's: Foc Binari and Zarpazos de fuego are fire), else a wound it opened, else nothing.
 */
export function carried(effect: BattleEffect): MontonForm {
  const skill = effect.skill ? SKILLS.find(s => s.id === effect.skill) : undefined;
  const element = elementIn(effect);
  if (element) return element;
  if ((skill && 'bleed' in skill) || effect.status?.id === 'sangrado' || effect.hits?.some(h => h.status?.id === 'sangrado')) return 'sangrado';
  return 'golpe';
}
/**
 * After anything that can take PV off (an action, a tick, a pulse, a round's end): what the castle's
 * rules make of it. With an `effect` it is told there; without one, as news (`takeNews`).
 */
export function castleAfter(kit: CastleKit, state: BattleState, effect?: BattleEffect) {
  if (!state.foes.some(f => isCastle(f.kind))) return;
  const called: Called = [], said: string[] = [], blow = blowOf(effect), f = fight(state);
  const actor = blow ? state.allies.find(a => a.id === effect!.actor) : undefined;
  const hurtNow = (c: Combatant) => c.castle?.seen !== undefined && c.hp < c.castle.seen;
  // What each of the party did this round, for Castigo: the kind of their blow, round by round.
  if (actor && (blow === 'physical' || blow === 'magic')) {
    const blows = (mark(actor).blows ?? []).filter(b => b.round !== state.round);
    mark(actor).blows = [...blows, { round: state.round, kind: blow }].slice(-2);
  }
  // A blow found what its target is weak to: its plate keeps it.
  const found = [...effect?.affinity && effect.target ? [effect.target] : [], ...(effect?.hits ?? []).flatMap(h => h.affinity ? [h.target] : []), ...(effect?.kinds ?? []).map(k => k.target)];
  for (const id of found) { const c = state.foes.find(x => x.id === id); if (c?.castle) c.castle.found = true; }
  // Whom this blow found weak to its element: what Dirección's folders and the Queen's gum give way to.
  const weakened = new Set([...effect?.affinity === 'weak' && effect.target ? [effect.target] : [], ...(effect?.hits ?? []).flatMap(h => h.affinity === 'weak' ? [h.target] : [])]);
  // Los Gemelos hold each other by the smock: a spark on one passes to the other.
  if (blow && elementIn(effect) === 'electrico') for (const c of state.foes) {
    const m = c.castle, twin = m?.twin ? state.foes.find(x => x.id === m.twin) : undefined;
    if (c.kind !== 'gemelo' || !m || !alive(twin) || twin.castle?.down || m.down || m.seen === undefined || c.hp >= m.seen || !reached(effect, c) || reached(effect, twin)) continue;
    const passed = kit.changeHealth(twin, -Math.max(1, Math.round((m.seen - c.hp) * CASTLE.salto)));
    called.push({ target: twin.id, text: 'Pasa al otro', detail: `−${passed} PV` });
    said.push(`La chispa pasa de ${c.name} a ${twin.name} por la bata. −${passed} PV.`);
  }

  for (const c of state.foes) {
    const m = c.castle;
    if (!m) continue;
    // Confused, El Empollón forgets what it had learned, and learns nothing.
    if (c.kind === 'empollon' && alive(c) && m.learned && c.timed?.confusion) {
      delete m.learned;
      called.push({ target: c.id, text: 'Se le olvida', detail: 'Ya no resiste nada' });
      said.push(`${c.name} se queda en blanco: lo que se había aprendido, se le ha ido.`);
    }
    if (c.kind === 'empollon' && alive(c) && hurtNow(c) && !c.timed?.confusion && (blow === 'physical' || blow === 'magic') && m.learned !== blow) {
      m.learned = blow;
      called.push({ target: c.id, text: 'Se lo aprende', detail: blow === 'magic' ? 'Resiste la magia' : 'Resiste los golpes' });
      said.push(`${c.name} se aprende ${blow === 'magic' ? 'la magia' : 'el golpe'}: el siguiente igual le hará mucho menos.`);
    }
    // El Ausente is not there: the blow goes through where it was (a fire or a wound it carried still takes).
    if (c.kind === 'ausente' && m.away && !c.timed?.mojado && alive(c) && blow && reached(effect, c)) {
      called.push({ target: c.id, text: 'No está', detail: 'Solo la ronda después de su golpe' });
      said.push(`El golpe pasa por donde estaba ${c.name}. No hay nadie.`);
    }
    // El Castigado: every blow that does not fell it is a point of Rabia; full, it bursts on its turn.
    if (c.kind === 'castigado' && alive(c) && hurtNow(c) && blow) {
      m.rage = Math.min(CASTLE.rabia, (m.rage ?? 0) + 1);
      const full = m.rage >= CASTLE.rabia;
      called.push({ target: c.id, text: `Rabia ${m.rage}/${CASTLE.rabia}`, ...full ? { detail: 'Revienta en su turno' } : {} });
      said.push(full ? `${c.name} se tensa entero contra la pared. En su turno se dará la vuelta.` : `${c.name} aprieta los puños contra la pared.`);
    }
    // El Montón takes the shape of the first blow that lands on it: what it carried, and how hard it was.
    if (c.kind === 'monton' && !m.form && alive(c) && hurtNow(c) && blow) {
      m.form = carried(effect!); m.copied = m.seen! - c.hp;
      if ((effect!.hits?.length ?? 0) > 1) m.all = true;
      called.push({ target: c.id, text: `Forma: ${MONTON_FORMS[m.form]}`, detail: `Lo devolverá${m.all || m.form === 'agua' ? ' a todos' : ''}: ${montonCopy(c)}` });
      said.push(`${c.name} toma la forma del golpe. ${m.form === 'golpe' ? 'Solo eso: un golpe.' : `Lleva ${MONTON_FORMS[m.form].toLowerCase()} dentro.`}`);
    }
    if (c.kind === 'repetidor' && m.crust && alive(c) && hurtNow(c) && (blow === 'physical' || blow === 'dual')) {
      m.crust -= 1;
      if (!m.crust) { delete m.crust; called.push({ target: c.id, text: 'Se agrieta', detail: 'Sin costra' }); said.push(`La costra de ${c.name} salta a trozos.`); }
    }
    if (c.kind === 'gemelo' && c.hp <= 0 && !m.told) {
      const twin = state.foes.find(x => x.id === m.twin);
      if (twin && twin.hp > 0 && !twin.castle?.down) {
        // Brought down alone: its twin holds it up, and gets it back on its feet when the round ends.
        c.hp = 1; m.down = true; delete c.intent; delete c.statuses; delete c.timed;
        called.push({ target: c.id, text: 'Caído', detail: 'Su gemelo lo levanta al acabar la ronda' });
        said.push(`${c.name} cae, pero el otro lo sostiene de la bata. Si sigue en pie al acabar la ronda, lo levanta.`);
      } else {
        m.told = true;
        if (twin?.castle?.down) { twin.hp = 0; twin.castle.told = true; delete twin.castle.down; said.push('Caen los dos a la vez. Nadie levanta a nadie.'); }
      }
    }
    // A second-year pupil falls and its filling spills on the others: a fire, water, or a spark through whoever of them is wet.
    if (m.filling && c.hp <= 0 && !m.down && !m.spilled) {
      m.spilled = true;
      const others = state.foes.filter(x => x !== c && alive(x) && !!x.castle?.year && !x.castle.down);
      const reached = m.filling === 'electrico' ? others.filter(x => x.timed?.mojado) : others;
      for (const x of reached) {
        if (m.filling === 'fuego') inflict(x, 'quemado');
        else if (m.filling === 'agua') soak(x);
        else { kit.changeHealth(x, -Math.min(x.hp, CASTLE.derrame)); if (!x.timed!.agua) delete x.timed!.mojado; if (x.hp > 0) x.shock = true; }
        called.push({ target: x.id, text: 'Se derrama', detail: m.filling === 'fuego' ? 'Arde' : m.filling === 'agua' ? 'Mojado' : `−${CASTLE.derrame} PV · pierde el turno` });
      }
      if (reached.length) said.push(`El relleno de ${c.name} se derrama sobre ${reached.length > 1 ? 'los demás' : reached[0].name}: ${m.filling === 'fuego' ? 'arden' : m.filling === 'agua' ? 'quedan mojados' : 'la chispa corre por el agua'}.`);
    }
  }
  aurelia(); direccion(); reina();
  for (const c of state.foes) if (c.castle) c.castle.seen = c.hp;
  if (!called.length && !said.length) return;
  if (effect) {
    effect.called = [...effect.called ?? [], ...called];
    state.message = [state.message, ...said].filter(Boolean).join(' ');
    return;
  }
  const lead = one(state, 'aurelia') ?? one(state, 'reina') ?? state.foes.find(alive) ?? state.foes[0];
  state.message = said.join(' ') || state.message;
  (state.news ??= []).push({ kind: 'enemy', actor: lead.id, called });

  function aurelia() {
    const boss = one(state, 'aurelia'), atril = one(state, 'atril');
    if (!boss || !atril) return;
    const m = mark(boss);
    if (boss.hp <= 0) { atril.hp = 0; return; }
    if (m.exposed && hurtNow(boss)) delete m.exposed;
    if (atril.hp <= 0 && !mark(atril).told) {
      mark(atril).told = true; delete atril.statuses; delete atril.timed;
      if (boss.intent?.ability === 'dictado') { delete boss.intent; if (effect) effect.cancelled = 'dictado'; }
      called.push({ target: boss.id, text: 'Sin atril', detail: 'Recibe el daño entero' });
      said.push('El atril se parte. Aurelià ya no tiene nada delante.');
    }
    const share = boss.hp / boss.maxHp, phase: AureliaPhase = share <= CASTLE.recta ? 'recta' : share <= CASTLE.carrera ? 'carrera' : 'leccion';
    if (phase !== m.phase) {
      m.phase = phase; delete boss.intent; delete m.record; delete m.lap; boss.turns = 0;
      if (phase === 'carrera') m.lap = CASTLE.vuelta;
      m.clocks ??= statusesOn(boss);
      called.push({ target: boss.id, text: AURELIA_PHASES[phase] });
      said.push(phase === 'carrera' ? 'Aurelià se quita la chaqueta y baja a la pista. Empieza a correr, y un cronómetro corre con él.' : 'Aurelià enfila la última recta. Ya no pregunta: echa.');
    }
    if (m.phase === 'leccion') return;
    // Tropiezo: a status that was not on him, and is not the one that last tripped him, breaks his step. Any status: a clock, a wound, a shock.
    const now = statusesOn(boss), fresh = now.filter(id => !(m.clocks ?? []).includes(id));
    m.clocks = now;
    const trip = fresh.find(id => id !== m.tripped);
    if (!trip) return;
    if (m.phase === 'carrera') {
      // The lap starts over, and he loses a step of the Ritmo he had gained.
      m.tripped = trip; m.lap = CASTLE.vuelta;
      const pace = boss.lasting?.shifts.fuerza ?? 0;
      if (pace > 0) boss.lasting!.shifts.fuerza = Math.max(0, pace - CASTLE.ritmo);
      called.push({ target: boss.id, text: 'Tropiezo', detail: pace > 0 ? 'La vuelta empieza otra vez · Ritmo −1' : 'La vuelta empieza otra vez' });
      said.push(`Tropiezo: ${statusName(trip)} le rompe el paso y la vuelta empieza otra vez.`);
    } else if (boss.intent?.ability === 'record') {
      // On his run-up it brings him down: no Récord, and he is on the floor for the next blow.
      m.tripped = trip; delete boss.intent; delete m.record; m.exposed = true;
      if (effect) effect.cancelled = 'record';
      called.push({ target: boss.id, text: 'Caída', detail: `Sin Récord · el siguiente golpe, ×${CASTLE.expuesto}` });
      said.push(`${statusName(trip)} le coge en plena carrerilla: Aurelià se va al suelo. No hay Récord.`);
    }
  }
  function direccion() {
    const team = all(state, 'directiva');
    if (!team.length) return;
    // Struck with what undoes the folder she carries, she loses the move she had announced. Once, until they next trade.
    if (blow && effect) for (const d of team) {
      const m = mark(d), move = d.intent?.ability;
      if (!alive(d) || !weakened.has(d.id) || m.warned || !move || !(Object.values(MOVES) as FoeAbilityId[]).includes(move)) continue;
      delete d.intent; m.overruled = true; m.warned = true; effect.cancelled = move;
      called.push({ target: d.id, text: 'Desautorizada', detail: `Pierde ${FOE_ABILITIES[move].name}` });
      said.push(`${d.name} pierde el hilo: ${FOE_ABILITIES[move].name} se queda sin leer.`);
    }
    for (const d of team) {
      const m = mark(d);
      if (d.hp > 0 || m.told) continue;
      m.told = true; f.firmas = 0;
      const left = team.filter(alive), heir = left[0];
      // An Acta being signed is void, and a closed one with it: one of them is missing.
      for (const x of team) { delete x.castle!.signed; if (x.intent?.ability === 'resolucion' || x.intent?.ability === 'firma') { if (x.intent.ability === 'resolucion' && effect) effect.cancelled = 'resolucion'; delete x.intent; } }
      if (!heir) continue;
      // Whoever is next in line takes the folders she carried, and is weak to what undoes each.
      mark(heir).elements = [...new Set([...mark(heir).elements ?? [], ...m.elements ?? []])];
      delete mark(heir).found;
      const alone = left.length === 1, text = alone ? heir.id === PRESIDES ? 'Voto de calidad' : 'En funciones' : quorum(left) ? 'Hereda' : 'Sin quórum';
      called.push({ target: heir.id, text, detail: mark(heir).elements!.map(e => ELEMENTS[e].name).join(' · ') });
      said.push(`${d.name} se sienta. ${alone ? heir.id === PRESIDES ? `${heir.name} se queda con todo: voto de calidad.` : `${heir.name} se queda con todo, en funciones.` : quorum(left) ? `${heir.name} se queda con lo suyo, y sigue habiendo quórum para el acta.` : `Sin Mar no hay quién presida: ya no habrá más actas. ${heir.name} se queda con lo suyo.`}`);
    }
  }
  function reina() {
    const queen = one(state, 'reina');
    if (!queen) return;
    const m = mark(queen), hands = all(state, 'mano'), bubbles = all(state, 'pompa');
    const burst = () => { for (const b of bubbles) if (b.hp > 0 || !mark(b).told) { b.hp = 0; mark(b).told = true; mark(b).seen = 0; delete b.statuses; delete b.timed; } };
    const release = (id: string, why: string) => {
      for (const a of state.allies) if (a.castle?.held === id) {
        delete a.castle.held; state.spent = state.spent?.filter(x => x !== a.id);
        called.push({ target: a.id, text: 'Libre' }); said.push(`${why} ${a.name} cae al suelo y se levanta.`);
      }
    };
    for (const hand of hands) if (hand.hp <= 0 && !mark(hand).told) {
      mark(hand).told = true; delete hand.statuses; delete hand.timed;
      release(hand.id, `La ${hand.name.toLowerCase()} se deshace.`);
      // What she had said that hand would do is off.
      const role = mark(hand).hand === 'sujeta' ? 'atrapar' : 'aplastar';
      if (queen.intent?.ability === role) { delete queen.intent; if (effect) effect.cancelled = role; }
    }
    // The gum's answer found (what the layer is weak to, an element or a blow; or a dual, whatever the layer): it comes off, and a piece of her with it.
    if (m.gum && alive(queen) && hurtNow(queen) && effect) {
      const answered = blow === 'dual' || weakened.has(queen.id) || !!effect.kinds?.some(k => k.target === queen.id && k.affinity === 'weak');
      if (answered) {
        const was = m.gum; m.peeled = [...m.peeled ?? [], was]; delete m.gum;
        const torn = Math.max(0, Math.min(queen.hp - 1, Math.ceil(queen.maxHp * CASTLE.capa)));
        if (torn) kit.changeHealth(queen, -torn);
        const left = GUM_ORDER.length - m.peeled.length;
        called.push({ target: queen.id, text: 'Se despega', detail: `${GUM[was]} · −${torn} PV` });
        said.push(`La capa de ${GUM[was].toLowerCase()} se le cae a tiras y se lleva un trozo de ella. ${left ? 'Debajo no hay nada que la proteja.' : 'Era la última: ya no le queda chicle con que envolverse.'}`);
      }
    }
    // Her stages by her PV; she never goes back one.
    const share = queen.hp / queen.maxHp, floor = Math.ceil(queen.maxHp * CASTLE.toma);
    if (m.stage === 'chicle' && share <= CASTLE.manos) {
      m.stage = 'manos'; delete m.gum; queen.turns = 0;
      called.push({ target: queen.id, text: REINA_PHASES.manos }); said.push('El chicle se le escurre entero. Hunde los brazos en el suelo.');
    }
    if (m.stage === 'manos' && share <= CASTLE.pompa) {
      m.stage = 'pompa'; queen.turns = 0; delete queen.intent;
      for (const hand of hands) if (hand.hp > 0) { hand.hp = 0; mark(hand).told = true; release(hand.id, 'Recoge las manos.'); }
      called.push({ target: queen.id, text: REINA_PHASES.pompa }); said.push('Recoge las manos y toma aire. Mucho aire.');
    }
    // La Pompa burst before it was full: it goes off in her face. She loses her next turn and a piece of herself.
    const bubble = m.pompa ? bubbles.find(b => b.id === m.pompa!.id) : undefined;
    if (bubble && bubble.hp <= 0 && !mark(bubble).told && alive(queen)) {
      mark(bubble).told = true; delete bubble.statuses; delete bubble.timed;
      delete m.pompa; delete queen.intent; m.stunned = true;
      const torn = Math.max(0, Math.min(queen.hp - 1, Math.ceil(queen.maxHp * CASTLE.pompaRota)));
      if (torn) kit.changeHealth(queen, -torn);
      if (effect) effect.cancelled = 'pompa';
      called.push({ target: queen.id, text: '¡Pompa rota!', detail: `Pierde el turno · −${torn} PV` }); said.push('La pompa le revienta en la cara antes de tiempo.');
    }
    // At a tenth of her PV she takes Aitor, and nothing reaches her while she has him.
    // Only when she is about to fall: the possession is what nearly beating her brings. Lost before that, it is an ordinary fall.
    const aitor = taker();
    if ((m.stage === 'pompa' || m.stage === 'manos' || m.stage === 'chicle') && queen.hp <= floor && aitor && !f.freed) {
      queen.hp = floor; m.stage = 'aitor'; queen.turns = 0; delete m.pompa; delete queen.intent; delete m.gum; delete m.stunned; burst();
      for (const hand of hands) if (hand.hp > 0) { hand.hp = 0; mark(hand).told = true; release(hand.id, ''); }
      // Down or not, he is hers: she lifts him to half his PV, so the moment cannot be skipped.
      if (aitor.hp <= 0) aitor.hp = Math.ceil(aitor.maxHp / 2);
      mark(aitor).held = 'reina'; aitor.guarding = false;
      if (!state.spent?.includes(aitor.id)) (state.spent ??= []).push(aitor.id);
      delete state.queued?.[aitor.id];
      // If it was his turn to choose, it passes to whoever is left.
      const next = state.allies.findIndex(a => a !== aitor && a.hp > 0 && !state.spent?.includes(a.id));
      if (state.phase === 'player' && state.allies[state.active] === aitor && next >= 0) state.active = next;
      f.taken = true; f.notes = 0;
      called.push({ target: aitor.id, text: 'Suyo', detail: 'Los ojos, violeta' });
      said.push('Casi en el suelo, alarga un hilo de chicle hasta Aitor. Se le vuelven violeta los ojos. Se gira hacia Gerard.');
    }
    if (m.stage === 'aitor' && queen.hp < floor) queen.hp = floor;
    if (queen.hp <= 0) { for (const hand of hands) hand.hp = 0; burst(); }
    forsaken(state);
  }
  /** Aitor, if he is there to be taken: in the party (standing or not), not already hers. */
  function taker() { return state.allies.length > 1 ? state.allies.find(a => a.id === 'aitor' && !a.castle?.held) : undefined; }
}

// ——— A round's end, and the next one's start ————————————————————————————————————————————
/** The end of a round: a Gemelo held up gets back on its feet, an Acta not closed is void, and every few rounds Dirección trade elements. */
export function castleRoundEnd(state: BattleState) {
  if (!state.foes.some(f => isCastle(f.kind))) return;
  const called: Called = [], said: string[] = [], f = fight(state);
  for (const c of state.foes) {
    // El Ausente, there since the round before: it is gone again.
    if (c.kind === 'ausente' && alive(c) && c.castle && !c.castle.away && (c.castle.back ?? 0) < state.round) {
      c.castle.away = true;
      called.push({ target: c.id, text: 'Ausente' }); said.push(`${c.name} ya no está.`);
    }
    const m = c.castle;
    if (c.kind !== 'gemelo' || !m?.down) continue;
    const twin = state.foes.find(x => x.id === m.twin);
    delete m.down;
    if (alive(twin) && !twin.castle?.down) {
      c.hp = Math.max(1, Math.round(c.maxHp * CASTLE.levantar)); m.seen = c.hp;
      called.push({ target: c.id, text: 'Se levanta', detail: `+${c.hp} PV` }); said.push(`${twin.name} tira de ${c.name} y lo pone en pie.`);
    } else { c.hp = 0; m.told = true; }
  }
  delete f.focus;
  const team = all(state, 'directiva').filter(alive);
  if (team.length) {
    // An Acta left open (a signature missed) is void; a closed one waits for its Resolución while there is quorum.
    const closed = quorum(team) && team.some(d => d.intent?.ability === 'resolucion');
    if (!closed) {
      if (f.firmas && quorum(team)) said.push('El acta se queda sin cerrar. Las firmas que había no valen.');
      f.firmas = 0; for (const d of team) { delete d.castle!.signed; if (d.intent?.ability === 'resolucion') delete d.intent; }
    }
    if (state.round % CASTLE.cargoEvery === 0) {
      // Whoever was put on her guard is not any more.
      for (const d of team) delete mark(d).warned;
      if (team.length > 1) {
        // Cambio de cargo: each takes the next one's folders, and what undoes them with them.
        const held = team.map(d => mark(d).elements ?? []);
        team.forEach((d, i) => { mark(d).elements = held[(i + 1) % team.length]; delete mark(d).found; });
        for (const d of team) called.push({ target: d.id, text: 'Cambio de cargo', detail: mark(d).elements!.map(e => ELEMENTS[e].name).join(' · ') });
        said.push('Cambio de cargo: se pasan las carpetas. Cada una lleva ahora lo de otra.');
      }
    }
    // What each will do next round goes on her plate now.
    planDireccion(state, state.round + 1);
  }
  if (!called.length && !said.length) return;
  const lead = state.foes.find(alive) ?? state.foes[0];
  (state.news ??= []).push({ kind: 'enemy', actor: lead.id, called, ...team.length && said.some(s => s.startsWith('Cambio')) ? { ability: ability('cambio-cargo') } : {} });
  f.said = said.join(' ');
}
/** A round starts: who sits it out (held, or expelled), and what the round's end had to say, for the fight's message. */
export function castleRoundStart(state: BattleState): { out: string[]; said?: string } {
  const out: string[] = [];
  if (!state.castle) return { out };
  for (const a of state.allies) {
    const m = a.castle;
    if (!m || a.hp <= 0) continue;
    if (m.held) out.push(a.id);
    else if (m.expelled) { out.push(a.id); m.expelled -= 1; if (!m.expelled) delete m.expelled; }
  }
  const said = state.castle.said;
  delete state.castle.said;
  return { out, ...said ? { said } : {} };
}

// ——— The clock ——————————————————————————————————————————————————————————————————————————
/**
 * The fight's clock in the castle: Aurelià's lap. When it closes, a Sprint on everyone and one more
 * step of Ritmo, for good, and the next lap starts. Kept as news. Returns whether anything happened.
 */
export function runCastle(kit: CastleKit, state: BattleState, seconds: number): boolean {
  const boss = one(state, 'aurelia'), m = boss?.castle;
  if (!alive(boss) || !m || m.phase !== 'carrera' || m.lap === undefined) return false;
  // A clock status that ran out can trip him again when it comes back.
  if (m.clocks) { const on = statusesOn(boss); m.clocks = m.clocks.filter(id => on.includes(id)); }
  m.lap -= seconds;
  if (m.lap > 0) return false;
  m.lap = CASTLE.vuelta;
  const up = standing(state);
  if (!up.length) return false;
  const blow: Hit = (who, power) => {
    const raw = kit.sighted(boss, physical(power, kit.current(state, boss), kit.current(state, who)));
    return kit.changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const lasting = boss.lasting ??= { shifts: {}, from: 'Ritmo' };
  lasting.shifts.fuerza = (lasting.shifts.fuerza ?? 0) + CASTLE.ritmo;
  const news: BattleEffect = { kind: 'enemy', actor: boss.id, ability: ability('sprint'), target: up[0].id, amount: blow(up[0], CASTLE.sprint) };
  const splash = up.slice(1).map(a => ({ target: a.id, amount: blow(a, CASTLE.sprint) }));
  if (splash.length) news.splash = splash;
  news.stats = [{ target: boss.id, way: 'up', stats: ['fuerza'] }];
  news.called = [{ target: boss.id, text: 'Vuelta', detail: `Ritmo ${Math.round(lasting.shifts.fuerza / CASTLE.ritmo)} · Fuerza +${lasting.shifts.fuerza}` }];
  state.message = 'Aurelià cierra la vuelta y os pasa por encima sin frenar. Cada vuelta corre más.';
  (state.news ??= []).push(news);
  return true;
}

// ——— The artilugio ——————————————————————————————————————————————————————————————————————
/** Whether the artilugio's buttons do anything now: the party carries it, and she has Aitor. */
export const artilugioLive = (state: BattleState) => !!state.castle?.artilugio && one(state, 'reina')?.castle?.stage === 'aitor' && (state.phase === 'player' || state.phase === 'enemy');
/** The note the melody wants next (0–7: a button alone or a pair, `artilugioNote`). */
export const nextNote = (state: BattleState) => MELODY[state.castle?.notes ?? 0];
/**
 * A note of the artilugio played (docs/castle-bosses.md § With the artilugio). It takes nobody's
 * turn. The first note ever startles her: she loses her next turn. A note in the right order lights
 * one more mark; a wrong one puts them out, unless it is the melody's first, which starts it again.
 * All six: Aitor is free, every ánima's maná is full, and she can be finished. Returns what
 * happened, or nothing if the artilugio does nothing now.
 */
export function castleNote(state: BattleState, note: number): { right: boolean; notes: number; startled?: boolean; freed?: boolean } | undefined {
  if (!artilugioLive(state)) return undefined;
  const f = fight(state), queen = one(state, 'reina')!, m = mark(queen);
  const startled = !f.startled;
  if (startled) { f.startled = true; m.stunned = true; delete queen.intent; }
  const right = note === nextNote(state);
  f.notes = right ? (f.notes ?? 0) + 1 : note === MELODY[0] ? 1 : 0;
  if (f.notes < MELODY.length) {
    state.message = startled ? 'Suena una nota. Ella se gira de golpe, como si la hubieran llamado por un nombre.' : right ? 'Otra nota, y otra marca se enciende sobre Aitor.' : 'Esa no era. Las marcas se apagan.';
    return { right, notes: f.notes, ...startled ? { startled } : {} };
  }
  f.freed = true; m.stage = 'libre'; delete m.stunned;
  for (const a of state.allies) {
    if (a.castle?.held === 'reina') { delete a.castle.held; state.spent = state.spent?.filter(x => x !== a.id); }
    if (a.hp > 0) { a.secondary = a.maxSecondary; a.mana = {}; }
  }
  if (state.phase === 'player' && !alive(state.allies[state.active])) state.active = Math.max(0, state.allies.findIndex(a => a.hp > 0 && !state.spent?.includes(a.id)));
  state.message = 'Las seis. La canción entra entera, y el hilo de chicle se rompe. Aitor parpadea: es él.';
  return { right, notes: f.notes, freed: true, ...startled ? { startled } : {} };
}
/** Whether the Queen took Aitor in this fight and never lost him: what the story reads when it is lost. */
export const aitorTaken = (state: BattleState) => !!state.castle?.taken && !state.castle.freed;

// ——— What the plate shows ——————————————————————————————————————————————————————————————
/** The castle's rules where the player can read them: a chip each, `[id, text]`, on whoever they are about. */
export function castleChips(state: BattleState, c: Combatant): [string, string][] {
  const m = c.castle, chips: [string, string][] = [];
  if (!m || c.hp <= 0) return chips;
  const f = state.castle ?? {};
  const wet = !!c.timed?.mojado;
  // A second-year pupil's filling shows; what a blow has found it weak to or resisting stays on its plate, as it is now (wet, rancid gum is soft again).
  if (m.filling) chips.push([`relleno-${m.filling}`, `Relleno: ${ELEMENTS[m.filling].name}`]);
  if (m.found) for (const key of keys()) { const a = castleAffinity(c, key); if (a) chips.push([`${a === 'weak' ? 'debil' : 'resiste'}-${key}`, `${a === 'weak' ? 'Débil' : 'Resiste'}: ${affinityName(key)}`]); }
  if (m.year === 3 && wet) chips.push(['reblandecido', 'Reblandecido']);
  if (m.learned) chips.push(['aprendido', m.learned === 'magic' ? 'Se sabe la magia' : 'Se sabe los golpes']);
  if (m.crust) chips.push(['costra', wet ? 'Costra blanda' : `Costra ${m.crust}`]);
  if (m.down) chips.push(['caido', 'Caído · lo levanta su gemelo']);
  if (m.marked) chips.push(['chivatazo', `Chivatazo ×${CASTLE.chivatazo}`]);
  if (c.kind === 'ausente') chips.push(m.away ? wet ? ['presente', 'Mojado: se le ve'] : ['ausente', 'Ausente: no se le puede pegar'] : ['presente', 'Presente hasta el final de la ronda']);
  if (c.kind === 'castigado') chips.push(m.rage ? ['rabia', `Rabia ${m.rage}/${CASTLE.rabia}${m.rage >= CASTLE.rabia ? ' · revienta' : ''}`] : ['pared', 'De cara a la pared']);
  if (c.kind === 'monton') chips.push(m.form ? ['forma', `Copia: ${MONTON_FORMS[m.form]} · ${montonCopy(c)}${m.all || m.form === 'agua' ? ' a todos' : ''}`] : ['sin-forma', 'Sin forma: copia el primer golpe']);
  if (m.expelled) chips.push(['expulsado', `Expulsado · ${m.expelled}`]);
  if (m.held) chips.push(['atrapado', m.held === 'reina' ? 'Suyo' : 'Atrapado']);
  if (c.kind === 'delegada') chips.push(['delegada', inCharge(state) ? 'Manda: todos al mismo' : 'Callada']);
  if (c.kind === 'aurelia') {
    chips.push(['fase', AURELIA_PHASES[m.phase ?? 'leccion']]);
    if (alive(one(state, 'atril'))) chips.push(['atril', 'Tras el atril: mitad de daño']);
    if (m.exposed) chips.push(['expuesto', `Sin palabras ×${CASTLE.expuesto}`]);
    if (m.phase === 'carrera' && m.lap !== undefined) chips.push(['vuelta', `Vuelta · ${Math.max(0, Math.ceil(m.lap))} s`]);
    const pace = c.lasting?.shifts.fuerza ?? 0;
    if (pace > 0) chips.push(['ritmo', `Ritmo ${Math.round(pace / CASTLE.ritmo)}`]);
    if (m.tripped && m.phase !== 'leccion') chips.push(['tropiezo', `Tropezó: ${statusName(m.tripped)}`]);
  }
  if (c.kind === 'directiva') {
    const team = all(state, 'directiva').filter(alive);
    chips.push(['cargo', (m.elements ?? []).map(e => ELEMENTS[e].name).join(' · ')]);
    if (team.length === 1) chips.push(c.id === PRESIDES ? ['voto', 'Voto de calidad'] : ['funciones', 'En funciones']);
    else if (c.id === PRESIDES && quorum(team)) chips.push(['preside', 'Preside el acta']);
    if (m.signed) chips.push(['firma', `Firma ${f.firmas ?? 0}/${team.length}`]);
    if (m.overruled) chips.push(['desautorizada', 'Desautorizada']);
    else if (m.warned) chips.push(['sobre-aviso', 'Sobre aviso']);
    if (team.length > 1 && state.round % CASTLE.cargoEvery === 0) chips.push(['cambio', 'Cambio de cargo al acabar la ronda']);
  }
  if (c.kind === 'reina') {
    if (m.stage && m.stage !== 'libre' && m.stage !== 'aitor') chips.push(['fase', REINA_PHASES[m.stage]]);
    if (m.gum) chips.push(['chicle', GUM[m.gum]]);
    if (m.stage === 'chicle') { const left = GUM_ORDER.length - (m.peeled?.length ?? 0); chips.push(['capas', left ? `Capas ${left}` : 'Sin chicle']); }
    const hands = all(state, 'mano').filter(alive).length;
    if (hands) chips.push(['manos', `${hands === 2 ? 'Dos manos' : 'Una mano'}: daño −${Math.round(CASTLE.mano * hands * 100)} %`]);
    if (m.pompa) chips.push(['pompa', 'Tras la pompa: daño −50 %']);
    if (m.stage === 'aitor') chips.push(['aitor', f.artilugio && f.startled ? `Aitor ${'●'.repeat(f.notes ?? 0)}${'○'.repeat(MELODY.length - (f.notes ?? 0))}` : 'Tiene a Aitor']);
    if (m.stunned) chips.push(['sin-turno', 'Sin turno']);
  }
  if (c.kind === 'mano') { const held = state.allies.find(a => a.castle?.held === c.id); chips.push(held ? ['atrapado', `Sujeta a ${held.name}`] : ['mano', c.castle?.hand === 'aplasta' ? 'Aplasta' : 'Sujeta']); }
  if (c.kind === 'pompa') { const left = one(state, 'reina')?.castle?.pompa?.left; if (left) chips.push(['pompa', `Revienta en ${left}`]); }
  return chips;
}
/** A castle foe's announced move as the fight shows it; with La Delegada in charge, her pupils' tells do not show. */
export function castleIntent(state: BattleState, c: Combatant): string | undefined {
  const intent = c.intent;
  if (!intent || c.hp <= 0) return undefined;
  if (c.kind !== 'delegada' && c.kind !== 'aurelia' && c.kind !== 'directiva' && c.kind !== 'reina' && inCharge(state)) return undefined;
  const name = FOE_ABILITIES[intent.ability].name, who = intent.target ? state.allies.find(a => a.id === intent.target)?.name : intent.at;
  const count = intent.ability === 'record' && c.castle?.record ? ` · ${c.castle.record}` : '';
  return `${who ? `${name} → ${who}` : name}${count}`;
}

// ——— Moments for the picker —————————————————————————————————————————————————————————————
/** Development: puts a castle fight at `moment` (docs/dev-tools.md). Returns whether it fits this fight. */
export function stageCastle(kit: CastleKit, state: BattleState, moment: CastleMoment): boolean {
  const first = state.allies.find(a => a.hp > 0);
  if (!first) return false;
  for (const a of state.allies) delete a.castle;
  if (moment.startsWith('aurelia-')) {
    const boss = one(state, 'aurelia'), atril = one(state, 'atril');
    if (!boss || !atril) return false;
    delete boss.intent; delete boss.lasting; delete boss.timed; delete boss.statuses; boss.turns = 0;
    const phase = moment.slice('aurelia-'.length) as AureliaPhase;
    boss.hp = phase === 'leccion' ? boss.maxHp : Math.floor(boss.maxHp * (phase === 'carrera' ? CASTLE.carrera : CASTLE.recta));
    atril.hp = phase === 'leccion' ? atril.maxHp : 0;
    atril.castle = { seen: atril.hp, ...phase === 'leccion' ? {} : { told: true } };
    boss.castle = { phase, seen: boss.hp, ...phase === 'leccion' ? {} : { clocks: [] }, ...phase === 'carrera' ? { lap: CASTLE.vuelta } : {} };
  } else if (moment.startsWith('direccion-')) {
    const team = all(state, 'directiva');
    if (team.length !== 3) return false;
    // Who is still sitting: the three; Mar and Montse; Mar alone, with her casting vote; Montse alone, in charge without it.
    const sitting = moment === 'direccion-tres' ? [0, 1, 2] : moment === 'direccion-dos' ? [0, 1] : moment === 'direccion-una' ? [0] : [1];
    const heir = sitting[0], gone = DIRECTIVAS.flatMap((x, i) => sitting.includes(i) ? [] : [x.element]);
    state.castle = {};
    team.forEach((d, i) => {
      delete d.intent; delete d.timed; delete d.statuses; d.turns = 0;
      d.hp = sitting.includes(i) ? d.maxHp : 0;
      d.castle = { elements: [DIRECTIVAS[i].element, ...i === heir ? gone : []], seen: d.hp, ...sitting.includes(i) ? {} : { told: true } };
    });
    // The round the next Acta is signed in, with the three sitting.
    if (sitting.length === 3) state.round = Math.ceil(state.round / CASTLE.actaEvery) * CASTLE.actaEvery;
    planDireccion(state, state.round);
  } else {
    const queen = one(state, 'reina');
    if (!queen) return false;
    // Her things from another moment are put down, not taken out: whoever draws the fight keeps its fighters.
    for (const c of state.foes) if (castleProp(c)) { c.hp = 0; c.castle = { ...c.castle, told: true, seen: 0 }; delete c.timed; delete c.statuses; }
    delete queen.intent; delete queen.timed; delete queen.statuses; queen.turns = 0;
    // The first fight's moment has no artilugio; the rest are the second fight's.
    state.castle = { artilugio: moment === 'reina-suyo' ? false : state.castle?.artilugio ?? true };
    if (moment === 'reina-chicle') { queen.hp = queen.maxHp; queen.castle = { stage: 'chicle', seen: queen.hp }; wrap(queen, 'fresco'); }
    else if (moment === 'reina-manos') {
      queen.hp = Math.floor(queen.maxHp * CASTLE.manos); queen.castle = { stage: 'manos', seen: queen.hp, raised: true };
      raiseHands(kit, state);
      const whom = state.allies.filter(a => a.hp > 0);
      if (whom.length > 1) queen.intent = { ability: 'atrapar', target: whom[0].id };
    } else if (moment === 'reina-pompa') { queen.hp = Math.floor(queen.maxHp * CASTLE.pompa); queen.castle = { stage: 'pompa', seen: queen.hp }; }
    else {
      // At a tenth of her PV: she has just taken Aitor (the artilugio's moment, or the first time's with none).
      queen.hp = Math.ceil(queen.maxHp * CASTLE.toma); queen.castle = { stage: 'pompa', seen: queen.hp + 1 };
      castleAfter(kit, state);
      delete state.news;
    }
  }
  return true;
}
