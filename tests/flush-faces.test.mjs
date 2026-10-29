import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { findFlushFaces, separateFlushFaces, separateFlushFacesOnArrival } from '../src/flush-faces.ts';

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
function material(hex) {
  const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.update(); return m;
}
function box(parent, name, m, [x, y, z], [w, h, d]) {
  const e = new pc.Entity(name); e.addComponent('render', { type: 'box', material: m });
  e.setLocalPosition(x, y, z); e.setLocalScale(w, h, d); parent.addChild(e); return e;
}
/** Where a box's face along +x is, in world units. */
const rightFace = e => e.getPosition().x + e.getWorldTransform().getX(new pc.Vec3()).length() / 2;
const topFace = e => e.getPosition().y + e.getWorldTransform().getY(new pc.Vec3()).length() / 2;

test('a leg flush with the side of a body comes out in front of it, the body stays put', () => {
  const app = headlessApp();
  const dog = new pc.Entity('Perro'); app.root.addChild(dog);
  const body = box(dog, 'Lomo', material('#c49464'), [0, .48, 0], [.42, .4, .8]);
  const leg = box(dog, 'Pata', material('#f1dfb8'), [.15, .18, .27], [.12, .36, .15]);
  assert.equal(findFlushFaces(dog).length, 1);
  assert.equal(separateFlushFaces(dog), 1);
  assert.deepEqual(findFlushFaces(dog), []);
  assert.ok(Math.abs(rightFace(body) - .21) < 1e-6);
  assert.ok(rightFace(leg) > .211 && rightFace(leg) < .213, `the leg's face moved a millimetre or two, not ${rightFace(leg)}`);
  // Its other side has not moved, so nothing opens a gap.
  assert.ok(Math.abs(leg.getPosition().x - leg.getWorldTransform().getX(new pc.Vec3()).length() / 2 - .09) < 1e-6);
  assert.equal(separateFlushFaces(dog), 0, 'running it again changes nothing');
});

test('a stack of details on one plane comes out in order: wall, step, tread', () => {
  const app = headlessApp();
  const room = new pc.Entity('Sala'); app.root.addChild(room);
  const wall = box(room, 'Muro', material('#ddd'), [0, .5, 0], [4, 1, 4]);
  const step = box(room, 'Peldaño', material('#888'), [0, .75, 0], [1, .5, 1]);
  const tread = box(room, 'Huella', material('#a66'), [0, .95, 0], [.6, .1, .6]);
  separateFlushFaces(room);
  assert.deepEqual(findFlushFaces(room), []);
  assert.ok(topFace(wall) < topFace(step) && topFace(step) < topFace(tread));
  assert.ok(topFace(tread) - topFace(wall) < .005, 'still well under a pixel');
});

test('flush parts in the same plain colour are left alone, they cannot flicker', () => {
  const app = headlessApp();
  const rim = new pc.Entity('Gafas'); app.root.addChild(rim);
  const black = material('#111');
  box(rim, 'Montura', black, [0, 0, 0], [.1, .012, .01]);
  box(rim, 'Montura', black, [.05, 0, 0], [.1, .012, .01]);
  assert.deepEqual(findFlushFaces(rim), []);
});

test('every model put in the scene is separated once it has been built', async () => {
  const app = headlessApp();
  separateFlushFacesOnArrival(app);
  // Added first and filled after, as the game's builders do.
  const dog = new pc.Entity('Perro'); app.root.addChild(dog);
  box(dog, 'Lomo', material('#c49464'), [0, .48, 0], [.42, .4, .8]);
  const leg = box(dog, 'Pata', material('#f1dfb8'), [.15, .18, .27], [.12, .36, .15]);
  await Promise.resolve();
  assert.deepEqual(findFlushFaces(dog), []);
  assert.ok(rightFace(leg) > .211);
});
