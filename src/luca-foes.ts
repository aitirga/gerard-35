import * as pc from 'playcanvas';
import type { LucaKind } from './battle';
import { FOE_BODIES } from './foe-bodies.ts';

/**
 * Fran's salon's foes (docs/quests/luca.md § Monsters), built from primitives and named as the fight
 * looks for a part (`Charco pringoso` under them, `Vista` to turn to the camera, `Cabeza de chicle`
 * for a head). They are what is eating Luca's colour, so the moths are grey and the rest carry his
 * colours or the salon's. A Polilla, grey wings round a dusty body, hovering. An Estampado, a stiff
 * patch of loud pattern standing on its edge, in its own colour. A Capellán, a chaplain in
 * black with a white collar, his hair sculpted into a shape and colour that are not his. No pink and
 * no violet anywhere (docs/visual-style.md).
 */
/**
 * `body` builds a Meshy figure into a template (`buildFoeBody`, src/character-model.ts), passed in by src/fears.ts
 * so this file stays loadable outside the browser (the tests read LUCA_SIZES).
 */
export function createLucaFoes(body: (id: string, parent: pc.Entity) => pc.Entity) {
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

  // A Polilla (`just character-3d polilla`, Aitor's note: flight): a furred grey body and wings spread wide,
  // flecked with the colour it ate, flying at chest height. Its figure stands upright, face on; here it is
  // laid down, back to the sky and head to the party, so the high camera sees the wings open, and they
  // beat up and down round the body (their own nodes, `wings` in tools/figures.toml; battle-scene.ts).
  const moth = root('Polilla');
  pool(moth, '#d6dae0', .9);
  const mothBody = pivot(moth, 'Vista', [0, 1.1, 0]);
  mothBody.setLocalEulerAngles(0, 180, 0);
  const flight = pivot(mothBody, 'Vuelo');
  flight.setLocalEulerAngles(-68, 0, 0);
  flight.setLocalScale(1.35, 1.35, 1.35);
  const mothFigure = body(FOE_BODIES.polilla!, pivot(flight, 'Centro', [0, -.45, 0]));
  (mothFigure.findByName('Charco pringoso') as pc.Entity).enabled = false;

  // A shirt of Luca's (`estampado-*`): one of his loud shirts on a wire hanger, nobody in it, hanging in the
  // air. It is dressed twice over the same hanger: in its own colour and print (`Encendida`), as it is
  // in the light of that colour, and as grey cloth (`Apagada`), out of it (`lightShirt` shows one).
  const wire = mat('Percha', '#c9ccd2', .85), dullCloth = mat('Tela apagada', '#a9acb2', .15), dullPrint = mat('Estampado apagado', '#c2c4c9', .15), dullEdge = mat('Costura apagada', '#d3d5d9', .15);
  const shirt = (name: string, hex: string, accent: string) => {
    const e = root(name);
    pool(e, hex, 1.1);
    // Hung three-quarters to the camera: face on to the party it would be seen by its edge.
    const face = pivot(e, 'Vista', [0, .25, 0]);
    face.setLocalEulerAngles(0, 60, 0);
    part(face, 'Gancho', 'cylinder', wire, [0, 1.98, 0], [.025, .34, .025], [0, 0, 0], false);
    part(face, 'Percha', 'box', wire, [0, 1.76, 0], [.86, .03, .03], [0, 0, 0], false);
    const dress = (group: string, cloth: pc.Material, print: pc.Material, edge: pc.Material) => {
      const g = pivot(face, group);
      part(g, 'Cuerpo', 'box', cloth, [0, 1.12, 0], [.8, 1.2, .1]);
      for (const side of [-1, 1]) {
        part(g, 'Manga', 'box', cloth, [side * .54, 1.52, 0], [.42, .34, .09], [0, 0, side * -32]);
        part(g, 'Cuello', 'box', edge, [side * .12, 1.74, .06], [.22, .1, .04], [0, 0, side * 24], false);
      }
      part(g, 'Tapeta', 'box', edge, [0, 1.12, .056], [.05, 1.16, .01], [0, 0, 0], false);
      for (let k = 0; k < 4; k++) part(g, 'Botón', 'sphere', print, [0, .72 + k * .27, .066], [.05, .05, .03], [0, 0, 0], false);
      // His prints: big dots down one side, a flower on the chest.
      for (let i = 0; i < 6; i++) part(g, 'Lunar', 'cylinder', print, [(i % 2 ? -.24 : .22) + (i % 3 - 1) * .05, .66 + i * .17, .056], [.14, .012, .14], [90, 0, 0], false);
      part(g, 'Flor', 'sphere', print, [-.2, 1.5, .06], [.2, .2, .04], [0, 0, 0], false);
      return g;
    };
    dress('Encendida', mat(`Tela ${name}`, hex, .3, .3), mat(`Estampado ${name}`, accent, .3, .35), mat(`Costura ${name}`, '#f1ece2', .2));
    dress('Apagada', dullCloth, dullPrint, dullEdge).enabled = false;
    pivot(face, 'Cabeza de chicle', [0, 1.7, .05]);
    return e;
  };
  const red = shirt('Camisa roja', '#e8503a', '#ffd84f'), blue = shirt('Camisa azul', '#4f9fe8', '#f1ece2'), gold = shirt('Camisa dorada', '#ffd84f', '#2f8f7a');

  // A Capellán: a chaplain in black with a white collar; his hair restyled by Fran, each one's in a
  // shape and a colour of Luca's that are not his (`styleChaplain` shows one of them): a tall quiff
  // swept up and forward in blue, a row of lacquered spikes in orange, a hard side parting in teal.
  const chaplain = root('Capellán');
  pool(chaplain, '#e9e4d8', 1);
  const priest = pivot(chaplain, 'Vista');
  const cassock = mat('Sotana', '#18181c', .35), collar = mat('Alzacuellos', '#f4f2ec', .5), skin = mat('Piel', '#dcb594', .3), shaved = mat('Sombra de pelo', '#2a2a2e', .3);
  part(priest, 'Sotana', 'cone', cassock, [0, .6, 0], [.68, 1.2, .55]);
  part(priest, 'Torso', 'cylinder', cassock, [0, 1.35, 0], [.38, .6, .3]);
  part(priest, 'Alzacuellos', 'cylinder', collar, [0, 1.66, 0], [.2, .06, .2]);
  for (const side of [-1, 1]) {
    part(priest, 'Brazo', 'cylinder', cassock, [side * .25, 1.25, .06], [.11, .6, .11], [-20, 0, side * -10]);
    part(priest, 'Mano', 'sphere', skin, [side * .3, .98, .2], [.1, .1, .1]);
  }
  const priestHead = pivot(priest, 'Cabeza de chicle', [0, 1.86, 0]);
  part(priestHead, 'Cabeza', 'sphere', skin, [0, 0, 0], [.3, .34, .3]);
  part(priestHead, 'Sienes rapadas', 'sphere', shaved, [0, .06, -.04], [.31, .22, .28], [0, 0, 0], false);
  const quiff = pivot(priestHead, 'Peinado 0'), blueHair = mat('Tupé azul', '#3e7fc4', .7, .18);
  part(quiff, 'Tupé', 'sphere', blueHair, [0, .2, -.02], [.3, .2, .3]);
  part(quiff, 'Tupé', 'sphere', blueHair, [0, .32, .05], [.27, .24, .27]);
  part(quiff, 'Tupé', 'sphere', blueHair, [0, .43, .13], [.22, .2, .24]);
  part(quiff, 'Rizo del tupé', 'sphere', blueHair, [0, .46, .24], [.15, .13, .16]);
  const spikes = pivot(priestHead, 'Peinado 1'), orangeHair = mat('Púas naranjas', '#f08a2c', .75, .18);
  part(spikes, 'Base de las púas', 'sphere', orangeHair, [0, .16, 0], [.3, .14, .3]);
  for (let k = 0; k < 5; k++) part(spikes, 'Púa', 'cone', orangeHair, [0, .3 + Math.sin(k / 4 * Math.PI) * .05, -.14 + k * .07], [.09, .26, .09], [-28 + k * 14, 0, 0]);
  const parting = pivot(priestHead, 'Peinado 2'), tealHair = mat('Raya verde', '#2f8f7a', .85, .15);
  part(parting, 'Casco de pelo', 'sphere', tealHair, [0, .14, -.01], [.33, .2, .32]);
  part(parting, 'Onda', 'sphere', tealHair, [.09, .2, .1], [.2, .13, .2], [0, 0, -20]);
  part(parting, 'Raya', 'box', shaved, [-.08, .235, 0], [.015, .02, .26], [0, 0, 0], false);
  spikes.enabled = parting.enabled = false;

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
  pool(lamp, '#fff1cc', .9);
  const hanger = pivot(lamp, 'Vista', [0, 0, 0]);
  const chain = mat('Cadena', '#7d6128', .7), glass = mat('Cristal de lámpara', '#f6f0dc', .9, .9, .85);
  part(hanger, 'Cadena', 'cylinder', chain, [0, 2.2, 0], [.03, 1.2, .03], [0, 0, 0], false);
  part(hanger, 'Lámpara', 'sphere', glass, [0, 1.45, 0], [.42, .5, .42]);
  part(hanger, 'Corona', 'cylinder', chain, [0, 1.72, 0], [.3, .06, .3]);
  pivot(hanger, 'Cabeza de chicle', [0, 1.45, 0]);

  const templates = new Map<LucaKind, pc.Entity>([
    ['fran', fran], ['lampara', lamp],
    ['polilla', moth], ['estampado-rojo', red], ['estampado-azul', blue], ['estampado-oro', gold],
    ['capellan', chaplain],
  ]);
  return {
    templates,
    /** Adds the templates under `parent` (disabled: the fight clones them). */
    attach(parent: pc.Entity) { for (const e of roots) parent.addChild(e); },
    destroy() { roots.forEach(e => e.destroy()); materials.forEach(m => m.destroy()); },
  };
}
/** How many ways Fran has done the chaplains' hair. */
export const CHAPLAIN_STYLES = 3;
/** Shows the `n`th of them on a chaplain cloned from the template (the others hidden): each chaplain his own. */
export function styleChaplain(model: pc.Entity, n: number) {
  for (let k = 0; k < CHAPLAIN_STYLES; k++) { const hair = model.findByName(`Peinado ${k}`); if (hair) hair.enabled = k === n % CHAPLAIN_STYLES; }
}
/** A shirt of Luca's in the light of its own colour (its colour and print), or out of it (grey cloth). */
export function lightShirt(model: pc.Entity, on: boolean) {
  const lit = model.findByName('Encendida'), dull = model.findByName('Apagada');
  // Set outright: out of the hierarchy `enabled` reads false whatever it was set to.
  if (lit && dull) { lit.enabled = on; dull.enabled = !on; }
}
/** How big each one stands in the fight. */
export const LUCA_SIZES: Record<LucaKind, number> = {
  polilla: .9, 'estampado-rojo': 1, 'estampado-azul': 1, 'estampado-oro': 1, capellan: 1.05, fran: 1.2, lampara: .8,
};
