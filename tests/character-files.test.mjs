import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const specs = readdirSync(new URL('../src/characters/', import.meta.url)).filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(new URL(`../src/characters/${file}`, import.meta.url), 'utf8')));
const models = specs.filter(spec => spec.glb);

/** The JSON at the start of a GLB. */
function gltfOf(path) {
  const data = readFileSync(path);
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
}

test('Gerard at 35 and Aitor are models from a file', () => {
  for (const id of ['aitor', 'gerard-adult']) assert.ok(models.some(spec => spec.id === id), id);
});

test('every portrait the dialogue can ask for has its file', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/portraits.json', import.meta.url), 'utf8'));
  for (const [name, expressions] of Object.entries(manifest)) for (const end of ['', ...expressions.map(e => `-${e}`)]) {
    assert.ok(existsSync(new URL(`../public/portraits/${name}${end}.png`, import.meta.url)), `${name}${end}`);
  }
});

for (const spec of models) {
  const path = new URL(`../public/${spec.glb}`, import.meta.url);
  test(`${spec.id}: its file has the nodes the game animates`, () => {
    assert.ok(existsSync(path), `${spec.glb} is missing: run just character-3d ${spec.id}`);
    const { nodes, skins, scenes } = gltfOf(path);
    const named = name => nodes.filter(node => node.name === name);
    assert.deepEqual(scenes[0].nodes.map(i => nodes[i].name), ['Cuerpo'], 'the body is the one root');
    for (const [name, count] of Object.entries({ Pierna: 2, Brazo: 2, Espinilla: 2, Antebrazo: 2, Tobillo: 2, Zapatilla: 2, Mano: 2, Ojo: 2, Boca: 1, 'Pivote de cabeza': 1, 'Soporte de cabeza': 1 })) {
      assert.equal(named(name).length, count, name);
    }
    const body = nodes.find(node => node.name === 'Cuerpo');
    for (const eye of named('Ojo')) assert.ok(eye.rotation, 'an eye turns to the surface of the face');
    assert.ok(spec.lids?.size.every(n => n > 0) && /^#[0-9a-f]{6}$/.test(spec.lids.color), 'its lids say their size and colour');
    assert.deepEqual(body.children.slice(0, 4).map(i => nodes[i].name), ['Pierna', 'Brazo', 'Pierna', 'Brazo'], 'leg then arm per side');
    assert.ok(nodes[body.children[0]].translation[0] < 0, 'the left of the picture first');
    // Skinning finds bones by name.
    const bones = skins[0].joints.map(i => nodes[i].name);
    assert.equal(new Set(bones).size, bones.length, 'no two bones share a name');
    for (const i of skins[0].joints) assert.ok(!nodes[i].rotation && !nodes[i].scale, `${nodes[i].name} rests at no rotation`);
  });

  test(`${spec.id}: its materials are the ones an ánima dyes`, () => {
    const { materials } = gltfOf(path);
    assert.deepEqual(materials.map(m => m.name).sort(), Object.values(spec.materials).map(m => m.name).sort());
    assert.ok(spec.materials.jacket && spec.materials.trousers && spec.materials.skin);
  });

  test(`${spec.id}: stands on the ground, as tall as the rest in its coordinates`, () => {
    const { accessors, meshes } = gltfOf(path);
    const { min, max } = accessors[meshes[0].primitives[0].attributes.POSITION];
    assert.ok(Math.abs(min[1] - .02) < 1e-3, `soles at ${min[1]}`);
    assert.ok(max[1] > 1.2 && max[1] < 1.6, `top at ${max[1]}`);
    assert.ok(spec.rig.leg[1] > .4 && spec.rig.leg[1] < .75, 'hips about half way up');
  });
}

test('Gerard and Bernat at ten carry their school backpacks, sized by their trunk', () => {
  for (const id of ['gerard-child', 'bernat-child']) {
    const spec = specs.find(s => s.id === id);
    assert.ok(spec?.backpack, `${id} has a backpack`);
    assert.ok(/^#[0-9a-f]{6}$/.test(spec.backpack.bag) && /^#[0-9a-f]{6}$/.test(spec.backpack.straps), `${id}: its colours`);
    if (spec.glb) assert.ok(spec.parts.some(part => part.name === 'Torso'), `${id}: a Torso to hang it on`);
  }
});
