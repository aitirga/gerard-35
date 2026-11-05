import * as pc from 'playcanvas';
import { ANIMA_NAMES, type ClassId } from './battle';
import type { ProfileId } from './stats';
import { think } from './thoughts';
import { separateFlushFaces } from './flush-faces';
import { MATERIAL_ROLES } from './character-model';
import { dressAnima } from './anima-looks';

/**
 * Ánimas, called classes in the code (docs/party.md). Matemágico wakes up in Gerard in the palace
 * (docs/bubbaloo-palace.md): Bernat, about to be finished off, tells him to think, to do the magic
 * with his mind. Once unlocked an ánima is the party's, so Aitor can wear it too.
 * An ánima is a look (its clothes recoloured by what each piece is, and what it adds in
 * anima-looks.ts: cat ears and a tail, rings of digits), a colour (its pills, plates and flashes
 * in the status screen and fights; `scarf` is the one over the portraits), an interface theme
 * (`#hud[data-class]` in style.css), and its stats and skills (CLASS_STATS and SKILLS in battle.ts).
 * `child` is what the ánima is called while its wearer is a boy (chapter 1), in Catalan.
 */
export const CLASSES: Record<ClassId, { name: string; motto: string; look: Record<string, string>; colour: string; scarf?: string; child?: { name: string; motto: string } }> = {
  // Gerard's own mind, dressed like its interface: blueprint blue ruled in gold, ones and zeros
  // circling (anima-looks.ts). At 35 his head shows it in fights too (thoughts.ts) (docs/animas/matemagico/).
  matemagico: {
    name: ANIMA_NAMES.matemagico,
    motto: 'Lo calcula todo. Hasta lo que no hace falta.',
    colour: '#f3cf78',
    look: { jacket: '#2f4a78', navy: '#f3cf78', cream: '#2f4a78', trousers: '#1e2a40' },
  },
  // Gerard and the cats he shared with Nuria: Haru and Yuki go wherever he goes (docs/animas/papagato/).
  papagato: {
    name: ANIMA_NAMES.papagato,
    motto: 'Nunca va solo. Haru y Yuki van con él.',
    colour: '#f0954a',
    // Haru's orange and Yuki's white, with their ears, a tail and a collar with a bell (anima-looks.ts).
    look: { jacket: '#e9894a', navy: '#f4efe6', cream: '#f4efe6', trousers: '#5d6068' },
    scarf: '#7d7f86',
  },
  // Aitor's own ánima: a placeholder name and colour until it is designed (no look, no skills).
  fisico: {
    name: ANIMA_NAMES.fisico,
    motto: 'El ánima de Aitor. Por descubrir.',
    colour: '#8cc6a8',
    look: {},
  },
};
/** Whether a fighter's profile is a grown-up (chapter 2 on): Gerard at 35 and Aitor. */
export const grownUp = (profile: ProfileId) => profile === 'gerard35' || profile === 'aitor';
/** An ánima as its wearer knows it: a boy's has its `child` name and motto. */
export function animaOf(id: ClassId, grown: boolean) {
  const spec = CLASSES[id];
  return grown || !spec.child ? spec : { ...spec, ...spec.child };
}
/** Each material's own colour, so taking an ánima off (or swapping it) puts it back. */
const ownColours = new WeakMap<pc.Material, pc.Color>();
/** A material copy (a fighter's own) remembers the colour its source had before any ánima. */
export function inheritColour(source: pc.Material, copy: pc.Material) {
  const colour = ownColours.get(source);
  if (colour) ownColours.set(copy, colour.clone());
}

/**
 * Dresses a character model in an ánima (or in none): recolours its clothes by what each piece is
 * (MATERIAL_ROLES: the shirt, its stripes, the sleeves, the trousers), putting back the ones the
 * ánima leaves alone, and puts on what it adds (anima-looks.ts). Works on any character and on its
 * battle copy, as many times as they change. A `grown` Matemágico also thinks out loud: ideas,
 * birds and question marks over the head.
 */
export function wearClass(model: pc.Entity, id: ClassId | undefined, grown = false) {
  const spec = id ? CLASSES[id] : undefined;
  think(model, grown && id === 'matemagico');
  const body = model.findByName('Cuerpo') as pc.Entity | null;
  body?.findByName('Pañuelo')?.destroy();
  const seen = new Set<pc.Material>();
  model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
    const m = mesh.material as pc.StandardMaterial;
    if (seen.has(m)) return;
    seen.add(m);
    if (!ownColours.has(m)) ownColours.set(m, m.diffuse.clone());
    const role = MATERIAL_ROLES.get(m.name), colour = role ? spec?.look[role] : undefined;
    if (colour) m.diffuse.fromString(colour); else m.diffuse.copy(ownColours.get(m)!);
    m.update();
  }));
  dressAnima(model, id);
  separateFlushFaces(model);
}

