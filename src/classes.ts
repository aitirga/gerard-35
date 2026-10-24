import * as pc from 'playcanvas';
import { ANIMA_NAMES, type ClassId } from './battle';

/**
 * Ánimas, called classes in the code (docs/party.md). Matemágico is Gerard's from the start;
 * Noísta wakes up in the palace (docs/bubbaloo-palace.md): Gerard always contradicts, and there
 * that habit becomes a power. Once unlocked an ánima is the party's, so Aitor can wear it too.
 * An ánima is a look (material recolours by name and, optionally, a scarf), a colour (its pills,
 * plates and flashes in the status screen and fights), an interface theme
 * (`#hud[data-class]` in style.css), and its stats and skills (CLASS_STATS and SKILLS in battle.ts).
 */
export const CLASSES: Record<ClassId, { name: string; motto: string; look: Record<string, string>; colour: string; scarf?: string }> = {
  // Gerard's everyday self: his own clothes, his own interface.
  matemagico: {
    name: ANIMA_NAMES.matemagico,
    motto: 'Lo calcula todo. Hasta lo que no hace falta.',
    colour: '#f3cf78',
    look: {},
  },
  noista: {
    name: ANIMA_NAMES.noista,
    motto: 'Dice que no. Y el mundo le hace caso.',
    colour: '#e2483d',
    look: {
      'Camiseta mostaza': '#c8323c',
      'Rayas azul marino': '#23202a',
      'Pantalones': '#2a2730',
      'Gafas carey': '#d6283a',
    },
    scarf: '#e2483d',
  },
  // Gerard and the cats he shared with Nuria: Haru and Yuki go wherever he goes (docs/animas/papagato/).
  papagato: {
    name: ANIMA_NAMES.papagato,
    motto: 'Nunca va solo. Haru y Yuki van con él.',
    colour: '#f0954a',
    look: {
      'Camiseta mostaza': '#e9894a',
      'Rayas azul marino': '#f4efe6',
      'Pantalones': '#5d6068',
    },
    scarf: '#7d7f86',
  },
};
/** Each material's own colour, so taking an ánima off (or swapping it) puts it back. */
const ownColours = new WeakMap<pc.Material, pc.Color>();
/** A material copy (a fighter's own) remembers the colour its source had before any ánima. */
export function inheritColour(source: pc.Material, copy: pc.Material) {
  const colour = ownColours.get(source);
  if (colour) ownColours.set(copy, colour.clone());
}

/**
 * Dresses a character model in an ánima (or in none): recolours its materials by name, putting
 * back the ones the ánima leaves alone, and swaps the scarf at the neck. Works on Gerard in the
 * street and on his battle copy, as many times as he changes.
 */
export function wearClass(model: pc.Entity, id: ClassId | undefined) {
  const spec = id ? CLASSES[id] : undefined;
  const body = model.findByName('Cuerpo') as pc.Entity | null;
  body?.findByName('Pañuelo')?.destroy();
  const seen = new Set<pc.Material>();
  model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
    const m = mesh.material as pc.StandardMaterial;
    if (seen.has(m)) return;
    seen.add(m);
    if (!ownColours.has(m)) ownColours.set(m, m.diffuse.clone());
    const colour = spec?.look[m.name];
    if (colour) m.diffuse.fromString(colour); else m.diffuse.copy(ownColours.get(m)!);
    m.update();
  }));
  if (!body || !spec?.scarf) return;
  const cloth = new pc.StandardMaterial(); cloth.name = 'Pañuelo'; cloth.diffuse.fromString(spec.scarf); cloth.gloss = .35; cloth.update();
  const scarf = new pc.Entity('Pañuelo'); body.addChild(scarf);
  const part = (name: string, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
    const e = new pc.Entity(name); e.addComponent('render', { type: 'box', material: cloth, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    scarf.addChild(e);
  };
  // A band round the neck, a knot at the side and two short tails down the back.
  part('Banda del pañuelo', [0, .925, 0], [.4, .07, .32]);
  part('Nudo del pañuelo', [.15, .91, .1], [.1, .1, .1], [0, 0, 45]);
  part('Punta del pañuelo', [-.05, .8, -.18], [.1, .22, .03], [12, 0, 8]);
  part('Punta del pañuelo', [.06, .78, -.18], [.09, .2, .03], [16, 0, -10]);
}

