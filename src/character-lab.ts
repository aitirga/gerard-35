import * as pc from 'playcanvas';

/**
 * The character half of the model lab (`model-lab.html?personajes`): the Meshy characters
 * (`just character <id> --only model rig --modeler meshy`) side by side, each with the skeleton Meshy's
 * auto-rigging gave it and its walking and running clips (public/models/characters/<id>-<clip>.glb),
 * to see how they move before they go into the game.
 */
export const CHARACTERS = [
  { id: 'anna', name: 'Anna' }, { id: 'alvaro', name: 'Álvaro' }, { id: 'miquel', name: 'Miquel' }, { id: 'sarah', name: 'Sarah' },
  { id: 'soraya', name: 'Soraya' }, { id: 'nico', name: 'Nico' }, { id: 'joan', name: 'Joan' },
] as const;
const CLIPS = ['walking', 'running'] as const;
type Motion = 'still' | typeof CLIPS[number];
const MOTIONS: Record<Motion, string> = { still: 'Quieto', walking: 'Andar', running: 'Correr' };
const GAP = 1.35;
/** The whole row sits a little right of centre, clear of the panel on the left. */
const ROW_AIM = -1.2;

interface Stage { app: pc.AppBase; canvas: HTMLCanvasElement; camera: pc.Entity; floor: pc.Entity; load(url: string): Promise<pc.ContainerResource> }

export async function startCharacters({ app, canvas, camera, floor, load }: Stage, panel: HTMLElement, status: HTMLElement) {
  floor.setPosition(0, 0, 0); floor.setLocalScale(12, 1, 6);
  const people = await Promise.all(CHARACTERS.map(async ({ id, name }, i) => {
    const [body, ...clips] = await Promise.all([load(`models/characters/${id}.glb`), ...CLIPS.map(c => load(`models/characters/${id}-${c}.glb`))]);
    const entity = body.instantiateRenderEntity();
    entity.setPosition((i - (CHARACTERS.length - 1) / 2) * GAP, 0, 0);
    app.root.addChild(entity);
    entity.addComponent('anim', { activate: true });
    CLIPS.forEach((clip, k) => {
      const track = clips[k].animations[0]?.resource as pc.AnimTrack | undefined;
      if (track) entity.anim!.assignAnimation(clip, track);
    });
    const rest = body.animations[0]?.resource as pc.AnimTrack | undefined;
    if (rest) entity.anim!.assignAnimation('still', rest);
    return { id, name, entity };
  }));
  // Meshy's characters stand on their own origin: lift each one so its feet touch the floor.
  for (const { entity } of people) {
    const box = new pc.BoundingBox(); let first = true;
    entity.findComponents('render').forEach(r => (r as pc.RenderComponent).meshInstances.forEach(mi => { if (first) { box.copy(mi.aabb); first = false; } else box.add(mi.aabb); }));
    if (!first) entity.translate(0, -box.getMin().y, 0);
  }

  let motion: Motion = 'still', speed = 1, yaw = 0, pitch = 8, distance = 12.5, spin = false;
  const target = new pc.Vec3(ROW_AIM, .9, 0);
  const play = (m: Motion) => {
    motion = m;
    for (const { entity } of people) { entity.anim!.baseLayer?.transition(m, .25); entity.anim!.speed = speed; }
    render();
  };
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
  canvas.addEventListener('wheel', e => { distance = pc.math.clamp(distance * (1 + e.deltaY * .001), 1.5, 16); e.preventDefault(); }, { passive: false });

  function render() {
    panel.innerHTML = `<h1>Los amigos de la uni</h1><p>Modelos de Meshy con su auto-rig. Arrastra para girar, rueda para acercar.</p>
      <h2>MOVIMIENTO</h2><div class="wide">${(Object.keys(MOTIONS) as Motion[]).map(m => `<button data-motion="${m}" aria-pressed="${motion === m}">${MOTIONS[m]}</button>`).join('')}</div>
      <h2>VELOCIDAD</h2><div class="wide">${[.5, 1, 1.5].map(s => `<button data-speed="${s}" aria-pressed="${speed === s}">×${s}</button>`).join('')}</div>
      <h2>MIRAR A</h2><div class="wide"><button data-look="all">Todos</button>${people.map(p => `<button data-look="${p.id}">${p.name}</button>`).join('')}</div>
      <h2>VER</h2><div class="wide"><button data-spin aria-pressed="${spin}">Girar solo</button></div>`;
  }
  const look = (id: string) => {
    const who = people.find(p => p.id === id);
    // Close up: head and chest; all: the whole row.
    target.set(who ? who.entity.getPosition().x : ROW_AIM, who ? 1.3 : .9, 0);
    distance = who ? 2.2 : 12.5;
    render();
  };
  panel.addEventListener('click', event => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.motion) play(b.dataset.motion as Motion);
    else if (b.dataset.speed) { speed = Number(b.dataset.speed); play(motion); }
    else if (b.dataset.look) look(b.dataset.look);
    else if (b.dataset.spin !== undefined) spin = !spin;
    render();
  });
  render();
  play('still');
  app.on('update', (dt: number) => { if (spin && !drag) yaw += dt * 12; place(); });
  status.textContent = 'Listo';
  (window as unknown as { modelLab: unknown }).modelLab = {
    app, play, look,
    set: (v: Partial<{ yaw: number; pitch: number; distance: number; spin: boolean }>) => { ({ yaw = yaw, pitch = pitch, distance = distance, spin = spin } = v); },
  };
}
