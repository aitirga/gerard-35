import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { tintColour } from '../src/materials.ts';

const root = new URL('../', import.meta.url);
const scenes = readdirSync(new URL('src/geo/', root)).filter(f => f.endsWith('.json') && f !== 'barcelona.json')
  .map(f => ({ file: f, scene: JSON.parse(readFileSync(new URL(`src/geo/${f}`, root), 'utf8')) }));
const textures = readdirSync(new URL('public/textures/', root)).filter(id => existsSync(new URL(`public/textures/${id}/texture.json`, root)));

test('every texture a place names is shipped, as tools/geo.py embedded it', () => {
  for (const { file, scene } of scenes) {
    for (const [id, info] of Object.entries(scene.textures ?? {})) {
      const meta = JSON.parse(readFileSync(new URL(`public/textures/${id}/texture.json`, root), 'utf8'));
      assert.deepEqual(info.files, meta.files, `${file}: ${id} is out of date; run just geo-build`);
      assert.deepEqual(info.size_m, meta.size_m, `${file}: ${id} is out of date; run just geo-build`);
    }
    const named = [...Object.values(scene.materials ?? {}).map(m => m.texture), ...scene.buildings.flatMap(b => Object.values(b.materials ?? {}))];
    for (const id of named) assert.ok(scene.textures?.[id], `${file}: ${id} is used but not embedded`);
  }
});

test('every texture says where it comes from, under a licence that can ship, and stays light', () => {
  for (const id of textures) {
    const meta = JSON.parse(readFileSync(new URL(`public/textures/${id}/texture.json`, root), 'utf8'));
    assert.equal(meta.id, id);
    assert.match(meta.source.licence, /^(CC0|CC BY|public domain|own work)/i, `${id}: licence`);
    assert.ok(meta.source.author, `${id}: author`);
    assert.ok(meta.size_m.length === 2 && meta.size_m.every(v => v > 0), `${id}: real size in metres`);
    assert.ok(Math.max(...meta.px) <= 2048, `${id}: at most 2048 px`);
    for (const file of Object.values(meta.files)) {
      const size = statSync(new URL(`public/textures/${id}/${file}`, root)).size;
      assert.ok(size <= 400_000, `${id}/${file} is ${Math.round(size / 1024)} KB; keep each file under 400 KB`);
    }
  }
});

test('every landmark kind in a place has its builder in src/landmarks/', async () => {
  for (const { file, scene } of scenes) {
    for (const landmark of scene.landmarks ?? []) {
      const path = new URL(`src/landmarks/${landmark.kind}.ts`, root);
      assert.ok(existsSync(path), `${file}: no src/landmarks/${landmark.kind}.ts for ${landmark.id}`);
      const builder = await import(path);
      assert.equal(builder.kind, landmark.kind);
      assert.equal(typeof builder.build, 'function');
    }
  }
});

test('a tinted grey texture averages the tint, as a canvas painted in it would', () => {
  for (const [tint, linear] of [['#cbc2ab', 0.21], ['#b05a38', 0.05], ['#3e4043', 0.4]]) {
    const c = tintColour(tint, { linear });
    const expect = [1, 3, 5].map(i => (parseInt(tint.slice(i, i + 2), 16) / 255) ** 2.2);
    [c.r, c.g, c.b].forEach((v, i) => assert.ok(Math.abs(v ** 2.2 * linear - expect[i]) < 1e-6, `${tint} channel ${i}`));
  }
});
