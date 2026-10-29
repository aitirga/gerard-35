import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { createTrails, recordedLine, stripVertices } from '../src/trails.ts';

// The engine runs headless: a null graphics device on a stand-in canvas.
function headlessApp() {
  const canvas = { width: 320, height: 180, style: {}, addEventListener() {}, removeEventListener() {} };
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem];
  options.resourceHandlers = [];
  app.init(options);
  return app;
}
const look = { head: [1, 1, 1], tail: [1, .5, 0], width: .2, life: .3, intensity: 2, additive: 1, core: .7, taper: 1, opacity: 1 };
const STRIDE = 16;

test('a recorded trail follows a smooth curve between sparse samples and ends exactly at its age', () => {
  // A head going round a 1 m circle, sampled at a choppy 12 frames a second.
  const samples = new Float32Array(8 * 4);
  for (let i = 0; i < 8; i++) { const t = i / 12, a = t * 4; samples.set([Math.cos(a), 1, Math.sin(a), t], i * 4); }
  const now = 7 / 12, out = new Float32Array(256 * 4);
  const n = recordedLine(samples, 8, now, .4, out);
  assert.ok(n > 20, `only ${n} points: segments are not subdivided`);
  for (let i = 0; i < n; i++) {
    const r = Math.hypot(out[i * 4], out[i * 4 + 2]);
    assert.ok(Math.abs(r - 1) < .02, `point ${i} strays ${r - 1} m off the circle`);
    if (i) assert.ok(out[i * 4 + 3] >= out[(i - 1) * 4 + 3], 'ages grow towards the tail');
  }
  assert.ok(out[3] < 1e-6, "the head is now");
  assert.ok(Math.abs(out[(n - 1) * 4 + 3] - .4) < 1e-6, 'the tail ends where points are `life` old');
});

test('every trail shares one strip, joined by triangles with no area', () => {
  const points = new Float32Array([0, 0, 0, 0, 1, 0, 0, .15, 2, 0, 0, .3]);
  const out = new Float32Array(64 * STRIDE);
  const first = stripVertices(points, 3, look, out, 0, false);
  assert.equal(first, 8, 'a tip and two vertices a point');
  const second = stripVertices(points, 3, look, out, first, true);
  assert.equal(second, first + 10);
  const vertex = i => Array.from(out.subarray(i * STRIDE, i * STRIDE + 4));
  // The previous strip's last vertex, then the next one's first, each said twice.
  assert.deepEqual(vertex(first), vertex(first - 1));
  assert.deepEqual(vertex(first + 1), vertex(first + 2));
  // Widest at the head, a fifth of it left at the tail, and the colour on its way from head to tail.
  assert.ok(Math.abs(out[2 * STRIDE + 3]) > Math.abs(out[4 * STRIDE + 3]));
  assert.ok(Math.abs(Math.abs(out[6 * STRIDE + 3]) - .02) < 1e-6);
  assert.ok(out[4 * STRIDE + 10] < out[2 * STRIDE + 10]);
  // No room: the strip is left out rather than cut.
  assert.equal(stripVertices(points, 3, look, new Float32Array(4 * STRIDE), 0, false), 0);
});

test('a strip in a plane spreads across the line within it', () => {
  const points = new Float32Array([0, 0, 0, 0, 1, 0, 0, .1]);
  const out = new Float32Array(8 * STRIDE);
  stripVertices(points, 2, { ...look, normal: [0, 0, 1] }, out, 0, false);
  // Moving along −x… the head first, so the tangent points to −x; across = z × −x = −y.
  assert.equal(out[2 * STRIDE + 7], 1);
  assert.deepEqual(Array.from(out.subarray(2 * STRIDE + 4, 2 * STRIDE + 7)).map(v => Math.round(v)), [0, -1, 0]);
});

test('a followed entity leaves a trail that fades out after it stops', () => {
  const app = headlessApp(), trails = createTrails(app);
  const fist = new pc.Entity(); app.root.addChild(fist);
  const trail = trails.follow(fist, { life: .2 });
  for (let i = 0; i < 20; i++) { fist.setPosition(i * .1, 1, 0); trails.update(1 / 60); }
  assert.ok(trails.stats.vertices > 10);
  trail.stop();
  trails.update(.1); assert.ok(!trail.done);
  trails.update(.15); assert.ok(trail.done); assert.equal(trails.stats.trails, 0); assert.equal(trails.stats.vertices, 0);
  // A destroyed entity ends its trail too.
  const again = trails.follow(fist);
  fist.destroy(); trails.update(1); assert.ok(again.done);
});

test('a comet arrives once, then its tail catches up', () => {
  const trails = createTrails(headlessApp());
  let arrived = 0;
  const comet = trails.comet({ x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }, '#e2483d', .3, { onArrive: () => arrived++ });
  for (let i = 0; i < 15; i++) trails.update(1 / 60);
  assert.equal(arrived, 0); assert.ok(trails.stats.vertices > 0);
  for (let i = 0; i < 6; i++) trails.update(1 / 60);
  assert.equal(arrived, 1);
  for (let i = 0; i < 30; i++) trails.update(1 / 60);
  assert.equal(arrived, 1); assert.ok(comet.done); assert.equal(trails.stats.vertices, 0);
});

test('reduced motion draws no trails and clear ends them all', () => {
  const trails = createTrails(headlessApp());
  trails.spiral({ x: 0, y: 0, z: 0 }, '#f3cf78');
  trails.update(.2); assert.ok(trails.stats.vertices > 0);
  trails.clear(); assert.equal(trails.stats.trails, 0);
  trails.enabled = false;
  assert.ok(trails.comet({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, '#fff').done);
  trails.update(.1); assert.equal(trails.stats.vertices, 0);
});

test('a trail kept in its swinger\'s space moves with them instead of streaking behind', () => {
  const app = headlessApp(), trails = createTrails(app);
  const body = new pc.Entity(), hand = new pc.Entity(); app.root.addChild(body); body.addChild(hand);
  hand.setLocalPosition(0, 1, 0);
  trails.follow(hand, { space: body, life: 1 });
  // The body runs 3 m while the hand stays put on it: nothing to draw but the head.
  for (let i = 1; i <= 30; i++) { body.setPosition(i * .1, 0, 0); trails.update(1 / 60); }
  assert.equal(trails.stats.vertices, 0);
  // The hand swings round the shoulder: the arc is drawn where the body is now.
  for (let i = 1; i <= 10; i++) { hand.setLocalPosition(Math.sin(i * .15), Math.cos(i * .15), 0); trails.update(1 / 60); }
  assert.ok(trails.stats.vertices > 10);
});
