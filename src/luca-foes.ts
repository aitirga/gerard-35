import * as pc from 'playcanvas';
import type { LucaKind } from './battle';

/**
 * Fran's salon's foes (docs/quests/luca.md § Monsters), built from primitives and named as the fight
 * looks for a part (`Charco pringoso` under them, `Vista` to turn to the camera, `Cabeza de chicle`
 * for a head). They are what is eating Luca's colour, so the moths are grey and the rest carry his
 * colours or the salon's. A Polilla, grey wings round a dusty body, hovering. An Estampado, a stiff
 * patch of loud pattern standing on its edge, in its own colour. El Telescopio, a brass tube on a
 * tripod with a glass lens. La Laca, a pale cloud round a gold spray can. A Capellán, a chaplain in
 * black with a white collar, his hair sculpted into a shape and colour that are not his. No pink and
 * no violet anywhere (docs/visual-style.md).
 */
export function createLucaFoes() {
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
  const pivot = (parent: pc.Entity, name: string, at: number[] = [0, 0, 0]) => { const e = new pc.Entity(name); e.setLocalPosition(at[0], at[1], at[2]); parent.addChild(e); return e; };
  const roots: pc.Entity[] = [];
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; roots.push(e); return e; };
  /** Where each stands: a pale disc of the window's light in place of a shadow. */
  const pool = (parent: pc.Entity, hex: string, size: number) => part(parent, 'Charco pringoso', 'cylinder', mat('Luz del suelo', hex, .2, .3, .16), [0, .012, 0], [size, .01, size], [0, 0, 0], false);

  // A Polilla: a grey, furred body and four wings of dusty grey, hovering at chest height.
  const moth = root('Polilla');
  pool(moth, '#d6dae0', .9);
  const mothBody = pivot(moth, 'Vista', [0, 1.1, 0]);
  const dust = mat('Polvo de polilla', '#9a9890', .1), wingMat = mat('Ala de polilla', '#b8b4aa', .1, 0, .92), vein = mat('Vena del ala', '#6f6c66', .1);
  part(mothBody, 'Cuerpo', 'capsule', dust, [0, 0, 0], [.16, .42, .16], [90, 0, 0]);
  const mothHead = pivot(mothBody, 'Cabeza de chicle', [0, .02, .22]);
  part(mothHead, 'Cabeza', 'sphere', dust, [0, 0, 0], [.15, .14, .14]);
  for (const side of [-1, 1]) {
    part(mothHead, 'Antena', 'cylinder', vein, [side * .05, .1, .04], [.012, .18, .012], [30, 0, side * -25], false);
    part(mothBody, 'Ala', 'box', wingMat, [side * .3, .04, .05], [.5, .02, .34], [0, side * -12, side * 18], false);
    part(mothBody, 'Ala baja', 'box', wingMat, [side * .24, .0, -.14], [.36, .02, .24], [0, side * 20, side * 12], false);
    part(mothBody, 'Mancha', 'cylinder', vein, [side * .34, .06, .06], [.1, .01, .1], [0, 0, side * 18], false);
  }

  // An Estampado: a stiff patch of loud pattern standing on its edge, its colour its own.
  const patch = (name: string, hex: string, accent: string) => {
    const e = root(name);
    pool(e, hex, 1.1);
    const face = pivot(e, 'Vista', [0, 0, 0]);
    const cloth = mat(`Tela ${name}`, hex, .3, .15), print = mat(`Estampado ${name}`, accent, .3, .25), edge = mat('Costura', '#f1ece2', .2);
    part(face, 'Tela', 'box', cloth, [0, .95, 0], [1.05, 1.5, .06], [0, 0, 4]);
    part(face, 'Costura', 'box', edge, [0, .95, -.035], [1.12, 1.57, .02], [0, 0, 4], false);
    for (let i = 0; i < 6; i++) part(face, 'Lunar', 'cylinder', print, [-.3 + (i % 3) * .3, .55 + Math.floor(i / 3) * .55 + (i % 2) * .12, .04], [.2, .02, .2], [90, 0, 0], false);
    part(face, 'Flor', 'sphere', print, [.18, 1.42, .05], [.24, .24, .06], [0, 0, 0], false);
    pivot(face, 'Cabeza de chicle', [0, 1.55, .05]);
    return e;
  };
  const red = patch('Estampado rojo', '#e8503a', '#ffd84f'), blue = patch('Estampado azul', '#4f9fe8', '#f1ece2'), gold = patch('Estampado oro', '#ffd84f', '#2f8f7a');

  // El Telescopio: a brass tube on a tripod, its lens a disc of glass that lights up when it focuses.
  const scope = root('El Telescopio');
  pool(scope, '#ffd84f', 1.4);
  const brass = mat('Latón', '#c89a3a', .85), darkBrass = mat('Latón viejo', '#7d6128', .7), lens = mat('Lente', '#e9f3ff', .95, .6, .85);
  for (let k = 0; k < 3; k++) {
    const a = k * 120;
    part(scope, 'Pata', 'cylinder', darkBrass, [Math.sin(a * Math.PI / 180) * .32, .55, Math.cos(a * Math.PI / 180) * .32], [.05, 1.15, .05], [Math.cos(a * Math.PI / 180) * 16, 0, -Math.sin(a * Math.PI / 180) * 16]);
  }
  const tube = pivot(scope, 'Vista', [0, 1.2, 0]);
  part(tube, 'Rótula', 'sphere', darkBrass, [0, 0, 0], [.2, .2, .2]);
  const barrel = pivot(tube, 'Cabeza de chicle', [0, .12, 0]);
  barrel.setLocalEulerAngles(-24, 0, 0);
  part(barrel, 'Tubo', 'cylinder', brass, [0, 0, .3], [.26, 1.3, .26], [90, 0, 0]);
  part(barrel, 'Tubo ancho', 'cylinder', brass, [0, 0, .9], [.36, .3, .36], [90, 0, 0]);
  part(barrel, 'Ocular', 'cylinder', darkBrass, [0, 0, -.42], [.12, .2, .12], [90, 0, 0]);
  part(barrel, 'Lente', 'cylinder', lens, [0, 0, 1.06], [.3, .02, .3], [90, 0, 0], false);

  // La Laca: a gold spray can inside a pale, drifting cloud.
  const laca = root('La Laca');
  pool(laca, '#f2e2a8', 1.3);
  const can = pivot(laca, 'Vista', [0, 0, 0]);
  const tin = mat('Bote dorado', '#d9b24a', .85), cap = mat('Tapón', '#f1ece2', .5), cloud = mat('Nube de fijador', '#f6f0dc', .1, .15, .5);
  part(can, 'Bote', 'cylinder', tin, [0, .55, 0], [.4, 1.0, .4]);
  part(can, 'Hombro', 'sphere', tin, [0, 1.05, 0], [.4, .18, .4]);
  part(can, 'Tapón', 'cylinder', cap, [0, 1.2, 0], [.2, .16, .2]);
  pivot(can, 'Cabeza de chicle', [0, 1.25, 0]);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2;
    part(can, 'Nube', 'sphere', cloud, [Math.sin(a) * .5, .9 + (k % 3) * .25, Math.cos(a) * .4], [.55, .45, .55], [0, 0, 0], false);
  }

  // A Capellán: a chaplain in black with a white collar; his hair, restyled by Fran, a tall sculpted
  // quiff in an odd colour.
  const chaplain = root('Capellán');
  pool(chaplain, '#e9e4d8', 1);
  const priest = pivot(chaplain, 'Vista');
  const cassock = mat('Sotana', '#18181c', .35), collar = mat('Alzacuellos', '#f4f2ec', .5), skin = mat('Piel', '#dcb594', .3), hair = mat('Pelo de capellán', '#3e7fc4', .6, .15);
  part(priest, 'Sotana', 'cone', cassock, [0, .6, 0], [.68, 1.2, .55]);
  part(priest, 'Torso', 'cylinder', cassock, [0, 1.35, 0], [.38, .6, .3]);
  part(priest, 'Alzacuellos', 'cylinder', collar, [0, 1.66, 0], [.2, .06, .2]);
  for (const side of [-1, 1]) {
    part(priest, 'Brazo', 'cylinder', cassock, [side * .25, 1.25, .06], [.11, .6, .11], [-20, 0, side * -10]);
    part(priest, 'Mano', 'sphere', skin, [side * .3, .98, .2], [.1, .1, .1]);
  }
  const priestHead = pivot(priest, 'Cabeza de chicle', [0, 1.86, 0]);
  part(priestHead, 'Cabeza', 'sphere', skin, [0, 0, 0], [.3, .34, .3]);
  part(priestHead, 'Tupé', 'cone', hair, [0, .26, .04], [.26, .42, .22], [-18, 0, 0]);
  part(priestHead, 'Sienes rapadas', 'sphere', mat('Sombra de pelo', '#2a2a2e', .3), [0, .06, -.04], [.31, .22, .28], [0, 0, 0], false);

  // Fran: very tall and thin, in a hairdresser's black, a high sculpted quiff, the white cutting cape
  // worn like a chasuble with chalk curves on it, and the violet eyes of whoever the Queen holds.
  const fran = root('Fran');
  pool(fran, '#e9e4d8', 1.4);
  const man = pivot(fran, 'Vista');
  const black = mat('Ropa negra', '#1c1c20', .45), cape = mat('Capa de corte', '#f4f2ec', .35), chalk = mat('Tiza', '#9aa3ad', .2), steel = mat('Tijeras', '#d9dde4', .9, .2);
  const franSkin = mat('Piel de Fran', '#e2b896', .3), franHair = mat('Pelo de Fran', '#1d1a1a', .7), eyes = mat('Ojos poseídos', '#c9a2ff', .6, 2.2);
  for (const side of [-1, 1]) part(man, 'Pierna', 'cylinder', black, [side * .12, .62, 0], [.13, 1.24, .13]);
  part(man, 'Torso', 'cylinder', black, [0, 1.6, 0], [.34, .8, .26]);
  part(man, 'Capa', 'cone', cape, [0, 1.45, 0], [.95, 1.15, .7]);
  for (let k = 0; k < 3; k++) part(man, 'Curva de tiza', 'box', chalk, [-.18 + k * .18, 1.4 - k * .06, .37], [.03, .5, .01], [0, 0, -20 + k * 20], false);
  part(man, 'Cuello', 'cylinder', franSkin, [0, 2.12, 0], [.12, .22, .12]);
  const franHead = pivot(man, 'Cabeza de chicle', [0, 2.38, 0]);
  part(franHead, 'Cabeza', 'sphere', franSkin, [0, 0, 0], [.3, .36, .3]);
  part(franHead, 'Tupé', 'cone', franHair, [0, .26, .05], [.24, .36, .2], [-24, 0, 0]);
  for (const side of [-1, 1]) part(franHead, 'Ojo', 'sphere', eyes, [side * .07, .02, .14], [.05, .04, .03], [0, 0, 0], false);
  part(man, 'Tijeras', 'box', steel, [.34, 1.0, .1], [.03, .32, .08], [0, 0, 12]);

  // A lamp of the canopy: a hanging glass lamp in the colours of the lights it drinks.
  const lamp = root('Lámpara');
  const hanger = pivot(lamp, 'Vista', [0, 0, 0]);
  const chain = mat('Cadena', '#7d6128', .7), glass = mat('Cristal de lámpara', '#f6f0dc', .9, .9, .85);
  part(hanger, 'Cadena', 'cylinder', chain, [0, 2.2, 0], [.03, 1.2, .03], [0, 0, 0], false);
  part(hanger, 'Lámpara', 'sphere', glass, [0, 1.45, 0], [.42, .5, .42]);
  part(hanger, 'Corona', 'cylinder', chain, [0, 1.72, 0], [.3, .06, .3]);
  pivot(hanger, 'Cabeza de chicle', [0, 1.45, 0]);

  const templates = new Map<LucaKind, pc.Entity>([
    ['fran', fran], ['lampara', lamp],
    ['polilla', moth], ['estampado-rojo', red], ['estampado-azul', blue], ['estampado-oro', gold],
    ['telescopio', scope], ['laca', laca], ['capellan', chaplain],
  ]);
  return {
    templates,
    /** Adds the templates under `parent` (disabled: the fight clones them). */
    attach(parent: pc.Entity) { for (const e of roots) parent.addChild(e); },
    destroy() { roots.forEach(e => e.destroy()); materials.forEach(m => m.destroy()); },
  };
}
/** How big each one stands in the fight. */
export const LUCA_SIZES: Record<LucaKind, number> = {
  polilla: .9, 'estampado-rojo': 1, 'estampado-azul': 1, 'estampado-oro': 1, telescopio: 1.1, laca: 1, capellan: 1.05, fran: 1.2, lampara: .8,
};
