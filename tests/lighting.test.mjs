import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHTING, shadowSlice } from '../src/lighting.ts';

const { floor, margin, step } = LIGHTING.shadow;
// The street camera: 40, 52, 40 from what it looks at, so its forward points 42° down.
const street = (height, y = 52) => ({ y, up: .741, right: 0, down: .672, height, width: height * 16 / 9 });
const sphere = (s, v) => Math.sqrt(((s.far - s.near) / 2) ** 2 + v.height ** 2 + v.width ** 2);

test('the shadow slice covers what the camera sees between the floor and the tallest thing', () => {
  const view = street(8), s = shadowSlice(view, floor, 8, margin, step);
  // The ground at the top of the screen is the farthest receiver, a rooftop at the bottom the nearest.
  assert.ok(s.far >= (view.y + view.height * view.up - floor) / view.down);
  assert.ok(s.near <= (view.y - view.height * view.up - 8) / view.down);
  // About half the radius the engine used for the whole view box (camera near clip to 95 m).
  const old = Math.sqrt((95 / 2) ** 2 + view.height ** 2 + view.width ** 2);
  assert.ok(s.radius < old * .5, `${s.radius} vs ${old}`);
});

test('the engine’s bounding sphere lands on the stepped radius', () => {
  for (const h of [5.7, 8, 11, 19]) {
    const view = street(h), s = shadowSlice(view, floor, 6, margin, step);
    assert.ok(Math.abs(sphere(s, view) - s.radius) < 1e-6);
    assert.ok(Math.abs(Math.log(s.radius) / Math.log(step) - Math.round(Math.log(s.radius) / Math.log(step))) < 1e-6);
  }
});

test('small zoom changes keep the same radius, so the texel grid holds still', () => {
  const radii = new Set();
  for (let h = 8; h < 8.15; h += .01) radii.add(shadowSlice(street(h), floor, 6, margin, step).radius);
  assert.ok(radii.size <= 2, `${radii.size} radii`);
});

test('moving the camera along the ground leaves the radius alone', () => {
  const a = shadowSlice(street(8, 52), floor, 6, margin, step), b = shadowSlice(street(8, 52.4), floor, 6, margin, step);
  assert.equal(a.radius, b.radius);
});
