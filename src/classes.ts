import * as pc from 'playcanvas';
import type { ClassId } from './battle';

/**
 * Classes (docs/bubbaloo-palace.md, docs/party.md). Only Noísta exists: Gerard always contradicts,
 * and in the palace that habit becomes a power. Once unlocked a class is the party's, so Aitor can
 * wear it too. A class is a look (material recolours by name and a scarf), an interface theme
 * (`#hud[data-class]` in style.css), and its stats and skills (CLASS_STATS and SKILLS in battle.ts).
 */
export const CLASSES: Record<ClassId, { name: string; motto: string; look: Record<string, string>; scarf: string }> = {
  noista: {
    name: 'Noísta',
    motto: 'Dice que no. Y el mundo le hace caso.',
    look: {
      'Camiseta mostaza': '#c8323c',
      'Rayas azul marino': '#23202a',
      'Pantalones': '#2a2730',
      'Gafas carey': '#d6283a',
    },
    scarf: '#e2483d',
  },
};

/** The colours a class painted over, so taking it off gives the outfit back. */
const ownColours = new WeakMap<pc.StandardMaterial, pc.Color>();
/**
 * Dresses a character model in a class: recolours its materials by name (the model must own
 * them) and ties a scarf at the neck, once. Works on Gerard in the street and on his battle copy.
 */
export function wearClass(model: pc.Entity, id: ClassId) {
  const spec = CLASSES[id];
  const seen = new Set<pc.Material>();
  model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
    const m = mesh.material as pc.StandardMaterial;
    if (seen.has(m)) return;
    seen.add(m);
    const colour = spec.look[m.name];
    if (colour) { if (!ownColours.has(m)) ownColours.set(m, m.diffuse.clone()); m.diffuse.fromString(colour); m.update(); }
  }));
  const body = model.findByName('Cuerpo') as pc.Entity | null;
  if (!body || body.findByName('Pañuelo')) return;
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

/** Takes a class off a model: its own colours come back and the scarf goes. */
export function unwearClass(model: pc.Entity) {
  model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
    const m = mesh.material as pc.StandardMaterial, own = ownColours.get(m);
    if (own) { m.diffuse.copy(own); m.update(); ownColours.delete(m); }
  }));
  (model.findByName('Cuerpo') as pc.Entity | null)?.findByName('Pañuelo')?.destroy();
}
