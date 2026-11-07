import * as pc from 'playcanvas';

/**
 * Bip, Aitor's little robot (docs/animas/tecnopata/README.md): a drone the size of a melon that
 * floats beside whoever wears Tecnópata and does the hitting for him. Built from primitives like
 * the cats: a round white body under a graphite cap, a flat rectangular screen of black glass on its
 * front with one eye, a pill of cyan light that blinks and glances, an antenna whose tip blinks, two
 * little rotors on arms out of its sides, and under it a thruster with a halo of cyan light that
 * breathes as it hovers. A small cyan light rides with it, so it lights whoever it floats by.
 *
 * The caller places the root (`entity`: where it floats, which way it faces); `animate` moves what
 * hangs from it: the bob, the lean, the eye, the antenna, the rotors and the thruster.
 */
export const BIP = {
  /** Its colour: Tecnópata's cyan; charged with Gerard's fire (Rayo solar), sun yellow. */
  cyan: '#4fe0ff', solar: '#ffcf3a',
  /** Height it floats at over the floor, × its wearer's height scale (by Aitor's head), and how far beside him (m). */
  height: 1.3, beside: .62,
  /** How big it is drawn, so it reads from the fight's camera (like the cats, a touch bigger than life). */
  scale: 1.25,
} as const;
const SHELL = '#eef3f6', CAP = '#26323c', GLASS = '#071018';

export interface BipAction {
  /** A point it looks at (world); its eye glances there. */
  look?: pc.Vec3;
  /** Leaning into a dash (0 still, 1 flying forward flat out). */
  lean?: number;
  /** Its eye and lights, 0 off to 1 on (it powers up as it forms and down as it goes). */
  power?: number;
  /** How far its lights have turned sun yellow, 0 cyan to 1 (charged with Rayo solar), and they glow brighter. */
  solar?: number;
  /** With reduced motion it holds still. */
  animate?: boolean;
}

export function createBip(app: pc.Application) {
  const mats: pc.StandardMaterial[] = [];
  const paint = (hex: string, gloss: number, metal = 0) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss;
    if (metal) { m.useMetalness = true; m.metalness = metal; }
    m.update(); mats.push(m); return m;
  };
  /** Light, not paint: it blooms (the eye, the antenna's tip, the pods' rings). */
  const lamp = (hex: string, intensity: number) => {
    const m = new pc.StandardMaterial(); m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = intensity; m.useLighting = false;
    m.update(); mats.push(m); return m;
  };
  /** A soft halo: added on top of what is behind it, never hiding it. */
  const halo = (hex: string, opacity: number) => {
    const m = new pc.StandardMaterial(); m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = 1.4; m.useLighting = false;
    m.blendType = pc.BLEND_ADDITIVEALPHA; m.opacity = opacity; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update(); mats.push(m); return m;
  };
  const shell = paint(SHELL, .82);
  // A faint glow of its own, so it reads white under any light (the Queen's pink evening too).
  shell.emissive.fromString('#2c3a42'); shell.update();
  const cap = paint(CAP, .6, .3), glass = paint(GLASS, .95), eye = lamp(BIP.cyan, 2.4), tip = lamp(BIP.cyan, 3), ring = lamp(BIP.cyan, 1.6), glow = halo(BIP.cyan, .22), blur = halo(BIP.cyan, .12);

  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], shadows = true) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: shadows, receiveShadows: shadows });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const pivot = (parent: pc.Entity, name: string, p: number[]) => { const e = new pc.Entity(name); e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e); return e; };

  const root = new pc.Entity('Bip');
  // Everything hangs from the body, so the bob and the lean carry it all.
  const body = pivot(root, 'Cuerpo de Bip', [0, 0, 0]);
  // A round white body under a graphite cap.
  part(body, 'Carcasa', 'sphere', shell, [0, 0, 0], [.28, .25, .27]);
  part(body, 'Casquete', 'sphere', cap, [0, .075, -.012], [.24, .12, .23]);
  // Its face: a flat rectangular screen of black glass in a graphite bezel, and on it one eye, a
  // pill of cyan light lying on its side.
  part(body, 'Marco de la pantalla', 'box', cap, [0, -.005, .112], [.19, .128, .04]);
  part(body, 'Pantalla', 'box', glass, [0, -.005, .128], [.168, .106, .016]);
  const look = pivot(body, 'Mirada', [0, -.005, .137]);
  const iris = part(look, 'Ojo de Bip', 'capsule', eye, [0, 0, 0], [.04, .1, .012], [0, 0, 90], false);
  // The antenna: a thin rod from the cap, leaning back a little, with a tip that blinks.
  const antenna = pivot(body, 'Antena', [.04, .12, -.03]);
  part(antenna, 'Varilla', 'cylinder', cap, [0, .055, 0], [.012, .11, .012]);
  const light = part(antenna, 'Punta de la antena', 'sphere', tip, [0, .118, 0], [.034, .034, .034], [0, 0, 0], false);
  // Two little rotors on arms out of its sides: a hub, two blades turning and the blur of them.
  const rotors: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    part(body, 'Brazo del rotor', 'box', cap, [side * .17, .04, -.01], [.09, .018, .03]);
    part(body, 'Buje', 'cylinder', cap, [side * .218, .058, -.01], [.036, .03, .036]);
    part(body, 'Aro del rotor', 'torus', ring, [side * .218, .072, -.01], [.05, .01, .05], [0, 0, 0], false);
    const rotor = pivot(body, 'Rotor', [side * .218, .078, -.01]);
    part(rotor, 'Pala', 'box', cap, [0, 0, 0], [.17, .005, .024], [0, 0, 0], false);
    part(rotor, 'Pala', 'box', cap, [0, 0, 0], [.024, .005, .17], [0, 0, 0], false);
    part(body, 'Estela del rotor', 'cylinder', blur, [side * .218, .079, -.01], [.18, .003, .18], [0, 0, 0], false);
    rotors.push(rotor);
  }
  // The thruster under it, and its halo: a short cone of light that breathes.
  part(body, 'Propulsor', 'cylinder', cap, [0, -.118, 0], [.1, .04, .1]);
  part(body, 'Tobera', 'torus', ring, [0, -.14, 0], [.078, .014, .078], [0, 0, 0], false);
  const flame = pivot(body, 'Chorro', [0, -.145, 0]);
  part(flame, 'Halo del chorro', 'cone', glow, [0, -.055, 0], [.09, .11, .09], [180, 0, 0], false);
  part(flame, 'Núcleo del chorro', 'cone', glow, [0, -.045, 0], [.05, .09, .05], [180, 0, 0], false);
  // A little light of its own, so its cyan falls on whoever it floats by.
  const lit = pivot(body, 'Luz de Bip', [0, 0, .25]);
  lit.addComponent('light', { type: 'omni', color: new pc.Color().fromString(BIP.cyan), intensity: .7, range: 1.4, castShadows: false });
  app.root.addChild(root);

  let time = Math.random() * 10, blinkAt = 2 + Math.random() * 2, blink = 1;
  const cyan = new pc.Color().fromString(BIP.cyan), sun = new pc.Color().fromString(BIP.solar), hue = new pc.Color();
  const glance = new pc.Vec3(), inverse = new pc.Mat4();
  return {
    entity: root, body,
    /** Poses it for this frame, after the caller has placed `entity`. */
    animate(dt: number, action: BipAction = {}) {
      const moving = action.animate !== false, power = action.power ?? 1, lean = action.lean ?? 0;
      if (moving) time += dt;
      // Hovering: a slow bob and a little sway; leaning into a dash, nose down.
      const bob = moving ? Math.sin(time * 2.4) * .035 : 0;
      body.setLocalPosition(0, bob, 0);
      body.setLocalEulerAngles(moving ? 18 * lean + Math.sin(time * 1.3) * 3 : 0, 0, moving ? Math.sin(time * 1.7) * 4 : 0);
      antenna.setLocalEulerAngles(-12 - lean * 25 + (moving ? Math.sin(time * 3.1) * 6 : 0), 0, moving ? Math.sin(time * 2.3 + 1) * 5 : 0);
      // It blinks every few seconds, and glances at what it is told to look at.
      if (moving) {
        blinkAt -= dt;
        if (blinkAt <= 0) { blink = 0; blinkAt = 2.5 + Math.random() * 3; }
        blink = Math.min(1, blink + dt * 9);
      }
      const open = power * (moving ? Math.max(.08, Math.abs(blink * 2 - 1)) : 1);
      iris.setLocalScale(.04 * open, .1, .012);
      // The rotors turn, faster as it dashes.
      if (moving) rotors.forEach((rotor, i) => rotor.setLocalEulerAngles(0, (time * (900 + lean * 900) * (i ? 1 : -1)) % 360, 0));
      if (action.look) {
        inverse.copy(body.getWorldTransform()).invert();
        inverse.transformPoint(action.look, glance);
        const d = Math.hypot(glance.x, glance.y, glance.z) || 1;
        look.setLocalPosition(glance.x / d * .04, -.005 + glance.y / d * .025, .137);
      }
      // Its lights follow its power, in its colour (sun yellow while charged, and brighter); the tip blinks, the thruster breathes.
      const solar = action.solar ?? 0, boost = 1 + solar * (moving ? .9 + Math.sin(time * 11) * .25 : .9);
      hue.lerp(cyan, sun, solar);
      for (const m of [eye, tip, ring, glow, blur]) m.emissive.copy(hue);
      eye.emissiveIntensity = 2.4 * power * boost; eye.update();
      tip.emissiveIntensity = 3 * power * boost * (moving && Math.sin(time * 5) < -.6 ? .15 : 1); tip.update();
      ring.emissiveIntensity = 1.6 * power * boost; ring.update();
      glow.update(); blur.update();
      const breath = moving ? 1 + Math.sin(time * 9) * .12 + lean * .5 : 1;
      flame.setLocalScale(power, power * breath * (1 + solar * .6), power);
      lit.light!.color = hue; lit.light!.intensity = .7 * power * (1 + solar * 1.6);
      light.enabled = power > .05;
    },
    destroy() { root.destroy(); mats.forEach(m => m.destroy()); },
  };
}
export type Bip = ReturnType<typeof createBip>;
