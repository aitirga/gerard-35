import * as pc from 'playcanvas';

export interface GameCallbacks {
  onScore: (score: number) => void;
}

/**
 * Minimal PlayCanvas scene: a lit, spinning cube that jumps and changes
 * colour when clicked or tapped. Enough to prove rendering, input, the
 * update loop and the HTML HUD are all wired together.
 */
export function createGame(canvas: HTMLCanvasElement, callbacks: GameCallbacks): pc.Application {
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  window.addEventListener('resize', () => app.resizeCanvas());

  // --- Camera ---------------------------------------------------------------
  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(0.07, 0.08, 0.12),
  });
  camera.setPosition(0, 1.5, 6);
  camera.lookAt(0, 0.5, 0);
  app.root.addChild(camera);

  // --- Light ----------------------------------------------------------------
  const light = new pc.Entity('light');
  light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    intensity: 1.2,
  });
  light.setEulerAngles(45, 30, 0);
  app.root.addChild(light);

  // --- Ground ---------------------------------------------------------------
  const groundMat = new pc.StandardMaterial();
  groundMat.diffuse.set(0.15, 0.17, 0.24);
  groundMat.update();

  const ground = new pc.Entity('ground');
  ground.addComponent('render', { type: 'plane', material: groundMat });
  ground.setLocalScale(12, 1, 12);
  ground.setPosition(0, -0.5, 0);
  app.root.addChild(ground);

  // --- Cube (the "player") --------------------------------------------------
  const cubeMat = new pc.StandardMaterial();
  cubeMat.diffuse.set(0.95, 0.45, 0.2);
  cubeMat.update();

  const cube = new pc.Entity('cube');
  cube.addComponent('render', { type: 'box', material: cubeMat });
  cube.setPosition(0, 0, 0);
  app.root.addChild(cube);

  // --- Game state -----------------------------------------------------------
  let score = 0;
  let velocityY = 0;
  const gravity = -18;
  const jumpSpeed = 7;
  const restY = 0;

  const bump = () => {
    score += 1;
    callbacks.onScore(score);
    velocityY = jumpSpeed;
    cubeMat.diffuse.set(Math.random(), Math.random(), Math.random());
    cubeMat.update();
  };

  // --- Input ----------------------------------------------------------------
  const ray = new pc.Ray();
  const hitPoint = new pc.Vec3();

  const tryHit = (screenX: number, screenY: number) => {
    const cam = camera.camera;
    const render = cube.render;
    if (!cam || !render) return;

    // Build a ray from the camera through the pointer position.
    cam.screenToWorld(screenX, screenY, cam.nearClip, ray.origin);
    cam.screenToWorld(screenX, screenY, cam.farClip, ray.direction);
    ray.direction.sub(ray.origin).normalize();

    const aabb = render.meshInstances[0]?.aabb;
    if (aabb && aabb.intersectsRay(ray, hitPoint)) {
      bump();
    }
  };

  app.mouse?.on(pc.EVENT_MOUSEDOWN, (e: pc.MouseEvent) => tryHit(e.x, e.y));
  app.touch?.on(pc.EVENT_TOUCHSTART, (e: pc.TouchEvent) => {
    const t = e.touches[0];
    if (t) tryHit(t.x, t.y);
    e.event.preventDefault();
  });
  app.keyboard?.on(pc.EVENT_KEYDOWN, (e: pc.KeyboardEvent) => {
    if (e.key === pc.KEY_SPACE) bump();
  });

  // --- Update loop ----------------------------------------------------------
  app.on('update', (dt: number) => {
    cube.rotate(0, 60 * dt, 0);

    velocityY += gravity * dt;
    const pos = cube.getPosition();
    let y = pos.y + velocityY * dt;
    if (y <= restY) {
      y = restY;
      velocityY = 0;
    }
    cube.setPosition(pos.x, y, pos.z);
  });

  app.start();
  return app;
}
