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

// Nuria's cats on the game's cat skeleton (tools/animal_rig.py) and Nil, whom Uri carries.
const filesIn = folder => readdirSync(new URL(`../src/${folder}/`, import.meta.url)).filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(new URL(`../src/${folder}/${file}`, import.meta.url), 'utf8')));
const LEGS = ['lf', 'rf', 'lh', 'rh'];

for (const spec of filesIn('animals')) {
  test(`${spec.id}: its file has the cat skeleton src/cats.ts poses, and the gait its measures`, () => {
    const path = new URL(`../public/${spec.glb}`, import.meta.url);
    assert.ok(existsSync(path), `${spec.glb} is missing: run just character-3d ${spec.id}`);
    const { nodes, skins } = gltfOf(path);
    const names = nodes.map(node => node.name);
    const bones = ['Cuerpo de gato', ...LEGS.flatMap(leg => [`Pata ${leg}`, `Rodilla ${leg}`]), 'Cabeza de gato', 'Oreja izquierda', 'Oreja derecha',
      ...Array.from({ length: spec.rig.tailSegments }, (_, i) => `Cola ${i + 1}`)];
    for (const name of [...bones, 'Ojo izquierdo', 'Ojo derecho']) assert.equal(names.filter(n => n === name).length, 1, name);
    assert.deepEqual(skins[0].joints.map(i => nodes[i].name).sort(), [...bones].sort(), 'every bone skins, by a name of its own');
    for (const leg of LEGS) {
      assert.ok(spec.rig.bones[leg].every(n => n > 0) && Math.abs(spec.rig.bend[leg]) === 1, leg);
      // The gait stands it on its legs: neither straight nor folded flat.
      const reach = spec.rig.bodyY + spec.rig.joints[leg].y, length = spec.rig.bones[leg][0] + spec.rig.bones[leg][1];
      assert.ok(reach > .6 * length && reach < .95 * length, `${leg} stands at ${(reach / length).toFixed(2)} of its length`);
      assert.ok(Math.sign(spec.rig.joints[leg].x) === (leg[0] === 'l' ? 1 : -1) && Math.sign(spec.rig.joints[leg].z) === (leg[1] === 'f' ? 1 : -1), `${leg} where it belongs`);
    }
    assert.ok(spec.lids.size.every(n => n > 0) && /^#[0-9a-f]{6}$/.test(spec.lids.color), 'its lids say their size and colour');
  });
}

for (const spec of filesIn('held')) {
  test(`${spec.id}: its file is there and someone carries it`, () => {
    assert.ok(existsSync(new URL(`../public/${spec.glb}`, import.meta.url)), `${spec.glb} is missing: run just character-3d ${spec.id}`);
    assert.ok(specs.some(carrier => carrier.carries === spec.id && carrier.glb), 'a model from a file carries it');
  });
}
