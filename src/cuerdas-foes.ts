import * as pc from 'playcanvas';
import type { BattleEffect, Combatant, CuerdasKind, FoeAbilityId } from './battle';
import { TONES, type Moment } from './song';

/**
 * Las cuerdas' foes (docs/quests/marta.md § Monsters, § La Voz), built from primitives and named as
 * the fight looks for a part (`Charco pringoso` under them, `Vista` to turn to the camera, `Cabeza de
 * chicle` for a head). They are what Marta lost, so none is a creature: each is string, glass and
 * light, in the one note it answers to. La Lealtad, a dark figure behind a tall shield strung like a
 * harp, an amber knot at its middle. An Eco, rings round a bead that goes faster each turn. Lo
 * Cristalino, an obelisk of aqua glass with a string of light through it and shards turning round it.
 * Lo Directo, a standing blade with a lance of blue-white light, and a crossbar when it means everyone.
 * La Voz, a woman's outline in a gown of strings with the note alight in her throat: there while a
 * note sounds, almost gone in the silences, her arms crossed on Guardia and glass on Nota clara.
 * No pink and no violet anywhere: nobody here is possessed.
 */
export function createCuerdasFoes(app: pc.Application) {
  const materials: pc.StandardMaterial[] = [];
  const mat = (name: string, hex: string, gloss = .4, glow = 0, opacity = 1) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], shadows = true) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: shadows });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  /** A thin ring lying flat (its axis up) before `r` turns it: `radius` to the middle of a tube `tube` thick. */
  const meshes: pc.Mesh[] = [];
  function ring(parent: pc.Entity, name: string, m: pc.Material, radius: number, tube: number, p: number[] = [0, 0, 0], r: number[] = [0, 0, 0]) {
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius: radius, tubeRadius: tube, segments: 48, sides: 8 }));
    meshes.push(mesh);
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: false });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const pivot = (parent: pc.Entity, name: string, at: number[] = [0, 0, 0]) => { const e = new pc.Entity(name); e.setLocalPosition(at[0], at[1], at[2]); parent.addChild(e); return e; };
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; app.root.addChild(e); return e; };
  /** A string from `a` to `b`: a thin cylinder turned from straight up to lie along it. */
  function string(parent: pc.Entity, name: string, m: pc.Material, a: number[], b: number[], thick = .014) {
    const d = new pc.Vec3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), length = d.length();
    const e = part(parent, name, 'cylinder', m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [thick, length, thick], [0, 0, 0], false);
    const up = new pc.Vec3(0, 1, 0), dir = d.clone().normalize(), axis = new pc.Vec3().cross(up, dir);
    if (axis.length() > 1e-6) e.setLocalRotation(new pc.Quat().setFromAxisAngle(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, up.dot(dir)))) * 180 / Math.PI));
    return e;
  }
  /** The light each one stands in, in place of a shadow: a thin pale disc. */
  const pool = (parent: pc.Entity, hex: string, size: number) => part(parent, 'Charco pringoso', 'cylinder', mat('Luz del suelo', hex, .2, .35, .14), [0, .012, 0], [size, .01, size], [0, 0, 0], false);
  const dark = mat('Cuerpo oscuro', '#12343d', .55), darker = mat('Cuerpo hondo', '#0b2229', .5), silver = mat('Cuerda de plata', '#cfdde6', .8, 1.4);
  const tone = (id: keyof typeof TONES) => TONES[id].colour;

  // La Lealtad: a slender dark figure that never leaves its place, behind a tall shield strung like a
  // harp. Where the strings cross, an amber knot.
  const lealtad = root('La Lealtad');
  pool(lealtad, tone('la'), 1.5);
  const guard = pivot(lealtad, 'Vista');
  part(guard, 'Falda', 'cone', dark, [0, .62, -.12], [.7, 1.24, .6]);
  part(guard, 'Torso', 'cylinder', dark, [0, 1.42, -.12], [.34, .62, .24]);
  part(guard, 'Hombros', 'sphere', dark, [0, 1.68, -.12], [.6, .2, .28]);
  const head = pivot(guard, 'Cabeza de chicle', [0, 1.98, -.12]);
  part(head, 'Cabeza', 'sphere', darker, [0, 0, 0], [.27, .32, .28]);
  // The cord of its oath, wound twice round its chest.
  const amber = mat('Nudo', tone('la'), .6, 2.2), amberSoft = mat('Cuerda ámbar', tone('la'), .5, 1.1);
  ring(guard, 'Cordón', amberSoft, .19, .014, [0, 1.46, -.12], [14, 0, 8]);
  ring(guard, 'Cordón', amberSoft, .2, .014, [0, 1.3, -.12], [-12, 0, -9]);
  for (const side of [-1, 1]) part(guard, 'Brazo', 'cylinder', dark, [side * .3, 1.36, .08], [.1, .62, .1], [-58, 0, side * -16]);
  const shield = pivot(guard, 'Escudo', [0, 0, .36]);
  const frame = mat('Marco del escudo', '#8fa3ad', .85);
  part(shield, 'Larguero', 'box', frame, [-.5, 1.05, 0], [.05, 1.9, .06]);
  part(shield, 'Larguero', 'box', frame, [.5, 1.05, 0], [.05, 1.9, .06]);
  part(shield, 'Travesaño', 'box', frame, [0, 2.0, 0], [1.05, .06, .07]);
  part(shield, 'Travesaño', 'box', frame, [0, .1, 0], [1.05, .06, .07]);
  for (let k = 0; k < 9; k++) string(shield, 'Cuerda del escudo', k % 4 === 0 ? amberSoft : silver, [-.4 + k * .1, .13, 0], [-.4 + k * .1, 1.97, 0], .012);
  const knot = pivot(shield, 'Nudo', [0, 1.12, .03]);
  ring(knot, 'Lazo', amber, .15, .022, [0, 0, 0], [90, 0, 0]);
  ring(knot, 'Lazo', amber, .15, .022, [.06, 0, 0], [90, 0, 60]);
  ring(knot, 'Lazo', amber, .15, .022, [-.06, 0, 0], [90, 0, -60]);
  part(knot, 'Corazón del nudo', 'sphere', amber, [0, 0, 0], [.09, .09, .09], [0, 0, 0], false);

  // Eco: nothing but what a blow leaves in the air. A bead on a ring, and a ring more each turn it has had.
  const eco = root('Eco');
  pool(eco, tone('mi'), .9);
  const echo = pivot(pivot(eco, 'Vista'), 'Flota', [0, 1.15, 0]);
  const pale = mat('Anillo del eco', tone('mi'), .7, 1.8), paleSoft = mat('Anillo lejano', tone('mi'), .6, .9, .55);
  ring(echo, 'Anillo', pale, .4, .014, [0, 0, 0], [90, 0, 0]);
  ring(echo, 'Anillo segundo', paleSoft, .56, .01, [0, 0, 0], [90, 0, 0]);
  ring(echo, 'Anillo tercero', paleSoft, .73, .008, [0, 0, 0], [90, 0, 0]);
  const orbit = pivot(echo, 'Órbita');
  part(orbit, 'Cuenta', 'sphere', mat('Cuenta', '#ffffff', .9, 3), [.4, 0, 0], [.13, .13, .13], [0, 0, 0], false);
  string(eco, 'Hilo', paleSoft, [0, .02, 0], [0, .72, 0], .01);

  // Lo Cristalino: an obelisk of aqua glass on its point, a string of light through it, shards turning round it.
  const cristalino = root('Lo Cristalino');
  pool(cristalino, tone('do'), 1.4);
  const glassBody = pivot(pivot(cristalino, 'Vista'), 'Flota', [0, .12, 0]);
  const glass = mat('Cristal', '#8fe6da', .96, .35, .5), glassDeep = mat('Cristal hondo', '#2f8f88', .9, .2, .62);
  part(glassBody, 'Fuste', 'box', glass, [0, 1.05, 0], [.46, 1.5, .46], [0, 45, 0]);
  part(glassBody, 'Punta', 'box', glass, [0, 1.96, 0], [.34, .34, .34], [54.7, 0, 45]);
  part(glassBody, 'Pie', 'box', glassDeep, [0, .22, 0], [.3, .3, .3], [54.7, 0, 45]);
  part(glassBody, 'Cuerda de dentro', 'cylinder', mat('Cuerda de dentro', '#eafffb', .8, 2.6), [0, 1.08, 0], [.03, 2.05, .03], [0, 0, 0], false);
  const shards = pivot(glassBody, 'Esquirlas', [0, 1.1, 0]);
  for (let k = 0; k < 5; k++) {
    const a = k * 2.513;
    part(shards, 'Esquirla', 'box', glass, [Math.cos(a) * .58, (k - 2) * .34, Math.sin(a) * .58], [.05, .3 + (k % 2) * .12, .14], [k * 23, -a * 57.3, 18], false);
  }

  // Lo Directo: a standing blade, the straightest way between two points, with a lance of blue-white
  // light at its side. The crossbar only shows when it means everyone.
  const directo = root('Lo Directo');
  pool(directo, tone('sol'), 1.2);
  const blade = pivot(directo, 'Vista');
  const navy = mat('Hoja', '#17264a', .7), line = mat('Filo', '#cfe0ff', .8, 2.6), blue = mat('Luz azul', tone('sol'), .6, 1.8);
  part(blade, 'Hoja', 'box', navy, [0, 1.05, 0], [.3, 1.9, .1]);
  part(blade, 'Filo', 'box', line, [0, 1.05, .055], [.025, 1.9, .012], [0, 0, 0], false);
  part(blade, 'Pie de la hoja', 'cone', navy, [0, .1, 0], [.3, .22, .1], [180, 0, 0]);
  const point = pivot(blade, 'Cabeza de chicle', [0, 2.2, 0]);
  part(point, 'Rombo', 'box', navy, [0, 0, 0], [.2, .2, .2], [54.7, 0, 45]);
  part(point, 'Luz del rombo', 'sphere', line, [0, 0, .1], [.05, .05, .03], [0, 0, 0], false);
  const lance = pivot(blade, 'Lanza', [.36, 1.3, 0]);
  part(lance, 'Asta', 'cylinder', blue, [0, 0, -.2], [.035, 1.5, .035], [90, 0, 0], false);
  part(lance, 'Punta de la lanza', 'cone', line, [0, 0, .95], [.11, .8, .11], [90, 0, 0], false);
  ring(lance, 'Guarda', blue, .1, .014, [0, 0, .5], [90, 0, 0]);
  part(blade, 'Barra', 'box', line, [0, 1.3, .3], [2.6, .035, .035], [0, 0, 0], false).enabled = false;

  // La Voz: a woman's outline, hung from the strings above her, in a gown of strings that never
  // reaches the floor. No face: the note is a light in her throat, and each Crescendo lights a ring behind her.
  const voz = root('La Voz');
  pool(voz, '#dfeaf2', 1.5);
  const singer = pivot(pivot(voz, 'Vista'), 'Flota', [0, .32, 0]);
  const veil = mat('Velo', '#123c47', .7, .12, .86), skin = mat('Figura', '#1a4a56', .75, .1, .9), hair = mat('Pelo', '#0a1d24', .5, 0, .92);
  const strand = mat('Cuerda de la voz', '#dfeaf2', .8, 1.5, .9), note = mat('Nota', '#ffffff', .9, 3.2), halfLit = mat('Halo', '#dfeaf2', .7, .5, .5);
  part(singer, 'Vestido', 'cone', veil, [0, .72, 0], [1.02, 1.32, .92]);
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2, b = a + .5;
    string(singer, 'Cuerda del vestido', strand, [Math.cos(a) * .17, 1.32, Math.sin(a) * .13], [Math.cos(b) * .6, -.12 - (k % 3) * .09, Math.sin(b) * .54], .011);
  }
  part(singer, 'Talle', 'cylinder', skin, [0, 1.5, 0], [.3, .5, .2]);
  part(singer, 'Hombros', 'sphere', skin, [0, 1.74, 0], [.56, .16, .24]);
  part(singer, 'Cuello', 'cylinder', skin, [0, 1.86, 0], [.1, .16, .1]);
  part(singer, 'Garganta', 'sphere', note, [0, 1.84, .07], [.075, .09, .05], [0, 0, 0], false);
  const face = pivot(singer, 'Cabeza de chicle', [0, 2.08, 0]);
  part(face, 'Cabeza', 'sphere', skin, [0, 0, 0], [.26, .31, .27]);
  part(face, 'Melena', 'sphere', hair, [0, -.02, -.06], [.33, .4, .3]);
  part(face, 'Melena larga', 'sphere', hair, [0, -.36, -.13], [.36, .74, .2]);
  for (const side of [-1, 1]) {
    const arm = pivot(singer, side < 0 ? 'Brazo izquierdo de la voz' : 'Brazo derecho de la voz', [side * .27, 1.72, 0]);
    part(arm, 'Brazo', 'cylinder', skin, [0, -.25, 0], [.09, .5, .09]);
    const fore = pivot(arm, 'Antebrazo de la voz', [0, -.5, 0]);
    part(fore, 'Antebrazo', 'cylinder', skin, [0, -.22, 0], [.075, .46, .075]);
    part(fore, 'Mano', 'sphere', skin, [0, -.48, 0], [.09, .12, .06]);
  }
  const halo = pivot(singer, 'Halo', [0, 2.06, -.22]);
  for (let k = 0; k < 4; k++) ring(halo, `Aro ${k + 1}`, halfLit.clone(), .44 + k * .2, .011, [0, 0, -k * .03], [90, 0, 0]);
  halo.findComponents('render').forEach(r => materials.push((r as pc.RenderComponent).meshInstances[0].material as pc.StandardMaterial));
  // What she hangs from: four strings going up out of sight.
  for (const [x, z] of [[-.3, 0], [.3, 0], [0, -.12], [0, .1]]) string(singer, 'Cuerda de arriba', strand, [x, x ? 1.8 : 2.36, z], [x * 1.6, 9, z * 3], .009).tags.add('overhead');

  const templates = new Map<CuerdasKind, pc.Entity>([['lealtad', lealtad], ['eco', eco], ['cristalino', cristalino], ['directo', directo], ['voz', voz]]);
  interface Shown {
    /** La Voz: how much she is there (1 on a note, 0 in a silence), how crossed her arms, how much glass. */
    there?: number; guard?: number; glass?: number; lit?: number; colour?: pc.Color;
    voz?: { body: pc.StandardMaterial[]; strand: pc.StandardMaterial; note: pc.StandardMaterial; rings: pc.StandardMaterial[]; arms: pc.Entity[]; fores: pc.Entity[]; float: pc.Entity; halo: pc.Entity; base: pc.Color[] };
    spin?: number; bar?: number; draw?: number;
    /** A move under way, eased: wound up before it lands (−1 to 0) and let go after (0 to 1); and the looks that stay. */
    act?: number; tie?: number; crack?: number; stuck?: number; air?: number; winded?: number; reach?: number;
  }
  const shown = new WeakMap<pc.Entity, Shown>();
  const material = (model: pc.Entity, name: string) => (model.findByName(name) as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
  const GLASS = new pc.Color().fromString('#bff4ec'), RIM = new pc.Color().fromString('#9fc4cf');
  return {
    templates,
    /**
     * Each frame, one of Las cuerdas' foes shows its rule now. An Eco's bead goes faster and it has a
     * ring more each turn; Lo Cristalino's shards turn; Lo Directo draws its lance back at whom it
     * said and shows its crossbar for En línea recta; La Voz is there while `song` sounds (in the
     * note's colour) and nearly gone in a silence, crosses her arms on Guardia, turns to glass on Nota
     * clara, and has a ring lit behind her for each Crescendo. `animate` false snaps to it.
     *
     * `move` is its own move under way (`pending` until it lands), and each body makes it: La Lealtad
     * draws her shield back and thrusts it (Juramento) or her knot swells (Lazo); an Eco's rings open;
     * Lo Cristalino's string flares (Destello), and cracked it leans, its shards fly wide and fast;
     * Lo Directo draws further back for an Estocada, thrusts, and leaves its lance in the floor
     * (`stuck`); La Voz lifts her arms to take air, throws them forward on the Calderón, points at
     * where her second voice comes, and hangs low when out of air (`winded`).
     */
    show(model: pc.Entity, unit: Combatant, time: number, dt: number, animate: boolean, pending?: BattleEffect, toCamera = 0, song?: Moment, round = 0, move?: FoeAbilityId) {
      const s = shown.get(model) ?? {};
      shown.set(model, s);
      const ease = (k: number) => animate ? 1 - Math.exp(-dt * k) : 1;
      const kind = unit.kind as CuerdasKind;
      (model.findByName('Vista') as pc.Entity | null)?.setLocalEulerAngles(0, toCamera * TO_CAMERA[kind], 0);
      const float = model.findByName('Flota') as pc.Entity | null;
      const to = (now: number | undefined, want: number, k: number) => (now ?? want) + (want - (now ?? want)) * ease(k);
      // Wound up while its move has yet to land, let go once it has, at rest otherwise.
      s.act = to(s.act, !move || unit.hp <= 0 ? 0 : pending ? -1 : 1, pending ? 9 : 16);
      const wind = Math.max(0, -s.act), go = Math.max(0, s.act);
      if (kind === 'lealtad') {
        const beat = animate ? Math.sin(time * 2.2) : 0;
        const oath = move === 'juramento' ? 1 : 0;
        s.tie = to(s.tie, move === 'lazo' ? 1 : 0, 8);
        const size = 1 + beat * .06 + s.tie * .7;
        (model.findByName('Nudo') as pc.Entity).setLocalScale(size, size, size);
        (model.findByName('Nudo') as pc.Entity).setLocalEulerAngles(0, 0, animate ? time * (14 + s.tie * 260) : 0);
        // Juramento: the shield back against her, then out at arm's length, its strings still shaking.
        (model.findByName('Escudo') as pc.Entity).setLocalPosition(animate ? Math.sin(time * 95) * .012 * go * oath : 0, 0, .36 + oath * (go * .42 - wind * .14));
      } else if (kind === 'eco') {
        const turns = unit.turns ?? 0;
        s.spin = (s.spin ?? 0) + (animate ? dt : 0) * (110 + turns * 70);
        (model.findByName('Órbita') as pc.Entity).setLocalEulerAngles(0, 0, s.spin);
        (model.findByName('Anillo segundo') as pc.Entity).enabled = turns >= 1;
        (model.findByName('Anillo tercero') as pc.Entity).enabled = turns >= 2;
        float?.setLocalPosition(0, 1.15 + (animate ? Math.sin(time * 1.9 + 1) * .07 : 0), 0);
        float?.setLocalEulerAngles(animate ? Math.sin(time * .9) * 10 : 0, animate ? time * 20 : 0, 0);
        // Resonancia: its rings close a little, then open wide.
        const open = 1 + go * .55 - wind * .25;
        float?.setLocalScale(open, open, open);
      } else if (kind === 'cristalino') {
        // Cracked (once its Estallido has landed): it leans, its point slips, its shards fly wide and fast.
        s.crack = to(s.crack, unit.cracked && !pending?.cracked && unit.hp > 0 ? 1 : 0, 7);
        const c = s.crack, flare = move === 'destello' || move === 'prisma' ? wind + go * .5 : 0;
        s.spin = (s.spin ?? 0) + (animate ? dt : 0) * (26 + c * 120 + (move === 'prisma' ? go * 520 : 0));
        const shards = model.findByName('Esquirlas') as pc.Entity;
        shards.setLocalEulerAngles(c * 14, s.spin, 0);
        shards.setLocalScale(1 + c * .5, 1 + c * .25, 1 + c * .5);
        float?.setLocalPosition(0, .12 + (animate ? Math.sin(time * 1.2) * .05 : 0), 0);
        float?.setLocalEulerAngles(0, 0, c * (7 + (animate ? Math.sin(time * 23) * .5 : 0)));
        (model.findByName('Punta') as pc.Entity).setLocalPosition(c * .1, 1.96 - c * .05, c * .05);
        // Its string of light: thicker as it gathers a Destello, and flickering once cracked.
        const cord = 1 + flare * 2.2 + c * (animate ? .5 + Math.sin(time * 31) * .4 : .5);
        (model.findByName('Cuerda de dentro') as pc.Entity).setLocalScale(.03 * cord, 2.05, .03 * cord);
      } else if (kind === 'directo') {
        // What it is about to do shows once the turn that says it lands.
        const intent = pending?.telegraph ? undefined : unit.intent?.ability;
        // An Estocada is drawn from further back than a Golpe directo.
        const wide = intent === 'en-linea' && unit.hp > 0 ? 1 : 0, drawn = unit.hp <= 0 ? 0 : intent === 'estocada' ? 1.9 : intent === 'golpe-directo' ? 1 : 0;
        // After it, the lance stays in the floor in front of it, and it leans on it, until its next turn.
        s.stuck = to(s.stuck, unit.stuck && !pending?.stuck && unit.hp > 0 ? 1 : 0, 10);
        s.bar = (s.bar ?? wide) + (wide - (s.bar ?? wide)) * ease(7);
        s.draw = (s.draw ?? drawn) + (drawn - (s.draw ?? drawn)) * ease(5);
        const bar = model.findByName('Barra') as pc.Entity;
        bar.enabled = s.bar > .02;
        bar.setLocalScale(2.6 * s.bar, .035, .035);
        const lance = model.findByName('Lanza') as pc.Entity;
        const thrust = move === 'golpe-directo' || move === 'estocada' ? go : 0, k = s.stuck;
        lance.setLocalPosition(.36 * (1 - s.bar) * (1 - k), 1.3 - .62 * k, (-.34 * s.draw + thrust * .55) * (1 - k) + .8 * k + (animate ? Math.sin(time * 38) * .006 * s.draw : 0));
        lance.setLocalEulerAngles(58 * k, 0, 0);
        (model.findByName('Vista') as pc.Entity).setLocalEulerAngles(11 * k, toCamera * TO_CAMERA[kind], 0);
      } else if (kind === 'voz') {
        if (!s.voz) {
          const body = ['Vestido', 'Talle', 'Melena'].map(n => material(model, n));
          s.voz = {
            body, strand: material(model, 'Cuerda del vestido'), note: material(model, 'Garganta'),
            rings: [1, 2, 3, 4].map(k => material(model, `Aro ${k}`)), float: float!, halo: model.findByName('Halo') as pc.Entity,
            arms: ['Brazo izquierdo de la voz', 'Brazo derecho de la voz'].map(n => model.findByName(n) as pc.Entity),
            fores: (model.find(n => n.name === 'Antebrazo de la voz') as pc.Entity[]), base: body.map(m => m.diffuse.clone()),
          };
        }
        const v = s.voz, alive = unit.hp > 0;
        const sounding = song ? song.sounding : !unit.silent;
        const there = alive && !sounding ? 0 : 1, guard = alive && (unit.shielded ?? -1) >= round && !(pending?.shielded) ? 1 : 0, glass = alive && unit.clear && !pending?.clear ? 1 : 0;
        s.there = (s.there ?? there) + (there - (s.there ?? there)) * ease(9);
        s.guard = (s.guard ?? guard) + (guard - (s.guard ?? guard)) * ease(6);
        s.glass = (s.glass ?? glass) + (glass - (s.glass ?? glass)) * ease(5);
        // Taking air for her Calderón (from the turn that says it until she lets it go or it breaks); out of air after it broke.
        s.air = to(s.air, alive && unit.intent?.ability === 'calderon' && !pending?.telegraph ? 1 : 0, 5);
        s.winded = to(s.winded, alive && unit.winded ? 1 : 0, 6);
        s.reach = to(s.reach, move === 'coro' ? 1 : 0, 8);
        const air = s.air, low = s.winded, release = move === 'calderon' ? go : 0;
        const want = new pc.Color().fromString(song ? TONES[song.tone].colour : '#dfeaf2');
        s.colour ??= want.clone();
        s.colour.lerp(s.colour, want, ease(10));
        // A note swells as it starts and thins as it ends.
        const swell = song?.sounding ? Math.sin(Math.min(1, song.k * 5) * Math.PI / 2) * (song.left < .5 ? .55 + song.left : 1) : 0;
        const t = s.there, c = s.colour;
        v.body.forEach((m, i) => {
          m.opacity = (.1 + .8 * t) * (1 - .5 * s.glass!);
          m.diffuse.lerp(v.base[i], GLASS, s.glass! * .8);
          // Her own outline stays the void's petrol and silver: the note's colour is in her throat, her strings and her rings.
          m.emissive.lerp(RIM, GLASS, s.glass!); m.emissiveIntensity = .05 + .07 * t * swell + .4 * s.glass!;
          m.gloss = .7 + .28 * s.glass!;
          m.update();
        });
        v.strand.opacity = .22 + .7 * t; v.strand.emissive.set(c.r, c.g, c.b); v.strand.emissiveIntensity = (.5 + 1.6 * swell + 1.4 * air + 2.4 * release) * (1 - .6 * low); v.strand.update();
        v.note.emissive.set(c.r, c.g, c.b); v.note.emissiveIntensity = .15 + 4.2 * swell; v.note.diffuse.set(c.r * t, c.g * t, c.b * t); v.note.update();
        const level = unit.crescendo ?? 0;
        v.rings.forEach((m, k) => {
          const on = k < level ? 1 : 0;
          m.opacity = (.07 + .7 * on) * (.35 + .65 * t); m.emissive.set(c.r, c.g, c.b); m.emissiveIntensity = .2 + on * (1.2 + swell * 1.4); m.update();
        });
        v.halo.setLocalEulerAngles(0, 0, animate ? time * (9 + air * 60) : 0);
        const wide = 1 + air * .3 + release * .5 - low * .12;
        v.halo.setLocalScale(wide, wide, 1);
        v.float.setLocalPosition(0, .32 + (animate ? Math.sin(time * 1.1) * .06 : 0) + swell * .05 + air * .22 - low * .24, 0);
        (model.findByName('Cabeza de chicle') as pc.Entity).setLocalEulerAngles(-16 * air + 26 * low + 8 * release, 0, 0);
        // Open at her sides singing; crossed over her chest on Guardia.
        const g = s.guard, sway = animate ? Math.sin(time * 1.3) * 2 : 0, lift = swell * 6;
        v.arms.forEach((arm, k) => {
          const side = k ? 1 : -1;
          // Up and out to take air, thrown forward as she lets it go, hanging when she has none; one arm out at where her second voice comes.
          const blend = (from: number, want: number, k: number) => from + (want - from) * k;
          const point = k ? s.reach! : 0;
          let x = -(8 + lift) * (1 - g) - 62 * g, z = (14 + lift + sway) * (1 - g) - 22 * g, fx = -(10 + lift * .6) * (1 - g) - 86 * g, fz = -4 * (1 - g) - 58 * g;
          x = blend(x, -12, air); z = blend(z, 122, air); fx = blend(fx, -14, air); fz = blend(fz, 10, air);
          x = blend(x, -84, release); z = blend(z, 24, release); fx = blend(fx, -8, release); fz = blend(fz, 0, release);
          x = blend(x, 14, low); z = blend(z, 4, low); fx = blend(fx, -6, low); fz = blend(fz, 0, low);
          x = blend(x, -20, point); z = blend(z, 84, point); fx = blend(fx, -6, point); fz = blend(fz, 0, point);
          arm.setLocalEulerAngles(x, 0, side * z);
          v.fores[k]?.setLocalEulerAngles(fx, 0, side * fz);
        });
      }
    },
    destroy() { templates.forEach(t => t.destroy()); materials.forEach(m => m.destroy()); meshes.forEach(m => m.destroy()); },
  };
}
/** How big each one stands in the fight. */
export const CUERDAS_SIZES: Record<CuerdasKind, number> = { lealtad: 1.05, eco: .85, cristalino: 1.1, directo: 1.05, voz: 1.3 };
/** How far each turns its front from the party towards the fight's camera (0–1). */
const TO_CAMERA: Record<CuerdasKind, number> = { lealtad: .35, eco: .8, cristalino: 0, directo: .3, voz: .5 };
