import * as pc from 'playcanvas';
import type { Environment } from './environments';
import { createPropKit } from './props';
import { buildHome } from './home-scenery';

/** Visual-only builder. Gameplay uses Environment.grid and interactions. */
export function buildScenery(app: pc.Application, environment: Environment) {
  const root = new pc.Entity(`Entorno: ${environment.id}`);
  app.root.addChild(root);
  const materials: pc.StandardMaterial[] = [];
  const textures: pc.Texture[] = [];
  const meshes: pc.Mesh[] = [];
  const surfaces: { x: number; z: number; w: number; d: number; y: number }[] = [];
  const props = createPropKit();
  let home: ReturnType<typeof buildHome> | undefined;
  const flowing: pc.StandardMaterial[] = [];
  let time = 0;
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
  // Everything built here stands still, so it is merged into a few draw calls per material.
  const batch = app.batcher.addGroup(`Estático: ${environment.id}`, false, 16);
  function mesh(name: string, type: string, m: pc.StandardMaterial, px: number, y: number, pz: number, w: number, h: number, d: number) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: true, receiveShadows: true, batchGroupId: batch.id });
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
  function texture(c: HTMLCanvasElement) {
    const t = new pc.Texture(app.graphicsDevice, { mipmaps: true, anisotropy: 8, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
    t.setSource(c); textures.push(t); return t;
  }
  // Deterministic jitter keeps procedural surfaces identical between reloads.
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  /** One cell of running-bond pavers; the faint outer seam still marks the movement grid. */
  function paving(name: string, base: [number, number, number], rows: number, cols: number) {
    const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = `rgb(${base.map(v => v * .82).join()})`; ctx.fillRect(0, 0, size, size);
    const h = size / rows, w = size / cols;
    for (let r = 0; r < rows; r++) for (let k = -1; k < cols; k++) {
      const offset = r % 2 ? w / 2 : 0, shade = .94 + jitter(r * 17 + k) * .1;
      ctx.fillStyle = `rgb(${base.map(v => Math.min(255, v * shade)).join()})`;
      ctx.beginPath(); ctx.roundRect(k * w + offset + 2, r * h + 2, w - 4, h - 4, 5); ctx.fill();
      ctx.fillStyle = '#ffffff0d'; ctx.fillRect(k * w + offset + 5, r * h + 4, w - 10, 3);
    }
    ctx.fillStyle = '#00000010';
    for (let i = 0; i < 260; i++) ctx.fillRect(jitter(i) * size, jitter(i + 999) * size, 2, 2);
    ctx.strokeStyle = '#6e654f30'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, size, size);
    const m = mat(name, '#ffffff'); m.diffuseMap = texture(c); m.update(); return m;
  }
  /** Soft caustic ribbons; two layers drift against each other so the pools shimmer. */
  function waterMaterial() {
    const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#52b3ba'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#aeeae440'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const y = jitter(i) * size, a = jitter(i + 40) * 8 + 3;
      ctx.beginPath();
      for (let px = -8; px <= size + 8; px += 8) ctx.lineTo(px, y + Math.sin(px / size * Math.PI * 2 * 2 + i) * a);
      ctx.stroke();
    }
    const t = texture(c);
    const m = mat('Agua', '#ffffff', 0.9);
    m.diffuseMap = t; m.diffuseMapTiling.set(2.4, 1.8);
    m.emissive.fromString('#9fe7e4'); m.emissiveMap = t; m.emissiveIntensity = .12; m.emissiveMapTiling.set(1.7, 2.6);
    m.update(); flowing.push(m); return m;
  }
  const white = mat('Piedra clara', '#e3dec8');
  const terracotta = mat('Terracota', '#c38266');
  const trim = mat('Aleros', '#9e9179');
  const glass = mat('Cristal azul', '#557c83', 0.8);
  const warm = mat('Ventanas cálidas', '#f2c780', 0.3, 0.3);
  const grass = mat('Jardín', '#697f4e');
  const leaf = props.leaf;
  const trunk = mat('Troncos', '#817058');
  const blooms = [mat('Flor coral', '#e98a6d', .3), mat('Flor crema', '#f3e6c0', .3), mat('Flor lila', '#b89ad0', .3), mat('Flor amarilla', '#efc75a', .3)];
  const asphalt = paving('Pavimento de la calle', [176, 164, 141], 4, 2);
  asphalt.diffuseMapTiling.set(12, 41); asphalt.update();
  const sidewalk = paving('Baldosa de acera', [195, 130, 102], 2, 2);
  sidewalk.diffuseMapTiling.set(1.4, 41); sidewalk.update();
  const concrete = mat('Base', '#817e6d');
  const water = waterMaterial();
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
  // Floor plans lay their own backdrop, open under a stairwell.
  if (!environment.plan) box('Fondo', mat('Fondo', night ? '#172a30' : '#67746b'), cx, -1.05, cz, 200, 0.2, 200);
  // Floor plans build their own plinth, with room for a stairwell going down.
  if (!environment.plan) box('Maqueta', concrete, cx, -0.42, cz, w + 0.2, 0.8, d + 0.2);

  function pointLight(px: number, y: number, pz: number) {
    const light = new pc.Entity('Luz cálida');
    light.addComponent('light', { type: 'omni', color: new pc.Color(1, 0.68, 0.33), intensity: 2.4, range: 6 });
    light.setPosition(x(px), y, z(pz)); root.addChild(light);
  }
  function planter(px: number, pz: number, length: number, along: 'x' | 'z') {
    const [w, d] = along === 'x' ? [length, 0.42] : [0.42, length];
    box('Jardinera', trim, px, 0.2, pz, w, 0.28, d);
    box('Tierra de jardinera', trunk, px, 0.345, pz, w - 0.08, 0.03, d - 0.08);
    const count = Math.round(length * 2.4);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count - .5, fx = along === 'x' ? px + t * length : px, fz = along === 'z' ? pz + t * length : pz;
      const r = .14 + jitter(px * 13 + pz * 7 + i) * .08;
      mesh('Mata', 'sphere', leaf[i % 3], fx, 0.43, fz, r * 1.6, r * 1.3, r * 1.6);
      if (i % 2 === 0) mesh('Flor', 'sphere', blooms[(i / 2 + Math.round(px)) % blooms.length], fx + .05, 0.56, fz + .04, 0.09, 0.08, 0.09);
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
      floor('Acera terracota', 'box', sidewalk, sx, 0.045, 21, 1.4, 0.12, 41);
      floor('Bordillo', 'box', white, sx + (sx < 16 ? 0.78 : -0.78), 0.065, 21, 0.12, 0.15, 41);
    }
    /**
     * Street models: every plot is a courtyard behind a street front and a flat-roofed house
     * at the back, like number 20 (the entrance scene is the inside of Gerard's). Some plots
     * have a garage built into the street wall, some a driveway, some neither; each mixes
     * its own pieces from a seeded pick. East fronts face away from the camera, so their walls
     * stay low to keep the pavement in view. West plots are mirrored.
     * `u` measures inwards from the street line; `v` runs along the street (z).
     */
    const renders = ['#eeeae2', '#e7e0d2', '#dcd8d0', '#f1ece2', '#e3ddd3', '#ece3d6'];
    const dark = mat('Perfilería negra', '#2a2d30', 0.35), gravel = mat('Grava', '#bdb6a7', 0.05);
    const paving = mat('Piedra del patio', '#d9d2c3', 0.25), deck = mat('Tarima', '#a37b55', 0.2);
    const drive = mat('Adoquín del acceso', '#a9a295', 0.2), hedge = mat('Seto', '#5d7a52', 0.1);
    const soilBed = mat('Huerto', '#6f5e49'), sectional = mat('Puerta seccional', '#d2d3cf', 0.4);
    const oakSlats = mat('Listones de roble', '#a67c52', 0.25), darkSlats = mat('Listones oscuros', '#4a4643', 0.25);
    const renderMats = new Map<string, pc.StandardMaterial>();
    const carColours = ['#9aa4a8', '#6f8fa8', '#b95641', '#e4dfd2', '#353f44', '#7c8b6a'];
    type Pick = { front: 'plain' | 'hedge' | 'railing'; parking: 'garage' | 'drive' | 'none'; yard: 'deck' | 'pool' | 'lawn' | 'garden' | 'gravel' | 'planter'; windows: 'band' | 'slits' | 'corner' };
    function modernHouse(house: Environment['houses'][number], index: number) {
      const east = house.side === 'east', gerard = house.id === 'gerard', bernat = house.id === 'bernat';
      const rnd = (k: number) => jitter(index * 31 + (east ? 7 : 0) + k * 13);
      const pick = <T,>(k: number, list: readonly T[]) => list[Math.floor(rnd(k) * list.length)];
      const street = east ? 22 : 7.55, dir = east ? 1 : -1;
      const yard = east ? 7.55 : 2, back = east ? 13.5 : 6.95;
      const hz = house.z + 2, north = hz - 2.45, south = hz + 2.45;
      const colour = gerard || bernat ? '#eeeae2' : pick(1, renders);
      let render = renderMats.get(colour);
      if (!render) { render = mat('Revoco', colour, 0.1); renderMats.set(colour, render); }
      const style: Pick = gerard ? { front: 'plain', parking: 'garage', yard: 'deck', windows: 'band' } : {
        front: pick(2, ['plain', 'hedge', 'railing'] as const),
        parking: bernat ? 'none' : pick(3, ['garage', 'drive', 'none', 'none'] as const),
        yard: !east ? 'planter' : house.pool ? 'pool' : pick(4, ['lawn', 'garden', 'gravel'] as const),
        windows: pick(5, ['band', 'slits', 'corner'] as const),
      };
      const storeys = gerard || rnd(6) > 0.35 ? 2 : 1, setback = !gerard && storeys === 2 && rnd(7) > 0.5;
      const cladding = gerard ? undefined : pick(8, [undefined, oakSlats, darkSlats]);
      const balcony = !gerard && storeys === 2 && !setback && rnd(9) > 0.4;
      const at = (u: number) => street + dir * u;
      // A box between inward distances u0..u1 and street positions v0..v1.
      const bx = (name: string, m: pc.StandardMaterial, u0: number, u1: number, y0: number, h: number, v0: number, v1: number) =>
        box(name, m, (at(u0) + at(u1)) / 2, y0 + h / 2, (v0 + v1) / 2, Math.abs(u1 - u0), h, v1 - v0);
      // Parking takes the south half; east courtyard trees stand in the north half.
      const [p0, p1] = east ? [hz + 0.1, south - 0.1] : [hz + 0.8, south - 0.1];
      const garageDepth = east ? 2.9 : yard - 0.1;
      bx('Patio', paving, 0, yard, 0.01, 0.06, north, south);
      if (style.parking === 'drive') bx('Acceso', drive, 0, east ? 4.9 : yard, 0.02, 0.06, p0, p1);
      // Street front: low where it faces away from the camera, full height where it faces it.
      const wallTop = east ? (style.front === 'plain' ? 0.95 : 0.7) : 2.1;
      const gate = east ? hz - 1.3 : hz;
      const parked = style.parking !== 'none';
      const segments = parked ? [[north, gate - 0.45], [gate + 0.45, p0], [p1, south]] as const : [[north, gate - 0.45], [gate + 0.45, south]] as const;
      for (const [v0, v1] of segments) {
        bx('Muro de la calle', render, -0.1, 0.1, 0, wallTop, v0, v1);
        if (!east) continue;
        if (style.front === 'hedge') bx('Seto', hedge, -0.05, 0.3, wallTop, 0.45, v0 + 0.05, v1 - 0.05);
        // Thin repeated pieces skip shadows: they are many and their shadows read as noise.
        if (style.front === 'railing') for (let v = v0 + 0.1; v < v1; v += 0.28) bx('Barrote', dark, -0.02, 0.02, wallTop, 0.6, v, v + 0.035).render!.castShadows = false;
      }
      if (east) {
        bx('Cancela', dark, -0.03, 0.03, 0, 1.15, gate - 0.45, gate + 0.45);
        if (style.parking === 'drive') bx('Puerta del acceso', dark, -0.03, 0.03, 0, 1.15, p0, p1);
        for (const v of [gate - 0.5, gate + 0.5, ...(style.parking === 'drive' ? [p0, p1] : [])]) bx('Pilar', render, -0.13, 0.13, 0, 1.25, v - 0.06, v + 0.06);
        bx('Buzón', dark, 0.12, 0.32, 0.75, 0.3, gate + 0.55, gate + 0.8);
      } else {
        bx('Puerta de la calle', dark, -0.13, -0.1, 0, 2.0, gate - 0.45, gate + 0.45);
        bx('Timbre', warm, -0.15, -0.1, 1.05, 0.12, gate + 0.55, gate + 0.63);
        if (style.parking === 'drive') bx('Cancela del acceso', dark, -0.13, -0.1, 0, 1.3, p0 + 0.1, p1 - 0.1);
      }
      if (gerard || bernat) bx('Felpudo', mat('Coco', '#8a6a45', 0.05), -0.75, -0.2, 0.05, 0.02, gate - 0.42, gate + 0.42);
      // Above the lawn and gravel fills (top 0.09) so the plaque does not z-fight with them.
      if (house.number) label(String(house.number), at(0.55), 0.1, gate, 0.6);
      for (const v of [north, south]) bx('Medianera', render, 0.1, yard, 0, 1.5, v - 0.07, v + 0.07);
      // Parking: a garage built into the street wall, or an open driveway with the car in it.
      if (style.parking === 'garage') {
        bx('Garaje', render, -0.1, garageDepth, 0, 2.1, p0, p1);
        bx('Cubierta del garaje', gravel, 0, garageDepth - 0.1, 2.1, 0.03, p0 + 0.1, p1 - 0.1);
        bx('Puerta del garaje', sectional, -0.13, -0.1, 0, 2.0, p0 + 0.15, p1 - 0.15);
      } else if (style.parking === 'drive') {
        props.place({ kind: 'car', x: 0, z: 0, color: pick(10, carColours) }, root, new pc.Vec3(x(at(east ? 2.3 : 0.35)), 0, z((p0 + p1) / 2))).setLocalEulerAngles(0, east ? 90 : -90, 0);
      }
      // What each courtyard holds.
      // Without parking the courtyard runs the whole plot.
      const [y0, y1] = east ? [north + 0.1, parked ? hz - 0.05 : south - 0.1] : [north + 0.1, hz + 0.6];
      if (style.yard === 'deck') {
        bx('Patio 2', deck, 4.5, 7.5, 0, 0.3, y0, hz + 0.25);
        bx('Jardinera', dark, 0.3, 4.3, 0, 0.45, north + 0.1, north + 0.5);
        for (let i = 0; i < 9; i++) mesh('Gramínea', 'cone', leaf[i % 3], at(0.6 + i * 0.44), 0.6 + jitter(i) * 0.1, north + 0.3, 0.2, 0.45, 0.2);
      } else if (style.yard === 'pool') {
        bx('Borde piscina', white, 2.4, 7.2, 0, 0.16, y0 + 0.25, y1);
        bx('Piscina', water, 2.6, 7.0, 0.16, 0.02, y0 + 0.45, y1 - 0.2);
        bx('Tumbona', deck, 5.4, 7.3, 0, 0.3, p0 + 0.2, p0 + 0.8);
      } else if (style.yard === 'lawn') {
        bx('Césped', grass, 0.1, 7.5, 0.04, 0.05, y0, y1);
        bx('Tarima', deck, 5.2, 7.5, 0, 0.18, p0, p1);
        bx('Mesa de jardín', oakSlats, 5.9, 6.8, 0.18, 0.55, p0 + 0.6, p0 + 1.5);
      } else if (style.yard === 'garden') {
        bx('Césped', grass, 0.1, 7.5, 0.04, 0.05, y0, y1);
        for (let r = 0; r < 3; r++) {
          bx('Bancal', deck, 3.4, 7.2, 0, 0.25, y0 + 0.25 + r * 0.75, y0 + 0.8 + r * 0.75);
          bx('Tierra', soilBed, 3.5, 7.1, 0.25, 0.02, y0 + 0.3 + r * 0.75, y0 + 0.75 + r * 0.75);
          for (let i = 0; i < 6; i++) mesh('Hortaliza', 'sphere', leaf[(i + r) % 3], at(3.8 + i * 0.6), 0.36, y0 + 0.52 + r * 0.75, 0.3, 0.22, 0.3).render!.castShadows = false;
        }
      } else if (style.yard === 'gravel') {
        bx('Grava', gravel, 0.1, 7.5, 0.04, 0.05, y0, y1);
        for (let i = 0; i < 5; i++) bx('Pisadera', paving, 1 + i * 1.3, 1.6 + i * 1.3, 0.09, 0.02, hz - 1.4 + (i % 2) * 0.4, hz - 0.8 + (i % 2) * 0.4);
        for (let i = 0; i < 4; i++) mesh('Mata', 'sphere', leaf[i % 3], at(5.2 + i * 0.5), 0.3, north + 0.5 + (i % 2) * 0.4, 0.5, 0.45, 0.5);
      } else {
        bx('Jardinera', dark, 0.3, yard - 0.1, 0, 0.45, north + 0.1, north + 0.5);
        for (let i = 0; i < 3; i++) mesh('Mata', 'sphere', leaf[i], at(0.6 + i * 0.5), 0.6, north + 0.3, 0.42, 0.36, 0.38);
      }
      // The house: render volumes, windows, optional slats and balcony, a flat roof.
      const lower = storeys === 2 && !setback ? 5.1 : 2.9;
      bx('Casa', render, yard, back, 0, lower, north, south);
      const tops: [number, number, number][] = [[yard, back, lower]];
      if (setback) {
        const u0 = yard + 1.2 + rnd(11) * 1.4;
        bx('Planta alta', render, u0, back, lower, 2.3, north + 0.3, south - 0.6);
        tops.push([u0, back, lower + 2.3]);
      }
      for (const [i, [u0, u1, y]] of tops.entries()) {
        const [v0, v1] = i ? [north + 0.3, south - 0.6] : [north, south];
        bx('Cubierta', gravel, u0 + 0.15, u1 - 0.15, y, 0.02, v0 + 0.15, v1 - 0.15);
        for (const [a0, a1, w0, w1] of [[u0, u1, v0, v0 + 0.18], [u0, u1, v1 - 0.18, v1], [u0, u0 + 0.18, v0, v1], [u1 - 0.18, u1, v0, v1]]) bx('Peto', render, a0, a1, y, 0.28, w0, w1);
      }
      if (house.solar) {
        const [u0, u1, y] = tops[tops.length - 1];
        for (let r = 0; r < 2; r++) {
          const panel = box('Placas solares', solar, (at(u0 + 0.6) + at(u1 - 0.6)) / 2, y + 0.3, north + 1.2 + r * 1.3 + (tops.length > 1 ? 0.3 : 0), Math.abs(u1 - u0) - 1.4, 0.05, 0.9);
          panel.setEulerAngles(-25, 0, 0);
        }
      }
      // Windows on the faces the camera sees: south, the back of east plots, the front of west ones.
      for (let f = 0; f < storeys; f++) {
        const y = 0.95 + f * 2.35, face = f === 1 && setback ? south - 0.6 : south;
        const [w0, w1] = f === 1 && setback ? [tops[1][0] + 0.4, back - 0.4] : [yard + 0.5, back - 0.5];
        if (style.windows === 'band') {
          bx('Ventanal', dark, w0, w1, y, 1.25, face - 0.02, face + 0.04);
          bx('Cristal', glass, w0 + 0.1, w1 - 0.1, y + 0.1, 1.05, face + 0.04, face + 0.07);
        } else if (style.windows === 'slits') {
          for (let u = w0; u + 0.5 <= w1; u += 1.1) {
            bx('Ventana', dark, u, u + 0.5, y - 0.3, 1.8, face - 0.02, face + 0.04);
            bx('Cristal', glass, u + 0.06, u + 0.44, y - 0.24, 1.68, face + 0.04, face + 0.07);
          }
        } else {
          bx('Ventana en esquina', dark, w1 - 2.2, w1 + 0.52, y, 1.3, face - 0.02, face + 0.04);
          bx('Cristal', glass, w1 - 2.1, w1 + 0.5, y + 0.1, 1.1, face + 0.04, face + 0.07);
          bx('Ventana', dark, w0, w0 + 1.2, y + 0.3, 0.7, face - 0.02, face + 0.04);
        }
        const uFace = f === 1 && setback ? (east ? back : tops[1][0]) : (east ? back : yard);
        const out = east ? 0.06 : -0.06;
        bx('Ventana', dark, uFace, uFace + out, y, 1.2, hz - 1.9, hz - 0.3);
        bx('Cristal', glass, uFace + out, uFace + out * 1.5, y + 0.1, 1.0, hz - 1.8, hz - 0.4);
      }
      if (balcony) {
        bx('Balcón', render, yard + 1, yard + 3.4, 2.75, 0.14, south, south + 0.9);
        bx('Barandilla del balcón', glass, yard + 1, yard + 3.4, 2.89, 0.9, south + 0.85, south + 0.9);
      }
      if (cladding) bx('Revestimiento de listones', cladding, back - 2.2, back - 0.3, 0.05, lower - 0.3, south, south + 0.05);
      bx('Cristalera', dark, yard - 0.06, yard, 0, 2.1, hz - 1.7, hz + 0.1);
    }
    environment.houses.forEach(modernHouse);
    for (const house of environment.houses) {
      if (house.side !== 'west') continue;
      floor('Acceso de terracota', 'box', terracotta, 8.3, 0.09, house.z + 2, 1.3, 0.16, 4.82);
      for (const dz of [-1.2, 1.2]) planter(8, house.z + 2 + dz, 1.2, 'z');
    }
    label('PASSATGE MARESME', 15.6, 0.06, 33, 5.4);
    label('SANT QUIRZE', 15.6, 0.06, 6, 3.8);
    // Boundary hedges close the playable slice without pretending it is the whole town.
    for (const pz of [0.7, 41.6]) box('Límite del barrio', leaf[2], 16, 0.38, pz, 17, 0.65, 0.7);
  } else if (environment.plan) {
    home = buildHome({
      app, root, props, mat, texture, x, z,
      surface: (px, pz, w, d, top) => { surfaces.push({ x: x(px), z: z(pz), w, d, y: top }); },
    }, environment);
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
  // Props come from the environment data, so any scene can use trees, cars, lamps…
  for (const prop of environment.props) props.place(prop, root, new pc.Vec3(x(prop.x), 0, z(prop.z)));
  return {
    root,
    groundHeight(px: number, pz: number) {
      // The highest surface underfoot, which may be below the floor (steps going down).
      let height = -Infinity;
      for (const surface of surfaces) {
        if (Math.abs(px - surface.x) <= surface.w / 2 && Math.abs(pz - surface.z) <= surface.d / 2) height = Math.max(height, surface.y);
      }
      return Number.isFinite(height) ? height : .025;
    },
    toWorld(px: number, pz: number) { return new pc.Vec3(x(px), 0, z(pz)); },
    /** `focus` is what must stay visible (the player); crowns in front of it turn see-through. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      props.update(dt, animate, focus, toCamera);
      home?.update(dt, animate, focus, toCamera);
      if (!animate) return;
      time += dt;
      for (const m of flowing) { m.diffuseMapOffset.set(time * .03, time * .05); m.emissiveMapOffset.set(-time * .04, time * .025); m.update(); }
    },
    destroy() { app.batcher.removeGroup(batch.id); root.destroy(); props.destroy(); home?.destroy(); materials.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); meshes.forEach(m => m.destroy()); },
  };
}
