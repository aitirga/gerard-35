import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { BACKDROP, createParticles } from '../src/particles.ts';
import { planPocket, pocketWorld } from '../src/arena.ts';
import { clawLines, createEffects, sceneWorld } from '../src/effects.ts';
import { ENVIRONMENTS } from '../src/environments.ts';

// The engine runs headless: a null graphics device on a stand-in canvas.
function headlessApp() {
  const canvas = { width: 320, height: 180, style: {}, addEventListener() {}, removeEventListener() {} };
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.LightComponentSystem];
  options.resourceHandlers = [];
  app.init(options);
  return app;
}
const run = (particles, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) particles.update(1 / 60); };
const flat = (extra = {}) => ({ x0: -10, z0: -10, x1: 10, z1: 10, outside: -1, ground: () => 0, ...extra });

test('falling particles come to rest on the floor, never under it', () => {
  const particles = createParticles(headlessApp(), 200);
  particles.define('pebble', { shape: 'puff', colour: '#ffffff', life: 10, size: .05, speed: [1, 2], rise: 2, gravity: 9, collide: true, bounce: .4, friction: .3 });
  // A step: the right half of the floor is half a metre up.
  particles.setWorld(flat({ ground: x => x > 0 ? .5 : 0 }));
  particles.burst('pebble', { x: -3, y: 2, z: 0 }, 40, { spread: .5 });
  run(particles, 4);
  // The floor is baked four samples a metre, so right at the step's edge it may round either way.
  assert.equal(particles.groundAt(1, 0), .5); assert.equal(particles.groundAt(-1, 0), 0);
  for (const p of particles.snapshot()) {
    const floor = particles.groundAt(p.x, p.z);
    assert.ok(p.y >= floor - 1e-3 && p.y < floor + .05, `resting at ${p.y} over a floor at ${floor}`);
  }
});

test('walls turn particles back instead of letting them through', () => {
  const particles = createParticles(headlessApp(), 200);
  particles.define('ball', { shape: 'glow', colour: '#ffffff', life: 10, size: .05, speed: 4, collide: true, bounce: .6 });
  // A 3 × 3 grid of 1 m cells centred on 0 whose east column is a 2 m wall.
  const top = new Float32Array(9).fill(-Infinity);
  for (const row of [0, 1, 2]) top[row * 3 + 2] = 2;
  particles.setWorld(flat({ x0: -1.5, z0: -1.5, x1: 1.5, z1: 1.5, cells: { x: -1, z: -1, cols: 3, rows: 3, top } }));
  particles.burst('ball', { x: -.5, y: 1, z: 0 }, 30, { direction: { x: 1, y: 0, z: 0 }, cone: .2 });
  for (let i = 0; i < 120; i++) {
    particles.update(1 / 60);
    for (const p of particles.snapshot()) assert.ok(p.x < .5, `inside the wall at x ${p.x}`);
  }
});

test('people standing in the way push particles out of their body', () => {
  const particles = createParticles(headlessApp(), 200);
  particles.define('mote', { shape: 'glow', colour: '#ffffff', life: 10, size: .05, bodies: 1 });
  particles.setWorld(flat());
  particles.burst('mote', { x: 0, y: 1, z: 0 }, 40, { spread: .25, flat: true });
  particles.setBodies([{ x: 0, y: 0, z: 0, radius: .4, height: 1.6 }]);
  run(particles, .5);
  for (const p of particles.snapshot()) assert.ok(Math.hypot(p.x, p.z) >= .4 - 1e-3, `still inside at ${Math.hypot(p.x, p.z)}`);
});

test('drops that pop on landing leave a splat that stays stuck flat', () => {
  const particles = createParticles(headlessApp(), 200);
  particles.define('splat', { shape: 'splat', orient: 'ground', colour: '#ff5fa2', life: 10, size: .1, gravity: 30, collide: true, stick: true });
  particles.define('drop', { shape: 'puff', colour: '#ff5fa2', life: 10, size: .05, speed: 1, rise: 2, gravity: 9, collide: true, pop: true, onLand: { kind: 'splat', count: 1, inherit: true } });
  particles.setWorld(flat());
  particles.burst('drop', { x: 0, y: 1, z: 0 }, 12);
  run(particles, 2);
  const left = particles.snapshot();
  assert.equal(left.length, 12);
  assert.ok(left.every(p => p.kind === 'splat' && p.stuck && p.y < .05));
});

test('a full pool recycles instead of growing, and clearing keeps the ambient air', () => {
  const particles = createParticles(headlessApp(), 64);
  particles.define('dot', { shape: 'glow', colour: '#ffffff', life: 10, size: .05 });
  particles.burst('dot', { x: 0, y: 1, z: 0 }, 500);
  assert.equal(particles.count, 64);
  particles.clear(true);
  const air = particles.emitter('dot', { x: 0, y: 0, z: 0 }, { rate: 20, ambient: true, area: { x: 2, z: 2, low: .5, high: 1 } });
  air.warm();
  particles.burst('dot', { x: 0, y: 1, z: 0 }, 10);
  const before = particles.count;
  particles.clear();
  assert.equal(particles.count, before - 10);
});

test('every effect, element and aura plays in every scene without throwing', () => {
  const app = headlessApp();
  const effects = createEffects(app);
  const target = new pc.Vec3(0, 1, 0), from = new pc.Vec3(-2, 1, 0), view = { focus: target, reach: 8, animate: true, paused: false };
  for (const environment of Object.values(ENVIRONMENTS)) {
    const cx = (environment.grid[0].length - 1) / 2, cz = (environment.grid.length - 1) / 2;
    effects.setScene(environment, { root: new pc.Entity(), groundHeight: () => 0, toWorld: (x, z) => new pc.Vec3(x - cx, 0, z - cz), houses: [] });
    effects.setTone(1);
    effects.impact(target, from, 1.4, { gum: true });
    effects.impact(target, from, 1, { guarded: true });
    effects.heal(target); effects.insight(target); effects.binaryFire(target, from, { burn: true }); effects.binaryFire(target, from); effects.anima(target, '#f3cf78', true); effects.poof(target);
    effects.confetti(target, ['#f3cf78', '#e2483d']);
    for (const level of ['light', 'medium', 'high']) effects.fire(new pc.Vec3(0, 0, 0), level, { seconds: .5 });
    for (const element of ['fire', 'ice', 'air', 'energy', 'water', 'earth', 'light', 'shadow', 'gum']) {
      effects.element(element, target, { from });
      effects.aura(element, new pc.Vec3(1, 0, 1), .5);
    }
    for (let i = 0; i < 90; i++) effects.update(1 / 60, view);
    assert.ok(effects.particles.count > 0 && effects.particles.count <= effects.particles.capacity, environment.id);
    effects.clear();
  }
});

test('the scene world stands walls where the plan draws them and leaves floors open', () => {
  const home = ENVIRONMENTS['home-entrance'];
  const cx = (home.grid[0].length - 1) / 2, cz = (home.grid.length - 1) / 2;
  const world = sceneWorld(home, { groundHeight: () => 0, toWorld: (x, z) => new pc.Vec3(x - cx, 0, z - cz), houses: [] });
  const top = (x, z) => world.cells.top[z * world.cells.cols + x];
  assert.ok(Math.abs(top(0, 0) - 2.6) < 1e-5, 'the corner wall stands full height');
  assert.equal(top(1, 1), -Infinity, 'the floor is open');
  const furniture = home.plan.flatMap((row, z) => [...row].map((glyph, x) => ({ glyph, x, z }))).find(c => c.glyph === 'o');
  assert.ok(top(furniture.x, furniture.z) < 1.5, 'furniture is low enough to settle on');
});

/** Effects over one scene, as the game builds it but with flat floors. */
function effectsIn(id) {
  const effects = createEffects(headlessApp()), environment = ENVIRONMENTS[id];
  const cx = (environment.grid[0].length - 1) / 2, cz = (environment.grid.length - 1) / 2;
  effects.setScene(environment, { root: new pc.Entity(), groundHeight: () => 0, toWorld: (x, z) => new pc.Vec3(x - cx, 0, z - cz), houses: [] });
  return effects;
}
const play = (effects, seconds, fight = false) => { for (let t = 0; t < seconds; t += 1 / 60) effects.update(1 / 60, { focus: { x: 0, y: 0, z: 0 }, reach: 30, animate: true, paused: false, fight }); };
const lasting = effects => effects.marks.snapshot().filter(p => !['glowing'].includes(p.kind));

test('a fight in a pocket lands its particles and marks on the pocket\'s floor, and the place\'s comes back when it ends', () => {
  const effects = effectsIn('cardedeu-laberinto'), { grid } = ENVIRONMENTS['cardedeu-laberinto'];
  const plan = planPocket(grid, { x: 30, z: 4 }, { allies: 2, foes: ['cebollita', 'platito'] });
  // Far from the place (src/pocket.ts POCKET_AT), where its floor is only the backdrop far below.
  const at = { x: 0, y: 0, z: -4000 };
  assert.equal(effects.particles.groundAt(at.x, at.z), BACKDROP);
  effects.setFightStage({ centre: at, world: pocketWorld(plan, at, () => 2.6, BACKDROP) });
  assert.equal(effects.particles.groundAt(at.x, at.z), at.y);
  effects.particles.define('pebble', { shape: 'puff', colour: '#ffffff', life: 10, size: .05, speed: [1, 2], rise: 2, gravity: 9, collide: true, bounce: .4, friction: .3 });
  effects.particles.burst('pebble', { x: at.x + 1, y: 1.2, z: at.z }, 30, { spread: .3 });
  effects.mark('scorch', { x: at.x - 1, y: at.y, z: at.z }, .6);
  play(effects, 3, true);
  const pebbles = effects.particles.snapshot().filter(p => p.kind === 'pebble');
  assert.ok(pebbles.length && pebbles.every(p => p.y >= at.y - 1e-3 && p.y < at.y + .05), `pebbles rest at ${pebbles.map(p => p.y.toFixed(2))}`);
  const scorch = effects.marks.snapshot().filter(p => Math.abs(p.z - at.z) < 2);
  assert.ok(scorch.length && scorch.every(p => Math.abs(p.y - (at.y + .03)) < .02), `the scorch lies at ${scorch.map(p => p.y.toFixed(2))}`);
  effects.setFightStage();
  assert.equal(effects.particles.groundAt(at.x, at.z), BACKDROP);
});

test('marks keep to their budget, the oldest fading first', () => {
  const effects = effectsIn('patio');
  for (let i = 0; i < 80; i++) { effects.element(['fire', 'ice', 'water', 'earth', 'gum'][i % 5], { x: -4 + i % 9, y: 1, z: -4 + Math.floor(i / 9) }); play(effects, .05, true); }
  effects.mark('scorch', { x: 5.5, y: 0, z: 5.5 }, .6);
  play(effects, 4, true);
  const left = lasting(effects);
  assert.ok(left.length <= 320, `${left.length} mark layers over the budget`);
  assert.ok(left.length > 200, 'the budget is used, not emptied');
  assert.ok(left.some(p => p.kind === 'scorch' && Math.hypot(p.x - 5.5, p.z - 5.5) < .1), 'the newest mark is still there');
  assert.ok(left.every(p => p.y > -.001 && p.y < .05), 'marks lie just above the floor');
});

test('marks stay through a fight and fade out after it instead of vanishing', () => {
  const effects = effectsIn('patio');
  effects.element('fire', { x: 0, y: 1, z: 0 });
  play(effects, 60, true);
  const fought = lasting(effects).length;
  assert.ok(fought > 0, 'a fight minute later the scorch is still there');
  effects.clear();
  assert.equal(lasting(effects).length, fought, 'clearing starts a fade, not a cut');
  assert.ok(lasting(effects).every(p => p.fading));
  play(effects, 3);
  assert.equal(lasting(effects).length, 0, 'faded out a few seconds later');
  effects.mark('gum', { x: 0, y: 0, z: 0 });
  play(effects, 30);
  assert.ok(lasting(effects).length > 0, 'outside a fight a mark stays a while…');
  play(effects, 15);
  assert.equal(lasting(effects).length, 0, '…then fades');
});

test('snow settles on the floor and its settled patches keep to a cap', () => {
  const effects = effectsIn('maresme');
  effects.setWeather('snow', 1, true);
  play(effects, 2);
  const falling = effects.particles.snapshot().filter(p => p.kind === 'snow').length;
  assert.ok(falling > 200, `${falling} flakes falling`);
  play(effects, 40);
  const settled = effects.particles.snapshot().filter(p => p.kind === 'drift');
  // The cap is checked four times a second, so a quarter second's landings may wait their turn.
  assert.ok(settled.filter(p => !p.fading).length <= 2000 + 60, `${settled.length} settled patches`);
  assert.ok(settled.filter(p => p.stuck).length > 1000, 'the ground is dusted');
  assert.ok(effects.particles.count < 3300, `${effects.particles.count} particles alive in heavy snow`);
});

test('rain falls outdoors and lands in ripples, but never indoors', () => {
  const street = effectsIn('maresme');
  street.setWeather('rain', 1, true);
  play(street, 3);
  const kinds = street.particles.snapshot().map(p => p.kind);
  assert.ok(kinds.filter(k => k === 'rain').length > 300 && kinds.includes('ripplet') && kinds.includes('spray'));
  assert.ok(street.particles.count < 2600, `${street.particles.count} particles alive in heavy rain`);
  // Clearing up ramps it out over a few seconds.
  street.setWeather('clear');
  play(street, 1);
  assert.ok(street.weather.rain > .5 && street.weather.rain < 1);
  play(street, 6);
  assert.equal(street.particles.snapshot().filter(p => p.kind === 'rain').length, 0);
  const flat = effectsIn('meridiana');
  flat.setWeather('rain', 1, true);
  play(flat, 2);
  assert.equal(flat.particles.snapshot().filter(p => p.kind === 'rain').length, 0);
});

test('with reduced motion nothing falls: snow is only a still dusting', () => {
  const effects = effectsIn('maresme');
  effects.setWeather('snow', 1, true);
  for (let t = 0; t < 3; t += 1 / 60) effects.update(1 / 60, { focus: { x: 0, y: 0, z: 0 }, reach: 30, animate: false, paused: false });
  const kinds = effects.particles.snapshot().map(p => p.kind);
  assert.equal(kinds.filter(k => k === 'snow').length, 0);
  assert.ok(kinds.filter(k => k === 'drift').length > 300);
  effects.setWeather('rain', 1, true);
  for (let t = 0; t < 1; t += 1 / 60) effects.update(1 / 60, { focus: { x: 0, y: 0, z: 0 }, reach: 30, animate: false, paused: false });
  assert.equal(effects.particles.snapshot().filter(p => p.kind === 'rain').length, 0);
});

test('a three-colour kind passes through its middle colour when its middle says', () => {
  const particles = createParticles(headlessApp(), 16);
  particles.define('ember', { shape: 'glow', colour: ['#ff0000', '#00ff00', '#0000ff'], middle: .25, life: 1, size: .05 });
  particles.burst('ember', { x: 0, y: 1, z: 0 }, 1);
  const colour = () => particles.snapshot()[0].colour;
  assert.ok(colour()[0] > .8 && colour()[1] < .05, 'red at birth');
  run(particles, .25);
  assert.ok(colour()[1] > .8 && colour()[0] < .1 && colour()[2] < .1, `green at a quarter of its life: ${colour()}`);
  run(particles, .5);
  assert.ok(colour()[2] > colour()[1], 'turning blue towards the end');
});

test('effects can be drawn in front of whoever they burst from', () => {
  const particles = createParticles(headlessApp(), 16);
  particles.define('spark', { shape: 'glow', colour: '#ffffff', life: 1, size: .05, front: .8 });
  particles.define('dust', { shape: 'puff', orient: 'ground', colour: '#ffffff', life: 1, size: .05, front: .8 });
  particles.burst('spark', { x: 0, y: 1, z: 0 }, 1);
  particles.burst('spark', { x: 0, y: 1, z: 0 }, 1, { front: .3 });
  particles.burst('dust', { x: 0, y: 0, z: 0 }, 1);
  // A burst may bring its own; ground particles never take it.
  assert.deepEqual(particles.snapshot().map(p => p.front), [.8, .3, 0].map(v => Math.fround(v)));
});

test('flames are born standing up, and smoke that is not pulled ignores attractors', () => {
  const particles = createParticles(headlessApp(), 400);
  particles.define('tongue', { shape: 'flame', colour: '#ffaa33', life: 10, size: .2, tilt: 10 });
  particles.define('smoke', { shape: 'smoke', colour: '#444444', life: 10, size: .2, pulled: 0 });
  particles.define('spark', { shape: 'glow', colour: '#ffffff', life: 10, size: .05 });
  particles.burst('tongue', { x: 0, y: 0, z: 0 }, 100);
  assert.ok(particles.snapshot().every(p => Math.abs(p.angle) <= 10 * Math.PI / 180 + 1e-6), 'upright within 10°');
  particles.clear();
  particles.burst('smoke', { x: 1, y: 0, z: 0 }, 20);
  particles.burst('spark', { x: 1, y: 0, z: 0 }, 20);
  particles.attract({ at: { x: 0, y: 0, z: 0 }, pull: 20, radius: 3 });
  run(particles, .5);
  const near = kind => particles.snapshot().filter(p => p.kind === kind).every(p => Math.hypot(p.x, p.z) < .9);
  assert.ok(near('spark'), 'sparks are drawn in');
  assert.ok(!near('smoke') && particles.snapshot().filter(p => p.kind === 'smoke').every(p => Math.abs(p.x - 1) < 1e-6), 'smoke stays put');
});

test('each level of fire burns bigger and taller than the one below, drawn whole, and dies down when stopped', () => {
  const effects = effectsIn('patio');
  const flames = () => effects.flames.list();
  const measure = level => {
    effects.clear(); play(effects, .1);
    const fire = effects.fire(new pc.Vec3(0, 0, 0), level);
    play(effects, 3);
    const [flame] = flames();
    const sparks = effects.particles.snapshot().filter(p => p.kind === 'fleck').length;
    const burning = fire.burning;
    fire.stop();
    return { flame: { ...flame }, sparks, burning, fire };
  };
  const light = measure('light'), medium = measure('medium'), high = measure('high');
  assert.ok(light.burning && medium.burning && high.burning, 'each one burns');
  // One flame each, never a stream of sprites: only its sparks fly as particles.
  assert.equal(effects.particles.snapshot().filter(p => !['fleck', 'mote', 'firefly'].includes(p.kind)).length, 0);
  assert.ok(light.flame.height < medium.flame.height && medium.flame.height < high.flame.height, `taller at each level: ${light.flame.height}, ${medium.flame.height}, ${high.flame.height}`);
  assert.ok(light.flame.width < medium.flame.width && medium.flame.width < high.flame.width, 'wider at each level');
  assert.ok(light.sparks < medium.sparks && medium.sparks < high.sparks, `more sparks at each level: ${light.sparks}, ${medium.sparks}, ${high.sparks}`);
  assert.ok(high.flame.height > 1.8 && high.flame.height < 2.8, `a blaze stands about two metres tall, not ${high.flame.height}`);
  assert.notEqual(light.flame.seed, medium.flame.seed, 'every fire has its own pattern');
  // Stopped, it dies down over a moment rather than vanishing, and its flame goes with it.
  play(effects, .2);
  assert.ok(high.fire.burning && flames()[0].strength < .9, 'still dying down');
  play(effects, 1);
  assert.ok(!high.fire.burning);
  assert.equal(flames().length, 0, 'its flame is gone');
});

test('a fire around someone burns behind them and in front of them', () => {
  const effects = effectsIn('patio');
  effects.fire(new pc.Vec3(0, 0, 0), 'medium', { body: { radius: .4, height: 1.6 } });
  play(effects, 1);
  const [behind, front] = effects.flames.list();
  assert.ok(behind.nearer < -.4 && front.nearer > .4, `drawn behind (${behind.nearer}) and in front (${front.nearer})`);
  assert.ok(front.hollow > 0 && front.height < behind.height, 'the front licks up their lower half and lets them show through');
  assert.ok(behind.height >= 1.6 * .85 * .9, 'it reaches up them as its level says');
});

test('a fire changes level while it burns and a fight clearing its effects puts it out', () => {
  const effects = effectsIn('patio');
  const fire = effects.fire(new pc.Vec3(0, 0, 0), 'light');
  play(effects, 2);
  const before = effects.flames.list()[0].height;
  fire.level = 'high';
  play(effects, .1);
  assert.ok(effects.flames.list()[0].height < 1.5, 'it grows into its new level rather than jumping');
  play(effects, 2);
  assert.equal(fire.level, 'high');
  assert.ok(effects.flames.list()[0].height > before * 3, `it grew: ${before} → ${effects.flames.list()[0].height} m`);
  effects.clear();
  play(effects, .1);
  assert.ok(!fire.burning);
});

test('a fire on someone burns their own parts, grows out of their triangles, heats them and shares its light', () => {
  const app = headlessApp();
  const effects = createEffects(app), environment = ENVIRONMENTS.patio;
  const cx = (environment.grid[0].length - 1) / 2, cz = (environment.grid.length - 1) / 2;
  effects.setScene(environment, { root: new pc.Entity(), groundHeight: () => 0, toWorld: (x, z) => new pc.Vec3(x - cx, 0, z - cz), houses: [] });
  // Two dogs side by side, each a body and a head.
  const dog = x => {
    const model = new pc.Entity();
    for (const [y, size] of [[.35, [.8, .4, .35]], [.65, [.3, .3, .3]]]) {
      const part = new pc.Entity(); part.addComponent('render', { type: 'box' }); part.setLocalPosition(0, y, 0); part.setLocalScale(...size); model.addChild(part);
    }
    model.setPosition(x, 0, 0); app.root.addChild(model);
    return model;
  };
  const first = dog(0), second = dog(1);
  const fire = effects.fire(new pc.Vec3(0, 0, 0), 'high', { model: first });
  effects.fire(new pc.Vec3(1, 0, 0), 'medium', { model: second });
  play(effects, 1.5);
  assert.equal(effects.flames.list().length, 0, 'nothing stands on the floor: they burn themselves');
  assert.ok(effects.flames.tongues >= 2 * 36, `tongues of flame grow out of them: ${effects.flames.tongues}`);
  assert.ok(fire.glow > .3, 'it heats whoever it is on');
  const shells = app.scene.layers.getLayerById(pc.LAYERID_WORLD).meshInstances.filter(m => m.material.name === 'Llamas sobre el cuerpo');
  assert.equal(shells.length, 4, 'every part of both dogs burns');
  const lights = app.root.find(e => e.name === 'Luz del fuego' && e.enabled);
  assert.equal(lights.length, 1, 'fires side by side cast one light between them');
  effects.clear();
  assert.equal(app.scene.layers.getLayerById(pc.LAYERID_WORLD).meshInstances.filter(m => m.material.name === 'Llamas sobre el cuerpo').length, 0, 'put out, nothing is left on them');
  assert.equal(effects.flames.tongues, 0, 'nor any tongue of flame');
});

test('without a GPU that renders to float textures, fights keep their particles on the CPU', () => {
  const effects = effectsIn('patio');
  assert.equal(effects.gpu, undefined, 'the headless device cannot simulate on the GPU');
  effects.setFighters([]);
  effects.impact({ x: 0, y: 1, z: 0 }, { x: -2, y: 1, z: 0 }, 1.4);
  play(effects, .05, true);
  assert.ok(effects.particles.snapshot().some(p => p.kind === 'spark'), 'a blow still throws its sparks');
});

test('Zarpazo sangriento tears three claw lines side by side, from top right to bottom left, one after another', () => {
  const lines = clawLines(1);
  assert.equal(lines.length, 3);
  for (const l of lines) assert.ok(l.from.x > l.to.x && l.from.y > l.to.y, 'down and to the left');
  // Parallel: the same direction, and apart across it.
  const dir = l => { const dx = l.to.x - l.from.x, dy = l.to.y - l.from.y, d = Math.hypot(dx, dy); return { x: dx / d, y: dy / d }; };
  for (const l of lines) assert.ok(Math.abs(dir(l).x - dir(lines[0]).x) < 1e-9 && Math.abs(dir(l).y - dir(lines[0]).y) < 1e-9);
  const mid = l => ({ x: (l.from.x + l.to.x) / 2, y: (l.from.y + l.to.y) / 2 });
  assert.ok(Math.hypot(mid(lines[0]).x - mid(lines[1]).x, mid(lines[0]).y - mid(lines[1]).y) > .1);
  assert.ok(lines[0].delay < lines[1].delay && lines[1].delay < lines[2].delay);
  // Twice the size, twice as long.
  const length = l => Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y);
  assert.ok(Math.abs(length(clawLines(2)[1]) - 2 * length(lines[1])) < 1e-9);
});
