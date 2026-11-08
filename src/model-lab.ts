import * as pc from 'playcanvas';
import RIG from '../assets/models/sobremesa/rig.json' with { type: 'json' };
import { startCharacters } from './character-lab';
import { ATTACK_TIME, BONES, bindSobremesa, FRIENDS, MODEL_URL, type Acts, type Friend } from './sobremesa';

/**
 * Model lab (development, `just model-lab`): La Sobremesa on a turntable, to see how it moves and how
 * it is rigged. Drag to turn round it, wheel to come closer. Each friend can attack or be freed, the
 * couples can attack together, and the rig shows as bones or as the colour of the bone each vertex
 * follows (the debug copy `just rig sobremesa` writes to output/, served only by the dev server).
 * With `?personajes` it shows the Meshy characters instead, walking and running (src/character-lab.ts).
 */
const DEBUG_URL = '/output/models/sobremesa/pesos.glb';
const colour = Object.fromEntries(RIG.bones.map(b => [b.name, (b as { colour?: string }).colour ?? '#7d7f73'])) as Record<string, string>;

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
const status = document.querySelector<HTMLElement>('#status')!;

async function start() {
  if (!('gpu' in navigator)) { status.textContent = 'Este navegador no tiene WebGPU.'; return; }
  const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [pc.DEVICETYPE_WEBGPU], antialias: true, alpha: false });
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.AnimComponentSystem];
  options.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.AnimClipHandler];
  app.init(options);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  window.addEventListener('resize', () => app.resizeCanvas());
  app.scene.ambientLight = new pc.Color(.42, .4, .38);

  const camera = new pc.Entity('Cámara');
  camera.addComponent('camera', { clearColor: new pc.Color(.09, .105, .08), fov: 35, nearClip: .05, farClip: 50 });
  app.root.addChild(camera);
  const sun = new pc.Entity('Sol');
  sun.addComponent('light', { type: 'directional', color: new pc.Color(1, .93, .82), intensity: 1.35, castShadows: false });
  sun.setEulerAngles(42, 28, 0);
  app.root.addChild(sun);
  const fill = new pc.Entity('Relleno');
  fill.addComponent('light', { type: 'directional', color: new pc.Color(.55, .6, .8), intensity: .45 });
  fill.setEulerAngles(-20, 200, 0);
  app.root.addChild(fill);
  const floor = new pc.Entity('Suelo');
  const ground = new pc.StandardMaterial(); ground.diffuse.set(.16, .17, .13); ground.update();
  floor.addComponent('render', { type: 'plane', material: ground });
  floor.setLocalScale(6, 1, 6); floor.setPosition(0, -.82, 0);
  app.root.addChild(floor);

  const container = (url: string) => new Promise<pc.ContainerResource>((resolve, reject) => app.assets.loadFromUrl(url, 'container', (error, asset) => {
    if (error || !asset) { reject(error); return; }
    resolve(asset.resource as pc.ContainerResource);
  }));
  const load = async (url: string) => (await container(url)).instantiateRenderEntity();
  if (new URLSearchParams(location.search).has('personajes')) {
    document.title = 'Laboratorio de personajes · Gerard 35';
    await startCharacters({ app, canvas, camera, floor, load: container }, panel, status);
    app.start();
    return;
  }
  const model = await load(MODEL_URL);
  app.root.addChild(model);
  const rig = bindSobremesa(model);
  let debug: { model: pc.Entity; rig: ReturnType<typeof bindSobremesa> } | undefined;
  let view: 'texture' | 'weights' = 'texture', bones = false;

  // Orbit: drag turns, wheel zooms, round the middle of the creature.
  let yaw = 18, pitch = 8, distance = 4.6;
  const target = new pc.Vec3(0, 0, 0);
  const place = () => {
    const y = pc.math.DEG_TO_RAD * yaw, p = pc.math.DEG_TO_RAD * pitch;
    camera.setPosition(target.x + Math.sin(y) * Math.cos(p) * distance, target.y + Math.sin(p) * distance, target.z + Math.cos(y) * Math.cos(p) * distance);
    camera.lookAt(target);
  };
  let drag: { x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * .35; pitch = pc.math.clamp(pitch + (e.clientY - drag.y) * .25, -10, 70);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { drag = undefined; });
  canvas.addEventListener('wheel', e => { distance = pc.math.clamp(distance * (1 + e.deltaY * .001), 1.6, 12); e.preventDefault(); }, { passive: false });

  let acts: Acts = {}, time = 0, spin = true;
  const attack = (...friends: Friend[]) => { for (const f of friends) if (acts[f]?.kind !== 'free') acts[f] = { kind: 'attack', since: time }; };
  const free = (f: Friend) => { acts[f] = { kind: 'free', since: time }; };

  function render() {
    const row = (f: Friend) => `<div class="row"><span><i style="--c:${colour[f]}"></i>${f}</span>
      <button data-attack="${f}" ${acts[f]?.kind === 'free' ? 'disabled' : ''}>Ataque</button><button data-free="${f}" ${acts[f]?.kind === 'free' ? 'disabled' : ''}>Liberar</button></div>`;
    panel.innerHTML = `<h1>La Sobremesa</h1><p>Arrastra para girar, rueda para acercar.</p>
      <h2>CADA AMIGO</h2>${FRIENDS.map(row).join('')}
      <h2>DÚOS</h2><div class="wide"><button data-duo="Anna,Álvaro">Anna + Álvaro</button><button data-duo="Sarah,Miquel">Sarah + Miquel</button><button data-duo="${FRIENDS.join(',')}">Todos a la vez</button></div>
      <h2>VER</h2><div class="wide"><button data-view="texture" aria-pressed="${view === 'texture'}">Textura</button><button data-view="weights" aria-pressed="${view === 'weights'}">Pesos</button>
        <button data-bones aria-pressed="${bones}">Huesos</button><button data-spin aria-pressed="${spin}">Girar solo</button></div>
      <h2>RIG</h2><p>${BONES.length} huesos. En Pesos, cada vértice va del color del hueso que lo lleva; gris es la raíz, que no se dobla.</p>
      <div class="wide"><button data-reset>Volver a empezar</button></div>`;
  }
  panel.addEventListener('click', async event => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.attack) attack(b.dataset.attack as Friend);
    else if (b.dataset.free) free(b.dataset.free as Friend);
    else if (b.dataset.duo) attack(...b.dataset.duo.split(',') as Friend[]);
    else if (b.dataset.view) {
      view = b.dataset.view as typeof view;
      if (view === 'weights' && !debug) {
        status.textContent = 'Cargando los pesos…';
        try {
          const m = await load(DEBUG_URL);
          m.findComponents('render').forEach(r => (r as pc.RenderComponent).meshInstances.forEach(mi => {
            const mat = mi.material as pc.StandardMaterial;
            mat.diffuseMap = null; mat.diffuse.set(1, 1, 1); mat.diffuseVertexColor = true; mat.diffuseVertexColorChannel = 'rgb'; mat.update();
          }));
          app.root.addChild(m); debug = { model: m, rig: bindSobremesa(m) };
          status.textContent = 'Listo';
        } catch { status.textContent = 'No hay pesos: just rig sobremesa'; view = 'texture'; }
      }
      model.enabled = view === 'texture'; if (debug) debug.model.enabled = view === 'weights';
    } else if (b.dataset.bones !== undefined) bones = !bones;
    else if (b.dataset.spin !== undefined) spin = !spin;
    else if (b.dataset.reset !== undefined) acts = {};
    render();
  });
  render();

  const a = new pc.Vec3(), c = new pc.Color();
  app.on('update', (dt: number) => {
    time += dt;
    if (spin && !drag) yaw += dt * 9;
    place();
    // An attack is over after its time: the friend goes back to swaying.
    for (const f of FRIENDS) if (acts[f]?.kind === 'attack' && time - acts[f]!.since > ATTACK_TIME) delete acts[f];
    rig.apply(time, acts); debug?.rig.apply(time, acts);
    if (bones) for (const node of (view === 'weights' && debug ? debug.rig : rig).bones) {
      a.copy(node.getPosition());
      c.fromString(colour[node.name] ?? '#ffffff');
      for (const [x, y, z] of [[.04, 0, 0], [0, .04, 0], [0, 0, .04]]) app.drawLine(new pc.Vec3(a.x - x, a.y - y, a.z - z), new pc.Vec3(a.x + x, a.y + y, a.z + z), c, false);
      if (node.parent && BONES.includes(node.parent.name as never)) app.drawLine(node.parent.getPosition(), a, c, false);
    }
  });
  app.start();
  status.textContent = 'Listo';
  (window as unknown as { modelLab: unknown }).modelLab = { attack, free, set: (v: Partial<{ yaw: number; pitch: number; distance: number; spin: boolean }>) => { ({ yaw = yaw, pitch = pitch, distance = distance, spin = spin } = v); } };
}
start().catch(error => { status.textContent = `Error: ${error?.message ?? error}`; console.error(error); });
