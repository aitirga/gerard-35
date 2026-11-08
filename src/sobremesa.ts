import type * as pc from 'playcanvas';

/**
 * La Sobremesa's body (docs/quests/universidad.md § Final boss): Meshy's model with the rig
 * `just rig sobremesa` adds (assets/models/sobremesa/rig.json). The pose is pure (`pose`): every bone's
 * turn and shift from the time and what each friend is doing; `bindSobremesa` lays it on the bones of
 * the loaded model. Model axes: x right, y up, the front facing +z, so a positive turn about x leans a
 * friend forward.
 */
export const FRIENDS = ['Álvaro', 'Anna', 'Miquel', 'Sarah', 'Nico', 'Joan', 'Soraya'] as const;
export type Friend = typeof FRIENDS[number];
export const BONES = ['Raíz', ...FRIENDS, 'Brazo de las cartas', 'Brazo derecho', 'Garra izquierda', 'Garra derecha', 'Tentáculos'] as const;
export type Bone = typeof BONES[number];
export const MODEL_URL = 'models/bosses/sobremesa.glb';

/**
 * What a friend is doing: an attack started at `since` (seconds), or freed since then. An attack can
 * say which `move` it is (its FoeAbilityId), each with its own motion (`moveOn`), and `warn` when it
 * only announces a blow for next turn (Miquel turning his card).
 */
export type Move = 'tirada' | 'duo-tirada' | 'sopeta' | 'regla-nueva' | 'duo-regla' | 'carta-negra' | 'escala' | 'correccion' | 'cortafuegos';
export interface Act { kind: 'attack' | 'free'; since: number; move?: Move; warn?: boolean }
export type Acts = Partial<Record<Friend, Act>>;
export interface BonePose { turn: [number, number, number]; shift: [number, number, number] }

export const ATTACK_TIME = 1.2, FREE_TIME = .9;
/** Each friend's own pace, so the six never move as one. */
const PHASE: Record<Friend, number> = { Álvaro: 0, Anna: 1.7, Miquel: 3.1, Sarah: 4.4, Nico: 2.3, Joan: 3.8, Soraya: 5.2 };
/** Whose arm goes with whose blow. */
const ARM_OF: Partial<Record<Friend, Bone>> = { Álvaro: 'Brazo de las cartas', Miquel: 'Brazo derecho', Sarah: 'Garra izquierda', Anna: 'Garra izquierda', Nico: 'Garra derecha' };

const ease = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const wave = (t: number, speed: number, phase: number) => Math.sin(t * speed + phase);

/**
 * An attack, 0 → 1 over ATTACK_TIME: draws back (0–.35), lunges forward (.35–.55) and settles.
 * Returns how far forward (+1) or back (−1) it leans.
 */
export function strike(progress: number) {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < .35) return -ease(progress / .35);
  if (progress < .55) return -1 + 2.4 * ease((progress - .35) / .2);
  return 1.4 * (1 - ease((progress - .55) / .45));
}

/** Every bone's pose at time `t`. */
export function pose(t: number, acts: Acts = {}): Record<Bone, BonePose> {
  const out = Object.fromEntries(BONES.map(b => [b, { turn: [0, 0, 0], shift: [0, 0, 0] }])) as Record<Bone, BonePose>;
  const freed = FRIENDS.filter(f => acts[f]?.kind === 'free').length;
  // The mass breathes and sways; it slows and sinks as friends come away.
  const life = 1 - freed / FRIENDS.length * .7;
  out['Raíz'].turn = [wave(t, .8, 0) * 1.2 * life, wave(t, .35, 1) * 2.5 * life, wave(t, .55, 2) * 1.6 * life];
  out['Raíz'].shift = [0, wave(t, 1.1, 0) * .012 * life - (1 - life) * .05, 0];
  out['Tentáculos'].turn = [wave(t, 2.1, 0) * 7 * life, 0, wave(t, 1.7, 1) * 6 * life];
  for (const claw of ['Garra izquierda', 'Garra derecha'] as const) {
    const side = claw === 'Garra izquierda' ? 1 : -1;
    out[claw].turn = [wave(t, 1.3, side) * 5 * life, 0, wave(t, .9, side * 2) * 4 * side * life];
  }
  out['Brazo de las cartas'].turn = [0, 0, wave(t, 1.1, .5) * 10];
  out['Brazo derecho'].turn = [0, 0, -wave(t, 1, 2) * 9];
  for (const friend of FRIENDS) {
    const act = acts[friend], p = PHASE[friend], bone = out[friend];
    if (act?.kind === 'free') {
      // Freed: it goes limp, head down and to one side, and stays.
      const k = ease((t - act.since) / FREE_TIME);
      bone.turn = [34 * k, 0, (p % 2 ? 12 : -12) * k];
      bone.shift = [0, -.07 * k, .02 * k];
      continue;
    }
    // Held: never quite still, each on its own pace, looking about.
    bone.turn = [wave(t, .9, p) * 4, wave(t, .45, p) * 10, wave(t, .7, p + 1) * 5];
    if (act?.kind !== 'attack') continue;
    const s = strike((t - act.since) / ATTACK_TIME);
    bone.turn[0] += s * 18;
    bone.shift = [0, Math.max(0, -s) * .03, Math.max(0, s) * .11];
    // Joan sings: his head goes back, trembling with the note, instead of lunging.
    if (friend === 'Joan') { bone.turn[0] -= s * 34; bone.turn[2] += Math.sin(t * 40) * 3 * Math.abs(s); bone.shift = [0, Math.abs(s) * .03, 0]; }
    // Soraya corrects him: she leans over towards Joan, on her right, and does not lunge.
    if (friend === 'Soraya') { bone.turn[0] -= s * 18; bone.turn[2] += Math.abs(s) * 16; bone.shift = [-Math.abs(s) * .05, 0, 0]; }
    const arm = ARM_OF[friend];
    if (arm) { out[arm].turn[0] += s * 22; out[arm].shift = [out[arm].shift[0], out[arm].shift[1], out[arm].shift[2] + Math.max(0, s) * .08]; }
    if (act.move) moveOn(out, friend, act.move, (t - act.since) / ATTACK_TIME, t, !!act.warn);
  }
  return out;
}

/** A bump 0 → 1 → 0 between `a` and `b` of an attack's progress. */
const bump = (k: number, a: number, b: number) => k <= a || k >= b ? 0 : Math.sin((k - a) / (b - a) * Math.PI);
const addTurn = (b: BonePose, x: number, y: number, z: number) => { b.turn = [b.turn[0] + x, b.turn[1] + y, b.turn[2] + z]; };
const addShift = (b: BonePose, x: number, y: number, z: number) => { b.shift = [b.shift[0] + x, b.shift[1] + y, b.shift[2] + z]; };

/**
 * Each move's own motion, on top of the lunge, 0 → 1 over ATTACK_TIME (`k`), with the whole body
 * going with it: the dice shaken in the card arm and flung, the soup stirred and ladled out, the rule
 * written on the table, the black card held high and slammed down, the mass rising with Joan's note,
 * Nico rising with both claws spread before whom he shields.
 */
function moveOn(out: Record<Bone, BonePose>, friend: Friend, move: Move, k: number, t: number, warn: boolean) {
  if (k <= 0 || k >= 1) return;
  const me = out[friend], root = out['Raíz'];
  if (move === 'tirada' || move === 'duo-tirada') {
    // The dice rattle in the card arm, high, then it swings right through and the body lurches after them.
    const big = move === 'duo-tirada' ? 1.5 : 1, shake = bump(k, 0, .4), fling = bump(k, .35, .75);
    addTurn(out['Brazo de las cartas'], -40 * shake * big + 55 * fling * big, Math.sin(t * 46) * 9 * shake, Math.sin(t * 38) * 12 * shake);
    addShift(out['Brazo de las cartas'], 0, .06 * shake, .1 * fling);
    addTurn(me, -10 * shake + 12 * fling, 0, Math.sin(t * 46) * 3 * shake);
    addTurn(root, 5 * fling * big, 0, 0); addShift(root, 0, 0, .05 * fling * big);
  } else if (move === 'sopeta') {
    // Anna bends to the pot, stirs round with her claw, then ladles it out at whom she feeds: the mass heaves.
    const bend = bump(k, 0, .55), stir = bump(k, .05, .5), ladle = bump(k, .45, .85), a = t * 11;
    addTurn(me, 22 * bend - 8 * ladle, Math.sin(a) * 14 * stir, Math.cos(a) * 6 * stir);
    addShift(me, 0, -.05 * bend, .04 * bend + .1 * ladle);
    addTurn(out['Garra izquierda'], 18 * bend + Math.sin(a) * 16 * stir - 30 * ladle, Math.cos(a) * 20 * stir, 0);
    addShift(out['Garra izquierda'], Math.cos(a) * .05 * stir, .04 * ladle, Math.sin(a) * .05 * stir + .08 * ladle);
    addShift(root, 0, Math.sin(k * Math.PI * 3) * .03 * (1 - k), 0);
  } else if (move === 'regla-nueva' || (move === 'duo-regla' && friend === 'Sarah')) {
    // Sarah's head down to the table, her claw scratching a line back and forth, then she looks up.
    const write = bump(k, .05, .8), up = bump(k, .75, 1);
    addTurn(me, 26 * write - 10 * up, Math.sin(t * 9) * 6 * write, 0);
    addTurn(out['Garra izquierda'], 20 * write, Math.sin(t * 22) * 24 * write, 0);
    addShift(out['Garra izquierda'], Math.sin(t * 22) * .07 * write, -.03 * write, .05 * write);
  } else if (move === 'carta-negra' || (move === 'duo-regla' && friend === 'Miquel')) {
    // The card held up high (turned and shown: `warn`), or brought down hard, the whole body with it.
    const arm = out['Brazo derecho'];
    if (warn) {
      const raise = Math.min(1, k / .3);
      addTurn(arm, -70 * raise, Math.sin(t * 3) * 8 * raise, -25 * raise); addShift(arm, 0, .12 * raise, 0);
      addTurn(me, -14 * raise, 0, -6 * raise);
    } else {
      const raise = bump(k, 0, .45), slam = bump(k, .38, .7);
      addTurn(arm, -80 * raise + 70 * slam, 0, -20 * raise); addShift(arm, 0, .14 * raise - .06 * slam, .12 * slam);
      addTurn(me, -16 * raise + 26 * slam, 0, 0);
      addTurn(root, 8 * slam, 0, 0); addShift(root, 0, -.05 * slam, .04 * slam);
    }
  } else if (move === 'escala') {
    // The whole mass rises with the note and shudders; the tentacles flare.
    const sing = bump(k, .1, .95);
    addShift(root, 0, .05 * sing, 0); addTurn(root, -4 * sing, 0, Math.sin(t * 34) * 2 * sing);
    addTurn(out['Tentáculos'], -18 * sing, 0, Math.sin(t * 20) * 10 * sing);
  } else if (move === 'correccion') {
    // Soraya's claw snaps out towards Joan.
    const snap = bump(k, .2, .6);
    addTurn(out['Garra derecha'], -25 * snap, -30 * snap, 0); addShift(out['Garra derecha'], -.06 * snap, .03 * snap, .05 * snap);
  } else if (move === 'cortafuegos') {
    // Nico straightens up and both claws spread wide, held, as a wall.
    const hold = Math.min(1, k / .25) * (1 - Math.max(0, (k - .8) / .2));
    addTurn(me, -14 * hold, 0, 0); addShift(me, 0, .06 * hold, 0);
    addTurn(out['Garra izquierda'], -20 * hold, 0, 34 * hold); addTurn(out['Garra derecha'], -20 * hold, 0, -34 * hold);
    addShift(root, 0, .03 * hold, 0);
  }
}

/** Lays `pose` on a loaded model's bones: each keeps its rest place, plus the pose's shift and turn. */
export function bindSobremesa(model: pc.Entity) {
  const bones = BONES.map(name => {
    const node = model.findByName(name) as pc.GraphNode | null;
    if (!node) throw new Error(`La Sobremesa: missing bone ${name}`);
    return { name, node, rest: node.getLocalPosition().clone() };
  });
  return {
    bones: bones.map(b => b.node),
    apply(t: number, acts: Acts) {
      const now = pose(t, acts);
      for (const { name, node, rest } of bones) {
        const { turn, shift } = now[name];
        node.setLocalPosition(rest.x + shift[0], rest.y + shift[1], rest.z + shift[2]);
        node.setLocalEulerAngles(turn[0], turn[1], turn[2]);
      }
    },
  };
}
