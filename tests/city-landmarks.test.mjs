import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDMARK_MODELS, shadeOf } from '../src/city-landmarks.ts';
import { ICONS, cityMarkers } from '../src/map-markers.ts';

/** A sink that only keeps the triangles' corners, as city-3d.ts's Geometry would get them. */
function sink() {
  const pos = [], idx = [];
  return {
    pos, idx,
    reserve() {},
    vertex(x, y, z) { pos.push([x, y, z]); return pos.length - 1; },
    tri(a, b, c) { idx.push(a, b, c); },
    quad(a, b, c, d) { idx.push(a, b, c, a, c, d); },
  };
}

test('every marker on the map but the castle has a 3D model', () => {
  for (const icon of Object.keys(ICONS).filter(i => i !== 'bubbaloo')) assert.ok(LANDMARK_MODELS[icon], icon);
  for (const m of cityMarkers({ castle: false, threat: 0 })) assert.ok(LANDMARK_MODELS[m.icon], m.icon);
});

test('each model stands on the ground round its place, under its name card and inside its clearing', () => {
  for (const [icon, model] of Object.entries(LANDMARK_MODELS)) {
    const g = sink();
    model.build(g, 1000, -500);
    assert.ok(g.idx.length >= 36, `${icon} draws something`);
    assert.ok(g.idx.every(i => i < g.pos.length), `${icon} indexes its own vertices`);
    const ys = g.pos.map(p => p[1]), top = Math.max(...ys);
    assert.ok(Math.min(...ys) >= -10, `${icon} does not sink into the ground`);
    assert.ok(top <= model.top + 15 && top >= model.top * .6, `${icon}'s card (${model.top}) hangs just over its top (${top.toFixed(0)})`);
    const reach = Math.max(...g.pos.map(p => Math.hypot(p[0] - 1000, p[2] + 500)));
    assert.ok(reach <= model.clear * 1.6 + 40, `${icon} (${reach.toFixed(0)} m) stays near its clearing (${model.clear} m)`);
  }
});

test('faces are lit from the front left, tops brightest', () => {
  assert.ok(shadeOf([0, 1, 0]) > shadeOf([-.8, 0, .6]));
  assert.ok(shadeOf([-.8, 0, .6]) > shadeOf([.8, 0, -.6]));
  assert.ok(shadeOf([0, -1, 0]) < shadeOf([.8, 0, -.6]));
});
