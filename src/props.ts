import * as pc from 'playcanvas';
import { shine } from './lighting';
import type { TreeSpecies, WorldProp } from './environments';

/** How see-through a crown gets while it hides the player, and how quickly it fades. */
const GHOST_OPACITY = 0.3;
const FADE_RATE = 9;
/** Rough radius of the player's silhouette, in world units, for the occlusion test. */
const FOCUS_RADIUS = 0.35;
const QUARTER_TURN = new pc.Quat().setFromEulerAngles(0, 90, 0);

interface Tree {
  pivot: pc.Entity; yaw: number; phase: number; sway: number;
  crowns: pc.RenderComponent[]; solid: pc.Material[]; ghosts: pc.StandardMaterial[];
  /** Crown as a vertical capsule in world space: bottom and top centres plus radius. */
  bottom: pc.Vec3; top: pc.Vec3; radius: number;
  opacity: number;
}

export type PropKit = ReturnType<typeof createPropKit>;
export type SignalLight = 'red' | 'amber' | 'green';
/** A placed traffic light whose lamps traffic can switch: the cars' head and the walk signal below. */
export interface Signal { holder: pc.Entity; show(vehicle: SignalLight, walk: 'red' | 'green'): void }

/**
 * Reusable props with their own materials. Any scene can `place` a WorldProp under its own
 * root; call `update` every frame for swaying and see-through crowns, `destroy` when done.
 * Collision is not handled here: it comes from PROP_FOOTPRINTS in environments.ts.
 */
export function createPropKit() {
  const materials: pc.StandardMaterial[] = [];
  const trees: Tree[] = [];
  let time = 0;
  /** While placing a prop that never moves, its parts join the scene's static batch. */
  let batchGroupId: number | undefined;
  function mat(name: string, hex: string, gloss = 0.2, glow = 0) {
    const m = new pc.StandardMaterial();
    m.name = name; m.diffuse.fromString(hex); m.gloss = gloss;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); return m;
  }
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r?: number[]) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: true, receiveShadows: true, ...(batchGroupId === undefined ? {} : { batchGroupId }) });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]);
    if (r) e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  // Deterministic per-anchor noise: the same tree looks the same after every reload.
  const noise = (x: number, z: number, i: number) => { const v = Math.sin(x * 127.1 + z * 311.7 + i * 74.7) * 43758.5453; return v - Math.floor(v); };

  const leaf = [mat('Olivo', '#78925b'), mat('Copa clara', '#98a86e'), mat('Copa oscura', '#597a54')];
  const foliage: Record<TreeSpecies, pc.StandardMaterial[]> = {
    plane: leaf,
    olive: [mat('Olivo plateado', '#8d9b6f'), mat('Olivo claro', '#a6ae86'), mat('Olivo sombra', '#6f8060')],
    cypress: [mat('Ciprés', '#4c6947'), mat('Ciprés claro', '#5d7a52')],
    yucca: [mat('Yuca', '#3f7a45'), mat('Yuca clara', '#5e9a55'), mat('Yuca sombra', '#2f5c38')],
  };
  const barkMat = mat('Troncos', '#817058');
  const wood = mat('Tutor de madera', '#b48a55', 0.1);
  const oliveBark = mat('Tronco de olivo', '#8a8173');
  const stone = mat('Piedra clara', '#e3dec8');
  const soil = mat('Tierra', '#6f5e49');
  const clay = mat('Maceta de barro', '#b8704f');
  const metal = mat('Forja verde', '#354d47', 0.5);
  const glass = shine(mat('Cristal azul', '#557c83', 0.8), 'glass');
  const glow = mat('Farolas', '#ffdb9c', 0.2, 2);
  const rim = mat('Marco de alcantarilla', '#8f8a78', 0.3);
  const iron = mat('Hierro de alcantarilla', '#6d6a5e', 0.45);
  const paint = new Map<string, pc.StandardMaterial>();

  /**
   * Round lobes set on the surface of a crown sphere: the silhouette stays spherical but
   * bumpy, with darker lobes underneath and lighter ones on top for a sense of volume.
   */
  function lobes(pivot: pc.Entity, crowns: pc.Entity[], palette: pc.StandardMaterial[], n: (i: number) => number, s: number, y: number, reach: number, count: number, size: number) {
    const dark = palette[palette.length - 1], light = palette[1];
    for (let i = 0; i < count; i++) {
      const a = (i / count + n(3)) * Math.PI * 2, e = -0.35 + (i % 3) * 0.5 + n(i + 12) * 0.2, d = reach * s;
      const r = (size + n(i + 8) * 0.08) * s * 2;
      crowns.push(part(pivot, 'Lóbulo de copa', 'sphere', e < 0 ? dark : e > 0.5 ? light : palette[0],
        [Math.cos(e) * Math.cos(a) * d, y * s + Math.sin(e) * d, Math.cos(e) * Math.sin(a) * d], [r, r, r]));
    }
    // A small sunlit cap on top keeps the crown from reading as a flat disc from above.
    crowns.push(part(pivot, 'Copa soleada', 'sphere', light, [0.08 * s, (y + reach * 0.85) * s, -0.06 * s], [size * 2.2 * s, size * 1.6 * s, size * 2.2 * s]));
  }
  const barks = new Map<string, pc.StandardMaterial>();
  function tree(holder: pc.Entity, x: number, z: number, species: TreeSpecies, scale: number, base: 'pit' | 'pot' | 'ground', stakes = false, trunk?: string) {
    const n = (i: number) => noise(x, z, i);
    const s = scale * (0.9 + n(0) * 0.2);
    let lift = 0;
    let bark = barkMat;
    if (trunk) {
      bark = barks.get(trunk) ?? mottled(trunk);
      barks.set(trunk, bark);
    }
    if (stakes) {
      // Three wooden stakes round a young trunk, tied together by crossbars near the top.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3 + n(9) * 0.2) * Math.PI * 2;
        part(holder, 'Tutor', 'box', wood, [Math.cos(a) * 0.24, 0.55, Math.sin(a) * 0.24], [0.06, 1.1, 0.06]);
        const b = a + Math.PI / 3;
        part(holder, 'Travesaño', 'box', wood, [Math.cos(b) * 0.12, 0.92, Math.sin(b) * 0.12], [0.42, 0.04, 0.04], [0, -b * 180 / Math.PI + 90, 0]);
      }
    }
    if (base === 'pit') {
      part(holder, 'Alcorque', 'box', stone, [0, 0.04, 0], [0.9, 0.12, 0.9]);
      part(holder, 'Tierra', 'box', soil, [0, 0.11, 0], [0.73, 0.05, 0.73]);
    } else if (base === 'pot') {
      part(holder, 'Maceta', 'cylinder', clay, [0, 0.21, 0], [0.56, 0.42, 0.56]);
      part(holder, 'Borde de maceta', 'cylinder', clay, [0, 0.43, 0], [0.64, 0.07, 0.64]);
      part(holder, 'Tierra de maceta', 'cylinder', soil, [0, 0.45, 0], [0.5, 0.02, 0.5]);
      lift = 0.44;
    }
    // Trunk and crowns hang from a base pivot, so the whole tree leans in the breeze.
    const pivot = new pc.Entity('Árbol'), yaw = n(1) * 360;
    pivot.setLocalPosition(0, lift, 0); pivot.setLocalEulerAngles(0, yaw, 0); holder.addChild(pivot);
    const palette = foliage[species];
    const crowns: pc.Entity[] = [];
    let low: number, high: number, radius: number, sway: number;
    if (species === 'cypress') {
      part(pivot, 'Tronco', 'cylinder', bark, [0, 0.2 * s, 0], [0.12, 0.4 * s, 0.12]);
      crowns.push(part(pivot, 'Copa de ciprés', 'sphere', palette[0], [0, 1.35 * s, 0], [0.7 * s, 2.3 * s, 0.7 * s]));
      crowns.push(part(pivot, 'Punta de ciprés', 'sphere', palette[1], [0.04 * s, 2.35 * s, 0.03 * s], [0.44 * s, 1.1 * s, 0.44 * s]));
      [low, high, radius, sway] = [0.6 * s, 2.5 * s, 0.38 * s, 0.5];
    } else if (species === 'yucca') {
      // A thick, scaly cane topped by a rosette of long, stiff blades.
      part(pivot, 'Tronco de yuca', 'cylinder', oliveBark, [0, 0.5 * s, 0], [0.16, 1 * s, 0.16]);
      for (let i = 0; i < 14; i++) {
        const a = i * 137.5, tilt = 35 + (i % 3) * 22 + n(i + 4) * 10;
        // Turn first, then lean: each blade fans out in its own direction.
        const turn = new pc.Entity('Roseta'); pivot.addChild(turn);
        turn.setLocalPosition(0, 1.02 * s, 0); turn.setLocalEulerAngles(0, a, 0);
        const blade = part(turn, 'Hoja de yuca', 'cone', palette[i % 3], [0, 0, 0], [0.07, 0.8 * s, 0.03], [0, 0, tilt]);
        // Cones grow from their centre, so push each blade out along its own length.
        blade.translateLocal(0, 0.38 * s, 0);
        crowns.push(blade);
      }
      [low, high, radius, sway] = [0.9 * s, 1.5 * s, 0.55 * s, 0.6];
    } else if (species === 'olive') {
      // A short, split trunk under a round, silvery crown.
      part(pivot, 'Tronco', 'cylinder', oliveBark, [0, 0.32 * s, 0], [0.22, 0.66 * s, 0.22], [0, 0, 8]);
      for (const side of [-1, 1]) part(pivot, 'Rama', 'cylinder', oliveBark, [side * 0.16 * s, 0.78 * s, 0], [0.12, 0.5 * s, 0.12], [0, 0, -side * 32]);
      crowns.push(part(pivot, 'Copa de olivo', 'sphere', palette[0], [0, 1.2 * s, 0], [1.1 * s, 0.95 * s, 1.1 * s]));
      lobes(pivot, crowns, palette, n, s, 1.2, 0.4, 5, 0.26);
      [low, high, radius, sway] = [1.05 * s, 1.35 * s, 0.78 * s, 1];
    } else {
      // Street plane tree: tall trunk with a flared foot and a small fork under a round crown.
      part(pivot, 'Pie del tronco', 'cylinder', bark, [0, 0.08 * s, 0], [0.26, 0.16 * s, 0.26]);
      part(pivot, 'Tronco', 'cylinder', bark, [0, 0.62 * s, 0], [0.17, 1.24 * s, 0.17]);
      for (const side of [-1, 1]) part(pivot, 'Rama', 'cylinder', bark, [side * 0.13 * s, 1.28 * s, 0], [0.1, 0.5 * s, 0.1], [0, 0, -side * 28]);
      crowns.push(part(pivot, 'Copa de árbol', 'sphere', palette[0], [0, 1.9 * s, 0], [1.4 * s, 1.35 * s, 1.4 * s]));
      lobes(pivot, crowns, palette, n, s, 1.9, 0.48, 6, 0.3);
      [low, high, radius, sway] = [1.7 * s, 2.1 * s, 0.88 * s, 1];
    }
    const world = holder.getPosition();
    // Swap materials on the render component: mesh instances only exist once the parent is in the scene.
    const meshes = crowns.map(c => c.render!);
    const solid = meshes.map(r => r.material);
    const ghosts = [...new Set(solid)].map(m => {
      const g = m.clone() as pc.StandardMaterial;
      g.blendType = pc.BLEND_NORMAL; g.update(); materials.push(g); return [m, g] as const;
    });
    const ghostOf = new Map(ghosts);
    trees.push({
      pivot, yaw, phase: x * .7 + z * .31, sway, crowns: meshes, solid, ghosts: solid.map(m => ghostOf.get(m)!),
      bottom: new pc.Vec3(world.x, world.y + lift + low, world.z), top: new pc.Vec3(world.x, world.y + lift + high, world.z), radius,
      opacity: 1,
    });
  }
  function car(holder: pc.Entity, color: string) {
    let body = paint.get(color);
    if (!body) { body = shine(mat('Carrocería', color, 0.65), 'paint'); paint.set(color, body); }
    // The body spans the anchor cell and the next one along +z, like its footprint.
    part(holder, 'Coche', 'box', body, [0, 0.32, 0.5], [0.84, 0.45, 1.85]);
    part(holder, 'Cabina', 'box', glass, [0, 0.66, 0.5], [0.72, 0.36, 0.95]);
    part(holder, 'Techo coche', 'box', body, [0, 0.86, 0.53], [0.74, 0.08, 0.65]);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      part(holder, 'Rueda', 'cylinder', metal, [side * 0.41, 0.2, 0.5 + end * 0.59], [0.32, 0.13, 0.32], [0, 0, 90]);
    }
    part(holder, 'Faros coche', 'box', stone, [0, 0.36, -0.44], [0.6, 0.1, 0.03]);
  }
  function lamp(holder: pc.Entity) {
    part(holder, 'Base de farola', 'cylinder', metal, [0, 0.06, 0], [0.2, 0.12, 0.2]);
    part(holder, 'Farola', 'box', metal, [0, 1.65, 0], [0.075, 3.3, 0.075]);
    part(holder, 'Luminaria', 'box', glow, [0, 3.28, 0], [0.38, 0.16, 0.45]);
  }
  const signRed = mat('Rombo del metro', '#d6252f', 0.35, 0.35);
  const signOrange = mat('Rombo de Rodalies', '#e57d1e', 0.35, 0.35);
  const signWhite = mat('Letra del rótulo', '#ffffff', 0.3, 0.5);
  const railing = mat('Barandilla del metro', '#5c6366', 0.6);
  const steel = shine(mat('Acero inoxidable', '#c9ced1', 0.8), 'steel');
  const granite = mat('Granito', '#a9a7a1', 0.25);
  // Pale granite at the top, darker as the stair goes down (hex: materials take no hsl()).
  const steps = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const v = Math.round(226 - i * 21).toString(16); return mat('Escalón', `#${v}${v}${Math.round(218 - i * 21).toString(16)}`, 0.15); });
  const nosing = mat('Canto del escalón', '#3c3f42', 0.3);
  const hallGlow = mat('Luz del vestíbulo', '#ffe1ad', 0.2, 2.2);
  const balustrade = mat('Cristal de la barandilla', '#bcd6dc', 0.9);
  balustrade.opacity = 0.3; balustrade.blendType = pc.BLEND_NORMAL; shine(balustrade, 'glass');
  const plates = new Map<string, pc.StandardMaterial>();
  /** The station's name plate under the diamond: the line's badge and the name, white on dark. */
  function plate(name: string, line: string, colour: string) {
    const key = `${name}|${line}`;
    let m = plates.get(key);
    if (!m) {
      m = painted(`Placa ${name}`, 64, 256, ctx => {
        ctx.fillStyle = '#23272b'; ctx.fillRect(0, 0, 64, 256);
        ctx.fillStyle = colour; ctx.fillRect(10, 10, 44, 34);
        ctx.fillStyle = '#ffffff'; ctx.font = '800 22px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(line, 32, 35);
        // The name runs down the plate, read with the head tilted, as on the real totems.
        ctx.save(); ctx.translate(40, 60); ctx.rotate(Math.PI / 2); ctx.font = '700 22px Arial, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(name, 0, 0); ctx.restore();
      }, 0.3);
      m.emissive.set(1, 1, 1); m.emissiveMap = m.diffuseMap; m.emissiveIntensity = 0.35; m.update();
      plates.set(key, m);
    }
    return m;
  }
  /**
   * A station entrance: a totem with the red diamond and its white M (Rodalies: orange with an R)
   * over a plate with the line and the station's name, on the anchor cell; beside it, along +x
   * over the next three cells, the stair going down, between granite kerbs and glass balustrades,
   * lit from the hall below. Only the totem is solid: walking into the stair takes Gerard down.
   */
  function station(holder: pc.Entity, network: 'metro' | 'rodalies', name?: string, line?: string) {
    part(holder, 'Poste del rótulo', 'cylinder', railing, [0, 1.45, 0], [0.09, 2.9, 0.09]);
    const sign = new pc.Entity('Rótulo'); sign.setLocalPosition(0, 3.05, 0.05); holder.addChild(sign);
    part(sign, 'Rombo', 'box', network === 'metro' ? signRed : signOrange, [0, 0, 0], [0.56, 0.56, 0.06], [0, 0, 45]);
    const letter = (p: number[], s: number[], r = 0) => part(sign, 'Trazo', 'box', signWhite, p, s, [0, 0, r]);
    if (network === 'metro') {
      letter([-0.13, 0, 0.04], [0.06, 0.32, 0.02]); letter([0.13, 0, 0.04], [0.06, 0.32, 0.02]);
      letter([-0.065, 0.06, 0.04], [0.05, 0.2, 0.02], 28); letter([0.065, 0.06, 0.04], [0.05, 0.2, 0.02], -28);
    } else {
      letter([-0.08, 0, 0.04], [0.06, 0.32, 0.02]); letter([0.02, 0.1, 0.04], [0.18, 0.06, 0.02]);
      letter([0.02, 0, 0.04], [0.18, 0.05, 0.02]); letter([0.06, -0.09, 0.04], [0.05, 0.17, 0.02], 30);
    }
    if (name) {
      const m = plate(name, (line ?? '').toUpperCase(), network === 'metro' ? '#d6252f' : '#e57d1e');
      part(holder, 'Placa de la estación', 'box', m, [0, 1.95, 0.06], [0.24, 0.95, 0.05]);
    }
    // The stair: eight steps darkening as they go down towards +x, ending in the hall's light.
    const x0 = 0.55, run = 2.9, width = 1.1;
    steps.forEach((m, i) => {
      part(holder, 'Escalón', 'box', m, [x0 + (i + 0.5) * run / 8, 0.05 - i * 0.004, 0], [run / 8, 0.04, width]);
      part(holder, 'Canto del escalón', 'box', nosing, [x0 + i * run / 8 + 0.03, 0.072 - i * 0.004, 0], [0.04, 0.006, width]);
    });
    part(holder, 'Luz del vestíbulo', 'box', hallGlow, [x0 + run - 0.08, 0.12, 0], [0.06, 0.18, width * 0.9]);
    for (const side of [-1, 1]) {
      const z = side * (width / 2 + 0.07);
      part(holder, 'Bordillo de granito', 'box', granite, [x0 + run / 2, 0.14, z], [run + 0.1, 0.28, 0.14]);
      part(holder, 'Barandilla de cristal', 'box', balustrade, [x0 + run / 2 + 0.05, 0.62, z], [run - 0.1, 0.66, 0.03]).render!.castShadows = false;
      part(holder, 'Pasamanos', 'cylinder', steel, [x0 + run / 2 + 0.05, 0.98, z], [0.05, run - 0.1, 0.05], [0, 0, 90]);
      for (const dx of [0.05, run / 2, run - 0.1]) part(holder, 'Montante', 'box', steel, [x0 + dx, 0.62, z], [0.04, 0.72, 0.04]);
    }
    part(holder, 'Bordillo del fondo', 'box', granite, [x0 + run + 0.02, 0.14, 0], [0.14, 0.28, width + 0.28]);
    part(holder, 'Barandilla del fondo', 'box', balustrade, [x0 + run + 0.02, 0.62, 0], [0.03, 0.66, width + 0.2]).render!.castShadows = false;
    part(holder, 'Pasamanos del fondo', 'cylinder', steel, [x0 + run + 0.02, 0.98, 0], [0.05, width + 0.2, 0.05], [90, 0, 0]);
  }
  function manhole(holder: pc.Entity) {
    // Flat street furniture: nothing here may suggest a collision the grid lacks.
    part(holder, 'Marco de alcantarilla', 'cylinder', rim, [0, 0.04, 0], [0.68, 0.012, 0.68]);
    part(holder, 'Tapa de alcantarilla', 'cylinder', iron, [0, 0.046, 0], [0.56, 0.012, 0.56]);
    for (const dz of [-0.14, 0, 0.14]) part(holder, 'Estría', 'box', rim, [0, 0.054, dz], [0.42, 0.008, 0.035]);
  }
  // ------------------------------------------------------------ street furniture (the renewed Meridiana)
  const textures: pc.Texture[] = [];
  /** A material painted on a canvas: graffiti, mottled bark, a bus's livery. */
  function painted(name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, gloss = 0.15) {
    const device = pc.Application.getApplication()?.graphicsDevice;
    const m = mat(name, '#ffffff', gloss);
    if (!device) return m;
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new pc.Texture(device, { width: w, height: h, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
    t.setSource(c); textures.push(t);
    m.diffuseMap = t; m.update(); return m;
  }
  /** Plane-tree bark: a pale trunk shedding in grey, olive and cream patches. */
  function mottled(base: string) {
    return painted('Corteza moteada', 64, 64, ctx => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = ['rgba(110,112,92,.35)', 'rgba(240,232,210,.45)', 'rgba(150,140,110,.35)'][i % 3];
        ctx.beginPath(); ctx.ellipse(noise(i, 1, 2) * 64, noise(i, 2, 3) * 64, 3 + noise(i, 3, 4) * 6, 4 + noise(i, 4, 5) * 9, 0, 0, Math.PI * 2); ctx.fill();
      }
    }, 0.05);
  }
  const slats = mat('Listones de banco', '#9b5a34', 0.25);
  const frame = mat('Estructura gris', '#8d9295', 0.55);
  const poleGrey = mat('Poste gris', '#a3a8ab', 0.5);
  const ledGlow = mat('Luminaria LED', '#f4f2ea', 0.2, 2.4);
  const jersey = { red: mat('Barrera roja', '#cf3529', 0.45), white: mat('Barrera blanca', '#ebe8e1', 0.45), yellow: mat('Barrera amarilla', '#e8b01e', 0.45) };
  const panelYellow = mat('Valla amarilla', '#f0b21d', 0.4);
  const sack = mat('Saco de obra', '#e7e5df', 0.05);
  const sackShade = mat('Saco de obra sombra', '#c9c6be', 0.05);
  const binGrey = mat('Papelera', '#6f7478', 0.4);
  const yellow = mat('Amarillo semáforo', '#f2c230', 0.45);
  const black = mat('Negro mate', '#1d2023', 0.3);
  const lineSign = mat('Rótulo ámbar', '#ffb43a', 0.3, 0.25);
  // A lamp of a light is lit or dark; a scene without traffic leaves every light on red.
  const lamps: Record<SignalLight, [pc.StandardMaterial, pc.StandardMaterial]> = {
    red: [mat('Luz roja encendida', '#ff3b2e', 0.3, 1.4), mat('Luz roja apagada', '#5e2622', 0.3, 0.12)],
    amber: [mat('Luz ámbar encendida', '#ffa424', 0.3, 1.4), mat('Luz ámbar apagada', '#5e4622', 0.3, 0.12)],
    green: [mat('Luz verde encendida', '#22d77a', 0.3, 1.4), mat('Luz verde apagada', '#1f4c36', 0.3, 0.12)],
  };
  const signals: Signal[] = [];
  const shelterGlass = mat('Cristal de marquesina', '#a9c7cf', 0.9);
  shelterGlass.opacity = 0.35; shelterGlass.blendType = pc.BLEND_NORMAL; shine(shelterGlass, 'glass');
  // The shelter's lit poster is Rodalies' R4 ad Gerard reads there (chapter-2.ts, clueR4Marquesina).
  const poster = painted('Cartel de Rodalies', 64, 128, ctx => {
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#e57d1e'; ctx.fillRect(0, 0, 64, 40);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 30px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('R4', 32, 31);
    ctx.fillStyle = '#3a3a3a'; ctx.font = '700 9px Arial, sans-serif';
    ['LA SAGRERA', '↓', 'CARDEDEU'].forEach((line, i) => ctx.fillText(line, 32, 62 + i * 16));
    ctx.fillStyle = '#e57d1e'; ctx.fillRect(8, 108, 48, 6);
  }, 0.3);
  poster.emissive.set(1, 1, 1); poster.emissiveMap = poster.diffuseMap; poster.emissiveIntensity = 0.7; poster.update();
  const rubber = mat('Neumático', '#202326', 0.2);
  const busGlass = mat('Ventanas del bus', '#28343c', 0.85);
  const hoardingMat = painted('Valla de obra con grafitis', 512, 128, ctx => {
    // Corrugated grey sheets, then tags, bubble letters and one big pink bubble of gum.
    ctx.fillStyle = '#b9bcbd'; ctx.fillRect(0, 0, 512, 128);
    for (let x = 0; x < 512; x += 8) { ctx.fillStyle = x % 16 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)'; ctx.fillRect(x, 0, 4, 128); }
    const colours = ['#e2475d', '#3fa7d6', '#f3c13a', '#5bbf6a', '#ffffff', '#222222', '#8a5bd6', '#ff8a3d'];
    for (let i = 0; i < 9; i++) {
      const x0 = i * 58 + noise(i, 0, 1) * 20, y0 = 30 + noise(i, 1, 2) * 50, col = colours[i % colours.length];
      ctx.fillStyle = col; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 3;
      ctx.font = `900 ${30 + noise(i, 2, 3) * 22}px Impact, "Arial Black", sans-serif`;
      const word = ['RAKE', 'SNOK', 'BCN', 'KAOS', 'ZETA', 'MERI', 'TOY', 'NAKO', 'SAKE'][i];
      ctx.save(); ctx.translate(x0, y0 + 30); ctx.rotate((noise(i, 3, 4) - 0.5) * 0.3);
      ctx.strokeText(word, 0, 0); ctx.fillText(word, 0, 0); ctx.restore();
    }
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = colours[(i + 3) % colours.length]; ctx.lineWidth = 2; ctx.beginPath();
      const x0 = noise(i, 5, 6) * 512, y0 = 10 + noise(i, 6, 7) * 108;
      ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 10, y0 - 12, x0 + 20, y0 + 12, x0 + 34, y0 - 4); ctx.stroke();
    }
    ctx.fillStyle = '#ff7fb6'; ctx.strokeStyle = '#7a1d4a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(300, 64, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(288, 50, 9, 6, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 118, 512, 10);
  }, 0.35);
  const busPaint = new Map<string, pc.StandardMaterial>();

  function bench(holder: pc.Entity, style: 'bench' | 'chair') {
    const w = style === 'chair' ? 0.42 : 1.15;
    // Front (+z) to the road: seat slats, a sloped backrest and grey metal legs and armrests.
    for (let i = 0; i < 3; i++) part(holder, 'Listón del asiento', 'box', slats, [0, 0.4, 0.12 - i * 0.12], [w, 0.035, 0.1]);
    for (let i = 0; i < 3; i++) part(holder, 'Listón del respaldo', 'box', slats, [0, 0.52 + i * 0.11, -0.25 - i * 0.025], [w, 0.09, 0.03], [-12, 0, 0]);
    for (const side of [-1, 1]) {
      part(holder, 'Pata', 'box', frame, [side * (w / 2 - 0.03), 0.2, 0], [0.04, 0.4, 0.42]);
      part(holder, 'Reposabrazos', 'box', frame, [side * (w / 2 + 0.02), 0.6, 0.02], [0.04, 0.04, 0.36]);
      part(holder, 'Montante del brazo', 'box', frame, [side * (w / 2 + 0.02), 0.5, 0.18], [0.04, 0.2, 0.04]);
    }
  }
  function ledLamp(holder: pc.Entity) {
    // A tall, slim grey pole with a short arm and a flat white LED head.
    part(holder, 'Base de farola', 'cylinder', poleGrey, [0, 0.05, 0], [0.16, 0.1, 0.16]);
    part(holder, 'Farola', 'cylinder', poleGrey, [0, 2.3, 0], [0.07, 4.6, 0.07]);
    part(holder, 'Brazo', 'box', poleGrey, [0, 4.55, 0.18], [0.05, 0.05, 0.4]);
    part(holder, 'Cabezal LED', 'box', poleGrey, [0, 4.55, 0.42], [0.16, 0.07, 0.36]);
    part(holder, 'Luz LED', 'box', ledGlow, [0, 4.51, 0.42], [0.13, 0.02, 0.32]);
  }
  function mastLamp(holder: pc.Entity) {
    // A square's tall mast: three LED heads on short arms, splayed so they light all round.
    part(holder, 'Base de báculo', 'cylinder', poleGrey, [0, 0.1, 0], [0.26, 0.2, 0.26]);
    part(holder, 'Báculo', 'cylinder', poleGrey, [0, 4.3, 0], [0.12, 8.6, 0.12]);
    for (const turn of [0, 120, 240]) {
      const arm = new pc.Entity('Brazo del báculo'); arm.setLocalEulerAngles(0, turn, 0); holder.addChild(arm);
      part(arm, 'Brazo', 'box', poleGrey, [0, 8.55, 0.25], [0.06, 0.06, 0.5]);
      part(arm, 'Cabezal LED', 'box', poleGrey, [0, 8.5, 0.6], [0.2, 0.1, 0.42]);
      part(arm, 'Luz LED', 'box', ledGlow, [0, 8.44, 0.6], [0.16, 0.02, 0.36]);
    }
  }
  function barrier(holder: pc.Entity, colour: 'red' | 'white' | 'yellow', style: 'jersey' | 'panel' | 'fence') {
    if (style === 'jersey') {
      // A water-filled plastic barrier: a wide foot, a narrow top and the two hollows of its handles.
      const m = jersey[colour];
      part(holder, 'Pie de barrera', 'box', m, [0, 0.12, 0], [0.9, 0.24, 0.42]);
      part(holder, 'Cuerpo de barrera', 'box', m, [0, 0.36, 0], [0.88, 0.26, 0.26]);
      part(holder, 'Lomo de barrera', 'box', m, [0, 0.54, 0], [0.84, 0.1, 0.18]);
      for (const dx of [-0.22, 0.22]) part(holder, 'Asa', 'box', black, [dx, 0.5, 0], [0.16, 0.06, 0.19]);
    } else if (style === 'panel') {
      for (const dx of [-0.4, 0.4]) {
        part(holder, 'Pie de valla', 'box', black, [dx, 0.04, 0], [0.1, 0.08, 0.5]);
        part(holder, 'Montante de valla', 'box', panelYellow, [dx, 0.45, 0], [0.06, 0.85, 0.06]);
      }
      part(holder, 'Panel de valla', 'box', panelYellow, [0, 0.62, 0], [0.86, 0.42, 0.04]);
      for (let i = 0; i < 4; i++) part(holder, 'Franja roja', 'box', jersey.red, [-0.3 + i * 0.2, 0.62, 0.025], [0.08, 0.38, 0.01], [0, 0, 35]);
      part(holder, 'Barra baja', 'box', panelYellow, [0, 0.25, 0], [0.86, 0.05, 0.04]);
    } else {
      // A metal crowd barrier: two rails, thin uprights and flat feet.
      for (const y of [0.25, 0.75]) part(holder, 'Barra', 'cylinder', frame, [0, y, 0], [0.04, 0.95, 0.04], [0, 0, 90]);
      for (let i = 0; i < 7; i++) part(holder, 'Barrote', 'box', frame, [-0.42 + i * 0.14, 0.5, 0], [0.02, 0.5, 0.02]);
      for (const dx of [-0.45, 0.45]) part(holder, 'Pie', 'box', frame, [dx, 0.08, 0], [0.04, 0.16, 0.5]);
    }
  }
  function bag(holder: pc.Entity) {
    part(holder, 'Saco', 'box', sack, [0, 0.27, 0], [0.62, 0.54, 0.6]);
    part(holder, 'Escombros', 'sphere', sackShade, [0, 0.52, 0], [0.52, 0.18, 0.5]);
    for (const [dx, dz] of [[-0.28, -0.27], [0.28, 0.27]]) part(holder, 'Asa del saco', 'box', sack, [dx, 0.6, dz], [0.05, 0.16, 0.05]);
  }
  function bin(holder: pc.Entity) {
    part(holder, 'Poste de papelera', 'box', binGrey, [0, 0.45, -0.18], [0.05, 0.9, 0.05]);
    part(holder, 'Papelera', 'cylinder', binGrey, [0, 0.6, 0], [0.32, 0.45, 0.32]);
    part(holder, 'Boca', 'cylinder', black, [0, 0.83, 0], [0.26, 0.01, 0.26]);
  }
  function bikeRack(holder: pc.Entity) {
    // An inverted U and a bike locked to it, wheels along x.
    for (const dx of [-0.3, 0.3]) part(holder, 'Arco', 'box', frame, [dx, 0.4, -0.15], [0.04, 0.8, 0.04]);
    part(holder, 'Arco', 'box', frame, [0, 0.8, -0.15], [0.64, 0.04, 0.04]);
    for (const dx of [-0.36, 0.36]) part(holder, 'Rueda', 'torus', rubber, [dx, 0.3, 0.05], [0.56, 0.12, 0.56], [90, 0, 0]);
    part(holder, 'Cuadro', 'box', jersey.red, [0, 0.42, 0.05], [0.62, 0.04, 0.04], [0, 0, 12]);
    part(holder, 'Tija', 'box', jersey.red, [-0.12, 0.52, 0.05], [0.04, 0.3, 0.04], [0, 0, -15]);
    part(holder, 'Sillín', 'box', black, [-0.16, 0.68, 0.05], [0.16, 0.04, 0.07]);
    part(holder, 'Manillar', 'box', black, [0.3, 0.68, 0.05], [0.04, 0.04, 0.34]);
  }
  function trafficLight(holder: pc.Entity) {
    // A grey pole curving out over the road (+z) to a yellow housing, and a walk signal lower down.
    part(holder, 'Poste del semáforo', 'cylinder', poleGrey, [0, 1.5, 0], [0.08, 3, 0.08]);
    part(holder, 'Curva', 'cylinder', poleGrey, [0, 3.15, 0.18], [0.07, 0.5, 0.07], [55, 0, 0]);
    part(holder, 'Brazo del semáforo', 'cylinder', poleGrey, [0, 3.3, 0.85], [0.06, 1.1, 0.06], [90, 0, 0]);
    const head = (y: number, z: number, colours: SignalLight[]) => {
      part(holder, 'Caja del semáforo', 'box', yellow, [0, y, z], [0.2, 0.2 * colours.length + 0.06, 0.14]);
      // The lamps stay out of the static batch so they can change.
      const batched = batchGroupId; batchGroupId = undefined;
      const foci = colours.map((c, i) => part(holder, 'Foco', 'sphere', lamps[c][1], [0, y + (colours.length - 1) * 0.1 - i * 0.2, z + 0.07], [0.15, 0.15, 0.1]).render!);
      batchGroupId = batched;
      return (lit: SignalLight) => foci.forEach((r, i) => { r.material = lamps[colours[i]][colours[i] === lit ? 0 : 1]; });
    };
    const cars = head(2.95, 1.35, ['red', 'amber', 'green']), walk = head(1.55, 0.1, ['red', 'green']);
    const signal: Signal = { holder, show(vehicle, walker) { cars(vehicle); walk(walker); } };
    signal.show('red', 'red'); signals.push(signal);
  }
  function shelter(holder: pc.Entity) {
    // Along +x over three cells: a yellow roof and seat, a glass back, and a lit poster at the end.
    part(holder, 'Techo de marquesina', 'box', yellow, [1, 1.75, 0], [2.9, 0.08, 0.95]);
    for (const dx of [-0.4, 2.4]) part(holder, 'Pilar de marquesina', 'box', frame, [dx, 0.87, -0.35], [0.06, 1.75, 0.06]);
    part(holder, 'Cristal trasero', 'box', shelterGlass, [1, 0.95, -0.36], [2.75, 1.45, 0.03]).render!.castShadows = false;
    part(holder, 'Asiento de marquesina', 'box', yellow, [1.1, 0.42, -0.22], [1.6, 0.05, 0.24]);
    part(holder, 'Soporte del asiento', 'box', frame, [1.1, 0.2, -0.3], [0.05, 0.4, 0.05]);
    part(holder, 'Panel del cartel', 'box', frame, [2.45, 0.95, 0], [0.1, 1.45, 0.75]);
    part(holder, 'Cartel', 'box', poster, [2.51, 1.0, 0], [0.02, 1.2, 0.62]);
  }
  function bus(holder: pc.Entity, color: string, livery: 'tmb' | 'sagales') {
    let body = busPaint.get(color);
    if (!body) { body = mat('Carrocería del bus', color, 0.55); busPaint.set(color, body); }
    // Along +x over five cells, the front at +x: a tall box, a band of windows, wheels and a destination sign.
    part(holder, 'Bus', 'box', body, [2, 0.72, 0], [4.9, 1.12, 1.02]);
    part(holder, 'Ventanas', 'box', busGlass, [2.1, 0.95, 0], [4.5, 0.42, 1.04]);
    part(holder, 'Parabrisas', 'box', busGlass, [4.44, 0.82, 0], [0.04, 0.7, 0.9]);
    part(holder, 'Techo del bus', 'box', livery === 'tmb' ? jersey.white : body, [2, 1.32, 0], [4.7, 0.1, 0.94]);
    part(holder, 'Franja', 'box', livery === 'tmb' ? jersey.white : mat('Franja Sagalés', '#2a5f9e', 0.4), [2, 0.42, 0], [4.92, 0.07, 1.04]);
    part(holder, 'Rótulo de línea', 'box', lineSign, [4.46, 1.19, 0], [0.03, 0.12, 0.7]);
    for (const dx of [0.6, 3.6]) for (const side of [-1, 1]) {
      part(holder, 'Rueda del bus', 'cylinder', rubber, [dx, 0.22, side * 0.5], [0.42, 0.1, 0.42], [90, 0, 0]);
    }
  }
  function hoarding(holder: pc.Entity, length: number) {
    // Corrugated sheets on a line of cells along +x; the graffiti repeats every four cells.
    const m = hoardingMat.clone() as pc.StandardMaterial;
    m.diffuseMapTiling = new pc.Vec2(length / 4, 1); m.update(); materials.push(m);
    part(holder, 'Valla de obra', 'box', m, [(length - 1) / 2, 0.85, 0], [length, 1.7, 0.06]);
    for (let i = 0; i <= length; i += 2) part(holder, 'Poste de valla', 'box', frame, [i - 0.5, 0.88, -0.06], [0.06, 1.76, 0.06]);
  }

  function setOpacity(t: Tree, opacity: number) {
    t.opacity = opacity;
    const opaque = opacity >= 0.999;
    t.crowns.forEach((r, i) => { r.material = opaque ? t.solid[i] : t.ghosts[i]; });
    if (!opaque) for (const g of new Set(t.ghosts)) { g.opacity = opacity; g.update(); }
  }
  const ray = new pc.Vec3();
  /** Whether any part of the crown capsule lies between the focus and the camera. */
  function hides(t: Tree, focus: pc.Vec3, toCamera: pc.Vec3) {
    const reach = t.radius + FOCUS_RADIUS;
    for (let k = 0; k <= 2; k++) {
      ray.lerp(t.bottom, t.top, k / 2).sub(focus);
      const along = ray.dot(toCamera);
      if (along > 0 && ray.lengthSq() - along * along < reach * reach) return true;
    }
    return false;
  }

  return {
    /** Foliage for hedges, planters and anything else that should match the trees. */
    leaf,
    /** Every traffic light placed so far, for traffic to switch (src/traffic.ts). */
    signals: signals as readonly Signal[],
    /**
     * Builds a prop under `parent` at a local position that sits on the anchor cell. With `batch`,
     * props that never move (everything but trees) join that static batch group.
     */
    place(prop: WorldProp, parent: pc.Entity, position: pc.Vec3, batch?: number) {
      const holder = new pc.Entity(`Prop: ${prop.kind}`);
      holder.setLocalPosition(position); parent.addChild(holder);
      if ('yaw' in prop && prop.yaw) holder.setLocalEulerAngles(0, prop.yaw, 0);
      batchGroupId = prop.kind === 'tree' ? undefined : batch;
      if (prop.kind === 'tree') tree(holder, prop.x, prop.z, prop.species ?? 'plane', prop.scale ?? 1, prop.base ?? 'pit', prop.stakes, prop.trunk);
      else if (prop.kind === 'car') {
        car(holder, prop.color);
        // Turned a quarter so the body runs along +x over its footprint; the anchor stays on its cell.
        if (prop.along === 'x') holder.children.forEach(c => { const p = c.getLocalPosition(); c.setLocalPosition(p.z, p.y, -p.x); c.setLocalRotation(QUARTER_TURN.clone().mul(c.getLocalRotation())); });
      }
      else if (prop.kind === 'lamp') { if (prop.style === 'led') ledLamp(holder); else if (prop.style === 'mast') mastLamp(holder); else lamp(holder); }
      else if (prop.kind === 'metro') station(holder, prop.network ?? 'metro', prop.name, prop.line);
      else if (prop.kind === 'bench') bench(holder, prop.style ?? 'bench');
      else if (prop.kind === 'barrier') barrier(holder, prop.color ?? 'red', prop.style ?? 'jersey');
      else if (prop.kind === 'bag') bag(holder);
      else if (prop.kind === 'bin') bin(holder);
      else if (prop.kind === 'bike-rack') bikeRack(holder);
      else if (prop.kind === 'traffic-light') trafficLight(holder);
      else if (prop.kind === 'shelter') shelter(holder);
      else if (prop.kind === 'bus') bus(holder, prop.color, prop.livery ?? 'tmb');
      else if (prop.kind === 'hoarding') hoarding(holder, prop.length);
      else manhole(holder);
      batchGroupId = undefined;
      return holder;
    },
    /** Sways trees and fades crowns that stand between `focus` and the camera direction. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      time += dt;
      for (const t of trees) {
        if (animate) t.pivot.setLocalEulerAngles(Math.sin(time * 1.1 + t.phase) * 1.1 * t.sway, t.yaw, Math.sin(time * .83 + t.phase * 1.3) * 1.4 * t.sway);
        const target = focus && toCamera && hides(t, focus, toCamera) ? GHOST_OPACITY : 1;
        if (t.opacity === target) continue;
        const next = animate ? t.opacity + (target - t.opacity) * (1 - Math.exp(-dt * FADE_RATE)) : target;
        setOpacity(t, Math.abs(next - target) < 0.01 ? target : next);
      }
    },
    destroy() { materials.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); trees.length = 0; signals.length = 0; },
  };
}
