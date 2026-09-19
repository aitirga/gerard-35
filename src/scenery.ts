import * as pc from 'playcanvas';
import type { Environment } from './environments';

/** Visual-only builder. Gameplay uses Environment.grid and interactions. */
export function buildScenery(app: pc.Application, environment: Environment) {
  const root = new pc.Entity(`Entorno: ${environment.id}`);
  app.root.addChild(root);
  const materials: pc.StandardMaterial[] = [];
  const textures: pc.Texture[] = [];
  const meshes: pc.Mesh[] = [];
  const surfaces: { x: number; z: number; w: number; d: number; y: number }[] = [];
  const cx = (environment.grid[0].length - 1) / 2;
  const cz = (environment.grid.length - 1) / 2;
  const x = (v: number) => v - cx;
  const z = (v: number) => v - cz;
  function mat(name: string, hex: string, gloss = 0.2, glow = 0) {
    const m = new pc.StandardMaterial();
    m.name = name; m.diffuse.fromString(hex); m.gloss = gloss;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); return m;
  }
  function mesh(name: string, type: string, m: pc.StandardMaterial, px: number, y: number, pz: number, w: number, h: number, d: number) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: true, receiveShadows: true });
    e.setPosition(x(px), y, z(pz)); e.setLocalScale(w, h, d); root.addChild(e); return e;
  }
  function box(name: string, m: pc.StandardMaterial, px: number, y: number, pz: number, w: number, h: number, d: number) {
    return mesh(name, 'box', m, px, y, pz, w, h, d);
  }
  // Register the same geometry used for visible floors so feet follow raised surfaces.
  function floor(name: string, type: 'box' | 'plane', m: pc.StandardMaterial, px: number, y: number, pz: number, w: number, h: number, d: number) {
    surfaces.push({ x: x(px), z: z(pz), w, d, y: y + (type === 'box' ? h / 2 : 0) });
    return mesh(name, type, m, px, y, pz, w, h, d);
  }
  function label(text: string, px: number, y: number, pz: number, width = 2.7) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#233f3b'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#c8be8e'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
    ctx.font = '500 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f6e9c4'; ctx.fillText(text, 256, 66, 465);
    const texture = new pc.Texture(app.graphicsDevice, { mipmaps: true }); texture.setSource(c); textures.push(texture);
    const m = mat(text, '#ffffff'); m.diffuseMap = texture; m.update();
    const e = mesh(text, 'plane', m, px, y, pz, width, 1, width / 4);
    return e;
  }
  // Procedural surface pattern: keeps the gameplay grid readable without map imagery.
  function tiled(name: string, color: string, line: string, scale: number) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff08';
    for (let i = 0; i < 180; i++) ctx.fillRect((i * 47) % 128, (i * 73) % 128, 2, 2);
    ctx.strokeStyle = line; ctx.lineWidth = 1.4; ctx.strokeRect(0, 0, 128, 128);
    const t = new pc.Texture(app.graphicsDevice, { mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
    t.setSource(c); textures.push(t);
    const m = mat(name, '#ffffff'); m.diffuseMap = t; m.diffuseMapTiling.set(scale, scale); m.update(); return m;
  }
  const cream = mat('Revoco marfil', '#ddd3b5');
  const white = mat('Piedra clara', '#e3dec8');
  const terracotta = mat('Terracota', '#c38266');
  const trim = mat('Aleros', '#9e9179');
  const roof = mat('Tejas grises', '#797a70');
  const roofEdge = mat('Juntas del tejado', '#6b6d64');
  const metal = mat('Forja verde', '#354d47', 0.5);
  const glass = mat('Cristal azul', '#557c83', 0.8);
  const warm = mat('Ventanas cálidas', '#f2c780', 0.3, 0.3);
  const grass = mat('Jardín', '#697f4e');
  const leaf = [mat('Olivo', '#78925b'), mat('Copa clara', '#98a86e'), mat('Copa oscura', '#597a54')];
  const trunk = mat('Troncos', '#817058');
  const asphalt = tiled('Pavimento de la calle', '#b0a48d', '#978d783e', 43);
  asphalt.diffuseMapTiling.set(12, 41); asphalt.update();
  const concrete = mat('Base', '#817e6d');
  const water = mat('Agua', '#59b8bd', 0.9, 0.08);
  const solar = mat('Panel solar', '#334b57', 0.65);
  const glow = mat('Farolas', '#ffdb9c', 0.2, 2);
  const w = environment.grid[0].length, d = environment.grid.length;
  const night = environment.id === 'patio';
  app.scene.ambientLight = night ? new pc.Color(0.19, 0.24, 0.3) : new pc.Color(0.48, 0.48, 0.43);
  const sun = new pc.Entity('Sol de la tarde');
  sun.addComponent('light', {
    type: 'directional', color: night ? new pc.Color(0.66, 0.81, 1) : new pc.Color(1, 0.87, 0.68),
    intensity: night ? 1.15 : 1.65, castShadows: true, shadowResolution: 2048,
    shadowDistance: 95, shadowBias: 0.2, normalOffsetBias: 0.04, shadowType: pc.SHADOW_PCF3_32F,
  });
  sun.setEulerAngles(48, -35, 0); root.addChild(sun);
  box('Fondo', mat('Fondo', night ? '#172a30' : '#67746b'), cx, -1.05, cz, 200, 0.2, 200);
  box('Maqueta', concrete, cx, -0.42, cz, w + 0.2, 0.8, d + 0.2);

  function pointLight(px: number, y: number, pz: number) {
    const light = new pc.Entity('Luz cálida');
    light.addComponent('light', { type: 'omni', color: new pc.Color(1, 0.68, 0.33), intensity: 2.4, range: 6 });
    light.setPosition(x(px), y, z(pz)); root.addChild(light);
  }
  function tree(px: number, pz: number, small = false) {
    const s = small ? 0.65 : 1;
    box('Alcorque', white, px, 0.04, pz, 0.9, 0.12, 0.9);
    box('Tierra', trunk, px, 0.11, pz, 0.73, 0.05, 0.73);
    mesh('Tronco', 'cylinder', trunk, px, 0.7 * s, pz, 0.17, 1.4 * s, 0.17);
    for (let i = 0; i < 3; i++) {
      const crown = mesh('Copa de árbol', 'sphere', leaf[i], px + (i - 1) * 0.31 * s, (1.7 + (i % 2) * 0.28) * s, pz + (i % 2) * 0.18, 1.4 * s, 1.5 * s, 1.35 * s);
      crown.setEulerAngles(i * 20, i * 45, 15);
    }
  }
  function car(px: number, pz: number, color: string) {
    const m = mat('Carrocería', color, 0.65);
    box('Coche', m, px, 0.32, pz + 0.5, 0.84, 0.45, 1.85);
    box('Cabina', glass, px, 0.66, pz + 0.5, 0.72, 0.36, 0.95);
    box('Techo coche', m, px, 0.86, pz + 0.53, 0.74, 0.08, 0.65);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const wheel = mesh('Rueda', 'cylinder', metal, px + side * 0.41, 0.2, pz + 0.5 + end * 0.59, 0.32, 0.13, 0.32);
      wheel.setEulerAngles(0, 0, 90);
    }
    box('Faros coche', white, px, 0.36, pz - 0.44, 0.6, 0.1, 0.03);
  }
  function gable(px: number, y: number, pz: number, rw: number, rd: number) {
    const h = 1.1;
    const positions = [-rw/2,0,-rd/2, rw/2,0,-rd/2, 0,h,-rd/2, -rw/2,0,rd/2, rw/2,0,rd/2, 0,h,rd/2];
    const indices = [0,2,1, 3,4,5, 0,3,5, 0,5,2, 1,2,5, 1,5,4, 0,1,4, 0,4,3];
    const geometry = new pc.Mesh(app.graphicsDevice);
    // Duplicate vertices per triangle: gables need hard edges, not averaged curved normals.
    const flatPositions = indices.flatMap(index => positions.slice(index * 3, index * 3 + 3));
    const flatIndices = indices.map((_, i) => i);
    geometry.setPositions(flatPositions); geometry.setNormals(pc.calculateNormals(flatPositions, flatIndices));
    geometry.setIndices(flatIndices); geometry.update(); meshes.push(geometry);
    const e = new pc.Entity('Tejado a dos aguas');
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(geometry, roof)], castShadows: true });
    e.setPosition(x(px), y, z(pz)); root.addChild(e);
    // Narrow strips follow each pitch and suggest the repeated roof tiles.
    const slope = Math.atan2(h, rw / 2) * 180 / Math.PI;
    for (let i = 0; i < 15; i++) for (const side of [-1, 1]) {
      const strip = box('Hilada del tejado', roofEdge, px + side * rw / 4, y + h / 2 + 0.02, pz - rd / 2 + i * rd / 14, Math.hypot(rw/2, h), 0.025, 0.027);
      strip.setEulerAngles(0, 0, -side * slope);
    }
  }

  if (environment.id === 'maresme') {
    floor('Terreno ajardinado', 'box', grass, cx, -0.015, cz, w, 0.08, d);
    // Planes retain a regular one-unit texture grid across the long passage.
    const street = floor('Calle adoquinada', 'plane', asphalt, 15.5, 0.036, 21, 12, 1, 41);
    street.render!.castShadows = false;
    const bulb = floor('Fondo ensanchado de la calle', 'box', mat('Pavimento del fondo', '#b0a48d'), 16, 0.015, 4, 17, 0.04, 5);
    bulb.render!.castShadows = false;
    for (const sx of [9.5, 21]) {
      floor('Acera terracota', 'box', terracotta, sx, 0.045, 21, 1.4, 0.12, 41);
      floor('Bordillo', 'box', white, sx + (sx < 16 ? 0.78 : -0.78), 0.065, 21, 0.12, 0.15, 41);
    }
    for (const house of environment.houses) {
      const hx = house.x + (house.w - 1) / 2, hz = house.z + 2;
      const east = house.side === 'east';
      const facadeX = east ? house.x - 0.51 : house.x + house.w - 0.49;
      const patioX = east ? 25.5 : 8.5;
      floor('Patio de terracota', 'box', terracotta, patioX, 0.09, hz, east ? 8 : 2, 0.16, 4.82);
      box('Casa', cream, hx, 1.48, hz, house.w - 0.06, 2.9, 4.9);
      box('Alero', trim, hx, 2.96, hz, house.w + 0.3, 0.16, 5.04);
      gable(hx, 3.04, hz, house.w + 0.4, 5.07);
      box('Chimenea', cream, hx + 1.3, 3.9, hz - 0.9, 0.35, 0.9, 0.36);
      box('Sombrero chimenea', trim, hx + 1.3, 4.38, hz - 0.9, 0.45, 0.12, 0.46);
      for (const dz of [-1.4, 1.4]) {
        box('Marco ventana', white, facadeX, 2.05, hz + dz, 0.09, 0.93, 0.93);
        box('Ventana', glass, facadeX + (east ? -0.055 : 0.055), 2.05, hz + dz, 0.04, 0.74, 0.73);
        box('Persiana', metal, facadeX + (east ? -0.08 : 0.08), 2.37, hz + dz, 0.05, 0.12, 0.76);
      }
      box('Puerta', house.id === 'gerard' ? mat('Puerta Gerard', '#587e72') : metal, facadeX, 0.72, hz, 0.12, 1.45, 0.85);
      box('Timbre', warm, facadeX + (east ? -0.09 : 0.09), 1.08, hz + 0.66, 0.07, 0.12, 0.09);
      if (house.solar) {
        const panel = box('Placas solares', solar, hx + 1.5, 3.74, hz + 0.2, 2.4, 0.08, 2.75);
        panel.setEulerAngles(0, 0, -Math.atan2(1.1, (house.w + 0.4) / 2) * 180 / Math.PI);
        for (let i = 0; i < 5; i++) {
          const line = box('Celdas solares', trim, hx + 1.5, 3.79, hz - 1.05 + i * 0.63, 2.4, 0.02, 0.025);
          line.setEulerAngles(0, 0, -Math.atan2(1.1, (house.w + 0.4) / 2) * 180 / Math.PI);
        }
      }
      if (east) {
        for (const dz of [-2.47, 2.47]) box('Medianera del patio', cream, 25.5, 0.48, hz + dz, 8.7, 0.88, 0.12);
        if (house.id === 'gerard') {
          for (const dz of [-1.4, 1.4]) box('Muro de entrada', cream, 22, 0.44, hz + dz, 0.16, 0.8, 1.95);
          // A visible opening in the gate aligns exactly with walkable cell 22,24.
          label('20', 23.4, 0.19, hz, 0.85);
        } else {
          box('Muro del jardín', cream, 22, 0.48, hz, 0.18, 0.88, 4.86);
          if (house.pool) {
            box('Borde piscina', white, 26.3, 0.18, hz, 4.5, 0.16, 3.4);
            box('Piscina', water, 26.3, 0.27, hz, 4.15, 0.035, 3.05);
          } else {
            floor('Césped del patio', 'box', grass, 26.2, 0.2, hz, 5.4, 0.06, 3.1);
            tree(24.2, hz - 0.7, true);
          }
        }
      }
    }
    for (const prop of environment.props) {
      if (prop.kind === 'tree') tree(prop.x, prop.z);
      else car(prop.x, prop.z, prop.color!);
    }
    for (const pz of [11, 27, 36]) {
      box('Farola', metal, 20.8, 1.65, pz, 0.075, 3.3, 0.075);
      box('Luminaria', glow, 20.8, 3.28, pz, 0.38, 0.16, 0.45);
    }
    label('PASSATGE MARESME', 15.6, 0.06, 33, 5.4);
    label('SANT QUIRZE', 15.6, 0.06, 6, 3.8);
    // Boundary hedges close the playable slice without pretending it is the whole town.
    for (const pz of [0.7, 41.6]) box('Límite del barrio', leaf[2], 16, 0.38, pz, 17, 0.65, 0.7);
  } else if (environment.id === 'home') {
    const wood = tiled('Parquet', '#b49a72', '#8c735a55', 13);
    floor('Suelo de casa', 'plane', wood, cx, 0.02, cz, w, 1, d);
    // Cutaway front walls preserve visibility inside the provisional room.
    box('Pared del fondo', cream, cx, 1.4, 0, w, 2.8, 0.2);
    box('Pared lateral', cream, 0, 1.4, cz, 0.2, 2.8, d);
    box('Pared baja', cream, 12, 0.2, cz, 0.2, 0.4, d);
    for (const px of [2.75, 9.25]) box('Pared de salida', cream, px, 0.2, 11, 5.5, 0.4, 0.2);
    floor('Puerta de salida', 'box', metal, 6, 0.035, 10.5, 1, 0.035, 1);
    floor('Alfombra', 'box', mat('Alfombra', '#799185'), 6, 0.04, 6, 4.5, 0.02, 4.5);
    const sofa = mat('Sofá verde', '#758675');
    box('Sofá', sofa, 3, 0.38, 2.5, 2.9, 0.7, 1.9);
    box('Respaldo sofá', sofa, 3, 0.85, 1.75, 2.9, 0.95, 0.35);
    box('Mesa', trim, 8.5, 0.65, 5.5, 1.8, 0.18, 1.8);
    box('Pie de mesa', metal, 8.5, 0.32, 5.5, 0.5, 0.6, 0.5);
    box('Ventana de casa', glass, 0.12, 1.75, 5, 0.08, 1.5, 2.8);
    box('Lámpara', glow, 10.5, 2.4, 2, 0.6, 0.25, 0.6); pointLight(10.5, 2.5, 2);
    label('INTERIOR PROVISIONAL', 6, 0.065, 4, 3.6);
  } else {
    const stone = mat('Muros del patio', '#536e79');
    const tile = mat('Baldosas del patio', '#58726d');
    environment.grid.forEach((row, pz) => [...row].forEach((v, px) => {
      floor('Baldosa', 'box', tile, px, -0.015, pz, 0.96, 0.08, 0.96);
      if (v !== '#') return;
      const h = px === 12 || pz === 12 ? 0.42 : px === 0 || pz === 0 ? 1.35 : 0.92;
      box('Muro', stone, px, h / 2, pz, 0.96, h, 0.96);
      box('Remate', white, px, h + 0.04, pz, 1.01, 0.08, 1.01);
    }));
    for (const [px, pz, y] of [[0,3,1.5],[5,0,1.5],[9,3,1.05],[3,8,1.05],[12,9,0.55],[2,12,0.55]]) {
      box('Farol', glow, px, y + 0.22, pz, 0.24, 0.38, 0.24); pointLight(px, y + 0.7, pz);
    }
  }
  return {
    root,
    groundHeight(px: number, pz: number) {
      let height = environment.id === 'home' ? .02 : .025;
      for (const surface of surfaces) {
        if (Math.abs(px - surface.x) <= surface.w / 2 && Math.abs(pz - surface.z) <= surface.d / 2) height = Math.max(height, surface.y);
      }
      return height;
    },
    toWorld(px: number, pz: number) { return new pc.Vec3(x(px), 0, z(pz)); },
    destroy() { root.destroy(); materials.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); meshes.forEach(m => m.destroy()); },
  };
}
