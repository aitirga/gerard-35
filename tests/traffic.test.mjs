import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pc from 'playcanvas';
import { createTraffic } from '../src/traffic.ts';

// The Meridiana's real lanes, with bare entities standing in for the car and bus models.
const scene = JSON.parse(readFileSync(new URL('../src/geo/meridiana-calle.json', import.meta.url)));
const cx = (scene.width - 1) / 2, cz = (scene.depth - 1) / 2;
function street() {
  const root = new pc.Entity();
  const kit = { signals: [], place: (_prop, parent, position) => { const e = new pc.Entity(); e.setLocalPosition(position); parent.addChild(e); return e; } };
  const traffic = createTraffic(root, kit, scene, v => v - cx, v => v - cz);
  const cars = () => root.children.map(c => { const p = c.getLocalPosition(); return { x: p.x + cx, z: p.z + cz }; });
  return { traffic, cars };
}

test('the avenue and its side streets fill with traffic that never drives into itself', () => {
  const { traffic, cars } = street();
  let closest = Infinity;
  for (let frame = 0; frame < 1200; frame++) {
    traffic.update(1 / 20, []);
    const all = cars();
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) closest = Math.min(closest, Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z));
  }
  const all = cars();
  assert.ok(all.length > 25, `only ${all.length} vehicles`);
  assert.ok(all.some(c => c.z < 40 || c.z > 70), 'no traffic on the side streets');
  assert.ok(closest > 1, `two vehicles came within ${closest.toFixed(2)} cells`);
});

test('cars stop for someone standing in their lane', () => {
  const { traffic, cars } = street();
  // The middle lane of the east carriageway (z 4.75 m in the turned frame), which drives towards -x.
  const lane = { x: 100, z: (4.75 + 72) / 1.5 - 0.5 };
  for (let frame = 0; frame < 900; frame++) {
    traffic.update(1 / 20, [lane]);
    for (const c of cars()) assert.ok(Math.hypot(c.x - lane.x, c.z - lane.z) > 1.2, `a car reached the walker at frame ${frame}`);
  }
  // A queue has formed behind the walker, its first car standing still a couple of cells away.
  const first = () => cars().filter(c => Math.abs(c.z - lane.z) < 0.5 && c.x > lane.x).sort((a, b) => a.x - b.x)[0];
  const before = first();
  assert.ok(before && before.x < lane.x + 4, 'no car waits just upstream');
  traffic.update(1, [lane]);
  assert.equal(first().x, before.x, 'the first car keeps creeping on');
});
