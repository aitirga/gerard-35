import * as pc from 'playcanvas';
import { BIP } from './bip.ts';

/**
 * Bip's remote bomb (Bomba remota, docs/animas/tecnopata/README.md): a small machine stuck on a foe,
 * built from primitives like Bip so it reads as his. A graphite puck with a cyan band round its
 * waist, four clamps that grip the body it is on, a dome on top with a red lamp under the glass and
 * a short antenna. While it counts, the lamp flashes red, and the flashes come faster and harder as
 * its time runs out; its band turns from Bip's cyan to red, and in its last second it trembles and
 * swells. The bigger it has grown (`charge`), the bigger it is drawn.
 *
 * The caller places the root (`entity`: where it sits, which way it faces) and calls `flash` on each
 * beat; `animate` moves the rest.
 */
export const BOMB = {
  /** How big it is drawn at no charge, × the foe's scale, and how much more at its top. */
  size: .62, grows: .5,
  /** The flash's beat: seconds between flashes with `slow` seconds left or more, down to `fast` at the end. */
  slow: 9, longest: .95, fast: .075,
  red: '#ff2a2a',
  /** Going off, it implodes first for this long (a small black hole, src/battle-scene.ts `bombBlast`), with this reach (m) at its size. */
  implode: .8, hole: 1.5,
} as const;
const SHELL = '#1c232b', TRIM = '#3a4652';

export interface BombAction {
  /** 0 just stuck on to 1 about to go off. */
  heat: number;
  /** How far it has grown, 0 to 1 (its top). */
  charge: number;
  /** 0 to 1: grown in from nothing as it is stuck on. */
  shown: number;
  animate?: boolean;
}

export function createBomb(app: pc.Application) {
  const mats: pc.StandardMaterial[] = [];
  const paint = (hex: string, gloss: number, metal = 0) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss;
    if (metal) { m.useMetalness = true; m.metalness = metal; }
    m.update(); mats.push(m); return m;
  };
  const lamp = (hex: string, intensity: number) => {
    const m = new pc.StandardMaterial(); m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = intensity; m.useLighting = false;
    m.update(); mats.push(m); return m;
  };
  const halo = (hex: string, opacity: number) => {
    const m = new pc.StandardMaterial(); m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = 1.6; m.useLighting = false;
    m.blendType = pc.BLEND_ADDITIVEALPHA; m.opacity = opacity; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update(); mats.push(m); return m;
  };
  const shell = paint(SHELL, .7, .55), trim = paint(TRIM, .6, .4), glass = paint('#3a0a0e', .95);
  shell.emissive.fromString('#0c1216'); shell.update();
  const band = lamp(BIP.cyan, 2.2), bulb = lamp(BOMB.red, .9), tip = lamp(BOMB.red, 1), glow = halo(BOMB.red, 0);

  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], shadows = false) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: shadows, receiveShadows: false });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const root = new pc.Entity('Bomba remota');
  const body = new pc.Entity('Cuerpo de la bomba'); root.addChild(body);
  // The puck, its back flat against the foe (local −z), its face to the camera (+z).
  part(body, 'Carcasa', 'cylinder', shell, [0, 0, 0], [.62, .3, .62], [90, 0, 0], true);
  part(body, 'Frente', 'cylinder', trim, [0, 0, .16], [.48, .04, .48], [90, 0, 0]);
  part(body, 'Banda', 'torus', band, [0, 0, .02], [.66, .05, .66], [90, 0, 0]);
  // Four clamps biting into whatever it is stuck on.
  for (let k = 0; k < 4; k++) {
    const a = k * 90 + 45, x = Math.cos(a * Math.PI / 180) * .34, y = Math.sin(a * Math.PI / 180) * .34;
    part(body, 'Garra', 'box', trim, [x, y, -.1], [.09, .09, .2], [0, 0, a]);
  }
  // The dome on its face: a red lamp under dark glass, and its glow, which swells with each flash.
  part(body, 'Cúpula', 'sphere', glass, [0, 0, .2], [.24, .24, .16]);
  const light = part(body, 'Piloto', 'sphere', bulb, [0, 0, .24], [.13, .13, .09]);
  const bloom = part(body, 'Destello', 'sphere', glow, [0, 0, .26], [.5, .5, .5]);
  // A short antenna out of its top edge, its tip a second red lamp.
  part(body, 'Antena', 'cylinder', trim, [.18, .36, .02], [.03, .24, .03], [0, 0, -18]);
  part(body, 'Punta', 'sphere', tip, [.215, .48, .02], [.06, .06, .06]);
  const lit = new pc.Entity('Luz de la bomba'); body.addChild(lit); lit.setLocalPosition(0, 0, .5);
  lit.addComponent('light', { type: 'omni', color: new pc.Color().fromString(BOMB.red), intensity: 0, range: 1.6, castShadows: false });
  app.root.addChild(root);

  const cyan = new pc.Color().fromString(BIP.cyan), hot = new pc.Color().fromString(BOMB.red), hue = new pc.Color();
  let flashing = 0, time = 0;
  return {
    entity: root,
    /** A beat of its count: the lamp flares red, `strength` 0 to 1 (harder near the end). */
    flash(strength: number) { flashing = Math.max(flashing, .45 + .55 * strength); },
    animate(dt: number, a: BombAction) {
      time += dt;
      flashing = a.animate === false ? 0 : flashing * Math.exp(-dt * 16);
      // Its band slides from Bip's cyan to red as it runs out.
      hue.lerp(cyan, hot, Math.min(1, a.heat * 1.15));
      band.emissive.copy(hue); band.emissiveIntensity = 2 + 1.6 * a.heat; band.update();
      const on = .8 + 6 * flashing;
      bulb.emissiveIntensity = on; bulb.update();
      tip.emissiveIntensity = .4 + 4 * flashing; tip.update();
      glow.opacity = Math.min(.85, flashing * (.5 + .5 * a.heat)); glow.update();
      bloom.setLocalScale(.35 + .5 * flashing, .35 + .5 * flashing, .35 + .5 * flashing);
      light.setLocalScale(.13 + .03 * flashing, .13 + .03 * flashing, .09);
      if (lit.light) lit.light.intensity = 3.2 * flashing * (.5 + .5 * a.heat);
      // In its last stretch it trembles and swells, as if what it holds wanted out.
      const end = a.animate === false ? 0 : Math.max(0, (a.heat - .85) / .15);
      const shake = .02 * end;
      body.setLocalPosition((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0);
      const pop = a.shown < 1 ? 1 + 1.4 * (a.shown - 1) ** 3 + .5 * (a.shown - 1) ** 2 : 1;
      const s = Math.max(.001, pop) * (1 + .08 * end + .05 * flashing);
      body.setLocalScale(s, s, s);
      body.setLocalEulerAngles(0, 0, Math.sin(time * 1.3) * 3);
    },
    destroy() { root.destroy(); mats.forEach(m => m.destroy()); },
  };
}
export type Bomb = ReturnType<typeof createBomb>;
