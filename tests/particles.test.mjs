import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { createParticles } from '../src/particles.ts';
import { createEffects, sceneWorld } from '../src/effects.ts';
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
    effects.heal(target); effects.insight(target); effects.stamp(target); effects.anima(target, '#e2483d', true); effects.poof(target);
    effects.confetti(target, ['#f3cf78', '#e2483d']);
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
