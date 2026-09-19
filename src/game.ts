import * as pc from 'playcanvas';
import { GridMovement, VECTORS, isOccupied, stickDirection, type Cell, type Direction } from './movement';
import { ENVIRONMENTS, nearbyInteraction, type EnvironmentId, type Interaction } from './environments';
import { buildScenery } from './scenery';
import { type Dialogue } from './dialogue';
import { createBattleScene } from './battle-scene';
import { type BattleEffect, type BattleState } from './battle';
import { STREET_ENCOUNTER, WanderingPack } from './encounters';
import { WalkAnimation } from './walk-animation';
import { createGroundContact } from './ground-contact';

export interface GameCallbacks {
  onEncounter: (allies: 1 | 2, foes: number) => void;
  onDog: (x: number, y: number, visible: boolean, count: number, ready: boolean) => void;
  onBattleTargets: (targets: { id: string; x: number; y: number; visible: boolean }[]) => void;
  onStep: (steps: number, cell: Cell) => void;
  onLocation: (id: EnvironmentId, cell: Cell) => void;
  onInteraction: (interaction: Interaction | undefined) => void;
  onDialogue: (dialogue: Dialogue) => void;
  onQuest: () => void;
  onLabels: (labels: { id: string; x: number; y: number; visible: boolean }[]) => void;
}

export function createGame(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false } });
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  let environment = ENVIRONMENTS.maresme;
  const movement = new GridMovement(environment.grid, environment.spawn);
  let scenery = buildScenery(app, environment);
  const playerMaterials: pc.StandardMaterial[] = [];
  function material(name: string, hex: string, gloss = 20, glow = 0) {
    const mat = new pc.StandardMaterial(); mat.name = name; mat.diffuse.fromString(hex); mat.gloss = gloss / 100;
    if (glow) { mat.emissive.fromString(hex); mat.emissiveIntensity = glow; }
    mat.update(); playerMaterials.push(mat); return mat;
  }
  function mesh(name: string, type: string, mat: pc.StandardMaterial, pos: number[], scale: number[], parent = app.root) {
    const entity = new pc.Entity(name);
    entity.addComponent('render', { type, material: mat, castShadows: true, receiveShadows: true });
    entity.setLocalPosition(pos[0], pos[1], pos[2]); entity.setLocalScale(scale[0], scale[1], scale[2]); parent.addChild(entity); return entity;
  }
  const camera = new pc.Entity('Cámara isométrica');
  camera.addComponent('camera', {
    projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 11,
    clearColor: new pc.Color(0.2, 0.26, 0.24), nearClip: 0.1, farClip: 180, toneMapping: pc.TONEMAP_ACES,
  });
  app.root.addChild(camera);
  const player = new pc.Entity('Jugador');
  app.root.addChild(player);
  const body = new pc.Entity('Cuerpo');
  player.addChild(body);
  const jacket = material('Camiseta mostaza', '#e9ad48');
  const navy = material('Rayas azul marino', '#304369');
  const cream = material('Mangas interiores crema', '#eee4cb');
  const skin = material('Piel', '#e6b58b');
  const hair = material('Pelo', '#342a28');
  const trousers = material('Pantalones', '#293b4c');
  const shoes = material('Zapatillas', '#dfd9bd');
  mesh('Torso', 'box', jacket, [0, 0.68, 0], [0.42, 0.45, 0.3], body);
  for (const y of [0.51, 0.66, 0.81]) {
    mesh('Raya de camiseta', 'box', navy, [0, y, 0], [0.424, 0.072, 0.304], body);
  }
  mesh('Cuello de camiseta', 'box', navy, [0, 0.902, 0], [0.22, 0.028, 0.21], body);
  mesh('Cuello', 'box', skin, [0, 0.93, 0], [0.13, 0.09, 0.13], body);
  // Keep facial details together so the child proportions preserve their alignment.
  const headStart = body.children.length;
  const frames = material('Gafas carey', '#302520', 40);
  const smile = material('Sonrisa', '#fff2da');
  const mouth = material('Boca', '#8b5140');
  mesh('Cabeza', 'sphere', skin, [0, 1.13, 0], [0.34, 0.43, 0.32], body);
  mesh('Pelo detrás', 'sphere', hair, [0, 1.23, -0.07], [0.36, 0.32, 0.26], body);
  mesh('Pelo superior', 'sphere', hair, [0, 1.335, -0.01], [0.37, 0.18, 0.31], body);
  const fringe = mesh('Flequillo ladeado', 'sphere', hair, [-0.045, 1.315, 0.105], [0.3, 0.115, 0.13], body);
  fringe.setLocalEulerAngles(0, 0, 18);
  mesh('Nariz', 'sphere', skin, [0, 1.115, 0.16], [0.06, 0.075, 0.07], body);
  mesh('Boca', 'sphere', mouth, [0, 1.035, 0.13], [0.12, 0.044, 0.025], body);
  mesh('Sonrisa', 'sphere', smile, [0, 1.045, 0.143], [0.095, 0.02, 0.012], body);
  mesh('Puente de gafas', 'box', frames, [0, 1.177, 0.182], [0.043, 0.012, 0.016], body);
  for (const side of [-1, 1]) {
    mesh('Oreja', 'sphere', skin, [side * 0.169, 1.13, 0], [0.055, 0.105, 0.065], body);
    mesh('Ojo', 'sphere', hair, [side * 0.078, 1.18, 0.148], [0.025, 0.027, 0.014], body);
    mesh('Patilla de gafas', 'box', frames, [side * 0.153, 1.183, 0.075], [0.012, 0.014, 0.21], body);
    // Segment the oval rims; open centers leave the face visible without lens glare.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      const b = (i + 1) * Math.PI / 8;
      const x1 = side * 0.079 + Math.cos(a) * 0.067;
      const y1 = 1.18 + Math.sin(a) * 0.057;
      const x2 = side * 0.079 + Math.cos(b) * 0.067;
      const y2 = 1.18 + Math.sin(b) * 0.057;
      const rim = mesh('Montura redonda', 'box', frames,
        [(x1 + x2) / 2, (y1 + y2) / 2, 0.18],
        [Math.hypot(x2 - x1, y2 - y1) + 0.003, 0.012, 0.015], body);
      rim.setLocalEulerAngles(0, 0, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
    }
  }
  const headParts = body.children.slice(headStart);
  const head = new pc.Entity('Cabeza infantil');
  body.addChild(head);
  head.setLocalPosition(0, 0.94, 0);
  for (const part of headParts) {
    const position = part.getLocalPosition().clone();
    part.reparent(head);
    part.setLocalPosition(position.x, position.y - 0.94, position.z);
  }
  head.setLocalScale(1.08, 0.92, 1.06);
  const limbs: pc.Entity[] = [];
  const feet: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const leg = new pc.Entity('Pierna');
    leg.setLocalPosition(side * 0.115, 0.48, 0);
    body.addChild(leg);
    mesh('Pantalón', 'box', trousers, [0, -0.18, 0], [0.16, 0.37, 0.19], leg);
    feet.push(mesh('Zapatilla', 'box', shoes, [0, -0.4, 0.035], [0.19, 0.12, 0.28], leg));
    limbs.push(leg);
    const arm = new pc.Entity('Brazo');
    arm.setLocalPosition(side * 0.275, 0.86, 0);
    body.addChild(arm);
    mesh('Manga interior', 'box', cream, [0, -0.2, 0], [0.125, 0.21, 0.17], arm);
    mesh('Manga corta', 'box', jacket, [0, -0.07, 0], [0.15, 0.17, 0.2], arm);
    mesh('Raya de manga', 'box', navy, [0, -0.045, 0], [0.154, 0.065, 0.204], arm);
    mesh('Mano', 'box', skin, [0, -0.33, 0], [0.12, 0.12, 0.14], arm);
    limbs.push(arm);
  }
  const bag = material('Mochila verde', '#527e6e');
  const straps = material('Correas verde oscuro', '#355b50');
  mesh('Mochila', 'box', bag, [0, 0.7, -0.22], [0.3, 0.33, 0.16], body);
  mesh('Bolsillo de mochila', 'box', straps, [0, 0.64, -0.315], [0.23, 0.14, 0.055], body);
  for (const side of [-1, 1]) {
    mesh('Correa frontal', 'box', straps, [side * 0.145, 0.72, 0.164], [0.052, 0.35, 0.029], body);
    mesh('Correa de hombro', 'box', bag, [side * 0.145, 0.9, -0.012], [0.06, 0.035, 0.36], body);
    mesh('Hebilla de mochila', 'box', cream, [side * 0.145, 0.62, 0.184], [0.064, 0.045, 0.018], body);
  }
  player.setPosition(0, 0.06, 0);


  const plantFeet = createGroundContact(player, feet);
  const battleScene = createBattleScene(app, player, (x, z) => scenery.groundHeight(x, z));
  const pack = new WanderingPack(ENVIRONMENTS.maresme.grid);
  let battle: BattleState | undefined;
  let paused = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function occupiedCells(): readonly Cell[] { return environment.id === 'maresme' ? pack.occupied : []; }
  function encounter() {
    if (paused || battle || !pack.ready || environment.id !== 'maresme' || document.querySelector('#hud[data-dialogue]')) return;
    clearInput();
    movement.teleport(environment.grid, movement.cell);
    pack.armed = false;
    callbacks.onEncounter(bernatCalled ? 2 : 1, pack.dogs.length);
  }
  function setBattle(next: BattleState | undefined, effect?: BattleEffect, onImpact?: () => void) {
    if (!next && battle) pack.finish(battle.phase === 'won');
    const settled = battleScene.set(next, scenery.toWorld(STREET_ENCOUNTER.stage.x, STREET_ENCOUNTER.stage.z), effect, onImpact); battle = next; clearInput();
    if (!next) {
      movement.resolveOverlap(occupiedCells(), !reducedMotion.matches);
      lastPrompt = ''; positionPlayer(); updatePrompt();
    }
    else callbacks.onInteraction(undefined);
    return settled;
  }
  function touchDog(event: PointerEvent) {
    if (paused || battle || environment.id !== 'maresme') return;
    const rect = canvas.getBoundingClientRect();
    for (const dog of pack.dogs) {
      const position = pack.position(dog);
      const point = scenery.toWorld(position.x, position.z); point.y = .6;
      camera.camera!.worldToScreen(point, screen);
      if (Math.hypot(event.clientX - rect.left - screen.x, event.clientY - rect.top - screen.y) < 30) { encounter(); break; }
    }
  }
  canvas.addEventListener('pointerup', touchDog);

  const keyMap: Record<string, Direction> = { KeyW: 'up', KeyD: 'right', KeyS: 'down', KeyA: 'left' };
  const held = new Map<string, Direction>();
  let queued: Direction | null = null;
  let padPrevious: Direction | null = null;
  let padActionHeld = false;
  let facing = 0;
  let visualFacing = 0;
  const walk = new WalkAnimation();
  let overview = false;
  let bernatCalled = false;
  let lastPrompt = '';
  const cameraTarget = scenery.toWorld(movement.cell.x, movement.cell.z);
  const screen = new pc.Vec3();
  function clearInput() { held.clear(); queued = null; padPrevious = null; }
  function updatePrompt() {
    if (battle) return;
    const interaction = movement.moving ? undefined : nearbyInteraction(environment, movement.cell);
    const id = interaction?.id ?? '';
    if (id !== lastPrompt) { lastPrompt = id; callbacks.onInteraction(interaction); }
  }
  function positionPlayer() {
    const p = scenery.toWorld(movement.position.x, movement.position.z);
    const hop = movement.bouncing && !reducedMotion.matches ? Math.sin(movement.progress * Math.PI) * .18 : 0;
    player.setPosition(p.x, 0.09 + hop, p.z);
  }
  function setEnvironment(id: EnvironmentId, destination?: Cell) {
    if (battle) return;
    clearInput();
    scenery.destroy();
    environment = ENVIRONMENTS[id];
    scenery = buildScenery(app, environment);
    movement.teleport(environment.grid, destination ?? environment.spawn);
    movement.resolveOverlap(occupiedCells(), !reducedMotion.matches);
    overview = false;
    lastPrompt = '';
    callbacks.onInteraction(undefined);
    callbacks.onLocation(id, movement.cell);
    cameraTarget.copy(scenery.toWorld(movement.cell.x, movement.cell.z));
    positionPlayer(); updatePrompt();
  }
  function interact() {
    if (paused || battle || movement.moving) return;
    if (environment.id === 'maresme' && pack.near(movement.cell)) { encounter(); return; }
    const target = nearbyInteraction(environment, movement.cell);
    if (!target) return;
    if (target.id === 'enter-home') {
      setEnvironment('home');
      callbacks.onDialogue({ left: 'gerard', lines: [{ speaker: 'gerard', text: 'Mi casa. Todavía por amueblar, pero ya se siente como hogar.' }] });
    } else if (target.id === 'leave-home') {
      setEnvironment('maresme', { x: 28, z: 24 });
    } else {
      clearInput();
      callbacks.onDialogue({ left: 'gerard', right: 'bernat', lines: bernatCalled
        ? [{ speaker: 'gerard', text: '¿Bernat? Soy yo otra vez.' }, { speaker: 'bernat', text: '¡Un segundo, que ya salgo!' }]
        : [{ speaker: 'gerard', text: 'Ding-dong… ¡Bernat! ¿Bajas un momento?' }, { speaker: 'bernat', text: '¡Gerard! Dame un minuto, ¡ya bajo!' }] });
      bernatCalled = true; callbacks.onQuest();
    }
  }
  function keydown(event: KeyboardEvent) {
    if (paused || battle || document.querySelector('#hud[data-dialogue]')) return;
    if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button')) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyE' || event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault(); if (!event.repeat) interact(); return;
    }
    if (event.code === 'KeyR') { if (!event.repeat) overview = !overview; return; }
    const direction = keyMap[event.code];
    if (!direction) return;
    event.preventDefault();
    if (!held.has(event.code)) { held.set(event.code, direction); queued = direction; }
  }
  function keyup(event: KeyboardEvent) { held.delete(event.code); }
  function resize() { app.resizeCanvas(); }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  window.addEventListener('resize', resize);
  resize(); positionPlayer();
  camera.setPosition(cameraTarget.x + 40, cameraTarget.y + 52, cameraTarget.z + 40);
  callbacks.onLocation(environment.id, movement.cell);
  app.on('update', (dt: number) => {
    const delta = Math.min(dt, 0.05);
    if (!paused && !battle && !document.querySelector('#hud[data-dialogue]')) {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((p): p is Gamepad => p !== null && p.connected) : [];
      let padDirection: Direction | null = null;
      let action = false;
      if (document.hasFocus() && !document.hidden) for (const pad of pads) {
        action ||= pad.buttons[0]?.pressed ?? false;
        padDirection ??= pad.buttons[12]?.pressed ? 'up' : pad.buttons[13]?.pressed ? 'down'
          : pad.buttons[14]?.pressed ? 'left' : pad.buttons[15]?.pressed ? 'right'
          : stickDirection(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      }
      if (action && !padActionHeld) interact();
      padActionHeld = action;
      if (padDirection && padDirection !== padPrevious) queued = padDirection;
      padPrevious = padDirection;
      if (movement.update(dt)) callbacks.onStep(movement.steps, { ...movement.cell });
      if (!movement.moving) {
        const direction = queued ?? [...held.values()].at(-1) ?? padDirection;
        queued = null;
        if (direction) {
          facing = { up: 180, right: 90, down: 0, left: -90 }[direction];
          const vector = VECTORS[direction];
          const next = { x: movement.cell.x + vector.x, z: movement.cell.z + vector.z };
          if (movement.tryStep(direction, occupiedCells())) overview = false;
          else if (pack.armed && isOccupied(next, occupiedCells())) encounter();
        }
      }
      positionPlayer(); updatePrompt();
      if (environment.id === 'maresme' && !battle) {
        pack.update(delta, movement.moving ? [movement.cell, movement.from] : [movement.cell]);
        if (!movement.moving && pack.armed && pack.near(movement.cell)) encounter();
      }
    } else clearInput();
    const walking = movement.moving && !movement.bouncing && !paused && !battle && !document.querySelector('#hud[data-dialogue]');
    const pose = walk.update(delta, !!walking, !reducedMotion.matches);
    const turn = ((facing - visualFacing + 540) % 360) - 180;
    visualFacing += turn * (reducedMotion.matches ? 1 : 1 - Math.exp(-delta / .065));
    visualFacing = ((visualFacing + 180) % 360 + 360) % 360 - 180;
    body.setLocalEulerAngles(0, visualFacing, pose.sway);
    limbs.forEach((limb, i) => limb.setLocalEulerAngles(pose.stride * (i === 0 || i === 3 ? 1 : -1) * (i % 2 ? .8 : 1), 0, 0));
    body.setLocalPosition(0, 0, 0);
    const separationHop = movement.bouncing && !reducedMotion.matches ? Math.sin(movement.progress * Math.PI) * .18 : 0;
    plantFeet(scenery.groundHeight, separationHop);
    battleScene.dogs.forEach((model, i) => {
      const dog = pack.dogs[i];
      model.enabled = environment.id === 'maresme' && !battle && !!dog;
      if (!dog) return;
      const p = pack.position(dog);
      model.setPosition(scenery.toWorld(p.x, p.z));
      model.setEulerAngles(0, dog.yaw, 0);
      battleScene.wander(i, delta, dog.progress < 1 && !paused && !battle && !document.querySelector('#hud[data-dialogue]'), !reducedMotion.matches);
    });
    battleScene.update(delta, !reducedMotion.matches);
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const isNeighborhood = environment.id === 'maresme';
    const target = battle ? battleScene.anchor.clone().add(new pc.Vec3(0, 1, 0)).add(battleScene.focus) : isNeighborhood && !overview ? player.getPosition().clone() : new pc.Vec3();
    cameraTarget.lerp(cameraTarget, target, reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 7));
    const cameraOffset = battle ? new pc.Vec3(5, 9, 15) : new pc.Vec3(40, 52, 40);
    if (battleScene.entering && !reducedMotion.matches) {
      const arc = Math.sin(battleScene.entryProgress * Math.PI);
      cameraOffset.add(new pc.Vec3(arc * 3, arc * 1.5, -arc * 2));
    }
    const desiredCamera = cameraTarget.clone().add(cameraOffset);
    camera.setPosition(reducedMotion.matches ? desiredCamera : camera.getPosition().clone().lerp(camera.getPosition(), desiredCamera, 1 - Math.exp(-delta * 6)));
    if (battle) camera.setPosition(camera.getPosition().clone().add(battleScene.cameraKick));
    camera.lookAt(cameraTarget);
    const halfWidth = (environment.grid[0].length + environment.grid.length) * Math.SQRT1_2 / 2 + 2;
    const fullHeight = (environment.grid[0].length + environment.grid.length) / Math.sqrt(6) / 2 + 4;
    const height = battle ? Math.max(5.7, 4.8 / aspect, battle.foes.length * 1.1 + 2) : isNeighborhood && !overview ? Math.max(10.5, 9 / aspect) : Math.max(fullHeight, halfWidth / aspect);
    camera.camera!.orthoHeight = pc.math.lerp(camera.camera!.orthoHeight, height, reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 6));
    const dogLabel = battleScene.dogs[0].getPosition().clone(); dogLabel.y = 1.55;
    camera.camera!.worldToScreen(dogLabel, screen);
    callbacks.onDog(screen.x, screen.y, isNeighborhood && !battle && pack.dogs.length > 0 && screen.x > 40 && screen.x < canvas.clientWidth - 40 && screen.y > 100 && screen.y < canvas.clientHeight - 150, pack.dogs.length, pack.ready);
    callbacks.onBattleTargets(battleScene.targets().map(({ id, position, visible }) => {
      camera.camera!.worldToScreen(position, screen);
      return { id, x: screen.x, y: screen.y, visible };
    }));
    const labels = isNeighborhood && !battle ? [
      { id: 'gerard', point: scenery.toWorld(28, 24) },
      { id: 'bernat', point: scenery.toWorld(8, 24) },
    ].map(({ id, point }) => {
      point.y = 2.2; camera.camera!.worldToScreen(point, screen);
      return { id, x: screen.x, y: screen.y, visible: screen.x > 30 && screen.x < canvas.clientWidth - 30 && screen.y > 65 && screen.y < canvas.clientHeight - 100 };
    }) : [];
    callbacks.onLabels(labels);
  });
  app.on('destroy', () => {
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', clearInput); document.removeEventListener('visibilitychange', clearInput);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerup', touchDog);
    battleScene.destroy();
    scenery.destroy(); playerMaterials.forEach(m => m.destroy());
  });
  app.start();
  return {
    app, setEnvironment, interact, encounter, setBattle,
    selectTarget: battleScene.selectTarget,
    setPaused(value: boolean) { paused = value; clearInput(); padActionHeld = true; },
    toggleOverview() { if (paused || battle) return; overview = !overview; canvas.focus({ preventScroll: true }); },
    press(direction: Direction) { if (paused || battle) return; held.set('touch', direction); queued = direction; },
    release() { held.delete('touch'); },
  };
}
